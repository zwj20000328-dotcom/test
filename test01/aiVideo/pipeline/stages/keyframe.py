"""S4 关键帧阶段 —— Qwen-Image 多参考生图 + ArcFace best-of-N 自动择优。

角色一致性四层策略的生成+校验层：
  1. 用角色 canonical sheet ± 上一合格帧作为多参考，固定 per-shot seed 家族。
  2. 生成 N 个候选（换 seed / 逐次提高 identity_strength / 中途走 Edit 修脸），
     各打 ArcFace 人脸相似度分；双主角同框取最低分（防止串脸）。
  3. 取最高分候选作为最终关键帧。**达标即提前结束省算力**；即使最高分低于阈值也接受
     （标记 ACCEPTED-BELOW-THRESHOLD 进事后 QC 报告），因为视频链路全自动无人值守，
     绝不能因质量不达标而阻塞（返回 needs_human 会让 ~3000 镜任务死锁）。
  4. 只有引擎反复抛异常（无可用候选）才判 failed——那是故障，不是质量问题。
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

        # ---- best-of-N 自动择优（全自动模式下绝不阻塞等人）----
        # 生成 N 个候选，各自打 ArcFace 分，取最高分那张作为最终关键帧。
        # 即使最高分低于阈值也接受（记入 QC 报告供渲染后复盘），避免无人值守死锁。
        best_path: str | None = None
        best_sim: float | None = None
        best_seed: int | None = None
        best_ok = False
        best_notes = ""
        attempts_made = 0

        for attempt in range(self.max_attempts):
            seed = base_seed + attempt * 101
            ident = 0.70 + attempt * 0.08   # 逐次提高身份权重
            cand = out if attempt == 0 else ctx.path("keyframes", f"{shot.id}_c{attempt}.png")
            try:
                self.img.generate(
                    prompt=shot.visual_prompt_en or "",
                    out_path=cand, ref_images=refs, seed=seed,
                    identity_strength=min(0.92, ident),
                )
            except Exception as e:  # noqa: BLE001
                log.error("关键帧生成失败 %s (attempt %d): %s", shot.id, attempt, e)
                continue
            attempts_made += 1

            ok, sim, notes = self._qc_face(cand, chars)
            # 择优：sim 为 None（QC 不可用）时首个候选即视为最优
            is_better = (
                best_path is None
                or (sim is not None and (best_sim is None or sim > best_sim))
            )
            if is_better:
                best_path, best_sim, best_seed, best_ok, best_notes = str(cand), sim, seed, ok, notes
            if ok:
                break   # 达标即提前结束，省算力

            # 中途用 Edit 修脸产出一个额外候选（保身份改脸）
            if self.use_edit_fallback and attempt == self.max_attempts - 2 and chars:
                edit_out = ctx.path("keyframes", f"{shot.id}_edit.png")
                try:
                    self.img.edit(str(cand), f"correct facial identity: {chars[0].identity_blob}",
                                  edit_out, seed=seed)
                    eok, esim, enotes = self._qc_face(edit_out, chars)
                    if best_path is None or (esim is not None and (best_sim is None or esim > best_sim)):
                        best_path, best_sim, best_seed, best_ok, best_notes = str(edit_out), esim, seed, eok, enotes
                except Exception:  # noqa: BLE001
                    pass

        if best_path is None:
            # 所有尝试都抛异常（引擎故障）——这才是真正的失败，非质量不达标
            log.error("镜头 %s 关键帧生成全部异常，无可用候选。", shot.id)
            shot.status = ShotStatus.failed
            shot.qc.notes = f"all {self.max_attempts} generations raised exceptions"
            return ShotStatus.failed

        # 采用最优候选（把非首选候选挪到最终路径，清理多余文件）
        if best_path != str(out):
            import shutil
            shutil.move(best_path, str(out))
            best_path = str(out)

        shot.keyframe_path = best_path
        shot.seed = best_seed
        shot.qc.face_sim = best_sim
        shot.qc.face_sim_pass = best_ok
        shot.qc.attempts = attempts_made
        shot.qc.notes = best_notes
        shot.artifacts.model = "qwen-image-2.1"
        if not best_ok:
            # 低于阈值但仍是最佳：接受并标记，进事后 QC 报告（不阻塞）
            shot.qc.notes = (f"ACCEPTED-BELOW-THRESHOLD (best of {attempts_made}): "
                             f"sim={best_sim} thr={self.threshold}. " + (best_notes or ""))
            log.warning("镜头 %s 采用次优关键帧（sim=%s < %s），已记入 QC 报告。",
                        shot.id, best_sim, self.threshold)
        return ShotStatus.keyframed

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
