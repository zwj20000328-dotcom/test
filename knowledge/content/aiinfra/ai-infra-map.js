window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["ai-infra-map"] = {
  slug: "ai-infra-map",
  title: "AI Infra 全景图：从硅片到服务",
  subtitle: "一张地图看清大模型背后的系统栈",
  level: 0,
  cluster: "全景",
  tags: ["概览", "技术栈", "学习路径"],
  summary: "用一张六层地图把大模型系统栈串起来：讲清训练与推理两条回路的差异、五类稀缺资源的配比、6ND 算力估算和一次请求的端到端路径，帮你建立分层定位与排障的直觉。",
  keyPoints: [
    "AI Infra 是把硅片、显存、网络和电力转换成可训练、可计费 token 的工程层，边界是“既定模型如何高效跑在真实硬件上”。",
    "六层技术栈从硬件、驱动运行时、编译算子、框架并行、调度平台到应用，上层决策会穿透到底层。",
    "训练优化吞吐与 MFU，推理优化 TTFT、TPOT 与单位 token 成本，两者的瓶颈和手段不能照搬。",
    "用 6ND 可在半分钟内估出训练算力量级；推理 decode 受 HBM 带宽约束，连续批处理是核心杠杆。"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>定位：AI Infra 到底管什么</h2>
<p>先给一句直觉：<mark>AI Infra（AI Infrastructure，人工智能基础设施）</mark>是把机房里的硅片、显存、网络和电力，变成可训练、可计费、可运维的 token 的那一层工程。模型研究回答“什么样的网络更聪明”，AI Infra 回答的是另一组问题：这个网络在给定预算下能不能跑完、跑多快、每百万 token 多少钱、坏了怎么修。</p>
<p>它的边界可以用三个“不”划出来：不研究模型为什么有效，那是算法与架构的领域；不决定数据的内容与标注质量，那是数据工程；但<b>要</b>负责数据如何以足够高的吞吐喂进 GPU。换句话说，凡是“把既定的计算图高效映射到真实硬件”的问题，几乎都落在 AI Infra 里：驱动与运行时、编译与算子、并行策略、集群调度、推理服务、可观测性与容错。</p>
<p>为什么现在必须系统性地理解它？因为过去十年模型效果的主要增量来自规模，而规模的成本由系统效率决定。同一张 H100，写得好与写得差的 kernel 可以差 5 到 10 倍；同一批 1024 张卡，扩展效率可以从 35% 到 90% 不等。这些差距不在论文的公式里，而在栈的每一层。你不需要会写每一层，但必须知道问题出在哪一层。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>模型定义能力上限，Infra 决定你能以多快的速度、多低的成本摸到上限。训练一次大模型的账单，大部分不是“算力单价”决定的，而是“有效算力占比”决定的。</div></div>
</section>

<section class="sec">
<h2>六层技术栈：从硅片到服务</h2>
<p>把整条链路拆成六层，每层只做一件事：向下屏蔽硬件的差异，向上提供稳定的抽象。一次矩阵乘法从 Python 里的 <code>torch.matmul</code> 出发：eager 模式下，它依次穿过框架的算子分发、cuBLAS 的 kernel 选择、CUDA 运行时的 launch 与驱动的命令提交；若走 <code>torch.compile</code>，前面还会多一道图捕获、融合与代码生成。最终都变成 SM（Streaming Multiprocessor）上的指令。任何一层选错，性能都会在物理世界里打折。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="AI Infra 六层技术栈分层图">
<defs><marker id="ai-infra-map-arrow1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-muted)"></path></marker></defs>
<rect x="44" y="16" width="430" height="50" rx="6" fill="var(--sv-a)"></rect>
<text x="58" y="38" font-size="14" font-family="inherit" fill="var(--sv-ink)"><tspan font-weight="bold">L6 应用层</tspan>　Agent · RAG · 产品 API</text>
<text x="58" y="56" font-size="12" font-family="inherit" fill="var(--sv-muted)">把模型能力封装成可计费的产品接口</text>
<text x="496" y="38" font-size="13" font-family="inherit" fill="var(--sv-ink)">产品 / 算法团队</text>
<text x="496" y="56" font-size="12" font-family="inherit" fill="var(--sv-muted)">定义 SLO 与体验</text>
<rect x="44" y="74" width="430" height="50" rx="6" fill="var(--sv-b)"></rect>
<text x="58" y="96" font-size="14" font-family="inherit" fill="var(--sv-ink)"><tspan font-weight="bold">L5 调度与平台</tspan>　K8s · Slurm · Ray</text>
<text x="58" y="114" font-size="12" font-family="inherit" fill="var(--sv-muted)">配额、排队、多租户、故障恢复</text>
<text x="496" y="96" font-size="13" font-family="inherit" fill="var(--sv-ink)">平台工程 / SRE</text>
<text x="496" y="114" font-size="12" font-family="inherit" fill="var(--sv-muted)">守住利用率与稳定性</text>
<rect x="44" y="132" width="430" height="50" rx="6" fill="var(--sv-a2)"></rect>
<text x="58" y="154" font-size="14" font-family="inherit" fill="var(--sv-ink)"><tspan font-weight="bold">L4 框架与并行</tspan>　PyTorch · Megatron · vLLM</text>
<text x="58" y="172" font-size="12" font-family="inherit" fill="var(--sv-muted)">计算图、自动微分、切分与批处理</text>
<text x="496" y="154" font-size="13" font-family="inherit" fill="var(--sv-ink)">训练框架 / 推理引擎</text>
<text x="496" y="172" font-size="12" font-family="inherit" fill="var(--sv-muted)">决定并行策略与显存占用</text>
<rect x="44" y="190" width="430" height="50" rx="6" fill="var(--sv-b2)"></rect>
<text x="58" y="212" font-size="14" font-family="inherit" fill="var(--sv-ink)"><tspan font-weight="bold">L3 编译与算子</tspan>　Triton · torch.compile · CUTLASS</text>
<text x="58" y="230" font-size="12" font-family="inherit" fill="var(--sv-muted)">图优化、算子融合、kernel 代码生成</text>
<text x="496" y="212" font-size="13" font-family="inherit" fill="var(--sv-ink)">性能工程师</text>
<text x="496" y="230" font-size="12" font-family="inherit" fill="var(--sv-muted)">把硬件利用率做上去</text>
<rect x="44" y="248" width="430" height="50" rx="6" fill="var(--sv-c)"></rect>
<text x="58" y="270" font-size="14" font-family="inherit" fill="var(--sv-ink)"><tspan font-weight="bold">L2 驱动与运行时</tspan>　CUDA · NCCL · 容器</text>
<text x="58" y="288" font-size="12" font-family="inherit" fill="var(--sv-muted)">设备管理、集合通信、拓扑感知</text>
<text x="496" y="270" font-size="13" font-family="inherit" fill="var(--sv-ink)">性能 / SRE</text>
<text x="496" y="288" font-size="12" font-family="inherit" fill="var(--sv-muted)">处理版本兼容与链路异常</text>
<rect x="44" y="306" width="430" height="50" rx="6" fill="var(--sv-a2)"></rect>
<text x="58" y="328" font-size="14" font-family="inherit" fill="var(--sv-ink)"><tspan font-weight="bold">L1 硬件</tspan>　H100/H200 · HBM3/3e · NVLink · IB</text>
<text x="58" y="346" font-size="12" font-family="inherit" fill="var(--sv-muted)">计算、显存、互联、供电与散热</text>
<text x="496" y="328" font-size="13" font-family="inherit" fill="var(--sv-ink)">硬件 / 集群团队</text>
<text x="496" y="346" font-size="12" font-family="inherit" fill="var(--sv-muted)">决定所有性能的物理上限</text>
<line x1="26" y1="356" x2="26" y2="20" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#ai-infra-map-arrow1)"></line>
<text x="18" y="188" font-size="12" font-family="inherit" fill="var(--sv-muted)" transform="rotate(-90 18 188)">抽象层级升高，离物理越远</text>
</svg>
<figcaption>图 1 · 六层技术栈。左侧是抽象层级，右侧是每层最典型的归属团队；越往下，问题越接近物理约束。</figcaption>
</figure>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>层</th><th>核心职责</th><th>代表组件</th><th>典型瓶颈</th></tr></thead>
<tbody>
<tr><td>L6 应用</td><td>把模型能力封装为产品接口与工作流</td><td>Agent、RAG、API 网关</td><td>端到端延迟预算、单位请求成本</td></tr>
<tr><td>L5 平台</td><td>资源配额、排队、容错、多租户隔离</td><td>Kubernetes、Slurm、Ray、Volcano</td><td>资源碎片、排队时间、故障恢复</td></tr>
<tr><td>L4 框架</td><td>计算图、自动微分、并行切分与批处理</td><td>PyTorch、Megatron-LM、DeepSpeed、vLLM</td><td>通信开销、显存容量、流水气泡</td></tr>
<tr><td>L3 编译算子</td><td>图优化、算子融合、代码生成与选择</td><td>Triton、torch.compile、CUTLASS、cuBLAS</td><td>硬件利用率、尾效应、编译时间</td></tr>
<tr><td>L2 运行时</td><td>设备与内存管理、集合通信、容器化</td><td>CUDA、ROCm、NCCL、GPU Operator</td><td>版本兼容、拓扑感知、驱动故障</td></tr>
<tr><td>L1 硬件</td><td>提供计算、显存、互联、供电与散热</td><td>H100/H200、HBM3/3e、NVLink、InfiniBand</td><td>带宽、功耗墙、硬件故障率</td></tr>
</tbody>
</table></div>
<p>分层不是为了画组织架构，而是为了<mark>跨层定位</mark>。一个真实的例子：团队决定用 FP8 训练，看起来只是改一个精度参数，实际要求 L1 的 Tensor Core 支持 FP8、L3 的 kernel 有对应实现、L4 的框架能处理缩放因子、L5 的镜像与驱动版本匹配。任一层缺一块，最终表现都是“训练变慢或 loss 异常”，而根因可能离你改代码的地方隔了三层。</p>
<p>上层的并行策略，永远要先问下层借不借得起这份带宽：张量并行每一层都要做 AllReduce，为什么必须留在 NVLink 域内，见 interconnect 一篇。</p>
</section>

<section class="sec">
<h2>两条回路：训练要吞吐，推理要延迟</h2>
<p>AI Infra 的所有工作最终服务于两条回路。训练回路是“数据进、梯度出、参数更新”的批量流水线，关注单位时间能处理多少 token，也就是吞吐（throughput）；推理回路是“请求进、token 出”的在线服务，关注首 token 等多快、每个 token 多快，也就是延迟（latency）。两条回路的硬件画像、调度方式和优化目标都不同。</p>
<div class="duo">
<div class="duo__col"><h4>训练回路</h4><p>批量大、可排队、可重试；一次 step 内所有 GPU 同步前进，通信与计算可以重叠。核心指标是 tokens/s/GPU、MFU 与有效训练时间。优化手段包括并行切分、梯度累积、混合精度、计算通信重叠、checkpoint 异步化。</p></div>
<div class="duo__col"><h4>推理回路</h4><p>请求随机到达、对尾延迟敏感；prefill 计算密集，decode 访存密集，KV Cache 随上下文增长。核心指标是 TTFT（Time To First Token）、TPOT（Time Per Output Token）与每百万 token 成本。优化手段包括连续批处理、PagedAttention、前缀缓存、量化与投机解码。</p></div>
</div>
<p>训练循环里，一个 step 的数据与资源流可以用图 2 表示。它是一条闭环：存储里的样本被读进主机内存，拷贝到 GPU 显存，完成前向与反向，梯度通过 NVLink 或 InfiniBand 做 AllReduce，优化器更新参数，周期性把 checkpoint 写回存储。任何一环慢，其他 GPU 都要等；跑得最慢的那张卡或那个任务就叫 <mark>straggler（掉队者）</mark>，它会把局部延迟放大成全局吞吐损失。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="训练循环的数据与资源流">
<defs><marker id="ai-infra-map-arrow2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-muted)"></path></marker></defs>
<rect x="50" y="36" width="200" height="56" rx="6" fill="var(--sv-a)"></rect>
<text x="64" y="59" font-size="13" font-family="inherit" fill="var(--sv-ink)"><tspan font-weight="bold">① 采样 batch</tspan></text>
<text x="64" y="79" font-size="12" font-family="inherit" fill="var(--sv-muted)">存储 → 主机内存（CPU 解码）</text>
<rect x="290" y="36" width="180" height="56" rx="6" fill="var(--sv-b)"></rect>
<text x="304" y="59" font-size="13" font-family="inherit" fill="var(--sv-ink)"><tspan font-weight="bold">② H2D 拷贝</tspan></text>
<text x="304" y="79" font-size="12" font-family="inherit" fill="var(--sv-muted)">PCIe / NVLink C2C</text>
<rect x="520" y="36" width="200" height="56" rx="6" fill="var(--sv-a2)"></rect>
<text x="534" y="59" font-size="13" font-family="inherit" fill="var(--sv-ink)"><tspan font-weight="bold">③ 前向 + 反向</tspan></text>
<text x="534" y="79" font-size="12" font-family="inherit" fill="var(--sv-muted)">GPU 算力 + HBM 带宽</text>
<rect x="520" y="180" width="200" height="56" rx="6" fill="var(--sv-b2)"></rect>
<text x="534" y="203" font-size="13" font-family="inherit" fill="var(--sv-ink)"><tspan font-weight="bold">④ 梯度 AllReduce</tspan></text>
<text x="534" y="223" font-size="12" font-family="inherit" fill="var(--sv-muted)">NVLink / InfiniBand</text>
<rect x="290" y="180" width="180" height="56" rx="6" fill="var(--sv-c)"></rect>
<text x="304" y="203" font-size="13" font-family="inherit" fill="var(--sv-ink)"><tspan font-weight="bold">⑤ 优化器 step</tspan></text>
<text x="304" y="223" font-size="12" font-family="inherit" fill="var(--sv-muted)">HBM 容量与带宽</text>
<rect x="50" y="180" width="200" height="56" rx="6" fill="var(--sv-a2)"></rect>
<text x="64" y="203" font-size="13" font-family="inherit" fill="var(--sv-ink)"><tspan font-weight="bold">⑥ Checkpoint</tspan></text>
<text x="64" y="223" font-size="12" font-family="inherit" fill="var(--sv-muted)">HBM → 并行文件系统</text>
<text x="290" y="116" font-size="13" font-family="inherit" fill="var(--sv-ink)">一个 step：毫秒到秒级</text>
<text x="290" y="140" font-size="12" font-family="inherit" fill="var(--sv-muted)">任一环慢，全体 GPU 空转</text>
<line x1="250" y1="64" x2="290" y2="64" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#ai-infra-map-arrow2)"></line>
<line x1="470" y1="64" x2="520" y2="64" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#ai-infra-map-arrow2)"></line>
<line x1="620" y1="92" x2="620" y2="180" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#ai-infra-map-arrow2)"></line>
<line x1="520" y1="208" x2="470" y2="208" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#ai-infra-map-arrow2)"></line>
<line x1="290" y1="208" x2="250" y2="208" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#ai-infra-map-arrow2)"></line>
<line x1="150" y1="180" x2="150" y2="92" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#ai-infra-map-arrow2)"></line>
<text x="50" y="292" font-size="12" font-family="inherit" fill="var(--sv-muted)">数据侧：存储 IOPS 与 CPU 解码常是隐藏瓶颈，GPU 会周期性饥饿。</text>
<text x="50" y="316" font-size="12" font-family="inherit" fill="var(--sv-muted)">网络侧：AllReduce 打不满时，扩展效率随卡数增加而下降。</text>
<text x="50" y="340" font-size="12" font-family="inherit" fill="var(--sv-muted)">显存侧：Adam 混合精度训练约需 16 字节/参数的模型状态（不含激活）。</text>
</svg>
<figcaption>图 2 · 训练循环的数据与资源流。六个阶段首尾相接，每一阶段的主要瓶颈标注在框内。</figcaption>
</figure>
<p>衡量训练效率最常用的指标是 <mark>MFU（Model FLOPs Utilization）</mark>：模型实际完成的浮点运算量除以硬件理论峰值。百亿参数以上的语言模型训练，MFU 常见落在 35% 到 50% 之间，视模型结构、序列长度、并行策略与集群质量而定。它不是越高越好，而是要与通信、显存和稳定性折中；把 MFU 从 38% 提到 45%，往往比换一代硬件的收益更直接。</p>
</section>

<section class="sec">
<h2>五类稀缺资源：木桶由最短的那块决定</h2>
<p>大模型系统的成本与性能，最终由五类资源的配比决定：算力、显存、网络、存储、电力。它们不是可以互相替代的“钱”，而是必须同时满足的木桶板。很多团队买了足够多的 GPU，却在电力或网络配额上被卡住；也有团队显存够大，但 HBM 带宽不足，decode 吞吐上不去。“稀缺”指的不是绝对数量，而是相对于当前工作负载的短板。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>资源</th><th>关键指标</th><th>大模型里的主要消耗</th><th>参考量级（H100 SXM 单卡）</th></tr></thead>
<tbody>
<tr><td>算力</td><td>FLOPS，实测 MFU</td><td>前向与反向的矩阵乘</td><td>BF16 稠密约 989 TFLOPS；LLM 训练 MFU 常见 35% 至 50%</td></tr>
<tr><td>显存</td><td>容量 GB，带宽 TB/s</td><td>权重、梯度、优化器状态、KV Cache</td><td>80 GB HBM3，带宽 3.35 TB/s</td></tr>
<tr><td>网络</td><td>GB/s，端到端微秒级延迟</td><td>张量、流水、数据并行的通信</td><td>NVLink 900 GB/s（双向聚合）；InfiniBand NDR 400 Gb/s 约合 50 GB/s（单向）</td></tr>
<tr><td>存储</td><td>顺序带宽 GB/s，随机 IOPS</td><td>数据集读取、checkpoint 写入</td><td>本地 NVMe 数 GB/s；并行文件系统视集群规模而定</td></tr>
<tr><td>电力</td><td>kW，PUE（电能使用效率）</td><td>GPU、CPU、交换与散热</td><td>单卡 TDP 700 W，8 卡服务器整机约 10 kW</td></tr>
</tbody>
</table></div>
<p>表中的数字以 H100 SXM 为锚点。更新一代的 B200/GB200 把单卡 HBM3e 提到约 192 GB、带宽约 8 TB/s，NVLink 5 每卡双向约 1.8 TB/s，量级再上一档；做预算时应按实际采购型号重算，而不是套用 Hopper 的数字。</p>
<p>网络常被低估。H100 单卡 NVLink 双向聚合带宽约 900 GB/s，即每向约 450 GB/s；而跨机的一口 NDR InfiniBand 是 400 Gb/s，约合 50 GB/s 单向。按同一口径（单向对单向）比较，两者相差约 9 倍；若拿 NVLink 的双向聚合去比 IB 的单向，会得到 18 倍这个偏大的数字。这解释了一个工程惯例：张量并行（tensor parallelism）尽量留在单机 NVLink 域内，跨机优先用流水并行（pipeline parallelism）或数据并行（data parallelism），因为后两者的通信量与计算量的比值更低。拓扑不是机房布线细节，它直接决定并行策略的上限。</p>
<p>电力则是更硬的天花板。8 卡 H100 服务器按整机 10 kW 估算，一个 1024 卡的集群约需 128 台，IT 负载约 1.3 MW；按 PUE 1.2 计算，园区总用电约 1.5 MW。这还没算网络交换机、存储与冷却余量。电力配额往往决定了你能建多大集群，也决定了训练任务能否在电价低的时段跑满，所以“算力规划”从来不是只数卡。</p>
</section>

<section class="sec">
<h2>用 6ND 在 30 秒内估出训练算力</h2>
<p>训练算力有一个极好用的粗略公式，叫 <mark>6ND</mark>。设模型参数量为 N，训练 token 数为 D。前向传播时，每个参数对每个 token 做一次乘加，约 2 次浮点运算（一次乘、一次加），所以前向约 2ND；反向传播要计算对权重和对输入的梯度，计算量约为前向的 2 倍，即 4ND；合计约 6ND。它忽略注意力里与序列长度平方相关的项，但当训练 token 总数远大于单条序列长度时，这个近似足够做预算。</p>
<div class="formula">训练总浮点运算  C_train ≈ 6 × N × D
N = 参数量，D = 训练 token 数
有效算力  F_eff = 卡数 × 单卡峰值 × MFU
训练时长  T ≈ C_train ÷ F_eff</div>
<p>代入一个具体例子：N = 7×10⁹（70 亿参数），D = 2×10¹²（2 万亿 token），则 C_train ≈ 6 × 7×10⁹ × 2×10¹² = 8.4×10²² FLOPs。用 H100 SXM 的 BF16 稠密峰值 989 TFLOPS、按 40% MFU 计算，单卡有效算力约 3.96×10¹⁴ FLOP/s，1024 卡合计约 4.05×10¹⁷ FLOP/s。所需时间约为 2.07×10⁵ 秒，也就是约 2.4 天。同一份计算放在单卡上则要 2457 天，这就是为什么大模型训练必须走向集群。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="不同模型规模与 token 数的训练算力量级对比">
<line x1="210" y1="300" x2="700" y2="300" stroke="var(--sv-line)" stroke-width="1.5"></line>
<line x1="210" y1="48" x2="210" y2="300" stroke="var(--sv-line)" stroke-width="1.5"></line>
<line x1="210" y1="300" x2="210" y2="306" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="290" y1="300" x2="290" y2="306" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="370" y1="300" x2="370" y2="306" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="450" y1="300" x2="450" y2="306" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="530" y1="300" x2="530" y2="306" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="610" y1="300" x2="610" y2="306" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="690" y1="300" x2="690" y2="306" stroke="var(--sv-line)" stroke-width="1"></line>
<text x="210" y="324" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">10²⁰</text>
<text x="290" y="324" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">10²¹</text>
<text x="370" y="324" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">10²²</text>
<text x="450" y="324" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">10²³</text>
<text x="530" y="324" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">10²⁴</text>
<text x="610" y="324" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">10²⁵</text>
<text x="690" y="324" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">10²⁶</text>
<text x="455" y="350" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">训练总 FLOPs（对数刻度）；卡时按 H100 40% MFU 折算</text>
<text x="198" y="76" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="end">1B × 1T</text>
<text x="198" y="94" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">约 4.2k 卡时</text>
<rect x="210" y="58" width="142" height="36" rx="4" fill="var(--sv-a)"></rect>
<text x="220" y="82" font-size="12" font-family="inherit" fill="var(--sv-ink)">6×10²¹ FLOPs</text>
<text x="198" y="136" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="end">7B × 2T</text>
<text x="198" y="154" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">约 59k 卡时</text>
<rect x="210" y="118" width="234" height="36" rx="4" fill="var(--sv-b)"></rect>
<text x="220" y="142" font-size="12" font-family="inherit" fill="var(--sv-ink)">8.4×10²² FLOPs</text>
<text x="198" y="196" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="end">70B × 15T</text>
<text x="198" y="214" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">约 4.4M 卡时</text>
<rect x="210" y="178" width="384" height="36" rx="4" fill="var(--sv-a2)"></rect>
<text x="220" y="202" font-size="12" font-family="inherit" fill="var(--sv-ink)">6.3×10²⁴ FLOPs</text>
<text x="198" y="256" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="end">405B × 15T</text>
<text x="198" y="274" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">约 25M 卡时</text>
<rect x="210" y="238" width="445" height="36" rx="4" fill="var(--sv-b2)"></rect>
<text x="220" y="262" font-size="12" font-family="inherit" fill="var(--sv-ink)">3.6×10²⁵ FLOPs</text>
</svg>
<figcaption>图 3 · 6ND 的量级感。参数量或 token 数任一翻 10 倍，训练算力与卡时也大致翻 10 倍；图中卡时是 40% MFU 下的理想折算。</figcaption>
</figure>
<p>这个估算有三类误差要心里有数。第一，注意力部分随序列长度增长，长上下文训练的实际 FLOPs 会高于 6ND；第二，激活重计算（activation checkpointing）会额外增加约三分之一的计算量，但换来显存下降；第三，MFU 是实测值，通信、气泡、故障与降频都会让它低于理论。工程上先把 6ND 当基线，再用实测 tokens/s 反推真实 MFU，两者对不上时，差额就是你要排障的空间。</p>
<div class="callout callout--formula"><span class="callout__label">公式</span><div>做预算时按“三问”推进：要训多大（N）、要见多少 token（D）、手上是什么卡与多少张（峰值与规模）。先算 C_train，再除以有效算力得到时间，最后乘以电价与卡时单价得到成本。所有精确值都要标注设备型号与 MFU 口径。</div></div>
</section>

<section class="sec">
<h2>一次推理请求的端到端旅程</h2>
<p>推理的难点在于一个请求要经过多个阶段，每个阶段的瓶颈完全不同。用户发出 prompt 后，网关做鉴权、限流与路由；调度器把请求放进队列，尝试与已有请求拼批、命中前缀缓存；推理引擎先做 <mark>prefill</mark>，把整段 prompt 并行算一遍，生成首 token 与 KV Cache；随后进入 <mark>decode</mark>，每次只生成一个 token，并把新的 KV 追加到缓存；最后通过 SSE 或流式协议逐段回传。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="一次推理请求的端到端泳道图">
<defs><marker id="ai-infra-map-arrow3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-muted)"></path></marker></defs>
<rect x="8" y="36" width="744" height="46" rx="4" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<rect x="8" y="100" width="744" height="46" rx="4" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<rect x="8" y="164" width="744" height="46" rx="4" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<rect x="8" y="228" width="744" height="46" rx="4" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<rect x="8" y="292" width="744" height="46" rx="4" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="18" y="64" font-size="13" font-family="inherit" fill="var(--sv-muted)">客户端</text>
<text x="18" y="128" font-size="13" font-family="inherit" fill="var(--sv-muted)">API 网关</text>
<text x="18" y="192" font-size="13" font-family="inherit" fill="var(--sv-muted)">调度器</text>
<text x="18" y="256" font-size="13" font-family="inherit" fill="var(--sv-muted)">推理引擎</text>
<text x="18" y="320" font-size="13" font-family="inherit" fill="var(--sv-muted)">GPU / 显存</text>
<rect x="120" y="42" width="160" height="32" rx="4" fill="var(--sv-a)"></rect>
<text x="130" y="63" font-size="12" font-family="inherit" fill="var(--sv-ink)">请求 + 采样参数</text>
<rect x="420" y="42" width="110" height="32" rx="4" fill="var(--sv-a2)"></rect>
<text x="430" y="63" font-size="12" font-family="inherit" fill="var(--sv-ink)">首 token</text>
<rect x="545" y="42" width="150" height="32" rx="4" fill="var(--sv-a2)"></rect>
<text x="555" y="63" font-size="12" font-family="inherit" fill="var(--sv-ink)">流式 token 增量</text>
<rect x="140" y="106" width="190" height="32" rx="4" fill="var(--sv-b)"></rect>
<text x="150" y="127" font-size="12" font-family="inherit" fill="var(--sv-ink)">鉴权 · 限流 · 路由</text>
<rect x="430" y="106" width="170" height="32" rx="4" fill="var(--sv-b)"></rect>
<text x="440" y="127" font-size="12" font-family="inherit" fill="var(--sv-ink)">SSE 流式转发</text>
<rect x="160" y="170" width="300" height="32" rx="4" fill="var(--sv-a2)"></rect>
<text x="170" y="191" font-size="12" font-family="inherit" fill="var(--sv-ink)">排队 · 连续批处理 · 前缀缓存命中</text>
<rect x="160" y="234" width="230" height="32" rx="4" fill="var(--sv-b2)"></rect>
<text x="170" y="255" font-size="12" font-family="inherit" fill="var(--sv-ink)">prefill：整段 prompt 并行</text>
<rect x="430" y="234" width="210" height="32" rx="4" fill="var(--sv-b2)"></rect>
<text x="440" y="255" font-size="12" font-family="inherit" fill="var(--sv-ink)">decode：逐 token 自回归</text>
<rect x="150" y="298" width="220" height="32" rx="4" fill="var(--sv-c)"></rect>
<text x="160" y="319" font-size="12" font-family="inherit" fill="var(--sv-ink)">读权重 + 写 KV Cache</text>
<rect x="410" y="298" width="190" height="32" rx="4" fill="var(--sv-c)"></rect>
<text x="420" y="319" font-size="12" font-family="inherit" fill="var(--sv-ink)">KV Cache 常驻 HBM</text>
<line x1="200" y1="74" x2="200" y2="106" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#ai-infra-map-arrow3)"></line>
<line x1="220" y1="138" x2="220" y2="170" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#ai-infra-map-arrow3)"></line>
<line x1="250" y1="202" x2="250" y2="234" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#ai-infra-map-arrow3)"></line>
<line x1="390" y1="250" x2="430" y2="250" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#ai-infra-map-arrow3)"></line>
<line x1="250" y1="266" x2="250" y2="298" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#ai-infra-map-arrow3)"></line>
<line x1="500" y1="266" x2="500" y2="298" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#ai-infra-map-arrow3)"></line>
<path d="M640 250 L672 250 L672 122 L600 122" fill="none" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#ai-infra-map-arrow3)"></path>
<path d="M430 122 L400 122 L400 58 L420 58" fill="none" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#ai-infra-map-arrow3)"></path>
<line x1="530" y1="58" x2="545" y2="58" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#ai-infra-map-arrow3)"></line>
<path d="M200 352 L200 346 L475 346 L475 352" fill="none" stroke="var(--sv-muted)" stroke-width="1"></path>
<text x="248" y="370" font-size="12" font-family="inherit" fill="var(--sv-muted)">TTFT：网关 + 排队 + prefill</text>
<path d="M475 352 L475 346 L690 346 L690 352" fill="none" stroke="var(--sv-muted)" stroke-width="1"></path>
<text x="520" y="370" font-size="12" font-family="inherit" fill="var(--sv-muted)">TPOT：每 token 的 HBM 读取 + 通信</text>
</svg>
<figcaption>图 4 · 一次推理请求的端到端泳道图。自上而下是调用栈，自左向右是时间；底部标出 TTFT 与 TPOT 的归属。</figcaption>
</figure>
<p>prefill 与 decode 的硬件画像截然不同。prefill 一次处理成百上千个 token，矩阵乘规模大，偏向计算密集，决定 <mark>TTFT</mark>；单请求的 decode 每步只处理一个 token，却要把全部权重从 HBM 读一遍，偏向访存密集，决定 <mark>TPOT</mark>；连续批处理下这一份权重会被同批的多个请求共享。以 7B 模型、FP16 权重为例，H100 的 3.35 TB/s 带宽对应约 240 token/s 的单请求理论上限，实际通常只有其中一半到七成。完整的算术强度推导与 Roofline 落点见 three-bottlenecks。</p>
<p>这也解释了连续批处理（continuous batching）为什么是推理平台的核心杠杆：同一份权重读一次，可以服务多个请求，算术强度随 batch 上升，吞吐显著提高；代价是每个请求的 TPOT 可能变长，显存中的 KV Cache 也更多。推理优化从来不是单点调参，而是在 TTFT、TPOT、吞吐与显存之间做显式的取舍。KV Cache 的分页管理、前缀共享与量化，都是在同一张账单上做加减法。</p>
<pre class="code" data-lang="bash"><code># 1) 看卡型、显存、功耗上限；topo 看 GPU 间互联
nvidia-smi --query-gpu=name,memory.total,power.limit --format=csv
nvidia-smi topo -m

# 2) 单机 8 卡 AllReduce 带宽体检（1 GB 消息）
export CUDA_VISIBLE_DEVICES=0,1,2,3,4,5,6,7
./all_reduce_perf -b 1G -e 1G -f 2 -g 8

# 3) 起一个 OpenAI 兼容的推理服务（7B，2 卡张量并行）
vllm serve Qwen2.5-7B-Instruct --tensor-parallel-size 2 --max-model-len 8192</code></pre>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>不要把训练的吞吐指标套到推理上：训练看 tokens/s/GPU，推理看 P99 的 TTFT 与 TPOT。GPU 利用率高也不等于用户体验好，长 prompt 的 prefill 会把队列堵住，短请求的 TPOT 再漂亮也救不了尾延迟。</div></div>
</section>

<section class="sec">
<h2>角色分工与学习路径</h2>
<p>AI Infra 不是一个岗位，而是一组相邻岗位的集合。它们共享同一张栈图，但各自对某几层负主要责任。理解彼此的接口，比记住工具名更重要。</p>
<ul>
<li><b>性能工程师（Performance Engineer）</b>：用 roofline 与 profiler 定位算子、访存与通信瓶颈，写 Triton 或 CUDA kernel，做融合、量化与布局优化。</li>
<li><b>训练框架工程师</b>：设计数据、张量、流水并行的组合，管理显存与 checkpoint，处理容错与弹性，目标是把 MFU 与有效训练时间做上去。</li>
<li><b>推理平台工程师</b>：负责 serving、批处理、KV Cache 管理、模型热更新与容量规划，对 TTFT、TPOT 与单位 token 成本负责。</li>
<li><b>SRE / 集群工程师</b>：维护网络拓扑、存储、供电、监控与故障注入，保证万卡集群“可用”，而不只是“亮着”。</li>
</ul>
<p>这些角色的协作接口就是“指标 + 复现”。性能工程师交付的是某算子从 30% 到 70% 带宽利用率的证据；训练框架交付的是扩展效率曲线与 step 时间分解；推理平台交付的是不同 batch 下的延迟分布；SRE 交付的是故障率、降频率与网络误码。没有这些口径，跨层讨论就会退化成“再试试”“换张卡”。</p>
<p>对应的学习路径建议按层级推进，每一层都以“能动手、能排障”为过关标准，而不是读完文档：</p>
<ol>
<li>第 0 层（本篇）：建立分层地图与资源账本，能估算训练与推理的量级。</li>
<li>第 1 层 硬件：GPU 微架构、HBM 层级、NVLink 与 InfiniBand 拓扑，能读懂 <code>nvidia-smi</code> 与 roofline。</li>
<li>第 2 层 单机优化：CUDA 执行模型、算子融合、Triton 与 profiling，能把一个 kernel 推到带宽上限。</li>
<li>第 3 层 训练：集合通信、数据/张量/流水并行、ZeRO 与容错，能估算并调优 MFU。</li>
<li>第 4 层 推理：prefill/decode、连续批处理、PagedAttention、量化与投机解码，能守住延迟 SLO。</li>
<li>第 5 层 平台：调度、多租户、可观测性与成本核算，能把集群当产品运营。</li>
<li>第 6 层 前沿：新硬件、新数值格式、超长上下文与异构推理，跟踪变化而不被名词带走。</li>
</ol>
<div class="callout callout--tip"><span class="callout__label">建议</span><div>每学一层，用三个问题自检：这一层向我保证什么接口？它主要消耗哪类稀缺资源？它最常见的三种坏法是什么？三个问题都能答上来，才算真正拥有这一层；否则只是记住了几个工具名。</div></div>
</section>

<section class="sec">
<h2>常见误区、排障与自测</h2>
<p>第一个误区是只盯峰值 FLOPS。真实 kernel 常常受 HBM 带宽或指令延迟限制，算力峰值只是分子上的理论值。第二个误区是以为加卡就线性加速：Amdahl 定律、通信开销与同步屏障会让 1024 卡的扩展效率明显低于单机。第三个误区是把 MFU 当常数，序列长度、batch、并行切分、降频与故障都会改变它。第四个误区是忽略数据加载与 checkpoint，GPU 等数据时账单照付。第五个误区是只看平均延迟，容量规划必须看 P99。</p>
<p>排障的主线是<mark>分层二分</mark>：先判断是“算错”还是“算慢”。算错从最小复现开始，逐层替换，从单卡单算子到单机多卡再到多机；算慢先测单机基线，再测扩展效率。命令层面，先用 <code>nvidia-smi</code> 看功耗、显存与拓扑，再用 NCCL tests 确认集合通信能打满，最后才进 profiler 看 kernel。多数“训练变慢”的根因在数据管线、checkpoint 抖动或某张卡降频，而不是框架本身。</p>
<details class="quiz"><summary>Q1 · 70B 参数、15T token，在 1024 张 H100（BF16 989 TFLOPS，MFU 40%）上训练要多久？</summary><div class="quiz__a">C = 6 × 7×10¹⁰ × 1.5×10¹³ = 6.3×10²⁴ FLOPs。有效算力 = 1024 × 989×10¹² × 0.4 ≈ 4.05×10¹⁷ FLOP/s。时间 ≈ 1.56×10⁷ 秒，约 180 天。若扩到 16384 卡且扩展效率理想，约 11 天；真实集群还要加上故障重启与 checkpoint 开销，通常再留 10% 到 20% 余量。</div></details>
<details class="quiz"><summary>Q2 · 为什么 decode 阶段 batch=1 时 GPU 算力利用率很低，而增大 batch 能提升吞吐？</summary><div class="quiz__a">每生成一个 token 都要把全部权重从 HBM 读一遍，算术强度约为 2N FLOPs ÷ 2N 字节 = 1 FLOP/byte，远低于 H100 的机器平衡点（约 989×10¹² ÷ 3.35×10¹² ≈ 295 FLOP/byte），因此受带宽限制而非算力限制。增大 batch 后同一份权重服务多个请求，算术强度上升，吞吐提高；代价是 KV Cache 占用增加、TPOT 可能变长。</div></details>
<details class="quiz"><summary>Q3 · torch.compile、Triton、cuBLAS、NCCL 分别属于六层栈的哪一层？</summary><div class="quiz__a">torch.compile 与 Triton 属于 L3 编译与算子层；cuBLAS 是算子库，也归 L3（运行时依赖 L2）；NCCL 是集合通信库，属于 L2 驱动与运行时层。真实边界有重叠，重要的是知道出问题时该找哪一层、看哪类日志与指标。</div></details>
<details class="quiz"><summary>Q4 · 训练 loss 正常但吞吐只有峰值的 20%，给出至少三个排查方向。</summary><div class="quiz__a">可从五处入手：数据加载是否让 GPU 饥饿（存储 IOPS、CPU 解码、worker 数）；集合通信是否与计算重叠、并行切分是否跨了慢链路；checkpoint 与日志是否同步写且频率过高；GPU 是否降频或撞功耗墙；是否存在单卡拖慢全局的 straggler，以及 kernel 是否低效（小 batch、未融合、布局不佳）。</div></details>
<ul class="refs">
<li><b>Machine Learning Systems: Principles and Practices of Engineering Artificially Intelligent Systems</b> — Vijay Janapa Reddi 等, 2022。系统视角的教材，覆盖硬件、编译、分布式训练与服务化，适合建立全局框架。</li>
<li><b>Efficient Processing of Deep Neural Networks: A Tutorial and Survey</b> — Vivienne Sze 等, Proceedings of the IEEE, 2017。讲清数据流、算术强度与 roofline，是理解“为什么受带宽限制”的经典入口。</li>
<li><b>Designing Machine Learning Systems</b> — Chip Huyen, O'Reilly, 2022。从生产系统角度看数据、部署、监控与迭代，补足平台与运维视角。</li>
<li><b>NVIDIA H100 Tensor Core GPU Architecture</b> — NVIDIA, 2022。H100 的 SM、Tensor Core、HBM3 与 NVLink 规格白皮书，本篇的峰值算力与带宽数字以此为口径。</li>
<li><b>Efficient Large-Scale Language Model Training on GPU Clusters Using Megatron-LM</b> — Deepak Narayanan 等, SC 2021。并行组合与扩展效率的经典分析，适合读完本篇后进入第 3 层。</li>
</ul>
</section>`
};
