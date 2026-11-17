window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["build-systems"] = {
  slug: "build-systems",
  title: "CMake 与构建系统",
  subtitle: "把编译命令变成可维护的工程",
  level: 5,
  cluster: "工程化",
  tags: ["CMake", "target", "依赖管理"],
  summary: "从 g++ 命令出发，讲清 CMake target 与属性传播、include 与链接两条链、构建类型、依赖管理、PCH 与 ccache、交叉编译与增量构建及排障路径。",
  keyPoints: [
    "构建系统是依赖图而非命令集合：描述、调度、增量三件事缺一不可",
    "现代 CMake 只围绕 target 与 usage requirements，PUBLIC/PRIVATE/INTERFACE 决定属性是否传给下游",
    "include 是编译期的头文件搜索，链接是链接期的符号解析，两条链的失败信息与修法完全不同",
    "依赖必须显式、版本必须锁定、构建必须可复现；增量出错先看图，再决定是否清空"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec"><h2>一、一句话直觉：构建系统是一张图，不是一叠命令</h2>
<p>第一次编译一个由三个文件组成的程序，你会在终端里敲出类似 <code>g++ -std=c++20 -O2 -Iinclude src/main.cpp src/core.cpp -o app</code> 的命令。文件变成五个，命令变成五行；再加一个平台、一个调试配置、一个第三方库，命令很快膨胀成脚本，脚本再膨胀成只有原作者敢动的泥团。<mark>构建系统</mark>（build system）就是把这团命令变成一张可检查、可复现、可增量的依赖图。</p>
<p>它要解决的从来不是「少敲几个字符」，而是三件工程问题：<mark>描述</mark>——每个产物由哪些输入、用什么命令生成；<mark>调度</mark>——按依赖顺序执行，能并行就并行；<mark>增量</mark>——只重建真正受影响的部分。三者缺一，项目在三人以上、三个月之后就会开始腐烂。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>构建系统像菜谱加厨房调度：菜谱说明每道菜要哪些原料和步骤，调度决定先切菜还是先烧水，增量是「冰箱里已有的半成品不再重做」。</div></div>
<p>要区分两类工具。CMake 是<mark>生成器</mark>（generator）：读 CMakeLists.txt，产出 Ninja、Makefile 或 Visual Studio 工程；Ninja、Make 是<mark>调度器</mark>，真正执行命令。这种分层让同一份工程描述服务不同 IDE 与平台，代价是多出一个配置阶段。本篇口径：CMake 3.25 及以上、Ninja、GCC 13 / Clang 17 / MSVC 19.3x，语言标准 C++20；路径与命令以 Linux x86-64 为主，Windows 差异单独标注。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="CMake 两阶段流程与由可执行文件、静态库、导入目标组成的目标依赖图">
<defs><marker id="build-systems-dag-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"/></marker></defs>
<text x="16" y="24" font-family="inherit" font-size="15" font-weight="600" fill="var(--sv-ink)">配置产出构建文件，构建工具再按依赖图执行</text>
<text x="16" y="46" font-family="inherit" font-size="12" fill="var(--sv-muted)">CMake 不编译，它只生成构建工具能读的图与命令</text>
<rect x="14" y="58" width="170" height="66" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="99" y="80" text-anchor="middle" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">① CMakeLists.txt</text>
<text x="99" y="100" text-anchor="middle" font-family="inherit" font-size="11" fill="var(--sv-muted)">声明 target 与属性</text>
<text x="99" y="117" text-anchor="middle" font-family="inherit" font-size="11" fill="var(--sv-muted)">纯文本，不执行编译</text>
<rect x="204" y="58" width="170" height="66" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="289" y="80" text-anchor="middle" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">② 配置 configure</text>
<text x="289" y="100" text-anchor="middle" font-family="inherit" font-size="11" fill="var(--sv-muted)">读缓存，探测编译器</text>
<text x="289" y="117" text-anchor="middle" font-family="inherit" font-size="11" fill="var(--sv-muted)">决定可用特性</text>
<rect x="394" y="58" width="160" height="66" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="474" y="80" text-anchor="middle" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">③ 生成 generate</text>
<text x="474" y="100" text-anchor="middle" font-family="inherit" font-size="11" fill="var(--sv-muted)">产出 build.ninja</text>
<text x="474" y="117" text-anchor="middle" font-family="inherit" font-size="11" fill="var(--sv-muted)">或 Makefile / .sln</text>
<rect x="574" y="58" width="172" height="66" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="660" y="80" text-anchor="middle" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">④ 构建 build</text>
<text x="660" y="100" text-anchor="middle" font-family="inherit" font-size="11" fill="var(--sv-muted)">按 DAG 并行调度</text>
<text x="660" y="117" text-anchor="middle" font-family="inherit" font-size="11" fill="var(--sv-muted)">执行编译与链接</text>
<line x1="184" y1="91" x2="200" y2="91" stroke="var(--sv-line)" marker-end="url(#build-systems-dag-arrow)"/>
<line x1="374" y1="91" x2="390" y2="91" stroke="var(--sv-line)" marker-end="url(#build-systems-dag-arrow)"/>
<line x1="554" y1="91" x2="570" y2="91" stroke="var(--sv-line)" marker-end="url(#build-systems-dag-arrow)"/>
<line x1="14" y1="140" x2="744" y2="140" stroke="var(--sv-line)"/>
<text x="16" y="164" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">目标依赖图：节点是 target，边是构建依赖</text>
<rect x="296" y="180" width="150" height="48" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="371" y="200" text-anchor="middle" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">atlas_app</text>
<text x="371" y="218" text-anchor="middle" font-family="inherit" font-size="11" fill="var(--sv-muted)">可执行文件</text>
<rect x="136" y="256" width="150" height="48" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="211" y="276" text-anchor="middle" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">atlas_core</text>
<text x="211" y="294" text-anchor="middle" font-family="inherit" font-size="11" fill="var(--sv-muted)">静态库</text>
<rect x="456" y="256" width="150" height="48" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="531" y="276" text-anchor="middle" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">fmt::fmt</text>
<text x="531" y="294" text-anchor="middle" font-family="inherit" font-size="11" fill="var(--sv-muted)">导入目标</text>
<rect x="136" y="326" width="150" height="44" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="211" y="346" text-anchor="middle" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">atlas_base</text>
<text x="211" y="364" text-anchor="middle" font-family="inherit" font-size="11" fill="var(--sv-muted)">静态库</text>
<line x1="360" y1="228" x2="221" y2="252" stroke="var(--sv-line)" marker-end="url(#build-systems-dag-arrow)"/>
<line x1="410" y1="228" x2="516" y2="252" stroke="var(--sv-line)" marker-end="url(#build-systems-dag-arrow)"/>
<line x1="211" y1="304" x2="211" y2="322" stroke="var(--sv-line)" marker-end="url(#build-systems-dag-arrow)"/>
<text x="598" y="190" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">图例</text>
<text x="598" y="214" font-family="inherit" font-size="12" fill="var(--sv-muted)">□ 节点 = 一个 target</text>
<text x="598" y="236" font-family="inherit" font-size="12" fill="var(--sv-muted)">→ 边 = 构建依赖</text>
<text x="598" y="262" font-family="inherit" font-size="12" fill="var(--sv-ink)">每个节点自带命令</text>
<text x="598" y="282" font-family="inherit" font-size="12" fill="var(--sv-muted)">源文件 → .o → 目标</text>
<text x="598" y="308" font-family="inherit" font-size="12" fill="var(--sv-ink)">改叶节点只重建下游</text>
<text x="598" y="334" font-family="inherit" font-size="12" fill="var(--sv-muted)">边同时携带 usage</text>
<text x="598" y="352" font-family="inherit" font-size="12" fill="var(--sv-muted)">requirements 属性</text>
</svg><figcaption>图 1 · CMake 的配置与生成两阶段，以及构建阶段读到的目标依赖图</figcaption></figure>
</section>

<section class="sec"><h2>二、target 是唯一的一等公民</h2>
<p>CMake 里值得当作核心概念的只有 <mark>target</mark>：<code>add_executable</code> 产生可执行目标，<code>add_library</code> 产生库目标。目标拥有<mark>属性</mark>（property）：源文件、include 目录、编译选项、链接库、语言标准。旧教程里的 <code>include_directories</code>、<code>link_directories</code>、<code>CMAKE_CXX_FLAGS</code> 是目录级或全局状态，会污染该目录及其子目录里的目标（最后一个则是全工程）；现代 CMake 的写法是「目标 + 属性」，即 target-based CMake。</p>
<p>关键在属性的<mark>传播</mark>（usage requirements）。<code>target_link_libraries(app PRIVATE core)</code> 不只是「把 core 链进来」，还会把 core 声明为 INTERFACE 的 include 目录、编译特性、宏定义传给 app。这就是依赖能自动工作的原因：core 自己知道「用我需要哪些头文件路径」，调用方不必重复抄一遍。若把库当成一堆散装文件、靠全局变量拼装，换一个目标就要再抄一次，抄漏就是构建失败。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>关键字</th><th>作用于本目标</th><th>传给依赖我的目标</th><th>典型用途</th></tr></thead><tbody>
<tr><td><code>PRIVATE</code></td><td>是</td><td>否</td><td>只在 .cpp 里出现的实现细节</td></tr>
<tr><td><code>INTERFACE</code></td><td>否</td><td>是</td><td>header-only 库、纯接口目标</td></tr>
<tr><td><code>PUBLIC</code></td><td>是</td><td>是</td><td>公开头文件里出现的类型与库</td></tr>
</tbody></table></div>
<div class="formula">PRIVATE = 我自己用；INTERFACE = 只给用我的人用；PUBLIC = 我和用我的人都要用。<br>判据只有一条：该依赖是否出现在公开头文件中。出现则 PUBLIC，仅出现在 .cpp 则 PRIVATE。</div>
<p>下面是一份最小但完整的工程描述，先用 <code>cmake -S . -B build</code> 配置并生成构建文件，再执行 <code>cmake --build build</code> 真正编译。它没有使用任何全局变量，所有信息都挂在目标上。</p>
<pre class="code" data-lang="bash"><code># CMakeLists.txt
cmake_minimum_required(VERSION 3.25)
project(atlas LANGUAGES CXX)

add_library(atlas_core STATIC src/core.cpp)
target_include_directories(atlas_core PUBLIC include)
target_compile_features(atlas_core PUBLIC cxx_std_20)

add_executable(atlas_app src/main.cpp)
target_link_libraries(atlas_app PRIVATE atlas_core)

enable_testing()
add_executable(atlas_tests tests/core_test.cpp)
target_link_libraries(atlas_tests PRIVATE atlas_core)
add_test(NAME core COMMAND atlas_tests)</code></pre>
<p><code>target_compile_features(atlas_core PUBLIC cxx_std_20)</code> 说明语言标准也是 usage requirement：PUBLIC 表示「用我的代码至少需要 C++20」，下游不必各自重复设置。相应地，不要只写 <code>set(CMAKE_CXX_STANDARD 20)</code>——它只是给该目录及子目录之后创建的目标一个默认值，同样会波及你并不想升级的旧代码。还要注意 CMake 默认保留编译器扩展，GCC/Clang 下实际得到的是 <code>gnu++20</code>；需要严格 ISO 模式时，给目标设置 <code>CXX_EXTENSIONS OFF</code>，才会落到 <code>-std=c++20</code>。</p>
</section>

<section class="sec"><h2>三、include 与链接是两条独立的链</h2>
<p>构建里最容易被混为一谈的是两条不同的链。<mark>编译期</mark>，预处理器按 <code>-I</code>（对应 CMake 的 INCLUDE_DIRECTORIES，以及从依赖传播来的 INTERFACE_INCLUDE_DIRECTORIES）找头文件；<mark>链接期</mark>，链接器按 <code>-L</code> 找库目录、按 <code>-l</code> 找库文件，并解析符号。两条链的输入不同、失败信息不同，修法也不同：头文件找不到是编译错误（<code>fatal error: atlas/core.hpp: No such file or directory</code>）；符号找不到是链接错误（<code>undefined reference to atlas::greet</code>）。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="头文件、源文件、目标文件、静态库与可执行文件之间的编译期与链接期关系">
<defs><marker id="build-systems-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"/></marker></defs>
<text x="16" y="24" font-family="inherit" font-size="15" font-weight="600" fill="var(--sv-ink)">编译期找声明，链接期找定义：两条链各管一段</text>
<text x="16" y="56" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-a)">编译期</text>
<text x="16" y="76" font-family="inherit" font-size="12" fill="var(--sv-muted)">-I 指定头文件搜索</text>
<text x="16" y="94" font-family="inherit" font-size="12" fill="var(--sv-muted)">只检查声明可见性</text>
<text x="620" y="56" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-b)">链接期</text>
<text x="620" y="76" font-family="inherit" font-size="12" fill="var(--sv-muted)">-L / -l 找库并解析符号</text>
<text x="620" y="94" font-family="inherit" font-size="12" fill="var(--sv-muted)">合并 .o 与库成员</text>
<rect x="300" y="46" width="160" height="44" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="380" y="64" text-anchor="middle" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">atlas/core.hpp</text>
<text x="380" y="82" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-muted)">声明 greet()</text>
<line x1="360" y1="90" x2="200" y2="136" stroke="var(--sv-line)" marker-end="url(#build-systems-arrow)"/>
<line x1="400" y1="90" x2="560" y2="136" stroke="var(--sv-line)" marker-end="url(#build-systems-arrow)"/>
<rect x="110" y="140" width="170" height="44" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="195" y="158" text-anchor="middle" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">main.cpp</text>
<text x="195" y="176" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-muted)">调用 atlas::greet</text>
<rect x="480" y="140" width="170" height="44" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="565" y="158" text-anchor="middle" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">core.cpp</text>
<text x="565" y="176" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-muted)">定义 atlas::greet</text>
<line x1="195" y1="184" x2="195" y2="216" stroke="var(--sv-line)" marker-end="url(#build-systems-arrow)"/>
<line x1="565" y1="184" x2="565" y2="216" stroke="var(--sv-line)" marker-end="url(#build-systems-arrow)"/>
<rect x="110" y="220" width="170" height="44" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="195" y="238" text-anchor="middle" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">main.o</text>
<text x="195" y="256" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-c)">符号 greet 未定义</text>
<rect x="480" y="220" width="170" height="44" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="565" y="238" text-anchor="middle" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">core.o</text>
<text x="565" y="256" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-b)">给出 greet 定义</text>
<line x1="565" y1="264" x2="565" y2="296" stroke="var(--sv-line)" marker-end="url(#build-systems-arrow)"/>
<rect x="480" y="300" width="170" height="48" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="565" y="320" text-anchor="middle" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">libatlas_core.a</text>
<text x="565" y="338" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-muted)">归档 core.o</text>
<line x1="195" y1="264" x2="268" y2="298" stroke="var(--sv-line)" marker-end="url(#build-systems-arrow)"/>
<line x1="480" y1="324" x2="416" y2="324" stroke="var(--sv-line)" marker-end="url(#build-systems-arrow)"/>
<rect x="230" y="300" width="180" height="48" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="320" y="320" text-anchor="middle" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">atlas_app</text>
<text x="320" y="338" text-anchor="middle" font-family="inherit" font-size="12" fill="var(--sv-muted)">可执行文件</text>
<text x="16" y="374" font-family="inherit" font-size="12" fill="var(--sv-muted)">编译期只需声明可见；到底有没有定义，要等链接器把 .o 与 .a 合起来才能回答。</text>
</svg><figcaption>图 2 · 头文件经编译进入 .o，.o 归档成静态库，最后由链接器合成可执行文件</figcaption></figure>
<p><code>target_link_libraries</code> 同时影响两条链，这正是它比裸 <code>-l</code> 更好的地方：它把「链接库」这个动作与「该库公开的头文件路径」绑在一起传播。若你用 <code>find_package</code> 拿到 <code>fmt::fmt</code> 这类<mark>导入目标</mark>（imported target），连编译选项和宏都由对方定义好，你只需要链接。</p>
<p>一个常见错位：库用 PUBLIC 暴露了 include/atlas，安装后却没有把该目录写进包配置，于是本机构建通过，下游 <code>find_package</code> 后编译失败。这属于打包与导出问题，展开在《ABI、动态库与二进制兼容》以及 CMake 的 install/export 部分。下面这段 C++20 代码就是图上那条链的可编译版本，三文件放到同一工程即可构建。</p>
<pre class="code" data-lang="cpp"><code>// include/atlas/core.hpp
#pragma once
#include &lt;string&gt;
#include &lt;string_view&gt;

namespace atlas {
std::string greet(std::string_view name);
}

// src/core.cpp
#include "atlas/core.hpp"

namespace atlas {
std::string greet(std::string_view name) {
    return "hello, " + std::string{name};
}
}

// src/main.cpp
#include &lt;iostream&gt;
#include "atlas/core.hpp"

int main() {
    std::cout &lt;&lt; atlas::greet("CMake") &lt;&lt; '\n';
    return 0;
}

// 命令行等价物：g++ -std=c++20 -Iinclude src/main.cpp src/core.cpp -o app</code></pre>
</section>

<section class="sec"><h2>四、静态库与动态库：写法几乎一样，账不一样</h2>
<p><code>add_library</code> 的类型关键字决定产物形态。<mark>静态库</mark>（static library）生成归档文件（Linux 的 .a、Windows 的 .lib），链接时把用到的目标文件复制进可执行文件；<mark>动态库</mark>（shared library）在 Linux 生成 .so、macOS 生成 .dylib、Windows 生成 .dll，可执行文件里只留符号引用，加载时由动态链接器解析。二者在构建系统里的差别很小，差别在部署、符号可见性与 ABI 约束。</p>
<div class="duo"><div class="duo__col"><h4>静态库 STATIC</h4><ul><li>产物自包含，拷贝即运行</li><li>每个程序各持一份代码，体积叠加</li><li>符号冲突在链接期暴露</li><li>适合内部组件、工具链固定的场景</li></ul></div><div class="duo__col"><h4>动态库 SHARED</h4><ul><li>多进程共享同一份代码页</li><li>可单独升级，但受 ABI 约束</li><li>需处理 rpath 与部署路径</li><li>适合对外的 SDK、插件体系</li></ul></div></div>
<p>动态库在多数 Unix 上需要<mark>位置无关代码</mark>（position-independent code，PIC）。CMake 生成的 SHARED 与 MODULE 目标默认开启 PIC，其他类型默认关闭（Windows 上该属性基本不起作用）；如果静态库最终要被打进 .so，需要 <code>set_target_properties(atlas_core PROPERTIES POSITION_INDEPENDENT_CODE ON)</code>，或统一开启 <code>CMAKE_POSITION_INDEPENDENT_CODE</code>。漏掉这一步的典型症状是链接动态库时报 relocation R_X86_64_PC32 不可用于共享对象。</p>
<p>链接顺序是一条硬规则，值得单独记住，因为它同时也是「不要手写链接命令」的理由：</p>
<div class="formula">GNU ld / gold / lld 按命令行从左到右单趟扫描：库 L 被处理时，只抽取满足「当前未定义符号集 U」的成员。<br>被依赖的库必须出现在依赖者右侧；循环依赖用 --start-group / --end-group 反复扫描。</div>
<p>MSVC 的 link.exe 不按这个模型工作，静态库顺序通常无关，但跨平台工程仍建议按依赖顺序书写。CMake 依据目标的 INTERFACE_LINK_LIBRARIES 计算传递闭包，并按依赖者在前、被依赖者在后的顺序排列链接项，多数顺序问题因此不再需要人工处理；但这不等于「彻底消除」：静态库之间的循环依赖、以及对重扫有特殊要求的链接组，仍要用 <code>$&lt;LINK_GROUP:RESCAN,...&gt;</code>（CMake 3.24+）或链接器的 <code>--start-group</code> 显式表达。手写 <code>-la -lb</code> 时顺序写反，症状就是「库明明装了却 undefined reference」。</p>
</section>

<section class="sec"><h2>五、构建类型：优化、调试与断言的打包</h2>
<p>优化级别、调试信息、断言开关不是三个独立选项，而是打包在一起的<mark>构建类型</mark>（build type）。单配置生成器（Ninja、Make）用 <code>CMAKE_BUILD_TYPE</code> 指定一种；多配置生成器（Visual Studio、Xcode、Ninja Multi-Config）用 <code>CMAKE_CONFIGURATION_TYPES</code> 一次生成多种，构建时用 <code>--config</code> 选择。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>类型</th><th>GCC/Clang 典型标志</th><th>NDEBUG</th><th>适用</th></tr></thead><tbody>
<tr><td><code>Debug</code></td><td>-g（-O0 为编译器默认优化级）</td><td>未定义</td><td>断点、单步、查看变量</td></tr>
<tr><td><code>Release</code></td><td>-O3 -DNDEBUG</td><td>定义</td><td>发布构建的起点</td></tr>
<tr><td><code>RelWithDebInfo</code></td><td>-O2 -g -DNDEBUG</td><td>定义</td><td>线上排障、采样剖析</td></tr>
<tr><td><code>MinSizeRel</code></td><td>-Os -DNDEBUG</td><td>定义</td><td>体积敏感的嵌入或分发</td></tr>
</tbody></table></div>
<p>注意两条边界。第一，CMake 在 GCC/Clang 下的 Release 默认是 <code>-O3 -DNDEBUG</code>（MSVC 默认为 <code>/O2 /DNDEBUG</code>），而 -O3 并不总是最快，热点代码经常要在 -O2 与 -O3 之间实测选择；第二，NDEBUG 会把 <code>assert</code> 变成空语句，任何带副作用的表达式写进 assert 都会在 Release 里消失，这是经典 bug。断言只该放纯检查。</p>
<p>不要把 <code>-Wall -Wextra -Werror</code> 写进全局 CMAKE_CXX_FLAGS。用 <code>target_compile_options</code> 配合生成器表达式，让不同编译器拿到各自合法的选项；这样 MSVC 不会收到 <code>-Wpedantic</code> 而产生 D9002「忽略未知选项」警告。生成器表达式里一次给出多个选项时，必须用分号分隔；若用空格，整串会被当成一个参数传给编译器。</p>
<pre class="code" data-lang="bash"><code>target_compile_options(atlas_core PRIVATE
  $&lt;$&lt;CXX_COMPILER_ID:GNU,Clang,AppleClang&gt;:-Wall;-Wextra;-Wpedantic&gt;
  $&lt;$&lt;CXX_COMPILER_ID:MSVC&gt;:/W4;/permissive-&gt;)</code></pre>
<p>Sanitizer 构建建议单独建一个配置或前缀（例如带 <code>-fsanitize=address,undefined</code> 的 Debug 变体），不要混进发布流水线，否则会同时改变性能与崩溃行为；具体用法在《测试、Sanitizer 与模糊测试》展开。</p>
</section>

<section class="sec"><h2>六、依赖管理：find_package、FetchContent 与包管理器</h2>
<p>第三方库进入工程有三条主流路径，选择取决于控制力与可复现性要求。<code>find_package</code> 查找系统或已安装的包；<code>FetchContent</code> 在配置阶段下载源码并作为子工程构建；包管理器（vcpkg、Conan）负责下载、构建、版本锁定与二进制缓存。</p>
<p><code>find_package</code> 有两种模式。<mark>Config 模式</mark>读库自带的 FooConfig.cmake，得到 <code>Foo::Foo</code> 这类导入目标，信息最完整；<mark>Module 模式</mark>靠 CMake 自带的 FindFoo.cmake 去猜路径，容易找到版本不符或缺少依赖信息的库。优先要求上游提供 config 包，其次才接受 module 脚本。注意基本签名 <code>find_package(Foo)</code> 默认先试 Module、再试 Config；要强制走 Config，可用完整签名 <code>find_package(Foo CONFIG REQUIRED)</code>，或设置 <code>CMAKE_FIND_PACKAGE_PREFER_CONFIG</code>。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>方式</th><th>何时用</th><th>优点</th><th>代价</th></tr></thead><tbody>
<tr><td><code>find_package</code>（config）</td><td>系统或 CI 已装好依赖</td><td>干净、快、目标信息完整</td><td>依赖环境一致，需自己装</td></tr>
<tr><td><code>FetchContent</code></td><td>小依赖，想锁定源码</td><td>一条命令即可复现</td><td>配置变慢，各项目各编一份</td></tr>
<tr><td>vcpkg（manifest）</td><td>多平台，需要二进制缓存</td><td>版本清单可提交、缓存省时</td><td>需引导工具链，首次较慢</td></tr>
<tr><td>Conan 2</td><td>复杂依赖图、私有仓库</td><td>表达力强，可审计可离线</td><td>学习曲线更陡</td></tr>
</tbody></table></div>
<pre class="code" data-lang="bash"><code>include(FetchContent)
FetchContent_Declare(
  fmt
  GIT_REPOSITORY https://github.com/fmtlib/fmt.git
  GIT_TAG 11.0.2
  GIT_SHALLOW TRUE
)
FetchContent_MakeAvailable(fmt)
target_link_libraries(atlas_app PRIVATE fmt::fmt)</code></pre>
<p>注意 <code>GIT_SHALLOW TRUE</code> 适合 tag 或分支；若为了可复现性把 <code>GIT_TAG</code> 换成 commit 哈希，浅克隆可能取不到该对象，需要去掉 <code>GIT_SHALLOW</code>，或者改用能按提交取包的镜像与包管理器。</p>
<p>vcpkg 的 manifest 模式把依赖写进项目里的 vcpkg.json，随代码一起提交，CI 与开发者拿到同一份清单；但只提交依赖名还不够，端口版本由 baseline 决定，应在 vcpkg.json 里写 <code>builtin-baseline</code>（或在 vcpkg-configuration.json 的 default-registry 里写 baseline），否则清单相同、解析出的版本仍可能漂移。Conan 2 用 conanfile 描述依赖图，<code>conan install</code> 生成 CMakeToolchain 与 CMakeDeps 文件，适合依赖层次深、需要私有仓库的团队。</p>
<pre class="code" data-lang="bash"><code># 经典模式：直接安装三元组对应的库
vcpkg install fmt gtest --triplet x64-linux

# manifest 模式：提交 vcpkg.json，让 CI 按清单还原
# { "name": "atlas", "version": "0.1.0", "dependencies": ["fmt", "gtest"] }</code></pre>
<p>无论选哪种，两条纪律不变：版本必须锁定（优先写完整 commit 哈希；tag 可能被上游移动或删除，只能作为可读标注，绝不要用 master 或浮动分支），构建必须能离线复现（有本地缓存或镜像）。依赖管理真正买的是可复现性，不是省事；一个无法复现的构建，在半年后就是无法维护的构建。</p>
</section>

<section class="sec"><h2>七、预编译头、ccache 与交叉编译</h2>
<p><mark>预编译头</mark>（precompiled header，PCH）把稳定不变的头文件（STL、大型第三方头）预处理一次，后续翻译单元直接加载二进制结果，省掉重复解析。CMake 3.16+ 的 <code>target_precompile_headers</code> 会自动处理各编译器差异。收益取决于头文件规模与重复次数：一个包含 vector、string、unordered_map 的公共头，在几十个 TU 上能省可观时间；头文件天天改，收益归零甚至因失效检测变负。</p>
<pre class="code" data-lang="bash"><code>target_precompile_headers(atlas_app PRIVATE
  &lt;vector&gt; &lt;string&gt; &lt;unordered_map&gt; &lt;iostream&gt;)</code></pre>
<p><mark>编译器缓存</mark>（compiler cache，ccache / sccache）以「预处理结果（源码与被包含头文件的内容）+ 编译选项 + 编译器版本/内容 + 关键环境变量」为键缓存目标文件；direct mode 下直接对源文件与头文件内容做哈希。它对反复切分支、反复全量重建的收益最大；对一次干净构建，收益接近零，只剩哈希与查找开销。用 <code>CMAKE_CXX_COMPILER_LAUNCHER</code> 接入，不要直接改编译器路径，否则 CMake 的编译器探测会误判，进而影响特性检测结果。</p>
<pre class="code" data-lang="bash"><code>cmake -S . -B build -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_CXX_COMPILER_LAUNCHER=ccache
cmake --build build --parallel</code></pre>
<p><mark>交叉编译</mark>（cross-compilation）是在 x86 主机上产出 ARM 等目标平台的二进制。CMake 的做法是 <mark>toolchain file</mark>：声明目标系统名、处理器、编译器前缀与 sysroot。一旦设置了 CMAKE_SYSTEM_NAME，CMake 就把 <code>CMAKE_CROSSCOMPILING</code> 置为真：<code>try_compile</code> 只做编译与链接、本来就不运行产物；需要运行结果的 <code>try_run</code> 不会在本机直接执行目标程序（除非配置了 <code>CMAKE_CROSSCOMPILING_EMULATOR</code>），而是返回无法运行并让调用方走后备路径。再配合 <code>CMAKE_FIND_ROOT_PATH_MODE_*</code> 系列变量，find_package 的库与头文件搜索根会被限制在 sysroot 内，避免误用主机的 x86 库；程序通常仍从主机侧查找，需要时用 <code>MODE_PROGRAM</code> 单独控制。</p>
<pre class="code" data-lang="bash"><code># toolchains/aarch64-linux-gnu.cmake
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR aarch64)
set(CMAKE_CXX_COMPILER aarch64-linux-gnu-g++)
set(CMAKE_FIND_ROOT_PATH /usr/aarch64-linux-gnu)
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_PACKAGE ONLY)

# 在源码根目录执行；工具链文件用绝对路径最稳妥
cmake -S . -B build-arm64 -G Ninja \
  -DCMAKE_TOOLCHAIN_FILE="$PWD/toolchains/aarch64-linux-gnu.cmake" \
  -DCMAKE_BUILD_TYPE=Release</code></pre>
<p>三个提速与移植手段都不改变正确性，只改变速度与可移植性。按团队实际瓶颈逐个引入，比一次性全上更容易定位问题：PCH 先看头文件稳定性，ccache 先看重复构建比例，交叉编译先确认 sysroot 里的依赖齐全。</p>
</section>

<section class="sec"><h2>八、构建图、增量构建与排障</h2>
<p>回到开头那张图：一次构建的正确性，取决于依赖图是否完整。目标文件依赖源文件，也依赖它包含的每一个头文件；这条边如果没被声明，改了头文件就不会触发重编译，你会得到一个「半新半旧」的二进制。CMake 生成 Ninja 构建文件时，会让 GCC/Clang 用 <code>-MD -MT &lt;obj&gt; -MF &lt;depfile&gt;</code> 产出 <mark>depfile</mark>（.d 文件），并让 Ninja 以 <code>deps = gcc</code> 读入；MSVC 则走 <code>/showIncludes</code>。头文件依赖由此自动收集，正常路径下不需要手写。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="构建流水线六个阶段与传统四层缓存各自服务的阶段">
<defs><marker id="build-systems-pipe-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"/></marker></defs>
<text x="16" y="24" font-family="inherit" font-size="15" font-weight="600" fill="var(--sv-ink)">构建流水线与缓存层：每层命中都能让下游跳过工作</text>
<text x="16" y="46" font-family="inherit" font-size="12" fill="var(--sv-muted)">一次完整构建 = 配置 + 生成 + 编译 + 链接 + 测试，缓存决定了哪几步真的执行</text>
<rect x="14" y="58" width="108" height="58" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="68" y="82" text-anchor="middle" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">① 源码</text>
<text x="68" y="102" text-anchor="middle" font-family="inherit" font-size="11" fill="var(--sv-muted)">.cpp .hpp</text>
<rect x="136" y="58" width="108" height="58" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="190" y="82" text-anchor="middle" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">② 配置</text>
<text x="190" y="102" text-anchor="middle" font-family="inherit" font-size="11" fill="var(--sv-muted)">CMake</text>
<rect x="258" y="58" width="108" height="58" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="312" y="82" text-anchor="middle" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">③ 生成</text>
<text x="312" y="102" text-anchor="middle" font-family="inherit" font-size="11" fill="var(--sv-muted)">Ninja</text>
<rect x="380" y="58" width="108" height="58" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="434" y="82" text-anchor="middle" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">④ 编译</text>
<text x="434" y="102" text-anchor="middle" font-family="inherit" font-size="11" fill="var(--sv-muted)">每个 TU → .o</text>
<rect x="502" y="58" width="108" height="58" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="556" y="82" text-anchor="middle" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">⑤ 链接</text>
<text x="556" y="102" text-anchor="middle" font-family="inherit" font-size="11" fill="var(--sv-muted)">.o + 库</text>
<rect x="624" y="58" width="112" height="58" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="680" y="82" text-anchor="middle" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">⑥ 测试</text>
<text x="680" y="102" text-anchor="middle" font-family="inherit" font-size="11" fill="var(--sv-muted)">ctest</text>
<line x1="122" y1="87" x2="132" y2="87" stroke="var(--sv-line)" marker-end="url(#build-systems-pipe-arrow)"/>
<line x1="244" y1="87" x2="254" y2="87" stroke="var(--sv-line)" marker-end="url(#build-systems-pipe-arrow)"/>
<line x1="366" y1="87" x2="376" y2="87" stroke="var(--sv-line)" marker-end="url(#build-systems-pipe-arrow)"/>
<line x1="488" y1="87" x2="498" y2="87" stroke="var(--sv-line)" marker-end="url(#build-systems-pipe-arrow)"/>
<line x1="610" y1="87" x2="620" y2="87" stroke="var(--sv-line)" marker-end="url(#build-systems-pipe-arrow)"/>
<line x1="14" y1="140" x2="744" y2="140" stroke="var(--sv-line)"/>
<text x="16" y="166" font-family="inherit" font-size="13" font-weight="600" fill="var(--sv-ink)">缓存层：命中即跳过对应阶段，键必须覆盖所有影响输出的输入</text>
<rect x="14" y="182" width="172" height="76" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="28" y="204" font-family="inherit" font-size="12" font-weight="600" fill="var(--sv-ink)">CMakeCache.txt</text>
<text x="28" y="224" font-family="inherit" font-size="11" fill="var(--sv-muted)">编译器与选项探测结果</text>
<text x="28" y="242" font-family="inherit" font-size="11" fill="var(--sv-a)">服务 ②，换工具链需重配</text>
<rect x="200" y="182" width="172" height="76" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="214" y="204" font-family="inherit" font-size="12" font-weight="600" fill="var(--sv-ink)">.ninja_deps / .ninja_log</text>
<text x="214" y="224" font-family="inherit" font-size="11" fill="var(--sv-muted)">头文件依赖与构建日志</text>
<text x="214" y="242" font-family="inherit" font-size="11" fill="var(--sv-a)">服务 ③，决定谁变脏</text>
<rect x="386" y="182" width="172" height="76" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="400" y="204" font-family="inherit" font-size="12" font-weight="600" fill="var(--sv-ink)">ccache 目录</text>
<text x="400" y="224" font-family="inherit" font-size="11" fill="var(--sv-muted)">按内容寻址的目标文件</text>
<text x="400" y="242" font-family="inherit" font-size="11" fill="var(--sv-b)">服务 ④，命中跳过编译</text>
<rect x="572" y="182" width="172" height="76" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="586" y="204" font-family="inherit" font-size="12" font-weight="600" fill="var(--sv-ink)">PCH 文件</text>
<text x="586" y="224" font-family="inherit" font-size="11" fill="var(--sv-muted)">公共头的预编译二进制</text>
<text x="586" y="242" font-family="inherit" font-size="11" fill="var(--sv-b)">服务 ④，头变即失效</text>
<text x="16" y="292" font-family="inherit" font-size="12" fill="var(--sv-ink)">缓存的键若漏掉编译器版本、宏或头文件内容，就会复用错误结果：构建成功但行为异常，比构建失败更难查。</text>
<text x="16" y="320" font-family="inherit" font-size="12" fill="var(--sv-muted)">交叉编译时工具链整体替换：PCH 必须分目录存放；ccache 也建议按工具链隔离，便于排查与清理。</text>
<text x="16" y="352" font-family="inherit" font-size="12" fill="var(--sv-muted)">图中阶段划分对应 CMake 的三步调用：配置（cmake -S -B）、构建（cmake --build）、测试（ctest）。</text>
</svg><figcaption>图 3 · 从配置到测试的六个阶段，以及 CMakeCache、Ninja 日志、ccache、PCH 四层缓存</figcaption></figure>
<p>增量构建的规则可以用一句话概括：</p>
<div class="formula">重建集合 R = { t | t 的输出缺失，或存在输入 i，mtime(i) &gt; mtime(t) } ∪ { 下游(t) | t ∈ R }<br>构建系统对 R 做拓扑排序后执行，其余目标直接跳过。这个 mtime 模型是理解增量的起点：Ninja 还会比较命令哈希（记在 .ninja_log），CMake 在 CMakeLists.txt 或工具链变化时会重新生成。正确性完全依赖依赖图的完整性。</div>
<p>排障时先问「图对不对」，再问「命令对不对」。CMake 提供几个直接看图的工具：<code>--trace-expand</code> 打印每条命令的展开过程；<code>--graphviz=graph.dot</code> 导出目标依赖图；<code>CMAKE_EXPORT_COMPILE_COMMANDS</code> 生成 compile_commands.json，供 clangd 与静态分析使用；Ninja 的 <code>-t deps</code> 查看某个目标记录了哪些头文件依赖，<code>-t graph</code> 查看 DAG 本身，<code>-d explain</code> 打印「为什么这条命令要跑」。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>rm -rf build 能「修好」大多数构建问题，因为它把增量问题变回全量问题。但它同时销毁了证据：到底是 depfile 漏了、缓存脏了，还是生成器状态不一致，你永远不会知道。先 --trace 或看 -t deps，再决定是否清空。</div></div>
<p>常见误区清单：在 <code>add_executable</code> 里用 <code>file(GLOB)</code> 收集源文件，新增文件后不重新配置就不参与构建（<code>CONFIGURE_DEPENDS</code> 可以缓解，但会带来每次构建的扫描成本，官方仍建议显式列出源文件）；把生成的文件写进源码树，导致 clean 不彻底；在 CMakeLists 里下载依赖却不锁版本；依赖 <code>-I ../include</code> 这类相对路径，换台机器即失效。每一条都能用三句话检查：依赖必须显式，路径必须相对工程根，外部输入必须锁版本。</p>
</section>

<section class="sec"><h2>九、自测</h2>
<details class="quiz"><summary>Q1 · app 依赖 core，core 又依赖 fmt。命令行写成 <code>-lfmt -lcore</code>，为什么会 undefined reference？</summary><div class="quiz__a"><p>多数 Unix 链接器单趟从左到右扫描。处理 <code>-lfmt</code> 时，core 还没有提出对 fmt 符号的需求，因此 fmt 的成员不会被抽取；轮到 core 时它产生了未定义符号，但链接器已经走过 fmt。把顺序改成 <code>-lcore -lfmt</code> 即可。CMake 的 <code>target_link_libraries(app PRIVATE core)</code> 会根据 core 的 INTERFACE_LINK_LIBRARIES 自动排出依赖者在前、被依赖者在后的顺序，因而不会踩这个坑。循环依赖则用 <code>--start-group</code> 与 <code>--end-group</code> 让链接器反复扫描。</p></div></details>
<details class="quiz"><summary>Q2 · core 的公开头文件 core.hpp 里 <code>#include &lt;fmt/format.h&gt;</code>，fmt 应该 PRIVATE 还是 PUBLIC？</summary><div class="quiz__a"><p>PUBLIC。任何编译 core.hpp 的下游 TU 都需要找到 fmt 的头文件，这条依赖必须经 usage requirements 传下去；若标 PRIVATE，下游会报找不到 fmt/format.h。反过来，若 core 只在 core.cpp 内部用 fmt 拼字符串、公开头文件完全不提及，就应标 PRIVATE，避免把 fmt 泄漏成下游的编译依赖，减少它们的构建负担与版本约束。判断标准始终是「该依赖是否出现在公开接口里」。</p></div></details>
<details class="quiz"><summary>Q3 · 改了 include/atlas/core.hpp，却没有任何目标重编，可能是什么原因？</summary><div class="quiz__a"><p>依赖图里缺了这条边，或者时间戳没有按预期变化。常见来源有四类：手写 Makefile 没有生成 depfile（未加 -MD 或没有 include .d 文件）；头文件被复制、检出时保留了旧 mtime，或文件服务器与构建机存在时钟偏差，mtime 并没有变大；头文件本身是构建生成物，却没有声明生成规则；构建目录是旧的，depfile 里记录的还是另一份源码树的路径。注意：GCC/Clang 的 depfile 会记录实际被包含的头文件，与它是否位于 <code>target_include_directories</code> 中无关，所以「头文件不在 include 目录里」本身不会导致漏追踪。排查手段：用 <code>ninja -t deps</code> 看该目标记录的依赖列表，用 <code>ninja -d explain</code> 看判定原因，或检查编译命令里是否有 -MD/-MF 与 .d 产物。修复后应做一次全量构建，再验证增量行为。</p></div></details>
</section>

<section class="sec"><h2>十、延伸阅读</h2>
<ul class="refs">
<li><b>CMake Documentation</b> — Kitware。官方手册，target、属性、install/export 与生成器表达式的权威定义，遇到行为差异先查这里。</li>
<li><b>Professional CMake: A Practical Guide</b> — Craig Scott。按工程场景组织的现代 CMake 指南，对 usage requirements 与包导出的讲解尤其清楚。</li>
<li><b>vcpkg Documentation</b> — Microsoft。manifest 模式、三元组（triplet）与二进制缓存的官方说明。</li>
<li><b>Conan 2 Documentation</b> — JFrog。依赖图建模、工具链集成与私有仓库的官方文档。</li>
<li><b>Ninja Manual</b> — Evan Martin。构建文件语法、depfile 与 <code>-t</code> 系列调试命令的原始说明。</li>
</ul>
</section>`
};
