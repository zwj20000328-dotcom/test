# KV Cache 压缩、量化、稀疏与驱逐

## 1. 问题定义与为什么它是存储问题

这个方向的核心矛盾可以一句话概括：**decode 每一步都要把全部历史 K/V 从 HBM 重新读回片上，而 KV 随序列长度线性增长**。计算量只随长度线性增加，但"被搬运的字节数"同样线性增加，且模型权重是静态的、KV 是动态的，二者在同一条 HBM 带宽上竞争。`[arXiv:2609.30854v1]` 给出的数字很能说明问题：Llama-3-70B 在 BF16 下权重占 140 GB，已超过单卡 80 GB HBM；一条 128k token 的序列再追加 42 GB KV。于是"上下文"从抽象概念变成了一等存储对象——它有生成、压缩、复用、取回、释放的完整生命周期。

一旦这样看，问题就落回存储系统熟悉的框架：**容量、带宽、放置、编码格式、元数据**。关键指标也随之变化，不再是单纯的"压缩比"，而是：给定质量损失下的 bit/token、有效可服务上下文长度、decode 吞吐（tokens/s）、TTFT、以及压缩/解压本身消耗的带宽——后者经常被论文忽略，却可能吃掉全部收益。真正困难的是，KV 的重要性是 **query 相关、层相关、位置相关** 的，而存储系统希望数据是自描述、可随机寻址的，二者存在结构性张力。

## 2. 技术流派

### 2.1 基于重要性估计的 token 驱逐

核心思想：attention 在长上下文上高度稀疏，只需保留少量"重要" token 的 KV，其余丢弃。分歧在于**用什么信号判断重要性**，以及**在什么时刻判断**。

**`[arXiv:2610.06286v1]` DeferKV: Rethinking Eviction Timing for One-Shot KV Cache Compression**
机制：作者指出一次性压缩方法在 prefill 结束时就做出不可逆驱逐，此时还没有任何真实生成信号；其量化分析显示，生成阶段最早的几个 query 与后续 decode 的 attention 更一致，单步收益最大点就在 prefill–decode 边界。DeferKV 因此把驱逐决策推迟到**第一个真实 decode step**，并时序融合 prompt 侧与 decode 侧的观测。局限：决策仍然只做一次，超长生成下后续 query 漂移无法纠正；且推迟意味着峰值显存要短暂容纳未压缩 KV。

**`[arXiv:2505.20334v2]` Lookahead Q-Cache: Achieving More Consistent KV Cache Eviction via Pseudo Query**
机制：用低成本"伪前瞻 query"模拟真实 decode query，作为重要性估计的观察窗口，从而缓解 prefill 打分与推理 query 不一致的问题。在 LongBench 与 Needle-in-a-Haystack 上优于已有方法（摘要未给出具体数字）。局限：伪 query 只是近似，构造本身有额外前向开销；预算极紧时近似误差被放大。

**`[arXiv:2606.29563v1]` Coverage-Driven KV Cache Eviction for Efficient and Improved Inference of LLM**
机制：作者把长上下文推理性能下降归因于**唯一 token 覆盖率下降**，并从理论上说明覆盖率降低会限制互信息，据此设计覆盖度驱动的选择策略，而不是纯 top-k 注意力。这是对"只保 attention 高分 token"的一次重要修正。局限：覆盖率与注意力分数是两个目标，权重需按任务调；摘要未给出统一的量化收益。

**`[arXiv:2610.03198v2]` KV$^2$: A Self-Refining KV Cache**
机制：面向"一次 prefill、多次不同 query"的可复用场景，先用轻量代理打分器挑出候选 token，再**只对候选子集做重处理**得到最终驱逐分数，兼顾廉价估计与全上下文重建的准确性。摘要声称在 RULER 16K、2% KV 预算下，平均分比次优基线高 40 以上（原文在 "40 p" 处截断，单位为 percentage points 的推断未被摘要明示）。局限：子集重处理仍是额外 prefill 成本；收益集中在可复用前缀。

**`[arXiv:2606.03928v1]` Value-Aware Stochastic KV Cache Eviction for Reasoning Models**
机制：发现少数 value state 幅度异常大，驱逐它们会让模型陷入重复推理循环；同时在驱逐中引入随机性可提升 cache 多样性。VaSE 是 training-free 的"保护大幅值 value + 多样化驱逐"配方，在六个推理任务上评估（摘要未给统一数字）。局限：结论绑定 reasoning 负载，通用对话是否成立摘要未给出。

该流派的共同假设是：**重要性可由少量 query 或注意力质量代理，且被驱逐内容未来不会被重新需要**。失效场景很明确：多指令 prompt 中某些指令会被整体忽略、系统提示可能泄漏（见 `[arXiv:2510.00231v2]`）；需要全局证据聚合的任务（多文档推理、代码库级理解）上，token 级 top-k 天然丢证据。其他同类工作包括 Judge Q 的可训练 soft token 观察窗 `[arXiv:2509.10798v2]`、MomentKV 指出的"保留集与驱逐集方向失配" `[arXiv:2606.01563v1]`、以 KL 散度为目标的 Behavior-Preserving 压缩 `[arXiv:2610.06479v1]`、基于 Jacobian 信息容量的 Jacap `[arXiv:2609.08131v1]`、图传播的 GraphKV `[arXiv:2509.00388v1]`、层次预算的 EvolKV `[arXiv:2509.08315v1]`、全局打分的 G-KV `[arXiv:2512.00504v1]`、多轮隔离的 FlowKV `[arXiv:2505.15347v2]`，以及 head 级预算的 HeadKV `[arXiv:2410.19258v4]` 与 Ada-KV `[arXiv:2407.11550v5]`。

### 2.2 量化、低秩与稀疏编码

核心思想：不丢 token，而是降低每个元素的 bit 数或秩。这条线的存储意味最直接——它改变的是**每字节承载的信息密度**，而不是数据的存在性。

**`[arXiv:2605.08317v1]` RDKV: Rate-Distortion Bit Allocation for Joint Eviction and Quantization of the KV Cache**
机制：把 KV 压缩形式化为 rate-distortion 问题，驱逐与量化被视为同一 bit allocation 谱系的两个端点；每个 token/channel 的权重由压缩对 attention 计算造成的失真导出，从而联合优化二者。这是本方向少见的、把"丢哪些"和"存多精"统一进一个目标函数的工作。局限：需要估计失真权重，per-token/per-channel 元数据本身占空间；摘要未给出端到端数字。

**`[arXiv:2412.08890v1]` Lexico: Extreme KV Cache Compression via Sparse Coding over Universal Dictionaries**
机制：发现现代 LLM 的 KV 可用约 4k 个**输入无关原子**的稀疏线性组合近似，用正交匹配追踪（OMP）做稀疏逼近，通过直接控制稀疏度获得任意压缩比。摘要声称在 GSM8K 上跨 Mistral、Llama 3、Qwen2.5，仅用 15–25% 的完整 KV 内存即可保持 90–95% 原始性能，优于量化与 token 驱逐；在 2-bit 量化失效的低内存区间，于 LongBench 与 GSM8K 上取得最高 1.7x 更好压缩。局限：OMP 解码是迭代过程，decode 路径上延迟不低；通用字典需额外驻留，字典质量决定上限。

**`[arXiv:2405.14256v1]` ZipCache: Accurate and Efficient KV Cache Quantization with Salient Token Identification**
机制：提出 channel-separable tokenwise 量化，把量化参数开销从细粒度 groupwise 中降下来；并用归一化注意力识别显著 token，对其保留更高精度。它实际上把"量化"和"token 选择性"缝在了一起。局限：显著 token 判定仍是注意力代理，高压缩比下误判会累积；摘要未给出统一数字。

**`[arXiv:2506.18879v1]` CommVQ: Commutative Vector Quantization for KV Cache Compression**
机制：用带轻量 encoder 与 codebook 的加性量化压缩 KV，解码只需矩阵乘；更关键的是把 codebook 设计成**与 RoPE 可交换**，并用 EM 训练，使解码可直接融入 self-attention，避免先反量化再算 attention。这是"压缩格式与算子协同"的典型。局限：codebook 需训练且与模型绑定，跨模型迁移成本高。

**`[arXiv:2603.20616v1]` Beyond Token Eviction: Mixed-Dimension Budget Allocation for Efficient KV Cache Compression**
机制：把 token 驱逐看作"每 token 只能取 0 或全维度"的粗糙降维，MixedDimKV 让 token 获得**分数维度**，并给出融合 head 级重要性的 MixedDimKV-H；在长上下文基准上超过不做 head 重要性分析的压缩方法，且在同等 head 信息下稳定优于 HeadKV。局限：变长维度对存储布局与 kernel 极不友好，实际部署需专门 allocator。

低秩与跨层方向还有 xKV 用 CKA 发现跨层主导奇异向量对齐、做分组层联合分解，声称最高 8x 压缩 `[arXiv:2503.18893v2]`；iS-KV 指出在线更新基时旧 token 坐标仍留在旧基会导致历史漂移，提出 block-incremental SVD 的在线低秩压缩 `[arXiv:2610.02815v1]`。此外 QAQ 区分 key/value 对量化的不同敏感度 `[arXiv:2403.04643v2]`，No Token Left Behind 用重要性感知混合精度 `[arXiv:2402.18096v1]`，SparK 做通道级可恢复剪枝 `[arXiv:2508.15212v3]`，SWAN 用正交旋转剪枝实现**免解压** `[arXiv:2511.18936v1]`（摘要称 50–60% 每 token 内存节省），FAEDKV 用傅里叶变换做无偏保留 `[arXiv:2507.20030v1]`。共同假设是 KV 分布低熵/低秩；失效点是 outlier channel、跨层对齐不成立、以及量化解码带宽反超收益。

### 2.3 合并、重建与"近似无损"

核心思想：与其丢弃，不如把被淘汰的 KV **合并**成更少的代表，或用重建/校验保证输出等价。

**`[arXiv:2504.09936v2]` KeepKV: Achieving Periodic Lossless KV Cache Compression for Efficient LLM Inference**
机制：指出合并式方法会引入合并前后 attention 分布不一致，提出 Electoral Votes 机制记录合并历史，使单步压缩无损，并给出多步压缩的误差界。局限：合并历史是额外元数据，长序列下元数据本身需要压缩；实现比驱逐复杂得多。

**`[arXiv:2605.31105v3]` GRKV: Global Regression for Training-Free KV Cache Compression in Long-Context LLMs**
机制：观察到 span-based 保留 + 驱逐后合并会把合并压力集中到少量 span 边界载体 token 上，造成过合并与信息损失；GRKV 用全局回归直接最小化压缩 cache 与全量 cache 的差异来重新分配合并。局限：仍是训练无关的近似，摘要未给统一数字。

**`[arXiv:2605.17613v1]` VeriCache: Turning Lossy KV Cache into Lossless LLM Inference**
机制：这是本方向最重要的问题重述之一。作者指出几乎所有压缩方法都是有损的——短输出上看不出，但随着解码变长，输出会与全量 KV 越来越偏离，在代码生成与工具调用上导致灾难性失败。VeriCache 用压缩 KV **起草** token，再用全量 KV **校验**，从而保证与全量解码相同输出，同时保留压缩算法的高吞吐。摘要明确指出这不只是 speculative decoding，需要解决关键系统挑战（摘要在此截断，具体机制未给出）。局限：必须保留全量 KV 作为校验依据，**容量并未真正节省**，省的是平均访存与算力；这使它更像"正确性兜底"而非"容量扩展"。

该流派的共同假设是：合并/重建后的表示仍能支撑相同注意力语义；失效场景是合并 token 的注意力不可加、以及校验路径本身成为带宽瓶颈。

### 2.4 系统层：复用、放置、流式与调度

核心思想：压缩不只是"变小"，更是为了让 KV 能**跨请求复用、跨层级搬运、在压缩态直接参与计算**。

**`[arXiv:2310.07240v6]` CacheGen: KV Cache Compression and Streaming for Fast Large Language Model Serving**
机制：用自定义 tensor encoder 利用 KV 的分布特性，把 KV 编码成更紧凑的 bitstream，解码开销可忽略；并根据可用带宽自适应调整不同 KV 段的压缩级别，把"上下文加载"变成可流式传输的对象。这是最早把 KV 当"可传输存储对象"的工作之一。局限：目标是降低网络加载延迟，不是 decode 阶段的容量压缩；自适应策略依赖带宽观测。

**`[arXiv:2606.24506v2]` CrossPool: Efficient Multi-LLM Serving for Cold MoE Models through KV-Cache and Weight Disaggregation**
机制：指出冷 MoE 场景下权重稳定且由模型决定、KV 瞬态且由需求决定，为每个模型预留 worst-case KV 会浪费显存；CrossPool 把 FFN 权重与 KV 拆到不同池，用共享 KV 池按**聚合活跃需求**供给，并解决 cold、低并发下 KV head 受限导致的利用率问题。这是"KV 与权重生命周期分离"的最清晰系统论证。局限：收益依赖冷模型不会同时达到 KV 峰值这一统计假设；低并发下仍需处理 KV head 复制。

**`[arXiv:2607.17715v1]` C$^2$KV: Compressed and Composable KV Cache Reuse for Efficient LLM Inference**
机制：指出现有 KV 复用只关注省 prefill 计算，忽略了大 KV 的存储与访问成本；而把压缩与**非前缀复用**朴素结合会严重掉精度。C$^2$KV 学习一个可组合、位置无关的压缩 KV 流形，联合优化 KV 抽取与推理时拼接。这是"复用接口"与"压缩格式"必须联合设计的直接证据。局限：需要训练；位置无关表示的表达能力有上限。

**`[arXiv:2602.07721v3]` ParisKV: Fast and Drift-Robust KV-Cache Retrieval for Long-Context LLMs**
机制：用碰撞式候选选择加量化内积重排做 KV 检索，抗分布漂移；百万 token 场景下通过 UVA 支持 CPU-offloaded KV，按需 top-k 取回。摘要声称在长输入/长生成基准上匹配或超过全注意力质量，长上下文 decode 在 batch=1 时也能达到或超过全注意力速度，全注意力可运行区间内吞吐最高 2.8x，并可扩展到全注意力爆显存的百万 token。局限：top-k 取回的召回率与 PCIe 延迟是硬约束；检索索引本身占空间。

系统侧还有 Zipage 把 token 级驱逐与 PagedAttention 结合，声称在大规模数学推理上达到全量 KV 引擎约 95% 性能、2.1x 加速 `[arXiv:2603.08743v1]`；ThinKV 扩展 PagedAttention 以复用被驱逐 token 的 slot，消除 compaction 开销 `[arXiv:2510.01290v2]`。共同假设是 KV 可跨请求/跨层级自由搬运；失效点是位置编码破坏可组合性、以及取回带宽超过重算成本。

### 2.5 结构异质性：head、layer、expert、modality

核心思想：不同 head/layer/expert 对压缩的敏感度差异巨大，**统一配方是次优的**。

**`[arXiv:2610.30206v1]` MoEZip: Routing-Aware KV Cache Compression for Sparse Mixture-of-Experts LLMs**
机制：指出 MoE 特有的问题——KV 驱逐会改变生成时被选中的 expert，从而伤质量；用 routing 分布的 Fisher information matrix 度量 expert 路由对扰动的敏感度，再与 attention 权重组合成 routing-aware 打分。这把"压缩"与"模型内部路由"耦合了起来。局限：需要可观测路由分布，且 Fisher 估计有额外成本。

**`[arXiv:2604.17695v1]` MoE-nD: Per-Layer Mixture-of-Experts Routing for Multi-Axis KV Cache Compression**
机制：把 KV 张量看成 token（序列）、precision（量化）、head 维（低秩）、跨层共享四个轴，现有方法每层用同一配方；MoE-nD 用离线校准的贪心求解器，在全局内存预算下为每层路由一个 `(eviction-ratio, K-bits, V-bits)` 三元组，推理时通过单一 attention kernel 联合执行异构驱逐与量化。局限：离线校准与层配置搜索成本高，换模型需重跑。

**`[arXiv:2510.01290v2]` ThinKV: Thought-Adaptive KV Cache Compression for Efficient Reasoning Models**
机制：观察到 CoT 中不同"thought"重要性不同，attention 稀疏性可揭示 thought 类型；据此按 thought 重要性分配 token 精度并渐进驱逐次要 thought，同时改造 PagedAttention kernel 复用被驱逐 token 的内存槽。在 DeepSeek-R1-Distill、GPT-OSS、NVIDIA AceReason 的数学与代码基准上评估（摘要未给统一数字）。局限：依赖 CoT 的可分段结构，非推理模型无此信号。

**`[arXiv:2610.31098v1]` RIFT: KV Cache Compression for Draft Models with Complementary Compressibility Training**
机制：在 speculative decoding 的 draft model 上做选择式 KV 压缩，指出随输出变长会出现 **decode staleness**——prefill 阶段选的 KV 逐渐失效；RIFT 在生成过程中刷新选择以平衡 prefill 信息与近期 token，并用自适应刷新减少打分次数。局限：刷新带来额外 decode 延迟，是典型的"压缩省带宽、刷新费算力"权衡。

多模态方向有 RetentiveKV 指出视觉 token 存在"延迟重要性"、离散剪枝破坏空间连续性，改用 SSM 做连续记忆演化 `[arXiv:2605.04075v1]`；MadaKV 做模态偏好自适应 `[arXiv:2506.15724v1]`；SGD-KV 用 chunk-summarization 诊断任务识别聚合型 head，声称最高 75% 内存削减、支持 1M 上下文 `[arXiv:2609.03235v1]`；HAE 用双注意力剪枝处理视觉/文本异质分布 `[arXiv:2602.02197v1]`。层间异构路由的系统研究见 `[arXiv:2606.15157v2]`：在相同预算下，异构路由在 LongBench 多数任务上优于同构策略。共同假设被打破得很彻底：**层、头、专家、模态都不同质**。

## 3. 2025-2026 最新进展

**第一，重要性估计从 prefill 转向 decode-aligned。** DeferKV 把驱逐推迟到首个 decode step，LAQ 用伪前瞻 query，KV$^2$ 用子集重建，RIFT 直接命名 decode staleness，Behavior-Preserving 用对全量 cache 的 KL 定义目标。共识正在形成：prefill 末端的 attention 分数不是好的未来查询代理。

**第二，从"单请求压缩"转向"查询无关、可复用压缩"。** KVzip 用上下文重建量化重要性，声称 3–4x 削减、FlashAttention decode 延迟约 2x `[arXiv:2505.23416v2]`；KV$^2$ 与 C$^2$KV 进一步把它做成可跨 query、可组合的表示。SCBench 则把评测拆成生成、压缩、检索、加载四个阶段 `[arXiv:2412.10319v2]`，指出单请求评测掩盖了真实生命周期。

**第三，从单轴压缩转向联合 bit allocation。** RDKV 统一驱逐与量化，MoE-nD 做逐层多维路由，MixedDimKV 做分数维度，ThinKV 按 thought 混合精度与驱逐。单一"压缩比"指标正在失效，取而代之的是"预算—质量曲线"。

**第四，从"接受有损"转向"可验证、有误差界"。** VeriCache 要求与全量解码同输出，KeepKV 给单步无损与多步误差界，Behavior-Preserving 以分布保真为目标。这实际上把压缩从"近似"变成"带正确性契约的编码"。

**第五，负载结构变化。** reasoning（ThinKV、VaSE、KVpop、Zipage）、MoE（MoEZip、CrossPool、MoE-nD）、多模态（RetentiveKV、MadaKV）各自引入新的重要性结构；KVpop 用未来注意力目标直接监督 keep/drop，声称 Qwen3-4B 上 75% 压缩保留 98%、88% 压缩保留 97% `[arXiv:2607.05061v2]`。

**第六，反思与评测。** `[arXiv:2510.00231v2]` 在 Llama3.1 8B 与 Qwen2.5 14B 上评测五种方法，发现多指令场景下某些指令会被完全忽略，并给出 system prompt leakage 案例；`[arXiv:2609.30854v1]` 作为 SoK 指出各论文 workload、硬件、质量指标不一致，根本无法跨论文比较，并推导了随上下文长度衰减的算术强度闭式表达（覆盖 H100、B200、MI300X）。这意味着 2026 年的关键问题已不是"能不能压"，而是"在什么契约下压、如何公平比较"。

## 4. 横向对比

| 代表工作 | 年份 | 存储层次 | 核心机制 | 声称收益 | 主要局限 |
|---|---|---|---|---|---|
| VeriCache `[arXiv:2605.17613v1]` | 2026 | HBM + 全量 KV 旁路 | 压缩 KV 起草、全量 KV 校验 | 与全量解码同输出，保留高吞吐 | 全量 KV 必须常驻，容量未省 |
| DeferKV `[arXiv:2610.06286v1]` | 2026 | HBM | 驱逐延至首个 decode step | 摘要未给统一数字 | 一次性决策，长生成仍漂移 |
| KV$^2$ `[arXiv:2610.03198v2]` | 2026 | HBM / 可复用前缀 | 代理打分 + 子集重建 | RULER 16K、2% 预算 +40 点以上 | 子集重处理成本 |
| RDKV `[arXiv:2605.08317v1]` | 2026 | HBM | rate-distortion 联合驱逐+量化 | 摘要未给统一数字 | 失真权重与元数据开销 |
| Lexico `[arXiv:2412.08890v1]` | 2024 | HBM / 可离线 | 通用字典稀疏编码 | 15–25% 内存保 90–95%；低内存下 1.7x | OMP 解码延迟、字典驻留 |
| ZipCache `[arXiv:2405.14256v1]` | 2024 | HBM | 通道可分 tokenwise 量化 | 摘要未给统一数字 | 显著性估计偏差 |
| KeepKV `[arXiv:2504.09936v2]` | 2025 | HBM | 合并 + Electoral Votes 历史 | 单步无损、多步有误差界 | 合并历史元数据与实现复杂度 |
| CacheGen `[arXiv:2310.07240v6]` | 2023/2024 | 网络 + 远端存储 | KV 张量编码 + 带宽自适应 | 降低加载带宽（摘要未给数字） | 面向加载，非 decode 容量 |
| CrossPool `[arXiv:2606.24506v2]` | 2026 | GPU 显存池（权重/KV 分离） | 共享 KV 池按聚合活跃需求供给 | 摘要未给统一数字 | 依赖冷 MoE 不同时达峰 |
| C$^2$KV `[arXiv:2607.17715v1]` | 2026 | HBM / 复用存储 | 位置无关可组合压缩流形 | 摘要未给统一数字 | 需训练，表达力有上限 |
| ParisKV `[arXiv:2602.07721v3]` | 2026 | CPU offload + HBM | 碰撞候选 + 量化内积重排、UVA top-k | 2.8x 吞吐、百万 token | 取回延迟与召回率 |
| MoE-nD `[arXiv:2604.17695v1]` | 2026 | HBM | 逐层 (evict, K-bit, V-bit) 路由 | 摘要未给统一数字 | 离线校准、配置搜索贵 |
| ThinKV `[arXiv:2510.01290v2]` | 2025/2026 | HBM + PagedAttention | 按 thought 重要性混合量化/驱逐 | 摘要未给统一数字 | 依赖 CoT 结构 |
| RIFT `[arXiv:2610.31098v1]` | 2026 | HBM（draft 模型） | 选择式压缩 + 自适应刷新 | 摘要未给统一数字 | 刷新增加 decode 延迟 |

## 5. 对存储系统设计的启示

1. **KV block 必须携带自描述压缩元数据。** bit allocation 表、codebook/dictionary id、merge history（KeepKV 的 Electoral Votes）、basis 版本（iS-KV 的基漂移问题）都要与数据同址存放，否则 decode kernel 无法在压缩态取数。元数据本身应纳入容量与带宽预算，而不是当作零成本。

2. **存储格式要与 kernel 共同设计，目标是"免解压读取"。** SWAN 的旋转剪枝、CommVQ 的 RoPE-可交换 codebook、ZipCache 的 channel-separable 量化，本质都是让 attention 直接消费压缩表示。存储层应把"解压带宽"作为一等指标，优先支持可直接参与矩阵乘的布局，而不是通用压缩 + 反压缩。

3. **allocator 需要支持变长 page。** 逐层/逐 head 预算（MoE-nD、Ada-KV、BaKlaVa 声称最高 70% 压缩 `[arXiv:2502.13176v2]`）意味着同一请求内 KV page 尺寸不一致；PagedAttention 的固定 slot 假设会被打破。ThinKV 复用被驱逐 slot、Zipage 的 Compressed PagedAttention 说明 slot 回收与异步压缩应成为标准接口。

4. **放置策略按"复用距离 × 压缩率"分层。** 高复用前缀用查询无关压缩（KVzip、KV$^2$）留在 HBM 或远端共享池；低复用长尾直接驱逐或下沉 CPU/NVMe，按需 top-k 取回（ParisKV 的 UVA 路径）。CrossPool 进一步说明 KV 池应与权重池**物理分离**，按聚合活跃需求而非 worst-case 预留。

5. **复用索引要从 prefix hash 升级为内容寻址 + 位置重映射。** C$^2$KV 表明压缩与非前缀复用朴素结合会掉精度，可复用表示必须位置无关、可组合；存储层需要提供 KV 段的内容寻址与位置重映射表，否则压缩后的段无法跨请求拼接。

6. **评测接口按生命周期分阶段。** 依 SCBench 的生成/压缩/检索/加载四阶段分别报告，并强制覆盖 Pitfalls 类失效（指令被忽略、系统提示泄漏）。只报 LongBench 平均分不足以支撑部署决策。

## 6. 必读五篇

1. `[arXiv:2605.17613v1]` VeriCache——把"有损压缩"重新定义为带正确性契约的系统问题，是理解该方向边界的起点。
2. `[arXiv:2609.30854v1]` The KV Cache Is the New Memory Wall——给出统一的算术强度框架与 H100/B200/MI300X 参数，是跨论文比较的基准。
3. `[arXiv:2605.08317v1]` RDKV——把驱逐与量化统一为 bit allocation，提供了最清晰的存储成本模型。
4. `[arXiv:2610.03198v2]` KV$^2$——查询无关、可复用压缩的代表，直接对应存储层"一次压缩、多次读取"的核心场景。
5. `[arXiv:2412.10319v2]` SCBench——KV 生命周期四阶段评测，避免被单基准数字误导。

其他工作（一句话）：NACL 用 proxy token 与随机驱逐 `[arXiv:2408.03675v2]`，FastGen 做 head 结构自适应 `[arXiv:2310.01801v4]`，SAGE-KV 做 prefill 后 token+head 一次性 top-k `[arXiv:2503.08879v1]`，BaKlaVa 做逐 KV 预算 `[arXiv:2502.13176v2]`，MoE 之外的结构化压缩仍是开放问题。