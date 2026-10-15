"""剧本创作的占位 LLM —— 本机无 vLLM 时验证互动流程用。

与视频流水线的 StubEngine 不同：创作引擎需要 `.json(messages, schema, ...)` 与
`.chat(messages, ...)`，且 `.json()` 必须按**传入的 schema** 返回合法响应，
否则设定卡/季度弧线/分集节拍各阶段会因缺字段而崩。

识别方式：按 schema 的 properties 键判断这是哪一类调用（与 tests 里的 MockLLM 同策略），
返回结构合法但内容为模板的响应。产出的剧本**格式合法、能过 validate 与 parse**，
但内容是占位文本——只用于验证控制流与交接契约，不是可用剧本。
"""
from __future__ import annotations

from typing import Any, Optional

# 模板角色（当 LLM 不可用时提供最小可跑通的角色集）
_TEMPLATE_CHARS = [
    {"name": "女主角", "gender": "女", "age": 26, "role": "主角",
     "appearance_zh": "长直黑发，鹅蛋脸，杏眼，素色连衣裙，气质温婉而坚韧",
     "personality": "外柔内刚", "motivation": "改变自己的命运",
     "voice_tag": "女26，清亮柔和"},
    {"name": "男主角", "gender": "男", "age": 30, "role": "主角",
     "appearance_zh": "利落短发，剑眉星目，深色西装，身形挺拔，左腕一枚腕表",
     "personality": "外冷内热", "motivation": "守护在意的人",
     "voice_tag": "男30，低沉平稳"},
    {"name": "反派", "gender": "女", "age": 30, "role": "反派",
     "appearance_zh": "精致卷发，红唇，华服，眼神锐利",
     "personality": "强势刻薄", "motivation": "争夺利益",
     "voice_tag": "女30，尖利"},
]

_ACTS = [
    ("开篇钩子", 0.00, 0.12, "黄金3秒入戏，建立核心处境与钩子"),
    ("冲突升级", 0.12, 0.45, "矛盾层层加码，反派施压，主角被动"),
    ("中期反转", 0.45, 0.55, "重大反转，攻守易位"),
    ("高潮", 0.55, 0.85, "危机顶点，主角反击，情感落定前夜"),
    ("收尾", 0.85, 1.00, "打脸完成，关系落定，留续集钩子"),
]

# 模板角色的英文 identity_blob（IDENTITY_LOCK 占位产出）。
# 缺省角色用 _DEFAULT_IDENTITY 兜底，避免 KeyError。
_TEMPLATE_IDENTITY = {
    "女主角": "young Chinese woman, 26, long straight black hair, oval face, almond eyes, plain dress, gentle yet resilient",
    "男主角": "Chinese man, 30, neat short hair, sharp brows, dark suit, upright build, wristwatch on left wrist",
    "反派": "Chinese woman, 30, elaborate curly hair, red lips, elegant gown, sharp piercing eyes",
}
_DEFAULT_IDENTITY = "Chinese adult character, distinctive facial features, consistent wardrobe"


class StubScreenwriterLLM:
    """按 schema 返回合法占位响应的假 LLM。"""

    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.json_calls = 0
        self.chat_calls = 0

    # ---- 结构化输出 ----
    def json(self, messages: list[dict], schema: dict, *,
             temperature: float = 0.3, max_tokens: int = 4096,
             think: bool = False, no_think: Optional[bool] = None,
             retries: int = 2, timeout: Optional[float] = None,
             model: Optional[str] = None, strict: Any = "auto", **kw) -> dict:
        self.json_calls += 1
        props = set((schema or {}).get("properties", {}))
        user_text = self._last_user_text(messages)

        # 设定卡
        if "payoff_types" in props or "core_conflict" in props:
            title = self._guess_title(user_text)
            return {
                "title": title,
                "logline": "（占位）主角在困境中做出改变命运的选择，却牵出更大的秘密。",
                "genre": "都市 / 情感 / 逆袭",
                "tone": "先抑后扬，冲突密集",
                "era": "当代都市",
                "style": "写实电影感，暖色调，浅景深",
                "core_conflict": "个人命运与外部压迫的对抗",
                "payoff_types": ["逆袭", "打脸", "身份反差"],
                "characters": _TEMPLATE_CHARS,
                "key_facts": [
                    {"fact": "男主角的真实身份另有隐情", "holder": "男主角",
                     "hidden_from": ["女主角"]},
                ],
            }

        # IDENTITY_LOCK：中文外形 -> 英文 identity_blob（global_style 是此 schema 独有的键）
        if "global_style" in props:
            # 必须从 prompt 解析**实际角色名**（如"林晚/顾沉"），不能返回硬编码模板名，
            # 否则 engine 的 by_name 匹配不上，identity_blob 仍为 None。
            # prompt 格式为每行 "- {name}：{外形}（{gender}{age}岁，{role}）"
            names = self._extract_identity_names(user_text)
            chars = []
            for i, name in enumerate(names):
                blob = _TEMPLATE_IDENTITY.get(name) or (
                    f"{_DEFAULT_IDENTITY}, variant {i + 1}")
                chars.append({"name": name, "identity_blob": blob,
                              "costume": blob.split(",")[-1].strip()})
            return {
                "characters": chars,
                "global_style": "cinematic realism, warm grade, shallow depth of field, 9:16 vertical",
            }

        # 规格建议
        if "total_episodes" in props and "episode_seconds" in props:
            return {
                "total_episodes": 30, "episode_seconds": 270,
                "reasoning": "（占位）按单线主线 + 一条副线估算，30 集可完整铺陈起承转合。",
                "estimated_shots": 1620,
                "estimated_render_hours": 81.0,
                "estimated_disk_gb": 217.0,
            }

        # 季度弧线
        if "reversal_episodes" in props or "acts" in props:
            total = self._extract_total_episodes(user_text) or 30
            total = max(1, total)
            # 段数不超过集数（集数少时合并区段，保证区间连续、不重叠、恰好覆盖 1..total）
            act_defs = _ACTS[:min(len(_ACTS), total)]
            n_acts = len(act_defs)
            acts = []
            prev_to = 0
            for idx, (kind, f0, f1, goal) in enumerate(act_defs):
                ep_from = prev_to + 1
                if idx == n_acts - 1:
                    ep_to = total                       # 末段恒收在 total
                else:
                    # 预留后面每段至少 1 集
                    ep_to = max(ep_from, min(total - (n_acts - 1 - idx), round(f1 * total)))
                acts.append({"kind": kind, "ep_from": ep_from, "ep_to": ep_to,
                             "goal": goal, "key_turns": []})
                prev_to = ep_to
            return {
                "acts": acts,
                "reversal_episodes": [max(1, round(0.5 * total))],
                "knowledge_plan": [],
            }

        # 分集节拍
        if "escalation" in props or ("hook" in props and "scenes" in props):
            ep = self._extract_ep(user_text) or 1
            total = self._extract_total(user_text) or 30
            secs = self._extract_episode_seconds(user_text) or 270.0
            return {
                "title": f"第{ep}集（占位）",
                "setup": "承接上集处境，主角面对新的压力。",
                "escalation": "冲突升级，双方立场对撞。",
                "payoff": "主角取得阶段性胜利或付出代价。",
                "hook": "一个新的悬念出现，逼向下一集。",
                "scenes": self._template_scenes(ep, secs),
            }

        # 剧情走向
        if "options" in props:
            return {"options": [
                {"direction": "主角隐忍退让，暗中蓄力", "tone_shift": "压抑→蓄势",
                 "affects": ["女主角"], "consequence": "反派得寸进尺，为后续打脸铺垫",
                 "risk": "低", "risk_note": "", "stakes": 2},
                {"direction": "主角当场反击，正面冲突", "tone_shift": "爽点前置",
                 "affects": ["女主角", "反派"], "consequence": "矛盾公开化，反派记恨升级",
                 "risk": "中", "risk_note": "需要更强的反派动机支撑", "stakes": 4},
                {"direction": "第三方介入，局面复杂化", "tone_shift": "悬疑",
                 "affects": ["男主角", "女主角"], "consequence": "引出新的线索与人物关系",
                 "risk": "中", "risk_note": "副线需要提前铺垫", "stakes": 3},
            ]}

        # 批评：返回一条新事实 + 一个已用桥段，使 canon 累积与防重复链路在
        # stub 模式下也被真实走到（返回空会让这两条路径在测试中形同未覆盖）。
        if "violations" in props:
            ep = self._extract_ep(user_text) or 1
            return {
                "violations": [],
                "new_facts": [f"第{ep}集确立的事实：双方关系发生变化"],
                "beats_used": [f"第{ep}集桥段：正面对峙"],
            }

        # 兜底：按 schema 的 required 造一个最小合法对象
        return self._minimal_from_schema(schema)

    # ---- 正文（prose）----
    def chat(self, messages: list[dict], *, temperature: float = 0.7,
             max_tokens: int = 2048, top_p: float = 0.95,
             presence_penalty: float = 0.0, frequency_penalty: float = 0.0,
             stop: Optional[list] = None, think: bool = False,
             no_think: Optional[bool] = None, timeout: Optional[float] = None,
             model: Optional[str] = None, return_meta: bool = False, **kw) -> Any:
        self.chat_calls += 1
        text = self._last_user_text(messages)
        scene_no = self._extract_scene_no(text)
        location = self._extract_field(text, "本场任务") or "（占位场景）"
        chars = self._extract_scene_characters(text)
        # 按本场目标时长生成足够镜头数，使 craft 时长校验通过（每镜约 5 秒）。
        # 否则 --stub 产出的剧本会因 EP_TOO_SHORT 过不了 craft，削弱端到端冒烟价值。
        target = self._extract_target_seconds(text) or 45.0
        n_shots = max(3, round(target / 5.0))
        md = self._template_scene_md(scene_no, location, chars,
                                     n_shots=n_shots, target_seconds=target)
        if return_meta:
            return md, "stop", {"total_tokens": 100}
        return md

    # ---- 健康检查（factory 会调用）----
    def health(self) -> bool:
        return True

    # ================================================================== #
    # 模板生成
    # ================================================================== #

    def _template_scenes(self, ep: int, total_seconds: float) -> list[dict]:
        """按 4-5 分钟一集生成 6 个场景的节拍（秒数合计≈total）。"""
        n = 6
        base = total_seconds / n
        templates = [
            ("冷开场：承接上集悬念", "上集场景", "紧张"),
            ("建立本集处境与目标", "主场景", "推进"),
            ("障碍出现，压力加码", "对峙场景", "压迫"),
            ("中点变化：新信息或伪胜利", "转折场景", "起伏"),
            ("挫折：主角付出代价", "低谷场景", "沉重"),
            ("小高潮 + 集尾钩子", "高潮场景", "爆发"),
        ]
        out = []
        for i, (purpose, loc, mood) in enumerate(templates[:n], 1):
            out.append({
                "location": f"{loc}{ep}-{i}", "time": "白天" if i % 2 else "夜",
                "int_ext": "内" if i % 2 else "外",
                "purpose": purpose, "mood": mood,
                "characters": ["女主角", "男主角"] if i % 2 else ["女主角", "反派"],
                "target_seconds": round(base, 1),
                "ends_on": "留下悬念" if i == n else "推进到下一场",
            })
        return out

    # 循环使用的占位镜头模板：(景别描述, 动作, 对白列表)
    # 对白用 {c1}/{c2} 占位，按角色名替换。每镜约 5 秒，故镜头数 ≈ 目标秒数 / 5。
    _SHOT_TEMPLATES = [
        ("中景，两人相对而立，气氛凝滞。", "主角握紧手，抬眼直视对方。",
         [("{c1}", "平静", "这件事，我不会再退让。"), ("{c2}", "冷淡", "你确定要走到这一步？")]),
        ("特写，主角的眼神没有动摇。", "呼吸微顿，指尖收紧。",
         [("{c1}", "内心OS", "我已经没有退路了。")]),
        ("近景，对方逼近半步。", "对方抬手，压低声音。",
         [("{c2}", "低沉", "你以为你还有选择吗？")]),
        ("全景，空间里只剩他们两人。", "四周安静下来，光线渐暗。",
         [("{c1}", "倔强", "那就试试看。")]),
        ("特写，桌上的一份文件。", "手指把文件推过桌面。",
         [("{c2}", "淡漠", "签了它，一切结束。")]),
        ("中景，主角沉默片刻。", "垂下眼，又缓缓抬起。",
         [("{c1}", "哽咽", "我需要时间。")]),
    ]

    def _template_scene_md(self, scene_no: int, location: str, chars: list[str],
                           n_shots: int = 6, target_seconds: float = 0.0) -> str:
        """生成一个格式合法的场景 Markdown（占位内容）。

        必须严格遵守 SCREENPLAY_FORMAT：### 场景标题、**字段**、> 对白，
        否则 validate 会报 error，交付门过不去。

        target_seconds>0 时，用 craft 的**同一套确定性时长模型**迭代补足镜头数，
        使本场时长达标——而不是按"每镜5秒"硬猜（craft 的模型是
        max(对白时长, base+动作时长)，实测平均每镜约 4.4 秒，硬猜会差 10%）。
        """
        c1 = chars[0] if chars else "女主角"
        c2 = chars[1] if len(chars) > 1 else "男主角"
        loc = (location or "室内").split("：")[0][:12] or "室内"

        n = max(3, min(n_shots, 60))     # 防越界
        if target_seconds > 0:
            n = self._shots_for_duration(target_seconds, start=n)

        lines = [
            f"### 场景 {scene_no}：{loc} · 白天 · 内",
            "",
            f"**人物**：{c1}，{c2}",
            "**环境**：（占位）场景视觉描述，光线与空间关系。",
            "**氛围**：紧张",
        ]
        for i in range(n):
            cam, action, dialogue = self._SHOT_TEMPLATES[i % len(self._SHOT_TEMPLATES)]
            lines.append(f"**镜头**：{cam}")
            lines.append(f"**动作**：{action}")
            for spk, emo, text in dialogue:
                who = spk.replace("{c1}", c1).replace("{c2}", c2)
                # 内心OS 用 kind 括注表达（parser 会还原 kind=os）
                if emo == "内心OS":
                    lines.append(f"> {who}（内心OS）：{text}")
                else:
                    lines.append(f"> {who}（{emo}）：{text}")
        lines.append("**音效**：环境低鸣、心跳声")
        lines.append("**转场**：切")
        return "\n".join(lines) + "\n"

    def _shots_for_duration(self, target_seconds: float, start: int = 3,
                            cap: int = 80) -> int:
        """用 craft 的时长模型反推：多少镜头能凑够 target_seconds。

        复用 craft.shot_seconds 而非另立模型，保证 stub 与真实校验口径一致。
        """
        from . import craft
        n = start
        while n < cap:
            total = 0.0
            for i in range(n):
                _cam, action, dialogue = self._SHOT_TEMPLATES[i % len(self._SHOT_TEMPLATES)]
                texts = [d[2] for d in dialogue]
                total += craft.shot_seconds(texts, action_chars=len(action))
            if total >= target_seconds:
                return n
            n += 1
        return cap

    # ---- schema 兜底 ----
    def _minimal_from_schema(self, schema: dict) -> dict:
        out: dict[str, Any] = {}
        props = (schema or {}).get("properties", {})
        required = set((schema or {}).get("required", [])) or set(props)
        for key in required:
            spec = props.get(key, {})
            t = spec.get("type")
            if t == "string":
                out[key] = "（占位）"
            elif t == "integer":
                out[key] = spec.get("minimum", 1)
            elif t == "number":
                out[key] = float(spec.get("minimum", 1))
            elif t == "boolean":
                out[key] = False
            elif t == "array":
                out[key] = []
            elif t == "object":
                out[key] = {}
            else:
                out[key] = None
        return out

    # ---- 文本抽取助手 ----
    @staticmethod
    def _last_user_text(messages: list[dict]) -> str:
        for m in reversed(messages or []):
            if m.get("role") == "user":
                return m.get("content") or ""
        return ""

    @staticmethod
    def _guess_title(user_text: str) -> str:
        # 从 prompt 里找"剧名：X"，否则用占位
        import re
        m = re.search(r"剧名[:：]\s*([^\n｜|]+)", user_text)
        if m:
            return m.group(1).strip()
        return "未命名短剧"

    @staticmethod
    def _extract_field(text: str, label: str) -> Optional[str]:
        import re
        m = re.search(rf"{label}[】\]]?[:：]?\s*([^\n]+)", text)
        return m.group(1).strip() if m else None

    @staticmethod
    def _extract_ep(text: str) -> Optional[int]:
        import re
        m = re.search(r"第\s*(\d+)\s*/\s*\d+\s*集", text) or re.search(r"第\s*(\d+)\s*集", text)
        return int(m.group(1)) if m else None

    @staticmethod
    def _extract_total(text: str) -> Optional[int]:
        import re
        # plan_episode 的 prompt 用 "第 X/Y 集"
        m = re.search(r"第\s*\d+\s*/\s*(\d+)\s*集", text)
        if m:
            return int(m.group(1))
        # plan_season 的 prompt 用 "总集数：N"
        m = re.search(r"总集数[：:]\s*(\d+)", text)
        if m:
            return int(m.group(1))
        return None

    _extract_total_episodes = _extract_total

    @staticmethod
    def _extract_target_seconds(text: str) -> Optional[float]:
        """从场景 prompt 的【本场目标时长】抽取秒数，用于决定生成几个镜头。"""
        import re
        m = re.search(r"本场目标时长[】\]]?[:：]?\s*(\d+(?:\.\d+)?)", text)
        return float(m.group(1)) if m else None

    @staticmethod
    def _extract_episode_seconds(text: str) -> Optional[float]:
        import re
        m = re.search(r"目标时长[^\d]*(\d+(?:\.\d+)?)\s*秒", text)
        return float(m.group(1)) if m else None

    @staticmethod
    def _extract_scene_no(text: str) -> int:
        import re
        m = re.search(r"全剧第\s*(\d+)\s*场", text) or re.search(r"第\s*(\d+)\s*场", text)
        return int(m.group(1)) if m else 1

    @staticmethod
    def _extract_scene_characters(text: str) -> list[str]:
        """从 prompt 的【本场角色】段抽角色名。"""
        import re
        block = re.search(r"【本场角色】\n(.*?)(?:\n【|$)", text, re.S)
        if not block:
            return ["女主角", "男主角"]
        names = re.findall(r"^-\s*([^：:（(\n]+)", block.group(1), re.M)
        names = [n.strip() for n in names if n.strip()]
        return names or ["女主角", "男主角"]

    @staticmethod
    def _extract_identity_names(text: str) -> list[str]:
        """从 IDENTITY_LOCK prompt 抽实际角色名。

        engine.identity_lock 的行格式为：`- {name}：{外形}（{gender}{age}岁，{role}）`。
        必须抽**实际名**（林晚/顾沉…）而非返回硬编码模板名，否则 engine 的 by_name
        匹配不上、identity_blob 仍为 None（这正是曾导致一致性锚丢失的 bug）。
        """
        import re
        names = re.findall(r"^-\s*([^：:（(\n]+)[：:]", text, re.M)
        names = [n.strip() for n in names if n.strip()]
        # 去重保序
        seen, out = set(), []
        for n in names:
            if n not in seen:
                seen.add(n)
                out.append(n)
        return out
