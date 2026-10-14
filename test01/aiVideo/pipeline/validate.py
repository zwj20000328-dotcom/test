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
    speaker_names: set[str] = set()
    episode_seconds_hits: list[tuple[int, float]] = []

    for i in range(body_start, n):
        raw = lines[i]
        ln_no = i + 1
        line = raw.rstrip()
        s = line.strip()
        if not s:
            continue

        # H1
        if m := _H1.match(line):
            h1_lines.append(ln_no)
            in_char_table = False
            continue
        # H4+ 误用
        if m := _H4PLUS.match(line):
            rep.add(ERROR, ln_no, "HEADING_TOO_DEEP",
                    f"使用了 {'#' * (line.index('#') ) if False else '####+'} 级标题写场景/内容，解析器不识别",
                    "场景请用 ### （三级）")
            continue
        # H2
        if m := _H2.match(line):
            # 收尾上一个场景
            if current_scene_line is not None:
                _check_scene(rep, current_scene_line, current_scene_has_content, current_scene_has_shot)
            heading = m.group(1).strip()
            in_char_table = ("角色" in heading) or ("人物" in heading) or ("character" in heading.lower())
            if not in_char_table:
                # 记录一个 "集"
                pass
            current_scene_line = None
            current_scene_has_content = False
            current_scene_has_shot = False
            continue
        # H3 场景
        if m := _H3.match(line):
            if current_scene_line is not None:
                _check_scene(rep, current_scene_line, current_scene_has_content, current_scene_has_shot)
            scene_count += 1
            heading = m.group(1).strip()
            current_scene_line = ln_no
            current_scene_has_content = False
            current_scene_has_shot = False
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
            if m := _CHAR_BULLET.match(line):
                name = m.group(1).strip()
                desc = m.group(2).strip()
                char_names.add(name)
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
            if m := _FIELD.match(line):
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
            if m := _QUOTE.match(line):
                content = m.group(1).strip()
                current_scene_has_content = True
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
            # 其它正文（镜头描述）
            current_scene_has_content = True
            continue

    # 收尾最后一个场景
    if current_scene_line is not None:
        _check_scene(rep, current_scene_line, current_scene_has_content, current_scene_has_shot)

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


def _check_scene(rep: Report, line: int, has_content: bool, has_shot: bool) -> None:
    if not has_content:
        rep.add(ERROR, line, "EMPTY_SCENE", "场景内没有任何对白/动作/镜头描述", "至少写一句 > 对白或一个 **镜头**")


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
