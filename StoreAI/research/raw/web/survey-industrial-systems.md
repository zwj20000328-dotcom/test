# 工业界系统与产品

> 语料说明：本方向检索文件 `curated-industrial-systems.md` 实际收录 10 条（文件头标注 10/11），因此本章覆盖全部 10 条，不做 12–20 篇的二次筛选。所有机制与数字均取自文件中的标题/摘要；摘要被截断处已注明，未给出的量化结果不做推测。

## 1. 问题定义与为什么它是存储问题

这一方向的核心矛盾可以概括为：**KV cache 的容量随会话寿命增长，而承载它的 HBM 容量不增长**。在 chat、agent loop、文档问答这类长生命周期负载里，每个会话都要保留历史 token 的 K/V 张量，GPU HBM 既稀缺又昂贵。工业系统的第一反应是把 KV 按层下沉到 CPU DRAM 与 SSD，用容量换并发；Mooncake 就是原型：它把 GPU 集群中闲置的 CPU、DRAM、SSD 组织成 disaggregated KV cache [arXiv:2407.00079v5]。

一旦 prefill 与 decode 被拆到不同节点池，问题性质就变了：一次 cache miss 不再只意味着本地重算，还意味着跨网络把 KV 搬到 decode 节点；而把一个 block 准入全局缓存本身也要再付一次传输 [arXiv:2610.28637v1]。存储问题由此从"提高命中率"变成"在容量、带宽、延迟与 SLO 之间做成本最优的放置、保留与搬迁"。关键指标也随之固化：TTFT、SLO attainment、goodput、每会话成本、每 GPU 可支撑并发会话数。

## 2. 技术流派

### 2.1 分层卸载与设备特性刻画

- **核心思想**：把 KV 视为可分级存放的数据对象，HBM 只做热层，DRAM/SSD（乃至新型闪存）做容量层；系统设计的关键是层间容量配比与设备特性是否匹配访问模式。
- **代表工作**：
  - [arXiv:2407.00079v5] **Mooncake: A KVCache-centric Disaggregated Architecture for LLM Serving**。把 prefill 与 decode 拆成两个集群，并复用 GPU 集群中未被充分利用的 CPU、DRAM、SSD 构成 disaggregated KVCache；核心是一个以 KVCache 为中心的调度器，在最大化有效吞吐的同时满足延迟 SLO；针对严重过载场景引入 prediction-based early rejection。论文声称在特定模拟场景中相对 baseline 吞吐最高提升 525%。局限：这是 2024 年发布、2026 年更新的设计，远端层预设为 SSD 式存储；调度未显式建模网络拓扑与拥塞；摘要未给出真实生产 trace 下的对照数字。
  - [arXiv:2609.16215v1] **Where Should the KV Cache Live? Placement Policies Across GPU, CPU, and SSD for Long-Lived Sessions**。用离散事件模拟器覆盖 GPU HBM、CPU DRAM、SSD 三层，并以 random forest 执行时间预测器校准；在 chat、agent、文档 QA 三类负载上比较 recency、复用频率、预测复用、带 prefetch lookahead 的 EWMA 四类策略。论文声称分层可支撑每 GPU 73.02 倍的并发会话、每会话成本降低 62.04 倍，但明确指出收益来自 1+8+64 的层容量配比，而非放置策略。局限：结论来自模拟器，摘要未给出真实硬件验证；decode 相关段落被截断。
  - [arXiv:2608.11668v4] **HBF Sucks? A Full-Stack Characterization of High-Bandwidth Flash for KV-Centric LLM Serving**。作者把 SSD 式 Mooncake KV-offloading 栈原样搬到 High-Bandwidth Flash 上，用扩展的 TokenSim、四条两小时 Qwen-Bailian 生产 trace、五个 dense/MoE 模型与 H100/B200 配置实测。结果与直觉相反：平均端到端延迟上升 2–5.5 倍，最大 SLO goodput 下降 1.1–2.7 倍。作者给出成本收益模型：更快的远端层只有在读 I/O 是瓶颈、读多于写、且交付带宽可持续时才划算。局限：只覆盖 HBF + Mooncake 式栈，结论依赖 trace 与模型组合；摘要末尾截断。
- **共同假设与失效场景**：假定远端层"慢但大"、读延迟是主要成本、层容量配比可静态设定。失效于写密集、KV 生命周期极短、或设备带宽不可持续的场景——[arXiv:2608.11668v4] 正是这一假设的反例。

### 2.2 保留与准入策略：学习式与精确优化

- **核心思想**：把 keep/evict/admit 建模为带成本的决策问题，而不是按 LRU/LFU 的启发式；成本同时包含重算与传输。
- **代表工作**：
  - [arXiv:2610.28637v1] **To Keep or Not to Keep: Learning KV Cache Retention in Disaggregated LLM Serving**（KVLearn）。指出分离式服务打破了经典缓存策略的关键假设：miss 的代价是"重算 + 到 decode 节点的网络传输"，admission 也要额外传输，因此错误的保留决策同时浪费内存与带宽。系统由 Prefix Reuse Predictor（PRP，用结构与时间前缀特征估计复用概率，不改模型权重）与 Cost-Aware Retention Score（CARS，把复用概率换算成 keep/admit 决策）组成。局限：摘要截断，未给出任何量化收益；方法依赖前缀特征的可预测性。
  - [arXiv:2610.02766v1] **Exact Memory-Time Optimization for Prefix-Cached Language Model Serving**。提出 Prefix-Certificate Retention（PCR），针对 static、grouped、reset-on-access 三类 timeout 给出有限 trace 上的精确形式化。关键观察是逐 block 独立优化会高估收益：一个常驻 block 只有在其前置前缀也可用时才有价值。作者把 usable-prefix 收益建成节点，其前置条件是 timeout 阈值与更早的 hit certificate，于是最大权闭包归约为一次最小割，图规模与 block 查找数、timeout 选择数成线性；breakpoint 定理把构造扩展到所有非负 timeout 且无离散化误差，并给出有序 timeout 的网格线性时间 DP。局限：面向静态 trace 的离线精确解，摘要未给出在线部署与端到端延迟收益。
- **共同假设与失效场景**：都假定"能否复用"可从前缀结构预测；[arXiv:2610.02766v1] 进一步证明 block 不可独立计价。失效于前缀树极深、跨会话共享前缀频繁、或复用信号被租户隔离打断的场景。

### 2.3 分离式服务中的放置与网络感知调度

- **核心思想**：decode 实例的选择不只是负载均衡问题，KV 的物理位置与网络距离共同决定 TTFT；调度必须把网络项纳入目标函数。
- **代表工作**：
  - [arXiv:2606.03910v1] **NetKV: Network-Aware Decode Instance Selection for Disaggregated LLM Inference**。作者定义了一个薄的 operator-to-scheduler 接口"network cost oracle"，并证明随着上下文变长，忽略网络项会使仅 cache-aware 的调度任意次优。NetKV 是每请求 O(|D|) 的贪心算法，其 tier 排序对过期遥测可证明鲁棒。在 64 GPU、四层 fat-tree 模拟器上用 Mooncake trace 评测：平均 TTFT 相对 round-robin 最多降低 21.2%，相对调优过的 cache+load-aware 调度器降低 17.6%，并提升 SLO attainment（摘要在此截断）。局限：模拟器结果；需要拓扑与拥塞遥测；摘要未给出真实集群验证。
  - [arXiv:2606.17081v1] **The Price of Anarchy in Disaggregated Inference**。以 NVIDIA Dynamo 为案例，把分离式服务建模为三个耦合博弈：prefill/decode 两个资源池的双人资源博弈、分层 KV cache 上的自私缓存博弈、以及带正外部性的请求路由拥塞博弈。后两者有实证验证，P/D 资源博弈仅作解析处理。结论是 GPU 饱和会触发 regime transition：未饱和时自私行为的 PoA 有界，饱和后超线性延迟与缓存外部性主导。局限：理论分析为主，摘要未给量化结果，且末尾截断。
- **共同假设与失效场景**：假定调度器能获得拓扑、拥塞与队列状态。失效于遥测严重过期、跨租户不可见、或网络出现 grey failure 的场景——这正是 [arXiv:2604.00368v2] 所描述的运维现实。

### 2.4 数据移动编排与跨层接口

- **核心思想**：agentic 负载让 KVCache 成为"一等移动资产"，瓶颈从"存哪里"转向"怎么搬"；需要把传输意图与物理执行解耦，并在 harness 与推理引擎之间建立协议。
- **代表工作**：
  - [arXiv:2604.00368v2] **TENT: A Declarative Slice Spraying Engine for Performant and Resilient Data Movement in Disaggregated LLM Serving**。作者在数千 GPU 上运行 Mooncake Transfer Engine，发现 imperative、early-binding 的选路是根本缺陷：state-blind striping 忽略拥塞与 grey failure，造成带宽搁浅，日常故障还需人工介入。TENT 把传输意图与物理执行解耦，将异构互连抽象为统一资源池，把路径解析从初始化推迟到 slice-time late binding。局限：摘要未给出吞吐/恢复时间的量化结果；依赖底层网络的可观测性与可编程性。
  - [arXiv:2610.06597v1] **Can Agent Harnesses and Inference Engines Hear Each Other? The HEAR Protocol for Agentic LLM Serving**。指出现有接口没有系统性地连接两层信息：harness 知道 workflow 依赖、context 生命周期与执行目标，引擎知道请求队列、KV cache 状态、资源压力与执行能力。HEAR 是双向协议，标准化 harness 如何表达 workflow intent 与执行需求、引擎如何回传运行时状态、能力与结果，并把协议语义与优化策略分离。局限：协议提案，摘要未给出实现与评测数据。
- **共同假设与失效场景**：假定 KV 可按 slice 细粒度搬运、harness 能准确表达依赖。失效于工作流动态分支、上下文被工具调用截断、或网络不可观测的场景。

### 2.5 评测方法与 trace 工具

- **核心思想**：在 KV 放置策略进入"每几个百分点"的竞争后，评测本身成为瓶颈；需要能保留瓶颈证据的紧凑 replay 集。
- **代表工作**：
  - [arXiv:2608.00423v1] **Diagnose Before You Compress: Prediction-Independent Bottleneck Witness Refinement for LLM Serving Traces**（BPW）。指出既有 trace 约简方法保留的是负载分布或代表性请求，但暴露瓶颈的 workload 可能稀少且不具代表性；一个组件的证据无法补偿另一个组件的证据缺失；用预测出的瓶颈作为 target truth 会形成循环评估。BPW 先用 response-blind 的 workload 特征与闭源侧测量做 Workload Candidate Nomination，再在质量约束下筛选 replay suite。局限：摘要截断，未给出压缩率与诊断覆盖率的数字。
- **共同假设与失效场景**：假定瓶颈可由少量 witness 代表。失效于瓶颈随配置迁移、或多组件同时饱和的场景。

## 3. 2025–2026 最新进展

1. **"加一层"不再是答案，容量配比才是主因**。[arXiv:2609.16215v1] 明确把 73.02× 并发与 62.04× 成本收益归因于 1+8+64 的层容量，而非放置策略——这直接挑战了过去几年以 eviction policy 为中心的研究叙事。
2. **分离式架构打破了经典缓存假设**。miss 从"本地重算"变成"重算 + 网络传输"，admission 也要传输 [arXiv:2610.28637v1]；网络项不进入目标函数会让 cache-aware 调度随上下文变长而任意次优 [arXiv:2606.03910v1]。
3. **更快的设备可能让系统更慢**。[arXiv:2608.11668v4] 用生产 trace 给出 2–5.5× 延迟恶化与 1.1–2.7× goodput 下降，说明"设备参数升级"必须经过全栈成本模型，而不是看峰值带宽。
4. **agentic 负载把 KV 变成移动资产**。迁移与 elephant flow 进入关键路径 [arXiv:2604.00368v2]，并催生 harness-engine 跨层协议 [arXiv:2610.06597v1]。
5. **策略层开始形式化**。最小割/最大权闭包给出 timeout 策略的精确解 [arXiv:2610.02766v1]；博弈论开始刻画分离式架构的均衡与饱和相变 [arXiv:2606.17081v1]。
6. **评测可信度被单独提出**。用预测瓶颈做 ground truth 的循环论证被点名 [arXiv:2608.00423v1]。

## 4. 横向对比

| 代表工作 | 年份 | 存储层次 | 核心机制 | 声称收益 | 主要局限 |
|---|---|---|---|---|---|
| Mooncake [arXiv:2407.00079v5] | 2024（2026 更新） | HBM / DRAM / SSD | prefill-decode 分离 + KVCache 中心调度 + 过载早拒 | 特定模拟场景吞吐最高 +525% | 未建模网络拓扑；真实 trace 对照缺失 |
| Where Should KV Live [arXiv:2609.16215v1] | 2026 | HBM / DRAM / SSD | 离散事件模拟 + 四类放置策略对比 | 73.02× 并发会话、62.04× 单位会话成本下降 | 模拟器结论；收益来自容量配比而非策略 |
| HBF Sucks [arXiv:2608.11668v4] | 2026 | HBM / HBF | 把 Mooncake 式卸载栈搬到 HBF 并全栈实测 | 反例：延迟 +2–5.5×，goodput −1.1–2.7× | 仅 HBF + 特定栈与 trace |
| KVLearn [arXiv:2610.28637v1] | 2026 | 分离式全局 KV 池 | PRP 复用预测 + CARS 成本感知保留 | 摘要未给出 | 依赖前缀特征可预测性 |
| PCR [arXiv:2610.02766v1] | 2026 | 前缀缓存 | 最大权闭包 → 最小割精确 timeout | 摘要未给出端到端收益 | 离线静态 trace |
| NetKV [arXiv:2606.03910v1] | 2026 | 跨节点网络 + KV 池 | network cost oracle + O(|D|) 贪心选路 | TTFT −21.2%（vs RR）、−17.6%（vs cache+load） | 模拟器；需实时遥测 |
| Price of Anarchy [arXiv:2606.17081v1] | 2026 | 分层 KV cache | 三个耦合博弈建模 | 摘要未给出量化 | P/D 博弈仅解析；理论为主 |
| TENT [arXiv:2604.00368v2] | 2026 | 集群互连 / 传输层 | 声明式传输 + slice-time late binding | 摘要未给出 | 依赖网络可观测性 |
| HEAR [arXiv:2610.06597v1] | 2026 | harness ↔ engine 接口 | 双向协议，语义与策略分离 | 摘要未给出 | 协议提案，无评测 |
| BPW [arXiv:2608.00423v1] | 2026 | trace / 评测层 | response-blind 提名 + 瓶颈见证保留 | 摘要未给出 | 摘要截断 |

## 5. 对存储系统设计的启示

1. **把层容量配比做成一等可调参数，而不是部署常量。** [arXiv:2609.16215v1] 的收益几乎全部来自 1+8+64 的配比，意味着系统应暴露 `hbm: dram: ssd` 比例与每层 block 预算，并允许按 workload 类别（chat/agent/docQA）在线重配；策略调优的优先级应低于配比调优。
2. **KV block 元数据必须携带前缀依赖链。** [arXiv:2610.02766v1] 证明逐 block 独立计价会高估收益；存储层应保存 parent pointer 或 hit certificate，接口暴露"usable prefix length"而非"block hit"，eviction 时按前缀子树整体评估。
3. **准入/淘汰接口接收成本向量，而非命中率。** 按 [arXiv:2610.28637v1]，评分至少应包含 recompute FLOPs、传输字节数、当前链路拥塞三要素；把 CARS 式评分下沉为调度器原语，使策略可替换而接口稳定。
4. **传输层采用 intent/execution 分离与 slice 级 late binding。** 依 [arXiv:2604.00368v2]，上层只声明"把哪段 KV 在什么 SLO 下搬到哪"，路径在 slice 发出时按实时拥塞解析，避免 elephant flow 在初始化时绑死路径；同时把 grey failure 纳入重试语义。
5. **设备选型必须看读写比、写放大与带宽可持续性。** [arXiv:2608.11668v4] 说明 HBF 类"更快远端层"只在读瓶颈、读多于写时有利；存储栈需要写合并、transient KV 的短生命周期旁路，以及按 trace 校准的成本模型，而不是按峰值带宽采购。
6. **向上暴露 workflow 语义，向下回传 KV 状态。** 按 [arXiv:2610.06597v1]，引擎应把 KV 占用、队列与资源压力回传给 harness，harness 把 workflow DAG 与 context 生命周期下传，使 prefetch 有真实的未来信息；否则 [arXiv:2609.16215v1] 中的 prefetch lookahead 只能靠历史外推。
7. **评测用瓶颈见证集，而非均匀采样。** 依 [arXiv:2608.00423v1]，replay suite 应以组件级瓶颈证据覆盖为目标，且不得用预测瓶颈作为真值，否则策略对比会系统性偏乐观。

## 6. 必读五篇

1. **[arXiv:2407.00079v5] Mooncake** —— 工业界 KVCache 中心分离式架构的基准设计，后续几乎所有工作都以它为对照或底座。
2. **[arXiv:2609.16215v1] Where Should the KV Cache Live?** —— 唯一给出"收益主要来自容量配比而非放置策略"这一反直觉结论的工作，直接决定研究优先级。
3. **[arXiv:2608.11668v4] HBF Sucks?** —— 用生产 trace 证明更快设备可能更慢，是设备选型与成本模型的必读反例。
4. **[arXiv:2610.28637v1] KVLearn** —— 把分离式架构下"miss = 重算 + 传输"的成本结构讲得最清楚，是保留策略的起点。
5. **[arXiv:2606.03910v1] NetKV** —— 给出网络项不可忽略的证明与可落地的 O(|D|) 贪心，是放置与选路结合的代表。