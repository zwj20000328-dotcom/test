window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["gpu-architecture"] = {
  slug: "gpu-architecture",
  title: "GPU 微架构：SM、Warp 与 Tensor Core",
  subtitle: "理解 GPU 为什么快，以及什么时候不快",
  level: 1,
  cluster: "硬件",
  tags: ["SIMT", "SM", "Tensor Core", "Occupancy"],
  summary: "从 SIMT 执行模型出发，拆解 SM 结构、Warp 调度与延迟隐藏，实算 occupancy，讲清 Tensor Core、稀疏与降频的边界。",
  keyPoints: [
    "thread/block/grid 如何映射到 SM 与 Warp，为什么 Warp 是真正的调度单位",
    "SM 的四个 sub-partition、寄存器堆、shared memory/L1 与 Warp scheduler 的分工",
    "用寄存器与 shared memory 实算 occupancy，理解延迟隐藏需要多少 Warp",
    "Tensor Core MMA 的 tile 数据流，以及 A100 到 B200 的 BF16 峰值、稀疏与降频影响"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>先记住一句话：GPU 用并行藏延迟</h2>
<p>CPU 和 GPU 的第一性差异不在时钟频率。2020 年发布的 A100 加速卡 boost 时钟约 1.41 GHz，同期桌面 CPU 可以跑到 5 GHz 以上；但 A100 的 FP32 峰值约 19.5 TFLOPS，是同期高端桌面 CPU 的十几倍。差距来自结构选择：CPU 把大量晶体管花在缓存、乱序执行和分支预测上，让<mark>单个线程尽量快</mark>；GPU 则把这些资源换成成千上万个线程和算术单元，让<mark>很多线程同时慢一点</mark>。</p>
<p>这套选择成立的前提是：程序里有大量互相独立的工作。矩阵乘的每个输出元素、卷积的每个输出像素、注意力的每个 (query, key) 对，都天然可并行。GPU 的微架构就是围绕“如何把独立工作填满执行单元”设计的：用 Warp 批量发射，用多级调度切换，用寄存器保存上下文，最终把访存和流水线延迟藏在其他 Warp 的计算后面。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>把 SM 想成一家有 4 条装配线的工厂，Warp 是 32 人一组的施工队。某个队员去仓库取料（访存）时，整队要一起等；但工头可以立刻换另一队上来干活。工厂快不快，取决于同时有多少队在待命，以及每队拿料要等多久。</div></div>
<p>下面从线程映射讲到 SM、Warp 调度、occupancy、Tensor Core 与降频。CUDA 编程接口不在本篇展开，见 cuda-model。</p>
</section>

<section class="sec">
<h2>从 grid 到 Warp：线程怎样落到硬件</h2>
<p>CUDA 用三层抽象组织并行：<b>grid</b> 是一次 kernel 启动的全部工作，<b>block</b> 是其中一组可协作的线程，<b>thread</b> 是最小执行实体。硬件映射的关键约束只有一条：<mark>一个 block 整体驻留在一个 SM 上，绝不跨 SM</mark>；一个 SM 可以同时驻留多个 block。grid 只是 block 的集合，由硬件调度器分发给有空闲资源的 SM，顺序不保证。</p>
<p>进入 SM 后，block 内的线程按线性编号 <code>tid = threadIdx.x + blockDim.x * (threadIdx.y + blockDim.y * threadIdx.z)</code> 每 32 个一组，切成 <b>Warp</b>（线程束）。Warp 才是硬件调度、发射、寄存器分配和访存合并的基本单位，编程模型里并没有“Warp”这个类型。一个 256 线程的 block 固定产生 8 个 Warp，最后不满 32 的 block 也会占满一个 Warp 的槽位，其余 lane 被屏蔽。</p>
<p>这个映射解释了两个常见现象。第一，<code>threadIdx.x</code> 连续的线程落在同一 Warp 内，所以让相邻线程访问相邻地址，才能合并成少量内存事务；如果按列访问，32 个线程会散到 32 条 cache line 上，带宽浪费最多可达 32 倍（机制见 memory-hierarchy）。第二，block 大小影响驻留粒度：block 太大，SM 剩余资源放不下第二个，尾部就会出现“一个 block 占着 SM 但只用了少数执行单元”的碎片。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>把 block 大小取为 32 的整数倍只是及格线。工程上更常用 128 或 256 线程：既能凑满 4 个 sub-partition，又不会因为单个 block 太大而降低调度灵活性。真正的取舍要用 occupancy 计算和 profiler 验证，不能拍脑袋。</div></div>
</section>

<section class="sec">
<h2>SM 内部：四个 sub-partition 与两种片上存储</h2>
<p><b>SM</b>（Streaming Multiprocessor）是 GPU 的核心模块，A100 有 108 个，H100 SXM 有 132 个，H200 与 H100 相同，B200 则用双 die 封装把规模继续推高。一个 SM 内部通常划分为 4 个 <b>sub-partition</b>（也称 processing block），每个 sub-partition 拥有独立的 Warp scheduler、指令分发单元、寄存器堆切片和执行通道。这种“四分”结构意味着：一个 block 的 Warp 会被轮流分到 4 个 sub-partition 上，只有 Warp 数量足够，4 条流水线才都不会饿着。</p>
<p>每个 sub-partition 的关键资源包括：一个 Warp scheduler（每周期最多选 1 个 Warp 发射指令）、一个 16K×32-bit 的寄存器堆切片（Volta 及以后每 SM 共 4 个切片，合计 256 KB 寄存器）、若干 FP32/INT32 执行通道，以及一个 Tensor Core（Volta 每 sub-partition 2 个，Ampere 起 1 个）。A100 每个 sub-partition 是 16 个 FP32 加 16 个 INT32 通道，H100 提升到 32 个 FP32 通道；数量随代际变化，但“4 个调度器、每周期各发 1 条”的骨架长期稳定。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="SM 内部结构框图：四个 sub-partition、Warp scheduler、寄存器堆、执行通道、Tensor Core 与共享的 Shared Memory/L1">
<defs>
<marker id="gpu-architecture-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
<path d="M 0 0 L 10 5 L 0 10 z" fill="var(--sv-line)"/>
</marker>
</defs>
<rect x="30" y="20" width="700" height="280" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="46" y="44" font-size="14" font-weight="600" fill="var(--sv-ink)" font-family="inherit">SM（Streaming Multiprocessor）</text>
<rect x="48" y="54" width="150" height="168" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="58" y="73" font-size="12" fill="var(--sv-muted)" font-family="inherit">Sub-partition 0</text>
<rect x="56" y="81" width="134" height="26" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="123" y="98" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Warp Scheduler</text>
<rect x="56" y="113" width="134" height="26" rx="4" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="123" y="130" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">寄存器堆 16K×32b</text>
<rect x="56" y="145" width="134" height="26" rx="4" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="123" y="162" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">FP32 / INT32 通道</text>
<rect x="56" y="177" width="134" height="26" rx="4" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="123" y="194" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Tensor Core</text>
<rect x="214" y="54" width="150" height="168" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="224" y="73" font-size="12" fill="var(--sv-muted)" font-family="inherit">Sub-partition 1</text>
<rect x="222" y="81" width="134" height="26" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="289" y="98" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Warp Scheduler</text>
<rect x="222" y="113" width="134" height="26" rx="4" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="289" y="130" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">寄存器堆 16K×32b</text>
<rect x="222" y="145" width="134" height="26" rx="4" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="289" y="162" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">FP32 / INT32 通道</text>
<rect x="222" y="177" width="134" height="26" rx="4" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="289" y="194" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Tensor Core</text>
<rect x="380" y="54" width="150" height="168" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="390" y="73" font-size="12" fill="var(--sv-muted)" font-family="inherit">Sub-partition 2</text>
<rect x="388" y="81" width="134" height="26" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="455" y="98" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Warp Scheduler</text>
<rect x="388" y="113" width="134" height="26" rx="4" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="455" y="130" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">寄存器堆 16K×32b</text>
<rect x="388" y="145" width="134" height="26" rx="4" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="455" y="162" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">FP32 / INT32 通道</text>
<rect x="388" y="177" width="134" height="26" rx="4" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="455" y="194" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Tensor Core</text>
<rect x="546" y="54" width="150" height="168" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="556" y="73" font-size="12" fill="var(--sv-muted)" font-family="inherit">Sub-partition 3</text>
<rect x="554" y="81" width="134" height="26" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="621" y="98" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Warp Scheduler</text>
<rect x="554" y="113" width="134" height="26" rx="4" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="621" y="130" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">寄存器堆 16K×32b</text>
<rect x="554" y="145" width="134" height="26" rx="4" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="621" y="162" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">FP32 / INT32 通道</text>
<rect x="554" y="177" width="134" height="26" rx="4" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="621" y="194" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Tensor Core</text>
<rect x="48" y="238" width="648" height="36" rx="6" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="372" y="261" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Shared Memory / L1：同一块 SRAM，按 carveout 配置划分</text>
<line x1="372" y1="274" x2="372" y2="326" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#gpu-architecture-arrow)"/>
<rect x="236" y="326" width="272" height="30" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="372" y="346" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">L2（片上）/ HBM（片外）</text>
</svg>
<figcaption>图 1 · A100/Hopper 代 SM 的典型组织：4 个 sub-partition 各带调度器、寄存器切片与 Tensor Core，共享一块可配置的 shared memory/L1</figcaption>
</figure>
<p>片上存储分两类。<b>寄存器</b>是每线程私有的，编译器把局部变量、循环计数和 MMA 的输入片段放进去；它最快，但每线程最多 255 个寄存器，且按 Warp 粒度分配。A100 的 256 KB 寄存器堆对应 65536 个 32-bit 寄存器，一个 256 线程、每线程 64 寄存器的 block 就要吃掉 16384 个，这直接决定能同时驻留几个 block。<b>shared memory/L1</b> 是同一块物理 SRAM 的两种用途，A100 合计 192 KB（shared 最多可配到 164 KB），H100 合计 256 KB（shared 最多 228 KB），两者此消彼长。shared memory 常用来缓存 tile 和做 Warp 间协作，L1 则服务普通全局访存；具体带宽、bank 冲突与合并访问在 memory-hierarchy 展开。</p>
<p>还要注意“粒度税”：寄存器按 Warp 分配，A100 上以 256 个寄存器为一步（相当于每线程 8 个）；shared memory 按 block 分配，以 128 B 为一步。更隐蔽的是 L1/shared 的 carveout 只能取离散档位（A100 为 0、8、16、32、64、100、132、164 KB），一个 block 申请略超 100 KB，就会整体落到 132 KB 档，L1 相应缩水。不把这些约束算进去，纸面能放 4 个 block，实际可能只放得下 3 个。</p>
</section>

<section class="sec">
<h2>Warp 锁步、分支发散与调度时间线</h2>
<p><b>SIMT</b>（Single Instruction, Multiple Threads）是 GPU 的执行模型：一条指令作用于 Warp 内的 32 个 lane，每个 lane 有自己的寄存器；取指、译码和发射由 Warp 统一完成。理想情况下 32 个线程执行同一条指令，硬件只需取指、译码一次，就能驱动 32 路运算，这正是 GPU 面积效率的来源。但“锁步”不等于“永远一致”：一旦 Warp 内线程走不同分支，硬件会按路径串行执行，每次只激活一部分 lane，其余屏蔽，这叫<b>分支发散</b>（branch divergence）。</p>
<p>从 Volta 起，NVIDIA 引入了 independent thread scheduling（独立线程调度），每个线程有独立的 PC，可以在细粒度上重新汇合，但发散本身仍要付出串行代价。一个 <code>if (tid % 2)</code> 让奇偶线程走不同路径，Warp 就要执行两遍，吞吐减半；如果 32 个线程各走各的路径，最坏要串行 32 次。对策是让分支在 Warp 粒度上一致：按 block 或 Warp 划分任务，避免相邻线程进入不同分支。</p>
<p>Warp 什么时候能发射，由 sub-partition 的 <b>Warp scheduler</b> 每个周期决定。它从驻留的 Warp 中挑一个“就绪”的：没有等待访存结果、没有等待上一条指令的运算结果、没有遇到屏障。被选中的 Warp 发射 1 条指令，其余 Warp 继续等。典型 stall 来源有四类：长延迟访存（全局或纹理，数百 cycle）、固定延迟的算术依赖（约 4 到 20 cycle）、同步与屏障（<code>__syncthreads</code> 等，具体接口见 cuda-model）、以及指令缓存与分支开销。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="Warp 发射与 stall 时间线：4 个 Warp 在 16 个周期内交替发射和等待，调度器跳过 stall 的 Warp，c6 与 c13 出现发射空泡">
<text x="30" y="30" font-size="13" font-weight="600" fill="var(--sv-ink)" font-family="inherit">每个周期从 4 个 Warp 中选 1 个发射</text>
<rect x="30" y="44" width="16" height="14" rx="3" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="54" y="56" font-size="12" fill="var(--sv-muted)" font-family="inherit">发射（issue）</text>
<rect x="160" y="44" width="16" height="14" rx="3" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="184" y="56" font-size="12" fill="var(--sv-muted)" font-family="inherit">stall（等待依赖）</text>
<text x="30" y="102" font-size="13" fill="var(--sv-ink)" font-family="inherit">Warp 0</text>
<text x="30" y="148" font-size="13" fill="var(--sv-ink)" font-family="inherit">Warp 1</text>
<text x="30" y="194" font-size="13" fill="var(--sv-ink)" font-family="inherit">Warp 2</text>
<text x="30" y="240" font-size="13" fill="var(--sv-ink)" font-family="inherit">Warp 3</text>
<rect x="110" y="80" width="34" height="28" fill="var(--sv-a)" stroke="var(--sv-line)"/><text x="127" y="99" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">I</text>
<rect x="146" y="80" width="34" height="28" fill="var(--sv-a)" stroke="var(--sv-line)"/><text x="163" y="99" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">I</text>
<rect x="182" y="80" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="199" y="99" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="218" y="80" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="235" y="99" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="254" y="80" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="271" y="99" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="290" y="80" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="307" y="99" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="326" y="80" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="343" y="99" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="362" y="80" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="379" y="99" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="398" y="80" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="415" y="99" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="434" y="80" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="451" y="99" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="470" y="80" width="34" height="28" fill="var(--sv-a)" stroke="var(--sv-line)"/><text x="487" y="99" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">I</text>
<rect x="506" y="80" width="34" height="28" fill="var(--sv-a)" stroke="var(--sv-line)"/><text x="523" y="99" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">I</text>
<rect x="542" y="80" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="559" y="99" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="578" y="80" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="595" y="99" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="614" y="80" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="631" y="99" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="650" y="80" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="667" y="99" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="110" y="126" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="127" y="145" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="146" y="126" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="163" y="145" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="182" y="126" width="34" height="28" fill="var(--sv-a)" stroke="var(--sv-line)"/><text x="199" y="145" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">I</text>
<rect x="218" y="126" width="34" height="28" fill="var(--sv-a)" stroke="var(--sv-line)"/><text x="235" y="145" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">I</text>
<rect x="254" y="126" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="271" y="145" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="290" y="126" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="307" y="145" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="326" y="126" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="343" y="145" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="362" y="126" width="34" height="28" fill="var(--sv-a)" stroke="var(--sv-line)"/><text x="379" y="145" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">I</text>
<rect x="398" y="126" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="415" y="145" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="434" y="126" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="451" y="145" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="470" y="126" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="487" y="145" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="506" y="126" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="523" y="145" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="542" y="126" width="34" height="28" fill="var(--sv-a)" stroke="var(--sv-line)"/><text x="559" y="145" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">I</text>
<rect x="578" y="126" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="595" y="145" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="614" y="126" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="631" y="145" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="650" y="126" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="667" y="145" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="110" y="172" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="127" y="191" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="146" y="172" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="163" y="191" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="182" y="172" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="199" y="191" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="218" y="172" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="235" y="191" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="254" y="172" width="34" height="28" fill="var(--sv-a)" stroke="var(--sv-line)"/><text x="271" y="191" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">I</text>
<rect x="290" y="172" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="307" y="191" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="326" y="172" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="343" y="191" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="362" y="172" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="379" y="191" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="398" y="172" width="34" height="28" fill="var(--sv-a)" stroke="var(--sv-line)"/><text x="415" y="191" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">I</text>
<rect x="434" y="172" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="451" y="191" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="470" y="172" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="487" y="191" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="506" y="172" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="523" y="191" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="542" y="172" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="559" y="191" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="578" y="172" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="595" y="191" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="614" y="172" width="34" height="28" fill="var(--sv-a)" stroke="var(--sv-line)"/><text x="631" y="191" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">I</text>
<rect x="650" y="172" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="667" y="191" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="110" y="218" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="127" y="237" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="146" y="218" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="163" y="237" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="182" y="218" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="199" y="237" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="218" y="218" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="235" y="237" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="254" y="218" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="271" y="237" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="290" y="218" width="34" height="28" fill="var(--sv-a)" stroke="var(--sv-line)"/><text x="307" y="237" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">I</text>
<rect x="326" y="218" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="343" y="237" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="362" y="218" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="379" y="237" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="398" y="218" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="415" y="237" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="434" y="218" width="34" height="28" fill="var(--sv-a)" stroke="var(--sv-line)"/><text x="451" y="237" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">I</text>
<rect x="470" y="218" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="487" y="237" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="506" y="218" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="523" y="237" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="542" y="218" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="559" y="237" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="578" y="218" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="595" y="237" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="614" y="218" width="34" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)"/><text x="631" y="237" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">M</text>
<rect x="650" y="218" width="34" height="28" fill="var(--sv-a)" stroke="var(--sv-line)"/><text x="667" y="237" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">I</text>
<text x="110" y="270" font-size="12" fill="var(--sv-muted)" font-family="inherit">0</text>
<text x="254" y="270" font-size="12" fill="var(--sv-muted)" font-family="inherit">4</text>
<text x="398" y="270" font-size="12" fill="var(--sv-muted)" font-family="inherit">8</text>
<text x="542" y="270" font-size="12" fill="var(--sv-muted)" font-family="inherit">12</text>
<text x="684" y="270" font-size="12" fill="var(--sv-muted)" font-family="inherit">16</text>
<text x="716" y="270" font-size="12" fill="var(--sv-muted)" font-family="inherit">cycle</text>
<line x1="110" y1="278" x2="684" y2="278" stroke="var(--sv-line)" stroke-width="1"/>
<text x="30" y="306" font-size="12" fill="var(--sv-ink)" font-family="inherit">c0–c1：W0 连续发射两条独立加载，随后进入长延迟 stall。</text>
<text x="30" y="330" font-size="12" fill="var(--sv-ink)" font-family="inherit">c2：调度器改发 W1；c6、c13 所有 Warp 都在等依赖，出现发射空泡。</text>
<text x="30" y="354" font-size="12" fill="var(--sv-muted)" font-family="inherit">I = 发射一条指令；M = 等待访存/依赖。每个 sub-partition 每周期最多发射 1 个 Warp。</text>
</svg>
<figcaption>图 2 · Warp 发射与 stall 时间线：调度器只发就绪 Warp，stall 的 Warp 被跳过；驻留 Warp 不足时，c6 与 c13 的空隙无法被填满</figcaption>
</figure>
<p><b>SIMT 与 SIMD 的区别</b>常被混淆。SIMD（如 x86 AVX）要求程序员显式使用向量寄存器，一条指令处理 4 或 8 个固定宽度的数据，分支要手动处理；SIMT 则让程序员写标量线程代码，由硬件把 32 个线程捆成 Warp，提供统一的“看似标量”的编程视图。代价是 Warp 内的控制流必须收敛，且访存要能合并。可以把 SIMT 理解为“带独立线程状态、由硬件自动向量化的 SIMD”，但 SIMT 的 lane 从 Volta 起有独立的程序计数器，可以各自屏蔽并重新汇合，传统 SIMD 的编程模型没有这层抽象。</p>
<div class="duo"><div class="duo__col"><h4>SIMT（GPU Warp）</h4><p>32 个 lane 共享取指与发射，寄存器按 lane 私有；分支发散时按路径串行、lane 屏蔽。程序员写标量代码，硬件负责打包。</p></div><div class="duo__col"><h4>SIMD（CPU AVX）</h4><p>一条指令显式操作 4/8/16 个通道，向量寄存器由程序员管理；没有 per-lane 分支，需手工掩码或分支到标量路径。</p></div></div>
<p>从时间线还能读出一个反直觉结论：<mark>“Warp 多”不等于“发射多”</mark>。如果所有 Warp 都在等同一个长延迟事件，调度器依然无活可干。真正决定利用率的是任一周期内“就绪 Warp”的数量，而这取决于独立访存的数量、依赖链长度和占用率三者共同作用。</p>
</section>

<section class="sec">
<h2>延迟隐藏与 occupancy：把等待填满</h2>
<p><b>Occupancy</b>（占用率）指一个 SM 上实际驻留的 Warp 数占硬件上限的比例。A100 与 H100 每个 SM 最多驻留 64 个 Warp（2048 个线程），所以 occupancy = 驻留 Warp 数 ÷ 64。它不是越高越好，但它决定了你有多少“备用施工队”可切换。计算时先看每 SM 的硬上限，再分别算寄存器、shared memory、block 数和 Warp 数四个约束，取最小值。</p>
<div class="formula">Occupancy = 驻留 Warp 数 ÷ 每 SM 最大 Warp 数（A100/H100 为 64）
寄存器上限 block 数 = ⌊65536 ÷ 每 block 实际占用寄存器数⌋（按 Warp 粒度取整）
shared 上限 block 数 = ⌊可用 shared memory ÷ 每 block 申请的 shared（含粒度取整）⌋
实际驻留 block 数 = min(寄存器上限, shared 上限, 每 SM block 上限, Warp 上限)
所需 Warp 数 ≈ 平均 stall 延迟(cycle) ÷ 每 Warp 平均发射间隔(cycle)</div>
<p>做一个实算。假设 block 为 256 线程，每线程用 64 个寄存器，每 block 申请 32 KB shared memory，目标卡是 A100（65536 个寄存器、最多 164 KB shared、每 SM 最多 32 个 block）。寄存器侧：256 × 64 = 16384，65536 ÷ 16384 = 4 个 block；shared 侧：⌊164 ÷ 32⌋ = 5 个 block；block 数上限 32。取最小值 4 个 block，即 1024 线程 = 32 个 Warp，occupancy = 32 ÷ 64 = 50%。若把每线程寄存器压到 32 个，shared 侧先卡在 5 个 block，occupancy 升到 62.5%，但可能 spill 到 local memory，得不偿失。</p>
<p>再看“需要多少 Warp 才够”。若一个 Warp 每 500 cycle 才完成一次依赖访存并重新就绪，那么单个 sub-partition 要维持每周期发射，理论上需要约 500 个可切换 Warp，而硬件只有 16 个槽位；这时提高 occupancy 也救不了，必须增加指令级并行（一次发出多个独立加载）、使用更宽/更合并的访问，或改用异步拷贝与流水线。反过来，若 stall 主要来自 4 cycle 的算术依赖，16 个 Warp 的满占用可以轻松覆盖，8 个 Warp（50%）也常常够用。这就是为什么 Tensor Core kernel 常在 25% 到 50% occupancy 下就跑满算力：MMA 指令吞吐高、依赖链被 tile 循环摊薄。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>occupancy 是手段不是指标。盲目追求 100% 会迫使编译器压低寄存器用量，引发 spill（溢出到 local memory），反而增加访存；正确做法是先确认瓶颈是延迟还是带宽，再用 profiler 的 achieved occupancy、stall reason 和 memory throughput 交叉验证。工具用法见 profiling 一篇。</div></div>
</section>

<section class="sec">
<h2>Tensor Core 与 MMA：一条指令做一个小矩阵乘</h2>
<p>普通 FP32 通道每个 cycle 做一次乘加，而 <b>Tensor Core</b> 是专用矩阵乘加单元。它从 Volta（2017）开始进入 SM；Ampere 起每个 sub-partition 一个，因此一个 SM 有 4 个。Ampere 起，Tensor Core 支持 BF16、TF32 等格式；BF16 与 FP32 同为 8 位指数，动态范围接近 FP32，尾数只有 7 位，适合深度学习对精度不敏感、但对范围敏感的场景。Tensor Core 的代价是数据必须按规定的 fragment 布局喂进去，且形状固定，这也解释了为什么 kernel 里大量出现 tile、swizzle 和 padding。</p>
<p>以 Ampere/Hopper 上常见的 <code>mma.m16n8k16</code> 为例：一次 Warp 级 MMA 计算 16×8 的输出 tile，K 维一次推进 16，即 16×8×16 = 2048 次乘加、4096 次浮点运算。一个 Warp 的 32 个 lane 共同持有操作数：A 片段 16×16 共 256 个元素，每线程 8 个；B 片段 16×8 共 128 个，每线程 4 个；累加器 D 为 16×8，每线程 4 个 FP32。指令发出后，Tensor Core 内部用乘加阵列在多个 cycle 内完成这批乘加（不同代际的流水深度不同）。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="Tensor Core MMA 的 tile 数据流：A 片段与 B 片段送入 Tensor Core 相乘，结果累加到 C tile，K 维分块推进">
<defs>
<marker id="gpu-architecture-arrow2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
<path d="M 0 0 L 10 5 L 0 10 z" fill="var(--sv-line)"/>
</marker>
</defs>
<rect x="30" y="52" width="190" height="90" rx="6" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="125" y="82" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">A 片段 16×16</text>
<text x="125" y="104" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">每线程 8 个 BF16</text>
<text x="125" y="124" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">来自寄存器 / ldmatrix</text>
<rect x="30" y="190" width="190" height="90" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="125" y="220" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">B 片段 16×8</text>
<text x="125" y="242" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">每线程 4 个 BF16</text>
<text x="125" y="262" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">K 维步长 16</text>
<rect x="290" y="100" width="190" height="130" rx="8" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="385" y="128" font-size="14" text-anchor="middle" font-weight="600" fill="var(--sv-ink)" font-family="inherit">Tensor Core</text>
<text x="385" y="154" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">D += A × B</text>
<text x="385" y="178" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">m16n8k16</text>
<text x="385" y="202" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">Warp 级指令，2048 次 MAC</text>
<rect x="550" y="110" width="180" height="110" rx="6" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="640" y="140" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">C / D tile 16×8</text>
<text x="640" y="164" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">每线程 4 个 FP32</text>
<text x="640" y="186" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">常驻寄存器累加</text>
<text x="640" y="208" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">K 循环结束后写回</text>
<line x1="220" y1="105" x2="286" y2="140" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#gpu-architecture-arrow2)"/>
<line x1="220" y1="235" x2="286" y2="192" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#gpu-architecture-arrow2)"/>
<line x1="480" y1="165" x2="546" y2="165" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#gpu-architecture-arrow2)"/>
<rect x="30" y="310" width="700" height="34" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="380" y="332" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">K = 0 → 16 → 32 → …：每步从 shared memory 取新 A/B 片段，C 在寄存器中持续累加</text>
<text x="30" y="300" font-size="12" fill="var(--sv-muted)" font-family="inherit">一个 Warp 负责一个 16×8 输出 tile；更大的输出 tile 由更多 Warp 或更多 MMA 拼成</text>
</svg>
<figcaption>图 3 · Tensor Core MMA 的 tile 数据流：A/B fragment 从寄存器送入，K 维按 16 分块累加，D 常驻寄存器，避免每一步都写回显存</figcaption>
</figure>
<p>把图 3 放回完整 kernel 就得到一条经典数据通路：全局显存 → shared memory（用异步拷贝掩盖延迟）→ 寄存器（用 <code>ldmatrix</code> 按 fragment 布局加载）→ Tensor Core MMA → 累加器 → epilogue 写回。真正限制性能的往往不是 MMA 指令本身，而是这条通路的供数能力。以 16×16×16 的 BF16 乘加为例，计算量 8192 FLOP，操作数 1024 字节，算术强度只有 8 FLOP/Byte，远低于 HBM 的机器平衡点；所以必须靠 shared memory 复用 tile，把有效算术强度抬上去。tiling、双缓冲和 Warp specialization 的具体做法留给 kernel-optimization。</p>
</section>

<section class="sec">
<h2>峰值、稀疏与降频：官方数字的口径</h2>
<p>峰值算力可以拆成三项：SM 数、每 SM 每 cycle 的浮点运算数、时钟。以 A100 80GB SXM 的 BF16 稠密峰值为例：108 个 SM × 2048 FLOP/cycle/SM × 1.41 GHz ≈ 312 TFLOPS。这里的 2048 来自 4 个 Tensor Core 的合计吞吐；若换成 FP32 非 Tensor 路径，每 SM 只有 128 FLOP/cycle，峰值降到约 19.5 TFLOPS，相差 16 倍。这解释了 Tensor Core 为何能拉开一个数量级。</p>
<div class="formula">峰值 FLOPS ≈ SM 数 × 每 SM 每 cycle FLOP × SM 时钟(Hz)
A100 BF16 稠密：108 × 2048 × 1.41×10⁹ ≈ 3.12×10¹⁴ = 312 TFLOPS
有效算力 ≈ 峰值 × (实际时钟 ÷ 峰值时钟) × Tensor Core 利用率</div>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>型号（SXM）</th><th>SM 数</th><th>BF16 稠密</th><th>显存 / 带宽</th><th>板卡功耗</th><th>NVLink 带宽</th></tr></thead><tbody><tr><td>A100 80GB（2020）</td><td>108</td><td>312 TFLOPS</td><td>80 GB HBM2e / 2.0 TB/s</td><td>400 W</td><td>600 GB/s</td></tr><tr><td>H100 SXM（2022）</td><td>132</td><td>989 TFLOPS</td><td>80 GB HBM3 / 3.35 TB/s</td><td>700 W</td><td>900 GB/s</td></tr><tr><td>H200 SXM（2024）</td><td>132</td><td>989 TFLOPS</td><td>141 GB HBM3e / 4.8 TB/s</td><td>700 W</td><td>900 GB/s</td></tr><tr><td>B200（2024）</td><td>双 die（2 个 die）</td><td>约 2.25 PFLOPS</td><td>192 GB HBM3e / 8 TB/s</td><td>约 1000 W</td><td>1.8 TB/s</td></tr></tbody></table></div>
<p>注意口径。第一，所有算力都是<b>稠密</b>（dense）值，不含结构化稀疏；NVIDIA 宣传页上常见的 624 TFLOPS（A100）和约 1.98 PFLOPS（H100）是启用 2:4 稀疏后的数字。第二，H200 的算力与 H100 相同，升级集中在显存容量与带宽，所以它对大模型推理和长上下文更友好，而不是训练算力更高。第三，B200 是双 die 封装，表中给的是整卡量级；时钟与功耗配置不同，数字会浮动，选型以 datasheet 为准。</p>
<p><b>稀疏加速</b>不是“零值自动跳过”。Ampere 起的 2:4 结构化稀疏要求每 4 个权重中恰好有 2 个为零，硬件按压缩格式和元数据一次取两个非零值，理论吞吐翻倍。它需要训练时做剪枝并保持模式，激活值通常不满足该模式，所以只对权重侧有效；如果稀疏模式不规整，硬件会回退到稠密路径，收益归零。把稀疏当成“免费 2 倍”是常见误判。</p>
<h3>时钟、功耗与降频</h3>
<p>GPU 的 boost 时钟是“有功耗和温度余量时”的上限，不是持续承诺。A100 SXM 的板卡功耗上限 400 W，H100 SXM 700 W，B200 约 1000 W；当持续矩阵乘把 Tensor Core 和 HBM 同时拉满，功耗会撞到 cap，DVFS 随即下调 SM 或显存时钟。由于算力与时钟近似线性，SM 时钟从 1.41 GHz 降到 1.2 GHz，峰值就只剩约 85%。此外还有温度触发的 thermal throttle、以及显存功耗挤占板卡预算导致的“算力没降、供数先降”。</p>
<p>排障时先分清是“算得慢”还是“被限频”。用 <code>nvidia-smi</code> 看当前 SM 时钟、功耗、温度和降频原因；如果 <code>clocks_throttle_reasons.sw_power_cap</code> 或 <code>clocks_throttle_reasons.hw_thermal_slowdown</code> 显示 Active，先改善散热与机箱风道，再谈 kernel 优化。若时钟正常但利用率低，则回到 stall reason 和访存效率。多卡训练还要看 NVLink 与 PCIe 拓扑，这部分在 interconnect 一篇展开。</p>
<pre class="code" data-lang="bash"><code>nvidia-smi --query-gpu=name,clocks.sm,clocks.mem,power.draw,power.limit,temperature.gpu,utilization.gpu --format=csv
nvidia-smi --query-gpu=clocks_throttle_reasons.active,clocks_throttle_reasons.sw_power_cap,clocks_throttle_reasons.hw_thermal_slowdown --format=csv
nvidia-smi -q -d CLOCK,POWER | head -60</code></pre>
<div class="callout callout--story"><span class="callout__label">案例</span><div>同一个训练任务从 8 卡风冷机箱迁到高密度机柜后 step time 变长 12%，代码与 batch 完全没改。检查发现 GPU 温度上升后 SM 时钟从约 1.4 GHz 掉到 1.25 GHz，功耗长期贴着 400 W cap。把风扇曲线调高、进风温度降下来后恢复。这类问题在 profiler 里表现为所有 kernel 等比例变慢，容易误判成代码回归。</div></div>
<p>因此，比较两张卡或两次实验时，必须固定并记录：功耗上限、时钟策略、环境温度、是否开启持久模式，以及 benchmark 的矩阵形状。用厂商峰值算“理论加速比”之前，先确认两台机器都在同一时钟与功耗档位。</p>
</section>

<section class="sec">
<h2>常见误区、排障顺序与自测</h2>
<h3>五个高频误区</h3>
<ul>
<li><b>“occupancy 越高越好”</b>：占用率只代表可切换的 Warp 多，不代表这些 Warp 有活干。寄存器压得太狠会 spill，访存反而增加。</li>
<li><b>“block 越大越好”</b>：大 block 降低调度灵活性，尾部还可能只剩一个 block 占着 SM，4 个 sub-partition 吃不饱。</li>
<li><b>“TFLOPS 就是实际算力”</b>：官方峰值是稠密、满时钟、大矩阵口径；小矩阵、K 维短、尾块和供数不足都会让它打折。</li>
<li><b>“Warp 内分支不要钱”</b>：发散路径按串行执行，两条路径各 10 cycle 就是 20 cycle，且 lane 利用率减半。</li>
<li><b>“稀疏模型自动快 2 倍”</b>：只有满足 2:4 模式且走稀疏 MMA 才翻倍，不规整稀疏会回退稠密路径。</li>
</ul>
<h3>排障顺序</h3>
<ol>
<li>先看时钟、功耗、温度和 throttle reason，排除被限频。</li>
<li>看 kernel 的 achieved occupancy 与理论 occupancy 差多少，确认是寄存器、shared memory 还是 block 粒度限制。</li>
<li>看 stall reason 分布：长延迟访存多，就增加独立加载、改用异步拷贝或提高占用；算术依赖多，就调整 tile 与指令级并行。</li>
<li>看 Tensor Core 利用率与 DRAM 吞吐；两者都低通常是延迟或同步问题。</li>
<li>最后才调 block 大小、寄存器上限和 shared memory carveout，并用同一输入复测。</li>
</ol>
<details class="quiz"><summary>Q1 · 256 线程的 block，每线程 64 个寄存器，每 block 32 KB shared，在 A100 上 occupancy 是多少？</summary><div class="quiz__a">寄存器侧每 block 用 256×64 = 16384 个，65536 ÷ 16384 = 4 个 block；shared 侧 ⌊164 KB ÷ 32 KB⌋ = 5 个 block；取 4 个 block，共 1024 线程 = 32 个 Warp，32 ÷ 64 = 50%。瓶颈是寄存器，不是 shared memory。若把每线程寄存器降到 32，shared 会先卡在 5 个 block，occupancy 为 40 ÷ 64 = 62.5%。</div></details>
<details class="quiz"><summary>Q2 · 一个 Warp 内 16 个线程走分支 A（10 cycle），另 16 个走分支 B（10 cycle），这条 if 至少花多少 cycle？</summary><div class="quiz__a">SIMT 下两条路径串行执行，总时间约 10 + 10 = 20 cycle，每个阶段只有 16 个 lane 有效，lane 利用率 50%。如果能让整个 Warp 走同一分支（例如按 Warp 分配任务），总时间可降到 10 cycle。Volta 引入的独立线程调度能改善汇合灵活性，但不消除发散本身的串行代价。</div></details>
<details class="quiz"><summary>Q3 · H200 的 BF16 峰值与 H100 相同，为什么大模型推理仍然更快？</summary><div class="quiz__a">H200 的升级是 141 GB HBM3e 和约 4.8 TB/s 带宽（H100 为 80 GB HBM3、约 3.35 TB/s），SM 数与 Tensor Core 算力不变。解码阶段每生成一个 token 都要把权重和 KV Cache 读一遍，属于带宽受限，所以带宽和容量提升直接转化为吞吐与可支持上下文长度；它不会让训练的计算峰值变高。</div></details>
<details class="quiz"><summary>Q4 · occupancy 已经 100%，Tensor Core 利用率却只有 30%，可能是什么原因？</summary><div class="quiz__a">占用率高只说明 Warp 多，不代表 MMA 管道有料。常见原因：K 维太短或矩阵太小，MMA 之间依赖太紧；数据从 shared memory 到寄存器的加载跟不上；Warp 内出现发散或屏障同步；也可能是 M/N 尾块导致大量 lane 空转。应按 stall reason、shared memory 吞吐和 MMA 指令间隔逐项排查，而不是继续加 block。</div></details>
<h3>延伸阅读</h3>
<ul class="refs">
<li><b>NVIDIA CUDA C++ Programming Guide</b> — NVIDIA, 持续更新。执行模型、Warp、occupancy 与内存空间的官方定义，查术语和约束最可靠。</li>
<li><b>NVIDIA A100 Tensor Core GPU Architecture</b> — NVIDIA, 2020。Ampere SM 的 4 个 sub-partition、Tensor Core 形状与 2:4 稀疏的原始说明。</li>
<li><b>NVIDIA H100 Tensor Core GPU Architecture</b> — NVIDIA, 2022。Hopper 的 SM 扩展、Transformer Engine 与新一代 Tensor Core 细节。</li>
<li><b>NVIDIA Tesla V100 GPU Architecture</b> — NVIDIA, 2017。Volta 白皮书，SIMT 独立线程调度与第一代 Tensor Core 的起点。</li>
<li><b>Programming Massively Parallel Processors</b> — David Kirk, Wen-mei Hwu, Izzat El Hajj, 4th ed., 2022。从 SIMT 到 tiling 的系统教材，适合补齐体系结构与性能模型。</li>
</ul>
</section>`

};
