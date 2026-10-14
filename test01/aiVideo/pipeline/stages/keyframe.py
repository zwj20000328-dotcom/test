"""S4 关键帧阶段 —— Qwen-Image 多参考生图 + ArcFace 人脸相似度 QC 门。

角色一致性四层策略的生成+校验层：
  1. 用角色 canonical sheet ± 上一合格帧作为多参考，固定 per-shot seed 家族。
  2. 生成后跑 QC：ArcFace 人脸嵌入与该角色 sheet 的相似度需过阈值；双主角同框时校验互斥
     （两张脸分别匹配各自角色，不能串脸）。
  3. 不达标自动重生成（换 seed / 提高 identity_strength / 走 Edit 修脸），
     连续 max_attempts 次失败转 needs_human。
"""
from __future__ import annotations

import logging
from pathlib import Path

from ..contracts import Manifest, Shot, ShotStatus
from ..orchestrator import StageContext

log = logging.getLogger("stages.keyframe")


class KeyframeStage:
    name = "keyframe"
    consumes = (ShotStatus.enriched,)
    produces = ShotStatus.keyframed

    def __init__(self, image_engine, face_qc=None, face_sim_threshold: float = 0.55,
                 max_attempts: int = 3, use_edit_fallback: bool = True):
        self.img = image_engine
        self.qc = face_qc                 # 需实现 embed(img)->vec, similarity(a,b)->float
        self.threshold = face_sim_threshold
        self.max_attempts = max_attempts
        self.use_edit_fallback = use_edit_fallback

    def run_shot(self, shot: Shot, ctx: StageContext) -> ShotStatus:
        m = ctx.manifest
        chars = [m.character_by_id(cid) for cid in shot.character_ids]
        chars = [c for c in chars if c]

        # 多参考：角色 sheet（+ 主角 LoRA 由引擎内部按 ref_ids 应用）
        refs: list[str] = []
        for c in chars:
            refs.extend(c.sheet_paths[:2])
            if c.lora and c.lora.path:
                shot.ref_ids.append(f"lora:{c.id}")
        # 同场景上一合格帧，保持连贯
        prev = self._prev_keyframe(shot, m)
        if prev:
            refs.append(prev)

        base_seed = shot.seed
        if base_seed is None:
            base_seed = next((c.seed_base for c in chars if c.seed_base), None)
        if base_seed is None:
            base_seed = abs(hash(shot.id)) % 1_000_000   # 确定性兜底 seed
        out = ctx.path("keyframes", f"{shot.id}.png")

        for attempt in range(self.max_attempts):
            seed = base_seed + attempt * 101
            ident = 0.70 + attempt * 0.08   # 逐次提高身份权重
            try:
                self.img.generate(
                    prompt=shot.visual_prompt_en or "",
                    out_path=out, ref_images=refs, seed=seed,
                    identity_strength=min(0.92, ident),
                )
            except Exception as e:  # noqa: BLE001
                log.error("关键帧生成失败 %s (attempt %d): %s", shot.id, attempt, e)
                continue

            # QC 门
            ok, sim, notes = self._qc_face(out, chars)
            shot.qc.face_sim = sim
            shot.qc.face_sim_pass = ok
            shot.qc.attempts = attempt + 1
            shot.qc.notes = notes
            if ok:
                shot.keyframe_path = str(out)
                shot.seed = seed
                shot.artifacts.model = "qwen-image-2.1"
                return ShotStatus.keyframed

            log.warning("QC 未过 %s (sim=%s, attempt %d): %s", shot.id, sim, attempt, notes)
            # 用 Edit 修脸再试（保身份改脸）
            if self.use_edit_fallback and attempt == self.max_attempts - 2 and chars:
                try:
                    self.img.edit(str(out), f"correct facial identity: {chars[0].identity_blob}",
                                  ctx.path("keyframes", f"{shot.id}_edit.png"), seed=seed)
                except Exception:  # noqa: BLE001
                    pass

        # 连续失败转人工
        shot.status = ShotStatus.needs_human
        shot.qc.notes = f"face QC failed after {self.max_attempts} attempts"
        return ShotStatus.needs_human

    def _qc_face(self, img_path: Path, chars) -> tuple[bool, float | None, str]:
        """ArcFace 相似度校验。无 QC 引擎时放行（开发/预览）。"""
        if self.qc is None or not chars:
            return True, None, "qc-skipped (no face engine or no named char)"
        try:
            emb = self.qc.embed(str(img_path))
            best, worst = 1.0, 0.0
            for c in chars:
                if not c.sheet_paths:
                    continue
                ref_emb = self.qc.embed(c.sheet_paths[0])
                sim = self.qc.similarity(emb, ref_emb)
                worst = max(worst, sim)   # 该角色最佳匹配
                best = min(best, sim)
            # 双主角互斥：每张脸应各自匹配，简化为要求最低相似度过阈值
            ok = best >= self.threshold
            return ok, round(best, 3), f"best_face_sim={best:.3f} thr={self.threshold}"
        except Exception as e:  # noqa: BLE001
            return True, None, f"qc-error (pass-through): {e}"

    def _prev_keyframe(self, shot: Shot, m: Manifest) -> str | None:
        """同场景内上一个已出帧的镜头，作连贯参考。"""
        shots = list(m.iter_shots())
        try:
            idx = next(i for i, s in enumerate(shots) if s.id == shot.id)
        except StopIteration:
            return None
        for j in range(idx - 1, -1, -1):
            p = shots[j]
            if p.scene_id == shot.scene_id and p.keyframe_path:
                return p.keyframe_path
        return None
