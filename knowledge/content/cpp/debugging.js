window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["debugging"] = {
  slug: "debugging",
  title: "调试：gdb、lldb 与崩溃分析",
  subtitle: "从现象回到最小复现",
  level: 5,
  cluster: "工程化",
  tags: ["gdb", "core dump", "调试"],
  summary: "以复现、定位、最小化、验证的闭环为主线，讲清 gdb 与 lldb 的断点、观察点与栈回溯，core dump 分析、反向调试边界和日志调试纪律。",
  keyPoints: [
    "调试是闭环：先让失败可重复，再用可证伪的假设驱动观测，最后最小化并固化为回归测试",
    "断点决定停在哪里，观察点回答谁改了内存；栈回溯与 core dump 把崩溃现场还原成调用链",
    "符号匹配、优化级别与构建指纹决定分析是否可信，工具选择服从问题类型"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec"><h2>一、调试是闭环，不是猜谜</h2>
<p>很多人把调试理解成盯着一屏代码找可疑行，找到就改，改完再跑。这种做法偶尔有效，但它依赖运气，遇到并发或内存问题时几乎必然失效。工程化的调试是一个闭环：<mark>复现</mark>（reproduce）、<mark>定位</mark>（locate）、<mark>最小化</mark>（minimize）、<mark>验证</mark>（verify）。四步缺一不可，顺序也不能跳。</p>
<p>闭环成立的前提是一个工作假设：绝大多数 bug 是确定性的。同一个二进制、同一份输入、同一套环境变量，失败应该可以重复。如果暂时不能重复，那说明还有未控制的变量，例如时间、随机种子、线程调度、外部服务或未初始化内存。把这些变量固定住，本身就是调试的一半工作。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>bug 是「输入与环境」到「错误状态」的一个函数。调试不是盯着函数体发呆，而是设计实验，把自变量一个个固定住。</div></div>
<p>复现要脚本化：一条命令能从干净环境触发失败，并记录退出码、信号、标准错误与关键日志。定位要提出可证伪的假设，例如「如果 this 是空指针，那么回溯第三帧的 this 应为 0」，然后设计一次观测去证实或推翻。最小化去掉与失败无关的输入、线程和配置。验证是修复后同一脚本通过，并固化为回归测试。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="调试闭环：复现、定位、最小化、验证四个阶段的循环">
<defs><marker id="debugging-loop-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"/></marker></defs>
<text x="16" y="28" font-family="inherit" font-size="15" font-weight="600" fill="var(--sv-ink)">调试闭环：每一轮只回答一个问题</text>
<rect x="55" y="65" width="250" height="105" rx="10" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="75" y="96" font-family="inherit" font-size="15" font-weight="600" fill="var(--sv-ink)">1 · 复现</text>
<text x="75" y="122" font-family="inherit" font-size="12" fill="var(--sv-ink)">固定二进制、输入、环境</text>
<text x="75" y="144" font-family="inherit" font-size="12" fill="var(--sv-muted)">输出：一条可重复的命令</text>
<rect x="455" y="65" width="250" height="105" rx="10" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="475" y="96" font-family="inherit" font-size="15" font-weight="600" fill="var(--sv-ink)">2 · 定位</text>
<text x="475" y="122" font-family="inherit" font-size="12" fill="var(--sv-ink)">提出可证伪的假设</text>
<text x="475" y="144" font-family="inherit" font-size="12" fill="var(--sv-muted)">用断点、回溯、日志观测</text>
<rect x="455" y="235" width="250" height="105" rx="10" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="475" y="266" font-family="inherit" font-size="15" font-weight="600" fill="var(--sv-ink)">3 · 最小化</text>
<text x="475" y="292" font-family="inherit" font-size="12" fill="var(--sv-ink)">删输入、删线程、删配置</text>
<text x="475" y="314" font-family="inherit" font-size="12" fill="var(--sv-muted)">失败现象必须保持不变</text>
<rect x="55" y="235" width="250" height="105" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="75" y="266" font-family="inherit" font-size="15" font-weight="600" fill="var(--sv-ink)">4 · 验证</text>
<text x="75" y="292" font-family="inherit" font-size="12" fill="var(--sv-ink)">修复后重跑同一脚本</text>
<text x="75" y="314" font-family="inherit" font-size="12" fill="var(--sv-muted)">沉淀为回归测试</text>
<line x1="305" y1="117" x2="443" y2="117" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#debugging-loop-arrow)"/>
<line x1="580" y1="170" x2="580" y2="225" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#debugging-loop-arrow)"/>
<line x1="455" y1="287" x2="317" y2="287" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#debugging-loop-arrow)"/>
<line x1="180" y1="235" x2="180" y2="180" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#debugging-loop-arrow)"/>
<text x="330" y="196" font-family="inherit" font-size="12" fill="var(--sv-muted)">同一现象</text>
<text x="330" y="216" font-family="inherit" font-size="12" fill="var(--sv-muted)">才算同一问题</text>
<text x="16" y="368" font-family="inherit" font-size="12" fill="var(--sv-muted)">任何一步没有收敛，就回到上一格，而不是继续往下猜。</text>
</svg><figcaption>图 1 · 调试闭环：复现锁定现象，定位缩小范围，最小化排除干扰，验证防止回归</figcaption></figure>
<p>成本结构值得单独说。一次调试的总成本近似等于「复现成本 × 尝试次数 + 定位成本 + 验证成本」。不可复现时，每次尝试都要重新碰运气，复现项从加法变成乘法。把复现概率从百分之一提到百分之百，通常比读一百遍代码更有效。对并发 bug，可以用录制回放把概率问题变成确定性问题，第六节展开。</p>
<div class="formula">调试总成本 ≈ 复现成本 × 尝试次数 + 定位成本 + 验证成本
最小复现 = 输入 ↓ + 线程 ↓ + 配置 ↓ + 代码路径 ↓，且失败现象不变</div>
</section>

<section class="sec"><h2>二、先让程序可调试：构建与符号</h2>
<p>调试能力首先由构建决定，而不是由调试器决定。没有 <code>-g</code> 就没有行号、变量名与类型信息，调试器只能给你一堆地址。发布构建常被 strip 掉符号，因此正规团队会保存一份带符号的构建，或用 build-id 把符号归档关联。</p>
<p>优化级别直接影响观感。<code>-O0</code> 最接近源码，变量都在栈上；<code>-Og</code> 在保留可调试性的同时做基础优化，适合日常开发；<code>-O2</code> 与 <code>-O3</code> 会内联、寄存器化、重排指令，于是 print 常看到 optimized out，next 会一次跨过好几行，断点可能落在意料之外的位置。生产事故往往只有 Release 二进制，所以要练会在优化代码上调试：看寄存器、看反汇编、把断点打在函数入口。</p>
<p>几个开关值得写进构建配置：<code>-fno-omit-frame-pointer</code> 保留帧指针，采样分析与部分栈展开工具更省事（x86-64 上 -O2 默认省略，DWARF 的 CFI 仍能展开，但不是所有工具都愿意读）；<code>-g3</code> 额外记录宏定义；<code>-gsplit-dwarf</code> 把调试信息拆到 .dwo 文件，减小二进制；<code>-D_GLIBCXX_ASSERTIONS</code> 打开 libstdc++ 的轻量运行时检查（例如 <code>operator[]</code> 的下标与迭代器范围断言），不改变 ABI。Sanitizer 见第七节。</p>
<div class="callout callout--warn"><span class="callout__label">警告</span><div><code>-D_GLIBCXX_DEBUG</code> 会改变容器的布局与符号命名，只能整程序统一开启。把它编译的目标文件与普通编译的库混链，轻则报链接错误，重则静默链上并在运行期因违反 ODR 变成未定义行为——不要指望链接器一定拦得住。</div></div>
<p>还要记录构建指纹：编译器与版本、<code>-std</code>、优化级别、标准库实现、目标架构，以及链接器写入的 build-id（<code>readelf -n</code> 可查）。core 文件与二进制必须来自同一次构建，否则行号会错位，栈帧会指向不存在的函数，分析结论全部作废。</p>
</section>

<section class="sec"><h2>三、断点、条件断点与观察点</h2>
<p>断点是最基本的观测工具，但真正决定效率的是「停在哪里」。函数断点用于确认调用是否发生；行断点用于检查具体语句；临时断点（gdb 的 <code>tbreak</code>）只命中一次，适合「只想看第一次进入」。模板函数与内联函数可能有多个实例，调试器会提示多个位置；尚未加载的共享库里的符号则会挂起为 pending 断点，等库加载后再生效。</p>
<p>条件断点把筛选交给调试器，例如 <code>break process if id == 42</code>。代价是每次命中都要评估表达式，在百万次循环里可能慢上数量级。更实用的做法是用 <code>ignore N</code> 跳过前 N 次，或用 <code>commands</code> 配置 <code>silent</code>、<code>printf</code>、<code>continue</code>，把断点变成一次性的结构化日志。</p>
<p>观察点（watchpoint）解决另一类问题：不是「执行到哪」，而是「谁改了我的变量」。<code>watch</code> 在写入时停，<code>rwatch</code> 在读取时停，<code>awatch</code> 读写都停。它绑定的是内存地址而非变量名，变量离开作用域后观察点会失效或监视到被复用的栈槽。x86-64 通常只有 4 个硬件调试寄存器（DR0 到 DR3），超过后 gdb 会退化为软件单步加表达式重算，速度骤降。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;cstddef&gt;
#include &lt;cstdio&gt;
#include &lt;vector&gt;

struct Sample {
    int id;
    double value;
};

double average(const std::vector&lt;Sample&gt;&amp; xs) {
    double sum = 0.0;
    for (std::size_t i = 0; i &lt;= xs.size(); ++i) {   // 越界：应为 i &lt; xs.size()
        sum += xs.at(i).value;                        // at() 抛 std::out_of_range
    }
    return sum / static_cast&lt;double&gt;(xs.size());
}

int main() {
    std::vector&lt;Sample&gt; xs{{1, 1.0}, {2, 2.0}, {3, 3.0}};
    std::printf("avg = %.3f\n", average(xs));
}
</code></pre>
<p>上面这段代码在 C++20 模式下可以完整编译（它本身并没有用到 C++20 的新特性，用 C++11 起即可），循环条件多了一个等号，<code>at()</code> 会在 i 等于 size 时抛出 std::out_of_range。用调试器抓抛出点，比读代码更快：异常抛出时栈上还保留着越界那一刻的 i 与容器大小。注意抛异常的不是解引用本身——<code>at()</code> 先做范围检查，所以这段是良定义的抛异常，而不是未定义行为，这也正是它适合做调试靶子的原因。</p>
<pre class="code" data-lang="bash"><code>g++ -std=c++20 -g -O0 -fno-omit-frame-pointer avg.cpp -o avg
gdb -q ./avg
(gdb) catch throw
(gdb) run
(gdb) bt
(gdb) frame 3          # 帧号以 bt 输出为准：找到 average 所在帧
(gdb) print i
(gdb) print xs.size()
(gdb) info args
</code></pre>
<p>lldb 的语义相同，命令拼写不同。下表只列常用对应关系，不追求穷举；真正要记的是「动作」，命令可以查。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>动作</th><th>gdb</th><th>lldb</th></tr></thead><tbody>
<tr><td>启动程序</td><td><code>run</code></td><td><code>run</code></td></tr>
<tr><td>行断点</td><td><code>break avg.cpp:13</code></td><td><code>breakpoint set -f avg.cpp -l 13</code></td></tr>
<tr><td>条件断点</td><td><code>break f if x == 42</code></td><td><code>breakpoint set -n f -c "x == 42"</code></td></tr>
<tr><td>观察点</td><td><code>watch sum</code></td><td><code>watchpoint set variable sum</code></td></tr>
<tr><td>栈回溯</td><td><code>bt</code></td><td><code>bt</code> / <code>thread backtrace all</code></td></tr>
<tr><td>切换帧</td><td><code>frame 2</code></td><td><code>frame select 2</code></td></tr>
<tr><td>查看变量</td><td><code>print x</code> / <code>info locals</code></td><td><code>frame variable x</code></td></tr>
<tr><td>附加进程</td><td><code>gdb -p PID</code></td><td><code>process attach -p PID</code></td></tr>
<tr><td>加载 core</td><td><code>gdb ./prog core</code></td><td><code>lldb -c core ./prog</code></td></tr>
</tbody></table></div>
</section>

<section class="sec"><h2>四、栈回溯与帧：回答「怎么走到这里」</h2>
<p>栈回溯（backtrace）把当前调用链从内到外列出来，frame 0 是正在执行的函数。切换帧（<code>frame N</code>）之后，<code>info args</code> 看参数，<code>info locals</code> 看局部变量，<code>info frame</code> 看这一帧保存的寄存器、参数位置与栈范围，<code>x/16gx $rsp</code> 直接看栈内存。多线程程序先 <code>info threads</code>，再 <code>thread apply all bt full</code>，拿到所有线程现场，死锁线索通常就在里面。</p>
<p>理解帧结构能避免误读。以 Linux x86-64 的 System V AMD64 ABI 为例：前 6 个整数或指针参数放在 rdi、rsi、rdx、rcx、r8、r9，前 8 个浮点参数放在 xmm0 到 xmm7，多余参数才压栈。call 指令把返回地址压栈；被调函数通常执行 <code>push rbp</code> 与 <code>mov rbp, rsp</code>，再用 <code>sub rsp, N</code> 分配局部空间。因此 rbp 指向保存的调用者 rbp，rbp 加 8 的位置是返回地址。叶子函数还可能使用栈顶以下的 128 字节红区（red zone），不调整 rsp，中断或信号处理会尊重这段区域。</p>
<p>必须强调：以上全部是平台 ABI 与编译器实现的约定，不是 C++ 标准的规定。标准只约束对象语义与可观察行为，不保证栈帧布局、寄存器用法、参数传递顺序，也不保证一定存在帧指针。换编译器、换目标平台（例如 Windows x64 的调用约定）或换优化级别，细节都会变；调试时以手头二进制的实际指令为准，不要把某套 ABI 当作跨平台真理。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="x86-64 System V 栈帧结构：返回地址、保存的 rbp、局部变量与 rsp 的位置">
<defs><marker id="debugging-frame-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"/></marker></defs>
<text x="16" y="26" font-family="inherit" font-size="15" font-weight="600" fill="var(--sv-ink)">System V AMD64 栈帧：高地址在上，栈向低地址增长</text>
<text x="16" y="48" font-family="inherit" font-size="12" fill="var(--sv-muted)">调用者的帧在更高地址处，本帧由 rbp 与 rsp 框定</text>
<rect x="250" y="62" width="260" height="36" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="262" y="85" font-family="inherit" font-size="12" fill="var(--sv-ink)">栈上传参（第 7 个整数起）</text>
<rect x="250" y="98" width="260" height="42" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="262" y="124" font-family="inherit" font-size="13" fill="var(--sv-ink)">返回地址 return address</text>
<rect x="250" y="140" width="260" height="42" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="262" y="166" font-family="inherit" font-size="13" fill="var(--sv-ink)">保存的调用者 rbp（帧链）</text>
<rect x="250" y="182" width="260" height="108" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="262" y="208" font-family="inherit" font-size="13" fill="var(--sv-ink)">局部变量 / 临时对象</text>
<text x="262" y="232" font-family="inherit" font-size="12" fill="var(--sv-ink)">溢出寄存器保存区</text>
<text x="262" y="256" font-family="inherit" font-size="12" fill="var(--sv-muted)">对齐填充、编译器临时槽</text>
<rect x="250" y="290" width="260" height="42" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="262" y="316" font-family="inherit" font-size="12" fill="var(--sv-ink)">red zone：叶子函数可用 128 B</text>
<line x1="540" y1="161" x2="620" y2="161" stroke="var(--sv-b)" stroke-width="2" marker-end="url(#debugging-frame-arrow)"/>
<text x="628" y="158" font-family="inherit" font-size="13" fill="var(--sv-ink)">rbp</text>
<text x="628" y="176" font-family="inherit" font-size="11" fill="var(--sv-muted)">rbp+8 是返回地址</text>
<line x1="540" y1="311" x2="620" y2="311" stroke="var(--sv-a)" stroke-width="2" marker-end="url(#debugging-frame-arrow)"/>
<text x="628" y="308" font-family="inherit" font-size="13" fill="var(--sv-ink)">rsp</text>
<text x="628" y="326" font-family="inherit" font-size="11" fill="var(--sv-muted)">当前栈顶</text>
<text x="16" y="90" font-family="inherit" font-size="12" fill="var(--sv-muted)">rdi rsi rdx</text>
<text x="16" y="110" font-family="inherit" font-size="12" fill="var(--sv-muted)">rcx r8 r9</text>
<text x="16" y="130" font-family="inherit" font-size="12" fill="var(--sv-muted)">xmm0–xmm7</text>
<text x="16" y="154" font-family="inherit" font-size="11" fill="var(--sv-muted)">前 6 个整数参数</text>
<text x="16" y="172" font-family="inherit" font-size="11" fill="var(--sv-muted)">走寄存器，不占栈</text>
<text x="16" y="356" font-family="inherit" font-size="11" fill="var(--sv-muted)">编译优化、尾调用、栈破坏都会让回溯失真，需结合寄存器和指令判断。</text>
</svg><figcaption>图 2 · x86-64 栈帧：返回地址、帧指针与局部变量的相对位置，决定了回溯能还原多少信息</figcaption></figure>
<p>优化、尾调用与栈破坏会让回溯失真。缺符号时帧显示问号，可以用 <code>addr2line -e prog -f -C 0x地址</code> 还原函数与行号，或用 <code>info symbol 0x地址</code> 查找覆盖该地址的最近符号。内联函数不会单独成帧，调试器只能显示为被内联到的调用者，并额外标注 inline 帧；这不是 bug，而是优化后的真实形态。</p>
<p>还要对栈上的数值保持警惕：局部变量所在的内存可能已被复用，优化后的变量可能只存在于寄存器。判断「这个指针是不是空」，应结合当前指令、寄存器与 <code>info frame</code>，而不是只看源码里的名字。</p>
</section>

<section class="sec"><h2>五、core dump：把崩溃现场带回来</h2>
<p>core dump 是进程崩溃瞬间的内存快照，包含寄存器、栈、内存映射、信号与线程状态；具体收录哪些内存区域还受 <code>/proc/PID/coredump_filter</code> 控制，默认并不总是包含全部文件映射或共享映射。Linux 上先用 <code>ulimit -c unlimited</code> 解除大小限制，落盘位置与命名由 <code>/proc/sys/kernel/core_pattern</code> 决定。很多发行版把它管道给 systemd-coredump 或 apport，此时用 <code>coredumpctl list</code> 找到记录，再用 <code>coredumpctl gdb PID</code> 直接加载。容器里要特别注意：core_pattern 是宿主机全局设置，容器内改了未必生效。</p>
<p>分析入口是 <code>gdb ./prog core</code>，或 <code>gdb -c core ./prog</code>。第一步 <code>bt</code> 看崩溃点，第二步 <code>info registers</code> 看 rip 与故障相关寄存器，第三步 <code>x/i $rip</code> 看正在执行的指令，第四步 <code>frame N</code> 切到自己的业务帧，再用 <code>print</code>、<code>x/</code> 检查对象状态，最后 <code>info sharedlibrary</code> 确认当时加载了哪些共享库，必要时再用 build-id 对应到具体版本。SIGSEGV 的常见根因是空指针解引用、越界访问、释放后使用与栈溢出；SIGABRT 多来自断言失败、显式 abort 或未捕获异常导致的 terminate。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="core dump 分析流程：崩溃信号、内核转储、加载符号、定位故障帧、还原现场、最小复现">
<defs><marker id="debugging-core-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"/></marker></defs>
<text x="16" y="28" font-family="inherit" font-size="15" font-weight="600" fill="var(--sv-ink)">core dump 分析流程：从信号到可复现的根因</text>
<rect x="20" y="60" width="210" height="82" rx="8" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="34" y="88" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">1 · 崩溃信号</text>
<text x="34" y="110" font-family="inherit" font-size="11" fill="var(--sv-ink)">SIGSEGV / SIGABRT</text>
<text x="34" y="129" font-family="inherit" font-size="11" fill="var(--sv-muted)">记录退出码与时间</text>
<rect x="275" y="60" width="210" height="82" rx="8" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="289" y="88" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">2 · 内核转储</text>
<text x="289" y="110" font-family="inherit" font-size="11" fill="var(--sv-ink)">core_pattern / coredumpctl</text>
<text x="289" y="129" font-family="inherit" font-size="11" fill="var(--sv-muted)">ulimit -c unlimited</text>
<rect x="530" y="60" width="210" height="82" rx="8" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="544" y="88" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">3 · 加载符号</text>
<text x="544" y="110" font-family="inherit" font-size="11" fill="var(--sv-ink)">gdb ./prog core</text>
<text x="544" y="129" font-family="inherit" font-size="11" fill="var(--sv-muted)">build-id 必须匹配</text>
<rect x="530" y="220" width="210" height="82" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="544" y="248" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">4 · 定位故障帧</text>
<text x="544" y="270" font-family="inherit" font-size="11" fill="var(--sv-ink)">bt / info registers</text>
<text x="544" y="289" font-family="inherit" font-size="11" fill="var(--sv-muted)">x/i $rip / frame N</text>
<rect x="275" y="220" width="210" height="82" rx="8" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="289" y="248" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">5 · 还原现场</text>
<text x="289" y="270" font-family="inherit" font-size="11" fill="var(--sv-ink)">print / x/ 内存</text>
<text x="289" y="289" font-family="inherit" font-size="11" fill="var(--sv-muted)">addr2line / info symbol</text>
<rect x="20" y="220" width="210" height="82" rx="8" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="34" y="248" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">6 · 最小复现</text>
<text x="34" y="270" font-family="inherit" font-size="11" fill="var(--sv-ink)">抽出输入与调用路径</text>
<text x="34" y="289" font-family="inherit" font-size="11" fill="var(--sv-muted)">写成回归测试</text>
<line x1="230" y1="101" x2="263" y2="101" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#debugging-core-arrow)"/>
<line x1="485" y1="101" x2="518" y2="101" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#debugging-core-arrow)"/>
<line x1="635" y1="142" x2="635" y2="208" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#debugging-core-arrow)"/>
<line x1="530" y1="261" x2="497" y2="261" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#debugging-core-arrow)"/>
<line x1="275" y1="261" x2="242" y2="261" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#debugging-core-arrow)"/>
<text x="16" y="345" font-family="inherit" font-size="12" fill="var(--sv-muted)">没有符号时，core 只能给地址；把同一构建的未 strip 二进制与符号一起归档，是流程问题，不是工具问题。</text>
<text x="16" y="365" font-family="inherit" font-size="12" fill="var(--sv-muted)">core 可能包含密钥与用户数据，生产环境应限制权限、加密传输并设置保留期。</text>
</svg><figcaption>图 3 · core dump 分析：信号触发转储，符号匹配后才能把地址还原成调用链与变量状态</figcaption></figure>
<p>可靠分析的前提是符号匹配。用同一次构建的二进制，或在 gdb 中通过 <code>set debug-file-directory</code> 指向 debuginfo 目录，也可以配置 debuginfod 让调试器按 build-id 自动下载。strip 过的二进制只能看到地址，分析成本高一个量级。跨机器、跨容器分析时，先把二进制、依赖库和 core 三件套凑齐，再开始。</p>
<p>没有 core 时按顺序排查：core_pattern 是否把转储管道到了别处；进程的 RLIMIT_CORE 是否为 0；磁盘是否有空间；安全模块或容器配置是否禁止转储。Windows 对应 WER 与 minidump；macOS 的 core 默认关闭（<code>ulimit -c</code> 为 0），开启后写入 /cores，格式与 ELF core 不同，思路一致：现场加符号。</p>
</section>

<section class="sec"><h2>六、反向调试：从坏状态往回走</h2>
<p>常规调试是「向前执行，直到看见错误」，但错误状态往往离根因很远。反向调试（reverse debugging）允许你从已知的坏状态往回走，直接找到最后一次合法写入或第一次走错的分支。GDB 的 <code>record full</code> 做软件指令级记录（并非所有平台与目标都支持），<code>record btrace</code> 依赖 Intel Processor Trace 硬件；起源于 Mozilla、现由社区维护的 rr 用性能计数器做确定性录制，<code>rr record ./prog</code> 之后 <code>rr replay</code>，得到的会话可以反复前进、后退、重放。</p>
<p>典型组合是「观察点加反向执行」：对可疑变量设 watch，continue 到被改坏的那次，然后 reverse-continue 找到上一次修改，再 reverse-step 看是哪条分支或哪次调用写入了错误值。对只在特定时序下出现的 Heisenbug，rr 的确定性比任何 printf 都强，因为回放时指令流与线程调度一致。</p>
<p>边界也要清楚。record full 有明显的内存与性能开销，长程序不现实；btrace 依赖特定硬件，环形缓冲区容量也有限；rr 目前主要支持 Linux x86-64（aarch64 支持仍在完善），录制时对多线程做调度模拟，系统调用、时间与随机数在回放中被虚拟化，某些驱动或特殊指令可能不支持。平台不具备条件时，退回日志、二分与压力复现。</p>
</section>

<section class="sec"><h2>七、内存与线程问题：让工具先说话</h2>
<p>内存错误不要靠肉眼。AddressSanitizer（ASan）抓越界、释放后使用、重复释放与栈溢出；UndefinedBehaviorSanitizer（UBSan）抓有符号溢出、错位访问、无效类型转换；ThreadSanitizer（TSan）抓数据竞争；MemorySanitizer（MSan）抓未初始化读取。编译时加 <code>-fsanitize=address,undefined -fno-omit-frame-pointer -g</code>，运行即报错并给出分配与释放的调用栈。ASan 与 TSan 不能同时开启，需要分别构建。MSan 更苛刻：它要求被检查的代码连同依赖库都做 MSan 插桩，否则未插桩代码里的初始化写入它看不见，误报会大量增加。</p>
<p>Valgrind 的 memcheck 不需要重新编译，但通常慢一个数量级以上，具体倍数取决于程序；helgrind 与 DRD 用于锁与竞争分析。工具报告的第一条错误才是根因，后面的往往是连锁反应，先修最早的那条再重跑。</p>
<p>挂起与死锁属于另一类。用 <code>gdb -p PID</code> 附加，<code>info threads</code> 看每个线程停在哪里，<code>thread apply all bt</code> 找互相等待的锁环。需要固定当前线程时用 <code>set scheduler-locking on</code>，否则单步时其他线程仍在跑，现场会变。注意 attach 会暂停整个进程，生产环境先确认影响与权限。</p>
<div class="callout callout--tip"><span class="callout__label">技巧</span><div>不要用 watch 监视已经释放的内存：那块地址可能已被分配器复用，观察点会在无关写入上触发。检测释放后使用，用 ASan 的隔离区（quarantine）比硬件观察点可靠得多。</div></div>
<p>数据竞争也不能用「多跑几次没崩」来证明不存在。TSan 基于 happens-before 分析，只要发现没有同步保护的冲突访问就会报告，即使这次运行没有崩溃、也没有产生可见的错误结果；反过来，它只对实际执行到的路径负责，跑不到的分支它无从判断。所以 TSan 能发现你推理里的漏洞，却不能证明竞争不存在。压力测试只能提高暴露概率；并发正确性最终要靠同步原语与内存序的推理。</p>
</section>

<section class="sec"><h2>八、日志设计与 printf 调试的正确姿势</h2>
<p>printf 调试不是低级手段，问题在于纪律。输出统一走 stderr，避免与 stdout 的缓冲顺序纠缠；stderr 按 C 标准不会完全缓冲，但具体是无缓冲还是行缓冲由实现决定，关键点仍应 <code>fflush(stderr)</code>，或在启动时用 <code>setvbuf</code> 显式设为无缓冲；每条日志带文件行号、序号、线程 id 与关键值；用唯一标记包住一次实验，方便 grep 与删除。最忌讳的是随手加一堆无标识输出，最后既读不懂也不敢删。</p>
<p>正确姿势是先写假设，再插入能区分假设的日志。例如怀疑分支走错，就同时打印条件与两个候选值；一次只加少量日志，用二分在流程中点打点。修复后删除，或降级到 debug 级别并加开关，别让临时输出进主干。C++20 起可用 <code>std::format</code>（<code>&lt;format&gt;</code>）构造消息，C++23 起 <code>std::print</code> 更直接；但信号处理函数里只能调用 async-signal-safe 函数，<code>write</code> 是安全的，<code>printf</code>、<code>std::format</code> 与动态分配都不是。</p>
<p>日志系统要面向未来的读者设计：分级（error、warn、info、debug、trace）、结构化字段（key=value 或 JSON）、请求关联 id、限流与采样、在边界处记录（入口、出口、外部调用、状态转换）、不记录密钥与个人敏感信息。日志回答的是「发生了什么」，调试器回答的是「状态是什么」，两者互补而不是替代。</p>
<div class="formula">一条可用日志 = 时间 + 级别 + 位置 + 上下文标识 + 事件 + 结果
printf 调试的纪律：可开关、可检索、可删除，且不改变被观测程序的行为</div>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>调试器是显微镜，日志是行车记录仪。前者能看清一个点，后者能还原整段路；事故复盘往往两者都要。</div></div>
<p>最后是常见误区。把「加打印后问题消失」当成修好了，通常只是改变了时序或内存布局，属于观察者效应；把 Release 崩溃直接归因于编译器优化，往往忽略了未定义行为本来就没有保证；把 core 当成万能证据，却忘了二进制与库版本不匹配。调试的终点不是「这次不崩了」，而是「能解释为什么之前会崩，并且有测试证明以后不会」。</p>
</section>

<section class="sec"><h2>九、自测</h2>
<details class="quiz"><summary>Q1 · 在 -O2 构建里 print 一个局部变量显示 optimized out，怎么办？</summary><div class="quiz__a">先承认这是优化的正常结果：变量可能被放进寄存器、被常量折叠，或不再单独存在。可用 info registers 看候选寄存器，用 disassemble 定位使用点，在函数入口打断点看参数，或用 -Og 重新构建复现。临时加 volatile 能迫使变量落栈，但会改变优化行为，只适合定位。</div></details>
<details class="quiz"><summary>Q2 · core 加载后 bt 几乎全是问号，最先检查什么？</summary><div class="quiz__a">先查二进制与 core 是否来自同一次构建，以及二进制是否被 strip。用 readelf -n 对比 build-id，换用未 strip 的二进制或安装对应 debuginfo；配置 debuginfod 也能按 build-id 自动取符号。栈被破坏确实是可能原因，但它排在符号不匹配之后，不要一上来就怀疑栈溢出。</div></details>
<details class="quiz"><summary>Q3 · 循环里条件断点让程序慢了几十倍，有哪些替代方案？</summary><div class="quiz__a">条件表达式由调试器在每次命中时求值，循环里成本极高。可以先用 ignore N 跳过前 N 次；或用 commands 配置 silent、printf、continue，把断点变成只输出不暂停的探针；或把断点缩小到特定线程、特定函数入口。也可以在代码里写 if 条件加 __builtin_trap，让错误状态自己触发，但记得之后移除。</div></details>
<details class="quiz"><summary>Q4 · watch 一个局部变量，函数返回后观察点为什么失效？</summary><div class="quiz__a">watch 绑定的是地址，不是名字。栈帧销毁后，那块栈内存会被后续调用复用，观察点要么失效，要么在无关写入上触发。监视堆对象生命周期应使用 ASan；硬件观察点数量有限，超出后会退化为软件单步。</div></details>
</section>

<section class="sec"><h2>十、延伸阅读</h2>
<ul class="refs">
<li><b>GDB 官方文档</b> — GNU Project，持续更新。命令、远程调试、反向调试与 core 文件分析的权威参考，遇到行为疑问先查这里。</li>
<li><b>LLDB 文档</b> — LLVM Project。LLDB 命令结构、表达式求值与脚本扩展的官方说明，含 GDB 到 LLDB 的命令对照。</li>
<li><b>《The Art of Debugging with GDB, DDD, and Eclipse》</b> — Norman Matloff、Peter Jay Salzman，No Starch Press，2008。以实例讲断点、观察点与崩溃定位，适合建立调试手感。</li>
<li><b>「Give me 15 minutes and I'll change your view of GDB」</b> — Greg Law，CppCon 2015。用反向调试演示如何从崩溃点回溯根因，是理解录制回放价值的好入口。</li>
<li><b>rr 项目文档</b> — rr 项目（起源于 Mozilla），rr-project.org。确定性录制与回放的原理、限制与用法，适合处理并发与难复现问题。</li>
</ul>
</section>`
};
