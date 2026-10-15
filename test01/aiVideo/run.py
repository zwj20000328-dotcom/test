"""run.py —— AI 短剧一键生成入口。

    python run.py <剧本.md> [--project NAME] [--dry-run] [--only s2,s4] [--stubs]

本机（无 GPU）：--stubs 用占位引擎跑通全流程控制面（S1 解析 -> S2..S8 stub -> S9/S10 真实 ffmpeg 命令）。
服务器（8×A800）：默认加载真实引擎（vLLM/Qwen-Image/Wan2.2/CosyVoice/ACE-Step），逐阶段产出成片。

设计：run.py 只负责**接线**（组装 orchestrator + stages + engines），业务逻辑都在 pipeline/ 里。
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path
from typing import Optional

from pipeline.contracts import ShotStatus
from pipeline.engines.factory import build_engines
from pipeline.orchestrator import Orchestrator, ScreenplayChangedError, StageSpec
from pipeline.stages import AssembleStage, ConcatStage, NullStage, StubEngine, SubtitleStage

log = logging.getLogger("run")


def build_stages(use_stubs: bool, engines: dict) -> dict[str, StageSpec]:
    """组装阶段适配器。use_stubs=True 时 GPU 阶段用 NullStage 占位并回填契约字段。"""
    stages: dict[str, StageSpec] = {}

    if use_stubs:
        stub = StubEngine()
        # S2 enrich：只回填 prompt，不写产物文件
        stages["enrich"] = StageSpec(
            NullStage("enrich", (ShotStatus.parsed,), ShotStatus.enriched, stub,
                      write_artifact=False), queue="llm", gpu=0)
        # S4 keyframe -> keyframe_path (.png)
        stages["keyframe"] = StageSpec(
            NullStage("keyframe", (ShotStatus.enriched,), ShotStatus.keyframed, stub,
                      artifact_dir="keyframes", path_field="keyframe_path", ext=".png"),
            queue="keyframe", gpu=1)
        # S5a preview -> draft_clip_path (.mp4)，可选阶段（默认不跑）
        stages["preview"] = StageSpec(
            NullStage("preview", (ShotStatus.keyframed,), ShotStatus.drafted, stub,
                      artifact_dir="drafts", path_field="draft_clip_path", ext=".mp4"),
            queue="preview", gpu=0)
        # S5 video -> clip_path (.mp4)。同时消费 keyframed（未跑预览）与 drafted（跑过预览）
        stages["video"] = StageSpec(
            NullStage("video", (ShotStatus.keyframed, ShotStatus.drafted), ShotStatus.rendered, stub,
                      artifact_dir="clips", path_field="clip_path", ext=".mp4"),
            queue="video", gpu=3)
        # S6 tts -> audio_path (.wav) + line timestamps
        stages["tts"] = StageSpec(
            NullStage("tts", (ShotStatus.rendered,), ShotStatus.voiced, stub,
                      artifact_dir="voices", path_field="audio_path", ext=".wav"),
            queue="tts", gpu=7)
        # S8 bgm -> bgm_pick (.wav)，状态保持 subtitled（字幕已在 S7 完成）
        stages["bgm"] = StageSpec(
            NullStage("bgm", (ShotStatus.subtitled,), ShotStatus.subtitled, stub,
                      artifact_dir="music", path_field="bgm_pick", ext=".wav"),
            queue="music", gpu=7)
    else:
        # 服务器路径：真实 stage（注入 engines）。缺失的引擎会 warning 跳过。
        from pipeline.stages import (
            AssetsStage, BGMStage, EnrichStage, KeyframeStage, PreviewStage, TTSStage, VideoStage,
        )
        if engines.get("llm"):
            stages["enrich"] = StageSpec(EnrichStage(engines["llm"]), queue="llm", gpu=0)
        else:
            log.warning("无 llm 引擎，S2 enrich 跳过。")
        if engines.get("image"):
            stages["assets"] = StageSpec(
                AssetsStage(engines["image"], engines.get("tts"),
                            train_lora=bool(engines.get("lora"))), queue="keyframe", gpu=1)
            stages["keyframe"] = StageSpec(
                KeyframeStage(engines["image"], engines.get("face_qc")), queue="keyframe", gpu=1)
        else:
            log.warning("无 image 引擎，S3/S4 跳过。")
        if engines.get("video"):
            stages["video"] = StageSpec(VideoStage(engines["video"]), queue="video", gpu=3)
        else:
            log.warning("无 video 引擎，S5 跳过。")
        # preview 用独立的 TI2V-5B 引擎（480p 预览档）；未单独提供则复用终渲引擎。
        # preview 是可选阶段，默认不跑（见 orchestrator.OPTIONAL_STAGES）。
        preview_eng = engines.get("video_preview") or engines.get("video")
        if preview_eng:
            stages["preview"] = StageSpec(PreviewStage(preview_eng), queue="preview", gpu=0)
        if engines.get("tts"):
            stages["tts"] = StageSpec(TTSStage(engines["tts"]), queue="tts", gpu=7)
        else:
            log.warning("无 tts 引擎，S6 跳过。")
        if engines.get("music"):
            stages["bgm"] = StageSpec(BGMStage(engines["music"]), queue="music", gpu=7)
        else:
            log.warning("无 music 引擎，S8 跳过。")

    # CPU 阶段：字幕 + 装配 + 拼接（真实实现，任何机器可跑）
    stages["subtitle"] = StageSpec(SubtitleStage(), queue="subtitle")
    stages["assemble"] = StageSpec(AssembleStage(), queue="assembly")
    stages["concat"] = StageSpec(ConcatStage(), queue="assembly")
    return stages


def _resolve_screenplay(args) -> tuple[Optional[Path], Optional[str], Optional[str]]:
    """解析剧本来源，返回 (剧本路径, canon路径, 默认项目名)。

    两种来源二选一：
      --from-session NAME  -> sessions/NAME/screenplay.md（+ canon.json 复用）
      位置参数 screenplay   -> 直接给 .md 路径

    冲突或缺失都报错返回 (None, None, None)，由 main 转成 exit 2。
    """
    if args.from_session and args.screenplay:
        log.error("--from-session 与位置参数 screenplay 二选一，不能同时给。")
        return None, None, None
    if args.from_session:
        from pipeline.screenwriter.session import SessionStore
        store = SessionStore(args.sessions_dir)
        name = args.from_session
        paths = store.paths(name)
        if not paths.screenplay.exists():
            log.error("会话 '%s' 的剧本不存在：%s\n"
                      "请先在 scriptwriter.py 里 /export 或 /render 交付剧本。",
                      name, paths.screenplay)
            return None, None, None
        canon_path = str(paths.canon) if paths.canon.exists() else None
        log.info("从会话 '%s' 加载剧本：%s%s", name, paths.screenplay,
                 f"（canon：{canon_path}）" if canon_path else "（无 canon，S2 将重新推导）")
        return paths.screenplay, canon_path, name
    if args.screenplay:
        return Path(args.screenplay), None, None
    log.error("缺少剧本输入：给 .md 路径，或用 --from-session <会话名>。")
    return None, None, None


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="AI 短剧一键生成")
    ap.add_argument("screenplay", nargs="?", help="输入的 .md 剧本（与 --from-session 二选一）")
    ap.add_argument("--from-session", dest="from_session",
                    help="从互动式剧本会话启动：给会话名，自动解析 sessions/<名>/screenplay.md，"
                         "项目名默认取会话名，并复用会话的 canon.json（免 S2 重新推导角色圣经）")
    ap.add_argument("--sessions-dir", default="sessions", help="剧本会话根目录")
    ap.add_argument("--project", help="项目名（默认取剧本文件名或会话名）")
    ap.add_argument("--projects-dir", default="projects", help="项目根目录")
    ap.add_argument("--stubs", action="store_true", help="用占位引擎（本机无 GPU 验证控制流）")
    ap.add_argument("--dry-run", action="store_true", help="只构造命令/推进状态，不执行 ffmpeg/模型")
    ap.add_argument("--only", help="只跑指定阶段，逗号分隔：assets,enrich,keyframe,preview(可选,480p预览),video,tts,subtitle,bgm,assemble,concat")
    ap.add_argument("--fresh", action="store_true",
                    help="强制重新解析剧本（丢弃该 project 已有的全部进度）。"
                         "剧本改动后重建时使用；续跑请勿加此参数。")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    # 解析剧本来源：--from-session 或位置参数 screenplay（二选一）
    sp, canon_path, default_project = _resolve_screenplay(args)
    if sp is None:
        return 2
    if not sp.exists():
        log.error("剧本不存在：%s", sp)
        return 2
    project = args.project or default_project or sp.stem
    project_dir = Path(args.projects_dir) / project

    engines = build_engines(stubs=args.stubs)
    if not args.stubs and engines:
        log.info("已加载引擎：%s", ", ".join(sorted(engines)))
    stages = build_stages(use_stubs=args.stubs, engines=engines)

    orch = Orchestrator(project_dir=project_dir, stages=stages, dry_run=args.dry_run)
    orch.use_engines(engines)

    log.info("=== AI 短剧工作流启动 ===")
    log.info("剧本：%s", sp)
    log.info("项目：%s", project_dir)
    log.info("模式：%s%s", "STUB(占位)" if args.stubs else "REAL", "  DRY-RUN" if args.dry_run else "")

    # S0 + S1：首次运行则解析；续跑则加载已有进度（按剧本哈希检测是否被改动）。
    # canon_path 传入后，orchestrator 载入 canon.json 到 config['canon']，
    # S2 EnrichStage 复用 identity_blob 等（零 LLM 推导角色圣经）。
    try:
        orch.ensure_ingested(sp, fresh=args.fresh, canon_path=canon_path)
    except ScreenplayChangedError as e:
        log.error("剧本变更检测：\n%s", e)
        return 3

    only = args.only.split(",") if args.only else None
    summary = orch.run(only=only)

    log.info("=== 完成 ===")
    for k, v in summary.items():
        log.info("  %-10s %s", k, v)
    stats = orch.manifest.stats()
    log.info("状态分布：%s", stats["by_status"])
    if orch.manifest.final_path:
        log.info("成片：%s", orch.manifest.final_path)

    code = _exit_code(summary, stats, orch.manifest)
    if code:
        log.error("流水线未完全成功（退出码 %d）。详见上方日志与 manifest 状态。", code)
    return code


def _exit_code(summary: dict, stats: dict, manifest) -> int:
    """从各阶段摘要与状态分布推导退出码，供自动化判断成败。

    0 = 全部成功
    4 = 有镜头 failed（数据问题：生成失败/缺上游产物）
    5 = 有集装配失败（多为环境问题，如缺 ffmpeg）
    6 = 有镜头 needs_human（需人工介入；全自动模式下不应出现）
    """
    if stats["by_status"].get("needs_human"):
        return 6
    if any((v or {}).get("failed") for k, v in summary.items()
           if k not in ("assemble", "concat")):
        return 4
    if (summary.get("assemble") or {}).get("failed"):
        return 5
    if stats["by_status"].get("failed"):
        return 4
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
