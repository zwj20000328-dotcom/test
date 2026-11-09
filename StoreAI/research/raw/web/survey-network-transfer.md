# 数据移动、RDMA 与传输引擎

## 1. 问题定义与为什么它是存储问题

核心矛盾：算力与容量的增速远高于互连带宽的增速，而 LLM 的负载形态（长上下文、PD 解耦推理、MoE、RL 后训练）把"搬字节"从后台批处理推到了 token 的关键路径上。

三个把网络问题改写成存储问题的转变。其一，KV cache 成为新的存储对象。[arXiv:2606.01502v1] 指出前沿模型用 sparse-attention indexer 按 query 选 KV block，attention 的单元已经是"small, reusable chunk"；[arXiv:2505.13109v5] 明确 KV cache 随上下文线性增长是部署主瓶颈。既然它是块、可复用、有命中率，就必须有放置、复制、缓存与淘汰策略——这是存储系统的语言。其二，计算内存解耦后远端内存变成"下一层存储"：[arXiv:2603.13591v1] 把图索引向量检索搬到 disaggregated memory；[arXiv:2604.09107v2] 更激进，用 Reference-Oriented Storage 让权重"看起来被存着"而实际不存任何副本。其三，传输层被要求承担存储级语义：buffer 生命周期、注册、流控、故障恢复。[arXiv:2603.10030v2] 把这块缺失的层直接命名为 buffer orchestration。

关键指标随之改变：不再是带宽与 IOPS，而是 TTFT、单位 token 摊到的搬移字节数、p99 尾延迟，以及"搬移放大比"（一次 KV 传输服务多少下游请求）。解耦推理下 TTFT 的恶化被 [arXiv:2609.13161v1] 直接列为首要问题；尾延迟被 [arXiv:2512.22743v1] 视为 collective 的主要瓶颈。需要说明：本文件共 36 条记录，摘要统一截断在 900 字符，因此相当多工作只能给出方向性结论而无数值——这本身是该方向的证据特征。

## 2. 技术流派

### 2.1 把 KV 迁移当作一等公民来调度

核心思想：PD 解耦后 KV transfer 不是附带开销而是主导流量，必须由网络层做拓扑感知的显式调度，而不是交给 ECMP 与 TCP 碰运气。

- [arXiv:2610.41160v1] ARK: Avoiding Routing Collisions for KV Cache Transfer in Disaggregated LLM Inference。把 KV transfer 识别为 mega elephant flow——"last hundreds of milliseconds to seconds"，主导链路利用率；此 regime 下 stateless ECMP 的哈希碰撞会把流量压到单条 spine，把传输时间拉长"by seconds"。ARK 做 one-to-all 协调，让发送端挑选源端口，使并发流的哈希落到不同 spine，不改交换机、不要求接收端重排。结果段在"reduces mean an…"处截断，具体降幅摘要未给出。局限：收益依赖流的长寿命来摊销协调成本，短流场景前提不成立。
- [arXiv:2609.13161v1] PDD: Cross-Datacenter Prefill-Decode Disaggregation。三层结构 Prefill / RelayDecode(RLD) / MainDecode(MD)：Cluster A 完成 prefill 后 RLD 立刻经高速 RDMA 接走 KV 并开始解码，从而把到 Cluster B 的 TCP 广域传输重叠掉。本质是"用一层中继把 WAN 的 RTT 藏进解码时间"。摘要未给出量化结果，只给出动机（agentic 负载：长上下文、高命中、短输出，对 TTFT 极敏感）。局限：中继层要额外占用一份算力与一份 KV 副本，成本模型摘要未涉及。
- [arXiv:2610.29873v2] HAWK: Heterogeneity-Aware KV Cache Transfer。GPU 做 prefill、NPU 做 decode 的异构解耦。难点不在带宽，而在"inter-device communication mechanisms 与 KV cache tensor layouts 的差异"——传输前必须先做布局转换。收益数字摘要未给出。局限：把布局转换放进关键路径，等于用一次额外重排换取硬件利用率。
- [arXiv:2606.01502v1] Move the Query, Not the Cache。算术反转：MLA 把每 token 的 key/value 压成一个窄向量，被路由的 query 行仅 "~1 KB"，比它访问的 chunk 更小，因此跨实例时搬 query 往往比搬 cache 便宜。论文把"哪种原语在哪种 fabric、哪种请求形态下胜出"本身作为待测量的问题，摘要未给结论数字。
- [arXiv:2607.13095v1] MiMo-V2.5 全流水线优化。工程侧一整套：layerwise prefetch、SWA-aware prefix cache tree、专用 placement，实现严格 O(W) 的 SWA 存储与高命中；并自建 GCache 分布式缓存（RDMA 优化网络）与 KVCache-affinity router 以兼顾负载均衡。

共同假设：KV 流量足够长、足够可预测，所以值得显式协调。失效场景：短输出、高并发小请求，或并发流数远超 spine 数时，协调开销吞掉收益。

### 2.2 CPU 旁路与 SmartNIC 卸载

核心思想：稳态数据路径上的 host CPU 是纯开销，应把协议处理下沉到 NIC/DPU，并把数据直接投递进 GPU 显存。

- [arXiv:2509.13997v1] ROS2: An RDMA-First Object Storage System with SmartNIC Offload。把 DAOS client 卸载到 BlueField-3，服务端 DAOS I/O engine 保持不变；控制面用 gRPC 管命名空间与能力交换，数据面走 UCX/libfabric（RDMA 或 TCP），数据路径移除 host 中介。结论：在 server-grade CPU 上，RDMA 在大顺序与小随机 I/O 上都"consistently outperforms TCP"（论文声称，未给倍数；摘要截断于 end-to-end performance）。局限：绑定 BlueField-3 与 DAOS，卸载后的端到端收益未交代完整。
- [arXiv:2604.07609v1] Blink: CPU-Free LLM Inference。SmartNIC 接管请求处理并经 RDMA 把输入直接写入 GPU 内存，GPU 上常驻一个 persistent kernel 负责 batching、调度与 KV cache 管理，稳态路径完全无 CPU。声称在（截断处）优于 TensorRT-LLM、vLLM、SGLang，具体倍数摘要未给出。局限：编程模型与硬件强绑定，GPU 常驻 kernel 占用 SM。
- [arXiv:2203.08906v2] ORCA: Network and Architecture Co-design。以 one-sided RDMA write 加 cache-coherent memory write 统一机内/机间通信抽象，NIC 收到的请求直接交给 cache-coherent 加速器处理，并做 device-to-host 自适应。它今天被重新激活的理由很具体：其预设的缓存一致性互连正是 CXL 时代的前提。
- [arXiv:2603.10030v2] dmaplane。把 buffer orchestration 显式化为内核层：/dev/dmaplane、ring 命令通道、DMA buffer 生命周期、dma-buf 跨设备导出、内核态 RDMA engine、NUMA-aware 分配与校验、credit 流控、经 PCIe BAR pinning 集成 GPU 内存。它测 NUMA 跨节点惩罚、持续 RDMA 负载下的 completion-safe 流控、以及 BAR 映射层级对照 cudaMemcpy；摘要截断，数值未给出。
- [arXiv:2312.11742v1] ACCL+ 与 [arXiv:2402.02320v2] Spin 是两个外延：前者让 FPGA 之间直接做 collective（UDP/TCP/RDMA，且新增 collective 免重综合）；后者在 MPC 后端用 GPU、CPU 与 RDMA SmartNIC 协同，声称 DNN 训练最高 2x 于 SOTA。说明 RDMA 已溢出到非 serving 的数据面。

共同假设：卸载点的编程模型可接受、NIC 侧队列与内存预算充足。失效场景：需要强一致或复杂重排时，卸载把复杂度推到更难调试的位置。

### 2.3 为 ML 重构 RDMA 传输语义

核心思想：严格可靠、保序、重传是为通用负载设计的；ML 对少量丢失与乱序有容忍度，可以砍掉这些机制换尾延迟。

- [arXiv:2512.22743v1] OptiNIC。NIC 侧取消重传与保序，改为 best-effort、out-of-order，依据是"ML's tolerance for partial or missing data"；传统 RDMA 的完成语义也被替换。纯架构论文，量化收益摘要未给出。局限：需要训练侧配合（丢弃或近似），否则正确性无从谈起。
- [arXiv:2605.00686v1] Eliminating Hidden Serialization in Multi-Node Megakernel Communication。罕见的"精确归因回退"工作：megakernel 式 MoE 在单节点有效，多节点上 "communication-bound MoE models regress by up to 10× on 8 nodes"，且随节点数恶化。根因是 proxy-based RDMA transport 中每个 tile 传输与其完成信号之间的顺序要求强制一个 fence，排空 NIC 流水线，代价随并发传输数增长。
- [arXiv:2609.13585v1] mKernel。在 tile 粒度重叠计算、机内 NVLink 与机间 RDMA；把 SM 划分为 compute 与 communication 两种角色，并由 on-GPU controller 运行时自适应调整（最优划分随 kernel 与输入形状变化）。
- [arXiv:2603.13606v3] NCCL EP。基于 NCCL Device API 的 MoE 通信库，提供 ncclEpDispatch/ncclEpCombine；LL 模式针对 1-128 token 小 batch，用 direct all-to-all RDMA+NVLink mesh 加双缓冲重叠 dispatch 与 combine；HT 模式针对 4096+ token。价值在于给 GPU-initiated RDMA 一个稳定 API 面。
- [arXiv:2610.24328v1] SigmaTrace。在 libibverbs/mlx5dv 层做逐操作追踪，声称是首个无需改源码或二进制插桩即可观测 GPU-initiated RDMA 的工具；host 侧在 NCCL AllReduce 上仅增加 1.3% 开销（截断处）。
- [arXiv:2510.15882v1] FlexLink。把 NVLink、PCIe 与 RDMA NIC 聚合成单一 fabric，两阶段聚合；标题声称提升 27% 带宽且"without accuracy concern"，靶子是 H800 这类主互连成为瓶颈的硬件。

共同假设：上层能感知并利用弱化后的语义。失效场景：多租户或需要精确 SLA 归因时，best-effort 的调试成本反噬。

### 2.4 生产化：buffer、连接与恢复

核心思想：难的不是"换成 RDMA"，而是变长消息、并发连接、突发 incast 与故障恢复。

- [arXiv:2610.12815v2] ByteExpress（ByteDance 参数服务器推理与训练）。三条部署经验：RDMA 需要跨应用层与传输层的 buffer 管理；可扩展通信需要连接数、接收容量与 outstanding data 的协同管理；可用性需要传输层之上的恢复。实现对应 RDMA-aware allocator、zero-copy、QP 复用与 receive-credit 流控。
- [arXiv:2602.11456v2] AuroraRL。商品以太网/WAN 上做 RL：8B 模型全量同步"can take over 100~seconds"，而 rollout 仅需数十秒；观察到每步仅约 1% 参数元素变化，于是做稀疏同步并保持 bit-exact。用数据稀疏性替代带宽的典型。
- [arXiv:2510.12064v1] GeoPipe。无损 RDMA-enabled DC-OTN 上的多 DC 训练，在 Ascend 全栈内做增强流水并行，重叠计算与跨 DC 通信；摘要称降低 bubble ratio（数值处截断）。
- [arXiv:2604.23932v1] MatchRDMA。源端与目的端 OTN 速率协同的分段限速长距 RDMA，声称跨 DC 吞吐最高 20x 于常规 RDMA，目的端 OTN buffer 占用最多降低 62.7%。

共同假设：允许改应用层（allocator、序列化），而不只是换网卡。失效场景：多租户下 credit 流控的公平性难以保证。

### 2.5 存储抽象虚拟化：把"远端持有"当作"已存储"

- [arXiv:2604.09107v2] TensorHub / ROS。面向 RL 权重传输的 Reference-Oriented Storage：呈现"某版本权重已被存储、可按需取"的假象，底层不存任何副本，只跟踪哪些 worker 在 GPU 上持有，读请求直接由它们服务。规模表述为"terabyte-scale model weights across thousands of GPUs"。
- [arXiv:2604.22881v1] MTServe。生成式推荐的跨请求 KV 复用，单用户状态规模"far exceeds physical GPU limits"，故以 host RAM 作后备层，配 hybrid storage layout、异步传输流水线与 locality-driven 替换；论文声称最高 3.1x 加速且命中率 >98.5%。
- [arXiv:2603.13591v1] d-HNSW。首个面向 disaggregated memory 的 RDMA 向量检索，针对指针追逐的网格低效、动态插入造成的远端非连续布局、批量查询的冗余传输。它是判断"图索引这类非顺序访问能否跑在远端内存"的关键判据。

### 2.6 算法侧：先减少要搬的字节

- [arXiv:2507.11273v1] KV-Latent。把 KV 向量维度降采样进 latent 空间，只需不到 1% 预训练量的额外训练（论文声称），并改造 RoPE 的频率采样以稳定低维位置编码。
- [arXiv:2505.13109v5] FreeKV。推测式检索把 KV 选择与召回移出关键路径，加细粒度纠正保精度；系统侧用 CPU/GPU 混合布局。
- [arXiv:2510.11292v1] LouisKV。两个观察：关键 KV 在解码期具强时间局部性；KV 在 prompt 与 output 上分布不同。据此规避 per-token 检索与粗粒度 page 管理的双重瓶颈。
- [arXiv:2509.18344v2] Substitute Speculative Decoding。针对参数 offload 的无损免训练加速，用替代 draft 模型减少前向中的权重传输次数。
- [arXiv:2609.16161v1] LLM Inference in a Flash。compute-in-flash，把计算移近 SSD 以利用其容量，难点是这类设备缺乏高精度支持。

其他工作：[arXiv:2512.12284v3] V-Rex（流式视频的迭代 prefill 引发传输与访存压力）、[arXiv:2606.13740v1] llada.cpp（移动 NPU 地址空间受限导致重映射开销）、[arXiv:2601.14549v1] QMC（边缘 SLM 异构存储协同）、[arXiv:2601.20655v1] OnePiece（AIGC 流水线 one-sided RDMA 与双环 buffer 防死锁）、[arXiv:2609.18066v3] Apple Silicon 上的 RDMA-over-Thunderbolt 私有微调。检索卫生提示：[arXiv:2507.15867v2] 中的 "RDMA" 指 Rare Disease Mining Agents，与网络无关，应排除。

## 3. 2025-2026 最新进展

1. **从"搬 cache"到"搬 query / 搬中继"**。[arXiv:2606.01502v1] 用 MLA 的压缩比论证 1 KB 的 query 行可能比它访问的 block 更小，直接把"搬什么"变成可优化的决策；[arXiv:2609.13161v1] 则用 RelayDecode 把 WAN 延迟藏进解码。过去默认"KV 必须被搬到计算侧"的假设被打破。
2. **解耦边界外扩到跨 DC 与异构加速器**。GeoPipe、MatchRDMA、PDD 把 RDMA 推到 OTN 与广域以太网；HAWK 把 GPU-NPU 的 tensor layout 差异变成传输问题。专有 RDMA 集群不再是默认前提。
3. **传输语义按 ML 容忍度定制**。OptiNIC 取消重传与保序，NCCL EP 显式区分 LL/HT 两种 batch regime，说明"一种 RDMA 语义通吃"的时代结束。
4. **瓶颈从带宽转移到 buffer 生命周期与恢复**。[arXiv:2610.12815v2] 三条经验全部落在 buffer、连接与恢复上，而非带宽。
5. **存储抽象开始"不存数据"**。[arXiv:2604.09107v2] 的引用式存储是对"存储=副本"的正面挑战。
6. **可观测性成为一等需求**。[arXiv:2610.24328v1] 与 [arXiv:2605.00686v1] 一正一反：前者提供 GPU-initiated RDMA 的逐操作可见性，后者证明缺乏这种可见性时，megakernel 化会带来 10x 级隐性回退。

## 4. 横向对比

| 代表工作 | 年份 | 存储层次 | 核心机制 | 声称收益 | 主要局限 |
|---|---|---|---|---|---|
| ARK [arXiv:2610.41160v1] | 2026 | 网络（KV 传输） | 发送端选源端口，使 elephant flow 哈希分散到不同 spine | 摘要截断，降幅未给出 | 依赖长寿命流摊销协调 |
| PDD [arXiv:2609.13161v1] | 2026 | 跨 DC KV | Prefill/RLD/MainDecode 三层，RDMA 接 KV 并与 WAN 传输重叠 | 摘要未给出 | 中继层双份算力与 KV 副本 |
| HAWK [arXiv:2610.29873v2] | 2026 | GPU→NPU | 异构 KV 布局转换 + 设备间通信适配 | 摘要未给出 | 布局转换进入关键路径 |
| Move the Query [arXiv:2606.01502v1] | 2026 | 跨实例 KV | 路由 1 KB 级 query 而非搬 block | 摘要未给出（定性） | 仅对 MLA 类窄 KV 成立 |
| ROS2 [arXiv:2509.13997v1] | 2025 | 远端对象存储 | DAOS client 卸载至 BlueField-3，控制面/数据面分离 | RDMA 全面优于 TCP（无数值） | 绑定特定 DPU 与 DAOS |
| Blink [arXiv:2604.07609v1] | 2026 | GPU 显存 | SmartNIC 直写显存 + 常驻 GPU kernel 调度 | 优于 TRT-LLM/vLLM/SGLang（倍数未给出） | 硬件强绑定，占 SM |
| dmaplane [arXiv:2603.10030v2] | 2026 | 内核 buffer 层 | 统一 DMA buffer 生命周期、dma-buf 导出、credit 流控 | 摘要截断 | 单作者内核模块，生态风险 |
| OptiNIC [arXiv:2512.22743v1] | 2025 | NIC 传输层 | 取消重传与保序，best-effort 乱序 | 摘要未给出 | 需算法侧容错配合 |
| mKernel [arXiv:2609.13585v1] | 2026 | 机内+机间 | tile 粒度重叠，SM 角色运行时划分 | 摘要未给出 | 依赖 persistent kernel 生态 |
| NCCL EP [arXiv:2603.13606v3] | 2026 | GPU-initiated RDMA | LL(1-128 token)/HT(4096+) 双模式 dispatch/combine | 覆盖两个 batch 区间 | 仅 MoE 通信形态 |
| ByteExpress [arXiv:2610.12815v2] | 2026 | 生产传输层 | RDMA-aware allocator、zero-copy、QP 复用、credit 流控 | 摘要未给出（经验报告） | 与字节内部栈耦合 |
| MatchRDMA [arXiv:2604.23932v1] | 2026 | OTN 长距 | 源/目的 OTN 速率协同分段限速 | 吞吐最高 20x，buffer 占用 -62.7% | 需 OTN 可编程 |
| TensorHub/ROS [arXiv:2604.09107v2] | 2026 | 引用式存储 | 不存副本，跟踪 GPU 持有者并直接服务读 | 摘要未给出 | 持有者下线即数据不可用 |
| MTServe [arXiv:2604.22881v1] | 2026 | host RAM 后备 | 混合布局 + 异步流水线 + 局部性替换 | 最高 3.1x，命中率 >98.5% | 面向生成式推荐 |
| d-HNSW [arXiv:2603.13591v1] | 2026 | 远端内存 | 针对图索引重排远端布局，批量去冗余传输 | 摘要未给出 | 动态插入下布局维护成本 |
| KV-Latent [arXiv:2507.11273v1] | 2025 | KV 表示 | 维度降采样至 latent + RoPE 频率改造 | 额外训练 <1% 预训练量 | 有精度损失风险 |

## 5. 对存储系统设计的启示

1. **KV 元数据表应带 fabric 语义**。表项建议为 `{block_id, layout(含 MLA 压缩维), tier, holder_endpoint, version, reuse_count}`，让 "move query" 与 "move cache" 成为同一个调度器可比较的两个 op，而不是两套系统。这是 [arXiv:2606.01502v1] 与 [arXiv:2609.13161v1] 共同指向的接口形态。
2. **放置策略的权重应是"复用度 × 块大小"，而非时间局部性**。ARK 的 elephant flow 与 MTServe 的 >98.5% 命中率都说明收益来自同一 KV 被多少 query 复用；LRU 优化的是另一件事。
3. **传输 API 必须暴露完成语义等级**。参考 NCCL EP 的 LL/HT 双模式与 OptiNIC 的 best-effort，接口应带 `reliability ∈ {exact, lossy_tolerable}` 参数，并允许上层声明 tile 级依赖，避免 [arXiv:2605.00686v1] 中 proxy fence 排空流水线的隐性串行化。
4. **buffer 生命周期要进入接口契约**。dmaplane 的 dma-buf 导出、credit 流控与 NUMA 分配应成为客户端标准契约；ROS2 与 Blink 各自重造一遍的事实说明这层目前是缺失的公共基础设施。
5. **把 SmartNIC 的 SRAM 当作 KV 的 L3 来规划容量**。ROS2 卸载 DAOS client、Blink 卸载整条 serving stack，都表明 NIC 侧内存预算直接决定能挡掉多少 host 往返；容量规划应显式包含这一级。
6. **per-op 可观测性应内置**。SigmaTrace 的 1.3% 开销是可接受上限；megakernel 化之后若没有 GPU-initiated 路径的逐操作 trace，就无法定位 10x 级回退。

## 6. 必读五篇

1. **[arXiv:2610.41160v1] ARK** — 第一个把 KV transfer 正面当作网络调度问题处理，且论证了"流长"这一前提为何使协调可行。
2. **[arXiv:2606.01502v1] Move the Query, Not the Cache** — 提出"搬什么"本身是可优化决策，可能推翻跨实例 KV 系统的默认设计。
3. **[arXiv:2605.00686v1] Eliminating Hidden Serialization** — 唯一给出精确根因归因与 10x 量化回退的工作，是 megakernel 时代的必读反例。
4. **[arXiv:2509.13997v1] ROS2** — RDMA-first 存储中控制面/数据面分离与 SmartNIC 卸载的完整范式。
5. **[arXiv:2604.22881v1] MTServe** — 本批文献中量化最干净（3.1x / >98.5%）的层次化 cache 工作，可直接作为基线。
