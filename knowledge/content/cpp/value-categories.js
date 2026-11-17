window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["value-categories"] = {
  slug: "value-categories",
  title: "值类别与完美转发",
  subtitle: "std::move 不移动，std::forward 不转发",
  level: 2,
  cluster: "对象与资源",
  tags: ["值类别", "完美转发", "move"],
  summary: "从值类别三分类出发，讲清引用折叠与万能引用，拆解 std::move 和 std::forward 的真实语义，并解释移动构造、NRVO 与常见误用。",
  keyPoints: [
    "值类别是表达式的属性：lvalue 有身份不可移动，xvalue 有身份可移动，prvalue 无身份可移动",
    "引用折叠只有一条规则：出现一个 & 就是 &，两个 && 才是 &&；T&& 只有在 T 参与推导时才是万能引用",
    "std::move 是无条件转成右值引用的 static_cast，对 const 对象会退化为拷贝；std::forward 按 T 有条件还原值类别",
    "移动构造是普通成员函数，负责窃取资源；noexcept 影响 vector 扩容时走移动还是退回拷贝，moved-from 对象处于有效但未指定状态",
    "C++17 强制消除 prvalue 的拷贝，NRVO 是可选优化；return std::move(x) 会抑制 NRVO，通常是负优化"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>先拆掉两个名字：move 不移动，forward 不转发</h2>
<p>第一次读 <code>std::move(x)</code>，几乎都会以为它把 x 的资源搬走了。打开实现会发现只有一行：把 x 无条件转换成右值引用。它不调用构造函数，不复制一个字节，也不会改动 x 本身——x 仍然是原来的左值，只是这个表达式的类型被转换成了右值引用。真正决定“拷贝还是移动”的，是编译器在重载决议时看到的<mark>值类别</mark>（value category）。<code>std::forward</code> 同样名不副实：它不转发任何东西，只做一次依赖模板参数的<mark>有条件类型转换</mark>。</p>
<p>把这两个工具当成“类型转换器”而不是“动作”，后面的一切就顺了。移动构造、移动赋值是普通成员函数，由程序员实现；标准库和编译器只负责在正确的时机把表达式归类成右值，让重载决议选中它们。本篇的目标是让你看到 <code>std::move</code> 时能立刻问出三个问题：它转成了什么类型？目标类型的构造函数接受吗？转换之后源对象还能不能用？</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div><code>std::move</code> 发的是一张“此对象可以被搬走”的通行证，不是搬家工人；<code>std::forward</code> 是转发链上的海关，按护照（模板参数 T）决定放行成左值还是右值。</div></div>
</section>

<section class="sec">
<h2>值类别：给每个表达式贴两个标签</h2>
<p>C++03 只有左值（lvalue）与右值（rvalue）两分。C++11 为了支持移动语义，把右值再拆成<mark>将亡值</mark>（xvalue，eXpiring value）与<mark>纯右值</mark>（prvalue，pure rvalue），形成 lvalue / xvalue / prvalue 三分类；C++17 又调整了 prvalue 的语义（第 6 节）。这套分类写在标准 [basic.lval] 中，是所有重载决议的底层依据。</p>
<p>分类依据是两个正交属性。<b>身份</b>（identity）：这个表达式是否指代一个可定位的对象——背后有没有一个能取到地址的实体，而不是纯粹的计算结果。<b>可移动性</b>（movability）：这个表达式是否属于右值类别，也就是标准是否允许把它的资源交给别人。这里要小心：类别层面的“可移动”只是许可，具体能否真的调用移动构造，还取决于类型有没有可用的移动构造、以及是否带 const 限定——一个 <code>const T</code> 的纯右值仍然属于右值，却绑定不到 <code>T&amp;&amp;</code>。两个属性交叉，得到三种存在的组合。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>类别</th><th>有身份</th><th>可移动</th><th>典型表达式</th><th><code>decltype((e))</code></th></tr></thead>
<tbody>
<tr><td>lvalue 左值</td><td>有</td><td>否</td><td>变量名、<code>*p</code>、内置下标 <code>a[i]</code>、<code>++i</code>、返回 <code>T&amp;</code> 的函数</td><td><code>T&amp;</code></td></tr>
<tr><td>xvalue 将亡值</td><td>有</td><td>是</td><td><code>std::move(x)</code>、<code>static_cast&lt;T&amp;&amp;&gt;(x)</code>、返回 <code>T&amp;&amp;</code> 的函数</td><td><code>T&amp;&amp;</code></td></tr>
<tr><td>prvalue 纯右值</td><td>无</td><td>是</td><td><code>42</code>、<code>a+b</code>、<code>T()</code>、返回 <code>T</code> 的函数、lambda 表达式</td><td><code>T</code></td></tr>
<tr><td>（空组合）</td><td>无</td><td>否</td><td>标准中不存在这种值类别</td><td>—</td></tr>
</tbody>
</table></div>
<p>表中的“可移动”指表达式属于右值类别；左值本身不能直接移动，需要先经 <code>std::move</code> 之类的转换变成 xvalue，那已经是另一个表达式了。<code>decltype</code> 一列取的是带括号表达式的结果：<code>decltype(x)</code> 对未加括号的变量名给出声明类型 <code>T</code>，而 <code>decltype((x))</code> 才按值类别给出 <code>T&amp;</code>。是否真的发生移动，还要看类型和 const 限定。</p>
<h3>左值：有名字，不能动</h3>
<p>变量名是最典型的左值；解引用 <code>*p</code>、内置下标 <code>a[i]</code>、前置自增 <code>++i</code>、返回 <code>T&amp;</code> 的函数调用也都是左值。字符串字面量 <code>"hi"</code> 常被误认为右值，其实是左值（类型为 <code>const char[3]</code>），而数字字面量 <code>42</code> 是纯右值。判断口诀不完整但够用：<mark>有名字的表达式通常是左值</mark>。</p>
<h3>将亡值：有身份，但资源可以被拿走</h3>
<p>xvalue 是 C++11 新增的一类：对象还真实存在、有确定的存储位置，但编译器允许把它的资源移走。<code>std::move(x)</code>、<code>static_cast&lt;T&amp;&amp;&gt;(x)</code>、返回 <code>T&amp;&amp;</code> 的函数调用，以及对 xvalue 做非引用数据成员访问（如 <code>std::move(obj).field</code>）都产生 xvalue。它和 prvalue 的区别在于“有没有对象”：xvalue 背后有一个真实对象，prvalue 在 C++17 之前只是“即将成为对象的值”。</p>
<h3>纯右值：没有身份，天然可移动</h3>
<p>字面量、算术运算结果、<code>T()</code>、按值返回的函数调用、lambda 表达式都是 prvalue。它们不指代任何既有对象，因此谈不上“偷”，编译器可以直接在目标位置构造。C++17 起，prvalue 不再物化成一个临时对象再拷贝，而是直接初始化最终对象，这就是强制拷贝消除的语言基础。</p>
<p>再把它们两两合并：<mark>泛左值</mark>（glvalue）= lvalue + xvalue，共同点是“有身份”；<mark>右值</mark>（rvalue）= xvalue + prvalue，共同点是“可移动”。注意 rvalue 不等于“没有对象”：xvalue 背后就是一个真实对象，只是标准不允许用内置 <code>&amp;</code> 直接对 xvalue 表达式取地址。</p>
<p>值类别还会投影到类型上。<code>decltype(x)</code> 对未加括号的名字给出声明类型；<code>decltype((expr))</code> 按表达式的值类别给出类型：左值得到 <code>T&amp;</code>，将亡值得到 <code>T&amp;&amp;</code>，纯右值得到 <code>T</code>。写泛型代码时，这个差别决定了你拿到的是引用还是值。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="值类别二维图：按身份与可移动性划分 lvalue、xvalue、prvalue，以及 glvalue 与 rvalue 的范围" font-family="inherit">
<defs>
<marker id="value-categories-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-muted)"></path>
</marker>
</defs>
<rect x="110" y="50" width="600" height="270" fill="var(--sv-panel)"></rect>
<rect x="110" y="50" width="300" height="135" fill="var(--sv-a)" opacity="0.16"></rect>
<rect x="410" y="50" width="300" height="135" fill="var(--sv-b)" opacity="0.16"></rect>
<rect x="410" y="185" width="300" height="135" fill="var(--sv-c)" opacity="0.16"></rect>
<rect x="110" y="185" width="300" height="135" fill="var(--sv-bg)"></rect>
<line x1="410" y1="50" x2="410" y2="320" stroke="var(--sv-line)" stroke-width="1.5" stroke-dasharray="6 5"></line>
<line x1="110" y1="185" x2="710" y2="185" stroke="var(--sv-line)" stroke-width="1.5" stroke-dasharray="6 5"></line>
<line x1="110" y1="320" x2="735" y2="320" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#value-categories-arrow)"></line>
<line x1="110" y1="320" x2="110" y2="38" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#value-categories-arrow)"></line>
<text x="140" y="78" font-size="16" font-weight="600" fill="var(--sv-ink)">lvalue 左值</text>
<text x="140" y="103" font-size="12" fill="var(--sv-muted)">有身份，不可移动</text>
<text x="140" y="127" font-size="12" fill="var(--sv-ink)">变量名、*p、a[i]、++i</text>
<text x="140" y="149" font-size="12" fill="var(--sv-ink)">返回 T&amp; 的函数调用</text>
<text x="440" y="78" font-size="16" font-weight="600" fill="var(--sv-ink)">xvalue 将亡值</text>
<text x="440" y="103" font-size="12" fill="var(--sv-muted)">有身份，可移动</text>
<text x="440" y="127" font-size="12" fill="var(--sv-ink)">std::move(x)</text>
<text x="440" y="149" font-size="12" fill="var(--sv-ink)">返回 T&amp;&amp; 的函数调用</text>
<text x="440" y="213" font-size="16" font-weight="600" fill="var(--sv-ink)">prvalue 纯右值</text>
<text x="440" y="238" font-size="12" fill="var(--sv-muted)">无身份，可移动</text>
<text x="440" y="262" font-size="12" fill="var(--sv-ink)">42、a+b、T()、lambda</text>
<text x="440" y="284" font-size="12" fill="var(--sv-ink)">返回 T 的函数调用</text>
<text x="140" y="238" font-size="15" fill="var(--sv-muted)">无此类别</text>
<text x="140" y="262" font-size="12" fill="var(--sv-muted)">无身份且不可移动</text>
<text x="140" y="343" font-size="13" text-anchor="middle" fill="var(--sv-muted)">不可移动</text>
<text x="650" y="343" font-size="13" text-anchor="middle" fill="var(--sv-muted)">可移动（属于右值）</text>
<text x="104" y="44" font-size="13" text-anchor="end" fill="var(--sv-muted)">有身份</text>
<text x="104" y="316" font-size="13" text-anchor="end" fill="var(--sv-muted)">无身份</text>
<text x="410" y="367" font-size="13" text-anchor="middle" fill="var(--sv-ink)">glvalue 泛左值 = 上半行　｜　rvalue 右值 = 右半列</text>
</svg>
<figcaption>图 1 · 值类别由“身份”与“可移动性”两个属性决定。上半行是 glvalue，右半列是 rvalue；两者在 xvalue 处重叠。左下角的“无身份且不可移动”组合在标准中不存在。</figcaption>
</figure>
</section>

<section class="sec">
<h2>引用类型与引用折叠：T&amp;&amp; 为什么有时是左值</h2>
<p>引用类型是函数接口的一部分，值类别是实参的性质，两者不是一回事。非 const 左值引用（lvalue reference）<code>T&amp;</code> 只能绑定左值；<code>const T&amp;</code> 两者都能绑定；右值引用（rvalue reference）<code>T&amp;&amp;</code> 只能绑定右值（左值需要显式 <code>std::move</code> 转换）。但把参数写成 <code>T&amp;&amp;</code> 并不自动等于“只收右值”：当 T 是函数模板参数并在本次调用中被推导时，真正的形参类型由推导结果和<mark>引用折叠</mark>（reference collapsing）决定。</p>
<p>引用折叠只发生在“引用的引用”这种语法上不合法、但类型系统中会出现的场景：模板类型推导、<code>typedef</code>/<code>using</code> 别名、<code>decltype</code>、<code>auto</code>。规则只有一句：<mark>只要出现一个左值引用，结果就是左值引用；只有两个右值引用才折叠成右值引用</mark>。</p>
<div class="formula">T&amp; &amp;   → T&amp;
T&amp; &amp;&amp;  → T&amp;
T&amp;&amp; &amp;  → T&amp;
T&amp;&amp; &amp;&amp; → T&amp;&amp;

转发结果：forward&lt;T&gt;(v) 的类型 = T&amp;&amp;（经折叠）
T = U&amp; → U&amp;　｜　T = U → U&amp;&amp;</div>
<p>所谓<mark>万能引用</mark>（universal reference，标准术语是 forwarding reference）就是 <code>T&amp;&amp;</code> 且 T 参与本次推导，或者 <code>auto&amp;&amp;</code>。传左值时 T 推导为 <code>U&amp;</code>，<code>T&amp;&amp;</code> 折叠成 <code>U&amp;</code>；传右值时 T 推导为 <code>U</code>，结果保持 <code>U&amp;&amp;</code>。一个签名因此能同时接住左值和右值。反例要记牢：<code>void f(std::vector&lt;T&gt;&amp;&amp;)</code> 不是万能引用——形参不是恰好写成 <code>T&amp;&amp;</code>，实参必须先匹配 <code>std::vector&lt;T&gt;</code> 这个形状，T 被推导成元素类型，形参只是一个只能绑定右值的 <code>vector&lt;T&gt;&amp;&amp;</code>；<code>void f(const T&amp;&amp;)</code> 也不是，因为转发引用要求对无 cv 限定的模板参数取右值引用，而这里 T 头上多了一个 const；类模板成员里的 <code>T&amp;&amp;</code> 若 T 属于类模板而非该函数模板，同样不是。模板实参推导的完整规则不在本篇展开，见 templates-basics 一篇。</p>
<div class="callout callout--tip"><span class="callout__label">技巧</span><div>判断转发引用看两点：形参是否恰好写成不带其它修饰的 <code>T&amp;&amp;</code>，以及 T 是否是本次函数调用中推导出来的函数模板参数。<code>std::vector&lt;T&gt;&amp;&amp;</code>、<code>const T&amp;&amp;</code>、类模板的 <code>T&amp;&amp;</code> 都不满足，它们只是普通的右值引用。</div></div>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="引用折叠规则表与万能引用的推导示例" font-family="inherit">
<rect x="30" y="40" width="350" height="300" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="205" y="70" font-size="15" text-anchor="middle" fill="var(--sv-ink)">引用折叠：外层 × 内层</text>
<rect x="55" y="98" width="85" height="44" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<rect x="140" y="98" width="115" height="44" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<rect x="255" y="98" width="120" height="44" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<rect x="55" y="142" width="85" height="52" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<rect x="140" y="142" width="115" height="52" fill="var(--sv-a)" opacity="0.18" stroke="var(--sv-line)"></rect>
<rect x="255" y="142" width="120" height="52" fill="var(--sv-a)" opacity="0.18" stroke="var(--sv-line)"></rect>
<rect x="55" y="194" width="85" height="52" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<rect x="140" y="194" width="115" height="52" fill="var(--sv-a)" opacity="0.18" stroke="var(--sv-line)"></rect>
<rect x="255" y="194" width="120" height="52" fill="var(--sv-b)" opacity="0.18" stroke="var(--sv-line)"></rect>
<text x="197" y="125" font-size="12" text-anchor="middle" fill="var(--sv-muted)">内层 &amp;</text>
<text x="315" y="125" font-size="12" text-anchor="middle" fill="var(--sv-muted)">内层 &amp;&amp;</text>
<text x="97" y="173" font-size="12" text-anchor="middle" fill="var(--sv-ink)">外层 &amp;</text>
<text x="197" y="173" font-size="14" text-anchor="middle" fill="var(--sv-ink)">T&amp;</text>
<text x="315" y="173" font-size="14" text-anchor="middle" fill="var(--sv-ink)">T&amp;</text>
<text x="97" y="225" font-size="12" text-anchor="middle" fill="var(--sv-ink)">外层 &amp;&amp;</text>
<text x="197" y="225" font-size="14" text-anchor="middle" fill="var(--sv-ink)">T&amp;</text>
<text x="315" y="225" font-size="14" text-anchor="middle" fill="var(--sv-ink)">T&amp;&amp;</text>
<text x="205" y="292" font-size="12" text-anchor="middle" fill="var(--sv-muted)">只有“&amp;&amp; 叠 &amp;&amp;”才得到右值引用</text>
<text x="205" y="316" font-size="12" text-anchor="middle" fill="var(--sv-muted)">任何一层是 &amp;，结果就是左值引用</text>
<rect x="400" y="40" width="330" height="300" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="565" y="70" font-size="15" text-anchor="middle" fill="var(--sv-ink)">万能引用 T&amp;&amp; 的推导</text>
<text x="420" y="105" font-size="12" fill="var(--sv-ink)">实参：Widget 左值 w</text>
<text x="420" y="128" font-size="12" fill="var(--sv-muted)">T = Widget&amp;　⇒　T&amp;&amp; = Widget&amp;</text>
<line x1="420" y1="142" x2="710" y2="142" stroke="var(--sv-line)" stroke-width="1"></line>
<text x="420" y="167" font-size="12" fill="var(--sv-ink)">实参：Widget 右值 Widget{}</text>
<text x="420" y="190" font-size="12" fill="var(--sv-muted)">T = Widget　⇒　T&amp;&amp; = Widget&amp;&amp;</text>
<line x1="420" y1="204" x2="710" y2="204" stroke="var(--sv-line)" stroke-width="1"></line>
<text x="420" y="229" font-size="12" fill="var(--sv-ink)">实参：const Widget 左值 cw</text>
<text x="420" y="252" font-size="12" fill="var(--sv-muted)">T = const Widget&amp;　⇒　T&amp;&amp; = const Widget&amp;</text>
<line x1="420" y1="266" x2="710" y2="266" stroke="var(--sv-line)" stroke-width="1"></line>
<text x="420" y="292" font-size="12" fill="var(--sv-ink)">推导结果 T 决定折叠方向</text>
<text x="420" y="315" font-size="12" fill="var(--sv-muted)">与形参写成的 T&amp;&amp; 无关</text>
</svg>
<figcaption>图 2 · 左：引用折叠的四种组合，只有右下角保持右值引用。右：同一个 <code>T&amp;&amp;</code> 形参，根据实参的值类别推导出不同 T，再折叠成不同的引用类型。</figcaption>
</figure>
</section>

<section class="sec">
<h2>std::move 与 std::forward 的真实实现</h2>
<p>C++14 起，<code>std::move</code> 的签名大致是 <code>template&lt;class T&gt; constexpr std::remove_reference_t&lt;T&gt;&amp;&amp; move(T&amp;&amp;) noexcept</code>。它先去掉引用，再统一加上 <code>&amp;&amp;</code>，等价于一次 <code>static_cast</code>。所以对 <code>const Widget</code> 调用 move，得到的是 <code>const Widget&amp;&amp;</code>；而移动构造通常写成 <code>Widget(Widget&amp;&amp;)</code>，不接受 const，重载决议通常只能退回复制构造。这就是“move 了却还在拷贝”的第一大来源。</p>
<p><code>std::forward</code> 则是有条件的：只有当模板实参 T 是左值引用类型时，它才返回左值；否则返回右值。它必须显式写出 <code>std::forward&lt;T&gt;(v)</code>，因为 T 正是推导结果，forward 靠它决定转换方向。两者的分工可以概括成一句：<mark>对万能引用用 forward，对确定的右值引用用 move</mark>。把 forward 用在非万能引用上，可能把左值强行变成右值；把 move 用在万能引用上，则可能把调用者的左值搬空。把实参的值类别原样交给下一层，让左值仍按左值处理、右值仍按右值处理，这就是<mark>完美转发</mark>（perfect forwarding），forward 是实现它的工具。</p>
<pre class="code" data-lang="cpp"><code>// 示意：标准库 move / forward 的核心语义（简化，省略第二个重载）
#include &lt;type_traits&gt;

template &lt;class T&gt;
constexpr std::remove_reference_t&lt;T&gt;&amp;&amp; my_move(T&amp;&amp; t) noexcept {
    return static_cast&lt;std::remove_reference_t&lt;T&gt;&amp;&amp;&gt;(t);
}

template &lt;class T&gt;
constexpr T&amp;&amp; my_forward(std::remove_reference_t&lt;T&gt;&amp; t) noexcept {
    // T = U&amp; 时返回 U&amp;；T = U 时返回 U&amp;&amp;
    return static_cast&lt;T&amp;&amp;&gt;(t);
}</code></pre>
<p>下面这段是可以直接编译运行的完整例子（C++11 起即可，g++、clang++ 与 MSVC 均可）。同一个 <code>relay</code> 模板，左值调用走 <code>take(Widget&amp;)</code>，右值调用走 <code>take(Widget&amp;&amp;)</code>，const 左值走 <code>take(const Widget&amp;)</code>。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;iostream&gt;
#include &lt;string&gt;
#include &lt;utility&gt;

struct Widget {
    std::string name;
};

void take(Widget&amp;)       { std::cout &lt;&lt; "take(Widget&amp;)\n"; }
void take(const Widget&amp;) { std::cout &lt;&lt; "take(const Widget&amp;)\n"; }
void take(Widget&amp;&amp;)      { std::cout &lt;&lt; "take(Widget&amp;&amp;)\n"; }

template &lt;class T&gt;
void relay(T&amp;&amp; v) {
    take(std::forward&lt;T&gt;(v));   // 按 T 还原实参的值类别
}

int main() {
    Widget w{"a"};
    relay(w);                    // T = Widget&amp;，转发为左值
    relay(Widget{"b"});          // T = Widget，转发为右值
    const Widget cw{"c"};
    relay(cw);                   // T = const Widget&amp;
    relay(std::move(w));         // T = Widget，转发为右值
}</code></pre>
<p>运行结果是四行分别打印 <code>take(Widget&amp;)</code>、<code>take(Widget&amp;&amp;)</code>、<code>take(const Widget&amp;)</code>、<code>take(Widget&amp;&amp;)</code>。如果把 <code>std::forward&lt;T&gt;(v)</code> 换成 <code>std::move(v)</code>，第二行和第四行不变，但第一行会变成 <code>take(Widget&amp;&amp;)</code>，第三行仍然打印 <code>take(const Widget&amp;)</code>——在这组重载里，const 右值只能绑定到 const 左值引用。第一行那次调用会选中 <code>take(Widget&amp;&amp;)</code>；如果 take 真的接管资源，调用者的对象就被搬空了。这个对照实验比任何文字都更能说明 forward 的必要性。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="完美转发链：左值调用与右值调用分别经过 T 的推导与 forward 还原" font-family="inherit">
<defs>
<marker id="value-categories-fwd-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-muted)"></path>
</marker>
</defs>
<text x="380" y="28" font-size="15" text-anchor="middle" fill="var(--sv-ink)">同一个 relay 模板，两条转发链</text>
<rect x="30" y="60" width="130" height="56" rx="8" fill="var(--sv-a)" opacity="0.14" stroke="var(--sv-a)"></rect>
<text x="95" y="84" font-size="12" text-anchor="middle" fill="var(--sv-ink)">relay(w)</text>
<text x="95" y="103" font-size="12" text-anchor="middle" fill="var(--sv-muted)">实参：左值</text>
<rect x="195" y="60" width="130" height="56" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="260" y="84" font-size="12" text-anchor="middle" fill="var(--sv-ink)">T = Widget&amp;</text>
<text x="260" y="103" font-size="12" text-anchor="middle" fill="var(--sv-muted)">形参折叠为 Widget&amp;</text>
<rect x="360" y="60" width="170" height="56" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="445" y="84" font-size="12" text-anchor="middle" fill="var(--sv-ink)">forward&lt;Widget&amp;&gt;(v)</text>
<text x="445" y="103" font-size="12" text-anchor="middle" fill="var(--sv-muted)">返回 Widget&amp;</text>
<rect x="565" y="60" width="165" height="56" rx="8" fill="var(--sv-a)" opacity="0.14" stroke="var(--sv-a)"></rect>
<text x="647" y="84" font-size="12" text-anchor="middle" fill="var(--sv-ink)">take(Widget&amp;)</text>
<text x="647" y="103" font-size="12" text-anchor="middle" fill="var(--sv-muted)">绑定左值，不移动</text>
<line x1="160" y1="88" x2="192" y2="88" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#value-categories-fwd-arrow)"></line>
<line x1="325" y1="88" x2="357" y2="88" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#value-categories-fwd-arrow)"></line>
<line x1="530" y1="88" x2="562" y2="88" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#value-categories-fwd-arrow)"></line>
<rect x="30" y="220" width="130" height="56" rx="8" fill="var(--sv-b)" opacity="0.14" stroke="var(--sv-b)"></rect>
<text x="95" y="244" font-size="12" text-anchor="middle" fill="var(--sv-ink)">relay(Widget{})</text>
<text x="95" y="263" font-size="12" text-anchor="middle" fill="var(--sv-muted)">实参：右值</text>
<rect x="195" y="220" width="130" height="56" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="260" y="244" font-size="12" text-anchor="middle" fill="var(--sv-ink)">T = Widget</text>
<text x="260" y="263" font-size="12" text-anchor="middle" fill="var(--sv-muted)">形参保持 Widget&amp;&amp;</text>
<rect x="360" y="220" width="170" height="56" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="445" y="244" font-size="12" text-anchor="middle" fill="var(--sv-ink)">forward&lt;Widget&gt;(v)</text>
<text x="445" y="263" font-size="12" text-anchor="middle" fill="var(--sv-muted)">返回 Widget&amp;&amp;</text>
<rect x="565" y="220" width="165" height="56" rx="8" fill="var(--sv-b)" opacity="0.14" stroke="var(--sv-b)"></rect>
<text x="647" y="244" font-size="12" text-anchor="middle" fill="var(--sv-ink)">take(Widget&amp;&amp;)</text>
<text x="647" y="263" font-size="12" text-anchor="middle" fill="var(--sv-muted)">绑定右值，可移动</text>
<line x1="160" y1="248" x2="192" y2="248" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#value-categories-fwd-arrow)"></line>
<line x1="325" y1="248" x2="357" y2="248" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#value-categories-fwd-arrow)"></line>
<line x1="530" y1="248" x2="562" y2="248" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#value-categories-fwd-arrow)"></line>
<text x="380" y="320" font-size="13" text-anchor="middle" fill="var(--sv-ink)">forward 不产生新对象，只把值类别原样交还给下一层</text>
<text x="380" y="345" font-size="12" text-anchor="middle" fill="var(--sv-muted)">若换成 std::move，两条链都会走到 take(Widget&amp;&amp;)，左值调用者的资源会被偷走</text>
</svg>
<figcaption>图 3 · 完美转发链：T 的推导结果决定折叠后的形参类型，forward&lt;T&gt; 再把实参的值类别还原给下一层。整条链上没有任何对象被复制或移动，只有引用的传递。</figcaption>
</figure>
</section>

<section class="sec">
<h2>移动语义到底移动了什么</h2>
<p>移动构造与移动赋值不是语言内建的“搬家指令”，而是接受 <code>T&amp;&amp;</code> 的普通成员函数。典型实现把源对象的资源句柄（指针、文件描述符、缓冲区）接管过来，再把源置成可安全析构的状态。多数实现里 <code>std::vector</code> 用三个指针（begin、end、capacity）表示缓冲区，移动构造直接接管它们，不逐个搬元素；<code>std::string</code> 在短字符串优化（SSO，small string optimization）下甚至可能退化为逐字节拷贝，因为字符存在对象内部的缓冲区里，没有可窃取的堆指针。这两个都是实现细节：标准不规定 vector 的成员布局，也不要求 string 采用 SSO。它们正好说明“移动一定比拷贝快”是错的：开销取决于类型和实现，具体到你的平台与标准库版本。</p>
<p><code>noexcept</code> 不是装饰。vector 重分配时希望提供强异常保证：如果元素的移动构造可能抛异常、并且元素类型可拷贝，实现会按 <code>std::move_if_noexcept</code> 的语义退回拷贝构造，宁可慢也不破坏原容器；如果元素不可拷贝，就只能移动，移动构造抛异常时标准不保证原容器不变（效果未指定）。把移动构造标成 <code>noexcept</code>（前提是它确实不抛），vector 重分配才会优先选择移动，也才更容易兑现强异常保证。其它依赖移动的操作（例如 <code>std::swap</code>）在异常路径上也会更从容。</p>
<p>被移动后的对象（moved-from 对象）处于“有效但未指定”（valid but unspecified）状态。标准库类型只保证对象仍然有效：可以析构、可以赋新值，其它操作即使能调用，结果也往往未指定。读 moved-from 对象的元素个数或内容，结果未指定，同一份代码换个标准库实现，行为就可能改变。自移动 <code>v = std::move(v)</code> 合法，但结果未指定，移动赋值里写 <code>if (this != &amp;other)</code> 是廉价的保险。</p>
<p>资源管理类遵循 <mark>Rule of Five</mark>：析构、拷贝构造、拷贝赋值、移动构造、移动赋值，定义其中一个就要审视其余四个。更好的做法是 <mark>Rule of Zero</mark>：成员全部用 <code>std::vector</code>、<code>std::string</code>、<code>std::unique_ptr</code> 这类 RAII 类型，编译器生成的五个函数自动正确。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;cstddef&gt;
#include &lt;iostream&gt;
#include &lt;utility&gt;
#include &lt;vector&gt;

class Buffer {
public:
    explicit Buffer(std::size_t n) : data_(n, 0) {}

    Buffer(const Buffer&amp; other) : data_(other.data_) {
        std::cout &lt;&lt; "copy\n";
    }
    Buffer(Buffer&amp;&amp; other) noexcept : data_(std::move(other.data_)) {
        std::cout &lt;&lt; "move\n";
    }

    Buffer&amp; operator=(const Buffer&amp; other) {
        if (this != &amp;other) {
            data_ = other.data_;
        }
        return *this;
    }
    Buffer&amp; operator=(Buffer&amp;&amp; other) noexcept {
        if (this != &amp;other) {
            data_ = std::move(other.data_);
        }
        return *this;
    }

    std::size_t size() const { return data_.size(); }

private:
    std::vector&lt;unsigned char&gt; data_;
};

Buffer make_buffer(std::size_t n) {
    Buffer b(n);
    return b;              // 允许 NRVO；即使不消除也是移动，不是拷贝
}

int main() {
    std::vector&lt;Buffer&gt; v;
    v.reserve(2);
    v.push_back(make_buffer(1024));   // 直接在目标位置构造或移动

    Buffer a(64);
    Buffer b = std::move(a);          // 显式移动：a 变成有效但未指定状态
    std::cout &lt;&lt; b.size() &lt;&lt; " " &lt;&lt; a.size() &lt;&lt; '\n';
}</code></pre>
<p>把这段代码编译运行，正常情况下不会看到任何 <code>copy</code>：<code>make_buffer</code> 的返回值被消除，<code>push_back</code> 把临时对象移动进容器，<code>b</code> 从 <code>a</code> 移动而来。<code>a.size()</code> 在多数实现上打印 0，但标准并不保证，因此不要把它写进业务逻辑。示例中移动构造与移动赋值都标了 <code>noexcept</code>，这正是 <code>vector</code> 扩容时愿意选择移动的前提。</p>
</section>

<section class="sec">
<h2>返回值、NRVO 与对象生命周期</h2>
<p>C++17 起，用 prvalue 初始化对象时，prvalue 直接初始化最终对象，不再经过“先构造临时对象再拷贝/移动”的路径。<code>T x = T();</code>、<code>return T(...);</code>、<code>f(T())</code> 都不需要拷贝或移动，甚至 T 不必可移动。这叫<mark>强制拷贝消除</mark>（mandatory copy elision），由提案 P0135R1 引入。它的意义不只是性能：它让“按值返回不可移动类型”成为合法写法，也让工厂函数的行为可预测。</p>
<p><mark>NRVO</mark>（named return value optimization）针对具名局部变量，例如 <code>Buffer b; return b;</code>。它是可选优化，标准不保证，但主流编译器在 <code>-O0</code> 下通常也会做。即使没做，C++11 起返回局部变量会按右值处理（隐式 move），只要类型可移动，结果就是一次移动而不是一次拷贝。C++20 的 P1825 扩展了隐式移动的适用范围，例如返回右值引用类型的参数时也不必显式 move。</p>
<p>因此 <code>return std::move(b);</code> 是典型的负优化：它把表达式变成 xvalue，抑制 NRVO，逼编译器至少做一次移动或拷贝。正确写法就是 <code>return b;</code>。返回局部变量和按值传入的参数本来就享受隐式移动；C++20 起，右值引用类型的参数在返回时也会被隐式移动。无论哪个标准，在返回语句里给局部变量包一层 move 通常只会帮倒忙。</p>
<p>生命周期延长是另一条容易误用的规则。临时对象绑定到局部 <code>const T&amp;</code> 或 <code>T&amp;&amp;</code> 引用时，寿命延长到该引用的作用域结束，所以 <code>const std::string&amp; s = make();</code> 安全。但延长不穿透函数边界：返回 <code>const T&amp;</code> 指向局部临时对象，函数一返回就悬垂；在构造函数的成员初始化列表里把临时对象绑定到引用成员，临时对象只活到构造函数结束，不会延长到成员的生命周期——这是悬垂引用的经典来源。构造函数参数 <code>T&amp;&amp;</code> 只是一个引用，保存它不等于拥有对象。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="返回值构造路径与引用生命周期延长示意" font-family="inherit">
<defs>
<marker id="value-categories-life-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-muted)"></path>
</marker>
</defs>
<text x="380" y="26" font-size="15" text-anchor="middle" fill="var(--sv-ink)">按值返回：对象在哪里构造</text>
<rect x="40" y="50" width="180" height="70" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="130" y="76" font-size="12" text-anchor="middle" fill="var(--sv-muted)">make_buffer 栈帧</text>
<text x="130" y="98" font-size="12" text-anchor="middle" fill="var(--sv-ink)">局部对象 b</text>
<rect x="330" y="50" width="180" height="70" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="420" y="76" font-size="12" text-anchor="middle" fill="var(--sv-muted)">调用者提供的返回值槽</text>
<text x="420" y="98" font-size="12" text-anchor="middle" fill="var(--sv-ink)">目标对象</text>
<rect x="600" y="50" width="130" height="70" rx="8" fill="var(--sv-a)" opacity="0.14" stroke="var(--sv-a)"></rect>
<text x="665" y="76" font-size="12" text-anchor="middle" fill="var(--sv-muted)">接收变量</text>
<text x="665" y="98" font-size="12" text-anchor="middle" fill="var(--sv-ink)">通常再被消除</text>
<line x1="220" y1="85" x2="327" y2="85" stroke="var(--sv-a)" stroke-width="2" marker-end="url(#value-categories-life-arrow)"></line>
<text x="273" y="76" font-size="12" text-anchor="middle" fill="var(--sv-a)">NRVO</text>
<text x="273" y="108" font-size="12" text-anchor="middle" fill="var(--sv-muted)">0 次移动</text>
<line x1="510" y1="85" x2="597" y2="85" stroke="var(--sv-muted)" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#value-categories-life-arrow)"></line>
<text x="553" y="76" font-size="12" text-anchor="middle" fill="var(--sv-muted)">C++17 起</text>
<text x="553" y="108" font-size="12" text-anchor="middle" fill="var(--sv-muted)">直接构造</text>
<text x="380" y="146" font-size="12" text-anchor="middle" fill="var(--sv-muted)">未做 NRVO 时是 1 次隐式移动（C++11 起）；更早的标准可能退化为拷贝</text>
<line x1="40" y1="170" x2="720" y2="170" stroke="var(--sv-line)" stroke-width="1"></line>
<text x="380" y="198" font-size="15" text-anchor="middle" fill="var(--sv-ink)">引用绑定临时对象：谁延长了生命周期</text>
<rect x="60" y="218" width="300" height="26" rx="4" fill="var(--sv-a)" opacity="0.18" stroke="var(--sv-a)"></rect>
<text x="210" y="236" font-size="12" text-anchor="middle" fill="var(--sv-ink)">临时对象 make() 的完整寿命</text>
<line x1="60" y1="262" x2="700" y2="262" stroke="var(--sv-ink)" stroke-width="2" marker-end="url(#value-categories-life-arrow)"></line>
<line x1="360" y1="244" x2="360" y2="280" stroke="var(--sv-line)" stroke-width="1.5" stroke-dasharray="4 4"></line>
<text x="360" y="296" font-size="12" text-anchor="middle" fill="var(--sv-muted)">引用 r 的作用域结束</text>
<text x="75" y="316" font-size="12" fill="var(--sv-ink)">const std::string&amp; r = make();</text>
<text x="430" y="316" font-size="12" fill="var(--sv-a)">安全：寿命延长到 r 离开作用域</text>
<rect x="60" y="330" width="180" height="22" rx="4" fill="var(--sv-b)" opacity="0.18" stroke="var(--sv-b)"></rect>
<text x="150" y="346" font-size="12" text-anchor="middle" fill="var(--sv-ink)">函数内临时对象</text>
<text x="260" y="346" font-size="12" fill="var(--sv-b)">函数返回即销毁，返回它的引用会悬垂</text>
</svg>
<figcaption>图 4 · 上：C++17 让 prvalue 直接在目标位置构造，NRVO 则让具名局部对象也省掉移动。下：绑定到局部引用可以延长临时对象寿命，但这条规则不穿透函数返回，返回局部对象的引用仍然悬垂。</figcaption>
</figure>
</section>

<section class="sec">
<h2>常见误用与排障</h2>
<p>值类别相关的 bug 有个共同特征：代码能编译，行为却和直觉相反，而且往往在换编译器、换标准库或开启优化后才暴露。下面这张表把高频症状与根因对上号，遇到问题时先按“现象”查，再回到前面的规则确认。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>现象</th><th>根因</th><th>修法</th></tr></thead>
<tbody>
<tr><td>调用了 <code>std::move</code>，日志里仍是 copy</td><td>对象是 const，得到 <code>const T&amp;&amp;</code>，移动构造不接受</td><td>去掉 const，或接受“只能拷贝”的事实</td></tr>
<tr><td>函数返回后数据乱码或崩溃</td><td>返回局部对象或临时对象的引用，寿命未延长</td><td>按值返回，依赖 NRVO 或隐式移动</td></tr>
<tr><td>vector 扩容时意外出现大量 copy</td><td>移动构造未标 <code>noexcept</code> 且类型可拷贝，重分配按 <code>std::move_if_noexcept</code> 退回拷贝</td><td>确认移动构造不抛后标记 <code>noexcept</code></td></tr>
<tr><td>左值实参被搬空</td><td>万能引用里用了 <code>std::move</code> 而非 <code>std::forward</code></td><td>改成 <code>std::forward&lt;T&gt;(v)</code></td></tr>
<tr><td><code>T&amp;&amp;</code> 形参接不住左值</td><td>它不是转发引用（<code>const T&amp;&amp;</code>、类模板的 T）</td><td>检查 T 是否在本次调用中推导</td></tr>
<tr><td>同一参数第二次使用时内容可能已被搬空</td><td>被 forward 或 move 了两次，第二次读到 moved-from</td><td>每个参数只 forward 一次，提前保存所需信息</td></tr>
<tr><td><code>return std::move(x)</code> 反而更慢</td><td>返回表达式成为 xvalue，抑制 NRVO</td><td>直接 <code>return x;</code></td></tr>
</tbody>
</table></div>
<p>排障时优先做两件事：一是用拷贝/移动计数（在构造函数里打日志或加静态计数器）确认到底走了哪条路径；二是用 <code>decltype((e))</code> 或编译器报错信息确认表达式的类型与值类别。很多“移动失效”其实是类型不对，而不是编译器不优化。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div><code>std::move</code> 不是性能开关。对 <code>int</code>、裸指针等平凡类型，移动与拷贝完全一样；对 const 对象、没有移动构造的类型，它一个字节也省不下来。看到 <code>std::move</code> 就以为变快，是最常见的错觉。</div></div>
<div class="callout callout--tip"><span class="callout__label">接口口诀</span><div>只读入参用 <code>const T&amp;</code>；需要一份副本时按值接收再 move；要原样转发给下一层时用 <code>T&amp;&amp;</code> 加 <code>std::forward&lt;T&gt;</code>；输出优先用返回值而不是出参。这四条覆盖了绝大多数场景。</div></div>
</section>

<section class="sec">
<h2>自测与延伸阅读</h2>
<h3>自测</h3>
<details class="quiz"><summary>Q1 · 对 <code>const Widget w{"w"};</code> 调用 <code>take(std::move(w))</code>，最终进入哪个重载？为什么？</summary><div class="quiz__a"><code>std::move(w)</code> 返回 <code>const Widget&amp;&amp;</code>。移动重载 <code>take(Widget&amp;&amp;)</code> 需要非 const 的右值引用，绑定失败；<code>take(Widget&amp;)</code> 也不能绑定 const。唯一可行的是 <code>take(const Widget&amp;)</code>，于是发生拷贝。结论：move 只是转换，const 会让移动语义失效。</div></details>
<details class="quiz"><summary>Q2 · 模板函数 <code>template&lt;class T&gt; void f(T&amp;&amp; x) { g(std::move(x)); }</code> 有什么问题？应该怎么改？</summary><div class="quiz__a">当调用者传左值时，T 推导为 <code>U&amp;</code>，x 的类型是 <code>U&amp;</code>，是一个左值引用；<code>std::move(x)</code> 会把它转成右值，可能把调用者的对象搬空。应改为 <code>g(std::forward&lt;T&gt;(x))</code>，让左值保持左值、右值保持右值。这就是“万能引用配 forward”的典型场景。</div></details>
<details class="quiz"><summary>Q3 · <code>Buffer make() { Buffer b(1); return std::move(b); }</code> 与 <code>return b;</code> 有什么区别？</summary><div class="quiz__a">前者把返回表达式变成 xvalue，抑制 NRVO，至少执行一次移动；后者允许编译器直接把 b 构造在返回值槽里，做到零拷贝零移动。即使 NRVO 没发生，C++11 起返回局部变量也会被隐式当作右值，仍然是一次移动。所以正确写法是 <code>return b;</code>。</div></details>
<details class="quiz"><summary>Q4 · 已知 <code>using L = int&amp;;</code>，那么 <code>L&amp;&amp;</code> 是什么类型？</summary><div class="quiz__a">把 <code>L</code> 展开得到 <code>int&amp; &amp;&amp;</code>，按引用折叠规则“只要出现一个 &amp;，结果就是 &amp;”，结果是 <code>int&amp;</code>。因此 <code>L&amp;&amp;</code> 不是右值引用，而是普通的 int 左值引用；若写成 <code>L&amp;&amp; r = x;</code>（x 为 int 变量），r 绑定到 x，不能绑定字面量 1 这样的右值。</div></details>
<h3>延伸阅读</h3>
<ul class="refs">
<li><b>Value categories</b> — cppreference.com。逐条列出 lvalue、xvalue、prvalue 与 glvalue、rvalue 的定义和表达式清单，是查证边角案例的第一站。</li>
<li><b>Copy elision</b> — cppreference.com。说明 C++17 强制拷贝消除的适用条件、NRVO 的可选性，以及返回语句中的隐式移动。</li>
<li><b>C++ Core Guidelines F.15–F.21</b> — Bjarne Stroustrup &amp; Herb Sutter。一组关于参数传递、sink 参数与完美转发的工程建议，适合设计公共 API 时对照。</li>
<li><b>Effective Modern C++ 条款 23–30</b> — Scott Meyers, O'Reilly, 2014。系统讲解 move/forward、万能引用、引用折叠与完美转发的失败案例，本文多处结论可在此找到展开论证。</li>
<li><b>P0135R1: Guaranteed copy elision through simplified value categories</b> — Richard Smith, 2016。C++17 强制拷贝消除的提案原文，解释 prvalue 语义为何要改。</li>
</ul>
</section>`
};
