# -*- coding: utf-8 -*-
"""
arXiv 批量检索：覆盖"存储服务大模型"的 15 个子方向 + 重点系统名。
输出: research/raw/web/arxiv_raw.json
"""
import json
import os
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

OUT_DIR = "d:/xiaojun/work/test/StoreAI/research/raw/web"
NS = {"a": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}

# (dimension_key, query, max_results, sort)
QUERIES = [
    # 1 KV offload / tiered
    ("kv-offload-tiered", 'abs:"KV cache" AND (abs:offload OR abs:storage OR abs:SSD OR abs:disk OR abs:hierarchical)', 80, "relevance"),
    ("kv-offload-tiered", 'abs:"KV cache" AND abs:memory AND abs:management', 60, "relevance"),
    ("kv-offload-tiered", 'abs:"LLM inference" AND abs:offloading', 40, "relevance"),
    # 2 compression / eviction
    ("kv-compression", 'abs:"KV cache" AND (abs:compression OR abs:quantization OR abs:eviction OR abs:sparsity)', 80, "relevance"),
    ("kv-compression", 'abs:"KV cache" AND abs:"long context"', 60, "relevance"),
    # 3 disaggregation / scheduling
    ("kv-disagg-sched", 'abs:disaggregated AND (abs:LLM OR abs:inference)', 60, "relevance"),
    ("kv-disagg-sched", 'abs:prefill AND abs:decode AND abs:scheduling', 40, "relevance"),
    ("kv-disagg-sched", 'abs:"LLM serving" AND (abs:scheduling OR abs:goodput OR abs:SLO)', 60, "relevance"),
    # 4 reuse / prefix / semantic cache
    ("kv-reuse-prefix", 'abs:"prefix cache" OR abs:"prefix caching" OR abs:"KV reuse" OR abs:"KV cache reuse"', 60, "relevance"),
    ("kv-reuse-prefix", 'abs:"semantic cache" OR abs:"prompt cache"', 40, "relevance"),
    # 5 vector / RAG storage
    ("vector-rag-storage", '(abs:"vector database" OR abs:"vector search") AND (abs:disk OR abs:SSD OR abs:storage)', 60, "relevance"),
    ("vector-rag-storage", 'abs:"approximate nearest neighbor" AND (abs:SSD OR abs:disk)', 40, "relevance"),
    ("vector-rag-storage", 'abs:"retrieval augmented generation" AND (abs:cache OR abs:storage)', 60, "relevance"),
    # 6 training data / FS
    ("training-data-fs", '(abs:"distributed file system" OR abs:"storage system") AND (abs:"large language model" OR abs:"deep learning" OR abs:training)', 60, "relevance"),
    ("training-data-fs", 'abs:"data loading" AND abs:"deep learning"', 40, "relevance"),
    ("training-data-fs", 'abs:"GPUDirect" OR abs:"Fire-Flyer File System" OR abs:"3FS"', 40, "relevance"),
    # 7 checkpoint
    ("checkpoint-recovery", 'abs:checkpoint AND (abs:"large language model" OR abs:"distributed training")', 60, "relevance"),
    ("checkpoint-recovery", 'abs:"fault tolerance" AND abs:"distributed training"', 40, "relevance"),
    ("checkpoint-recovery", 'abs:"elastic training" OR abs:"failure recovery" AND abs:LLM', 40, "relevance"),
    # 8 model loading / serving
    ("model-loading-serving", 'abs:"model loading" AND (abs:inference OR abs:serving)', 40, "relevance"),
    ("model-loading-serving", 'abs:serverless AND (abs:LLM OR abs:"large language model")', 40, "relevance"),
    ("model-loading-serving", 'abs:"model weight" AND (abs:offloading OR abs:streaming OR abs:cache)', 40, "relevance"),
    # 9 hardware
    ("memory-hierarchy-hw", 'abs:CXL AND (abs:LLM OR abs:"machine learning" OR abs:inference)', 50, "relevance"),
    ("memory-hierarchy-hw", 'abs:"computational storage" OR abs:"near-memory computing" OR abs:"processing in memory"', 50, "relevance"),
    ("memory-hierarchy-hw", 'abs:"memory disaggregation" AND (abs:LLM OR abs:inference)', 40, "relevance"),
    # 10 agent memory
    ("agent-memory", 'abs:"agent memory" OR (abs:"long-term memory" AND abs:agent)', 50, "relevance"),
    ("agent-memory", 'abs:memory AND abs:LLM AND abs:agent AND abs:system', 50, "relevance"),
    # 11 network / transfer
    ("network-transfer", 'abs:RDMA AND (abs:LLM OR abs:inference OR abs:"KV cache")', 40, "relevance"),
    ("network-transfer", 'abs:"data transfer" AND abs:"KV cache"', 30, "relevance"),
    # 12 industrial (systems by name)
    ("industrial-systems", 'all:Mooncake', 30, "relevance"),
    ("industrial-systems", 'abs:Dynamo AND abs:inference AND abs:NVIDIA', 20, "relevance"),
    ("industrial-systems", 'abs:"KV cache" AND abs:"object storage"', 30, "relevance"),
    # 13 benchmark / measurement
    ("benchmarks-measurement", 'abs:"LLM inference" AND (abs:trace OR abs:workload OR abs:characterization OR abs:benchmark)', 50, "relevance"),
    ("benchmarks-measurement", 'abs:"storage" AND abs:"benchmark" AND (abs:AI OR abs:"machine learning")', 40, "relevance"),
    # 14 Chinese academia covered by relevance; add team/product queries
    ("chinese-academia", 'abs:"Kimi" OR abs:"DeepSeek" OR abs:"ByteDance" AND abs:storage', 30, "relevance"),
    ("chinese-academia", 'abs:"Alibaba" AND abs:inference AND abs:system', 20, "relevance"),
    # 15 frontier
    ("frontier", 'abs:"KV cache" AND (abs:information OR abs:rate OR abs:compression) AND abs:theory', 30, "relevance"),
    ("frontier", 'abs:"video generation" AND (abs:storage OR abs:memory)', 30, "relevance"),
    ("frontier", 'abs:"world model" AND abs:memory', 20, "relevance"),
    # recent-only sweeps (catch 2025-2026)
    ("recent", 'abs:"KV cache"', 100, "submittedDate"),
    ("recent", 'abs:"LLM serving" OR abs:"LLM inference"', 100, "submittedDate"),
    ("recent", 'abs:storage AND (abs:LLM OR abs:"large language model")', 100, "submittedDate"),
    ("recent", 'abs:memory AND (abs:LLM OR abs:transformer) AND abs:system', 100, "submittedDate"),
    ("recent", 'abs:"agent" AND abs:memory AND abs:"large language model"', 80, "submittedDate"),
    ("recent", 'abs:"vector database" OR abs:"vector index"', 60, "submittedDate"),
    ("recent", 'abs:checkpoint AND abs:training', 60, "submittedDate"),
    ("recent", 'abs:disaggregated AND abs:inference', 60, "submittedDate"),
]


def _text(node, path):
    n = node.find(path, NS)
    return n.text.strip() if n is not None and n.text else ""


def fetch(query, max_results, sort, retries=3):
    params = {
        "search_query": query,
        "start": 0,
        "max_results": max_results,
        "sortBy": sort,
        "sortOrder": "descending",
    }
    url = "https://export.arxiv.org/api/query?" + urllib.parse.urlencode(params)
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "llm-storage-research/1.0"})
            with urllib.request.urlopen(req, timeout=90) as r:
                data = r.read()
            root = ET.fromstring(data)
            out = []
            for e in root.findall("a:entry", NS):
                aid = _text(e, "a:id")
                out.append({
                    "id": aid.rsplit("/abs/", 1)[-1],
                    "title": " ".join(_text(e, "a:title").split()),
                    "abstract": " ".join(_text(e, "a:summary").split()),
                    "published": _text(e, "a:published"),
                    "updated": _text(e, "a:updated"),
                    "authors": [a.find("a:name", NS).text for a in e.findall("a:author", NS) if a.find("a:name", NS) is not None],
                    "categories": [c.get("term") for c in e.findall("a:category", NS)],
                    "comment": _text(e, "arxiv:comment"),
                    "journal_ref": _text(e, "arxiv:journal_ref"),
                    "doi": _text(e, "arxiv:doi"),
                })
            return out
        except Exception as ex:
            print(f"  [retry {attempt+1}/{retries}] {ex}")
            time.sleep(5 * (attempt + 1))
    return []


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    all_records = {}
    provenance = {}
    for i, (dim, q, n, sort) in enumerate(QUERIES, 1):
        print(f"[{i}/{len(QUERIES)}] {dim} :: {q[:70]} (n={n}, {sort})", flush=True)
        recs = fetch(q, n, sort)
        print(f"    -> {len(recs)} records", flush=True)
        for r in recs:
            rid = r["id"]
            if rid not in all_records:
                all_records[rid] = r
                provenance[rid] = []
            provenance[rid].append({"dim": dim, "query": q, "rank": len(provenance[rid]) + 1})
        time.sleep(3.0)

    records = list(all_records.values())
    for r in records:
        r["provenance"] = provenance[r["id"]]
    records.sort(key=lambda x: x["published"], reverse=True)
    out_path = os.path.join(OUT_DIR, "arxiv_raw.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=1)
    print(f"\nDONE: {len(records)} unique records -> {out_path}")


if __name__ == "__main__":
    main()
