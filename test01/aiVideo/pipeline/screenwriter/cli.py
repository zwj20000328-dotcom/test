"""互动式剧本创作会话状态机。

本模块是 CLI 的"大脑"，但**不含任何 print/input**——所有渲染与输入经 ui 模块注入。
这样可以用 mock LLM + mock UI 完整测试创作流程（见 tests/test_screenwriter_cli.py）。

状态机（每屏 = 一个持久化状态，崩溃后按 cursor 恢复到当前屏）：
  INIT -> SYNOPSIS -> SETTINGS_CARD -> SPEC_CONFIRM -> INVOLVEMENT_PICK
       -> SEASON_BEATS -> EP_LOOP{ BRANCH_MENU -> SCENE_GEN -> CRITIC -> EP_REVIEW }
       -> ALL_ACCEPTED -> RENDER_GATE -> EXPORTED

用户三种介入粒度（决策：视频全自动，剧本阶段人工把关）：
  tier1 major      只在重大决策点（反转/关键关系变化）问
  tier2 every_ep   每集都问（默认）
  tier3 autopilot  全自动推进，用户可随时打断否决
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional

from . import ui
from .engine import ScreenwriterEngine, estimate_render
from .emitter import compose_episode_markdown
from .models import (
    BeatSheet, Canon, Choice, EpisodeBeat, InvolvementLevel, PlotOption, Session,
)
from .session import SessionStore

log = logging.getLogger("screenwriter.cli")

# 输入解析顺序（见设计 spec）：斜杠命令 -> 纯数字选项 -> 自由文本(交意图分类)
_DIGIT_RE = re.compile(r"^([1-5])$")
# 用户覆盖规格的自由文本："30 集 × 4.5 分钟" / "改成40集"
_SPEC_OVERRIDE_RE = re.compile(r"(\d+)\s*集.*?(\d+(?:\.\d+)?)\s*分")
_EP_OVERRIDE_RE = re.compile(r"(\d+)\s*集")
_SEC_OVERRIDE_RE = re.compile(r"(\d+(?:\.\d+)?)\s*分")

# 交互循环里连续无效输入的上限。超过则保存进度并中止，避免终端异常
# （管道输入、EOF 循环、误触键盘）导致进程永久占住。
_MAX_BAD_INPUT = 5


@dataclass
class SessionState:
    """会话状态机。ui 与 engine 通过构造注入，便于测试。"""
    store: SessionStore
    engine: ScreenwriterEngine
    session: Session
    #: 意图分类器（自由文本 -> 命令）；None 时用启发式兜底
    classifier: Optional[Callable[[str, dict], dict]] = None
    now: Callable[[], str] = field(default=lambda: "")
    #: 无人值守模式（batch）：所有确认屏自动通过，绝不等待输入。
    #: 若不加此标志，batch 会在设定卡确认处因 EOF 中断（实测 bug）。
    noninteractive: bool = False
    # 运行期状态（不持久化）
    _snapshots: list[dict] = field(default_factory=list)

    # ================= 生命周期 =================

    def save(self) -> None:
        self.store.save(self.session, now=self.now())

    def snapshot(self) -> None:
        """在可能破坏性的操作前存快照，供 /undo。"""
        snap = self.store.snapshot(self.session)
        snap["_episodes_md"] = dict(self.session.episodes_md)
        self._snapshots.append(snap)
        # 只保留最近 20 个快照，避免长会话内存膨胀
        if len(self._snapshots) > 20:
            self._snapshots = self._snapshots[-20:]

    def undo(self) -> bool:
        if not self._snapshots:
            ui.warn("没有可撤销的操作。")
            return False
        snap = self._snapshots.pop()
        self.store.restore_snapshot(self.session, snap)
        self.session.episodes_md = snap.get("_episodes_md", {})
        self.save()
        ui.success("已撤销上一步。")
        return True

    # ================= 主流程 =================

    def run_new(self, *, title: str = "", synopsis: str = "",
                episodes: Optional[int] = None,
                episode_seconds: Optional[float] = None,
                involvement: Optional[int] = None,
                autoplay_to: Optional[int] = None) -> Session:
        """新建会话的完整交互流程。"""
        s = self.session
        if title:
            s.canon.title = title

        # 1. 故事简介
        if not synopsis:
            synopsis = ui.ask_multiline("请输入故事简介：")
        if not synopsis.strip():
            raise ValueError("故事简介不能为空")
        s.source_synopsis = synopsis
        self.save()

        # 2. 设定卡
        ui.title("正在创作世界观设定卡…")
        with ui.Progress("调用 LLM 生成设定卡") as p:
            canon = self.engine.plan_settings(synopsis)
        # 保留用户给的 title（若有）
        if title:
            canon.title = title
        s.canon = canon
        self.save()
        if not self._confirm_settings_card():
            return s   # 用户中止

        # 3. 规格确认（决策 #2：用户指定、模型建议）
        self._confirm_spec(episodes, episode_seconds)

        # 4. 介入粒度
        self._pick_involvement(involvement)

        # 5. 季度节拍表
        ui.title("正在规划季度弧线…")
        with ui.Progress("调用 LLM 规划 30 集弧线") as p:
            s.beats = self.engine.plan_season(s.canon, s.total_episodes, s.episode_seconds)
        self.save()
        if not self._confirm_season_beats():
            return s

        # 6. 逐集创作循环
        self._episode_loop(autoplay_to=autoplay_to)
        return s

    def _confirm_settings_card(self) -> bool:
        """第 2 屏：设定卡确认。返回 False 表示用户要中止/重做。"""
        s = self.session
        c = s.canon
        while True:
            body = (f"题材：{c.genre}\n基调：{c.tone}\n时代：{c.era}\n"
                    f"核心冲突：{c.core_conflict}\n爽点：{'、'.join(c.payoff_types)}\n\n"
                    f"角色（{len(c.characters)}）：\n")
            for ch in c.characters:
                body += f"  · {ch.name}（{ch.role}，{ch.gender or '?'}{ch.age or '?'}岁）：{ch.appearance_zh}\n"
            if c.knowledge:
                body += "\n关键秘密：\n"
                for k in c.knowledge:
                    body += f"  · {k.fact}（当事人 {k.holder}，瞒着 {'、'.join(k.hidden_from) or '无'}）\n"
            ui.panel(body, title_="世界观设定卡")
            ui.dim("角色外形将决定全剧长相一致性，请确认足够具体。")
            if self.noninteractive:
                ui.dim("（无人值守模式：自动接受设定卡）")
                return True
            ans = ui.ask("确认？", default="y", hint=" [Y/n/改] ")
            low = ans.strip().lower()
            if low in ("y", "yes", "是", ""):
                return True
            if low in ("n", "no", "否", "q", "quit"):
                ui.warn("已中止（设定卡未确认）。可重新运行 scriptwriter.py new。")
                return False
            # 自由改写
            self._apply_freeform_setting(ans)

    def _apply_freeform_setting(self, instruction: str) -> None:
        """对设定卡的自由改写（简化：记入 canon.tone 备注，重生成留待 LLM 版）。"""
        ui.warn(f"记录设定修改要求：{instruction}")
        self.session.canon.tone = (self.session.canon.tone + f"；{instruction}").strip("；")
        self.save()

    def _confirm_spec(self, episodes: Optional[int], episode_seconds: Optional[float]) -> None:
        """第 3 屏：集数与每集时长（用户指定、模型建议）。"""
        s = self.session
        with ui.Progress("评估故事体量") as p:
            spec = self.engine.plan_spec(s.canon, s.source_synopsis,
                                         user_episodes=episodes,
                                         user_seconds=episode_seconds)
        bad_input = 0
        while True:
            ui.panel(
                f"模型建议：{spec['total_episodes']} 集 × "
                f"{spec['episode_seconds'] / 60:.1f} 分钟\n"
                f"  理由：{spec['reasoning']}\n"
                f"  预计：{spec['estimated_shots']} 镜头 · "
                f"渲染约 {spec['estimated_render_days']} 天 · "
                f"磁盘约 {spec['estimated_disk_gb']}GB",
                title_="规格确认")
            if self.noninteractive:
                s.total_episodes = spec["total_episodes"]
                s.episode_seconds = spec["episode_seconds"]
                s.beats.total_episodes = spec["total_episodes"]
                s.beats.episode_seconds = spec["episode_seconds"]
                s.spec_confirmed = True
                self.save()
                ui.dim(f"（无人值守：自动接受 {s.total_episodes} 集 × "
                       f"{s.episode_seconds / 60:.1f} 分钟）")
                return
            ans = ui.ask("接受建议？", default="y", hint=" [Y/n] 或直接输入如「40 集 × 4 分钟」 ")
            low = ans.strip().lower()
            if low in ("y", "yes", "是", ""):
                s.total_episodes = spec["total_episodes"]
                s.episode_seconds = spec["episode_seconds"]
                s.beats.total_episodes = spec["total_episodes"]
                s.beats.episode_seconds = spec["episode_seconds"]
                s.spec_confirmed = True
                self.save()
                return
            if low in ("n", "no", "否"):
                s.total_episodes = spec["total_episodes"]
                s.episode_seconds = spec["episode_seconds"]
                s.spec_confirmed = True
                self.save()
                return
            # 自由覆盖："40 集 × 4 分钟"
            m = _SPEC_OVERRIDE_RE.search(ans)
            if m:
                s.total_episodes = int(m.group(1))
                s.episode_seconds = float(m.group(2)) * 60
            else:
                me = _EP_OVERRIDE_RE.search(ans)
                ms = _SEC_OVERRIDE_RE.search(ans)
                if me:
                    s.total_episodes = int(me.group(1))
                if ms:
                    s.episode_seconds = float(ms.group(1)) * 60
                if not (me or ms):
                    ui.warn("无法解析，请输入如「40 集 × 4.5 分钟」。")
                    bad_input += 1
                    if bad_input >= _MAX_BAD_INPUT:
                        self._abort_on_bad_input()
                    continue
            if not (20 <= s.total_episodes <= 50):
                ui.warn(f"集数 {s.total_episodes} 超出 20-50 范围，请重新输入。")
                bad_input += 1
                if bad_input >= _MAX_BAD_INPUT:
                    self._abort_on_bad_input()
                continue
            if not (240 <= s.episode_seconds <= 300):
                ui.warn(f"每集 {s.episode_seconds:.0f} 秒超出 240-300（4-5分钟），请重新输入。")
                bad_input += 1
                if bad_input >= _MAX_BAD_INPUT:
                    self._abort_on_bad_input()
                continue
            s.beats.total_episodes = s.total_episodes
            s.beats.episode_seconds = s.episode_seconds
            s.spec_confirmed = True
            self.save()
            ui.success(f"已采用：{s.total_episodes} 集 × {s.episode_seconds / 60:.1f} 分钟")
            return

    def _abort_on_bad_input(self) -> None:
        """连续无效输入达上限：保存进度并中止，避免终端异常时永久占住进程。"""
        self.save()
        raise ui.Interrupted(
            f"连续 {_MAX_BAD_INPUT} 次无效输入，已保存进度并中止。"
            f"可用 scriptwriter.py resume {self.session.name} 继续。")

    def _pick_involvement(self, preselect: Optional[int]) -> None:
        """第 4 屏：介入粒度。"""
        s = self.session
        ui.panel(
            "1  major      只在重大决策点（反转/关系逆转）问你，其余自动推进\n"
            "2  every_ep   每集都让你选走向（默认）\n"
            "3  autopilot  全自动推进，你可随时打断否决",
            title_="选择介入粒度")
        if preselect in (1, 2, 3):
            choice = preselect
        else:
            choice = int(ui.ask("介入粒度", default="2",
                                validate=lambda v: v in ("1", "2", "3")))
        s.involvement = {1: InvolvementLevel.major, 2: InvolvementLevel.every_episode,
                         3: InvolvementLevel.autopilot}[choice]
        self.save()
        ui.success(f"介入粒度：{s.involvement.value}")

    def _confirm_season_beats(self) -> bool:
        """第 5 屏：季度弧线确认。"""
        s = self.session
        b = s.beats
        rows = []
        for a in b.acts:
            rows.append([a.kind.value, f"{a.ep_from}-{a.ep_to}", a.goal])
        ui.table(["区段", "集数", "戏剧任务"], rows, title_="季度弧线")
        if b.reversal_episodes():
            ui.echo(f"重大反转落在：第 {'、'.join(str(e) for e in b.reversal_episodes())} 集")
        if s.canon.knowledge:
            ui.echo("知识状态表（谁在第几集知道什么）：")
            for k in s.canon.knowledge:
                ui.echo(f"  · {k.fact} → 第 {k.source_ep or '?'} 集揭示给 "
                        f"{'、'.join(k.revealed_to) or '（公开）'}")
        if self.noninteractive:
            ui.dim("（无人值守：自动接受季度弧线）")
            return True
        while True:
            ans = ui.ask("调整？", default="n", hint=" [y/N] 或输入如「中期反转提到第8集」 ")
            low = ans.strip().lower()
            # 默认/否定 -> 接受当前弧线（不是"调整要求"，别写进 canon）
            if low in ("n", "no", "否", ""):
                return True
            if low in ("q", "quit"):
                return False
            if low in ("y", "yes", "是"):
                ui.dim("请直接输入调整要求，如「中期反转提到第8集」。")
                continue
            # 自由调整（简化：记录要求，重规划留待 LLM 版；此处提示已记录）
            ui.warn(f"已记录调整要求：{ans}")
            ui.dim("（节拍重规划需重新调用 LLM；当前记录到 canon 备注，下集生成时生效）")
            s.canon.tone = (s.canon.tone + f"；节奏调整：{ans}").strip("；")
            self.save()
            return True

    # ================= 逐集循环 =================

    def _episode_loop(self, autoplay_to: Optional[int] = None) -> None:
        s = self.session
        while not s.is_complete():
            ep = s.next_ep()
            if autoplay_to is not None and ep > autoplay_to:
                ui.dim(f"已到 autoplay_to={autoplay_to}，停在第 {ep} 集前。")
                break
            self._do_episode(ep)
            self.save()

    def _do_episode(self, ep: int) -> None:
        s = self.session
        ui.title(f"═══ 第 {ep}/{s.total_episodes} 集 ═══")
        prog = ui.progress_bar(len(s.completed_eps), s.total_episodes)
        if prog:
            ui.dim(f"进度 {prog}")

        # 1. 走向选择（按介入粒度决定是否问）
        direction = self._choose_direction(ep)

        # 2. 集内节拍规划
        with ui.Progress(f"规划第 {ep} 集节拍") as p:
            eb = self.engine.plan_episode(s, ep, user_direction=direction)
        self._upsert_beat(eb)
        self.save()

        # 3. 分场景生成正文
        scene_mds = self._generate_scenes(ep, eb)
        episode_md = compose_episode_markdown(ep, eb.title, scene_mds)

        # 4. 批评 + canon 增量
        with ui.Progress(f"审校第 {ep} 集") as p:
            crit = self.engine.critique_episode(s, ep, episode_md)
        self.engine.apply_critique(s.canon, crit)
        self._report_critique(ep, crit)

        # 5. 审阅
        s.episodes_md[ep] = episode_md
        self.save()
        # autopilot 与 batch 模式不进审阅循环（否则会卡在等输入，违背全自动语义）；
        # 有 blocker 级连续性问题时也不阻塞，只记入 canon 备注供事后复盘。
        if s.involvement == InvolvementLevel.autopilot:
            blockers = [v for v in (crit.get("violations") or [])
                        if v.get("severity") == "blocker"]
            if blockers:
                ui.warn(f"第 {ep} 集有 {len(blockers)} 处 blocker（autopilot 已放行，"
                        f"建议交付前复查）")
            accepted = True
        else:
            accepted = self._review_episode(ep, eb, episode_md)
        if accepted:
            if ep not in s.completed_eps:
                s.completed_eps.append(ep)
                s.completed_eps.sort()
            s.current_ep = s.next_ep()
            self.save()

    def _choose_direction(self, ep: int) -> str:
        """分支菜单：按介入粒度决定问不问。返回用户方向文本（空=用模型默认）。"""
        s = self.session
        level = s.involvement
        # tier1 major：只在重大决策点问。用"本集是否含反转/是否 act 边界"判定。
        is_major = self._is_major_decision(ep)
        if level == InvolvementLevel.autopilot:
            return self._auto_pick(ep)
        if level == InvolvementLevel.major and not is_major:
            return self._auto_pick(ep)

        with ui.Progress(f"生成第 {ep} 集剧情走向") as p:
            options = self.engine.branch_options(s, ep)
        if not options:
            return ""
        self._render_branch_menu(ep, options)
        while True:
            ans = ui.ask("选择", hint=" [1-{}] · 或直接输入改动 · /skip /back /canon ".format(len(options)))
            m = _DIGIT_RE.match(ans.strip())
            if m and 1 <= int(m.group(1)) <= len(options):
                chosen = options[int(m.group(1)) - 1]
                self._record_choice(ep, chosen_key=chosen["key"],
                                    summary=chosen["direction"])
                return chosen["direction"]
            if ans.strip().startswith("/"):
                if self._handle_command(ans.strip(), ep) == "quit":
                    raise ui.Interrupted("用户退出")
                continue
            # 自由文本改写剧情
            self._record_choice(ep, freeform=ans.strip(), summary=ans.strip()[:40])
            return ans.strip()

    def _upsert_beat(self, eb: EpisodeBeat) -> None:
        """按集号安全更新/插入 EpisodeBeat。

        不能直接 episodes[ep-1]=eb：当 beats.episodes 长度不足 ep（如用户改大集数、
        或 plan_season 未预填全部集）时会 IndexError。按 ep 号查找替换，找不到则追加。
        """
        eps = self.session.beats.episodes
        for i, e in enumerate(eps):
            if e.ep == eb.ep:
                eps[i] = eb
                return
        eps.append(eb)
        eps.sort(key=lambda x: x.ep)

    def _is_major_decision(self, ep: int) -> bool:
        """重大决策点：含反转、或落在区段边界。"""
        s = self.session
        b = s.beats
        ebeat = b.episode(ep)
        if ebeat and ebeat.reversal:
            return True
        # act 边界
        for a in b.acts:
            if a.ep_from == ep:
                return True
        return False

    def _auto_pick(self, ep: int) -> str:
        """autopilot/major 模式下自动选走向（按 policy）。"""
        s = self.session
        try:
            options = self.engine.branch_options(s, ep)
        except Exception as e:  # noqa: BLE001
            log.warning("自动生成走向失败：%s", e)
            return ""
        if not options:
            return ""
        pick = self._apply_policy(options, s.auto_policy)
        self._record_choice(ep, chosen_key=pick["key"], summary=f"[auto:{s.auto_policy}] {pick['direction']}")
        ui.dim(f"  (自动选择走向 {pick['key']}：{pick['direction']})")
        return pick["direction"]

    @staticmethod
    def _apply_policy(options: list[dict], policy: str) -> dict:
        """按策略从走向中选一个。"""
        if policy == "safest":
            rank = {"低": 0, "中": 1, "高": 2}
            return min(options, key=lambda o: (rank.get(o.get("risk", "中"), 1),
                                               -o.get("stakes", 3)))
        if policy == "sweet":
            # 偏好甜宠基调
            return max(options, key=lambda o: ("甜" in (o.get("tone_shift", "") + o.get("direction", "")),
                                               o.get("stakes", 3)))
        # max-tension（默认）：stakes 最高，平手取风险较低
        return max(options, key=lambda o: (o.get("stakes", 3),
                                           {"低": 2, "中": 1, "高": 0}.get(o.get("risk", "中"), 1)))

    def _render_branch_menu(self, ep: int, options: list[dict]) -> None:
        rows = []
        for o in options:
            rows.append([o["key"], o["direction"], o.get("tone_shift", ""),
                         "、".join(o.get("affects", [])), f"{o.get('risk', '?')}"])
        ui.table(["#", "方向", "基调", "影响", "风险"], rows,
                 title_=f"第 {ep} 集 · 剧情走向")
        for o in options:
            if o.get("consequence"):
                ui.dim(f"  {o['key']}) → {o['consequence']}"
                       + (f"（{o['risk_note']}）" if o.get("risk_note") else ""))

    def _generate_scenes(self, ep: int, eb: EpisodeBeat) -> list[str]:
        """分场景生成正文（chunked —— 单次调用写不下一整集）。"""
        s = self.session
        mds = []
        total = len(eb.scenes)
        base_scene_no = sum(len((s.beats.episode(e) or EpisodeBeat(ep=e)).scenes)
                            for e in range(1, ep)) or 0
        for k, sb in enumerate(eb.scenes, 1):
            with ui.Progress(f"第{ep}集 场景 {k}/{total}") as p:
                draft = self.engine.write_scene(s, ep, sb, scene_no_global=base_scene_no + k)
            if not draft.craft_ok and draft.craft_issues:
                ui.dim(f"  场景 {k} 节奏提示：{'; '.join(draft.craft_issues[:2])}")
            mds.append(draft.markdown)
        return mds

    def _report_critique(self, ep: int, crit: dict) -> None:
        viols = crit.get("violations") or []
        blockers = [v for v in viols if v.get("severity") == "blocker"]
        if blockers:
            ui.warn(f"第 {ep} 集发现 {len(blockers)} 处需修正的连续性问题：")
            for v in blockers[:5]:
                ui.echo(f"  · [{v.get('kind')}] {v.get('detail')}")
                if v.get("suggested_fix"):
                    ui.dim(f"      建议：{v['suggested_fix']}")
        elif viols:
            ui.dim(f"第 {ep} 集有 {len(viols)} 处轻微提示（已自动放行）。")
        if crit.get("new_facts"):
            ui.dim(f"  已并入 canon：{len(crit['new_facts'])} 条新事实。")

    def _review_episode(self, ep: int, eb: EpisodeBeat, episode_md: str) -> bool:
        """审阅一集：摘要优先，可下钻、修改、重生成、接受。"""
        s = self.session
        bad_input = 0
        while True:
            self._render_episode_summary(ep, eb, episode_md)
            ans = ui.ask("审阅", hint=" [enter]展开 · a接受 · r修改 · g重生成 · /命令 ").strip().lower()
            if ans in ("a", "accept", "接受", ""):
                bad_input = 0
                if ans == "":
                    self._render_episode_detail(episode_md)
                    continue
                return True
            if ans in ("r", "revise", "修改"):
                bad_input = 0
                instr = ui.ask("要改成什么？")
                self.snapshot()
                # 按用户要求重新规划本集节拍并重生成场景。
                # （更精细的做法是只对受影响场景调 revise_scene 做 diff，
                #  见 engine.revise_scene；整集重生成更简单且对自由改写更稳。）
                with ui.Progress(f"重生成第 {ep} 集") as p:
                    eb2 = self.engine.plan_episode(s, ep, user_direction=instr)
                    new_mds = self._generate_scenes(ep, eb2)
                episode_md = compose_episode_markdown(ep, eb2.title, new_mds)
                s.episodes_md[ep] = episode_md
                self._upsert_beat(eb2)
                eb = eb2
                self.save()
                ui.success("已重生成。")
                continue
            if ans in ("g", "regen", "重生成"):
                bad_input = 0
                self.snapshot()
                with ui.Progress(f"重生成第 {ep} 集") as p:
                    new_mds = self._generate_scenes(ep, eb)
                episode_md = compose_episode_markdown(ep, eb.title, new_mds)
                s.episodes_md[ep] = episode_md
                self.save()
                ui.success("已重生成。")
                continue
            if ans.startswith("/"):
                bad_input = 0
                if self._handle_command(ans, ep) == "quit":
                    raise ui.Interrupted("用户退出")
                continue
            # 兜底：无法识别的输入必须给提示，否则静默死循环（用户以为卡住了）。
            # 连续多次无效则中止本集审阅并保留进度——终端异常（如管道输入、
            # EOF 循环）时不能永久占住进程。
            bad_input += 1
            if bad_input >= _MAX_BAD_INPUT:
                ui.error(f"连续 {bad_input} 次无法识别的输入，中止本集审阅。")
                self._abort_on_bad_input()
            ui.warn(f"未识别的输入 '{ans}'。可选：a 接受 · r 修改 · g 重生成 · "
                    f"[回车] 展开正文 · /help 命令。")

    def _render_episode_summary(self, ep: int, eb: EpisodeBeat, episode_md: str) -> None:
        rows = []
        for sc in eb.scenes:
            rows.append([f"场景{sc.scene_no}", sc.location, sc.time, sc.int_ext,
                         (sc.purpose or "")[:20], f"{sc.target_seconds:.0f}s"])
        ui.table(["", "地点", "时间", "内外", "作用", "时长"], rows,
                 title_=f"第 {ep} 集「{eb.title}」摘要")
        if eb.hook:
            ui.echo(f"  集尾钩子：{eb.hook}")

    def _render_episode_detail(self, episode_md: str) -> None:
        ui.panel(episode_md[:4000] + ("\n…" if len(episode_md) > 4000 else ""),
                 title_="正文")

    def _record_choice(self, ep: int, *, chosen_key: Optional[str] = None,
                       freeform: Optional[str] = None, summary: str = "") -> None:
        self.session.history.append(Choice(
            ep=ep, at=self.now(), chosen_key=chosen_key, freeform=freeform,
            summary=summary))

    # ================= 命令 =================

    def _handle_command(self, cmd: str, ep: int) -> str:
        """处理 /命令。返回 'quit' 表示要退出。"""
        s = self.session
        parts = cmd.strip().split()
        verb = parts[0].lower()
        args = parts[1:]

        if verb in ("/quit", "/exit", "/q"):
            self.save()
            ui.echo("进度已保存。用 scriptwriter.py resume " + s.name + " 继续。")
            return "quit"
        if verb == "/help":
            self._print_help()
        elif verb == "/status":
            self._print_status()
        elif verb == "/undo":
            self.undo()
        elif verb == "/back":
            n = int(args[0]) if args and args[0].isdigit() else 1
            self._back(n)
        elif verb == "/canon":
            self._print_canon(args[0] if args else None)
        elif verb == "/skip":
            ui.dim("（跳过本集走向选择，用模型默认）")
        elif verb == "/autopilot":
            on = (args and args[0].lower() in ("on", "1", "yes"))
            s.involvement = InvolvementLevel.autopilot if on else InvolvementLevel.every_episode
            self.save()
            ui.success(f"autopilot {'开' if on else '关'}")
        elif verb == "/involvement":
            if args and args[0] in ("1", "2", "3"):
                s.involvement = {"1": InvolvementLevel.major, "2": InvolvementLevel.every_episode,
                                 "3": InvolvementLevel.autopilot}[args[0]]
                self.save()
                ui.success(f"介入粒度 -> {s.involvement.value}")
            else:
                ui.warn("用法：/involvement 1|2|3")
        elif verb == "/review":
            self._render_episode_detail(s.episodes_md.get(ep, "（本集尚未生成）"))
        elif verb == "/export":
            self.export(args[0] if args else None)
        elif verb == "/render":
            self.render_gate()
        elif verb == "/branch":
            self._branch_cmd(args)
        else:
            ui.warn(f"未知命令 {verb}，输入 /help 看可用命令。")
        return ""

    def _print_help(self) -> None:
        ui.panel(
            "/status            当前进度\n"
            "/back [N]          回退 N 步（默认 1）\n"
            "/undo              撤销上一次修改\n"
            "/canon [角色名]     查看世界观/知识状态表\n"
            "/branch list|new N|goto ID   分支管理\n"
            "/autopilot on|off  全自动推进开关\n"
            "/involvement 1|2|3 介入粒度\n"
            "/review [ep]       查看某集正文\n"
            "/export [dir]      导出 screenplay.md（不出片）\n"
            "/render            交付确认门 + 启动视频渲染\n"
            "/quit              保存并退出",
            title_="可用命令")

    def _print_status(self) -> None:
        s = self.session
        done = len(s.completed_eps)
        ui.panel(
            f"剧名：{s.canon.title or '(未命名)'}\n"
            f"规格：{s.total_episodes} 集 × {s.episode_seconds / 60:.1f} 分钟\n"
            f"进度：{done}/{s.total_episodes} 集 {ui.progress_bar(done, s.total_episodes)}\n"
            f"介入粒度：{s.involvement.value}｜分支：{s.branch_id}\n"
            f"角色：{len(s.canon.characters)}｜既成事实：{len(s.canon.established_facts)}｜"
            f"已用桥段：{len(s.canon.used_beats)}\n"
            f"当前集：{s.current_ep}",
            title_="会话状态")

    def _print_canon(self, subject: Optional[str]) -> None:
        s = self.session
        c = s.canon
        if subject:
            ch = c.character(subject)
            if not ch:
                ui.warn(f"未找到角色 {subject}")
                return
            ui.panel(
                f"{ch.name}（{ch.role}，{ch.gender or '?'}{ch.age or '?'}岁）\n"
                f"外形：{ch.appearance_zh}\n性格：{ch.personality}\n动机：{ch.motivation}\n"
                f"音色：{ch.voice_tag or '(未定)'}",
                title_="角色档案")
            return
        body = f"题材：{c.genre}｜基调：{c.tone}\n核心冲突：{c.core_conflict}\n\n角色：\n"
        for ch in c.characters:
            body += f"  · {ch.name}（{ch.role}）：{ch.appearance_zh[:30]}\n"
        if c.knowledge:
            body += "\n知识状态表：\n"
            for k in c.knowledge:
                body += (f"  · {k.fact}｜当事人 {k.holder}｜揭示第 {k.source_ep or '?'} 集"
                         f"｜瞒着 {'、'.join(k.hidden_from) or '无'}\n")
        ui.panel(body, title_="世界观 canon")

    def _back(self, n: int) -> None:
        """回退 n 步：撤销最近 n 次已完成的集。"""
        s = self.session
        for _ in range(n):
            if not s.completed_eps:
                ui.warn("已到开头，无法再回退。")
                break
            last = s.completed_eps.pop()
            s.episodes_md.pop(last, None)
            ep_path = self.store.episode_path(s.name, last)
            if ep_path.exists():
                ep_path.unlink()
        s.current_ep = s.next_ep()
        self.save()
        ui.success(f"已回退，当前进度 {len(s.completed_eps)}/{s.total_episodes} 集。")

    def _branch_cmd(self, args: list[str]) -> None:
        s = self.session
        if not args or args[0] == "list":
            for b in self.store.list_branches(s.name):
                mark = "←当前" if b["name"] == s.name else ""
                ui.echo(f"  {b['branch']:12} {b['episodes']:8} fork={b['fork']} {mark}")
            return
        if args[0] == "new":
            fork_ep = int(args[1]) if len(args) > 1 and args[1].isdigit() else s.current_ep
            if not ui.confirm(f"从第 {fork_ep} 集分叉出新分支？（主线进度保留）", default=False):
                return
            new_name = self.store.create_branch(s, fork_ep=fork_ep, now=self.now())
            ui.success(f"已创建分支 {new_name}。用 scriptwriter.py resume {new_name} 进入。")
            return
        ui.warn("用法：/branch list | new [ep] | goto <name>")

    # ================= 交付 =================

    def export(self, out_dir: Optional[str] = None) -> Path:
        """导出 screenplay.md（不启动渲染）。"""
        from ..validate import validate
        s = self.session
        md = self.engine.deliver_markdown(s)
        rep = validate(md, "screenplay")
        if not rep.ok:
            ui.error(f"导出的剧本未通过校验（{len(rep.errors)} error）：")
            for i in rep.errors[:10]:
                ui.echo(f"  L{i.line} [{i.code}] {i.msg}")
            ui.warn("已写出但请勿直接渲染，先修正。")
        p = self.store.deliver(s, [], md, now=self.now())
        ui.success(f"已导出剧本 -> {p}")
        if rep.ok:
            ui.dim(f"校验通过（{len(rep.warnings)} warning）。可用 run.py 渲染。")
        return p

    def render_gate(self) -> bool:
        """交付确认门：显示规模与渲染成本，确认后导出并启动 run.py。"""
        from ..parser import parse_screenplay
        from ..validate import validate
        s = self.session
        if not s.is_complete():
            ui.warn(f"还有 {s.total_episodes - len(s.completed_eps)} 集未完成，"
                    f"无法交付。当前 {len(s.completed_eps)}/{s.total_episodes}。")
            return False
        md = self.engine.deliver_markdown(s)
        rep = validate(md, "screenplay")
        raw = parse_screenplay(md)
        shots = raw["_stats"]["shots"]
        est = estimate_render(shots)
        ui.panel(
            f"剧本      {s.total_episodes} 集 · {shots} 镜头 · "
            f"预计总时长 {raw['_stats']['episodes'] * s.episode_seconds / 60:.0f} 分钟\n"
            f"校验      {'✓ exit 0' if rep.ok else f'✗ {len(rep.errors)} error'}"
            f"（{len(rep.warnings)} warning）\n"
            f"渲染预估  质量档 ~{estimate_render(shots)['render_days']} 天 · "
            f"吞吐档 ~{estimate_render(shots, 'throughput')['render_days']} 天\n"
            f"磁盘      ~{est['disk_gb']}GB\n"
            f"音色      {sum(1 for c in s.canon.characters if c.voice_tag)} 角色已标音色",
            title_="交付确认")
        if not rep.ok:
            ui.error("校验未通过，不能启动渲染。请先修正（/export 查看 error）。")
            return False
        if not ui.confirm("启动视频渲染？（将占用 GPU 数天）", default=False):
            ui.dim("已取消。剧本可用 /export 导出后手动渲染。")
            return False
        p = self.store.deliver(s, [], md, now=self.now())
        ui.success(f"剧本已交付 -> {p}")
        ui.echo("\n启动渲染命令（在服务器上运行）：")
        ui.echo(f"  python run.py {p} --project {s.name}")
        return True


# ================= 工厂 =================


def make_session_state(name: str, *, base: str = "sessions",
                       llm=None, plain: bool = False,
                       now: Optional[Callable[[], str]] = None) -> SessionState:
    """构造一个 SessionState（新建会话）。"""
    store = SessionStore(base)
    engine = ScreenwriterEngine(llm) if llm is not None else None
    if engine is None:
        raise ValueError("需要 llm 引擎")
    if now is None:
        from datetime import datetime
        now = lambda: datetime.now().isoformat(timespec="seconds")  # noqa: E731
    sess = store.create(name, now=now())
    return SessionState(store=store, engine=engine, session=sess, now=now)


def resume_session_state(name: str, *, base: str = "sessions", llm=None,
                         now: Optional[Callable[[], str]] = None) -> SessionState:
    """恢复一个已有会话。"""
    store = SessionStore(base)
    if llm is None:
        raise ValueError("需要 llm 引擎")
    if now is None:
        from datetime import datetime
        now = lambda: datetime.now().isoformat(timespec="seconds")  # noqa: E731
    sess = store.load(name)
    return SessionState(store=store, engine=ScreenwriterEngine(llm), session=sess, now=now)
