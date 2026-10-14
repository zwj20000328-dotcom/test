"""S3 角色资产锁定阶段（每剧一次）—— 角色一致性的地基。

产出 assets/characters/<id>/character_manifest 及：
  1. canonical 多视图定妆 sheet（正/3-4/侧/多表情），作为所有后续生图的身份锚 + QC 基准。
  2. 主角 LoRA（可选，最强层）：用 sheet + 首批合格帧训角色 LoRA，跨集确定性复用。
  3. CosyVoice 注册命名音色（若有参考音），持久化 spk_id 供 S6 复用。

这是 per-character 阶段，不走 per-shot 协议；编排器通过 stage.run_assets(m, ctx) 调用。
LoRA 训练是重活（30-90 分钟），默认关闭，用 train_lora=True 显式开启。
"""
from __future__ import annotations

import logging

from ..contracts import Character, Manifest, ShotStatus
from ..orchestrator import StageContext

log = logging.getLogger("stages.assets")

_VIEWS = [
    ("front", "front view, neutral expression, facing camera"),
    ("three_quarter", "three-quarter view, slight smile"),
    ("side", "side profile view"),
    ("expressions", "expression sheet: happy, angry, sad, surprised, four portraits grid"),
]


class AssetsStage:
    name = "assets"

    def __init__(self, image_engine, tts_engine=None, lora_trainer=None,
                 train_lora: bool = False, ref_audio_dir: str | None = None):
        self.img = image_engine
        self.tts = tts_engine
        self.lora_trainer = lora_trainer
        self.train_lora = train_lora
        self.ref_audio_dir = ref_audio_dir    # assets/voice_refs/<char_id>.wav（用户自备或占位）

    def run_assets(self, m: Manifest, ctx: StageContext) -> dict:
        result = {"characters": 0, "sheets": 0, "voices": 0, "loras": 0}
        for c in m.characters:
            # 1) 定妆 sheet（多视图）
            cdir = ctx.path("assets", "characters", c.id)
            sheets = []
            base_prompt = (
                f"character reference sheet, {c.identity_blob or c.appearance}, "
                f"consistent identity, plain neutral background, studio lighting, high detail"
            )
            for view_name, view_desc in _VIEWS:
                out = cdir / f"sheet_{view_name}.png"
                try:
                    self.img.generate(
                        prompt=f"{base_prompt}, {view_desc}",
                        out_path=out, seed=(c.seed_base or 12345) + hash(view_name) % 1000,
                    )
                    sheets.append(str(out))
                except Exception as e:  # noqa: BLE001
                    log.error("定妆图失败 %s/%s：%s", c.name, view_name, e)
            c.sheet_paths = sheets
            result["sheets"] += len(sheets)

            # 2) 注册音色（若有参考音）
            if self.tts is not None:
                ref = self._find_ref_audio(c)
                if ref:
                    try:
                        ok = self.tts.register_voice(c.id, str(ref),
                                                     ref_text=f"{c.name}的参考音色样本。")
                        if ok:
                            c.voice.spk_id = c.id
                            c.voice.ref_wav = str(ref)
                            c.voice.engine = "cosyvoice"
                            result["voices"] += 1
                    except Exception as e:  # noqa: BLE001
                        log.error("音色注册失败 %s：%s", c.name, e)

            # 3) 主角 LoRA（可选重活）
            if self.train_lora and self.lora_trainer is not None and self._is_lead(c, m):
                try:
                    lora_path = self.lora_trainer.train(c, sheets, ctx)
                    c.lora.path = str(lora_path)
                    c.lora.scale = 0.75
                    result["loras"] += 1
                except Exception as e:  # noqa: BLE001
                    log.error("LoRA 训练失败 %s：%s", c.name, e)

            result["characters"] += 1
            log.info("角色资产锁定：%s（%d 张定妆图%s）", c.name, len(sheets),
                     "，已注册音色" if c.voice.spk_id else "")
        return result

    def _find_ref_audio(self, c: Character):
        if not self.ref_audio_dir:
            return None
        from pathlib import Path
        base = Path(self.ref_audio_dir)
        for ext in (".wav", ".mp3", ".flac", ".m4a"):
            p = base / f"{c.id}{ext}"
            if p.exists():
                return p
            p2 = base / f"{c.name}{ext}"
            if p2.exists():
                return p2
        return None

    def _is_lead(self, c: Character, m: Manifest) -> bool:
        """出场镜头最多的前 3 个角色视为主角（值得训 LoRA）。"""
        counts = {}
        for sh in m.iter_shots():
            for cid in sh.character_ids:
                counts[cid] = counts.get(cid, 0) + 1
        top = sorted(counts, key=counts.get, reverse=True)[:3]
        return c.id in top
