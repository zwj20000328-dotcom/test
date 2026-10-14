"""图像引擎 —— Qwen-Image-2.1（关键帧）+ Qwen-Image-Edit-2511（身份保持编辑）。

角色一致性（调研四层策略的生成层）：
  - Qwen-Image-2.1 支持最多 10 张参考图：把角色 canonical sheet ± 上一合格帧作为参考，
    identity/reference 权重调参（过高复制姿势，过低漂移），固定 per-shot seed。
  - 需改姿态/表情但保身份时走 Apache 的 Qwen-Image-Edit-2511。
  - 输出 9:16 1080×1920 PNG。

底层用 diffusers QwenImagePipeline / QwenImageEditPipeline（Apache，ModelScope 直连权重）。
延迟导入，模块无 GPU 依赖也能 import。
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

log = logging.getLogger("engines.image")


@dataclass
class QwenImageEngine:
    model_dir: str
    edit_model_dir: Optional[str] = None
    device: str = "cuda:1"
    width: int = 1080
    height: int = 1920
    dtype: str = "bfloat16"
    _pipe: object = field(default=None, repr=False)
    _edit_pipe: object = field(default=None, repr=False)

    def _torch_dtype(self):
        import torch
        return {"bfloat16": torch.bfloat16, "float16": torch.float16,
                "float32": torch.float32}[self.dtype]

    def load(self):
        if self._pipe is None:
            import torch
            from diffusers import QwenImagePipeline
            self._pipe = QwenImagePipeline.from_pretrained(
                self.model_dir, torch_dtype=self._torch_dtype()
            ).to(self.device)
        return self._pipe

    def load_edit(self):
        if self._edit_pipe is None:
            if not self.edit_model_dir:
                raise RuntimeError("未配置 edit_model_dir（Qwen-Image-Edit-2511）")
            from diffusers import QwenImageEditPipeline
            self._edit_pipe = QwenImageEditPipeline.from_pretrained(
                self.edit_model_dir, torch_dtype=self._torch_dtype()
            ).to(self.device)
        return self._edit_pipe

    def generate(
        self,
        prompt: str,
        out_path: Path | str,
        negative_prompt: str = "blurry, lowres, deformed, extra fingers, watermark, text artifacts",
        ref_images: Optional[list[str]] = None,
        seed: int = 0,
        steps: int = 28,
        guidance: float = 4.0,
        identity_strength: float = 0.75,
    ) -> Path:
        """文生图 / 多参考生图，输出 PNG。

        ref_images: 角色 sheet + 上一合格帧（Qwen-Image-2.1 支持多参考做身份锚定）。
        identity_strength: 参考权重，过高复制姿势、过低漂移，0.6-0.9 之间调。
        """
        import torch
        from diffusers.utils import load_image
        pipe = self.load()
        out_path = Path(out_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)

        gen = torch.Generator(device=self.device).manual_seed(seed)
        kwargs = dict(
            prompt=prompt, negative_prompt=negative_prompt,
            width=self.width, height=self.height,
            num_inference_steps=steps, true_cfg_scale=guidance,
            generator=gen,
        )
        if ref_images:
            refs = [load_image(p) for p in ref_images if Path(p).exists()]
            if refs:
                # diffusers QwenImage 多参考：img 参数 + 强度
                kwargs["img"] = refs
                kwargs["strength"] = identity_strength
        image = pipe(**kwargs).images[0]
        image.save(str(out_path))
        log.info("关键帧 -> %s (seed=%d, refs=%d)", out_path, seed, len(ref_images or []))
        return out_path

    def edit(
        self,
        base_image: str,
        prompt: str,
        out_path: Path | str,
        seed: int = 0,
        strength: float = 0.6,
        steps: int = 20,
    ) -> Path:
        """身份保持编辑：改姿态/表情但保长相（走 Apache 的 Edit-2511）。"""
        import torch
        from diffusers.utils import load_image
        pipe = self.load_edit()
        out_path = Path(out_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        gen = torch.Generator(device=self.device).manual_seed(seed)
        image = pipe(
            image=load_image(base_image), prompt=prompt,
            num_inference_steps=steps, strength=strength, generator=gen,
        ).images[0]
        image.save(str(out_path))
        return out_path
