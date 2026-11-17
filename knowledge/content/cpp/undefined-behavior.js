window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["undefined-behavior"] = {
  slug: "undefined-behavior",
  title: "未定义行为与严格别名",
  subtitle: "编译器没有义务让你的错误代码工作",
  level: 2,
  cluster: "对象与资源",
  tags: ["UB", "严格别名", "优化"],
  summary: "未定义行为不是结果随机，而是标准不再保护你的程序。区分 UB、未指定与实现定义行为，讲清编译器如何利用 UB 优化、严格别名与对象生命周期，给出 sanitizer 的覆盖边界。",
  keyPoints: [
    "UB 指标准对执行不施加任何要求，既非结果不确定也非必然崩溃；未指定行为仍在标准内，实现定义行为必须写入文档",
    "优化器以程序无 UB 为前提做代数化简、删除分支与重排访存，因此错误会跨语句扩散",
    "严格别名要求通过对象的真实类型访问，位重解释应使用 memcpy 或 C++20 的 std::bit_cast",
    "对象生命周期结束后存储可能仍在，但访问已结束生命周期的对象依然是 UB",
    "ASan、UBSan、TSan、MSan 各自覆盖不同错误，没有单一工具能检测全部 UB"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>为什么同一份代码，换个优化级别就变了</h2>
<p>在 <code>float</code> 采用 32 位 IEEE-754 的平台上，把一个 32 位整数按位模式解释成 <code>float</code>，是网络协议和序列化里最常见的操作之一。很多人第一次会这样写：</p>
<pre class="code" data-lang="cpp"><code>#include &lt;cstdint&gt;

float read_float(const std::uint32_t* p) {
    return *reinterpret_cast&lt;const float*&gt;(p);   // 示意：违反严格别名
}</code></pre>
<p>在 -O0 下它跑得好好的，在某个调用点甚至连续几个月都正确。切到 -O2，返回值开始偶尔变成旧值、常量或者别的东西。这不是编译器变笨了，而是这段代码从来没有被标准保证过：它触发了<mark>未定义行为</mark>（undefined behavior，UB）。</p>
<p>UB 的准确含义是：标准对这个程序的执行<mark>不施加任何要求</mark>。不要求崩溃，不要求报错，不要求结果可重复，也不要求影响只停留在出错的那一行。编译器可以假定 UB 永远不会发生，并据此重写整段代码。</p>
<p>这句话常被误读成“编译器会报复你”。真实机制更冷静：优化器要做代数化简、循环变换和指令重排，这些变换只在“程序没有 UB”的前提下成立。你写下 UB，就等于主动撤掉了这些前提，让编译器可以把程序解释成任意行为。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>UB 不是“结果不确定”，而是“规则不再适用”。未指定行为仍在规则之内，UB 在规则之外。判断一段代码安不安全，不看它这次跑出了什么，而看它是否满足标准的前置条件。</div></div>
</section>

<section class="sec">
<h2>三种行为，三种约束强度</h2>
<p>标准把程序行为分成三档，约束强度依次递减。把它们混为一谈，是讨论 UB 时最常见的错误。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>类别</th><th>标准的约束</th><th>典型例子</th><th>可移植性</th></tr></thead>
<tbody>
<tr><td><b>未定义行为</b>（UB）</td><td>不施加任何要求，程序脱离标准保护</td><td>越界写、有符号溢出、数据竞争、别名违规</td><td>无任何保证</td></tr>
<tr><td><b>未指定行为</b><br>unspecified behavior</td><td>允许若干结果之一，不要求文档化选哪个</td><td>函数实参求值顺序、<code>f() + g()</code> 的求值先后</td><td>结果落在合法集合内</td></tr>
<tr><td><b>实现定义行为</b><br>implementation-defined behavior</td><td>必须选定一种并写入文档</td><td><code>char</code> 是否有符号、<code>long</code> 的宽度（LLP64 与 LP64）</td><td>有定义，但依赖具体实现</td></tr>
</tbody></table></div>
<p>未指定行为仍然<mark>在标准之内</mark>。标准列出一个允许集合，实现挑一个执行，但不必告诉你挑了哪个。所以同一段代码在 GCC 和 MSVC 上可能得到不同但都合法的结果，程序本身仍是良定义的。</p>
<p>实现定义行为多了一层义务：实现必须把选择写进文档。你可以查编译器手册，也可以在 <code>&lt;climits&gt;</code> 里读到 <code>INT_MAX</code>，或在 <code>&lt;limits&gt;</code> 里读到 <code>std::numeric_limits&lt;int&gt;::max()</code>。这类行为可以安全依赖，只是要意识到它绑定了平台。</p>
<p>UB 则连“允许集合”都不给。标准在 [intro.abstract] 里约束的对象不是程序，而是执行程序的<mark>实现</mark>：实现执行这个程序时不受任何要求约束，甚至连第一个未定义操作之前的操作也不作要求。注意这句话的范围是<mark>整个执行</mark>，不只是出错的那条语句。这正是后面所有反直觉现象的根源。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>不要把“未定义结果”当成 UB 的同义词。一个变量的值“不确定”可能只是未初始化或未指定；而 UB 意味着程序已经脱离标准的约束。反过来也不成立：UB 不保证结果看起来异常，它最常见的表现是长期正常，然后在换编译器、换优化级别或换输入时突然失效。</div></div>
</section>

<section class="sec">
<h2>六类最常见的未定义行为</h2>
<p>日常代码里的 UB 高度集中在少数几类。下面按越界访问、悬垂引用、有符号溢出、非法算术、未初始化读取、数据竞争这六类展开；它们有个共同特征：在调试构建里往往“看起来正常”，因为 -O0 几乎不做重排和删除。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="未定义行为的四类后果：被优化删除、按错误类型解释、读到未写值、崩溃或静默损坏" font-family="inherit">
<defs>
<marker id="undefined-behavior-arrow-1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"/>
</marker>
</defs>
<rect x="290" y="14" width="180" height="44" rx="8" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="380" y="42" text-anchor="middle" font-size="16" fill="var(--sv-ink)">未定义行为</text>
<path d="M380 58 V86" stroke="var(--sv-line)" fill="none"/>
<path d="M96 86 H672" stroke="var(--sv-line)" fill="none"/>
<path d="M96 86 V106" stroke="var(--sv-line)" fill="none" marker-end="url(#undefined-behavior-arrow-1)"/>
<path d="M288 86 V106" stroke="var(--sv-line)" fill="none" marker-end="url(#undefined-behavior-arrow-1)"/>
<path d="M480 86 V106" stroke="var(--sv-line)" fill="none" marker-end="url(#undefined-behavior-arrow-1)"/>
<path d="M672 86 V106" stroke="var(--sv-line)" fill="none" marker-end="url(#undefined-behavior-arrow-1)"/>
<rect x="18" y="110" width="156" height="118" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<rect x="210" y="110" width="156" height="118" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<rect x="402" y="110" width="156" height="118" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<rect x="594" y="110" width="156" height="118" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="96" y="138" text-anchor="middle" font-size="15" fill="var(--sv-ink)">被静默删除</text>
<text x="96" y="164" text-anchor="middle" font-size="12" fill="var(--sv-muted)">解引用后的判空</text>
<text x="96" y="184" text-anchor="middle" font-size="12" fill="var(--sv-muted)">整段消失</text>
<text x="288" y="138" text-anchor="middle" font-size="15" fill="var(--sv-ink)">按错误类型解释</text>
<text x="288" y="164" text-anchor="middle" font-size="12" fill="var(--sv-muted)">float* 与 int*</text>
<text x="288" y="184" text-anchor="middle" font-size="12" fill="var(--sv-muted)">被当作不重叠</text>
<text x="480" y="138" text-anchor="middle" font-size="15" fill="var(--sv-ink)">读到未写值</text>
<text x="480" y="164" text-anchor="middle" font-size="12" fill="var(--sv-muted)">未初始化变量</text>
<text x="480" y="184" text-anchor="middle" font-size="12" fill="var(--sv-muted)">值不可预测</text>
<text x="672" y="138" text-anchor="middle" font-size="15" fill="var(--sv-ink)">崩溃或损坏</text>
<text x="672" y="164" text-anchor="middle" font-size="12" fill="var(--sv-muted)">越界写、悬垂指针</text>
<text x="672" y="184" text-anchor="middle" font-size="12" fill="var(--sv-muted)">破坏无关数据</text>
<rect x="40" y="256" width="680" height="100" rx="8" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="380" y="284" text-anchor="middle" font-size="14" fill="var(--sv-ink)">共同点：标准既不规定结果，也不规定失败方式</text>
<text x="380" y="310" text-anchor="middle" font-size="12" fill="var(--sv-muted)">同一次越界，可能读到旧值、立即崩溃，或被优化器证明不会发生而整段删除</text>
<text x="380" y="334" text-anchor="middle" font-size="12" fill="var(--sv-muted)">所以跑通一次不能作为正确性证据</text>
</svg>
<figcaption>图 1 · UB 的后果是一个集合，崩溃只是其中最显眼的一种</figcaption>
</figure>
<h3>越界访问与悬垂引用</h3>
<p>数组下标只在半开区间内合法。<code>&amp;a[n]</code> 可以作为尾后指针存在，但解引用它就是 UB。<code>std::vector::operator[]</code> 不做检查，越界即 UB；<code>.at()</code> 会抛 <code>std::out_of_range</code>，代价是多一次边界检查。<code>std::string</code> 同理。</p>
<p>悬垂（dangling）包括：<code>delete</code> 或 <code>free</code> 之后继续使用指针、返回局部变量的引用、<code>push_back</code> 触发扩容后继续用旧指针或迭代器。对象销毁后存储可能被复用，读到的字节没有任何语义。</p>
<h3>有符号溢出与非法算术</h3>
<p><code>INT_MAX + 1</code> 是有符号溢出，属于 UB；对应的 <code>unsigned</code> 运算则按 2 的 N 次方取模，是良定义的。除零、<code>INT_MIN / -1</code> 同样落在 UB 一侧。需要检测溢出时，用 GCC/Clang 的 <code>__builtin_add_overflow</code>，或先在更宽的类型里计算再判断范围。</p>
<h3>未初始化读取</h3>
<p>读取未初始化的自动变量（少数 <code>unsigned char</code>/<code>std::byte</code> 的字节复制场景除外）是 UB。<code>std::vector&lt;int&gt; v(10)</code> 会值初始化为 0，而 <code>new int[10]</code> 不会，这个差别经常被忽略。C++26 工作草案已采纳 P2795R5，计划把部分未初始化读取归入 erroneous behavior：行为不再是 UB，但标准仍建议实现给出诊断，程序也不应依赖这种值。</p>
<h3>数据竞争</h3>
<p>两个线程可能并发地访问同一内存位置，至少有一个是非原子的写，且两次访问之间没有 happens-before 关系，就是数据竞争，标准明确规定为 UB。它不是“读到旧值”这么温和，优化器可以据此做出任意假设。<code>std::atomic</code>、互斥量、线程启动与 join 等同步手段才能建立 happens-before，<code>volatile</code> 不行。</p>
<p>其余高频项还有：解引用空指针、未对齐访问、<code>delete</code> 与 <code>new[]</code> 不匹配、移位量为负或不小于类型宽度。它们的共同点是“标准没有规定必须发生什么”，而不是“标准规定了会发生坏事”。</p>
</section>

<section class="sec">
<h2>编译器如何利用你的 UB</h2>
<p>优化器不是在一行一行地翻译，而是在一套等价变换上工作。这些变换的正确性依赖于一个全局假设：程序执行期间不会出现 UB。于是 UB 反而成了优化器的许可证。</p>
<div class="formula">优化前提：程序无 UB　⇒　可做代数化简、删除不可达分支、假设指针非空、假设循环终止</div>
<p>看一个最小的例子。对 <code>int</code> 来说，<code>x + 1</code> 可能溢出，而溢出是 UB；既然 UB 不会发生，优化器就可以认为 <code>x + 1</code> 永远大于 <code>x</code>。</p>
<pre class="code" data-lang="cpp"><code>int f(int x) {
    return x + 1 &gt; x;   // 若溢出则 UB；无溢出时恒为 true
}</code></pre>
<p>在 GCC 或 Clang 的 -O2 下，这个函数通常被直接编译成 <code>return true;</code>。传入 <code>INT_MAX</code> 时，-O0 返回 false，-O2 返回 true。两条路径都不违反标准，因为程序根本没有被要求给出答案。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="源码 x 加 1 大于 x 与优化后返回 true 的对照，以及优化器的三段推理" font-family="inherit">
<defs>
<marker id="undefined-behavior-arrow-2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"/>
</marker>
</defs>
<text x="380" y="28" text-anchor="middle" font-size="15" fill="var(--sv-ink)">同一段函数，两种编译结果</text>
<rect x="20" y="46" width="330" height="150" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="34" y="70" font-size="12" fill="var(--sv-muted)">源码</text>
<text x="34" y="102" font-size="13" fill="var(--sv-ink)">int f(int x) {</text>
<text x="34" y="130" font-size="13" fill="var(--sv-ink)">    return x + 1 &gt; x;</text>
<text x="34" y="158" font-size="13" fill="var(--sv-ink)">}</text>
<text x="34" y="184" font-size="12" fill="var(--sv-muted)">有符号加法，溢出即 UB</text>
<rect x="410" y="46" width="330" height="150" rx="8" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="424" y="70" font-size="12" fill="var(--sv-muted)">GCC / Clang -O2（典型实现）</text>
<text x="424" y="102" font-size="13" fill="var(--sv-ink)">int f(int x) {</text>
<text x="424" y="130" font-size="13" fill="var(--sv-ink)">    return true;</text>
<text x="424" y="158" font-size="13" fill="var(--sv-ink)">}</text>
<text x="424" y="184" font-size="12" fill="var(--sv-muted)">判断被完全消除</text>
<path d="M352 121 H406" stroke="var(--sv-line)" stroke-width="2" fill="none" marker-end="url(#undefined-behavior-arrow-2)"/>
<text x="379" y="110" text-anchor="middle" font-size="12" fill="var(--sv-muted)">优化</text>
<rect x="40" y="216" width="680" height="140" rx="8" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="56" y="242" font-size="14" fill="var(--sv-ink)">优化器的推理链</text>
<text x="56" y="270" font-size="13" fill="var(--sv-ink)">1. 假定程序无 UB，因此 x + 1 永不溢出</text>
<text x="56" y="296" font-size="13" fill="var(--sv-ink)">2. 于是 x + 1 &gt; x 恒为真，直接返回 true</text>
<text x="56" y="322" font-size="13" fill="var(--sv-ink)">3. f(INT_MAX)：-O0 返回 false，-O2 返回 true</text>
<text x="56" y="344" font-size="12" fill="var(--sv-muted)">两条路径都不违反标准，因为程序从未被要求给出答案</text>
</svg>
<figcaption>图 2 · 编译器利用“不会溢出”这个假设，把比较化简成常量</figcaption>
</figure>
<p>同样的推理会删掉“多余”的检查。下面这段代码里，解引用发生在判空之前，一旦 <code>p</code> 为空，函数体已经进入 UB；优化器因此可以认为 <code>p</code> 永远非空，把检查整个删掉。</p>
<pre class="code" data-lang="cpp"><code>int load_or_zero(int* p) {
    int v = *p;                  // 若 p 为空，这里已经 UB
    if (p == nullptr) return 0;  // 于是这个分支可以删除
    return v;
}</code></pre>
<p>还有更隐蔽的一类：编译器可以把 UB 之前的计算挪到 UB 之后，甚至删掉依赖它的循环。这常被称为“时间旅行”优化。它解释了为什么一个看似只影响某行的错误，会让几十行之外的断言失效。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>-O0 不是“语义参考实现”，它只是“几乎不优化的实现”。用 -O0 的行为去推断程序是否正确，等于用最宽松的执行环境去检验一份没有保证的代码。语义应在开启优化的构建（如 -O2）上验证，违规应在 -O1 加 sanitizer 的构建上捕获；-O0 只适合单步调试。</div></div>
</section>

<section class="sec">
<h2>严格别名：编译器假设不同指针不重叠</h2>
<p>严格别名（strict aliasing）是 C 与 C++ 共有的规则，也是类型双关（type punning）最常踩的坑。核心思想是：通过某种类型的左值访问对象时，对象的动态类型必须与它匹配，否则行为未定义。</p>
<div class="formula">合法访问：T ／ cv T ／ 与 T 相似的类型（C++20）／ 与 T 对应的 signed 或 unsigned 类型 ／ 包含上述类型的聚合或 union ／ T 的基类 ／ char、unsigned char、std::byte</div>
<p>这条规则给了优化器一个重要信息：<code>int*</code> 和 <code>float*</code> 不会指向同一块存储。于是它可以放心地把“通过 int* 的写”和“通过 float* 的读”重新排序，而不必考虑两者相互影响。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="int 指针写入与 float 指针读取指向同一块四字节存储，编译器却假设两者不重叠" font-family="inherit">
<defs>
<marker id="undefined-behavior-arrow-3" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"/>
</marker>
</defs>
<text x="380" y="26" text-anchor="middle" font-size="15" fill="var(--sv-ink)">严格别名：两条类型路径指向同一块字节</text>
<rect x="40" y="52" width="170" height="54" rx="8" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="125" y="76" text-anchor="middle" font-size="13" fill="var(--sv-ink)">int* 写入</text>
<text x="125" y="96" text-anchor="middle" font-size="12" fill="var(--sv-muted)">0x3f800000</text>
<rect x="300" y="52" width="170" height="54" rx="8" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="385" y="76" text-anchor="middle" font-size="13" fill="var(--sv-ink)">float* 读取</text>
<text x="385" y="96" text-anchor="middle" font-size="12" fill="var(--sv-muted)">期望 1.0f</text>
<text x="240" y="148" text-anchor="middle" font-size="12" fill="var(--sv-muted)">同一块 4 字节存储</text>
<rect x="120" y="160" width="60" height="46" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<rect x="180" y="160" width="60" height="46" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<rect x="240" y="160" width="60" height="46" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<rect x="300" y="160" width="60" height="46" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="150" y="189" text-anchor="middle" font-size="12" fill="var(--sv-muted)">b0</text>
<text x="210" y="189" text-anchor="middle" font-size="12" fill="var(--sv-muted)">b1</text>
<text x="270" y="189" text-anchor="middle" font-size="12" fill="var(--sv-muted)">b2</text>
<text x="330" y="189" text-anchor="middle" font-size="12" fill="var(--sv-muted)">b3</text>
<path d="M125 108 L155 156" stroke="var(--sv-line)" fill="none" marker-end="url(#undefined-behavior-arrow-3)"/>
<path d="M385 108 L335 156" stroke="var(--sv-line)" fill="none" marker-end="url(#undefined-behavior-arrow-3)"/>
<rect x="500" y="52" width="240" height="164" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="516" y="78" font-size="13" fill="var(--sv-ink)">编译器看到的约束</text>
<text x="516" y="106" font-size="12" fill="var(--sv-muted)">int* 与 float* 不指向</text>
<text x="516" y="126" font-size="12" fill="var(--sv-muted)">同一对象（no alias）</text>
<text x="516" y="154" font-size="12" fill="var(--sv-ink)">→ 两次访问可交换</text>
<text x="516" y="174" font-size="12" fill="var(--sv-ink)">→ 读可被提到写之前</text>
<text x="516" y="198" font-size="12" fill="var(--sv-muted)">你读到的是旧值</text>
<rect x="40" y="252" width="680" height="104" rx="8" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="56" y="280" font-size="13" fill="var(--sv-ink)">合法替代：std::memcpy 按字节复制，或 C++20 std::bit_cast&lt;float&gt;(bits)</text>
<text x="56" y="308" font-size="12" fill="var(--sv-muted)">char、unsigned char、std::byte 可以合法地观察任何对象的字节表示</text>
<text x="56" y="334" font-size="12" fill="var(--sv-muted)">-fno-strict-aliasing 只是关掉优化，不改变这段代码不符合标准的事实</text>
</svg>
<figcaption>图 3 · 严格别名让优化器可以重排对同一地址的两种类型访问</figcaption>
</figure>
<p>正确的位重解释有两条标准路径：按字节复制，或用 C++20 的 <code>std::bit_cast</code>。下面的程序在常见平台上可以直接编译运行（<code>g++ -std=c++20 -O2</code>），其中的 <code>static_assert</code> 把平台假设写在了明面上。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;bit&gt;
#include &lt;cstdint&gt;
#include &lt;cstring&gt;
#include &lt;iostream&gt;

static_assert(sizeof(float) == sizeof(std::uint32_t),
              "this example assumes a 32-bit IEEE-754 float");

// C++20：按位重解释，标准允许
float from_bits_bitcast(std::uint32_t bits) {
    return std::bit_cast&lt;float&gt;(bits);
}

// 按字节复制：任何标准版本都合法，不受严格别名限制
float from_bits_memcpy(std::uint32_t bits) {
    float f;
    std::memcpy(&amp;f, &amp;bits, sizeof f);
    return f;
}

int main() {
    const std::uint32_t value = 0x3f800000u;  // IEEE-754 的 1.0f
    std::cout &lt;&lt; from_bits_bitcast(value) &lt;&lt; '\n';
    std::cout &lt;&lt; from_bits_memcpy(value) &lt;&lt; '\n';
}</code></pre>
<p><code>std::memcpy</code> 对平凡可复制类型有明确的字节复制保证，编译器通常把它识别成一次普通加载而不产生函数调用。C++23 还提供了 <code>std::start_lifetime_as</code>，用于在一段已有的字节上显式开始隐式生命周期类型对象的生命周期。</p>
<p>有些项目用 <code>-fno-strict-aliasing</code> 关闭基于这条假设的优化。它能缓解症状，但会牺牲性能，而且只对支持的编译器有效，还必须保证所有翻译单元使用一致的选项；它并不能修复越界、悬垂等其他 UB。<code>reinterpret_cast</code> 本身不是问题，问题在于转换之后是否用新类型的左值去访问了原对象。</p>
</section>

<section class="sec">
<h2>对象生命周期：存储还在，对象可能已经没了</h2>
<p>对象生命周期（object lifetime）回答的是另一个问题：这块字节上现在有没有一个类型为 T 的对象？有，才能通过 T 的指针访问；没有，访问就是 UB，哪怕地址完全正确。</p>
<p>对一个类类型对象，生命周期从初始化完成开始，到析构函数开始执行为止。标量对象在获得大小与对齐合适的存储、且初始化（如有）完成之后开始生命周期。存储期（storage duration）描述的是存储存在多久，两者不是一回事：<code>malloc</code> 或 <code>operator new</code> 只保证存储可用，不保证其中已有类型为 T 的对象。C++20 起，隐式生命周期类型（标量、数组，以及析构函数平凡且至少有一个平凡 eligible 构造函数的类等）可以在这块存储上隐式开始生命周期；其他类型仍要用 placement new 显式构造。C++20 之前，标准对 <code>malloc</code> 得到的存储何时开始生命周期没有说清，惯常做法是一律 placement new。</p>
<ul>
<li>局部对象离开作用域、<code>delete</code> 被调用、存储被复用，都会结束生命周期。</li>
<li><code>std::vector</code> 扩容会结束旧缓冲区中所有元素的生命周期，所有指针、引用、迭代器立即失效。</li>
<li>union 同一时刻只有一个活跃成员；读取非活跃成员一般是 UB，标准布局类型的公共初始序列（common initial sequence）是明确例外。</li>
</ul>
<p>同一块存储上构造了新对象后，旧指针是否自动指向新对象，取决于“可透明替换”（transparently replaceable）：类型相同、存储完全重合、旧对象不是 const 完整对象、新旧都不是可能重叠的子对象等条件同时成立时，旧指针自动指代新对象，不需要 <code>std::launder</code>；否则才要用 C++17 的 <code>std::launder</code> 重新取得指向新对象的指针。它不改变地址，只改变这个地址被当作哪个对象。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;new&gt;

struct X { int n; };

alignas(X) unsigned char buf[sizeof(X)];
X* p = ::new (static_cast&lt;void*&gt;(buf)) X{1};  // 在裸存储上构造 X
int v1 = p-&gt;n;                                 // 1

p-&gt;~X();                                       // 生命周期结束
X* q = ::new (static_cast&lt;void*&gt;(buf)) X{2};   // 同一存储上的新对象
int v2 = q-&gt;n;                                 // 2：q 直接指向新对象
// p 与新对象满足可透明替换条件，p 已自动指向新对象，无需 launder

// 但直接由裸存储地址得到的指针不会自动指向对象，需要 launder
X* r = std::launder(reinterpret_cast&lt;X*&gt;(buf));
int v3 = r-&gt;n;                                 // 2</code></pre>
<p>实践上更稳妥的做法是让容器和智能指针管理生命周期，避免手工 placement new。这一篇只覆盖与 UB 直接相关的部分；RAII、所有权与移动语义的完整讨论放在“对象与资源”模块的相邻篇目。</p>
</section>

<section class="sec">
<h2>用 sanitizer 把 UB 变成可观测的失败</h2>
<p>UB 之所以危险，是因为它默认是静默的。sanitizer 的思路是：在编译期插入检查，把原本不可观测的违规变成一次明确的报错。它们不能证明程序正确，但能在测试覆盖到的路径上提前引爆。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="ASan、UBSan、TSan、MSan 对越界、悬垂、有符号溢出、未初始化、数据竞争、别名违规的检测覆盖矩阵" font-family="inherit">
<text x="380" y="26" text-anchor="middle" font-size="15" fill="var(--sv-ink)">四个 sanitizer 的覆盖范围</text>
<rect x="200" y="42" width="510" height="34" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="242" y="64" text-anchor="middle" font-size="12" fill="var(--sv-ink)">越界</text>
<text x="327" y="64" text-anchor="middle" font-size="12" fill="var(--sv-ink)">悬垂</text>
<text x="412" y="64" text-anchor="middle" font-size="12" fill="var(--sv-ink)">有符号溢出</text>
<text x="497" y="64" text-anchor="middle" font-size="12" fill="var(--sv-ink)">未初始化</text>
<text x="582" y="64" text-anchor="middle" font-size="12" fill="var(--sv-ink)">数据竞争</text>
<text x="667" y="64" text-anchor="middle" font-size="12" fill="var(--sv-ink)">别名违规</text>
<text x="186" y="109" text-anchor="end" font-size="13" fill="var(--sv-ink)">ASan</text>
<rect x="200" y="84" width="85" height="40" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="242" y="109" text-anchor="middle" font-size="14" fill="var(--sv-ink)">✓</text>
<rect x="285" y="84" width="85" height="40" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="327" y="109" text-anchor="middle" font-size="14" fill="var(--sv-ink)">✓</text>
<rect x="370" y="84" width="85" height="40" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="412" y="109" text-anchor="middle" font-size="14" fill="var(--sv-muted)">–</text>
<rect x="455" y="84" width="85" height="40" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="497" y="109" text-anchor="middle" font-size="14" fill="var(--sv-muted)">–</text>
<rect x="540" y="84" width="85" height="40" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="582" y="109" text-anchor="middle" font-size="14" fill="var(--sv-muted)">–</text>
<rect x="625" y="84" width="85" height="40" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="667" y="109" text-anchor="middle" font-size="14" fill="var(--sv-muted)">–</text>
<text x="186" y="149" text-anchor="end" font-size="13" fill="var(--sv-ink)">UBSan</text>
<rect x="200" y="124" width="85" height="40" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="242" y="149" text-anchor="middle" font-size="14" fill="var(--sv-ink)">~</text>
<rect x="285" y="124" width="85" height="40" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="327" y="149" text-anchor="middle" font-size="14" fill="var(--sv-muted)">–</text>
<rect x="370" y="124" width="85" height="40" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="412" y="149" text-anchor="middle" font-size="14" fill="var(--sv-ink)">✓</text>
<rect x="455" y="124" width="85" height="40" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="497" y="149" text-anchor="middle" font-size="14" fill="var(--sv-muted)">–</text>
<rect x="540" y="124" width="85" height="40" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="582" y="149" text-anchor="middle" font-size="14" fill="var(--sv-muted)">–</text>
<rect x="625" y="124" width="85" height="40" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="667" y="149" text-anchor="middle" font-size="14" fill="var(--sv-muted)">–</text>
<text x="186" y="189" text-anchor="end" font-size="13" fill="var(--sv-ink)">TSan</text>
<rect x="200" y="164" width="85" height="40" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="242" y="189" text-anchor="middle" font-size="14" fill="var(--sv-muted)">–</text>
<rect x="285" y="164" width="85" height="40" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="327" y="189" text-anchor="middle" font-size="14" fill="var(--sv-muted)">–</text>
<rect x="370" y="164" width="85" height="40" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="412" y="189" text-anchor="middle" font-size="14" fill="var(--sv-muted)">–</text>
<rect x="455" y="164" width="85" height="40" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="497" y="189" text-anchor="middle" font-size="14" fill="var(--sv-muted)">–</text>
<rect x="540" y="164" width="85" height="40" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="582" y="189" text-anchor="middle" font-size="14" fill="var(--sv-ink)">✓</text>
<rect x="625" y="164" width="85" height="40" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="667" y="189" text-anchor="middle" font-size="14" fill="var(--sv-muted)">–</text>
<text x="186" y="229" text-anchor="end" font-size="13" fill="var(--sv-ink)">MSan</text>
<rect x="200" y="204" width="85" height="40" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="242" y="229" text-anchor="middle" font-size="14" fill="var(--sv-muted)">–</text>
<rect x="285" y="204" width="85" height="40" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="327" y="229" text-anchor="middle" font-size="14" fill="var(--sv-muted)">–</text>
<rect x="370" y="204" width="85" height="40" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="412" y="229" text-anchor="middle" font-size="14" fill="var(--sv-muted)">–</text>
<rect x="455" y="204" width="85" height="40" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="497" y="229" text-anchor="middle" font-size="14" fill="var(--sv-ink)">✓</text>
<rect x="540" y="204" width="85" height="40" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="582" y="229" text-anchor="middle" font-size="14" fill="var(--sv-muted)">–</text>
<rect x="625" y="204" width="85" height="40" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="667" y="229" text-anchor="middle" font-size="14" fill="var(--sv-muted)">–</text>
<rect x="60" y="258" width="18" height="18" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="86" y="272" font-size="12" fill="var(--sv-muted)">检测并报告</text>
<rect x="210" y="258" width="18" height="18" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="236" y="272" font-size="12" fill="var(--sv-muted)">部分场景，依赖选项</text>
<rect x="400" y="258" width="18" height="18" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="426" y="272" font-size="12" fill="var(--sv-muted)">不检测</text>
<text x="380" y="318" text-anchor="middle" font-size="12" fill="var(--sv-muted)">没有单一工具覆盖全部 UB；实际项目按 ASan+UBSan、TSan 分成两套构建运行</text>
<text x="380" y="344" text-anchor="middle" font-size="12" fill="var(--sv-muted)">严格别名违规目前没有成熟的运行时检测器，只能靠规则与代码审查避免</text>
</svg>
<figcaption>图 4 · sanitizer 各管一段，组合使用才有意义</figcaption>
</figure>
<h3>四个主力工具</h3>
<ul>
<li><b>AddressSanitizer（ASan）</b>：在对象周围放红区，捕获堆、栈、全局区的越界，以及 use-after-free、double free。官方文档给出的典型时间开销约为 2 倍，内存占用也会明显增加。</li>
<li><b>UndefinedBehaviorSanitizer（UBSan）</b>：检查有符号溢出、非法移位、空指针解引用、未对齐访问、<code>vptr</code> 合法性等。多数检查默认只打印并继续，加上 <code>-fno-sanitize-recover=all</code> 才会中止。</li>
<li><b>ThreadSanitizer（TSan）</b>：基于 happens-before 检测数据竞争，开销明显更高，适合单独的并发测试构建。</li>
<li><b>MemorySanitizer（MSan）</b>：跟踪未初始化内存的传播，需要整条依赖链（包括标准库）都用 MSan 重新编译，落地成本最高。</li>
</ul>
<p>GCC 的 <code>-Wstrict-aliasing</code> 只是编译期警告，覆盖有限，不能当作运行时检测；严格别名违规目前仍主要靠规则和代码审查避免。</p>
<h3>接进构建系统</h3>
<pre class="code" data-lang="bash"><code># 地址与未定义行为检查，保留调用栈
g++ -std=c++20 -O1 -g -fsanitize=address,undefined \
    -fno-omit-frame-pointer -fno-sanitize-recover=all app.cpp -o app

# 并发检查单独一档构建
g++ -std=c++20 -O1 -g -fsanitize=thread -pthread app.cpp -o app-tsan</code></pre>
<p>工程上通常维护三套构建：普通调试、ASan+UBSan、TSan。把测试跑在这三套构建上，是性价比最高的一步。此外，<code>.at()</code> 的边界检查、<code>std::array</code> 与固定 extent 的 <code>std::span</code> 把长度编码进类型便于静态检查，以及 libstdc++ 的 <code>_GLIBCXX_DEBUG</code> 调试模式，都能在不更换工具链的前提下提前暴露一部分越界。</p>
<div class="callout callout--tip"><span class="callout__label">建议</span><div>sanitizer 只覆盖被执行到的路径。它报告的是“这里确实错了”，沉默只代表“这里没测到”。不要因为 CI 全绿就认为代码没有 UB；组合模糊测试、边界输入和静态分析，覆盖率才有意义。</div></div>
<p>还要注意，sanitizer 会改变内存布局和时序，某些 UB 在插桩后反而“消失”，另一些则暴露出来。这不是矛盾，而是 UB 本来就没有稳定表现。</p>
</section>

<section class="sec">
<h2>常见误区、安全影响与自测</h2>
<div class="duo"><div class="duo__col"><h4>“它能跑”</h4><p>在当前编译器、当前优化级别、当前输入下得到了预期输出。这是对一次执行的观察。</p></div><div class="duo__col"><h4>“它是对的”</h4><p>对所有符合前置条件的输入，程序满足标准要求。这是对一段代码的证明。</p></div></div>
<p>UB 与安全漏洞的关系不是隐喻。越界写和 use-after-free 直接构成内存破坏；类型混淆（type confusion）常常源于别名违规；未初始化读取可能把栈上的残留数据带进响应。相当一部分高危 CVE 的根因就是这几类 UB，而不是逻辑错误。</p>
<ul>
<li><b>“volatile 能解决数据竞争”</b>：不能。<code>volatile</code> 只约束编译器不要优化掉访问，不建立线程间 happens-before。</li>
<li><b>“memset 清零就安全”</b>：对多态类型，<code>memset</code> 会抹掉虚表指针，之后使用就是 UB；对非平凡类型，清零也可能破坏类的不变量。全零的指针也不保证是空指针（取决于平台）。</li>
<li><b>“我只在测试环境里越界”</b>：UB 没有作用域，优化可以跨函数、跨循环地利用它。</li>
<li><b>“换个编译器就好了”</b>：只是换了一种未定义的表现，问题仍在。</li>
</ul>
<p>排障时，先问三个问题：这段代码依赖了哪个标准没有保证的前提？换 -O2 构建、换 sanitizer 构建后还在不在？如果把裸指针换成带边界信息的接口（如固定 extent 的 <code>std::span</code>、<code>std::array</code>、<code>std::vector::at</code>），错误能否更早暴露？大多数 UB 都死在这三问里。</p>
<details class="quiz"><summary>Q1 · <code>unsigned</code> 的 <code>UINT_MAX + 1</code> 和有符号的 <code>INT_MAX + 1</code>，哪个是 UB？</summary><div class="quiz__a">无符号版本是良定义的，按 2 的 N 次方取模得到 0；有符号版本是 UB。这也是为什么哈希、校验和常用无符号类型：回绕行为有保证。C++20 起，超出范围的无符号转有符号同样按模 2 的 N 次方定义，不再是实现定义。</div></details>
<details class="quiz"><summary>Q2 · 为什么 <code>x + 1 &gt; x</code> 在 -O2 下可能恒为 true？如果真要检测溢出该怎么做？</summary><div class="quiz__a">优化器假定有符号加法不溢出，于是 <code>x + 1 &gt; x</code> 恒真。若确实需要检测，用 <code>__builtin_add_overflow(a, b, &amp;out)</code>（GCC/Clang）或先提升到更宽类型再比较；不要指望在溢出发生后判断结果。</div></details>
<details class="quiz"><summary>Q3 · 用 <code>reinterpret_cast&lt;float*&gt;</code> 读 <code>uint32_t</code> 的位模式，为什么不可靠？两种正确写法是什么？</summary><div class="quiz__a">它违反严格别名：通过 float 左值访问了实际类型为 uint32_t 的对象，行为未定义，优化器可假定两条路径不重叠而重排读写。正确写法是按字节复制 <code>std::memcpy(&amp;f, &amp;bits, sizeof f)</code>，或 C++20 的 <code>std::bit_cast&lt;float&gt;(bits)</code>。</div></details>
<details class="quiz"><summary>Q4 · ASan 能抓到有符号溢出和数据竞争吗？</summary><div class="quiz__a">都不能。ASan 负责地址类错误（越界、悬垂、重复释放）；有符号溢出归 UBSan，数据竞争归 TSan。三者需要分别开启，通常放在不同构建里跑。任何单一工具都不能覆盖全部 UB。</div></details>
<details class="quiz"><summary>Q5 · 对象已经析构，但内存还没被复用，为什么访问它仍然是 UB？</summary><div class="quiz__a">因为生命周期已经结束，那块存储上不再存在类型为 T 的对象。通过 T 的指针访问，违反的是对象模型而非“内存是否可读”。是否崩溃取决于存储是否仍映射，与行为是否有定义无关。</div></details>
<ul class="refs">
<li><b>cppreference · Undefined behavior</b> — cppreference.com 社区。系统列出 UB 的判定、常见情形与相关条款，适合当查询手册。</li>
<li><b>ISO/IEC 14882（C++ 标准）[intro.abstract]、[basic.life]、[basic.lval]</b> — ISO/IEC。行为定义、对象生命周期与别名规则的权威出处，读原文能消除大量二手资料的偏差。</li>
<li><b>A Guide to Undefined Behavior in C and C++</b> — John Regehr, 2010，博客连载。用大量可复现的小例子说明优化器如何利用 UB，是理解“为什么会这样”的最佳入门。</li>
<li><b>What Every C Programmer Should Know About Undefined Behavior</b> — Chris Lattner, LLVM 博客, 2011，共三篇。从编译器实现者视角解释 UB 与优化的关系。</li>
<li><b>P2590R2 · Explicit Lifetime Management</b> — WG21 提案，C++23 采纳。std::start_lifetime_as 的提案与动机，讲清“存储上有无对象”这一层语义。</li>
</ul>
</section>`
};
