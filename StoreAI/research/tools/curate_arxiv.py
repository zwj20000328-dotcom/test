# -*- coding: utf-8 -*-
"""对 arXiv 原始结果做相关性打分、去重、分方向整理。"""
import json, os, re
from collections import defaultdict, Counter

BASE = "d:/xiaojun/work/test/StoreAI/research/raw/web"
recs = json.load(open(os.path.join(BASE, "arxiv_raw.json"), encoding="utf-8"))

STRONG = {
    "kv cache": 6, "kv-cache": 6, "key-value cache": 6, "key value cache": 6,
    "prefix cach": 5, "prompt cach": 5, "context cach": 5, "semantic cach": 4,
    "pagedattention": 5, "page attention": 4, "radix": 3, "cache reuse": 5,
    "disaggregat": 5, "prefill": 4, "decode": 2, "pd-separation": 5,
    "storage": 4, "file system": 5, "filesystem": 5, "ssd": 4, "nvme": 4,
    "disk": 3, "offload": 5, "offloading": 5, "swap": 2, "tiered": 3, "tiering": 3,
    "checkpoint": 5, "rdma": 4, "gpudirect": 5, "memory hierarchy": 4,
    "cxl": 4, "vector database": 5, "vector index": 5, "vector search": 4,
    "approximate nearest neighbor": 4, "ann search": 3, "hnsw": 3, "diskann": 5,
    "raid": 1, "object storage": 4, "distributed storage": 5, "memory pool": 4,
    "memory management": 3, "gpu memory": 3, "hbm": 3, "bandwidth": 2,
    "i/o": 2, "io bottleneck": 4, "data loading": 4, "dataloader": 4,
    "model loading": 5, "model serving": 3, "serverless": 4, "cold start": 3,
    "agent memory": 5, "long-term memory": 4, "memory system": 3,
    "retrieval augmented": 3, "rag": 2, "embedding": 2, "index": 1,
    "compression": 2, "quantization": 1, "eviction": 3, "sparsity": 1,
    "prefetch": 4, "cache": 3, "caching": 3, "data transfer": 3,
    "moe": 2, "expert parallelism": 2, "elastic": 2, "fault tolerance": 4,
    "durability": 3, "consistency": 2, "multi-tenant": 4, "tenant": 2,
    "slo": 2, "goodput": 2, "latency": 1, "throughput": 1,
}
LLM = ["llm", "large language model", "language model", "transformer", "inference",
       "serving", "training", "agent", "rag", "generative", "foundation model",
       "deep learning", "neural network", "attention"]

def score(r):
    t = (r.get("title", "") + " " + r.get("abstract", "")).lower()
    title = r.get("title", "").lower()
    s = 0
    for k, w in STRONG.items():
        if k in t:
            s += w
        if k in title:
            s += w * 2
    if not any(x in t for x in LLM):
        s -= 6
    # 明确无关的排除
    for bad in ["protein", "climate", "recommendation system", "speech recognition", "medical image"]:
        if bad in title:
            s -= 5
    return s

def norm_title(t):
    return re.sub(r"[^a-z0-9]+", " ", t.lower()).strip()

for r in recs:
    r["score"] = score(r)

# 去重：同标题保留分数最高、日期最新
best = {}
for r in recs:
    k = norm_title(r["title"])
    if k not in best or r["score"] > best[k]["score"]:
        best[k] = r
recs = list(best.values())

# 分方向：按 provenance 主维度
by_dim = defaultdict(list)
for r in recs:
    dims = [p["dim"] for p in r.get("provenance", [])]
    main = next((d for d in dims if d != "recent"), dims[0] if dims else "misc")
    by_dim[main].append(r)

os.makedirs(BASE, exist_ok=True)
summary = {}
for dim, items in by_dim.items():
    items.sort(key=lambda x: (x["score"], x["published"]), reverse=True)
    top = [x for x in items if x["score"] >= 6][:60]
    summary[dim] = {"total": len(items), "kept": len(top), "top_score": top[0]["score"] if top else 0}
    with open(os.path.join(BASE, f"curated-{dim}.json"), "w", encoding="utf-8") as f:
        json.dump(top, f, ensure_ascii=False, indent=1)
    # 生成便于 agent 阅读的 markdown
    md = [f"# {dim} ({len(top)} / {len(items)})\n"]
    for i, x in enumerate(top, 1):
        md.append(f"## [{i}] {x['title']}\n- arXiv: {x['id']} | 发布: {x['published'][:10]} | 更新: {x['updated'][:10]} | score={x['score']}\n- 作者: {', '.join(x['authors'][:4])}{' et al.' if len(x['authors'])>4 else ''}\n- Abstract: {x['abstract'][:900]}\n")
    with open(os.path.join(BASE, f"curated-{dim}.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(md))

# 全局 top
allrec = sorted(recs, key=lambda x: (x["score"], x["published"]), reverse=True)
with open(os.path.join(BASE, "curated-all.json"), "w", encoding="utf-8") as f:
    json.dump(allrec[:400], f, ensure_ascii=False, indent=1)
print(json.dumps(summary, ensure_ascii=False, indent=2))
print("\nGLOBAL TOP 40:")
for i, x in enumerate(allrec[:40], 1):
    print(f"{i:2d}. [{x['score']:3d}] {x['published'][:7]} {x['id']:14s} {x['title'][:95]}")
