# 国内学术与产业研究

> 说明：本方向以国产模型生态（DeepSeek、Kimi、GLM 等）与国内产业系统（阿里云、MaxCompute 等）为检索线索；文件未给出作者机构，本文不推断单位。文件实际收录 13 条（13/48），本文全部覆盖。数字均来自摘要，截断处标注“摘要未给出”。

## 1. 问题定义与为什么它是存储问题

国产大模型的主流路线正把推理成本从算力转移到存储，三个变化叠加。

其一，MLA 把 KV 压成低秩 latent，但 tensor parallelism 下每个设备仍要加载完整 cache，压缩优势被稀释 [arXiv:2508.15881v2]。其二，Agentic 负载每轮把相同 token 放到偏移位置，前缀缓存在第一个分歧字节处失效，运营方报告未变内容上出现 10-16 秒 TTFT 尖峰 [arXiv:2605.05696v1]。其三，MoE 与端侧模型让权重常驻内存成为硬约束，权重存储与 IO 占大模型开销的绝大部分 [arXiv:2404.12759v1]。

推荐与在线学习侧同样如此：长行为序列使延迟与存储成本随序列长度近似线性增长 [arXiv:1905.09248v3]；在线学习有数千亿参数，需秒级完成模型部署 [arXiv:2011.11983v1]。云存储侧则是日志结构存储的垃圾回收写放大 [arXiv:2104.12425v3]。

核心矛盾是：模型侧用低秩、稀疏、低比特持续压缩表示，真实负载却持续制造不可压缩的复用与一致性需求。关键指标从容量转为 TTFT、cache 命中/恢复率、每设备 KV footprint、比特宽、写放大 WA、常驻内存与秒级更新的一致性窗口。

## 2. 技术流派

### 2.1 MLA 原生 KV 缓存：把 KV 变成可分片、可寻址的对象

核心思想：MLA 的低秩结构使 KV 不再是不可分的字节串，而是“位置无关的 c_KV + 可闭式修正的 k_r”；应按模型结构重设 cache 的分片、键控与复用，而非在 GQA 时代的前缀缓存上打补丁。

- [arXiv:2508.15881v2] TPLA: Tensor Parallel Latent Attention for Efficient Disaggregated Prefill and Decode Inference
  机制：把 latent 表示与每个 head 的输入维度一起按设备切分，各 shard 独立算 attention，再 all-reduce 合并；与 MLA 预训练模型 drop-in 兼容，无需重训。与 Grouped Latent Attention 不同，每个 head 仍使用完整 latent 表示。
  关键结果：摘要在此截断，per-device KV 降幅与加速比“摘要未给出”。
  局限：all-reduce 通信开销；收益依赖 TP 拓扑与互联；分片数值一致性需逐模型验证。

- [arXiv:2605.05696v1] Irminsul: MLA-Native Position-Independent Caching for Agentic LLM Serving
  机制：指出 GQA 时代的 position-independent caching 要在完整 d_K 维 key 上修 RoPE，而 MLA 把每行 KV 分解为位置无关的 c_KV 与 64 维、可闭式修正的 k_r；据此在 SGLang 的 radix cache 上做 CDC 分块的内容哈希键控，并用 δ-rotation 规则修正 k_r。摘要主张内容寻址缓存应成为 serving 一等原语，而非前缀匹配的补丁。
  关键结果：论文称运营方在未变内容上观察到 10-16 秒 TTFT 尖峰；恢复率与 prefill 节能数字在 900 字符外，“摘要未给出”。
  局限：强绑定 MLA 与 SGLang；跨模型、跨版本缓存共享未讨论；CDC 块边界影响命中率。

共同假设：KV cache 是推理主瓶颈，MLA 低秩分解在部署中稳定。失效场景：非 MLA 模型；严格绝对位置任务；TP 拓扑变化使 shard 布局与缓存键同时失效。

### 2.2 权重压缩：低比特、基分解与 MoE 运行时

核心思想：把权重存储与 IO 视作主要成本，用低比特量化或共享基分解缩小 checkpoint，并用运行时调度接住压缩后的不规则计算。

- [arXiv:2404.12759v1] decoupleQ: Towards 2-bit Post-Training Uniform Quantization via decoupling Parameters into Integer and Floating Points
  机制：放弃启发式量化，把参数解耦为整数部分与浮点部分，将量化转为数学问题；面向 weight-only 场景，目标是 2-bit 后训练均匀量化。
  关键结果：摘要截断，压缩率与精度收益“摘要未给出”。
  局限：极低比特鲁棒性、算子与硬件支持未展开。

- [arXiv:2508.05257v1] MoBE: Mixture-of-Basis-Experts for Compressing MoE-based LLMs
  机制：对每个 expert 的 up/gate 矩阵做秩分解 W=AB，A 为每个 expert 独有，较大的 B 再表示为基矩阵的线性组合，从而在 expert 间共享存储。摘要点名 DeepSeek-V3-0324 与 Kimi-K2-Instruct 的显存压力。
  关键结果：论文声称已有 MoE 压缩方法在中等压缩率下仍有 7-14% 的相对精度下降；MoBE 自身压缩率与精度在截断处，“摘要未给出”。
  局限：基数量与秩分配是超参；推理时组合基矩阵可能引入额外计算。

- [arXiv:2605.22064v2] Hy-MT2: A Family of Fast, Efficient and Powerful Multilingual Translation Models in the Wild
  机制：1.8B、7B、30B-A3B（MoE）三档多语言翻译模型，支持 33 种语言；配合 AngelSlim 的 1.25-bit 极端量化用于端侧。
  关键结果：论文声称 1.8B 模型仅需 440 MB 存储，并取得 1.5x 推理加速。
  局限：翻译任务专用；1.25-bit 下通用能力与长尾语言质量未给出。

- [arXiv:2607.23099v3] Decoding the Skew: Distribution-Aware MoE Inference with Adaptive Kernel Dispatch
  机制：提出 Effective Experts 指标与基于 Dirichlet 的反向建模，生成可控路由分布；DA-MoE 把实时路由直方图匹配到离线调优分布，选择近最优 fused-MoE kernel。摘要指出最优 kernel 随路由倾斜与 token 数变化，静态 token-count 分桶不够。
  关键结果：摘要截断，加速比“摘要未给出”。
  局限：依赖离线调优分布，漂移时需重标定。

共同假设：权重静态、可按比特或秩压缩；路由分布可离线刻画。失效场景：训练态；频繁更新的在线学习；对长尾 expert 或低比特敏感的任务。

### 2.3 上下文外部化：把“记忆”移出 KV

核心思想：不继续扩大 KV cache，而把 prompt 或中间状态卸载到外部环境（如 REPL），让模型按需检索、递归调用，用存储换上下文窗口。

- [arXiv:2603.02615v1] Think, But Don't Overthink: Reproducing Recursive Language Models
  机制：复现 Zhang 等人（2026）的 Recursive Language Models，把 prompt offload 到外部 REPL 以处理近无限上下文；原论文默认递归深度 1，本文专门研究加深递归。作者用 DeepSeek v3.2 与 Kimi K2 在 S-NIAH、OOLONG 上比较 pure LLM、RLM(depth=1)、RLM(depth=2)。
  关键结果：摘要称更深递归会让模型“overthink”；depth=1 在复杂推理上有效，depth=2 或用于简单检索反而变差。具体分数“摘要未给出”。
  局限：单作者复现，基准有限；外部 REPL 的存储、检索与一致性成本未量化。

共同假设：上下文可外置，检索成本低于扩 KV。失效场景：低延迟推理；强一致要求；需要全局注意力的任务。

### 2.4 云数据仓库与学习型系统：元数据、统计与 trace 也是存储

核心思想：生产瓶颈往往不是纯容量，而是统计缺失、计划缓存、trace 存储与负载漂移；这一流派强调可部署性优先。

- [arXiv:2602.07336v1] Learned Query Optimizer in Alibaba MaxCompute: Challenges, Analysis, and Solutions
  机制：以阿里 MaxCompute 为代表，列出学习型优化器的四类系统挑战：执行环境动态导致代价方差大、输入统计可能缺失、常规模型精炼不可行、跨负载收益不确定；据此提出 LOAM 框架，主张 deployment-first 重设计。
  关键结果：摘要未给出量化收益。
  局限：与 MaxCompute 的统计与执行体系强耦合。

- [arXiv:2104.12425v3] Separating Data via Block Invalidation Time Inference for Write Amplification Reduction in Log-Structured Storage
  机制：证明存在利用未来 block invalidation time (BIT) 的最优放置，但实际不可行；SepBIT 从负载推断每个写入块的 BIT，把相似 BIT 的块分组放置，并用数学与生产 trace 论证写倾斜性足以支撑推断。
  关键结果：论文声称 SepBIT 降低写放大、提升 I/O 吞吐，且已部署支持阿里云的日志结构块存储管理；具体数值“摘要未给出”。
  局限：BIT 推断误差与负载漂移影响分组质量。

- [arXiv:2604.26422v1] STLGT: A Scalable Trace-Based Linear Graph Transformer for Tail Latency Prediction in Microservices
  机制：把 trace 编码为 span graph，用结构感知线性 graph Transformer 传播跨服务依赖，推理时间随 span graph 规模线性增长；解耦时间模块捕捉负载动态，做多步 p95 尾延迟预测。
  关键结果：论文声称在个性化教育微服务、DeathStarBench 与阿里 trace 上，MAPE 平均优于 PERT-GNN 8.5%，N=32 时 CPU 推理快至 12x。
  局限：预测器不解决数据放置；trace 存储与保留成本未讨论。

共同假设：生产负载可用统计与历史 trace 近似。失效场景：冷启动、统计缺失、突发流量。

### 2.5 推荐与在线学习：长序列特征与秒级参数

核心思想：用户行为序列与模型参数是两类持续增长的热存储对象，前者按长度线性膨胀，后者要求秒级版本切换。

- [arXiv:1905.09248v3] Practice on Long Sequential User Behavior Modeling for Click-Through Rate Prediction
  机制：面向 CTR 预测的长行为序列建模，摘要明确指出系统延迟与存储成本随序列长度近似线性增长，这是工业部署的核心障碍。
  关键结果：摘要截断，具体方法与收益“摘要未给出”。
  局限：序列压缩、淘汰与冷启动策略未展开。

- [arXiv:2011.11983v1] WeiPS: a symmetric fusion model framework for large-scale online learning
  机制：在线学习有数百亿参数，实时部署困难且稳定性关键；WeiPS 把训练与推理融合为对称结构，通过流式更新实现秒级模型部署，并采用多级机制满足一致性要求（摘要在此截断）。
  关键结果：摘要未给出量化指标。
  局限：版本一致性、回滚与故障恢复未展开。

- [arXiv:2508.05206v2] Bidding-Aware Retrieval for Multi-Stage Consistency in Online Advertising
  机制：广告级联架构中，检索阶段拿不到海量广告的实时精确 bid，与按 eCPM 分配的排序阶段不一致；BAR 用单调性约束学习与多任务蒸馏把 bid 信号注入检索打分。
  关键结果：摘要未给出量化收益。
  局限：摘要截断，存储与索引侧影响未讨论。

共同假设：特征与参数持续膨胀，用流式更新和索引解耦吸收增长。失效场景：秒级强一致、超长序列冷启动、检索与排序特征不同步。

## 3. 2025-2026 最新进展

最近 12 个月出现五个变化。

第一，KV 缓存从压缩表示转向可寻址复用。Irminsul（2026-05）把 content-addressed caching 提升为 serving 一等原语，TPLA（2025-08）把 MLA latent 切片与 TP 结合；二者都不再假设前缀命中是唯一复用方式。

第二，Agentic 负载成为一等设计假设。相同 token 的偏移放置让字节前缀缓存在第一个分歧处失效，10-16 秒 TTFT 尖峰被明确量化 [arXiv:2605.05696v1]，打破了“命中率约等于前缀匹配率”的旧假设。

第三，权重侧走向极端量化与共享基分解。Hy-MT2 用 1.25-bit 把 1.8B 模型压到 440 MB [arXiv:2605.22064v2]；MoBE 用共享基降低 MoE checkpoint 体积 [arXiv:2508.05257v1]；decoupleQ 把 2-bit 均匀量化转为整数/浮点解耦 [arXiv:2404.12759v1]。

第四，“不扩 KV”的第二条路出现。RLM 复现把 prompt 卸载到外部 REPL，并发现递归深度不是越深越好 [arXiv:2603.02615v1]，提示上下文存储可与 KV 存储解耦。

第五，学习型系统转向 deployment-first。LOAM 列出动态环境、统计缺失、模型精炼不可行、收益不确定四类挑战 [arXiv:2602.07336v1]；MoE 运行时按实时路由分布选 kernel [arXiv:2607.23099v3]。这说明产业界更关心能否上线，而非理想化假设下的最优。

## 4. 横向对比

| 代表工作 | 年份 | 存储层次 | 核心机制 | 声称收益 | 主要局限 |
|---|---|---|---|---|---|
| TPLA [arXiv:2508.15881v2] | 2025 | GPU HBM / KV cache | latent 与 head 输入维度按 TP 切分，all-reduce 合并 | 摘要截断，per-device KV 与加速比未给出 | 通信开销；依赖 MLA 预训练 |
| Irminsul [arXiv:2605.05696v1] | 2026 | GPU/DRAM KV cache、SGLang radix cache | CDC 分块内容哈希 + k_r 的 δ-rotation | 量化 agentic TTFT 尖峰 10-16s；恢复率/节能未给出 | 绑定 MLA 与 SGLang |
| decoupleQ [arXiv:2404.12759v1] | 2024 | 权重存储/IO | 参数解耦为整数+浮点，2-bit 均匀 PTQ | 摘要未给出 | 极低比特鲁棒性 |
| MoBE [arXiv:2508.05257v1] | 2025 | MoE 权重 | W=AB，B 为共享基的线性组合 | 论文声称对比方法有 7-14% 相对精度下降 | 基/秩选择；组合开销 |
| Hy-MT2 [arXiv:2605.22064v2] | 2026 | 端侧权重 | AngelSlim 1.25-bit 量化 | 论文声称 440 MB、1.5x 推理加速 | 翻译专用 |
| DA-MoE [arXiv:2607.23099v3] | 2026 | GPU kernel/专家权重 | 路由直方图匹配 + 自适应 kernel 调度 | 摘要未给出 | 依赖离线调优分布 |
| Think/RLM [arXiv:2603.02615v1] | 2026 | 外部 REPL/上下文 | prompt offload + 递归调用 | depth=1 提升复杂推理；depth=2 overthink | 单作者复现；无绝对分数 |
| LOAM [arXiv:2602.07336v1] | 2026 | 数仓元数据/统计 | deployment-first 学习型优化器 | 摘要未给出 | 与 MaxCompute 耦合 |
| SepBIT [arXiv:2104.12425v3] | 2021 | 日志结构块存储 | 推断 BIT，按相似 BIT 分组放置 | 论文声称降低 WA、提升吞吐；数值未给出 | BIT 推断误差 |
| STLGT [arXiv:2604.26422v1] | 2026 | trace/可观测数据 | span graph + 线性 graph Transformer | 论文声称 MAPE 优 8.5%、CPU 推理 12x | 不直接解决放置 |
| Long Seq CTR [arXiv:1905.09248v3] | 2019 | 用户行为序列 | 长序列建模（摘要截断） | 摘要未给出 | 存储/延迟随长度线性增长 |
| WeiPS [arXiv:2011.11983v1] | 2020 | 在线学习参数 | 训练推理对称融合 + 流式更新 | 论文声称秒级部署 | 一致性与回滚未展开 |
| BAR [arXiv:2508.05206v2] | 2025 | 广告检索索引/特征 | bid-aware 检索打分 + 蒸馏 | 摘要未给出 | 存储影响未讨论 |

## 5. 对存储系统设计的启示

1. **KV 对象接口要内容寻址，而非路径寻址。** 键至少包含 model_id、layer、head_group、token_span_hash 与 MLA 版本，值拆成 c_KV 与 k_r 两列；CDC 分块应尽量对齐轮次、工具调用、文档段等语义边界，否则块边界漂移会吞掉命中率 [arXiv:2605.05696v1]。

2. **KV 布局要按 TP shard 拥有，而非每卡全量。** TPLA 表明 latent 与 head 输入维度都可切分；存储层应把 shard_id 写进对象元数据，让每个 rank 只加载自己的分片，并保证 all-reduce 前同 key 的 shard 同时可见 [arXiv:2508.15881v2]。

3. **淘汰策略要从 LRU 字节前缀转向跨会话引用计数。** Agentic 复用是跨轮次、非连续的，按内容哈希统计跨会话引用次数更贴近真实 reuse distance；k_r 这类小列可单独常驻，c_KV 大列才下沉 [arXiv:2605.05696v1]。

4. **权重存储格式要原生支持低比特与基分解。** checkpoint 应支持 1.25/2-bit packed、per-group scale，以及 MoE 的“每 expert A + 共享基 B”布局，加载时惰性物化 B [arXiv:2605.22064v2][arXiv:2508.05257v1]；同时把 routing histogram 作为旁路元数据写入，供 DA-MoE 类运行时选 kernel [arXiv:2607.23099v3]。

5. **为学习型系统提供版本化统计与 plan cache。** LOAM 的四类挑战说明统计缺失与动态环境是主要失败源；存储层应提供带版本号、可回放的统计快照与计划缓存，避免优化器运行时反复扫描 [arXiv:2602.07336v1]。

6. **在线学习需要秒级一致性与可回滚的参数流。** WeiPS 的流式更新要求存储层提供 delta 日志、版本号与双缓冲切换；日志结构存储可把 BIT 推断作为 compaction 放置 hint，按失效时间分 stream 降低 WA [arXiv:2011.11983v1][arXiv:2104.12425v3]。

## 6. 必读五篇

1. [arXiv:2508.15881v2] TPLA — 解释 MLA 在 TP 下压缩收益被每卡全量加载稀释的根因，是 KV 分片设计的起点。
2. [arXiv:2605.05696v1] Irminsul — 把 content-addressed caching 提升为 serving 一等原语，是 agentic 负载打破前缀缓存假设的最佳案例。
3. [arXiv:2508.05257v1] MoBE — MoE 权重共享基分解的代表，直接对应 checkpoint 存储格式与加载策略。
4. [arXiv:2104.12425v3] SepBIT — 国内云存储把失效时间推断用于数据放置的少有落地案例，提供 WA 问题的经典分析框架。
5. [arXiv:1905.09248v3] Practice on Long Sequential User Behavior Modeling for CTR Prediction — 明确指出推荐侧存储成本随序列长度线性增长，是“长序列即存储问题”的第一性陈述。