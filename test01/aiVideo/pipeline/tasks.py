"""Celery 应用 + 任务定义（服务器执行面）。

start_services.sh 用 `celery -A pipeline.tasks worker --queues=...` 启动每卡一个 worker。
每个任务接收 shot_id，从 manifest 载入该 shot，跑对应 stage，回写状态与产物路径。

设计：任务是**幂等**的——重复投递同一 shot_id，已完成的会被跳过（状态检查）。
manifest 的读写用文件锁避免多 worker 竞争（projects/<drama>/manifest.lock）。

本机无 redis 时，run.py 走串行路径（orchestrator._dispatch 直接调用 stage），不经过本模块。
"""
from __future__ import annotations

import fcntl
import logging
import os
from contextlib import contextmanager
from pathlib import Path

from celery import Celery
from celery.utils.log import get_task_logger

from .contracts import Manifest, ShotStatus

log = get_task_logger(__name__)

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
PROJECTS_DIR = Path(os.environ.get("PROJECTS_DIR", "projects"))

app = Celery(
    "ai_drama",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

# 队列定义（与 start_services.sh 的 --queues 对应）
app.conf.task_queues = {
    "llm": {}, "keyframe": {}, "video": {}, "preview": {},
    "tts": {}, "asr": {}, "music": {}, "subtitle": {}, "assembly": {},
}
app.conf.task_routes = {
    "pipeline.tasks.enrich_shot": {"queue": "llm"},
    "pipeline.tasks.keyframe_shot": {"queue": "keyframe"},
    "pipeline.tasks.video_shot": {"queue": "video"},
    "pipeline.tasks.tts_shot": {"queue": "tts"},
    "pipeline.tasks.subtitle_shot": {"queue": "subtitle"},
    "pipeline.tasks.assemble_episode": {"queue": "assembly"},
    "pipeline.tasks.concat_drama": {"queue": "assembly"},
}
app.conf.task_acks_late = True          # 任务完成后才 ack，worker 崩溃可重投
app.conf.worker_prefetch_multiplier = 1  # 每卡 concurrency=1，避免预取占卡


# --------------------------------------------------------------------------- #
# manifest 文件锁（多 worker 竞争同一 manifest.json）
# --------------------------------------------------------------------------- #


@contextmanager
def _locked_manifest(project: str):
    """加锁读写 manifest.json，防止多 worker 并发覆盖。"""
    pdir = PROJECTS_DIR / project
    mpath = pdir / "manifest.json"
    lockpath = pdir / "manifest.lock"
    pdir.mkdir(parents=True, exist_ok=True)
    with open(lockpath, "w") as lf:
        fcntl.flock(lf, fcntl.LOCK_EX)
        try:
            m = Manifest.load(mpath)
            yield m
            m.save(mpath)
        finally:
            fcntl.flock(lf, fcntl.LOCK_UN)


def _find_shot(m: Manifest, shot_id: str):
    for sh in m.iter_shots():
        if sh.id == shot_id:
            return sh
    raise KeyError(f"shot {shot_id} 不在 manifest 中")


def _get_stage(name: str):
    """按名加载真实 stage（服务器部署时各 stage 已接线真实引擎）。"""
    from run import build_stages   # 复用 run.py 的装配逻辑
    engines = _load_engines()
    stages = build_stages(use_stubs=os.environ.get("USE_STUBS") == "1", engines=engines)
    spec = stages.get(name)
    if spec is None:
        raise RuntimeError(f"stage '{name}' 未注册")
    return spec.stage


def _load_engines() -> dict:
    """加载真实模型引擎（vLLM client / DiffSynth / CosyVoice…）。

    服务器上按需实现：
      llm   -> vLLM OpenAI 兼容 client（LLM_BASE_URL）
      image -> Qwen-Image-2.1 (DiffSynth)
      video -> Wan2.2-I2V-A14B (DiffSynth)
      tts   -> CosyVoice2
      music -> ACE-Step
    本机默认返回空 dict（build_stages 在 use_stubs 下用 StubEngine）。
    """
    return {}


# --------------------------------------------------------------------------- #
# 任务
# --------------------------------------------------------------------------- #


@app.task(bind=True, max_retries=2, default_retry_delay=10)
def _run_stage_on_shot(self, stage_name: str, project: str, shot_id: str):
    """通用：对单个 shot 跑指定 stage，回写状态。幂等。"""
    try:
        with _locked_manifest(project) as m:
            shot = _find_shot(m, shot_id)
            stage = _get_stage(stage_name)
            # 幂等：已达/超过目标状态则跳过
            if shot.status == stage.produces:
                log.info("[%s] %s 已完成，跳过", stage_name, shot_id)
                return {"shot": shot_id, "status": shot.status.value, "skipped": True}
            from .orchestrator import StageContext
            ctx = StageContext(project_dir=PROJECTS_DIR / project, manifest=m,
                               engines=_load_engines(), config={}, dry_run=False)
            new_status = stage.run_shot(shot, ctx)
            shot.status = new_status
            log.info("[%s] %s -> %s", stage_name, shot_id, new_status.value)
            return {"shot": shot_id, "status": new_status.value}
    except Exception as exc:  # noqa: BLE001
        log.error("[%s] %s 失败: %s", stage_name, shot_id, exc)
        raise self.retry(exc=exc)


@app.task
def enrich_shot(project: str, shot_id: str):
    return _run_stage_on_shot("enrich", project, shot_id)


@app.task
def keyframe_shot(project: str, shot_id: str):
    return _run_stage_on_shot("keyframe", project, shot_id)


@app.task
def video_shot(project: str, shot_id: str):
    return _run_stage_on_shot("video", project, shot_id)


@app.task
def tts_shot(project: str, shot_id: str):
    return _run_stage_on_shot("tts", project, shot_id)


@app.task
def subtitle_shot(project: str, shot_id: str):
    return _run_stage_on_shot("subtitle", project, shot_id)


@app.task
def assemble_episode(project: str, ep: int):
    """S9：装配一集。"""
    with _locked_manifest(project) as m:
        episode = next((e for e in m.episodes if e.ep == ep), None)
        if episode is None:
            raise KeyError(f"episode {ep} 不存在")
        stage = _get_stage("assemble")
        from .orchestrator import StageContext
        ctx = StageContext(project_dir=PROJECTS_DIR / project, manifest=m, dry_run=False)
        out = stage.run_episode(episode, ctx)
        return {"ep": ep, "episode_path": out}


@app.task
def concat_drama(project: str):
    """S10：全剧拼接。"""
    with _locked_manifest(project) as m:
        stage = _get_stage("concat")
        from .orchestrator import StageContext
        ctx = StageContext(project_dir=PROJECTS_DIR / project, manifest=m, dry_run=False)
        out = stage.run_concat(m, ctx)
        return {"final_path": out}
