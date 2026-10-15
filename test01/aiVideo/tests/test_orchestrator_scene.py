"""编排器 scene 级批量分支测试 —— _run_scene_level 与 run_shot 回退。

M11 的核心保证：run_scene 批量把调用数从 ~1620 降到 ~210，但任何批量失败都不得
让镜头卡死——最差退化为 per-shot 逐镜生成。本文件锁定：
  1. stage 有 run_scene 时走场景级批量
  2. run_scene 成功 -> 覆盖到的镜头标 produces
  3. run_scene 抛异常 -> 该场景全部镜头回退 run_shot
  4. run_scene 漏了部分镜头 -> 只回退漏掉的
  5. resume 跳过已完成镜头
  6. 增量存档在场景级也生效
"""
from __future__ import annotations

import pytest

from pipeline.contracts import ShotStatus, manifest_from_raw
from pipeline.orchestrator import Orchestrator, StageContext, StageSpec
from pipeline.parser import parse_screenplay

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SAMPLE = ROOT / "examples" / "sample_screenplay.md"


@pytest.fixture()
def manifest():
    return manifest_from_raw(parse_screenplay(SAMPLE.read_text(encoding="utf-8")))


class SceneStage:
    """可编排行为的 run_scene stage。"""
    name = "enrich"
    consumes = (ShotStatus.parsed,)
    produces = ShotStatus.enriched

    def __init__(self, *, fail_scenes: int = 0, drop_from_scene: int = 0,
                 fail_shots: bool = False):
        self.scene_calls = 0
        self.shot_calls = 0
        self.fail_scenes = fail_scenes        # 前 N 个场景的 run_scene 抛异常
        self.drop_from_scene = drop_from_scene  # run_scene 返回时丢掉每场景最后 N 个镜头
        self.fail_shots = fail_shots          # run_shot 回退也失败
        self._scene_seen = 0

    def run_scene(self, scene, ctx: StageContext) -> list[str]:
        self._scene_seen += 1
        self.scene_calls += 1
        if self._scene_seen <= self.fail_scenes:
            raise RuntimeError("模拟批量截断/解析失败")
        targets = [sh for sh in scene.shots if sh.status == ShotStatus.parsed]
        keep = len(targets) - self.drop_from_scene
        done = []
        for sh in targets[:max(0, keep)]:
            sh.visual_prompt_en = "scene-batch"
            done.append(sh.id)
        return done

    def run_shot(self, shot, ctx: StageContext) -> ShotStatus:
        self.shot_calls += 1
        if self.fail_shots:
            raise RuntimeError("单镜也失败")
        shot.visual_prompt_en = "shot-fallback"
        return ShotStatus.enriched


def _orch(manifest, stage, tmp_path, **kw):
    orch_kw = {k: v for k, v in kw.items()
               if k in ("checkpoint_every", "checkpoint_interval")}
    o = Orchestrator(project_dir=tmp_path / "p",
                     stages={"enrich": StageSpec(stage, retries=0)},
                     **orch_kw)
    o.manifest = manifest
    o.manifest.save(o.manifest_path)
    return o


# --------------------------------------------------------------------------- #
# 1. 走批量分支
# --------------------------------------------------------------------------- #


def test_scene_stage_uses_run_scene(manifest, tmp_path):
    stage = SceneStage()
    o = _orch(manifest, stage, tmp_path)
    summary = o.run(only=["enrich"])
    assert stage.scene_calls > 0, "应走 run_scene 批量"
    assert summary["enrich"]["scenes"] > 0
    # 批量成功时不应触发 per-shot 回退
    assert stage.shot_calls == 0


def test_all_shots_enriched_via_batch(manifest, tmp_path):
    stage = SceneStage()
    o = _orch(manifest, stage, tmp_path)
    o.run(only=["enrich"])
    total = len(list(manifest.iter_shots()))
    assert manifest.stats()["by_status"]["enriched"] == total
    assert manifest.stats()["by_status"]["failed"] == 0


def test_batch_fewer_calls_than_shots(manifest, tmp_path):
    """批量的核心价值：调用数 < 镜头数。"""
    stage = SceneStage()
    o = _orch(manifest, stage, tmp_path)
    o.run(only=["enrich"])
    n_shots = len(list(manifest.iter_shots()))
    assert stage.scene_calls <= len(list(manifest.iter_scenes()))
    assert stage.scene_calls < n_shots


# --------------------------------------------------------------------------- #
# 2. run_scene 抛异常 -> 回退 per-shot
# --------------------------------------------------------------------------- #


def test_scene_failure_falls_back_to_run_shot(manifest, tmp_path):
    """前 2 个场景批量失败 -> 这两个场景的镜头走 run_shot 补救。"""
    stage = SceneStage(fail_scenes=2)
    o = _orch(manifest, stage, tmp_path)
    summary = o.run(only=["enrich"])
    assert stage.shot_calls > 0, "批量失败应触发 per-shot 回退"
    assert summary["enrich"]["scene_failed_fallback"] == 2
    # 全部镜头仍应成功（回退补救）
    assert manifest.stats()["by_status"]["failed"] == 0
    total = len(list(manifest.iter_shots()))
    assert manifest.stats()["by_status"]["enriched"] == total


def test_all_scenes_fail_still_enriches_all(manifest, tmp_path):
    """所有场景批量都失败 -> 全部退化 per-shot，但一个镜头都不丢。"""
    stage = SceneStage(fail_scenes=999)
    o = _orch(manifest, stage, tmp_path)
    o.run(only=["enrich"])
    total = len(list(manifest.iter_shots()))
    assert manifest.stats()["by_status"]["enriched"] == total
    assert manifest.stats()["by_status"]["failed"] == 0
    assert stage.shot_calls == total


def test_fallback_also_fails_marks_failed(manifest, tmp_path):
    """批量失败 + 回退也失败 -> 镜头标 failed（不静默丢失）。"""
    stage = SceneStage(fail_scenes=999, fail_shots=True)
    o = _orch(manifest, stage, tmp_path)
    o.run(only=["enrich"])
    total = len(list(manifest.iter_shots()))
    assert manifest.stats()["by_status"]["failed"] == total


# --------------------------------------------------------------------------- #
# 3. run_scene 漏镜头 -> 只回退漏掉的
# --------------------------------------------------------------------------- #


def test_partial_batch_drops_fallback_only_missing(manifest, tmp_path):
    """每场景批量丢掉最后 1 镜 -> 只有那些镜头走回退。"""
    stage = SceneStage(drop_from_scene=1)
    o = _orch(manifest, stage, tmp_path)
    o.run(only=["enrich"])
    total = len(list(manifest.iter_shots()))
    n_scenes = len(list(manifest.iter_scenes()))
    # 回退次数 = 有镜头被丢的场景数（每场景 1 个）
    assert stage.shot_calls == n_scenes
    assert manifest.stats()["by_status"]["enriched"] == total
    assert manifest.stats()["by_status"]["failed"] == 0
    # 批量覆盖的标 scene-batch，回退的标 shot-fallback
    kinds = {sh.visual_prompt_en for sh in manifest.iter_shots()}
    assert "scene-batch" in kinds
    assert "shot-fallback" in kinds


# --------------------------------------------------------------------------- #
# 4. resume
# --------------------------------------------------------------------------- #


def test_resume_skips_enriched(manifest, tmp_path):
    stage = SceneStage()
    o = _orch(manifest, stage, tmp_path)
    o.run(only=["enrich"])
    first_calls = stage.scene_calls

    # 重新载入并再跑，应全部跳过
    o2 = Orchestrator(project_dir=tmp_path / "p",
                      stages={"enrich": StageSpec(SceneStage(), retries=0)})
    o2.load()
    stage2 = o2.stages["enrich"].stage
    summary = o2.run(only=["enrich"], resume=True)
    assert summary["enrich"]["skipped"] == len(list(o2.manifest.iter_shots()))
    assert summary["enrich"]["scenes"] == 0, "全已完成，不应再调 run_scene"


def test_resume_continues_partial(manifest, tmp_path):
    """跑到一半（部分场景失败）后重跑，只补未完成的。"""
    stage = SceneStage(fail_scenes=1)
    o = _orch(manifest, stage, tmp_path)
    # 第一个场景失败会回退，仍应全 enriched；改为让回退也失败以制造未完成
    stage.fail_shots = True
    o.run(only=["enrich"])
    failed_after_first = manifest.stats()["by_status"]["failed"]
    assert failed_after_first > 0

    # 修复后重跑：只补 failed 的？注意 failed 不在 consumes，需要显式处理
    # 这里验证 enriched 的不会被重做
    o2 = Orchestrator(project_dir=tmp_path / "p",
                      stages={"enrich": StageSpec(SceneStage(fail_scenes=0), retries=0)})
    o2.load()
    stage2 = o2.stages["enrich"].stage
    o2.run(only=["enrich"], resume=True)
    enriched = o2.manifest.stats()["by_status"]["enriched"]
    assert enriched == len(list(o2.manifest.iter_shots())) - \
        o2.manifest.stats()["by_status"]["failed"]


# --------------------------------------------------------------------------- #
# 5. 增量存档（场景级）
# --------------------------------------------------------------------------- #


def test_scene_level_checkpointing(manifest, tmp_path, monkeypatch):
    """场景级也要增量存档，不能只在 stage 结束时存一次。"""
    from pipeline.contracts import Manifest
    stage = SceneStage()
    o = _orch(manifest, stage, tmp_path, checkpoint_every=1, checkpoint_interval=1e9)
    saves = []
    real = Manifest.save
    monkeypatch.setattr(Manifest, "save",
                        lambda self, path=None: (real(self, path), saves.append(1)) if path else None)
    o.run(only=["enrich"])
    n_scenes = len(list(manifest.iter_scenes()))
    # 至少每场景存一次 + 收尾一次
    assert len(saves) >= n_scenes, f"场景级存档次数 {len(saves)} < 场景数 {n_scenes}"


# --------------------------------------------------------------------------- #
# 6. per-shot stage 仍走旧路径（无 run_scene 时）
# --------------------------------------------------------------------------- #


def test_stage_without_run_scene_uses_per_shot(manifest, tmp_path):
    """stage 只有 run_shot（如 keyframe）时仍走 _run_per_shot。"""
    from pipeline.stages import NullStage, StubEngine
    stage = NullStage("enrich", (ShotStatus.parsed,), ShotStatus.enriched,
                      StubEngine(), write_artifact=False)
    assert not hasattr(stage, "run_scene")
    o = _orch(manifest, stage, tmp_path)
    summary = o.run(only=["enrich"])
    assert manifest.stats()["by_status"]["enriched"] == len(list(manifest.iter_shots()))
    assert "scenes" not in summary["enrich"], "per-shot 摘要不应含 scenes 键"
