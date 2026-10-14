"""端到端与控制面测试。

覆盖本机可验证的部分：S0 校验、S1 解析、S7 字幕、S9/S10 装配命令构造、
manifest 契约 round-trip、以及 orchestrator 全流程（stub 引擎）。
GPU 阶段在服务器接线后另行集成测试。
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline.assemble import (
    RenderSpec,
    concat_drama_cmd,
    concat_episode_cmd,
    mix_episode_audio_cmd,
    normalize_shot_cmd,
)
from pipeline.contracts import (
    Manifest,
    ShotStatus,
    manifest_from_raw,
)
from pipeline.orchestrator import Orchestrator, StageSpec
from pipeline.parser import parse_screenplay
from pipeline.stages import AssembleStage, ConcatStage, NullStage, StubEngine, SubtitleStage
from pipeline.subtitles import build_ass, build_srt, estimate_timings
from pipeline.validate import validate

ROOT = Path(__file__).resolve().parent.parent
SAMPLE = ROOT / "examples" / "sample_screenplay.md"


# --------------------------------------------------------------------------- #
# fixtures
# --------------------------------------------------------------------------- #


@pytest.fixture(scope="session")
def sample_text() -> str:
    return SAMPLE.read_text(encoding="utf-8")


@pytest.fixture()
def raw(sample_text) -> dict:
    return parse_screenplay(sample_text)


@pytest.fixture()
def manifest(raw) -> Manifest:
    return manifest_from_raw(raw)


# --------------------------------------------------------------------------- #
# S1 解析
# --------------------------------------------------------------------------- #


def test_parse_front_matter(raw):
    assert raw["title"] == "闪婚之后满级大佬"
    assert raw["meta"]["aspect_ratio"] == "9:16"   # 不被 YAML 当六十进制
    assert raw["meta"]["language"] == "zh"


def test_parse_structure_counts(raw):
    s = raw["_stats"]
    assert s["episodes"] == 3
    assert s["scenes"] == 6
    assert s["characters"] == 5
    assert s["dialogue_lines"] >= 20


def test_parse_characters(raw):
    names = {c["name"] for c in raw["characters"]}
    assert {"林晚", "顾沉", "林母", "苏曼", "秦特助"} <= names
    linwan = next(c for c in raw["characters"] if c["name"] == "林晚")
    assert linwan["gender"] == "女"
    assert linwan["age"] == 28
    assert "长直黑发" in linwan["appearance"]


def test_parse_scene_heading_fields(raw):
    sc = raw["episodes"][0]["scenes"][0]
    assert sc["location"] == "民政局门口"
    assert sc["time"] == "白天"
    assert sc["int_ext"] == "外"
    assert sc["mood"] is not None


def test_parse_character_list_paren_aware(raw):
    sc = raw["episodes"][0]["scenes"][0]
    # 括号内的逗号不应把角色描述切碎
    assert any("林晚（白衬衫" in c for c in sc["characters"])
    assert any("顾沉（黑西装" in c for c in sc["characters"])


def test_parse_dialogue_kinds(raw):
    kinds = {ln["kind"] for ep in raw["episodes"] for sc in ep["scenes"]
             for sh in sc["shots"] for ln in sh["lines"]}
    assert "dialogue" in kinds
    assert "os" in kinds   # 内心OS 被正确识别


def test_parse_emotion_and_speaker(raw):
    lines = [ln for ep in raw["episodes"] for sc in ep["scenes"]
             for sh in sc["shots"] for ln in sh["lines"]]
    guchen = next(ln for ln in lines if ln["speaker"] == "顾沉" and "想清楚" in ln["text"])
    assert guchen["emotion"] == "冷淡"


# --------------------------------------------------------------------------- #
# S0 校验
# --------------------------------------------------------------------------- #


def test_validate_sample_passes(sample_text):
    rep = validate(sample_text, "sample")
    assert rep.ok, [i.to_dict() for i in rep.errors]


def test_validate_catches_errors():
    bad = "---\ntitle: x\naspect_ratio: 9:16\n---\n\n# a\n# b\n\n#### 场景\n正文\n"
    rep = validate(bad, "bad")
    codes = {i.code for i in rep.errors}
    assert "ASPECT_UNQUOTED" in codes
    assert "MULTI_H1" in codes
    assert "HEADING_TOO_DEEP" in codes


def test_validate_empty_scene_is_error():
    md = "# t\n\n### 场景 1：房间 · 白天 · 内\n"
    rep = validate(md, "x")
    assert any(i.code == "EMPTY_SCENE" for i in rep.errors)


# --------------------------------------------------------------------------- #
# manifest 契约
# --------------------------------------------------------------------------- #


def test_manifest_roundtrip(manifest, tmp_path):
    p = tmp_path / "manifest.json"
    manifest.save(p)
    m2 = Manifest.load(p)
    assert m2.meta.title == manifest.meta.title
    assert m2.stats()["shots"] == manifest.stats()["shots"]


def test_manifest_status_transition(manifest):
    shot = next(manifest.iter_shots())
    assert shot.status == ShotStatus.parsed
    shot.status = ShotStatus.enriched
    assert len(manifest.shots_with_status(ShotStatus.enriched)) == 1


def test_manifest_enriched_fields_persist(manifest, tmp_path):
    shot = next(manifest.iter_shots())
    shot.visual_prompt_en = "vertical 9:16, medium shot"
    shot.est_seconds = 5.0
    shot.status = ShotStatus.enriched
    p = tmp_path / "m.json"
    manifest.save(p)
    m2 = Manifest.load(p)
    s2 = next(m2.iter_shots())
    assert s2.visual_prompt_en == "vertical 9:16, medium shot"
    assert s2.est_seconds == 5.0


def test_manifest_os_kind_preserved(manifest):
    assert any(l.kind.value == "os" for sh in manifest.iter_shots() for l in sh.lines)


# --------------------------------------------------------------------------- #
# S7 字幕
# --------------------------------------------------------------------------- #


def test_estimate_timings_monotonic():
    lines = [{"text": "第一句话"}, {"text": "第二句更长的话内容"}, {"text": "短"}]
    timed = estimate_timings(lines, start=0.0, gap=0.1)
    for a, b in zip(timed, timed[1:]):
        assert a["end"] <= b["start"] + 1e-6
    assert timed[0]["start"] == 0.0


def test_build_srt_format():
    lines = [{"speaker": "顾沉", "text": "想清楚了？", "start": 0.0, "end": 2.0, "kind": "dialogue"}]
    srt = build_srt(lines)
    assert srt.startswith("1\n")
    assert "00:00:00,000 --> 00:00:02,000" in srt
    assert "顾沉：" in srt
    assert "想清楚了？" in srt


def test_build_ass_os_style():
    lines = [{"speaker": "林晚", "text": "我别无选择", "start": 0.0, "end": 2.0, "kind": "os"}]
    ass = build_ass(lines)
    assert "Style: OS," in ass
    assert ",OS,," in ass   # OS 事件用 OS 样式


def test_subtitle_stage_writes_files(manifest, tmp_path):
    # 模拟 TTS 已回填时间戳
    for sh in manifest.iter_shots():
        for i, ln in enumerate(sh.lines):
            ln.start, ln.end = float(i), float(i + 1)
        sh.status = ShotStatus.voiced
    stage = SubtitleStage()
    from pipeline.orchestrator import StageContext
    ctx = StageContext(project_dir=tmp_path, manifest=manifest)
    shot = next(s for s in manifest.iter_shots() if s.lines)
    new_status = stage.run_shot(shot, ctx)   # stage 返回新状态，由编排器赋值
    assert shot.srt_path and Path(shot.srt_path).exists()
    assert shot.ass_path and Path(shot.ass_path).exists()
    assert new_status == ShotStatus.subtitled


# --------------------------------------------------------------------------- #
# S9/S10 装配命令构造
# --------------------------------------------------------------------------- #


def test_renderspec_aspect():
    assert RenderSpec.from_aspect("9:16").width == 1080
    assert RenderSpec.from_aspect("9:16").height == 1920
    assert RenderSpec.from_aspect("16:9").width == 1920
    assert RenderSpec.from_aspect("16:9").height == 1080


def test_normalize_inputs_before_options():
    spec = RenderSpec()
    for audio, ass in [("v.wav", "s.ass"), (None, None)]:
        cmd = normalize_shot_cmd("c.mp4", audio, ass, "o.mp4", spec)
        joined = " ".join(cmd)
        in_idx = [i for i, x in enumerate(cmd) if x == "-i"]
        vf_idx = cmd.index("-vf")
        assert max(in_idx) < vf_idx   # ffmpeg 位置敏感：输入必须在选项前
        assert "-map 1:a:0" in joined    # 音轨（对白或静音源）在 index 1


def test_concat_list_content():
    cmd, lst = concat_episode_cmd(["a.mp4", "b.mp4"], "ep.mp4")
    assert lst.startswith("ffconcat version 1.0")
    assert "file a.mp4" in lst and "file b.mp4" in lst
    assert "-c copy" in " ".join(cmd)   # 无损拼接


def test_mix_bgm_ducking():
    cmd = mix_episode_audio_cmd(["d1.wav"], "bgm.wav", ["sfx.wav"], "mix.wav")
    fc = " ".join(cmd)
    assert "sidechaincompress" in fc   # BGM 自动 ducking
    assert "loudnorm" in fc


def test_concat_drama_lossless():
    cmd, lst = concat_drama_cmd(["ep01.mp4", "ep02.mp4"], "full.mp4")
    assert "-c copy" in " ".join(cmd)
    assert "ep01.mp4" in lst


# --------------------------------------------------------------------------- #
# 编排器全流程（stub）
# --------------------------------------------------------------------------- #


def _stub_stages() -> dict:
    stub = StubEngine()
    return {
        "enrich": StageSpec(NullStage("enrich", (ShotStatus.parsed,), ShotStatus.enriched, stub, write_artifact=False)),
        "keyframe": StageSpec(NullStage("keyframe", (ShotStatus.enriched,), ShotStatus.keyframed, stub, "keyframes", "keyframe_path", ".png")),
        "video": StageSpec(NullStage("video", (ShotStatus.keyframed,), ShotStatus.rendered, stub, "clips", "clip_path", ".mp4")),
        "tts": StageSpec(NullStage("tts", (ShotStatus.rendered,), ShotStatus.voiced, stub, "voices", "audio_path", ".wav")),
        "subtitle": StageSpec(SubtitleStage()),
        "bgm": StageSpec(NullStage("bgm", (ShotStatus.subtitled,), ShotStatus.subtitled, stub, "music", "bgm_pick", ".wav")),
        "assemble": StageSpec(AssembleStage()),
        "concat": StageSpec(ConcatStage()),
    }


def test_orchestrator_end_to_end_dry(sample_text, tmp_path):
    orch = Orchestrator(project_dir=tmp_path / "proj", stages=_stub_stages(), dry_run=True)
    orch.ingest(SAMPLE)
    summary = orch.run()
    # 所有镜头走到 assembled
    stats = orch.manifest.stats()
    assert stats["by_status"]["assembled"] == stats["shots"]
    assert stats["by_status"]["failed"] == 0
    assert summary["concat"]["final_path"]


def test_orchestrator_writes_artifacts(sample_text, tmp_path):
    """非 dry-run：stub 写占位产物 + 真实字幕文件。assemble/concat 因无 ffmpeg 只到命令构造。"""
    stages = _stub_stages()
    orch = Orchestrator(project_dir=tmp_path / "proj", stages=stages, dry_run=False)
    orch.ingest(SAMPLE)
    # 只跑到字幕（assemble 需 ffmpeg，本机没有）
    orch.run(only=["enrich", "keyframe", "video", "tts", "subtitle", "bgm"])
    proj = tmp_path / "proj"
    assert any((proj / "keyframes").glob("*.png"))
    assert any((proj / "voices").glob("*.wav"))
    assert any((proj / "subs").glob("*.srt"))
    assert any((proj / "subs").glob("*.ass"))
    # 状态推进到 subtitled
    assert orch.manifest.stats()["by_status"]["subtitled"] == orch.manifest.stats()["shots"]


def test_orchestrator_resume_skips_done(tmp_path):
    """断点续跑：第二次 run 应跳过已完成的 shot。"""
    orch = Orchestrator(project_dir=tmp_path / "proj", stages=_stub_stages(), dry_run=True)
    orch.ingest(SAMPLE)
    orch.run(only=["enrich"])
    n_enriched = orch.manifest.stats()["by_status"]["enriched"]
    assert n_enriched > 0
    # 重新载入并再跑 enrich —— 应全部 skip
    orch2 = Orchestrator(project_dir=tmp_path / "proj", stages=_stub_stages(), dry_run=True)
    orch2.load()
    summary = orch2.run(only=["enrich"], resume=True)
    assert summary["enrich"]["skipped"] == n_enriched
    assert summary["enrich"]["processed"] == 0


def test_orchestrator_rejects_invalid_screenplay(tmp_path):
    bad = tmp_path / "bad.md"
    bad.write_text("# t\n\n#### 场景\n无对白\n", encoding="utf-8")
    orch = Orchestrator(project_dir=tmp_path / "proj", stages=_stub_stages(), dry_run=True)
    with pytest.raises(ValueError, match="校验未通过"):
        orch.ingest(bad)
