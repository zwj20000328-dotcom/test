"""S8 BGM/SFX 阶段 —— 按 music_tag 选/生成整集背景乐。

策略（调研 §S8）：CLAP 先检索本地版权曲库 top-3；库覆盖薄时用 ACE-Step 生成定制床乐
（固定 motif/seed 跨集一致）。BGM 是**集级**资产（一集一条），不是每镜一条，
所以本 stage 提供 run_episode；per-shot 协议下退化为把集级 BGM 挂到该集首镜的 bgm_pick。
ducking 与混音在装配阶段做（assemble.mix_episode_audio_cmd）。
"""
from __future__ import annotations

import logging

from ..contracts import Episode, Manifest, Shot, ShotStatus
from ..orchestrator import StageContext

log = logging.getLogger("stages.bgm")


class BGMStage:
    name = "bgm"
    consumes = (ShotStatus.subtitled,)
    produces = ShotStatus.subtitled     # BGM 不改变镜头推进状态（字幕后仍可装配）

    def __init__(self, music_engine, prefer_library: bool = True):
        self.music = music_engine
        self.prefer_library = prefer_library

    def _tag_text(self, ep: Episode) -> str:
        tags = [sh.music_tag for sc in ep.scenes for sh in sc.shots if sh.music_tag]
        if not tags:
            return "dramatic cinematic background music"
        # 取本集主导情绪 + 平均强度
        emotions = [t.get("emotion", "") for t in tags if t.get("emotion")]
        dom = max(set(emotions), key=emotions.count) if emotions else "dramatic"
        inten = sum(t.get("intensity", 3) for t in tags) / len(tags)
        bpm = next((t["bpm"] for t in tags if t.get("bpm")), 90)
        return f"{dom} cinematic background music, intensity {inten:.1f}/5, {bpm} bpm, instrumental"

    def run_episode(self, ep: Episode, ctx: StageContext) -> str:
        tag_text = self._tag_text(ep)
        seconds = sum((sh.est_seconds or 5.0) for sc in ep.scenes for sh in sc.shots) or 8.0

        pick = None
        if self.prefer_library:
            hits = self.music.search_library(tag_text, top_k=3)
            if hits:
                pick = hits[0]["path"]
                log.info("第 %s 集 BGM 命中曲库：%s (score=%.3f)", ep.ep, pick, hits[0]["score"])
        if pick is None:
            out = ctx.path("music", f"ep{ep.ep:03d}_bgm.wav")
            try:
                self.music.generate(tag_text, out, seconds=min(seconds, 30.0),
                                    seed=1000 + ep.ep)   # 固定 seed 家族跨集一致
                pick = str(out)
            except Exception as e:  # noqa: BLE001
                log.error("第 %s 集 BGM 生成失败：%s", ep.ep, e)
                return ""

        # 挂到该集所有镜头（装配时取集内第一个 bgm_pick 作整集 BGM）
        for sc in ep.scenes:
            for sh in sc.shots:
                sh.bgm_pick = pick
        return pick

    # per-shot 协议兜底：把镜头所属集的 BGM 挂上（真实编排在集级调用 run_episode）
    def run_shot(self, shot: Shot, ctx: StageContext) -> ShotStatus:
        return ShotStatus.subtitled
