window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["templates-basics"] = {
  slug: "templates-basics",
  title: "模板基础与实例化",
  subtitle: "泛型编程的入口",
  level: 3,
  cluster: "泛型与标准库",
  tags: ["函数模板", "类模板", "特化"],
  summary: "从函数模板与类模板讲到参数推导、显式实参、实例化与代码膨胀、全特化与偏特化，再拆开依赖名称、typename、两阶段查找和模板的 ODR 规则，让你看懂容器与算法的实现方式。",
  keyPoints: [
    "模板是编译期的代码生成器，不是运行时多态，也不是文本替换的宏",
    "模板实参可以推导也可以显式指定；推导失败时先检查类型是否一致",
    "每个使用的类型组合都会产生一份实例化，链接器按符号合并同一实例",
    "全特化改写某个具体类型，偏特化改写一类类型模式，函数模板用重载替代偏特化",
    "隐式实例化时模板定义必须对实例化点可见，所以通常整体放在头文件里"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>先建立直觉：模板是编译期的代码生成器</h2>
<p>你写了一个 <code>maxOf(a, b)</code>，分别用 <code>int</code>、<code>double</code>、<code>std::string</code> 调用它。源文件里只有一份函数体，但目标文件里通常会出现三份独立的实例代码，它们的签名与实现各不相同——是否真的各生成一份函数体，取决于优化器是否内联。这不是运行时根据类型做分支，而是编译器在你调用时按类型把同一段源码“复印”了三遍。这个复印动作叫<mark>实例化</mark>（instantiation），被复印的蓝图叫<mark>模板</mark>（template）。</p>
<p>理解这一点，后面所有现象都能推出来：为什么模板代码通常放头文件（复印时必须看得见蓝图）、为什么模板错误信息那么长（错误发生在复印出来的那一份上）、为什么会<mark>代码膨胀</mark>（类型组合多，复印件就多）、为什么两阶段查找存在（复印前能查的名字和复印后才能查的名字不是一回事）。</p>
<p>模板也不是宏。<mark>宏</mark>（macro）在预处理阶段做文本替换，不认识类型、不参与作用域、不检查语法；模板是语言的一部分，参与重载决议、类型检查和访问控制，只是它的“求值”发生在编译期。把模板当宏用，就会写出参数被意外求值多次、类型约束全靠注释的代码。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>模板像一台印钞机：你提供版式（模板定义）和纸张（模板实参），它印出对应面额的钞票（实例）。印出来的每张都是真钱，但印版本身不是钱——模板在没有被实例化之前，不产生任何可执行代码。</div></div>
</section>

<section class="sec">
<h2>函数模板：推导、显式实参与返回类型</h2>
<p>函数模板的写法是在函数前加一行 <code>template</code> 声明，把需要泛化的类型写成<mark>模板参数</mark>（template parameter）。调用时通常不写尖括号，由编译器从实参<mark>推导</mark>（deduction）出模板实参。</p>
<pre class="code" data-lang="cpp"><code>template &lt;typename T&gt;
T maxOf(T a, T b) {
    return a &lt; b ? b : a;
}

int  i = maxOf(3, 7);        // T = int
double d = maxOf(1.5, 2.5);  // T = double</code></pre>
<p>推导的规则可以压缩成一句话：<b>按值形参 T 推导时，实参的顶层 const/volatile 被忽略，数组和函数类型退化为指针；随后要求每个出现 T 的位置推出同一个类型</b>。所以 <code>maxOf(1, 2.5)</code> 会失败——第一个实参要求 <code>T = int</code>，第二个要求 <code>T = double</code>，编译器不会替你选一个“更宽”的类型，也不会做隐式转换来统一它们。这是新手最常见的模板报错来源。</p>
<p>解决办法有三条：显式指定模板实参，如 <code>maxOf&lt;double&gt;(1, 2.5)</code>，此时第一个实参按普通函数调用规则转换为 <code>double</code>；把模板改成两个参数 <code>template &lt;typename T, typename U&gt;</code>，并用 <code>std::common_type_t&lt;T, U&gt;</code> 统一返回类型（<code>std::common_type</code> 是 C++11，<code>_t</code> 别名是 C++14）；或者在调用处先把实参转换成同一类型。标准库的 <code>std::max</code> 不做类型提升：它要求两个实参推导出同一个 <code>T</code>，类型不一致就推导失败，把显式转换或显式实参的选择交给调用者。</p>
<p>返回类型是另一个坑。C++11 之前没有尾置返回类型和 <code>decltype</code>，通常要借助 traits、显式指定返回类型或编译器扩展；C++11 起可以写 <code>auto add(T t, U u) -&gt; decltype(t + u)</code>；C++14 起可以只写 <code>auto</code>，由 return 语句推导。注意 <code>decltype</code> 与 <code>auto</code> 的推导规则不同：<code>decltype((expr))</code> 对左值表达式会保留引用与 cv 限定，而普通的 <code>auto</code> 一律按值剥离；这正是 <code>decltype(auto)</code>（C++14）存在的理由。</p>
<div class="formula">常见推导失败：同一模板参数在不同实参位置推出不同类型；显式实参 &lt;T&gt; 会关闭该参数的推导，只做转换与匹配</div>
</section>

<section class="sec">
<h2>类模板：类型参数与非类型参数</h2>
<p>类模板把“类型”提升为类的参数，<code>std::vector&lt;int&gt;</code> 与 <code>std::vector&lt;double&gt;</code> 是两个完全无关的类型，不共享继承关系，也不能互相赋值。写类模板时，成员函数的定义默认在使用到它时才实例化——这叫<mark>惰性实例化</mark>（lazy instantiation）。虚成员函数是常见例外：标准不规定实现是否在类实例化时生成那些否则不会被实例化的虚函数。惰性实例化让 <code>std::vector&lt;T&gt;</code> 可以容纳没有默认构造函数的类型，只要你不调用需要默认构造元素的成员（例如单参数 <code>resize</code>、<code>vector(n)</code>）。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;cstddef&gt;

template &lt;typename T, std::size_t N&gt;
class FixedArray {
public:
    T&amp; operator[](std::size_t i) { return data_[i]; }
    constexpr std::size_t size() const { return N; }
private:
    T data_[N]{};
};

FixedArray&lt;int, 4&gt; a;   // N 是非类型模板参数
// a.size() == 4，尺寸在编译期已知</code></pre>
<p><code>N</code> 是<mark>非类型模板参数</mark>（non-type template parameter, NTTP），它的实参必须是编译期常量。C++17 起可以写 <code>template &lt;auto N&gt;</code>，由实参推导这个非类型参数的类型；C++20 起 NTTP 还可以是<b>结构类型</b>（structural type）的类类型，要求所有基类都是 public、所有非静态数据成员都是 public 且非 mutable，并且类型是字面量类型。NTTP 的价值在于把尺寸、对齐值等编译期常量编码进类型，让编译器在编译期完成布局计算，<code>std::array</code> 就是典型例子。</p>
<p>类模板也可以有默认模板实参，写法与函数默认参数类似，但作用在模板参数上（类型或非类型），如 <code>template &lt;typename T, typename Alloc = std::allocator&lt;T&gt;&gt; class vector;</code>。类模板参数推导（Class Template Argument Deduction, CTAD）从 C++17 开始可用，<code>std::pair p{1, 2.0}</code> 能推出 <code>std::pair&lt;int, double&gt;</code>；C++20 又允许为聚合类模板自动生成推导指引。CTAD 只影响书写方式，不改变实例化本质。</p>
<p>C++20 还引入了简写函数模板（abbreviated function template）：<code>void print(const auto&amp; x)</code> 等价于一个由 <code>auto</code> 推导类型参数的函数模板；只有写成 <code>Concept auto</code> 时，才会给这个参数加上对应的约束。它属于 concepts 体系，本篇只用不展开，约束与 SFINAE 的取舍在 templates-advanced 中讨论。</p>
</section>

<section class="sec">
<h2>实例化流程：从模板到机器码</h2>
<p>一次隐式实例化大致经过四步：编译器读到调用点，用实参推导出模板实参；检查该组合是否已经实例化过，若没有就按定义生成一份特化代码；对生成代码做类型检查与优化；最后把符号写进当前目标文件。相同实例可能出现在多个编译单元里，链接器通过<mark>弱符号</mark>或 COMDAT 段把重复定义合并成一份——具体机制取决于平台与 ABI，标准只规定行为，不规定实现方式。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="模板实例化流程：模板定义按不同实参生成独立代码，再由链接器合并重复实例">
<defs>
<marker id="templates-basics-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"/></marker>
</defs>
<text x="24" y="26" font-size="13" fill="var(--sv-muted)" font-family="inherit">① 模板定义</text>
<text x="196" y="26" font-size="13" fill="var(--sv-muted)" font-family="inherit">② 绑定实参</text>
<text x="380" y="26" font-size="13" fill="var(--sv-muted)" font-family="inherit">③ 生成特化代码</text>
<text x="560" y="26" font-size="13" fill="var(--sv-muted)" font-family="inherit">④ 目标文件</text>
<rect x="24" y="130" width="140" height="110" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="40" y="160" font-size="13" fill="var(--sv-ink)" font-family="inherit">template</text>
<text x="40" y="182" font-size="13" fill="var(--sv-ink)" font-family="inherit">&lt;typename T&gt;</text>
<text x="40" y="204" font-size="13" fill="var(--sv-ink)" font-family="inherit">T maxOf(T, T)</text>
<text x="40" y="226" font-size="12" fill="var(--sv-muted)" font-family="inherit">T 尚未确定</text>
<rect x="196" y="60" width="140" height="60" rx="8" fill="var(--sv-a)" stroke="var(--sv-a)"/>
<text x="214" y="96" font-size="14" fill="var(--sv-ink)" font-family="inherit">T = int</text>
<rect x="196" y="155" width="140" height="60" rx="8" fill="var(--sv-a2)" stroke="var(--sv-a2)"/>
<text x="214" y="191" font-size="14" fill="var(--sv-ink)" font-family="inherit">T = double</text>
<rect x="196" y="250" width="140" height="60" rx="8" fill="var(--sv-b)" stroke="var(--sv-b)"/>
<text x="214" y="286" font-size="14" fill="var(--sv-ink)" font-family="inherit">T = std::string</text>
<rect x="380" y="60" width="150" height="60" rx="8" fill="var(--sv-panel)" stroke="var(--sv-a)"/>
<text x="394" y="86" font-size="12" fill="var(--sv-ink)" font-family="inherit">maxOf&lt;int&gt;</text>
<text x="394" y="106" font-size="12" fill="var(--sv-muted)" font-family="inherit">独立类型检查后</text>
<rect x="380" y="155" width="150" height="60" rx="8" fill="var(--sv-panel)" stroke="var(--sv-a2)"/>
<text x="394" y="181" font-size="12" fill="var(--sv-ink)" font-family="inherit">maxOf&lt;double&gt;</text>
<text x="394" y="201" font-size="12" fill="var(--sv-muted)" font-family="inherit">重新生成机器码</text>
<rect x="380" y="250" width="150" height="60" rx="8" fill="var(--sv-panel)" stroke="var(--sv-b)"/>
<text x="394" y="276" font-size="12" fill="var(--sv-ink)" font-family="inherit">maxOf&lt;string&gt;</text>
<text x="394" y="296" font-size="12" fill="var(--sv-muted)" font-family="inherit">再次生成</text>
<rect x="570" y="118" width="166" height="134" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="586" y="146" font-size="13" fill="var(--sv-ink)" font-family="inherit">TU-A.o</text>
<text x="586" y="168" font-size="13" fill="var(--sv-ink)" font-family="inherit">TU-B.o</text>
<text x="586" y="190" font-size="13" fill="var(--sv-ink)" font-family="inherit">TU-C.o</text>
<text x="586" y="218" font-size="12" fill="var(--sv-muted)" font-family="inherit">各含相同实例</text>
<text x="586" y="238" font-size="12" fill="var(--sv-muted)" font-family="inherit">链接器合并</text>
<line x1="164" y1="150" x2="192" y2="95" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#templates-basics-arrow)"/>
<line x1="164" y1="185" x2="192" y2="185" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#templates-basics-arrow)"/>
<line x1="164" y1="220" x2="192" y2="278" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#templates-basics-arrow)"/>
<line x1="336" y1="90" x2="376" y2="90" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#templates-basics-arrow)"/>
<line x1="336" y1="185" x2="376" y2="185" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#templates-basics-arrow)"/>
<line x1="336" y1="280" x2="376" y2="280" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#templates-basics-arrow)"/>
<line x1="530" y1="90" x2="566" y2="140" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#templates-basics-arrow)"/>
<line x1="530" y1="185" x2="566" y2="180" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#templates-basics-arrow)"/>
<line x1="530" y1="280" x2="566" y2="225" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#templates-basics-arrow)"/>
<text x="24" y="356" font-size="12" fill="var(--sv-muted)" font-family="inherit">实例化发生在编译期；每个编译单元独立生成，重复实例由链接器按弱符号或 COMDAT 规则合并（实现相关）。</text>
</svg><figcaption>图 1 · 模板实例化流程：一份定义，按实参生成多份代码，链接期再去重</figcaption></figure>
<p>实例化有两种显式控制方式。<mark>显式实例化定义</mark>（explicit instantiation definition）写 <code>template class FixedArray&lt;int, 4&gt;;</code>，强制在本编译单元实例化该类及它在这一点已定义的非模板成员；<mark>显式实例化声明</mark>（explicit instantiation declaration）写 <code>extern template class FixedArray&lt;int, 4&gt;;</code>（C++11），告诉编译器“别处会生成，这里不要重复生成”。后者常用于大型项目的编译加速：在头文件里写 <code>extern template</code>，在一个 <code>.cpp</code> 里显式实例化，其余翻译单元就只引用符号。</p>
<p>注意一个细节：<code>extern template</code> 只是抑制隐式实例化，不改变语义；如果实际没有任何翻译单元提供定义，链接期会报未定义符号。它也不是标准库强制要求的优化，标准库是否用 <code>extern template</code> 声明并在库内显式实例化 <code>std::string</code> 等常用类型，取决于具体实现。</p>
</section>

<section class="sec">
<h2>特化：全特化与偏特化</h2>
<p>主模板（primary template）描述一般情形，但某些类型需要完全不同的实现：<code>std::vector&lt;bool&gt;</code> 通常按位压缩存储，<code>std::hash&lt;std::string&gt;</code> 需要专门的哈希算法。这时用<mark>特化</mark>（specialization）给主模板开一个更具体的版本。<mark>全特化</mark>（explicit/full specialization）固定所有模板参数；<mark>偏特化</mark>（partial specialization）只固定一部分参数，或者固定参数的某种结构，比如“所有指针类型”。</p>
<pre class="code" data-lang="cpp"><code>template &lt;typename T&gt;
struct TypeName { static constexpr const char* value = "unknown"; };

// 偏特化：匹配所有指针
template &lt;typename T&gt;
struct TypeName&lt;T*&gt; { static constexpr const char* value = "pointer"; };

// 全特化：只匹配 bool
template &lt;&gt;
struct TypeName&lt;bool&gt; { static constexpr const char* value = "bool"; };

static_assert(TypeName&lt;int*&gt;::value[0] == 'p');
static_assert(TypeName&lt;bool&gt;::value[0] == 'b');</code></pre>
<p>匹配顺序可以这样记：对一组实参，若存在针对它的显式（全）特化，就直接使用；否则看偏特化，若有多个匹配，按偏序规则选最特殊的一个；都不匹配才用主模板。这个过程完全在编译期完成，没有运行时开销。<code>TypeName&lt;const bool&gt;</code> 不会匹配 <code>TypeName&lt;bool&gt;</code> 的全特化——<code>const bool</code> 和 <code>bool</code> 是不同的类型，它会落回主模板。这是理解特化时最容易被忽略的边界。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="特化选择决策树：先精确匹配全特化，再按偏序选择最特殊的偏特化，最后回落到主模板">
<defs>
<marker id="templates-basics-arrow2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"/></marker>
</defs>
<rect x="290" y="20" width="180" height="54" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="312" y="52" font-size="14" fill="var(--sv-ink)" font-family="inherit">使用 Box&lt;T&gt;</text>
<rect x="60" y="112" width="210" height="62" rx="8" fill="var(--sv-a)" stroke="var(--sv-a)"/>
<text x="80" y="138" font-size="13" fill="var(--sv-ink)" font-family="inherit">存在 T 的显式（全）特化？</text>
<text x="80" y="158" font-size="12" fill="var(--sv-muted)" font-family="inherit">如 Box&lt;bool&gt;，要求精确匹配</text>
<rect x="500" y="112" width="210" height="62" rx="8" fill="var(--sv-a2)" stroke="var(--sv-a2)"/>
<text x="520" y="138" font-size="13" fill="var(--sv-ink)" font-family="inherit">匹配某个偏特化模式？</text>
<text x="520" y="158" font-size="12" fill="var(--sv-muted)" font-family="inherit">如 T = U* / U&amp;</text>
<rect x="60" y="222" width="210" height="62" rx="8" fill="var(--sv-panel)" stroke="var(--sv-a)"/>
<text x="84" y="248" font-size="13" fill="var(--sv-ink)" font-family="inherit">全特化 Box&lt;bool&gt;</text>
<text x="84" y="268" font-size="12" fill="var(--sv-muted)" font-family="inherit">精确匹配才生效</text>
<rect x="500" y="222" width="210" height="62" rx="8" fill="var(--sv-panel)" stroke="var(--sv-a2)"/>
<text x="524" y="248" font-size="13" fill="var(--sv-ink)" font-family="inherit">偏特化 Box&lt;U*&gt;</text>
<text x="524" y="268" font-size="12" fill="var(--sv-muted)" font-family="inherit">多个匹配按偏序选最特殊</text>
<rect x="290" y="292" width="180" height="58" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="314" y="318" font-size="13" fill="var(--sv-ink)" font-family="inherit">主模板 Box&lt;T&gt;</text>
<text x="314" y="338" font-size="12" fill="var(--sv-muted)" font-family="inherit">兜底实现</text>
<line x1="380" y1="74" x2="165" y2="108" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#templates-basics-arrow2)"/>
<text x="220" y="94" font-size="12" fill="var(--sv-muted)" font-family="inherit">先查全特化</text>
<line x1="165" y1="174" x2="165" y2="218" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#templates-basics-arrow2)"/>
<text x="175" y="200" font-size="12" fill="var(--sv-ink)" font-family="inherit">是</text>
<line x1="270" y1="143" x2="496" y2="143" stroke="var(--sv-line)" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#templates-basics-arrow2)"/>
<text x="360" y="134" font-size="12" fill="var(--sv-ink)" font-family="inherit">否，再匹配偏特化</text>
<line x1="605" y1="174" x2="605" y2="218" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#templates-basics-arrow2)"/>
<text x="615" y="200" font-size="12" fill="var(--sv-ink)" font-family="inherit">是</text>
<polyline points="500,174 445,174 445,288" fill="none" stroke="var(--sv-line)" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#templates-basics-arrow2)"/>
<text x="455" y="248" font-size="12" fill="var(--sv-ink)" font-family="inherit">否</text>
<text x="24" y="366" font-size="12" fill="var(--sv-muted)" font-family="inherit">全特化必须精确匹配；偏特化按偏序选最特殊者；函数模板不允许偏特化，应用重载替代。</text>
</svg><figcaption>图 2 · 特化选择：先精确匹配全特化，再用偏序挑选最特殊的偏特化，最后回落到主模板</figcaption></figure>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>形式</th><th>语法（示意）</th><th>匹配范围</th><th>注意事项</th></tr></thead><tbody><tr><td>主模板</td><td><code>template &lt;typename T&gt; struct X;</code></td><td>所有未特化类型</td><td>必须至少声明；实例化时需要定义</td></tr><tr><td>偏特化</td><td><code>template &lt;typename T&gt; struct X&lt;T*&gt;;</code></td><td>一类类型模式</td><td>多个匹配时按偏序选最特殊</td></tr><tr><td>全特化</td><td><code>template &lt;&gt; struct X&lt;int&gt;;</code></td><td>某一个具体类型</td><td><code>const int</code> 不匹配 <code>int</code></td></tr><tr><td>函数模板全特化</td><td><code>template &lt;&gt; void f&lt;int&gt;(int);</code></td><td>某一个具体类型</td><td>能写但通常不推荐，重载更直观</td></tr><tr><td>函数模板偏特化</td><td>语言不允许</td><td>—</td><td>用重载函数替代</td></tr></tbody></table></div>
<p>为什么函数模板不能偏特化？因为函数已经有重载机制：偏特化想表达的“对某类参数走另一套实现”，用重载能表达得更清楚，而且重载决议的规则更成熟。实践中函数模板全特化也很少用，因为它不参与重载决议的排序，容易被同名重载“截胡”，行为不符合直觉。标准库中真正依赖特化的地方，多是类模板：<code>std::hash</code>、<code>std::tuple_size</code>、<code>std::formatter</code>（C++20）。</p>
<p>特化不等于重载，也不等于继承。特化是同一模板的另一个定义，必须在使用之前被声明；如果在某个翻译单元里，特化声明晚于第一次会导致隐式实例化的使用，程序就是 ill-formed，但编译器往往不报错（no diagnostic required），表现为“有时用主模板、有时用特化”的诡异行为。规则很简单：<b>所有特化都放在主模板之后、任何使用之前</b>。</p>
</section>

<section class="sec">
<h2>依赖名称、typename 与两阶段查找</h2>
<p>模板里有些名字的含义依赖模板参数，比如 <code>std::vector&lt;T&gt;::const_iterator</code>：<code>T</code> 没确定之前，编译器不知道 <code>const_iterator</code> 是类型、静态成员还是函数。这类名字叫<mark>依赖名称</mark>（dependent name）。C++ 规定：在依赖上下文中，编译器默认把限定名当非类型处理，除非你用 <code>typename</code> 明确声明它是类型。</p>
<pre class="code" data-lang="cpp"><code>// 示意：需 #include &lt;vector&gt; 与 &lt;iostream&gt;
template &lt;typename T&gt;
void dump(const std::vector&lt;T&gt;&amp; v) {
    // 必须写 typename：const_iterator 依赖 T
    typename std::vector&lt;T&gt;::const_iterator it = v.begin();
    for (; it != v.end(); ++it) {
        std::cout &lt;&lt; *it &lt;&lt; '\n';
    }
}</code></pre>
<p>C++20 放宽了部分场景（P0634 “Down with typename”），在函数返回类型、成员声明等位置可以省略 <code>typename</code>，但为了可读性和跨标准兼容，建议在依赖类型前始终写出来。与之对称的是 <code>template</code> 消歧义关键字：当通过依赖类型的对象或指针访问成员模板，且名字后面紧跟尖括号时，要用 <code>obj.template foo&lt;int&gt;()</code> 告诉编译器后面的尖括号是模板实参而不是小于号。</p>
<p><mark>两阶段查找</mark>（two-phase lookup）把名字查找切成两半。第一阶段在模板定义处：非依赖名称立即查找并绑定，此时只能看到定义点之前的声明。第二阶段在实例化处：非限定的依赖函数名会把定义点普通查找的结果，与定义点和实例化点按实参依赖查找（argument-dependent lookup, ADL）在关联命名空间中得到的候选合并；限定的依赖名则在实例化时到相应作用域查找。这解释了两个常见现象：定义点之后才声明的普通函数，在模板里可能找不到；而放在实参关联命名空间里的函数，即使声明得晚也能被 ADL 找到——这也是运算符重载和 <code>swap</code> 惯用法的基础。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>MSVC 历史上长期采用宽松的两阶段查找（<code>/permissive</code>），大量不合规代码在 Windows 上能编译、到 GCC/Clang 上失败。使用 <code>/permissive-</code>（VS2017 15.5 起新建项目默认开启）可以让行为对齐标准。跨平台项目应在 CI 中至少用一个严格编译器验证。</div></div>
</section>

<section class="sec">
<h2>模板与 ODR：为什么定义必须放在头文件</h2>
<p>外部链接的普通函数遵循单一定义规则：整个程序里只能有一份定义，所以头文件放声明、<code>.cpp</code> 放定义。模板看起来违反了这条规则——每个编译单元都生成 <code>maxOf&lt;int&gt;</code>，链接器却把它们合并成一份，不报错。原因是标准给模板等实体开了例外：模板、类定义、inline 函数、inline 变量（C++17）允许在多个翻译单元中出现相同定义，前提是<b>每个定义逐 token 相同</b>，且名字查找结果一致。这类实体在实现中常具有<mark>弱链接</mark>（weak linkage），通过弱符号或 COMDAT 段落地；Itanium ABI 把这种链接属性称为 vague linkage。</p>
<p>由此推出工程上的硬性要求：隐式实例化时，模板的定义（而不只是声明）必须对实例化点可见，否则编译器无法生成代码。所以模板通常整体写在头文件里。反过来，如果在 <code>a.cpp</code> 定义模板、在 <code>b.cpp</code> 使用，<code>b.cpp</code> 只能看到声明，会生成一个指向该特化的外部符号引用，链接期报未定义符号——除非在 <code>a.cpp</code> 里显式实例化，或在头文件里用 <code>extern template</code> 配合一处显式实例化。</p>
<div class="formula">ODR 对模板的例外：同一模板（及其特化）在多个 TU 中可见时，定义必须逐 token 相同 ∧ 查找结果相同 ⇒ 链接器可安全合并实例；否则行为未定义（通常不报错）</div>
<p>这条例外带来一个隐蔽陷阱：两个编译单元里模板源码看起来相同，但预处理后的 token 序列可能不同（例如宏定义不一致），或者 token 相同却因为定义点可见的声明不同而绑定了不同实体——两者都违反 ODR。典型场景是 <code>NDEBUG</code>：一个 TU 在包含模板头之前定义它，另一个没有，模板体里的 <code>assert</code> 展开就不同，实例化结果也不同。构建系统应保证同一目标的编译选项一致，不要按文件设不同的宏。</p>
<div class="callout callout--tip"><span class="callout__label">技巧</span><div>排查“未定义符号”时先看符号名：在 Itanium ABI（GCC/Clang）与 MSVC 的修饰方案里，模板实例的符号通常编码了模板实参（mangled）。用 <code>c++filt</code> 或 <code>nm -C</code> 还原后，能直接看出是哪个类型组合没有实例化，往往意味着定义不可见或显式实例化漏了。Windows 上可用 <code>dumpbin /symbols</code> 查看、<code>undname</code> 还原。</div></div>
</section>

<section class="sec">
<h2>工程实践：代码膨胀、编译时间与可变参数模板</h2>
<p>每个类型组合通常生成一份代码，直接后果是目标文件和调试信息膨胀。如果一个模板内部又实例化了别的模板，组合会相乘。<code>std::map&lt;Key, Value&gt;</code> 用了 3 种键、3 种值，就是 9 份实例；再加一种键就变 12 份。默认模板实参（比较器、分配器）还会带来额外的间接实例化。所以大型项目常见的两个优化是：把与类型无关的逻辑抽到非模板基类或普通函数里（避免每份实例重复同一段代码），以及用 <code>extern template</code> 抑制重复实例化。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="代码膨胀示意：三种键类型与三种值类型组合出九份模板实例">
<defs>
<marker id="templates-basics-arrow3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"/></marker>
</defs>
<text x="24" y="52" font-size="14" fill="var(--sv-ink)" font-family="inherit">键类型（3 种）</text>
<rect x="24" y="66" width="120" height="34" rx="6" fill="var(--sv-a)" stroke="var(--sv-a)"/>
<text x="52" y="88" font-size="13" fill="var(--sv-ink)" font-family="inherit">int</text>
<rect x="24" y="108" width="120" height="34" rx="6" fill="var(--sv-a)" stroke="var(--sv-a)"/>
<text x="42" y="130" font-size="13" fill="var(--sv-ink)" font-family="inherit">string</text>
<rect x="24" y="150" width="120" height="34" rx="6" fill="var(--sv-a)" stroke="var(--sv-a)"/>
<text x="42" y="172" font-size="13" fill="var(--sv-ink)" font-family="inherit">Uuid</text>
<text x="24" y="238" font-size="14" fill="var(--sv-ink)" font-family="inherit">值类型（3 种）</text>
<rect x="24" y="252" width="120" height="34" rx="6" fill="var(--sv-b)" stroke="var(--sv-b)"/>
<text x="44" y="274" font-size="13" fill="var(--sv-ink)" font-family="inherit">User</text>
<rect x="24" y="294" width="120" height="34" rx="6" fill="var(--sv-b)" stroke="var(--sv-b)"/>
<text x="40" y="316" font-size="13" fill="var(--sv-ink)" font-family="inherit">Order</text>
<rect x="24" y="336" width="120" height="34" rx="6" fill="var(--sv-b)" stroke="var(--sv-b)"/>
<text x="40" y="358" font-size="13" fill="var(--sv-ink)" font-family="inherit">Money</text>
<line x1="150" y1="150" x2="286" y2="180" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#templates-basics-arrow3)"/>
<text x="180" y="150" font-size="12" fill="var(--sv-muted)" font-family="inherit">3 × 3 组合</text>
<rect x="292" y="60" width="136" height="54" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)"/>
<text x="304" y="83" font-size="12" fill="var(--sv-ink)" font-family="inherit">Map&lt;int,User&gt;</text>
<text x="304" y="101" font-size="12" fill="var(--sv-ink)" font-family="inherit">Map&lt;int,Order&gt;</text>
<rect x="440" y="60" width="136" height="54" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)"/>
<text x="452" y="83" font-size="12" fill="var(--sv-ink)" font-family="inherit">Map&lt;int,Money&gt;</text>
<text x="452" y="101" font-size="12" fill="var(--sv-ink)" font-family="inherit">Map&lt;string,User&gt;</text>
<rect x="588" y="60" width="150" height="54" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)"/>
<text x="600" y="83" font-size="12" fill="var(--sv-ink)" font-family="inherit">Map&lt;string,Order&gt;</text>
<text x="600" y="101" font-size="12" fill="var(--sv-ink)" font-family="inherit">Map&lt;string,Money&gt;</text>
<rect x="292" y="130" width="136" height="54" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)"/>
<text x="304" y="153" font-size="12" fill="var(--sv-ink)" font-family="inherit">Map&lt;Uuid,User&gt;</text>
<text x="304" y="171" font-size="12" fill="var(--sv-ink)" font-family="inherit">Map&lt;Uuid,Order&gt;</text>
<rect x="440" y="130" width="136" height="54" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)"/>
<text x="452" y="153" font-size="12" fill="var(--sv-ink)" font-family="inherit">Map&lt;Uuid,Money&gt;</text>
<text x="452" y="171" font-size="12" fill="var(--sv-muted)" font-family="inherit">第 9 份实例</text>
<rect x="292" y="206" width="446" height="66" rx="8" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="308" y="232" font-size="13" fill="var(--sv-ink)" font-family="inherit">每份实例：独立的成员函数、类型信息与调试信息（共 9 份）</text>
<text x="308" y="254" font-size="12" fill="var(--sv-muted)" font-family="inherit">链接器通常只按符号合并同一实例；跨组合的相同机器码是否合并，取决于 ICF 等优化</text>
<rect x="292" y="292" width="446" height="66" rx="8" fill="var(--sv-panel)" stroke="var(--sv-a2)"/>
<text x="308" y="318" font-size="13" fill="var(--sv-ink)" font-family="inherit">组合数 = 键类型数 × 值类型数（默认实参还会带来间接实例化）</text>
<text x="308" y="340" font-size="12" fill="var(--sv-muted)" font-family="inherit">再加一种键类型：9 → 12；再加一种值类型：12 → 16</text>
</svg><figcaption>图 3 · 代码膨胀示意：实例数按参数组合相乘增长，编译时间与调试信息同步上涨</figcaption></figure>
<p><mark>可变参数模板</mark>（variadic template, C++11）把这种组合推向极致：<code>template &lt;typename... Ts&gt; void log(Ts&amp;&amp;... args)</code> 接受任意个参数，<code>sizeof...(Ts)</code> 得到参数个数。C++17 的<mark>折叠表达式</mark>（fold expression）让写法和运算一样简洁，比如 <code>(std::cout &lt;&lt; ... &lt;&lt; args)</code> 逐个输出。可变参数模板是 <code>std::tuple</code>、<code>std::make_unique</code>（C++14）的完美转发、<code>std::format</code>（C++20）类型安全格式化的基础。它涉及引用折叠、完美转发和包展开，这些内容在 templates-advanced 中展开，本篇只需知道：<b>它按每组实参类型分别实例化，组合爆炸与普通模板同源</b>。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;cstddef&gt;
#include &lt;iostream&gt;
#include &lt;string&gt;

template &lt;typename T&gt;
T maxOf(T a, T b) { return a &lt; b ? b : a; }

template &lt;typename T, std::size_t N&gt;
class FixedArray {
public:
    T&amp; operator[](std::size_t i) { return data_[i]; }
    constexpr std::size_t size() const { return N; }
private:
    T data_[N]{};
};

template &lt;typename T&gt;
struct TypeName { static constexpr const char* value = "unknown"; };

template &lt;typename T&gt;
struct TypeName&lt;T*&gt; { static constexpr const char* value = "pointer"; };

template &lt;&gt;
struct TypeName&lt;bool&gt; { static constexpr const char* value = "bool"; };

int main() {
    std::cout &lt;&lt; maxOf(3, 7) &lt;&lt; '\n';           // T = int
    std::cout &lt;&lt; maxOf&lt;double&gt;(3, 7.5) &lt;&lt; '\n'; // 显式实参
    std::cout &lt;&lt; maxOf(std::string{"a"},
                        std::string{"b"}) &lt;&lt; '\n'; // T = std::string
    FixedArray&lt;int, 4&gt; a;
    a[0] = 42;
    std::cout &lt;&lt; a.size() &lt;&lt; '\n';              // 4
    std::cout &lt;&lt; TypeName&lt;int*&gt;::value &lt;&lt; '\n'; // pointer
    std::cout &lt;&lt; TypeName&lt;bool&gt;::value &lt;&lt; '\n'; // bool
}</code></pre>
<p>这份示例按 C++17 编写：<code>static constexpr</code> 数据成员从 C++17 起隐式为 inline。若用 C++11/14 编译，通常只有在取 <code>value</code> 的地址或把它绑定到引用时才会 ODR-use 它，那时需要在类外提供定义（主模板写 <code>template &lt;typename T&gt; constexpr const char* TypeName&lt;T&gt;::value;</code>，全特化还要加 <code>template &lt;&gt;</code>）。</p>
<p>最后给一份排障清单。<b>报错指向模板定义</b>，先看最上面一行“no matching function”之类的总错误，它通常会列出每个候选与推导失败的具体类型；<b>报错几十屏</b>，GCC 可用 <code>-ftemplate-backtrace-limit=0</code> 看完整实例化链，Clang 通常也会打印实例化链，实例化深度超限时用 <code>-ftemplate-depth=N</code> 放宽；<b>链接报未定义</b>，检查定义是否可见、是否有显式实例化、是否漏了某个类型的实例；<b>行为随编译单元变化</b>，检查宏不一致或特化声明晚于使用；<b>编译时间突然变长</b>，用 <code>-ftime-trace</code>（Clang）查看实例化事件，或用 <code>-ftime-report</code>（GCC）看各阶段耗时。</p>
<h3>自测</h3>
<details class="quiz"><summary>Q1 · 为什么模板的定义通常放在头文件，而普通函数只放声明？</summary><div class="quiz__a">实例化需要看到完整定义：编译器在调用点按实参生成代码，只有声明就无法生成，链接期会报未定义符号。ODR 给模板等实体开了例外，允许多个翻译单元出现相同定义，链接器再合并，所以“定义放头文件”不会引起重复定义错误。前提是每个翻译单元看到的定义逐 token 相同、名字查找结果一致。</div></details>
<details class="quiz"><summary>Q2 · <code>maxOf(1, 2.5)</code> 为什么推导失败？给出至少两种修法。</summary><div class="quiz__a">两个实参分别要求 <code>T = int</code> 和 <code>T = double</code>，同一模板参数推出不同类型，推导失败。修法一：显式指定 <code>maxOf&lt;double&gt;(1, 2.5)</code>，此时关闭推导、按普通函数调用规则把 <code>int</code> 转换为 <code>double</code>；修法二：改成两个模板参数 <code>template &lt;typename T, typename U&gt;</code> 并显式声明返回类型（如 <code>std::common_type_t&lt;T, U&gt;</code>）；修法三：调用处先转换，例如 <code>maxOf(1.0, 2.5)</code> 或 <code>maxOf(static_cast&lt;double&gt;(1), 2.5)</code>。</div></details>
<details class="quiz"><summary>Q3 · 主模板是 <code>template &lt;typename T&gt; struct X;</code>，另有偏特化 <code>X&lt;T*&gt;</code> 和全特化 <code>X&lt;bool&gt;</code>。<code>X&lt;const bool&gt;</code>、<code>X&lt;int*&gt;</code>、<code>X&lt;bool&gt;</code> 分别选哪个？</summary><div class="quiz__a"><code>X&lt;const bool&gt;</code> 选主模板——<code>const bool</code> 与 <code>bool</code> 是不同类型，全特化不匹配；<code>X&lt;int*&gt;</code> 选偏特化 <code>X&lt;T*&gt;</code>（T = int）；<code>X&lt;bool&gt;</code> 选全特化。这个例子说明特化匹配是精确的，cv 限定符不会被忽略。</div></details>
<details class="quiz"><summary>Q4 · 为什么 <code>std::vector&lt;T&gt;::const_iterator</code> 前面必须写 <code>typename</code>？C++20 有什么变化？</summary><div class="quiz__a">它是依赖名称：在模板定义阶段 <code>T</code> 未知，编译器无法判断 <code>const_iterator</code> 是类型还是静态数据成员，标准默认按非类型处理，因此需要 <code>typename</code> 显式声明。C++20 的 P0634 放宽了部分上下文（如函数返回类型、成员声明），这些位置可省略，但其他位置仍需写；为兼容旧标准和可读性，建议始终显式写出。</div></details>
<h3>延伸阅读</h3>
<ul class="refs">
<li><b>cppreference: Templates</b> — cppreference.com，持续更新。模板语法、推导、特化、依赖名称的总入口，查标准措辞最方便。</li>
<li><b>C++ Templates: The Complete Guide (2nd Edition)</b> — David Vandevoorde, Nicolai M. Josuttis, Douglas Gregor, 2017。覆盖 C++17，实例化、特化、两阶段查找讲得最系统的一本书。</li>
<li><b>C++ Core Guidelines: T.1–T.10</b> — Bjarne Stroustrup, Herb Sutter。模板与泛型编程的总则，其中 T.10 要求为所有模板参数写出 concepts。</li>
<li><b>cppreference: Dependent names</b> — cppreference.com。依赖名称、typename 与 template 消歧义关键字的规则汇总。</li>
<li><b>ISO/IEC 14882:2020, Clause 13 [temp]</b> — ISO/IEC, 2020。模板的规范性定义，实例化、特化与名称查找的最终依据。</li>
</ul>
</section>`
};
