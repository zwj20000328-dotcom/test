"""会话存储测试 —— 崩溃安全持久化、正文分片、分支隔离、undo 快照。"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline.screenwriter.models import (
    BeatSheet, Canon, CanonCharacter, Choice, EpisodeBeat, Session,
)
from pipeline.screenwriter.session import (
    SessionStore, parsed_scenes_to_emit,
)


@pytest.fixture()
def store(tmp_path):
    return SessionStore(tmp_path)


def _fill(s: Session, n_eps: int = 30) -> Session:
    s.canon = Canon(title="闪婚之后满级大佬", genre="都市甜宠")
    s.canon.characters.append(CanonCharacter(
        id="x001", name="林晚", gender="女", age=28,
        appearance_zh="长直黑发，白色职业装，气质清冷"))
    s.beats = BeatSheet(total_episodes=n_eps, episode_seconds=270.0)
    s.beats.episodes = [EpisodeBeat(ep=i, title=f"第{i}集", hook=f"钩子{i}",
                                    target_seconds=270.0) for i in range(1, n_eps + 1)]
    s.total_episodes = n_eps
    s.episode_seconds = 270.0
    return s


# --------------------------------------------------------------------------- #
# 生命周期
# --------------------------------------------------------------------------- #


def test_create_and_exists(store):
    s = store.create("demo", synopsis="简介", now="t0")
    assert s.name == "demo"
    assert store.exists("demo")
    assert store.paths("demo").root.exists()
    assert store.paths("demo").episodes_dir.exists()


def test_create_twice_raises(store):
    store.create("demo", now="t0")
    with pytest.raises(FileExistsError, match="已存在"):
        store.create("demo", now="t1")


def test_load_missing_raises(store):
    with pytest.raises(FileNotFoundError):
        store.load("nope")


def test_save_exports_canon_and_beats(store):
    s = _fill(store.create("demo", now="t0"))
    store.save(s, now="t1")
    p = store.paths("demo")
    assert p.canon.exists() and p.beats.exists()
    # canon.json 可被视频阶段直接复用
    c = Canon.load(p.canon)
    assert c.title == "闪婚之后满级大佬"
    assert c.characters[0].name == "林晚"


def test_roundtrip_preserves_everything(store):
    s = _fill(store.create("demo", now="t0"), n_eps=5)
    store.save(s, now="t1")
    s2 = store.load("demo")
    assert s2.canon.title == s.canon.title
    assert len(s2.beats.episodes) == 5
    assert s2.total_episodes == 5
    assert s2.canon.characters[0].appearance_zh


# --------------------------------------------------------------------------- #
# 正文分片：session.json 不内嵌正文
# --------------------------------------------------------------------------- #


def test_episode_shards_written(store):
    s = _fill(store.create("demo", now="t0"), n_eps=3)
    store.save(s)
    for ep in (1, 2, 3):
        store.save_episode(s, ep, f"## 第{ep}集\n\n台词{ep}\n")
    files = sorted(p.name for p in store.paths("demo").episodes_dir.iterdir())
    assert files == ["ep001.md", "ep002.md", "ep003.md"]


def test_session_json_excludes_prose(store):
    """核心：50 集正文不得让 session.json 膨胀（每步存档都重写它）。"""
    s = _fill(store.create("demo", now="t0"), n_eps=30)
    store.save(s)
    marker = "独特标记正文内容XYZ"
    for ep in range(1, 31):
        store.save_episode(s, ep, f"## 第{ep}集\n\n{marker * 50}\n")
    raw = store.paths("demo").session.read_text(encoding="utf-8")
    assert marker not in raw, "正文被内嵌进 session.json 了"
    data = json.loads(raw)
    assert "episodes_index" in data
    assert data["episodes_index"]["1"]["chars"] > 0
    assert data["episodes_index"]["1"]["sha"]
    assert data["episodes_index"]["1"]["shard"] == "episodes/ep001.md"


def test_session_json_size_bounded_at_50_episodes(store):
    s = _fill(store.create("demo", now="t0"), n_eps=50)
    store.save(s)
    body = "台词内容" * 400          # 每集约 3.2KB
    for ep in range(1, 51):
        store.save_episode(s, ep, f"## 第{ep}集\n\n{body}\n")
    size = store.paths("demo").session.stat().st_size
    # 索引 + canon + beats 应在几十 KB 内，与正文总量无关
    assert size < 60_000, f"session.json {size} bytes 过大"


def test_load_refills_prose_from_shards(store):
    s = _fill(store.create("demo", now="t0"), n_eps=3)
    store.save(s)
    for ep in (1, 2, 3):
        store.save_episode(s, ep, f"## 第{ep}集\n\n台词{ep}\n")
    s2 = store.load("demo")
    assert len(s2.episodes_md) == 3
    assert "台词2" in s2.episodes_md[2]


def test_save_episode_updates_progress(store):
    s = _fill(store.create("demo", now="t0"), n_eps=5)
    store.save(s)
    store.save_episode(s, 1, "x")
    assert s.completed_eps == [1]
    assert s.current_ep == 2
    store.save_episode(s, 3, "x")     # 乱序完成
    assert s.completed_eps == [1, 3]
    assert s.current_ep == 2          # next_ep 找第一个未完成的


def test_save_episode_idempotent(store):
    s = _fill(store.create("demo", now="t0"), n_eps=3)
    store.save(s)
    store.save_episode(s, 1, "a")
    store.save_episode(s, 1, "a")
    assert s.completed_eps == [1], "重复保存同一集不应重复记账"


def test_load_episode_helper(store):
    s = _fill(store.create("demo", now="t0"), n_eps=2)
    store.save(s)
    store.save_episode(s, 1, "内容一")
    assert store.load_episode("demo", 1) == "内容一"
    assert store.load_episode("demo", 2) is None


# --------------------------------------------------------------------------- #
# 崩溃安全
# --------------------------------------------------------------------------- #


def test_atomic_write_leaves_no_tmp(store):
    s = _fill(store.create("demo", now="t0"), n_eps=2)
    store.save(s)
    store.save_episode(s, 1, "x")
    leftovers = [p for p in store.paths("demo").root.rglob("*.tmp")]
    assert not leftovers, f"残留临时文件：{leftovers}"


def test_corrupt_session_is_detectable(store):
    """session.json 损坏时应抛错而非静默返回空会话。"""
    s = _fill(store.create("demo", now="t0"), n_eps=2)
    store.save(s)
    store.paths("demo").session.write_text("{ 半截 JSON", encoding="utf-8")
    with pytest.raises(Exception):
        store.load("demo")


def test_partial_crash_keeps_earlier_episodes(store):
    """写完第 2 集后崩溃，前 2 集必须完好（分片各自原子写）。"""
    s = _fill(store.create("demo", now="t0"), n_eps=5)
    store.save(s)
    store.save_episode(s, 1, "ep1 内容")
    store.save_episode(s, 2, "ep2 内容")
    # 模拟崩溃后重新加载
    s2 = store.load("demo")
    assert s2.completed_eps == [1, 2]
    assert s2.episodes_md[1] == "ep1 内容"
    assert store.load_episode("demo", 3) is None


# --------------------------------------------------------------------------- #
# 分支
# --------------------------------------------------------------------------- #


def test_create_branch_isolates_from_main(store):
    s = _fill(store.create("demo", now="t0"), n_eps=5)
    store.save(s)
    for ep in (1, 2, 3):
        store.save_episode(s, ep, f"ep{ep}")
    bn = store.create_branch(s, fork_ep=3, label="苏曼变初恋", now="t9")
    sb = store.load(bn)
    # 分支回退到分叉点之前
    assert sb.completed_eps == [1, 2]
    assert sb.current_ep == 3
    assert sb.branches[-1].fork_ep == 3
    assert sb.branches[-1].label == "苏曼变初恋"
    # 主线不受影响
    assert store.load("demo").completed_eps == [1, 2, 3]


def test_branch_history_truncated(store):
    s = _fill(store.create("demo", now="t0"), n_eps=5)
    store.save(s)
    s.history.append(Choice(ep=1, at="t1", chosen_key="2", summary="A"))
    s.history.append(Choice(ep=3, at="t3", chosen_key="1", summary="B"))
    store.save(s)
    bn = store.create_branch(s, fork_ep=3, now="t9")
    sb = store.load(bn)
    assert [h.ep for h in sb.history] == [1], "分叉点之后的历史应被截断"


def test_branch_writes_are_isolated(store):
    """在分支上改动不得污染主线。"""
    s = _fill(store.create("demo", now="t0"), n_eps=5)
    store.save(s)
    store.save_episode(s, 1, "主线 ep1")
    bn = store.create_branch(s, fork_ep=2, now="t9")
    sb = store.load(bn)
    store.save_episode(sb, 2, "分支 ep2")
    assert store.load_episode("demo", 2) is None
    assert store.load_episode(bn, 2) == "分支 ep2"


def test_list_branches(store):
    s = _fill(store.create("demo", now="t0"), n_eps=5)
    store.save(s)
    store.create_branch(s, fork_ep=2, now="t9")
    names = {b["name"] for b in store.list_branches("demo")}
    assert "demo" in names
    assert any(n.startswith("demo__") for n in names)


def test_list_sessions(store):
    s1 = _fill(store.create("a", now="t0"), n_eps=30)
    store.save(s1)
    store.save_episode(s1, 1, "x")
    store.create("b", now="t0")
    got = {x["name"]: x for x in store.list_sessions()}
    assert got["a"]["episodes"] == "1/30"
    assert got["a"]["title"] == "闪婚之后满级大佬"
    assert got["b"]["episodes"] == "0/30"


# --------------------------------------------------------------------------- #
# undo 快照
# --------------------------------------------------------------------------- #


def test_snapshot_restore_roundtrip(store):
    s = _fill(store.create("demo", now="t0"), n_eps=5)
    store.save(s)
    snap = store.snapshot(s)
    # 改动 canon / beats / 进度 / 历史
    s.canon.title = "改过的标题"
    s.canon.established_facts.append("新事实")
    s.beats.episodes[0].hook = "改过的钩子"
    s.completed_eps = [1, 2]
    s.history.append(Choice(ep=2, at="t", summary="x"))
    store.restore_snapshot(s, snap)
    assert s.canon.title == "闪婚之后满级大佬"
    assert s.canon.established_facts == []
    assert s.beats.episodes[0].hook == "钩子1"
    assert s.completed_eps == []
    assert s.history == []


def test_snapshot_does_not_include_prose(store):
    """快照用于 undo，不含正文（正文由分片管理），否则内存会爆。"""
    s = _fill(store.create("demo", now="t0"), n_eps=5)
    store.save(s)
    s.episodes_md = {i: "x" * 10000 for i in range(1, 6)}
    snap = store.snapshot(s)
    assert "episodes_md" not in snap
    assert json.dumps(snap, ensure_ascii=False).count("x" * 1000) == 0


# --------------------------------------------------------------------------- #
# 交付
# --------------------------------------------------------------------------- #


def test_deliver_writes_screenplay(store):
    s = _fill(store.create("demo", now="t0"), n_eps=2)
    store.save(s)
    p = store.deliver(s, [], "# 剧本\n", now="t9")
    assert p == store.paths("demo").screenplay
    assert p.read_text(encoding="utf-8") == "# 剧本\n"
    assert s.delivered_path == str(p)
    assert s.delivered_at == "t9"


# --------------------------------------------------------------------------- #
# parsed -> Emit 转换
# --------------------------------------------------------------------------- #


def test_parsed_scenes_to_emit():
    from pipeline.parser import parse_screenplay
    md = (
        "---\ntitle: t\naspect_ratio: \"9:16\"\n---\n\n# t\n\n## 第一集\n\n"
        "### 场景 1：房间 · 白天 · 内\n\n"
        "**人物**：林晚（白衣）\n**环境**：窗边\n**氛围**：紧张\n"
        "**镜头**：中景，林晚站立。\n**动作**：她转身。\n"
        "> 林晚（哽咽）：你走吧。\n**音效**：雨声\n**转场**：淡出\n"
    )
    raw = parse_screenplay(md)
    emit = parsed_scenes_to_emit(raw["episodes"][0]["scenes"])
    assert len(emit) == 1
    sc = emit[0]
    assert sc.mood == "紧张"
    assert sc.characters == ["林晚（白衣）"]
    assert len(sc.shots) == 1
    sh = sc.shots[0]
    assert sh.camera == "中景，林晚站立。"
    assert sh.sfx == ["雨声"]
    assert sh.transition == "淡出"
    assert sh.lines[0]["speaker"] == "林晚"
    assert sh.lines[0]["emotion"] == "哽咽"
    assert sh.lines[0]["text"] == "你走吧。"
