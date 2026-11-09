# KV Cache 卸载与分层缓存

## 1. 问题定义与为什么它是存储问题

核心矛盾是：decode 阶段每生成一个 token 都要读取全部历史 K/V，而 KV 体积随「上下文长度 × batch × 层数 × head 数」线性增长，HBM 容量却是固定的。出路只有两条——重算（recompute）或重载（reload）：前者烧算力，后者烧 I/O。[arXiv:2601.19910v1] 给出了一个解析判据 κ_crit（cached-to-prefill token 比），论文声称典型工作负载超出该阈值数个数量级，并测得 99% 的延迟花在数据传输上、GPU 只跑到额定 TDP 的 28%。

一旦选择 reload，问题就从「显存管理」变成「存储系统」问题：需要容量-带宽-延迟-寿命四维异构的分层介质（HBM / DRAM / SSD / 远端对象存储 / CXL），需要放置与替换策略，需要 I/O 粒度与 attention 访问模式对齐，需要处理写放大与闪存寿命，还需要跨请求、跨会话的命名与共享语义。关键指标也随之迁移：TTFT（prefill 复用）、TBT/ITL（decode 召回）、KV 命中率、有效带宽（bytes/token）、写放大、SSD 寿命、每 token 成本与能耗。PagedAttention [arXiv:2309.06180v1] 用操作系统分页把 KV 变成「块」，是这个方向得以成立的起点；此后所有卸载工作本质上都在回答「块该放哪一层、以什么顺序取回」。

## 2. 技术流派

### 2.1 分层缓存栈：把 DRAM 当作 SSD 的缓存

- **核心思想**：显式建模 HBM→DRAM→SSD 的层级，把 KV 当作可缓存对象，用命中率与放置策略换取有效容量。这一流派继承了 CPU 缓存的直觉：DRAM 是 SSD 的过滤器。
- **代表工作**：
  - [arXiv:2510.09665v2] LMCache：从 vLLM / SGLang 中抽取 KV 并在引擎与查询间共享，同时支持 prefix 复用与 PD 分离；摘要自称「首个且迄今最高效的开源 KV 缓存方案」，并用真实使用统计指出用户 KV 总量已远超 GPU 容量。局限是抽象停留在前缀复用，对非前缀与 agent 语义支持弱。
  - [arXiv:2605.18071v1] KVDrive：覆盖 GPU / DRAM / SSD 三层，联合编排放置、流水调度与跨层协调；作者明确指出「继续加稀疏度而不损精度」已撞墙，转而在系统层做文章。
  - [arXiv:2509.00105v2] AdaptCache：对每个 KV entry 联合决定有损压缩算法、压缩率与设备放置，目的是把更多命中留在 DRAM。局限是压缩决策本身需要元数据与在线估计。
  - [arXiv:2512.14946v1] EVICPRESS：把「压缩」与「驱逐」放进同一个优化目标，跨多层最小化平均生成长度延迟。
  - [arXiv:2603.08739v1] Kareto：把分层配置形式化为多目标优化，用高保真端到端模拟器逼近 cost/throughput/latency 的 Pareto 前沿；作者观察到目标函数非解析且变量强耦合。
- **共同假设与失效**：默认 DRAM 一定在 SSD 之前做时间过滤。[arXiv:2610.38355v1] FlatCake 直接推翻这个前提：生产负载呈双峰——要么是一次性、超长复用距离的 block，要么是数 GB、超过 DRAM 容量的 agentic session，DRAM 过滤双双失效，SSD 被迫进入关键读路径；同时 DRAM staging 与「按驱逐顺序布局」会让同一 session 的块在 SSD 上碎片化，无法顺序读。

### 2.2 SSD/NVMe 原生路径与介质特性

- **核心思想**：既然 SSD 已在关键路径上，就不能再套用「文件 + page cache」的通用栈，而要绕过内核、对齐介质、并行多盘。
- **代表工作**：
  - [arXiv:2605.03375v1] Tutti：指出从 SSD 恢复 KV 的性能瓶颈是 GPU 显存碎片导致的「海量微小随机 I/O」，而 GDS 仍需 CPU 逐次发起 I/O，本质仍是 CPU-centric；Tutti 构建 GPU-centric 的 KV 对象存储，把 CPU 从 HBM↔SSD 的数据与控制关键路径上移除，只保留异步职责。摘要未给出具体加速比。
  - [arXiv:2604.26557v1] DUAL-BLADE：面向 edge，按运行时内存余量把 KV 张量动态分配到 page-cache 路径或 NVMe-direct 路径，后者把 KV 映射到连续 LBA、绕过文件系统，并配合自适应流水并行。
  - [arXiv:2603.17803v1] Swarm：观察到 KVCache Co-Activation（访问某 entry 常伴随一组稳定 entry），据此把单盘带宽受限的访问转成多 SSD 并行。
  - [arXiv:2601.13631v1] ContiguousKV：指出语义剪枝选 token 是细粒度、而系统按固定块做 I/O，造成严重读放大；同时「识别重要 token」与「加载 KV」存在串行依赖，产生 I/O 与计算气泡。
  - [arXiv:2605.22850v1] ObjectCache：把 KV 放进 S3 兼容对象存储，协同设计存储协议与传输调度，让存储端按 GPU 消费顺序交付，并在 100 Gbps RoCE 集群上用 NIXL 做原型。
  - [arXiv:2602.21548v2] DualPath：发现分离式架构中 prefill 引擎的存储网卡被打满、decode 引擎的却空闲，于是新增 storage-to-decode 路径，再用 RDMA 经计算网转给 prefill。
- **共同假设与失效**：默认瓶颈在单设备 PCIe 带宽，靠并行与路径改造即可缓解。失效场景是聚合带宽与尾延迟不可控、CPU 仍被卷入控制路径，以及多租户下的干扰。

### 2.3 稀疏召回与近存计算

- **核心思想**：不是把所有 KV 搬回来，而是只取当前步真正需要的部分；更进一步，把选择甚至 attention 计算下推到数据所在处。
- **代表工作**：
  - [arXiv:2505.02922v3] RetroInfer：把 KV 当向量库，全量放 CPU，按当前 query 检索少量 token，重点解决稀疏模式多变下「精度 vs 检索成本」的平衡。
  - [arXiv:2609.34555v1] PulseInfer：指出稀疏卸载把瓶颈转移到了 CPU-GPU 召回 I/O，且 headwise 选择把召回打碎成大量小 PCIe 传输；用 SoloHead 选择 + gather-scatter I/O 引擎 + 可中断逐层调度来合并与隐藏。
  - [arXiv:2603.27138v1] ScoutAttention：GPU-CPU 协同的 block-wise 稀疏 attention，配合 layer-ahead CPU 预计算，避免 CPU 成为新瓶颈。
  - [arXiv:2409.04992v1] InstInfer：把 decode 阶段最关键的 attention 计算与 KV 一起下推到计算存储盘（CSD）。
  - [arXiv:2502.09921v2] HILOS：面向离线批推理的 near-storage attention，并用 cooperative X-cache 降低 KV 流量。
  - [arXiv:2610.22579v1] MemLLM：端侧 RAG，在 SSD 内跑完整 attention 流水线，用 per-channel 加速器吃满 NAND 通道带宽。
  - [arXiv:2602.18750v2] HillInfer：只把轻量的 token 重要性评估下推到单块 SmartSSD，避免在弱 FPGA 上做精确 attention 导致资源耗尽。
  - [arXiv:2511.00321v1] PNM：在 CXL 内存内放近存加速器做 token page selection，从源头消除 recall。
  - [arXiv:2604.26074v1] DAK：复用 TMA 把权重与 KV 直接从远端内存取到 SMEM，作者称直接访问优于 prefetch，可避免 HBM 争用与流水气泡。
- **共同假设与失效**：把计算搬到数据旁总比搬数据便宜。失效点有三：器件算力与散热（[arXiv:2604.02442v2] ReFlux 指出 CSD 处理器持续负载会降频）、编程模型与厂商接口不统一、以及稀疏选择依赖推理中间值，使 SSD 读被迫落在关键路径上（[arXiv:2609.36938v1] Janus）。

### 2.4 压缩、编码与生命周期

- **核心思想**：在「搬」之前先让数据变小，或按价值决定谁值得留在快层。
- **代表工作**：
  - [arXiv:2511.01815v2] KVTC：借鉴媒体压缩，用 PCA 去相关 + 自适应量化 + 熵编码，只需短暂校准、不改模型参数；论文声称最高 20× 压缩，特定用例可达 40× 以上。
  - [arXiv:2602.09725v3] KVCodec：用 GPU 原生视频编解码器压缩并传输远端 KV，配套 codec-friendly 张量布局与流水化解码，针对带宽受限场景。
  - [arXiv:2502.12574v1] HeadInfer：head 粒度卸载，Llama-3-8B、1M token 下把 KV 显存从 128 GB 降到 1 GB。
  - [arXiv:2511.00868v2] FlexiCache：按 attention head 的时间稳定性分层，稳定 head 保留全部页、不稳定 head 精简。
  - [arXiv:2507.19823v1] HCAttention：key 量化 + value 卸载 + 动态驱逐，在极端内存约束下保精度。
  - [arXiv:2609.21172v2] TierKV：用 prefill hidden state 预测未来 cache 需求，把 token 联合分配到 exact / low-rank / flash 三层。
- **共同假设与失效**：KV 存在可压缩冗余且精度损失可控。[arXiv:2604.08426v5] 用 Text2JSON 等 context-intensive 任务证明，卸载/压缩在需要大量从上下文取信息的任务上会出现显著退化（Llama 3、Qwen 3 均如此），精度代价与任务类型强相关。

### 2.5 工作负载感知的复用与调度

- **核心思想**：KV 的价值由访问模式决定，而 2025 年后的访问模式是「会话」和「agent 图」，不是单请求。
- **代表工作**：
  - [arXiv:2511.02230v7] Continuum：给 KV 引入 TTL，在 agent 工具调用间隙保留 cache，同时权衡重算/重载成本与排队延迟，并要容忍工具时长的高方差。
  - [arXiv:2510.18586v5] TokenCake：多 agent 场景下，函数调用期间主动卸载 idle KV、预测性上传；空间调度用图结构与运行时状态做动态分区。
  - [arXiv:2604.06370v1] ForkKV：多 LoRA agent 使前缀缓存失效，用 fork + copy-on-write 在物理上解耦 KV。
  - [arXiv:2604.03143v1] TokenDance：利用 All-Gather 轮次的集合式复用，让共享块的成本与 agent 数无关；Diff-Aware Storage 把 sibling cache 编码成相对 master 的 block-sparse diff，论文声称 11-17× 压缩。
  - [arXiv:2507.11507v2] Oneiros：参数在运行时不变而 KV 动态变化，于是重映射权重内存给 KV，避免 swap。
- **共同假设与失效**：复用模式可从会话结构或图结构预测。失效于预测错误引发的抖动、CoW/diff 带来的元数据与 GC 开销，以及跨引擎时 KV 布局不兼容。

### 2.6 表征、负结果与代价核算

- [arXiv:2601.19910v1] 给出 κ_crit 解析框架与「99% 延迟在传输、GPU 28% TDP」的实测。
- [arXiv:2610.21249v1] 在块设备层表征 LMCache：legacy 栈在四种负载下「看起来几乎不读 SSD」，但 flush_ram 实验显示这只依赖 page cache 温暖度——缓存被逐出后，同一路径在 683 ms 内发出约 1 GB 顺序读；同时 prefix-aware 去重带来显著写下降。这是对「page cache 是隐藏变量」最直接的证据。
- [arXiv:2604.08426v5] 的精度退化与 [arXiv:2508.06978v1] 的 MoE 权重 SSD 卸载能耗（论文声称每 token 最高约 12× HBM 基线）共同说明：卸载不是免费的。
- [arXiv:2504.11816v1] InferSave 从云 VM 选型角度给出反直觉结论：在线负载不卸载反而提升成本效率最多 73.7%，离线负载卸载才省最多 20.19%。

其他工作：[arXiv:2511.11907v2] KVSwap（端侧 disk-aware）、[arXiv:2603.23049v1] PCR（RAG 预取）、[arXiv:2604.10539v1] IceCache（语义聚类 + PagedAttention）、[arXiv:2609.17573v1] GroupKV（diffusion LLM）、[arXiv:2606.02964v1] AsymCache（面向 kernel 效率的无损驱逐）、[arXiv:2502.12665v2] A²ATS（窗口化 RoPE + 向量量化检索）、[arXiv:2602.23592v2] KEEP（具身规划）、[arXiv:2609.01338v1] mzCache（移动端多任务）、[arXiv:2609.06940v1] Unified AI Gateway（模型路由与 KV 联合决策）、[arXiv:2606.12556v2] ITME（CXL-hybrid 分离内存）、[arXiv:2604.02442v2] ReFlux（可迁移存储 actor）。

## 3. 2025-2026 最新进展

第一，SSD 从「冷层」变成一等容量层。Tutti、ObjectCache、FlatCake、DualPath、Janus、SARIA 都不再把 SSD 当兜底，而是围绕它重设数据路径；FlatCake 更进一步，把 DRAM 与 NVMe 放进同一个 64 位地址空间做 peer media，等于放弃「DRAM 必为中间层」的教条。

第二，关键路径去 CPU 化。Tutti 移除 CPU 干预、DUAL-BLADE 用连续 LBA 绕过文件系统、DAK 用 TMA 直取远端内存，共同指向「GPU 自己发起的 I/O」这一新接口形态。

第三，闪存寿命成为与延迟并列的约束。Gandalf [arXiv:2610.30791v1] 指出多轮对话与 agent 使 KV 写入总量远超 SSD 容量，寿命从数年缩到数月；它反对简单按历史访问模式 gate 写入，因为不同 attention 类型可能历史相同而未来不同。SARIA [arXiv:2610.31169v1] 用会话级时间局部性做选择性持久化，HBF 场景则用 admission-controlled LRU-K 解耦写入与 miss [arXiv:2609.07175v1]。

第四，工作负载假设被 agent 打破。复用距离从「请求内」变成「会话级、跨小时」，于是出现 TTL（Continuum）、CoW（ForkKV）、集合通信复用（TokenDance）等新原语。

第五，压缩从可选优化变成放置决策的一部分：KVTC 的 20× 意味着「存得下」与「放哪层」必须联合求解，EVICPRESS 已把两者并入同一目标。

第六，非前缀复用与精度代价被正式提出：CacheTune [arXiv:2605.24022v2] 指出直接复用非前缀 KV 会破坏跨块全局 attention，KVLink [arXiv:2502.16002v4] 用位置重编码拼接独立预计算的文档 KV，说明「前缀缓存」这一默认抽象正在松动。

## 4. 横向对比

| 代表工作 | 年份 | 存储层次 | 核心机制 | 声称收益 | 主要局限 |
|---|---|---|---|---|---|
| LMCache [arXiv:2510.09665v2] | 2025 | HBM→DRAM/SSD/远端 | 跨引擎 KV 抽取、前缀复用、PD 分离 | 摘要未给出量化收益，自称首个且最高效开源方案 | 抽象偏前缀，非前缀/agent 语义弱 |
| Tutti [arXiv:2605.03375v1] | 2026 | HBM↔NVMe SSD | GPU-centric KV 对象存储，CPU 退出关键路径 | 摘要未给出具体加速比 | 依赖 GPU 侧 I/O 能力，生态未标准化 |
| FlatCake [arXiv:2610.38355v1] | 2026 | DRAM 与 SSD 对等 | 统一 64 位地址空间，取消 DRAM staging | 摘要未给出量化收益 | 需改地址空间与分配器，兼容性成本高 |
| ObjectCache [arXiv:2605.22850v1] | 2026 | S3 对象存储 | 按 GPU 消费顺序交付，传输与计算重叠 | 100 Gbps RoCE 原型，未给端到端倍数 | 依赖网络与 NIXL，尾延迟敏感 |
| KVTC [arXiv:2511.01815v2] | 2025 | on-GPU / off-GPU | PCA + 自适应量化 + 熵编码 | 论文声称最高 20×，特定用例 40×+ | 需校准，压缩/解压计入时延 |
| PulseInfer [arXiv:2609.34555v1] | 2026 | HBM↔DRAM | 稀疏召回 + gather-scatter I/O 合并 | 摘要未给出具体数字 | 依赖稀疏模式，召回仍在 PCIe 上 |
| InstInfer [arXiv:2409.04992v1] | 2024 | CSD 内 | attention 与 KV 一同下推 | 摘要未给出具体数字 | CSD 算力/热限制，编程模型封闭 |
| Continuum [arXiv:2511.02230v7] | 2025 | HBM↔DRAM/SSD | KV TTL + 工具调用间隙保留 | 摘要未给出具体数字 | 依赖工具时长可预测性 |
| Gandalf [arXiv:2610.30791v1] | 2026 | SSD | 按 attention 类型区分写入门控 | 摘要未给出具体数字 | 需类型推断，命中率与寿命仍需权衡 |
| Understanding Bottlenecks [arXiv:2601.19910v1] | 2025 | DRAM | κ_crit 解析模型 + 表征 | 论文声称 99% 延迟在传输、GPU 28% TDP | 面向 PCIe DRAM 卸载，未覆盖 SSD/CXL |

## 5. 对存储系统设计的启示

1. **KV 应是一等对象，而不是文件里的字节偏移。** 键至少要包含 `(session_id, model_version, layer_id, token_range, attention_type)`，值需支持变长与稀疏 extent；接口应是「按消费顺序取一段」而非「读 4KB 页」，ObjectCache 的按序交付与 ContiguousKV 的粒度对齐都指向这一点。
2. **放弃「DRAM 必为中间层」的固定层级，改为可配置的 peer media + 统一地址空间。** FlatCake 的做法说明，分配器需要能直接给出跨 DRAM/SSD 的全局地址，并把「放置提示」作为 API 暴露给推理引擎，而不是由存储层按 LRU 猜。
3. **把写放大与寿命做成 SLO 的一等约束。** SARIA 的选择性持久化、Gandalf 的按 attention 类型门控、HBF 的 admission-controlled LRU-K 都表明：LRU 让写入由 miss 驱动是寿命杀手；存储层应提供「写预算」与「持久化优先级」两个显式参数。
4. **I/O 粒度必须与 attention 选择粒度对齐，并原生支持 gather/scatter。** 否则语义剪枝越精细，读放大越严重（ContiguousKV）；PulseInfer 的 SoloHead 与 gather-scatter 引擎说明，设备队列与 DMA 描述符要能承接大量非连续小段，而不是靠上层合并。
5. **为近存计算预留标准化、可迁移的算子接口。** ReFlux 用 WebAssembly actor + CXL.mem 共享状态、迁移时仅搬约 8 KB 控制状态，是可移植性的一个可行答案；存储设备应至少暴露 top-k 选择与部分 attention 两类受限算子，避免 vendor lock-in。
6. **可观测性要下沉到块设备层。** LMCache 表征工作证明 page cache 温暖度会让「看起来不读盘」成为假象；系统应默认导出 per-request 的读放大、顺序性、flush 次数与有效带宽，否则容量规划会系统性偏乐观。

## 6. 必读五篇

1. [arXiv:2510.09665v2] LMCache——当前开源生态的事实接口与基线，不理解它就无法评估其他方案。
2. [arXiv:2605.03375v1] Tutti——把「GPU-centric I/O、CPU 退出关键路径」讲得最透的一篇，代表介质原生路线的方向。
3. [arXiv:2610.38355v1] FlatCake——直接攻击「DRAM 中间层」这一全领域默认假设，架构意义最大。
4. [arXiv:2601.19910v1] Understanding Bottlenecks——提供 κ_crit 这一可复用的定量判据，让「该不该卸载」从经验变成计算。
5. [arXiv:2610.30791v1] Gandalf——唯一把闪存寿命而非延迟当作首要目标的工作，补齐了存储视角最容易被忽略的一维。