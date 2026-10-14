"""S9 分集装配 + S10 全剧拼接 —— 基于 ffmpeg，纯 CPU 阶段。

S9 (AssembleStage.run_episode)：把一集内每个镜头归一到统一渲染规格（分辨率/fps/字幕烧录/
    混音），再用 concat demuxer 无损拼成 epXX.mp4。
S10 (ConcatStage.run_concat)：把各集用 concat demuxer 不重编码拼成 full_drama.mp4。

所有 ffmpeg 命令由 pipeline/assemble.py 的纯函数构造；本模块负责按 manifest 组织输入、
执行命令、回填 episode_path / final_path。dry_run 时只构造不执行（可在无 ffmpeg 的机器上验证）。
"""
from __future__ import annotations

import logging
from pathlib import Path

from ..assemble import (
    RenderSpec,
    concat_drama_cmd,
    concat_episode_cmd,
    mix_episode_audio_cmd,
    normalize_shot_cmd,
    run_cmd,
)
from ..contracts import Episode, Manifest, Shot, ShotStatus
from ..orchestrator import StageContext

log = logging.getLogger("stages.assemble")


class AssembleStage:
    """S9：per-shot 归一 + per-episode 拼接。"""
    name = "assemble"
    consumes = (ShotStatus.subtitled,)
    produces = ShotStatus.assembled

    def __init__(self, spec: RenderSpec | None = None):
        self._spec = spec

    def _spec_for(self, ctx: StageContext) -> RenderSpec:
        if self._spec is not None:
            return self._spec
        ar = ctx.manifest.meta.aspect_ratio or "9:16"
        return RenderSpec.from_aspect(ar)

    # 编排器把 assemble 作为集级阶段调用
    def run_episode(self, ep: Episode, ctx: StageContext) -> str:
        spec = self._spec_for(ctx)
        shots = [sh for sc in ep.scenes for sh in sc.shots]
        if not shots:
            log.warning("第 %s 集无镜头，跳过装配。", ep.ep)
            return ""

        # 1) 逐镜归一
        norm_clips: list[str] = []
        for sh in shots:
            if not sh.clip_path:
                log.error("镜头 %s 缺 clip_path（视频未生成），无法装配。", sh.id)
                sh.status = ShotStatus.failed
                continue
            # 该镜头的对白音频（若 TTS 已按 shot 合成一条）
            audio = _shot_audio(sh)
            out = ctx.path("ep_norm", f"{sh.id}.mp4")
            cmd = normalize_shot_cmd(sh.clip_path, audio, sh.ass_path, str(out), spec)
            res = run_cmd(cmd, dry_run=ctx.dry_run)
            if not res.ok and not ctx.dry_run:
                log.error("归一 %s 失败：%s", sh.id, res.stderr[-300:])
                sh.status = ShotStatus.failed
                continue
            sh.status = ShotStatus.assembled
            norm_clips.append(str(out))

        # 2) 集级混音（对白+BGM+SFX）——若有整集 BGM
        bgm = _episode_bgm(ep)
        mix_wav = None
        if not ctx.dry_run and (bgm or any(_shot_audio(sh) for sh in shots)):
            mix_wav = str(ctx.path("episodes", f"ep{ep.ep:03d}_mix.wav"))
            dialogue = [a for sh in shots if (a := _shot_audio(sh))]
            cmd = mix_episode_audio_cmd(dialogue, bgm, [], mix_wav, spec)
            run_cmd(cmd, dry_run=ctx.dry_run)

        # 3) concat 无损拼接本集
        ep_out = ctx.path("episodes", f"ep{ep.ep:03d}.mp4")
        cmd, lst = concat_episode_cmd(norm_clips, str(ep_out), spec)
        listfile = ctx.path("episodes", f"ep{ep.ep:03d}_concat.txt")
        res = run_cmd(cmd, dry_run=ctx.dry_run, listfile=str(listfile), listfile_content=lst)
        if not res.ok and not ctx.dry_run:
            log.error("拼接第 %s 集失败：%s", ep.ep, res.stderr[-300:])
            return ""
        ep.episode_path = str(ep_out)
        log.info("第 %s 集装配完成 -> %s（%d 镜头）", ep.ep, ep_out, len(norm_clips))
        return str(ep_out)

    # 兼容 per-shot 协议（编排器若按 per-shot 调用则只做归一）
    def run_shot(self, shot: Shot, ctx: StageContext) -> ShotStatus:
        return ShotStatus.assembled


class ConcatStage:
    """S10：全剧拼接。"""
    name = "concat"

    def run_concat(self, manifest: Manifest, ctx: StageContext) -> str:
        eps = [ep.episode_path for ep in manifest.episodes if ep.episode_path]
        if not eps:
            log.error("没有任何已装配的分集，无法拼接全剧。")
            return ""
        out = ctx.path("out", "full_drama.mp4")
        cmd, lst = concat_drama_cmd(eps, str(out))
        listfile = ctx.path("out", "drama_concat.txt")
        res = run_cmd(cmd, dry_run=ctx.dry_run, listfile=str(listfile), listfile_content=lst)
        if not res.ok and not ctx.dry_run:
            log.error("全剧拼接失败：%s", res.stderr[-300:])
            return ""
        manifest.final_path = str(out)
        log.info("全剧拼接完成 -> %s（%d 集）", out, len(eps))
        return str(out)


def _shot_audio(sh: Shot) -> str | None:
    """返回该镜头的对白音频路径（若 TTS 合成为整镜一条则用 shot.audio_path；
    否则用第一条 line 的 audio_path 近似——真实实现应上游按镜合并）。"""
    if getattr(sh, "audio_path", None):
        return sh.audio_path
    for ln in sh.lines:
        if ln.audio_path:
            return ln.audio_path
    return None


def _episode_bgm(ep: Episode) -> str | None:
    """从集内镜头的 bgm_pick 取一条作为整集 BGM（简化：取第一个）。"""
    for sc in ep.scenes:
        for sh in sc.shots:
            if getattr(sh, "bgm_pick", None):
                return sh.bgm_pick
    return None
