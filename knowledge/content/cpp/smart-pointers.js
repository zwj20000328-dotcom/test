window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["smart-pointers"] = {
  slug: "smart-pointers",
  title: "智能指针与所有权建模",
  subtitle: "unique_ptr 默认，shared_ptr 慎用",
  level: 2,
  cluster: "对象与资源",
  tags: ["unique_ptr", "shared_ptr", "weak_ptr"],
  summary: "从所有权建模出发，讲清 unique_ptr 的独占与删除器、shared_ptr 的控制块、原子计数与线程安全边界，以及 weak_ptr 破环与选型规则。",
  keyPoints: [
    "所有权应写进类型：默认 unique_ptr，确需共享才用 shared_ptr",
    "shared_ptr 的拷贝不是免费的：控制块原子计数会带来缓存行争用",
    "make_shared 合并分配省一次分配，但 weak_ptr 存活时整块内存不释放",
    "循环引用要在建模层面用 weak_ptr 或非拥有指针打破"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>一句话直觉：所有权应该写进类型里</h2>
<p>看到一个 <code>T*</code>，你无法从类型上判断三件事：谁负责 <code>delete</code>、它指向的对象是否还活着、这份所有权能否被复制。智能指针的价值不是"自动 delete"，而是把这三个问题的答案编码进类型系统，让编译器替你检查。<mark>所有权语义</mark>（ownership semantics）是这篇的主线：默认独占，确有必要才共享，观察者永远不拥有。</p>
<p>现代 C++ 的默认选择是 <code>std::unique_ptr</code>（C++11）：独占、只能移动、无状态删除器时几乎没有运行时开销。只有当你确实需要"多个所有者共同决定对象何时销毁"时，才升级到 <code>std::shared_ptr</code>（C++11）。共享所有权不是更高级的所有权，而是更贵、更容易出错的一种建模方式；它引入控制块、原子引用计数和循环引用问题。标准库没有垃圾回收，shared_ptr 也不是垃圾回收器。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>把对象想成一把钥匙：unique_ptr 是唯一一把钥匙，换手时必须交出去；shared_ptr 是配了很多把钥匙，最后一个人离开才关灯；weak_ptr 是监控摄像头，能看到灯还亮着，但不能开灯，也不负责关灯。</div></div>
<p>下面按"先建模、再实现、最后算账"的顺序展开：先讲所有权与 unique_ptr 的移动，再拆 shared_ptr 的控制块与计数，然后处理循环引用和线程安全边界，最后给出一张选型表和排障清单。拷贝构造与移动构造的语言规则在 copy-move-semantics 一篇，这里只在必要处引用结论。</p>
</section>

<section class="sec">
<h2>所有权语义：unique_ptr 的移动就是所有权转移</h2>
<p><code>std::unique_ptr&lt;T&gt;</code> 表达<mark>独占所有权</mark>（exclusive ownership）：同一时刻只有一个 unique_ptr 负责销毁 T。它是 move-only 类型，拷贝构造和拷贝赋值被删除；<code>std::move</code> 之后源指针变为空，目标接管资源。这不是"禁用拷贝"的语法技巧，而是所有权在类型层面的体现：复制一个独占所有者没有语义，转移才有。</p>
<p>典型 64 位实现中，无状态删除器的 <code>unique_ptr&lt;T&gt;</code> 与裸指针同为 8 字节，删除器通过空基类优化（EBO, Empty Base Optimization）不占空间；换成函数指针删除器后通常变成 16 字节。标准不保证大小与布局，这属于 ABI 与实现细节。无论哪种，解引用与 <code>get()</code> 都不产生额外指令，因此 unique_ptr 常被称作<mark>零开销抽象</mark>（zero-cost abstraction）。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="所有权关系图：unique_ptr 独占对象，多个 shared_ptr 通过控制块共享对象，weak_ptr 与裸指针只观察不拥有">
<defs>
<marker id="smart-pointers-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-line)"/></marker>
<marker id="smart-pointers-dash" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-muted)"/></marker>
</defs>
<text x="380" y="26" text-anchor="middle" font-size="15" font-family="inherit" fill="var(--sv-ink)">所有权关系：实线拥有，虚线观察</text>
<rect x="16" y="44" width="232" height="316" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="132" y="70" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">A · 独占</text>
<rect x="38" y="86" width="188" height="56" rx="8" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="132" y="109" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">unique_ptr&lt;T&gt;</text>
<text x="132" y="129" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">ptr + deleter</text>
<line x1="132" y1="142" x2="132" y2="180" stroke="var(--sv-line)" marker-end="url(#smart-pointers-arrow)"/>
<rect x="38" y="184" width="188" height="66" rx="8" fill="var(--sv-bg)" stroke="var(--sv-a)"/>
<text x="132" y="211" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">T 对象</text>
<text x="132" y="231" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">堆上，1 个所有者</text>
<text x="132" y="280" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">移动 = 所有权转移</text>
<text x="132" y="302" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">离开作用域 = delete</text>
<rect x="264" y="44" width="280" height="316" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="404" y="70" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">B · 共享</text>
<rect x="280" y="86" width="112" height="36" rx="7" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="336" y="109" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">shared_ptr A</text>
<rect x="280" y="132" width="112" height="36" rx="7" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="336" y="155" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">shared_ptr B</text>
<rect x="280" y="178" width="112" height="36" rx="7" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="336" y="201" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">shared_ptr C</text>
<line x1="392" y1="104" x2="428" y2="128" stroke="var(--sv-line)" marker-end="url(#smart-pointers-arrow)"/>
<line x1="392" y1="150" x2="428" y2="150" stroke="var(--sv-line)" marker-end="url(#smart-pointers-arrow)"/>
<line x1="392" y1="196" x2="428" y2="172" stroke="var(--sv-line)" marker-end="url(#smart-pointers-arrow)"/>
<rect x="432" y="104" width="96" height="92" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="480" y="126" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">控制块</text>
<text x="480" y="146" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">strong = 3</text>
<text x="480" y="165" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">weak = 1</text>
<text x="480" y="184" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">deleter</text>
<line x1="480" y1="196" x2="480" y2="236" stroke="var(--sv-line)" marker-end="url(#smart-pointers-arrow)"/>
<rect x="432" y="240" width="96" height="58" rx="8" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="480" y="265" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">T 对象</text>
<text x="480" y="285" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">同一份</text>
<text x="404" y="328" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">strong 归零才析构</text>
<rect x="560" y="44" width="184" height="316" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="652" y="70" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">C · 观察</text>
<rect x="576" y="88" width="152" height="46" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="652" y="108" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">weak_ptr&lt;T&gt;</text>
<text x="652" y="125" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">lock() 临时升级</text>
<rect x="576" y="160" width="152" height="46" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="652" y="180" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">T* / T&amp;</text>
<text x="652" y="197" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">只借用，不拥有</text>
<line x1="576" y1="111" x2="532" y2="132" stroke="var(--sv-muted)" stroke-dasharray="5 4" marker-end="url(#smart-pointers-dash)"/>
<line x1="576" y1="183" x2="534" y2="258" stroke="var(--sv-muted)" stroke-dasharray="5 4" marker-end="url(#smart-pointers-dash)"/>
<text x="652" y="246" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">不增加 strong</text>
<text x="652" y="268" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">不延长生命周期</text>
<text x="652" y="312" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">对象死后 lock 为空</text>
</svg>
<figcaption>图 1 · 三种所有权关系：unique_ptr 独占，shared_ptr 共享，weak_ptr 与裸指针只观察</figcaption>
</figure>
<p>把 unique_ptr 放进函数签名，所有权方向就清楚了：按值传参表示<mark>接管</mark>（sink），按 <code>unique_ptr&amp;</code> 传参表示可能<mark>换掉</mark>调用者的指针，按 <code>T&amp;</code> 或 <code>T*</code> 传参表示只<mark>借用</mark>、不参与生命周期。工厂函数返回 unique_ptr 是最常见的所有权出口；调用方用 <code>auto</code> 接住即可。</p>
<pre class="code" data-lang="cpp"><code>// 参数传递与所有权方向（示意，仅签名）
void sink(std::unique_ptr&lt;Widget&gt; p);        // 接管所有权
void reseat(std::unique_ptr&lt;Widget&gt;&amp; p);      // 可能替换 p
void observe(const Widget&amp; w);                // 只读借用，不关心所有权

std::unique_ptr&lt;Widget&gt; make_widget();       // 工厂：所有权从函数流出</code></pre>
</section>

<section class="sec">
<h2>自定义删除器：unique_ptr 的第二个模板参数</h2>
<p>资源不一定是 <code>new</code> 出来的。<code>FILE*</code> 要 <code>fclose</code>，C 接口句柄要专用 close，<code>malloc</code> 的内存要 <code>free</code>。unique_ptr 的完整类型是 <code>unique_ptr&lt;T, D&gt;</code>，第二个参数 D 是<mark>删除器</mark>（deleter）的类型，属于类型的一部分；因此不同删除器的 unique_ptr 是不同类型，不能互相赋值。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;cstdio&gt;
#include &lt;memory&gt;

struct FileCloser {
    void operator()(std::FILE* f) const noexcept {
        if (f != nullptr) std::fclose(f);
    }
};

using FilePtr = std::unique_ptr&lt;std::FILE, FileCloser&gt;;

FilePtr open_file(const char* path) {
    return FilePtr(std::fopen(path, "rb"));   // 失败时持有空指针
}

int main() {
    FilePtr f = open_file("data.bin");
    if (!f) return 1;
    // 离开作用域自动 fclose
}</code></pre>
<p>删除器可以是函数对象、无捕获 lambda 或函数指针。每个 lambda 表达式的闭包类型都是唯一的；无捕获 lambda 的闭包类型通常为空，能享受 EBO；函数指针则要占用一个指针宽度。删除器只需可调用，但 unique_ptr 的析构函数是 noexcept，若删除器在析构路径上抛异常，程序会调用 <code>std::terminate</code>，因此删除器应写成不抛异常的。</p>
<p>数组特化 <code>unique_ptr&lt;T[]&gt;</code> 的默认删除器调用 <code>delete[]</code>，但 <code>std::make_unique&lt;T[]&gt;(n)</code>（C++14）会<mark>值初始化</mark>每个元素；只想分配未初始化内存时，C++20 提供 <code>std::make_unique_for_overwrite</code>。另外，unique_ptr 持有不完整类型（incomplete type）时，析构点必须能看到完整定义；pImpl 惯用法因此要求析构函数在 .cpp 中定义，或使用在 .cpp 中定义的自定义删除器。</p>
</section>

<section class="sec">
<h2>shared_ptr：两个指针、一个控制块、一堆原子操作</h2>
<p><code>std::shared_ptr&lt;T&gt;</code> 表达<mark>共享所有权</mark>（shared ownership）。典型 64 位实现（LP64/LLP64，libstdc++、libc++ 与 MSVC STL）中它占两个指针：一个指向 T 对象，一个指向<mark>控制块</mark>（control block）。控制块记录强引用计数（strong count）与弱引用计数（weak count），并保存销毁对象、释放存储所需的信息——按构造方式不同，可能是类型擦除后的删除器与分配器，也可能是 make_shared 的就地构造记录；标准没有规定控制块的成员、布局或计数字宽。计数是原子的，因为不同线程可以同时拷贝或销毁指向同一对象的 shared_ptr。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="shared_ptr 控制块布局：两个指针分别指向对象与控制块，make_shared 将两者合并为一次分配">
<defs>
<marker id="smart-pointers-arrow2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-line)"/></marker>
</defs>
<text x="380" y="24" text-anchor="middle" font-size="15" font-family="inherit" fill="var(--sv-ink)">shared_ptr 的两块内存与两种分配策略</text>
<text x="24" y="56" font-size="13" font-family="inherit" fill="var(--sv-ink)">① 分开分配：shared_ptr&lt;T&gt;(new T)</text>
<rect x="24" y="68" width="200" height="58" rx="8" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<line x1="124" y1="68" x2="124" y2="126" stroke="var(--sv-line)"/>
<text x="74" y="94" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">ptr</text>
<text x="74" y="114" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">8 B</text>
<text x="174" y="94" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">ctrl*</text>
<text x="174" y="114" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">8 B</text>
<text x="124" y="148" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">shared_ptr（栈上，典型 16 B）</text>
<line x1="224" y1="97" x2="296" y2="97" stroke="var(--sv-line)" marker-end="url(#smart-pointers-arrow2)"/>
<rect x="300" y="68" width="180" height="58" rx="8" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="390" y="92" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">T 对象</text>
<text x="390" y="112" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">独立堆分配</text>
<line x1="224" y1="118" x2="298" y2="190" stroke="var(--sv-line)" marker-end="url(#smart-pointers-arrow2)"/>
<rect x="300" y="168" width="436" height="88" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<line x1="400" y1="168" x2="400" y2="256" stroke="var(--sv-line)"/>
<line x1="520" y1="168" x2="520" y2="256" stroke="var(--sv-line)"/>
<line x1="628" y1="168" x2="628" y2="256" stroke="var(--sv-line)"/>
<text x="350" y="197" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">strong</text>
<text x="350" y="219" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">原子计数</text>
<text x="460" y="197" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">weak</text>
<text x="460" y="219" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">原子计数</text>
<text x="574" y="197" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">deleter</text>
<text x="574" y="219" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">类型擦除</text>
<text x="682" y="197" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">allocator</text>
<text x="682" y="219" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">用于释放</text>
<text x="518" y="278" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">控制块：典型实现为独立堆分配，标准未规定布局</text>
<text x="24" y="306" font-size="13" font-family="inherit" fill="var(--sv-ink)">② make_shared：控制块 + 对象合并为一次分配</text>
<rect x="24" y="318" width="200" height="48" rx="8" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<line x1="124" y1="318" x2="124" y2="366" stroke="var(--sv-line)"/>
<text x="74" y="340" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">ptr</text>
<text x="174" y="340" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">ctrl*</text>
<text x="74" y="358" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">典型 16 B</text>
<line x1="224" y1="342" x2="296" y2="342" stroke="var(--sv-line)" marker-end="url(#smart-pointers-arrow2)"/>
<rect x="300" y="314" width="436" height="56" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<line x1="540" y1="314" x2="540" y2="370" stroke="var(--sv-line)" stroke-dasharray="5 4"/>
<text x="420" y="346" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">控制块（计数 + 就地构造）</text>
<text x="650" y="346" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">T 对象</text>
<text x="380" y="376" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">一次分配；weak 计数未归零前，整块内存都不释放</text>
</svg>
<figcaption>图 2 · shared_ptr 的双指针与控制块布局；make_shared 把对象和控制块放进同一块堆内存</figcaption>
</figure>
<p>析构顺序是理解 shared_ptr 的关键：最后一个强引用销毁时，调用删除器销毁 T；但控制块本身要等强、弱计数都归零才释放。也就是说，<code>weak_ptr</code> 可以让控制块（以及 make_shared 合并分配时的整块内存）活得更久。标准只规定可观察行为，不规定控制块布局、计数字宽或原子实现；常见实现用 long 或 int 加平台原子指令，并用虚函数或函数指针表完成"销毁对象/释放控制块"的分派。</p>
<p>原子操作不是免费的。每次拷贝 shared_ptr 要对强计数做一次原子增，每次销毁要做一次原子减；在 x86-64 上这通常意味着带 <code>lock</code> 前缀的读改写，在 ARM 上则是独占加载/存储循环或 LSE 原子指令。单个控制块被多个线程高频拷贝时，计数字所在缓存行会在核间来回弹跳（cache-line ping-pong），吞吐会显著下降，核数越多、拷贝越频繁，退化越明显。这就是"shared_ptr 慎用"的硬件层原因。</p>
<div class="formula">析构条件：strong = 0 ⇒ 调用删除器销毁对象；内存回收条件：strong = 0 且 weak = 0。
拷贝成本 ≈ 1 次原子增；销毁成本 ≈ 1 次原子减 + 条件析构；同一控制块跨线程竞争还会叠加缓存行迁移。</div>
</section>

<section class="sec">
<h2>make_shared 的合并分配与 enable_shared_from_this</h2>
<p><code>std::make_shared&lt;T&gt;(args...)</code>（C++11）把控制块和 T 对象放在<mark>同一次堆分配</mark>里，而 <code>std::shared_ptr&lt;T&gt;(new T)</code> 需要两次分配。合并分配带来三个好处：少一次分配器调用、对象与控制块相邻改善局部性、单次分配下的异常安全——若 T 的构造函数抛出，已申请的整块内存会随控制块一起回收；它同时消除了 <code>f(shared_ptr&lt;T&gt;(new T), g())</code> 这类写法中 g() 在 new T 之后、shared_ptr 接管之前抛出异常而导致对象泄漏的经典缺陷。（补充一点：单独写 <code>shared_ptr&lt;T&gt;(new T)</code> 时，若控制块分配失败，标准要求构造函数 delete 掉这个指针，所以那种写法本身并不会泄漏对象。）代价是只要还有 weak_ptr 存活，整块内存（包括 T 所占的空间）都不能归还；此外 make_shared 不能指定自定义删除器，也不能直接构造私有构造函数的类型（常见做法是类内静态工厂配合 <code>shared_ptr&lt;T&gt;(new T(...))</code>）。</p>
<p>另一个高频陷阱是从裸指针<mark>重复</mark>构造 shared_ptr。控制块是在 shared_ptr 构造函数里新建的；对同一个 <code>T*</code> 构造两次，就会得到两个独立控制块和两个强计数，最终 double delete。正确做法是让对象从一开始就由 shared_ptr 管理，需要"从对象内部拿到指向自己的 shared_ptr"时使用 <code>std::enable_shared_from_this&lt;T&gt;</code>（C++11）。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;iostream&gt;
#include &lt;memory&gt;

class Session : public std::enable_shared_from_this&lt;Session&gt; {
public:
    void start() {
        auto self = shared_from_this();   // 强计数 +1，延长生命周期
        std::cout &lt;&lt; "use_count = " &lt;&lt; self.use_count() &lt;&lt; '\n';
    }
};

int main() {
    auto s = std::make_shared&lt;Session&gt;();
    s-&gt;start();              // 输出 use_count = 2

    // Session raw; raw.start();  // 未由 shared_ptr 拥有 → 抛 std::bad_weak_ptr（C++17 起）
}</code></pre>
<p><code>enable_shared_from_this</code> 的典型实现是在基类里放一个 <code>weak_ptr&lt;T&gt;</code>，由 shared_ptr 的构造函数在接管对象时初始化。因此它有两个硬约束：对象必须已经由 shared_ptr 拥有（在构造函数里调用 shared_from_this 会失败），以及继承必须唯一且无歧义（多重继承多个 enable_shared_from_this 基类会让 <code>shared_from_this()</code> 二义）。C++17 起，若没有存活的 shared_ptr 所有者，<code>shared_from_this()</code> 抛 <code>std::bad_weak_ptr</code>。此外，shared_ptr 的别名构造函数（aliasing constructor）可以让 <code>shared_ptr&lt;Member&gt;</code> 指向对象的子对象却共享同一个控制块，常用于成员视图，不会多一次分配。</p>
</section>

<section class="sec">
<h2>weak_ptr 与循环引用：让观察者不拥有</h2>
<p><code>std::weak_ptr&lt;T&gt;</code>（C++11）是对 shared_ptr 管理对象的<mark>弱引用</mark>（weak reference）：它不增加强计数，不延长对象生命周期，只能通过 <code>lock()</code> 尝试升级为 shared_ptr。若对象已销毁，<code>lock()</code> 返回空 shared_ptr；<code>expired()</code> 大致等价于 <code>use_count() == 0</code>，但它只是瞬时快照，不要用"先检查 expired 再解引用"的写法——检查与使用之间对象可能被销毁，正确模式始终是先 <code>lock()</code> 拿到 shared_ptr 再检查。升级过程本身是原子的：它会在强计数非零时安全地加一，避免"检查之后对象恰好被销毁"的竞态。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="循环引用图：父子节点互相持有 shared_ptr 导致计数不归零，子节点改用 weak_ptr 后环被打破">
<defs>
<marker id="smart-pointers-cycle" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-line)"/></marker>
<marker id="smart-pointers-cycle-dash" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-muted)"/></marker>
</defs>
<text x="380" y="24" text-anchor="middle" font-size="15" font-family="inherit" fill="var(--sv-ink)">循环引用：强计数为什么回不到零</text>
<rect x="16" y="40" width="356" height="320" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="194" y="68" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">① 错误：双向 shared_ptr</text>
<rect x="40" y="88" width="130" height="76" rx="8" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="105" y="114" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">Parent</text>
<text x="105" y="136" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">shared_ptr&lt;Child&gt;</text>
<rect x="218" y="88" width="130" height="76" rx="8" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="283" y="114" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">Child</text>
<text x="283" y="136" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">shared_ptr&lt;Parent&gt;</text>
<line x1="170" y1="104" x2="214" y2="104" stroke="var(--sv-line)" marker-end="url(#smart-pointers-cycle)"/>
<line x1="218" y1="146" x2="174" y2="146" stroke="var(--sv-line)" marker-end="url(#smart-pointers-cycle)"/>
<text x="194" y="96" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">child</text>
<text x="194" y="164" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">parent</text>
<text x="105" y="194" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">strong = 1</text>
<text x="283" y="194" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">strong = 1</text>
<text x="194" y="238" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">外部引用消失后，两个计数仍为 1</text>
<text x="194" y="262" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">谁都不析构，两个对象一起泄漏</text>
<text x="194" y="330" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">计数只统计"谁拥有"，不统计"谁在环里"</text>
<rect x="388" y="40" width="356" height="320" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="566" y="68" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">② 修复：回指改 weak_ptr</text>
<rect x="412" y="88" width="130" height="76" rx="8" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="477" y="114" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">Parent</text>
<text x="477" y="136" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">shared_ptr&lt;Child&gt;</text>
<rect x="590" y="88" width="130" height="76" rx="8" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="655" y="114" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">Child</text>
<text x="655" y="136" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">weak_ptr&lt;Parent&gt;</text>
<line x1="542" y1="104" x2="586" y2="104" stroke="var(--sv-line)" marker-end="url(#smart-pointers-cycle)"/>
<line x1="590" y1="146" x2="546" y2="146" stroke="var(--sv-muted)" stroke-dasharray="5 4" marker-end="url(#smart-pointers-cycle-dash)"/>
<text x="566" y="96" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">拥有</text>
<text x="566" y="164" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">观察</text>
<text x="477" y="194" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">strong = 1</text>
<text x="655" y="194" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">strong = 1</text>
<text x="655" y="214" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">weak_to_parent = 1</text>
<text x="566" y="250" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">Parent 先析构，Child 的 weak 变为 expired</text>
<text x="566" y="274" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">环被打破，两个对象都能回收</text>
<text x="566" y="330" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">weak 只增加弱计数，不阻止析构</text>
</svg>
<figcaption>图 3 · 循环引用：双向 shared_ptr 让强计数停在 1；把回指改成 weak_ptr 即可打破环</figcaption>
</figure>
<p>循环引用是 shared_ptr 最经典的泄漏原因。父子节点互相持有 shared_ptr 时，外部引用消失后两个强计数仍各为 1，谁都不会先析构。修复方式不是"记得手动 reset"，而是<mark>在建模层面区分拥有与观察</mark>：树结构里父节点拥有子节点（unique_ptr 或 shared_ptr），子节点指回父节点用 <code>weak_ptr</code> 或裸指针；观察者模式、缓存、回调注册同理。weak_ptr 的另一个用途是缓存：缓存项用 weak_ptr 观察对象，对象死了缓存自然失效，不会把对象钉在内存里。</p>
<p>注意 <code>use_count()</code> 只适合调试和断言。多线程环境下它返回的只是近似值（标准明确允许这种近似，典型实现用 relaxed 原子读），不能用它做同步判断；也不要写"等 use_count 变成 1 再修改对象"这种代码：<code>use_count()</code> 只是瞬时观测，不构成任何同步，别的线程仍可能合法地持有引用，你按"独占"去修改对象就会产生数据竞争。</p>
</section>

<section class="sec">
<h2>线程安全边界：控制块安全，对象不安全</h2>
<p>标准给出的保证很窄：多个线程可以同时操作<mark>不同的</mark> shared_ptr 实例，即使它们指向同一对象，控制块的计数操作是安全的；但<mark>同一个</mark> shared_ptr 实例的并发读写是数据竞争，需要 mutex 或 C++20 的 <code>std::atomic&lt;std::shared_ptr&lt;T&gt;&gt;</code>。shared_ptr 的线程安全不包括 T：两个线程通过不同 shared_ptr 修改同一个 T，仍然需要你自己同步。<code>const shared_ptr&lt;T&gt;&amp;</code> 只保证不修改指针本身，不保证 T 是只读；要只读对象请用 <code>shared_ptr&lt;const T&gt;</code>。</p>
<p>工程上最常见的性能陷阱有四个。第一，在热循环里按值传 shared_ptr，每次调用都多一对原子操作；只观察时传 <code>T&amp;</code>、<code>T*</code> 或 <code>const shared_ptr&lt;T&gt;&amp;</code>。第二，把 shared_ptr 放进高频访问的容器并按值遍历，拷贝被放大。第三，多个线程共享同一个控制块并频繁拷贝，原子计数成为争用点。第四，用 shared_ptr 管理生命周期很长的单例或全局对象，退出顺序难以控制；这类对象更适合函数内 static 或明确的生命周期管理。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>类型</th><th>典型大小（64 位）</th><th>可否拷贝</th><th>所有权</th><th>主要成本</th><th>适用场景</th></tr></thead>
<tbody>
<tr><td><code>unique_ptr&lt;T&gt;</code></td><td>1 个指针（无状态删除器）</td><td>否，只能移动</td><td>独占</td><td>零运行时开销</td><td>默认选择、工厂返回值、pImpl</td></tr>
<tr><td><code>unique_ptr&lt;T, D&gt;</code></td><td>指针 + 删除器状态</td><td>否，只能移动</td><td>独占</td><td>删除器占空间与调用</td><td>C 句柄、文件、malloc 内存</td></tr>
<tr><td><code>shared_ptr&lt;T&gt;</code></td><td>2 个指针</td><td>是</td><td>共享</td><td>原子计数、控制块分配</td><td>生命周期确实重叠的共享</td></tr>
<tr><td><code>weak_ptr&lt;T&gt;</code></td><td>2 个指针</td><td>是</td><td>不拥有</td><td>原子操作、lock 检查</td><td>破环、缓存、观察者</td></tr>
<tr><td><code>T*</code> / <code>T&amp;</code></td><td>1 个指针</td><td>是</td><td>不拥有</td><td>无</td><td>函数参数、非拥有观察</td></tr>
</tbody>
</table></div>
<p>C++ Core Guidelines 的 R.20–R.37 把结论写得很直接：用 unique_ptr/shared_ptr 表达所有权（R.20），优先 unique_ptr（R.21），用 make_shared/make_unique（R.22/R.23），用 weak_ptr 破环（R.24），只在需要表达生命周期语义时按值传智能指针（R.30–R.37）。这些条款不是风格偏好，而是把"谁负责销毁"从注释搬到类型里。</p>
</section>

<section class="sec">
<h2>何时用裸指针或引用，以及常见误区</h2>
<p>裸指针和引用不是"旧时代的遗留"，而是<mark>非拥有观察者</mark>（non-owning observer）的正确工具。函数参数、树结构里的 parent 回指、区间视图、短生命周期的局部借用，都应该用 <code>T*</code>、<code>T&amp;</code> 或 <code>std::span</code>（C++20），并在命名或注释里明确"不拥有、不假定对象仍然存活"。真正的红线是：不要对裸指针 <code>delete</code>，不要把 <code>get()</code> 的结果交给另一个 owner，不要用裸指针表达所有权。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;iostream&gt;
#include &lt;memory&gt;
#include &lt;string&gt;
#include &lt;utility&gt;
#include &lt;vector&gt;

struct Node {
    std::string name;
    std::vector&lt;std::unique_ptr&lt;Node&gt;&gt; children;
    Node* parent = nullptr;              // 非拥有观察者

    explicit Node(std::string n) : name(std::move(n)) {}

    Node&amp; add_child(std::string n) {
        auto child = std::make_unique&lt;Node&gt;(std::move(n));
        child-&gt;parent = this;            // 回指，不参与所有权
        children.push_back(std::move(child));
        return *children.back();
    }

    ~Node() { std::cout &lt;&lt; "destroy " &lt;&lt; name &lt;&lt; '\n'; }
};

int main() {
    auto root = std::make_unique&lt;Node&gt;("root");
    auto&amp; a = root-&gt;add_child("a");
    a.add_child("a1");
    root-&gt;add_child("b");
    // root 析构时递归销毁整棵树；parent 裸指针在树内始终有效
}</code></pre>
<p>这种结构里，所有权只沿 children 一条边向下流动，parent 只观察；因此只要树内节点的生命周期由根管理，回指就不会悬空。需要注意递归析构的深度：树极深时，析构链会消耗栈空间，必要时可改为显式后序遍历或迭代释放。</p>
<p>排障时先问三个问题：这个对象应该有几个所有者？所有者的生命周期是否真的重叠？指针是否可能比对象活得久？AddressSanitizer 能抓到 double free 与 use-after-free，LeakSanitizer 负责泄漏。LSan 按"从根是否可达"判定泄漏：外部强引用全部消失后，环上的对象已经不可达，因此循环引用通常会被它报告为泄漏；真正麻烦的是定位环由谁构成，可以结合分配栈、弱引用图或打印 <code>use_count()</code> 来排查。</p>
<div class="callout callout--warn"><span class="callout__label">警告</span><div>不要用同一个裸指针构造两个 shared_ptr，也不要用 <code>shared_ptr::get()</code> 的返回值去构造另一个 shared_ptr。前者产生两个控制块和 double delete，后者同样绕过原控制块。</div></div>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>默认写 unique_ptr；只有当"多个对象的生命周期必须共同决定资源释放"这一条件成立时，才引入 shared_ptr。引入 shared_ptr 的同时就要检查是否存在环，并决定环上哪条边改成 weak_ptr。</div></div>
<h3>自测</h3>
<details class="quiz"><summary>Q1 · 下面两行代码有什么问题？<code>shared_ptr&lt;T&gt; a(new T); shared_ptr&lt;T&gt; b(a.get());</code></summary><div class="quiz__a">第二行从裸指针又构造了一个控制块，a 与 b 各自持有一个强计数。二者离开作用域时都会 delete 同一个 T，造成 double free；正确写法是 <code>shared_ptr&lt;T&gt; b = a;</code>，让 b 共享 a 的控制块。</div></details>
<details class="quiz"><summary>Q2 · 两个线程分别拷贝两个指向同一对象的 shared_ptr 实例，安全吗？如果拷贝的是同一个 shared_ptr 实例呢？</summary><div class="quiz__a">前者安全：不同实例的控制块计数操作是原子的。后者不安全：同一个 shared_ptr 对象的并发读写是数据竞争，需要 mutex 或 C++20 的 <code>atomic&lt;shared_ptr&lt;T&gt;&gt;</code>。注意这只覆盖指针本身，不覆盖 T 的成员。</div></details>
<details class="quiz"><summary>Q3 · 为什么 make_shared 创建的对象在最后一个 shared_ptr 销毁后，内存可能仍未归还？</summary><div class="quiz__a">make_shared 把对象与控制块放在同一块分配里，控制块还包含弱计数。只要还有 weak_ptr 指向该控制块，整块内存就不能释放，T 的存储也随之保留。若对象很大且 weak_ptr 存活很久，改用 <code>shared_ptr&lt;T&gt;(new T)</code> 并在最后一个强引用销毁时释放对象内存。</div></details>
<details class="quiz"><summary>Q4 · 在构造函数里调用 shared_from_this() 会发生什么？</summary><div class="quiz__a">此时 shared_ptr 还没完成对对象的接管，enable_shared_from_this 内部的 weak_ptr 尚未初始化。C++17 起会抛 <code>std::bad_weak_ptr</code>。需要"启动自身"的逻辑应放到两阶段初始化函数里，由已经持有 shared_ptr 的调用方触发。</div></details>
<h3>延伸阅读</h3>
<ul class="refs">
<li><b>cppreference: std::unique_ptr</b> — cppreference.com。删除器、数组特化、make_unique 系列与不完整类型要求的权威速查。</li>
<li><b>cppreference: std::shared_ptr</b> — cppreference.com。控制块、所有权语义、线程安全保证与别名构造函数的原文说明。</li>
<li><b>cppreference: std::weak_ptr / std::enable_shared_from_this</b> — cppreference.com。lock/expired 的语义与 shared_from_this 的前置条件。</li>
<li><b>C++ Core Guidelines R.20–R.37</b> — Bjarne Stroustrup &amp; Herb Sutter。智能指针所有权与参数传递的规则集合。</li>
<li><b>Effective Modern C++ 条款 18–21</b> — Scott Meyers, 2014。unique_ptr、shared_ptr、weak_ptr 与 make 函数的取舍，含控制块与性能讨论。</li>
</ul>
</section>`
};
