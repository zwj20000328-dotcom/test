"""发射器往返测试 —— 阶段 A/B 交接面的核心保证。

不变量：**emitter 产出的 Markdown 必须 (1) validate 零 error，(2) parse 回等价结构。**
这是"生成的剧本一定能被视频流水线消费"的唯一担保，故用往返测试锁死。
"""
from __future__ import annotations

import pytest

from pipeline.parser import parse_screenplay
from pipeline.screenwriter.emitter import (
    EmitEpisode, EmitScene, EmitShot, emit_screenplay, emit_skeleton,
)
from pipeline.screenwriter.models import (
    ActKind, BeatSheet, Canon, CanonCharacter, EpisodeBeat, SceneBeat, SeasonAct,
)
from pipeline.validate import validate


def _canon() -> Canon:
    c = Canon(title="闪婚之后满级大佬", genre="都市 / 甜宠 / 逆袭",
              style="写实电影感，暖色调", logline="为凑手术费，落魄千金闪婚陌生人。",
              core_conflict="契约婚姻 vs 真情")
    c.characters = [
        CanonCharacter(id="x001", name="林晚", gender="女", age=28, is_lead=True,
                       appearance_zh="长直黑发及腰，鹅蛋脸，白色职业装，颈间银色细项链"),
        CanonCharacter(id="x002", name="顾沉", gender="男", age=32, is_lead=True,
                       appearance_zh="利落短碎发，剑眉星目，深黑高定西装，左腕铂金腕表"),
        CanonCharacter(id="x003", name="苏曼", gender="女", age=30,
                       appearance_zh="精致卷发，红唇，名媛华服"),
    ]
    return c


def _episodes() -> list[EmitEpisode]:
    return [
        EmitEpisode(ep=1, title="契约", scenes=[
            EmitScene(heading="场景 1：民政局门口 · 白天 · 外",
                      characters=["林晚（白衬衫，紧张）", "顾沉（黑西装，冷峻）"],
                      environment="灰白民政局大楼，正午阳光刺眼", mood="紧张、命运感",
                      shots=[
                          EmitShot(camera="远景俯拍，两人对立而站。",
                                   action="林晚深吸一口气，攥紧户口本。",
                                   lines=[{"speaker": "林晚", "kind": "os",
                                           "text": "只要领了这本证，妈妈的手术费就有了。"}],
                                   sfx=["城市车流声", "远处蝉鸣"]),
                          EmitShot(camera="中景，顾沉递来一支笔。",
                                   lines=[{"speaker": "顾沉", "emotion": "冷淡",
                                           "text": "想清楚了？签了就没有回头路。"},
                                          {"speaker": "林晚", "emotion": "倔强",
                                           "text": "我签。"}],
                                   transition="闪白"),
                      ]),
            EmitScene(heading="场景 2：医院病房 · 傍晚 · 内",
                      characters=["林晚", "林母（病床）"],
                      environment="单人病房，暖黄台灯", mood="温情、心酸",
                      shots=[
                          EmitShot(camera="特写，林晚握着母亲的手。",
                                   lines=[{"speaker": "林母", "emotion": "虚弱",
                                           "text": "晚晚，妈拖累你了。"},
                                          {"speaker": "旁白", "kind": "narration",
                                           "text": "三年后。"}],
                                   sfx=["心电监护仪滴答声"]),
                      ]),
        ]),
        EmitEpisode(ep=2, title="反差", scenes=[
            EmitScene(heading="场景 3：顾氏顶层办公室 · 晨 · 内",
                      characters=["顾沉", "秦特助"],
                      environment="落地玻璃幕墙，冷色调", mood="凌厉",
                      shots=[
                          EmitShot(camera="仰拍，顾沉逆光而立。",
                                   lines=[{"speaker": "秦特助", "kind": "vo",
                                           "text": "顾总，您三天没回别墅了。"},
                                          {"speaker": "顾沉", "emotion": "淡漠",
                                           "text": "把林晚母亲的医疗团队换成最好的。"}]),
                      ]),
        ]),
    ]


# --------------------------------------------------------------------------- #
# 核心不变量：validate 零 error
# --------------------------------------------------------------------------- #


def test_emitted_validates_clean():
    md = emit_screenplay(_canon(), _episodes(), episode_seconds=270.0)
    rep = validate(md, "emitted")
    assert rep.ok, [(i.line, i.code, i.msg) for i in rep.errors]


def test_emitted_has_no_warnings():
    """发射器应当产出连 warning 都没有的规范剧本。"""
    md = emit_screenplay(_canon(), _episodes(), episode_seconds=270.0)
    rep = validate(md, "emitted")
    assert not rep.warnings, [(i.code, i.msg) for i in rep.warnings]


# --------------------------------------------------------------------------- #
# 往返：parse 回等价结构
# --------------------------------------------------------------------------- #


def test_roundtrip_structure_counts():
    md = emit_screenplay(_canon(), _episodes(), episode_seconds=270.0)
    raw = parse_screenplay(md)
    assert raw["_stats"]["episodes"] == 2
    assert raw["_stats"]["scenes"] == 3
    assert raw["_stats"]["shots"] == 4
    # 3 个声明角色 + 2 个自动补登记（林母/秦特助 作为说话人但未声明）
    assert raw["_stats"]["characters"] == 5
    assert raw["_stats"]["has_explicit_episodes"] is True


def test_roundtrip_front_matter():
    md = emit_screenplay(_canon(), _episodes(), episode_seconds=270.0,
                         target_episodes=30)
    raw = parse_screenplay(md)
    m = raw["meta"]
    assert m["title"] == "闪婚之后满级大佬"
    assert m["aspect_ratio"] == "9:16"        # 字符串，不是 556
    assert m["episode_seconds"] == 270
    assert m["target_episodes"] == 30
    assert m["language"] == "zh"


def test_roundtrip_characters():
    md = emit_screenplay(_canon(), _episodes())
    raw = parse_screenplay(md)
    got = {c["name"]: c for c in raw["characters"]}
    assert got["林晚"]["gender"] == "女"
    assert got["林晚"]["age"] == 28
    assert "长直黑发" in got["林晚"]["appearance"]
    assert got["顾沉"]["gender"] == "男"


def test_roundtrip_scene_fields():
    md = emit_screenplay(_canon(), _episodes())
    raw = parse_screenplay(md)
    sc = raw["episodes"][0]["scenes"][0]
    assert sc["location"] == "民政局门口"
    assert sc["time"] == "白天"
    assert sc["int_ext"] == "外"
    assert sc["mood"] == "紧张、命运感"
    assert sc["environment"]
    # 括号内逗号不被切碎
    assert len(sc["characters"]) == 2


def test_roundtrip_shot_boundaries():
    """每个 **镜头**：开启一个分镜，其后的对白/动作归属该镜。"""
    md = emit_screenplay(_canon(), _episodes())
    raw = parse_screenplay(md)
    sc = raw["episodes"][0]["scenes"][0]
    assert len(sc["shots"]) == 2
    sh0, sh1 = sc["shots"]
    assert sh0["camera"] == "远景俯拍，两人对立而站。"
    assert sh0["action"] == "林晚深吸一口气，攥紧户口本。"
    assert sh0["sfx"] == ["城市车流声", "远处蝉鸣"]
    assert sh1["transition"] == "闪白"
    assert len(sh0["lines"]) == 1
    assert len(sh1["lines"]) == 2


# --------------------------------------------------------------------------- #
# 往返：对白 kind 与 emotion 保真
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize("kind,expect_kind", [
    ("dialogue", "dialogue"),
    ("os", "os"),
    ("vo", "vo"),
    ("narration", "narration"),
])
def test_roundtrip_line_kind(kind, expect_kind):
    """四种声道类型发射后必须被 parser 还原成同一 kind。"""
    canon = _canon()
    speaker = "旁白" if kind == "narration" else "林晚"
    eps = [EmitEpisode(ep=1, scenes=[
        EmitScene(heading="场景 1：房间 · 白天 · 内",
                  shots=[EmitShot(camera="中景。",
                                  lines=[{"speaker": speaker, "kind": kind,
                                          "text": "测试台词内容。"}])])])
    ]
    md = emit_screenplay(canon, eps)
    raw = parse_screenplay(md)
    ln = raw["episodes"][0]["scenes"][0]["shots"][0]["lines"][0]
    assert ln["kind"] == expect_kind, f"{kind} -> {ln['kind']}"


def test_roundtrip_emotion_preserved():
    md = emit_screenplay(_canon(), _episodes())
    raw = parse_screenplay(md)
    lines = [ln for ep in raw["episodes"] for sc in ep["scenes"]
             for sh in sc["shots"] for ln in sh["lines"]]
    emos = {ln.get("emotion") for ln in lines}
    assert "冷淡" in emos
    assert "倔强" in emos


def test_roundtrip_os_with_emotion():
    """组合括注（内心OS，紧张）应同时还原 kind=os 与 emotion=紧张。"""
    canon = _canon()
    eps = [EmitEpisode(ep=1, scenes=[
        EmitScene(heading="场景 1：房间 · 白天 · 内",
                  shots=[EmitShot(camera="特写。",
                                  lines=[{"speaker": "林晚", "kind": "os",
                                          "emotion": "紧张", "text": "我别无选择。"}])])])
    ]
    md = emit_screenplay(canon, eps)
    rep = validate(md, "x")
    assert rep.ok, [i.code for i in rep.errors]
    raw = parse_screenplay(md)
    ln = raw["episodes"][0]["scenes"][0]["shots"][0]["lines"][0]
    assert ln["kind"] == "os"
    assert ln["emotion"] == "紧张"


# --------------------------------------------------------------------------- #
# 发射器自身约束
# --------------------------------------------------------------------------- #


def test_emitter_quotes_aspect_ratio():
    md = emit_screenplay(_canon(), _episodes())
    assert 'aspect_ratio: "9:16"' in md


def test_emitter_single_h1():
    md = emit_screenplay(_canon(), _episodes())
    h1 = [l for l in md.splitlines() if l.startswith("# ") and not l.startswith("## ")]
    assert len(h1) == 1


def test_emitter_always_emits_episode_headings():
    """必须显式 ## 第N集 —— 否则解析出 0 集（VERIFIED 陷阱）。"""
    md = emit_screenplay(_canon(), _episodes())
    assert "## 第1集" in md and "## 第2集" in md
    raw = parse_screenplay(md)
    assert raw["loose_scenes"] == []


def test_emitter_16_9_aspect():
    md = emit_screenplay(_canon(), _episodes(), aspect_ratio="16:9")
    raw = parse_screenplay(md)
    assert raw["meta"]["aspect_ratio"] == "16:9"


def test_emitter_handles_special_chars_in_dialogue():
    """对白含中文引号/破折号/感叹号不应破坏解析。"""
    canon = _canon()
    eps = [EmitEpisode(ep=1, scenes=[
        EmitScene(heading="场景 1：房间 · 白天 · 内",
                  shots=[EmitShot(camera="中景。",
                                  lines=[{"speaker": "林晚", "emotion": "哽咽",
                                          "text": "“你走！”——她喊道，声音发抖……"}])])])
    ]
    md = emit_screenplay(canon, eps)
    rep = validate(md, "x")
    assert rep.ok, [i.code for i in rep.errors]
    raw = parse_screenplay(md)
    ln = raw["episodes"][0]["scenes"][0]["shots"][0]["lines"][0]
    assert ln["text"] == "“你走！”——她喊道，声音发抖……"
    assert ln["emotion"] == "哽咽"


def test_emitter_empty_episode_list():
    """无集时不应崩溃（产出仅 front-matter + 角色表）。"""
    md = emit_screenplay(_canon(), [])
    assert "## 角色表" in md


# --------------------------------------------------------------------------- #
# 自动补登记说话人（保证输出自洽，validate 零 warning）
# --------------------------------------------------------------------------- #


def test_auto_declare_undeclared_speakers():
    """未登记的说话人自动补入角色表，消除 SPEAKER_UNDECLARED 警告。"""
    canon = Canon(title="t", characters=[
        CanonCharacter(id="x001", name="林晚", gender="女", age=28,
                       appearance_zh="长直黑发，白色职业装，气质清冷")])
    eps = [EmitEpisode(ep=1, scenes=[
        EmitScene(heading="场景 1：病房 · 白天 · 内",
                  shots=[EmitShot(camera="中景。",
                                  lines=[{"speaker": "林晚", "text": "妈，钱解决了。"},
                                         {"speaker": "林母", "emotion": "虚弱",
                                          "text": "晚晚，妈拖累你了。"}])])])
    ]
    md = emit_screenplay(canon, eps)
    rep = validate(md, "x")
    assert rep.ok, [i.code for i in rep.errors]
    assert not rep.warnings, [(i.code, i.msg) for i in rep.warnings]
    raw = parse_screenplay(md)
    names = {c["name"] for c in raw["characters"]}
    assert "林母" in names, "未登记说话人应被自动补入角色表"


def test_auto_declare_reports_added_names():
    """补登记了哪些角色可通过 undeclared_out 回传，供 engine 让 LLM 补外形。"""
    canon = _canon()
    added: list[str] = []
    emit_screenplay(canon, _episodes(), undeclared_out=added)
    assert set(added) == {"林母", "秦特助"}


def test_auto_declare_placeholder_appearance_is_visible():
    """补登记的角色带可见占位外形（提醒补全，且通过 CHAR_THIN 检查）。"""
    canon = _canon()
    md = emit_screenplay(canon, _episodes())
    assert "外形待补全" in md
    raw = parse_screenplay(md)
    linmu = next(c for c in raw["characters"] if c["name"] == "林母")
    assert len(linmu["appearance"]) >= 8, "占位外形太短会触发 CHAR_THIN"


def test_auto_declare_does_not_mutate_input_canon():
    """自动补登记不得修改调用方传入的 canon（避免重复发射时累积）。"""
    canon = _canon()
    before = len(canon.characters)
    emit_screenplay(canon, _episodes())
    emit_screenplay(canon, _episodes())
    assert len(canon.characters) == before, "canon 被就地修改了"


def test_auto_declare_skips_non_character_speakers():
    """旁白/画外音/字幕等声道标记不应被当成角色补登记。"""
    canon = Canon(title="t", characters=[
        CanonCharacter(id="x001", name="林晚", gender="女", age=28,
                       appearance_zh="长直黑发，白色职业装，气质清冷")])
    eps = [EmitEpisode(ep=1, scenes=[
        EmitScene(heading="场景 1：房间 · 白天 · 内",
                  shots=[EmitShot(camera="中景。",
                                  lines=[{"speaker": "旁白", "kind": "narration",
                                          "text": "三年后。"},
                                         {"speaker": "字幕", "kind": "subtitle",
                                          "text": "第一集"}])])])
    ]
    added: list[str] = []
    md = emit_screenplay(canon, eps, undeclared_out=added)
    assert added == [], f"声道标记被误当角色：{added}"
    rep = validate(md, "x")
    assert rep.ok


def test_auto_declare_can_be_disabled():
    """auto_declare_speakers=False 时应保留 SPEAKER_UNDECLARED 警告（用于诊断）。"""
    canon = Canon(title="t", characters=[
        CanonCharacter(id="x001", name="林晚", gender="女", age=28,
                       appearance_zh="长直黑发，白色职业装，气质清冷")])
    eps = [EmitEpisode(ep=1, scenes=[
        EmitScene(heading="场景 1：病房 · 白天 · 内",
                  shots=[EmitShot(camera="中景。",
                                  lines=[{"speaker": "林母", "text": "晚晚。"}])])])
    ]
    md = emit_screenplay(canon, eps, auto_declare_speakers=False)
    rep = validate(md, "x")
    assert any(i.code == "SPEAKER_UNDECLARED" for i in rep.warnings)


# --------------------------------------------------------------------------- #
# 骨架发射
# --------------------------------------------------------------------------- #


def _beats() -> BeatSheet:
    b = BeatSheet(total_episodes=2, episode_seconds=270.0)
    b.acts = [SeasonAct(kind=ActKind.hook, ep_from=1, ep_to=2, goal="黄金3秒入戏")]
    b.episodes = [
        EpisodeBeat(ep=1, title="契约", hook="顾沉的车停在门外", reversal=False,
                    scenes=[SceneBeat(scene_no=1, location="民政局门口", time="白天",
                                      int_ext="外", purpose="契约婚姻成立",
                                      mood="紧张", characters=["林晚", "顾沉"],
                                      target_seconds=135.0, key_line="我签。"),
                            SceneBeat(scene_no=2, location="医院病房", time="傍晚",
                                      int_ext="内", purpose="揭示动机",
                                      mood="心酸", characters=["林晚", "林母"],
                                      target_seconds=135.0)]),
        EpisodeBeat(ep=2, title="反差", hook="这表我在杂志上见过", reversal=True,
                    scenes=[SceneBeat(scene_no=3, location="顾氏顶层", time="晨",
                                      int_ext="内", purpose="身份反差首次露出",
                                      mood="凌厉", characters=["顾沉", "秦特助"],
                                      target_seconds=270.0)]),
    ]
    return b


def test_skeleton_validates_clean():
    md = emit_skeleton(_canon(), _beats())
    rep = validate(md, "skeleton")
    assert rep.ok, [(i.line, i.code, i.msg) for i in rep.errors]


def test_skeleton_roundtrip():
    md = emit_skeleton(_canon(), _beats())
    raw = parse_screenplay(md)
    assert raw["_stats"]["episodes"] == 2
    assert raw["_stats"]["scenes"] == 3
    # 每场景至少一个镜头（否则 validate 报 EMPTY_SCENE）
    for ep in raw["episodes"]:
        for sc in ep["scenes"]:
            assert sc["shots"], f"场景 {sc['id']} 无镜头"


def test_skeleton_carries_scene_meta():
    md = emit_skeleton(_canon(), _beats())
    raw = parse_screenplay(md)
    sc = raw["episodes"][0]["scenes"][0]
    assert sc["location"] == "民政局门口"
    assert sc["mood"] == "紧张"


def test_skeleton_key_line_becomes_narration():
    md = emit_skeleton(_canon(), _beats())
    raw = parse_screenplay(md)
    lines = [ln for sc in raw["episodes"][0]["scenes"] for sh in sc["shots"]
             for ln in sh["lines"]]
    assert any(ln["text"] == "我签。" for ln in lines)
