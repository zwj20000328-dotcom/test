"""S2 LLM 导演阶段 —— 把解析出的结构化剧本细化为可生成的分镜 prompt。

对接 vLLM(Qwen3-32B-AWQ)，用 guided_json 强制 schema。每个镜头回填：
  visual_prompt_en  图像模型 prompt（含 9:16、角色 identity_blob、景别/光线、画面中文文字）
  motion_prompt_en  视频模型运镜/动作 prompt
  est_seconds / num_frames  时长与帧数（16fps）
  tts_instruction   配音语气指令
  music_tag         BGM 情绪/强度/bpm 标签

两种生成粒度（编排器优先用 run_scene，失败自动回退 run_shot）：
  run_scene  一次 guided_json 产出**整个场景**的所有镜头分镜。优点：LLM 能看到同场景
             全部镜头，景别递进/光线连续/动作衔接更连贯；调用数从 ~1620 降到 ~210（30集）。
             风险：输出长可能撞 max_tokens 截断 -> 由编排器回退到 run_shot 逐镜补生成。
  run_shot   单镜头生成。用作 run_scene 的回退路径，以及单镜 QC 不过时的重生成。

角色圣经来源（二选一）：
  canon.json  阶段 A 剧本生成已产出 identity_blob/voice_tag/seed_base 时，直接复用，
              **零 LLM 调用**，且保证剧本与视频角色描述单一来源。
  LLM 推导    手写剧本无 canon 时，调一次 LLM 推导（每剧一次）。

中->英 prompt 是显式一步（图像/视频模型英文 prompt 更稳）；中文留给字幕。
"""
from __future__ import annotations

import hashlib
import json
import logging
from typing import Any, Optional

from ..contracts import Character, Manifest, Scene, Shot, ShotStatus
from ..orchestrator import StageContext
from ..stages.base import prompt_hash

log = logging.getLogger("stages.enrich")

# --------------------------------------------------------------------------- #
# schema
# --------------------------------------------------------------------------- #

# 单镜字段定义（run_shot 与 run_scene 共用，保证两条路径产出一致）
_SHOT_FIELD_PROPS = {
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
}
_SHOT_REQUIRED = ["visual_prompt_en", "motion_prompt_en", "est_seconds", "num_frames"]

_SHOT_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": _SHOT_FIELD_PROPS,
    "required": _SHOT_REQUIRED,
}

# 整场景批量：shots[] 每项带 shot_index（对应输入里镜头的 0-based 序号）用于映射回原镜头
_SCENE_SHOTS_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "shots": {
            "type": "array",
            "items": {
                "type": "object", "additionalProperties": False,
                "properties": {
                    "shot_index": {"type": "integer", "minimum": 0,
                                   "description": "0-based index of this shot within the scene, matching the input numbering"},
                    **_SHOT_FIELD_PROPS,
                },
                "required": ["shot_index", *_SHOT_REQUIRED],
            },
        },
    },
    "required": ["shots"],
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

# run_scene 的输出 token 预算：按镜头数线性给，封顶防超模型上下文
_SCENE_MAX_TOKENS_BASE = 1200
_SCENE_MAX_TOKENS_PER_SHOT = 700
_SCENE_MAX_TOKENS_CAP = 8200


def _scene_max_tokens(n_shots: int) -> int:
    return min(_SCENE_MAX_TOKENS_BASE + _SCENE_MAX_TOKENS_PER_SHOT * n_shots,
               _SCENE_MAX_TOKENS_CAP)


def stable_seed(shot_id: str, base: int = 12345) -> int:
    """由 shot.id 派生**跨进程稳定**的 seed。

    不能用 abs(hash(shot_id))：Python 的 str hash 每次进程启动都因 PYTHONHASHSEED
    随机化而不同，会破坏"同一剧本可复现同一 seed"的承诺（续跑/重渲会得到不同画面）。
    """
    h = int.from_bytes(hashlib.sha256(shot_id.encode("utf-8")).digest()[:4], "big")
    return base + (h % 1000)


# --------------------------------------------------------------------------- #
# Stage
# --------------------------------------------------------------------------- #


class EnrichStage:
    name = "enrich"
    consumes = (ShotStatus.parsed,)
    produces = ShotStatus.enriched

    def __init__(self, llm_engine, global_style: Optional[str] = None):
        self.llm = llm_engine
        self._bible_done = False
        self._bible_from_canon = False
        self._global_style = global_style
        self._scene_of: Optional[dict[str, Scene]] = None   # shot.id -> Scene 索引

    # ================= 角色圣经（每剧一次）=================

    def _build_character_bible(self, m: Manifest, ctx: StageContext) -> None:
        if self._bible_done:
            return

        # 优先复用阶段 A 交付的 canon.json —— 零 LLM 调用，且单一来源保证一致
        canon = ctx.config.get("canon")
        if canon:
            applied = self._apply_canon(m, canon, ctx)
            self._bible_done = True
            self._bible_from_canon = True
            log.info("角色圣经复用 canon.json（%d 角色，零 LLM 调用，global_style=%s…）",
                     applied, (self._global_style or "")[:40])
            return

        # 无 canon（手写剧本）：调一次 LLM 推导
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
            if tgt.seed_base is None:
                tgt.seed_base = 1_000_000 + i * 7919
        ctx.config["global_style"] = self._global_style
        self._bible_done = True
        log.info("角色圣经已由 LLM 推导（%d 角色，global_style=%s…）",
                 len(data.get("characters", [])), (self._global_style or "")[:40])

    def _apply_canon(self, m: Manifest, canon: dict, ctx: StageContext) -> int:
        """把 canon.json 的角色信息搬进 manifest.characters。返回应用的角色数。"""
        by_name = {c.get("name"): c for c in (canon.get("characters") or [])}
        applied = 0
        for c in m.characters:
            src = by_name.get(c.name)
            if not src:
                continue
            if src.get("identity_blob"):
                c.identity_blob = src["identity_blob"]
                applied += 1
            if src.get("costume"):
                c.costume = src["costume"]
            if src.get("voice_tag"):
                c.voice_tag = src["voice_tag"]
            if src.get("seed_base") is not None and c.seed_base is None:
                c.seed_base = src["seed_base"]
        # global_style 复用 canon 的画风（英文 style 若无可回退中文 meta.style）
        if not self._global_style:
            self._global_style = canon.get("style_en") or canon.get("style") or m.meta.style
        ctx.config["global_style"] = self._global_style
        return applied

    # ================= shot -> scene 索引（修 O(scenes) 扫描）=================

    def _ensure_index(self, m: Manifest) -> dict[str, Scene]:
        """建一次 shot.id -> Scene 映射。

        旧实现每个镜头都 `next(sc for sc in iter_scenes() if shot in sc.shots)`，
        是 O(shots × scenes) —— 1620 镜 × 210 场景 ≈ 34 万次比较。建一次索引后 O(1) 查。
        """
        if self._scene_of is None:
            idx: dict[str, Scene] = {}
            for sc in m.iter_scenes():
                for sh in sc.shots:
                    idx[sh.id] = sc
            self._scene_of = idx
        return self._scene_of

    def _scene_for(self, shot: Shot, m: Manifest) -> Optional[Scene]:
        return self._ensure_index(m).get(shot.id)

    # ================= 批量：整场景一次生成 =================

    def run_scene(self, scene: Scene, ctx: StageContext) -> list[str]:
        """一次 guided_json 生成整个场景所有镜头的分镜。

        返回成功回填的 shot.id 列表。编排器据此把未覆盖到的镜头回退到 run_shot。
        任何异常（截断/解析失败/网络）都向上抛，由编排器统一回退——本方法保证
        "要么整批回填成功，要么不留下半回填状态"（先收集结果再统一写回）。
        """
        m = ctx.manifest
        self._build_character_bible(m, ctx)

        # 只处理仍是 parsed 的镜头（续跑时已 enriched 的跳过）
        targets = [sh for sh in scene.shots if sh.status == ShotStatus.parsed]
        if not targets:
            return []

        style = self._style(m, ctx)
        identity = self._scene_identity(scene, m)
        scene_ctx = self._scene_context_block(scene, m)

        # 给每个目标镜头编号，prompt 与返回用 shot_index 对应
        shots_desc = []
        for i, sh in enumerate(targets):
            dialogue = "\n".join(
                f"    - {ln.speaker}（{ln.emotion or ''}/{ln.kind.value}）：{ln.text}"
                for ln in sh.lines) or "    （无对白）"
            shots_desc.append(
                f"[镜头 {i}] 画面:{sh.camera or '（未指定）'}｜动作:{sh.action or '无'}"
                f"｜音效:{'、'.join(sh.sfx) or '无'}｜转场:{sh.transition or '切'}\n{dialogue}")

        user = (
            f"【全局画风】{style}\n"
            f"{scene_ctx}"
            f"【出场角色及固定外貌串】\n{identity}\n\n"
            f"【本场景共 {len(targets)} 个镜头，请为每个镜头生成分镜】\n"
            + "\n\n".join(shots_desc)
            + f"\n\n目标时长参考 {m.meta.episode_seconds or 270} 秒/集（约 4-5 分钟），"
            "单镜 3-8 秒、16fps。请保证同场景内镜头的景别递进、光线与机位连贯。"
            "返回 shots 数组，每项含 shot_index（对应上面的 [镜头 N] 编号）及该镜的分镜字段。"
        )
        msg = [{"role": "system", "content": _DIRECTOR_SYS}, {"role": "user", "content": user}]
        data = self.llm.json(msg, _SCENE_SHOTS_SCHEMA, temperature=0.7, no_think=True,
                             max_tokens=_scene_max_tokens(len(targets)))

        # 先收集，全部解析成功后再统一写回（避免抛异常时留下半回填状态）
        by_index = {i: sh for i, sh in enumerate(targets)}
        pending: list[tuple[Shot, dict]] = []
        for item in data.get("shots", []):
            idx = item.get("shot_index")
            sh = by_index.get(idx)
            if sh is None:
                log.warning("run_scene 返回未知 shot_index=%s（场景 %s），忽略", idx, scene.id)
                continue
            pending.append((sh, item))

        done: list[str] = []
        for sh, item in pending:
            self._apply_shot_fields(sh, item, scene, m, style)
            done.append(sh.id)
        return done

    # ================= 单镜：回退路径 / 单镜重生成 =================

    def run_shot(self, shot: Shot, ctx: StageContext) -> ShotStatus:
        m = ctx.manifest
        self._build_character_bible(m, ctx)
        scene = self._scene_for(shot, m)
        style = self._style(m, ctx)
        char_names = self._shot_characters(shot, scene, m)
        identity = self._identity_for(char_names, m)
        dialogue = "\n".join(
            f"- {ln.speaker}（{ln.emotion or ''}/{ln.kind.value}）：{ln.text}" for ln in shot.lines
        ) or "（无对白）"

        user = (
            f"【全局画风】{style}\n"
            f"【场景】{getattr(scene, 'heading', '')}｜地点:{getattr(scene,'location','')} "
            f"时间:{getattr(scene,'time','')} 内外:{getattr(scene,'int_ext','')}\n"
            f"【环境】{getattr(scene, 'environment', '')}\n【氛围】{getattr(scene, 'mood', '')}\n"
            f"【出场角色及固定外貌串】\n{identity}\n"
            f"【本镜镜头】{shot.camera or ''}\n【本镜动作】{shot.action or ''}\n"
            f"【音效】{', '.join(shot.sfx)}\n【转场】{shot.transition or ''}\n"
            f"【对白】\n{dialogue}\n\n"
            f"目标时长参考 {m.meta.episode_seconds or 270} 秒/集（约 4-5 分钟），"
            "本镜为其中的一个分镜，单镜 3-8 秒、16fps。"
            "输出该镜的 visual_prompt_en / motion_prompt_en / est_seconds / num_frames / "
            "on_screen_text（中文，若无则空串）/ tts_instruction / music_tag。"
        )
        msg = [{"role": "system", "content": _DIRECTOR_SYS}, {"role": "user", "content": user}]
        data = self.llm.json(msg, _SHOT_SCHEMA, temperature=0.7, no_think=True)
        self._apply_shot_fields(shot, data, scene, m, style)
        return ShotStatus.enriched

    # ================= 共用回填 =================

    def _apply_shot_fields(self, shot: Shot, data: dict, scene: Optional[Scene],
                           m: Manifest, style: str) -> None:
        """把 LLM 返回的分镜字段写回 shot（run_shot 与 run_scene 共用）。"""
        vp = data["visual_prompt_en"]
        shot.visual_prompt_en = (style + ", " + vp).strip(", ") if style else vp
        shot.motion_prompt_en = data["motion_prompt_en"]
        shot.est_seconds = float(data["est_seconds"])
        shot.num_frames = int(data.get("num_frames") or round(float(data["est_seconds"]) * 16))
        shot.on_screen_text = data.get("on_screen_text") or None
        shot.tts_instruction = data.get("tts_instruction")
        shot.music_tag = data.get("music_tag")
        shot.scene = getattr(scene, "location", None)
        shot.mood = getattr(scene, "mood", None)
        char_names = self._shot_characters(shot, scene, m)
        shot.character_ids = [c.id for c in self._char_objs(char_names, m)]
        # 稳定 seed：per-character seed_base + shot.id 派生的稳定偏移
        seed_src = None
        if shot.character_ids:
            first = m.character_by_id(shot.character_ids[0])
            if first:
                seed_src = first.seed_base
        shot.seed = stable_seed(shot.id, seed_src if seed_src is not None else 12345)
        shot.artifacts.model = "qwen3-32b"
        shot.artifacts.prompt_hash = prompt_hash(shot.visual_prompt_en, shot.motion_prompt_en)

    # ================= helpers =================

    def _style(self, m: Manifest, ctx: StageContext) -> str:
        return (self._global_style or ctx.config.get("global_style")
                or m.meta.style or "cinematic realism")

    def _scene_context_block(self, scene: Scene, m: Manifest) -> str:
        return (
            f"【场景】{scene.heading}｜地点:{scene.location or ''} "
            f"时间:{scene.time or ''} 内外:{scene.int_ext or ''}\n"
            f"【环境】{scene.environment or ''}\n【氛围】{scene.mood or ''}\n"
        )

    def _scene_identity(self, scene: Scene, m: Manifest) -> str:
        """场景级角色 identity（合并场景声明的角色 + 各镜头说话人）。"""
        names: list[str] = []
        for c in scene.characters or []:
            nm = c.split("（")[0].split("(")[0].strip()
            if nm:
                names.append(nm)
        for sh in scene.shots:
            for ln in sh.lines:
                if ln.speaker and ln.speaker not in ("旁白", "画外音", "字幕"):
                    names.append(ln.speaker)
        seen, uniq = set(), []
        for n in names:
            if n not in seen:
                seen.add(n)
                uniq.append(n)
        return self._identity_for(uniq, m)

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
