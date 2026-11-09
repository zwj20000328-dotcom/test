# 训练数据管道与分布式文件系统

## 1. 问题定义与为什么它是存储问题

加速器算力与显存带宽逐代提升，而样本供给路径——对象存储/并行文件系统 → 网络 → 主机内存 → DataLoader 进程 → GPU 显存——受物理延迟与带宽约束，无法同步增长 [arXiv:2503.22643v2]。训练因此在系统层面退化为一道调度题：如何在每个 epoch 内把 N 个样本以正确顺序、足够深的预取送进 GPU，同时不阻塞 checkpoint 写回。这把框架问题变成了存储问题：I/O 不是一次性冷启动，而是每轮重复的稳态负载，并与模型加载、checkpoint 突发写、多作业争抢叠加。NIO Bench 在 Ceph 上对六类模型的追踪显示，I/O 高度集中在 data preparation、model loading、model checkpointing 三个阶段 [arXiv:2609.05418v1]，恰好对应小文件元数据、大块顺序读、突发写三种存储最不擅长的模式。

因此关键指标不是单一 IOPS/带宽，而是 GPU 空转与利用率（Fanout-Cache 报告未优化时 GPU 利用率可低至 10–15% [arXiv:2604.21275v1]）、每 epoch 时间、样本吞吐、p99 尾延迟、元数据 ops/s、checkpoint 停顿，以及 2025 年后被显式优化的每样本 I/O 能耗 [arXiv:2508.11035v1]。存储设计目标从"峰值带宽"转为"稳定 goodput + 可预测尾延迟"。

## 2. 技术流派

### 2.1 阶段归因与基准刻画

核心思想：先把训练 I/O 拆成可命名的阶段，再谈优化；否则"平均带宽"会掩盖 checkpoint 与元数据尖峰。

- [arXiv:2609.05418v1] Benchmarking Storage Systems for Machine Learning Workloads Using NIO Bench：提出 NIO Bench，用 Python 层 I/O hook 提供语义阶段上下文，用 Linux strace 覆盖包括 DataLoader worker 子进程在内的完整 syscall；在 Nautilus Kubernetes 集群 + Ceph 上评测 Language Transformer、Vision Transformer、Diffusion、SNN、ANN、RL 六类模型。结论是 I/O 高度集中于 data preparation、model loading、checkpointing。局限：摘要在结论处截断，未给出各阶段占比或绝对带宽数字。
- [arXiv:2211.04908v2] Profiling and Improving the PyTorch Dataloader for high-latency Storage：面向高延迟存储，逐步骤基准 PyTorch DataLoader，定位数据加载过程中若干步骤的性能问题。局限：摘要未列出具体瓶颈步骤，也未给出加速比；2022 年的结论对今天的 loader 实现未必成立。
- [arXiv:2301.01494v1] Analyzing I/O Performance of a Hierarchical HPC Storage System for Distributed Deep Learning：在旗舰级超算上定量分析层次化存储对 DDNN 的收益，回答"每一层缓存/闪存层带来多少提升"。局限：摘要截断，未给出具体倍数。
- [arXiv:2108.06322v1] Quantifying and Improving Performance of Distributed Deep Learning with Cloud Storage：指出既有研究隐含假设"数据在本地或低延迟网络存储"，而按需创建/销毁 GPU 集群与 serverless 场景下该假设不成立；训练数据全部放在云 bucket 中受带宽限制。局限：摘要未给出改进幅度。
- [arXiv:2506.06235v1] Optimizing Cloud-to-GPU Throughput for Deep Learning With Earth Observation Data：GeoTIFF 从云对象存储直读时标准 PyTorch loader 喂不饱 GPU；通过 tile 对齐读、worker 线程池与 Bayesian 优化，论文声称远程加载吞吐提升 20×、本地提升 4×，且在三个公开 EO 基准上以相同时间预算达到与本地训练相同精度，验证 IoU 提升 6–15%。局限：强依赖 tile 对齐的遥感数据形态，结论不宜外推到任意小文件数据集。

共同假设：I/O 是可单独测量的固定成本、作业独占存储、访问模式稳定。失效场景：多租户共享集群、混合小文件与 checkpoint 突发、跨地域对象存储。

### 2.2 面向样本读取的数据布局

核心思想：把"文件"换成"可顺序读的分片/记录"，用大块 I/O 换取元数据开销下降。

- [arXiv:2001.01858v1] High Performance I/O For Large Scale Deep Learning：提出 AIStore 可横向扩展存储系统与 WebDataset 基于标准的分片格式/库，让超大数据集以少量大对象顺序读取；在图像分类负载上对比本地 SSD、单机 NFS、HDFS 与 AIStore。局限：摘要未给出量化结果；分片格式假设样本可打包，随机访问与变长样本不友好。
- [arXiv:2603.16945v1] Joint Optimization of Storage and Loading for High-Performance 3D Point Cloud Data Processing：针对 PLY/XYZ/BIN 等格式碎片化，提出统一的 .PcRecord 存储格式与配套加载路径，减少解码与搬运。局限：摘要截断，未给出加载时间或压缩比；领域专用。

共同假设：样本可预先打包、读取以 scan 为主。失效场景：强随机采样、在线增删样本、需要按样本级版本回滚。

### 2.3 缓存、预取与跨作业共享

核心思想：在 GPU 节点本地盘或主机内存形成第二层"数据副本"，并用预取/共享把网络延迟移出关键路径。

- [arXiv:1812.00669v1] Hoard: A Distributed Data Caching System to Accelerate Deep Learning Training on the Cloud：把数据条带化到多个 GPU 节点的本地快盘，用分布式文件系统统一命名空间；可在作业开始前或执行初期从中心存储预取。局限：摘要未给出 GPU 利用率提升数字；假设节点有可牺牲的本地盘与稳定作业边界。
- [arXiv:2508.11035v1] EMLIO: Minimizing I/O Latency and Energy Consumption for Large-Scale AI Training：在存储节点部署轻量 data-serving daemon，把原始样本序列化/批处理，经 TCP 乱序预取流式发送，客户端接 DALI GPU 预处理；在本地盘、LAN（0.05 ms 与 10 ms RTT）、WAN（30 ms RTT）上评测，论文声称最高 8.6× I/O 加速与 10.9× 的能耗改善（摘要原文截断于 "10.9X low…"，具体口径摘要未完整给出）。局限：以样本级序列化为前提，改变了存储接口语义。
- [arXiv:2409.18749v4] TensorSocket: Shared Data Loading for Deep Learning Training：让多个同时训练（调参/NAS）的进程共享同一 data loader，消除重复解码与 CPU 侧瓶颈。局限：摘要未给出吞吐或 CPU 节省数字；要求作业共置且管道兼容。
- [arXiv:2604.21275v1] Optimizing High-Throughput Distributed Data Pipelines for Reproducible Deep Learning at Scale：在 Petastorm + Parquet、数十 TB 数据集上剖析出网络 I/O 与 PyArrow→NumPy 的 CPU 变换把 GPU 利用率压到 10–15%；提出 worker 级下推变换、Fanout-Cache 本地盘缓存、round-robin ventilator/result 队列消除竞态并改造 RNG。局限：结果段截断，未给出最终利用率；与 Petastorm 生态绑定。

共同假设：数据集可缓存、作业可共置、样本可重复读取。失效场景：一次性流式数据、严格隔离的多租户、缓存容量小于工作集。

### 2.4 DFS 元数据路径与一致性契约

核心思想：训练负载的 DFS 瓶颈常在元数据与控制路径，而非数据带宽；应重新划分客户端/服务端职责。

- [arXiv:2507.10367v4] FalconFS: Distributed File System for Large-Scale Deep Learning Pipeline：指出客户端元数据缓存不仅无效还占用宝贵内存，改为 stateless client，在服务端用混合元数据索引与惰性命名空间复制做路径解析，并用请求合并提升并发、VFS shortcut 简化部署；对 CephFS 与 Lustre，论文声称小文件读写吞吐最高 5.72×，另一项 deep… 管道吞吐最高 12.81×（摘要截断处为 "deep …"）。局限：需要服务端元数据服务改造；摘要未给尾延迟与故障恢复数据。
- [arXiv:2402.14105v2] Formal Definitions and Performance Comparison of Consistency Models for Parallel File Systems：建立内存一致性与存储一致性的对应，形式化定义多种并行文件系统一致性模型并比较性能；指出 POSIX 严格一致的代价随规模上升、随节点本地 SSD 变快而更突出。局限：摘要截断，未给出具体性能数字；形式模型与对象存储语义的映射仍需工作。

共同假设：POSIX 全序是默认正确性基线、客户端缓存总是有益。失效场景：只读/追加为主的训练数据、跨站点命名空间、容器化短生命周期客户端。

### 2.5 Checkpoint 写路径

- [arXiv:2505.09810v1] Lossless Compression for LLM Tensor Incremental Snapshots：指出即使 bf16，单次 checkpoint 也常达数百 GB，且必须在下一 epoch 前跨网络写入；分析训练过程中张量可压缩性随时间的演化，评估通用压缩器加数据优化。局限：摘要未给出压缩比与压缩 CPU 开销；属于分析而非完整系统。

### 2.6 语义/意图驱动与新形态

- [arXiv:2510.15917v1] Intent-Driven Storage Systems: From Low-Level Tuning to High-Level Understanding：提出用 LLM 从非结构化信号推断 workload/system intent，在策略护栏内跨层重配参数；给出四条设计原则与架构，在 FileBench 上论文声称 IOPS 最高提升 2.45×。局限：愿景论文，仅初步结果；LLM 推理延迟与成本未在摘要讨论。
- [arXiv:2609.22978v1] DeepSeek Elastic Compute (DSec): A Sandbox Infrastructure for Effective Agentic Training at Scale：把 agentic 训练的沙箱供给当成弹性平台问题：突发创建、长交互保状态、镜像语料大且复用低；统一 FnCall/container/microVM/full-VM 后端，按独立版本层组合环境，并做内存共享与回收。局限：定位为生产系统报告，摘要未给性能数字；面向 agentic 环境而非经典样本管道。

其他工作：ModelHub 早期提出 DL 数据与生命周期统一管理 [arXiv:1611.06224v1]；Bandana 用 NVM 存 embedding 并以超图划分共读向量 [arXiv:1811.05922v2]；HPS/FIITED 面向推荐模型 embedding 的分层参数服务与维度剪枝 [arXiv:2210.08804v1][arXiv:2401.04408v2]；REIS 把 ANNS 检索下推到存储内 [arXiv:2506.16444v2]。它们与"训练样本供给"相邻但边界不同，故不展开。

## 3. 2025-2026 最新进展

2025 年以来最重要的变化是几个默认假设被逐一打破。

第一，"数据必须下沉到 GPU 本地"被云直读方案削弱：经过 tile 对齐与 loader 调参，远程对象存储可在相同时间预算内达到本地训练精度 [arXiv:2506.06235v1]。第二，"客户端元数据缓存有益"被 FalconFS 直接否定，无状态客户端 + 服务端解析成为 DFS 的新设计点 [arXiv:2507.10367v4]。第三，"优化目标是最小化延迟"扩展为"延迟与能耗联合最小化"，EMLIO 把每样本能耗纳入目标 [arXiv:2508.11035v1]。第四，"每个作业独占数据管道"被 TensorSocket 的跨进程共享打破 [arXiv:2409.18749v4]，Fanout-Cache 进一步把变换下推到 worker 并做本地盘缓存 [arXiv:2604.21275v1]。第五，控制平面开始引入 LLM 语义推理，存储参数不再只靠人工启发式 [arXiv:2510.15917v1]。第六，训练对象本身在变化：agentic 训练把"环境镜像/沙箱"变成新的数据集，镜像复用率低、状态需长驻，存储问题从"读样本"扩展到"供给可执行环境" [arXiv:2609.22978v1]。同时，HBF 被用于扩展加速器内存以保留 KV 状态 [arXiv:2609.39131v2]，训练与推理的存储边界进一步模糊。

## 4. 横向对比

| 代表工作 | 年份 | 存储层次 | 核心机制 | 声称收益 | 主要局限 |
|---|---|---|---|---|---|
| NIO Bench [arXiv:2609.05418v1] | 2026 | 应用追踪 + Ceph 后端 | Python hook + strace 双层追踪，覆盖 DataLoader 子进程 | 摘要未给量化 | 仅六类模型、单集群 |
| EO loader [arXiv:2506.06235v1] | 2025 | 云对象存储→本地 SSD→GPU | tile 对齐读 + 线程池 + Bayesian 调参 | 远程 20×、本地 4×，IoU +6–15% | 依赖 GeoTIFF tile 形态 |
| AIStore/WebDataset [arXiv:2001.01858v1] | 2020 | 分布式对象存储 + SSD/NFS/HDFS | 分片大对象顺序读 + 可扩展存储 | 摘要未给量化 | 需预打包，随机访问弱 |
| .PcRecord [arXiv:2603.16945v1] | 2026 | 应用层文件格式 | 统一点云记录格式与加载路径 | 摘要未给量化 | 领域专用 |
| Hoard [arXiv:1812.00669v1] | 2018 | GPU 节点本地盘 + 中心存储 | 条带化本地盘缓存 + 预取 | 摘要未给量化 | 假设专用节点与稳定作业 |
| EMLIO [arXiv:2508.11035v1] | 2025 | 存储节点 daemon + LAN/WAN | 样本批处理、TCP 乱序预取、DALI | 8.6× I/O，10.9× 低能耗（截断） | 改变样本接口语义 |
| TensorSocket [arXiv:2409.18749v4] | 2024 | 主机 CPU/内存 loader | 多进程共享同一 loader | 摘要未给量化 | 需共置与兼容管道 |
| Fanout-Cache [arXiv:2604.21275v1] | 2026 | 本地盘缓存 + Parquet | worker 级下推 + 本地缓存 + 无竞态队列 | 基线 GPU 利用率 10–15% | 绑定 Petastorm |
| FalconFS [arXiv:2507.10367v4] | 2025 | DFS 元数据/数据路径 | 无状态客户端 + 服务端混合索引 | 5.72× 小文件、12.81× deep 管道 | 需服务端改造，尾延迟未给 |
| 一致性模型 [arXiv:2402.14105v2] | 2024 | 并行 FS 语义层 | 形式化一致性模型与性能比较 | 摘要未给量化 | 与对象存储映射未完成 |
| Checkpoint 压缩 [arXiv:2505.09810v1] | 2025 | 持久化写路径 | 张量可压缩性分析 + 通用压缩 | 摘要未给压缩比 | 分析非系统，CPU 开销未计 |
| IDSS [arXiv:2510.15917v1] | 2025 | 存储控制平面 | LLM 推断意图 + 护栏内重配 | IOPS 2.45× | 愿景，初步结果 |
| DSec [arXiv:2609.22978v1] | 2026 | 沙箱/镜像层存储 | 多后端沙箱 + 分层镜像 + 内存回收 | 摘要未给量化 | 生产报告，非经典管道 |

注：以上均为 arXiv 预印本，文件中未提供会议/期刊信息。

## 5. 对存储系统设计的启示

1. 接口：把样本/分片提升为一级对象。暴露 (dataset_id, shard_id, byte_range, sample_index) 与 epoch/manifest 版本，而不是让 DataLoader 用 open/read 拼路径；支持乱序预取句柄与显式 backpressure，对应 EMLIO 的流式样本协议 [arXiv:2508.11035v1]。
2. 元数据：客户端无状态、服务端做混合索引与路径解析，把 open+lookup+getattr 合并为单次 RPC；客户端缓存预算改为可配置的"提示缓存"而非正确性依赖 [arXiv:2507.10367v4]。
3. 放置：按"共读"而非按文件大小放置。用 shard 共现图把同一作业/同一模型会一起读的分片放到同一故障域或同一 GPU 节点本地盘，Hoard 的条带化与 Bandana 的超图划分是同一思路的两个层次 [arXiv:1812.00669v1][arXiv:1811.05922v2]。
4. Checkpoint：增量快照 + 无损压缩 + 两级落盘。先写节点 NVMe 再异步上传，checkpoint 流与训练读流用不同 QoS 队列隔离；按张量可压缩性演化选择压缩窗口 [arXiv:2505.09810v1]。
5. 一致性：为"读多写少 + epoch 屏障"提供 relaxed contract，用 manifest 原子提交定义数据集版本；避免 POSIX 全序在元数据路径上的开销 [arXiv:2402.14105v2]。
6. 可观测性：把 phase 标签（data prep/model load/checkpoint）作为 I/O 计费、调度与告警的一等维度；用框架 hook + eBPF/strace 双层追踪把 GPU 空转归因到具体阶段，而不是只看聚合带宽 [arXiv:2609.05418v1]。

## 6. 必读五篇

1. [arXiv:2507.10367v4] FalconFS — 系统性地推翻"客户端元数据缓存有益"的假设，并在 CephFS/Lustre 上给出 5.72×/12.81× 量级结果。
2. [arXiv:2609.05418v1] NIO Bench — 目前最完整的跨六类模型、覆盖 DataLoader 子进程的 I/O 阶段归因方法。
3. [arXiv:2508.11035v1] EMLIO — 把延迟与能耗放在同一目标里优化，并覆盖 LAN/WAN 多 RTT 的样本级传输设计。
4. [arXiv:2001.01858v1] AIStore/WebDataset — 分片格式与存储系统协同设计的原点，是理解今天所有 shard-based loader 的基础。
5. [arXiv:2409.18749v4] TensorSocket — 多作业共享 data loader 的代表工作，直接对应多租户训练集群的真实痛点。