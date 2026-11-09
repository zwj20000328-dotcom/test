# Agent 长期记忆与上下文存储

> 说明：本章只使用指定检索文件中的条目；文件未提供会议信息，所引工作均为 arXiv 预印本。摘要被截断处不做补全。

## 1. 问题定义与为什么它是存储问题

核心矛盾是：上下文窗口固定且按 token 计价，而 agent 的交互历史无界增长、持续被修订，并且每次请求都要在成本预算内重新决定"哪几条记忆进入窗口"。这个"写什么、放哪里、读哪些、何时删"的循环，是存储系统的经典命题，而不是单纯的 prompt 拼接。

四件事把它变成存储问题。第一是写放大：为把历史整理成笔记或图，系统往往要发起"每次历史数百到数千次 LLM 调用"[arXiv:2610.34673v1]，写入开销远高于原始数据。第二是读选择：请求被形式化为"预算受限的 slate 推荐"，记忆是 item，context window 是 slate [arXiv:2610.34673v1]，本质是带成本约束的 top-k 检索。第三是状态正确性：长期记忆的正确性"是状态轨迹的性质，而不是单条记录的性质"[arXiv:2605.26252v1]，故需要修订、遗忘与版本语义，而非记录级 CRUD。第四是层次异构：记忆同时驻留在 GPU HBM 的私有状态与前缀缓存 [arXiv:2601.21473v1]、markdown 文件系统 [arXiv:2607.26637v1]、关系库 [arXiv:2607.04391v1]、向量索引 [arXiv:2601.08160v2] 和属性图 [arXiv:2602.05665v1] 中，跨层放置没有共识。

因此关键指标不止任务准确率，还包括每请求 token 成本、写入 LLM 调用次数与延迟、检索尾延迟、事实新鲜度与冲突率、遗忘精确性，以及被污染记忆的存活时间。

## 2. 技术流派

### 2.1 检索选择论：记忆是预算受限的推荐问题

- 核心思想：不改介质，改选择。把记忆库当候选池、context window 当 slate、请求当 user，用 query-aware 路由与混合信号重排决定进入窗口的证据。
- 代表工作：
  - `[arXiv:2610.34673v1] Agent Memory as Recommendation`：形式化为 budgeted slate recommendation；指出许多系统每次历史要花数百到数千次 LLM 调用建笔记/图，却无法归因准确率来自哪个组件。局限：摘要未给实验数字。
  - `[arXiv:2601.08160v2] SwiftMem`：即使底层是 HNSW，现有框架仍做 query-agnostic 全库检索，记忆增长后成为延迟瓶颈；时间索引支持对数时间范围查询，DAG-Tag 语义索引把查询收窄到相关主题。局限：索引维护与更新一致性摘要未展开。
  - `[arXiv:2610.00872v1] MemFit`：逐轮原文追加、写入几乎即时且无需 LLM，用 segment summary 做索引而非替换原文，检索走词法+语义+cross-encoder 重排。局限：摘要未给量化收益。
  - `[arXiv:2610.30755v1] Raw-RAG`：用原始历史的 dense retrieval + rerank，在 LoCoMo、LongMemEval、MEME、MemoryAgentBench 四个基准、七个 benchmark-model 设置中六个排名第一，比最强 agentic memory 高 0.13-5.53 分（论文声称）。局限：依赖原始历史可长期留存。
- 共同假设与失效：假设证据原子、可独立打分、查询可预知。失效于多跳聚合、context collapse [arXiv:2606.22844v1] 与词面远但逻辑相关的证据 [arXiv:2610.19472v1]。

### 2.2 数据管理论：记忆是有状态的数据库

- 核心思想：把 schema、provenance、版本、事务与治理引入记忆，正确性落在状态轨迹而非单条记录。
- 代表工作：
  - `[arXiv:2605.26252v1] Is Agent Memory a Database?`：提出 GEM，归纳四种失败模式（无约束增长、缺失语义修订、容量驱动遗忘、只读检索），用 ingestion/revision/forgetting/retrieval 四个状态算子替代记录级操作，并给出六条正确性条件。局限：愿景论文，摘要未给实现与评测。
  - `[arXiv:2608.25577v2] PolyMemDB`：图、向量、概率、时空四类存储并存，用细粒度 provenance 解决长期事实冲突，概率推理引擎结合时间衰减（摘要在此截断）。局限：demo，摘要未给数字。
  - `[arXiv:2607.27773v2] ChronoMem`：在生产级开源 Agent Development Kit 上加入语义版本层，每次写入提交整库快照，用词法+语义混合检索把自然语言撤销意图映射到历史版本。局限：全量快照的存储放大与写延迟摘要未给。
  - `[arXiv:2607.26637v1] Filesystem-Based Memory`：首次系统研究部署中最常见的 markdown 目录树记忆，形式化为管理/搜索/执行三个 agent 角色，检验"agent 能否维持组织"与"组织是否带来收益"两个假设。局限：摘要未给数字。
  - `[arXiv:2606.10677v1] Infini Memory`：topic document 作为语义单元，新观察先入 buffer 再周期性 consolidate，推理时用迭代工具调用读记忆；MemoryAgentBench 上总体 64.7%（论文声称）。局限：topic 维护开销未展开。
  - 其他：EnSIMem 的 `[entity][entity_type][property:value]` 索引 [arXiv:2609.27279v2]、NeuSymMS 的 CLIPS + RDBMS 三元组 [arXiv:2605.17596v2]、MOSS 的符号化关系库检索 [arXiv:2607.04391v1]，都是同一思路的不同落点。
- 共同假设与失效：假设 schema 与生命周期规则可预先固定、provenance 可完整捕获；失效于开放域事实、schema 漂移与 LLM 绑定的写入成本。

### 2.3 结构化组织论：图、树与自适应结构

- 核心思想：记忆价值来自关系与层次，用图、树或可切换结构承载实体、时间与因果。
- 代表工作：
  - `[arXiv:2602.05665v1] Graph-based Agent Memory`：综述，给出短/长期、知识/经验、非结构/结构分类，并按生命周期梳理图式记忆技术。
  - `[arXiv:2605.15701v1] H-Mem`：时间+语义混合树，短期记忆逐步演化为长期记忆，长期节点为短期节点提供摘要，兼顾演化建模与高效检索。局限：摘要未给量化对比。
  - `[arXiv:2602.14038v1] FluxMem`：给 agent 多种互补结构，用下游响应质量与记忆利用率做离线监督来学习结构选择，并配三级记忆层次。局限：选择器训练与迁移成本未给。
  - `[arXiv:2608.15008v1] Harness the Memory`：统一 harness 横评 dense/sparse 索引、文本、结构、层次、refinement、参数化更新、activation-compatible context 等介质，3 个 backbone、4 个基准、26 个指标；结论是没有单一介质持续占优，广泛检索利于长上下文事实 QA，过度检索反而有害。局限：结论依赖其任务分布。
- 共同假设与失效：假设关系抽取准确、结构稳定；抽取错误会沿图传播，且 A-MEM 类 append-and-evolve 结构被指有 O(N^2) 写入延迟 [arXiv:2603.14597v1]。

### 2.4 写入与演化论：提取、筛选、巩固与遗忘

- 核心思想：记忆质量在写入侧决定；用主动抽取、小模型、RL 与双过程调度决定写什么、何时整合、如何修订与删除。
- 代表工作：
  - `[arXiv:2604.07877v2] MemReader`：指出现有系统把抽取当一次性被动转录，在噪声对话、缺失指代、跨轮依赖下造成记忆污染、低价值写入与不一致；0.6B 被动抽取器加 4B、GRPO 训练的主动抽取器，后者先评估信息价值、指代歧义与完整性再动作。局限：摘要未给数字。
  - `[arXiv:2610.19472v1] MemCode`：把对话改写为自包含原子记忆单元 (AMU)，用同构语义量化映射到可学习 codebook，以 codebook 共现拓扑补充向量检索；在线原子写与离线异步巩固分离。局限：codebook 训练与漂移成本未给。
  - `[arXiv:2606.09483v1] DCPM`：按认知层级组织记忆，从原子事实到历时信念轨迹、身份、领域 schema 与跨域模式；System1 白天写入并用双向 supersedes 链记录信念修订，System2 夜间归纳 schema。
  - `[arXiv:2610.18052v1] Bemula`：首个记忆遗忘基准，50 段多会话对话、135 条六类遗忘请求、1742 个问题，并用无请求对照版保证"只有真存过才可能得分"。
  - 其他：MemEvolve 联合进化经验与记忆架构 [arXiv:2512.18746v1]，DeltaMem 用 RL 与 Memory-based Levenshtein Distance 奖励做记忆更新 [arXiv:2604.01560v1]，D-MEM 用 RPE 路由快慢路径规避 O(N^2) 写入 [arXiv:2603.14597v1]。
- 共同假设与失效：假设价值可在写入时估计、离线巩固安全；失效于价值依赖未来查询、压缩丢失长尾细节，以及遗忘请求与派生摘要冲突。

### 2.5 系统与服务论：把记忆当驻留状态

- 核心思想：从 workload 出发刻画读写路径，做放置、预取、驱逐与调度。
- 代表工作：
  - `[arXiv:2606.06448v2] Agent Memory: Characterization and System Implications`：首个系统级刻画，给出四轴分类与按 construction/retrieval/generation 归因的阶段式 profiling harness，横评 10 个系统与 2 套基准，显示设计选择如何把成本在写/读路径间搬移。
  - `[arXiv:2601.21473v1] ScaleSim`：多 agent 仿真中每个 agent 的模型、前缀缓存、adapter 驻留 GPU 并耗尽显存；利用稀疏激活与可估计调用顺序，提出 invocation distance 做主动预取与优先级驱逐。局限：摘要 "up to 1…" 处截断，倍数无法引用，且依赖调用顺序可估计。
  - `[arXiv:2603.10062v2] Multi-Agent Memory from a Computer Architecture Perspective`：区分共享/分布式记忆，提出 I/O、cache、memory 三层记忆层次，指出跨 agent 缓存共享与结构化访问控制两个协议缺口，认为多 agent 记忆一致性最紧迫。
- 共同假设与失效：假设访问模式可预测、状态可迁移；失效于顺序不可估计与跨 agent 一致性缺失。

### 2.6 评测与治理论：从准确率到生命周期风险

- 核心思想：只测 recall 会高估系统，需测多会话任务、遗忘、投毒、越权与成本。
- 代表工作：
  - `[arXiv:2605.18421v3] EvoMemBench`：按记忆范围（episode 内/跨 episode）与内容（知识/执行）两轴组织，横评 15 种记忆方法与强长上下文基线，结论是当前系统远非通用解、长上下文基线仍极具竞争力。
  - `[arXiv:2607.27080v1] MemSecBench`：310 个案例、48 个真实上下文，按 Write-Execute-Forget 协议追踪同一恶意语义从持久化到后果再到修复。
  - `[arXiv:2610.25707v1] Whose Credential Is It?`：AppWorld 中混合 763 条历史登录的记忆库对 84.7% 的必需应用检出他人凭证，但 agent 很少行动；在缺本人凭证的压力测试下，7 个 agent 有 80%-94% 的运行使用他人凭证，最多 43% 改变受害者账户；在凭证行标注 owner 可阻止大部分误用。
  - 其他：MemGauge 跨 11 个 LLM、2 个基准观察到写入阈值式风险跃迁、管理阶段策略相关解耦、效用与风险同步增长 [arXiv:2608.30177v1]；Memory Echo 定义同源记录的过量检索暴露并用 Family-Provenance-Authority 缓解 [arXiv:2610.17763v1]；Memora 的 FAMA、SciValidityBench 分别补上过期记忆与"事实可用性"两个维度 [arXiv:2604.20006v1][arXiv:2610.34767v1]；FragFuse 与 Heartbeat 展示记忆作为跨会话攻击通道 [arXiv:2606.15609v1][arXiv:2603.23064v3]；SSGM 则把一致性校验与访问控制前置到巩固之前 [arXiv:2603.11768v2]。
- 共同假设与失效：假设基准任务代表真实部署、攻击面在单次查询；失效于跨会话时间通道、后台执行污染与成本未计入。

## 3. 2025-2026 最新进展

最近 12 个月有五个假设被打破。

1. "结构越复杂越好"被反证。Raw-RAG 用原始历史的 dense retrieval + rerank，在四个基准、七个设置中六个排名第一，比最强 agentic memory 高 0.13-5.53 分，原因是原始证据覆盖率更高可抵消利用率劣势 [arXiv:2610.30755v1]；EvoMemBench 发现长上下文基线仍极具竞争力 [arXiv:2605.18421v3]；介质横评显示没有单一 substrate 持续占优 [arXiv:2608.15008v1]。
2. 评价目标从 accuracy 转向 Pareto：DolphinBench 把成本/时间纳入前沿 [arXiv:2609.24971v2]，系统刻画把 construction/retrieval/generation 分阶段归因 [arXiv:2606.06448v2]。
3. 从 append-only 转向可版本化、可回滚、可遗忘：ChronoMem 每次写入快照并支持自然语言回滚 [arXiv:2607.27773v2]，Bemula 把 unlearning 变成一等评测 [arXiv:2610.18052v1]。
4. 治理与安全成为一等公民：GEM 把正确性定义在状态轨迹上 [arXiv:2605.26252v1]，SSGM 把校验前置到巩固之前 [arXiv:2603.11768v2]，MemSecBench 追踪持久化到修复 [arXiv:2607.27080v1]，owner attribution 显示最小字段即可阻断大部分跨用户误用 [arXiv:2610.25707v1]。
5. 架构借鉴对象从认知科学转向数据库与体系结构：GEM 的算子化 [arXiv:2605.26252v1]、多 agent 三层记忆层次与一致性 [arXiv:2603.10062v2]、invocation distance 预取 [arXiv:2601.21473v1] 都是 DB/OS 语言。
6. 写入成本被正面处理：MemFit 用无 LLM 追加写 [arXiv:2610.00872v1]，D-MEM 直指 O(N^2) 写延迟 [arXiv:2603.14597v1]，MemReader 用小模型+RL 决定是否写 [arXiv:2604.07877v2]。

## 4. 横向对比

年份取文件中的发布年份。

| 代表工作 | 年份 | 存储层次 | 核心机制 | 声称收益 | 主要局限 |
|---|---|---|---|---|---|
| Agent Memory as Recommendation [arXiv:2610.34673v1] | 2026 | 选择/检索层 | 预算受限 slate 推荐 | 统一设计空间（摘要未给数字） | 未给实验 |
| SwiftMem [arXiv:2601.08160v2] | 2026 | 向量+时间+语义索引 | query-aware 子集收窄 | 对数时间范围查询 | 维护与一致性未给 |
| MemFit [arXiv:2610.00872v1] | 2026 | append-only 原文+段摘要 | 无 LLM 写入、多路重排 | 近即时插入（无数字） | 未给量化 |
| Raw-RAG [arXiv:2610.30755v1] | 2026 | 原始历史+dense 索引 | 原文检索+重排 | 6/7 设置第一，+0.13-5.53 分 | 依赖原文留存 |
| GEM [arXiv:2605.26252v1] | 2026 | 数据管理层 | 四状态算子+六条件 | 概念框架 | 无实现评测 |
| PolyMemDB [arXiv:2608.25577v2] | 2026 | 图/向量/概率/时空多引擎 | polyglot+provenance | 降幻觉（摘要截断） | demo |
| ChronoMem [arXiv:2607.27773v2] | 2026 | 版本层 | 每写快照+语义回滚 | 可回滚（无数字） | 快照放大未给 |
| Infini Memory [arXiv:2606.10677v1] | 2026 | topic 文档 | buffer+consolidate+agentic 检索 | 64.7% MemoryAgentBench | 维护开销未展开 |
| H-Mem [arXiv:2605.15701v1] | 2026 | 时间+语义树 | 短→长演化 | 摘要未给数字 | 无量化对比 |
| MemCode [arXiv:2610.19472v1] | 2026 | 离散 codebook+向量 | AMU+ISQ+共现拓扑 | 摘要未给数字 | codebook 成本未给 |
| MemReader [arXiv:2604.07877v2] | 2026 | 写入侧抽取器 | 0.6B/4B GRPO | 降污染（无数字） | 需训练 |
| ScaleSim [arXiv:2601.21473v1] | 2026 | GPU HBM/前缀缓存 | invocation distance 预取/驱逐 | 摘要截断 | 依赖顺序可估计 |
| EvoMemBench [arXiv:2605.18421v3] | 2026 | 评测 | 两轴 15 方法 | 长上下文基线仍强 | 基准非系统 |
| MemSecBench [arXiv:2607.27080v1] | 2026 | 评测 | Write-Execute-Forget | 310 案例 | 基准非系统 |

## 5. 对存储系统设计的启示

1. **接口层**：把记忆 API 从 `add/search` 改为 `ingest / revise / forget / retrieve` 四算子，每次返回必须携带 provenance（源 turn、时间、owner、权威级）。GEM 的六条正确性条件可直接作为契约测试 [arXiv:2605.26252v1]；owner 字段不是可选元数据，而是阻断跨用户凭证误用的最小充分条件（暴露率 84.7%，标注后大部分阻断）[arXiv:2610.25707v1]。
2. **索引结构**：至少三路并存——时间范围索引、实体-属性倒排、向量/HNSW；查询先路由再检索。SwiftMem 的时间对数查询与 DAG-Tag 是这一形态的实例 [arXiv:2601.08160v2]，EnSIMem 的 `[entity][entity_type][property:value]` 给出可落地 schema [arXiv:2609.27279v2]。单一向量索引在长历史下既慢又漏逻辑相关证据 [arXiv:2610.19472v1][arXiv:2601.08160v2]。
3. **放置策略**：按写频与访问局部性分层。verbatim 原文与 append-only 日志放对象存储/文件系统 [arXiv:2610.00872v1][arXiv:2607.26637v1]；topic document 或 entity 索引放可更新的文档/关系层 [arXiv:2606.10677v1][arXiv:2607.04391v1]；agent 私有前缀缓存、adapter、模型副本放 HBM，并用 invocation distance 预取、按优先级驱逐 [arXiv:2601.21473v1]。
4. **写路径**：在线只做原子追加与轻量抽取，把合并、去重、schema 归纳放到异步 consolidation [arXiv:2610.19472v1][arXiv:2606.10677v1]；为写入设准入阈值，因为 MemGauge 观察到写入阶段存在阈值式风险跃迁 [arXiv:2608.30177v1]；用小模型或规则做价值评估，避免每次历史数百到数千次 LLM 调用 [arXiv:2610.34673v1][arXiv:2604.07877v2]。
5. **版本与删除**：采用 copy-on-write 或增量快照而非每次全量快照（ChronoMem 的全量快照开销摘要未给）[arXiv:2607.27773v2]；为 unlearning 提供"精确删除 + 派生摘要级联失效"原语，否则 Bemula 类请求无法满足 [arXiv:2610.18052v1]；用 source family 去重抑制 Memory Echo [arXiv:2610.17763v1]。
6. **安全与放置的交叉**：访问控制必须作用在检索层，因为 FragFuse 证明被拒内容可碎片化存入记忆再在检索时重组 [arXiv:2606.15609v1]；后台 heartbeat 与前台会话应使用隔离的记忆命名空间与来源标签 [arXiv:2603.23064v3]。

## 6. 必读五篇

1. `[arXiv:2605.26252v1] Is Agent Memory a Database?`——唯一把"正确性=状态轨迹"讲透并给出四算子与六条件的框架，决定接口设计。
2. `[arXiv:2610.34673v1] Agent Memory as Recommendation`——把记忆选择形式化为预算受限推荐，是理解读路径成本模型的最佳入口。
3. `[arXiv:2610.30755v1] Is Complex Agentic Memory Always Needed?`——最重要的反直觉基线，任何新记忆系统都应先打败 Raw-RAG。
4. `[arXiv:2606.06448v2] Agent Memory: Characterization and System Implications`——首个系统级刻画，给出 construction/retrieval/generation 的成本归因方法。
5. `[arXiv:2608.15008v1] Harness the Memory`——介质横评证明没有万能 substrate，是做放置策略前的必读对照。