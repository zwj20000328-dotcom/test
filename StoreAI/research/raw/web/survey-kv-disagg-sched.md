# KV 为中心的解耦架构与调度

> 本章条目全部取自给定检索清单，均为 arXiv 预印本（文件未提供会议信息）。摘要按 900 字符截断，摘要未覆盖之处标注"摘要未给出"。

## 1. 问题定义与为什么它是存储问题

LLM 推理的两个阶段有相反的 roofline：prefill 计算密集、几乎不吃 HBM 带宽，decode 带宽密集、算力闲置。PD 解耦把二者分到不同 GPU 池，消除了阶段干扰，却制造了一个新对象——KV cache 必须在两个池之间显式迁移。KV 是两阶段唯一的共享状态，于是它从"显存里的临时缓冲"变成"跨网络、跨存储层传输和驻留的持久负载"。

这带来三个放大效应。其一，KV 体积随 batch × context 线性增长，长上下文与 agentic 多轮让 context 持续变长。其二，KV 传输落在 TTFT 的关键路径上；[arXiv:2607.02043v1] 在 2P2D A100 集群上测得 prefill 执行只占 P95 TTFT 的 2–23%（论文声称），其余是排队与节点间 GPU-GPU KV 传输。其三，prefix 复用让 KV 有了生命周期，需要缓存、共享、淘汰与迁移。

因此这个方向具备存储系统的全部要素：放置、复制、一致性（prefix 版本）、迁移、淘汰、QoS 隔离与分层。它与经典存储只差一点，但很关键：KV 是派生数据，可以从 token 重算。这让"写回"可以让位于"重算"，也让替换策略的目标函数从命中率变成"重算成本 vs 搬运成本"。关键指标是 TTFT、TPOT（或 TBT）的尾部分位数、goodput、JCT，以及 KV 传输延迟与 prefix 命中率。

## 2. 技术流派

### 2.1 换介质：从 RDMA 到 CXL 共享内存
核心思想：KV 传输是解耦的物理瓶颈，先改传输介质，再谈调度。RDMA 路径必须过 NIC，这一跳被认为是根本开销。

- [arXiv:2512.18194v1] **TraCT: Disaggregated LLM Serving with CXL Shared Memory KV Cache at Rack-Scale**。用 CXL 共享内存同时充当 KV 传输底座与 rack-wide 的 prefix-aware KV 缓存，GPU 通过 CXL load/store 与 DMA 直接读写 KV block，从而"消除限制现有解耦流水线的 NIC hop"。局限：需要 rack 级 CXL 交换与共享内存池，跨 rack 不成立；量化收益摘要未给出。
- [arXiv:2501.14743v1] **KVDirect: Distributed Disaggregated LLM Inference**。指出既有系统因节点间通信低效而把解耦限制在单节点；提出 tensor-centric 通信机制降低分布式 GPU 的同步开销，并设计自定义通信库支持动态 GPU 资源调度与高效 KV 传输。局限：仍是显式整块搬运，没有改变传输粒度。
- [arXiv:2512.11920v1] **CXL-SpecKV**。把 KV 卸载到经 CXL 连接的远端 FPGA 内存，并用投机机制预测、预加载未来 token 的 cache 条目。局限：FPGA 内存容量与带宽受限，收益强依赖预测准确率；量化结果摘要未给出。
- 同流派还有 [arXiv:2510.27656v2] fabric-lib，用统一的 one-sided WriteImm 与 ImmCounter 完成通知屏蔽底层 NIC 差异，在 ConnectX-7 与 AWS EFA 上均达 400 Gbps（论文声称）。

共同假设：KV 是连续大块、必须整段搬运。失效场景很明确——稀疏注意力只需 top-k，跨厂商两端 KV 布局不同，跨数据中心带宽剧烈波动。

### 2.2 少搬：压缩、选择与稀疏取用
核心思想：不搬全部 KV。三条子路径分别是改表示、按重要性选择、按注意力稀疏性取子集。

- [arXiv:2502.03589v1] **HACK**。指出现有 KV 量化虽缓解传输与容量，却引入显著反量化开销、反而拖慢计算；HACK 让计算直接在压缩域进行以消除反量化。局限：有损，精度损失与收益数字摘要未给出。
- [arXiv:2605.13734v1] **KVServe**。观察到生产环境的 workload mix、带宽与 SLO/质量预算随时间变化，静态压缩配置可能次优甚至增加延迟；把压缩统一为模块化策略空间，并用 Bayesian Profiling Engine 搜索。局限：在线 profiling 自身的开销与冷启动。
- [arXiv:2607.28150v1] **SmartGen**。针对自托管云实例的节点间带宽瓶颈，在 prefill 阶段做 KV 选择、在 decode 阶段高效取回，设计三条数据传输路径。局限：选择精度与索引开销；量化收益摘要未给出。
- [arXiv:2606.19746v1] **SAC** 是这条线的极端形态：面向稀疏注意力，用 CXL 的 cache-line 粒度 load/store 只取 top-k 条目，避免 RDMA 系统"整段前缀拉回本地"的传输瓶颈与显存浪费（论文自称首个面向稀疏注意力的解耦 KV 系统）。

共同假设：KV 条目重要性可在线估计，且跨 prefill/decode 稳定。失效于需要精确注意力的任务，以及选择器自身的算力与延迟吞掉收益的情形。

### 2.3 KV 作为一等存储对象：内存池、分层与弹性
核心思想：把 KV 当持久对象管理，而不是每请求的临时缓冲。

- [arXiv:2406.17565v3] **MemServe**。提出 MemPool 弹性内存池，跨 serving 实例管理分布式内存与 KV，通过 MemPool API 首次把 context caching 与 disaggregated inference 结合，并用基于全局 prompt 树的局部性策略提升复用。局限：2024 年工作，未考虑 CXL 与稀疏注意力；摘要只写"显著改善 JCT 与 TTFT"，数字未给出。
- [arXiv:2608.08097v2] **OasisKV**。把 decode 期 KV 卸载到替代内存层，利用 decode 注意力稀疏性与投机解码预测重要 token，只把最相关条目预取并暂存到 HBM，以支撑更大的 batch 与更长的 context。局限：强依赖投机解码的命中率；量化结果摘要未给出。
- [arXiv:2608.23658v1] **Elastic KV Cache**。针对"启动时按最坏 prefill 预留的 activation 内存在 decode 期闲置"，用 CUDA 虚拟内存把两个物理 handle 映射为每层一个连续虚拟区间，decode 期借给 KV pool、prefill 前归还；decommit 数毫秒、recommit 数十毫秒（论文声称），兼容 CUDA graphs 与 prefix caching，且不触发 OOM。但标题本身就是结论：chunked prefill 已经关闭了这个 gap；摘要中的统计量被截断。
- 再往下一层是 [arXiv:2506.06769v1] DockerSSD，用容器化 in-storage processing、Ethernet over NVMe 与 virtual firmware 支持解耦存储池，I/O 密集负载提升 2.0x、分布式 LLM 推理提升 7.9x（论文声称）——KV 的下一层完全可以是 SSD。

共同假设：KV 生命周期跨请求、prefix 复用率高。失效于低复用、短请求与强隔离场景。

### 2.4 重划解耦粒度：从 P/D 到微请求与算子级
核心思想：prefill/decode 二分不是唯一粒度。

- [arXiv:2508.01989v1] **TaiChi**。先做对照：聚合在紧 TTFT + 松 TPOT 下最优，解耦在紧 TPOT + 松 TTFT 下最优，均衡 SLO 下两者都不是最优；于是用统一架构配合差异化能力的 GPU 实例同时支持两种模式。局限：需要异构实例池，切换成本摘要未给出。
- [arXiv:2504.09285v2] **DynaServe**。提出 micro-request 抽象，可在任意 token 边界把一个请求切成至多两个协作 segment，再由两级调度在统一 GPU 实例间均衡，全局调度器按代价选切分点。局限：切分带来 KV 复制/拼接与调度复杂度。
- [arXiv:2503.20552v1] **Adrenaline**。只把部分 attention 计算拆出去卸载，缓解"prefill 实例内存闲置、decode 实例算力闲置"的双向浪费。局限：attention 拆分引入额外通信。
- [arXiv:2605.28302v1] **Attention-FFN Disaggregation (AFD)**。把解耦推到算子级：MoE 下 attention 内存密集、expert FFN 计算密集、dispatch/combine 又是通信，工作把 attention 与 MoE-FFN 放到不同 GPU 组，并刻画"每一级解耦何时真正划算"。
- 一句话：[arXiv:2504.14489v3] MuxWise 做 GPU 内 P/D 复用；[arXiv:2504.19867v1] semi-PD 主张"计算按阶段解耦、存储统一"。

共同假设：阶段内部同质。失效由 [arXiv:2607.18002v2] ExpertPlex 给出：MoE 的 layerwise expert 负载在 kernel 内变化，固定分区会产生 head-of-line blocking 与预留资源闲置。

### 2.5 SLO 感知调度：配比、分块与准入
核心思想：解耦改变了排队结构，调度必须直接对 TTFT/TPOT 的尾部分位数负责，而非只调 P/D 实例比例。

- [arXiv:2608.06557v1] **Cascade**。指出同一 SLO 下请求的实际紧迫度可差数量级，定义 per-request latency budget 为 SLO 减去预测剩余服务时间，并据此持续更新分配。局限：依赖剩余服务时间预测。
- [arXiv:2605.02329v3] **Kairos**。针对长尾长度造成的 prefill head-of-line blocking 与 decode straggler，prefill 侧采用紧迫度优先级并预测完成时间；decode 侧的另一项机制在摘要中被截断。局限：预测误差直接转化为 SLO 违约。
- [arXiv:2609.07883v1] **SLOWeave**。把固定 chunk size 视为病根：小 chunk 保护 decode 却反复付 launch overhead，大 chunk 提高 prefill 效率却造成延迟尖峰；它在线选择"能在最早活跃 decode deadline 前完成的最大 chunk"，对单调迭代代价模型做对数时间搜索，并证明当 decode-only 迭代可行且代价预测准确时，在满足所有活跃请求下一 token deadline 的决策中最大化即时 prefill 进展。这是本批工作中少见的带证明结果。
- 一句话：[arXiv:2601.11589v2] LAPS 按 prompt 长度把多轮长 prefill 与短 prefill 分开并用双队列；[arXiv:2511.20982v3] DOPD 与 [arXiv:2505.11916v2] Arrow 按实时负载动态调整 P/D 配比。

共同假设：SLO 可分解为 TTFT 与 TPOT 两个标量。失效于 agentic 多轮（任务到达时总成本未知）与功率受限场景。

### 2.6 异构与跨域：把 KV 送到最合适的硬件
核心思想：与其把计算拉平，不如让 KV 去找最合适的硬件与地点。

- [arXiv:2606.29986v1] **HMA-Serve**。观察到 prefill 期 HBM 带宽几乎全闲置，于是用 GDDR 加速器做 prefill、HBM GPU 做 decode。推到最经济形态必然跨厂商，这打破单厂商解耦的两个默认假设：两端共享一种 KV 格式、共享一套软件栈。局限：KV 序列化与跨厂商数值一致性。
- [arXiv:2502.07903v1] **HexGen-2**。把异构 GPU 与异构网络上的解耦部署形式化为约束优化，用图划分求解。局限：偏离线规划，在线波动下重规划代价高。
- [arXiv:2604.15039v2] **Prefill-as-a-Service**。把边界推到跨数据中心：hybrid attention 显著缩小 KV 后跨集群传输变得可行；但负载突发、长度偏斜、prefix 缓存分布不均、集群间带宽波动，朴素地把 prefill 完全外部化仍会拥塞。
- 一句话：[arXiv:2509.17357v1] Cronus 在异构集群做部分解耦 prefill，初始段放低端 GPU、剩余 prefill 与 decode 重叠。

共同假设：网络同质且稳定。失效于跨域带宽波动与跨厂商 KV 格式差异。

**其他工作。** 可按主题一笔带过：能耗与功率（VoltanaLLM [arXiv:2509.04827v3]、DualScale [arXiv:2602.18755v3]、PowerSlider [arXiv:2608.21719v1]）、多租户延迟公平（FairInference [arXiv:2609.18112v1]）、检索与推理协同（Trinity [arXiv:2512.02281v1]、Chameleon [arXiv:2310.09949v4]）、agentic 与工作流调度（SARA [arXiv:2609.26763v1]、HexAGenT [arXiv:2605.16637v1]、HeteroPanacea [arXiv:2608.03741v1]）、阶段感知的加速器评测（[arXiv:2606.17104v1]）与综述（[arXiv:2506.21901v1]）。

## 3. 2025–2026 最新进展

过去 12 个月出现四次假设修正。

**介质从"网络"变成"内存语义"。** [arXiv:2512.18194v1]、[arXiv:2606.19746v1]、[arXiv:2512.11920v1] 三条独立工作线同时押注 CXL，粒度从 block 下沉到 cache line。这直接改变 KV 的数据结构：不再是可 memcpy 的连续大块，而是可按条目寻址的稀疏集合。

**聚合/解耦二分被打破。** [arXiv:2508.01989v1]、[arXiv:2504.14489v3]、[arXiv:2504.09285v2]、[arXiv:2504.19867v1] 都主张按 SLO 与负载连续切换；解耦粒度继续下沉到算子级（[arXiv:2503.20552v1]、[arXiv:2605.28302v1]）。

**实证给乐观叙事降温。** [arXiv:2506.05508v1] 在数十万个设计点上得出解耦只在 prefill-heavy 流量与较大模型上最有效，动态速率匹配与弹性伸缩才是 Pareto 最优关键；[arXiv:2609.16206v1] 用校准路由在 8 张 A40 上取得 goodput 0.864，而 round robin、least loaded 与长度启发式为 0.835–0.847（论文声称），差距并不悬殊；[arXiv:2607.02043v1] 显示 P95 TTFT 中 prefill 计算只占 2–23%。三者共同把"解耦收益来自计算隔离"改写成"收益主要来自排队与传输"，这正是存储层该发力处。同时 [arXiv:2608.23658v1] 以标题给出反例：chunked prefill 已补上预留给 prefill 的内存回收缺口。

**调度从启发式走向有保证的近似。** [arXiv:2610.15579v1] 把双侧内存准入形式化为 dual-memory request scheduling，证明强 NP-hard 并给出两个多项式时间近似算法；[arXiv:2508.06133v5] 在固定 KV 预算下证明最小化总延迟 NP-hard，并给出 Sorted-F 的常数因子近似；该保证限定在 unit-time、不中断解码且已知输出长度的理想模型下，摘要称其亦可扩展但扩展条件被截断。工作负载侧，agentic 把调度单元从单轮抬到 conversation（[arXiv:2606.01839v1]）与 workflow（[arXiv:2605.16637v1]），功率成为一等约束（[arXiv:2608.21719v1] 观察到 memory-bound decode 可降频至 0.57× 标称频率仍维持吞吐）。工业侧，[arXiv:2605.29639v1] RTP-LLM 报告在阿里服务超过 1 亿用户，采用分层多级 KV cache 管理。

## 4. 横向对比

| 代表工作 | 年份 | 存储层次 | 核心机制 | 声称收益 | 主要局限 |
|---|---|---|---|---|---|
| TraCT [arXiv:2512.18194v1] | 2025 | CXL 共享内存（rack） | CXL load/store + DMA 直读 KV，兼作 prefix 缓存 | 摘要未给出（称消除 NIC hop） | 需 rack 级 CXL |
| KVDirect [arXiv:2501.14743v1] | 2024 | 跨节点网络 | tensor-centric 通信 + 自定义通信库 | 摘要未给出 | 仍整块显式搬运 |
| HACK [arXiv:2502.03589v1] | 2025 | 传输层 | 同态压缩，免反量化 | 摘要未给出 | 有损，精度未说明 |
| KVServe [arXiv:2605.13734v1] | 2026 | 传输层 | 服务感知自适应压缩 + 贝叶斯搜索 | 摘要未给出 | 在线 profiling 开销 |
| SAC [arXiv:2606.19746v1] | 2026 | CXL 内存池 | cache-line 粒度取 top-k | 摘要未给出 | 依赖稀疏注意力 |
| MemServe [arXiv:2406.17565v3] | 2024 | 分布式内存池 | MemPool + prompt 树局部性 | 摘要未给出 | 未考虑 CXL/稀疏 |
| OasisKV [arXiv:2608.08097v2] | 2026 | HBM 以下多层 | 投机解码预测 + 稀疏预取 | 摘要未给出 | 依赖预测命中率 |
| Elastic KV [arXiv:2608.23658v1] | 2026 | HBM 虚拟内存 | 复用 prefill 预留区 | decommit 数 ms / recommit 数十 ms | 作者称 chunked prefill 已补齐 |
| TaiChi [arXiv:2508.01989v1] | 2025 | GPU 显存 | 聚合/解耦统一 | 摘要未给出 | 需异构实例 |
| Cascade [arXiv:2608.06557v1] | 2026 | 纯调度（无专用层次） | 每请求延迟预算 | 摘要未给出 | 依赖服务时间预测 |
| HMA-Serve [arXiv:2606.29986v1] | 2026 | GDDR + HBM | 跨厂商 KV 格式 | 摘要未给出 | 序列化/数值一致性 |
| DockerSSD [arXiv:2506.06769v1] | 2025 | SSD 内计算 | 容器化 ISP | 2.0x I/O；7.9x 分布式推理 | 面向通用 ISP，非纯 KV |

## 5. 对存储系统设计的启示

1. **KV block 元数据要扩容。** 现有 block 表只有 block id 与引用计数。KV 还需：prefix hash 与 token span、layer/head 范围、精度与压缩率、稀疏 mask 摘要（top-k 覆盖率）、recompute cost（重算该 prefix 的 FLOPs）、租约与 SLO class。没有 recompute cost 就无法做"重算 vs 搬运"的替换决策。
2. **接口从 bulk copy 改为 descriptor + sparse gather。** CXL 提供 cache-line 粒度 load/store，存储侧应能返回"这层的 top-k 行"而非整段；跨域回退 RDMA 时需要 one-sided 写加完成计数（fabric-lib 的 WriteImm/ImmCounter 是可复用抽象）。
3. **放置键用 prefix 树而非一致性哈希。** MemServe 的 prompt 树与 OasisKV/SAC 的 top-k 热集是两种键，应统一为"树位置 + 重要性"的二维放置；同一 prefix 的后代请求落在同一 CXL 域，可避免跨域重取。
4. **分层要有降级链而非单一副本。** HBM 全精度热集 → CXL DRAM 压缩全量 → SSD 上可计算的 ISP 副本（[arXiv:2506.06769v1] 报告分布式推理 7.9x）→ 远端集群。各层寻址粒度不同（page / cache line / 4K），降级需重排布局而非简单 memcpy。
5. **淘汰按 recompute cost 而非 LRU。** KV 是派生数据，驱逐后可由 token 重算；应比较"重算该 prefix 的代价"与"从下一层取回的代价"，取小者。这也是 chunked prefill 能与 KV 回收共存的原因（[arXiv:2608.23658v1]）。
6. **硬件与可观测性。** rack-scale CXL 内存池 + DPU 做压缩/转发（把 KVServe 的 profiling 下沉到近数据侧）；跨厂商需规范化 KV 序列化格式（HMA-Serve 的痛点）。调度器需要 KV 层一等指标：分层命中率、传输队列深度、top-k 覆盖率、每层 P99 延迟，否则 SLO 调度只能看到 GPU 侧。

## 6. 必读五篇

1. [arXiv:2512.18194v1] TraCT —— 把 CXL 同时用作传输底座与 prefix 缓存，是介质转向的代表。
2. [arXiv:2406.17565v3] MemServe —— 最早把 context caching 与解耦推理统一起来的系统，MemPool 让 KV 成为可调度存储对象。
3. [arXiv:2502.03589v1] HACK —— 把压缩与反量化开销绑在一起讨论，定义了有损 KV 的问题陈述。
4. [arXiv:2508.01989v1] TaiChi —— 用实验打破聚合/解耦二分，是理解"SLO 决定架构"的入口。
5. [arXiv:2506.05508v1] Beyond the Buzz —— 数十万设计点的大规模实证，校准对整个方向的预期。