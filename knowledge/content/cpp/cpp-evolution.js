window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["cpp-evolution"] = {
  slug: "cpp-evolution",
  title: "C++ 的演进与生态",
  subtitle: "从 C++11 到 C++26 的设计脉络",
  level: 6,
  cluster: "深入与演进",
  tags: ["标准演进", "WG21", "生态"],
  summary: "梳理 C++11 到 C++26 的关键特性与设计取舍，讲清零开销、兼容、渐进三原则、WG21 流程，以及 Boost、Abseil、fmt、range-v3 的生态作用。",
  keyPoints: [
    "版本号是协议批次，不是产品换代；新标准在旧代码上增量叠加，理解特性要看它替代了什么旧写法。",
    "零开销决定抽象形态，兼容性限制改造空间，渐进式决定落地节奏，三者共同解释标准为什么长成这样。",
    "提案要过研究组、演进组、措辞组、全会与 ISO 投票；进入工作草案不等于发布，更不等于编译器可用。",
    "生态是标准的试验场：Boost、Abseil、fmt、range-v3 提供设计验证，Core Guidelines 提供工程规范。"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>一句话直觉：标准是协议，不是产品</h2>
<p>把 C++ 的版本号当成软件版本，是理解演进时最常见的偏差。C++11、C++17、C++20 不是三次产品换代，而是 ISO 标准的三次修订：它们定义同一门语言在某一时刻的语法、语义和标准库接口，交给不同厂商去实现。你升级编译器，不是换了一门语言，而是换了一份更完整的协议实现。</p>
<p>这份协议有一条很强的约束：<mark>向后兼容（backward compatibility）</mark>。为 C++11 写的代码，绝大多数应当能作为 C++20 编译，语义也保持不变。于是 C++ 的演进更像在飞行中换发动机：新特性不断加入，旧特性极少移除，委员会必须为每一次修改证明它不会破坏既有代码。这也解释了为什么更好的设计进不了标准，以及同一段代码在不同编译器上表现不同。</p>
<p>标准规定“可观察行为”，并在少数地方约束布局性质（例如 standard-layout 类型的成员顺序），但具体的大小、对齐、虚函数表结构与名称修饰留给实现与 ABI（Application Binary Interface，应用二进制接口）。理解这条边界，才能分清哪些差异是标准保证的，哪些只是某个实现的习惯。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>标准像电源插座规格，编译器与标准库像电器。插座规定了电压与形状，但不同厂商的电器内部怎么布线，规格不管。你写的是“插头能插上”的代码，不是“内部电路完全一致”的代码。</div></div>
</section>

<section class="sec">
<h2>时间线：每个版本解决了什么</h2>
<p>C++98 是第一个 ISO 标准，C++03 是一次修订，主要修补缺陷。真正的节奏从 C++11 开始：委员会把三年一轮作为目标。C++11 是一次大修，补上了移动语义、lambda、并发内存模型和智能指针；C++14 是小修，放宽 <code>constexpr</code>、加入泛型 lambda 与 <code>std::make_unique</code>；C++17 把大量 Boost 经验收进标准库；C++20 是第二次大修，concepts、ranges、modules、coroutines 四件事同时落地。</p>
<p>C++23 于 2023 年完成、2024 年出版，延续“库多语言少”的风格：<code>std::expected</code>、<code>std::print</code>、<code>std::mdspan</code>、<code>std::flat_map</code>、deducing this。C++26 是最新一轮修订，正式发布状态以 ISO 目录为准；公开讨论集中在静态反射、契约、<code>std::execution</code>、线性代数和 <code>std::simd</code> 等方向，其中多数提案已进入工作草案；但进入草案不等于定稿，只当方向，不当保证。</p>
<p>看时间线时要区分三件事：<b>设计被批准</b>、<b>进入工作草案</b>、<b>编译器可用</b>。三者之间可能相差数年。一个特性在会议上高票通过，离你项目里能打开开关，往往还隔着措辞定稿、库实现、ABI 决策和发布周期。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="C++ 标准版本时间线：C++11 到 C++26 的代表特性">
<defs><marker id="cpp-evolution-tl-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-muted)"></path></marker></defs>
<text x="40" y="24" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">C++98/03 之后：三年一轮的修订节奏</text>
<line x1="40" y1="200" x2="720" y2="200" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#cpp-evolution-tl-arrow)"></line>
<rect x="45" y="55" width="110" height="115" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
<text x="55" y="78" font-size="14" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">C++11</text>
<text x="55" y="101" font-size="12" font-family="inherit" fill="var(--sv-ink)">auto / lambda</text>
<text x="55" y="121" font-size="12" font-family="inherit" fill="var(--sv-ink)">移动语义</text>
<text x="55" y="141" font-size="12" font-family="inherit" fill="var(--sv-ink)">variadic</text>
<text x="55" y="161" font-size="12" font-family="inherit" fill="var(--sv-ink)">std::thread</text>
<line x1="100" y1="170" x2="100" y2="196" stroke="var(--sv-line)" stroke-width="1.5"></line>
<circle cx="100" cy="200" r="5" fill="var(--sv-a)"></circle>
<rect x="165" y="230" width="110" height="105" rx="6" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
<text x="175" y="253" font-size="14" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">C++14</text>
<text x="175" y="276" font-size="12" font-family="inherit" fill="var(--sv-ink)">泛型 lambda</text>
<text x="175" y="296" font-size="12" font-family="inherit" fill="var(--sv-ink)">返回类型推导</text>
<text x="175" y="316" font-size="12" font-family="inherit" fill="var(--sv-ink)">make_unique</text>
<line x1="220" y1="204" x2="220" y2="226" stroke="var(--sv-line)" stroke-width="1.5"></line>
<circle cx="220" cy="200" r="5" fill="var(--sv-b)"></circle>
<rect x="285" y="45" width="110" height="125" rx="6" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
<text x="295" y="68" font-size="14" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">C++17</text>
<text x="295" y="91" font-size="12" font-family="inherit" fill="var(--sv-ink)">结构化绑定</text>
<text x="295" y="111" font-size="12" font-family="inherit" fill="var(--sv-ink)">optional/variant</text>
<text x="295" y="131" font-size="12" font-family="inherit" fill="var(--sv-ink)">filesystem</text>
<text x="295" y="151" font-size="12" font-family="inherit" fill="var(--sv-ink)">if constexpr</text>
<line x1="340" y1="170" x2="340" y2="196" stroke="var(--sv-line)" stroke-width="1.5"></line>
<circle cx="340" cy="200" r="5" fill="var(--sv-b)"></circle>
<rect x="405" y="230" width="110" height="120" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
<text x="415" y="253" font-size="14" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">C++20</text>
<text x="415" y="276" font-size="12" font-family="inherit" fill="var(--sv-ink)">concepts</text>
<text x="415" y="296" font-size="12" font-family="inherit" fill="var(--sv-ink)">ranges</text>
<text x="415" y="316" font-size="12" font-family="inherit" fill="var(--sv-ink)">modules</text>
<text x="415" y="336" font-size="12" font-family="inherit" fill="var(--sv-ink)">coroutines</text>
<line x1="460" y1="204" x2="460" y2="226" stroke="var(--sv-line)" stroke-width="1.5"></line>
<circle cx="460" cy="200" r="5" fill="var(--sv-a)"></circle>
<rect x="525" y="45" width="110" height="125" rx="6" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
<text x="535" y="68" font-size="14" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">C++23</text>
<text x="535" y="91" font-size="12" font-family="inherit" fill="var(--sv-ink)">expected</text>
<text x="535" y="111" font-size="12" font-family="inherit" fill="var(--sv-ink)">std::print</text>
<text x="535" y="131" font-size="12" font-family="inherit" fill="var(--sv-ink)">mdspan</text>
<text x="535" y="151" font-size="12" font-family="inherit" fill="var(--sv-ink)">deducing this</text>
<line x1="580" y1="170" x2="580" y2="196" stroke="var(--sv-line)" stroke-width="1.5"></line>
<circle cx="580" cy="200" r="5" fill="var(--sv-b)"></circle>
<rect x="645" y="230" width="110" height="120" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="6 4"></rect>
<text x="655" y="253" font-size="14" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">C++26</text>
<text x="655" y="276" font-size="12" font-family="inherit" fill="var(--sv-ink)">反射 P2996</text>
<text x="655" y="296" font-size="12" font-family="inherit" fill="var(--sv-ink)">契约 P2900</text>
<text x="655" y="316" font-size="12" font-family="inherit" fill="var(--sv-ink)">std::execution</text>
<text x="655" y="336" font-size="12" font-family="inherit" fill="var(--sv-muted)">发布待定</text>
<line x1="700" y1="204" x2="700" y2="226" stroke="var(--sv-line)" stroke-width="1.5" stroke-dasharray="4 3"></line>
<circle cx="700" cy="200" r="5" fill="var(--sv-panel)" stroke="var(--sv-line)"></circle>
<text x="40" y="370" font-size="12" font-family="inherit" fill="var(--sv-muted)">越靠右越新；虚线表示尚未正式发布，特性可能变化</text>
</svg>
<figcaption>图 1 · 标准版本时间线：大修与库增量交替出现</figcaption>
</figure>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>标准</th><th>ISO 发布</th><th>语言侧代表特性</th><th>库侧代表特性</th><th>对日常代码的影响</th></tr></thead><tbody>
<tr><td>C++11</td><td>2011</td><td>auto、lambda、移动语义、右值引用</td><td>智能指针、thread、unordered 容器</td><td>资源所有权与并发写法被重写</td></tr>
<tr><td>C++14</td><td>2014</td><td>泛型 lambda、返回类型推导</td><td>make_unique、chrono 字面量</td><td>模板代码更短，constexpr 更实用</td></tr>
<tr><td>C++17</td><td>2017</td><td>结构化绑定、if constexpr、折叠表达式</td><td>optional、variant、string_view、filesystem</td><td>错误处理与字符串视图成为常规选项</td></tr>
<tr><td>C++20</td><td>2020</td><td>concepts、modules、coroutines、三路比较</td><td>ranges、span、format、jthread</td><td>模板约束、异步与格式化进入标准</td></tr>
<tr><td>C++23</td><td>2024（出版）</td><td>deducing this、if consteval、多维下标</td><td>expected、print、mdspan、flat_map</td><td>错误传播与打印更接近现代语言</td></tr>
<tr><td>C++26</td><td>ISO 流程中</td><td>反射、契约（已入草案）</td><td>std::execution、线性代数、simd</td><td>方向明确，但发布与实现状态需逐项核实</td></tr>
</tbody></table></div>
</section>

<section class="sec">
<h2>三条设计原则：零开销、兼容、渐进</h2>
<p><mark>零开销（zero-overhead）</mark>是 C++ 最核心的承诺。Bjarne Stroustrup 的表述是两句话：你不用的东西，你不为它付费；你用的东西，你不可能手写得更好。它约束的是抽象的实现方式，而不是“程序一定更快”。虚函数在主流实现上通过虚函数表（vtable）调用，成本与手写函数指针表同量级，但 vtable 本身是 ABI 约定而非标准强制；<code>std::vector</code> 的边界检查只在 <code>at()</code> 里发生，<code>operator[]</code> 不检查。</p>
<div class="formula">零开销原则：未使用特性 f ⇒ 运行期成本(f) = 0；使用特性 f ⇒ 成本(f) ≤ 等价手写代码的成本
兼容性原则：除非修复严重缺陷，否则不改变既有代码的语义；新特性默认不改变旧代码行为</div>
<p>第二条是<b>兼容性（compatibility）</b>。WG21 的共识规则不是多数票，而是“没有持续的强烈反对”。这条规则让激进重构很难通过，也让标准避免分裂成方言（dialect）。被移除的特性屈指可数：<code>std::auto_ptr</code>、<code>std::random_shuffle</code>、动态异常规格在 C++17 被移除，更多时候只是标记 deprecated。</p>
<p>第三条是<b>渐进式（progressive enhancement）</b>。新特性尽量能单独采用：你可以在 C++20 项目里只用 concepts 而不用 modules，也可以只用 <code>std::span</code> 而不碰 ranges。库优先（library-first）是常见策略：能用一个库类型解决的问题，不轻易改语言。<code>std::optional</code>、<code>std::variant</code>、<code>std::string_view</code> 都是先由 Boost 或实践验证，再进入标准。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>标准不规定 ABI，也很少规定具体的对象布局。Linux 上 GCC 的 libstdc++ 与 Clang 常用的 libc++ 都遵循 Itanium C++ ABI，Windows 上 MSVC 使用自己的 ABI；<code>std::string</code> 的大小与布局在不同实现中不同。跨编译器、跨标准库版本传递标准库对象时，必须把 ABI 兼容性当成独立问题验证，不能假设标准保证了二进制兼容。ABI 的细节在《ABI、动态库与二进制兼容》一篇展开。</div></div>
</section>

<section class="sec">
<h2>一个提案如何成为标准：WG21 流程</h2>
<p>WG21 是 ISO/IEC JTC1/SC22 下的 C++ 工作组，成员来自各国成员体、厂商、学术界与个人贡献者。日常工作以<b>提案论文（proposal paper）</b>为单位，编号形如 P2996R5：P 编号标识提案，R 后缀是修订号。论文先投到邮件列表（mailing），再在会议上讨论。</p>
<p>流程大致分四段。第一段在研究组（Study Group，SG）里判断方向与可行性，例如 SG7 讨论编译期编程，SG21 讨论契约；第二段在语言演进组 EWG（Evolution Working Group）或库演进组 LEWG（Library Evolution Working Group）拿到设计批准；第三段由核心措辞组 CWG（Core Working Group）或库措辞组 LWG（Library Working Group）把设计写成精确的标准文字，状态变为 tentatively ready；第四段是全会投票，通过后进入工作草案（working draft）。</p>
<p>工作草案还不是标准。它通常要经过委员会草案（Committee Draft，CD）投票、国际标准草案（DIS）投票与最终草案（FDIS）表决，最后才成为 ISO 国际标准；近年 ISO 规则允许在 DIS 通过后不再单独表决 FDIS，但每一步都可能退回修改，已进入草案的特性也可能在后续会议上被移除。所以“C++26 会有反射”必须加上“如果最终保留”。</p>
<p>会议通常每年举行数次，提案要在会前截止日期前提交。共识（consensus）不是简单投票：主席会判断是否存在原则性反对，反对者需要提出可操作的替代方案。这个机制偏向保守，也保证了标准的稳定性。跟踪特性时，读提案 Status 与会议纪要，不要只信二手博客。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="WG21 提案流程：研究组、语言与库两条演进线、措辞审查、全会投票与 ISO 发布阶段">
<defs>
<marker id="cpp-evolution-wg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-muted)"></path></marker>
<marker id="cpp-evolution-wg-back" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-muted)"></path></marker>
</defs>
<text x="30" y="22" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">从提案论文到 ISO 标准：两条并行流水线</text>
<rect x="30" y="115" width="120" height="60" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
<text x="42" y="140" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">提案论文</text>
<text x="42" y="160" font-size="12" font-family="inherit" fill="var(--sv-muted)">PxxxxR · mailing</text>
<rect x="180" y="115" width="110" height="60" rx="6" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
<text x="192" y="140" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">研究组 SG</text>
<text x="192" y="160" font-size="12" font-family="inherit" fill="var(--sv-muted)">方向与可行性</text>
<rect x="330" y="45" width="120" height="60" rx="6" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
<text x="342" y="70" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">EWG 语言演进</text>
<text x="342" y="90" font-size="12" font-family="inherit" fill="var(--sv-ink)">设计批准</text>
<rect x="330" y="185" width="120" height="60" rx="6" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
<text x="342" y="210" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">LEWG 库演进</text>
<text x="342" y="230" font-size="12" font-family="inherit" fill="var(--sv-ink)">设计批准</text>
<rect x="490" y="45" width="110" height="60" rx="6" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
<text x="502" y="70" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">CWG 核心措辞</text>
<text x="502" y="90" font-size="12" font-family="inherit" fill="var(--sv-ink)">精确文字</text>
<rect x="490" y="185" width="110" height="60" rx="6" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
<text x="502" y="210" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">LWG 库措辞</text>
<text x="502" y="230" font-size="12" font-family="inherit" fill="var(--sv-ink)">精确文字</text>
<rect x="640" y="115" width="100" height="60" rx="6" fill="var(--sv-c)" stroke="var(--sv-line)"></rect>
<text x="651" y="140" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">全会投票</text>
<text x="651" y="160" font-size="12" font-family="inherit" fill="var(--sv-ink)">进入工作草案</text>
<path d="M150,145 L180,145" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#cpp-evolution-wg-arrow)"></path>
<path d="M290,145 L310,145 L310,75 L330,75" fill="none" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#cpp-evolution-wg-arrow)"></path>
<path d="M290,145 L310,145 L310,215 L330,215" fill="none" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#cpp-evolution-wg-arrow)"></path>
<path d="M450,75 L490,75" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#cpp-evolution-wg-arrow)"></path>
<path d="M450,215 L490,215" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#cpp-evolution-wg-arrow)"></path>
<path d="M600,75 L620,75 L620,145 L640,145" fill="none" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#cpp-evolution-wg-arrow)"></path>
<path d="M600,215 L620,215 L620,145 L640,145" fill="none" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#cpp-evolution-wg-arrow)"></path>
<path d="M690,175 L690,265 L185,265 L185,285" fill="none" stroke="var(--sv-line)" stroke-width="1.5" stroke-dasharray="6 4" marker-end="url(#cpp-evolution-wg-arrow)"></path>
<text x="30" y="310" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">ISO 阶段</text>
<rect x="120" y="285" width="130" height="42" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
<text x="132" y="311" font-size="13" font-family="inherit" fill="var(--sv-ink)">CD 委员会草案</text>
<rect x="280" y="285" width="90" height="42" rx="6" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
<text x="298" y="311" font-size="13" font-family="inherit" fill="var(--sv-ink)">DIS</text>
<rect x="400" y="285" width="90" height="42" rx="6" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
<text x="415" y="311" font-size="13" font-family="inherit" fill="var(--sv-ink)">FDIS</text>
<rect x="520" y="285" width="150" height="42" rx="6" fill="var(--sv-c)" stroke="var(--sv-line)"></rect>
<text x="532" y="311" font-size="13" font-family="inherit" fill="var(--sv-ink)">IS 正式标准</text>
<path d="M250,306 L280,306" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#cpp-evolution-wg-arrow)"></path>
<path d="M370,306 L400,306" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#cpp-evolution-wg-arrow)"></path>
<path d="M490,306 L520,306" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#cpp-evolution-wg-arrow)"></path>
<text x="120" y="352" font-size="12" font-family="inherit" fill="var(--sv-muted)">CD、DIS、FDIS 任一步都可能退回；只有 IS 才是正式发布</text>
<path d="M390,45 L390,34 L90,34 L90,115" fill="none" stroke="var(--sv-line)" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#cpp-evolution-wg-back)"></path>
<text x="430" y="30" font-size="12" font-family="inherit" fill="var(--sv-muted)">未达成共识：退回修改</text>
</svg>
<figcaption>图 2 · WG21 提案流程：语言与库分线审查，最后汇入全会与 ISO 投票</figcaption>
</figure>
<div class="callout callout--tip"><span class="callout__label">技巧</span><div>读提案的正确顺序：先看 Abstract 与 Motivation，判断它解决什么问题；再看 Proposed wording，判断边界与代价；最后看 Status 与会议纪要，确认它究竟走到了哪一步。标题里出现“for C++26”不代表已经定稿。</div></div>
</section>

<section class="sec">
<h2>生态：标准之前的试验场</h2>
<p>标准库不是 C++ 的全部。大量设计先在第三方库中经受真实项目检验，再被 WG21 吸收。<b>Boost</b> 是最典型的孵化器：shared_ptr、thread、regex 进入 C++11，filesystem、optional、variant、any 进入 C++17。Boost 的同行评审（peer review）强调可移植性与文档，也会把过于庞大或依赖过多的提案挡在门外。</p>
<p><b>Abseil</b> 是 Google 的 C++ 基础库集合，提供 flat_hash_map、Span、string_view、Status 等设施，设计目标是长期稳定与性能可预测。它不追求替代标准库，而是补齐标准库在哈希表、状态码、日志等方向的空白。<b>fmt</b> 由 Victor Zverovich 主导，是 <code>std::format</code>（C++20）与 <code>std::print</code>（C++23）的设计来源；它展示了编译期格式串检查与高性能可以兼得。<b>range-v3</b> 是 Eric Niebler 的 ranges 原型，C++20 的 <code>std::ranges</code> 只采纳了其中一部分。</p>
<p>生态还包括构建、包管理与测试：CMake 是事实标准，vcpkg 与 Conan 解决依赖，GoogleTest、Catch2 提供测试框架，clang-tidy 与 Sanitizer 负责静态与动态检查。标准不规定构建系统，这是 modules 落地慢的原因之一，机制另篇展开。</p>
<p><b>C++ Core Guidelines</b> 由 Bjarne Stroustrup 与 Herb Sutter 维护，把社区经验写成可执行的规则：用 RAII 管理资源、避免裸 new/delete、优先 const 与值语义、用 <code>gsl::span</code> 与 <code>not_null</code> 表达契约。它配套 GSL（Guidelines Support Library）与静态检查映射。准则不是标准，但很多条款反过来影响了标准设计。风格上，委员会长期倾向“显式优于隐式”，enum class、explicit、nullptr 都是产物。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="生态到标准的路径：Boost、Abseil、fmt、range-v3 如何影响 C++ 标准库">
<defs><marker id="cpp-evolution-eco-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-muted)"></path></marker></defs>
<text x="30" y="30" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">孵化器</text>
<text x="540" y="30" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">进入标准</text>
<rect x="30" y="55" width="150" height="55" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
<text x="42" y="78" font-size="14" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">Boost</text>
<text x="42" y="98" font-size="12" font-family="inherit" fill="var(--sv-muted)">同行评审 · 可移植性</text>
<rect x="30" y="130" width="150" height="55" rx="6" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
<text x="42" y="153" font-size="14" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">Abseil</text>
<text x="42" y="173" font-size="12" font-family="inherit" fill="var(--sv-muted)">Google 基础库</text>
<rect x="30" y="205" width="150" height="55" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
<text x="42" y="228" font-size="14" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">fmt</text>
<text x="42" y="248" font-size="12" font-family="inherit" fill="var(--sv-muted)">编译期格式检查</text>
<rect x="30" y="280" width="150" height="55" rx="6" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
<text x="42" y="303" font-size="14" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">range-v3</text>
<text x="42" y="323" font-size="12" font-family="inherit" fill="var(--sv-muted)">惰性视图原型</text>
<rect x="540" y="55" width="190" height="55" rx="6" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
<text x="552" y="78" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">C++11</text>
<text x="552" y="98" font-size="12" font-family="inherit" fill="var(--sv-ink)">shared_ptr / thread / regex</text>
<rect x="540" y="130" width="190" height="55" rx="6" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
<text x="552" y="148" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">C++17</text>
<text x="552" y="166" font-size="12" font-family="inherit" fill="var(--sv-ink)">filesystem / optional</text>
<text x="552" y="182" font-size="12" font-family="inherit" fill="var(--sv-ink)">variant / any</text>
<rect x="540" y="205" width="190" height="55" rx="6" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
<text x="552" y="228" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">C++20 · std::format</text>
<text x="552" y="248" font-size="12" font-family="inherit" fill="var(--sv-ink)">C++23 · std::print</text>
<rect x="540" y="280" width="190" height="55" rx="6" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
<text x="552" y="303" font-size="13" font-weight="bold" font-family="inherit" fill="var(--sv-ink)">C++20 · std::ranges</text>
<text x="552" y="323" font-size="12" font-family="inherit" fill="var(--sv-ink)">views / filter / transform</text>
<path d="M180,82 L540,82" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#cpp-evolution-eco-arrow)"></path>
<path d="M180,82 C320,82 400,157 540,157" fill="none" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#cpp-evolution-eco-arrow)"></path>
<path d="M180,232 L540,232" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#cpp-evolution-eco-arrow)"></path>
<path d="M180,307 L540,307" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#cpp-evolution-eco-arrow)"></path>
<path d="M180,157 C300,157 400,350 480,350" fill="none" stroke="var(--sv-line)" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#cpp-evolution-eco-arrow)"></path>
<rect x="480" y="332" width="250" height="38" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="492" y="356" font-size="12" font-family="inherit" fill="var(--sv-muted)">哈希表 / Status：影响设计，未整体采纳</text>
<text x="230" y="180" font-size="12" font-family="inherit" fill="var(--sv-muted)">提案 + 参考实现</text>
<text x="230" y="200" font-size="12" font-family="inherit" fill="var(--sv-muted)">+ 真实项目验证</text>
<text x="30" y="370" font-size="12" font-family="inherit" fill="var(--sv-muted)">标准采纳的是设计，不是代码；各标准库仍需独立实现</text>
</svg>
<figcaption>图 3 · 生态到标准：第三方库提供设计验证，标准库重新实现</figcaption>
</figure>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>库</th><th>定位</th><th>与标准的关系</th><th>选用建议</th></tr></thead><tbody>
<tr><td>Boost</td><td>大型可移植库集合</td><td>多个标准特性的来源</td><td>需要成熟组件时选用，核算依赖与编译成本</td></tr>
<tr><td>Abseil</td><td>Google 基础库</td><td>影响设计，非整体采纳</td><td>大型服务需要 flat_hash_map、Status 时考虑</td></tr>
<tr><td>fmt</td><td>格式化库</td><td>std::format 与 std::print 的设计来源</td><td>需要 C++17 兼容或更完整格式能力时使用</td></tr>
<tr><td>range-v3</td><td>ranges 原型库</td><td>C++20 std::ranges 的前身</td><td>新项目优先标准 ranges，迁移期保留</td></tr>
<tr><td>GSL</td><td>Core Guidelines 支持库</td><td>不是标准库的一部分</td><td>用 span、not_null 表达边界与契约</td></tr>
</tbody></table></div>
</section>

<section class="sec">
<h2>正在路上的方向：反射、契约与模式匹配</h2>
<p><b>静态反射（static reflection）</b>是 C++26 最受关注的方向。P2996 引入反射运算符与 <code>std::meta</code> 命名空间，让程序在编译期查询类型、成员、枚举项，并生成代码。它解决长期靠宏、模板特化或外部代码生成器处理的问题：序列化、枚举转字符串、测试注册。反射是编译期能力，设计目标是不引入运行期开销。</p>
<p><b>契约（contracts）</b>由 P2900 推进，用 <code>pre</code>、<code>post</code> 与 <code>contract_assert</code> 表达前置条件、后置条件与断言。它把“函数入口应满足什么、返回时应保证什么”写成可检查的声明，检查级别由实现与构建配置决定。契约不是异常：违约通常意味着程序缺陷，具体处理方式仍以最终标准为准。<b>模式匹配（pattern matching）</b>的提案讨论多年，目标是把 variant 与结构体的分支写得更接近数学定义，但语法与范围尚未定论，不应假定它一定进入 C++26。</p>
<p><b>std::execution</b>（P2300）提供 sender/receiver 模型，把异步任务的描述与执行分离，支持线程池、GPU、事件循环等不同调度器。它与 coroutines 互补：coroutine 解决“写起来像同步”，sender/receiver 解决“组合与调度”。此外，线性代数（P1673）与 <code>std::simd</code>（P1928）也在 C++26 的方向之中，面向数值与高性能计算。</p>
<p>把这些方向放进技术雷达时，环的位置取决于你的工具链，而不是标准状态。同一个特性在大厂可以是“试用”，在你的项目可能只能“观察”。雷达的价值是写下采用条件：谁维护、如何回退。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="C++ 技术雷达：按采用、试用、评估、观察四环放置语言、库与工具">
<circle cx="380" cy="190" r="152" fill="var(--sv-panel)" stroke="var(--sv-line)"></circle>
<circle cx="380" cy="190" r="112" fill="none" stroke="var(--sv-line)"></circle>
<circle cx="380" cy="190" r="72" fill="none" stroke="var(--sv-line)"></circle>
<circle cx="380" cy="190" r="35" fill="var(--sv-a2)" stroke="var(--sv-line)"></circle>
<line x1="228" y1="190" x2="532" y2="190" stroke="var(--sv-line)" stroke-dasharray="4 4"></line>
<line x1="380" y1="38" x2="380" y2="342" stroke="var(--sv-line)" stroke-dasharray="4 4"></line>
<text x="388" y="150" font-size="12" font-family="inherit" fill="var(--sv-muted)">采用</text>
<text x="388" y="112" font-size="12" font-family="inherit" fill="var(--sv-muted)">试用</text>
<text x="388" y="72" font-size="12" font-family="inherit" fill="var(--sv-muted)">评估</text>
<text x="388" y="32" font-size="12" font-family="inherit" fill="var(--sv-muted)">观察</text>
<circle cx="402" cy="178" r="4" fill="var(--sv-a)"></circle>
<text x="412" y="182" font-size="12" font-family="inherit" fill="var(--sv-ink)">concepts / ranges</text>
<circle cx="356" cy="206" r="4" fill="var(--sv-a)"></circle>
<text x="300" y="226" font-size="12" font-family="inherit" fill="var(--sv-ink)">std::format</text>
<circle cx="458" cy="128" r="4" fill="var(--sv-b)"></circle>
<text x="468" y="132" font-size="12" font-family="inherit" fill="var(--sv-ink)">modules</text>
<circle cx="306" cy="128" r="4" fill="var(--sv-b)"></circle>
<text x="248" y="118" font-size="12" font-family="inherit" fill="var(--sv-ink)">coroutines</text>
<circle cx="462" cy="248" r="4" fill="var(--sv-b)"></circle>
<text x="472" y="252" font-size="12" font-family="inherit" fill="var(--sv-ink)">Abseil</text>
<circle cx="460" cy="75" r="4" fill="var(--sv-c)"></circle>
<text x="470" y="79" font-size="12" font-family="inherit" fill="var(--sv-ink)">reflection</text>
<circle cx="300" cy="75" r="4" fill="var(--sv-c)"></circle>
<text x="238" y="79" font-size="12" font-family="inherit" fill="var(--sv-ink)">contracts</text>
<circle cx="480" cy="274" r="4" fill="var(--sv-c)"></circle>
<text x="490" y="278" font-size="12" font-family="inherit" fill="var(--sv-ink)">std::execution</text>
<circle cx="507" cy="249" r="4" fill="var(--sv-muted)"></circle>
<text x="517" y="253" font-size="12" font-family="inherit" fill="var(--sv-muted)">直接依赖 range-v3</text>
<circle cx="265" cy="270" r="4" fill="var(--sv-muted)"></circle>
<text x="170" y="274" font-size="12" font-family="inherit" fill="var(--sv-muted)">Boost 全量依赖</text>
<text x="30" y="370" font-size="12" font-family="inherit" fill="var(--sv-muted)">内圈成熟度更高；环的位置是团队策略，不是标准状态</text>
</svg>
<figcaption>图 4 · 技术雷达：把“标准状态”与“团队采用策略”分开看</figcaption>
</figure>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>C++26 的正式发布状态以 ISO 目录与 WG21 公告为准。任何“C++26 已支持”的说法都应落到具体编译器版本与开关；提案进入工作草案不等于最终保留，更不等于你的工具链可用。以 cppreference 的 compiler support 表与编译器 release notes 为准。</div></div>
</section>

<section class="sec">
<h2>工程实践：怎样选标准、怎样迁移</h2>
<p>选标准版本的第一约束不是“新不新”，而是工具链与依赖。先确认三件事：目标平台的最低编译器版本、依赖库支持的最高标准、以及你是否需要跨 ABI 交付二进制。编译器支持可以用特性测试宏判断，例如 <code>__cpp_concepts</code>、<code>__cpp_lib_format</code>、<code>__cpp_lib_ranges</code>，比只看 <code>-std</code> 选项可靠。</p>
<p>迁移应当分层：先升级编译选项并修警告，再逐步替换旧惯用法，最后才引入新范式。把 C++11 的裸循环换成 ranges 不是迁移的第一步；先让代码在 C++20 下编译通过、行为一致，才有资格谈重构。CI 里保留至少一个旧标准构建，可以及时发现兼容性回归。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;concepts&gt;
#include &lt;cstddef&gt;
#include &lt;iostream&gt;
#include &lt;optional&gt;
#include &lt;ranges&gt;
#include &lt;span&gt;
#include &lt;utility&gt;
#include &lt;vector&gt;

template &lt;std::floating_point T&gt;
void scale(std::span&lt;T&gt; xs, T factor) {
    for (T&amp; x : xs) {
        x *= factor;
    }
}

template &lt;std::ranges::input_range R&gt;
auto evens(R&amp;&amp; r) {
    return std::views::all(std::forward&lt;R&gt;(r))
         | std::views::filter([](int v) { return v % 2 == 0; });
}

std::optional&lt;int&gt; parse_positive(int v) {
    if (v &lt;= 0) {
        return std::nullopt;
    }
    return v;
}

int main() {
    std::vector&lt;double&gt; xs{1.0, 2.0, 3.0};
    scale&lt;double&gt;(xs, 2.5);

    std::vector&lt;int&gt; ys{1, 2, 3, 4, 5, 6};
    for (int v : evens(ys)) {
        std::cout &lt;&lt; v &lt;&lt; ' ';
    }

    if (auto p = parse_positive(42)) {
        std::cout &lt;&lt; *p &lt;&lt; '\n';
    }
}</code></pre>
<p>这段代码只用了 C++20 已发布的能力：concepts 约束模板参数、span 表达连续区间、ranges 组合惰性视图、optional 表达可能失败。它对应的旧写法分别是 SFINAE（Substitution Failure Is Not An Error）、指针加长度、手写循环和输出参数。注意 <code>std::forward</code> 需要包含 <code>&lt;utility&gt;</code>，<code>std::views::all</code> 与 <code>std::views::filter</code> 来自 <code>&lt;ranges&gt;</code>，<code>std::span</code> 来自 <code>&lt;span&gt;</code>；<code>std::span</code> 不拥有数据，调用者必须保证生命周期覆盖调用。</p>
<p>工程上还有两条边界。第一，ABI 边界不要随意暴露标准库类型：跨 DLL 传递 <code>std::string</code> 或 <code>std::vector</code> 会把标准库版本、调试/发布配置、分配器差异绑在一起。第二，新特性要核算编译时间与二进制体积：模板与 <code>constexpr</code> 会把成本从运行期搬到编译期，modules 能缓解头文件膨胀，但需要构建系统配合。</p>
<div class="callout callout--tip"><span class="callout__label">技巧</span><div>用特性测试宏而不是版本号做条件编译：<code>#if defined(__cpp_lib_expected)</code> 比 <code>#if __cplusplus &gt;= 202302L</code> 更准确地反映当前标准库是否真的提供该组件。宏由标准库实现定义，能同时覆盖编译器与库版本不一致的情况。</div></div>
</section>

<section class="sec">
<h2>常见误区与排障</h2>
<p>第一个误区是把“最新标准”当成“默认标准”。很多项目仍以 C++17 为基线，因为编译器、操作系统 SDK 或第三方库受限；这不等于落后，而是工程约束。第二个误区是把新特性当成性能开关：ranges 的惰性视图可能比手写循环多一层抽象，优化器通常能消除，但不是保证；<code>constexpr</code> 把工作搬到编译期，运行期变快，编译期变慢。</p>
<p>第三个误区是相信标准规定了 ABI。标准规定可观察行为与语义，具体的大小、对齐、vtable 布局、名称修饰由实现与 ABI 约定；标准只对少数布局性质有要求。第四个误区是把提案状态当成产品状态：提案被采纳只说明方向确定，编译器实现、库实现、文档与工具链支持都要时间。</p>
<ul>
<li>先确认标准版本与编译器实际使用的 <code>-std</code> 选项，再看特性测试宏。</li>
<li>再确认标准库实现版本（libstdc++、libc++、MSVC STL），它们与编译器版本不总同步。</li>
<li>最后确认构建系统是否把正确的宏与包含路径传给了每个翻译单元（translation unit）。</li>
</ul>
<p>学习资源上，isocpp.org 发布新闻与方向文章，cppreference 提供条目与编译器支持表，WG21 的提案邮件列表公开可查。</p>
<details class="quiz"><summary>Q1 · 同一份 C++20 源码，在 GCC、Clang、MSVC 上编译出的对象大小一定相同吗？</summary><div class="quiz__a">不一定。标准主要规定可观察行为，具体的大小、对齐、vtable 结构与名称修饰由实现和平台 ABI 约定，标准只对少数布局性质（如 standard-layout 的成员顺序）有要求。即使同一编译器，不同标准库实现、不同编译选项也可能改变布局。需要二进制兼容时，应在目标平台上实测并固定 ABI 契约，而不是从标准文本推断。</div></details>
<details class="quiz"><summary>Q2 · 提案已经进入 C++26 工作草案，是否意味着 C++26 正式标准一定有它？</summary><div class="quiz__a">不意味着。工作草案之后还要经过 CD、DIS 等 ISO 投票阶段（近年可能不再单独表决 FDIS），任何阶段都可能修改或移除特性；即使最终保留，编译器与标准库也可能滞后数年。正确说法是“已进入工作草案，最终保留与可用性待定”。</div></details>
<details class="quiz"><summary>Q3 · 零开销原则是否保证使用 std::vector 一定比手写动态数组快？</summary><div class="quiz__a">不保证。零开销约束的是抽象不应引入额外运行期成本：vector 的迭代、operator[] 在优化后通常与手写指针循环等价，但 at() 的边界检查、分配器行为、异常路径都会影响结果。它是设计目标，不是性能承诺；性能要用目标平台上的基准测试验证。</div></details>
<details class="quiz"><summary>Q4 · 为什么 C++20 modules 被视为重大特性，却比 concepts 落地慢得多？</summary><div class="quiz__a">modules 改的是编译模型，不只是语法：需要编译器实现模块接口单元、依赖扫描、BMI（Binary Module Interface）缓存，还需要构建系统、包管理器与 IDE 配合。标准不规定构建系统，导致工具链各自实现。concepts 只影响模板语义，编译器实现后即可使用，迁移成本低得多。</div></details>
<details class="quiz"><summary>Q5 · 在 C++20 项目中，是否应该立刻把所有裸循环改成 ranges？</summary><div class="quiz__a">不应该。迁移应先保证编译与行为一致，再按收益重构。ranges 适合表达过滤、变换、拼接等组合，但调试信息、编译时间与团队熟悉度都是成本。对性能敏感的热点路径，先用基准测试比较，再决定是否替换。</div></details>
<ul class="refs">
<li><b>ISO/IEC 14882:2024</b> — ISO/IEC, 2024。C++23 的正式标准文本，是判断“标准到底怎么规定”的最终依据。</li>
<li><b>cppreference · C++ compiler support</b> — cppreference.com。逐特性列出 GCC、Clang、MSVC 与标准库的支持状态，适合查可用性。</li>
<li><b>WG21 Committee Papers</b> — ISO/IEC JTC1/SC22/WG21, open-std.org。提案原文、修订与状态，是追踪特性走向的第一手材料。</li>
<li><b>《A Tour of C++》第 3 版</b> — Bjarne Stroustrup, Addison-Wesley, 2022。以 C++20 为口径的全局导览，适合建立语言全貌。</li>
<li><b>CppCon 主题演讲</b> — CppCon 官方 YouTube 频道。设计者与实现者讲解特性动机、取舍与落地经验。</li>
</ul>
</section>`
};
