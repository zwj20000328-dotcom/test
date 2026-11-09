# -*- coding: utf-8 -*-
"""检查经典工作是否已在抓取集合中；缺失的用 arXiv 标题检索补齐。"""
import json, os, re, time, urllib.parse, urllib.request
import xml.etree.ElementTree as ET

BASE = "d:/xiaojun/work/test/StoreAI/research/raw/web"
NS = {"a": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}

CLASSICS = [
    "Efficient Memory Management for Large Language Model Serving with PagedAttention",
    "Orca: A Distributed Serving System for Transformer-Based Generative Models",
    "DistServe: Disaggregating Prefill and Decoding for Goodput-optimized Large Language Model Serving",
    "Splitwise: Efficient Generative LLM Inference Using Phase Splitting",
    "Llumnix: Dynamic Scheduling for Large Language Model Serving",
    "Taming Throughput-Latency Tradeoff in LLM Inference with Sarathi-Serve",
    "Mooncake: A KVCache-centric Disaggregated Architecture for LLM Serving",
    "MemServe: Context Caching for Disaggregated LLM Serving with Elastic Memory Pool",
    "Preble: Efficient Distributed Prompt Scheduling for LLM Serving",
    "SGLang: Efficient Execution of Structured Language Model Programs",
    "CacheBlend: Fast Large Language Model Serving for RAG with Cached Knowledge Fusion",
    "CacheGen: KV Cache Compression and Streaming for Fast Large Language Model Serving",
    "Cost-Efficient Large Language Model Serving for Multi-turn Conversations with CachedAttention",
    "InfiniGen: Efficient Generative Inference of Large Language Models with Dynamic KV Cache Management",
    "FlexGen: High-Throughput Generative Inference of Large Language Models with a Single GPU",
    "LLM in a Flash: Efficient Large Language Model Inference with Limited Memory",
    "H2O: Heavy-Hitter Oracle for Efficient Generative Inference of Large Language Models",
    "Efficient Streaming Language Models with Attention Sinks",
    "SnapKV: LLM Knows What You are Looking for Before Generation",
    "Quest: Query-Aware Sparsity for Efficient Long-Context LLM Inference",
    "KIVI: A Tuning-Free Asymmetric 2bit Quantization for KV Cache",
    "PyramidKV: Dynamic KV Cache Compression based on Pyramidal Information Funneling",
    "MiniCache: KV Cache Compression in Depth Dimension for Large Language Models",
    "DiskANN: Fast Accurate Billion-point Nearest Neighbor Search on a Single Node",
    "SPANN: Highly-efficient Billion-scale Approximate Nearest Neighbor Search",
    "ServerlessLLM: Low-Latency Serverless Inference for Large Language Models",
    "CheckFreq: Frequent, Fine-Grained DNN Checkpointing",
    "Gemini: Fast Failure Recovery in Distributed Training with In-Memory Checkpoints",
    "ByteCheckpoint: A Unified Checkpointing System for Large Foundation Model Development",
    "ZeRO: Memory Optimizations Toward Training Trillion Parameter Models",
    "ZeRO-Infinity: Breaking the GPU Memory Wall for Extreme Scale Deep Learning",
    "Efficiently Scaling Transformer Inference",
    "vAttention: Dynamic Memory Management for Serving LLMs without PagedAttention",
    "LoongServe: Efficiently Serving Long-context Large Language Models with Elastic Sequence Parallelism",
    "AttentionStore: Cost-effective Attention Reuse across Multi-turn Conversations in Large Language Model Serving",
    "Pensieve: A Multi-Turn-Aware KV Cache System for Efficient LLM Serving",
    "KVShare: An LLM Service System with Efficient and Effective Multi-Tenant KV Cache Reuse",
    "Tutti: Making SSD-Backed KV Cache Practical for Long-Context LLM Serving",
    "LMCache: An Efficient KV Cache Layer for Enterprise-Scale LLM Inference",
    "Gandalf: Flash Shall Not Die! Increasing Flash Storage Lifetime for KV Cache Offloading in LLM Serving",
    "ObjectCache: Layerwise Object-Storage Retrieval for KV Cache Reuse",
    "TraCT: Disaggregated LLM Serving with CXL Shared Memory KV Cache at Rack-Scale",
    "ITME: Inference Tiered Memory Expansion with Disaggregated CXL-Hybrid Memories",
    "InstInfer: In-Storage Attention Offloading for Cost-Effective Long-Context LLM Inference",
    "The AI and Memory Wall",
    "KVDirect: Distributed Disaggregated LLM Inference",
    "SGLang HiCache",
    "Mooncake Store",
]

raw = json.load(open(os.path.join(BASE, "arxiv_raw.json"), encoding="utf-8"))
raw_titles = [re.sub(r"[^a-z0-9]+", " ", r["title"].lower()) for r in raw]
have_ids = {r["id"].split("v")[0] for r in raw}


def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def fetch_title(title):
    q = 'ti:"%s"' % title.split(":")[0].strip()
    url = "https://export.arxiv.org/api/query?" + urllib.parse.urlencode(
        {"search_query": q, "start": 0, "max_results": 5, "sortBy": "relevance"})
    req = urllib.request.Request(url, headers={"User-Agent": "llm-storage-research/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    root = ET.fromstring(data)
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


missing = []
for title in CLASSICS:
    nt = norm(title)
    key = " ".join(nt.split()[:8])
    if any(key in rt for rt in raw_titles):
        continue
    missing.append(title)

print("missing classics:", len(missing))
extra = []
for i, title in enumerate(missing, 1):
    try:
        got = fetch_title(title)
        if got:
            extra.append(got[0])
            print(f"  [{i}] FOUND {got[0]['id']} {got[0]['title'][:80]}")
        else:
            print(f"  [{i}] NONE  {title[:80]}")
    except Exception as ex:
        print(f"  [{i}] ERR   {title[:60]} :: {ex}")
    time.sleep(3)

if extra:
    raw.extend(extra)
    json.dump(raw, open(os.path.join(BASE, "arxiv_raw.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(extra, open(os.path.join(BASE, "classic_seeds.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"appended {len(extra)} classics, total {len(raw)}")
