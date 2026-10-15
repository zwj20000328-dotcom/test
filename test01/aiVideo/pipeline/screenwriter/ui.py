"""终端渲染层 —— 把所有 print/输入集中在此，与 engine 严格分离。

设计原则：
  - engine.py 不含任何 I/O，可用 mock 测试；cli.py 只负责渲染与采集输入。
  - **优雅降级**：有 rich 就用 rich 的表格/面板/进度；没有就退回纯 ANSI + input()。
    requirements-core.txt 含 rich，但不强依赖——脚本可能在最小环境跑。
  - Windows 控制台是 GBK，必须强制 UTF-8 输出，否则中文乱码或 UnicodeEncodeError。
"""
from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from typing import Any, Callable, Optional

# ---- UTF-8 输出（Windows GBK 控制台的必需修复）----
def _force_utf8() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")   # type: ignore[attr-defined]
        except Exception:  # noqa: BLE001
            pass


_force_utf8()

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.table import Table
    from rich.text import Text
    _console = Console()
    HAS_RICH = True
except ImportError:      # pragma: no cover - 降级路径
    _console = None
    HAS_RICH = False


# --------------------------------------------------------------------------- #
# ANSI 颜色（无 rich 时用；非 tty 时全部关闭）
# --------------------------------------------------------------------------- #

class C:
    _on = sys.stdout.isatty() and os.environ.get("NO_COLOR") is None

    RESET = "\033[0m" if _on else ""
    BOLD = "\033[1m" if _on else ""
    DIM = "\033[2m" if _on else ""
    RED = "\033[31m" if _on else ""
    GREEN = "\033[32m" if _on else ""
    YELLOW = "\033[33m" if _on else ""
    BLUE = "\033[34m" if _on else ""
    MAGENTA = "\033[35m" if _on else ""
    CYAN = "\033[36m" if _on else ""


# --------------------------------------------------------------------------- #
# 基础输出
# --------------------------------------------------------------------------- #


def echo(text: str = "") -> None:
    if HAS_RICH:
        _console.print(text)
    else:
        print(text)


def title(text: str) -> None:
    if HAS_RICH:
        _console.print(f"\n[bold cyan]{text}[/bold cyan]")
    else:
        print(f"\n{C.BOLD}{C.CYAN}{text}{C.RESET}")


def heading(text: str) -> None:
    if HAS_RICH:
        _console.print(f"[bold]{text}[/bold]")
    else:
        print(f"{C.BOLD}{text}{C.RESET}")


def dim(text: str) -> None:
    if HAS_RICH:
        _console.print(f"[dim]{text}[/dim]")
    else:
        print(f"{C.DIM}{text}{C.RESET}")


def success(text: str) -> None:
    if HAS_RICH:
        _console.print(f"[green]✓[/green] {text}")
    else:
        print(f"{C.GREEN}✓{C.RESET} {text}")


def warn(text: str) -> None:
    if HAS_RICH:
        _console.print(f"[yellow]![/yellow] {text}")
    else:
        print(f"{C.YELLOW}!{C.RESET} {text}")


def error(text: str) -> None:
    if HAS_RICH:
        _console.print(f"[red]✗[/red] {text}")
    else:
        print(f"{C.RED}✗{C.RESET} {text}", file=sys.stderr)


def rule(char: str = "─", width: int = 68) -> None:
    if HAS_RICH:
        _console.rule(characters=char)
    else:
        print(char * width)


def panel(text: str, title_: str = "", border: str = "cyan") -> None:
    if HAS_RICH:
        _console.print(Panel(text, title=title_ or None, border_style=border,
                             expand=False))
    else:
        lines = text.splitlines() or [""]
        # 宽度按显示宽度算（中文占 2 列），标题与内容统一用 _vislen
        w = max([_vislen(title_) + 2] + [_vislen(l) for l in lines] + [8])
        w = min(w, 76)
        print("┌" + "─" * w + "┐")
        if title_:
            pad = w - _vislen(title_) - 1
            print(f"│ {C.BOLD}{title_}{C.RESET}" + " " * max(0, pad) + "│")
            print("├" + "─" * w + "┤")
        for line in lines:
            pad = w - _vislen(line) - 1
            print("│ " + line + " " * max(0, pad) + "│")
        print("└" + "─" * w + "┘")


def table(headers: list[str], rows: list[list[str]], title_: str = "") -> None:
    if HAS_RICH:
        t = Table(title=title_ or None, show_lines=False, pad_edge=False)
        for h in headers:
            t.add_column(h)
        for r in rows:
            t.add_row(*[str(x) for x in r])
        _console.print(t)
    else:
        if title_:
            heading(title_)
        # 每列宽度 = 表头与所有单元格的最大显示宽度（中文按 2 列）
        widths = []
        for i, h in enumerate(headers):
            cells = [_vislen(str(r[i])) for r in rows if i < len(r)]
            widths.append(max(_vislen(str(h)), *cells) if cells else _vislen(str(h)))

        def fmt_row(cells, sep="│"):
            out = ""
            for i, cell in enumerate(cells):
                pad = widths[i] - _vislen(str(cell))
                out += str(cell) + " " * max(0, pad)
                if i < len(cells) - 1:
                    out += sep
            return out

        print(fmt_row(headers))
        print("─" * (sum(widths) + len(widths) - 1))
        for r in rows:
            # 补齐缺列，避免 IndexError
            cells = [str(r[i]) if i < len(r) else "" for i in range(len(headers))]
            print(fmt_row(cells))


def _vislen(s: str) -> int:
    """可见长度：中文字符占 2 列（用于无 rich 时的对齐）。"""
    import unicodedata
    return sum(2 if unicodedata.east_asian_width(ch) in "WF" else 1 for ch in s)


# --------------------------------------------------------------------------- #
# 输入
# --------------------------------------------------------------------------- #


class Interrupted(Exception):
    """用户 Ctrl-C / EOF。"""


def ask(prompt: str, default: Optional[str] = None,
        validate: Optional[Callable[[str], bool]] = None,
        hint: str = "") -> str:
    """单行输入，支持默认值、校验重试、EOF/Ctrl-C 转 Interrupted。"""
    suffix = f" [{default}]" if default else ""
    while True:
        try:
            if HAS_RICH:
                raw = _console.input(f"[bold]{prompt}[/bold]{suffix}{hint} ")
            else:
                raw = input(f"{C.BOLD}{prompt}{C.RESET}{suffix}{hint} ")
        except EOFError:
            raise Interrupted("输入结束（EOF）")
        except KeyboardInterrupt:
            print()
            raise Interrupted("用户中断（Ctrl-C）")
        val = raw.strip()
        if not val and default is not None:
            return default
        if not val:
            warn("不能为空，请重新输入。")
            continue
        if validate and not validate(val):
            warn("输入不合法，请重新输入。")
            continue
        return val


def ask_multiline(prompt: str, end_marker: str = "EOF") -> str:
    """多行输入（故事简介用），以单独一行 end_marker 结束。"""
    echo(f"{C.BOLD}{prompt}{C.RESET}")
    dim(f"（可多行，输入单独一行 {end_marker} 结束）")
    lines = []
    while True:
        try:
            line = input()
        except EOFError:
            break
        except KeyboardInterrupt:
            print()
            raise Interrupted("用户中断（Ctrl-C）")
        if line.strip() == end_marker:
            break
        lines.append(line)
    return "\n".join(lines).strip()


def confirm(prompt: str, default: bool = False) -> bool:
    """y/N 确认。破坏性操作必须先 confirm。"""
    suffix = " [Y/n] " if default else " [y/N] "
    while True:
        try:
            raw = input(f"{C.BOLD}{prompt}{C.RESET}{suffix}")
        except EOFError:
            return default
        except KeyboardInterrupt:
            print()
            raise Interrupted("用户中断（Ctrl-C）")
        v = raw.strip().lower()
        if not v:
            return default
        if v in ("y", "yes", "是"):
            return True
        if v in ("n", "no", "否"):
            return False
        warn("请输入 y 或 n。")


def choose(prompt: str, n: int, allow_empty: bool = False) -> Optional[int]:
    """从 1..n 选一个，返回 0-based 索引；allow_empty 时可回车跳过。"""
    while True:
        try:
            raw = input(f"{C.BOLD}{prompt}{C.RESET} [1-{n}] ")
        except EOFError:
            raise Interrupted("输入结束（EOF）")
        except KeyboardInterrupt:
            print()
            raise Interrupted("用户中断（Ctrl-C）")
        v = raw.strip()
        if not v and allow_empty:
            return None
        if v.isdigit() and 1 <= int(v) <= n:
            return int(v) - 1
        warn(f"请输入 1-{n} 之间的数字。")


# --------------------------------------------------------------------------- #
# 进度
# --------------------------------------------------------------------------- #


@dataclass
class Progress:
    """轻量进度显示（rich 用 status/progress，否则单行刷新）。"""
    label: str = ""
    total: int = 0
    done: int = 0

    def start(self, label: str = "") -> None:
        self.label = label or self.label
        if HAS_RICH:
            self._status = _console.status(f"[cyan]{self.label}[/cyan]", spinner="dots")
            self._status.start()
        else:
            print(f"{C.CYAN}{self.label}{C.RESET} ...", end="", flush=True)

    def update(self, done: int, total: Optional[int] = None, label: str = "") -> None:
        self.done = done
        if total is not None:
            self.total = total
        if label:
            self.label = label
        if not HAS_RICH:
            pct = f" {done}/{self.total}" if self.total else ""
            print(f"\r{C.CYAN}{self.label}{pct}{C.RESET}   ", end="", flush=True)

    def stop(self) -> None:
        if HAS_RICH:
            try:
                self._status.stop()
            except Exception:  # noqa: BLE001
                pass
        else:
            print()

    # 上下文管理器：with ui.Progress("...") as p: ...
    # 保证异常/KeyboardInterrupt 时也 stop()，否则 spinner 会卡在终端。
    def __enter__(self) -> "Progress":
        self.start()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.stop()


def progress_bar(done: int, total: int, width: int = 24) -> str:
    """纯文本进度条（用于集进度、无 rich 时的场景进度）。"""
    if total <= 0:
        return ""
    filled = int(width * done / total)
    return "█" * filled + "░" * (width - filled) + f" {done}/{total}"
