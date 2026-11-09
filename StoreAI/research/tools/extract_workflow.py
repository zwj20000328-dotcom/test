# -*- coding: utf-8 -*-
import json, os

SRC = r"C:\Users\Xuuuuuun\AppData\Local\Temp\claude\d--xiaojun-work-test-StoreAI\91bbf890-fa61-4cfc-92ee-20131f948ac3\tasks\wm9p0g7w6.output"
OUT = r"d:/xiaojun/work/test/StoreAI/research/raw"

raw = open(SRC, "r", encoding="utf-8").read()
# 文件可能被截断或包含前缀；找到第一个 '{' 并尝试解析
start = raw.find("{")
obj = None
for cut in range(len(raw), start, -2000):
    try:
        obj = json.loads(raw[start:cut])
        break
    except Exception:
        continue
if obj is None:
    raise SystemExit("cannot parse")

for a in obj.get("analyses", []):
    content = a.get("summary", "")
    path = a.get("path", "")
    if content.lstrip().startswith("#") and path:
        fn = os.path.join(OUT, os.path.basename(path))
        with open(fn, "w", encoding="utf-8") as f:
            f.write(content)
        print("wrote", fn, len(content), "chars")
    else:
        print("skip", os.path.basename(path), "summary len", len(content))
