window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["kernel-optimization"] = {
  slug: "kernel-optimization",
  title: "Kernel 优化：Tiling、融合与 Occupancy",
  subtitle: "把访存降下来，把利用率提上去",
  level: 2,
  cluster: "单机优化",
  tags: ["Tiling", "算子融合", "Bank Conflict", "Occupancy", "Roofline"],
  summary: "从 Roofline 定位瓶颈，讲清 tiling、寄存器分块与双缓冲如何降流量、藏延迟，再拆解 bank conflict、算子融合与 occupancy 的取舍。",
  keyPoints: [
    "先用算术强度和 Roofline 判断 memory-bound 还是 compute-bound，再决定优化方向",
    "shared memory tiling 把全局访存降为约 1/T，register blocking 降低 shared 读流量，双缓冲隐藏访存延迟",
    "bank conflict、padding 与 128-bit 向量化决定 shared 和 global 带宽能不能打满",
    "occupancy 与寄存器压力是权衡；Tensor Core 抬高算力屋顶，但更依赖数据复用"
  ],
  readingMinutes: 14,
  html: String.raw`
<section class="sec">
<h2>1. 先用 Roofline 定位瓶颈</h2>
<p>一个 kernel 慢，通常只卡在两件事上：数据没搬够快，或者计算单元没喂饱。Roofline model（屋顶线模型）把这句话变成一张可计算的图：横轴是算术强度（arithmetic intensity，AI），即每从 HBM（High Bandwidth Memory，高带宽显存）搬一个字节能完成多少次浮点运算；纵轴是可达性能。屋顶由两条线组成，斜边是带宽上限，平台是算力上限。</p>
<div class="formula">AI = FLOPs ÷ Bytes　（单位：FLOP/Byte）<br>P ≤ min(P_peak, BW × AI)</div>
<p>以 A100 80GB SXM（108 个 SM，即 Streaming Multiprocessor、流式多处理器）为例，HBM2e 带宽约 2.0 TB/s，FP32 CUDA Core 峰值约 19.5 TFLOPS，机器平衡点（machine balance，也称脊点）约为 19.5 ÷ 2.0 ≈ 9.75 FLOP/Byte（FP32 CUDA Core 口径；BF16 Tensor Core 口径的脊点见 profiling 一篇）。AI 低于这个值，屋顶的斜边更低，kernel 是 memory-bound（访存受限）；高于它，平台更低，才可能是 compute-bound（计算受限）。这两个数都按峰值口径，实际可达值通常是峰值的七到九成（带宽较易接近峰值，算力受指令组合影响更大），但用来判断方向足够。</p>
<p>矩阵乘是最典型的例子。naive 版本每个输出元素要读 A 的一行和 B 的一列，AI 只有 2 ÷ 8 = 0.25 FLOP/Byte（FP32，读写各 4 Byte），远在斜边底部。把 4096³ 的全局读取量算出来是 549.8 GB，按 2.0 TB/s 至少要 0.27 s，而计算只要约 7 ms，差出近 40 倍。反过来，一个逐元素相加 kernel（C = A + B，读两个、写一个 float，做 1 次加法）的 AI 只有 1 ÷ 12 ≈ 0.08 FLOP/Byte，它天生就是 memory-bound，再怎么调计算指令也没用，方向只能是融合、向量化和减少中间张量。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>先问“这个 kernel 每搬 1 Byte 干了几次活”，再决定是优化访存还是优化计算。Roofline 不告诉你实际能跑多快，只告诉你天花板在哪、该往哪个方向撞。</div></div>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="Roofline 示意图：带宽斜边与算力平台，以及 naive、shared tiling、Tensor Core 三个工作点">
<defs>
<marker id="kernel-optimization-ar1" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
<path d="M0,0 L6,3 L0,6 Z" fill="var(--sv-muted)"/>
</marker>
</defs>
<line x1="80" y1="320" x2="735" y2="320" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#kernel-optimization-ar1)"/>
<line x1="80" y1="320" x2="80" y2="35" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#kernel-optimization-ar1)"/>
<text x="405" y="362" font-size="14" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">算术强度 AI（FLOP/Byte，对数刻度）</text>
<text x="26" y="180" font-size="14" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle" transform="rotate(-90 26 180)">可达性能（对数刻度）</text>
<line x1="80" y1="300" x2="400" y2="120" stroke="var(--sv-a)" stroke-width="3"/>
<line x1="400" y1="120" x2="720" y2="120" stroke="var(--sv-b)" stroke-width="3"/>
<line x1="400" y1="120" x2="400" y2="320" stroke="var(--sv-line)" stroke-width="1.5" stroke-dasharray="6 5"/>
<text x="235" y="248" font-size="13" font-family="inherit" fill="var(--sv-a)" text-anchor="middle" transform="rotate(-26 235 248)">带宽屋顶 BW × AI</text>
<text x="560" y="108" font-size="13" font-family="inherit" fill="var(--sv-b)" text-anchor="middle">算力屋顶 P_peak</text>
<text x="80" y="340" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">0.1</text>
<text x="240" y="340" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">1</text>
<text x="400" y="340" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">10</text>
<text x="560" y="340" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">100</text>
<text x="720" y="340" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">1000</text>
<text x="408" y="312" font-size="12" font-family="inherit" fill="var(--sv-muted)">AI*</text>
<circle cx="144" cy="291" r="6" fill="var(--sv-c)"/>
<text x="152" y="306" font-size="12" font-family="inherit" fill="var(--sv-ink)">naive（AI≈0.25）</text>
<circle cx="385" cy="236" r="6" fill="var(--sv-a2)"/>
<text x="296" y="262" font-size="12" font-family="inherit" fill="var(--sv-ink)">shared tiling（AI≈8）</text>
<circle cx="529" cy="176" r="6" fill="var(--sv-b2)"/>
<text x="450" y="166" font-size="12" font-family="inherit" fill="var(--sv-ink)">Tensor Core tile（AI≈32–64）</text>
<text x="470" y="294" font-size="12" font-family="inherit" fill="var(--sv-muted)">点离屋顶越远，浪费越大</text>
</svg>
<figcaption>图 1 · Roofline 是示意图：同一块 GPU 上，naive、tiled、Tensor Core 工作点落在不同位置；坐标取对数，非实测数据。</figcaption>
</figure>
<p>还有第三类瓶颈不在 Roofline 的显式坐标里：延迟受限（latency-bound）。当 occupancy 太低、依赖链太长时，带宽和算力都吃不满，曲线上的点远低于屋顶。区分它要靠 profiler 里的 Warp stall 原因，而不是靠算术强度，这一点在第 6 节和第 8 节展开。</p>
</section>

<section class="sec">
<h2>2. Shared memory tiling：把重复访存搬进片上</h2>
<p>naive 矩阵乘的问题不是读得慢，而是读得重复。C 的同一个元素只计算一次，但 A 的同一行会被 N 个输出元素各读一次，B 的同一列会被 M 个输出元素各读一次。tiling（分块）的核心动作是：让一个 thread block 负责输出矩阵的一个 BM×BN 小块，先把这块计算所需的 A 面板和 B 面板从 HBM 搬进 shared memory（共享内存），块内所有线程反复使用，最后只把结果写回。</p>
<p>设方块边长为 T（BM = BN = T），则每个 block 读 A、B 各 T×K 个元素，全网格共 (M/T)×(N/T) 个 block，总全局读取元素数为 2×M×N×K ÷ T。对 4096³、T=32，这正好把 137.4×10⁹ 次元素读取降到 4.29×10⁹ 次，字节数从 549.8 GB 降到 17.2 GB，理论上是 32 倍。这个收益来自复用，而不是“shared memory 比 HBM 快”这么简单的一句话。</p>
<div class="formula">全局读取元素数：naive = 2 × M × N × K；tiled = 2 × M × N × K ÷ T<br>M = N = K = 4096，T = 32 → 137.4 × 10⁹ → 4.29 × 10⁹ 个 float<br>对应 HBM 流量：549.8 GB → 17.2 GB（忽略 L2 命中，按 4 Byte/float）</div>
<pre class="code" data-lang="cuda"><code>#define TILE 32

__global__ void matmul_tiled(const float* A, const float* B, float* C,
                             int M, int N, int K) {
  __shared__ float As[TILE][TILE];
  __shared__ float Bs[TILE][TILE];
  int tx = threadIdx.x, ty = threadIdx.y;
  int row = blockIdx.y * TILE + ty;
  int col = blockIdx.x * TILE + tx;
  float acc = 0.0f;

  for (int k0 = 0; k0 &lt; K; k0 += TILE) {
    As[ty][tx] = A[row * K + k0 + tx];
    Bs[ty][tx] = B[(k0 + ty) * N + col];
    __syncthreads();
    #pragma unroll
    for (int k = 0; k &lt; TILE; ++k)
      acc += As[ty][k] * Bs[k][tx];
    __syncthreads();
  }
  C[row * N + col] = acc;
}</code></pre>
<p>这段代码省略了边界检查，并假设 M、N、K 都能被 TILE 整除。两个 <code>__syncthreads()</code> 缺一不可：第一个保证 tile 写完再读，第二个保证本轮读完再覆盖。真实工程里还要处理尾块、用 <code>float4</code> 合并加载、把 K 维也分块以适配 shared 容量。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="tile 数据流：A、B 面板从 HBM 搬入 shared memory，再进入每线程寄存器累加器，最后写回 C">
<defs>
<marker id="kernel-optimization-ar3" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
<path d="M0,0 L6,3 L0,6 Z" fill="var(--sv-muted)"/>
</marker>
</defs>
<text x="380" y="30" font-size="14" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">HBM → shared memory → registers，三级复用</text>
<rect x="60" y="70" width="120" height="100" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<line x1="90" y1="70" x2="90" y2="170" stroke="var(--sv-line)"/>
<line x1="120" y1="70" x2="120" y2="170" stroke="var(--sv-line)"/>
<line x1="150" y1="70" x2="150" y2="170" stroke="var(--sv-line)"/>
<line x1="60" y1="103" x2="180" y2="103" stroke="var(--sv-line)"/>
<line x1="60" y1="136" x2="180" y2="136" stroke="var(--sv-line)"/>
<text x="120" y="62" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">A（M×K）</text>
<rect x="60" y="220" width="120" height="100" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<line x1="90" y1="220" x2="90" y2="320" stroke="var(--sv-line)"/>
<line x1="120" y1="220" x2="120" y2="320" stroke="var(--sv-line)"/>
<line x1="150" y1="220" x2="150" y2="320" stroke="var(--sv-line)"/>
<line x1="60" y1="253" x2="180" y2="253" stroke="var(--sv-line)"/>
<line x1="60" y1="286" x2="180" y2="286" stroke="var(--sv-line)"/>
<text x="120" y="212" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">B（K×N）</text>
<rect x="270" y="70" width="140" height="100" rx="6" fill="var(--sv-a)" opacity="0.18" stroke="var(--sv-a)"/>
<text x="340" y="62" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">As（BM×T）</text>
<text x="340" y="126" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">shared memory</text>
<rect x="270" y="220" width="140" height="100" rx="6" fill="var(--sv-b)" opacity="0.18" stroke="var(--sv-b)"/>
<text x="340" y="212" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">Bs（T×BN）</text>
<text x="340" y="276" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">shared memory</text>
<rect x="480" y="90" width="140" height="120" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<line x1="526" y1="90" x2="526" y2="210" stroke="var(--sv-line)"/>
<line x1="573" y1="90" x2="573" y2="210" stroke="var(--sv-line)"/>
<line x1="480" y1="130" x2="620" y2="130" stroke="var(--sv-line)"/>
<line x1="480" y1="170" x2="620" y2="170" stroke="var(--sv-line)"/>
<text x="550" y="82" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">寄存器：R_M×R_N 累加器</text>
<rect x="675" y="115" width="50" height="70" rx="6" fill="var(--sv-c)" opacity="0.22" stroke="var(--sv-c)"/>
<text x="700" y="107" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">C</text>
<text x="700" y="155" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">写回</text>
<line x1="180" y1="120" x2="270" y2="120" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#kernel-optimization-ar3)"/>
<line x1="180" y1="270" x2="270" y2="270" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#kernel-optimization-ar3)"/>
<line x1="410" y1="120" x2="480" y2="135" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#kernel-optimization-ar3)"/>
<line x1="410" y1="270" x2="480" y2="205" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#kernel-optimization-ar3)"/>
<line x1="620" y1="150" x2="675" y2="150" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#kernel-optimization-ar3)"/>
<text x="380" y="356" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">A 面板在 block 内被复用 BN 次，B 面板被复用 BM 次；线程内再做 R_M×R_N 次寄存器复用</text>
</svg>
<figcaption>图 2 · tile 数据流：全局内存只读一遍面板，shared 承担 block 级复用，寄存器承担线程级复用。</figcaption>
</figure>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="naive 与不同 tile 大小下每个输出元素的全局读取次数对比，T=32 时降到 256 次">
<line x1="80" y1="320" x2="735" y2="320" stroke="var(--sv-line)" stroke-width="1.5"/>
<line x1="80" y1="320" x2="80" y2="55" stroke="var(--sv-line)" stroke-width="1.5"/>
<text x="26" y="190" font-size="14" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle" transform="rotate(-90 26 190)">每输出元素的全局读取次数（对数刻度）</text>
<text x="410" y="360" font-size="14" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">tile 边长 T（K=4096，FP32）</text>
<line x1="80" y1="94" x2="720" y2="94" stroke="var(--sv-line)" stroke-dasharray="4 5"/>
<line x1="80" y1="163" x2="720" y2="163" stroke="var(--sv-line)" stroke-dasharray="4 5"/>
<line x1="80" y1="233" x2="720" y2="233" stroke="var(--sv-line)" stroke-dasharray="4 5"/>
<line x1="80" y1="303" x2="720" y2="303" stroke="var(--sv-line)" stroke-dasharray="4 5"/>
<text x="72" y="98" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">8192</text>
<text x="72" y="167" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">512</text>
<text x="72" y="237" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">32</text>
<text x="72" y="307" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">2</text>
<rect x="120" y="94" width="80" height="226" rx="3" fill="var(--sv-c)"/>
<rect x="240" y="146" width="80" height="174" rx="3" fill="var(--sv-a)"/>
<rect x="360" y="163" width="80" height="157" rx="3" fill="var(--sv-a2)"/>
<rect x="480" y="181" width="80" height="139" rx="3" fill="var(--sv-b)"/>
<rect x="600" y="198" width="80" height="122" rx="3" fill="var(--sv-b2)"/>
<text x="160" y="86" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">8192</text>
<text x="280" y="138" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">1024</text>
<text x="400" y="155" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">512</text>
<text x="520" y="173" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">256</text>
<text x="640" y="190" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">128</text>
<text x="160" y="340" font-size="13" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">naive</text>
<text x="280" y="340" font-size="13" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">T=8</text>
<text x="400" y="340" font-size="13" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">T=16</text>
<text x="520" y="340" font-size="13" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">T=32</text>
<text x="640" y="340" font-size="13" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">T=64</text>
<text x="400" y="70" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">T=32 时相对 naive 降低 32×；总流量 549.8 GB → 17.2 GB</text>
</svg>
<figcaption>图 3 · 每个输出元素的全局读取次数随 T 以 1/T 下降；纵轴为对数刻度，数值按 4096³、FP32、忽略 L2 计算。</figcaption>
</figure>
<p>tiling 不是免费的。shared memory 容量有限（A100 每 SM 约 164 KB，单 block 上限约 163 KB，需要显式 opt-in），tile 越大，occupancy 往往越低；每次 tile 切换还要同步，同步点太多会把流水线打断。更隐蔽的是，shared memory 自己的带宽和 bank 冲突会成为新瓶颈，第 4 节专门讲。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>tiling 的正确性依赖同步。少一个 <code>__syncthreads()</code> 往往不会每次都错，而是在大 shape、不同调度下偶发错误，最难排查。写完先用小 shape 加 <code>compute-sanitizer</code> 的 racecheck 跑一遍。</div></div>
</section>

<section class="sec">
<h2>3. Register blocking 与双缓冲</h2>
<p>shared tiling 解决的是 block 级的全局复用，register blocking（寄存器分块）解决的是线程级的片上复用。让每个线程算 RM×RN 个输出，而不是 1 个：外层每沿 K 走一步，线程只从 shared 读 RM 个 A 元素和 RN 个 B 元素，却做 RM×RN 次乘加（outer product，外积）。8×8 的线程微瓦片，读 16 个元素做 64 次 FMA，复用比 4:1；这也是为什么高性能 GEMM 的每个线程通常持有几十个累加器。</p>
<div class="formula">每线程复用比 = (R_M × R_N) ÷ (R_M + R_N)　（每步只搬 R_M + R_N 个元素，做 R_M × R_N 次 FMA）</div>
<p>代价是寄存器压力（register pressure）。8×8 的 FP32 累加器就是 64 个寄存器，加上 A/B 片段、地址、循环变量，很容易超过 100 个/线程。A100 每 SM 有 65536 个寄存器，256 线程的 block 若每人 128 个寄存器，只能放 2 个 block，occupancy 掉到 25%。所以 register blocking 的 tile 大小要和 occupancy 一起选，不能只追求复用比。</p>
<p>双缓冲（double buffering）用来遮住搬下一块的延迟：准备两份 shared buffer，计算第 i 块的同时，把第 i+1 块从 HBM 预取到另一份。Ampere 起可以用 <code>cp.async</code>（异步拷贝），让拷贝绕过寄存器直接进 shared；Hopper 的 TMA（Tensor Memory Accelerator）把整块多维 tile 的搬运做成一条指令，进一步降低地址计算和同步开销。流水线深度 2 到 4 阶很常见，再深收益递减且吃 shared 容量。</p>
<div class="callout callout--tip"><span class="callout__label">技巧</span><div>判断要不要双缓冲，看 profiler 里的 long scoreboard stall：如果 Warp 大量时间在等全局内存，而 occupancy 已经够高，双缓冲或预取通常有效；如果瓶颈是 shared bank conflict 或指令依赖，预取帮不上忙。</div></div>
</section>

<section class="sec">
<h2>4. Bank conflict、padding 与 128-bit 向量化</h2>
<p>shared memory 被切成 32 个 bank（存储体），每个 bank 宽 4 Byte；一个 Warp（线程束，32 个线程为一组）的 32 个线程如果访问的地址落在不同 bank，就能一次完成；落在同一 bank 的不同 32-bit 字地址，就要串行（同一地址的广播除外），称为 bank conflict（存储体冲突）。最典型的坏模式是按列访问一个 <code>[32][32]</code> 的 tile：同一列的元素地址相差 32 个 float，32 个线程全部落到同一个 bank，形成 32 路冲突，shared 带宽直接掉到 1/32。</p>
<div class="formula">conflict 度数 = 同一 Warp 内映射到同一 bank 的不同 32-bit 字地址数（同一地址广播不计）<br>串行化周期 ≈ 最大冲突度数（无冲突时为 1）</div>
<p>最便宜的修法是 padding（填充）：把 <code>[32][32]</code> 改成 <code>[32][33]</code>，行跨度变成 33 个 float，按列访问时相邻线程的 bank 依次错开，冲突消失。代价是每行多一个元素，地址计算也不再能只用移位。更系统的做法是 swizzle（异或重排）布局，CUTLASS 用 XOR 把逻辑坐标映射到物理 bank，既无冲突又保持向量化对齐；手写 kernel 若按 <code>float4</code> 访问，常把行跨度补到 4 的倍数（例如 36 个 float），否则 16 Byte 对齐会被破坏，向量化直接失效。</p>
<p>128-bit 向量化加载（vectorized load）是另一条独立收益：一次 <code>float4</code> 读 16 Byte，一个 Warp 就是 512 Byte，指令数降到原来的 1/4，内存流水线更容易打满。但它要求地址 16 Byte 对齐，且相邻线程读相邻的 <code>float4</code> 才能合并（coalescing）成完整的 128 Byte transaction。常见错误是为了向量化把线程映射改了，结果 global 访问不再连续，反而更慢。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="bank conflict 示意：stride 32 时同列全部落在 bank 0，padding 后逐行错开">
<text x="200" y="48" font-size="14" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">stride = 32：同列全落在 bank 0</text>
<text x="540" y="48" font-size="14" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">padding（stride = 33）：逐行错开</text>
<rect x="80" y="72" width="240" height="20" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<rect x="80" y="96" width="240" height="20" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<rect x="80" y="120" width="240" height="20" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<rect x="80" y="144" width="240" height="20" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<rect x="80" y="168" width="240" height="20" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<rect x="80" y="192" width="240" height="20" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<rect x="80" y="216" width="240" height="20" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<rect x="80" y="240" width="240" height="20" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<rect x="80" y="72" width="30" height="20" fill="var(--sv-c)"/>
<rect x="80" y="96" width="30" height="20" fill="var(--sv-c)"/>
<rect x="80" y="120" width="30" height="20" fill="var(--sv-c)"/>
<rect x="80" y="144" width="30" height="20" fill="var(--sv-c)"/>
<rect x="80" y="168" width="30" height="20" fill="var(--sv-c)"/>
<rect x="80" y="192" width="30" height="20" fill="var(--sv-c)"/>
<rect x="80" y="216" width="30" height="20" fill="var(--sv-c)"/>
<rect x="80" y="240" width="30" height="20" fill="var(--sv-c)"/>
<text x="95" y="286" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">bank 0</text>
<text x="305" y="286" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">bank 7</text>
<rect x="420" y="72" width="240" height="20" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<rect x="420" y="96" width="240" height="20" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<rect x="420" y="120" width="240" height="20" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<rect x="420" y="144" width="240" height="20" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<rect x="420" y="168" width="240" height="20" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<rect x="420" y="192" width="240" height="20" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<rect x="420" y="216" width="240" height="20" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<rect x="420" y="240" width="240" height="20" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<rect x="420" y="72" width="30" height="20" fill="var(--sv-a)"/>
<rect x="450" y="96" width="30" height="20" fill="var(--sv-a)"/>
<rect x="480" y="120" width="30" height="20" fill="var(--sv-a)"/>
<rect x="510" y="144" width="30" height="20" fill="var(--sv-a)"/>
<rect x="540" y="168" width="30" height="20" fill="var(--sv-a)"/>
<rect x="570" y="192" width="30" height="20" fill="var(--sv-a)"/>
<rect x="600" y="216" width="30" height="20" fill="var(--sv-a)"/>
<rect x="630" y="240" width="30" height="20" fill="var(--sv-a)"/>
<text x="200" y="316" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">32 个线程访问同一 bank：32 路串行</text>
<text x="540" y="316" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">每行偏移一个 bank：1 个周期完成</text>
<text x="380" y="350" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">示意 8 个 bank；真实 GPU 为 32 个 bank，每个 4 Byte</text>
</svg>
<figcaption>图 4 · bank conflict 的成因与 padding 修复：同一列地址 stride 为 32 个 float，模 32 后全部命中同一 bank。</figcaption>
</figure>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>padding 和向量化会互相打架：<code>[32][33]</code> 消除了标量 bank conflict，但 33 不是 4 的倍数，按 <code>float4</code> 读时对齐被破坏。要么改用 36 并按 float4 的线程映射重新核对 bank 分布，要么用 swizzle；不要同时套两个教程答案就收工。</div></div>
<p>还有一个容易忽略的点：shared memory 的 bank 宽度是 4 Byte，一个 <code>float4</code> 访问会横跨 4 个 bank，硬件按 wavefront 分 4 个周期处理。这不是冲突，因为 4 个周期传了 4 倍数据，带宽是满的；profiler 里要看的是 wavefront 数相对于理论值的比例，而不是看到非零就以为有冲突。</p>
</section>

<section class="sec">
<h2>5. 算子融合与 kernel launch 开销</h2>
<p>逐元素算子链条是融合（operator fusion）收益最大的地方。以 1 GB 的 FP32 张量为例，连续做 scale、bias、激活、残差加四个逐元素操作：不融合时每个算子读 1 GB、写 1 GB，合计约 8 GB HBM 流量；融合成一个 kernel 后，中间结果留在寄存器里，只读 1 GB、写 1 GB，约 2 GB。按 A100 的 2.0 TB/s 粗算，4 ms 降到 1 ms，省下的 3 ms 全是白捡的。</p>
<div class="formula">未融合流量 ≈ 2 × N_ops × 张量大小；融合后 ≈ 2 × 张量大小<br>1 GB、4 个逐元素算子：≈ 8 GB → ≈ 2 GB（A100 2.0 TB/s 下约 4 ms → 1 ms）</div>
<p>第二笔账是 kernel launch 开销（launch overhead）。每次 launch 要经过驱动、命令队列和 GPU 调度，量级通常在 3–10 μs，视驱动、GPU 和是否走 CUDA Graph 而定。单看不多，但推理里几百个小算子、训练里成千上万个 micro-kernel，累计就是毫秒级；如果每个 kernel 只跑 2 μs，launch 本身比计算还贵。CUDA Graphs 把一串 launch 录制成图后重放，能把 CPU 侧开销压到约 1–2 μs；persistent kernel（常驻 kernel）则把循环搬进 GPU 内部，彻底绕开重复 launch。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="融合前后时间线对比：未融合有四次 launch 和四次读写，融合后一次 launch、一次读一次写">
<text x="70" y="55" font-size="14" font-family="inherit" fill="var(--sv-ink)">未融合：4 次 launch，中间结果全部落 HBM</text>
<rect x="80" y="72" width="95" height="52" rx="4" fill="var(--sv-c)" opacity="0.8"/>
<rect x="220" y="72" width="95" height="52" rx="4" fill="var(--sv-c)" opacity="0.8"/>
<rect x="360" y="72" width="95" height="52" rx="4" fill="var(--sv-c)" opacity="0.8"/>
<rect x="500" y="72" width="95" height="52" rx="4" fill="var(--sv-c)" opacity="0.8"/>
<text x="127" y="103" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">K1</text>
<text x="267" y="103" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">K2</text>
<text x="407" y="103" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">K3</text>
<text x="547" y="103" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">K4</text>
<text x="197" y="150" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">3–10 μs</text>
<text x="337" y="150" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">3–10 μs</text>
<text x="477" y="150" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">3–10 μs</text>
<text x="400" y="180" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">HBM 流量 ≈ 8 GB，耗时约 4 ms（A100 量级）</text>
<text x="70" y="225" font-size="14" font-family="inherit" fill="var(--sv-ink)">融合后：1 次 launch，中间结果留在寄存器</text>
<rect x="80" y="242" width="620" height="52" rx="4" fill="var(--sv-b)" opacity="0.8"/>
<text x="390" y="273" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">读 1 GB → 寄存器内完成 4 个操作 → 写 1 GB</text>
<text x="400" y="320" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">HBM 流量 ≈ 2 GB，耗时约 1 ms；省下的是纯带宽时间</text>
<line x1="80" y1="345" x2="720" y2="345" stroke="var(--sv-line)" stroke-width="1.5"/>
<text x="720" y="364" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">时间 →</text>
</svg>
<figcaption>图 5 · 融合前后的时间线：融合减少的不只是 launch 次数，更是中间张量往返 HBM 的流量。</figcaption>
</figure>
<p>但融合不是越多越好。融合会增加寄存器占用和 shared 使用，可能把 occupancy 打下去；带全局归约的算子（如 LayerNorm 的均值/方差）需要先统计再归一化，强行融合会变成两遍读；融合还会降低代码可复用性和调试性。工程上先看 Nsight Systems 的 timeline：如果 GPU 上有大量空隙（gap），优先考虑 Graphs 和融合；如果 kernel 本身很慢、间隙很小，融合不是第一优先级。</p>
<div class="callout callout--tip"><span class="callout__label">技巧</span><div>用 Nsight Systems 看 GPU 时间线，用 Nsight Compute 看单个 kernel 内部。前者回答“是不是 launch 太碎”，后者回答“这个 kernel 为什么慢”，两个工具别混用。</div></div>
</section>

<section class="sec">
<h2>6. Occupancy 与寄存器压力的权衡</h2>
<p>occupancy（占用率）指一个 SM 上实际活跃 Warp 数占硬件上限的比例。A100 每个 SM 最多 2048 个线程、64 个 Warp、65536 个寄存器；一个 256 线程的 block 最多放 8 个，但如果每个线程用 64 个寄存器，65536 ÷ (64 × 256) = 4，只能放 4 个 block，也就是 1024 线程、32 个 Warp，occupancy 50%。寄存器、shared memory、block 数和 Warp 数，任何一个先到上限，occupancy 就被它卡住。</p>
<div class="formula">active_warps = min(⌊2048 ÷ threads_per_block⌋, ⌊65536 ÷ (regs_per_thread × threads_per_block)⌋, ⌊shared_per_SM ÷ shared_per_block⌋, blocks_per_SM_limit) × (threads_per_block ÷ 32)<br>occupancy = active_warps ÷ 64（A100，每 SM 上限 64 Warp）</div>
<p>为什么需要 occupancy？因为访存有延迟。A100 的 HBM 延迟在数百纳秒量级（约 400–600 个周期，视访问模式），要让 2.0 TB/s 的带宽不空闲，全 GPU 同时得有约 2.0 TB/s × 400 ns ≈ 800 KB 的数据在飞，平均到 108 个 SM 约 7.4 KB。一个 Warp 发一次 128-bit 向量加载是 32 × 16 = 512 Byte，若每个 Warp 只有一个未完成请求，就需要约 15 个 Warp 才能填满；如果每个线程有 4 个独立加载（ILP，instruction-level parallelism），所需 Warp 数可以降到 1/4。所以 occupancy 和 ILP 是互相替代的。</p>
<p>这也解释了为什么 100% occupancy 不是目标。把寄存器从 128 压到 64，occupancy 翻倍，但编译器可能把变量溢出到 local memory（本质还是 HBM），多出大量访存和指令，反而更慢。经验上，memory-bound kernel 为隐藏内存延迟，通常需要较高 occupancy（50% 以上往往有益）；compute-bound 且 ILP 充足的 kernel 在 25%–50% 就能跑满算力。用 <code>__launch_bounds__(threads, min_blocks)</code> 给编译器一个上限，比全局 <code>maxrregcount</code> 更可控。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="occupancy 与相对性能的示意曲线：计算受限且 ILP 充足的 kernel 在较低 occupancy 就接近饱和，访存受限 kernel 通常需要更高 occupancy">
<line x1="80" y1="320" x2="735" y2="320" stroke="var(--sv-line)" stroke-width="1.5"/>
<line x1="80" y1="320" x2="80" y2="45" stroke="var(--sv-line)" stroke-width="1.5"/>
<text x="405" y="360" font-size="14" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">occupancy（%）</text>
<text x="26" y="185" font-size="14" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle" transform="rotate(-90 26 185)">相对性能（%）</text>
<text x="80" y="340" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">0</text>
<text x="240" y="340" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">25</text>
<text x="400" y="340" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">50</text>
<text x="560" y="340" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">75</text>
<text x="720" y="340" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">100</text>
<line x1="400" y1="320" x2="400" y2="55" stroke="var(--sv-line)" stroke-width="1.5" stroke-dasharray="6 5"/>
<text x="406" y="300" font-size="12" font-family="inherit" fill="var(--sv-muted)">常见平衡区</text>
<polyline points="80,320 120,250 180,150 240,105 320,75 400,63 560,58 720,56" fill="none" stroke="var(--sv-a)" stroke-width="3"/>
<polyline points="80,320 140,270 200,220 280,160 360,115 480,80 600,68 720,65" fill="none" stroke="var(--sv-b)" stroke-width="3"/>
<line x1="470" y1="62" x2="505" y2="62" stroke="var(--sv-a)" stroke-width="3"/>
<text x="514" y="66" font-size="12" font-family="inherit" fill="var(--sv-ink)">compute-bound（ILP 充足）</text>
<line x1="470" y1="88" x2="505" y2="88" stroke="var(--sv-b)" stroke-width="3"/>
<text x="514" y="92" font-size="12" font-family="inherit" fill="var(--sv-ink)">memory-bound</text>
<text x="430" y="130" font-size="12" font-family="inherit" fill="var(--sv-muted)">继续加 occupancy 收益很小</text>
</svg>
<figcaption>图 6 · occupancy 与性能的示意关系：计算受限且 ILP 充足的 kernel 往往在较低 occupancy 就接近饱和；访存受限 kernel 为隐藏内存延迟，通常需要更高 occupancy。拐点随 kernel 与资源限制而变，不是固定值。</figcaption>
</figure>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>occupancy 是手段不是指标。优化时看的是 stall 原因和实际吞吐：如果 occupancy 只有 25% 但 SM 吞吐已接近峰值，继续堆 occupancy 只会增加调度开销。</div></div>
</section>

<section class="sec">
<h2>7. Tensor Core：wmma 与 CUTLASS 概览</h2>
<p>Tensor Core 是 GPU 上专门做小矩阵乘加的硬件单元。以 A100 为例，FP16 输入、FP32 累加的 Tensor Core 峰值约 312 TFLOPS（dense，稠密矩阵口径），TF32 约 156 TFLOPS，分别约为 FP32 CUDA Core 19.5 TFLOPS 的 16 倍和 8 倍。它一次执行一个 MMA（matrix multiply-accumulate）指令，常见形状是 16×16×16（WMMA）或 16×8×16（PTX mma），由 Warp 内线程协作完成；输入要求特定的 fragment 布局，累加器留在寄存器。</p>
<p>最上层的用法是 WMMA（Warp Matrix Multiply-Accumulate）API：声明 <code>fragment</code>，用 <code>load_matrix_sync</code> 从 shared 或 global 装载，<code>mma_sync</code> 做乘加，<code>store_matrix_sync</code> 写回。fragment 的内部布局是不透明的，不能假设某个线程持有哪个元素。</p>
<pre class="code" data-lang="cuda"><code>#include &lt;mma.h&gt;
#include &lt;cuda_fp16.h&gt;
using namespace nvcuda;

wmma::fragment&lt;wmma::matrix_a, 16, 16, 16, half, wmma::row_major&gt; a;
wmma::fragment&lt;wmma::matrix_b, 16, 16, 16, half, wmma::row_major&gt; b;
wmma::fragment&lt;wmma::accumulator, 16, 16, 16, float&gt; c;

wmma::fill_fragment(c, 0.0f);
wmma::load_matrix_sync(a, A + row * lda + k, lda);
wmma::load_matrix_sync(b, B + k * ldb + col, ldb);
wmma::mma_sync(c, a, b, c);
wmma::store_matrix_sync(C + row * ldc + col, c, ldc, wmma::mem_row_major);</code></pre>
<p>WMMA 适合教学和原型，生产级 GEMM 更常用 CUTLASS。CUTLASS 把 tiling 分成 threadblock、Warp、thread 三层，提供可组合的 MMA atom、epilogue（偏置、激活、类型转换）和经过 swizzle 的 shared 布局，还负责处理尾块、对齐和流水线；CuTe 是其布局与张量抽象层。真正要压榨性能时，一般是定制 CUTLASS 的 epilogue 或形状，而不是从零手写 PTX 的 <code>mma.sync</code>。</p>
<div class="duo"><div class="duo__col"><h4>WMMA</h4><p>几十行能跑通，接口稳定，适合理解 fragment 与 Warp 级协作；性能和布局控制有限，复杂 epilogue 不好塞。</p></div><div class="duo__col"><h4>CUTLASS</h4><p>接近库级性能，tile、swizzle、epilogue 都可配；学习曲线陡，模板报错难读，适合有明确融合需求的场景。</p></div></div>
<p>Tensor Core 会把 Roofline 的平台抬高，但斜边不变，所以算力越强越容易 memory-bound。原本在 FP32 下 AI=8 的 tiled kernel 已接近平衡点，换成 TF32 后平衡点升到约 78 FLOP/Byte，同样的数据复用就显得不够。这就是为什么 Tensor Core kernel 更依赖大 block tile、L2 复用和多级流水：不是算力不够，是数据供不上。</p>
</section>

<section class="sec">
<h2>8. 用 NCU 验证：一次只改一个变量</h2>
<p>Nsight Compute（NCU）是 NVIDIA 的 kernel 级 profiler。采集机制、重放方式与指标口径见 profiling 一篇；这里只保留优化侧的闭环：提出假设，只改一个变量，用 NCU 验证，再回到同一基线复测。每次测量固定 shape、dtype 与 GPU 时钟状态，并预热若干次。</p>
<pre class="code" data-lang="bash"><code># 采集目标 kernel 的完整指标；section 与重放参数见 profiling 一篇
ncu --set full --kernel-name regex:matmul --launch-count 1 -o matmul_profile ./matmul 4096

# 命令行查看摘要；图形界面用 ncu-ui 打开 .ncu-rep
ncu --import matmul_profile.ncu-rep</code></pre>
<p>判读顺序与 profiling 一致：先看 SpeedOfLight 的 SM 与 DRAM 吞吐，确认瓶颈资源；再看 Memory Workload Analysis 的合并效率、shared bank conflict 与 L2 命中；最后看 Occupancy 和 Warp State Statistics，区分寄存器限制、shared 限制还是 long scoreboard 阻塞。Source Counters 把热点落到具体行。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>NCU 指标</th><th>回答的问题</th><th>怎么判读</th></tr></thead>
<tbody>
<tr><td><code>sm__throughput.avg.pct_of_peak_sustained_elapsed</code></td><td>SM 计算资源用满了吗</td><td>接近 100% 说明计算侧接近饱和</td></tr>
<tr><td><code>gpu__dram_throughput.avg.pct_of_peak_sustained_elapsed</code></td><td>HBM 带宽用满了吗</td><td>高而 SM 低，典型 memory-bound</td></tr>
<tr><td><code>l1tex__data_bank_conflicts_pipe_lsu_mem_shared_op_ld.sum</code></td><td>shared load 有没有冲突</td><td>明显非零时查 padding 或 swizzle</td></tr>
<tr><td><code>launch__registers_per_thread</code></td><td>寄存器是否卡住 occupancy</td><td>结合 65536 ÷ (regs × threads) 估算 block 数</td></tr>
<tr><td><code>sm__warps_active.avg.pct_of_peak_sustained_active</code></td><td>实际 occupancy 多少</td><td>低且长期 scoreboard 阻塞，说明延迟没藏住</td></tr>
<tr><td><code>smsp__warp_issue_stalled_long_scoreboard_per_warp_active.pct</code></td><td>是否在等全局内存</td><td>高说明访存延迟是主因，考虑预取或提高并行度</td></tr>
</tbody>
</table></div>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>NCU 默认清空 L2、锁定基础频率并多次重放，报告里的 Duration 不能当作墙钟时间；对比两个实现时确保 <code>--cache-control</code> 与 <code>--clock-control</code> 设置一致。测端到端时间则要回到 nsys 或普通 benchmark。</div></div>
<p>几个常见坑：只跑一次就下结论（时钟未稳、编译未缓存）；用不同 shape 对比（tile 边界效应完全不同）；把峰值算力当可达算力；忽略 ECC（纠错码）、MIG（多实例 GPU）和功耗墙对频率的影响；以及把 shared memory 的 wavefront 正常分周期误判成 bank conflict。排障顺序建议固定为：先确认瓶颈资源（DRAM、SM、延迟），再确认访问效率（合并、bank、sector），最后才调 tile 和 occupancy。</p>
</section>

<section class="sec">
<h2>自测</h2>
<details class="quiz"><summary>Q1 · 4096³ FP32、T=32 的 shared tiling，为什么仍可能 memory-bound？</summary><div class="quiz__a">tiled 的 AI = 2MNK ÷ (2MNK/T × 4 Byte) = T ÷ 4 = 8 FLOP/Byte，而 A100 FP32 的机器平衡点约 9.75 FLOP/Byte，8 仍低于平衡点。换算成时间：全局流量 17.2 GB ÷ 2.0 TB/s ≈ 8.6 ms，计算 137.4 GFLOP ÷ 19.5 TFLOPS ≈ 7.0 ms，访存仍略慢。要越过平衡点，需要更大的有效 block tile（例如 128×128，AI≈32）、寄存器分块或依赖 L2 复用；换成 Tensor Core 后平衡点更高，反而更需要数据复用。</div></details>
<details class="quiz"><summary>Q2 · 为什么 <code>[32][32]</code> 的 shared tile 按列访问会 32 路冲突？padding 成 33 为什么有效？</summary><div class="quiz__a">同一列元素的行下标相差 1，地址相差 32 个 float；shared bank 编号按 4 Byte 字地址模 32，32 个线程的地址模 32 全为同一个值，因此全部落到同一 bank。padding 后行跨度变为 33 个 float，按列访问时每行的 bank 偏移 1，32 个线程依次落在 32 个不同 bank 上，冲突消失。代价是每行多 1 个 float 的容量，地址计算也不再能只用移位；若改用 float4，需要补到 4 的倍数或用 swizzle。</div></details>
<details class="quiz"><summary>Q3 · occupancy 只有 25%，但 SM 吞吐已到峰值的 90%，还要继续提 occupancy 吗？</summary><div class="quiz__a">通常不需要。这说明 kernel 是 compute-bound，且 ILP 或指令级并行已经足够填满流水线；继续压寄存器换 occupancy 可能引入 spill 到 local memory，反而增加访存。应该看 Warp stall 原因：若主要是 long scoreboard，才考虑提高 occupancy 或预取；若主要是 math pipe throttle 或依赖，优化计算和指令调度更有效。</div></details>
<details class="quiz"><summary>Q4 · 4 个逐元素算子作用在 1 GB 张量上，融合能省多少流量？什么情况下不该融合？</summary><div class="quiz__a">不融合：每个算子读 1 GB、写 1 GB，共约 8 GB；融合后只读 1 GB、写 1 GB，约 2 GB。按 A100 2.0 TB/s 粗算，约 4 ms 降到 1 ms。若融合导致寄存器或 shared 占用过高、occupancy 明显下降，或算子包含必须跨 block 的全局归约（如 LayerNorm 的两遍统计），收益会被抵消甚至变负；应先看 Nsight Systems 确认瓶颈是带宽还是 launch 间隙。</div></details>
</section>

<section class="sec">
<h2>延伸阅读</h2>
<ul class="refs">
<li><b>CUDA C++ Best Practices Guide</b> — NVIDIA，持续更新。访存合并、occupancy、kernel 设计与部署检查清单的官方入口。</li>
<li><b>NVIDIA CUTLASS Documentation</b> — NVIDIA。threadblock、Warp、thread 三层 tiling、MMA atom、epilogue 与 swizzle 布局的工程参考。</li>
<li><b>Nsight Compute Documentation</b> — NVIDIA。SpeedOfLight、Memory Workload Analysis、Occupancy 等 section 与指标口径的权威说明。</li>
<li><b>How to Optimize a CUDA Matmul Kernel for cuBLAS-like Performance: A Worklog</b> — Simon Boehm（Siboehm），博客长文。从 naive 到多级 tiling 的逐步实测，适合对照本篇的每一步。</li>
<li><b>Roofline: An Insightful Visual Performance Model for Multicore Architectures</b> — Williams, Waterman, Patterson，Communications of the ACM, 2009。Roofline 的原始论文，AI 与机器平衡点的定义来源。</li>
</ul>
</section>
`
};
