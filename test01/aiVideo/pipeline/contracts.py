"""跨阶段数据契约 (pydantic v2) —— 整条流水线的唯一事实源 schema。

manifest.json 的结构由本模块定义。每个阶段读取 → 处理 → **回填**它自己的字段，
其余字段保持不动，因此天然支持断点续跑与并行。

设计要点：
- 所有"产出型"字段（keyframe_path / clip_path / audio_path …）默认 None，
  由对应阶段填写；上游阶段绝不臆造下游字段。
- `status` 字段驱动调度与续跑：每个 shot 独立记录进度。
- `_artifacts` 记录模型/版本/prompt_hash，保证可复现与可审计。

用法：
    from pipeline.contracts import Manifest
    m = Manifest.load("projects/demo/manifest.json")
    shot = m.iter_shots().__next__()
    shot.status = ShotStatus.KEYFRAMED
    m.save()
"""
from __future__ import annotations

import json
from enum import Enum
from pathlib import Path
from typing import Any, Iterator, Optional

from pydantic import BaseModel, ConfigDict, Field

# --------------------------------------------------------------------------- #
# 枚举
# --------------------------------------------------------------------------- #


class LineKind(str, Enum):
    dialogue = "dialogue"
    os = "os"              # 内心独白
    vo = "vo"              # 画外音
    narration = "narration"
    subtitle = "subtitle"


class ShotStatus(str, Enum):
    """镜头在流水线中的推进状态（单调前进，续跑据此跳过已完成）。"""
    parsed = "parsed"          # S1 完成
    enriched = "enriched"      # S2 回填 prompt 完成
    keyframed = "keyframed"    # S4 关键帧完成 + QC 通过
    drafted = "drafted"        # S5 预览 clip 完成
    rendered = "rendered"      # S5 终渲 clip 完成
    voiced = "voiced"          # S6 TTS 完成
    subtitled = "subtitled"    # S7 字幕完成
    assembled = "assembled"    # S9 归入某集并装配完成
    failed = "failed"
    needs_human = "needs_human"  # QC 连续失败转人工


# --------------------------------------------------------------------------- #
# 基础模型
# --------------------------------------------------------------------------- #


class _Base(BaseModel):
    model_config = ConfigDict(extra="allow", validate_assignment=True)


class Line(_Base):
    speaker: str
    text: str
    emotion: Optional[str] = None
    kind: LineKind = LineKind.dialogue
    # S6 回填：
    audio_path: Optional[str] = None
    start: Optional[float] = None
    end: Optional[float] = None
    word_timestamps: Optional[list[dict[str, Any]]] = None


class Artifacts(_Base):
    """记录产出该镜头所用的模型/版本/哈希，保证可复现与审计。"""
    model: Optional[str] = None
    version: Optional[str] = None
    prompt_hash: Optional[str] = None
    seed: Optional[int] = None


class QC(_Base):
    face_sim: Optional[float] = None        # ArcFace 与 canonical sheet 的相似度
    face_sim_pass: Optional[bool] = None
    notes: Optional[str] = None
    attempts: int = 0


class Shot(_Base):
    id: str
    episode_id: Optional[int] = None
    scene_id: Optional[str] = None
    character_ids: list[str] = Field(default_factory=list)
    # S1 解析：
    camera: Optional[str] = None
    action: Optional[str] = None
    sfx: list[str] = Field(default_factory=list)
    transition: Optional[str] = None
    lines: list[Line] = Field(default_factory=list)
    raw_text: list[str] = Field(default_factory=list)
    # S2 LLM 回填：
    scene: Optional[str] = None
    mood: Optional[str] = None
    on_screen_text: Optional[str] = None
    visual_prompt_en: Optional[str] = None
    motion_prompt_en: Optional[str] = None
    est_seconds: Optional[float] = None
    num_frames: Optional[int] = None
    tts_instruction: Optional[str] = None
    music_tag: Optional[dict[str, Any]] = None
    # S3/S4 回填：
    seed: Optional[int] = None
    ref_ids: list[str] = Field(default_factory=list)
    keyframe_path: Optional[str] = None
    # S5 回填：
    draft_clip_path: Optional[str] = None
    clip_path: Optional[str] = None
    # S6 回填（整镜合并后的对白音频；逐句音频在 lines[].audio_path）：
    audio_path: Optional[str] = None
    # S7 回填：
    srt_path: Optional[str] = None
    ass_path: Optional[str] = None
    # S8 回填：
    bgm_pick: Optional[str] = None
    # S9 回填：
    episode_path: Optional[str] = None
    # 状态：
    status: ShotStatus = ShotStatus.parsed
    qc: QC = Field(default_factory=QC)
    artifacts: Artifacts = Field(default_factory=Artifacts)


class Scene(_Base):
    id: str
    heading: str
    location: Optional[str] = None
    time: Optional[str] = None
    int_ext: Optional[str] = None
    characters: list[str] = Field(default_factory=list)
    environment: Optional[str] = None
    mood: Optional[str] = None
    extra: dict[str, Any] = Field(default_factory=dict)
    shots: list[Shot] = Field(default_factory=list)


class Episode(_Base):
    ep: int
    heading: str = ""
    target_seconds: Optional[float] = None
    scenes: list[Scene] = Field(default_factory=list)
    # S9 回填：
    episode_path: Optional[str] = None


class CharacterVoice(_Base):
    spk_id: Optional[str] = None       # CosyVoice 注册的持久化音色 id
    ref_wav: Optional[str] = None      # 5-15s 干净参考音
    engine: Optional[str] = None       # cosyvoice / gpt_sovits


class CharacterLoRA(_Base):
    path: Optional[str] = None
    scale: float = 0.75
    trained_steps: Optional[int] = None


class Character(_Base):
    id: str
    name: str
    appearance: str = ""
    gender: Optional[str] = None
    age: Optional[int] = None
    # S2 character_bible 回填：
    identity_blob: Optional[str] = None   # 固定英文外貌串，进每个 image prompt
    costume: Optional[str] = None
    seed_base: Optional[int] = None
    voice_tag: Optional[str] = None
    # S3 回填：
    sheet_paths: list[str] = Field(default_factory=list)   # canonical 多视图定妆
    lora: CharacterLoRA = Field(default_factory=CharacterLoRA)
    voice: CharacterVoice = Field(default_factory=CharacterVoice)


class Meta(_Base):
    title: Optional[str] = None
    genre: Optional[str] = None
    style: Optional[str] = None
    aspect_ratio: str = "9:16"
    language: str = "zh"
    target_episodes: Optional[int] = None
    episode_seconds: Optional[float] = None


class Manifest(_Base):
    """整部剧的顶层状态对象，序列化为 projects/<drama>/manifest.json。"""
    schema_version: str = "1.0"
    project: Optional[str] = None
    meta: Meta = Field(default_factory=Meta)
    logline: Optional[str] = None
    characters: list[Character] = Field(default_factory=list)
    episodes: list[Episode] = Field(default_factory=list)
    loose_scenes: list[Scene] = Field(default_factory=list)
    # 全局回填：
    final_path: Optional[str] = None
    stats_cache: dict[str, Any] = Field(default_factory=dict)

    # ---- 便捷遍历 ----
    def iter_scenes(self) -> Iterator[Scene]:
        for ep in self.episodes:
            for sc in ep.scenes:
                yield sc
        for sc in self.loose_scenes:
            yield sc

    def iter_shots(self) -> Iterator[Shot]:
        for sc in self.iter_scenes():
            for sh in sc.shots:
                yield sh

    def character_by_id(self, cid: str) -> Optional[Character]:
        for c in self.characters:
            if c.id == cid:
                return c
        return None

    def character_by_name(self, name: str) -> Optional[Character]:
        for c in self.characters:
            if c.name == name:
                return c
        return None

    def shots_with_status(self, *statuses: ShotStatus) -> list[Shot]:
        s = set(statuses)
        return [sh for sh in self.iter_shots() if sh.status in s]

    def stats(self) -> dict[str, Any]:
        shots = list(self.iter_shots())
        return {
            "episodes": len(self.episodes),
            "scenes": len(list(self.iter_scenes())),
            "shots": len(shots),
            "dialogue_lines": sum(len(sh.lines) for sh in shots),
            "characters": len(self.characters),
            "by_status": {st.value: len(self.shots_with_status(st)) for st in ShotStatus},
        }

    # ---- 持久化 ----
    @classmethod
    def load(cls, path: Path | str) -> "Manifest":
        path = Path(path)
        data = json.loads(path.read_text(encoding="utf-8"))
        return cls.model_validate(data)

    def save(self, path: Optional[Path | str] = None) -> None:
        if path is None:
            raise ValueError("save() 需要 path，除非用 round-trip 保存")
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        self.stats_cache = self.stats()
        path.write_text(
            json.dumps(self.model_dump(mode="json", exclude_none=False), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def to_dict(self) -> dict[str, Any]:
        self.stats_cache = self.stats()
        return self.model_dump(mode="json")


# --------------------------------------------------------------------------- #
# 从 parser 的 raw dict 构建 Manifest（S1 -> 契约对象）
# --------------------------------------------------------------------------- #

# parser 产出的下划线键 -> 契约字段名
_KEY_REMAP = {"_stats": "stats_cache", "_artifacts": "artifacts"}


def _remap_keys(obj: Any) -> Any:
    """递归把 parser 的 _stats/_artifacts 下划线键改名，喂给 pydantic。"""
    if isinstance(obj, dict):
        return {_KEY_REMAP.get(k, k): _remap_keys(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_remap_keys(v) for v in obj]
    return obj


def manifest_from_raw(raw: dict[str, Any]) -> Manifest:
    """把 parser.parse_screenplay() 的 dict 升级为强类型 Manifest。"""
    return Manifest.model_validate(_remap_keys(raw))
