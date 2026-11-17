window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["allocation"] = {
  slug: "allocation",
  title: "new、delete 与分配器",
  subtitle: "分配是性能与正确性的交叉点",
  level: 2,
  cluster: "对象与资源",
  tags: ["new", "allocator", "内存池"],
  summary: "从 new 讲起，拆开分配与构造两步，理清数组配对、对齐和放置构造，再进入分配器、pmr 与 arena 内存池，最后用碎片模型与排障清单把性能与正确性落到工程。",
  keyPoints: [
    "new 表达式、operator new、placement new 与 malloc 的分工和失败语义",
    "new[]/delete[] 配对、数组 cookie 与 over-aligned 类型的对齐分配",
    "std::allocator 契约、allocator_traits 与 C++17 pmr 多态分配器",
    "arena/内存池的 O(1) 分配、外部与内部碎片的识别与治理"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>先记住一句话：分配借地，构造盖房</h2>
<p><mark>new 同时做两件事</mark>：先向分配器要一块足够大的原始存储（allocation），再在这块存储上构造对象（construction）。<code>delete</code> 反过来：先调用析构函数结束对象生命周期，再把存储还给分配器。把这两步拆开理解，后面所有规则——数组、对齐、placement new、分配器——都会变得顺理成章。</p>
<p>分配之所以值得单独成篇，是因为它同时踩在性能与正确性两条线上。正确性上，<code>new[]</code> 配 <code>delete</code>、placement new 后调 <code>delete</code>、对齐不足、构造函数抛异常，都是未定义行为（undefined behavior，UB）或资源泄漏的高发区。性能上，一次 <code>malloc</code> 可能包含锁、size class 查找、页扩展；分配模式又决定了缓存局部性与碎片。会写 <code>new T</code> 只是起点，知道它背后发生了什么才能改得动。</p>
<p>本篇只谈“存储从哪来、怎么还”。对象在存储里如何排布、vptr 与填充字节如何摆放，属于对象布局话题，见 memory-layout 一篇；所有权与 RAII 的完整讨论见资源所有权一篇。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>把内存想成一块地：<code>operator new</code> 是拿地，构造函数是盖房，析构函数是拆房，<code>operator delete</code> 是还地。placement new 是“在已有的地上盖房”，而 malloc 只是拿地，永远不会替你盖房。</div></div>
</section>

<section class="sec">
<h2>四个名字：new 表达式、operator new、placement new、malloc</h2>
<p>C++ 里说“new”时，至少可能指两个不同的东西。<b>new 表达式</b>（new expression）是语言语法，如 <code>new T(args)</code>，它先调用分配函数，再调用构造函数。<b>operator new</b> 是分配函数（allocation function），签名形如 <code>void* operator new(std::size_t)</code>，只负责返回一块未初始化的存储，<mark>不构造任何对象</mark>。标准库在 <code>&lt;new&gt;</code> 中提供了它的默认实现，通常最终调用 <code>malloc</code>。</p>
<p>同理，<b>delete 表达式</b>先析构，再调用 <b>operator delete</b>。C++14 起还允许带大小的释放函数 <code>operator delete(void*, std::size_t)</code>，编译器可能把对象大小传进去，省掉分配器反查块大小的开销；是否真的调用取决于编译器和 ABI，不能依赖。</p>
<p><b>placement new</b> 是 <code>&lt;new&gt;</code> 提供的一种特殊形式：<code>new (ptr) T(args)</code> 调用的分配函数是 <code>operator new(std::size_t, void*)</code>，它不分配，只把 <code>ptr</code> 原样返回，随后在 <code>ptr</code> 上构造。它适合在预分配缓冲区、共享内存或 <code>std::optional</code>/<code>std::variant</code> 这类类型内部就地构造对象。代价是：<b>必须显式调用析构函数</b>，且不能用 <code>delete</code> 释放，因为存储不是 new 表达式分配的。</p>
<p><b>malloc/free</b> 是 C 的分配接口：只分配字节，不构造、不析构，失败返回 <code>nullptr</code>，返回的 <code>void*</code> 在 C++ 中需要显式转换。它和 new/delete 属于两套协议，不能交叉配对；<code>free</code> 一个 <code>new</code> 出来的指针是 UB，反之亦然。默认 <code>operator new</code> 可能用 malloc 实现，但这只是实现细节，不构成混用的理由。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>写法</th><th>分配存储</th><th>构造对象</th><th>失败行为</th><th>正确释放</th></tr></thead>
<tbody>
<tr><td><code>new T(args)</code></td><td>operator new</td><td>是</td><td>抛 std::bad_alloc</td><td><code>delete p</code></td></tr>
<tr><td><code>new T[n]</code></td><td>operator new[]</td><td>是，逐元素</td><td>抛 std::bad_alloc（长度非法时为 bad_array_new_length）</td><td><code>delete[] p</code></td></tr>
<tr><td><code>new (buf) T(args)</code></td><td>否</td><td>是</td><td>构造异常直接传播</td><td><code>p-&gt;~T()</code></td></tr>
<tr><td><code>std::malloc(n)</code></td><td>C 库堆</td><td>否</td><td>返回 nullptr</td><td><code>std::free(p)</code></td></tr>
<tr><td><code>a.allocate(n)</code></td><td>分配器策略</td><td>否</td><td>抛 std::bad_alloc（或 bad_array_new_length）</td><td><code>a.deallocate(p, n)</code></td></tr>
</tbody></table></div>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="new 与 delete 表达式的调用链：分配存储、构造对象、析构、释放存储" font-family="inherit">
<defs>
<marker id="allocation-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"/>
</marker>
</defs>
<text x="380" y="26" text-anchor="middle" font-size="15" fill="var(--sv-ink)">new 与 delete 都是两步操作</text>
<text x="24" y="58" font-size="12" fill="var(--sv-muted)">构造路径</text>
<g text-anchor="middle">
<rect x="20" y="70" width="150" height="66" rx="6" fill="var(--sv-a)" fill-opacity="0.22" stroke="var(--sv-a)"/>
<text x="95" y="96" font-size="14" fill="var(--sv-ink)">new T(args)</text>
<text x="95" y="116" font-size="12" fill="var(--sv-muted)">new 表达式</text>

<rect x="210" y="70" width="150" height="66" rx="6" fill="var(--sv-a2)" fill-opacity="0.22" stroke="var(--sv-a2)"/>
<text x="285" y="96" font-size="14" fill="var(--sv-ink)">operator new(n)</text>
<text x="285" y="116" font-size="12" fill="var(--sv-muted)">可替换，只分配</text>

<rect x="400" y="70" width="150" height="66" rx="6" fill="var(--sv-b)" fill-opacity="0.22" stroke="var(--sv-b)"/>
<text x="475" y="96" font-size="14" fill="var(--sv-ink)">堆 / 池 / 映射</text>
<text x="475" y="116" font-size="12" fill="var(--sv-muted)">返回未初始化存储</text>

<rect x="590" y="70" width="150" height="66" rx="6" fill="var(--sv-a)" fill-opacity="0.22" stroke="var(--sv-a)"/>
<text x="665" y="96" font-size="14" fill="var(--sv-ink)">T::T(args)</text>
<text x="665" y="116" font-size="12" fill="var(--sv-muted)">在存储上构造</text>
</g>
<line x1="170" y1="103" x2="204" y2="103" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#allocation-arrow)"/>
<line x1="360" y1="103" x2="394" y2="103" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#allocation-arrow)"/>
<line x1="550" y1="103" x2="584" y2="103" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#allocation-arrow)"/>
<text x="380" y="172" text-anchor="middle" font-size="12" fill="var(--sv-muted)">普通 new 表达式的构造函数抛出时，标准要求自动调用匹配的 operator delete 归还存储</text>
<text x="24" y="238" font-size="12" fill="var(--sv-muted)">析构路径</text>
<g text-anchor="middle">
<rect x="20" y="250" width="150" height="66" rx="6" fill="var(--sv-b2)" fill-opacity="0.22" stroke="var(--sv-b2)"/>
<text x="95" y="276" font-size="14" fill="var(--sv-ink)">delete p</text>
<text x="95" y="296" font-size="12" fill="var(--sv-muted)">delete 表达式</text>

<rect x="210" y="250" width="150" height="66" rx="6" fill="var(--sv-a2)" fill-opacity="0.22" stroke="var(--sv-a2)"/>
<text x="285" y="276" font-size="14" fill="var(--sv-ink)">p-&gt;~T()</text>
<text x="285" y="296" font-size="12" fill="var(--sv-muted)">析构函数</text>

<rect x="400" y="250" width="150" height="66" rx="6" fill="var(--sv-a)" fill-opacity="0.22" stroke="var(--sv-a)"/>
<text x="475" y="276" font-size="14" fill="var(--sv-ink)">operator delete(p)</text>
<text x="475" y="296" font-size="12" fill="var(--sv-muted)">可替换，只释放</text>

<rect x="590" y="250" width="150" height="66" rx="6" fill="var(--sv-b)" fill-opacity="0.22" stroke="var(--sv-b)"/>
<text x="665" y="276" font-size="14" fill="var(--sv-ink)">归还分配器</text>
<text x="665" y="296" font-size="12" fill="var(--sv-muted)">free / 回池</text>
</g>
<line x1="170" y1="283" x2="204" y2="283" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#allocation-arrow)"/>
<line x1="360" y1="283" x2="394" y2="283" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#allocation-arrow)"/>
<line x1="550" y1="283" x2="584" y2="283" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#allocation-arrow)"/>
<text x="380" y="352" text-anchor="middle" font-size="12" fill="var(--sv-muted)">delete[] 在此基础上按构造逆序逐个析构元素，再整块释放</text>
</svg>
<figcaption>图 1 · new/delete 表达式把“分配/释放”与“构造/析构”串成一条链</figcaption>
</figure>
<pre class="code" data-lang="cpp"><code>#include &lt;new&gt;

struct X { int a; int b; };

int main() {
    void* raw = ::operator new(sizeof(X));   // 只分配，不构造
    X* p = new (raw) X{1, 2};                // placement new：只构造
    p-&gt;~X();                                 // 必须显式析构
    ::operator delete(raw);                  // 归还存储，不能用 delete p
}</code></pre>
<p>这段代码演示了“两步拆开”的完整闭环：显式分配、placement 构造、显式析构、显式释放，四步缺一不可。真实代码里更推荐让容器或智能指针代管，但在写内存池、序列化缓冲区或自定义容器时，这个闭环就是基本功。</p>
</section>

<section class="sec">
<h2>new[] 与 delete[]：数组的账本要对上</h2>
<p><code>new T[n]</code> 先申请至少 <code>n * sizeof(T)</code> 的存储（标准允许再多要一些，用于对齐或数组开销），然后从前往后逐个构造元素；<code>delete[]</code> 则按构造的逆序析构元素，再释放整块存储。问题是 <code>delete[]</code> 怎么知道 <code>n</code>？典型实现（Itanium C++ ABI 的数组 cookie；MSVC 对含非平凡析构的类类型也会加头）会在返回指针之前藏一个记录元素个数的头，<code>delete[]</code> 从返回指针前方读回。标准并不保证 cookie 的存在、大小与位置：对可平凡析构（trivially destructible）且没有类专属 <code>operator delete[]</code> 的类型，Itanium ABI 就允许省掉它，此时 <code>new[]</code> 与 <code>new</code> 的存储布局可能一致。这些都是 ABI 约定，不是语言保证。</p>
<p>由此得到两条铁律。第一，<code>new[]</code> 必须配 <code>delete[]</code>，<code>new</code> 必须配 <code>delete</code>，交叉配对是 UB；对非平凡析构的类型，用 <code>delete</code> 释放数组通常只析构第一个元素，其余元素的资源泄漏；而且 <code>delete</code> 拿到的是（可能带 cookie 的）数组指针，直接交给单对象的释放函数时块首可能对不上，堆元数据也可能被破坏。第二，不要依赖 <code>p[-1]</code> 去读元素个数，那是 ABI 细节而非语言契约。同理，不要对数组指针做指针算术后传给 <code>delete[]</code>，必须传 <code>new[]</code> 返回的原指针。</p>
<p>现代 C++ 里手写 <code>new[]</code> 的场景已经很少：<code>std::vector&lt;T&gt;</code> 管动态长度，<code>std::array&lt;T, N&gt;</code> 管固定长度，需要独占所有权的动态数组时用 <code>std::unique_ptr&lt;T[]&gt;</code>（C++11 起有数组特化，<code>delete[]</code> 由删除器负责）。如果确实要重载类内的 <code>operator new[]</code>，记得同时提供 <code>operator delete[]</code>，并保证两者对大小的理解一致。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div><code>delete p</code> 用在 <code>new T[n]</code> 上不一定会立刻崩溃。对 <code>int</code> 这类可平凡析构的类型，cookie 可能不存在，程序“看起来正常”；但这是未定义行为，换编译器、开优化或换类型就会暴露。不要用“跑通了”证明配对正确，用 AddressSanitizer 的 alloc-dealloc-mismatch / new-delete-type-mismatch 检查验证（UBSan 不负责这类配对问题）。</div></div>
</section>

<section class="sec">
<h2>对齐：地址必须是某个数的整数倍</h2>
<p>对齐要求的定义与 <code>alignof</code>/<code>alignas</code> 的用法见 memory-layout 一篇；这里只看分配函数如何满足它。栈和静态存储由编译器保证对齐；堆上的对象则由分配函数保证。<code>operator new</code> 的默认实现必须满足基本对齐（fundamental alignment），也就是至少按 <code>std::max_align_t</code> 的对齐返回存储；在 x86-64 SysV（Linux/macOS）上通常是 16 字节。C++17 起可用预定义宏 <code>__STDCPP_DEFAULT_NEW_ALIGNMENT__</code> 查询这个值，MSVC 的取值也随目标架构而变。这就是为什么 <code>new double</code>、<code>new std::max_align_t</code> 通常是安全的。</p>
<p>但 SIMD、缓存行优化和无锁结构常需要 32、64 甚至 128 字节对齐，这类类型称为 <b>over-aligned type</b>（过度对齐类型）。C++17 之前，普通 <code>operator new</code> 不保证超过默认对齐的地址；对 <code>struct alignas(64) Node</code> 直接写 <code>new Node</code>，在某些实现上只会得到按 16 字节对齐的指针。C++17 增加了对齐版的分配函数 <code>operator new(std::size_t, std::align_val_t)</code> 与对应的 delete，<mark>new 表达式在类型对齐超过默认值时自动选用对齐重载</mark>；手写 <code>::operator new(sizeof(Node))</code> 则不会，必须显式写 <code>::operator new(sizeof(Node), std::align_val_t{alignof(Node)})</code>。</p>
<p>需要手动管理对齐存储时，有三套常见接口：C++17 的 <code>std::aligned_alloc(alignment, size)</code>，要求 <code>size</code> 是 <code>alignment</code> 的整数倍，用 <code>std::free</code> 释放；POSIX 的 <code>posix_memalign(&amp;p, alignment, size)</code>，返回错误码，用 <code>free</code> 释放；Windows/MSVC 的 <code>_aligned_malloc(size, alignment)</code>，必须配 <code>_aligned_free</code>，<b>不能用 free</b>。释放路径也必须能还原当初的对齐方式：<code>std::allocator</code> 靠编译期的 <code>alignof(T)</code>，运行期对齐的池则要把对齐存进分配器状态或与指针一起记录；对不上就会走错归还函数。</p>
<div class="formula">对齐后地址 = (当前地址 + 对齐 − 1) &amp; ~(对齐 − 1)　（对齐必须是 2 的幂）<br>over-aligned 判定：alignof(T) &gt; __STDCPP_DEFAULT_NEW_ALIGNMENT__</div>
<p>图 2 把这条链路画全：容器经由分配器，最终落到可替换的分配函数或内存资源。注意“可替换点”不止一个，影响面差别很大：替换全局 <code>operator new</code> 会影响整个程序（包括第三方库），替换类内 <code>operator new</code> 只影响该类（及派生类）的 new 表达式，替换容器模板实参里的分配器类型或给容器传入不同的 <code>memory_resource</code> 则只影响那个容器。通常应优先选影响面小的方案。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="分配器层级：容器、std::allocator 或 pmr 分配器、allocator_traits、operator new 与操作系统" font-family="inherit">
<defs>
<marker id="allocation-down" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"/>
</marker>
</defs>
<text x="380" y="24" text-anchor="middle" font-size="15" fill="var(--sv-ink)">分配器层级：每一层都可以换实现</text>
<g font-family="inherit">
<rect x="70" y="44" width="550" height="48" rx="6" fill="var(--sv-a)" fill-opacity="0.22" stroke="var(--sv-a)"/>
<text x="90" y="66" font-size="14" fill="var(--sv-ink)">① 容器：vector / map / string</text>
<text x="90" y="84" font-size="12" fill="var(--sv-muted)">不直接 new，只通过分配器要存储</text>

<rect x="70" y="104" width="550" height="48" rx="6" fill="var(--sv-a2)" fill-opacity="0.22" stroke="var(--sv-a2)"/>
<text x="90" y="126" font-size="14" fill="var(--sv-ink)">② std::allocator&lt;T&gt; 或 pmr::polymorphic_allocator&lt;T&gt;</text>
<text x="90" y="144" font-size="12" fill="var(--sv-muted)">类型参数策略 / 运行期类型擦除</text>

<rect x="70" y="164" width="550" height="48" rx="6" fill="var(--sv-b2)" fill-opacity="0.22" stroke="var(--sv-b2)"/>
<text x="90" y="186" font-size="14" fill="var(--sv-ink)">③ std::allocator_traits&lt;A&gt;</text>
<text x="90" y="204" font-size="12" fill="var(--sv-muted)">补全 construct / destroy 与传播 traits</text>

<rect x="70" y="224" width="550" height="48" rx="6" fill="var(--sv-b)" fill-opacity="0.22" stroke="var(--sv-b)"/>
<text x="90" y="246" font-size="14" fill="var(--sv-ink)">④ ::operator new / memory_resource::allocate</text>
<text x="90" y="264" font-size="12" fill="var(--sv-muted)">可替换点；C++17 对齐重载在这里分流</text>

<rect x="70" y="284" width="550" height="48" rx="6" fill="var(--sv-c)" fill-opacity="0.22" stroke="var(--sv-c)"/>
<text x="90" y="306" font-size="14" fill="var(--sv-ink)">⑤ malloc/free · 内存池 · arena · mmap / VirtualAlloc</text>
<text x="90" y="324" font-size="12" fill="var(--sv-muted)">最终向操作系统拿页</text>
</g>
<line x1="345" y1="92" x2="345" y2="100" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#allocation-down)"/>
<line x1="345" y1="152" x2="345" y2="160" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#allocation-down)"/>
<line x1="345" y1="212" x2="345" y2="220" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#allocation-down)"/>
<line x1="345" y1="272" x2="345" y2="280" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#allocation-down)"/>
<text x="650" y="368" text-anchor="middle" font-size="12" fill="var(--sv-muted)">越往下替换，影响面越大</text>
</svg>
<figcaption>图 2 · 从容器到操作系统：分配器把“存储来源”变成可替换策略</figcaption>
</figure>
</section>

<section class="sec">
<h2>std::allocator：把“分配”抽象成策略</h2>
<p>标准容器不直接调用 <code>new</code>，而是通过分配器（allocator）模板参数。原因有三：把分配与构造分离；允许有状态策略（池、共享内存、统计）；让容器在不知道具体存储来源的情况下工作。<code>std::allocator&lt;T&gt;</code> 是默认实现，无状态、可互换，C++17 起提供 <code>is_always_equal = true_type</code>；<code>allocate(n)</code> 通常转调 <code>::operator new(n * sizeof(T))</code>，C++17 起对 over-aligned 的 <code>T</code> 则转调对齐重载。</p>
<p>写自定义分配器时，不必实现全部接口：<code>std::allocator_traits&lt;A&gt;</code>（C++11）会为缺失的成员提供默认值，包括 <code>construct</code>（默认 placement new）、<code>destroy</code>（默认调用析构）、<code>select_on_container_copy_construction</code>、<code>max_size</code> 以及各种传播 traits。分配器的最小契约是 <code>value_type</code>、<code>allocate(n)</code>、<code>deallocate(p, n)</code>，以及可比较相等。关于 <code>rebind</code> 要分清：C++11 起 <code>allocator_traits</code> 已能根据分配器的模板实参自动推导出 <code>rebind_alloc&lt;U&gt;</code>，通常不必手写成员 <code>rebind</code>；<code>std::allocator::rebind</code> 本身在 C++17 被弃用、C++20 移除。写需要兼容老标准库的库代码时，显式提供 <code>rebind</code> 更稳妥。</p>
<p>有状态分配器还要关心传播行为：<code>propagate_on_container_copy_assignment</code>、<code>propagate_on_container_move_assignment</code>、<code>propagate_on_container_swap</code>。容器赋值或 swap 时是否连带替换分配器，由这些 traits 决定；如果两个有状态分配器不相等又不传播，移动赋值只能逐元素搬移，性能会悄悄退化。这些细节在写池分配器时尤其容易踩。</p>
<p>标准还在演进：<code>construct</code>/<code>destroy</code> 在 C++17 被弃用、C++20 从 <code>std::allocator</code> 移除，<code>allocator_traits</code> 在分配器没有这两个成员时退回 placement new 与直接调用析构；C++23 增加了 <code>allocate_at_least(n)</code>，允许分配器返回不少于请求的块（返回 <code>std::allocation_result</code>），容器可借此减少扩容次数。读到老代码里的 <code>a.construct(p, args)</code>，要知道那是 C++17 及以前的写法。</p>
</section>

<section class="sec">
<h2>pmr 与 arena：把分配变成一次指针加法</h2>
<p>C++17 引入 <code>&lt;memory_resource&gt;</code>（提案 P0220R1），提供运行期多态的分配器。<code>std::pmr::memory_resource</code> 有三个待实现的纯虚函数：<code>do_allocate</code>、<code>do_deallocate</code>、<code>do_is_equal</code>；<code>std::pmr::polymorphic_allocator&lt;T&gt;</code> 持有 <code>memory_resource*</code>，把类型擦除后的分配策略注入容器。与模板参数不同，pmr 允许在运行期选择资源，代价是一次虚调用和额外的指针字段。</p>
<p>标准库提供三种常用资源。<code>std::pmr::monotonic_buffer_resource</code> 只增不减：内部维护一块或多块缓冲区，分配就是对齐后前移指针，<code>deallocate</code> 是空操作，析构或 <code>release()</code> 时把整条链还给上游资源。<code>unsynchronized_pool_resource</code> 按大小分池、单线程使用；<code>synchronized_pool_resource</code> 则提供线程安全（内部同步）。这三种资源的默认上游是 <code>std::pmr::get_default_resource()</code>，它初始指向 <code>new_delete_resource()</code>；也可以在构造时传入别的上游资源，串成一条链。</p>
<p>所谓 <b>arena</b>（区域分配）就是 monotonic 策略的手写版：启动时 <code>malloc</code>/<code>VirtualAlloc</code> 一大块，之后每次分配只做“对齐 + 指针加法”，释放要么不支持单对象，要么整块 <code>reset</code>。它的成本模型非常干净：一次分配通常只做对齐、一次边界检查和指针加法，释放 O(1)（整块），没有 per-object 元数据，因此 arena 内部不会产生外部碎片（但整块仍需向系统申请，可能与其他分配在更外层产生碎片）。代价是生命周期被绑死——所有对象必须一起死。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="arena 分配：整块缓冲区、bump 指针前移、reset 回收" font-family="inherit">
<defs>
<marker id="allocation-bump" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-ink)"/>
</marker>
<marker id="allocation-reset" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-a)"/>
</marker>
</defs>
<text x="380" y="28" text-anchor="middle" font-size="15" fill="var(--sv-ink)">arena：一次拿一大块，分配只前移指针</text>
<text x="380" y="52" text-anchor="middle" font-size="12" fill="var(--sv-muted)">整块来自一次 ::operator new 或 VirtualAlloc，per-object 无元数据</text>
<g>
<rect x="50" y="120" width="120" height="90" fill="var(--sv-a)" fill-opacity="0.3" stroke="var(--sv-a)"/>
<rect x="170" y="120" width="100" height="90" fill="var(--sv-a2)" fill-opacity="0.3" stroke="var(--sv-a2)"/>
<rect x="270" y="120" width="20" height="90" fill="var(--sv-c)" fill-opacity="0.45" stroke="var(--sv-c)" stroke-dasharray="3 3"/>
<rect x="290" y="120" width="130" height="90" fill="var(--sv-b2)" fill-opacity="0.3" stroke="var(--sv-b2)"/>
<rect x="420" y="120" width="290" height="90" fill="var(--sv-bg)" stroke="var(--sv-line)" stroke-dasharray="5 4"/>
</g>
<g text-anchor="middle">
<text x="110" y="160" font-size="13" fill="var(--sv-ink)">对象 A</text>
<text x="110" y="180" font-size="12" fill="var(--sv-muted)">40 B</text>
<text x="220" y="160" font-size="13" fill="var(--sv-ink)">对象 B</text>
<text x="220" y="180" font-size="12" fill="var(--sv-muted)">32 B</text>
<text x="350" y="160" font-size="13" fill="var(--sv-ink)">对象 C</text>
<text x="350" y="180" font-size="12" fill="var(--sv-muted)">48 B</text>
<text x="280" y="238" font-size="12" fill="var(--sv-muted)">对齐填充 8 B</text>
<text x="565" y="160" font-size="13" fill="var(--sv-ink)">空闲尾部</text>
<text x="565" y="180" font-size="12" fill="var(--sv-muted)">尚未使用</text>
</g>
<line x1="420" y1="105" x2="420" y2="250" stroke="var(--sv-ink)" stroke-width="2" marker-end="url(#allocation-bump)"/>
<text x="432" y="102" font-size="12" fill="var(--sv-ink)">bump 指针（只前进）</text>
<path d="M420,300 C300,350 140,350 60,310" fill="none" stroke="var(--sv-a)" stroke-width="1.8" stroke-dasharray="6 4" marker-end="url(#allocation-reset)"/>
<text x="240" y="336" text-anchor="middle" font-size="12" fill="var(--sv-a)">reset()：指针回到起点，整块复用，O(1)</text>
<text x="380" y="366" text-anchor="middle" font-size="12" fill="var(--sv-muted)">allocate(n, align)：对齐 + 加法；deallocate：空操作</text>
</svg>
<figcaption>图 3 · arena 的 bump 分配：牺牲逐个释放，换来常数级分配与 arena 内部的零外部碎片</figcaption>
</figure>
<p>arena 适合请求级、帧级、编译器前端构建的 AST、序列化临时对象这类“批量创建、批量销毁”的场景。不适合长生命周期、大小差异巨大、需要逐个释放的对象图：一个长期存活的小对象会把整块 arena 钉住。使用 pmr 时还要注意生命周期顺序——资源必须比所有使用它的容器活得久；另外 <code>polymorphic_allocator</code> 的传播 traits 全为 false，容器移动赋值不会替换目标分配器，跨资源移动可能退化为逐元素搬移。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;memory_resource&gt;
#include &lt;vector&gt;
#include &lt;string&gt;

int main() {
    std::pmr::monotonic_buffer_resource pool{4096};
    std::pmr::vector&lt;std::pmr::string&gt; names{&amp;pool};
    names.emplace_back("allocation");
    names.emplace_back("arena");
    // pool 析构时统一释放；names 必须先于 pool 销毁
}</code></pre>
</section>

<section class="sec">
<h2>碎片：不是泄漏，却同样把内存吃光</h2>
<p>分配器拿到的往往不是请求的精确字节数。为了对齐、维护元数据、划分 size class，它会多给一些，这部分浪费叫<b>内部碎片</b>（internal fragmentation）。glibc malloc 在 64 位上通常把请求按 16 字节对齐取整，块头另计；jemalloc/tcmalloc 则以各自的 size class 组织块，取整粒度与分档策略不同，内部碎片大小取决于具体实现与配置。内部碎片的公式很直接：</p>
<div class="formula">内部碎片率 = (实际块大小 − 请求大小) ÷ 实际块大小 × 100%<br>外部碎片：总空闲量 ≥ 请求，但不存在足够大的连续空闲块</div>
<p><b>外部碎片</b>（external fragmentation）是另一回事：内存总量够，但被已分配块切成小洞。长时间运行、频繁分配释放不同大小对象的程序最容易出现——典型表现是 RSS 持续上涨、<code>malloc</code> 返回 <code>nullptr</code>、new 抛出 <code>bad_alloc</code>，但监控显示“还有很多空闲”。碎片不是泄漏：泄漏是对象不再被引用却未释放，碎片是空闲存储无法被利用。排障时要分开看。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="内部碎片与外部碎片对比：块内填充浪费，以及洞虽多但都不够大" font-family="inherit">
<defs>
<marker id="allocation-req" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-ink)"/>
</marker>
</defs>
<text x="380" y="26" text-anchor="middle" font-size="15" fill="var(--sv-ink)">两种碎片：浪费在块内，或浪费在块间</text>
<rect x="20" y="48" width="345" height="270" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<rect x="395" y="48" width="345" height="270" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="192" y="76" text-anchor="middle" font-size="14" fill="var(--sv-ink)">内部碎片：块比请求大</text>
<text x="567" y="76" text-anchor="middle" font-size="14" fill="var(--sv-ink)">外部碎片：洞都不够大</text>

<rect x="50" y="110" width="175" height="70" fill="var(--sv-a)" fill-opacity="0.3" stroke="var(--sv-a)"/>
<rect x="225" y="110" width="105" height="70" fill="var(--sv-c)" fill-opacity="0.45" stroke="var(--sv-c)" stroke-dasharray="3 3"/>
<text x="137" y="140" text-anchor="middle" font-size="13" fill="var(--sv-ink)">请求 40 B</text>
<text x="137" y="160" text-anchor="middle" font-size="12" fill="var(--sv-muted)">对象实际使用</text>
<text x="277" y="140" text-anchor="middle" font-size="12" fill="var(--sv-ink)">填充</text>
<text x="277" y="160" text-anchor="middle" font-size="12" fill="var(--sv-muted)">24 B</text>
<text x="192" y="205" text-anchor="middle" font-size="12" fill="var(--sv-muted)">分配块 64 B，对齐与 size class 造成块内浪费</text>
<text x="192" y="240" text-anchor="middle" font-size="13" fill="var(--sv-ink)">浪费 = 64 − 40 = 24 B</text>
<text x="192" y="270" text-anchor="middle" font-size="12" fill="var(--sv-muted)">碎片率 = 24 ÷ 64 = 37.5%</text>

<rect x="415" y="110" width="90" height="60" fill="var(--sv-b)" fill-opacity="0.3" stroke="var(--sv-b)"/>
<rect x="505" y="110" width="50" height="60" fill="var(--sv-bg)" stroke="var(--sv-line)" stroke-dasharray="4 3"/>
<rect x="555" y="110" width="80" height="60" fill="var(--sv-b)" fill-opacity="0.3" stroke="var(--sv-b)"/>
<rect x="635" y="110" width="46" height="60" fill="var(--sv-bg)" stroke="var(--sv-line)" stroke-dasharray="4 3"/>
<rect x="681" y="110" width="39" height="60" fill="var(--sv-b)" fill-opacity="0.3" stroke="var(--sv-b)"/>
<text x="460" y="145" text-anchor="middle" font-size="12" fill="var(--sv-ink)">已用</text>
<text x="530" y="138" text-anchor="middle" font-size="12" fill="var(--sv-muted)">空闲</text>
<text x="530" y="152" text-anchor="middle" font-size="12" fill="var(--sv-muted)">50 B</text>
<text x="595" y="145" text-anchor="middle" font-size="12" fill="var(--sv-ink)">已用</text>
<text x="658" y="138" text-anchor="middle" font-size="12" fill="var(--sv-muted)">空闲</text>
<text x="658" y="152" text-anchor="middle" font-size="12" fill="var(--sv-muted)">46 B</text>
<text x="700" y="145" text-anchor="middle" font-size="12" fill="var(--sv-ink)">已用</text>
<rect x="470" y="200" width="110" height="34" rx="4" fill="var(--sv-a)" fill-opacity="0.22" stroke="var(--sv-a)"/>
<text x="525" y="222" text-anchor="middle" font-size="12" fill="var(--sv-ink)">请求 60 B</text>
<line x1="580" y1="217" x2="612" y2="217" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#allocation-req)"/>
<text x="620" y="221" font-size="12" fill="var(--sv-ink)">放不下</text>
<text x="567" y="270" text-anchor="middle" font-size="12" fill="var(--sv-muted)">总空闲 96 B ≥ 60 B，但最大连续空洞只有 50 B</text>
</svg>
<figcaption>图 4 · 内部碎片浪费在块内，外部碎片浪费在块间：总量够不代表能分配（块大小与浪费量为示例）</figcaption>
</figure>
<p>治理手段按代价从低到高：按生命周期分组，把同一请求/同一帧的对象放进 arena，统一回收；对固定尺寸对象用对象池（free list），消除尺寸混杂；容器提前 <code>reserve</code>，减少几何扩容留下的空洞；高频小对象考虑 small-buffer optimization（把少量元素内嵌在对象里）。把 malloc 换成 jemalloc/tcmalloc 通常能缓解多线程竞争、改善分配路径，碎片是否下降取决于负载与 size class 配置，而且不改变程序的生命周期设计。</p>
</section>

<section class="sec">
<h2>失败、异常与自定义分配器</h2>
<p>默认 <code>operator new</code> 分配失败时抛 <code>std::bad_alloc</code>。抛之前它会循环调用 <code>new_handler</code>：处理器可以释放预留内存、记录日志或直接 <code>std::terminate</code>；如果处理器返回，<code>operator new</code> 重试；没有处理器时抛出异常。用 <code>new (std::nothrow) T</code> 则分配失败返回 <code>nullptr</code>（构造异常仍会传播，nothrow 只覆盖分配阶段），适合不能抛分配异常的嵌入式或驱动代码。注意 <code>new_handler</code> 是全局的，多线程下所有分配共享同一策略，处理器本身必须线程安全。</p>
<p>异常安全是 new 表达式的一个隐藏福利。若构造函数抛出，标准要求自动调用匹配的 <code>operator delete</code> 归还存储，已构造完成的成员子对象也会在栈展开时被析构；<code>new T[n]</code> 中第 k 个元素构造失败时，前 k−1 个元素会被逆序析构，然后释放整块存储。前提是你用的是 new 表达式。如果手写 <code>::operator new</code> + placement new，构造函数一抛，存储就泄漏了，必须自己 <code>try/catch</code> 后释放。</p>
<p>替换全局 <code>operator new</code> 是合法且常见的做法（统计、隔离、调试），但要遵守契约：返回的存储大小足够且满足基本对齐，对齐重载则满足传入的 <code>std::align_val_t</code>；大小为 0 时也返回非空指针，且每次零大小分配返回的指针互不相同；失败时按签名抛 <code>bad_alloc</code> 或返回 <code>nullptr</code>（nothrow 版本）；线程安全；不能声明为 <code>inline</code>，也不能具有内部链接（不要写成 <code>static</code>）。标准库提供的 placement 形式不可替换，但可以定义自己签名的 placement 分配函数，并配对同签名的 placement delete。替换会影响整个程序，包括第三方库，所以更适合用类内 <code>operator new</code> 或分配器做局部控制。跨模块（尤其 Windows DLL）分配/释放时，务必保证两侧使用同一套 CRT/堆，否则在一个模块 new、另一个模块 delete 可能直接崩。</p>
<p>一个可编译的自定义分配器示例如下。它把一个 arena 包装成标准分配器，<code>deallocate</code> 为空操作，<code>reset</code> 统一回收；示例省略了 <code>n * sizeof(T)</code> 的溢出检查，生产代码应补上。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;cstddef&gt;
#include &lt;new&gt;
#include &lt;vector&gt;
#include &lt;iostream&gt;

class Arena {
public:
    explicit Arena(std::size_t bytes)
        : buf_(static_cast&lt;std::byte*&gt;(::operator new(bytes))), cap_(bytes) {}
    ~Arena() { ::operator delete(buf_); }
    Arena(const Arena&amp;) = delete;
    Arena&amp; operator=(const Arena&amp;) = delete;

    void* allocate(std::size_t n, std::size_t align) {
        std::size_t p = (cur_ + align - 1) &amp; ~(align - 1);
        if (p + n &gt; cap_) throw std::bad_alloc();
        cur_ = p + n;
        return buf_ + p;
    }
    void reset() noexcept { cur_ = 0; }
private:
    std::byte* buf_;
    std::size_t cap_;
    std::size_t cur_ = 0;
};

template &lt;class T&gt;
class ArenaAllocator {
public:
    using value_type = T;
    explicit ArenaAllocator(Arena&amp; a) noexcept : arena_(&amp;a) {}
    template &lt;class U&gt;
    ArenaAllocator(const ArenaAllocator&lt;U&gt;&amp; o) noexcept : arena_(o.arena()) {}

    T* allocate(std::size_t n) {
        return static_cast&lt;T*&gt;(arena_-&gt;allocate(n * sizeof(T), alignof(T)));
    }
    void deallocate(T*, std::size_t) noexcept {}
    Arena* arena() const noexcept { return arena_; }
    template &lt;class U&gt;
    bool operator==(const ArenaAllocator&lt;U&gt;&amp; o) const noexcept {
        return arena_ == o.arena();
    }
    template &lt;class U&gt;
    bool operator!=(const ArenaAllocator&lt;U&gt;&amp; o) const noexcept {
        return !(*this == o);
    }
private:
    Arena* arena_;
};

int main() {
    Arena arena(4096);
    std::vector&lt;int, ArenaAllocator&lt;int&gt;&gt; v{ArenaAllocator&lt;int&gt;(arena)};
    for (int i = 0; i != 10; ++i) v.push_back(i * i);
    int sum = 0;
    for (int x : v) sum += x;
    std::cout &lt;&lt; sum &lt;&lt; '\n';   // 285
}</code></pre>
<p>这段代码能编译运行，但它展示了 arena 的几个边界：<code>deallocate</code> 什么都不做，所以 <code>vector</code> 扩容后的旧块被浪费；<code>reset()</code> 之后任何还活着的容器指针都会悬空；底层块来自 <code>::operator new(bytes)</code>，只保证默认新对齐，若 <code>T</code> 是 over-aligned 类型，返回地址可能不满足 <code>alignof(T)</code>，需要改用对齐版 <code>operator new</code>，并在释放时传入相同的 <code>std::align_val_t</code>。它适合“一次性构建、一次性丢弃”的批处理，不适合作为通用全局分配器。</p>
<ul>
<li><b>错配释放</b>：<code>new[]</code>/<code>delete</code>、<code>malloc</code>/<code>delete</code>、<code>_aligned_malloc</code>/<code>free</code> 都是 UB，工具能查出来，别靠运气。</li>
<li><b>对齐丢失</b>：把 <code>malloc</code> 的返回值直接 placement new 到 over-aligned 类型上；或自定义分配器忘了把 <code>alignof(T)</code> 传给底层。</li>
<li><b>异常路径</b>：显式 <code>operator new</code> 后构造抛异常未释放；析构函数默认 <code>noexcept</code>，让它抛出异常会直接触发 terminate。</li>
<li><b>生命周期</b>：arena reset 后继续使用旧指针；分配器比容器先析构。</li>
</ul>
<p>排障顺序建议：先用 AddressSanitizer（配对与越界）、UBSan（未对齐、溢出等）或 Windows 的 Application Verifier，再用 heaptrack、Valgrind Massif、jemalloc 的 <code>malloc_stats_print</code> 看碎片与峰值，最后才考虑替换分配器。工具报的“泄漏”和“碎片”是两类问题，别用同一个指标解释。</p>
<details class="quiz"><summary>Q1 · <code>new T[10]</code> 之后写 <code>delete p</code>，为什么危险？</summary><div class="quiz__a">表达式配对错了。<code>delete[]</code> 不仅要释放整块存储，还要知道元素个数以便逐个析构；<code>delete</code> 只按单个对象处理。对非平凡析构的类型，通常只析构第一个元素，其余泄漏；若实现存了数组 cookie，<code>delete</code> 会把（可能位于 cookie 之后的）数组指针直接交给单对象的释放函数，块首对不上时堆元数据也可能被破坏。对 <code>int</code> 这类可平凡析构类型可能“碰巧正常”，但仍是 UB。正确写法是 <code>delete[] p</code>，更好的写法是用 <code>std::vector</code>。</div></details>
<details class="quiz"><summary>Q2 · <code>struct alignas(64) Node</code>，C++17 前后 <code>new Node</code> 有什么差别？</summary><div class="quiz__a">C++17 起，在未定义类内分配函数时，new 表达式发现 <code>alignof(Node) &gt; __STDCPP_DEFAULT_NEW_ALIGNMENT__</code> 会自动调用对齐版 <code>operator new(size_t, align_val_t)</code>，返回 64 字节对齐的存储。C++17 之前没有这个保证，需要手动用 <code>posix_memalign</code>、<code>_aligned_malloc</code> 或平台扩展拿存储再 placement new（C11 的 <code>aligned_alloc</code> 也可用，但 <code>std::aligned_alloc</code> 是 C++17 才有的）。注意：即便在 C++17，手写 <code>::operator new(sizeof(Node))</code> 也不会自动选对齐重载，必须显式传 <code>std::align_val_t</code>。</div></details>
<details class="quiz"><summary>Q3 · arena 的 <code>deallocate</code> 是空操作，为什么 <code>vector</code> 反复扩容仍然正确？</summary><div class="quiz__a">因为正确性不依赖“立刻归还”。<code>vector</code> 扩容时用移动（或拷贝）构造把元素搬到新块，再对旧元素调用析构，最后调用 <code>deallocate</code>；arena 不回收这块存储，只是浪费。容器持有的新指针有效，析构仍由容器负责。风险在容量与生命周期：旧块永远不回来，且 <code>reset()</code> 会让所有容器指针悬空。它适合批处理，不适合长期运行、需要回收的服务。</div></details>
<details class="quiz"><summary>Q4 · 构造函数抛异常时，<code>new T(args)</code> 会泄漏存储吗？</summary><div class="quiz__a">不会。new 表达式在构造函数抛出时会自动调用匹配的 <code>operator delete</code>（数组则调用 <code>operator delete[]</code>），并析构已经完整构造的成员；数组前面已构造的元素也会被逆序析构。会泄漏的是手动拆分步骤的写法：<code>void* raw = ::operator new(sizeof(T)); new (raw) T(args);</code> 中构造函数一抛，<code>raw</code> 就没人释放，必须自己 <code>try/catch</code>。</div></details>
<ul class="refs">
<li><b>cppreference: operator new, operator delete</b> — cppreference.com, 持续更新。重载形式、可替换规则与 C++17 对齐版本的权威速查。</li>
<li><b>cppreference: std::allocator, std::allocator_traits</b> — cppreference.com, 持续更新。分配器最小契约与 traits 的默认行为。</li>
<li><b>《Effective C++（第 3 版）》条款 49–52</b> — Scott Meyers, 2005。new/delete 配对、自定义 new/delete 与 placement new 的工程建议。</li>
<li><b>P0220R1: Adopt Library Fundamentals V1 TS Components for C++17</b> — Pablo Halpern 等, 2016。pmr 与 memory_resource 进入 C++17 的提案。</li>
<li><b>cppreference: std::pmr::memory_resource</b> — cppreference.com, 持续更新。标准提供的内存资源与 polymorphic_allocator 的用法。</li>
</ul>
</section>`
};
