# 向量检索、RAG 与向量数据库存储

## 1. 问题定义与为什么它是存储问题

核心矛盾一句话可说清：ANNS 的算法结构要求"沿图或簇做细粒度、数据依赖、几乎不可预取的随机游走"，而所有高容量低成本介质（SSD、CXL 远端内存、对象存储）都按大粒度块交付、并按请求计费。粒度错配直接决定了 Recall 与延迟/成本之间的整条 Pareto 前沿，也决定了这个方向几乎所有论文都在做同一件事——把算法需求翻译成介质友好的访问模式。

三组事实把它钉死成存储问题。第一，索引比数据大：[arXiv:2405.03267v2] 论文声称，SSD 上的图索引与簇索引为把吞吐分别提升 5.7× 与 1.7×，需付出相对数据集 5.8× 与 7.7× 的存储放大。索引不是附属元数据，而是独立的、更大的存储负载。第二，I/O 已是绝对瓶颈：[arXiv:2602.21514v2] 论文声称 SSD 后端 ANN 查询中 I/O 占延迟 70–90%，[arXiv:2508.15694v1] 给出"超过 90%"。第三，RAG 引入第二类一等持久对象：检索 chunk 的 KV cache 可离线预计算并落盘（[arXiv:2410.07590v1]），于是"原文"与"原文的中间表示"都要在存储层被放置、复用、压缩、淘汰。

因此关键指标是四位一体：给定 Recall@10 下的 p99 延迟、每查询 page reads（或远端 round-trip 数）、索引相对数据的存储放大比、单位查询的请求费用。在对象存储按请求计费的场景下，最后一项会直接翻转索引选型（[arXiv:2610.25172v1]）。

## 2. 技术流派

### 2.1 磁盘驻留图索引：重排布局以匹配页粒度

核心思想：不动算法，动布局。让一次 SSD 页读尽量装下"一次遍历真正需要的邻居"，把 I/O 次数而非 CPU 周期作为第一优化目标。

- [arXiv:2602.22805v1] VeloANN：层次压缩 + affinity-based placement 把相关向量放进同页，记录级 buffer pool 持久保留热邻居，用 coroutine 异步运行时掩盖 storage stall；动机是图遍历访问局部性差导致 CPU 空转与 read amplification。摘要未给出量化收益。
- [arXiv:2508.15290v1] Gorgeous：profiling 发现图结构的访问频率高于向量本身，于是按"图结构优先于向量"分配稀缺内存，向量下沉磁盘。摘要未给数字。
- [arXiv:2602.21514v2] OctopusANN：把技术拆成内存布局、磁盘布局、搜索算法三维，提出 page-level complexity model 解释 page locality 与路径长度如何共同决定 page reads；结论是内存驻留导航与动态宽度单独收益最大，page shuffle 与 page search 单独很弱但组合互补，最终组合比 SOTA 吞吐高 4.1–37.9%。

其他同类：PageANN 用 page-node 图对齐 I/O 粒度 [arXiv:2509.25487v2]；BAMG 把存储布局纳入建图以获得 I/O 单调路径 [arXiv:2509.03226v2]；早期的 Starling [arXiv:2401.02116v3] 与 DiskANN++ [arXiv:2310.00402v5] 奠定了 segment 化与入口点敏感性两条基线。

共同假设：介质是本地 NVMe SSD、页大小固定、图是唯一索引形态。失效场景：对象存储（RTT 高且按请求计费）、多租户共享盘、无状态计算节点——这正是 2.3/2.4 的出发点。

### 2.2 量化与压缩：用比特预算换 I/O

核心思想：把"必须从慢介质读的东西"变小，甚至让它消失。

- [arXiv:2404.06004v2] AiSAQ：把 PQ 码本整体下沉到 SSD 索引，论文声称查询时内存约 10 MB 即可服务 billion-scale 数据集且延迟不明显退化；附带收益是索引加载快、可在多个十亿级索引间快速切换。
- [arXiv:2610.02652v1] RaBitQ-SSD：Split-RaBitQ 把每个二进制码的可配置前缀常驻 DRAM，使内存码存储低于 1 bit/dim，并给出无偏距离估计与概率误差界；该界允许在 IVF 候选表内部逐候选剪枝，而非整表读回。
- [arXiv:2506.08276v2] LEANN：反向路线，不存 embedding 而在查询时按需重算，同时压缩 proximity graph，只用约原数据 5% 的存储完成高质量检索。
- [arXiv:2604.09173v2] COMPASS：先做数据/索引解耦，再按各组件可压缩性分别无损压缩，真实十亿级数据集上存储降低最多 58.7%，检索与更新性能持平或更好。
- [arXiv:2601.09985v1] FaTRQ：用 tiered memory 中的残差流式 refine 替代"回 SSD 读全精度向量"的第二遍，候选一旦可证明在界外即提前停止。

共同假设：距离可由少量比特近似且 recall 损失可控，或重算 embedding 的算力足够便宜。失效场景：高 recall 区间（>0.95）量化误差主导；多模态/长文本 embedding 重算昂贵（LEANN 的软肋）；更新频繁时压缩布局要重建。

### 2.3 存储-计算分离与新介质

核心思想：既然细粒度随机读在本地盘上做不好，就换成"细粒度读本来就便宜"的介质，并把计算推到数据旁边。

- [arXiv:2505.16096v1] Cosmos：在 CXL 内存设备内集成通用核做全 ANNS offload，rank 级并行距离计算吃满内存带宽，并按簇间邻近性做 adjacency-aware placement 均衡各设备负载；SIFT1B/DEEP1B 上吞吐比基线 CXL 系统高 6.72×、比某 SOTA 高 2.35×（被比较系统名称在摘要截断处缺失）。
- [arXiv:2607.04415v2] GORIO：把 page-miss 生成、pending-query 状态与 resume 决策全部留在 GPU，CPU 只做 NVMe-oF 发起者；理由是图遍历的"下一个访问"在 GPU 内部才发现，CPU 中心 I/O 路径无法提前规划。

其余一句带过：RiftANN 在 passive RDMA 上用紧凑向量导航、阈值触发精确校验与 one-sided 流水 [arXiv:2610.08990v2]；VS-Flash 把 flash 暴露为 memory-semantic 空间并按 batch 大小调度执行引擎 [arXiv:2610.26960v1]；NDSEARCH 做存内计算 [arXiv:2312.03141v2]；SwarmIO 提供 1 亿 IOPS 级 SSD 模拟以评估 GPU 发起 I/O [arXiv:2604.06668v1]。

共同假设：远端或新介质的细粒度访问足够便宜，协议复杂度值得。失效场景：多租户拥塞下的 tail latency；设备内计算核的编程模型不可移植。

### 2.4 云原生、对象存储与表格式集成

- [arXiv:2606.04196v1] Puffin/Iceberg：用 Puffin sidecar 承载完整 Vamana 图（论文声称可到 billion vector scale），以 snapshot summary 作绑定机制，使无状态 executor 直接从对象存储读索引，不必为向量检索再造一套索引存储层与一致性模型。
- [arXiv:2610.25172v1] RemoteANN：IVF 与 RaBitQ 联合设计，针对对象存储的网络延迟与 per-request 成本做 inter-cluster 与 intra-cluster 优化，抑制网络 I/O 放大。
- [arXiv:2511.14748v2] 云原生实测：云厂商默认选 cluster-based 而非 graph 索引，理由是 fetch 粒度大、查询内依赖少、round-trip 少。
- [arXiv:2510.17326v1] DSANN 用 graph-cluster hybrid 把十亿级索引放进分布式存储。

共同假设：对象存储的快照与最终一致语义足以承载索引生命周期；QPS 足够大以摊薄 RTT。失效场景：低 QPS 小 batch、需要强一致可见性的在线更新。

### 2.5 分布式 scale-out 与动态更新

- [arXiv:2512.09331v2] BatANN：访问远端邻域时把整个查询状态"接力"过去继续执行，保持单一全局图的 log 搜索复杂度并近线性扩展；摘要给出 1B 点数据集上的结果，但具体数值在截断处缺失。
- [arXiv:2505.17152v3] LSM-Vec：用 LSM 思想把图连接与向量数据分成不同物理记录，避免"只改图却重写向量"，内存角色从纯缓存转为吸收近期更新。
- 其余：CoTra 利用近似性容忍异步执行 [arXiv:2507.06653v1]；Harmony 做维度加向量的多粒度分区 [arXiv:2506.14707v1]；Fantasy 用 GPUDirect Async 流水化 [arXiv:2512.02278v1]；NAVIS 指出 position seeking 才是更新主开销 [arXiv:2605.11523v1]；MicroNN 面向端侧可更新 [arXiv:2504.05573v1]。

### 2.6 RAG 侧：内容抓取与 KV cache 作为存储对象

- [arXiv:2610.21676v1] ConStore：最重要的观察是，百万到十亿级语料上、大 K 时"把内容从存储取回"的延迟可与向量检索本身相当甚至更高，不能被忽略；SICP 把图式与簇式检索抽象为渐进 SSD I/O，在细化候选队列的同时投机预取内容。
- [arXiv:2609.33503v1] RelaxKV：代表 KV 复用修复流——chunk 独立预计算的 KV 缺跨 chunk 交互，它把"选哪些 token 重算"与"在什么上下文里重算"做联合分配，并以 query 为指导收窄到相关上下文。摘要称在四个 decoder 模型上有效，具体数字被截断。

其余一句带过：TurboRAG 奠基离线 KV 落盘 [arXiv:2410.07590v1]；RAGCache 用 knowledge tree 做分级缓存 [arXiv:2404.12457v2]；CacheRepair 用轻量网络学习独立 KV 与联合 KV 之差 [arXiv:2609.35139v1]；FusionRAG 在离线阶段把邻 chunk 信息注入 [arXiv:2601.12904v1]；A³ 指出重算 token 与问题相关片段错位 [arXiv:2511.17560v1]；CoinRAG 把复用粒度降到 nugget [arXiv:2608.07458v2]；HyperRAG 复用 reranker 的 document-side KV [arXiv:2504.02921v1]；SubGCache 做子图级缓存 [arXiv:2505.10951v2]；MPIC 做多模态位置无关缓存 [arXiv:2502.01960v2]；CLC 实验研究指出各方法各有根本局限但彼此互补 [arXiv:2603.20218v1]。

风险面同样进入存储设计：[arXiv:2608.30996v1] 论文声称 INT8 量化近乎无损，但 INT4 下即使答案仍正确，超过 90% 的 faithfulness 变化是负向的，accuracy 指标对此完全不可见；[arXiv:2610.22873v1] 证明复用 reasoning trace 的 KV cache 会引入投毒面。

## 3. 2025-2026 最新进展

1. "索引必须与计算同机同盘"被打破：Iceberg/Puffin [arXiv:2606.04196v1]、RemoteANN [arXiv:2610.25172v1]、云原生实测 [arXiv:2511.14748v2] 把索引变成对象存储上的可寻址对象。
2. "遍历必须读全精度向量"被打破：GateANN 只读邻居表与近似距离即可穿越不匹配节点，论文声称 SSD 读最多减少 10×、吞吐最多提升 7.6× [arXiv:2603.21466v2]；RaBitQ-SSD 的误差界让"部分码"就足以剪枝。
3. "更新是低频离线操作"被打破：LSM-Vec、NAVIS、MicroNN 把动态性提到一等，且都先做读写路径分离再谈优化。
4. "KV cache 复用是免费的"被打破：faithfulness 审计与投毒攻击说明复用带来新的正确性与安全债务。
5. 优化单位从"单查询"上移到"查询流"：QVCache 做语义相似查询级缓存 [arXiv:2602.02057v1]，CaGR-RAG 按簇访问模式分组并投机预取 [arXiv:2505.01164v1]。
6. 评测体系化：[arXiv:2603.01779v2] 把磁盘图 ANN 拆成存储策略、磁盘布局、缓存管理、查询执行、更新机制五组件统一评测；[arXiv:2608.12812v1] 在 7 个系统、6 个数据集、400 万以上向量、96–960 维上做 15 指标横评。

## 4. 横向对比

| 代表工作 | 年份 | 存储层次 | 核心机制 | 声称收益 | 主要局限 |
|---|---|---|---|---|---|
| second-tier memory [arXiv:2405.03267v2] | 2024 | RDMA/CXL 远端内存 | 用细粒度二级内存替代 SSD | 刻画图/簇索引 5.8×/7.7× 存储放大 | 摘要未给系统级收益，依赖新硬件可得性 |
| AiSAQ [arXiv:2404.06004v2] | 2024 | SSD | PQ 码本全下沉 | 查询内存约 10 MB @ billion-scale | PQ 精度上限，refine 仍受限 |
| Cosmos [arXiv:2505.16096v1] | 2025 | CXL 内存设备 | 设备内计算 + rank 级并行 | 6.72× / 2.35× 吞吐 | 依赖 CXL 硬件与设备编程模型 |
| Gorgeous [arXiv:2508.15290v1] | 2025 | SSD | 图结构优先于向量 | 摘要未给数字 | 仅本地 SSD，更新路径未覆盖 |
| LSM-Vec [arXiv:2505.17152v3] | 2025 | SSD | LSM 分离图与向量 | 摘要未给数字 | 多层级带来读放大权衡 |
| BatANN [arXiv:2512.09331v2] | 2025 | 分布式 SSD | 查询状态接力执行 | 近线性扩展，1B 点（数值截断） | 依赖低延迟互联，迁移有状态开销 |
| Puffin/Iceberg [arXiv:2606.04196v1] | 2026 | 对象存储 | Puffin sidecar + snapshot summary | 支撑 billion vector scale | 绑定 Iceberg 生态与快照语义 |
| RemoteANN [arXiv:2610.25172v1] | 2026 | 对象存储 | IVF + RaBitQ 联合设计 | 声称抑制 I/O 放大与 API 成本（未给数字） | cluster 索引 recall 上限 |
| VeloANN [arXiv:2602.22805v1] | 2026 | SSD | 层次压缩 + 亲和放置 + 协程 | 摘要未给数字 | 局部性假设依赖数据分布 |
| COMPASS [arXiv:2604.09173v2] | 2026 | SSD | 数据/索引解耦压缩 | 存储最多降 58.7% | 压缩与更新路径强耦合 |
| ConStore [arXiv:2610.21676v1] | 2026 | SSD | 检索-内容抓取重叠预取 | 大 K 下内容抓取延迟可≥检索延迟 | 要求 ANNS 可抽象为渐进 I/O |
| GateANN [arXiv:2603.21466v2] | 2026 | SSD | 图穿隧 + 谓词内存检查 | 读最多 10× 降，吞吐最多 7.6× 升 | 谓词选择性低时退化 |

## 5. 对存储系统设计的启示

1. 索引应设计成"可分页对象"而非"文件"。节点按页对齐（PageANN），图结构放 Puffin sidecar 并以 snapshot summary 绑定（[arXiv:2606.04196v1]），使索引能随表快照原子切换，无需独立的索引存储服务。
2. 存储接口要能返回"近似距离"，而不是只给全精度向量。把（邻居列表，1-bit 码前缀，残差）做成三种粒度不同的读接口，遍历阶段只走前两种——GateANN 与 RaBitQ-SSD 从两个方向证明了这类接口的收益。
3. 放置单位应是 page 或 record，且图结构与向量负载必须分开管理。Gorgeous、LSM-Vec、COMPASS 三条独立证据指向同一点：合并存储会让"只改图"的操作付重写向量的代价。
4. 对象存储后端要显式建模请求预算。per-request 计费下"少而大"的 fetch 优于"多而小"，因此 cluster/IVF 形态优先于 graph（[arXiv:2511.14748v2] 的实测结论），索引元数据必须常驻计算节点。
5. KV cache 需要独立于向量索引的生命周期管理：chunk 级不可变对象 + 跨 chunk 修复层 + 量化档位与 faithfulness 的联合 SLO。[arXiv:2608.30996v1] 表明 accuracy 不能作为代理指标。
6. 硬件接口层面，"页缺失"应被视为计算事件而非 I/O 事件：CXL 设备内计算、CMS-Flash、GPU 直发 NVMe-oF 是同一方向的三种实现，接口都应暴露可挂起的查询状态。

## 6. 必读五篇

1. [arXiv:2405.03267v2] —— 唯一把"性能 vs 索引大小"定量刻画并指出 second-tier memory 出路的文章，整个方向的问题陈述可从中提炼。
2. [arXiv:2606.04196v1] Puffin/Iceberg —— 索引作为表格式一等公民的最激进主张，直接对应湖仓场景。
3. [arXiv:2610.25172v1] RemoteANN —— 展示对象存储的代价模型如何反向决定索引结构（IVF 而非 graph）。
4. [arXiv:2610.02652v1] RaBitQ-SSD —— 比特预算、误差界与 I/O 剪枝三者统一，方法论价值最高。
5. [arXiv:2610.21676v1] ConStore —— 把"取内容"纳入端到端延迟，纠正了只优化向量检索的惯性。