window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["memory-hierarchy"] = {
  slug: "memory-hierarchy",
  title: "显存层级：从 HBM 到寄存器",
  subtitle: "容量、带宽与延迟的三重约束",
  level: 1,
  cluster: "硬件",
  tags: ["HBM", "SRAM", "合并访问"],
  summary: "从寄存器到显存，拆解容量、带宽与延迟的数量级，讲清合并访问与 bank 冲突的成因，给出 KV 缓存估算与排障路径，帮你在优化前判断瓶颈在算力还是喂数。",
  keyPoints: [
    "寄存器、shared memory/L1、L2、HBM 的容量、带宽、延迟数量级与 A100/H100/H200/B200 对比",
    "HBM 3D 堆叠、TSV、1024-bit 接口与 channel/pseudo-channel 结构",
    "合并访问与 bank conflict 的成因、识别指标与修复方法",
    "KV Cache 容量公式与显存墙的排障顺序"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>先记住一句话：算力等着显存喂数</h2>
<p>你熟悉 Transformer 的矩阵乘，也大致知道 A100 的 FP16 算力是 312 TFLOPS。但真正跑起来，一个 kernel 往往远达不到这个数字。原因通常不在乘加单元，而在数据还没送到：<mark>GPU 的存储是一套分层系统</mark>，从寄存器到 HBM（High Bandwidth Memory，高带宽内存），容量差五个数量级，带宽差一个数量级，延迟差两到三个数量级。写代码时忽略这套层级，算力就只能空转。</p>
<p>这篇的目标不是教你写最快 kernel，而是建立一张“显存地图”：每一层有多大、多快、多慢，什么样的访问模式会把带宽浪费掉，以及怎么用容量公式提前算出会不会 OOM（Out Of Memory，显存不足）。具体的 tiling、流水线、异步拷贝等技巧，留给 kernel-optimization 一篇展开。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>把 SM 想成一家工厂：寄存器是手上的零件，shared memory（共享内存）是车间工作台，L2 是中央仓库，HBM 是城外物流中心。工厂产能再高，物流车一次只拉一箱，也会停工等料。</div></div>
</section>

<section class="sec">
<h2>内存金字塔：容量、带宽、延迟的数量级</h2>
<p>先把数量级钉死。以 A100 80GB SXM 为例：每个 SM 有 256 KB 寄存器堆和 192 KB 的 L1/shared 合并空间；全芯片 40 MB L2；片外 80 GB HBM2e，带宽约 2.0 TB/s。所有 SM 的 shared memory 聚合带宽在官方白皮书口径下约为 19 TB/s，约为 HBM 的 9 倍。H100 SXM 把 HBM 提到 3.35 TB/s，H200 到 4.8 TB/s，B200 到 8 TB/s，但片上 SRAM（Static Random Access Memory，静态随机存储器）的容量并没有同比例膨胀。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="GPU 内存金字塔：寄存器、共享内存与 L1、L2、HBM、主机内存的容量带宽延迟对比" font-family="inherit">
<text x="380" y="24" text-anchor="middle" font-size="15" fill="var(--sv-ink)">容量向下增大，带宽向下降低，延迟向下升高</text>
<g text-anchor="middle">
<rect x="260" y="42" width="240" height="46" rx="4" fill="var(--sv-a)" fill-opacity="0.28" stroke="var(--sv-a)"/>
<text x="380" y="62" font-size="13" fill="var(--sv-ink)">寄存器 Register File</text>
<text x="380" y="79" font-size="12" fill="var(--sv-muted)">每 SM 256 KB · 约 1 周期</text>

<rect x="215" y="96" width="330" height="46" rx="4" fill="var(--sv-a2)" fill-opacity="0.28" stroke="var(--sv-a2)"/>
<text x="380" y="116" font-size="13" fill="var(--sv-ink)">Shared Memory + L1</text>
<text x="380" y="133" font-size="12" fill="var(--sv-muted)">每 SM 192–256 KB · 聚合约 19 TB/s · 20–30 周期</text>

<rect x="170" y="150" width="420" height="46" rx="4" fill="var(--sv-b2)" fill-opacity="0.28" stroke="var(--sv-b2)"/>
<text x="380" y="170" font-size="13" fill="var(--sv-ink)">L2 Cache</text>
<text x="380" y="187" font-size="12" fill="var(--sv-muted)">40–126 MB · 数 TB/s 量级 · 约 200 周期</text>

<rect x="125" y="204" width="510" height="46" rx="4" fill="var(--sv-b)" fill-opacity="0.28" stroke="var(--sv-b)"/>
<text x="380" y="224" font-size="13" fill="var(--sv-ink)">HBM 显存</text>
<text x="380" y="241" font-size="12" fill="var(--sv-muted)">40–192 GB · 2.0–8 TB/s · 数百 ns</text>

<rect x="80" y="258" width="600" height="46" rx="4" fill="var(--sv-c)" fill-opacity="0.28" stroke="var(--sv-c)"/>
<text x="380" y="278" font-size="13" fill="var(--sv-ink)">主机内存与 NVMe</text>
<text x="380" y="295" font-size="12" fill="var(--sv-muted)">数百 GB–TB · PCIe/NVLink · 微秒级</text>
</g>
<text x="380" y="338" text-anchor="middle" font-size="12" fill="var(--sv-muted)">数字为公开资料口径的量级，实际值随架构、SKU、命中率与负载变化</text>
</svg>
<figcaption>图 1 · GPU 内存金字塔：越靠上容量越小、带宽越高、延迟越低</figcaption>
</figure>
<p>读这张图要抓住三个方向。容量整体跨约五个数量级，但不是每层都放大同样的倍数：每 SM 的寄存器堆与 L1/shared 在同一量级（各约 192 到 256 KB），L2 全芯片只有几十 MB，到 HBM 才跳到几十 GB。带宽往下明显下降，HBM 只有 shared memory 聚合带宽的十分之一左右；延迟往上增加，寄存器几乎为零，HBM 则是数百纳秒。优化的本质因此很朴素：<b>提高数据复用，把访问尽量留在上层</b>。一个被复用 32 次的 tile，放在 shared memory 里就比每次回 HBM 便宜将近一个数量级。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>GPU（SXM）</th><th>HBM 容量</th><th>HBM 带宽</th><th>L2</th><th>每 SM L1/shared</th><th>每 SM 寄存器</th></tr></thead>
<tbody>
<tr><td>A100 80GB</td><td>80 GB HBM2e</td><td>2.0 TB/s</td><td>40 MB</td><td>192 KB</td><td>256 KB</td></tr>
<tr><td>H100</td><td>80 GB HBM3</td><td>3.35 TB/s</td><td>50 MB</td><td>256 KB</td><td>256 KB</td></tr>
<tr><td>H200</td><td>141 GB HBM3e</td><td>4.8 TB/s</td><td>50 MB</td><td>256 KB</td><td>256 KB</td></tr>
<tr><td>B200</td><td>192 GB HBM3e</td><td>8 TB/s</td><td>约 126 MB（双 die 合计）</td><td>约 256 KB</td><td>256 KB</td></tr>
</tbody>
</table></div>
<p>上文的 19 TB/s 是“全芯片聚合”口径，不是单个 SM 的带宽；单个 SM 的 shared memory 带宽还要除以 SM 数量（A100 为 108 个 SM）。另外，这些都是理论上限，实际可达带宽受命中率、bank conflict、指令发射和占用率影响，通常只能跑到峰值的六到八成。</p>
</section>

<section class="sec">
<h2>HBM 的物理结构：用宽度和堆叠换带宽</h2>
<p>HBM 的高带宽不是靠单颗 DRAM 跑得更快，而是靠“接口极宽 + 距离极短”。一颗 HBM stack 与 GPU 之间有 1024 根数据线，直接坐在硅中介层（silicon interposer）上，走线长度只有毫米级。传统 DDR 通过 PCB 走线，位宽通常 64 bit，还要经过较长的内存通道，频率和能效都受限。HBM 相当于把“内存总线”从主板搬进了封装内部。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="HBM 3D 堆叠剖面：DRAM die、TSV、逻辑基片、硅中介层与 GPU die 的连接" font-family="inherit">
<defs>
<marker id="memory-hierarchy-arrow-2" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
<path d="M0,0 L8,3 L0,6 Z" fill="var(--sv-a)"/>
</marker>
</defs>
<text x="380" y="24" text-anchor="middle" font-size="15" fill="var(--sv-ink)">HBM 3D 堆叠剖面：垂直堆叠换容量，1024-bit 接口换带宽</text>

<rect x="50" y="312" width="660" height="30" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="380" y="332" text-anchor="middle" font-size="12" fill="var(--sv-muted)">封装基板 Package Substrate</text>

<rect x="50" y="276" width="660" height="28" fill="var(--sv-b2)" fill-opacity="0.35" stroke="var(--sv-b)"/>
<text x="380" y="295" text-anchor="middle" font-size="12" fill="var(--sv-ink)">硅中介层 Silicon Interposer（高密度布线）</text>

<rect x="80" y="150" width="230" height="108" rx="4" fill="var(--sv-a)" fill-opacity="0.3" stroke="var(--sv-a)"/>
<text x="195" y="190" text-anchor="middle" font-size="14" fill="var(--sv-ink)">GPU Die</text>
<text x="195" y="212" text-anchor="middle" font-size="12" fill="var(--sv-muted)">SM · L2 · 内存控制器</text>
<text x="195" y="232" text-anchor="middle" font-size="12" fill="var(--sv-muted)">HBM PHY</text>

<text x="535" y="50" text-anchor="middle" font-size="13" fill="var(--sv-ink)">HBM3e Stack</text>
<g fill="var(--sv-b)" fill-opacity="0.3" stroke="var(--sv-b)">
<rect x="450" y="58" width="170" height="15"/>
<rect x="450" y="76" width="170" height="15"/>
<rect x="450" y="94" width="170" height="15"/>
<rect x="450" y="112" width="170" height="15"/>
<rect x="450" y="130" width="170" height="15"/>
<rect x="450" y="148" width="170" height="15"/>
<rect x="450" y="166" width="170" height="15"/>
<rect x="450" y="184" width="170" height="15"/>
</g>
<rect x="438" y="206" width="194" height="16" rx="2" fill="var(--sv-c)" fill-opacity="0.35" stroke="var(--sv-c)"/>
<text x="535" y="218" text-anchor="middle" font-size="12" fill="var(--sv-ink)">逻辑基片 Base Die</text>
<g stroke="var(--sv-c)" stroke-width="1.5" opacity="0.9">
<line x1="475" y1="60" x2="475" y2="238"/>
<line x1="505" y1="60" x2="505" y2="238"/>
<line x1="535" y1="60" x2="535" y2="238"/>
<line x1="565" y1="60" x2="565" y2="238"/>
<line x1="595" y1="60" x2="595" y2="238"/>
</g>
<g fill="var(--sv-c)">
<circle cx="460" cy="232" r="3"/>
<circle cx="490" cy="232" r="3"/>
<circle cx="520" cy="232" r="3"/>
<circle cx="550" cy="232" r="3"/>
<circle cx="580" cy="232" r="3"/>
<circle cx="610" cy="232" r="3"/>
</g>
<path d="M535,276 V298 H310 V260" fill="none" stroke="var(--sv-a)" stroke-width="2" marker-end="url(#memory-hierarchy-arrow-2)"/>
<text x="335" y="270" font-size="12" fill="var(--sv-ink)">1024-bit 接口 / stack</text>

<text x="632" y="72" font-size="12" fill="var(--sv-muted)">8–12 层 DRAM die</text>
<text x="632" y="90" font-size="12" fill="var(--sv-muted)">每 stack 16–36 GB</text>
<text x="632" y="130" font-size="12" fill="var(--sv-muted)">TSV 硅通孔</text>
<text x="632" y="148" font-size="12" fill="var(--sv-muted)">垂直走线，短且宽</text>
<text x="632" y="188" font-size="12" fill="var(--sv-muted)">每 stack 1024-bit</text>
<text x="632" y="206" font-size="12" fill="var(--sv-muted)">16 channel × 64-bit</text>
<text x="380" y="364" text-anchor="middle" font-size="12" fill="var(--sv-muted)">容量 = 每层容量 × 层数；带宽 = (位宽 ÷ 8) × 每 pin 速率 × stack 数</text>
</svg>
<figcaption>图 2 · HBM 3D 堆叠剖面：DRAM 层、TSV、逻辑基片与硅中介层</figcaption>
</figure>
<p>堆叠内部是 8 到 12 层 DRAM die，垂直方向用 TSV（through-silicon via，硅通孔）打通，底部是一层逻辑基片（base die），负责缓冲与测试。整个 stack 按 channel 组织，每个 channel 的存储单元分布在堆叠的各层 die 上，通过 TSV 统一编址。以 HBM3 为例，一个 stack 是 1024-bit，内部有 16 个 64-bit channel，每个 channel 又可拆成两个 32-bit 伪通道（pseudo-channel）。多个 channel 的意义是：不同 SM 或不同 Warp 的请求可以并行打到不同 channel，前提是地址分散得开。</p>
<p>按位宽和速率估算：1024 bit ÷ 8 = 128 B，即每个 pin 传输一次、一个 stack 就搬运 128 B；所以单 stack 带宽 = 128 B × 每 pin 速率。HBM2e 每 pin 约 3.2 Gbps，单 stack 约 0.4 TB/s，A100 的 5 个 stack 合计约 2.0 TB/s；HBM3/HBM3e 每 pin 约 6.25 到 9.6 Gbps，单 stack 约 0.8 到 1.2 TB/s，H200 的 6 个 stack（约 6.25 Gbps）合计 4.8 TB/s，B200 的 8 个 stack 合计 8 TB/s。容量同理，是每 stack 容量乘以 stack 数；H200 标称 141 GB 而不是 6×24=144 GB，差额是厂商保留的冗余容量。这也解释了为什么 HBM 的容量增长总是和封装里能塞下几个 stack 绑定。</p>
<div class="callout callout--story"><span class="callout__label">故事</span><div>HBM 把“内存墙”从板级问题变成了封装问题：DRAM 不再插在主板上，而是和 GPU 一起封进同一个 package。代价是制造难度和成本，收益是每瓦带宽提高数倍，并且延迟不再受长走线折磨。今天大模型训练卡的带宽竞赛，很大程度上就是堆叠层数与 pin 速率的竞赛。</div></div>
</section>

<section class="sec">
<h2>一次全局内存访问要花多久：延迟与带宽是两件事</h2>
<p>带宽说“每秒能搬多少”，延迟说“第一字节多久到”。这两个数字不能互相替代。HBM 延迟在数百纳秒量级，常见微基准落在 400 到 600 ns（随架构与负载变化）；L2 命中约 200 个周期；shared memory/L1 命中约 20 到 30 个周期；寄存器则是零额外延迟。以 1.5 GHz 估算，200 周期约 130 ns，一次 L2 未命中的 HBM 访问，够 SM 执行上百条指令。</p>
<div class="formula">单次访问耗时 ≈ 延迟 + 搬运字节数 ÷ 带宽</div>
<p>要掩盖延迟，靠的是在途请求数，也就是内存级并行（memory-level parallelism）。根据利特尔定律（Little's law），想跑满带宽，必须有足够多的字节同时在路上。A100 全卡 2.0 TB/s 乘以 500 ns 约等于 1 MB；分摊到 108 个 SM，每个 SM 约 9 KB，相当于 2300 多个 4 B 的独立请求同时在飞。这就是占用率和指令级并行重要的原因：线程太少，延迟藏不住，带宽自然用不满。</p>
<div class="formula">在途字节 ≈ 带宽 × 延迟</div>
<p>更系统的判断用 Roofline 模型（完整推导与落点见 three-bottlenecks）。算术强度（arithmetic intensity）AI 等于 FLOPs 除以搬运字节数；脊点等于峰值算力除以峰值带宽。A100 的 BF16/FP16 稠密算力为 312 TFLOPS，以 2.039 TB/s 计，脊点约 153 FLOP/B；H100 约 989 TFLOPS 对 3.35 TB/s，脊点约 295 FLOP/B。AI 低于脊点就是带宽受限，高于脊点才轮到算力受限。</p>
<div class="formula">AI = FLOPs ÷ Bytes；脊点 = 峰值算力 ÷ 峰值带宽</div>
<p>自回归解码是典型的低 AI 场景：每生成一个 token 都要把全部权重读一遍，但每个权重只参与少量乘加，AI 大约只有 1 到 2 FLOP/B，远低于脊点。7B 模型 FP16 权重约 14 GB，在 A100 上仅“读完权重”的理论下限就是 14 GB ÷ 2.039 TB/s ≈ 6.9 ms/token，对应约 145 token/s，实际还会更低。推理侧的 batch 与 KV Cache 权衡在 inference-basics 一篇继续展开。</p>
</section>

<section class="sec">
<h2>合并访问：让 32 个线程共用一次搬运</h2>
<p>GPU 以 Warp 为单位调度，一个 Warp 有 32 个线程。全局内存控制器以 32 B sector 为基本搬运粒度，一次 Warp 的 load 会被合并器（coalescer）拆成若干 sector。若 32 个线程各读 4 B 且地址连续，正好覆盖 128 B、4 个 sector，一次请求完成；若地址跨得很开，就会退化成几十次独立搬运。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="合并访问与跨步访问对比：32 个线程的地址分布与内存事务数量" font-family="inherit">
<defs>
<marker id="memory-hierarchy-arrow-3" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
<path d="M0,0 L8,3 L0,6 Z" fill="var(--sv-muted)"/>
</marker>
</defs>
<text x="380" y="24" text-anchor="middle" font-size="15" fill="var(--sv-ink)">同样 32 个线程：合并访问搬 128 B，跨步访问搬 1024 B</text>

<rect x="25" y="38" width="710" height="160" rx="6" fill="var(--sv-panel)" fill-opacity="0.45" stroke="var(--sv-line)"/>
<text x="45" y="62" font-size="14" fill="var(--sv-ink)">合并访问 Coalesced：thread i 读 base + i × 4 B</text>
<g fill="var(--sv-a)" fill-opacity="0.35" stroke="var(--sv-a)">
<rect x="45" y="76" width="14" height="18"/>
<rect x="63" y="76" width="14" height="18"/>
<rect x="81" y="76" width="14" height="18"/>
<rect x="99" y="76" width="14" height="18"/>
<rect x="117" y="76" width="14" height="18"/>
<rect x="135" y="76" width="14" height="18"/>
<rect x="153" y="76" width="14" height="18"/>
<rect x="171" y="76" width="14" height="18"/>
<rect x="189" y="76" width="14" height="18"/>
<rect x="207" y="76" width="14" height="18"/>
<rect x="225" y="76" width="14" height="18"/>
<rect x="243" y="76" width="14" height="18"/>
<rect x="261" y="76" width="14" height="18"/>
<rect x="279" y="76" width="14" height="18"/>
<rect x="297" y="76" width="14" height="18"/>
<rect x="315" y="76" width="14" height="18"/>
<rect x="333" y="76" width="14" height="18"/>
<rect x="351" y="76" width="14" height="18"/>
<rect x="369" y="76" width="14" height="18"/>
<rect x="387" y="76" width="14" height="18"/>
<rect x="405" y="76" width="14" height="18"/>
<rect x="423" y="76" width="14" height="18"/>
<rect x="441" y="76" width="14" height="18"/>
<rect x="459" y="76" width="14" height="18"/>
<rect x="477" y="76" width="14" height="18"/>
<rect x="495" y="76" width="14" height="18"/>
<rect x="513" y="76" width="14" height="18"/>
<rect x="531" y="76" width="14" height="18"/>
<rect x="549" y="76" width="14" height="18"/>
<rect x="567" y="76" width="14" height="18"/>
<rect x="585" y="76" width="14" height="18"/>
<rect x="603" y="76" width="14" height="18"/>
</g>
<g stroke="var(--sv-muted)" fill="none">
<path d="M45,96 v6 H188 v-6"/>
<path d="M190,96 v6 H332 v-6"/>
<path d="M334,96 v6 H476 v-6"/>
<path d="M478,96 v6 H617 v-6"/>
</g>
<g text-anchor="middle" font-size="12" fill="var(--sv-muted)">
<text x="116" y="116">32 B</text>
<text x="261" y="116">32 B</text>
<text x="405" y="116">32 B</text>
<text x="547" y="116">32 B</text>
</g>
<rect x="45" y="128" width="572" height="28" rx="4" fill="var(--sv-a)" fill-opacity="0.3" stroke="var(--sv-a)"/>
<text x="331" y="147" text-anchor="middle" font-size="12" fill="var(--sv-ink)">1 个请求 · 4 个 sector · 搬运 128 B · 有效 128 B</text>

<rect x="25" y="208" width="710" height="150" rx="6" fill="var(--sv-panel)" fill-opacity="0.45" stroke="var(--sv-line)"/>
<text x="45" y="232" font-size="14" fill="var(--sv-ink)">跨步访问 Strided：thread i 读 base + i × 128 B</text>
<g fill="var(--sv-b)" fill-opacity="0.5" stroke="var(--sv-b)">
<rect x="45" y="248" width="7" height="14"/>
<rect x="65" y="248" width="7" height="14"/>
<rect x="85" y="248" width="7" height="14"/>
<rect x="105" y="248" width="7" height="14"/>
<rect x="125" y="248" width="7" height="14"/>
<rect x="145" y="248" width="7" height="14"/>
<rect x="165" y="248" width="7" height="14"/>
<rect x="185" y="248" width="7" height="14"/>
<rect x="205" y="248" width="7" height="14"/>
<rect x="225" y="248" width="7" height="14"/>
<rect x="245" y="248" width="7" height="14"/>
<rect x="265" y="248" width="7" height="14"/>
<rect x="285" y="248" width="7" height="14"/>
<rect x="305" y="248" width="7" height="14"/>
<rect x="325" y="248" width="7" height="14"/>
<rect x="345" y="248" width="7" height="14"/>
<rect x="365" y="248" width="7" height="14"/>
<rect x="385" y="248" width="7" height="14"/>
<rect x="405" y="248" width="7" height="14"/>
<rect x="425" y="248" width="7" height="14"/>
<rect x="445" y="248" width="7" height="14"/>
<rect x="465" y="248" width="7" height="14"/>
<rect x="485" y="248" width="7" height="14"/>
<rect x="505" y="248" width="7" height="14"/>
<rect x="525" y="248" width="7" height="14"/>
<rect x="545" y="248" width="7" height="14"/>
<rect x="565" y="248" width="7" height="14"/>
<rect x="585" y="248" width="7" height="14"/>
<rect x="605" y="248" width="7" height="14"/>
<rect x="625" y="248" width="7" height="14"/>
<rect x="645" y="248" width="7" height="14"/>
<rect x="665" y="248" width="7" height="14"/>
</g>
<line x1="45" y1="272" x2="705" y2="272" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#memory-hierarchy-arrow-3)"/>
<text x="45" y="290" font-size="12" fill="var(--sv-muted)">0 B</text>
<text x="700" y="290" text-anchor="end" font-size="12" fill="var(--sv-muted)">4 KB</text>
<text x="380" y="290" text-anchor="middle" font-size="12" fill="var(--sv-muted)">地址</text>
<text x="45" y="310" font-size="12" fill="var(--sv-ink)">每个线程落在不同的 32 B sector（或 128 B cache line）</text>
<g fill="var(--sv-c)" fill-opacity="0.5" stroke="var(--sv-c)">
<rect x="45" y="320" width="16" height="12"/>
<rect x="65" y="320" width="16" height="12"/>
<rect x="85" y="320" width="16" height="12"/>
<rect x="105" y="320" width="16" height="12"/>
<rect x="125" y="320" width="16" height="12"/>
<rect x="145" y="320" width="16" height="12"/>
<rect x="165" y="320" width="16" height="12"/>
<rect x="185" y="320" width="16" height="12"/>
<rect x="205" y="320" width="16" height="12"/>
<rect x="225" y="320" width="16" height="12"/>
<rect x="245" y="320" width="16" height="12"/>
<rect x="265" y="320" width="16" height="12"/>
<rect x="285" y="320" width="16" height="12"/>
<rect x="305" y="320" width="16" height="12"/>
<rect x="325" y="320" width="16" height="12"/>
<rect x="345" y="320" width="16" height="12"/>
<rect x="365" y="320" width="16" height="12"/>
<rect x="385" y="320" width="16" height="12"/>
<rect x="405" y="320" width="16" height="12"/>
<rect x="425" y="320" width="16" height="12"/>
<rect x="445" y="320" width="16" height="12"/>
<rect x="465" y="320" width="16" height="12"/>
<rect x="485" y="320" width="16" height="12"/>
<rect x="505" y="320" width="16" height="12"/>
<rect x="525" y="320" width="16" height="12"/>
<rect x="545" y="320" width="16" height="12"/>
<rect x="565" y="320" width="16" height="12"/>
<rect x="585" y="320" width="16" height="12"/>
<rect x="605" y="320" width="16" height="12"/>
<rect x="625" y="320" width="16" height="12"/>
<rect x="645" y="320" width="16" height="12"/>
<rect x="665" y="320" width="16" height="12"/>
</g>
<text x="45" y="352" font-size="12" fill="var(--sv-ink)">32 个事务 · 搬运 32 × 32 B = 1024 B · 有效 128 B → 利用率 12.5%</text>
</svg>
<figcaption>图 3 · 合并访问与跨步访问的地址分布与事务数量对比</figcaption>
</figure>
<p>看一个经典反例。按行优先存储的矩阵 A[M][N]，如果让 thread tid 访问 A[tid][0]，相邻线程的地址相差 N 个 float，也就是 N×4 B。当 N=32 时相差 128 B，32 个线程落在 32 个不同的 128 B cache line 上，实际搬运 32×32 B=1024 B，却只用到 128 B，有效带宽利用率 12.5%。把访问改成 A[0][tid]，相邻线程读相邻地址，立刻合并。</p>
<pre class="code" data-lang="cpp"><code>// 反例：相邻线程相隔 N 个 float，N=32 时每次只用到 1/8 带宽
out[tid] = A[tid * N];

// 正例：相邻线程读相邻地址，一个 Warp 合并成 128 B
for (int j = threadIdx.x; j &lt; N; j += blockDim.x) {
    out[row * N + j] = in[row * N + j];
}</code></pre>
<p>更通用的做法是 shared memory tiling：先按行合并地把一块 tile 搬进 shared memory，再从片上转置读取。这样全局访问是合并的，转置的代价留在片上。注意 shared memory 自己也有冲突问题，见下一节；两件事不要混为一谈。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>判断合并访问看两个数：每个 Warp 请求平均触及多少 sector（理想是 4 个），以及实际搬运字节除以有效字节。Nsight Compute 里常用 l1tex__t_sectors_pipe_lsu_mem_global_op_ld.sum 与 l1tex__t_requests_pipe_lsu_mem_global_op_ld.sum 的比值。</div></div>
<p>还要区分“合并差”和“缓存未命中”。合并差不一定立刻变慢，如果数据恰好在 L2 且被其他 Warp 复用，可能还能接受；但 streaming 大数组没有复用，合并差就是实打实的 HBM 带宽浪费。判断前先看数据访问是否真的只发生一次。</p>
</section>

<section class="sec">
<h2>Bank conflict：shared memory 的隐藏税</h2>
<p>shared memory 被切成 32 个 bank，每个 bank 宽 4 B，按 4 B 字编址。地址到 bank 的映射可以近似写成 bank = (addr ÷ 4) mod 32。一个 Warp 的 32 个线程如果访问 32 个不同 bank，一次完成；如果多个线程访问同一 bank 的不同地址，硬件就把这些访问串行化，这就是 bank conflict。注意同一地址的访问会广播（broadcast），不算冲突。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="Bank conflict 示意：步长 32 个 float 时全部命中 bank 0，padding 后分散到不同 bank" font-family="inherit">
<defs>
<marker id="memory-hierarchy-arrow-4" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
<path d="M0,0 L8,3 L0,6 Z" fill="var(--sv-c)"/>
</marker>
<marker id="memory-hierarchy-arrow-4b" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
<path d="M0,0 L8,3 L0,6 Z" fill="var(--sv-a)"/>
</marker>
</defs>
<text x="380" y="24" text-anchor="middle" font-size="15" fill="var(--sv-ink)">Bank conflict：32 个访问落到同一 bank 就只能串行</text>

<rect x="20" y="38" width="350" height="330" rx="6" fill="var(--sv-panel)" fill-opacity="0.45" stroke="var(--sv-line)"/>
<text x="195" y="62" text-anchor="middle" font-size="14" fill="var(--sv-ink)">步长 32 个 float：32 路冲突</text>
<g fill="var(--sv-b)" fill-opacity="0.3" stroke="var(--sv-b)">
<rect x="35" y="84" width="80" height="20" rx="3"/>
<rect x="35" y="112" width="80" height="20" rx="3"/>
<rect x="35" y="140" width="80" height="20" rx="3"/>
<rect x="35" y="168" width="80" height="20" rx="3"/>
<rect x="35" y="196" width="80" height="20" rx="3"/>
<rect x="35" y="224" width="80" height="20" rx="3"/>
</g>
<g font-size="12" fill="var(--sv-ink)" text-anchor="middle">
<text x="75" y="98">T0</text>
<text x="75" y="126">T1</text>
<text x="75" y="154">T2</text>
<text x="75" y="182">T3</text>
<text x="75" y="210">T4</text>
<text x="75" y="238">T5</text>
</g>
<g stroke="var(--sv-c)" stroke-width="1.2" marker-end="url(#memory-hierarchy-arrow-4)">
<line x1="115" y1="94" x2="45" y2="298"/>
<line x1="115" y1="122" x2="45" y2="298"/>
<line x1="115" y1="150" x2="45" y2="298"/>
<line x1="115" y1="178" x2="45" y2="298"/>
<line x1="115" y1="206" x2="45" y2="298"/>
<line x1="115" y1="234" x2="45" y2="298"/>
</g>
<text x="150" y="260" font-size="12" fill="var(--sv-muted)">其余线程同理</text>
<g fill="var(--sv-b)" fill-opacity="0.25" stroke="var(--sv-line)">
<rect x="35" y="300" width="9" height="24"/>
<rect x="45" y="300" width="9" height="24"/>
<rect x="55" y="300" width="9" height="24"/>
<rect x="65" y="300" width="9" height="24"/>
<rect x="75" y="300" width="9" height="24"/>
<rect x="85" y="300" width="9" height="24"/>
<rect x="95" y="300" width="9" height="24"/>
<rect x="105" y="300" width="9" height="24"/>
<rect x="115" y="300" width="9" height="24"/>
<rect x="125" y="300" width="9" height="24"/>
<rect x="135" y="300" width="9" height="24"/>
<rect x="145" y="300" width="9" height="24"/>
<rect x="155" y="300" width="9" height="24"/>
<rect x="165" y="300" width="9" height="24"/>
<rect x="175" y="300" width="9" height="24"/>
<rect x="185" y="300" width="9" height="24"/>
<rect x="195" y="300" width="9" height="24"/>
<rect x="205" y="300" width="9" height="24"/>
<rect x="215" y="300" width="9" height="24"/>
<rect x="225" y="300" width="9" height="24"/>
<rect x="235" y="300" width="9" height="24"/>
<rect x="245" y="300" width="9" height="24"/>
<rect x="255" y="300" width="9" height="24"/>
<rect x="265" y="300" width="9" height="24"/>
<rect x="275" y="300" width="9" height="24"/>
<rect x="285" y="300" width="9" height="24"/>
<rect x="295" y="300" width="9" height="24"/>
<rect x="305" y="300" width="9" height="24"/>
<rect x="315" y="300" width="9" height="24"/>
<rect x="325" y="300" width="9" height="24"/>
<rect x="335" y="300" width="9" height="24"/>
<rect x="345" y="300" width="9" height="24"/>
</g>
<text x="39" y="342" font-size="12" fill="var(--sv-muted)">bank 0</text>
<text x="195" y="342" text-anchor="middle" font-size="12" fill="var(--sv-muted)">32 个 bank</text>
<text x="340" y="342" text-anchor="end" font-size="12" fill="var(--sv-muted)">bank 31</text>
<text x="195" y="360" text-anchor="middle" font-size="12" fill="var(--sv-ink)">32 个不同地址 → 同一 bank → 串行 32 次</text>

<rect x="390" y="38" width="350" height="330" rx="6" fill="var(--sv-panel)" fill-opacity="0.45" stroke="var(--sv-line)"/>
<text x="565" y="62" text-anchor="middle" font-size="14" fill="var(--sv-ink)">步长 33 个 float：无冲突</text>
<g fill="var(--sv-a)" fill-opacity="0.3" stroke="var(--sv-a)">
<rect x="405" y="84" width="80" height="20" rx="3"/>
<rect x="405" y="112" width="80" height="20" rx="3"/>
<rect x="405" y="140" width="80" height="20" rx="3"/>
<rect x="405" y="168" width="80" height="20" rx="3"/>
<rect x="405" y="196" width="80" height="20" rx="3"/>
<rect x="405" y="224" width="80" height="20" rx="3"/>
</g>
<g font-size="12" fill="var(--sv-ink)" text-anchor="middle">
<text x="445" y="98">T0</text>
<text x="445" y="126">T1</text>
<text x="445" y="154">T2</text>
<text x="445" y="182">T3</text>
<text x="445" y="210">T4</text>
<text x="445" y="238">T5</text>
</g>
<g stroke="var(--sv-a)" stroke-width="1.2" marker-end="url(#memory-hierarchy-arrow-4b)">
<line x1="485" y1="94" x2="410" y2="298"/>
<line x1="485" y1="122" x2="421" y2="298"/>
<line x1="485" y1="150" x2="432" y2="298"/>
<line x1="485" y1="178" x2="443" y2="298"/>
<line x1="485" y1="206" x2="454" y2="298"/>
<line x1="485" y1="234" x2="465" y2="298"/>
</g>
<g fill="var(--sv-a)" fill-opacity="0.25" stroke="var(--sv-line)">
<rect x="405" y="300" width="9" height="24"/>
<rect x="415" y="300" width="9" height="24"/>
<rect x="425" y="300" width="9" height="24"/>
<rect x="435" y="300" width="9" height="24"/>
<rect x="445" y="300" width="9" height="24"/>
<rect x="455" y="300" width="9" height="24"/>
<rect x="465" y="300" width="9" height="24"/>
<rect x="475" y="300" width="9" height="24"/>
<rect x="485" y="300" width="9" height="24"/>
<rect x="495" y="300" width="9" height="24"/>
<rect x="505" y="300" width="9" height="24"/>
<rect x="515" y="300" width="9" height="24"/>
<rect x="525" y="300" width="9" height="24"/>
<rect x="535" y="300" width="9" height="24"/>
<rect x="545" y="300" width="9" height="24"/>
<rect x="555" y="300" width="9" height="24"/>
<rect x="565" y="300" width="9" height="24"/>
<rect x="575" y="300" width="9" height="24"/>
<rect x="585" y="300" width="9" height="24"/>
<rect x="595" y="300" width="9" height="24"/>
<rect x="605" y="300" width="9" height="24"/>
<rect x="615" y="300" width="9" height="24"/>
<rect x="625" y="300" width="9" height="24"/>
<rect x="635" y="300" width="9" height="24"/>
<rect x="645" y="300" width="9" height="24"/>
<rect x="655" y="300" width="9" height="24"/>
<rect x="665" y="300" width="9" height="24"/>
<rect x="675" y="300" width="9" height="24"/>
<rect x="685" y="300" width="9" height="24"/>
<rect x="695" y="300" width="9" height="24"/>
<rect x="705" y="300" width="9" height="24"/>
<rect x="715" y="300" width="9" height="24"/>
</g>
<text x="409" y="342" font-size="12" fill="var(--sv-muted)">bank 0</text>
<text x="565" y="342" text-anchor="middle" font-size="12" fill="var(--sv-muted)">32 个 bank</text>
<text x="710" y="342" text-anchor="end" font-size="12" fill="var(--sv-muted)">bank 31</text>
<text x="565" y="360" text-anchor="middle" font-size="12" fill="var(--sv-ink)">每个线程落到不同 bank → 一次完成</text>
</svg>
<figcaption>图 4 · 步长 32 造成 32 路 bank conflict，padding 到 33 后冲突消失</figcaption>
</figure>
<p>最常见触发方式是二维 tile 的列访问。声明 float tile[32][32]，线程 tid 读 tile[tid][0]，地址步长是 32 个 float，所有线程落到同一个 bank，形成 32 路冲突，原本 1 个周期的访问变成 32 个周期。把数组改成 float tile[32][33]，每行多一个 padding，列访问的 bank 就变成 (tid×33) mod 32 = tid，冲突消失。代价是每行浪费 4 B，通常完全值得。</p>
<div class="duo"><div class="duo__col"><h4>合并访问（全局内存）</h4><p>关心一个 Warp 的地址是否落在少数 32 B sector 内。浪费表现为多读 HBM 或 L2，代价按字节计。</p></div><div class="duo__col"><h4>Bank conflict（shared memory）</h4><p>关心 32 个线程是否映射到 32 个不同 bank。浪费表现为 shared memory 访问被串行化，代价按周期计。</p></div></div>
<p>两者常同时出现：transpose kernel 全局读是合并的，写回 shared memory 时却可能冲突。解决思路一致，让同一时刻的 32 个访问分散到不同资源上。更复杂的 swizzle 布局（按位异或重排）在 CUTLASS 等库中大量使用，这里不展开，具体 kernel 手法见 kernel-optimization。</p>
</section>

<section class="sec">
<h2>L2、持久化与容量：先把 OOM 算清楚</h2>
<p>L2 是全芯片共享的片上缓存，A100 为 40 MB，H100/H200 为 50 MB，B200 约 126 MB。它有两个作用：一是吸收多个 SM 对同一数据的重复访问，二是把部分 HBM 流量挡在片外。L2 带宽通常是 HBM 的数倍，延迟约 200 周期。对于 embedding 表、小矩阵、跨 block 复用的权重，L2 命中率往往决定实际性能。</p>
<p>CUDA 提供 L2 persistence：用 cudaDeviceSetLimit(cudaLimitPersistingL2CacheSize, N) 预留一段 L2，再用 stream 的 accessPolicyWindow 把某个地址区间标记为 cudaAccessPropertyPersisting。它适合“反复读、体积不大”的数据，例如推理中的部分权重。注意它是尽力而为（best effort），预留过多反而挤掉正常缓存；任务结束可用 cudaCtxResetPersistingL2Cache 归还。</p>
<pre class="code" data-lang="bash"><code># 查看显存占用与容量，字段名随驱动版本略有差异
nvidia-smi --query-gpu=name,memory.total,memory.used --format=csv

# L2 命中率与 sector 效率交给 Nsight Compute
ncu --metrics lts__t_sector_hit_rate.pct ./my_kernel</code></pre>
<p>容量问题在推理里最尖锐的是 KV Cache（键值缓存）。每个 token 的 K 和 V 都要保存，显存随上下文长度和并发数线性增长。估算公式如下，其中 L 是层数，H_kv 是 KV 头数（GQA 下远小于 Q 头数），d_head 是每头维度，S 是序列长度，B 是并发序列数，b 是每个元素的字节数。</p>
<div class="formula">M_KV = 2 × L × H_kv × d_head × S × B × b</div>
<p>以 Llama-2-7B 为例：L=32、H_kv=32、d_head=128、S=4096、b=2，单条序列约 2.0 GiB；若并发 32 条，就是 64 GiB，再加上约 14 GB 权重和激活，80 GB 卡直接放不下。换成分组查询的 70B（L=80、H_kv=8），单条 4k 序列约 1.25 GiB，这就是 GQA（Grouped-Query Attention，分组查询注意力）的容量价值。把公式里的 B 改成实际并发，就能在部署前判断需不需要张量并行或 PagedAttention（分页注意力）。</p>
<pre class="code" data-lang="python"><code>def kv_cache_gib(layers, kv_heads, head_dim, seq_len, batch, bytes_per_elem=2):
    # K 和 V 各存一份，所以最前面乘以 2
    elems = 2 * layers * kv_heads * head_dim * seq_len * batch
    return elems * bytes_per_elem / 1024 ** 3

print(kv_cache_gib(32, 32, 128, 4096, 1))  # 约 2.0 GiB
print(kv_cache_gib(80, 8, 128, 4096, 1))   # 约 1.25 GiB</code></pre>
<div class="callout callout--warn"><span class="callout__label">警告</span><div>“显存墙”的表现不只是 OOM：还包括 batch size 被迫降到 1、KV Cache 频繁换入换出、paged attention 的 block 碎片，以及多卡时每卡容量不均导致的负载倾斜。看到吞吐随并发数突然不涨，先查显存而不是查算力。</div></div>
</section>

<section class="sec">
<h2>工程实践：一份排障顺序</h2>
<p>遇到“kernel 很慢”，不要一上来就改代码。先确认瓶颈层级，再决定优化方向。下面这个顺序覆盖了大多数情况，也适用于推理服务的容量排查。</p>
<ol>
<li>看显存占用与容量：用 nvidia-smi 确认是否接近上限、是否有其他进程占用，以及是否出现 XID 或 ECC 报错。</li>
<li>看瓶颈类型：用 Nsight Compute 的 Speed of Light 面板判断是 compute、memory 还是 latency bound。</li>
<li>看全局访问效率：sectors per request 是否远大于 4，L2 命中率是否异常低。</li>
<li>看 shared memory：bank conflict 计数、shared load/store 吞吐是否成为瓶颈。</li>
<li>最后才看指令级优化：向量化、循环展开、异步拷贝。</li>
</ol>
<pre class="code" data-lang="bash"><code>ncu --set full --kernel-name my_kernel ./app
# 重点看 Memory Throughput、L2 Hit Rate、Warp Stall Reasons、Bank Conflicts</code></pre>
<p>几个常见误区值得单独点出。第一，“带宽峰值可达”不等于“我的 kernel 能到”，实际有效带宽常是峰值的 60% 到 80%。第二，寄存器越多不一定越好，占用率下降可能让延迟藏不住。第三，L2 持久化不是免费午餐，预留过大可能让其他数据频繁 miss。第四，A100 与 H100 的 L1/shared 合并空间上限不同（192 KB 对 256 KB），按 A100 调好的 tile 搬到 H100 未必最优。第五，跨 NUMA 或跨卡访问的瓶颈可能根本不在 HBM，而在 NVLink 或 PCIe。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>做容量规划时，用“权重大小 + KV Cache + 激活峰值 + 框架开销”四项相加，再留 10% 到 20% 余量。框架和通信 buffer 经常被低估，尤其是多卡训练时的梯度与优化器状态。</div></div>
</section>

<section class="sec">
<h2>自测</h2>
<details class="quiz"><summary>Q1 · 一个 Warp 的 32 个线程各读 4 B 连续数据，理想情况下产生几个 32 B sector？如果步长改为 32 个 float 呢？</summary><div class="quiz__a">连续时 128 B 覆盖 4 个 sector，一次请求；步长 32 个 float 时相邻线程相差 128 B，每个线程落在不同 sector，共 32 个 sector，搬运 1024 B，有效利用率 12.5%。</div></details>
<details class="quiz"><summary>Q2 · shared memory 中 float tile[32][32]，线程 tid 访问 tile[tid][0]，为什么冲突？怎么改？</summary><div class="quiz__a">地址步长 32 个 float，bank = (tid×32) mod 32 = 0，32 个线程全部命中 bank 0，串行 32 次。改成 tile[32][33] 后 bank = (tid×33) mod 32 = tid，无冲突，代价是每行 4 B padding。</div></details>
<details class="quiz"><summary>Q3 · Llama-2-7B（32 层、32 个 KV 头、head_dim=128）在 FP16、4k 上下文、并发 16 时，KV Cache 约多大？</summary><div class="quiz__a">单条 = 2×32×32×128×4096×2 B ≈ 2.0 GiB；并发 16 条约 32 GiB。加上约 14 GB 权重，80 GB 卡仍可放下，但余量已经不多，还要把激活和框架开销算进去。</div></details>
<details class="quiz"><summary>Q4 · 为什么自回归 decode 通常先撞带宽墙而不是算力墙？</summary><div class="quiz__a">每生成一个 token 要把全部权重读一遍，但每个权重只参与少量乘加，算术强度约 1 到 2 FLOP/B，远低于 A100 约 153 FLOP/B 的脊点，因此受 HBM 带宽限制；增大 batch 提高权重复用后，才会逐渐转向算力受限。</div></details>
</section>

<section class="sec">
<h2>延伸阅读</h2>
<ul class="refs">
<li><b>NVIDIA A100 Tensor Core GPU Architecture</b> — NVIDIA, 2020。给出 2.0 TB/s HBM2e、19 TB/s 聚合 SRAM 带宽与 40 MB L2 的官方口径。</li>
<li><b>NVIDIA H100 Tensor Core GPU Architecture</b> — NVIDIA, 2022。H100 的 3.35 TB/s HBM3、50 MB L2 与 256 KB L1/shared 的权威来源。</li>
<li><b>Micron HBM3E Product Brief</b> — Micron, 2024。从 DRAM 厂商视角解释 HBM3e 的堆叠层数、速率与能效。</li>
<li><b>CUDA C++ Best Practices Guide</b> — NVIDIA, 持续更新。合并访问、shared memory、占用率的官方实践建议。</li>
<li><b>Roofline: An Insightful Visual Performance Model for Multicore Architectures</b> — Williams, Waterman, Patterson, CACM 2009。算术强度与脊点模型的原始论文。</li>
</ul>
</section>`
};
