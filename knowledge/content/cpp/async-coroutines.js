window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["async-coroutines"] = {
  slug: "async-coroutines",
  title: "async、future 与协程",
  subtitle: "从任务到挂起的执行模型",
  level: 4,
  cluster: "并发与性能",
  tags: ["future", "coroutine", "co_await"],
  summary: "从 future 的结果凭据讲到 C++20 协程：拆解 promise_type、awaiter 与 handle，讲清 co_await 展开、帧布局、调度与线程关系。",
  keyPoints: [
    "future 保存结果，协程保存执行现场；这是两种不同的异步模型",
    "future 是一次性凭据：get 阻塞且只能成功取一次，async 的 future 析构可能阻塞",
    "协程由 promise_type 控制生命周期，由 awaiter 决定挂起行为，由 handle 负责恢复",
    "协程帧通常分配在堆上，形参按值复制进帧，引用形参只保存引用",
    "协程不是线程也不是并行：resume 在哪个线程执行，协程体就在哪个线程运行"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>一句话直觉：future 保存结果，协程保存现场</h2>
<p>工程里的“并发”常常指两件不同的事。第一件是<b>并行</b>（parallelism）：把计算拆到多个核上同时跑，缩短墙钟时间。第二件是<b>异步</b>（asynchrony）：发起一个耗时操作后不占着线程干等，等结果可用时再回来处理。前者靠线程和线程池，后者靠一层“提交任务、稍后取结果”的抽象。</p>
<p>C++11 给出的最小异步设施是 <code>std::async</code>、<code>std::future</code>、<code>std::promise</code> 和 <code>std::packaged_task</code>。它们共享一个核心概念：<mark>共享状态</mark>（shared state，标准里的正式术语），结果或异常被写进这块由生产者和消费者共享的状态里，future 是读端，promise 是写端。C++20 则加入了<mark>协程</mark>（coroutine），把“函数执行到一半可以暂停、之后从原处继续”变成语言机制。</p>
<p>两者最大的区别在于保存什么：future 只保存<b>结果</b>，不保存“执行到哪”；协程保存<b>执行现场</b>，也就是帧（frame）和挂起点。这决定了两者的适用范围——future 适合一次性、粗粒度的任务，协程适合数量大、挂起频繁的 I/O 流程。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>future 像取餐小票：点单后你拿着票去干别的，回来凭票取餐，票只能用一次。协程像可以暂停的视频：暂停时画面和进度都保存着，点继续就从那一帧接着播。</div></div>
<p>下面的路线是：先用状态机把 future 讲透，再把 promise 和 packaged_task 放回生产与消费两端；然后进入协程，拆开 promise_type、awaiter、handle 三件套与帧布局；最后讨论调度、线程关系、性能与误用。线程与内存序本身不在本篇展开。</p>
</section>

<section class="sec">
<h2>std::async 与 future：一次性的结果凭据</h2>
<p><code>std::async</code>（C++11）是最省事的上手方式。它接受一个启动策略（launch policy）和一个可调用对象，返回 <code>std::future&lt;R&gt;</code>。<code>std::launch::async</code> 要求在新线程上执行；<code>std::launch::deferred</code> 表示延迟执行，直到第一次 <code>get()</code> 或 <code>wait()</code> 才在调用线程上同步跑完；不指定策略时标准允许实现自行选择，因此“它到底开不开线程”不是可移植的保证。需要确定性的时候，永远显式写出策略。</p>
<p>future 的状态可以用三句话概括：默认构造的 future 没有共享状态，<code>valid()</code> 为 false；由 async 或 <code>get_future()</code> 得到的 future 关联一块共享状态，可能尚未就绪（延迟未启动或正在运行），也可能已就绪；<code>get()</code> 会阻塞到就绪，取走值或重新抛出异常，之后 future 失效，再次调用 <code>get()</code> 属于未定义行为（libstdc++ 与 MSVC STL 通常抛 <code>std::future_error</code>，但不要依赖）。<code>wait()</code> 只等待、不消费，可以调用多次。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="future 状态机：共享状态被创建后进入延迟或运行中，任务完成变为就绪，get 取走后 future 失效">
<defs>
<marker id="async-coroutines-arrow" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto"><path d="M0,0 L0,7 L8,3.5 Z" fill="var(--sv-line)"/></marker>
</defs>
<text x="380" y="24" text-anchor="middle" font-size="15" font-family="inherit" fill="var(--sv-ink)">future 的状态：结果只被取走一次</text>
<rect x="24" y="270" width="190" height="60" rx="8" fill="var(--sv-bg)" stroke="var(--sv-line)" stroke-dasharray="5 4"/>
<text x="119" y="294" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">无共享状态</text>
<text x="119" y="314" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">默认构造 valid()==false</text>
<rect x="24" y="56" width="190" height="60" rx="8" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="119" y="80" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">创建共享状态</text>
<text x="119" y="100" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">async() / get_future()</text>
<rect x="266" y="56" width="176" height="60" rx="8" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="354" y="80" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">deferred 未启动</text>
<text x="354" y="100" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">首次 get 才执行</text>
<rect x="266" y="170" width="176" height="60" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="354" y="194" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">async 运行中</text>
<text x="354" y="214" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">工作线程执行任务</text>
<rect x="510" y="140" width="220" height="84" rx="8" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="620" y="168" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">就绪 ready</text>
<text x="620" y="188" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">值或异常已写入</text>
<text x="620" y="208" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">wait() 可多次，不消费</text>
<rect x="510" y="286" width="220" height="64" rx="8" fill="var(--sv-bg)" stroke="var(--sv-line)" stroke-dasharray="5 4"/>
<text x="620" y="311" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">已消费 moved-from</text>
<text x="620" y="331" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">valid()==false，get 不可再用</text>
<path d="M119,270 L119,116" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#async-coroutines-arrow)"/>
<text x="126" y="200" font-size="12" font-family="inherit" fill="var(--sv-muted)">赋值</text>
<line x1="214" y1="86" x2="266" y2="86" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#async-coroutines-arrow)"/>
<text x="240" y="78" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">deferred</text>
<path d="M214,104 C232,104 232,200 266,200" fill="none" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#async-coroutines-arrow)"/>
<text x="222" y="238" font-size="11" font-family="inherit" fill="var(--sv-muted)">async</text>
<path d="M354,116 L354,150 L510,160" fill="none" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#async-coroutines-arrow)"/>
<line x1="442" y1="194" x2="510" y2="188" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#async-coroutines-arrow)"/>
<text x="476" y="178" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">结果写入</text>
<path d="M620,224 L620,286" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#async-coroutines-arrow)"/>
<text x="628" y="260" font-size="12" font-family="inherit" fill="var(--sv-ink)">get() 取走，仅一次</text>
<text x="628" y="276" font-size="11" font-family="inherit" fill="var(--sv-muted)">取走后共享状态解绑</text>
</svg>
<figcaption>图 1 · future 状态机：创建、延迟/运行、就绪、被取走，四个阶段之间只有一条消费路径</figcaption>
</figure>
<p>有一个反直觉的坑：<code>std::async</code> 返回的 future 在析构时可能等待任务完成。准确地说，对于 async 策略，当它是引用该共享状态的最后一个 future 时，析构会阻塞到共享状态就绪；若还有别的 future 或 shared_future 引用同一状态，则不会。所以写 <code>std::async(std::launch::async, work);</code> 丢弃返回值，效果接近同步调用——临时 future 在语句结束时析构并阻塞。想真正“发射后不管”，必须把 future 存起来，例如放进容器或成员变量。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;chrono&gt;
#include &lt;future&gt;
#include &lt;iostream&gt;
#include &lt;stdexcept&gt;
#include &lt;thread&gt;

int slow_add(int a, int b) {
    std::this_thread::sleep_for(std::chrono::milliseconds(50));
    if (a &lt; 0) throw std::invalid_argument("negative input");
    return a + b;
}

int main() {
    std::future&lt;int&gt; f = std::async(std::launch::async, slow_add, 2, 3);

    // 主线程可以在这里做别的事，f 只是凭据
    int r = f.get();                  // 阻塞到就绪；异常在此重新抛出
    std::cout &lt;&lt; r &lt;&lt; '\n';            // 5
    std::cout &lt;&lt; f.valid() &lt;&lt; '\n';    // 0：get 之后失效
}</code></pre>
<p>异常的传播是 future 相对裸线程的重要优势：任务里抛出的异常被捕获并存进共享状态，<code>get()</code> 在调用线程重新抛出，不会触发 <code>std::terminate</code>。这正是“结果凭据”模型的价值：错误和值走同一条通道，调用者不需要额外的错误通道。</p>
</section>

<section class="sec">
<h2>promise 与 packaged_task：把生产和消费拆开</h2>
<p><code>std::promise&lt;T&gt;</code>（C++11）是共享状态的写端。<code>get_future()</code> 取出唯一一个 future；<code>set_value()</code> 或 <code>set_exception()</code> 写入结果，二者都只能成功一次。promise 析构时若从未设值，共享状态被标记为 <b>broken promise</b>，对应的 <code>get()</code> 抛出 <code>std::future_error</code>，错误码 <code>future_errc::broken_promise</code>。这让“生产者提前消失”变成一个可捕获的错误，而不是永久挂起。</p>
<p><code>std::packaged_task&lt;R(Args...)&gt;</code>（C++11）把任意可调用对象包装成一个任务：调用它的 <code>operator()</code> 就执行函数，并把返回值或异常写进共享状态。它是 move-only 的，可以塞进线程池队列；同一个 packaged_task 被调用第二次会抛 <code>future_error</code>（<code>promise_already_satisfied</code>）。相对 promise，它省掉了手写 try/catch 的样板代码。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>设施</th><th>角色</th><th>谁产出结果</th><th>典型用法</th><th>要记住的边界</th></tr></thead><tbody>
<tr><td><code>std::async</code></td><td>启动器 + future</td><td>新线程或延迟调用</td><td>一次性、粗粒度并行调用</td><td>默认策略不确定；future 析构可能阻塞</td></tr>
<tr><td><code>std::promise&lt;T&gt;</code></td><td>写端</td><td><code>set_value</code> / <code>set_exception</code></td><td>把回调式 API 桥接成 future</td><td>未设值即析构 → broken_promise</td></tr>
<tr><td><code>std::packaged_task</code></td><td>任务包装</td><td>调用 <code>operator()</code></td><td>投递到线程池或队列</td><td>move-only；第二次调用抛异常</td></tr>
<tr><td><code>std::future&lt;T&gt;</code></td><td>读端</td><td>—</td><td>取结果或异常</td><td>一次性：get 后失效，get 阻塞</td></tr>
<tr><td><code>std::shared_future&lt;T&gt;</code></td><td>广播读端</td><td>—</td><td>一份结果给多个等待者</td><td>get 可多次，返回 <code>const T&amp;</code></td></tr>
</tbody></table></div>
<p>需要多个消费者读同一个结果时用 <code>std::shared_future&lt;T&gt;</code>：拷贝它共享同一块状态，每个副本都能 <code>get()</code> 多次，适合“一份结果广播给多个等待者”。注意 shared_future 的 <code>get()</code> 返回 <code>const T&amp;</code>，多线程同时读是安全的，但如果 T 本身可变且被别的线程改写，仍需自己同步。</p>
<p>这四件设施都没有“续接”（continuation）能力：你不能说“future 就绪后自动执行下一段”。标准库至今没有给 <code>std::future</code> 提供 then。需要在结果到达时继续做事，要么轮询或阻塞，要么自己搭一层回调，要么转向协程——这正是 C++20 协程要解决的问题之一。</p>
</section>

<section class="sec">
<h2>协程三件套：promise_type、awaiter、handle</h2>
<p>按 C++20 的定义，一个函数体里只要出现 <code>co_await</code>、<code>co_yield</code>、<code>co_return</code> 中的任意一个，它就是<mark>协程</mark>。编译器不再把它编译成普通函数，而是改写成一台状态机：调用时分配<mark>协程帧</mark>（coroutine frame），在帧里构造一个 <b>promise 对象</b>，调用 <code>get_return_object()</code> 得到返回给调用者的对象，然后执行 <code>initial_suspend()</code> 决定是立刻开跑还是先挂起。</p>
<p><b>promise_type</b> 是协程的控制面板。编译器通过 <code>std::coroutine_traits&lt;Return, Args...&gt;</code> 查找它，默认取返回类型里嵌套的 <code>promise_type</code>。它决定六件事：<code>get_return_object</code> 返回什么、<code>initial_suspend</code> 与 <code>final_suspend</code> 挂不挂起、<code>yield_value</code> 如何接收值、<code>return_value</code> 或 <code>return_void</code> 如何收尾、<code>unhandled_exception</code> 如何处理未捕获异常。你写的每一个协程库，本质上都是在设计这个类型。</p>
<p><b>awaiter</b> 是“一次挂起”的行为载体，需要三个方法：<code>await_ready()</code> 返回 true 表示不必挂起；<code>await_suspend(handle)</code> 在挂起前调用，可以返回 void、bool（false 表示取消挂起）或另一个 <code>coroutine_handle</code>（对称转移）；<code>await_resume()</code> 在恢复后（或本来就没挂起时）调用，其返回值就是整个 <code>co_await</code> 表达式的值。<b>handle</b> 是 <code>std::coroutine_handle&lt;Promise&gt;</code>，内部只保存一个指向帧的指针；模板参数 <code>Promise</code> 决定 <code>promise()</code> 的静态类型，因此它本身并不做类型擦除，<code>coroutine_handle&lt;&gt;</code>（<code>void</code> 特化）才是可互相转换的通用句柄。它提供 <code>resume()</code>、<code>done()</code>、<code>destroy()</code>；<code>from_promise()</code> 从 promise 取回句柄，<code>from_address()</code> 从裸地址构造句柄。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="协程帧典型布局：形参副本、promise 对象、跨挂起点局部变量、挂起点索引、resume 与 destroy 函数指针，handle 指向帧">
<defs>
<marker id="async-coroutines-frame-arrow" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto"><path d="M0,0 L0,7 L8,3.5 Z" fill="var(--sv-line)"/></marker>
</defs>
<text x="380" y="24" text-anchor="middle" font-size="15" font-family="inherit" fill="var(--sv-ink)">协程帧的典型布局（非标准保证）</text>
<text x="40" y="64" font-size="12" font-family="inherit" fill="var(--sv-muted)">一次分配承载整个协程的存活状态；典型实现在堆上，HALO 优化后可落在栈上</text>
<rect x="40" y="86" width="680" height="118" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<rect x="40" y="86" width="112" height="118" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="96" y="132" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">形参副本</text>
<text x="96" y="152" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">按值复制进帧</text>
<text x="96" y="170" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">引用只存引用</text>
<rect x="152" y="86" width="132" height="118" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="218" y="132" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">promise 对象</text>
<text x="218" y="152" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">挂起策略 / 返回值</text>
<text x="218" y="170" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">异常处理入口</text>
<rect x="284" y="86" width="186" height="118" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="377" y="132" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">局部变量与临时量</text>
<text x="377" y="152" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">只保留跨挂起点存活的</text>
<text x="377" y="170" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">作用域结束即析构</text>
<rect x="470" y="86" width="106" height="118" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="523" y="132" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">挂起点索引</text>
<text x="523" y="152" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">状态机 pc</text>
<text x="523" y="170" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">恢复从哪继续</text>
<rect x="576" y="86" width="144" height="118" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="648" y="132" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">resume / destroy</text>
<text x="648" y="152" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">函数指针</text>
<text x="648" y="170" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">handle 调用它们</text>
<text x="200" y="246" font-size="12" font-family="inherit" fill="var(--sv-muted)">对齐填充可能插在各段之间；段的顺序、大小与偏移由编译器自行决定（标准未规定）</text>
<rect x="40" y="270" width="250" height="56" rx="8" fill="var(--sv-bg)" stroke="var(--sv-a)"/>
<text x="165" y="294" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">coroutine_handle&lt;P&gt;</text>
<text x="165" y="314" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">指向帧的指针（P 为静态类型）</text>
<path d="M165,270 L165,232 L165,204" fill="none" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#async-coroutines-frame-arrow)"/>
<text x="330" y="292" font-size="12" font-family="inherit" fill="var(--sv-ink)">resume() → 按索引跳到挂起点之后继续执行</text>
<text x="330" y="314" font-size="12" font-family="inherit" fill="var(--sv-ink)">destroy() → 调用帧内 destroy 指针，释放整帧</text>
</svg>
<figcaption>图 2 · 协程帧承载形参、promise、跨挂起点局部变量与状态机信息；handle 只是指向它的指针</figcaption>
</figure>
<p>帧里放什么，标准没有规定，上图只是典型实现的概念性做法（GCC、Clang、MSVC 的具体布局并不相同，标准也不存在统一的协程帧 ABI）。帧通常分配在堆上，但编译器若能证明协程不会在调用者返回后继续存活（HALO，heap allocation elision），可以把帧放到调用者的栈上，甚至完全消除分配。这也解释了为什么“协程一定有一次 malloc”的说法并不准确：它取决于优化能力与代码形态。</p>
<p>由此引出一条必须记住的规则：<b>形参被拷贝进帧，引用形参只保存引用本身</b>。如果协程在调用者返回之后才恢复，而引用指向调用者的局部变量，那个对象早已销毁——这类悬垂很难在编译期发现。同理，协程帧里保存的 <code>this</code> 也必须保证对象活得比协程久。</p>
</section>

<section class="sec">
<h2>co_await、co_yield、co_return：语法与展开</h2>
<p>三个关键字的分工很清楚。<code>co_await expr</code> 表示“在这里可能挂起，等 expr 就绪后取它的值”；<code>co_yield v</code> 是 <code>co_await promise.yield_value(v)</code> 的简写，用于产出一个值并暂停；<code>co_return v</code> 结束协程，先调用 <code>promise.return_value(v)</code>（无值时调用 <code>return_void()</code>），再进入 <code>final_suspend</code>。判定一个函数是不是协程，只看函数体里有没有这三个关键字，与返回类型无关。</p>
<div class="formula">co_await expr 的展开（先按成员 operator co_await、ADL 自由 operator co_await、expr 自身的顺序取得 awaiter）：
① awaiter.await_ready() 为 true 时不挂起，直接跳到 ③
② 否则调用 awaiter.await_suspend(handle)：返回 void 或 true 时协程挂起、控制权返回调用者；返回 false 时取消挂起、继续执行；返回另一个 handle 时做对称转移
③ 恢复（或本来就没挂起）后调用 awaiter.await_resume()，其返回值即整个表达式的值</div>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="co_await 三步展开：await_ready 判断是否挂起，await_suspend 交出控制权，恢复后 await_resume 取值">
<defs>
<marker id="async-coroutines-await-arrow" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto"><path d="M0,0 L0,7 L8,3.5 Z" fill="var(--sv-line)"/></marker>
</defs>
<text x="380" y="24" text-anchor="middle" font-size="15" font-family="inherit" fill="var(--sv-ink)">一次 co_await 的三个阶段</text>
<rect x="40" y="70" width="200" height="70" rx="8" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="140" y="100" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">① await_ready()</text>
<text x="140" y="122" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">结果已就绪吗</text>
<rect x="290" y="70" width="200" height="70" rx="8" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="390" y="100" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">② await_suspend(h)</text>
<text x="390" y="122" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">登记 handle，交出控制权</text>
<rect x="540" y="70" width="190" height="70" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="635" y="100" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">③ await_resume()</text>
<text x="635" y="122" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">返回表达式的值</text>
<line x1="240" y1="105" x2="290" y2="105" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#async-coroutines-await-arrow)"/>
<text x="265" y="62" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-ink)">false</text>
<line x1="490" y1="105" x2="540" y2="105" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#async-coroutines-await-arrow)"/>
<text x="515" y="94" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--sv-muted)">恢复</text>
<path d="M140,140 L140,236" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#async-coroutines-await-arrow)"/>
<text x="148" y="196" font-size="11" font-family="inherit" fill="var(--sv-ink)">true</text>
<rect x="40" y="240" width="200" height="64" rx="8" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="140" y="266" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">不挂起</text>
<text x="140" y="288" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">直接调用 await_resume</text>
<rect x="290" y="240" width="200" height="64" rx="8" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="390" y="266" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">挂起，返回调用者</text>
<text x="390" y="288" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">由调度器稍后 resume</text>
<path d="M390,140 L390,240" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#async-coroutines-await-arrow)"/>
<text x="398" y="196" font-size="11" font-family="inherit" fill="var(--sv-muted)">控制权离开协程</text>
<path d="M490,272 C520,272 520,150 540,130" fill="none" stroke="var(--sv-line)" stroke-dasharray="4 4" stroke-width="1.5" marker-end="url(#async-coroutines-await-arrow)"/>
<text x="540" y="230" font-size="11" font-family="inherit" fill="var(--sv-muted)">resume 之后</text>
</svg>
<figcaption>图 3 · co_await 的三步：能否不挂起、挂起时把 handle 交给谁、恢复后取什么值</figcaption>
</figure>
<p>第 ② 步决定了“谁来恢复”。<code>await_suspend</code> 拿到当前协程的 handle，可以把它登记到事件循环、放进线程池队列；也可以返回另一个协程的 handle（而不是自己调用 <code>resume()</code>），由运行时直接把控制权转过去，这就是对称转移（symmetric transfer）。后者能避免“恢复链”把调用栈越堆越深：A 恢复 B 时不是嵌套调用，而是 A 先挂起、让出它占用的栈空间，再由运行时尾调用进入 B，栈深度保持常量。</p>
<p>把这三个关键字组合起来，最典型的产物就是<mark>生成器</mark>（generator）：一个能按需产出序列、每次只在 <code>co_yield</code> 处暂停的函数。下面这段是完整可编译的 C++20 例子，<code>Generator</code> 自己充当返回类型，<code>promise_type</code> 把 <code>co_yield</code> 的值存进 <code>current</code>，调用者用 <code>next()</code> 推进、用 <code>value()</code> 取值。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;coroutine&gt;
#include &lt;exception&gt;
#include &lt;iostream&gt;

class Generator {
public:
    struct promise_type {
        int current = 0;
        Generator get_return_object() {
            return Generator{
                std::coroutine_handle&lt;promise_type&gt;::from_promise(*this)};
        }
        std::suspend_always initial_suspend() noexcept { return {}; }
        std::suspend_always final_suspend() noexcept { return {}; }
        std::suspend_always yield_value(int v) noexcept {
            current = v;
            return {};
        }
        void return_void() noexcept {}
        void unhandled_exception() { std::terminate(); }
    };

    explicit Generator(std::coroutine_handle&lt;promise_type&gt; h) : h_(h) {}
    ~Generator() { if (h_) h_.destroy(); }
    Generator(const Generator&amp;) = delete;
    Generator&amp; operator=(const Generator&amp;) = delete;

    bool next() {
        h_.resume();
        return !h_.done();
    }
    int value() const { return h_.promise().current; }

private:
    std::coroutine_handle&lt;promise_type&gt; h_;
};

Generator iota(int n) {
    for (int i = 0; i &lt; n; ++i) co_yield i;
}

int main() {
    Generator g = iota(3);
    while (g.next()) std::cout &lt;&lt; g.value() &lt;&lt; ' ';
    std::cout &lt;&lt; '\n';   // 输出 0 1 2
}</code></pre>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="生成器执行流：调用只建帧，next 触发 resume，co_yield 挂起并交回调用者，循环结束后 final_suspend">
<defs>
<marker id="async-coroutines-gen-arrow" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto"><path d="M0,0 L0,7 L8,3.5 Z" fill="var(--sv-line)"/></marker>
</defs>
<text x="380" y="24" text-anchor="middle" font-size="15" font-family="inherit" fill="var(--sv-ink)">生成器：调用者与协程交替推进</text>
<rect x="40" y="48" width="330" height="56" rx="8" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="56" y="72" font-size="13" font-family="inherit" fill="var(--sv-ink)">iota(3)：只建帧并构造 promise</text>
<text x="56" y="92" font-size="11" font-family="inherit" fill="var(--sv-muted)">函数体一行都没执行</text>
<rect x="40" y="128" width="330" height="56" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="56" y="152" font-size="13" font-family="inherit" fill="var(--sv-ink)">initial_suspend 挂起</text>
<text x="56" y="172" font-size="11" font-family="inherit" fill="var(--sv-muted)">get_return_object 把 Generator 交给调用者</text>
<rect x="40" y="208" width="330" height="56" rx="8" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="56" y="232" font-size="13" font-family="inherit" fill="var(--sv-ink)">g.next() → handle.resume()</text>
<text x="56" y="252" font-size="11" font-family="inherit" fill="var(--sv-muted)">从上次挂起点继续执行</text>
<rect x="40" y="288" width="330" height="56" rx="8" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="56" y="312" font-size="13" font-family="inherit" fill="var(--sv-ink)">co_yield v：保存现场并挂起</text>
<text x="56" y="332" font-size="11" font-family="inherit" fill="var(--sv-muted)">控制权回到调用者，value() 读 v</text>
<path d="M370,316 C410,316 410,236 370,236" fill="none" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#async-coroutines-gen-arrow)"/>
<text x="420" y="276" font-size="11" font-family="inherit" fill="var(--sv-muted)">循环：0,1,2</text>
<rect x="450" y="120" width="280" height="80" rx="8" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="466" y="146" font-size="13" font-family="inherit" fill="var(--sv-ink)">循环结束：return_void()</text>
<text x="466" y="168" font-size="11" font-family="inherit" fill="var(--sv-muted)">进入 final_suspend（suspend_always）</text>
<text x="466" y="188" font-size="11" font-family="inherit" fill="var(--sv-muted)">done() 变为 true</text>
<rect x="450" y="238" width="280" height="80" rx="8" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="466" y="264" font-size="13" font-family="inherit" fill="var(--sv-ink)">~Generator() 调用 destroy()</text>
<text x="466" y="286" font-size="11" font-family="inherit" fill="var(--sv-muted)">释放整帧；final_suspend 挂起</text>
<text x="466" y="306" font-size="11" font-family="inherit" fill="var(--sv-muted)">正是为了让这步安全的执行</text>
<path d="M370,300 C404,300 424,224 450,196" fill="none" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#async-coroutines-gen-arrow)"/>
<text x="378" y="168" font-size="11" font-family="inherit" fill="var(--sv-muted)">退出循环</text>
<path d="M590,200 L590,238" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#async-coroutines-gen-arrow)"/>
</svg>
<figcaption>图 4 · 生成器执行流：调用只建帧，resume 推进到下一个 co_yield，final_suspend 保住帧直到 destroy</figcaption>
</figure>
<p>对照代码读图：<code>iota(3)</code> 被调用时并不执行循环体，只是建帧、构造 promise、在 <code>initial_suspend</code> 处挂起并把 <code>Generator</code> 返回。每次 <code>next()</code> 调用 <code>resume()</code>，协程从上次挂起点继续，直到下一个 <code>co_yield</code>；循环结束后 <code>return_void</code> 被调用，进入 <code>final_suspend</code>，此后 <code>done()</code> 为 true。<code>final_suspend</code> 返回 <code>suspend_always</code> 是有意的：让帧活到调用者读完 promise 之后，再由 <code>~Generator</code> 里的 <code>destroy()</code> 释放。</p>
</section>

<section class="sec">
<h2>调度、恢复与线程：协程不是线程</h2>
<p>协程没有自己的线程；它也不保留一条跨挂起的调用栈——挂起时，需要延续的局部状态被搬进协程帧，恢复时再回到当前线程的栈上继续执行。<code>resume()</code> 在哪个线程被调用，协程体就在哪个线程上执行；两次恢复之间，协程不占用任何 CPU。所谓<mark>调度器</mark>（scheduler），就是决定“什么时候、在哪个线程上调用 resume”的那部分代码：可以是线程池的任务队列，可以是 epoll 或 IOCP 事件循环的回调，也可以是单线程的 GUI 主循环。</p>
<p>C++20 的标准库只提供协程的<b>语言与底层设施</b>（<code>coroutine_handle</code>、<code>suspend_always</code>、<code>suspend_never</code>、<code>coroutine_traits</code>）。C++23 补上了同步生成器 <code>std::generator</code>，但调度器与通用 task 类型仍不在标准库里；这一层要等 std::execution（P2300）——它已纳入 C++26 工作草案，尚未定稿。因此网上看到的 <code>task&lt;T&gt;</code>、<code>async_scope</code> 以及功能更完整的 <code>generator</code> 封装，大多来自具体库或自己实现。“协程能不能跨线程恢复”这类问题没有统一答案——它取决于 <code>await_suspend</code> 把 handle 交给了谁，以及那个执行器如何调度。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>协程不等于并发，更不等于并行。一个只用协程、没有线程池的程序仍然是单线程的；协程只是让单个线程能在多个任务之间低成本切换。要利用多核，仍然需要线程；已纳入 C++26 工作草案（尚未定稿）的 std::execution（P2300）则试图把调度器与执行资源也纳入标准设施。</div></div>
<p>恢复语义上还有两个细节。其一，<code>final_suspend</code> 若返回 <code>suspend_never</code>，协程结束时会自动销毁帧，handle 立即失效，调用者不能再触碰 promise；若返回 <code>suspend_always</code>，帧保留，必须有人显式 <code>destroy()</code>，否则泄漏。其二，<code>await_suspend</code> 里对 handle 的操作必须考虑数据竞争：把 handle 投递到另一个线程的队列，通常需要加锁或使用无锁队列，因为恢复可能立刻在另一个线程发生。</p>
<p>这也解释了一个常见困惑：为什么协程里 <code>co_await</code> 一个“异步读文件”不会自动变快？因为真正干活的是底层的 io_uring、epoll 或线程池，协程只是把“等待”表达成一次挂起。没有执行器接住 handle 并注册回调，<code>await_suspend</code> 返回之后就没有人再 <code>resume()</code>，协程会永远停在那里。</p>
</section>

<section class="sec">
<h2>性能、成本与常见误用</h2>
<p>协程切换的成本主要来自“保存少量活跃状态 + 跳转”，不涉及内核态，因此通常明显低于线程上下文切换（后者要陷入内核、可能切换地址空间）；但这不是标准保证，具体开销取决于平台、编译器和优化级别。第一次调用协程可能有一次帧分配（典型实现走堆），帧的大小大致由形参、promise、跨挂起点局部变量，再加上状态机索引、resume/destroy 指针与对齐填充构成——深调用链上嵌套协程，内存占用会叠加。开启优化后 HALO 常能消除分配，但前提是编译器能证明协程的生命周期不逃逸。</p>
<div class="formula">协程 ≠ 线程 ≠ 并行
切换成本：用户态保存现场，与挂起次数成正比
线程切换：内核调度，还受缓存局部性与调度器影响
并行度：由同时运行的线程数决定，协程本身不提高并行度</div>
<p>排障时按下面的顺序检查，能覆盖大多数问题：</p>
<ul>
<li><b>future 相关</b>：<code>get()</code> 调用两次（未定义行为）；丢弃 async 的返回值导致隐式同步；默认策略下任务根本没有并行；promise 未设值就析构，<code>get()</code> 抛 <code>broken_promise</code>。</li>
<li><b>生命周期</b>：协程捕获或引用局部变量，恢复时对象已销毁；<code>final_suspend</code> 用错导致帧泄漏或提前销毁；生成器被 move 后原对象仍尝试 resume。</li>
<li><b>线程与同步</b>：在协程里跨挂起点持有 <code>std::mutex</code>（锁被带到另一个线程，或在挂起期间长期占用）；误以为协程体串行执行而省掉原子操作。</li>
<li><b>调度</b>：在 <code>await_suspend</code> 里同步阻塞（例如等待条件变量），把整个事件循环卡住；恢复链过深导致栈溢出，应考虑对称转移。</li>
</ul>
<div class="callout callout--tip"><span class="callout__label">建议</span><div>先用 std::async 与 future 解决“一次性、粗粒度”的并行；确认瓶颈是大量等待、且任务数量远超线程数时，再引入协程。协程的收益来自“用少量线程承载大量挂起任务”，不是来自“语法更现代”。</div></div>
<p>另一个常见误解是把 future 当成“轻量协程”。future 的 <code>get</code> 是阻塞的，等待期间线程被占住；大量并发等待会迅速耗尽线程。协程把“等待”变成“保存现场并返回”，这才是它在高并发 I/O 场景中的价值。反过来说，纯 CPU 密集的计算用协程没有收益，因为根本没有挂起点可利用。</p>
</section>

<section class="sec">
<h2>自测</h2>
<details class="quiz"><summary>Q1 · 为什么说 <code>std::async(std::launch::async, work);</code> 丢掉返回值等于同步执行？</summary><div class="quiz__a">临时 future 在整条语句结束时析构。对 async 策略，当它是引用该共享状态的最后一个 future 时，标准要求析构阻塞到共享状态就绪（等价于 wait），所以主线程会一直等到工作线程完成。要真正异步，必须把 future 存进一个生命周期更长的变量。顺带一提，若策略是 deferred，析构不会启动任务，任务从未执行——两种默认策略的行为差异正是必须显式指定策略的原因。</div></details>
<details class="quiz"><summary>Q2 · <code>co_yield v</code> 在语义上等价于什么？生成器为什么通常在 <code>initial_suspend</code> 处挂起？</summary><div class="quiz__a"><code>co_yield v</code> 等价于 <code>co_await promise.yield_value(v)</code>，即把 v 交给 promise 后挂起，恢复时继续执行下一条语句。生成器在 <code>initial_suspend</code> 用 <code>suspend_always</code>，是为了让调用者先拿到 Generator 对象，之后由 <code>next()</code> 显式驱动；若用 <code>suspend_never</code>，函数体会在调用者拿到返回对象之前就开始执行：<code>get_return_object</code> 确实已在函数体之前调用、Generator 也已构造，但返回对象要等协程首次挂起才交到调用者手里，于是协程会先跑到第一个 <code>co_yield</code>；调用者拿到的 Generator 已停在第一个挂起点，按 <code>next()</code> 驱动的协议再推进就会跳过第一个值。</div></details>
<details class="quiz"><summary>Q3 · 协程的 <code>final_suspend</code> 返回 <code>suspend_never</code> 与 <code>suspend_always</code> 分别意味着什么？各有什么风险？</summary><div class="quiz__a"><code>suspend_never</code>：协程结束后帧被自动销毁，handle 立即失效，此后对它的任何操作（包括 <code>done()</code>、<code>destroy()</code>、访问 promise）都是未定义行为，常见后果是重复释放。<code>suspend_always</code>：帧保留，调用者可以安全读取 promise 里的结果，但必须有人负责 <code>destroy()</code>，否则帧泄漏。生成器与 task 常用后者，因为结果需要在协程结束后被读取。</div></details>
<details class="quiz"><summary>Q4 · 一个协程在 <code>await_suspend</code> 里把 handle 放进线程池队列，然后在协程体里跨挂起点持有 <code>std::mutex</code> 的锁，会有什么问题？</summary><div class="quiz__a"><code>std::mutex</code> 要求加锁与解锁发生在同一线程，而协程可能在另一个线程被 resume，解锁即未定义行为。即使换成可跨线程的锁，挂起期间一直持锁也会阻塞其他任务，形成事实上的串行化。正确做法是把临界区限制在单个挂起点之间，或使用支持异步等待的锁设施。</div></details>
</section>

<section class="sec">
<h2>延伸阅读</h2>
<ul class="refs">
<li><b>cppreference: Coroutines</b> — cppreference.com，持续更新。语言规则、<code>coroutine_handle</code>、<code>suspend_always</code> 与 <code>coroutine_traits</code> 的权威速查。</li>
<li><b>P0912R5: Coroutines</b> — Gor Nishanov 等，2018 年，C++20 采纳。正式提案，解释了 promise_type 与 awaiter 的设计取舍。</li>
<li><b>《C++20 - The Complete Guide》</b> — Nicolai M. Josuttis，2022。协程章节从 co_await 讲到生成器与调度器封装，例子完整。</li>
<li><b>cppreference: std::future</b> — cppreference.com，持续更新。future、promise、packaged_task 的状态与异常语义速查。</li>
<li><b>《C++ Concurrency in Action》第 2 版</b> — Anthony Williams，2019。第 4 章讲 future、promise 与任务投递的工程用法。</li>
</ul>
</section>`
};
