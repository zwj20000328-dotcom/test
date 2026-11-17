window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["inference-basics"] = {
  slug: "inference-basics",
  title: "推理基础：prefill、decode 与 KV Cache",
  subtitle: "理解两阶段，才能谈优化",
  level: 4,
  cluster: "推理",
  tags: ["KV Cache", "TTFT", "TPOT"],
  summary: "自回归推理分为 prefill 与 decode，前者算力受限，后者带宽受限。核心是 KV Cache 公式与 7B 算例、TTFT 与 TPOT 拆解，以及并发估算。",
  keyPoints: [
    "prefill 并行处理整段提示词，算术强度约为 T，通常算力受限；decode 每步只处理 1 个 token，算术强度约为 batch size，通常带宽受限。",
    "KV Cache 大小 = 2 × 层数 × KV 头数 × head 维 × 序列长度 × 并发 × 字节数；7B/32 层/32 头/4K 序列在 fp16 下单条约 2 GiB，GQA-8 降到 512 MiB。",
    "TTFT 由排队与 prefill 主导，TPOT 由权重与 KV 的读取带宽主导；增大 batch 提升吞吐但抬高 TPOT，需要按 SLO 找拐点。",
    "显存决定并发上限，长上下文时 KV 可能比权重更占地方；流式返回只改善感知延迟，不改变总生成时间。"
  ],
  readingMinutes: 14,
  html: String.raw`
<section class="sec">
<h2>先给结论：一次生成，两种完全不同的负载</h2>
<p>当你向一个大模型发一句"帮我写一封邮件"，服务端实际做了两件性质相反的事。第一件是把整段提示词（prompt）一次性喂进模型，并行算出所有位置的中间结果，这一步叫 <mark>prefill</mark>；第二件是从第一个输出 token 开始，每次只前进一个 token，直到遇到停止符，这一步叫 <mark>decode</mark>。两者都属于自回归生成（autoregressive generation），但计算与访存特征几乎相反。</p>
<p>prefill 处理的是 T 个 token 组成的矩阵，矩阵乘规模大、算术强度（arithmetic intensity，每字节内存流量对应的浮点运算数）高，通常受<mark>算力</mark>限制；decode 每一步只处理 1 个新 token，矩阵乘退化成矩阵-向量乘，必须把全部模型权重和 KV Cache 从显存读一遍，通常受<mark>显存带宽</mark>限制。用错药方的优化很常见：给 decode 堆算力几乎没有收益，给 prefill 省显存也解决不了延迟。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>把生成想成写文章：prefill 是通读并理解你给的资料，可以多人同时读；decode 是逐字往下写，每写一个字都要回头翻一遍全部笔记（权重与历史 KV）。翻笔记的速度，才是逐字阶段的瓶颈。</div></div>
<p>下面按"过程 → 两阶段特征 → KV Cache → 指标 → 工程估算"的顺序展开。调度与连续批处理（continuous batching）的算法细节不在这里展开，放在 batching-scheduling 一篇。</p>
</section>

<section class="sec">
<h2>自回归生成：为什么必须一个 token 一个 token 地算</h2>
<p>Decoder-only Transformer 是一个下一 token 预测器：给定 x₁ 到 x_t，输出概率分布 p(x_{t+1} | x₁…x_t)，采样得到 x_{t+1} 后把它追加到输入，再预测下一个。因为第 t+1 步的输入依赖第 t 步的采样结果，这个循环在时间上无法并行，输出 N 个 token 就需要 N 次前向。</p>
<p>训练时不是这样：在 teacher forcing 下整条序列已知，一次前向配合因果掩码（causal mask）就能并行算出所有位置的损失。所以"训练能吃满 GPU、推理却常常吃不满"的根源不在框架，而在采样这个串行依赖。</p>
<p>因果掩码还带来一个可利用的性质：第 t 个位置计算注意力时只用到 1 到 t 的 K 和 V，与未来无关。因此每算出一个 token，它的 K/V 可以被缓存下来供后续步骤复用，而不必每步重算整段前缀。如果不缓存，生成第 N 个 token 要重新前向 N 个 token，线性层累计 O(N²)、注意力累计 O(N³)；缓存后线性层部分降为 O(N)，注意力部分降为 O(N²)（每步仍要与全部历史 K/V 做注意力），代价是显存。这就是 KV Cache 的全部动机。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="一次请求中 prefill 与 decode 阶段的时间线">
<defs>
<marker id="inference-basics-arrow-1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-ink)"></path></marker>
</defs>
<text x="24" y="26" font-size="15" font-family="inherit" fill="var(--sv-ink)">一次请求的时间线：prefill 只做一次，decode 重复 N_out 次</text>
<text x="24" y="46" font-size="12" font-family="inherit" fill="var(--sv-muted)">提示词越长 prefill 块越宽；输出越长 decode 块越多</text>
<text x="205" y="138" font-size="12.5" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">prefill：一次前向处理 T 个 token</text>
<text x="470" y="138" font-size="12.5" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">decode：每步只处理 1 个新 token</text>
<rect x="60" y="150" width="30" height="64" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="4 3"></rect>
<rect x="90" y="150" width="230" height="64" rx="3" fill="var(--sv-a)"></rect>
<rect x="334" y="158" width="26" height="48" rx="2" fill="var(--sv-b)"></rect>
<rect x="370" y="158" width="26" height="48" rx="2" fill="var(--sv-b)"></rect>
<rect x="406" y="158" width="26" height="48" rx="2" fill="var(--sv-b)"></rect>
<rect x="442" y="158" width="26" height="48" rx="2" fill="var(--sv-b)"></rect>
<rect x="478" y="158" width="26" height="48" rx="2" fill="var(--sv-b)"></rect>
<rect x="514" y="158" width="26" height="48" rx="2" fill="var(--sv-b)"></rect>
<rect x="550" y="158" width="26" height="48" rx="2" fill="var(--sv-b)"></rect>
<rect x="586" y="158" width="26" height="48" rx="2" fill="var(--sv-b)"></rect>
<text x="75" y="143" font-size="10.5" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">排队</text>
<text x="205" y="238" font-size="11.5" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">算力受限（compute-bound）</text>
<text x="500" y="238" font-size="11.5" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">带宽受限（memory-bound），每步重读权重与 KV</text>
<line x1="60" y1="96" x2="334" y2="96" stroke="var(--sv-ink)" stroke-width="1.2" marker-start="url(#inference-basics-arrow-1)" marker-end="url(#inference-basics-arrow-1)"></line>
<line x1="60" y1="96" x2="60" y2="150" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="334" y1="96" x2="334" y2="158" stroke="var(--sv-line)" stroke-width="1"></line>
<text x="197" y="86" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">TTFT = 网络 + 排队 + prefill + 首 token 采样</text>
<line x1="334" y1="250" x2="370" y2="250" stroke="var(--sv-b)" stroke-width="1.2" marker-start="url(#inference-basics-arrow-1)" marker-end="url(#inference-basics-arrow-1)"></line>
<line x1="334" y1="206" x2="334" y2="250" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="370" y1="206" x2="370" y2="250" stroke="var(--sv-line)" stroke-width="1"></line>
<text x="352" y="268" font-size="12" font-family="inherit" fill="var(--sv-b)" text-anchor="middle">TPOT</text>
<line x1="50" y1="300" x2="730" y2="300" stroke="var(--sv-ink)" stroke-width="1" marker-end="url(#inference-basics-arrow-1)"></line>
<line x1="60" y1="294" x2="60" y2="306" stroke="var(--sv-ink)" stroke-width="1"></line>
<line x1="334" y1="294" x2="334" y2="306" stroke="var(--sv-ink)" stroke-width="1"></line>
<line x1="612" y1="294" x2="612" y2="306" stroke="var(--sv-ink)" stroke-width="1"></line>
<text x="60" y="322" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">t₀ 请求发出</text>
<text x="334" y="322" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">t₁ 首 token</text>
<text x="612" y="322" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">t_end 停止</text>
<text x="24" y="350" font-size="10.5" font-family="inherit" fill="var(--sv-muted)">示意：块的宽度不代表严格比例。prefill 的线性层 FLOPs 随 T 线性增长，注意力项随 T² 增长；decode 每步耗时由权重与 KV 的读取带宽决定。</text>
<text x="24" y="366" font-size="10.5" font-family="inherit" fill="var(--sv-muted)">实际部署中，多个请求的 decode 可以拼在同一 batch 里并行，这是吞吐优化的起点。</text>
</svg><figcaption>图 1 · 两阶段时间线。TTFT 覆盖网络、排队、prefill 与首 token 采样；TPOT 是 decode 相邻两步的间隔，端到端延迟约等于 TTFT 加 (N_out − 1) × TPOT。</figcaption></figure>
</section>

<section class="sec">
<h2>prefill：一次算完提示词，算力受限</h2>
<p>prefill 把长度 T 的 prompt 作为一个大矩阵送进网络。参数量 P 的模型处理 T 个 token 的前向 FLOPs 约为 2PT（每个参数每个 token 一次乘加，乘加计 2 FLOP），注意力部分还要再加与 T² 成正比的项。关键在于权重只需从 HBM 读一次，却被 T 个 token 共享，因此算术强度近似为 T FLOP/byte（fp16/bf16 权重，每参数 2 字节）。T=2048 时约 2048 FLOP/byte，远高于 H100 的脊点（ridge point）约 295 FLOP/byte，属于典型的<mark>算力受限</mark>（compute-bound）。</p>
<p>这解释了 prefill 的两个经验规律：第一，时间大致随 prompt 长度线性增长，因为 FLOPs 随 T 线性增长；第二，它是 GPU 利用率最高的阶段，优化方向是更快的 GEMM、更高的 MFU（model FLOPs utilization）以及更少的 attention 二次项开销。当 T 很长（如 32K 以上），attention 的 O(T²) 项开始显著，长上下文 prefill 会更偏向 IO 与 SRAM 优化，而不是单纯堆 GEMM。</p>
<p>数量级估算：7B 模型、T=2048，前向约 2 × 7×10⁹ × 2048 ≈ 2.9×10¹³ FLOP，即 29 TFLOP。H100 SXM 80GB 的 BF16 稠密算力约 989 TFLOPS（FP16 同值；稀疏口径约 1979 TFLOPS），按 30% MFU 算有效约 297 TFLOPS，prefill 约 0.10 s。换成 A100 80GB（BF16 稠密约 312 TFLOPS，同样 30% MFU 约 94 TFLOPS），约 0.31 s。这是 TTFT 的主要构成，实际还要加上排队与网络时间。注意 MFU 视 kernel、并行策略与 batch 而定，30% 只是常见量级。</p>
</section>

<section class="sec">
<h2>decode：一次只出一个 token，带宽受限</h2>
<p>进入 decode 后，每一步的输入只有 1 个新 token 的表示（batch 内每个序列各 1 个）。一层里的线性层从"矩阵 × 矩阵"退化为窄 GEMM；单序列（B=1）时进一步退化为矩阵-向量乘（GEMV）：权重矩阵仍然要整体读一遍，但只做一次向量乘。以 fp16 计，每个权重占 2 字节；单序列时每个权重只参与 1 次乘加（2 FLOP），算术强度约为 B FLOP/byte（B 个序列共享同一次权重读取）。B=1 时算术强度为 1 FLOP/byte，只有 H100 脊点的约 1/295，Tensor Core 绝大部分时间在等 HBM。</p>
<p>单流速度的理论上界由带宽决定：A100 80GB 的 HBM2e 带宽约 2.039 TB/s，7B 模型 fp16 权重 14 GB，读一遍至少 14/2039 ≈ 6.9 ms，即单序列上限约 146 token/s。实测通常在几十 token/s 量级，差距来自 kernel 效率、KV Cache 读取、采样与框架开销。H100 SXM（HBM3 约 3.35 TB/s）把这一上限抬到约 239 token/s，量级提升但结论不变：<mark>decode 的本质是把权重从显存搬到计算单元</mark>。</p>
<p>长上下文会让账面更难看：每步除了读权重，还要读该序列累积的整个 KV Cache。7B、32 层、32 头、head dim 128 的模型在 4096 token 时，单序列 KV 约 2 GiB（下一节给公式），batch=32 时每步要读 32 × 2 GiB 以上的 KV，远超 14 GB 权重。此时 decode 的带宽几乎全花在 KV 上，这也是长上下文推理贵、并发上不去的直接原因。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="decode 在 Roofline 模型上的落点">
<defs>
<marker id="inference-basics-arrow-3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-ink)"></path></marker>
</defs>
<text x="24" y="26" font-size="15" font-family="inherit" fill="var(--sv-ink)">decode 落在 Roofline 的带宽斜边上</text>
<text x="24" y="46" font-size="12" font-family="inherit" fill="var(--sv-muted)">双对数坐标；横轴为算术强度，纵轴为可达 BF16 算力</text>
<line x1="90" y1="320" x2="700" y2="320" stroke="var(--sv-ink)" stroke-width="1"></line>
<line x1="90" y1="320" x2="90" y2="70" stroke="var(--sv-ink)" stroke-width="1"></line>
<line x1="90" y1="236.7" x2="700" y2="236.7" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"></line>
<line x1="90" y1="153.3" x2="700" y2="153.3" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"></line>
<line x1="90" y1="70" x2="700" y2="70" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"></line>
<text x="82" y="324" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">1</text>
<text x="82" y="240" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">10</text>
<text x="82" y="157" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">100</text>
<text x="82" y="74" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">1000</text>
<text x="90" y="338" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">1</text>
<text x="242.5" y="338" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">10</text>
<text x="395" y="338" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">100</text>
<text x="547.5" y="338" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">1000</text>
<text x="700" y="338" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">10000</text>
<path d="M90,276.3 L466.6,70.4 L700,70.4" fill="none" stroke="var(--sv-b)" stroke-width="2"></path>
<text x="474" y="82" font-size="11" font-family="inherit" fill="var(--sv-muted)">脊点 ≈ 295 FLOP/byte</text>
<line x1="466.6" y1="70.4" x2="466.6" y2="320" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="4 4"></line>
<circle cx="90" cy="276.3" r="5" fill="var(--sv-a)"></circle>
<circle cx="227.7" cy="201.0" r="5" fill="var(--sv-a)"></circle>
<circle cx="319.5" cy="150.8" r="5" fill="var(--sv-a)"></circle>
<circle cx="411.3" cy="100.7" r="5" fill="var(--sv-a)"></circle>
<text x="98" y="270" font-size="11" font-family="inherit" fill="var(--sv-a)">B=1</text>
<text x="236" y="195" font-size="11" font-family="inherit" fill="var(--sv-a)">B=8</text>
<text x="328" y="145" font-size="11" font-family="inherit" fill="var(--sv-a)">B=32</text>
<text x="402" y="95" font-size="11" font-family="inherit" fill="var(--sv-a)" text-anchor="end">B=128</text>
<circle cx="595" cy="113.9" r="5" fill="var(--sv-c)"></circle>
<text x="605" y="120" font-size="11" font-family="inherit" fill="var(--sv-c)">prefill T=2048</text>
<text x="605" y="135" font-size="11" font-family="inherit" fill="var(--sv-c)">MFU ≈ 30%</text>
<line x1="595" y1="113.9" x2="595" y2="70.4" stroke="var(--sv-c)" stroke-width="1" stroke-dasharray="4 4"></line>
<text x="588" y="64" font-size="10.5" font-family="inherit" fill="var(--sv-c)" text-anchor="end">理论上界 ≈ 989 TFLOPS</text>
<text x="700" y="352" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">算术强度（FLOP/byte，fp16/bf16，对数）</text>
<text x="40" y="200" font-size="11" font-family="inherit" fill="var(--sv-muted)" transform="rotate(-90 40 200)" text-anchor="middle">TFLOPS（对数）</text>
<text x="24" y="372" font-size="10.5" font-family="inherit" fill="var(--sv-muted)">口径：H100 SXM 80GB，HBM3 3.35 TB/s，BF16 稠密约 989 TFLOPS；decode 点按带宽上界估算，未计 KV 与 kernel 开销。</text>
</svg><figcaption>图 2 · 双对数坐标下，decode 的每个 batch 点都贴在带宽斜线上，说明它受限于"每字节能做的运算太少"；batch 增大只是沿斜线右移，接近脊点后才转为算力受限。prefill 的算术强度高出一个数量级以上，但受 MFU 限制，实际落点低于屋顶。</figcaption></figure>
<p>图 2 里有一处容易误读：B=128 的点已沿带宽斜线爬到约 430 TFLOPS，但仍远未触及 989 TFLOPS 的屋顶；而且那是把 128 个序列的 GEMV 拼成窄 GEMM 后的理论上界，真实系统里 KV 读取、采样、kernel 启动都会把点往下压。batch=128 在 4K 上下文下仅 KV 就要 256 GiB，单卡根本放不下。Roofline 用来判断"往哪个方向优化"，不是用来承诺性能。</p>
</section>

<section class="sec">
<h2>KV Cache：公式、算例与 GQA 的杠杆</h2>
<p>KV Cache 保存每一层、每个 KV 头在过去所有位置的 K 与 V。对 batch 中的一个序列，其大小为：</p>
<div class="formula">KV_bytes = 2 × L × H_kv × d_head × S × B × bytes
其中 2 表示 K 与 V 各一份；L 为层数；H_kv 为 KV 头数；d_head 为每头维度；S 为当前序列长度（含 prompt 与已生成 token）；B 为并发序列数；bytes 为每元素字节数（fp16 为 2，fp8 为 1）</div>
<p>代入一个具体配置：7B 模型、L=32、MHA（multi-head attention，H_kv=32）、d_head=128、fp16、S=4096、B=1。每个 token 的 KV 为 2 × 32 × 32 × 128 × 2 B = 524288 B = 512 KiB；乘 4096 得 2 GiB。这就是"7B 模型、4K 上下文、单条序列 2 GiB KV"的来历，与权重 14 GB 相比已经不是小数目。</p>
<p>把 H_kv 调小，KV 线性下降。GQA（grouped-query attention）让多个 query 头共享一组 KV 头，例如 32 个 query 头只保留 8 组 KV，KV 降到 1/4，即 128 KiB/token、4K 时 512 MiB；MQA（multi-query attention）极端到只剩 1 组 KV，即 16 KiB/token、4K 时 64 MiB。代价是表达能力下降：GQA 论文显示，用少量计算做 uptraining 即可把 MHA checkpoint 转成 GQA，质量接近原模型；MQA 更省，但在同等训练预算下质量风险通常更高，多用于对吞吐极敏感的场景。这也是 Llama-3-8B 这类模型采用 8 组 KV 头的原因。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="KV Cache 显存随序列长度线性增长，MHA、GQA、MQA 对比">
<text x="24" y="26" font-size="15" font-family="inherit" fill="var(--sv-ink)">单序列 KV Cache 随序列长度线性增长（7B · 32 层 · d_head=128 · fp16）</text>
<text x="24" y="46" font-size="12" font-family="inherit" fill="var(--sv-muted)">纵轴每序列显存，横轴序列长度；三条线对应 32、8、1 组 KV 头</text>
<line x1="90" y1="320" x2="690" y2="320" stroke="var(--sv-ink)" stroke-width="1"></line>
<line x1="90" y1="320" x2="90" y2="70" stroke="var(--sv-ink)" stroke-width="1"></line>
<line x1="90" y1="264.4" x2="690" y2="264.4" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"></line>
<line x1="90" y1="208.9" x2="690" y2="208.9" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"></line>
<line x1="90" y1="153.3" x2="690" y2="153.3" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"></line>
<line x1="90" y1="97.8" x2="690" y2="97.8" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"></line>
<text x="82" y="324" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">0</text>
<text x="82" y="268" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">1</text>
<text x="82" y="213" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">2</text>
<text x="82" y="157" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">3</text>
<text x="82" y="102" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">4</text>
<text x="90" y="338" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">0</text>
<text x="240" y="338" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">2048</text>
<text x="390" y="338" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">4096</text>
<text x="540" y="338" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">6144</text>
<text x="690" y="338" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">8192</text>
<line x1="90" y1="320" x2="690" y2="97.8" stroke="var(--sv-a)" stroke-width="2.5"></line>
<line x1="90" y1="320" x2="690" y2="264.4" stroke="var(--sv-b)" stroke-width="2.5"></line>
<line x1="90" y1="320" x2="690" y2="313.1" stroke="var(--sv-c)" stroke-width="2.5"></line>
<circle cx="390" cy="208.9" r="4.5" fill="var(--sv-a)"></circle>
<circle cx="390" cy="292.25" r="4.5" fill="var(--sv-b)"></circle>
<circle cx="390" cy="316.5" r="4.5" fill="var(--sv-c)"></circle>
<line x1="390" y1="208.9" x2="390" y2="320" stroke="var(--sv-a)" stroke-width="1" stroke-dasharray="4 4"></line>
<text x="398" y="202" font-size="11" font-family="inherit" fill="var(--sv-a)">2.0 GiB @ 4096</text>
<text x="398" y="286" font-size="10.5" font-family="inherit" fill="var(--sv-b)">0.5 GiB</text>
<text x="505" y="158" font-size="11.5" font-family="inherit" fill="var(--sv-a)">MHA（32 组 KV）→ 4.0 GiB</text>
<text x="505" y="275" font-size="11.5" font-family="inherit" fill="var(--sv-b)">GQA-8 → 1.0 GiB</text>
<text x="560" y="307" font-size="11.5" font-family="inherit" fill="var(--sv-c)">MQA → 0.125 GiB</text>
<text x="690" y="356" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">序列长度 S（token）</text>
<text x="40" y="200" font-size="11" font-family="inherit" fill="var(--sv-muted)" transform="rotate(-90 40 200)" text-anchor="middle">每序列 KV（GiB）</text>
<text x="24" y="372" font-size="10.5" font-family="inherit" fill="var(--sv-muted)">口径：单序列、fp16、B=1；8K 处数值 = 4K 处两倍。真实服务还需为每个请求预留最大上下文，而非平均长度。</text>
</svg><figcaption>图 3 · KV 随序列严格线性增长，权重却是常数：短上下文时权重占大头，约 28K 上下文时 KV 反超 14 GB 权重。H_kv 从 32 降到 8 再降到 1，KV 分别降到 1/4 与 1/32，是架构层面最有效的显存杠杆。</figcaption></figure>
<p>图 3 的三条线对应同一模型规模的三种注意力结构。估算显存时必须按"最大上下文 × 最大并发"预留，而不是按平均长度，否则会在生成长文本时突然 OOM。KV 量化（fp8）可再减半，分页管理（PagedAttention）把碎片压到很低，这些属于系统层手段，vLLM 论文里有完整讨论。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>常见错误：把 KV Cache 当成"临时缓存、可忽略"。在 4K 上下文、几十并发的 7B 服务里，KV 往往是显存占用的第一大户，比权重还大。</div></div>
</section>

<section class="sec">
<h2>四个指标：TTFT、TPOT、吞吐与 QPS</h2>
<p>推理服务的好坏不能用"快不快"一句话概括，至少要拆成四个量。TTFT（time to first token）是从请求发出至第一个输出 token 返回的时间，包含网络、排队、prefill 与首 token 采样；TPOT（time per output token）是 decode 阶段相邻 token 的平均间隔，也叫 ITL（inter-token latency）；吞吐（throughput）是单位时间全系统产出的 token 数；QPS（queries per second）是单位时间完成的请求数。它们的关系是：</p>
<div class="formula">端到端延迟 ≈ TTFT + (N_out − 1) × TPOT
稳态吞吐 ≈ B / TPOT（token/s，B 为同时在 decode 的序列数）
QPS ≈ L / 端到端延迟（L 为系统总并发请求数，各请求长度相近时）
并发数 L ≈ 到达率 × 端到端延迟（Little 定律，用于容量规划）</div>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>指标</th><th>定义</th><th>主要影响因素</th><th>优化方向</th></tr></thead><tbody>
<tr><td>TTFT</td><td>请求到首 token 的时间</td><td>prompt 长度、排队深度、prefill 算力、前缀缓存命中</td><td>前缀缓存、chunked prefill、更好的 prefill 并行</td></tr>
<tr><td>TPOT / ITL</td><td>decode 相邻 token 的平均间隔</td><td>权重与 KV 读取带宽、batch 大小、kernel 效率</td><td>量化、GQA、更高带宽、减少 KV 读取</td></tr>
<tr><td>吞吐</td><td>全系统每秒产出 token 数</td><td>batch、TPOT、GPU 数量</td><td>连续批处理、提高并发、模型并行</td></tr>
<tr><td>QPS</td><td>每秒完成的请求数</td><td>吞吐与每请求 token 数</td><td>提高吞吐、控制输出长度</td></tr>
</tbody></table></div>
<p>关键权衡在于 batch：在带宽受限区间，增大 B 让同一份权重服务更多序列，吞吐近似线性上升；但每步要搬运的 KV 变多、每步耗时变长，TPOT 随之上升，接近算力受限后吞吐增长也会放缓。当 TPOT 逼近 SLO（service level objective，如"TPOT ≤ 30 ms"），继续加 batch 只是用用户体验换吞吐。这就是吞吐-延迟曲线，也是连续批处理需要调度策略的原因（细节见 batching-scheduling）。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="batch 增大时吞吐上升、TPOT 变差的双面板曲线">
<text x="24" y="26" font-size="15" font-family="inherit" fill="var(--sv-ink)">batch 增大：吞吐上升，TPOT 变差（7B · 4K · A100 估算）</text>
<text x="24" y="46" font-size="12" font-family="inherit" fill="var(--sv-muted)">只计权重与 KV 的 HBM 读取，忽略 kernel、采样与调度开销</text>
<text x="60" y="74" font-size="12" font-family="inherit" fill="var(--sv-ink)">吞吐（token/s）</text>
<text x="410" y="74" font-size="12" font-family="inherit" fill="var(--sv-ink)">TPOT（ms）</text>
<line x1="60" y1="320" x2="360" y2="320" stroke="var(--sv-ink)" stroke-width="1"></line>
<line x1="60" y1="320" x2="60" y2="80" stroke="var(--sv-ink)" stroke-width="1"></line>
<text x="52" y="324" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">0</text>
<text x="52" y="264" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">200</text>
<text x="52" y="204" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">400</text>
<text x="52" y="144" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">600</text>
<text x="52" y="84" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">800</text>
<line x1="410" y1="320" x2="710" y2="320" stroke="var(--sv-ink)" stroke-width="1"></line>
<line x1="410" y1="320" x2="410" y2="80" stroke="var(--sv-ink)" stroke-width="1"></line>
<text x="402" y="324" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">0</text>
<text x="402" y="244" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">15</text>
<text x="402" y="164" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">30</text>
<text x="402" y="84" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">45</text>
<path d="M60,282.2 L89,211.7 L127.7,163.1 L205.2,117.5 L282.6,95.9 L360,83.3" fill="none" stroke="var(--sv-a)" stroke-width="2.5"></path>
<circle cx="60" cy="282.2" r="3.5" fill="var(--sv-a)"></circle>
<circle cx="89" cy="211.7" r="3.5" fill="var(--sv-a)"></circle>
<circle cx="127.7" cy="163.1" r="3.5" fill="var(--sv-a)"></circle>
<circle cx="205.2" cy="117.5" r="3.5" fill="var(--sv-a)"></circle>
<circle cx="282.6" cy="95.9" r="3.5" fill="var(--sv-a)"></circle>
<circle cx="360" cy="83.3" r="3.5" fill="var(--sv-a)"></circle>
<path d="M410,277.8 L439,260.9 L477.7,238.5 L555.2,193.5 L632.6,148.6 L710,103.7" fill="none" stroke="var(--sv-b)" stroke-width="2.5"></path>
<circle cx="410" cy="277.8" r="3.5" fill="var(--sv-b)"></circle>
<circle cx="439" cy="260.9" r="3.5" fill="var(--sv-b)"></circle>
<circle cx="477.7" cy="238.5" r="3.5" fill="var(--sv-b)"></circle>
<circle cx="555.2" cy="193.5" r="3.5" fill="var(--sv-b)"></circle>
<circle cx="632.6" cy="148.6" r="3.5" fill="var(--sv-b)"></circle>
<circle cx="710" cy="103.7" r="3.5" fill="var(--sv-b)"></circle>
<line x1="410" y1="160" x2="710" y2="160" stroke="var(--sv-ink)" stroke-width="1" stroke-dasharray="5 4"></line>
<text x="708" y="154" font-size="10.5" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">SLO：TPOT ≤ 30 ms</text>
<line x1="263.2" y1="320" x2="263.2" y2="103.9" stroke="var(--sv-muted)" stroke-width="1" stroke-dasharray="4 4"></line>
<line x1="613.2" y1="320" x2="613.2" y2="160" stroke="var(--sv-muted)" stroke-width="1" stroke-dasharray="4 4"></line>
<text x="269" y="308" font-size="10.5" font-family="inherit" fill="var(--sv-muted)">B ≈ 22</text>
<text x="60" y="338" font-size="11" font-family="inherit" fill="var(--sv-muted)">1</text>
<text x="127.7" y="338" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">8</text>
<text x="205.2" y="338" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">16</text>
<text x="282.6" y="338" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">24</text>
<text x="360" y="338" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">32</text>
<text x="410" y="338" font-size="11" font-family="inherit" fill="var(--sv-muted)">1</text>
<text x="477.7" y="338" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">8</text>
<text x="555.2" y="338" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">16</text>
<text x="632.6" y="338" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">24</text>
<text x="710" y="338" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">32</text>
<text x="210" y="356" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">batch / 并发序列数</text>
<text x="560" y="356" font-size="11" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">batch / 并发序列数</text>
<text x="24" y="374" font-size="10.5" font-family="inherit" fill="var(--sv-muted)">口径：A100 80GB、2.039 TB/s、7B fp16 权重 14 GB、单序列 KV 2.147 GB；TPOT =（14 + 2.147B）/2039 秒，实测通常更高。</text>
</svg><figcaption>图 4 · 左：吞吐随 batch 上升并逐渐饱和；右：TPOT 近似线性恶化。按 30 ms 的 TPOT 目标，可用并发约 22，此后增加的 batch 只是把延迟推高。</figcaption></figure>
<p>图 4 用 7B、MHA、4K 上下文、A100 80GB 的口径估算了这条曲线：吞吐在 B≈16 之后明显变缓，而 TPOT 近似线性上升；若 SLO 要求 TPOT ≤ 30 ms，可用的 batch 大约在 22 附近。真实系统还要加上 kernel 启动、采样、调度与显存碎片，实测 TPOT 通常高于此估算，所以这张图只用于理解趋势，不能当作性能承诺。</p>
<div class="callout callout--tip"><span class="callout__label">技巧</span><div>线上排障先分指标：TTFT 高而 TPOT 正常，问题多在排队或 prefill（长 prompt、前缀缓存未命中）；TPOT 高而 TTFT 正常，问题多在 decode 带宽（batch 过大、KV 太长、量化没开）。混在一起看平均值，几乎定位不到原因。</div></div>
</section>

<section class="sec">
<h2>显存约束下的并发估算与流式返回</h2>
<p>先做一道容量题。A100 80GB 上部署 7B fp16：权重占 14 GB，CUDA context、激活与 workspace 保守留 2-4 GB，可用于 KV 的约 60-64 GB。MHA、4K 上下文时每序列 2 GiB，最多约 30 并发；换成 GQA-8 后每序列 512 MiB，同样显存可容纳约 120 并发。这解释了为什么同样参数量的模型，架构选择能带来数倍的服务容量差异。注意这里只算了显存，实际还要验证带宽：30 并发时每步要搬 14 GB 权重加约 60 GiB（约 64 GB）KV，合计约 78 GB，按 2.039 TB/s 至少约 38 ms，TPOT 不会低于这个数。</p>
<p>第二步是流式返回（streaming）。默认的 HTTP 响应要等整段生成完才发回，用户看到的是一次长等待；改成 SSE（server-sent events）或 chunked transfer 后，每产生一个 token 就推给客户端，首字出现时间从"TTFT 加全部生成时间"缩短为 TTFT。流式不改变 TPOT，也不减少总计算量，但把等待从"一次长阻塞"变成"持续有反馈"，对交互式产品的感知延迟影响很大。实现上要关闭中间层缓冲（反向代理、gzip），否则 token 会被攒成一批才发出。</p>
<p>第三步是利用前缀复用。系统提示词、few-shot 示例、多轮对话的历史前缀在大量请求间重复，若服务支持自动前缀缓存（automatic prefix caching），命中的部分可以直接跳过 prefill，TTFT 大幅下降。vLLM 与 TensorRT-LLM 都提供该能力，但缓存按块匹配：一旦某个位置的 token 不同，该块及其后的前缀不再命中，之前的公共前缀仍可复用。</p>
<pre class="code" data-lang="bash"><code># 启动一个带指标与自动前缀缓存的 vLLM 服务（不同版本参数名可能变化）
vllm serve $MODEL_PATH \
  --max-model-len 8192 \
  --max-num-seqs 64 \
  --gpu-memory-utilization 0.90 \
  --enable-prefix-caching \
  --port 8000

# 流式调用：观察首 token 时间与后续 token 间隔
curl -N http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"'$MODEL_NAME'","stream":true,"messages":[{"role":"user","content":"用三句话解释 KV Cache"}]}'

# 服务端指标：TTFT 与 TPOT 的直方图在 /metrics 中
curl -s http://localhost:8000/metrics | grep -E "time_to_first_token|time_per_output_token"</code></pre>
<p>压测时至少记录三组数：TTFT 的 p50/p99、TPOT 的 p50/p99，以及满足 SLO 时的最大吞吐（goodput）。只报平均吞吐会掩盖长尾，而长尾往往由排队、长 prompt 和 KV 抢占（preemption）造成。</p>
</section>

<section class="sec">
<h2>常见误区、排障顺序与自测</h2>
<h3>误区</h3>
<ul>
<li><b>"decode 慢就加算力"</b>：decode 是带宽瓶颈，换更高算力的卡若带宽没涨，收益很小；同代卡里先看 HBM 带宽与容量。</li>
<li><b>"batch 越大吞吐越高，所以越大越好"</b>：吞吐会饱和，TPOT 近似线性变差；超过 SLO 后增加的是排队而不是有效产出。</li>
<li><b>"TTFT 只取决于模型大小"</b>：prompt 长度、排队深度、前缀缓存命中率都能让 TTFT 差一个数量级。</li>
<li><b>"流式能加快生成"</b>：流式只改善感知延迟，总生成时间不变。</li>
<li><b>"KV Cache 可以忽略"</b>：长上下文多并发时它是显存与带宽的主要消费者。</li>
</ul>
<p>建议的排障顺序：先用服务端指标把 TTFT 与 TPOT 分开；若 TTFT 异常，查 prompt 长度分布、排队时间与前缀缓存命中；若 TPOT 异常，查实际 batch、KV 长度、是否发生 KV 抢占、权重与 KV 的 dtype；最后再用 profiler 看 decode kernel 是否达到带宽上界。基准测试必须固定模型、上下文长度、batch、dtype 与 GPU 型号，否则数字不可比。</p>
<h3>自测</h3>
<details class="quiz"><summary>Q1 · 同一个 7B 模型，为什么 prefill 能吃满 Tensor Core，decode 却不能？</summary><div class="quiz__a">prefill 一次处理 T 个 token，权重读一次可摊到 T 个 token 上，算术强度约为 T（fp16）；T=2048 时约 2048 FLOP/byte，远高于 H100 的脊点约 295 FLOP/byte，属于算力受限。decode 每步只有 B 个新 token，算术强度约等于 batch size，B=32 时也才 32 FLOP/byte，仍在线性斜边上，瓶颈是 HBM 带宽。两者优化的方向因此不同：prefill 提升 MFU，decode 提升每字节能服务的 token 数（更大 batch、更少 KV、更低精度）。</div></details>
<details class="quiz"><summary>Q2 · 7B、32 层、32 头、head dim 128、fp16，单序列 4096 token 的 KV 是 2 GiB。若换成 8 组 KV 头的 GQA 并改用 fp8，变成多少？</summary><div class="quiz__a">先按 H_kv 从 32 降到 8，KV 变为 1/4，即 512 MiB；再把每个元素从 2 字节降到 1 字节，变为 256 MiB。公式为 2 × 32 × 8 × 128 × 4096 × 1 B = 268435456 B = 256 MiB。注意 KV 量化可能带来精度损失，需要用自己的任务评测，不能只看显存数字。</div></details>
<details class="quiz"><summary>Q3 · 一个服务 TTFT 的 p99 很高、TPOT 的 p99 正常，应该先查什么？</summary><div class="quiz__a">TTFT 覆盖排队、prefill 与首 token 采样，TPOT 正常说明 decode 阶段与带宽没有明显问题。优先查：请求排队深度（并发超过容量，先到先排）、prompt 长度分布（长 prompt 的 p99 拉高均值）、前缀缓存命中率（系统提示词改动会让缓存整体失效）、以及是否开启 chunked prefill 导致长 prompt 被切块、首 token 反而延后。不要先去怀疑 GPU 算力。</div></details>
<details class="quiz"><summary>Q4 · 把 batch 从 8 提到 32，吞吐从约 520 提到约 790 token/s，但 TPOT 从约 15 ms 涨到约 41 ms。这个交换合理吗？</summary><div class="quiz__a">取决于 SLO。若产品要求 TPOT ≤ 30 ms（约 33 token/s 的单流速度），41 ms 已经违约，实际有效吞吐（goodput）反而下降，用户会感到明显卡顿；若这是离线批处理、不关心单请求延迟，则吞吐提升约 50% 是划算的。正确做法是按 SLO 找 batch 拐点，并用连续批处理把不同阶段的请求混跑，而不是盲目堆 batch。</div></details>
<h3>延伸阅读</h3>
<ul class="refs">
<li><b>Efficiently Scaling Transformer Inference</b> — Reiner Pope 等, 2022（arXiv:2211.05102，MLSys 2023）。系统分析推理的延迟-吞吐权衡、内存带宽约束与模型并行切分，是理解 decode 为何带宽受限的经典材料。</li>
<li><b>Efficient Memory Management for Large Language Model Serving with PagedAttention</b> — Woosuk Kwon 等, SOSP 2023。vLLM 的论文，讲清 KV Cache 的碎片、共享与前缀复用，以及分页带来的吞吐提升。</li>
<li><b>GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints</b> — Joshua Ainslie 等, 2023（arXiv:2305.13245，EMNLP 2023）。GQA 的原始论文，给出 uptraining 方法与 MHA/GQA/MQA 的质量-成本对比。</li>
<li><b>Fast Transformer Decoding: One Write-Head is All You Need</b> — Noam Shazeer, 2019（arXiv:1911.02150）。MQA 的提出者，用很短的篇幅说明 decode 的带宽瓶颈与共享 KV 头的动机。</li>
<li><b>Orca: A Distributed Serving System for Transformer-Based Generative Models</b> — Gyeong-In Yu 等, OSDI 2022。提出 iteration-level scheduling 与 selective batching，是连续批处理思想的源头之一。</li>
<li><b>TensorRT-LLM 官方文档</b> — NVIDIA, 持续更新（https://nvidia.github.io/TensorRT-LLM/）。in-flight batching、KV Cache 量化与 paged KV 的工程细节，排障时以对应版本文档为准。</li>
</ul>
</section>
`
};
