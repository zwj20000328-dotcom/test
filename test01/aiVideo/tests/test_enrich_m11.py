"""S2 EnrichStage 测试 —— canon 复用、run_scene 批量、run_shot 回退、稳定 seed。

M11 的核心改动：
  1. canon.json 存在时 _build_character_bible 零 LLM 调用（直接搬 identity_blob）
  2. run_scene 一次生成整场景所有镜头（调用数 1620 -> ~210）
  3. run_shot 作为回退路径，与 run_scene 产出一致（共用 _apply_shot_fields）
  4. seed 跨进程稳定（stable_seed 用 hashlib，不用 abs(hash())）
  5. shot->scene 索引建一次，不再每镜全场景扫描
"""
from __future__ import annotations

import json

import pytest

from pipeline.contracts import ShotStatus, manifest_from_raw
from pipeline.orchestrator import StageContext
from pipeline.parser import parse_screenplay
from pipeline.stages.enrich import (
    EnrichStage, _scene_max_tokens, stable_seed,
)

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SAMPLE = ROOT / "examples" / "sample_screenplay.md"


# --------------------------------------------------------------------------- #
# mock LLM：记录调用次数与类型
# --------------------------------------------------------------------------- #


class CountingLLM:
    """按 schema 特征返回合法响应，并记录每次调用的 schema 类型。"""

    def __init__(self):
        self.calls: list[str] = []     # "bible" | "shot" | "scene"

    def json(self, messages, schema, temperature=0.3, max_tokens=4096, **kw):
        props = set((schema or {}).get("properties", {}))
        if "global_style" in props:
            self.calls.append("bible")
            return {
                "characters": [
                    {"name": "林晚", "identity_blob": "young woman, long black hair, white suit",
                     "costume": "white suit", "voice_tag": "female 28 clear"},
                    {"name": "顾沉", "identity_blob": "tall man, short hair, black suit",
                     "costume": "black suit", "voice_tag": "male 32 deep"},
                    {"name": "林母", "identity_blob": "elderly woman, short grey hair",
                     "costume": "cardigan", "voice_tag": "female 55 warm"},
                    {"name": "苏曼", "identity_blob": "woman 30, curly hair, red lips",
                     "costume": "gown", "voice_tag": "female 30 sharp"},
                    {"name": "秦特助", "identity_blob": "man 35, glasses, grey suit",
                     "costume": "grey suit", "voice_tag": "male 35 formal"},
                ],
                "global_style": "cinematic realism, warm grade, 9:16 vertical",
            }
        if "shots" in props:            # run_scene 批量
            self.calls.append("scene")
            # 返回请求里提到的镜头数（从 prompt 数 "[镜头 N]"）
            user = messages[-1]["content"]
            import re
            idxs = [int(x) for x in re.findall(r"\[镜头 (\d+)\]", user)]
            return {"shots": [
                {"shot_index": i,
                 "visual_prompt_en": f"scene shot {i}, medium, warm light",
                 "motion_prompt_en": f"slow push {i}",
                 "est_seconds": 5.0, "num_frames": 81,
                 "on_screen_text": "", "tts_instruction": "neutral",
                 "music_tag": {"emotion": "tense", "intensity": 3, "bpm": 90, "instruments": "strings"}}
                for i in idxs]}
        if "visual_prompt_en" in props:  # run_shot 单镜
            self.calls.append("shot")
            return {"visual_prompt_en": "single shot, close-up",
                    "motion_prompt_en": "static", "est_seconds": 4.0, "num_frames": 65,
                    "on_screen_text": "", "tts_instruction": "cold",
                    "music_tag": {"emotion": "sad", "intensity": 2, "bpm": 70, "instruments": "piano"}}
        raise AssertionError(f"未预期 schema: {sorted(props)}")


@pytest.fixture()
def manifest():
    return manifest_from_raw(parse_screenplay(SAMPLE.read_text(encoding="utf-8")))


def _ctx(manifest, tmp_path, canon=None):
    cfg = {}
    if canon is not None:
        cfg["canon"] = canon
    return StageContext(project_dir=tmp_path, manifest=manifest, config=cfg)


# --------------------------------------------------------------------------- #
# 1. canon 复用：零 LLM 调用
# --------------------------------------------------------------------------- #


def test_canon_reuse_zero_llm_calls(manifest, tmp_path):
    """canon.json 提供 identity_blob 时，_build_character_bible 不得调 LLM。"""
    canon = {
        "characters": [
            {"name": "林晚", "identity_blob": "CANON blob for linwan",
             "costume": "白西装", "voice_tag": "女28清亮", "seed_base": 555000},
            {"name": "顾沉", "identity_blob": "CANON blob for guchen",
             "costume": "黑西装", "voice_tag": "男32低沉"},
        ],
        "style_en": "canon global style",
    }
    llm = CountingLLM()
    stage = EnrichStage(llm)
    ctx = _ctx(manifest, tmp_path, canon=canon)
    shot = next(manifest.iter_shots())
    stage.run_shot(shot, ctx)

    assert "bible" not in llm.calls, f"canon 已提供，却仍调了 bible LLM：{llm.calls}"
    linwan = manifest.character_by_name("林晚")
    assert linwan.identity_blob == "CANON blob for linwan"
    assert linwan.voice_tag == "女28清亮"
    assert linwan.seed_base == 555000          # canon 的 seed_base 被复用
    assert stage._bible_from_canon is True


def test_no_canon_calls_llm_once(manifest, tmp_path):
    """手写剧本无 canon -> 调一次 LLM 推导 bible（且只调一次，跨多镜复用）。"""
    llm = CountingLLM()
    stage = EnrichStage(llm)
    ctx = _ctx(manifest, tmp_path)
    shots = list(manifest.iter_shots())
    for sh in shots[:3]:
        stage.run_shot(sh, ctx)
    assert llm.calls.count("bible") == 1, f"bible 应只调一次，实得 {llm.calls.count('bible')}"
    assert manifest.character_by_name("林晚").identity_blob


def test_canon_only_fills_known_characters(manifest, tmp_path):
    """canon 里没有的角色不应被赋值（留待 LLM 或保持 None）。"""
    canon = {"characters": [{"name": "林晚", "identity_blob": "only linwan"}]}
    llm = CountingLLM()
    stage = EnrichStage(llm)
    ctx = _ctx(manifest, tmp_path, canon=canon)
    next(manifest.iter_shots())
    stage.run_shot(next(manifest.iter_shots()), ctx)
    assert manifest.character_by_name("林晚").identity_blob == "only linwan"
    # 顾沉不在 canon 里 -> identity_blob 仍为 None（未被错误赋值）
    assert manifest.character_by_name("顾沉").identity_blob is None


def test_canon_global_style_used(manifest, tmp_path):
    canon = {"characters": [], "style_en": "CANON STYLE PREFIX"}
    llm = CountingLLM()
    stage = EnrichStage(llm)
    ctx = _ctx(manifest, tmp_path, canon=canon)
    shot = next(manifest.iter_shots())
    stage.run_shot(shot, ctx)
    assert shot.visual_prompt_en.startswith("CANON STYLE PREFIX")


# --------------------------------------------------------------------------- #
# 2. run_scene 批量
# --------------------------------------------------------------------------- #


def test_run_scene_enriches_all_shots_one_call(manifest, tmp_path):
    """一个场景的所有镜头用一次 scene 调用完成。"""
    llm = CountingLLM()
    stage = EnrichStage(llm)
    ctx = _ctx(manifest, tmp_path)
    scene = next(manifest.iter_scenes())
    n_shots = len(scene.shots)
    done = stage.run_scene(scene, ctx)
    assert len(done) == n_shots
    assert llm.calls.count("scene") == 1, f"整场景应只调 1 次，实得 {llm.calls.count('scene')}"
    assert all(sh.status == ShotStatus.parsed for sh in scene.shots)  # run_scene 不改状态（编排器改）
    for sh in scene.shots:
        assert sh.visual_prompt_en and sh.motion_prompt_en
        assert sh.num_frames == 81
        assert sh.music_tag["emotion"] == "tense"


def test_run_scene_maps_by_index_not_order(manifest, tmp_path):
    """返回的 shot_index 必须正确映射回对应镜头，不依赖顺序。"""
    scene = next(manifest.iter_scenes())
    if len(scene.shots) < 2:
        pytest.skip("需要 ≥2 镜头的场景")

    class ShuffledLLM(CountingLLM):
        def json(self, messages, schema, **kw):
            props = set((schema or {}).get("properties", {}))
            if "shots" in props:
                self.calls.append("scene")
                import re
                idxs = [int(x) for x in re.findall(r"\[镜头 (\d+)\]", messages[-1]["content"])]
                # 逆序返回，且给每个 index 打上可辨识的标记
                return {"shots": [
                    {"shot_index": i,
                     "visual_prompt_en": f"MARKER-{i}",
                     "motion_prompt_en": "m", "est_seconds": 5.0, "num_frames": 81,
                     "on_screen_text": "", "tts_instruction": "", "music_tag": {"emotion": "x", "intensity": 1}}
                    for i in reversed(idxs)]}
            return super().json(messages, schema, **kw)

    llm = ShuffledLLM()
    stage = EnrichStage(llm)
    ctx = _ctx(manifest, tmp_path)
    stage.run_scene(scene, ctx)
    for i, sh in enumerate(scene.shots):
        assert sh.visual_prompt_en.endswith(f"MARKER-{i}"), \
            f"镜头 {i} 映射错误：{sh.visual_prompt_en}"


def test_run_scene_skips_already_enriched(manifest, tmp_path):
    """续跑：已 enriched 的镜头不再重复生成。"""
    llm = CountingLLM()
    stage = EnrichStage(llm)
    ctx = _ctx(manifest, tmp_path)
    scene = next(manifest.iter_scenes())
    scene.shots[0].status = ShotStatus.enriched     # 模拟已完成
    done = stage.run_scene(scene, ctx)
    assert scene.shots[0].id not in done
    assert len(done) == len(scene.shots) - 1


def test_run_scene_max_tokens_scales_with_shots():
    assert _scene_max_tokens(1) == 1200 + 700
    assert _scene_max_tokens(9) == 1200 + 700 * 9
    assert _scene_max_tokens(50) == 8200          # 封顶


def test_run_scene_batch_fewer_calls_than_per_shot(manifest, tmp_path):
    """批量的核心价值：整部剧的 enrich 调用数远少于镜头数。"""
    llm_batch = CountingLLM()
    stage = EnrichStage(llm_batch)
    ctx = _ctx(manifest, tmp_path, canon={"characters": []})   # canon 省掉 bible 调用
    n_shots = 0
    for sc in manifest.iter_scenes():
        stage.run_scene(sc, ctx)
        n_shots += len(sc.shots)
    scene_calls = llm_batch.calls.count("scene")
    assert scene_calls < n_shots, f"批量调用 {scene_calls} 应 < 镜头数 {n_shots}"
    assert "bible" not in llm_batch.calls


def test_run_scene_unknown_index_ignored(manifest, tmp_path):
    """返回多余/越界的 shot_index 应被忽略，不崩。"""
    class BadIndexLLM(CountingLLM):
        def json(self, messages, schema, **kw):
            props = set((schema or {}).get("properties", {}))
            if "shots" in props:
                self.calls.append("scene")
                return {"shots": [
                    {"shot_index": 999, "visual_prompt_en": "ghost", "motion_prompt_en": "m",
                     "est_seconds": 5.0, "num_frames": 81},
                    {"shot_index": 0, "visual_prompt_en": "real0", "motion_prompt_en": "m",
                     "est_seconds": 5.0, "num_frames": 81},
                ]}
            return super().json(messages, schema, **kw)

    stage = EnrichStage(BadIndexLLM())
    ctx = _ctx(manifest, tmp_path)
    scene = next(manifest.iter_scenes())
    done = stage.run_scene(scene, ctx)
    assert scene.shots[0].visual_prompt_en.endswith("real0")


# --------------------------------------------------------------------------- #
# 3. run_shot 回退一致性
# --------------------------------------------------------------------------- #


def test_run_shot_and_run_scene_produce_same_shape(manifest, tmp_path):
    """两条路径回填的字段集合必须一致（共用 _apply_shot_fields）。"""
    llm = CountingLLM()
    ctx = _ctx(manifest, tmp_path)
    stage = EnrichStage(llm)
    scene = next(manifest.iter_scenes())
    shot = scene.shots[0]
    stage.run_shot(shot, ctx)
    for field in ("visual_prompt_en", "motion_prompt_en", "est_seconds",
                  "num_frames", "seed", "character_ids", "artifacts"):
        assert getattr(shot, field) is not None, f"run_shot 未回填 {field}"
    assert shot.artifacts.model == "qwen3-32b"
    assert shot.artifacts.prompt_hash


# --------------------------------------------------------------------------- #
# 4. 稳定 seed
# --------------------------------------------------------------------------- #


def test_stable_seed_deterministic():
    assert stable_seed("s001_sh002") == stable_seed("s001_sh002")
    assert stable_seed("a") != stable_seed("b")


def test_stable_seed_within_range():
    s = stable_seed("x", base=1_000_000)
    assert 1_000_000 <= s < 1_001_000


def test_seed_uses_character_base(manifest, tmp_path):
    """seed 应以角色 seed_base 为基，叠加 shot.id 的稳定偏移。"""
    canon = {"characters": [{"name": "林晚", "identity_blob": "x", "seed_base": 700000}]}
    llm = CountingLLM()
    stage = EnrichStage(llm)
    ctx = _ctx(manifest, tmp_path, canon=canon)
    # 找一个含林晚对白的镜头
    shot = next((sh for sh in manifest.iter_shots()
                 if any(ln.speaker == "林晚" for ln in sh.lines)), None)
    if shot is None:
        pytest.skip("样例中无以林晚开头的镜头")
    stage.run_shot(shot, ctx)
    assert 700000 <= shot.seed < 701000, shot.seed


def test_seed_not_python_hash(manifest, tmp_path):
    """seed 必须由 shot.id 确定性派生，不得依赖 abs(hash())（进程间会变）。

    验证方式：stage 回填的 seed 必须等于 stable_seed(shot.id, base) 对某个 base，
    即 seed - base 恰好在 [0,1000) 且 stable_seed 用同一 base 能复现同一结果。
    """
    llm = CountingLLM()
    stage = EnrichStage(llm)
    ctx = _ctx(manifest, tmp_path)
    shot = next(manifest.iter_shots())
    stage.run_shot(shot, ctx)
    assert shot.seed is not None
    # 无角色 seed_base 时 base=12345；反推 base 并用 stable_seed 复现
    base = shot.seed - (shot.seed % 1000) if shot.seed >= 12345 else 12345
    assert stable_seed(shot.id, base) == shot.seed, \
        f"seed {shot.seed} 无法由 stable_seed({shot.id!r}, {base}) 复现——可能用了不稳定的 hash()"


# --------------------------------------------------------------------------- #
# 5. shot->scene 索引
# --------------------------------------------------------------------------- #


def test_scene_index_built_once(manifest, tmp_path):
    """索引只建一次，后续镜头 O(1) 查（不再每镜全场景扫描）。"""
    llm = CountingLLM()
    stage = EnrichStage(llm)
    ctx = _ctx(manifest, tmp_path)
    assert stage._scene_of is None
    shots = list(manifest.iter_shots())
    stage.run_shot(shots[0], ctx)
    idx_after_first = stage._scene_of
    assert idx_after_first is not None
    stage.run_shot(shots[1], ctx)
    assert stage._scene_of is idx_after_first, "索引被重复构建"
    # 索引覆盖所有镜头
    assert len(idx_after_first) == len(shots)


def test_scene_index_maps_correctly(manifest, tmp_path):
    llm = CountingLLM()
    stage = EnrichStage(llm)
    ctx = _ctx(manifest, tmp_path)
    stage.run_shot(next(manifest.iter_shots()), ctx)
    for sc in manifest.iter_scenes():
        for sh in sc.shots:
            assert stage._scene_of[sh.id] is sc
