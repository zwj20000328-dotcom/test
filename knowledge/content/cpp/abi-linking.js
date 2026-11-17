window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["abi-linking"] = {
  slug: "abi-linking",
  title: "ABI、动态库与二进制兼容",
  subtitle: "为什么换个编译器就链接失败",
  level: 5,
  cluster: "工程化",
  tags: ["ABI", "动态链接", "符号"],
  summary: "API 与头文件都没变，为何换个编译器就链接失败或运行崩溃？拆解名字修饰、符号可见性、soname、RTTI 与异常跨库、STL 与内联风险，给出二进制兼容规则。",
  keyPoints: [
    "API 是源码契约，ABI 是二进制契约；C++ 标准不规定 ABI，平台与编译器决定细节",
    "名字修饰决定符号名；extern \"C\" 只关闭修饰，不保证布局、异常与分配器兼容",
    "soname 与版本脚本管理运行期查找和符号版本；ABI 破坏必须提升 soname",
    "RTTI、异常、STL 与 inline 函数体是跨库的四大风险源",
    "插件边界首选 C ABI 或稳定纯虚接口，配合版本握手与明确的分配归属"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec"><h2>一、API 是源码契约，ABI 是二进制契约</h2>
<p>你写下一行声明 <code>double norm(const Vec&amp; v);</code>，同事在另一个城市调用它。双方 include 同一个头文件，编译通过，链接通过，程序跑起来却崩溃；或者更糟，返回一个看起来合理但完全错误的值。这类问题通常不在语法，而在 <mark>ABI</mark>（Application Binary Interface，应用二进制接口）。</p>
<p>API 管的是源码层面能写什么：函数名、参数与返回类型、访问控制、异常规格、语义约定。ABI 管的是这些声明最终被编码成什么：参数放进寄存器还是栈、名字如何修饰、对象多大、成员偏移多少、vtable 有几个槽、异常如何展开、字符串由谁释放。API 是菜单，ABI 是灶台尺寸和上菜流程。菜单一样，厨房不兼容，菜还是端不出来。</p>
<p>必须先说清一个前提：ISO C++ 标准不规定 ABI（到 C++23 为止）。<mark>Itanium C++ ABI</mark> 是 Linux 与多数 Unix 上 GCC、Clang 的事实标准，macOS 大体沿用但有平台差异；MSVC 有自己的 ABI；游戏主机与嵌入式工具链又各有约定。所以本篇凡涉及尺寸、布局、修饰规则，都先问平台与编译器，再谈结论。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>改一个头文件里的 inline 函数体，重新编译整个项目，一切正常；只替换一个 .so，旧程序继续跑旧逻辑。ABI 不是编译器替你守的规矩，而是发布双方自己签的合同。</div></div>
</section>

<section class="sec"><h2>二、名字修饰：符号表里没有“add”</h2>
<p>源码里 <code>int add(int,int)</code> 与 <code>double add(double,double)</code> 可以共存，但链接器眼里的符号是扁平字符串，不允许重名。编译器用<mark>名字修饰</mark>（name mangling，也叫 symbol decoration）把命名空间、类名与参数类型编码进符号名。Itanium ABI 的规则是：前缀 <code>_Z</code>，名字前加长度，再依次拼接参数类型的编码。</p>
<p>于是 <code>int add(int,int)</code> 变成 <code>_Z3addii</code>，<code>void foo::Bar::baz()</code> 变成 <code>_ZN3foo3Bar3bazEv</code>，带 <code>std::string</code> 参数的函数会展开成长长一串 <code>std::__cxx11::basic_string</code> 相关编码。MSVC 的规则完全不同，例如 <code>?baz@Bar@foo@@QEAAXXZ</code>。两套修饰无法互相识别，这是 MSVC 与 GCC 产物不能直接互链的根本原因之一。</p>
<p>第一个工程后果：链接错误里的名字是修饰后的。看到 <code>undefined reference to '_Z3addii'</code>，用 <code>c++filt</code> 还原，才知道缺的是 <code>add(int,int)</code>。第二个后果更阴险：普通函数的返回类型通常不进入修饰名（个别模板场景例外）。把 <code>int f()</code> 改成 <code>long f()</code>，旧调用方可能依然链接成功，然后按 int 去读返回值——典型 x86-64 实现下读的是 eax，等于把 64 位结果截断；反过来，若旧库返回 int、新调用方按 long 读 rax，高 32 位本就没有约定（常见实现因为 32 位写入会清零高位，负值于是变成大正数）。标准层面这是未定义行为。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="源码声明经过名字修饰后进入 ELF 符号表的对照">
<text x="16" y="26" font-family="inherit" font-size="15" font-weight="600" fill="var(--sv-ink)">从源码声明到符号表条目</text>
<text x="16" y="50" font-family="inherit" font-size="12" fill="var(--sv-muted)">Itanium ABI 口径，GCC 13 / Clang 17，ELF 目标文件</text>
<text x="28" y="78" font-family="inherit" font-size="12" fill="var(--sv-muted)">源码声明</text>
<text x="300" y="78" font-family="inherit" font-size="12" fill="var(--sv-muted)">修饰后的符号</text>
<text x="560" y="78" font-family="inherit" font-size="12" fill="var(--sv-muted)">绑定 / 导出状态</text>
<rect x="14" y="86" width="732" height="56" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="28" y="120" font-family="inherit" font-size="13" fill="var(--sv-ink)">int add(int, int);</text>
<text x="300" y="120" font-family="inherit" font-size="13" fill="var(--sv-a)">_Z3addii</text>
<text x="560" y="120" font-family="inherit" font-size="13" fill="var(--sv-ink)">GLOBAL  DEFAULT</text>
<rect x="14" y="150" width="732" height="56" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="28" y="184" font-family="inherit" font-size="13" fill="var(--sv-ink)">void foo::Bar::baz();</text>
<text x="300" y="184" font-family="inherit" font-size="13" fill="var(--sv-a)">_ZN3foo3Bar3bazEv</text>
<text x="560" y="184" font-family="inherit" font-size="13" fill="var(--sv-ink)">GLOBAL  DEFAULT</text>
<rect x="14" y="214" width="732" height="60" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="28" y="248" font-family="inherit" font-size="13" fill="var(--sv-ink)">extern "C" int plugin_get_v1();</text>
<text x="300" y="248" font-family="inherit" font-size="13" fill="var(--sv-a)">plugin_get_v1</text>
<text x="560" y="240" font-family="inherit" font-size="13" fill="var(--sv-ink)">GLOBAL  DEFAULT</text>
<text x="560" y="260" font-family="inherit" font-size="11" fill="var(--sv-muted)">只关修饰，可见性另设</text>
<line x1="14" y1="298" x2="746" y2="298" stroke="var(--sv-line)"/>
<text x="16" y="324" font-family="inherit" font-size="12" fill="var(--sv-muted)">修饰把命名空间、类与参数类型编码进符号；extern "C" 关闭修饰，给出稳定的 C 名字。</text>
<text x="16" y="348" font-family="inherit" font-size="12" fill="var(--sv-muted)">返回类型通常不参与普通函数的修饰：改返回类型可能链接成功，却读错值。</text>
</svg><figcaption>图 1 · 同一声明在符号表里的三种形态，以及绑定与可见性字段</figcaption></figure>
<p>符号表里还有两个独立字段值得记住：绑定（binding）与可见性（visibility）。GLOBAL 是普通导出绑定；WEAK 常见于 inline 函数、模板实例和 RTTI，多个目标文件出现同名弱符号时链接器只保留一份；LOCAL 只在本目标文件内可见。可见性另算：GLOBAL 符号若被标成 hidden，绑定仍然是 GLOBAL，但不会进入 <code>.dynsym</code>，其它 DSO 解析不到它。ELF 的 <code>.dynsym</code> 才是运行期动态链接器真正读取的表，<code>.symtab</code> 只服务静态链接与调试——<code>nm -D</code> 看前者，<code>nm</code> 看后者。</p>
</section>

<section class="sec"><h2>三、extern "C" 与符号可见性</h2>
<p><mark>extern "C"</mark> 给声明 C 语言链接（C language linkage）：关闭名字修饰、禁止重载；namespace 并不会被禁掉，只是不进入链接名，所以不同命名空间里的同名 extern "C" 函数会撞成同一个符号。它是 C++ 与 C、C++ 与插件、C++ 与 <code>dlsym</code> 之间的通用门。需要强调的是，它只改名字：结构体布局、分配器归属、异常与 RTTI 仍然按 C++ 的规则办。一个含 <code>std::string</code> 成员的 struct 即使挂在 extern "C" 函数上，跨边界依旧危险。</p>
<p>反方向同样常用：C 头文件给 C++ 使用时，用 <code>extern "C" { }</code> 包住声明，避免 C++ 编译器把 C 函数名修饰掉。几乎所有系统头文件都这么写，这也是为什么你调用 <code>malloc</code> 时不会看到 <code>_Z6mallocy</code>。</p>
<p><mark>符号可见性</mark>（symbol visibility）是另一根杠杆。ELF 默认把每个 GLOBAL 符号放进 <code>.dynsym</code>，任何 DSO 都能解析它，也可能被同名符号抢占。编译时给每个翻译单元加 <code>-fvisibility=hidden</code> 把默认改为隐藏，再给需要导出的函数与类加 <code>__attribute__((visibility("default")))</code>。收益很实际：动态符号表变小、加载更快、库内调用可以绕过 PLT、不同库之间的符号冲突显著减少。</p>
<p>Windows 没有 visibility 这一套，对应的是 <code>__declspec(dllexport)</code> 与 <code>__declspec(dllimport)</code>，通常靠一个构建期宏在两者之间切换。头文件里那对 BUILDING_MYLIB 宏，存在的理由就是这个。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>给类设 hidden visibility，会把它的 typeinfo 与 vtable 一起藏起来。两个 DSO 各自持有一份同名 hidden typeinfo 时，跨库的 <code>typeid</code> 与 <code>dynamic_cast</code> 是否还认得出同一个类型，就取决于实现如何比较 <code>type_info</code>，而不是标准承诺。稳妥做法是显式导出类型信息，或在边界上根本不依赖 RTTI。</div></div>
</section>

<section class="sec"><h2>四、动态库、soname 与加载过程</h2>
<p>链接时写 <code>-lfoo</code>，链接器找到的通常是开发用的符号链接 <code>libfoo.so</code>，读取其中的 DT_SONAME（shared object name），把 <code>libfoo.so.1</code> 写进可执行文件的 DT_NEEDED。运行期加载器找的是 soname，不是文件名。磁盘上的真实文件往往是 <code>libfoo.so.1.4.2</code>，<code>libfoo.so.1</code> 与 <code>libfoo.so</code> 都指向它。<code>-Wl,-soname,libfoo.so.1</code> 就是指定这个身份。</p>
<p>由此得到一条发布纪律：ABI 兼容的更新只改次版本号，soname 不动；ABI 不兼容时提升 soname，从 <code>libfoo.so.1</code> 到 <code>libfoo.so.2</code>，新旧版本可以共存，旧程序继续加载旧库。发行版打包时 soname 变了，包名通常也要跟着变（libfoo1 与 libfoo2），否则升级会直接打断已有程序。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="从 execve 到程序入口的动态链接加载流程">
<defs><marker id="abi-linking-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"/></marker></defs>
<text x="16" y="26" font-family="inherit" font-size="15" font-weight="600" fill="var(--sv-ink)">动态链接：从 execve 到 main 之前的六步</text>
<text x="16" y="50" font-family="inherit" font-size="12" fill="var(--sv-muted)">Linux x86-64，动态链接器 ld-linux-x86-64.so.2</text>
<rect x="20" y="70" width="220" height="78" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="34" y="96" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">① execve 启动</text>
<text x="34" y="118" font-family="inherit" font-size="12" fill="var(--sv-muted)">内核读 ELF 头，发现 PT_INTERP</text>
<text x="34" y="136" font-family="inherit" font-size="12" fill="var(--sv-muted)">把控制权交给解释器</text>
<rect x="270" y="70" width="220" height="78" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="284" y="96" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">② ld.so 接管</text>
<text x="284" y="118" font-family="inherit" font-size="12" fill="var(--sv-muted)">映射自身与主程序</text>
<text x="284" y="136" font-family="inherit" font-size="12" fill="var(--sv-muted)">建立初始链接映射</text>
<rect x="520" y="70" width="220" height="78" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="534" y="96" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">③ 读 PT_DYNAMIC</text>
<text x="534" y="118" font-family="inherit" font-size="12" fill="var(--sv-muted)">DT_NEEDED / SONAME</text>
<text x="534" y="136" font-family="inherit" font-size="12" fill="var(--sv-muted)">DT_RPATH / DT_RUNPATH</text>
<rect x="520" y="200" width="220" height="78" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="534" y="226" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">④ 递归加载依赖</text>
<text x="534" y="248" font-family="inherit" font-size="12" fill="var(--sv-muted)">按 soname 搜索并 mmap</text>
<text x="534" y="266" font-family="inherit" font-size="12" fill="var(--sv-muted)">广度优先，去重</text>
<rect x="270" y="200" width="220" height="78" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="284" y="226" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">⑤ 符号解析与重定位</text>
<text x="284" y="248" font-family="inherit" font-size="12" fill="var(--sv-muted)">填充 GOT；惰性或立即绑定</text>
<text x="284" y="266" font-family="inherit" font-size="12" fill="var(--sv-muted)">缺失符号在此暴露</text>
<rect x="20" y="200" width="220" height="78" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="34" y="226" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">⑥ 初始化后跳转</text>
<text x="34" y="248" font-family="inherit" font-size="12" fill="var(--sv-muted)">.init_array 按依赖顺序执行</text>
<text x="34" y="266" font-family="inherit" font-size="12" fill="var(--sv-muted)">最后进入程序入口</text>
<line x1="240" y1="109" x2="266" y2="109" stroke="var(--sv-line)" marker-end="url(#abi-linking-arrow)"/>
<line x1="490" y1="109" x2="516" y2="109" stroke="var(--sv-line)" marker-end="url(#abi-linking-arrow)"/>
<line x1="630" y1="148" x2="630" y2="196" stroke="var(--sv-line)" marker-end="url(#abi-linking-arrow)"/>
<line x1="520" y1="239" x2="494" y2="239" stroke="var(--sv-line)" marker-end="url(#abi-linking-arrow)"/>
<line x1="270" y1="239" x2="244" y2="239" stroke="var(--sv-line)" marker-end="url(#abi-linking-arrow)"/>
<text x="16" y="312" font-family="inherit" font-size="12" fill="var(--sv-ink)">搜索顺序：DT_RPATH → LD_LIBRARY_PATH → DT_RUNPATH → /etc/ld.so.cache → /lib、/usr/lib</text>
<text x="16" y="336" font-family="inherit" font-size="12" fill="var(--sv-muted)">DT_NEEDED 记录的是链接时读到的 SONAME，不是 -l 后面写的名字。</text>
<text x="16" y="360" font-family="inherit" font-size="12" fill="var(--sv-muted)">LD_DEBUG=libs,bindings 打印查找与绑定；-Wl,-z,now 让缺符号在启动时暴露。</text>
</svg><figcaption>图 2 · 动态链接器加载依赖、解析符号并执行初始化函数的顺序</figcaption></figure>
<p>搜索路径的优先级常被记反：<code>DT_RPATH</code>（仅在没有 <code>DT_RUNPATH</code> 时）最先，然后 <code>LD_LIBRARY_PATH</code>，再是 <code>DT_RUNPATH</code>，之后是 ldconfig 维护的 <code>/etc/ld.so.cache</code>，最后才是 <code>/lib</code>、<code>/usr/lib</code> 等默认目录。怀疑“加载了错误版本”时，用 <code>LD_DEBUG=libs,bindings ./app</code> 看它到底打开了哪个文件。</p>
<p>绑定可以延迟。默认的 PLT 加 GOT 机制在第一次调用时才解析目标地址；设置 <code>LD_BIND_NOW=1</code> 或链接时加 <code>-Wl,-z,now</code>，改为启动时一次性解析，配合 RELRO 还能提升安全性。对长时间运行的服务，立即绑定更划算：缺符号会在启动时直接失败，而不是在流量高峰的某个分支上才崩。</p>
</section>

<section class="sec"><h2>五、dlopen、版本脚本与符号版本</h2>
<p>插件与运行时扩展走 <code>dlopen</code> / <code>dlsym</code> / <code>dlclose</code>（POSIX；Windows 对应 LoadLibrary 与 GetProcAddress）。<code>RTLD_NOW</code> 立即解析，<code>RTLD_LAZY</code> 延迟；<code>RTLD_LOCAL</code> 把符号限制在本次加载的依赖组内，不加入全局作用域；<code>RTLD_GLOBAL</code> 则把它们加进去。不指定时默认是 RTLD_LOCAL，可以避免多个插件互相污染符号。dlclose 是引用计数，但只要有来自该库的对象还活着，就不能卸载——对象里的函数指针与 vtable 会在卸载后变成悬空地址。</p>
<p><mark>版本脚本</mark>（version script）同时做两件事：控制导出集合，给符号打版本节点。典型写法如下，链接时用 <code>-Wl,--version-script=foo.map</code> 引入：</p>
<pre class="code" data-lang="bash"><code>FOO_1.0 {
  global:
    plugin_get_v1;
    foo_*;
  local:
    *;
};</code></pre>
<p><code>local: *</code> 把其余符号全部隐藏，比逐个调整 visibility 更彻底，也更不容易漏。版本节点则让同一个符号名可以携带多个版本：<code>readelf --dyn-syms libfoo.so.1</code> 会显示 <code>foo@@FOO_2.0</code>（默认版本）与 <code>foo@FOO_1.0</code>（保留的旧版本，非默认版本）；GNU 扩展 <code>.symver</code> 指令可以把某个实现绑定到指定版本。</p>
<p>规则只有一条：版本节点只增不删、不改号。一旦删掉旧节点，按旧版本链接的程序会报 <code>version 'FOO_1.0' not found</code>，即使新库里明明还有同名函数。soname 与版本脚本要一起维护，前者决定运行期找哪个文件，后者决定文件里哪个符号算数。</p>
<div class="formula">SONAME 决定运行期加载哪个文件；DT_NEEDED 只记录 SONAME；版本节点只增不删。</div>
</section>

<section class="sec"><h2>六、C++ 特有的 ABI 地雷</h2>
<p>标准只规定可观察行为，不规定实现。对象布局（成员顺序、填充、基类子对象位置、空基类优化）、vtable 的槽位顺序与 RTTI 指针位置、虚继承的 thunk，全都由 ABI 决定。两个编译器对同一个类算出不同的 sizeof，链接不会报错，因为函数名照样匹配；错误被推迟到运行期，且往往以内存越界的形式出现。对象布局的规则在《对象布局、对齐与存储期》一篇展开，这里只关心它跨库后的后果。</p>
<p><mark>RTTI</mark> 的坑在于类型身份。默认可见性下，动态链接器会把多个 DSO 里的同名弱符号 typeinfo 合并成一份；即使没有合并，libstdc++ 的 <code>type_info::operator==</code> 也会先比名字指针、指针不同时再比较类型名字符串，所以跨库比较通常仍然成立。<mark>hidden</mark> 打破的正是这份默契：每个 DSO 各持一份 vtable 与 typeinfo 副本，类型身份变成依赖实现细节，而不是标准保证。用 <code>-fno-rtti</code> 编译的翻译单元不生成供 <code>dynamic_cast</code>/<code>typeid</code> 使用的 typeinfo（异常处理需要时仍会生成）；类若只在该库中定义，调用方对它做 <code>dynamic_cast</code> 或 <code>typeid</code> 就会在链接期缺符号。</p>
<p>异常更敏感。抛出与捕获跨越 DSO，要求同一套 unwinder 与兼容的异常表。libstdc++ 与 libc++ 在同一进程里混用，异常对象、typeinfo、分配器都可能对不上；用 <code>-fno-exceptions</code> 编译的代码不生成清理（landing pad）代码，异常穿过它时沿途的析构函数不会执行，标准层面是未定义行为，实践中往往先表现为资源泄漏，外层再无人捕获才会 <code>std::terminate</code>。跨 C ABI 边界传播 C++ 异常同样没有标准保证——C 代码不理解栈展开，只是两边恰好共用同一个 unwinder 时可能“碰巧”可用。正确做法是在边界处 catch 住，转成错误码返回。</p>
<p>STL 是最容易踩的一片。<code>std::string</code> 的布局随实现与 ABI 开关变化：libstdc++ 的 C++11 ABI（<code>_GLIBCXX_USE_CXX11_ABI=1</code>）与旧 ABI 的 string 是两种布局，符号名也不同（<code>std::__cxx11::basic_string</code>）。一边新一边旧时：<code>std::string</code> 若直接出现在函数签名里，修饰名不同，链接期就会报找不到 <code>std::__cxx11</code> 符号；若它只是藏在一个导出类的成员布局里，类名的修饰不含成员类型，链接能过，运行期却按两套布局读写同一块内存，表现为乱码或崩溃。MSVC 侧对应的是 <code>/MD</code> 与 <code>/MT</code>、Debug 与 Release、<code>_ITERATOR_DEBUG_LEVEL</code> 必须一致。<code>std::vector</code> 跨 DLL 传递还多一层所有权问题：在 A 侧分配、B 侧释放，若两边运行时不同，堆就直接坏了。</p>
<p>内联与模板把实现塞进了调用方。头文件里的 inline 函数体、函数模板、constexpr 函数，在每个翻译单元各自实例化，链接器靠弱符号合并。改了函数体却不重编调用方，调用方执行的仍是旧逻辑——这是 ODR 违反，标准层面未定义，实践层面表现为“代码明明改了却没生效”。ABI 稳定的库因此常把实现藏进 .cpp，用 pimpl 或纯虚接口切断裂缝。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="宿主与插件之间 ABI 边界上可安全跨越与易破裂的数据">
<text x="16" y="26" font-family="inherit" font-size="15" font-weight="600" fill="var(--sv-ink)">同一条 API，两侧不同的二进制现实</text>
<text x="16" y="50" font-family="inherit" font-size="12" fill="var(--sv-muted)">API 相同不代表 ABI 相同：布局、运行时与所有权都在头文件之外</text>
<rect x="20" y="90" width="150" height="210" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="95" y="120" text-anchor="middle" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">host 可执行文件</text>
<text x="95" y="150" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-muted)">编译参数 A</text>
<text x="95" y="176" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-muted)">标准库版本 X</text>
<text x="95" y="202" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-muted)">堆 A</text>
<text x="95" y="240" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-ink)">同一份头文件</text>
<text x="95" y="264" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-muted)">不同的 sizeof</text>
<rect x="590" y="90" width="150" height="210" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="665" y="120" text-anchor="middle" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">plugin.so</text>
<text x="665" y="150" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-muted)">编译参数 B</text>
<text x="665" y="176" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-muted)">标准库版本 Y</text>
<text x="665" y="202" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-muted)">堆 B</text>
<text x="665" y="240" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-ink)">同一个类名</text>
<text x="665" y="264" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-muted)">不同的 vtable</text>
<line x1="380" y1="72" x2="380" y2="310" stroke="var(--sv-line)" stroke-dasharray="6 5"/>
<rect x="240" y="98" width="280" height="36" rx="18" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="380" y="121" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-ink)">int、POD、不透明句柄 — 可安全跨越</text>
<rect x="240" y="146" width="280" height="36" rx="18" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="380" y="169" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-ink)">C 函数指针 + 版本号 — 可安全跨越</text>
<rect x="240" y="194" width="280" height="36" rx="18" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="380" y="217" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-ink)">std::string / std::vector — 危险</text>
<rect x="240" y="242" width="280" height="36" rx="18" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="380" y="265" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-ink)">异常、RTTI、inline 函数体 — 危险</text>
<text x="16" y="340" font-family="inherit" font-size="12" fill="var(--sv-muted)">把边界缩小到 C 类型、句柄与函数表，是插件系统最省事的稳定策略。</text>
<text x="16" y="364" font-family="inherit" font-size="12" fill="var(--sv-muted)">青色胶囊：可按值安全跨越；靛蓝胶囊：依赖实现细节，必须显式约定。</text>
</svg><figcaption>图 3 · ABI 兼容边界：哪些类型与设施能跨库，哪些必须留在同一侧</figcaption></figure>
</section>

<section class="sec"><h2>七、二进制兼容规则</h2>
<p>判断一次改动是否保持二进制兼容，只需问一句：旧的可执行文件不重新编译，能否继续正确使用新库？下表是最常见的变更清单，口径为 C++ 类与 Itanium 风格 ABI；其它平台细节不同，方向一致。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>变更</th><th>二进制兼容</th><th>原因</th></tr></thead><tbody>
<tr><td>新增非虚成员函数</td><td>是</td><td>不改变对象布局与已有符号</td></tr>
<tr><td>新增数据成员</td><td>否</td><td>sizeof 与成员偏移变化，按值传递、调用方分配都会错位</td></tr>
<tr><td>在 vtable 中间插入虚函数</td><td>否</td><td>后续槽位整体后移，旧调用方会调到错误的函数</td></tr>
<tr><td>在 vtable 末尾追加虚函数</td><td>有条件</td><td>已有槽位不变；但按旧头文件编译的派生类会把自身虚函数放在旧的末尾位置，新基类追加的槽位正好与它错位；类原本没有虚函数时还会新增 vptr、改变 sizeof</td></tr>
<tr><td>修改函数返回类型</td><td>危险</td><td>普通函数的修饰名通常不含返回类型，可能静默链接成功</td></tr>
<tr><td>删除或重命名导出符号</td><td>否</td><td>旧二进制按原名找不到符号</td></tr>
<tr><td>修改 inline 函数体或模板实现</td><td>否</td><td>旧调用方已把旧实现编进自己的目标文件</td></tr>
<tr><td>改变跨边界传递的 std 类型</td><td>否</td><td>布局、分配器与 ABI 开关都可能不同</td></tr>
<tr><td>修改默认参数值</td><td>可链接</td><td>默认值在调用方编译期展开，二进制能连上但语义已变</td></tr>
<tr><td>新增枚举值</td><td>通常可以</td><td>已有数值不变，除非代码假设了穷举</td></tr>
</tbody></table></div>
<p>返回类型那一行值得单独强调。Itanium 与 MSVC 对普通函数都不把返回类型编进符号名，两个版本可以同时链接成功，但调用方对返回值的解释不同：整型看 rax/eax，浮点看 xmm0，结构体还可能涉及隐藏指针。错读不会报错，只会得到垃圾值。因此改返回类型必须当作 ABI 破坏处理：提升 soname，或新增一个符号名。</p>
<p>真正稳的策略是 <mark>pimpl</mark>（pointer to implementation）：公开类只保留一个指向实现的指针与析构函数，所有成员与虚函数都藏在 .cpp 里。sizeof 恒定，加字段不用改头文件布局。代价是一次间接寻址和一次堆分配，热路径上要权衡。也可以用 C 风格的版本化结构体加预留字段，把“未来可能增加的东西”提前留出位置。C++ 没有语言级的 ABI 稳定性保证，稳定只能靠设计换。</p>
<div class="formula">二进制兼容 = 旧调用方无需重编 ∧ 新库可直接替换 ∧ 语义保持不变</div>
<div class="callout callout--tip"><span class="callout__label">建议</span><div>对外发布的库，把“导出什么”当成产品接口来管理：版本脚本或 visibility 白名单、明确的 soname、每次发布跑一遍 <code>abidiff old.so new.so</code>。让工具在 CI 里比对符号与类型布局，比等用户报崩溃便宜得多。</div></div>
</section>

<section class="sec"><h2>八、插件系统设计与排障</h2>
<p>插件边界只有两种可靠选择：C ABI，或受控的纯虚接口。C ABI 更稳：不透明句柄加函数指针表加版本号，谁分配谁释放。纯虚接口写起来舒服，但要求宿主与插件使用兼容的编译器、标准库与异常模型，适合“所有插件都由我们自己构建”的场景。下面是一个可直接编译的最小插件，C++20，Linux 下 GCC 或 Clang 均可。</p>
<pre class="code" data-lang="cpp"><code>// plugin_api.h
#pragma once
#include &lt;cstdint&gt;

extern "C" {

struct PluginV1 {
    std::uint32_t struct_size;   // 版本握手：先看大小再取字段
    const char* (*name)();
    int (*run)(int);
};

const PluginV1* plugin_get_v1();

}</code></pre>
<pre class="code" data-lang="cpp"><code>// plugin.cpp
#include "plugin_api.h"

namespace {
int run_impl(int x) { return x * 2; }
const char* name_impl() { return "doubler"; }

const PluginV1 kPlugin{ sizeof(PluginV1), &amp;name_impl, &amp;run_impl };
}

extern "C" const PluginV1* plugin_get_v1() { return &amp;kPlugin; }</code></pre>
<pre class="code" data-lang="cpp"><code>// host.cpp
#include "plugin_api.h"
#include &lt;dlfcn.h&gt;
#include &lt;cstdio&gt;

int main() {
    void* h = dlopen("./libplugin.so", RTLD_NOW | RTLD_LOCAL);
    if (!h) { std::fprintf(stderr, "%s\n", dlerror()); return 1; }

    auto get = reinterpret_cast&lt;const PluginV1* (*)()&gt;(
        dlsym(h, "plugin_get_v1"));
    if (!get) { std::fprintf(stderr, "%s\n", dlerror()); dlclose(h); return 2; }

    const PluginV1* p = get();
    if (!p) {
        std::fprintf(stderr, "plugin returned null\n");
        dlclose(h);
        return 3;
    }
    if (p-&gt;struct_size &lt; sizeof(PluginV1)) {
        std::fprintf(stderr, "ABI mismatch\n");
        dlclose(h);
        return 4;
    }
    std::printf("%s: %d\n", p-&gt;name(), p-&gt;run(21));
    dlclose(h);
}</code></pre>
<p>编译与运行：<code>g++ -std=c++20 -fPIC -shared plugin.cpp -o libplugin.so</code>，再 <code>g++ -std=c++20 host.cpp -ldl -o host</code> 后执行 <code>./host</code>。注意两点：把 <code>void*</code> 转成函数指针在 POSIX 上有明确保证，在 C++ 标准层面是条件支持；如果给插件加了 <code>-fvisibility=hidden</code>，必须给 <code>plugin_get_v1</code> 标上 default 可见性，否则 dlsym 找不到。</p>
<ul>
<li><b>版本握手</b>：结构体首字段放 struct_size 或 abi_version，宿主先校验再访问后续字段；只增字段，不重排。</li>
<li><b>内存归属</b>：分配与释放必须在同一侧。提供 destroy 函数，不跨边界传 STL 容器，也不让插件 new、宿主 delete。</li>
<li><b>异常不出界</b>：边界函数标 noexcept，内部 catch(...) 后转错误码；析构函数更不能向外抛。</li>
<li><b>初始化顺序</b>：dlopen 会先完成依赖与本库的静态初始化再返回；但如果宿主自己也在静态初始化阶段调用 dlopen，回调就可能碰到尚未构造的宿主对象，因此不要在静态初始化阶段回调宿主。</li>
<li><b>卸载</b>：确认没有存活对象与回调再 dlclose；长驻服务里干脆不卸载，换取简单。</li>
</ul>
<p>排障时先分清层级：链接期看符号，加载期看路径，运行期看版本与绑定。<code>nm -D --defined-only libfoo.so | c++filt</code> 查导出；<code>readelf -d libfoo.so</code> 查 SONAME 与 NEEDED；<code>readelf --dyn-syms libfoo.so</code> 查版本节点；<code>ldd ./app</code> 看实际依赖；<code>LD_DEBUG=libs,bindings ./app</code> 看查找与绑定；<code>abidiff old.so new.so</code> 在发布前比对 ABI。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>四个常见误判：以为加了 extern "C" 就 ABI 稳定（只稳定了名字）；以为静态库没有 ABI 问题（最终链接照样暴露，而且没有 soname 保护）；以为头文件没变就不用重编（inline 函数体与模板已经进了旧目标文件）；以为版本号可以随便改（soname 与版本脚本必须同步演进）。</div></div>
</section>

<section class="sec"><h2>九、自测</h2>
<details class="quiz"><summary>Q1 · 把 <code>int f(int)</code> 改成 <code>long f(int)</code>，调用方不重编，为什么可能链接成功却读错值？</summary><div class="quiz__a">普通函数的修饰名通常不包含返回类型，两边的符号都是同一个 <code>_Z1fi</code>，链接器认为匹配。System V AMD64 约定里整型返回值放在 rax：旧调用方按 int 只读 eax，新实现返回的 64 位值被截断；反过来，旧实现只保证 eax 有效，新调用方按 long 读整个 rax，高 32 位没有约定——常见实现中 32 位写入会把高位清零，负的 int 于是变成大正数。标准层面这本来就是未定义行为。修复方式是提升 soname 或新增符号名，而不是指望链接器发现。</div></details>
<details class="quiz"><summary>Q2 · 给函数加上 extern "C"，能不能让 <code>std::string</code> 安全地跨 DLL 传递？</summary><div class="quiz__a">不能。extern "C" 只关闭名字修饰并禁止重载，不改变 <code>std::string</code> 的布局、分配器、SSO 缓冲大小，也不改变谁负责释放。跨边界传 string 仍然要求两侧的标准库实现与 ABI 开关一致，并且明确所有权。要稳定，就在边界上改用 <code>const char*</code> 加长度，或由一侧提供分配与释放函数，把数据复制过去。</div></details>
<details class="quiz"><summary>Q3 · 只修改了头文件里一个 inline 函数的实现，重新编译库并替换 .so，为什么旧程序行为没变？</summary><div class="quiz__a">inline 函数体在调用方编译时就已经展开进它自己的目标文件，模板与 constexpr 函数同理。旧程序里根本不存在对库中该函数的调用，替换 .so 自然不影响它。更麻烦的是，如果同一个 inline 函数在旧程序与新库中定义不同，就构成 ODR 违反，标准层面未定义。ABI 稳定的库会把这类实现移出公开头文件，只留声明。</div></details>
<details class="quiz"><summary>Q4 · 新库明明还有 <code>foo</code> 函数，为什么旧程序加载时报 <code>version 'FOO_1.0' not found</code>？</summary><div class="quiz__a">旧程序在链接时记录了 foo 对 FOO_1.0 的版本需求（ELF 的 verneed 段），运行期要求新库提供同名同版本的符号。如果新库的版本脚本删掉了 FOO_1.0 节点，只把 foo 放进 FOO_2.0，即使函数名还在，版本匹配也失败。修复：版本节点只增不删，保留旧的实现或让旧节点指向兼容实现；确实不兼容时提升 soname，让旧程序继续加载旧库。</div></details>
</section>

<section class="sec"><h2>十、延伸阅读</h2>
<ul class="refs">
<li><b>Itanium C++ ABI</b> — Itanium C++ ABI 工作组。名字修饰、对象布局、异常与 RTTI 的权威规范，GCC 与 Clang 的事实依据。</li>
<li><b>Visibility — GCC Wiki</b> — GCC 社区。讲清 -fvisibility=hidden、导出宏与符号冲突的实际做法。</li>
<li><b>How To Write Shared Libraries</b> — Ulrich Drepper, 2011。动态链接、soname、版本脚本与加载性能的系统性长文。</li>
<li><b>libabigail / abidiff 文档</b> — Sourceware。用工具比对两个 .so 的符号与类型布局，适合接入 CI。</li>
<li><b>libstdc++ 手册：ABI Policy and Guidelines</b> — GCC 文档。讲清 dual ABI、版本化符号与 libstdc++ 自身的兼容承诺，是判断“这个改动能不能发”的第一手依据。</li>
<li><b>Calling Conventions for Different C++ Compilers and Operating Systems</b> — Agner Fog。逐平台对比参数传递、返回值与名字修饰，适合查证寄存器层面的细节。</li>
</ul>
</section>`
};
