"""GPU 阶段的引擎接口 + Stub 实现（用于本机无 GPU 时验证控制面）。

真实引擎（vLLMEngine / QwenImageEngine / WanVideoEngine / CosyVoiceEngine / AceStepEngine）
在服务器部署时提供；它们实现同样的接口，编排器与 stage 代码不变。

接口约定（每个引擎一个方法，输入输出都是普通 dict/bytes，便于跨进程序列化）：
  LLMEngine.generate(prompt, schema=None, **kw) -> str | dict
  ImageEngine.generate(prompt, ref_images=[], seed=0, w=, h=) -> PNG bytes/path
  VideoEngine.generate(image, motion_prompt, seed, frames, fps) -> mp4 path
  TTSEngine.synthesize(text, spk_id, emotion, speed) -> wav path + timestamps
  MusicEngine.generate(tags, seconds, seed) -> wav path
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from ..contracts import Shot, ShotStatus
from ..orchestrator import StageContext


@dataclass
class StubEngine:
    """占位引擎：不调用任何模型，只生成确定性占位产物 + 推进状态。

    用途：在本机（无 GPU）验证 orchestrator/manifest/装配 的端到端控制流。
    产物是有效的最小占位文件（如 1x1 PNG、静音 wav），保证下游 ffmpeg 不崩。
    """
    kind: str = "stub"

    def generate(self, prompt: str, **kw) -> dict:
        # LLM stub：返回一个最小合法的分镜 prompt 结构
        return {
            "visual_prompt_en": f"vertical 9:16 cinematic still, {prompt[:60]}",
            "motion_prompt_en": "slow push-in, subtle character motion",
            "est_seconds": 5.0,
            "num_frames": 81,
        }

    def image(self, prompt: str, out_path: Path, **kw) -> Path:
        _write_min_png(out_path)
        return out_path

    def video(self, image_path: Path, out_path: Path, seconds: float = 5.0, **kw) -> Path:
        out_path.write_bytes(_STUB_MP4_HEADER)   # 占位；真实由 Wan 生成
        return out_path

    def tts(self, text: str, out_path: Path, **kw) -> dict:
        _write_min_wav(out_path, seconds=max(0.5, len(text) / 4.5))
        return {"audio_path": str(out_path), "word_timestamps": []}

    def music(self, out_path: Path, seconds: float = 8.0, **kw) -> Path:
        _write_min_wav(out_path, seconds=seconds)
        return out_path


class NullStage:
    """通用 Stub 阶段：把 shot 从 consumes 推进到 produces，写占位产物并**回填契约字段**。

    用于本机跑通全流程；生产用各真实 Stage 替换。回填哪个字段由 path_field 决定，
    使下游阶段（如 assemble 读 clip_path）拿到有效输入，真正验证控制流。
    """
    def __init__(self, name: str, consumes: tuple, produces: ShotStatus,
                 engine: Any = None, artifact_dir: str = "drafts",
                 path_field: Optional[str] = None, ext: str = ".bin",
                 write_artifact: bool = True):
        self.name = name
        self.consumes = tuple(consumes)
        self.produces = produces
        self.engine = engine or StubEngine()
        self.artifact_dir = artifact_dir
        self.path_field = path_field
        self.ext = ext
        self.write_artifact = write_artifact

    def run_shot(self, shot: Shot, ctx: StageContext) -> ShotStatus:
        if ctx.dry_run:
            # dry-run：回填“将要生成”的路径（不写文件），让下游阶段的状态流转可被完整模拟
            self._backfill_prompts(shot)
            if self.path_field:
                setattr(shot, self.path_field, str(ctx.project_dir / self.artifact_dir / f"{shot.id}{self.ext}"))
            if self.name == "tts":
                for l in shot.lines:
                    l.start, l.end = (l.start or 0.0), (l.end or 1.0)
                shot.audio_path = str(ctx.project_dir / self.artifact_dir / f"{shot.id}.wav")
            shot.artifacts.model = f"stub:{self.name}"
            return self.produces

        out = None
        if self.write_artifact:
            # 写一个占位产物到该阶段目录，并回填对应契约字段
            out = ctx.path(self.artifact_dir, f"{shot.id}{self.ext}")
            if self.ext == ".png":
                _write_min_png(out)
            elif self.ext == ".wav":
                _write_min_wav(out, seconds=max(0.5, sum(len(l.text) for l in shot.lines) / 4.5))
            else:
                out.write_bytes(_STUB_MP4_HEADER if self.ext == ".mp4" else b"stub")
            if self.path_field:
                setattr(shot, self.path_field, str(out))

        # TTS stub：额外给每句对白铺排时间戳，让字幕阶段拿到真实结构
        if self.name == "tts" and shot.lines:
            from ..subtitles import estimate_timings
            if out is None:
                out = ctx.path(self.artifact_dir, f"{shot.id}.wav")
                _write_min_wav(out, seconds=max(0.5, sum(len(l.text) for l in shot.lines) / 4.5))
            timed = estimate_timings([{"speaker": l.speaker, "text": l.text,
                                       "kind": l.kind.value} for l in shot.lines])
            for l, t in zip(shot.lines, timed):
                l.audio_path = str(out)
                l.start = t["start"]
                l.end = t["end"]
            shot.audio_path = str(out)

        self._backfill_prompts(shot)
        shot.artifacts.model = f"stub:{self.name}"
        return self.produces

    def _backfill_prompts(self, shot: Shot) -> None:
        if self.name == "enrich":
            r = self.engine.generate(shot.camera or shot.action or (shot.lines[0].text if shot.lines else ""))
            shot.visual_prompt_en = r.get("visual_prompt_en")
            shot.motion_prompt_en = r.get("motion_prompt_en")
            shot.est_seconds = r.get("est_seconds")
            shot.num_frames = r.get("num_frames")


# --------------------------------------------------------------------------- #
# 最小合法占位文件（保证 ffmpeg/PIL 不崩）
# --------------------------------------------------------------------------- #

# 1x1 透明 PNG
_MIN_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000a49444154789c6300010000050001"
    "0d0a2db40000000049454e44ae426082"
)


def _write_min_png(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(_MIN_PNG)


# 极简 MP4 占位（非真实视频，仅占位；生产由 Wan 输出）
_STUB_MP4_HEADER = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom"


def _write_min_wav(path: Path, seconds: float = 1.0, rate: int = 24000) -> None:
    """写一段静音 WAV（PCM16 mono），保证 ffmpeg 能读。"""
    import wave
    path.parent.mkdir(parents=True, exist_ok=True)
    n = int(rate * max(0.1, seconds))
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"\x00\x00" * n)


def prompt_hash(*parts: str) -> str:
    h = hashlib.sha256()
    for p in parts:
        h.update((p or "").encode("utf-8"))
        h.update(b"\x00")
    return h.hexdigest()[:16]
