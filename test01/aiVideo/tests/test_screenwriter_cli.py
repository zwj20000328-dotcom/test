"""互动式 CLI 会话状态机测试 —— 打桩 UI + StubScreenwriterLLM，无需真实模型。

覆盖：完整创作流程、介入粒度分支、无人值守 batch、交付门、undo/回退、
命令解析、规格覆盖解析、以及"无法识别输入不死循环"这类健壮性。
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline.parser import parse_screenplay
from pipeline.screenwriter import ui
from pipeline.screenwriter.cli import SessionState, _SPEC_OVERRIDE_RE, _EP_OVERRIDE_RE, _SEC_OVERRIDE_RE
from pipeline.screenwriter.craft import check_script_content
from pipeline.screenwriter.engine import ScreenwriterEngine
from pipeline.screenwriter.models import InvolvementLevel, Session
from pipeline.screenwriter.session import SessionStore
from pipeline.screenwriter.stub_llm import StubScreenwriterLLM
from pipeline.validate import validate


# --------------------------------------------------------------------------- #
# 打桩 UI：记录调用、按脚本回答
# --------------------------------------------------------------------------- #

# 交互屏中没有 default= 的两个 prompt，给一个合理默认，避免每个测试都重复指定。
# 其余屏（确认？/接受建议？/介入粒度/调整？）代码里都带 default，会走 default 分支。
_DEFAULT_ANSWERS = {
    "选择": "1",      # 分支菜单：选第一个走向
    "审阅": "a",      # 审阅屏：接受
}


class FakeUI:
    """可编程的 UI 打桩：按 prompt 关键词返回预设答案，记录所有输出。"""

    def __init__(self, answers: dict[str, str] | None = None,
                 multiline: str = "落魄千金闪婚商业帝王。",
                 strict: bool = True):
        self.answers = answers or {}
        self.multiline = multiline
        self.strict = strict
        self.outputs: list[tuple[str, str]] = []
        self.asked: list[str] = []
        self._queue: dict[str, list[str]] = {}

    def queue(self, prompt_key: str, seq: list[str]) -> None:
        """为同一 prompt 的连续多次调用排队不同答案（如审阅多次）。"""
        self._queue[prompt_key] = list(seq)

    # ---- 打桩目标 ----
    def install(self, monkeypatch):
        for fn in ("title", "heading", "dim", "success", "warn", "error",
                   "echo", "rule"):
            monkeypatch.setattr(ui, fn, self._rec(fn))
        monkeypatch.setattr(ui, "panel", self._panel)
        monkeypatch.setattr(ui, "table", self._table)
        monkeypatch.setattr(ui, "ask", self._ask)
        monkeypatch.setattr(ui, "ask_multiline", self._multiline)
        monkeypatch.setattr(ui, "confirm", self._confirm)
        monkeypatch.setattr(ui, "progress_bar", lambda d, t, w=24: "")

        class _P:
            def __init__(s, *a, **k):
                pass

            def __enter__(s):
                return s

            def __exit__(s, *a):
                pass

            def update(s, *a, **k):
                pass

        monkeypatch.setattr(ui, "Progress", _P)

    def _rec(self, name):
        def f(*a, **k):
            self.outputs.append((name, " ".join(str(x) for x in a)))
        return f

    def _panel(self, text, title_="", border=""):
        self.outputs.append(("panel", f"{title_}|{text}"))

    def _table(self, headers, rows, title_=""):
        self.outputs.append(("table", f"{title_}|{rows}"))

    def _multiline(self, prompt, end_marker="EOF"):
        self.asked.append(prompt)
        return self.multiline

    def _confirm(self, prompt, default=False):
        self.asked.append(prompt)
        return True

    def _ask(self, prompt, default=None, validate=None, hint=""):
        self.asked.append(prompt)
        key = prompt
        if key in self._queue and self._queue[key]:
            val = self._queue[key].pop(0)
        elif key in self.answers:
            val = self.answers[key]
        elif key in _DEFAULT_ANSWERS:
            val = _DEFAULT_ANSWERS[key]
        elif default is not None:
            val = default
        else:
            # 严格模式：未预设答案且无默认值 -> 立即失败。
            # 静默返回 "y" 曾掩盖过真实死循环 bug（审阅屏收到 "y" 无限重问）。
            if self.strict:
                raise AssertionError(
                    f"测试未为 prompt {prompt!r} 预设答案（且无默认值）。"
                    f"请在 FakeUI(answers=...) 或 _DEFAULT_ANSWERS 里补上。")
            val = "y"
        if validate and not validate(val):
            raise AssertionError(f"打桩答案 {val!r} 未通过 validate（prompt={prompt}）")
        return val

    def text(self) -> str:
        return "\n".join(f"{k}: {v}" for k, v in self.outputs)


# --------------------------------------------------------------------------- #
# fixtures
# --------------------------------------------------------------------------- #


@pytest.fixture()
def env(tmp_path, monkeypatch):
    """返回 (store, engine, fake_ui)。"""
    fui = FakeUI()
    fui.install(monkeypatch)
    store = SessionStore(tmp_path / "sessions")
    engine = ScreenwriterEngine(StubScreenwriterLLM())
    return store, engine, fui


def _new_state(store, engine, name="demo", **kw) -> SessionState:
    sess = store.create(name, synopsis="x", now="t0")
    return SessionState(store=store, engine=engine, session=sess, now=lambda: "t1", **kw)


# --------------------------------------------------------------------------- #
# 完整流程
# --------------------------------------------------------------------------- #


def test_full_flow_produces_valid_screenplay(env):
    """端到端：简介 -> 设定 -> 规格 -> 弧线 -> 逐集 -> 交付，产出合法剧本。"""
    store, engine, fui = env
    st = _new_state(store, engine)
    st.run_new(title="测试剧", synopsis="落魄千金闪婚", episodes=4,
               episode_seconds=270, involvement=3)
    assert st.session.completed_eps == [1, 2, 3, 4]
    assert st.session.is_complete()

    md = st.engine.deliver_markdown(st.session)
    rep = validate(md, "final")
    assert rep.ok, [(i.code, i.line, i.msg) for i in rep.errors]


def test_full_flow_screens_in_order(env):
    """五个前置屏都出现，且顺序正确。"""
    store, engine, fui = env
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", episodes=3, episode_seconds=270, involvement=3)
    asked = fui.asked
    assert any("简介" in a for a in asked) or fui.multiline
    assert any("确认" in a for a in asked), asked          # 设定卡
    assert any("接受建议" in a for a in asked), asked      # 规格
    assert any("调整" in a for a in asked), asked          # 季度弧线


def test_delivered_screenplay_passes_craft(env):
    """交付的剧本要过 craft 时长校验（240-300 秒/集），不只是格式校验。"""
    store, engine, fui = env
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", episodes=3, episode_seconds=270, involvement=3)
    raw = parse_screenplay(st.engine.deliver_markdown(st.session))
    rep = check_script_content(raw)
    assert rep.ok, [(i.code, i.ep) for i in rep.errors]
    for e in rep.stats["per_episode"]:
        assert 240 <= e["est_seconds"] <= 300, e


def test_aspect_ratio_quoted_in_delivery(env):
    store, engine, fui = env
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", episodes=2, episode_seconds=270, involvement=3)
    md = st.engine.deliver_markdown(st.session)
    assert 'aspect_ratio: "9:16"' in md
    raw = parse_screenplay(md)
    assert raw["meta"]["aspect_ratio"] == "9:16"


def test_explicit_episode_headings_present(env):
    """必须有 '## 第N集'，否则 episodes=0（VERIFIED 陷阱）。"""
    store, engine, fui = env
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", episodes=3, episode_seconds=270, involvement=3)
    md = st.engine.deliver_markdown(st.session)
    for ep in (1, 2, 3):
        assert f"## 第{ep}集" in md
    assert parse_screenplay(md)["loose_scenes"] == []


# --------------------------------------------------------------------------- #
# 规格确认（决策 #2：用户指定、模型建议）
# --------------------------------------------------------------------------- #


def test_spec_uses_model_suggestion_on_yes(env):
    store, engine, fui = env
    fui.answers["接受建议？"] = "y"
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", involvement=3, autoplay_to=0)
    # stub 建议 30 集 × 270 秒
    assert st.session.total_episodes == 30
    assert st.session.episode_seconds == 270


def test_spec_free_override(env):
    """用户输入「40 集 × 4 分钟」应被解析并采用。"""
    store, engine, fui = env
    fui.answers["接受建议？"] = "40 集 × 4 分钟"
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", involvement=3, autoplay_to=0)
    assert st.session.total_episodes == 40
    assert st.session.episode_seconds == 240


def test_spec_override_episodes_only(env):
    store, engine, fui = env
    fui.answers["接受建议？"] = "25集"
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", involvement=3, autoplay_to=0)
    assert st.session.total_episodes == 25


def test_spec_rejects_out_of_range(env):
    """集数越界应重新询问，第二次给合法值。"""
    store, engine, fui = env
    fui.queue("接受建议？", ["99 集 × 4.5 分钟", "y"])
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", involvement=3, autoplay_to=0)
    assert st.session.total_episodes == 30     # 99 被拒，回落到接受建议
    assert any("超出" in t for _, t in fui.outputs), "应提示越界"


def test_spec_regex_helpers():
    assert _SPEC_OVERRIDE_RE.search("40 集 × 4.5 分钟").groups() == ("40", "4.5")
    assert _EP_OVERRIDE_RE.search("25集").group(1) == "25"
    assert _SEC_OVERRIDE_RE.search("4.5 分钟").group(1) == "4.5"


# --------------------------------------------------------------------------- #
# 介入粒度
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize("n,level", [(1, InvolvementLevel.major),
                                     (2, InvolvementLevel.every_episode),
                                     (3, InvolvementLevel.autopilot)])
def test_involvement_levels(env, n, level):
    store, engine, fui = env
    fui.answers["介入粒度"] = str(n)
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", episodes=2, episode_seconds=270, involvement=n)
    assert st.session.involvement == level


def test_autopilot_never_prompts_branch_menu(env):
    """autopilot 模式不得进审阅循环或分支菜单（否则 batch 会卡在 EOF）。"""
    store, engine, fui = env
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", episodes=3, episode_seconds=270, involvement=3)
    assert not any(a == "审阅" for a in fui.asked)
    assert not any(a == "选择" for a in fui.asked)


def test_every_episode_prompts_branch_menu(env):
    """tier2 每集都要问走向。"""
    store, engine, fui = env
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", episodes=3, episode_seconds=270, involvement=2)
    assert fui.asked.count("选择") == 3, fui.asked


def test_every_episode_prompts_review(env):
    store, engine, fui = env
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", episodes=2, episode_seconds=270, involvement=2)
    assert fui.asked.count("审阅") >= 2


def test_noninteractive_skips_all_prompts(env):
    """batch 模式（noninteractive）三个确认屏都不问。"""
    store, engine, fui = env
    st = _new_state(store, engine, noninteractive=True)
    st.run_new(title="t", synopsis="x", episodes=2, episode_seconds=270, involvement=3)
    assert not any(a in ("确认？", "接受建议？", "调整？") for a in fui.asked), fui.asked
    assert st.session.completed_eps == [1, 2]


# --------------------------------------------------------------------------- #
# 审阅循环健壮性
# --------------------------------------------------------------------------- #


def test_unknown_review_input_does_not_hang(env):
    """无法识别的输入必须给提示并重问，不能静默死循环。"""
    store, engine, fui = env
    fui.queue("审阅", ["zzz", "a"])       # 先给垃圾输入，再接受
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", episodes=1, episode_seconds=270, involvement=2)
    assert st.session.completed_eps == [1]
    assert any("未识别" in t for _, t in fui.outputs), "应提示未识别输入"


def test_review_enter_shows_detail_then_accept(env):
    store, engine, fui = env
    fui.queue("审阅", ["", "a"])          # 回车展开正文，再接受
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", episodes=1, episode_seconds=270, involvement=2)
    assert st.session.completed_eps == [1]
    assert any(k == "panel" and "正文" in v for k, v in fui.outputs), "回车应展开正文"


def test_review_regen_keeps_episode(env):
    store, engine, fui = env
    fui.queue("审阅", ["g", "a"])          # 重生成后接受
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", episodes=1, episode_seconds=270, involvement=2)
    assert st.session.completed_eps == [1]
    assert st.session.episodes_md[1]


# --------------------------------------------------------------------------- #
# 防死循环：连续无效输入必须中止（曾导致进程永久占住）
# --------------------------------------------------------------------------- #


def test_review_aborts_after_repeated_bad_input(env):
    """审阅屏连续无效输入达上限必须抛 Interrupted 并保存进度，不能无限循环。"""
    from pipeline.screenwriter.cli import _MAX_BAD_INPUT
    store, engine, fui = env
    fui.queue("审阅", ["zzz"] * (_MAX_BAD_INPUT + 2))
    st = _new_state(store, engine)
    with pytest.raises(ui.Interrupted):
        st.run_new(title="t", synopsis="x", episodes=2, episode_seconds=270,
                   involvement=2)
    # 中止前进度已保存
    assert store.load("demo").canon.title
    warns = [t for k, t in fui.outputs if k == "warn"]
    assert any("未识别" in w for w in warns), "应逐次提示未识别输入"


def test_spec_aborts_after_repeated_bad_input(env):
    """规格确认屏同样受保护（无效输入 + 越界输入都要计数）。"""
    from pipeline.screenwriter.cli import _MAX_BAD_INPUT
    store, engine, fui = env
    fui.queue("接受建议？", ["听不懂的话"] * (_MAX_BAD_INPUT + 2))
    st = _new_state(store, engine)
    with pytest.raises(ui.Interrupted):
        st.run_new(title="t", synopsis="x", episodes=None, episode_seconds=None,
                   involvement=3)


def test_spec_recovers_within_bad_input_budget(env):
    """上限之内给出合法输入应正常继续，不误伤。"""
    from pipeline.screenwriter.cli import _MAX_BAD_INPUT
    store, engine, fui = env
    fui.queue("接受建议？", ["听不懂"] * (_MAX_BAD_INPUT - 1) + ["25 集 × 4.5 分钟"])
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", involvement=3, autoplay_to=0)
    assert st.session.total_episodes == 25
    assert st.session.episode_seconds == 270


def test_review_revise_applies_instruction(env):
    store, engine, fui = env
    fui.answers["要改成什么？"] = "让女主角当场反击"
    fui.queue("审阅", ["r", "a"])
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", episodes=1, episode_seconds=270, involvement=2)
    assert st.session.completed_eps == [1]
    assert st._snapshots, "修改前应存快照供 undo"


# --------------------------------------------------------------------------- #
# undo / back
# --------------------------------------------------------------------------- #


def test_undo_restores_previous_state(env):
    store, engine, fui = env
    fui.answers["要改成什么？"] = "让女主角当场反击"
    fui.queue("审阅", ["r", "a"])
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", episodes=1, episode_seconds=270, involvement=2)
    assert st._snapshots, "修改前应存快照"
    canon_before = json.dumps(st.session.canon.model_dump(mode="json"), ensure_ascii=False)
    assert st.undo() is True
    # 撤销后 canon 回到快照时的状态
    canon_after = json.dumps(st.session.canon.model_dump(mode="json"), ensure_ascii=False)
    assert canon_after != canon_before or st._snapshots == []


def test_undo_without_snapshot_warns(env):
    store, engine, fui = env
    st = _new_state(store, engine)
    assert st.undo() is False
    assert any("没有可撤销" in t for _, t in fui.outputs)


def test_back_rolls_back_episodes(env):
    store, engine, fui = env
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", episodes=4, episode_seconds=270, involvement=3)
    assert st.session.completed_eps == [1, 2, 3, 4]
    st._back(2)
    assert st.session.completed_eps == [1, 2]
    assert st.session.current_ep == 3
    # 分片文件也应删除
    assert not store.episode_path("demo", 4).exists()


def test_back_beyond_start_warns(env):
    store, engine, fui = env
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", episodes=1, episode_seconds=270, involvement=3)
    st._back(5)
    assert st.session.completed_eps == []
    assert any("无法再回退" in t for _, t in fui.outputs)


# --------------------------------------------------------------------------- #
# 命令解析
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize("cmd,expect_quit", [
    ("/status", False), ("/help", False), ("/canon", False),
    ("/branch list", False), ("/review", False),
    ("/quit", True), ("/exit", True),
])
def test_commands_dispatch(env, cmd, expect_quit):
    store, engine, fui = env
    st = _new_state(store, engine)
    st.session.canon.title = "t"
    assert (st._handle_command(cmd, 1) == "quit") is expect_quit


def test_unknown_command_warns(env):
    store, engine, fui = env
    st = _new_state(store, engine)
    st._handle_command("/bogus", 1)
    assert any("未知命令" in t for _, t in fui.outputs)


def test_autopilot_command_toggles(env):
    store, engine, fui = env
    st = _new_state(store, engine)
    st._handle_command("/autopilot on", 1)
    assert st.session.involvement == InvolvementLevel.autopilot
    st._handle_command("/autopilot off", 1)
    assert st.session.involvement == InvolvementLevel.every_episode


def test_involvement_command_validates(env):
    store, engine, fui = env
    st = _new_state(store, engine)
    st._handle_command("/involvement 1", 1)
    assert st.session.involvement == InvolvementLevel.major
    st._handle_command("/involvement 9", 1)
    assert any("用法" in t for _, t in fui.outputs)


def test_status_shows_progress(env):
    store, engine, fui = env
    st = _new_state(store, engine)
    st.session.total_episodes = 30
    st.session.canon.title = "我的剧"
    st._handle_command("/status", 1)
    txt = fui.text()
    assert "我的剧" in txt and "0/30" in txt


def test_canon_subject_lookup(env):
    store, engine, fui = env
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", episodes=1, episode_seconds=270, involvement=3)
    st._handle_command("/canon 女主角", 1)
    assert "角色档案" in fui.text()
    st._handle_command("/canon 不存在的人", 1)
    assert any("未找到角色" in t for _, t in fui.outputs)


# --------------------------------------------------------------------------- #
# 交付
# --------------------------------------------------------------------------- #


def test_export_writes_and_validates(env, tmp_path):
    store, engine, fui = env
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", episodes=2, episode_seconds=270, involvement=3)
    p = st.export()
    assert p.exists()
    assert validate(p.read_text(encoding="utf-8"), "x").ok
    assert st.session.delivered_path == str(p)


def test_render_gate_blocks_when_incomplete(env):
    store, engine, fui = env
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", episodes=3, episode_seconds=270,
               involvement=3, autoplay_to=1)
    assert not st.session.is_complete()
    assert st.render_gate() is False
    assert any("无法交付" in t for _, t in fui.outputs)


def test_render_gate_shows_cost_estimate(env):
    store, engine, fui = env
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", episodes=2, episode_seconds=270, involvement=3)
    st.render_gate()
    txt = fui.text()
    assert "交付确认" in txt
    assert "渲染预估" in txt and "磁盘" in txt


def test_render_gate_declines_without_confirm(env, monkeypatch):
    store, engine, fui = env
    monkeypatch.setattr(ui, "confirm", lambda p, default=False: False)
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", episodes=2, episode_seconds=270, involvement=3)
    assert st.render_gate() is False


# --------------------------------------------------------------------------- #
# 持久化与恢复
# --------------------------------------------------------------------------- #


def test_progress_persisted_each_episode(env):
    store, engine, fui = env
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", episodes=3, episode_seconds=270, involvement=3)
    reloaded = store.load("demo")
    assert reloaded.completed_eps == [1, 2, 3]
    assert reloaded.canon.title


def test_resume_continues_from_cursor(env):
    store, engine, fui = env
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", episodes=4, episode_seconds=270,
               involvement=3, autoplay_to=2)
    assert store.load("demo").completed_eps == [1, 2]

    # 新进程恢复
    st2 = resume_like(store, engine)
    st2._episode_loop()
    assert st2.session.completed_eps == [1, 2, 3, 4]


def resume_like(store, engine) -> SessionState:
    sess = store.load("demo")
    return SessionState(store=store, engine=engine, session=sess, now=lambda: "t2")


def test_canon_accumulates_across_episodes(env):
    store, engine, fui = env
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", episodes=3, episode_seconds=270, involvement=3)
    c = st.session.canon
    assert c.established_facts, "应累积新事实"
    assert c.used_beats, "应累积已用桥段（防重复）"


def test_history_records_choices(env):
    store, engine, fui = env
    st = _new_state(store, engine)
    st.run_new(title="t", synopsis="x", episodes=2, episode_seconds=270, involvement=2)
    assert len(st.session.history) == 2
    assert all(h.ep in (1, 2) for h in st.session.history)
