# -*- coding: utf-8 -*-
"""按确切 ID / 完整标题恢复经典论文。"""
import json, os, re, time, urllib.parse, urllib.request
import xml.etree.ElementTree as ET

BASE = "d:/xiaojun/work/test/StoreAI/research/raw/web"
NS = {"a": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}
data = json.load(open(os.path.join(BASE, "arxiv_raw.json"), encoding="utf-8"))
have = {r["id"].split("v")[0] for r in data}

RESTORE_IDS = [
    "2401.09670", "2407.00023", "2312.07104", "2312.11514", "2404.14469",
    "2407.20143", "2211.05102", "2404.09526", "2403.14123",
]
# 不确定 ID 的用完整标题检索
TITLE_QUERIES = [
    "Orca: A Distributed Serving System for Transformer-Based Generative Models",
    "H2O: Heavy-Hitter Oracle for Efficient Generative Inference of Large Language Models",
    "DiskANN: Fast Accurate Billion-point Nearest Neighbor Search on a Single Node",
    "SPANN: Highly-efficient Billion-scale Approximate Nearest Neighbor Search",
    "CheckFreq: Frequent, Fine-Grained DNN Checkpointing",
    "Gemini: Fast Failure Recovery in Distributed Training with In-Memory Checkpoints",
    "AttentionStore: Cost-effective Attention Reuse across Multi-turn Conversations in Large Language Model Serving",
    "ServerlessLLM: Low-Latency Serverless Inference for Large Language Models",
    "InfiniGen: Efficient Generative Inference of Large Language Models with Dynamic KV Cache Management",
    "CacheBlend: Fast Large Language Model Serving for RAG with Cached Knowledge Fusion",
    "CacheGen: KV Cache Compression and Streaming for Fast Large Language Model Serving",
    "Cost-Efficient Large Language Model Serving for Multi-turn Conversations with CachedAttention",
    "Llumnix: Dynamic Scheduling for Large Language Model Serving",
    "Taming Throughput-Latency Tradeoff in LLM Inference with Sarathi-Serve",
    "Splitwise: Efficient Generative LLM Inference Using Phase Splitting",
    "Efficient Memory Management for Large Language Model Serving with PagedAttention",
    "Mooncake: A KVCache-centric Disaggregated Architecture for LLM Serving",
    "FlexGen: High-Throughput Generative Inference of Large Language Models with a Single GPU",
    "Quest: Query-Aware Sparsity for Efficient Long-Context LLM Inference",
    "KIVI: A Tuning-Free Asymmetric 2bit Quantization for KV Cache",
    "PyramidKV: Dynamic KV Cache Compression based on Pyramidal Information Funneling",
    "MemServe: Context Caching for Disaggregated LLM Serving with Elastic Memory Pool",
]

def parse(root):
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
            "provenance": [{"dim": "classic-seed", "query": "restore", "rank": 0}],
        })
    return out

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "llm-storage-research/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return ET.fromstring(r.read())

def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()

added = []
# 1) id_list
url = "https://export.arxiv.org/api/query?" + urllib.parse.urlencode(
    {"id_list": ",".join(RESTORE_IDS), "max_results": 50})
for r in parse(get(url)):
    if r["id"].split("v")[0] not in have:
        added.append(r); have.add(r["id"].split("v")[0])
time.sleep(3)

# 2) title queries
for t in TITLE_QUERIES:
    try:
        url = "https://export.arxiv.org/api/query?" + urllib.parse.urlencode(
            {"search_query": 'ti:"%s"' % t, "start": 0, "max_results": 5, "sortBy": "relevance"})
        cands = parse(get(url))
        cands = [c for c in cands if norm(c["title"]) == norm(t) or norm(c["title"]).startswith(norm(t)[:60])]
        if cands:
            c = cands[0]
            if c["id"].split("v")[0] not in have:
                added.append(c); have.add(c["id"].split("v")[0])
                print("+", c["id"], c["title"][:75])
            else:
                print("=", c["id"], c["title"][:60])
        else:
            print("! no match:", t[:60])
    except Exception as ex:
        print("! err", t[:40], ex)
    time.sleep(3)

data.extend(added)
json.dump(data, open(os.path.join(BASE, "arxiv_raw.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"restored {len(added)}, total {len(data)}")
