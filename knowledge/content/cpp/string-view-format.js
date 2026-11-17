window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["string-view-format"] = {
  slug: "string-view-format",
  title: "字符串、string_view 与 format",
  subtitle: "文本处理中的生命周期陷阱",
  level: 3,
  cluster: "泛型与标准库",
  tags: ["string", "string_view", "std::format"],
  summary: "std::string 的 SSO 布局决定指针何时失效，string_view 零拷贝却极易悬垂，std::format 与 to_chars 让格式化类型安全。",
  keyPoints: [
    "std::string 拥有字节，SSO 让短串免于堆分配；阈值与 sizeof 属于标准库与 ABI 的实现细节",
    "string_view 只是指针加长度：不拥有、不保证 NUL 结尾、不延长被观察对象的生命周期",
    "只读参数优先 string_view，但不要保存、不要返回，也不要从临时 std::string 构造视图",
    "C++20 std::format 在格式串编译期可知时检查类型，chrono 可直接按日历字段格式化",
    "to_chars/from_chars 无分配且与 locale 无关，是数字与文本互转的默认工具"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>一句话：拥有、借用、渲染是三件事</h2>
<p>文本处理在 C++ 里可以拆成三个互不相同的问题：<mark>谁拥有这些字节</mark>、<mark>谁只是借用一段字节</mark>、<mark>如何把值渲染成字节</mark>。<code>std::string</code> 回答第一个，<code>std::string_view</code>（C++17）回答第二个，<code>std::format</code>（C++20）与 <code>std::to_chars</code>（C++17）回答第三个。把三者混为一谈，就会写出多余的拷贝，或者更难查的悬垂访问。</p>
<p>C++98 时代处理窄文本基本只有 <code>std::string</code> 和 <code>const char*</code>。前者拥有、可增长，但按值传递会复制；后者不携带长度，必须靠 NUL 结尾，遇到子串或二进制数据就不够用。C++17 加入 string_view，用“指针 + 长度”表示一段只读视图，让解析函数不必复制；C++20 加入 <code>std::format</code> 与 <code>char8_t</code>，把格式化从 printf 的运行时可变参数改成类型安全的模板接口。</p>
<p>本篇的顺序是：先看 std::string 的所有权与 SSO 布局，理解“指针什么时候失效”；再看 string_view 的零拷贝与悬垂；然后处理编码；接着拆 std::format、chrono 与 to_chars/from_chars；最后用正则与 locale 的边界收尾，并给出参数选择规则与排障清单。容器与算法本身在 stl-containers 一篇，这里只引用结论。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>std::string 是你买下的一本书；string_view 是借书卡上的一行记录，写着书在第几排第几格，却不保证书还在；std::format 则是把书的内容重新抄成一页纸。记录很轻，但它不会替你保管书。</div></div>
</section>

<section class="sec">
<h2>std::string：拥有字节，SSO 决定它住在哪</h2>
<p><code>std::string</code> 拥有一段连续字节：<code>size()</code> 是元素个数（<code>char</code> 即字节数），不含结尾 NUL；<code>c_str()</code> 始终保证 NUL 结尾，<code>data()</code> 自 C++11 起也保证，两者都返回首元素地址。容量 <code>capacity()</code> 总是大于等于 size。一旦插入导致 size 超过 capacity，就会重分配：旧缓冲被释放，指向它的指针、引用与迭代器全部失效。想拿稳定指针就先 <code>reserve(n)</code> 再取——<code>reserve</code> 自己也可能触发重分配，之后只要不写入超过 n 个元素，指针就一直有效。</p>
<p><mark>短串优化</mark>（SSO, Small String Optimization）是主流实现都采用的技术，但阈值不是标准规定。libstdc++（GCC）的 std::string 在 x86-64 上典型为 32 字节：一个指针、一个 size、一个 union（长串时存 capacity，短串时存 16 字节内联缓冲），因此不超过 15 个字符的串完全不碰堆。libc++（Clang）典型为 24 字节，短串容量 22。MSVC STL 典型为 32 字节，内联缓冲 16 字节，容量 15。数字随版本、位宽与 ABI 变化，代码里不要把 15 或 32 当常量。</p>
<p>这带来三个实际后果。第一，<code>sizeof(std::string)</code> 远大于一个指针，别按 8 字节估算结构体大小。第二，移动短串时，典型实现只能把内联缓冲逐字节复制过去，因为记录数据位置的指针指向源对象内部；标准只保证移动后源对象处于有效但未指定的状态。第三，跨模块传递 std::string 需要双方用同一套标准库 ABI；GCC 的 <code>_GLIBCXX_USE_CXX11_ABI</code> 开关不一致时，轻则链接报错，重则运行期崩溃。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="std::string 的 SSO 布局：短串把字符存在对象内部的缓冲，长串的指针指向堆上的缓冲">
<defs>
<marker id="string-view-format-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-line)"/></marker>
<marker id="string-view-format-dash" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-muted)"/></marker>
</defs>
<text x="380" y="26" text-anchor="middle" font-size="15" font-family="inherit" fill="var(--sv-ink)">std::string 的两种居住方式（libstdc++ 典型布局，32 B）</text>
<rect x="16" y="44" width="352" height="238" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="192" y="70" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">A · 短串：内容就在对象里</text>
<rect x="44" y="86" width="48" height="52" rx="6" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="68" y="118" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">ptr</text>
<rect x="92" y="86" width="48" height="52" rx="6" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="116" y="118" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">size</text>
<rect x="140" y="86" width="180" height="52" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="230" y="108" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">内联缓冲 16 B（短串时）</text>
<text x="230" y="127" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">h e l l o \0 ...</text>
<text x="68" y="158" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">8 B</text>
<text x="116" y="158" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">8 B</text>
<text x="230" y="158" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">16 B</text>
<path d="M68,138 C68,186 200,186 200,142" fill="none" stroke="var(--sv-muted)" stroke-dasharray="5 4" marker-end="url(#string-view-format-dash)"/>
<text x="192" y="206" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">ptr 指向对象内部，不分配堆内存</text>
<text x="192" y="230" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">长度 ≤ 15 时 data() 落在对象里</text>
<text x="192" y="254" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">移动短串：复制内联缓冲并重定向数据指针</text>
<rect x="392" y="44" width="352" height="238" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="568" y="70" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">B · 长串：内容在堆上</text>
<rect x="420" y="86" width="48" height="52" rx="6" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="444" y="118" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">ptr</text>
<rect x="468" y="86" width="48" height="52" rx="6" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="492" y="118" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">size</text>
<rect x="516" y="86" width="96" height="52" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="564" y="108" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">capacity</text>
<text x="564" y="127" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">union 共 16 B</text>
<rect x="628" y="86" width="96" height="82" rx="8" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="676" y="108" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">堆缓冲</text>
<text x="676" y="128" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">字节 + '\0'</text>
<text x="676" y="148" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">几何增长，常见约 1.5–2 倍</text>
<line x1="444" y1="138" x2="444" y2="170" stroke="var(--sv-line)"/>
<line x1="444" y1="170" x2="624" y2="170" stroke="var(--sv-line)"/>
<line x1="624" y1="170" x2="624" y2="140" stroke="var(--sv-line)" marker-end="url(#string-view-format-arrow)"/>
<text x="568" y="206" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">移动通常只交换 ptr / size / capacity</text>
<text x="568" y="230" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">源对象变为有效但未指定状态</text>
<text x="568" y="254" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">目标对象接管堆块，旧指针不保证有效</text>
<text x="380" y="310" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">SSO 阈值：libstdc++ 15 字符 / 32 B，libc++ 22 字符 / 24 B，MSVC STL 15 字符 / 32 B</text>
<text x="380" y="334" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">以上是 x86-64 下典型实现的 ABI 事实，标准只规定语义，不规定 sizeof 与布局</text>
</svg>
<figcaption>图 1 · 以 libstdc++ 为例：短串的字符放进对象自身的 16 字节缓冲，长串才分配堆内存</figcaption>
</figure>
<pre class="code" data-lang="cpp"><code>#include &lt;cstdint&gt;
#include &lt;iostream&gt;
#include &lt;string&gt;

int main() {
    std::string small = "hello";
    std::string big(100, 'x');
    auto inside = [](const std::string&amp; s) {
        auto p = reinterpret_cast&lt;std::uintptr_t&gt;(s.data());
        auto q = reinterpret_cast&lt;std::uintptr_t&gt;(&amp;s);
        return p &gt;= q &amp;&amp; p &lt; q + sizeof s;   // 仅用于演示 SSO，非标准保证
    };
    std::cout &lt;&lt; std::boolalpha
              &lt;&lt; "small in-object: " &lt;&lt; inside(small) &lt;&lt; '\n'
              &lt;&lt; "big   in-object: " &lt;&lt; inside(big) &lt;&lt; '\n'
              &lt;&lt; "sizeof(string): " &lt;&lt; sizeof(std::string) &lt;&lt; '\n';
}</code></pre>
<div class="formula">短串：size ≤ 15 ⇒ 0 次堆分配（libstdc++）　|　长串：size &gt; 15 ⇒ 至少 1 次分配，容量按几何增长（典型 2 倍或 1.5 倍）</div>
</section>

<section class="sec">
<h2>string_view：零拷贝的代价是生命周期</h2>
<p><code>std::string_view</code>（C++17）是一个非拥有（non-owning）的视图：一个 <code>const char*</code> 加一个 <code>size_t</code>，64 位下典型 16 字节，可平凡复制；字面量可以加 <code>sv</code> 后缀（配合 <code>using namespace std::string_view_literals</code>）。它提供 <code>substr</code>（O(1)，返回子视图）、<code>remove_prefix</code>/<code>remove_suffix</code>、<code>starts_with</code>/<code>ends_with</code>（C++20）以及 <code>find</code> 等只读操作，不分配、不复制。解析一大块网络缓冲时，这正是想要的：切分字段不产生任何字符串对象。</p>
<p>关键限制有两条。第一，view <mark>不保证 NUL 结尾</mark>，也没有 <code>c_str()</code>：<code>data()</code> 能保证的只有 [data(), data()+size()) 这段可读，把 <code>data()</code> 直接交给 <code>strcmp</code>、<code>atoi</code> 这类 C 接口，等于赌 <code>data()+size()</code> 处恰好是 NUL——只有当视图覆盖整个 std::string 或整个字面量时才成立，子视图不成立。第二，view <mark>不延长被观察对象的生命周期</mark>，这是它与 shared_ptr 最根本的区别：view 的析构函数什么都不做，悬垂不会在析构时暴露，只会在下一次读取时爆炸。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="string_view 悬垂示意：视图指向的堆缓冲在 string 析构后被释放，但视图仍然保存地址与长度">
<defs>
<marker id="string-view-format-arrow2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-line)"/></marker>
<marker id="string-view-format-dash2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-muted)"/></marker>
</defs>
<text x="380" y="26" text-anchor="middle" font-size="15" font-family="inherit" fill="var(--sv-ink)">视图记录地址与长度，却不知道对象已经死了</text>
<rect x="20" y="48" width="300" height="172" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="170" y="74" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">作用域 { ... }（栈）</text>
<rect x="40" y="88" width="176" height="50" rx="8" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="128" y="109" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">std::string s</text>
<text x="128" y="128" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">拥有 20 B 堆缓冲</text>
<rect x="40" y="152" width="176" height="50" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="128" y="173" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">std::string_view sv</text>
<text x="128" y="192" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">ptr + size = 20</text>
<rect x="340" y="86" width="190" height="64" rx="8" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="435" y="110" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">堆缓冲</text>
<text x="435" y="132" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">hello dangling world \0</text>
<line x1="216" y1="113" x2="336" y2="113" stroke="var(--sv-line)" marker-end="url(#string-view-format-arrow2)"/>
<text x="276" y="105" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">拥有</text>
<path d="M216,178 C270,178 290,160 336,146" fill="none" stroke="var(--sv-muted)" stroke-dasharray="5 4" marker-end="url(#string-view-format-dash2)"/>
<text x="272" y="165" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">借用</text>
<text x="170" y="244" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">} 作用域结束：s 析构，operator delete(buffer)</text>
<rect x="340" y="202" width="190" height="72" rx="8" fill="var(--sv-bg)" stroke="var(--sv-line)" stroke-dasharray="6 4"/>
<text x="435" y="226" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">内存已归还</text>
<text x="435" y="248" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">内容不确定，可能被复用</text>
<path d="M216,202 C256,270 290,272 336,250" fill="none" stroke="var(--sv-muted)" stroke-dasharray="5 4" marker-end="url(#string-view-format-dash2)"/>
<text x="268" y="292" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">sv 仍指向这里：悬垂（dangling）</text>
<rect x="600" y="86" width="146" height="188" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="673" y="112" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">视图自己</text>
<text x="673" y="136" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">检查不出来</text>
<text x="673" y="164" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">size 仍是 20</text>
<text x="673" y="186" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">data() 仍非空</text>
<text x="673" y="214" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">读取即 UB</text>
<text x="673" y="240" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">ASan 报</text>
<text x="673" y="260" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">heap-use-after-free</text>
<text x="380" y="330" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">若 s 是短串，view 指向栈对象内部的 SSO 缓冲，报的是 stack-use-after-scope</text>
</svg>
<figcaption>图 2 · string_view 悬垂：拥有者析构后视图仍然有效可复制，读取时才是未定义行为</figcaption>
</figure>
<p>悬垂的典型来源有三个：从临时 std::string 构造视图（例如把 <code>std::string("x")</code> 直接传进接收 view 的函数）、从返回临时串的函数取值、把 view 存进成员或返回给调用方。还有一种更隐蔽：持有 view 期间对源 string 做 <code>append</code>、<code>insert</code>、<code>reserve(n)</code>（n 大于当前 capacity）、<code>shrink_to_fit</code>、重新赋值、移动或销毁——只要触发重分配或让原缓冲失效，view 立刻悬垂，而且这个失效是静默的。反过来，通过非 const 的 <code>operator[]</code> 或 <code>data()</code> 改写字符本身不会让指针失效，但视图看到的内容会跟着变，所以不要一边持有 view 一边修改源串。</p>
<div class="callout callout--warn"><span class="callout__label">警告</span><div>三条禁令：不要把 string_view 存成成员或从函数返回；不要从临时 std::string 构造视图；需要 NUL 结尾时显式构造 std::string，或改用 const std::string&amp;。视图是“调用期间的借条”，不是“轻量 string”。</div></div>
<p>那什么时候适合用？函数参数：只读、只在调用期间使用、不要求 NUL。按值传递 string_view 比 <code>const std::string&amp;</code> 更通用：字面量、<code>char*</code>、std::string、子串视图都能零拷贝传入，也不会为 <code>const char*</code> 构造临时 string。反过来，如果函数要保存、要返回、要传给 C API，参数类型就应该是 <code>std::string</code> 或 <code>const std::string&amp;</code>，把所有权留在调用方。</p>
<div class="formula">参数选型规则：只读 + 调用期内有效 + 不要求 NUL ⇒ string_view　|　需要存储/返回/NUL ⇒ std::string　|　视图寿命必须严格短于被观察对象</div>
</section>

<section class="sec">
<h2>char8_t 与 UTF-8：字节不等于字符</h2>
<p>C++20 引入 <code>char8_t</code>（提案 P0482），<code>u8"..."</code> 的类型从 <code>const char[]</code> 变成 <code>const char8_t[N]</code>，并新增 <code>std::u8string</code>。动机是让 UTF-8 字节序列在类型上区别于“执行字符集”的 char，避免把 UTF-8 文本误当成系统本地编码的窄串。这是源码层面的破坏性变更：u8 字面量的类型变了，依赖它的重载决议、模板推导与函数签名都会跟着变；跨 C++17/C++20 边界混编时要特别注意。</p>
<p>UTF-8 是变长编码：一个码点（code point）占 1 到 4 个字节，常用汉字 3 字节，emoji 通常 4 字节。<code>string_view::size()</code> 数的是字节，不是字符。<code>s[3]</code> 可能落在某个多字节序列的续字节（continuation byte）上；按字节截断会产生非法 UTF-8。要按字符处理，需要自己按首字节判断序列长度，或使用专门的 Unicode 库。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>类型 / 字面量</th><th>编码</th><th>典型宽度</th><th>说明</th></tr></thead><tbody>
<tr><td><code>char</code> / <code>"abc"</code></td><td>执行字符集（通常 UTF-8 或本地编码）</td><td>1 B</td><td>字节容器；编码取决于平台与编译选项</td></tr>
<tr><td><code>wchar_t</code> / <code>L"abc"</code></td><td>实现定义（Windows UTF-16，Linux UTF-32）</td><td>2 或 4 B</td><td>平台相关，不适合作为存储格式</td></tr>
<tr><td><code>char16_t</code> / <code>u"abc"</code></td><td>UTF-16</td><td>2 B</td><td>补充平面字符用代理对，两个单元</td></tr>
<tr><td><code>char32_t</code> / <code>U"abc"</code></td><td>UTF-32</td><td>4 B</td><td>一个码点一个单元</td></tr>
<tr><td><code>char8_t</code> / <code>u8"abc"</code></td><td>UTF-8</td><td>1 B</td><td>C++20；与 char 不隐式互转</td></tr>
</tbody></table></div>
<p>编码（encoding）与区域（locale）是两个维度：UTF-8 决定字节如何映射到码点，locale 决定小数点、千分位、日期顺序与排序规则。标准库至今没有完整的 Unicode 大小写与分词，只有 <code>&lt;cuchar&gt;</code> 的 <code>mbrtoc8</code>/<code>c8rtomb</code>（C++20）负责多字节转换。C++23 也没有把“字符数”变成 O(1) 操作，需要字符数就得扫描。</p>
</section>

<section class="sec">
<h2>std::format：类型安全，且认识 chrono</h2>
<p><code>std::format</code>（C++20，提案 P0645）用模板参数替代 printf 的可变参数。它接收的格式串类型是 <code>std::format_string&lt;Args...&gt;</code>，其构造函数是 consteval：只要格式串在编译期可知（字符串字面量就满足），参数个数、类型与说明符就在编译期检查，不匹配直接编译失败，而不是像 printf 那样在运行期读错栈。返回值是 std::string；也可以用 <code>format_to</code> 写入任意输出迭代器，避免中间串。运行期才知道的格式串必须走 <code>std::vformat</code>，检查推迟到运行期。</p>
<p>格式说明符的骨架是 <code>{[参数序号][:[[填充]对齐][符号]["#"][0][宽度][.精度]["L"][类型]]}</code>：冒号前的数字是参数序号，对齐用 <code>&lt;</code>、<code>&gt;</code>、<code>^</code>，类型用 d、x、f、e、s、p 等。chrono 类型有专门的 formatter：<code>std::format("{:%Y-%m-%d %H:%M:%S}", tp)</code> 直接按 strftime 风格的字段输出，不必先转 time_t 再调 strftime。C++20 的 chrono 还提供日历类型（year_month_day）与时区（zoned_time），格式化时按该类型的日历语义解释。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="std::format 的格式化流水线：编译期解析格式串，运行期绑定参数并写入输出迭代器">
<defs>
<marker id="string-view-format-arrow3" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-line)"/></marker>
<marker id="string-view-format-dash3" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-muted)"/></marker>
</defs>
<text x="380" y="24" text-anchor="middle" font-size="15" font-family="inherit" fill="var(--sv-ink)">一次 std::format 调用的流水线</text>
<rect x="16" y="62" width="140" height="80" rx="8" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="86" y="88" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">调用点</text>
<text x="86" y="110" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">format(fmt, args...)</text>
<rect x="176" y="62" width="150" height="80" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="251" y="88" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">格式串解析</text>
<text x="251" y="110" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">basic_format_string</text>
<rect x="346" y="62" width="150" height="80" rx="8" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="421" y="88" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">参数绑定</text>
<text x="421" y="110" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">format_arg 类型擦除</text>
<rect x="516" y="62" width="130" height="80" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="581" y="88" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">formatter&lt;T&gt;</text>
<text x="581" y="110" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">parse + format</text>
<rect x="666" y="62" width="78" height="80" rx="8" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="705" y="94" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">输出</text>
<text x="705" y="114" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">string</text>
<line x1="156" y1="102" x2="172" y2="102" stroke="var(--sv-line)" marker-end="url(#string-view-format-arrow3)"/>
<line x1="326" y1="102" x2="342" y2="102" stroke="var(--sv-line)" marker-end="url(#string-view-format-arrow3)"/>
<line x1="496" y1="102" x2="512" y2="102" stroke="var(--sv-line)" marker-end="url(#string-view-format-arrow3)"/>
<line x1="646" y1="102" x2="662" y2="102" stroke="var(--sv-line)" marker-end="url(#string-view-format-arrow3)"/>
<path d="M86,142 C86,176 180,176 230,146" fill="none" stroke="var(--sv-muted)" stroke-dasharray="5 4" marker-end="url(#string-view-format-dash3)"/>
<text x="118" y="184" font-size="11" font-family="inherit" fill="var(--sv-muted)">非字面量格式串走 vformat</text>
<rect x="16" y="200" width="360" height="76" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="32" y="224" font-size="13" font-family="inherit" fill="var(--sv-ink)">编译期（consteval）</text>
<text x="32" y="246" font-size="12" font-family="inherit" fill="var(--sv-muted)">解析字面量格式串，检查参数个数与类型</text>
<text x="32" y="264" font-size="12" font-family="inherit" fill="var(--sv-muted)">说明符不匹配直接编译失败，无运行期 UB</text>
<rect x="392" y="200" width="352" height="76" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="408" y="224" font-size="13" font-family="inherit" fill="var(--sv-ink)">运行期</text>
<text x="408" y="246" font-size="12" font-family="inherit" fill="var(--sv-muted)">绑定参数引用，由 formatter&lt;T&gt; 写入迭代器</text>
<text x="408" y="264" font-size="12" font-family="inherit" fill="var(--sv-muted)">不经过 printf 的变参栈，支持自定义类型</text>
<rect x="16" y="292" width="728" height="64" rx="8" fill="var(--sv-panel)" stroke="var(--sv-a)"/>
<text x="380" y="316" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">chrono 分支：{:%Y-%m-%d} 交给 chrono formatter，按日历字段直接输出</text>
<text x="380" y="338" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">不经过 time_t 转换，也不调用 C 的 strftime；数字字段与 locale 无关</text>
</svg>
<figcaption>图 3 · 格式化流水线：字面量格式串在编译期解析，运行期只做参数绑定与写入</figcaption>
</figure>
<pre class="code" data-lang="cpp"><code>#include &lt;chrono&gt;
#include &lt;format&gt;
#include &lt;iostream&gt;
#include &lt;string&gt;
#include &lt;string_view&gt;
#include &lt;vector&gt;

struct Item {
    std::string name;
    int qty;
    double price;
};

std::string_view trim(std::string_view s) {
    while (!s.empty() &amp;&amp; s.front() == ' ') s.remove_prefix(1);
    while (!s.empty() &amp;&amp; s.back() == ' ') s.remove_suffix(1);
    return s;                      // 视图仍指向调用方的缓冲
}

int main() {
    std::vector&lt;Item&gt; items{{"cpu", 2, 1299.5}, {"gpu", 1, 8999.0}};
    double total = 0.0;
    for (const auto&amp; it : items) {
        total += it.qty * it.price;
        std::cout &lt;&lt; std::format("{:&lt;8}{:&gt;4}{:&gt;10.2f}\n",
                                  it.name, it.qty, it.price);
    }
    std::cout &lt;&lt; std::format("total = {:.2f}\n", total);

    using namespace std::chrono;
    sys_seconds tp{seconds{1700000000}};
    std::cout &lt;&lt; std::format("{:%Y-%m-%d %H:%M:%S} UTC\n", tp);

    std::string_view raw = "  hello  ";
    std::cout &lt;&lt; '[' &lt;&lt; trim(raw) &lt;&lt; "]\n";
}</code></pre>
<p>可用性按主流工具链：GCC 13（libstdc++）与 VS 2019 16.10（MSVC 19.29）起提供 <code>&lt;format&gt;</code>；libc++ 明显更晚，基础 <code>&lt;format&gt;</code> 与 chrono 格式化的完成时间并不一致，使用前先查 cppreference 的编译器支持表。更早的工具链可以用 {fmt} 库，std::format 的接口正是从它演化而来。C++23 增加 <code>std::print</code>/<code>std::println</code>，直接写 stdout，绕开 iostream 的格式状态与同步开销。</p>
<div class="formula">格式串 = "{" [参数序号] [":" [[填充]对齐] [符号] ["#"] [0] [宽度] ["." 精度] ["L"] [类型]] "}"　|　字面量 ⇒ 编译期检查；vformat ⇒ 运行期检查，错误抛 std::format_error</div>
<p>自定义类型只需特化 <code>std::formatter&lt;T&gt;</code>，实现 <code>parse</code> 与 <code>format</code> 两个成员函数：前者接收 <code>basic_format_parse_context</code> 并返回格式说明符的结束位置，后者接收 <code>basic_format_context</code> 并写入输出迭代器。这是它比 printf 扩展性更好的地方。若格式串来自配置或用户输入，无法走编译期检查路径，应使用 <code>std::vformat</code> 并捕获 format_error。</p>
</section>

<section class="sec">
<h2>to_chars/from_chars：数字与文本的无分配互转</h2>
<p><code>&lt;charconv&gt;</code>（C++17）提供 <code>std::to_chars</code> 与 <code>std::from_chars</code>：不分配、不抛异常、不受 locale 影响，返回 <code>{ptr, ec}</code> 结构——写到哪里、错误码是什么。整数重载 C++17 起就有；浮点重载虽然也写进了 C++17 标准，但实现补齐晚得多，libstdc++ 到 GCC 11 才提供，libc++ 更晚，使用前先确认工具链。浮点默认产生能精确往返的最短表示，这正是日志与序列化想要的。注意 to_chars 不写 NUL 结尾，长度必须由返回的指针自己算。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;array&gt;
#include &lt;charconv&gt;
#include &lt;cstddef&gt;
#include &lt;string&gt;
#include &lt;system_error&gt;

std::string render(double v) {
    std::array&lt;char, 64&gt; buf{};
    auto [ptr, ec] = std::to_chars(buf.data(), buf.data() + buf.size(), v);
    if (ec != std::errc{}) return {};          // value_too_large 等
    return std::string(buf.data(), static_cast&lt;std::size_t&gt;(ptr - buf.data()));
}</code></pre>
<p>与 strtod/sscanf 相比，from_chars 不接受前导空白，也不受 locale 的小数点影响，不设置 errno；它解析 [first, last) 中能构成数字的最长前缀并返回消耗位置，匹配失败时 <code>ptr == first</code> 且 <code>ec == std::errc::invalid_argument</code>，因此适合解析协议字段。缺点是不能直接处理带千分位或本地化小数点的文本，那属于 locale 的职责，不是 charconv 的。</p>
<p>拼接性能同样值得算账。<code>s = s + x</code> 每次都构造新串并复制全部旧内容，循环 n 次是 O(n²)；<code>s += x</code> 与 <code>append</code> 在容量足够时是摊还 O(1)，扩容时按几何增长复制一次。<code>std::format</code> 每次返回一个新的 std::string，适合“少量字段、可读性优先”的场合；数字密集、要写进已有缓冲时，用 to_chars 追加更稳。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>方式</th><th>分配</th><th>典型用途</th><th>注意</th></tr></thead><tbody>
<tr><td><code>operator+</code></td><td>每次新分配</td><td>一次性拼接</td><td>循环里退化为 O(n²)</td></tr>
<tr><td><code>+=</code> / <code>append</code></td><td>扩容时分配</td><td>累积构建</td><td>先 reserve 减少扩容次数</td></tr>
<tr><td><code>std::format</code></td><td>结果串一次</td><td>结构化输出</td><td>动态格式串需 vformat</td></tr>
<tr><td><code>to_chars</code></td><td>无</td><td>数字转文本</td><td>浮点支持看标准库版本</td></tr>
</tbody></table></div>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>循环外先 reserve 一个上界估计；没有上界时相信几何增长，不要每次 reserve(size() + k)——那会把摊还 O(1) 变成每次复制。最终以测量为准，不要凭直觉替换清晰的写法。</div></div>
</section>

<section class="sec">
<h2>正则与 locale：先划清边界</h2>
<p><code>&lt;regex&gt;</code>（C++11）提供 std::regex、regex_match、regex_search、regex_replace，默认 ECMAScript 语法。它的价值在原型与低频文本处理；代价是编译正则的开销、模板实例化带来的代码体积，以及多数实现下并不出色的匹配性能。把 std::regex 放进内层循环，或在循环里反复构造 regex 对象，是常见的性能错误：正则应当只构造一次。</p>
<p>本篇不展开正则语法。只给一条工程判断：输入格式固定且简单（分隔符、前缀、数字字段）时，手写解析通常更快也更容易测试；确实需要复杂模式时，先确认性能预算，再考虑专用库。异常路径上，std::regex 的构造可能抛 <code>std::regex_error</code>，需要捕获。</p>
<p>locale 由一组 facet（numpunct、ctype、collate、time_put 等）组成，通过 std::locale 组合。iostream 可以用 <code>imbue</code> 设置 locale；<code>std::stod</code> 走 strtod 语义，受 C locale（<code>setlocale</code>）影响，遇到逗号小数点会提前截断；from_chars 与 std::format 默认不依赖 locale。需要本地化输出时要小心：标准里的 std::format 并没有接受 <code>std::locale</code> 的重载（那是 {fmt} 的 <code>fmt::format(loc, ...)</code> 扩展）；格式说明符里的 L 选项虽然表示“本地化形式”，但调用方没有任何参数可以指定用哪个 locale。严肃的本地化应在展示层显式使用 std::locale 与 facet，或直接用 {fmt}，不要押在 std::format 的默认行为上。</p>
<div class="duo"><div class="duo__col"><h4>operator&lt; 按字节比较</h4><p>std::string 的 <code>operator&lt;</code> 走 char_traits::compare，等价于无符号字节比较，与 locale 无关，结果稳定、可复现，适合作为容器键与协议字段比较。UTF-8 的字节序恰好与码点序一致，这是一个额外好处。</p></div><div class="duo__col"><h4>collate 按语言排序</h4><p>用 std::collate facet 做本地化排序，顺序取决于 locale 数据。只应在展示层使用，不要让它影响持久化键值或网络协议。</p></div></div>
</section>

<section class="sec">
<h2>工程实践、常见误区与排障</h2>
<p>参数选择可以压缩成一张决策表：只读、调用期内有效 → string_view 按值；要保存或返回 → std::string；需要 NUL 或要修改 → std::string；调用方已有 string 且只读 → const std::string&amp; 也可，但接口通用性不如 view。判断标准只有两条：生命周期覆盖调用，且不要求 NUL。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="字符串参数选型决策树：只读、生命周期是否覆盖调用、是否需要 NUL 结尾">
<defs>
<marker id="string-view-format-arrow4" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-line)"/></marker>
</defs>
<text x="380" y="24" text-anchor="middle" font-size="15" font-family="inherit" fill="var(--sv-ink)">字符串参数选型：三个问题定类型</text>
<rect x="280" y="46" width="200" height="48" rx="8" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="380" y="75" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">只读参数？</text>
<rect x="40" y="118" width="220" height="64" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="150" y="143" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">否：传 std::string</text>
<text x="150" y="163" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">或引用 / 所有权类型</text>
<line x1="280" y1="70" x2="264" y2="118" stroke="var(--sv-line)" marker-end="url(#string-view-format-arrow4)"/>
<text x="248" y="100" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">否</text>
<rect x="280" y="118" width="200" height="64" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="380" y="145" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">owner 覆盖调用期？</text>
<text x="380" y="165" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">视图不得比源活得久</text>
<line x1="380" y1="94" x2="380" y2="114" stroke="var(--sv-line)" marker-end="url(#string-view-format-arrow4)"/>
<text x="392" y="110" font-size="11" font-family="inherit" fill="var(--sv-muted)">是</text>
<rect x="520" y="118" width="220" height="64" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="630" y="143" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">否：改用 std::string</text>
<text x="630" y="163" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">或由调用方持有所有权</text>
<line x1="480" y1="150" x2="516" y2="150" stroke="var(--sv-line)" marker-end="url(#string-view-format-arrow4)"/>
<text x="498" y="142" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">否</text>
<rect x="280" y="204" width="200" height="64" rx="8" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="380" y="229" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">需要 NUL 或存储？</text>
<text x="380" y="249" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">要交给 C API / 存成员</text>
<line x1="380" y1="182" x2="380" y2="200" stroke="var(--sv-line)" marker-end="url(#string-view-format-arrow4)"/>
<text x="392" y="196" font-size="11" font-family="inherit" fill="var(--sv-muted)">是</text>
<rect x="40" y="282" width="250" height="56" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="165" y="306" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">是：const std::string&amp;</text>
<text x="165" y="326" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">或 std::string（需要拷贝时）</text>
<line x1="330" y1="236" x2="290" y2="282" stroke="var(--sv-line)" marker-end="url(#string-view-format-arrow4)"/>
<text x="284" y="268" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">是</text>
<rect x="490" y="282" width="250" height="56" rx="8" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="615" y="306" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">否：std::string_view 按值</text>
<text x="615" y="326" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">零拷贝，首选参数类型</text>
<line x1="430" y1="236" x2="490" y2="282" stroke="var(--sv-line)" marker-end="url(#string-view-format-arrow4)"/>
<text x="470" y="268" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">否</text>
<text x="380" y="366" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">两条硬条件：生命周期覆盖调用，且不要求 NUL</text>
</svg>
<figcaption>图 4 · 参数选型决策树：string_view 只是最后一格，不是默认答案</figcaption>
</figure>
<p>常见误区有四个：把 string_view 当“轻量 string”存起来；假定 <code>sv.data()</code> 有 NUL；把 <code>size()</code> 当字符数；以为 std::format 对任何格式串都做编译期检查（运行期拼出来的串只能走 vformat，错误在运行期抛）。排障时先区分堆上悬垂还是栈上悬垂：前者 AddressSanitizer 报 heap-use-after-free，后者（SSO 短串）报 stack-use-after-scope。libstdc++ 的 <code>_GLIBCXX_ASSERTIONS</code> 与 <code>_GLIBCXX_DEBUG</code> 会给下标加检查；clang-tidy 的 <code>bugprone-suspicious-stringview-data-usage</code> 能抓住一部分把 <code>data()</code> 当 C 串用的误用。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>接口设计时把生命周期写进名字或注释：接收 view 的函数明确“只在调用期间借用”。返回 view 几乎总是错误，除非返回值直接指向调用方传入的缓冲且你能证明它仍然有效。</div></div>
<h3>自测</h3>
<details class="quiz"><summary>Q1 · 为什么 const std::string&amp; 参数在传入字符串字面量时会构造临时 std::string，而 string_view 不会？</summary><div class="quiz__a">const 引用可以绑定临时对象：传字面量时编译器先构造一个临时 std::string（拷贝字节，短串可能走 SSO，长串一次堆分配），调用结束再销毁。string_view 有接受 const char* 的构造函数，它只保存指针并调用 traits::length（strlen 语义）求长度，不复制字节。所以只读参数用 view 更通用；代价是传入 const char* 时每次要做一次长度扫描，传入已有 std::string 时则没有额外开销。</div></details>
<details class="quiz"><summary>Q2 · 下面代码哪里有问题？<code>std::string_view f() { std::string s = "hello"; return s; }</code></summary><div class="quiz__a">返回的视图指向局部变量 s 的缓冲。按典型 SSO 实现，s 的字符在栈对象内部，函数返回后该栈帧失效；即使 s 是长串，堆缓冲也在 s 析构时被释放。两种情况下视图都悬垂。正确做法是返回 std::string，让所有权随返回值移出。</div></details>
<details class="quiz"><summary>Q3 · std::format("{:%Y-%m-%d}", std::chrono::system_clock::now()) 里的 %Y 是谁的语法？它和 strftime 有何不同？</summary><div class="quiz__a">chrono formatter 复用了 strftime 的字段字母（%Y、%m、%d 等），但解析与输出都由 std::formatter 完成：它直接读 chrono 的时间点或日历类型，不经过 time_t，也不调用 C 的 strftime。本例只用了数字字段，不涉及依赖 locale 的月份名、星期名；格式串是字面量，参数个数与类型不匹配会在编译期报错，但 chrono 说明符本身的校验时机依实现而异，早期工具链也可能推迟到运行期才抛 std::format_error。</div></details>
<details class="quiz"><summary>Q4 · 已知一段 UTF-8 字符串，sv.size() 返回 9。能否断言它有 9 个字符？如何安全地取前 3 个字符？</summary><div class="quiz__a">不能。size() 是字节数，UTF-8 每字符 1 到 4 字节。取前 3 个字符必须按首字节判断每个序列的长度（首字节的高位模式决定 1/2/3/4 字节），逐段前进并检查续字节是否落在 0x80–0xBF；截断只能发生在码点边界，否则产生非法 UTF-8。这段逻辑不要用按字节的 substr 代替。</div></details>
<h3>延伸阅读</h3>
<ul class="refs">
<li><b>cppreference: std::basic_string</b> — cppreference.com。size/capacity/c_str/data 的语义、迭代器失效规则与 SSO 相关说明的权威速查。</li>
<li><b>cppreference: std::basic_string_view</b> — cppreference.com。构造、substr、remove_prefix/remove_suffix 与“不拥有”语义的原文。</li>
<li><b>cppreference: std::format</b> — cppreference.com。格式说明符语法、chrono formatter、编译期检查与 vformat 的边界。</li>
<li><b>P0645R10: Text Formatting</b> — Victor Zverovich, 2019。std::format 的设计提案，解释类型擦除的参数存储与 formatter 扩展点。</li>
<li><b>C++ Core Guidelines: SL.str</b> — Bjarne Stroustrup &amp; Herb Sutter。字符串视图、所有权与参数传递的规则集合，含 span/string_view 的取舍。</li>
</ul>
</section>`
};
