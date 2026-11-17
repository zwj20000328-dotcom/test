window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["operator-overloading"] = {
  slug: "operator-overloading",
  title: "运算符重载与代理类型",
  subtitle: "让自定义类型像内建类型一样自然",
  level: 1,
  cluster: "语言核心",
  tags: ["运算符", "代理对象", "比较"],
  summary: "从“运算符就是函数调用”出发，讲清可重载边界、成员与非成员的选择、返回值设计、三路比较与代理对象，并给出可编译的 C++20 示例与常见误区。",
  keyPoints: [
    "运算符重载不改变优先级和结合性，只是把表达式翻译成函数调用；先想清楚翻译成谁，再决定写不写",
    "必须成员的是 =、-> 和类型转换；[] 与 () 传统上也是成员，C++23 起可声明为 static；对称二元运算符应写成非成员（常用 hidden friend）",
    "返回类型按语义选择：产生新值返回 T，修改自身返回 T&，观察返回 bool 或比较类别",
    "C++20 的 <=> 把六种比较收敛成三种顺序类别；默认定义按成员字典序比较",
    "代理对象用“像引用”的中间对象换取存储灵活性，代价是 auto、取地址和生命周期上的陷阱"
  ],
  readingMinutes: 14,
  html: String.raw`
<section class="sec">
<h2>1. 直觉：运算符是函数调用的另一种写法</h2>
<p>当你写 <code>a + b</code>，编译器并不“知道”加法的含义；它先把表达式翻译成一次函数调用：要么是 <code>a.operator+(b)</code>（成员形式），要么是 <code>operator+(a, b)</code>（非成员形式）。运算符重载（operator overloading）做的就是给这个函数提供一个你自己类型的版本。语法、优先级、结合性都不变，变的只是“这个符号对你的类型意味着什么”。</p>
<p>把这条翻译规则记牢，后面几乎所有规则都能推出来：<code>a += b</code> 调用 <code>a.operator+=(b)</code>；<code>a[i]</code> 调用 <code>a.operator[](i)</code>；<code>a(i, j)</code> 调用 <code>a.operator()(i, j)</code>；<code>a-&gt;x</code> 先调用 <code>a.operator-&gt;()</code>，再对返回值继续使用 <code>-&gt;</code>；<code>static_cast&lt;T&gt;(a)</code> 调用 <code>a.operator T()</code>；C++20 里 <code>a &lt; b</code> 可以改写成 <code>(a &lt;=&gt; b) &lt; 0</code>。运算符也能像普通函数一样显式调用，例如 <code>a.operator+(b)</code>，这在排查重载决议时很有用。</p>
<p>但“能翻译”不等于“能编译”：编译器收集成员与非成员候选（普通查找加实参依赖查找，argument-dependent lookup，ADL），做重载决议，再检查访问权限。理解这个顺序，才能解释成员与非成员的行为差异。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>运算符重载不是给语言增加新符号，而是给已有符号增加一个新解释。先问“这个表达式该翻译成哪个函数”，再问“这个函数该不该存在”，大部分设计问题就消失了。</div></div>
</section>

<section class="sec">
<h2>2. 哪些能重载，哪些不能</h2>
<p>C++ 允许重载的运算符是一张固定清单。你不能新增运算符（比如造一个 <code>**</code> 表示幂），不能改变元数（arity，即操作数个数），也不能改变优先级和结合性。还有一条硬边界：除 <code>operator new</code> / <code>delete</code> 这类分配函数外，重载版本至少有一个操作数必须是类类型或枚举类型，不能只针对两个 <code>int</code> 定义 <code>operator+</code>。</p>
<p>下表按用途分组。几个容易记错的点提前标出：<code>operator=</code>、<code>operator-&gt;</code> 和类型转换运算符必须是非静态成员函数；<code>operator[]</code> 与 <code>operator()</code> 传统上也是非静态成员，但 C++23 起可以声明为 <code>static</code>（<code>operator()</code> 见 P1169R4）；<code>operator.*</code> 不可重载，但 <code>operator-&gt;*</code> 可以；<code>operator new</code> / <code>operator delete</code> 可以作为类的静态成员或全局函数。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>类别</th><th>运算符</th><th>能否重载</th><th>说明</th></tr></thead>
<tbody>
<tr><td>算术</td><td><code>+ - * / %</code></td><td>可以</td><td>对称二元运算通常写非成员</td></tr>
<tr><td>位运算</td><td><code>&amp; | ^ ~ &lt;&lt; &gt;&gt;</code></td><td>可以</td><td><code>&lt;&lt;</code> / <code>&gt;&gt;</code> 常被借用作流运算符</td></tr>
<tr><td>逻辑</td><td><code>! &amp;&amp; ||</code></td><td><code>!</code> 可以；<code>&amp;&amp;</code> / <code>||</code> 技术上可以但不该</td><td><code>&amp;&amp;</code> / <code>||</code> 重载后失去短路求值</td></tr>
<tr><td>比较</td><td><code>== != &lt; &lt;= &gt; &gt;= &lt;=&gt;</code></td><td>可以，<code>&lt;=&gt;</code> 为 C++20</td><td>建议成对提供 <code>==</code> 与 <code>&lt;=&gt;</code></td></tr>
<tr><td>赋值</td><td><code>= += -= *= /= %=</code> 等</td><td>可以</td><td><code>=</code> 必须是非静态成员；复合赋值建议成员</td></tr>
<tr><td>自增自减</td><td><code>++ --</code></td><td>可以</td><td>前后置用哑元 <code>int</code> 区分</td></tr>
<tr><td>逗号</td><td><code>,</code></td><td>可以但不该</td><td>重载后失去从左到右的顺序保证</td></tr>
<tr><td>下标 / 调用</td><td><code>[] ()</code></td><td>可以</td><td>通常必须是非静态成员；C++23 起可为 <code>static</code>，且 <code>[]</code> 可多参数</td></tr>
<tr><td>成员访问</td><td><code>-&gt; -&gt;*</code></td><td><code>-&gt;</code> 可以；<code>.*</code> 不可</td><td><code>-&gt;</code> 必须返回指针或可继续解引用的对象</td></tr>
<tr><td>类型转换</td><td><code>operator T()</code></td><td>可以</td><td>必须是非静态成员；转 <code>bool</code> 建议 <code>explicit</code></td></tr>
<tr><td>内存管理</td><td><code>new new[] delete delete[]</code></td><td>可以</td><td>类内版本隐式为静态</td></tr>
<tr><td>其他</td><td><code>. :: ?: sizeof typeid alignof</code></td><td>不可</td><td>由语言直接定义，无法改变</td></tr>
</tbody>
</table></div>
<p>不可重载的符号里，<code>.</code>、<code>::</code>、<code>?:</code>、<code>sizeof</code>、<code>typeid</code>、<code>alignof</code>、<code>noexcept</code> 以及 <code>static_cast</code> 等显式转换语法都由语言固定；预处理符号 <code>#</code> 和 <code>##</code> 更不属于运算符。把它们排除之后，真正值得重载的空间其实不大：算术、比较、赋值、下标、调用、流和转换，基本就这些。</p>
<p>别把“语法上允许”误当成“语义上合适”：重载不能恢复短路求值和求值顺序，这正是 <code>&amp;&amp;</code>、<code>||</code> 与逗号运算符不该重载的原因，第 7 节展开。</p>
</section>

<section class="sec">
<h2>3. 成员还是非成员：看左操作数</h2>
<p>选成员还是非成员，核心问题只有一个：<mark>左操作数需不需要隐式转换</mark>。成员运算符的左操作数就是对象本身，它不会为了匹配而把别的类型转换成 <code>T</code>；所以 <code>a + 1.0</code> 这种“右操作数是别的类型”通常没问题，而 <code>1.0 + a</code> 若 <code>operator+</code> 是成员，就找不到候选。</p>
<p>经验规则可以背下来：对称的二元运算符（<code>==</code>、<code>!=</code>、<code>&lt;</code>、<code>&lt;=</code>、<code>&gt;</code>、<code>&gt;=</code>、<code>&lt;=&gt;</code>、<code>+</code>、<code>-</code>、<code>*</code>、<code>/</code>）写成非成员，通常实现为友元（C++20 起通常只需写 <code>==</code> 与 <code>&lt;=&gt;</code>，其余比较由编译器重写生成）；复合赋值（<code>+=</code>、<code>-=</code> 等）写成员，因为它修改左操作数，而左操作数必须已经是 <code>T</code>；流运算符必须非成员，因为左操作数是 <code>std::ostream</code>；赋值、箭头和类型转换必须是成员，下标与调用通常也写成成员（C++23 起二者可以声明为 <code>static</code>）。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="运算符放置决策图：必须成员、通常非成员、必须非成员，以及左操作数判据">
<defs>
<marker id="operator-overloading-ar1" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
<path d="M0,0 L6,3 L0,6 Z" fill="var(--sv-muted)"/>
</marker>
</defs>
<text x="380" y="26" font-size="16" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle" font-weight="bold">运算符放哪里：先看左操作数</text>
<rect x="300" y="42" width="160" height="36" rx="18" fill="var(--sv-bg)" stroke="var(--sv-ink)" stroke-width="1.5"/>
<text x="380" y="65" font-size="14" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">要重载的运算符</text>
<line x1="345" y1="78" x2="150" y2="104" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#operator-overloading-ar1)"/>
<line x1="380" y1="78" x2="380" y2="104" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#operator-overloading-ar1)"/>
<line x1="415" y1="78" x2="610" y2="104" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#operator-overloading-ar1)"/>
<rect x="20" y="108" width="230" height="168" rx="10" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="1.5"/>
<text x="135" y="134" font-size="14" font-family="inherit" fill="var(--sv-a)" text-anchor="middle" font-weight="bold">通常必须是非静态成员</text>
<text x="36" y="162" font-size="12" font-family="inherit" fill="var(--sv-ink)">operator=　operator[]</text>
<text x="36" y="186" font-size="12" font-family="inherit" fill="var(--sv-ink)">operator()　operator-&gt;</text>
<text x="36" y="210" font-size="12" font-family="inherit" fill="var(--sv-ink)">operator T()（转换）</text>
<text x="36" y="234" font-size="12" font-family="inherit" fill="var(--sv-muted)">++ / --、复合赋值通常写成员</text>
<text x="36" y="260" font-size="12" font-family="inherit" fill="var(--sv-muted)">但不是语言强制要求</text>
<rect x="265" y="108" width="230" height="168" rx="10" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-width="1.5"/>
<text x="380" y="134" font-size="14" font-family="inherit" fill="var(--sv-b)" text-anchor="middle" font-weight="bold">通常写成非成员</text>
<text x="281" y="162" font-size="12" font-family="inherit" fill="var(--sv-ink)">==　!=　&lt;　&lt;=　&gt;　&gt;=</text>
<text x="281" y="186" font-size="12" font-family="inherit" fill="var(--sv-ink)">&lt;=&gt;　+　-　*　/</text>
<text x="281" y="210" font-size="12" font-family="inherit" fill="var(--sv-ink)">常实现为 hidden friend</text>
<text x="281" y="236" font-size="12" font-family="inherit" fill="var(--sv-muted)">两侧都能隐式转换</text>
<text x="281" y="260" font-size="12" font-family="inherit" fill="var(--sv-muted)">只经 ADL 被找到</text>
<rect x="510" y="108" width="230" height="168" rx="10" fill="var(--sv-panel)" stroke="var(--sv-c)" stroke-width="1.5"/>
<text x="625" y="134" font-size="14" font-family="inherit" fill="var(--sv-c)" text-anchor="middle" font-weight="bold">必须是非成员</text>
<text x="526" y="162" font-size="12" font-family="inherit" fill="var(--sv-ink)">operator&lt;&lt;　operator&gt;&gt;</text>
<text x="526" y="186" font-size="12" font-family="inherit" fill="var(--sv-ink)">左操作数是流对象</text>
<text x="526" y="210" font-size="12" font-family="inherit" fill="var(--sv-ink)">返回流引用以支持链式</text>
<text x="526" y="236" font-size="12" font-family="inherit" fill="var(--sv-muted)">成员版本要求左操作数</text>
<text x="526" y="260" font-size="12" font-family="inherit" fill="var(--sv-muted)">是本类型，无法匹配</text>
<rect x="40" y="298" width="680" height="58" rx="10" fill="var(--sv-bg)" stroke="var(--sv-line)" stroke-dasharray="6 5"/>
<text x="60" y="322" font-size="13" font-family="inherit" fill="var(--sv-ink)">判据一：左操作数需要隐式转换？需要 → 只能非成员</text>
<text x="60" y="344" font-size="13" font-family="inherit" fill="var(--sv-ink)">判据二：对称 → 非成员；修改自身 → 成员</text>
</svg>
<figcaption>图 1 · 先按“是否必须成员”分流，再用左操作数判据检查；这张图不涉及优先级与语义是否合理。C++23 起 <code>operator()</code> 与 <code>operator[]</code> 可以声明为 <code>static</code>。</figcaption>
</figure>
<div class="callout callout--tip"><span class="callout__label">技巧</span><div>把友元函数直接定义在类体内（hidden friend），它只能通过 ADL 找到，不会出现在普通名字查找的候选集里，因此不会污染无关类型的重载集合。这是现代 C++ 定义对称运算符的推荐写法。</div></div>
<p>返回值设计可以浓缩成一条规则：<b>产生新值就按值返回，修改左操作数就返回 <code>T&amp;</code>，只做观察就返回 <code>bool</code> 或比较类别</b>。<code>operator+</code> 返回 <code>T</code>（不要返回 <code>const T</code>，那会挡住移动）；<code>operator+=</code> 返回 <code>*this</code> 的引用，才能链式 <code>a += b += c</code>；前置 <code>++</code> 返回 <code>T&amp;</code>，后置 <code>++</code> 返回旧值的副本，参数列表里的 <code>int</code> 只是区分用的哑元，不参与运算。</p>
<div class="formula">新值 → T（按值）　修改自身 → T&amp;<br>观察 → bool / 比较类别　只读访问 → const T&amp;<br>可写访问 → T&amp; 或代理对象</div>
<p>返回引用时务必确认被引用对象的生命周期。<code>operator+</code> 返回局部变量是悬垂引用；<code>operator[]</code> 返回容器内元素的引用则是正确的。也不要为了“防止 <code>a + b = c</code>”而返回 <code>const T</code>——那会让返回值无法移动。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>表达式</th><th>典型签名</th><th>返回</th><th>放置</th></tr></thead>
<tbody>
<tr><td><code>a + b</code></td><td><code>T operator+(T, const T&amp;)</code></td><td><code>T</code></td><td>非成员</td></tr>
<tr><td><code>a += b</code></td><td><code>T&amp; T::operator+=(const T&amp;)</code></td><td><code>T&amp;</code></td><td>成员</td></tr>
<tr><td><code>a == b</code></td><td><code>bool operator==(const T&amp;, const T&amp;)</code></td><td><code>bool</code></td><td>非成员</td></tr>
<tr><td><code>a &lt;=&gt; b</code></td><td><code>std::strong_ordering operator&lt;=&gt;(const T&amp;, const T&amp;)</code></td><td>比较类别</td><td>非成员</td></tr>
<tr><td><code>os &lt;&lt; a</code></td><td><code>std::ostream&amp; operator&lt;&lt;(std::ostream&amp;, const T&amp;)</code></td><td><code>std::ostream&amp;</code></td><td>非成员</td></tr>
<tr><td><code>a[i]</code></td><td><code>T&amp; T::operator[](std::size_t)</code></td><td><code>T&amp;</code> 或代理</td><td>成员</td></tr>
<tr><td><code>a(i)</code></td><td><code>R T::operator()(Args...)</code></td><td>自定义</td><td>成员</td></tr>
<tr><td><code>a-&gt;x</code></td><td><code>T* T::operator-&gt;()</code></td><td>指针 / 代理</td><td>成员</td></tr>
<tr><td><code>if (a)</code></td><td><code>explicit operator bool() const</code></td><td><code>bool</code></td><td>成员</td></tr>
<tr><td><code>++a</code> / <code>a++</code></td><td><code>T&amp; T::operator++()</code> / <code>T T::operator++(int)</code></td><td><code>T&amp;</code> / <code>T</code></td><td>成员</td></tr>
</tbody>
</table></div>
</section>

<section class="sec">
<h2>4. 比较运算符与三路比较 &lt;=&gt;</h2>
<p>C++20 之前，要让一个类型可比较，往往得写六个函数（<code>==</code>、<code>!=</code>、<code>&lt;</code>、<code>&lt;=</code>、<code>&gt;</code>、<code>&gt;=</code>），还要保证它们彼此一致。C++20 引入了三路比较运算符 <code>operator&lt;=&gt;</code>（three-way comparison，俗称 spaceship operator），一次给出“小于 / 等于 / 大于”的关系，再由编译器派生其余比较。</p>
<p>派生规则是：<code>a &lt; b</code> 改写为 <code>(a &lt;=&gt; b) &lt; 0</code>；<code>a &lt;= b</code> 改写为 <code>(a &lt;=&gt; b) &lt;= 0</code>；<code>a &gt; b</code> 改写为 <code>0 &lt; (a &lt;=&gt; b)</code>；<code>a &gt;= b</code> 改写为 <code>0 &lt;= (a &lt;=&gt; b)</code>。<code>a != b</code> 由 <code>a == b</code> 取反得到。注意 <code>==</code> 不会从用户自定义的 <code>&lt;=&gt;</code> 自动生成；但 <code>&lt;=&gt;</code> 写成 <code>= default</code>、且类里没有声明 <code>==</code> 时，编译器会隐式声明默认的 <code>==</code>。所以推荐让两者成对出现，或都 <code>= default</code>。</p>
<p><code>&lt;=&gt;</code> 的返回类型不是 <code>bool</code>，而是三种比较类别之一：<code>std::strong_ordering</code>、<code>std::weak_ordering</code>、<code>std::partial_ordering</code>。它们都能和字面量 <code>0</code> 比较。选哪一种，取决于你的“相等”是否真的可替换（substitutability）：</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="三路比较的三种返回类型：strong、weak、partial 的语义与例子">
<defs>
<marker id="operator-overloading-ar3" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
<path d="M0,0 L6,3 L0,6 Z" fill="var(--sv-muted)"/>
</marker>
</defs>
<text x="380" y="26" font-size="16" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle" font-weight="bold">三路比较返回什么：看“相等”有多强</text>
<rect x="40" y="52" width="280" height="70" rx="10" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="1.5"/>
<text x="58" y="80" font-size="14" font-family="inherit" fill="var(--sv-a)" font-weight="bold">std::strong_ordering</text>
<text x="58" y="104" font-size="12" font-family="inherit" fill="var(--sv-ink)">全序：a == b 时两者可互换</text>
<rect x="40" y="144" width="280" height="70" rx="10" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-width="1.5"/>
<text x="58" y="172" font-size="14" font-family="inherit" fill="var(--sv-b)" font-weight="bold">std::weak_ordering</text>
<text x="58" y="196" font-size="12" font-family="inherit" fill="var(--sv-ink)">全序的等价类：相等但不必可互换</text>
<rect x="40" y="236" width="280" height="70" rx="10" fill="var(--sv-panel)" stroke="var(--sv-c)" stroke-width="1.5"/>
<text x="58" y="264" font-size="14" font-family="inherit" fill="var(--sv-c)" font-weight="bold">std::partial_ordering</text>
<text x="58" y="288" font-size="12" font-family="inherit" fill="var(--sv-ink)">偏序：允许“无序”这第四种结果</text>
<text x="348" y="80" font-size="12" font-family="inherit" fill="var(--sv-muted)">典型：int、std::string</text>
<text x="348" y="100" font-size="12" font-family="inherit" fill="var(--sv-muted)">默认成员全是强序时取这一类</text>
<text x="348" y="172" font-size="12" font-family="inherit" fill="var(--sv-muted)">典型：大小写不敏感的字符串</text>
<text x="348" y="192" font-size="12" font-family="inherit" fill="var(--sv-muted)">典型：按绝对值比较的整数</text>
<text x="348" y="264" font-size="12" font-family="inherit" fill="var(--sv-muted)">典型：含 float / double 成员</text>
<text x="348" y="284" font-size="12" font-family="inherit" fill="var(--sv-muted)">NaN 与任何值都不可比</text>
<rect x="610" y="66" width="120" height="30" rx="15" fill="var(--sv-bg)" stroke="var(--sv-a)"/>
<text x="670" y="86" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">−1 / 0 / +1</text>
<rect x="610" y="158" width="120" height="30" rx="15" fill="var(--sv-bg)" stroke="var(--sv-b)"/>
<text x="670" y="178" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">−1 / 0 / +1</text>
<rect x="602" y="250" width="136" height="30" rx="15" fill="var(--sv-bg)" stroke="var(--sv-c)"/>
<text x="670" y="270" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">−1 / 0 / +1 / 无序</text>
<line x1="40" y1="334" x2="730" y2="334" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#operator-overloading-ar3)"/>
<text x="40" y="356" font-size="12" font-family="inherit" fill="var(--sv-muted)">可比性由强到弱</text>
<text x="730" y="356" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">默认 &lt;=&gt; 取所有基类与成员类别的公共类别</text>
</svg>
<figcaption>图 2 · 三种比较类别：strong 保证可替换，weak 只保证等价关系，partial 承认存在不可比值。</figcaption>
</figure>
<p>当成员里有 <code>double</code> 或 <code>float</code> 时，默认的 <code>&lt;=&gt;</code> 会推导出 <code>std::partial_ordering</code>，因为 NaN（Not a Number）与任何值都不可比。这是标准语义，不是实现细节：<code>partial_ordering</code> 允许“无序”这个结果。若你的领域里 NaN 不合法（比如金额），可以在构造时拒绝，并手写返回 <code>strong_ordering</code> 的 <code>&lt;=&gt;</code>，让类型系统表达这个不变量；严格说还要确认 <code>-0.0</code> 与 <code>+0.0</code> 的差异不影响可替换性，否则更诚实的类别是 <code>weak_ordering</code>。默认的 <code>&lt;=&gt;</code> 按基类与成员的声明顺序做字典序比较，类似 C++11 时代 <code>std::tie</code> 的写法。它要求所有参与比较的基类与成员自身可比较，否则默认定义会被删除；默认的 <code>==</code> 同样逐基类与成员比较。还有一条正确性要求：<b><code>operator&lt;</code> 必须满足严格弱序（strict weak ordering）</b>——不可自反、传递、等价类传递，否则把对象放进 <code>std::sort</code>、<code>std::set</code> 就是未定义行为。</p>
<div class="formula">a &lt; b ≡ (a &lt;=&gt; b) &lt; 0　　a &lt;= b ≡ (a &lt;=&gt; b) &lt;= 0<br>a &gt; b ≡ 0 &lt; (a &lt;=&gt; b)　　a &gt;= b ≡ 0 &lt;= (a &lt;=&gt; b)<br>a != b ≡ !(a == b)</div>
</section>

<section class="sec">
<h2>5. 流、下标、调用与类型转换</h2>
<p>流运算符 <code>operator&lt;&lt;</code> 与 <code>operator&gt;&gt;</code> 对自定义类型必须是非成员，惯用签名为 <code>std::ostream&amp; operator&lt;&lt;(std::ostream&amp;, const T&amp;)</code>，返回流本身的引用才能链式输出。实现时只写数据，不要在运算符里偷偷加换行或 flush：<code>std::endl</code> 会 flush，代价可能很高；需要换行就输出 <code>'\n'</code>。输入运算符要处理解析失败，失败时设置流的 failbit，并保证对象仍处于有效状态。</p>
<p>下标运算符通常成对出现：非 const 版本返回 <code>T&amp;</code>，const 版本返回 <code>const T&amp;</code>。若返回的是代理而不是真正的引用，返回类型就不再是 <code>T&amp;</code>，而是一个按值传递的代理，第 6 节会看到标准库的例子。C++23 起 <code>operator[]</code> 可以接受多个参数（P2128），二维容器可以写 <code>m[i, j]</code>，本质仍是 <code>m.operator[](i, j)</code>。</p>
<p>函数调用运算符 <code>operator()</code> 让对象成为函数对象（functor）。它的好处是能携带状态，并且容易内联；可以重载多个版本，也可以是变参模板。C++23 起还允许声明为 static（P1169R4）。捕获了变量的 lambda，本质上就是编译器生成的一个带 <code>operator()</code> 的类。</p>
<p>类型转换运算符 <code>operator T()</code> 决定“这个类型能变成什么”。最重要的实践是：<b>转成 <code>bool</code> 时一律加 <code>explicit</code></b>（C++11 起）。<code>explicit operator bool</code> 仍然能在 <code>if</code>、<code>while</code>、<code>!</code>、<code>&amp;&amp;</code>、<code>||</code>、<code>?:</code> 这些语境里使用，这叫语境转换（contextual conversion），但它不会参与算术运算，也不会和别的转换运算符一起制造意外匹配。<code>if (std::cin &gt;&gt; x)</code> 能工作，靠的就是 <code>std::basic_ios</code> 的 explicit <code>operator bool</code>。不要同时提供多条隐式转换路径：隐式转换序列最多允许一次用户定义转换，但之后还能接标准转换（比如 <code>bool</code> 再提升为 <code>int</code>），这会让重载决议出现难以理解的歧义。若确实需要多种表示，用命名函数而不是转换运算符。需要格式化时，C++20 的 <code>std::format</code> 与 C++23 的 <code>std::print</code> 是更现代的选择。</p>
</section>

<section class="sec">
<h2>6. 代理对象：看起来像引用，其实是一个对象</h2>
<p>代理对象（proxy object）是一个“冒充”内建类型的中间对象：它重载必要的运算符和转换，让调用方以为在用 <code>bool&amp;</code>、矩阵行或指针，实际每次操作都转交给底层表示。最著名的例子是 <code>std::vector&lt;bool&gt;</code>。</p>
<p><code>std::vector&lt;bool&gt;</code> 把多个 bool 压进同一个存储字（典型实现每位一个；标准只要求空间高效，打包方式取决于标准库实现）。因此 <code>v[i]</code> 无法返回 <code>bool&amp;</code>——单个 bit 不是独立对象。它返回 <code>std::vector&lt;bool&gt;::reference</code>：典型实现是一个“存储字指针 + 位掩码”的代理，赋值改位、转 bool 读位。后果是：</p>
<ul>
<li><code>auto bit = v[0]</code> 复制的是代理，不是 bool；对 <code>bit</code> 赋值仍会改到 <code>v</code>。</li>
<li><code>bool&amp; r = v[0]</code> 无法编译；<code>std::vector&lt;bool&gt;</code> 没有 <code>data()</code>，<code>&amp;v[0]</code> 也不合法。</li>
<li>它不满足标准容器“元素可寻址、可连续存储”的全部要求；需要稳定地址时用 <code>std::vector&lt;char&gt;</code>（或 <code>std::array&lt;char, N&gt;</code>）。<code>std::bitset</code> 适合定长位集合，但同样不能对单个位取地址。</li>
</ul>
<p>同样的套路出现在 <code>std::bitset&lt;N&gt;::reference</code> 和矩阵库的行代理（<code>m[i]</code> 返回一行视图）。代理把“存储表示”与“使用接口”解耦；代价是类型不再是用户以为的那个，<code>auto</code> 推导、模板推导和取地址都会暴露它。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="朴素临时量写法与表达式模板的对比示意，以及代理对象持有引用的风险">
<defs>
<marker id="operator-overloading-ar2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
<path d="M0,0 L6,3 L0,6 Z" fill="var(--sv-muted)"/>
</marker>
</defs>
<text x="380" y="24" font-size="16" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle" font-weight="bold">同一个表达式的两种求值方式（表达式模板为示意）</text>
<rect x="20" y="42" width="350" height="246" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-width="1.5"/>
<text x="36" y="66" font-size="13" font-family="inherit" fill="var(--sv-a)" font-weight="bold">朴素写法：每步产生临时容器</text>
<rect x="40" y="82" width="130" height="36" rx="6" fill="var(--sv-bg)" stroke="var(--sv-a)"/>
<text x="105" y="105" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">t1 = a + b</text>
<line x1="170" y1="100" x2="192" y2="100" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#operator-overloading-ar2)"/>
<rect x="196" y="82" width="156" height="36" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="274" y="105" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">写入 1 个临时矩阵</text>
<rect x="40" y="138" width="130" height="36" rx="6" fill="var(--sv-bg)" stroke="var(--sv-a)"/>
<text x="105" y="161" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">t2 = t1 + c</text>
<line x1="170" y1="156" x2="192" y2="156" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#operator-overloading-ar2)"/>
<rect x="196" y="138" width="156" height="36" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="274" y="161" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">再写入 1 个临时矩阵</text>
<text x="40" y="208" font-size="12" font-family="inherit" fill="var(--sv-ink)">最终 y = t2：共 3 次遍历</text>
<text x="40" y="232" font-size="12" font-family="inherit" fill="var(--sv-ink)">峰值多出 2 个矩阵的内存</text>
<text x="40" y="264" font-size="12" font-family="inherit" fill="var(--sv-c)">时间与内存都随链长线性增长</text>
<rect x="390" y="42" width="350" height="246" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-width="1.5"/>
<text x="406" y="66" font-size="13" font-family="inherit" fill="var(--sv-b)" font-weight="bold">表达式模板：先建节点，赋值时求值</text>
<rect x="510" y="82" width="120" height="32" rx="6" fill="var(--sv-bg)" stroke="var(--sv-b)"/>
<text x="570" y="103" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">AddExpr&lt;...&gt;</text>
<rect x="430" y="138" width="120" height="32" rx="6" fill="var(--sv-bg)" stroke="var(--sv-b)"/>
<text x="490" y="159" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">AddExpr&lt;...&gt;</text>
<rect x="608" y="138" width="90" height="32" rx="6" fill="var(--sv-bg)" stroke="var(--sv-a)"/>
<text x="653" y="159" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">Vec c</text>
<rect x="402" y="196" width="76" height="30" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="440" y="216" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">Vec a</text>
<rect x="494" y="196" width="76" height="30" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="532" y="216" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">Vec b</text>
<line x1="540" y1="114" x2="500" y2="138" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#operator-overloading-ar2)"/>
<line x1="600" y1="114" x2="645" y2="138" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#operator-overloading-ar2)"/>
<line x1="470" y1="170" x2="448" y2="196" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#operator-overloading-ar2)"/>
<line x1="510" y1="170" x2="530" y2="196" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#operator-overloading-ar2)"/>
<text x="406" y="252" font-size="12" font-family="inherit" fill="var(--sv-ink)">auto e = a + b + c;　只记录节点与引用</text>
<text x="406" y="274" font-size="12" font-family="inherit" fill="var(--sv-ink)">Vec y = e;　触发逐元素求值，只遍历一次</text>
<rect x="40" y="304" width="680" height="56" rx="10" fill="var(--sv-bg)" stroke="var(--sv-c)" stroke-width="1.5"/>
<text x="58" y="328" font-size="12" font-family="inherit" fill="var(--sv-c)">风险一：节点持有操作数引用；其中任何一个是临时量，表达式对象就悬垂。</text>
<text x="58" y="348" font-size="12" font-family="inherit" fill="var(--sv-c)">风险二：别名——a = a.transpose() 这类原地赋值可能读到已覆盖的数据，需要显式求值。</text>
</svg>
<figcaption>图 3 · 左：每步落盘的临时量；右：表达式模板把计算推迟到赋值，用一次遍历换取更少的临时内存。</figcaption>
</figure>
<p>表达式模板（expression templates）是代理的进阶用法：<code>a + b</code> 不立即计算，而是返回记录“操作与操作数引用”的表达式对象；赋值给具体容器时才逐元素求值，省掉中间临时量。Eigen、Blaze、xtensor 都采用这种设计。日常业务代码不必自己实现，但要记住两个坑。第一，表达式对象通常持有操作数的引用。写 <code>auto e = a + b;</code> 后若操作数是临时量，<code>e</code> 就悬垂；应让结果落到具体类型，如 <code>MatrixXf e = a + b;</code>。第二，别名（aliasing）：输入与输出是同一块内存时，逐元素求值可能读到已覆盖的数据，例如 <code>a = a.transpose()</code>，需要 <code>.eval()</code> 或临时量。这两点是惰性求值的固有约束，不是实现瑕疵。</p>
<div class="callout callout--warn"><span class="callout__label">当心</span><div><code>auto</code> 与代理一起出现时先确认：推导出的是 <code>bool</code>、代理还是表达式类型？若要取地址、绑定引用或跨语句保存，显式写出目标类型。</div></div>
</section>

<section class="sec">
<h2>7. 不该重载的运算符，以及字面量运算符</h2>
<p><code>operator&amp;&amp;</code> 和 <code>operator||</code> 可以重载，但几乎总是错的。内建的 <code>&amp;&amp;</code>、<code>||</code> 有短路求值：<code>a &amp;&amp; b</code> 在 <code>a</code> 为假时根本不求值 <code>b</code>；重载后它们变成普通函数调用，两个实参都会先求值，而且求值顺序未指定。你无法在函数体里恢复短路，因为参数已经算完了。逗号运算符同理：内建逗号保证从左到右求值并丢弃左值，重载后这个顺序保证消失，泛型代码里还会破坏依赖逗号的语法。</p>
<p>同理，不要无理由重载一元 <code>operator&amp;</code>：泛型代码用 <code>&amp;x</code> 取真实地址，一旦你返回某种句柄，<code>std::addressof</code> 就成了唯一可靠的取址方式。只有实现智能指针或代理时才考虑。逗号运算符也尽量避免，除非你在做完全掌控调用方的 DSL。</p>
<p>字面量运算符（user-defined literal）让 <code>2.5_km</code> 这样的写法变成函数调用。规则有几条硬性的：后缀必须以单个下划线开头（<code>_km</code> 可以，<code>km</code> 不行，后者保留给标准库）；声明通常写作 <code>operator""_km</code>；支持几种固定形参，包括 <code>unsigned long long</code>、<code>long double</code>、<code>const char*</code>、<code>const char*</code> 加 <code>std::size_t</code>，以及字符模板参数包。C++20 起可以用类类型作为非类型模板参数，把字符串字面量在编译期变成可检查的类型。</p>
<pre class="code" data-lang="cpp"><code>constexpr long double operator""_km(long double v) {
    return v * 1000.0L;                 // 返回米
}
constexpr unsigned long long operator""_KiB(unsigned long long v) {
    return v * 1024ULL;
}
// 2.5_km == 2500.0L；4_KiB == 4096ULL</code></pre>
<p>字面量运算符要和类型设计一起考虑：返回内建类型适合单位换算，返回自定义类型适合强类型常量（比如 <code>Meters</code>）。不要定义语义含糊的后缀，也不要用字面量运算符做有副作用的操作——它应该是一个 <code>constexpr</code> 的纯函数。</p>
</section>

<section class="sec">
<h2>8. 工程实践、常见误区与自测</h2>
<p>下面的例子只依赖标准库，用 <code>-std=c++20</code> 编译。Meters 演示了成员 <code>+=</code>、非成员 <code>+</code>、比较、流输出、explicit bool、<code>operator()</code> 和字面量运算符。注意 <code>double</code> 成员让 <code>&lt;=&gt;</code> 返回 <code>std::partial_ordering</code>，这是诚实的选择：NaN 确实不可比。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;iostream&gt;
#include &lt;compare&gt;

class Meters {
public:
    constexpr explicit Meters(double v) noexcept : v_(v) {}

    constexpr double value() const noexcept { return v_; }

    Meters&amp; operator+=(const Meters&amp; rhs) noexcept {
        v_ += rhs.v_;
        return *this;
    }

    Meters&amp; operator++() noexcept {              // 前置：返回引用
        ++v_;
        return *this;
    }

    Meters operator++(int) noexcept {            // 后置：返回值，int 是哑元
        Meters old = *this;
        ++v_;
        return old;
    }

    double operator()(double scale) const noexcept {   // 函数调用
        return v_ * scale;
    }

    explicit operator bool() const noexcept {          // 语境转换
        return v_ != 0.0;
    }

    friend Meters operator+(Meters lhs, const Meters&amp; rhs) {
        lhs += rhs;                              // 复用 +=，语义只写一遍
        return lhs;
    }

    friend bool operator==(const Meters&amp; a, const Meters&amp; b) noexcept {
        return a.v_ == b.v_;
    }

    friend std::partial_ordering operator&lt;=&gt;(const Meters&amp; a,
                                                const Meters&amp; b) noexcept {
        return a.v_ &lt;=&gt; b.v_;                    // double 比较 → partial
    }

    friend std::ostream&amp; operator&lt;&lt;(std::ostream&amp; os, const Meters&amp; m) {
        return os &lt;&lt; m.v_ &lt;&lt; " m";
    }

private:
    double v_{};
};

constexpr Meters operator""_m(long double v) {
    return Meters(static_cast&lt;double&gt;(v));
}

int main() {
    Meters a{1.5}, b{2.0};
    Meters c = a + b;              // 3.5 m，非成员 operator+
    c += Meters{0.5};              // 4.0 m，成员 operator+=
    std::cout &lt;&lt; c &lt;&lt; '\n' &lt;&lt; (a &lt; b) &lt;&lt; '\n';
    if (c) {                       // explicit operator bool 在 if 中可用
        std::cout &lt;&lt; "yes\n";
    }
    std::cout &lt;&lt; c(0.5) &lt;&lt; '\n'; // 2，operator()
    Meters d = 2.0_m;              // 2 m，字面量运算符
    std::cout &lt;&lt; d &lt;&lt; '\n';
}</code></pre>
<p>输出为 <code>4 m</code>、<code>1</code>、<code>yes</code>、<code>2</code>、<code>2 m</code>。若把 <code>operator&lt;=&gt;</code> 的返回类型写成 <code>std::strong_ordering</code>，return 处会编译失败，这正好检验你是否理解比较类别。编译命令：<code>g++ -std=c++20 -Wall -Wextra main.cpp</code>。</p>
<p>常见误区可以对照排查：</p>
<ul>
<li><code>operator+</code> 返回 <code>const T</code> 或 <code>T&amp;</code>：前者阻止移动，后者通常悬垂。</li>
<li>只写 <code>operator&lt;</code> 不写 <code>==</code>，或两者语义不一致；<code>operator==</code> 忘了 <code>const</code>。</li>
<li>隐式转换运算符过多造成歧义；<code>bool</code> 转换忘了 <code>explicit</code>。</li>
<li><code>operator[]</code> 缺少 const 重载；<code>operator&lt;&lt;</code> 里用 <code>std::endl</code> 强制 flush。</li>
<li><code>operator&lt;</code> 不满足严格弱序，<code>std::sort</code> 的结果未定义。</li>
</ul>
<p>排障时先看候选集：成员与非成员各有谁，hidden friend 是否被 ADL 找到，转换是否因 <code>explicit</code> 被排除，const 是否匹配。看不清就显式调用 <code>a.operator+(b)</code> 或 <code>operator+(a, b)</code>，把重载决议“钉”下来。关于 ABI：新增非虚成员运算符通常不改变对象的数据布局，但是否内联、符号如何修饰属于 ABI 细节；对象大小、对齐与名称修饰的具体值取决于目标平台与编译器，不应视为标准保证。</p>
<details class="quiz"><summary>Q1 · 为什么 operator+ 常写成非成员，而 operator+= 写成成员？</summary><div class="quiz__a">成员运算符的左操作数就是对象本身，不参与把左操作数转成 T。若 <code>operator+</code> 是成员，<code>1.0 + a</code> 找不到候选；非成员能让两侧都参与转换。而 <code>+=</code> 修改左操作数，左操作数必须已经是 T，写成成员最自然。</div></details>
<details class="quiz"><summary>Q2 · 一个类有 double 成员，写 auto operator&lt;=&gt;(const T&amp;) const = default; 返回什么类型？为什么？</summary><div class="quiz__a">返回 <code>std::partial_ordering</code>。默认的 <code>&lt;=&gt;</code> 取所有成员比较类别的公共类别；<code>double</code> 是偏序（NaN 与任何值无序），所以整体只能是 partial_ordering。若业务保证不出现 NaN，可手写返回 <code>strong_ordering</code> 的版本；但还要确认 <code>-0.0</code> 与 <code>+0.0</code> 的差异不影响可替换性，否则 <code>weak_ordering</code> 更诚实。</div></details>
<details class="quiz"><summary>Q3 · std::vector&lt;bool&gt; 中写 auto b = v[0]; b = true; 会发生什么？</summary><div class="quiz__a"><code>auto</code> 推导出的是 <code>std::vector&lt;bool&gt;::reference</code> 代理，不是 bool。对 <code>b</code> 赋值会通过代理写回 <code>v[0]</code>，所以它变成 true。代理按值复制，但仍指向原容器；想要独立副本就写 <code>bool b = v[0];</code>。</div></details>
<details class="quiz"><summary>Q4 · 为什么不要重载 operator&amp;&amp; 和 operator||？</summary><div class="quiz__a">重载后它们变成普通函数调用，所有实参在调用前都会求值，短路求值消失，求值顺序也未指定。函数体内无法恢复短路，因为参数已经算完。重载逗号运算符同样会失去从左到右的顺序保证。</div></details>
<ul class="refs">
<li><b>cppreference — Operator overloading</b> — cppreference.com。可重载运算符清单、成员与非成员规则、返回值约定的权威速查。</li>
<li><b>cppreference — Comparison operators</b> — cppreference.com。三路比较、三种顺序类别与比较表达式重写规则的完整说明。</li>
<li><b>C++ Core Guidelines C.160–C.165</b> — Bjarne Stroustrup &amp; Herb Sutter。运算符应模仿常规用法、对称运算符用非成员、避免隐式转换等工程准则。</li>
<li><b>《C++ Primer》（第 5 版）第 14 章“重载运算与类型转换”</b> — Stanley B. Lippman 等, 2013。系统讲解运算符重载、转换运算符与重载决议。</li>
<li><b>P0515R3 “Consistent comparison”</b> — Herb Sutter 等, 2017。三路比较运算符与顺序类别的设计动机，是理解 &lt;=&gt; 的一手材料。</li>
</ul>
</section>
`
};
