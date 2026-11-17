window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["cpp-map"] = {
  slug: "cpp-map",
  title: "C++ 全景与学习路线",
  subtitle: "从语言、标准库到工具链的一张地图",
  level: 0,
  cluster: "全景",
  tags: ["概览", "零开销抽象", "学习路线"],
  summary: "把 C++ 拆成核心语言、标准库、工具链与生态四块，讲清编译模型、零开销抽象、值语义与 RAII 如何串成一条主线，并给出七层学习路线。",
  keyPoints: [
    "C++ 由核心语言、标准库、工具链与生态四部分组成，四者边界清楚，排障时才不会归错因。",
    "分离编译与翻译单元决定了头文件、模板定义位置、ODR 与重编译范围这些日常现象。",
    "零开销抽象不是“没有成本”，而是不用不付费、用了不比手写差；抽象自身的代价主要在编译期与代码体积，运行时成本要具体测量。",
    "RAII 把资源生命周期绑定到对象生命周期，是 C++ 没有垃圾回收仍能安全管理资源的根本机制。",
    "七层路线以“能解释、能动手、能排障”为过关标准，而不是以读完为标准。"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>定位：C++ 的四个组成部分</h2>
<p>先给一句直觉：C++ 是一门坚持“你写的抽象，最终应当和手写底层代码一样快”的语言。它同时给你两样通常互斥的东西——类、模板、泛型算法这样的高层抽象，以及对内存布局、对象生命周期和指令生成的控制权。理解 C++，本质上就是理解这两者如何在同一份代码里共存。</p>
<p>更实用的划分是四个组成部分。<b>核心语言（core language）</b>规定类型、对象、表达式、函数、类、模板、异常与内存模型的语义；<b>标准库（standard library）</b>在此之上提供容器、算法、字符串、文件、时间、线程与范围库等设施；<b>工具链（toolchain）</b>包括预处理器、编译器、链接器、调试器与检查工具，决定源码如何变成二进制；<b>生态（ecosystem）</b>则是构建系统、包管理器、测试框架与第三方库。四块边界清楚，排障才不会归错因。</p>
<p>四块的学习节奏不同：核心语言与标准库是长期资产，工具链靠熟练度，生态按项目现学。很多人卡住不是因为语法难，而是把四块混成一团：链接失败时改语法，运行崩溃时猜标准库实现。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>C++ 不是“带类的 C”，也不是“模板的集合”。它是一套关于值、生命周期与零开销的约定，语法只是表面。</div></div>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="C++ 的语言与生态分层：核心语言、标准库、生态与工具链">
<defs><marker id="cpp-map-arrow-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-muted)"></path></marker></defs>
<text x="40" y="24" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">语言与库</text>
<text x="470" y="24" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">工具链</text>
<rect x="40" y="36" width="380" height="78" rx="6" fill="var(--sv-a)"></rect>
<text x="56" y="60" font-size="14" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">生态（ecosystem）</text>
<text x="56" y="82" font-size="12" font-family="inherit" fill="var(--sv-ink)">框架 · 包管理（vcpkg/Conan） · 构建（CMake）</text>
<text x="56" y="102" font-size="12" font-family="inherit" fill="var(--sv-muted)">组织、依赖与交付代码</text>
<rect x="40" y="126" width="380" height="78" rx="6" fill="var(--sv-b)"></rect>
<text x="56" y="150" font-size="14" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">标准库（standard library）</text>
<text x="56" y="172" font-size="12" font-family="inherit" fill="var(--sv-ink)">容器 · 算法 · 字符串 · 文件 · 时间 · 线程 · ranges</text>
<text x="56" y="192" font-size="12" font-family="inherit" fill="var(--sv-muted)">提供可移植的通用抽象</text>
<rect x="40" y="216" width="380" height="86" rx="6" fill="var(--sv-c)"></rect>
<text x="56" y="240" font-size="14" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">核心语言（core language）</text>
<text x="56" y="262" font-size="12" font-family="inherit" fill="var(--sv-ink)">类型系统 · 对象模型 · 模板 · 异常 · 内存模型</text>
<text x="56" y="284" font-size="12" font-family="inherit" fill="var(--sv-muted)">规定语义与可观察行为，布局细节多由实现与 ABI 决定</text>
<text x="40" y="330" font-size="12" font-family="inherit" fill="var(--sv-muted)">同一份源码，在不同 ABI 与标准库上编译出不同二进制</text>
<rect x="470" y="36" width="250" height="56" rx="6" fill="var(--sv-a2)"></rect>
<text x="484" y="59" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">前端与预处理</text>
<text x="484" y="79" font-size="12" font-family="inherit" fill="var(--sv-muted)">预处理 · 词法 · 语法 · 语义检查</text>
<path d="M595,92 L595,108" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#cpp-map-arrow-a)"></path>
<rect x="470" y="112" width="250" height="56" rx="6" fill="var(--sv-b2)"></rect>
<text x="484" y="135" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">优化器与后端</text>
<text x="484" y="155" font-size="12" font-family="inherit" fill="var(--sv-muted)">IR 优化 · 寄存器分配 · 生成汇编</text>
<path d="M595,168 L595,184" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#cpp-map-arrow-a)"></path>
<rect x="470" y="188" width="250" height="56" rx="6" fill="var(--sv-a2)"></rect>
<text x="484" y="211" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">链接器</text>
<text x="484" y="231" font-size="12" font-family="inherit" fill="var(--sv-muted)">符号解析 · 重定位 · 库顺序</text>
<path d="M595,244 L595,260" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#cpp-map-arrow-a)"></path>
<rect x="470" y="264" width="250" height="62" rx="6" fill="var(--sv-b2)"></rect>
<text x="484" y="287" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">调试与检查</text>
<text x="484" y="307" font-size="12" font-family="inherit" fill="var(--sv-muted)">调试器 · Sanitizer · 静态分析</text>
<text x="470" y="346" font-size="12" font-family="inherit" fill="var(--sv-muted)">工具链版本决定可用标准与诊断能力</text>
</svg>
<figcaption>图 1 · 语言、标准库、生态与工具链是四块不同的东西</figcaption>
</figure>
</section>

<section class="sec">
<h2>编译模型鸟瞰：从源码到进程</h2>
<p>编译模型是第二块地基。C++ 沿用 C 的分离编译（separate compilation）：编译器一次只处理一个<b>翻译单元（translation unit, TU）</b>，即一个源文件加上它递归包含的头文件。预处理展开宏与头文件，每个单元独立编译成目标文件，最后由链接器把符号拼成可执行文件或共享库。C++20 modules 改变了“头文件被文本包含”的方式，但按单元编译、按符号链接的基本结构没有变。</p>
<p>为什么模板定义通常放头文件？因为实例化发生在使用它的翻译单元内，编译器必须看见完整定义才能生成代码。为什么同名非 inline 函数会在链接期报重复定义？因为非 inline、具有外部链接的函数在整个程序中只允许一个定义；而 inline 函数、模板与类定义允许出现在多个翻译单元里，但每一份必须逐 token 相同、名称查找结果一致，否则违反 ODR，行为未定义。为什么改了头文件会触发大范围重编译？因为每个包含它的翻译单元都要重新编译。头文件不是模块，它只是文本粘贴。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="从源码到进程的编译流水线：预处理、编译、汇编、链接与加载">
<defs><marker id="cpp-map-arrow-b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-muted)"></path></marker></defs>
<rect x="30" y="42" width="120" height="62" rx="6" fill="var(--sv-a)"></rect>
<text x="90" y="66" text-anchor="middle" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">源码文件</text>
<text x="90" y="86" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">.cpp .hpp .ixx</text>
<path d="M150,73 L166,73" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#cpp-map-arrow-b)"></path>
<rect x="170" y="42" width="120" height="62" rx="6" fill="var(--sv-b)"></rect>
<text x="230" y="66" text-anchor="middle" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">预处理</text>
<text x="230" y="86" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">展开头文件与宏</text>
<path d="M290,73 L306,73" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#cpp-map-arrow-b)"></path>
<rect x="310" y="42" width="120" height="62" rx="6" fill="var(--sv-c)"></rect>
<text x="370" y="66" text-anchor="middle" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">翻译单元</text>
<text x="370" y="86" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">自包含的文本</text>
<path d="M430,73 L446,73" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#cpp-map-arrow-b)"></path>
<rect x="450" y="42" width="120" height="62" rx="6" fill="var(--sv-a2)"></rect>
<text x="510" y="66" text-anchor="middle" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">编译与汇编</text>
<text x="510" y="86" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">语义检查 · 生成机器码</text>
<path d="M570,73 L586,73" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#cpp-map-arrow-b)"></path>
<rect x="590" y="42" width="130" height="62" rx="6" fill="var(--sv-b2)"></rect>
<text x="655" y="66" text-anchor="middle" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">目标文件</text>
<text x="655" y="86" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">.o / .obj，含符号表</text>
<text x="40" y="126" font-size="12" font-family="inherit" fill="var(--sv-muted)">每个单元独立编译，只通过声明与符号相连</text>
<path d="M655,104 L655,156 L90,156 L90,196" stroke="var(--sv-line)" stroke-width="1.5" fill="none" marker-end="url(#cpp-map-arrow-b)"></path>
<rect x="30" y="200" width="120" height="62" rx="6" fill="var(--sv-a2)"></rect>
<text x="90" y="224" text-anchor="middle" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">目标文件与库</text>
<text x="90" y="244" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">静态库 / 共享库</text>
<path d="M150,231 L166,231" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#cpp-map-arrow-b)"></path>
<rect x="170" y="200" width="120" height="62" rx="6" fill="var(--sv-b2)"></rect>
<text x="230" y="224" text-anchor="middle" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">链接</text>
<text x="230" y="244" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">符号解析 · 重定位</text>
<path d="M290,231 L306,231" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#cpp-map-arrow-b)"></path>
<rect x="310" y="200" width="120" height="62" rx="6" fill="var(--sv-a)"></rect>
<text x="370" y="224" text-anchor="middle" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">可执行文件</text>
<text x="370" y="244" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">ELF / PE / Mach-O</text>
<path d="M430,231 L446,231" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#cpp-map-arrow-b)"></path>
<rect x="450" y="200" width="120" height="62" rx="6" fill="var(--sv-b)"></rect>
<text x="510" y="224" text-anchor="middle" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">加载</text>
<text x="510" y="244" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">动态链接 · 映射段</text>
<path d="M570,231 L586,231" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#cpp-map-arrow-b)"></path>
<rect x="590" y="200" width="130" height="62" rx="6" fill="var(--sv-c)"></rect>
<text x="655" y="224" text-anchor="middle" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">进程</text>
<text x="655" y="244" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">代码 · 数据 · 堆 · 栈</text>
<text x="40" y="296" font-size="12" font-family="inherit" fill="var(--sv-ink)">错误分界：</text>
<rect x="120" y="280" width="180" height="24" rx="4" fill="var(--sv-a)"></rect>
<text x="210" y="297" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">编译期：语法 / 类型 / 模板</text>
<rect x="312" y="280" width="170" height="24" rx="4" fill="var(--sv-b)"></rect>
<text x="397" y="297" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">链接期：符号 / ODR</text>
<rect x="494" y="280" width="226" height="24" rx="4" fill="var(--sv-c)"></rect>
<text x="607" y="297" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">运行期：未定义行为 / 逻辑错误</text>
<text x="40" y="342" font-size="12" font-family="inherit" fill="var(--sv-muted)">先判断错误出在哪一阶段，再看编译器、链接器还是调试器</text>
</svg>
<figcaption>图 2 · 从源码到进程：每个阶段都有自己的输入输出与典型错误</figcaption>
</figure>
<p>工具链版本决定你能用哪些标准特性。以近几年的 GCC、Clang、MSVC 为例，C++20 的主要语言与库特性基本可用，但 modules 的构建集成仍因编译器而异；C++23 的库特性则要看具体版本与标准库实现。需要记住：编译器与标准库可以独立演进，Clang 既能搭配 libstdc++ 也能搭配 libc++，两者版本不一致时，语言特性与库设施的可用程度就会错位。不要假设编译器够新就等于标准库齐全。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>阶段</th><th>输入</th><th>输出</th><th>常见问题</th></tr></thead>
<tbody>
<tr><td>预处理</td><td>源文件与头文件</td><td>展开后的翻译单元</td><td>头文件路径、宏污染、重复包含</td></tr>
<tr><td>编译</td><td>翻译单元</td><td>汇编代码（.s），或由集成汇编器直接生成目标文件</td><td>类型错误、模板实例化失败、缺少定义</td></tr>
<tr><td>汇编</td><td>汇编代码</td><td>目标文件（含符号与重定位信息）</td><td>内联汇编约束错误、目标架构不匹配</td></tr>
<tr><td>链接</td><td>多个目标文件与库</td><td>可执行文件或共享库</td><td>未定义引用、重复定义、库顺序错误</td></tr>
</tbody>
</table></div>
<pre class="code" data-lang="bash"><code>g++ -std=c++20 -Wall -Wextra -Wpedantic -O2 main.cpp -o mean
# MSVC: cl /std:c++20 /W4 /EHsc main.cpp</code></pre>
<p>标准版本、警告等级、优化等级是三个独立开关；调试与发布构建应共用同一组警告。对没有未定义行为的程序，优化等级不应改变可观察语义（浮点收缩、<code>-ffast-math</code> 等非标准优化选项是例外）；但对含有未定义行为的程序，优化等级会改变“看起来是否正常”的结果，所以调试构建应优先配 Sanitizer。</p>
<p>本节只保留定位错误所需的分界；流水线每一级的产物（.ii、.s、.o）、目标文件的符号与重定位、静态与动态链接的差异，详见《从源码到进程》一篇。</p>
</section>

<section class="sec">
<h2>零开销抽象与值语义</h2>
<p>零开销抽象（zero-overhead abstraction）常被误读成“抽象没有成本”。这一表述通常归于 Bjarne Stroustrup，原意有两条：不用的东西不付运行时代价；用了的不比手写等价代码差。前一条排除了强制装箱与运行时反射这类“不用也得付”的机制；后一条要求编译器把类、模板与内联消解成与手写循环同级的机器码，把抽象自身的成本尽量转移到编译期。</p>
<p>与之配套的是值语义（value semantics）：变量默认就是一个独立的值，赋值与传参默认产生副本，副本与原对象互不影响。需要共享时，必须显式用指针、引用或智能指针表达引用语义（reference semantics）。这条默认规则让“谁拥有、谁释放”在类型层面可见。C++11 引入的移动语义（move semantics）进一步把“复制一份”细化为“能偷资源就偷”，让无法消除拷贝的按值操作仍有廉价路径。但要说清因果：按值返回局部对象时，编译器本来就可以做返回值优化（NRVO），C++17 起对返回纯右值等情形更是强制复制消除（guaranteed copy elision）；移动语义是消除不适用时的兜底，并不是“按值返回变快”的唯一原因。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;iostream&gt;
#include &lt;span&gt;
#include &lt;vector&gt;
#include &lt;concepts&gt;
#include &lt;numeric&gt;
#include &lt;cstddef&gt;

template &lt;std::floating_point T&gt;
T mean(std::span&lt;const T&gt; xs) {
    if (xs.empty()) return T{};
    return std::accumulate(xs.begin(), xs.end(), T{}) / static_cast&lt;T&gt;(xs.size());
}

struct Buffer {
    std::vector&lt;double&gt; data;
    explicit Buffer(std::size_t n) : data(n, 0.0) {}
};

int main() {
    Buffer b{5};
    for (std::size_t i = 0; i &lt; b.data.size(); ++i)
        b.data[i] = static_cast&lt;double&gt;(i + 1);
    std::cout &lt;&lt; mean&lt;double&gt;(b.data) &lt;&lt; '\n';  // 输出 3
}</code></pre>
<p>注意示例里的所有权：<code>Buffer</code> 按值持有 vector，<code>std::span</code> 只观察不拥有，返回值是值。代码里没有显式 <code>new</code>、虚函数与引用计数，抽象层没有引入额外的间接调用；但 vector 仍会在堆上分配，零开销不等于零分配。这就是“值语义加零开销”的典型形态：用 concepts 约束类型，用 span 表达视图，用容器管理内存。</p>
<div class="formula">零开销抽象的判据：
  未使用的特性 → 生成代码中不出现       （不为不需要的东西付费）
  已使用的抽象 → 机器码不劣于手写等价实现（不为抽象额外付费）
  真实成本 = 编译时间 + 代码体积 + 可读性权衡；运行时开销需以生成代码与测量为准</div>
<p>这条判据是设计目标，不是标准条款。虚函数分发、<code>std::function</code> 的类型擦除与可能的堆分配都有真实运行时成本；异常处理在常见实现中采用表驱动，正常路径几乎没有运行时开销，代价是二进制体积增加与抛出时的展开成本。这些都不是反例，而是显式选择的能力。判断是否零开销应看汇编或基准测试。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>视图不拥有数据。<code>std::span</code>、<code>std::string_view</code> 是非拥有视图，通常只保存指针与长度（具体表示由实现决定）；底层对象一旦销毁或容器重新分配，视图立刻悬垂。把指向局部对象的视图返回出去，本身通常不会当场崩溃，但调用方一旦通过它读写，就是未定义行为（undefined behavior, UB）；编译器通常不会为此报错。</div></div>
</section>

<section class="sec">
<h2>RAII：资源管理的主线</h2>
<p>如果说零开销回答“抽象贵不贵”，RAII 回答的是“资源由谁负责”。资源获取即初始化（Resource Acquisition Is Initialization, RAII）把资源的生命周期绑定到对象生命周期：构造函数获取资源，析构函数释放资源。自动对象离开作用域时会被析构：正常返回、提前 return、break、continue 与异常栈展开（stack unwinding）都会执行析构。这是 C++ 没有垃圾回收却仍能安全管理内存、文件、锁与套接字的根本机制。例外是程序被 <code>std::exit</code>、<code>std::abort</code> 等直接终止：此时自动对象不会析构，其中 <code>std::abort</code> 连静态存储期对象的析构也不保证。</p>
<p>RAII 的价值在于把“配对操作”变成类型不变量。<code>new/delete</code>、<code>fopen/fclose</code>、<code>lock/unlock</code> 都是成对出现的，手写时任何一条提前返回或异常路径都可能漏掉一半；而 <code>std::unique_ptr</code>、<code>std::fstream</code>、<code>std::lock_guard</code> 把配对封进构造函数与析构函数，编译器保证自动对象在作用域退出时析构。C++11 之后配合移动语义，资源可在对象间转移而不复制，“唯一所有者”的模型可以写进类型系统。</p>
<div class="duo">
<div class="duo__col"><h4>手动管理</h4><p>申请与释放散落在业务代码中，每条 return 与异常分支都要记得配对；一处遗漏是泄漏，两处是二次释放。所有权只存在于注释和记忆里。</p></div>
<div class="duo__col"><h4>RAII</h4><p>资源在构造时获取、析构时释放；作用域退出自动执行，异常路径也不例外。所有权体现在类型上：unique_ptr 独占，shared_ptr 共享。</p></div>
</div>
<p>规则层面，现代 C++ 推荐“零之法则”（Rule of Zero）：若类只是组合了会自管资源的成员，就不要手写析构、拷贝、移动这几个特殊成员函数，让编译器生成。只有直接持有裸资源，或已经自定义了析构、拷贝、移动中的某一个时，才需要把这一组特殊成员函数放在一起审视并显式定义（五之法则，Rule of Five，C++11 起）。移动之后，标准库类型通常保证源对象处于“有效但未指定”的状态（个别类型另有更强的具体保证）；自定义类型没有这条自动保证，需要自己维持可析构、可赋值的有效状态，不要把“有效但未指定”当成语言对所有类型的承诺。析构顺序同样重要：对象销毁时先执行析构函数体，再按声明逆序销毁成员，最后销毁基类子对象。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>析构函数不应抛出异常。从 C++11 起析构函数默认是 noexcept(true)（除非成员或基类的析构可能抛出）；在栈展开中再抛出，或让异常逸出析构函数，程序通常会直接终止。需要报告失败时，应在析构函数内捕获并记录，或提供显式 close 方法。</div></div>
</section>

<section class="sec">
<h2>四种范式如何共存</h2>
<p>C++ 支持多种范式（paradigm），而且可在同一个项目里共存。这不是犹豫，而是不同问题的最优解本就不同：驱动与协议解析偏好过程式，业务模型偏好面向对象，容器与算法偏好泛型，事件回调与数据变换偏好函数式。</p>
<p>多范式的难点是选择成本：某个抽象应在编译期还是运行期解析。模板在编译期生成专用代码，通常避免类型擦除带来的间接调用，但会增加编译时间与二进制体积；虚函数在运行期通过虚表（vtable）分发，支持运行时多态。在常见 ABI 下，多态对象带有虚表指针；多继承可能产生多份，虚继承还会引入额外的基址指针。每次虚调用通常多一次间接跳转；具体布局由应用二进制接口（Application Binary Interface, ABI）决定，标准只保证行为，不保证 vtable 的具体形态。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>范式</th><th>主要机制</th><th>典型场景</th><th>成本口径</th></tr></thead>
<tbody>
<tr><td>过程式</td><td>函数、结构体、循环</td><td>协议解析、数值处理、系统调用封装</td><td>直接映射到机器指令，易预测</td></tr>
<tr><td>面向对象</td><td>类、继承、虚函数</td><td>需运行时替换实现</td><td>虚表指针与间接调用，布局依 ABI</td></tr>
<tr><td>泛型</td><td>模板、concepts</td><td>容器、算法、零开销的通用接口</td><td>编译期实例化，代码体积与编译时间上升</td></tr>
<tr><td>函数式</td><td>lambda、ranges、高阶函数</td><td>数据变换管道、回调、事件处理</td><td>lambda 可内联；类型擦除有运行时成本</td></tr>
</tbody>
</table></div>
<p>函数式在 C++11 之后才算真正可用：lambda、<code>std::function</code>，以及 C++20 的 ranges 管道。成本口径却不同：lambda 是编译器生成的闭包类型，直接调用时通常可内联；<code>std::function</code> 做类型擦除，可能堆分配并产生间接调用。不要因为写法像函数式就假设它和手写循环同价，仍然要看生成的代码。</p>
</section>

<section class="sec">
<h2>标准演进：C++11 到 C++23 的定位</h2>
<p>标准版本不是“越新越好”的口号，而是一组能力边界。C++11 是现代 C++ 的分水岭：移动语义、<code>auto</code>、lambda、智能指针、<code>constexpr</code>、线程库与统一初始化一起到位，今天说的“现代 C++”大多指它确立的模型。C++14 是对 11 的修补与放松，加入泛型 lambda、变量模板与更宽松的 <code>constexpr</code>。C++17 补齐了工程常用件：结构化绑定、<code>if constexpr</code>、<code>std::optional</code>、<code>std::variant</code>、<code>std::string_view</code>、文件系统库与并行算法。</p>
<p>C++20 是第二次大版本：概念（concepts）、范围（ranges）、协程（coroutines）、模块（modules）、三路比较与 <code>std::span</code>。它改变了写泛型代码的方式：concepts 把“模板要求什么”写进签名，报错从一屏实例化栈变成一句约束不满足。C++23 延续“库多语言少”的节奏，补上 <code>std::expected</code>、<code>std::flat_map</code>、<code>std::mdspan</code> 与 <code>std::print</code> 等设施，并加入 deducing this、<code>if consteval</code> 等语言细节。</p>
<p>要区分三张进度表：标准文本发布、语言特性实现、标准库设施实现。一个特性进了标准，不等于你手里的编译器认；编译器认了，也不等于配套标准库有对应的头文件与实现。实践建议是：就当前主流工具链而言，新项目以 C++20 为基线是稳妥选择，因为 concepts 与 ranges 显著改善模板代码的可读性与诊断质量；C++23 的库特性可按实际支持逐步采用。老项目应按工具链与 CI 的实际支持渐进升级，不要为“用新特性”引入工具链风险。跨平台项目尤其要确认三件事：编译器版本、标准库版本、构建系统对 modules 的支持。三者任一落后，都会让“标准支持”停留在纸面。</p>
<div class="formula">版本选择规则：
  基线 = 目标平台工具链都支持的最高稳定标准（新项目通常 C++20）
  升级条件 = 编译器支持 ∧ 标准库支持 ∧ 构建与 CI 可用
  不为“最新标准”牺牲可构建性；不为“兼容旧版”停在 C++11</div>
</section>

<section class="sec">
<h2>七层学习路线</h2>
<p>把上面的内容压缩成一条路线，就得到本模块的七层结构。它不是知识分类，而是能力递进：每层对应一类你能解决的问题与一组能看懂的报错。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="C++ 七层学习路线：从全景到深入与演进的能力阶梯">
<line x1="20" y1="300" x2="744" y2="300" stroke="var(--sv-line)" stroke-width="1.5"></line>
<rect x="24" y="230" width="92" height="70" rx="5" fill="var(--sv-a)"></rect>
<text x="70" y="252" text-anchor="middle" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">L0 全景</text>
<text x="70" y="274" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">建立地图</text>
<text x="70" y="292" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">定位问题</text>
<rect x="128" y="198" width="92" height="102" rx="5" fill="var(--sv-b)"></rect>
<text x="174" y="220" text-anchor="middle" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">L1 语言核心</text>
<text x="174" y="242" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">类型与语义</text>
<text x="174" y="264" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">解释代码行为</text>
<rect x="232" y="166" width="92" height="134" rx="5" fill="var(--sv-c)"></rect>
<text x="278" y="188" text-anchor="middle" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">L2 对象资源</text>
<text x="278" y="210" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">RAII 与所有权</text>
<text x="278" y="232" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">不泄漏</text>
<rect x="336" y="134" width="92" height="166" rx="5" fill="var(--sv-a2)"></rect>
<text x="382" y="156" text-anchor="middle" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">L3 泛型标准库</text>
<text x="382" y="178" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">模板与 STL</text>
<text x="382" y="200" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">读懂实现与约束</text>
<rect x="440" y="102" width="92" height="198" rx="5" fill="var(--sv-b2)"></rect>
<text x="486" y="124" text-anchor="middle" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">L4 并发性能</text>
<text x="486" y="146" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">线程与剖析</text>
<text x="486" y="168" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">正确且可测量</text>
<rect x="544" y="70" width="92" height="230" rx="5" fill="var(--sv-a2)"></rect>
<text x="590" y="92" text-anchor="middle" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">L5 工程化</text>
<text x="590" y="114" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">构建测试诊断</text>
<text x="590" y="136" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">让团队稳定演进</text>
<rect x="648" y="38" width="92" height="262" rx="5" fill="var(--sv-b2)"></rect>
<text x="694" y="60" text-anchor="middle" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">L6 深入演进</text>
<text x="694" y="82" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">标准与 ABI</text>
<text x="694" y="104" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">分辨保证与细节</text>
<text x="40" y="324" font-size="12" font-family="inherit" fill="var(--sv-ink)">能力主线：能写 → 写得对 → 看得懂 → 改得动 → 能判断</text>
<text x="40" y="346" font-size="12" font-family="inherit" fill="var(--sv-muted)">每层过关标准：能解释机制、能写最小示例、能定位该类报错</text>
</svg>
<figcaption>图 3 · 七层路线：高度代表抽象深度与需要握住的概念量</figcaption>
</figure>
<p><b>第 0 层全景</b>就是本篇：先建立四块地图与错误分界，后面每一层都挂在这张图上。<b>第 1 层语言核心</b>处理类型、表达式、函数与控制流，目标是解释代码做了什么。<b>第 2 层对象与资源</b>处理类、构造与析构、拷贝与移动、RAII 与所有权，目标是写出不泄漏的代码。<b>第 3 层泛型与标准库</b>处理模板、概念、容器、算法与迭代器，目标是能读 STL 实现、能写受约束的泛型接口。<b>第 4 层并发与性能</b>处理线程、原子操作、内存序、缓存与剖析，目标是写出正确且可测量的并发代码。</p>
<p><b>第 5 层工程化</b>处理构建、依赖、测试与调试，让代码在团队与持续集成中稳定演进。<b>第 6 层深入与演进</b>处理标准文本、ABI 与编译器实现，目标是判断“某说法是标准保证还是实现细节”。这两层最容易被跳过，却是从“个人能写”到“团队能维护”的分界。</p>
<p>过关标准不是“读完”，而是“能解释、能动手、能排障”：说清机制的保证与代价，写出最小示例验证，遇到报错知道先看编译期、链接期还是运行期。三者都做到，才算拥有这一层。</p>
<div class="callout callout--tip"><span class="callout__label">建议</span><div>不要线性刷完再动手。每层挑一个能跑的小项目：第 1 层写命令行计算器，第 2 层写 RAII 的文件与锁封装，第 3 层写受 concepts 约束的算法，第 4 层写生产者消费者队列并用 sanitizer 验证。</div></div>
</section>

<section class="sec">
<h2>常见误区、排障与自测</h2>
<p>第一个误区是“C++ 就是 C with classes”。把 C++ 当成带成员函数的 C，会跳过值语义、RAII 与泛型，写出满屏裸指针和手动 delete，然后把崩溃归咎于语言。现代 C++ 的重心是类型与生命周期，不是语法糖。</p>
<p>第二个误区是一上来啃模板元编程（template metaprogramming）。模板建立在普通函数、类型与重载之上；没有这些基础，SFINAE 与约束只会变成背诵。顺序应是先写清晰的普通代码，再学模板如何做编译期分发，最后才碰元编程技巧。</p>
<p>第三个误区是只看语法、不建心智模型。知道 <code>std::vector</code> 怎么用，不等于知道扩容会让迭代器失效、按值传参会深拷贝、<code>reserve</code> 与 <code>resize</code> 语义不同。心智模型包括对象生命周期、内存所有权、错误分类。缺了它，代码能跑只是运气。</p>
<p>排障按阶段分流：编译错误先读第一条，模板报错从实例化栈最内层看；链接错误多半是缺少定义、ODR 违反或库顺序；运行期崩溃优先用 AddressSanitizer 与 UndefinedBehaviorSanitizer 复现，再配合调试器看调用栈。尺寸与布局以目标平台 ABI 为准：x86-64 上 Linux 与 macOS 是 LP64（<code>long</code> 与指针均为 8 字节），Windows 是 LLP64（<code>long</code> 4 字节、指针 8 字节）；类布局、虚表与名称修饰（name mangling）由 ABI 决定，不是标准保证。Linux 与 macOS 上的 GCC、Clang 通常遵循 Itanium C++ ABI，MSVC 使用另一套 ABI，两边的 C++ 目标文件与符号不能直接混链。</p>
<details class="quiz"><summary>Q1 · 为什么把 std::vector&lt;int&gt; 按值传给函数通常不好？</summary><div class="quiz__a">按值传参在实参是左值时会深拷贝全部元素，成本 O(n)，且修改不影响调用方；实参是可移动的右值时通常会转为移动，成本通常为 O(1)。只读用 const 引用，只观察连续数据用 <code>std::span</code>，确需副本才按值传。</div></details>
<details class="quiz"><summary>Q2 · RAII 为什么能在异常路径上仍然释放资源？</summary><div class="quiz__a">异常抛出会栈展开，已完整构造的自动对象按逆序析构，与正常返回一致，配对不会中断。构造函数内部抛出时，已构造的成员与基类仍会析构，但该对象不算构造成功，其析构函数不会执行。</div></details>
<details class="quiz"><summary>Q3 · std::span 与 std::vector 的核心区别是什么？</summary><div class="quiz__a">所有权。<code>std::vector</code> 拥有并管理堆内存；<code>std::span</code> 概念上是指针加长度的非拥有视图，不延长生命周期。返回指向局部 vector 的 span 后，该视图已经悬垂；扩容后继续用旧 span，或读写已悬垂的 span，都是 UB。</div></details>
<details class="quiz"><summary>Q4 · “零开销抽象”是否意味着抽象没有成本？</summary><div class="quiz__a">不是。它指不用的特性不进入生成代码、用了不劣于手写实现。抽象仍有编译时间与代码体积成本；虚函数、类型擦除、动态分配是你显式选择的运行时能力。判断应看生成代码与测量结果。</div></details>
<ul class="refs">
<li><b>A Tour of C++（第 3 版）</b> — Bjarne Stroustrup, Addison-Wesley, 2022。按 C++20 口径走一遍语言与标准库。</li>
<li><b>cppreference</b> — 社区维护的语言与标准库参考。查签名、特性版本与精确语义的首选。</li>
<li><b>ISO C++ Core Guidelines</b> — Stroustrup 与 Sutter 主持，持续更新。资源管理、所有权与接口设计的规则集合，每条都有理由。</li>
<li><b>Effective Modern C++</b> — Scott Meyers, O'Reilly, 2014。围绕 C++11/14 的 42 条实践，重点讲类型推导、移动语义与智能指针。</li>
<li><b>The C++ Programming Language（第 4 版）</b> — Bjarne Stroustrup, Addison-Wesley, 2013。语言设计者写的完整参考，适合建立地图后按主题查阅。</li>
</ul>
</section>`
};
