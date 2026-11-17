window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["copy-move-semantics"] = {
  slug: "copy-move-semantics",
  title: "拷贝、移动与 Rule of Five",
  subtitle: "值语义的核心契约",
  level: 1,
  cluster: "语言核心",
  tags: ["拷贝构造", "移动语义", "Rule of Five"],
  summary: "围绕五个特殊成员函数讲清深拷贝、自赋值与异常安全，给出 Rule of 0/3/5 的决策路径，并解释 RVO 与移动后状态的关键约束。",
  keyPoints: [
    "拷贝构造/赋值与移动构造/赋值的语义、签名和隐式生成规则",
    "深拷贝与浅拷贝的内存布局差异，以及 double free 的成因",
    "Rule of 0/3/5 决策树，=default 与 =delete 的正确用法",
    "copy-and-swap、自赋值、异常安全，以及 noexcept 移动对容器的影响",
    "移动后的有效但未指定状态，RVO/NRVO 让移动消失的原因"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>一句话：拷贝复制值，移动转移所有权</h2>
<p>值语义（value semantics）是 C++ 与 Java、Python 最不一样的地方：一个类型可以像 int 一样被使用，赋值产生独立副本，按值传参不改变原对象，放进容器后可以自由复制。维护这份契约的是常说的五个特殊成员函数：析构函数、拷贝构造、拷贝赋值、移动构造、移动赋值（标准还把默认构造也列为特殊成员函数，只是它不参与 Rule of Five 的讨论）。它们共同回答两个问题：<b>资源由谁释放，所有权怎么转移</b>。</p>
<p>编译器会隐式生成这些函数，默认策略是“逐成员”（memberwise）：每个成员各自被拷贝、移动或析构。成员是 int、double 时这完全正确；成员是裸指针时就是灾难，因为它只复制地址，不复制地址背后的资源。所以本篇的目标不是背出五个签名，而是让你在看到任意一个类时，能判断它属于“什么都不用写”还是“五个都得写”。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>深拷贝像复印房产证的同时真的再买一套房，两份材料互不影响。浅拷贝只配了一把新钥匙，却仍指向同一套房：两个人都以为房子归自己，最后把同一套房卖了两次。</div></div>
</section>

<section class="sec">
<h2>拷贝构造与拷贝赋值：默认只是逐成员复制</h2>
<p>拷贝构造（copy constructor）用一个同类型对象初始化新对象，形参通常是 <code>const T&amp;</code>。<code>T b = a;</code>、<code>T b(a);</code>、按值传参都会调用它；按值返回时，若复制省略没有发生且类型没有可用的移动构造，同样会调用拷贝构造。签名写成 <code>T(const T&amp;)</code> 是惯用法：它既能绑定 const 左值，也能绑定临时对象和 <code>std::move</code> 产生的右值。若写成 <code>T(T&amp;)</code>，则既不能绑定 const 对象，也不能绑定右值，只能匹配非 const 左值，属于更早期的遗留写法。</p>
<p>拷贝赋值（copy assignment）作用于一个已经构造好的对象，例如 <code>a = b;</code>。它必须先处理 a 原有的资源，再复制 b 的状态，并返回 <code>T&amp;</code> 以支持链式赋值。要区分初始化和赋值：<code>T b = a;</code> 虽然写着等号，调用的是拷贝构造，不是赋值运算符。默认拷贝构造与默认拷贝赋值都执行逐成员拷贝，对每个成员调用它自己的拷贝构造或拷贝赋值。</p>
<p>这解释了一个常见现象：成员全是 <code>std::string</code>、<code>std::vector</code> 的类，通常什么都不用写，因为标准库容器自己会做深拷贝；而直接持有 <code>int*</code> 的类，默认行为只复制指针值，这就是浅拷贝（shallow copy）。判断标准只有一条：<mark>这个类是否直接拥有需要手工释放的资源</mark>。拥有，就必须自定义拷贝，或者改成会自动管理资源的成员。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="浅拷贝与深拷贝的内存布局对比：浅拷贝两个对象指向同一缓冲区，深拷贝各自拥有独立缓冲区" font-family="inherit">
<defs>
<marker id="copy-move-semantics-arrow-a" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
<path d="M0,0 L9,3 L0,6 Z" fill="var(--sv-a)"/>
</marker>
<marker id="copy-move-semantics-arrow-b" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
<path d="M0,0 L9,3 L0,6 Z" fill="var(--sv-b)"/>
</marker>
</defs>
<text x="380" y="24" text-anchor="middle" font-size="15" fill="var(--sv-ink)">同一个 Buffer 类型，两种拷贝策略</text>
<line x1="380" y1="40" x2="380" y2="350" stroke="var(--sv-line)" stroke-dasharray="4 4"/>
<text x="195" y="60" text-anchor="middle" font-size="14" fill="var(--sv-ink)">浅拷贝：默认逐成员拷贝</text>
<text x="575" y="60" text-anchor="middle" font-size="14" fill="var(--sv-ink)">深拷贝：自定义拷贝构造</text>

<rect x="45" y="82" width="130" height="62" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="110" y="103" text-anchor="middle" font-size="13" fill="var(--sv-ink)">Buffer a</text>
<text x="110" y="121" text-anchor="middle" font-size="12" fill="var(--sv-muted)">data_ = P</text>
<text x="110" y="137" text-anchor="middle" font-size="12" fill="var(--sv-muted)">size_ = 3</text>
<rect x="45" y="192" width="130" height="62" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="110" y="213" text-anchor="middle" font-size="13" fill="var(--sv-ink)">Buffer b</text>
<text x="110" y="231" text-anchor="middle" font-size="12" fill="var(--sv-muted)">data_ = P</text>
<text x="110" y="247" text-anchor="middle" font-size="12" fill="var(--sv-muted)">size_ = 3</text>
<rect x="238" y="128" width="112" height="76" rx="5" fill="var(--sv-a)" fill-opacity="0.22" stroke="var(--sv-a)"/>
<text x="294" y="151" text-anchor="middle" font-size="12" fill="var(--sv-ink)">堆上 int[3]</text>
<text x="294" y="177" text-anchor="middle" font-size="14" fill="var(--sv-ink)">1  2  3</text>
<line x1="175" y1="113" x2="236" y2="145" stroke="var(--sv-a)" stroke-width="1.6" marker-end="url(#copy-move-semantics-arrow-a)"/>
<line x1="175" y1="223" x2="236" y2="188" stroke="var(--sv-a)" stroke-width="1.6" marker-end="url(#copy-move-semantics-arrow-a)"/>
<text x="294" y="232" text-anchor="middle" font-size="12" fill="var(--sv-muted)">两个 data_ 指向同一块内存</text>
<text x="195" y="300" text-anchor="middle" font-size="12" fill="var(--sv-muted)">两次析构同一指针 → double free</text>

<rect x="430" y="82" width="130" height="62" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="495" y="103" text-anchor="middle" font-size="13" fill="var(--sv-ink)">Buffer a</text>
<text x="495" y="121" text-anchor="middle" font-size="12" fill="var(--sv-muted)">data_ = P1</text>
<text x="495" y="137" text-anchor="middle" font-size="12" fill="var(--sv-muted)">size_ = 3</text>
<rect x="430" y="192" width="130" height="62" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="495" y="213" text-anchor="middle" font-size="13" fill="var(--sv-ink)">Buffer b</text>
<text x="495" y="231" text-anchor="middle" font-size="12" fill="var(--sv-muted)">data_ = P2</text>
<text x="495" y="247" text-anchor="middle" font-size="12" fill="var(--sv-muted)">size_ = 3</text>
<rect x="622" y="82" width="108" height="62" rx="5" fill="var(--sv-b)" fill-opacity="0.22" stroke="var(--sv-b)"/>
<text x="676" y="103" text-anchor="middle" font-size="12" fill="var(--sv-ink)">int[3]</text>
<text x="676" y="126" text-anchor="middle" font-size="13" fill="var(--sv-ink)">1  2  3</text>
<rect x="622" y="192" width="108" height="62" rx="5" fill="var(--sv-b)" fill-opacity="0.22" stroke="var(--sv-b)"/>
<text x="676" y="213" text-anchor="middle" font-size="12" fill="var(--sv-ink)">int[3]</text>
<text x="676" y="236" text-anchor="middle" font-size="13" fill="var(--sv-ink)">1  2  3</text>
<line x1="560" y1="113" x2="620" y2="113" stroke="var(--sv-b)" stroke-width="1.6" marker-end="url(#copy-move-semantics-arrow-b)"/>
<line x1="560" y1="223" x2="620" y2="223" stroke="var(--sv-b)" stroke-width="1.6" marker-end="url(#copy-move-semantics-arrow-b)"/>
<text x="575" y="300" text-anchor="middle" font-size="12" fill="var(--sv-muted)">各有一块缓冲区 → 互不影响</text>
<text x="380" y="344" text-anchor="middle" font-size="12" fill="var(--sv-muted)">指针 P 的实际地址与堆布局由平台和分配器决定，图中只表达所有权关系</text>
</svg>
<figcaption>图 1 · 浅拷贝只复制指针，深拷贝复制缓冲区；默认拷贝构造产生前者，后者必须手写</figcaption>
</figure>
<p>浅拷贝的后果不是“数据不一致”这么温和。两个对象析构时会对同一指针各 delete 一次，典型表现是 double free；或者一方先析构，另一方继续访问，变成 use-after-free。深拷贝（deep copy）为副本重新分配缓冲区并复制内容，代价是 O(n) 时间和一次分配。现代 C++ 的优先解不是手写深拷贝，而是把裸指针换成 <code>std::vector</code> 或 <code>std::unique_ptr</code>，让成员自己完成这件事，这就是后文 Rule of 0 的来源。</p>
</section>

<section class="sec">
<h2>移动构造与移动赋值：把资源偷过来</h2>
<p>C++11 引入右值引用（rvalue reference，写作 <code>T&amp;&amp;</code>）和移动语义（move semantics）。移动构造 <code>T(T&amp;&amp;)</code> 与移动赋值 <code>T&amp; operator=(T&amp;&amp;)</code> 接收即将消亡的对象（右值），目标不复制资源，而是接管源的指针或句柄，再把源置为一个可以安全析构的空状态。对持有缓冲区的类型，复杂度从 O(n) 降到 O(1)，但这是典型实现的结论，具体取决于资源种类。</p>
<p>关键点是：移动不搬运内存，它搬运的是<b>所有权</b>。一个 Buffer 被移动后，堆上的 int 数组一个字节都没动，改变的只是两个对象内部的指针值。这也解释了移动为什么对文件描述符、socket、GPU buffer 这类“句柄”同样有效：句柄的数值可以复制，但所有权只能有一个主人。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="一次移动的时序：移动前源对象拥有缓冲区，std::move 产生右值引用，移动构造后目标接管指针、源被置空，最后各自安全析构" font-family="inherit">
<defs>
<marker id="copy-move-semantics-arrow-c" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
<path d="M0,0 L9,3 L0,6 Z" fill="var(--sv-c)"/>
</marker>
</defs>
<text x="380" y="24" text-anchor="middle" font-size="15" fill="var(--sv-ink)">一次移动的四步：绑定右值、窃取指针、置空源、各自析构</text>

<text x="105" y="58" text-anchor="middle" font-size="13" fill="var(--sv-ink)">① 移动前</text>
<rect x="35" y="76" width="140" height="52" rx="5" fill="var(--sv-a)" fill-opacity="0.20" stroke="var(--sv-a)"/>
<text x="105" y="97" text-anchor="middle" font-size="12" fill="var(--sv-ink)">堆上 int[3]</text>
<text x="105" y="116" text-anchor="middle" font-size="12" fill="var(--sv-ink)">1  2  3</text>
<rect x="35" y="158" width="62" height="66" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="66" y="179" text-anchor="middle" font-size="12" fill="var(--sv-ink)">a</text>
<text x="66" y="198" text-anchor="middle" font-size="12" fill="var(--sv-muted)">P</text>
<text x="66" y="214" text-anchor="middle" font-size="12" fill="var(--sv-muted)">3</text>
<rect x="113" y="158" width="62" height="66" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="3 3"/>
<text x="144" y="179" text-anchor="middle" font-size="12" fill="var(--sv-muted)">b</text>
<text x="144" y="200" text-anchor="middle" font-size="12" fill="var(--sv-muted)">未构造</text>
<line x1="66" y1="158" x2="66" y2="132" stroke="var(--sv-c)" stroke-width="1.6" marker-end="url(#copy-move-semantics-arrow-c)"/>
<text x="105" y="252" text-anchor="middle" font-size="12" fill="var(--sv-muted)">a 拥有资源</text>

<text x="295" y="58" text-anchor="middle" font-size="13" fill="var(--sv-ink)">② std::move(a)</text>
<rect x="225" y="76" width="140" height="52" rx="5" fill="var(--sv-a)" fill-opacity="0.20" stroke="var(--sv-a)"/>
<text x="295" y="97" text-anchor="middle" font-size="12" fill="var(--sv-ink)">堆上 int[3]</text>
<text x="295" y="116" text-anchor="middle" font-size="12" fill="var(--sv-ink)">1  2  3</text>
<rect x="225" y="158" width="62" height="66" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="256" y="179" text-anchor="middle" font-size="12" fill="var(--sv-ink)">a</text>
<text x="256" y="198" text-anchor="middle" font-size="12" fill="var(--sv-muted)">P</text>
<text x="256" y="214" text-anchor="middle" font-size="12" fill="var(--sv-muted)">3</text>
<rect x="303" y="158" width="62" height="66" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="3 3"/>
<text x="334" y="179" text-anchor="middle" font-size="12" fill="var(--sv-muted)">b</text>
<text x="334" y="200" text-anchor="middle" font-size="12" fill="var(--sv-muted)">未构造</text>
<line x1="256" y1="158" x2="256" y2="132" stroke="var(--sv-c)" stroke-width="1.6" marker-end="url(#copy-move-semantics-arrow-c)"/>
<text x="295" y="252" text-anchor="middle" font-size="12" fill="var(--sv-muted)">只是类型转换，状态未变</text>

<text x="485" y="58" text-anchor="middle" font-size="13" fill="var(--sv-ink)">③ 移动构造完成</text>
<rect x="415" y="76" width="140" height="52" rx="5" fill="var(--sv-a)" fill-opacity="0.20" stroke="var(--sv-a)"/>
<text x="485" y="97" text-anchor="middle" font-size="12" fill="var(--sv-ink)">堆上 int[3]</text>
<text x="485" y="116" text-anchor="middle" font-size="12" fill="var(--sv-ink)">1  2  3</text>
<rect x="415" y="158" width="62" height="66" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="446" y="179" text-anchor="middle" font-size="12" fill="var(--sv-ink)">a</text>
<text x="446" y="198" text-anchor="middle" font-size="12" fill="var(--sv-muted)">null</text>
<text x="446" y="214" text-anchor="middle" font-size="12" fill="var(--sv-muted)">0</text>
<rect x="493" y="158" width="62" height="66" rx="5" fill="var(--sv-panel)" stroke="var(--sv-ink)"/>
<text x="524" y="179" text-anchor="middle" font-size="12" fill="var(--sv-ink)">b</text>
<text x="524" y="198" text-anchor="middle" font-size="12" fill="var(--sv-ink)">P</text>
<text x="524" y="214" text-anchor="middle" font-size="12" fill="var(--sv-ink)">3</text>
<line x1="524" y1="158" x2="524" y2="132" stroke="var(--sv-c)" stroke-width="1.6" marker-end="url(#copy-move-semantics-arrow-c)"/>
<text x="485" y="252" text-anchor="middle" font-size="12" fill="var(--sv-muted)">指针易主，源被置空</text>

<text x="675" y="58" text-anchor="middle" font-size="13" fill="var(--sv-ink)">④ 离开作用域</text>
<rect x="605" y="76" width="140" height="52" rx="5" fill="var(--sv-b)" fill-opacity="0.20" stroke="var(--sv-b)"/>
<text x="675" y="97" text-anchor="middle" font-size="12" fill="var(--sv-ink)">堆上 int[3]</text>
<text x="675" y="116" text-anchor="middle" font-size="12" fill="var(--sv-ink)">归 b 所有</text>
<rect x="605" y="158" width="62" height="66" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="636" y="179" text-anchor="middle" font-size="12" fill="var(--sv-muted)">a</text>
<text x="636" y="198" text-anchor="middle" font-size="12" fill="var(--sv-muted)">null</text>
<text x="636" y="214" text-anchor="middle" font-size="12" fill="var(--sv-muted)">0</text>
<rect x="683" y="158" width="62" height="66" rx="5" fill="var(--sv-panel)" stroke="var(--sv-ink)"/>
<text x="714" y="179" text-anchor="middle" font-size="12" fill="var(--sv-ink)">b</text>
<text x="714" y="198" text-anchor="middle" font-size="12" fill="var(--sv-ink)">P</text>
<text x="714" y="214" text-anchor="middle" font-size="12" fill="var(--sv-ink)">3</text>
<line x1="714" y1="158" x2="714" y2="132" stroke="var(--sv-b)" stroke-width="1.6" marker-end="url(#copy-move-semantics-arrow-c)"/>
<text x="675" y="252" text-anchor="middle" font-size="12" fill="var(--sv-muted)">a 析构无操作，b 负责释放</text>

<rect x="35" y="276" width="710" height="58" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="390" y="298" text-anchor="middle" font-size="12" fill="var(--sv-ink)">移动构造只做两件事：接管源的指针与长度，把源改成空状态（nullptr / 0）</text>
<text x="390" y="319" text-anchor="middle" font-size="12" fill="var(--sv-muted)">堆内存地址不变，没有分配、没有逐元素复制；若源没有置空，就会变成两个主人</text>
</svg>
<figcaption>图 2 · 一次移动的时序：资源所有者在 a 与 b 之间转移，堆内存本身不移动</figcaption>
</figure>
<p>标准库对被移动对象只承诺“有效但未指定状态”（valid but unspecified state）：类的不变量仍然成立，可以析构、可以重新赋值、可以调用没有前置条件的成员函数。对你自己写的类型，这个状态不是标准自动赋予的，而是你在移动构造/移动赋值里写下的契约：可以把源置为空，也可以保留其他合法状态，但不该让源继续持有同一份资源。标准库类型默认遵循这条规则（个别类型另有更具体的保证）；自己写的类型可以在文档里把状态收紧为“空”，但调用方不应把这种假设套到别人的类型上。</p>
<div class="callout callout--warn"><span class="callout__label">警告</span><div>不要假设 moved-from 对象还保存着原来的值。在未通过 empty()、size() 或布尔判断确认状态之前就解引用或下标访问，很容易触发未定义行为。移动之后立即重新赋值、clear() 或让它离开作用域，才是安全用法。调试期可以把移动构造里的源显式置空，让错误尽早暴露。</div></div>
<div class="formula">移动（典型实现）：O(1) 窃取 + 置空，而不是 O(n) 复制<br>移动后的源：有效但未指定 → 可析构、可赋值、可重置，不要读业务值<br>移动构造 noexcept（或类型不可拷贝）⇒ 容器扩容优先移动；否则退回拷贝（std::move_if_noexcept 的取舍）</div>
</section>

<section class="sec">
<h2>Rule of 0 / 3 / 5：什么时候必须手写</h2>
<p>C++98 时代有 Rule of Three：如果需要自定义析构、拷贝构造、拷贝赋值中的任意一个，通常三个都需要，因为它们共同回答“资源怎么释放、怎么复制”。C++11 增加移动操作后变成 Rule of Five。现代 C++ 更推崇 Rule of Zero：让成员（<code>std::string</code>、<code>std::vector</code>、<code>std::unique_ptr</code>、<code>std::shared_ptr</code>）各自管理资源，类本身不写任何特殊成员，编译器生成的版本自然正确。</p>
<p>隐式生成不是无条件的。声明析构、拷贝构造或拷贝赋值中的任何一个，编译器就不再隐式声明移动构造和移动赋值。此时用右值初始化会退化为拷贝，因为 <code>const T&amp;</code> 能绑定右值，性能悄悄下降而没有编译错误。反过来，声明了移动构造或移动赋值后，拷贝构造与拷贝赋值被定义为 deleted（它们仍参与重载决议，一旦调用即编译报错），类型变成 move-only，这正是 <code>std::unique_ptr</code> 的行为。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>特殊成员</th><th>典型签名</th><th>默认行为（=default）</th><th>隐式生成规则要点</th></tr></thead>
<tbody>
<tr><td>析构函数</td><td><code>~T()</code></td><td>逐成员析构</td><td>声明它会使移动操作不再被隐式声明</td></tr>
<tr><td>拷贝构造</td><td><code>T(const T&amp;)</code></td><td>逐成员拷贝构造</td><td>声明移动构造/移动赋值后定义为 deleted；成员不可拷贝时也 deleted；声明析构或拷贝赋值不改变其隐式生成</td></tr>
<tr><td>拷贝赋值</td><td><code>T&amp; operator=(const T&amp;)</code></td><td>逐成员拷贝赋值</td><td>声明移动构造/移动赋值后定义为 deleted；成员不可赋值时也 deleted；自赋值是否安全取决于各成员的赋值运算符</td></tr>
<tr><td>移动构造</td><td><code>T(T&amp;&amp;) noexcept</code></td><td>逐成员移动构造</td><td>声明析构、拷贝构造、拷贝赋值或移动赋值后不再隐式声明；异常规格由成员决定</td></tr>
<tr><td>移动赋值</td><td><code>T&amp; operator=(T&amp;&amp;) noexcept</code></td><td>逐成员移动赋值</td><td>声明析构、拷贝构造、拷贝赋值或移动构造后不再隐式声明；声明移动操作后拷贝构造/赋值被定义为 deleted</td></tr>
</tbody>
</table></div>
<p>表中移动与赋值的 noexcept 是工程约定，不是编译器自动赋予的保证：默认移动构造的异常规格取决于每个成员（以及基类）实际被选中的移动或拷贝操作，只有它们全都 noexcept 时它才是 noexcept。对容器元素类型，这个细节直接决定扩容时走移动还是拷贝。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="Rule of Five 决策树：是否直接拥有资源、是否需要拷贝、是否需要高效转移，分别导向 Rule of 0、move-only、Rule of 3 与 Rule of 5" font-family="inherit">
<defs>
<marker id="copy-move-semantics-arrow-d" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
<path d="M0,0 L9,3 L0,6 Z" fill="var(--sv-ink)"/>
</marker>
</defs>
<text x="380" y="24" text-anchor="middle" font-size="15" fill="var(--sv-ink)">从 Rule of 0 开始，逐层排除</text>
<rect x="250" y="44" width="260" height="58" rx="6" fill="var(--sv-a)" fill-opacity="0.20" stroke="var(--sv-a)"/>
<text x="380" y="68" text-anchor="middle" font-size="13" fill="var(--sv-ink)">类是否直接拥有</text>
<text x="380" y="88" text-anchor="middle" font-size="13" fill="var(--sv-ink)">需要手工释放的资源？</text>

<path d="M250 73 H120 V140" fill="none" stroke="var(--sv-ink)" stroke-width="1.4" marker-end="url(#copy-move-semantics-arrow-d)"/>
<text x="172" y="62" font-size="12" fill="var(--sv-muted)">否</text>
<rect x="30" y="145" width="180" height="82" rx="6" fill="var(--sv-b)" fill-opacity="0.20" stroke="var(--sv-b)"/>
<text x="120" y="169" text-anchor="middle" font-size="13" fill="var(--sv-ink)">Rule of 0</text>
<text x="120" y="191" text-anchor="middle" font-size="12" fill="var(--sv-muted)">成员用 string / vector /</text>
<text x="120" y="209" text-anchor="middle" font-size="12" fill="var(--sv-muted)">unique_ptr，五个都不写</text>

<path d="M380 102 V145" fill="none" stroke="var(--sv-ink)" stroke-width="1.4" marker-end="url(#copy-move-semantics-arrow-d)"/>
<text x="392" y="128" font-size="12" fill="var(--sv-muted)">是</text>
<rect x="270" y="150" width="220" height="54" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="380" y="182" text-anchor="middle" font-size="13" fill="var(--sv-ink)">需要拷贝语义吗？</text>

<path d="M490 177 H535" fill="none" stroke="var(--sv-ink)" stroke-width="1.4" marker-end="url(#copy-move-semantics-arrow-d)"/>
<text x="508" y="168" font-size="12" fill="var(--sv-muted)">否</text>
<rect x="540" y="145" width="190" height="82" rx="6" fill="var(--sv-c)" fill-opacity="0.20" stroke="var(--sv-c)"/>
<text x="635" y="169" text-anchor="middle" font-size="13" fill="var(--sv-ink)">Move-only</text>
<text x="635" y="190" text-anchor="middle" font-size="12" fill="var(--sv-muted)">析构 + 移动构造/赋值</text>
<text x="635" y="208" text-anchor="middle" font-size="12" fill="var(--sv-muted)">拷贝构造/赋值 = delete</text>

<path d="M380 204 V250" fill="none" stroke="var(--sv-ink)" stroke-width="1.4" marker-end="url(#copy-move-semantics-arrow-d)"/>
<text x="392" y="232" font-size="12" fill="var(--sv-muted)">是</text>
<rect x="270" y="255" width="220" height="50" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="380" y="285" text-anchor="middle" font-size="13" fill="var(--sv-ink)">需要高效转移资源吗？</text>

<path d="M270 280 H150 V305" fill="none" stroke="var(--sv-ink)" stroke-width="1.4" marker-end="url(#copy-move-semantics-arrow-d)"/>
<text x="200" y="270" font-size="12" fill="var(--sv-muted)">否</text>
<rect x="30" y="310" width="215" height="58" rx="6" fill="var(--sv-b2)" fill-opacity="0.22" stroke="var(--sv-b2)"/>
<text x="137" y="332" text-anchor="middle" font-size="13" fill="var(--sv-ink)">Rule of 3</text>
<text x="137" y="352" text-anchor="middle" font-size="12" fill="var(--sv-muted)">析构 + 拷贝构造 + 拷贝赋值</text>

<path d="M490 280 H610 V305" fill="none" stroke="var(--sv-ink)" stroke-width="1.4" marker-end="url(#copy-move-semantics-arrow-d)"/>
<text x="552" y="270" font-size="12" fill="var(--sv-muted)">是</text>
<rect x="515" y="310" width="215" height="58" rx="6" fill="var(--sv-a2)" fill-opacity="0.22" stroke="var(--sv-a2)"/>
<text x="622" y="332" text-anchor="middle" font-size="13" fill="var(--sv-ink)">Rule of 5</text>
<text x="622" y="352" text-anchor="middle" font-size="12" fill="var(--sv-muted)">五个全写，移动标 noexcept</text>
</svg>
<figcaption>图 3 · Rule of Five 决策树：越早停在 Rule of 0，代码越少、越不容易出错</figcaption>
</figure>
<p>实践顺序很清楚：先尝试 Rule of 0；确实要自己管理资源时才上 Rule of 5，并用 <code>=default</code> 明确表达“这个版本请编译器生成”。如果类型本来就不该被复制，用 <code>=delete</code> 禁用拷贝，而不是把拷贝构造声明为私有却不定义，后者是 C++98 的变通手法，报错更晚、信息更差。</p>
</section>

<section class="sec">
<h2>自赋值、异常安全与 copy-and-swap</h2>
<p>拷贝赋值最容易写错的地方是自赋值（self-assignment）：<code>a = a;</code>，或者通过引用、容器元素间接发生。朴素实现先 delete 自己的指针，再从 other 复制；如果 other 就是自己，源数据已经被释放，读到的是悬空指针。即使加上 <code>this != &amp;other</code> 判断，异常安全仍未解决：分配新缓冲区可能抛 <code>std::bad_alloc</code>，此时旧数据已经丢失，对象处于无法恢复的状态。</p>
<p>copy-and-swap 把两个问题一起解决。先用传入对象构造一个临时副本，这一步可能抛异常，但此刻目标对象尚未修改；然后与目标交换，临时对象析构时释放旧资源。赋值要么完整成功，要么保持原状，这叫强异常保证（strong exception guarantee）。前提是 swap 本身不抛异常，因此成员 swap 只交换指针和长度，并标记 noexcept。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;algorithm&gt;
#include &lt;cstddef&gt;
#include &lt;iostream&gt;
#include &lt;utility&gt;

class Buffer {
public:
    explicit Buffer(std::size_t n)
        : data_(n ? new int[n] : nullptr), size_(n) {}

    ~Buffer() { delete[] data_; }

    // 拷贝构造：分配新缓冲区并复制元素（深拷贝）
    Buffer(const Buffer&amp; other)
        : data_(other.size_ ? new int[other.size_] : nullptr),
          size_(other.size_) {
        if (size_ != 0) {
            std::copy(other.data_, other.data_ + size_, data_);
        }
    }

    // 移动构造：窃取指针和长度，把源置空
    Buffer(Buffer&amp;&amp; other) noexcept
        : data_(std::exchange(other.data_, nullptr)),
          size_(std::exchange(other.size_, 0)) {}

    // 拷贝赋值：copy-and-swap，强异常保证（自赋值检查只是省一次分配）
    Buffer&amp; operator=(const Buffer&amp; other) {
        if (this != &amp;other) {
            Buffer tmp(other);
            swap(tmp);
        }
        return *this;
    }

    // 移动赋值：同样借助临时对象，self-move 也安全
    Buffer&amp; operator=(Buffer&amp;&amp; other) noexcept {
        Buffer tmp(std::move(other));
        swap(tmp);
        return *this;
    }

    void swap(Buffer&amp; other) noexcept {
        std::swap(data_, other.data_);
        std::swap(size_, other.size_);
    }

    std::size_t size() const noexcept { return size_; }
    int&amp; operator[](std::size_t i) { return data_[i]; }
    const int&amp; operator[](std::size_t i) const { return data_[i]; }

private:
    int* data_;
    std::size_t size_;
};

int main() {
    Buffer a(3);
    a[0] = 1; a[1] = 2; a[2] = 3;

    Buffer b = a;              // 拷贝构造：深拷贝
    b[0] = 42;                 // a[0] 仍然是 1

    Buffer c = std::move(a);   // 移动构造：a 的 data_/size_ 被置空
    std::cout &lt;&lt; b[0] &lt;&lt; ' ' &lt;&lt; c[0] &lt;&lt; '\n';

    Buffer&amp; alias = b;
    b = alias;                 // 自赋值：仍然安全
    b = std::move(alias);      // 自移动：仍然安全
    std::cout &lt;&lt; b.size() &lt;&lt; '\n';
}</code></pre>
<p>还有更短的按值传参写法：<code>Buffer&amp; operator=(Buffer other) { swap(other); return *this; }</code>。它同时覆盖拷贝与移动，自赋值天然安全，代码只有一行。代价是：如果拷贝构造会抛异常，这个 operator= 就不应声明为 noexcept——形参在进入函数体之前构造，一旦抛出就会直接 std::terminate；而 <code>std::vector</code> 在扩容搬迁元素时依据的是 <code>is_nothrow_move_constructible</code>（类型不可拷贝时则直接用移动）；移动赋值标记 noexcept 也是良好实践，但扩容判断的不是它。对性能敏感的容器元素，分开写拷贝赋值和 noexcept 的移动赋值更稳妥。示例代码用 <code>std::exchange</code>（C++14，头文件 <code>&lt;utility&gt;</code>）把“窃取并置空”压缩成一次表达式，效果等价于先保存指针再赋 nullptr；整段代码需要以 C++14 或更高标准编译。</p>
<div class="callout callout--tip"><span class="callout__label">技巧</span><div>swap 的 noexcept 是 copy-and-swap 的地基。成员只需交换指针、长度这类标量，O(1) 且不分配；如果 swap 里可能抛异常，强异常保证就不成立，临时对象析构时还会掩盖真正的问题。</div></div>
</section>

<section class="sec">
<h2>=default、=delete 与多态的边界</h2>
<p><code>= default</code> 告诉编译器“生成默认版本”。写在类内时，它保持 inline，并在成员允许时保持 trivial 性质；更重要的是它向读者声明“这是有意为之”，而不是忘了写。<code>= delete</code> 则参与重载决议，任何调用都会在编译期报错，比 C++98 的“私有声明但不定义”更早、更清晰。例如禁用拷贝的锁守卫：<code>MutexGuard(const MutexGuard&amp;) = delete;</code>。</p>
<p>多态基类还有两条边界。第一，若打算通过基类指针 delete 派生对象，基类析构必须是 virtual，否则是未定义行为；第二，按值拷贝多态对象会发生对象切片（object slicing），派生部分被静默丢弃，通常应禁用基类的拷贝/赋值，或改用 clone 模式。至于对象大小、字节级布局、vtable 的排布和名称修饰（name mangling），标准只规定了少数约束（例如标准布局类型的成员顺序、<code>sizeof(char) == 1</code>），具体字节数与修饰规则由 ABI 决定，Itanium ABI 与 MSVC ABI 就不相同；这些细节不应写进跨平台代码的假设里。</p>
<div class="duo">
<div class="duo__col"><h4>Rule of 0 的类</h4><p>成员全是 RAII 类型，不写析构、拷贝、移动。默认逐成员操作正确，异常安全由成员继承，代码最短，也最容易保持 const 正确。</p></div>
<div class="duo__col"><h4>Rule of 5 的类</h4><p>直接持有裸指针或系统句柄，必须自己定义释放、深拷贝与所有权转移。五个函数要么全部手写，要么用 =default / =delete 明确表态。</p></div>
</div>
<p>一个常见误区是给“看起来需要优化”的类随手加移动构造，却忘了移动构造没有把源置空，结果两个对象析构同一块内存；另一个误区是在自定义析构的类上只写 <code>=default</code> 的拷贝，误以为默认版本会深拷贝。=default 只表示“按编译器规则生成”，对裸指针依然是逐成员浅拷贝，语义不会因为写了这四个字母而改变。</p>
</section>

<section class="sec">
<h2>为什么移动不总是发生：RVO 与 NRVO</h2>
<p>很多“移动优化”在源代码层面根本不存在。C++17 起，用纯右值（prvalue）初始化对象保证复制省略（guaranteed copy elision）：<code>T x = T();</code>、<code>return T();</code>、按值返回临时对象时，编译器直接在目标位置构造，既不调用拷贝也不调用移动。这不是优化开关，而是语言语义，因此即使拷贝构造被 delete，这些写法依然合法。</p>
<p>具名返回值优化（NRVO，named return value optimization）针对 <code>return local;</code>，允许省略但不强制保证。常见编译器在常规优化设置下通常都会执行，但标准不承诺，所以不能把“没有拷贝”写进正确性假设。更隐蔽的是：写成 <code>return std::move(local);</code> 反而阻止 NRVO，把一个本可原地构造的对象变成一次真实的移动，通常更慢。注意隐式移动并非 C++20 才有的规则：从 C++11 起，<code>return</code> 一个按值形参时，重载决议就按右值处理；C++20 的 P1825R0 进一步放宽了这条规则，把右值引用形参等情况也纳入，并在移动构造不可用时回退到拷贝。</p>
<p>另一类“移动没发生”来自类型与语境。const 左值不能绑定到 <code>T&amp;&amp;</code>，而 <code>std::move(const_obj)</code> 得到的是 <code>const T&amp;&amp;</code>，通常仍然匹配拷贝构造。没有移动构造的类型，<code>std::move</code> 只是把实参转成右值，重载决议仍然选择拷贝构造；对函数参数使用 std::move 只影响函数体内，调用方的实参不会自动被移动。记住 <code>std::move</code> 本身不移动任何东西，它是一个到右值引用的 static_cast，真正的移动发生在被调用的构造函数或赋值运算符里。</p>
<div class="callout callout--formula"><span class="callout__label">公式</span><div>std::move(x) 大致等价于 static_cast&lt;std::remove_reference_t&lt;decltype(x)&gt;&amp;&amp;&gt;(x)；是否真的移动，取决于重载决议以及该类型是否存在可用的移动操作。</div></div>
</section>

<section class="sec">
<h2>排障：从崩溃与性能回推所有权</h2>
<p>遇到崩溃先看所有权。double free、invalid free 多半是浅拷贝后两次析构；use-after-free 常见于移动之后继续使用源对象；内存泄漏则可能是自定义析构漏了某个分支，或拷贝赋值覆盖指针前没有释放旧资源。AddressSanitizer 能直接定位前两类问题：GCC/Clang 使用 <code>-fsanitize=address</code>，MSVC 对应 <code>/fsanitize=address</code>，具体支持范围随版本与平台而异。</p>
<p>性能问题看 noexcept 与拷贝次数。移动构造漏写 noexcept，会让可拷贝类型在 <code>std::vector</code> 扩容搬迁元素时被选择拷贝而不是移动；移动赋值也应尽量标记 noexcept，它参与决定 <code>std::swap</code> 等泛型组件的异常规格，但 vector 扩容判断的是移动构造，不是移动赋值。可以在类型上加 <code>static_assert(std::is_nothrow_move_constructible_v&lt;T&gt;);</code>（C++17，需要 <code>&lt;type_traits&gt;</code>）把约定变成编译期检查；但要注意，这个 trait 问的是“用 <code>T&amp;&amp;</code> 构造是否不抛”，只有 noexcept 拷贝构造、没有移动构造的类型也会返回 true，所以它不能证明移动构造存在。另一个常见来源是函数按值返回容器时误写 <code>return std::move(v);</code>，抑制了 NRVO。排查顺序应当是：先确认这里“应该发生拷贝还是移动”，再用编译器的复制消除报告或性能剖析验证，而不是凭直觉到处加 std::move。</p>
<ul>
<li>看到两个对象内容互相影响：检查是否浅拷贝，尤其是裸指针、C 风格数组、文件句柄。</li>
<li>看到容器扩容变慢：检查元素类型的移动构造是否 noexcept，以及是否真的被声明。</li>
<li>看到移动后数据异常：检查源对象是否被读取；移动构造/赋值是否把源置空。</li>
<li>看到赋值崩溃：检查自赋值分支和旧资源释放顺序，优先改成 copy-and-swap。</li>
</ul>
</section>

<section class="sec">
<h2>自测</h2>
<details class="quiz"><summary>Q1 · 一个类持有裸指针并自定义了析构函数，但没有写拷贝构造，默认拷贝会发生什么？</summary><div class="quiz__a">默认拷贝构造逐成员复制指针，两个对象指向同一块堆内存，析构时 delete 两次，典型结果是 double free。更隐蔽的是：声明析构函数会抑制移动操作的隐式声明，所以即使用右值初始化，也会退化为拷贝。修复方式是改用 <code>std::vector</code> / <code>std::unique_ptr</code>（Rule of 0），或按 Rule of 5 手写深拷贝与移动。</div></details>
<details class="quiz"><summary>Q2 · 为什么移动构造通常要标记 noexcept？</summary><div class="quiz__a">标准库容器扩容时要在“移动旧元素”和“拷贝旧元素”之间选择。为了维持强异常保证，<code>std::vector</code> 通过 <code>std::move_if_noexcept</code> 判断：移动构造不是 noexcept 且类型可拷贝时，它会选择拷贝，避免移动中途抛异常导致容器处于半迁移状态；类型不可拷贝时则只能用移动。因此漏写 noexcept 不会报错，却会让可拷贝类型的扩容悄悄变慢。</div></details>
<details class="quiz"><summary>Q3 · return std::move(local); 为什么可能比 return local; 更慢？</summary><div class="quiz__a">return local; 允许 NRVO，编译器可以直接在调用方提供的空间里构造 local，连移动都省掉。写成 return std::move(local); 后，返回表达式是右值引用，NRVO 不再适用，只能执行一次真实的移动构造；若类型没有移动构造，还会退回复制。另外，按值形参在 return 时自 C++11 起就按右值处理，C++20 又把这一隐式移动扩展到右值引用形参等情形，都不需要手写 std::move。</div></details>
<details class="quiz"><summary>Q4 · 被移动后的对象还能做什么？</summary><div class="quiz__a">标准库类型被移动后只保证处于有效但未指定状态：不变量成立，可以安全析构、重新赋值，或调用没有前置条件的成员函数。但不能假设它为空，也不能读取它的业务值。标准库类型的具体值不作保证；自定义类型可以在文档中承诺更强的状态（例如一定为空），但调用方不应把这种承诺推广到其他类型。</div></details>
</section>

<section class="sec">
<h2>延伸阅读</h2>
<ul class="refs">
<li><b>cppreference · Copy constructors</b> — cppreference.com。拷贝构造的语法、隐式声明条件与 deleted 规则，查细节最可靠。</li>
<li><b>cppreference · Move constructors</b> — cppreference.com。移动构造的隐式生成、异常规格与 move-only 类型的形成过程。</li>
<li><b>cppreference · Rule of three/five/zero</b> — cppreference.com。三/五/零法则的由来，以及五法则与隐式生成规则的关系。</li>
<li><b>C++ Core Guidelines C.20–C.22</b> — Bjarne Stroustrup 与 Herb Sutter。Rule of Zero / Three / Five 的权威表述与示例。</li>
<li><b>C++ Core Guidelines C.60–C.66</b> — Bjarne Stroustrup 与 Herb Sutter。拷贝与移动赋值的签名、自赋值安全、移动后源状态与 noexcept 建议。</li>
<li><b>《Effective Modern C++》条款 17、25</b> — Scott Meyers，2014。条款 17 讲特殊成员函数的生成规则，条款 25 讲右值引用上的 std::move 与 std::forward。</li>
</ul>
</section>`
};
