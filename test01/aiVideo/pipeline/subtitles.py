"""字幕生成 (Stage 7) —— 模型无关的确定性装配层。

短剧字幕的两个特点：
  1. **大字号、居中偏下、描边**，竖屏观看要清晰；
  2. 常带"说话人名 + 台词"，OS/旁白用不同样式区分。

本模块把带时间戳的对白 (来自 TTS 的 word/sentence timestamps，或 ASR 对齐) 生成
SRT + ASS 两种字幕：SRT 便于外挂/编辑，ASS 用于烧录 (burn-in) 精确控制样式。

时间戳来源（由上游 Stage 6 TTS 回填，或 Stage 7b ASR 对齐）：
    line = {"speaker": "顾沉", "text": "...", "start": 1.23, "end": 3.45, "kind": "dialogue"}

若上游没有精确时间戳，可用 estimate_timings() 按字数 + 语速粗略铺排，保证不断流。
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional

# --------------------------------------------------------------------------- #
# 时间格式化
# --------------------------------------------------------------------------- #


def _fmt_srt_time(t: float) -> str:
    if t < 0:
        t = 0.0
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _fmt_ass_time(t: float) -> str:
    if t < 0:
        t = 0.0
    cs = int(round(t * 100))
    h, cs = divmod(cs, 360_000)
    m, cs = divmod(cs, 6_000)
    s, cs = divmod(cs, 100)
    return f"{h:d}:{m:02d}:{s:02d}.{cs:02d}"


# --------------------------------------------------------------------------- #
# 粗略时间铺排（无精确时间戳时兜底）
# --------------------------------------------------------------------------- #

# 中文播报语速：约 4.5 字/秒（对白），OS/旁白略慢
_CHARS_PER_SEC = 4.5
_MIN_DUR = 1.0
_MAX_DUR = 6.0


def estimate_timings(
    lines: list[dict],
    start: float = 0.0,
    gap: float = 0.15,
    chars_per_sec: float = _CHARS_PER_SEC,
) -> list[dict]:
    """为没有时间戳的对白按字数顺序铺排 start/end。返回新列表（不修改入参）。"""
    t = start
    out = []
    for ln in lines:
        text = (ln.get("text") or "").strip()
        n = max(1, len(text))
        dur = min(_MAX_DUR, max(_MIN_DUR, n / chars_per_sec))
        new = dict(ln)
        new.setdefault("start", round(t, 3))
        new["start"] = round(t, 3)
        new["end"] = round(t + dur, 3)
        out.append(new)
        t += dur + gap
    return out


# --------------------------------------------------------------------------- #
# SRT
# --------------------------------------------------------------------------- #


def build_srt(lines: Iterable[dict], show_speaker: bool = True) -> str:
    """lines: [{text, start, end, speaker?, kind?}] -> SRT 文本。"""
    blocks = []
    for i, ln in enumerate(lines, 1):
        text = (ln.get("text") or "").strip()
        if not text:
            continue
        start = _fmt_srt_time(float(ln.get("start", 0.0)))
        end = _fmt_srt_time(float(ln.get("end", 0.0)))
        speaker = ln.get("speaker")
        kind = ln.get("kind", "dialogue")
        prefix = ""
        if show_speaker and speaker and kind in ("dialogue",):
            prefix = f"{speaker}：\n"
        elif kind in ("os", "vo", "narration"):
            label = {"os": "内心", "vo": "画外音", "narration": "旁白"}.get(kind, "")
            if show_speaker and speaker and label:
                prefix = f"{speaker}（{label}）：\n"
            elif label:
                prefix = f"（{label}）\n"
        blocks.append(f"{i}\n{start} --> {end}\n{prefix}{text}\n")
    return "\n".join(blocks)


# --------------------------------------------------------------------------- #
# ASS（用于烧录，短剧大字幕样式）
# --------------------------------------------------------------------------- #

# 竖屏 9:16 默认分辨率（脚本坐标），实际渲染按视频尺寸缩放
_ASS_HEADER = """[Script Info]
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: {resx}
PlayResY: {resy}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Dialogue,{font},{fs},&H00FFFFFF,&H000000FF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,{outline},{shadow},2,{margin},{margin},{marginv},1
Style: OS,{font},{fs_os},&H00E8F0FF,&H000000FF,&H00303030,&H80000000,-1,-1,0,0,100,100,0,0,1,{outline},{shadow},2,{margin},{margin},{marginv},1
Style: Title,{font},{fs_title},&H0000E5FF,&H000000FF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,{outline},{shadow},5,{margin},{margin},120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def build_ass(
    lines: Iterable[dict],
    resx: int = 1080,
    resy: int = 1920,
    font: str = "Source Han Sans SC",
    show_speaker: bool = True,
) -> str:
    """生成 ASS 字幕。对白用 Dialogue 样式，OS/VO/旁白用 OS 样式（斜体+浅蓝）。"""
    fs = max(38, resy // 26)          # 对白字号（大）
    fs_os = max(34, resy // 30)       # OS 略小
    fs_title = max(52, resy // 18)
    header = _ASS_HEADER.format(
        resx=resx, resy=resy, font=font,
        fs=fs, fs_os=fs_os, fs_title=fs_title,
        outline=max(2, fs // 14), shadow=1,
        margin=int(resx * 0.06), marginv=int(resy * 0.12),
    )
    events = []
    for ln in lines:
        text = (ln.get("text") or "").strip()
        if not text:
            continue
        start = _fmt_ass_time(float(ln.get("start", 0.0)))
        end = _fmt_ass_time(float(ln.get("end", 0.0)))
        kind = ln.get("kind", "dialogue")
        speaker = ln.get("speaker")
        style = "OS" if kind in ("os", "vo", "narration", "subtitle") else "Dialogue"
        # ASS 转义换行
        body = text.replace("\n", "\\N")
        if show_speaker and speaker and kind == "dialogue":
            body = f"{speaker}：{body}"
        elif show_speaker and speaker and kind in ("os", "vo"):
            label = {"os": "内心", "vo": "画外音"}.get(kind, "")
            body = f"{speaker}（{label}）：{body}"
        events.append(f"Dialogue: 0,{start},{end},{style},,0,0,0,,{body}")
    return header + "\n".join(events) + "\n"


# --------------------------------------------------------------------------- #
# 便捷：从 episode dict 直接产出 srt/ass 文件
# --------------------------------------------------------------------------- #


def write_subtitles(
    lines: list[dict],
    out_dir: Path | str,
    stem: str,
    resx: int = 1080,
    resy: int = 1920,
    font: str = "Source Han Sans SC",
    show_speaker: bool = True,
    auto_time: bool = True,
) -> dict[str, str]:
    """写出 <stem>.srt 和 <stem>.ass，返回路径字典。缺时间戳时自动铺排。"""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    timed = lines
    if auto_time and any("start" not in ln or "end" not in ln for ln in lines):
        timed = estimate_timings(lines)
    srt_path = out_dir / f"{stem}.srt"
    ass_path = out_dir / f"{stem}.ass"
    srt_path.write_text(build_srt(timed, show_speaker=show_speaker), encoding="utf-8")
    ass_path.write_text(
        build_ass(timed, resx=resx, resy=resy, font=font, show_speaker=show_speaker),
        encoding="utf-8",
    )
    return {"srt": str(srt_path), "ass": str(ass_path), "timed_lines": timed}


if __name__ == "__main__":
    # 自测：无时间戳 -> 自动铺排 -> 生成字幕
    demo = [
        {"speaker": "顾沉", "text": "想清楚了？签了，就没有回头路。", "kind": "dialogue", "emotion": "冷淡"},
        {"speaker": "林晚", "text": "我签。", "kind": "dialogue", "emotion": "倔强"},
        {"speaker": "林晚", "text": "只要领了这本证，妈妈的手术费就有了。", "kind": "os"},
    ]
    res = write_subtitles(demo, Path("out/subs_demo"), "ep01")
    timed = res.pop("timed_lines")
    print(json.dumps({"files": res, "timings": [(t["speaker"], t["start"], t["end"]) for t in timed]}, ensure_ascii=False, indent=2))
