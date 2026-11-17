window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["constexpr"] = {
  slug: "constexpr",
  title: "constexpr 与编译期计算",
  subtitle: "把工作从运行时搬到编译时",
  level: 3,
  cluster: "泛型与标准库",
  tags: ["constexpr", "consteval", "编译期"],
  summary: "讲清 constexpr、consteval 与 constinit 的区别、常量表达式规则和 C++20 编译期容器，并给出编译期哈希实战与成本评估。",
  keyPoints: [
    "constexpr 是“允许在编译期求值”，只有常量上下文才强制编译期；consteval 才无条件强制",
    "常量求值有严格规则：不得有未定义行为、不得读未初始化对象，C++20 的分配必须在求值结束前释放",
    "if constexpr 只丢弃模板中的未选分支，不是预处理器；编译期计算要核算编译时间与二进制体积"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
  <h2>一句话直觉：把结果提前算好，写进二进制</h2>
  <p>普通函数的计算发生在程序跑起来之后：CPU 执行指令，算出结果，再继续往下走。而 <mark>constexpr</mark> 允许同一段代码在<mark>翻译期（translation time）</mark>就被编译器执行一遍，结果直接变成常量，嵌进目标文件。运行时不再有这次计算，只剩一个已经算好的数。</p>
  <p>价值不只是“快一点”：结果在编译期已知，就可用作数组长度、模板实参、<code>static_assert</code> 的条件，也能让错误从运行时崩溃提前成编译错误。比如查找表在启动前排好序，哈希值在编译期算出用于分发。</p>
  <p>但要先纠正一个常见误解：<b>constexpr 不等于“一定在编译期执行”</b>。它是对函数或变量的一种许可，只在需要常量的地方强制执行，其他调用点仍可生成运行期代码。</p>
  <div class="callout callout--intuition"><span class="callout__label">直觉</span><div>把 constexpr 想成给编译器的一张授权书：这段代码我保证只依赖常量，你可以现在算。常量上下文是一张强制令：这里必须给我一个编译期已知的值。consteval 则是把授权书换成强制令，每次调用都必须现在算。</div></div>
</section>

<section class="sec">
  <h2>四种声明，四种承诺</h2>
  <p>C++ 里和“常量”相关的关键字经常被混着用，但它们约束的东西不同。<code>const</code> 承诺“这个对象我不会改”；<code>constexpr</code> 承诺“这个值可以在编译期求出”；<code>consteval</code>（C++20）承诺“这个函数每次调用都必须在编译期求值”；<code>constinit</code>（C++20）承诺“这个静态变量用常量初始化，不会拖到动态初始化阶段”。</p>
  <p>关键差别在“谁被约束”。<code>constexpr</code> 加在变量上，约束的是初始化表达式必须是常量表达式，并且变量隐含 <code>const</code>；加在函数上，约束的是<b>函数体允许在常量求值中执行</b>，而不是每次调用都必须编译期执行。<code>consteval</code> 是<mark>立即函数（immediate function）</mark>，语义更强：任何潜在的调用只要不能被常量求值，就是编译错误，没有运行期退路。</p>
  <p><code>constinit</code> 常被误解成 <code>constexpr</code> 的别名。它要求的是<mark>常量初始化（constant initialization）</mark>，这是静态初始化阶段的第一步：初值必须在翻译期确定，因而不会落入动态初始化。与 <code>constexpr</code> 不同，它不隐含 <code>const</code>，变量在运行期照样能改，也不像 constexpr 变量那样要求类型可常量析构。它解决的是全局对象动态初始化顺序不确定的问题——跨翻译单元读取可能读到未构造对象，<code>constinit</code> 把初始化固定在静态初始化阶段完成。</p>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>写法</th><th>约束对象</th><th>求值时机</th><th>隐含 const</th><th>运行期可改</th><th>典型用途</th></tr></thead><tbody>
    <tr><td><code>const</code></td><td>对象只读</td><td>初始化可在运行期</td><td>是（对象本身）</td><td>否</td><td>接口只读、防止误改</td></tr>
    <tr><td><code>constexpr</code> 变量</td><td>初始化必须是常量表达式</td><td>翻译期求出初值</td><td>是</td><td>否</td><td>数组边界、模板实参、常量表</td></tr>
    <tr><td><code>constexpr</code> 函数</td><td>函数体可用于常量求值</td><td>常量上下文必须编译期，其他调用可运行期</td><td>否</td><td>—</td><td>通用计算、编译期与运行期共用</td></tr>
    <tr><td><code>consteval</code></td><td>每次调用必须常量求值</td><td>总是翻译期</td><td>否</td><td>—</td><td>强制编译期 API、编译期校验</td></tr>
    <tr><td><code>constinit</code></td><td>静态/线程存储期变量</td><td>常量初始化（静态初始化阶段）</td><td>否</td><td>是（非 const 时）</td><td>消除静态初始化顺序问题</td></tr>
  </tbody></table></div>
  <figure class="fig">
    <svg viewBox="0 0 760 380" width="100%" role="img" aria-label="编译期与运行期的分界，以及各类常量在哪个阶段生效">
      <defs>
        <marker id="constexpr-arrow-phase" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--sv-a)" />
        </marker>
      </defs>
      <text x="30" y="26" font-size="14" fill="var(--sv-ink)" font-family="inherit">同一次构建：编译期决定常量，运行期执行代码</text>
      <rect x="24" y="48" width="336" height="292" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)" />
      <rect x="400" y="48" width="336" height="292" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)" />
      <text x="192" y="72" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">翻译期（编译期）</text>
      <text x="568" y="72" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">运行期</text>

      <rect x="60" y="88" width="264" height="34" rx="6" fill="var(--sv-a2)" stroke="var(--sv-a)" />
      <text x="192" y="110" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">预处理 / 语法与语义分析</text>
      <line x1="192" y1="122" x2="192" y2="142" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#constexpr-arrow-phase)" />
      <rect x="60" y="142" width="264" height="46" rx="6" fill="var(--sv-a2)" stroke="var(--sv-a)" />
      <text x="192" y="161" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">常量求值：constexpr / consteval</text>
      <text x="192" y="178" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">constexpr 变量初值、static_assert</text>
      <line x1="192" y1="188" x2="192" y2="206" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#constexpr-arrow-phase)" />
      <rect x="60" y="206" width="264" height="34" rx="6" fill="var(--sv-b2)" stroke="var(--sv-b)" />
      <text x="192" y="228" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">代码生成 / 优化 / 链接</text>
      <line x1="192" y1="240" x2="192" y2="258" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#constexpr-arrow-phase)" />
      <rect x="60" y="258" width="264" height="46" rx="6" fill="var(--sv-c)" stroke="var(--sv-line)" />
      <text x="192" y="277" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">结果写入只读数据段或立即数</text>
      <text x="192" y="294" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">二进制里不再有这次计算</text>
      <text x="192" y="330" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">这里失败 = 编译错误</text>

      <rect x="436" y="88" width="264" height="34" rx="6" fill="var(--sv-c)" stroke="var(--sv-line)" />
      <text x="568" y="110" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">静态初始化（加载前后）</text>
      <text x="568" y="134" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">constinit 保证落在这里</text>
      <line x1="568" y1="138" x2="568" y2="156" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#constexpr-arrow-phase)" />
      <rect x="436" y="156" width="264" height="34" rx="6" fill="var(--sv-b2)" stroke="var(--sv-b)" />
      <text x="568" y="178" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">动态初始化（顺序不确定）</text>
      <line x1="568" y1="190" x2="568" y2="208" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#constexpr-arrow-phase)" />
      <rect x="436" y="208" width="264" height="46" rx="6" fill="var(--sv-a2)" stroke="var(--sv-a)" />
      <text x="568" y="227" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">main 执行：普通函数调用</text>
      <text x="568" y="244" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">constexpr 函数也可在这里跑</text>
      <line x1="568" y1="254" x2="568" y2="272" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#constexpr-arrow-phase)" />
      <rect x="436" y="272" width="264" height="34" rx="6" fill="var(--sv-b2)" stroke="var(--sv-b)" />
      <text x="568" y="294" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">退出：析构与 atexit</text>
      <text x="568" y="330" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">这里出错 = 运行期问题</text>
      <line x1="378" y1="60" x2="378" y2="336" stroke="var(--sv-line)" stroke-dasharray="5 5" />
    </svg>
    <figcaption>图 1 · 常量求值发生在翻译期，普通调用发生在运行期；constinit 卡在静态初始化这一格</figcaption>
  </figure>
</section>

<section class="sec">
  <h2>常量表达式的规则：什么才算“编译期能算”</h2>
  <p>编译器不是随便什么代码都能在翻译期执行。标准用<mark>常量表达式（constant expression）</mark>划了一条线：一个表达式只有在求值过程中不触碰任何被禁止的操作，才算常量表达式。规则的核心不是“调用了哪些函数”，而是“求值路径上实际发生了什么”。</p>
  <div class="formula">常量表达式：可在翻译期求值且不触发未定义行为的表达式
允许：字面量、constexpr 变量、constexpr/consteval 函数调用、内建运算
禁止：读取未初始化对象、有符号溢出、越界访问、解引用悬空指针
禁止：reinterpret_cast、依赖运行期地址的指针运算
C++20 起：new/delete 允许，但每次分配须在求值结束前释放</div>
  <p>几个容易忽略的边界。第一，<b>未定义行为在常量求值里是硬错误</b>，不是“结果不可预测”。<code>constexpr int x = INT_MAX + 1;</code>（需包含 <code>&lt;climits&gt;</code>）直接编译失败，因为常量求值要求每一步都有定义；这也让 constexpr 成为一种免费的编译期未定义行为检查手段。第二，读取未初始化的局部变量同样被拒绝。第三，常量求值中的指针运算只能落在同一个数组对象内（可以到数组尾后一位，但不能解引用），也不能靠整数地址在两个对象之间跳。</p>
  <p>第四，C++20 的 <code>new</code> 与 <code>delete</code> 进入常量求值（P0784），但有限制：求值结束时所有分配必须已释放。因此可以在 constexpr 函数内用 <code>std::vector</code> 做临时缓冲，把结果压缩成整数或 <code>std::array</code>；但不能让 vector 的缓冲区活到常量对象里。</p>
  <div class="callout callout--warn"><span class="callout__label">注意</span><div>“能通过编译”不代表“每次求值都合法”。一个 constexpr 函数可以同时存在合法的常量路径和只能在运行期走的路径，例如读取输入参数。常量上下文走到运行期专属操作时才会报错，而且报错位置常在调用点，不在函数定义处。</div></div>
</section>

<section class="sec">
  <h2>constexpr 函数：一次定义，两种求值</h2>
  <p>理解 constexpr 函数的关键，是把它看成<b>同一份源码的两个执行后端</b>：常量上下文里由编译器的常量求值器解释执行；其他上下文里照常生成机器码。两种后端必须语义一致，否则会出现“两处结果不同”的裂缝。</p>
  <p>C++11 的函数体限制极严：基本上只能有一条 <code>return</code> 语句，局部变量、循环、分支都不允许，递归成了唯一的手段。C++14 放宽到接近普通函数：可以有局部变量、循环、多条 return，也能修改局部对象。C++17 允许 constexpr lambda 和 <code>if constexpr</code>；C++20 进一步允许 constexpr 虚函数、<code>try</code>/<code>catch</code>（常量求值中执行 throw 即失败）、以及编译期动态分配。C++23 允许 constexpr 函数内声明 static constexpr 局部变量（P2647），也允许出现非字面类型的局部变量、label 与 goto（P2242），只要常量求值不执行到它们。</p>
  <figure class="fig">
    <svg viewBox="0 0 760 380" width="100%" role="img" aria-label="constexpr 函数调用在编译期求值与运行期求值之间的分支流程">
      <defs>
        <marker id="constexpr-arrow-flow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--sv-a)" />
        </marker>
        <marker id="constexpr-arrow-flow2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--sv-b)" />
        </marker>
      </defs>
      <rect x="250" y="18" width="260" height="40" rx="8" fill="var(--sv-a2)" stroke="var(--sv-a)" />
      <text x="380" y="43" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">调用 constexpr 函数 f(x)</text>
      <line x1="380" y1="58" x2="380" y2="78" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#constexpr-arrow-flow)" />

      <polygon points="380,80 490,120 380,160 270,120" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2" />
      <text x="380" y="116" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">位于常量上下文？</text>
      <text x="380" y="134" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">static_assert / 模板实参 / 常量初值</text>

      <line x1="270" y1="120" x2="244" y2="120" stroke="var(--sv-a)" stroke-width="2" marker-end="url(#constexpr-arrow-flow)" />
      <text x="257" y="112" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">是</text>
      <polygon points="130,80 240,120 130,160 20,120" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2" />
      <text x="130" y="116" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">满足求值规则？</text>
      <text x="130" y="134" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">无 UB、无运行期依赖</text>

      <line x1="130" y1="160" x2="130" y2="198" stroke="var(--sv-a)" stroke-width="2" marker-end="url(#constexpr-arrow-flow)" />
      <text x="140" y="184" font-size="12" fill="var(--sv-ink)" font-family="inherit">是</text>
      <rect x="20" y="202" width="220" height="52" rx="8" fill="var(--sv-a2)" stroke="var(--sv-a)" />
      <text x="130" y="224" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">编译期求值</text>
      <text x="130" y="242" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">结果成为常量，写入二进制</text>

      <line x1="185" y1="140" x2="282" y2="203" stroke="var(--sv-b)" stroke-width="2" marker-end="url(#constexpr-arrow-flow2)" />
      <text x="242" y="166" font-size="12" fill="var(--sv-ink)" font-family="inherit">否</text>
      <rect x="250" y="205" width="150" height="52" rx="8" fill="var(--sv-b2)" stroke="var(--sv-b)" />
      <text x="325" y="227" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">编译错误</text>
      <text x="325" y="245" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">没有运行期退路</text>

      <line x1="490" y1="120" x2="550" y2="120" stroke="var(--sv-b)" stroke-width="2" marker-end="url(#constexpr-arrow-flow2)" />
      <text x="521" y="112" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">否</text>
      <rect x="552" y="86" width="170" height="68" rx="8" fill="var(--sv-c)" stroke="var(--sv-line)" />
      <text x="637" y="108" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">可选常量折叠</text>
      <text x="637" y="126" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">编译器自行决定</text>
      <text x="637" y="143" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">不保证发生</text>

      <line x1="637" y1="154" x2="637" y2="198" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#constexpr-arrow-flow2)" />
      <rect x="552" y="202" width="170" height="52" rx="8" fill="var(--sv-b2)" stroke="var(--sv-b)" />
      <text x="637" y="224" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">生成运行期代码</text>
      <text x="637" y="242" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">与普通函数相同</text>

      <text x="30" y="300" font-size="12" fill="var(--sv-ink)" font-family="inherit">consteval 函数没有右侧分支：每次调用都必须沿“是 → 满足规则”走完。</text>
      <text x="30" y="326" font-size="12" fill="var(--sv-muted)" font-family="inherit">constexpr 函数在运行期调用时，若参数来自输入，编译器只能生成运行期代码。</text>
      <text x="30" y="352" font-size="12" fill="var(--sv-muted)" font-family="inherit">“常量折叠”是优化，不是语言保证；不要依赖它来满足 static_assert 以外的语义。</text>
    </svg>
    <figcaption>图 2 · constexpr 调用的两条路径：常量上下文强制求值，运行期上下文只可能被优化</figcaption>
  </figure>
  <p>C++20 的 <code>std::is_constant_evaluated()</code> 与 C++23 的 <code>if consteval</code> 用来在函数内部区分当前是否常量求值：常量路径走纯计算，运行期路径可以调用非 constexpr 库。注意常量路径不会执行到运行期分支。</p>
</section>

<section class="sec">
  <h2>if constexpr：编译期的分支选择</h2>
  <p><code>if constexpr</code>（C++17）的条件必须是常量表达式，转成 bool 后参与选择。它最常见的搭档是模板：当模板参数决定某段代码是否合法时，用 <code>if constexpr</code> 可以把不适用的分支整段丢弃，避免它被实例化。</p>
  <p>“丢弃”有精确含义：在模板实体内部，未被选中的分支<b>不会被实例化</b>，因此其中依赖模板参数的非法代码不会报错。但它仍然必须能被解析，且不依赖模板参数的部分仍要满足语法与基本语义。它不是预处理器，两个分支都必须是结构完整的 C++ 代码，只是其一不参与实例化。</p>
  <p>这也解释了它在非模板函数里的表现：两个分支都会被完整检查，条件为假的分支照样要能编译，只是不会执行。想真正做条件编译，用 <code>#if</code>；想按类型选择实现，用 <code>if constexpr</code> 或重载。模板形参推导、特化与 SFINAE 属于模板基础，此处不展开，参见 templates-basics 与 templates-advanced。</p>
  <p>一个实用边界：<code>if constexpr</code> 不改变作用域与普通控制流规则——分支内声明的变量只在该分支内可见，<code>break</code>、<code>continue</code> 仍必须位于合法的循环或 <code>switch</code> 内。若把 <code>if constexpr</code> 写进 constexpr 函数，还要注意 C++23 之前 constexpr 函数体不允许出现 <code>goto</code> 与 label（P2242 才放开）。判断结果在翻译期确定，不会留下运行期分支。</p>
  <div class="callout callout--tip"><span class="callout__label">技巧</span><div>把 <code>if constexpr</code> 当成“类型级 if”而不是“运行期 if”。条件里只放类型特征与常量，例如 <code>std::is_pointer_v&lt;T&gt;</code>；一旦条件依赖运行期值，它就不再是编译期分支，编译器会直接拒绝。</div></div>
</section>

<section class="sec">
  <h2>编译期容器与 string_view</h2>
  <p>C++17 的 <code>std::string_view</code> 是非拥有视图，本身没有堆分配，构造、取长度、<code>substr</code>、<code>find</code> 等成员从 C++17 起就是 constexpr 的；<code>substr</code> 越界会抛出 <code>std::out_of_range</code>，C++20 又补上 <code>starts_with</code>/<code>ends_with</code>。它非常适合编译期解析字面量：把 <code>"GET /index.html HTTP/1.1"</code> 在编译期拆成方法、路径与版本，生成一个常量结构体。视图指向的字符数组必须有静态存储期，字面量正好满足。</p>
  <p>C++20 的 P0784 让 <code>std::vector</code> 与 <code>std::string</code> 可以在常量求值中使用，但受“暂态分配”（transient allocation）约束。下面的写法在 C++20 合法：vector 只在函数内部存活，返回前销毁，结果是一个普通整数。若把 vector 本身作为 constexpr 变量保留下来，分配就跨越了求值边界，标准不允许。</p>
  <pre class="code" data-lang="cpp"><code>#include &lt;vector&gt;

// C++20：合法。vector 是暂态的，求值结束前已释放
constexpr int sum_squares() {
    std::vector&lt;int&gt; v{1, 2, 3, 4};
    int s = 0;
    for (int x : v) s += x * x;
    return s;
}
static_assert(sum_squares() == 30);

// 示意：非法。分配结果要活到常量对象里，C++20 不允许
// constexpr std::vector&lt;int&gt; make() { return {1, 2, 3}; }
// constexpr auto v = make();</code></pre>
  <p>工程里更常见的做法是“用容器算，用 array 存”：在 constexpr 函数里用 vector 逐步构造，再把结果复制进 <code>std::array</code> 返回。它是聚合类型、无堆分配，能安全地成为 constexpr 变量。需要字符串常量时，优先返回 <code>std::array&lt;char, N&gt;</code> 或直接使用 <code>string_view</code>。</p>
</section>

<section class="sec">
  <h2>实战：编译期哈希与查表</h2>
  <p>把上面几块拼起来，就是一个常见模式：用 constexpr 函数在编译期算哈希，用 <code>static_assert</code> 固定预期值，再把哈希用于运行期的字符串分发。下面是一个完整可编译的 C++20 程序，包含 FNV-1a 哈希、consteval 函数、constinit 全局变量和 if constexpr 分支。</p>
  <pre class="code" data-lang="cpp"><code>#include &lt;array&gt;
#include &lt;cstdint&gt;
#include &lt;cstdio&gt;
#include &lt;string_view&gt;
#include &lt;type_traits&gt;

constexpr std::uint32_t fnv1a(std::string_view s) {
    std::uint32_t h = 2166136261u;
    for (unsigned char c : s) {
        h ^= c;
        h *= 16777619u;
    }
    return h;
}

constexpr auto kHash = fnv1a("hello");
static_assert(kHash == 0x4f9f2cab, "FNV-1a mismatch");
static_assert(fnv1a("hello") != fnv1a("world"));

consteval int square(int x) { return x * x; }
constexpr int kSevenSquared = square(7);

constinit int g_calls = 0;   // 常量初始化，运行期仍可修改

template &lt;class T&gt;
constexpr int width_if_pointer() {
    if constexpr (std::is_pointer_v&lt;T&gt;)
        return static_cast&lt;int&gt;(sizeof(T));
    else
        return 0;
}
static_assert(width_if_pointer&lt;int*&gt;() == static_cast&lt;int&gt;(sizeof(int*)));

constexpr std::array&lt;int, 5&gt; squares() {
    std::array&lt;int, 5&gt; a{};
    for (int i = 0; i &lt; 5; ++i) a[i] = i * i;
    return a;
}
constexpr auto kSquares = squares();

int main() {
    std::printf("%u %d\n", static_cast&lt;unsigned&gt;(kHash), kSevenSquared);
    ++g_calls;
    std::printf("%d %d %d\n", g_calls, width_if_pointer&lt;double*&gt;(), kSquares[4]);
}</code></pre>
  <p>这段代码在 x86-64 上，<code>width_if_pointer&lt;double*&gt;()</code> 返回 8；换到 32 位目标就是 4。这是 <code>sizeof</code> 的平台事实，不是标准保证，所以判断“指针占几个字节”时应当用 <code>sizeof</code> 而不是写死数字。类似地，<code>std::uint32_t</code> 的乘法按模 2³² 回绕，是定义良好的行为，FNV 正依赖这一点。</p>
  <p>编译期查表是另一个高频用法：把三角函数、CRC 表、颜色转换表在编译期填进 <code>std::array</code>，运行期只做下标访问。它的收益取决于表的大小与访问频率；如果表很大而程序只读其中几项，编译期生成反而增加编译时间和二进制体积。</p>
  <figure class="fig">
    <svg viewBox="0 0 760 380" width="100%" role="img" aria-label="constexpr 能力从 C++11 到 C++23 的演进时间轴">
      <text x="30" y="24" font-size="14" fill="var(--sv-ink)" font-family="inherit">constexpr 的演进：从一条 return 到编译期容器</text>
      <line x1="56" y1="196" x2="724" y2="196" stroke="var(--sv-line)" stroke-width="2" />
      <polygon points="724,190 740,196 724,202" fill="var(--sv-line)" />
      <circle cx="100" cy="196" r="5" fill="var(--sv-a)" />
      <circle cx="255" cy="196" r="5" fill="var(--sv-a)" />
      <circle cx="410" cy="196" r="5" fill="var(--sv-a)" />
      <circle cx="565" cy="196" r="5" fill="var(--sv-a)" />
      <circle cx="690" cy="196" r="5" fill="var(--sv-a)" />
      <text x="100" y="222" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">C++11</text>
      <text x="255" y="222" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">C++14</text>
      <text x="410" y="222" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">C++17</text>
      <text x="565" y="222" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">C++20</text>
      <text x="690" y="222" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">C++23</text>

      <rect x="34" y="72" width="150" height="86" rx="8" fill="var(--sv-a2)" stroke="var(--sv-a)" />
      <text x="109" y="94" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">变量 + 函数</text>
      <text x="109" y="114" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">函数体几乎只能</text>
      <text x="109" y="131" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">写一条 return</text>
      <text x="109" y="148" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">无循环、无局部变量</text>
      <line x1="109" y1="158" x2="105" y2="190" stroke="var(--sv-line)" stroke-dasharray="4 4" />

      <rect x="186" y="244" width="150" height="86" rx="8" fill="var(--sv-b2)" stroke="var(--sv-b)" />
      <text x="261" y="266" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">放宽函数体</text>
      <text x="261" y="286" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">局部变量、循环、</text>
      <text x="261" y="303" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">多 return、修改</text>
      <text x="261" y="320" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">局部对象</text>
      <line x1="255" y1="240" x2="255" y2="202" stroke="var(--sv-line)" stroke-dasharray="4 4" />

      <rect x="336" y="72" width="150" height="86" rx="8" fill="var(--sv-a2)" stroke="var(--sv-a)" />
      <text x="411" y="94" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">if constexpr</text>
      <text x="411" y="114" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">constexpr lambda</text>
      <text x="411" y="131" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">string_view 进入</text>
      <text x="411" y="148" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">标准库视图</text>
      <line x1="411" y1="158" x2="411" y2="190" stroke="var(--sv-line)" stroke-dasharray="4 4" />

      <rect x="478" y="244" width="168" height="106" rx="8" fill="var(--sv-b2)" stroke="var(--sv-b)" />
      <text x="562" y="266" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">consteval / constinit</text>
      <text x="562" y="286" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">constexpr new/delete</text>
      <text x="562" y="303" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">vector / string（P0784）</text>
      <text x="562" y="320" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">constexpr 虚函数</text>
      <text x="562" y="337" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">is_constant_evaluated</text>
      <line x1="565" y1="240" x2="565" y2="202" stroke="var(--sv-line)" stroke-dasharray="4 4" />

      <rect x="648" y="72" width="100" height="106" rx="8" fill="var(--sv-c)" stroke="var(--sv-line)" />
      <text x="698" y="94" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">继续扩大</text>
      <text x="698" y="114" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">if consteval</text>
      <text x="698" y="131" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">static constexpr 局部变量</text>
      <text x="698" y="148" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">unique_ptr</text>
      <text x="698" y="165" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">更多 cmath</text>
      <line x1="690" y1="178" x2="690" y2="190" stroke="var(--sv-line)" stroke-dasharray="4 4" />

      <text x="30" y="360" font-size="11" fill="var(--sv-muted)" font-family="inherit">每一版都在减少“为什么这不能编译期算”的理由，但没有取消常量求值的硬规则。</text>
    </svg>
    <figcaption>图 3 · 标准演进的主线：放宽函数体、引入分支与容器，同时保留常量求值的硬约束</figcaption>
  </figure>
</section>

<section class="sec">
  <h2>编译时间成本与取舍</h2>
  <p>编译期计算不是免费的午餐。常量求值器本质上是解释执行，同一个算法在其中跑通常明显慢于编译出的机器码，具体差距随实现与表达式复杂度变化；而且它的成本记在编译时间上，每次改一行代码都可能重新付一遍。更隐蔽的成本是二进制体积与指令缓存：大型常量表、膨胀的模板实例都可能让目标文件变大。</p>
  <p>判断值不值得，看三个问题：结果在运行期是否被频繁使用？冷路径上的预计算收益接近零。计算是否依赖运行期输入？依赖输入的部分本来就无法常量求值。编译期版本是否明显更难读？可读性代价必须有足够收益来换。</p>
  <figure class="fig">
    <svg viewBox="0 0 760 380" width="100%" role="img" aria-label="编译期预计算规模与编译时间、运行时间之间的权衡趋势">
      <defs>
        <marker id="constexpr-arrow-axis" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--sv-line)" />
        </marker>
      </defs>
      <text x="30" y="24" font-size="14" fill="var(--sv-ink)" font-family="inherit">把计算搬到编译期：成本转移，不是消失</text>
      <line x1="76" y1="320" x2="730" y2="320" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#constexpr-arrow-axis)" />
      <line x1="76" y1="320" x2="76" y2="56" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#constexpr-arrow-axis)" />
      <text x="700" y="344" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">编译期预计算规模</text>
      <text x="56" y="64" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">成本</text>

      <path d="M 90 300 C 220 286, 340 236, 440 188 C 540 140, 620 96, 710 72" fill="none" stroke="var(--sv-a)" stroke-width="3" />
      <text x="620" y="112" font-size="12" fill="var(--sv-ink)" font-family="inherit">编译时间</text>

      <path d="M 90 120 C 220 128, 340 168, 440 214 C 540 260, 620 292, 710 304" fill="none" stroke="var(--sv-b)" stroke-width="3" />
      <text x="622" y="288" font-size="12" fill="var(--sv-ink)" font-family="inherit">运行时间</text>

      <path d="M 90 168 C 240 168, 560 168, 710 168" fill="none" stroke="var(--sv-c)" stroke-width="2" stroke-dasharray="6 5" />
      <text x="620" y="160" font-size="12" fill="var(--sv-muted)" font-family="inherit">二进制体积</text>

      <line x1="440" y1="196" x2="440" y2="320" stroke="var(--sv-ink)" stroke-width="1" stroke-dasharray="4 5" />
      <circle cx="440" cy="196" r="4" fill="var(--sv-ink)" />
      <text x="448" y="192" font-size="12" fill="var(--sv-ink)" font-family="inherit">收益拐点（示意）</text>
      <text x="92" y="348" font-size="11" fill="var(--sv-muted)" font-family="inherit">曲线形状取决于编译器、优化等级与代码结构，这里只表达趋势：预计算越多，编译越慢，运行越快。</text>
      <text x="92" y="368" font-size="11" fill="var(--sv-muted)" font-family="inherit">拐点之后，继续搬运算换来的运行期收益递减，而编译时间与体积继续上升。</text>
    </svg>
    <figcaption>图 4 · 权衡不是“越编译期越好”，而是找到收益开始递减的位置</figcaption>
  </figure>
  <p>工程上常用的折中是：小规模、固定、高频使用的数据放编译期；大规模表放生成脚本或运行期一次性初始化；库代码尽量提供 constexpr 接口，但不在头文件里做重计算，把成本留给使用者决定。若确实需要，C++20 的 <code>constinit</code> 可以把初始化固定在静态初始化阶段，避免每次启动都动态构造。</p>
  <div class="callout callout--warn"><span class="callout__label">注意</span><div>标准没有规定常量求值的步数上限，各实现会自行设限且默认值不同。深度递归的 constexpr 计算可能在 GCC（<code>-fconstexpr-ops-limit</code>、<code>-fconstexpr-depth</code>）或 Clang（<code>-fconstexpr-steps</code>、<code>-fconstexpr-depth</code>）上因超过默认上限而失败，需要调整编译选项。这类上限是实现细节，不要写进可移植性假设。</div></div>

  <h3>常见误区与排障</h3>
  <p>第一类错误是以为 constexpr 函数只能在编译期调用。实际上同一函数在运行期调用完全正常，拆成两份只增加维护成本。第二类是把 <code>const</code> 当 <code>constexpr</code>：<code>const int n = std::rand();</code> 是只读变量，但不是常量表达式，不能用作数组边界。</p>
  <p>第三类是把 <code>if constexpr</code> 当预处理器：条件为假的分支仍要能解析，依赖非模板参数的错误照样报出。第四类是常量求值里踩到未定义行为，例如有符号溢出、越界读、空指针解引用；错误常指向调用点，需要沿求值栈往回找。第五类是忽略分配规则，试图把 <code>std::string</code> 或 <code>std::vector</code> 保存成 constexpr 变量。</p>
  <p>排障顺序可以固定：先确认是否位于常量上下文；再检查调用链上每个函数是否 constexpr/consteval；然后检查参数是否都是常量；最后查函数体里的 UB 或运行期依赖。诊断信息里通常有“in constant expression”的上下文链，从最内层往外读。</p>

  <h3>自测</h3>
  <details class="quiz"><summary>Q1 · constexpr 函数在运行期被调用，是否违反 constexpr 语义？</summary><div class="quiz__a">不违反。constexpr 表示“允许在常量求值中使用”，只有常量上下文才强制编译期求值。运行期调用会生成普通代码。真正强制每次调用都必须常量求值的是 consteval；若 consteval 调用无法求值，就是编译错误。</div></details>
  <details class="quiz"><summary>Q2 · 为什么 C++20 仍不允许 constexpr std::vector&lt;int&gt; v = {1, 2, 3};？</summary><div class="quiz__a">P0784 允许常量求值中的动态分配，但要求所有分配在求值结束前释放。把 vector 作为 constexpr 变量意味着堆缓冲区要活到常量对象里，违反该限制。可在 constexpr 函数内部用 vector 做临时计算，再把结果转成 array 或标量。</div></details>
  <details class="quiz"><summary>Q3 · constinit int g = f(); 中 f 不是 constexpr，会发生什么？constinit 是否让 g 变成只读？</summary><div class="quiz__a">编译错误。constinit 要求变量进行常量初始化，初值必须是常量表达式，因此 f 必须能在编译期求值。constinit 不隐含 const，g 在运行期仍可修改；它只保证初始化是常量初始化（属于静态初始化阶段），从而避开动态初始化顺序问题。</div></details>
  <details class="quiz"><summary>Q4 · 模板里 if constexpr (false) 的分支为什么还可能报语法错误？</summary><div class="quiz__a">丢弃的是实例化，不是解析。未选分支仍必须是语法完整、结构合法的代码；不依赖模板参数的错误在定义时就会检查。只有依赖模板参数、原本会导致实例化失败的部分才会被跳过。它不是预处理器，不能用来屏蔽任意文本。</div></details>
  <details class="quiz"><summary>Q5 · constexpr 计算把运行时间降到零，是否意味着总成本更低？</summary><div class="quiz__a">不一定。成本被转移到编译期，编译时间、二进制体积和常量表内存都可能上升。冷路径上的预计算几乎没有运行期收益。应按使用频率与数据规模评估，必要时用 constinit 或一次性初始化替代。</div></details>

  <h3>延伸阅读</h3>
  <ul class="refs">
    <li><b>cppreference: constexpr</b> — cppreference.com, 持续更新。constexpr、consteval、constinit 的规则、常量表达式判定与各标准版本差异的速查入口。</li>
    <li><b>P0784R7: More constexpr containers</b> — David Stone 等, 2019。把 vector、string 与动态分配引入常量求值的提案，明确“暂态分配必须释放”的边界。</li>
    <li><b>P1938R3: if consteval</b> — Barry Revzin, Richard Smith, Andrew Sutton, 2021。解释 is_constant_evaluated 的局限，并引入语言级的 if consteval。</li>
    <li><b>“constexpr ALL the Things!”</b> — Ben Deane, Jason Turner, CppCon 2017。用大量实例展示编译期解析与计算的写法与边界，适合建立工程直觉。</li>
    <li><b>《Effective Modern C++》Item 15</b> — Scott Meyers, 2014。用一节讲清 constexpr 与 const 的区别，以及 C++11 时代的函数体限制。</li>
  </ul>
</section>`
};
