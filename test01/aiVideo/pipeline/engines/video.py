"""视频引擎 —— Wan2.2 图生视频（I2V）。

三档（调研 §5 拓扑）：
  preview : Wan2.2-TI2V-5B   480p，每卡一 worker（8 路），校时/校运镜
  final   : Wan2.2-I2V-A14B  720×1280，81帧@16fps≈5s，2卡 bf16 或 GGUF Q6 单卡
  perform : Wan2.2-Animate-2-14B  角色表演/动作特写/近似口型

底层优先 DiffSynth-Studio（Apache，原生从 ModelScope 拉权重，自带 A14B 40GB low-VRAM 脚本、
多卡 pipeline/sequence parallel、offload 旋钮）。也可切 diffusers WanImageToVideoPipeline。
A800=Ampere sm80 无原生 FP8：走 bf16 或 GGUF Q6 + tiled VAE 避免双专家显存尖峰 OOM。

延迟导入，模块无 GPU 依赖也能 import。
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

log = logging.getLogger("engines.video")


@dataclass
class WanVideoEngine:
    model_dir: str                       # Wan2.2-I2V-A14B / TI2V-5B 权重目录
    mode: str = "final"                  # preview | final | perform
    devices: tuple = ("cuda:3", "cuda:4")  # A14B 2卡；5B/单卡时取 devices[0]
    height: int = 1280
    width: int = 720
    num_frames: int = 81
    fps: int = 16
    tiled_vae: bool = True               # 降 VAE decode 显存尖峰
    offload: bool = True
    _pipe: object = field(default=None, repr=False)

    def load(self):
        if self._pipe is not None:
            return self._pipe
        import torch
        from diffusers import WanImageToVideoPipeline, AutoencoderKLWan
        dtype = torch.bfloat16
        vae = AutoencoderKLWan.from_pretrained(self.model_dir, subfolder="vae", torch_dtype=dtype)
        pipe = WanImageToVideoPipeline.from_pretrained(
            self.model_dir, vae=vae, torch_dtype=dtype
        )
        # 多卡/省显存：A14B 双专家用 device_map 或 enable_model_cpu_offload
        if self.offload and len(self.devices) == 1:
            pipe.enable_model_cpu_offload(gpu_id=int(self.devices[0].split(":")[-1]))
        else:
            pipe = pipe.to(self.devices[0])
        if hasattr(pipe, "vae") and self.tiled_vae:
            try:
                pipe.vae.enable_tiling()
            except Exception:  # noqa: BLE001
                pass
        self._pipe = pipe
        return pipe

    def generate(
        self,
        image_path: str,
        motion_prompt: str,
        out_path: Path | str,
        negative_prompt: str = "static, jitter, distortion, deformed limbs, watermark, lowres",
        seed: int = 0,
        steps: int = 30,
        guidance: float = 5.0,
        num_frames: Optional[int] = None,
    ) -> Path:
        """首帧图 + 运动 prompt -> 竖屏视频片段。

        Wan2.2 I2V 首帧条件强度隐式偏高；运动幅度靠 prompt 措辞与 high/low-noise 专家调度控制。
        """
        import torch
        from diffusers.utils import load_image, export_to_video
        pipe = self.load()
        out_path = Path(out_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        nf = num_frames or self.num_frames
        gen = torch.Generator(device=self.devices[0]).manual_seed(seed)
        first = load_image(image_path).resize((self.width, self.height))
        frames = pipe(
            image=first, prompt=motion_prompt, negative_prompt=negative_prompt,
            height=self.height, width=self.width, num_frames=nf,
            num_inference_steps=steps, guidance_scale=guidance, generator=gen,
        ).frames[0]
        export_to_video(frames, str(out_path), fps=self.fps)
        log.info("[%s] 视频 -> %s (seed=%d, %dx%d, %d帧)",
                 self.mode, out_path, seed, self.width, self.height, nf)
        return out_path
