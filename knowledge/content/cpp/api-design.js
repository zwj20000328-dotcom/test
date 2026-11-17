window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["api-design"] = {
  slug: "api-design",
  title: "API 设计与接口演进",
  subtitle: "好接口让错误难以写出来",
  level: 5,
  cluster: "工程化",
  tags: ["API 设计", "pimpl", "版本演进"],
  summary: "从参数传递、const 正确性、noexcept 契约到 pimpl 编译防火墙与弃用策略，用反例讲清哪些设计能让错误在编译期暴露，以及如何不破坏调用方地演进接口。",
  keyPoints: [
    "参数写法由三个语义问题决定：接口是否拥有、参数是否可空、接口是否修改，而不是个人偏好",
    "const 成员函数、noexcept、[[nodiscard]] 都是写进类型的承诺，承诺越准确，调用方越难误用",
    "强类型与具名结构体把参数换位、单位混用从运行期错误变成编译期错误",
    "pimpl 用一次间接寻址和一次堆分配换取编译防火墙与布局稳定，析构必须在实现完整可见处定义",
    "演进遵循先加、再标弃用、后删除；默认参数与新增重载都可能在重新编译后静默改变行为"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>接口是合同，不是函数清单</h2>
<p>调用方读不到你的 .cpp，只能看到头文件。头文件里的每个函数签名都是一条<mark>合同</mark>：谁拥有对象、参数能不能为空、失败怎么报告、调用之后对象处于什么状态。合同写不清楚，错误就会从编译期漏到运行期，修复成本也从“改一行”变成“改所有调用点”。</p>
<p>先看一个常见签名：<code>void draw(Window* w, bool visible, int color, int timeout_ms);</code>。四个参数都能悄悄换位，<code>draw(nullptr, true, 0x00FF00, 3000)</code> 照样编译。但 <code>w</code> 为空时函数该做什么没有约定；<code>visible</code> 和 <code>color</code> 都是“开关型”信息，调用方很容易把 <code>false</code> 与 <code>0</code> 混在一起；超时单位只活在参数名里，传秒也能通过。问题不是“不够优雅”，而是<mark>编译器无法替你检查</mark>。</p>
<p>把这类经验收敛成四条原则，每条都配一个反例：</p>
<ol>
<li><b>用类型表达约束。</b>宽度和高度都用 <code>int</code>，<code>resize(800, 600)</code> 与 <code>resize(600, 800)</code> 无法区分；换成 <code>Width</code>、<code>Height</code> 两个强类型后，换位直接编译失败。</li>
<li><b>默认安全，危险显式。</b>接受 <code>const char*</code> 的单参数构造函数若不标 <code>explicit</code>，<code>File f = 0;</code> 或把 <code>0</code> 传给形参为 <code>File</code> 的函数，都会隐式构造出“空指针文件”。标上 <code>explicit</code>（C++11 起也适用于转换运算符）能挡住这类隐式转换；但 <code>File f(0)</code> 属于直接初始化，仍会编译，空指针要在构造里自己拒绝。</li>
<li><b>把失败路径写进签名。</b>返回 <code>bool</code> 却丢掉错误原因，调用方只能猜；<code>std::optional</code>（C++17）表达“可能没有值”，<code>std::expected</code>（C++23）同时表达值与错误。</li>
<li><b>兼容性优先于局部整洁。</b>已发布的接口是被别人代码依赖的资产，重命名、改参数顺序、改默认值的代价由所有调用方承担。</li>
</ol>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>接口的目标不是“我写起来方便”，而是“调用方很难写错”。好接口让正确用法最短、错误用法编译不过或在构造期立刻失败，而不是等到线上才暴露。</div></div>
<p>后文都围绕一个判断标准：能否把错误从运行期提前到编译期或构造期。ABI 与链接层面的约束见《ABI、动态库与二进制兼容》。</p>
</section>

<section class="sec">
<h2>参数传递：先决定所有权，再决定写法</h2>
<p>参数写法之争常吵不出结果，是因为大家在比较语法，而没有先回答三个语义问题：接口<mark>拥有</mark>这个对象吗？参数<mark>可以为空</mark>吗？接口会<mark>修改</mark>它吗？答案确定后，写法基本只剩一种。</p>
<div class="formula">按值 T ＝ 我拿走一份副本（拥有）　·　const T&amp; ＝ 我只读、不保存　·　T&amp; ＝ 我修改、不保存<br>指针 T* ＝ 可空、不拥有　·　unique_ptr&lt;T&gt; ＝ 我接管所有权　·　span&lt;T&gt; / string_view ＝ 借用一段连续内存</div>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="参数传递决策树：根据接口是否保存对象、是否转移所有权、是否需要可空与修改，选择按值、const 引用、指针或 unique_ptr" font-family="inherit">
<defs>
<marker id="api-design-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--sv-line)"/></marker>
</defs>
<rect x="230" y="14" width="300" height="44" rx="8" fill="var(--sv-a)" stroke="var(--sv-a)"/>
<text x="380" y="41" text-anchor="middle" font-size="14" fill="var(--sv-ink)">调用结束后，接口还要用它吗？</text>
<rect x="55" y="96" width="250" height="44" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="180" y="123" text-anchor="middle" font-size="13" fill="var(--sv-ink)">会：保存或拥有</text>
<rect x="455" y="96" width="250" height="44" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="580" y="123" text-anchor="middle" font-size="13" fill="var(--sv-ink)">不会：仅本次调用</text>
<path d="M380 58 L180 96" fill="none" stroke="var(--sv-line)" marker-end="url(#api-design-arrow)"/>
<path d="M380 58 L580 96" fill="none" stroke="var(--sv-line)" marker-end="url(#api-design-arrow)"/>
<text x="262" y="82" font-size="12" fill="var(--sv-muted)">会</text>
<text x="492" y="82" font-size="12" fill="var(--sv-muted)">不会</text>
<rect x="15" y="178" width="200" height="44" rx="8" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="115" y="205" text-anchor="middle" font-size="12" fill="var(--sv-ink)">所有权要转移吗？</text>
<rect x="235" y="178" width="200" height="44" rx="8" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="335" y="205" text-anchor="middle" font-size="12" fill="var(--sv-ink)">只是借用吗？</text>
<rect x="420" y="178" width="160" height="44" rx="8" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="500" y="205" text-anchor="middle" font-size="12" fill="var(--sv-ink)">参数可空吗？</text>
<rect x="595" y="178" width="150" height="44" rx="8" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="670" y="205" text-anchor="middle" font-size="12" fill="var(--sv-ink)">会修改它吗？</text>
<path d="M180 140 L115 178" fill="none" stroke="var(--sv-line)" marker-end="url(#api-design-arrow)"/>
<path d="M180 140 L335 178" fill="none" stroke="var(--sv-line)" marker-end="url(#api-design-arrow)"/>
<path d="M580 140 L500 178" fill="none" stroke="var(--sv-line)" marker-end="url(#api-design-arrow)"/>
<path d="M580 140 L670 178" fill="none" stroke="var(--sv-line)" marker-end="url(#api-design-arrow)"/>
<text x="128" y="166" font-size="11" fill="var(--sv-muted)">转移</text>
<text x="272" y="166" font-size="11" fill="var(--sv-muted)">借用</text>
<text x="512" y="166" font-size="11" fill="var(--sv-muted)">可空</text>
<text x="640" y="166" font-size="11" fill="var(--sv-muted)">不可空</text>
<rect x="5" y="268" width="145" height="62" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="77" y="292" text-anchor="middle" font-size="12" fill="var(--sv-ink)">unique_ptr&lt;T&gt;</text>
<text x="77" y="312" text-anchor="middle" font-size="11" fill="var(--sv-muted)">按值，独占所有权</text>
<rect x="155" y="268" width="145" height="62" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="227" y="292" text-anchor="middle" font-size="12" fill="var(--sv-ink)">const T&amp; 或 T&amp;</text>
<text x="227" y="312" text-anchor="middle" font-size="11" fill="var(--sv-muted)">借用，不保存</text>
<rect x="305" y="268" width="145" height="62" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="377" y="292" text-anchor="middle" font-size="12" fill="var(--sv-ink)">T* / optional&lt;T&gt;</text>
<text x="377" y="312" text-anchor="middle" font-size="11" fill="var(--sv-muted)">可空，不拥有</text>
<rect x="455" y="268" width="145" height="62" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="527" y="292" text-anchor="middle" font-size="12" fill="var(--sv-ink)">T&amp;</text>
<text x="527" y="312" text-anchor="middle" font-size="11" fill="var(--sv-muted)">可修改，不保存</text>
<rect x="605" y="268" width="145" height="62" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="677" y="292" text-anchor="middle" font-size="12" fill="var(--sv-ink)">按值 / const T&amp;</text>
<text x="677" y="312" text-anchor="middle" font-size="11" fill="var(--sv-muted)">小对象按值，大对象引用</text>
<path d="M115 222 L77 268" fill="none" stroke="var(--sv-line)" marker-end="url(#api-design-arrow)"/>
<path d="M335 222 L227 268" fill="none" stroke="var(--sv-line)" marker-end="url(#api-design-arrow)"/>
<path d="M500 222 L377 268" fill="none" stroke="var(--sv-line)" marker-end="url(#api-design-arrow)"/>
<path d="M670 222 L527 268" fill="none" stroke="var(--sv-line)" marker-end="url(#api-design-arrow)"/>
<path d="M670 222 L677 268" fill="none" stroke="var(--sv-line)" marker-end="url(#api-design-arrow)"/>
</svg>
<figcaption>图 1 · 参数传递决策树：先回答所有权与可空性，再决定写法</figcaption>
</figure>
<p>接口要把对象存进成员，就必须明确所有权：独占且可转移时按值收 <code>std::unique_ptr&lt;T&gt;</code>（C++11）；只是借用，就用 <code>const T&amp;</code> 或 <code>T&amp;</code>，并写清“调用方保证对象活得更久”。只在本次调用内使用、需要表达“可以没有”时用 <code>T*</code>；若想保留值语义，可用 <code>std::optional&lt;T&gt;</code>（大对象传 <code>const std::optional&lt;T&gt;&amp;</code>，避免按值拷贝），否则用引用。只读的大对象用 <code>const T&amp;</code>，内置类型和小结构体（经验上两个机器字以内）按值，避免间接寻址。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>写法</th><th>表达的所有权/可空性</th><th>拷贝成本</th><th>典型误用</th></tr></thead>
<tbody>
<tr><td><code>T</code></td><td>拥有副本，不可空</td><td>一次拷贝（右值可移动）</td><td>大对象按值传，白白拷贝</td></tr>
<tr><td><code>const T&amp;</code></td><td>只读借用，不可空</td><td>无</td><td>把引用存进成员，构造后悬垂</td></tr>
<tr><td><code>T&amp;</code></td><td>可修改借用，不可空</td><td>无</td><td>调用方看不出会被修改</td></tr>
<tr><td><code>T*</code></td><td>可空，不拥有</td><td>无</td><td>用指针暗示所有权，调用方 delete</td></tr>
<tr><td><code>unique_ptr&lt;T&gt;</code></td><td>独占所有权，可空</td><td>一次移动</td><td>参数声明为 const 引用，导致无法转移</td></tr>
<tr><td><code>span&lt;T&gt;</code> / <code>string_view</code></td><td>借用连续内存，不拥有</td><td>无</td><td>保存视图，底层缓冲区已释放</td></tr>
</tbody>
</table></div>
<p>处理 sink 参数常用“按值接收再移动”（C++11）：<code>void set_name(std::string name) { name_ = std::move(name); }</code>。传右值通常先移动构造形参，再移入成员；若实参是纯右值，C++17 的保证省略会让形参直接由该纯右值初始化，第一次移动也可省去。传左值则是一次拷贝加一次移动。相比 <code>const std::string&amp;</code> 版本，左值多一次移动，右值则用移动替代拷贝（纯右值还能省掉第一次移动）。对堆上缓冲区，移动通常只是指针交换；但 <code>std::string</code> 的 SSO 短串在多数实现里会把内联缓冲一起复制，成本仍低于一次堆分配，不能一概说成“零成本”。</p>
<p>最容易埋雷的是<mark>把引用或视图存起来</mark>。下面两个类都能编译，但第二个在实参是临时对象时，构造函数返回后就悬垂（示意）：</p>
<pre class="code" data-lang="cpp"><code>#include &lt;string&gt;

class Label {
public:
    explicit Label(const std::string&amp; text) : text_(text) {}   // 拷贝，安全
private:
    std::string text_;
};

class BadLabel {
public:
    explicit BadLabel(const std::string&amp; text) : text_(text) {} // 成员是引用
private:
    const std::string&amp; text_;   // 构造函数结束后 text 可能已销毁
};</code></pre>
<p><code>std::string_view</code>（C++17）有同样的问题：它不拥有字符，只保存指针和长度。作为“只读、不保存”的参数很合适；一旦存进成员，就必须由调用方保证底层字符串的生命周期。值类别的规则见《值类别与完美转发》。</p>
</section>

<section class="sec">
<h2>const 正确性与 noexcept：把承诺写进类型</h2>
<p><b>const 正确性</b>（const correctness）不是装饰，而是让“只读”成为类型系统可检查的属性。成员函数末尾的 <code>const</code> 表示“调用不改变对象的可观察状态”，于是 <code>const Widget&amp;</code> 才能调用它。反例很常见：<code>int size() { return data_.size(); }</code> 忘了写 <code>const</code>，结果 <code>const Widget w;</code> 上调用 <code>w.size()</code> 直接编译失败，而这个错误会一路传染给所有持有 const 引用的函数。</p>
<p>标准库容器同时提供 <code>begin()</code> 与 <code>begin() const</code>，让 <code>const std::vector&lt;T&gt;&amp;</code> 上的范围 for 无法得到可写的 <code>T&amp;</code>。自定义类要获得同样待遇，就得成对提供重载；常见做法是非 const 版本调用 const 版本再 <code>const_cast</code> 掉常量性，避免逻辑重复。</p>
<p>逻辑常量性允许内部缓存：成员标 <code>mutable</code> 后，const 成员函数可以更新缓存。但 <code>mutable</code> 不是线程安全的许可证，多线程同时调用时缓存写入仍需同步；“const 成员函数天然线程安全”是常见误解。</p>
<p>把 const 加在返回值上也是反例：<code>const std::string name() const;</code>。C++17 的保证省略（guaranteed elision）让 <code>std::string s = w.name();</code> 直接构造；但 <code>s = w.name();</code> 需要移动赋值，const 右值只能匹配拷贝赋值，于是多了一次深拷贝。返回值加 const 通常弊大于利。</p>
<p><b>noexcept</b>（C++11）是异常规格（exception specification）的一部分：它承诺函数不会让异常逃逸。承诺被违反时，标准规定调用 <code>std::terminate</code>；异常不会在调用方被捕获。是否在终止前展开栈帧由实现决定，标准不保证析构一定执行，所以不能把 noexcept 当成“安全清理”的手段。它首先是一条<mark>契约</mark>，其次才影响优化和容器行为。</p>
<div class="callout callout--warn"><span class="callout__label">警告</span><div>给可能抛出的函数标 <code>noexcept</code> 通常不会让函数体变快，却会把“可以处理的异常”变成“进程终止”。分配内存、调用未知回调、解析外部输入的函数都不该无条件标 noexcept。</div></div>
<p>该标的地方集中：移动构造、移动赋值、<code>swap</code>、析构函数，以及确实不分配、不回调的访问器。析构函数从 C++11 起默认 <code>noexcept(true)</code>（除非某个成员或基类的析构可能抛出），一旦抛出就会终止进程，这也是“析构函数不要抛异常”的规范来源。模板代码更稳妥的写法是条件 noexcept（C++17 的变量模板，需 <code>&lt;type_traits&gt;</code> 与 <code>&lt;utility&gt;</code>）：</p>
<pre class="code" data-lang="cpp"><code>#include &lt;type_traits&gt;
#include &lt;utility&gt;

namespace demo {
template &lt;class T&gt;
void swap(T&amp; a, T&amp; b)
    noexcept(std::is_nothrow_move_constructible_v&lt;T&gt; &amp;&amp;
             std::is_nothrow_move_assignable_v&lt;T&gt;)
{
    T tmp(std::move(a));
    a = std::move(b);
    b = std::move(tmp);
}
}  // namespace demo</code></pre>
<p>为什么值得较真？因为标准库会读取这个属性。<code>std::vector</code> 扩容时要把旧元素搬到新缓冲区，若移动构造可能抛异常，搬到一半失败就无法恢复原状，于是典型实现按 <code>std::move_if_noexcept</code> 的策略：移动构造是 noexcept 就移动，否则优先退化为拷贝。注意条件是复合的：只有当 T 可拷贝构造时才会退化为拷贝；若 T 不可拷贝，<code>move_if_noexcept</code> 仍返回右值引用，此时扩容只能给出基本异常保证，失败后容器处于有效但未指定的状态。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="vector 扩容时根据元素移动构造是否 noexcept，选择移动或复制元素以维持强异常保证" font-family="inherit">
<defs>
<marker id="api-design-arrow2" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--sv-line)"/></marker>
</defs>
<text x="20" y="28" font-size="13" fill="var(--sv-ink)">push_back 发现 capacity 已满，触发扩容</text>
<rect x="40" y="60" width="300" height="70" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<rect x="40" y="60" width="100" height="70" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<rect x="140" y="60" width="100" height="70" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<rect x="240" y="60" width="100" height="70" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="90" y="101" text-anchor="middle" font-size="13" fill="var(--sv-ink)">a0</text>
<text x="190" y="101" text-anchor="middle" font-size="13" fill="var(--sv-ink)">a1</text>
<text x="290" y="101" text-anchor="middle" font-size="13" fill="var(--sv-ink)">a2</text>
<text x="40" y="154" font-size="12" fill="var(--sv-muted)">旧缓冲区（容量 3）</text>
<rect x="420" y="60" width="300" height="70" fill="var(--sv-bg)" stroke="var(--sv-line)" stroke-dasharray="6 4"/>
<text x="570" y="101" text-anchor="middle" font-size="12" fill="var(--sv-muted)">新缓冲区（容量 6）</text>
<text x="570" y="154" text-anchor="middle" font-size="12" fill="var(--sv-muted)">搬移方式取决于 T</text>
<path d="M340 95 L420 95" fill="none" stroke="var(--sv-line)" marker-end="url(#api-design-arrow2)"/>
<text x="380" y="85" text-anchor="middle" font-size="11" fill="var(--sv-muted)">搬移</text>
<path d="M190 130 C190 190, 235 220, 262 243" fill="none" stroke="var(--sv-line)" marker-end="url(#api-design-arrow2)"/>
<polygon points="380,190 500,245 380,300 260,245" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="380" y="240" text-anchor="middle" font-size="13" fill="var(--sv-ink)">移动构造是</text>
<text x="380" y="260" text-anchor="middle" font-size="13" fill="var(--sv-ink)">noexcept 吗？</text>
<path d="M380 300 L190 322" fill="none" stroke="var(--sv-line)" marker-end="url(#api-design-arrow2)"/>
<path d="M380 300 L570 322" fill="none" stroke="var(--sv-line)" marker-end="url(#api-design-arrow2)"/>
<text x="268" y="316" font-size="12" fill="var(--sv-muted)">是</text>
<text x="486" y="316" font-size="12" fill="var(--sv-muted)">否</text>
<rect x="30" y="326" width="320" height="44" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="190" y="353" text-anchor="middle" font-size="12" fill="var(--sv-ink)">移动元素：调用 T 的移动构造，通常更廉价</text>
<rect x="410" y="326" width="320" height="44" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="570" y="353" text-anchor="middle" font-size="12" fill="var(--sv-ink)">复制元素：可拷贝时维持强异常保证</text>
<text x="20" y="306" font-size="11" fill="var(--sv-muted)">典型实现按 move_if_noexcept 选择</text>
</svg>
<figcaption>图 2 · noexcept 移动构造如何决定 vector 扩容是移动还是复制（T 不可拷贝时仍移动，只有基本保证）</figcaption>
</figure>
<p>结果很实际：一个忘了标 noexcept 的移动构造函数，可能让可拷贝的 <code>vector&lt;T&gt;</code> 每次扩容都把全部元素逐个拷贝一遍。这类损失不报错，只体现在压测曲线上。</p>
</section>

<section class="sec">
<h2>类型安全与 RAII 风格接口</h2>
<p>强类型（strong type）的核心是：不要用同一个类型表示语义不同的量。反例是 <code>void draw_rect(int x, int y, int w, int h);</code>，调用处 <code>draw_rect(10, 20, 100, 50)</code> 与 <code>draw_rect(10, 20, 50, 100)</code> 都能编译，参数换位只能靠人眼发现。<code>enum class</code>（C++11）消除枚举到整数的隐式转换；<code>std::chrono</code> 的 <code>duration</code> 对整数 rep 只在不丢失精度时才允许隐式换算（<code>seconds</code> 到 <code>milliseconds</code> 可以），会截断的方向（<code>milliseconds</code> 到 <code>seconds</code>）必须写 <code>duration_cast</code>，否则编译失败。</p>
<pre class="code" data-lang="cpp"><code>struct Meters  { double value; };
struct Seconds { double value; };

Meters operator+(Meters a, Meters b) { return {a.value + b.value}; }

// Meters m = Seconds{3.0};         // 编译错误：没有隐式转换
// Seconds s = Meters{3.0} + 1.0;   // 编译错误：未定义该运算</code></pre>
<p>参数一多，具名结构体比长参数列表可靠。C++20 的指定初始化器（designated initializers）让调用处自带参数名，且顺序必须与声明一致：</p>
<pre class="code" data-lang="cpp"><code>struct Options {
    int width = 640;
    int height = 480;
    bool vsync = true;
};

void create_window(const Options&amp; opt) { (void)opt; }  // 实际实现略

create_window({.width = 1280, .height = 720});  // C++20；顺序不能颠倒
// create_window({.height = 720, .width = 1280}); // 编译错误：乱序</code></pre>
<p><b>RAII 风格接口</b>指接口自己管理资源生命周期，而不是把 init/cleanup 推给调用方。反例是两段式初始化：<code>db_open(); ... db_close();</code> 之间任何一个提前 return 或异常都会漏掉关闭。改成工厂函数返回持有资源的对象（<code>std::unique_ptr</code> 或自定义 RAII 类型），清理写进析构函数，调用方就不可能忘记。构造完成即满足类不变式（class invariant），失败则抛异常或返回空对象。</p>
<p>错误报告也能用类型表达。<code>bool</code> 只说明成败，丢掉原因；<code>int</code> 错误码要调用方查表；<code>std::optional&lt;T&gt;</code> 表达“可能没有值”；<code>std::expected&lt;T, E&gt;</code>（C++23）同时给出值与错误。标 <code>[[nodiscard]]</code>（C++17）可以提醒调用方不要忽略返回值，例如 <code>[[nodiscard]] bool write(const Buffer&amp;);</code>，配合 <code>-Werror</code> 能把忽略升级为编译错误。</p>
<div class="callout callout--tip"><span class="callout__label">技巧</span><div>必填参数放进构造函数，可选参数收进具名结构体，互斥选项用不同的重载或 <code>std::variant</code>（C++17）表达。这样“少传一个必填项”是编译错误，而不是运行期异常。</div></div>
<p>连续内存的只读视图优先用 <code>std::span&lt;const T&gt;</code>（C++20）或 <code>std::string_view</code>，而不是 <code>(const T*, std::size_t)</code> 两个参数；后者容易只改其中一个，而且长度单位是字节还是元素，只能靠注释说明。</p>
</section>

<section class="sec">
<h2>pimpl 与编译防火墙</h2>
<p><b>pimpl</b>（pointer to implementation，又称编译防火墙 compile firewall、不透明指针 opaque pointer）把实现细节从公开头文件挪进 .cpp：头文件只留一个指向实现类的指针。动机有三个：减少头文件包含、缩短增量编译、在保持对象大小不变的前提下修改实现（对二进制兼容尤其重要）。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="pimpl 布局：公开头文件中的 Widget 只含一个 unique_ptr，实现 Impl 定义在 cpp 中并位于堆上" font-family="inherit">
<defs>
<marker id="api-design-arrow3" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--sv-line)"/></marker>
<marker id="api-design-arrow3b" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--sv-b)"/></marker>
</defs>
<rect x="12" y="28" width="350" height="170" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="28" y="52" font-size="14" fill="var(--sv-ink)">widget.h（公开头文件）</text>
<rect x="30" y="70" width="140" height="56" rx="6" fill="var(--sv-a)" stroke="var(--sv-a)"/>
<text x="100" y="94" text-anchor="middle" font-size="13" fill="var(--sv-ink)">class Widget</text>
<text x="100" y="113" text-anchor="middle" font-size="11" fill="var(--sv-ink)">一个指针大小</text>
<rect x="200" y="70" width="145" height="56" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="272" y="94" text-anchor="middle" font-size="12" fill="var(--sv-ink)">unique_ptr&lt;Impl&gt;</text>
<text x="272" y="113" text-anchor="middle" font-size="11" fill="var(--sv-muted)">x86-64 典型 8 字节</text>
<path d="M170 98 L200 98" fill="none" stroke="var(--sv-line)" marker-end="url(#api-design-arrow3)"/>
<text x="28" y="155" font-size="12" fill="var(--sv-muted)">只包含 &lt;memory&gt;，不暴露 vector 等实现头</text>
<text x="28" y="177" font-size="12" fill="var(--sv-muted)">改实现只需重编 widget.cpp</text>
<rect x="400" y="28" width="348" height="170" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="416" y="52" font-size="14" fill="var(--sv-ink)">widget.cpp（实现）</text>
<text x="416" y="82" font-size="12" fill="var(--sv-ink)">struct Widget::Impl {</text>
<text x="432" y="104" font-size="12" fill="var(--sv-ink)">std::vector&lt;int&gt; data;</text>
<text x="432" y="126" font-size="12" fill="var(--sv-ink)">std::mutex mu;</text>
<text x="416" y="148" font-size="12" fill="var(--sv-ink)">};</text>
<text x="416" y="178" font-size="12" fill="var(--sv-muted)">析构、拷贝、移动都在此定义</text>
<rect x="430" y="262" width="300" height="84" rx="8" fill="var(--sv-b)" stroke="var(--sv-b)"/>
<text x="580" y="288" text-anchor="middle" font-size="13" fill="var(--sv-ink)">堆上的 Impl 实例</text>
<text x="580" y="310" text-anchor="middle" font-size="11" fill="var(--sv-ink)">vector 缓冲、互斥量等真实成员</text>
<text x="580" y="330" text-anchor="middle" font-size="11" fill="var(--sv-ink)">生命周期跟随 Widget</text>
<path d="M272 126 C272 214, 420 196, 500 262" fill="none" stroke="var(--sv-b)" stroke-dasharray="6 4" marker-end="url(#api-design-arrow3b)"/>
<text x="310" y="232" font-size="11" fill="var(--sv-muted)">一次间接寻址</text>
<path d="M574 198 L574 262" fill="none" stroke="var(--sv-line)" marker-end="url(#api-design-arrow3)"/>
<text x="590" y="234" font-size="11" fill="var(--sv-muted)">定义</text>
<text x="14" y="370" font-size="11" fill="var(--sv-muted)">对象大小是一个指针，而不是 Impl 的大小；跨模块只暴露不完整类型。</text>
</svg>
<figcaption>图 3 · pimpl 布局与编译防火墙：头文件只依赖前置声明，实现藏在 cpp 与堆上</figcaption>
</figure>
<p>代价是：每次访问多一次间接寻址，每个对象多一次堆分配，调试多一层跳转，拷贝、移动、析构都要显式处理。<code>std::unique_ptr&lt;Impl&gt;</code> 在销毁时会对其持有的指针执行 <code>delete</code>，而 <code>default_delete</code> 要求 <code>Impl</code> 在销毁点是完整类型，否则删除表达式无法成立；各家标准库通常用 <code>static_assert</code> 提前报错。因此析构必须在 <code>Impl</code> 完整可见的 .cpp 中定义，这不是编译器怪癖。下面是一个可编译的最小完整示例（C++20 口径，g++ 与 clang++ 可直接编译）：</p>
<pre class="code" data-lang="cpp"><code>// widget.h
#include &lt;memory&gt;

class Widget {
public:
    explicit Widget(int size);
    ~Widget();

    Widget(const Widget&amp; other);
    Widget&amp; operator=(const Widget&amp; other);
    Widget(Widget&amp;&amp; other) noexcept;
    Widget&amp; operator=(Widget&amp;&amp; other) noexcept;

    int size() const;

private:
    struct Impl;
    std::unique_ptr&lt;Impl&gt; impl_;
};</code></pre>
<pre class="code" data-lang="cpp"><code>// widget.cpp
#include "widget.h"

#include &lt;cassert&gt;
#include &lt;cstddef&gt;
#include &lt;utility&gt;
#include &lt;vector&gt;

struct Widget::Impl {
    explicit Impl(int n) : data(static_cast&lt;std::size_t&gt;(n)) {}
    std::vector&lt;int&gt; data;
};

Widget::Widget(int size) : impl_(std::make_unique&lt;Impl&gt;(size)) {}
Widget::~Widget() = default;              // Impl 在此完整可见

Widget::Widget(const Widget&amp; other)
    : impl_(other.impl_ ? std::make_unique&lt;Impl&gt;(*other.impl_) : nullptr) {}

Widget&amp; Widget::operator=(const Widget&amp; other) {
    if (this != &amp;other) {
        if (other.impl_) {
            impl_ = std::make_unique&lt;Impl&gt;(*other.impl_);
        } else {
            impl_.reset();
        }
    }
    return *this;
}

Widget::Widget(Widget&amp;&amp;) noexcept = default;
Widget&amp; Widget::operator=(Widget&amp;&amp;) noexcept = default;

int Widget::size() const {
    return impl_ ? static_cast&lt;int&gt;(impl_-&gt;data.size()) : 0;
}

int main() {
    Widget a(3);
    Widget b = a;
    assert(b.size() == 3);
    Widget c = std::move(a);
    assert(c.size() == 3 &amp;&amp; a.size() == 0);
}</code></pre>
<p>几个细节：<code>Widget</code> 的大小在常见实现上就是一个指针（<code>unique_ptr</code> 的空删除器不占空间），x86-64 System V ABI 上典型 8 字节，32 位目标典型 4 字节；标准并不保证这一点。移动后 <code>impl_</code> 为空（<code>unique_ptr</code> 移动保证源指针为 null），所以 <code>size()</code> 要判空。拷贝赋值选择重新分配而不是复用旧实现，是为了异常安全：<code>make_unique</code> 成功后再替换，失败时原对象不变。</p>
<p>pimpl 不是唯一方案。纯虚接口加工厂函数能隐藏实现，但引入虚调用和另一层分配；C++20 Modules 能减少头文件解析，却不改变布局与 ABI。选择取决于你要解决编译时间、二进制兼容，还是两者。</p>
<div class="callout callout--warn"><span class="callout__label">警告</span><div>pimpl 把“对象在栈上”变成“对象加一次堆分配”。对每秒创建百万次的小对象，这个成本可能超过编译时间收益；先用基准测试量化，再决定是否引入。</div></div>
</section>

<section class="sec">
<h2>fluent API 的取舍与接口演进</h2>
<p><b>fluent API</b>（链式接口）让每个配置函数返回对象自身引用，调用处读起来像一句英文：<code>query.where("age &gt; 18").order_by("name").limit(10).to_sql()</code>。标准库的流插入 <code>operator&lt;&lt;</code> 返回 <code>std::ostream&amp;</code>，是最成功的 fluent 设计。</p>
<p>代价常被忽略。链式调用不约束步骤顺序，<code>limit(10).where(...)</code> 反过来写也能编译；若语义有先后，只能运行期检查或引入类型状态机（typestate），后者对普通业务往往过度设计。必填项缺失只能到 <code>build()</code> 才发现。每一步都可能失败时，错误处理难塞进表达式。调试器里一长串调用也不如中间变量直观。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;string&gt;

// 示意：必填项放构造函数，可选步骤才链式
class Query {
public:
    explicit Query(std::string table);           // 必填：表名
    Query&amp; where(std::string cond);
    Query&amp; order_by(std::string column);
    Query&amp; limit(int n);
    std::string to_sql() const;
};</code></pre>
<p>结论：<mark>必填项用构造函数强制，可选配置才用链式</mark>；终止操作（<code>build</code>、<code>to_sql</code>）要么可重复调用且无副作用，要么在调用后把对象置为无效状态并写进文档。</p>
<p>接口演进（API evolution）比初始设计更难，约束来自已写好的调用方代码。先区分三种兼容：<b>源码兼容</b>指旧代码能重新编译；<b>二进制兼容</b>（ABI 兼容）指旧目标文件不重编也能链接运行；<b>语义兼容</b>指行为不变。三者可以独立被破坏。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="兼容演进路径：新增并存、标注弃用、迁移窗口、下个大版本移除，源码兼容持续到删除前" font-family="inherit">
<defs>
<marker id="api-design-arrow4" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--sv-line)"/></marker>
</defs>
<text x="20" y="26" font-size="12" fill="var(--sv-ink)">源码兼容</text>
<rect x="90" y="14" width="470" height="14" rx="4" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="575" y="26" font-size="11" fill="var(--sv-muted)">持续到删除之前</text>
<text x="20" y="50" font-size="12" fill="var(--sv-ink)">ABI 兼容</text>
<rect x="90" y="38" width="650" height="14" rx="4" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="20" y="76" font-size="11" fill="var(--sv-muted)">布局不变时可维持；新增虚函数、数据成员通常会破坏</text>
<rect x="20" y="104" width="160" height="58" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="100" y="128" text-anchor="middle" font-size="13" fill="var(--sv-ink)">① 新增并存</text>
<text x="100" y="148" text-anchor="middle" font-size="11" fill="var(--sv-muted)">新函数/新重载</text>
<rect x="205" y="104" width="160" height="58" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="285" y="128" text-anchor="middle" font-size="13" fill="var(--sv-ink)">② 标注弃用</text>
<text x="285" y="148" text-anchor="middle" font-size="11" fill="var(--sv-muted)">deprecated 警告</text>
<rect x="390" y="104" width="160" height="58" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="470" y="128" text-anchor="middle" font-size="13" fill="var(--sv-ink)">③ 迁移窗口</text>
<text x="470" y="148" text-anchor="middle" font-size="11" fill="var(--sv-muted)">示例与调用方切换</text>
<rect x="575" y="104" width="165" height="58" rx="8" fill="var(--sv-b)" stroke="var(--sv-b)"/>
<text x="657" y="128" text-anchor="middle" font-size="13" fill="var(--sv-ink)">④ 大版本移除</text>
<text x="657" y="148" text-anchor="middle" font-size="11" fill="var(--sv-ink)">不静默改语义</text>
<path d="M180 133 L205 133" fill="none" stroke="var(--sv-line)" marker-end="url(#api-design-arrow4)"/>
<path d="M365 133 L390 133" fill="none" stroke="var(--sv-line)" marker-end="url(#api-design-arrow4)"/>
<path d="M550 133 L575 133" fill="none" stroke="var(--sv-line)" marker-end="url(#api-design-arrow4)"/>
<text x="20" y="198" font-size="12" fill="var(--sv-muted)">旧接口行为保持完全一致</text>
<text x="205" y="198" font-size="12" fill="var(--sv-muted)">附替代方案与迁移说明</text>
<text x="390" y="198" font-size="12" fill="var(--sv-muted)">至少跨一个发布周期</text>
<text x="575" y="198" font-size="12" fill="var(--sv-muted)">主版本号递增</text>
<path d="M20 240 L740 240" fill="none" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#api-design-arrow4)"/>
<text x="20" y="228" font-size="12" fill="var(--sv-ink)">时间</text>
<rect x="20" y="284" width="720" height="70" rx="8" fill="var(--sv-bg)" stroke="var(--sv-b)"/>
<text x="38" y="311" font-size="12" fill="var(--sv-ink)">反例：补丁版本直接删函数；保留签名却改变行为；用改默认参数代替新增函数。</text>
<text x="38" y="335" font-size="12" fill="var(--sv-ink)">这些做法让调用方在重新编译或替换动态库时才炸，排查成本最高。</text>
</svg>
<figcaption>图 4 · 兼容演进路径：先加、再标弃用、给迁移窗口、最后在大版本移除</figcaption>
</figure>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>变更</th><th>源码兼容</th><th>二进制兼容</th><th>说明</th></tr></thead>
<tbody>
<tr><td>新增非虚成员函数</td><td>是</td><td>通常是</td><td>新增符号；不调用它的旧目标文件无需重编</td></tr>
<tr><td>新增虚函数</td><td>是</td><td>通常否</td><td>vtable 布局变化，取决于 ABI</td></tr>
<tr><td>新增数据成员</td><td>是</td><td>否</td><td><code>sizeof</code> 与对象布局改变</td></tr>
<tr><td>新增重载</td><td>通常是</td><td>是</td><td>可能改变既有调用的重载决议</td></tr>
<tr><td>修改默认参数值</td><td>是</td><td>是</td><td>重编后语义静默变化</td></tr>
<tr><td>删除公开函数</td><td>否</td><td>否</td><td>先弃用再删除</td></tr>
<tr><td>修改内联函数体</td><td>是</td><td>是（但须全部重编）</td><td>符号不变；未全部重编会导致各目标文件的内联副本不一致，违反 ODR</td></tr>
</tbody>
</table></div>
<p>两个高频陷阱。其一，<mark>默认参数属于调用点</mark>，不属于函数类型：改默认值不破坏编译，却会让重编的调用方静默改变行为；默认参数也不参与虚函数分派，派生类改默认值只会让结果依赖静态类型。其二，<mark>新增重载可能改变重载决议</mark>：已有 <code>void log(const std::string&amp;)</code> 时再加 <code>void log(std::string_view)</code>，<code>log("x")</code> 就从“构造 std::string”变成两个用户定义转换互相竞争，通常直接报二义性；即使能选出重载，也可能悄悄换了一条转换路径。</p>
<p>弃用的正确姿势是三步：先新增替代接口并保持旧接口行为一致；再用 <code>[[deprecated("use parse_v2")]]</code>（C++14）给出警告与迁移指引；至少跨一个发布周期再删除。不要在补丁版本删函数，也不要“保留名字、改掉语义”——后者更难排查。ABI 版本化手段（inline namespace、符号版本脚本）依赖平台，细节见《ABI、动态库与二进制兼容》。</p>
<div class="formula">演进顺序：先加（新接口并存）→ 再标（deprecated 警告）→ 后删（下个大版本）<br>禁止：静默改语义 · 补丁版本删符号 · 用默认参数变化代替新函数</div>
</section>

<section class="sec">
<h2>文档、示例与 Core Guidelines</h2>
<p>接口文档不是把函数名翻译一遍。每个公开函数至少写清六件事：前置条件（precondition）、后置条件（postcondition）、异常保证（无异常/强保证/基本保证）、线程安全级别、复杂度、参数的所有权与生命周期。反例是注释只写“初始化”——调用方仍不知道失败时对象处于什么状态、能否重试。</p>
<p>示例要能编译。把文档里的片段抽成独立文件，在 CI 里用目标标准编译（必要时加 <code>static_assert</code>），否则示例会随接口演进而腐烂。实用做法是让示例同时充当冒烟测试：能编译，也能在 <code>main</code> 里断言关键行为。</p>
<p>Core Guidelines 与本篇直接相关的条款：</p>
<ul>
<li><b>I.1</b> 让接口显式：不要在注释里写约束，用类型和函数名表达。</li>
<li><b>I.4</b> 让接口精确且强类型：避免 <code>int</code> 混用，避免 <code>void*</code>。</li>
<li><b>I.11</b> 不要用裸指针或引用转移所有权：所有权用 <code>unique_ptr</code> 或 <code>shared_ptr</code> 表达。</li>
<li><b>I.12</b> 声明“不能为空”的指针为 <code>not_null</code>（GSL），让约束可检查。</li>
<li><b>I.13</b> 不要把数组当单个指针传递：用 <code>span</code> 保留长度信息。</li>
<li><b>F.16</b> 只读参数：廉价拷贝的类型按值，其余按 <code>const</code> 引用。</li>
<li><b>C.35</b> 基类析构函数要么 public 且 virtual，要么 protected 且非 virtual。</li>
</ul>
<p>排障时优先怀疑：头文件里的 <code>inline</code> 实现改动后部分目标文件没重编，出现 ODR 违规式行为；pimpl 对象移动后在旧对象上调用成员；可能抛出的函数标了 noexcept，线上直接 terminate；给已有接口加默认参数，重编模块与旧模块行为不一致。共同点是<mark>编译不报错</mark>，只能靠构建系统与测试兜底。</p>
<div class="callout callout--tip"><span class="callout__label">技巧</span><div>评审接口只问四个问题：错误用法能不能编译？失败路径在签名里吗？调用方需要读实现才能正确使用吗？删除这个函数会影响多少人？四问都能答清楚，接口基本就立住了。</div></div>
</section>

<section class="sec">
<h2>自测与延伸阅读</h2>
<details class="quiz"><summary>Q1 · 只读的大对象参数，为什么优先 const T&amp; 而不是 T？</summary><div class="quiz__a">按值通常要拷贝整个对象，成本与对象大小正相关；<code>const T&amp;</code> 不产生对象拷贝，且保证不修改。例外是内置类型和小结构体：间接寻址成本可能超过拷贝，此时按值更好，这正是 F.16 的建议。注意它不表达“可以为空”，也不允许接口保存引用。</div></details>
<details class="quiz"><summary>Q2 · 为什么 pimpl 类的析构函数通常要写在 .cpp 里？</summary><div class="quiz__a">因为成员是 <code>std::unique_ptr&lt;Impl&gt;</code>，销毁它需要对 <code>Impl*</code> 执行 <code>delete</code>，而删除器要求 <code>Impl</code> 在销毁点是完整类型。若析构函数在头文件里内联生成，编译器在只看到前置声明的位置就要实例化删除器，不满足完整类型要求，多数实现会用 <code>static_assert</code> 报错。把析构以及拷贝、移动的定义放到 <code>Impl</code> 完整可见的 .cpp 才能通过编译。</div></details>
<details class="quiz"><summary>Q3 · 移动构造函数没有标 noexcept，会对 std::vector 产生什么影响？</summary><div class="quiz__a">典型实现扩容时按 <code>std::move_if_noexcept</code> 选择：移动构造不保证不抛且 T 可拷贝时，就退化为拷贝，以维持强异常保证；T 不可拷贝时仍只能移动，失败后仅保证基本异常。于是本可 O(1) 的指针交换变成逐个拷贝，性能显著下降且不报错。修复方式是给移动构造和移动赋值标 <code>noexcept</code>，前提是它们确实不会抛。</div></details>
<details class="quiz"><summary>Q4 · 给已发布的类新增一个虚函数，为什么可能破坏二进制兼容？</summary><div class="quiz__a">虚函数调用依赖虚函数表（vtable），而 vtable 的布局是实现细节，标准不保证。在常见 ABI 下，若类原本没有虚函数，新增虚函数会引入 vptr，直接改变对象大小与布局，破坏是确定的。若类已有虚函数，多数 ABI 把新增项追加到表尾：只调用基类既有虚函数的旧代码通常仍能工作；但若该类被外部继承，派生类 vtable 中原本位于后面的槽位会整体后移，旧目标文件按旧索引就可能调错函数。因此“是否破坏”取决于 ABI、类是否已有虚函数以及是否被继承，不能一概而论；稳妥做法是新增非虚接口，或用 pimpl 把虚函数藏进实现。</div></details>
<p>继续往下读，建议按这条线：先看《ABI、动态库与二进制兼容》理解二进制约束，再看《C++20 Modules》了解编译模型的另一种解法；异常保证的细节在《异常、错误处理与异常安全》展开。</p>
<ul class="refs">
<li><b>C++ Core Guidelines</b> — Bjarne Stroustrup 与 Herb Sutter，持续更新。条款 I.1、I.4、I.11-I.13、F.16、C.35 的权威出处。</li>
<li><b>《Effective C++（第三版）》</b> — Scott Meyers, 2005。条款 18-25 讨论接口设计与声明。</li>
<li><b>《API Design for C++》</b> — Martin Reddy, 2011, Morgan Kaufmann。系统讨论 pimpl、版本化与接口测试策略。</li>
<li><b>CppCon 2016: Using Types Effectively</b> — Ben Deane。用强类型把约束前移到编译期的经典演讲。</li>
<li><b>《Effective Modern C++》</b> — Scott Meyers, 2014。条款 14 讨论 noexcept，条款 23-30 讨论移动语义与完美转发。</li>
</ul>
</section>`
};
