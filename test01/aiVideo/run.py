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

from pipeline.contracts import ShotStatus
from pipeline.orchestrator import Orchestrator, StageSpec
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
        # S5 video -> clip_path (.mp4)
        stages["video"] = StageSpec(
            NullStage("video", (ShotStatus.keyframed,), ShotStatus.rendered, stub,
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
            AssetsStage, BGMStage, EnrichStage, KeyframeStage, TTSStage, VideoStage,
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


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="AI 短剧一键生成")
    ap.add_argument("screenplay", help="输入的 .md 剧本")
    ap.add_argument("--project", help="项目名（默认取剧本文件名）")
    ap.add_argument("--projects-dir", default="projects", help="项目根目录")
    ap.add_argument("--stubs", action="store_true", help="用占位引擎（本机无 GPU 验证控制流）")
    ap.add_argument("--dry-run", action="store_true", help="只构造命令/推进状态，不执行 ffmpeg/模型")
    ap.add_argument("--only", help="只跑指定阶段，逗号分隔：assets,enrich,keyframe,video,tts,subtitle,bgm,assemble,concat")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    sp = Path(args.screenplay)
    if not sp.exists():
        log.error("剧本不存在：%s", sp)
        return 2
    project = args.project or sp.stem
    project_dir = Path(args.projects_dir) / project

    engines = {"llm": StubEngine(), "image": StubEngine(), "video": StubEngine(),
               "tts": StubEngine(), "music": StubEngine()} if args.stubs else {}
    stages = build_stages(use_stubs=args.stubs, engines=engines)

    orch = Orchestrator(project_dir=project_dir, stages=stages, dry_run=args.dry_run)
    orch.use_engines(engines)

    log.info("=== AI 短剧工作流启动 ===")
    log.info("剧本：%s", sp)
    log.info("项目：%s", project_dir)
    log.info("模式：%s%s", "STUB(占位)" if args.stubs else "REAL", "  DRY-RUN" if args.dry_run else "")

    # S0 + S1
    orch.ingest(sp)

    only = args.only.split(",") if args.only else None
    summary = orch.run(only=only)

    log.info("=== 完成 ===")
    for k, v in summary.items():
        log.info("  %-10s %s", k, v)
    stats = orch.manifest.stats()
    log.info("状态分布：%s", stats["by_status"])
    if orch.manifest.final_path:
        log.info("成片：%s", orch.manifest.final_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
