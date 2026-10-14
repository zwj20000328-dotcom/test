"""流水线阶段适配器集合 (S2-S10)。

每个 stage 实现 orchestrator.Stage 协议。分两类：
- **CPU 阶段**（subtitle / assemble / concat）：纯 ffmpeg/文本，任何机器可跑、可单测。
- **GPU 阶段**（enrich / assets / keyframe / video / tts / bgm）：通过 engine 适配器
  调用真实模型（vLLM / DiffSynth / CosyVoice …）。本机无 GPU 时用 StubEngine，
  只推进状态、写占位产物，便于验证控制面与数据契约。

真实 stage（服务器用，注入 engines/*）：
  EnrichStage(LLM)  AssetsStage(Image,TTS,LoRA)  KeyframeStage(Image,QC)
  VideoStage(Video)  TTSStage(TTS)  BGMStage(Music)
占位 stage（本机验证控制面）：
  NullStage  + StubEngine
"""
from .base import StubEngine, NullStage
from .subtitle import SubtitleStage
from .assemble import AssembleStage, ConcatStage
from .enrich import EnrichStage
from .assets import AssetsStage
from .keyframe import KeyframeStage
from .video import VideoStage, PreviewStage
from .tts import TTSStage
from .bgm import BGMStage

__all__ = [
    "StubEngine", "NullStage",
    "SubtitleStage", "AssembleStage", "ConcatStage",
    "EnrichStage", "AssetsStage", "KeyframeStage",
    "VideoStage", "PreviewStage", "TTSStage", "BGMStage",
]
