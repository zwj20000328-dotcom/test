window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["build-to-run"] = {
  slug: "build-to-run",
  title: "从源码到进程",
  subtitle: "预处理、编译、汇编与链接",
  level: 0,
  cluster: "全景",
  tags: ["编译模型", "链接", "ELF"],
  summary: "C++ 源码到进程要经过预处理、编译、汇编、链接四级流水线。本篇讲清每级产物与错误边界，拆解目标文件的符号表与重定位，对比静态与动态链接的内存布局。",
  keyPoints: [
    "四个阶段各有独立产物，编译错误、链接错误与加载错误分属不同层级",
    "目标文件靠符号表与重定位描述未定地址，链接器负责符号解析与地址回填",
    "静态链接复制库代码，动态链接共享库页并在加载时完成重定位"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec"><h2>一、先建立一条流水线的心智模型</h2>
<p>很多人把「编译」理解成一个动作：按下构建按钮，源码变成程序。真实情况是四级流水线，每一级都有自己的输入、输出和错误类型：<mark>预处理</mark>把分散的文件拼成一个翻译单元，<mark>编译</mark>把它变成汇编，<mark>汇编</mark>把汇编变成目标文件，<mark>链接</mark>把多个目标文件和库拼成可执行文件。四级走完，操作系统才能把它加载成进程。</p>
<p>这个模型的价值不在名词，而在定位问题。语法错误只会出现在编译期；「undefined reference」只会出现在链接期；「找不到 libstdc++.so.6」只会出现在运行期。知道错误属于哪一级，就知道该看源码、看符号表，还是看运行环境，而不用在整条链上盲猜。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>编译器不是翻译官，而是流水线：每一站的半成品都留在磁盘上，随时可以停下来检查。</div></div>
<p>本篇口径：Linux x86-64，GCC 13 与 Clang 17，目标文件格式为 ELF。Windows 上对应的是 MSVC 的 PE/COFF，阶段划分相同，工具换成 cl.exe、dumpbin、link.exe；macOS 用 Mach-O，工具是 clang 与 otool。命令细节会变，流水线模型不变。</p>
</section>

<section class="sec"><h2>二、预处理：翻译单元是怎么拼出来的</h2>
<p>预处理（preprocessing）是纯文本操作，不做类型检查。#include 把被包含文件的全部内容原样插进来，宏做 token 级替换，#if、#ifdef 决定哪些行进入下一阶段。一个 .cpp 加上它递归包含的所有头文件，预处理后形成的单一 token 序列，就是一个<mark>翻译单元</mark>（translation unit，TU）。</p>
<p>这解释了一个常被误解的事实：编译器一次只看见一个 TU。main.cpp 里调用 add，只要见过 add 的声明就能通过编译，因为「有没有定义」不是编译期能回答的问题。同样，头文件里多一行 #include，可能让某个 TU 多出几千行代码和几十个符号，编译时间与符号冲突都随之变化。</p>
<p>用 <code>g++ -E</code> 可以把预处理结果落盘，这是排查宏展开与头文件来源最快的手段。.ii 文件里的行号和 # 标记，能直接指出某段代码来自哪个头文件的第几行。C++20 的模块（modules）试图用编译器级别的导入替代文本包含，但绝大多数存量工程仍是头文件模型，这里只作预告，细节不在本篇展开。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="C++ 源码到可执行文件的四阶段流水线及各阶段产物">
<defs><marker id="build-to-run-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"/></marker></defs>
<text x="16" y="26" font-family="inherit" font-size="15" font-weight="600" fill="var(--sv-ink)">四级流水线：每一级都有可检查的产物</text>
<text x="16" y="54" font-family="inherit" font-size="12" fill="var(--sv-muted)">输入：main.cpp + 头文件</text>
<rect x="14" y="66" width="160" height="76" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="94" y="90" text-anchor="middle" font-family="inherit" font-size="14" font-weight="600" fill="var(--sv-ink)">① 预处理</text>
<text x="94" y="110" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-muted)">g++ -E</text>
<text x="94" y="130" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-ink)">展开头文件 替换宏</text>
<rect x="204" y="66" width="160" height="76" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="284" y="90" text-anchor="middle" font-family="inherit" font-size="14" font-weight="600" fill="var(--sv-ink)">② 编译</text>
<text x="284" y="110" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-muted)">g++ -S</text>
<text x="284" y="130" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-ink)">语法语义检查 优化</text>
<rect x="394" y="66" width="160" height="76" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="474" y="90" text-anchor="middle" font-family="inherit" font-size="14" font-weight="600" fill="var(--sv-ink)">③ 汇编</text>
<text x="474" y="110" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-muted)">as / g++ -c</text>
<text x="474" y="130" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-ink)">助记符转机器码</text>
<rect x="584" y="66" width="160" height="76" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="664" y="90" text-anchor="middle" font-family="inherit" font-size="14" font-weight="600" fill="var(--sv-ink)">④ 链接</text>
<text x="664" y="110" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-muted)">ld / g++</text>
<text x="664" y="130" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-ink)">解析符号 回填地址</text>
<line x1="174" y1="104" x2="200" y2="104" stroke="var(--sv-line)" marker-end="url(#build-to-run-arrow)"/>
<line x1="364" y1="104" x2="390" y2="104" stroke="var(--sv-line)" marker-end="url(#build-to-run-arrow)"/>
<line x1="554" y1="104" x2="580" y2="104" stroke="var(--sv-line)" marker-end="url(#build-to-run-arrow)"/>
<text x="94" y="168" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-muted)">main.ii 仍是 C++ 文本</text>
<text x="284" y="168" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-muted)">main.s 汇编文本</text>
<text x="474" y="168" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-muted)">main.o ELF 可重定位文件</text>
<text x="664" y="168" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-muted)">a.out 可执行文件</text>
<line x1="14" y1="184" x2="744" y2="184" stroke="var(--sv-line)"/>
<text x="16" y="212" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">错误按阶段分层，排障先定位层级</text>
<rect x="14" y="226" width="230" height="66" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="28" y="250" font-family="inherit" font-size="12" fill="var(--sv-ink)">语法错误 类型不匹配</text>
<text x="28" y="272" font-family="inherit" font-size="12" fill="var(--sv-a)">编译期：单个 TU 内可判定</text>
<rect x="264" y="226" width="238" height="66" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="278" y="250" font-family="inherit" font-size="12" fill="var(--sv-ink)">undefined reference</text>
<text x="278" y="272" font-family="inherit" font-size="12" fill="var(--sv-b)">链接期：跨 TU 才可见</text>
<rect x="522" y="226" width="222" height="66" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="536" y="250" font-family="inherit" font-size="12" fill="var(--sv-ink)">找不到 .so 版本不符</text>
<text x="536" y="272" font-family="inherit" font-size="12" fill="var(--sv-c)">运行期：动态链接器报错</text>
<text x="16" y="326" font-family="inherit" font-size="12" fill="var(--sv-muted)">没有 LTO 时，编译阶段看不到其他 .cpp 的函数体，跨 TU 内联无从谈起；开启 LTO 后才推迟到链接阶段。</text>
<text x="16" y="350" font-family="inherit" font-size="12" fill="var(--sv-muted)">图中命令以 GCC 为例，Clang 同名选项行为一致；MSVC 对应 /P、/FA、/c 与 link.exe。</text>
</svg><figcaption>图 1 · 预处理、编译、汇编、链接四个阶段，以及各自产物与错误边界</figcaption></figure>
</section>

<section class="sec"><h2>三、编译与汇编：从 C++ 到机器码</h2>
<p>编译阶段做词法分析、语法分析、语义检查、模板实例化和优化，输出目标平台的汇编（assembly）。模板在编译期实例化，所以实例化爆炸发生在这里而不是链接期。没有链接时优化（link-time optimization，LTO）时，-O0 到 -O3 的优化只作用于这一阶段，编译器也看不到其他 TU 的函数体，跨文件内联无从谈起；开启 LTO 后，一部分优化与跨 TU 内联才推迟到链接期完成。</p>
<p>汇编阶段把助记符逐条翻译成机器码，并按用途放进目标文件的各个节。它几乎不做语义决策，只负责编码、登记符号和记录重定位。两个阶段可以分开触发，这在观察「C++ 到底被编译成了什么」时非常有用，也是 Compiler Explorer 展示的内容。</p>
<pre class="code" data-lang="bash"><code>g++ -std=c++20 -O2 -Wall -c main.cpp -o main.o        # 预处理 + 编译 + 汇编，停在 .o
g++ -std=c++20 -O2 -Wall -c math_utils.cpp -o math_utils.o
g++ -std=c++20 -O2 -Wall -S main.cpp -o main.s        # 停在汇编
g++ -std=c++20 -O2 -Wall -E main.cpp -o main.ii       # 停在预处理
g++ main.o math_utils.o -o app                        # 单独链接</code></pre>
<p>逐项解释这些常用选项：-std=c++20 固定语言版本，避免不同机器默认标准不一致；-O2 是多数发布构建的起点；-Wall 打开常用警告，许多链接问题在编译期已有征兆；-c 表示只生成目标文件；-g 加入调试信息；-fPIC 生成位置无关代码，动态库通常必需。下面这个例子把声明与定义分开，是理解 TU 与链接的最小模型，可直接用上面的命令编译。注意 square 定义在头文件里却不会重复定义，而 add 不行。</p>
<pre class="code" data-lang="cpp"><code>// math_utils.h
#pragma once
int add(int a, int b);                       // 只有声明，定义在 .cpp
int sum_squares(int a, int b);               // 只有声明，定义里会用到 square
inline int square(int x) { return x * x; }   // 显式 inline，允许多份定义

// math_utils.cpp
#include "math_utils.h"
int add(int a, int b) { return a + b; }
int sum_squares(int a, int b) { return square(a) + square(b); }

// main.cpp
#include &lt;iostream&gt;
#include "math_utils.h"

int main() {
    std::cout &lt;&lt; add(2, 3) &lt;&lt; ' ' &lt;&lt; square(4) &lt;&lt; ' ' &lt;&lt; sum_squares(2, 3) &lt;&lt; '\n';
    return 0;
}</code></pre>
<p>inline 函数允许多个 TU 各持有一份定义，但语言要求每份定义逐 token 相同；在 ELF 里这类定义表现为 weak 符号，链接器按 COMDAT 去重，只保留一份。add 若也定义在头文件里且不加 inline，两个包含它的 TU 就会各产生一个强定义，链接器只能报 multiple definition。这个「允许合并」的例外，正是下一节符号表要处理的对象。</p>
</section>

<section class="sec"><h2>四、目标文件：节、符号表与重定位</h2>
<p>目标文件（object file）是编译的最终产物，尚未确定任何绝对地址。ELF 把内容切成若干<mark>节</mark>（section），每个节有名字、类型、大小和文件偏移。链接器按节归并，加载器则按另一套「段」的视角映射内存。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>节</th><th>内容</th><th>占文件空间</th></tr></thead><tbody>
<tr><td><code>.text</code></td><td>机器指令</td><td>是</td></tr>
<tr><td><code>.rodata</code></td><td>只读常量、字符串字面量</td><td>是</td></tr>
<tr><td><code>.data</code></td><td>已初始化的非零全局与静态变量</td><td>是</td></tr>
<tr><td><code>.bss</code></td><td>零初始化的全局与静态变量</td><td>否，只记录大小</td></tr>
<tr><td><code>.symtab</code> / <code>.strtab</code></td><td>符号表与名字字符串表</td><td>是</td></tr>
<tr><td><code>.rela.text</code></td><td>代码段的重定位项</td><td>是</td></tr>
<tr><td><code>.debug_*</code></td><td>调试信息，编译时加 -g</td><td>是</td></tr>
</tbody></table></div>
<p>.bss 不占文件空间这件事有实际后果：声明一个百万字节的零初始化全局数组，可执行文件不会因此变大，但进程启动时仍要占用相应的虚拟地址空间，物理页直到首次访问才分配并清零。反过来，若写成带非零初值的数组，它进入 .data，二进制会直接膨胀。同理，把所有查找表塞进 .rodata 能让多个进程共享只读页，比运行期构造省内存。<mark>符号表</mark>（symbol table）记录每个符号的名字、绑定（LOCAL、GLOBAL、WEAK）、类型（FUNC、OBJECT）、所在节和偏移。在本 TU 内没有定义的符号标记为 UND，等链接器去别处找。<code>nm -C</code> 可以按可读形式列出这些条目，-C 表示 demangle，把 _Z3addii 还原成 add(int, int)。需要补充一点：inline 函数只有被某个 TU 实际 odr-use 时才在该 TU 里发射，并放进独立的 COMDAT 节（如 .text._Z6squarei），再由链接器去重；头文件里的 inline 定义如果从未被调用，就不会出现在符号表里。</p>
<p><mark>重定位</mark>（relocation）解决「编译时不知道地址」的问题。生成 call add 时，目标文件先在指令里填一个占位值，同时在 .rela.text 里记下：在 .text 的某个偏移处（例如 0x2a），对符号 add 应用 R_X86_64_PLT32 类型的修正。链接器确定 add 的最终地址后再回填。不同架构的重定位类型不同，上面是 x86-64 的写法，ARM64 与 RISC-V 各有自己的一套。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="ELF 目标文件的节布局、符号表与重定位项示意图">
<text x="16" y="26" font-family="inherit" font-size="15" font-weight="600" fill="var(--sv-ink)">一个 .o 的内部：节、符号表、重定位</text>
<rect x="16" y="42" width="270" height="292" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="30" y="64" font-family="inherit" font-size="12" font-weight="600" fill="var(--sv-ink)">math_utils.o（ELF 可重定位）</text>
<rect x="28" y="76" width="246" height="28" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="36" y="95" font-family="inherit" font-size="12" fill="var(--sv-ink)">ELF 头　类型 / 架构 / 节表偏移</text>
<rect x="28" y="108" width="246" height="28" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="36" y="127" font-family="inherit" font-size="12" fill="var(--sv-ink)">.text　add 等函数的指令</text>
<rect x="28" y="140" width="246" height="28" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="36" y="159" font-family="inherit" font-size="12" fill="var(--sv-ink)">.rodata　只读常量</text>
<rect x="28" y="172" width="246" height="28" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="36" y="191" font-family="inherit" font-size="12" fill="var(--sv-ink)">.data　非零初值全局变量</text>
<rect x="28" y="204" width="246" height="28" fill="var(--sv-bg)" stroke="var(--sv-line)" stroke-dasharray="4 3"/>
<text x="36" y="223" font-family="inherit" font-size="12" fill="var(--sv-ink)">.bss　零初值，仅记录大小</text>
<rect x="28" y="236" width="246" height="28" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="36" y="255" font-family="inherit" font-size="12" fill="var(--sv-ink)">.symtab / .strtab　符号与名字</text>
<rect x="28" y="268" width="246" height="28" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="36" y="287" font-family="inherit" font-size="12" fill="var(--sv-ink)">.rela.text　待回填的重定位</text>
<text x="30" y="320" font-family="inherit" font-size="12" fill="var(--sv-muted)">.debug_* 只在 -g 时出现，发布版可剥离</text>
<text x="306" y="64" font-family="inherit" font-size="12" font-weight="600" fill="var(--sv-ink)">符号表：名字、绑定、类型、位置、状态</text>
<rect x="306" y="74" width="438" height="112" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="320" y="96" font-family="inherit" font-size="12" fill="var(--sv-muted)">math_utils.o 的符号（nm -C）</text>
<text x="320" y="122" font-family="inherit" font-size="12" fill="var(--sv-ink)">add</text>
<text x="404" y="122" font-family="inherit" font-size="12" fill="var(--sv-ink)">GLOBAL FUNC</text>
<text x="530" y="122" font-family="inherit" font-size="12" fill="var(--sv-ink)">.text + 0x0</text>
<text x="646" y="122" font-family="inherit" font-size="12" fill="var(--sv-a)">已定义</text>
<text x="320" y="148" font-family="inherit" font-size="12" fill="var(--sv-ink)">square</text>
<text x="404" y="148" font-family="inherit" font-size="12" fill="var(--sv-ink)">WEAK FUNC</text>
<text x="530" y="148" font-family="inherit" font-size="12" fill="var(--sv-ink)">.text._Z6squarei</text>
<text x="646" y="148" font-family="inherit" font-size="12" fill="var(--sv-a)">用到才发射</text>
<text x="320" y="174" font-family="inherit" font-size="12" fill="var(--sv-ink)">.text 节符号</text>
<text x="404" y="174" font-family="inherit" font-size="12" fill="var(--sv-ink)">LOCAL</text>
<text x="530" y="174" font-family="inherit" font-size="12" fill="var(--sv-muted)">自身</text>
<text x="646" y="174" font-family="inherit" font-size="12" fill="var(--sv-muted)">不参与解析</text>
<rect x="306" y="196" width="438" height="114" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="320" y="218" font-family="inherit" font-size="12" fill="var(--sv-muted)">main.o 的符号（同一个 add 在这里没有定义）</text>
<text x="320" y="244" font-family="inherit" font-size="12" fill="var(--sv-ink)">main</text>
<text x="404" y="244" font-family="inherit" font-size="12" fill="var(--sv-ink)">GLOBAL FUNC</text>
<text x="530" y="244" font-family="inherit" font-size="12" fill="var(--sv-ink)">.text + 0x0</text>
<text x="646" y="244" font-family="inherit" font-size="12" fill="var(--sv-a)">已定义</text>
<text x="320" y="270" font-family="inherit" font-size="12" fill="var(--sv-ink)">add</text>
<text x="404" y="270" font-family="inherit" font-size="12" fill="var(--sv-b)">UND</text>
<text x="530" y="270" font-family="inherit" font-size="12" fill="var(--sv-muted)">无</text>
<text x="646" y="270" font-family="inherit" font-size="12" fill="var(--sv-b)">待链接解析</text>
<text x="320" y="296" font-family="inherit" font-size="12" fill="var(--sv-ink)">std::cout 等</text>
<text x="404" y="296" font-family="inherit" font-size="12" fill="var(--sv-b)">UND</text>
<text x="530" y="296" font-family="inherit" font-size="12" fill="var(--sv-muted)">来自 libstdc++</text>
<text x="306" y="338" font-family="inherit" font-size="12" font-weight="600" fill="var(--sv-ink)">重定位项（.rela.text）</text>
<text x="306" y="360" font-family="inherit" font-size="12" fill="var(--sv-ink)">偏移 0x2a　符号 add　类型 R_X86_64_PLT32　链接时写入 32 位相对偏移</text>
</svg><figcaption>图 2 · 目标文件的节布局，以及定义符号、未定义符号与重定位项如何描述一个跨文件调用（偏移与地址为示意值）</figcaption></figure>
<p><code>objdump -d -r -C main.o</code> 反汇编目标文件，-r 让重定位项以注释形式穿插在指令之间，能同时看到机器码、汇编和对哪个符号、按哪种类型回填；<code>readelf -S</code> 列出节表，<code>readelf -s</code> 列出符号表。这几个命令是理解「代码在文件里长什么样」的入口，比阅读任何描述都直接。</p>
</section>

<section class="sec"><h2>五、链接：符号解析与重定位</h2>
<p>链接器（linker，GNU 实现是 ld，通常由 g++ 驱动调用）只做两件事：<mark>符号解析</mark>，把每个 UND 符号找到唯一一份定义；<mark>重定位</mark>，把每个引用处的占位值替换成最终地址。找不到定义就报 undefined reference，找到多于一份强定义就报 multiple definition。注意这两类错误都发生在编译成功之后，源码里看不出任何问题。</p>
<p>静态链接把库代码直接复制进可执行文件。静态库 .a 本质是 .o 的归档（archive），链接器只抽取被引用到的成员，没用到的不进入最终产物。代价是每个可执行文件各带一份库代码，多个程序同时运行会重复占用物理内存；好处是部署简单，不依赖目标机器的库版本。</p>
<p>动态链接保留独立的共享库 .so。链接时只登记依赖（ELF 的 DT_NEEDED 条目）并生成跳转桩，真实地址在加载时才确定。多个进程可以共享同一份只读代码页（可写数据页则各进程独立），ABI 兼容时库升级不必重编所有程序；代价是启动时要运行动态链接器，部署时要保证版本匹配，还要面对符号可见性与插件式加载的复杂性。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>维度</th><th>静态链接</th><th>动态链接</th></tr></thead><tbody>
<tr><td>链接输入</td><td><code>.a</code> 归档，抽取被引用的 .o</td><td><code>.so</code>，登记 DT_NEEDED</td></tr>
<tr><td>库代码位置</td><td>复制进可执行文件</td><td>独立的库文件，运行时映射</td></tr>
<tr><td>地址确定时机</td><td>链接时</td><td>加载时（延迟绑定则在首次调用时）</td></tr>
<tr><td>磁盘与内存</td><td>每个程序各一份，体积大</td><td>多进程共享只读代码页</td></tr>
<tr><td>升级方式</td><td>重新链接发布</td><td>替换 .so，需保持 ABI 兼容</td></tr>
<tr><td>典型故障</td><td>库顺序、重复符号</td><td>库缺失、版本冲突、LD_LIBRARY_PATH</td></tr>
</tbody></table></div>
<p><code>ldd ./app</code> 列出运行时依赖，<code>nm -D</code> 查看共享库导出的动态符号，<code>readelf -d</code> 看 DT_NEEDED、RPATH 与 SONAME。需要提醒的是 ldd 会实际调用目标文件的动态链接器，在分析不可信二进制时有风险，更稳妥的是 <code>objdump -p</code> 或 <code>readelf -d</code>。常见链接问题有三类：声明存在但从未定义；库的顺序不对，GNU ld 默认从左到右扫描，被依赖的库要放在使用它的目标文件之后；C++ 名称修饰与 C 接口不匹配，extern "C" 就是为此存在。加上 -Wl,--start-group 或调整顺序能解决一部分循环依赖，但根治办法是理清模块依赖。</p>
</section>

<section class="sec"><h2>六、从 ELF 到进程：段与内存布局</h2>
<p>可执行文件里的「节」服务于链接器，运行时用的是「段」（segment），由程序头表（program header）描述。加载器只关心少数几个 LOAD 段：代码段映射为可读可执行，只读数据映射为只读，数据段映射为可读写。.bss 在这一步被展开成匿名零页，内容不来自文件。在此基础上，Linux x86-64 的典型进程地址空间从低到高依次是：可执行文件的代码与只读数据、可读写数据与 .bss、堆（heap，经 brk 向上增长）、共享库与 mmap 区域（通常向下增长）、栈（stack，从高地址向下增长），最顶部是内核空间。具体数值取决于是否 PIE 以及 ASLR 是否开启：非 PIE 可执行文件通常加载在 0x400000 附近，PIE 则每次随机。</p>
<p>动态链接的可执行文件还多一个环节：内核读取 PT_INTERP，先加载动态链接器（ld-linux-x86-64.so.2），由它把依赖的 .so 映射进 mmap 区、完成重定位、执行各库的初始化函数，最后把控制权交给可执行文件的入口（通常是 _start，再由启动代码调用 main）。这就是为什么程序还没进 main 就可能崩在加载阶段，也是「开发机正常、部署机起不来」的典型现场。</p>
<p>对外部函数的调用通常经过 PLT/GOT：第一次调用跳到解析桩，由动态链接器把真实地址填入全局偏移表（GOT），之后直接经 GOT 调用。这套延迟绑定（lazy binding）可以用 -z now 或环境变量 LD_BIND_NOW 改成加载时全部解析，配合 RELRO 提升安全性，代价是启动稍慢。现代发行版对安全敏感的二进制常默认启用。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="静态链接与动态链接进程内存布局对比">
<text x="16" y="26" font-family="inherit" font-size="15" font-weight="600" fill="var(--sv-ink)">同一份进程地址空间，两种链接方式</text>
<text x="60" y="48" font-family="inherit" font-size="12" fill="var(--sv-muted)">低地址</text>
<text x="60" y="368" font-family="inherit" font-size="12" fill="var(--sv-muted)">高地址</text>
<text x="96" y="66" text-anchor="middle" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">静态链接：自包含映像</text>
<rect x="30" y="76" width="250" height="46" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="42" y="96" font-family="inherit" font-size="12" fill="var(--sv-ink)">.text 代码（r-x）</text>
<text x="42" y="113" font-family="inherit" font-size="12" fill="var(--sv-muted)">含被复制进来的库函数</text>
<rect x="30" y="122" width="250" height="32" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="42" y="143" font-family="inherit" font-size="12" fill="var(--sv-ink)">.rodata（r--）</text>
<rect x="30" y="154" width="250" height="36" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="42" y="177" font-family="inherit" font-size="12" fill="var(--sv-ink)">.data / .bss（rw-）</text>
<rect x="30" y="190" width="250" height="50" fill="var(--sv-bg)" stroke="var(--sv-line)" stroke-dasharray="4 3"/>
<text x="42" y="212" font-family="inherit" font-size="12" fill="var(--sv-ink)">堆 heap ↑</text>
<text x="42" y="230" font-family="inherit" font-size="12" fill="var(--sv-muted)">brk / mmap 分配</text>
<rect x="30" y="240" width="250" height="58" fill="var(--sv-bg)" stroke="var(--sv-line)" stroke-dasharray="4 3"/>
<text x="42" y="264" font-family="inherit" font-size="12" fill="var(--sv-muted)">无共享库映射</text>
<text x="42" y="282" font-family="inherit" font-size="12" fill="var(--sv-muted)">库代码已在 .text 中</text>
<rect x="30" y="298" width="250" height="46" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="42" y="318" font-family="inherit" font-size="12" fill="var(--sv-ink)">栈 stack ↓</text>
<text x="42" y="335" font-family="inherit" font-size="12" fill="var(--sv-muted)">局部变量、返回地址</text>
<text x="96" y="360" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-muted)">一个文件装下全部依赖</text>
<text x="420" y="66" text-anchor="middle" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">动态链接：共享库单独映射</text>
<rect x="370" y="76" width="290" height="46" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="382" y="96" font-family="inherit" font-size="12" fill="var(--sv-ink)">主程序 .text（r-x）</text>
<text x="382" y="113" font-family="inherit" font-size="12" fill="var(--sv-muted)">调用先跳到 PLT 桩</text>
<rect x="370" y="122" width="290" height="32" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="382" y="143" font-family="inherit" font-size="12" fill="var(--sv-ink)">.rodata（r--）</text>
<rect x="370" y="154" width="290" height="36" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="382" y="177" font-family="inherit" font-size="12" fill="var(--sv-ink)">.data / .bss / .got.plt（rw-）</text>
<rect x="370" y="190" width="290" height="46" fill="var(--sv-bg)" stroke="var(--sv-line)" stroke-dasharray="4 3"/>
<text x="382" y="211" font-family="inherit" font-size="12" fill="var(--sv-ink)">堆 heap ↑</text>
<text x="382" y="228" font-family="inherit" font-size="12" fill="var(--sv-muted)">程序自己申请的内存</text>
<rect x="370" y="236" width="290" height="70" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="382" y="256" font-family="inherit" font-size="12" fill="var(--sv-ink)">共享库映射区</text>
<text x="382" y="275" font-family="inherit" font-size="12" fill="var(--sv-ink)">libstdc++.so.6 / libc.so.6</text>
<text x="382" y="293" font-family="inherit" font-size="12" fill="var(--sv-ink)">ld-linux-x86-64.so.2</text>
<rect x="370" y="306" width="290" height="40" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="382" y="324" font-family="inherit" font-size="12" fill="var(--sv-ink)">栈 stack ↓</text>
<text x="382" y="340" font-family="inherit" font-size="12" fill="var(--sv-muted)">启动参数、环境变量、调用帧</text>
<text x="420" y="366" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-muted)">库页只读，多进程可共享同一份物理内存</text>
<line x1="350" y1="76" x2="350" y2="346" stroke="var(--sv-line)"/>
</svg><figcaption>图 3 · 静态链接与动态链接的运行时内存布局对比，动态链接多出共享库映射区与 GOT/PLT</figcaption></figure>
<p>把这张图和上一节的节表对照起来看：.text 与 .rodata 常被合并映射为只读段，.data 与 .bss 合并为可读写段，页对齐会造成少量内部碎片。理解这一点，就能解释为什么把一个零初始化的全局变量改成非零初值，会让它从 .bss 迁到 .data、撑大文件映像；而新增一个零初始化变量只改变 .bss 记录的大小。</p>
</section>

<section class="sec"><h2>七、工程实践：头文件、ODR 与标准库实现</h2>
<p>把这条流水线用好的第一条纪律是：<b>声明放头文件，定义放源文件</b>。头文件被多个 TU 包含，任何非 inline 的外部链接函数定义、非 inline 的外部链接变量定义都会在链接期变成多份，触发 multiple definition。例外是 inline 函数、模板、类定义、constexpr 函数（C++11 起隐式 inline）和 inline 变量（C++17）。</p>
<p>这背后是<mark>单一定义规则</mark>（One Definition Rule，ODR）：一个实体在整个程序里只能有一份定义；inline 函数和模板允许多份，但必须逐 token 相同且语义一致。违反 ODR 最常见的表现不是链接错误，而是<b>静默的错误行为</b>：两个 TU 看到同一个类或 inline 函数的不同版本，各自按自己的布局编译，链接器无从发现。这类问题的完整讨论放在后续的对象模型篇，本篇只需记住：能放进头文件的东西，必须是「允许多份且完全一致」的东西。</p>
<p>第二条纪律是固定工具链与标准库实现。C++ 标准规定语义，不规定 ABI。Linux 上 GCC 默认用 libstdc++，Clang 可以选 libstdc++ 或 libc++；Windows 上 MSVC 用自家的 MSVC STL。三者的 std::string 布局、异常与 RTTI 实现、调试迭代器检查都可能不同。用一个标准库编译的目标文件去链接另一个标准库，轻则链接错误，重则运行期崩溃。</p>
<p>几个具体的坑：GCC 5 起引入新的 std::string ABI，旧库若以 _GLIBCXX_USE_CXX11_ABI=0 编译，与新代码混链会出现符号找不到；libc++ 把符号放进 std::__1 内联命名空间，与 libstdc++ 天然不互通；MSVC 的 _ITERATOR_DEBUG_LEVEL 在 Debug 与 Release 之间不一致时会直接拒绝链接，这是好事，至少不是静默错误。Linux 上 GCC 与 Clang 通常能互链，是因为两者遵循同一套 Itanium C++ ABI，但这不是标准保证，也不能推广到 MSVC。因此发布构建应记录：编译器与版本、-std、优化级别、标准库实现与版本、是否启用 LTO。这些信息决定二进制能否复现、能否与第三方库安全混链。构建系统如何固化这些参数，留给工程化篇的构建系统一节，本篇只强调它们的来源是这条流水线。</p>
</section>

<section class="sec"><h2>八、常见误区与排障顺序</h2>
<p>误区一：编译通过就认为代码正确。编译只证明每个 TU 内部自洽，定义是否存在、是否只有一份，要到链接期才知道。误区二：头文件里的函数加个 static 就能随便定义。static 给每个 TU 一份内部链接的副本，能过链接，但每个 TU 各有一份状态，全局计数器会退化成多个独立计数器。</p>
<p>误区三：改了头文件却只重编改动过的 .cpp。目标文件不记录自己依赖了哪些头文件，依赖跟踪是构建系统的职责（见构建系统篇），手工调用 g++ 时最容易踩。误区四：把 Debug 与 Release 的目标文件混在一起链接。优化级别、NDEBUG、迭代器调试级别都可能不同；MSVC 有时会靠链接器记录的不一致直接报错，GCC/Clang 通常不会，从标准看这是 ODR 违反，结果是未定义行为。</p>
<div class="callout callout--tip"><span class="callout__label">技巧</span><div>排障按流水线倒推：先判断错误属于哪一级。编译期看 .ii 里的宏展开与头文件来源；链接期用 nm -C 找 UND 符号、readelf -d 看依赖与 SONAME；运行期加载失败用 ldd 或 LD_DEBUG=libs 看动态链接器搜索了哪些路径。</div></div>
<p>还有一类隐蔽问题：符号被意外隐藏或删除。-fvisibility=hidden 与版本脚本能减少导出符号、加快加载，但漏标导出会让插件在运行期找不到入口；链接器垃圾回收（--gc-sections）会删掉未被引用的节，包括只靠动态查找才会用到的符号。遇到「静态链接正常、动态加载失败」，先检查符号可见性，而不是怀疑编译器。</p>
<div class="formula">一个 .cpp + 它递归包含的头文件 = 一个翻译单元（TU）
编译以 TU 为单位，链接以符号为单位
可执行文件 = 被引用的 .o ∪ 库代码 ∪ 重定位后的地址</div>
</section>

<section class="sec"><h2>九、自测</h2>
<details class="quiz"><summary>Q1 · 把 math_utils.h 里 square 前面的 inline 去掉，会发生什么？</summary><div class="quiz__a">square 变成普通的外部链接函数，两个包含该头文件的 TU 各产生一份强定义，链接器报 multiple definition。若只有一个 TU 包含它，则不会报错，这也正是问题容易被漏掉的原因。修复方式是把定义移回 .cpp，或保留 inline。由此可以反推：头文件里能安全放置的函数定义，必须属于「允许多份定义」的类别。</div></details>
<details class="quiz"><summary>Q2 · 一个 1 MB 的零初始化全局数组，会让可执行文件变大吗？</summary><div class="quiz__a">不会。它进入 .bss，文件里只记录符号和大小，加载时只保留虚拟地址区间，物理页直到首次访问才分配并清零。若给它非零初值，则进入 .data，这 1 MB 会实际写进文件。这个区别在嵌入式与分发场景很实用：把大缓冲声明为零初始化，既不影响二进制体积，也不增加磁盘 IO。</div></details>
<details class="quiz"><summary>Q3 · 程序在开发机正常，部署机报 error while loading shared libraries: libfoo.so.1，属于哪一级问题？</summary><div class="quiz__a">运行期的动态链接问题。可执行文件的 DT_NEEDED 记录了 SONAME，但目标机器没有该库，或它不在搜索路径里。排查顺序：readelf -d 看依赖与 RPATH，ldd 看解析结果，检查 LD_LIBRARY_PATH、/etc/ld.so.conf 与 ldconfig 缓存。修复方向有两种：补齐正确版本的库，或改为静态链接、随包携带库并设置 RPATH。注意这不是编译器或源码的问题。</div></details>
<details class="quiz"><summary>Q4 · 两个 TU 里同一个 inline 函数定义不同，链接器会报错吗？</summary><div class="quiz__a">通常不会。ODR 要求 inline 定义逐 token 相同，违反属于未定义行为。链接器只保留其中一份，程序行为取决于哪份被选中，可能随优化级别、链接顺序甚至文件系统顺序变化。GCC 在开启 LTO 时可用 -Wodr 给出部分诊断，但不要指望链接器兜底。可靠的防线是：头文件里的定义保持极简，不依赖 TU 内的宏或条件编译分支。</div></details>
</section>

<section class="sec"><h2>十、延伸阅读</h2>
<ul class="refs">
<li><b>cppreference「Translation units」与「Phases of translation」</b> — cppreference.com。标准规定的翻译阶段与 TU 边界，查条款时的第一站。</li>
<li><b>GCC 官方文档</b> — Free Software Foundation。g++ 选项、链接选项与 C++ ABI 策略的完整说明，含 -fabi-version 与 dual ABI 的来龙去脉。</li>
<li><b>Clang 官方文档</b> — LLVM Project。Clang 驱动、libc++ 设计与工具链行为的权威来源。</li>
<li><b>《Linkers and Loaders》</b> — John R. Levine, Morgan Kaufmann, 2000。链接与加载的经典教材，ELF 与重定位章节至今仍是最好入门的材料。</li>
<li><b>Compiler Explorer</b> — godbolt.org。实时查看不同编译器、不同优化级别下的汇编输出，把本篇的流水线变成可动手的实验。</li>
</ul>
</section>`
};
