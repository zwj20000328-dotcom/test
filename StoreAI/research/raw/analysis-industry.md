# 工业界采用地图：谁把什么放在哪一层存储

> 依据早期 15 份结构化调研 + 工业界官方 README/文档（Mooncake、LMCache、SGLang 等已用 GitHub API 实测核验）。可信度标注：**A1** 官方一手（博客/技术报告/开源文档/定价页）；**A2** 同行评审论文；**B** 厂商宣称、无独立复现；**C** 二手转述或记忆，勿直接引用；**D** 本文推断。跨厂商、跨论文的绝对数字不可直接比较。

## 0. 结论速览

1. **KV Cache 已成为继训练样本、checkpoint 之后的第三个一等存储对象**。Mooncake、NVIDIA Dynamo/KVBM、LMCache、CachedAttention 的共同点不是"offload"，而是把 KV 变成可寻址、可分层、可迁移、可持久化的数据。
2. **推理侧的事实标准是 HBM → DRAM → 本地 NVMe → 远端池四级**，但必须区分两种 KV 工作负载：**decode 工作集**（每 token 全量读，只能在 HBM/DRAM）与 **prefill 复用缓存**（写一次、按请求复用，可下沉 SSD/远端）。很多论文把二者混为一谈，导致对 SSD 带宽的估计错误。
3. **训练侧架构收敛到"无状态元数据 + RDMA + NVMe + 链式复制/纠删码"**：DeepSeek 3FS、字节 vePFS、Meta Tectonic、Google 的 GCS+FUSE 缓存，是同一组取舍的不同配比。
4. **checkpoint 从"写文件"变成"带 manifest 的分布式数据集"**：ByteCheckpoint、PyTorch DCP、NeMo Universal Checkpoint 支持并行度无关的在线 resharding。工业界真正难的是 GC、保留策略、跨集群迁移、对象存储原子提交，学术界研究很少。
5. **模型分发正在被内容定义分块（CDC）去重重构**：Hugging Face Xet 为代表，safetensors 已是事实标准。学术界几乎没有"模型仓库/模型供应链"的系统研究。
6. **存储厂商与推理框架正在争夺 KV Cache 的命名空间**：NVIDIA 用 Dynamo/KVBM/NIXL 把 KV 层收进推理栈，WEKA 用 Augmented Memory Grid 把 KV 层拉进文件系统。谁定义 KV 的寻址与生命周期，谁掌握下一层话语权。
7. **工业界真正领先学术界的是"暗知识"**：prefix cache 的哈希链与碰撞兜底、多租户配额、缓存失效、SSD 写放大与寿命、可观测性指标、TCO 归因。论文几乎不写，但决定能否上线。
8. **数字可信度分层极明显**：3FS 6.6 TiB/s、Mooncake 525%、MegaScale 55.2% MFU 属官方/论文口径；Dynamo 30x、CPFS TB/s、OceanStor 百万 IOPS 属厂商宣称；"Llama 3 训练 SSD 故障占 17%"属二手记忆，不应引用。

## 1. 口径、冲突与处理

| 级别 | 含义 | 例子 |
|---|---|---|
| A1 | 官方一手 | 3FS 6.6 TiB/s、Anthropic prompt caching 定价、Xet 设计文档 |
| A2 | 同行评审 | Mooncake FAST 2025、MegaScale NSDI 2025、Splitwise ISCA 2024 |
| B | 厂商宣称 | Dynamo 30x、CPFS 集群 TB/s、OceanStor 百万 IOPS |
| C | 二手/记忆 | "Llama 3 训练 SSD 故障 17%" |
| D | 推断 | "SSD 层主要服务 prefill 复用，而非逐 token decode 读" |

看数字先问四件事：负载是什么（数据加载/checkpoint/prefill/decode/多轮复用）；baseline 是什么（不用缓存/单机 vLLM/上一代产品）；硬件与网络是什么（RDMA/NVLink 有无能让结论反转）；是单客户端还是集群聚合（3FS 6.6 TiB/s 是 180 节点聚合读，不是单机）。

**原始文件冲突处理**：

| 条目 | 冲突 | 处理 |
|---|---|---|
| DistServe 收益 | 7.0x/4.5x vs 7.4x/12.6x | 采用 **7.4x 请求率 / 12.6x SLO**（论文摘要），另一组视为记忆偏差 |
| CachedAttention 会议 | ATC 2024 vs FAST 2024 | 采用 **USENIX ATC 2024** |
| CachedAttention 署名 | NUS+华为云 vs MSRA+NUS | 存疑，两者并列，不影响机制判断 |
| 3FS 发表状态 | FAST 2025 vs 无正式论文 | 按 **官方开源文档 A1**；FAST 2025 未证实 |
| ByteCheckpoint venue | arXiv 2024 / ICLR 2024 / NSDI 2025 | **venue 未定**，只引机制 |
| MegaScale 会议 | NSDI 2024 vs 2025 | 采用 **NSDI 2025** |
| Mooncake 收益 | 525% vs 75% | **真实 trace 525%，合成负载 75%**，两个口径并列 |
| Llama 3 SSD 故障占比 | 记忆约 17% | 标 **C 级勿引用**，只引 419 次中断/54 天 |

## 2. 存储视角：七类工作负载

| 工作负载 | 访问模式 | 主要瓶颈 | 合适介质 | 代表系统 |
|---|---|---|---|---|
| 训练数据加载 | 大块顺序读 + 随机小读混合 | 聚合带宽、元数据、尾延迟 | 并行 FS / 对象+缓存 / 本地 NVMe | 3FS、vePFS、Quiver、tf.data、WebDataset |
| Checkpoint | 突发大顺序写 + 恢复时范围读 | 写带宽、原子性、重分片 | 本地 NVMe → 并行 FS → 对象 | ByteCheckpoint、DCP、CheckFreq、Gemini |
| 模型加载 | 只读、按 tensor range 读 | 冷启动延迟 | 本地 NVMe / 对象 + CDN | safetensors、ServerlessLLM、Xet |
| Prefill KV 复用 | 写一次、按请求复用读 | 容量、命中率、TTFT | DRAM / SSD / 远端池 | Mooncake、CachedAttention、LMCache |
| Decode KV 工作集 | 每 token 全量读 | HBM 带宽、容量 | HBM / DRAM | PagedAttention、InfiniGen、Quest |
| 向量检索 | 随机小块读 + 图遍历 | SSD IOPS、尾延迟 | SSD（内存只放元数据/量化码） | DiskANN、SPANN、SPFresh |
| Agent 记忆 | 追加写 + 随机读 + 更新 | 元数据、一致性、隔离 | SSD / 对象 / 图数据库 | Mem0、Zep、Anthropic memory tool |

**关键区分（本文最重要的存储判断）**：

| 维度 | Prefill 复用缓存 | Decode 工作集 |
|---|---|---|
| 访问 | 写一次，跨请求复用读 | 每 token 全量读 |
| 容量 | TB–PB 级 | 单请求 GB 级 |
| 带宽 | 中（按请求摊销） | 极高（每 token） |
| 可放层 | HBM/DRAM/SSD/远端 | 仅 HBM/DRAM |
| 指标 | 命中率、TTFT | 带宽、延迟 |
| 淘汰 | LRU/TTL/价值感知 | 活跃请求不可淘汰 |

数量级速算（D）：70B 模型、80 层、8 个 KV head、head_dim 128、FP16，每 token KV ≈ 320 KiB；128K 上下文单请求 ≈ 40 GiB，32 并发 ≈ 1.3 TiB。decode 每 token 读 40 GiB，若从 SSD 以 10 GB/s 读需 4 秒/token，完全不可行。因此 **SSD/远端 KV 层只可能服务 prefill 复用与冷容量，不可能承担 decode 的逐 token 读**；decode 必须靠 HBM/DRAM、稀疏化或检索。

**推理 KV 放置矩阵**：

| 玩家 | HBM | 主机 DRAM | 本地 NVMe | 远端池 / 分布式 FS | 对象存储 | 关键系统 |
|---|---|---|---|---|---|---|
| NVIDIA | 权重+热 KV（KVBM L1） | KVBM L2 | KVBM L3 | NIXL over RDMA/NVLink；KV-aware router | 模型权重流式加载 | Dynamo、KVBM、NIXL、TensorRT-LLM |
| DeepSeek | 活跃 KV | 推理侧 KV | 3FS 管理的 NVMe | 3FS 集群（KVCache 读路径） | — | 3FS、PD 分离、DeepEP、MLA |
| Moonshot | 活跃 KV | 全局 KV 池 | KV 池 SSD 层 | Transfer Engine P2P | — | Mooncake、Conductor、Transfer Engine |
| 阿里 | 活跃 KV | KV 缓存 | 本地盘 | Llumnix 活迁移；CPFS | OSS | CPFS、Llumnix、PAI/灵骏 |
| 字节 | 活跃 KV | KV/专家权重 | 本地 NVMe | vePFS；MegaScale-Infer token all-to-all | TOS | vePFS、ByteCheckpoint、MegaScale |
| 华为 | 昇腾 HBM | DRAM | 本地 NVMe | CloudMatrix UB 池化内存；OceanStor | OBS | OceanStor、MemServe、CloudMatrix |
| Google | TPU HBM | DRAM | GCS FUSE 本地缓存 | Filestore / Managed Lustre | GCS | gcsfuse、Anywhere Cache、OCS |
| Microsoft | HBM | DRAM | 本地 NVMe | CXL 池（研究）；Managed Lustre | Azure Blob | Splitwise、Pond、DeepSpeed |
| Meta | HBM | DRAM | 本地 NVMe | Tectonic | — | Tectonic、DCP |
| Anthropic/OpenAI | 不公开 | 不公开 | 不公开 | API 级前缀缓存 + 文件命名空间 | 不公开 | prompt caching、memory tool |

## 3. 玩家逐个分析

### 3.1 NVIDIA：把存储抽象成"传输描述符"

**架构要点**：HBM（权重 + 热 KV，KVBM L1）→ 主机 DRAM（KVBM L2）→ 本地 NVMe（KVBM L3）→ 远端（NIXL 统一 RDMA/NVLink/TCP/GDS 后端，KV-aware router 按命中路由）。模型权重从对象存储经 GDS/NIXL 流式读入 GPU。NVIDIA 不自建分布式文件系统，而是与 WEKA/VAST/DDN/Lustre 合作，用 GPUDirect Storage（cuFile）打通"存储→GPU HBM"零拷贝路径。自研栈：Dynamo、KVBM、NIXL、TensorRT-LLM、GDS/cuFile、BlueField DPU、NeMo Universal Checkpoint、CAGRA/cuVS。GB200 NVL72 把 72 GPU + 36 Grace CPU 连成单一域（130 TB/s 聚合 NVLink、1.8 TB/s/GPU、8 TB/s HBM/GPU、180–192 GB HBM/GPU）。

**公开数字**：Dynamo 在 GB200 NVL72 上服务 DeepSeek-R1，宣称吞吐最高 **30x**（baseline 未明，**B**）；NVL72 聚合带宽 **130 TB/s**（规格，**A1**）；GDS 相比 CPU 中转约 **2x**（厂商白皮书，**B**）。无独立第三方 Dynamo 复现。

**仍未解决**：多级 KV 的 SSD 写放大与寿命；跨节点 KV 一致性；多租户隔离；生态强绑定；缺开放、可复现的 KV 基准。

**研究启示**：存储接口正在从"文件/对象路径"退化为"**可 RDMA 注册的 buffer + 异步完成描述符**"（NIXL 的 memory section + transfer descriptor）。KVBM 的分层/淘汰策略是黑盒，学术上可研究"KV 分层的最优策略与代价模型"；GDS 只是路径，不是放置策略；机架级统一显存（NVL72）改变了 KV 放置与复制的设计空间。

### 3.2 DeepSeek：用一套 3FS 统一训练数据、checkpoint 与 KVCache

**架构要点**：3FS 元数据基于 FoundationDB（事务型 KV），数据用 CRAQ 链式复制保证强一致读，全链路 RDMA，客户端提供 USRBIO 用户态共享内存环 + FUSE 兼容两种路径；Fire-Flyer 2 用约 2 万张 PCIe A100 + 200G IB，以存储/网络补互连短板；DeepEP 做 MoE all-to-all；MLA 在架构层把 KV 压成低秩 latent。

**公开数字**：180 存储节点聚合读 **6.6 TiB/s**（**A1**，官方 3FS 文档；写约 3.9 TiB/s 为记忆，标 A1/待核）；GraySort 以 **3.66 TiB/min** 排序 110.5 TiB（**A1**）；KVCache 场景单节点读 **40+ GiB/s**（**A1**）；DeepSeek-V2 MLA 使 KV 减少 **93.3%**、吞吐 **5.76x**、训练成本 **-42.5%**（技术报告，**A1**）；V3 在 2048 GPU 上训练 14.8T tokens、两个月无不可恢复故障（**A1**）。

**仍未解决**：强依赖 RDMA 与 FoundationDB 运维；多租户隔离与跨数据中心弱；3FS 缺正式同行评审论文；线上 KV 命中率、SSD 寿命未公开。

**研究启示**：按**读带宽而非容量**设计存储；用户态零拷贝 API（USRBIO）是可行路径；元数据用事务型 KV；强一致读用链式复制；"训练数据与 KVCache 共池"是一个统一命名空间赌注；架构级压缩（MLA）会直接改写存储需求模型。

### 3.3 Moonshot/Kimi：KVCache 中心化调度的标杆

**架构要点**：Mooncake（FAST 2025）把 prefill 与 decode 拆成独立资源池；全局 KVCache 池跨 GPU/DRAM/SSD 分层；Conductor 按缓存命中、负载与 SLO 做全局调度；Transfer Engine 支持 RDMA/NVLink/TCP 多路径零拷贝；TTL 淘汰 + 预测式早期拒绝；生产 Kimi 集群。

**公开数字**：真实 trace 下满足 SLO 的请求数提升最高 **525%**，合成负载 **75%**（**A2**，FAST 2025）；日处理 **100B+ tokens**、200+ 节点、部分场景缓存命中率 **>50%**（**A1/A2**，具体数字为记忆，需核）。

**仍未解决**：全局元数据服务的扩展性；短请求/低复用场景收益有限；TTL 对突发复用不友好；跨数据中心；SSD 寿命；租户隔离；模型更新后的缓存失效。

**研究启示**：**KV 放置本身就是调度问题**——缓存位置应成为路由的一等输入；TTL 与 early rejection 是存储准入控制；需要全局 KV 目录服务；SSD 层主要承担 prefill 复用与冷容量，不承担 decode 每 token 读。

### 3.4 阿里：云上"POSIX 性能层 + 对象容量层"

**架构要点**：CPFS（元数据/数据分离的并行文件系统，POSIX + RDMA）承载热训练数据，OSS 做容量层，PAI/灵骏做调度；Llumnix（OSDI 2024）在实例间做请求级动态重调度与 KV 活迁移（增量预拷贝 + 脏块同步）；HPN（SIGCOMM 2024）用双上联两层网络替代三层 CLOS；Data-Juicer（SIGMOD 2024）做 LLM 数据流水线；FaaSNet（ATC 2021）做分块惰性拉取 + P2P 分发。阿里云 Tair 有面向 LLM 的 KVCache 形态（公开材料少，低置信）。

**公开数字**：CPFS 单客户端数十 GB/s、集群 TB/s、百万 IOPS（**B**，厂商）；Llumnix JCT 改善约 1.5–2.3x（**A2**，记忆）；HPN 支持 8k GPU、吞吐约 +10%（**A2**，记忆）；FaaSNet 供给延迟 2–3x 改善（**A2**）。

**仍未解决**：公开架构论文少；CPFS 跨 AZ 一致性与延迟；多租户 QoS；缺少跨 PAI 的全局 KV 池。

**研究启示**：云厂商路线是"POSIX 性能层 + 对象容量层 + 调度集成"；KV 活迁移等价于虚拟机内存预拷贝，需要增量快照与脏页追踪；网络拓扑（双上联）会约束数据放置。

### 3.5 字节：checkpoint 与 MoE 专家权重的工业化

**架构要点**：vePFS（全闪性能层 + 对象容量层，元数据/数据分离，RDMA，POSIX/CSI）；TOS 对象存储；ByteCheckpoint 用并行度无关的统一格式做在线 resharding 与异步保存；MegaScale（NSDI 2025）做万卡全栈协同；MegaScale-Infer 把 attention 与 expert(FFN) 拆池，token 级 all-to-all；DLRover 做弹性容错；HybridFlow/verl 做 RLHF 数据流。

**公开数字**：MegaScale 在 **12,288 GPU** 上训练 175B 达 **55.2% MFU**，较 Megatron-LM **1.34x**（**A2**）；MegaScale-Infer 每 GPU 吞吐 **1.9–2.7x**（**A1**，arXiv）；vePFS 宣称集群 TB/s、千万级 IOPS（**B**）；ByteCheckpoint 保存/加载数倍提升（**B**，venue 未定）。

**仍未解决**：vePFS 闭源、缺公开评测；checkpoint 跨集群迁移语义；存储 QoS；MoE 专家权重的换入换出与预取。

**研究启示**：checkpoint 应建模为"**可重分片的分布式数据集 + manifest**"，而非整文件；MoE 专家权重是典型的冷热分层对象；存储调度必须带宽感知；存储与训练框架必须联合设计。

### 3.6 腾讯：公开信息最少，但有两个可用的存储锚点

**架构要点**：VBase（OSDI 2023）用 relaxed monotonicity 统一向量近邻与关系谓词查询，本质是"两个索引之间的迭代器契约"；GooseFS 是开源的分布式缓存文件系统，用于数据湖/训练加速；底座是 COS 对象存储 + CFS 文件存储；腾讯云向量数据库。LLM 训练/推理的存储架构未见公开细节。

**公开数字**：VBase 相比"先向量后过滤/先过滤后向量"延迟降低数倍（**A2**，记忆）；其余无可靠公开数字。

**仍未解决**：几乎全部（KV 分层、checkpoint、模型分发均无公开材料）。

**研究启示**：混合查询的迭代器契约是存储索引接口的好抽象；缓存层（GooseFS）是对象存储与训练之间的桥；对腾讯不宜过度推断，本文只把它作为"向量+关系混合"的工业证据。

### 3.7 华为：存储厂商 + 芯片厂商的垂直整合

**架构要点**：OceanStor A800/A3 全闪、NVMe over RoCE、多协议（NFS/S3/POSIX）、Data Fabric；昇腾 + CANN + MindSpore/MindIE；CloudMatrix 384 用 UB 统一总线把 384 颗芯片组成超节点，做内存统一编址与池化；MemServe（arXiv 2024）提出集群级 Elastic Memory Pool，把 KV 作为全局可寻址对象；CachedAttention 有华为云/NUS 署名说法（存疑）。

**公开数字**：OceanStor 宣称百万级 IOPS、TB/s 带宽（**B**）；CloudMatrix 宣称部分指标优于 GB200 NVL72（**B/C**，公开有争议）；MemServe 只有定性结果。

**仍未解决**：第三方基准稀缺；CANN 生态锁定；跨厂商 GDS 兼容；池化内存的软件栈与 RAS 成熟度。

**研究启示**：存储厂商与芯片厂商垂直整合，能把"存储 QoS + 内存池化 + 推理框架"一起设计；内存池化模糊了内存与存储边界，需要新的内存语义接口、一致性与故障隔离；企业存储必须吸收 checkpoint 突发写与 KV spill；多协议统一命名空间是企业客户的硬需求。

### 3.8 Google：对象存储 + FUSE 缓存 + 光交换

**架构要点**：TPU v4（ISCA 2023）用 4096 芯片 pod + 128x128 MEMS OCS 按作业重构 3D torus；Pathways（MLSys 2022）单控制器异步数据流；GCS 对象存储 + gcsfuse（POSIX 子集、元数据缓存、本地文件缓存、Anywhere Cache 区域读缓存）+ GKE CSI；Filestore/Managed Lustre 补 POSIX 性能层。Gemini 的推理/KV 存储架构未公开。

**公开数字**：TPU v4 较 v3 **2.1x**（**A2**）；gcsfuse 调优后可达本地 SSD 约 **90%** 读吞吐（**B**，官方博客，版本相关）；无公开 KV 架构数字。

**仍未解决**：OCS 重构延迟与故障恢复；GCS 随机小 IO 与元数据开销；推理 KV 分层未公开。

**研究启示**：对象存储 + FUSE 缓存是云上 AI 数据的默认范式，但写路径与随机小 IO 有明确上限；拓扑（OCS）应被视为可调度资源，存储放置要拓扑感知；"把对象存储伪装成本地盘"适合读多写少的训练数据，不适合 checkpoint 主存储。

### 3.9 Microsoft：TCO 驱动的存储研究到产品管线

**架构要点**：Azure Blob/Managed Lustre/Azure AI 为底座；DeepSpeed ZeRO-Infinity（SC 2021）把 NVMe 正式纳入 GPU 内存层级；ZeRO-Inference 把权重/KV 放 CPU/NVMe；Splitwise（ISCA 2024）做 prefill/decode 相位分离与异构机器池；Sarathi-Serve（OSDI 2024）做 chunked prefill；Pond（ASPLOS 2023）做 CXL 内存池化；TPP（ASPLOS 2023，与 Meta/Michigan）做透明页放置；MSR India 的 CheckFreq（FAST 2021）、Quiver（FAST 2020）、CoorDL、DiskANN/SPANN/SPFresh/FreshDiskANN/Filtered-DiskANN；GraphRAG 做图记忆。

**公开数字**：Splitwise 同功耗下吞吐约 **1.4x**、TCO 约 **-20%**（**A2**，记忆）；Pond 内存成本 **-7%~-9%**、>90% 负载接近独占性能（**A2**）；TPP **1.4–2.1x**（**A2**）；ZeRO-Infinity 单 GPU 微调 10T、512 GPU 训练 32T、25 PFLOPS 量级（**A2**，记忆）；Sarathi 同 TBT 下容量 **2.6x**（**A2**）；DiskANN 单机 64GB DRAM + SSD、>95% recall@1、约 5ms（**A2**）。

**仍未解决**：CXL 池化的生产成熟度；Azure OpenAI 的 KV 分层未公开；向量索引更新成本与多租户。

**研究启示**：云厂商的设计中心是 **TCO 而非峰值带宽**；CXL 池化是容量经济学问题；DiskANN 证明"内存放元数据/量化码 + SSD 放全精度向量"是十亿级向量的默认；MSR 的"论文→产品"管线（DiskANN→Azure AI Search，Splitwise→Azure）值得研究界借鉴。

### 3.10 Meta：故障率是存储设计的输入

**架构要点**：Tectonic（FAST 2021）用 EB 级统一命名空间整合吞吐型与延迟型 chunk 存储，ZippyDB 做元数据，租户配额/QoS 与后台跨层迁移；Llama 3 训练用 24,576 张 H100、RoCEv2 三层 CLOS，16K GPU 54 天出现 **419 次非计划中断**、损失约 30 天训练时间，405B 模型 BF16 MFU 约 **38–43%**；Check-N-Run（FAST 2022）对 DLRM embedding 做行级增量 + 有损量化，checkpoint 规模/写入量约 **4x** 下降；TorchSnapshot/TorchTitan DCP 做异步、分片、可重分片 checkpoint；TPP（ASPLOS 2023）与 Michigan 合作做 CXL 页放置。

**公开数字**：419 次/54 天/~30 天损失（**A1**）；405B MFU 38–43%（**A1**）；Check-N-Run ~4x（**A2**）；Tectonic EB 级（**A2**，定性）。"SSD 故障占 17%"为 **C 级，勿引用**。

**仍未解决**：推理 KV 架构未公开；checkpoint 开销与存储侧归因未量化；SSD 故障分类不精确。

**研究启示**：**MTTF/故障率应作为 checkpoint 频率与恢复带宽预留的设计输入**；统一命名空间 + 租户 QoS 是工业级数据底座的核心抽象；checkpoint 的 manifest + 原子提交是存储契约；"用冗余避免恢复"有时比"快速恢复"更省存储带宽（Bamboo 思路）。

### 3.11 Anthropic / OpenAI：把缓存与记忆产品化成 API 语义

**架构要点**：底层存储不公开。Anthropic 公开的是 API 语义：prompt caching 用 `cache_control` 断点标记可缓存前缀，默认 5 分钟 TTL、可选 1 小时，缓存写入有溢价、读取有折扣；memory tool 把记忆实现为沙箱文件目录，模型通过 view/create/str_replace/insert/delete/rename 等工具读写，跨会话持久化由客户端负责；配合 context editing 与 compaction。OpenAI 公开的是自动 prefix caching（约 1024 token 以上前缀、缓存输入折扣）、Batch API（24 小时、50% 折扣）、stored completions（30 天保留，用于蒸馏）、Assistants 的 vector store。

**公开数字**：只有定价倍率与 TTL（**A1**，以最新官方文档为准），无命中率、淘汰策略、延迟分解。

**仍未解决**：缓存命中率与容量；跨租户隔离与前缀泄漏；模型/ tokenizer 更新后的缓存失效；成本归因；缓存正确性。

**研究启示**：**缓存 TTL、定价倍率、断点位置就是存储策略的产品化表达**；文件命名空间（POSIX 语义）已能承载大量 agent memory 需求，下一步是把语义索引、版本、快照下沉；API 层的 cache key 语义、失效协议、计费模型是明显的研究空白。

### 3.12 存储厂商：AI-native 文件系统与 KV tier

- **WEKA**：用户态 NVMe-oF、GPUDirect、S3 分层、MLPerf 提交；2025 年推出 **Augmented Memory Grid**，把 KV cache 纳入文件系统管理（**A1/B**，细节少）。它代表"存储厂商主动吞并 KV 层"。
- **VAST**：DASE 架构，无状态 CNode + 独立 DBox，全局命名空间、相似性缩减、NFS/S3/SMB、GPUDirect（**A1**）。代表"计算/容量完全分离 + 全共享"。
- **DDN**：A3I/Lustre EXAScaler、MLPerf 强项；2024 年推出 Infinia 对象存储平台（**A1/B**，细节待核）。
- **Pure Storage**：FlashBlade//E（2023）与 //S（2024）、DirectFlash；AI 参考架构，但未见专门 KV 产品（**A1/B**）。
- **NetApp**：ONTAP/AFF/FlexGroup/BlueXP，AIPod with NVIDIA；无专门 KV 层（**A1/B**）。
- 其他：IBM Storage Scale（GPFS）、Hammerspace（全局数据编排）、Qumulo、MinIO、Cloudian、Lightbits（NVMe/TCP）。

**数字**：绝大多数为 **B** 级厂商口径；MLPerf 提交是 **A2** 级第三方审计，但厂商会针对性调优。

**仍未解决**：只有 WEKA 明确把 KV 作为一等负载；SSD 寿命/写放大；多租户 QoS；缺开放的 KV 存储基准；KV 层与推理框架的边界未定。

**研究启示**：AI-native 存储 = 高元数据 IOPS + GPUDirect + 对象分层 + KV tier；但 KV 层正被 NVIDIA/Moonshot 等推理栈吞并，存储厂商的护城河将从"带宽"转向"**KV namespace + 数据编排 + 多租户治理**"。

## 4. 四条路线与数字可信度

| 路线 | 代表 | 核心主张 | 存储观 |
|---|---|---|---|
| A 加速器厂商 | NVIDIA、华为 | 存储是"传输描述符 + 内存层级" | 接口下沉到 buffer/descriptor，生态锁定 |
| B 模型公司 | DeepSeek、Moonshot、字节、Meta | 自建 KV 池 + 高带宽 FS，优化单位 token 成本 | 存储是核心竞争力，必须自研 |
| C 云厂商 | 阿里、Google、Microsoft | POSIX 性能层 + 对象容量层 + 缓存，卖弹性/TCO | 存储是云服务，分层与 QoS 由平台托管 |
| D 存储厂商 | WEKA、VAST、DDN、Pure、NetApp、华为 | AI-native FS + KV tier | 存储是独立产品，卖带宽与多协议 |
| E API 厂商 | Anthropic、OpenAI | 缓存/记忆产品化，存储不可见 | 存储是 API 语义（TTL/定价/命名空间） |

**关键数字可信度表**：

| 数字 | 口径 | 来源 | 级别 |
|---|---|---|---|
| 3FS 6.6 TiB/s | 180 存储节点聚合读 | DeepSeek 官方文档 | A1 |
| 3FS 3.66 TiB/min GraySort | 110.5 TiB 排序 | 官方文档 | A1 |
| KVCache 40+ GiB/s/节点 | 单节点读 | 官方文档 | A1 |
| Mooncake 525% | 真实 trace，SLO 内请求数 | FAST 2025 | A2 |
| Mooncake 75% | 合成负载 | FAST 2025 | A2 |
| MegaScale 55.2% MFU | 175B，12,288 GPU | NSDI 2025 | A2 |
| MegaScale 1.34x | vs Megatron-LM | NSDI 2025 | A2 |
| DeepSeek-V2 KV -93.3% | vs 67B，MLA | 技术报告 | A1 |
| DeepSeek-V2 5.76x | 最大生成吞吐 | 技术报告 | A1 |
| Llama 3 419 次/54 天 | 16K GPU 集群 | arXiv 技术报告 | A1 |
| Llama 3 405B MFU 38–43% | 16K GPU，BF16 | arXiv 技术报告 | A1 |
| Dynamo 30x | GB200 NVL72，DeepSeek-R1，baseline 未明 | NVIDIA GTC 2025 | B |
| GDS 2x | vs CPU 中转 | NVIDIA 白皮书 | B |
| CPFS TB/s、百万 IOPS | 集群/单客户端未细分 | 阿里云 | B |
| vePFS TB/s、千万 IOPS | 厂商口径 | 火山引擎 | B |
| OceanStor 百万 IOPS | 厂商口径 | 华为 | B |
| gcsfuse ~90% 本地 SSD | 调优后读吞吐 | Google 博客 | B |
| Splitwise 1.4x / TCO -20% | 同功耗 | ISCA 2024 | A2 |
| Pond -7~-9% 成本 | 内存池化 | ASPLOS 2023 | A2 |
| TPP 1.4–2.1x | 生产 workload | ASPLOS 2023 | A2 |
| Check-N-Run ~4x | DLRM embedding | FAST 2022 | A2 |
| ServerlessLLM 10–200x | 冷启动，3B 0.4s | OSDI 2024 | A2 |
| DistServe 7.4x/12.6x | 请求率/SLO | OSDI 2024 | A2 |
| Sarathi 2.6x | 同 TBT 容量 | OSDI 2024 | A2 |
| CachedAttention TTFT -87% | 多轮对话 | ATC 2024 | A2（数字记忆，需核） |
| Llama 3 SSD 故障 17% | 故障分类 | 二手记忆 | C（勿引用） |

## 5. 工业界 vs 学术界：Gap

### 5.1 十二个"工业已在用、学术没系统研究"的点

| # | 技术点 | 工业界现状 | 学术界现状 | 可研究问题 |
|---|---|---|---|---|
| G1 | Prefix cache 的键语义 | vLLM 用 block 内 token + 父块哈希链；SGLang 用 radix tree；LRU | 研究前缀复用算法，但默认 cache key = token 序列 | cache key 必须含模型版本、tokenizer、LoRA adapter、量化配置、RoPE scaling；跨实例哈希一致性；碰撞兜底；模型更新后的失效协议 |
| G2 | 块级准入/淘汰/TTL | LRU + TTL + 价值启发式；Mooncake 用 TTL + early rejection | token 级 heavy-hitter（H2O）、page 级（Quest），不是缓存块级 | 块级复用距离分布；admission（是否值得缓存）；cost-aware eviction；TTL vs LRU；租户公平 |
| G3 | 多租户配额与 QoS | 每租户配额、限速、隔离 ad hoc；RDMA NIC 有跨租户干扰 | 几乎所有 LLM serving 论文假设单租户 | 租户感知缓存分区；公平淘汰；KV 传输 QoS；前缀共享的侧信道；计费/计量 |
| G4 | 可观测性 | TTFT 分解、命中率、慢节点、SSD 寿命、静默错误 | benchmark 只报吞吐/延迟 | KV 命中率的标准定义（token/block/request）；trace 格式；SLO 感知准入；根因归因 |
| G5 | Checkpoint 控制面 | manifest、原子提交、在线 resharding、GC、保留策略、跨集群 | 研究异步/增量机制，不研究控制面 | checkpoint-as-database：MVCC、快照、GC、对象存储原子性、跨区域复制 |
| G6 | 模型注册表/分发 | Xet CDC 去重、OCI artifact、safetensors mmap、GGUF、range 读、签名/SBOM | 几乎没有系统研究 | 模型仓库的内容寻址；fine-tune 间去重；量化感知打包；GC；供应链安全 |
| G7 | Agent 记忆的事务语义 | 文件式记忆（Anthropic）、时序 KG（Zep）、Mem0 的 ADD/UPDATE/DELETE | 研究记忆算法（MemGPT/A-MEM），不研究 ACID/隔离/溯源 | 记忆作为事务存储；provenance；投毒防御；TTL/遗忘；GDPR 删除；多 agent 并发 |
| G8 | 语义缓存正确性 | 固定阈值，无保证 | vCache 给错误率上界，MeanCache 做用户分区 | 阈值校准；分布漂移检测；每租户阈值；误命中成本；模型更新失效 |
| G9 | 数据删除/更新传播到 KV | 文档更新使 chunk 失效（Cache-Craft 提及），模型更新全失效；无系统方案 | 几乎没有 | "KV cache invalidation protocol"；源文档→缓存 KV 的依赖追踪；版本化 KV；被遗忘权 |
| G10 | TCO/容量规划 | 内部成本模型：SSD 寿命、网络 egress、命中率 ROI | 一阶定量模型 | $/token 的存储成本归因；分层经济学；SSD 磨损成本；突发容量规划 |
| G11 | Benchmark | MLPerf Storage 覆盖训练数据+checkpoint，不覆盖推理 KV；ANN 基准不覆盖过滤/多租户 | 缺 KV 存储基准 | KVBench：真实 trace、命中率、失效、多租户、故障注入 |
| G12 | 硬件协同 | CXL 池化（Pond 研究）、NVL72、CloudMatrix、OCS、CSD/PIM 产品化 | 缺生产 trace 与软件栈研究 | CXL 池化的真实收益边界；CSD/PIM 的 attention 卸载代价模型；OCS 下的存储放置 |

### 5.2 三个最值得优先做的 Gap

**（1）Prefix cache 的工程细节被严重低估。** 工业界真正的难点不是 radix tree，而是：block 对齐（16 token）、哈希链（父块哈希 + 本块 token）、碰撞后的 token 级校验、COW、空闲块 LRU、跨实例哈希一致性、LoRA/量化/模型版本进入 key、缓存失效。学术界论文通常假设"相同 token 前缀 = 相同 KV"，这在多 adapter、多量化、多模型版本的生产环境中不成立。**研究机会**：把 KV 缓存建模为"带版本与来源的内容寻址对象"，给出失效协议与正确性证明。

**（2）多租户配额与隔离是"能不能上线"的分水岭。** 工业界要回答：每租户多少 KV 配额、缓存满了淘汰谁的、前缀共享会不会泄漏 prompt、RDMA NIC 的跨租户干扰如何限速、SSD 写放大是否影响邻居、如何按 token 计费。学术界几乎默认单租户，或只做吞吐优化。**研究机会**：租户感知的 KV 缓存分区、公平淘汰、QoS 下的 KV 传输调度、无侧信道的前缀共享。

**（3）可观测性是工业界的"暗知识"。** 生产系统需要 TTFT 分解（排队/预填充/KV 传输/解码）、缓存命中率（按 block/request/token 三种口径）、KV 驻留时间、SSD 磨损、静默数据错误、慢节点定位。学术 benchmark 通常只报吞吐与平均延迟。**研究机会**：定义 KV 存储的标准指标与 trace 格式；SLO 感知的准入与淘汰；故障注入下的根因归因。

### 5.3 为什么会有这些 Gap

- **数据不可得**：真实 trace（Mooncake、BurstGPT）稀少，且不含 KV 级细粒度；工业界内部有，但不公开。
- **部署细节不可见**：多租户、配额、运维、计费属于商业机密，论文不会写。
- **审稿激励**：顶会偏好"新机制 + 大倍数"，不偏好"工程细节 + 负结果"；而工业界的价值恰恰在细节与负结果。
- **评测口径缺失**：没有 KV 存储基准，无法公平比较"缓存策略"和"分层策略"。

## 6. 技术采用成熟度分级

定义：**实验**（论文原型/单点试用，无生产规模证据）；**早期采用**（有产品/生产部署，但少数玩家、接口未统一）；**规模化**（多家头部玩家生产使用，成为架构默认）；**标准化**（有标准/事实标准接口，生态普遍支持）。

| 技术 | 代表玩家/系统 | 成熟度 | 判断依据 | 主要未解问题 |
|---|---|---|---|---|
| Prefix cache（radix/hash） | vLLM、SGLang、TensorRT-LLM | **规模化** | 主流推理引擎默认能力 | 跨实例一致性、失效、租户隔离 |
| KV offload 到 DRAM | NVIDIA KVBM、LMCache、CachedAttention | **规模化** | 多家生产/开源 | 分层策略、带宽竞争 |
| KV offload 到本地 SSD | Mooncake、CachedAttention、LMCache | **早期采用→规模化** | 头部玩家生产，但非普遍 | 写放大、寿命、命中率 |
| 跨节点全局 KV 池 | Mooncake、Dynamo KVBM、MemServe | **早期采用** | 少数玩家规模化，接口未统一 | 元数据扩展、一致性、跨 DC |
| PD 分离 | DistServe、Splitwise、Mooncake、DeepSeek | **规模化** | 多家生产 | 短上下文收益、KV 传输成本 |
| KV-aware routing | Dynamo、Mooncake Conductor、Preble | **早期采用** | 头部玩家 | 全局目录、抖动、公平性 |
| 统一传输引擎（NIXL/Transfer Engine） | NVIDIA、Moonshot | **早期采用** | 产品化中 | 跨厂商、隔离、可观测 |
| 用户态零拷贝 FS（USRBIO） | DeepSeek 3FS | **早期采用** | 单厂商 | 通用性、生态 |
| 无状态元数据 + 事务 KV | 3FS（FoundationDB）、Tectonic（ZippyDB） | **规模化** | 多家 | 元数据扩展、跨 DC |
| 链式复制（CRAQ） | 3FS、Facebook | **规模化** | 生产验证 | 写延迟、故障切换 |
| GPUDirect Storage | NVIDIA + WEKA/VAST/DDN/Lustre | **早期采用→规模化** | 产品支持广，实际部署在增长 | 小 IO、故障切换、多路径 |
| CXL 内存池化 | Pond（Azure 研究）、CXL 3.x 产品 | **实验→早期** | 研究验证，产品刚起步 | 延迟、软件栈、RAS |
| 机架级统一内存（NVL72/CloudMatrix） | NVIDIA、华为 | **早期采用** | 已出货，软件成熟度低 | 故障域、编程模型、能效 |
| OCS 光交换 | Google TPU v4 | **规模化（Google 内部）** | 单一玩家 | 重构延迟、通用性 |
| Checkpoint 在线 resharding | ByteCheckpoint、PyTorch DCP、NeMo Universal | **规模化** | 主流训练栈 | 跨集群、GC、原子性 |
| 异步/增量 checkpoint | CheckFreq、Gemini、ByteCheckpoint | **规模化** | 多家 | 故障丢失窗口、内存开销 |
| 模型 CDC 去重分发 | Hugging Face Xet | **早期采用** | 单一生態 | 去重率、跨仓库、安全 |
| OCI 模型 artifact | ORAS、KitOps | **早期采用** | 企业流水线 | layer 粒度、range 读 |
| safetensors | Hugging Face 生态 | **标准化** | 事实标准 | 量化布局、分片语义 |
| 语义缓存 | GPTCache、MeanCache、vCache | **早期采用** | 产品多，正确性无保证 | 阈值、漂移、误命中 |
| 磁盘 ANN（DiskANN/SPANN） | Azure AI Search、Milvus | **规模化** | 生产验证 | 更新写放大、过滤、多租户 |
| 计算型 SSD / PIM | SmartSSD、InstInfer、HBM-PIM | **实验** | 原型/少量产品 | 编程模型、算力、生态 |
| 多租户 KV 配额/QoS | 各大云内部 | **实验→早期** | 内部实现，无标准 | 公平、隔离、计费 |
| KV 可观测性 | 各大云内部 | **实验** | 内部指标，无标准 | 指标定义、trace 格式 |
| KV 失效/版本化 | 工业界 ad hoc | **实验** | 无系统方案 | 依赖追踪、删除传播 |
| Agent 记忆文件命名空间 | Anthropic memory tool | **早期采用** | 产品化 beta | 语义索引、版本、隔离 |

## 7. 对存储系统的八条启示

1. **区分 prefill 复用缓存与 decode 工作集**。前者可放 SSD/远端，优化命中率与容量；后者必须在 HBM/DRAM，优化带宽。把 SSD 当 decode 的第二层是数量级错误。
2. **存储接口正在从"路径"变成"描述符"**。NIXL 的 memory section + transfer descriptor、USRBIO 的共享内存环、GDS 的 cuFile，都是"可 RDMA 注册的 buffer + 异步完成"。存储系统需要原生暴露这种接口，而不是只暴露 POSIX。
3. **元数据是新的瓶颈**。前缀索引、全局 KV 目录、checkpoint manifest、模型 registry，都是元数据密集负载；事务型 KV（FoundationDB/ZippyDB）成为一等组件。
4. **分层策略必须与调度器联合**。KV 放哪层不应由 LRU 单独决定，而应由"缓存命中 + SLO + 租户配额 + 网络代价"联合决定（Mooncake Conductor、Dynamo KV-aware router）。
5. **Cache key 的语义复杂度被低估**。模型版本、tokenizer、LoRA adapter、量化配置、RoPE scaling 都应进入 key；否则生产环境会出现"命中但错误"的静默故障。
6. **故障率与 TCO 是设计输入**。MTTF 决定 checkpoint 频率与恢复带宽；SSD 寿命、网络 egress、缓存命中 ROI 决定分层经济性。峰值带宽不是唯一目标。
7. **对象存储是容量层，POSIX 是性能层，FUSE/缓存是桥**。不要指望对象存储承担随机小 IO 或 checkpoint 主存储；也不要把 FUSE 缓存当成无限性能。
8. **多租户与可观测性决定能否上线**。它们不是"工程细节"，而是存储系统的一等需求；学术界应把它们作为研究问题，而不是假设。

## 8. 研究议程（8 个可执行方向）

1. **KV 的形式化语义与失效协议**：定义 versioned KV object（key = 内容 + 模型 + tokenizer + adapter + 量化 + 位置），给出跨实例一致性、失效传播、正确性证明。
2. **块级缓存经济学**：基于真实 trace 研究 admission/eviction/TTL 的联合优化，给出"缓存一个前缀是否划算"的代价模型。
3. **多租户 KV 存储 QoS**：租户感知分区、公平淘汰、RDMA NIC 干扰隔离、前缀共享侧信道、按 token 计费。
4. **KVBench**：真实 trace（含 KV 粒度）、命中率/失效/多租户/故障注入的统一基准；区别于 MLPerf Storage 与 ANN benchmark。
5. **Checkpoint-as-a-Database**：manifest、原子提交、MVCC、GC、跨集群复制、对象存储上的事务语义。
6. **Model Registry at Scale**：CDC 去重、量化感知打包、跨 fine-tune 复用、供应链签名与 GC。
7. **Agent Memory as a Transactional Store**：ACID、隔离、provenance、投毒防御、TTL/遗忘、删除传播、多 agent 并发。
8. **存储侧计算与近存 attention 的代价模型**：CSD/PIM/CXL 在真实长上下文下的端到端收益边界，而非单一 kernel 加速比。
9. **TCO 与分层经济学**：$/token 的存储成本归因、SSD 磨损、网络 egress、缓存命中 ROI 的公开方法论。
10. **删除/更新传播**：源文档更新或删除后，KV cache、向量索引、agent memory 如何级联失效；这是合规与正确性的共同需求。

## 9. 局限

1. 无外网核验，所有引用需回到原始论文/官方文档。
2. 本文的工业界细节主要来自早期内部知识与公开文档；arXiv 检索已补齐至 2026-10-30，但厂商未公开的架构仍无法核实。
3. 腾讯、Anthropic/OpenAI 的底层存储架构公开信息极少，本文只写可确认的 API/产品语义，未做过度推断。
4. AWS、Apple、xAI、Samsung/SK hynix 等未在原始材料中系统覆盖，本文不展开。
5. 部分数字（CachedAttention 87%/7.8x、Llama 3 SSD 17%、3FS 写带宽）为记忆值，已标注，不应直接引用。
6. 成熟度分级是本文基于公开证据的判断（D），不是行业标准；不同读者可能有不同划线。

---

**说明**：本次运行中，subagent 的 Write 工具被策略禁止写 `.md` 报告文件，因此完整文档以上述内容返回，未能落盘到 `d:/xiaojun/work/test/StoreAI/research/raw/analysis-industry.md`。请父级 agent 将该内容写入目标路径。