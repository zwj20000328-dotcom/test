"""S6 TTS 阶段 —— 逐句合成对白，回填 audio_path + 时间戳。

按 character_manifest 的 spk_id 合成（同嗓不同情绪）。整镜的多句合成后可选拼接为一条
shot 级音频（装配阶段混音用）。OS/旁白走对应 kind 处理。
"""
from __future__ import annotations

import logging
from pathlib import Path

from ..contracts import Manifest, Shot, ShotStatus
from ..orchestrator import StageContext

log = logging.getLogger("stages.tts")


class TTSStage:
    name = "tts"
    consumes = (ShotStatus.rendered,)
    produces = ShotStatus.voiced

    def __init__(self, tts_engine):
        self.tts = tts_engine

    def run_shot(self, shot: Shot, ctx: StageContext) -> ShotStatus:
        m = ctx.manifest
        if not shot.lines:
            # 无台词镜头：不产生音频，仍推进状态
            return ShotStatus.voiced

        seg_paths: list[str] = []
        t_cursor = 0.0
        for i, ln in enumerate(shot.lines):
            text = (ln.text or "").strip()
            if not text:
                continue
            char = m.character_by_name(ln.speaker)
            spk_id = char.voice.spk_id if (char and char.voice.spk_id) else None
            out = ctx.path("voices", f"{shot.id}_l{i:02d}.wav")
            cross_lingual = ln.kind.value in ("narration",) and (m.meta.language != "zh")
            try:
                res = self.tts.synthesize(
                    text=text, out_wav=out, spk_id=spk_id,
                    emotion=ln.emotion, instruct=shot.tts_instruction,
                    cross_lingual=cross_lingual or ln.kind.value == "narration",
                )
            except Exception as e:  # noqa: BLE001
                log.error("TTS 合成失败 %s l%d：%s", shot.id, i, e)
                shot.status = ShotStatus.failed
                return ShotStatus.failed
            ln.audio_path = res["audio_path"]
            seg_paths.append(res["audio_path"])
            # 时长由音频实际时长决定；这里累加游标，精确时间戳交由字幕阶段/ASR
            dur = _wav_seconds(res["audio_path"])
            ln.start = round(t_cursor, 3)
            ln.end = round(t_cursor + dur, 3)
            t_cursor += dur + 0.12   # 句间停顿

        # 整镜合并音频（可选，装配混音用）
        if seg_paths:
            merged = ctx.path("voices", f"{shot.id}.wav")
            _concat_wav(seg_paths, merged, gap=0.12)
            shot.audio_path = str(merged)

        shot.est_seconds = max(shot.est_seconds or 0.0, t_cursor)
        shot.artifacts.model = "cosyvoice2"
        return ShotStatus.voiced


def _wav_seconds(path: str) -> float:
    import wave
    try:
        with wave.open(path, "rb") as w:
            return w.getnframes() / float(w.getframerate())
    except Exception:
        return 1.0


def _concat_wav(paths: list[str], out: Path, gap: float = 0.1) -> None:
    """按顺序拼接 wav（中间插 gap 静音），输出统一采样率的单轨。"""
    import wave
    out.parent.mkdir(parents=True, exist_ok=True)
    frames = []
    params = None
    for p in paths:
        with wave.open(p, "rb") as w:
            params = params or w.getparams()
            frames.append(w.readframes(w.getnframes()))
    if not frames:
        return
    gap_bytes = b"\x00\x00" * int(params.framerate * gap)
    with wave.open(str(out), "wb") as w:
        w.setparams(params)
        for f in frames:
            w.writeframes(f)
            w.writeframes(gap_bytes)
