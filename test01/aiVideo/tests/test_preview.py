"""预览（S5a）与可选阶段行为测试。

背景：PreviewStage 曾存在但未接入 STAGE_ORDER、未在 run.py 注册、且没有 stage 产出
drafted 状态——导致文档推荐的"先出预览再终渲"路径实际跑不起来。本文件锁定修复后的行为：
  1. preview 是可选阶段：默认全跑时跳过，被 --only 点名时才跑
  2. video 同时消费 keyframed（未跑预览）和 drafted（跑过预览），两条路径都通
  3. preview 产出 draft_clip_path 并把状态推进到 drafted
"""
from __future__ import annotations

from pathlib import Path

import pytest

from pipeline.contracts import ShotStatus, manifest_from_raw
from pipeline.orchestrator import OPTIONAL_STAGES, Orchestrator, StageSpec, _status_after
from pipeline.parser import parse_screenplay
from pipeline.stages import NullStage, StubEngine
from pipeline.stages.video import PreviewStage, VideoStage

ROOT = Path(__file__).resolve().parent.parent
SAMPLE = ROOT / "examples" / "sample_screenplay.md"


@pytest.fixture()
def manifest():
    return manifest_from_raw(parse_screenplay(SAMPLE.read_text(encoding="utf-8")))


def _stages():
    stub = StubEngine()
    return {
        "enrich": StageSpec(NullStage("enrich", (ShotStatus.parsed,), ShotStatus.enriched,
                                      stub, write_artifact=False)),
        "keyframe": StageSpec(NullStage("keyframe", (ShotStatus.enriched,), ShotStatus.keyframed,
                                        stub, "keyframes", "keyframe_path", ".png")),
        "preview": StageSpec(NullStage("preview", (ShotStatus.keyframed,), ShotStatus.drafted,
                                       stub, "drafts", "draft_clip_path", ".mp4")),
        "video": StageSpec(NullStage("video", (ShotStatus.keyframed, ShotStatus.drafted),
                                     ShotStatus.rendered, stub, "clips", "clip_path", ".mp4")),
    }


# --------------------------------------------------------------------------- #
# 1. 可选阶段语义
# --------------------------------------------------------------------------- #


def test_preview_is_optional():
    assert "preview" in OPTIONAL_STAGES


def test_optional_stage_skipped_by_default(manifest, tmp_path):
    """未指定 --only（全跑模式）时，可选阶段必须跳过——否则每部剧白烧 3-6 小时。"""
    orch = Orchestrator(project_dir=tmp_path / "p", stages=_stages(), dry_run=True)
    orch.manifest = manifest
    assert orch._should_run("preview", None) is False
    assert orch._should_run("video", None) is True
    assert orch._should_run("keyframe", None) is True


def test_optional_stage_runs_when_named(manifest, tmp_path):
    """被 --only 显式点名时，可选阶段要跑。"""
    orch = Orchestrator(project_dir=tmp_path / "p", stages=_stages(), dry_run=True)
    orch.manifest = manifest
    assert orch._should_run("preview", ["preview", "video"]) is True


def test_full_run_produces_no_drafts(manifest, tmp_path):
    """默认全跑不应产生任何 draft 产物。"""
    orch = Orchestrator(project_dir=tmp_path / "p", stages=_stages(), dry_run=False)
    orch.manifest = manifest
    orch.manifest.save(orch.manifest_path)
    orch.run()
    assert all(sh.draft_clip_path is None for sh in orch.manifest.iter_shots())
    assert not (tmp_path / "p" / "drafts").exists() or \
        not list((tmp_path / "p" / "drafts").glob("*"))


def test_named_preview_produces_drafts(manifest, tmp_path):
    """点名 preview 时应产出 draft 并把状态推进到 drafted（video 之前）。"""
    orch = Orchestrator(project_dir=tmp_path / "p", stages=_stages(), dry_run=False)
    orch.manifest = manifest
    orch.manifest.save(orch.manifest_path)
    orch.run(only=["enrich", "keyframe", "preview"])
    shots = list(orch.manifest.iter_shots())
    assert all(sh.status == ShotStatus.drafted for sh in shots)
    assert all(sh.draft_clip_path for sh in shots)
    assert list((tmp_path / "p" / "drafts").glob("*.mp4"))


# --------------------------------------------------------------------------- #
# 2. video 消费两种上游状态
# --------------------------------------------------------------------------- #


def test_video_consumes_both_keyframed_and_drafted():
    """关键不变量：video 必须同时接受 keyframed 和 drafted。

    否则"先预览后终渲"这条推荐路径会在 preview 之后卡住（video 不认 drafted）。
    """
    assert ShotStatus.keyframed in VideoStage.consumes
    assert ShotStatus.drafted in VideoStage.consumes


def test_video_runs_after_preview(manifest, tmp_path):
    """端到端：preview -> drafted -> video 能顺利接上。"""
    orch = Orchestrator(project_dir=tmp_path / "p", stages=_stages(), dry_run=False)
    orch.manifest = manifest
    orch.manifest.save(orch.manifest_path)
    summary = orch.run(only=["enrich", "keyframe", "preview", "video"])
    assert summary["preview"]["processed"] > 0
    assert summary["video"]["processed"] > 0
    assert summary["video"]["failed"] == 0
    assert all(sh.status == ShotStatus.rendered for sh in orch.manifest.iter_shots())
    # 终渲产物与预览产物都在
    assert all(sh.clip_path and sh.draft_clip_path for sh in orch.manifest.iter_shots())


def test_video_runs_without_preview(manifest, tmp_path):
    """不跑预览时 video 直接从 keyframed 接上（另一条路径也要通）。"""
    orch = Orchestrator(project_dir=tmp_path / "p", stages=_stages(), dry_run=False)
    orch.manifest = manifest
    orch.manifest.save(orch.manifest_path)
    summary = orch.run(only=["enrich", "keyframe", "video"])
    assert summary["video"]["processed"] > 0
    assert all(sh.status == ShotStatus.rendered for sh in orch.manifest.iter_shots())
    assert all(sh.draft_clip_path is None for sh in orch.manifest.iter_shots())


# --------------------------------------------------------------------------- #
# 3. 状态顺序：drafted 必须在 keyframed 之后、rendered 之前
# --------------------------------------------------------------------------- #


def test_drafted_sits_between_keyframed_and_rendered():
    """drafted 必须在状态序中正确定位，否则 resume 的跳过判断会出错。"""
    assert _status_after(ShotStatus.drafted, ShotStatus.keyframed)
    assert _status_after(ShotStatus.rendered, ShotStatus.drafted)
    assert not _status_after(ShotStatus.keyframed, ShotStatus.drafted)


def test_resume_skips_preview_when_already_drafted(manifest, tmp_path):
    """续跑：已 drafted 的镜头在 preview 阶段应被跳过，不重跑。"""
    orch = Orchestrator(project_dir=tmp_path / "p", stages=_stages(), dry_run=True)
    orch.manifest = manifest
    orch.manifest.save(orch.manifest_path)
    orch.run(only=["enrich", "keyframe", "preview"])
    n = len(list(orch.manifest.iter_shots()))

    orch2 = Orchestrator(project_dir=tmp_path / "p", stages=_stages(), dry_run=True)
    orch2.load()
    summary = orch2.run(only=["preview"], resume=True)
    assert summary["preview"]["skipped"] == n
    assert summary["preview"]["processed"] == 0


# --------------------------------------------------------------------------- #
# 4. PreviewStage 真实实现（非 stub）
# --------------------------------------------------------------------------- #


class MockVideo:
    mode = "preview"

    def generate(self, image_path, motion_prompt, out_path, **kw):
        Path(out_path).parent.mkdir(parents=True, exist_ok=True)
        Path(out_path).write_bytes(b"\x00\x00\x00\x18ftypmp42stub")
        return Path(out_path)


def test_preview_stage_writes_draft(manifest, tmp_path):
    stage = PreviewStage(MockVideo())
    from pipeline.orchestrator import StageContext
    ctx = StageContext(project_dir=tmp_path, manifest=manifest)
    shot = next(manifest.iter_shots())
    shot.status = ShotStatus.keyframed
    shot.keyframe_path = str(tmp_path / "kf.png")
    Path(shot.keyframe_path).write_bytes(b"x")
    st = stage.run_shot(shot, ctx)
    assert st == ShotStatus.drafted
    assert shot.draft_clip_path and Path(shot.draft_clip_path).exists()


def test_preview_stage_fails_without_keyframe(manifest, tmp_path):
    stage = PreviewStage(MockVideo())
    from pipeline.orchestrator import StageContext
    ctx = StageContext(project_dir=tmp_path, manifest=manifest)
    shot = next(manifest.iter_shots())
    shot.status = ShotStatus.keyframed
    shot.keyframe_path = None
    assert stage.run_shot(shot, ctx) == ShotStatus.failed
