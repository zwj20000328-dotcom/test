window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["stl-containers"] = {
  slug: "stl-containers",
  title: "STL 容器与迭代器",
  subtitle: "先选对容器，再谈优化",
  level: 3,
  cluster: "泛型与标准库",
  tags: ["vector", "map", "迭代器"],
  summary: "把 STL 容器看成一份复杂度与迭代器失效的契约：对比序列、关联、无序容器与适配器的内存布局和操作代价，并给出一张选型决策表。",
  keyPoints: [
    "容器是契约：选择容器等于选择一组复杂度承诺与迭代器失效规则，而不是选择语法。",
    "vector 默认首选：连续内存、缓存友好，几何扩容把 n 次 push_back 的总迁移摊到 O(n)。",
    "需要按 key 查找时，有序用 map/set，只查不遍历且哈希质量好时用 unordered_map/set。",
    "迭代器类别决定算法能否使用；插入删除前先确认哪些迭代器、指针和引用会失效。",
    "适配器不提供迭代器；span 与 string_view 是非拥有视图，绝不延长被观察对象的生命周期。"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>一句话直觉：容器是一组复杂度承诺</h2>
<p>很多人把 STL 容器当成"现成的数据结构"，记住接口就开始用。更准确的理解是：每个容器都是一份<mark>契约</mark>（contract）。它承诺哪些操作是常数时间、哪些是线性，插入删除之后哪些指针和迭代器仍然有效，元素在内存里是否连续。你选的不是语法，而是这份契约；绝大多数"性能不够"不是写法不够优化，而是当初签错了契约。</p>
<p>标准库的三个支柱是<mark>容器</mark>（container）、<mark>迭代器</mark>（iterator）与<mark>算法</mark>（algorithm）。容器拥有并管理元素；迭代器是访问元素的统一协议，行为像泛化的指针；算法只依赖迭代器提供的能力，不关心底层是数组还是平衡树。三者解耦带来的结果是：M 个容器与 N 个算法只需 M+N 份实现，而不是 M×N 份。本篇讲容器与迭代器，算法的组合、lambda 与 ranges 留给 stl-algorithms 一篇。</p>
<p>先立一条纪律：<b>默认用 vector</b>。只有当它确实不能满足需求——需要按 key 查找、需要频繁在两端插入、需要稳定的元素地址——才换别的容器，并且能说清换的理由。下面按"族谱、内存布局、操作代价、失效规则、选型实践"的顺序展开。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>把容器想成租房合同：vector 是"整层连续工位，人多了要整层搬家"；list 是"每人一间独立办公室，换邻居很容易，但找人要一间间敲门"；map 是"按门牌号排序的档案柜"；unordered_map 是"按哈希值分格的信箱"。没有最好的合同，只有和你的访问模式匹配的合同。</div></div>
</section>

<section class="sec">
<h2>容器族谱：四族容器，加两类视图</h2>
<p>标准库容器按元素组织方式分成四族。<b>序列容器</b>（sequence container）按插入位置组织元素：array、vector、deque、list、forward_list。<b>有序关联容器</b>（ordered associative container）按 key 的严格弱序组织：set、multiset、map、multimap，典型实现是红黑树。<b>无序关联容器</b>（unordered associative container）按哈希值分桶：unordered_set、unordered_multiset、unordered_map、unordered_multimap。第四族是<b>容器适配器</b>（container adaptor）：stack、queue、priority_queue，它们包装一个底层容器，只暴露受限接口。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="STL 容器族谱：序列容器、有序关联容器、无序关联容器、适配器与视图">
<text x="380" y="22" text-anchor="middle" font-size="14" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">标准库容器族谱（C++20 口径）</text>
<rect x="300" y="34" width="160" height="34" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
<text x="380" y="56" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">容器与视图</text>
<path d="M380,68 L380,80 M120,80 L640,80 M120,80 L120,92 M380,80 L380,92 M640,80 L640,92" stroke="var(--sv-line)" stroke-width="1.5" fill="none"></path>
<rect x="20" y="92" width="200" height="200" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="120" y="112" text-anchor="middle" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-a)">序列容器</text>
<rect x="32" y="122" width="176" height="26" rx="4" fill="var(--sv-a)"></rect>
<text x="44" y="140" font-size="12" font-family="inherit" fill="var(--sv-ink)">array　固定大小（C++11）</text>
<rect x="32" y="154" width="176" height="26" rx="4" fill="var(--sv-a)"></rect>
<text x="44" y="172" font-size="12" font-family="inherit" fill="var(--sv-ink)">vector　连续、可增长</text>
<rect x="32" y="186" width="176" height="26" rx="4" fill="var(--sv-a)"></rect>
<text x="44" y="204" font-size="12" font-family="inherit" fill="var(--sv-ink)">deque　分段连续、双端</text>
<rect x="32" y="218" width="176" height="26" rx="4" fill="var(--sv-a)"></rect>
<text x="44" y="236" font-size="12" font-family="inherit" fill="var(--sv-ink)">list　双向链表</text>
<rect x="32" y="250" width="176" height="26" rx="4" fill="var(--sv-a)"></rect>
<text x="44" y="268" font-size="12" font-family="inherit" fill="var(--sv-ink)">forward_list　单向（C++11）</text>
<rect x="280" y="92" width="200" height="200" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="380" y="112" text-anchor="middle" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-b)">有序关联容器</text>
<rect x="292" y="122" width="176" height="26" rx="4" fill="var(--sv-b)"></rect>
<text x="304" y="140" font-size="12" font-family="inherit" fill="var(--sv-ink)">set / multiset</text>
<rect x="292" y="154" width="176" height="26" rx="4" fill="var(--sv-b)"></rect>
<text x="304" y="172" font-size="12" font-family="inherit" fill="var(--sv-ink)">map / multimap</text>
<text x="304" y="206" font-size="12" font-family="inherit" fill="var(--sv-muted)">典型实现：红黑树</text>
<text x="304" y="228" font-size="12" font-family="inherit" fill="var(--sv-muted)">有序遍历 · O(log n) 查找</text>
<text x="304" y="250" font-size="12" font-family="inherit" fill="var(--sv-muted)">节点式存储</text>
<rect x="540" y="92" width="200" height="200" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="640" y="112" text-anchor="middle" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-c)">无序关联容器</text>
<rect x="552" y="122" width="176" height="26" rx="4" fill="var(--sv-c)"></rect>
<text x="564" y="140" font-size="12" font-family="inherit" fill="var(--sv-ink)">unordered_set / multiset</text>
<rect x="552" y="154" width="176" height="26" rx="4" fill="var(--sv-c)"></rect>
<text x="564" y="172" font-size="12" font-family="inherit" fill="var(--sv-ink)">unordered_map / multimap</text>
<text x="564" y="206" font-size="12" font-family="inherit" fill="var(--sv-muted)">典型实现：哈希桶</text>
<text x="564" y="228" font-size="12" font-family="inherit" fill="var(--sv-muted)">无序 · 平均 O(1) 查找</text>
<text x="564" y="250" font-size="12" font-family="inherit" fill="var(--sv-muted)">最坏 O(n)（冲突严重）</text>
<rect x="20" y="306" width="720" height="58" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="34" y="327" font-size="12" font-family="inherit" fill="var(--sv-ink)">适配器（不提供迭代器，不能 range-for）：stack · queue · priority_queue</text>
<text x="34" y="350" font-size="12" font-family="inherit" fill="var(--sv-ink)">视图（C++17/20，非拥有）：span（C++20，连续区间） · string_view（C++17，字符串区间）</text>
</svg>
<figcaption>图 1 · 容器族谱。前三族直接拥有元素；适配器包装底层容器；span 与 string_view 只是视图，不拥有元素，也不延长其生命周期。</figcaption>
</figure>
<p>适配器与容器最关键的区别是：<mark>适配器没有迭代器</mark>。stack、queue、priority_queue 不提供 begin/end，因此不能用于 range-for，也不能直接传给标准算法。stack 与 queue 默认以 deque 为底层，priority_queue 默认以 vector 加堆算法为底层，你可以在模板参数里换底层容器，但必须满足对应接口要求。它们表达的是"只允许 LIFO、FIFO 或取最大"的约束，这个约束本身就是价值：接口收窄，误用空间就小。</p>
<p>C++20 的 <code>std::span</code> 是<mark>非拥有视图</mark>（non-owning view），表示一段连续内存，可由 vector、array、原生数组或指针加长度构造。它适合做函数参数，替代"指针 + 长度"两参数写法。但 span 不延长被观察对象的生命周期，返回指向局部 vector 的 span 就是悬垂。C++17 的 string_view 同理，细节在 string-view-format 一篇。C++23 起标准还加入了 flat_map、flat_set，用有序连续存储模拟关联容器，查询仍是 O(log n)，但遍历和缓存局部性更好（部分实现可能尚未提供）。</p>
</section>

<section class="sec">
<h2>序列容器：连续与非连续，决定缓存命运</h2>
<p><code>std::array</code>（C++11）是固定大小的聚合类型，元素就放在对象内部，不涉及堆分配，<code>size()</code> 是编译期常量。它适合大小已知且较小的缓冲区，能完整享受连续内存与栈分配的好处；代价是大小写进类型，运行期无法伸缩。</p>
<p><code>std::vector</code> 是动态连续数组：元素紧挨着存放，<code>data()</code> 返回首元素地址，随机访问是纯指针算术。它同时拥有 size（已构造元素个数）与 capacity（已分配空间能容纳的个数）。尾部插入删除均摊 O(1)，中间插入删除 O(n)，因为要搬移后续元素。它的强项不是某一次操作最快，而是<mark>遍历时的缓存局部性</mark>：元素紧挨着存放，顺序访问时硬件预取能连续生效，实际吞吐常常远超理论复杂度更漂亮的链表。</p>
<p><code>std::deque</code> 是分段连续结构，典型实现是一张指向若干固定大小块的指针表。它支持 O(1) 随机访问，但一次访问通常要两次解引用；两端插入删除均摊 O(1)，中间插入仍是 O(n)；它没有 <code>data()</code>，因为内存本来就不连续。需要频繁在头部入队、又需要按下标访问时，deque 是比 vector 更合适的选择。</p>
<p><code>std::list</code> 是双向链表，每个元素存放在独立节点中；<code>std::forward_list</code>（C++11）是单向链表，更省一个指针，但没有 <code>size()</code>，也不支持反向遍历。链表的独特价值是<mark>引用与迭代器稳定</mark>：插入删除只影响被操作节点，其余元素的地址不变。<code>splice</code> 能把节点从一个链表接到另一个链表而不搬移元素：单节点或整链 splice 是 O(1)，区间 splice 则线性于区间长度（实现需要调整两个链表的 size）。代价是每个节点一次分配、额外指针开销，以及遍历时随机跳转导致的缓存未命中。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>"链表插入快"是半句话。插入本身 O(1)，但找到插入位置通常要 O(n)。如果你为了"插入快"把 vector 换成 list，却仍要线性查找，实际往往更慢。只有当你已经持有目标位置的迭代器，或者需要 splice、需要地址稳定时，list 才真正占优。典型 64 位 libstdc++ 中，list 节点还要存前后指针，单个元素的内存开销明显高于 vector；具体数值取决于实现与元素类型。</div></div>
</section>

<section class="sec">
<h2>vector 扩容：几何增长如何把拷贝摊薄</h2>
<p>vector 的容量增长是理解它的核心。<code>size()</code> 是真实元素个数，<code>capacity()</code> 是不重新分配前提下最多能放多少。当 <code>push_back</code> 发现 size 已等于 capacity，它必须：分配一块更大的新缓冲，把已有元素迁移过去（优先移动；若元素类型的移动构造可能抛出且拷贝构造可用，则退化为拷贝，以维持强异常保证），销毁旧元素并释放旧缓冲，再放入新元素。这次操作是 O(n)，并且<mark>所有指向元素的指针、引用和迭代器全部失效</mark>。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="vector 几何扩容过程：容量按倍数增长，迁移已有元素并释放旧缓冲">
<text x="380" y="22" text-anchor="middle" font-size="14" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">vector&lt;int&gt; 连续 push_back 的容量变化（以 2 倍增长为例）</text>
<text x="20" y="76" font-size="12" font-family="inherit" fill="var(--sv-muted)">size=1 cap=1</text>
<rect x="150" y="56" width="40" height="28" rx="3" fill="var(--sv-a)"></rect>
<text x="170" y="75" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">1</text>
<text x="20" y="122" font-size="12" font-family="inherit" fill="var(--sv-muted)">size=2 cap=2</text>
<rect x="150" y="102" width="40" height="28" rx="3" fill="var(--sv-a)"></rect>
<text x="170" y="121" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">1</text>
<rect x="190" y="102" width="40" height="28" rx="3" fill="var(--sv-a2)"></rect>
<text x="210" y="121" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">2</text>
<text x="20" y="168" font-size="12" font-family="inherit" fill="var(--sv-muted)">size=4 cap=4</text>
<rect x="150" y="148" width="40" height="28" rx="3" fill="var(--sv-a)"></rect>
<text x="170" y="167" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">1</text>
<rect x="190" y="148" width="40" height="28" rx="3" fill="var(--sv-a)"></rect>
<text x="210" y="167" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">2</text>
<rect x="230" y="148" width="40" height="28" rx="3" fill="var(--sv-a)"></rect>
<text x="250" y="167" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">3</text>
<rect x="270" y="148" width="40" height="28" rx="3" fill="var(--sv-a2)"></rect>
<text x="290" y="167" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">4</text>
<text x="20" y="214" font-size="12" font-family="inherit" fill="var(--sv-muted)">size=8 cap=8</text>
<rect x="150" y="194" width="40" height="28" rx="3" fill="var(--sv-a)"></rect>
<text x="170" y="213" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">1</text>
<rect x="190" y="194" width="40" height="28" rx="3" fill="var(--sv-a)"></rect>
<text x="210" y="213" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">2</text>
<rect x="230" y="194" width="40" height="28" rx="3" fill="var(--sv-a)"></rect>
<text x="250" y="213" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">3</text>
<rect x="270" y="194" width="40" height="28" rx="3" fill="var(--sv-a)"></rect>
<text x="290" y="213" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">4</text>
<rect x="310" y="194" width="40" height="28" rx="3" fill="var(--sv-a)"></rect>
<text x="330" y="213" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">5</text>
<rect x="350" y="194" width="40" height="28" rx="3" fill="var(--sv-a)"></rect>
<text x="370" y="213" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">6</text>
<rect x="390" y="194" width="40" height="28" rx="3" fill="var(--sv-a)"></rect>
<text x="410" y="213" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">7</text>
<rect x="430" y="194" width="40" height="28" rx="3" fill="var(--sv-a2)"></rect>
<text x="450" y="213" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">8</text>
<line x1="500" y1="56" x2="500" y2="226" stroke="var(--sv-line)" stroke-width="1.5" stroke-dasharray="4 4"></line>
<text x="514" y="76" font-size="12" font-family="inherit" fill="var(--sv-ink)">每次容量耗尽：</text>
<text x="514" y="98" font-size="12" font-family="inherit" fill="var(--sv-ink)">① 分配 2× 新缓冲</text>
<text x="514" y="120" font-size="12" font-family="inherit" fill="var(--sv-ink)">② 迁移已有元素</text>
<text x="514" y="142" font-size="12" font-family="inherit" fill="var(--sv-ink)">③ 释放旧缓冲</text>
<text x="514" y="164" font-size="12" font-family="inherit" fill="var(--sv-ink)">④ 追加新元素</text>
<text x="514" y="194" font-size="12" font-family="inherit" fill="var(--sv-muted)">浅色块 = 本次新元素</text>
<text x="514" y="216" font-size="12" font-family="inherit" fill="var(--sv-muted)">迁移次数 1+2+4+…</text>
<text x="20" y="256" font-size="12" font-family="inherit" fill="var(--sv-muted)">旧缓冲随扩容被释放；所有指向旧元素的内存地址失效，这是 vector 迭代器失效的根源。</text>
<path d="M150,236 L150,246 L470,246 L470,236" stroke="var(--sv-line)" stroke-width="1.5" fill="none"></path>
<text x="310" y="268" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">同一块缓冲内的元素地址连续，遍历时可被硬件预取</text>
<rect x="20" y="290" width="720" height="72" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="34" y="312" font-size="12" font-family="inherit" fill="var(--sv-ink)">reserve(n)：把 capacity 提升到至少 n，不构造元素；resize(n)：改变 size，多出的元素被值初始化。</text>
<text x="34" y="334" font-size="12" font-family="inherit" fill="var(--sv-ink)">shrink_to_fit() 只是请求，标准不保证一定回收；clear() 不改变 capacity。</text>
<text x="34" y="354" font-size="12" font-family="inherit" fill="var(--sv-muted)">增长倍数由实现决定：libstdc++/libc++ 常用 2×，MSVC 约 1.5×；标准只保证 push_back 均摊 O(1)。</text>
</svg>
<figcaption>图 2 · vector 的容量按几何级数增长。每次重分配都迁移全部已有元素，但由于总迁移量有常数上界，n 次 push_back 的均摊代价仍是 O(1)。图中实心块是旧元素，浅色块是触发本次扩容的新元素。</figcaption>
</figure>
<p>为什么必须按倍数增长，而不是每次多留几个空位？因为总迁移次数的上界完全不同。<mark>算术增长</mark>（每次加固定 k）会让 n 次插入的总迁移达到 O(n²)；<mark>几何增长</mark>（每次乘常数因子，如 2）的总迁移是 1+2+4+…+n，小于 2n，因此均摊 O(1)。标准要求 vector 的 <code>push_back</code> 均摊常数时间；在连续存储下，这意味着实现必须让容量按几何级数增长（或等价地保证迁移总量有线性上界），但具体倍数没有规定，2 倍、1.5 倍都合法，这属于实现选择而非标准保证。</p>
<div class="formula">几何增长的成本上界：1 + 2 + 4 + … + 2^k &lt; 2^(k+1) ≤ 2n ⇒ n 次 push_back 的元素迁移总数 O(n)，均摊 O(1)</div>
<p>实践上，如果你事先知道大致元素个数，<code>v.reserve(n)</code> 能一次性消除所有中间扩容，既省时间也避免地址反复变化。注意 reserve 只改容量，不改变 size，也不构造元素；访问 <code>v[i]</code>（i ≥ size）仍然是未定义行为。反过来，<code>resize(n)</code> 会真正构造或销毁元素。reserve 给多了会浪费内存，标准不保证 <code>shrink_to_fit</code> 一定生效；实践中常用的做法是拷贝交换 <code>vector&lt;T&gt;(v).swap(v)</code>，但严格说拷贝后的容量也不在标准保证内，只是主流实现会得到恰好等于 size 的容量。</p>
</section>

<section class="sec">
<h2>map 与 unordered_map：有序树对哈希桶</h2>
<p><code>std::map</code> 与 <code>std::set</code> 是<mark>有序关联容器</mark>，要求 key 上定义严格弱序（strict weak ordering），默认用 <code>std::less</code>。典型实现是红黑树，因此查找、插入、删除都是 O(log n)，中序遍历得到有序序列，并能做 lower_bound、upper_bound 这类范围查询。元素存放在节点中（标准只保证引用与指针的稳定性，节点如何分配由实现决定），插入不会使其他元素的迭代器失效，删除也只影响被删元素。代价是每个元素一个节点、指针开销和较差的缓存局部性。</p>
<p><code>std::unordered_map</code> 与 <code>std::unordered_set</code> 是<mark>无序关联容器</mark>，用哈希函数把 key 映射到桶（bucket），桶内通常用链表或类似结构串联冲突元素。平均查找 O(1)，最坏 O(n)；遍历顺序不保证，也不反映插入顺序。它要求 key 可哈希且可相等比较：自定义类型要么特化 <code>std::hash</code>，要么在模板参数里传入自定义 hasher 与相等谓词。</p>
<p>取舍可以归结为三个问题。<b>第一，是否需要顺序？</b>需要按 key 有序遍历、范围查询、找前驱后继，选 map/set。<b>第二，是否只做点查询？</b>只需要"给我这个 key 对应的值"，且哈希质量可控，选 unordered_map，通常更快。<b>第三，能否接受最坏情况？</b>哈希冲突严重或存在对抗性输入时，unordered 的最坏 O(n) 可能成为拒绝服务面；对延迟上界敏感的系统更倾向 map。此外，元素数量很小时，vector 加线性查找常常击败两者，因为常数和缓存比渐近阶更重要。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>无序容器有两个容易忽略的接口：<code>max_load_factor()</code> 控制平均每桶元素数的上限，<code>rehash(n)</code> 或 <code>reserve(n)</code> 可提前把桶数调大。已知要插入 n 个元素时先 <code>reserve(n)</code>，能避免多次 rehash。真正执行 rehash 时所有迭代器失效，但标准保证指向元素的引用和指针仍然有效——节点没有搬家，只是桶数组重建。</div></div>
<p>使用细节上，<code>m[key]</code> 在 key 不存在时会<b>默认构造并插入</b>一个值，因此不能在 const map 上用，也常常不是你想要的行为；只查不改用 <code>find</code>，确定存在才访问用 <code>at</code>（越界抛 <code>std::out_of_range</code>）。C++20 增加了 <code>contains</code>，让"只判断存在"不必再和 <code>end()</code> 比较。插入用 <code>try_emplace</code>（C++17）可以避免在 key 已存在时构造 value；<code>insert_or_assign</code> 则表达覆盖语义。</p>
</section>

<section class="sec">
<h2>迭代器类别：算法只承诺它需要的能力</h2>
<p>迭代器是容器与算法之间的接口。标准按能力把迭代器分成若干<mark>类别</mark>（iterator category）：输入迭代器（input iterator）只能单遍读取，前向迭代器（forward iterator）可多遍前进，双向迭代器（bidirectional iterator）还能后退，随机访问迭代器（random access iterator）支持加减整数、下标和大小比较。C++20 引入 <mark>contiguous_iterator</mark>，在随机访问之上额外保证元素在内存中连续，vector（<code>vector&lt;bool&gt;</code> 除外）、array、string、span 满足它。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="迭代器类别阶梯：输入、前向、双向、随机访问、连续，以及各容器提供的最低类别">
<text x="380" y="22" text-anchor="middle" font-size="14" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">迭代器能力阶梯：越往右越强，算法只要求它真正用到的能力</text>
<rect x="20" y="44" width="128" height="52" rx="6" fill="var(--sv-a)"></rect>
<text x="84" y="66" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">输入 / 输出</text>
<text x="84" y="86" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">单遍 ++</text>
<path d="M148,70 L166,70" stroke="var(--sv-line)" stroke-width="1.5"></path>
<rect x="168" y="44" width="128" height="52" rx="6" fill="var(--sv-b)"></rect>
<text x="232" y="66" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">前向</text>
<text x="232" y="86" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">多遍 ++</text>
<path d="M296,70 L314,70" stroke="var(--sv-line)" stroke-width="1.5"></path>
<rect x="316" y="44" width="128" height="52" rx="6" fill="var(--sv-c)"></rect>
<text x="380" y="66" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">双向</text>
<text x="380" y="86" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">++ 与 --</text>
<path d="M444,70 L462,70" stroke="var(--sv-line)" stroke-width="1.5"></path>
<rect x="464" y="44" width="128" height="52" rx="6" fill="var(--sv-a2)"></rect>
<text x="528" y="66" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">随机访问</text>
<text x="528" y="86" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">+n · -n · [ ] · &lt;</text>
<path d="M592,70 L610,70" stroke="var(--sv-line)" stroke-width="1.5"></path>
<rect x="612" y="44" width="128" height="52" rx="6" fill="var(--sv-b2)"></rect>
<text x="676" y="66" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">连续（C++20）</text>
<text x="676" y="86" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">地址连续</text>
<text x="20" y="126" font-size="12" font-family="inherit" fill="var(--sv-muted)">相邻元素的地址关系</text>
<text x="20" y="148" font-size="12" font-family="inherit" fill="var(--sv-ink)">随机访问：可 it+n、it[n]、比较大小，但不保证 &amp;*(it+1) == &amp;*it + 1</text>
<text x="20" y="170" font-size="12" font-family="inherit" fill="var(--sv-ink)">连续：&amp;v[i] + 1 == &amp;v[i+1]，可安全传给只收指针的 C 接口</text>
<rect x="20" y="192" width="720" height="164" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="34" y="214" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">各容器提供的最低类别</text>
<rect x="34" y="226" width="692" height="26" rx="4" fill="var(--sv-a)"></rect>
<text x="46" y="244" font-size="12" font-family="inherit" fill="var(--sv-ink)">连续 + 随机访问：vector · array · string · span（vector&lt;bool&gt; 除外）</text>
<rect x="34" y="258" width="692" height="26" rx="4" fill="var(--sv-b)"></rect>
<text x="46" y="276" font-size="12" font-family="inherit" fill="var(--sv-ink)">随机访问（不连续）：deque</text>
<rect x="34" y="290" width="692" height="26" rx="4" fill="var(--sv-c)"></rect>
<text x="46" y="308" font-size="12" font-family="inherit" fill="var(--sv-ink)">双向：list · map · set · multimap · multiset</text>
<rect x="34" y="322" width="692" height="26" rx="4" fill="var(--sv-a2)"></rect>
<text x="46" y="340" font-size="12" font-family="inherit" fill="var(--sv-ink)">前向：forward_list · unordered_map · unordered_set 及其 multi 版本</text>
</svg>
<figcaption>图 3 · 迭代器能力阶梯与容器对应关系。算法按最低要求声明迭代器类别；给不了对应能力的容器无法用于该算法。例如 std::sort 需要随机访问迭代器，因此不能直接排序 list。</figcaption>
</figure>
<p>这层抽象直接决定算法能否使用。只读一遍的算法（如 <code>std::for_each</code>）要求输入迭代器；需要多遍的算法要求前向；<code>std::reverse</code> 要求双向；<code>std::sort</code>、<code>std::nth_element</code> 要求随机访问，所以不能直接对 list 调用，list 只能用自己的 <code>sort</code> 成员函数。</p>
<p>迭代器失效是容器契约里最容易踩的部分，规律可以按存储方式记忆：<b>连续存储</b>的容器在重分配时全部失效，不重分配时则从插入/删除点起向后失效；<b>节点存储</b>的容器只在删除对应元素时失效；<b>哈希容器</b>在 rehash 时只失效迭代器，引用与指针保持有效。<code>end()</code> 迭代器单独看待：vector 只要尺寸变化就会失效，哪怕没有重分配。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>操作</th><th>vector</th><th>deque</th><th>list / forward_list</th><th>map / set</th><th>unordered_map / set</th></tr></thead>
<tbody>
<tr><td>尾部插入</td><td>重分配时全部失效，否则仅 end</td><td>所有迭代器失效，引用不失效</td><td>不失效</td><td>不失效</td><td>触发 rehash 时迭代器失效，引用不失效</td></tr>
<tr><td>中间插入</td><td>插入点及之后全部失效</td><td>所有迭代器与引用失效</td><td>不失效</td><td>不失效</td><td>rehash 时迭代器失效</td></tr>
<tr><td>删除元素</td><td>删除点及之后全部失效</td><td>中间删除全部失效，端部删除仅被删元素（尾删含 end）</td><td>仅被删元素失效</td><td>仅被删元素失效</td><td>仅被删元素失效</td></tr>
<tr><td>reserve / rehash</td><td>扩容时全部失效</td><td>无此接口</td><td>不适用</td><td>不适用</td><td>迭代器失效，引用与指针有效</td></tr>
</tbody>
</table></div>
<p>这张表给的是标准层面的失效范围：实现可能碰巧让某些迭代器仍然可用，但标准并不保证，写代码必须按表中范围假设，而不是按某次在本机观察到的现象。一个典型事故是：在遍历 vector 的循环里 <code>push_back</code>，重分配后当前迭代器变成悬垂，下一轮解引用就是未定义行为。</p>
</section>

<section class="sec">
<h2>复杂度表：渐近阶只是第一层</h2>
<p>下表汇总常用容器的核心操作代价，n 为元素个数。O(1) 指常数时间或均摊常数时间，具体常数可能差一个数量级；O(log n) 通常伴随节点跳转；O(n) 可能是顺序扫描，也可能包含搬移。读表时要把"渐近复杂度"和"缓存行为"分开看：同样是 O(n)，vector 的顺序扫描往往明显快于 list 的指针追逐。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>容器</th><th>按下标 / 随机访问</th><th>按 key 查找</th><th>头部插入</th><th>中间插入</th><th>尾部插入</th><th>内存布局</th></tr></thead>
<tbody>
<tr><td>array</td><td>O(1)</td><td>O(n)</td><td>—</td><td>—</td><td>—</td><td>连续，对象内</td></tr>
<tr><td>vector</td><td>O(1)</td><td>O(n)</td><td>O(n)</td><td>O(n)</td><td>均摊 O(1)</td><td>连续，可重分配</td></tr>
<tr><td>deque</td><td>O(1)</td><td>O(n)</td><td>均摊 O(1)</td><td>O(n)</td><td>均摊 O(1)</td><td>分段连续</td></tr>
<tr><td>list</td><td>O(n)</td><td>O(n)</td><td>O(1)</td><td>O(1)（已定位）</td><td>O(1)</td><td>节点，双向</td></tr>
<tr><td>forward_list</td><td>O(n)</td><td>O(n)</td><td>O(1)</td><td>O(1)（已定位）</td><td>—</td><td>节点，单向</td></tr>
<tr><td>map / set</td><td>—</td><td>O(log n)</td><td>—</td><td>O(log n)</td><td>O(log n)</td><td>节点，平衡树</td></tr>
<tr><td>unordered_map / set</td><td>—</td><td>平均 O(1)，最坏 O(n)</td><td>—</td><td>平均 O(1)</td><td>平均 O(1)</td><td>桶数组 + 节点</td></tr>
<tr><td>stack / queue</td><td>—</td><td>—</td><td>—</td><td>—</td><td>push/pop O(1)</td><td>包装底层容器</td></tr>
<tr><td>priority_queue</td><td>—</td><td>—</td><td>—</td><td>—</td><td>push/pop O(log n)，top O(1)</td><td>vector + 堆</td></tr>
</tbody>
</table></div>
<p>选型可以压缩成一个决策顺序，先问访问模式，再问顺序与稳定性，最后才比较常数。<b>默认 vector</b>；需要按 key 查找时，要求 key 有序或范围查询就用 map/set，否则用 unordered_map/set；需要频繁在两端进出用 deque；需要稳定地址、单节点 splice（O(1)）或大量中间插入且已持有位置时才用 list；大小固定用 array；只读连续区间传参用 span；需要 LIFO、FIFO 或始终取最大则用对应适配器。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="容器选择决策树：按访问模式、顺序需求与稳定性分支到具体容器">
<text x="380" y="22" text-anchor="middle" font-size="14" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">容器选择决策树：先满足语义，再比较常数</text>
<rect x="305" y="34" width="150" height="32" rx="6" fill="var(--sv-a2)"></rect>
<text x="380" y="55" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">主要怎么访问？</text>
<path d="M380,66 L380,78 M110,78 L650,78 M110,78 L110,92 M380,78 L380,92 M650,78 L650,92" stroke="var(--sv-line)" stroke-width="1.5" fill="none"></path>
<rect x="20" y="92" width="180" height="34" rx="6" fill="var(--sv-a)"></rect>
<text x="110" y="114" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">按 key 查找</text>
<rect x="290" y="92" width="180" height="34" rx="6" fill="var(--sv-b)"></rect>
<text x="380" y="114" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">按位置 / 顺序</text>
<rect x="560" y="92" width="180" height="34" rx="6" fill="var(--sv-c)"></rect>
<text x="650" y="114" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">特殊形态</text>
<path d="M110,126 L110,136 M380,126 L380,136 M650,126 L650,136" stroke="var(--sv-line)" stroke-width="1.5" fill="none"></path>
<rect x="20" y="136" width="180" height="42" rx="4" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="110" y="153" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">需要有序遍历或</text>
<text x="110" y="170" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">范围查询？</text>
<rect x="20" y="190" width="180" height="30" rx="4" fill="var(--sv-b)"></rect>
<text x="110" y="210" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">是 → map / set</text>
<rect x="20" y="230" width="180" height="30" rx="4" fill="var(--sv-c)"></rect>
<text x="110" y="250" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">否 → unordered_map / set</text>
<rect x="290" y="136" width="180" height="42" rx="4" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="380" y="153" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">两端频繁进出？</text>
<text x="380" y="170" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">需要地址稳定？</text>
<rect x="290" y="190" width="180" height="30" rx="4" fill="var(--sv-a)"></rect>
<text x="380" y="210" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">两端 → deque</text>
<rect x="290" y="230" width="180" height="30" rx="4" fill="var(--sv-a)"></rect>
<text x="380" y="250" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">稳定 + splice → list</text>
<rect x="290" y="270" width="180" height="30" rx="4" fill="var(--sv-a2)"></rect>
<text x="380" y="290" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">其他 → vector（默认）</text>
<rect x="560" y="136" width="180" height="42" rx="4" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="650" y="153" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">大小固定 / 只读视图 /</text>
<text x="650" y="170" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">LIFO、FIFO、优先级</text>
<rect x="560" y="190" width="180" height="30" rx="4" fill="var(--sv-b2)"></rect>
<text x="650" y="210" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">array / span</text>
<rect x="560" y="230" width="180" height="30" rx="4" fill="var(--sv-b2)"></rect>
<text x="650" y="250" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">stack / queue</text>
<rect x="560" y="270" width="180" height="30" rx="4" fill="var(--sv-b2)"></rect>
<text x="650" y="290" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">priority_queue</text>
<text x="20" y="338" font-size="12" font-family="inherit" fill="var(--sv-muted)">先满足语义正确性与接口约束，再用基准测试比较常数；小数据量下 vector 线性查找常胜出。</text>
<text x="20" y="360" font-size="12" font-family="inherit" fill="var(--sv-muted)">不要因为"理论上 O(1)"选择链表或哈希表，先测量你的真实负载。</text>
</svg>
<figcaption>图 4 · 容器选择决策树。自上而下先确定访问模式，再确定顺序、稳定性与接口约束；只有语义都满足后，才进入常数与基准测试的比较。</figcaption>
</figure>
<div class="callout callout--formula"><span class="callout__label">规则</span><div>默认 vector；按 key 查找时有序用 map/set、无序用 unordered_map/set；两端进出用 deque；要地址稳定或 splice 才用 list；固定大小用 array；只读连续区间用 span；受限接口用适配器。渐近复杂度相同时，优先连续内存。</div></div>
</section>

<section class="sec">
<h2>工程实践：reserve、emplace、span 与常见误区</h2>
<p>一段完整可编译的 C++20 示例，用 unordered_map 统计词频，再拷进 vector 排序输出前几名。它同时展示三个实践点：循环前 <code>reserve</code> 避免 rehash，用 <code>std::span</code> 接收只读区间，以及"哈希容器负责查找、vector 负责排序"的分工。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;algorithm&gt;
#include &lt;cstddef&gt;
#include &lt;iostream&gt;
#include &lt;span&gt;
#include &lt;string&gt;
#include &lt;unordered_map&gt;
#include &lt;utility&gt;
#include &lt;vector&gt;

void print_top(std::span&lt;const std::pair&lt;std::string, int&gt;&gt; rows) {
    for (const auto&amp; [word, count] : rows) {
        std::cout &lt;&lt; word &lt;&lt; ' ' &lt;&lt; count &lt;&lt; '\n';
    }
}

int main() {
    std::unordered_map&lt;std::string, int&gt; freq;
    freq.reserve(1024);                       // 预留桶，避免多次 rehash

    for (std::string word; std::cin &gt;&gt; word;) {
        ++freq[word];                          // key 不存在时默认构造 0 再自增
    }

    std::vector&lt;std::pair&lt;std::string, int&gt;&gt; ranked;
    ranked.reserve(freq.size());              // 恰好一次分配
    ranked.assign(freq.begin(), freq.end());  // 哈希表 -&gt; 连续内存

    std::sort(ranked.begin(), ranked.end(),
              [](const auto&amp; a, const auto&amp; b) { return a.second &gt; b.second; });

    if (ranked.size() &gt; 10) {
        ranked.resize(10);                    // 只保留前 10（缩小时只销毁）
    }
    print_top(ranked);
}</code></pre>
<p>几个细节值得展开。<code>freq[word]</code> 语义是"不存在就插入默认值"，统计场景正好需要，但只读场景应换 <code>find</code> 或 <code>contains</code>。排序必须换到 vector，因为 unordered_map 的迭代器只是前向迭代器，不能传给 <code>std::sort</code>；这也说明"容器负责组织，算法负责计算"的分工。最后 <code>resize(10)</code> 会保留前 10 个并销毁其余元素；如果只是想在输出时截断，直接传一个更短的 span 更便宜：<code>print_top(std::span(ranked).first(std::min&lt;std::size_t&gt;(10, ranked.size())))</code>，其中 <code>first</code> 是 C++20 的 span 成员，但它的前置条件是 <code>count &lt;= size()</code>，所以必须取 <code>min</code>，直接写 <code>first(10)</code> 在元素不足 10 个时是未定义行为。</p>
<p>关于 <code>emplace_back</code> 与 <code>push_back</code>：emplace 用参数在容器内直接构造元素，省掉一次临时对象；但不要因此无条件替换。对已有对象，<code>push_back(std::move(x))</code> 同样只移动一次，可读性更好。类似地，<code>try_emplace</code> 在 key 已存在时不构造 value，比 <code>operator[]</code> 加赋值更精确。</p>
<p>常见误区还有几个。<b>vector&lt;bool&gt;</b> 是特化版本，元素是位代理而非真正的 bool 引用，不能取地址，也不满足连续容器要求；需要按位压缩时明确知道自己在用它，需要可寻址的 bool 元素时用 <code>vector&lt;char&gt;</code>、<code>std::array&lt;bool, N&gt;</code> 或 <code>std::unique_ptr&lt;bool[]&gt;</code>（<code>deque&lt;bool&gt;</code> 虽然不压缩，但同样不连续）。<b>在 range-for 中修改容器结构</b>要格外小心：向 vector 添加元素可能触发重分配，使当前迭代器悬垂；向 map 插入不会使迭代器失效，但新元素是否会被本次遍历访问并不确定。删除元素用 C++20 的 <code>std::erase</code> 或 <code>std::erase_if</code>，不要手写容易越界的循环。算法的组合细节在 stl-algorithms 展开。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>span 与 string_view 都是"借用"：函数内部可以使用，但绝不能返回指向局部对象的 span，也不能在容器扩容后继续持有旧 span。把 span 存进对象成员尤其危险，因为类型系统不会记录被观察对象的生命周期。需要拥有数据时用 vector 或 string，不要用视图。</div></div>
<h3>自测</h3>
<details class="quiz"><summary>Q1 · 为什么 vector 的 push_back 均摊是 O(1)，而每次扩容明明是 O(n)？</summary><div class="quiz__a">因为容量按几何级数增长。n 次插入触发的迁移总量为 1+2+4+…+n 的规模，小于 2n，所以总代价 O(n)，分摊到每次是 O(1)。如果按固定增量扩容，总迁移会退化到 O(n²)。标准只要求均摊 O(1)，不规定增长倍数。</div></details>
<details class="quiz"><summary>Q2 · 遍历 map 时删除当前元素，迭代器会失效吗？换成 vector 呢？</summary><div class="quiz__a">map 是节点容器，erase 只使被删元素的迭代器失效，其余迭代器、引用、指针都保持有效，C++11 起 erase 返回下一个迭代器可以安全续遍历。vector 是连续容器，erase 会让删除点及之后的迭代器、引用、指针全部失效，并且元素会前移，必须使用 erase 的返回值重新获取位置。</div></details>
<details class="quiz"><summary>Q3 · 已知要插入 10 万个元素，应该对 vector 和 unordered_map 分别做什么准备？</summary><div class="quiz__a">vector 调用 reserve(100000)，一次分配到位，避免中途多次重分配与元素迁移。unordered_map 调用 reserve(100000)，它按 max_load_factor 推算需要的桶数并 rehash 一次，避免插入过程中反复 rehash；同时可检查哈希函数质量，防止冲突集中导致平均 O(1) 退化。</div></details>
<details class="quiz"><summary>Q4 · 为什么不能对 list 调用 std::sort，而 map 也不能用 std::sort 排序？</summary><div class="quiz__a">std::sort 要求随机访问迭代器，list 只提供双向迭代器，因此编译失败，应使用 list 的成员 sort。map 本身按 key 有序，迭代器是双向的，且元素类型是 pair&lt;const Key, T&gt;，key 不可修改；要按 value 排序只能把元素拷到 vector 再排序，这也说明"有序"指的是 key 的顺序。</div></details>
</section>

<ul class="refs">
<li><b>cppreference · Containers library</b> — cppreference.com。逐容器的接口、复杂度与失效规则，查标准保证的第一站。</li>
<li><b>《Effective STL》</b> — Scott Meyers, 2001。50 条关于容器选型、erase 惯用法与迭代器陷阱的工程经验，虽早于 C++11 但结论仍适用。</li>
<li><b>C++ Core Guidelines · SL.con</b> — Bjarne Stroustrup 与 Herb Sutter。标准库容器的使用准则，尤其是优先 vector、避免悬垂视图的建议。</li>
<li><b>cppreference · Iterator library</b> — cppreference.com。迭代器类别、traits 与 C++20 concepts 的准确定义。</li>
<li><b>《The C++ Programming Language》第 4 版</b> — Bjarne Stroustrup, 2013。标准库设计与容器契约的权威叙述，适合建立整体心智模型。</li>
</ul>`
};
