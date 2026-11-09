# -*- coding: utf-8 -*-
"""从 workflow 输出 JSON 中抽取 survey markdown 与 trend，落盘。"""
import json, os, sys, glob

BASE = "d:/xiaojun/work/test/StoreAI/research/raw/web"
# 允许通过参数传入落盘后的 workflow 结果文件
src = sys.argv[1] if len(sys.argv) > 1 else None
if not src:
    cands = sorted(glob.glob(os.path.join(
        r"C:\Users\Xuuuuuun\AppData\Local\Temp\claude\d--xiaojun-work-test-StoreAI",
        "*", "tasks", "*.output")), key=os.path.getmtime, reverse=True)
    src = cands[0] if cands else None
print("source:", src)
raw = open(src, encoding="utf-8").read()
start = raw.find("{")
obj = None
for cut in range(len(raw), start, -2000):
    try:
        obj = json.loads(raw[start:cut])
        break
    except Exception:
        continue
if obj is None:
    raise SystemExit("parse failed")
res = obj.get("result", obj)
surveys = res.get("surveys", [])
print("surveys:", len(surveys))

KEYS = [
    "kv-offload-tiered", "kv-compression", "kv-disagg-sched", "kv-reuse-prefix",
    "vector-rag-storage", "training-data-fs", "checkpoint-recovery",
    "model-loading-serving", "memory-hierarchy-hw", "agent-memory",
    "network-transfer", "industrial-systems", "benchmarks-measurement",
    "chinese-academia", "frontier",
]
for i, s in enumerate(surveys):
    dim = s.get("dim", "unknown")
    md = s.get("markdown", "")
    key = KEYS[i] if i < len(KEYS) else f"extra-{i}"
    if not md:
        print("  EMPTY", dim); continue
    path = os.path.join(BASE, f"survey-{key}.md")
    with open(path, "w", encoding="utf-8") as f:
        f.write(md)
    print(f"  wrote {key}.md ({len(md)} chars) <- {dim[:40]}")
trend = res.get("trend", {})
if isinstance(trend, dict) and trend.get("markdown"):
    with open(os.path.join(BASE, "survey-trend.md"), "w", encoding="utf-8") as f:
        f.write(trend["markdown"])
    print("wrote trend", len(trend["markdown"]))
