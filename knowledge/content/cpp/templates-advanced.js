window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["templates-advanced"] = {
  slug: "templates-advanced",
  title: "变参模板、SFINAE 与 concepts",
  subtitle: "让模板报错说人话",
  level: 3,
  cluster: "泛型与标准库",
  tags: ["变参模板", "SFINAE", "concepts"],
  summary: "从参数包与折叠表达式讲到 SFINAE 与检测惯用法，再进入概念约束：把要求写进签名、逐项检查表达式良构，并按包含关系决定重载排序；最后以 CRTP 收束静态多态，交代元编程取舍。",
  keyPoints: [
    "参数包必须放在模式里展开，C++17 折叠表达式取代了大部分递归写法",
    "SFINAE 只在立即上下文生效，失败是移除候选而不是报错",
    "concepts 把要求写进签名，并通过 subsumption 影响重载排序",
    "CRTP 用编译期绑定换取零虚调用，但失去运行时多态与异构存储",
    "优先 concepts，其次 if constexpr 与标签分发，最后才用 SFINAE"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>一句话直觉：模板的要求应该写在签名里</h2>
<p>先看一个真实场景：你写了一个泛型函数，内部对参数调用 <code>.size()</code>。某天有人传入 <code>int</code>，编译器没有直接说“int 没有 size()”，而是打印了从标准库头文件到调用点的几十层实例化栈。原因不是编译器笨，而是模板的要求从来没有被写下来：只要实例化时用到的操作不存在，错误就在最深处爆炸。</p>
<p>这种<mark>隐式接口</mark>（implicit interface）是泛型编程的力量来源，也是维护成本的来源。C++ 用了三代工具来驯服它：C++98 起就有的 SFINAE（C++11 补上表达式 SFINAE，<code>std::enable_if</code> 把它变成常用接口）让不满足要求的候选“安静地退出”重载集；标签分发（concepts 之前更常规的手法）与 C++17 的 <code>if constexpr</code> 把选择从签名挪到重载集或函数体；C++20 的 concepts 把要求变成具名、可检查、可排序的约束。它们不是简单替代，而是同一目标的三代解法：把隐式契约变成显式契约。</p>
<p>阅读顺序如下：先看参数包与折叠表达式，这是变参接口的语法底座；再回到 SFINAE 与 type traits，理解 C++20 之前约束是怎么“模拟”出来的；然后进入 concepts 与 requires，讨论它如何改变重载决议；最后用 CRTP 收束静态多态，并给出编译期编程的工程取舍。模板实例化与特化的基础在 templates-basics 一篇，这里默认你已经会写函数模板和类模板。</p>
<p>代码按 C++20 口径编写；涉及对象大小、布局与名字修饰时，会明确写“典型实现”或“取决于 ABI”，不把某个编译器的行为当成标准保证。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>没有约束的模板像“先入职再发现不会用工具”：错误发生在工作现场，栈很深。SFINAE 像门口筛选，不合格的候选根本进不了重载决议，但不告诉你为什么。concepts 像门口贴出招聘条件：不满足的人不进，满足的人还能按条件排序，而且条件本身可读、可复用。</div></div>
</section>

<section class="sec">
<h2>参数包与折叠表达式：变参接口的语法底座</h2>
<p>变参模板（variadic templates，C++11）允许模板接受任意个参数：类型参数包写成 <code>class... Ts</code>，函数参数包写成 <code>Ts... args</code>，包中元素个数用 <code>sizeof...(Ts)</code> 取得。包本身不能直接当值用，必须出现在一个<mark>模式</mark>（pattern）里，再由模式后面的 <code>...</code> 展开。</p>
<p>常见模式有三种：<code>std::tuple&lt;Ts...&gt;</code> 展开类型、<code>f(args...)</code> 展开实参、<code>g(std::forward&lt;Ts&gt;(args)...)</code> 同时展开类型与实参。展开是逐元素替换，不会自动加括号，也不会改变求值顺序。</p>
<p>C++17 之前，处理参数包通常只能递归：取出第一个，递归处理剩余，再用一个空包重载终止（也有借用 <code>std::initializer_list</code> 的展开技巧，但同样绕）。样板代码多，实例化深度大。C++17 的<mark>折叠表达式</mark>（fold expression）把这一步压缩成一行，用二元运算符把包“折”起来。四种形式如下，其中 <code>op</code> 代表运算符，<code>init</code> 代表初始值。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>形式</th><th>写法</th><th>以包 a, b, c 展开</th><th>空包结果</th></tr></thead>
<tbody>
<tr><td>一元右折叠</td><td><code>(pack op ...)</code></td><td><code>a op (b op c)</code></td><td>仅 &amp;&amp; 为 true、|| 为 false、逗号为 void()</td></tr>
<tr><td>一元左折叠</td><td><code>(... op pack)</code></td><td><code>(a op b) op c</code></td><td>同上</td></tr>
<tr><td>二元右折叠</td><td><code>(pack op ... op init)</code></td><td><code>a op (b op (c op init))</code></td><td>init</td></tr>
<tr><td>二元左折叠</td><td><code>(init op ... op pack)</code></td><td><code>((init op a) op b) op c</code></td><td>init</td></tr>
</tbody>
</table></div>
<p>最常用的折叠是逗号折叠，用来对每个参数执行副作用：<code>((std::cout &lt;&lt; args &lt;&lt; ' '), ...);</code>。逗号折叠保证从左到右求值；换成 <code>+</code> 时，括号只规定结合方向，同一个 <code>+</code> 的两个操作数谁先求值仍不受保证，带副作用的表达式不要依赖它。折叠也不能用于 <code>.</code>、<code>-&gt;</code>、<code>[]</code> 这类运算符，标准只允许一组二元运算符（算术、位、逻辑、比较、赋值、逗号等）。</p>
<p>转发参数包时，<code>Args&amp;&amp;...</code> 只有在实参推导的上下文中才是转发引用；类模板里的 <code>Ts&amp;&amp;</code> 是普通右值引用。转发时用 <code>std::forward&lt;Args&gt;(args)...</code> 保留每个实参的值类别，值类别的完整规则在 value-categories 一篇。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;iostream&gt;
#include &lt;string&gt;
#include &lt;utility&gt;

template &lt;class... Ts&gt;
void log_line(const Ts&amp;... ts) {
    ((std::cout &lt;&lt; ts &lt;&lt; ' '), ...);   // 逗号折叠，从左到右
    std::cout &lt;&lt; '\n';
}

int main() {
    log_line("x =", 42, 3.5, std::string{"ok"});
}
// 输出：x = 42 3.5 ok</code></pre>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="折叠表达式示意图：一元右折叠展开为 a 加 b 加 c 的右结合树，一元左折叠展开为左结合树，减法在两种方向下结果不同">
<defs>
<marker id="templates-advanced-fold-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-line)"/></marker>
</defs>
<text x="380" y="24" text-anchor="middle" font-size="15" font-family="inherit" fill="var(--sv-ink)">折叠表达式：括号方向决定结合顺序</text>
<rect x="16" y="42" width="360" height="272" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="196" y="66" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-muted)">(args + ...) 右折叠</text>
<rect x="166" y="82" width="60" height="34" rx="6" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="196" y="105" text-anchor="middle" font-size="15" font-family="inherit" fill="var(--sv-ink)">+</text>
<rect x="46" y="176" width="60" height="34" rx="6" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="76" y="199" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">a</text>
<rect x="166" y="176" width="60" height="34" rx="6" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="196" y="199" text-anchor="middle" font-size="15" font-family="inherit" fill="var(--sv-ink)">+</text>
<rect x="136" y="252" width="60" height="30" rx="6" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="166" y="273" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">b</text>
<rect x="226" y="252" width="60" height="30" rx="6" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="256" y="273" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">c</text>
<line x1="196" y1="116" x2="86" y2="176" stroke="var(--sv-line)" marker-end="url(#templates-advanced-fold-arr)"/>
<line x1="196" y1="116" x2="196" y2="176" stroke="var(--sv-line)" marker-end="url(#templates-advanced-fold-arr)"/>
<line x1="196" y1="210" x2="166" y2="252" stroke="var(--sv-line)" marker-end="url(#templates-advanced-fold-arr)"/>
<line x1="196" y1="210" x2="256" y2="252" stroke="var(--sv-line)" marker-end="url(#templates-advanced-fold-arr)"/>
<text x="196" y="306" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">a + (b + c)　包在运算符右侧递归</text>
<rect x="392" y="42" width="352" height="272" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="568" y="66" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-muted)">(... + args) 左折叠</text>
<rect x="538" y="82" width="60" height="34" rx="6" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="568" y="105" text-anchor="middle" font-size="15" font-family="inherit" fill="var(--sv-ink)">+</text>
<rect x="458" y="176" width="60" height="34" rx="6" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="488" y="199" text-anchor="middle" font-size="15" font-family="inherit" fill="var(--sv-ink)">+</text>
<rect x="638" y="176" width="60" height="34" rx="6" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="668" y="199" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">c</text>
<rect x="428" y="252" width="60" height="30" rx="6" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="458" y="273" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">a</text>
<rect x="518" y="252" width="60" height="30" rx="6" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="548" y="273" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">b</text>
<line x1="568" y1="116" x2="488" y2="176" stroke="var(--sv-line)" marker-end="url(#templates-advanced-fold-arr)"/>
<line x1="568" y1="116" x2="668" y2="176" stroke="var(--sv-line)" marker-end="url(#templates-advanced-fold-arr)"/>
<line x1="488" y1="210" x2="458" y2="252" stroke="var(--sv-line)" marker-end="url(#templates-advanced-fold-arr)"/>
<line x1="488" y1="210" x2="548" y2="252" stroke="var(--sv-line)" marker-end="url(#templates-advanced-fold-arr)"/>
<text x="568" y="306" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">(a + b) + c　包在运算符左侧展开</text>
<rect x="16" y="324" width="728" height="46" rx="8" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="380" y="343" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">无符号整数等满足结合律的运算两种方向结果相同；对 - 以及浮点 + 则可能不同：</text>
<text x="380" y="362" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">(args - ...) = a − (b − c)　　(... - args) = (a − b) − c</text>
</svg>
<figcaption>图 1 · 折叠表达式的结合方向：括号写在哪一侧，包就从哪一侧展开</figcaption>
</figure>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>写变参接口时先问空包怎么办。一元折叠里 <code>&amp;&amp;</code> 的空包是 true、<code>||</code> 是 false、逗号是 void()，其余运算符对空包是 ill-formed；需要“空包也合法”时用二元折叠给一个初始值。</div></div>
</section>

<section class="sec">
<h2>SFINAE 与 enable_if：让不合格的候选安静退出</h2>
<p><mark>SFINAE</mark> 是 Substitution Failure Is Not An Error 的缩写。在函数模板的模板实参推导与替换期间，如果某个类型或表达式在<mark>立即上下文</mark>（immediate context）中无效，这个候选会被移出重载集，而不是让整个编译失败。它是 C++98 就存在的规则，C++11 的表达式 SFINAE 把可检查的范围从类型扩展到了表达式。</p>
<p><code>std::enable_if</code> 是把这条规则变成接口的经典工具。它的定义等价于“只有布尔条件为真时才有 <code>type</code> 成员”，所以 <code>std::enable_if_t&lt;B, T&gt;</code>（C++14 的别名模板）在 B 为假时替换失败，候选随之消失。放置位置有三类：返回类型、额外的模板参数、函数参数的默认值。返回类型写法直观但污染签名；额外模板参数不影响调用形式，却会出现在诊断里；参数占位写法最老，也最难读。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;type_traits&gt;

// 写法一：额外模板参数（不影响函数签名）
template &lt;class T,
          std::enable_if_t&lt;std::is_integral_v&lt;T&gt;, int&gt; = 0&gt;
T twice(T v) { return v + v; }

// 写法二：返回类型（会改变签名，需注意重载与 ABI）
template &lt;class T&gt;
std::enable_if_t&lt;std::is_integral_v&lt;T&gt;, T&gt; twice_v2(T v) { return v + v; }</code></pre>
<p>SFINAE 的工程问题不在机制，而在表达力与诊断。要求只能写成难以阅读的表达式；候选失败时编译器不知道“为什么”，只能把整个候选集打印出来；组合多个条件要层层嵌套或借助 <code>std::conjunction</code>；不同编译器的诊断质量差异很大。C++20 之后新代码应优先 concepts，但维护老代码、阅读标准库实现仍然需要看懂 SFINAE。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="SFINAE 候选集筛选图：四个候选经过替换，两个因替换失败被移除，剩余两个进入重载决议并选中 f(int)">
<defs>
<marker id="templates-advanced-sfinae-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-line)"/></marker>
</defs>
<text x="380" y="24" text-anchor="middle" font-size="15" font-family="inherit" fill="var(--sv-ink)">SFINAE：替换失败只是“这个候选不参与”，不是编译错误</text>
<rect x="16" y="42" width="316" height="322" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="174" y="66" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-muted)">1 · 候选集（1 个普通函数 + 3 个模板）</text>
<rect x="32" y="82" width="284" height="54" rx="7" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="44" y="104" font-size="13" font-family="inherit" fill="var(--sv-ink)">f(int)</text>
<text x="44" y="124" font-size="12" font-family="inherit" fill="var(--sv-muted)">非模板函数，无需替换</text>
<text x="300" y="114" text-anchor="end" font-size="13" font-family="inherit" fill="var(--sv-ink)">通过</text>
<rect x="32" y="148" width="284" height="54" rx="7" fill="var(--sv-panel)" stroke="var(--sv-c)"/>
<text x="44" y="170" font-size="13" font-family="inherit" fill="var(--sv-ink)">f(T) 要求 T::size()</text>
<text x="44" y="190" font-size="12" font-family="inherit" fill="var(--sv-muted)">int 没有 size()，立即上下文中失败</text>
<text x="300" y="180" text-anchor="end" font-size="13" font-family="inherit" fill="var(--sv-ink)">移除</text>
<rect x="32" y="214" width="284" height="54" rx="7" fill="var(--sv-panel)" stroke="var(--sv-c)"/>
<text x="44" y="236" font-size="13" font-family="inherit" fill="var(--sv-ink)">f(T*) 要求 T::foo()</text>
<text x="44" y="256" font-size="12" font-family="inherit" fill="var(--sv-muted)">实参不是指针，推导阶段即失败</text>
<text x="300" y="246" text-anchor="end" font-size="13" font-family="inherit" fill="var(--sv-ink)">移除</text>
<rect x="32" y="280" width="284" height="54" rx="7" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="44" y="302" font-size="13" font-family="inherit" fill="var(--sv-ink)">f(T) enable_if&lt;is_integral_v&lt;T&gt;&gt;</text>
<text x="44" y="322" font-size="12" font-family="inherit" fill="var(--sv-muted)">条件为真，type 存在</text>
<text x="300" y="312" text-anchor="end" font-size="13" font-family="inherit" fill="var(--sv-ink)">通过</text>
<rect x="424" y="54" width="320" height="146" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="584" y="78" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-muted)">2 · 可行候选集（viable）</text>
<rect x="440" y="92" width="288" height="38" rx="6" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="452" y="116" font-size="13" font-family="inherit" fill="var(--sv-ink)">f(int)</text>
<rect x="440" y="142" width="288" height="38" rx="6" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="452" y="166" font-size="13" font-family="inherit" fill="var(--sv-ink)">f(T)  [T = int]</text>
<rect x="424" y="224" width="320" height="140" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="584" y="248" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-muted)">3 · 重载决议</text>
<text x="584" y="282" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">f(int) 胜出</text>
<text x="584" y="308" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">转换序列相同，同分时非模板优先</text>
<text x="584" y="330" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">两个候选都可行，再比较转换序列</text>
<text x="584" y="352" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">失败者不产生诊断，也不参与排序</text>
<line x1="316" y1="109" x2="424" y2="111" stroke="var(--sv-line)" marker-end="url(#templates-advanced-sfinae-arr)"/>
<polyline points="316,307 370,307 370,161 424,161" fill="none" stroke="var(--sv-line)" marker-end="url(#templates-advanced-sfinae-arr)"/>
<text x="380" y="378" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">移除发生在替换阶段；若失败发生在实例化后的函数体或类体内，则是硬错误</text>
</svg>
<figcaption>图 2 · SFINAE 的候选集筛选：失败只影响候选资格，不影响编译结果</figcaption>
</figure>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>SFINAE 只保护<mark>立即上下文</mark>。模板参数列表里的 <code>typename T::value_type</code> 替换失败会被移除；但如果你在函数体或类模板成员里实例化它，或者写下 <code>static_assert</code>，那就是硬错误，任何 <code>enable_if</code> 都救不回来。写约束时要把检查放在签名能看见的地方。</div></div>
<p>从重载决议的角度看，SFINAE 发生在“候选可行性”之前：先推导与替换，失败者移除；剩下的按转换序列排序；最后才比较模板偏序。concepts 把同一件事换到一个显式、可诊断的位置执行：推导照常进行，约束满足性单独判定，而且失败原因是可查询的。理解这个顺序，才能解释为什么有些写法“看起来该被 SFINAE 掉”，实际却是硬错误。</p>
</section>

<section class="sec">
<h2>type traits 与检测惯用法：在类型层面提问</h2>
<p><mark>type traits</mark> 是 <code>&lt;type_traits&gt;</code> 里的一组编译期谓词与类型变换，C++11 起成为标准。谓词是派生自 <code>std::integral_constant&lt;bool, ...&gt;</code> 的类模板（C++17 起有别名 <code>std::bool_constant</code>），用 <code>::value</code> 取布尔值；C++14 加了 <code>_t</code> 别名（<code>std::decay_t&lt;T&gt;</code>），C++17 加了 <code>_v</code> 变量模板（<code>std::is_integral_v&lt;T&gt;</code>），写法才逐渐可读。它们大致分为四类：主要类型类别、复合类型类别、类型属性、类型变换。</p>
<p>几个高频陷阱值得单独记：<code>std::is_integral_v&lt;bool&gt;</code> 是 true，<code>bool</code> 属于整数类型；<code>std::is_same_v&lt;int, const int&gt;</code> 是 false，比较前通常要先去掉 cv 与引用；<code>std::decay_t</code> 除了去 cv 与引用，还会把数组退化为指针、把函数退化为函数指针；C++20 的 <code>std::remove_cvref_t</code> 只做前一件事，语义更窄，适合转发场景。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>输入类型</th><th><code>std::decay_t</code></th><th><code>std::remove_cvref_t</code>（C++20）</th></tr></thead>
<tbody>
<tr><td><code>const int&amp;</code></td><td><code>int</code></td><td><code>int</code></td></tr>
<tr><td><code>int[4]</code></td><td><code>int*</code></td><td><code>int[4]</code></td></tr>
<tr><td><code>void(int)</code></td><td><code>void(*)(int)</code></td><td><code>void(int)</code></td></tr>
<tr><td><code>const std::string</code></td><td><code>std::string</code></td><td><code>std::string</code></td></tr>
</tbody>
</table></div>
<p>把 traits 与 SFINAE 组合，就得到<mark>检测惯用法</mark>（detection idiom）。C++17 的 <code>std::void_t</code> 是一个“无论传入什么都变成 void”的别名模板，配合偏特化可以把“表达式是否良构”转成 <code>true_type</code> 或 <code>false_type</code>。下面这段代码可直接编译，两个 <code>static_assert</code> 就是它的规格说明。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;string&gt;
#include &lt;type_traits&gt;
#include &lt;utility&gt;

template &lt;class T, class = void&gt;
struct has_size : std::false_type {};

template &lt;class T&gt;
struct has_size&lt;T, std::void_t&lt;decltype(std::declval&lt;const T&amp;&gt;().size())&gt;&gt;
    : std::true_type {};

static_assert(has_size&lt;std::string&gt;::value);
static_assert(!has_size&lt;int&gt;::value);</code></pre>
<p>注意 <code>std::declval</code> 只能出现在不求值的上下文（<code>decltype</code>、<code>sizeof</code>、<code>noexcept</code> 等），它不需要类型可默认构造。这个惯用法在 C++20 有了直接替代：<code>requires(const T&amp; v) { v.size(); }</code> 可读性更好，失败时还能给出具体是哪条要求不满足。</p>
<p>使用 traits 时还要区分“可转换”与“可构造”：<code>std::is_convertible_v&lt;A, B&gt;</code> 检查隐式转换，<code>std::is_constructible_v&lt;B, A&gt;</code> 允许 <code>explicit</code> 构造函数，二者结论可能不同。traits 描述的是类型属性，不是接口契约；用 traits 拼出来的约束往往能通过编译，却读不出设计意图，这正是 concepts 要解决的问题。</p>
</section>

<section class="sec">
<h2>C++20 concepts 与 requires：把契约写成代码</h2>
<p><mark>concept</mark> 是 C++20 引入的具名编译期谓词，专门用来约束模板参数。最简单的定义形式是 <code>template&lt;class T&gt; concept Addable = requires(T a, T b) { { a + b } -&gt; std::convertible_to&lt;T&gt;; };</code>。concept-id 是 bool 常量表达式，但它不只是布尔值：它参与约束归一化，能比较包含关系，因而能影响重载排序。</p>
<p><mark>requires 表达式</mark>（requires-expression）用来描述“哪些表达式必须良构”，它本身不求值，只在编译期检查。要求分四类：简单要求（<code>a + b;</code>，表达式必须良构）、类型要求（<code>typename T::value_type;</code>，类型必须存在）、复合要求（<code>{ expr } noexcept -&gt; Concept;</code>，检查表达式、异常规格与返回类型）、嵌套要求（<code>requires sizeof(T) &gt; 4;</code>，在 requires 体内再要求一个常量表达式为真）。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="concepts 约束示意图：左侧 requires 表达式逐项检查四类要求，右侧 integral 与 signed_integral 的包含关系决定重载排序">
<defs>
<marker id="templates-advanced-concepts-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-line)"/></marker>
</defs>
<text x="380" y="24" text-anchor="middle" font-size="15" font-family="inherit" fill="var(--sv-ink)">concept = 编译期布尔函数 + 可比较的约束</text>
<rect x="16" y="42" width="358" height="322" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="195" y="66" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-muted)">requires 表达式：逐项检查</text>
<rect x="32" y="82" width="326" height="42" rx="6" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="44" y="108" font-size="13" font-family="inherit" fill="var(--sv-ink)">简单要求　a + b;</text>
<rect x="32" y="132" width="326" height="42" rx="6" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="44" y="158" font-size="13" font-family="inherit" fill="var(--sv-ink)">类型要求　typename T::value_type;</text>
<rect x="32" y="182" width="326" height="42" rx="6" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="44" y="208" font-size="13" font-family="inherit" fill="var(--sv-ink)">复合要求　{ a + b } -&gt; convertible_to&lt;T&gt;</text>
<rect x="32" y="232" width="326" height="42" rx="6" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="44" y="258" font-size="13" font-family="inherit" fill="var(--sv-ink)">嵌套要求　requires sizeof(T) &gt; 4;</text>
<line x1="195" y1="278" x2="195" y2="302" stroke="var(--sv-line)" marker-end="url(#templates-advanced-concepts-arr)"/>
<rect x="72" y="306" width="246" height="40" rx="6" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="195" y="331" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">全部满足 → concept 为 true</text>
<rect x="398" y="42" width="346" height="322" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="571" y="66" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-muted)">subsumption：约束的包含关系</text>
<ellipse cx="571" cy="170" rx="148" ry="92" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<ellipse cx="571" cy="178" rx="74" ry="48" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="571" y="112" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">integral&lt;T&gt;</text>
<text x="571" y="182" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">signed_integral&lt;T&gt;</text>
<text x="571" y="278" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">满足内层必然满足外层</text>
<rect x="424" y="292" width="294" height="56" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="571" y="314" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">重载 f(T) requires integral 与</text>
<text x="571" y="333" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">f(T) requires signed_integral：后者更受约束</text>
</svg>
<figcaption>图 3 · concepts：左侧是 requires 体的检查项，右侧是约束包含关系带来的重载排序</figcaption>
</figure>
<p>标准库已经提供了大量现成 concepts，优先复用而不是自己发明：<code>&lt;concepts&gt;</code> 里的 <code>same_as</code>、<code>derived_from</code>、<code>convertible_to</code>、<code>integral</code>、<code>signed_integral</code>、<code>floating_point</code>、<code>assignable_from</code>、<code>swappable</code>、<code>destructible</code>、<code>movable</code>、<code>copyable</code>、<code>equality_comparable</code>、<code>totally_ordered</code>、<code>regular</code>、<code>invocable</code>、<code>predicate</code>；<code>&lt;iterator&gt;</code> 与 <code>&lt;ranges&gt;</code> 还定义了迭代器与范围 concepts。组合它们比手写 <code>enable_if</code> 表达式清楚得多。</p>
<p><mark>简写模板</mark>（abbreviated function templates）让约束更像类型标注：<code>void f(std::integral auto x);</code> 等价于一个带 <code>std::integral</code> 约束的模板参数。要小心，每个 <code>auto</code> 都是独立的模板参数，<code>void f(std::integral auto a, std::integral auto b)</code> 允许 a 与 b 是不同类型；若要表达“两者同类型”，必须写显式的 <code>template&lt;std::integral T&gt; void f(T a, T b);</code>。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;concepts&gt;
#include &lt;iostream&gt;
#include &lt;string&gt;

template &lt;class T&gt;
concept Addable = requires(T a, T b) {
    { a + b } -&gt; std::convertible_to&lt;T&gt;;
};

template &lt;Addable T&gt;
T sum(const T&amp; a, const T&amp; b) { return a + b; }

int main() {
    std::cout &lt;&lt; sum(1, 2) &lt;&lt; '\n';                          // 3
    std::cout &lt;&lt; sum(std::string{"a"}, std::string{"b"}) &lt;&lt; '\n';  // ab
}</code></pre>
<div class="callout callout--formula"><span class="callout__label">规则</span><div>约束满足性是逐原子约束求值：合取（<code>&amp;&amp;</code>）要求全真，析取（<code>||</code>）要求至少一真。归一化之后，若约束 A 蕴含约束 B，则 A 更受约束。concept 只检查语法与类型良构，语义（例如“这是不是全序”）编译器不验证，必须靠命名与文档承诺。</div></div>
</section>

<section class="sec">
<h2>约束如何改变重载决议，以及 if constexpr 与标签分发</h2>
<p>C++20 把约束接入了重载决议：候选先做模板实参推导与替换，再检查约束是否满足；不满足的候选不可行，不进入后面的转换序列比较。如果两个模板候选的转换序列同样好，偏序规则会比较约束：更受约束的模板胜出。要特别注意，非模板函数与模板函数同样好时，非模板仍然优先，约束不会让模板反超。</p>
<div class="formula">可行候选 ⇔ 推导成功 ∧ 约束满足
同分排序（两者均为模板时）：若 A 的约束蕴含 B、反向不成立，则 A 更受约束而优先
非模板 vs 模板同分：非模板优先（该规则未被 concepts 改变）</div>
<p>看一个包含关系的例子。<code>std::signed_integral&lt;T&gt;</code> 的定义包含 <code>std::integral&lt;T&gt;</code>，所以它更受约束。调用 <code>f(1)</code> 时两个候选都可行，第二个胜出；调用 <code>f(1u)</code> 时 <code>unsigned</code> 不满足 <code>signed_integral</code>，只剩第一个。若两个约束互不包含却同时满足，则没有“更受约束”的一方，调用会有歧义。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;concepts&gt;

template &lt;class T&gt; requires std::integral&lt;T&gt;
void f(T) {}

template &lt;class T&gt; requires std::signed_integral&lt;T&gt;
void f(T) {}

// f(1);   // 选第二个：signed_integral 包含 integral
// f(1u);  // 选第一个：unsigned 不满足 signed_integral</code></pre>
<p><mark>if constexpr</mark>（C++17）是另一条路线：条件必须是常量表达式，未选中的分支可以省去实例化。但这条“省去实例化”的保证有边界：只有在模板实体中、且条件在实例化后不再值依赖时，被丢弃的分支才不会被实例化。在非模板函数里写 <code>if constexpr (false) { int* p = 42; }</code> 依然会报错，因为被丢弃的语句仍要被完整检查。很多“为什么 if constexpr 没生效”的问题都出在这里。</p>
<p><mark>标签分发</mark>（tag dispatch）是 C++17 之前的常用手法：给实现函数多加一个 <code>std::true_type</code>、<code>std::false_type</code> 或迭代器类别参数，用重载在编译期选实现。它简单、无需把条件塞进签名，缺点是额外参数会出现在调用栈与诊断里，而且无法约束公开接口。C++20 之后，迭代器类别分发大多被 <code>std::input_iterator</code> 等 concepts 取代；但在库内部，标签分发仍常用来避免实例化昂贵的代码路径。</p>
<div class="duo">
<div class="duo__col"><h4>if constexpr 适合</h4><p>同一算法按类型属性切换实现；终止递归；避免实例化不可用的分支。要求分支位于模板实体中；在模板中，条件在实例化后不再值依赖时，被丢弃的分支才不实例化。</p></div>
<div class="duo__col"><h4>标签分发适合</h4><p>需要把选择显式交给重载集；库内部按迭代器能力分流；希望实现函数各自独立、便于阅读与测试。</p></div>
</div>
</section>

<section class="sec">
<h2>CRTP 与静态多态：把绑定提前到编译期</h2>
<p><mark>CRTP</mark> 是 Curiously Recurring Template Pattern 的缩写：派生类把自己的类型作为模板实参传给基类，基类在成员函数里用 <code>static_cast&lt;D*&gt;(this)</code> 调用派生类的实现。因为 D 在编译期已知，调用可以静态绑定、内联，不需要虚表。标准库里的 <code>std::enable_shared_from_this&lt;T&gt;</code> 就是这种思路的著名例子。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;iostream&gt;

template &lt;class D&gt;
struct Doubler {
    D twice() const {
        const D&amp; self = static_cast&lt;const D&amp;&gt;(*this);
        return self + self;
    }
};

struct Money : Doubler&lt;Money&gt; {
    long cents;
    Money() = default;
    explicit Money(long c) : cents{c} {}
    friend Money operator+(Money a, Money b) {
        return Money{a.cents + b.cents};
    }
};

int main() {
    Money m{250};
    std::cout &lt;&lt; m.twice().cents &lt;&lt; '\n';  // 500
}</code></pre>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="CRTP 与虚函数对比图：左侧 CRTP 调用链在编译期解析并内联，右侧虚函数经过 vptr 与 vtable 的间接调用">
<defs>
<marker id="templates-advanced-crtp-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-line)"/></marker>
</defs>
<text x="380" y="24" text-anchor="middle" font-size="15" font-family="inherit" fill="var(--sv-ink)">静态多态 vs 动态多态：调用链与对象布局</text>
<rect x="16" y="42" width="360" height="322" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="196" y="66" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-muted)">CRTP：编译期绑定</text>
<rect x="52" y="80" width="288" height="44" rx="6" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="196" y="107" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">d.twice()</text>
<rect x="52" y="140" width="288" height="44" rx="6" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="196" y="167" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">Doubler&lt;D&gt;::twice()</text>
<rect x="52" y="200" width="288" height="44" rx="6" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="196" y="227" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">static_cast&lt;const D&amp;&gt;(*this)</text>
<rect x="52" y="260" width="288" height="44" rx="6" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="196" y="287" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">operator+(D, D) 直接内联</text>
<line x1="196" y1="124" x2="196" y2="140" stroke="var(--sv-line)" marker-end="url(#templates-advanced-crtp-arr)"/>
<line x1="196" y1="184" x2="196" y2="200" stroke="var(--sv-line)" marker-end="url(#templates-advanced-crtp-arr)"/>
<line x1="196" y1="244" x2="196" y2="260" stroke="var(--sv-line)" marker-end="url(#templates-advanced-crtp-arr)"/>
<text x="196" y="330" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">无 vptr；典型实现中空基类经 EBO 不占独立空间</text>
<text x="196" y="350" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">标准不保证 EBO、对象大小与布局</text>
<rect x="388" y="42" width="356" height="322" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="566" y="66" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-muted)">虚函数：运行期查表</text>
<rect x="424" y="82" width="284" height="72" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="436" y="104" font-size="12" font-family="inherit" fill="var(--sv-muted)">Derived 对象（典型 64 位）</text>
<rect x="436" y="114" width="80" height="28" rx="4" fill="var(--sv-panel)" stroke="var(--sv-c)"/>
<text x="476" y="133" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">vptr</text>
<rect x="526" y="114" width="170" height="28" rx="4" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="611" y="133" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">数据成员</text>
<rect x="424" y="178" width="284" height="60" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="566" y="200" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">vtable（每类一份，只读）</text>
<text x="566" y="222" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">[0] 指向 Derived::f 的代码地址</text>
<rect x="452" y="262" width="228" height="44" rx="6" fill="var(--sv-panel)" stroke="var(--sv-c)"/>
<text x="566" y="289" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">间接调用，通常难以内联</text>
<line x1="476" y1="142" x2="476" y2="178" stroke="var(--sv-line)" marker-end="url(#templates-advanced-crtp-arr)"/>
<line x1="566" y1="238" x2="566" y2="262" stroke="var(--sv-line)" marker-end="url(#templates-advanced-crtp-arr)"/>
<text x="566" y="330" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">vptr 位置、vtable 布局、名字修饰均取决于 ABI</text>
<text x="566" y="350" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">标准不规定这些细节</text>
</svg>
<figcaption>图 4 · CRTP 的静态调用链与虚函数的 vptr/vtable 间接调用对比（布局为典型实现，非标准保证）</figcaption>
</figure>
<p>CRTP 的代价常被低估。派生类 D 必须在基类成员被实例化时是完整类型；基类依赖派生类的名字，错误信息会沿着继承链堆叠；不同 <code>Base&lt;A&gt;</code> 与 <code>Base&lt;B&gt;</code> 是不同类型，无法放进同一个容器，除非再引入一个非模板基类或类型擦除；按值传递基类会发生切片。它适合静态接口、mixin 加成员、计数器、表达式模板这类“编译期就要确定组合”的场景，不适合插件式运行时多态。</p>
<p>C++23 的<mark>显式对象参数</mark>（deducing this，P0847）允许成员函数把自身类型写成显式参数，能替代一部分 CRTP 用法，尤其是把同一份实现复用到 const 与非 const 对象上。但它不能替代“通过继承给派生类添加成员”的 mixin 用法，CRTP 在库设计中仍有位置。</p>
</section>

<section class="sec">
<h2>工程取舍：模板元编程的账要算清楚</h2>
<p><mark>模板元编程</mark>（template metaprogramming，TMP）不是免费的。每个翻译单元都会重复实例化用到的模板，编译时间随参数组合增长；不同参数组合生成不同代码，二进制体积可能膨胀；诊断信息以实例化栈的形式出现，定位成本高；调试器里的模板类型名往往难以阅读。模板通常必须定义在头文件里（C++20 modules 可以缓解），跨共享库边界暴露模板会把编译器、标准库实现与编译选项绑在一起，ABI 稳定性无从谈起。</p>
<p>选择顺序可以总结为：优先 concepts，其次 <code>if constexpr</code>，再次标签分发，最后才是 SFINAE。约束放在公开接口与算法入口，不要在每一层内部重复加约束；能用标准 concepts 组合就不要手写表达式；concept 只约束语法良构，语义承诺必须写进文档与测试。过度约束会让本来可复用的类型被挡在门外，约束不足则把错误推给调用者。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>排障时从错误信息里的 “required from here” 链条找到第一处自己写的代码，而不是盯着最深处的标准库行号。把可疑条件单独抽成 <code>static_assert(std::is_same_v&lt;...&gt;)</code> 能快速缩小范围；给关键模板补“负向编译测试”（故意传错类型，确认被约束拒绝）比只测正确路径更有价值。</div></div>
<p>TMP 适合类型级计算、异构容器、序列化字段表、表达式模板与零开销策略组合；不适合需要运行时决定类型、需要跨 ABI 边界、或编译时间已经成为瓶颈的项目。后者的常规替代是虚函数、<code>std::function</code> 与类型擦除，具体实现与开销在 inheritance-vtable 与 smart-pointers 两篇展开。</p>
<div class="duo">
<div class="duo__col"><h4>值得用模板</h4><p>类型信息在编译期完整；零开销抽象确实重要；组合数量可控；可以接受头文件实现与较长的编译时间。</p></div>
<div class="duo__col"><h4>更该用运行时方案</h4><p>类型集合开放或来自插件；需要稳定 ABI；错误要在运行时恢复；团队更看重编译速度与诊断可读性。</p></div>
</div>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>不要为了展示技巧而写 TMP。模板代码的第一读者是半年后的维护者，第二读者才是编译器。一个能被读懂的 <code>if constexpr</code> 分支，通常胜过一个需要三行注释解释的 SFINAE 表达式。</div></div>
</section>

<section class="sec">
<h2>自测：四个容易混淆的边界</h2>
<details class="quiz"><summary>Q1 · <code>(std::cout &lt;&lt; ... &lt;&lt; args)</code> 是哪种折叠？空包时输出什么？</summary><div class="quiz__a">二元左折叠，初始值是 <code>std::cout</code>，运算符是 <code>&lt;&lt;</code>，展开为 <code>((std::cout &lt;&lt; a) &lt;&lt; b) &lt;&lt; c</code>。空包时结果就是初始值本身，即返回 <code>std::cout</code> 的引用，不输出任何内容。注意它返回的是流引用，可以继续链式使用。</div></details>
<details class="quiz"><summary>Q2 · 为什么 <code>template&lt;class T&gt; struct S { void f(T&amp;&amp;); };</code> 里的 <code>T&amp;&amp;</code> 不是转发引用？</summary><div class="quiz__a">转发引用要求类型推导发生在调用点。类模板的 T 在实例化 <code>S&lt;int&gt;</code> 时已经确定，此时 <code>T&amp;&amp;</code> 只是普通的右值引用，<code>f</code> 不能接受左值。要转发，应把 <code>f</code> 写成独立的函数模板，或使用 <code>auto&amp;&amp;</code> 参数。</div></details>
<details class="quiz"><summary>Q3 · 同时存在 <code>requires std::integral&lt;T&gt;</code> 与 <code>requires std::signed_integral&lt;T&gt;</code> 的两个 <code>f</code>，调用 <code>f(1u)</code> 选哪个？</summary><div class="quiz__a">选 <code>integral</code> 版本。因为 <code>unsigned</code> 满足 <code>integral</code> 但不满足 <code>signed_integral</code>，第二个候选不可行，只剩第一个。若换成 <code>f(1)</code>，两者都可行，<code>signed_integral</code> 包含 <code>integral</code>，更受约束的第二个胜出。若两个约束互不包含且都满足，则是歧义调用。</div></details>
<details class="quiz"><summary>Q4 · 在普通函数里写 <code>if constexpr (false) { int* p = 42; }</code> 能编译吗？</summary><div class="quiz__a">不能。C++17 规定，若 <code>if constexpr</code> 不在模板实体中，被丢弃的语句仍会被完整检查，<code>int* p = 42;</code> 是类型错误。只有在模板中且条件在实例化后不再值依赖时，被丢弃的分支才不会被实例化。这也是泛型代码里常把这类分支封装进模板函数的原因。</div></details>
</section>

<section class="sec">
<h2>延伸阅读</h2>
<ul class="refs">
<li><b>cppreference · Constraints and concepts</b> — cppreference.com。约束语法、requires 表达式、原子约束与 subsumption 的速查，示例覆盖 C++20 的主要写法。</li>
<li><b>P0734R0 · Wording for Concepts</b> — Andrew Sutton 等, 2017。C++20 concepts 的核心措辞提案，适合想弄清标准原文如何定义约束归一化与排序的读者。</li>
<li><b>P0898R3 · Standard Library Concepts</b> — Casey Carter 等, 2018。标准库 concepts 与迭代器、范围约束的基础提案，配合 cppreference 阅读。</li>
<li><b>《C++ Templates: The Complete Guide》第 2 版</b> — David Vandevoorde, Nicolai Josuttis, Douglas Gregor, 2017。变参模板、SFINAE、traits 与元编程的系统教材，C++17 口径。</li>
<li><b>C++ Core Guidelines · T.10–T.24</b> — Bjarne Stroustrup, Herb Sutter。关于 concept 的使用、命名与标准 concepts 复用的工程条款，强调语义表达优先于语法技巧。</li>
</ul>
</section>`
};
