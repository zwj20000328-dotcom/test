window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["functions-odr"] = {
  slug: "functions-odr",
  title: "函数、重载与 ODR",
  subtitle: "链接期才暴露的错误，往往最难查",
  level: 1,
  cluster: "语言核心",
  tags: ["重载", "ODR", "链接属性"],
  summary: "从声明与定义讲起，拆开重载决议、默认参数、inline 的真实语义和单一定义规则，并落到链接属性、函数指针、lambda 与头文件设计，让你能定位链接期错误。",
  keyPoints: [
    "函数声明只引入名字与类型，定义才提供函数体；变量还涉及存储与链接属性",
    "重载决议按候选集、可行集、转换序列排序三步走，返回类型不参与重载",
    "inline 的真实含义是允许多个编译单元出现相同定义，而不是强制内联",
    "ODR 违规常常不报错，链接器只能抓住一部分强符号冲突",
    "头文件只放声明，inline、constexpr、类与模板定义是例外"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>先建立直觉：编译通过只是上半场</h2>
<p>你改了一个函数的参数类型，重新编译，编译器没有报错；链接时却报出 <code>undefined reference to add(int, int)</code>。另一种情况更隐蔽：链接顺利通过，程序在同事的机器上结果正确，在你的机器上却偶发错误。这两类问题分别落在<mark>链接</mark>和<mark>单一定义规则</mark>上：单个编译单元看不出，只有多个目标文件拼在一起时才暴露。</p>
<p>函数是 C++ 程序最小的可组合单位，但它同时被三套规则约束。语法层区分<mark>声明</mark>（declaration）与<mark>定义</mark>（definition）；语义层用<mark>重载决议</mark>（overload resolution）决定一次调用到底绑定哪个函数；链接层用<mark>链接属性</mark>（linkage）和<mark>单一定义规则</mark>（One Definition Rule, ODR）决定同名实体能否在多个编译单元中共存。三套规则在不同阶段生效，错误也就在编译期、链接期、运行期分别出现。</p>
<p>这篇的目标很具体：看到一次调用，你能走完重载决议；写头文件时，你知道哪些东西能放进去、哪些放进去迟早出事；遇到 <code>multiple definition</code> 或 <code>undefined reference</code>，你能把它归因到某条规则。模板实例化带来的 ODR 问题留到 templates-basics，这里只提边界。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>编译单元像各自独立装修的房间，链接器负责把墙打通。声明是图纸，定义是实际砌好的墙；图纸可以到处贴，墙只能砌一份，否则打通时就会撞在一起。</div></div>
</section>

<section class="sec">
<h2>声明、定义与编译单元</h2>
<p><mark>编译单元</mark>（translation unit, TU）是预处理之后的单个源文件：一个 <code>.cpp</code> 加上它递归包含的所有头文件，去掉注释、展开宏之后得到的完整文本。编译器一次只看到一个 TU，因此它无法知道另一个 <code>.cpp</code> 里发生了什么。链接器随后把所有 TU 产出的目标文件（Linux/macOS 上的 <code>.o</code>，MSVC 上的 <code>.obj</code>）合并成可执行文件或库。</p>
<p>声明告诉编译器“这个名字存在，类型是什么”；定义除此之外还提供实体本身：函数给出函数体，变量分配存储。函数声明写作 <code>int add(int, int);</code>，定义则写成 <code>int add(int a, int b) { return a + b; }</code>。变量的区别更微妙：<code>extern int g;</code> 是声明，<code>int g;</code> 是定义；<code>extern int g = 0;</code> 虽然带 <code>extern</code>，仍然是定义。类定义、枚举定义、模板定义属于另一类实体，它们可以在多个 TU 出现，但必须完全一致，这一点在 ODR 一节展开。</p>
<p>由此得到一条贯穿全篇的原则：<b>一个定义，多处声明</b>。头文件里放函数声明、类定义、<code>inline</code> 函数、<code>constexpr</code> 函数和模板；普通函数体、普通全局变量的定义放且只放一个 <code>.cpp</code>。如果把 <code>int global = 0;</code> 直接写进头文件，被两个源文件包含后，两个 TU 各自产出一个强符号，链接器会报重复定义。C++17 起可以用 <code>inline</code> 变量在头文件中安全地定义全局变量，后文会讲到它的条件。</p>
</section>

<section class="sec">
<h2>重载与重载决议：编译器如何挑函数</h2>
<p><mark>重载</mark>（overloading）指同一作用域内出现多个同名函数，参数列表不同。返回类型不参与重载：只有返回类型不同的两个函数无法共存，因为调用表达式无法仅凭返回类型区分它们。编译器要让重载函数在目标文件里共存并被链接器正确区分，依赖<mark>名字修饰</mark>（name mangling），把参数类型等信息编码进符号名；这套编码由 ABI 决定，Itanium ABI 与 MSVC 的方案不同，标准并不规定具体形式；因此采用不同 ABI 的编译器（典型是 MSVC 与 GCC/Clang）产出的目标文件通常不能直接混链。</p>
<p>一次调用的决议分为三步。第一步建立<mark>候选函数集</mark>（candidate set）：按普通名字查找规则收集可见的同名函数（一旦在某个外层作用域找到声明，就不再向更外层找），再加上实参类型所关联的命名空间与类中的<mark>实参依赖查找</mark>（argument-dependent lookup, ADL）。第二步筛出<mark>可行函数</mark>（viable function）：参数个数匹配（考虑默认参数和可变参数），且每个实参都能隐式转换到对应形参类型。第三步对可行函数的<mark>隐式转换序列</mark>（implicit conversion sequence）排序，选出唯一最优者；若有两个函数各自在某个参数上更优、又在另一个参数上更差，调用就是二义的，编译失败。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="重载决议流程：候选函数集经过参数匹配得到可行函数，再按转换序列排序，最终绑定唯一最佳函数，否则报编译错误">
<defs>
<marker id="functions-odr-arrow" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto"><path d="M0,0 L0,8 L8,4 Z" fill="var(--sv-line)"/></marker>
</defs>
<rect x="250" y="18" width="260" height="46" rx="8" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="380" y="47" text-anchor="middle" font-size="15" fill="var(--sv-ink)" font-family="inherit">调用表达式 f(a, b)</text>
<line x1="380" y1="64" x2="380" y2="92" stroke="var(--sv-line)" marker-end="url(#functions-odr-arrow)"/>
<rect x="210" y="94" width="340" height="52" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="380" y="116" text-anchor="middle" font-size="14" fill="var(--sv-ink)" font-family="inherit">候选函数集 candidate set</text>
<text x="380" y="135" text-anchor="middle" font-size="12" fill="var(--sv-muted)" font-family="inherit">名字查找 + ADL，收集所有同名可见函数</text>
<line x1="380" y1="146" x2="380" y2="172" stroke="var(--sv-line)" marker-end="url(#functions-odr-arrow)"/>
<rect x="210" y="174" width="340" height="52" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="380" y="196" text-anchor="middle" font-size="14" fill="var(--sv-ink)" font-family="inherit">可行函数 viable function</text>
<text x="380" y="215" text-anchor="middle" font-size="12" fill="var(--sv-muted)" font-family="inherit">参数个数匹配（含默认参数）+ 可隐式转换</text>
<line x1="380" y1="226" x2="380" y2="252" stroke="var(--sv-line)" marker-end="url(#functions-odr-arrow)"/>
<rect x="210" y="254" width="340" height="56" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="380" y="276" text-anchor="middle" font-size="14" fill="var(--sv-ink)" font-family="inherit">按转换序列排序</text>
<text x="380" y="296" text-anchor="middle" font-size="12" fill="var(--sv-muted)" font-family="inherit">精确匹配 ＞ 提升 ＞ 一般转换 ＞ 用户定义 ＞ 省略号</text>
<line x1="380" y1="310" x2="380" y2="330" stroke="var(--sv-line)" marker-end="url(#functions-odr-arrow)"/>
<rect x="250" y="332" width="260" height="38" rx="8" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="380" y="356" text-anchor="middle" font-size="14" fill="var(--sv-ink)" font-family="inherit">唯一最佳 → 绑定该函数</text>
<line x1="550" y1="200" x2="618" y2="200" stroke="var(--sv-line)" marker-end="url(#functions-odr-arrow)"/>
<rect x="620" y="168" width="128" height="64" rx="8" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="684" y="193" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">可行集为空</text>
<text x="684" y="212" text-anchor="middle" font-size="12" fill="var(--sv-ink)" font-family="inherit">编译错误</text>
<line x1="210" y1="282" x2="150" y2="282" stroke="var(--sv-line)" marker-end="url(#functions-odr-arrow)"/>
<rect x="20" y="250" width="128" height="64" rx="8" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="84" y="275" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">多个同级最优</text>
<text x="84" y="294" text-anchor="middle" font-size="12" fill="var(--sv-ink)" font-family="inherit">二义性错误</text>
</svg>
<figcaption>图 1 · 重载决议的三段式流程：先收集候选，再筛可行，最后按转换序列排序</figcaption>
</figure>
<p>排序规则可以压缩成一条链：<mark>精确匹配</mark>（exact match，含 identity 与限定转换）优于<mark>提升</mark>（promotion，如 <code>char</code> 到 <code>int</code>），优于<mark>一般转换</mark>（conversion，如 <code>int</code> 到 <code>double</code>），优于<mark>用户定义转换</mark>（user-defined conversion，经由构造函数或转换运算符），最后才是省略号 <code>...</code>。C++20 起，概念（concept）约束不满足的候选在形成可行集时就被排除；若剩下的候选在转换序列上仍然无法分出优劣，则约束更强的一个作为最后的平局裁决胜出。</p>
<p>实践中最容易踩的坑：<code>0</code> 与 <code>nullptr</code> 对指针参数的重载可能选中不同函数；重载函数取地址必须给出目标类型；默认参数只影响可行函数的参数个数匹配，不参与转换序列排序，也不能用来区分两个重载。</p>
</section>

<section class="sec">
<h2>默认参数与 inline 的真实含义</h2>
<p><mark>默认参数</mark>（default argument）在声明处给出，调用点由编译器补齐。它有几个容易记错的边界：同一作用域内不能对同一参数重复指定默认值；默认值不是函数类型的一部分，所以通过函数指针调用时不会自动补参；虚函数的默认参数按<mark>静态类型</mark>取，派生类改了默认值，通过基类指针调用仍用基类的值。默认参数通常写在头文件声明里，定义处不要重复。</p>
<p><mark>inline</mark> 的真实含义不是“建议编译器内联”，而是“允许这个函数在多个编译单元中各有一份定义”。标准要求：任何 <code>odr-use</code> 了它的 TU 都必须能看到定义，且所有 TU 中的定义逐 token 相同。因此 inline 函数要放在头文件里。编译器是否真正内联完全由它自己决定：<code>inline</code> 提供的是链接层面的许可，并不构成“必须内联”的保证。C++17 增加了 <mark>inline 变量</mark>，让头文件里的全局常量也能安全定义。</p>
<p><mark>constexpr</mark> 函数是另一条线：C++11 起，函数可以被标记为 <code>constexpr</code>，在实参为常量表达式时于编译期求值，否则退化为运行期调用。C++14 放宽了函数体限制，C++20 引入 <code>consteval</code> 表示必须编译期求值。constexpr 函数隐含 inline，因此可以直接定义在头文件。完整规则（常量表达式、字面类型、求值边界）留到后续 constexpr 篇章；这里只需记住：它解决“编译期计算”，不是“链接期共享”。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>把 inline 当成性能开关是常见误解。一个没有被内联的 inline 函数照样产生函数调用；反过来，编译器也可以内联没有写 inline 的函数。真正需要 inline 的场景是“定义要放进头文件且会被多个 TU 使用”。</div></div>
</section>

<section class="sec">
<h2>ODR：单一定义规则</h2>
<p><mark>单一定义规则</mark>（One Definition Rule, ODR）分三层。第一层是 TU 内部：任何变量、函数、类类型、枚举或概念，在同一个 TU 内至多只能有一个定义。第二层是整个程序：每个被 <code>odr-use</code> 的非 inline 函数或变量，在程序中必须恰好有一个定义；多了是重复定义，少了是未定义引用。第三层是允许重复的实体：类定义、枚举、模板、inline 函数与 inline 变量可以在多个 TU 出现，但所有出现必须逐 token 相同，且名字查找结果一致。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="ODR 违规示意：两个编译单元分别定义同名强符号 counter，链接器报重复定义；inline 函数定义不一致时链接器只保留一份，导致未定义行为">
<defs>
<marker id="functions-odr-arrow2" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto"><path d="M0,0 L0,8 L8,4 Z" fill="var(--sv-line)"/></marker>
</defs>
<text x="150" y="24" text-anchor="middle" font-size="14" fill="var(--sv-ink)" font-family="inherit">a.cpp 编译单元</text>
<rect x="30" y="36" width="240" height="92" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="44" y="62" font-size="13" fill="var(--sv-ink)" font-family="inherit">int counter = 0;</text>
<text x="44" y="86" font-size="13" fill="var(--sv-ink)" font-family="inherit">inline int f() { return 1; }</text>
<text x="44" y="110" font-size="12" fill="var(--sv-muted)" font-family="inherit">counter 强符号，f 弱符号/COMDAT</text>
<text x="610" y="24" text-anchor="middle" font-size="14" fill="var(--sv-ink)" font-family="inherit">b.cpp 编译单元</text>
<rect x="490" y="36" width="240" height="92" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="504" y="62" font-size="13" fill="var(--sv-ink)" font-family="inherit">int counter = 0;</text>
<text x="504" y="86" font-size="13" fill="var(--sv-ink)" font-family="inherit">inline int f() { return 2; }</text>
<text x="504" y="110" font-size="12" fill="var(--sv-muted)" font-family="inherit">同名符号，定义内容不同</text>
<line x1="150" y1="128" x2="150" y2="176" stroke="var(--sv-line)" marker-end="url(#functions-odr-arrow2)"/>
<line x1="610" y1="128" x2="610" y2="176" stroke="var(--sv-line)" marker-end="url(#functions-odr-arrow2)"/>
<rect x="70" y="178" width="160" height="46" rx="6" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="150" y="206" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">a.o</text>
<rect x="530" y="178" width="160" height="46" rx="6" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="610" y="206" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">b.o</text>
<line x1="150" y1="224" x2="330" y2="272" stroke="var(--sv-line)" marker-end="url(#functions-odr-arrow2)"/>
<line x1="610" y1="224" x2="430" y2="272" stroke="var(--sv-line)" marker-end="url(#functions-odr-arrow2)"/>
<rect x="230" y="274" width="300" height="66" rx="8" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="380" y="298" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">链接器：合并同名符号</text>
<text x="380" y="318" text-anchor="middle" font-size="12" fill="var(--sv-ink)" font-family="inherit">强符号重复 → multiple definition</text>
<text x="380" y="334" text-anchor="middle" font-size="12" fill="var(--sv-ink)" font-family="inherit">弱符号/COMDAT 任选一份 → 定义不同即 ODR 违规</text>
<text x="380" y="370" text-anchor="middle" font-size="12" fill="var(--sv-muted)" font-family="inherit">编译器通常不报错；跨 TU 的 ODR 违规属于“无需诊断的违规”（IFNDR）</text>
</svg>
<figcaption>图 2 · 同一个名字在两个编译单元中的两种命运：强符号冲突会被链接器抓住，inline 的定义不一致则可能静默通过</figcaption>
</figure>
<p>ODR 违规最麻烦的地方在于诊断缺失。标准把跨 TU 的违规归为“无需诊断的违规”（ill-formed, no diagnostic required, IFNDR）：编译器没有义务发现，链接器也只能抓住它看得懂的部分。普通全局变量通常是<mark>强符号</mark>（strong symbol），重复会被常见链接器报错；而 inline 函数、模板实例化、虚函数表通常以<mark>弱符号</mark>或 COMDAT 段的形式存在，链接器保留一份、丢弃其余，程序能链接能运行，行为却取决于保留了哪一份。</p>
<div class="formula">每个 TU：每个实体至多一个定义。整个程序：每个 odr-use 的非 inline 函数或变量恰好一个定义。inline 实体：每个使用它的 TU 各一份，且逐 token 相同。</div>
<p>常见触发方式：两个 TU 包含不同版本的头文件；编译选项不一致（例如一个开 <code>-DNDEBUG</code>）；在头文件定义非 inline 函数或全局变量；用宏改变结构体成员；把带状态的匿名命名空间对象写进头文件。排查时先怀疑“不同 TU 看到的声明不一致”，再去看符号。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>链接成功不代表 ODR 正确。重复定义与缺失定义会被链接器发现，定义不一致往往不会。混用编译选项、标准库版本或头文件搜索路径，都是在制造静默的 ODR 违规。</div></div>
</section>

<section class="sec">
<h2>链接属性：谁能在别的 TU 看见我</h2>
<p><mark>链接属性</mark>（linkage）描述一个名字能否在其他 TU 中引用。外部链接（external linkage）的名字在整个程序中可见，由链接器解析；内部链接（internal linkage）的名字只在当前 TU 可见；局部变量没有链接，只有作用域。函数默认是外部链接；命名空间作用域的 <code>static</code> 变量与函数、<mark>匿名命名空间</mark>（anonymous namespace）中的名字是内部链接；命名空间作用域的 <code>const</code> 与 <code>constexpr</code> 变量默认也是内部链接，除非显式写 <code>extern</code> 或用 C++17 的 <code>inline</code>。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="编译单元与链接关系：头文件被两个源文件包含，各自编译出目标文件，符号表区分未定义引用、已定义外部符号与本地符号，链接器负责解析">
<defs>
<marker id="functions-odr-arrow3" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto"><path d="M0,0 L0,8 L8,4 Z" fill="var(--sv-line)"/></marker>
</defs>
<rect x="255" y="12" width="250" height="54" rx="8" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="380" y="34" text-anchor="middle" font-size="14" fill="var(--sv-ink)" font-family="inherit">widget.h</text>
<text x="380" y="52" text-anchor="middle" font-size="12" fill="var(--sv-muted)" font-family="inherit">声明 + inline/constexpr 定义 + 类定义</text>
<path d="M300 66 L160 102" stroke="var(--sv-line)" fill="none" marker-end="url(#functions-odr-arrow3)"/>
<path d="M460 66 L600 102" stroke="var(--sv-line)" fill="none" marker-end="url(#functions-odr-arrow3)"/>
<rect x="40" y="104" width="250" height="98" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="56" y="128" font-size="14" fill="var(--sv-ink)" font-family="inherit">a.cpp → a.o</text>
<text x="56" y="152" font-size="12" fill="var(--sv-ink)" font-family="inherit">U  widget_init   （待解析）</text>
<text x="56" y="172" font-size="12" fill="var(--sv-ink)" font-family="inherit">T  widget_draw   （外部定义）</text>
<text x="56" y="192" font-size="12" fill="var(--sv-ink)" font-family="inherit">t  helper        （内部链接）</text>
<rect x="470" y="104" width="250" height="98" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="486" y="128" font-size="14" fill="var(--sv-ink)" font-family="inherit">b.cpp → b.o</text>
<text x="486" y="152" font-size="12" fill="var(--sv-ink)" font-family="inherit">U  widget_draw   （待解析）</text>
<text x="486" y="172" font-size="12" fill="var(--sv-ink)" font-family="inherit">T  widget_init   （外部定义）</text>
<text x="486" y="192" font-size="12" fill="var(--sv-ink)" font-family="inherit">t  helper        （另一份副本）</text>
<line x1="165" y1="202" x2="315" y2="256" stroke="var(--sv-line)" marker-end="url(#functions-odr-arrow3)"/>
<line x1="595" y1="202" x2="445" y2="256" stroke="var(--sv-line)" marker-end="url(#functions-odr-arrow3)"/>
<rect x="245" y="258" width="270" height="58" rx="8" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="380" y="282" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">链接器：解析 U，合并 T</text>
<text x="380" y="302" text-anchor="middle" font-size="12" fill="var(--sv-muted)" font-family="inherit">检查重复强符号，保留各自内部符号</text>
<line x1="380" y1="316" x2="380" y2="336" stroke="var(--sv-line)" marker-end="url(#functions-odr-arrow3)"/>
<rect x="280" y="338" width="200" height="34" rx="8" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="380" y="360" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">可执行文件</text>
<text x="40" y="368" font-size="11" fill="var(--sv-muted)" font-family="inherit">U 未定义　T 已定义外部　t 本地</text>
</svg>
<figcaption>图 3 · 一个头文件、两个编译单元、一次链接：符号表里的 U/T/t 决定了链接器要做的事</figcaption>
</figure>
<p>用 <code>static</code> 修饰命名空间作用域的函数，是 C 时代传下来的“文件私有”写法；匿名命名空间是 C++ 的等价物，还能容纳不能加 <code>static</code> 的类型与模板。两者都让每个包含该头文件的 TU 获得独立副本。工具函数通常没问题，但若副本持有可变状态（计数器、缓存、注册表），每个 TU 看到的就是各自的世界。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>写法</th><th>链接属性</th><th>跨 TU 可见</th><th>典型用途与风险</th></tr></thead><tbody><tr><td>普通函数定义（非 inline）</td><td>外部</td><td>是</td><td>放 .cpp；放头文件会重复定义</td></tr><tr><td>inline 函数 / inline 变量（C++17）</td><td>外部（弱符号 / COMDAT，视平台）</td><td>是</td><td>放头文件；要求各 TU 定义一致</td></tr><tr><td>命名空间作用域 static</td><td>内部</td><td>否</td><td>文件私有；头文件里会每 TU 一份</td></tr><tr><td>匿名命名空间</td><td>内部</td><td>否</td><td>文件私有，可放类型；头文件里同样每 TU 一份</td></tr><tr><td>命名空间作用域 const / constexpr 变量</td><td>内部（默认）</td><td>否</td><td>常量；需要共享时写 extern 或 inline</td></tr><tr><td>extern const 变量</td><td>外部</td><td>是</td><td>跨 TU 共享常量，定义放一个 .cpp</td></tr><tr><td>extern "C" 函数</td><td>外部，C 语言链接</td><td>是</td><td>C 接口；不做名字修饰，不能重载</td></tr></tbody></table></div>
<p><code>extern "C"</code> 指定 C 语言链接并关掉名字修饰，让符号名与 C 编译器一致，因此同一名字下不能再按 C++ 规则重载。它改变的是名字的链接语言与符号名，外部/内部链接不受影响；调用约定也不由它决定。32 位 Windows 上，调用约定（<code>__cdecl</code>、<code>__stdcall</code>）是函数类型的一部分；x64 通常只有一种默认约定，这属于平台 ABI 细节。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>头文件里需要“每 TU 独立”的辅助函数时，用匿名命名空间或 static，但不要放可变状态。需要全程序共享的状态，定义在一个 .cpp 里，头文件只留 extern 声明。</div></div>
</section>

<section class="sec">
<h2>函数指针、回调与 lambda</h2>
<p><mark>函数指针</mark>（function pointer）的声明语法、空值与成员指针表示见 pointers-const，这里只看回调场景。它让函数像值一样被传递，是 C 风格回调、排序比较器、事件表的基础。取一个重载函数的地址时，编译器需要目标类型来挑选重载；直接写 <code>auto p = &amp;f;</code> 会因候选过多而失败。函数指针不携带任何上下文，所以只能表达“无状态回调”。</p>
<p><mark>lambda</mark> 是 C++11 引入的匿名可调用对象。每个 lambda 表达式产生一个唯一的<mark>闭包类型</mark>（closure type），捕获列表决定它持有外部变量的副本还是引用。<code>mutable</code> 允许修改按值捕获的成员；C++14 增加初始化捕获（init-capture）与泛型 lambda；C++17 允许 constexpr lambda；C++20 支持模板 lambda。无捕获的 lambda 可以转换为函数指针，因此能直接传给 C API；有捕获的 lambda 不能转换为函数指针，传给 C 接口时通常要用一个无捕获的跳板函数加 <code>void*</code> 上下文，纯 C++ 接口则可以改用模板或 <code>std::function</code> 这类类型擦除包装。</p>
<p>生命周期是 lambda 最容易出错的地方：按引用捕获局部变量后，把 lambda 返回或存起来，局部变量销毁，引用就悬垂。按值捕获则要区分“拷贝了指针”和“拷贝了对象”，捕获 <code>this</code> 在对象销毁后同样危险。下面这个完整例子把重载、默认参数、inline、constexpr、函数指针、lambda 和匿名命名空间放在一起，可直接用 C++20 编译运行。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;cstdio&gt;
#include &lt;vector&gt;

namespace {
int counter = 0;              // 内部链接：每个 TU 一份
}

inline int square(int x) { return x * x; }

int add(int a, int b = 10) { return a + b; }
double add(double a, double b) { return a + b; }  // 重载：参数列表不同

int apply(int (*fn)(int), int x) { return fn(x); }

constexpr int fib(int n) { return n &lt; 2 ? n : fib(n - 1) + fib(n - 2); }

int main() {
    std::printf("%d %d %.1f\n", add(1), add(1, 2), add(1.5, 2.5));

    int (*p)(int) = &amp;square;          // 函数指针
    std::printf("%d\n", apply(p, 7));

    int base = 5;
    auto addBase = [base](int v) { return v + base; };  // 按值捕获
    std::printf("%d\n", addBase(37));

    int total = 0;
    for (int x : std::vector&lt;int&gt;{1, 2, 3}) total += x;
    std::printf("%d %d\n", total, counter);
    static_assert(fib(10) == 55);  // 编译期求值
    return 0;
}</code></pre>
<p>这段程序的输出依次是 <code>11 3 4.0</code>、<code>49</code>、<code>42</code>、<code>6 0</code>。注意 <code>add(1)</code> 用了默认参数，<code>add(1, 2)</code> 与 <code>add(1.5, 2.5)</code> 分别选中 <code>int</code> 与 <code>double</code> 两个重载，<code>apply</code> 通过函数指针调用 <code>square</code>，而 <code>addBase</code> 的闭包类型只在这个 TU 内存在。若把 <code>addBase</code> 交给另一个 TU 的函数使用，就要借助模板或 <code>std::function</code>，因为闭包类型没有名字、也无法在别处声明。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>回调设计先问三个问题：需不需要携带状态？生命周期谁负责？跨不跨 C 边界？无状态且跨 C 用函数指针；有状态且留在 C++ 用 lambda 或模板；需要存进容器、延迟调用，再想 std::function 可能的分配与间接调用成本。</div></div>
</section>

<section class="sec">
<h2>分离编译、头文件设计与排障</h2>
<p>工程上的分离编译只有一条主线：<b>头文件描述接口，源文件提供实现，链接器负责拼装</b>。头文件应该自足（include what you use）、可重复包含（include guard 或 <code>#pragma once</code>）、不污染全局命名空间（不在头文件写 <code>using namespace</code>）。普通函数与全局变量定义在 <code>.cpp</code>；需要跨 TU 共享的常量用 <code>extern const</code> 或 C++17 <code>inline</code>；<code>inline</code> 函数、<code>constexpr</code> 函数、类定义、模板定义放头文件，但内容必须一致。</p>
<p>排障时先判断错误发生在哪个阶段。编译错误通常指向声明缺失、类型不匹配或二义性；自己代码引起的链接错误基本是两类：<mark>重复定义</mark>（multiple definition）和<mark>未定义引用</mark>（undefined reference）。前者查“哪个定义被放进了头文件”，后者查“声明了但没定义、没链接对应库、或者签名不一致”。在 Linux 上用 <code>nm -C</code> 查看符号，确认 <code>U</code>（未定义）与 <code>T</code>（已定义）匹配；MSVC 用 <code>dumpbin /symbols</code>。</p>
<pre class="code" data-lang="bash"><code>g++ -std=c++20 -c a.cpp b.cpp
g++ a.o b.o -o app
nm -C a.o | grep -E "add|square"</code></pre>
<p>最后列出几个高频误区。<b>一</b>，在头文件定义普通全局变量，多个 TU 包含后重复定义。<b>二</b>，以为 inline 一定内联，或以为不写 inline 就不会内联。<b>三</b>，重载函数取地址不写目标类型。<b>四</b>，默认参数在声明和定义处各写一遍。<b>五</b>，用 static 或匿名命名空间在头文件里放计数器，每个 TU 各数各的。<b>六</b>，不同 TU 编译选项不一致，制造静默的 ODR 违规。</p>
<h3>自测</h3>
<details class="quiz"><summary>Q1 · 头文件里写 int global = 0; 被两个 .cpp 包含，会发生什么？</summary><div class="quiz__a">两个 TU 各产生一个外部链接的强符号 <code>global</code>，链接器报 multiple definition。正确做法是头文件写 <code>extern int global;</code>，在一个 .cpp 中定义；C++17 起也可以写 <code>inline int global = 0;</code>，但所有 TU 看到的定义必须逐 token 一致。</div></details>
<details class="quiz"><summary>Q2 · 两个 TU 都定义 inline int f()，一个返回 1、一个返回 2，会链接失败吗？</summary><div class="quiz__a">通常不会。inline 函数以 COMDAT 或弱符号形式存在，链接器任选一份保留，不会报重复定义。但两份定义不一致违反 ODR，属于无需诊断的违规（IFNDR），实现没有义务报告，运行结果取决于链接器选了谁。这正是 ODR 比普通重复定义更危险的地方。</div></details>
<details class="quiz"><summary>Q3 · int g(int a, int b = 2); 定义 int (*p)(int, int) = &amp;g; 之后 p(1) 合法吗？</summary><div class="quiz__a">不合法。默认参数不是函数类型的一部分，函数指针类型是 <code>int(*)(int, int)</code>，通过 <code>p</code> 调用必须传两个实参。默认参数只在直接调用具名函数、且声明可见时由编译器补齐。</div></details>
<details class="quiz"><summary>Q4 · void f(int); void f(double); auto p = &amp;f; 为什么编译失败？</summary><div class="quiz__a"><code>f</code> 是重载集，<code>&amp;f</code> 没有唯一的函数类型，<code>auto</code> 无法推导。必须给出目标类型，例如 <code>void (*p)(int) = &amp;f;</code>，此时重载决议按目标类型选出 <code>f(int)</code>。同理，把重载函数传给接受函数指针的接口时，也要先确定签名。</div></details>
<h3>延伸阅读</h3>
<ul class="refs"><li><b>cppreference · One Definition Rule</b> — cppreference.com。逐条列出 TU 内、程序级与可重复实体的 ODR 要求。</li><li><b>cppreference · Overload resolution</b> — cppreference.com。候选集、可行集与转换序列排序的完整规则。</li><li><b>C++ Core Guidelines · SF.1–SF.8</b> — Bjarne Stroustrup &amp; Herb Sutter。源文件、头文件与 include 的工程规范。</li><li><b>C++ Core Guidelines · F.1–F.8</b> — Bjarne Stroustrup &amp; Herb Sutter。函数接口、参数传递与重载使用建议。</li><li><b>《C++ Primer》第 5 版 · 第 6 章 函数</b> — Stanley B. Lippman 等。声明与定义、参数传递、重载与函数指针。</li></ul>
</section>`
};
