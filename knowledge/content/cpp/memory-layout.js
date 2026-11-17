window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["memory-layout"] = {
  slug: "memory-layout",
  title: "对象布局、对齐与存储期",
  subtitle: "sizeof 背后的规则",
  level: 2,
  cluster: "对象与资源",
  tags: ["内存布局", "对齐", "存储期"],
  summary: "从 sizeof 与 alignof 出发，讲清 padding、成员重排、标准布局、聚合与位域、四类存储期与栈帧，帮你看懂编译器布局，守住对齐与别名边界。",
  keyPoints: [
    "对象表示包含 padding，值表示只含有效位；sizeof/alignof 与三条偏移规则决定布局",
    "成员按对齐值重排可减少 padding；标准布局保证首成员指针可互换与 offsetof",
    "聚合初始化与位域的边界：指定初始化是 C++20，位域布局由实现定义",
    "自动、静态、线程、动态四类存储期，以及栈帧、new[] cookie、EBO 与 SIMD 对齐实践"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>sizeof 不是字段大小之和</h2>
<p>先看一个反直觉的结果。在 x86-64 的 GCC/Clang 上，<code>struct A { char c; int i; char d; };</code> 的 <code>sizeof</code> 是 12，尽管三个成员加起来只有 1+4+1=6 字节。多出来的 6 字节是 <mark>padding（填充）</mark>，用来保证每个成员落在满足其对齐要求（alignment requirement）的地址上，并让整个结构体的大小是其对齐值的整数倍。</p>
<p>这意味着 <code>sizeof</code> 描述的不是“数据有多少”，而是“一个对象在内存里占多大”。它由编译器按照 ABI（Application Binary Interface，应用二进制接口）生成：字段偏移、padding、结构体对齐、空基类优化、数组 cookie 都在 ABI 里规定。C++ 标准只保证少数可观察性质，其余是 implementation-defined（实现定义）。同一个结构体在 Linux/GCC、macOS/Clang、Windows/MSVC 上可能有不同大小。</p>
<p>先区分两个概念。<mark>对象表示（object representation）</mark>是对象占用的全部字节，包含 padding；<mark>值表示（value representation）</mark>是真正参与取值的位。padding 的值通常不确定，读出来没有语义；只有执行零初始化的静态/线程存储期对象等少数情形，padding 才被要求清成 0。这也是 <code>memcmp</code> 比较结构体不可靠的原因。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>把结构体想成一排带门牌号的储物柜：char 只要 1 字节，int 要求门牌号是 4 的倍数。字段按声明顺序入住，住不下就空出几格；最后整排柜子还要向上取整到最大对齐值，保证下一个结构体接着摆时首字段仍对齐。</div></div>
</section>

<section class="sec">
<h2>三条规则算出布局</h2>
<p>对一个没有虚函数、没有虚基类的普通结构体，布局可以按下面三条规则手算。设成员按声明顺序为 m1 到 mn，<code>alignof(T)</code> 是类型 T 的对齐要求，round_up(x, a) 表示把 x 向上取整到 a 的倍数。</p>
<div class="formula">offset(m1) = 0
offset(mk) = round_up(offset(mk-1) + sizeof(mk-1), alignof(mk))
alignof(S) = max(alignof(m1), …, alignof(mn), alignas 指定值)
sizeof(S) = round_up(offset(mn) + sizeof(mn), alignof(S))</div>
<p>规则 1 决定每个成员放在哪：偏移必须是该成员对齐值的倍数。规则 2 决定结构体自身的对齐：取所有成员对齐值的最大值（空类取 1），alignas 可以加强。规则 3 决定总大小：必须补齐到结构体对齐值的整数倍，否则数组里相邻元素的第一个成员就会错位。因此 <code>sizeof(S)</code> 总是 <code>alignof(S)</code> 的整数倍。</p>
<p>需要强调：这套算法在 Itanium C++ ABI（GCC/Clang）和 MSVC ABI 等主流实现上成立，但它不是 C++ 标准的规定；标准只要求成员地址满足各自对齐、数组元素连续且对齐，具体偏移与大小属于实现定义。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="两个字段顺序不同的结构体的字节布局与 padding 对比" font-family="inherit">
<text x="380" y="24" text-anchor="middle" font-size="15" fill="var(--sv-ink)">成员顺序决定 padding：12 字节与 8 字节</text>

<text x="40" y="58" font-size="13" fill="var(--sv-ink)">struct A { char c; int i; char d; }</text>
<text x="720" y="58" text-anchor="end" font-size="13" fill="var(--sv-muted)">sizeof = 12 · alignof = 4</text>

<rect x="80" y="68" width="48" height="44" fill="var(--sv-a)" fill-opacity="0.35" stroke="var(--sv-a)"/>
<text x="104" y="95" text-anchor="middle" font-size="13" fill="var(--sv-ink)">c</text>
<rect x="128" y="68" width="144" height="44" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="4 3"/>
<text x="200" y="95" text-anchor="middle" font-size="12" fill="var(--sv-muted)">padding 3 B</text>
<rect x="272" y="68" width="192" height="44" fill="var(--sv-b)" fill-opacity="0.35" stroke="var(--sv-b)"/>
<text x="368" y="95" text-anchor="middle" font-size="13" fill="var(--sv-ink)">int i（4 B）</text>
<rect x="464" y="68" width="48" height="44" fill="var(--sv-a)" fill-opacity="0.35" stroke="var(--sv-a)"/>
<text x="488" y="95" text-anchor="middle" font-size="13" fill="var(--sv-ink)">d</text>
<rect x="512" y="68" width="144" height="44" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="4 3"/>
<text x="584" y="95" text-anchor="middle" font-size="12" fill="var(--sv-muted)">padding 3 B</text>

<text x="80" y="130" font-size="12" fill="var(--sv-muted)">0</text>
<text x="272" y="130" text-anchor="middle" font-size="12" fill="var(--sv-muted)">4</text>
<text x="464" y="130" text-anchor="middle" font-size="12" fill="var(--sv-muted)">8</text>
<text x="656" y="130" text-anchor="end" font-size="12" fill="var(--sv-muted)">12 字节偏移</text>

<text x="40" y="178" font-size="13" fill="var(--sv-ink)">struct B { int i; char c; char d; }</text>
<text x="720" y="178" text-anchor="end" font-size="13" fill="var(--sv-muted)">sizeof = 8 · alignof = 4</text>

<rect x="80" y="190" width="192" height="44" fill="var(--sv-b)" fill-opacity="0.35" stroke="var(--sv-b)"/>
<text x="176" y="217" text-anchor="middle" font-size="13" fill="var(--sv-ink)">int i（4 B）</text>
<rect x="272" y="190" width="48" height="44" fill="var(--sv-a)" fill-opacity="0.35" stroke="var(--sv-a)"/>
<text x="296" y="217" text-anchor="middle" font-size="13" fill="var(--sv-ink)">c</text>
<rect x="320" y="190" width="48" height="44" fill="var(--sv-a)" fill-opacity="0.35" stroke="var(--sv-a)"/>
<text x="344" y="217" text-anchor="middle" font-size="13" fill="var(--sv-ink)">d</text>
<rect x="368" y="190" width="96" height="44" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="4 3"/>
<text x="416" y="217" text-anchor="middle" font-size="12" fill="var(--sv-muted)">padding 2 B</text>

<text x="80" y="252" font-size="12" fill="var(--sv-muted)">0</text>
<text x="272" y="252" text-anchor="middle" font-size="12" fill="var(--sv-muted)">4</text>
<text x="368" y="252" text-anchor="middle" font-size="12" fill="var(--sv-muted)">6</text>
<text x="464" y="252" text-anchor="end" font-size="12" fill="var(--sv-muted)">8 字节偏移</text>

<rect x="80" y="286" width="22" height="14" fill="var(--sv-a)" fill-opacity="0.35" stroke="var(--sv-a)"/>
<text x="110" y="298" font-size="12" fill="var(--sv-ink)">普通成员</text>
<rect x="190" y="286" width="22" height="14" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="4 3"/>
<text x="220" y="298" font-size="12" fill="var(--sv-ink)">padding，值不确定</text>
<text x="380" y="338" text-anchor="middle" font-size="12" fill="var(--sv-muted)">数字为 x86-64、LP64、GCC/Clang（Itanium ABI）下的典型结果</text>
</svg>
<figcaption>图 1 · 同样的字段，按对齐值从大到小重排后，sizeof 从 12 降到 8</figcaption>
</figure>
<p>把 A 的成员按对齐值从大到小重排，得到 <code>struct B { int i; char c; char d; };</code>：i 占 0 到 3，c 在 4，d 在 5，尾部补 2 字节，sizeof 从 12 降到 8。这只是把 padding 从字段之间挪到末尾；代价是成员顺序变了，若要按声明顺序序列化，协议也要同步修改。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>类型（x86-64, LP64）</th><th>sizeof</th><th>alignof</th><th>说明</th></tr></thead>
<tbody>
<tr><td><code>char</code></td><td>1</td><td>1</td><td>字节的定义，恒为 1</td></tr>
<tr><td><code>bool</code></td><td>1</td><td>1</td><td>1 字节，值表示只有 1 位</td></tr>
<tr><td><code>short</code></td><td>2</td><td>2</td><td>至少 16 位</td></tr>
<tr><td><code>int</code></td><td>4</td><td>4</td><td>至少 16 位，这里是常见实现</td></tr>
<tr><td><code>long</code></td><td>8</td><td>8</td><td>Windows LLP64 上是 4</td></tr>
<tr><td><code>long long</code></td><td>8</td><td>8</td><td>至少 64 位</td></tr>
<tr><td><code>float</code></td><td>4</td><td>4</td><td>通常 IEEE 754 单精度</td></tr>
<tr><td><code>double</code></td><td>8</td><td>8</td><td>通常 IEEE 754 双精度</td></tr>
<tr><td><code>void*</code></td><td>8</td><td>8</td><td>64 位地址空间</td></tr>
<tr><td>空类</td><td>1</td><td>1</td><td>不同完整对象的地址必须不同</td></tr>
</tbody>
</table></div>
<p>表里的值不是标准保证：标准只规定 <code>sizeof(char)==1</code>、sizeof 是 alignof 的倍数、各类型的最小范围。<code>int</code> 可能是 2 字节，<code>long</code> 在 LP64 上是 8 字节而在 Windows LLP64 上是 4 字节，指针在 32 位上是 4 字节。写跨平台代码时用 <code>&lt;cstdint&gt;</code> 的固定宽度类型，并用 <code>static_assert</code> 锁定假设。</p>
<h3>空基类优化</h3>
<p>空类 <code>sizeof</code> 是 1：两个不同的完整对象必须有不同地址。但当空类作为基类子对象时，标准允许它占 0 字节，这叫空基类优化（empty base optimization，EBO）。<code>struct Empty {}; struct X : Empty { int i; };</code> 在常见 ABI 上 <code>sizeof(X)</code> 是 4 而不是 8。EBO 是标准允许、主流 ABI 通常实现的优化，但不要当成所有编译器的硬保证；MSVC 在多个空基类同时存在时需要 <code>__declspec(empty_bases)</code>。</p>
<p>C++20 引入 <code>[[no_unique_address]]</code>，把同样的意图用在非静态数据成员上：空成员可以与其他成员共享地址，从而省掉 1 字节加 padding。它不能用于位域；同类型子对象仍需可区分，具体是否重叠由实现决定。跨编译器稳定布局不要依赖其具体结果，用 <code>static_assert</code> 兜底。</p>
</section>

<section class="sec">
<h2>对齐：从自然对齐到 SIMD</h2>
<p>每个完整对象类型都有对齐要求（alignment requirement），记作 <code>alignof(T)</code>，它是 2 的幂，即对象地址必须是它的倍数。基础对齐（fundamental alignment）是指实现保证在所有语境都支持的对齐；所有基础对齐都不大于 <code>alignof(std::max_align_t)</code>，后者本身是最大的基础对齐。GCC/Clang 在 x86-64 System V 上通常是 16。对齐要求超过它的叫扩展对齐（extended alignment），例如 32 或 64。</p>
<p>C++11 起用 <code>alignas</code> 指定、<code>alignof</code> 查询。<code>alignas</code> 只能加强对齐，不能把类型降到低于其自然对齐；<code>alignas(0)</code> 被忽略；多个 <code>alignas</code> 取最严格的那个。对结构体写 <code>alignas(32)</code>，结构体对齐变为 32，sizeof 会向上取整到 32 的倍数；成员偏移仍只需满足各自的对齐要求。一个常见用途是让 SIMD 缓冲区满足指令要求：AVX 的 <code>_mm256_load_ps</code> 要求 32 字节对齐，未对齐要用 <code>_mm256_loadu_ps</code>，后者可能更慢。</p>
<pre class="code" data-lang="cpp"><code>// 示意：编译期锁定对齐与大小
struct alignas(32) Vec8f { float v[8]; };
static_assert(alignof(Vec8f) == 32);
static_assert(sizeof(Vec8f) == 32);</code></pre>
<p>C++17 之前，new 只保证基础对齐，new 一个 over-aligned 类型不保证地址满足要求；C++17 引入对齐版 <code>operator new(std::size_t, std::align_val_t)</code> 与对应 delete 后，new 表达式会自动按类型对齐选择重载，具体规则见 allocation 一篇。在此之前，<code>std::vector&lt;Vec8f&gt;</code> 的元素对齐不可移植。</p>
<p>栈上对象由编译器负责对齐；x86-64 System V 要求调用前 16 字节对齐。<code>malloc</code> 只保证适用于任何基础对齐（也就是 <code>max_align_t</code>）的地址，第三方分配器也要确认指针对齐满足目标类型；需要更大对齐时用 <code>posix_memalign</code>、C++17 起的 <code>std::aligned_alloc</code>（大小必须是对齐值的整数倍），Windows 用 <code>_aligned_malloc</code> 配 <code>_aligned_free</code>。</p>
<div class="callout callout--warn"><span class="callout__label">警告</span><div>把 <code>char*</code> 直接 <code>reinterpret_cast</code> 成 <code>int*</code> 并解引用，若地址不是 4 的倍数就是未定义行为。x86 的普通标量访问通常容忍未对齐，但 SIMD 对齐指令会触发异常；ARM 上部分指令（如 SIMD、原子与 <code>ldrd</code>/<code>ldm</code>）同样要求对齐；<code>-fsanitize=alignment</code> 能在运行期抓住这类问题。</div></div>
</section>

<section class="sec">
<h2>对象表示、标准布局与严格别名</h2>
<p>padding 让“按字节比较”变得危险：两个逻辑相等的结构体，padding 里可能是上次栈帧留下的垃圾；float 的 +0.0 与 -0.0 值相等但位模式不同；bool 的值表示只有 1 位，对象表示通常是 1 字节，多出来的位是 padding，按字节比较同样可能不一致。正确做法是逐字段比较，或为类型定义明确的相等语义；也不要对 <code>sizeof(T)</code> 个字节做哈希。</p>
<p>对可平凡复制（trivially copyable）的类型，标准允许把对象表示复制到 <code>char</code>、<code>unsigned char</code> 或 <code>std::byte</code> 数组再复制回来，目标对象得到相同的值；<code>std::memcpy</code> 正是这样工作的。注意这只保证值相同，不保证 padding 字节相同。C++20 的 <code>std::bit_cast</code> 更进一步：在源与目标都是可平凡复制、大小相同的前提下，按位重解释，且不触发别名问题。</p>
<p>标准布局（standard-layout）是一组让布局可预测的约束：没有虚函数和虚基类；所有非静态数据成员具有相同的访问控制；非静态数据成员不能是引用类型；类类型成员（含其数组）与基类也必须满足标准布局；任意给定类型至多有一个基类子对象；首个非静态数据成员的类型不能与任何基类相同；派生类与其基类不能同时拥有非静态数据成员（要么派生类没有、且至多一个基类有，要么所有基类都没有）。实际判断用 <code>std::is_standard_layout_v</code>。</p>
<p>满足标准布局带来几个实用保证：非静态数据成员按声明顺序分配，后面的成员地址更大；<code>offsetof</code> 可用于标准布局类型（非标准布局类型自 C++17 起才是条件支持）；把指向对象的指针 <code>reinterpret_cast</code> 成指向首成员的指针，地址相同（指针可互换）。这里要分清：同一访问控制下“后声明的成员地址更大”本身是所有非联合类的通用规则，标准布局保证了所有成员访问控制一致，从而让这条规则覆盖全部成员；而首成员指针可互换才是标准布局特有的保证。这也解释了为什么网络协议、共享内存、GPU 缓冲区的结构体通常要求标准布局。反过来，多态类型（有虚函数）的布局由 ABI 规定，vtable 指针放在哪里、有几个都不是标准保证。</p>
<h3>严格别名预告</h3>
<p>通过 <code>char</code>、<code>unsigned char</code> 或 <code>std::byte</code> 的指针访问任意对象是允许的，这是检查对象表示的合法通道。但通过一个与对象实际类型无关的指针访问它，违反严格别名规则（strict aliasing），是未定义行为。典型错误是 <code>float f; int* p = reinterpret_cast&lt;int*&gt;(&amp;f);</code> 然后读 <code>*p</code>；编译器在 -O2 下可能基于类型假设两个指针不指向同一对象，做出看似不可能的优化。用 <code>std::bit_cast</code> 或 <code>memcpy</code> 代替，细节留到讲未定义行为与优化的一篇。</p>
</section>

<section class="sec">
<h2>聚合初始化与位域</h2>
<p>聚合（aggregate）没有用户声明或继承来的构造函数、私有或受保护非静态数据成员、虚函数与虚/私有/受保护基类，这是 C++20 口径。版本差异值得记住：C++14 及以前用“无用户提供构造函数”的口径，C++17 起还排除 explicit 与继承来的构造函数，并允许公有非虚基类；C++14 起允许默认成员初始化器，C++11 则连它也不允许。数组和 <code>std::array</code> 也是聚合。聚合初始化按成员声明顺序逐个初始化，未给出的成员用空列表值初始化，标量因此为 0。</p>
<p>C++20 增加了两种写法：指定初始化（designated initializers）<code>Point p{.x = 1, .y = 2};</code>，以及带括号的聚合初始化 <code>Point q(1, 2);</code>。指定初始化必须按声明顺序、不能嵌套、不能与非指定项混用；窄化转换在花括号里直接编译错误，这是花括号初始化最有价值的保护之一。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;cstddef&gt;
#include &lt;iostream&gt;
#include &lt;type_traits&gt;

struct Widget {
    char   tag;
    int    id;
    double weight;
};

static_assert(std::is_standard_layout_v&lt;Widget&gt;);

int main() {
    std::cout &lt;&lt; "sizeof  = " &lt;&lt; sizeof(Widget) &lt;&lt; '\n';
    std::cout &lt;&lt; "alignof = " &lt;&lt; alignof(Widget) &lt;&lt; '\n';
    std::cout &lt;&lt; "id off  = " &lt;&lt; offsetof(Widget, id) &lt;&lt; '\n';
    std::cout &lt;&lt; "wt off  = " &lt;&lt; offsetof(Widget, weight) &lt;&lt; '\n';

    Widget a{};                                    // 成员值初始化
    Widget b{.tag = 'x', .id = 7, .weight = 1.5};  // C++20 指定初始化
    std::cout &lt;&lt; a.id &lt;&lt; ' ' &lt;&lt; b.id &lt;&lt; '\n';
}</code></pre>
<p>这段代码在 x86-64 + GCC/Clang 上输出 sizeof=16、alignof=8、id 偏移 4、weight 偏移 8。<code>static_assert</code> 把“这是标准布局”变成编译期契约；<code>offsetof</code> 可用于标准布局类型，非标准布局类型自 C++17 起才是条件支持。注意 <code>Widget a{};</code> 只保证其标量成员被初始化为 0，不保证 padding 也清零。</p>
<p>位域（bit-field）用 <code>unsigned mode : 3;</code> 这样的声明把多个小整数塞进同一个分配单元。但它的布局高度依赖实现：分配单元多大、位序、能否跨分配单元、普通 <code>int</code> 是否带符号，标准都没有完全规定。位域不能取地址，<code>sizeof</code> 也不能直接作用于位域；包含位域的类，其大小与布局随实现变化。跨网络协议、文件格式、硬件寄存器时，不要直接映射位域结构体；用 <code>std::uint8_t</code> 数组加显式掩码，或逐字段序列化。</p>
<p>零宽无名位域 <code>unsigned : 0;</code> 要求下一个位域从新的分配单元开始，常用来手动控制分组，但“分配单元多大”仍由实现决定。位域适合节省内存的内部标志，不适合作为二进制接口。</p>
</section>

<section class="sec">
<h2>存储期：对象活多久，谁负责销毁</h2>
<p>存储期（storage duration）描述对象的存储从何时存在到何时结束，与类型无关。C++ 有四类：自动（automatic）、静态（static）、线程（thread）和动态（dynamic）。作用域回答名字在哪里可见，存储期回答对象什么时候存在：static 局部变量的作用域是函数块，存储期却是整个程序。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="四类存储期分类：自动、静态、线程与动态" font-family="inherit">
<text x="380" y="24" text-anchor="middle" font-size="15" fill="var(--sv-ink)">存储期四分类：谁创建、活多久、在哪销毁</text>
<rect x="280" y="42" width="200" height="40" rx="5" fill="var(--sv-panel)" stroke="var(--sv-ink)"/>
<text x="380" y="67" text-anchor="middle" font-size="14" fill="var(--sv-ink)">存储期 storage duration</text>
<path d="M380,82 L380,96 M105,96 L645,96 M105,96 L105,124 M285,96 L285,124 M465,96 L465,124 M645,96 L645,124" fill="none" stroke="var(--sv-line)" stroke-width="1.5"/>
<rect x="25" y="124" width="160" height="178" rx="5" fill="var(--sv-a)" fill-opacity="0.2" stroke="var(--sv-a)"/>
<text x="105" y="148" text-anchor="middle" font-size="14" fill="var(--sv-ink)">自动 automatic</text>
<text x="105" y="174" text-anchor="middle" font-size="12" fill="var(--sv-muted)">块作用域变量、参数</text>
<text x="105" y="196" text-anchor="middle" font-size="12" fill="var(--sv-muted)">进入作用域时创建</text>
<text x="105" y="218" text-anchor="middle" font-size="12" fill="var(--sv-muted)">离开作用域时销毁</text>
<text x="105" y="240" text-anchor="middle" font-size="12" fill="var(--sv-muted)">通常在栈上</text>
<rect x="205" y="124" width="160" height="178" rx="5" fill="var(--sv-a2)" fill-opacity="0.2" stroke="var(--sv-a2)"/>
<text x="285" y="148" text-anchor="middle" font-size="14" fill="var(--sv-ink)">静态 static</text>
<text x="285" y="174" text-anchor="middle" font-size="12" fill="var(--sv-muted)">命名空间变量</text>
<text x="285" y="196" text-anchor="middle" font-size="12" fill="var(--sv-muted)">static 成员与局部变量</text>
<text x="285" y="218" text-anchor="middle" font-size="12" fill="var(--sv-muted)">程序启动到结束</text>
<text x="285" y="240" text-anchor="middle" font-size="12" fill="var(--sv-muted)">数据段 / BSS</text>
<rect x="385" y="124" width="160" height="178" rx="5" fill="var(--sv-b)" fill-opacity="0.2" stroke="var(--sv-b)"/>
<text x="465" y="148" text-anchor="middle" font-size="14" fill="var(--sv-ink)">线程 thread</text>
<text x="465" y="174" text-anchor="middle" font-size="12" fill="var(--sv-muted)">thread_local 对象</text>
<text x="465" y="196" text-anchor="middle" font-size="12" fill="var(--sv-muted)">每个线程一份</text>
<text x="465" y="218" text-anchor="middle" font-size="12" fill="var(--sv-muted)">线程开始到结束</text>
<text x="465" y="240" text-anchor="middle" font-size="12" fill="var(--sv-muted)">TLS 区</text>
<rect x="565" y="124" width="160" height="178" rx="5" fill="var(--sv-b2)" fill-opacity="0.2" stroke="var(--sv-b2)"/>
<text x="645" y="148" text-anchor="middle" font-size="14" fill="var(--sv-ink)">动态 dynamic</text>
<text x="645" y="174" text-anchor="middle" font-size="12" fill="var(--sv-muted)">new 表达式创建</text>
<text x="645" y="196" text-anchor="middle" font-size="12" fill="var(--sv-muted)">delete 时销毁</text>
<text x="645" y="218" text-anchor="middle" font-size="12" fill="var(--sv-muted)">自由存储区</text>
<text x="645" y="240" text-anchor="middle" font-size="12" fill="var(--sv-muted)">可跨作用域存活</text>
<text x="380" y="336" text-anchor="middle" font-size="12" fill="var(--sv-muted)">存储期回答“对象何时存在”，作用域回答“名字在哪里可见”，两者互相独立</text>
<text x="380" y="360" text-anchor="middle" font-size="12" fill="var(--sv-muted)">临时对象的生命周期由表达式规则决定，不单列为一种存储期类别</text>
</svg>
<figcaption>图 2 · 四类存储期：自动、静态、线程、动态</figcaption>
</figure>
<p>自动存储期的对象包括块作用域变量和函数参数。存储通常在栈上，进入作用域时获得，离开作用域时按构造的逆序销毁。对类类型，生命周期从初始化完成开始；如果初始化抛异常，已构造的子对象会被销毁。<code>goto</code> 跳过带初始化的声明是编译错误（准确地说，是禁止跳入一个具有非空初始化 non-vacuous initialization 的自动变量的作用域），这不是刁难，而是防止对象在没有构造的情况下被使用。</p>
<p>静态存储期的对象包括命名空间作用域变量、静态数据成员和 static 局部变量。所有静态存储期对象在程序启动时先零初始化，再做常量初始化（能在编译期算出的部分）；需要动态初始化的，命名空间作用域变量在启动阶段按定义顺序进行，块作用域的 static 局部变量则等到首次执行到声明时。不同翻译单元之间的动态初始化顺序没有保证，这就是静态初始化顺序问题（static initialization order fiasco）。函数内 static 局部变量的初始化 C++11 起保证线程安全；静态对象的析构在程序退出时按构造完成的逆序进行。</p>
<p>线程存储期用 <code>thread_local</code> 声明（C++11）：每个线程拥有独立实例，在该线程首次使用前初始化，线程退出时销毁。更准确地说，块作用域的 <code>thread_local</code> 在线程首次执行到声明时初始化；命名空间作用域的初始化可能延迟到该线程首次 odr-use，不同线程的初始化顺序互不相关。动态存储期由 new 表达式开始：先调用 <code>operator new</code> 获得存储，再构造对象；delete 先析构再释放。未 delete 的动态对象不会被析构，进程退出时其存储通常由系统回收，但这不等于可以依赖它，因为析构函数和资源释放都不会发生。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>存储期</th><th>典型位置</th><th>开始</th><th>结束</th><th>例子</th></tr></thead>
<tbody>
<tr><td>自动 automatic</td><td>栈</td><td>进入作用域并完成初始化</td><td>离开作用域</td><td>局部变量、参数</td></tr>
<tr><td>静态 static</td><td>数据段 / BSS</td><td>程序启动零初始化；局部 static 首次执行到声明时</td><td>程序结束</td><td>全局变量、static 局部变量</td></tr>
<tr><td>线程 thread</td><td>TLS 区</td><td>线程内首次执行到声明 / 首次 odr-use 前</td><td>线程退出</td><td>thread_local 对象</td></tr>
<tr><td>动态 dynamic</td><td>自由存储区</td><td>new 表达式完成构造</td><td>delete；未 delete 则不析构</td><td>new 出来的对象</td></tr>
</tbody>
</table></div>
<div class="callout callout--warn"><span class="callout__label">警告</span><div>返回指向自动对象的指针或引用是悬垂；把 static 局部对象的地址交给另一个线程时，要确认初始化已经完成；<code>thread_local</code> 在不同线程是不同对象，把某个线程实例的地址交给别的线程使用时，必须保证该线程仍然存活并有同步，线程退出后该地址立即悬垂。</div></div>
</section>

<section class="sec">
<h2>栈帧与 new：从函数调用到数组 cookie</h2>
<p>函数调用时，运行时需要一个地方保存返回地址、调用者的寄存器、局部变量和临时对象，这块区域叫栈帧（stack frame）。x86-64 的栈向低地址增长：<code>call</code> 指令把返回地址压到栈顶，被调用函数通常再保存 rbp，然后为局部变量下移 rsp。参数优先走寄存器，System V 的整数/指针参数用 rdi、rsi、rdx、rcx、r8、r9，浮点参数用 xmm0 到 xmm7，超出部分才压栈。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="x86-64 典型栈帧布局：调用者栈帧、返回地址、保存的 rbp、局部变量与对齐填充" font-family="inherit">
<defs>
<marker id="memory-layout-arrow-2" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
<path d="M0,0 L8,3 L0,6 Z" fill="var(--sv-b)"/>
</marker>
</defs>
<text x="380" y="22" text-anchor="middle" font-size="15" fill="var(--sv-ink)">x86-64 典型栈帧：高地址在上，栈向低地址增长</text>

<text x="36" y="60" font-size="12" fill="var(--sv-muted)">高地址</text>
<text x="36" y="336" font-size="12" fill="var(--sv-muted)">低地址</text>

<rect x="200" y="38" width="340" height="40" rx="3" fill="var(--sv-a2)" fill-opacity="0.25" stroke="var(--sv-a2)"/>
<text x="370" y="63" text-anchor="middle" font-size="13" fill="var(--sv-ink)">调用者的局部变量与临时对象</text>

<rect x="200" y="82" width="340" height="34" rx="3" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="370" y="104" text-anchor="middle" font-size="12" fill="var(--sv-ink)">调用参数（寄存器放不下时压栈）</text>

<rect x="200" y="120" width="340" height="34" rx="3" fill="var(--sv-b)" fill-opacity="0.3" stroke="var(--sv-b)"/>
<text x="370" y="142" text-anchor="middle" font-size="13" fill="var(--sv-ink)">返回地址 return address</text>
<text x="550" y="142" font-size="12" fill="var(--sv-muted)">call 指令压入</text>

<rect x="200" y="158" width="340" height="34" rx="3" fill="var(--sv-b2)" fill-opacity="0.3" stroke="var(--sv-b2)"/>
<text x="370" y="180" text-anchor="middle" font-size="13" fill="var(--sv-ink)">保存的帧指针（saved rbp）</text>
<text x="550" y="180" font-size="12" fill="var(--sv-muted)">可选，取决于优化</text>

<rect x="200" y="196" width="340" height="46" rx="3" fill="var(--sv-a)" fill-opacity="0.3" stroke="var(--sv-a)"/>
<text x="370" y="218" text-anchor="middle" font-size="13" fill="var(--sv-ink)">当前函数的局部变量与临时对象</text>
<text x="370" y="234" text-anchor="middle" font-size="12" fill="var(--sv-muted)">按构造逆序销毁</text>

<rect x="200" y="246" width="340" height="24" rx="3" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="4 3"/>
<text x="370" y="263" text-anchor="middle" font-size="12" fill="var(--sv-muted)">对齐填充（保证调用边界 16 字节对齐）</text>

<line x1="170" y1="286" x2="560" y2="286" stroke="var(--sv-ink)" stroke-width="1.5"/>
<text x="170" y="282" text-anchor="end" font-size="12" fill="var(--sv-ink)">rsp → 当前栈顶</text>

<rect x="200" y="298" width="340" height="30" rx="3" fill="var(--sv-c)" fill-opacity="0.18" stroke="var(--sv-c)" stroke-dasharray="4 3"/>
<text x="370" y="318" text-anchor="middle" font-size="12" fill="var(--sv-muted)">red zone 128 B（叶子函数，System V 典型）</text>

<line x1="620" y1="52" x2="620" y2="278" stroke="var(--sv-b)" stroke-width="1.5" marker-end="url(#memory-layout-arrow-2)"/>
<text x="632" y="166" font-size="12" fill="var(--sv-muted)">栈增长方向</text>

<text x="380" y="360" text-anchor="middle" font-size="12" fill="var(--sv-muted)">示意：参数传递、帧指针与 red zone 随 ABI、编译器、优化级别变化</text>
</svg>
<figcaption>图 3 · 栈帧示意：返回地址、保存的 rbp、局部变量与对齐填充</figcaption>
</figure>
<p>“典型布局”不等于标准。是否保留帧指针取决于优化级别，<code>-fomit-frame-pointer</code> 很常见；red zone 是 System V 在 rsp 下方为叶子函数预留的 128 字节，ABI 明确要求信号与中断处理不得改写它；栈大小也由平台和线程配置决定，Linux 主线程常见 8 MB，Windows 默认 1 MB。递归深度、<code>alloca</code> 与非标准 VLA 都直接消耗栈空间，不要用“栈很大”为无界递归辩护。</p>
<p>new 表达式和 <code>operator new</code> 是两件事。<code>new T(args)</code> 先调用 <code>operator new(sizeof(T))</code> 取得存储，再在存储上构造 T；如果构造抛异常，对应的 <code>operator delete</code> 会被调用。<code>new T[n]</code> 先分配 n 个元素的空间，再逐个构造；典型实现会在元素前放一个数组 cookie 记录元素个数，供 <code>delete[]</code> 使用，是否存在及大小由 ABI 与元素类型决定（Itanium 用 size_t，可平凡析构时可能省略），机制细节见 allocation 一篇。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="new[] 数组分配块中的 cookie 与连续元素布局" font-family="inherit">
<defs>
<marker id="memory-layout-arrow-4" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
<path d="M0,0 L8,3 L0,6 Z" fill="var(--sv-ink)"/>
</marker>
<marker id="memory-layout-arrow-4b" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
<path d="M0,0 L8,3 L0,6 Z" fill="var(--sv-c)"/>
</marker>
</defs>
<text x="380" y="24" text-anchor="middle" font-size="15" fill="var(--sv-ink)">new[] 的分配块：数组 cookie 位于元素之前</text>
<rect x="70" y="96" width="620" height="96" rx="4" fill="none" stroke="var(--sv-line)" stroke-dasharray="5 3"/>
<text x="80" y="88" font-size="12" fill="var(--sv-muted)">一次 operator new[] 取得的分配块</text>

<rect x="88" y="112" width="128" height="64" rx="3" fill="var(--sv-a2)" fill-opacity="0.3" stroke="var(--sv-a2)"/>
<text x="152" y="138" text-anchor="middle" font-size="13" fill="var(--sv-ink)">数组 cookie</text>
<text x="152" y="158" text-anchor="middle" font-size="12" fill="var(--sv-muted)">元素个数（典型 8 B）</text>

<rect x="232" y="112" width="140" height="64" rx="3" fill="var(--sv-b)" fill-opacity="0.3" stroke="var(--sv-b)"/>
<text x="302" y="144" text-anchor="middle" font-size="13" fill="var(--sv-ink)">元素 0</text>
<rect x="388" y="112" width="140" height="64" rx="3" fill="var(--sv-b)" fill-opacity="0.3" stroke="var(--sv-b)"/>
<text x="458" y="144" text-anchor="middle" font-size="13" fill="var(--sv-ink)">元素 1</text>
<rect x="544" y="112" width="120" height="64" rx="3" fill="var(--sv-b)" fill-opacity="0.3" stroke="var(--sv-b)"/>
<text x="604" y="144" text-anchor="middle" font-size="13" fill="var(--sv-ink)">元素 2 …</text>

<line x1="302" y1="66" x2="302" y2="106" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#memory-layout-arrow-4)"/>
<text x="302" y="60" text-anchor="middle" font-size="12" fill="var(--sv-ink)">new[] 返回的指针</text>

<line x1="152" y1="216" x2="152" y2="182" stroke="var(--sv-c)" stroke-width="1.5" marker-end="url(#memory-layout-arrow-4b)"/>
<text x="166" y="214" font-size="12" fill="var(--sv-ink)">delete[] 从这里回退读取</text>

<text x="380" y="258" text-anchor="middle" font-size="12" fill="var(--sv-muted)">元素按 sizeof(T) 等距排列；sizeof(T) 是 alignof(T) 的整数倍，每个元素都对齐</text>
<text x="380" y="282" text-anchor="middle" font-size="12" fill="var(--sv-muted)">cookie 内容通常是元素个数：Itanium 用 size_t（LP64 8 B），高对齐时 cookie 与元素之间还会补 padding</text>
<text x="380" y="306" text-anchor="middle" font-size="12" fill="var(--sv-muted)">可平凡析构的元素类型，部分实现会省略 cookie，delete[] 无需元素计数</text>
<text x="380" y="342" text-anchor="middle" font-size="12" fill="var(--sv-muted)">用 delete 释放 new[]、或用 free 释放 new，都是未定义行为</text>
</svg>
<figcaption>图 4 · new[] 的 cookie 与连续元素：返回指针指向元素 0，而不是分配块起点</figcaption>
</figure>
<p>如果存在 cookie，<code>delete[]</code> 会从返回的指针回退读取它，再逐个析构；用 <code>delete</code> 释放 <code>new[]</code> 的结果，或用 <code>free</code> 释放 <code>new</code> 的内存，都是未定义行为。<code>new T[0]</code> 合法，返回一个非空且可安全 <code>delete[]</code> 的指针。placement new 只构造不分配，缓冲区的大小与对齐要自己保证；重复使用同一块存储时，C++17 起通过旧指针访问新对象可能需要 <code>std::launder</code>。这些机制与对齐版 new 的细节在 allocation 一篇展开。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>分配器的实现（arena、pool、tcmalloc、jemalloc 的取舍）不在本篇展开，留给 allocation 一篇；这里只需记住：new 表达式负责“分配 + 构造”，delete 负责“析构 + 释放”，两者必须配对。</div></div>
</section>

<section class="sec">
<h2>工程实践与排障</h2>
<p>按对齐值从大到小排列成员能消掉大部分 padding（前提是所有成员同一访问控制、且没有虚函数）；但不要为了几字节打乱公开结构体的字段顺序，序列化和 ABI 兼容更重要。把关键假设写成 <code>static_assert</code>：sizeof、alignof、offsetof 都可以是常量表达式。不要用 <code>memcmp</code> 比较含 padding 的结构体，也不要直接把结构体写入文件或网络；逐字段序列化，或用明确的字节布局。</p>
<p>谨慎使用 <code>#pragma pack</code> 和 <code>__attribute__((packed))</code>：它们会让成员落在未对齐地址，读取时可能触发异常或生成多次访问，取地址再解引用更是未定义行为。确实需要按协议解析时，先 <code>memcpy</code> 到对齐的局部变量再使用。SIMD 缓冲区用 <code>alignas</code> 声明，堆上用 C++17 对齐分配；不要假设 <code>malloc</code> 返回 32 或 64 字节对齐。</p>
<pre class="code" data-lang="bash"><code>g++ -std=c++20 -g -Wpadded layout.cpp -o layout
clang++ -std=c++20 -Xclang -fdump-record-layouts -c layout.cpp
pahole -C Widget ./layout   # 需要带调试信息的可执行文件</code></pre>
<p>排查布局问题的工具链很直接：GCC/Clang 的 <code>-Wpadded</code> 会在插入 padding 时告警；Clang 的 <code>-Xclang -fdump-record-layouts</code> 打印每个类的字段偏移与大小；<code>pahole</code> 从 DWARF 调试信息还原布局；MSVC 用 <code>/d1reportSingleClassLayoutWidget</code> 输出同类信息。运行期用 <code>-fsanitize=alignment</code> 捕获未对齐访问，用 ASan 捕获越界和悬垂。</p>
<p>常见误区：把 sizeof 当成字段和；以为 padding 一定是 0；对含 padding 的结构体做 <code>memcmp</code>；以为空基类一定占 1 字节；以为 <code>new[]</code> 的指针就是分配块起点。每一个都能变成真实 bug。</p>
<div class="callout callout--formula"><span class="callout__label">口径</span><div>本文数字默认 x86-64、LP64、GCC/Clang 与 Itanium C++ ABI。Windows MSVC 的 long 为 4 字节，部分位域、空基类与名称修饰规则不同；涉及二进制接口时，以目标平台的 ABI 文档和实测为准。</div></div>
</section>

<section class="sec">
<h2>自测与延伸阅读</h2>
<p>四道题覆盖布局计算、空基类优化、存储期与严格别名。</p>
<details class="quiz"><summary>Q1 · x86-64 上 <code>struct { char a; double b; char c; }</code> 的 sizeof 和三个成员偏移是多少？怎样重排能变小？</summary><div class="quiz__a">a 在 0，padding 1 到 7，b 在 8 到 15，c 在 16，尾部补到 24，所以 sizeof 为 24、alignof 为 8。改成 { double b; char a; char c; } 后 b 在 0，a 在 8，c 在 9，尾部补 6 字节，sizeof 为 16。</div></details>
<details class="quiz"><summary>Q2 · 为什么 sizeof(空类) 是 1，而空基类子对象可以是 0 字节？</summary><div class="quiz__a">完整对象必须有非零大小，且两个不同对象要有不同地址，所以空类完整对象至少 1 字节。作为基类子对象时，它与派生类对象共享地址不会造成混淆，标准允许空基类优化把它压到 0；这是允许而非所有实现都强制，跨 ABI 时要用 static_assert 验证。</div></details>
<details class="quiz"><summary>Q3 · 一个函数返回局部数组的指针，为什么危险？如果把数组改成 static，问题消失了吗？</summary><div class="quiz__a">局部数组是自动存储期，函数返回后栈帧失效，指针悬垂。改成 static 后指针有效，但所有调用共享同一份数据，不可重入、非线程安全，递归会互相覆盖。更好的做法是返回值对象、由调用方传入缓冲区，或用动态存储并明确所有权。</div></details>
<details class="quiz"><summary>Q4 · <code>float f = 1.0f;</code> 用 <code>reinterpret_cast&lt;int*&gt;(&amp;f)</code> 读位模式，为什么在 -O2 下可能出错？正确写法是什么？</summary><div class="quiz__a">这违反严格别名规则：通过 int 类型的左值访问 float 对象是未定义行为，编译器可以假设两个指针不别名并重排优化。正确写法是 C++20 的 std::bit_cast&lt;std::uint32_t&gt;(f)，或在 C++17 及以前用 std::memcpy 拷到 uint32_t 再读；两者都不依赖别名假设。</div></details>
<ul class="refs">
<li><b>cppreference: Object</b> — cppreference.com。对象表示、值表示、子对象与生命周期规则的权威速查，并包含 alignment 小节。</li>
<li><b>cppreference: alignof / alignas</b> — cppreference.com。alignof、alignas、基础对齐与扩展对齐，以及 C++17 对齐 new 的规则汇总。</li>
<li><b>cppreference: Storage duration</b> — cppreference.com。自动、静态、线程、动态四类存储期及其初始化与销毁顺序。</li>
<li><b>Itanium C++ ABI</b> — Itanium C++ ABI 工作组，GCC/Clang 在 Linux、macOS 等平台遵循。类布局、虚表、数组 cookie 与空基类优化的 ABI 级依据。</li>
<li><b>C++ Core Guidelines: ES.40–ES.46</b> — Bjarne Stroustrup、Herb Sutter。表达式与转换规则；其中 ES.46 关于窄化转换的约束与花括号聚合初始化直接相关。</li>
</ul>
</section>`
};
