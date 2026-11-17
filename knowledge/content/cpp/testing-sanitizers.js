window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["testing-sanitizers"] = {
  slug: "testing-sanitizers",
  title: "测试、Sanitizer 与模糊测试",
  subtitle: "让机器替你找未定义行为",
  level: 5,
  cluster: "工程化",
  tags: ["GoogleTest", "ASan", "fuzzing"],
  summary: "从测试金字塔、GoogleTest 断言与夹具、四种 Sanitizer 的检测边界，到 Valgrind、libFuzzer、覆盖率与 CI 门禁，讲清各工具能证明什么。",
  keyPoints: [
    "测试金字塔是成本模型而非教条：越靠底层反馈越快、定位越准，越靠顶层越接近真实但越脆",
    "断言分致命与非致命，夹具让每个测试用例拥有独立且可复现的初始状态",
    "ASan 查越界与释放后使用，UBSan 查语言层未定义运算，TSan 查数据竞争，MSan 查未初始化读，没有工具覆盖全部 UB",
    "Sanitizer 只能报告本次执行实际走到的路径，未命中不等于代码正确",
    "Fuzzing 用覆盖率引导输入变异，把崩溃样本固化为回归用例；覆盖率度量执行范围，不度量断言质量"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>测试不是证明，而是提高发现概率</h2>
<p>先看一个几乎人人都遇到过的场景：一个解析函数在单元测试里全绿，上线后在压测中偶发崩溃，调试器停在 <code>std::vector</code> 的析构里。把优化级别降到 -O0，问题又消失了。真正的原因往往是几行之外的越界写，它踩坏了相邻对象的头部，而崩溃点只是最先倒下的那块多米诺骨牌。</p>
<p>这类问题无法靠“再读一遍代码”稳定解决。工程化的做法是把发现工作拆给三类工具：确定性测试回答“我已经想到的路径对不对”，动态检查器回答“这次执行有没有踩到标准红线”，模糊测试回答“还有哪些输入我根本没试过”。三者互补，谁也不能替代谁。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>测试只能证明“存在错误”，不能证明“没有错误”。每加一个用例，你买到的是更高的发现概率，而不是一张正确性证书。理解这一点，才不会把“测试全绿”当成收工信号。</div></div>
<p>语言层面的未定义行为分类、严格别名与对象生命周期，在《未定义行为与严格别名》一篇中展开；这里只关心工程化的一面：如何用工具把它们逼出来。</p>
</section>

<section class="sec">
<h2>测试金字塔：把反馈成本算清楚</h2>
<p>测试金字塔（test pyramid）把测试按粒度分成三层。底层是<mark>单元测试</mark>（unit test），只测一个函数或一个类，不碰数据库、网络和文件系统；中层是<mark>集成测试</mark>（integration test），验证多个组件按契约协作；顶层是<mark>端到端测试</mark>（end-to-end test），从外部接口驱动整个系统。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="测试金字塔：底层单元测试数量最多、毫秒级反馈，中层集成测试秒级，顶层端到端测试数量最少、分钟级且最脆弱" font-family="inherit">
<defs>
<marker id="testing-sanitizers-arrow-1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"/>
</marker>
</defs>
<text x="380" y="30" text-anchor="middle" font-size="15" fill="var(--sv-ink)">测试金字塔：数量、速度与定位成本</text>
<polygon points="330,56 430,56 480,136 280,136" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<polygon points="280,146 480,146 560,236 200,236" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<polygon points="200,246 560,246 660,346 100,346" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="380" y="88" text-anchor="middle" font-size="14" fill="var(--sv-ink)">端到端测试</text>
<text x="380" y="110" text-anchor="middle" font-size="12" fill="var(--sv-muted)">约 10% · 分钟级</text>
<text x="380" y="130" text-anchor="middle" font-size="12" fill="var(--sv-muted)">最接近用户，最脆弱</text>
<text x="380" y="180" text-anchor="middle" font-size="14" fill="var(--sv-ink)">集成测试</text>
<text x="380" y="202" text-anchor="middle" font-size="12" fill="var(--sv-muted)">约 20% · 秒级</text>
<text x="380" y="224" text-anchor="middle" font-size="12" fill="var(--sv-muted)">验证契约与真实依赖</text>
<text x="380" y="282" text-anchor="middle" font-size="14" fill="var(--sv-ink)">单元测试</text>
<text x="380" y="304" text-anchor="middle" font-size="12" fill="var(--sv-muted)">约 70% · 毫秒级</text>
<text x="380" y="326" text-anchor="middle" font-size="12" fill="var(--sv-muted)">数量最多，定位到函数</text>
<path d="M700 346 V56" stroke="var(--sv-line)" fill="none" marker-end="url(#testing-sanitizers-arrow-1)"/>
<text x="714" y="330" font-size="12" fill="var(--sv-muted)">慢</text>
<text x="714" y="300" font-size="12" fill="var(--sv-muted)">贵</text>
<text x="714" y="270" font-size="12" fill="var(--sv-muted)">脆</text>
<text x="714" y="90" font-size="12" fill="var(--sv-muted)">快</text>
<text x="714" y="120" font-size="12" fill="var(--sv-muted)">省</text>
<text x="714" y="150" font-size="12" fill="var(--sv-muted)">稳</text>
</svg>
<figcaption>图 1 · 金字塔表达的是成本与反馈速度，比例是经验值，不是标准规定</figcaption>
</figure>
<p>为什么底层要多？因为一次单元测试通常在毫秒级完成，失败时能直接指出是哪个函数、哪组参数；端到端测试要启动进程、连数据库、等超时，失败信息往往只是一句“接口返回 500”。塔尖越多，CI 越慢，越容易因为环境抖动被标成“不稳定测试”然后被忽略。</p>
<p>但金字塔是启发式（heuristic），不是教条。I/O 密集的服务，集成测试比例可以更高；前端项目常采用“测试奖杯”（testing trophy），把重心放在集成层。真正要避免的是倒金字塔：大量端到端脚本、几乎没有单元测试，这种结构俗称冰淇淋筒（ice cream cone），维护成本会随时间指数上升。</p>
<p>还有一层常被忽视：每个修过的 bug 都应留下一个先失败、后通过的测试。这条<mark>回归测试</mark>（regression test）不贵，却能显著降低“同一个坑踩第二次”的风险，也是后面所有工具发现问题的最终归宿。</p>
</section>

<section class="sec">
<h2>GoogleTest：断言、夹具与可复现的初始状态</h2>
<p>GoogleTest 是目前 C++ 生态使用最广的测试框架之一，CMake 集成成熟，断言信息可读。它的断言分两类：<code>EXPECT_*</code> 失败后继续执行当前测试，适合一次暴露多个问题；<code>ASSERT_*</code> 失败后立即从当前函数返回，适合后续代码依赖前置条件的场合，比如指针非空。</p>
<p>测试夹具（fixture）用 <code>TEST_F</code> 定义：框架为每个用例创建全新的夹具实例，依次执行构造、<code>SetUp</code>、测试体、<code>TearDown</code> 和析构。这保证了用例之间不共享可变状态，失败可以单独重跑。要注意 <code>ASSERT_*</code> 只能出现在返回 void 的函数里，所以不能写进构造函数或析构函数；<code>SetUp</code> 本身是 void 函数，可以使用，但其中的致命失败会跳过测试体（<code>TearDown</code> 仍会执行）。如果致命检查放在返回非 void 的辅助函数里，应改用 <code>ASSERT_NO_FATAL_FAILURE</code> 调用它，或把检查挪回测试体。</p>
<pre class="code" data-lang="cpp"><code>// stats.h
#pragma once
#include &lt;stdexcept&gt;
#include &lt;utility&gt;
#include &lt;vector&gt;

class Stats {
public:
    explicit Stats(std::vector&lt;int&gt; xs) : xs_(std::move(xs)) {}

    int max() const {
        if (xs_.empty()) throw std::domain_error("empty");
        int m = xs_.front();
        for (int x : xs_) if (x &gt; m) m = x;
        return m;
    }

private:
    std::vector&lt;int&gt; xs_;
};
</code></pre>
<pre class="code" data-lang="cpp"><code>// stats_test.cpp
#include &lt;gtest/gtest.h&gt;
#include &lt;memory&gt;
#include "stats.h"

TEST(StatsTest, MaxOfPositive) {
    Stats s({3, 1, 4, 1, 5});
    EXPECT_EQ(s.max(), 5);
}

TEST(StatsTest, EmptyThrows) {
    Stats s({});
    EXPECT_THROW(s.max(), std::domain_error);
}

class StatsFixture : public ::testing::Test {
protected:
    void SetUp() override {
        s_ = std::make_unique&lt;Stats&gt;(std::vector&lt;int&gt;{2, 7, 1});
    }
    std::unique_ptr&lt;Stats&gt; s_;
};

TEST_F(StatsFixture, MaxIsSeven) {
    ASSERT_NE(s_, nullptr);
    EXPECT_EQ(s_-&gt;max(), 7) &lt;&lt; "输入 2,7,1 的最大值应为 7";
}
</code></pre>
<p>编译与运行（C++20 口径，Linux，GCC 13 或 Clang 17；Windows 上库名与链接方式略有差异，若使用动态库版本的 gtest，还需要把对应的 DLL 放到可执行文件旁边）：</p>
<pre class="code" data-lang="bash"><code>g++ -std=c++20 -g -O1 -fno-omit-frame-pointer \
    -fsanitize=address,undefined \
    stats_test.cpp -lgtest -lgtest_main -pthread -o stats_test
./stats_test --gtest_filter='Stats*'
</code></pre>
<p>参数化测试用 <code>TEST_P</code> 加 <code>INSTANTIATE_TEST_SUITE_P</code>，适合把同一组边界值喂给多个实现。死亡测试（death test）用 <code>EXPECT_DEATH</code> 验证“必须崩溃”的行为，但它依赖子进程或额外线程（取决于平台和 death test 风格），速度慢且平台差异大，只在验证断言宏或防御性终止时使用。</p>
<p>另一个常见选择是 Catch2：v2 可以单头文件引入，v3 起改为需要编译的库（官方另提供 amalgamated 头文件与源文件）；宏更少，用 <code>REQUIRE</code> 与 <code>CHECK</code> 对应致命与非致命断言，支持 BDD 风格。两者能力接近，选团队更熟悉的即可，不要在同一项目里混用两套测试运行器。</p>
</section>

<section class="sec">
<h2>Sanitizer：编译期插桩能看见什么</h2>
<p><mark>Sanitizer</mark> 不是静态分析器，也不是调试器。它在编译期按需往内存访问、算术运算与原子操作处插入检查代码，再链接一个运行库。程序跑起来时，检查代码会比对影子状态，一旦发现违规就打印调用栈并终止（或按配置继续）。</p>
<p>以地址检查器 ASan（AddressSanitizer）为例，它维护一张<mark>影子内存</mark>（shadow memory），用 1 字节记录 8 字节应用内存的可访问性，官方文档给出的额外内存开销典型为 2 到 3 倍。堆分配两侧加红区（redzone），释放后的块进入隔离区（quarantine）延迟复用。于是越界一字节、释放后读取、重复释放都能在违规发生的那一刻被抓到，而不是等到对象被踩坏之后。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="五类工具对不同错误类型的检测能力矩阵，实心圆表示直接检测，空心圆表示有条件或需专用工具，点表示不覆盖" font-family="inherit">
<text x="380" y="26" text-anchor="middle" font-size="15" fill="var(--sv-ink)">同一段代码，不同工具能看见什么</text>
<text x="20" y="62" font-size="12" fill="var(--sv-muted)">错误类型</text>
<text x="330" y="62" text-anchor="middle" font-size="12" fill="var(--sv-ink)">ASan</text>
<text x="420" y="62" text-anchor="middle" font-size="12" fill="var(--sv-ink)">UBSan</text>
<text x="510" y="62" text-anchor="middle" font-size="12" fill="var(--sv-ink)">TSan</text>
<text x="600" y="62" text-anchor="middle" font-size="12" fill="var(--sv-ink)">MSan</text>
<text x="700" y="62" text-anchor="middle" font-size="12" fill="var(--sv-ink)">Valgrind</text>
<line x1="270" y1="70" x2="750" y2="70" stroke="var(--sv-line)"/>
<line x1="270" y1="70" x2="270" y2="330" stroke="var(--sv-line)"/>
<line x1="375" y1="70" x2="375" y2="330" stroke="var(--sv-line)"/>
<line x1="465" y1="70" x2="465" y2="330" stroke="var(--sv-line)"/>
<line x1="555" y1="70" x2="555" y2="330" stroke="var(--sv-line)"/>
<line x1="645" y1="70" x2="645" y2="330" stroke="var(--sv-line)"/>
<text x="20" y="102" font-size="13" fill="var(--sv-ink)">堆 / 栈 / 全局越界</text>
<text x="330" y="102" text-anchor="middle" font-size="14" fill="var(--sv-a)">●</text>
<text x="420" y="102" text-anchor="middle" font-size="14" fill="var(--sv-muted)">·</text>
<text x="510" y="102" text-anchor="middle" font-size="14" fill="var(--sv-muted)">·</text>
<text x="600" y="102" text-anchor="middle" font-size="14" fill="var(--sv-muted)">·</text>
<text x="700" y="102" text-anchor="middle" font-size="14" fill="var(--sv-b)">●</text>
<text x="20" y="144" font-size="13" fill="var(--sv-ink)">释放后使用 / 重复释放</text>
<text x="330" y="144" text-anchor="middle" font-size="14" fill="var(--sv-a)">●</text>
<text x="420" y="144" text-anchor="middle" font-size="14" fill="var(--sv-muted)">·</text>
<text x="510" y="144" text-anchor="middle" font-size="14" fill="var(--sv-muted)">·</text>
<text x="600" y="144" text-anchor="middle" font-size="14" fill="var(--sv-muted)">·</text>
<text x="700" y="144" text-anchor="middle" font-size="14" fill="var(--sv-b)">●</text>
<text x="20" y="186" font-size="13" fill="var(--sv-ink)">有符号溢出 / 非法移位</text>
<text x="330" y="186" text-anchor="middle" font-size="14" fill="var(--sv-muted)">·</text>
<text x="420" y="186" text-anchor="middle" font-size="14" fill="var(--sv-a)">●</text>
<text x="510" y="186" text-anchor="middle" font-size="14" fill="var(--sv-muted)">·</text>
<text x="600" y="186" text-anchor="middle" font-size="14" fill="var(--sv-muted)">·</text>
<text x="700" y="186" text-anchor="middle" font-size="14" fill="var(--sv-muted)">·</text>
<text x="20" y="228" font-size="13" fill="var(--sv-ink)">未初始化读取</text>
<text x="330" y="228" text-anchor="middle" font-size="14" fill="var(--sv-muted)">·</text>
<text x="420" y="228" text-anchor="middle" font-size="14" fill="var(--sv-muted)">·</text>
<text x="510" y="228" text-anchor="middle" font-size="14" fill="var(--sv-muted)">·</text>
<text x="600" y="228" text-anchor="middle" font-size="14" fill="var(--sv-a)">●</text>
<text x="700" y="228" text-anchor="middle" font-size="14" fill="var(--sv-b)">●</text>
<text x="20" y="270" font-size="13" fill="var(--sv-ink)">数据竞争</text>
<text x="330" y="270" text-anchor="middle" font-size="14" fill="var(--sv-muted)">·</text>
<text x="420" y="270" text-anchor="middle" font-size="14" fill="var(--sv-muted)">·</text>
<text x="510" y="270" text-anchor="middle" font-size="14" fill="var(--sv-a)">●</text>
<text x="600" y="270" text-anchor="middle" font-size="14" fill="var(--sv-muted)">·</text>
<text x="700" y="270" text-anchor="middle" font-size="14" fill="var(--sv-b)">○</text>
<text x="20" y="312" font-size="13" fill="var(--sv-ink)">内存泄漏</text>
<text x="330" y="312" text-anchor="middle" font-size="14" fill="var(--sv-a)">●</text>
<text x="420" y="312" text-anchor="middle" font-size="14" fill="var(--sv-muted)">·</text>
<text x="510" y="312" text-anchor="middle" font-size="14" fill="var(--sv-muted)">·</text>
<text x="600" y="312" text-anchor="middle" font-size="14" fill="var(--sv-muted)">·</text>
<text x="700" y="312" text-anchor="middle" font-size="14" fill="var(--sv-b)">●</text>
<text x="20" y="358" font-size="12" fill="var(--sv-muted)">● 直接检测　　○ 需专用工具或条件编译（Valgrind 的竞争检测用 Helgrind / DRD，Memcheck 不做）　　· 不覆盖</text>
</svg>
<figcaption>图 2 · 检测矩阵是分工图，不是能力排行榜；任何一列都不足以单独证明程序安全</figcaption>
</figure>
<p>四种 Sanitizer 的定位差异很大，混用和误用都常见。下表的开销数字来自各项目官方文档，是典型量级，实际会随代码形态、优化级别和运行期选项变化：</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>工具</th><th>主要能力</th><th>典型开销</th><th>关键限制</th></tr></thead>
<tbody>
<tr><td><b>ASan</b><br>AddressSanitizer</td><td>堆、栈、全局缓冲区越界，use-after-free，double free，以及配套的 LSan 泄漏检测</td><td>约 2 倍运行时间、2 到 3 倍内存</td><td>不查未初始化读与数据竞争；自定义内存池、对象内部越界可能落在红区之外</td></tr>
<tr><td><b>UBSan</b><br>UndefinedBehaviorSanitizer</td><td>有符号溢出、非法移位、空指针解引用、对齐违规、枚举越界、无效 downcast（需 vptr 检查）</td><td>通常低于 2 倍</td><td>只查语言层违规，不查堆生命周期；多数检查默认报告后继续，需用 <code>-fno-sanitize-recover</code> 统一改为终止</td></tr>
<tr><td><b>TSan</b><br>ThreadSanitizer</td><td>数据竞争、部分锁序问题</td><td>约 5 到 15 倍时间、5 到 10 倍内存</td><td>不能与 ASan 同进程启用；只报告实际发生的竞争，需要并发路径被执行到</td></tr>
<tr><td><b>MSan</b><br>MemorySanitizer</td><td>读取未初始化内存</td><td>约 3 倍</td><td>要求整个程序包括所有第三方库都用 MSan 重新编译，否则误报；目前仅 Clang 提供（GCC 无此工具）</td></tr>
</tbody></table></div>
<p>启用方式通常是组合拳。开发与 CI 的默认构建用 ASan 加 UBSan，并发相关模块单独跑一份 TSan 构建，涉及未初始化数据的解析器再单独跑 MSan。下面这组选项在 Linux 上加 Clang 或 GCC 都可用（以 Clang 17、GCC 13、x86-64 Linux 为口径）：</p>
<pre class="code" data-lang="bash"><code># ASan + UBSan，UBSan 发现即终止
clang++ -std=c++20 -g -O1 -fno-omit-frame-pointer \
    -fsanitize=address,undefined -fno-sanitize-recover=all \
    -o app app.cpp

# TSan 必须是独立构建
clang++ -std=c++20 -g -O1 -fno-omit-frame-pointer \
    -fsanitize=thread -o app_tsan app.cpp

# 运行期配置
ASAN_OPTIONS=detect_leaks=1:abort_on_error=1:strict_string_checks=1 ./app
</code></pre>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>“ASan 全绿”只说明这次执行没有触发 ASan 插桩覆盖的那几类错误。它不检查未初始化读，不检查数据竞争，不检查有符号溢出，也不检查逻辑错误。把 sanitizer 当成“UB 全检测”是工程上最危险的误解，比不开启更危险，因为它会制造虚假的安全感。</div></div>
<div class="formula">一次运行能证明的：该输入经过的路径上，未被已插桩检查命中。　不能证明的：其他输入、其他路径、语义正确性。</div>
<p>还有一个容易被忽略的副作用：ASan、TSan 会改变内存布局和线程时序，某些竞争在插桩后反而不出现。因此不要把“ASan 构建下复现不了”当成问题不存在，它只是换了一种观测条件。排查并发问题时，固定线程数与调度策略、拉长压测时间，比反复重跑更有效。</p>
</section>

<section class="sec">
<h2>Valgrind：不重编译的另一种观测方式</h2>
<p>Valgrind 走的是另一条路：动态二进制插桩（dynamic binary instrumentation，DBI）。它把机器码翻译成中间表示，在模拟执行中维护字节级的有效性状态，因此不需要重新编译，也不要求源码。代价是慢，Memcheck 下典型减速 20 到 30 倍，交互式使用会明显卡顿。</p>
<p>它的工具集各有分工：Memcheck 查非法读写、未初始化值传播和泄漏；Helgrind 与 DRD 查数据竞争和锁误用；Massif 做堆剖析；Cachegrind 模拟缓存行为。对于“二进制已经在手、无法改构建”的场景，或者想交叉验证 ASan 的结论，Valgrind 很有价值。</p>
<p>边界同样明确。Memcheck 对栈上越界的捕获不如 ASan 稳定，因为它没有为每个栈帧插入红区；它不检查有符号溢出这类纯语言层 UB；它也不理解 C++ 对象生命周期，只看到字节是否已初始化、地址是否曾由 malloc 分配。平台支持以 Linux 为主，Windows 原生不支持，macOS 的支持随版本波动。</p>
<p>实践中的取舍是：日常 CI 跑 ASan 加 UBSan，因为它快且能并行；Valgrind 作为夜间任务或疑难问题的第二意见。MSan 虽然也查未初始化读，但要求全链路插桩，接入成本高于 Valgrind，二者按团队构建能力选择其一即可。</p>
</section>

<section class="sec">
<h2>Fuzzing：把输入空间交给机器</h2>
<p><mark>模糊测试</mark>（fuzzing）的核心不是“随机生成”，而是“覆盖率引导的变异”。以 libFuzzer 为例，它在同一进程内反复调用一个入口函数，用插桩得到的边覆盖信息判断哪些输入探索了新路径，再对这些输入做字节级变异。发现崩溃或 sanitizer 报错时，它会把触发输入写成文件，这个文件就是天然的回归用例。</p>
<p>入口函数的签名固定为 <code>extern "C" int LLVMFuzzerTestOneInput(const std::uint8_t* data, std::size_t size)</code>。它必须对任意字节序列都不崩溃、不泄漏、不长时间阻塞；解析失败正常返回即可，真正的不变量破坏才交给断言或 sanitizer 暴露。下面的例子是一个一字节长度前缀的帧协议解析器，可直接与 libFuzzer 链接（需要 Clang，GCC 不支持 <code>-fsanitize=fuzzer</code>）：</p>
<pre class="code" data-lang="cpp"><code>#include &lt;cstddef&gt;
#include &lt;cstdint&gt;

// 协议：首字节为负载长度 len，随后 len 字节为负载
bool parse_frame(const std::uint8_t* data, std::size_t size) {
    if (size &lt; 1) return false;
    const std::uint8_t len = data[0];
    if (len == 0 || len &gt; size - 1) return false;   // 先校验长度，避免越界
    return data[len] != 0;                            // 读取负载最后一字节
}

extern "C" int LLVMFuzzerTestOneInput(const std::uint8_t* data, std::size_t size) {
    parse_frame(data, size);
    return 0;                                 // 返回值忽略，崩溃由 sanitizer 捕获
}
</code></pre>
<pre class="code" data-lang="bash"><code>clang++ -std=c++20 -g -O1 -fno-omit-frame-pointer \
    -fsanitize=fuzzer,address,undefined fuzz_frame.cpp -o fuzz_frame

mkdir -p corpus
./fuzz_frame corpus -max_len=64 -max_total_time=300 -print_final_stats=1
</code></pre>
<p>几个工程细节决定 fuzzing 是否有效。第一，提供<mark>语料库</mark>（corpus）：把真实协议样本、边界样本放进去，通常比从空输入开始快得多。第二，提供字典（dictionary），把关键字、魔数、分隔符写进去，结构化输入才容易被拼出来。第三，限制最大长度 <code>-max_len</code>，否则变异大量耗在超长输入上。第四，用 <code>-jobs</code> 与 <code>-workers</code> 并行，把 CPU 吃满。</p>
<p>对解析器、序列化、协议、正则、压缩这类“输入驱动”的代码，fuzzing 的投入产出比极高。对业务逻辑，它只能证明“没崩”，不能证明“算得对”，这时需要属性测试（property-based testing）或结构化 fuzzing（如 Google 的 FuzzTest）来断言不变量。发现的崩溃样本应提交进仓库，纳入每次 CI 的回归集；长期运行可以挂到 OSS-Fuzz 这类持续模糊测试服务上。</p>
</section>

<section class="sec">
<h2>覆盖率与 CI：把检查变成门禁</h2>
<p><mark>覆盖率</mark>（coverage）回答的是“哪些代码被执行过”，不是“哪些行为被验证过”。行覆盖最粗，分支覆盖能发现“if 只走了 true”，条件覆盖与 MC/DC 更细，后者在航空（如 DO-178C Level A）等功能安全领域常见。GCC 与 Clang 都支持 <code>--coverage</code>；Clang 还可以用 <code>-fprofile-instr-generate -fcoverage-mapping</code> 生成 LLVM 格式的剖面数据，再由 gcov/lcov 或 llvm-profdata/llvm-cov 汇总。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="CI 流水线：提交后依次经过构建、单元测试、ASan 与 UBSan、TSan，覆盖率与夜间模糊测试汇入合并门禁" font-family="inherit">
<defs>
<marker id="testing-sanitizers-arrow-2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"/>
</marker>
</defs>
<text x="380" y="26" text-anchor="middle" font-size="15" fill="var(--sv-ink)">一条能拦住问题的流水线</text>
<rect x="16" y="62" width="128" height="72" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="80" y="92" text-anchor="middle" font-size="13" fill="var(--sv-ink)">提交 / PR</text>
<text x="80" y="114" text-anchor="middle" font-size="12" fill="var(--sv-muted)">触发流水线</text>
<rect x="164" y="62" width="128" height="72" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="228" y="92" text-anchor="middle" font-size="13" fill="var(--sv-ink)">构建</text>
<text x="228" y="114" text-anchor="middle" font-size="12" fill="var(--sv-muted)">-Werror 警告即错误</text>
<rect x="312" y="62" width="128" height="72" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="376" y="92" text-anchor="middle" font-size="13" fill="var(--sv-ink)">单元测试</text>
<text x="376" y="114" text-anchor="middle" font-size="12" fill="var(--sv-muted)">GoogleTest / Catch2</text>
<rect x="460" y="62" width="128" height="72" rx="8" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="524" y="92" text-anchor="middle" font-size="13" fill="var(--sv-ink)">ASan + UBSan</text>
<text x="524" y="114" text-anchor="middle" font-size="12" fill="var(--sv-muted)">每次提交必跑</text>
<rect x="608" y="62" width="128" height="72" rx="8" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="672" y="92" text-anchor="middle" font-size="13" fill="var(--sv-ink)">TSan</text>
<text x="672" y="114" text-anchor="middle" font-size="12" fill="var(--sv-muted)">并发模块单独构建</text>
<path d="M144 98 H160" stroke="var(--sv-line)" fill="none" marker-end="url(#testing-sanitizers-arrow-2)"/>
<path d="M292 98 H308" stroke="var(--sv-line)" fill="none" marker-end="url(#testing-sanitizers-arrow-2)"/>
<path d="M440 98 H456" stroke="var(--sv-line)" fill="none" marker-end="url(#testing-sanitizers-arrow-2)"/>
<path d="M588 98 H604" stroke="var(--sv-line)" fill="none" marker-end="url(#testing-sanitizers-arrow-2)"/>
<path d="M376 134 V190" stroke="var(--sv-line)" fill="none" marker-end="url(#testing-sanitizers-arrow-2)"/>
<rect x="272" y="194" width="208" height="64" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="376" y="220" text-anchor="middle" font-size="13" fill="var(--sv-ink)">覆盖率报告</text>
<text x="376" y="242" text-anchor="middle" font-size="12" fill="var(--sv-muted)">趋势跟踪，不追求 100%</text>
<path d="M524 134 V190" stroke="var(--sv-line)" fill="none" marker-end="url(#testing-sanitizers-arrow-2)"/>
<rect x="452" y="194" width="256" height="64" rx="8" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="580" y="220" text-anchor="middle" font-size="13" fill="var(--sv-ink)">夜间 libFuzzer</text>
<text x="580" y="242" text-anchor="middle" font-size="12" fill="var(--sv-muted)">固定时长，崩溃样本入库</text>
<path d="M376 258 V300" stroke="var(--sv-line)" fill="none" marker-end="url(#testing-sanitizers-arrow-2)"/>
<rect x="272" y="304" width="208" height="54" rx="8" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="376" y="327" text-anchor="middle" font-size="13" fill="var(--sv-ink)">合并门禁</text>
<text x="376" y="347" text-anchor="middle" font-size="12" fill="var(--sv-muted)">任一失败即阻断</text>
<path d="M580 258 C580 292 480 292 480 320" stroke="var(--sv-line)" fill="none" marker-end="url(#testing-sanitizers-arrow-2)"/>
</svg>
<figcaption>图 3 · 快检查放在每次提交，慢检查放到夜间；门禁只依赖确定性结果</figcaption>
</figure>
<p>CI 上要区分“确定性检查”和“统计性检查”。单元测试、ASan、UBSan 的结果是确定的，失败就应阻断合并。性能基准（benchmark）受 CPU 频率、邻居负载、温度影响，单次结果的波动足以让门禁误判，不适合直接做硬门禁；应固定机器、多次采样取中位数，跟踪趋势并设置告警阈值。这就是<mark>回归测试</mark>与<mark>基准测试</mark>的分工：前者断言行为不变，后者度量性能变化，混在一起会让 CI 要么频繁误报，要么形同虚设。</p>
<p>并发测试尤其忌讳用 <code>sleep</code> 制造时序。正确做法是让线程在条件变量或栅栏处同步，用超时作为失败信号而不是成功信号；对不稳定测试（flaky test）要隔离并修根因，不要用无限重试掩盖。覆盖率建议设“不得下降”的增量门槛，而不是拍一个 80% 的绝对值，后者会诱导写无断言的凑数测试。</p>
<div class="formula">可合并条件：构建零警告 ∧ 单元测试全过 ∧ ASan/UBSan 零报告 ∧ TSan 零报告 ∧ 覆盖率不低于基线</div>
</section>

<section class="sec">
<h2>常见误区与自测</h2>
<p>排障时先问四个问题：能不能用固定输入稳定复现？构建有没有 <code>-g</code> 与帧指针？报告的第一处违规在哪里，而不是最后的崩溃点在哪里？这个问题是否只出现在插桩构建里？把触发输入最小化之后，再决定是修代码、加断言还是补测试。</p>
<ul>
<li><b>“开了 ASan 就安全”</b>：它只覆盖地址类错误，语义错误和未初始化读仍在视野之外。</li>
<li><b>“覆盖率 100% 就充分”</b>：覆盖只说明代码被执行，不说明断言能发现错误；没有断言的测试行覆盖再高也没有意义。</li>
<li><b>“测试通过等于没 bug”</b>：测试是采样，输入空间通常远大于用例集合。</li>
<li><b>“基准测试跑一次就够了”</b>：单次测量混入了噪声，至少多次采样并报告分布。</li>
</ul>
<p>最后强调一次边界：Sanitizer、Valgrind、fuzzing 都是动态手段，只能看到实际执行到的路径。它们能大幅提高发现率，但不能替代设计评审、类型系统与静态分析。把多种手段叠起来用，才是工程上的正确答案。</p>
<h3>自测</h3>
<details class="quiz"><summary>Q1 · ASan 构建全部通过，能否说明程序没有未定义行为？</summary><div class="quiz__a">不能。ASan 主要覆盖越界、释放后使用、重复释放与泄漏，不检查未初始化读（属 MSan）、数据竞争（属 TSan）、有符号溢出与非法移位（属 UBSan），也不检查逻辑错误。而且它只报告本次执行实际走到的代码路径，未执行的分支即使有 UB 也不会被发现。正确说法是：本次运行未触发 ASan 所插桩的检查。</div></details>
<details class="quiz"><summary>Q2 · 为什么 TSan 不能和 ASan 放在同一个构建里？</summary><div class="quiz__a">两者都要接管内存访问并维护各自的影子状态与运行库，运行期互斥，链接在一起会直接报错或行为不可靠。工程做法是拆分构建：主构建用 ASan 加 UBSan，并发相关目标单独用 TSan 编译并运行。MSan 同样需要独立构建，而且要求所有依赖库都用 MSan 重新编译。</div></details>
<details class="quiz"><summary>Q3 · 单元测试行覆盖率 100%，是否说明测试充分？</summary><div class="quiz__a">不说明。覆盖率度量“代码是否被执行”，不度量“断言是否有效”。一段代码可以被执行却没有任何断言，或者只测了正常路径而没测异常与边界。分支覆盖、条件覆盖、MC/DC 更细，但依然不能证明行为正确。覆盖率适合作为趋势与增量门槛，不适合作为质量结论。</div></details>
<details class="quiz"><summary>Q4 · 回归测试与基准测试的本质区别是什么？</summary><div class="quiz__a">回归测试断言“行为与预期一致”，结果是布尔值，要求确定、快速，适合每次提交阻断合并；基准测试度量“性能指标是多少”，结果带噪声，需要固定环境、多次采样与统计判断，适合趋势监控而非硬门禁。把基准当回归会让 CI 频繁误报，把回归当基准则会让正确性退化无人发现。</div></details>
<h3>延伸阅读</h3>
<ul class="refs">
<li><b>GoogleTest 文档</b> — Google, 持续更新（github.com/google/googletest）。断言、夹具、参数化与死亡测试的权威说明，含 CMake 集成示例。</li>
<li><b>Clang Sanitizers 文档</b> — LLVM 项目（clang.llvm.org/docs/AddressSanitizer.html 等）。ASan、UBSan、TSan、MSan 的插桩原理、开销与运行期选项，是判断能力边界的原始依据。</li>
<li><b>libFuzzer 文档</b> — LLVM 项目（llvm.org/docs/LibFuzzer.html）。入口函数约定、语料与字典格式、并行参数，以及与其他 sanitizer 的组合方式。</li>
<li><b>《Effective Software Testing: A Developer's Guide》</b> — Maurício Aniche, Manning, 2022。系统讲测试设计、边界分析与可测试性，强调“测试要能失败”这一前提。</li>
<li><b>Valgrind 手册</b> — Valgrind 开发团队（valgrind.org/docs）。Memcheck、Helgrind、Massif 的行为与限制，适合与 ASan 的结论交叉验证。</li>
</ul>
</section>`
};
