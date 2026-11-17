window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["types-conversions"] = {
  slug: "types-conversions",
  title: "类型系统与隐式转换",
  subtitle: "每一个 bug 都可能从一次自动转换开始",
  level: 1,
  cluster: "语言核心",
  tags: ["类型", "隐式转换", "static_cast"],
  summary: "从标准保证的最小宽度讲起，拆解有符号与无符号回绕、整型提升与算术转换、窄化与列表初始化、explicit 与四种 cast，以及 auto 与 decltype 推导。",
  keyPoints: [
    "标准只保证最小位宽；跨平台用定宽类型，别把 LP64 与 LLP64 的事实当成语言规则",
    "无符号运算按模 2^N 回绕，有符号溢出是未定义行为；两者混用会让比较与循环条件悄悄翻转",
    "单参构造函数默认 explicit，转换用最窄的具名 cast；auto 会丢弃顶层 const 与引用"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
  <h2>先建立直觉：类型是编译器替你签的合同</h2>
  <p>写 C++ 时，你声明一个变量，编译器就记住它的<mark>静态类型（static type）</mark>。之后每次赋值、传参、返回、算术运算，编译器都要判断这个值能不能放进那个类型：能放就放；不能放但<mark>隐式转换（implicit conversion）</mark>规则允许，它就悄悄插入一条转换；两种都不行，才报错。</p>
  <p>隐式转换是从 C 继承下来的便利，也是大量 bug 的源头：有符号数变成无符号后比较结果翻转，double 被截断成 int 后少了小数，重载函数因为一次提升选错版本，构造函数因为没写 explicit 接受了本不该接受的参数。这些都不是语法错误，编译器常常连警告都不给。</p>
  <p>所以本篇的目标不是背规则，而是建立三个判断：这里会不会发生转换、转换后值还是不是原来的值、怎么把转换写成显式且可搜索的。后面的所有细节都服务于这三个判断。</p>
  <div class="callout callout--intuition"><span class="callout__label">直觉</span><div>类型像容器，转换像换容器。换的时候可能装得下（值不变），可能溢出（截断或回绕），也可能换错了容器（类型选错）。编译器只保证语法上能换，不保证换完还是你要的东西。</div></div>
</section>

<section class="sec">
  <h2>基本类型：标准只保证下限</h2>
  <p>C++ 标准没有规定 int 一定是 32 位。它规定的是每个类型的最小位宽、相对大小和转换关系（[basic.fundamental]）。sizeof(char) 恒为 1，但一个 char 有多少位由 CHAR_BIT 决定，标准只要求至少 8 位。下表把标准保证和两个常见 ABI 的实际值分开列，避免把某个平台的事实当成语言规则。</p>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>类型</th><th>标准保证</th><th>Linux x86-64（LP64）</th><th>Windows x86-64（LLP64）</th></tr></thead><tbody>
    <tr><td>bool</td><td>至少 1 字节</td><td>1 字节</td><td>1 字节</td></tr>
    <tr><td>char</td><td>至少 8 位</td><td>8 位</td><td>8 位</td></tr>
    <tr><td>short</td><td>至少 16 位</td><td>16 位</td><td>16 位</td></tr>
    <tr><td>int</td><td>至少 16 位</td><td>32 位</td><td>32 位</td></tr>
    <tr><td>long</td><td>至少 32 位</td><td>64 位</td><td>32 位</td></tr>
    <tr><td>long long</td><td>至少 64 位</td><td>64 位</td><td>64 位</td></tr>
    <tr><td>float</td><td>≥ 6 位有效十进制数字</td><td>IEEE binary32</td><td>IEEE binary32</td></tr>
    <tr><td>double</td><td>≥ 10 位有效十进制数字</td><td>IEEE binary64</td><td>IEEE binary64</td></tr>
    <tr><td>long double</td><td>至少与 double 相同</td><td>80 位扩展（16 字节存储）</td><td>与 double 相同</td></tr>
  </tbody></table></div>
  <p>需要确定宽度时用 &lt;cstdint&gt; 里的 std::int32_t、std::uint64_t（C++11）。它们是<b>可选</b>的：只有平台确实存在正好 32 位、无填充位的整数类型时才会定义。std::int_least32_t 与 std::int_fast32_t 则一定存在。平台差异最典型的是 long：Linux x86-64 用 LP64，long 是 64 位；Windows x86-64 用 LLP64，long 仍是 32 位，只有 long long 和指针是 64 位。跨平台代码要么用定宽类型，要么用 std::size_t、std::ptrdiff_t 这类与平台匹配的别名。</p>
  <p>bool、char、signed char、unsigned char 是四种不同的类型。bool 转整数是 0/1，任何非零值（包括 0.5 和 NaN）转 bool 都是 true。普通 char 的符号性由实现决定：x86 上通常 signed，ARM 上常常 unsigned，把大于 127 的值塞进 char 再运算，结果会随平台变化。C++20 的 char8_t 表示 UTF-8 码元，是独立类型，不能和 char 隐式互转；C++11 的 char16_t 与 char32_t 对应 UTF-16 与 UTF-32。处理原始字节时，C++17 的 std::byte 比 char 更能表达意图。</p>
  <p>浮点的标准保证同样是下限：float 至少 6 位有效十进制数字，double 至少 10 位，long double 至少和 double 一样。多数平台用 IEEE 754 的 binary32 与 binary64，但这不是语言保证，可用 std::numeric_limits&lt;T&gt;::is_iec559 在编译期确认。long double 的差异尤其大：Linux x86-64 上常见 80 位扩展精度（存储占 16 字节），MSVC 上通常与 double 相同。涉及序列化和 ABI 时，不要假设它更大。</p>
</section>

<section class="sec">
  <h2>有符号、无符号与回绕</h2>
  <p>无符号整数的运算被定义为<b>模 2^N</b>：结果超出范围就绕回来。unsigned char u = 255; ++u; 得到 0；unsigned u = 0; u - 1; 得到 UINT_MAX。这不是溢出错误，是语言明确规定的行为。</p>
  <div class="formula">U = x mod 2^N（N 为目标类型的位宽）
−1 → 2^N − 1；0 − 1 → 2^N − 1
有符号溢出：未定义行为（UB），不是回绕</div>
  <p>有符号整数正相反。C++20 起标准强制补码表示（P0907），但<b>有符号溢出仍然是未定义行为</b>。编译器可以假设它永远不会发生，于是把 x + 1 &gt; x 优化成恒真，或者删掉你以为存在的检查。想表达回绕就用无符号类型；想表达计数就用有符号类型并留够位宽。</p>
  <p>真正危险的是两者混用。只要有一边无符号，另一边通常会被转成无符号。-1 &lt; 0u 是 false，因为 -1 先变成 UINT_MAX。更隐蔽的是把有符号变量和无符号的 size() 放进同一个比较：v.size() 返回 std::size_t，i 在比较时被转成无符号。for (int i = 0; i &lt; v.size(); ++i) 在 i 非负、尺寸不超过 INT_MAX 时还能正常工作，但一旦写成 i &lt;= v.size() - 1（空容器上 v.size() - 1 会变成巨大的无符号数）或让 i 递减到 -1，循环条件就会失控。C++20 的 std::ssize(v) 返回有符号的 std::ptrdiff_t，是更安全的写法。</p>
  <p>无符号转有符号也不是永远安全。C++20 之前，越界结果由实现定义；C++20 起规定为模 2^N 后唯一对应的值，也就是与补码一致。但可移植代码不应依赖这条边界，先把值收进目标范围再转换。Core Guidelines 的 ES.100-ES.107 说得很直接：算术用有符号，位操作用无符号，下标别用无符号。</p>
  <figure class="fig">
    <svg viewBox="0 0 760 380" width="100%" role="img" aria-label="8 位无符号与有符号整数的回绕对应关系">
      <defs>
        <marker id="types-conversions-arrow-wrap" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--sv-a)" />
        </marker>
      </defs>
      <text x="30" y="22" font-size="14" fill="var(--sv-ink)" font-family="inherit">8 位整数：同一串二进制，两种解释</text>
      <path d="M 670 82 C 670 46, 150 46, 150 82" fill="none" stroke="var(--sv-a)" stroke-width="2" marker-end="url(#types-conversions-arrow-wrap)" />
      <text x="410" y="40" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">255 + 1 → 0（模 2⁸）</text>

      <text x="30" y="106" font-size="13" fill="var(--sv-ink)" font-family="inherit">unsigned char</text>
      <rect x="150" y="84" width="520" height="36" rx="6" fill="var(--sv-a2)" />
      <line x1="150" y1="120" x2="150" y2="132" stroke="var(--sv-line)" />
      <line x1="281" y1="120" x2="281" y2="132" stroke="var(--sv-line)" />
      <line x1="411" y1="120" x2="411" y2="132" stroke="var(--sv-line)" />
      <line x1="541" y1="120" x2="541" y2="132" stroke="var(--sv-line)" />
      <line x1="670" y1="120" x2="670" y2="132" stroke="var(--sv-line)" />
      <text x="150" y="148" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">0</text>
      <text x="281" y="148" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">64</text>
      <text x="411" y="148" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">128</text>
      <text x="541" y="148" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">192</text>
      <text x="670" y="148" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">255</text>

      <line x1="670" y1="132" x2="670" y2="190" stroke="var(--sv-line)" stroke-dasharray="4 4" />
      <line x1="411" y1="132" x2="411" y2="190" stroke="var(--sv-line)" stroke-dasharray="4 4" />
      <text x="662" y="166" font-size="12" text-anchor="end" fill="var(--sv-ink)" font-family="inherit">255 / −1</text>
      <text x="411" y="166" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">128 / −128</text>

      <text x="30" y="212" font-size="13" fill="var(--sv-ink)" font-family="inherit">signed char</text>
      <rect x="150" y="190" width="520" height="36" rx="6" fill="var(--sv-b2)" />
      <line x1="150" y1="226" x2="150" y2="238" stroke="var(--sv-line)" />
      <line x1="281" y1="226" x2="281" y2="238" stroke="var(--sv-line)" />
      <line x1="411" y1="226" x2="411" y2="238" stroke="var(--sv-line)" />
      <line x1="541" y1="226" x2="541" y2="238" stroke="var(--sv-line)" />
      <line x1="670" y1="226" x2="670" y2="238" stroke="var(--sv-line)" />
      <text x="150" y="254" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">0</text>
      <text x="281" y="254" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">64</text>
      <text x="411" y="254" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">−128</text>
      <text x="541" y="254" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">−64</text>
      <text x="670" y="254" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">−1</text>

      <text x="30" y="300" font-size="12" fill="var(--sv-ink)" font-family="inherit">位模式 11111111 既可能是 255，也可能是 −1；C++20 起有符号表示强制为补码。</text>
      <text x="30" y="326" font-size="12" fill="var(--sv-muted)" font-family="inherit">无符号运算按模 2^N 回绕；有符号溢出不是回绕，编译器可以假设它不发生。</text>
      <text x="30" y="352" font-size="12" fill="var(--sv-muted)" font-family="inherit">无符号值转有符号且越界时，C++20 起按补码对应；在此之前结果由实现定义。</text>
    </svg>
    <figcaption>图 1 · 无符号的 255 与有符号的 −1 共享同一串位，回绕只对无符号成立</figcaption>
  </figure>
</section>

<section class="sec">
  <h2>字面量、后缀与列表初始化</h2>
  <p>字面量的类型由写法和后缀共同决定。42 是 int，42u 是 unsigned int，42ll 是 long long；3.14 是 double，3.14f 才是 float，3.14l 是 long double。十进制整数字面量按 int → long → long long 找第一个装得下的类型；十六进制、八进制和二进制（C++14）还会考虑对应的无符号版本。C++14 允许 1'000'000 这样的分隔符，C++23 增加 z 后缀表示有符号的 size_t 对应类型。</p>
  <p>一个经典陷阱是移位：在 32 位 int 的平台上，1 &lt;&lt; 31 会落到符号位上。C++11 及更早的措辞把它定为未定义行为；CWG 1457 之后改为：只要结果能在对应的无符号类型中表示，就取该值再转回有符号类型（主流实现得到 INT_MIN）；C++20 把这一步无符号到有符号的转换明确为模 2^N 的补码回绕。标准措辞几经变化，代码不应依赖这条边界：想设置最高位就写 1u &lt;&lt; 31 或 std::uint32_t{1} &lt;&lt; 31。</p>
  <p>C++11 的<mark>列表初始化（list initialization）</mark>用花括号，最重要的贡献是把<mark>窄化转换（narrowing conversion）</mark>变成编译错误。窄化包括：浮点转整数（没有常量例外）；long double 转 double 或 float、double 转 float（仅当源是常量表达式且转换后的值在目标类型可表示范围内时例外，允许损失精度）；整数转浮点（仅当源是常量表达式、值可表示且转回后与原值相等时例外）；整数转装不下其全部值的整数类型（同样的常量表达式例外，且要求转回后与原值相等）。所以 int x{3.9}; 直接报错，int x = 3.9; 则静默截断成 3。</p>
  <p>花括号还改变容器构造的含义：std::vector&lt;int&gt; v{10}; 是一个元素、值为 10，因为 initializer_list 构造函数优先；std::vector&lt;int&gt; v(10); 才是 10 个 0。这不是窄化，而是重载决议里 initializer_list 的偏好。建议能用花括号就用花括号，确实需要尺寸构造时再用小括号并加注释。</p>
  <div class="callout callout--warn"><span class="callout__label">注意</span><div>列表初始化不是万能的：它禁止窄化，但不会阻止你在普通赋值里把 300 存进 unsigned char，也不会让浮点比较变准。它的价值是把一部分错误提前到编译期。</div></div>
</section>

<section class="sec">
  <h2>整型提升与常用算术转换</h2>
  <p>两个比 int 窄的整数做运算时，先发生<mark>整型提升（integral promotion）</mark>：bool、char、signed char、unsigned char、short、unsigned short 会提升到 int，若 int 装不下其全部值则提升到 unsigned int；char8_t、char16_t、char32_t、wchar_t 则提升到 int、unsigned int、long、unsigned long、long long、unsigned long long 中第一个能装下其全部值的类型。提升保持值不变，不保持位模式。</p>
  <p>提升之后是<mark>常用算术转换（usual arithmetic conversions）</mark>，它决定二元运算的结果类型。按下面的顺序读：</p>
  <div class="formula">1. 任一边是 long double → long double
2. 否则任一边是 double → double
3. 否则任一边是 float → float
4. 否则两边都做整型提升，然后：
   同类型 → 该类型
   同符号性 → 等级高者胜
   无符号等级 ≥ 有符号等级 → 有符号转无符号
   有符号能表示无符号的全部值 → 无符号转有符号
   否则两边都转成有符号类型对应的无符号版本</div>
  <figure class="fig">
    <svg viewBox="0 0 760 380" width="100%" role="img" aria-label="重载决议中的转换等级与整型转换等级">
      <defs>
        <marker id="types-conversions-arrow-rank" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--sv-muted)" />
        </marker>
      </defs>
      <text x="30" y="28" font-size="14" fill="var(--sv-ink)" font-family="inherit">重载决议：标准转换序列的等级（上方优先）</text>

      <text x="30" y="68" font-size="13" fill="var(--sv-ink)" font-family="inherit">0 精确匹配</text>
      <rect x="150" y="52" width="200" height="24" rx="5" fill="var(--sv-a)" />
      <text x="350" y="69" font-size="12" fill="var(--sv-ink)" font-family="inherit">同类型或顶层 const</text>

      <text x="30" y="111" font-size="13" fill="var(--sv-ink)" font-family="inherit">1 提升</text>
      <rect x="150" y="95" width="168" height="24" rx="5" fill="var(--sv-a2)" />
      <text x="330" y="112" font-size="12" fill="var(--sv-ink)" font-family="inherit">char / short → int</text>

      <text x="30" y="154" font-size="13" fill="var(--sv-ink)" font-family="inherit">2 标准转换</text>
      <rect x="150" y="138" width="136" height="24" rx="5" fill="var(--sv-b)" />
      <text x="298" y="155" font-size="12" fill="var(--sv-ink)" font-family="inherit">int → double / unsigned</text>

      <text x="30" y="197" font-size="13" fill="var(--sv-ink)" font-family="inherit">3 用户定义转换</text>
      <rect x="150" y="181" width="104" height="24" rx="5" fill="var(--sv-c)" />
      <text x="266" y="198" font-size="12" fill="var(--sv-ink)" font-family="inherit">经由构造函数或转换运算符</text>

      <text x="30" y="240" font-size="13" fill="var(--sv-ink)" font-family="inherit">4 省略号</text>
      <rect x="150" y="224" width="52" height="24" rx="5" fill="var(--sv-bg)" stroke="var(--sv-line)" />
      <text x="214" y="241" font-size="12" fill="var(--sv-ink)" font-family="inherit">匹配形参列表里的 ...</text>

      <line x1="130" y1="48" x2="130" y2="256" stroke="var(--sv-line)" stroke-dasharray="4 4" marker-end="url(#types-conversions-arrow-rank)" />
      <text x="30" y="278" font-size="12" fill="var(--sv-muted)" font-family="inherit">优先级递减 ↓</text>

      <line x1="490" y1="44" x2="490" y2="300" stroke="var(--sv-line)" />

      <text x="520" y="28" font-size="14" fill="var(--sv-ink)" font-family="inherit">整型转换等级（rank）</text>
      <rect x="540" y="48" width="180" height="28" rx="5" fill="var(--sv-a2)" />
      <text x="630" y="67" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">bool</text>
      <rect x="540" y="88" width="180" height="28" rx="5" fill="var(--sv-a2)" />
      <text x="630" y="107" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">char</text>
      <rect x="540" y="128" width="180" height="28" rx="5" fill="var(--sv-b2)" />
      <text x="630" y="147" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">short</text>
      <rect x="540" y="168" width="180" height="28" rx="5" fill="var(--sv-b2)" />
      <text x="630" y="187" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">int</text>
      <rect x="540" y="208" width="180" height="28" rx="5" fill="var(--sv-c)" />
      <text x="630" y="227" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">long</text>
      <rect x="540" y="248" width="180" height="28" rx="5" fill="var(--sv-c)" />
      <text x="630" y="267" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">long long</text>
      <line x1="520" y1="50" x2="520" y2="276" stroke="var(--sv-line)" marker-end="url(#types-conversions-arrow-rank)" />
      <text x="540" y="300" font-size="12" fill="var(--sv-muted)" font-family="inherit">rank 递增 ↓</text>

      <text x="30" y="330" font-size="12" fill="var(--sv-muted)" font-family="inherit">等级只用于比较“哪种转换更好”；窄化不参与比较：列表初始化直接禁止，其他初始化静默发生。</text>
    </svg>
    <figcaption>图 2 · 转换序列的优先级与整型 rank：先比等级，再谈值有没有被改掉</figcaption>
  </figure>
  <p>后果常常反直觉。std::uint8_t a = 200, b = 100; auto c = a + b; 里 c 是 int（300），不是 uint8_t；赋回 uint8_t 才会截断成 44。long 与 unsigned int 相加，在 LP64 的 Linux 上是 long，在 LLP64 的 Windows 上是 unsigned long，因为 32 位的 long 装不下 unsigned int 的全部值。</p>
  <p>工程结论很简单：<b>不要让有符号和无符号在同一个表达式里相遇</b>。比较前先统一类型，必要时 static_cast 并写出范围检查；不要把 size() 的返回值直接和有符号循环变量比较；也不要依赖“提升之后自然就对”这种运气。</p>
</section>

<section class="sec">
  <h2>explicit：把隐式构造关掉</h2>
  <p>只有一个实参、且没有 explicit 的构造函数，同时也是一个<mark>转换构造函数（converting constructor）</mark>。它让 X x = 1;、f(1)、return 1; 都能把 int 悄悄变成 X。这有时是设计意图（std::string 接受 const char*），更多时候是事故来源：表示“秒”的类型接受裸数字，表示“文件路径”的类型接受任意字符串。</p>
  <p>在构造函数前加 explicit（C++98 起）会禁止复制初始化语境里的隐式转换，但保留直接初始化：Seconds s(5); 和 static_cast&lt;Seconds&gt;(5) 仍然可用，f(5) 与 return 5; 会被拒绝。C++11 把 explicit 扩展到转换运算符：explicit operator bool() 在 if、while、! 这类<b>语境转换（contextual conversion）</b>中会被隐式调用，其他隐式转换场景不可用；要显式取值仍可写 static_cast&lt;bool&gt;(x)。C++20 又允许 explicit(bool) 按条件决定是否显式。</p>
  <p>实践规则：<b>单参构造函数默认写 explicit</b>，只有明确要支持隐式转换时才省略。标准库自己也是这么做的：std::vector 的尺寸构造、std::unique_ptr 的指针构造、std::thread 接受可调用对象的构造都是 explicit；std::string 从 const char* 构造则故意保留隐式，方便字面量直接使用。下面这段是示意，略去头文件与函数定义，重点看哪些写法会被拒绝：</p>
  <pre class="code" data-lang="cpp"><code>class Seconds {
public:
    explicit Seconds(int v) : value_(v) {}
    int value() const { return value_; }
private:
    int value_;
};

void sleep_for(Seconds s);

void demo() {
    Seconds a(5);           // OK：直接初始化
    Seconds b = 5;          // 错误：explicit 禁止复制初始化
    sleep_for(5);           // 错误：不能隐式转换
    sleep_for(Seconds{5});  // OK：显式构造
}</code></pre>
  <p>explicit 不是访问控制，也不是禁止转换：它只是把转换从“自动”改成“必须写出来”。这正是它的价值——代码审查时，所有发生转换的地方都能被搜索到。</p>
</section>

<section class="sec">
  <h2>四种 cast：把转换写在明处</h2>
  <p>C++ 提供四种具名转换，取代 C 风格的 (T)x。它们的区别不是语法，而是允许做什么、什么时候检查、失败了会怎样。</p>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>转换</th><th>典型用途</th><th>检查时机</th><th>失败后果</th></tr></thead><tbody>
    <tr><td>static_cast</td><td>数值、枚举、void*、明确的继承关系</td><td>编译期检查类型关系</td><td>下行转换错误则未定义行为</td></tr>
    <tr><td>const_cast</td><td>增删 const 与 volatile</td><td>编译期</td><td>修改原 const 对象则未定义行为</td></tr>
    <tr><td>reinterpret_cast</td><td>指针与整数、位模式重解释</td><td>编译期几乎不检查</td><td>结果由实现定义</td></tr>
    <tr><td>dynamic_cast</td><td>多态类型的安全下行与交叉转换</td><td>运行期（RTTI）</td><td>指针得 nullptr，引用抛 std::bad_cast</td></tr>
  </tbody></table></div>
  <p>static_cast 最常用：数值互转、void* 与具体指针互转、枚举与整数互转、有明确继承关系的上行与下行转换、调用 explicit 构造或转换运算符。它在编译期检查类型关系，但<b>不做运行期检查</b>；把基类指针 static_cast 成派生类指针，如果对象实际不是那个派生类，行为未定义。</p>
  <p>const_cast 只增删 const 与 volatile，合法用途很窄：调用一个没写 const 正确性、但承诺不修改的老接口。对象本身是 const 时，去 const 再写入是未定义行为。reinterpret_cast 重新解释位模式：指针与整数互转、不相关指针互转，结果由实现定义，还可能违反严格别名（strict aliasing）规则，只应出现在底层代码和序列化边界。dynamic_cast 在做安全的下行或交叉转换时要求类型多态（至少一个虚函数），依赖 RTTI，在运行期检查；指针失败返回 nullptr，引用失败抛 std::bad_cast。它有运行时代价，但需要安全下行转换时是唯一正确的选择。</p>
  <figure class="fig">
    <svg viewBox="0 0 760 380" width="100%" role="img" aria-label="四种 cast 的选择决策树">
      <defs>
        <marker id="types-conversions-arrow-tree" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--sv-muted)" />
        </marker>
      </defs>
      <text x="30" y="24" font-size="14" fill="var(--sv-ink)" font-family="inherit">cast 选择决策树：先问能不能不转</text>

      <rect x="30" y="44" width="360" height="38" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)" />
      <text x="46" y="68" font-size="13" fill="var(--sv-ink)" font-family="inherit">能否改设计，避免这次转换？</text>
      <line x1="390" y1="63" x2="468" y2="63" stroke="var(--sv-muted)" marker-end="url(#types-conversions-arrow-tree)" />
      <text x="420" y="56" font-size="12" fill="var(--sv-muted)" font-family="inherit">是</text>
      <rect x="470" y="44" width="260" height="38" rx="6" fill="var(--sv-a)" />
      <text x="486" y="68" font-size="13" fill="var(--sv-ink)" font-family="inherit">改设计：重载、模板、强类型封装</text>

      <rect x="30" y="104" width="360" height="38" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)" />
      <text x="46" y="128" font-size="13" fill="var(--sv-ink)" font-family="inherit">只涉及 const 或 volatile？</text>
      <line x1="390" y1="123" x2="468" y2="123" stroke="var(--sv-muted)" marker-end="url(#types-conversions-arrow-tree)" />
      <text x="420" y="116" font-size="12" fill="var(--sv-muted)" font-family="inherit">是</text>
      <rect x="470" y="104" width="260" height="38" rx="6" fill="var(--sv-a2)" />
      <text x="486" y="128" font-size="13" fill="var(--sv-ink)" font-family="inherit">const_cast（确认对象本身不是 const）</text>

      <rect x="30" y="164" width="360" height="38" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)" />
      <text x="46" y="188" font-size="13" fill="var(--sv-ink)" font-family="inherit">多态类型，且需要运行时检查？</text>
      <line x1="390" y1="183" x2="468" y2="183" stroke="var(--sv-muted)" marker-end="url(#types-conversions-arrow-tree)" />
      <text x="420" y="176" font-size="12" fill="var(--sv-muted)" font-family="inherit">是</text>
      <rect x="470" y="164" width="260" height="38" rx="6" fill="var(--sv-b)" />
      <text x="486" y="188" font-size="13" fill="var(--sv-ink)" font-family="inherit">dynamic_cast</text>

      <rect x="30" y="224" width="360" height="38" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)" />
      <text x="46" y="248" font-size="13" fill="var(--sv-ink)" font-family="inherit">数值、枚举，或明确的继承关系？</text>
      <line x1="390" y1="243" x2="468" y2="243" stroke="var(--sv-muted)" marker-end="url(#types-conversions-arrow-tree)" />
      <text x="420" y="236" font-size="12" fill="var(--sv-muted)" font-family="inherit">是</text>
      <rect x="470" y="224" width="260" height="38" rx="6" fill="var(--sv-c)" />
      <text x="486" y="248" font-size="13" fill="var(--sv-ink)" font-family="inherit">static_cast</text>

      <rect x="30" y="284" width="360" height="38" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)" />
      <text x="46" y="308" font-size="13" fill="var(--sv-ink)" font-family="inherit">必须重新解释位模式？</text>
      <line x1="390" y1="303" x2="468" y2="303" stroke="var(--sv-muted)" marker-end="url(#types-conversions-arrow-tree)" />
      <text x="420" y="296" font-size="12" fill="var(--sv-muted)" font-family="inherit">是</text>
      <rect x="470" y="284" width="260" height="38" rx="6" fill="var(--sv-bg)" stroke="var(--sv-b)" />
      <text x="486" y="308" font-size="13" fill="var(--sv-ink)" font-family="inherit">reinterpret_cast（最后手段）</text>

      <line x1="210" y1="82" x2="210" y2="104" stroke="var(--sv-muted)" marker-end="url(#types-conversions-arrow-tree)" />
      <line x1="210" y1="142" x2="210" y2="164" stroke="var(--sv-muted)" marker-end="url(#types-conversions-arrow-tree)" />
      <line x1="210" y1="202" x2="210" y2="224" stroke="var(--sv-muted)" marker-end="url(#types-conversions-arrow-tree)" />
      <line x1="210" y1="262" x2="210" y2="284" stroke="var(--sv-muted)" marker-end="url(#types-conversions-arrow-tree)" />
      <text x="220" y="100" font-size="12" fill="var(--sv-muted)" font-family="inherit">否</text>
      <text x="220" y="160" font-size="12" fill="var(--sv-muted)" font-family="inherit">否</text>
      <text x="220" y="220" font-size="12" fill="var(--sv-muted)" font-family="inherit">否</text>
      <text x="220" y="280" font-size="12" fill="var(--sv-muted)" font-family="inherit">否</text>

      <text x="30" y="352" font-size="12" fill="var(--sv-muted)" font-family="inherit">C 风格转换 (T)x 会依次尝试 const_cast、static_cast、reinterpret_cast，看不出意图，应禁止。</text>
    </svg>
    <figcaption>图 3 · 从“能不能不转”开始，逐层收敛到最窄的具名转换</figcaption>
  </figure>
  <p>C 风格转换 (T)x 会按 const_cast、static_cast、reinterpret_cast 的顺序尝试，几乎什么都能编过，却看不出意图，代码规范通常直接禁止。好习惯是<b>先问能不能不转换</b>——改类型、改接口、加重载、用模板；不能避免时，再按上面的决策树选最窄的一种。</p>
</section>

<section class="sec">
  <h2>auto、decltype 与推导出来的类型</h2>
  <p>auto（C++11）让编译器从初始化器推导类型，规则和按值传参的模板推导一致：<b>丢弃顶层 const 和引用</b>。const int ci = 0; auto x = ci; 得到 int，不是 const int；auto&amp; r = ci; 才保留 const int&amp;。数组和函数按值会退化成指针，用 auto&amp; 才能保留数组类型。C++14 起可用 auto 作返回类型，C++17 的结构化绑定也依赖这套推导。</p>
  <p>decltype 的规则不同，它<b>保留引用和 cv 限定</b>。对未加括号的变量名，decltype(x) 给出声明时的类型；对一般表达式，若表达式是左值，结果是 T&amp;；若是将亡值，结果是 T&amp;&amp;；否则是 T。所以 decltype(x) 是 int，decltype((x)) 是 int&amp;——多一对括号结果就变了。decltype(auto)（C++14）把两套规则合起来，常用于完美转发的返回类型。更深层的模板推导留给 templates-basics 一篇。</p>
  <p>auto 最常见的坑是推出来的类型和你想的不一样。auto sz = v.size(); 得到 std::size_t，拿它和 int 比较就回到有符号与无符号的问题；auto b = v[0]; 对 std::vector&lt;bool&gt; 得到代理引用类型而不是 bool；auto x = {1, 2, 3}; 得到 std::initializer_list&lt;int&gt;，而 auto x{1}; 在 C++17 起是 int。写 auto 时，最好能说出它实际是什么类型。</p>
  <p>浮点也有类似的陷阱。0.1 + 0.2 == 0.3 通常是 false，因为二进制浮点无法精确表示 0.1 和 0.2；比较要留容差，或比较整数化的量。float 大约只有 6 到 7 位有效十进制数字，double 大约 15 到 17 位；整数超过 2^24 后不一定能精确转成 float，超过 2^53 后不一定能精确转成 double。double 转 int 向零截断，超出目标范围是未定义行为；NaN 与任何值比较都为 false，包括它自己。把本篇的规则放进下面这个完整程序，注释标出了每个关键点（C++20 口径，可直接编译）：</p>
  <pre class="code" data-lang="cpp"><code>#include &lt;cstdint&gt;
#include &lt;iostream&gt;
#include &lt;vector&gt;

class Meters {
public:
    explicit Meters(double v) : value_(v) {}
    double value() const { return value_; }
private:
    double value_;
};

void show(Meters m) {
    std::cout &lt;&lt; m.value() &lt;&lt; " m\n";
}

int main() {
    std::uint8_t u = 255;
    ++u;                                   // 256 mod 256 = 0
    std::cout &lt;&lt; static_cast&lt;int&gt;(u) &lt;&lt; '\n';

    unsigned int zero = 0;
    std::cout &lt;&lt; std::boolalpha &lt;&lt; (-1 &lt; zero) &lt;&lt; '\n';  // false

    int n = static_cast&lt;int&gt;(3.9);         // 3，向零截断
    // int bad{3.9};                       // 错误：窄化
    std::cout &lt;&lt; n &lt;&lt; '\n';

    std::vector&lt;int&gt; v{1, 2, 3};
    auto sz = v.size();                    // std::size_t
    std::cout &lt;&lt; sz &lt;&lt; '\n';

    // show(3.0);                          // 错误：explicit
    show(Meters{3.0});
}</code></pre>
  <div class="callout callout--tip"><span class="callout__label">实践</span><div>默认用 int 或 std::int64_t 做算术，用 std::size_t 只做尺寸和下标且不与有符号混比；需要确定宽度时用定宽类型；所有窄化都显式 static_cast 并附范围检查；单参构造函数默认 explicit。这些规则不花哨，但能消掉大部分“类型自己变了”的 bug。</div></div>
  <h3>自测</h3>
  <details class="quiz"><summary>Q1 · unsigned int u = 10; int i = -20; 表达式 i &lt; u 的值是什么？</summary><div class="quiz__a">true。常用算术转换把 i 转成 unsigned int，-20 在 32 位 unsigned int 上变成 4294967276，远大于 10。若先 static_cast&lt;int&gt;(u) 再比较，才是 -20 与 10 比较，结果符合直觉。开启 -Wsign-compare 时这类代码通常会有警告，不要忽略它。</div></details>
  <details class="quiz"><summary>Q2 · int a{3.0};、int b(3.0);、int c = 3.0; 三者有什么区别？</summary><div class="quiz__a">第一条编译错误：浮点转整数属于窄化，列表初始化禁止。后两条都能编译，b 和 c 都得到 3（向零截断）。注意 3.0 虽然数值上是整数，仍然算窄化；规则看的是类型类别，不是这一次的具体值。</div></details>
  <details class="quiz"><summary>Q3 · struct S { explicit S(int); }; void f(S); 调用 f(1); 会发生什么？怎样改才能通过？</summary><div class="quiz__a">编译错误：explicit 禁止函数实参的隐式转换。改成 f(S{1}) 或 f(static_cast&lt;S&gt;(1)) 即可。同理 S s = 1; 会被拒绝，而 S s(1); 允许。</div></details>
  <details class="quiz"><summary>Q4 · const int ci = 42; 写出 auto a = ci; auto&amp; b = ci; decltype(ci) c = ci; decltype((ci)) d = ci; 中四个变量的类型。</summary><div class="quiz__a">a 是 int（auto 丢弃顶层 const）；b 是 const int&amp;（引用保留 const）；c 是 const int（decltype 对未加括号的名字保留声明类型）；d 是 const int&amp;（带括号的表达式是左值，decltype 给它加引用）。</div></details>
  <h3>延伸阅读</h3>
  <ul class="refs">
    <li><b>cppreference: Implicit conversions</b> — cppreference.com, 持续更新。标准转换序列、整型提升与常用算术转换的速查入口，规则条目与标准章节一一对应。</li>
    <li><b>C++ Core Guidelines ES.100-ES.107</b> — Bjarne Stroustrup, Herb Sutter。有符号与无符号、溢出、下标类型的八条规则，每条都给出理由与反例。</li>
    <li><b>《C++ Primer》(5th ed.)</b> — Stanley B. Lippman, Josée Lajoie, Barbara E. Moo, 2012。第 2 章讲基本类型与字面量，第 4 章讲表达式、类型转换与 cast，适合系统补基础。</li>
    <li><b>ISO/IEC 14882:2020</b> — ISO/IEC, 2020。[basic.fundamental]、[conv] 与 [expr.arith.conv] 是本文所有规则的权威定义。</li>
    <li><b>cppreference: Explicit conversions</b> — cppreference.com, 持续更新。static_cast、const_cast、reinterpret_cast、dynamic_cast 的逐条说明与限制。</li>
  </ul>
</section>`
};
