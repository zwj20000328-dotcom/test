window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["accelerator-landscape"] = {
  slug: "accelerator-landscape",
  title: "加速器版图：GPU、TPU、NPU 与 ASIC",
  subtitle: "通用性与效率之间的光谱",
  level: 1,
  cluster: "硬件",
  tags: ["TPU", "NPU", "ASIC", "国产芯片"],
  summary: "把 GPU、TPU、NPU、ASIC 放回同一条通用性-效率光谱，讲清脉动阵列、SRAM-only 与晶圆级的取舍，并给出以每百万 token 成本为准的选型框架。",
  keyPoints: [
    "专用加速器的收益来自减少数据搬运，而不是把乘法器做得更快",
    "TPU 的脉动阵列用权重驻留换取数据复用，代价是依赖编译器静态排布",
    "Groq 的 SRAM-only 与 Cerebras 的晶圆级方案分别在赌带宽与赌规模",
    "选型要算每百万 token 的 TCO，软件迁移成本常被低估"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>先建立直觉：问题不是"谁最快"，而是"谁更省"</h2>
<p>如果你只问"哪块芯片最快"，这个问题没有答案；有意义的问题是"在我的模型、我的批量、我的电价下，每产出 100 万个 token 谁更便宜、谁更稳"。加速器版图本质上是一条从<mark>通用</mark>到<mark>专用</mark>的光谱：左端是可编程性最强的通用 GPU，右端是把某类计算固化进硅片的专用集成电路（ASIC, Application-Specific Integrated Circuit）。越往右，单位任务的能效通常越高，但为迁移模型、重写算子、接受厂商编译器所付的代价也越高。</p>
<p>这篇解决三件事。第一，给一张能定位任何加速器的坐标系，看到参数就知道它站在哪一段。第二，拆开 TPU 的脉动阵列（systolic array）、Groq 的 SRAM-only、Cerebras 的晶圆级（wafer-scale）这些路线，讲清各自优化什么、又必然在哪儿吃亏。第三，给出一套可执行的选型与总拥有成本（TCO, Total Cost of Ownership）估算方法，以及国产替代中那些不会写在规格表上的约束。分布式训练、单机 kernel 优化、推理调度分别在后续篇章展开，这里只在边界处一句话带过。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>加速器不是"更快的 CPU"，而是"把数据搬运次数砍掉的机器"。同一份权重，读一次用一次是 CPU，读一次用一万次才是加速器。</div></div>
</section>

<section class="sec">
<h2>物理约束：能量花在搬运上，不是花在乘法上</h2>
<p>要理解专用化为什么有效，先看能量花在哪。在 7 nm 级工艺下，一次 32 位浮点乘加（FMA）的能耗约在 0.1–1 pJ，而从 DRAM 读 32 位数据约在几十到上百 pJ，相差约两个数量级；跨芯片、跨封装移动数据的单位比特能耗通常还要更高。数量级上的差距意味着：现代加速器的瓶颈往往不是"算不动"，而是"喂不上"。</p>
<p>量化这个问题的工具是 roofline 模型（推导与落点见 three-bottlenecks）。它用<mark>算术强度</mark>（arithmetic intensity，单位字节数据能支撑多少次浮点运算）把算力和带宽放在同一个坐标系里：</p>
<div class="formula">可达算力 P ≤ min(P_peak, I × BW)　其中 I = FLOPs ÷ Bytes</div>
<p>当 I 很小时，性能被 I × BW 这条斜线压住，叫带宽受限（memory-bound）；当 I 足够大时，性能才触到 P_peak 这条水平线，叫算力受限（compute-bound）。矩阵乘法在理想分块下 I 可以做到很高，所以大模型训练看起来是算力受限；但注意，Attention 的 decode 阶段、LayerNorm、逐元素算子、以及多数小批量推理，I 都低得可怜，它们在推理负载里往往是大头。这也是为什么"峰值 TFLOPS"经常和实测吞吐对不上。</p>
<p>专用加速器的共同策略都是抬高有效 I：把权重留在片上、让同一份数据被成百上千个处理单元（PE, Processing Element）复用、用确定性调度消除 cache miss 的尾部抖动。通用 GPU 靠大寄存器堆、共享内存和高带宽 HBM 把 I 做高；TPU 靠脉动阵列；Groq 干脆把 DRAM 从数据通路上拿掉。区别只在于：把复杂度放在硬件里，还是放在编译器里。</p>
</section>

<section class="sec">
<h2>架构族谱：四条路线，一张图定位</h2>
<p>按"可编程性从高到低"，市面产品可落到四类。第一类是 SIMT（Single Instruction, Multiple Threads）通用 GPU，以 NVIDIA H100/B200、AMD MI300X 为代表，用大量可编程线程、缓存与 HBM 覆盖尽可能多的负载。第二类是数据流/脉动阵列加速器，TPU、Trainium、Gaudi、昇腾都属于这一类（业界也常把这类面向神经网络的专用单元统称为 NPU，即 Neural Processing Unit），把矩阵乘复用模式固化，由编译器映射计算图。第三类是确定性 SRAM-only 架构，Groq LPU 是典型，权重全部放 SRAM，指令由编译器静态排定。第四类是晶圆级（wafer-scale）方案，Cerebras 把整片晶圆做成一颗芯片，用超大规模片上网络把片间通信变成片内通信。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="AI 加速器架构族谱，按可编程性从高到低分为通用 GPU、数据流脉动阵列、确定性 SRAM-only 与晶圆级，后两类在图中合并为一列">
<defs>
<marker id="accelerator-landscape-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-line)"/></marker>
</defs>
<text x="380" y="26" text-anchor="middle" font-size="15" font-family="inherit" fill="var(--sv-ink)">AI 加速器架构族谱（按可编程性从高到低）</text>
<rect x="280" y="44" width="200" height="42" rx="8" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="380" y="70" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">AI 加速器</text>
<line x1="380" y1="86" x2="380" y2="110" stroke="var(--sv-line)" marker-end="url(#accelerator-landscape-arrow)"/>
<line x1="380" y1="110" x2="130" y2="110" stroke="var(--sv-line)"/>
<line x1="380" y1="110" x2="630" y2="110" stroke="var(--sv-line)"/>
<line x1="130" y1="110" x2="130" y2="132" stroke="var(--sv-line)" marker-end="url(#accelerator-landscape-arrow)"/>
<line x1="380" y1="110" x2="380" y2="132" stroke="var(--sv-line)" marker-end="url(#accelerator-landscape-arrow)"/>
<line x1="630" y1="110" x2="630" y2="132" stroke="var(--sv-line)" marker-end="url(#accelerator-landscape-arrow)"/>
<rect x="20" y="136" width="220" height="60" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="130" y="160" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">SIMT 通用 GPU</text>
<text x="130" y="181" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">NVIDIA H100 / B200 · AMD MI300X</text>
<rect x="270" y="136" width="220" height="60" rx="8" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="380" y="160" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">数据流 / 脉动阵列</text>
<text x="380" y="181" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">TPU · Trainium · Gaudi · Ascend</text>
<rect x="520" y="136" width="220" height="60" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="630" y="160" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">确定性 SRAM-only / 晶圆级</text>
<text x="630" y="181" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">Groq LPU · Cerebras WSE</text>
<line x1="130" y1="196" x2="130" y2="248" stroke="var(--sv-line)" marker-end="url(#accelerator-landscape-arrow)"/>
<line x1="380" y1="196" x2="380" y2="248" stroke="var(--sv-line)" marker-end="url(#accelerator-landscape-arrow)"/>
<line x1="630" y1="196" x2="630" y2="248" stroke="var(--sv-line)" marker-end="url(#accelerator-landscape-arrow)"/>
<rect x="20" y="252" width="220" height="52" rx="8" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="130" y="273" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">CUDA / ROCm</text>
<text x="130" y="292" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">算子可手写，迁移成本低</text>
<rect x="270" y="252" width="220" height="52" rx="8" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="380" y="273" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">XLA · Neuron · CANN</text>
<text x="380" y="292" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">编译器排布，依赖算子覆盖</text>
<rect x="520" y="252" width="220" height="52" rx="8" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="630" y="273" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">静态调度 · 无 DRAM</text>
<text x="630" y="292" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">延迟确定，容量受限</text>
<text x="380" y="340" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-muted)">向右：通用性下降 · 单位任务能效上升 · 软件迁移成本上升</text>
</svg>
<figcaption>图 1 · 四条路线并非性能排名，而是复杂度分配方式的差异（确定性 SRAM-only 与晶圆级合并展示）</figcaption>
</figure>
<p>这张图不是性能排序。通用 GPU 在光谱左端，不代表它弱；恰恰相反，正因为它能覆盖卷积、Attention、稀疏、动态控制流等五花八门的负载，它才成为默认选择。专用加速器赢在窄分布，靠删掉分布外的灵活性。所以选型的第一问永远是：我的负载有多集中？一年要跑十种结构差异大的模型，左端更稳；只跑一类 Transformer 且规模够大，右端才划算。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="通用性与单位任务能效的光谱示意，从通用 GPU 到固定功能 ASIC 能效上升而可编程性下降">
<defs>
<marker id="accelerator-landscape-axis" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-line)"/></marker>
</defs>
<text x="380" y="24" text-anchor="middle" font-size="15" font-family="inherit" fill="var(--sv-ink)">通用性-效率光谱：专用化越深，能效越高，可编程性越低</text>
<line x1="80" y1="330" x2="710" y2="330" stroke="var(--sv-line)" marker-end="url(#accelerator-landscape-axis)"/>
<line x1="80" y1="330" x2="80" y2="60" stroke="var(--sv-line)" marker-end="url(#accelerator-landscape-axis)"/>
<text x="395" y="362" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-muted)">专用化程度（向右：通用性下降、迁移成本上升）</text>
<text x="34" y="195" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-muted)" transform="rotate(-90 34 195)">单位任务能效（升序）</text>
<path d="M120,250 Q260,215 380,175 T700,80" fill="none" stroke="var(--sv-b)" stroke-width="12" opacity="0.22"/>
<path d="M120,250 Q260,215 380,175 T700,80" fill="none" stroke="var(--sv-line)" stroke-width="1.5" stroke-dasharray="6 5"/>
<circle cx="150" cy="240" r="7" fill="var(--sv-a)" stroke="var(--sv-ink)"/>
<text x="150" y="222" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">通用 GPU</text>
<text x="150" y="270" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">可编程性最高</text>
<circle cx="330" cy="188" r="7" fill="var(--sv-a2)" stroke="var(--sv-ink)"/>
<text x="330" y="170" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">TPU / NPU</text>
<text x="330" y="218" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">编译器映射，生态绑定</text>
<circle cx="500" cy="140" r="7" fill="var(--sv-b)" stroke="var(--sv-ink)"/>
<text x="500" y="122" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">SRAM-only / 晶圆级</text>
<text x="500" y="170" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">Groq · Cerebras</text>
<circle cx="660" cy="92" r="7" fill="var(--sv-b2)" stroke="var(--sv-ink)"/>
<text x="660" y="74" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">固定功能 ASIC</text>
<text x="660" y="122" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">能效极致，几乎不可编程</text>
<text x="380" y="48" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">曲线为趋势示意，不对应任何具体产品的跑分</text>
</svg>
<figcaption>图 2 · 光谱不是价值判断：越靠右越省电，但越依赖编译器与厂商适配</figcaption>
</figure>
<div class="duo">
<div class="duo__col"><h4>通用 GPU 阵营</h4><p>可编程性最强，CUDA 生态与算子库最厚。代价是面积大量花在缓存、调度器与通用控制逻辑上，单位硅面积矩阵乘效率不如专用阵列。</p></div>
<div class="duo__col"><h4>专用加速器阵营</h4><p>把矩阵乘数据流固化，单位功耗算力更高。代价是算子不全时要回退、等厂商适配，动态 shape 与稀疏支持较差。</p></div>
</div>
</section>

<section class="sec">
<h2>脉动阵列：TPU 的心脏如何跳动</h2>
<p>TPU 的核心是一个二维的乘加阵列。以第一代 TPU 为例，它是 256 × 256 的 8 位乘加阵列，每个交叉点是一个能做乘加的处理单元。数据不是从中央寄存器堆随机取，而是像心跳一样<mark>脉动</mark>着流过阵列：权重从上方一次性载入并驻留在每一列；激活值从左侧进入，沿每一行向右传递；部分和则沿列向下累积。每个 PE 每周期从左侧收一个激活、从上方收一个部分和，乘以本地权重后累加，再把激活右传、部分和下传。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="3行4列脉动阵列数据流示意，激活值自左向右流动，权重自上向下驻留，部分和沿列向下累积">
<defs>
<marker id="accelerator-landscape-flow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-a)"/></marker>
<marker id="accelerator-landscape-wflow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-b)"/></marker>
</defs>
<text x="380" y="24" text-anchor="middle" font-size="15" font-family="inherit" fill="var(--sv-ink)">3 行 × 4 列脉动阵列：权重驻留，激活右流，部分和下流</text>
<text x="140" y="60" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-muted)">激活 a0 → a2（每周期右移一格）</text>
<text x="330" y="60" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-muted)">权重 w0 → w3（驻留于 PE）</text>
<line x1="180" y1="144" x2="248" y2="144" stroke="var(--sv-a)" stroke-width="2" marker-end="url(#accelerator-landscape-flow)"/>
<text x="176" y="149" text-anchor="end" font-size="13" font-family="inherit" fill="var(--sv-a)">a0</text>
<line x1="180" y1="210" x2="248" y2="210" stroke="var(--sv-a)" stroke-width="2" marker-end="url(#accelerator-landscape-flow)"/>
<text x="176" y="215" text-anchor="end" font-size="13" font-family="inherit" fill="var(--sv-a)">a1</text>
<line x1="180" y1="276" x2="248" y2="276" stroke="var(--sv-a)" stroke-width="2" marker-end="url(#accelerator-landscape-flow)"/>
<text x="176" y="281" text-anchor="end" font-size="13" font-family="inherit" fill="var(--sv-a)">a2</text>
<line x1="278" y1="92" x2="278" y2="112" stroke="var(--sv-b)" stroke-width="2" marker-end="url(#accelerator-landscape-wflow)"/>
<text x="278" y="86" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-b)">w0</text>
<line x1="344" y1="92" x2="344" y2="112" stroke="var(--sv-b)" stroke-width="2" marker-end="url(#accelerator-landscape-wflow)"/>
<text x="344" y="86" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-b)">w1</text>
<line x1="410" y1="92" x2="410" y2="112" stroke="var(--sv-b)" stroke-width="2" marker-end="url(#accelerator-landscape-wflow)"/>
<text x="410" y="86" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-b)">w2</text>
<line x1="476" y1="92" x2="476" y2="112" stroke="var(--sv-b)" stroke-width="2" marker-end="url(#accelerator-landscape-wflow)"/>
<text x="476" y="86" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-b)">w3</text>
<rect x="250" y="116" width="56" height="56" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"/><text x="278" y="149" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">PE</text>
<rect x="316" y="116" width="56" height="56" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="344" y="149" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">PE</text>
<rect x="382" y="116" width="56" height="56" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="410" y="149" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">PE</text>
<rect x="448" y="116" width="56" height="56" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="476" y="149" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">PE</text>
<rect x="250" y="182" width="56" height="56" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="278" y="215" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">PE</text>
<rect x="316" y="182" width="56" height="56" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"/><text x="344" y="215" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">PE</text>
<rect x="382" y="182" width="56" height="56" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="410" y="215" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">PE</text>
<rect x="448" y="182" width="56" height="56" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="476" y="215" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">PE</text>
<rect x="250" y="248" width="56" height="56" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="278" y="281" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">PE</text>
<rect x="316" y="248" width="56" height="56" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="344" y="281" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">PE</text>
<rect x="382" y="248" width="56" height="56" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"/><text x="410" y="281" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">PE</text>
<rect x="448" y="248" width="56" height="56" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="476" y="281" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">PE</text>
<line x1="504" y1="144" x2="556" y2="144" stroke="var(--sv-a)" stroke-width="2" marker-end="url(#accelerator-landscape-flow)"/>
<text x="562" y="148" font-size="12" font-family="inherit" fill="var(--sv-muted)">a 继续右移</text>
<line x1="278" y1="304" x2="278" y2="330" stroke="var(--sv-b)" stroke-width="2" marker-end="url(#accelerator-landscape-wflow)"/>
<line x1="344" y1="304" x2="344" y2="330" stroke="var(--sv-b)" stroke-width="2" marker-end="url(#accelerator-landscape-wflow)"/>
<line x1="410" y1="304" x2="410" y2="330" stroke="var(--sv-b)" stroke-width="2" marker-end="url(#accelerator-landscape-wflow)"/>
<line x1="476" y1="304" x2="476" y2="330" stroke="var(--sv-b)" stroke-width="2" marker-end="url(#accelerator-landscape-wflow)"/>
<text x="380" y="350" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-b)">部分和沿列向下累积 → 输出</text>
<text x="380" y="372" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">高亮仅示意 PE 的数据复用关系；同一周期实际激活哪些 PE 取决于输入偏斜（skew）方式</text>
</svg>
<figcaption>图 3 · 权重加载一次后驻留，稳态下每个 PE 每周期只与邻居交换数据，复用度高</figcaption>
</figure>
<p>为什么省？每个 PE 的权重在整个矩阵乘期间留在本地寄存器，激活与部分和只在相邻 PE 间走一格。稳态下，对方阵而言整块阵列每周期完成 N × N 次乘加；对外只需按行送入 N 个激活，权重在计算前一次性加载，不需要每周期从片外重读。用公式表达峰值吞吐：</p>
<div class="formula">峰值算力 = 2 × N² × f　（N 为阵列边长，f 为时钟频率）</div>
<p>代入第一代 TPU 的 256 × 256 阵列与约 0.7 GHz 时钟，可得 2 × 65536 × 0.7 × 10⁹ ≈ 92 TOPS（int8）。这个推算与 Jouppi 等人在 ISCA 2017 论文中给出的 92 TOPS 一致，口径是单芯片 int8 峰值、不含板卡与互联。注意这个"峰值"要乘上阵列利用率才等于实测：矩阵维度不能被 N 整除、batch 太小、算子无法映射，都会让利用率掉下来。这就是为什么同一个模型换 batch size，MFU（Model FLOPs Utilization）能差出好几倍。</p>
<div class="callout callout--formula"><span class="callout__label">公式</span><div>脉动阵列的能效来自"每个操作数移动距离固定为 1 格"，而不是来自更先进的制程。它把布线能量和寄存器堆访问压到最低，代价是数据必须按编译器预设的节奏流动。</div></div>
</section>

<section class="sec">
<h2>六条真实路线，逐个拆开看</h2>
<h3>Google TPU：从推理专用到光交换集群</h3>
<p>TPU 的演进很能说明"专用"。第一代只做推理，2015 年就在数据中心部署；第二代加入训练能力并引入 bf16；第四代（v4）在 ISCA 2023 论文中公布单芯片 275 TFLOPS bf16 峰值算力，并用光路交换（OCS, Optical Circuit Switch）把 4096 颗芯片连成一个可重构的 3D torus 集群。这个数字的口径是 bf16 稠密峰值，不含稀疏加速。v5p 是面向训练的后续型号，Google Cloud 规格页标注单芯片 bf16 稠密峰值约 459 TFLOPS、HBM 容量 95 GB，具体以规格页当前版本为准。TPU 真正的差异化在"芯片-互联-编译器"三位一体：XLA 把计算图切成适配阵列的块，OCS 让集群拓扑随任务重配。</p>
<h3>AWS Trainium / Inferentia：把云厂商的规模优势变成芯片</h3>
<p>AWS 的芯片不单独卖，只随云实例出租，靠自研压低单位 token 成本。Inferentia 面向推理，Trainium 面向训练，配套 Neuron SDK 把 PyTorch/JAX 计算图编译到芯片。AWS 在 re:Invent 2023 公布 Trainium2 相对 Trainium1 的训练性能约 4 倍、能效约 2 倍，这是厂商口径、对比自家上一代，不能跨厂商横比。优势是弹性与价格，劣势是算子覆盖与工具链成熟度不如 CUDA。</p>
<h3>Intel Gaudi：把矩阵乘和网络做进同一颗芯片</h3>
<p>Gaudi 的架构很直接：矩阵乘引擎（MME, Matrix Multiplication Engine）负责大块 GEMM，张量处理器核（TPC）负责逐元素与自定义算子，片上网络把二者连起来。Gaudi 3 的公开规格是 bf16 约 1835 TFLOPS、HBM2e 容量 128 GB、带宽约 3.7 TB/s（Intel 官方发布口径）。一大卖点是集成 24 个 200 GbE 端口，节点间通信从"外挂网卡"变成"芯片自带"，减少外挂网卡与部分交换层成本。</p>
<h3>华为昇腾 910B：国产替代的主战场</h3>
<p>昇腾 910 于 2019 年发布，官方规格为 256 TFLOPS FP16、310 W、7 nm。910B 是其迭代型号，华为并未完整公开其峰值算力、HBM 容量与互联带宽，业界引用数字多为第三方口径，差异不小，<b>做容量规划时必须要求供应商提供合同级规格与实测报告，不要拿网传数字下结论</b>。软件栈是 CANN 与 AscendCL，可接 MindSpore 或 PyTorch。真实约束通常不在峰值，而在算子覆盖、动态 shape 支持与多卡互联实际带宽。</p>
<h3>Groq LPU：把 DRAM 从数据通路上删掉</h3>
<p>Groq 的路线最激进：单芯片约 230 MB 片上 SRAM、片上带宽约 80 TB/s（Groq 官方口径），推理数据通路不依赖外部 DRAM，指令由编译器静态排定，没有 cache、动态调度与乱序执行。好处是延迟确定、抖动极小，适合对尾延迟敏感的场景。代价也硬：权重和 KV cache 必须塞进有限 SRAM，放不下就要多芯片流水或反复换入权重，吞吐明显下降。它赢在小模型、低延迟、高并发的确定性，输在超大模型单机驻留。</p>
<h3>Cerebras WSE：用整片晶圆换掉片间通信</h3>
<p>Cerebras 把 300 mm 晶圆直接做成一颗芯片，用冗余核心绕过缺陷。WSE-2 的公开数据是 46,225 mm² 芯片面积、850,000 个核心、40 GB 片上 SRAM、20 PB/s 片上带宽、2.6 万亿晶体管，采用台积电 7 nm（Cerebras WSE-2 白皮书口径）。权重和激活都能留在片上，片内核心间通信不再经过封装外链路；放得下的模型可在单"芯片"内做模型并行，放不下的则可用 Weight Streaming 从外部存储流式加载权重。代价是良率与散热成本，以及必须围绕它重写代码；适合超大规模训练的特定客户，不是通用选项。</p>
</section>

<section class="sec">
<h2>软件生态：编译器才是真正的护城河</h2>
<p>规律是：同一档次的芯片，差距往往不在 TOPS，而在"你的模型能不能被高效映射上去"。通用 GPU 的护城河是 CUDA 加 cuBLAS、cuDNN、FlashAttention 这类经过千锤百炼的算子库；专用加速器的护城河是编译器，XLA、Neuron、CANN、SynapseAI 都属于这一类。编译器要把计算图切块、做算子融合、安排片上内存复用、决定哪些算子回退到 CPU，任何一环没做好，峰值算力就只是纸面数字。</p>
<p>工程上最该做的第一件事不是跑 benchmark，而是确认工具链能不能把你的模型完整编过去。下面这组命令可以在拿到机器后的十分钟内建立基本认知：</p>
<pre class="code" data-lang="bash"><code># 1) 确认卡型、显存与功耗上限（NVIDIA）
nvidia-smi --query-gpu=name,memory.total,power.limit --format=csv

# 2) 看多卡互联拓扑：NVLink 还是 PCIe
nvidia-smi topo -m

# 3) 昇腾平台的等价健康检查
npu-smi info

# 4) 启动前指定后端（以 PyTorch/XLA 为例，通过环境变量）
export PJRT_DEVICE=TPU
python train.py</code></pre>
<p>接着做"算子覆盖率"测试：把模型里所有算子列出来，逐个确认目标后端有高效实现。经验值是，如果一个模型里有超过 5% 的算力落在回退路径上，端到端性能就会明显低于纸面预期。再往后是数值一致性：bf16、fp8、以及各家自定义的块缩放（block-scaled）低精度格式，都会让同一份代码在不同芯片上给出不同的 loss 曲线，必须用固定种子做对齐实验。</p>
<div class="callout callout--warn"><span class="callout__label">警告</span><div>不要把"PyTorch 能跑"当成"能用于生产"。能跑只说明算子有回退实现，离高效还差一次完整的 profile：看 timeline 里回退算子占比、看 HBM 实际带宽利用率、看多卡通信是否被拓扑拖慢。</div></div>
</section>

<section class="sec">
<h2>TCO、选型与国产替代的现实约束</h2>
<p>选型最终落到钱上。TCO 要把折旧、功耗、网络、机架、运维与迁移人力一起算：</p>
<div class="formula">单卡年成本 ≈ 采购价 ÷ 折旧年限 + 额定功耗(kW) × 负载率 × 电价(元/kWh) × 8760 × PUE + 网络/机架/运维分摊 + 迁移人力摊销</div>
<div class="formula">每百万 token 成本 ≈ 单卡年成本 ÷ 年有效 token 数 × 10⁶　（年有效 token 数以 token 计）</div>
<div class="formula">年有效 token 数 ≈ 峰值吞吐(token/s) × 实际利用率 × 3600 × 8760</div>
<p>第三个式子里的 3600 × 8760 是把秒换算到年；第二个式子的 10⁶ 是把每 token 成本换算成每百万 token；PUE（Power Usage Effectiveness）是数据中心总能耗与 IT 设备能耗之比。忽略 10⁶ 这个系数，会把成本低估六个数量级。</p>
<p>式子中最易忽略的是"实际利用率"和"迁移人力"：前者决定分母，后者是一次性支出，需要按折旧年限摊销进分子。若一块卡因算子回退把利用率从 60% 拉到 40%，纸面快 20% 也会在每 token 成本上输掉。正确顺序：先用真实模型跑出有效吞吐，再套公式，而非拿规格表 TFLOPS 比价。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>代表产品</th><th>架构路线</th><th>片上/显存</th><th>编程模型</th><th>强项</th><th>主要约束</th></tr></thead><tbody>
<tr><td>NVIDIA H100</td><td>通用 SIMT GPU</td><td>HBM3 80 GB（SXM）</td><td>CUDA / Triton</td><td>生态最全</td><td>单价功耗高，供应受约束</td></tr>
<tr><td>Google TPU v5p</td><td>脉动阵列 + 光交换集群</td><td>HBM 95 GB（官方规格页）</td><td>XLA / JAX / PyTorch-XLA</td><td>大规模训练集群效率高</td><td>仅云端，绑定 Google Cloud</td></tr>
<tr><td>AWS Trainium2</td><td>数据流加速器</td><td>官方未发布完整规格表</td><td>Neuron SDK</td><td>云上单位成本低、弹性好</td><td>算子覆盖与调试工具较新</td></tr>
<tr><td>Intel Gaudi 3</td><td>MME + TPC 异构</td><td>HBM2e 128 GB（官方）</td><td>SynapseAI / PyTorch</td><td>集成以太网，scale-out 成本低</td><td>软件栈成熟度追赶中</td></tr>
<tr><td>华为昇腾 910B</td><td>自研达芬奇架构</td><td>官方未完整公开</td><td>CANN / AscendCL / MindSpore</td><td>国内可得性与政策适配</td><td>算子覆盖、互联带宽需实测</td></tr>
<tr><td>Groq LPU</td><td>SRAM-only 确定性</td><td>约 230 MB SRAM（官方）</td><td>Groq SDK / 静态编译</td><td>延迟低且抖动小</td><td>容量小，超大模型需多芯片</td></tr>
<tr><td>Cerebras WSE-2</td><td>晶圆级</td><td>40 GB 片上 SRAM（白皮书）</td><td>Cerebras SDK</td><td>片内核心互联，省去片间链路</td><td>成本高，编程模型需重写</td></tr>
</tbody></table></div>
<p>表中数字均标注官方口径；未给精确值的项是厂商未完整公开，第三方数字不可当常识。跨厂商比较峰值算力没有意义，因为精度、稀疏与互联开销的口径不同。</p>
<p>国产替代还有几层表外约束。其一是<b>互联</b>：单卡能追，但多卡全互联带宽与时延决定大模型训练能否 scale。其二是<b>软件迁移</b>：CUDA 生态里大量算子依赖手写内核，迁移需重写或等适配，工期以季度计。其三是<b>供应与生命周期</b>：迭代节奏、驱动兼容性、备件与支持响应，都会进入 TCO。其四是<b>合规与数据边界</b>：某些场景下芯片选型由合规要求决定，而非性能。</p>
<div class="callout callout--tip"><span class="callout__label">建议</span><div>选型时准备三类数据：目标模型在候选芯片上的有效吞吐（非峰值）、迁移所需人日、三年 TCO。三者齐了再决策；只看第一项最易翻车。</div></div>
</section>

<section class="sec">
<h2>常见误区、自测与延伸阅读</h2>
<p>三个高频误区：第一，把峰值 TFLOPS 当实际性能，忽略精度口径（fp16、bf16、fp8、int8 差好几倍）与稀疏口径。第二，把"支持 PyTorch"当"性能可用"，没做算子回退率与 timeline 分析。第三，忽略集群瓶颈：互联带宽不足时，单卡再快 MFU 也上不去。</p>
<p>把本文当工具用：先按负载集中度在光谱上选一段，再用真实模型测有效吞吐，最后算三年 TCO。遇到新芯片，按"架构—内存—编程模型—互联"四栏填表，比只看 TOPS 更有用。</p>
<details class="quiz"><summary>Q1 · 为什么 TPU 用脉动阵列，而不是大量独立 ALU 加一个大寄存器堆？</summary><div class="quiz__a">脉动阵列把权重驻留在每个 PE 本地，激活与部分和只在相邻 PE 间移动一格，数据复用度高、布线短、寄存器堆访问少，因而每瓦能效高。独立 ALU 方案需要频繁从寄存器堆或共享存储取操作数，搬运能耗会吃掉算力收益。代价是数据流必须由编译器静态排布，灵活性下降。</div></details>
<details class="quiz"><summary>Q2 · Groq 的 SRAM-only 路线在什么负载下会明显吃亏？</summary><div class="quiz__a">当模型权重加 KV cache 超过单芯片约 230 MB 的 SRAM 容量时，必须多芯片流水或反复换入权重，吞吐下降、优势消失。因此它适合小模型、低延迟、高并发、对尾延迟敏感的推理；不适合超大模型单机驻留或需要动态 shape 的负载。</div></details>
<details class="quiz"><summary>Q3 · 某芯片 bf16 峰值 1000 TFLOPS、HBM 带宽 3 TB/s，模型算术强度 200 FLOPs/Byte，可达算力上限是多少？</summary><div class="quiz__a">按 roofline，P ≤ min(1000, 200 × 3 × 10¹² ÷ 10¹²) = min(1000, 600) = 600 TFLOPS。此时是带宽受限，只能发挥峰值的 60%。要突破就得分块提高数据复用（提高 I），或换更高带宽的存储。</div></details>
<ul class="refs">
<li><b>In-Datacenter Performance Analysis of a Tensor Processing Unit</b> — Jouppi et al., ISCA 2017。第一代 TPU 架构、92 TOPS int8 口径与实测对比的出处。</li>
<li><b>TPU v4: An Optically Reconfigurable Supercomputer for Machine Learning with Hardware Support for Embeddings</b> — Jouppi et al., ISCA 2023（arXiv:2304.01433）。v4 的 275 TFLOPS bf16 口径、OCS 与 4096 芯片集群细节。</li>
<li><b>Wafer-Scale Engine 2 (WSE-2) 产品白皮书</b> — Cerebras Systems, 2021。46,225 mm²、850,000 核心、40 GB 片上 SRAM、20 PB/s 带宽的官方来源。</li>
<li><b>GroqChip 架构与 Groq 官方文档</b> — Groq, groq.com/docs。SRAM-only、静态调度与确定性延迟的一手说明。</li>
<li><b>昇腾社区 CANN 文档与 Ascend 910 系列资料</b> — 华为, hiascend.com。AscendCL 接口、算子库与 910 官方规格。</li>
<li><b>AWS Neuron SDK 文档</b> — Amazon Web Services。Trainium/Inferentia 的编译流程、算子支持与实例规格。</li>
</ul>
</section>`
};
