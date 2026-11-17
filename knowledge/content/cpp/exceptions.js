window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["exceptions"] = {
  slug: "exceptions",
  title: "异常、错误处理与异常安全",
  subtitle: "异常是控制流，也是接口契约",
  level: 2,
  cluster: "对象与资源",
  tags: ["异常", "noexcept", "错误处理"],
  summary: "异常是 C++ 的第二条控制流。讲清栈展开、异常对象的复制与切片、三级异常安全保证、noexcept 契约与析构边界，并比较错误码与 expected 的取舍。",
  keyPoints: [
    "throw 按表达式的静态类型构造异常对象，随后沿调用栈查找 catch，离开的每一帧逆序析构局部对象；无人接住则 terminate",
    "catch 按值会复制并切片，捕获多态基类应使用 const 引用；throw 处也可能因静态类型发生切片",
    "基本保证不泄漏、不破坏不变量；强保证失败即回滚；不抛保证用 noexcept 表达",
    "noexcept 是契约而不是优化开关，违反即 terminate；它决定 vector 扩容时能否安全移动",
    "错误码、optional、expected 各有边界；零成本异常把开销放在只读表和抛出路径上"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>异常不是错误报告，而是一条控制流</h2>
<p>C、Go、Rust 这类系统级语言习惯用返回值报告失败，C++ 的异常（exception）走的是另一条路：<code>throw</code> 之后，当前函数剩下的语句不再执行，局部对象按构造的逆序销毁，控制流沿着调用栈向上寻找能接住它的 <code>catch</code>。所以异常首先是一种<mark>控制流</mark>，其次才是一种错误报告方式。</p>
<p>它同时是一份<mark>接口契约</mark>。一个函数承诺不抛（<code>noexcept</code>），调用方就敢在它之后提交状态、在容器扩容时放心移动；一个函数可能抛，调用方就必须把“操作到一半”的中间状态设计成可回滚、至少可析构。异常安全讨论的正是这件事：失败发生时，对象和资源还能不能保持可解释的状态。</p>
<p>本篇只谈错误的传播方式与接口契约。资源释放的通用手法（RAII、智能指针、scope guard）在“对象与资源”的 RAII 一篇展开，这里只在必要处引用结论。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>正常返回是函数在说“我做完了”；异常是函数在说“我做不下去，而且不打算继续往下做”。<code>catch</code> 不是 if 的替代品，它是调用链上唯一愿意接手这个失败的人。</div></div>
</section>

<section class="sec">
<h2>throw、try、catch 与栈展开</h2>
<p><code>throw expr</code> 先把操作数按<mark>静态类型</mark>复制或移动构造一个异常对象（exception object）：类型取操作数的静态类型并去掉顶层 cv（数组与函数类型分别退化为指针），异常对象本身因此不会是引用，也不带顶层 <code>const</code>。随后运行时做两件事：阶段一沿调用链查找匹配的处理器（handler），阶段二从抛出点向外逐帧销毁自动对象，后者叫<mark>栈展开</mark>（stack unwinding）。语言只规定语义与最终效果；常见实现把两步拆成“先只查表确认有人接，再真正展开”，以免白拆一遍栈，这是 ABI 的实现策略，不是标准强制。</p>
<p>处理器匹配的规则比函数重载简单：类型相同，或能通过类层次上的基类转换、限定转换、指针转换（含指向成员的指针）隐式转换到参数类型，不做用户定义转换。按值参数会复制，按引用参数直接绑定。<code>catch (...)</code> 匹配一切，多个 <code>catch</code> 按书写顺序第一个匹配者胜出，所以它通常写在最后。如果展开途中某个析构函数又抛出异常，标准要求调用 <code>std::terminate</code>，这就是“析构不要抛”的根源。</p>
<p>如果一路到 <code>main</code> 都没有处理器，同样调用 <code>std::terminate</code>，默认终止进程，可以用 <code>std::set_terminate</code> 替换终止行为。异常也不能跨线程传播：线程入口函数必须自己兜住，否则结果还是 terminate。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="栈展开过程：throw 后先查找处理器，再逐帧析构局部对象">
  <defs>
    <marker id="exceptions-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M0,0 L10,5 L0,10 Z" fill="var(--sv-ink)"/>
    </marker>
  </defs>
  <text x="24" y="26" font-size="15" font-weight="700" fill="var(--sv-ink)" font-family="inherit">throw 之后：先查找处理器，再逐帧析构</text>
  <rect x="24" y="44" width="300" height="52" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
  <text x="40" y="65" font-size="13" font-weight="700" fill="var(--sv-ink)" font-family="inherit">main()</text>
  <text x="40" y="84" font-size="12" fill="var(--sv-muted)" font-family="inherit">try { run(); }</text>
  <rect x="24" y="108" width="300" height="66" rx="6" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
  <text x="40" y="129" font-size="13" font-weight="700" fill="var(--sv-ink)" font-family="inherit">run() · 处理器所在帧</text>
  <text x="40" y="147" font-size="12" fill="var(--sv-muted)" font-family="inherit">try { load(); }</text>
  <text x="40" y="164" font-size="12" fill="var(--sv-muted)" font-family="inherit">catch (const std::exception&amp; e)</text>
  <rect x="24" y="186" width="300" height="48" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
  <text x="40" y="207" font-size="13" font-weight="700" fill="var(--sv-ink)" font-family="inherit">load()</text>
  <text x="40" y="225" font-size="12" fill="var(--sv-muted)" font-family="inherit">没有 try，继续向上找</text>
  <rect x="24" y="246" width="300" height="56" rx="6" fill="var(--sv-c)" stroke="var(--sv-line)"/>
  <text x="40" y="267" font-size="13" font-weight="700" fill="var(--sv-ink)" font-family="inherit">parse() · 抛出点</text>
  <text x="40" y="285" font-size="12" fill="var(--sv-muted)" font-family="inherit">throw std::runtime_error{...}</text>
  <path d="M340 286 L340 150" fill="none" stroke="var(--sv-ink)" stroke-width="2" marker-end="url(#exceptions-arrow)"/>
  <text x="350" y="200" font-size="12" fill="var(--sv-muted)" font-family="inherit">展开方向</text>
  <text x="350" y="218" font-size="12" fill="var(--sv-muted)" font-family="inherit">局部对象逆序析构</text>
  <text x="470" y="52" font-size="13" font-weight="700" fill="var(--sv-ink)" font-family="inherit">一次 throw 的五个动作</text>
  <circle cx="482" cy="82" r="11" fill="var(--sv-a)"/>
  <text x="482" y="86" font-size="12" fill="var(--sv-bg)" text-anchor="middle" font-family="inherit">1</text>
  <rect x="502" y="66" width="234" height="32" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
  <text x="512" y="87" font-size="12" fill="var(--sv-ink)" font-family="inherit">构造异常对象（按静态类型）</text>
  <circle cx="482" cy="128" r="11" fill="var(--sv-a)"/>
  <text x="482" y="132" font-size="12" fill="var(--sv-bg)" text-anchor="middle" font-family="inherit">2</text>
  <rect x="502" y="112" width="234" height="32" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
  <text x="512" y="133" font-size="12" fill="var(--sv-ink)" font-family="inherit">parse、load 无匹配，析构局部对象</text>
  <circle cx="482" cy="174" r="11" fill="var(--sv-a)"/>
  <text x="482" y="178" font-size="12" fill="var(--sv-bg)" text-anchor="middle" font-family="inherit">3</text>
  <rect x="502" y="158" width="234" height="32" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
  <text x="512" y="179" font-size="12" fill="var(--sv-ink)" font-family="inherit">run 的 catch 匹配，展开停止</text>
  <circle cx="482" cy="220" r="11" fill="var(--sv-a)"/>
  <text x="482" y="224" font-size="12" fill="var(--sv-bg)" text-anchor="middle" font-family="inherit">4</text>
  <rect x="502" y="204" width="234" height="32" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
  <text x="512" y="225" font-size="12" fill="var(--sv-ink)" font-family="inherit">catch 参数绑定到异常对象</text>
  <circle cx="482" cy="266" r="11" fill="var(--sv-a)"/>
  <text x="482" y="270" font-size="12" fill="var(--sv-bg)" text-anchor="middle" font-family="inherit">5</text>
  <rect x="502" y="250" width="234" height="32" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
  <text x="512" y="271" font-size="12" fill="var(--sv-ink)" font-family="inherit">catch 结束，异常对象销毁</text>
  <text x="24" y="332" font-size="12" fill="var(--sv-muted)" font-family="inherit">一路无匹配 → std::terminate；展开途中析构再抛 → 同样 terminate</text>
</svg>
<figcaption>图 1 · 栈展开：处理器可能在上层某一帧，中间帧的局部对象按逆序析构。</figcaption>
</figure>
<p>下面的例子可以直接编译（C++20）。留意输出顺序：<code>main-try</code> 这个局部对象在进入 <code>catch</code> <b>之前</b>就被析构了，处理器看到的是已经展开干净的栈。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;iostream&gt;
#include &lt;stdexcept&gt;

struct Trace {
    const char* name;
    explicit Trace(const char* n) : name(n) { std::cout &lt;&lt; "进入 " &lt;&lt; name &lt;&lt; '\n'; }
    ~Trace() { std::cout &lt;&lt; "析构 " &lt;&lt; name &lt;&lt; '\n'; }
};

void parse() {
    Trace t{"parse"};
    throw std::runtime_error{"bad token"};
}

void load() {
    Trace t{"load"};
    parse();
}

int main() {
    try {
        Trace t{"main-try"};
        load();
    } catch (const std::exception&amp; e) {
        std::cout &lt;&lt; "捕获 " &lt;&lt; e.what() &lt;&lt; '\n';
    }
}</code></pre>
</section>

<section class="sec">
<h2>异常对象、引用捕获与切片</h2>
<p>异常对象不是普通临时量。它由运行时在实现管理的存储中构造（Itanium ABI 提供 <code>__cxa_allocate_exception</code>，GCC/libstdc++ 通常从堆或预置的紧急缓冲区取内存，具体策略属于实现细节），生命周期延续到最后一个处理它的 <code>catch</code> 退出之后；若被 <code>std::exception_ptr</code> 持有，还会更长。<code>throw;</code> 重抛的是同一个对象，而不是新副本；也正因为它活得比 <code>catch</code> 作用域长，按引用捕获才是零拷贝的。</p>
<p><code>catch</code> 参数按值会复制异常对象，并按参数的静态类型<mark>切片</mark>（slicing）：<code>throw Derived{};</code> 被 <code>catch (Base b)</code> 接住，只留下 <code>Base</code> 子对象，虚函数也按 <code>Base</code> 派发。用 <code>catch (const Base&amp;)</code> 可以绑定完整对象、避免复制并保留动态类型。</p>
<p>切片还可能发生在 <code>throw</code> 处：通过基类引用抛出时，<code>throw</code> 表达式的静态类型是基类，异常对象只复制基类子对象。诊断规则很简单：捕获多态基类一律用 <code>const</code> 引用；确知具体类型时才按值捕获，否则按值只会多一次复制。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div><code>catch (Base&amp; e)</code> 也能绑定，但非 const 引用允许你修改异常对象，重抛后别人看到的是改过的版本；除非有意为之，写 <code>const Base&amp;</code>。</div></div>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="异常对象的存储与两种切片：throw 时按静态类型复制，catch 按值再复制">
  <defs>
    <marker id="exceptions-arrow2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M0,0 L10,5 L0,10 Z" fill="var(--sv-ink)"/>
    </marker>
  </defs>
  <text x="24" y="26" font-size="15" font-weight="700" fill="var(--sv-ink)" font-family="inherit">异常对象与切片：静态类型决定复制什么</text>
  <text x="24" y="56" font-size="12" fill="var(--sv-muted)" font-family="inherit">① throw Derived{}：完整对象进入异常存储，引用捕获安全</text>
  <rect x="24" y="66" width="150" height="44" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
  <text x="36" y="86" font-size="12" fill="var(--sv-ink)" font-family="inherit">throw Derived{};</text>
  <text x="36" y="103" font-size="11" fill="var(--sv-muted)" font-family="inherit">静态类型 Derived</text>
  <path d="M174 88 L208 88" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#exceptions-arrow2)"/>
  <rect x="212" y="60" width="270" height="64" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
  <text x="224" y="78" font-size="11" fill="var(--sv-muted)" font-family="inherit">异常对象（运行时管理生命周期）</text>
  <rect x="224" y="86" width="104" height="30" rx="4" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
  <text x="276" y="105" font-size="11" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">Base 子对象</text>
  <rect x="336" y="86" width="134" height="30" rx="4" fill="var(--sv-b)" stroke="var(--sv-line)"/>
  <text x="403" y="105" font-size="11" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">Derived 成员</text>
  <path d="M482 88 L516 88" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#exceptions-arrow2)"/>
  <rect x="520" y="64" width="216" height="54" rx="6" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
  <text x="532" y="85" font-size="12" fill="var(--sv-ink)" font-family="inherit">catch (const Base&amp; e)</text>
  <text x="532" y="103" font-size="11" fill="var(--sv-muted)" font-family="inherit">绑定完整对象，不切片</text>
  <text x="24" y="158" font-size="12" fill="var(--sv-muted)" font-family="inherit">② Base&amp; b = d; throw b;：只复制静态类型那部分，抛出时已切片</text>
  <rect x="24" y="168" width="150" height="44" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
  <text x="36" y="188" font-size="12" fill="var(--sv-ink)" font-family="inherit">throw b;</text>
  <text x="36" y="205" font-size="11" fill="var(--sv-muted)" font-family="inherit">静态类型 Base</text>
  <path d="M174 190 L208 190" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#exceptions-arrow2)"/>
  <rect x="212" y="162" width="270" height="64" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
  <text x="224" y="180" font-size="11" fill="var(--sv-muted)" font-family="inherit">异常对象（只剩基类部分）</text>
  <rect x="224" y="188" width="104" height="30" rx="4" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
  <text x="276" y="207" font-size="11" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">Base 子对象</text>
  <rect x="336" y="188" width="134" height="30" rx="4" fill="none" stroke="var(--sv-line)" stroke-dasharray="4 4"/>
  <text x="403" y="207" font-size="11" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">Derived 成员丢失</text>
  <path d="M482 190 L516 190" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#exceptions-arrow2)"/>
  <rect x="520" y="166" width="216" height="54" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
  <text x="532" y="187" font-size="12" fill="var(--sv-ink)" font-family="inherit">catch (Base b)</text>
  <text x="532" y="205" font-size="11" fill="var(--sv-muted)" font-family="inherit">再复制一次，仍是 Base</text>
  <text x="24" y="272" font-size="12" fill="var(--sv-muted)" font-family="inherit">catch (Base b) 会对异常对象再做一次按值复制并切片；catch (const Base&amp; e) 才是零拷贝且保留动态类型。</text>
  <text x="24" y="296" font-size="12" fill="var(--sv-muted)" font-family="inherit">std::exception::what() 是虚函数：切片后按 Base 派发，派生类的错误信息已经丢了。</text>
</svg>
<figcaption>图 2 · 两次切片：一次在 throw 表达式的静态类型，一次在 catch 的按值参数。</figcaption>
</figure>
<p>下面的例子可以直接编译（C++20），演示按静态类型抛出后切片已经发生。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;iostream&gt;

struct Base {
    virtual ~Base() = default;
    virtual const char* name() const { return "Base"; }
};
struct Derived : Base {
    const char* name() const override { return "Derived"; }
};

int main() {
    try {
        Derived d;
        Base&amp; b = d;
        throw b;                        // 静态类型是 Base：异常对象已切片
    } catch (const Base&amp; e) {
        std::cout &lt;&lt; e.name() &lt;&lt; '\n';  // 输出 Base，而不是 Derived
    }
}</code></pre>
</section>

<section class="sec">
<h2>异常安全的三级保证</h2>
<p>“这个函数异常安全”不是一句话，而是一个等级。<mark>基本保证</mark>（basic guarantee）要求不泄漏资源、不破坏类的不变量，对象处于有效但未指定的状态，仍可安全析构，通常也能继续使用；<mark>强保证</mark>（strong guarantee）要求失败即回滚，状态与调用前完全相同，也叫 commit-or-rollback；<mark>不抛保证</mark>（nothrow guarantee）则承诺根本不会失败，通常用 <code>noexcept</code> 表达。</p>
<p>强保证的通用做法是 copy-and-swap：先在副本上完成可能失败的操作，全部成功后再用一个不抛的 <code>swap</code> 提交。下面这个赋值运算符把参数按值接收，拷贝发生在进入函数体之前；若拷贝失败，<code>this</code> 还没被碰过，自然满足强保证。赋值运算符本身不必标 <code>noexcept</code>：可能抛的拷贝属于参数构造阶段，真正需要保证不抛的是用于提交的 <code>swap</code>。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;cstddef&gt;
#include &lt;vector&gt;

class Buffer {
public:
    explicit Buffer(std::size_t n) : data_(n) {}

    // 默认分配器下，C++17 起 vector::swap 是 noexcept 的
    void swap(Buffer&amp; other) noexcept { data_.swap(other.data_); }

    // 参数按值：拷贝在进入函数体前完成，失败时 this 还没动过
    Buffer&amp; operator=(Buffer other) {
        swap(other);
        return *this;
    }

private:
    std::vector&lt;std::byte&gt; data_;
};</code></pre>
<p>标准库把等级写进了每一份规格里：元素可拷贝、或移动构造为 <code>noexcept</code> 时，<code>vector::push_back</code> 提供强保证；<code>map::insert</code> 提供强保证；内置类型的 <code>swap</code>、析构函数、<code>unique_ptr</code> 的移动是不抛的。反过来，如果元素类型不可拷贝、移动构造又可能抛，<code>vector</code> 扩容中途失败时的效果就是未指定的，这是“移动构造尽量 noexcept”的直接动机。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="异常安全等级：无保证、基本、强、不抛四级">
  <text x="24" y="26" font-size="15" font-weight="700" fill="var(--sv-ink)" font-family="inherit">异常安全的等级：越往下承诺越强，代价通常也越高</text>
  <rect x="24" y="46" width="712" height="58" rx="6" fill="var(--sv-c)" stroke="var(--sv-line)"/>
  <text x="40" y="70" font-size="13" font-weight="700" fill="var(--sv-ink)" font-family="inherit">无保证（no guarantee）· 不可接受</text>
  <text x="40" y="90" font-size="12" fill="var(--sv-muted)" font-family="inherit">泄漏资源或破坏不变量，对象甚至不能安全析构</text>
  <rect x="540" y="58" width="180" height="32" rx="16" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
  <text x="630" y="79" font-size="11" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">手工 new 后抛异常</text>
  <rect x="24" y="116" width="712" height="58" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
  <text x="40" y="140" font-size="13" font-weight="700" fill="var(--sv-ink)" font-family="inherit">基本保证（basic）</text>
  <text x="40" y="160" font-size="12" fill="var(--sv-muted)" font-family="inherit">不泄漏、不变量成立；状态有效但未指定，仍可析构与继续使用</text>
  <rect x="540" y="128" width="180" height="32" rx="16" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
  <text x="630" y="149" font-size="11" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">多成员赋值中途失败</text>
  <rect x="24" y="186" width="712" height="58" rx="6" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
  <text x="40" y="210" font-size="13" font-weight="700" fill="var(--sv-ink)" font-family="inherit">强保证（strong）</text>
  <text x="40" y="230" font-size="12" fill="var(--sv-muted)" font-family="inherit">失败即回滚，状态与调用前相同：commit-or-rollback</text>
  <rect x="540" y="198" width="180" height="32" rx="16" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
  <text x="630" y="219" font-size="11" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">copy-and-swap</text>
  <rect x="24" y="256" width="712" height="58" rx="6" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
  <text x="40" y="280" font-size="13" font-weight="700" fill="var(--sv-ink)" font-family="inherit">不抛保证（nothrow）</text>
  <text x="40" y="300" font-size="12" fill="var(--sv-muted)" font-family="inherit">承诺不失败，通常以 noexcept 写进类型与接口</text>
  <rect x="540" y="268" width="180" height="32" rx="16" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
  <text x="630" y="289" font-size="11" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">swap、析构、移动</text>
  <text x="24" y="342" font-size="12" fill="var(--sv-muted)" font-family="inherit">不要一律追求最强：按调用者的需要选择；跨模块边界至少应给出基本保证。</text>
</svg>
<figcaption>图 3 · 三级保证：基本保证是底线，强保证要额外一次拷贝，不抛保证是契约。</figcaption>
</figure>
<div class="formula">不泄漏 ∧ 不破坏不变量 ∧ 失败后仍可析构、可继续使用 ＝ 基本保证
失败 ⇒ 状态 ≡ 调用前 ＝ 强保证
E[代价] ＝ P(抛出) × C(抛出) ＋ (1 − P) × C(正常)</div>
</section>

<section class="sec">
<h2>noexcept：一个编译期可检查的契约</h2>
<p><code>noexcept</code> 有两副面孔：作为运算符，<code>noexcept(expr)</code> 在编译期给出一个 <code>bool</code>，常用于模板里探测某个操作是否会抛；作为说明符，<code>void f() noexcept</code> 是函数对调用方的承诺。C++17 起它进入<mark>函数类型</mark>：指向 noexcept 函数的指针与普通函数指针是不同类型，模板匹配会区分它们；同时存在从 noexcept 函数指针到普通函数指针的隐式转换，反之不行。但它不参与重载决议，不能只靠 noexcept 写两个重载。</p>
<p>违反承诺的后果是 <code>std::terminate</code>，不是把异常转交给调用者。因此 <code>noexcept</code> 不能当优化开关随手贴：一个今天不抛、明天因为日志分配内存而抛的函数，会把可恢复的错误变成进程崩溃，而且标准不保证此时栈已经展开。</p>
<p>它的真实收益集中在“让标准库敢走更便宜的路径”。<code>vector</code> 扩容时用类似 <code>std::move_if_noexcept</code> 的策略：元素的移动构造是 noexcept（或类型不可拷贝）才移动，否则宁可拷贝，因为拷贝失败还能保住旧缓冲区，移动失败就无路可退。这是移动构造、<code>swap</code>、析构被建议标 noexcept 的原因。下面的探测片段（示意）：</p>
<pre class="code" data-lang="cpp"><code>#include &lt;utility&gt;

struct Widget {
    Widget(Widget&amp;&amp;) noexcept;              // 移动构造承诺不抛
    Widget&amp; operator=(Widget&amp;&amp;) noexcept;
};

// 仅为编译期探测；上面两个特殊成员函数无需在此定义
static_assert(noexcept(Widget(std::declval&lt;Widget&amp;&amp;&gt;())));</code></pre>
<div class="callout callout--warn"><span class="callout__label">警告</span><div>不要“为了性能”给没验证过的函数加 <code>noexcept</code>。它通常不会让普通调用变快多少（表驱动实现本来就不为不抛路径付费），却会把一次可处理的失败升级为 terminate。</div></div>
</section>

<section class="sec">
<h2>析构函数与异常规格：不要制造第二个异常</h2>
<p>析构函数默认是 <code>noexcept(true)</code> 的，除非某个成员或基类的析构可能抛。原因很直接：栈展开过程中已经有一个异常在飞，若析构再抛第二个，标准要求 terminate；即使没有展开，析构抛异常也几乎无法被合理处理。所以析构里只做不会失败的事——关闭句柄、释放内存、置空指针。</p>
<p>可能失败的操作要挪到显式接口上。文件类可以同时提供不抛的析构和可报告错误的 <code>close()</code>：析构负责兜底，<code>close()</code> 负责告诉调用者“冲刷或关闭失败了”。实现时要注意先把描述符置空，否则 close 失败后再进析构会二次关闭同一个 fd，可能误伤被复用的描述符。C++17 的 <code>std::uncaught_exceptions()</code> 能在 scope guard 场景判断当前是否正在展开，但它不是给“析构里抛异常”找理由的工具。最小骨架如下（POSIX 环境）：</p>
<pre class="code" data-lang="cpp"><code>#include &lt;cerrno&gt;
#include &lt;system_error&gt;
#include &lt;unistd.h&gt;

class File {
public:
    ~File() { if (fd_ != -1) ::close(fd_); }   // 析构：尽力释放，不报告失败

    void close() {                             // 显式接口：可以报告错误
        if (fd_ == -1) return;
        int fd = fd_;
        fd_ = -1;                              // 先置空：即使 close 失败也不会二次关闭
        if (::close(fd) != 0)
            throw std::system_error{errno, std::generic_category()};
    }

private:
    int fd_ = -1;
};</code></pre>
<p>异常规格（exception specification）有一段历史包袱：动态异常规格 <code>throw(int)</code> 在 C++11 被弃用、C++17 移除；<code>throw()</code> 在 C++17 弃用、C++20 移除，统一由 <code>noexcept</code> 取代。新代码里不该再出现这两种写法。构造函数的 function-try-block 能捕获成员初始化列表抛出的异常，但若处理器正常走到结尾，异常会被隐式重抛，不能用来“吞掉构造失败”；要转换错误类型，得在处理器里显式抛出新的异常。</p>
</section>

<section class="sec">
<h2>错误码、optional 与 expected 的取舍</h2>
<p>异常不是唯一选择。错误码（error code）是 C 接口和禁用异常环境的通用语言：没有隐藏控制流、开销可预测、ABI 简单；代价是调用者容易忽略，传播要逐层写 <code>if</code>，构造函数又没有返回值可放。它适合系统调用包装、跨语言边界和硬实时路径。</p>
<p><code>std::optional&lt;T&gt;</code>（C++17）只表达“有或没有”，不携带失败原因，适合查找未命中、可选配置这类语义；<code>std::expected&lt;T,E&gt;</code>（C++23，提案 P0323）携带值或错误，支持 <code>and_then</code>、<code>transform</code>、<code>or_else</code> 这类单调组合，适合库边界和可恢复错误。C++20 及以前可以用 <code>tl::expected</code>、Boost.Outcome，或退而求其次用 <code>variant&lt;T,E&gt;</code>。</p>
<p>选择原则可以压成一句话：构造失败、运算符重载、调用链很深、错误罕见，用异常；跨 C ABI、禁用异常、错误是正常业务分支，用返回值型方案；只是“没有值”，用 <code>optional</code>；需要原因又要显式传播，用 <code>expected</code> 或 <code>error_code</code>。不要用异常做正常控制流，比如靠 <code>throw</code> 跳出多层循环。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>方案</th><th>传播方式</th><th>携带原因</th><th>不抛时开销</th><th>典型场景</th></tr></thead>
<tbody>
<tr><td>异常 <code>throw T</code></td><td>自动沿栈</td><td>任意类型</td><td>正常路径近零（表驱动，实现相关）</td><td>构造失败、运算符、深层调用</td></tr>
<tr><td>错误码 / <code>error_code</code></td><td>逐层返回</td><td>整数、枚举或错误分类</td><td>一次返回</td><td>C ABI、系统调用、禁用异常</td></tr>
<tr><td><code>optional&lt;T&gt;</code>（C++17）</td><td>逐层返回</td><td>不带</td><td>小</td><td>查找未命中、可选值</td></tr>
<tr><td><code>expected&lt;T,E&gt;</code>（C++23）</td><td>逐层返回</td><td>E 类型</td><td>小</td><td>库边界、可恢复错误</td></tr>
</tbody>
</table></div>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="错误处理方案对比：自动传播与手动传播、是否携带原因四个象限">
  <defs>
    <marker id="exceptions-arrow3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M0,0 L10,5 L0,10 Z" fill="var(--sv-ink)"/>
    </marker>
  </defs>
  <text x="24" y="26" font-size="15" font-weight="700" fill="var(--sv-ink)" font-family="inherit">错误处理方案怎么选：两个维度，四个象限</text>
  <text x="24" y="44" font-size="12" fill="var(--sv-muted)" font-family="inherit">自动（沿栈传播）</text>
  <text x="24" y="226" font-size="12" fill="var(--sv-muted)" font-family="inherit">手动（返回值）</text>
  <path d="M170 40 L170 340" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#exceptions-arrow3)"/>
  <path d="M170 340 L710 340" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#exceptions-arrow3)"/>
  <rect x="180" y="52" width="250" height="130" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
  <text x="196" y="78" font-size="13" font-weight="700" fill="var(--sv-ink)" font-family="inherit">异常，但不带信息</text>
  <text x="196" y="100" font-size="12" fill="var(--sv-muted)" font-family="inherit">catch (...) 只能收尾，无法决策</text>
  <text x="196" y="122" font-size="12" fill="var(--sv-muted)" font-family="inherit">不推荐：异常应携带类型与原因</text>
  <rect x="440" y="52" width="250" height="130" rx="6" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
  <text x="456" y="78" font-size="13" font-weight="700" fill="var(--sv-ink)" font-family="inherit">异常 throw T</text>
  <text x="456" y="100" font-size="12" fill="var(--sv-muted)" font-family="inherit">构造失败、运算符、深层调用链</text>
  <text x="456" y="122" font-size="12" fill="var(--sv-muted)" font-family="inherit">错误罕见，且需要自动传播</text>
  <rect x="180" y="192" width="250" height="130" rx="6" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
  <text x="196" y="218" font-size="13" font-weight="700" fill="var(--sv-ink)" font-family="inherit">optional / bool</text>
  <text x="196" y="240" font-size="12" fill="var(--sv-muted)" font-family="inherit">只表达有无，不解释为什么</text>
  <text x="196" y="262" font-size="12" fill="var(--sv-muted)" font-family="inherit">查找未命中、可选配置</text>
  <rect x="440" y="192" width="250" height="130" rx="6" fill="var(--sv-b)" stroke="var(--sv-line)"/>
  <text x="456" y="218" font-size="13" font-weight="700" fill="var(--sv-ink)" font-family="inherit">expected / error_code</text>
  <text x="456" y="240" font-size="12" fill="var(--sv-muted)" font-family="inherit">库边界、C ABI、禁用异常</text>
  <text x="456" y="262" font-size="12" fill="var(--sv-muted)" font-family="inherit">错误是正常分支，需要原因</text>
  <text x="196" y="366" font-size="12" fill="var(--sv-muted)" font-family="inherit">不携带原因</text>
  <text x="540" y="366" font-size="12" fill="var(--sv-muted)" font-family="inherit">携带失败原因</text>
</svg>
<figcaption>图 4 · 先问“谁传播、要不要原因”，再在异常、optional、expected、错误码之间选。</figcaption>
</figure>
<p>下面的示例使用 C++23 的 <code>std::expected</code>，需要已支持 <code>&lt;expected&gt;</code> 的工具链，例如 GCC 12+、Clang 16+ 或 MSVC 19.33+。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;cstdio&gt;
#include &lt;expected&gt;
#include &lt;stdexcept&gt;
#include &lt;string&gt;

std::expected&lt;int, std::string&gt; parse_port(const std::string&amp; s) {
    try {
        std::size_t pos{};
        int v = std::stoi(s, &amp;pos);
        if (pos != s.size() || v &lt; 0 || v &gt; 65535)
            return std::unexpected&lt;std::string&gt;{"端口越界"};
        return v;
    } catch (const std::invalid_argument&amp;) {
        return std::unexpected&lt;std::string&gt;{"不是数字"};
    } catch (const std::out_of_range&amp;) {
        return std::unexpected&lt;std::string&gt;{"超出 int 范围"};
    }
}

int main() {
    auto r = parse_port("8080");
    if (r) std::printf("%d\n", *r);
    else   std::printf("%s\n", r.error().c_str());
}</code></pre>
</section>

<section class="sec">
<h2>零成本异常的真相与禁用异常的工程环境</h2>
<p>“零成本异常”（zero-cost exception）指的是<mark>不抛的时候不为异常付运行时开销</mark>，不是异常本身免费。表驱动实现（Itanium ABI 用 <code>.eh_frame</code>、LSDA（Language-Specific Data Area）与 personality 例程；Windows x64 用 <code>.pdata</code>/<code>.xdata</code> 与 C++ EH 处理器）把“哪个区间需要清理、能接住什么类型”编码进只读表。正常路径上没有额外的 push/pop，也没有 <code>setjmp</code>。</p>
<p>代价被挪到了抛出路径，并以代码体积的形式常驻：分配异常对象、查表定位处理器、逐帧调用清理、进入 <code>catch</code>，整条路径通常比一次普通函数调用贵得多。平台差异要说清楚：MSVC 32 位使用基于帧的 SEH（Structured Exception Handling），正常路径也有少量开销，这不是本文所说的“零成本”；MSVC x64 才是表驱动。</p>
<p>禁用异常时，GCC/Clang 用 <code>-fno-exceptions</code>。此时源码里直接出现 <code>throw</code> 或 <code>try</code> 通常无法通过编译（GCC 会报 “exception handling disabled”），而不是运行期悄悄终止；只有来自预编译库的抛出路径才会走到运行库的终止逻辑。MSVC 没有与 <code>-fno-exceptions</code> 完全对等的单一开关：它通过关闭 <code>/EH</code> 的展开语义（如 <code>/EHs-c-</code>）并配合 <code>_HAS_EXCEPTIONS=0</code> 之类的库配置来近似，具体行为取决于编译器与运行库。跨编译单元混用异常设置非常危险：中间帧可能没有清理信息，表现为 terminate、漏析构或未定义行为。内核、部分嵌入式与实时系统、LLVM 的默认构建、Google C++ 规范，都是常见的“无异常”环境。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="零成本异常：正常路径无额外指令，抛出路径集中付费">
  <defs>
    <marker id="exceptions-arrow4" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M0,0 L10,5 L0,10 Z" fill="var(--sv-ink)"/>
    </marker>
  </defs>
  <text x="24" y="26" font-size="15" font-weight="700" fill="var(--sv-ink)" font-family="inherit">零成本异常：不抛时几乎不付钱，抛出时集中付费</text>
  <text x="24" y="54" font-size="12" font-weight="700" fill="var(--sv-ink)" font-family="inherit">正常路径（绝大多数调用）</text>
  <rect x="24" y="62" width="712" height="48" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
  <rect x="40" y="70" width="180" height="32" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
  <text x="130" y="91" font-size="12" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">调用 f()</text>
  <path d="M220 86 L266 86" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#exceptions-arrow4)"/>
  <rect x="270" y="70" width="180" height="32" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
  <text x="360" y="91" font-size="12" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">执行 try 块</text>
  <path d="M450 86 L496 86" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#exceptions-arrow4)"/>
  <rect x="500" y="70" width="180" height="32" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
  <text x="590" y="91" font-size="12" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">正常返回</text>
  <text x="24" y="130" font-size="12" fill="var(--sv-muted)" font-family="inherit">指令流里没有额外的 push/pop 或 setjmp；清理信息在只读表里（实现相关）。</text>
  <text x="24" y="158" font-size="12" font-weight="700" fill="var(--sv-ink)" font-family="inherit">抛出路径（罕见）</text>
  <rect x="24" y="168" width="132" height="80" rx="6" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
  <text x="90" y="194" font-size="11" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">① 分配并构造</text>
  <text x="90" y="212" font-size="11" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">异常对象</text>
  <text x="90" y="234" font-size="10" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">堆分配</text>
  <path d="M156 208 L178 208" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#exceptions-arrow4)"/>
  <rect x="182" y="168" width="132" height="80" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
  <text x="248" y="194" font-size="11" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">② 阶段一</text>
  <text x="248" y="212" font-size="11" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">查表找 handler</text>
  <text x="248" y="234" font-size="10" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">只读表遍历</text>
  <path d="M314 208 L336 208" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#exceptions-arrow4)"/>
  <rect x="340" y="168" width="132" height="80" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
  <text x="406" y="194" font-size="11" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">③ 阶段二</text>
  <text x="406" y="212" font-size="11" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">逐帧清理</text>
  <text x="406" y="234" font-size="10" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">调用析构</text>
  <path d="M472 208 L494 208" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#exceptions-arrow4)"/>
  <rect x="498" y="168" width="110" height="80" rx="6" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
  <text x="553" y="194" font-size="11" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">④ 进入</text>
  <text x="553" y="212" font-size="11" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">catch</text>
  <text x="553" y="234" font-size="10" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">跳转</text>
  <path d="M608 208 L630 208" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#exceptions-arrow4)"/>
  <rect x="634" y="168" width="102" height="80" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
  <text x="685" y="194" font-size="11" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">⑤ 销毁</text>
  <text x="685" y="212" font-size="11" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">异常对象</text>
  <text x="685" y="234" font-size="10" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">释放</text>
  <text x="24" y="282" font-size="12" fill="var(--sv-muted)" font-family="inherit">实现口径：Itanium ABI 用 .eh_frame 与 LSDA；Windows x64 用 .pdata/.xdata。MSVC 32 位帧式 SEH 在正常路径也有少量开销。</text>
  <text x="24" y="306" font-size="12" fill="var(--sv-muted)" font-family="inherit">总代价 ＝ 代码体积（只读表）＋ 抛出时的展开，所以异常不适合高频、可预期的分支。</text>
</svg>
<figcaption>图 5 · 零成本的边界：不抛时只多出只读表，抛出时才集中支付展开成本。</figcaption>
</figure>
<pre class="code" data-lang="bash"><code># GCC / Clang：禁用异常
g++ -std=c++20 -fno-exceptions app.cpp
# 查看异常相关表：.eh_frame 用于通用栈展开，异常专用的 LSDA 在 .gcc_except_table
readelf -S app | grep -E 'eh_frame|gcc_except_table'</code></pre>
<p>如果工程禁用异常，接口就要整体换成返回值型方案：构造函数改成返回 <code>optional</code>/<code>expected</code> 的工厂函数，或者两步式 <code>bool init(...)</code>；资源清理继续靠 RAII，不能因为“不会抛”就退回手工释放。最后用 <code>-fno-exceptions</code> 全量构建并跑测试，别只在一个库里禁用。</p>
<h3>常见误区与排障</h3>
<ul>
<li><code>catch (...)</code> 吞掉一切：拿不到类型和原因，也无法区分“可恢复”和“程序 bug”。</li>
<li><code>catch (std::exception e)</code> 按值捕获：复制加切片，<code>what()</code> 退化成基类版本。</li>
<li>析构函数抛异常：展开途中直接 terminate；没在展开时也几乎无法处理。</li>
<li>给可能抛的函数贴 <code>noexcept</code>：把可恢复错误升级为进程终止。</li>
<li>用异常做正常控制流：高频抛出会把“零成本”变成实打实的性能问题。</li>
</ul>
<h3>自测</h3>
<details class="quiz"><summary>Q1 · <code>throw Derived{};</code> 被 <code>catch (Base b)</code> 捕获后，调用 <code>b.name()</code> 会得到什么？</summary><div class="quiz__a">得到 <code>Base</code> 的版本。按值捕获会对异常对象做一次复制，并按参数静态类型 <code>Base</code> 切片，派生类成员与动态类型信息都丢了。改成 <code>catch (const Base&amp; b)</code> 才能保留动态类型、避免复制。</div></details>
<details class="quiz"><summary>Q2 · 一个函数被声明为 <code>noexcept</code>，内部却抛出了异常，会发生什么？</summary><div class="quiz__a">调用 <code>std::terminate</code>，默认终止进程。异常不会转交给调用者，标准也不保证栈已经展开，析构可能没有执行。所以 <code>noexcept</code> 只能用在确定不失败的操作上，比如 <code>swap</code>、析构、已验证的移动构造。</div></details>
<details class="quiz"><summary>Q3 · 为什么 copy-and-swap 能提供强保证？代价是什么？</summary><div class="quiz__a">参数按值接收，拷贝发生在进入函数体之前；拷贝失败时 <code>this</code> 尚未修改。函数体内只做不抛的 <code>swap</code> 完成提交，因此要么整体成功，要么保持原状。代价是一次额外的拷贝或移动，以及需要提供一个不抛的 <code>swap</code>。</div></details>
<details class="quiz"><summary>Q4 · <code>vector</code> 扩容时，什么时候会移动元素而不是拷贝？</summary><div class="quiz__a">当元素的移动构造是 <code>noexcept</code>，或者元素类型不可拷贝时，实现才用移动（<code>move_if_noexcept</code> 策略）。否则移动中途抛异常会丢失旧缓冲区，无法提供强保证，所以宁可拷贝。这也是给移动构造标 <code>noexcept</code> 的现实收益。</div></details>
<h3>延伸阅读</h3>
<ul class="refs">
<li><b>cppreference “Exceptions”</b> — cppreference.com，持续更新。异常对象、栈展开与处理器匹配规则的权威速查。</li>
<li><b>C++ Core Guidelines E.1–E.31</b> — Bjarne Stroustrup &amp; Herb Sutter，2015 起。异常处理的设计规则，覆盖何时抛、如何保证安全与不要在析构中抛。</li>
<li><b>《Effective Modern C++》条款 14</b> — Scott Meyers，2014。论证何时声明 <code>noexcept</code>，以及它与移动语义、容器扩容的互动。</li>
<li><b>P0323R12 “std::expected”</b> — ISO C++ 提案。expected 的设计动机、接口与单调组合，C++23 采纳。</li>
<li><b>Itanium C++ ABI: Exception Handling</b> — Itanium C++ ABI 工作组。表驱动展开、LSDA 与两阶段处理的实现说明。</li>
</ul>
</section>`
};
