window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["raii"] = {
  slug: "raii",
  title: "RAII 与资源管理",
  subtitle: "把释放资源的责任交给析构函数",
  level: 2,
  cluster: "对象与资源",
  tags: ["RAII", "异常安全", "作用域守卫"],
  summary: "从一段漏掉 fclose 的代码说起，讲清 RAII 的构造-析构契约、异常栈展开、作用域守卫与所有权建模，让你把任意句柄包成不易泄漏、不易误用的类型。",
  keyPoints: [
    "RAII 把资源生命周期绑定到栈对象的生命周期：构造获取并校验，析构释放且不抛异常",
    "自动存储期对象在正常或异常离开作用域时会被析构，提前 return、抛出异常都算离开；顺序与构造相反",
    "异常展开只析构抛出点到匹配 handler 之间的对象，构造函数体内裸获取的资源不会自动回收",
    "封装资源类要明确拷贝与移动语义：通常删除拷贝、实现 noexcept 移动，并保证 moved-from 状态可析构",
    "RAII 不等于智能指针：锁、文件、套接字、连接都该有对应的守卫类型，所有权用 unique_ptr、shared_ptr 与非拥有指针表达"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>一句话：让析构函数替你收尾</h2>
<p><mark>RAII</mark>（Resource Acquisition Is Initialization，资源获取即初始化）是 C++ 最核心的资源管理惯用法：把一个资源的生命周期绑定到一个栈对象的生命周期上。构造函数获取资源并建立不变量，析构函数释放资源。只要控制流以正常或异常方式离开作用域，释放就会发生，不管控制流是正常走完、提前返回，还是抛出异常；进程被强制终止等少数情况除外，下文会单独说明边界。</p>
<p>这个缩写其实有点误导。重点不是"在初始化时获取"，而是"获取与释放都由对象负责"：资源的所有权被编码进类型系统，编译器负责在正确的位置插入析构调用。RAII 这一术语和惯用法由 Bjarne Stroustrup 在 1980 年代提出，他在《The Design and Evolution of C++》里把它作为 C++ 异常处理设计的一部分来讨论，强调它解决的是"获取与释放必须配对"的问题。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>把资源想成一张借书卡：构造函数是"借"，析构函数是"还"。你不需要记住每个出口都要还书，因为还书动作绑定在"离开图书馆"这件事上。C++ 的"离开"由作用域定义，所以编译器比你更可靠。</div></div>
<p>读完这一篇，你应该能做到三件事：看到裸的 new、fopen、lock 就知道风险在哪；能把任意句柄包成不易误用的类型；能解释异常抛出时析构为何仍会执行，以及哪些情况下不会。</p>
</section>

<section class="sec">
<h2>手动管理为什么会漏：三条失败路径</h2>
<p>先看一段很多人写过的代码。它逻辑上没错，但只要函数长到几十行、分支多起来，就很容易出问题：</p>
<pre class="code" data-lang="cpp"><code>// 示意：反面教材
void write_log(const char* path) {
    std::FILE* fp = std::fopen(path, "w");
    if (fp == nullptr) return;

    std::fprintf(fp, "begin\n");
    if (!validate()) return;          // 漏点 1：提前返回，fp 泄漏
    std::fprintf(fp, "end\n");

    std::fclose(fp);
}</code></pre>
<p><b>漏点一：提前返回。</b>每增加一个判断分支，就多一个绕过 fclose 的出口。代码评审时没人能逐条核对"所有路径都释放了吗"，这件事无法靠人眼可靠完成。</p>
<p><b>漏点二：异常。</b>如果 fprintf 之后的某个调用抛出异常——例如构造 std::string、std::vector 扩容、日志库做一次格式化——控制流就直接跳出函数，fclose 那一行永远不会执行。C 风格代码里这不算大问题，因为 C 没有异常；但在 C++ 里，任何可能抛异常并逸出函数的调用都会变成泄漏点，哪怕它看起来和文件毫无关系。</p>
<p><b>漏点三：双重释放。</b>有人为了修漏点一，在 if 分支里补了一句 fclose，却忘了主路径末尾还有一句。于是失败路径上文件被关闭两次，行为未定义，典型表现是崩溃在毫不相干的代码位置。修补本身制造了新 bug，这是手动管理最典型的恶性循环。</p>
<p>这三条路径的共性是：<mark>释放动作散落在多个出口</mark>。RAII 的思路不是"更仔细地检查每个出口"，而是把出口的数量从 N 个收敛到 1 个——对象析构。</p>
<div class="callout callout--story"><span class="callout__label">故事</span><div>Stroustrup 多次表达过一个相近的观点：程序员不是不知道要释放资源，而是无法在代码演化中持续保证每条路径都释放。他的结论是：正确性不能依赖纪律，只能依赖语言机制，RAII 就是那个机制。</div></div>
</section>

<section class="sec">
<h2>什么算资源：五类句柄与它们的释放动作</h2>
<p>在 RAII 语境下，资源指任何"获取后必须成对释放、否则会耗尽或损坏系统状态"的东西。它不一定占内存，判断标准只有一条：忘记释放会不会出问题。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>资源</th><th>获取动作</th><th>释放动作</th><th>标准库封装</th><th>泄漏后果</th></tr></thead>
<tbody>
<tr><td>堆内存</td><td>new / malloc</td><td>delete / free</td><td>std::unique_ptr、std::string、std::vector</td><td>内存增长，长跑进程 OOM</td></tr>
<tr><td>文件与流</td><td>fopen / open</td><td>fclose / close</td><td>std::ifstream、std::ofstream、std::fstream</td><td>句柄耗尽，后续打开失败；缓冲数据丢失</td></tr>
<tr><td>互斥量</td><td>lock / try_lock</td><td>unlock</td><td>std::lock_guard、std::unique_lock、std::scoped_lock</td><td>其他线程永久阻塞，形成死锁</td></tr>
<tr><td>文件描述符与套接字</td><td>socket / accept / pipe</td><td>close（套接字可先 shutdown 半关闭）</td><td>无通用封装，通常自写或依赖库类型</td><td>fd 耗尽，连接堆积，服务拒绝新请求</td></tr>
<tr><td>连接与外部句柄</td><td>connect、dlopen、注册表打开、GPU 上下文</td><td>disconnect、dlclose、关闭句柄</td><td>由具体库提供，或自写守卫</td><td>连接池枯竭、库无法卸载、驱动资源泄漏</td></tr>
</tbody>
</table></div>
<p>注意最后一列：内存泄漏只是让进程慢慢变胖；锁忘了释放，其他线程很快就会永久阻塞；fd 泄漏则在配额耗尽后让服务拒绝新连接。锁与句柄比内存更需要 RAII，因为没有 GC 兜底。</p>
<h3>析构的确定性</h3>
<p>C++ 与 GC 语言最根本的差异在这里：对于<b>自动存储期</b>（automatic storage duration）的对象，标准保证它在离开作用域时被析构。离开的方式包括正常到达作用域末尾、return、break、continue、goto 跳出块，以及异常导致的栈展开。析构顺序是构造顺序的严格逆序：同一作用域内后构造的先析构；类成员按声明逆序析构；数组元素也按逆序析构。</p>
<div class="formula">构造：获取资源 → 校验结果 → 对象进入有效状态
析构：释放资源 → 不抛异常 → 对象离开有效状态
不变量：对象处于有效状态 ⇒ 资源被持有，或已被显式释放并置空
顺序：同一作用域内，析构顺序 = 构造顺序的逆序</div>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="RAII 对象生命周期与嵌套作用域的逆序析构" font-family="inherit">
<defs>
<marker id="raii-a1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-ink)"></path>
</marker>
</defs>
<rect x="40" y="46" width="680" height="176" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="54" y="68" font-size="13" fill="var(--sv-muted)">函数作用域：对象拥有自动存储期（automatic storage duration）</text>
<rect x="80" y="84" width="580" height="26" rx="4" fill="var(--sv-a)"></rect>
<text x="370" y="102" font-size="13" text-anchor="middle" fill="var(--sv-bg)">File a("log.txt")：构造时 fopen，持有句柄</text>
<rect x="150" y="124" width="340" height="82" rx="6" fill="var(--sv-bg)" stroke="var(--sv-b)" stroke-dasharray="5 4"></rect>
<text x="162" y="142" font-size="12" fill="var(--sv-muted)">内层块 { ... }</text>
<rect x="180" y="152" width="280" height="24" rx="4" fill="var(--sv-b)"></rect>
<text x="320" y="169" font-size="12" text-anchor="middle" fill="var(--sv-bg)">std::lock_guard 守卫互斥量</text>
<text x="180" y="196" font-size="12" fill="var(--sv-ink)">离开内层块：先析构守卫，再继续执行</text>
<line x1="80" y1="72" x2="80" y2="208" stroke="var(--sv-a)" stroke-width="2"></line>
<line x1="660" y1="72" x2="660" y2="208" stroke="var(--sv-c)" stroke-width="2"></line>
<text x="80" y="226" font-size="12" text-anchor="middle" fill="var(--sv-a)">① 构造 = 获取</text>
<text x="660" y="226" font-size="12" text-anchor="middle" fill="var(--sv-c)">③ 析构 = 释放</text>
<text x="320" y="226" font-size="12" text-anchor="middle" fill="var(--sv-b)">② 内层对象先析构</text>
<text x="40" y="262" font-size="13" fill="var(--sv-ink)">离开作用域的三条路径，都会触发析构：</text>
<rect x="40" y="274" width="210" height="30" rx="4" fill="var(--sv-a2)"></rect>
<text x="145" y="294" font-size="12" text-anchor="middle" fill="var(--sv-ink)">正常走到作用域末尾</text>
<rect x="40" y="310" width="210" height="30" rx="4" fill="var(--sv-a2)"></rect>
<text x="145" y="330" font-size="12" text-anchor="middle" fill="var(--sv-ink)">return / break / goto 离开</text>
<rect x="40" y="346" width="210" height="28" rx="4" fill="var(--sv-a2)"></rect>
<text x="145" y="365" font-size="12" text-anchor="middle" fill="var(--sv-ink)">throw 触发栈展开</text>
<line x1="258" y1="289" x2="258" y2="360" stroke="var(--sv-line)" stroke-width="2"></line>
<line x1="258" y1="324" x2="690" y2="324" stroke="var(--sv-c)" stroke-width="2" marker-end="url(#raii-a1)"></line>
<text x="470" y="314" font-size="12" text-anchor="middle" fill="var(--sv-c)">三条路径汇入同一个析构函数，无需在每个出口手写释放</text>
</svg>
<figcaption>图 1 · RAII 对象的生命周期。构造发生在对象定义处，析构发生在离开作用域处；内层对象先于外层对象析构，因此本例中锁先于文件释放。三条离开路径最终都指向同一个析构调用。</figcaption>
</figure>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>析构的确定性只覆盖自动存储期对象。std::exit 不析构自动对象（但会析构静态存储期对象并执行 atexit 处理器）；setjmp/longjmp 如果跨越了这样的自动对象——把 setjmp/longjmp 换成 try/throw/catch 会调用其非平凡析构函数——行为未定义；进程被信号杀死或调用 std::terminate 时，栈是否展开由实现决定。RAII 只保证正常与异常控制流，不保证崩溃时收尾。</div></div>
</section>

<section class="sec">
<h2>把一个句柄封装成类型</h2>
<p>写资源封装类只需决定四件事：怎么获取、怎么释放、能否拷贝、能否移动。构造失败的正确做法通常是<b>抛异常</b>：对象没有构造完成，析构函数不会被调用，但已经构造完成的成员会被析构；因此构造函数体里不要留下裸获取的资源，获取要么交给成员，要么在抛出前自行释放。释放失败通常只能记录或忽略，因为析构默认是 noexcept。禁用异常的项目则退化为工厂函数返回 std::optional 或 std::expected（C++23）之类的显式结果。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="资源封装类的结构与构造、析构路径" font-family="inherit">
<defs>
<marker id="raii-a2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-ink)"></path>
</marker>
</defs>
<rect x="36" y="48" width="340" height="316" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<rect x="36" y="48" width="340" height="32" rx="6" fill="var(--sv-a2)"></rect>
<text x="206" y="70" font-size="14" text-anchor="middle" fill="var(--sv-ink)">class File：资源封装类</text>
<text x="50" y="108" font-size="12" fill="var(--sv-muted)">private:</text>
<text x="50" y="130" font-size="12" fill="var(--sv-ink)">std::FILE* fp_;　// 唯一所有权</text>
<text x="50" y="158" font-size="12" fill="var(--sv-muted)">public:</text>
<text x="50" y="180" font-size="12" fill="var(--sv-ink)">explicit File(const char* path, const char* mode)</text>
<text x="50" y="202" font-size="12" fill="var(--sv-ink)">~File();</text>
<text x="50" y="228" font-size="12" fill="var(--sv-c)">File(const File&amp;) = delete;</text>
<text x="50" y="250" font-size="12" fill="var(--sv-c)">File&amp; operator=(const File&amp;) = delete;</text>
<text x="50" y="276" font-size="12" fill="var(--sv-a)">File(File&amp;&amp;) noexcept;</text>
<text x="50" y="298" font-size="12" fill="var(--sv-ink)">std::FILE* get() const noexcept;</text>
<text x="50" y="330" font-size="12" fill="var(--sv-muted)">不变量：fp_ 非空，或为空表示已移动</text>
<text x="50" y="350" font-size="12" fill="var(--sv-muted)">（对象大小与指针宽度取决于 ABI）</text>
<text x="396" y="66" font-size="13" fill="var(--sv-ink)">构造：获取 → 校验 → 进入有效状态</text>
<rect x="396" y="76" width="330" height="28" rx="4" fill="var(--sv-a)"></rect>
<text x="561" y="95" font-size="12" text-anchor="middle" fill="var(--sv-bg)">① std::fopen 获取句柄</text>
<line x1="561" y1="104" x2="561" y2="114" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#raii-a2)"></line>
<rect x="396" y="116" width="330" height="28" rx="4" fill="var(--sv-b)"></rect>
<text x="561" y="135" font-size="12" text-anchor="middle" fill="var(--sv-bg)">② 检查 nullptr，为空则抛异常</text>
<line x1="561" y1="144" x2="561" y2="154" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#raii-a2)"></line>
<rect x="396" y="156" width="330" height="28" rx="4" fill="var(--sv-panel)" stroke="var(--sv-a)"></rect>
<text x="561" y="175" font-size="12" text-anchor="middle" fill="var(--sv-ink)">③ 构造完成，对象可安全使用</text>
<text x="396" y="214" font-size="13" fill="var(--sv-ink)">析构：释放 → 绝不抛出</text>
<rect x="396" y="224" width="330" height="28" rx="4" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="561" y="243" font-size="12" text-anchor="middle" fill="var(--sv-ink)">① 析构函数被调用（含栈展开）</text>
<line x1="561" y1="252" x2="561" y2="262" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#raii-a2)"></line>
<rect x="396" y="264" width="330" height="28" rx="4" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="561" y="283" font-size="12" text-anchor="middle" fill="var(--sv-ink)">② fclose 释放；空句柄直接跳过</text>
<line x1="561" y1="292" x2="561" y2="302" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#raii-a2)"></line>
<rect x="396" y="304" width="330" height="28" rx="4" fill="var(--sv-c)"></rect>
<text x="561" y="323" font-size="12" text-anchor="middle" fill="var(--sv-bg)">③ 析构默认 noexcept，禁止抛出</text>
<text x="396" y="352" font-size="12" fill="var(--sv-muted)">移动后对象进入空状态，析构时做无操作</text>
</svg>
<figcaption>图 2 · 资源封装类的结构。左侧是接口契约：私有句柄、构造获取、析构释放、删除拷贝、提供 noexcept 移动。右侧是两条路径：构造失败抛异常且不留半成品，析构无条件释放且不抛异常。</figcaption>
</figure>
<h3>一个完整可编译的例子</h3>
<p>下面这段代码只需要 C++14 或更高（用到 std::exchange），用 g++ -std=c++20 -Wall 或 clang++ -std=c++20 -Wall 可以直接编译。它把 FILE* 包成 File，并把移动操作写成 noexcept；主函数故意在中途抛异常，用来验证析构仍然执行。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;cstdio&gt;
#include &lt;stdexcept&gt;
#include &lt;utility&gt;

class File {
public:
    explicit File(const char* path, const char* mode = "rb")
        : fp_(std::fopen(path, mode)) {
        if (fp_ == nullptr) throw std::runtime_error("fopen failed");
    }

    ~File() {
        if (fp_ != nullptr) std::fclose(fp_);
    }

    File(const File&amp;) = delete;
    File&amp; operator=(const File&amp;) = delete;

    File(File&amp;&amp; other) noexcept
        : fp_(std::exchange(other.fp_, nullptr)) {}

    File&amp; operator=(File&amp;&amp; other) noexcept {
        if (this != &amp;other) {
            if (fp_ != nullptr) std::fclose(fp_);
            fp_ = std::exchange(other.fp_, nullptr);
        }
        return *this;
    }

    std::FILE* get() const noexcept { return fp_; }

private:
    std::FILE* fp_;
};

int main() {
    try {
        File f("data.bin", "wb");
        std::fprintf(f.get(), "hello\n");
        throw std::runtime_error("mid-way failure");
    } catch (const std::exception&amp; e) {
        std::fprintf(stderr, "caught: %s\n", e.what());
    }
}</code></pre>
<p>这里有几个容易忽略的细节。<b>std::exchange</b>（C++14 起）把源对象的指针取走并置空，一步完成"转移 + 失效"，比手写先赋值再置空更不容易漏。<b>移动赋值要处理自赋值</b>，否则 this 与 other 相同时会先释放再读取。<b>moved-from 对象必须可析构</b>，因为标准库容器搬迁元素后仍会析构源对象；把指针置空、让析构做无操作，是最省事的做法。</p>
<p>多个资源成员时不要手写这五个函数，直接用 RAII 成员，析构、拷贝、移动由编译器生成——这就是 <mark>Rule of Zero</mark>：一个都不写。反过来，一旦因为某个原因必须自己写析构、拷贝或移动中的任何一个，就应该按 Rule of Five 把五个特殊成员函数都审视一遍，避免编译器隐式生成的版本做错事。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>能用标准库类型（std::string、std::vector、std::unique_ptr、std::ifstream）做成员时，优先用它们。自己实现资源类只在"标准库没有对应封装"时才有必要，例如 POSIX fd、数据库连接、CUDA 句柄。这些实现细节在 smart-pointers 一篇中展开，本篇只讨论契约。</div></div>
</section>

<section class="sec">
<h2>异常路径上的栈展开</h2>
<p>抛出异常后，运行时从抛出点向上寻找匹配的 catch。这个被称为<mark>栈展开</mark>（stack unwinding）的过程会逐个退出函数栈帧，析构其中已完整构造的自动对象，顺序与构造相反，从最内层向外。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="异常栈展开路径：从 h 抛出，依次析构 h、g 的局部对象，在 f 的 catch 停止" font-family="inherit">
<defs>
<marker id="raii-a3" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-c)"></path>
</marker>
<marker id="raii-a4" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-muted)"></path>
</marker>
</defs>
<rect x="40" y="40" width="250" height="48" rx="4" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="52" y="60" font-size="13" fill="var(--sv-ink)">main()</text>
<text x="52" y="78" font-size="12" fill="var(--sv-muted)">局部对象等到 main 返回才析构</text>
<rect x="40" y="102" width="250" height="62" rx="4" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-width="2"></rect>
<text x="52" y="122" font-size="13" fill="var(--sv-ink)">f()：try / catch 所在帧</text>
<text x="52" y="140" font-size="12" fill="var(--sv-muted)">File input(...)</text>
<text x="52" y="157" font-size="12" fill="var(--sv-b)">catch 命中后展开停止</text>
<rect x="40" y="178" width="250" height="62" rx="4" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="52" y="198" font-size="13" fill="var(--sv-ink)">g()</text>
<text x="52" y="216" font-size="12" fill="var(--sv-muted)">std::lock_guard 守卫</text>
<text x="52" y="233" font-size="12" fill="var(--sv-a)">栈展开时解锁</text>
<rect x="40" y="254" width="250" height="62" rx="4" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="52" y="274" font-size="13" fill="var(--sv-ink)">h()</text>
<text x="52" y="292" font-size="12" fill="var(--sv-muted)">throw std::runtime_error</text>
<text x="52" y="309" font-size="12" fill="var(--sv-a)">栈展开时关闭文件</text>
<rect x="330" y="270" width="290" height="34" rx="4" fill="var(--sv-c)"></rect>
<text x="475" y="292" font-size="12" text-anchor="middle" fill="var(--sv-bg)">① 抛出点：h 的局部对象析构</text>
<line x1="330" y1="287" x2="296" y2="287" stroke="var(--sv-c)" stroke-width="2" marker-end="url(#raii-a3)"></line>
<rect x="330" y="196" width="290" height="34" rx="4" fill="var(--sv-c)"></rect>
<text x="475" y="218" font-size="12" text-anchor="middle" fill="var(--sv-bg)">② g 的栈帧退出，守卫解锁</text>
<line x1="330" y1="210" x2="296" y2="210" stroke="var(--sv-c)" stroke-width="2" marker-end="url(#raii-a3)"></line>
<rect x="330" y="120" width="290" height="34" rx="4" fill="var(--sv-b)"></rect>
<text x="475" y="142" font-size="12" text-anchor="middle" fill="var(--sv-bg)">③ 到达 f 的 catch：停止展开</text>
<line x1="330" y1="134" x2="296" y2="134" stroke="var(--sv-b)" stroke-width="2" marker-end="url(#raii-a4)"></line>
<text x="475" y="182" font-size="12" fill="var(--sv-muted)">f 与 main 中已构造的对象继续存活，</text>
<text x="475" y="248" font-size="12" fill="var(--sv-muted)">直到各自离开作用域时再析构。</text>
<line x1="700" y1="300" x2="700" y2="70" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="4 4"></line>
<text x="712" y="190" font-size="12" fill="var(--sv-muted)" transform="rotate(-90 712 190)">栈展开方向</text>
</svg>
<figcaption>图 3 · 异常栈展开路径。异常从 h 抛出后，h 与 g 中已构造的局部对象按逆序析构，锁被释放、文件被关闭；到达 f 的 catch 后展开停止，f 与 main 的局部对象不会被析构，而是等各自作用域结束。</figcaption>
</figure>
<h3>构造函数抛异常时会发生什么</h3>
<p>这是最容易被误解的一点。如果构造函数抛出异常，对象本身没有构造完成，析构函数<b>不会</b>被调用；但已经构造完成的基类与成员子对象会被析构。因此，用成员对象持有资源是安全的，而在构造函数体内裸调用 new 或 fopen、之后才抛异常，就会泄漏。这里有一个常被忽略的例外：委托构造中，一旦目标构造函数完成，对象就已被视为构造完成；如果委托者的函数体随后抛出，析构函数仍会被调用。</p>
<pre class="code" data-lang="cpp"><code>// 示意：对比构造失败时的两种写法
class Bad {
public:
    Bad() {
        fp_ = std::fopen("x", "r");   // 已获取
        throw std::runtime_error("boom");  // 泄漏：~Bad 不会执行
    }
    ~Bad() { if (fp_ != nullptr) std::fclose(fp_); }
private:
    std::FILE* fp_;
};

class Good {
public:
    Good() : file_("x", "r") {        // 成员先构造
        throw std::runtime_error("boom");
    }                                  // 展开时 ~File 正常执行
private:
    File file_;
};</code></pre>
<p>结论很直接：<mark>资源应当作为成员，由成员的析构负责释放</mark>。构造函数体只做不会留下裸资源的初始化。若确实需要在构造体内获取多个资源，就按获取顺序交给 RAII 成员。构造函数上的函数 try block 也能捕获成员初始化列表与构造体内的异常，但它只能用于记录或转换异常——处理器结束时异常会自动重抛，不能把构造失败的对象"救活"，所以它通常说明设计还可以再简化。</p>
<h3>异常安全保证</h3>
<p>RAII 解决的是"不泄漏"，但一个操作失败后对象处于什么状态，是另一个问题。Dave Abrahams 提出的正式保证有三档（不抛、强、基本），工程上常把"什么都不承诺"补成第四档：</p>
<ul>
<li><b>不抛保证</b>（nothrow）：承诺不抛异常。析构与 swap 通常应提供，移动构造也宜标为 noexcept；标准库据此决定容器扩容用移动还是拷贝（例如 vector 扩容走 move_if_noexcept）。</li>
<li><b>强保证</b>（strong）：失败则回滚，对象保持调用前状态，即 commit-or-rollback；典型实现是先构造副本，成功后再 swap。</li>
<li><b>基本保证</b>（basic）：失败后没有泄漏，对象仍可析构，不变量仍成立，但状态可能改变。</li>
<li><b>无保证</b>：不承诺任何事。工程代码中不应接受这一档。</li>
</ul>
<div class="formula">析构安全：~T() noexcept 且不抛
构造安全：失败 → 已构造的成员/基类逆序析构 → 对象不存在
赋值安全：强保证的通用手法 = 拷贝构造 + swap（swap 必须 noexcept）</div>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>析构中不要抛异常。C++11 起析构函数隐式为 noexcept(true)，除非某个成员或基类的析构可能抛出、或显式写了 noexcept(false)；异常一旦逸出析构，就会调用 std::terminate。若在栈展开时抛出第二个异常，同样立即 terminate，而且通常拿不到有用的错误信息。释放失败（如 fclose 返回 EOF）只能记录日志或设置状态位。</div></div>
</section>

<section class="sec">
<h2>标准库里的 RAII 与作用域守卫</h2>
<p>标准库大量使用 RAII。认识这些类型比记住实现更重要，因为误用通常不是编译错误，而是逻辑错误。</p>
<h3>锁：lock_guard、unique_lock、scoped_lock</h3>
<ul>
<li><b>std::lock_guard</b>（C++11，&lt;mutex&gt;）：构造时加锁、析构时解锁，不可拷贝也不可移动。适用于"进入作用域就锁、离开就放"的最简单场景，通常也是三者中最轻的。</li>
<li><b>std::unique_lock</b>（C++11）：可移动，支持延迟加锁（std::defer_lock）、尝试加锁（std::try_to_lock）、手动 unlock 与 relock，并能与 std::condition_variable 配合。典型实现比 lock_guard 多存一个"是否持有锁"的标志位，因此略重，具体开销由实现决定。</li>
<li><b>std::scoped_lock</b>（C++17）：可变参数版本，一次锁多个互斥量并使用避免死锁的算法，是 C++17 之后多锁场景的首选。</li>
</ul>
<p>选择规则：单个锁且不提前释放用 lock_guard；需要条件变量或中途解锁用 unique_lock；同时锁多个用 scoped_lock。不要在持锁时调用未知代码，对方可能反向加锁形成死锁；确实需要就先把数据拷出来、解锁再处理。</p>
<h3>文件与线程</h3>
<p>std::ifstream、std::ofstream、std::fstream（C++98 起）在析构时关闭文件，是文件 RAII 的标准答案。它们还负责缓冲区刷新，所以流对象正常析构时通常不丢数据；如果刷新失败，通常会置位 failbit，若流开启了异常掩码则可能抛异常，而该异常发生在析构中就会变成 terminate。进程异常终止时缓冲区仍可能丢失。<b>std::jthread</b>（C++20）在析构时请求停止并 join，把线程必须 join 或 detach 的规则也纳入了 RAII。</p>
<h3>自写作用域守卫</h3>
<p>当清理动作不属于任何现成类型时，可以写一个通用的作用域守卫（scope guard）：构造时保存一个可调用对象，析构时执行它。下面是最小实现，属于示意，够用但省略了移动语义。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;cstdio&gt;
#include &lt;utility&gt;

template &lt;typename F&gt;
class ScopeExit {
public:
    explicit ScopeExit(F f) noexcept : f_(std::move(f)) {}
    ~ScopeExit() { if (active_) f_(); }

    ScopeExit(const ScopeExit&amp;) = delete;
    ScopeExit&amp; operator=(const ScopeExit&amp;) = delete;

    void dismiss() noexcept { active_ = false; }

private:
    F f_;
    bool active_ = true;
};

void demo() {
    std::FILE* fp = std::fopen("x", "r");
    if (fp == nullptr) return;                   // 打开失败，没有资源需要守
    ScopeExit guard([fp] { std::fclose(fp); });  // C++17 起 CTAD 推导 F
    // ... 任意 return 或抛出，fclose 都会执行
}</code></pre>
<p>真实项目里更完整的版本会区分"成功才执行"与"失败才执行"两类守卫：两者都借助 std::uncaught_exceptions()（C++17 新增；旧的 uncaught_exception() 在 C++17 弃用、C++20 移除）与构造时保存的计数比较，失败守卫在计数增加（正在展开）时执行，成功守卫在计数未增加时执行。标准库侧，P0052 提出的 std::scope_exit、std::scope_fail、std::scope_success 目前落在 Library Fundamentals TS v3（即 std::experimental::scope_exit 等），C++23 的正式标准里还没有它们，是否进入后续版本应以最终发布的标准文本为准。自己实现时要注意：守卫不可拷贝；本示例干脆不提供移动，若你为它实现移动，必须让源对象失效，否则会重复执行清理。构造函数声明 noexcept 的前提是 F 的移动构造不抛（捕获指针的 lambda 满足这一点）；本类的析构通常是 noexcept，f_() 一旦抛出就会 terminate，所以清理动作本身必须 nothrow。</p>
</section>

<section class="sec">
<h2>与 GC 的对比，以及所有权建模</h2>
<p>有 GC 的语言常被认为"不需要 RAII"，这不准确。GC 回收的是内存，而内存只是资源的一种；文件、锁、套接字、连接都不在 GC 管理范围内。Java 的 try-with-resources、Python 的 with、C# 的 using，本质上都是把作用域结束时释放显式化，与 RAII 是同一思想。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="RAII 与 GC 的资源占用时间线对比" font-family="inherit">
<defs>
<marker id="raii-a5" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-muted)"></path>
</marker>
</defs>
<text x="40" y="34" font-size="14" fill="var(--sv-ink)">RAII：作用域结束即归还，占用曲线与作用域同形</text>
<line x1="70" y1="175" x2="720" y2="175" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#raii-a5)"></line>
<line x1="70" y1="175" x2="70" y2="60" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#raii-a5)"></line>
<text x="40" y="120" font-size="12" fill="var(--sv-muted)" transform="rotate(-90 40 120)">未释放资源数</text>
<text x="110" y="192" font-size="12" text-anchor="middle" fill="var(--sv-muted)">作用域 A 开始</text>
<text x="250" y="192" font-size="12" text-anchor="middle" fill="var(--sv-muted)">A 结束</text>
<text x="300" y="192" font-size="12" text-anchor="middle" fill="var(--sv-muted)">B 开始</text>
<text x="440" y="192" font-size="12" text-anchor="middle" fill="var(--sv-muted)">B 结束</text>
<polyline points="70,175 110,175 110,130 250,130 250,175 300,175 300,130 440,130 440,175 720,175" fill="none" stroke="var(--sv-a)" stroke-width="2.5"></polyline>
<text x="180" y="120" font-size="12" text-anchor="middle" fill="var(--sv-a)">保持 1 个文件句柄</text>
<text x="560" y="150" font-size="12" fill="var(--sv-muted)">峰值 = 1，随时可预测</text>
<text x="40" y="228" font-size="14" fill="var(--sv-ink)">GC：回收时机不确定，资源可能积压到下一次回收</text>
<line x1="70" y1="335" x2="720" y2="335" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#raii-a5)"></line>
<line x1="70" y1="335" x2="70" y2="240" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#raii-a5)"></line>
<text x="40" y="290" font-size="12" fill="var(--sv-muted)" transform="rotate(-90 40 290)">未释放资源数</text>
<polyline points="70,335 110,335 110,315 180,315 180,295 260,295 260,275 350,275 350,255 440,255 440,235 560,235 560,315 720,315" fill="none" stroke="var(--sv-c)" stroke-width="2.5"></polyline>
<line x1="560" y1="240" x2="560" y2="335" stroke="var(--sv-c)" stroke-width="1.5" stroke-dasharray="5 4"></line>
<text x="560" y="352" font-size="12" text-anchor="middle" fill="var(--sv-c)">GC 恰好在此时运行</text>
<text x="300" y="252" font-size="12" text-anchor="middle" fill="var(--sv-c)">峰值可达 5，且时刻不确定</text>
<text x="600" y="300" font-size="12" fill="var(--sv-muted)">一个对象仍被引用</text>
<text x="690" y="364" font-size="12" text-anchor="middle" fill="var(--sv-muted)">时间</text>
</svg>
<figcaption>图 4 · 两种回收策略的资源占用曲线。RAII 的释放点由作用域边界决定，峰值可静态推算；GC 的回收时机由运行时决定，句柄类资源可能在回收前就耗尽。GC 语言用 try-with-resources 等语法补上确定性释放。</figcaption>
</figure>
<div class="duo"><div class="duo__col"><h4>RAII 的取舍</h4><p>释放时机确定，能管理任意资源，不需要 GC 或引用计数那样的运行时簿记；代价是要求把资源交给对象，且对象生命周期必须覆盖使用期。</p></div><div class="duo__col"><h4>GC 的取舍</h4><p>内存回收无需关心，循环引用可由追踪算法处理，开发体验简单；代价是回收时机不确定、有暂停与额外内存开销，且 GC 本身无法确定性管理锁、连接等非内存资源。</p></div></div>
<h3>用类型表达所有权</h3>
<p>RAII 的另一半价值是<b>所有权建模</b>：让"谁负责释放"这件事从注释变成类型信息。C++11 之后，常见表达有三种：<b>std::unique_ptr</b> 表示独占所有权，不可拷贝、可移动；在默认删除器下通常与裸指针同大小，也没有额外的运行时开销。<b>std::shared_ptr</b> 表示共享所有权，强引用计数归零时销毁所管理的对象；典型实现用原子计数加控制块，通常带来额外的分配与同步开销。裸指针与引用表示<b>非拥有</b>的借用，调用方不负责释放。</p>
<p>工程上的默认选择是 unique_ptr：工厂函数返回 unique_ptr，接口参数用引用表达借用，只在确实需要共享生命周期时才用 shared_ptr，否则所有权会变得模糊，还会引入循环引用与计数开销。实现细节留给 smart-pointers 一篇。</p>
<h3>常见误区与排障清单</h3>
<ul>
<li><b>以为析构一定会跑</b>：std::exit、longjmp、未捕获异常的 terminate、信号杀死进程，都不保证析构执行。必须持久化的数据要显式 flush 或提交。</li>
<li><b>在析构里做可能抛出的操作</b>：日志、网络上报、加锁都可能抛，直接 terminate。要么吞掉异常，要么移到显式的 close() 中。</li>
<li><b>析构顺序依赖</b>：成员按声明逆序析构。若 A 的析构要用 B，B 必须声明在 A 之前（B 先构造、后析构，A 析构时 B 还活着）；更稳妥的是不建立这种依赖。</li>
<li><b>锁守卫的作用域过长</b>：lock_guard 应尽量短；把锁持有到整个函数结束，常是死锁与性能问题的根源。</li>
<li><b>资源类忘记删除拷贝</b>：默认拷贝会复制句柄，两个对象析构同一资源，即双重释放。资源类默认应删除拷贝，需要复制时明确实现深拷贝或引用计数。</li>
<li><b>moved-from 对象仍被使用</b>：对标准库类型，移动后源对象处于有效但未指定的状态，只能析构或重新赋值；自定义类型若未额外承诺，也应当遵循同样的约定。不要假设源对象的句柄仍然有效。</li>
</ul>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>排查泄漏时先按资源类型分类：fd 用 lsof 或 /proc/self/fd 观察，锁问题看线程栈是否卡在 lock，内存问题用 ASan 或 valgrind。RAII 代码的泄漏通常只有两个来源：资源没有交给对象，或对象被 new 出来却没人 delete。</div></div>
</section>

<section class="sec">
<h2>自测与延伸阅读</h2>
<h3>自测</h3>
<details class="quiz"><summary>Q1 · 构造函数抛出异常时，对象自己的析构函数会被调用吗？已经获取的资源怎么办？</summary><div class="quiz__a">通常不会。对象没有构造完成，析构函数不会被调用（委托构造等特殊情况除外）。但已经完整构造的基类与成员子对象会按逆序析构，所以把资源放进成员对象是安全的。若在构造函数体内裸调用 fopen 后再抛异常，该句柄没有任何人负责释放，会泄漏；正确做法是用 File 这样的成员封装，或让构造函数只做不会失败的操作。</div></details>
<details class="quiz"><summary>Q2 · 一个函数里既要锁住互斥量，又要在临界区中途解锁去做耗时 IO，应该用 lock_guard 还是 unique_lock？</summary><div class="quiz__a">用 std::unique_lock。lock_guard 只能在析构时解锁，无法中途 unlock；unique_lock 提供 unlock、lock、owns_lock 等接口，可以与条件变量配合，也支持 defer_lock 延后加锁。如果只是进入作用域就锁、离开就放，lock_guard 更轻；同时锁多个互斥量则用 C++17 的 scoped_lock。</div></details>
<details class="quiz"><summary>Q3 · 为什么资源管理类的析构函数里不能抛异常？如果在栈展开过程中抛出会怎样？</summary><div class="quiz__a">C++11 起析构函数隐式为 noexcept（除非某个成员或基类的析构可能抛出，或显式声明 noexcept(false)），异常一旦逸出就调用 std::terminate。如果析构发生在栈展开过程中，此时已有异常在传播，再抛出第二个异常同样触发 terminate，而且程序不会得到有意义的错误信息。因此析构中的释放失败只能记录日志或设置状态位，不能向外抛。</div></details>
<details class="quiz"><summary>Q4 · 一个类持有 FILE*，默认生成的拷贝构造函数会带来什么问题？应该怎么处理？</summary><div class="quiz__a">默认拷贝按成员复制，指针成员只是浅拷贝指针值，于是两个 File 对象指向同一个 FILE*，各自析构时都会调用 fclose，造成双重释放，行为未定义。正确做法是删除拷贝构造与拷贝赋值，并提供 noexcept 的移动构造与移动赋值，用 std::exchange 把源指针置空，使 moved-from 对象析构时安全地什么都不做。</div></details>
<h3>延伸阅读</h3>
<ul class="refs">
<li><b>cppreference: RAII</b> — cppreference.com。对 RAII 的定义、典型用法与常见资源类型的简明参考，适合随时回查术语。</li>
<li><b>C++ Core Guidelines, R.1–R.5</b> — Bjarne Stroustrup、Herb Sutter。资源管理规则组：用 RAII 自动管理资源、裸指针只表示单个对象且为非拥有、裸引用也为非拥有、优先使用作用域对象而非不必要的堆分配。与本篇"把一个句柄封装成类型"和"用类型表达所有权"两节直接对应。</li>
<li><b>Effective C++（第 3 版）条款 13、14</b> — Scott Meyers, Addison-Wesley, 2005。条款 13 讲用对象管理资源，条款 14 讲资源管理类的拷贝行为，是资源封装类设计最经典的讨论。</li>
<li><b>ISO/IEC 14882:2020（C++20）[except.ctor] 与 [basic.stc]</b> — ISO/IEC。栈展开时对象析构、自动存储期对象生存期的规范条文，用于核对本文关于"析构必然发生"的边界。</li>
<li><b>cppreference: std::lock_guard、std::unique_lock、std::scoped_lock</b> — cppreference.com。三种锁守卫的接口、构造参数与移动性差异，选择时以此为准。</li>
</ul>
</section>`
};
