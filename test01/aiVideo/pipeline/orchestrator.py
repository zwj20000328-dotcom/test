"""编排器 (Orchestrator) —— 驱动 10 阶段流水线的状态机。

职责：
  1. 加载/保存 manifest.json（唯一事实源），按 shot.status 决定跳过还是执行（断点续跑）。
  2. 把每个阶段映射到一个 Stage 适配器；GPU 阶段通过适配器注入真实模型引擎
     （本机无 GPU 时用 Stub 适配器，只走状态流转，便于开发与测试控制面）。
  3. 提供 Celery 任务分发的挂载点（服务器上用），本地/无 redis 时退化为串行执行。

设计：**控制面与执行面分离**。编排器只管"下一步做什么、状态怎么推进、失败怎么重试"，
不关心具体用哪个模型——模型由 Stage 适配器封装（见 pipeline/stages/）。

用法（一键）：
    python run.py examples/sample_screenplay.md --project demo
等价于：
    orch = Orchestrator(project_dir="projects/demo")
    orch.ingest("examples/sample_screenplay.md")
    orch.run()          # 跑完所有阶段
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional, Protocol

from .contracts import Manifest, Shot, ShotStatus, manifest_from_raw
from .parser import parse_screenplay

log = logging.getLogger("orchestrator")


class ScreenplayChangedError(RuntimeError):
    """续跑时发现剧本被改动 —— 重新解析会丢弃进度，需用户显式 --fresh 确认。"""


# --------------------------------------------------------------------------- #
# Stage 适配器协议
# --------------------------------------------------------------------------- #


class Stage(Protocol):
    """一个流水线阶段的适配器。"""
    name: str
    #: 该阶段处理的输入状态 -> 输出状态
    consumes: tuple[ShotStatus, ...]
    produces: ShotStatus

    def run_shot(self, shot: Shot, ctx: "StageContext") -> ShotStatus:
        """处理单个镜头，返回新状态（成功=produces，失败=failed/needs_human）。"""
        ...


@dataclass
class StageContext:
    """传给 Stage 的运行上下文：项目目录、manifest、模型引擎句柄。"""
    project_dir: Path
    manifest: Manifest
    engines: dict = field(default_factory=dict)   # {"image": <engine>, "video": ...}
    config: dict = field(default_factory=dict)
    dry_run: bool = False

    def path(self, *parts: str) -> Path:
        p = self.project_dir.joinpath(*parts)
        p.parent.mkdir(parents=True, exist_ok=True)
        return p


# --------------------------------------------------------------------------- #
# 阶段注册表
# --------------------------------------------------------------------------- #


@dataclass
class StageSpec:
    stage: Stage
    queue: str = "default"        # Celery 队列名
    gpu: Optional[int] = None     # 钉绑的物理 GPU（None=CPU）
    retries: int = 2


# 逻辑阶段顺序（S0/S1 是解析前置，S2-S10 见下表）。
# assets(S3,每剧一次) 在 enrich 之后（需要 identity_blob）、keyframe 之前（keyframe 用 sheet）。
# assemble(S9)/concat(S10) 是 episode/drama 级，单独处理，见 Orchestrator。
STAGE_ORDER: list[str] = [
    "enrich",       # S2 LLM 分镜/prompt
    "assets",       # S3 角色资产锁定（每剧一次，非 per-shot）
    "keyframe",     # S4 关键帧 (+QC)
    "preview",      # S5a 480p 预览（可选，见 OPTIONAL_STAGES）
    "video",        # S5 图生视频（终渲）
    "tts",          # S6 配音
    "subtitle",     # S7 字幕
    "bgm",          # S8 BGM/SFX
    "assemble",     # S9 分集装配 (per-shot 归入集 + 集级拼接)
]

# 可选阶段：只有被 --only 显式点名时才跑。
# preview 要额外 3-6 小时 GPU，默认跳过；但"先预览再终渲"能避免白烧 81 小时，
# 故保留为显式选项。video 阶段同时消费 keyframed 和 drafted，两条路径都通。
OPTIONAL_STAGES: frozenset = frozenset({"preview"})


# --------------------------------------------------------------------------- #
# 编排器
# --------------------------------------------------------------------------- #


class Orchestrator:
    def __init__(
        self,
        project_dir: Path | str,
        stages: Optional[dict[str, StageSpec]] = None,
        config: Optional[dict] = None,
        dry_run: bool = False,
        checkpoint_every: int = 20,
        checkpoint_interval: float = 300.0,
    ):
        self.project_dir = Path(project_dir)
        self.project_dir.mkdir(parents=True, exist_ok=True)
        self.manifest_path = self.project_dir / "manifest.json"
        self.config = config or {}
        self.dry_run = dry_run
        self.stages: dict[str, StageSpec] = stages or {}
        self._celery = None
        # 增量存档阈值：每 N 个镜头或每 M 秒落盘一次（取先到者）。
        # 默认 20 镜 / 300 秒：终渲单镜 4-8 分钟，故实际按镜头数触发居多；
        # 轻量阶段（解析/字幕）则按秒触发，避免为 3000 镜频繁写 10-20MB JSON。
        self.checkpoint_every = checkpoint_every
        self.checkpoint_interval = checkpoint_interval

    # ---- 生命周期 ----
    @staticmethod
    def screenplay_hash(screenplay_md: Path | str) -> str:
        """剧本内容哈希，用于检测续跑时剧本是否被改动。"""
        import hashlib
        data = Path(screenplay_md).read_bytes()
        return hashlib.sha256(data).hexdigest()[:16]

    def ingest(self, screenplay_md: Path | str) -> Manifest:
        """S0 校验 + S1 解析：把 .md 变成 manifest.json。

        注意：这会**丢弃**该 project 已有的全部进度（重新解析即从零开始）。
        续跑场景请用 ensure_ingested()，它会按剧本哈希决定加载还是重新解析。
        """
        from .validate import validate  # 延迟导入，避免循环
        text = Path(screenplay_md).read_text(encoding="utf-8")

        report = validate(text, str(screenplay_md))
        if not report.ok:
            errs = "\n".join(f"  L{i.line} {i.code}: {i.msg}" for i in report.errors)
            raise ValueError(f"剧本校验未通过（{len(report.errors)} error）：\n{errs}")
        for w in report.warnings:
            log.warning("剧本 warning L%s %s: %s", w.line, w.code, w.msg)

        raw = parse_screenplay(text)
        self.manifest = manifest_from_raw(raw)
        self.manifest.project = self.project_dir.name
        self.manifest.source_path = str(Path(screenplay_md).resolve())
        self.manifest.source_hash = self.screenplay_hash(screenplay_md)
        self.manifest.save(self.manifest_path)
        log.info("S1 解析完成：%s", self.manifest.stats())
        return self.manifest

    def ensure_ingested(self, screenplay_md: Path | str, fresh: bool = False) -> Manifest:
        """幂等入口：首次运行则解析，续跑则加载已有进度。

        决策逻辑：
          - fresh=True：强制重新解析（丢弃进度）。用于剧本改动后重建。
          - 无 manifest.json：首次运行 → 解析。
          - 有 manifest 且剧本哈希一致：加载（续跑），保留所有已完成镜头的状态。
          - 有 manifest 但剧本哈希不同：抛 ScreenplayChangedError。因为重新解析会丢弃
            进度（可能几十小时渲染成果），必须由用户显式确认，绝不静默覆盖。
        """
        if fresh or not self.manifest_path.exists():
            return self.ingest(screenplay_md)

        existing = Manifest.load(self.manifest_path)
        current = self.screenplay_hash(screenplay_md)
        if existing.source_hash and existing.source_hash != current:
            raise ScreenplayChangedError(
                f"剧本已改动（manifest 记录 {existing.source_hash}，当前 {current}）。\n"
                f"项目 {self.project_dir.name} 已有进度：{existing.stats()['by_status']}\n"
                f"重新解析会丢弃全部进度。若确认要重建，请加 --fresh；\n"
                f"若想保留进度，请撤销对剧本的改动。"
            )
        self.manifest = existing
        log.info("续跑：加载已有 manifest（%s）", self.manifest.stats()["by_status"])
        return self.manifest

    def load(self) -> Manifest:
        if not self.manifest_path.exists():
            raise FileNotFoundError(f"manifest 不存在：{self.manifest_path}，请先 ingest()")
        self.manifest = Manifest.load(self.manifest_path)
        return self.manifest

    @property
    def ctx(self) -> StageContext:
        return StageContext(
            project_dir=self.project_dir,
            manifest=self.manifest,
            engines=getattr(self, "_engines", {}),
            config=self.config,
            dry_run=self.dry_run,
        )

    # ---- 主循环 ----
    def run(self, only: Optional[list[str]] = None, resume: bool = True) -> dict:
        """按 STAGE_ORDER 推进所有 per-shot 阶段；S3/S9/S10 在合适位置触发。

        resume=True：跳过已达目标状态的 shot（断点续跑）。
        返回各阶段计数摘要。
        """
        if not hasattr(self, "manifest"):
            self.load()
        summary: dict[str, dict] = {}

        for stage_name in STAGE_ORDER:
            if not self._should_run(stage_name, only):
                continue
            spec = self.stages.get(stage_name)
            if spec is None:
                log.warning("阶段 '%s' 未注册适配器，跳过。", stage_name)
                continue
            if stage_name == "assets":
                summary[stage_name] = self._run_assets()
                self.manifest.save(self.manifest_path)
                continue
            if hasattr(spec.stage, "run_episode"):
                # episode 级阶段（assemble / 真实 bgm）：按集调用 run_episode
                summary[stage_name] = self._run_episode_level(spec)
                self.manifest.save(self.manifest_path)
                continue
            summary[stage_name] = self._run_per_shot(spec, resume=resume)
            self.manifest.save(self.manifest_path)

        # S10 全剧拼接
        if self._should_run("concat", only):
            summary["concat"] = self._run_concat()

        self.manifest.save(self.manifest_path)
        log.info("流水线完成。最终状态：%s", self.manifest.stats()["by_status"])
        return summary

    def _should_run(self, name: str, only: Optional[list[str]]) -> bool:
        # 显式点名 -> 一定跑（包括可选阶段）
        if only is not None:
            return name in only
        # 未点名（全跑模式）-> 可选阶段默认跳过
        return name not in OPTIONAL_STAGES

    def _run_per_shot(self, spec: StageSpec, resume: bool = True) -> dict:
        stage = spec.stage
        counts = {"processed": 0, "skipped": 0, "failed": 0}
        targets = list(stage.consumes)

        # 增量存档：长 stage（video 在 30 集规模下约 81 小时）若只在结束时存一次，
        # 中途崩溃会丢掉整个 stage 的进度并从头重渲。按镜头数/耗时双阈值触发。
        dirty = 0
        last_save = time.monotonic()

        def checkpoint(force: bool = False) -> None:
            nonlocal dirty, last_save
            if not dirty:
                return
            elapsed = time.monotonic() - last_save
            if force or dirty >= self.checkpoint_every or elapsed >= self.checkpoint_interval:
                self.manifest.save(self.manifest_path)
                dirty = 0
                last_save = time.monotonic()

        for shot in self.manifest.iter_shots():
            if resume and shot.status not in targets:
                # 已经越过本阶段（或还没到）——只在状态匹配时处理
                if shot.status == stage.produces or _status_after(shot.status, stage.produces):
                    counts["skipped"] += 1
                    continue
                if shot.status not in targets:
                    continue
            for attempt in range(spec.retries + 1):
                try:
                    new_status = self._dispatch(stage, shot)
                    shot.status = new_status
                    if new_status in (ShotStatus.failed, ShotStatus.needs_human):
                        counts["failed"] += 1
                    else:
                        counts["processed"] += 1
                    dirty += 1
                    break
                except Exception as e:  # noqa: BLE001
                    log.error("阶段 %s 处理 %s 第 %d 次失败：%s",
                              stage.name, shot.id, attempt + 1, e)
                    if attempt == spec.retries:
                        shot.status = ShotStatus.failed
                        shot.qc.notes = f"{stage.name} failed: {e}"
                        counts["failed"] += 1
                        dirty += 1
            checkpoint()

        checkpoint(force=True)
        return counts

    def _dispatch(self, stage: Stage, shot: Shot) -> ShotStatus:
        """把单镜头任务分发到执行面（本地串行 or Celery）。"""
        if self._celery is not None and not self.dry_run:
            # 服务器路径：投递到 Celery 队列，按 GPU 钉绑；这里返回 queued，
            # 实际状态由 worker 回写 manifest（见 tasks.py）。
            self._enqueue(stage, shot)
            return shot.status
        return stage.run_shot(shot, self.ctx)

    def _enqueue(self, stage: Stage, shot: Shot) -> None:
        raise NotImplementedError("Celery 分发在服务器部署时接线（scripts/start_workers.sh）")

    # ---- 集级 / 剧级阶段 ----
    def _run_assets(self) -> dict:
        """S3 角色一致性资产锁定（每剧一次）。适配器名 'assets'。"""
        spec = self.stages.get("assets")
        if spec is None:
            log.warning("未注册 assets 适配器，跳过角色资产锁定。")
            return {"skipped": True}
        # 资产阶段是 per-character，不走 per-shot 协议
        fn: Optional[Callable] = getattr(spec.stage, "run_assets", None)
        if fn is None:
            return {"skipped": True}
        result = fn(self.manifest, self.ctx)
        self.manifest.save(self.manifest_path)
        return result or {"done": True}

    def _run_episode_level(self, spec: StageSpec) -> dict:
        """episode 级阶段（S8 真实 BGM / S9 装配）：对每集调用 stage.run_episode。"""
        fn = spec.stage.run_episode
        counts = {"episodes": 0, "failed": 0}
        for ep in self.manifest.episodes:
            try:
                fn(ep, self.ctx)
                counts["episodes"] += 1
            except Exception as e:  # noqa: BLE001
                log.error("%s 处理第 %s 集失败：%s", spec.stage.name, ep.ep, e)
                counts["failed"] += 1
        return counts

    def _run_concat(self) -> dict:
        """S10 全剧拼接。适配器名 'concat'。"""
        spec = self.stages.get("concat")
        if spec is None:
            return {"skipped": True}
        fn = getattr(spec.stage, "run_concat", None)
        if fn is None:
            return {"skipped": True}
        out = fn(self.manifest, self.ctx)
        self.manifest.save(self.manifest_path)
        return {"final_path": out}

    # ---- 引擎注入 ----
    def use_engines(self, engines: dict) -> None:
        self._engines = engines

    def enable_celery(self, broker_url: str = "redis://localhost:6379/0") -> None:
        self._celery = broker_url


# --------------------------------------------------------------------------- #
# 状态顺序（用于 resume 跳过判断）
# --------------------------------------------------------------------------- #

_STATUS_ORDER = [
    ShotStatus.parsed, ShotStatus.enriched, ShotStatus.keyframed, ShotStatus.drafted,
    ShotStatus.rendered, ShotStatus.voiced, ShotStatus.subtitled, ShotStatus.assembled,
]


def _status_after(a: ShotStatus, b: ShotStatus) -> bool:
    """a 是否在流水线顺序上已超过 b。"""
    try:
        return _STATUS_ORDER.index(a) > _STATUS_ORDER.index(b)
    except ValueError:
        return False
