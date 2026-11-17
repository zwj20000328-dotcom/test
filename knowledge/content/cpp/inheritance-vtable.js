window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["inheritance-vtable"] = {
  slug: "inheritance-vtable",
  title: "继承、虚函数与对象布局",
  subtitle: "多态在内存里长什么样",
  level: 1,
  cluster: "语言核心",
  tags: ["继承", "虚函数", "vtable"],
  summary: "从访问控制与构造析构顺序讲到 vtable/vptr 布局、虚析构、切片与多继承，用可编译示例和内存图建立多态心智模型，并给出组合优于继承的判据。",
  keyPoints: [
    "public 继承表达 is-a；private 继承只是实现复用，成员可见性由继承方式与基类访问级别共同决定。",
    "构造顺序是虚基类、直接基类、成员、函数体；期间 vptr 逐层切换，构造与析构中调用虚函数不会到达派生类。",
    "vtable 是类级函数指针表，vptr 是对象级指针；Itanium ABI 下地址点前是 offset-to-top 与 typeinfo，虚析构占两个槽位，但这些都不是标准保证。",
    "通过基类指针 delete 时基类析构必须是 public virtual；按值传递或存进 vector<Base> 会发生对象切片。",
    "多继承时每个多态基类子对象各带 vptr；覆盖调用需要 this 调整与 thunk，dynamic_cast 依赖 RTTI 且向下/交叉转型要求源类型多态。"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>直觉：一次调用如何走到正确的函数</h2>
<p>先给一句直觉：<mark>多态（polymorphism）</mark>就是“用基类的接口发起调用，实际执行派生类的实现”。编译器在编译期只知道静态类型（static type），运行时靠对象里的一个指针找到按固定槽位排布的函数表，取出地址再跳过去。这个间接层通常被描述为 <mark>vtable</mark>（虚函数表）与 <mark>vptr</mark>（虚表指针），但它们是主流实现采用的技术，不是 C++ 标准规定的对象组成部分。</p>
<p>没有多态时，处理一组异构对象只能写 <code>switch</code> 加枚举，每加一种新类型，所有分派点都要改。多态把“选择哪个实现”从调用点推迟到运行时，也就是<mark>晚绑定（late binding）</mark>，代价通常是每次调用多一次间接跳转，每个对象多一个指针。理解这份代价，才能判断何时用虚函数、何时用 <code>std::variant</code>、模板或类型擦除。</p>
<p>本篇按“语义、生命周期、内存布局、边界与工程实践”展开。先声明边界：C++ 标准规定的是可观察行为，<b>不规定</b> vtable 的具体形状，也不规定 vptr 一定位于对象偏移 0。下文偏移与槽位以 <mark>Itanium C++ ABI</mark>（GCC 与 Clang 在 Linux、macOS 等平台的典型实现）在 64 位下的常见布局为例；MSVC 的 vftable 布局不同，不能互相套用。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>vtable 属于类，vptr 属于对象。同一程序映像内，同一类的所有对象共享该类的 vtable；每个多态对象至少有一个 vptr。对象变大、拷贝变贵、缓存行更紧张，都是这个指针带来的连锁反应。</div></div>
</section>

<section class="sec">
<h2>继承与访问控制：先分清 is-a 与“拿来实现”</h2>
<p>C++ 的继承有两种常见用途。第一种是<mark>接口继承</mark>：<code>public</code> 继承表达“派生类是一种基类”，派生类对象可绑定到基类引用或指针，替换后行为仍成立，这就是里氏替换原则（Liskov Substitution Principle，LSP）。第二种是<mark>实现继承</mark>：<code>private</code> 继承只复用实现，外部看不到“是一种”的关系。<code>protected</code> 继承介于两者之间，实践中很少见。</p>
<p>继承方式改变的是成员在派生类中的<b>最大可见性</b>，而基类自身的访问级别是另一道门。两者取更严格的一方，规则可以压缩成一张表。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>继承方式</th><th>基类 public 成员</th><th>基类 protected 成员</th><th>基类 private 成员</th><th>语义</th></tr></thead>
<tbody>
<tr><td><code>public</code></td><td>public</td><td>protected</td><td>不可访问</td><td>is-a，可替换</td></tr>
<tr><td><code>protected</code></td><td>protected</td><td>protected</td><td>不可访问</td><td>只允许进一步派生</td></tr>
<tr><td><code>private</code></td><td>private</td><td>private</td><td>不可访问</td><td>implemented-in-terms-of</td></tr>
</tbody></table></div>
<p>还有两个容易踩的点。其一，<code>private</code> 成员对派生类永远不可见，派生类只能通过基类接口访问，<code>friend</code> 也不被继承。其二，访问控制与继承方式都是编译期检查；在常见实现中，改变继承方式不会让对象变小，也不会移动 vptr，但标准并不保证类对象的具体布局，跨编译器比较布局时仍应以 ABI 文档为准，不能把“在我这里没变”当成语言规则。</p>
<p>名字隐藏（name hiding）比访问控制更容易制造“看起来没调用对”的 bug。派生类一旦声明了某个名字，就会隐藏基类中<b>所有</b>同名成员（包括全部重载），而不是与它们一起参与重载。需要保留基类版本时，显式写 <code>using Base::f;</code> 把它引入当前作用域。名字隐藏本身合法，但它常让“我以为覆盖了”变成“其实只是隐藏”；Core Guidelines C.128 要求虚函数明确写 <code>virtual</code>、<code>override</code>、<code>final</code> 之一，正是为了让这类误用尽早暴露。</p>
</section>

<section class="sec">
<h2>构造与析构顺序：vptr 在什么时候换</h2>
<p>一个对象的构造按固定顺序推进：先构造<mark>虚基类</mark>（按继承图做深度优先、从左到右遍历，首次出现者优先），再按<b>声明顺序</b>构造直接基类，然后按声明顺序构造非静态数据成员，最后执行构造函数体。析构严格逆序：先执行析构函数体，再逆序销毁成员，再逆序销毁基类。成员初始化顺序由声明顺序决定，与初始化列表顺序无关；不一致时 GCC/Clang 的 <code>-Wreorder</code> 会告警。</p>
<p>多态对象并不是“一开始就是派生类”。基类构造函数执行时，对象的动态类型被视为当前正在构造的类，vptr 指向该类的 vtable；基类构造完成后，派生类构造函数在初始化成员、执行函数体之前把 vptr 改写为派生类的 vtable。析构时反向逐层改回。下图把这条时间线画成三段。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="构造期间 vptr 从基类虚表切换到派生类虚表的时间线">
<defs>
<marker id="inheritance-vtable-arrow2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-a)"/></marker>
<marker id="inheritance-vtable-arrow2b" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-muted)"/></marker>
</defs>
<text x="24" y="26" font-size="14" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">构造过程中对象里的 vptr 与虚调用目标</text>

<text x="129" y="54" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">① Base 构造中</text>
<rect x="34" y="66" width="190" height="70" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<line x1="34" y1="101" x2="224" y2="101" stroke="var(--sv-line)"/>
<text x="46" y="89" font-size="12" font-family="inherit" fill="var(--sv-ink)">vptr</text>
<text x="212" y="89" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">→ Base 表</text>
<text x="46" y="123" font-size="12" font-family="inherit" fill="var(--sv-ink)">int x（未初始化）</text>
<line x1="129" y1="136" x2="129" y2="164" stroke="var(--sv-a)" stroke-width="2" marker-end="url(#inheritance-vtable-arrow2)"/>
<rect x="34" y="170" width="190" height="76" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="129" y="194" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">Base 的 vtable</text>
<text x="129" y="216" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">f → Base::f</text>
<text x="129" y="236" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">dtor → Base::~Base</text>
<text x="129" y="272" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">动态类型视为 Base</text>
<text x="129" y="291" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">虚调用进入 Base::f</text>

<text x="379" y="54" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">② 派生类成员与函数体</text>
<rect x="284" y="66" width="190" height="70" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<line x1="284" y1="101" x2="474" y2="101" stroke="var(--sv-line)"/>
<text x="296" y="89" font-size="12" font-family="inherit" fill="var(--sv-ink)">vptr</text>
<text x="462" y="89" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">→ Derived 表</text>
<text x="296" y="123" font-size="12" font-family="inherit" fill="var(--sv-ink)">成员已陆续构造</text>
<line x1="379" y1="136" x2="379" y2="164" stroke="var(--sv-a)" stroke-width="2" marker-end="url(#inheritance-vtable-arrow2)"/>
<rect x="284" y="170" width="190" height="76" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="379" y="194" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">Derived 的 vtable</text>
<text x="379" y="216" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">f → Derived::f</text>
<text x="379" y="236" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">dtor → Derived::~Derived</text>
<text x="379" y="272" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">vptr 在基类构造后被改写</text>
<text x="379" y="291" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">此后虚调用才到达派生类</text>

<text x="629" y="54" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">③ 构造完成后的使用期</text>
<rect x="534" y="66" width="190" height="70" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<line x1="534" y1="101" x2="724" y2="101" stroke="var(--sv-line)"/>
<text x="546" y="89" font-size="12" font-family="inherit" fill="var(--sv-ink)">vptr</text>
<text x="712" y="89" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">→ Derived 表</text>
<text x="546" y="123" font-size="12" font-family="inherit" fill="var(--sv-ink)">全部成员可用</text>
<line x1="629" y1="136" x2="629" y2="164" stroke="var(--sv-a)" stroke-width="2" marker-end="url(#inheritance-vtable-arrow2)"/>
<rect x="534" y="170" width="190" height="76" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="629" y="194" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">Derived 的 vtable</text>
<text x="629" y="216" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">f → Derived::f</text>
<text x="629" y="236" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">dtor → Derived::~Derived</text>
<text x="629" y="272" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">多态调用稳定生效</text>
<text x="629" y="291" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">析构时按逆序逐层改回</text>

<line x1="40" y1="330" x2="720" y2="330" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#inheritance-vtable-arrow2b)"/>
<text x="40" y="354" font-size="12" font-family="inherit" fill="var(--sv-muted)">构造：基类 → 成员 → 函数体</text>
<text x="720" y="354" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">析构：函数体 → 成员 → 基类（vptr 逆序回退）</text>
</svg>
<figcaption>图 1 · vptr 在构造期间逐层切换；析构时沿相反方向回退。派生类构造函数体执行时，vptr 已经指向派生类虚表。</figcaption>
</figure>
<p>正因为如此，<b>构造函数和析构函数里调用虚函数不会分派到派生类</b>。基类构造期间，派生部分尚未构造；析构期间，派生部分已经销毁。若以虚调用方式调用一个尚未被覆盖的纯虚函数，行为未定义，典型实现会调用 <code>__cxa_pure_virtual</code> 并终止进程。若写 <code>Base::show()</code> 这样的限定调用，则不经过虚分派，即使对象已经完整构造也直接进入 <code>Base::show</code>。这与 Core Guidelines C.35、C.37 的析构规则同源。</p>
<p>下面这段代码可以原样编译运行，输出顺序直接展示构造顺序与 vptr 切换的结果。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;iostream&gt;
#include &lt;memory&gt;
#include &lt;string&gt;
#include &lt;vector&gt;

struct Base {
    Base() { std::cout &lt;&lt; "Base()\n"; show(); }   // 此时 vptr 指向 Base 表
    virtual ~Base() { std::cout &lt;&lt; "~Base()\n"; }
    virtual void show() const { std::cout &lt;&lt; "Base::show\n"; }
};

struct Derived : Base {
    Derived() : name{"d"} {
        std::cout &lt;&lt; "Derived()\n";
        show();                                   // 此时 vptr 已指向 Derived 表
    }
    ~Derived() override { std::cout &lt;&lt; "~Derived()\n"; }
    void show() const override {
        std::cout &lt;&lt; "Derived::show " &lt;&lt; name &lt;&lt; "\n";
    }
    std::string name;
};

int main() {
    std::vector&lt;std::unique_ptr&lt;Base&gt;&gt; xs;
    xs.push_back(std::make_unique&lt;Derived&gt;());
    for (const auto&amp; p : xs) p-&gt;show();
}</code></pre>
<p>典型输出是：<code>Base()</code>、<code>Base::show</code>、<code>Derived()</code>、<code>Derived::show d</code>、<code>Derived::show d</code>、<code>~Derived()</code>、<code>~Base()</code>。第一行 <code>show()</code> 在基类构造体内执行，分派到 <code>Base::show</code>；派生类函数体里的 <code>show()</code> 才到达 <code>Derived::show</code>。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>不要在构造或析构期间调用虚函数，更不要用“基类构造发一个虚回调”来初始化派生类状态。派生类成员还没构造或已经销毁，回调即使能到达派生类，读到的也是未定义的值。</div></div>
</section>

<section class="sec">
<h2>vtable 与 vptr：一张类级表，一个对象级指针</h2>
<p>在 Itanium ABI 的典型实现里，多态对象的主 vptr 通常在偏移 0 处，指向该类的 vtable。无虚基类时，<mark>地址点（address point）</mark>之前紧邻的两项不是函数指针：一项是 <mark>offset-to-top</mark>，记录当前子对象到完整对象的偏移，多继承时用于指针调整；另一项是 <mark>typeinfo</mark> 指针，支撑 RTTI。真正的函数槽位从地址点开始，vptr 正好指向这里，所以这两项位于 vptr 的负偏移处。若类含虚基类，地址点之前还会有若干<mark>虚基偏移项（vbase offsets）</mark>，它们同样位于负偏移区。虚析构通常占两个槽位：完整对象析构函数（D1）与删除析构函数（D0），后者在析构后负责释放内存。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="单继承对象、vptr 与 vtable 槽位的内存布局">
<defs>
<marker id="inheritance-vtable-arrow1" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-a)"/></marker>
<marker id="inheritance-vtable-arrow1b" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-muted)"/></marker>
</defs>
<text x="24" y="28" font-size="14" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">struct D : Base 的典型内存布局（64 位 Itanium ABI，示意）</text>

<rect x="24" y="56" width="220" height="120" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<line x1="24" y1="96" x2="244" y2="96" stroke="var(--sv-line)"/>
<line x1="24" y1="136" x2="244" y2="136" stroke="var(--sv-line)"/>
<text x="38" y="82" font-size="12" font-family="inherit" fill="var(--sv-ink)">vptr = 0x4010</text>
<text x="38" y="121" font-size="12" font-family="inherit" fill="var(--sv-ink)">int x = 7</text>
<text x="38" y="160" font-size="12" font-family="inherit" fill="var(--sv-muted)">填充（对齐到 8 字节）</text>
<text x="24" y="200" font-size="12" font-family="inherit" fill="var(--sv-muted)">对象在栈或堆上，每个对象各有一个 vptr</text>

<path d="M244,76 C300,76 330,156 392,156" fill="none" stroke="var(--sv-a)" stroke-width="2" marker-end="url(#inheritance-vtable-arrow1)"/>
<text x="316" y="64" font-size="12" font-family="inherit" fill="var(--sv-a)" text-anchor="middle">指向</text>

<rect x="396" y="40" width="330" height="260" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="410" y="62" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">D 的 vtable（全类共享，通常只读）</text>
<line x1="396" y1="76" x2="726" y2="76" stroke="var(--sv-line)"/>
<line x1="396" y1="116" x2="726" y2="116" stroke="var(--sv-line)"/>
<line x1="396" y1="156" x2="726" y2="156" stroke="var(--sv-line)"/>
<line x1="396" y1="196" x2="726" y2="196" stroke="var(--sv-line)"/>
<line x1="396" y1="236" x2="726" y2="236" stroke="var(--sv-line)"/>
<line x1="396" y1="276" x2="726" y2="276" stroke="var(--sv-line)"/>
<text x="410" y="101" font-size="12" font-family="inherit" fill="var(--sv-muted)">-16</text>
<text x="446" y="101" font-size="12" font-family="inherit" fill="var(--sv-ink)">offset-to-top = 0</text>
<text x="410" y="141" font-size="12" font-family="inherit" fill="var(--sv-muted)">-8</text>
<text x="446" y="141" font-size="12" font-family="inherit" fill="var(--sv-ink)">typeinfo 指针 → typeinfo(D)</text>
<text x="410" y="181" font-size="12" font-family="inherit" fill="var(--sv-muted)">+0</text>
<text x="446" y="181" font-size="12" font-family="inherit" fill="var(--sv-ink)">D::f 的地址（地址点）</text>
<text x="410" y="221" font-size="12" font-family="inherit" fill="var(--sv-muted)">+8</text>
<text x="446" y="221" font-size="12" font-family="inherit" fill="var(--sv-ink)">D::g 的地址</text>
<text x="410" y="261" font-size="12" font-family="inherit" fill="var(--sv-muted)">+16</text>
<text x="446" y="261" font-size="12" font-family="inherit" fill="var(--sv-ink)">D::~D 的地址（D1，完整析构）</text>
<text x="410" y="289" font-size="12" font-family="inherit" fill="var(--sv-muted)">+24</text>
<text x="446" y="289" font-size="12" font-family="inherit" fill="var(--sv-ink)">D::~D 的地址（D0，删除析构）</text>

<line x1="360" y1="156" x2="726" y2="156" stroke="var(--sv-c)" stroke-width="2" stroke-dasharray="6 4"/>
<text x="24" y="238" font-size="12" font-family="inherit" fill="var(--sv-muted)">前两个槽位是元数据，不是函数指针</text>
<text x="24" y="260" font-size="12" font-family="inherit" fill="var(--sv-muted)">覆盖项沿用基类槽位，新增虚函数按声明顺序追加</text>
<text x="24" y="282" font-size="12" font-family="inherit" fill="var(--sv-muted)">析构占两槽是 Itanium ABI 的典型做法</text>
<text x="24" y="318" font-size="12" font-family="inherit" fill="var(--sv-muted)">vptr 指向地址点（vtable+16），前两项在负偏移处</text>
</svg>
<figcaption>图 2 · 单继承下对象与 vtable 的典型布局。对象里只有一个 vptr；vtable 属于类，函数槽位从地址点开始，无虚基类时前两项分别服务指针调整与 RTTI。</figcaption>
</figure>
<p>同一程序映像内，同一类的对象共享该类的 vtable；不同翻译单元或共享库可能各有一份内容相同的副本，链接器通常会合并重复项，但跨共享库并不保证地址相同，所以不要依赖 vptr 的具体数值做比较。函数槽位的顺序也不是简单“按派生类声明重排”：覆盖基类虚函数的项沿用基类 vtable 中的位置，派生类新增的虚函数才按声明顺序追加到表尾。</p>
<p>语义层面，<code>override</code> 与 <code>final</code> 是 C++11 引入的两个上下文关键字。<code>override</code> 让编译器检查“确实覆盖了某个基类虚函数”：参数、const、引用限定或异常规格不兼容都会报错（派生类可以把异常规格收窄为 <code>noexcept</code>，反向放宽则不行），而不是悄悄变成隐藏基类版本的新函数。<code>final</code> 可以标在虚函数上（禁止进一步覆盖），也可以标在类上（禁止派生）；它也给编译器提供去虚化（devirtualization）依据，但能否生效取决于优化器与可见性，不是性能承诺。</p>
<p>覆盖的签名必须一致，返回类型只允许<mark>协变返回（covariant return）</mark>：基类返回 <code>Base*</code> 或 <code>Base&amp;</code> 时，派生类可以返回 <code>Derived*</code> 或 <code>Derived&amp;</code>。访问级别不影响分派：派生类把覆盖写成 <code>private</code>，通过基类指针仍会进入派生类实现。</p>
<p><mark>纯虚函数</mark>用 <code>= 0</code> 声明，含有纯虚函数的类是<mark>抽象类（abstract class）</mark>，不能直接实例化。纯虚函数可以有定义；派生类若不覆盖它，仍然是抽象类，不能创建对象。纯虚析构函数则<b>必须</b>提供定义，因为派生类析构时会调用它。C++20 起虚函数可为 <code>constexpr</code>，但运行期多态很少用到。</p>
<div class="formula">多态调用（典型实现）：p → vptr → vtable[slot] → 函数地址 → 以 this 调用
对象大小 ≈ 各基类子对象大小 + 新增数据成员 + 对齐填充；对象通常至少有一个 vptr，每多一个需要独立虚表的多态基类子对象通常再增加一个指针（64 位下 8 字节）</div>
<p>尺寸上要谨慎：64 位 Itanium ABI 下，带虚函数的空类典型 <code>sizeof</code> 为 8 字节（普通空类为 1），但这是实现结果，不是标准承诺。MSVC 在多数布局里同样使用 vftable 指针，RTTI 的完整对象定位符放在 vftable 之前（vftable[-1]），虚析构的槽位组织也不同；虚继承下还可能插入 vbptr 与 vtordisp，具体偏移更不能拿 Itanium 的图去套。跨编译器讨论二进制布局时，先问 ABI，再谈偏移。</p>
</section>

<section class="sec">
<h2>虚析构与对象切片：两个代价最高的错误</h2>
<p>第一个错误是通过基类指针删除派生类对象，而基类析构函数不是虚函数。此时 <code>delete</code> 只调用基类析构，派生类的析构函数体与成员都不会被销毁，行为未定义；即使派生类没有额外资源，标准也不保证程序能正常结束。Core Guidelines C.35 给的规则很干脆：基类析构要么是 <code>public</code> 且 <code>virtual</code>，要么是 <code>protected</code> 且非虚。后者适用于“绝不通过基类指针删除”的设计，把误删变成编译错误。</p>
<p>第二个错误是<mark>对象切片（object slicing）</mark>：把派生类对象按值赋给基类对象，或按值传参给接受基类的函数。基类的拷贝构造函数只复制基类子对象，派生类部分被“切掉”，副本里的 vptr 也指向基类虚表，多态随之消失。容器是最常见的现场：<code>std::vector&lt;Base&gt;</code> 只能存下 <code>Base</code> 大小的对象，<code>push_back(Derived{})</code> 一定会切片。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;memory&gt;
#include &lt;vector&gt;

struct Shape {
    virtual ~Shape() = default;
    virtual double area() const { return 0.0; }
};

struct Circle : Shape {
    explicit Circle(double rr) : r{rr} {}
    double area() const override { return 3.14159 * r * r; }
    double r;
};

void byValue(Shape s) { (void)s.area(); }   // 切片：s 是 Shape

int main() {
    Circle c{2.0};
    byValue(c);                             // 只复制 Shape 子对象
    std::vector&lt;Shape&gt; v;
    v.push_back(c);                         // 同样切片
    std::vector&lt;std::unique_ptr&lt;Shape&gt;&gt; ok;
    ok.push_back(std::make_unique&lt;Circle&gt;(2.0));   // 保留动态类型
}</code></pre>
<p>修复方式有三类：传引用或指针；容器存 <code>std::unique_ptr&lt;Base&gt;</code> 或 <code>std::reference_wrapper&lt;Base&gt;</code>；如果基类本来就不该被按值复制，可以显式写 <code>Base(const Base&amp;) = delete;</code>（C++11），让按值复制在编译期失败。最后一种做法的代价是 Base 及其派生类都不再可复制，适合接口类，不适合还要按值返回的类型。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>场景</th><th>写法</th><th>后果</th><th>修复</th></tr></thead>
<tbody>
<tr><td>多态删除</td><td><code>delete basePtr;</code> 且基类析构非虚</td><td>未定义行为，派生部分不销毁</td><td>public virtual 析构，或 protected 非虚析构</td></tr>
<tr><td>按值传参</td><td><code>void f(Base b)</code></td><td>切片，虚调用退化为基类版本</td><td>改为 <code>Base&amp;</code> 或 <code>const Base&amp;</code></td></tr>
<tr><td>按值容器</td><td><code>std::vector&lt;Base&gt;</code></td><td>只能存基类子对象</td><td><code>std::vector&lt;std::unique_ptr&lt;Base&gt;&gt;</code></td></tr>
<tr><td>赋值给基类变量</td><td><code>Base b = derived;</code></td><td>切片，丢失派生状态</td><td>用引用、指针或智能指针</td></tr>
</tbody></table></div>
<div class="callout callout--tip"><span class="callout__label">建议</span><div>只要类层次打算被多态使用，就写 <code>virtual ~Base() = default;</code>，并让派生类用 <code>override</code>。如果确定不会通过基类指针删除，就把析构设为 protected 非虚，让误用变成编译期错误，而不是运行期未定义行为。</div></div>
</section>

<section class="sec">
<h2>多继承、菱形继承与 RTTI</h2>
<p>多继承下，每个多态基类子对象都可能带自己的 vptr，因为它们各自需要一张能被“该基类指针”直接使用的虚表。假设 <code>D</code> 同时继承 <code>A</code> 与 <code>B</code>，布局通常是：<code>A</code> 子对象在偏移 0，<code>B</code> 子对象紧随其后，最后是 <code>D</code> 自己的成员。当 <code>D</code> 覆盖了 <code>B</code> 的虚函数时，<code>B</code> 子对象的虚表槽位不能直接放 <code>D::fb</code>：调用时 <code>this</code> 指向的是 <code>B</code> 子对象，不是完整对象，所以槽位里放的是<mark>thunk</mark>（编译器生成的跳板），先把 <code>this</code> 加上或减去固定偏移，再跳到 <code>D::fb</code>。若 <code>D</code> 没有覆盖该函数，槽位可以直接指向 <code>B::fb</code>，就不需要调整。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="多继承对象布局、两个 vptr 与 thunk 指针调整">
<defs>
<marker id="inheritance-vtable-arrow3" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-a)"/></marker>
<marker id="inheritance-vtable-arrow3b" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-b)"/></marker>
</defs>
<text x="24" y="28" font-size="14" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">struct D : A, B 的对象与两张 vtable（64 位示意）</text>

<text x="20" y="76" font-size="12" font-family="inherit" fill="var(--sv-muted)">0</text>
<text x="20" y="136" font-size="12" font-family="inherit" fill="var(--sv-muted)">16</text>
<text x="20" y="196" font-size="12" font-family="inherit" fill="var(--sv-muted)">32</text>
<rect x="30" y="56" width="260" height="180" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<line x1="30" y1="116" x2="290" y2="116" stroke="var(--sv-line)"/>
<line x1="30" y1="176" x2="290" y2="176" stroke="var(--sv-line)"/>
<text x="44" y="76" font-size="12" font-family="inherit" fill="var(--sv-ink)">A 子对象：vptr_A = 0x5000</text>
<text x="278" y="76" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">int a</text>
<text x="44" y="136" font-size="12" font-family="inherit" fill="var(--sv-ink)">B 子对象：vptr_B = 0x5040</text>
<text x="278" y="136" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">int b</text>
<text x="44" y="196" font-size="12" font-family="inherit" fill="var(--sv-ink)">D 自己的成员</text>
<text x="278" y="196" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">int d</text>
<text x="30" y="258" font-size="12" font-family="inherit" fill="var(--sv-muted)">B* 指向偏移 16 的子对象，不是完整对象</text>

<path d="M290,74 C320,74 344,66 374,66" fill="none" stroke="var(--sv-a)" stroke-width="2" marker-end="url(#inheritance-vtable-arrow3)"/>
<path d="M290,134 C320,134 344,240 374,240" fill="none" stroke="var(--sv-b)" stroke-width="2" marker-end="url(#inheritance-vtable-arrow3b)"/>

<rect x="378" y="36" width="356" height="150" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="392" y="58" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">D 的主 vtable（给 A* 用）</text>
<line x1="378" y1="70" x2="734" y2="70" stroke="var(--sv-line)"/>
<line x1="378" y1="102" x2="734" y2="102" stroke="var(--sv-line)"/>
<line x1="378" y1="134" x2="734" y2="134" stroke="var(--sv-line)"/>
<text x="392" y="89" font-size="12" font-family="inherit" fill="var(--sv-ink)">-16　offset-to-top = 0</text>
<text x="392" y="121" font-size="12" font-family="inherit" fill="var(--sv-ink)">-8　typeinfo(D)</text>
<text x="392" y="153" font-size="12" font-family="inherit" fill="var(--sv-ink)">+0　D::fa（地址点）</text>

<rect x="378" y="214" width="356" height="150" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="392" y="236" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">D 的次 vtable（给 B* 用）</text>
<line x1="378" y1="248" x2="734" y2="248" stroke="var(--sv-line)"/>
<line x1="378" y1="280" x2="734" y2="280" stroke="var(--sv-line)"/>
<line x1="378" y1="312" x2="734" y2="312" stroke="var(--sv-line)"/>
<text x="392" y="267" font-size="12" font-family="inherit" fill="var(--sv-ink)">-16　offset-to-top = -16</text>
<text x="392" y="299" font-size="12" font-family="inherit" fill="var(--sv-ink)">-8　typeinfo(D)</text>
<text x="392" y="331" font-size="12" font-family="inherit" fill="var(--sv-ink)">+0　thunk：this -= 16，再跳 D::fb</text>
</svg>
<figcaption>图 3 · 多继承下每个多态基类子对象各带 vptr；次虚表里的 thunk 负责把 B* 调整为 D*，偏移值依 ABI 与成员类型而定。图中偏移相对各子对象的 vptr（地址点）。</figcaption>
</figure>
<p><mark>菱形继承（diamond inheritance）</mark>指 <code>B</code> 与 <code>C</code> 都继承 <code>A</code>，<code>D</code> 再同时继承 <code>B</code> 与 <code>C</code>。若不使用虚继承，<code>D</code> 里会有两份 <code>A</code> 子对象，访问 <code>A</code> 的成员时产生歧义。改用 <code>virtual</code> 继承后，<code>A</code> 只保留一份<mark>虚基类（virtual base）</mark>子对象，代价是访问虚基类成员要经过运行期偏移：Itanium ABI 把虚基偏移放在 vtable 的负偏移项里，MSVC 则常用单独的 vbptr。构造顺序也变成“最派生类负责构造虚基类，且虚基类最先构造”。虚继承应少用；多数“需要菱形”的场景，用组合或接口分离更清楚。</p>
<p><mark>RTTI（Run-Time Type Information）</mark>让程序在运行期查询动态类型。对多态类型的左值表达式，<code>typeid</code> 得到动态类型；对指针变量，<code>typeid</code> 得到的是指针的静态类型，不会解引用，因此 <code>typeid(*p)</code> 与 <code>typeid(p)</code> 含义不同。注意，若 <code>p</code> 是空指针且所指类型是多态类型，<code>typeid(*p)</code> 会抛出 <code>std::bad_typeid</code>，所以要先判空。<code>dynamic_cast</code> 则用于安全地做向下转型或交叉转型：做向下或交叉转型时，源类型必须是多态类型（至少有一个虚函数），否则编译失败；向上转型由编译器做静态偏移，不要求源类型多态。指针形式失败返回 <code>nullptr</code>，引用形式失败抛出 <code>std::bad_cast</code>。它依赖 RTTI，<code>-fno-rtti</code> 下不可用。</p>
<p>多继承下的 <code>dynamic_cast</code> 不只是“查表判断类型”，还要做指针调整：在图 3 的布局下，从 <code>B*</code> 转到 <code>D*</code> 要减 16，从 <code>B*</code> 交叉转型到 <code>A*</code> 同样要减 16；只有从 <code>D*</code> 转到 <code>A*</code> 才是不变的。这也是为什么 <code>reinterpret_cast</code> 在类层次之间转换通常是错的：它只改类型、不调整地址，得到的 <code>D*</code> 实际仍指向 <code>B</code> 子对象，后续访问会读错成员甚至越界；只有在单继承且基类子对象恰好位于偏移 0 时它才“碰巧”可用，而这不是标准保证。交叉转型只有 <code>dynamic_cast</code> 能做对。</p>
</section>

<section class="sec">
<h2>工程实践：组合优于继承，虚函数要花在刀刃上</h2>
<p>继承最脆弱的地方是<mark>脆弱的基类问题（fragile base class）</mark>：基类新增一个虚函数、改变一个成员的语义，所有派生类的行为都可能被悄悄改变。Core Guidelines C.120 到 C.129 的主线是：只在真有层次关系时用继承；接口继承与实现继承分开；抽象类通常不需要用户写构造函数；虚函数明确写 <code>override</code> 或 <code>final</code>。</p>
<p>组合（composition）把“是一个”换成“有一个”，让依赖方向更清晰，也避免派生类继承到不需要的接口。需要运行期替换行为时，可以持有一个接口指针；需要编译期多态时，用模板与 C++20 的 <code>concept</code> 约束；需要在封闭集合上分派时，<code>std::variant</code> 加 <code>std::visit</code> 常常比虚函数更合适：它把分派变成编译期可见的分支，容易做穷举检查，性能也可能更好，但具体快慢取决于场景，应该测量而不是假设。<code>std::function</code> 则适合“一个回调”的场景，不必为它建一个类层次。</p>
<div class="duo">
<div class="duo__col"><h4>适合继承</h4><p>存在稳定的 is-a 关系；派生类只扩展行为、不改变契约；需要运行期异构容器；接口由多方实现。此时用 public 继承加虚析构，接口类无状态。</p></div>
<div class="duo__col"><h4>更适合组合</h4><p>只是想复用实现；派生类会限制或破坏基类语义；层次超过两三层；需要独立演化。此时持有成员、注入接口，或用 variant、模板与类型擦除。</p></div>
</div>
<p>排障时按下面的顺序检查，通常能覆盖大多数“多态不生效”的问题。第一，确认调用的函数在基类里确实是 <code>virtual</code>，且签名完全一致，最好有 <code>override</code>。第二，确认对象没有被切片：参数是引用/指针吗，容器存的是指针吗。第三，确认没有在构造或析构期间调用。第四，确认没有发生名字隐藏，派生类的同名函数是否挡住了基类重载。第五，多继承场景下确认指针已经调整。第六，确认 RTTI 没被关闭，<code>dynamic_cast</code> 的失败分支是否被正确处理。</p>
<div class="callout callout--tip"><span class="callout__label">建议</span><div>默认把成员函数写成非虚；需要扩展点时才加 <code>virtual</code>，并写 <code>override</code>。对不会再被覆盖的实现标 <code>final</code>，给优化器去虚化机会。性能敏感处先测量间接调用的占比，再决定是否改成 variant 或模板，别凭“虚函数一定慢”做决策。</div></div>
</section>

<section class="sec">
<h2>自测与延伸阅读</h2>
<p>先自己回答，再展开对照。</p>
<details class="quiz"><summary>Q1 · 基类析构函数不是虚函数，delete 一个指向派生对象的 Base* 会发生什么？</summary><div class="quiz__a">行为未定义。典型实现只调用 <code>Base::~Base</code>，派生类的析构函数体不会执行，派生类成员也不会被销毁；如果派生类持有资源，就会泄漏。即使派生类没有额外成员，标准也不保证安全。修复：把基类析构写成 <code>public</code> 且 <code>virtual</code>；如果设计上绝不通过基类指针删除，就写成 <code>protected</code> 非虚，让误删在编译期失败。</div></details>
<details class="quiz"><summary>Q2 · 为什么在基类构造函数里调用虚函数，不会执行派生类的覆盖版本？</summary><div class="quiz__a">构造是逐层推进的：基类构造期间，派生部分还不存在，对象的动态类型被视为当前正在构造的类，vptr 指向基类虚表，所以分派到基类版本。基类构造完成后，派生类构造函数才把 vptr 改写为派生类虚表，之后虚调用才会到达派生类。析构时同理，只是方向相反。若此时调用的是尚未被覆盖的纯虚函数，行为未定义，典型实现会终止程序。</div></details>
<details class="quiz"><summary>Q3 · std::vector&lt;Base&gt; 里 push_back 一个 Derived 对象，为什么调用虚函数没有多态效果？</summary><div class="quiz__a">发生了对象切片。vector 的元素类型是 Base，只能容纳 Base 大小的对象；push_back 用 Base 的拷贝构造函数复制实参，只复制 Base 子对象，派生类成员和派生类 vptr 都被丢弃。容器里的元素动态类型就是 Base，虚调用自然进入 Base 版本。应改用 <code>std::vector&lt;std::unique_ptr&lt;Base&gt;&gt;</code>，或存 <code>std::reference_wrapper&lt;Base&gt;</code>（并保证被引用对象生命周期足够长）。</div></details>
<details class="quiz"><summary>Q4 · dynamic_cast&lt;Derived*&gt;(basePtr) 在什么情况下返回 nullptr？什么情况下根本编译不过？</summary><div class="quiz__a">返回 <code>nullptr</code> 表示运行期对象的动态类型不是 <code>Derived</code>（也不是其派生类），或者指针本身就是空指针。若 <code>Base</code> 不是多态类型（没有任何虚函数），向下转型或交叉转型的 <code>dynamic_cast</code> 在编译期就被拒绝；向上转型不要求多态。若编译时关闭了 RTTI（如 <code>-fno-rtti</code>），同样不可用。引用形式的失败不会返回空，而是抛出 <code>std::bad_cast</code>。</div></details>
<ul class="refs">
<li><b>Itanium C++ ABI</b> — Itanium C++ ABI Project, 持续维护。重点读 Virtual Table Layout 与 Construction/Destruction 两节；它描述 ABI 约定，不是 C++ 标准。</li>
<li><b>cppreference: virtual function</b> — cppreference.com。查证 override、final、纯虚函数与构造析构分派规则的第一站。</li>
<li><b>cppreference: dynamic_cast</b> — cppreference.com。说明多态类型要求、指针与引用两种失败形式、交叉转型与 RTTI 开关。</li>
<li><b>C++ Core Guidelines C.35–C.37、C.120–C.129</b> — Bjarne Stroustrup 与 Herb Sutter 主持。析构与类层次设计规则；C.128 要求虚函数只写 virtual、override、final 之一。</li>
<li><b>Inside the C++ Object Model</b> — Stanley B. Lippman, Addison-Wesley, 1996。对象模型与虚函数实现的经典讲解；书中实现早于现代 ABI，读布局需对照当前编译器。</li>
</ul>
</section>`
};
