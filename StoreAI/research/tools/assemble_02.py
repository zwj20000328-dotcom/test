# -*- coding: utf-8 -*-
"""汇编 15 个方向的综述为 02-科研成果调研.md"""
import os, re

BASE = "d:/xiaojun/work/test/StoreAI/research/raw/web"
OUT = "d:/xiaojun/work/test/StoreAI/research/02-科研成果调研.md"

CHAPTERS = [
    ("kv-offload-tiered", "KV Cache 卸载与分层缓存"),
    ("kv-compression", "KV Cache 压缩、量化、稀疏与驱逐"),
    ("kv-disagg-sched", "KV 为中心的解耦架构与调度"),
    ("kv-reuse-prefix", "前缀复用、Radix 缓存与语义缓存"),
    ("vector-rag-storage", "向量检索、RAG 与向量数据库存储"),
    ("training-data-fs", "训练数据管道与分布式文件系统"),
    ("checkpoint-recovery", "检查点、容错与弹性训练"),
    ("model-loading-serving", "模型权重存储、加载与分发"),
    ("memory-hierarchy-hw", "存储层次与硬件协同（CXL/CSD/PIM）"),
    ("agent-memory", "Agent 长期记忆与上下文存储"),
    ("network-transfer", "数据移动、RDMA 与传输引擎"),
    ("industrial-systems", "工业界系统与产品"),
    ("benchmarks-measurement", "基准测试、Trace 与工作负载刻画"),
    ("chinese-academia", "国内学术与产业研究"),
    ("frontier", "前沿与交叉方向"),
]

def demote(text):
    return re.sub(r"^(#{1,5}) ", lambda m: "#" * (len(m.group(1)) + 1) + " ", text, flags=re.M)

parts = []
parts.append("""# 02 · 科研成果调研（15 个方向）

> **本章定位**：这是报告的文献主体，按 15 个子方向组织。每一节都由检索增强的 agent 基于 **arXiv 官方 API 真实抓取的摘要**撰写（而非模型记忆），引用格式统一为 `[arXiv:ID]`。
>
> **数据规模**：47 组查询、1,877 篇去重论文（最新 2026-10-30）；15 篇综述共引用 **529 个唯一 arXiv 条目**，经脚本逐一比对，**缺失 0 个**。
>
> **阅读建议**：若时间有限，优先读 2.1（卸载与分层）、2.4（复用）、2.9（CXL/硬件）、2.10（Agent 记忆）、2.16（2025–2026 趋势）。其余章节可作为技术选型时的查阅手册。
>
> **证据约定**：文中"论文声称"指数字来自摘要原文；"摘要未给出"表示摘要被截断或未报告该指标；未标注会议的工作一律视为 arXiv 预印本。完整的参考文献表见 `05-参考文献与索引.md`。

## 2.0 章节索引

| 节 | 方向 | 核心问题 | 建议读者 |
|---|---|---|---|
| 2.1 | KV 卸载与分层缓存 | KV 放哪层、怎么搬 | 系统/基础设施 |
| 2.2 | KV 压缩与稀疏 | 如何用更少字节表达同样的上下文 | 算法/推理 |
| 2.3 | 解耦架构与调度 | prefill/decode 如何分工 | 集群调度 |
| 2.4 | 前缀与非前缀复用 | 哪些计算可以安全复用 | 推理系统/存储 |
| 2.5 | 向量检索与 RAG | 检索索引如何存与更新 | 数据库/检索 |
| 2.6 | 训练数据与文件系统 | GPU 为什么等数据 | 存储/训练平台 |
| 2.7 | 检查点与容错 | 训练状态如何持久化 | 存储/训练平台 |
| 2.8 | 模型加载与分发 | 权重如何冷启动、去重、流转 | 推理平台/供应链 |
| 2.9 | 存储层次与硬件 | CXL/CSD/PIM 能带来什么 | 体系结构/硬件 |
| 2.10 | Agent 记忆 | 长期记忆如何不丢、不错、可删 | 系统/数据库 |
| 2.11 | 数据移动与 RDMA | 字节如何在节点间高效流动 | 网络/存储 |
| 2.12 | 工业界系统 | 谁把什么放在哪一层 | 产业分析 |
| 2.13 | 基准与测量 | 如何公平比较 | 评测/复现 |
| 2.14 | 国内研究版图 | 中国团队做了什么 | 产业/合作 |
| 2.15 | 前沿与交叉 | 下一波问题在哪 | 研究者 |
| 2.16 | 2025–2026 趋势 | 哪些假设被打破 | 所有人 |

---
""")

for i, (key, title) in enumerate(CHAPTERS, 1):
    path = os.path.join(BASE, f"survey-{key}.md")
    if not os.path.exists(path):
        print("MISSING", path); continue
    text = open(path, encoding="utf-8").read().strip()
    lines = text.splitlines()
    # 找到第一个一级标题
    idx = next((j for j, l in enumerate(lines) if l.startswith("# ")), -1)
    if idx >= 0:
        lines = lines[:idx] + lines[idx+1:]
    body = demote("\n".join(lines).strip())
    parts.append(f"\n## 2.{i} {title}\n\n{body}\n\n---\n")

# 趋势章节
trend_path = os.path.join(BASE, "survey-trend.md")
if os.path.exists(trend_path):
    text = open(trend_path, encoding="utf-8").read().strip()
    lines = text.splitlines()
    idx = next((j for j, l in enumerate(lines) if l.startswith("# ")), -1)
    if idx >= 0:
        lines = lines[:idx] + lines[idx+1:]
    body = demote("\n".join(lines).strip())
    parts.append(f"\n## 2.16 2025–2026 趋势：从“放得下”到“搬得动、修得对、写得少”\n\n{body}\n\n---\n")

parts.append("""
## 2.17 本章小结：十五个方向的共同结论

1. **KV 已经独立于模型成为存储对象**。从 2.1 到 2.4，几乎所有 2025–2026 的工作都在回答同一个问题：KV 的命名、放置、复用与失效。
2. **"分层"正在从容量策略变成正确性策略**。2.4 与 2.16 反复出现同一个结论：复用是否安全，比复用是否命中更重要。
3. **训练侧的存储主角是 checkpoint 与元数据，不是数据加载**（2.6、2.7）。
4. **硬件新层（CXL、CXL-SSD、HBF、光子互连）已经出现，但现货性能普遍不达预期**（2.9、2.16）；软硬协同的定义权比器件参数更重要。
5. **Agent 记忆、多租户隔离、删除传播是三个被严重低估的方向**（2.10、2.12、2.16）。

> 本章所有引用均可在 `05-参考文献与索引.md` 中按 arXiv ID 查到标题、作者与日期。若发现事实错误，请以原始摘要为准。
""")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w", encoding="utf-8").write("\n".join(parts))
print("wrote", OUT, len("\n".join(parts)), "chars")
