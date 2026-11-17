window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["pointers-const"] = {
  slug: "pointers-const",
  title: "指针、引用与 const 正确性",
  subtitle: "把“谁拥有、能否修改”写进类型里",
  level: 1,
  cluster: "语言核心",
  tags: ["指针", "引用", "const"],
  summary: "从地址与别名的差异出发，讲清 nullptr、指针算术与数组退化，拆解 const 的四种组合、两层 const 与 const 成员函数，并给出悬垂指针与成员指针的工程规则。",
  keyPoints: [
    "指针是可空、可重绑、可算术的对象；引用是必须绑定且不可重绑的别名",
    "const 的四种组合、顶层与底层 const 的拷贝与转换规则",
    "const 成员函数的 this 类型、重载选择与 mutable 的边界",
    "悬垂指针的典型来源与检测手段，函数指针/成员指针的声明与调用"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>一句话直觉：指针是地址，引用是别名</h2>
<p>先给一个能立刻用起来的判断：<mark>指针（pointer）是“存地址的对象”，引用（reference）是“对象的别名”</mark>。指针有自己的存储，可以为空，可以改指向；引用在创建时必须绑定到某个对象，之后一直代表它，赋值改变的是被引用对象的值，而不是让引用改绑到别人。</p>
<p>“指针和引用差不多”的说法，只看到了二者都能间接访问。真正的区别在契约：函数签名写 <code>T*</code>，读者会问“它可能为空吗？谁负责释放？”；写 <code>T&amp;</code>，读者默认“调用期间一定有效”。<mark>const</mark> 回答第三个问题：“我能不能改它？”把这三个问题写进类型，就是本篇说的 const 正确性（const correctness）。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>指针像门牌号：纸条本身可以换、可以弄丢、可以写“无”；引用像给人起的绰号：一旦叫定，喊这个绰号永远指同一个人，除非那个人已经不在了。</div></div>
<p>本篇只谈语言层面的指针、引用与 const。所有权与智能指针见 smart-pointers，右值与移动语义见 value-categories；后面两篇会反复使用这里的规则。</p>
</section>

<section class="sec">
<h2>指针与引用：地址与别名</h2>
<p>指针变量本身是一个对象，类型 <code>int*</code> 表示“指向 int 的指针”。在常见 64 位平台（LP64/LLP64，x86-64 与 AArch64）上，对象指针典型大小为 8 字节；标准只要求它能表示实现支持的地址，具体尺寸与对齐取决于 ABI。指针可以拷贝、重新赋值、置空，也可以相减得到 <code>std::ptrdiff_t</code>。</p>
<p>引用不是对象：标准没有规定它必须占用存储。编译器通常借地址实现，但这是实现细节。因此 <code>sizeof(r)</code> 得到的是被引用类型的大小，<code>&amp;r</code> 得到被引用对象的地址；不能直接声明引用的引用（模板实参与 typedef 中的引用折叠会把它压成单个引用），也不能定义引用的数组、指向引用的指针，更不能写 <code>int&amp; const</code> 这种“常量引用”的顶层限定。引用初始化后<mark>不能重新绑定</mark>：<code>int a=1, b=2; int&amp; r=a; r=b;</code> 执行后 <code>a</code> 变成 2，<code>r</code> 仍然代表 <code>a</code>。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="指针与引用的内存布局：x 存放 42，指针 p 存放 x 的地址，引用 r 是 x 的别名">
<defs>
<marker id="pointers-const-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-ink)"/>
</marker>
<marker id="pointers-const-arrow-b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-b)"/>
</marker>
</defs>
<text x="380" y="26" text-anchor="middle" font-size="15" fill="var(--sv-ink)" font-family="inherit">int x = 42;   int* p = &amp;x;   int&amp; r = x;</text>
<rect x="60" y="62" width="220" height="136" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="170" y="88" text-anchor="middle" font-size="13" fill="var(--sv-muted)" font-family="inherit">栈上的对象 x（典型 4 字节）</text>
<text x="170" y="132" text-anchor="middle" font-size="30" fill="var(--sv-ink)" font-family="inherit">42</text>
<text x="170" y="174" text-anchor="middle" font-size="13" fill="var(--sv-muted)" font-family="inherit">地址 0x7ffc1a20</text>
<rect x="470" y="62" width="220" height="136" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="580" y="88" text-anchor="middle" font-size="13" fill="var(--sv-muted)" font-family="inherit">指针变量 p（典型 8 字节）</text>
<text x="580" y="132" text-anchor="middle" font-size="20" fill="var(--sv-ink)" font-family="inherit">0x7ffc1a20</text>
<text x="580" y="174" text-anchor="middle" font-size="13" fill="var(--sv-muted)" font-family="inherit">里面存的是 x 的地址</text>
<path d="M470,130 C410,130 340,130 286,130" fill="none" stroke="var(--sv-ink)" stroke-width="2" marker-end="url(#pointers-const-arrow)"/>
<rect x="60" y="248" width="250" height="94" rx="10" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-dasharray="7 5"/>
<text x="185" y="276" text-anchor="middle" font-size="15" fill="var(--sv-ink)" font-family="inherit">引用 r</text>
<text x="185" y="300" text-anchor="middle" font-size="13" fill="var(--sv-muted)" font-family="inherit">不保证单独占存储</text>
<text x="185" y="324" text-anchor="middle" font-size="13" fill="var(--sv-muted)" font-family="inherit">就是 x 的另一个名字</text>
<path d="M185,248 L185,202" fill="none" stroke="var(--sv-b)" stroke-width="2" stroke-dasharray="7 5" marker-end="url(#pointers-const-arrow-b)"/>
<text x="200" y="228" font-size="13" fill="var(--sv-b)" font-family="inherit">绑定后不可改绑</text>
<text x="470" y="300" font-size="13" fill="var(--sv-muted)" font-family="inherit">改变 p 的值：让 p 指向别处</text>
<text x="470" y="324" font-size="13" fill="var(--sv-muted)" font-family="inherit">改变 r 的值：改变 x 本身</text>
</svg>
<figcaption>图 1 · 指针拥有自己的存储并保存地址；引用只是既有对象的别名，赋值作用于被引用对象</figcaption>
</figure>
<p>参数传递最能体现取舍。<code>void f(const T&amp;)</code> 表达“一定有效、只读、不拷贝”；<code>void f(T&amp;)</code> 表达“一定有效、可写”；<code>void f(T*)</code> 表达“可能为空、可改指向”。如果还涉及所有权转移，就应该用智能指针或值语义，而不是裸指针。返回位置同理：返回引用意味着调用方借用了一个生命周期由别人管理的对象，返回指针则明确允许空值。</p>
<div class="duo">
<div class="duo__col"><h4>优先用引用</h4><p>参数或返回值保证存在、不需要重新绑定、不参与算术时。运算符重载、范围 for、输出流接口几乎都用 <code>T&amp;</code>。</p></div>
<div class="duo__col"><h4>需要时才用指针</h4><p>表达可空、可改指向、数组首地址、C 接口边界，或需要延迟初始化成员时。此时应同时说明谁拥有它。</p></div>
</div>
<p>引用不能重新绑定这一点常被低估：它让引用适合做“稳定别名”，也意味着不能拿引用实现“先声明、后指向”的成员。可选对象请用 <code>std::optional</code>（C++17）或指针；多态容器请用智能指针。引用更不是“更安全的指针”，它只是另一种契约。</p>
</section>

<section class="sec">
<h2>空值、指针算术与数组退化</h2>
<h3>nullptr 是唯一的空指针字面量（C++11）</h3>
<p><code>nullptr</code> 的类型是 <code>std::nullptr_t</code>，可以隐式转换为任意对象指针、函数指针和成员指针，但不能转换为其他整数类型（到 <code>bool</code> 的转换除外）。它解决了 <code>NULL</code> 的两个老问题：<code>NULL</code> 通常被定义为 <code>0</code> 或编译器内建的整数空值，在重载 <code>f(int)</code> 与 <code>f(void*)</code> 之间可能选中整数版本；<code>nullptr</code> 只匹配指针版本。判空一律写 <code>p == nullptr</code> 或 <code>if (p)</code>，不要写 <code>p == 0</code>。</p>
<p>对空指针解引用是未定义行为（undefined behavior，UB），不是“返回 0”或“抛异常”。<code>delete nullptr</code> 是安全的空操作，<code>free(nullptr)</code> 同样安全；但 <code>*p</code>、<code>p-&gt;member</code>、<code>p[0]</code> 在 <code>p</code> 为空时都没有定义。现代编译器会把“已知空指针解引用”优化成不可达路径，导致故障现场与源码对不上，这是 UB 最危险的地方。</p>
<h3>数组退化与指针算术</h3>
<p>在大多数表达式里，数组名会<mark>退化（decay）</mark>为指向首元素的指针。不会发生退化的上下文包括 <code>sizeof</code>、<code>alignof</code>、<code>typeid</code>、<code>&amp;a</code>、<code>decltype(a)</code>，以及绑定到数组引用的初始化。因此 <code>void f(int a[10])</code> 与 <code>void f(int*)</code> 是同一个函数签名，长度信息在参数里丢失。工程上优先用 <code>std::array&lt;T,N&gt;</code> 或 C++20 的 <code>std::span&lt;T&gt;</code> 传递“指针加长度”。</p>
<p><code>a[i]</code> 的定义就是 <code>*(a + i)</code>。指针算术只在同一个数组（含末尾后一位 one-past-the-end）内有定义：<code>p + n</code> 必须落在 <code>[a, a+N]</code> 内；解引用 one-past-end 是 UB；两个指针相减也只有在同一数组内才有定义。对普通标量对象做越界加减同样没有保证，不要把它当成“地址加字节数”的通用运算。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="数组 a 的五个连续元素、指针 q 指向首元素、q 加 2 指向第三个元素，以及 one-past-end 指针的位置">
<defs>
<marker id="pointers-const-pa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-ink)"/>
</marker>
</defs>
<text x="380" y="28" text-anchor="middle" font-size="15" fill="var(--sv-ink)" font-family="inherit">int a[5] = {10, 20, 30, 40, 50};   int* q = a;</text>
<text x="130" y="72" text-anchor="middle" font-size="13" fill="var(--sv-muted)" font-family="inherit">a[0]</text>
<text x="240" y="72" text-anchor="middle" font-size="13" fill="var(--sv-muted)" font-family="inherit">a[1]</text>
<text x="350" y="72" text-anchor="middle" font-size="13" fill="var(--sv-muted)" font-family="inherit">a[2]</text>
<text x="460" y="72" text-anchor="middle" font-size="13" fill="var(--sv-muted)" font-family="inherit">a[3]</text>
<text x="570" y="72" text-anchor="middle" font-size="13" fill="var(--sv-muted)" font-family="inherit">a[4]</text>
<rect x="80" y="84" width="100" height="76" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="130" y="132" text-anchor="middle" font-size="24" fill="var(--sv-ink)" font-family="inherit">10</text>
<rect x="190" y="84" width="100" height="76" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="240" y="132" text-anchor="middle" font-size="24" fill="var(--sv-ink)" font-family="inherit">20</text>
<rect x="300" y="84" width="100" height="76" rx="6" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="350" y="132" text-anchor="middle" font-size="24" fill="var(--sv-ink)" font-family="inherit">30</text>
<rect x="410" y="84" width="100" height="76" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="460" y="132" text-anchor="middle" font-size="24" fill="var(--sv-ink)" font-family="inherit">40</text>
<rect x="520" y="84" width="100" height="76" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="570" y="132" text-anchor="middle" font-size="24" fill="var(--sv-ink)" font-family="inherit">50</text>
<rect x="630" y="84" width="70" height="76" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)" stroke-dasharray="6 5"/>
<text x="665" y="118" text-anchor="middle" font-size="12" fill="var(--sv-muted)" font-family="inherit">one-past</text>
<text x="665" y="136" text-anchor="middle" font-size="12" fill="var(--sv-muted)" font-family="inherit">end</text>
<rect x="80" y="236" width="150" height="58" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="155" y="262" text-anchor="middle" font-size="14" fill="var(--sv-ink)" font-family="inherit">q = a</text>
<text x="155" y="282" text-anchor="middle" font-size="12" fill="var(--sv-muted)" font-family="inherit">指向 a[0]</text>
<path d="M155,236 L155,166" fill="none" stroke="var(--sv-ink)" stroke-width="2" marker-end="url(#pointers-const-pa)"/>
<rect x="300" y="236" width="150" height="58" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="375" y="262" text-anchor="middle" font-size="14" fill="var(--sv-ink)" font-family="inherit">q + 2</text>
<text x="375" y="282" text-anchor="middle" font-size="12" fill="var(--sv-muted)" font-family="inherit">等价于 a + 2</text>
<path d="M375,236 L375,166" fill="none" stroke="var(--sv-ink)" stroke-width="2" marker-end="url(#pointers-const-pa)"/>
<path d="M665,312 L665,166" fill="none" stroke="var(--sv-b)" stroke-width="2" stroke-dasharray="6 5" marker-end="url(#pointers-const-pa)"/>
<text x="655" y="332" text-anchor="end" font-size="13" fill="var(--sv-b)" font-family="inherit">a + 5 合法，但 *（a + 5）是 UB</text>
<text x="80" y="310" font-size="13" fill="var(--sv-muted)" font-family="inherit">*(q + 2) 与 q[2] 都取到 30；q 的类型是 int*，不再携带长度 5</text>
<text x="80" y="354" font-size="13" fill="var(--sv-muted)" font-family="inherit">典型 64 位平台：sizeof(a) = 20，sizeof(q) = 8（此处 int 按 4 字节计）</text>
</svg>
<figcaption>图 2 · 数组在表达式中退化为首元素指针；指针算术以元素为单位，one-past-end 可形成但不可解引用</figcaption>
</figure>
<p>把 <code>sizeof(a)/sizeof(a[0])</code> 写进函数参数里是最常见的错误之一：参数已经退化成指针，结果会变成指针大小除以元素大小。在数组仍可见的作用域内它才有效；更稳妥的写法是 <code>std::size(a)</code>（C++17，需包含 <code>&lt;iterator&gt;</code>），或者直接改用 <code>std::span</code>。模板按引用接收数组（<code>template&lt;std::size_t N&gt; void f(int (&amp;a)[N])</code>）也能保留长度，但接口不如 span 通用。</p>
</section>

<section class="sec">
<h2>const 的四种组合与两层 const</h2>
<p>读声明有一个稳定规则：<mark>从变量名出发，先向右看，再向左看，由内向外</mark>；<code>const</code> 修饰它左边最近的东西，左边没有东西时才修饰右边。于是 <code>const int* p</code> 与 <code>int const* p</code> 完全等价：<code>p</code> 是指针，指向 <code>const int</code>。而 <code>int* const p</code> 中 <code>const</code> 紧挨 <code>p</code>，表示 <code>p</code> 自己是常量指针。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>声明</th><th>读法</th><th>改指向</th><th>改对象</th><th>典型用途</th></tr></thead>
<tbody>
<tr><td><code>const int* p</code> 或 <code>int const* p</code></td><td>指向常量的指针（pointer to const）</td><td>可以</td><td>不可以</td><td>只读访问，可遍历不同对象</td></tr>
<tr><td><code>int* const p</code></td><td>常量指针（const pointer）</td><td>不可以</td><td>可以</td><td>固定句柄，如成员缓冲区</td></tr>
<tr><td><code>const int* const p</code></td><td>指向常量的常量指针</td><td>不可以</td><td>不可以</td><td>只读且不可换的观察入口</td></tr>
<tr><td><code>const int&amp; r</code></td><td>对 const int 的引用</td><td>不能重新绑定</td><td>不可以</td><td>只读传参，绑定临时对象</td></tr>
</tbody>
</table></div>
<p>两类 const 在拷贝与转换时规则不同。<b>顶层 const</b>（top-level const）指对象自身是 const，例如 <code>const int</code>、<code>int* const</code>；<b>底层 const</b>（low-level const）指所指或所引用的对象是 const，例如 <code>const int*</code>、<code>const int&amp;</code>。拷贝时顶层 const 被忽略，因为拷贝得到的是新对象；底层 const 必须保留：<code>int*</code> 可以隐式转成 <code>const int*</code>，反过来必须用 <code>const_cast</code>，并且只有原对象确实可写时，修改才不是 UB。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="按从变量名向外、从右向左的规则解析 const int 指针与 int 常量指针两种声明">
<defs>
<marker id="pointers-const-pc" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-ink)"/>
</marker>
<marker id="pointers-const-pc-b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-b)"/>
</marker>
</defs>
<text x="380" y="26" text-anchor="middle" font-size="15" fill="var(--sv-ink)" font-family="inherit">读声明：从变量名出发，先右后左，由内向外</text>
<text x="60" y="72" font-size="14" fill="var(--sv-muted)" font-family="inherit">写法 A</text>
<rect x="140" y="50" width="90" height="40" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="185" y="76" text-anchor="middle" font-size="16" fill="var(--sv-ink)" font-family="inherit">const</text>
<rect x="240" y="50" width="70" height="40" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="275" y="76" text-anchor="middle" font-size="16" fill="var(--sv-ink)" font-family="inherit">int</text>
<rect x="320" y="50" width="50" height="40" rx="6" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="345" y="76" text-anchor="middle" font-size="18" fill="var(--sv-ink)" font-family="inherit">*</text>
<rect x="380" y="50" width="50" height="40" rx="6" fill="var(--sv-b)" stroke="var(--sv-b)"/>
<text x="405" y="76" text-anchor="middle" font-size="17" fill="var(--sv-bg)" font-family="inherit">p</text>
<path d="M405,112 L405,100 L374,100" fill="none" stroke="var(--sv-ink)" stroke-width="2" marker-end="url(#pointers-const-pc)"/>
<text x="405" y="130" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">p 是指针</text>
<path d="M345,154 L345,142 L312,142" fill="none" stroke="var(--sv-ink)" stroke-width="2" marker-end="url(#pointers-const-pc)"/>
<text x="340" y="172" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">指向 const int</text>
<text x="470" y="76" font-size="14" fill="var(--sv-b)" font-family="inherit">对象只读，指针可换目标</text>
<line x1="60" y1="196" x2="700" y2="196" stroke="var(--sv-line)" stroke-dasharray="4 6"/>
<text x="60" y="238" font-size="14" fill="var(--sv-muted)" font-family="inherit">写法 B</text>
<rect x="140" y="216" width="70" height="40" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="175" y="242" text-anchor="middle" font-size="16" fill="var(--sv-ink)" font-family="inherit">int</text>
<rect x="220" y="216" width="50" height="40" rx="6" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="245" y="242" text-anchor="middle" font-size="18" fill="var(--sv-ink)" font-family="inherit">*</text>
<rect x="280" y="216" width="90" height="40" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="325" y="242" text-anchor="middle" font-size="16" fill="var(--sv-ink)" font-family="inherit">const</text>
<rect x="380" y="216" width="50" height="40" rx="6" fill="var(--sv-b)" stroke="var(--sv-b)"/>
<text x="405" y="242" text-anchor="middle" font-size="17" fill="var(--sv-bg)" font-family="inherit">p</text>
<path d="M405,278 L405,266 L374,266" fill="none" stroke="var(--sv-b)" stroke-width="2" marker-end="url(#pointers-const-pc-b)"/>
<text x="405" y="294" text-anchor="middle" font-size="13" fill="var(--sv-b)" font-family="inherit">p 本身是 const</text>
<path d="M245,318 L245,306 L212,306" fill="none" stroke="var(--sv-ink)" stroke-width="2" marker-end="url(#pointers-const-pc)"/>
<text x="245" y="334" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">指向 int</text>
<text x="470" y="242" font-size="14" fill="var(--sv-b)" font-family="inherit">指针不可换目标，对象可写</text>
</svg>
<figcaption>图 3 · 同一行声明中 const 的位置决定谁被限定：靠右限定指针自身，靠左限定所指对象</figcaption>
</figure>
<p>常量引用 <code>const T&amp;</code> 是只读视图，常用于参数和绑定临时对象。它有一个重要例外：把临时对象<mark>直接</mark>绑定到 <code>const T&amp;</code>（或 <code>T&amp;&amp;</code>）时，临时对象的生命周期会延长到该引用的生命周期（lifetime extension），前提是二者写在同一条声明里。但临时对象绑定到函数参数时只活到包含该调用的完整表达式结束；绑定到函数返回的引用也不会延长；在构造函数的初始化列表里绑定到引用成员时，临时对象只活到构造函数退出。注意 <code>auto&amp;&amp; r = T{};</code> 会延长，而 <code>auto&amp;&amp; r = f();</code>（f 返回引用）绑定的其实是那个引用，延长规则不适用，容易留下悬垂引用。引用本身没有顶层 const，<code>int&amp; const</code> 非法；<code>const int&amp;</code> 的 const 属于被引用类型。</p>
<div class="formula">const 修饰左边最近的类型；左边没有时修饰右边。读法：从变量名出发，先向右，再向左，由内向外。<br/>const int* p  ⇔  p 是“指向 const int 的指针”<br/>int* const p  ⇔  p 是“const 指针，指向 int”<br/>int* ⇀ const int* 可以隐式转换；反向只能 const_cast，且不得修改真正 const 的对象。</div>
</section>

<section class="sec">
<h2>const 成员函数与 const 正确性</h2>
<p>在成员函数末尾写 <code>const</code>，例如 <code>double get() const</code>，改变的是隐式 <code>this</code> 的类型：从 <code>Account*</code> 变成 <code>const Account*</code>。因此 const 成员函数不能通过 <code>this</code> 修改非 mutable 数据成员，不能通过 <code>this</code> 调用本类的非 const 成员函数（对别的对象或指针成员则不受此限），也不能把 <code>this</code> 交给需要非 const 指针的接口。const 对象只能调用 const 成员函数，这条约束由编译器强制执行。</p>
<p><b>逻辑常量性</b>与<b>按位常量性</b>要区分：缓存、互斥量、统计计数这类“不影响可观察状态”的成员可以声明为 <code>mutable</code>，允许 const 成员函数修改它们。但 mutable 是逃生舱，不应被用来绕过真正的状态修改。更常见的是按 const 重载：<code>T&amp; operator[](std::size_t)</code> 与 <code>const T&amp; operator[](std::size_t) const</code>，让 const 容器返回只读引用，非 const 容器返回可写引用。下面这个接口片段补齐了所需头文件：</p>
<pre class="code" data-lang="cpp"><code>#include &lt;cstddef&gt;
#include &lt;vector&gt;

class Buffer {
public:
    const int&amp; operator[](std::size_t i) const { return data_[i]; }
    int&amp; operator[](std::size_t i) { return data_[i]; }
private:
    std::vector&lt;int&gt; data_;
};</code></pre>
<p>const 正确性会沿调用链传播：一个本该 const 的函数没写 const，调用者就无法在 const 对象或 const 引用上调用它，最后往往被迫 <code>const_cast</code>。所以新代码应默认给不修改逻辑状态的成员函数加 const，参数默认 <code>const T&amp;</code>，返回值尽量返回值或 const 引用；只有确实需要修改或转移所有权时才放宽。注意返回 <code>const T*</code> 只保护“不能通过这个指针改”，并不保证对象本身不被别人改，也不表达所有权。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>把 <code>const_cast</code> 当成“接口降噪”而不是“去掉只读”：它通常只用于调用那些其实不修改对象的旧接口。若原对象本身是 const，通过 const_cast 写入是 UB，编译器可以把它优化掉。</div></div>
<p>还有一个常被忽略的细节：const 成员函数返回成员指针或引用时，返回类型通常也应带 const，否则调用者能借返回值绕过 const。例如 const 容器应返回 <code>const_iterator</code> 或 <code>const T&amp;</code>，而不是把内部可写引用泄露出去。这种“const 传染”看起来繁琐，却正是类型系统替你检查越权修改的方式。</p>
</section>

<section class="sec">
<h2>悬垂指针与生命周期</h2>
<p><b>悬垂指针</b>（dangling pointer）指向已经结束生命周期的对象；<b>悬垂引用</b>同理。解引用它们、把悬垂指针交给 delete 或 free、对它做成员访问，都是 UB。指针变量本身仍然“有值”，只是那个值不再指向活对象；所以“指针非空”不等于“指针有效”，这是调试时最容易误判的一点。</p>
<p>常见来源有四类：返回局部变量的地址或引用；引用绑定到超出完整表达式就销毁的临时对象；容器扩容或 erase 导致迭代器、指针、引用失效；对象被 delete 或 reset 后仍保留旧地址。尤其注意 <code>std::vector::push_back</code> 可能重新分配，之前保存的 <code>data()</code>、<code>&amp;v[0]</code> 和迭代器全部失效；是否失效取决于是否真的扩容，不能靠“当前 capacity 还够”来假设长期安全。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="悬垂指针时间线：对象生命周期先结束，指针变量继续存活并保存旧地址，形成解引用即未定义行为的窗口">
<defs>
<marker id="pointers-const-tl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-ink)"/>
</marker>
</defs>
<text x="380" y="28" text-anchor="middle" font-size="15" fill="var(--sv-ink)" font-family="inherit">悬垂指针的时间线：先有对象，后有失效</text>
<text x="60" y="92" font-size="13" fill="var(--sv-muted)" font-family="inherit">对象生命周期</text>
<rect x="170" y="70" width="250" height="42" rx="8" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="295" y="97" text-anchor="middle" font-size="14" fill="var(--sv-ink)" font-family="inherit">对象存活，地址有效</text>
<text x="60" y="182" font-size="13" fill="var(--sv-muted)" font-family="inherit">指针 p 的生命周期</text>
<rect x="170" y="160" width="510" height="42" rx="8" fill="var(--sv-panel)" stroke="var(--sv-b)"/>
<text x="300" y="187" font-size="14" fill="var(--sv-ink)" font-family="inherit">p 一直存活，保存着旧地址</text>
<text x="480" y="187" font-size="14" fill="var(--sv-b)" font-family="inherit">悬垂窗口</text>
<line x1="420" y1="52" x2="420" y2="240" stroke="var(--sv-b)" stroke-width="2" stroke-dasharray="7 5"/>
<text x="430" y="60" font-size="13" fill="var(--sv-b)" font-family="inherit">作用域结束 / delete / vector 重新分配</text>
<line x1="60" y1="250" x2="720" y2="250" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#pointers-const-tl)"/>
<text x="720" y="270" text-anchor="end" font-size="13" fill="var(--sv-muted)" font-family="inherit">时间</text>
<circle cx="280" cy="250" r="5" fill="var(--sv-a)"/>
<text x="280" y="286" text-anchor="middle" font-size="12" fill="var(--sv-muted)" font-family="inherit">p = &amp;obj</text>
<circle cx="420" cy="250" r="5" fill="var(--sv-b)"/>
<text x="420" y="286" text-anchor="middle" font-size="12" fill="var(--sv-b)" font-family="inherit">失效点</text>
<circle cx="560" cy="250" r="5" fill="var(--sv-b)"/>
<text x="560" y="286" text-anchor="middle" font-size="12" fill="var(--sv-b)" font-family="inherit">再解引用 = UB</text>
<text x="60" y="336" font-size="13" fill="var(--sv-ink)" font-family="inherit">p 非空只说明它保存了一个地址，不说明这个地址上还有活对象。</text>
<text x="60" y="358" font-size="13" fill="var(--sv-muted)" font-family="inherit">悬垂引用同理；引用不可改绑，不会让问题自动消失。</text>
</svg>
<figcaption>图 4 · 对象先结束生命周期、指针后结束，两者之间的窗口就是悬垂窗口；此间任何解引用都是 UB</figcaption>
</figure>
<p>生命周期延长只覆盖“临时对象在同一条声明中直接绑定到 const 引用或右值引用”的情形，而且延长到引用的生命周期。函数返回 <code>const T&amp;</code> 并绑定局部临时对象不会延长；在构造函数的初始化列表里把临时对象绑定到引用成员，临时对象只活到构造函数退出，不会延长到成员所属对象之外。检测手段包括 AddressSanitizer、libstdc++ 的 <code>_GLIBCXX_DEBUG</code> 迭代器检查、Valgrind；根本上还是用值语义、RAII 和智能指针表达所有权，把“谁活得更久”交给类型和接口设计。</p>
<div class="callout callout--warn"><span class="callout__label">警告</span><div>不要返回指向局部变量的指针或引用，也不要返回指向函数参数的指针。若接口必须“借出”内部对象，请在命名或注释里标明借用关系与有效期，并确保调用方不会越过下一次修改容器结构的操作。</div></div>
</section>

<section class="sec">
<h2>函数指针与成员指针</h2>
<p>函数指针的声明要把名字和星号括起来：<code>double (*fn)(double,double)</code> 是“指向接受两个 double、返回 double 的函数的指针”。更易读的写法是类型别名 <code>using BinOp = double(*)(double,double);</code>。无捕获的 lambda（C++11 起）可以隐式转换为函数指针；有捕获的 lambda 不行，需要 <code>std::function</code> 或模板。函数指针可以为空，调用前要检查。</p>
<p>成员指针不是普通地址，它必须绑定一个对象才能使用：数据成员指针用 <code>obj.*pm</code> 或 <code>ptr-&gt;*pm</code> 访问，成员函数指针用 <code>(obj.*pmf)(args)</code> 调用。成员函数指针的类型包含类与 cv 限定，例如 <code>double (Account::*getter)() const</code>。典型实现（Itanium C++ ABI，GCC/Clang 在 Linux 与 macOS 上）对非虚成员函数用“函数地址加 this 调整量”两个机器字表示，对虚函数则用 vtable 偏移加调整量；MSVC 的表示又不同。标准不保证其大小，也不提供与 <code>void*</code> 的互转，跨 ABI 传递成员指针不可移植。下面这段完整示例按 C++20 口径编写。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;iostream&gt;
#include &lt;string&gt;

struct Account {
    std::string owner;
    double balance = 0.0;

    double get() const { return balance; }
    void deposit(double x) { balance += x; }
};

double add(double a, double b) { return a + b; }

double apply(double (*fn)(double, double), double a, double b) {
    return fn(a, b);
}

int main() {
    int x = 42;
    int* p = &amp;x;              // 指针：保存地址
    int&amp; r = x;               // 引用：x 的别名，必须初始化
    r += 1;                   // x 变成 43，r 仍绑定 x
    std::cout &lt;&lt; x &lt;&lt; ' ' &lt;&lt; *p &lt;&lt; ' ' &lt;&lt; r &lt;&lt; '\n';

    const int* pc = &amp;x;       // 指向常量的指针：可换目标
    pc = nullptr;
    int* const cp = &amp;x;       // 常量指针：不可换目标
    *cp = 7;                  // 但可以改对象
    const int* const ccp = &amp;x;
    (void)pc;
    (void)ccp;

    int a[5] = {10, 20, 30, 40, 50};
    int* q = a;               // 数组退化为首元素指针
    std::cout &lt;&lt; *(q + 2) &lt;&lt; ' ' &lt;&lt; q[2] &lt;&lt; '\n';
    std::cout &lt;&lt; sizeof(a) / sizeof(a[0]) &lt;&lt; '\n';

    Account acc{"Ada", 100.0};
    const Account&amp; cref = acc;  // 只读视图，不拷贝
    double (Account::*getter)() const = &amp;Account::get;
    std::cout &lt;&lt; (cref.*getter)() &lt;&lt; '\n';

    acc.deposit(apply(add, 1.0, 2.0));
    std::cout &lt;&lt; acc.get() &lt;&lt; '\n';
}</code></pre>
<p>日常工程里，回调优先用 <code>std::function</code>（C++11）、模板参数或函数指针；只有在需要“按成员做索引、反射式调用”时才直接使用成员指针。C++23 的 <code>std::move_only_function</code> 适合捕获 move-only 对象的回调，属于标准库泛型篇的内容，这里只点名。成员指针作为类模板参数时还要注意 cv 与引用限定，类型拼写错误通常会在调用点才暴露。</p>
</section>

<section class="sec">
<h2>工程实践、常见误区与自测</h2>
<h3>一张可执行的规则清单</h3>
<ol>
<li>参数默认 <code>const T&amp;</code>；需要可写用 <code>T&amp;</code>；确实可能为空或需要改指向才用 <code>T*</code>。</li>
<li>成员函数不修改逻辑状态就加 <code>const</code>；缓存或互斥量用 <code>mutable</code>，不要滥用。</li>
<li>不返回局部对象的指针或引用；返回引用时说明“借用，不拥有”。</li>
<li>指针算术只在线性数组内进行；跨容器用迭代器或 <code>std::span</code>。</li>
<li><code>const_cast</code> 只用于调用承诺不修改的旧接口，且不得修改真正 const 的对象。</li>
<li>把所有权写进类型：<code>std::unique_ptr</code> 与 <code>std::shared_ptr</code> 见 smart-pointers。</li>
</ol>
<h3>常见误区</h3>
<p><b>“const 只是编译期检查，运行期没用”</b>：const 是类型系统的一部分，影响重载、转换与优化；通过 const_cast 修改真正 const 的对象是 UB，编译器可以假设它不变。<b>“引用就是自动解引用的指针”</b>：引用不可为空、不可重绑、不参与算术，<code>sizeof</code> 语义也不同。<b>“数组就是指针”</b>：只在表达式退化时成立，<code>sizeof</code> 与模板推导会保留数组类型。<b>“成员函数指针就是函数地址”</b>：表示由 ABI 决定，可能携带 this 调整量，不能假定大小。</p>
<h3>自测</h3>
<details class="quiz"><summary>Q1 · 设有 int x = 0;（x 本身不是 const），下面三个彼此独立的声明中，哪些能通过指针修改 x？① const int* p = &amp;x; ② int* const p = &amp;x; ③ const int* const p = &amp;x;</summary><div class="quiz__a">只有 ②。<code>const int*</code> 的 const 修饰所指对象，不能改 x，但可以改 p 的指向；<code>int* const</code> 的 const 修饰 p 自身，不能改指向，但能通过 p 改 x；<code>const int* const</code> 两者都锁死。三句彼此独立，若写进同一作用域会因重复定义 p 而无法编译。读声明时从 p 出发，先右后左即可分辨。</div></details>
<details class="quiz"><summary>Q2 · 函数 const std::string&amp; name() { return std::string("tmp"); } 返回后立即使用，为什么危险？</summary><div class="quiz__a">返回的引用绑定到函数内创建的临时 <code>std::string</code>。临时对象在 return 语句的完整表达式结束时销毁，而生命周期延长只适用于“临时对象直接绑定到引用变量”的场景，不适用于函数返回引用。调用方拿到的是悬垂引用，使用它是 UB。正确做法是按值返回 <code>std::string</code>，或返回指向长期存活对象的引用。</div></details>
<details class="quiz"><summary>Q3 · int a[5]; int* p = a; p += 5; std::cout &lt;&lt; *p; 这段代码的问题是什么？</summary><div class="quiz__a">执行 <code>p += 5</code> 后得到 one-past-the-end 指针，形成这个指针本身是合法的；但 <code>*p</code> 解引用它属于 UB。合法范围是 <code>[a, a+5]</code>，只有 <code>a[0]</code> 到 <code>a[4]</code> 可解引用。若要用 <code>p != a+5</code> 作为循环终止条件则没有问题。</div></details>
<p>如果这三题都能不假思索地答对，说明你已经把“地址、别名、可空、可改”四件事分开建模了。接下来建议按顺序读 smart-pointers 与 value-categories，把所有权和移动语义补齐。</p>
<h3>延伸阅读</h3>
<ul class="refs">
<li><b>cppreference · Pointer declaration</b> — cppreference.com。指针声明语法、限定符位置与数组退化的权威速查。</li>
<li><b>cppreference · Reference declaration</b> — cppreference.com。引用类型、引用折叠与生命周期延长的规则原文。</li>
<li><b>C++ Core Guidelines · ES.20–ES.24</b> — Bjarne Stroustrup, Herb Sutter。关于对象初始化、避免裸 new 与表达所有权的规则组。</li>
<li><b>C++ Core Guidelines · F.42–F.60</b> — Bjarne Stroustrup, Herb Sutter。参数与返回值该用指针、引用还是值的系统建议。</li>
<li><b>《Effective C++（第三版）》条款 3</b> — Scott Meyers, 2005。尽量使用 const，讲清 const 接口与成员函数重载的实践动机。</li>
</ul>
</section>`
};
