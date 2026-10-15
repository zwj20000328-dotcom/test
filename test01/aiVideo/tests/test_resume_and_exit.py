"""续跑语义与退出码测试。

锁定三个曾出过 bug 的行为：
  1. run.py 无条件 ingest() 会覆盖已有 manifest → 改为 ensure_ingested() 按剧本哈希
     决定加载/重建，续跑不再丢进度（这条曾让"分级校验再终渲"流程和断点续跑全失效）。
  2. ffmpeg 缺失是环境问题，不得把镜头逐个标 failed（会永久卡死，因为 failed 不在
     任何阶段的 consumes 里）→ 改抛 FFmpegMissingError，只让集失败。
  3. run.py 无条件 return 0 → 改为按失败类型返回 3/4/5/6，自动化才能判断成败。
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline.assemble import FFmpegMissingError, run_cmd
from pipeline.contracts import Manifest, ShotStatus, manifest_from_raw
from pipeline.orchestrator import Orchestrator, ScreenplayChangedError, StageSpec
from pipeline.parser import parse_screenplay
from pipeline.stages import AssembleStage, ConcatStage, NullStage, StubEngine, SubtitleStage

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
        "subtitle": StageSpec(SubtitleStage()),
        "assemble": StageSpec(AssembleStage()),
        "concat": StageSpec(ConcatStage()),
    }


# --------------------------------------------------------------------------- #
# 1. 续跑语义：ensure_ingested
# --------------------------------------------------------------------------- #


def test_first_run_parses(tmp_path):
    orch = Orchestrator(project_dir=tmp_path / "p", stages=_stages())
    m = orch.ensure_ingested(SAMPLE)
    assert m.stats()["shots"] == 11
    assert m.source_hash, "首次解析必须记录剧本哈希"
    assert m.source_path


def test_rerun_preserves_progress(tmp_path):
    """核心回归：重跑同一命令不得把进度清零。"""
    orch = Orchestrator(project_dir=tmp_path / "p", stages=_stages())
    orch.ensure_ingested(SAMPLE)
    orch.run(only=["enrich"])
    assert orch.manifest.stats()["by_status"]["enriched"] == 11

    # 模拟"另一次进程启动"：新 Orchestrator 实例 + ensure_ingested
    orch2 = Orchestrator(project_dir=tmp_path / "p", stages=_stages())
    orch2.ensure_ingested(SAMPLE)
    assert orch2.manifest.stats()["by_status"]["enriched"] == 11, \
        "续跑丢进度——ensure_ingested 误重新解析了"


def test_rerun_does_not_resave_manifest(tmp_path):
    """续跑路径应是纯加载，不改写 manifest 的 source_hash。"""
    orch = Orchestrator(project_dir=tmp_path / "p", stages=_stages())
    orch.ensure_ingested(SAMPLE)
    h1 = orch.manifest.source_hash
    orch2 = Orchestrator(project_dir=tmp_path / "p", stages=_stages())
    orch2.ensure_ingested(SAMPLE)
    assert orch2.manifest.source_hash == h1


def test_changed_screenplay_raises(tmp_path):
    """剧本被改动 + 已有进度 → 抛错，绝不静默覆盖。"""
    orch = Orchestrator(project_dir=tmp_path / "p", stages=_stages())
    orch.ensure_ingested(SAMPLE)
    orch.run(only=["enrich"])

    modified = tmp_path / "modified.md"
    modified.write_text(SAMPLE.read_text(encoding="utf-8") + "\n> 林晚：新增台词。\n",
                        encoding="utf-8")
    orch2 = Orchestrator(project_dir=tmp_path / "p", stages=_stages())
    with pytest.raises(ScreenplayChangedError) as ei:
        orch2.ensure_ingested(modified)
    assert "--fresh" in str(ei.value)
    # 进度未被破坏
    assert Manifest.load(orch2.manifest_path).stats()["by_status"]["enriched"] == 11


def test_fresh_flag_forces_reparse(tmp_path):
    """--fresh：即使剧本改动也强制重建。"""
    orch = Orchestrator(project_dir=tmp_path / "p", stages=_stages())
    orch.ensure_ingested(SAMPLE)
    orch.run(only=["enrich"])

    modified = tmp_path / "modified.md"
    text = SAMPLE.read_text(encoding="utf-8")
    # 加一个场景，改变镜头数
    modified.write_text(text + "\n### 场景 99：新增 · 白天 · 内\n\n> 林晚：新增。\n",
                        encoding="utf-8")
    orch2 = Orchestrator(project_dir=tmp_path / "p", stages=_stages())
    m = orch2.ensure_ingested(modified, fresh=True)
    assert m.stats()["by_status"]["enriched"] == 0, "fresh 重建后进度应清零"
    assert m.stats()["shots"] == 12


def test_fresh_on_first_run_is_harmless(tmp_path):
    orch = Orchestrator(project_dir=tmp_path / "p", stages=_stages())
    m = orch.ensure_ingested(SAMPLE, fresh=True)
    assert m.stats()["shots"] == 11


# --------------------------------------------------------------------------- #
# 2. ffmpeg 缺失：环境问题不得污染镜头状态
# --------------------------------------------------------------------------- #


def test_run_cmd_raises_when_ffmpeg_missing(monkeypatch):
    """ffmpeg 不在 PATH → 抛 FFmpegMissingError，而不是返回 ok=False。"""
    import subprocess

    def boom(*a, **kw):
        raise FileNotFoundError("ffmpeg")

    monkeypatch.setattr(subprocess, "run", boom)
    with pytest.raises(FFmpegMissingError) as ei:
        run_cmd(["ffmpeg", "-i", "a.mp4", "out.mp4"])
    assert "ffmpeg" in str(ei.value)


def test_run_cmd_dry_run_never_touches_ffmpeg(monkeypatch):
    """dry-run 不应调用 subprocess，故无 ffmpeg 也能构造命令。"""
    import subprocess
    called = []
    monkeypatch.setattr(subprocess, "run", lambda *a, **kw: called.append(a))
    res = run_cmd(["ffmpeg", "-i", "a.mp4", "out.mp4"], dry_run=True)
    assert res.ok
    assert not called


def test_assemble_failure_does_not_mark_shots_failed(manifest, tmp_path, monkeypatch):
    """核心回归：装配阶段因环境问题失败时，镜头状态必须保持 subtitled。

    若把镜头标 failed，因 failed 不在 assemble.consumes 里，装好 ffmpeg 后重跑
    也无法恢复——3000 镜头的任务会永久卡死。
    """
    import subprocess

    def boom(*a, **kw):
        raise FileNotFoundError("ffmpeg")

    monkeypatch.setattr(subprocess, "run", boom)

    for sh in manifest.iter_shots():
        sh.status = ShotStatus.subtitled
        sh.clip_path = "clips/x.mp4"

    orch = Orchestrator(project_dir=tmp_path / "p", stages=_stages(), dry_run=False)
    orch.manifest = manifest
    orch.manifest.save(orch.manifest_path)
    summary = orch.run(only=["assemble"])

    assert summary["assemble"]["failed"] > 0, "集应报失败"
    assert summary["assemble"]["episodes"] == 0
    by = orch.manifest.stats()["by_status"]
    assert by["failed"] == 0, f"镜头被误标 failed：{by}"
    assert by["subtitled"] == 11, f"镜头状态应保持 subtitled：{by}"


def test_assemble_recovers_after_ffmpeg_installed(manifest, tmp_path, monkeypatch):
    """装好 ffmpeg（此处用 dry-run 模拟）后重跑，应能从 subtitled 恢复并装配成功。"""
    for sh in manifest.iter_shots():
        sh.status = ShotStatus.subtitled
        sh.clip_path = "clips/x.mp4"

    orch = Orchestrator(project_dir=tmp_path / "p", stages=_stages(), dry_run=True)
    orch.manifest = manifest
    orch.manifest.save(orch.manifest_path)
    summary = orch.run(only=["assemble"])
    assert summary["assemble"]["episodes"] == 3
    assert summary["assemble"]["failed"] == 0


# --------------------------------------------------------------------------- #
# 3. 退出码
# --------------------------------------------------------------------------- #


def test_exit_code_success():
    from run import _exit_code
    summary = {"enrich": {"processed": 11, "failed": 0},
               "assemble": {"episodes": 3, "failed": 0}}
    stats = {"by_status": {"assembled": 11, "failed": 0, "needs_human": 0}}
    assert _exit_code(summary, stats, None) == 0


def test_exit_code_shot_failed():
    from run import _exit_code
    summary = {"keyframe": {"processed": 10, "failed": 1}}
    stats = {"by_status": {"keyframed": 10, "failed": 1, "needs_human": 0}}
    assert _exit_code(summary, stats, None) == 4


def test_exit_code_assemble_env_failure():
    from run import _exit_code
    summary = {"assemble": {"episodes": 0, "failed": 3}}
    stats = {"by_status": {"subtitled": 11, "failed": 0, "needs_human": 0}}
    assert _exit_code(summary, stats, None) == 5


def test_exit_code_needs_human_takes_precedence():
    from run import _exit_code
    summary = {"keyframe": {"processed": 0, "failed": 11}}
    stats = {"by_status": {"needs_human": 11, "failed": 0}}
    assert _exit_code(summary, stats, None) == 6


def test_exit_code_stale_failed_in_stats():
    """summary 里没有 failed，但 manifest 状态分布有（上轮遗留）→ 仍应报 4。"""
    from run import _exit_code
    summary = {"video": {"processed": 0, "skipped": 10, "failed": 0}}
    stats = {"by_status": {"rendered": 10, "failed": 1, "needs_human": 0}}
    assert _exit_code(summary, stats, None) == 4
