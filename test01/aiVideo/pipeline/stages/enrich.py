"""S2 LLM 导演阶段 —— 把解析出的结构化剧本细化为可生成的分镜 prompt。

对接 vLLM(Qwen3-32B-AWQ)，用 guided_json 强制 schema。每个镜头回填：
  visual_prompt_en  图像模型 prompt（含 9:16、角色 identity_blob、景别/光线、画面中文文字）
  motion_prompt_en  视频模型运镜/动作 prompt
  est_seconds / num_frames  时长与帧数（16fps）
  tts_instruction   配音语气指令
  music_tag         BGM 情绪/强度/bpm 标签

同时做两件事（每剧一次，写在 ctx 里避免重复）：
  character_bible  每角色固定英文外貌串 identity_blob + 服化道 + seed_base + 音色标签
  global_style     全剧统一画风前缀

中->英 prompt 是显式一步（图像/视频模型英文 prompt 更稳）；中文留给字幕。
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

from ..contracts import Character, Manifest, Shot, ShotStatus
from ..orchestrator import StageContext
from ..stages.base import prompt_hash

log = logging.getLogger("stages.enrich")

# 每镜输出的 JSON schema（guided_json 用）
_SHOT_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "visual_prompt_en": {"type": "string", "description": "9:16 vertical cinematic keyframe prompt in English; include shot size, lighting, composition, character identity descriptors, any on-screen Chinese text described"},
        "motion_prompt_en": {"type": "string", "description": "image-to-video motion/camera prompt in English: camera move + subject action + motion magnitude"},
        "est_seconds": {"type": "number", "minimum": 2, "maximum": 15},
        "num_frames": {"type": "integer", "minimum": 16, "maximum": 241},
        "on_screen_text": {"type": "string", "description": "Chinese on-screen text to burn in this shot, empty if none"},
        "tts_instruction": {"type": "string", "description": "per-line voice direction: emotion, speed, pauses"},
        "music_tag": {
            "type": "object", "additionalProperties": False,
            "properties": {
                "emotion": {"type": "string"},
                "intensity": {"type": "integer", "minimum": 1, "maximum": 5},
                "bpm": {"type": "integer", "minimum": 40, "maximum": 200},
                "instruments": {"type": "string"},
            },
            "required": ["emotion", "intensity"],
        },
    },
    "required": ["visual_prompt_en", "motion_prompt_en", "est_seconds", "num_frames"],
}

_CHAR_BIBLE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "characters": {
            "type": "array",
            "items": {
                "type": "object", "additionalProperties": False,
                "properties": {
                    "name": {"type": "string"},
                    "identity_blob": {"type": "string", "description": "FIXED English appearance string reused in every image prompt for consistency"},
                    "costume": {"type": "string"},
                    "voice_tag": {"type": "string", "description": "voice character: gender/age/timbre/personality for TTS speaker design"},
                },
                "required": ["name", "identity_blob"],
            },
        },
        "global_style": {"type": "string", "description": "unified English style prefix for all shots (cinematic look, color grade, era)"},
    },
    "required": ["characters", "global_style"],
}

_DIRECTOR_SYS = (
    "你是资深短剧导演兼 AI 视频 prompt 工程师。你把结构化剧本细化成可直接喂给"
    "文生图(Qwen-Image)与图生视频(Wan2.2)模型的英文 prompt。要求：竖屏 9:16；"
    "画面写实电影感、浅景深、情绪化布光；每个 prompt 必须包含固定的角色外貌串以保证跨镜一致；"
    "只输出 JSON，不要解释。"
)


class EnrichStage:
    name = "enrich"
    consumes = (ShotStatus.parsed,)
    produces = ShotStatus.enriched

    def __init__(self, llm_engine, global_style: Optional[str] = None):
        self.llm = llm_engine
        self._bible_done = False
        self._global_style = global_style

    # ---- 每剧一次：角色圣经 ----
    def _build_character_bible(self, m: Manifest, ctx: StageContext) -> None:
        if self._bible_done:
            return
        chars = [{"name": c.name, "appearance_zh": c.appearance,
                  "gender": c.gender, "age": c.age} for c in m.characters]
        if not chars:
            self._bible_done = True
            return
        msg = [
            {"role": "system", "content": _DIRECTOR_SYS},
            {"role": "user", "content": (
                f"剧名：{m.meta.title}\n题材：{m.meta.genre}\n画风偏好：{m.meta.style}\n"
                f"角色表（中文）：\n{json.dumps(chars, ensure_ascii=False)}\n\n"
                "为每个角色生成 identity_blob（固定英文外貌串，含发型/脸型/眼型/体态/标志服装配饰，"
                "将被逐字复用进每个图像 prompt 以保证 20-50 集长相一致），以及 costume、voice_tag。"
                "并给出 global_style（全剧统一英文画风前缀）。"
            )},
        ]
        data = self.llm.json(msg, _CHAR_BIBLE_SCHEMA, temperature=0.6, no_think=True)
        self._global_style = data.get("global_style", "")
        by_name = {c.name: c for c in m.characters}
        for i, cc in enumerate(data.get("characters", [])):
            tgt = by_name.get(cc.get("name"))
            if tgt is None:
                continue
            tgt.identity_blob = cc.get("identity_blob")
            tgt.costume = cc.get("costume")
            tgt.voice_tag = cc.get("voice_tag")
            # 固定 per-character seed 家族（确定性复用）
            if tgt.seed_base is None:
                tgt.seed_base = 1_000_000 + i * 7919
        ctx.config["global_style"] = self._global_style
        self._bible_done = True
        log.info("角色圣经已建立（%d 角色，global_style=%s…）",
                 len(data.get("characters", [])), (self._global_style or "")[:40])

    # ---- 每镜 ----
    def run_shot(self, shot: Shot, ctx: StageContext) -> ShotStatus:
        m = ctx.manifest
        self._build_character_bible(m, ctx)

        # 组装该镜头的中文上下文
        scene = next((sc for sc in m.iter_scenes() if any(s is shot for s in sc.shots)), None)
        char_names = self._shot_characters(shot, scene, m)
        identity = self._identity_for(char_names, m)
        dialogue = "\n".join(
            f"- {ln.speaker}（{ln.emotion or ''}/{ln.kind.value}）：{ln.text}" for ln in shot.lines
        ) or "（无对白）"
        style = self._global_style or ctx.config.get("global_style") or m.meta.style or "cinematic realism"

        user = (
            f"【全局画风】{style}\n"
            f"【场景】{getattr(scene, 'heading', '')}｜地点:{getattr(scene,'location','')} "
            f"时间:{getattr(scene,'time','')} 内外:{getattr(scene,'int_ext','')}\n"
            f"【环境】{getattr(scene, 'environment', '')}\n【氛围】{getattr(scene, 'mood', '')}\n"
            f"【出场角色及固定外貌串】\n{identity}\n"
            f"【本镜镜头】{shot.camera or ''}\n【本镜动作】{shot.action or ''}\n"
            f"【音效】{', '.join(shot.sfx)}\n【转场】{shot.transition or ''}\n"
            f"【对白】\n{dialogue}\n\n"
            f"目标时长参考 {m.meta.episode_seconds or 9} 秒/集，单镜 3-8 秒、16fps。"
            "输出该镜的 visual_prompt_en / motion_prompt_en / est_seconds / num_frames / "
            "on_screen_text（中文，若无则空串）/ tts_instruction / music_tag。"
        )
        msg = [{"role": "system", "content": _DIRECTOR_SYS}, {"role": "user", "content": user}]
        data = self.llm.json(msg, _SHOT_SCHEMA, temperature=0.7, no_think=True)

        shot.visual_prompt_en = (style + ", " + data["visual_prompt_en"]).strip(", ") if style else data["visual_prompt_en"]
        shot.motion_prompt_en = data["motion_prompt_en"]
        shot.est_seconds = float(data["est_seconds"])
        shot.num_frames = int(data.get("num_frames") or round(float(data["est_seconds"]) * 16))
        shot.on_screen_text = data.get("on_screen_text") or None
        shot.tts_instruction = data.get("tts_instruction")
        shot.music_tag = data.get("music_tag")
        shot.scene = getattr(scene, "location", None)
        shot.mood = getattr(scene, "mood", None)
        shot.character_ids = [c.id for c in self._char_objs(char_names, m)]
        # 固定 seed 家族：per-character seed_base 组合，保证可复现
        seed_src = None
        if shot.character_ids:
            first = m.character_by_id(shot.character_ids[0])
            if first:
                seed_src = first.seed_base
        shot.seed = (seed_src if seed_src is not None else 12345) + (abs(hash(shot.id)) % 1000)
        shot.artifacts.model = "qwen3-32b"
        shot.artifacts.prompt_hash = prompt_hash(shot.visual_prompt_en, shot.motion_prompt_en)
        return ShotStatus.enriched

    # ---- helpers ----
    def _shot_characters(self, shot: Shot, scene, m: Manifest) -> list[str]:
        names: list[str] = []
        for ln in shot.lines:
            if ln.speaker and ln.speaker not in ("旁白", "画外音", "字幕"):
                names.append(ln.speaker)
        if scene and scene.characters:
            for c in scene.characters:
                nm = c.split("（")[0].split("(")[0].strip()
                if nm:
                    names.append(nm)
        # 去重保序，且只保留能在角色表匹配到的
        seen, out = set(), []
        for n in names:
            if n not in seen:
                seen.add(n)
                out.append(n)
        return out

    def _char_objs(self, names: list[str], m: Manifest) -> list[Character]:
        objs = []
        for n in names:
            c = m.character_by_name(n)
            if c:
                objs.append(c)
        return objs

    def _identity_for(self, names: list[str], m: Manifest) -> str:
        lines = []
        for n in names:
            c = m.character_by_name(n)
            if c and c.identity_blob:
                lines.append(f"- {n}: {c.identity_blob}")
            elif c:
                lines.append(f"- {n}: {c.appearance}")
        return "\n".join(lines) or "（无具名角色）"
