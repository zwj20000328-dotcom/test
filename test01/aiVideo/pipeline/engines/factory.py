"""引擎工厂 —— 从 config/models.yaml + 环境变量构造真实模型引擎。

这是"服务器接线"的唯一落点：run.py 与 pipeline/tasks.py 都调用 build_engines()，
不再各自写死空 dict。本机（无 GPU/无模型）调用时会因缺少权重目录而跳过对应引擎，
返回的 dict 缺哪个键，build_stages() 就跳过哪个阶段（并 warning）。

配置来源（优先级从高到低）：
  1. 环境变量（AIVIDEO_LLM_BASE_URL / AIVIDEO_MODEL_ROOT / ...）
  2. config/models.yaml 的 meta.model_root 与各模型 local_dir
  3. 内置默认（/data/models）

用法：
    from pipeline.engines.factory import build_engines
    engines = build_engines()          # 只构造可用的
    engines = build_engines(only=["llm", "tts"])
    engines = build_engines(stubs=True)  # 全部用占位引擎（本机验证控制流）
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

log = logging.getLogger("engines.factory")

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
_DEFAULT_MANIFEST = _REPO_ROOT / "config" / "models.yaml"


# --------------------------------------------------------------------------- #
# 配置解析
# --------------------------------------------------------------------------- #


def _load_manifest(path: Path | str | None = None) -> dict:
    import yaml
    p = Path(path) if path else _DEFAULT_MANIFEST
    if not p.exists():
        log.warning("模型清单不存在：%s（用内置默认路径）", p)
        return {}
    return yaml.safe_load(p.read_text(encoding="utf-8")) or {}


def _model_dir(manifest: dict, subsystem: str, name_hint: str,
               model_root: str) -> Optional[str]:
    """在 manifest 的某个子系统里按 local_dir 关键词找模型目录，返回绝对路径。"""
    for entry in manifest.get(subsystem, []) or []:
        local = entry.get("local_dir", "")
        if name_hint.lower() in local.lower():
            p = Path(model_root) / local
            return str(p)
    return None


def resolve_model_root(manifest: dict) -> str:
    return (os.environ.get("AIVIDEO_MODEL_ROOT")
            or (manifest.get("meta") or {}).get("model_root")
            or "/data/models")


# --------------------------------------------------------------------------- #
# CUDA 设备重映射（关键：Celery worker 用 CUDA_VISIBLE_DEVICES 钉绑物理卡）
# --------------------------------------------------------------------------- #


def normalize_device(spec: str) -> str:
    """把物理卡号重映射为进程内可见的逻辑卡号。

    为什么必须做这件事：scripts/start_services.sh 给每个 worker 钉了
    CUDA_VISIBLE_DEVICES（例如 video worker 是 "3,4"）。在该进程内 torch **只能看到
    2 张卡，索引是 cuda:0 / cuda:1**，物理 3、4 号并不存在。若直接把 "cuda:3" 传给
    .to()，会抛 "CUDA error: invalid device ordinal"，worker 起不来。

    规则：
      - CUDA_VISIBLE_DEVICES 未设置（如 run.py 单进程、8 卡全可见）→ 原样返回，
        此时绝对卡号是对的。
      - 已设置 → 按物理卡号在列表中的**位置**重映射：
          "3,4" 时  cuda:3→cuda:0, cuda:4→cuda:1
          "7"   时  cuda:7→cuda:0
          "1"   时  cuda:1→cuda:0
      - 请求的物理卡不在可见列表里 → 记 warning 并回落到 cuda:0（可见列表首张），
        而不是抛异常让整个 worker 挂掉。
      - "cpu" 与非 cuda 设备原样返回。
    """
    visible = os.environ.get("CUDA_VISIBLE_DEVICES")
    if not spec or not spec.startswith("cuda"):
        return spec
    if visible is None or visible.strip() == "":
        return spec

    phys = [p.strip() for p in visible.split(",") if p.strip() != ""]
    if not phys:
        return spec

    # 取出 spec 里的卡号；"cuda" 无编号时视作 0
    tail = spec.split(":", 1)[1] if ":" in spec else "0"
    try:
        want = tail.strip()
    except Exception:  # noqa: BLE001
        want = "0"

    if want in phys:
        return f"cuda:{phys.index(want)}"

    log.warning("请求的 %s 不在 CUDA_VISIBLE_DEVICES=%s 内，回落到 cuda:0", spec, visible)
    return "cuda:0"


def normalize_devices(specs: tuple | list) -> tuple:
    """批量重映射，并去重保持顺序。"""
    seen, out = set(), []
    for s in specs:
        n = normalize_device(s)
        if n not in seen:
            seen.add(n)
            out.append(n)
    return tuple(out)


# --------------------------------------------------------------------------- #
# 各引擎构造
# --------------------------------------------------------------------------- #


def _build_llm(manifest: dict, model_root: str) -> Optional[object]:
    """vLLM OpenAI 兼容端点（GPU0 常驻，由 scripts/start_services.sh 启动）。"""
    base_url = os.environ.get("AIVIDEO_LLM_BASE_URL") or os.environ.get("LLM_BASE_URL")
    if not base_url:
        base_url = "http://localhost:8000/v1"
    from .llm import VLLMEngine
    eng = VLLMEngine(base_url=base_url,
                     model=os.environ.get("AIVIDEO_LLM_MODEL", "qwen3-32b"))
    if not eng.health():
        log.warning("vLLM 端点不可达（%s）—— 跳过 llm 引擎。"
                    "先跑 scripts/start_services.sh 或设 AIVIDEO_LLM_BASE_URL。", base_url)
        return None
    log.info("✓ llm 引擎：%s (%s)", base_url, eng.model)
    return eng


def _build_image(manifest: dict, model_root: str) -> Optional[object]:
    from .image import QwenImageEngine
    base = _model_dir(manifest, "image", "Qwen-Image-2.1", model_root)
    edit = _model_dir(manifest, "image", "Qwen-Image-Edit", model_root)
    if not base or not Path(base).exists():
        log.warning("Qwen-Image-2.1 权重未找到（期望 %s）—— 跳过 image 引擎。", base)
        return None
    dev = normalize_device(os.environ.get("AIVIDEO_IMAGE_DEVICE", "cuda:1"))
    log.info("✓ image 引擎：%s @ %s", base, dev)
    return QwenImageEngine(model_dir=base, edit_model_dir=edit, device=dev)


def _build_video(manifest: dict, model_root: str) -> Optional[object]:
    from .video import WanVideoEngine
    mode = os.environ.get("AIVIDEO_VIDEO_MODE", "final")   # final | preview | perform
    hint = {"final": "Wan2.2-I2V-A14B", "preview": "Wan2.2-TI2V-5B",
            "perform": "Wan2.2-Animate2"}.get(mode, "Wan2.2-I2V-A14B")
    d = _model_dir(manifest, "video", hint, model_root)
    if not d or not Path(d).exists():
        log.warning("视频模型权重未找到（期望 %s，mode=%s）—— 跳过 video 引擎。", d, mode)
        return None
    devices = normalize_devices(tuple(x.strip() for x in
                    os.environ.get("AIVIDEO_VIDEO_DEVICES", "cuda:3,cuda:4").split(",")))
    log.info("✓ video 引擎：%s mode=%s devices=%s", d, mode, devices)
    return WanVideoEngine(model_dir=d, mode=mode, devices=devices)


def _build_tts(manifest: dict, model_root: str) -> Optional[object]:
    from .tts import CosyVoiceEngine
    d = _model_dir(manifest, "tts", "CosyVoice2", model_root)
    if not d or not Path(d).exists():
        log.warning("CosyVoice2 权重未找到（期望 %s）—— 跳过 tts 引擎。", d)
        return None
    dev = normalize_device(os.environ.get("AIVIDEO_TTS_DEVICE", "cuda:7"))
    spk_dir = os.environ.get("AIVIDEO_SPK_INFO_DIR")
    log.info("✓ tts 引擎：%s @ %s", d, dev)
    return CosyVoiceEngine(model_dir=d, spk_info_dir=spk_dir, device=dev)


def _build_music(manifest: dict, model_root: str) -> Optional[object]:
    from .music import MusicEngine
    d = _model_dir(manifest, "music", "AceStep15", model_root) \
        or _model_dir(manifest, "music", "ACE-Step", model_root)
    if not d or not Path(d).exists():
        log.warning("ACE-Step 权重未找到（期望 %s）—— 跳过 music 引擎。", d)
        return None
    clap = _model_dir(manifest, "music", "clap", model_root)
    lib = os.environ.get("AIVIDEO_BGM_LIBRARY")
    dev = normalize_device(os.environ.get("AIVIDEO_MUSIC_DEVICE", "cuda:7"))
    log.info("✓ music 引擎：%s @ %s（曲库：%s）", d, dev, lib or "无，将全部生成")
    return MusicEngine(ace_model_dir=d, clap_model_dir=clap, library_dir=lib, device=dev)


def _build_video_preview(manifest: dict, model_root: str) -> Optional[object]:
    """预览档引擎：Wan2.2-TI2V-5B，480p，每卡一 worker（8 路）校时校运镜。

    与终渲 A14B 是不同模型，故单独构造。preview 是可选阶段，缺此引擎不影响终渲。
    """
    from .video import WanVideoEngine
    d = _model_dir(manifest, "video", "TI2V-5B", model_root)
    if not d or not Path(d).exists():
        log.info("Wan2.2-TI2V-5B 未找到（%s）—— preview 阶段将复用终渲引擎或跳过。", d)
        return None
    dev = normalize_device(os.environ.get("AIVIDEO_PREVIEW_DEVICE", "cuda:0"))
    log.info("✓ video_preview 引擎：%s @ %s", d, dev)
    return WanVideoEngine(model_dir=d, mode="preview", devices=(dev,),
                          height=832, width=480, num_frames=81)


_BUILDERS = {
    "llm": _build_llm,
    "image": _build_image,
    "video": _build_video,
    "video_preview": _build_video_preview,
    "tts": _build_tts,
    "music": _build_music,
}


# --------------------------------------------------------------------------- #
# 入口
# --------------------------------------------------------------------------- #


def build_engines(
    only: Optional[list[str]] = None,
    stubs: bool = False,
    manifest_path: Path | str | None = None,
) -> dict:
    """构造可用引擎字典。缺失的引擎不出现在返回值里（调用方据此跳过对应阶段）。

    stubs=True：全部返回占位引擎，用于本机验证控制流。
    only：只构造指定引擎（如 ["llm"] 只起分镜阶段）。
    """
    if stubs:
        from ..stages.base import StubEngine
        s = StubEngine()
        return {"llm": s, "image": s, "video": s, "tts": s, "music": s}

    manifest = _load_manifest(manifest_path)
    model_root = resolve_model_root(manifest)
    log.info("模型根目录：%s", model_root)

    engines: dict = {}
    for name, builder in _BUILDERS.items():
        if only and name not in only:
            continue
        try:
            eng = builder(manifest, model_root)
        except Exception as e:  # noqa: BLE001
            log.error("构造 %s 引擎失败：%s", name, e)
            eng = None
        if eng is not None:
            engines[name] = eng

    if not engines:
        log.warning("没有任何引擎可用。检查：模型是否已下载（scripts/download_models.sh）、"
                    "服务是否已启动（scripts/start_services.sh）、AIVIDEO_MODEL_ROOT 是否正确。")
    return engines
