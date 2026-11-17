window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["three-bottlenecks"] = {
  slug: "three-bottlenecks",
  title: "算力、显存、带宽：三个永恒瓶颈",
  subtitle: "用 Roofline 模型建立性能直觉",
  level: 0,
  cluster: "全景",
  tags: ["Roofline", "算术强度", "性能模型"],
  summary: "从算力、显存带宽、显存容量三堵墙出发，用算术强度与 Roofline 模型解释 prefill 与 decode 的性能差异，给出容量、延迟与吞吐的估算方法。",
  keyPoints: [
    "算力墙、带宽墙、容量墙分别对应 FLOPS、bytes/s、bytes 三种资源，性能问题几乎都能归入其中之一",
    "算术强度 AI = FLOPs / Bytes，Roofline 用 min(峰值算力, AI × 带宽) 给出性能上界",
    "prefill 的 AI 约等于一次处理的 token 数，通常 compute-bound；decode 的 AI 约 1 FLOP/Byte，稳定落在 memory-bound",
    "KV Cache 同时消耗容量与带宽，且随 batch 线性增长，使 decode 的 AI 上限停在 2P/KV 附近，很难变成 compute-bound",
    "延迟与吞吐是两个独立目标，Amdahl 定律与并行效率决定了加机器能换来多少实际加速"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>先记住三个数字，而不是一千个</h2>
<p>一个语言模型每生成一个 token，只做两件事：把权重和激活拿来做矩阵乘，这是<mark>算</mark>；把权重、KV Cache 从显存搬到计算单元，这是<mark>搬</mark>。算的速度由峰值算力（FLOPS）决定，搬的速度由显存带宽（bytes/s）决定，而模型与中间状态能不能放下，由显存容量（bytes）决定。这三个量就是三个永恒瓶颈。</p>
<p>性能问题看起来五花八门：首 token 慢、吞吐上不去、batch 一大就 OOM、上下文变长后越跑越慢。拆开看，几乎都能归到这三者之一。decode 阶段 GPU 的计算单元大面积空闲，不是算力不够，而是在等显存把十几 GB 权重搬过来；70B 模型单卡装不下，不是算不动，而是撞上了容量墙。</p>
<p>这一篇不教你写 kernel，而是给你一把尺子：面对任何模型、任何硬件、任何并行方案，先估算它落在哪堵墙前，再决定往哪个方向优化。后续的单机优化、训练、推理各篇，都会反复用到这把尺子。GPU 内部的 SM、Tensor Core、Warp 调度等微架构细节，留给 gpu-architecture 一篇展开。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>如果只记一句话：算力决定你能多快算完，带宽决定你多久能喂饱算力，容量决定你能不能开始算。Roofline 模型就是把前两者画在同一张图上，让你一眼看出瓶颈在哪一侧。</div></div>
</section>

<section class="sec">
<h2>三堵墙：算力、带宽、容量</h2>
<p>把一台加速器想象成一个工厂：计算单元是车间，显存是仓库，显存带宽是连接两者的传送带。车间再大，传送带送不来原料也只能干等；原料再多，仓库放不下就开不了工。三种资源分别对应三堵墙。</p>
<h3>算力墙：车间打满，仍然不够快</h3>
<p>当工作负载的算术强度足够高时，限制性能的就是峰值 FLOPS。典型场景是大 batch 的 prefill 和大规模训练：矩阵乘的每个元素被复用很多次，数据搬运被摊薄，此时 Tensor Core 的利用率接近饱和，加显存带宽也没用，只能换更强算力、更低精度或更高效的算子。以 A100 80GB SXM 为例，厂商标称 BF16 dense 算力 312 TFLOP/s，这是这一侧的硬上限。</p>
<h3>带宽墙：算力在等数据</h3>
<p>当每个字节只被用一两次时，限制性能的是显存带宽。自回归 decode 是最典型的例子：每生成一个 token 都要把全部权重读一遍，而每个权重只参与一次乘加。A100 的 HBM2e 带宽约 2.039 TB/s，读完 7B 模型 bf16 的 14 GB 权重至少需要约 6.9 ms；算上上下文 2048 时的 KV Cache，单请求每 token 约 7.4 ms，也就是约 135 token/s 的上限。此时 SM 利用率很低，看起来像“算力没跑满”，本质是传送带不够宽。</p>
<h3>容量墙：先装得下，才谈得上快</h3>
<p>容量墙不体现为慢，而体现为 OOM（out of memory）。一个 70B 模型用 bf16 存储需要约 140 GB 权重，单张 80 GB 的 A100 或 H100 直接装不下；即便装得下权重，KV Cache 还会继续吃显存。Llama-2 7B 在 batch=32、上下文 4096 时，KV Cache 约 64 GiB，加上 13 GiB 权重合计约 77 GiB；80 GB 卡只剩约 3 GiB 余量，算上激活值与显存碎片，实际会 OOM。容量墙的解法是分片、offload、量化或更紧凑的 KV 表示，而不是“再优化一下 kernel”。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>墙</th><th>受限资源</th><th>典型症状</th><th>主要缓解手段</th></tr></thead>
<tbody>
<tr><td>算力墙</td><td>峰值 FLOPS</td><td>计算单元打满、加带宽不提速、大矩阵乘效率高</td><td>更强算力、低精度、算子融合、稀疏化</td></tr>
<tr><td>带宽墙</td><td>显存带宽 bytes/s</td><td>计算单元空闲、显存带宽接近峰值、decode 慢</td><td>量化、批处理、GQA/MLA、KV 量化、减少重复读</td></tr>
<tr><td>容量墙</td><td>显存容量 bytes</td><td>OOM、装不下权重或 KV、只能减小 batch</td><td>张量并行、offload、量化、PagedAttention</td></tr>
</tbody>
</table></div>
<p>更麻烦的是，三堵墙的“涨速”不一样。Gholami 等人在《AI and Memory Wall》中统计，过去二十年硬件 FLOPS 大约每两年增长 3 倍，而显存带宽约每两年增长 1.6 倍、容量约每两年增长 1.5 到 2 倍（不同统计口径略有差异）。算力跑得比带宽快，意味着同样的算法会一年比一年更偏向带宽受限。“memory wall”（内存墙）这个说法最早由 Wulf 与 McKee 在 1995 年提出，近年来因为 AI 负载再次成为焦点。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>容量墙经常伪装成带宽墙。显存快满时，驱动会回收缓存、降低命中率，表现为带宽利用率异常和延迟抖动；先看显存占用，再谈带宽优化，顺序不能反。</div></div>
</section>

<section class="sec">
<h2>算术强度与 Roofline：把程序放到图上</h2>
<h3>算术强度：每搬一字节能干多少活</h3>
<p><mark>算术强度</mark>（arithmetic intensity，AI）定义为一个程序完成的工作量与其搬运字节数之比：AI = FLOPs / Bytes，单位是 FLOP/Byte。它描述的是算法与调度方式，而不是硬件。一个 N×N 的方阵乘法大约需要 2N³ 次浮点运算、读写约 3N² 个元素；fp16 下字节数约 6N²，于是 AI ≈ N/3。N=4096 时 AI 约 1365 FLOP/Byte，属于典型的高强度计算；而逐元素相加只做 1 次运算，却要读 2 个元素、写 1 个元素（共 3 个元素），AI 远小于 1。</p>
<p>要注意，AI 的计算口径取决于你把哪一层存储算作“搬运”。如果数据在 SRAM 中被复用，真正的 DRAM 流量会低于按朴素访存次数估算的值，有效 AI 也就更高。Roofline 论文使用的是相对 DRAM 的 operational intensity，本文沿用这一口径，这也是它适合做上界估算的原因。</p>
<h3>Roofline：一条斜线加一条平台</h3>
<p>把 AI 作横轴、可达性能作纵轴，硬件的能力就是两条线：带宽决定一条满足“性能 = AI × 带宽”的斜线（双对数坐标下斜率为 1），算力决定一条水平平台。程序的实际性能不会超过两者的较小值，这就是 Roofline 模型的核心。</p>
<div class="formula">算术强度　AI = FLOPs / Bytes　（FLOP/Byte）
可达性能 ≤ min(峰值算力 FLOPS, AI × 峰值带宽 Bytes/s)
脊点　AI* = 峰值算力 / 峰值带宽</div>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="Roofline 曲线，标出 prefill 与 decode 的落点" font-family="inherit">
<defs>
<marker id="three-bottlenecks-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-muted)"></path>
</marker>
</defs>
<rect x="90" y="40" width="630" height="280" fill="var(--sv-panel)"></rect>
<line x1="90" y1="40" x2="90" y2="320" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="90" y1="320" x2="720" y2="320" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="90" y1="110" x2="720" y2="110" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="90" y1="180" x2="720" y2="180" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="90" y1="250" x2="720" y2="250" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="135" y1="40" x2="135" y2="320" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="284" y1="40" x2="284" y2="320" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="434" y1="40" x2="434" y2="320" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="583" y1="40" x2="583" y2="320" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="90" y1="320" x2="720" y2="320" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#three-bottlenecks-arrow)"></line>
<line x1="90" y1="320" x2="90" y2="40" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#three-bottlenecks-arrow)"></line>
<line x1="90" y1="250" x2="462" y2="76" stroke="var(--sv-a)" stroke-width="3"></line>
<line x1="462" y1="76" x2="720" y2="76" stroke="var(--sv-a)" stroke-width="3"></line>
<line x1="462" y1="76" x2="462" y2="320" stroke="var(--sv-muted)" stroke-width="1" stroke-dasharray="5 5"></line>
<text x="82" y="44" font-size="12" text-anchor="end" fill="var(--sv-muted)">1000</text>
<text x="82" y="114" font-size="12" text-anchor="end" fill="var(--sv-muted)">100</text>
<text x="82" y="184" font-size="12" text-anchor="end" fill="var(--sv-muted)">10</text>
<text x="82" y="254" font-size="12" text-anchor="end" fill="var(--sv-muted)">1</text>
<text x="82" y="324" font-size="12" text-anchor="end" fill="var(--sv-muted)">0.1</text>
<text x="135" y="338" font-size="12" text-anchor="middle" fill="var(--sv-muted)">1</text>
<text x="284" y="338" font-size="12" text-anchor="middle" fill="var(--sv-muted)">10</text>
<text x="434" y="338" font-size="12" text-anchor="middle" fill="var(--sv-muted)">100</text>
<text x="583" y="338" font-size="12" text-anchor="middle" fill="var(--sv-muted)">1000</text>
<text x="405" y="362" font-size="13" text-anchor="middle" fill="var(--sv-ink)">算术强度 AI（FLOP/Byte，对数轴）</text>
<text x="30" y="180" font-size="13" text-anchor="middle" fill="var(--sv-ink)" transform="rotate(-90 30 180)">可达性能（TFLOP/s，对数轴）</text>
<text x="600" y="30" font-size="13" text-anchor="middle" fill="var(--sv-ink)">峰值平台 312 TFLOP/s（A100 BF16）</text>
<text x="455" y="60" font-size="12" text-anchor="end" fill="var(--sv-muted)">脊点 AI* = 153</text>
<text x="215" y="235" font-size="12" text-anchor="start" fill="var(--sv-a)">带宽 = 2.04 TB/s</text>
<text x="150" y="300" font-size="13" text-anchor="start" fill="var(--sv-muted)">带宽受限区</text>
<text x="600" y="130" font-size="13" text-anchor="middle" fill="var(--sv-muted)">算力受限区</text>
<circle cx="135" cy="229" r="6" fill="var(--sv-b)" stroke="var(--sv-bg)" stroke-width="1.5"></circle>
<text x="152" y="258" font-size="13" text-anchor="start" fill="var(--sv-ink)">decode：AI ≈ 1，约 2 TFLOP/s</text>
<circle cx="630" cy="76" r="6" fill="var(--sv-c)" stroke="var(--sv-bg)" stroke-width="1.5"></circle>
<text x="630" y="98" font-size="13" text-anchor="middle" fill="var(--sv-ink)">prefill：AI ≈ 2048</text>
</svg>
<figcaption>图 1 · A100 80GB SXM 的 Roofline 示意（BF16 dense 312 TFLOP/s、HBM2e 2.039 TB/s）。prefill 落在平台区，decode 落在斜线区，两者的优化方向完全相反。Roofline 给出的是上界，真实 kernel 通常低于该线。</figcaption>
</figure>
<h3>脊点：两条线的交点</h3>
<p>两条线的交点称为<mark>脊点</mark>（ridge point），对应的 AI* = 峰值算力 / 峰值带宽。A100 80GB 的 AI* 约为 153 FLOP/Byte：低于它的程序受带宽约束，高于它的程序受算力约束。这个数字随硬件变化很大，是选型时最该先算的一个量。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>加速器</th><th>峰值算力（BF16/FP16 dense）</th><th>显存带宽</th><th>脊点 AI*</th></tr></thead>
<tbody>
<tr><td>NVIDIA A100 80GB SXM</td><td>312 TFLOP/s</td><td>2.039 TB/s</td><td>约 153</td></tr>
<tr><td>NVIDIA H100 SXM</td><td>989 TFLOP/s</td><td>3.35 TB/s</td><td>约 295</td></tr>
<tr><td>NVIDIA RTX 4090</td><td>165 TFLOP/s</td><td>1.008 TB/s</td><td>约 164</td></tr>
<tr><td>AMD MI300X</td><td>1307 TFLOP/s</td><td>5.3 TB/s</td><td>约 247</td></tr>
</tbody>
</table></div>
<p>表里的算力是厂商标称的 dense 数值，实际算子通常只能达到标称算力的六到八成，而 HBM 带宽往往能跑到峰值的八九成，因此有效脊点通常会低于表值。即便如此，数量级关系是稳定的：这几代 GPU 的脊点都在一百到三百之间，而 decode 的 AI 只有 1 左右，两者相差两个数量级。这个巨大落差，就是“推理优化几乎都在省带宽”的根本原因。</p>
</section>

<section class="sec">
<h2>Transformer 的 prefill 与 decode：两种完全不同的负载</h2>
<p>大模型推理分两个阶段。<mark>prefill</mark> 把整段 prompt 一次性送进模型，所有 token 并行计算，产出第一个 token 并建立 KV Cache；<mark>decode</mark> 则每次只生成一个 token，自回归地往后续写。两者的算术强度可以差三个数量级，必须分开建模。</p>
<h3>prefill：一次算很多 token</h3>
<p>设模型参数量为 P，一次处理 N 个 token。线性层的前向 FLOPs 约为 2PN（每个参数对每个 token 做一次乘加），需要读取的权重是 2P 字节（fp16/bf16）。忽略较小的激活与 KV 写入，算术强度近似为：</p>
<div class="formula">AI_prefill ≈ 2PN / 2P = N　（FLOP/Byte）</div>
<p>N=2048 时 AI 约为 2048，远高于 A100 的脊点 153，所以 prefill 是典型的 compute-bound。它决定首 token 延迟（time to first token，TTFT），优化手段是更好的 GEMM、FlashAttention、算子融合和更大的并行度。注意长序列下注意力的 O(N²) 项会抬高实际 FLOPs，AI 还会更高，但这不改变它落在平台区的事实。</p>
<h3>decode：一次只算一个 token</h3>
<p>decode 每步只处理 1 个新 token（batch 内每个请求各一个）。FLOPs 约为 2P，而字节数至少是 2P 的权重加上 KV Cache。于是：</p>
<div class="formula">每 token FLOPs ≈ 2 × P
每 token 字节 ≈ 2 × P + KV_bytes(S)
AI_decode ≈ 2P / (2P + KV) ≤ 1
带 batch B 时：AI = 2PB / (2P + B·KV)</div>
<p>这就是常说的“decode 约等于每参数 2 FLOPs、每参数 2 字节”的来源：分子是每参数 2 FLOPs，分母是每参数 2 字节，比值约 1 FLOP/Byte。以 Llama-2 7B、bf16、上下文 2048、batch=1 为例，权重 13.0 GiB，KV Cache 约 1.0 GiB，总访问量约 14.0 GiB，AI 约 0.93。对比脊点 153，低了两个数量级，因此 decode 稳定落在带宽受限区。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="单个 decode token 的字节访问拆解，对比不同上下文与 batch" font-family="inherit">
<rect x="110" y="75" width="600" height="225" fill="var(--sv-panel)"></rect>
<line x1="110" y1="75" x2="110" y2="300" stroke="var(--sv-ink)" stroke-width="1.5"></line>
<line x1="110" y1="300" x2="720" y2="300" stroke="var(--sv-ink)" stroke-width="1.5"></line>
<line x1="230" y1="75" x2="230" y2="300" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="350" y1="75" x2="350" y2="300" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="470" y1="75" x2="470" y2="300" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="590" y1="75" x2="590" y2="300" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="710" y1="75" x2="710" y2="300" stroke="var(--sv-line)" stroke-width="1"></line>
<rect x="110" y="55" width="14" height="14" fill="var(--sv-a)"></rect>
<text x="132" y="66" font-size="12" fill="var(--sv-ink)">权重（bf16）</text>
<rect x="300" y="55" width="14" height="14" fill="var(--sv-b)"></rect>
<text x="322" y="66" font-size="12" fill="var(--sv-ink)">KV Cache 读取</text>
<rect x="520" y="55" width="14" height="14" fill="var(--sv-c)"></rect>
<text x="542" y="66" font-size="12" fill="var(--sv-ink)">激活等其他</text>
<text x="20" y="108" font-size="13" fill="var(--sv-ink)">B=1，S=2K</text>
<text x="20" y="126" font-size="12" fill="var(--sv-muted)">AI ≈ 0.93</text>
<text x="20" y="188" font-size="13" fill="var(--sv-ink)">B=1，S=8K</text>
<text x="20" y="206" font-size="12" fill="var(--sv-muted)">AI ≈ 0.77</text>
<text x="20" y="268" font-size="13" fill="var(--sv-ink)">B=32，S=2K</text>
<text x="20" y="286" font-size="12" fill="var(--sv-muted)">AI ≈ 9.3</text>
<rect x="110" y="90" width="156" height="40" fill="var(--sv-a)"></rect>
<rect x="266" y="90" width="12" height="40" fill="var(--sv-b)"></rect>
<rect x="278" y="90" width="1" height="40" fill="var(--sv-c)"></rect>
<text x="286" y="116" font-size="12" fill="var(--sv-ink)">14.0 GiB</text>
<rect x="110" y="170" width="156" height="40" fill="var(--sv-a)"></rect>
<rect x="266" y="170" width="48" height="40" fill="var(--sv-b)"></rect>
<text x="322" y="196" font-size="12" fill="var(--sv-ink)">17.0 GiB</text>
<rect x="110" y="250" width="156" height="40" fill="var(--sv-a)"></rect>
<rect x="266" y="250" width="384" height="40" fill="var(--sv-b)"></rect>
<text x="380" y="276" font-size="12" fill="var(--sv-bg)">KV 32 GiB（71%）</text>
<text x="658" y="276" font-size="12" fill="var(--sv-ink)">45.0 GiB</text>
<text x="110" y="316" font-size="12" text-anchor="middle" fill="var(--sv-muted)">0</text>
<text x="230" y="316" font-size="12" text-anchor="middle" fill="var(--sv-muted)">10</text>
<text x="350" y="316" font-size="12" text-anchor="middle" fill="var(--sv-muted)">20</text>
<text x="470" y="316" font-size="12" text-anchor="middle" fill="var(--sv-muted)">30</text>
<text x="590" y="316" font-size="12" text-anchor="middle" fill="var(--sv-muted)">40</text>
<text x="710" y="316" font-size="12" text-anchor="middle" fill="var(--sv-muted)">50</text>
<text x="405" y="338" font-size="13" text-anchor="middle" fill="var(--sv-ink)">每步访问字节（GiB，Llama-2 7B bf16）</text>
<text x="20" y="364" font-size="12" fill="var(--sv-muted)">decode 的 AI 随 batch 增大趋于 2P/KV ≈ 13，仍低于 A100 脊点 153，因此始终带宽受限。</text>
</svg>
<figcaption>图 2 · 单个 decode token 的字节拆解。权重是固定成本，KV Cache 随上下文和 batch 线性增长；长上下文大 batch 时，KV 读取反超权重，成为带宽与容量的双重瓶颈。</figcaption>
</figure>
<h3>KV Cache 如何让 decode 更 memory-bound</h3>
<p>KV Cache 的大小可以精确估算：</p>
<div class="formula">KV_bytes = 2 × L × H_kv × D × S × B × bytes_per_elem</div>
<p>其中 2 代表 K 和 V 两份，L 是层数，H_kv 是 KV 头数，D 是每头维度，S 是上下文长度，B 是并发序列数。Llama-2 7B 有 32 层、32 个 MHA 头、每头 128 维，bf16 下每个 token 的 KV 约为 512 KiB；上下文 2048 时单个序列就要 1 GiB，4096 时 2 GiB。batch=32、上下文 4096 的场景需要约 64 GiB KV，合计约 77 GiB，距离 80 GB 上限只剩约 3 GiB，算上激活值与碎片实际会 OOM。</p>
<p>更关键的是它对算术强度的影响。把 B 代入上面的公式可以看到，AI 并不会随 batch 无限增大：</p>
<div class="formula">AI(B) = 2PB / (2P + B·KV)　→　2P / KV　（B 很大时）</div>
<p>对 Llama-2 7B、S=2048，这个极限约为 14 GB / 1.07 GB ≈ 13，依然远低于脊点 153。也就是说，<mark>decode 加 batch 只是在“摊薄权重”，并没有改变 KV 随 batch 线性增长的事实</mark>，它很难靠 batching 变成 compute-bound。只有在上下文很短（例如 S=128，KV 仅约 64 MiB，极限 AI 超过 200）或 KV 被量化、压缩、共享（GQA/MLA）时，才有可能跨过脊点。</p>
<div class="callout callout--formula"><span class="callout__label">公式</span><div>decode 的带宽下界时间 ≈ (2P + B·KV) / 带宽；吞吐上界 ≈ 带宽 / (2P/B + KV)。当 KV 远大于权重时，吞吐几乎只由“每序列 KV 字节”决定，跟模型算力无关。</div></div>
</section>

<section class="sec">
<h2>内存层级：带宽与延迟是两条轴</h2>
<p>只比较 HBM 带宽还不够，真实系统是一整套层级：寄存器、SM 内共享内存（SRAM）、L2、HBM、跨卡互联、主机内存、SSD、网络。越靠近计算单元，带宽越高、延迟越低，但容量越小、单位成本越高。性能优化的本质，就是让数据尽量在高层级被复用。各层的容量、合并访问与 bank conflict 细节见 memory-hierarchy，本节只取与 Roofline 有关的两条轴：带宽与延迟。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="内存层级的带宽与延迟双轴条形图" font-family="inherit">
<text x="295" y="48" font-size="13" text-anchor="middle" fill="var(--sv-ink)">带宽（GB/s，对数）</text>
<text x="595" y="48" font-size="13" text-anchor="middle" fill="var(--sv-ink)">延迟（µs，对数）</text>
<text x="20" y="91" font-size="13" fill="var(--sv-ink)">SMEM / L1</text>
<rect x="160" y="74" width="252" height="24" fill="var(--sv-a)"></rect>
<text x="418" y="91" font-size="12" fill="var(--sv-muted)">20000</text>
<rect x="470" y="74" width="15" height="24" fill="var(--sv-b)"></rect>
<text x="491" y="91" font-size="12" fill="var(--sv-muted)">0.02</text>
<text x="20" y="131" font-size="13" fill="var(--sv-ink)">L2</text>
<rect x="160" y="114" width="235" height="24" fill="var(--sv-a)"></rect>
<text x="401" y="131" font-size="12" fill="var(--sv-muted)">10000</text>
<rect x="470" y="114" width="65" height="24" fill="var(--sv-b)"></rect>
<text x="541" y="131" font-size="12" fill="var(--sv-muted)">0.2</text>
<text x="20" y="171" font-size="13" fill="var(--sv-ink)">HBM3</text>
<rect x="160" y="154" width="207" height="24" fill="var(--sv-a)"></rect>
<text x="373" y="171" font-size="12" fill="var(--sv-muted)">3350</text>
<rect x="470" y="154" width="85" height="24" fill="var(--sv-b)"></rect>
<text x="561" y="171" font-size="12" fill="var(--sv-muted)">0.5</text>
<text x="20" y="211" font-size="13" fill="var(--sv-ink)">NVLink 4（每向）</text>
<rect x="160" y="194" width="156" height="24" fill="var(--sv-a)"></rect>
<text x="322" y="211" font-size="12" fill="var(--sv-muted)">450</text>
<rect x="470" y="194" width="115" height="24" fill="var(--sv-b)"></rect>
<text x="591" y="211" font-size="12" fill="var(--sv-muted)">2</text>
<text x="20" y="251" font-size="13" fill="var(--sv-ink)">PCIe 5.0 x16</text>
<rect x="160" y="234" width="106" height="24" fill="var(--sv-a)"></rect>
<text x="272" y="251" font-size="12" fill="var(--sv-muted)">64</text>
<rect x="470" y="234" width="109" height="24" fill="var(--sv-b)"></rect>
<text x="585" y="251" font-size="12" fill="var(--sv-muted)">1.5</text>
<text x="20" y="291" font-size="13" fill="var(--sv-ink)">IB 400G</text>
<rect x="160" y="274" width="100" height="24" fill="var(--sv-a)"></rect>
<text x="266" y="291" font-size="12" fill="var(--sv-muted)">50</text>
<rect x="470" y="274" width="159" height="24" fill="var(--sv-b)"></rect>
<text x="635" y="291" font-size="12" fill="var(--sv-muted)">15</text>
<text x="20" y="331" font-size="13" fill="var(--sv-ink)">NVMe SSD</text>
<rect x="160" y="314" width="50" height="24" fill="var(--sv-a)"></rect>
<text x="216" y="331" font-size="12" fill="var(--sv-muted)">7</text>
<rect x="470" y="314" width="200" height="24" fill="var(--sv-b)"></rect>
<text x="676" y="331" font-size="12" fill="var(--sv-muted)">100</text>
<text x="160" y="356" font-size="12" text-anchor="middle" fill="var(--sv-muted)">1</text>
<text x="219" y="356" font-size="12" text-anchor="middle" fill="var(--sv-muted)">10</text>
<text x="277" y="356" font-size="12" text-anchor="middle" fill="var(--sv-muted)">100</text>
<text x="336" y="356" font-size="12" text-anchor="middle" fill="var(--sv-muted)">1K</text>
<text x="395" y="356" font-size="12" text-anchor="middle" fill="var(--sv-muted)">10K</text>
<text x="470" y="356" font-size="12" text-anchor="middle" fill="var(--sv-muted)">0.01</text>
<text x="520" y="356" font-size="12" text-anchor="middle" fill="var(--sv-muted)">0.1</text>
<text x="570" y="356" font-size="12" text-anchor="middle" fill="var(--sv-muted)">1</text>
<text x="620" y="356" font-size="12" text-anchor="middle" fill="var(--sv-muted)">10</text>
<text x="670" y="356" font-size="12" text-anchor="middle" fill="var(--sv-muted)">100</text>
<text x="716" y="356" font-size="12" text-anchor="end" fill="var(--sv-muted)">1000</text>
</svg>
<figcaption>图 3 · 内存层级的带宽与延迟双轴对比（以 H100 级系统为例的量级，具体数值视实现与配置而定；带宽统一取每向，NVLink 4 厂商标称双向 900 GB/s，图中取每向 450）。越往下一层，带宽大致按数倍递减、延迟按数倍递增；从片上 SRAM 到 NVMe，两者都相差三到四个数量级，其中 HBM 与 NVMe 之间约两到三个数量级。</figcaption>
</figure>
<h3>延迟需要“在途字节”来掩盖</h3>
<p>高带宽不等于低延迟。要持续跑满 3.35 TB/s，同时每次访问有约 500 ns 延迟，系统里必须有足够多的请求同时在飞：</p>
<div class="formula">在途字节 ≈ 带宽 × 延迟 = 3.35 TB/s × 500 ns ≈ 1.6 MiB</div>
<p>这解释了为什么单线程、小 batch 的 decode 很难吃满带宽：请求数不够，延迟暴露出来，SM 只能空转。工程上的 batch、预取、多级流水，本质上都是在增加在途请求数。这也是延迟与吞吐必须分开看的原因。</p>
<h3>搬运比计算贵得多</h3>
<p>Horowitz 在 ISSCC 2014 的经典演讲中给出了 45nm CMOS 下的能耗数量级，用来建立比例直觉（不代表今天 4nm 的绝对值）：</p>
<ul>
<li>32-bit 整数加：约 0.1 pJ</li>
<li>32-bit 浮点加：约 0.9 pJ</li>
<li>32-bit 浮点乘：约 3.7 pJ</li>
<li>32-bit SRAM 读（8 KB）：约 5 pJ</li>
<li>32-bit DRAM 读：约 640 pJ</li>
</ul>
<p>一次 DRAM 读取的能耗约是一次浮点乘的 173 倍，也约是 SRAM 读取的 128 倍。这组数字说明：在带宽受限的负载里，省字节往往比省 FLOPs 更有效。量化把 bf16 降到 int8，权重和 KV 的字节数直接减半，带宽压力和能耗同时下降；FlashAttention 通过分块减少 HBM 往返，也是同一个逻辑。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>判断一个优化值不值得做，先问它减少的是 FLOPs 还是 bytes。decode 阶段减少 20% 的 FLOPs 可能毫无感觉，减少 20% 的 HBM 流量却能直接换来接近 20% 的吞吐提升。</div></div>
</section>

<section class="sec">
<h2>延迟与吞吐：两个不能同时最大化的目标</h2>
<p><mark>延迟</mark>是单个请求从发出到完成的时间，推理里通常拆成 TTFT（首 token 延迟）和 TPOT（每输出 token 时间）。<mark>吞吐</mark>是系统单位时间处理的总 token 数或总请求数。二者相关但不等价：加大 batch 能提高吞吐，却会拉长每个请求的排队与执行时间。</p>
<div class="duo">
<div class="duo__col"><h4>延迟优先</h4><p>目标是最小化 p50/p99 的 TTFT 与 TPOT。手段是小 batch、连续批处理、前缀缓存、投机解码。代价是硬件利用率低，单位 token 成本高。适合交互式对话、代码补全。</p></div>
<div class="duo__col"><h4>吞吐优先</h4><p>目标是最大化总 token/s 或 goodput。手段是大 batch、增大并发、KV 分页与复用。代价是排队延迟上升，尾延迟变差。适合离线批量生成、数据合成。</p></div>
</div>
<p>两者之间的换算可以用 Little 定律近似：系统内的并发请求数约等于吞吐乘以平均延迟（L ≈ λW）。在显存允许的并发上限内，加大 batch 会同时抬高吞吐与延迟；一旦并发被 KV 容量卡住，想再提高吞吐就只能降低单请求延迟，例如减少 KV 读取、提高 kernel 效率。所以“推理服务的 batch 开多大”不是一个纯调参问题，而是产品目标问题。</p>
<h3>Amdahl 定律：加机器能换来多少</h3>
<p>并行化的收益有硬上限。若程序中可并行部分占比为 p，使用 N 个并行单元，加速比为：</p>
<div class="formula">S(N) = 1 / ((1 − p) + p / N)
并行效率 E(N) = S(N) / N = 1 / (N(1 − p) + p)</div>
<p>取 p=0.95、N=16，加速比约 9.1 倍，效率只剩 57%；N=64 时加速比约 15.4 倍，效率降到 24%。剩下 5% 的串行部分（数据加载、同步、通信、启动开销）会随着 N 增大占据主导。分布式训练里的 all-reduce 通信、推理里的调度与 KV 传输，都是那 5% 的现实版本。这也是为什么大集群的实际扩展效率通常远低于线性，具体 scaling 策略在分布式训练一篇展开。</p>
<div class="callout callout--story"><span class="callout__label">案例</span><div>某推理服务把 batch 从 1 加到 32，吞吐涨了约 8 倍，但 p99 延迟从 200 ms 涨到 900 ms。按 Roofline 看，batch=32 时 decode 的 AI 仍只有个位数，提升来自权重摊薄；而延迟上涨来自排队和 KV 读取变长。两者都符合模型，没有“异常”。</div></div>
</section>

<section class="sec">
<h2>工程实践：先估算，再优化，最后验证</h2>
<p>Roofline 最大的价值不是精确预测，而是用几分钟排除掉错误方向。下面这段 Python 用几十行把关键量算出来，换模型、换卡只需改参数。注意这里只算线性层，忽略注意力的 O(S²) 项和 kernel 效率，因此结果是乐观上界。</p>
<pre class="code" data-lang="python"><code>P = 7e9                      # 参数量，Llama-2 7B
BPP = 2                      # bf16：2 字节/参数
S = 2048                     # 上下文长度
L, H, D = 32, 32, 128        # 层数、KV 头数、每头维度
PEAK, BW = 312e12, 2.039e12  # A100 80GB SXM，BF16 dense

weights = P * BPP
kv_per_token = 2 * L * H * D * BPP      # K 和 V 各一份
kv = kv_per_token * S

prefill_ai = (2 * P * S) / weights
decode_ai = (2 * P) / (weights + kv)
ridge = PEAK / BW

print(f"ridge        = {ridge:.0f} FLOP/Byte")
print(f"prefill AI   = {prefill_ai:.0f}")
print(f"decode AI    = {decode_ai:.2f}")
print(f"decode 上限  = {BW / (weights + kv):.0f} token/s")</code></pre>
<p>在 A100 上运行会得到：脊点约 153，prefill AI 约 2048，decode AI 约 0.93，单请求 decode 上限约 135 token/s。最后这个数字是理论上界，实测通常明显更低，差距来自 kernel 效率、内存访问模式和框架开销，视实现而定。此时正确的预期是“decode 受带宽限制”，而不是“GPU 性能不行”。</p>
<h3>四步决策流程</h3>
<ol>
<li>算 AI：按上面的公式估算当前阶段的 FLOPs 与字节数，分清是 prefill 还是 decode。</li>
<li>比脊点：AI 明显高于脊点是 compute-bound，明显低于则是 memory-bound，接近时两者都要看。</li>
<li>算下界：用 max(FLOPs / 峰值算力, Bytes / 峰值带宽) 得到理论最短时间，再乘一个 1.3 到 2 的效率系数，作为现实预期。</li>
<li>选手段：compute-bound 优先换算力、低精度、融合算子；memory-bound 优先减字节、加 batch、量化 KV；先 OOM 则先解决容量。</li>
</ol>
<h3>排障清单与常见误区</h3>
<ul>
<li>看 SM 利用率与 DRAM 利用率：SM 低而 DRAM 高，基本可判定带宽墙；两者都低，多半是启动开销、同步或调度问题。</li>
<li>别把“FLOPS 高”当成“一定快”：AI 低时，峰值算力根本用不上，选卡要看脊点与显存容量，而不只看算力数字。</li>
<li>别把 decode 慢归因于算力：先算 AI，再看是不是 KV 读取或 batch 太小。</li>
<li>别盲目加大 batch：延迟会上升，KV 容量会先撞墙，而且 decode 的 AI 有上限，收益会饱和。</li>
<li>别忽略尾延迟：平均值好看不代表服务可用，p99 往往由排队和显存碎片决定。</li>
<li>别把 Roofline 当预测器：它给的是上界，cache 命中、算子融合、并行开销都会让实际值偏离。</li>
</ul>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>Roofline 的横轴口径是“相对 DRAM 的字节数”。如果你的 kernel 把数据复用在 SRAM 里，真正的 DRAM 流量会低于按朴素访存次数估算的值，有效 AI 会更高；反过来，如果访问模式很差、实际带宽跑不满，真实性能会低于斜线。用它做方向判断，不要用它做精确 SLA 承诺。</div></div>
</section>

<section class="sec">
<h2>自测与延伸阅读</h2>
<h3>自测</h3>
<details class="quiz"><summary>Q1 · Llama-2 7B、bf16、A100 80GB、batch=1、上下文 2048，decode 每 token 至少读多少字节？理论 token/s 上限是多少？</summary><div class="quiz__a">权重约 13.0 GiB，KV Cache 约 1.0 GiB，合计约 14.0 GiB（约 15.1 GB）。用 2.039 TB/s 除以 15.1 GB，得到约 135 token/s。这是忽略计算、调度和访存效率的上界，实测通常更低。关键结论是它由带宽而非算力决定。</div></details>
<details class="quiz"><summary>Q2 · 为什么把 decode 的 batch 从 1 加到 32，仍然很难变成 compute-bound？</summary><div class="quiz__a">因为 AI = 2PB / (2P + B·KV)。权重项 2P 是固定的，KV 项随 B 线性增长，B 很大时 AI 趋于 2P / KV。对 Llama-2 7B、S=2048，这个极限约 13，仍远低于 A100 的脊点 153。只有上下文很短、KV 很小，或用 GQA/MLA、KV 量化把 KV 压下去，极限 AI 才可能跨过脊点。</div></details>
<details class="quiz"><summary>Q3 · 一次 2048 token 的 prefill，算术强度大约是多少？应该往哪个方向优化？</summary><div class="quiz__a">AI 近似等于一次处理的 token 数，约 2048 FLOP/Byte（权重主导，忽略激活），远高于脊点 153，属于 compute-bound。优化方向是提高矩阵乘与注意力的计算效率，例如 FlashAttention、算子融合、低精度 Tensor Core，而不是一味减少显存读取。</div></details>
<h3>延伸阅读</h3>
<ul class="refs">
<li><b>Roofline: An Insightful Visual Performance Model for Multicore Architectures</b> — Williams, Waterman, Patterson, Communications of the ACM, 2009。提出算术强度、带宽斜线与脊点的原始论文，本文模型的出处。</li>
<li><b>Computing's Energy Problem (and What We Can Do About It)</b> — Mark Horowitz, ISSCC, 2014。给出 45nm 下运算与各级存储访问的能耗数量级，是“搬运比计算贵”的经典依据。</li>
<li><b>Efficiently Scaling Transformer Inference</b> — Pope et al., MLSys 2023（arXiv 2022）。系统分析 LLM 推理的 prefill/decode 差异、KV Cache 与批处理权衡，与本文第 4 节直接对应。</li>
<li><b>AI and Memory Wall</b> — Gholami et al., 2024（arXiv:2403.14123）。用长期数据说明算力增长快于显存带宽与容量，是 memory wall 视角的代表作。</li>
<li><b>NVIDIA H100 Tensor Core GPU Architecture</b> — NVIDIA, 2022 白皮书。H100 的峰值算力、HBM3 带宽与互联规格的官方口径，可用于复核本文的脊点计算。</li>
</ul>
</section>`
};
