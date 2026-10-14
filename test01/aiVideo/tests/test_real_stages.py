"""真实 GPU 阶段（S2-S8）的集成测试 —— 用 mock 引擎驱动真实 stage 逻辑。

验证点：不是 stub 占位，而是 EnrichStage/AssetsStage/KeyframeStage/VideoStage/
TTSStage/BGMStage 的**真实控制流**：prompt 组装、角色圣经、QC 门重试、
音色注册、时间戳回填、BGM 选曲。引擎用 mock（本机无 GPU/模型）。
"""
from __future__ import annotations

from pathlib import Path

import pytest

from pipeline.contracts import ShotStatus, manifest_from_raw
from pipeline.orchestrator import Orchestrator, StageContext, StageSpec
from pipeline.parser import parse_screenplay
from pipeline.stages import (
    AssembleStage, BGMStage, ConcatStage, EnrichStage, KeyframeStage,
    SubtitleStage, TTSStage, VideoStage,
)
from pipeline.stages.assets import AssetsStage
from pipeline.stages.base import _write_min_png, _write_min_wav

ROOT = Path(__file__).resolve().parent.parent
SAMPLE = ROOT / "examples" / "sample_screenplay.md"


# --------------------------------------------------------------------------- #
# mock 引擎
# --------------------------------------------------------------------------- #


class MockLLM:
    def __init__(self):
        self.calls = 0

    def json(self, messages, schema, **kw):
        self.calls += 1
        if "characters" in schema.get("properties", {}):
            return {
                "characters": [
                    {"name": "林晚", "identity_blob": "young woman, long black hair, white suit, silver necklace",
                     "costume": "white suit", "voice_tag": "female 28 clear"},
                    {"name": "顾沉", "identity_blob": "tall man, short hair, black suit, platinum watch",
                     "costume": "black suit", "voice_tag": "male 32 deep"},
                ],
                "global_style": "cinematic realism, warm grade, 9:16",
            }
        return {
            "visual_prompt_en": "medium shot, courthouse steps, noon backlight",
            "motion_prompt_en": "slow push-in", "est_seconds": 5.0, "num_frames": 81,
            "on_screen_text": "", "tts_instruction": "cold tone",
            "music_tag": {"emotion": "tense", "intensity": 3, "bpm": 90, "instruments": "strings"},
        }


class MockImage:
    def __init__(self):
        self.gen_calls = 0

    def generate(self, prompt, out_path, **kw):
        self.gen_calls += 1
        _write_min_png(Path(out_path))
        return Path(out_path)

    def edit(self, base_image, prompt, out_path, **kw):
        _write_min_png(Path(out_path))
        return Path(out_path)


class MockFaceQC:
    """按 similarity 调用次数（=QC 尝试次数）决定过不过：
    前 pass_after 次不过（0.30），之后过（0.80）。验证重试循环。"""
    def __init__(self, pass_after=0):
        self.sim_calls = 0
        self.pass_after = pass_after

    def embed(self, img):
        return [1.0]

    def similarity(self, a, b):
        self.sim_calls += 1
        return 0.30 if self.sim_calls <= self.pass_after else 0.80


class MockVideo:
    mode = "final"

    def generate(self, image_path, motion_prompt, out_path, **kw):
        Path(out_path).parent.mkdir(parents=True, exist_ok=True)
        Path(out_path).write_bytes(b"\x00\x00\x00\x18ftypmp42stub")
        return Path(out_path)


class MockTTS:
    def __init__(self):
        self.registered = []

    def register_voice(self, char_id, ref_wav, ref_text):
        self.registered.append(char_id)
        return True

    def synthesize(self, text, out_wav, **kw):
        _write_min_wav(Path(out_wav), seconds=max(0.4, len(text) / 4.5))
        return {"audio_path": str(out_wav), "sample_rate": 24000}


class MockMusic:
    def search_library(self, tag, top_k=3):
        return []   # 库空 -> 走生成

    def generate(self, prompt, out_path, **kw):
        _write_min_wav(Path(out_path), seconds=8.0)
        return Path(out_path)


# --------------------------------------------------------------------------- #
# fixtures
# --------------------------------------------------------------------------- #


@pytest.fixture()
def manifest():
    raw = parse_screenplay(SAMPLE.read_text(encoding="utf-8"))
    return manifest_from_raw(raw)


def _real_stages(engines):
    return {
        "enrich": StageSpec(EnrichStage(engines["llm"]), queue="llm"),
        "assets": StageSpec(AssetsStage(engines["image"], engines["tts"]), queue="keyframe"),
        "keyframe": StageSpec(KeyframeStage(engines["image"], engines.get("face_qc")), queue="keyframe"),
        "video": StageSpec(VideoStage(engines["video"]), queue="video"),
        "tts": StageSpec(TTSStage(engines["tts"]), queue="tts"),
        "subtitle": StageSpec(SubtitleStage(), queue="subtitle"),
        "bgm": StageSpec(BGMStage(engines["music"]), queue="music"),
        "assemble": StageSpec(AssembleStage(), queue="assembly"),
        "concat": StageSpec(ConcatStage(), queue="assembly"),
    }


# --------------------------------------------------------------------------- #
# 单元级：各真实 stage
# --------------------------------------------------------------------------- #


def test_enrich_builds_bible_and_prompts(manifest, tmp_path):
    engines = {"llm": MockLLM(), "image": MockImage()}
    stage = EnrichStage(engines["llm"])
    ctx = StageContext(project_dir=tmp_path, manifest=manifest)
    shot = next(manifest.iter_shots())
    st = stage.run_shot(shot, ctx)
    assert st == ShotStatus.enriched
    assert shot.visual_prompt_en and "cinematic" in shot.visual_prompt_en.lower()
    assert shot.motion_prompt_en == "slow push-in"
    assert shot.num_frames == 81
    assert shot.music_tag["emotion"] == "tense"
    linwan = manifest.character_by_name("林晚")
    assert linwan.identity_blob and linwan.seed_base is not None


def test_assets_locks_sheets_and_voices(manifest, tmp_path):
    engines = {"image": MockImage(), "tts": MockTTS()}
    # 先 enrich 填 identity_blob
    EnrichStage(MockLLM()).run_shot(next(manifest.iter_shots()),
                                    StageContext(project_dir=tmp_path, manifest=manifest))
    stage = AssetsStage(engines["image"], engines["tts"], ref_audio_dir=None)
    ctx = StageContext(project_dir=tmp_path, manifest=manifest)
    res = stage.run_assets(manifest, ctx)
    assert res["characters"] == len(manifest.characters)
    assert res["sheets"] == len(manifest.characters) * 4   # 每角色 4 视图
    for c in manifest.characters:
        assert len(c.sheet_paths) == 4
        assert all(Path(p).exists() for p in c.sheet_paths)


def _attach_char_with_sheet(manifest, shot, tmp_path):
    """给 shot 挂一个有定妆 sheet 的角色，供人脸 QC 比对。"""
    c = manifest.characters[0]
    sheet = tmp_path / "sheet.png"
    _write_min_png(sheet)
    c.sheet_paths = [str(sheet)]
    shot.character_ids = [c.id]
    return c


def test_keyframe_qc_retry_then_pass(manifest, tmp_path):
    """QC 前两次不过、第三次过 -> 验证重生成循环与 attempts 计数。"""
    img = MockImage()
    qc = MockFaceQC(pass_after=2)   # 前 2 次 similarity 返回 0.30（不过），第 3 次 0.80
    stage = KeyframeStage(img, qc, face_sim_threshold=0.55, max_attempts=4)
    ctx = StageContext(project_dir=tmp_path, manifest=manifest)
    shot = next(manifest.iter_shots())
    shot.status = ShotStatus.enriched
    shot.visual_prompt_en = "test prompt"
    _attach_char_with_sheet(manifest, shot, tmp_path)
    st = stage.run_shot(shot, ctx)
    assert st == ShotStatus.keyframed
    assert shot.qc.attempts == 3
    assert shot.keyframe_path and Path(shot.keyframe_path).exists()


def test_keyframe_qc_exhausts_to_human(manifest, tmp_path):
    """QC 始终不过 -> needs_human（不无限重试）。"""
    qc = MockFaceQC(pass_after=999)   # 永远返回 0.30
    stage = KeyframeStage(MockImage(), qc, face_sim_threshold=0.55, max_attempts=3)
    ctx = StageContext(project_dir=tmp_path, manifest=manifest)
    shot = next(manifest.iter_shots())
    shot.status = ShotStatus.enriched
    shot.visual_prompt_en = "test"
    _attach_char_with_sheet(manifest, shot, tmp_path)
    st = stage.run_shot(shot, ctx)
    assert st == ShotStatus.needs_human
    assert shot.qc.attempts == 3


def test_video_needs_keyframe(manifest, tmp_path):
    stage = VideoStage(MockVideo())
    ctx = StageContext(project_dir=tmp_path, manifest=manifest)
    shot = next(manifest.iter_shots())
    shot.status = ShotStatus.keyframed
    shot.keyframe_path = None    # 缺失
    assert stage.run_shot(shot, ctx) == ShotStatus.failed


def test_tts_backfills_timestamps(manifest, tmp_path):
    tts = MockTTS()
    stage = TTSStage(tts)
    ctx = StageContext(project_dir=tmp_path, manifest=manifest)
    shot = next(s for s in manifest.iter_shots() if s.lines)
    shot.status = ShotStatus.rendered
    st = stage.run_shot(shot, ctx)
    assert st == ShotStatus.voiced
    assert shot.audio_path and Path(shot.audio_path).exists()
    for ln in shot.lines:
        assert ln.audio_path and ln.start is not None and ln.end > ln.start


def test_bgm_generates_when_library_empty(manifest, tmp_path):
    music = MockMusic()
    stage = BGMStage(music)
    ctx = StageContext(project_dir=tmp_path, manifest=manifest)
    ep = manifest.episodes[0]
    # 给镜头挂 music_tag
    for sc in ep.scenes:
        for sh in sc.shots:
            sh.music_tag = {"emotion": "tense", "intensity": 3, "bpm": 90}
    pick = stage.run_episode(ep, ctx)
    assert pick and Path(pick).exists()
    assert all(sh.bgm_pick == pick for sc in ep.scenes for sh in sc.shots)


# --------------------------------------------------------------------------- #
# 集成级：真实 stage 串起全流程（除 ffmpeg 执行）
# --------------------------------------------------------------------------- #


def test_real_stages_full_chain(manifest, tmp_path):
    """真实 stage + mock 引擎跑完 enrich->assets->keyframe->video->tts->subtitle->bgm。
    验证状态推进与产物落盘（assemble/concat 需 ffmpeg，单独在 dry-run 测）。"""
    engines = {"llm": MockLLM(), "image": MockImage(), "video": MockVideo(),
               "tts": MockTTS(), "music": MockMusic(), "face_qc": MockFaceQC(pass_after=0)}
    orch = Orchestrator(project_dir=tmp_path / "proj", stages=_real_stages(engines))
    orch.manifest = manifest
    orch.manifest.project = "proj"
    orch.manifest.save(orch.manifest_path)

    summary = orch.run(only=["enrich", "assets", "keyframe", "video", "tts", "subtitle", "bgm"])

    stats = orch.manifest.stats()
    # 所有镜头应推进到 subtitled（bgm 不改状态）
    assert stats["by_status"]["subtitled"] == stats["shots"], stats["by_status"]
    assert stats["by_status"]["failed"] == 0
    # 产物存在
    proj = tmp_path / "proj"
    assert list((proj / "keyframes").glob("*.png"))
    assert list((proj / "clips").glob("*.mp4"))
    assert list((proj / "voices").glob("*.wav"))
    assert list((proj / "subs").glob("*.ass"))
    assert list((proj / "music").glob("*_bgm.wav"))
    # 角色 sheet 落盘
    assert list((proj / "assets" / "characters").rglob("sheet_front.png"))
    # 摘要含各阶段
    for k in ["enrich", "assets", "keyframe", "video", "tts", "subtitle", "bgm"]:
        assert k in summary, summary
