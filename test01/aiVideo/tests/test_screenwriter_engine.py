"""创作引擎测试 —— 用 mock LLM 验证规划/创作/审校逻辑，不需要真实模型。

覆盖：设定卡反推、规格建议、季度弧线+知识状态、分集节拍、剧情走向、
分场景创作（含 validator 自愈循环）、批评与 canon 增量、发射交付、渲染估算。
"""
from __future__ import annotations

import json

import pytest

from pipeline.screenwriter import craft
from pipeline.screenwriter.engine import (
    EngineConfig, ScreenwriterEngine, _strip_fences, _wrap_scene_for_validate,
    estimate_render,
)
from pipeline.screenwriter.models import Session
from pipeline.validate import validate


# --------------------------------------------------------------------------- #
# Mock LLM：按 schema 特征返回不同的合法响应
# --------------------------------------------------------------------------- #


SCENE_MD = """### 场景 1：民政局门口 · 白天 · 外

**人物**：林晚（白衬衫，紧张），顾沉（黑西装，冷峻）
**环境**：灰白民政局大楼，正午阳光刺眼
**氛围**：紧张、命运感
**镜头**：远景俯拍，两人在台阶上对立而站。
**动作**：林晚深吸一口气，攥紧户口本。
> 林晚（内心OS）：只要领了这本证就好了。
**镜头**：中景，顾沉递来一支笔。
> 顾沉（冷淡）：想清楚了？
> 林晚（倔强）：我签。
**音效**：城市车流声、蝉鸣
**转场**：闪白
"""


class MockLLM:
    """可编程的 mock：记录每次调用，按 schema/上下文返回预设响应。"""

    def __init__(self, scene_md: str = SCENE_MD, fence: bool = False,
                 bad_then_good: bool = False):
        self.scene_md = scene_md
        self.fence = fence
        self.bad_then_good = bad_then_good
        self.json_calls: list[dict] = []
        self.chat_calls: list[dict] = []
        self._chat_n = 0

    def json(self, messages, schema, temperature=0.3, max_tokens=2048, **kw):
        props = schema.get("properties", {})
        self.json_calls.append({"props": sorted(props), "temperature": temperature})

        if "payoff_types" in props:                      # 设定卡
            return {
                "title": "闪婚之后满级大佬",
                "logline": "为凑手术费，落魄千金闪婚陌生人。",
                "genre": "都市 / 甜宠 / 逆袭",
                "tone": "先抑后扬", "era": "当代都市",
                "style": "写实电影感，暖色调",
                "core_conflict": "契约婚姻 vs 真情",
                "payoff_types": ["身份反差", "打脸", "逆袭"],
                "characters": [
                    {"name": "林晚", "gender": "女", "age": 28, "role": "主角",
                     "appearance_zh": "长直黑发及腰，鹅蛋脸，白色职业装，银色细项链",
                     "personality": "清冷倔强", "motivation": "凑母亲手术费",
                     "voice_tag": "女28，清亮坚韧"},
                    {"name": "顾沉", "gender": "男", "age": 32, "role": "主角",
                     "appearance_zh": "短碎发，剑眉星目，深黑高定西装，铂金腕表",
                     "personality": "外冷内热", "motivation": "隐藏身份查家族阴谋",
                     "voice_tag": "男32，低沉冷淡"},
                ],
                "key_facts": [
                    {"fact": "顾沉是顾氏集团总裁", "holder": "顾沉",
                     "hidden_from": ["林晚"]},
                ],
            }
        if "total_episodes" in props:                    # 规格建议
            return {"total_episodes": 30, "episode_seconds": 270,
                    "reasoning": "3 条主线，按每集 1 个推进点需 28-32 集",
                    "estimated_shots": 1620}
        if "reversal_episodes" in props:                 # 季度弧线
            return {
                "acts": [
                    {"kind": "开篇钩子", "ep_from": 1, "ep_to": 3,
                     "goal": "黄金3秒入戏，契约婚姻成立", "key_turns": ["领证"]},
                    {"kind": "冲突升级", "ep_from": 4, "ep_to": 10,
                     "goal": "继姐刁难，男主暗中护妻"},
                    {"kind": "中期反转", "ep_from": 11, "ep_to": 14,
                     "goal": "身份揭穿", "key_turns": ["林晚发现真相"]},
                    {"kind": "高潮", "ep_from": 15, "ep_to": 24,
                     "goal": "家族阴谋"},
                    {"kind": "收尾", "ep_from": 25, "ep_to": 30,
                     "goal": "打脸完成，感情落定"},
                ],
                "reversal_episodes": [11, 22],
                "knowledge_plan": [
                    {"fact": "顾沉是顾氏集团总裁", "holder": "顾沉",
                     "revealed_to": "林晚", "source_ep": 11,
                     "hidden_from": ["林晚", "苏曼"]},
                ],
            }
        if "escalation" in props:                        # 分集节拍
            return {
                "title": "契约", "setup": "林晚为手术费被迫闪婚",
                "escalation": "领证现场的尴尬与试探",
                "payoff": "顾沉 unexpectedly 替她解围",
                "hook": "顾沉的车停在门外，他到底是谁",
                "scenes": [
                    {"location": "民政局门口", "time": "白天", "int_ext": "外",
                     "purpose": "契约婚姻成立", "mood": "紧张、命运感",
                     "characters": ["林晚", "顾沉"], "target_seconds": 135.0,
                     "ends_on": "两人领证"},
                    {"location": "医院病房", "time": "傍晚", "int_ext": "内",
                     "purpose": "揭示动机", "mood": "温情、心酸",
                     "characters": ["林晚", "林母"], "target_seconds": 135.0,
                     "ends_on": "林晚独自擦泪"},
                ],
            }
        if "options" in props:                           # 剧情走向
            return {"options": [
                {"direction": "泼水羞辱，林晚隐忍", "tone_shift": "压抑→蓄势",
                 "affects": ["林晚", "苏曼"], "consequence": "男主门外目睹，埋伏笔",
                 "risk": "低", "risk_note": "", "stakes": 2},
                {"direction": "林晚当场反将一军", "tone_shift": "爽点前置",
                 "affects": ["林晚", "苏曼", "林父"], "consequence": "苏曼记恨升级",
                 "risk": "中", "risk_note": "需更强反派动机", "stakes": 4},
                {"direction": "顾沉电话介入镇场", "tone_shift": "甜宠",
                 "affects": ["林晚", "顾沉"], "consequence": "身份线索外露",
                 "risk": "中", "risk_note": "可能提前泄底", "stakes": 3},
            ]}
        if "violations" in props:                        # 批评
            return {"violations": [
                        {"kind": "knowledge", "detail": "林晚第5集就提到顾沉的身份",
                         "scene_no": 2, "severity": "blocker",
                         "suggested_fix": "改为她只觉对方眼熟"}],
                    "new_facts": ["林晚与顾沉已领证"],
                    "beats_used": ["领证现场对峙"]}
        raise AssertionError(f"未预期的 schema: {sorted(props)}")

    def chat(self, messages, temperature=0.7, max_tokens=2048, **kw):
        self.chat_calls.append({"temperature": temperature,
                                "max_tokens": max_tokens,
                                "n_messages": len(messages)})
        self._chat_n += 1
        # 模拟自愈：第一次返回坏格式，第二次返回好的
        if self.bad_then_good and self._chat_n == 1:
            return "#### 场景一：某个地方\n这里没有井号也没有对白格式"
        md = self.scene_md
        if self.fence:
            md = "```markdown\n" + md + "\n```"
        return md


# --------------------------------------------------------------------------- #
# 规划层
# --------------------------------------------------------------------------- #


def test_plan_settings_builds_canon():
    eng = ScreenwriterEngine(MockLLM())
    canon = eng.plan_settings("落魄千金为凑母亲手术费闪婚陌生人")
    assert canon.title == "闪婚之后满级大佬"
    assert canon.genre == "都市 / 甜宠 / 逆袭"
    assert len(canon.characters) == 2
    linwan = canon.character("林晚")
    assert linwan.is_lead and linwan.age == 28
    assert "长直黑发" in linwan.appearance_zh
    assert linwan.voice_tag and linwan.seed_base is not None
    # 关键秘密被登记为知识状态
    assert len(canon.knowledge) == 1
    assert canon.knowledge[0].hidden_from == ["林晚"]


def test_plan_settings_uses_plan_temperature():
    llm = MockLLM()
    ScreenwriterEngine(llm).plan_settings("x")
    assert llm.json_calls[0]["temperature"] == pytest.approx(0.6)


def test_plan_spec_uses_model_suggestion():
    eng = ScreenwriterEngine(MockLLM())
    canon = eng.plan_settings("x")
    spec = eng.plan_spec(canon, "x")
    assert spec["total_episodes"] == 30
    assert spec["episode_seconds"] == 270
    assert spec["reasoning"]
    assert spec["estimated_shots"] == 1620
    assert spec["estimated_render_days"] == pytest.approx(3.38, abs=0.05)


def test_plan_spec_user_override_wins():
    """决策 #2：用户指定优先于模型建议。"""
    eng = ScreenwriterEngine(MockLLM())
    canon = eng.plan_settings("x")
    spec = eng.plan_spec(canon, "x", user_episodes=45, user_seconds=250)
    assert spec["total_episodes"] == 45
    assert spec["episode_seconds"] == 250


def test_plan_season_builds_acts_and_knowledge():
    eng = ScreenwriterEngine(MockLLM())
    canon = eng.plan_settings("x")
    beats = eng.plan_season(canon, 30, 270.0)
    assert len(beats.acts) == 5
    assert beats.act_of(1).kind.value == "开篇钩子"
    assert beats.act_of(12).kind.value == "中期反转"
    assert beats.reversal_episodes() == [11, 22]
    assert len(beats.episodes) == 30
    # 知识揭示计划被写回 canon
    k = canon.knowledge[0]
    assert k.source_ep == 11
    assert "林晚" in k.revealed_to


def test_knowledge_boundary_enforced_after_season():
    """季度规划后，知识状态查询必须正确——这是防"提前剧透"的基础。"""
    eng = ScreenwriterEngine(MockLLM())
    canon = eng.plan_settings("x")
    eng.plan_season(canon, 30, 270.0)
    fid = canon.knowledge[0].fact_id
    assert canon.knows("林晚", fid, 5) is False
    assert canon.knows("林晚", fid, 11) is True
    assert "顾沉是顾氏集团总裁" in canon.hidden_from("林晚", 5)
    assert canon.hidden_from("林晚", 12) == []


def test_plan_episode_fills_scenes():
    eng = ScreenwriterEngine(MockLLM())
    canon = eng.plan_settings("x")
    beats = eng.plan_season(canon, 30, 270.0)
    s = Session(name="t", canon=canon, beats=beats,
                total_episodes=30, episode_seconds=270.0)
    eb = eng.plan_episode(s, 1)
    assert eb.title == "契约"
    assert eb.hook
    assert len(eb.scenes) == 2
    assert eb.scenes[0].target_seconds == 135.0
    assert sum(sc.target_seconds for sc in eb.scenes) == 270.0


def test_plan_episode_beats_pass_craft_check():
    """生成的节拍应通过 craft 校验（有钩子、场景数合理）。"""
    eng = ScreenwriterEngine(MockLLM())
    canon = eng.plan_settings("x")
    beats = eng.plan_season(canon, 30, 270.0)
    s = Session(name="t", canon=canon, beats=beats,
                total_episodes=30, episode_seconds=270.0)
    eb = eng.plan_episode(s, 1)
    beats.episodes[0] = eb
    rep = craft.check_beats(beats)
    ep1_issues = [i for i in rep.issues if i.ep == 1]
    assert not [i for i in ep1_issues if i.level == "error"], ep1_issues


def test_branch_options_returns_3_to_5():
    eng = ScreenwriterEngine(MockLLM())
    canon = eng.plan_settings("x")
    beats = eng.plan_season(canon, 30, 270.0)
    s = Session(name="t", canon=canon, beats=beats,
                total_episodes=30, episode_seconds=270.0)
    opts = eng.branch_options(s, 5)
    assert 3 <= len(opts) <= 5
    assert [o["key"] for o in opts] == ["1", "2", "3"]
    assert all(o["direction"] and o["consequence"] for o in opts)
    assert max(o["stakes"] for o in opts) == 4
    # 发散应使用较高温度
    assert eng.llm.json_calls[-1]["temperature"] == pytest.approx(0.9)


def test_branch_options_capped_at_five():
    eng = ScreenwriterEngine(MockLLM())
    canon = eng.plan_settings("x")
    beats = eng.plan_season(canon, 30, 270.0)
    s = Session(name="t", canon=canon, beats=beats,
                total_episodes=30, episode_seconds=270.0)
    assert len(eng.branch_options(s, 5, n=9)) <= 5


# --------------------------------------------------------------------------- #
# 创作层（分场景 prose + 自愈）
# --------------------------------------------------------------------------- #


def _session(eng):
    canon = eng.plan_settings("x")
    beats = eng.plan_season(canon, 30, 270.0)
    return Session(name="t", canon=canon, beats=beats,
                   total_episodes=30, episode_seconds=270.0)


def test_write_scene_produces_valid_markdown():
    eng = ScreenwriterEngine(MockLLM())
    s = _session(eng)
    eb = eng.plan_episode(s, 1)
    s.beats.episodes[0] = eb
    draft = eng.write_scene(s, 1, eb.scenes[0], scene_no_global=1)
    assert draft.markdown.strip().startswith("### 场景 1")
    rep = validate(_wrap_scene_for_validate(draft.markdown), "x")
    assert rep.ok, [(i.code, i.msg) for i in rep.errors]


def test_write_scene_uses_prose_not_json():
    """关键设计：正文走 chat（prose），不走 guided_json 字符串字段。"""
    llm = MockLLM()
    eng = ScreenwriterEngine(llm)
    s = _session(eng)
    eb = eng.plan_episode(s, 1)
    s.beats.episodes[0] = eb
    before = len(llm.chat_calls)
    eng.write_scene(s, 1, eb.scenes[0], 1)
    assert len(llm.chat_calls) == before + 1, "正文必须用 chat 而非 json"
    assert llm.chat_calls[-1]["temperature"] == pytest.approx(0.85)
    assert llm.chat_calls[-1]["max_tokens"] == 2400


def test_write_scene_strips_code_fences():
    """模型可能把 Markdown 包进 ```markdown 围栏，必须剥掉否则解析失败。"""
    eng = ScreenwriterEngine(MockLLM(fence=True))
    s = _session(eng)
    eb = eng.plan_episode(s, 1)
    s.beats.episodes[0] = eb
    draft = eng.write_scene(s, 1, eb.scenes[0], 1)
    assert "```" not in draft.markdown
    rep = validate(_wrap_scene_for_validate(draft.markdown), "x")
    assert rep.ok, [i.code for i in rep.errors]


def test_write_scene_self_repairs_bad_format():
    """自愈循环：首次输出坏格式（#### 场景），validator 报错后回灌修正。"""
    llm = MockLLM(bad_then_good=True)
    eng = ScreenwriterEngine(llm)
    s = _session(eng)
    eb = eng.plan_episode(s, 1)
    s.beats.episodes[0] = eb
    draft = eng.write_scene(s, 1, eb.scenes[0], 1)
    assert len(llm.chat_calls) == 2, "应触发一次修复重试"
    # 第二次调用的消息里必须包含 validator 的错误码，供模型定位问题
    rep = validate(_wrap_scene_for_validate(draft.markdown), "x")
    assert rep.ok


def test_write_scene_repair_prompt_contains_error_codes():
    llm = MockLLM(bad_then_good=True)
    eng = ScreenwriterEngine(llm)
    s = _session(eng)
    eb = eng.plan_episode(s, 1)
    s.beats.episodes[0] = eb
    eng.write_scene(s, 1, eb.scenes[0], 1)
    # 捕获第二次 chat 的消息内容
    captured = {}
    orig = MockLLM.chat

    def spy(self_, messages, **kw):
        if len(self_.chat_calls) >= 1:
            captured["msgs"] = messages
        return orig(self_, messages, **kw)

    # 重新跑一次以捕获
    llm2 = MockLLM(bad_then_good=True)
    llm2.chat = spy.__get__(llm2, MockLLM)
    eng2 = ScreenwriterEngine(llm2)
    s2 = _session(eng2)
    eb2 = eng2.plan_episode(s2, 1)
    s2.beats.episodes[0] = eb2
    eng2.write_scene(s2, 1, eb2.scenes[0], 1)
    repair_text = json.dumps(captured.get("msgs", []), ensure_ascii=False)
    assert "HEADING_TOO_DEEP" in repair_text, "修复 prompt 应含 validator 错误码"


def test_write_scene_injects_knowledge_constraints():
    """生成场景时，prompt 必须注入"该角色此刻不知道什么"。"""
    llm = MockLLM()
    eng = ScreenwriterEngine(llm)
    s = _session(eng)
    eb = eng.plan_episode(s, 1)
    s.beats.episodes[0] = eb
    captured = {}

    def spy(messages, **kw):
        captured["msgs"] = messages
        return MockLLM.chat(llm, messages, **kw)

    llm.chat = spy
    sb = eb.scenes[0]
    sb.characters = ["林晚", "顾沉"]
    eng.write_scene(s, 1, sb, 1)
    text = json.dumps(captured["msgs"], ensure_ascii=False)
    assert "顾沉是顾氏集团总裁" in text, "应把被隐瞒的事实作为负面约束注入"
    assert "不知道" in text


def test_write_scene_craft_issues_recorded():
    """craft 校验不通过时记录 issues（不阻断，供审阅）。"""
    short = "### 场景 1：房间 · 白天 · 内\n\n**镜头**：中景。\n> 林晚：好。\n"
    eng = ScreenwriterEngine(MockLLM(scene_md=short))
    s = _session(eng)
    eb = eng.plan_episode(s, 1)
    s.beats.episodes[0] = eb
    eb.scenes[0].target_seconds = 135.0
    draft = eng.write_scene(s, 1, eb.scenes[0], 1)
    assert draft.craft_ok is False
    assert any("EP_TOO_SHORT" in i for i in draft.craft_issues)


# --------------------------------------------------------------------------- #
# 审校层
# --------------------------------------------------------------------------- #


def test_critique_finds_knowledge_violation():
    eng = ScreenwriterEngine(MockLLM())
    s = _session(eng)
    rep = eng.critique_episode(s, 5, SCENE_MD)
    assert rep["violations"]
    v = rep["violations"][0]
    assert v["kind"] == "knowledge"
    assert v["severity"] == "blocker"


def test_apply_critique_updates_canon():
    eng = ScreenwriterEngine(MockLLM())
    s = _session(eng)
    crit = eng.critique_episode(s, 5, SCENE_MD)
    eng.apply_critique(s.canon, crit)
    assert "林晚与顾沉已领证" in s.canon.established_facts
    assert "领证现场对峙" in s.canon.used_beats


def test_apply_critique_dedupes():
    eng = ScreenwriterEngine(MockLLM())
    s = _session(eng)
    crit = {"violations": [], "new_facts": ["A", "A"], "beats_used": ["B", "B"]}
    eng.apply_critique(s.canon, crit)
    eng.apply_critique(s.canon, crit)
    assert s.canon.established_facts.count("A") == 1
    assert s.canon.used_beats.count("B") == 1


def test_critique_can_be_disabled():
    eng = ScreenwriterEngine(MockLLM(), EngineConfig(critique_every_episode=False))
    s = _session(eng)
    assert eng.critique_episode(s, 1, SCENE_MD) == {
        "violations": [], "new_facts": [], "beats_used": []}


# --------------------------------------------------------------------------- #
# 工具函数
# --------------------------------------------------------------------------- #


def test_strip_fences():
    assert _strip_fences("```markdown\n### x\n```").strip() == "### x"
    assert _strip_fences("```\n### x\n```").strip() == "### x"
    assert _strip_fences("### x").strip() == "### x"
    assert _strip_fences("").strip() == ""


def test_wrap_scene_for_validate_passes():
    md = _wrap_scene_for_validate(SCENE_MD)
    rep = validate(md, "x")
    assert rep.ok, [(i.code, i.msg) for i in rep.errors]


# --------------------------------------------------------------------------- #
# 渲染估算（必须与 docs/ARCHITECTURE.md §6 一致）
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize("shots,hours", [(1080, 54.0), (1620, 81.0), (2700, 135.0)])
def test_estimate_quality_matches_doc(shots, hours):
    assert estimate_render(shots)["render_hours"] == pytest.approx(hours, abs=0.5)


@pytest.mark.parametrize("shots,hours", [(1080, 25.7), (1620, 38.6), (2700, 64.3)])
def test_estimate_throughput_matches_doc(shots, hours):
    assert estimate_render(shots, "throughput")["render_hours"] == pytest.approx(hours, abs=0.5)


def test_estimate_disk():
    e = estimate_render(1620)
    assert 200 < e["disk_gb"] < 260


# --------------------------------------------------------------------------- #
# 端到端：从简介到可交付剧本
# --------------------------------------------------------------------------- #


def test_end_to_end_one_episode():
    """完整走一遍：简介 -> 设定 -> 规格 -> 季度 -> 分集 -> 场景正文 -> 发射 -> validate。"""
    from pipeline.parser import parse_screenplay
    from pipeline.screenwriter.emitter import EmitEpisode, EmitScene, EmitShot

    eng = ScreenwriterEngine(MockLLM())
    canon = eng.plan_settings("落魄千金为凑母亲手术费闪婚陌生人，婚后发现他是商业帝王")
    spec = eng.plan_spec(canon, "x")
    beats = eng.plan_season(canon, spec["total_episodes"], spec["episode_seconds"])
    s = Session(name="demo", canon=canon, beats=beats,
                total_episodes=spec["total_episodes"],
                episode_seconds=spec["episode_seconds"])

    eb = eng.plan_episode(s, 1)
    s.beats.episodes[0] = eb

    emit_scenes = []
    for i, sb in enumerate(eb.scenes, 1):
        draft = eng.write_scene(s, 1, sb, scene_no_global=i)
        crit = eng.critique_episode(s, 1, draft.markdown)
        eng.apply_critique(canon, crit)
        # 把 prose 解析回结构，组装成 EmitScene
        parsed = parse_screenplay(_wrap_scene_for_validate(draft.markdown))
        for sc in parsed["loose_scenes"]:
            emit_scenes.append(EmitScene(
                heading=sc["heading"], characters=sc["characters"],
                environment=sc["environment"], mood=sc["mood"],
                shots=[EmitShot(camera=sh["camera"], action=sh["action"],
                                lines=[{"speaker": l["speaker"], "emotion": l["emotion"],
                                        "kind": l["kind"], "text": l["text"]}
                                       for l in sh["lines"]],
                                sfx=sh["sfx"], transition=sh["transition"])
                       for sh in sc["shots"]]))

    md = eng.emit(s, [EmitEpisode(ep=1, title=eb.title, scenes=emit_scenes)])
    rep = validate(md, "final")
    assert rep.ok, [(i.code, i.msg) for i in rep.errors]
    raw = parse_screenplay(md)
    assert raw["_stats"]["episodes"] == 1
    assert raw["_stats"]["shots"] >= 2
    assert raw["meta"]["episode_seconds"] == 270
    assert canon.established_facts, "canon 应累积了新事实"
    assert canon.used_beats, "canon 应累积了已用桥段"
