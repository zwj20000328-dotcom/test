window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["performance"] = {
  slug: "performance",
  title: "C++ 性能工程",
  subtitle: "缓存、分配与测量的三角",
  level: 4,
  cluster: "并发与性能",
  tags: ["性能", "缓存", "benchmark"],
  summary: "从测量闭环讲起，拆解缓存局部性、AoS/SoA 布局、分支与内联、分配与拷贝、伪共享，并给出 Google Benchmark 与 perf 的正确用法。",
  keyPoints: [
    "性能结论只在具体场景成立：先建立可重复的基线，一次只改一个变量，改动幅度必须超过测量噪声",
    "缓存层级决定了大多数“看似算得快”的优化：局部性、数据布局与缓存行利用率往往比指令条数更关键",
    "AoS 适合整体访问对象，SoA 适合批量扫描单列；选择依据是访问模式，不是直觉",
    "内联、LTO、分支提示都只是给编译器的信息，是否生效要反汇编或看 profile 验证",
    "在热点路径上减少分配与拷贝（reserve、移动、string_view）通常有直接收益，但零拷贝会把生命周期风险转移给调用方"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>一句话：性能是测出来的，不是想出来的</h2>
<p><mark>性能工程</mark>（performance engineering）不是“把代码写得更快”，而是在可测量的证据下，用最小的复杂度代价换取可验证的改进。同一段代码换个 CPU、编译器或数据规模，结果可能相差数倍，脱离场景的“这样写更快”并不成立。</p>
<p>在主流 CPU 上，决定快慢的通常不是算术，而是三件事：数据离核心有多远（<b>缓存</b>）、为数据付出的管理成本（<b>分配与拷贝</b>）、以及差异是否测准了（<b>测量</b>）。只盯分配会忽略缓存行利用率；只盯微基准，可能测的并不热。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>把 CPU 想成在仓库找货的工人：寄存器是手里的零件，L1/L2 是工位旁的货架，主存是仓库深处。让货物摆放符合取用顺序，比让他跑得更快有效得多。性能优化的大部分工作，本质是重新安排数据与访问顺序。</div></div>
<p>本篇覆盖方法论、缓存与布局、控制流、分配与拷贝、并发缓存一致性及工具。线程与内存序见 concurrency-basics、atomics-memory-order；布局见 memory-layout，分配器见 allocation。</p>
</section>

<section class="sec">
<h2>先画闭环：性能分析不是一次冲刺</h2>
<p>几乎所有失败的性能优化都有同一个起点：有人看了一眼代码，觉得“这里应该很慢”，然后开始改。改完之后既没有基线，也没有复测，最后连是否变快都无法回答。可靠的流程是一个闭环，而不是单向的努力。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="性能分析闭环：建立基线、剖析定位、单点改动、复测对比" font-family="inherit">
<defs>
<marker id="performance-a1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-ink)"></path>
</marker>
</defs>
<text x="32" y="36" font-size="14" fill="var(--sv-ink)">性能优化是一个闭环：每一轮都必须能证伪上一轮的假设</text>
<rect x="32" y="64" width="150" height="78" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
<text x="107" y="90" font-size="13" text-anchor="middle" fill="var(--sv-ink)">① 建立基线</text>
<text x="107" y="111" font-size="11.5" text-anchor="middle" fill="var(--sv-ink)">固定场景与指标</text>
<text x="107" y="129" font-size="11.5" text-anchor="middle" fill="var(--sv-muted)">吞吐 / 尾延迟 / 峰值内存</text>
<rect x="222" y="64" width="150" height="78" rx="6" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
<text x="297" y="90" font-size="13" text-anchor="middle" fill="var(--sv-ink)">② 剖析定位</text>
<text x="297" y="111" font-size="11.5" text-anchor="middle" fill="var(--sv-ink)">perf / VTune / Tracy</text>
<text x="297" y="129" font-size="11.5" text-anchor="middle" fill="var(--sv-muted)">找真正的热点</text>
<rect x="412" y="64" width="150" height="78" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
<text x="487" y="90" font-size="13" text-anchor="middle" fill="var(--sv-ink)">③ 单点改动</text>
<text x="487" y="111" font-size="11.5" text-anchor="middle" fill="var(--sv-ink)">一次只改一个变量</text>
<text x="487" y="129" font-size="11.5" text-anchor="middle" fill="var(--sv-muted)">否则无法归因</text>
<rect x="602" y="64" width="150" height="78" rx="6" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
<text x="677" y="90" font-size="13" text-anchor="middle" fill="var(--sv-ink)">④ 复测对比</text>
<text x="677" y="111" font-size="11.5" text-anchor="middle" fill="var(--sv-ink)">显著性 + 回归检查</text>
<text x="677" y="129" font-size="11.5" text-anchor="middle" fill="var(--sv-muted)">留下基准测试</text>
<line x1="184" y1="103" x2="216" y2="103" stroke="var(--sv-ink)" stroke-width="1.6" marker-end="url(#performance-a1)"></line>
<line x1="374" y1="103" x2="406" y2="103" stroke="var(--sv-ink)" stroke-width="1.6" marker-end="url(#performance-a1)"></line>
<line x1="564" y1="103" x2="596" y2="103" stroke="var(--sv-ink)" stroke-width="1.6" marker-end="url(#performance-a1)"></line>
<path d="M677,144 L677,196 L107,196 L107,148" fill="none" stroke="var(--sv-c)" stroke-width="1.8" marker-end="url(#performance-a1)"></path>
<text x="392" y="188" font-size="12" text-anchor="middle" fill="var(--sv-c)">把结论固化为基准测试，防止下次重构悄悄回退</text>
<rect x="32" y="222" width="224" height="66" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="44" y="246" font-size="12" fill="var(--sv-ink)">指标要贴近用户感受</text>
<text x="44" y="268" font-size="11.5" fill="var(--sv-muted)">平均延迟会掩盖长尾，P99 才接近体感</text>
<rect x="268" y="222" width="224" height="66" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="280" y="246" font-size="12" fill="var(--sv-ink)">控制噪声来源</text>
<text x="280" y="268" font-size="11.5" fill="var(--sv-muted)">频率调节、缓存预热、线程调度、NUMA</text>
<rect x="504" y="222" width="224" height="66" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="516" y="246" font-size="12" fill="var(--sv-ink)">用差异判断有效性</text>
<text x="516" y="268" font-size="11.5" fill="var(--sv-muted)">改动幅度必须明显大于重复测量的波动</text>
<text x="32" y="324" font-size="13" fill="var(--sv-ink)">没有基线的优化无法证伪；没有回归基准的优化，会在下一次重构里悄悄丢失。</text>
<text x="32" y="348" font-size="12" fill="var(--sv-muted)">闭环的每一轮都应当能回答：改了什么、为什么改、证据是什么、代价是什么。</text>
</svg>
<figcaption>图 1 · 性能分析闭环。四个阶段循环往复；左下的三张卡片是前提：指标可观测、噪声可控、差异可归因。缺一项，优化都只是猜测。</figcaption>
</figure>
<p>最容易被跳过的是第①步。基线不是“跑一次看看”，而是<b>可重复的实验装置</b>：固定输入、编译选项与机器状态，并记录 CPU 型号、编译器版本、优化级别与数据规模；否则三个月后没人能解释。</p>
<p>第③步同样重要：同时换容器、开 LTO、调线程数，即使变快也无法归因，更无法判断谁引入了回归。</p>
<h3>用一条公式判断值不值得做</h3>
<div class="formula">执行时间 T = 指令数 IC × 每条指令周期数 CPI × 时钟周期 t
加速比上限（Amdahl）：S = 1 / ((1 − p) + p / k)
其中 p 是可优化部分占比，k 是该部分的加速倍数
推论：p = 20%、k = ∞ 时，S 也只有 1.25；先找占比大的部分</div>
<p>公式的价值不是精确计算，而是排除幻想：占 3% 的代码优化到零也只换来约 3%，却可能引入难维护的抽象；占 40% 的遍历快 30%，新耗时为 0.6 + 0.4 / 1.3 ≈ 0.908，整体时间约下降 9%（加速比约 1.10）。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>微基准只能回答“这段代码在什么条件下多快”，不能外推到真实负载：I/O、锁竞争与缓存压力往往才是线上成本。用微基准验证假设，用端到端基准确认收益。</div></div>
</section>

<section class="sec">
<h2>缓存层级：大多数“算得快”其实是“取得近”</h2>
<p>处理器与主存的速度鸿沟是性能工程的第一性事实。硬件用多级缓存把最近用过的数据留在离核心更近的地方。缓存以<b>缓存行</b>（cache line）为单位搬运数据，x86-64 上典型为 64 字节，部分 ARM 实现为 128 字节；具体宽度取决于平台，不是语言标准的规定。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="存储层级金字塔：寄存器、L1、L2、L3、主存的容量与访问延迟" font-family="inherit">
<text x="32" y="34" font-size="13" fill="var(--sv-ink)">容量向下增大，延迟向下升高：每降一级，通常慢 3–10 倍</text>
<text x="32" y="52" font-size="11.5" fill="var(--sv-muted)">以下为典型量级，实际数值随微架构、频率与编译器优化变化</text>
<polygon points="220,58 540,58 516,110 244,110" fill="var(--sv-a2)" stroke="var(--sv-line)"></polygon>
<text x="380" y="80" font-size="12.5" text-anchor="middle" fill="var(--sv-ink)">寄存器 · 每线程几十到几百字节</text>
<text x="380" y="100" font-size="11.5" text-anchor="middle" fill="var(--sv-muted)">≈ 1 个周期，编译器直接分配</text>
<polygon points="244,110 516,110 492,162 268,162" fill="var(--sv-b2)" stroke="var(--sv-line)"></polygon>
<text x="380" y="132" font-size="12.5" text-anchor="middle" fill="var(--sv-ink)">L1 数据缓存 · 32–64 KB / 核心</text>
<text x="380" y="152" font-size="11.5" text-anchor="middle" fill="var(--sv-muted)">≈ 4–5 个周期</text>
<polygon points="268,162 492,162 468,214 292,214" fill="var(--sv-a2)" stroke="var(--sv-line)"></polygon>
<text x="380" y="184" font-size="12.5" text-anchor="middle" fill="var(--sv-ink)">L2 缓存 · 256 KB–2 MB / 核心</text>
<text x="380" y="204" font-size="11.5" text-anchor="middle" fill="var(--sv-muted)">≈ 12–20 个周期</text>
<polygon points="292,214 468,214 444,266 316,266" fill="var(--sv-b2)" stroke="var(--sv-line)"></polygon>
<text x="380" y="236" font-size="12.5" text-anchor="middle" fill="var(--sv-ink)">L3 缓存 · 8–64 MB / 插槽</text>
<text x="380" y="256" font-size="11.5" text-anchor="middle" fill="var(--sv-muted)">≈ 40–75 个周期，多核共享</text>
<polygon points="316,266 444,266 420,318 340,318" fill="var(--sv-panel)" stroke="var(--sv-c)" stroke-width="1.5"></polygon>
<text x="380" y="288" font-size="12.5" text-anchor="middle" fill="var(--sv-ink)">主存 DRAM · GB 级</text>
<text x="380" y="308" font-size="11.5" text-anchor="middle" fill="var(--sv-muted)">≈ 200–350 个周期</text>
<text x="602" y="88" font-size="12" fill="var(--sv-a)">越靠上越快</text>
<text x="602" y="110" font-size="12" fill="var(--sv-b)">越靠上越贵</text>
<text x="602" y="132" font-size="12" fill="var(--sv-muted)">容量也越小</text>
<text x="32" y="348" font-size="12" fill="var(--sv-muted)">量级参考：Bryant &amp; O'Hallaron《CS:APP》第 6 章与厂商优化手册；不要把周期数当作常数。</text>
</svg>
<figcaption>图 2 · 存储层级。一次主存访问的延迟足够执行数百条算术指令。优化内存访问，本质是让后续访问命中更靠上的层级，或让一次搬运的字节被用满。</figcaption>
</figure>
<p>程序有两条规律：<b>时间局部性</b>（temporal locality）——刚访问过的数据很可能再次被访问；<b>空间局部性</b>（spatial locality）——访问某地址后相邻地址很可能被访问。缓存行是空间局部性的硬件实现：读一个字节，机器搬来 64 字节，用满才不亏。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>层级</th><th>典型容量</th><th>典型延迟（周期）</th><th>谁在管理</th><th>优化抓手</th></tr></thead>
<tbody>
<tr><td>寄存器</td><td>每线程几十到几百字节</td><td>≈ 1</td><td>编译器分配</td><td>减少依赖链与寄存器溢出</td></tr>
<tr><td>L1 数据缓存</td><td>32–64 KB / 核心</td><td>≈ 4–5</td><td>硬件</td><td>顺序访问、缩小工作集</td></tr>
<tr><td>L2 缓存</td><td>256 KB–2 MB / 核心</td><td>≈ 12–20</td><td>硬件</td><td>分块，提高复用</td></tr>
<tr><td>L3 缓存</td><td>8–64 MB / 插槽</td><td>≈ 40–75</td><td>硬件</td><td>控制共享争用</td></tr>
<tr><td>主存 DRAM</td><td>GB 级</td><td>≈ 200–350</td><td>硬件 + 分页</td><td>预取、压缩数据</td></tr>
</tbody>
</table></div>
<p>最经典的演示是二维数组的遍历顺序。C++ 的多维数组按<b>行主序</b>（row-major）连续存放：同一行的元素相邻，跨行则相隔一整行。在 int 为 4 字节的常见平台上，按行遍历时一条 64 字节缓存行里的 16 个 int 会被连续用完；按列遍历时，相邻两次访问相隔一整行（本例 16 KB），缓存行利用率极低。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;vector&gt;

// 示意：同一份数据，两种遍历顺序
constexpr int N = 4096;
std::vector&lt;int&gt; a(N * N, 1);

long long sum_rows = 0;
for (int i = 0; i &lt; N; ++i)
    for (int j = 0; j &lt; N; ++j)
        sum_rows += a[i * N + j];   // 顺序访问，缓存友好

long long sum_cols = 0;
for (int j = 0; j &lt; N; ++j)
    for (int i = 0; i &lt; N; ++i)
        sum_cols += a[i * N + j];   // 每次跨 16 KB，极端浪费缓存行</code></pre>
<p>两者算术量相同，但列优先版本在数据明显超过缓存时可能慢数倍甚至一个数量级，具体差距取决于缓存容量、组相联度与 TLB 行为。编译器通常不会替你交换这种循环：浮点运算的交换可能改变结果，整数循环也常超出优化器愿意做的变换范围。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>减小工作集比提升指令效率更划算：拆出冷字段、把随机访问改成顺序访问，常带来数量级改善。分块（blocking/tiling）即把矩阵切成能装进 L2 的小块反复使用。</div></div>
</section>

<section class="sec">
<h2>数据布局：AoS 与 SoA 是两种访问契约</h2>
<p>结构体数组（<b>AoS</b>，array of structs）把对象的字段放在一起，访问一个对象时一次拿全。结构体拆分数组（<b>SoA</b>，struct of arrays）把每个字段单独存成连续数组。两者内存形状不同，适合的访问模式也不同。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="AoS 与 SoA 的内存布局对比及列扫描时的缓存行利用率" font-family="inherit">
<text x="32" y="40" font-size="13" fill="var(--sv-ink)">AoS：每个粒子是一个连续的结构体</text>
<rect x="32" y="54" width="62" height="68" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<rect x="94" y="54" width="62" height="68" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<rect x="156" y="54" width="62" height="68" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<rect x="218" y="54" width="62" height="68" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<rect x="280" y="54" width="62" height="68" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<rect x="32" y="54" width="62" height="17" fill="var(--sv-a)"></rect>
<rect x="94" y="54" width="62" height="17" fill="var(--sv-a)"></rect>
<rect x="156" y="54" width="62" height="17" fill="var(--sv-a)"></rect>
<rect x="218" y="54" width="62" height="17" fill="var(--sv-a)"></rect>
<rect x="280" y="54" width="62" height="17" fill="var(--sv-a)"></rect>
<rect x="32" y="71" width="62" height="17" fill="var(--sv-b)"></rect>
<rect x="94" y="71" width="62" height="17" fill="var(--sv-b)"></rect>
<rect x="156" y="71" width="62" height="17" fill="var(--sv-b)"></rect>
<rect x="218" y="71" width="62" height="17" fill="var(--sv-b)"></rect>
<rect x="280" y="71" width="62" height="17" fill="var(--sv-b)"></rect>
<rect x="32" y="88" width="62" height="17" fill="var(--sv-c)"></rect>
<rect x="94" y="88" width="62" height="17" fill="var(--sv-c)"></rect>
<rect x="156" y="88" width="62" height="17" fill="var(--sv-c)"></rect>
<rect x="218" y="88" width="62" height="17" fill="var(--sv-c)"></rect>
<rect x="280" y="88" width="62" height="17" fill="var(--sv-c)"></rect>
<rect x="32" y="105" width="62" height="17" fill="var(--sv-a2)"></rect>
<rect x="94" y="105" width="62" height="17" fill="var(--sv-a2)"></rect>
<rect x="156" y="105" width="62" height="17" fill="var(--sv-a2)"></rect>
<rect x="218" y="105" width="62" height="17" fill="var(--sv-a2)"></rect>
<rect x="280" y="105" width="62" height="17" fill="var(--sv-a2)"></rect>
<text x="63" y="66" font-size="11" text-anchor="middle" fill="var(--sv-bg)">x</text>
<text x="125" y="66" font-size="11" text-anchor="middle" fill="var(--sv-bg)">x</text>
<text x="187" y="66" font-size="11" text-anchor="middle" fill="var(--sv-bg)">x</text>
<text x="249" y="66" font-size="11" text-anchor="middle" fill="var(--sv-bg)">x</text>
<text x="311" y="66" font-size="11" text-anchor="middle" fill="var(--sv-bg)">x</text>
<text x="63" y="83" font-size="11" text-anchor="middle" fill="var(--sv-bg)">y</text>
<text x="125" y="83" font-size="11" text-anchor="middle" fill="var(--sv-bg)">y</text>
<text x="187" y="83" font-size="11" text-anchor="middle" fill="var(--sv-bg)">y</text>
<text x="249" y="83" font-size="11" text-anchor="middle" fill="var(--sv-bg)">y</text>
<text x="311" y="83" font-size="11" text-anchor="middle" fill="var(--sv-bg)">y</text>
<text x="63" y="100" font-size="11" text-anchor="middle" fill="var(--sv-bg)">z</text>
<text x="125" y="100" font-size="11" text-anchor="middle" fill="var(--sv-bg)">z</text>
<text x="187" y="100" font-size="11" text-anchor="middle" fill="var(--sv-bg)">z</text>
<text x="249" y="100" font-size="11" text-anchor="middle" fill="var(--sv-bg)">z</text>
<text x="311" y="100" font-size="11" text-anchor="middle" fill="var(--sv-bg)">z</text>
<text x="63" y="117" font-size="11" text-anchor="middle" fill="var(--sv-ink)">w</text>
<text x="125" y="117" font-size="11" text-anchor="middle" fill="var(--sv-ink)">w</text>
<text x="187" y="117" font-size="11" text-anchor="middle" fill="var(--sv-ink)">w</text>
<text x="249" y="117" font-size="11" text-anchor="middle" fill="var(--sv-ink)">w</text>
<text x="311" y="117" font-size="11" text-anchor="middle" fill="var(--sv-ink)">w</text>
<text x="32" y="142" font-size="11.5" fill="var(--sv-muted)">地址连续 → 第 2 个粒子的 x 在 +16 字节处</text>
<text x="410" y="40" font-size="13" fill="var(--sv-ink)">SoA：每个字段是一个独立数组</text>
<text x="410" y="66" font-size="11.5" fill="var(--sv-ink)">x[]</text>
<rect x="450" y="54" width="56" height="18" fill="var(--sv-a)"></rect>
<rect x="506" y="54" width="56" height="18" fill="var(--sv-a)"></rect>
<rect x="562" y="54" width="56" height="18" fill="var(--sv-a)"></rect>
<rect x="618" y="54" width="56" height="18" fill="var(--sv-a)"></rect>
<rect x="674" y="54" width="56" height="18" fill="var(--sv-a)"></rect>
<text x="410" y="92" font-size="11.5" fill="var(--sv-ink)">y[]</text>
<rect x="450" y="80" width="56" height="18" fill="var(--sv-b)"></rect>
<rect x="506" y="80" width="56" height="18" fill="var(--sv-b)"></rect>
<rect x="562" y="80" width="56" height="18" fill="var(--sv-b)"></rect>
<rect x="618" y="80" width="56" height="18" fill="var(--sv-b)"></rect>
<rect x="674" y="80" width="56" height="18" fill="var(--sv-b)"></rect>
<text x="410" y="118" font-size="11.5" fill="var(--sv-ink)">z[]</text>
<rect x="450" y="106" width="56" height="18" fill="var(--sv-c)"></rect>
<rect x="506" y="106" width="56" height="18" fill="var(--sv-c)"></rect>
<rect x="562" y="106" width="56" height="18" fill="var(--sv-c)"></rect>
<rect x="618" y="106" width="56" height="18" fill="var(--sv-c)"></rect>
<rect x="674" y="106" width="56" height="18" fill="var(--sv-c)"></rect>
<text x="410" y="144" font-size="11.5" fill="var(--sv-ink)">w[]</text>
<rect x="450" y="132" width="56" height="18" fill="var(--sv-a2)"></rect>
<rect x="506" y="132" width="56" height="18" fill="var(--sv-a2)"></rect>
<rect x="562" y="132" width="56" height="18" fill="var(--sv-a2)"></rect>
<rect x="618" y="132" width="56" height="18" fill="var(--sv-a2)"></rect>
<rect x="674" y="132" width="56" height="18" fill="var(--sv-a2)"></rect>
<text x="450" y="168" font-size="11.5" fill="var(--sv-muted)">同一字段的元素彼此相邻，扫描时天然顺序</text>
<text x="32" y="196" font-size="12" fill="var(--sv-ink)">只扫描 x 字段时的缓存行有效载荷</text>
<rect x="32" y="206" width="300" height="26" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<rect x="32" y="206" width="75" height="26" fill="var(--sv-a)"></rect>
<text x="344" y="224" font-size="11.5" fill="var(--sv-ink)">AoS：约 1/4</text>
<text x="32" y="258" font-size="11.5" fill="var(--sv-muted)">每读一个 float，就带入 3 个本次用不上的字段</text>
<text x="410" y="196" font-size="12" fill="var(--sv-ink)">同一前提下的缓存行有效载荷</text>
<rect x="410" y="206" width="300" height="26" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<rect x="410" y="206" width="300" height="26" fill="var(--sv-b)"></rect>
<text x="722" y="224" font-size="11.5" fill="var(--sv-ink)">SoA：≈ 100%</text>
<text x="410" y="258" font-size="11.5" fill="var(--sv-muted)">缓存行几乎全是有效数据，还便于编译器向量化</text>
<text x="32" y="306" font-size="12.5" fill="var(--sv-ink)">选择依据是访问模式：逐对象取全字段选 AoS，批量扫某一列选 SoA。</text>
<text x="32" y="332" font-size="11.5" fill="var(--sv-muted)">结构体大小与缓存行宽度取决于 ABI 与平台；图中按 float 四字段、64 B 缓存行估算。</text>
</svg>
<figcaption>图 3 · AoS 与 SoA。左图按对象存储，右图按字段存储。只遍历 x 时，AoS 每次搬 64 字节却只用 16 字节；SoA 接近 100% 有效载荷，且连续数据更易向量化。</figcaption>
</figure>
<div class="duo"><div class="duo__col"><h4>AoS 的优势</h4><p>字段同处一个对象，整体访问时一次加载拿全；代码直观，适合实体、事件、状态机这类按对象建模的逻辑。</p></div><div class="duo__col"><h4>SoA 的优势</h4><p>扫描单个字段时缓存行利用率接近 100%，便于向量化；适合物理仿真、粒子系统、列式存储这类批量处理同一属性的场景。</p></div></div>
<p>不必非此即彼：热字段拆成 SoA，冷字段留在 AoS 按需加载。判断标准只有一条：热点循环实际读取了哪些字节。</p>
<h3>一个可编译的对比实验</h3>
<p>下面这段代码不依赖 C++20 特性，C++11 起即可编译运行，用 std::chrono 分别测量 AoS 与 SoA 求和 x 字段的耗时。它的目的不是给出某个“正确倍数”，而是让你在自己的机器上看到差异，并练习如何写一个不被优化掉的基准。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;chrono&gt;
#include &lt;cstddef&gt;
#include &lt;cstdio&gt;
#include &lt;vector&gt;

struct ParticleAoS { float x, y, z, w; };

struct ParticleSoA {
    std::vector&lt;float&gt; x, y, z, w;
    explicit ParticleSoA(std::size_t n) : x(n), y(n), z(n), w(n) {}
    std::size_t size() const { return x.size(); }
};

template &lt;class F&gt;
double time_ms(F&amp;&amp; f) {
    const auto t0 = std::chrono::steady_clock::now();
    const double result = f();
    const auto t1 = std::chrono::steady_clock::now();
    std::printf("sum = %.1f\n", result);   // 让结果逃逸，防止循环被整段删除
    return std::chrono::duration&lt;double, std::milli&gt;(t1 - t0).count();
}

int main() {
    constexpr std::size_t N = 1u &lt;&lt; 20;    // 约 100 万个粒子
    std::vector&lt;ParticleAoS&gt; aos(N);
    ParticleSoA soa(N);
    for (std::size_t i = 0; i &lt; N; ++i) {
        aos[i] = {float(i), 1.0f, 2.0f, 3.0f};
        soa.x[i] = float(i); soa.y[i] = 1.0f;
        soa.z[i] = 2.0f;     soa.w[i] = 3.0f;
    }

    const double t_aos = time_ms([&amp;] {
        double s = 0.0;
        for (const auto&amp; p : aos) s += p.x;
        return s;
    });
    const double t_soa = time_ms([&amp;] {
        double s = 0.0;
        for (float v : soa.x) s += v;
        return s;
    });
    std::printf("AoS %.3f ms, SoA %.3f ms\n", t_aos, t_soa);
}</code></pre>
<p>用 -O2 或 -O3（GCC/Clang）编译，否则测到的是未优化代码；让数据规模明显超过 L3（本例 1M 个粒子约 16 MB，若你的 L3 较大，把 N 调大），否则都命中缓存；多跑几次取中间值，并注意首次运行的页错误与预热成本。</p>
<p>两处设计是刻意的：结果通过 printf 逃逸，避免循环被删；测量函数是模板，lambda 内联进来，避免调用开销污染对比。基准库把这两件事做得更严谨，这正是 Google Benchmark 的价值。</p>
</section>

<section class="sec">
<h2>控制流：分支预测、内联与 LTO</h2>
<p>现代 CPU 采用<b>推测执行</b>（speculative execution）：遇到分支时不等待条件算出，而按预测方向先执行。预测正确几乎没有代价；错误则要丢弃已完成的工作、清空流水线再重取。典型的预测失败惩罚在十几到二十个周期量级，取决于微架构与流水线深度。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="分支预测：预测命中与预测失败时的流水线行为" font-family="inherit">
<defs>
<marker id="performance-a2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-ink)"></path>
</marker>
</defs>
<text x="32" y="34" font-size="13" fill="var(--sv-ink)">先按预测走，错了再回滚：分支的代价取决于可预测性</text>
<text x="32" y="54" font-size="11.5" fill="var(--sv-muted)">分支历史表记录最近的走向，循环边界通常高度可预测</text>
<polygon points="380,74 486,116 380,158 274,116" fill="var(--sv-b2)" stroke="var(--sv-line)"></polygon>
<text x="380" y="112" font-size="12.5" text-anchor="middle" fill="var(--sv-ink)">条件分支</text>
<text x="380" y="130" font-size="11.5" text-anchor="middle" fill="var(--sv-muted)">x &gt; threshold ?</text>
<line x1="300" y1="140" x2="200" y2="186" stroke="var(--sv-ink)" stroke-width="1.6" marker-end="url(#performance-a2)"></line>
<line x1="460" y1="140" x2="560" y2="186" stroke="var(--sv-ink)" stroke-width="1.6" marker-end="url(#performance-a2)"></line>
<rect x="66" y="190" width="268" height="70" rx="6" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-width="1.5"></rect>
<text x="200" y="216" font-size="12.5" text-anchor="middle" fill="var(--sv-ink)">预测 taken</text>
<text x="200" y="238" font-size="11.5" text-anchor="middle" fill="var(--sv-muted)">提前从跳转目标取指</text>
<rect x="426" y="190" width="268" height="70" rx="6" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-width="1.5"></rect>
<text x="560" y="216" font-size="12.5" text-anchor="middle" fill="var(--sv-ink)">预测 not taken</text>
<text x="560" y="238" font-size="11.5" text-anchor="middle" fill="var(--sv-muted)">继续顺序取指</text>
<text x="200" y="286" font-size="12" text-anchor="middle" fill="var(--sv-b)">命中：推测结果直接提交，零额外延迟</text>
<text x="560" y="286" font-size="12" text-anchor="middle" fill="var(--sv-c)">未命中：丢弃推测、冲刷流水线</text>
<rect x="66" y="306" width="628" height="48" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
<text x="380" y="326" font-size="12" text-anchor="middle" fill="var(--sv-ink)">代价 ≈ 10–20 个周期，量级随微架构变化；嵌套深、条件随机的分支最贵</text>
<text x="380" y="344" font-size="11.5" text-anchor="middle" fill="var(--sv-muted)">可预测的循环与错误处理分支几乎免费；把最可能路径写在 if 里并不能改变预测，C++20 的 [[likely]] 才可能影响布局</text>
</svg>
<figcaption>图 4 · 分支预测的两种结果。命中时分支几乎消失；未命中时必须回滚。由此得到一条结论：让分支可预测，比让分支更少更重要；可预测性取决于数据分布，不取决于代码。</figcaption>
</figure>
<p>经典演示是“先排序再过滤”：输入有序时分支几乎总朝同一方向，预测器很快学会；随机输入则频繁失败。算术量相同，耗时却可能相差数倍——性能取决于<b>数据分布</b>。</p>
<p>减少分支要谨慎：<b>无分支写法</b>（条件传送、位运算、查表）在分支真随机时有效，但会强制求值两个分支，可能更慢也更难读。C++20 的 [[likely]] 与 [[unlikely]] 是布局提示而非保证，是否有效必须用 profile 验证。</p>
<h3>内联：别把它当成开关</h3>
<p>inline 的主要作用是允许函数在多个翻译单元中重复定义（放宽 ODR），不是“命令编译器内联”。是否内联由优化器按函数大小、调用次数与可见性决定。</p>
<p>真正影响内联的是<b>可见性</b>：定义在别的 .cpp 且无 LTO 时，编译器看不到函数体，只能生成调用。链接时优化（<b>LTO</b>）把优化推迟到链接阶段，支持跨单元内联、常量传播与死代码消除；GCC/Clang 用 -flto，MSVC 用 /GL 与 /LTCG，代价是链接变慢与调试信息失真。</p>
<ul>
<li><b>先确认热点再考虑内联</b>：非热点函数内联只会增大代码体积，挤占指令缓存。</li>
<li><b>头文件里定义小函数</b>：模板、constexpr 与类内成员函数天然可见，通常已足够。</li>
<li><b>虚函数不一定拦得住内联</b>：编译器能确定动态类型时可以去虚化（devirtualization），LTO 会扩大机会，但不保证。</li>
</ul>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>不要用“加了 inline 所以更快”作结论。验证方式看反汇编（objdump、Compiler Explorer）或 profile 中该函数是否还是独立栈帧。跨模块调用的开销通常表现为调用热点，而不是某条指令慢。</div></div>
</section>

<section class="sec">
<h2>分配与拷贝：把确定的成本拿掉</h2>
<p>堆分配（heap allocation）的成本不只是分配本身：一次 new 要走分配器、可能触发系统调用、可能污染缓存。更隐蔽的是<b>扩容搬迁</b>：std::vector 按几何级数重新分配，并把旧元素移动（若移动构造不是 noexcept，则退化为拷贝）到新缓冲区，均摊 O(1)，单次却可能 O(n)，造成尾延迟尖刺。</p>
<p>因此最划算的优化往往不是“更快的分配器”，而是<b>不分配</b>：已知规模先 reserve；能复用缓冲区就别每轮新建；能移动就别拷贝；只读字符串参数用 std::string_view（C++17）。</p>
<pre class="code" data-lang="cpp"><code>// 示意：避免重复分配与多余拷贝
#include &lt;cstddef&gt;
#include &lt;istream&gt;
#include &lt;string&gt;
#include &lt;string_view&gt;
#include &lt;utility&gt;
#include &lt;vector&gt;

std::vector&lt;std::string&gt; read_lines(std::istream&amp; in, std::size_t hint) {
    std::vector&lt;std::string&gt; out;
    out.reserve(hint);                       // 一次分配，省掉 log2(n) 次搬迁

    std::string line;
    while (std::getline(in, line))
        out.push_back(std::move(line));      // 转移缓冲区所有权，而非复制字符
    return out;                              // NRVO 通常会省略这次拷贝
}

// 只读视图：不拥有、不分配，但调用方必须保证源字符串活得更久
std::size_t count_commas(std::string_view text) {
    std::size_t n = 0;
    for (char c : text) n += (c == ',');
    return n;
}</code></pre>
<p>reserve 改变的是 capacity 而非 size。reserve 后仍不能对下标赋值，因为元素尚未构造；要写入须先 resize 或 push_back，这是最常见的未定义行为来源之一。</p>
<p>短字符串还有<b>小字符串优化</b>（SSO，small string optimization）：实现通常把十几个字符存在对象内部，避免堆分配。阈值取决于实现（libstdc++ 典型 15 字符，libc++ 典型 22 字符，随版本与目标平台可能变化），不是标准保证，别把“短字符串一定不分配”写进假设。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>零拷贝不是免费的：string_view 不拥有数据，源字符串销毁或发生重新分配等使缓冲区失效的操作后，视图会悬空；即使只是被移动，缓冲区归属也可能转移到新对象，生命周期不再由原对象保证，span&lt;T&gt;（C++20）同理。把视图存进容器、异步回调或跨线程队列是典型的生命周期事故——“谁保证数据活着”必须写进接口契约。</div></div>
<p>自定义分配器、内存池与 arena 的取舍见 allocation。经验法则：先剖析确认分配真是热点（malloc/free 或 operator new 的调用栈）再池化；很多“分配很多”的程序，开销其实在缓存未命中。</p>
</section>

<section class="sec">
<h2>并发下的性能：false sharing 与工具链</h2>
<p>多线程有一个单线程不存在的陷阱：<b>伪共享</b>（false sharing）。两个线程修改逻辑上独立的变量，但若落在同一缓存行，一致性协议（典型如 MESI）会把整行视为整体：任一核心写入都要独占并让其他副本失效，于是两核不断争抢同一行，性能可能比单线程还差。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="false sharing：两个核心写同一缓存行中的不同变量导致缓存行来回失效" font-family="inherit">
<defs>
<marker id="performance-a3" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-c)"></path>
</marker>
</defs>
<text x="32" y="36" font-size="13" fill="var(--sv-ink)">逻辑上独立，物理上共享同一条缓存行</text>
<rect x="48" y="66" width="184" height="88" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
<text x="140" y="92" font-size="13" text-anchor="middle" fill="var(--sv-ink)">核心 0</text>
<text x="140" y="116" font-size="12" text-anchor="middle" fill="var(--sv-ink)">counter_a += 1</text>
<text x="140" y="138" font-size="11.5" text-anchor="middle" fill="var(--sv-muted)">需要独占整条缓存行</text>
<rect x="528" y="66" width="184" height="88" rx="6" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
<text x="620" y="92" font-size="13" text-anchor="middle" fill="var(--sv-ink)">核心 1</text>
<text x="620" y="116" font-size="12" text-anchor="middle" fill="var(--sv-ink)">counter_b += 1</text>
<text x="620" y="138" font-size="11.5" text-anchor="middle" fill="var(--sv-muted)">同样需要独占整条缓存行</text>
<line x1="200" y1="156" x2="252" y2="206" stroke="var(--sv-c)" stroke-width="1.8" marker-end="url(#performance-a3)"></line>
<line x1="560" y1="156" x2="508" y2="206" stroke="var(--sv-c)" stroke-width="1.8" marker-end="url(#performance-a3)"></line>
<rect x="212" y="210" width="336" height="84" fill="var(--sv-panel)" stroke="var(--sv-c)" stroke-width="2" stroke-dasharray="6 4"></rect>
<line x1="254" y1="210" x2="254" y2="294" stroke="var(--sv-line)"></line>
<line x1="296" y1="210" x2="296" y2="294" stroke="var(--sv-line)"></line>
<line x1="338" y1="210" x2="338" y2="294" stroke="var(--sv-line)"></line>
<line x1="380" y1="210" x2="380" y2="294" stroke="var(--sv-line)"></line>
<line x1="422" y1="210" x2="422" y2="294" stroke="var(--sv-line)"></line>
<line x1="464" y1="210" x2="464" y2="294" stroke="var(--sv-line)"></line>
<line x1="506" y1="210" x2="506" y2="294" stroke="var(--sv-line)"></line>
<text x="233" y="248" font-size="12" text-anchor="middle" fill="var(--sv-ink)">a</text>
<text x="275" y="248" font-size="12" text-anchor="middle" fill="var(--sv-ink)">b</text>
<text x="317" y="248" font-size="12" text-anchor="middle" fill="var(--sv-muted)">·</text>
<text x="359" y="248" font-size="12" text-anchor="middle" fill="var(--sv-muted)">·</text>
<text x="401" y="248" font-size="12" text-anchor="middle" fill="var(--sv-muted)">·</text>
<text x="443" y="248" font-size="12" text-anchor="middle" fill="var(--sv-muted)">·</text>
<text x="485" y="248" font-size="12" text-anchor="middle" fill="var(--sv-muted)">·</text>
<text x="527" y="248" font-size="12" text-anchor="middle" fill="var(--sv-muted)">·</text>
<text x="380" y="276" font-size="11.5" text-anchor="middle" fill="var(--sv-muted)">一条 64 B 缓存行：8 个 8 字节槽位</text>
<text x="380" y="310" font-size="12" text-anchor="middle" fill="var(--sv-c)">写 a 让对方的副本失效，写 b 再让它失效一次：缓存行来回搬运</text>
<text x="32" y="338" font-size="12" fill="var(--sv-ink)">修复：把热点变量对齐到各自的缓存行，或让每个线程只写自己私有的填充结构。</text>
<text x="32" y="360" font-size="11.5" fill="var(--sv-muted)">对齐粒度取决于平台；C++17 定义 std::hardware_destructive_interference_size，但并非所有实现都提供，其值由实现定义，不宜进入二进制接口。</text>
</svg>
<figcaption>图 5 · 伪共享。两个线程写不同变量，但变量落在同一缓存行，一致性协议只能按整行处理，每次写入都让对方缓存失效。加锁不能解决它：问题在缓存行粒度，不在数据竞争。</figcaption>
</figure>
<p>识别伪共享需要工具，源码上看不出变量是否相邻：perf c2c 统计缓存行争用（HITM），VTune 的 Memory Access 分析也能给出结论。修复有两种：<b>填充与对齐</b>（计数器放进按缓存行对齐的独立结构），或<b>改变算法</b>（每线程私有累加后合并）。</p>
<pre class="code" data-lang="cpp"><code>// 示意：用对齐把两个热点变量分到不同缓存行
#include &lt;atomic&gt;
#include &lt;cstddef&gt;
#include &lt;new&gt;

struct alignas(64) PaddedCounter {      // 64 是常见缓存行宽度，非标准保证
    std::atomic&lt;long&gt; value{0};
    char padding[64 - sizeof(std::atomic&lt;long&gt;)];  // 占满一行，避免邻居共享
};

PaddedCounter counter_a;
PaddedCounter counter_b;</code></pre>
<p>这段代码是<b>示意</b>：假定缓存行 64 字节（x86-64 常见值），标准库并未规定通用的填充写法。标准库还提供了 std::hardware_destructive_interference_size（C++17，定义于 &lt;new&gt;），但并非所有标准库实现都提供，且其值由实现定义，跨编译单元使用可能引入 ABI 问题。</p>
<h3>三个层次的剖析工具</h3>
<p><b>perf</b> 是 Linux 上的采样剖析器：perf stat 给出周期、指令数、缓存未命中与分支失败；perf record -g 采样调用栈，perf report 定位热点；perf c2c 针对缓存行争用。它开销低、不改代码。</p>
<p><b>VTune</b> 是 Intel 的套件，提供微架构热点、内存访问、线程与锁分析，并图形化呈现前端、后端或内存受限等瓶颈。它依赖 Intel 硬件事件，非 Intel 平台受限。</p>
<p><b>Tracy</b> 是开源帧级剖析器，需插入 zone 标记，实时查看时间线与锁争用，擅长回答“这一帧的时间花在哪”；代价是插桩与改代码。</p>
<p>选择原则：先用采样找热点，需要因果细节时再插桩。采样回答“时间花在哪”，插桩回答“发生了什么”。</p>
<h3>Google Benchmark 的正确用法</h3>
<p>自己用 std::chrono 写基准容易犯三个错误：次数太少、结果被优化掉、把初始化算进计时区间。Google Benchmark 已处理重复次数、预热、统计量并支持参数扫描。</p>
<pre class="code" data-lang="cpp"><code>// 示意：需要链接 Google Benchmark（-lbenchmark），不是独立可编译示例
#include &lt;benchmark/benchmark.h&gt;
#include &lt;cstddef&gt;
#include &lt;cstdint&gt;
#include &lt;vector&gt;

struct Particle { float x, y, z, w; };

static void BM_SumX(benchmark::State&amp; state) {
    std::vector&lt;Particle&gt; data(static_cast&lt;std::size_t&gt;(state.range(0)));
    for (auto _ : state) {                  // 框架决定循环多少次
        double sum = 0.0;
        for (const auto&amp; p : data) sum += p.x;
        benchmark::DoNotOptimize(sum);      // 防止结果被判定为死代码
    }
    state.SetBytesProcessed(
        static_cast&lt;std::int64_t&gt;(state.iterations() * state.range(0) * sizeof(Particle)));
}

BENCHMARK(BM_SumX)-&gt;Range(1 &lt;&lt; 10, 1 &lt;&lt; 22);   // 扫描不同数据规模
BENCHMARK_MAIN();</code></pre>
<p>实践要点：基准里不要做 I/O、打印或计时循环内的大对象分配；用 DoNotOptimize 或 ClobberMemory 阻止删除“无副作用”的计算；用 Range 扫描规模，拐点通常意味着工作集超过某级缓存；用 --benchmark_repetitions 报告中位数与离散度。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>基准只能与同机、同编译选项下的基线比较；换机器、换优化级别、换库版本后的数字不可比。必须跨机比较时，只比相对比值，并报告绝对时间与环境。</div></div>
</section>

<section class="sec">
<h2>取舍：优化的终点是可维护</h2>
<p>优化的目标不是“最快”，而是“在满足需求的前提下足够快，并且以后还能改”。每项优化都在增加约束：SoA 偏离领域模型，SIMD 绑定指令集，零拷贝把生命周期责任推给调用方。</p>
<p>几条边界：<b>先做算法与数据结构优化</b>，常带来数量级收益；<b>为热点建立回归基准</b>，让 CI 在回退超阈值时报警；<b>把可读性留给非热点</b>，只在 profile 证明的 1% 代码里用激进写法；<b>不要为理论最优牺牲正确性</b>。</p>
<p>还有一个维度是<b>可观测性成本</b>：日志、指标、追踪放在热路径上，开销可能超过优化掉的部分，应采样、异步或编译期裁剪。</p>
<h3>常见误区清单</h3>
<ul>
<li><b>没有基线就开始改</b>：无法判断是否变快，也无法判断是否引入回归。</li>
<li><b>用 -O0 的测量下结论</b>：未优化代码的瓶颈分布与发布版本完全不同，内联、向量化都未发生。</li>
<li><b>只看平均值</b>：分配、锁、清理造成的长尾体现在 P99，平均值会稀释掉。</li>
<li><b>把微基准当端到端结论</b>：缓存状态、线程数、数据分布都可能让结论反转。</li>
<li><b>以为加锁能解决伪共享</b>：问题在缓存行粒度，加锁只会让争用更贵。</li>
</ul>
<div class="callout callout--formula"><span class="callout__label">规则</span><div>准入条件：① 有可重复的基线；② 有 profile 证明是热点；③ 改动幅度明显大于噪声；④ 收益大于新增复杂度与风险。缺一就先别改。</div></div>
<h3>自测</h3>
<details class="quiz"><summary>Q1 · reserve 之后，为什么仍然不能用 v[i] = x 写入元素？</summary><div class="quiz__a">reserve 只改变 capacity（已分配但未构造），不改变 size。operator[] 的合法下标是 [0, size)，此时 size 为 0，写入即未定义行为。要写入先 resize(n)，或用 push_back/emplace_back 逐个添加。</div></details>
<details class="quiz"><summary>Q2 · 同样求和 x 字段，AoS 改成 SoA 后可能快很多，根本原因是什么？如果每个粒子都要读 x、y、z、w 四个字段，结论会变吗？</summary><div class="quiz__a">缓存行有效载荷：AoS 每个结构体 16 字节，一条 64 字节行只含 4 个 x，却带入 12 个无用字段；SoA 的 x 连续，有效载荷接近 100%，便于向量化。若每个粒子都读四个字段，AoS 反而更好——一次加载拿全。结论取决于访问模式。</div></details>
<details class="quiz"><summary>Q3 · 自己用 std::chrono 写的基准，为什么常常测出“零耗时”或明显偏小？</summary><div class="quiz__a">最常见的是死代码消除：结果没被使用，循环被整个删掉；其次是次数太少，噪声掩盖成本；还有把初始化、分配、I/O 算进计时区间。让结果逃逸（输出、volatile、DoNotOptimize），重复多次取中位数，并把初始化移出区间。</div></details>
<details class="quiz"><summary>Q4 · 两个线程各自递增独立计数器，程序却比单线程还慢，最可能是什么原因？</summary><div class="quiz__a">伪共享：两个计数器落在同一缓存行，每次写入都要独占并让对方副本失效，缓存行在两核间来回搬运。用 perf c2c 看 HITM；修复是按缓存行对齐（alignas 或 hardware_destructive_interference_size），或每线程私有累加后合并。</div></details>
<h3>延伸阅读</h3>
<ul class="refs">
<li><b>Computer Systems: A Programmer's Perspective（3rd ed.）</b> — Randal E. Bryant、David R. O'Hallaron, Pearson, 2016。第 6 章讲存储层级、缓存行与局部性，是本文缓存部分底稿。</li>
<li><b>Google Benchmark User Guide</b> — Google, github.com/google/benchmark。官方文档，涵盖 DoNotOptimize、Range、线程基准与统计参数。</li>
<li><b>perf: Linux profiling with performance counters</b> — perf wiki（perf.wiki.kernel.org）与 man perf-record、man perf-stat。采样、调用栈与 c2c 子命令的权威说明。</li>
<li><b>CppCon 性能系列演讲</b> — 例如 Mike Acton《Data-Oriented Design and C++》（CppCon 2014）、Carl Cook《When a Microsecond Is an Eternity》（CppCon 2017）。前者讲布局与访问模式，后者讲低延迟系统的时间来源。</li>
<li><b>Intel VTune Profiler User Guide 与 Tracy Profiler 文档</b> — Intel；Bartosz Taudul, github.com/wolfpld/tracy。分别为微架构与帧级插桩剖析文档。</li>
</ul>
</section>`
};
