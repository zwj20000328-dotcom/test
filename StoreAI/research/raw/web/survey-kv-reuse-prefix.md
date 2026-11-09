# 前缀复用、Radix 缓存与语义缓存

## 1. 问题定义与为什么它是存储问题

长上下文推理的 prefill 成本随序列长度超线性增长，而同一段 system prompt、同一份检索文档、同一段工具输出会在成百上千个请求里反复出现。前缀复用的动作是把 prefill 产出的 KV 张量持久化，下次遇到相同内容时直接加载而不重算。一旦这个动作成立，问题的主语就从"算子"变成"数据"：KV 按什么粒度寻址、放在哪一层介质、何时淘汰、跨节点怎么搬、失效时如何保证语义等价。它因此天然是存储问题，且比传统缓存更难——KV 没有"文件"这种天然边界，复用单元的划分方式直接决定命中率与正确性。

关键指标也随之改变。其一是 TTFT 与吞吐，但收益取决于 miss 时的重算成本，而重算成本随序列长度增长，所以命中率不是充分统计量（[arXiv:2609.28870v2] 因此提出 compute-savings ratio）。其二是 token 级命中率，[arXiv:2610.13060v1] 在 20% 请求共享固定前缀的 Zipfian 负载下观察到 segment 级复用显著高于前缀缓存。其三是保真度，即复用后输出与全量 prefill 的一致性，这是 2026 年才被系统量化的维度。容量上还有一个结构性事实：KV 大小与上下文长度线性相关，而单卡 HBM 只有几十到上百 GB，存储层次被拉长为 HBM → host DRAM → CXL → 本地 NVMe → 远端池，每层都带来新的接口成本。

## 2. 技术流派

### 2.1 精确前缀缓存：可复用段与缓存池化

核心思想：把 prompt 中重复出现的文本段预先算好 KV 并建索引，请求到来时做最长前缀匹配，工程上实现为 radix tree 或 block-hash 链，按固定块共享。

- **[arXiv:2311.04934v2] Prompt Cache**：提出 "prompt module" 抽象，用 schema 显式声明可复用文本段，并在复用 attention state 时保证位置正确性，同时给用户访问缓存状态的接口。它是后续前缀缓存系统的概念来源。局限是需要用户显式声明、且只支持连续前缀，一个字段变化就让下游全部失效。
- **[arXiv:2508.17219v1] TokenLake**：把前缀缓存做成集群级统一 segment-level 缓存池，用声明式 cache interface 暴露 query tensor、prefix cache 和 cache-aware 操作，使调度器与缓存管理解耦，针对实例间负载不均、数据冗余与内存碎片。其关键判断是：现有系统只在实例间传递"越来越长的前缀"，因此做不出低延迟内存池。摘要未给出量化结果。
- 其他：[arXiv:2606.17059v1] 用 P2P + anti-entropy 做无中心前缀路由，并指出陈旧元数据只导致 miss、不导致错答，故弱一致足以保证正确性。

共同假设：复用单元是精确匹配的 token 块，键为内容哈希链。失效场景是内容出现在非前缀位置——RAG 文档顺序变化、agent 滚动编辑、多轮历史裁剪都会让命中率断崖下跌。

### 2.2 非前缀 / 位置无关复用：分段拼接 + 选择性重算

核心思想：把 prompt 拆成可独立缓存的 chunk，命中后拼接，再用少量重算修复 chunk 间缺失的注意力交互与位置偏移。这是 2026 年最活跃的流派。

- **[arXiv:2608.21362v1] KVBoost**：双哈希键——prefix hash 编码位置身份、content hash 编码内容身份，从而同时支持 exact 与 approximate 匹配；针对独立缓存 chunk 造成的 attention boundary error，提供 SelectiveRecompute（重编码边界区域）与 CacheBlendRecompute（定位并重算高偏差 token）两种修复。
- **[arXiv:2610.15186v1] SAFE-KV**：把非前缀复用重新定义为 behavior-preservation 问题，以精确 prompt 上的全量 prefill 为 reference；核心论点是 cached document state 不是可复用文本，而是依赖前缀、位置与前序文档的 context-conditioned causal state。论文声称在 Qwen2.5-7B-Instruct 上，prefix-conditioned composition 只保留 HotpotQA-500 的 47.2% 与 2Wiki-500 的 37.8% 全量 prefill 答案，而 SAFE-KV 用 risk-guided K2 选择重编码 causal suffix 后恢复到 99.8%/98.4%（donor-copy 协议）与 100.0%/98.4%（actual suffix forwarding）。
- **[arXiv:2606.01751v2] SparseX**：以连续 token segment 为复用单元，利用复用负载中天然出现的 Sparse-Q 索引估计需修正的 key token，在单次 forward 内完成 Sparse-KV Recomputation，不引入额外模型调用。
- **[arXiv:2609.32999v1] Tessera**：把 retrieval 提升为 KV 复用的控制平面——检索在执行前就告知系统需要哪些 context unit，从而把当前需求与检索先验结合做放置。其 characterization 指出 agent-memory 负载中 70% 以上的注入 token 落在匹配前缀之外。
- 其他：[arXiv:2610.13060v1] KV-Repurpose 是 vLLM 上的 segment 复用 testbed，发现单文档 QA 与摘要基本保质量、跨文档推理明显退化；[arXiv:2512.16822v1] MEPIC 指出 PIC 的 KV 布局不对齐 page 就无法跨请求共享；[arXiv:2510.10129v2] CacheClip 利用小模型与主模型末层 attention 分布相似来挑关键 token。

共同假设：chunk 的 KV 可近似复用，误差能被有限重算压住。失效场景是跨候选推理与顺序依赖——[arXiv:2601.08343v1] 发现 judge 的候选选择会与 dense prefill 严重不一致；[arXiv:2610.05833v1] 在同一 5% 重算预算下，CacheBlend 的 token top-k 让答案随请求顺序变化 69.0%，document-aligned 重算降到 26.1%。

### 2.3 混合注意力与线性注意力：token 可寻址性消失

核心思想：hybrid 模型交错 full-attention 层与 linear-attention 层，前者 KV 是 token-addressable 的，后者维护 recurrent state、不能回滚到任意前缀边界，于是前缀缓存退化为"只能在 checkpoint 位置命中"。

- **[arXiv:2411.19379v3] Marconi**：第一个支持 hybrid 模型前缀缓存的系统，用新的 admission/eviction 策略处理"每条序列产生大量低复用 checkpoint"的问题。它明确了根因：线性层的 in-place state update 排除了部分重叠回滚，只允许 exact match。
- **[arXiv:2608.30310v2] Tail-Replay**：把 Gated DeltaNet 这类线性注意力视为对输入前缀的结构化有损压缩，因此只需重放尾部，不必在每个边界存 checkpoint，从而实现无约束的 token 级复用。
- **[arXiv:2609.33477v1] SuffixReplay**：思路更激进——"让线性状态忘掉远处过去"，利用 recurrent decay 与 gating 已衰减旧输入这一性质，直接近似任意 cache-supported page 边界的状态，不物化任何 recurrent-state checkpoint。
- 其他：[arXiv:2610.41508v1] HiState 处理 agent 负载下 checkpoint 被挤出的问题；[arXiv:2605.05219v1] 把 checkpoint 放置形式化为重叠深度分布下的 O(NM) 动态规划；[arXiv:2607.01299v2] HYPIC 为线性层引入 segment-cumulative transition operator 作为缺失的代数原语。

共同假设：线性层状态可压缩或近似回放。由此产生新的存储问题——同一模型内存储对象异构，full-attention 层是可按 page 共享的 token KV，linear 层是 recurrent state 或 per-segment transition operator，两者的 GC、压缩、迁移不能共用一套 block 模型。

### 2.4 淘汰、容量与调度：复用变成资源管理

核心思想：命中率不只由"存不存"决定，还由谁留下、谁被赶走、请求怎么排决定。

- **[arXiv:2609.28870v2] When Fancy Eviction Fails**：本方向最重要的负面结果。基于两家公司生产 trace 评估 14 种淘汰算法，在 HBM 受限与大内存池两种设置下，复杂的传统缓存策略相对 LRU 几乎没有收益；根因是前缀复用被活跃会话的规律节奏主导，recency 异常可预测。论文还指出会话足迹重尾、miss 成本随 attention 计算增长而高度可变，并提出 compute-savings ratio 与两个 offline oracle。
- **[arXiv:2609.32278v2] RR-Evict**：刻画 recency synchronization——对一个 agent 缓存历史的访问会同时刷新其所有节点，使 LRU 集中淘汰少数 agent 的私有历史；被完全淘汰的 agent 返回时要重算几乎全部上下文，产生 TTFT 长尾。解法是把回收细粒度摊开。
- **[arXiv:2605.18825v1] SAECache**：指出 prompt 内 system、query、tool output、response、CoT 等 token 类型的复用率差异高达 756×，而 LRU 对所有 block 一视同仁，据此做语义自适应淘汰。
- **[arXiv:2609.27746v1] KVSET**：把 KV cache working set 定义为"达到目标命中率所需的最小容量"，用在线分析器估计，将容量规划从"尽量多存"变为可计算目标。
- **[arXiv:2608.14624v1] CacheScout**：认为未来复用由 agent 执行语义而非 recency 决定，在线学习 agent 执行转移，在被再次调用前保住 context。
- 其他：[arXiv:2610.36355v1] WAKMan 在 20 种负载混合下发现无单一最优策略——LRU 在 agentic 重的混合上比 S3FIFO 命中率高 12%，其他混合上低至 22%；[arXiv:2605.00528v2] SAGA 以整个 agent workflow 为调度单元，用 Agent Execution Graph 预测跨 tool-call 复用，接近 Bélády 最优（within 1.31×）。

共同假设：淘汰是局部在线决策。被打破之处在于 agent 的执行图、检索计划与 workflow 结构都提供了"未来"，而纯 recency 看不到。

### 2.5 存储层次与网络：HBM → DRAM → CXL → SSD

核心思想：显存放不下就往下一层放，但每下一层引入的接口成本往往比介质延迟更致命。

- **[arXiv:2609.26828v1] LM-CXD**：characterization 指出 NAND 的 block I/O 路径除 NAND 延迟外还有 CPU cache contention 与 host-DRAM staging，且换成 DRAM 介质这些接口成本依然存在。但现成 CXL-SSD 仍比本地 DRAM 慢约 3×、不比 NVMe SSD 快，通用 prefetch 几乎无用。LM-CXD 让 KV chunk 成为 device-visible I/O unit，把 NAND→DRAM 进度暴露给 serving engine，并用 device DRAM 作 GPU 可访问 buffer。
- **[arXiv:2509.16857v1] ShadowServe**：分布式前缀缓存的 fetch 会成为瓶颈，压缩能省带宽但解压会干扰模型计算。它把 data plane 全部卸载到 SmartNIC、host 只留 control plane，用 chunked pipeline 并行化数据面操作，并以 minimal-copy 内存管理缓解 SmartNIC 资源压力。
- **[arXiv:2609.10790v1] Composable CXL Memory as a Kubernetes-Native Shared Memory**：把 composable CXL memory 做成 Kubernetes DRA 可调度资源，按需组合 region、物化为各主机 DAX 设备、以单个 CDI 名称注入 pod；slot directory 内嵌在共享介质中，省掉外部 metadata service。两节点、512 GiB CXL、Qwen2.5-7B-Instruct 上，外部命中率 95.4–99.5% 时跨节点复用把 TTFT 降低 5.5×–36.6×。
- 其他：[arXiv:2410.03065v2] Cake 用双向调度让 KV 计算与 I/O 加载并行；[arXiv:2606.07684v1] SCD 以低秩语义码替代原始 KV 传输，声称相对 oracle consumer prefill 最高 2.65× TTFT 加速。

共同假设：KV 搬运成本可用带宽与延迟建模。失效点正是解压干扰、CPU cache 争用、host-DRAM staging 这类"接口成本"，它们根本不在模型里。

### 2.6 语义缓存与缓存安全

核心思想：键从 token 序列变成 embedding，命中判定变成近似检索；收益是跨措辞复用，代价是正确性、可验证性与安全边界全部改变。

- **[arXiv:2502.03771v5] vCache**：指出现有系统对所有请求用同一静态相似度阈值，既无形式化正确性保证，又导致不可预期的错误率与次优命中率；它用在线学习为每个 cached prompt 估计最优阈值，提供用户可定义的错误率保证。
- **[arXiv:2601.23088v2] From Similarity to Vulnerability**：把 semantic cache key 视为 fuzzy hash，论证最大化命中率所需的 locality 与抗碰撞所需的 cryptographic avalanche effect 本质冲突，形式化了性能—安全 trade-off，并给出首个针对语义缓存完整性的系统性攻击研究。
- **[arXiv:2608.09225v1] KVGov**：多租户共享前缀缓存构成 timing side channel，PROMPTPEEK、EarlyBird、InputSnatch 对未防护的 vLLM 与 SGLang 可达最高 100% 攻击成功率。KVGov 用 per-principal salt（σ_p = HMAC_K(secret, principal_id)）作为 block-hash 链种子，使缓存键在租户间密码学不相交，用一个机制覆盖三类攻击路径。
- 其他：[arXiv:2608.01718v2] LaCache 把完整性检查从 query 移到 response；[arXiv:2603.03301v1] 证明语义缓存最优 offline 策略是 NP-hard；[arXiv:2502.07776v2] 的统计审计在包括 OpenAI 在内的 7 家 API provider 检出跨用户全局缓存共享；[arXiv:2605.30613v1] 检查 API gateway 是否绕过 provider 级隔离。

共同假设：缓存键的安全等价于哈希函数的安全。被打破之处在于语义缓存为 locality 必须牺牲 avalanche，性能与安全目标直接对立，换个更好的 embedding 并不解决。

## 3. 2025–2026 最新进展

**负载 agent 化。** 2026 年大量工作假设 context 是滚动编辑而非 append-only：RR-Evict、HiState、CacheScout、SAGA、Leyline（[arXiv:2606.01065v1]）、Don't Break the Cache（[arXiv:2601.06007v2]）、KVSET 都在处理"同一内容换位置""策略主动删除或替换缓存 span"。"前缀缓存正确性 by construction"这一前提被系统性推翻。

**非前缀复用从"能复用"转向"复用是否保行为"。** SAFE-KV 的 47.2%/37.8% 与 [arXiv:2610.05833v1] 的 69.0% 顺序敏感度说明，早期工作的加速比可能建立在被高估的质量上；[arXiv:2609.31415v1] 直接指出现有评测"artificially inflating the reported effectiveness"，并推出 Boxoffice 生成对抗性复用模式的数据集。

**"更复杂的淘汰策略更好"被证伪。** [arXiv:2609.28870v2] 用生产 trace 让 14 种算法输给 LRU，[arXiv:2610.36355v1] 证明没有单一最优策略，[arXiv:2605.18825v1] 指出真正的信号是 token 语义而非 recency。研究重心转向容量规划与 miss 成本建模。

**混合注意力让"KV cache = token 数组"失效。** Marconi 之后，SuffixReplay/Tail-Replay 反过来利用线性注意力的遗忘特性，把"不能回滚"变成"不需要回滚"，checkpoint 范式被削弱。

**存储侧出现负结果。** 现成 CXL-SSD 不比 NVMe 快（[arXiv:2609.26828v1]），压缩换带宽会因解压干扰失效（[arXiv:2509.16857v1]），因此转向"让设备理解 KV chunk"与"数据面卸载"。

**安全成为一等公民。** timing side channel、semantic key collision、gateway 隔离失效在同一时期集中出现，缓存不再只是性能优化。

## 4. 横向对比

| 代表工作 | 年份 | 存储层次 | 核心机制 | 声称收益 | 主要局限 |
|---|---|---|---|---|---|
| Prompt Cache [arXiv:2311.04934v2] | 2023 | GPU HBM/DRAM | prompt module schema + 位置校正 | 摘要未给出具体数字 | 需显式声明，仅连续前缀 |
| Marconi [arXiv:2411.19379v3] | 2024 | GPU/CPU | hybrid checkpoint + 准入淘汰 | 摘要未给出具体数字 | 仅 exact match |
| Cake [arXiv:2410.03065v2] | 2024 | 存储→GPU | 计算与加载双向调度 | 摘要未给出具体数字 | 只解决"取"，不解决复用正确性 |
| vCache [arXiv:2502.03771v5] | 2025 | 向量库 | 每个 prompt 在线学阈值 | 用户可定义错误率保证 | 只覆盖响应级复用 |
| TokenLake [arXiv:2508.17219v1] | 2025 | 集群内存池 | segment 级统一缓存池 + 声明式接口 | 摘要未给出具体数字 | 摘要未给量化 |
| ShadowServe [arXiv:2509.16857v1] | 2025 | SmartNIC | 数据面全卸载 + chunked pipeline | 摘要截断，未给数字 | 受 SmartNIC 算力与内存限制 |
| SAFE-KV [arXiv:2610.15186v1] | 2026 | 服务侧 | causal suffix 重编码修复 | 47.2/37.8 → 99.8/98.4（论文声称） | 需选安全 start document |
| SparseX [arXiv:2606.01751v2] | 2026 | GPU | Sparse-Q 估计 + 单次 forward 重算 | 摘要未给出具体数字 | 摘要未给量化 |
| Tessera [arXiv:2609.32999v1] | 2026 | 分离式集群 | retrieval 作控制平面 | 70%+ 注入 token 在前缀外（问题规模） | 依赖检索结果可预知 |
| RR-Evict [arXiv:2609.32278v2] | 2026 | GPU/CPU | 细粒度回收打散 recency sync | 摘要未给出具体数字 | 针对 agent 私有历史 |
| KVSET [arXiv:2609.27746v1] | 2026 | 容量规划 | 在线估计 working set | 摘要未给出具体数字 | 只估计，不改变运行时 |
| LM-CXD [arXiv:2609.26828v1] | 2026 | CXL-SSD | chunk 作为 device-visible I/O unit | 现成 CXL-SSD 比 DRAM 慢约 3× | 需改设备接口 |
| CXL-K8s [arXiv:2609.10790v1] | 2026 | CXL 共享内存 | DRA + DAX + 内嵌 slot directory | TTFT 5.5×–36.6×（论文声称） | 依赖 95.4–99.5% 外部命中率 |
| Key Collision [arXiv:2601.23088v2] | 2026 | 向量库 | fuzzy hash 的 locality/avalanche 权衡 | 首个完整性攻击研究 | 无通用防御 |
| KVGov [arXiv:2608.09225v1] | 2026 | 服务层 | per-principal salt | 攻击成功率最高 100%（问题侧） | 只覆盖前缀缓存路径 |

## 5. 对存储系统设计的启示

**1. 缓存键必须两级且带租户域。** prefix hash 编码位置身份、content hash 编码内容身份（[arXiv:2608.21362v1]），否则非前缀复用无法同时支持精确与近似命中；块哈希链的种子必须按租户加盐（[arXiv:2608.09225v1]），因为命中延迟本身就是侧信道，隔离不能靠上层鉴权。

**2. 复用单元应是 segment 而非"越来越长的前缀"。** 接口上要暴露 chunk ID、位置、依赖的 segment 集合与位置编码元数据（[arXiv:2508.17219v1]、[arXiv:2512.16822v1]），并且 chunk 要成为设备可见的 I/O 单元（[arXiv:2609.26828v1]），而不是被 host 切成随机块。page 对齐是跨请求共享页的前提。

**3. 放置策略要用"未来"，但默认仍是 LRU。** agent 执行图（[arXiv:2605.00528v2]）、在线学到的转移（[arXiv:2608.14624v1]）、检索请求（[arXiv:2609.32999v1]）都比 recency 更接近 Bélády；然而 [arXiv:2609.28870v2] 显示复杂策略在生产 trace 上收益有限，复杂度预算应优先花在 miss 成本建模（compute-savings ratio）而非替换算法本身。

**4. 容量规划以 working set 为部署参数。** 用"目标命中率 → 最小容量"曲线（[arXiv:2609.27746v1]）替代拍脑袋扩容；共享池的元数据应内嵌在共享介质里（[arXiv:2609.10790v1]），避免外部 metadata service 成为跨节点单点。

**5. hybrid 模型下存储对象必须分层异构管理。** full-attention 层存可 page 对齐的 token KV，linear 层存 recurrent state 或 segment transition operator；GC、压缩、迁移、容量计费都要按层类型分开，不能用一个 block size 统一。

**6. 语义缓存要给出响应级校验与错误率上界。** 只信 query 相似度会被 key collision 打穿（[arXiv:2601.23088v2]），需要 per-prompt 阈值学习（[arXiv:2502.03771v5]）加响应侧完整性检查（[arXiv:2608.01718v2]），并明确 locality 与抗碰撞不可兼得。

## 6. 必读五篇

1. **[arXiv:2311.04934v2] Prompt Cache** —— 定义了"可复用段"这一抽象，之后所有前缀缓存系统都是它的变体或反叛。
2. **[arXiv:2411.19379v3] Marconi** —— 第一次讲清 hybrid 模型为何让前缀缓存的基本假设失效，是理解 checkpoint 范式的入口。
3. **[arXiv:2610.15186v1] SAFE-KV** —— 用 47.2%/37.8% 这个数字把非前缀复用的正确性问题摆上台面，并给出可复现的修复协议。
4. **[arXiv:2609.28870v2] When Fancy Eviction Fails** —— 生产 trace + 14 种算法的负面结果，是判断"要不要做复杂淘汰"的唯一硬依据。
5. **[arXiv:2609.26828v1] LM-CXD** —— 唯一把 CPU cache 争用、host-DRAM staging 这类存储接口成本当作核心矛盾的论文，直接指向设备-引擎协同设计。