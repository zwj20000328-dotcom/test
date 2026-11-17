window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["stl-algorithms"] = {
  slug: "stl-algorithms",
  title: "算法、lambda 与 ranges",
  subtitle: "用组合代替手写循环",
  level: 3,
  cluster: "泛型与标准库",
  tags: ["算法", "lambda", "ranges"],
  summary: "讲清算法分类与复杂度、lambda 捕获的生命周期、std::function 与 function_ref 的开销，以及 ranges 视图的惰性求值与投影组合。",
  keyPoints: [
    "算法只依赖迭代器能力与可调用对象，不依赖容器；remove 只搬移不删除，删除仍需 erase",
    "lambda 每个表达式生成唯一闭包类型，按值捕获复制、按引用捕获只存地址，被捕获对象先死即悬垂",
    "std::function 拥有并可能分配，调用难以内联；function_ref 非拥有、轻量，但不能延长生命周期",
    "ranges 视图构造 O(1)、迭代时才计算，take 能提前终止；视图通常不拥有数据，底层容器先销毁即悬垂（右值临时容器由 owning_view 接管）",
    "投影把“按什么比较”从比较器里拆出来；并行算法要求无数据竞争且异常不得逃逸"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>先给结论：算法是容器之上的动词</h2>
<p>手写一个 <code>for</code> 循环时，读代码的人必须先读完循环体，才能反推出这段代码到底是在找、在筛、在变换，还是在排序。STL 的设计把这层翻译提前到了名字上：<code>find_if</code>、<code>transform</code>、<code>sort</code> 这些<mark>算法</mark>（algorithm）是动词，容器是名词，迭代器（iterator）是把两者接起来的介词。你声明意图，标准库负责遍历。</p>
<p>接口演进也在做同一件事：C++98 用迭代器对加迭代器类别（iterator category）约束能力，C++17 加上执行策略（execution policy），C++20 通过 ranges（P0896）把迭代器对升级为 range，并用 concepts 重新表达约束。</p>
<p>分开之后有两个直接后果。第一，复杂度承诺写进了标准：<code>std::sort</code> 自 C++11 起保证 O(n log n) 次比较，<code>std::find</code> 至多做线性次数的相等比较（找到即停），这些承诺不随实现漂移。第二，算法默认<mark>不改变容器大小</mark>：它们只通过迭代器读写元素，删除和插入是容器成员的职责。这条规则是后面所有“删除为什么没生效”问题的根源。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>算法是“对一段元素做一件事”的抽象。你提供做什么（谓词或函数）和在哪里做（迭代器或 range），标准库负责怎么走。循环是手段，不是目的。</div></div>
</section>

<section class="sec">
<h2>算法分类：先认出意图，再挑名字</h2>
<p>标准库算法大体按“对元素做什么”分成几族，记住族比记住每个名字更有用：</p>
<ul>
<li><b>非修改</b>：<code>all_of</code>、<code>any_of</code>、<code>find</code>、<code>count</code>、<code>equal</code>、<code>search</code>，只读不写；多数只要求输入迭代器，<code>search</code> 需要前向迭代器。</li>
<li><b>修改</b>：<code>copy</code>、<code>move</code>、<code>transform</code>、<code>replace</code>、<code>fill</code>、<code>remove</code>、<code>unique</code>，写入目标区间，不改变容器大小。</li>
<li><b>划分与排序</b>：<code>partition</code>、<code>stable_partition</code>、<code>sort</code>、<code>stable_sort</code>、<code>partial_sort</code>、<code>nth_element</code>。</li>
<li><b>有序区间</b>：<code>lower_bound</code>、<code>upper_bound</code>、<code>equal_range</code>、<code>binary_search</code>，以及 <code>set_union</code>、<code>set_intersection</code> 等集合算法。</li>
<li><b>堆与数值</b>：<code>make_heap</code>、<code>push_heap</code>、<code>pop_heap</code>；<code>accumulate</code>、<code>reduce</code>、<code>inner_product</code>、<code>iota</code>、<code>transform_reduce</code>。</li>
</ul>
<p>选算法先看两件事：输入是否有序，以及是否真的需要全部结果。有序区间用 <code>lower_bound</code>，不要退回线性 <code>find</code>；只要前 k 个用 <code>partial_sort</code>，只要第 k 小用 <code>nth_element</code>；需要保留相等元素的相对顺序才付 <code>stable_sort</code> 的代价。容器有更强的成员版本时优先用它：<code>std::list::sort</code> 稳定且不要求随机访问迭代器，<code>std::map::find</code> 利用树结构，泛型 <code>std::find</code> 在 map 上只能线性扫描。</p>
<p>最容易踩的坑是“删除”。<code>std::remove_if</code> 并不删除元素，它把保留的元素依次前移，返回新的逻辑尾端，被“删掉”的元素仍留在尾部，处于有效但未指定的状态。真正缩短容器要靠 erase-remove 惯用法；C++20 起可以直接用自由函数 <code>std::erase_if</code>，它内部就是这两步。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>算法</th><th>迭代器要求</th><th>复杂度</th><th>备注</th></tr></thead><tbody>
<tr><td><code>find</code> / <code>count</code></td><td>input</td><td>O(n) 次比较</td><td>无序数据只能线性</td></tr>
<tr><td><code>remove_if</code></td><td>forward</td><td>O(n) 次谓词与移动</td><td>只搬移，返回新尾端</td></tr>
<tr><td><code>sort</code></td><td>random access</td><td>O(n log n) 次比较</td><td>不保证稳定</td></tr>
<tr><td><code>stable_sort</code></td><td>random access</td><td>有内存 O(n log n)，否则 O(n log² n)</td><td>分配失败时退化</td></tr>
<tr><td><code>partial_sort</code></td><td>random access</td><td>约 O(n log k)</td><td>只排前 k 个</td></tr>
<tr><td><code>nth_element</code></td><td>random access</td><td>平均 O(n)</td><td>典型实现为 introselect</td></tr>
<tr><td><code>lower_bound</code></td><td>forward</td><td>O(log n) 次比较；前进次数线性</td><td>要求区间已划分</td></tr>
<tr><td><code>accumulate</code></td><td>input</td><td>O(n)，严格从左到右</td><td>不可重排，不能并行</td></tr>
</tbody></table></div>
<p>表格里的“迭代器要求”不是风格问题，而是编译期约束：<code>std::sort</code> 需要随机访问，所以传 <code>std::list</code> 的迭代器根本编译不过；<code>stable_sort</code> 的退化路径是标准允许的，不是实现缺陷。复杂度中的 n 是区间长度，k 是部分排序的前缀长度。</p>
</section>

<section class="sec">
<h2>lambda：闭包类型、捕获方式与生命周期</h2>
<p>每个 lambda 表达式都会让编译器生成一个唯一的、无名的<mark>闭包类型</mark>（closure type）。捕获列表决定这个类有哪些数据成员，函数体成为它的 <code>operator()</code>；默认这个调用运算符是 const 的，加 <code>mutable</code> 才能修改按值捕获的成员。C++20 起无捕获 lambda 可以默认构造；无捕获的非泛型 lambda 还能隐式转换为函数指针，这也是它唯一能直接作为 C 风格回调传递的场合。</p>
<p>捕获方式决定闭包里存了什么。<code>[x]</code> 在构造时复制一份 x，之后 x 怎么变都与闭包无关；<code>[&amp;x]</code> 存 x 的地址（典型实现是一个指针），不延长 x 的生命周期；<code>[=]</code> 与 <code>[&amp;]</code> 是默认捕获，分别对用到的自动变量做值捕获和引用捕获。C++14 的初始化捕获 <code>[p = std::move(ptr)]</code> 可以新建成员并移动进闭包，是把 <code>unique_ptr</code> 送进回调的标准手法；C++17 的 <code>[*this]</code> 复制整个对象而非只存指针，适合把成员函数里的回调交给异步任务。</p>
<p>值捕获不等于深拷贝：捕获一个裸指针或 <code>std::string_view</code> 只是复制了指针和长度，指向的存储仍然可能先死。引用捕获则更直接：闭包只保存地址，被捕获对象销毁后闭包仍可调用，但那时引用已经悬垂。判断规则只有一条：<b>闭包活得比被捕获对象久，就不能按引用捕获</b>。返回 lambda、把 lambda 存进成员、投递给线程池，都属于“闭包会活得更久”。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="lambda 三种捕获方式：按值复制、按引用保存地址、初始化捕获移动对象，以及各自的悬垂风险">
<defs>
<marker id="stl-algorithms-cap" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="var(--sv-line)"></path></marker>
</defs>
<text x="24" y="28" font-size="14" font-family="inherit" fill="var(--sv-ink)">调用者的栈帧与闭包对象：捕获决定闭包里存的是值还是地址</text>
<rect x="24" y="42" width="250" height="252" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="40" y="66" font-size="13" font-family="inherit" fill="var(--sv-muted)">main 的栈帧</text>
<rect x="40" y="76" width="218" height="50" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="54" y="106" font-size="13" font-family="inherit" fill="var(--sv-ink)">int x = 10</text>
<rect x="40" y="138" width="218" height="64" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="54" y="164" font-size="13" font-family="inherit" fill="var(--sv-ink)">std::string s = "hi"</text>
<text x="54" y="186" font-size="12" font-family="inherit" fill="var(--sv-muted)">字符存在堆上</text>
<rect x="40" y="214" width="218" height="64" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="54" y="240" font-size="13" font-family="inherit" fill="var(--sv-ink)">vector&lt;int&gt; v = {1,2}</text>
<text x="54" y="262" font-size="12" font-family="inherit" fill="var(--sv-muted)">元素存在堆上</text>
<rect x="320" y="54" width="400" height="80" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)"></rect>
<text x="336" y="80" font-size="14" font-family="inherit" fill="var(--sv-ink)">A · [x] 按值捕获</text>
<text x="336" y="102" font-size="12" font-family="inherit" fill="var(--sv-ink)">闭包里是 x 的副本 10，构造时复制一次</text>
<text x="336" y="122" font-size="12" font-family="inherit" fill="var(--sv-muted)">与 x 的生命周期无关，可以安全返回</text>
<path d="M318 94 H266" fill="none" stroke="var(--sv-line)" marker-end="url(#stl-algorithms-cap)"></path>
<text x="270" y="86" font-size="11" font-family="inherit" fill="var(--sv-muted)">复制</text>
<rect x="320" y="150" width="400" height="80" rx="6" fill="var(--sv-panel)" stroke="var(--sv-c)"></rect>
<text x="336" y="176" font-size="14" font-family="inherit" fill="var(--sv-ink)">B · [&amp;s] 按引用捕获</text>
<text x="336" y="198" font-size="12" font-family="inherit" fill="var(--sv-ink)">闭包里存 s 的地址，典型实现为一个指针</text>
<text x="336" y="218" font-size="12" font-family="inherit" fill="var(--sv-muted)">s 销毁后仍可调用闭包，但那是未定义行为</text>
<path d="M318 192 H266" fill="none" stroke="var(--sv-line)" marker-end="url(#stl-algorithms-cap)"></path>
<text x="268" y="184" font-size="11" font-family="inherit" fill="var(--sv-muted)">取地址</text>
<rect x="320" y="246" width="400" height="80" rx="6" fill="var(--sv-panel)" stroke="var(--sv-b)"></rect>
<text x="336" y="272" font-size="14" font-family="inherit" fill="var(--sv-ink)">C · [v2 = std::move(v)] 初始化捕获（C++14）</text>
<text x="336" y="294" font-size="12" font-family="inherit" fill="var(--sv-ink)">闭包内是一个新的 vector，v 被移走后视为空</text>
<text x="336" y="314" font-size="12" font-family="inherit" fill="var(--sv-muted)">适合把 unique_ptr 等不可拷贝对象送进回调</text>
<text x="24" y="334" font-size="12" font-family="inherit" fill="var(--sv-muted)">闭包类型由编译器生成，每个 lambda 表达式一个，无法在源码里写出它的名字</text>
</svg>
<figcaption>图 1 · lambda 的捕获方式：按值复制出的成员独立于原对象，按引用只保存地址，初始化捕获可以移动对象进闭包</figcaption>
</figure>
<div class="callout callout--warn"><span class="callout__label">警告</span><div>把 <code>[&amp;]</code> 闭包存进成员或投递给异步任务，等于把“这个局部变量还活着”当成前提。重构时局部变量早死一步，崩溃就出现在另一个线程里。跨作用域的回调请按值捕获所需的数据，或明确转移所有权。</div></div>
<p>还有两个细节。其一，<code>[=]</code> 在成员函数里不会复制对象，它捕获的是 <code>this</code> 指针；C++20 起隐式捕获 this 被弃用，需要写出 <code>[=, this]</code> 或 <code>[*this]</code>。其二，C++14 的 <code>[](auto&amp; x)</code> 生成泛型 <code>operator()</code>，C++20 的 <code>[]&lt;typename T&gt;(T x)</code> 可以直接声明模板参数。</p>
</section>

<section class="sec">
<h2>std::function、函数指针与 function_ref 的开销</h2>
<p>lambda 的类型唯一且匿名，一旦要存进字段、放进 <code>vector</code> 或穿过非模板接口，就必须做<mark>类型擦除</mark>（type erasure）。<code>std::function&lt;R(Args...)&gt;</code> 是标准库提供的类型擦除容器：它拥有被包装的可调用对象，可以拷贝、移动，也可以用空状态表示“没有回调”。</p>
<p>所有权和类型擦除都有代价。构造 <code>std::function</code> 时，闭包要么放进内部的小缓冲区（small buffer optimization，SBO），要么在堆上分配；阈值取决于实现与 ABI，不是标准保证。调用通常经过一次间接跳转，很难内联；拷贝会复制整个闭包，可能分配、可能抛异常。空的 <code>std::function</code> 被调用会抛 <code>std::bad_function_call</code>。</p>
<p>如果接口只在调用期间使用回调、不打算保存它，就不需要所有权。C++26 草案已纳入的 <code>std::function_ref</code>（提案 P0792）表达“对可调用对象的非拥有引用”：典型实现是两个指针（对象地址加调用 thunk），构造与拷贝都很廉价，但它不延长生命周期，跨作用域保存时必须自己保证目标仍然存活，也不能像 <code>std::function</code> 那样表示空状态。现成替代有 LLVM 的 <code>llvm::function_ref</code> 或 Abseil 的 <code>absl::FunctionRef</code>。函数指针更窄：只适用于无捕获 lambda 和普通函数，无法携带状态。</p>
<div class="duo"><div class="duo__col"><h4>A · std::function</h4><p>拥有闭包，可拷贝、可为空；适合长期保存的回调表、事件处理器。代价是可能的堆分配、间接调用与拷贝开销，热路径上谨慎使用。</p></div><div class="duo__col"><h4>B · function_ref / 函数指针</h4><p>非拥有，调用方必须保证可调用对象活得更久；适合“只在本次调用内使用”的参数。零分配、拷贝廉价，但不能跨作用域保存；能否内联取决于具体类型——模板形参容易内联，<code>function_ref</code> 内部仍是间接调用。</p></div></div>
<p>工程上的优先级很清楚：能写成模板参数就用模板参数，编译器看得见具体类型；接口不能是模板、但只借用回调，就用 <code>function_ref</code> 一类的视图类型；确实需要存储和共享，才用 <code>std::function</code> 并接受它的开销。用 <code>std::bind</code> 拼回调通常不如直接写 lambda，前者的重载与求值规则更绕。</p>
</section>

<section class="sec">
<h2>ranges 与 views：把“一段元素”变成一等公民</h2>
<p>C++20 的 ranges 建立在三个概念上。<mark>range</mark> 是能取出 begin/end 的对象；<mark>view</mark> 是通常不拥有元素、可移动且移动与析构为常数时间的 range；<mark>borrowed_range</mark> 是“即使 range 对象本身是临时量，其迭代器仍然安全”的 range，比如 <code>std::span</code> 和 <code>std::string_view</code>。算法因此可以接收整个容器，也可以接收一个视图，不必再写一对迭代器。</p>
<p>视图通过 range adaptor 构造，并用 <code>|</code> 组合。常用的有 <code>views::filter</code>（保留谓词为真的元素）、<code>views::transform</code>（逐元素变换）、<code>views::take</code> / <code>views::drop</code>（取前 n 个 / 跳过前 n 个）、<code>views::take_while</code>、<code>views::reverse</code>（要求双向 range）、<code>views::iota</code>（生成序列）、<code>views::join</code>（把 range 的 range 摊平）、<code>views::split</code>（切分）、<code>views::elements&lt;N&gt;</code> / <code>keys</code> / <code>values</code>（取 tuple 或 map 的某一部分）。C++23 又补上 <code>views::zip</code>、<code>views::enumerate</code> 与 <code>ranges::to</code>。</p>
<p>关键在于<mark>惰性求值</mark>（lazy evaluation）：构造 <code>filter</code> 或 <code>transform</code> 视图时不会遍历任何元素，只保存底层 range 和可调用对象；只有迭代器前进或解引用时，才沿视图链按需计算。因此 <code>filter | transform</code> 只扫描一遍输入，每个被访问的元素至多测试一次谓词，变换只对通过筛选的元素调用；<code>take(n)</code> 收满 n 个结果后就不再向上游要元素，后面的输入根本不会被访问。急切写法则要额外分配中间容器，并且往往要多遍历几遍。</p>
<p>惰性也意味着生命周期必须由你保证。视图通常不拥有元素：用左值容器构造视图时，<code>views::all</code> 生成 <code>ref_view</code>，视图只保存指向容器的引用与迭代器，容器销毁或重新分配，视图立即悬垂——在函数里用局部 <code>vector</code> 构造视图再返回，就是典型例子。把临时容器直接接进管道则不同：现代 C++20 实现里 <code>views::all</code> 对右值非 view range 返回 <code>owning_view</code>，临时容器被移动进视图，所以 <code>make_vec() | views::filter(pred)</code> 不会悬垂（P2415R2 修正后的语义）。标准库对算法另有防呆：对右值 range 调用 ranges 算法、返回迭代器会悬垂时，返回类型变成 <code>std::ranges::dangling</code>，解引用即编译失败；但自己用 <code>auto</code> 接住基于左值容器的视图，编译器拦不住。跨作用域保存前先问：底层数据比视图活得久吗？</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="ranges 视图的嵌套结构与拉取链：take_view 包住 transform_view，再包住 filter_view 与底层 vector，解引用时逐层向上拉取；底部标注左值容器在函数返回后销毁导致的悬垂">
<defs>
<marker id="stl-algorithms-pull" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="var(--sv-a)"></path></marker>
</defs>
<text x="24" y="28" font-size="14" font-family="inherit" fill="var(--sv-ink)">视图对象只保存“怎么走”，元素仍在底层容器里</text>
<rect x="24" y="48" width="310" height="52" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)"></rect>
<text x="38" y="70" font-size="13" font-family="inherit" fill="var(--sv-ink)">take_view · n = 2</text>
<text x="38" y="90" font-size="12" font-family="inherit" fill="var(--sv-muted)">最外层，决定何时停止</text>
<rect x="44" y="112" width="270" height="52" rx="6" fill="var(--sv-panel)" stroke="var(--sv-b)"></rect>
<text x="58" y="134" font-size="13" font-family="inherit" fill="var(--sv-ink)">transform_view · fn(p) → p.name</text>
<text x="58" y="154" font-size="12" font-family="inherit" fill="var(--sv-muted)">对通过筛选的元素求值</text>
<rect x="64" y="176" width="230" height="52" rx="6" fill="var(--sv-panel)" stroke="var(--sv-b2)"></rect>
<text x="78" y="198" font-size="13" font-family="inherit" fill="var(--sv-ink)">filter_view · p.age &gt;= 18</text>
<text x="78" y="218" font-size="12" font-family="inherit" fill="var(--sv-muted)">谓词为假就跳过</text>
<rect x="84" y="240" width="190" height="52" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="98" y="262" font-size="13" font-family="inherit" fill="var(--sv-ink)">vector&lt;Person&gt;</text>
<text x="98" y="282" font-size="12" font-family="inherit" fill="var(--sv-muted)">真正拥有元素</text>
<path d="M368 300 V64" fill="none" stroke="var(--sv-a)" marker-end="url(#stl-algorithms-pull)"></path>
<text x="398" y="72" font-size="13" font-family="inherit" fill="var(--sv-ink)">take：计数未满，继续向上游要元素</text>
<text x="398" y="136" font-size="13" font-family="inherit" fill="var(--sv-ink)">transform：对当前元素求值并返回结果</text>
<text x="398" y="200" font-size="13" font-family="inherit" fill="var(--sv-ink)">filter：谓词为真才放行，否则跳过</text>
<text x="398" y="264" font-size="13" font-family="inherit" fill="var(--sv-ink)">base：迭代器移到下一个位置</text>
<text x="398" y="312" font-size="12" font-family="inherit" fill="var(--sv-muted)">一次解引用，逐层向上拉取</text>
<rect x="24" y="322" width="712" height="46" rx="6" fill="var(--sv-panel)" stroke="var(--sv-c)"></rect>
<text x="38" y="342" font-size="12" font-family="inherit" fill="var(--sv-ink)">悬垂：auto make_v() { std::vector&lt;int&gt; v{1,2,3}; return v | views::filter(pred); }</text>
<text x="38" y="360" font-size="12" font-family="inherit" fill="var(--sv-muted)">v 是左值，views::all 生成 ref_view；函数返回后容器销毁，视图中的迭代器全部悬空。</text>
</svg>
<figcaption>图 2 · ranges 惰性视图：视图层层嵌套，迭代时逐层拉取；最外层的 take 决定何时停止，底部是左值容器随函数返回销毁造成的悬垂</figcaption>
</figure>
</section>

<section class="sec">
<h2>投影、组合与算法流水线</h2>
<p>ranges 算法普遍多了一个<mark>投影</mark>（projection）参数：在比较之前，先把元素投影成另一个值。最常见的写法是传成员指针：<code>std::ranges::sort(people, {}, &amp;Person::age)</code> 按年龄排序，<code>std::ranges::find(people, 28, &amp;Person::age)</code> 按年龄查找，<code>std::ranges::max(people, {}, &amp;Person::age)</code> 找年龄最大的人。投影把“按什么比较”从“怎么比较”里拆了出来，于是不再需要一个只为某个字段存在的比较器 lambda。投影在排序这类比较型算法中随每次比较反复调用（一次比较对两个操作数各调用一次），在查找中则随元素逐个调用，所以它应当廉价且无副作用；按值返回大对象的投影会显著改变算法的常数因子。</p>
<p>range adaptor 本身也可以组合：<code>auto adults = views::filter(is_adult) | views::transform(to_name);</code> 得到的是一个<mark>适配器闭包</mark>（adaptor closure），可以再作用到任意 range 上，写成 <code>data | adults</code>。这让“流水线”成为可命名、可复用的值，而不是一串只能内联展开的表达式。组合顺序会改变语义：先 <code>take(3)</code> 再 <code>filter</code> 只看前三个元素；先 <code>filter</code> 再 <code>take(3)</code> 要扫到凑满三个匹配项，极端情况下遍历整个输入。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="算法流水线：vector 数据源依次经过 filter、transform、take 三个视图，迭代时逐元素拉取，收满两个结果后提前停止">
<defs>
<marker id="stl-algorithms-flow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="var(--sv-line)"></path></marker>
</defs>
<text x="16" y="30" font-size="14" font-family="inherit" fill="var(--sv-ink)">构造阶段：只保存引用与可调用对象，O(1)，不访问任何元素</text>
<rect x="16" y="52" width="150" height="84" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="32" y="77" font-size="14" font-family="inherit" fill="var(--sv-ink)">数据源</text>
<text x="32" y="100" font-size="12" font-family="inherit" fill="var(--sv-muted)">vector&lt;Person&gt;</text>
<text x="32" y="120" font-size="12" font-family="inherit" fill="var(--sv-muted)">5 个元素</text>
<rect x="196" y="52" width="150" height="84" rx="8" fill="var(--sv-panel)" stroke="var(--sv-a)"></rect>
<text x="212" y="77" font-size="14" font-family="inherit" fill="var(--sv-ink)">filter</text>
<text x="212" y="100" font-size="12" font-family="inherit" fill="var(--sv-muted)">age &gt;= 18</text>
<text x="212" y="120" font-size="12" font-family="inherit" fill="var(--sv-muted)">谓词 pred</text>
<rect x="376" y="52" width="150" height="84" rx="8" fill="var(--sv-panel)" stroke="var(--sv-b)"></rect>
<text x="392" y="77" font-size="14" font-family="inherit" fill="var(--sv-ink)">transform</text>
<text x="392" y="100" font-size="12" font-family="inherit" fill="var(--sv-muted)">p.name</text>
<text x="392" y="120" font-size="12" font-family="inherit" fill="var(--sv-muted)">函数 fn</text>
<rect x="556" y="52" width="150" height="84" rx="8" fill="var(--sv-panel)" stroke="var(--sv-b2)"></rect>
<text x="572" y="77" font-size="14" font-family="inherit" fill="var(--sv-ink)">take</text>
<text x="572" y="100" font-size="12" font-family="inherit" fill="var(--sv-muted)">n = 2</text>
<text x="572" y="120" font-size="12" font-family="inherit" fill="var(--sv-muted)">上限</text>
<path d="M168 94 H190" fill="none" stroke="var(--sv-line)" marker-end="url(#stl-algorithms-flow)"></path>
<path d="M348 94 H370" fill="none" stroke="var(--sv-line)" marker-end="url(#stl-algorithms-flow)"></path>
<path d="M528 94 H550" fill="none" stroke="var(--sv-line)" marker-end="url(#stl-algorithms-flow)"></path>
<rect x="16" y="164" width="728" height="152" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="32" y="192" font-size="13" font-family="inherit" fill="var(--sv-ink)">迭代阶段：谁被调用，调用几次</text>
<circle cx="42" cy="220" r="4" fill="var(--sv-a)"></circle>
<text x="56" y="225" font-size="12" font-family="inherit" fill="var(--sv-ink)">第 1 次：Ada / 36 → 谓词真 → p.name → take 收下（1/2）</text>
<circle cx="42" cy="252" r="4" fill="var(--sv-b2)"></circle>
<text x="56" y="257" font-size="12" font-family="inherit" fill="var(--sv-ink)">第 2 次：Bob / 17 → 谓词假 → transform 根本不会被调用</text>
<circle cx="42" cy="284" r="4" fill="var(--sv-b)"></circle>
<text x="56" y="289" font-size="12" font-family="inherit" fill="var(--sv-ink)">第 3 次：Chen / 28 → take 收下（2/2）→ 停止，后两个元素未访问</text>
<text x="32" y="348" font-size="12" font-family="inherit" fill="var(--sv-muted)">停止条件由最下游决定：take 满额后不再向上游要元素，惰性因此可以省掉整个后缀</text>
</svg>
<figcaption>图 3 · 算法流水线：三个视图在构造时不做任何事，迭代时逐元素拉取，filter 拦住 Bob，take 收满两个就终止</figcaption>
</figure>
<p>下面这个例子把投影、视图、管道和提前终止放在一起，是完整的 C++20 程序：</p>
<pre class="code" data-lang="cpp"><code>#include &lt;algorithm&gt;
#include &lt;iostream&gt;
#include &lt;ranges&gt;
#include &lt;string&gt;
#include &lt;vector&gt;

struct Person {
    std::string name;
    int age;
};

int main() {
    std::vector&lt;Person&gt; people{
        {"Ada", 36}, {"Bob", 17}, {"Chen", 28}, {"Dana", 42}, {"Eli", 15}
    };

    // 投影：只比较 age，不写比较器
    std::ranges::sort(people, {}, &amp;Person::age);

    // 视图是惰性的：这里只构造对象，不遍历
    auto adults = people
        | std::views::filter([](const Person&amp; p) { return p.age &gt;= 18; })
        | std::views::transform([](const Person&amp; p) { return p.name; })
        | std::views::take(2);

    for (const std::string&amp; name : adults) {
        std::cout &lt;&lt; name &lt;&lt; '\n';
    }
    // 输出（各占一行）：Chen、Ada
}
</code></pre>
<p>排序后年龄顺序是 Eli、Bob、Chen、Ada、Dana；filter 跳过 Eli 和 Bob，take 在拿到 Chen 和 Ada 后停止，Dana 从未被访问。整个过程排序比较次数 O(n log n)，流水线只扫一遍：谓词对 4 个元素各测一次，变换只对通过筛选的 2 个元素调用。没有中间容器，视图构造本身也不分配内存；流水线里唯一可能分配的对象是 transform 返回的 <code>std::string</code>（短串通常走 SSO，但不是标准保证）。确实需要落进容器时，C++23 用 <code>ranges::to&lt;std::vector&lt;std::string&gt;&gt;()</code>，C++20 用迭代器区间构造，只物化一次。</p>
</section>

<section class="sec">
<h2>并行算法、复杂度与失效陷阱</h2>
<p>C++17 给一批算法加了执行策略（execution policy）重载：<code>std::execution::seq</code> 禁止并行，<code>par</code> 允许跨线程，<code>par_unseq</code> 还允许跨线程的向量化，C++20 又加了只允许向量化、不跨线程的 <code>unseq</code>。并行版本对迭代器和元素访问提出额外要求：元素访问函数不得造成数据竞争、不得抛出未捕获的异常（一旦抛出，标准要求调用 <code>std::terminate</code>），并应避免可能死锁的同步。是否真的并行、切几个线程，标准不管；libstdc++ 的并行算法通常需要链接 TBB，MSVC 用自己的线程池，都取决于工具链。</p>
<p>并行不是免费的。小数据上线程调度可能比串行更慢；共享计数器、伪共享（false sharing）与非结合操作都会让结果或性能变差。<code>std::accumulate</code> 严格从左到右折叠，不能并行；并行求和用 <code>std::reduce</code>，但操作必须满足结合律与交换律，否则结果不确定；<code>std::transform_reduce</code> 把“映射 + 归约”写成一次 map-reduce。另外，截至 C++23，ranges 算法没有执行策略重载，并行 ranges 仍处于提案与实验阶段。</p>
<div class="formula">流水线总代价 ≈ Σ（每个元素经过的阶段数 × 单阶段代价）<br>erase–remove：O(n) 次搬移 + 被删元素的析构<br>sort 比较次数 ≤ C · n · log₂n；lower_bound 比较次数 ≤ log₂n + O(1)<br>partial_sort：约 n · log k；nth_element：平均线性<br>make_heap：O(n)；每次 push_heap / pop_heap：O(log n)</div>
<p>与算法组合相关的迭代器失效，集中在“算法返回的位置”和“保存下来的迭代器”两处。<code>remove</code> / <code>unique</code> 之后必须用返回的新尾端去 erase，不能拿旧的 <code>end()</code>；循环里删除元素要用 <code>it = v.erase(it)</code>，不要对已失效的迭代器做 <code>++</code>；<code>transform</code> 的输出区间不应与输入区间重叠，输出起点与输入起点相同的原地变换是安全且常见的用法，其余重叠情形应先复制到临时区间，或者改用从尾部开始复制的 <code>copy_backward</code>（当需要的只是复制而非变换时）。<code>sort</code> 不会让迭代器失效，但元素已被搬来搬去，用保存的迭代器指认“某个人”不再可靠。容器层面的失效规则在“STL 容器与迭代器”一篇展开，这里只强调算法返回值的用法。</p>
</section>

<section class="sec">
<h2>工程实践与排障</h2>
<p>把上面的规则压成一份可执行的清单：</p>
<ol>
<li><b>先命名意图</b>：如果一段循环能用 <code>find_if</code>、<code>any_of</code>、<code>transform</code> 说清楚，就不要再手写下标。</li>
<li><b>先确认有序</b>：二分与集合算法只对已按同一比较器排好序的区间有意义，混用不同比较器是逻辑错误，不是性能问题。</li>
<li><b>删除要两步</b>：<code>remove</code> / <code>unique</code> 只搬移，必须配合 erase；C++20 直接 <code>std::erase_if</code>。</li>
<li><b>视图当表达式</b>：视图适合在一条语句或一个函数内使用；需要跨作用域保存，就先物化成容器。</li>
<li><b>回调选型</b>：模板参数优先，其次非拥有的 <code>function_ref</code>，最后才是拥有所有权的 <code>std::function</code>；热路径避免拷贝 <code>std::function</code>。</li>
<li><b>并行先测量</b>：确认元素访问无竞争、操作可重排、异常不逃逸，再用基准测试决定是否值得。</li>
</ol>
<p>排障时，悬垂视图和悬垂闭包常表现为“偶尔读到垃圾值”或“换个优化级别就崩”。AddressSanitizer 通常能直接指出 stack-use-after-scope；错误在另一个线程时，先检查回调是否按引用捕获了局部变量或 this。模板报错则看第一个不满足的约束（比如 <code>random_access_range</code>），它通常就是根因，而不是最后那行实例化栈。</p>
<div class="callout callout--tip"><span class="callout__label">建议</span><div>先把流水线写成可读的表达式，确认语义正确，再在热点上决定是否物化或并行。为了省一次 vector 分配而把引用捕获和指向局部数据的视图带进回调，是把性能问题换成了生命周期问题。</div></div>
<h3>自测</h3>
<details class="quiz"><summary>Q1 · 为什么 <code>std::remove_if</code> 之后还要调用 <code>erase</code>？</summary><div class="quiz__a">算法只能通过迭代器读写元素，无权改变容器大小。<code>remove_if</code> 把保留元素依次前移，返回新逻辑尾端，尾部元素处于有效但未指定状态。必须用容器的 erase 删掉 [新尾端, 旧 end)。C++20 的 <code>std::erase_if</code> 封装了这两步。</div></details>
<details class="quiz"><summary>Q2 · 把函数内局部容器构造的视图返回出去，为什么会悬垂？</summary><div class="quiz__a">视图通常不拥有元素。<code>v | std::views::filter(pred)</code> 里 v 是左值，<code>views::all</code> 生成 <code>ref_view</code>，只保存引用与迭代器；函数返回后 v 销毁，视图里的迭代器悬垂，遍历是未定义行为。需要跨作用域保存就先物化成容器，或把容器移进 <code>owning_view</code> 让视图拥有数据。作为对照：把临时容器直接接进管道（<code>make_people() | std::views::filter(pred)</code>）在现代 C++20 实现里由 <code>owning_view</code> 接管，不会悬垂；而 <code>std::ranges::find(make_people(), x)</code> 这类右值调用会返回 <code>ranges::dangling</code>，编译期即可拦住。</div></details>
<details class="quiz"><summary>Q3 · 一个只在本次调用中使用的回调参数，应该用 <code>const std::function&amp;</code> 还是 <code>function_ref</code>？</summary><div class="quiz__a">优先 <code>function_ref</code>（已进入 C++26 草案；老编译器上可用 llvm::function_ref 或 absl::FunctionRef）：非拥有、无分配、拷贝廉价，但调用方必须保证可调用对象在调用期间存活，也不能安全地跨作用域保存。若接口需要保存回调或表示空状态，才用 <code>std::function</code> 并接受分配与间接调用。</div></details>
<details class="quiz"><summary>Q4 · 在 <code>std::for_each(std::execution::par, ...)</code> 里按引用捕获一个局部 int 并自增，会发生什么？</summary><div class="quiz__a">多个线程无同步写同一个 int，构成数据竞争，属于未定义行为。应改用 <code>std::atomic</code>、独立累加后合并，或直接用 <code>reduce</code> / <code>transform_reduce</code>。另外，元素访问函数抛出未捕获异常时，并行算法会调用 <code>std::terminate</code>。</div></details>
<h3>延伸阅读</h3>
<ul class="refs">
<li><b>cppreference · Algorithms library</b> — cppreference.com，持续更新。每个算法的签名、约束与复杂度承诺的权威速查。</li>
<li><b>cppreference · Ranges library</b> — cppreference.com，持续更新。range 概念、view 与 adaptor 的完整清单。</li>
<li><b>P0896R4 · The One Ranges Proposal</b> — Eric Niebler、Casey Carter 等，2018。C++20 ranges 的设计文档，解释 range、view 与投影的动机。</li>
<li><b>《Effective STL》</b> — Scott Meyers，2001。算法选择、erase–remove 惯用法与函数对象使用的经典工程经验，其中“优先用算法替代手写循环”“remove 之后要 erase”等条款至今适用。</li>
<li><b>P0792 · function_ref: a type-erased reference to a callable</b> — WG21 提案，已进入 C++26 草案。非拥有回调视图的设计与取舍。</li>
</ul>
</section>`
};
