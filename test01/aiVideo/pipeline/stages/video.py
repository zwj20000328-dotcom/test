"""S5 图生视频阶段 —— 关键帧 + 运动 prompt -> 竖屏视频片段。

两级：先 480p 预览(TI2V-5B)校时/校运镜，锁定后终渲 720p(A14B)。
本 stage 默认跑终渲；预览可单独用 PreviewStage（同引擎 mode=preview）。
表演/动作特写走 Animate 引擎。母带按 shot_id 存档，持久化 seed/模型版本。
"""
from __future__ import annotations

import logging

from ..contracts import Shot, ShotStatus
from ..orchestrator import StageContext

log = logging.getLogger("stages.video")


class VideoStage:
    name = "video"
    consumes = (ShotStatus.keyframed,)
    produces = ShotStatus.rendered

    def __init__(self, video_engine):
        self.video = video_engine

    def run_shot(self, shot: Shot, ctx: StageContext) -> ShotStatus:
        if not shot.keyframe_path:
            log.error("镜头 %s 无关键帧，无法生成视频。", shot.id)
            shot.status = ShotStatus.failed
            return ShotStatus.failed
        out = ctx.path("clips", f"{shot.id}.mp4")
        try:
            self.video.generate(
                image_path=shot.keyframe_path,
                motion_prompt=shot.motion_prompt_en or "subtle natural motion",
                out_path=out,
                seed=shot.seed or 0,
                num_frames=shot.num_frames or 81,
            )
        except Exception as e:  # noqa: BLE001
            log.error("视频生成失败 %s：%s", shot.id, e)
            shot.status = ShotStatus.failed
            return ShotStatus.failed
        shot.clip_path = str(out)
        shot.artifacts.model = f"wan2.2-{getattr(self.video, 'mode', 'final')}"
        shot.artifacts.seed = shot.seed
        return ShotStatus.rendered


class PreviewStage(VideoStage):
    """S5a 预览：480p TI2V-5B，每卡一 worker，校时/校运镜后再终渲。"""
    name = "preview"
    consumes = (ShotStatus.keyframed,)
    produces = ShotStatus.drafted

    def run_shot(self, shot: Shot, ctx: StageContext) -> ShotStatus:
        if not shot.keyframe_path:
            shot.status = ShotStatus.failed
            return ShotStatus.failed
        out = ctx.path("drafts", f"{shot.id}.mp4")
        try:
            self.video.generate(
                image_path=shot.keyframe_path,
                motion_prompt=shot.motion_prompt_en or "subtle natural motion",
                out_path=out, seed=shot.seed or 0, num_frames=shot.num_frames or 81,
            )
        except Exception as e:  # noqa: BLE001
            log.error("预览生成失败 %s：%s", shot.id, e)
            shot.status = ShotStatus.failed
            return ShotStatus.failed
        shot.draft_clip_path = str(out)
        return ShotStatus.drafted
