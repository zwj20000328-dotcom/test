# -*- coding: utf-8 -*-
"""核验综述中引用的 arXiv ID 是否真实存在于本次检索结果，并生成参考文献表。"""
import glob, json, os, re, sys

BASE = "d:/xiaojun/work/test/StoreAI/research/raw/web"
RAW = os.path.join(BASE, "arxiv_raw.json")

recs = json.load(open(RAW, encoding="utf-8"))
by_id = {}
for r in recs:
    base_id = r["id"].split("v")[0]
    by_id.setdefault(base_id, r)

pattern = re.compile(r"arXiv[:\s]*(\d{4}\.\d{4,5})(?:v(\d+))?", re.I)

files = sorted(glob.glob(os.path.join(BASE, "survey-*.md")))
if not files:
    files = sorted(glob.glob(os.path.join(BASE, "..", "..", "raw", "web", "survey-*.md")))

cited = {}
missing = {}
for f in files:
    txt = open(f, encoding="utf-8").read()
    for m in pattern.finditer(txt):
        aid = m.group(1)
        cited.setdefault(aid, set()).add(os.path.basename(f))
        if aid not in by_id:
            missing.setdefault(aid, set()).add(os.path.basename(f))

print(f"survey files: {len(files)}")
print(f"unique arXiv citations: {len(cited)}")
print(f"missing from fetched set: {len(missing)}")
for aid, fs in sorted(missing.items()):
    print("  MISSING", aid, "<-", ", ".join(sorted(fs))[:80])

# 生成参考文献
lines = ["# 参考文献（自动生成，来源：arXiv API 实测结果）\n",
         f"> 共 {len(cited)} 篇被综述引用；其中 {len(missing)} 篇不在本次抓取集合中（需人工核实）。\n"]
for aid in sorted(cited, key=lambda x: by_id.get(x, {}).get("published", ""), reverse=True):
    r = by_id.get(aid)
    if not r:
        lines.append(f"- **arXiv:{aid}** — *（未在抓取结果中，待核实）*")
        continue
    authors = ", ".join(r["authors"][:3]) + (" et al." if len(r["authors"]) > 3 else "")
    lines.append(f"- **[{r['title']}](https://arxiv.org/abs/{aid})**  \n  {authors} · arXiv:{aid} · {r['published'][:10]}")
    lines.append(f"  > {r['abstract'][:260]}...\n")

open(os.path.join(BASE, "references.md"), "w", encoding="utf-8").write("\n".join(lines))
print("wrote references.md")
