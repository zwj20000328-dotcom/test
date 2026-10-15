"""确定性 Markdown 剧本解析器 (Stage 1: Parse).

把纯文本 .md 剧本解析成结构化的 raw script（Python dict / JSON）。
本层只做**结构化提取**，不做任何 LLM 生成——visual_prompt / motion_prompt /
分镜细化 / 集切分等留给 Stage 2 (LLM Enrichment)。

设计原则：
- 松格式容错：缺省的字段留空，不报错。
- 幂等：同一份 .md 多次解析结果一致。
- 无第三方强依赖：front-matter 优先用 PyYAML，缺失时回退到内置的简易解析。

用法：
    python -m pipeline.parser examples/sample_screenplay.md -o out/script.raw.json
    # 或作为库
    from pipeline.parser import parse_screenplay
    data = parse_screenplay(md_text)
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Optional

# --------------------------------------------------------------------------- #
# front-matter
# --------------------------------------------------------------------------- #

_FM_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


def _parse_front_matter(text: str) -> tuple[dict[str, Any], str]:
    """返回 (meta_dict, 去掉 front-matter 后的正文)。"""
    m = _FM_RE.match(text)
    if not m:
        return {}, text
    raw = m.group(1)
    body = text[m.end():]
    try:
        import yaml  # type: ignore

        # YAML 会把 `9:16` 当成六十进制整数解析成 556。给形如 \d+:\d+ 的裸值加引号，
        # 避免画幅比例等被误解析。
        safe_raw = re.sub(
            r"^(\s*[\w\-]+\s*:\s*)(\d+:\d+)\s*$",
            r'\1"\2"',
            raw,
            flags=re.MULTILINE,
        )
        data = yaml.safe_load(safe_raw)
        if isinstance(data, dict):
            return data, body
    except Exception:
        pass
    # 回退：简易 key: value 解析（够用于扁平元信息）
    data = {}
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" in line:
            k, _, v = line.partition(":")
            v = v.split("#", 1)[0].strip()  # 去掉行内注释
            data[k.strip()] = _coerce_scalar(v)
    return data, body


def _coerce_scalar(v: str) -> Any:
    if v == "":
        return None
    if re.fullmatch(r"-?\d+", v):
        return int(v)
    if re.fullmatch(r"-?\d+\.\d+", v):
        return float(v)
    if v.lower() in ("true", "false"):
        return v.lower() == "true"
    return v.strip("'\"")


# --------------------------------------------------------------------------- #
# 数据模型
# --------------------------------------------------------------------------- #


@dataclass
class Line:
    """一句对白 / 旁白。"""

    speaker: str
    text: str
    emotion: Optional[str] = None
    kind: str = "dialogue"  # dialogue | os | vo | narration | subtitle


@dataclass
class Shot:
    """一个镜头（可能含多句对白、动作、音效）。Stage 2 会进一步细化。"""

    id: str
    camera: Optional[str] = None       # **镜头**：描述
    action: Optional[str] = None       # **动作**：
    sfx: list[str] = field(default_factory=list)   # **音效**：
    transition: Optional[str] = None   # **转场**：
    lines: list[Line] = field(default_factory=list)
    raw_text: list[str] = field(default_factory=list)  # 归属本镜头的原始正文行
    # 以下字段由 Stage 2 (LLM) 回填：
    visual_prompt: Optional[str] = None
    motion_prompt: Optional[str] = None
    est_seconds: Optional[float] = None


@dataclass
class Scene:
    id: str
    heading: str
    location: Optional[str] = None
    time: Optional[str] = None
    int_ext: Optional[str] = None
    characters: list[str] = field(default_factory=list)  # **人物**：
    environment: Optional[str] = None                    # **环境**：
    mood: Optional[str] = None                           # **氛围/情绪**：
    shots: list[Shot] = field(default_factory=list)
    extra: dict[str, str] = field(default_factory=dict)   # 未识别的 **xxx**：字段


@dataclass
class Episode:
    ep: int
    heading: str
    scenes: list[Scene] = field(default_factory=list)
    target_seconds: Optional[float] = None


@dataclass
class Character:
    id: str
    name: str
    appearance: str = ""
    gender: Optional[str] = None
    age: Optional[int] = None
    voice_id: Optional[str] = None       # TTS 阶段回填
    ref_images: list[str] = field(default_factory=list)  # 定妆图阶段回填


@dataclass
class Script:
    title: str
    meta: dict[str, Any] = field(default_factory=dict)
    logline: Optional[str] = None
    characters: list[Character] = field(default_factory=list)
    episodes: list[Episode] = field(default_factory=list)
    # 无显式 ## 分集时，场景先落这里，Stage 2 再切分成集
    loose_scenes: list[Scene] = field(default_factory=list)


# --------------------------------------------------------------------------- #
# 标记字段识别
# --------------------------------------------------------------------------- #

# **字段**：值   /   **字段**: 值
_FIELD_RE = re.compile(r"^\*\*\s*(.+?)\s*\*\*\s*[:：]\s*(.*)$")

# 说话人映射到 kind
_OS_SPEAKERS = {"内心os", "内心", "os", "旁白", "画外音", "vo", "画外", "字幕", "narrator", "narration"}

# 场景标题里的 location · time · int/ext 切分
_SCENE_SEP_RE = re.compile(r"[·|•／/、,，]")


def _slug(name: str, idx: int) -> str:
    """生成稳定 id：优先用 ascii，否则用序号占位（中文名保留在 name 字段）。"""
    ascii_part = re.sub(r"[^a-z0-9]+", "", name.lower())
    if ascii_part:
        return ascii_part[:24]
    return f"x{idx:03d}"


def _normalize_field_key(key: str) -> str:
    k = key.strip().lower().replace(" ", "")
    table = {
        "人物": "characters", "角色": "characters", "出场人物": "characters",
        "环境": "environment", "场景": "environment", "场景描述": "environment",
        "氛围": "mood", "情绪": "mood", "氛围/情绪": "mood", "基调": "mood",
        "镜头": "camera", "机位": "camera", "运镜": "camera", "画面": "camera",
        "动作": "action", "表演": "action",
        "音效": "sfx", "sfx": "sfx", "声音": "sfx",
        "转场": "transition",
        "bgm": "bgm", "配乐": "bgm",
    }
    return table.get(k, table.get(key.strip(), k))


# 规范化后的"已知字段"全集——校验器 (validate.py) 共用此定义，避免两处判定漂移。
CANONICAL_FIELDS = frozenset(
    {"characters", "environment", "mood", "camera", "action", "sfx", "transition", "bgm"}
)
# 供外部（校验器）使用的公开别名
normalize_field_key = _normalize_field_key


def is_known_field(key: str) -> bool:
    """字段名是否被解析器识别（规范化后落在 CANONICAL_FIELDS 内）。"""
    return _normalize_field_key(key) in CANONICAL_FIELDS


def _parse_dialogue(raw: str) -> Optional[Line]:
    """解析 blockquote 对白行： `> 说话人（情绪）：台词`。

    括注可能是**情绪**（愤怒/哽咽）、**声道类型**（内心OS/画外音/旁白），或两者兼有
    （如 `林晚（内心OS，紧张）`）。声道类型决定 kind，情绪保留为演绎提示。
    """
    text = raw.lstrip(">").strip()
    if not text:
        return None
    # 说话人：以第一个中/英文冒号切分
    m = re.match(r"^([^:：]{1,20})[:：]\s*(.*)$", text)
    if m:
        speaker_raw, content = m.group(1).strip(), m.group(2).strip()
    else:
        speaker_raw, content = "", text

    # 提取括注： 说话人（...）  或 说话人(...)
    paren = None
    em = re.match(r"^(.*?)\s*[（(]([^）)]*)[）)]\s*$", speaker_raw)
    if em:
        speaker_raw = em.group(1).strip()
        paren = em.group(2).strip()

    # 判定声道类型 kind：优先看说话人名，再看括注
    kind = "dialogue"
    emotion = None
    haystack_name = speaker_raw.lower()
    haystack_paren = (paren or "").lower()

    def _classify(speaker_low: str, paren_low: str) -> Optional[str]:
        if "字幕" in speaker_low or "字幕" in paren_low:
            return "subtitle"
        if "旁白" in speaker_low or "旁白" in paren_low or speaker_low in ("narrator", "narration"):
            return "narration"
        if "内心" in speaker_low or "内心" in paren_low or "os" in paren_low or speaker_low == "os":
            return "os"
        if "画外音" in speaker_low or "画外音" in paren_low or "vo" in paren_low or speaker_low == "vo" or "画外" in speaker_low:
            return "vo"
        return None

    k = _classify(haystack_name, haystack_paren)
    if k:
        kind = k
        # 括注里除声道标记外若还有情绪词，保留为 emotion
        if paren:
            resid = re.sub(r"(内心\s*os|内心|画外音|画外|旁白|字幕|vo|os)", "", paren, flags=re.I)
            resid = resid.strip("、,，;； ").strip()
            emotion = resid or None
    else:
        # 纯情绪括注
        emotion = paren or None

    if not speaker_raw:
        speaker_raw = "旁白"
        if kind == "dialogue":
            kind = "narration"

    return Line(speaker=speaker_raw, text=content, emotion=emotion, kind=kind)


def _parse_scene_heading(heading: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """从 '场景 1：咖啡厅 · 白天 · 内' 提取 location/time/int_ext。松格式，尽力而为。"""
    # 去掉前缀 '场景 N：' / 'Scene N:'
    h = re.sub(r"^(场景|scene)\s*\d*\s*[:：]\s*", "", heading, flags=re.I).strip()
    parts = [p.strip() for p in _SCENE_SEP_RE.split(h) if p.strip()]
    location = time = int_ext = None
    for p in parts:
        if p in ("内", "外", "内景", "外景", "INT", "EXT", "int", "ext"):
            int_ext = "内" if p.lower().startswith(("内", "int")) else "外"
        elif any(t in p for t in ("白天", "夜", "晨", "傍晚", "黄昏", "清晨", "午后", "深夜", "凌晨", "日", "夜", "白天", "早上", "晚上", "中午", "翌日")):
            time = p
        elif location is None:
            location = p
    if location is None and parts:
        location = parts[0]
    return location, time, int_ext


def _split_sfx(value: str) -> list[str]:
    parts = re.split(r"[、,，/；;]", value)
    return [p.strip() for p in parts if p.strip()]


def _split_top_level(value: str) -> list[str]:
    """按分隔符切分，但**忽略括号内**的分隔符。

    例：`林晚（女主，28，职场精英），顾沉（男主，32，总裁）`
      -> [`林晚（女主，28，职场精英）`, `顾沉（男主，32，总裁）`]
    用于 **人物** 字段——角色外形描述里常含逗号，不能被切开。
    """
    parts: list[str] = []
    depth = 0
    buf: list[str] = []
    seps = set("、,，;；/")
    for ch in value:
        if ch in "（([{":
            depth += 1
        elif ch in "）)]}":
            depth = max(0, depth - 1)
        if ch in seps and depth == 0:
            parts.append("".join(buf))
            buf = []
        else:
            buf.append(ch)
    parts.append("".join(buf))
    return [p.strip() for p in parts if p.strip()]


# --------------------------------------------------------------------------- #
# 主解析流程
# --------------------------------------------------------------------------- #

_H1_RE = re.compile(r"^#\s+(.*)$")
_H2_RE = re.compile(r"^##\s+(.*)$")
_H3_RE = re.compile(r"^###\s+(.*)$")
_QUOTE_RE = re.compile(r"^>\s?(.*)$")
_CHAR_BULLET_RE = re.compile(r"^[-*]\s*\*\*(.+?)\*\*\s*[:：]\s*(.*)$")


def parse_screenplay(text: str) -> dict[str, Any]:
    meta, body = _parse_front_matter(text)
    lines = body.splitlines()

    script = Script(title=meta.get("title") or "", meta=meta)

    i = 0
    n = len(lines)
    ep_counter = 0
    scene_counter = 0
    shot_counter = 0
    char_counter = 0

    current_ep: Optional[Episode] = None
    current_scene: Optional[Scene] = None
    current_shot: Optional[Shot] = None
    in_character_table = False

    def flush_shot():
        nonlocal current_shot
        if current_shot is not None and current_scene is not None:
            # 丢弃完全空的镜头
            if current_shot.lines or current_shot.camera or current_shot.action or current_shot.raw_text:
                current_scene.shots.append(current_shot)
        current_shot = None

    def new_shot(scene: Scene) -> Shot:
        nonlocal shot_counter
        shot_counter += 1
        return Shot(id=f"{scene.id}_sh{shot_counter:03d}")

    while i < n:
        raw = lines[i]
        line = raw.rstrip()
        stripped = line.strip()
        # 结构匹配用 norm：去掉**前导**空白（含全角空格 U+3000，中文输入法常见）。
        # 不归一化会导致 `　**镜头**：` / `　> 台词` 不匹配任何结构正则，
        # 整条落入 raw_text 后被空镜头过滤丢弃 —— validate 还报零 error（静默丢数据）。
        # 只去前导，不动内部，因此值里的全角空格/标点原样保留。
        norm = line.lstrip()
        i += 1

        if not stripped:
            continue

        # 跳过 front-matter 之后可能残留的分隔线
        if stripped in ("---", "***", "___"):
            continue

        # ---- H1 剧名 ----
        if m := _H1_RE.match(norm):
            if not script.title:
                script.title = m.group(1).strip()
            in_character_table = False
            continue

        # ---- H2 集 / 角色表 ----
        if m := _H2_RE.match(norm):
            flush_shot()
            current_shot = None
            current_scene = None
            heading = m.group(1).strip()
            in_character_table = ("角色" in heading) or ("人物" in heading) or ("character" in heading.lower())
            if in_character_table:
                current_ep = None
            else:
                ep_counter += 1
                current_ep = Episode(ep=ep_counter, heading=heading)
                script.episodes.append(current_ep)
            continue

        # ---- H3 场景 ----
        if m := _H3_RE.match(norm):
            flush_shot()
            current_shot = None
            in_character_table = False
            scene_counter += 1
            heading = m.group(1).strip()
            sid = f"s{scene_counter:03d}"
            loc, tm, ie = _parse_scene_heading(heading)
            current_scene = Scene(id=sid, heading=heading, location=loc, time=tm, int_ext=ie)
            if current_ep is not None:
                current_ep.scenes.append(current_scene)
            else:
                script.loose_scenes.append(current_scene)
            current_shot = new_shot(current_scene)
            continue

        # ---- 角色表条目 ----
        if in_character_table:
            if m := _CHAR_BULLET_RE.match(norm):
                name = m.group(1).strip()
                desc = m.group(2).strip()
                char_counter += 1
                c = Character(id=_slug(name, char_counter), name=name, appearance=desc)
                gm = re.search(r"(女|男|女性|男性|male|female)", desc)
                if gm:
                    c.gender = "女" if gm.group(1) in ("女", "女性", "female") else "男"
                am = re.search(r"(\d{1,3})\s*岁", desc)
                if am:
                    c.age = int(am.group(1))
                script.characters.append(c)
            continue

        # ---- blockquote 对白 ----
        if m := _QUOTE_RE.match(norm):
            # 顶层引用（非场景内）可能是 logline
            if current_scene is None:
                content = m.group(1).strip()
                if content and script.logline is None and not content.startswith(">"):
                    # 形如 "一句话故事：..." 或普通旁白
                    script.logline = re.sub(r"^一句话故事[:：]\s*", "", content)
                continue
            dl = _parse_dialogue(m.group(0))
            if dl:
                if current_shot is None:
                    current_shot = new_shot(current_scene)
                current_shot.lines.append(dl)
            continue

        # ---- 场景内：字段标记 / 正文 ----
        if current_scene is not None:
            if m := _FIELD_RE.match(norm):
                key = _normalize_field_key(m.group(1))
                val = m.group(2).strip()
                # 镜头/动作/音效/转场 归属"当前镜头"，并开启新镜头语义边界（镜头行=新分镜）
                if key == "camera":
                    # 一个 **镜头**：标记开启一个新分镜
                    flush_shot()
                    current_shot = new_shot(current_scene)
                    current_shot.camera = val
                    current_shot.raw_text.append(val)
                elif key == "action":
                    if current_shot is None:
                        current_shot = new_shot(current_scene)
                    current_shot.action = (current_shot.action + " " + val).strip() if current_shot.action else val
                    current_shot.raw_text.append(val)
                elif key == "sfx":
                    if current_shot is None:
                        current_shot = new_shot(current_scene)
                    current_shot.sfx.extend(_split_sfx(val))
                elif key == "transition":
                    if current_shot is None:
                        current_shot = new_shot(current_scene)
                    current_shot.transition = val
                elif key == "characters":
                    current_scene.characters.extend(_split_top_level(val))
                elif key == "environment":
                    current_scene.environment = val
                elif key == "mood":
                    current_scene.mood = val
                elif key == "bgm":
                    current_scene.extra["bgm"] = val
                else:
                    current_scene.extra[key] = val
                continue
            else:
                # 普通正文：作为镜头描述 / 动作累积
                if stripped.startswith("#"):
                    continue
                if current_shot is None:
                    current_shot = new_shot(current_scene)
                current_shot.raw_text.append(stripped)
                continue

        # 其它（剧名下方正文等）
        if stripped.startswith(">") and script.logline is None:
            script.logline = stripped.lstrip(">").strip()

    flush_shot()

    # 清理空镜头 & 给没有 camera 但有对白的镜头兜底
    for ep in script.episodes:
        for sc in ep.scenes:
            sc.shots = [s for s in sc.shots if (s.lines or s.camera or s.action or s.sfx)]
    for sc in script.loose_scenes:
        sc.shots = [s for s in sc.shots if (s.lines or s.camera or s.action or s.sfx)]

    # 回填集数元信息
    if script.meta.get("episode_seconds"):
        for ep in script.episodes:
            ep.target_seconds = float(script.meta["episode_seconds"])

    return _script_to_dict(script)


def _script_to_dict(script: Script) -> dict[str, Any]:
    d = asdict(script)
    # 统计信息，便于校验
    total_scenes = sum(len(e.scenes) for e in script.episodes) + len(script.loose_scenes)
    total_shots = sum(
        len(sc.shots)
        for e in script.episodes
        for sc in e.scenes
    ) + sum(len(sc.shots) for sc in script.loose_scenes)
    total_lines = sum(
        len(sh.lines)
        for e in script.episodes
        for sc in e.scenes
        for sh in sc.shots
    ) + sum(len(sh.lines) for sc in script.loose_scenes for sh in sc.shots)
    d["_stats"] = {
        "episodes": len(script.episodes),
        "scenes": total_scenes,
        "shots": total_shots,
        "dialogue_lines": total_lines,
        "characters": len(script.characters),
        "has_explicit_episodes": len(script.episodes) > 0,
    }
    return d


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="解析 Markdown 剧本为结构化 JSON (Stage 1)")
    ap.add_argument("screenplay", help="输入的 .md 剧本路径")
    ap.add_argument("-o", "--output", help="输出 JSON 路径（默认打印到 stdout）")
    ap.add_argument("--indent", type=int, default=2)
    args = ap.parse_args(argv)

    path = Path(args.screenplay)
    if not path.exists():
        print(f"[parser] 文件不存在: {path}", file=sys.stderr)
        return 2
    text = path.read_text(encoding="utf-8")
    data = parse_screenplay(text)

    out = json.dumps(data, ensure_ascii=False, indent=args.indent)
    if args.output:
        op = Path(args.output)
        op.parent.mkdir(parents=True, exist_ok=True)
        op.write_text(out, encoding="utf-8")
        print(f"[parser] ✓ 已写出 {op}  ({data['_stats']})", file=sys.stderr)
    else:
        print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
