"""音乐引擎 —— ACE-Step（BGM 生成）+ CLAP（本地版权库检索）。

调研 §S8 策略：CLAP 先在本地版权曲库检索 top-3；库覆盖薄时用 ACE-Step 生成定制床乐
（固定 motif/seed 跨集保持一致）。硬切同步点用库内 one-shot SFX。
装配阶段对 BGM 做 sidechain ducking 避对白（见 assemble.mix_episode_audio_cmd）。

许可：ACE-Step1.5=MIT，ACE-Step-v1-3.5B=Apache，CLAP=Apache —— 均可商用。
延迟导入，模块无 GPU 依赖也能 import。
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

log = logging.getLogger("engines.music")


@dataclass
class MusicEngine:
    ace_model_dir: str
    clap_model_dir: Optional[str] = None
    library_dir: Optional[str] = None     # 本地版权曲库（wav/flac）
    device: str = "cuda:7"
    _ace: object = field(default=None, repr=False)
    _clap: object = field(default=None, repr=False)

    def load_clap(self):
        if self._clap is None and self.clap_model_dir:
            from transformers import ClapModel, ClapProcessor
            self._clap = (ClapModel.from_pretrained(self.clap_model_dir).to(self.device),
                          ClapProcessor.from_pretrained(self.clap_model_dir))
        return self._clap

    def search_library(self, tag_text: str, top_k: int = 3) -> list[dict]:
        """CLAP 文本->音频检索本地曲库，返回 [{path, score}]。库为空则返回 []。"""
        if not (self.library_dir and Path(self.library_dir).exists()):
            return []
        loaded = self.load_clap()
        if loaded is None:
            return []
        model, proc = loaded
        import torch
        import torchaudio
        cands = list(Path(self.library_dir).rglob("*.wav")) + list(Path(self.library_dir).rglob("*.flac"))
        if not cands:
            return []
        results = []
        with torch.no_grad():
            text_inputs = proc(text=[tag_text], return_tensors="pt", padding=True).to(self.device)
            text_feat = model.get_text_features(**text_inputs)
            for c in cands:
                wav, sr = torchaudio.load(str(c))
                if sr != 48000:
                    wav = torchaudio.functional.resample(wav, sr, 48000)
                a = proc(audios=wav, return_tensors="pt", sampling_rate=48000).to(self.device)
                audio_feat = model.get_audio_features(**a)
                score = (text_feat @ audio_feat.T).item()
                results.append({"path": str(c), "score": score})
        results.sort(key=lambda x: -x["score"])
        return results[:top_k]

    def generate(
        self,
        prompt: str,
        out_path: Path | str,
        seconds: float = 8.0,
        seed: int = 0,
        negative_prompt: str = "vocals, lyrics, singing",
    ) -> Path:
        """ACE-Step 生成定制 BGM 床乐（纯器乐）。"""
        out_path = Path(out_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        if self._ace is None:
            from diffusers import AceStepPipeline
            import torch
            self._ace = AceStepPipeline.from_pretrained(self.ace_model_dir,
                                                        torch_dtype=torch.bfloat16).to(self.device)
        import torch
        gen = torch.Generator(device=self.device).manual_seed(seed)
        audio = self._ace(
            prompt=prompt, negative_prompt=negative_prompt,
            duration=seconds, generator=gen,
        ).audios[0]
        import torchaudio
        torchaudio.save(str(out_path), torch.from_numpy(audio).unsqueeze(0)
                        if hasattr(audio, "shape") else audio, 48000)
        log.info("BGM 生成 -> %s (seed=%d, %.1fs)", out_path, seed, seconds)
        return out_path
