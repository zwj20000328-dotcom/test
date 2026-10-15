"""会话存储 —— 崩溃安全的持久化、分支树、undo 历史。

存储布局（每会话一个目录）：
    sessions/<name>/
      session.json          # Session 主体（canon + beats + 进度 + 分支 + 历史）
      canon.json            # 冗余导出，供视频阶段 S2 enrich 直接复用（避免重新推导）
      beats.json            # 冗余导出，便于人工查看/编辑节拍表
      screenplay.md         # 交付物（validate 通过后写出）
      episodes/ep001.md …   # 每集正文分片（大剧下避免单文件膨胀）

为什么按集分片存正文：50 集 × 每集 6-9KB Markdown ≈ 400KB，塞进单个 session.json
会让每次存档都重写全部正文；分片后每集独立落盘，存档只写变化的那一集。
session.json 里只存 episodes_md 的**索引**（集号 -> 分片路径 + 哈希），不存正文本身。
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Optional

from .emitter import EmitEpisode, EmitScene, EmitShot
from .models import Canon, Session, content_hash

log = logging.getLogger("screenwriter.session")


@dataclass
class SessionPaths:
    root: Path
    session: Path
    canon: Path
    beats: Path
    screenplay: Path
    episodes_dir: Path

    @classmethod
    def for_session(cls, base: Path | str, name: str) -> "SessionPaths":
        root = Path(base) / name
        return cls(
            root=root,
            session=root / "session.json",
            canon=root / "canon.json",
            beats=root / "beats.json",
            screenplay=root / "screenplay.md",
            episodes_dir=root / "episodes",
        )


def _atomic_write(path: Path, payload: str) -> None:
    """原子写：临时文件 + os.replace，避免中途崩溃留下半截 JSON。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(payload, encoding="utf-8")
    os.replace(tmp, path)


class SessionStore:
    """会话的读写门面。所有写操作都是原子的、崩溃安全的。"""

    def __init__(self, base: Path | str = "sessions"):
        self.base = Path(base)

    def paths(self, name: str) -> SessionPaths:
        return SessionPaths.for_session(self.base, name)

    # ---- 生命周期 ----
    def exists(self, name: str) -> bool:
        return self.paths(name).session.exists()

    def create(self, name: str, synopsis: str = "", now: str = "") -> Session:
        p = self.paths(name)
        if p.session.exists():
            raise FileExistsError(
                f"会话 '{name}' 已存在（{p.session}）。"
                f"用 resume 继续，或换个名字，或删除该目录后重建。")
        p.root.mkdir(parents=True, exist_ok=True)
        p.episodes_dir.mkdir(parents=True, exist_ok=True)
        s = Session(name=name, source_synopsis=synopsis, created_at=now, updated_at=now)
        self.save(s, now=now)
        log.info("已创建会话 %s -> %s", name, p.root)
        return s

    def save(self, s: Session, now: str = "") -> None:
        """保存会话主体 + 冗余导出 canon/beats。正文分片由 save_episode 负责。

        session.json 里**不内嵌正文**，只存索引（集号 -> 字符数/哈希）。
        否则 50 集 × 8KB 会让每次存档都重写 ~400KB 正文，而存档在创作过程中
        每步都发生。正文的唯一事实源是 episodes/epNNN.md 分片。
        """
        p = self.paths(s.name)
        if now:
            s.updated_at = now
        data = s.model_dump(mode="json")
        # 用索引替换正文
        index = {}
        for ep, md in (s.episodes_md or {}).items():
            index[str(ep)] = {"chars": len(md), "sha": content_hash(md),
                              "shard": f"episodes/ep{int(ep):03d}.md"}
        data["episodes_index"] = index
        data.pop("episodes_md", None)
        _atomic_write(p.session, json.dumps(data, ensure_ascii=False, indent=2))
        s.canon.save(p.canon)
        s.beats.save(p.beats)

    def load(self, name: str) -> Session:
        p = self.paths(name)
        if not p.session.exists():
            raise FileNotFoundError(f"会话 '{name}' 不存在（{p.session}）")
        data = json.loads(p.session.read_text(encoding="utf-8"))
        index = data.pop("episodes_index", None)
        s = Session.model_validate(data)
        # 从分片回填正文（分片是唯一事实源；索引只用于校验与统计）
        if index:
            for ep_str in index:
                ep = int(ep_str)
                path = p.episodes_dir / f"ep{ep:03d}.md"
                if path.exists():
                    s.episodes_md[ep] = path.read_text(encoding="utf-8")
        return s

    def list_sessions(self) -> list[dict]:
        """列出所有会话及其进度摘要。"""
        out = []
        if not self.base.exists():
            return out
        for d in sorted(self.base.iterdir()):
            sp = d / "session.json"
            if not sp.exists():
                continue
            try:
                s = Session.load(sp)
            except Exception as e:  # noqa: BLE001
                out.append({"name": d.name, "error": str(e)})
                continue
            out.append({
                "name": s.name,
                "title": s.canon.title,
                "episodes": f"{len(s.completed_eps)}/{s.total_episodes}",
                "updated": s.updated_at,
                "delivered": bool(s.delivered_path),
                "branch": s.branch_id,
            })
        return out

    # ---- 每集正文分片 ----
    def episode_path(self, name: str, ep: int) -> Path:
        return self.paths(name).episodes_dir / f"ep{ep:03d}.md"

    def save_episode(self, s: Session, ep: int, md: str, now: str = "") -> Path:
        """写出一集正文分片，并把索引记进 session.episodes_md。"""
        path = self.episode_path(s.name, ep)
        _atomic_write(path, md)
        # episodes_md 存"集号 -> 内容"；为控制 session.json 体积，这里存内容，
        # 大剧可改为存路径（见模块文档）。当前实现两者兼顾：存内容 + 分片文件。
        s.episodes_md[ep] = md
        if ep not in s.completed_eps:
            s.completed_eps.append(ep)
            s.completed_eps.sort()
        s.current_ep = s.next_ep()
        self.save(s, now=now)
        return path

    def load_episode(self, name: str, ep: int) -> Optional[str]:
        path = self.episode_path(name, ep)
        if path.exists():
            return path.read_text(encoding="utf-8")
        s = self.load(name)
        return s.episodes_md.get(ep)

    # ---- 交付 ----
    def deliver(self, s: Session, episodes: list[EmitEpisode], md: str,
                now: str = "") -> Path:
        """写出最终 screenplay.md（交付物）。调用前应已过 validate。"""
        p = self.paths(s.name)
        _atomic_write(p.screenplay, md)
        s.delivered_path = str(p.screenplay)
        s.delivered_at = now
        self.save(s, now=now)
        log.info("已交付剧本 -> %s", p.screenplay)
        return p.screenplay

    # ---- undo / 分支 ----
    def snapshot(self, s: Session) -> dict:
        """给 undo 用的轻量快照（canon + beats + 进度；不含正文）。"""
        return {
            "canon": s.canon.model_dump(mode="json"),
            "beats": s.beats.model_dump(mode="json"),
            "completed_eps": list(s.completed_eps),
            "current_ep": s.current_ep,
            "history_len": len(s.history),
        }

    def restore_snapshot(self, s: Session, snap: dict) -> None:
        s.canon = Canon.model_validate(snap["canon"])
        from .models import BeatSheet
        s.beats = BeatSheet.model_validate(snap["beats"])
        s.completed_eps = list(snap["completed_eps"])
        s.current_ep = snap["current_ep"]
        # 历史截断回快照时的长度
        del s.history[snap["history_len"]:]

    def create_branch(self, s: Session, fork_ep: int, label: str = "",
                      now: str = "") -> str:
        """从某集分叉出一条新分支。返回新分支 id。

        分支实现为"复制会话目录"，而非在同一 session 里维护多份状态——
        这样分支之间完全隔离，探索一条分支不会污染主线，且可独立交付。
        """
        import shutil
        from .models import Branch
        new_id = f"{s.branch_id}-b{len(s.branches) + 1}"
        new_name = f"{s.name}__{new_id}"
        src = self.paths(s.name).root
        dst = self.paths(new_name).root
        if dst.exists():
            raise FileExistsError(f"分支目录已存在：{dst}")
        shutil.copytree(src, dst)
        # 在新副本上登记分支元信息并回退到分叉点
        ns = self.load(new_name)
        ns.name = new_name
        ns.branch_id = new_id
        ns.branches.append(Branch(id=new_id, parent=s.branch_id, fork_ep=fork_ep,
                                 label=label or f"第{fork_ep}集分叉", created_at=now))
        # 丢弃分叉点之后的进度
        ns.completed_eps = [e for e in ns.completed_eps if e < fork_ep]
        ns.current_ep = fork_ep
        ns.history = [h for h in ns.history if h.ep < fork_ep]
        self.save(ns, now=now)
        log.info("已创建分支 %s（从第 %d 集分叉）-> %s", new_id, fork_ep, dst)
        return new_name

    def list_branches(self, name: str) -> list[dict]:
        out = []
        if not self.base.exists():
            return out
        for d in sorted(self.base.iterdir()):
            if not (d / "session.json").exists():
                continue
            if d.name == name or d.name.startswith(name + "__"):
                try:
                    s = Session.load(d / "session.json")
                    out.append({"name": d.name, "branch": s.branch_id,
                                "episodes": f"{len(s.completed_eps)}/{s.total_episodes}",
                                "fork": (s.branches[-1].fork_ep if s.branches else None)})
                except Exception:  # noqa: BLE001
                    continue
        return out


# --------------------------------------------------------------------------- #
# 解析结果 -> EmitEpisode（供交付时组装）
# --------------------------------------------------------------------------- #


def parsed_scenes_to_emit(scenes: list[dict]) -> list[EmitScene]:
    """把 parser 产出的 scene dict 转回 emitter 的 EmitScene（用于重新发射全剧）。"""
    out = []
    for sc in scenes:
        shots = []
        for sh in sc.get("shots") or []:
            shots.append(EmitShot(
                camera=sh.get("camera"), action=sh.get("action"),
                lines=[{"speaker": ln.get("speaker"), "emotion": ln.get("emotion"),
                        "kind": ln.get("kind", "dialogue"), "text": ln.get("text", "")}
                       for ln in sh.get("lines") or []],
                sfx=sh.get("sfx") or [], transition=sh.get("transition")))
        out.append(EmitScene(
            heading=sc.get("heading", ""), characters=sc.get("characters") or [],
            environment=sc.get("environment"), mood=sc.get("mood"), shots=shots))
    return out
