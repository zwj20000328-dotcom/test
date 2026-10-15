"""scriptwriter.py —— 互动式剧本生成入口（阶段 A）。

    python scriptwriter.py new --title 剧名           # 新建会话，互动创作
    python scriptwriter.py resume <slug>              # 恢复会话
    python scriptwriter.py list                       # 列出所有会话
    python scriptwriter.py batch --synopsis f.txt …   # 无人值守批量

产出的 sessions/<name>/screenplay.md 直接喂给阶段 B：
    python run.py sessions/<name>/screenplay.md --project <name>

引擎走 pipeline/engines/factory.py 的 llm（vLLM / Qwen3-32B-AWQ）。
本机无 vLLM 时用 --stub 跑通控制流（占位引擎，产出格式合法但内容为模板）。
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path
from typing import Optional

from pipeline.screenwriter import ui
from pipeline.screenwriter.cli import SessionState, resume_session_state
from pipeline.screenwriter.engine import ScreenwriterEngine
from pipeline.screenwriter.models import InvolvementLevel
from pipeline.screenwriter.session import SessionStore

log = logging.getLogger("scriptwriter")


def _build_llm(stub: bool, base_url: Optional[str] = None):
    """构造 LLM 引擎。stub=True 时用剧本创作专用占位引擎（本机验证控制流）。"""
    if stub:
        from pipeline.screenwriter.stub_llm import StubScreenwriterLLM
        return StubScreenwriterLLM()
    from pipeline.engines.factory import build_engines
    engines = build_engines(only=["llm"])
    llm = engines.get("llm")
    if llm is None:
        ui.error("无法连接 vLLM。请先 bash scripts/start_services.sh 起服务，"
                 "或设 AIVIDEO_LLM_BASE_URL；本机验证请加 --stub。")
        raise SystemExit(2)
    return llm


def _now() -> str:
    from datetime import datetime
    return datetime.now().isoformat(timespec="seconds")


# --------------------------------------------------------------------------- #
# 子命令
# --------------------------------------------------------------------------- #


def cmd_new(args) -> int:
    store = SessionStore(args.sessions_dir)
    if store.exists(args.title or "untitled"):
        ui.warn(f"会话 '{args.title or 'untitled'}' 已存在，改用 resume 或换名字。")
        return 2
    synopsis = ""
    if args.synopsis:
        p = Path(args.synopsis)
        synopsis = p.read_text(encoding="utf-8") if p.exists() else args.synopsis

    llm = _build_llm(args.stub)
    engine = ScreenwriterEngine(llm)
    name = args.title or "untitled"
    sess = store.create(name, synopsis=synopsis, now=_now())
    st = SessionState(store=store, engine=engine, session=sess, now=_now)

    ui.title(f"AI 短剧互动式剧本创作 · {name}")
    ui.dim(f"会话目录：{store.paths(name).root}")
    try:
        st.run_new(title=args.title or "", synopsis=synopsis,
                   episodes=args.episodes, episode_seconds=args.episode_seconds,
                   involvement=args.involvement)
    except ui.Interrupted as e:
        ui.warn(f"已中断：{e}")
        st.save()
        ui.echo(f"进度已保存。恢复：python scriptwriter.py resume {name}")
        return 130
    except KeyboardInterrupt:
        st.save()
        ui.echo(f"\n进度已保存。恢复：python scriptwriter.py resume {name}")
        return 130

    _finish(st, args)
    return 0


def cmd_resume(args) -> int:
    store = SessionStore(args.sessions_dir)
    if not store.exists(args.name):
        ui.error(f"会话 '{args.name}' 不存在。用 list 查看，或 new 新建。")
        return 2
    llm = _build_llm(args.stub)
    st = resume_session_state(args.name, base=args.sessions_dir, llm=llm, now=_now)
    s = st.session
    ui.title(f"恢复会话 · {s.canon.title or s.name}")
    ui.dim(f"进度：{len(s.completed_eps)}/{s.total_episodes} 集｜分支：{s.branch_id}")

    if s.is_complete():
        ui.success("剧本已完成。可直接交付。")
        _finish(st, args)
        return 0

    try:
        st._episode_loop()
    except ui.Interrupted as e:
        ui.warn(f"已中断：{e}")
        st.save()
        return 130
    except KeyboardInterrupt:
        st.save()
        ui.echo("\n进度已保存。")
        return 130

    _finish(st, args)
    return 0


def cmd_list(args) -> int:
    store = SessionStore(args.sessions_dir)
    sessions = store.list_sessions()
    if not sessions:
        ui.dim(f"暂无会话（{args.sessions_dir}/）。用 new 新建。")
        return 0
    rows = []
    for s in sessions:
        if s.get("error"):
            rows.append([s["name"], "(损坏)", s["error"][:30], "", ""])
            continue
        rows.append([s["name"], s.get("title", "")[:16], s.get("episodes", ""),
                     s.get("branch", ""), "已交付" if s.get("delivered") else "进行中"])
    ui.table(["会话", "剧名", "进度", "分支", "状态"], rows, title_="剧本会话")
    return 0


def cmd_batch(args) -> int:
    """无人值守批量：自动选走向，一口气生成全剧。"""
    store = SessionStore(args.sessions_dir)
    p = Path(args.synopsis)
    synopsis = p.read_text(encoding="utf-8") if p.exists() else args.synopsis
    if not synopsis.strip():
        ui.error(" synopsis 为空")
        return 2

    llm = _build_llm(args.stub)
    engine = ScreenwriterEngine(llm)
    name = args.out or "batch_drama"
    if store.exists(name):
        ui.warn(f"会话 '{name}' 已存在，换个 --out 名字。")
        return 2
    sess = store.create(name, synopsis=synopsis, now=_now())
    sess.auto_policy = args.policy
    st = SessionState(store=store, engine=engine, session=sess, now=_now,
                      noninteractive=True)

    ui.title(f"批量生成 · {name}（policy={args.policy}）")
    try:
        sess.involvement = InvolvementLevel.autopilot
        st.run_new(title=args.title or name, synopsis=synopsis,
                   episodes=args.episodes, episode_seconds=args.episode_seconds,
                   involvement=3)
    except ui.Interrupted as e:
        ui.error(f"批量生成中断：{e}")
        return 1

    md_path = st.export()
    ui.success(f"批量生成完成 -> {md_path}")
    if args.render:
        ui.echo(f"启动渲染：python run.py {md_path} --project {name}")
    return 0


def _finish(st: SessionState, args) -> None:
    """创作完成后的收尾：导出 + 提示渲染。"""
    s = st.session
    if not s.is_complete():
        ui.warn(f"尚未完成（{len(s.completed_eps)}/{s.total_episodes} 集）。")
        return
    path = st.export()
    ui.rule()
    ui.success(f"剧本已导出 -> {path}")
    ui.echo("\n下一步：渲染成片")
    ui.echo(f"  python run.py {path} --project {s.name}")
    ui.dim("  或先 python -m pipeline.validate " + str(path) + " 复核")


# --------------------------------------------------------------------------- #
# 参数解析
# --------------------------------------------------------------------------- #


def build_parser() -> argparse.ArgumentParser:
    # 共享选项要能在子命令**前后**都出现。argparse 的坑：若顶层与子命令都定义同一
    # 选项且都带默认值，`scriptwriter.py --stub new` 里子命令的默认值会覆盖顶层已解析值。
    # 解法：顶层用真默认值，子命令级用 SUPPRESS —— 缺省时不写属性，顶层值得以保留；
    # 子命令后显式给了才覆盖。
    common_top = argparse.ArgumentParser(add_help=False)
    common_top.add_argument("--sessions-dir", default="sessions", help="会话根目录")
    common_top.add_argument("--stub", action="store_true",
                            help="用占位引擎（本机无 vLLM 时验证控制流）")
    common_top.add_argument("-v", "--verbose", action="store_true")

    S = argparse.SUPPRESS
    common_sub = argparse.ArgumentParser(add_help=False)
    common_sub.add_argument("--sessions-dir", default=S)
    common_sub.add_argument("--stub", action="store_true", default=S)
    common_sub.add_argument("-v", "--verbose", action="store_true", default=S)

    ap = argparse.ArgumentParser(
        prog="scriptwriter.py",
        description="AI 短剧互动式剧本生成（阶段 A）",
        parents=[common_top])
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_new = sub.add_parser("new", help="新建互动会话", parents=[common_sub])
    p_new.add_argument("--title", help="剧名")
    p_new.add_argument("--synopsis", help="故事简介（文本或文件路径）")
    p_new.add_argument("--episodes", type=int, help="集数（20-50，不给则模型建议）")
    p_new.add_argument("--episode-seconds", type=float, dest="episode_seconds",
                       help="每集秒数（240-300，不给则模型建议）")
    p_new.add_argument("--involvement", type=int, choices=[1, 2, 3],
                       help="介入粒度：1 major / 2 每集 / 3 autopilot")
    p_new.set_defaults(func=cmd_new)

    p_res = sub.add_parser("resume", help="恢复已有会话", parents=[common_sub])
    p_res.add_argument("name")
    p_res.set_defaults(func=cmd_resume)

    p_list = sub.add_parser("list", help="列出所有会话", parents=[common_sub])
    p_list.set_defaults(func=cmd_list)

    p_batch = sub.add_parser("batch", help="无人值守批量生成", parents=[common_sub])
    p_batch.add_argument("--synopsis", required=True, help="故事简介（文本或文件路径）")
    p_batch.add_argument("--title", help="剧名")
    p_batch.add_argument("--episodes", type=int, default=30)
    p_batch.add_argument("--episode-seconds", type=float, dest="episode_seconds", default=270)
    p_batch.add_argument("--policy", choices=["max-tension", "safest", "sweet"],
                         default="max-tension", help="自动选走向策略")
    p_batch.add_argument("--out", help="输出会话名")
    p_batch.add_argument("--render", action="store_true", help="完成后打印渲染命令")
    p_batch.set_defaults(func=cmd_batch)

    return ap


def main(argv: Optional[list[str]] = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    ap = build_parser()
    args = ap.parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s", datefmt="%H:%M:%S")
    if args.verbose:
        logging.getLogger("screenwriter").setLevel(logging.DEBUG)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
