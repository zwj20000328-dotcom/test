# -*- coding: utf-8 -*-
"""应用评审对 04-研究方案提案.md 的修正。"""
import os, re

P = "d:/xiaojun/work/test/StoreAI/research/04-研究方案提案.md"
EDITS = [
# ---------- P1 ----------
("- 跨上下文/跨 checkpoint 复用已经出现（KVShareArena [arXiv:2609.10266]），但缺乏统一的成本与正确性口径。",
 "- 跨上下文/跨 checkpoint 复用已有系统研究：KVShareArena [arXiv:2609.10266] 已将 11 种修复/压缩方法置于同一评测条件下，并从答案质量、prefill 计算、KV 内存与延迟四个视角给出统一口径；但统一的是评测，不是存储接口——它不定义版本化 KV 对象、失效传播与可被引擎调用的复用契约。"),

("- vs KVShareArena：它做评测，P1 做机制与接口。",
 "- vs KVShareArena：它做评测，P1 做机制与接口；两者互补。\n- vs vCache [arXiv:2502.03771]：它在响应级语义缓存上用在线学习阈值给出用户可定义错误率保证；P1 把“误差有界复用”下沉到 KV 对象层，覆盖模型、tokenizer、量化、位置等版本维度。\n- vs FinCacheServe [arXiv:2607.26076]：它用文档/证据/工具/模型/解码指纹守卫答案复用，并在其负载上报告零 stale；P1 把同类版本守卫推广到 KV 块，并提供跨引擎接口。"),

("- 在同等硬件下，**错误复用率从不可观测降到 <0.1%**；",
 "- 在同等硬件下，**生产中缺乏统一的错误复用可观测口径**；在注入模型更新/文档更新/用户删除事件后，按 M11/M12 度量的错误复用率降到 **<0.1%**；"),

# ---------- P2 ----------
("- 指标：M1/M2 p99、M3 goodput、M8 元数据开销、M14 隔离度、M13 错误恢复。",
 "- 指标：M1/M2 p99、M3 goodput、**M4 有效吞吐**、M8 元数据开销、M14 隔离度、M13 错误恢复。"),

("- 基线：B1/B3/B4/B5；对照“CPU 发起 + io_uring”路径。",
 "- 基线：B1/B3/B5；**B4 明确配置为 GDS-enabled、SSD-backed LMCache（即 Tutti 的对照口径）**；另将 Tutti（strict SLO 下 2× 可达请求率、TTFT −78.3%）与 Range（6 GiB 恢复中位 TTFT 1.79–1.80 s，对照 tuned LMCache 2.12→3.01 s）的报告值列为**单租户参照点**，不与 B1–B5 平级；对照“CPU 发起 + io_uring”路径。"),

("- SSD-backed KV 的有效吞吐提升 **1.5–2.5×**；",
 "- 单租户：SSD-backed KV 的有效吞吐（M4）相对 GDS-enabled SSD-backed LMCache 提升 **1.5–2.5×**；该区间中位数与 Tutti 已报告的 2× 同量级，因此本方案不把单租户吞吐作为主贡献，而用消融实验分离“GPU-centric 路径”与“对象聚合”各自的增量，并明确标注相对 Tutti 的净增量；"),

("- 单对象 I/O 开销降低 **3–5×**（聚合后）。",
 "- 单对象 I/O 开销降低 **3–5×**（聚合后；指每对象在查找/分配/提交/投递/写回/索引上的合计开销，对应 M8，非端到端吞吐）。"),

# ---------- P3 ----------
("- 负载：W1/W3/W5；构造 30–90 天长期 trace。",
 "- 负载：W1/W3/W5；M1–M8 用公开 trace（ShareGPT/Mooncake/BurstGPT/Azure）驱动仿真，同时从 M1 起并行采集 30–90 天生产 trace，仅用于长程复用距离与寿命外推的校准，不阻塞模型与原型阶段。"),

("- 基线：LRU、Gandalf 类门控、SARIA 类选择性持久化、无门控。",
 "- 基线：LRU、**Gandalf [arXiv:2610.30791]**（优先作者实现；不可得则按其论文策略忠实复现并标注）、**SARIA [arXiv:2610.31169]**、**admission-controlled LRU-K [arXiv:2609.07175]**、无门控；不以“Gandalf 类/SARIA 类”替代真实系统。"),

("- 方法：S3 FEMU/SimpleSSD + S1 真实 NVMe（SMART 采集）。",
 "- 方法：S3 FEMU/SimpleSSD 模拟 NAND 写入与 GC，得到 WA(利用率) 曲线；S1 真实 NVMe 用 SMART（Data Units Written、Percentage Used、Media Wearout）做 4–8 周满带宽写入，标定实测 WA 与磨损速率；再按 `寿命 = 额定 TBW / 年化写入量` 外推，并在单一型号上做加速写入以校验外推斜率。所有寿命数字标注为**外推值**，给出型号参数（DWPD、容量、OP）与 95% 区间。"),

("- 在命中率损失 <5% 的前提下，SSD 寿命延长 **2–4×**；",
 "- 与 Gandalf 在**相同 trace、相同 SSD 型号与容量**上头对头：命中率损失 <5% 时，写入量再降 **30–50%**，寿命增益相对 Gandalf 再提高 **1.5–2×**；\n- 相对**无门控基线**，SSD 寿命延长 **2–4×**（外推值；该绝对值不与 Gandalf 的 7.3× 直接可比：7.3× 是其自身 trace 与硬件上的平均值，本文报告同条件相对增益）；"),

# ---------- P4 ----------
("- 修复可以恢复到 98%–99.8%，但成本与触发条件缺少系统研究；",
 "- 修复可以恢复到 98.4%–100%（SAFE-KV 的 risk-guided K2 selection；[arXiv:2610.15186]），但其 operating rule 在单请求 L40S 研究中退化为 full prefill——忠实修复需重编码大部分上下文。真正的空白因此不是“能否修复”，而是：在给定误差界 ε 下，如何以可验证的触发条件换回部分复用；"),

("- 基线：CacheBlend、SAFE-KV、KVBoost、full prefill。",
 "- 基线：CacheBlend、CacheTune [arXiv:2605.24022]、SAFE-KV、KVBoost、full prefill。需注明：SAFE-KV 的 operating rule 在其单请求 L40S 研究中退化为 full prefill，故“相对 SAFE-KV”与“相对 full prefill”是同一口径。"),

("- 在保真度 ≥95% 下，重算量比 SAFE-KV 低 **30–50%**；",
 "- 在保真度（M11：与 full prefill 的逐样本输出一致率）≥95% 下，把重算 token 占比压到 **50–70%**（即相对 SAFE-KV 的 100% full-prefill 口径减少 30–50% 重算），并给出该比例的可达上界；"),

("- 在 RAG 负载上 TTFT 降低 **2–4×**（相对 full prefill）。",
 "- 在 RAG 负载上 TTFT 相对 full prefill 降低 **2–4×**，同时在同硬件、同负载下与 CacheTune 的 3.72–4.86× 做对照；若低于该区间，需说明是负载/设置差异，还是可证明误差界的保守性所致。"),

# ---------- P5 ----------
("- 已有工作把问题表述为“算还是读”的联合调度 [arXiv:2410.03065]，但缺少尾延迟对冲。",
 "- Cake 已在单请求内把 KV 加载与计算切分并行，用双向调度动态平衡两者，并自适应非前缀请求 [arXiv:2410.03065]；但其目标是最小化平均 TTFT、提高资源利用率，不复制工作、不引入取消，也未对存储/网络尾延迟下的 SLO 违约建模。"),

("- 远端命中 0.88 s vs 重算 0.31 s；p99 从 3.96 s 涨到 17.3 s [arXiv:2610.21500]。",
 "- 远端命中 0.88 s vs 重算 0.31 s；16k token 的 p99 从 3.96 s 涨到 17.3 s [arXiv:2610.21500]。但该文的成本模型给出了更强的条件：命中只有在远端带宽超过 B* = sR（该模型/GPU 为 2.53 GB/s）、且 prompt 长于约 17k token 时才划算，更短的 prompt 在任何带宽下都赢不过重算；其 hit-heavy 流上 p99 83.32 s（GPU 仅 7% 忙）主要由同步加载与三个客户端 bug 造成，分片 + 异步加载后降至 0.67 s。"),

("Fetch 与 recompute 的延迟分布不同、资源不同（网络/SSD vs GPU），因此可以像“hedged requests”一样同时发起，先完成者胜出；代价是浪费一部分算力/带宽。关键是估计两者的完成时间分布，并控制对冲预算。",
 "Fetch 与 recompute 的延迟分布不同、资源不同（网络/SSD vs GPU），因此可以像“hedged requests”一样同时发起，先完成者胜出；代价是同时浪费一部分算力与带宽。对冲的收益条件必须显式给出：在 SLO 截止时刻 t_d，min(T_fetch, T_recompute) 的 p 分位需显著低于单独 T_fetch 的 p 分位，且 recompute 的尾延迟不严格劣于 SLO——若某类请求（如 <17k token，或带宽充足的长 prompt）已能稳定判定谁更快，就应直接选快者，而不是对冲。关键是联合估计两者的完成时间分布及其交叉点，并据此控制对冲预算。"),

("- 基线：静态分层、纯 recompute、纯 fetch、Mooncake 风格路由。",
 "- 基线：静态分层、纯 recompute、纯 fetch、Cake 式双向调度（按最优比例切分加载/计算）[arXiv:2410.03065]、Mooncake 风格路由。"),

# ---------- P6 ----------
("3. **遗忘与删除传播**：`forget(id | query | time_range)`；派生摘要/索引/embedding 的级联失效；crypto-shredding 用于合规删除。",
 "3. **遗忘与删除传播**：`forget(id | query | time_range)`；派生摘要/索引/embedding 经 `provenance_dag` 级联失效；**存储不变量**：所有持久化派生对象（摘要、embedding、倒排项）必须携带 `source_key_id`，并以源 key 派生的子密钥加密，销毁源 key 即 crypto-shred 其全部后代；不在该密钥树内的副本（备份、导出、第三方）必须登记为残余并单独处理。"),

("- vs Mem0/Zep/MemGPT：它们做检索/抽取，P6 做**事务与治理**；\n- vs GEM：GEM 是愿景，P6 是**可运行的系统 + 基准**；\n- vs 传统 DB：把“语义检索”与“事务/版本”结合，是新的数据模型。",
 "- vs Mem0/Zep/MemGPT：它们做检索/抽取，P6 做**事务与治理**——ACID 提交、MVCC 快照读、精确遗忘与多 agent 并发控制；\n- vs ChronoMem [arXiv:2607.27773]：它把每次写入提交为整库快照做语义回滚，P6 用 append-only WAL + 增量版本实现原子提交，并把整库快照的存储放大变成可量化、可 GC 的问题；\n- vs PolyMemDB [arXiv:2608.25577] / MOSS [arXiv:2607.04391]：前者覆盖 polyglot 存储 + 细粒度 provenance + 时间衰减，后者在关系库上做可审计检索，但都不提供事务原子性、派生数据删除传播与所有权/租户治理；P6 把这些纳入同一事务边界；\n- vs GEM [arXiv:2605.26252]：GEM 是愿景（四算子 + 六条件 + MemState 原型），P6 是**可运行的系统 + 基准**；\n- vs 传统 DB：把“语义检索”与“事务/版本”结合，是新的数据模型。"),

("- 精确遗忘达到 **100%**（含派生数据）；",
 "- 精确遗忘：在可定位副本范围内达到 **100%**，并显式列出不可删除残余类型（备份/导出/模型参数中的记忆）及各自的处理策略；在 Bemula 上报告删除精确率/召回率与端到端通过率，不把绝对 100% 作为对外承诺；"),

("- 基线：Mem0、Zep、文件式记忆、向量库 + 应用层事务。",
 "- 基线：Mem0、Zep、ChronoMem（版本/回滚）、文件式记忆、向量库 + 应用层事务；PolyMemDB 作为 provenance/时间衰减的参照实现（demo 论文，不承担事务基线）。"),

# ---------- P7 ----------
("- 每步异步检查点仍带来 +656.7% 延迟、32.5 GiB 主机内存、3.39 TB/hour 流量 [arXiv:2609.18178]。",
 "- 每步异步检查点的开销在 **1.216B decoder** 上实测为 +656.7% 延迟、32.5 GiB 主机内存、3.39 TB/hour 流量 [arXiv:2609.18178]；该测量规模远小于 671B/千卡级，仅用于说明“异步不等于免费”，不作为 671B 绝对流量的外推依据（671B 体积见上条 16 B/param 模型）。"),

("- 基线：PyTorch DCP、ByteCheckpoint、TierCheck、对象存储整文件。",
 "- 基线：PyTorch DCP、ByteCheckpoint、TierCheck、对象存储整文件；恢复时间另设 FFTrainer [arXiv:2512.03644] 为 SOTA 参照（摘要称最多降低 98% 恢复时间，但依赖剩余网络带宽、故障模型与 P7 不同，单列口径，不作跨论文换算）；写入放大另设 LLMTailor [arXiv:2602.22158] 与差分检查点 [arXiv:2509.04084] 为参照。"),

("- RTO 降低 **50%**；",
 "- RTO 降低 **50%**（相对 DCP/ByteCheckpoint/TierCheck/整文件基线；若与 FFTrainer 同场，限定在相同故障域并计入 manifest/GC 开销，或改报 FFTrainer 不覆盖的跨集群/级联故障域，不把其 98% 的 “up to” 当作下界）；"),

# ---------- P8 ----------
("- HuggingFace Xet 用 CDC 去重，但学术界几乎没有系统研究（`analysis/industry`）。",
 "- HuggingFace Xet 用 blob 级 CDC 去重，但不提供张量级变体语义与读时转码。\n- 运行时层已有系统研究：Tangram 用 GPU 内存池做张量级跨模型参数共享 [arXiv:2512.01357]，gKSM 在驱动层做权重去重 [arXiv:2610.25219]，ServerlessLoRA 让多个 LoRA 只读共享同一 backbone [arXiv:2505.14468]，TensorCast 提供张量生命周期抽象层并已与 vLLM/SGLang 集成评测 [arXiv:2608.06007]。缺口在**存储层**：跨变体的可寻址 delta、张量级内容寻址与读时转码尚无系统工作。"),

("- vs TensorCast：它提抽象，P8 做**实现与评测**。",
 "- vs Tangram/gKSM/ServerlessLoRA：三者在 GPU 显存、驱动、服务层做运行时共享，P8 在**存储层**做内容寻址与跨变体 delta，互补而非替代；\n- vs TensorCast：TensorCast 是运行时的张量生命周期层（已实现并与 vLLM/SGLang 集成评测），P8 做**持久化存储层的张量寻址、delta 与读时转码**。"),

("- 基线：safetensors 全量复制、Xet、OCI artifact。",
 "- 基线：safetensors 全量复制、Xet、OCI artifact、TensorCast 权重物化路径 [arXiv:2608.06007]。"),

("- 100 个 70B 变体从 14 TB 降到 **~144 GB**（约 100×，基座 + LoRA）；",
 "- 100 个 70B 变体从 14 TB 降到 **~181 GB（约 77×）**：按 1 份 fp16 基座 140 GB + 99 个 rank-16 all-linear LoRA（bf16，约 0.41 GB/个，共 ~41 GB）计；LoRA 取 rank-8/32 时分别约 160 GB（~87×）/222 GB（~63×）。"),

("- 冷启动降低 **30–50%**；",
 "- 冷启动降低 **30–50%**（基线：safetensors 全量复制；P-LoRA 的 68% 是 adapter 从 host 预取到 GPU 的口径 [arXiv:2512.20210]，不与本指标直接比较）；"),

# ---------- P9 ----------
("**一句话**：建立第一个覆盖“块级 trace、复用距离、多租户、故障注入、寿命”的 KV 存储基准，让不同系统第一次可以公平比较。",
 "**一句话**：建立第一个面向存储层的 KV 基准——覆盖块级 trace、复用距离、多租户、故障注入与寿命/TBW，补上 KVShareArena 等方法级评测、KV-Repurpose 等单系统 testbed 未覆盖的存储指标与跨系统比较。"),

("- 第一个**以 KV 为中心**的存储基准（区别于 MLPerf Storage 的训练视角）；",
 "- 第一个**以 KV 存储层为中心**的存储基准：KVShareArena [arXiv:2609.10266] 已为复用方法提供统一接口与 leaderboard，KV-Repurpose [arXiv:2610.13060] 提供 vLLM 上的单系统 testbed，Boxoffice [arXiv:2609.31415] 提供复用数据集生成；但三者均不测块级 trace、复用距离、寿命/TBW 与存储设备级故障注入，也不做跨系统排序；"),

# ---------- P10 ----------
("CXL 的价值不在“更快的 SSD”，而在**设备可参与语义决策**：设备知道哪些 chunk 会被消费、何时需要 resident、如何压缩。把 KV 语义下沉到设备，才能抵消链路带宽劣势。",
 "CXL 的价值不在“更快的 SSD”，而在**设备可参与语义决策**。但这一判断已由 LM-CXD 用“设备可见 chunk + NAND→DRAM 进度暴露 + 设备 DRAM 缓冲”实现（TTFT 相对 stock CXL-SSD 最高 4.03×），并由 TempoKV 用 claim/commit 实现；P10 不再把这两条机制当作自身创新，而是在其之上补两块空白：**多租户 QoS（带宽/容量配额、尾延迟隔离）**与**设备内 KV 专用压缩**，并给出“何时 CXL-SSD 值得”的判据。"),

("1. **设备可见 chunk**：KV chunk 作为一等 I/O 单元，暴露 NAND→DRAM 进度、resident 状态。\n2. **claim/commit 协议**：元数据认领 + 到期提交；设备维护受保护容量。",
 "1. **复用设备可见 chunk 接口**：采用 LM-CXD 的一等 I/O 单元、NAND→DRAM 进度与 resident 状态暴露，作为 P10 的基础层而非创新点 [arXiv:2609.26828]。\n2. **复用 claim/commit 协议**：采用 TempoKV 的元数据认领、到期提交与受保护容量语义；P10 仅新增跨租户的受保护容量仲裁 [arXiv:2609.35065]。"),

("- vs LM-CXD：它做单设备优化，P10 做**通用接口 + QoS + 多租户**；\n- vs TempoKV：它做时序，P10 做**设备语义与压缩**；\n- vs TRACE：它做压缩，P10 做**端到端 KV 引擎**。",
 "- vs LM-CXD：复用其设备可见 chunk 机制；P10 的增量是**多租户 QoS + 设备内压缩 + 端到端 KV 引擎**，不是设备接口本身；\n- vs TempoKV：复用其 claim/commit 时序语义；P10 的增量是**跨租户受保护容量仲裁与压缩感知的 commit 估计**；\n- vs TRACE：它做压缩原语，P10 做**压缩与 QoS 的联合调度**。"),

("- 基线：NVMe SSD、DRAM、stock CXL-SSD。",
 "- 基线：NVMe SSD、DRAM、stock CXL-SSD、**LM-CXD**、**TempoKV**（复现或按其公开配置对齐）。"),

("- 相对 stock CXL-SSD 提升 **2–3×**；\n- 尾延迟降低 **50%**；",
 "- TTFT 相对 stock CXL-SSD：在同配置（layerwise prefetch）下不低于 LM-CXD 的 **4.03×**；若负载导致绝对值不同，须给出 LM-CXD 在同一负载下的复现值作为对照，并解释差异来源；\n- 多租户 SLO：租户过载时 p99 TTFT 降低 **≥50%**，租户间有效带宽偏差 **≤10%**（LM-CXD/TempoKV 未覆盖的指标）；"),

("- 硬件可得性；\n- 厂商接口不统一；\n- 仿真与真实差距。",
 "- **设备侧可编程性（关键前置）**：设备可见 chunk、NAND→DRAM 进度上报、受保护容量与设备内压缩都要求改控制器/固件；现货 CXL-SSD 不暴露这些接口。缓解：M1–M3 评估 CXL-FPGA 原型链路，M4–M6 设 go/no-go gate；若不通过，退化为 host 侧 hint + 块层 QoS，不承诺 claim/commit 与设备内压缩。\n- **真实设备与厂商合作**：M15–M20 若要在真实 CXL-SSD 上验证，须提前锁定能提供固件/接口支持的厂商；否则硬件评测限定为 FPGA 原型 + stock CXL-SSD 基线。\n- **仿真与真实差距**：gem5+CXL 模型须用 FPGA 原型校准，分别报告仿真/原型/现货三档数字。"),
]

def build_pattern(old):
    parts = []
    for ch in old:
        if ch == '"':
            parts.append('["“”]')
        elif ch in '–—':
            parts.append('[-–—]')
        else:
            parts.append(re.escape(ch))
    return ''.join(parts)

t = open(P, encoding="utf-8").read()
ok = 0
for old, new in EDITS:
    pat = build_pattern(old)
    t2, n = re.subn(pat, lambda m: new, t, count=1)
    if n == 0:
        print("[MISS]", old[:55].replace("\n", " "))
        continue
    t = t2
    ok += 1
open(P, "w", encoding="utf-8").write(t)
print(f"applied {ok}/{len(EDITS)}")
