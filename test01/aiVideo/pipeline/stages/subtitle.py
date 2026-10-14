"""S7 字幕阶段 —— 把已配音的对白时间戳转成 SRT + ASS（短剧大字幕）。

依赖上游 S6 TTS 回填的 shot.lines[].start/end（真实来自 CosyVoice word_timestamps）。
若上游没有时间戳，用 subtitles.estimate_timings 按字数兜底铺排，保证不断流。

这是纯 CPU 阶段，任何机器可跑、可单测。
"""
from __future__ import annotations

from ..contracts import Shot, ShotStatus
from ..orchestrator import StageContext
from ..subtitles import build_ass, build_srt, estimate_timings


class SubtitleStage:
    name = "subtitle"
    consumes = (ShotStatus.voiced,)
    produces = ShotStatus.subtitled

    def __init__(self, show_speaker: bool = True, resx: int = 1080, resy: int = 1920,
                 font: str = "Source Han Sans SC"):
        self.show_speaker = show_speaker
        self.resx = resx
        self.resy = resy
        self.font = font

    def run_shot(self, shot: Shot, ctx: StageContext) -> ShotStatus:
        # 收集本镜头所有有声台词
        lines = []
        for ln in shot.lines:
            if not (ln.text or "").strip():
                continue
            d = {"speaker": ln.speaker, "text": ln.text, "kind": ln.kind.value}
            if ln.start is not None and ln.end is not None:
                d["start"] = ln.start
                d["end"] = ln.end
            lines.append(d)
        if not lines:
            # 无台词镜头：不产生字幕，但仍标记完成
            shot.srt_path = None
            shot.ass_path = None
            return ShotStatus.subtitled

        # 缺时间戳则兜底铺排
        if any("start" not in d for d in lines):
            lines = estimate_timings(lines)

        stem = shot.id
        srt_path = ctx.path("subs", f"{stem}.srt")
        ass_path = ctx.path("subs", f"{stem}.ass")
        srt_path.write_text(build_srt(lines, show_speaker=self.show_speaker), encoding="utf-8")
        ass_path.write_text(
            build_ass(lines, resx=self.resx, resy=self.resy, font=self.font,
                      show_speaker=self.show_speaker),
            encoding="utf-8",
        )
        shot.srt_path = str(srt_path)
        shot.ass_path = str(ass_path)
        return ShotStatus.subtitled
