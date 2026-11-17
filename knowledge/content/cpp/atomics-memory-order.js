window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["atomics-memory-order"] = {
  slug: "atomics-memory-order",
  title: "原子操作与内存序",
  subtitle: "happens-before 是可以被证明的",
  level: 4,
  cluster: "并发与性能",
  tags: ["atomic", "memory_order", "happens-before"],
  summary: "从数据竞争的定义出发，拆解六种内存序、release/acquire 配对与传递闭包，讲清 relaxed 计数、CAS 与 ABA、自旋锁与无锁结构的边界。",
  keyPoints: [
    "数据竞争是“两个冲突访问之间没有 happens-before”的未定义行为，而不是“结果看起来不对”",
    "sequenced-before 约束同一线程，synchronizes-with 约束跨线程，两者取传递闭包得到 happens-before",
    "release 写与读到该值的 acquire 读配对，把写者屏障前的所有写发布给读者屏障后的所有读",
    "relaxed 只保证原子性与单对象修改顺序，适合计数；需要发布或消费数据时必须用 acquire/release",
    "volatile 不提供原子性与跨线程顺序，x86 的强内存模型是硬件行为，不能替代 C++ 的 memory_order"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>一句话：原子性管“不可分割”，内存序管“看得见”</h2>
<p>一句话直觉：<mark>原子操作</mark>（atomic operation）解决“一次读写不可分割”，<mark>内存序</mark>（memory order）解决“一个线程的写，另一个线程按什么顺序看见”。前者防止撕裂与丢失更新，后者决定可见性。两者合起来，才构成 C++ 的并发语义。</p>
<p>很多人以为把变量换成 std::atomic 就安全了。原子性只对“这一个对象的这一次访问”成立：两次原子操作之间仍可能插入其他线程的操作，原子对象周围的普通变量也不会自动同步。反过来，内存序也不是性能旋钮，它描述的是一组可被证明的偏序关系；编译器与 CPU 只要不破坏这些关系，就可以自由重排。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>把两个线程想成两个人在各自的白板上工作。原子操作保证“一个格子不会被两个人同时改写”，内存序保证“什么时候允许看到对方白板上的哪些格子”。没有第二层保证，你看到的可能是半旧半新的世界：标志位已经翻转，它保护的数据却还没写过来。</div></div>
<p>本篇的目标不是让你背六个枚举，而是让你能指着一段代码说：这里的 release 与 acquire 建立了一条 happens-before 边，因此这个普通读不可能与那个普通写构成数据竞争。线程与互斥量的基础在 concurrency-basics 一篇，这里默认你已经会创建线程。</p>
</section>

<section class="sec">
<h2>数据竞争：标准意义上的“出错”是什么</h2>
<p><b>数据竞争</b>（data race）在标准里定义得很精确：两个可能并发的求值访问同一<b>内存位置</b>（memory location），至少一个是写，至少一个访问不是原子的，并且它们之间不存在 happens-before 关系。四条同时满足即构成数据竞争，程序行为未定义（undefined behavior，UB）。注意“内存位置”不等于“变量”：相邻的位域（bit-field）共享同一个内存位置，两个线程分别写同一结构体里相邻的位域，同样可能构成数据竞争。数据竞争与<b>竞争条件</b>（race condition）也不是一回事：后者是逻辑层面对时序的依赖，可能违反业务约束，却不一定违反语言标准。</p>
<p>为什么普通读写会出问题？编译器假设程序中不存在数据竞争，于是可以把变量缓存进寄存器、合并或删除重复读、按自己的顺序移动指令；CPU 会乱序执行，store buffer 会延迟提交。只要没有同步建立顺序，这些变换全都合法。你在 -O0 上看到的“正常”没有任何证明力，它只是最宽松执行环境的一次采样。</p>
<p>std::atomic（C++11）的合法用法有边界：模板实参必须是可平凡复制（trivially copyable）的类型，且 atomic 模板本身不可复制、不可移动；std::atomic&lt;T&gt; 不保证无锁，实现可以退化为内部锁。是否无锁要用 is_lock_free() 查询，C++17 起还可以用编译期常量 is_always_lock_free。典型 x86-64 与 ARM64 上 std::atomic&lt;int&gt; 通常无锁，sizeof 一般等于 4，但这是 ABI 细节而非标准保证；较大的结构体很可能走锁。C++20 起 std::atomic 的默认构造会值初始化（相当于写入 T()），C++11/14/17 中默认构造不初始化，必须显式给初值。</p>
<p>还有两个容易忽略的点：原子性不会传染，两个原子操作合起来不是原子的；访问原子对象必须始终通过它的接口，不能拿普通指针或引用绕过它读写同一块内存，否则仍然构成数据竞争。若确实需要对已有对象做原子访问，C++20 提供了 std::atomic_ref&lt;T&gt; 包装，但它要求 T 可平凡复制，并且在该引用存在期间，对象只能通过 atomic_ref 访问。</p>
</section>

<section class="sec">
<h2>六种 memory_order 与它们的强弱关系</h2>
<p>C++11 定义了六种 std::memory_order 枚举。它们作用在具体的原子操作上，而不是作用在变量或线程上；同一个原子变量，不同访问可以使用不同的序。先记住各自的一句话：</p>
<ul>
<li><b>relaxed</b>：只保证原子性与同一原子对象上的单一修改顺序，不建立跨对象的可见顺序。</li>
<li><b>consume</b>：名义上只约束数据依赖（carries a dependency）；标准从 C++17 起把它列为“暂时性劝阻”（temporarily discouraged），主流实现直接按 acquire 处理，新代码不应使用。</li>
<li><b>acquire</b>：用于读或读-改-写；该操作之后的读写不能上移到它之前。</li>
<li><b>release</b>：用于写或读-改-写；该操作之前的读写不能下沉到它之后。</li>
<li><b>acq_rel</b>：只用于读-改-写，同时具备 acquire 与 release 的约束。</li>
<li><b>seq_cst</b>：顺序一致（sequentially consistent）；所有 seq_cst 操作存在一个与各线程程序顺序相容的单一全局总序，并且各自带有 acquire 或 release 的约束。</li>
</ul>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>枚举</th><th>可用于</th><th>核心保证</th><th>典型用途</th></tr></thead>
<tbody>
<tr><td><code>memory_order_relaxed</code></td><td>load / store / RMW</td><td>原子性；该对象存在所有线程一致的单一修改顺序；无跨对象顺序</td><td>统计计数、序号分发</td></tr>
<tr><td><code>memory_order_consume</code></td><td>load / RMW</td><td>只要求携带依赖顺序；实现普遍等同 acquire；C++17 起被劝阻</td><td>理论上用于 RCU，实践中避免</td></tr>
<tr><td><code>memory_order_acquire</code></td><td>load / RMW</td><td>之后的读写不能上移到该操作之前</td><td>读取别人发布的数据</td></tr>
<tr><td><code>memory_order_release</code></td><td>store / RMW</td><td>之前的读写不能下沉到该操作之后</td><td>发布初始化好的数据</td></tr>
<tr><td><code>memory_order_acq_rel</code></td><td>仅 RMW</td><td>同时具备 acquire 与 release</td><td>CAS 更新共享结构</td></tr>
<tr><td><code>memory_order_seq_cst</code></td><td>load / store / RMW</td><td>在 acquire/release 之上再加单一全局总序</td><td>默认值；需要全局一致顺序</td></tr>
</tbody>
</table></div>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="六种内存序的强弱关系图：relaxed 最弱，向上依次是 acquire 与 release、acq_rel、seq_cst" font-family="inherit">
<defs>
<marker id="atomics-memory-order-arrow-1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"></path>
</marker>
</defs>
<text x="30" y="28" font-size="13" fill="var(--sv-muted)">约束强度递增：越往上，编译器与 CPU 可重排的空间越小</text>
<rect x="290" y="44" width="180" height="46" rx="8" fill="var(--sv-a2)" stroke="var(--sv-a)"></rect>
<text x="380" y="64" text-anchor="middle" font-size="13" fill="var(--sv-ink)">memory_order_seq_cst</text>
<text x="380" y="81" text-anchor="middle" font-size="12" fill="var(--sv-muted)">全部操作 · 单一全局总序</text>
<rect x="290" y="136" width="180" height="46" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="380" y="156" text-anchor="middle" font-size="13" fill="var(--sv-ink)">memory_order_acq_rel</text>
<text x="380" y="173" text-anchor="middle" font-size="12" fill="var(--sv-muted)">仅 RMW · 兼具两者</text>
<rect x="90" y="228" width="180" height="46" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="180" y="248" text-anchor="middle" font-size="13" fill="var(--sv-ink)">memory_order_acquire</text>
<text x="180" y="265" text-anchor="middle" font-size="12" fill="var(--sv-muted)">load / RMW · 后续不上移</text>
<rect x="490" y="228" width="180" height="46" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="580" y="248" text-anchor="middle" font-size="13" fill="var(--sv-ink)">memory_order_release</text>
<text x="580" y="265" text-anchor="middle" font-size="12" fill="var(--sv-muted)">store / RMW · 前序不下沉</text>
<rect x="290" y="310" width="180" height="46" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="380" y="330" text-anchor="middle" font-size="13" fill="var(--sv-ink)">memory_order_relaxed</text>
<text x="380" y="347" text-anchor="middle" font-size="12" fill="var(--sv-muted)">读写 / RMW · 仅原子性与单对象顺序</text>
<path d="M360 310 L204 277" stroke="var(--sv-line)" stroke-width="1.5" fill="none" marker-end="url(#atomics-memory-order-arrow-1)"></path>
<path d="M400 310 L556 277" stroke="var(--sv-line)" stroke-width="1.5" fill="none" marker-end="url(#atomics-memory-order-arrow-1)"></path>
<path d="M190 228 L322 184" stroke="var(--sv-line)" stroke-width="1.5" fill="none" marker-end="url(#atomics-memory-order-arrow-1)"></path>
<path d="M570 228 L438 184" stroke="var(--sv-line)" stroke-width="1.5" fill="none" marker-end="url(#atomics-memory-order-arrow-1)"></path>
<path d="M380 136 V93" stroke="var(--sv-line)" stroke-width="1.5" fill="none" marker-end="url(#atomics-memory-order-arrow-1)"></path>
<text x="380" y="374" text-anchor="middle" font-size="11" fill="var(--sv-muted)">memory_order_consume 名义上只约束数据依赖，实际被当作 acquire，未画入层级</text>
</svg>
<figcaption>图 1 · 六种内存序的强弱关系。箭头表示“约束更强、可重排空间更小”；acquire 只对读与 RMW 有意义，release 只对写与 RMW 有意义，两者通过 acq_rel 在 RMW 上合流。</figcaption>
</figure>
<p>几个容易踩的坑：relaxed 仍然保证同一原子对象上的单一修改顺序——所有线程对该对象的修改顺序有一致看法，只是不约束其他变量。把 memory_order_release 传给 load()、把 memory_order_acquire 传给 store()，不是“更严格”，而是违反标准前置条件（这两种操作允许的 order 取值有明确范围），行为未定义；release 只对写与 RMW 有意义，acquire 只对读与 RMW 有意义。默认参数是 seq_cst，它最强、也最不容易写错。工程顺序应该是先证明正确，再按测量结果逐个降级。</p>
</section>

<section class="sec">
<h2>happens-before：把“看起来对”变成可证明</h2>
<p>要证明一段无锁代码正确，靠的不是跑多少遍，而是构造 <b>happens-before</b>（先行发生，HB）关系。它由三层拼成，记住这三层，绝大多数内存序问题都能手工推导。</p>
<ol>
<li><b>sequenced-before</b>（同线程先行）：同一线程内按程序顺序，完整表达式之间、语句之间、函数调用的实参求值与函数体之间天然成立。它描述的是源码求值顺序，与另一个线程无关。</li>
<li><b>synchronizes-with</b>（跨线程同步）：对同一原子对象的 release 写，与读到该写（或读到该写所领导的 release sequence 中的写）的 acquire 读之间成立；release fence 与 acquire fence 在满足条件时也能建立。这是跨线程边的来源。</li>
<li><b>传递闭包</b>：若 A 先行于 B，B 先行于 C，则 A 先行于 C。sequenced-before 与 synchronizes-with 可以交替串联，把多个线程串成一条证明链。</li>
</ol>
<div class="formula">同线程：A sequenced-before B　⇒　A happens-before B<br>跨线程：release store 与读到它的 acquire load（或 release sequence 中的对应写）之间 synchronizes-with<br>happens-before ＝（sequenced-before ∪ synchronizes-with）的传递闭包<br>数据竞争 ⇔ 两个冲突访问之间不存在 happens-before</div>
<p>严格地说，标准把 happens-before 定义为 sequenced-before 与 inter-thread happens-before 的并集，而 inter-thread happens-before 由 synchronizes-with 与 sequenced-before 交替复合后再取传递闭包；上面的第三行是同一件事的简写。关键点是：happens-before 是<b>偏序</b>，不是墙上时间。两个线程之间没有任何同步时，它们的操作不可比较，谁先谁后没有定义；一旦建立了 HB 边，写者在该边之前的普通写，对读者在该边之后的普通读可见，并且不构成数据竞争。这也解释了为什么“加了 atomic 还偶发旧值”：问题往往不在原子性，而在缺失的 HB 边。</p>
<p>还要区分“可见”与“最新”。HB 保证的是：与某次写有 HB 边的读不会读到该写之前的值——acquire 读若与 release 写同步，它读到的必然是那个写或其 release sequence 中的写，不可能是更早的旧值。但对同一原子对象，读仍可能合法地取到修改顺序中较早的值，除非同步关系把它钉在某个特定写上。需要“等到条件成立”时，应该写循环或使用条件变量，而不是假设某次 load 必然看到某次 store。</p>
</section>

<section class="sec">
<h2>release/acquire 配对：消息传递的标准写法</h2>
<p>最常用的模式是消息传递：一个线程准备好数据，置一个“就绪”标志；另一个线程等标志，然后读数据。下面是一个完整可编译的例子，C++11 起即可，这里按 C++20 编译：</p>
<pre class="code" data-lang="cpp"><code>#include &lt;atomic&gt;
#include &lt;cassert&gt;
#include &lt;thread&gt;

int data = 0;                              // 普通变量，不是 atomic
std::atomic&lt;bool&gt; ready{false};            // 就绪标志；花括号初始化最稳妥

void producer() {
    data = 42;                             // ① 普通写
    ready.store(true, std::memory_order_release);  // ② 发布
}

void consumer() {
    while (!ready.load(std::memory_order_acquire)) {  // ③ 等待
        // 自旋
    }
    assert(data == 42);                    // ④ 一定成立
}

int main() {
    std::thread t1(producer);
    std::thread t2(consumer);
    t1.join();
    t2.join();
}</code></pre>
<pre class="code" data-lang="bash"><code>g++ -std=c++20 -O2 -pthread message-passing.cpp -o message-passing
./message-passing</code></pre>
<p>为什么断言一定成立：① sequenced-before ②，②与③ synchronizes-with（③ 读到的 true 正是 ② 写的），③ sequenced-before ④，传递闭包得到 ① happens-before ④。于是 ④ 的普通读与 ① 的普通写之间有 HB 边，不构成数据竞争。data 不需要是 atomic，前提是只有 producer 写它，且 consumer 对它的所有访问都被这对操作排序。（assert 在定义 NDEBUG 时会被移除，示例只是用来说明语义；生产代码可改成显式检查并记录日志。）</p>
<p>如果两边都用 relaxed，原子性有了，HB 边没有，data 的读与写并发，构成数据竞争；即便在 x86 上经常“看起来没事”，标准也不保证。也可以用显式栅栏表达：写侧先 data = 42，再 atomic_thread_fence(memory_order_release)，最后 flag.store(true, memory_order_relaxed)；读侧用 relaxed（或更强）的 load 等到 flag 为 true，再执行 atomic_thread_fence(memory_order_acquire)，然后读 data。这里 release fence 与 acquire fence 在“读读到了写”的条件下建立 fence-fence 同步，能取得与 release/acquire 配对相同的 happens-before；但栅栏与配对原子操作的关系更微妙——fence 必须放在正确的位置，并依赖特定的原子读写作中介——能用 release/acquire 直接表达时优先用它。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="release-acquire 消息传递：生产者先写 data，再 release 写 ready；消费者 acquire 读到 true 后读 data，建立 happens-before" font-family="inherit">
<defs>
<marker id="atomics-memory-order-arrow-2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-a)"></path>
</marker>
</defs>
<text x="380" y="30" text-anchor="middle" font-size="14" fill="var(--sv-ink)">release 把屏障前的写“发布”给 acquire 之后的读</text>
<rect x="20" y="54" width="340" height="296" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<rect x="400" y="54" width="340" height="296" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="190" y="80" text-anchor="middle" font-size="14" fill="var(--sv-ink)">线程 A · 生产者</text>
<text x="570" y="80" text-anchor="middle" font-size="14" fill="var(--sv-ink)">线程 B · 消费者</text>
<rect x="40" y="96" width="300" height="40" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="190" y="121" text-anchor="middle" font-size="13" fill="var(--sv-ink)">data = 42;（普通写）</text>
<text x="190" y="158" text-anchor="middle" font-size="12" fill="var(--sv-muted)">sequenced-before ↓</text>
<rect x="40" y="168" width="300" height="44" rx="6" fill="var(--sv-a2)" stroke="var(--sv-a)"></rect>
<text x="190" y="196" text-anchor="middle" font-size="13" fill="var(--sv-ink)">ready.store(true, release)</text>
<rect x="420" y="168" width="300" height="44" rx="6" fill="var(--sv-b2)" stroke="var(--sv-b)"></rect>
<text x="570" y="196" text-anchor="middle" font-size="13" fill="var(--sv-ink)">ready.load(acquire) → true</text>
<text x="570" y="232" text-anchor="middle" font-size="12" fill="var(--sv-muted)">sequenced-before ↓</text>
<rect x="420" y="240" width="300" height="44" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="570" y="268" text-anchor="middle" font-size="13" fill="var(--sv-ink)">读 data，得到 42</text>
<path d="M340 190 H416" stroke="var(--sv-a)" stroke-width="2" fill="none" marker-end="url(#atomics-memory-order-arrow-2)"></path>
<text x="378" y="182" text-anchor="middle" font-size="11" fill="var(--sv-a)">同步</text>
<text x="190" y="312" text-anchor="middle" font-size="12" fill="var(--sv-c)">两边都用 relaxed：data 可能读到 0</text>
<text x="570" y="306" text-anchor="middle" font-size="11" fill="var(--sv-muted)">synchronizes-with：release store</text>
<text x="570" y="324" text-anchor="middle" font-size="11" fill="var(--sv-muted)">与读到它的 acquire load 配对</text>
<text x="570" y="342" text-anchor="middle" font-size="11" fill="var(--sv-muted)">由此得到 A① happens-before B④</text>
</svg>
<figcaption>图 2 · release/acquire 消息传递。release 屏障之前的普通写在逻辑上被“打包”进这次 store；acquire 读到该值后，整包对屏障之后的读可见。若标志位用 relaxed，这层打包关系不存在。</figcaption>
</figure>
</section>

<section class="sec">
<h2>relaxed 计数、CAS 与无锁结构</h2>
<p>relaxed 的典型用途是计数：多线程各自 fetch_add(1, memory_order_relaxed)，只关心最终总数，不关心顺序。它保证每次加法都是不可分割的 RMW，不会丢更新；同一原子对象的 RMW 有单一修改顺序，所以最终计数是精确的。但它不保证计数与任何其他变量的可见顺序。若你用计数判断“任务全部完成”再去读结果，就必须让“完成”这一步带 release、读取侧带 acquire，否则结果可能还没发布。</p>
<p><b>CAS</b>（compare-and-swap，比较并交换）由 compare_exchange_weak 与 compare_exchange_strong 提供：把对象的当前值与 expected 按位比较（不调用 T 的 operator==，浮点的 +0.0 与 -0.0 也算不相等），相等则写入 desired 并返回 true；不等则把当前值写入 expected 并返回 false。expected 是左值引用，不能传临时量；成功时 expected 保持不变，失败时才被改写。C++11 起还有带两个内存序的重载：成功序与失败序，失败序不能是 release 或 acq_rel（失败路径没有写），并且不能强于成功序。weak 允许伪失败（spurious failure），标准允许它在值确实等于 expected 时仍返回 false，典型出现在 LL/SC 实现上；循环重试用 weak 便于生成更紧凑的代码，一次性判断用 strong 避免莫名重试。CAS 是构建无锁结构的基本砖块，但它只保证“这一个对象的这一次比较交换”，循环中读到的其他字段仍要靠内存序与重试维持一致。</p>
<p><b>ABA 问题</b>：线程 1 读到 head 为 A，算出 desired = A-&gt;next，准备 CAS(A, desired)；期间线程 2 弹出 A、释放它，之后新分配的节点恰好落在同一地址 A 并压回栈。线程 1 的 CAS 比较的只是地址，于是仍然成功，head 被改成它先前读到的 B——而 B 可能已经被释放或另作他用，栈结构随之被破坏。常见对策：给指针打包版本号做双字 CAS（x86-64 可用 128 位 cmpxchg16b，但不具可移植性，且 16 字节的 std::atomic 结构体也不保证无锁）；用 hazard pointer（风险指针）或 epoch 回收延迟释放；C++20 提供 std::atomic&lt;std::shared_ptr&lt;T&gt;&gt;，但实现可能内部加锁，性能要实测。</p>
<p>自旋锁是最小的同步构件：用一条 acquire 的 RMW 加锁、用 release 的写解锁。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;atomic&gt;
#include &lt;thread&gt;

class SpinLock {
public:
    void lock() noexcept {
        while (flag_.test_and_set(std::memory_order_acquire)) {
            // 自旋；可加入 _mm_pause()（x86，需 &lt;immintrin.h&gt;）或 std::this_thread::yield()
        }
    }
    void unlock() noexcept {
        flag_.clear(std::memory_order_release);
    }
private:
    std::atomic_flag flag_ = ATOMIC_FLAG_INIT;  // C++11 需此宏；C++20 起默认构造即清零，该宏被弃用
};</code></pre>
<p>std::atomic_flag 是标准保证无锁的原子类型，test_and_set 用 acquire、clear 用 release 就构成一个最小互斥。它只适合极短临界区，并且要配合退避（pause 或 yield），否则会白白占用核心；它也不保证公平，某个线程可能长期抢不到锁。长临界区直接用 std::mutex，Linux 上的典型实现走 futex，会让出 CPU 而不是空转。无锁队列（例如 Michael-Scott 队列）用 CAS 维护 head 与 tail，难点不在入队出队，而在安全回收被摘除的节点：没有回收方案，ABA 与 use-after-free 迟早出现。无锁编程的复杂度主要在这里，而不是在那几条 memory_order 上。</p>
</section>

<section class="sec">
<h2>缓存一致性、内存屏障与 false sharing</h2>
<p><b>缓存一致性</b>（cache coherence）协议（如 MESI）保证：对同一内存位置的写，在所有核心看来有单一顺序（实现上以缓存行为单位维护一致）；一个核心写后，其他核心的副本会失效。它保证的是“单个位置”的一致，不保证不同位置之间的先后，后者才是内存序与屏障要解决的问题。用一句话区分：coherence 管“这一格不会有两个版本”，consistency 管“多格之间的顺序”。</p>
<p><b>内存屏障</b>（memory barrier / fence）有两个层次。编译器屏障阻止编译器跨过它重排访存，GCC/Clang 的经典写法是 asm volatile("" ::: "memory")，标准里对应 std::atomic_signal_fence（只约束编译器，不生成硬件屏障）；硬件屏障阻止 CPU 与缓存的乱序效果，x86 有 mfence/lfence/sfence，ARM64 有 dmb 以及带序的 ldar/stlr。std::atomic 的 memory_order 会被翻译成合适的指令组合：典型 x86-64 上 acquire load 就是普通 mov（较晚的读、写不会被重排到它之前），release store 也是普通 mov（较早的读、写不会被重排到它之后），seq_cst store 常编译成 xchg 或 mov 加 mfence；ARM64 上 acquire 用 ldar、release 用 stlr。具体指令取决于编译器与目标，不能反过来当作语义。</p>
<p><b>伪共享</b>（false sharing）：两个线程各写自己的变量，但两个变量落在同一条缓存行（常见 64 字节，x86-64 与许多 ARM64 实现如此，但也有 128 字节的实现；这不是标准保证），每次写都会让对方核心的整行副本失效，缓存行在两核之间来回弹跳，吞吐可能明显下降，幅度取决于写频率与机器。解法是用 alignas(std::hardware_destructive_interference_size)（C++17，声明在 &lt;new&gt;）把热点变量隔开；该常量由实现定义，GCC/Clang 在 x86-64 上通常给 64，而且跨编译器版本可能变化，GCC 12 起在 ABI 敏感场景使用它还会触发 -Winterference-size 警告，因此不要把它硬编码进稳定的二进制接口。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="伪共享：两个计数器位于同一缓存行（示例按 64 字节），两个核心互相使整行失效；按缓存行对齐后各自独占一行" font-family="inherit">
<defs>
<marker id="atomics-memory-order-arrow-3" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"></path>
</marker>
</defs>
<text x="380" y="26" text-anchor="middle" font-size="14" fill="var(--sv-ink)">两个计数器落在同一缓存行：每次写都让对方整行失效</text>
<rect x="70" y="48" width="120" height="36" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="130" y="71" text-anchor="middle" font-size="14" fill="var(--sv-ink)">Core 0</text>
<rect x="210" y="48" width="120" height="36" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="270" y="71" text-anchor="middle" font-size="14" fill="var(--sv-ink)">Core 1</text>
<path d="M130 84 L150 108" stroke="var(--sv-line)" stroke-width="1.5" fill="none" marker-end="url(#atomics-memory-order-arrow-3)"></path>
<path d="M270 84 L224 108" stroke="var(--sv-line)" stroke-width="1.5" fill="none" marker-end="url(#atomics-memory-order-arrow-3)"></path>
<rect x="120" y="112" width="520" height="54" rx="4" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<rect x="120" y="112" width="65" height="54" fill="var(--sv-a2)" stroke="var(--sv-a)"></rect>
<text x="152" y="144" text-anchor="middle" font-size="12" fill="var(--sv-ink)">counter0</text>
<rect x="185" y="112" width="65" height="54" fill="var(--sv-b2)" stroke="var(--sv-b)"></rect>
<text x="217" y="144" text-anchor="middle" font-size="12" fill="var(--sv-ink)">counter1</text>
<rect x="250" y="112" width="390" height="54" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="430" y="144" text-anchor="middle" font-size="12" fill="var(--sv-muted)">同一缓存行的其余字节</text>
<text x="430" y="192" font-size="12" fill="var(--sv-ink)">写 counter1 使 Core 0 的整行副本失效</text>
<text x="430" y="212" font-size="12" fill="var(--sv-muted)">下一次读 counter0 必须跨核取回，开销与数据量无关</text>
<text x="380" y="236" text-anchor="middle" font-size="11" fill="var(--sv-muted)">常见缓存行 64 字节（实现相关，也有 128 字节）</text>
<text x="120" y="258" font-size="12" fill="var(--sv-ink)">行 A：counter0 与填充独占一行</text>
<rect x="120" y="266" width="520" height="38" rx="4" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<rect x="120" y="266" width="65" height="38" fill="var(--sv-a2)" stroke="var(--sv-a)"></rect>
<text x="152" y="290" text-anchor="middle" font-size="12" fill="var(--sv-ink)">counter0</text>
<text x="430" y="290" text-anchor="middle" font-size="12" fill="var(--sv-muted)">alignas 填充，不参与争用</text>
<text x="120" y="326" font-size="12" fill="var(--sv-ink)">行 B：counter1 与填充独占一行</text>
<rect x="120" y="334" width="520" height="38" rx="4" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<rect x="120" y="334" width="65" height="38" fill="var(--sv-b2)" stroke="var(--sv-b)"></rect>
<text x="152" y="358" text-anchor="middle" font-size="12" fill="var(--sv-ink)">counter1</text>
<text x="430" y="358" text-anchor="middle" font-size="12" fill="var(--sv-muted)">各行独立失效，互不干扰</text>
</svg>
<figcaption>图 3 · 伪共享与填充。上：两个被不同核心频繁写的变量共享一条缓存行，一致性流量随写频率增长；下：用对齐把变量分到不同缓存行，失效不再互相牵连。</figcaption>
</figure>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>不要把 x86 的强内存模型当成 C++ 语义。x86 是 TSO（total store order），load-load 与 store-store 不重排，但 store-load 可以重排；ARM64 更弱。而且在 x86 上，编译器仍可在 -O2 下重排没有同步约束的访存。用某一台机器的行为论证正确性，换编译器、换优化级别、换平台就可能失效。</div></div>
</section>

<section class="sec">
<h2>常见误区、自测与延伸阅读</h2>
<p>把这一篇压缩成一份排障清单，遇到并发问题时按顺序核对：</p>
<ul>
<li><b>volatile 不是同步</b>：它只阻止编译器把访问优化掉或合并（每次访问都是真实访存），常用于内存映射 I/O 与信号处理（例如 volatile std::sig_atomic_t）；C++20 起对 volatile 的复合赋值、自增自减等用法已被弃用。它不提供原子性、不建立 happens-before、也不阻止 CPU 重排。跨线程标志请用 std::atomic。</li>
<li><b>atomic 不等于线程安全</b>：它只保护单个对象；多个原子变量的组合仍需要一把锁或一套协议，否则会出现“各自都原子、整体不一致”的中间状态。</li>
<li><b>默认 seq_cst 也会漏</b>：序再强，也要求读写落在同一原子对象上并形成配对；用 relaxed 写标志、seq_cst 读标志，同样可能读不到期望的数据。</li>
<li><b>不要拿 memory_order 当性能旋钮</b>：先写出有 HB 证明的版本，再用 profiler 与压测决定是否降级；多数非极端争用场景下，seq_cst 的开销并不是瓶颈。</li>
<li><b>无锁不等于更快</b>：高争用下 CAS 失败重试、缓存行弹跳、回收延迟都可能让无锁结构慢于一把合适的锁。先测量，再选择。</li>
</ul>
<h3>自测</h3>
<details class="quiz"><summary>Q1 · 消息传递例子中 data 是普通 int，为什么消费者读它不构成数据竞争？</summary><div class="quiz__a">因为 release store 与读到它的 acquire load 建立了 synchronizes-with，配合两边的 sequenced-before 与传递闭包，得到“生产者写 data” happens-before “消费者读 data”。有 HB 边的冲突访问不构成数据竞争，所以 data 不必是 atomic。前提是只有生产者写 data，且消费者的读发生在 acquire 之后；若还有第三个线程绕过这对操作访问 data，结论就不成立。</div></details>
<details class="quiz"><summary>Q2 · 用 relaxed 的 fetch_add 统计“已完成任务数”，主线程看到计数达到 N 后直接读各线程写入的结果，为什么可能读到旧值？怎么改？</summary><div class="quiz__a">relaxed 只保证计数本身的原子性与修改顺序，不建立计数与其他变量的 HB 边。主线程与工作线程写结果之间没有 happens-before，仍可能读到旧值，甚至构成数据竞争。改法之一：每个工作线程写完结果后用 release 的 fetch_add 递增计数，主线程用 acquire 的读循环读到 N。递增都是同一对象上的 RMW，后一次递增落在前一次 release 操作所领导的 release sequence 中；这次 acquire 读因此与各次 release 递增同步，它们的写在读之前可见。更直白的做法是用 mutex 保护结果，或用 future、join 建立同步。</div></details>
<details class="quiz"><summary>Q3 · compare_exchange_weak 为什么会“什么都没变却返回 false”？什么时候该用 strong？</summary><div class="quiz__a">weak 允许伪失败：标准允许它在比较成功的情况下也返回 false，并不是某个平台独有的怪癖；采用 LL/SC 的实现（如 ARM）更容易出现，因为 store-conditional 可能失败。weak 的价值是允许生成更紧凑的重试序列，所以放在 while 重试循环里应优先用 weak；如果只做一次判断、失败就走另一条路径，用 strong 避免无谓重试。无论哪种，失败时都会把当前值写入 expected 引用，下一轮可直接复用；成功时 expected 保持不变。</div></details>
<details class="quiz"><summary>Q4 · 用 volatile bool 做自旋等待标志，为什么在 -O2 下可能永远转不出去，或者转出去后读到脏数据？</summary><div class="quiz__a">volatile 只要求每次访问都真实发生、不被编译器优化掉或合并，它不建立 happens-before，也不提供原子性（标准层面不保证不撕裂；bool 在实践中几乎不会撕裂，但语言没有承诺）。生产者写 data 与写 flag 之间没有 HB，编译器和 CPU 都可以重排，消费者可能在看到 flag 为 true 后仍读到旧的 data；这种跨线程读写本身构成数据竞争，是未定义行为，所以“永远转不出去”或“读到垃圾”都属于标准允许的结果。实际机器有缓存一致性，标志通常最终会可见，但可见时间与数据的新旧都不可依赖。正确做法是用 std::atomic&lt;bool&gt;，写侧 release store、读侧 acquire load；只是等待的话，条件变量通常更合适，能避免空转。</div></details>
<h3>延伸阅读</h3>
<ul class="refs">
<li><b>cppreference: std::memory_order</b> — cppreference.com。六种枚举的精确定义、每种操作允许的序、release sequence 与示例代码，是最方便的随时回查入口。</li>
<li><b>ISO/IEC 14882:2020（C++20）[atomics.order] 与 [intro.races]</b> — ISO/IEC。顺序一致、synchronizes-with、happens-before 与数据竞争的规范条文，本文所有规则以此为准。</li>
<li><b>C++ Concurrency in Action（第 2 版）第 5 章</b> — Anthony Williams, Manning, 2019。内存模型与原子类型操作的系统讲解，含无锁栈与无锁队列的完整实现及回收问题。</li>
<li><b>Preshing on Programming 内存序系列</b> — Jeff Preshing。包括 “Atomic vs. Non-Atomic Operations”、“Memory Barriers Are Like Source Control Operations”、“Acquire and Release Semantics” 等文章，用类比把屏障与 HB 讲透。</li>
<li><b>cppreference: std::atomic 与 std::hardware_destructive_interference_size</b> — cppreference.com。is_lock_free、is_always_lock_free 的语义，以及 C++17 缓存行常量（声明在 &lt;new&gt;）的实现定义性质。</li>
</ul>
</section>`
};
