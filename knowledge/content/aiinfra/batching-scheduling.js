window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["batching-scheduling"] = {
  slug: "batching-scheduling",
  title: "批处理与调度：Continuous Batching 与 PagedAttention",
  subtitle: "把 GPU 喂满的艺术",
  level: 4,
  cluster: "推理",
  tags: ["Continuous Batching", "PagedAttention", "调度"],
  summary: "静态批处理被 padding 与整批屏障拖累；连续批处理逐迭代调度，PagedAttention 分页治理 KV 碎片，叠加前缀缓存提升吞吐。",
  keyPoints: [
    "静态 batch 的有效 token 占比为 ΣL/(B×L_max)，长度不齐时一半以上算力可能花在 padding 上。",
    "Orca 把调度粒度从请求降到迭代：每步淘汰完成者、准入新请求，batch 成员逐迭代变化。",
    "PagedAttention 用固定大小块加块表管理 KV，论文口径下把 KV 显存浪费从 60%–80% 压到 4% 以下，并支持共享与写时复制。",
    "chunked prefill 用预算 n+C ≤ T 把长 prefill 切片并与 decode 混批，压平 token 间延迟的长尾。"
  ],
  readingMinutes: 14,
  html: String.raw`
<section class="sec">
<h2>先给结论：推理吞吐是排班问题</h2>
<p>在 NVIDIA A100 80GB SXM（HBM2e 带宽 2.039 TB/s）上跑 Llama-2 7B，bf16 权重约 13.5 GB（12.6 GiB）。单请求 decode 每生成一个 token 都要把这 13.5 GB 读一遍，仅权重读取就约 6.6 ms（按峰值带宽估算），Tensor Core 大部分时间在等数据。把 32 条请求放进同一 batch，这次读取被 32 个 token 分摊，单 token 权重成本降到约 0.2 ms。批处理的价值就在这里：<mark>用并发摊薄固定的权重读取</mark>。</p>
<p>但凑批本身有两个代价。序列长度参差不齐，静态批处理必须把短序列 padding 到最长，填充位置照样参加矩阵乘；先结束的短请求又不能退出，必须等整批最长的那条跑完。前者浪费算力，后者浪费并发，合起来可把有效吞吐压掉一半以上。</p>
<p>这一篇讲两件事：调度器怎样在每次迭代重新决定 batch 组成，即 <mark>continuous batching</mark>；KV Cache 怎样分页管理以避免碎片，即 <mark>PagedAttention</mark>。前者解决“batch 有空位”，后者解决“KV 放不下、放得碎”。attention kernel 的 IO 优化见 flashattention，prefill 与 decode 的瓶颈分析见 three-bottlenecks。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>静态批处理像包场看电影：等一拨人凑齐，散场一起走，中途来人只能等下一场。连续批处理像流水席：谁吃完谁走，空位立刻给下一位，后厨（GPU）始终有活干。PagedAttention 像把大包间改成标准床位，按需分配、可以拼床，不再为每位客人预留整间房。</div></div>
</section>

<section class="sec">
<h2>静态批处理：padding 与队头阻塞</h2>
<p><mark>静态批处理</mark>（static batching）按固定窗口把请求凑成一批，统一 padding 到该批最长长度 L_max，然后整批一起 prefill、一起 decode，直到所有序列结束。实现简单、kernel 形状稳定，但有两个结构性缺陷。</p>
<h3>padding 浪费：算了一堆填充 token</h3>
<p>设批内有 B 条请求，长度为 L1 到 LB。有用 token 只有 ΣLi 个，GPU 却按 B×L_max 计算。举例：长度为 128、256、512、512、1024、1024、2048、2048 token 的 8 条请求，总和 7552，batch 形状 8×2048=16384，有效占比约 46%，超过一半 prefill 算力花在 pad 上。真实流量更偏斜，短 prompt 越多浪费越大。</p>
<div class="formula">有效 token 占比　U = Σᵢ Lᵢ / (B × L_max)
上例：U = 7552 / (8 × 2048) ≈ 46%，padding 比例 ≈ 54%</div>
<p>decode 阶段同样：被 padding 的序列每步仍要参与 attention 与 MLP。变长 kernel 能少算一些，但并行度终究由最长序列决定，短序列结束后槽位空着。</p>
<h3>队头阻塞：短请求陪长请求跑</h3>
<p>第二个问题是批次屏障（barrier）：一条输出 2000 token 的请求，会让同批所有槽位陪跑到最后。若最短序列只输出 100 token，后 1900 步就有大量槽位闲置。新请求还必须等整批结束才能进入，排队延迟随批次时长增长。图 1 上半部分把这一过程画成甘特图：彩色块是有效计算，虚线块是空转。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="静态批处理与连续批处理的甘特图对比">
<rect x="40" y="34" width="690" height="124" fill="var(--sv-panel)"></rect>
<text x="40" y="24" font-size="14" font-family="inherit" fill="var(--sv-ink)">静态批处理：整批对齐到最长序列，短序列槽位空转</text>
<rect x="470" y="8" width="12" height="12" fill="var(--sv-a)"></rect>
<text x="488" y="19" font-size="12" font-family="inherit" fill="var(--sv-muted)">运行中</text>
<rect x="560" y="8" width="12" height="12" fill="var(--sv-b)"></rect>
<text x="578" y="19" font-size="12" font-family="inherit" fill="var(--sv-muted)">新准入</text>
<rect x="650" y="8" width="12" height="12" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="3 3"></rect>
<text x="668" y="19" font-size="12" font-family="inherit" fill="var(--sv-muted)">空转</text>
<text x="52" y="66" font-size="12" font-family="inherit" fill="var(--sv-muted)">A</text>
<text x="52" y="88" font-size="12" font-family="inherit" fill="var(--sv-muted)">B</text>
<text x="52" y="110" font-size="12" font-family="inherit" fill="var(--sv-muted)">C</text>
<text x="52" y="132" font-size="12" font-family="inherit" fill="var(--sv-muted)">D</text>
<rect x="96" y="54" width="84" height="16" fill="var(--sv-a)"></rect>
<rect x="180" y="54" width="378" height="16" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="4 4"></rect>
<rect x="96" y="76" width="168" height="16" fill="var(--sv-a)"></rect>
<rect x="264" y="76" width="294" height="16" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="4 4"></rect>
<rect x="96" y="98" width="294" height="16" fill="var(--sv-a)"></rect>
<rect x="390" y="98" width="168" height="16" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="4 4"></rect>
<rect x="96" y="120" width="462" height="16" fill="var(--sv-a)"></rect>
<rect x="558" y="54" width="84" height="16" fill="var(--sv-b)"></rect>
<rect x="642" y="54" width="84" height="16" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="4 4"></rect>
<rect x="558" y="76" width="126" height="16" fill="var(--sv-b)"></rect>
<rect x="684" y="76" width="42" height="16" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="4 4"></rect>
<rect x="558" y="98" width="84" height="16" fill="var(--sv-b)"></rect>
<rect x="642" y="98" width="84" height="16" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="4 4"></rect>
<rect x="558" y="120" width="168" height="16" fill="var(--sv-b)"></rect>
<text x="300" y="66" font-size="12" font-family="inherit" fill="var(--sv-muted)">padding</text>
<text x="600" y="150" font-size="12" font-family="inherit" fill="var(--sv-muted)">第 2 批从 t=11 开始</text>
<rect x="40" y="196" width="690" height="124" fill="var(--sv-panel)"></rect>
<text x="40" y="186" font-size="14" font-family="inherit" fill="var(--sv-ink)">连续批处理：每步淘汰完成者并准入新请求，基本消除 padding</text>
<text x="52" y="228" font-size="12" font-family="inherit" fill="var(--sv-muted)">A</text>
<text x="52" y="250" font-size="12" font-family="inherit" fill="var(--sv-muted)">B</text>
<text x="52" y="272" font-size="12" font-family="inherit" fill="var(--sv-muted)">C</text>
<text x="52" y="294" font-size="12" font-family="inherit" fill="var(--sv-muted)">D</text>
<rect x="96" y="216" width="84" height="16" fill="var(--sv-a)"></rect>
<rect x="180" y="216" width="126" height="16" fill="var(--sv-b)"></rect>
<rect x="306" y="216" width="378" height="16" fill="var(--sv-a)"></rect>
<rect x="96" y="238" width="168" height="16" fill="var(--sv-a)"></rect>
<rect x="264" y="238" width="126" height="16" fill="var(--sv-b)"></rect>
<rect x="390" y="238" width="294" height="16" fill="var(--sv-a)"></rect>
<rect x="96" y="260" width="294" height="16" fill="var(--sv-a)"></rect>
<rect x="390" y="260" width="294" height="16" fill="var(--sv-b)"></rect>
<rect x="96" y="282" width="462" height="16" fill="var(--sv-a)"></rect>
<line x1="96" y1="340" x2="726" y2="340" stroke="var(--sv-ink)" stroke-width="1.2"></line>
<line x1="96" y1="336" x2="96" y2="344" stroke="var(--sv-ink)" stroke-width="1.2"></line>
<line x1="180" y1="336" x2="180" y2="344" stroke="var(--sv-ink)" stroke-width="1.2"></line>
<line x1="264" y1="336" x2="264" y2="344" stroke="var(--sv-ink)" stroke-width="1.2"></line>
<line x1="348" y1="336" x2="348" y2="344" stroke="var(--sv-ink)" stroke-width="1.2"></line>
<line x1="432" y1="336" x2="432" y2="344" stroke="var(--sv-ink)" stroke-width="1.2"></line>
<line x1="516" y1="336" x2="516" y2="344" stroke="var(--sv-ink)" stroke-width="1.2"></line>
<line x1="600" y1="336" x2="600" y2="344" stroke="var(--sv-ink)" stroke-width="1.2"></line>
<line x1="684" y1="336" x2="684" y2="344" stroke="var(--sv-ink)" stroke-width="1.2"></line>
<text x="96" y="358" font-size="12" font-family="inherit" text-anchor="middle" fill="var(--sv-muted)">0</text>
<text x="180" y="358" font-size="12" font-family="inherit" text-anchor="middle" fill="var(--sv-muted)">2</text>
<text x="264" y="358" font-size="12" font-family="inherit" text-anchor="middle" fill="var(--sv-muted)">4</text>
<text x="348" y="358" font-size="12" font-family="inherit" text-anchor="middle" fill="var(--sv-muted)">6</text>
<text x="432" y="358" font-size="12" font-family="inherit" text-anchor="middle" fill="var(--sv-muted)">8</text>
<text x="516" y="358" font-size="12" font-family="inherit" text-anchor="middle" fill="var(--sv-muted)">10</text>
<text x="600" y="358" font-size="12" font-family="inherit" text-anchor="middle" fill="var(--sv-muted)">12</text>
<text x="684" y="358" font-size="12" font-family="inherit" text-anchor="middle" fill="var(--sv-muted)">14</text>
<text x="390" y="376" font-size="12" font-family="inherit" text-anchor="middle" fill="var(--sv-ink)">迭代（每个 decode step）</text>
</svg><figcaption>图 1 · 两种调度的甘特图对比（示意，非实测）。静态批处理的每一行是一批中的一条请求，短请求结束后槽位一直空转到最长请求完成；连续批处理在请求完成的下一个迭代就准入新请求。下半部分按 4 条泳道绘制只是便于对比，实际调度器并不把序列绑定到固定槽位。</figcaption></figure>
<p>表 1 对比三种做法。连续批处理本身不解决 KV 碎片：若仍按最大长度预留，batch 一大就 OOM，调度再灵活也开不起来。这正是 PagedAttention 要补的一半。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>维度</th><th>静态批处理</th><th>连续批处理</th><th>连续批处理 + 分页 KV</th></tr></thead>
<tbody>
<tr><td>batch 组成</td><td>固定，整批跑完才换</td><td>每迭代可变</td><td>每迭代可变</td></tr>
<tr><td>新请求进入</td><td>等整批结束</td><td>下一迭代即可准入</td><td>下一迭代即可准入</td></tr>
<tr><td>padding</td><td>对齐到 L_max，浪费大</td><td>拼接，基本无 padding</td><td>基本无 padding</td></tr>
<tr><td>KV 分配</td><td>按最大长度连续预留</td><td>仍可能连续预留</td><td>固定块 + 块表映射</td></tr>
<tr><td>KV 显存浪费</td><td>高（预留+碎片）</td><td>仍高</td><td>论文口径通常低于 4%</td></tr>
<tr><td>典型收益</td><td>基线</td><td>吞吐数倍于静态</td><td>再叠加更大的并发 batch</td></tr>
</tbody>
</table></div>
</section>

<section class="sec">
<h2>Orca 的洞察：调度粒度从请求降到迭代</h2>
<p>2022 年的 Orca 指出：生成式推理的 batch 不该是生命周期固定的容器，而应每步重新组装。它提出 <mark>iteration-level scheduling</mark>：每个 decode 迭代结束，调度器检查哪些序列已结束、哪些在排队，把空出的位置立刻分给新请求。batch 成员和大小逐迭代变化，这就是 <mark>continuous batching</mark>。</p>
<p>只改调度还不够。attention 对序列长度敏感，线性层却可接受任意拼接的 token。Orca 的 <mark>selective batching</mark> 把两类算子分开：线性层将所有 token 拼成大矩阵乘，attention 按序列处理，避免为对齐形状而 padding。这样 batch 内长度可完全不同，GEMM 仍保持高利用率。</p>
<p>论文在 GPT-3 175B 上报告：相同延迟约束下，吞吐相对 FasterTransformer 最高提升 36.9 倍。这个数字要读清口径：它是端到端系统对比，包含选择性批处理、调度与实现优化的共同作用，不是“连续批处理单独带来 36.9 倍”；硬件、并行配置与延迟目标都会改变结果，把它当作方向性上界即可。</p>
<div class="callout callout--story"><span class="callout__label">故事</span><div>请求越积越多而吞吐不涨、GPU 利用率只有三四成，是早期推理服务的常见现象。第一反应往往是加机器，其实 batch 里一半是 padding、另一半在陪跑。先把调度粒度改对，同一张卡就能多接几倍流量。</div></div>
</section>

<section class="sec">
<h2>调度器在每一步做什么</h2>
<p>调度器核心是一个状态机（图 2）。请求到达后进入等待队列（waiting），调度器每迭代尝试准入（admit）：检查 KV Cache 空闲块数与本迭代 token 预算。够才准入；先 prefill 建立 KV，再转 decode，每步生成一个 token，直到 EOS 或 max_tokens，最后释放全部块。</p>
<p>资源不够时触发<mark>抢占</mark>（preemption）：从运行集合挑一条牺牲者，收回其 KV 块。策略通常是“最晚到达”或“优先级最低”，因为重算代价相对小。回收两条路：丢弃 KV、回等待队列重算（recompute）；或换出到 CPU 内存（swap），之后换入继续。单序列通常选重算，实现简单且不占 PCIe；共享 KV 的多序列组（beam search、并行采样）不能独立重算，只能换出。</p>
<p>优先级调度只是在准入时多一个排序键：高优先级先准入，必要时抢占低优先级。代价是低优先级可能长期饥饿，通常配合老化（aging）或配额。多数在线服务仍以先来先服务（FCFS）为默认，行为可预期且不会饿死请求；优先级只在多租户或混合负载时启用。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="推理调度器的请求状态机">
<defs>
<marker id="batching-scheduling-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="var(--sv-muted)"></path>
</marker>
</defs>
<text x="24" y="24" font-size="14" font-family="inherit" fill="var(--sv-ink)">请求在调度器中的状态迁移（语义示意）</text>
<rect x="24" y="56" width="140" height="56" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="94" y="80" font-size="13" font-family="inherit" text-anchor="middle" fill="var(--sv-ink)">WAITING</text>
<text x="94" y="98" font-size="12" font-family="inherit" text-anchor="middle" fill="var(--sv-muted)">排队 · 无 KV 块</text>
<rect x="214" y="56" width="140" height="56" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="284" y="80" font-size="13" font-family="inherit" text-anchor="middle" fill="var(--sv-ink)">准入检查</text>
<text x="284" y="98" font-size="12" font-family="inherit" text-anchor="middle" fill="var(--sv-muted)">块数 + token 预算</text>
<rect x="414" y="20" width="150" height="52" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="1.5"></rect>
<text x="489" y="44" font-size="13" font-family="inherit" text-anchor="middle" fill="var(--sv-ink)">prefill</text>
<text x="489" y="62" font-size="12" font-family="inherit" text-anchor="middle" fill="var(--sv-muted)">建立 KV</text>
<rect x="414" y="128" width="150" height="52" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="1.5"></rect>
<text x="489" y="152" font-size="13" font-family="inherit" text-anchor="middle" fill="var(--sv-ink)">decode</text>
<text x="489" y="170" font-size="12" font-family="inherit" text-anchor="middle" fill="var(--sv-muted)">每步 1 token</text>
<rect x="614" y="74" width="120" height="52" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="674" y="98" font-size="13" font-family="inherit" text-anchor="middle" fill="var(--sv-ink)">FINISHED</text>
<text x="674" y="116" font-size="12" font-family="inherit" text-anchor="middle" fill="var(--sv-muted)">释放全部块</text>
<rect x="40" y="238" width="150" height="52" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="115" y="262" font-size="13" font-family="inherit" text-anchor="middle" fill="var(--sv-ink)">PREEMPTED</text>
<text x="115" y="280" font-size="12" font-family="inherit" text-anchor="middle" fill="var(--sv-muted)">选牺牲者</text>
<rect x="250" y="288" width="160" height="52" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="330" y="312" font-size="13" font-family="inherit" text-anchor="middle" fill="var(--sv-ink)">SWAPPED</text>
<text x="330" y="330" font-size="12" font-family="inherit" text-anchor="middle" fill="var(--sv-muted)">KV 换出到 CPU</text>
<line x1="164" y1="84" x2="214" y2="84" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#batching-scheduling-arrow)"></line>
<line x1="354" y1="70" x2="414" y2="48" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#batching-scheduling-arrow)"></line>
<text x="366" y="44" font-size="12" font-family="inherit" fill="var(--sv-muted)">资源够</text>
<line x1="489" y1="72" x2="489" y2="128" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#batching-scheduling-arrow)"></line>
<text x="498" y="106" font-size="12" font-family="inherit" fill="var(--sv-muted)">首 token</text>
<path d="M 564 140 C 604 140 604 168 564 168" fill="none" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#batching-scheduling-arrow)"></path>
<text x="610" y="158" font-size="12" font-family="inherit" fill="var(--sv-muted)">逐 token</text>
<line x1="564" y1="140" x2="614" y2="112" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#batching-scheduling-arrow)"></line>
<text x="576" y="104" font-size="12" font-family="inherit" fill="var(--sv-muted)">EOS</text>
<line x1="420" y1="176" x2="190" y2="238" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#batching-scheduling-arrow)"></line>
<text x="272" y="204" font-size="12" font-family="inherit" fill="var(--sv-muted)">KV 不足</text>
<path d="M 40 252 L 12 252 L 12 112 L 24 112" fill="none" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#batching-scheduling-arrow)"></path>
<text x="50" y="220" font-size="12" font-family="inherit" fill="var(--sv-muted)">重算</text>
<line x1="190" y1="264" x2="250" y2="304" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#batching-scheduling-arrow)"></line>
<text x="196" y="326" font-size="12" font-family="inherit" fill="var(--sv-muted)">共享组</text>
<path d="M 410 306 L 540 306 L 540 180" fill="none" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#batching-scheduling-arrow)"></path>
<text x="460" y="296" font-size="12" font-family="inherit" fill="var(--sv-muted)">换入</text>
<text x="24" y="370" font-size="12" font-family="inherit" fill="var(--sv-muted)">同一迭代可同时跑 prefill 块与 decode，即 chunked prefill 混批</text>
</svg><figcaption>图 2 · 调度器状态机。准入受两项资源约束：空闲 KV 块与本迭代 token 预算。抢占后，单序列优先“丢弃 KV 后重算”，共享块的多序列组则换出到 CPU 再换入。不同引擎的状态命名和细节不同，但资源约束与两条回收路径是共通的。</figcaption></figure>
<p>调度器是 CPU 代码，每步都跑。并发序列到几百时，块表查找与 Python 开销累积到毫秒级，GPU 出现气泡（bubble）。这也是引擎把调度、采样、detokenize 移出主循环并异步重叠的原因：开销不在 FLOPs 里，却直接吃掉吞吐。</p>
</section>

<section class="sec">
<h2>PagedAttention：把 KV Cache 变成可分页的块</h2>
<p>KV Cache 若仍按最大长度连续预留，显存会先耗尽。上下文上限 4096 token、Llama-2 7B 每 token 的 KV 是 512 KiB，一条请求预留满就是 2 GiB；实际输出可能几百 token，其余全闲置（公式与 GQA 推导见 inference-basics）。vLLM 论文测量当时的系统，60%–80% 的 KV 显存浪费在碎片与过度预留上，只有 20%–40% 存了有效 KV。</p>
<div class="formula">每 token KV 字节 = 2 × n_layers × n_kv_heads × head_dim × 每元素字节
Llama-2 7B（32 层、32 个 KV 头、head_dim=128、fp16）：
2 × 32 × 32 × 128 × 2 B = 512 KiB/token
4096 token 的序列 ≈ 2 GiB
分页后内部碎片期望 ≈ block_size / 2 个 token/序列</div>
<p>PagedAttention 借用虚拟内存：把 KV Cache 切成固定大小的<mark>块</mark>（block），每块存固定数量 token（vLLM 默认 16），物理块无需连续；每条序列维护一张<mark>块表</mark>（block table），记录“第 i 个逻辑块放在第 j 个物理块”。attention kernel 按块表取 K/V。图 3 是具体映射：请求 A 的逻辑块 0、1、2 分别落在物理块 7、2、5，完全不连续。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="PagedAttention 的逻辑块、块表与物理块映射">
<text x="24" y="24" font-size="14" font-family="inherit" fill="var(--sv-ink)">逻辑块经块表映射到不连续的物理块，支持共享与写时复制</text>
<text x="24" y="60" font-size="13" font-family="inherit" fill="var(--sv-ink)">请求 A</text>
<rect x="90" y="44" width="40" height="24" rx="3" fill="var(--sv-a)"></rect>
<rect x="136" y="44" width="40" height="24" rx="3" fill="var(--sv-a)"></rect>
<rect x="182" y="44" width="40" height="24" rx="3" fill="var(--sv-a)"></rect>
<text x="110" y="60" font-size="12" font-family="inherit" text-anchor="middle" fill="var(--sv-ink)">A0</text>
<text x="156" y="60" font-size="12" font-family="inherit" text-anchor="middle" fill="var(--sv-ink)">A1</text>
<text x="202" y="60" font-size="12" font-family="inherit" text-anchor="middle" fill="var(--sv-ink)">A2</text>
<text x="250" y="52" font-size="12" font-family="inherit" fill="var(--sv-muted)">块表</text>
<text x="250" y="70" font-size="13" font-family="inherit" fill="var(--sv-ink)">7 · 2 · 5</text>
<text x="24" y="112" font-size="13" font-family="inherit" fill="var(--sv-ink)">请求 B</text>
<rect x="90" y="96" width="40" height="24" rx="3" fill="var(--sv-a)"></rect>
<rect x="136" y="96" width="40" height="24" rx="3" fill="var(--sv-a)"></rect>
<text x="110" y="112" font-size="12" font-family="inherit" text-anchor="middle" fill="var(--sv-ink)">B0</text>
<text x="156" y="112" font-size="12" font-family="inherit" text-anchor="middle" fill="var(--sv-ink)">B1</text>
<text x="250" y="104" font-size="12" font-family="inherit" fill="var(--sv-muted)">块表</text>
<text x="250" y="122" font-size="13" font-family="inherit" fill="var(--sv-ink)">7 · 4</text>
<text x="24" y="164" font-size="13" font-family="inherit" fill="var(--sv-ink)">请求 C</text>
<rect x="90" y="148" width="40" height="24" rx="3" fill="var(--sv-a)"></rect>
<rect x="136" y="148" width="40" height="24" rx="3" fill="var(--sv-a)"></rect>
<rect x="182" y="148" width="40" height="24" rx="3" fill="var(--sv-a)"></rect>
<text x="110" y="164" font-size="12" font-family="inherit" text-anchor="middle" fill="var(--sv-ink)">C0</text>
<text x="156" y="164" font-size="12" font-family="inherit" text-anchor="middle" fill="var(--sv-ink)">C1</text>
<text x="202" y="164" font-size="12" font-family="inherit" text-anchor="middle" fill="var(--sv-ink)">C2</text>
<text x="250" y="156" font-size="12" font-family="inherit" fill="var(--sv-muted)">块表</text>
<text x="250" y="174" font-size="13" font-family="inherit" fill="var(--sv-ink)">7 · 2 · 6</text>
<text x="420" y="40" font-size="13" font-family="inherit" fill="var(--sv-ink)">物理 KV 块池（块间无需连续）</text>
<rect x="420" y="56" width="70" height="42" rx="3" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="4 4"></rect>
<text x="426" y="72" font-size="12" font-family="inherit" fill="var(--sv-muted)">0</text>
<text x="440" y="90" font-size="12" font-family="inherit" fill="var(--sv-muted)">空闲</text>
<rect x="498" y="56" width="70" height="42" rx="3" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="4 4"></rect>
<text x="504" y="72" font-size="12" font-family="inherit" fill="var(--sv-muted)">1</text>
<text x="518" y="90" font-size="12" font-family="inherit" fill="var(--sv-muted)">空闲</text>
<rect x="576" y="56" width="70" height="42" rx="3" fill="var(--sv-c)"></rect>
<text x="582" y="72" font-size="12" font-family="inherit" fill="var(--sv-ink)">2</text>
<text x="596" y="90" font-size="12" font-family="inherit" fill="var(--sv-ink)">A1·C1</text>
<rect x="654" y="56" width="70" height="42" rx="3" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="4 4"></rect>
<text x="660" y="72" font-size="12" font-family="inherit" fill="var(--sv-muted)">3</text>
<text x="674" y="90" font-size="12" font-family="inherit" fill="var(--sv-muted)">空闲</text>
<rect x="420" y="106" width="70" height="42" rx="3" fill="var(--sv-a)"></rect>
<text x="426" y="122" font-size="12" font-family="inherit" fill="var(--sv-ink)">4</text>
<text x="440" y="140" font-size="12" font-family="inherit" fill="var(--sv-ink)">B1</text>
<rect x="498" y="106" width="70" height="42" rx="3" fill="var(--sv-a)"></rect>
<text x="504" y="122" font-size="12" font-family="inherit" fill="var(--sv-ink)">5</text>
<text x="518" y="140" font-size="12" font-family="inherit" fill="var(--sv-ink)">A2</text>
<rect x="576" y="106" width="70" height="42" rx="3" fill="var(--sv-b)"></rect>
<text x="582" y="122" font-size="12" font-family="inherit" fill="var(--sv-ink)">6</text>
<text x="596" y="140" font-size="12" font-family="inherit" fill="var(--sv-ink)">C2 副本</text>
<rect x="654" y="106" width="70" height="42" rx="3" fill="var(--sv-c)"></rect>
<text x="660" y="122" font-size="12" font-family="inherit" fill="var(--sv-ink)">7</text>
<text x="674" y="140" font-size="12" font-family="inherit" fill="var(--sv-ink)">A0·B0·C0</text>
<rect x="420" y="156" width="70" height="42" rx="3" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="4 4"></rect>
<text x="426" y="172" font-size="12" font-family="inherit" fill="var(--sv-muted)">8</text>
<text x="440" y="190" font-size="12" font-family="inherit" fill="var(--sv-muted)">空闲</text>
<rect x="498" y="156" width="70" height="42" rx="3" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="4 4"></rect>
<text x="504" y="172" font-size="12" font-family="inherit" fill="var(--sv-muted)">9</text>
<text x="518" y="190" font-size="12" font-family="inherit" fill="var(--sv-muted)">空闲</text>
<rect x="576" y="156" width="70" height="42" rx="3" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="4 4"></rect>
<text x="582" y="172" font-size="12" font-family="inherit" fill="var(--sv-muted)">10</text>
<text x="596" y="190" font-size="12" font-family="inherit" fill="var(--sv-muted)">空闲</text>
<rect x="654" y="156" width="70" height="42" rx="3" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="4 4"></rect>
<text x="660" y="172" font-size="12" font-family="inherit" fill="var(--sv-muted)">11</text>
<text x="674" y="190" font-size="12" font-family="inherit" fill="var(--sv-muted)">空闲</text>
<rect x="24" y="224" width="12" height="12" fill="var(--sv-a)"></rect>
<text x="42" y="235" font-size="12" font-family="inherit" fill="var(--sv-muted)">独占块</text>
<rect x="150" y="224" width="12" height="12" fill="var(--sv-c)"></rect>
<text x="168" y="235" font-size="12" font-family="inherit" fill="var(--sv-muted)">共享块 ref≥2</text>
<rect x="320" y="224" width="12" height="12" fill="var(--sv-b)"></rect>
<text x="338" y="235" font-size="12" font-family="inherit" fill="var(--sv-muted)">CoW 副本</text>
<rect x="460" y="224" width="12" height="12" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="3 3"></rect>
<text x="478" y="235" font-size="12" font-family="inherit" fill="var(--sv-muted)">空闲</text>
<text x="24" y="270" font-size="12" font-family="inherit" fill="var(--sv-muted)">请求 A 的块表 [7, 2, 5]；请求 B 的块表 [7, 4]；请求 C 的块表 [7, 2, 6]（CoW 后）</text>
<text x="24" y="296" font-size="12" font-family="inherit" fill="var(--sv-muted)">块 7 被 A、B、C 共同指向（ref=3），块 2 被 A、C 共享（ref=2），存的是同一段前缀的 KV</text>
<text x="24" y="322" font-size="12" font-family="inherit" fill="var(--sv-muted)">C 的逻辑块 2 原本与 A 的逻辑块 2 共享块 5，写入前复制为块 6（CoW），随后 A 独占块 5</text>
<text x="24" y="348" font-size="12" font-family="inherit" fill="var(--sv-muted)">每块存 16 个 token；只有每个请求的最后一块可能装不满</text>
</svg><figcaption>图 3 · 分页 KV 的块映射。逻辑块连续编号，物理块可任意分散；块表是每条序列私有的映射表。共享前缀对应共享物理块（块 7、块 2），需要写入时触发写时复制（块 5 到块 6）。块内地址连续，因此 HBM 访问仍能保持较高的 transaction 效率。</figcaption></figure>
<p>分页后浪费只剩每条序列最后一块的内部碎片：平均半个块，最多 block_size−1 个 token；block=16 时通常低于 4%。代价是块表查找与更复杂的 kernel：块内连续、块间跳转，访存不再是一条连续大数组。但 HBM 的最小访问粒度是 32 字节 sector、缓存行通常 128 字节，块内足够大时带宽损失有限，换来更大 batch。</p>
<p>块大小可调。16 是常见默认：块越小，内部碎片越少、共享粒度越细，但块表更长、元数据更占显存；块越大则相反。32 或 64 在长上下文、低并发时可能更划算，需实测，没有普遍最优值。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>PagedAttention 减少的是<mark>浪费</mark>，不改变每 token 的 KV 绝对字节数。上下文 32K、并发 256 时，总量仍按 512 KiB/token 相乘；降绝对量要靠 GQA/MQA、KV 量化或更短上下文，多卡并行与 PD 分离只是把同样的总量分摊到不同芯片上，并不减少总量。</div></div>
</section>

<section class="sec">
<h2>共享、写时复制与前缀缓存</h2>
<p>分页的额外能力是<mark>共享</mark>。并行采样（一条 prompt 生成 n 个候选）、beam search、多轮对话，都会产生完全相同的前缀。物理块可被多条块表指向，只需维护引用计数（ref count）；只有当某条序列要写入共享块时，才复制一份再写，这就是<mark>写时复制</mark>（copy-on-write，CoW）。n 个候选共享 prompt，KV 只存一份，显存节省接近 (n−1)/n。</p>
<p>把这个思想跨请求推广，就是<mark>前缀缓存</mark>（prefix caching）。调度器对完整 token 块做哈希，命中就复用物理块，跳过这部分 prefill。系统提示词、few-shot 示例、多轮历史和 Agent 的固定工具描述都是高命中率前缀。SGLang 的 RadixAttention 用基数树（radix tree）组织前缀并配合 LRU 淘汰，vLLM 也提供自动前缀缓存。命中部分的 TTFT 近似按复用 token 比例下降；吞吐提升取决于共享前缀占比。</p>
<p>工程上有几个约束。多数实现只缓存完整块，尾部不足一块不共享，否则哈希与 CoW 会变复杂；哈希要同时算 token id 序列与前缀哈希，避免碰撞后读到错误 KV；缓存要预留显存并参与淘汰，命中率低时反而挤占 KV 池。跨租户共享还有安全风险：攻击者可通过时延探测某段前缀是否已缓存，从而推断他人内容，多租户要评估关闭或隔离。</p>
<p>SGLang 论文报告，在共享前缀密集的结构化程序负载上，吞吐最高提升 6.4 倍。该数字高度依赖命中率：前缀几乎不重复的开放域聊天，收益小得多。看到这类数字，先问共享比例。</p>
</section>

<section class="sec">
<h2>Chunked prefill：别让一条长 prompt 堵住所有人</h2>
<p>prefill 与 decode 的资源画像相反：prefill 是大块矩阵乘，compute-bound；decode 每步只处理一个 token，memory-bound。若让一条 32K token 的 prompt 独占一个迭代做 prefill，所有 decode 请求都要等它，<mark>token 间延迟</mark>（inter-token latency，ITL）出现尖峰，用户感知为输出“卡一下”。</p>
<p><mark>Chunked prefill</mark> 把长 prompt 的 prefill 切成若干块，每迭代只处理一块，剩余 token 预算留给 decode。设每迭代预算为 T，运行中的 decode 序列数为 n（每条消耗一个 token），prefill 块大小为 C，则约束是 n + C ≤ T。一次迭代里既有 prefill 的算力活，又有 decode 的带宽活，ITL 尾部被压平。</p>
<div class="formula">每迭代约束　n_decode + C ≤ T
T = max_num_batched_tokens，C = prefill 块大小，n_decode = 运行中的 decode 序列数
TTFT ≈ ⌈L / C⌉ × t_iter + 排队时间，L 为 prompt token 数</div>
<div class="duo"><div class="duo__col"><h4>不分块：ITL 出现尖峰</h4><p>一条 32K prompt 的 prefill 独占若干毫秒到数十毫秒，期间所有 decode 停摆。平均延迟可能还行，p99 很难看，用户感知为“打字机卡住”。</p></div><div class="duo__col"><h4>分块：ITL 更平</h4><p>每迭代固定 token 预算，prefill 块与 decode 混跑。长 prompt 的 TTFT 变长，但已有请求的输出节奏稳定，适合交互式服务。</p></div></div>
<p>代价是长 prompt 的 TTFT 变长：原本一次 prefill 完，现在要分 ⌈L/C⌉ 个迭代。Sarathi-Serve 把这种“分块 prefill + decode 搭车”称为 stall-free batching 并做联合优化；论文报告相对当时的 vLLM，服务容量最高约 2.6 倍，P99 尾延迟最多降至约 1/6.9（硬件、模型与延迟约束见论文）。这些数字并非无条件：chunk 太大退化成整段 prefill，太小则调度开销与 KV 写入上升。</p>
<p>混批策略通常是“decode 优先，prefill 填缝”：先保证每条 decode 拿到一个 token，剩余预算按 FCFS 或优先级分给 prefill 块。也有系统选择分离式部署，把 prefill 与 decode 放到不同实例（PD 分离），那是平台层取舍，不在本篇展开。</p>
</section>

<section class="sec">
<h2>参数、实测趋势与排障</h2>
<h3>最该先调的几个参数</h3>
<p>各引擎参数名不同，语义高度重合。表 2 列出常见参数与调错症状；默认值随版本变化，以版本文档为准。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>参数</th><th>作用</th><th>调大后的效果</th><th>调错的症状</th></tr></thead>
<tbody>
<tr><td><code>max_num_seqs</code></td><td>并发序列上限</td><td>并发升、KV 压力升</td><td>频繁抢占、p99 抖动</td></tr>
<tr><td><code>gpu_memory_utilization</code></td><td>引擎可用显存比例</td><td>KV 池变大</td><td>过高 OOM，过低并发不足</td></tr>
<tr><td><code>max_num_batched_tokens</code></td><td>每迭代 token 预算</td><td>prefill 吞吐升、ITL 变差</td><td>长 prefill 堵塞 decode</td></tr>
<tr><td><code>block_size</code></td><td>KV 块大小</td><td>元数据少、碎片多</td><td>太小 kernel 慢，太大浪费</td></tr>
<tr><td><code>enable_chunked_prefill</code></td><td>长 prefill 切片</td><td>ITL 更平滑、TTFT 变长</td><td>chunk 过大退化为整段</td></tr>
<tr><td><code>enable_prefix_caching</code></td><td>复用共享前缀 KV</td><td>命中时 TTFT 降</td><td>低命中率时挤占 KV 池</td></tr>
</tbody>
</table></div>
<p><mark>max_num_seqs</mark> 是并发序列上限。调大提高并发，但 KV 池不够时频繁抢占，吞吐下降、延迟抖动；要和 gpu_memory_utilization 一起看。后者是可用显存比例（vLLM 长期默认 0.9），剩余留给 CUDA context、临时激活与同卡进程；太高易 OOM，太低则 KV 池小、并发上不去。</p>
<p><mark>max_num_batched_tokens</mark> 是每迭代 token 预算，决定 chunked prefill 的块大小与 ITL。长上下文服务调大，交互式服务保守。块大小、前缀缓存、chunked prefill 等开关按负载选择，不要一套配置打天下。</p>
<pre class="code" data-lang="bash"><code># 参数名以 vLLM 为例，其他引擎含义相近、名称可能不同
vllm serve meta-llama/Llama-3-8B-Instruct \
  --max-num-seqs 256 \
  --gpu-memory-utilization 0.90 \
  --max-num-batched-tokens 8192 \
  --enable-chunked-prefill \
  --enable-prefix-caching</code></pre>
<h3>吞吐提升的量级</h3>
<p>公开结果只看趋势：Orca 相对 FasterTransformer 最高 36.9 倍（GPT-3 175B，同延迟口径）；vLLM 相对二者在同延迟下 2 到 4 倍，KV 浪费从 60%–80% 降到 4% 以下；Sarathi-Serve 相对 vLLM 最高约 2.6 倍容量、P99 尾延迟降至约 1/6.9；SGLang 在共享前缀负载上最高 6.4 倍。这些数字来自不同模型、硬件与负载，不能相乘或直接套用。可靠做法是画自己的吞吐-延迟曲线：固定 p99 TTFT/ITL，扫 max_num_seqs 找拐点。</p>
<h3>常见误区</h3>
<ul>
<li>把 continuous batching 当成“动态 batch size”。它改变的是每步成员，不只是大小；没有逐迭代准入与退出，短请求仍会被长请求拖住。</li>
<li>以为 PagedAttention 能减少 KV 绝对字节数。它只减少浪费，不改变每 token 的 KV 大小。</li>
<li>只看平均延迟。调度问题几乎都体现在 p99：抢占、chunk 边界、缓存淘汰都会制造长尾。</li>
<li>盲目调大 max_num_seqs。超过 KV 池承载能力后，每迭代都在抢占和重算，有效吞吐反而下降。</li>
</ul>
<h3>排障清单</h3>
<p>遇到“GPU 利用率不高但请求排队”，按序查：等待队列是否持续大于运行集合（准入受限，查 KV 池与 gpu_memory_utilization）；抢占次数是否随 QPS 上升（max_num_seqs 过大或 KV 不足）；TTFT 高而 ITL 正常（prefill 排队或前缀未命中）；ITL 毛刺（长 prefill 未分块或 chunk 太大）；显存缓涨（缓存未淘汰、请求未释放）。</p>
<div class="callout callout--tip"><span class="callout__label">技巧</span><div>别追单点最优。固定 p99 TTFT 与 ITL 上限，把 max_num_seqs 从默认值逐步加倍，记录吞吐与抢占次数；曲线第一次走平或掉头处就是合理工作点。换模型或上下文长度要重测。</div></div>
<h3>自测</h3>
<details class="quiz"><summary>Q1 · 8 条请求长度分别为 128、256、512、512、1024、1024、2048、2048 token，静态 batch 的有效 token 占比是多少？</summary><div class="quiz__a">总和 7552，batch 形状 8×2048=16384，有效占比≈46%，超过一半 prefill 算力花在 padding 上。注意这是按 token 数算的占比；实际耗时还受 attention 的 O(L²) 项影响，但浪费方向不变。</div></details>
<details class="quiz"><summary>Q2 · PagedAttention 已把 KV 浪费压到 4% 以下，为什么长上下文高并发还是会 OOM？</summary><div class="quiz__a">分页消除的是碎片与过度预留，不改变每 token 的 KV 字节数。Llama-2 7B 每 token 512 KiB，32K 上下文单条就是 16 GiB，256 条并发是 4 TiB 量级。此时要么降并发、缩上下文，要么用 GQA、KV 量化、多卡并行或 PD 分离。先算绝对量，再谈碎片。</div></details>
<details class="quiz"><summary>Q3 · 长 prompt 导致 ITL 毛刺，把 max_num_batched_tokens 调得更大为什么可能更糟？</summary><div class="quiz__a">它是每迭代 token 预算，调大意味着 prefill 块更大，一次迭代占用 GPU 更久，decode 等得更久，ITL 尖峰更明显。正确做法是启用 chunked prefill，把块大小控制在十几到几十毫秒的迭代时长内，并给 decode 预留预算。</div></details>
<details class="quiz"><summary>Q4 · 两个请求共享同一段系统提示词，前缀缓存命中后，为什么仍要做一部分 prefill？</summary><div class="quiz__a">缓存只覆盖完整块，且要求前缀完全相同；命中部分的 KV 直接复用，但两条请求后续的 token 与生成阶段仍要计算。缓存中的 KV 仍占用物理块，只是不再重复计算。命中降低 TTFT 与重复计算量，不会把 prefill 降到零。</div></details>
<h3>延伸阅读</h3>
<ul class="refs">
<li><b>Orca: A Distributed Serving System for Transformer-Based Generative Models</b> — Gyeong-In Yu 等, OSDI 2022。提出 iteration-level scheduling 与 selective batching，是连续批处理的理论起点。</li>
<li><b>Efficient Memory Management for Large Language Model Serving with PagedAttention</b> — Woosuk Kwon 等, SOSP 2023（vLLM）。分页 KV、块表、CoW 与碎片实测的原始论文。</li>
<li><b>SGLang: Efficient Execution of Structured Language Model Programs</b> — Lianmin Zheng 等, NeurIPS 2024（arXiv:2312.07104）。RadixAttention 用基数树做前缀复用，可看清前缀缓存的收益边界。</li>
<li><b>Taming Throughput-Latency Tradeoff in LLM Inference with Sarathi-Serve</b> — Amey Agrawal 等, OSDI 2024（arXiv:2403.02310）。chunked prefill 与 stall-free batching 的系统分析。</li>
<li><b>Mooncake: A KVCache-centric Disaggregated Architecture for LLM Serving</b> — Ruoyu Qin 等, FAST 2025（arXiv:2407.00079）。把 KV Cache 当作一等资源分层调度，是分页思想在集群层面的延伸。</li>
</ul>
</section>
`
};
