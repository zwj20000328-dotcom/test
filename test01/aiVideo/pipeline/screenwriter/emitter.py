"""Markdown 发射器 —— parser.py 的逆向。

把结构化的剧本数据（Canon + BeatSheet + 每集场景/镜头）发射成符合
docs/SCREENPLAY_FORMAT.md 的 Markdown，保证能被 pipeline/validate.py 零 error 通过、
被 pipeline/parser.py 解析回等价结构。

这是阶段 A 与阶段 B 的**唯一交接面**：生成器只需产出正确的结构，发射器负责
把它渲染成 parser 认识的格式。往返一致性由 tests 锁定。

关键约束（来自 parser 的已验证行为，违反会解析错误）：
  - aspect_ratio 必须加引号 "9:16"（否则 YAML 六十进制解析成 556）
  - 全文件只能一个 # 一级标题
  - 必须显式 ## 第N集，否则场景全落入 loose_scenes、episodes=0
  - 场景用 ###（不能 ####）
  - 台词用 > 引用块 + 说话人：前缀
  - **镜头**：是分镜边界
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from .models import BeatSheet, Canon, CanonCharacter, EpisodeBeat

# 自动登记的占位外形：>=8 字以通过 CHAR_THIN 检查，且在剧本里肉眼可见，
# 提醒人工/LLM 补全（外形缺失会直接影响下游角色一致性）。
_PLACEHOLDER_APPEARANCE = "（外形待补全，请完善）"


def _slug(name: str, idx: int) -> str:
    """生成稳定 id：优先 ascii，否则用序号（与 parser._slug 同规则）。"""
    import re
    ascii_part = re.sub(r"[^a-z0-9]+", "", name.lower())
    return ascii_part[:24] if ascii_part else f"x{idx:03d}"


@dataclass
class EmitShot:
    """一个待发射的镜头。"""
    camera: Optional[str] = None
    action: Optional[str] = None
    lines: list[dict] = field(default_factory=list)   # [{speaker,emotion,kind,text}]
    sfx: list[str] = field(default_factory=list)
    transition: Optional[str] = None


@dataclass
class EmitScene:
    """一个待发射的场景。"""
    heading: str                       # 如 "场景 1：民政局门口 · 白天 · 外"
    characters: list[str] = field(default_factory=list)
    environment: Optional[str] = None
    mood: Optional[str] = None
    shots: list[EmitShot] = field(default_factory=list)


@dataclass
class EmitEpisode:
    """一集。"""
    ep: int
    title: str = ""
    scenes: list[EmitScene] = field(default_factory=list)


# --------------------------------------------------------------------------- #
# 单行渲染助手
# --------------------------------------------------------------------------- #


def _dialogue_line(ln: dict) -> str:
    """渲染一句对白为 '> 说话人（情绪/声道）：台词'。

    kind=os/vo/narration 通过括注表达（parser 会还原 kind）：
      dialogue -> 只带情绪（若有）
      os       -> （内心OS）或（内心OS，情绪）
      vo       -> （画外音）
      narration-> 说话人若为空则用"旁白"
    """
    speaker = (ln.get("speaker") or "").strip()
    text = (ln.get("text") or "").strip()
    emotion = (ln.get("emotion") or "").strip()
    kind = ln.get("kind", "dialogue")

    if kind == "os":
        tag = "内心OS"
        speaker = speaker or "旁白"
    elif kind == "vo":
        tag = "画外音"
        speaker = speaker or "旁白"
    elif kind == "narration":
        tag = ""
        speaker = speaker or "旁白"
    elif kind == "subtitle":
        tag = "字幕"
        speaker = speaker or "字幕"
    else:
        tag = ""

    paren = "，".join(x for x in (tag, emotion) if x)
    sp = f"{speaker}（{paren}）" if paren else speaker
    return f"> {sp}：{text}"


def _scene_heading(scene: EmitScene) -> str:
    return scene.heading.strip()


# --------------------------------------------------------------------------- #
# 主发射函数
# --------------------------------------------------------------------------- #


# 非角色说话人（声道标记），不需要登记进角色表
_NON_CHARACTER_SPEAKERS = {"旁白", "画外音", "字幕", "内心OS", "VO", "vo", "OS", "os", ""}


def collect_undeclared_speakers(canon: Canon,
                                episodes: list[EmitEpisode]) -> list[str]:
    """找出所有作为说话人出现、但未在角色表登记的具名角色。

    validate.py 会对这些报 SPEAKER_UNDECLARED。发射器据此自动补登记，
    保证输出的 Markdown 永远自洽。
    """
    declared = {c.name for c in canon.characters}
    seen: list[str] = []
    for ep in episodes:
        for sc in ep.scenes:
            for shot in sc.shots:
                for ln in shot.lines:
                    if ln.get("kind") in ("narration", "subtitle"):
                        continue
                    sp = (ln.get("speaker") or "").strip()
                    if not sp or sp in _NON_CHARACTER_SPEAKERS:
                        continue
                    if sp not in declared and sp not in seen:
                        seen.append(sp)
    return seen


def emit_screenplay(
    canon: Canon,
    episodes: list[EmitEpisode],
    *,
    episode_seconds: float = 270.0,
    target_episodes: Optional[int] = None,
    aspect_ratio: str = "9:16",
    language: str = "zh",
    include_logline: bool = True,
    auto_declare_speakers: bool = True,
    undeclared_out: Optional[list] = None,
) -> str:
    """把 canon + episodes 发射成完整 Markdown 剧本。

    产出的文本保证：validate.py 零 error；parser.py 能解析回等价结构。

    auto_declare_speakers=True 时，未登记的说话人会自动补入角色表（外形留待 LLM 补全），
    避免 SPEAKER_UNDECLARED 警告；补了哪些可通过 undeclared_out 列表回传给调用方，
    以便 engine 让 LLM 补充外形描述（外形缺失会影响下游角色一致性）。
    """
    out: list[str] = []

    # 自动补登记未声明的说话人
    undeclared = collect_undeclared_speakers(canon, episodes) if auto_declare_speakers else []
    if undeclared:
        canon = canon.model_copy(deep=True)
        for name in undeclared:
            canon.characters.append(CanonCharacter(
                id=_slug(name, len(canon.characters) + 1), name=name,
                appearance_zh=_PLACEHOLDER_APPEARANCE, role="配角"))
        if undeclared_out is not None:
            undeclared_out.extend(undeclared)

    # ---- front-matter ----
    out.append("---")
    out.append(f"title: {canon.title}")
    if canon.genre:
        out.append(f"genre: {canon.genre}")
    if canon.style:
        out.append(f"style: {canon.style}")
    # aspect_ratio 必须加引号（YAML 六十进制陷阱）
    out.append(f'aspect_ratio: "{aspect_ratio}"')
    out.append(f"language: {language}")
    out.append(f"target_episodes: {target_episodes or len(episodes)}")
    out.append(f"episode_seconds: {int(episode_seconds)}")
    out.append("---")
    out.append("")

    # ---- 剧名（唯一 # 标题）----
    out.append(f"# {canon.title}")
    out.append("")
    if include_logline and canon.logline:
        out.append(f"> 一句话故事：{canon.logline}")
        out.append("")

    # ---- 角色表 ----
    if canon.characters:
        out.append("## 角色表")
        out.append("")
        for c in canon.characters:
            desc_parts = []
            if c.gender:
                desc_parts.append(c.gender)
            if c.age:
                desc_parts.append(f"{c.age}岁")
            head = "，".join(desc_parts)
            body = c.appearance_zh or c.identity_blob or ""
            line = f"- **{c.name}**："
            line += (head + "。" + body) if head else body
            out.append(line.rstrip("。") + ("。" if body else ""))
        out.append("")

    # ---- 每集 ----
    for ep in episodes:
        title = ep.title.strip()
        head = f"## 第{ep.ep}集"
        out.append(head + (f" · {title}" if title else ""))
        out.append("")
        for sc in ep.scenes:
            out.append(f"### {_scene_heading(sc)}")
            out.append("")
            if sc.characters:
                out.append(f"**人物**：{'，'.join(sc.characters)}")
            if sc.environment:
                out.append(f"**环境**：{sc.environment}")
            if sc.mood:
                out.append(f"**氛围**：{sc.mood}")
            for shot in sc.shots:
                if shot.camera:
                    out.append(f"**镜头**：{shot.camera}")
                if shot.action:
                    out.append(f"**动作**：{shot.action}")
                for ln in shot.lines:
                    out.append(_dialogue_line(ln))
                if shot.sfx:
                    out.append(f"**音效**：{'、'.join(shot.sfx)}")
                if shot.transition:
                    out.append(f"**转场**：{shot.transition}")
            out.append("")

    return "\n".join(out).rstrip() + "\n"


# --------------------------------------------------------------------------- #
# 从 BeatSheet 生成"骨架剧本"（尚未填充对白，用于占位/审阅结构）
# --------------------------------------------------------------------------- #


def emit_header(canon: Canon, *, episode_seconds: float = 270.0,
                target_episodes: Optional[int] = None,
                aspect_ratio: str = "9:16", language: str = "zh",
                include_logline: bool = True) -> str:
    """只发射剧本头部：front-matter + 剧名 + logline + 角色表。

    头部的规范性由代码保证（aspect_ratio 加引号、唯一 # 标题、角色表格式），
    因此无论场景正文怎么来，头部永远 validate 通过。
    """
    out: list[str] = []
    out.append("---")
    out.append(f"title: {canon.title}")
    if canon.genre:
        out.append(f"genre: {canon.genre}")
    if canon.style:
        out.append(f"style: {canon.style}")
    out.append(f'aspect_ratio: "{aspect_ratio}"')
    out.append(f"language: {language}")
    out.append(f"target_episodes: {target_episodes or 0}")
    out.append(f"episode_seconds: {int(episode_seconds)}")
    out.append("---")
    out.append("")
    out.append(f"# {canon.title}")
    out.append("")
    if include_logline and canon.logline:
        out.append(f"> 一句话故事：{canon.logline}")
        out.append("")
    if canon.characters:
        out.append("## 角色表")
        out.append("")
        for c in canon.characters:
            parts = []
            if c.gender:
                parts.append(c.gender)
            if c.age:
                parts.append(f"{c.age}岁")
            head = "，".join(parts)
            body = c.appearance_zh or c.identity_blob or ""
            line = f"- **{c.name}**："
            line += (head + "。" + body) if head else body
            out.append(line.rstrip("。") + ("。" if body else ""))
        out.append("")
    return "\n".join(out).rstrip() + "\n"


def emit_from_raw_episodes(canon: Canon, episodes_md: dict[int, str], *,
                           episode_seconds: float = 270.0,
                           target_episodes: Optional[int] = None,
                           aspect_ratio: str = "9:16", language: str = "zh") -> str:
    """把已生成的集正文（原始 Markdown 片段）与确定性头部拼成完整剧本。

    为什么用这条路而不是结构化重发射：
      - 场景正文由 LLM 产出并已单独过 validate；
      - **最终 .md 只被真实 parser 解析一次**（Stage 1），镜头 ID 在那时统一分配。
        若逐集/逐场景分别 parse 再重组，会重置全局计数器导致 ID 冲突
        （实测：单独解析两个场景都得到 s001_sh002）。
    头部（front-matter/剧名/角色表）仍由 emit_header 确定性生成。
    """
    header = emit_header(canon, episode_seconds=episode_seconds,
                         target_episodes=target_episodes or len(episodes_md),
                         aspect_ratio=aspect_ratio, language=language)
    blocks = [header]
    for ep in sorted(episodes_md):
        md = (episodes_md[ep] or "").strip()
        if md:
            blocks.append(md)
    return "\n\n".join(blocks).rstrip() + "\n"


def compose_episode_markdown(ep: int, title: str, scene_markdowns: list[str]) -> str:
    """把一集的场景正文片段拼成 "## 第N集 · 标题" + 各场景。

    场景 markdown 由 write_scene 产出（各自已过 validate）；这里只加集标题并拼接。
    最终整剧 .md 由 Stage 1 一次性解析，镜头 ID 全局唯一分配。
    """
    head = f"## 第{ep}集" + (f" · {title.strip()}" if title and title.strip() else "")
    body = "\n\n".join(s.strip() for s in scene_markdowns if s and s.strip())
    return head + "\n\n" + body + "\n" if body else head + "\n"


def emit_skeleton(canon: Canon, beats: BeatSheet, *,
                  episode_seconds: float = 270.0) -> str:
    """从节拍表发射骨架剧本：每集每场景有标题/环境/氛围/镜头描述占位，
    但对白留空（后续 LLM 填充）。用于让用户先审结构再填内容。

    注意：骨架的每个场景至少放一个 **镜头** 标记，避免 validate 报 EMPTY_SCENE。
    """
    episodes = []
    for eb in beats.episodes:
        scenes = []
        for sb in eb.scenes:
            heading = f"场景 {sb.scene_no}：{sb.location or '待定'} · {sb.time or '白天'} · {sb.int_ext}"
            shot = EmitShot(camera=f"（待细化）{sb.purpose}".strip(),
                            action=sb.ends_on or None,
                            lines=([{"speaker": "旁白", "kind": "narration",
                                    "text": sb.key_line}] if sb.key_line else []))
            scenes.append(EmitScene(
                heading=heading,
                characters=sb.characters,
                mood=sb.mood or None,
                shots=[shot],
            ))
        episodes.append(EmitEpisode(ep=eb.ep, title=eb.title, scenes=scenes))
    return emit_screenplay(canon, episodes, episode_seconds=episode_seconds,
                           target_episodes=beats.total_episodes)
