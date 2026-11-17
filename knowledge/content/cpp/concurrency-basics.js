window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["concurrency-basics"] = {
  slug: "concurrency-basics",
  title: "线程、互斥量与条件变量",
  subtitle: "先保证正确，再追求并行",
  level: 4,
  cluster: "并发与性能",
  tags: ["thread", "mutex", "condition_variable"],
  summary: "从并发与并行的区别讲起，拆解 std::thread 与 jthread 的生命周期、互斥量与三种锁守卫、条件变量的伪唤醒，并用生产者消费者与线程池示例说明死锁四条件与避免策略。",
  keyPoints: [
    "并发是同时应对多件事的结构，并行是同时做多件事的执行；并发代码的第一目标是正确，而不是更快",
    "std::thread 析构时仍 joinable 会调用 std::terminate；std::jthread（C++20）析构时自动 request_stop 再 join",
    "互斥量保护的是共享可变状态，锁守卫用 RAII 保证 unlock；同时锁多把时用 std::scoped_lock（C++17）",
    "条件变量必须配合谓词使用，wait(lock, pred) 消化伪唤醒，状态修改与谓词检查必须在同一把锁下",
    "死锁的四个必要条件破坏任意一条即可排除：一次取全部锁、固定加锁顺序、try_lock 超时退避"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>并发不是并行：先把问题定义清楚</h2>
<p>很多人从「多开几个线程跑得更快」开始接触多线程。这个直觉只对了一半：线程首先解决「同时应对多件事」的结构问题，其次才是性能问题。前者叫<mark>并发</mark>（concurrency），后者叫<mark>并行</mark>（parallelism）。</p>
<p>并发是逻辑层面的：程序被分解成多个可以独立推进的任务，执行区间可以重叠。并行是物理层面的：多个任务同时在多个核上执行。单核机器靠时间片轮转也能提供并发，但不存在并行。Rob Pike 在 2012 年的演讲里说得最清楚：并发是「同时应对多件事」，并行是「同时做多件事」。</p>
<div class="duo"><div class="duo__col"><h4>并发（concurrency）</h4><p>关注结构：任务如何分解、如何共享状态、如何协调先后。单核也能成立。</p></div><div class="duo__col"><h4>并行（parallelism）</h4><p>关注执行：同一时刻有多少任务真正在跑。需要多核或加速器。</p></div></div>
<p>区分这两者决定了优化顺序。并发代码的第一目标是<b>正确</b>：没有数据竞争、没有死锁、没有丢失唤醒。第二目标才是<b>可扩展</b>：加核能变快。所谓<mark>数据竞争</mark>（data race），指两个线程访问同一内存位置、至少有一次是写、至少有一次不是原子操作，且两个访问之间没有 happens-before 关系；在 C++ 里它是未定义行为。happens-before 的严格定义留给 atomics-memory-order，本篇只用到「互斥量建立先后关系」这一条。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>把共享状态想成一块白板。并发是安排多个人轮流上白板写字，并行是白板前真的站了多个人。没有「一次只能一个人写」的规则，内容就会互相覆盖。互斥量就是那条规则，条件变量是「等别人写完再上」的约定。</div></div>
</section>

<section class="sec">
<h2>std::thread 与 std::jthread：线程必须有归宿</h2>
<p><code>std::thread</code>（C++11）代表一个可执行线程。构造时传入可调用对象和参数，新线程随即开始执行（真正被调度到的时刻由实现决定）；thread 构造函数返回后，调用线程继续往下走。没有单独的「启动」步骤，创建即启动。thread 对象不拥有线程的栈，也不传递异常，只是一个句柄。</p>
<p>这个句柄必须被收尾：析构时若 <code>joinable()</code> 为 true，标准要求调用 <code>std::terminate</code>。线程要么 <code>join()</code>（等待结束并回收资源），要么 <code>detach()</code>（脱钩后台运行，之后不能再 join）。忘记其一，程序会在析构时直接终止，现场往往看似无关。</p>
<p>还有两个常见坑。第一，线程入口函数抛出的异常不会传播到创建者，逸出即 <code>std::terminate</code>，所以入口通常要包一层 try/catch。第二，<code>std::thread</code> 的构造函数会按值拷贝（decay-copy）实参，想传引用必须显式 <code>std::ref</code>；若传入的是局部变量的引用，线程又可能在变量销毁后才访问它。这两种错误编译器都拦不住。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="std::thread 与 std::jthread 的生命周期状态与收尾路径" font-family="inherit">
<defs>
<marker id="concurrency-basics-m1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-ink)"></path>
</marker>
</defs>
<text x="30" y="28" font-size="14" fill="var(--sv-ink)">std::thread（C++11）：创建即启动，析构前必须收尾</text>
<rect x="30" y="46" width="150" height="56" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
<text x="105" y="69" font-size="13" text-anchor="middle" fill="var(--sv-ink)">std::thread t(f)</text>
<text x="105" y="88" font-size="12" text-anchor="middle" fill="var(--sv-muted)">构造：新线程开始执行</text>
<line x1="182" y1="74" x2="214" y2="74" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#concurrency-basics-m1)"></line>
<rect x="216" y="46" width="150" height="56" rx="6" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
<text x="291" y="69" font-size="13" text-anchor="middle" fill="var(--sv-ink)">joinable() == true</text>
<text x="291" y="88" font-size="12" text-anchor="middle" fill="var(--sv-muted)">句柄仍关联一个线程</text>
<line x1="368" y1="74" x2="400" y2="74" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#concurrency-basics-m1)"></line>
<rect x="402" y="46" width="150" height="56" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
<text x="477" y="69" font-size="13" text-anchor="middle" fill="var(--sv-ink)">执行线程函数</text>
<text x="477" y="88" font-size="12" text-anchor="middle" fill="var(--sv-muted)">异常逸出即 terminate</text>
<line x1="554" y1="74" x2="586" y2="74" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#concurrency-basics-m1)"></line>
<rect x="588" y="46" width="142" height="56" rx="6" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
<text x="659" y="69" font-size="13" text-anchor="middle" fill="var(--sv-ink)">线程函数返回</text>
<text x="659" y="88" font-size="12" text-anchor="middle" fill="var(--sv-muted)">线程结束，句柄仍 joinable</text>
<line x1="291" y1="102" x2="291" y2="126" stroke="var(--sv-line)" stroke-width="1.5"></line>
<line x1="135" y1="126" x2="620" y2="126" stroke="var(--sv-line)" stroke-width="1.5"></line>
<line x1="135" y1="126" x2="135" y2="146" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#concurrency-basics-m1)"></line>
<line x1="380" y1="126" x2="380" y2="146" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#concurrency-basics-m1)"></line>
<line x1="620" y1="126" x2="620" y2="146" stroke="var(--sv-c)" stroke-width="1.5" marker-end="url(#concurrency-basics-m1)"></line>
<rect x="30" y="148" width="210" height="62" rx="6" fill="var(--sv-bg)" stroke="var(--sv-b)"></rect>
<text x="135" y="171" font-size="13" text-anchor="middle" fill="var(--sv-ink)">t.join()</text>
<text x="135" y="191" font-size="12" text-anchor="middle" fill="var(--sv-muted)">阻塞等待，回收资源，joinable=false</text>
<rect x="275" y="148" width="210" height="62" rx="6" fill="var(--sv-bg)" stroke="var(--sv-b)"></rect>
<text x="380" y="171" font-size="13" text-anchor="middle" fill="var(--sv-ink)">t.detach()</text>
<text x="380" y="191" font-size="12" text-anchor="middle" fill="var(--sv-muted)">脱钩后台运行，不能再 join</text>
<rect x="520" y="148" width="210" height="62" rx="6" fill="var(--sv-bg)" stroke="var(--sv-c)"></rect>
<text x="625" y="171" font-size="13" text-anchor="middle" fill="var(--sv-ink)">析构时仍 joinable</text>
<text x="625" y="191" font-size="12" text-anchor="middle" fill="var(--sv-muted)">调用 std::terminate</text>
<rect x="30" y="236" width="700" height="118" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="44" y="260" font-size="13" fill="var(--sv-ink)">std::jthread（C++20）：析构 = request_stop() + join()</text>
<rect x="50" y="274" width="195" height="56" rx="6" fill="var(--sv-a)"></rect>
<text x="147" y="296" font-size="12" text-anchor="middle" fill="var(--sv-bg)">~jthread() 发出停止请求</text>
<text x="147" y="315" font-size="12" text-anchor="middle" fill="var(--sv-bg)">request_stop()</text>
<line x1="247" y1="302" x2="280" y2="302" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#concurrency-basics-m1)"></line>
<rect x="282" y="274" width="195" height="56" rx="6" fill="var(--sv-b)"></rect>
<text x="379" y="296" font-size="12" text-anchor="middle" fill="var(--sv-bg)">线程检查 stop_token</text>
<text x="379" y="315" font-size="12" text-anchor="middle" fill="var(--sv-bg)">协作式退出</text>
<line x1="479" y1="302" x2="512" y2="302" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#concurrency-basics-m1)"></line>
<rect x="514" y="274" width="195" height="56" rx="6" fill="var(--sv-a2)"></rect>
<text x="611" y="296" font-size="12" text-anchor="middle" fill="var(--sv-ink)">join() 回收线程</text>
<text x="611" y="315" font-size="12" text-anchor="middle" fill="var(--sv-muted)">不再触发 terminate</text>
<text x="44" y="348" font-size="12" fill="var(--sv-muted)">停止是协作式的：不检查 stop_token 的线程不会被强制终止。</text>
</svg>
<figcaption>图 1 · 线程对象的两条收尾路径与 jthread 的自动收尾。std::thread 析构不做 join，只检查并终止；std::jthread 把请求停止与等待结束合并进析构，错误从崩溃降级为协作式退出。</figcaption>
</figure>
<p><code>std::jthread</code>（C++20）析构时先 <code>request_stop()</code>，再 <code>join()</code>。如果线程函数第一个参数是 <code>std::stop_token</code>，jthread 会自动传入；线程通过轮询 <code>stop_requested()</code> 或注册 <code>std::stop_callback</code> 来响应。它把「忘记 join」从 terminate 变成有序的停止请求，但仍要求线程配合检查——C++ 没有安全的强制终止机制，强行杀死线程会跳过析构、留下锁和半更新的状态。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;stop_token&gt;
#include &lt;thread&gt;

void worker(int id) { /* ... */ }

int main() {
    std::thread t(worker, 1);   // 创建即启动
    t.join();                   // 必须收尾

    std::jthread jt([](std::stop_token st, int id) {
        while (!st.stop_requested()) {
            // 每次循环做一小块可中断的工作
        }
    }, 2);                      // 析构时自动 request_stop + join
}</code></pre>
<div class="callout callout--warn"><span class="callout__label">当心</span><div>detach 只适合生命周期与进程相同的后台线程。detach 后线程仍可能访问你传入的引用、this 指针或全局状态，而这些对象的销毁时机不再受你控制。detach 加悬垂引用是「偶尔崩溃、无法复现」这类多线程问题最常见的来源之一。</div></div>
</section>

<section class="sec">
<h2>互斥量与三种锁守卫</h2>
<p><mark>互斥量</mark>（mutex，mutual exclusion）提供的契约只有两条：同一时刻至多一个线程持有它；<code>lock()</code> 与 <code>unlock()</code> 必须成对。被保护的代码区间叫<mark>临界区</mark>（critical section）。所有对共享可变状态的访问都必须落在同一把锁的临界区内，读也一样——只读不加锁、写加锁，仍然是数据竞争。</p>
<p>裸调用 <code>lock()/unlock()</code> 几乎总是错的，因为异常和提前返回都会绕过 unlock。C++ 用 RAII 把锁变成一个栈对象：构造时加锁，析构时解锁。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>类型</th><th>标准</th><th>语义</th><th>典型用途</th><th>注意</th></tr></thead>
<tbody>
<tr><td>std::mutex</td><td>C++11</td><td>独占，不可重入</td><td>绝大多数临界区</td><td>同线程重复 lock 是未定义行为（典型为自死锁）</td></tr>
<tr><td>std::recursive_mutex</td><td>C++11</td><td>同一线程可重复加锁</td><td>递归加锁的旧接口</td><td>次数必须匹配；多数场景是接口设计问题</td></tr>
<tr><td>std::timed_mutex</td><td>C++11</td><td>支持超时的独占锁</td><td>try_lock_for / try_lock_until 避免无限等待</td><td>超时返回 false，需自行回退</td></tr>
<tr><td>std::shared_mutex</td><td>C++17</td><td>读写锁：多读者或单写者</td><td>读多写少、读临界区较长</td><td>写者可能饥饿；是否读者优先由实现决定</td></tr>
<tr><td>std::shared_timed_mutex</td><td>C++14</td><td>带超时的读写锁</td><td>带超时的读写</td><td>接口更重，无超时需求用 shared_mutex</td></tr>
</tbody>
</table></div>
<p>三种锁守卫的分工是：<code>std::lock_guard</code>（C++11）最轻，进作用域加锁、出作用域解锁，不能手动解锁、不可移动，只锁一把且不需提前释放时首选；<code>std::unique_lock</code>（C++11）可移动、可延迟加锁（<code>std::defer_lock</code>）、可中途 <code>unlock()/lock()</code>，也是 <code>std::condition_variable</code> 唯一接受的锁类型；<code>std::scoped_lock</code>（C++17）一次锁住多个互斥量，内部使用死锁避免算法，同时持有两把以上锁时默认选它。</p>
<p><code>std::scoped_lock</code> 的构造函数按 <code>std::lock</code> 的算法获取全部锁（逐个尝试加锁，失败则释放已取得的锁后重试；标准只规定「不死锁」这一效果，实现可以换成别的避免算法），破坏的是死锁四条件中的「持有并等待」。相对地，两个线程各自先锁一把再锁另一把，哪怕都用 lock_guard，也可能死锁。C++17 起这些类型支持类模板实参推导（CTAD），可以写 <code>std::lock_guard lk(m);</code>。</p>
<div class="formula">临界区不变量：
① 共享可变状态 S 的所有读写都在同一互斥量 M 的临界区内
② 锁的持有时间 = 必需的最短时间；临界区内不做 IO、不调用未知回调
③ 多把锁：scoped_lock 一次获取，或全局唯一加锁顺序
④ 条件等待：wait(lock, pred)，谓词在持锁状态下求值</div>
<pre class="code" data-lang="cpp"><code>// 示意：锁守卫用法
#include &lt;mutex&gt;

std::mutex m;
int counter = 0;

void add() {
    std::lock_guard&lt;std::mutex&gt; lk(m);
    ++counter;                  // 临界区
}                               // 析构自动 unlock

std::mutex a, b;

void both() {
    std::scoped_lock lk(a, b);  // C++17：一次获取，避免顺序不一致
    // 同时持有 a 与 b
}</code></pre>
<p><code>recursive_mutex</code> 值得单独提醒。它让「持锁函数调用另一个也会加锁的函数」不再自死锁，但问题通常不在锁，而在接口：公开接口负责加锁，内部实现假设锁已持有。把两层拆开（例如 <code>push</code> 加锁后调用 <code>push_unlocked</code>），就不需要可重入锁。它还会掩盖持锁调用外部代码的事实。</p>
</section>

<section class="sec">
<h2>条件变量：等待、谓词与伪唤醒</h2>
<p>互斥量只保证互斥，不能表达「等到有数据再继续」。轮询（循环加锁检查、解锁、sleep）既浪费 CPU，又在数据到达和检查之间留下延迟窗口。<mark>条件变量</mark>（condition variable）补上这块：谓词为假时原子地释放锁并睡眠，被通知后重新加锁并再次检查。</p>
<p>「原子地」是关键。<code>wait(lock)</code> 的语义是：释放 lock 并阻塞，被唤醒时重新获得 lock 再返回。释放锁与进入等待之间没有窗口，所以通知不会丢在缝隙里。但标准明确允许<mark>伪唤醒</mark>（spurious wakeup）：wait 可能在没有任何 notify 的情况下返回。因此裸 <code>wait(lock)</code> 永远不够，必须写成 <code>wait(lock, pred)</code>；它等价于 <code>while (!pred()) wait(lock);</code>。</p>
<p>谓词必须在持锁状态下求值，修改状态的一方也必须在同一把锁下修改。否则会出现<mark>丢失唤醒</mark>（lost wakeup）：消费者检查到队列为空，还没来得及进入等待，生产者已经 push 并 notify 完毕；消费者随后睡下去，再也等不到第二次通知。把「检查条件」和「进入等待」放在同一把锁的保护下，就消除了这个窗口。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>调用</th><th>语义</th><th>适用</th></tr></thead>
<tbody>
<tr><td>cv.wait(lock)</td><td>释放锁并等待一次唤醒</td><td>不推荐，伪唤醒会直接返回</td></tr>
<tr><td>cv.wait(lock, pred)</td><td>循环等待直到 pred 为真</td><td>默认写法，所有等待都应使用</td></tr>
<tr><td>cv.wait_for(lock, d, pred)</td><td>带超时的循环等待</td><td>需周期性检查或降级</td></tr>
<tr><td>cv.notify_one()</td><td>唤醒一个等待者</td><td>每次只产生一个可消费项时</td></tr>
<tr><td>cv.notify_all()</td><td>唤醒全部等待者</td><td>状态切换、关闭、广播事件</td></tr>
</tbody>
</table></div>
<p><code>notify_one</code> 唤醒一个等待者，<code>notify_all</code> 唤醒全部。通知本身不需要持锁：持锁通知语义正确，但被唤醒的线程会立刻尝试加锁而再次阻塞（hurry up and wait），通常的做法是在锁内修改状态、离开临界区后再 notify。前提是谓词检查在锁内，notify 在锁外不影响正确性。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="生产者消费者在互斥量与条件变量上的时序" font-family="inherit">
<defs>
<marker id="concurrency-basics-m2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-ink)"></path>
</marker>
</defs>
<rect x="40" y="24" width="160" height="40" rx="6" fill="var(--sv-a)"></rect>
<text x="120" y="49" font-size="14" text-anchor="middle" fill="var(--sv-bg)">生产者线程</text>
<rect x="300" y="24" width="160" height="40" rx="6" fill="var(--sv-b)"></rect>
<text x="380" y="49" font-size="14" text-anchor="middle" fill="var(--sv-bg)">队列 + 互斥量 m</text>
<rect x="560" y="24" width="160" height="40" rx="6" fill="var(--sv-a2)"></rect>
<text x="640" y="49" font-size="14" text-anchor="middle" fill="var(--sv-ink)">消费者线程</text>
<line x1="120" y1="66" x2="120" y2="350" stroke="var(--sv-line)" stroke-width="1.5" stroke-dasharray="6 5"></line>
<line x1="380" y1="66" x2="380" y2="350" stroke="var(--sv-line)" stroke-width="1.5" stroke-dasharray="6 5"></line>
<line x1="640" y1="66" x2="640" y2="350" stroke="var(--sv-line)" stroke-width="1.5" stroke-dasharray="6 5"></line>
<line x1="122" y1="88" x2="376" y2="88" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#concurrency-basics-m2)"></line>
<text x="128" y="82" font-size="12" fill="var(--sv-ink)">lock(m); push(1)</text>
<line x1="122" y1="118" x2="376" y2="118" stroke="var(--sv-a)" stroke-width="1.5" marker-end="url(#concurrency-basics-m2)"></line>
<text x="128" y="112" font-size="12" fill="var(--sv-a)">unlock; notify_one</text>
<line x1="378" y1="148" x2="636" y2="148" stroke="var(--sv-b)" stroke-width="1.5" marker-end="url(#concurrency-basics-m2)"></line>
<text x="388" y="142" font-size="12" fill="var(--sv-b)">wait 返回：重新加锁，谓词为真</text>
<line x1="638" y1="178" x2="384" y2="178" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#concurrency-basics-m2)"></line>
<text x="400" y="172" font-size="12" fill="var(--sv-ink)">pop() 取走 1</text>
<line x1="638" y1="208" x2="384" y2="208" stroke="var(--sv-a)" stroke-width="1.5" marker-end="url(#concurrency-basics-m2)"></line>
<text x="400" y="202" font-size="12" fill="var(--sv-a)">unlock; notify_one(not_full)</text>
<line x1="122" y1="238" x2="376" y2="238" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#concurrency-basics-m2)"></line>
<text x="128" y="232" font-size="12" fill="var(--sv-ink)">继续 push，直到队列满</text>
<rect x="40" y="256" width="160" height="46" rx="6" fill="var(--sv-bg)" stroke="var(--sv-c)"></rect>
<text x="120" y="275" font-size="12" text-anchor="middle" fill="var(--sv-ink)">wait(not_full, pred)</text>
<text x="120" y="292" font-size="12" text-anchor="middle" fill="var(--sv-muted)">原子释放锁并睡眠</text>
<line x1="638" y1="322" x2="384" y2="322" stroke="var(--sv-a)" stroke-width="1.5" marker-end="url(#concurrency-basics-m2)"></line>
<text x="400" y="316" font-size="12" fill="var(--sv-a)">消费者 pop 后 notify(not_full)</text>
<text x="40" y="368" font-size="12" fill="var(--sv-muted)">谓词在持锁状态下检查：伪唤醒会重新求值，通知不会丢失。</text>
</svg>
<figcaption>图 2 · 生产者与消费者通过互斥量和两个条件变量协作。等待前检查谓词，唤醒后在同一把锁下复查；notify 放在解锁后，避免被唤醒者立刻撞锁。</figcaption>
</figure>
<p><code>std::condition_variable</code> 只能配合 <code>std::unique_lock&lt;std::mutex&gt;</code>；<code>std::condition_variable_any</code> 可配合任意 BasicLockable 锁，代价是多一层间接。C++20 给 <code>condition_variable_any</code> 增加了接受 <code>std::stop_token</code> 的 wait 重载，可以在收到停止请求时中断等待——这正是实现可取消线程池时需要的工具。</p>
</section>

<section class="sec">
<h2>生产者-消费者：一个完整可编译的例子</h2>
<p>下面是一个有界阻塞队列，容量固定，支持关闭。它是生产者-消费者的最小完整骨架，可直接编译（需要 C++20 的 <code>std::jthread</code> 与 <code>&lt;stop_token&gt;</code>：libstdc++ 自 GCC 10 起提供，MSVC 与 libc++ 的补齐随版本推进，旧工具链请先查编译器支持表）。</p>
<pre class="code" data-lang="cpp"><code>#include &lt;condition_variable&gt;
#include &lt;cstddef&gt;
#include &lt;deque&gt;
#include &lt;iostream&gt;
#include &lt;mutex&gt;
#include &lt;optional&gt;
#include &lt;stop_token&gt;
#include &lt;thread&gt;
#include &lt;utility&gt;
#include &lt;vector&gt;

template &lt;class T&gt;
class BlockingQueue {
public:
    explicit BlockingQueue(std::size_t cap) : cap_(cap) {}

    bool push(T value) {
        std::unique_lock&lt;std::mutex&gt; lk(m_);
        not_full_.wait(lk, [this] { return closed_ || q_.size() &lt; cap_; });
        if (closed_) return false;
        q_.push_back(std::move(value));
        lk.unlock();                // 先放锁，再通知
        not_empty_.notify_one();
        return true;
    }

    std::optional&lt;T&gt; pop() {
        std::unique_lock&lt;std::mutex&gt; lk(m_);
        not_empty_.wait(lk, [this] { return closed_ || !q_.empty(); });
        if (q_.empty()) return std::nullopt;   // 已关闭且已排空
        T v = std::move(q_.front());
        q_.pop_front();
        lk.unlock();                // 先放锁，再通知
        not_full_.notify_one();
        return v;
    }

    void close() {
        {
            std::lock_guard&lt;std::mutex&gt; lk(m_);
            closed_ = true;
        }
        not_empty_.notify_all();
        not_full_.notify_all();
    }

private:
    std::size_t cap_;
    std::deque&lt;T&gt; q_;
    std::mutex m_;
    std::condition_variable not_empty_, not_full_;
    bool closed_ = false;
};

int main() {
    BlockingQueue&lt;int&gt; q(4);

    std::vector&lt;std::jthread&gt; workers;
    for (int w = 0; w &lt; 2; ++w) {
        workers.emplace_back([&amp;q, w](std::stop_token st) {
            while (!st.stop_requested()) {
                auto v = q.pop();
                if (!v) break;                 // 队列已关闭
                std::cout &lt;&lt; "worker " &lt;&lt; w &lt;&lt; ": " &lt;&lt; *v &lt;&lt; '\n';
            }
        });
    }

    for (int i = 0; i &lt; 8; ++i) q.push(i);
    q.close();                                 // 先关闭，再让 jthread 析构
}</code></pre>
<p>几个设计点值得展开。第一，用了两个条件变量：<code>not_empty_</code> 给消费者、<code>not_full_</code> 给生产者。如果只用一个，<code>notify_one</code> 可能唤醒「错误的一侧」，被唤醒的线程发现条件不成立又睡回去，真正的等待者却收不到通知，形成空转。第二，<code>close()</code> 在锁内改标志、在锁外 notify_all，<code>push()</code>/<code>pop()</code> 也都在 <code>unlock()</code> 之后才通知，避免被唤醒者立刻撞锁；这样等待者要么在锁内看到 closed，要么一定能被这次广播唤醒。第三，<code>pop()</code> 在「已关闭且队列为空」时返回 nullopt，区分「暂时没数据」和「不会再有数据」；关闭后仍会把剩余元素排空，这是有意的优雅停机。</p>
<p>关于退出：示例里 worker 同时检查 <code>stop_requested()</code> 和队列关闭。它只在循环开头检查；线程若阻塞在 <code>pop()</code> 里，停止请求不会叫醒它，所以 main 先 <code>close()</code>，再由 jthread 析构请求停止并 join。更稳妥的写法是用 <code>condition_variable_any</code> 的 stop_token 重载，让等待本身可中断；或把「关闭队列」封装进守卫对象，保证任何退出路径都执行。</p>
<p>另外，<code>std::cout</code> 等已同步标准流对象的并发访问在 C++11 起不构成数据竞争（前提是没有调用 <code>sync_with_stdio(false)</code>；关闭同步后是否安全由实现决定），但多线程输出仍可能字符交错；生产代码应使用自己的日志设施。这个例子为了短小没有处理。还有一点：<code>push</code> 在关闭后返回 false，调用方必须检查，否则会以为任务已经入队而丢失工作。</p>
</section>

<section class="sec">
<h2>死锁：四个条件与拆解方法</h2>
<p><mark>死锁</mark>（deadlock）指一组线程各自持有对方需要的资源并永久等待。它不崩溃、不报错，只表现为程序卡住、CPU 占用通常很低（各线程都阻塞在锁上时接近零），是最难排查的并发故障。Coffman、Elphick 与 Shoshani 在 1971 年把死锁的必要条件归纳为四条，四条同时成立才可能死锁。</p>
<ol>
<li><b>互斥</b>（mutual exclusion）：资源同一时刻只能被一个线程持有。</li>
<li><b>持有并等待</b>（hold and wait）：线程持有至少一个资源，同时等待其他被占用的资源。</li>
<li><b>不可抢占</b>（no preemption）：资源只能由持有者主动释放，不能被强制夺走。</li>
<li><b>循环等待</b>（circular wait）：存在一个线程环，每个线程都在等待环中下一个线程持有的资源。</li>
</ol>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="死锁的四个必要条件与对应的破坏手段" font-family="inherit">
<defs>
<marker id="concurrency-basics-m3" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-ink)"></path>
</marker>
</defs>
<text x="30" y="24" font-size="14" fill="var(--sv-ink)">四个条件同时成立才可能死锁；破坏任意一个即可避免</text>
<rect x="285" y="42" width="190" height="58" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
<text x="380" y="66" font-size="14" text-anchor="middle" fill="var(--sv-ink)">① 互斥</text>
<text x="380" y="86" font-size="12" text-anchor="middle" fill="var(--sv-muted)">资源不能共享使用</text>
<rect x="556" y="158" width="180" height="58" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
<text x="646" y="182" font-size="14" text-anchor="middle" fill="var(--sv-ink)">② 持有并等待</text>
<text x="646" y="202" font-size="12" text-anchor="middle" fill="var(--sv-muted)">拿着 A 再等 B</text>
<rect x="285" y="282" width="190" height="58" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
<text x="380" y="306" font-size="14" text-anchor="middle" fill="var(--sv-ink)">③ 不可抢占</text>
<text x="380" y="326" font-size="12" text-anchor="middle" fill="var(--sv-muted)">锁不能被强行夺走</text>
<rect x="24" y="158" width="180" height="58" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
<text x="114" y="182" font-size="14" text-anchor="middle" fill="var(--sv-ink)">④ 循环等待</text>
<text x="114" y="202" font-size="12" text-anchor="middle" fill="var(--sv-muted)">T1 等 T2，T2 等 T1</text>
<path d="M 462 92 Q 540 100 570 152" fill="none" stroke="var(--sv-ink)" stroke-width="2" marker-end="url(#concurrency-basics-m3)"></path>
<path d="M 646 222 Q 620 278 500 300" fill="none" stroke="var(--sv-ink)" stroke-width="2" marker-end="url(#concurrency-basics-m3)"></path>
<path d="M 278 322 Q 220 300 200 222" fill="none" stroke="var(--sv-ink)" stroke-width="2" marker-end="url(#concurrency-basics-m3)"></path>
<path d="M 122 152 Q 160 100 278 82" fill="none" stroke="var(--sv-ink)" stroke-width="2" marker-end="url(#concurrency-basics-m3)"></path>
<text x="380" y="176" font-size="13" text-anchor="middle" fill="var(--sv-c)">四条同时成立</text>
<text x="380" y="198" font-size="13" text-anchor="middle" fill="var(--sv-c)">⇒ 可能死锁</text>
<text x="285" y="118" font-size="12" fill="var(--sv-a)">破坏：只读共享或原子操作</text>
<text x="510" y="250" font-size="12" fill="var(--sv-b)">破坏：一次取全部锁</text>
<text x="285" y="272" font-size="12" fill="var(--sv-a)">破坏：try_lock 超时退避</text>
<text x="24" y="140" font-size="12" fill="var(--sv-b)">破坏：固定加锁顺序</text>
<text x="30" y="368" font-size="12" fill="var(--sv-muted)">示例：T1 持 A 等 B，T2 持 B 等 A —— 两条边方向相反，构成循环。</text>
</svg>
<figcaption>图 3 · 死锁的四个必要条件与破坏手段。工程上通常从「循环等待」入手：给互斥量编号，只允许按编号递增顺序加锁，环就不可能形成。</figcaption>
</figure>
<p>工程上的做法是主动破坏其中至少一条。互斥通常无法消除（临界区本身就是需求），真正可动手的是后三条：一次性获取全部锁（<code>std::scoped_lock</code> / <code>std::lock</code>，破坏持有并等待）；用 <code>try_lock_for</code> 超时退避，拿不到就放弃已持有的锁再重试（破坏不可抢占，同时避免无限期的持有并等待）；给所有互斥量规定全局唯一加锁顺序（破坏循环等待）。</p>
<pre class="code" data-lang="cpp"><code>// 示意：加锁顺序相反
#include &lt;mutex&gt;

std::mutex ma, mb;

// 危险：两个函数加锁顺序相反
void f1() { std::lock_guard&lt;std::mutex&gt; x(ma), y(mb); /* ... */ }
void f2() { std::lock_guard&lt;std::mutex&gt; x(mb), y(ma); /* ... */ }

// 安全：一次获取，内部使用死锁避免算法
void g() { std::scoped_lock lk(ma, mb); /* ... */ }</code></pre>
<p>还有一个隐蔽的来源：在持锁期间调用你无法控制的代码。回调、虚函数、日志 sink 都可能去拿另一把锁，在调用图上制造出你未曾画出的环。规则是：临界区内只做数据操作，把回调、IO、可能阻塞的等待移到锁外；必须调用时，先明确它可能获取哪些锁，并纳入全局顺序。</p>
<p>死锁之外还有两个近亲：<mark>活锁</mark>（livelock，线程都在运行但不断重试、无法推进）与<mark>饥饿</mark>（starvation，某线程长期拿不到锁，例如读者不断导致写者饿死）。<code>shared_mutex</code> 的公平性取决于实现，标准不保证写者优先，延迟敏感场景要实测。排查时在调试器里查看每个线程持有的锁与等待的锁，画出等待图找环即可；这也是锁应该有名字、有层级的原因。</p>
</section>

<section class="sec">
<h2>线程池与伪共享预告</h2>
<p>每来一个任务就 <code>std::thread</code> 一个线程，在任务短、频率高时成本很高：线程创建与销毁涉及内核调度实体、栈分配（默认栈大小因平台而异，典型从数百 KB 到 8 MB）和调度器登记。线程数超过硬件并发度则造成<mark>过度订阅</mark>（oversubscription），上下文切换和缓存抖动吃掉收益。<mark>线程池</mark>（thread pool）的思路是固定数量的工作线程加一个任务队列：提交者只负责入队，工作线程循环取任务执行。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="线程池的结构：提交线程、受互斥量保护的任务队列与固定数量的工作线程" font-family="inherit">
<defs>
<marker id="concurrency-basics-m4" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-ink)"></path>
</marker>
</defs>
<text x="30" y="26" font-size="14" fill="var(--sv-ink)">线程池：固定工作线程从共享队列取任务，避免每个任务创建一个线程</text>
<rect x="24" y="58" width="140" height="72" rx="6" fill="var(--sv-a)"></rect>
<text x="94" y="84" font-size="13" text-anchor="middle" fill="var(--sv-bg)">提交线程</text>
<text x="94" y="104" font-size="12" text-anchor="middle" fill="var(--sv-bg)">submit(job)</text>
<text x="94" y="121" font-size="12" text-anchor="middle" fill="var(--sv-bg)">只负责入队</text>
<line x1="166" y1="94" x2="204" y2="94" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#concurrency-basics-m4)"></line>
<rect x="206" y="50" width="240" height="88" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="326" y="74" font-size="13" text-anchor="middle" fill="var(--sv-ink)">任务队列</text>
<text x="326" y="96" font-size="12" text-anchor="middle" fill="var(--sv-muted)">deque&lt;function&lt;void()&gt;&gt;</text>
<text x="326" y="116" font-size="12" text-anchor="middle" fill="var(--sv-muted)">由 mutex 保护，cv 通知</text>
<line x1="448" y1="76" x2="520" y2="76" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#concurrency-basics-m4)"></line>
<line x1="448" y1="106" x2="520" y2="128" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#concurrency-basics-m4)"></line>
<line x1="448" y1="128" x2="520" y2="200" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#concurrency-basics-m4)"></line>
<rect x="522" y="48" width="204" height="56" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
<text x="624" y="72" font-size="13" text-anchor="middle" fill="var(--sv-ink)">worker 0</text>
<text x="624" y="92" font-size="12" text-anchor="middle" fill="var(--sv-muted)">wait → pop → run</text>
<rect x="522" y="112" width="204" height="56" rx="6" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
<text x="624" y="136" font-size="13" text-anchor="middle" fill="var(--sv-ink)">worker 1</text>
<text x="624" y="156" font-size="12" text-anchor="middle" fill="var(--sv-muted)">wait → pop → run</text>
<rect x="522" y="176" width="204" height="56" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
<text x="624" y="200" font-size="13" text-anchor="middle" fill="var(--sv-ink)">worker N-1</text>
<text x="624" y="220" font-size="12" text-anchor="middle" fill="var(--sv-muted)">循环直到 stop_ 置位</text>
<rect x="24" y="256" width="320" height="86" rx="6" fill="var(--sv-bg)" stroke="var(--sv-b)"></rect>
<text x="40" y="280" font-size="13" fill="var(--sv-ink)">关闭顺序：</text>
<text x="40" y="302" font-size="12" fill="var(--sv-muted)">stop_ = true → cv.notify_all()</text>
<text x="40" y="322" font-size="12" fill="var(--sv-muted)">→ 排空或退出 → 逐个 join()</text>
<rect x="522" y="256" width="204" height="86" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="624" y="280" font-size="13" text-anchor="middle" fill="var(--sv-ink)">返回值通道</text>
<text x="624" y="302" font-size="12" text-anchor="middle" fill="var(--sv-muted)">packaged_task / promise</text>
<text x="624" y="322" font-size="12" text-anchor="middle" fill="var(--sv-muted)">提交方持有 future</text>
<text x="30" y="368" font-size="12" fill="var(--sv-muted)">线程数不是越多越好：通常以 hardware_concurrency() 为起点，再按阻塞比例实测调整。</text>
</svg>
<figcaption>图 4 · 线程池的结构。任务队列与条件变量和生产者-消费者同构；区别是消费者数量固定，关闭需要置标志、广播、join 三步。</figcaption>
</figure>
<p>池的核心结构与生产者-消费者同构：任务队列由互斥量保护，工作线程不忙时等待条件变量；关闭时置停止标志并 <code>notify_all</code>，再逐个 join。任务通常表示为 <code>std::function&lt;void()&gt;</code>，需要返回值时用 <code>std::packaged_task</code> 包装并取出 <code>std::future</code>。任务粒度太细，队列竞争和通知开销会超过任务本身；太粗，负载又不均衡。线程数一般取 <code>std::thread::hardware_concurrency()</code> 作为起点，但它只是提示（可能返回 0），需结合阻塞比例实测调整。</p>
<pre class="code" data-lang="cpp"><code>// 示意：线程池骨架，省略了析构函数与错误处理
#include &lt;condition_variable&gt;
#include &lt;functional&gt;
#include &lt;mutex&gt;
#include &lt;queue&gt;
#include &lt;thread&gt;
#include &lt;utility&gt;
#include &lt;vector&gt;

class ThreadPool {
public:
    explicit ThreadPool(unsigned n) {
        for (unsigned i = 0; i &lt; n; ++i)
            workers_.emplace_back([this] { loop(); });
    }
    void submit(std::function&lt;void()&gt; job) {
        {
            std::lock_guard&lt;std::mutex&gt; lk(m_);
            jobs_.push(std::move(job));
        }
        cv_.notify_one();
    }
private:
    void loop() {
        for (;;) {
            std::function&lt;void()&gt; job;
            {
                std::unique_lock&lt;std::mutex&gt; lk(m_);
                cv_.wait(lk, [this] { return stop_ || !jobs_.empty(); });
                if (stop_ &amp;&amp; jobs_.empty()) return;
                job = std::move(jobs_.front());
                jobs_.pop();
            }
            job();                  // 在锁外执行，避免阻塞其他 worker
        }
    }
    std::vector&lt;std::thread&gt; workers_;
    std::queue&lt;std::function&lt;void()&gt;&gt; jobs_;
    std::mutex m_;
    std::condition_variable cv_;
    bool stop_ = false;
};</code></pre>
<p>这段骨架省略了析构函数，照抄会在 ThreadPool 销毁时触发 <code>std::terminate</code>：持有 joinable 的 std::thread 且没有 join。正确写法是：析构时先<b>持锁</b>把 <code>stop_</code> 置为 true，解锁后再 <code>cv_.notify_all()</code>，最后逐个 join。<code>stop_</code> 在工作线程里是持锁读的，析构时不加锁写就自己构成数据竞争；而如果一直持锁到 join，工作线程会卡在重新加锁上，同样死锁。本例的退出条件已包含「队列为空」，所以析构会把积压任务执行完；若不希望排空，把退出条件改成只看 <code>stop_</code> 即可。任务在锁外执行，否则一个长任务会让其他 worker 取不到任务。</p>
<p><mark>伪共享</mark>（false sharing）提前说一句：CPU 缓存以<mark>缓存行</mark>（cache line，x86-64 上典型 64 字节，具体取决于实现）为单位同步。两个线程写逻辑上无关的变量，若落在同一缓存行，缓存一致性协议会让这一行在两个核之间来回失效，性能可能比单线程还差。对策是用 <code>alignas</code> 分开热点变量；C++17 的 <code>std::hardware_destructive_interference_size</code>（声明在 <code>&lt;new&gt;</code>）值由实现定义，不能当跨平台常数。这个问题与原子操作、内存序一起，在 atomics-memory-order 与 performance 两篇展开。</p>
</section>

<section class="sec">
<h2>常见误区、自测与延伸阅读</h2>
<h3>五个反复出现的误区</h3>
<ul>
<li><b>用互斥量保证执行顺序。</b> mutex 只保证互斥，不保证谁先谁后。需要顺序时用条件变量、原子标志或 future。</li>
<li><b>把 recursive_mutex 当安全版 mutex。</b> 它掩盖「持锁调用外部代码」的设计问题；拆成加锁外壳与不加锁内核，通常不需要重入。</li>
<li><b>detach 后访问局部变量。</b> 线程可能在线程函数返回、局部对象销毁之后才运行，引用悬垂即未定义行为。</li>
<li><b>条件变量不用谓词。</b> 伪唤醒和丢失唤醒都会让你偶发卡死；<code>wait(lock, pred)</code> 是唯一推荐形式。</li>
<li><b>用 volatile 替代原子操作。</b> volatile 不提供原子性，也不建立线程间顺序；正确工具是 std::atomic，细节见 atomics-memory-order。</li>
</ul>
<h3>自测</h3>
<details class="quiz"><summary>Q1 · std::thread 对象析构时仍然 joinable 会发生什么？std::jthread 有什么不同？</summary><div class="quiz__a">std::thread 的析构函数会检查 joinable()，为 true 时调用 std::terminate，程序直接终止。std::jthread（C++20）析构时先 request_stop() 发出协作式停止请求，再 join() 等待线程结束。注意停止是协作式的：线程必须检查 stop_token 才会及时退出，否则 join 仍会一直等。</div></details>
<details class="quiz"><summary>Q2 · 为什么条件变量必须写成 wait(lock, pred)，谓词为什么要在持锁状态下求值？</summary><div class="quiz__a">标准允许伪唤醒，裸 wait 可能在无通知时返回。wait(lock, pred) 等价于 while (!pred()) wait(lock)，同时处理伪唤醒与「被唤醒但条件不成立」。谓词必须在持锁状态下求值：修改状态的线程也在同一把锁下修改，二者被串行化；否则检查与等待之间会出现窗口，notify 落进去就造成丢失唤醒。</div></details>
<details class="quiz"><summary>Q3 · 两个线程分别以 A→B 和 B→A 的顺序加锁会死锁。std::scoped_lock 如何避免？它破坏了哪个必要条件？</summary><div class="quiz__a">std::scoped_lock 一次接收多个互斥量，内部使用与 std::lock 相同的死锁避免算法：逐个尝试加锁，某个 try_lock 失败就释放已取得的锁再重试。因此线程不会「持有一把、阻塞等待另一把」，破坏的是「持有并等待」。它不改变加锁顺序，也不解决持锁调用外部代码造成的环，那类问题仍需固定全局顺序或把调用移到锁外。</div></details>
<h3>延伸阅读</h3>
<ul class="refs">
<li><b>cppreference: Concurrency support library</b> — cppreference.com。线程、互斥量、条件变量、future 的接口总览，查签名与标准版本最直接。</li>
<li><b>《C++ Concurrency in Action》（第 2 版）</b> — Anthony Williams, Manning, 2019。第 3、4、9 章分别讲共享数据、条件变量与线程池，与本篇对应。</li>
<li><b>C++ Core Guidelines, CP.1–CP.30</b> — Bjarne Stroustrup、Herb Sutter。并发与并行规则组，涵盖明确目标、避免数据竞争、优先标准库原语等条目。</li>
<li><b>ISO/IEC 14882:2020（C++20）[thread]、[thread.mutex]、[thread.condition]</b> — ISO/IEC。线程析构、互斥量与条件变量的规范条文，用于核对边界表述。</li>
<li><b>cppreference: std::jthread 与 std::stop_token</b> — cppreference.com。C++20 协作式取消的接口与语义，包括 stop_token 如何传入线程函数。</li>
</ul>
</section>`
};
