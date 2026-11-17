window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["modules"] = {
  slug: "modules",
  title: "C++20 Modules",
  subtitle: "告别头文件的下一次编译模型变革",
  level: 6,
  cluster: "深入与演进",
  tags: ["modules", "import", "编译模型"],
  summary: "从头文件模型的重复解析讲起，拆解 module、export、分区与 BMI 编译模型，说明与头文件的差异、工具链现状、迁移策略和 ABI 边界。",
  keyPoints: [
    "头文件是预处理阶段的文本粘贴，模块是编译器管理的语义接口",
    "export 决定可见性，模块内未导出的名字对导入方不可见，宏也不会随 export 传播",
    "接口单元产出 BMI，导入方加载 BMI 而非重新解析源码；BMI 是编译器私有格式，不可分发",
    "模块不改变平台 ABI，也不保证跨编译器二进制兼容；迁移应从叶子库开始并保留头文件出口"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec"><h2>一、一句话直觉：从「复制文本」到「交换语义」</h2>
<p>写过稍有规模的 C++ 项目，大概率遇到过这些事：改一个头文件里的私有成员，上层目录全部重编；某个宏在 A 文件里定义，却在 B 文件里意外生效；两个库各自定义了同名类，链接器沉默地把它们合并成一份。这些问题的共同根源不是某条语法写错，而是 C++ 沿用了半个世纪的<mark>头文件模型</mark>（header model）：<code>#include</code> 只是预处理器执行的文本粘贴，编译器对每个编译单元都要从零重新理解同一批声明。</p>
<p>C++20 引入的<mark>模块</mark>（modules）改变了这个前提。模块的接口单元被编译一次，产出一份二进制模块接口（BMI）；导入方读取这份已经完成语义分析的接口，而不是重新读一遍源码文本。它带来三件头文件给不了的能力：<mark>可见性</mark>由 <code>export</code> 显式控制，<mark>宏</mark>不再跨文件泄漏，<mark>编译</mark>从「每个 TU 重复解析」变成「一次解析、多次加载」。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>头文件像把整本书复印给每个学生，谁都可以在页边写批注，下一份复印件还会带上这些批注；模块像发一张课程大纲，只列出老师正式公开的章节，批注留在老师自己的备课本里。</div></div>
<p>但需要先明确边界：模块不是把 <code>#include</code> 机械替换成 <code>import</code> 就完事。它改变了编译单元的定义、构建系统的依赖图、库的分发方式，而各工具链的成熟度并不一致。这篇要回答的是：它解决了什么、代价是什么、什么条件下值得迁移。</p>
</section>

<section class="sec"><h2>二、头文件模型欠下的三笔债</h2>
<p>要理解模块，先把头文件模型看清楚。<mark>编译单元</mark>（translation unit, TU）是预处理之后的单个源文件：一个 <code>.cpp</code> 加上它递归包含的所有头文件，展开宏、去掉注释后得到的完整文本。一个包含 <code>&lt;vector&gt;</code> 的源文件，预处理后可能有几万行；十个源文件就重复十遍。</p>
<p>第一笔债是<mark>重复解析</mark>。包含保护（include guard）或 <code>#pragma once</code> 只能防止同一个 TU 内重复包含，无法阻止不同 TU 重复解析同一份头文件；包含图越密，编译时间增长越快。</p>
<p>第二笔债是<mark>宏与包含顺序</mark>。<code>#include</code> 是文本操作，头文件的含义取决于它被包含之前已经定义了哪些宏。<code>min</code>、<code>max</code>、<code>assert</code>、<code>NDEBUG</code> 都能在不知不觉中改变另一份头文件的展开结果。包含顺序不同，编译结果可能不同；这类问题往往只在特定平台或特定选项下出现。</p>
<p>第三笔债是<mark>单一定义规则</mark>（One Definition Rule, ODR）与可见性。类定义、<code>inline</code> 函数、模板必须在其出现的所有 TU 中逐 token 相同，否则程序行为未定义；但编译器一次只看一个 TU，链接器也只能抓到一部分强符号冲突。与此同时，头文件里的所有名字对包含者全部可见，隐藏实现只能靠 <code>pimpl</code>、匿名命名空间等间接手段。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="头文件模型与模块模型的编译流程对比：头文件在每个编译单元中重复文本展开和解析，模块接口只编译一次产出 BMI，导入方直接加载">
<defs>
<marker id="modules-fig1-arrow" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto"><path d="M0,0 L0,8 L8,4 Z" fill="var(--sv-line)"/></marker>
</defs>
<text x="24" y="34" font-size="14" fill="var(--sv-muted)" font-family="inherit">头文件模型：每个编译单元各做一遍</text>
<rect x="24" y="48" width="130" height="56" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="89" y="72" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">main.cpp</text>
<text x="89" y="91" text-anchor="middle" font-size="12" fill="var(--sv-muted)" font-family="inherit">#include "a.h"</text>
<line x1="154" y1="76" x2="192" y2="76" stroke="var(--sv-line)" marker-end="url(#modules-fig1-arrow)"/>
<rect x="194" y="48" width="160" height="56" rx="8" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="274" y="72" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">预处理器</text>
<text x="274" y="91" text-anchor="middle" font-size="12" fill="var(--sv-ink)" font-family="inherit">文本拼接、宏展开</text>
<line x1="354" y1="76" x2="392" y2="76" stroke="var(--sv-line)" marker-end="url(#modules-fig1-arrow)"/>
<rect x="394" y="48" width="160" height="56" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="474" y="72" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">完整 TU</text>
<text x="474" y="91" text-anchor="middle" font-size="12" fill="var(--sv-muted)" font-family="inherit">数万行，重新解析</text>
<line x1="554" y1="76" x2="592" y2="76" stroke="var(--sv-line)" marker-end="url(#modules-fig1-arrow)"/>
<rect x="594" y="48" width="130" height="56" rx="8" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="659" y="80" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">main.o</text>
<text x="24" y="124" font-size="12" fill="var(--sv-muted)" font-family="inherit">同一批头文件被 N 个 TU 重复展开、重复分析，宏状态随包含顺序变化</text>

<line x1="24" y1="146" x2="736" y2="146" stroke="var(--sv-line)" stroke-dasharray="4 5"/>

<text x="24" y="178" font-size="14" fill="var(--sv-muted)" font-family="inherit">模块模型：接口只编译一次</text>
<rect x="24" y="194" width="140" height="54" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="94" y="217" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">math.cppm</text>
<text x="94" y="236" text-anchor="middle" font-size="12" fill="var(--sv-muted)" font-family="inherit">接口单元</text>
<line x1="164" y1="221" x2="202" y2="221" stroke="var(--sv-line)" marker-end="url(#modules-fig1-arrow)"/>
<rect x="204" y="194" width="150" height="54" rx="8" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="279" y="217" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">语义分析一次</text>
<text x="279" y="236" text-anchor="middle" font-size="12" fill="var(--sv-ink)" font-family="inherit">导出声明、模板、内联体</text>
<line x1="354" y1="221" x2="392" y2="221" stroke="var(--sv-line)" marker-end="url(#modules-fig1-arrow)"/>
<rect x="394" y="186" width="156" height="72" rx="8" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="472" y="210" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">BMI</text>
<text x="472" y="229" text-anchor="middle" font-size="12" fill="var(--sv-ink)" font-family="inherit">二进制模块接口</text>
<text x="472" y="247" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">编译器私有格式</text>

<rect x="24" y="292" width="140" height="54" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="94" y="315" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">main.cpp</text>
<text x="94" y="334" text-anchor="middle" font-size="12" fill="var(--sv-muted)" font-family="inherit">import math;</text>
<line x1="164" y1="319" x2="202" y2="319" stroke="var(--sv-line)" marker-end="url(#modules-fig1-arrow)"/>
<rect x="204" y="292" width="150" height="54" rx="8" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="279" y="315" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">加载 BMI</text>
<text x="279" y="334" text-anchor="middle" font-size="12" fill="var(--sv-ink)" font-family="inherit">不再预处理与解析</text>
<line x1="354" y1="319" x2="392" y2="319" stroke="var(--sv-line)" marker-end="url(#modules-fig1-arrow)"/>
<rect x="394" y="292" width="156" height="54" rx="8" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="472" y="325" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">main.o</text>
<line x1="472" y1="258" x2="472" y2="286" stroke="var(--sv-line)" marker-end="url(#modules-fig1-arrow)"/>
<text x="570" y="214" font-size="12" fill="var(--sv-muted)" font-family="inherit">导入方读接口，</text>
<text x="570" y="233" font-size="12" fill="var(--sv-muted)" font-family="inherit">不读源码文本</text>
<text x="570" y="322" font-size="12" fill="var(--sv-muted)" font-family="inherit">BMI 版本与编译器</text>
<text x="570" y="341" font-size="12" fill="var(--sv-muted)" font-family="inherit">必须匹配</text>
</svg><figcaption>图 1 · 头文件模型与模块模型的编译流程对比</figcaption></figure>
</section>

<section class="sec"><h2>三、module、export、import 的最小闭环</h2>
<p>模块的基本单位是<mark>模块单元</mark>（module unit），一个模块由若干模块单元组成，共享同一个模块名。接口单元以 <code>export module 名字;</code> 开头，这是<mark>模块声明</mark>（module declaration），按标准必须是文件中的第一条声明（全局模块片段除外）。模块名由点分隔的标识符组成，例如 <code>atlas.math</code>。</p>
<p><code>export</code> 加在声明前，表示这个实体对导入方可见；没有 <code>export</code> 的名字属于模块内部，导入方在语义上根本看不到它，而不是「能看到但链接不到」。<code>import</code> 把另一个模块的导出声明引入当前作用域，只能写在命名空间作用域，不能放进函数体内。</p>
<pre class="code" data-lang="cpp"><code>// math.cppm —— 主模块接口单元
export module math;                 // 模块声明：文件中的第一条声明

export int add(int a, int b);       // 只导出声明，定义放在实现单元

export import :geo;                 // 导入并重新导出接口分区

// geo.cppm —— 接口分区
export module math:geo;

export namespace geo {              // 命名空间可以整体导出
    struct Point { double x, y; };
    double dist2(const Point&amp; p) {
        return p.x * p.x + p.y * p.y;
    }
}

// math.cpp —— 实现单元
module math;                        // 不带 export，隐式导入主接口

int add(int a, int b) {             // 定义主接口中声明的函数
    return a + b;
}

// main.cpp —— 使用方
#include &lt;iostream&gt;                // 头文件仍可正常使用
import math;                        // 只看到 export 的名字

int main() {
    std::cout &lt;&lt; add(2, 3) &lt;&lt; '\n';
    geo::Point p{3.0, 4.0};
    std::cout &lt;&lt; geo::dist2(p) &lt;&lt; '\n';
}</code></pre>
<p>这段代码在 C++20 口径下是完整的：接口单元、分区、实现单元和使用方各就各位。注意 <code>main.cpp</code> 里的 <code>#include &lt;iostream&gt;</code> 并没有被替换，C++20 标准库本身不是模块，<code>import std;</code> 属于 C++23 的标准库模块（P2465），不能想当然地使用。</p>
<div class="formula">头文件模型：TU = 源文件 ⊕ 预处理文本展开(所有 include) → 每个 TU 重新解析<br>模块模型：TU = 源文件 ⊕ 已编译接口(BMI) → 导入方只加载语义，不展开文本</div>
</section>

<section class="sec"><h2>四、接口单元、实现单元与模块分区</h2>
<p>一个模块里的文件按角色分成四类。<mark>主接口单元</mark>（primary module interface unit）用 <code>export module 名字;</code> 声明，整个模块对外的门面由它和它导出的分区构成。<mark>实现单元</mark>（implementation unit）用 <code>module 名字;</code> 开头，不带 <code>export</code>，按标准会隐式导入本模块的主接口，因此可以直接写接口中声明的函数体。</p>
<p><mark>模块分区</mark>（module partition）把大模块拆成若干子单元，名字形如 <code>模块名:分区名</code>。接口分区写 <code>export module math:core;</code>，实现分区写 <code>module math:core;</code>。分区只能在模块内部导入（常见写法是 <code>import :core;</code>）；模块外部写 <code>import math:core;</code> 是非法的，外部只能导入整个 <code>math</code>。分区不是「子模块」，而是模块的实现细节划分。</p>
<p>还有两个片段值得知道。<mark>全局模块片段</mark>（global module fragment）写成单独的 <code>module;</code>，后面只能放预处理指令，用来安全地包含系统头文件：头文件里的声明归属于<mark>全局模块</mark>，不会附着到本模块上，导入方也不会通过这次 <code>import</code> 看到它们；宏不参与模块边界，在这份模块单元里仍然可用，只是不会随 <code>import</code> 传播出去。<mark>私有模块片段</mark>（private module fragment）写成 <code>module :private;</code>，只能出现在主接口单元末尾，用于放置不希望被导入方看到的定义；按 C++20 规则，带分区的模块不能使用它。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="一个模块内部的主接口单元、接口分区、实现分区与实现单元，以及外部导入方只能看到主接口导出的内容">
<defs>
<marker id="modules-fig2-arrow" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto"><path d="M0,0 L0,8 L8,4 Z" fill="var(--sv-line)"/></marker>
</defs>
<rect x="290" y="10" width="180" height="42" rx="8" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="380" y="37" text-anchor="middle" font-size="14" fill="var(--sv-ink)" font-family="inherit">外部：import math;</text>
<line x1="380" y1="52" x2="380" y2="80" stroke="var(--sv-line)" marker-end="url(#modules-fig2-arrow)"/>
<rect x="70" y="82" width="620" height="270" rx="14" fill="var(--sv-bg)" stroke="var(--sv-line)" stroke-dasharray="6 5"/>
<text x="86" y="106" font-size="13" fill="var(--sv-muted)" font-family="inherit">模块 math 的边界</text>
<rect x="96" y="122" width="250" height="70" rx="8" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="221" y="147" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">主接口单元 math.cppm</text>
<text x="221" y="167" text-anchor="middle" font-size="12" fill="var(--sv-ink)" font-family="inherit">export module math;</text>
<text x="221" y="184" text-anchor="middle" font-size="12" fill="var(--sv-ink)" font-family="inherit">export import :geo;</text>
<rect x="414" y="122" width="250" height="70" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="539" y="147" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">接口分区 math:geo</text>
<text x="539" y="167" text-anchor="middle" font-size="12" fill="var(--sv-muted)" font-family="inherit">export module math:geo;</text>
<text x="539" y="184" text-anchor="middle" font-size="12" fill="var(--sv-muted)" font-family="inherit">对外声明随主接口导出</text>
<rect x="96" y="228" width="250" height="70" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="221" y="253" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">实现分区 math:core</text>
<text x="221" y="273" text-anchor="middle" font-size="12" fill="var(--sv-muted)" font-family="inherit">module math:core;</text>
<text x="221" y="290" text-anchor="middle" font-size="12" fill="var(--sv-muted)" font-family="inherit">仅供模块内部 import</text>
<rect x="414" y="228" width="250" height="70" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="539" y="253" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">实现单元 math.cpp</text>
<text x="539" y="273" text-anchor="middle" font-size="12" fill="var(--sv-muted)" font-family="inherit">module math;</text>
<text x="539" y="290" text-anchor="middle" font-size="12" fill="var(--sv-muted)" font-family="inherit">隐式导入主接口，写函数体</text>
<line x1="221" y1="122" x2="221" y2="100" stroke="var(--sv-line)" marker-end="url(#modules-fig2-arrow)"/>
<line x1="414" y1="157" x2="350" y2="157" stroke="var(--sv-line)" marker-end="url(#modules-fig2-arrow)"/>
<line x1="414" y1="263" x2="350" y2="263" stroke="var(--sv-line)" marker-end="url(#modules-fig2-arrow)"/>
<text x="86" y="332" font-size="12" fill="var(--sv-muted)" font-family="inherit">分区名只在模块内部有效；外部无法 import math:core</text>
</svg><figcaption>图 2 · 模块单元的四种角色与可见边界</figcaption></figure>
</section>

<section class="sec"><h2>五、编译模型与 BMI：一次解析，多次加载</h2>
<p>编译接口单元时，编译器执行完整的前端流程：展开全局模块片段里的预处理、解析、做名字查找与语义检查，然后把这些结果序列化成一份<mark>二进制模块接口</mark>（Built Module Interface, BMI）。导入方加载 BMI 时，得到的是已经完成语义分析的声明集合，不再做文本预处理和语法分析，也不必从源码重新解析接口里定义的内联函数与模板；但模板仍在使用点按需实例化，内联函数是否真的内联由优化器决定，把 BMI 理解成「替你实例化好一切」是常见的误读。</p>
<p>BMI 没有标准格式。Clang 产出 <code>.pcm</code>，MSVC 产出 <code>.ifc</code>，GCC 产出 <code>.gcm</code> 并放在 <code>gcm.cache</code> 目录。它绑定编译器、编译器版本、目标平台、标准库版本以及影响 ABI 的编译选项；换一个 <code>-std</code>、换一个 <code>-D</code>、换一台机器，都可能失效。因此 BMI 是构建产物，不是分发格式：不提交仓库，不跨机器缓存，不试图用 GCC 生成的 BMI 喂给 Clang。</p>
<p>它和预编译头（PCH）不是一回事。PCH 缓存的是某个头文件集合预处理后的 token 流，以及编译器内部的解析结果（具体形式由实现决定），它仍然运行在文本包含模型里：只有当包含它的 TU 在它之前的宏状态、包含顺序完全一致时才能复用，解决的只是「重复解析」这一层，可见性与宏传播规则都没有改变。BMI 缓存的是模块的<mark>语义接口</mark>，带有归属（哪个模块）和可见性（是否导出）信息，从模型层面切断了宏与文本顺序的影响。</p>
<p>这也带来一个构建上的新约束：编译 <code>main.cpp</code> 之前，必须先知道它 <code>import</code> 了哪些模块，并把对应的 BMI 准备好。也就是说，构建系统需要<mark>扫描</mark>源文件里的 import 声明，动态生成依赖边。P1689 定义了编译器向构建系统报告模块依赖的格式；CMake 3.28 起用 <code>FILE_SET CXX_MODULES</code> 和内建的扫描机制处理这件事；Ninja 通过 dyndep 动态依赖支持它。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="模块构建依赖图：构建系统先扫描 import 声明，再按依赖顺序编译模块接口产出 BMI，最后编译使用方并链接">
<defs>
<marker id="modules-fig3-arrow" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto"><path d="M0,0 L0,8 L8,4 Z" fill="var(--sv-line)"/></marker>
<marker id="modules-fig3-dash" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto"><path d="M0,0 L0,8 L8,4 Z" fill="var(--sv-muted)"/></marker>
</defs>
<rect x="230" y="10" width="300" height="44" rx="8" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="380" y="37" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">构建系统扫描 import（P1689）</text>
<line x1="330" y1="54" x2="150" y2="88" stroke="var(--sv-muted)" stroke-dasharray="4 4" marker-end="url(#modules-fig3-dash)"/>
<line x1="380" y1="54" x2="380" y2="88" stroke="var(--sv-muted)" stroke-dasharray="4 4" marker-end="url(#modules-fig3-dash)"/>
<line x1="430" y1="54" x2="610" y2="88" stroke="var(--sv-muted)" stroke-dasharray="4 4" marker-end="url(#modules-fig3-dash)"/>
<text x="520" y="66" font-size="11" fill="var(--sv-muted)" font-family="inherit">得到文件名与模块名的映射</text>

<rect x="60" y="94" width="180" height="50" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="150" y="117" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">math.cppm</text>
<text x="150" y="135" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">export module math;</text>
<rect x="290" y="94" width="180" height="50" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="380" y="117" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">geo.cppm</text>
<text x="380" y="135" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">math:geo</text>
<rect x="520" y="94" width="180" height="50" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="610" y="117" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">main.cpp</text>
<text x="610" y="135" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">import math;</text>

<line x1="150" y1="144" x2="150" y2="182" stroke="var(--sv-line)" marker-end="url(#modules-fig3-arrow)"/>
<line x1="380" y1="144" x2="380" y2="182" stroke="var(--sv-line)" marker-end="url(#modules-fig3-arrow)"/>
<rect x="60" y="188" width="180" height="50" rx="8" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="150" y="211" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">math.pcm</text>
<text x="150" y="229" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">BMI</text>
<rect x="290" y="188" width="180" height="50" rx="8" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="380" y="211" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">geo.pcm</text>
<text x="380" y="229" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">BMI</text>
<line x1="380" y1="144" x2="380" y2="182" stroke="var(--sv-line)" marker-end="url(#modules-fig3-arrow)"/>
<line x1="470" y1="115" x2="515" y2="115" stroke="var(--sv-line)" marker-end="url(#modules-fig3-arrow)" stroke-dasharray="4 4"/>
<text x="492" y="106" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">import</text>

<line x1="150" y1="238" x2="150" y2="272" stroke="var(--sv-line)" marker-end="url(#modules-fig3-arrow)"/>
<line x1="380" y1="238" x2="380" y2="272" stroke="var(--sv-line)" marker-end="url(#modules-fig3-arrow)"/>
<rect x="60" y="278" width="180" height="50" rx="8" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="150" y="309" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">math.o</text>
<rect x="290" y="278" width="180" height="50" rx="8" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="380" y="309" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">geo.o</text>

<line x1="610" y1="144" x2="610" y2="238" stroke="var(--sv-line)" marker-end="url(#modules-fig3-arrow)"/>
<line x1="520" y1="215" x2="490" y2="215" stroke="var(--sv-line)" marker-end="url(#modules-fig3-arrow)"/>
<text x="610" y="200" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">读 BMI</text>
<rect x="520" y="260" width="180" height="50" rx="8" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="610" y="291" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">main.o</text>
<line x1="240" y1="303" x2="288" y2="303" stroke="var(--sv-line)" marker-end="url(#modules-fig3-arrow)"/>
<line x1="470" y1="303" x2="518" y2="303" stroke="var(--sv-line)" marker-end="url(#modules-fig3-arrow)"/>
<rect x="290" y="340" width="180" height="32" rx="8" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="380" y="361" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">链接 → app</text>
<line x1="380" y1="328" x2="380" y2="338" stroke="var(--sv-line)" marker-end="url(#modules-fig3-arrow)"/>
<line x1="610" y1="310" x2="500" y2="344" stroke="var(--sv-line)" marker-end="url(#modules-fig3-arrow)"/>
</svg><figcaption>图 3 · 模块构建依赖图：扫描在前，BMI 居中，编译与链接在后</figcaption></figure>
</section>

<section class="sec"><h2>六、与头文件逐项对比</h2>
<p>把两者放在同一张表里，差异才看得清。比较的是<em>语言模型</em>，工具链缺口留到下一节。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>维度</th><th>头文件</th><th>模块</th></tr></thead><tbody>
<tr><td>接口形态</td><td>预处理阶段的文本，逐 TU 展开</td><td>编译后的语义接口，产出 BMI</td></tr>
<tr><td>宏</td><td>对包含者全部可见，随顺序变化</td><td>不随 <code>export</code> 导出，模块内宏不外泄</td></tr>
<tr><td>包含顺序</td><td>可能改变语义与展开结果</td><td><code>import</code> 的先后不影响语义</td></tr>
<tr><td>可见性</td><td>包含即全部可见</td><td>只有 <code>export</code> 的名字可见</td></tr>
<tr><td>ODR</td><td>跨 TU 靠人工保证定义一致</td><td>实体归属模块，仍需保证一致，但边界更明确</td></tr>
<tr><td>编译开销</td><td>每个 TU 重复解析同一批声明</td><td>接口解析一次，导入方加载 BMI</td></tr>
<tr><td>模板与内联</td><td>每个 TU 各自实例化，链接期合并</td><td>定义随 BMI 提供；模板仍在使用点实例化，是否复用由实现决定</td></tr>
<tr><td>分发</td><td>头文件 + 库二进制</td><td>接口源码或 BMI；BMI 不跨编译器</td></tr>
<tr><td>工具链</td><td>所有编译器成熟支持</td><td>支持不均衡，需按版本验证</td></tr>
</tbody></table></div>
<p>需要强调两点。第一，模块并没有废除 ODR：同一个模块的多个单元仍然要遵守定义一致性，跨模块的同名实体也仍可能冲突。它做的是把「哪些声明属于哪个模块」变成语言层面的明确信息，让编译器在更多场景下能发现违规，而不是让违规变得合法。</p>
<p>第二，模块与头文件可以共存。C++20 提供<mark>头单元</mark>（header unit），写作 <code>import "legacy.h";</code> 或 <code>import &lt;vector&gt;;</code>，把传统头文件包装成一个可导入的单元。它是迁移期的桥，不是终点：头单元的支持程度比命名模块更差，本质上仍是对头文件的包装，声明与 ODR 规则照旧；宏能否随 <code>import</code> 获得取决于实现，不应作为可移植保证，依赖宏的代码仍应继续 <code>#include</code>。</p>
<pre class="code" data-lang="cpp"><code>// 迁移期常见的写法：全局模块片段包住系统头，让其中的声明留在全局模块
module;                             // 全局模块片段开始
#include &lt;cstdint&gt;
#include &lt;string&gt;
module atlas.util;                  // 模块声明

export std::uint64_t hash_of(const std::string&amp; s);</code></pre>
</section>

<section class="sec"><h2>七、工具链现状与构建系统集成</h2>
<p>截至 2024-2025 年，三家主流编译器的 C++20 模块支持都已可用，但完整度和行为差异明显。下表是「能开始用」的门槛，具体项目仍应锁定版本并跑自己的测试集。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>工具链</th><th>启用方式</th><th>BMI 产物</th><th>现状与注意</th></tr></thead><tbody>
<tr><td>MSVC</td><td><code>/std:c++20</code>（VS 2019 16.11 起；16.8 起提供模块支持）</td><td><code>.ifc</code></td><td>实现最完整，与 MSBuild、Visual Studio 集成最好；跨平台项目仍需验证其他编译器</td></tr>
<tr><td>Clang</td><td><code>-std=c++20</code>，Clang 16 起大幅补齐</td><td><code>.pcm</code></td><td>需显式 <code>--precompile</code> 或由构建系统驱动；分区、头单元等场景在旧版本有缺口</td></tr>
<tr><td>GCC</td><td><code>-std=c++20 -fmodules-ts</code>，GCC 11 起</td><td><code>.gcm</code></td><td>基本流程可用，分区与头单元的成熟度相对落后，需关注版本差异</td></tr>
<tr><td>标准库模块</td><td><code>import std;</code></td><td>随工具链</td><td>由 P2465 引入 C++23，各工具链到位时间不同，不能按 C++20 能力假设</td></tr>
</tbody></table></div>
<p>构建系统是模块落地的真正门槛。传统构建图里，源文件到目标文件是一条边，头文件依赖靠 depfile 事后补记；模块要求构建系统<em>先</em>知道 import 关系，才能决定编译顺序。CMake 3.28 开始提供一等支持：模块文件放进 <code>FILE_SET CXX_MODULES</code>，CMake 自动扫描并调度；是否扫描由目标属性 <code>CXX_SCAN_FOR_MODULES</code> 控制，实现单元、头单元、<code>import std;</code> 等子能力的支持程度随 CMake 版本与编译器而不同，3.30 引入的 <code>CXX_MODULE_STD</code> 用于启用 <code>import std;</code>，且仍需编译器提供对应的标准库模块。更早的 CMake 需要手写扫描脚本，维护成本很高。</p>
<pre class="code" data-lang="bash"><code># CMake 3.28+ 的模块工程骨架（示意）
cmake_minimum_required(VERSION 3.28)
project(atlas LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(math)
target_sources(math
  PUBLIC FILE_SET CXX_MODULES FILES math.cppm geo.cppm
  PRIVATE math.cpp)
target_compile_features(math PUBLIC cxx_std_20)

add_executable(app main.cpp)
target_link_libraries(app PRIVATE math)</code></pre>
<p>依赖图有一个硬约束：模块单元不能直接或间接导入自身，接口之间互相 import 属于 ill-formed。构建系统检测到环时通常直接报错，而不是像头文件那样靠包含保护绕过去；这更严格，也更早暴露分层问题。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>不要把模块当成「更快的头文件」而无脑替换。模块的收益主要在接口稳定、被大量复用的库上；一次性小程序、模板很重且频繁改动的代码，收益可能被构建复杂度和工具链缺陷抵消。先量编译时间，再决定迁移范围。</div></div>
</section>

<section class="sec"><h2>八、迁移策略、ABI 与边界</h2>
<p>迁移按风险从低到高推进，而不是一次性把所有 <code>.h</code> 改成 <code>.cppm</code>。先统一工具链与标准版本，让构建系统管理 BMI 目录且不进版本库；再从叶子库开始，把「声明与定义分离清楚」的代码改成接口单元加实现单元；系统头用全局模块片段包住，或逐步换成头单元；最后才对外发布模块接口，并保留头文件门面给未迁移的下游。</p>
<div class="duo"><div class="duo__col"><h4>适合先迁移</h4><p>接口稳定、被多个目标复用的基础库；包含大量模板与内联代码、重复实例化严重的库；团队工具链统一、CI 可控的项目。</p></div><div class="duo__col"><h4>建议暂缓</h4><p>依赖大量宏配置的代码；需要同时支持多个老旧编译器的库；对外二进制 SDK，且下游无法同步升级工具链的场景。</p></div></div>
<p>ABI 是最容易被误解的部分。模块是<em>语言层</em>的编译模型，不定义新的二进制接口标准：对象布局、调用约定、名称修饰仍由目标平台 ABI 决定，模块化不会让不同编译器产出的目标文件变得可混链。BMI 更是编译器私有格式，跨版本、跨平台、跨编译选项都不可移植。实现可能因为模块归属而改变内联函数与模板实例的符号合并方式，这属于 ABI 实现细节，标准并不保证具体形式。</p>
<p>因此，「用了模块，ABI 就更稳定」是错误推论。对外发布时，要么继续发头文件，要么同时提供模块接口与头文件门面，并明确告知用户 BMI 必须由本地工具链重新生成。接口单元改动会让所有导入者重编，粒度是「整个模块接口」；实现单元改动只影响自身，这是模块真正的增量优势。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="模块迁移决策树：按工具链统一程度、是否对外发布、是否依赖宏三个问题选择迁移路径">
<defs>
<marker id="modules-fig4-arrow" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto"><path d="M0,0 L0,8 L8,4 Z" fill="var(--sv-line)"/></marker>
</defs>
<rect x="280" y="14" width="200" height="46" rx="8" fill="var(--sv-a2)" stroke="var(--sv-a)"/>
<text x="380" y="42" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">现有 C++ 代码库</text>
<line x1="380" y1="60" x2="380" y2="82" stroke="var(--sv-line)" marker-end="url(#modules-fig4-arrow)"/>
<rect x="240" y="86" width="280" height="52" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="380" y="108" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">工具链能否统一并升级？</text>
<text x="380" y="127" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">至少一个支持 C++20 模块的编译器</text>
<line x1="240" y1="112" x2="160" y2="112" stroke="var(--sv-line)" marker-end="url(#modules-fig4-arrow)"/>
<text x="200" y="104" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">否</text>
<rect x="24" y="86" width="132" height="52" rx="8" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="90" y="108" text-anchor="middle" font-size="12" fill="var(--sv-ink)" font-family="inherit">暂缓迁移</text>
<text x="90" y="127" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">先优化 PCH / 包含图</text>
<line x1="380" y1="138" x2="380" y2="160" stroke="var(--sv-line)" marker-end="url(#modules-fig4-arrow)"/>
<text x="394" y="154" font-size="11" fill="var(--sv-muted)" font-family="inherit">是</text>
<rect x="240" y="164" width="280" height="52" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="380" y="186" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">是否对外发布二进制 SDK？</text>
<text x="380" y="205" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">下游能否同步升级工具链</text>
<line x1="520" y1="190" x2="600" y2="190" stroke="var(--sv-line)" marker-end="url(#modules-fig4-arrow)"/>
<text x="560" y="182" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">是</text>
<rect x="602" y="164" width="134" height="52" rx="8" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="669" y="186" text-anchor="middle" font-size="12" fill="var(--sv-ink)" font-family="inherit">模块 + 头文件门面</text>
<text x="669" y="205" text-anchor="middle" font-size="11" fill="var(--sv-ink)" font-family="inherit">BMI 本地生成</text>
<line x1="380" y1="216" x2="380" y2="238" stroke="var(--sv-line)" marker-end="url(#modules-fig4-arrow)"/>
<text x="394" y="232" font-size="11" fill="var(--sv-muted)" font-family="inherit">否</text>
<rect x="240" y="242" width="280" height="52" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="380" y="264" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">是否大量依赖宏配置？</text>
<text x="380" y="283" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">min/max、条件编译、平台开关</text>
<line x1="240" y1="268" x2="160" y2="268" stroke="var(--sv-line)" marker-end="url(#modules-fig4-arrow)"/>
<text x="200" y="260" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">是</text>
<rect x="24" y="242" width="132" height="52" rx="8" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="90" y="264" text-anchor="middle" font-size="12" fill="var(--sv-ink)" font-family="inherit">只迁移无宏依赖部分</text>
<text x="90" y="283" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">宏配置留在头文件</text>
<line x1="380" y1="294" x2="380" y2="316" stroke="var(--sv-line)" marker-end="url(#modules-fig4-arrow)"/>
<text x="394" y="310" font-size="11" fill="var(--sv-muted)" font-family="inherit">否</text>
<rect x="240" y="320" width="280" height="46" rx="8" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="380" y="340" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">改造成接口单元 + 实现单元</text>
<text x="380" y="357" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">从叶子库开始，逐步向上</text>
</svg><figcaption>图 4 · 迁移决策树：按工具链、发布形态与宏依赖选择路径</figcaption></figure>
</section>

<section class="sec"><h2>九、常见误区与排障</h2>
<p><b>「import 会带上宏」。</b>不会。模块导出的是声明，宏属于预处理，不参与 <code>export</code>。如果导入方确实需要某个头文件的宏，只能自行包含该头文件，或改用头单元（宏能否随 <code>import</code> 获得取决于实现）；这两种做法都会把头文件的文本依赖带回来，属于过渡手段。</p>
<p><b>「BMI 可以提交仓库或跨机器缓存」。</b>不可以。BMI 与编译器版本、目标平台、编译选项、标准库版本绑定，换环境即失效。构建系统应把它放在单独的构建目录，清理时连同一起删除，而不是 gitignore 之后又手工拷贝到别处。</p>
<p><b>「模块内可以随便 include」。</b>接口单元里在模块声明之后写 <code>#include</code>，会把头文件里的声明附着到本模块上；如果同一个头文件也被其他 TU 以普通方式包含，同一实体就同时属于模块与全局模块，容易出现重复定义或 ODR 违规。正确做法是系统头放全局模块片段，项目内头文件改成模块或头单元。</p>
<p><b>「分区就是子模块，可以外部导入」。</b>不是。分区只能在模块内部导入（如 <code>import :名字;</code>），外部写 <code>import math:core;</code> 是 ill-formed。分区必须由主接口显式 <code>export import</code>，其声明才会出现在 <code>import math;</code> 的可见集合里。</p>
<p><b>「改了实现也要全量重编」。</b>接口单元改动会导致所有导入者重编，但实现单元改动只影响自身目标文件；若观察到的行为不符，先检查构建系统是否把实现单元错误地放进了模块文件集。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>排障时优先确认三件事：<code>import</code> 的模块名是否与接口单元的 <code>export module</code> 完全一致；构建系统是否真的扫描并生成了 BMI；编译器版本与生成 BMI 的版本是否同一套。绝大多数「模块找不到」都落在这三条上。</div></div>
</section>

<section class="sec"><h2>十、自测</h2>
<details class="quiz"><summary>Q1 · 在模块接口单元里定义了一个宏 <code>#define SCALE 2</code>，导入该模块的源文件为什么用不了 <code>SCALE</code>？</summary><div class="quiz__a"><p>宏在预处理阶段处理，而模块导出的是经过语义分析的声明，<code>export</code> 不作用于宏。导入方的预处理器从来没有见过这个 <code>#define</code>，因此 <code>SCALE</code> 不会被替换。若确实需要共享常量，应导出 <code>inline constexpr int SCALE = 2;</code> 这类实体，而不是宏。</p></div></details>
<details class="quiz"><summary>Q2 · 主接口写了 <code>export module math;</code> 和 <code>export import :core;</code>，但 <code>core.cppm</code> 写成了 <code>module math:core;</code> 而不是 <code>export module math:core;</code>。外部 <code>import math;</code> 后能使用 core 里的声明吗？</summary><div class="quiz__a"><p>不能。<code>module math:core;</code> 是实现分区，不是接口分区；实现分区不能被主接口 <code>export import</code>，其声明也不会进入模块的导出集合。接口分区必须以 <code>export module math:core;</code> 声明。</p></div></details>
<details class="quiz"><summary>Q3 · 团队把 Clang 生成的 <code>.pcm</code> 缓存到 CI 共享存储，供 GCC 构建复用，为什么必然失败？</summary><div class="quiz__a"><p>BMI 没有标准格式，是编译器私有的序列化结果，绑定编译器种类、版本、目标平台、编译选项与标准库版本。Clang 的 <code>.pcm</code> 无法被 GCC 读取。正确做法是每个工具链、每个配置各自生成 BMI，并放在构建树内随缓存失效。</p></div></details>
<details class="quiz"><summary>Q4 · 为什么「用了模块，ABI 就稳定了」是错的？</summary><div class="quiz__a"><p>模块改变的是编译模型与可见性，不改变目标平台的 ABI：对象布局、调用约定、名称修饰仍由平台 ABI 决定，模块也不提供跨编译器的二进制兼容。对外发布仍需按原有 ABI 规则评估兼容性，并为下游提供头文件门面或要求其用本地工具链重建模块。</p></div></details>
</section>

<section class="sec"><h2>十一、延伸阅读</h2>
<ul class="refs">
<li><b>cppreference · Modules</b> — cppreference.com。模块语法、模块单元分类、分区与全局模块片段的最新条目，查标准细节的第一站。</li>
<li><b>P1103R3 · Merging Modules</b> — Richard Smith, 2019。被 C++20 采纳的模块核心提案，解释了模块声明、分区与可见性规则的设计动机。</li>
<li><b>GCC · C++ Modules Documentation</b> — GCC 团队。<code>-fmodules-ts</code> 的启用方式、<code>gcm.cache</code> 布局与已知限制的官方说明。</li>
<li><b>Clang · Standard C++ Modules</b> — LLVM 文档。<code>--precompile</code>、<code>-fmodule-file</code> 与 BMI 管理的官方指南，附各版本支持差异。</li>
<li><b>Microsoft Learn · C++ Modules</b> — Microsoft。<code>/std:c++20</code> 下的模块用法、<code>.ifc</code> 产物与 Visual Studio 工程集成。</li>
<li><b>P1689R5 · Format for describing dependencies of source files</b> — Boris Kolpackov, 2020。规定编译器如何把源文件的 import 依赖报告给构建系统，CMake 等构建系统的模块扫描建立在这个格式上。</li>
</ul>
</section>`
};
