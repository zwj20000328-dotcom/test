"""创作引擎 —— LLM 调用编排（纯逻辑，无 I/O，可 mock 测试）。

分层原则：本模块**不含任何 input()/print()**。所有用户交互在 cli.py，
所有模型调用在这里。因此可以用 mock LLM 完整测试创作逻辑。

LLM 调用清单（每个都有明确的 JSON schema 或 prose 约定）：
  plan_settings    故事简介 -> 世界观设定卡 + 角色表          (JSON, temp 0.6)
  plan_spec        设定卡 -> 建议集数/每集时长 + 理由          (JSON, temp 0.4)
  plan_season      -> 季度弧线 + 知识状态表                   (JSON, temp 0.7)
  plan_episode     一集 -> 集内节拍 + 场景切分                 (JSON, temp 0.7)
  branch_options   一集 -> 3-5 个剧情走向供选择                (JSON, temp 0.9)
  write_scene      一个场景 -> Markdown 正文                   (PROSE, temp 0.85)
  critique         一集正文 -> 结构化矛盾报告                  (JSON, temp 0.2)
  revise_scene     场景正文 + 用户修改要求 -> 新正文            (PROSE, temp 0.7)
  repair_scene     场景正文 + validator 报错 -> 修正正文        (PROSE, temp 0.3)

关键设计：**正文走 prose（.chat）而非 JSON 字符串字段**。
理由：一集 48-60 镜 ≈ 6000-9000 输出 token，塞进 guided_json 的字符串字段会因
换行/引号转义出错且超长被截断；而按场景分块的 prose 调用每块仅数百 token，
既避开转义问题，也让自愈循环能只重生成出错的那一个场景。
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from ..parser import parse_screenplay
from ..validate import validate
from . import craft
from .emitter import EmitEpisode, EmitScene, EmitShot, emit_screenplay
from .models import (
    ActKind, BeatSheet, Canon, CanonCharacter, EpisodeBeat, KnowledgeEntry,
    Relationship, SceneBeat, SeasonAct, Session,
)

log = logging.getLogger("screenwriter.engine")

# --------------------------------------------------------------------------- #
# JSON schema（guided_json 强制结构化输出）
# --------------------------------------------------------------------------- #

_SETTINGS_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "title": {"type": "string"},
        "logline": {"type": "string"},
        "genre": {"type": "string"},
        "tone": {"type": "string"},
        "era": {"type": "string"},
        "style": {"type": "string", "description": "画风描述，写进 front-matter"},
        "core_conflict": {"type": "string"},
        "payoff_types": {"type": "array", "items": {"type": "string"},
                         "description": "爽点类型：打脸/逆袭/身份反差/甜宠…"},
        "characters": {
            "type": "array",
            "items": {
                "type": "object", "additionalProperties": False,
                "properties": {
                    "name": {"type": "string"},
                    "gender": {"type": "string", "enum": ["男", "女", "其他"]},
                    "age": {"type": "integer", "minimum": 1, "maximum": 120},
                    "role": {"type": "string", "description": "主角/反派/配角"},
                    "appearance_zh": {"type": "string",
                                      "description": "中文外形：发型/脸型/眼型/体态/标志服装配饰，越具体越好"},
                    "personality": {"type": "string"},
                    "motivation": {"type": "string"},
                    "voice_tag": {"type": "string", "description": "音色描述：性别/年龄/音质/性格"},
                },
                "required": ["name", "appearance_zh", "motivation"],
            },
        },
        "key_facts": {
            "type": "array", "description": "需要隐瞒/揭示的关键秘密",
            "items": {
                "type": "object", "additionalProperties": False,
                "properties": {
                    "fact": {"type": "string"},
                    "holder": {"type": "string", "description": "事实的当事人"},
                    "hidden_from": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["fact", "holder"],
            },
        },
    },
    "required": ["title", "logline", "genre", "core_conflict", "characters"],
}

_SPEC_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "total_episodes": {"type": "integer", "minimum": 20, "maximum": 50},
        "episode_seconds": {"type": "integer", "minimum": 240, "maximum": 300},
        "reasoning": {"type": "string", "description": "为什么建议这个集数/时长"},
        "estimated_shots": {"type": "integer"},
        "estimated_render_hours": {"type": "number"},
        "estimated_disk_gb": {"type": "number"},
    },
    "required": ["total_episodes", "episode_seconds", "reasoning"],
}

_SEASON_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "acts": {
            "type": "array",
            "items": {
                "type": "object", "additionalProperties": False,
                "properties": {
                    "kind": {"type": "string", "enum": ["开篇钩子", "冲突升级", "中期反转", "高潮", "收尾"]},
                    "ep_from": {"type": "integer"}, "ep_to": {"type": "integer"},
                    "goal": {"type": "string"},
                    "key_turns": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["kind", "ep_from", "ep_to", "goal"],
            },
        },
        "reversal_episodes": {"type": "array", "items": {"type": "integer"},
                              "description": "重大反转落在第几集"},
        "knowledge_plan": {
            "type": "array", "description": "谁在第几集知道什么（知识状态表）",
            "items": {
                "type": "object", "additionalProperties": False,
                "properties": {
                    "fact": {"type": "string"},
                    "holder": {"type": "string"},
                    "revealed_to": {"type": "string"},
                    "source_ep": {"type": "integer"},
                    "hidden_from": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["fact", "source_ep"],
            },
        },
    },
    "required": ["acts", "reversal_episodes"],
}

_EPISODE_BEAT_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "title": {"type": "string"},
        "setup": {"type": "string", "description": "承接上集的处境"},
        "escalation": {"type": "string", "description": "集内递进"},
        "payoff": {"type": "string", "description": "本集爽点/小高潮"},
        "hook": {"type": "string", "description": "★集尾钩子，必须有"},
        "scenes": {
            "type": "array", "minItems": 3, "maxItems": 12,
            "items": {
                "type": "object", "additionalProperties": False,
                "properties": {
                    "location": {"type": "string"},
                    "time": {"type": "string", "description": "白天/夜/晨/傍晚…"},
                    "int_ext": {"type": "string", "enum": ["内", "外"]},
                    "purpose": {"type": "string"},
                    "mood": {"type": "string"},
                    "characters": {"type": "array", "items": {"type": "string"}},
                    "target_seconds": {"type": "number", "minimum": 10, "maximum": 180},
                    "ends_on": {"type": "string"},
                },
                "required": ["location", "time", "int_ext", "purpose", "characters",
                             "target_seconds"],
            },
        },
    },
    "required": ["title", "hook", "scenes"],
}

_BRANCH_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "options": {
            "type": "array", "minItems": 3, "maxItems": 5,
            "items": {
                "type": "object", "additionalProperties": False,
                "properties": {
                    "direction": {"type": "string", "description": "一句话方向摘要"},
                    "tone_shift": {"type": "string"},
                    "affects": {"type": "array", "items": {"type": "string"}},
                    "consequence": {"type": "string", "description": "会导致什么/往下走向哪"},
                    "risk": {"type": "string", "enum": ["低", "中", "高"]},
                    "risk_note": {"type": "string"},
                    "stakes": {"type": "integer", "minimum": 1, "maximum": 5},
                },
                "required": ["direction", "consequence", "stakes"],
            },
        },
    },
    "required": ["options"],
}

_CRITIC_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "violations": {
            "type": "array",
            "items": {
                "type": "object", "additionalProperties": False,
                "properties": {
                    "kind": {"type": "string",
                             "enum": ["knowledge", "continuity", "character", "tone",
                                      "repetition", "logic"]},
                    "detail": {"type": "string"},
                    "scene_no": {"type": "integer"},
                    "severity": {"type": "string", "enum": ["blocker", "minor"]},
                    "suggested_fix": {"type": "string"},
                },
                "required": ["kind", "detail", "severity"],
            },
        },
        "new_facts": {"type": "array", "items": {"type": "string"},
                      "description": "本集新确立的事实，应并入 canon"},
        "beats_used": {"type": "array", "items": {"type": "string"},
                       "description": "本集用到的桥段（进负向清单防重复）"},
    },
    "required": ["violations"],
}

# --------------------------------------------------------------------------- #
# 渲染耗时/磁盘估算（供 spec 与交付确认门使用）
# --------------------------------------------------------------------------- #

# 渲染耗时/磁盘估算（供 spec 与交付确认门使用）
#
# 质量档：Wan2.2-I2V-A14B bf16，2 卡一 job，一镜(5s) 约 4-8 分钟（取 6 分钟），
#         GPU3-6 共 2 路并行 → 有效 6min/2 = 3min = 180s/镜。
#         1620 镜 × 180s ≈ 81 小时（与 docs/ARCHITECTURE.md §6 一致）。
# 吞吐档：GGUF Q6 **单卡** 一 job，GPU1-7 共 7 路并行。单卡跑双专家需 offload，
#         单镜比双卡慢，取约 10 分钟/镜 → 10min/7 ≈ 85.7s/镜。
#         1620 镜 × 85.7s ≈ 39 小时（与 §6 一致）。
#         注意：不能把双卡的 4-8 分钟直接除以 7——那是双卡速度，会低估 2.5 倍。
_RENDER_SEC_PER_SHOT_QUALITY = 6 * 60 / 2        # 180 s/镜
_RENDER_SEC_PER_SHOT_THROUGHPUT = 10 * 60 / 7    # ≈85.7 s/镜
_DISK_MB_PER_SHOT = 137                          # ProRes 母带 1080x1920@30fps


def estimate_render(shots: int, mode: str = "quality") -> dict[str, float]:
    """由镜头数估算渲染耗时与磁盘占用。"""
    per = (_RENDER_SEC_PER_SHOT_QUALITY if mode == "quality"
           else _RENDER_SEC_PER_SHOT_THROUGHPUT)
    hours = shots * per / 3600.0
    return {
        "shots": shots,
        "render_hours": round(hours, 1),
        "render_days": round(hours / 24.0, 2),
        "disk_gb": round(shots * _DISK_MB_PER_SHOT / 1024.0, 1),
    }


# --------------------------------------------------------------------------- #
# 引擎
# --------------------------------------------------------------------------- #


@dataclass
class EngineConfig:
    """采样参数与重试策略（按调用类型区分）。"""
    temp_extract: float = 0.2      # 抽取/校验
    temp_plan: float = 0.6         # 规划
    temp_creative: float = 0.85    # 正文创作
    temp_branch: float = 0.9       # 走向发散
    max_tokens_scene: int = 2400   # 单场景正文（远小于一集，避免截断）
    max_tokens_plan: int = 4000
    repair_attempts: int = 2       # validator 自愈循环次数
    critique_every_episode: bool = True
    target_shot_seconds: float = 5.0   # 用于估算镜头数


@dataclass
class SceneDraft:
    """一个场景的草稿（prose + 解析后的结构）。"""
    scene_no: int
    markdown: str
    scenes_parsed: list[dict] = field(default_factory=list)
    craft_ok: bool = True
    craft_issues: list[str] = field(default_factory=list)


class ScreenwriterEngine:
    """创作引擎。llm 需实现 .json(messages, schema, temperature=...) 与
    .chat(messages, temperature=..., max_tokens=...)（见 pipeline/engines/llm.py）。
    """

    def __init__(self, llm, config: EngineConfig | None = None):
        self.llm = llm
        self.cfg = config or EngineConfig()

    # ---- 系统提示 ----
    _SYS_PLANNER = (
        "你是资深短剧编剧与策划，精通抖音/快手竖屏短剧的商业叙事节奏。"
        "你只输出符合 schema 的 JSON，不输出任何解释文字。"
    )
    _SYS_WRITER = (
        "你是资深短剧编剧。你按给定节拍写出可直接拍摄的中文剧本正文。\n"
        "文风要求：对白短促有力、有金句、有潜台词；节奏快、冲突密集、情绪外放；"
        "每场戏都要推进情节或揭示人物。\n"
        "严格遵守输出格式约定，不要输出任何解释或额外说明。"
    )
    _SYS_CRITIC = (
        "你是严格的剧本连续性审校。你的任务是找出与世界观设定(canon)矛盾之处，"
        "尤其是：角色提前知道了不该知道的信息、与既成事实冲突、人设崩坏、"
        "重复使用过的桥段、逻辑漏洞。只输出 JSON。"
    )

    # ================================================================== #
    # 规划层
    # ================================================================== #

    def plan_settings(self, synopsis: str) -> Canon:
        """故事简介 -> 世界观设定卡 + 角色表。"""
        msg = [
            {"role": "system", "content": self._SYS_PLANNER},
            {"role": "user", "content": (
                f"故事简介：\n{synopsis}\n\n"
                "请产出世界观设定卡：题材、基调、时代背景、画风、核心冲突、爽点类型；\n"
                "并反推角色表（每个角色给出具体外形描述：发型/脸型/眼型/体态/标志服装配饰——"
                "这将用于生成定妆图，必须足够具体以保证跨集长相一致）、性格、核心动机、音色标签；\n"
                "并列出需要隐瞒与揭示的关键秘密（谁持有、瞒着谁）。"
            )},
        ]
        d = self.llm.json(msg, _SETTINGS_SCHEMA, temperature=self.cfg.temp_plan)

        canon = Canon(
            title=d.get("title", ""), logline=d.get("logline", ""),
            genre=d.get("genre", ""), tone=d.get("tone", ""),
            era=d.get("era", ""), style=d.get("style", ""),
            core_conflict=d.get("core_conflict", ""),
            payoff_types=d.get("payoff_types") or [],
        )
        for i, c in enumerate(d.get("characters") or []):
            canon.characters.append(CanonCharacter(
                id=_slug(c["name"], i + 1), name=c["name"],
                gender=c.get("gender"), age=c.get("age"),
                role=c.get("role", "配角"),
                appearance_zh=c.get("appearance_zh", ""),
                personality=c.get("personality", ""),
                motivation=c.get("motivation", ""),
                voice_tag=c.get("voice_tag"),
                is_lead=(c.get("role") == "主角"),
                seed_base=1_000_000 + i * 7919,
            ))
        for i, f in enumerate(d.get("key_facts") or []):
            canon.knowledge.append(KnowledgeEntry(
                fact_id=f"f{i + 1:02d}", fact=f["fact"], holder=f.get("holder", ""),
                knows_from_ep=1, hidden_from=f.get("hidden_from") or [],
                source_ep=None,   # 由 plan_season 安排揭示集
            ))
        return canon

    def plan_spec(self, canon: Canon, synopsis: str,
                  user_episodes: Optional[int] = None,
                  user_seconds: Optional[float] = None) -> dict:
        """建议集数与每集时长（决策 #2：用户指定、模型建议）。

        用户已给定时直接采用，模型只补理由与成本估算。
        """
        msg = [
            {"role": "system", "content": self._SYS_PLANNER},
            {"role": "user", "content": (
                f"故事简介：{synopsis}\n"
                f"剧名：{canon.title}｜题材：{canon.genre}｜核心冲突：{canon.core_conflict}\n"
                f"角色数：{len(canon.characters)}｜关键秘密：{len(canon.knowledge)}\n"
                f"用户指定：集数={user_episodes or '未指定'}，每集秒数={user_seconds or '未指定'}\n\n"
                "按故事体量建议 total_episodes(20-50) 与 episode_seconds(240-300)，并说明理由。\n"
                "注意：每集是 4-5 分钟的完整剧集，含 5-10 个场景、48-60 个镜头。"
            )},
        ]
        d = self.llm.json(msg, _SPEC_SCHEMA, temperature=self.cfg.temp_extract)
        eps = int(user_episodes or d.get("total_episodes") or 30)
        secs = float(user_seconds or d.get("episode_seconds") or 270)
        shots = int(eps * secs / self.cfg.target_shot_seconds)
        est = estimate_render(shots)
        return {
            "total_episodes": eps, "episode_seconds": secs,
            "reasoning": d.get("reasoning", ""),
            "estimated_shots": shots,
            "estimated_render_hours": est["render_hours"],
            "estimated_render_days": est["render_days"],
            "estimated_disk_gb": est["disk_gb"],
        }

    def plan_season(self, canon: Canon, total_episodes: int,
                    episode_seconds: float) -> BeatSheet:
        """季度弧线 + 知识状态揭示计划。"""
        msg = [
            {"role": "system", "content": self._SYS_PLANNER},
            {"role": "user", "content": (
                f"剧名：{canon.title}｜题材：{canon.genre}｜基调：{canon.tone}\n"
                f"核心冲突：{canon.core_conflict}｜爽点类型：{'、'.join(canon.payoff_types)}\n"
                f"角色：\n{_canon_brief(canon)}\n"
                f"待安排揭示的秘密：\n{_knowledge_brief(canon)}\n"
                f"总集数：{total_episodes}，每集 {episode_seconds:.0f} 秒（4-5 分钟）。\n\n"
                "请规划季度弧线：把全剧分成 开篇钩子/冲突升级/中期反转/高潮/收尾 若干区段，"
                "每段给出集数范围、戏剧任务、关键转折。\n"
                "并安排重大反转落在第几集（建议 30-60% 处至少一个），\n"
                "以及每个秘密在第几集向谁揭示（source_ep / revealed_to / hidden_from）。"
            )},
        ]
        d = self.llm.json(msg, _SEASON_SCHEMA, temperature=self.cfg.temp_plan,
                          max_tokens=self.cfg.max_tokens_plan)

        beats = BeatSheet(total_episodes=total_episodes, episode_seconds=episode_seconds)
        for a in d.get("acts") or []:
            try:
                kind = ActKind(a["kind"])
            except ValueError:
                kind = ActKind.escalation
            beats.acts.append(SeasonAct(
                kind=kind, ep_from=a["ep_from"], ep_to=a["ep_to"],
                goal=a["goal"], key_turns=a.get("key_turns") or []))

        reversals = set(d.get("reversal_episodes") or [])
        # 把揭示计划写回 canon
        for kp in d.get("knowledge_plan") or []:
            fact = kp["fact"]
            entry = next((k for k in canon.knowledge if k.fact == fact), None)
            if entry is None:
                entry = KnowledgeEntry(fact_id=f"f{len(canon.knowledge) + 1:02d}",
                                       fact=fact, holder=kp.get("holder", ""),
                                       knows_from_ep=1)
                canon.knowledge.append(entry)
            entry.source_ep = kp["source_ep"]
            rt = kp.get("revealed_to")
            if rt:
                # revealed_to 是 {角色: 起始集}；此处按"从揭示集起知道"记录
                entry.revealed_to[rt] = kp["source_ep"]
            for h in kp.get("hidden_from") or []:
                if h not in entry.hidden_from:
                    entry.hidden_from.append(h)

        # 为每集建占位 EpisodeBeat（后续 plan_episode 填充场景）
        for ep in range(1, total_episodes + 1):
            act = beats.act_of(ep)
            beats.episodes.append(EpisodeBeat(
                ep=ep, arc_role=(act.goal if act else ""),
                target_seconds=episode_seconds, reversal=(ep in reversals)))
        return beats

    def plan_episode(self, session: Session, ep: int,
                     user_direction: str = "") -> EpisodeBeat:
        """一集的集内节拍 + 场景切分。

        user_direction: 用户在分支菜单输入的自由文本改写（如"让林晚泼回去，被林父打断"），
        作为最高优先级约束注入，模型据此调整本集走向。
        """
        canon, beats = session.canon, session.beats
        eb = beats.episode(ep) or EpisodeBeat(ep=ep, target_seconds=session.episode_seconds)
        act = beats.act_of(ep)
        prev = _recap(session, ep, n=2)

        direction_block = ""
        if user_direction.strip():
            direction_block = (
                f"【编剧指定方向（最高优先级，必须遵循）】\n{user_direction.strip()}\n\n")

        msg = [
            {"role": "system", "content": self._SYS_PLANNER},
            {"role": "user", "content": (
                f"【全剧】{canon.title}｜{canon.genre}｜基调：{canon.tone}\n"
                f"【核心冲突】{canon.core_conflict}\n"
                f"【本集位置】第 {ep}/{beats.total_episodes} 集"
                + (f"，属「{act.kind.value}」区段，任务：{act.goal}" if act else "")
                + ("（本集含重大反转）" if eb.reversal else "") + "\n"
                + direction_block
                + f"【前情提要】\n{prev}\n"
                f"【角色】\n{_canon_brief(canon)}\n"
                f"【本集角色知识边界】\n{_knowledge_constraints(canon, ep)}\n"
                f"【既成事实（不可违背）】\n{_facts_brief(canon)}\n"
                f"【禁用桥段（已用过）】\n{_used_beats_brief(canon)}\n"
                f"【本集目标时长】{session.episode_seconds:.0f} 秒（4-5 分钟）\n\n"
                "请设计本集：集标题、承接上集的处境(setup)、集内递进(escalation)、"
                "本集爽点(payoff)、★集尾钩子(hook，必须有)；\n"
                f"并把本集切成 4-10 个场景，每场给出 地点/时间/内外/戏剧目的/氛围/出场角色/"
                f"目标秒数(各场合计≈{session.episode_seconds:.0f})/结尾动作。"
            )},
        ]
        d = self.llm.json(msg, _EPISODE_BEAT_SCHEMA, temperature=self.cfg.temp_plan,
                          max_tokens=self.cfg.max_tokens_plan)

        eb.title = d.get("title", "")
        eb.setup = d.get("setup", "")
        eb.escalation = d.get("escalation", "")
        eb.payoff = d.get("payoff", "")
        eb.hook = d.get("hook", "") or eb.hook
        eb.target_seconds = session.episode_seconds
        eb.scenes = []
        for i, s in enumerate(d.get("scenes") or [], 1):
            eb.scenes.append(SceneBeat(
                scene_no=i, location=s.get("location", ""), time=s.get("time", ""),
                int_ext=s.get("int_ext", "内"), purpose=s.get("purpose", ""),
                mood=s.get("mood", ""), characters=s.get("characters") or [],
                target_seconds=float(s.get("target_seconds") or 40.0),
                ends_on=s.get("ends_on", ""),
            ))
        return eb

    def branch_options(self, session: Session, ep: int,
                       n: int = 3) -> list[dict]:
        """给出 3-5 个剧情走向供用户选择。"""
        canon, beats = session.canon, session.beats
        eb = beats.episode(ep) or EpisodeBeat(ep=ep)
        act = beats.act_of(ep)
        msg = [
            {"role": "system", "content": self._SYS_PLANNER},
            {"role": "user", "content": (
                f"【全剧】{canon.title}｜{canon.genre}｜核心冲突：{canon.core_conflict}\n"
                f"【当前】第 {ep}/{beats.total_episodes} 集"
                + (f"，「{act.kind.value}」区段，任务：{act.goal}" if act else "") + "\n"
                f"【前情提要】\n{_recap(session, ep, n=2)}\n"
                f"【本集已有构想】setup={eb.setup}；escalation={eb.escalation}；hook={eb.hook}\n"
                f"【角色】\n{_canon_brief(canon)}\n"
                f"【禁用桥段】\n{_used_beats_brief(canon)}\n\n"
                f"请给出 {n}-5 个**差异明显**的剧情走向供编剧选择。每个走向给："
                "direction(一句话)、tone_shift(基调变化)、affects(影响哪些角色)、"
                "consequence(会导致什么、把故事带向哪)、risk(低/中/高)+risk_note、"
                "stakes(1-5，5=重大转折如身份揭穿/关系逆转/生死危机)。\n"
                "走向之间必须真正互斥，不要换汤不换药。"
            )},
        ]
        d = self.llm.json(msg, _BRANCH_SCHEMA, temperature=self.cfg.temp_branch,
                          max_tokens=self.cfg.max_tokens_plan)
        opts = []
        for i, o in enumerate(d.get("options") or [], 1):
            opts.append({
                "key": str(i),
                "direction": o.get("direction", ""),
                "tone_shift": o.get("tone_shift", ""),
                "affects": o.get("affects") or [],
                "consequence": o.get("consequence", ""),
                "risk": o.get("risk", "低"),
                "risk_note": o.get("risk_note", ""),
                "stakes": int(o.get("stakes") or 3),
            })
        return opts[:5]

    # ================================================================== #
    # 创作层（prose，按场景分块 —— 单次调用写不下一整集）
    # ================================================================== #

    def write_scene(self, session: Session, ep: int, sb: SceneBeat,
                    scene_no_global: int) -> SceneDraft:
        """写一个场景的 Markdown 正文，并跑 validator + craft 自愈。

        返回 SceneDraft（含 markdown 与解析后的结构）。分块生成是新规模下的硬约束：
        一集 48-60 镜 ≈ 6000-9000 token，单次调用必被 max_tokens 截断。
        """
        canon, beats = session.canon, session.beats
        eb = beats.episode(ep) or EpisodeBeat(ep=ep)
        prompt = self._scene_prompt(session, ep, eb, sb, scene_no_global)

        md = self.llm.chat(
            [{"role": "system", "content": self._SYS_WRITER},
             {"role": "user", "content": prompt}],
            temperature=self.cfg.temp_creative,
            max_tokens=self.cfg.max_tokens_scene,
        )
        md = _strip_fences(md)

        # 自愈循环：validator 报错 -> 回灌行号错误让模型修
        for attempt in range(self.cfg.repair_attempts + 1):
            rep = validate(_wrap_scene_for_validate(md), "scene")
            if rep.ok:
                break
            errs = "\n".join(f"L{i.line} [{i.code}] {i.msg}" + (f" -> 修复：{i.fix}" if i.fix else "")
                             for i in rep.errors)
            log.info("场景 %d 校验未过（第 %d 次），回灌修复", scene_no_global, attempt + 1)
            md = _strip_fences(self.llm.chat(
                [{"role": "system", "content": self._SYS_WRITER},
                 {"role": "user", "content": prompt},
                 {"role": "assistant", "content": md},
                 {"role": "user", "content": (
                     f"你上面输出的剧本有格式错误，无法被解析器接受：\n{errs}\n\n"
                     "请只输出修正后的完整场景 Markdown，不要解释。严格遵守格式约定。")}],
                temperature=self.cfg.temp_extract,
                max_tokens=self.cfg.max_tokens_scene,
            ))

        draft = SceneDraft(scene_no=sb.scene_no, markdown=md)
        parsed = parse_screenplay(_wrap_scene_for_validate(md))
        draft.scenes_parsed = (parsed.get("loose_scenes")
                               or [sc for e in parsed.get("episodes", []) for sc in e["scenes"]])
        # craft 校验（时长/镜头数/对白长度）
        if draft.scenes_parsed:
            cr = craft.check_episode_content(ep, draft.scenes_parsed,
                                             min_sec=sb.target_seconds * 0.6,
                                             max_sec=sb.target_seconds * 1.8)
            draft.craft_ok = cr.ok
            draft.craft_issues = [f"{i.code}: {i.msg}" for i in cr.issues]
        return draft

    def _scene_prompt(self, session: Session, ep: int, eb: EpisodeBeat,
                      sb: SceneBeat, scene_no_global: int) -> str:
        canon = session.canon
        chars = [c for c in canon.characters if c.name in (sb.characters or [])] or canon.characters
        return (
            f"【全剧】{canon.title}｜{canon.genre}｜基调：{canon.tone}｜画风：{canon.style}\n"
            f"【核心冲突】{canon.core_conflict}\n"
            f"【位置】第 {ep}/{session.beats.total_episodes} 集"
            f"「{eb.title}」的第 {sb.scene_no} 场（全剧第 {scene_no_global} 场）\n"
            f"【本集弧线】setup：{eb.setup}\n递进：{eb.escalation}\n"
            f"爽点：{eb.payoff}\n★集尾钩子：{eb.hook}\n"
            f"【前情提要】\n{_recap(session, ep, n=2)}\n"
            f"【本场任务】{sb.purpose}\n"
            f"【本场氛围】{sb.mood}\n"
            f"【本场角色】\n{_chars_brief(chars)}\n"
            f"【这些角色此刻知道什么】\n{_known_for_scene(canon, sb.characters or [], ep)}\n"
            f"【这些角色此刻**不知道**什么（绝不能让他们基于此行动或表态）】\n"
            f"{_hidden_for_scene(canon, sb.characters or [], ep)}\n"
            f"【既成事实（不可违背）】\n{_facts_brief(canon)}\n"
            f"【禁用桥段】\n{_used_beats_brief(canon)}\n"
            f"【本场目标时长】{sb.target_seconds:.0f} 秒"
            f"（按 3-8 秒/镜，约 {max(3, int(sb.target_seconds / 5))} 个镜头）\n"
            f"【本场结尾】{sb.ends_on}\n"
            + (f"【本场核心台词】{sb.key_line}\n" if sb.key_line else "")
            + "\n" + _FORMAT_CONTRACT
        )

    def revise_scene(self, session: Session, ep: int, sb: SceneBeat,
                     scene_no_global: int, current_md: str,
                     instruction: str) -> SceneDraft:
        """按用户要求改写一个场景。"""
        eb = session.beats.episode(ep) or EpisodeBeat(ep=ep)
        base = self._scene_prompt(session, ep, eb, sb, scene_no_global)
        md = _strip_fences(self.llm.chat(
            [{"role": "system", "content": self._SYS_WRITER},
             {"role": "user", "content": base},
             {"role": "assistant", "content": current_md},
             {"role": "user", "content": (
                 f"编剧要求修改：{instruction}\n\n"
                 "请输出修改后的完整场景 Markdown（保持格式约定，不要解释）。"
                 "只改与要求相关的部分，其余保持不变。")}],
            temperature=self.cfg.temp_plan,
            max_tokens=self.cfg.max_tokens_scene,
        ))
        draft = SceneDraft(scene_no=sb.scene_no, markdown=md)
        parsed = parse_screenplay(_wrap_scene_for_validate(md))
        draft.scenes_parsed = parsed.get("loose_scenes") or []
        return draft

    # ================================================================== #
    # 审校层
    # ================================================================== #

    def critique_episode(self, session: Session, ep: int, episode_md: str) -> dict:
        """一集正文 vs canon -> 结构化矛盾报告 + canon 增量。"""
        if not self.cfg.critique_every_episode:
            return {"violations": [], "new_facts": [], "beats_used": []}
        canon = session.canon
        msg = [
            {"role": "system", "content": self._SYS_CRITIC},
            {"role": "user", "content": (
                f"【canon】\n{_canon_full(canon)}\n"
                f"【知识状态表】\n{_knowledge_brief(canon)}\n"
                f"【既成事实】\n{_facts_brief(canon)}\n"
                f"【已用桥段】\n{_used_beats_brief(canon)}\n\n"
                f"【第 {ep} 集正文】\n{episode_md}\n\n"
                "请审查：\n"
                "1. knowledge —— 是否有角色使用了此刻不该知道的信息（对照知识状态表）；\n"
                "2. continuity —— 是否与既成事实/时间线矛盾；\n"
                "3. character —— 是否人设崩坏（动机/性格不符）；\n"
                "4. tone —— 是否偏离全剧基调；\n"
                "5. repetition —— 是否重复了已用桥段；\n"
                "6. logic —— 情节逻辑漏洞。\n"
                "并列出本集新确立的事实(new_facts)与用到的桥段(beats_used)。"
            )},
        ]
        d = self.llm.json(msg, _CRITIC_SCHEMA, temperature=self.cfg.temp_extract,
                          max_tokens=self.cfg.max_tokens_plan)
        return {
            "violations": d.get("violations") or [],
            "new_facts": d.get("new_facts") or [],
            "beats_used": d.get("beats_used") or [],
        }

    def apply_critique(self, canon: Canon, critique: dict) -> None:
        """把审校结果并入 canon（新事实 + 已用桥段负向清单）。"""
        for f in critique.get("new_facts") or []:
            if f and f not in canon.established_facts:
                canon.established_facts.append(f)
        for b in critique.get("beats_used") or []:
            if b and b not in canon.used_beats:
                canon.used_beats.append(b)

    # ================================================================== #
    # 交付
    # ================================================================== #

    def emit(self, session: Session, episodes: list[EmitEpisode]) -> str:
        """发射完整剧本 Markdown（结构化路径：全部经确定性 emitter）。"""
        return emit_screenplay(
            session.canon, episodes,
            episode_seconds=session.episode_seconds,
            target_episodes=session.total_episodes,
            aspect_ratio="9:16", language="zh",
        )

    def deliver_markdown(self, session: Session) -> str:
        """把已生成的集正文（原始 Markdown 片段）+ 确定性头部拼成最终剧本。

        交付前自动补登记：扫描所有集正文里的说话人，未登记的补进 canon
        （避免 SPEAKER_UNDECLARED），再走 emit_from_raw_episodes。
        最终 .md 由 Stage 1 一次性解析，镜头 ID 全局唯一。
        """
        from .emitter import emit_from_raw_episodes
        # 收集正文里所有说话人
        speakers: set[str] = set()
        import re as _re
        sp_re = _re.compile(r"^>\s*([^:：（(]{1,20})", _re.MULTILINE)
        for md in session.episodes_md.values():
            for m in sp_re.finditer(md or ""):
                name = m.group(1).strip()
                if name and name not in _NON_SPEAKERS:
                    speakers.add(name)
        declared = {c.name for c in session.canon.characters}
        for name in sorted(speakers - declared):
            session.canon.characters.append(CanonCharacter(
                id=_slug(name, len(session.canon.characters) + 1), name=name,
                appearance_zh="（外形待补全，请完善）", role="配角"))
        return emit_from_raw_episodes(
            session.canon, session.episodes_md,
            episode_seconds=session.episode_seconds,
            target_episodes=session.total_episodes,
        )


_NON_SPEAKERS = {"旁白", "画外音", "字幕", "内心OS", "VO", "vo", "OS", "os", ""}


# --------------------------------------------------------------------------- #
# prompt 片段助手
# --------------------------------------------------------------------------- #

_FORMAT_CONTRACT = """请写出这一个场景的剧本 Markdown，严格遵守以下格式（这是解析器的硬约定，违反会解析失败）：

### 场景 N：地点 · 时间 · 内/外

**人物**：角色名（本片中的造型/状态），角色名2（…）
**环境**：场景视觉描述
**氛围**：情绪基调
**镜头**：景别+机位+画面内容描述
**动作**：角色动作
> 说话人（情绪）：台词内容
> 说话人（内心OS）：内心独白
**音效**：音效1、音效2
**转场**：切/淡出/闪白

硬性规则：
1. 场景标题必须用三个井号 ###，格式为「### 场景 N：地点 · 时间 · 内/外」，用「·」分隔。
2. 每个 **镜头**： 开启一个新分镜；一个分镜内放 1-3 句对白。
3. 台词必须用 > 引用块，且必须有「说话人：」前缀；内心独白用（内心OS），画外音用（画外音），旁白说话人写「旁白」。
4. 每句对白不超过 27 个字（TTS 约 4.5 字/秒，单镜 3-8 秒）。长台词拆成多句。
5. 只输出这一个场景的内容，不要输出集标题、front-matter、其他场景或任何解释。
6. 角色名必须与上面给出的角色名完全一致，不得改称（如「林晚」不能写成「林小姐」）。
"""


def _canon_brief(canon: Canon) -> str:
    return "\n".join(
        f"- {c.name}（{c.role}，{c.gender or '?'}{c.age or '?'}岁）："
        f"{c.appearance_zh}｜性格：{c.personality}｜动机：{c.motivation}"
        for c in canon.characters) or "（无）"


def _chars_brief(chars: list[CanonCharacter]) -> str:
    return "\n".join(
        f"- {c.name}：{c.appearance_zh}｜性格：{c.personality}｜动机：{c.motivation}"
        for c in chars) or "（无具名角色）"


def _knowledge_brief(canon: Canon) -> str:
    if not canon.knowledge:
        return "（无）"
    lines = []
    for k in canon.knowledge:
        rt = "、".join(f"{n}(第{ep}集起)" for n, ep in k.revealed_to.items()) or "无"
        lines.append(
            f"- {k.fact}｜当事人：{k.holder}｜公开揭示集：{k.source_ep or '未定'}"
            f"｜单独告知：{rt}｜瞒着：{'、'.join(k.hidden_from) or '无'}")
    return "\n".join(lines)


def _knowledge_constraints(canon: Canon, ep: int) -> str:
    """本集各角色的知识边界（正/负两向）。"""
    lines = []
    for c in canon.characters:
        known = canon.known_facts_for(c.name, ep)
        hidden = canon.hidden_from(c.name, ep)
        if known or hidden:
            lines.append(f"- {c.name}：知道 [{'；'.join(known) or '无'}]；"
                         f"**不知道** [{'；'.join(hidden) or '无'}]")
    return "\n".join(lines) or "（无特殊知识约束）"


def _known_for_scene(canon: Canon, names: list[str], ep: int) -> str:
    out = []
    for n in names:
        k = canon.known_facts_for(n, ep)
        if k:
            out.append(f"- {n}：{'；'.join(k)}")
    return "\n".join(out) or "（无）"


def _hidden_for_scene(canon: Canon, names: list[str], ep: int) -> str:
    out = []
    for n in names:
        h = canon.hidden_from(n, ep)
        if h:
            out.append(f"- {n}：{'；'.join(h)}")
    return "\n".join(out) or "（无）"


def _facts_brief(canon: Canon) -> str:
    return "\n".join(f"- {f}" for f in canon.established_facts) or "（无）"


def _used_beats_brief(canon: Canon, limit: int = 20) -> str:
    if not canon.used_beats:
        return "（无）"
    tail = canon.used_beats[-limit:]
    return "\n".join(f"- {b}" for b in tail)


def _canon_full(canon: Canon) -> str:
    rel = "\n".join(f"- {r.a}↔{r.b}：{r.kind}（{r.sentiment}，自第{r.since_ep}集）"
                    for r in canon.relationships) or "（无）"
    return (f"剧名：{canon.title}｜题材：{canon.genre}｜基调：{canon.tone}\n"
            f"核心冲突：{canon.core_conflict}\n"
            f"角色：\n{_canon_brief(canon)}\n关系：\n{rel}")


def _recap(session: Session, ep: int, n: int = 2) -> str:
    """前 n 集的提要（滚动摘要，避免上下文爆炸）。"""
    parts = []
    for e in range(max(1, ep - n), ep):
        eb = session.beats.episode(e)
        if eb and (eb.setup or eb.payoff or eb.hook):
            parts.append(f"第{e}集「{eb.title}」：{eb.setup} → {eb.payoff}；钩子：{eb.hook}")
        elif e in session.episodes_md:
            parts.append(f"第{e}集：（已生成，摘要见 canon）")
    return "\n".join(parts) or "（本集是全剧开场，无前情）"


# --------------------------------------------------------------------------- #
# 工具
# --------------------------------------------------------------------------- #


def _strip_fences(md: str) -> str:
    """剥掉模型可能包裹的 ```markdown ... ``` 代码围栏。"""
    s = (md or "").strip()
    if s.startswith("```"):
        first_nl = s.find("\n")
        if first_nl != -1:
            s = s[first_nl + 1:]
        if s.rstrip().endswith("```"):
            s = s.rstrip()[:-3]
    return s.strip() + "\n"


def _wrap_scene_for_validate(scene_md: str) -> str:
    """把单个场景包成可被 validate/parser 接受的最小剧本。

    场景单独校验时缺少 # 剧名 与 ## 第N集，会触发 NO_H1 等误报；
    这里补上最小外壳。场景会落入 loose_scenes（无 ## 第N集），这是预期的。
    """
    return "# _scene_check\n\n" + scene_md.strip() + "\n"


def _slug(name: str, idx: int) -> str:
    import re
    a = re.sub(r"[^a-z0-9]+", "", name.lower())
    return a[:24] if a else f"x{idx:03d}"
