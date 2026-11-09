# -*- coding: utf-8 -*-
"""清洗 classic-seed 中的误匹配，并用全文标题检索补齐关键经典工作。"""
import difflib, json, os, re, time, urllib.parse, urllib.request
import xml.etree.ElementTree as ET

BASE = "d:/xiaojun/work/test/StoreAI/research/raw/web"
NS = {"a": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}
data = json.load(open(os.path.join(BASE, "arxiv_raw.json"), encoding="utf-8"))

KEY = [
    ("Efficient Memory Management for Large Language Model Serving with PagedAttention", "PagedAttention"),
    ("Mooncake: A KVCache-centric Disaggregated Architecture for LLM Serving", "Mooncake"),
    ("InfiniGen: Efficient Generative Inference of Large Language Models with Dynamic KV Cache Management", "InfiniGen"),
    ("CacheBlend: Fast Large Language Model Serving for RAG with Cached Knowledge Fusion", "CacheBlend"),
    ("CacheGen: KV Cache Compression and Streaming for Fast Large Language Model Serving", "CacheGen"),
    ("Cost-Efficient Large Language Model Serving for Multi-turn Conversations with CachedAttention", "CachedAttention"),
    ("Llumnix: Dynamic Scheduling for Large Language Model Serving", "Llumnix"),
    ("Taming Throughput-Latency Tradeoff in LLM Inference with Sarathi-Serve", "Sarathi-Serve"),
    ("Orca: A Distributed Serving System for Transformer-Based Generative Models", "Orca"),
    ("H2O: Heavy-Hitter Oracle for Efficient Generative Inference of Large Language Models", "H2O"),
    ("Quest: Query-Aware Sparsity for Efficient Long-Context LLM Inference", "Quest"),
    ("KIVI: A Tuning-Free Asymmetric 2bit Quantization for KV Cache", "KIVI"),
    ("PyramidKV: Dynamic KV Cache Compression based on Pyramidal Information Funneling", "PyramidKV"),
    ("DiskANN: Fast Accurate Billion-point Nearest Neighbor Search on a Single Node", "DiskANN"),
    ("SPANN: Highly-efficient Billion-scale Approximate Nearest Neighbor Search", "SPANN"),
    ("ServerlessLLM: Low-Latency Serverless Inference for Large Language Models", "ServerlessLLM"),
    ("CheckFreq: Frequent, Fine-Grained DNN Checkpointing", "CheckFreq"),
    ("Gemini: Fast Failure Recovery in Distributed Training with In-Memory Checkpoints", "Gemini-ckpt"),
    ("ZeRO: Memory Optimizations Toward Training Trillion Parameter Models", "ZeRO"),
    ("ZeRO-Infinity: Breaking the GPU Memory Wall for Extreme Scale Deep Learning", "ZeRO-Infinity"),
    ("AttentionStore: Cost-effective Attention Reuse across Multi-turn Conversations in Large Language Model Serving", "AttentionStore"),
    ("KVDirect: Distributed Disaggregated LLM Inference", "KVDirect"),
    ("Fire-Flyer File System", "3FS"),
]

def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()

def sim(a, b):
    return difflib.SequenceMatcher(None, norm(a), norm(b)).ratio()

# 1) 删除误匹配：classic-seed 且与任何关键标题相似度 < 0.6
cleaned, dropped = [], []
for r in data:
    prov = r.get("provenance", [{}])
    is_seed = any(p.get("dim") == "classic-seed" for p in prov)
    if is_seed:
        best = max(sim(r["title"], k[0]) for k in KEY)
        if best < 0.62:
            dropped.append((r["id"], r["title"][:70], round(best, 2)))
            continue
    cleaned.append(r)
print("dropped false positives:", len(dropped))
for d in dropped:
    print("   -", d)
data = cleaned

# 2) 找出缺失关键工作
titles = [r["title"] for r in data]
missing = [(full, short) for full, short in KEY if max(sim(t, full) for t in titles) < 0.72]
print("still missing:", [m[1] for m in missing])

def search(q):
    url = "https://export.arxiv.org/api/query?" + urllib.parse.urlencode(
        {"search_query": q, "start": 0, "max_results": 8, "sortBy": "relevance"})
    req = urllib.request.Request(url, headers={"User-Agent": "llm-storage-research/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        root = ET.fromstring(r.read())
    out = []
    for e in root.findall("a:entry", NS):
        out.append({
            "id": e.find("a:id", NS).text.rsplit("/abs/", 1)[-1],
            "title": " ".join(e.find("a:title", NS).text.split()),
            "abstract": " ".join(e.find("a:summary", NS).text.split()),
            "published": e.find("a:published", NS).text,
            "updated": e.find("a:updated", NS).text,
            "authors": [a.find("a:name", NS).text for a in e.findall("a:author", NS)],
            "categories": [c.get("term") for c in e.findall("a:category", NS)],
            "comment": (e.find("arxiv:comment", NS).text if e.find("arxiv:comment", NS) is not None else ""),
            "journal_ref": (e.find("arxiv:journal_ref", NS).text if e.find("arxiv:journal_ref", NS) is not None else ""),
            "doi": "",
            "provenance": [{"dim": "classic-seed", "query": q, "rank": 0}],
        })
    return out

added = 0
for full, short in missing:
    try:
        cands = search('all:"%s"' % full)
        if not cands:
            cands = search('all:"%s"' % " ".join(full.split()[:8]))
        cands.sort(key=lambda x: sim(x["title"], full), reverse=True)
        best = cands[0] if cands else None
        if best and sim(best["title"], full) >= 0.72:
            data.append(best)
            added += 1
            print(f"  + {short}: {best['id']} {best['title'][:78]} (sim={sim(best['title'], full):.2f})")
        else:
            print(f"  ! {short}: no confident match")
    except Exception as ex:
        print(f"  ! {short}: err {ex}")
    time.sleep(3)

json.dump(data, open(os.path.join(BASE, "arxiv_raw.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"added {added}; total {len(data)}")
