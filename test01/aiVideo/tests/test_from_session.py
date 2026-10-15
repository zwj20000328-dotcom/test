"""run.py --from-session 接缝测试 —— 阶段 A 剧本会话 -> 阶段 B 视频流水线。

验证：
  - --from-session 与位置参数 screenplay 互斥
  - 正确解析 sessions/<name>/screenplay.md
  - canon.json 存在时透传路径供 S2 复用
  - 会话不存在/未导出时优雅报错（exit 2），不崩溃
  - 与 --stubs --dry-run 组合能端到端跑通
"""
from __future__ import annotations

from pathlib import Path

import pytest

import run as run_mod
from pipeline.parser import parse_screenplay
from pipeline.validate import validate


@pytest.fixture()
def session_dir(tmp_path):
    """造一个最小可用的剧本会话目录（screenplay.md + canon.json）。"""
    from pipeline.screenwriter.models import Canon, CanonCharacter
    from pipeline.screenwriter.session import SessionStore
    base = tmp_path / "sessions"
    store = SessionStore(base)
    s = store.create("demo", synopsis="x", now="t0")
    s.canon = Canon(title="接缝测试剧", genre="都市")
    s.canon.characters.append(CanonCharacter(
        id="x001", name="林晚", gender="女", age=28,
        appearance_zh="长直黑发，白色职业装，气质清冷"))
    store.save(s, now="t0")
    md = ('---\ntitle: 接缝测试剧\naspect_ratio: "9:16"\ntarget_episodes: 2\n'
          'episode_seconds: 270\n---\n\n# 接缝测试剧\n\n## 角色表\n\n'
          '- **林晚**：女，28岁。长直黑发，白色职业装，气质清冷。\n\n'
          '## 第1集\n\n### 场景 1：房间 · 白天 · 内\n\n'
          '**镜头**：中景。\n> 林晚：台词一。\n\n'
          '## 第2集\n\n### 场景 2：街道 · 夜 · 外\n\n'
          '**镜头**：全景。\n> 林晚：台词二。\n')
    store.deliver(s, [], md, now="t1")
    return base


# --------------------------------------------------------------------------- #
# _resolve_screenplay 单元
# --------------------------------------------------------------------------- #


class _Args:
    def __init__(self, **kw):
        self.screenplay = kw.get("screenplay")
        self.from_session = kw.get("from_session")
        self.sessions_dir = kw.get("sessions_dir", "sessions")


def test_resolve_from_session(session_dir):
    sp, canon, proj = run_mod._resolve_screenplay(
        _Args(from_session="demo", sessions_dir=str(session_dir)))
    assert sp is not None and sp.exists()
    assert sp.name == "screenplay.md"
    assert proj == "demo"
    assert canon is not None and Path(canon).exists(), "canon.json 应被透传供 S2 复用"


def test_resolve_positional_screenplay(tmp_path):
    md = tmp_path / "s.md"
    md.write_text("# t\n", encoding="utf-8")
    sp, canon, proj = run_mod._resolve_screenplay(_Args(screenplay=str(md)))
    assert sp == md
    assert canon is None
    assert proj is None       # 位置参数不设默认项目名，由 main 用 sp.stem


def test_resolve_mutually_exclusive(session_dir):
    """两个来源同时给 -> 报错返回 None。"""
    sp, canon, proj = run_mod._resolve_screenplay(
        _Args(screenplay="x.md", from_session="demo", sessions_dir=str(session_dir)))
    assert sp is None


def test_resolve_neither_given():
    sp, canon, proj = run_mod._resolve_screenplay(_Args())
    assert sp is None


def test_resolve_missing_session(tmp_path):
    sp, canon, proj = run_mod._resolve_screenplay(
        _Args(from_session="nope", sessions_dir=str(tmp_path)))
    assert sp is None


def test_resolve_session_without_export(tmp_path):
    """会话存在但还没导出 screenplay.md -> 报错返回 None。"""
    from pipeline.screenwriter.session import SessionStore
    store = SessionStore(tmp_path / "sessions")
    store.create("demo", now="t0")
    sp, canon, proj = run_mod._resolve_screenplay(
        _Args(from_session="demo", sessions_dir=str(tmp_path / "sessions")))
    assert sp is None


# --------------------------------------------------------------------------- #
# 端到端：--from-session + --stubs --dry-run
# --------------------------------------------------------------------------- #


def test_from_session_end_to_end(session_dir, tmp_path):
    """从会话跑通到全剧拼接（stubs + dry-run）。"""
    projects = tmp_path / "projects"
    code = run_mod.main([
        "--from-session", "demo",
        "--sessions-dir", str(session_dir),
        "--projects-dir", str(projects),
        "--stubs", "--dry-run",
    ])
    assert code == 0, f"退出码 {code}"
    manifest = projects / "demo" / "manifest.json"
    assert manifest.exists()
    raw = parse_screenplay((session_dir / "demo" / "screenplay.md").read_text(encoding="utf-8"))
    assert raw["_stats"]["episodes"] == 2


def test_from_session_passes_canon_path(session_dir, tmp_path, monkeypatch):
    """canon.json 应被载入并解析进 orchestrator.config['canon']，供 S2 复用。"""
    captured = {}
    from pipeline.orchestrator import Orchestrator
    orig_init = Orchestrator.__init__

    def spy_init(self, *a, **kw):
        orig_init(self, *a, **kw)
        captured["orch"] = self

    monkeypatch.setattr(Orchestrator, "__init__", spy_init)
    run_mod.main(["--from-session", "demo", "--sessions-dir", str(session_dir),
                  "--projects-dir", str(tmp_path / "p"), "--stubs", "--dry-run"])
    assert "orch" in captured
    orch = captured["orch"]
    # canon 已被解析成 dict（不只是路径字符串），EnrichStage 可直接读 identity_blob
    canon = orch.config.get("canon")
    assert isinstance(canon, dict), "canon 应被解析成 dict 存入 config"
    assert canon.get("characters"), "canon 应含角色"
    # manifest 记录了 canon_path 溯源
    assert orch.manifest.canon_path and Path(orch.manifest.canon_path).exists()


def test_missing_input_exits_2(tmp_path):
    """既不给 screenplay 也不给 --from-session -> exit 2。"""
    code = run_mod.main(["--projects-dir", str(tmp_path), "--stubs", "--dry-run"])
    assert code == 2
