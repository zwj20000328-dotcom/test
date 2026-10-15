"""增量存档与原子写测试 —— 针对数十小时渲染任务的崩溃恢复能力。

背景：终渲阶段在 30 集规模（~1600 镜头）下约需 81 小时。若只在 stage 结束时存档一次，
中途崩溃会丢掉整个 stage 的进度并从头重渲。这两个测试锁定修复：
  1. _run_per_shot 按阈值在 stage 中途多次落盘
  2. Manifest.save 是原子写（崩溃不会留下半截 JSON）
  3. 崩溃后 resume 不重做已完成的镜头
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline.contracts import Manifest, ShotStatus, manifest_from_raw
from pipeline.orchestrator import Orchestrator, StageContext, StageSpec
from pipeline.parser import parse_screenplay
from pipeline.stages import NullStage, StubEngine

ROOT = Path(__file__).resolve().parent.parent
SAMPLE = ROOT / "examples" / "sample_screenplay.md"


@pytest.fixture()
def manifest():
    raw = parse_screenplay(SAMPLE.read_text(encoding="utf-8"))
    return manifest_from_raw(raw)


class CountingStage(NullStage):
    """记录 run_shot 调用次数，用于模拟"跑到一半崩溃"。"""

    def __init__(self, *args, crash_after: int | None = None, **kw):
        super().__init__(*args, **kw)
        self.calls = 0
        self.crash_after = crash_after

    def run_shot(self, shot, ctx: StageContext) -> ShotStatus:
        self.calls += 1
        if self.crash_after is not None and self.calls > self.crash_after:
            raise KeyboardInterrupt("模拟渲染中途崩溃")
        return super().run_shot(shot, ctx)


def _mk_stages(crash_after=None):
    stub = StubEngine()
    stage = CountingStage("enrich", (ShotStatus.parsed,), ShotStatus.enriched,
                          stub, write_artifact=False, crash_after=crash_after)
    return {"enrich": StageSpec(stage, retries=0)}, stage


# --------------------------------------------------------------------------- #
# 1. 增量存档
# --------------------------------------------------------------------------- #


def test_checkpoint_saves_mid_stage(manifest, tmp_path, monkeypatch):
    """存档必须在 stage 进行中发生，而不是只在结束时一次。

    直接调 _run_per_shot 以隔离 checkpoint 行为——run() 在 stage 结束和整轮结束时
    各有一次无条件收尾存档，会干扰计数。
    """
    stages, stage = _mk_stages()
    orch = Orchestrator(project_dir=tmp_path / "p", stages=stages,
                        checkpoint_every=2, checkpoint_interval=1e9)  # 只按镜头数触发
    orch.manifest = manifest
    orch.manifest.save(orch.manifest_path)

    saves: list[int] = []
    real_save = Manifest.save

    def spy(self, path=None):
        real_save(self, path)
        if path is not None:
            saves.append(stage.calls)   # 记录"存到第几个镜头时落盘"

    monkeypatch.setattr(Manifest, "save", spy)
    saves.clear()                        # 清掉上面显式 save 的记录
    orch._run_per_shot(stages["enrich"])

    total = len(list(manifest.iter_shots()))
    mid_stage_saves = [n for n in saves if 0 < n < total]
    assert mid_stage_saves, f"stage 中途从未存档（存档点：{saves}，共 {total} 镜）"
    assert len(mid_stage_saves) >= 2, f"中途存档次数过少：{saves}"


def test_checkpoint_interval_triggers(manifest, tmp_path, monkeypatch):
    """耗时阈值也应触发存档（轻量阶段镜头多但快）。"""
    stages, stage = _mk_stages()
    orch = Orchestrator(project_dir=tmp_path / "p", stages=stages,
                        checkpoint_every=10**9,        # 镜头数阈值形同禁用
                        checkpoint_interval=0.0)       # 每次循环都到时
    orch.manifest = manifest
    orch.manifest.save(orch.manifest_path)

    saves = []
    real_save = Manifest.save
    monkeypatch.setattr(Manifest, "save",
                        lambda self, path=None: (real_save(self, path),
                                                 saves.append(1)) if path else None)
    saves.clear()
    orch._run_per_shot(stages["enrich"])
    total = len(list(manifest.iter_shots()))
    assert len(saves) >= total, f"interval 未逐镜触发：{len(saves)} saves / {total} shots"


def test_no_checkpoint_when_nothing_dirty(manifest, tmp_path, monkeypatch):
    """resume 全跳过时不应产生任何写盘（dirty=0 则 checkpoint 直接返回）。"""
    stages, _ = _mk_stages()
    orch = Orchestrator(project_dir=tmp_path / "p", stages=stages, checkpoint_every=1)
    orch.manifest = manifest
    for sh in orch.manifest.iter_shots():
        sh.status = ShotStatus.enriched      # 全部已完成
    orch.manifest.save(orch.manifest_path)

    saves = []
    real_save = Manifest.save
    monkeypatch.setattr(Manifest, "save",
                        lambda self, path=None: (real_save(self, path),
                                                 saves.append(1)) if path else None)
    saves.clear()
    counts = orch._run_per_shot(stages["enrich"], resume=True)
    assert counts["processed"] == 0
    assert counts["skipped"] == len(list(manifest.iter_shots()))
    assert not saves, "无脏数据却写了盘"


# --------------------------------------------------------------------------- #
# 2. 原子写
# --------------------------------------------------------------------------- #


def test_save_is_atomic_no_tmp_left(manifest, tmp_path):
    p = tmp_path / "manifest.json"
    manifest.save(p)
    assert p.exists()
    assert not (tmp_path / "manifest.json.tmp").exists(), "临时文件未清理"
    assert json.loads(p.read_text(encoding="utf-8"))["meta"]["title"]


def test_save_never_leaves_partial_json(manifest, tmp_path, monkeypatch):
    """写入中途抛异常时，原文件必须保持完整（旧内容不被破坏）。"""
    p = tmp_path / "manifest.json"
    manifest.save(p)
    good = p.read_text(encoding="utf-8")

    real_write = Path.write_text

    def boom(self, data, **kw):
        if str(self).endswith(".tmp"):
            raise OSError("磁盘写入中断")
        return real_write(self, data, **kw)

    monkeypatch.setattr(Path, "write_text", boom)
    with pytest.raises(OSError):
        manifest.save(p)

    monkeypatch.undo()
    assert p.read_text(encoding="utf-8") == good, "崩溃导致原 manifest 被破坏"


# --------------------------------------------------------------------------- #
# 3. 崩溃后 resume 不重做
# --------------------------------------------------------------------------- #


def test_resume_after_crash_skips_completed(manifest, tmp_path):
    """模拟渲染到第 4 镜崩溃：已存档的进度必须被 resume 复用。"""
    stages, stage = _mk_stages(crash_after=4)
    orch = Orchestrator(project_dir=tmp_path / "p", stages=stages, checkpoint_every=1)
    orch.manifest = manifest
    orch.manifest.save(orch.manifest_path)

    with pytest.raises(KeyboardInterrupt):
        orch.run(only=["enrich"])

    # 崩溃点之前的进度已落盘
    reloaded = Manifest.load(orch.manifest_path)
    done_before = len(reloaded.shots_with_status(ShotStatus.enriched))
    assert done_before > 0, "崩溃前没有任何进度被存档 —— 增量存档失效"

    # 重启后 resume：只补剩下的，不重做已完成的
    stages2, stage2 = _mk_stages()
    orch2 = Orchestrator(project_dir=tmp_path / "p", stages=stages2, checkpoint_every=1)
    orch2.load()
    summary = orch2.run(only=["enrich"], resume=True)
    total = len(list(orch2.manifest.iter_shots()))
    assert summary["enrich"]["skipped"] == done_before
    assert summary["enrich"]["processed"] == total - done_before
    assert stage2.calls == total - done_before, "resume 重做了已完成的镜头"
    assert orch2.manifest.stats()["by_status"]["enriched"] == total
