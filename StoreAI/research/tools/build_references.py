# -*- coding: utf-8 -*-
"""生成完整文献表（05a）与统计。"""
import glob, json, os, re
from collections import Counter

BASE = "d:/xiaojun/work/test/StoreAI/research/raw/web"
ROOT = "d:/xiaojun/work/test/StoreAI/research"
recs = json.load(open(os.path.join(BASE, "arxiv_raw.json"), encoding="utf-8"))
by_id = {}
for r in recs:
    by_id.setdefault(r["id"].split("v")[0], r)

pat = re.compile(r"arXiv[:\s]*(\d{4}\.\d{4,5})(?:v(\d+))?", re.I)
cited = set()
for f in glob.glob(os.path.join(BASE, "survey-*.md")):
    for m in pat.finditer(open(f, encoding="utf-8").read()):
        cited.add(m.group(1))

rows, missing = [], []
for aid in cited:
    r = by_id.get(aid)
    if not r:
        missing.append(aid); continue
    rows.append(r)

rows.sort(key=lambda x: x["published"], reverse=True)
years = Counter(r["published"][:4] for r in rows)

lines = [
    "# 05a · 完整文献表（按发布日期倒序）\n",
    f"> 共 **{len(rows)}** 篇被 15 篇综述引用的 arXiv 论文；缺失 **{len(missing)}** 篇。",
    f"> 年份分布：" + " / ".join(f"{y}: {years[y]}" for y in sorted(years, reverse=True)),
    "> 说明：arXiv 元数据不含会议录用信息；表中「日期」为首版提交日期。\n",
    "| # | arXiv | 标题 | 日期 | 第一作者 |",
    "|---:|---|---|---|---|",
]
for i, r in enumerate(rows, 1):
    title = r["title"].replace("|", "\\|")
    author = (r["authors"][0] if r["authors"] else "").replace("|", "\\|")
    lines.append(f"| {i} | [{r['id'].split('v')[0]}](https://arxiv.org/abs/{r['id'].split('v')[0]}) | {title} | {r['published'][:10]} | {author} |")

open(os.path.join(ROOT, "05a-完整文献表.md"), "w", encoding="utf-8").write("\n".join(lines))
print("rows", len(rows), "missing", missing)
print("years", dict(years))
