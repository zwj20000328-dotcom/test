# 存储层次与硬件协同（CXL/CSD/PIM）

## 1. 问题定义与为什么它是存储问题

自回归解码每 token 只做一次 GEMV 或扁平 GEMM，算术强度极低；而 KV cache 随上下文线性增长，长上下文下可与模型权重比肩甚至更大 [arXiv:2601.14260v1][arXiv:2608.28048v1]。因此瓶颈不是算力，而是"每 token 要从某处搬多少字节"。HBM 装不下时状态必须下沉，但 HBM 之下每一层带宽都低一到两个数量级：CXL 的链路与设备侧 DDR 带宽"远低于 HBM" [arXiv:2509.03377v3]；同一份 KV 在 NVLink 域内与跨数据中心 TCP 之间带宽相差 72 倍，NVLink 5 下扩大到 144 倍 [arXiv:2607.28633v2]。核心矛盾即：**容量在低层、带宽在高层，而访问是流式、可预测、复用距离不确定的**。

它成为存储问题而非纯网络或体系结构问题，理由有三。其一，被管理的对象是带生命周期与复用距离的数据块（KV block、expert 权重、Engram 表），本质是缓存—放置—驱逐问题。其二，胜负由"每 token 有效字节 × 每字节成本"决定，而非 FLOPS。其三，最优解强依赖地址空间语义——CXL 的 load/store 与 RDMA 的 one-sided verbs 给出完全不同的编程模型与失败模式，后者还存在"目标地址依赖远端数据"的间接墙 [arXiv:2606.13708v1]。还有一条被量化的二选一：主机内存取回相对重算最多快 100 倍，但只支撑"数十个"并发长上下文用户 [arXiv:2607.27187v1]——容量、带宽、并发三者不可兼得，这就是本方向要设计的帕累托面。关键指标因此是 TPOT、tokens/s/池、每 token 成本，以及"远端字节占比 × 远端有效带宽"。

## 2. 技术流派

### 2.1 CXL 共享内存池：用地址空间替代数据复制

核心思想：与其在 HBM 与主机 DRAM 间反复拷贝 KV，不如让 GPU 与 CPU 通过 CXL 访问同一份大容量内存，把"迁移"降级为"远端 load"，用避免拷贝与提高利用率来抵消远端延迟。

- [arXiv:2511.20172v2] Beluga: A CXL-Based Memory Architecture for Scalable and Efficient LLM KVCache Management。指出 HBM 容量受限、主机 DRAM 又受每 socket 内存通道数锁死，而 RDMA 分离内存池带来高延迟、复杂协议与同步开销；Beluga 让 GPU 与 CPU 共享大规模 CXL 内存来承载 KVCache（摘要在此截断，池化协议与替换策略未给出）。**结果：摘要未给出量化数字。**
- [arXiv:2603.10087v1] Pooling Engram Conditional Memory in LLMs using CXL。Engram 把静态知识查找与动态计算解耦，其嵌入表访问稀疏且可预取，适合下沉；相比 RDMA，CXL 的细粒度低延迟更匹配离散检索；方案集成进 SGLang。**论文声称**达到"接近 DRAM 的端到端性能"。局限：只适用于稀疏可预取的 Engram，稠密 KV 不满足该前提。
- [arXiv:2602.22457v3] CCCL: Node-Spanning GPU Collectives with CXL Memory Pooling。用 CXL 共享内存池做跨节点 GPU 集合通信以替代 RDMA，处理同步、数据交织与通信并行化三个问题；在 TITAN-II CXL switch 与 6 张 Micron CZ120 上评测。结果仅称"高效"，**摘要未给出倍数**。局限：依赖专用 CXL 交换硬件，摘要未给规模上限。
- [arXiv:2510.14580v1] ScalePool。XLink 负责簇内加速器低延迟通信，层次化 CXL 交换负责簇间一致内存共享，并显式两级化：tier-1 为延迟敏感的加速器本地内存 + 一致性 CXL/XLink，tier-2 为高容量层。摘要未给出实现与评测数字，属架构提案。
- [arXiv:2203.00241v4] Pond 是本流派的定量起点：跨 8–16 socket 池化即可拿到大部分收益，因此可做小池以压低延迟；并用 ML 模型预测 VM 的本地/池内存配比。

共同假设：远端访问的延迟惩罚能被"免拷贝 + 高利用率"抵消，且负载复用局部性足够强。失效场景：超长上下文单请求这类纯流式、一次性消费的 KV，池化只加延迟不产生复用；CXL 链路本身会成为新的争用点。

### 2.2 带宽放大：压缩、量化与布局变换

核心思想：下层带宽补不上，就让"逻辑字节"变少，或在同样字节里塞进更多有效信息。

- [arXiv:2509.03377v3] TRACE: Unlocking Effective CXL Bandwidth via Lossless Compression and Precision Scaling。观察到通用无损压缩直接作用于标准 word-major 张量基本无效，对 token-major 的 KV 流尤甚；TRACE 保持 CXL.mem 接口不变，只改设备内部表示——channel-major 的分离 bit-plane 布局，并在压缩前对 KV 做专用变换，把混合字段字转成低熵形式（摘要截断）。**结果：摘要未给压缩比或加速比。** 局限：需改控制器/设备内部，bit-plane 布局牺牲随机访问粒度。
- [arXiv:2407.15866v2] SmartQuant。权重重要度随上下文变化，可运行时配置量化；该工作让 CXL 内存控制器主动支持并利用可变精度，从而按比例降低访存字节与能耗，而不只是消费 GPU 的可变精度算术。摘要未给数字；控制器侧格式元数据开销未讨论。
- [arXiv:2601.14260v1] End-to-End Transformer Acceleration Through PIM 中的动态压缩与剪枝部分，也属同一逻辑，但局限于 PIM 架构内部，不与 CXL 层协同。

共同假设：KV/权重存在可压缩冗余（低熵字段、精度冗余）。失效场景：高熵激活与量化敏感层；更关键的是压缩/解压自身消耗的带宽与算力，在低算力 NDP 侧可能反成瓶颈。

### 2.3 近数据处理：把计算搬到数据旁

核心思想：搬权重比搬激活贵得多，于是把"冷"计算放到内存或存储侧执行，只回传结果。

- [arXiv:2404.02868v1] UDON。用 Arm AArch64 双路 NUMA 系统模拟 CXL type-2 设备，验证在 CXL 内存设备的通用核上卸载计算，并针对 ML 推理做模型分区。**论文声称**可把最多 90% 数据放在远端内存、仅付 20% 性能代价；HNSW 内核卸载最多 6.87× 提升，卸载开销低于 10%。局限：NUMA 模拟不等于真实 CXL；通用核算力有限，只适合粗粒度算子。
- [arXiv:2512.04476v1] Context-Aware MoE Inference on CXL-Enabled GPU-NDP Systems。MoE 专家权重超出 HBM 后必须外取；用 CXL-NDP 作卸载层，冷专家原地执行，把"参数搬运"换成更便宜的"激活搬运"；用 prefill 阶段激活统计指导 decode 阶段专家放置，热专家钉在 HBM，其余映射到 CXL-NDP；针对 NDP 算力有限引入上下文感知混合精度量化。摘要截断处未给数字。局限：依赖 PD 分离架构，专家放置的统计漂移未讨论。
- [arXiv:2502.07578v3] PIM Is All You Need。论证 LLM 解码算术强度低、batch 又受 KV 容量限制，而 GPU/TPU 为算力吞吐优化，二者错配；提出 CXL 使能的、无 GPU 的 PIM 系统。摘要未给数字。局限：全新硬件，编程模型与生态缺失。
- [arXiv:2412.15246v1] Accelerating RAG。剖析检索与生成阶段，发现精确检索虽贵却因缩小了送入生成的文档集而端到端更快；据此在 type-2 CXL 设备上实现 scale-out 近内存精确最近邻加速器。摘要未给倍数；结论依赖"精确检索能显著缩小文档集"这一前提。
- [arXiv:2607.26633v1] NELSSA。混合长度负载下短上下文路由到 GPU、长上下文路由到 PNM 层，并支持运行时迁移以避免重算。摘要未给数字。

其他工作：[arXiv:2207.05241v1] 在 4 块 SmartSSD 上加速 HNSW 图搜索；[arXiv:2002.07215v2] STANNIS 做存内训练，**论文声称**最高 2.7× 加速、能耗降 69%。另外，原清单中混入了核物理散射、化学传感器校准、崩溃报告等与本方向无关的条目，已剔除。

共同假设：被下沉的计算是"冷"的、访存密集但算力需求低，且搬移成本 > 远端正算成本。失效场景：热专家/热数据、NDP 算力不足以隐藏访存、需要全局同步的算子。

### 2.4 KV 生命周期与时序调度

核心思想：把"知道这份 KV 会被重用"和"现在就为它占住快速层容量"拆成两个决策。

- [arXiv:2609.35065v1] TempoKV: Timely Staging of LLM KV Caches for Memory-Semantic Flash。内存语义闪存给出 SSD 级容量加有限快层，但"逻辑命中"不等于"GPU 可取用"：按需 staging 暴露 SSD 延迟，立即 staging 又过早占用快层。TempoKV 把可复用 KV 的命中记为仅元数据的 claim，当"运行时估计的距取用时间"降到"存储估计的使其常驻并防驱逐所需时间"时才申请 commit，两个估计随运行时进展与 staging 状态自适应，commit 仍受受保护容量约束；在 vLLM 中实现（摘要截断）。**结果：摘要未给数字。** 局限：依赖可预测的取用时间，估计误差导致过早 commit 或 miss。
- [arXiv:2604.26968v2] Predictive Multi-Tier Memory Management for KV Cache。列出三重复合低效：缺少跨 attention 架构的统一 KV sizing（MLA 在通用框架中不被支持），**论文声称**导致最多 57× 内存过配；KV 被限制在单一层，而层次其实包含 CPU DRAM、CXL 内存、经 GPUDirect Storage 的 NVMe、RDMA fabric、并行文件系统；反应式驱逐丢弃可复用状态、迫使重算。方案是架构变体感知的精确 sizing 引擎加预测式多层管理。局限：单作者预印本，系统评测细节摘要未给出。
- [arXiv:2606.23521v1] Concordia。长时运行的 agent 把 KV、调度器状态、通信状态、在线 adapter 留在 GPU 上，故障即丢失数分钟到数小时工作；Concordia 用 GPU 常驻 persistent kernel 作 checkpoint 基底，拦截 GPU 模块加载并在 PTX/SASS 层挂钩，于设备同步点执行，恢复不把 host CPU 放到关键路径。摘要未给开销数字。

共同假设：KV 复用可被观测和预测。失效场景：首次请求与突发负载切换；预测错误的代价未被建模。

### 2.5 互连拓扑与内存侧可编程性

核心思想：层次不只是"远近"，更是"路径"；不同路径带宽差一个数量级以上，而远端访存需要新原语。

- [arXiv:2607.28633v2] Topology-Aware Data Movement for Disaggregated GPU Inference。PD 分离后 KV 必须跨池传输，70B 模型每请求 1.3 GB、生产规模聚合超 100 GB/s；但 DistServe、Splitwise、Mooncake 一律用 RDMA，忽略两 GPU 间带宽随物理关系变化 72×（NVLink 4.0 域内 900 GB/s，NVLink 5 的 1.8 TB/s 使差距达 144×；InfiniBand 跨节点 50 GB/s；TCP 跨数据中心 12.5 GB/s）。方案是启动时发现互连层级的编排器，按传输选路径，并用逐层流水与 prefill 重叠（摘要称隐藏 76 到……处截断）。局限：单作者预印本。
- [arXiv:2607.27187v1] A Photonic-CXL Memory Appliance。多代 GPU 与多种 LLaMA 的表征显示主机内存取回比重算快 100×，但只支撑数十个并发长上下文用户；电 CXL 池化受交换延迟、线缆长度与功耗扩展限制，难做 TB 级。遂以无源光纤 shuffle 的全交叉 bar 取代电交换，16 主机共享 32 TB，**emulation 中相对电 CXL 池延迟降超 50%**。局限：厂商器件论文，emulation/simulation 结果。
- [arXiv:2606.13708v1] Tiara。RDMA one-sided verbs 要求客户端给出精确远端地址，一旦目标地址依赖必须先读远端的数据，1-RTT 假设崩溃，称为 Indirection Wall；图遍历、多级页表、分布式协调、分离式推理的 paged KV block-table 查找均是此模式，每层间接多一次串行 RTT。Tiara 在内存侧 NIC 上运行紧凑、可静态验证的预注册程序 ISA。摘要未给数字；需可编程内存侧 NIC。
- 辅助：[arXiv:2409.05404v2] DFabric 指出 CXL 3.0 链路 256 GBps，比以太网/IB 高一个数量级以上；[arXiv:2507.07223v2] 提出以 CXL 为基的模块化数据中心与 hybrid CXL-over-XLink 设计。

## 3. 2025-2026 最新进展

近 12 个月的变化集中在四点。第一，**层次被重新定义**：讨论对象从"CPU DRAM 卸载"扩展到 CXL 池 [arXiv:2511.20172v2]、光子 CXL [arXiv:2607.27187v1]、内存语义闪存 [arXiv:2609.35065v1] 与跨节点 CXL 集合通信 [arXiv:2602.22457v3]，"远端"不再等于"主机内存或 RDMA"。第二，**从容量扩展转向带宽放大**：TRACE 明确打破"通用无损压缩能救 CXL 带宽"的假设，指出必须改设备内部表示与 KV 专用变换 [arXiv:2509.03377v3]。第三，**"命中即取用"与"统一 sizing"两个假设被打破**：TempoKV 用 metadata-only claim 与 commit 两阶段解耦时间维度 [arXiv:2609.35065v1]；多点分层工作指出 MLA 缺乏统一 sizing 造成最多 57× 过配 [arXiv:2604.26968v2]。第四，**NDP 从规则密集计算转向条件执行**：冷专家原地执行 [arXiv:2512.04476v1] 与无 GPU 的 PIM 推理 [arXiv:2502.07578v3] 打破了"PIM 只适合稠密 GEMM"的成见；同时 Tiara 指出 RDMA 原语在间接访问下的结构性缺陷 [arXiv:2606.13708v1]，Concordia 把 KV 当作需要持久化的执行上下文 [arXiv:2606.23521v1]。

## 4. 横向对比

| 代表工作 | 年份 | 存储层次 | 核心机制 | 声称收益 | 主要局限 |
|---|---|---|---|---|---|
| Beluga [arXiv:2511.20172v2] | 2025 | CXL 共享内存 | GPU/CPU 共享大容量 CXL 承载 KV | 摘要未给数字 | 协议与替换策略未披露 |
| TRACE [arXiv:2509.03377v3] | 2025 | CXL | 设备内 bit-plane 布局 + KV 专用变换 | 摘要未给数字 | 需改控制器，随机访问变差 |
| TempoKV [arXiv:2609.35065v1] | 2026 | 内存语义闪存 | claim/commit 两阶段时序提交 | 摘要未给数字 | 依赖取用时间可预测 |
| Predictive Multi-Tier [arXiv:2604.26968v2] | 2026 | 全层次 | 架构感知 sizing + 预测式多层管理 | 指出最多 57× 过配 | 单作者预印本 |
| Topology-Aware [arXiv:2607.28633v2] | 2026 | NVLink/IB/TCP | 拓扑发现 + 分层流水传输 | 带宽差 72×/144× | 单作者预印本 |
| Photonic-CXL [arXiv:2607.27187v1] | 2026 | 光 CXL | 无源光纤 shuffle 全交叉 bar | 延迟降 >50%（emulation） | 厂商仿真结果 |
| UDON [arXiv:2404.02868v1] | 2024 | CXL type-2 | 通用核近内存卸载 | 90% 远端数据/20% 代价 | NUMA 模拟 |
| CXL-NDP MoE [arXiv:2512.04476v1] | 2025 | CXL-NDP | 冷专家原地执行 | 摘要未给数字 | 依赖 PD 分离 |
| PIM Is All You Need [arXiv:2502.07578v3] | 2025 | PIM | 无 GPU 的 CXL-PIM 推理 | 摘要未给数字 | 生态缺失 |
| Tiara [arXiv:2606.13708v1] | 2026 | 远端内存 NIC | 内存侧可验证 ISA | 摘要未给数字 | 需可编程 NIC |
| Engram Pool [arXiv:2603.10087v1] | 2026 | CXL 池 | 稀疏嵌入表池化 | 接近 DRAM 性能 | 仅适用稀疏可预取 |
| Pond [arXiv:2203.00241v4] | 2022 | CXL 池 | 8–16 socket 小池 + ML 配比预测 | 摘要未给数字 | 通用云负载，非 LLM |

## 5. 对存储系统设计的启示

1. **把 KV block 做成一等存储对象，元数据与数据分离**。键至少需 (request_id, layer, head, token_range, version)，值需带复用距离与"可重算"标志；接口应提供 claim/commit 两级语义而非单一 read，让"知道会命中"与"占住快层"解耦 [arXiv:2609.35065v1]。
2. **sizing 必须由模型配置驱动，而非经验常数**。MHA/GQA/MLA 的 KV 形状差异可造成最多 57× 过配 [arXiv:2604.26968v2]，放置器应读取 attention 类型而非按最坏情况预留。
3. **压缩下沉到控制器且布局感知**。在 word-major 张量上做通用无损压缩无效；设备应暴露"逻辑张量视图"而保持 CXL.mem 接口不变，由设备内部完成 bit-plane 重排与字段分离 [arXiv:2509.03377v3]。
4. **为存储侧执行单元定义可验证的最小指令集**，而不是塞入完整 CPU。UDON 的通用核与 Tiara 的预注册程序代表两个极端，前者灵活但算力低，后者吞吐高但表达力受限；选择取决于下沉算子是"冷专家前向"还是"块表间接寻址" [arXiv:2404.02868v1][arXiv:2606.13708v1]。
5. **路径能力应作为可查询元数据暴露给编排器**。存储系统需报告每条 (src, dst) 路径的带宽、延迟、是否支持压缩/量化，供运行时按传输预算选路，并支持逐层流水与 prefill 重叠 [arXiv:2607.28633v2]。
6. **KV 需要版本化快照与 GPU 直写能力**。长时 agent 的 KV 是可恢复资产，checkpoint 应落在设备侧、不占 host CPU 关键路径，并支持从远端池直接恢复 [arXiv:2606.23521v1]；配套需要正确的 CXL I/O 总线位置建模以避免 cache pollution 误判 [arXiv:2603.29483v1]、以及 gem5+SST 的集群级仿真 [arXiv:2605.27745v1]。

## 6. 必读五篇

1. **Beluga [arXiv:2511.20172v2]**——CXL 池化承载 KV 的系统级基线，定义了"为什么主机 DRAM 通道数不够"这一出发点。
2. **TRACE [arXiv:2509.03377v3]**——唯一把"带宽放大"做成设备内部表示变换的工作，揭示了通用压缩失效的根因。
3. **TempoKV [arXiv:2609.35065v1]**——首次把时间维度显式引入分层 KV 管理，claim/commit 是可复用的接口范式。
4. **UDON [arXiv:2404.02868v1]**——近数据处理路线中量化最完整的一篇，给出了远端数据占比与性能代价的换算关系。
5. **Topology-Aware Data Movement [arXiv:2607.28633v2]**——用 72×/144× 的带宽差证明"存储层次"在集群尺度上必须按路径而非按距离建模。