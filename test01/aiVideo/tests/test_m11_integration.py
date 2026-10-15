"""M11 集成验证 —— canon 从 run.py/ingest 一路流到 EnrichStage，实现零 bible 调用。

单元测试（test_enrich_m11）直接构造 ctx.config['canon']，没验证完整接线。
本文件走真实路径：ingest(canon_path=...) -> orchestrator.config -> ctx -> EnrichStage，
证明整条链路通，canon 复用真的省掉了角色圣经的 LLM 推导。
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline.contracts import ShotStatus
from pipeline.orchestrator import Orchestrator, StageSpec
from pipeline.stages.enrich import EnrichStage

from test_enrich_m11 import CountingLLM   # 复用计数 mock

ROOT = Path(__file__).resolve().parent.parent
SAMPLE = ROOT / "examples" / "sample_screenplay.md"


@pytest.fixture()
def canon_file(tmp_path):
    """写一个阶段 A 风格的 canon.json。"""
    canon = {
        "title": "闪婚之后满级大佬",
        "style": "写实电影感",
        "style_en": "cinematic realism, warm grade, 9:16 vertical",
        "characters": [
            {"name": "林晚", "identity_blob": "CANON: young woman, long black hair, white suit, silver necklace",
             "costume": "white suit", "voice_tag": "female 28 clear resilient", "seed_base": 1000000},
            {"name": "顾沉", "identity_blob": "CANON: tall man, short hair, black tailored suit, platinum watch",
             "costume": "black suit", "voice_tag": "male 32 deep cold", "seed_base": 1007919},
            {"name": "林母", "identity_blob": "CANON: elderly woman, short grey curly hair",
             "costume": "cardigan", "voice_tag": "female 55 warm", "seed_base": 1015838},
            {"name": "苏曼", "identity_blob": "CANON: woman 30, curly hair, red lips, gown",
             "costume": "gown", "voice_tag": "female 30 sharp", "seed_base": 1023757},
            {"name": "秦特助", "identity_blob": "CANON: man 35, glasses, grey suit",
             "costume": "grey suit", "voice_tag": "male 35 formal", "seed_base": 1031676},
        ],
    }
    p = tmp_path / "canon.json"
    p.write_text(json.dumps(canon, ensure_ascii=False, indent=2), encoding="utf-8")
    return p


# --------------------------------------------------------------------------- #
# 完整接线：ingest(canon_path) -> EnrichStage 零 bible 调用
# --------------------------------------------------------------------------- #


def test_canon_flows_through_ingest_to_enrich(tmp_path, canon_file):
    """经真实 ingest 路径，canon 应到达 EnrichStage 并省掉 bible 调用。"""
    llm = CountingLLM()
    stages = {"enrich": StageSpec(EnrichStage(llm), retries=0)}
    orch = Orchestrator(project_dir=tmp_path / "proj", stages=stages)
    orch.ingest(SAMPLE, canon_path=canon_file)

    # canon 被载入 config + manifest 记录了路径
    assert orch.config.get("canon"), "canon 未进 orchestrator.config"
    assert orch.manifest.canon_path == str(canon_file)

    orch.run(only=["enrich"])

    # 核心保证：零 bible 调用（canon 复用生效）
    assert "bible" not in llm.calls, f"canon 已提供却仍调了 bible：{llm.calls}"
    # 每场景一次 scene 调用（run_scene 批量）
    assert "scene" in llm.calls
    assert llm.calls.count("scene") == len(list(orch.manifest.iter_scenes()))


def test_canon_identity_blob_reaches_shots(tmp_path, canon_file):
    """canon 的 identity_blob 必须真正进到镜头的 character_ids + prompt 里。"""
    llm = CountingLLM()
    orch = Orchestrator(project_dir=tmp_path / "proj",
                        stages={"enrich": StageSpec(EnrichStage(llm), retries=0)})
    orch.ingest(SAMPLE, canon_path=canon_file)
    orch.run(only=["enrich"])

    linwan = orch.manifest.character_by_name("林晚")
    assert linwan.identity_blob.startswith("CANON:")   # 来自 canon，非 LLM 推导
    assert linwan.voice_tag == "female 28 clear resilient"
    assert linwan.seed_base == 1000000                  # canon 的 seed_base 被复用
    # 至少一个镜头带上了林晚的 character_id
    assert any(linwan.id in sh.character_ids for sh in orch.manifest.iter_shots())


def test_canon_global_style_applied(tmp_path, canon_file):
    llm = CountingLLM()
    orch = Orchestrator(project_dir=tmp_path / "proj",
                        stages={"enrich": StageSpec(EnrichStage(llm), retries=0)})
    orch.ingest(SAMPLE, canon_path=canon_file)
    orch.run(only=["enrich"])
    shot = next(orch.manifest.iter_shots())
    assert shot.visual_prompt_en.startswith("cinematic realism")


def test_no_canon_falls_back_to_llm_bible(tmp_path):
    """无 canon（手写剧本）-> 调一次 LLM 推导 bible，仍正常工作。"""
    llm = CountingLLM()
    orch = Orchestrator(project_dir=tmp_path / "proj",
                        stages={"enrich": StageSpec(EnrichStage(llm), retries=0)})
    orch.ingest(SAMPLE)          # 不给 canon_path
    assert orch.config.get("canon") is None
    orch.run(only=["enrich"])
    assert llm.calls.count("bible") == 1, f"无 canon 时应调一次 bible：{llm.calls}"


def test_missing_canon_file_degrades_gracefully(tmp_path):
    """canon_path 指向不存在的文件 -> warning 并退化为 LLM 推导，不崩。"""
    llm = CountingLLM()
    orch = Orchestrator(project_dir=tmp_path / "proj",
                        stages={"enrich": StageSpec(EnrichStage(llm), retries=0)})
    orch.ingest(SAMPLE, canon_path=tmp_path / "nonexistent.json")
    assert orch.config.get("canon") is None
    orch.run(only=["enrich"])
    assert llm.calls.count("bible") == 1     # 退化到 LLM 推导


def test_corrupt_canon_degrades_gracefully(tmp_path):
    """canon.json 损坏 -> warning 并退化，不崩。"""
    bad = tmp_path / "bad.json"
    bad.write_text("{ 半截 json", encoding="utf-8")
    llm = CountingLLM()
    orch = Orchestrator(project_dir=tmp_path / "proj",
                        stages={"enrich": StageSpec(EnrichStage(llm), retries=0)})
    orch.ingest(SAMPLE, canon_path=bad)
    assert orch.config.get("canon") is None
    orch.run(only=["enrich"])
    assert llm.calls.count("bible") == 1


# --------------------------------------------------------------------------- #
# 续跑时也复用 canon
# --------------------------------------------------------------------------- #


def test_resume_reloads_canon(tmp_path, canon_file):
    """续跑（ensure_ingested 加载已有 manifest）也应重新载入 canon，S2 不重复推导。"""
    llm = CountingLLM()
    orch = Orchestrator(project_dir=tmp_path / "proj",
                        stages={"enrich": StageSpec(EnrichStage(llm), retries=0)})
    orch.ingest(SAMPLE, canon_path=canon_file)
    orch.run(only=["enrich"])

    # 新进程续跑：不传 canon_path，靠 manifest.canon_path 找回
    llm2 = CountingLLM()
    orch2 = Orchestrator(project_dir=tmp_path / "proj",
                         stages={"enrich": StageSpec(EnrichStage(llm2), retries=0)})
    orch2.ensure_ingested(SAMPLE)          # 未显式传 canon_path
    assert orch2.config.get("canon"), "续跑未从 manifest.canon_path 找回 canon"
    orch2.run(only=["enrich"], resume=True)
    assert "bible" not in llm2.calls, "续跑仍调了 bible"


def test_call_count_scales_with_scenes_not_shots(tmp_path, canon_file):
    """核心收益：enrich 的 LLM 调用数 ~ 场景数，而非镜头数。"""
    llm = CountingLLM()
    orch = Orchestrator(project_dir=tmp_path / "proj",
                        stages={"enrich": StageSpec(EnrichStage(llm), retries=0)})
    orch.ingest(SAMPLE, canon_path=canon_file)
    orch.run(only=["enrich"])
    n_shots = len(list(orch.manifest.iter_shots()))
    n_scenes = len(list(orch.manifest.iter_scenes()))
    total_calls = len(llm.calls)
    assert total_calls == n_scenes, f"应每场景 1 次调用：{total_calls} vs {n_scenes}"
    assert total_calls < n_shots, "批量调用数应少于镜头数"
