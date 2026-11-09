# -*- coding: utf-8 -*-
"""应用评审确认的修正（文档 00/01/02/03/05/README）。"""
import os, sys

ROOT = "d:/xiaojun/work/test/StoreAI/research"
EDITS = []

def add(path, old, new, optional=False):
    EDITS.append((path, old, new, optional))

# ---------- 00 ----------
add("00-方法论与证据说明.md",
    "**1,866 篇去重论文**，最早 2019、最新 **2026-10-30**",
    "**1,878 篇去重论文**，最早 2019、最新 **2026-10-30**")

# ---------- 01 ----------
add("01-领域全景与技术图谱.md",
    "需要约 9 张 H200 仅用于放 KV",
    "需要约 10 张 H200 仅用于放 KV（按 141 GB 口径）")

add("01-领域全景与技术图谱.md",
    "### 4.4 PD 解耦与调度：从 7× 收敛到 1.2–1.5×",
    "### 4.4 PD 解耦与调度：收益取决于 SLO，跨论文数字不可比")

add("01-领域全景与技术图谱.md",
    "**现状**：PD 分离已是事实标准，但收益从早期的 7× 收敛到 1.2–1.5×；下一波竞争在 **KV-aware routing** 与全局 KV 目录，而不是再拆一次 prefill/decode。",
    "**现状**：PD 分离已是事实标准，但收益高度依赖 SLO、模型与负载：DistServe 在自身 TTFT/TPOT 约束下报告 7.4× 请求率 [arXiv:2401.09670]，Splitwise 以吞吐/成本口径报告 1.4× [arXiv:2311.18677]，两者不可拼成一条“收敛”曲线；下一波竞争在 **KV-aware routing** 与全局 KV 目录，而不是再拆一次 prefill/decode。")

add("01-领域全景与技术图谱.md",
    "**关键判断**：token 级驱逐的压缩率长期停在 **约 5×**，且检索/多跳任务上掉点明显；量化与编码的“压缩比–精度”前沿高度重合，甚至组合不叠加（[arXiv:2610.33076] 报告 FP4 与 Polar 串联后在两个维度都劣于单用 FP4）。**真正的杠杆已经转向架构级（GQA/MLA）与存储级（可检索 KV、量化格式），而不是又一个驱逐策略。**",
    "**关键判断**：H2O/SnapKV 一类报告在保留约 20%（约 5×）时精度基本不变（H2O 的 20% heavy-hitter 设置即属此列 [arXiv:2306.14048]），但这不是长期平台——KV² 在 RULER 16K 上报告 2% 预算（约 50×）[arXiv:2610.03198]，KVpop 报告 75%/88% 压缩（约 4×/8×）且保留 98%/97% [arXiv:2607.05061]，Lexico 仅用 15–25% 内存（约 4–7×）并保持 90–95% 性能 [arXiv:2412.08890]；检索/多跳任务上掉点仍然明显。量化与编码的“压缩比–精度”前沿高度重合，甚至组合不叠加（[arXiv:2610.33076] 报告 FP4 与 Polar 串联后在两个维度都劣于单用 FP4）。**真正的杠杆已经转向架构级（GQA/MLA）与存储级（可检索 KV、量化格式），而不是又一个驱逐策略。**")

add("01-领域全景与技术图谱.md",
    "**反直觉事实**：1024 GPU 的 LLM token 流聚合只有 **12–50 MB/s**；真正打爆存储的是**元数据**（2000 sample/s/GPU × 1024 × 4 ops ≈ 820 万 ops/s）与 **checkpoint**（比数据加载高 10³–10⁴ 倍 bytes/FLOP）。把“LLM 训练存储瓶颈”归因于“数据读不动”是常见错误。",
    "**反直觉事实（一阶估算，假设 3000 tok/s/GPU、4–16 B/token，推导见 `raw/analysis-quant.md` §5）**：1024 GPU 的 LLM token 流聚合只有 **12–50 MB/s**；真正打爆存储的是**元数据**（小文件负载按 2000 sample/s/GPU × 1024 × 4 ops ≈ 820 万 ops/s；注意这是图像/小文件口径，不是 LLM token 流）与 **checkpoint**（比数据加载高 10³–10⁵ 倍 bytes/FLOP）。把“LLM 训练存储瓶颈”归因于“数据读不动”是常见错误。")

add("01-领域全景与技术图谱.md",
    "**未解**：embedding 版本迁移（10 亿 × 768 × 4B ≈ 3.07 TB，全量重建写 3–5 TB）",
    "**未解**：embedding 版本迁移（10 亿 × 768 × 4B ≈ 3.07 TB；全量重建约 3 TB 量级（估算，含索引与中间态倍数）")

# ---------- 03 ----------
add("03-优劣势总结报告.md",
    "checkpoint 的 bytes/FLOP 比数据加载高 10³–10⁴ 倍",
    "checkpoint 的 bytes/FLOP 比数据加载高 10³–10⁵ 倍")

add("03-优劣势总结报告.md",
    "反过来，前缀感知去重能显著削减写量，但前提是页缓存仍然温热——一旦被逐出，同一路径在 683 ms 内发出约 1 GB 顺序读 [arXiv:2610.21249]。",
    "反过来，前缀感知去重的写量削减只对 exact-repeat（同上下文、同 prompt）负载显著，该组写入从 1.62 GB 降到 11.75 MB，其余三类负载写量仍在 2–5 GB；而“几乎不读 SSD”只是 legacy 栈在页缓存温热时的假象——一旦缓存被逐出，同一路径在 683 ms 内发出约 1 GB 顺序读 [arXiv:2610.21249]。")

add("03-优劣势总结报告.md",
    "LRU 在 agent 密集场景比 S3FIFO 高 12%，其他场景低至 22%",
    "LRU 在 agent 密集场景比 S3FIFO 高 12%，其余场景最多落后 22%")

add("03-优劣势总结报告.md",
    "- 收益从 7× 收敛到 1.2–1.5×；",
    "- 收益高度依赖 SLO、模型与负载，跨论文数字不可比（DistServe 的 7.4× 是 TTFT/TPOT 约束下的请求率，Splitwise 的 1.4× 是吞吐/成本口径）；")

add("03-优劣势总结报告.md",
    "- 机密计算下 DMA 假设失效（吞吐损失 13–27%）。",
    "- 机密计算下 DMA 假设失效（吞吐损失 13–27%）[arXiv:2606.23969]。")

add("03-优劣势总结报告.md",
    "| SSD KV 卸载 | 已量产 | LMCache [arXiv:2510.09665]、KVDrive [arXiv:2605.18071] | 默认方案；下一道坎是寿命 |",
    "| SSD KV 卸载 | 规模化（LMCache）/ 原型（KVDrive） | LMCache [arXiv:2510.09665]、KVDrive [arXiv:2605.18071] | 默认方案；下一道坎是寿命。KVDrive 论文仅报告原型，无生产部署证据 |")

add("03-优劣势总结报告.md",
    "| CXL 内存池 | 试点 | Beluga [arXiv:2511.20172] | 需 512 GiB 级设备与 K8s 调度 |",
    "| CXL 内存池 | 试点 | Beluga [arXiv:2511.20172]、CXL-K8s [arXiv:2609.10790] | K8s 原生 DRA 调度；需 512 GiB 级共享池才划算 |")

add("03-优劣势总结报告.md",
    "| 缓存侧信道防护 | 试点 | PROMPTPEEK [arXiv:2608.09225] | 多租户合规刚需 |",
    "| 缓存侧信道防护 | 试点 | KVGov [arXiv:2608.09225] | 多租户合规刚需 |")

add("03-优劣势总结报告.md",
    "FailBench 横评 142 个组合后结论是“**没有机制普遍最优**”（磁盘稳态开销 0.5%，内存复制恢复约 17 ms）[arXiv:2610.07688]。",
    "FailBench 横评 142 个组合后结论是“**没有机制普遍最优**”；在 A2 架构上，磁盘检查点稳态开销最低（0.5%），内存复制恢复最快（约 17 ms）[arXiv:2610.07688]。")

# ---------- 02 ----------
add("02-科研成果调研.md",
    "同时 prefix-aware 去重带来显著写下降。",
    "同时 prefix-aware 去重只在 exact-repeat 负载下带来显著写下降（1.62 GB→11.75 MB），其余三类负载写量仍在 2–5 GB。")

add("02-科研成果调研.md",
    "反过来，前缀感知去重能显著削减写量，但前提是页缓存仍然温热——一旦被逐出，同一路径在 683 ms 内发出约 1 GB 顺序读 [arXiv:2610.21249]。",
    "反过来，前缀感知去重的写量削减只对 exact-repeat（同上下文、同 prompt）负载显著，该组写入从 1.62 GB 降到 11.75 MB，其余三类负载写量仍在 2–5 GB；而“几乎不读 SSD”只是 legacy 栈在页缓存温热时的假象——一旦缓存被逐出，同一路径在 683 ms 内发出约 1 GB 顺序读 [arXiv:2610.21249]。")

add("02-科研成果调研.md",
    "| Gandalf [arXiv:2610.30791v1] | 2026 | SSD | 按 attention 类型区分写入门控 | 摘要未给出具体数字 | 需类型推断，命中率与寿命仍需权衡 |",
    "| Gandalf [arXiv:2610.30791v1] | 2026 | SSD | 按 attention 类型区分写入门控 | 平均 7.3× 寿命提升，命中率影响可忽略 | 需类型推断，命中率与寿命仍需权衡 |")

add("02-科研成果调研.md",
    "后者用于 post-training，按阈值只持久化更新超阈值的层。两者摘要均未给出量化收益。",
    "后者用于 post-training，按阈值只持久化更新超阈值的层。LLMTailor 摘要报告 4.3× checkpoint size 缩减（Llama3.1-8B）与 2.8× checkpoint time 加速（Qwen2.5-7B）；LayerCheck 摘要未给出量化收益。")

add("02-科研成果调研.md",
    "机制上是“把闲置显存当作权重缓存层”。摘要未给出量化结果（900 字符处截断）。",
    "机制上是“把闲置显存当作权重缓存层”。摘要报告 6.2× 加载加速、冷启动 TTFT 降低 23–55%。")

add("02-科研成果调研.md",
    "是“共享页需要写隔离原语”的直接证据。摘要未给出量化结果。",
    "是“共享页需要写隔离原语”的直接证据。摘要报告 GPU 显存占用降低 59.8%、吞吐 2.15×、集群服务率 99.97%。")

add("02-科研成果调研.md",
    "这是最贴近存储系统接口视角的一篇。摘要未给出量化结果。",
    "这是最贴近存储系统接口视角的一篇。摘要报告中位 TTFT 最多改善 93.2%。")

add("02-科研成果调研.md",
    "再按状态局部性与 GPU 争用做路由。摘要未给出量化结果。",
    "再按状态局部性与 GPU 争用做路由。摘要报告 TTFT 最多降低 92.3%，延迟-成本效率为 vLLM-LoRA 的 1.66–3.01×。")

add("02-科研成果调研.md",
    "| Tangram [2512.01357] | 2025 | GPU 显存池 | 空闲显存驻留 + 张量级参数共享 | 摘要未给出 | 依赖空闲显存，负载高时失效 |",
    "| Tangram [2512.01357] | 2025 | GPU 显存池 | 空闲显存驻留 + 张量级参数共享 | 6.2× 加载加速；TTFT −23–55% | 依赖空闲显存，负载高时失效 |")

add("02-科研成果调研.md",
    "| gKSM [2610.25219] | 2026 | 驱动层显存 | 跨实例页去重 + 写隔离 | 摘要未给出 | 需驱动改造，无原生 COW |",
    "| gKSM [2610.25219] | 2026 | 驱动层显存 | 跨实例页去重 + 写隔离 | 显存 −59.8%；吞吐 2.15× | 需驱动改造，无原生 COW |")

add("02-科研成果调研.md",
    "| TensorCast [2608.06007] | 2026 | 抽象层 | 张量生命周期 TaaS | 摘要未给出 | 抽象层本身有开销 |",
    "| TensorCast [2608.06007] | 2026 | 抽象层 | 张量生命周期 TaaS | 中位 TTFT 最多 −93.2% | 抽象层本身有开销 |")

add("02-科研成果调研.md",
    "1,877 篇去重论文",
    "1,878 篇去重论文")

# ---------- 05 ----------
add("05-参考文献与索引.md",
    "1. **无 arXiv 版本的经典**：Orca (OSDI'22)、H2O (NeurIPS'23)、DiskANN (NeurIPS'19)、CheckFreq (FAST'21)、Gemini (SOSP'23)、AttentionStore、3FS 论文（若存在）。这些工作在正文中以名称引用，未给 arXiv ID。",
    "1. **无 arXiv 版本的经典**：Orca (OSDI'22)、DiskANN (NeurIPS'19)、CheckFreq (FAST'21)、Gemini (SOSP'23)、AttentionStore、3FS 论文（若存在）。这些工作在正文中以名称引用，未给 arXiv ID。**H2O 不在此列：已核实为 [arXiv:2306.14048](https://arxiv.org/abs/2306.14048)（NeurIPS 2023），已补入正文引用。**")

# ---------- README ----------
add("README.md",
    "- 以 arXiv 为主，无 arXiv 版本的经典（Orca、H2O、DiskANN、3FS 论文）与国内期刊覆盖不足；",
    "- 以 arXiv 为主，无 arXiv 版本的经典（Orca、DiskANN、3FS 论文）与国内期刊覆盖不足；H2O 已核实为 [arXiv:2306.14048](https://arxiv.org/abs/2306.14048)。")

add("README.md",
    "**1,877 篇**去重论文",
    "**1,878 篇**去重论文")

# apply
import re

def build_pattern(old):
    parts = []
    for ch in old:
        if ch == '"':
            parts.append('["“”]')
        elif ch == '–':
            parts.append('[-–—]')
        elif ch == '—':
            parts.append('[-–—]')
        else:
            parts.append(re.escape(ch))
    return ''.join(parts)

ok = 0
for rel, old, new, optional in EDITS:
    p = os.path.join(ROOT, rel)
    t = open(p, encoding="utf-8").read()
    pat = build_pattern(old)
    t2, n = re.subn(pat, lambda m: new, t, count=1)
    if n == 0:
        print(f"[MISS] {rel}: {old[:50]}...")
        continue
    open(p, "w", encoding="utf-8").write(t2)
    ok += 1
print(f"applied {ok}/{len(EDITS)}")
