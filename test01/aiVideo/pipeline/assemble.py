"""装配阶段 (S9 分集装配 + S10 全剧拼接) —— 模型无关，基于 ffmpeg。

短剧装配的硬约束（来自调研 top-risk #9）：**concat demuxer 无损拼接要求所有分集的
codec / 分辨率 / fps / SAR / timebase 完全一致**，否则报错或花屏。因此 S9 先把每个
镜头归一到统一渲染规格，再拼接；S10 用 concat demuxer 不重编码地合并各集。

统一渲染规格（可配）：
  视频 1080×1920 (9:16)，30fps，H.264 High，yuv420p，SAR 1:1
  音频 48kHz，AAC 192k，立体声
  字幕 ASS 硬烧（libass，短剧大字幕样式）
  混音 对白 + BGM(自动 ducking) + SFX，loudnorm 到 -16 LUFS

本模块**只生成并（可选）执行 ffmpeg 命令**；命令构造是纯函数，可在无 ffmpeg 的机器上单测。
"""
from __future__ import annotations

import shlex
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# --------------------------------------------------------------------------- #
# 渲染规格
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class RenderSpec:
    width: int = 1080
    height: int = 1920
    fps: int = 30
    vcodec: str = "libx264"
    profile: str = "high"
    pix_fmt: str = "yuv420p"
    crf: int = 18
    acodec: str = "aac"
    abitrate: str = "192k"
    arate: int = 48000
    channels: int = 2
    target_lufs: float = -16.0

    @classmethod
    def from_aspect(cls, aspect_ratio: str = "9:16", height: int = 1920) -> "RenderSpec":
        """根据画幅比例推导分辨率。9:16 -> 1080x1920；16:9 -> 1920x1080；1:1 -> 1080x1080。"""
        ar = (aspect_ratio or "9:16").strip().strip('"')
        try:
            a, b = ar.split(":")
            ratio = float(a) / float(b)
        except Exception:
            ratio = 9 / 16
        if ratio < 1:            # 竖屏
            h = height
            w = int(round(h * ratio / 2) * 2)   # 偶数
        elif ratio > 1:          # 横屏
            w = height
            h = int(round(w / ratio / 2) * 2)
        else:
            w = h = int(round(height * 0.5625 / 2) * 2) or 1080
            w = h = 1080
        return cls(width=w, height=h)


# --------------------------------------------------------------------------- #
# 命令构造（纯函数，可单测）
# --------------------------------------------------------------------------- #


def normalize_shot_cmd(
    clip: str,
    audio: Optional[str],
    ass: Optional[str],
    out: str,
    spec: RenderSpec = RenderSpec(),
) -> list[str]:
    """把单个镜头视频归一到统一规格：缩放/pad 到目标分辨率、统一 fps、硬烧字幕、混音。

    - 视频：scale 保持比例 + pad 黑边到 spec.width×spec.height，setsar=1，fps 归一。
    - 字幕：若给 ASS，用 subtitles 滤镜硬烧（要求 ffmpeg 启用 libass）。
    - 音频：若有对白音频则混入；最终 loudnorm 到 target_lufs。
    """
    vf = [
        f"scale={spec.width}:{spec.height}:force_original_aspect_ratio=decrease",
        f"pad={spec.width}:{spec.height}:(ow-iw)/2:(oh-ih)/2:color=black",
        "setsar=1",
        f"fps={spec.fps}",
        "format=" + spec.pix_fmt,
    ]
    if ass:
        # subtitles 滤镜路径需转义（Windows/特殊字符）；这里用 posix 风格，服务器为 Linux
        vf.append(f"subtitles={_escape_filter_path(ass)}")

    # ffmpeg 位置敏感：先声明**所有输入**，再声明所有选项，最后输出。
    # 否则 -c:v/-crf 等会被当作其后 -i 的输入选项而误用。
    cmd = ["ffmpeg", "-y", "-i", clip]
    if audio:
        cmd += ["-i", audio]          # input 1 = 对白
        audio_map = "1:a:0"
    else:
        # input 1 = 静音源，保证 concat 时每个镜头都有音轨
        cmd += ["-f", "lavfi", "-i", f"anullsrc=r={spec.arate}:cl=stereo"]
        audio_map = "1:a:0"

    af = [
        f"loudnorm=I={spec.target_lufs}:TP=-1.5:LRA=11",
        f"aresample={spec.arate}",
    ]

    cmd += ["-vf", ",".join(vf)]
    cmd += ["-map", "0:v:0", "-map", audio_map]
    cmd += ["-c:v", spec.vcodec, "-profile:v", spec.profile, "-crf", str(spec.crf),
            "-pix_fmt", spec.pix_fmt, "-r", str(spec.fps)]
    cmd += ["-af", ",".join(af),
            "-c:a", spec.acodec, "-b:a", spec.abitrate, "-ar", str(spec.arate),
            "-ac", str(spec.channels)]
    if not audio:
        cmd += ["-shortest"]          # 静音源无限长，用视频长度截断
    cmd += ["-movflags", "+faststart", out]
    return cmd


def concat_episode_cmd(shot_clips: list[str], out: str, spec: RenderSpec = RenderSpec()) -> tuple[list[str], str]:
    """拼接一集内所有归一后的镜头。返回 (ffmpeg命令, 临时 list 文件内容)。

    因所有镜头已归一到同一规格，可用 concat demuxer 无损拼接（-c copy）。
    """
    lines = ["ffconcat version 1.0"]
    for c in shot_clips:
        lines.append(f"file {shlex.quote(c)}")
    list_content = "\n".join(lines) + "\n"
    cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", "<LISTFILE>",
           "-c", "copy", "-movflags", "+faststart", out]
    return cmd, list_content


def mix_episode_audio_cmd(
    dialogue: list[str],
    bgm: Optional[str],
    sfx: list[str],
    out_wav: str,
    spec: RenderSpec = RenderSpec(),
    bgm_gain_db: float = -20.0,
) -> list[str]:
    """把一集的对白/BGM/SFX 混成一条音轨，BGM 自动 ducking（sidechaincompress）。

    dialogue: 多条对白 wav（已带时间戳则上游会 adelay 对齐；这里按顺序拼接由调用方负责）。
    bgm_gain_db: BGM 基础增益（短剧对白下 BGM 约 -20~-24 dB）。
    """
    cmd = ["ffmpeg", "-y"]
    inputs = []
    for d in dialogue:
        cmd += ["-i", d]
        inputs.append(("d", len(inputs)))
    bgm_idx = None
    if bgm:
        cmd += ["-i", bgm]
        bgm_idx = len(inputs)
        inputs.append(("b", bgm_idx))
    sfx_start = len(inputs)
    for s in sfx:
        cmd += ["-i", s]
        inputs.append(("s", len(inputs)))

    # 构造 filter_complex：对白求和 -> [dial]; BGM 降增益并被对白 sidechain 压缩 -> [bgm]
    fc = []
    dial_labels = [f"[{i}:a]" for (t, i) in inputs if t == "d"]
    if dial_labels:
        fc.append("".join(dial_labels) + f"amix=inputs={len(dial_labels)}:normalize=0[dial]")
    if bgm_idx is not None:
        fc.append(f"[{bgm_idx}:a]volume={bgm_gain_db}dB[bgmlow]")
        if dial_labels:
            fc.append("[bgmlow][dial]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=300[bgm]")
        else:
            fc.append("[bgmlow]anull[bgm]")
    sfx_labels = [f"[{i}:a]" for (t, i) in inputs if t == "s"]
    mix_inputs = []
    if dial_labels:
        mix_inputs.append("[dial]")
    if bgm_idx is not None:
        mix_inputs.append("[bgm]")
    mix_inputs += sfx_labels
    n = len(mix_inputs)
    fc.append("".join(mix_inputs) + f"amix=inputs={n}:normalize=0,"
              f"loudnorm=I={spec.target_lufs}:TP=-1.5:LRA=11,"
              f"aresample={spec.arate}[outa]")

    cmd += ["-filter_complex", ";".join(fc), "-map", "[outa]",
            "-c:a", "pcm_s16le", "-ar", str(spec.arate), "-ac", str(spec.channels), out_wav]
    return cmd


def concat_drama_cmd(episode_paths: list[str], out: str) -> tuple[list[str], str]:
    """S10：全剧拼接。各集已同规格，concat demuxer 不重编码。返回 (命令, list文件内容)。"""
    lines = ["ffconcat version 1.0"]
    for e in episode_paths:
        lines.append(f"file {shlex.quote(e)}")
    list_content = "\n".join(lines) + "\n"
    cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", "<LISTFILE>",
           "-c", "copy", "-movflags", "+faststart", out]
    return cmd, list_content


def _escape_filter_path(p: str) -> str:
    """转义 ffmpeg filter 里的路径（: \\ ' 等）。"""
    p = p.replace("\\", "/")
    for ch in ("\\", ":", "'"):
        p = p.replace(ch, "\\" + ch)
    return p


# --------------------------------------------------------------------------- #
# 执行封装（服务器上用；本地无 ffmpeg 时只构造命令）
# --------------------------------------------------------------------------- #


@dataclass
class AssembleResult:
    ok: bool
    cmd: list[str]
    stdout: str = ""
    stderr: str = ""
    returncode: int = 0


class FFmpegMissingError(RuntimeError):
    """ffmpeg 不可用（未安装或不在 PATH）。

    这是**环境问题**，不是数据问题：必须让装配阶段一次性失败退出，
    而不是把成千上万个镜头逐个标记为 failed —— 后者会污染 manifest 状态，
    且 failed 不在任何阶段的 consumes 里，装好 ffmpeg 后重跑也无法自动恢复。
    """


def run_cmd(cmd: list[str], dry_run: bool = False, listfile: Optional[str] = None,
            listfile_content: Optional[str] = None) -> AssembleResult:
    """执行 ffmpeg 命令。若命令含 <LISTFILE> 占位，先写出临时 list 文件再替换。

    ffmpeg 缺失时抛 FFmpegMissingError（不返回 ok=False），以便调用方区分
    "环境未就绪" 与 "这条命令本身失败"。
    """
    real = list(cmd)
    tmp_list = None
    if listfile_content is not None:
        tmp_list = listfile or (str(Path(real[-1]).with_suffix(".txt")) if real else "concat.txt")
        Path(tmp_list).parent.mkdir(parents=True, exist_ok=True)
        Path(tmp_list).write_text(listfile_content, encoding="utf-8")
        real = [tmp_list if x == "<LISTFILE>" else x for x in real]
    if dry_run:
        return AssembleResult(True, real, stdout="[dry-run]")
    try:
        proc = subprocess.run(real, capture_output=True, text=True)
        return AssembleResult(proc.returncode == 0, real, proc.stdout, proc.stderr, proc.returncode)
    except FileNotFoundError:
        raise FFmpegMissingError(
            "ffmpeg 未安装或不在 PATH。装配阶段需要 ffmpeg（且启用 libass 以烧录字幕）。\n"
            "  Linux 部署机：conda install -c conda-forge ffmpeg\n"
            "  或见 scripts/install_env.sh\n"
            "提示：只想验证控制流而不实际渲染，请加 --dry-run。"
        )


if __name__ == "__main__":
    # 自测：构造规格 + 各类命令，验证字符串正确
    import json
    spec = RenderSpec.from_aspect("9:16")
    print("spec 9:16 ->", spec.width, "x", spec.height, "@", spec.fps)
    print("spec 16:9 ->", (lambda s: (s.width, s.height))(RenderSpec.from_aspect("16:9")))
    print()
    print("normalize:", " ".join(normalize_shot_cmd("clips/s1_sh1.mp4", "voices/s1_sh1.wav",
          "subs/ep01.ass", "ep_norm/s1_sh1.mp4", spec)))
    print()
    cmd, lst = concat_episode_cmd(["ep_norm/a.mp4", "ep_norm/b.mp4"], "episodes/ep01.mp4", spec)
    print("concat ep cmd:", " ".join(cmd))
    print("concat ep list:\n" + lst)
    print("mix:", " ".join(mix_episode_audio_cmd(["v1.wav", "v2.wav"], "bgm/ep01.wav",
          ["sfx/whoosh.wav"], "episodes/ep01_mix.wav", spec)))
    print()
    dcmd, dlst = concat_drama_cmd(["episodes/ep01.mp4", "episodes/ep02.mp4"], "out/full_drama.mp4")
    print("drama concat:", " ".join(dcmd))
    print("drama list:\n" + dlst)
