window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["classes-lifecycle"] = {
  slug: "classes-lifecycle",
  title: "类与对象生命周期",
  subtitle: "构造、析构与成员初始化的顺序",
  level: 1,
  cluster: "语言核心",
  tags: ["类", "构造", "析构"],
  summary: "从原始内存如何变成对象讲起，拆解初始化列表、成员初始化顺序、默认/委托/拷贝构造与 explicit，再落到析构、static 成员与异常语义，帮你避开对象生命周期中的顺序陷阱。",
  keyPoints: [
    "class 与 struct 的唯一差别是默认访问权限与默认继承方式，访问控制是编译期检查",
    "成员初始化列表是初始化，函数体赋值只是赋值；实际顺序取决于声明顺序而非书写顺序",
    "构造顺序为虚基类、直接基类、成员、函数体，析构严格逆序",
    "构造失败时已构造的子对象逆序销毁；析构默认 noexcept，前提是所有子对象析构都不抛"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>先记住一句话：对象不是声明出来的，是构造出来的</h2>
<p>你写下 <code>Widget w;</code>，编译器看到的不是“创建一个变量”，而是“在一块已经分配好的存储上启动一个对象的生命周期”。C++ 的对象模型把三件事绑在一起：<mark>存储（storage）</mark>、<mark>生存期（lifetime）</mark>、<mark>类型（type）</mark>。存储来自栈、堆或静态区；生存期大致从初始化完成开始、到析构开始为止（平凡构造与平凡析构另有细则，见下文）；类型决定这段字节该被怎样解释。这也解释了几个初学者常踩的坑：为什么 <code>malloc</code> 得到的内存对多数类型不能直接当对象用；为什么成员初始化列表的顺序和你写的顺序不一致；为什么 <code>noexcept</code> 析构函数里抛异常会直接终止程序。本篇沿着“原始内存如何变成对象、又怎样变回原始内存”这条线，把构造、析构、初始化顺序与访问控制串起来。拷贝与移动的完整规则只点到为止，细节留给 copy-move-semantics 一篇。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>把对象想成一台机器：分配存储只是把厂房建好，构造函数是装配并开机自检，析构函数是关机与拆解。厂房本身不是机器；只有装配成功，机器才存在。装配到一半失败，要把已装好的零件按相反顺序拆掉，但整台机器从未诞生。</div></div>
<h3>class 与 struct：访问控制是一份编译期契约</h3>
<p>在 C++ 里，<code>class</code> 与 <code>struct</code> 几乎可以互换，唯一的标准差别有两处：默认成员访问权限，以及默认继承方式。<code>struct</code> 默认 <code>public</code>，<code>class</code> 默认 <code>private</code>。因此“用 struct 表示数据、用 class 表示封装”只是社区惯例，不是语言强制。访问控制有三个层级：<code>public</code> 对所有代码可见，<code>protected</code> 对本类、派生类与友元可见，<code>private</code> 只对类自身成员与友元可见。</p>
<p>访问控制是<b>编译期检查</b>，不产生运行时开销，也不是安全边界：它在类型系统里约束“哪些名字可以被谁使用”。一个常被忽略的细节是权限按“名字”而不是按“对象”判定——同一个类的成员函数可以访问任意实例的私有成员，而不只是 <code>this</code> 指向的那个。这正是拷贝构造函数、比较函数能直接读写对方私有字段的原因。</p>
<p>布局方面要克制。标准并不规定类的内存布局，只对 standard-layout 等类别给出有限保证；而且标准明确规定，<b>不同访问控制下的非静态数据成员的分配顺序是未指定的</b>。也就是说，把 <code>public</code> 与 <code>private</code> 成员混排，可能让布局、<code>sizeof</code> 乃至是否满足 standard-layout 随编译器变化（standard-layout 要求所有非静态数据成员具有相同的访问控制）。跨模块 ABI 不能假设字段偏移。</p>
</section>

<section class="sec">
<h2>构造函数与成员初始化列表：初始化不是赋值</h2>
<p>构造函数没有返回类型，名字与类相同，可以重载。真正决定成员如何诞生的，是冒号后面的<mark>成员初始化列表（member initializer list）</mark>，而不是函数体。写在初始化列表里的成员是“被构造”，写在函数体里的是“先默认构造、再赋值”。对于 <code>const</code> 成员、引用成员、没有默认构造函数的类类型成员，函数体赋值根本不可行，必须在列表里初始化。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;cstddef&gt;
#include &lt;vector&gt;

class Buffer {
public:
    // 直接构造：data_ 一次构造为 n 个元素
    explicit Buffer(std::size_t n) : data_(n), size_(n) {}

    // 对比：先默认构造空 vector，再在函数体里 resize，属于"先构造、后赋值"
    // Buffer(std::size_t n) { data_.resize(n); size_ = n; }

private:
    std::vector&lt;int&gt; data_;
    std::size_t size_;
};</code></pre>
<p>初始化列表的顺序陷阱更值得警惕：<b>成员的实际初始化顺序由声明顺序决定，与初始化列表的书写顺序无关</b>。如果列表里 <code>b_</code> 写在 <code>a_</code> 前面，而声明时 <code>a_</code> 在前，那么 <code>a_</code> 仍先构造。若某个成员的初始化表达式读取了另一个尚未构造的成员，就是未定义行为（undefined behavior，UB）。GCC/Clang 的 <code>-Wreorder</code>、MSVC 的 <code>/w15038</code>（C5038）会对此告警，应当把告警当错误处理。</p>
<div class="formula">构造顺序 = 虚基类（深度优先、从左到右）→ 直接基类（声明顺序）→ 非静态成员（声明顺序）→ 构造函数体
析构顺序 = 析构函数体 → 非静态成员（声明逆序）→ 直接基类（声明逆序）→ 虚基类</div>
<p>C++11 起可以用<mark>默认成员初始化器（default member initializer，NSDMI）</mark>在声明处给初值，例如 <code>int id_ = 0;</code>；初始化列表中的显式值会覆盖它。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="一个含虚函数、int、double、char 成员的类在 x86-64 Itanium ABI 下的典型对象布局与填充字节" font-family="inherit">
<text x="380" y="26" text-anchor="middle" font-size="15" fill="var(--sv-ink)">典型对象布局：vptr、成员、对齐填充</text>
<g>
<rect x="150" y="70" width="120" height="104" fill="var(--sv-a)" fill-opacity="0.30" stroke="var(--sv-a)"/>
<rect x="270" y="70" width="60" height="104" fill="var(--sv-a2)" fill-opacity="0.30" stroke="var(--sv-a2)"/>
<rect x="330" y="70" width="60" height="104" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="4 3"/>
<rect x="390" y="70" width="120" height="104" fill="var(--sv-b)" fill-opacity="0.30" stroke="var(--sv-b)"/>
<rect x="510" y="70" width="15" height="104" fill="var(--sv-b2)" fill-opacity="0.30" stroke="var(--sv-b2)"/>
<rect x="525" y="70" width="105" height="104" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="4 3"/>
<text x="210" y="118" text-anchor="middle" font-size="13" fill="var(--sv-ink)">vptr</text>
<text x="210" y="137" text-anchor="middle" font-size="12" fill="var(--sv-muted)">8 B</text>
<text x="300" y="118" text-anchor="middle" font-size="13" fill="var(--sv-ink)">id_</text>
<text x="300" y="137" text-anchor="middle" font-size="12" fill="var(--sv-muted)">int · 4 B</text>
<text x="360" y="118" text-anchor="middle" font-size="11" fill="var(--sv-muted)">pad</text>
<text x="360" y="137" text-anchor="middle" font-size="11" fill="var(--sv-muted)">4 B</text>
<text x="450" y="118" text-anchor="middle" font-size="13" fill="var(--sv-ink)">weight_</text>
<text x="450" y="137" text-anchor="middle" font-size="12" fill="var(--sv-muted)">double · 8 B</text>
<text x="517" y="118" text-anchor="middle" font-size="11" fill="var(--sv-ink)">tag_</text>
<text x="517" y="137" text-anchor="middle" font-size="11" fill="var(--sv-muted)">1 B</text>
<text x="577" y="118" text-anchor="middle" font-size="11" fill="var(--sv-muted)">尾部填充</text>
<text x="577" y="137" text-anchor="middle" font-size="11" fill="var(--sv-muted)">7 B</text>
</g>
<g font-size="12" fill="var(--sv-muted)" text-anchor="middle">
<text x="150" y="196">偏移 0</text>
<text x="270" y="196">偏移 8</text>
<text x="330" y="196">偏移 12</text>
<text x="390" y="196">偏移 16</text>
<text x="510" y="196">偏移 24</text>
<text x="630" y="196">偏移 32</text>
</g>
<line x1="150" y1="210" x2="630" y2="210" stroke="var(--sv-line)"/>
<g font-size="12" fill="var(--sv-muted)" text-anchor="middle">
<text x="380" y="232">总大小 sizeof = 32 B · 对齐 alignof = 8 B</text>
</g>
<text x="380" y="270" text-anchor="middle" font-size="12" fill="var(--sv-ink)">填充不是浪费，而是为了让 double 落在 8 字节对齐地址上</text>
<text x="380" y="294" text-anchor="middle" font-size="12" fill="var(--sv-muted)">口径：x86-64、Itanium C++ ABI、GCC/Clang 典型结果（按 15 px = 1 B 绘制）</text>
<text x="380" y="318" text-anchor="middle" font-size="12" fill="var(--sv-muted)">标准不保证 vptr 存在、位置或对象大小，跨 ABI 不可假设</text>
<text x="380" y="342" text-anchor="middle" font-size="12" fill="var(--sv-muted)">多重继承下可能有多个 vptr；虚函数再多，也不会为每个虚函数加一个指针</text>
</svg>
<figcaption>图 1 · 对象内存布局：典型实现中成员按声明顺序排列，对齐引入填充，尾部补齐到对齐倍数（按字节等比绘制）</figcaption>
</figure>
</section>

<section class="sec">
<h2>对象生命周期时间线：什么时候可以安全使用</h2>
<p>对象的<mark>生存期（lifetime）</mark>如何开始，取决于初始化是否为 vacuous。对定义了非平凡构造函数的类类型，生存期从构造函数完成的那一刻开始；若初始化是 vacuous（例如平凡默认构造且未给初值），生存期在存储取得并对齐时就已开始。结束点同样分两种情况：具有非平凡析构函数的类类型，析构函数调用一开始生存期就结束；析构平凡的类型则延续到存储被释放或复用。边界要分清：<b>在非平凡构造的构造函数体内，完整对象的生存期尚未开始</b>，此时调用虚函数只会派发到当前正在构造的类；成员子对象在进入函数体前已按声明顺序构造完毕；但内建类型成员若既未出现在初始化列表、也没有默认成员初始化器，其值就是不确定的，读取它是 UB。析构函数体内，完整对象的动态类型被视为当前析构的类，虚调用同样不再到达派生类；不过成员子对象此时尚未销毁，仍可正常访问。</p>
<p>存储期（storage duration）与生存期是两个维度。自动存储期对象在离开作用域时销毁；静态存储期对象在程序退出时销毁（通常在 <code>main</code> 返回之后，或调用 <code>std::exit</code> 时），按构造完成的逆序进行；动态存储期对象的存储由 <code>new</code>/<code>delete</code> 管理，但存储还在不等于对象还活着。对生存期之外的对象做任何访问都是 UB，编译器有权假设它从未发生。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="对象生命周期时间线：存储分配、基类与成员构造、构造函数体、使用期、析构函数体、成员与基类析构" font-family="inherit">
<defs>
<marker id="classes-lifecycle-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
<path d="M 0 0 L 10 5 L 0 10 z" fill="var(--sv-line)"/>
</marker>
</defs>
<text x="380" y="24" text-anchor="middle" font-size="15" fill="var(--sv-ink)">时间向下流动：从存储分配到存储回收</text>
<line x1="110" y1="42" x2="110" y2="352" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#classes-lifecycle-arrow)"/>
<g>
<circle cx="110" cy="62" r="5" fill="var(--sv-a)"/>
<rect x="140" y="44" width="310" height="38" rx="4" fill="var(--sv-a)" fill-opacity="0.22" stroke="var(--sv-a)"/>
<text x="295" y="68" text-anchor="middle" font-size="13" fill="var(--sv-ink)">存储分配（栈 / 堆 / 静态区）</text>
<text x="470" y="60" font-size="12" fill="var(--sv-muted)">对象尚不存在，按对象类型访问即 UB</text>
<text x="470" y="77" font-size="12" fill="var(--sv-muted)">malloc / operator new 只负责存储</text>

<circle cx="110" cy="116" r="5" fill="var(--sv-a2)"/>
<rect x="140" y="98" width="310" height="38" rx="4" fill="var(--sv-a2)" fill-opacity="0.22" stroke="var(--sv-a2)"/>
<text x="295" y="122" text-anchor="middle" font-size="13" fill="var(--sv-ink)">虚基类 → 直接基类 → 非静态成员</text>
<text x="470" y="114" font-size="12" fill="var(--sv-muted)">按声明顺序；函数体不在此步</text>
<text x="470" y="131" font-size="12" fill="var(--sv-muted)">任一子对象抛异常则逆序回滚</text>

<circle cx="110" cy="170" r="5" fill="var(--sv-b2)"/>
<rect x="140" y="152" width="310" height="38" rx="4" fill="var(--sv-b2)" fill-opacity="0.22" stroke="var(--sv-b2)"/>
<text x="295" y="176" text-anchor="middle" font-size="13" fill="var(--sv-ink)">构造函数体执行</text>
<text x="470" y="168" font-size="12" fill="var(--sv-muted)">完整对象生存期尚未开始</text>
<text x="470" y="185" font-size="12" fill="var(--sv-muted)">虚调用只派发到当前类</text>

<circle cx="110" cy="232" r="5" fill="var(--sv-b)"/>
<rect x="140" y="206" width="310" height="52" rx="4" fill="var(--sv-b)" fill-opacity="0.26" stroke="var(--sv-b)"/>
<text x="295" y="228" text-anchor="middle" font-size="13" fill="var(--sv-ink)">生存期：对象可安全使用</text>
<text x="295" y="247" text-anchor="middle" font-size="12" fill="var(--sv-muted)">构造完成之后，析构开始之前</text>
<text x="470" y="226" font-size="12" fill="var(--sv-muted)">RAII 的黄金窗口</text>
<text x="470" y="243" font-size="12" fill="var(--sv-muted)">栈展开会保证析构被调用</text>

<circle cx="110" cy="292" r="5" fill="var(--sv-c)"/>
<rect x="140" y="274" width="310" height="38" rx="4" fill="var(--sv-c)" fill-opacity="0.22" stroke="var(--sv-c)"/>
<text x="295" y="298" text-anchor="middle" font-size="13" fill="var(--sv-ink)">析构函数体执行</text>
<text x="470" y="290" font-size="12" fill="var(--sv-muted)">完整对象生存期已结束</text>
<text x="470" y="307" font-size="12" fill="var(--sv-muted)">成员子对象仍存活，可访问</text>

<circle cx="110" cy="342" r="5" fill="var(--sv-c)"/>
<rect x="140" y="324" width="310" height="38" rx="4" fill="var(--sv-c)" fill-opacity="0.22" stroke="var(--sv-c)"/>
<text x="295" y="348" text-anchor="middle" font-size="13" fill="var(--sv-ink)">成员逆序析构 → 基类逆序析构 → 释放存储</text>
</g>
</svg>
<figcaption>图 2 · 对象生命周期时间线（非平凡构造与析构的典型情形）：构造完成才进入生存期，析构开始即退出生存期</figcaption>
</figure>
<p>一个推论：<code>new</code> 表达式先调用 <code>operator new</code> 拿存储，再调用构造函数；若构造函数抛异常，标准保证对应的 <code>operator delete</code> 被调用，但对象析构不会执行。这正是要把裸资源交给成员对象托管的原因。</p>
</section>

<section class="sec">
<h2>构造与析构顺序：基类、成员、函数体</h2>
<p>很多“为什么我的日志顺序不对”的问题，答案都在这一节。构造一个派生类对象时，顺序固定为：先虚基类（由最派生类负责，深度优先、从左到右），再直接基类（按继承列表的声明顺序），再非静态数据成员（按类内声明顺序），最后才是构造函数体。析构则严格反着来：先执行析构函数体，再逆序销毁成员，再逆序销毁基类，最后销毁虚基类。</p>
<p>这也意味着：<b>基类构造时，派生类成员还没构造</b>；如果在基类构造函数里调用虚函数，只能派发到当前正在构造的类，绝不会到派生类。不要在构造或析构期间调用虚函数，也不要让它们回调到依赖完整对象的外部逻辑。另一条常见规则是：成员按声明顺序构造，与初始化列表书写顺序无关，析构时自然按声明逆序。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="构造与析构顺序对照：构造自上而下经过虚基类、直接基类、成员和函数体，析构自下而上逆序" font-family="inherit">
<defs>
<marker id="classes-lifecycle-down" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
<path d="M 0 0 L 10 5 L 0 10 z" fill="var(--sv-a)"/>
</marker>
<marker id="classes-lifecycle-up" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
<path d="M 0 0 L 10 5 L 0 10 z" fill="var(--sv-b)"/>
</marker>
</defs>
<text x="200" y="30" text-anchor="middle" font-size="15" fill="var(--sv-ink)">构造：自上而下</text>
<text x="560" y="30" text-anchor="middle" font-size="15" fill="var(--sv-ink)">析构：自下而上</text>
<g text-anchor="middle">
<rect x="60" y="52" width="280" height="46" rx="4" fill="var(--sv-a)" fill-opacity="0.22" stroke="var(--sv-a)"/>
<text x="200" y="72" font-size="13" fill="var(--sv-ink)">虚基类（最派生类负责）</text>
<text x="200" y="89" font-size="11" fill="var(--sv-muted)">深度优先、从左到右</text>

<rect x="60" y="126" width="280" height="46" rx="4" fill="var(--sv-a2)" fill-opacity="0.22" stroke="var(--sv-a2)"/>
<text x="200" y="146" font-size="13" fill="var(--sv-ink)">直接基类</text>
<text x="200" y="163" font-size="11" fill="var(--sv-muted)">按继承列表声明顺序</text>

<rect x="60" y="200" width="280" height="46" rx="4" fill="var(--sv-b2)" fill-opacity="0.22" stroke="var(--sv-b2)"/>
<text x="200" y="220" font-size="13" fill="var(--sv-ink)">非静态成员</text>
<text x="200" y="237" font-size="11" fill="var(--sv-muted)">按类内声明顺序，与列表书写无关</text>

<rect x="60" y="274" width="280" height="46" rx="4" fill="var(--sv-b)" fill-opacity="0.22" stroke="var(--sv-b)"/>
<text x="200" y="294" font-size="13" fill="var(--sv-ink)">构造函数体</text>
<text x="200" y="311" font-size="11" fill="var(--sv-muted)">此时所有子对象已就绪</text>

<rect x="420" y="52" width="280" height="46" rx="4" fill="var(--sv-b)" fill-opacity="0.22" stroke="var(--sv-b)"/>
<text x="560" y="72" font-size="13" fill="var(--sv-ink)">析构函数体</text>
<text x="560" y="89" font-size="11" fill="var(--sv-muted)">成员仍存活，但不再派发到派生类</text>

<rect x="420" y="126" width="280" height="46" rx="4" fill="var(--sv-b2)" fill-opacity="0.22" stroke="var(--sv-b2)"/>
<text x="560" y="146" font-size="13" fill="var(--sv-ink)">非静态成员（逆序）</text>
<text x="560" y="163" font-size="11" fill="var(--sv-muted)">后声明者先销毁</text>

<rect x="420" y="200" width="280" height="46" rx="4" fill="var(--sv-a2)" fill-opacity="0.22" stroke="var(--sv-a2)"/>
<text x="560" y="220" font-size="13" fill="var(--sv-ink)">直接基类（逆序）</text>
<text x="560" y="237" font-size="11" fill="var(--sv-muted)">先声明的基类后销毁</text>

<rect x="420" y="274" width="280" height="46" rx="4" fill="var(--sv-a)" fill-opacity="0.22" stroke="var(--sv-a)"/>
<text x="560" y="294" font-size="13" fill="var(--sv-ink)">虚基类（最后）</text>
<text x="560" y="311" font-size="11" fill="var(--sv-muted)">与构造顺序完全相反</text>
</g>
<line x1="370" y1="60" x2="370" y2="320" stroke="var(--sv-a)" stroke-width="2" marker-end="url(#classes-lifecycle-down)"/>
<line x1="390" y1="320" x2="390" y2="60" stroke="var(--sv-b)" stroke-width="2" marker-end="url(#classes-lifecycle-up)"/>
<text x="380" y="352" text-anchor="middle" font-size="12" fill="var(--sv-muted)">同一层内部按声明顺序；析构严格逆序，且每个子对象只销毁一次</text>
</svg>
<figcaption>图 3 · 构造与析构顺序：基类 → 成员 → 函数体，析构严格逆序</figcaption>
</figure>
<p>下面这个例子可以直接用 C++20 编译运行（<code>g++ -std=c++20 -Wall</code>）。它故意让初始化列表的书写顺序与声明顺序相反，输出会暴露真实顺序；<code>-Wreorder</code> 也会提醒你。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;iostream&gt;
#include &lt;string&gt;
#include &lt;utility&gt;

struct Base {
    Base()  { std::cout &lt;&lt; "Base()\n"; }
    ~Base() { std::cout &lt;&lt; "~Base()\n"; }
};

struct Member {
    explicit Member(std::string n) : name(std::move(n)) {
        std::cout &lt;&lt; "Member(" &lt;&lt; name &lt;&lt; ")\n";
    }
    ~Member() { std::cout &lt;&lt; "~Member(" &lt;&lt; name &lt;&lt; ")\n"; }
    std::string name;
};

class Derived : public Base {
public:
    explicit Derived(int id)
        : b_("b"), a_("a"), id_(id) {   // 书写 b,a；实际按声明 a,b
        std::cout &lt;&lt; "Derived body id=" &lt;&lt; id_ &lt;&lt; "\n";
    }
    ~Derived() { std::cout &lt;&lt; "~Derived body\n"; }

private:
    Member a_;    // 没有默认构造，必须出现在初始化列表中
    Member b_;
    int id_ = 0;  // 默认成员初始化器，被列表中的 id_(id) 覆盖
};

int main() {
    Derived d(7);
    return 0;
}
// 输出：Base() / Member(a) / Member(b) / Derived body id=7 /
//       ~Derived body / ~Member(b) / ~Member(a) / ~Base()</code></pre>
</section>

<section class="sec">
<h2>默认、委托、拷贝构造与 explicit</h2>
<p>如果你不写任何构造函数，编译器会在满足条件时隐式声明一个<mark>默认构造函数（default constructor）</mark>。一旦你声明了任意构造函数，隐式默认构造就不再生成；此时可以写 <code>Derived() = default;</code> 显式要回它，或用 <code>= delete</code> 明确禁止。C++11 起还支持<mark>委托构造函数（delegating constructor）</mark>：一个构造函数在初始化列表里调用同类另一个构造函数，把公共逻辑集中到目标构造函数，目标完成后才执行自己的函数体。</p>
<p>委托构造有两条硬性规则：委托的构造函数，其初始化列表里不能再列成员（目标构造函数负责全部成员）；不能形成委托环，否则程序 ill-formed。<mark>拷贝构造函数（copy constructor）</mark>的典型签名是 <code>T(const T&amp;)</code>，在按值传参与同类型初始化时被调用；不过 C++17 起用纯右值直接初始化对象可被保证省略，不一定真的调用拷贝构造。编译器会在满足条件时隐式生成它，但用户声明移动构造或移动赋值会把它定义为 deleted，而声明析构或拷贝赋值只会让隐式拷贝构造被弃用（仍存在，但 deprecated）。完整规则与深浅拷贝问题在 copy-move-semantics 展开。</p>
<p><code>explicit</code> 用来关闭隐式转换：单参数构造函数默认允许 <code>T t = 42;</code> 这种拷贝初始化，加上 <code>explicit</code> 后只能直接初始化 <code>T t(42);</code> 或 <code>T t{42};</code>。C++11 把 <code>explicit</code> 扩展到转换运算符，C++20 又支持 <code>explicit(bool)</code> 条件显式。经验法则是：<b>除非你确实想要隐式转换，否则单参数构造函数一律加 explicit</b>。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>特殊成员函数</th><th>典型签名</th><th>何时隐式提供（简化）</th><th>关键约束</th></tr></thead>
<tbody>
<tr><td>默认构造</td><td><code>T()</code></td><td>没有用户声明的任何构造函数时</td><td>有成员不可默认构造则被删除</td></tr>
<tr><td>析构函数</td><td><code>~T()</code></td><td>用户未声明析构时</td><td>异常说明按子对象推导，全部不抛才是 <code>noexcept(true)</code></td></tr>
<tr><td>拷贝构造</td><td><code>T(const T&amp;)</code></td><td>未声明拷贝构造时；声明移动操作会删除它</td><td>声明析构或拷贝赋值会弃用隐式版本</td></tr>
<tr><td>拷贝赋值</td><td><code>T&amp; operator=(const T&amp;)</code></td><td>未声明拷贝赋值时</td><td>与拷贝构造同理，注意自赋值</td></tr>
<tr><td>移动构造 / 移动赋值</td><td><code>T(T&amp;&amp;)</code> / <code>T&amp; operator=(T&amp;&amp;)</code></td><td>未声明拷贝操作、移动操作或析构时</td><td>任一用户声明的拷贝/移动操作或析构都会抑制隐式移动</td></tr>
</tbody>
</table></div>
<p>表中的是简化规则；真实规则还涉及成员与基类的可拷贝性、引用成员等，以 cppreference 的“特殊成员函数”条目为准。工程上更推荐<mark>规则零（Rule of Zero）</mark>：让成员对象自己管理资源，类不手写析构、拷贝、移动，编译器生成的版本自然正确。</p>
</section>

<section class="sec">
<h2>析构函数、RAII 预告、static 成员与 this</h2>
<h3>析构函数与 RAII 预告</h3>
<p>析构函数在对象生存期结束时自动调用，负责释放对象持有的资源。它没有参数、没有返回类型、不能重载。通过基类指针 <code>delete</code> 派生类对象时，若基类析构不是 <code>virtual</code>，行为是未定义；多态基类应声明 <code>virtual ~Base() = default;</code>。虚函数派发细节留到“多态与虚函数”一篇。</p>
<p><mark>RAII（Resource Acquisition Is Initialization，资源获取即初始化）</mark>是 C++ 最重要的惯用法：把资源绑定到对象生存期，构造时获取、析构时释放。栈展开（stack unwinding）会保证局部对象在异常路径上也被析构，因此 <code>std::vector</code>、<code>std::unique_ptr</code>、<code>std::lock_guard</code> 能在异常下不漏资源。具体写法留到 RAII 一篇，这里记住：<b>析构函数是资源释放的最后一道保险</b>。</p>
<h3>static 成员</h3>
<p><code>static</code> 数据成员属于类而不是某个对象，全程序只有一份存储。C++17 起可用 <code>inline static</code> 在类内定义并初始化，省去“类内声明、类外定义”的分离写法。静态成员函数没有 <code>this</code>，不能直接访问非静态成员。函数内的 <code>static</code> 局部变量在 C++11 起保证线程安全的一次性初始化，常用于单例或惰性缓存。</p>
<h3>this 与 const 成员函数</h3>
<p>非静态成员函数里有一个隐式参数 <code>this</code>，构造与析构期间它同样存在，但此时对象尚未完整或正在拆解，不能交给外部观察者。成员函数声明为 <code>const</code> 时，<code>this</code> 的类型从 <code>T*</code> 变成 <code>const T*</code>；const 重载的选择与 <code>const_cast</code> 的风险已在 pointers-const 讲清，这里不再展开。与生命周期相关的一点是：在良定义的程序中 <code>this</code> 永远非空，通过空指针调用成员函数是 UB，即使函数体没有解引用 <code>this</code>。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div><code>mutable</code> 是给“逻辑常量”用的，不是给偷懒用的。它只适合缓存、惰性求值结果、同步原语这类不影响可观察行为的成员，完整规则见 pointers-const。</div></div>
</section>

<section class="sec">
<h2>友元、嵌套类与构造析构的异常语义</h2>
<h3>友元</h3>
<p><code>friend</code> 声明授予某个函数或类访问本类 <code>private</code>/<code>protected</code> 成员的权限。它有几个容易记错的点：友元关系<b>不被继承</b>，也<b>不传递</b>（A 是 B 的友元、B 是 C 的友元，不代表 A 能访问 C）；友元是单向的，除非双方互相声明；友元声明只是权限授予，不会让函数成为成员。工程上常用<mark>隐藏友元（hidden friend）</mark>——在类内定义 <code>friend bool operator==(const T&amp;, const T&amp;)</code>，既可直接访问私有成员，又能被 ADL（Argument-Dependent Lookup，实参依赖查找）找到。</p>
<h3>嵌套类</h3>
<p>嵌套类（nested class）是定义在另一个类作用域内的类，它是外围类的成员，名字受外围类作用域限制。嵌套类与外围类的其他成员拥有相同的访问权限，可以直接访问外围类的私有成员；但它没有外围类的隐式 <code>this</code>，要操作外围对象必须显式传入引用或指针。两者是独立类型，不会因嵌套获得特殊布局或生命周期关系。</p>
<h3>构造与析构的异常语义</h3>
<p>构造函数抛出异常时，对象从未完成构造：它自己的析构函数<b>不会</b>被调用；但已经完整构造的基类与成员会按逆序销毁，数组里已构造的元素也会被销毁。这就是“部分构造回滚”。因此构造函数中申请裸资源必须自己兜底，或交给成员对象托管。唯一的例外是委托构造：若目标构造函数已经完成，随后委托者自己的函数体抛出异常，对象已被视为构造完成，析构函数会被调用。</p>
<p>析构函数的异常说明常被误解。隐式声明的析构函数，其异常说明由基类与成员的析构共同决定：只有所有子对象的析构都承诺不抛时，它才是 <code>noexcept(true)</code>，否则隐式成为 <code>noexcept(false)</code>。显式写 <code>~T()</code> 而不加异常说明时同样按子对象推导，并不是无条件 <code>noexcept</code>。若一个 <code>noexcept</code> 的析构函数抛出异常，或在栈展开过程中另一个异常从析构函数逃出，程序都会调用 <code>std::terminate</code>。所以析构函数应吞掉或记录异常，绝不向外抛；确需抛异常时要显式写 <code>noexcept(false)</code>，但这通常意味着设计有问题。</p>
<div class="callout callout--warn"><span class="callout__label">警告</span><div>不要在构造函数里调用虚函数，也不要在构造/析构期间把 <code>this</code> 交给外部观察者（线程、回调、注册表）。此时对象要么还没完整，要么已经开始拆解；外部一旦访问，就是悬空或未初始化状态。需要“构造完成后动作”时，用两段式初始化或工厂函数显式表达。</div></div>
</section>

<section class="sec">
<h2>自测与延伸阅读</h2>
<p>下面三道题覆盖顺序、访问控制与异常语义。</p>
<details class="quiz"><summary>Q1 · 成员初始化列表写成 b_(1), a_(2)，但类内声明是 a_ 在前、b_ 在后。实际谁先构造？如果 b_ 的初始化表达式读取 a_，会发生什么？</summary><div class="quiz__a">实际顺序由声明顺序决定：<code>a_</code> 先构造，<code>b_</code> 后构造。初始化列表只是“给每个成员提供初值”的语法位置，不决定顺序。本题中 <code>a_</code> 声明在前，所以 <code>b_</code> 的初始化表达式读取 <code>a_</code> 是安全的——<code>a_</code> 的生存期已经开始。危险的是相反的情形：若某成员的初始化表达式读取了声明在它后面的成员，那个成员尚未初始化（类类型成员的生存期尚未开始，内建类型成员的值不确定），读取它同样是未定义行为。修法是让初始化列表顺序与声明顺序一致，并打开 <code>-Wreorder</code>。</div></details>
<details class="quiz"><summary>Q2 · class 里把 public 数据成员写在 private 成员前面，能保证前者地址更低吗？</summary><div class="quiz__a">不能。标准明确规定不同访问控制下的非静态数据成员的分配顺序是未指定的。常见 ABI 通常按声明顺序排列，但不可移植；混用访问说明符还可能影响 standard-layout 判定。</div></details>
<details class="quiz"><summary>Q3 · 构造函数中某个成员构造抛异常，哪些析构函数会被执行？对象自己的析构呢？</summary><div class="quiz__a">对象自身的析构函数不会执行，因为对象从未完整构造。已经完整构造的基类与先声明的成员会按逆序销毁；若在数组中，已构造完成的元素也会被销毁。构造函数的函数体尚未执行（或执行中抛异常），其局部对象按栈展开规则处理。例外仍是委托构造：目标构造函数完成后委托者函数体才抛出时，对象被视为已构造，析构函数会被调用。这正是把资源放进成员对象、依赖 RAII 的原因。</div></details>
<ul class="refs">
<li><b>cppreference: Constructors and member initializer lists</b> — cppreference.com。梳理默认、委托、拷贝、移动构造与初始化列表规则。</li>
<li><b>cppreference: Destructors</b> — cppreference.com。析构函数的调用时机、隐式异常说明、虚析构与异常行为。</li>
<li><b>C++ Core Guidelines C.1–C.9</b> — Bjarne Stroustrup、Herb Sutter。关于类与对象组织方式的上层建议，适合与本文对照阅读。</li>
<li><b>《Effective C++（第三版）》条款 4、5</b> — Scott Meyers, 2005。条款 4 讲对象使用前初始化，条款 5 讲编译器默认生成的函数，正好补足本文的工程视角。</li>
<li><b>cppreference: The rule of three/five/zero</b> — cppreference.com。解释何时需要手写析构、拷贝与移动，是规则零的权威入口。</li>
</ul>
</section>`
};
