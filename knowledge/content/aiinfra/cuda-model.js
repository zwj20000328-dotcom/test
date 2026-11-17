window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["cuda-model"] = {
  slug: "cuda-model",
  title: "CUDA 编程与执行模型",
  subtitle: "从 kernel 启动到指令调度",
  level: 2,
  cluster: "单机优化",
  tags: ["CUDA", "Warp", "Stream"],
  summary: "从 host/device 分离讲起，拆清三层索引与 Warp 调度，理清五种内存空间的生命周期，再用 vector add 与事件计时写出可运行、可排障的代码。",
  keyPoints: [
    "能根据数据规模算出 grid 与 block，并写出带边界检查的全局索引",
    "理解 Warp 是硬件调度单位，能解释 divergence 为什么浪费发射槽",
    "分清 global/shared/register/local 的作用域与生命周期，正确使用 __syncthreads",
    "会用 nvcc 编译、用错误宏与 CUDA event 计时，并读懂 PTX/SASS 与常见报错"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
  <h2>一句话直觉：几万个线程执行同一条命令</h2>
  <p>如果你只写过 Python 和 Transformer，可以先把 GPU 想成一支军队：<mark>kernel</mark> 是同一个命令，几十万个士兵（线程）同时执行，每个人根据自己胸前的编号去搬自己那一份数据。CUDA 编程的核心动作只有两个：给每个线程一个唯一编号，并让相邻编号的线程访问相邻的内存。前者决定正确性，后者决定性能。</p>
  <p>CUDA（Compute Unified Device Architecture）是 NVIDIA 在 2006 年发布、2007 年随 CUDA 1.0 正式提供的并行计算平台。它没有发明一门新语言，而是给 C++ 增加了一组扩展：用 <code>__global__</code> 标记在 GPU 上执行的函数，用 <code>__device__</code> 标记只能被 GPU 调用的函数，用 <code>__host__</code> 标记普通的 CPU 函数，再用尖括号语法启动 kernel。Python 生态里的 PyTorch、Triton、CuPy 最终都落到同一套执行模型上，所以理解这一层，排查“为什么我的 kernel 慢”时才有共同语言。</p>
  <p>需要先建立一个反直觉的事实：GPU 不是“更快的 CPU”。CPU 用大缓存、乱序执行和分支预测把单线程延迟压到极低；GPU 则把芯片面积几乎全铺成算术单元，用海量线程的切换来掩盖延迟。单看一个线程，GPU 往往比 CPU 慢；单看吞吐，一块数据中心 GPU 可以同时驻留几十万个线程（H100 SXM 为 132 个 SM × 2048 线程）。CUDA 的整套抽象，都是为“吞吐优先”服务的。</p>
  <div class="callout callout--intuition"><span class="callout__label">直觉</span><div>把 kernel 看成“对数组每个元素做同一件事”的批量函数。你写的不是循环，而是“第 i 个线程负责第 i 个元素”的规则；循环被硬件展开成了并行。</div></div>
</section>

<section class="sec">
  <h2>host 与 device：两个世界，一条异步时间线</h2>
  <p>CUDA 程序里有两个执行主体：<mark>host</mark> 指 CPU 及其内存，<mark>device</mark> 指 GPU 及其显存。二者有各自独立的物理内存。你在 host 上用 <code>cudaMalloc</code> 申请到的指针，保存的是一个设备地址，host 不能直接解引用；反过来，kernel 也不能直接读写 <code>malloc</code> 出来的可分页内存（除非把它注册并映射为零拷贝内存）。数据必须通过 <code>cudaMemcpy</code> 或 <code>cudaMemcpyAsync</code> 显式搬运。统一虚拟寻址（Unified Virtual Addressing）让两边的指针落在同一个虚拟地址空间里，但“能看见地址”不等于“能访问内容”。</p>
  <p>更重要的是：<b>kernel 启动是异步的</b>。当你写下 <code>vectorAdd&lt;&lt;&lt;blocks, threads&gt;&gt;&gt;(...)</code>，CPU 只是把一条命令塞进某个 <mark>stream</mark>（流）的队列，然后立刻返回继续执行下一行。真正的执行发生在 GPU 上，时间点可能晚得多。同一个 stream 内的操作严格按提交顺序执行；不同 stream 之间没有顺序保证，这也正是重叠拷贝与计算的基础。</p>
  <p>由此带来两个工程习惯。第一，测时间不能用 CPU 的 <code>clock()</code> 或 <code>time.time()</code> 包住 launch，那测到的主要是提交开销；应该用 <mark>CUDA event</mark>，把时间戳插入 stream，让 GPU 自己在执行到该点时记录。第二，涉及 host 与 device 的同步点要心里有数：<code>cudaMemcpy</code>（同步版本）会阻塞 host 直到拷贝完成，<code>cudaDeviceSynchronize</code> 等待当前设备上的所有 stream，<code>cudaStreamSynchronize</code> 只等一条流。默认 stream（legacy default stream）还会与其它阻塞 stream 产生隐式同步，这是很多“莫名串行”的来源。</p>
  <figure class="fig">
    <svg viewBox="0 0 760 380" width="100%" role="img" aria-label="CPU 与 GPU 的异步执行时间线，展示 kernel 启动立即返回以及双 stream 的重叠">
      <defs>
        <marker id="cuda-model-arrow-time" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--sv-muted)"></path>
        </marker>
      </defs>
      <text x="30" y="26" font-size="14" fill="var(--sv-ink)" font-family="inherit">异步时间线：CPU 提交完就返回，GPU 随后执行</text>
      <text x="30" y="92" font-size="13" fill="var(--sv-ink)" font-family="inherit">CPU（host）</text>
      <text x="30" y="180" font-size="13" fill="var(--sv-ink)" font-family="inherit">GPU stream 0</text>
      <text x="30" y="268" font-size="13" fill="var(--sv-ink)" font-family="inherit">GPU stream 1</text>

      <rect x="128" y="70" width="78" height="32" rx="4" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
      <text x="167" y="90" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">launch 拷贝 A</text>
      <rect x="210" y="70" width="78" height="32" rx="4" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
      <text x="249" y="90" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">launch K A</text>
      <rect x="292" y="70" width="78" height="32" rx="4" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
      <text x="331" y="90" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">launch 回拷 A</text>
      <rect x="374" y="70" width="78" height="32" rx="4" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
      <text x="413" y="90" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">launch K B</text>
      <rect x="456" y="70" width="78" height="32" rx="4" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
      <text x="495" y="90" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">launch 回拷 B</text>
      <rect x="538" y="70" width="82" height="32" rx="4" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <text x="579" y="90" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">sync 等待</text>
      <text x="300" y="56" font-size="12" fill="var(--sv-muted)" font-family="inherit">launch 调用立即返回（不含同步）</text>

      <rect x="210" y="158" width="82" height="32" rx="4" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
      <text x="251" y="178" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">H2D A</text>
      <rect x="296" y="158" width="90" height="32" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
      <text x="341" y="178" font-size="12" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">kernel A</text>
      <rect x="390" y="158" width="82" height="32" rx="4" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
      <text x="431" y="178" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">D2H A</text>

      <rect x="296" y="246" width="70" height="32" rx="4" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
      <text x="331" y="266" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">H2D B</text>
      <rect x="456" y="246" width="90" height="32" rx="4" fill="var(--sv-c)" stroke="var(--sv-line)"></rect>
      <text x="501" y="266" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">kernel B</text>
      <rect x="550" y="246" width="70" height="32" rx="4" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
      <text x="585" y="266" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">D2H B</text>

      <line x1="296" y1="140" x2="296" y2="300" stroke="var(--sv-line)" stroke-dasharray="4 4"></line>
      <line x1="390" y1="140" x2="390" y2="300" stroke="var(--sv-line)" stroke-dasharray="4 4"></line>
      <text x="296" y="318" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">e0 记录</text>
      <text x="390" y="318" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">e1 记录</text>
      <line x1="120" y1="342" x2="700" y2="342" stroke="var(--sv-muted)" marker-end="url(#cuda-model-arrow-time)"></line>
      <text x="705" y="346" font-size="12" fill="var(--sv-muted)" font-family="inherit">t</text>
      <text x="470" y="318" font-size="12" fill="var(--sv-muted)" font-family="inherit">elapsed = e1 − e0</text>
    </svg>
    <figcaption>图 1 · CPU 提交与 GPU 执行的解耦；两条 stream 的拷贝与计算可以重叠，event 在 stream 内打时间戳</figcaption>
  </figure>
  <div class="formula">有效带宽 ≈ 传输字节数 ÷ 传输时间
vector add 的访存下限：t ≈ N × 4 B × 3 ÷ BW
（N 为元素数，读 a、读 b、写 c 共 3 次 4 字节访问）</div>
</section>

<section class="sec">
  <h2>grid、block、thread：三层索引如何落到数据上</h2>
  <p>CUDA 把一个 kernel 的全体线程组织成三层：<mark>grid</mark>（网格）由若干 <mark>block</mark>（线程块）组成，每个 block 又由若干 <mark>thread</mark>（线程）组成。启动时用 <code>dim3</code> 指定两边的形状，block 内的线程数通常写成 128、256、512，且最好是 32 的倍数。硬件以 block 为单位把线程分配到 SM（Streaming Multiprocessor）上，一个 block 一旦开始执行，它的所有线程都驻留在同一个 SM 上，直到结束。</p>
  <p>每个线程通过三个内建变量定位自己：<code>threadIdx</code>（block 内编号）、<code>blockIdx</code>（grid 内编号）、<code>blockDim</code>（block 的形状）。对一维数据，全局编号就是 <code>i = blockIdx.x * blockDim.x + threadIdx.x</code>。数据长度 N 往往不能被 block 大小整除，所以必须向上取整算 grid，并在 kernel 里用 <code>if (i &lt; n)</code> 挡住越界的尾巴。少了这个判断，最后一次启动会读写非法地址，程序可能不报错却悄悄算错，也可能直接崩溃。</p>
  <p>如果不想让 grid 随数据无限增长，可以用 <mark>grid-stride loop</mark>：固定启动“刚好填满 GPU”的 block 数，让每个线程以 <code>blockDim.x * gridDim.x</code> 为步长循环处理多个元素。这样同一份代码既能处理一千万个元素，也能处理十亿个，还能复用线程、减少 block 调度与尾块浪费。它的代价是索引不再一一对应，写代码时要更小心边界与循环不变量的关系。</p>
  <figure class="fig">
    <svg viewBox="0 0 760 380" width="100%" role="img" aria-label="grid、block 与 thread 三层索引映射，以及全局索引计算公式">
      <defs>
        <marker id="cuda-model-arrow-map" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--sv-muted)"></path>
        </marker>
      </defs>
      <text x="38" y="30" font-size="14" fill="var(--sv-ink)" font-family="inherit">grid：6 × 4 个 block</text>
      <text x="400" y="30" font-size="14" fill="var(--sv-ink)" font-family="inherit">block (2,1)：8 × 4 个 thread</text>

      <rect x="45" y="50" width="234" height="154" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
      <rect x="45" y="50" width="34" height="34" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
      <rect x="85" y="50" width="34" height="34" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
      <rect x="125" y="50" width="34" height="34" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
      <rect x="165" y="50" width="34" height="34" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
      <rect x="205" y="50" width="34" height="34" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
      <rect x="245" y="50" width="34" height="34" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>

      <rect x="45" y="90" width="34" height="34" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
      <rect x="85" y="90" width="34" height="34" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
      <rect x="125" y="90" width="34" height="34" fill="var(--sv-a)" stroke="var(--sv-ink)"></rect>
      <text x="142" y="112" font-size="12" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">2,1</text>
      <rect x="165" y="90" width="34" height="34" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
      <rect x="205" y="90" width="34" height="34" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
      <rect x="245" y="90" width="34" height="34" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>

      <rect x="45" y="130" width="34" height="34" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
      <rect x="85" y="130" width="34" height="34" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
      <rect x="125" y="130" width="34" height="34" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
      <rect x="165" y="130" width="34" height="34" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
      <rect x="205" y="130" width="34" height="34" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
      <rect x="245" y="130" width="34" height="34" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>

      <rect x="45" y="170" width="34" height="34" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
      <rect x="85" y="170" width="34" height="34" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
      <rect x="125" y="170" width="34" height="34" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
      <rect x="165" y="170" width="34" height="34" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
      <rect x="205" y="170" width="34" height="34" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
      <rect x="245" y="170" width="34" height="34" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>

      <path d="M160,107 C 230,107 300,107 385,107" fill="none" stroke="var(--sv-muted)" marker-end="url(#cuda-model-arrow-map)"></path>
      <text x="222" y="98" font-size="12" fill="var(--sv-muted)" font-family="inherit">放大</text>

      <rect x="392" y="50" width="318" height="154" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
      <rect x="406" y="66" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <rect x="442" y="66" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <rect x="478" y="66" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <rect x="514" y="66" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <rect x="550" y="66" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <rect x="586" y="66" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <rect x="622" y="66" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <rect x="658" y="66" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>

      <rect x="406" y="100" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <rect x="442" y="100" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <rect x="478" y="100" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <rect x="514" y="100" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <rect x="550" y="100" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <rect x="586" y="100" width="32" height="28" fill="var(--sv-b)" stroke="var(--sv-ink)"></rect>
      <text x="602" y="119" font-size="12" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">5,1</text>
      <rect x="622" y="100" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <rect x="658" y="100" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>

      <rect x="406" y="134" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <rect x="442" y="134" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <rect x="478" y="134" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <rect x="514" y="134" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <rect x="550" y="134" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <rect x="586" y="134" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <rect x="622" y="134" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <rect x="658" y="134" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>

      <rect x="406" y="168" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <rect x="442" y="168" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <rect x="478" y="168" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <rect x="514" y="168" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <rect x="550" y="168" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <rect x="586" y="168" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <rect x="622" y="168" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <rect x="658" y="168" width="32" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>

      <text x="406" y="228" font-size="12" fill="var(--sv-muted)" font-family="inherit">同一个 block 的线程共享 shared memory 与 barrier</text>
      <text x="406" y="248" font-size="12" fill="var(--sv-muted)" font-family="inherit">普通 launch 下相邻 block 无法同步，映射到哪个 SM 由硬件决定</text>

      <rect x="38" y="270" width="672" height="82" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
      <text x="56" y="296" font-size="14" fill="var(--sv-ink)" font-family="inherit">全局索引：i = blockIdx.x × blockDim.x + threadIdx.x</text>
      <text x="56" y="320" font-size="14" fill="var(--sv-ink)" font-family="inherit">网格大小：gridDim.x = ⌈N ÷ blockDim.x⌉</text>
      <text x="56" y="340" font-size="12" fill="var(--sv-muted)" font-family="inherit">例：N = 16,777,216，blockDim.x = 256，则 gridDim.x = 65,536</text>
    </svg>
    <figcaption>图 2 · grid 到 block 到 thread 的展开；block 是调度与同步的基本单位</figcaption>
  </figure>
  <div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>限制项</th><th>典型上限</th><th>工程含义</th></tr></thead>
    <tbody>
      <tr><td>每 block 线程数</td><td>1024</td><td>超过直接启动失败，常用 128–512</td></tr>
      <tr><td>Warp 大小</td><td>32 线程</td><td>block 大小取 32 的倍数可减少尾块浪费</td></tr>
      <tr><td>每 SM 常驻线程</td><td>2048（A100 / H100）</td><td>即最多 64 个 Warp，决定占用率上限</td></tr>
      <tr><td>每 SM block 槽位</td><td>32</td><td>block 太小会被槽位卡住，不是线程越多越好</td></tr>
      <tr><td>gridDim.x</td><td>2³¹ − 1</td><td>y、z 维上限为 65,535</td></tr>
      <tr><td>每线程寄存器</td><td>255 个 32-bit</td><td>超出会溢出到 local memory，延迟骤增</td></tr>
      <tr><td>每 block shared memory</td><td>48 KiB 默认，可 opt-in 至 163 KiB（A100）/ 227 KiB（H100）</td><td>取决于架构与动态共享内存配置，每 SM 另有约 1 KiB 保留</td></tr>
      <tr><td>constant memory</td><td>64 KiB</td><td>适合所有线程读同一份只读参数</td></tr>
    </tbody>
  </table></div>
  <div class="callout callout--warn"><span class="callout__label">注意</span><div>索引变量用 <code>int</code> 时，元素数超过约 2.1 × 10⁹ 就会溢出成负数。大数组请用 <code>size_t</code> 或 64 位索引，并注意 <code>blockIdx.x * blockDim.x</code> 本身也可能先溢出。</div></div>
</section>

<section class="sec">
  <h2>Warp 与 lane：硬件真正调度的单位</h2>
  <p>block 只是软件层面的容器，真正被 SM 取指、发射的是 <mark>Warp</mark>（线程束）。32 个连续线程被绑定成一个 Warp，Warp 内的每个线程叫一个 <mark>lane</mark>（通道），编号 0–31。由于 <code>threadIdx.x</code> 是最内层维度，一般 <code>lane = threadIdx.x % 32</code>。一个 Warp 共享一条指令流：同一条加法指令，32 个 lane 各自用自己的寄存器同时算。这种“一份指令、多份数据”的模式叫 <mark>SIMT</mark>（Single Instruction, Multiple Threads）。</p>
  <p>SIMT 与 CPU 的 SIMD 很像，但关键区别在编程模型：SIMD 需要你把数据手工打包进向量寄存器，SIMT 则让你写普通的标量代码，由硬件把 32 个线程绑在一起。代价是分支。如果一个 Warp 内的线程走了不同的 <code>if</code> 分支，硬件不能同时执行两条路径，只能给不活跃的 lane 打掩码，先执行路径 A，再执行路径 B，这称为 <mark>Warp divergence</mark>（线程束发散）。发散本身不改变结果，但会把本该一次完成的指令发射变成多次。</p>
  <p>从 Volta 架构开始，NVIDIA 引入了独立线程调度（Independent Thread Scheduling），Warp 内线程可以有各自的程序计数器，这让 <code>__syncwarp</code> 和 Warp 内通信更灵活，但“同一时刻一个 Warp 只发射一条路径”的硬件事实没有改变，发散仍然要付串行化的代价。工程上的做法是让分支条件在 Warp 内尽量一致：按 <code>threadIdx.x / 32</code> 而不是按 <code>threadIdx.x % 2</code> 分流；对末尾不足 32 个的线程，接受一个 Warp 的部分浪费即可。跨 lane 的数据交换用 <code>__shfl_sync</code> 系列，比绕 shared memory 更直接。</p>
  <figure class="fig">
    <svg viewBox="0 0 760 380" width="100%" role="img" aria-label="一个 Warp 的 32 个 lane 因 if else 分支分裂成两条串行执行的路径">
      <defs>
        <marker id="cuda-model-arrow-div" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--sv-muted)"></path>
        </marker>
      </defs>
      <text x="30" y="28" font-size="14" fill="var(--sv-ink)" font-family="inherit">Warp = 32 个 lane；偶数走 if，奇数走 else</text>
      <text x="80" y="76" font-size="12" fill="var(--sv-muted)" font-family="inherit">lane 0</text>
      <text x="696" y="76" font-size="12" fill="var(--sv-muted)" font-family="inherit">15</text>
      <text x="80" y="116" font-size="12" fill="var(--sv-muted)" font-family="inherit">lane 16</text>
      <text x="696" y="116" font-size="12" fill="var(--sv-muted)" font-family="inherit">31</text>

      <rect x="120" y="58" width="30" height="24" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
      <rect x="156" y="58" width="30" height="24" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
      <rect x="192" y="58" width="30" height="24" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
      <rect x="228" y="58" width="30" height="24" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
      <rect x="264" y="58" width="30" height="24" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
      <rect x="300" y="58" width="30" height="24" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
      <rect x="336" y="58" width="30" height="24" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
      <rect x="372" y="58" width="30" height="24" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
      <rect x="408" y="58" width="30" height="24" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
      <rect x="444" y="58" width="30" height="24" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
      <rect x="480" y="58" width="30" height="24" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
      <rect x="516" y="58" width="30" height="24" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
      <rect x="552" y="58" width="30" height="24" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
      <rect x="588" y="58" width="30" height="24" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
      <rect x="624" y="58" width="30" height="24" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
      <rect x="660" y="58" width="30" height="24" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>

      <rect x="120" y="98" width="30" height="24" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
      <rect x="156" y="98" width="30" height="24" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
      <rect x="192" y="98" width="30" height="24" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
      <rect x="228" y="98" width="30" height="24" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
      <rect x="264" y="98" width="30" height="24" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
      <rect x="300" y="98" width="30" height="24" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
      <rect x="336" y="98" width="30" height="24" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
      <rect x="372" y="98" width="30" height="24" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
      <rect x="408" y="98" width="30" height="24" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
      <rect x="444" y="98" width="30" height="24" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
      <rect x="480" y="98" width="30" height="24" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
      <rect x="516" y="98" width="30" height="24" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
      <rect x="552" y="98" width="30" height="24" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
      <rect x="588" y="98" width="30" height="24" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
      <rect x="624" y="98" width="30" height="24" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
      <rect x="660" y="98" width="30" height="24" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>

      <text x="120" y="152" font-size="12" fill="var(--sv-a)" font-family="inherit">■ 偶数 lane（路径 A）</text>
      <text x="330" y="152" font-size="12" fill="var(--sv-b)" font-family="inherit">■ 奇数 lane（路径 B）</text>

      <text x="30" y="205" font-size="13" fill="var(--sv-ink)" font-family="inherit">Warp 调度器</text>
      <rect x="200" y="188" width="170" height="34" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
      <text x="285" y="210" font-size="12" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">发射路径 A（B 被掩码）</text>
      <rect x="380" y="188" width="170" height="34" rx="4" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
      <text x="465" y="210" font-size="12" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">发射路径 B（A 被掩码）</text>
      <line x1="200" y1="240" x2="560" y2="240" stroke="var(--sv-muted)" marker-end="url(#cuda-model-arrow-div)"></line>
      <text x="565" y="244" font-size="12" fill="var(--sv-muted)" font-family="inherit">时间</text>

      <text x="30" y="286" font-size="13" fill="var(--sv-ink)" font-family="inherit">结果：两条路径串行，lane 利用率 16 ÷ 32 = 50%</text>
      <text x="30" y="312" font-size="13" fill="var(--sv-muted)" font-family="inherit">若把条件改成按 Warp 对齐（如按 threadIdx.x / 32 分流），同一个 Warp 内不再分裂</text>
      <text x="30" y="338" font-size="12" fill="var(--sv-muted)" font-family="inherit">边界检查 if (i &lt; n) 只会让最后一个 Warp 部分空闲，代价通常可接受</text>
    </svg>
    <figcaption>图 3 · Warp divergence：同一 Warp 内两条互斥路径被串行发射，活跃 lane 减半</figcaption>
  </figure>
  <div class="formula">Warp 利用率 = 当前活跃 lane 数 ÷ 32
若一个 Warp 分裂成 k 条互斥路径，发射成本 ≈ Σ 各路径的指令数（而非最大值）</div>
</section>

<section class="sec">
  <h2>五种内存空间与 __syncthreads 的语义</h2>
  <p>CUDA 的内存不是“一块显存”这么简单，而是按作用域和生命周期分成几层。写 kernel 时选错空间，性能可能差一个数量级。<mark>register</mark>（寄存器）是线程私有的最快存储，由编译器分配；<mark>shared memory</mark>（共享内存）位于 SM 内，block 内所有线程可见，用来做数据复用和线程协作；<mark>global memory</mark>（全局内存）就是通常说的显存，容量最大、延迟也最高；<mark>constant memory</mark>（常量内存）是位于显存的 64 KiB 只读空间，由专用常量缓存加速，适合所有线程读同一份参数；<mark>local memory</mark>（局部内存）名字有误导性，它其实是线程私有的、物理上落在 global memory 里的区域，寄存器不够时变量会被“溢出”到这里。</p>
  <p>比容量更重要的是生命周期。寄存器与 local 变量随线程生灭；shared 随 block 生灭，block 结束后内容不再有意义；global 中由 <code>cudaMalloc</code> 分配的缓冲区从 <code>cudaMalloc</code> 到 <code>cudaFree</code>，<code>__device__</code> 全局变量则随应用存活，两者都能跨越多次 kernel 启动；constant 在模块加载后一直有效。把“block 结束后还要用的数据”放进 shared，是初学者最常见的逻辑错误之一，而且这类错误往往在不同 GPU、不同 block 调度下时对时错。</p>
  <p><mark>__syncthreads</mark> 是 block 级的栅栏（barrier），语义有两层：所有线程都到达这一点后，任何线程才能继续；并且它同时承担 block 内的内存栅栏作用，barrier 之前对 shared 和 global 的写入，在 barrier 之后对同 block 的其他线程可见。它不能跨 block 同步，也不保证其他 block 看到你的写入。最关键的约束是：<b>同一个 block 的所有线程必须都能到达同一个 __syncthreads</b>。把它放进只对部分线程成立的条件分支里，行为是未定义的，常见表现是挂起或结果随机。</p>
  <figure class="fig">
    <svg viewBox="0 0 760 380" width="100%" role="img" aria-label="CUDA 各级内存空间的作用域、生命周期与访问延迟对比">
      <text x="30" y="28" font-size="14" fill="var(--sv-ink)" font-family="inherit">内存空间：作用域、生命周期与大致延迟</text>
      <text x="500" y="56" font-size="12" fill="var(--sv-muted)" font-family="inherit">作用域</text>
      <text x="610" y="56" font-size="12" fill="var(--sv-muted)" font-family="inherit">生命周期</text>

      <rect x="30" y="70" width="430" height="42" rx="4" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
      <text x="46" y="88" font-size="13" fill="var(--sv-ink)" font-family="inherit">register 寄存器</text>
      <text x="46" y="105" font-size="12" fill="var(--sv-muted)" font-family="inherit">最快，约 1 cycle，编译器分配</text>
      <text x="500" y="96" font-size="12" fill="var(--sv-ink)" font-family="inherit">线程私有</text>
      <text x="610" y="96" font-size="12" fill="var(--sv-ink)" font-family="inherit">线程</text>

      <rect x="30" y="122" width="430" height="42" rx="4" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <text x="46" y="140" font-size="13" fill="var(--sv-ink)" font-family="inherit">shared memory 共享内存</text>
      <text x="46" y="157" font-size="12" fill="var(--sv-muted)" font-family="inherit">约 20–30 cycles，block 内协作</text>
      <text x="500" y="148" font-size="12" fill="var(--sv-ink)" font-family="inherit">block 内</text>
      <text x="610" y="148" font-size="12" fill="var(--sv-ink)" font-family="inherit">block</text>

      <rect x="30" y="174" width="430" height="42" rx="4" fill="var(--sv-c)" stroke="var(--sv-line)"></rect>
      <text x="46" y="192" font-size="13" fill="var(--sv-ink)" font-family="inherit">constant memory 常量内存 64 KiB</text>
      <text x="46" y="209" font-size="12" fill="var(--sv-muted)" font-family="inherit">只读，同地址广播时命中常量缓存</text>
      <text x="500" y="200" font-size="12" fill="var(--sv-ink)" font-family="inherit">所有线程只读</text>
      <text x="610" y="200" font-size="12" fill="var(--sv-ink)" font-family="inherit">应用</text>

      <rect x="30" y="226" width="430" height="42" rx="4" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
      <text x="46" y="244" font-size="13" fill="var(--sv-ink)" font-family="inherit">local memory 局部内存</text>
      <text x="46" y="261" font-size="12" fill="var(--sv-muted)" font-family="inherit">线程私有，物理在 global，寄存器溢出的去处</text>
      <text x="500" y="252" font-size="12" fill="var(--sv-ink)" font-family="inherit">线程私有</text>
      <text x="610" y="252" font-size="12" fill="var(--sv-ink)" font-family="inherit">线程</text>

      <rect x="30" y="278" width="430" height="42" rx="4" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
      <text x="46" y="296" font-size="13" fill="var(--sv-ink)" font-family="inherit">global memory 全局内存</text>
      <text x="46" y="313" font-size="12" fill="var(--sv-muted)" font-family="inherit">约 400–800 cycles，容量最大</text>
      <text x="500" y="304" font-size="12" fill="var(--sv-ink)" font-family="inherit">所有线程</text>
      <text x="610" y="304" font-size="12" fill="var(--sv-ink)" font-family="inherit">应用</text>

      <line x1="500" y1="66" x2="500" y2="326" stroke="var(--sv-line)" stroke-dasharray="4 4"></line>
      <line x1="600" y1="66" x2="600" y2="326" stroke="var(--sv-line)" stroke-dasharray="4 4"></line>
      <text x="30" y="340" font-size="12" fill="var(--sv-muted)" font-family="inherit">自上而下大致按访问延迟升高排列；constant 命中缓存时与 shared 同量级</text>
      <text x="30" y="364" font-size="12" fill="var(--sv-muted)" font-family="inherit">延迟为量级估计，随架构、访问模式与缓存命中变化（A100 / H100 口径）</text>
    </svg>
    <figcaption>图 4 · 五种内存空间：作用域与生命周期各异，延迟量级从 1 cycle 到数百 cycle</figcaption>
  </figure>
  <div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>空间</th><th>声明方式</th><th>作用域</th><th>生命周期</th></tr></thead>
    <tbody>
      <tr><td>register</td><td>函数内普通变量</td><td>线程</td><td>线程</td></tr>
      <tr><td>shared</td><td><code>__shared__</code> 或动态共享内存</td><td>block</td><td>block</td></tr>
      <tr><td>global</td><td><code>cudaMalloc</code> / <code>__device__</code> 变量</td><td>所有线程</td><td>应用</td></tr>
      <tr><td>constant</td><td><code>__constant__</code></td><td>所有线程，只读</td><td>应用</td></tr>
      <tr><td>local</td><td>寄存器溢出或大数组</td><td>线程</td><td>线程</td></tr>
    </tbody>
  </table></div>
  <p>还有一个与内存空间强相关的概念：<mark>合并访存</mark>（coalescing）。当一个 Warp 的 32 个 lane 访问连续的 4 字节 float，总跨度 128 字节，正好是一个 cache line，硬件可以合并成一次事务；如果各 lane 的地址相隔很远，例如每个 lane 落在不同的 32 B sector，就会退化成 32 次 sector 级事务，搬运 1024 字节却只用到 128 字节，有效带宽只剩峰值的八分之一左右。所以“线程 i 处理元素 i”的写法不仅是习惯，更是让访存自然的布局。shared memory 的 bank conflict 是同一类问题的另一面，展开在 kernel 优化一篇。</p>
  <div class="callout callout--warn"><span class="callout__label">注意</span><div><code>__syncthreads</code> 不是“等待所有线程干完活”这么简单：它要求 block 内每个线程都执行到同一条 barrier。写成 <code>if (threadIdx.x &lt; 16) { ... __syncthreads(); }</code> 属于未定义行为，在真实 GPU 上可能死锁，也可能“碰巧能跑”。</div></div>
</section>

<section class="sec">
  <h2>从零写一个 vector add：编译、查错、计时</h2>
  <p>把上面的概念串起来，最小的完整程序就是向量加法：读两个数组，逐元素相加写回第三个数组。它足够简单，能看清 host/device 分工、索引、grid 计算、错误检查和计时这五件事；同时它又是 memory-bound 的典型，后面的优化篇会反复回到这个形状。</p>
  <pre class="code" data-lang="cuda"><code>#include &lt;cstdio&gt;
#include &lt;cstdlib&gt;
#include &lt;cuda_runtime.h&gt;

__global__ void vectorAdd(const float* a, const float* b, float* c, int n) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i &lt; n) {
        c[i] = a[i] + b[i];
    }
}

#define CHECK_CUDA(call) do { \
    cudaError_t err = (call); \
    if (err != cudaSuccess) { \
        fprintf(stderr, "CUDA error: %s at %s:%d\n", \
                cudaGetErrorString(err), __FILE__, __LINE__); \
        std::exit(EXIT_FAILURE); \
    } \
} while (0)

int main() {
    const int n = 1 &lt;&lt; 24;
    const size_t bytes = n * sizeof(float);
    float *h_a = (float*)malloc(bytes);
    float *h_b = (float*)malloc(bytes);
    float *h_c = (float*)malloc(bytes);
    for (int i = 0; i &lt; n; ++i) { h_a[i] = 1.0f; h_b[i] = 2.0f; }

    float *d_a, *d_b, *d_c;
    CHECK_CUDA(cudaMalloc(&amp;d_a, bytes));
    CHECK_CUDA(cudaMalloc(&amp;d_b, bytes));
    CHECK_CUDA(cudaMalloc(&amp;d_c, bytes));
    CHECK_CUDA(cudaMemcpy(d_a, h_a, bytes, cudaMemcpyHostToDevice));
    CHECK_CUDA(cudaMemcpy(d_b, h_b, bytes, cudaMemcpyHostToDevice));

    int threads = 256;
    int blocks = (n + threads - 1) / threads;

    cudaEvent_t start, stop;
    CHECK_CUDA(cudaEventCreate(&amp;start));
    CHECK_CUDA(cudaEventCreate(&amp;stop));
    CHECK_CUDA(cudaEventRecord(start));
    vectorAdd&lt;&lt;&lt;blocks, threads&gt;&gt;&gt;(d_a, d_b, d_c, n);
    CHECK_CUDA(cudaGetLastError());
    CHECK_CUDA(cudaEventRecord(stop));
    CHECK_CUDA(cudaEventSynchronize(stop));

    float ms = 0.0f;
    CHECK_CUDA(cudaEventElapsedTime(&amp;ms, start, stop));
    printf("kernel time: %.3f ms, blocks: %d\n", ms, blocks);

    CHECK_CUDA(cudaMemcpy(h_c, d_c, bytes, cudaMemcpyDeviceToHost));
    printf("c[0] = %.1f\n", h_c[0]);

    cudaFree(d_a); cudaFree(d_b); cudaFree(d_c);
    free(h_a); free(h_b); free(h_c);
    return 0;
}
</code></pre>
  <p>编译命令需要指定目标架构。<code>-arch=sm_90</code> 对应 Hopper（H100），A100 用 <code>sm_80</code>，RTX 4090 用 <code>sm_89</code>；写 <code>-arch=native</code> 可让 nvcc 探测本机。如果不指定，nvcc 会按工具包的默认架构生成代码，可能不包含目标卡的 SASS，运行时会报 “no kernel image is available”。<code>-lineinfo</code> 保留行号信息，便于剖析与调试，对性能几乎无影响。</p>
  <pre class="code" data-lang="bash"><code>nvcc -O3 -arch=sm_90 -lineinfo vector_add.cu -o vector_add
./vector_add

nvcc -ptx -arch=sm_90 vector_add.cu -o vector_add.ptx
cuobjdump -sass vector_add
compute-sanitizer --tool memcheck ./vector_add
</code></pre>
  <p>错误检查宏的价值在于“把失败点钉在具体行”。CUDA 的很多 API 返回 <code>cudaError_t</code>，但错误可能是异步的：kernel 里的越界访问不会在 launch 那行报出来，而要等到后续同步点。因此 <code>cudaGetLastError</code> 要放在 launch 之后立刻调用；它返回并清除最近一次运行时 API 调用的错误，主要能抓住启动配置错误（例如 grid/block 越界、无效参数），而执行期错误往往要到 <code>cudaDeviceSynchronize</code> 或 event 同步之后才浮现。发布代码里可以把宏改成记录日志，但不要在开发期省略。</p>
  <p>用 <code>1 &lt;&lt; 24</code>（16,777,216 个 float，每数组 64 MiB）估算：三个数组共读写 192 MiB。以 A100 80GB 的 2.0 TB/s 峰值带宽算，理论下限约 192 MiB ÷ 2.0 TB/s ≈ 100 µs；实测通常在 120–170 µs（视 ECC、clock 与访问模式），能达到峰值带宽的六到八成就算不错。若测出来是几毫秒，先怀疑是不是误用了同步拷贝或把 kernel 放在默认 stream 里与拷贝串行。以上是量级参考，不同型号差异很大。</p>
</section>

<section class="sec">
  <h2>nvcc 到 PTX 再到 SASS：编译器做了什么</h2>
  <p>nvcc 不是一个“把 C++ 变成机器码”的单步编译器，而是一套流水线。它先把 <code>.cu</code> 拆成 host 代码与 device 代码：host 部分交给系统的 C++ 编译器（gcc、clang 或 MSVC），device 部分交给自己的前端生成 <mark>PTX</mark>（Parallel Thread Execution）。PTX 是 NVIDIA 定义的虚拟指令集，规定了寄存器、地址空间和指令语义，但还不是某一代 GPU 的真实机器码。随后 <code>ptxas</code> 把 PTX 编译成 <mark>SASS</mark>（Shader Assembly），这才是 GPU 真正执行的指令；最终多个架构的 SASS 被打包进 fatbin，嵌入可执行文件。</p>
  <p>这条流水线解释了两件事。第一，PTX 是前向兼容的：为 <code>sm_80</code> 编译的 PTX 可以在更新的 GPU 上由驱动 JIT 编译运行，所以“老程序能在新卡上跑”通常靠的就是 PTX。第二，SASS 与架构强绑定：同一个 kernel 在 A100 和 H100 上的指令序列、寄存器用量、甚至指令数量都可能不同，微架构相关的调优必须看目标卡的 SASS。注意 <code>-arch=sm_90</code> 只是 <code>-gencode arch=compute_90,code=sm_90</code> 的简写，它只把 SASS 嵌进 fatbin，并不会同时嵌入 PTX；若要保留可前向兼容的 PTX，应写成 <code>-gencode arch=compute_90,code=[sm_90,compute_90]</code>，或直接用 <code>-arch=compute_90</code> 生成 PTX。</p>
  <p>读 SASS 不必从第一行读起。先看三样东西：寄存器数量（决定 occupancy）、shared memory 用量、以及循环体里有没有出现 <code>LDG</code>（global load）与 <code>FADD</code> 的比例失衡。如果本应常驻寄存器的变量频繁出现 <code>LDL</code> / <code>STL</code>（local memory 的 load/store），说明发生了寄存器溢出，通常是数组被动态索引或 kernel 太复杂。<code>cuobjdump -sass</code> 看反汇编，<code>nvdisasm</code> 看控制流与调度，<code>Nsight Compute</code> 则把 SASS 与 stall 原因对应起来。</p>
  <div class="callout callout--tip"><span class="callout__label">技巧</span><div>排障顺序建议固定为：<code>compute-sanitizer</code> 查越界与未初始化访问 → <code>cuda-gdb</code> 定位具体线程 → <code>Nsight Systems</code> 看时间线是否有串行空洞 → <code>Nsight Compute</code> 看单个 kernel 的瓶颈（剖析方法见 profiling 一篇）。不要一上来就调 block 大小。</div></div>
  <p>常见误区可以列成一张清单：把 device 指针当 host 指针解引用（段错误）；忘记 kernel 是异步的，在 launch 后立刻读结果（读到旧数据）；grid 算少了导致尾部元素没算（逻辑错误但不报错）；block 大小不是 32 的倍数导致每个 block 的最后一个 Warp 长期半空；在循环里反复 <code>cudaMalloc</code>（分配是同步且昂贵的）；以及用 <code>cudaMemcpy</code> 而不是 <code>cudaMemcpyAsync</code> 加 pinned memory，让本可重叠的拷贝把流水线堵死。每一条都对应执行模型里的一个具体假设。</p>
</section>

<section class="sec">
  <h2>自测与延伸阅读</h2>
  <details class="quiz"><summary>Q1 · N = 1,000,000 个 float，block 取 256 线程，grid 应该是多少？kernel 里必须有什么？</summary><div class="quiz__a">grid = ⌈1,000,000 ÷ 256⌉ = 3907（因为 3906 × 256 = 999,936，还差 64 个）。必须写 <code>if (i &lt; n)</code> 边界检查，否则最后一个 block 中编号 999,936 到 1,000,191 的线程会越界，其中只有 64 个是有效线程。若用 grid-stride loop，则 grid 可取固定值，但循环条件同样要保证 <code>i &lt; n</code>。</div></details>
  <details class="quiz"><summary>Q2 · 为什么不能把 __syncthreads 放进 if (threadIdx.x &lt; 16) 里？</summary><div class="quiz__a">因为 barrier 要求 block 内所有线程都到达同一条指令。只有前 16 个线程进入分支时，其余线程永远到不了 barrier，已到达的线程会一直等待，行为未定义：可能挂起，也可能在某些架构上“看似正常”。如果确实需要部分线程先完成工作，应让所有线程都到达 barrier，把条件放在 barrier 之前的计算里，或改用 Warp 级的 <code>__syncwarp</code> 配合掩码。</div></details>
  <details class="quiz"><summary>Q3 · 用 Python 的 time.time() 包住 kernel 启动，测到的为什么不是 kernel 时间？</summary><div class="quiz__a">kernel 启动是异步的，host 端 API 只负责把命令入队后返回，<code>time.time()</code> 的差值主要是提交与 Python 开销，可能只有几微秒，而 kernel 实际跑了上百微秒。正确做法是用 <code>cudaEventRecord</code> 在 stream 中插入时间戳，结束时 <code>cudaEventSynchronize</code> 后取 <code>cudaEventElapsedTime</code>；event 的时间戳由 GPU 在 stream 执行到该点时记录，精度通常在 0.5 µs 量级。</div></details>
  <details class="quiz"><summary>Q4 · 一个 Warp 的 32 个 lane 依次访问连续 float 数组，理想情况需要几次 128 字节事务？如果数组起始地址没有 128 字节对齐呢？</summary><div class="quiz__a">32 × 4 B = 128 B，地址连续且对齐时正好落在一条 cache line 内，理想为 1 次事务。若起始地址跨了 128 B 边界，就会变成 2 次事务，有效带宽减半。这也是为什么 <code>cudaMalloc</code> 的返回值通常按 256 B 对齐，以及为什么结构体数组（AoS）不如数组结构体（SoA）友好。</div></details>
  <h3>延伸阅读</h3>
  <ul class="refs">
    <li><b>CUDA C++ Programming Guide</b> — NVIDIA, 持续更新（以 CUDA 12.x / 13.x 为准）。执行模型、内存模型、Warp 与同步语义的权威定义，遇到分歧以它为准。</li>
    <li><b>CUDA C++ Best Practices Guide</b> — NVIDIA。合并访存、occupancy、拷贝重叠与测量方法的工程清单。</li>
    <li><b>Programming Massively Parallel Processors, 4th Edition</b> — David B. Kirk, Wen-mei W. Hwu, Izzat El Hajj, Morgan Kaufmann, 2022。从 SIMT 到 tiling 的教材式推导，适合系统补齐直觉。</li>
    <li><b>Fundamentals of Accelerated Computing with CUDA C/C++</b> — NVIDIA Deep Learning Institute。动手入门课程，覆盖本篇的索引、内存与计时。</li>
    <li><b>Nsight Compute 与 Nsight Systems 用户指南</b> — NVIDIA。把 SASS、stall 原因与时间线对应起来的官方文档。</li>
  </ul>
</section>`
};
