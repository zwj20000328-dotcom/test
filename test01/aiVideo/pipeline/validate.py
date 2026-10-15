"""剧本格式校验器 (linter) —— 在进入流水线前抓出会导致解析错误/降质的写法。

对每个问题给出：行号 + 级别 (error/warning) + 修复建议。
error 会导致解析失败或成片明显错误，必须修；warning 只是降质，可忽略。

用法：
    python -m pipeline.validate examples/sample_screenplay.md
    python -m pipeline.validate script.md --json      # 机器可读
退出码：0=通过(可能有 warning)，1=有 error，2=文件/用法错误。
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from .parser import CANONICAL_FIELDS, normalize_field_key

ERROR = "error"
WARN = "warning"


@dataclass
class Issue:
    level: str
    line: int
    code: str
    msg: str
    fix: str = ""

    def to_dict(self) -> dict:
        return {"level": self.level, "line": self.line, "code": self.code, "msg": self.msg, "fix": self.fix}


@dataclass
class Report:
    path: str
    issues: list[Issue] = field(default_factory=list)

    def add(self, level: str, line: int, code: str, msg: str, fix: str = "") -> None:
        self.issues.append(Issue(level, line, code, msg, fix))

    @property
    def errors(self) -> list[Issue]:
        return [i for i in self.issues if i.level == ERROR]

    @property
    def warnings(self) -> list[Issue]:
        return [i for i in self.issues if i.level == WARN]

    @property
    def ok(self) -> bool:
        return not self.errors


_FM_RE = re.compile(r"^---\s*$")
_H1 = re.compile(r"^#\s+(.*)$")
_H2 = re.compile(r"^##\s+(.*)$")
_H3 = re.compile(r"^###\s+(.*)$")
_H4PLUS = re.compile(r"^####+\s+(.*)$")
_QUOTE = re.compile(r"^>\s?(.*)$")
_FIELD = re.compile(r"^\*\*\s*(.+?)\s*\*\*\s*[:：]\s*(.*)$")
_CHAR_BULLET = re.compile(r"^[-*]\s*\*\*(.+?)\*\*\s*[:：]\s*(.*)$")

_KNOWN_TIME_WORDS = ("白天", "夜", "晨", "傍晚", "黄昏", "清晨", "午后", "深夜", "凌晨",
                     "早上", "晚上", "中午", "翌日", "日", "内", "外")
_SPEAKER_RE = re.compile(r"^([^:：]{1,20})[:：]\s*(.+)$")

# 漏加粗的字段名（写成 "环境：雨夜" 而非 "**环境**：雨夜"）——这些不是台词，
# 不应触发 PROSE_DIALOGUE（否则会误报）。
_FIELD_WORDS = {"人物", "角色", "出场人物", "环境", "场景", "场景描述", "氛围", "情绪",
                "基调", "镜头", "机位", "运镜", "画面", "动作", "表演", "音效", "声音",
                "转场", "配乐", "bgm", "BGM", "sfx", "SFX", "时间", "地点"}
# 句末标点：台词通常以这些结尾，而"环境：雨夜"这类字段不会
_SENTENCE_END = "。！？…”』」》!?'"


def _looks_like_dialogue(norm_line: str) -> bool:
    """判断一行正文是否"疑似漏写 > 的台词"（保守，尽量少误报）。

    判据（全部满足）：
      1. 形如 "说话人：内容"（_SPEAKER_RE）；
      2. 说话人短（≤12 字）、不含逗号句号顿号（真台词的说话人是人名，不是长句）；
      3. 说话人不是漏加粗的字段名（如"环境：雨夜"）；
      4. 内容以句末标点结尾（台词特征；"环境：雨夜"没有句末标点，被排除）。
    """
    m = _SPEAKER_RE.match(norm_line)
    if not m:
        return False
    speaker, content = m.group(1).strip(), m.group(2).strip()
    if not speaker or len(speaker) > 12:
        return False
    # 说话人里含标点 -> 更像描述而非人名
    if any(p in speaker for p in "，。、；,"):
        return False
    if speaker in _FIELD_WORDS:
        return False
    if not content:
        return False
    return content[-1] in _SENTENCE_END


def validate(text: str, path: str = "<string>") -> Report:
    rep = Report(path=path)
    lines = text.splitlines()
    n = len(lines)

    # ---- front-matter ----
    has_fm = bool(lines) and _FM_RE.match(lines[0])
    fm_end = -1
    if has_fm:
        for j in range(1, n):
            if _FM_RE.match(lines[j]):
                fm_end = j
                break
        if fm_end == -1:
            rep.add(ERROR, 1, "FM_UNCLOSED", "front-matter 的 --- 没有闭合", "在元信息后再加一行 ---")
    fm_block = lines[1:fm_end] if (has_fm and fm_end > 0) else []

    # aspect_ratio 引号检查
    for idx, fl in enumerate(fm_block):
        ln = idx + 2  # 实际行号（fm 从第 2 行开始）
        m = re.match(r"^\s*aspect_ratio\s*:\s*(.+?)\s*$", fl)
        if m:
            v = m.group(1)
            if re.fullmatch(r"\d+:\d+", v):
                rep.add(ERROR, ln, "ASPECT_UNQUOTED",
                        f"aspect_ratio: {v} 会被 YAML 当成六十进制整数解析",
                        f'改为 aspect_ratio: "{v}"')
        # 常见字段拼写
        mk = re.match(r"^\s*([A-Za-z_]+)\s*:", fl)
        if mk:
            key = mk.group(1)
            if key not in {"title", "genre", "style", "aspect_ratio", "language",
                           "target_episodes", "episode_seconds"}:
                rep.add(WARN, ln, "FM_UNKNOWN_KEY", f"未知的 front-matter 字段 '{key}'",
                        "确认拼写；未知字段会被忽略")

    body_start = fm_end + 1 if fm_end > 0 else 0

    # ---- 结构遍历 ----
    h1_lines: list[int] = []
    in_char_table = False
    scene_count = 0
    current_scene_line: Optional[int] = None
    current_scene_has_content = False
    current_scene_has_shot = False
    char_names: set[str] = set()
    char_first_line: dict[str, int] = {}     # 角色名 -> 首次登记行（DUP_CHARACTER 用）
    speaker_names: set[str] = set()
    episode_seconds_hits: list[tuple[int, float]] = []
    # prose 对白检测（漏写 > 的台词会静默丢进 raw_text，永不配音）
    current_scene_quote = 0
    current_scene_prose = 0
    prose_lines: list[int] = []

    for i in range(body_start, n):
        raw = lines[i]
        ln_no = i + 1
        line = raw.rstrip()
        s = line.strip()
        # 与 parser.py 保持一致：结构匹配用去掉前导空白（含全角空格 U+3000）的 norm。
        # 两边判定逻辑必须共用同一归一化，否则会出现"parser 接受但 validator 报错"的漂移。
        norm = line.lstrip()
        indented = (norm != line.rstrip()) and bool(norm)
        if not s:
            continue

        # H1
        if m := _H1.match(norm):
            h1_lines.append(ln_no)
            in_char_table = False
            continue
        # H4+ 误用
        if m := _H4PLUS.match(norm):
            rep.add(ERROR, ln_no, "HEADING_TOO_DEEP",
                    "使用了 #### 或更深的标题写场景/内容，解析器不识别",
                    "场景请用 ### （三级）")
            continue
        # H2
        if m := _H2.match(norm):
            # 收尾上一个场景
            if current_scene_line is not None:
                _check_scene(rep, current_scene_line, current_scene_has_content,
                             current_scene_has_shot, current_scene_quote,
                             list(prose_lines))
            heading = m.group(1).strip()
            in_char_table = ("角色" in heading) or ("人物" in heading) or ("character" in heading.lower())
            if not in_char_table:
                # 记录一个 "集"
                pass
            current_scene_line = None
            current_scene_has_content = False
            current_scene_has_shot = False
            current_scene_quote = 0
            prose_lines = []
            continue
        # H3 场景
        if m := _H3.match(norm):
            if current_scene_line is not None:
                _check_scene(rep, current_scene_line, current_scene_has_content,
                             current_scene_has_shot, current_scene_quote,
                             list(prose_lines))
            scene_count += 1
            heading = m.group(1).strip()
            current_scene_line = ln_no
            current_scene_has_content = False
            current_scene_has_shot = False
            current_scene_quote = 0
            prose_lines = []
            in_char_table = False
            # 场景标题应含 地点/时间/内外
            has_time = any(t in heading for t in _KNOWN_TIME_WORDS)
            has_sep = bool(re.search(r"[·|•]", heading))
            if not (has_time and has_sep):
                rep.add(WARN, ln_no, "SCENE_HEADING_LOOSE",
                        f"场景标题 '{heading}' 缺少 '地点 · 时间 · 内/外' 结构",
                        "如：### 场景 1：咖啡厅 · 白天 · 内")
            continue

        # 角色表条目
        if in_char_table:
            if m := _CHAR_BULLET.match(norm):
                name = m.group(1).strip()
                desc = m.group(2).strip()
                char_names.add(name)
                if name in char_first_line:
                    rep.add(ERROR, char_first_line[name], "DUP_CHARACTER",
                            f"角色 '{name}' 在角色表中重复登记（首次见 L{char_first_line[name]}，"
                            f"此处 L{ln_no}）",
                            "同一角色只登记一次；重名会让 identity_blob/音色锚定错配，"
                            "角色一致性直接崩坏，必须修正")
                else:
                    char_first_line[name] = ln_no
                if len(desc) < 8:
                    rep.add(WARN, ln_no, "CHAR_THIN",
                            f"角色 '{name}' 的外形描述过短，难以保证长相一致",
                            "补充发型/脸型/眼型/标志服装等")
            elif s.startswith(("#", ">")):
                pass
            else:
                # 角色表里的非条目行（如普通段落）——轻提示
                if not s.startswith(("-", "*")):
                    rep.add(WARN, ln_no, "CHARTABLE_STRAY",
                            "角色表区内出现非 '- **名字**：描述' 格式的行",
                            "角色条目请写成：- **林晚**：女，28岁……")
            continue

        # 场景内
        if current_scene_line is not None:
            # 字段标记
            if m := _FIELD.match(norm):
                key = m.group(1).strip()
                val = m.group(2).strip()
                current_scene_has_content = True
                canon = normalize_field_key(key)
                if canon == "camera":
                    current_scene_has_shot = True
                    if not val:
                        rep.add(ERROR, ln_no, "EMPTY_FIELD", f"**{key}**： 后面没有内容", "补充镜头描述")
                elif canon not in CANONICAL_FIELDS:
                    rep.add(WARN, ln_no, "FIELD_UNKNOWN",
                            f"未知字段 **{key}**：，不参与生成",
                            "改用规范字段：人物/环境/氛围/镜头/动作/音效/转场/BGM")
                elif not val:
                    rep.add(WARN, ln_no, "EMPTY_FIELD", f"**{key}**： 为空", "补充内容或删除该字段")
                continue
            # 对白
            if m := _QUOTE.match(norm):
                content = m.group(1).strip()
                current_scene_has_content = True
                current_scene_quote += 1
                if not content:
                    rep.add(WARN, ln_no, "EMPTY_LINE", "空的 > 引用行", "删除或补充台词")
                    continue
                sm = _SPEAKER_RE.match(content)
                if not sm:
                    rep.add(WARN, ln_no, "LINE_NO_SPEAKER",
                            f"对白 '{content[:12]}…' 没有 '说话人：' 前缀，将按旁白处理",
                            "写成：> 顾沉（冷淡）：想清楚了？")
                else:
                    speaker = sm.group(1).strip()
                    speaker = re.sub(r"\s*[（(].*", "", speaker).strip()
                    speaker_names.add(speaker)
                continue
            # 其它正文：可能是镜头描述，也可能是**漏写 > 的台词**（静默丢数据的高发点）
            current_scene_has_content = True
            current_scene_prose += 1
            # 形如 "说话人：台词" 的正文行 —— parser 会把它塞进 raw_text，
            # 结果这句台词永远不会被配音，而 validate 原本对此零提示。
            if _SPEAKER_RE.match(norm) and _looks_like_dialogue(norm):
                prose_lines.append(ln_no)
            continue

    # 收尾最后一个场景
    if current_scene_line is not None:
        _check_scene(rep, current_scene_line, current_scene_has_content,
                     current_scene_has_shot, current_scene_quote, list(prose_lines))

    # ---- 全局检查 ----
    if len(h1_lines) == 0:
        rep.add(ERROR, 1, "NO_H1", "缺少 '# 剧名' 一级标题", "在 front-matter 后加：# 你的剧名")
    elif len(h1_lines) > 1:
        for extra in h1_lines[1:]:
            rep.add(ERROR, extra, "MULTI_H1", "存在多个 '# 一级标题'，剧名会被覆盖", "全文件只保留 1 个 #")

    if scene_count == 0:
        rep.add(ERROR, 1, "NO_SCENE", "没有任何 '### 场景'，无法生成成片", "至少写一个 ### 场景")

    # 角色一致性：对白说话人是否在角色表/人物中出现
    declared = set(char_names)
    for sp in speaker_names:
        if sp in ("旁白", "画外音", "字幕", "内心OS", "VO", "vo", "OS", "os"):
            continue
        # 说话人可能是 "林晚（内心OS）" 已被清洗为 "林晚"
        if sp not in declared:
            # 只要角色表里有任何名字包含它、或它包含角色名，就算匹配
            if not any(sp in d or d in sp for d in declared):
                rep.add(WARN, 0, "SPEAKER_UNDECLARED",
                        f"对白说话人 '{sp}' 未在角色表登记",
                        "在 '## 角色表' 或场景 '**人物**' 中登记该角色并写清外形")

    if declared and not speaker_names:
        rep.add(WARN, 0, "NO_DIALOGUE", "剧本没有任何对白（> 行）", "短剧通常以对白驱动，请确认")

    return rep


def _check_scene(rep: Report, line: int, has_content: bool, has_shot: bool,
                 quote_lines: int = 0, prose_dialogue: Optional[list[int]] = None) -> None:
    if not has_content:
        rep.add(ERROR, line, "EMPTY_SCENE", "场景内没有任何对白/动作/镜头描述", "至少写一句 > 对白或一个 **镜头**")
    if prose_dialogue:
        # 漏写 > 的台词：parser 会静默塞进 raw_text，这句台词永远不会被配音，
        # 而成片里角色只是"张嘴没声音"或整句消失。这是最隐蔽的数据丢失。
        where = "、".join(f"L{x}" for x in prose_dialogue[:5])
        more = f" 等 {len(prose_dialogue)} 行" if len(prose_dialogue) > 5 else ""
        rep.add(ERROR, prose_dialogue[0], "PROSE_DIALOGUE",
                f"疑似台词写在正文里而未用 '>' 引用块（{where}{more}）——"
                f"解析器会把它当成镜头描述，这句台词将被静默丢弃、不会配音",
                "改为：> 说话人（情绪）：台词内容")
    elif quote_lines == 0 and has_content:
        # 整场戏一句 > 对白都没有：可能是全场景都漏写了 >，也可能确实是纯动作戏
        rep.add(WARN, line, "SCENE_NO_DIALOGUE",
                "本场景没有任何 '>' 对白行",
                "若本场应有台词，请确认每句都以 > 开头；纯动作/空镜可忽略")


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="校验 Markdown 剧本格式")
    ap.add_argument("screenplay")
    ap.add_argument("--json", action="store_true", help="以 JSON 输出")
    ap.add_argument("--strict", action="store_true", help="warning 也算失败")
    args = ap.parse_args(argv)

    p = Path(args.screenplay)
    if not p.exists():
        print(f"[validate] 文件不存在: {p}", file=sys.stderr)
        return 2
    text = p.read_text(encoding="utf-8")
    rep = validate(text, str(p))

    if args.json:
        print(json.dumps({"path": rep.path, "ok": rep.ok,
                          "errors": len(rep.errors), "warnings": len(rep.warnings),
                          "issues": [i.to_dict() for i in rep.issues]}, ensure_ascii=False, indent=2))
    else:
        _print_human(rep)

    if rep.errors or (args.strict and rep.warnings):
        return 1
    return 0


def _print_human(rep: Report) -> None:
    out = sys.stdout
    if not rep.issues:
        out.write(f"✓ {rep.path}: 校验通过，无问题。\n")
        return
    icon = {ERROR: "✗", WARN: "!"}
    out.write(f"{rep.path}: {len(rep.errors)} error, {len(rep.warnings)} warning\n")
    for i in sorted(rep.issues, key=lambda x: (x.level != ERROR, x.line)):
        loc = f"L{i.line}" if i.line else "全局"
        out.write(f"  {icon[i.level]} [{loc}] {i.code}: {i.msg}")
        if i.fix:
            out.write(f"\n      → 修复：{i.fix}")
        out.write("\n")


if __name__ == "__main__":
    # 保证 UTF-8 输出（Windows 控制台）
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore
    except Exception:
        pass
    raise SystemExit(main(sys.argv[1:]))
