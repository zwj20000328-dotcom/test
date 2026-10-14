"""TTS 引擎 —— CosyVoice2-0.5B（GPU7 常驻）。

卡司一致性（20-50 集同嗓）方案，来自调研：
  1. 建角一次性注册：add_zero_shot_spk(参考音转写, ref_<char>.wav, char_id) + save_spkinfo()
     落盘 spk2info，之后进程直接加载，确定性复用同一音色嵌入。
  2. 合成：对白用 inference_zero_shot(text, '', '', zero_shot_spk_id=char_id)；
     需要戏感用 inference_instruct2(text, '用<情绪>的语气说<|endofprompt|>', ref)；
     旁白/外语用 inference_cross_lingual。
  3. 输出 24kHz；混音前重采样到 48kHz（装配阶段处理）。

延迟导入 cosyvoice，模块本身无 GPU 依赖也能 import。
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

log = logging.getLogger("engines.tts")


@dataclass
class CosyVoiceEngine:
    model_dir: str
    spk_info_dir: Optional[str] = None     # 持久化音色库目录
    device: str = "cuda:7"
    _model: object = field(default=None, repr=False)

    def load(self):
        if self._model is not None:
            return self._model
        import torch
        from cosyvoice.cli.cosyvoice import CosyVoice2   # 延迟导入
        self._model = CosyVoice2(self.model_dir, load_jit=False, load_trt=False, fp16=False)
        # 若有持久化音色库，加载
        if self.spk_info_dir and Path(self.spk_info_dir).exists():
            try:
                self._model.frontend.set_spk2info(self.spk_info_dir)
            except Exception as e:  # noqa: BLE001
                log.warning("加载 spk2info 失败：%s", e)
        return self._model

    # ---- 建角：注册持久化音色 ----
    def register_voice(self, char_id: str, ref_wav: str, ref_text: str) -> bool:
        """用 5-15s 干净参考音注册命名音色并落盘。返回是否成功。"""
        m = self.load()
        ok = m.add_zero_shot_spk(ref_text, ref_wav, char_id)
        if ok:
            m.save_spkinfo()
            log.info("注册音色 %s -> spk_id=%s", char_id, char_id)
        return bool(ok)

    # ---- 合成 ----
    def synthesize(
        self,
        text: str,
        out_wav: Path | str,
        spk_id: Optional[str] = None,
        emotion: Optional[str] = None,
        instruct: Optional[str] = None,
        speed: float = 1.0,
        cross_lingual: bool = False,
    ) -> dict:
        """合成一句台词到 out_wav(24kHz)。返回 {audio_path, sample_rate}。

        spk_id: 已注册的命名音色（对白走这条，保证跨集同嗓）。
        instruct/emotion: 用 inference_instruct2 加戏感。
        cross_lingual: 旁白/外语用 inference_cross_lingual。
        """
        import torchaudio
        m = self.load()
        out_wav = Path(out_wav)
        out_wav.parent.mkdir(parents=True, exist_ok=True)

        prompt_text = f"用{emotion}的语气说这句话<|endofprompt|>" if emotion else (instruct or "")
        chunks = []
        if cross_lingual:
            gen = m.inference_cross_lingual(text, stream=False, speed=speed)
        elif prompt_text and spk_id:
            gen = m.inference_instruct2(text, prompt_text, "", zero_shot_spk_id=spk_id, stream=False, speed=speed)
        elif spk_id:
            gen = m.inference_zero_shot(text, "", "", zero_shot_spk_id=spk_id, stream=False, speed=speed)
        else:
            raise ValueError("synthesize 需要 spk_id（或 cross_lingual=True）")
        for seg in gen:
            chunks.append(seg["tts_speech"])
        import torch
        audio = torch.cat(chunks, dim=1) if chunks else torch.zeros(1, 1)
        torchaudio.save(str(out_wav), audio, m.sample_rate)
        return {"audio_path": str(out_wav), "sample_rate": m.sample_rate}

    def word_timestamps(self, wav_path: str, text: str) -> list[dict]:
        """取词级时间戳（CosyVoice2 可返回 alignment；否则由字幕阶段按字数兜底）。"""
        # 真实实现：部分 CosyVoice2 版本在 inference 里返回 tts_speech 的对齐信息。
        # 这里保守返回空，字幕阶段 subtitles.estimate_timings 会兜底铺排。
        return []
