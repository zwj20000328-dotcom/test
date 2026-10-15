"""短剧节奏的确定性校验 —— 不依赖 LLM 自觉，用代码强制质量底线。

设计动机：LLM 会写出时长失控（一集 90 秒或 600 秒）、缺钩子、对白过长导致 TTS 超镜头
的剧本。这些都能用纯算术检查，比让模型"注意节奏"可靠得多。

时长估算模型（与 pipeline/subtitles.py 的 4.5 字/秒一致）：
  镜头时长 ≈ max(镜头动作基础时长, 对白总字数 / 语速 + 停顿)
  集时长   = Σ 镜头时长
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

# ---- 节奏常量（可调，但改动会影响全部校验阈值）----
CHARS_PER_SEC = 4.5          # 中文 TTS 语速，与 subtitles.estimate_timings 一致
LINE_GAP = 0.15              # 句间停顿（秒）
SHOT_BASE_SEC = 2.0          # 无对白镜头的基础时长（纯画面/动作）
SHOT_MIN_SEC = 2.0
SHOT_MAX_SEC = 12.0          # 单镜上限：超过就该拆镜
LINE_MAX_CHARS = 27          # 单句对白上限（6 秒 × 4.5 字/秒）；超过提示拆分
EPISODE_MIN_SEC = 240.0      # 每集 4 分钟
EPISODE_MAX_SEC = 300.0      # 每集 5 分钟
EPISODE_TARGET_SEC = 270.0
SCENES_PER_EP_MIN = 4
SCENES_PER_EP_MAX = 12
SHOTS_PER_EP_MIN = 30        # 4-5 分钟按 3-8 秒/镜推算
SHOTS_PER_EP_MAX = 90


# --------------------------------------------------------------------------- #
# 时长估算
# --------------------------------------------------------------------------- #


def line_seconds(text: str, chars_per_sec: float = CHARS_PER_SEC) -> float:
    """一句对白的口播时长。"""
    n = len((text or "").strip())
    if n == 0:
        return 0.0
    return n / chars_per_sec


def shot_seconds(lines: list[str], action_chars: int = 0,
                 base: float = SHOT_BASE_SEC) -> float:
    """估算一个镜头的时长。

    取"对白口播总时长 + 句间停顿"与"基础时长 + 动作时长"的较大值：
    对白多的镜头由对白决定，纯动作镜头由动作决定。
    """
    dialogue = sum(line_seconds(t) for t in lines if (t or "").strip())
    gaps = LINE_GAP * max(0, len([t for t in lines if (t or "").strip()]) - 1)
    action = action_chars / CHARS_PER_SEC if action_chars else 0.0
    return max(dialogue + gaps, base + action)


def episode_seconds(shots: list[dict]) -> float:
    """一集的总时长估算。

    shots: [{"lines": [str], "action_chars": int}]，或直接是解析器产出的 shot dict
    （其 lines 是 [{text,...}]，camera/action 是字符串）。
    """
    total = 0.0
    for sh in shots:
        lines = sh.get("lines") or []
        if lines and isinstance(lines[0], dict):
            texts = [ln.get("text", "") for ln in lines]
        else:
            texts = list(lines)
        action = sh.get("action") or ""
        total += shot_seconds(texts, action_chars=len(action))
    return total


# --------------------------------------------------------------------------- #
# 违规项
# --------------------------------------------------------------------------- #


@dataclass
class CraftIssue:
    level: str                 # "error" | "warning"
    code: str
    ep: Optional[int]
    msg: str
    fix: str = ""

    def to_dict(self) -> dict:
        return {"level": self.level, "code": self.code, "ep": self.ep,
                "msg": self.msg, "fix": self.fix}


@dataclass
class CraftReport:
    issues: list[CraftIssue] = field(default_factory=list)
    stats: dict[str, Any] = field(default_factory=dict)

    def add(self, level: str, code: str, ep: Optional[int], msg: str, fix: str = "") -> None:
        self.issues.append(CraftIssue(level, code, ep, msg, fix))

    @property
    def errors(self) -> list[CraftIssue]:
        return [i for i in self.issues if i.level == "error"]

    @property
    def warnings(self) -> list[CraftIssue]:
        return [i for i in self.issues if i.level == "warning"]

    @property
    def ok(self) -> bool:
        return not self.errors

    def to_dict(self) -> dict:
        return {"ok": self.ok, "errors": len(self.errors),
                "warnings": len(self.warnings),
                "issues": [i.to_dict() for i in self.issues],
                "stats": self.stats}


# --------------------------------------------------------------------------- #
# 节拍级校验（生成正文之前，检查规划是否合理）
# --------------------------------------------------------------------------- #


def check_beats(beats, canon=None) -> CraftReport:
    """校验两级节拍表：集数、每集时长目标、场景数、钩子、反转分布。"""
    rep = CraftReport()
    eps = beats.episodes
    total = beats.total_episodes

    if not eps:
        rep.add("error", "NO_EPISODE_BEATS", None, "节拍表没有任何集", "先生成季度弧线")
        return rep

    if len(eps) != total:
        rep.add("warning", "EP_COUNT_MISMATCH", None,
                f"节拍表集数 {len(eps)} 与声明的 total_episodes {total} 不符",
                "补齐缺失集或修正 total_episodes")

    # 集号必须连续且从 1 开始
    nums = sorted(e.ep for e in eps)
    if nums != list(range(1, len(nums) + 1)):
        rep.add("error", "EP_NUMBERS_GAP", None,
                f"集号不连续：{nums[:5]}…{nums[-3:]}", "集号必须是 1..N 连续整数")

    # 反转分布：一部剧至少有 1 个重大反转，且不应全挤在结尾
    reversals = [e.ep for e in eps if e.reversal]
    if not reversals:
        rep.add("warning", "NO_REVERSAL", None,
                "全剧没有标记任何重大反转", "短剧需要至少 1-2 个中期反转")
    elif reversals and max(reversals) > total * 0.9:
        rep.add("warning", "LATE_REVERSAL", None,
                f"重大反转都在第 {reversals} 集（过于靠后）",
                "把至少一个反转放到全剧 30-60% 处")

    for e in eps:
        # 钩子必须有
        if not (e.hook or "").strip():
            rep.add("error", "NO_HOOK", e.ep, f"第 {e.ep} 集没有集尾钩子",
                    "每集必须以一个悬念/反转收尾")
        # 场景数
        n_sc = len(e.scenes)
        if n_sc and not (SCENES_PER_EP_MIN <= n_sc <= SCENES_PER_EP_MAX):
            rep.add("warning", "SCENE_COUNT", e.ep,
                    f"第 {e.ep} 集有 {n_sc} 个场景（建议 {SCENES_PER_EP_MIN}-"
                    f"{SCENES_PER_EP_MAX}）", "调整场景切分")
        # 目标时长
        if e.target_seconds and not (EPISODE_MIN_SEC <= e.target_seconds <= EPISODE_MAX_SEC + 30):
            rep.add("warning", "EP_TARGET_SECONDS", e.ep,
                    f"第 {e.ep} 集目标时长 {e.target_seconds}s 偏离 240-300s",
                    "调整 target_seconds")
        # 场景时长之和应接近集目标时长
        if e.scenes:
            sc_sum = sum(s.target_seconds for s in e.scenes)
            if e.target_seconds and abs(sc_sum - e.target_seconds) > e.target_seconds * 0.4:
                rep.add("warning", "SCENE_SECONDS_MISMATCH", e.ep,
                        f"第 {e.ep} 集场景时长合计 {sc_sum:.0f}s 与集目标 "
                        f"{e.target_seconds:.0f}s 偏差过大", "重新分配场景时长")

    rep.stats = {
        "episodes": len(eps),
        "reversals": reversals,
        "acts": len(beats.acts),
        "total_target_minutes": sum(e.target_seconds for e in eps) / 60.0,
    }
    return rep


# --------------------------------------------------------------------------- #
# 正文级校验（生成 Markdown 之后，检查实际内容）
# --------------------------------------------------------------------------- #


def check_episode_content(ep: int, scenes: list[dict], *,
                          min_sec: float = EPISODE_MIN_SEC,
                          max_sec: float = EPISODE_MAX_SEC) -> CraftReport:
    """校验一集正文：实际估算时长、镜头数、单句对白长度。

    scenes: 解析器产出的 scene dict 列表（含 shots）。
    """
    rep = CraftReport()
    shots = [sh for sc in scenes for sh in (sc.get("shots") or [])]
    if not shots:
        rep.add("error", "EP_NO_SHOTS", ep, f"第 {ep} 集没有任何镜头", "补充内容")
        return rep

    dur = episode_seconds(shots)
    if dur < min_sec:
        rep.add("error", "EP_TOO_SHORT", ep,
                f"第 {ep} 集估算时长 {dur:.0f}s < {min_sec:.0f}s（不足 4 分钟）",
                f"需再补约 {(min_sec - dur) / 5:.0f} 个镜头或加长对白")
    elif dur > max_sec:
        rep.add("warning", "EP_TOO_LONG", ep,
                f"第 {ep} 集估算时长 {dur:.0f}s > {max_sec:.0f}s（超过 5 分钟）",
                "考虑拆成两集或精简")

    if not (SHOTS_PER_EP_MIN <= len(shots) <= SHOTS_PER_EP_MAX):
        rep.add("warning", "SHOT_COUNT", ep,
                f"第 {ep} 集有 {len(shots)} 个镜头（建议 {SHOTS_PER_EP_MIN}-"
                f"{SHOTS_PER_EP_MAX}）", "调整分镜密度")

    # 单句对白过长 -> TTS 会超出镜头时长
    for sh in shots:
        for ln in sh.get("lines") or []:
            text = ln.get("text", "") if isinstance(ln, dict) else str(ln)
            if len(text) > LINE_MAX_CHARS:
                secs = line_seconds(text)
                rep.add("warning", "LINE_TOO_LONG", ep,
                        f"第 {ep} 集镜头 {sh.get('id')} 对白 {len(text)} 字"
                        f"（约 {secs:.1f}s）超过单镜建议上限",
                        f"拆成多句，每句 ≤{LINE_MAX_CHARS} 字")

    # 单镜时长超限
    for sh in shots:
        lines = sh.get("lines") or []
        texts = [ln.get("text", "") if isinstance(ln, dict) else str(ln) for ln in lines]
        s = shot_seconds(texts, action_chars=len(sh.get("action") or ""))
        if s > SHOT_MAX_SEC:
            rep.add("warning", "SHOT_TOO_LONG", ep,
                    f"第 {ep} 集镜头 {sh.get('id')} 估算 {s:.1f}s > {SHOT_MAX_SEC}s",
                    "拆成多个镜头")

    rep.stats = {"ep": ep, "shots": len(shots), "scenes": len(scenes),
                 "est_seconds": round(dur, 1),
                 "est_minutes": round(dur / 60.0, 2)}
    return rep


def check_script_content(parsed: dict) -> CraftReport:
    """校验整部剧正文：逐集跑 check_episode_content，并汇总全剧统计。"""
    rep = CraftReport()
    eps = parsed.get("episodes") or []
    per_ep = []
    for e in eps:
        r = check_episode_content(e["ep"], e.get("scenes") or [])
        rep.issues.extend(r.issues)
        per_ep.append(r.stats)

    # 未显式分集（全落入 loose_scenes）—— 下游按集装配会拿不到任何东西
    if not eps and parsed.get("loose_scenes"):
        rep.add("error", "NO_EXPLICIT_EPISODES", None,
                "剧本没有 '## 第N集' 标题，全部场景落入 loose_scenes，"
                "下游按集装配将拿不到任何 episode",
                "每集必须用 '## 第N集' 显式标注（见 SCREENPLAY_FORMAT §6）")

    total_sec = sum(x.get("est_seconds", 0) for x in per_ep)
    rep.stats = {
        "episodes": len(eps),
        "total_shots": sum(x.get("shots", 0) for x in per_ep),
        "total_est_minutes": round(total_sec / 60.0, 1),
        "per_episode": per_ep,
    }
    return rep
