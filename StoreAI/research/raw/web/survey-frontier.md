# 前沿与交叉方向

> 说明：本文件收录条目标注为 `frontier (32 / 60)`，实际列出 32 条。所有结论仅基于这些条目的标题与摘要；凡摘要被 900 字符截断处，均标注"摘要未给出"。

## 1. 问题定义与为什么它是存储问题

长上下文推理、长视频生成和世界模型共享同一个矛盾：模型必须持续访问"很久以前"的信息，但承载这些信息的 KV cache 随 token 数线性增长，而 attention 对历史的使用是高度稀疏且任务相关的。于是"生成质量"被重新表述为一个存储问题——在固定比特预算或固定状态大小下，能保留多少对下游 attention 真正有用的信息？[arXiv:2608.14191v1] 直接把 KV cache 称为 long-context inference 的 "major memory bottleneck"；[arXiv:2606.07205v1] 更把 KV cache 压缩形式化为 "streaming attention approximation problem"，并给出空间使用的信息论下界。

关键指标随之从传统存储的容量/带宽/延迟，扩展为：每 token 比特数、压缩率、状态是否为常数（constant-size state）、attention-aware distortion、retrieval recall@k，以及长时序一致性（drift / catastrophic forgetting）。更重要的是"保真度"定义发生了迁移：早期量化只最小化 cache 的重构误差，[arXiv:2608.14191v1] 明确指出这并不等于最小化误差经 attention 传播后的影响；[arXiv:2608.03228v4] 则指出低秩索引应保留 attention score 而非 key 方差。这把存储问题从"字节保真"推向"查询保真"——存储系统第一次需要为一种**查询语义**而非数据本身做编码。

## 2. 技术流派

### 2.1 率失真驱动的量化

核心思想：把 KV cache 当作待编码信源，用信号处理与率失真理论分配比特，目标从重构误差改为 attention 输出误差。

- **[arXiv:2504.19874v1] TurboQuant**：data-oblivious 的在线向量量化器。对输入向量做随机旋转，使各坐标服从集中的 Beta 分布并近似独立，从而对每个坐标套用最优标量量化器；同时处理 MSE 与 inner product 两类失真，在所有 bit-width 和维度上达到 near-optimal distortion rate（论文声称，具体常数未给出）。局限：per-vector 编码，完全忽略跨 token、跨 head 的相关结构，且 inner product 的 bias 需要额外修正。
- **[arXiv:2608.14191v1] AATC**：证明在白噪声量化模型下，期望的 attention-aware distortion 可加性分解为 key 与 value 两部分，并在 token 与 channel 上因子化；据此用 reverse water-filling 在校准集上分配比特。摘要在 "On Llama-3.1-8B-Instruct an" 处截断，具体收益数字未给出。局限：白噪声假设、依赖校准集分布。
- **[arXiv:2605.06675v2] RateQuant**：指出所有 attention head 用同一 bit-width 忽略了 head 重要性的巨大差异；但直接做混合精度有陷阱——每个量化器服从不同失真曲线 D(b)=αβ^{-b}，衰减率 β 在不同量化器设计间从 3.6 变化到 5.3（论文声称），把一个量化器的失真模型套到另一个上会反转分配顺序，性能反而差于均匀量化，作者称之为 "distortion model mismatch"。

共同假设：误差可加、token/channel 可分离、失真曲线可在校准集上估计。失效场景：outlier 密集的 channel、RoPE 旋转使 key 分布随距离漂移、跨层误差耦合。

### 2.2 低秩/谱结构与索引

核心思想：KV 中存在低秩共享成分，先分离结构、再对残差做量化或建立低秩索引。

- **[arXiv:2605.02905v1] eOptShrinkQ**：把 KV 分解为低秩 shared context 与 full-rank per-token residual，用 spiked random matrix 模型描述；eOptShrink 最优奇异值收缩自动提取共享结构，残差满足 thin shell property、坐标 delocalized，交给 TurboQuant 量化。由于恢复了标量量化所假设的各向同性，可省去 outlier handling 与 inner product bias correction，把这些比特让给重建。摘要未给出压缩率或精度数字。
- **[arXiv:2608.03228v4] SAKI-RoPE**：推导 key 侧 rank-r 压缩的期望 score distortion，这是一个 query/key 双侧协方差加权的低秩问题，闭式解由每 head 两个 d×d 协方差给出；预测的 per-head score-MSE 降幅与实测吻合，Pearson r=0.997（论文声称）。该索引 training-free，在 LLaMA-3.1-8B、Qwen2.5-7B、Mistral-7B、Llama-3.2-3B 上、4K 到 64K 全部 context 长度、全部校准域组合下均优于 key-PCA；r=32 时 LLaMA-3.1-8B 的 recall@64 从 0.748 提升到 0.799（论文声称）。局限：只处理 key 侧，value 未覆盖。
- **[arXiv:2508.17032v2] Cartridges**：用离线计算训练一个远小于全文的 KV cache，推理时最多节省 40x 内存（论文声称）；机制分析发现 Cartridge 的 key 是稳定、可跨任务共享的 retrieval router，大部分压缩发生在 value 向量，跨任务 ablation key 几乎不掉点。

共同假设：低秩结构与校准分布稳定。失效场景：任务切换、领域漂移、需要精确实体细节的检索。

### 2.3 流式算法的理论边界与常数状态

核心思想：不问"怎么压"，而问"在多少空间内能做到多好"，并探索有限状态替代架构。

- **[arXiv:2606.07205v1] Towards Tight Bounds for Streaming Attention**：把压缩形式化为 streaming attention approximation；已有工作用 discrepancy theory 给上界、用信息论给下界，但两者仍有显著 gap，本文缩小该 gap。摘要截断于 "the space usage of their algorithms"，具体界值未给出。
- **[arXiv:2606.09862v1] Blurry Window Attention**：ABC 类方法，存一个 frequency window，用 Dirichlet kernel 插值重建"模糊的" KV 历史，可视为 Sliding Window Attention 的推广；但摘要自承线性模型在 retrieval/recall 任务上仍落后 Transformer。
- **[arXiv:2509.24695v2] SANA-Video**：Linear DiT 加 block-wise 自回归，利用 linear attention 的累积性质得到 constant-memory KV cache，以固定内存提供全局 context；支持 720x1280、分钟级视频，可在 RTX 5090 部署。

共同假设：有限状态可近似任意长历史。失效场景：精确 recall、逐 token 细节依赖。

### 2.4 长视频/世界模型的结构化记忆

核心思想：不再把历史存成 token 级 KV，而是压缩成按空间/区域/槽位寻址的记忆对象，且写入地址与读取地址分离。

- **[arXiv:2512.18741v2] Memorize-and-Generate (MAG)**：把记忆压缩与帧生成解耦，单独训练 memory model 将历史压成 compact KV cache，generator 用它生成后续帧；针对 window attention 的 catastrophic forgetting 与保留全历史的 prohibitive memory cost。
- **[arXiv:2606.13035v1] TetherCache**：training-free、plug-and-play，把 cache 组织为 sink / memory / recent 三段；GRAB（Gated Recall with Attention-Diversity Balancing）选长程记忆帧，针对自生成帧造成的 context distribution shift 与 temporal drift。
- **[arXiv:2605.30519v1] OmniMem**：显式全范围稀疏 KV 检索；Adaptive Window Exclusion 在长历史充足时把 local-window 块排除出候选，消除 local bias；Query-Shared KV Selection 降低跨 query 的 Union Explosion。
- **[arXiv:2610.19257v1] SMART**：constant-size slot recurrence，写入由 observing camera 寻址、读取由 rendering camera 查询；不构建显式 3D 表示，同时满足 bounded storage 与 spatially addressed recall。
- **[arXiv:2609.37690v2] Honeycomb**：HexMemory 用 6 个 spatial/spatiotemporal 平面的低秩表示，固定大小；新 chunk 经 feed-forward writer 写入，扩展时 warp 旧平面并做 confidence-weighted pooling 与 learned residual correction；writer 只处理新 chunk，避免 per-frame 全量重算。
- **[arXiv:2610.02521v2] SMI**：用 MLLM 做 memory manager，四个原子操作——spatial clustering、within-cluster sparsification、action-aware retrieval、reliability-aware（摘要截断）。

共同假设：空间/时间局部性、相机或区域地址稳定。失效场景：剧烈场景切换、非空间型叙事（对话、抽象推理）。

### 2.5 实体/角色寻址记忆

核心思想：一致性由"实体身份"定义而非帧相似度，因此按实体建索引。

- **[arXiv:2607.15772v2] SlotMem**：Character-Semantic Probe 从 cross-attention 定位角色相关 token，Memory Encoder 把 DiT token 压成 role-wise slot memory，Memory Writer 持续更新；解决 frame-level KV 把身份与偶然视觉因素纠缠的问题。
- **[arXiv:2605.23610v1] EM-Vid**：entity-indexed bank of latent patches；sparse token conditioning 只让 self-attention 看实体相关 token；budgeted memory update 保持紧凑。
- **[arXiv:2603.26193v1] MemCam**：把历史帧当 external memory，context compression 加 co-visibility-based selection 动态选最相关历史帧，支持动态相机下的一致性。
- **[arXiv:2606.02436v1] GIM-World**：变长历史压成 fixed-size memory tokens，camera-queryable geometry head 从 frozen foundation model 蒸馏 3D 结构，information-guided pruning 控制编码成本。

共同假设：实体可检测、可跟踪。失效场景：遮挡、外观剧变、多实体交叉。

### 2.6 整合、剪枝与系统协同

核心思想：压缩不只是"丢"，还包括周期性重写（consolidation）、显著性剪枝，以及把检索与计算 overlap。

- **[arXiv:2505.16950v4] Bottlenecked Transformers**：类比大脑的 memory consolidation/reconsolidation，对 KV 段做 in-place rewrite，周期性把新 KV 整合进已建立记忆，以提升泛化推理。
- **[arXiv:2512.00722v1] SpeContext**：把蒸馏语言模型（DLM）当作 retrieval algorithm，用其 head-level attention 做轻量 retrieval head，参数减少超过 90%（论文声称）；系统侧设计 async prefetch dataflow 与 elastic loading，把 KV 检索与 LLM 计算重叠。
- **[arXiv:2504.04514v2] SDTP**：轻量 saliency 预测模块逐层剪枝冗余 token，ranking-based 优化减少 saliency 排序偏差。
- **[arXiv:2601.21896v3] PaFu-KV**：用从 bidirectional teacher 蒸馏的 Salience Estimation Head，同时利用过去与未来信息决定视频 KV 保留，针对 token 贡献的 time-heterogeneous。
- 其他工作一句话：TokenPB [arXiv:2603.18091v2] 用 bucket token 做 VLA 自验证并复用 observation-prefix KV cache；MemoryVAM [arXiv:2606.20679v1] 用 Perceiver 压缩每帧 CLIP 为 memory token 注入策略；SlowFast-VGen [arXiv:2410.23277v2] 用 temporal LoRA 做推理时 fast learning；Any Forcing [arXiv:2610.42031v1] 做 training-free 长程记忆选择；Memoir [arXiv:2510.08553v2] 用 world model 想象未来状态作为检索 query；综述 [arXiv:2609.28466v1] 系统整理了 AR 视频生成的记忆机制。

共同假设：重要性可预测、重写不破坏已学知识。失效场景：salience 预测器分布外、consolidation 引入漂移。

## 3. 2025-2026 最新进展

1. **失真目标迁移**：从 reconstruction error 转向 attention-aware / score-aware，并开始证明可分解性（AATC、SAKI、RateQuant）。
2. **预算分配粒度细化**：从 per-tensor 到 per-head，同时暴露 distortion model mismatch 这一失败模式（RateQuant 的 β 在 3.6–5.3 间变化）。
3. **理论工具进入工程**：spiked random matrix（eOptShrinkQ）、rate-distortion reverse water-filling（AATC）、streaming 下界（Tight Bounds）。
4. **存储对象结构化**：slot / entity / plane / region 取代 append-only 的 token KV；写入地址与读取地址分离（SMART、Honeycomb、SlotMem）。
5. **常数状态回归**：linear attention 的累积 KV（SANA-Video）与 frequency window（BLA）让状态大小与序列长度解耦，但 retrieval 仍是短板。
6. **training-free 成为部署主线**：SAKI、TetherCache、OmniMem、Any Forcing 均无需重训。
7. **被打破的假设**：均匀 bit-width 够用、所有 token 等权、压缩只需保重构、记忆只需压缩不需寻址。

## 4. 横向对比

| 代表工作 | 年份 | 存储层次 | 核心机制 | 声称收益 | 主要局限 |
|---|---|---|---|---|---|
| TurboQuant | 2025 | per-vector | 随机旋转 + 逐坐标标量量化 | near-optimal distortion（论文声称） | 忽略跨 token 结构 |
| Cartridges | 2025 | 文档级 KV | 离线训练压缩 KV，key 作 router | 最多 40x 内存（论文声称） | 需离线训练 |
| Bottlenecked Transformers | 2025 | KV 段 | 周期性 in-place consolidation | 摘要未给数字 | 需训练 |
| Tight Bounds | 2026 | 流式 | discrepancy 上界 + 信息论下界 | 缩小 gap（无具体数字） | 理论假设强 |
| Blurry Window Attention | 2026 | 常数状态 | frequency window + Dirichlet 插值 | 摘要未给数字 | retrieval 落后 |
| AATC | 2026 | per-channel/bit | attention-aware 失真 + reverse water-filling | 摘要截断 | 白噪声假设 |
| RateQuant | 2026 | per-head bit | 按 head 分配 bit，校准失真曲线 | β 3.6–5.3（论文声称） | 校准依赖 |
| eOptShrinkQ | 2026 | 低秩+残差 | 谱收缩 + TurboQuant | 摘要未给数字 | 谱分解开销 |
| SAKI-RoPE | 2026 | per-head 低秩索引 | 双侧协方差闭式 rank-r | recall@64 0.748→0.799（论文声称） | 仅 key 侧 |
| MAG | 2025 | 压缩 KV | 记忆模型与生成器解耦 | 摘要未给数字 | 需训练 |
| TetherCache | 2026 | sink/memory/recent | GRAB 门控召回 | 摘要未给数字 | 启发式 |
| OmniMem | 2026 | 显式全范围 | 稀疏检索 + 窗口排除 | 摘要未给数字 | 依赖检索质量 |
| SMART | 2026 | 常数 slot | 相机寻址写/读 | 摘要未给数字 | 依赖空间假设 |
| Honeycomb | 2026 | 固定 6 平面 | warp + 置信加权融合 | 摘要未给数字 | 低秩表达上限 |
| SlotMem | 2026 | role slot | 角色探针 + slot writer | 摘要未给数字 | 需角色检测 |
| SpeContext | 2025 | 检索式 | DLM retrieval head + async prefetch | 参数减少 >90%（论文声称） | 依赖 DLM |

## 5. 对存储系统设计的启示

1. **接口层**：KV cache 应暴露 `(head, token, rank/bits)` 三级预算接口，并提供 `consolidate`、`evict_by_salience`、`retrieve(query)` 三个原语，替代纯 append-only 的写接口。Bottlenecked Transformers 与 OmniMem 分别证明了"重写"和"按查询取"是独立于压缩的必需操作。
2. **索引结构**：每 head 维护 query 与 key 两个 d×d 协方差，即可在闭式解下构造 rank-r 低秩索引（SAKI 的 Pearson r=0.997 说明该闭式解足够准确）；实体/角色维度再建二级索引，稀疏检索按 block 粒度而非单 token 粒度，以匹配 OmniMem 的 Query-Shared 选择。
3. **分层放置**：把 TetherCache 的 sink/memory/recent 三段上升为显式存储层——sink 常驻 HBM、memory 做 HBM/CPU 两级、recent 放片上 SRAM；SpeContext 的 async prefetch 表明检索延迟应通过与计算 overlap 隐藏，而非靠降低压缩率换取。
4. **量化器元数据**：per-head 的失真曲线参数 β 必须作为运行时校准表存储，禁止跨量化器复用 D(b) 模型（RateQuant 的 mismatch 会使混合精度劣于均匀量化）；eOptShrinkQ 提示应先做谱变换再量化，使残差满足标量量化假设，从而省掉 outlier 与 bias 修正的比特开销。
5. **硬件映射**：TurboQuant 的随机旋转与 eOptShrink 的谱变换都是固定矩阵乘，适合做近存/片上加速；视频侧的 slot/plane 记忆是定长结构（SMART、Honeycomb），可映射到固定 SRAM buffer，避免动态分配与碎片。
6. **评测口径**：内部基准应从 reconstruction MSE 切换为 attention-aware distortion、recall@k 与长时序一致性三项，否则会系统性高估均匀量化、低估结构化记忆的收益。

## 6. 必读五篇

1. **[arXiv:2504.19874v1] TurboQuant** —— 当前量化原语的基准，随机旋转 + 标量量化的思路是后续大量工作的底座。
2. **[arXiv:2605.06675v2] RateQuant** —— 唯一明确揭示 per-head 混合精度会因失真模型失配而反噬的工作，工程落地必读。
3. **[arXiv:2608.14191v1] AATC** —— 把 attention-aware distortion 形式化并做比特分配的框架性工作，定义了新的评测目标。
4. **[arXiv:2608.03228v4] SAKI-RoPE** —— 闭式低秩索引加实测 recall，是本文档中最可直接落地的数据结构设计。
5. **[arXiv:2606.13035v1] TetherCache** —— sink/memory/recent 三段式与 training-free 的 plug-and-play 设计，是"把 KV 当存储层管理"的最清晰范例。