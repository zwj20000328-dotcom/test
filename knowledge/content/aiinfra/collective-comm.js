window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["collective-comm"] = {
  slug: "collective-comm",
  title: "集合通信：AllReduce 与拓扑感知",
  subtitle: "分布式训练的隐形税",
  level: 3,
  cluster: "训练",
  tags: ["NCCL", "AllReduce", "Ring"],
  summary: "集合通信是分布式训练的隐形税：从八种原语到 ring/tree 算法、NCCL 拓扑感知与 SHARP 卸载，算清 AllReduce 通信量并给出排障路径。",
  keyPoints: [
    "八种集合原语的分工，以及 AllReduce = ReduceScatter + AllGather 这一核心恒等式",
    "ring AllReduce 的两阶段与 2(N−1)/N·S 通信量，以及 RH-D、tree、NVLS/SHARP 的适用边界",
    "用 NCCL 拓扑探测、busbw 指标和环境变量定位“加卡反而更慢”的通信根因"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>为什么集合通信是分布式训练的隐形税</h2>
<p>一张 GPU 上的模型再快，只要训练被切到多张卡，每一步就多出一段“所有卡必须一起完成、但谁也不产出梯度”的时间。数据并行里，反向传播算出各卡局部梯度后要做一次 AllReduce 求和；张量并行里，每个 Transformer 层的注意力与 MLP 之后各要一次 AllReduce；FSDP 与 ZeRO 则把梯度切成片做 ReduceScatter、把参数做 AllGather。这些操作统称<mark>集合通信</mark>（collective communication）：一组进程共同参与、语义由整个 group 决定，而不是点对点（point-to-point）的 send/recv。</p>
<p>先算一笔账。假设模型梯度共 1 GB（fp16，约 5 亿参数），8 张 H100 各配一个 400 Gb/s InfiniBand NDR 端口，每张卡可用单向带宽约 50 GB/s。Ring AllReduce 下每卡要发送 2(N−1)/N·S = 1.75 GB，理想耗时约 35 ms；如果一步计算只要 200 ms，通信已经吃掉约 15% 的迭代时间。集群从单机 8 卡扩到 64 卡、跨多层交换机时，这个比例还会上升，这就是“隐形税”：它不出现在 FLOPs 报表里，却直接决定你花多少钱买到多少有效算力。</p>
<p>本篇只讨论集合通信本身的机制、算法与拓扑，不展开数据并行、张量并行、流水并行的策略设计（那些放在 data-parallel 与 model-parallel 两篇）。读完后你应当能看懂一次 AllReduce 的通信量从哪来，判断 NCCL 为什么在某台机器上慢，并把问题定位到网卡、PCIe 还是算法选择。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>把 AllReduce 想成 N 个人各有一本账，最后每个人都要拿到所有账的总和。Ring 的做法是大家围成一圈，每人把账本的一页传给下家、同时从上家接一页并相加；转完 N−1 步，每个人都恰好有一页完整的总账，再花 N−1 步把这页传遍所有人。没有中心节点，也就没有“大家都等一个人”的热点。</div></div>
</section>
<section class="sec">
<h2>八种原语：先分清谁在搬数据、谁在算</h2>
<p>MPI 定义的集合通信原语很多，工程上真正高频的是下面八种。理解它们的关键是三个维度：数据从几个 rank 出发、最终落到几个 rank、中间是否做规约（reduction）。分清这三件事，看任何框架的通信日志都不会迷路。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>原语</th><th>语义</th><th>典型用途</th></tr></thead><tbody>
<tr><td>Broadcast</td><td>1 → 全部：根 rank 的数据复制给所有 rank</td><td>分发初始权重、配置、随机种子</td></tr>
<tr><td>Scatter</td><td>1 → 全部：根 rank 把数据切成 N 份，各 rank 拿一份</td><td>切分输入 batch，较少单独使用</td></tr>
<tr><td>Gather</td><td>全部 → 1：各 rank 的数据汇到根 rank</td><td>评估时收集预测、汇总日志</td></tr>
<tr><td>AllGather</td><td>全部 → 全部：各 rank 的分片拼成完整数据，人人一份</td><td>ZeRO/FSDP 参数重建、张量并行拼激活</td></tr>
<tr><td>Reduce</td><td>全部 → 1：按 sum/max 等操作归约到根 rank</td><td>单点统计 loss 与指标</td></tr>
<tr><td>AllReduce</td><td>全部 → 全部：归约结果人人一份</td><td>DDP 梯度求和、张量并行</td></tr>
<tr><td>ReduceScatter</td><td>全部 → 全部：先归约，再把结果按 rank 切片分发</td><td>FSDP/ZeRO 梯度分片</td></tr>
<tr><td>AllToAll</td><td>全部 → 全部：每个 rank 给其他每个 rank 发不同的数据</td><td>MoE token 路由、张量并行换布局</td></tr>
</tbody></table></div>
<p>最重要的恒等式是 <code>AllReduce = ReduceScatter + AllGather</code>。这也是 ring 算法能同时服务三种原语的原因：先做 N−1 步“边传边加”，每人得到一片完整归约结果；再做 N−1 步“把自己那一片传遍其余 rank”，所有人补齐全部结果。ReduceScatter 和 AllGather 各取其中一半。</p>
<p>MoE 的专家并行（expert parallelism）是 AllToAll 的主场：token 按门控结果发往不同 GPU 上的专家，算完再收回，一次前向通常有 dispatch 与 combine 两次 AllToAll；各 rank 的数据量不均，是最难调的一类集合通信，细节放到 MoE 一篇展开。</p>
<p>工程上还有两个易忽略的约定。第一，集合通信是 group 语义：同一个 communicator 上所有 rank 必须以相同顺序调用相同的原语、相同的 count 与 datatype，否则轻则结果错乱，重则永久 hang。第二，<code>Barrier</code> 不搬数据，只做同步，常被误当作“让通信更快”的手段；它只会把慢 rank 的等待显式化。排查 hang 时，先怀疑调用顺序不一致，而不是带宽不够。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>看到框架里出现 all_reduce、all_gather、reduce_scatter、all_to_all 四个名字，先问“归约了吗、切分了吗”，就能立刻对上表里的语义。ZeRO-3 的参数收集是 AllGather，梯度是 ReduceScatter，二者都不是 AllReduce。</div></div>
</section>
<section class="sec">
<h2>Ring AllReduce：两阶段与 2(N−1)/N·S</h2>
<p>Ring 是最经典、也是 NCCL 在大消息下最常用的实现。把 N 个 rank 逻辑上排成一个环，把每张卡上的缓冲区切成 N 份、每份 S/N。算法分两个阶段，每个阶段都是 N−1 步，每步每张卡只向下游发送一份、从上游接收一份。<b>阶段一 ReduceScatter</b>：每步把当前持有的一份发给下游，同时接收上游发来的一份并与本地对应的那份相加。跟踪其中一块数据（图 1 上半部分）：它从 N0 出发，经过 N1、N2、N3，每经过一站就多累加一次，走满 N−1 跳后变成完整的和，落在某一站。所有块同时进行，N−1 步之后，每张卡恰好持有一块“完整归约”的数据。<br><br><b>阶段二 AllGather</b>：每张卡把自己那块完整结果沿环传下去，不做加法，只做覆盖写入。再经过 N−1 步，每张卡的缓冲区里都集齐了 N 块完整结果，AllReduce 完成。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="Ring AllReduce 两阶段分步演示">
<defs>
<marker id="collective-comm-f1-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-muted)"></path></marker>
</defs>
<text x="20" y="28" font-size="15" font-family="inherit" fill="var(--sv-ink)">阶段一 · ReduceScatter：跟踪 chunk 0 绕环累加（N=4）</text>
<rect x="20" y="45" width="165" height="100" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="102" y="65" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-muted)">Step 0</text>
<text x="102" y="84" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">chunk 0 在 N0</text>
<rect x="84" y="92" width="36" height="32" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
<text x="102" y="114" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">0</text>
<text x="102" y="140" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">贡献 1/4</text>
<line x1="187" y1="95" x2="202" y2="95" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#collective-comm-f1-arrow)"></line>
<rect x="205" y="45" width="165" height="100" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="287" y="65" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-muted)">Step 1</text>
<text x="287" y="84" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">到达 N1</text>
<rect x="269" y="92" width="36" height="32" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
<text x="287" y="114" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">0</text>
<text x="287" y="140" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">贡献 2/4</text>
<line x1="372" y1="95" x2="387" y2="95" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#collective-comm-f1-arrow)"></line>
<rect x="390" y="45" width="165" height="100" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="472" y="65" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-muted)">Step 2</text>
<text x="472" y="84" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">到达 N2</text>
<rect x="454" y="92" width="36" height="32" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
<text x="472" y="114" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">0</text>
<text x="472" y="140" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">贡献 3/4</text>
<line x1="557" y1="95" x2="572" y2="95" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#collective-comm-f1-arrow)"></line>
<rect x="575" y="45" width="165" height="100" rx="8" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></rect>
<text x="657" y="65" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-muted)">Step 3</text>
<text x="657" y="84" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">到达 N3</text>
<rect x="639" y="92" width="36" height="32" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
<text x="657" y="114" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">0</text>
<text x="657" y="140" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">完整归约 4/4</text>
<text x="20" y="188" font-size="15" font-family="inherit" fill="var(--sv-ink)">阶段二 · AllGather：N0 的缓冲区逐步集齐（N=4）</text>
<rect x="20" y="205" width="165" height="120" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="102" y="225" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-muted)">Step 0</text>
<rect x="40" y="238" width="26" height="26" rx="3" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="53" y="256" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">0</text>
<rect x="72" y="238" width="26" height="26" rx="3" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
<text x="85" y="256" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">1</text>
<rect x="104" y="238" width="26" height="26" rx="3" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="117" y="256" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">2</text>
<rect x="136" y="238" width="26" height="26" rx="3" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="149" y="256" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">3</text>
<text x="102" y="298" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">已有 1/4 块</text>
<line x1="187" y1="263" x2="202" y2="263" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#collective-comm-f1-arrow)"></line>
<rect x="205" y="205" width="165" height="120" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="287" y="225" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-muted)">Step 1</text>
<rect x="225" y="238" width="26" height="26" rx="3" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
<text x="238" y="256" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">0</text>
<rect x="257" y="238" width="26" height="26" rx="3" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
<text x="270" y="256" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">1</text>
<rect x="289" y="238" width="26" height="26" rx="3" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="302" y="256" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">2</text>
<rect x="321" y="238" width="26" height="26" rx="3" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="334" y="256" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">3</text>
<text x="287" y="298" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">已有 2/4 块</text>
<line x1="372" y1="263" x2="387" y2="263" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#collective-comm-f1-arrow)"></line>
<rect x="390" y="205" width="165" height="120" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="472" y="225" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-muted)">Step 2</text>
<rect x="410" y="238" width="26" height="26" rx="3" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
<text x="423" y="256" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">0</text>
<rect x="442" y="238" width="26" height="26" rx="3" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
<text x="455" y="256" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">1</text>
<rect x="474" y="238" width="26" height="26" rx="3" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="487" y="256" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">2</text>
<rect x="506" y="238" width="26" height="26" rx="3" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
<text x="519" y="256" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">3</text>
<text x="472" y="298" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">已有 3/4 块</text>
<line x1="557" y1="263" x2="572" y2="263" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#collective-comm-f1-arrow)"></line>
<rect x="575" y="205" width="165" height="120" rx="8" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></rect>
<text x="657" y="225" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-muted)">Step 3</text>
<rect x="595" y="238" width="26" height="26" rx="3" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
<text x="608" y="256" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">0</text>
<rect x="627" y="238" width="26" height="26" rx="3" fill="var(--sv-a2)" stroke="var(--sv-line)"></rect>
<text x="640" y="256" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">1</text>
<rect x="659" y="238" width="26" height="26" rx="3" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
<text x="672" y="256" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">2</text>
<rect x="691" y="238" width="26" height="26" rx="3" fill="var(--sv-b2)" stroke="var(--sv-line)"></rect>
<text x="704" y="256" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">3</text>
<text x="657" y="298" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">集齐 4/4 块</text>
<text x="380" y="355" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">两阶段合计 2(N−1) 步；每步每卡发送 S/N，每卡总发送量 2(N−1)/N·S</text>
</svg><figcaption>图 1 · Ring AllReduce 分步演示（N=4）：上半为 ReduceScatter，跟踪 chunk 0 逐跳累加，最终在 N3 完成；下半为 AllGather，N0 此时只持有完整的 chunk 1，随后依次补齐 chunk 0、3、2。</figcaption></figure>
<div class="formula">每卡发送量 V = 2(N−1)/N × S<br>全网总发送量 = N × V = 2(N−1) × S<br>步数 = 2(N−1)，每步每卡发送 S/N</div>
<p>这个结果值得记住：<mark>每卡通信量与 N 几乎无关</mark>。N=2 时 V=S；N=8 时 V=1.75S；N=64 时 V=1.97S，趋近 2S。这就是 ring 的带宽最优性——没有中心热点，带宽被均匀分摊，也没有哪张卡要接收全部 N 份原始数据。</p>
<p>但“量”不是全部，延迟同样要算。每一步都有固定的启动与传输开销 α，以及把 S/N 数据推过链路的时间 S/(N·B)。于是近似有：</p>
<div class="formula">t_ring ≈ 2(N−1) × (α + S/(N·B))</div>
<p>小消息时 α 主导，步数随 N 线性增长的 ring 会明显吃亏；大消息时带宽项主导，ring 接近最优。这解释了 NCCL 的行为：小 tensor 倾向 tree，大 tensor 倾向 ring。另一个隐性成本是 straggler：ring 是串行依赖，任何一跳慢，整条环都等它，所以跨机训练里“最慢的那张卡”会放大成全局尾延迟。</p>
<div class="callout callout--formula"><span class="callout__label">算例</span><div>以 8 卡、S=1 GB 为例：V=2×7/8×1 GB=1.75 GB；若每卡有效带宽 50 GB/s，纯传输约 35 ms。若每步延迟 α≈5 μs（跨机量级，视实现而定），14 步额外约 0.07 ms，相对可忽略。若 S 降到 1 MB，传输只剩约 35 μs，而 14 步的 α 仍有约 0.07 ms，延迟反超——这就是小消息必须换算法的原因。</div></div>
</section>
<section class="sec">
<h2>更大的 N：Recursive Halving-Doubling 与 Tree</h2>
<p>Ring 的问题在步数 O(N)。当 N 到几百、上千（大规模 GPU 集群），即使每步只有几微秒，累计延迟也不可忽视。于是有两类思路：把步数压到 O(log₂N)，或把归约搬到树与交换机上。</p>
<p><b>Recursive Halving-Doubling（RH-D，又称 Rabenseifner 算法）</b>把 AllReduce 拆成两个对数阶段。ReduceScatter 用 recursive halving：每步把 rank 集合对半分成两组，两组交换“对方需要的那一半”数据并相加，问题规模与 rank 数同时减半；log₂N 步后每个 rank 只剩一块完整结果。AllGather 用 recursive doubling 反向进行：每步与距离 1、2、4 的伙伴交换各自已拼好的部分，log₂N 步后人人齐全。它的通信量与 ring 同阶（2(N−1)/N·S），但步数从 2(N−1) 降到 2·log₂N，特别适合中等消息和大规模。</p>
<p><b>Tree AllReduce</b> 更直接：先做 reduce，所有叶子把数据向上归约到根；再做 broadcast，根把结果向下发给所有叶子。若用二叉树，两步各 log₂N 层，总延迟约 2·log₂N 个 α；代价是根节点要处理全部数据，带宽压力集中。NCCL 的 Tree 算法用“双二叉树”（double binary tree）缓解这一点：构造两棵互补的树，让每张卡在两棵树里承担不同位置，把根的压力摊开。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="8 卡树形 AllReduce：向上归约、向下广播">
<defs>
<marker id="collective-comm-f2-up" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-a)"></path></marker>
<marker id="collective-comm-f2-down" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-b)"></path></marker>
</defs>
<text x="20" y="30" font-size="15" font-family="inherit" fill="var(--sv-a)">① 向上归约（Reduce）</text>
<text x="500" y="30" font-size="15" font-family="inherit" fill="var(--sv-b)">② 向下广播（Broadcast）</text>
<rect x="368" y="45" width="64" height="30" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></rect>
<text x="400" y="65" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">根</text>
<rect x="194" y="120" width="52" height="30" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="220" y="140" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">Σ</text>
<rect x="554" y="120" width="52" height="30" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="580" y="140" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">Σ</text>
<rect x="104" y="200" width="52" height="30" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="130" y="220" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">Σ</text>
<rect x="284" y="200" width="52" height="30" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="310" y="220" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">Σ</text>
<rect x="464" y="200" width="52" height="30" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="490" y="220" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">Σ</text>
<rect x="644" y="200" width="52" height="30" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="670" y="220" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">Σ</text>
<rect x="59" y="285" width="52" height="30" rx="6" fill="var(--sv-a)" fill-opacity="0.18" stroke="var(--sv-line)"></rect>
<text x="85" y="305" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">N0</text>
<rect x="149" y="285" width="52" height="30" rx="6" fill="var(--sv-a)" fill-opacity="0.18" stroke="var(--sv-line)"></rect>
<text x="175" y="305" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">N1</text>
<rect x="239" y="285" width="52" height="30" rx="6" fill="var(--sv-a)" fill-opacity="0.18" stroke="var(--sv-line)"></rect>
<text x="265" y="305" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">N2</text>
<rect x="329" y="285" width="52" height="30" rx="6" fill="var(--sv-a)" fill-opacity="0.18" stroke="var(--sv-line)"></rect>
<text x="355" y="305" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">N3</text>
<rect x="419" y="285" width="52" height="30" rx="6" fill="var(--sv-a)" fill-opacity="0.18" stroke="var(--sv-line)"></rect>
<text x="445" y="305" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">N4</text>
<rect x="509" y="285" width="52" height="30" rx="6" fill="var(--sv-a)" fill-opacity="0.18" stroke="var(--sv-line)"></rect>
<text x="535" y="305" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">N5</text>
<rect x="599" y="285" width="52" height="30" rx="6" fill="var(--sv-a)" fill-opacity="0.18" stroke="var(--sv-line)"></rect>
<text x="625" y="305" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">N6</text>
<rect x="689" y="285" width="52" height="30" rx="6" fill="var(--sv-a)" fill-opacity="0.18" stroke="var(--sv-line)"></rect>
<text x="715" y="305" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">N7</text>
<line x1="82" y1="283" x2="127" y2="232" stroke="var(--sv-a)" stroke-width="1.5" marker-end="url(#collective-comm-f2-up)"></line>
<line x1="136" y1="230" x2="173" y2="283" stroke="var(--sv-b)" stroke-width="1.5" marker-end="url(#collective-comm-f2-down)"></line>
<line x1="172" y1="283" x2="127" y2="232" stroke="var(--sv-a)" stroke-width="1.5" marker-end="url(#collective-comm-f2-up)"></line>
<line x1="136" y1="230" x2="178" y2="283" stroke="var(--sv-b)" stroke-width="1.5" marker-end="url(#collective-comm-f2-down)"></line>
<line x1="262" y1="283" x2="307" y2="232" stroke="var(--sv-a)" stroke-width="1.5" marker-end="url(#collective-comm-f2-up)"></line>
<line x1="316" y1="230" x2="353" y2="283" stroke="var(--sv-b)" stroke-width="1.5" marker-end="url(#collective-comm-f2-down)"></line>
<line x1="352" y1="283" x2="307" y2="232" stroke="var(--sv-a)" stroke-width="1.5" marker-end="url(#collective-comm-f2-up)"></line>
<line x1="316" y1="230" x2="358" y2="283" stroke="var(--sv-b)" stroke-width="1.5" marker-end="url(#collective-comm-f2-down)"></line>
<line x1="442" y1="283" x2="487" y2="232" stroke="var(--sv-a)" stroke-width="1.5" marker-end="url(#collective-comm-f2-up)"></line>
<line x1="496" y1="230" x2="533" y2="283" stroke="var(--sv-b)" stroke-width="1.5" marker-end="url(#collective-comm-f2-down)"></line>
<line x1="532" y1="283" x2="487" y2="232" stroke="var(--sv-a)" stroke-width="1.5" marker-end="url(#collective-comm-f2-up)"></line>
<line x1="496" y1="230" x2="538" y2="283" stroke="var(--sv-b)" stroke-width="1.5" marker-end="url(#collective-comm-f2-down)"></line>
<line x1="622" y1="283" x2="667" y2="232" stroke="var(--sv-a)" stroke-width="1.5" marker-end="url(#collective-comm-f2-up)"></line>
<line x1="676" y1="230" x2="713" y2="283" stroke="var(--sv-b)" stroke-width="1.5" marker-end="url(#collective-comm-f2-down)"></line>
<line x1="712" y1="283" x2="667" y2="232" stroke="var(--sv-a)" stroke-width="1.5" marker-end="url(#collective-comm-f2-up)"></line>
<line x1="676" y1="230" x2="718" y2="283" stroke="var(--sv-b)" stroke-width="1.5" marker-end="url(#collective-comm-f2-down)"></line>
<line x1="127" y1="198" x2="217" y2="152" stroke="var(--sv-a)" stroke-width="1.5" marker-end="url(#collective-comm-f2-up)"></line>
<line x1="224" y1="150" x2="136" y2="198" stroke="var(--sv-b)" stroke-width="1.5" marker-end="url(#collective-comm-f2-down)"></line>
<line x1="313" y1="198" x2="223" y2="152" stroke="var(--sv-a)" stroke-width="1.5" marker-end="url(#collective-comm-f2-up)"></line>
<line x1="224" y1="150" x2="323" y2="198" stroke="var(--sv-b)" stroke-width="1.5" marker-end="url(#collective-comm-f2-down)"></line>
<line x1="487" y1="198" x2="577" y2="152" stroke="var(--sv-a)" stroke-width="1.5" marker-end="url(#collective-comm-f2-up)"></line>
<line x1="584" y1="150" x2="496" y2="198" stroke="var(--sv-b)" stroke-width="1.5" marker-end="url(#collective-comm-f2-down)"></line>
<line x1="673" y1="198" x2="583" y2="152" stroke="var(--sv-a)" stroke-width="1.5" marker-end="url(#collective-comm-f2-up)"></line>
<line x1="584" y1="150" x2="683" y2="198" stroke="var(--sv-b)" stroke-width="1.5" marker-end="url(#collective-comm-f2-down)"></line>
<line x1="217" y1="118" x2="397" y2="77" stroke="var(--sv-a)" stroke-width="1.5" marker-end="url(#collective-comm-f2-up)"></line>
<line x1="403" y1="75" x2="226" y2="118" stroke="var(--sv-b)" stroke-width="1.5" marker-end="url(#collective-comm-f2-down)"></line>
<line x1="583" y1="118" x2="403" y2="77" stroke="var(--sv-a)" stroke-width="1.5" marker-end="url(#collective-comm-f2-up)"></line>
<line x1="403" y1="75" x2="594" y2="118" stroke="var(--sv-b)" stroke-width="1.5" marker-end="url(#collective-comm-f2-down)"></line>
<text x="380" y="350" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">8 卡时 Ring 需 2(N−1)=14 步；Tree 约 2·log₂N=6 步，代价是上层节点承担更多流量</text>
</svg><figcaption>图 2 · 8 卡树形 AllReduce：向上 3 层归约到根，再向下 3 层广播；总延迟约 2·log₂N 步，少于 ring 的 2(N−1) 步。</figcaption></figure>
<p>如何选？一个工程化的判断是：消息很小（几十 KB 到几 MB）、rank 数很大时，延迟主导，tree 或 RH-D 更优；消息很大（几十 MB 以上）时，带宽主导，ring 的均匀带宽更难被打败；如果硬件支持 NVLS/SHARP，则优先把归约卸载到交换机。NCCL 会根据规模、消息大小与拓扑在 ring、tree 以及可用的 NVLS/CollNet 之间自动选择，也可用 <code>NCCL_ALGO</code> 强制指定做对照实验。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>不要凭“树一定比环快”下结论。Tree 中每个内部节点要向下转发给多个子节点，非根节点还要向上发送一份归约结果，出口流量可达 (k+1)S（k 为子节点数）；在带宽受限的跨机链路上可能比 ring 慢。正确做法是固定消息大小与拓扑，分别用 nccl-tests 测 algbw 与 busbw 再决定。</div></div>
</section>
<section class="sec">
<h2>拓扑感知：NCCL 如何“看见”你的机器</h2>
<p>同样一次 AllReduce，走在 NVLink 上还是走在 PCIe、走在本机还是跨 IB，性能可以差一个数量级。NCCL 启动时会构造一张拓扑图：通过 NVML 识别 GPU 与 NVSwitch，通过 PCI 配置空间识别 GPU、网卡、CPU 之间的 PCIe 树与 NUMA 归属，通过 IB verbs 枚举 IB 网卡及其端口。然后它在这张图上搜索带宽最高、跳数最低的 ring 或 tree 路径，这就是<mark>拓扑感知</mark>（topology-aware）。</p>
<p>典型的层级是：单机内 GPU 经 NVLink 4 互联（H100 SXM 每 GPU 双向 900 GB/s，单向约 450 GB/s），跨 PCIe Gen5 x16 时单向只有约 64 GB/s，跨机经 InfiniBand NDR 400 Gb/s 时每端口约 50 GB/s 单向。NCCL 会尽量让 ring 的连续跳留在 NVLink 域内，只在必要时跨网卡；如果它发现某条路只能走 PCIe 或 socket，会在日志里明确写出来。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="NCCL 拓扑：节点内 NVLink、GPU 到网卡的 PCIe、节点间 IB">
<defs>
<marker id="collective-comm-f3-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-b)"></path></marker>
</defs>
<rect x="20" y="60" width="340" height="210" rx="10" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<rect x="400" y="60" width="340" height="210" rx="10" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="190" y="82" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">节点 0（4×H100）</text>
<text x="570" y="82" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">节点 1（4×H100）</text>
<line x1="85" y1="140" x2="175" y2="140" stroke="var(--sv-a)" stroke-width="3"></line>
<line x1="85" y1="225" x2="175" y2="225" stroke="var(--sv-a)" stroke-width="3"></line>
<line x1="85" y1="140" x2="85" y2="225" stroke="var(--sv-a)" stroke-width="3"></line>
<line x1="175" y1="140" x2="175" y2="225" stroke="var(--sv-a)" stroke-width="3"></line>
<circle cx="85" cy="140" r="24" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></circle>
<text x="85" y="145" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">0</text>
<circle cx="175" cy="140" r="24" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></circle>
<text x="175" y="145" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">1</text>
<circle cx="85" cy="225" r="24" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></circle>
<text x="85" y="230" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">2</text>
<circle cx="175" cy="225" r="24" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></circle>
<text x="175" y="230" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">3</text>
<line x1="465" y1="140" x2="555" y2="140" stroke="var(--sv-a)" stroke-width="3"></line>
<line x1="465" y1="225" x2="555" y2="225" stroke="var(--sv-a)" stroke-width="3"></line>
<line x1="465" y1="140" x2="465" y2="225" stroke="var(--sv-a)" stroke-width="3"></line>
<line x1="555" y1="140" x2="555" y2="225" stroke="var(--sv-a)" stroke-width="3"></line>
<circle cx="465" cy="140" r="24" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></circle>
<text x="465" y="145" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">4</text>
<circle cx="555" cy="140" r="24" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></circle>
<text x="555" y="145" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">5</text>
<circle cx="465" cy="225" r="24" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></circle>
<text x="465" y="230" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">6</text>
<circle cx="555" cy="225" r="24" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></circle>
<text x="555" y="230" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">7</text>
<text x="130" y="112" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">NVLink 4</text>
<text x="510" y="112" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">NVLink 4</text>
<line x1="199" y1="215" x2="266" y2="190" stroke="var(--sv-muted)" stroke-width="1.5" stroke-dasharray="4 3"></line>
<text x="232" y="215" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">PCIe</text>
<line x1="579" y1="215" x2="646" y2="190" stroke="var(--sv-muted)" stroke-width="1.5" stroke-dasharray="4 3"></line>
<text x="612" y="215" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">PCIe</text>
<rect x="268" y="165" width="60" height="38" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="298" y="183" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">NIC</text>
<text x="298" y="196" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">400G</text>
<rect x="648" y="165" width="60" height="38" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="678" y="183" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">NIC</text>
<text x="678" y="196" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">400G</text>
<rect x="352" y="140" width="48" height="70" rx="5" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-width="2"></rect>
<text x="376" y="180" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">IB</text>
<text x="376" y="128" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">IB 交换机</text>
<line x1="328" y1="184" x2="352" y2="178" stroke="var(--sv-b)" stroke-width="2" marker-end="url(#collective-comm-f3-arrow)"></line>
<line x1="648" y1="184" x2="400" y2="178" stroke="var(--sv-b)" stroke-width="2" marker-end="url(#collective-comm-f3-arrow)"></line>
<rect x="20" y="300" width="230" height="36" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="135" y="323" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">NVLink 4：900 GB/s 双向/GPU</text>
<rect x="265" y="300" width="230" height="36" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="380" y="323" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">PCIe Gen5 x16：128 GB/s 双向</text>
<rect x="510" y="300" width="230" height="36" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="625" y="323" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">IB NDR：≈50 GB/s 单向/口</text>
<text x="380" y="362" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">NCCL 尽量把 ring 的相邻跳留在 NVLink 域内，只在必要时跨 IB</text>
</svg><figcaption>图 3 · NCCL 眼中的拓扑：节点内 NVLink、GPU 到网卡的 PCIe、节点间 IB；路径选择直接决定 AllReduce 的有效带宽。</figcaption></figure>
<p>这也解释了“网卡亲和性”为什么重要：如果 GPU 与网卡挂在不同的 PCIe switch 或不同 NUMA 节点上，数据要先绕 CPU 互联，带宽和延迟都会变差。NCCL 提供 <code>NCCL_IB_HCA</code> 指定使用哪些网卡、<code>NCCL_SOCKET_IFNAME</code> 指定 socket 走哪张网卡、<code>NCCL_NET_GDR_LEVEL</code> 控制 GPUDirect RDMA 的生效层级；多网卡机器上把不相关的网卡排除掉，往往比调算法更有效。</p>
<p>算法与协议的选择同样受拓扑和消息大小影响。<code>NCCL_ALGO</code> 可取 Ring、Tree、CollnetDirect/CollnetChain（SHARP 卸载）、NVLS（NVLink 多播归约）；<code>NCCL_PROTO</code> 可取 LL、LL128、Simple，分别针对低延迟小包、低延迟中等包和高带宽大包。默认值由 NCCL 根据规模、拓扑和消息大小自动选择，通常不要手动改；只有做 A/B 或确认路径异常时才强制指定。</p>
</section>
<section class="sec">
<h2>把通信藏起来：NVLS、SHARP 与计算重叠</h2>
<p>硬件卸载是第一条路。<b>NVLS</b>（NVLink SHARP）利用 Hopper 与 NVSwitch 的多播归约能力：数据沿 NVLink 送到交换机，由交换机完成求和再广播回来，GPU 的 SM 与拷贝引擎不必参与逐跳累加。它特别适合单机 8 卡内的 AllReduce，能减少 GPU 侧的指令与寄存器压力。<b>SHARP</b> 则把同样的思路搬到 InfiniBand 交换机：支持 SHARP 的交换机在网内完成聚合：主机把本地数据交给交换机，交换机算完后把结果分发回来，跨节点 AllReduce 的流量随之下降。两者都需要硬件与驱动支持，且对消息大小与聚合树形状敏感，并非打开就更快。</p>
<p>第二条路是<mark>计算通信重叠</mark>（communication-computation overlap）。DDP 用 bucket 把梯度 AllReduce 藏进反向传播，具体机制见 data-parallel 一篇；FSDP 则在反向时对梯度做 ReduceScatter、对下一层参数做 AllGather 预取。理想情况下，通信被计算完全盖住，端到端只多出“最后一个桶”的尾巴。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="串行同步与分桶重叠的甘特图对比">
<defs>
<marker id="collective-comm-f4-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-ink)"></path></marker>
</defs>
<text x="20" y="32" font-size="13" font-family="inherit" fill="var(--sv-muted)">按逆向层序 L4 → L1 展示；方块宽度为相对时间，非真实毫秒</text>
<text x="8" y="120" font-size="13" font-family="inherit" fill="var(--sv-ink)">串行</text>
<rect x="80" y="90" width="75" height="48" rx="3" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
<text x="117" y="119" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">C4</text>
<rect x="155" y="90" width="75" height="48" rx="3" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
<text x="192" y="119" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-bg)">AR</text>
<rect x="230" y="90" width="75" height="48" rx="3" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
<text x="267" y="119" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">C3</text>
<rect x="305" y="90" width="75" height="48" rx="3" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
<text x="342" y="119" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-bg)">AR</text>
<rect x="380" y="90" width="75" height="48" rx="3" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
<text x="417" y="119" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">C2</text>
<rect x="455" y="90" width="75" height="48" rx="3" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
<text x="492" y="119" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-bg)">AR</text>
<rect x="530" y="90" width="75" height="48" rx="3" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
<text x="567" y="119" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">C1</text>
<rect x="605" y="90" width="75" height="48" rx="3" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
<text x="642" y="119" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-bg)">AR</text>
<text x="8" y="230" font-size="13" font-family="inherit" fill="var(--sv-ink)">分桶重叠</text>
<rect x="80" y="195" width="75" height="48" rx="3" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
<text x="117" y="224" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">C4</text>
<rect x="155" y="195" width="75" height="48" rx="3" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
<text x="192" y="224" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">C3</text>
<rect x="230" y="195" width="75" height="48" rx="3" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
<text x="267" y="224" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">C2</text>
<rect x="305" y="195" width="75" height="48" rx="3" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
<text x="342" y="224" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">C1</text>
<rect x="160" y="250" width="65" height="20" rx="3" fill="var(--sv-b)" fill-opacity="0.55" stroke="var(--sv-line)"></rect>
<text x="192" y="264" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">AR1 隐藏</text>
<rect x="235" y="250" width="65" height="20" rx="3" fill="var(--sv-b)" fill-opacity="0.55" stroke="var(--sv-line)"></rect>
<text x="267" y="264" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">AR2 隐藏</text>
<rect x="310" y="250" width="65" height="20" rx="3" fill="var(--sv-b)" fill-opacity="0.55" stroke="var(--sv-line)"></rect>
<text x="342" y="264" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">AR3 隐藏</text>
<rect x="380" y="195" width="75" height="48" rx="3" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
<text x="417" y="216" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-bg)">尾桶</text>
<text x="417" y="232" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-bg)">暴露</text>
<line x1="80" y1="300" x2="700" y2="300" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#collective-comm-f4-arrow)"></line>
<text x="690" y="320" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-muted)">时间 →</text>
<text x="480" y="285" font-size="12" font-family="inherit" fill="var(--sv-muted)">总时间由 600 降到 375（相对值，示意）</text>
</svg><figcaption>图 4 · 串行同步与分桶重叠的对比（相对时间，非真实毫秒）：重叠把大部分通信藏进反向计算，只暴露最后一个桶的尾巴。</figcaption></figure>
<p>但重叠有前提：通信不能明显抢占计算资源。Ring 的拷贝会占用 SM 与显存带宽，NVLS/SHARP 能把这部分开销移出 GPU；张量并行的 AllReduce 夹在层与层之间，可重叠窗口很窄，往往只能硬扛。可以用一个粗粒度模型判断收益：</p>
<div class="formula">T_step ≈ T_compute + max(0, T_comm − T_overlap)，其中 T_overlap ≤ T_compute</div>
<p>如果 T_comm 已经小于可重叠的计算窗口，继续优化通信算法收益有限，应该先看计算或数据加载；反之，若 T_comm 明显超出窗口，优先考虑提高链路带宽、换 NVLS/SHARP，或减少通信次数（例如增大 bucket、合并小 tensor）。这也是为什么“通信占比”必须实测，而不能只看理论通信量。</p>
</section>
<section class="sec">
<h2>带宽效率：公式、口径与规模曲线</h2>
<p>厂商标称的是链路峰值，训练关心的是集合通信吞吐，两者之间隔着算法、协议、消息大小和拓扑。nccl-tests 报两个数：<code>algbw</code>（算法带宽，S/t，把一次 AllReduce 当成搬运 S 字节）和 <code>busbw</code>（总线带宽，按 ring 的实际发送量折算）。二者关系是：</p>
<div class="formula">busbw = algbw × 2(N−1)/N<br>η = busbw / B_peak</div>
<p>其中 B_peak 是该路径的单向峰值带宽（例如 NVLink 4 约 450 GB/s 单向、IB NDR 单口约 50 GB/s）。η 就是<mark>带宽效率</mark>：它把“算法多用了多少倍流量”和“链路跑得多满”分开，便于横向比较。看 nccl-tests 时先看 busbw 是否接近峰值，再看 algbw 随消息大小的曲线，可区分“链路不行”和“算法或延迟不行”。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="每卡发送量随 rank 数变化的曲线">
<defs>
<marker id="collective-comm-f5-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-ink)"></path></marker>
</defs>
<line x1="80" y1="320" x2="720" y2="320" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#collective-comm-f5-arrow)"></line>
<line x1="80" y1="320" x2="80" y2="80" stroke="var(--sv-ink)" stroke-width="1.5" marker-end="url(#collective-comm-f5-arrow)"></line>
<line x1="80" y1="265" x2="700" y2="265" stroke="var(--sv-muted)" stroke-width="1" stroke-dasharray="4 4"></line>
<line x1="80" y1="210" x2="700" y2="210" stroke="var(--sv-muted)" stroke-width="1" stroke-dasharray="4 4"></line>
<line x1="80" y1="155" x2="700" y2="155" stroke="var(--sv-muted)" stroke-width="1" stroke-dasharray="4 4"></line>
<line x1="80" y1="100" x2="700" y2="100" stroke="var(--sv-b)" stroke-width="1.5" stroke-dasharray="6 4"></line>
<text x="70" y="324" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-muted)">0</text>
<text x="70" y="269" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-muted)">0.5</text>
<text x="70" y="214" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-muted)">1.0</text>
<text x="70" y="159" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-muted)">1.5</text>
<text x="70" y="104" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-muted)">2.0</text>
<text x="80" y="340" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">2</text>
<text x="204" y="340" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">4</text>
<text x="328" y="340" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">8</text>
<text x="452" y="340" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">16</text>
<text x="576" y="340" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">32</text>
<text x="700" y="340" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">64</text>
<text x="400" y="368" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">rank 数 N（对数刻度）</text>
<text transform="rotate(-90 26 220)" x="26" y="220" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">每卡发送量 / S</text>
<polyline points="80,210 204,155 328,127 452,114 576,107 700,103" fill="none" stroke="var(--sv-a)" stroke-width="3"></polyline>
<circle cx="80" cy="210" r="4" fill="var(--sv-a)"></circle>
<circle cx="204" cy="155" r="4" fill="var(--sv-a)"></circle>
<circle cx="328" cy="127" r="4" fill="var(--sv-a)"></circle>
<circle cx="452" cy="114" r="4" fill="var(--sv-a)"></circle>
<circle cx="576" cy="107" r="4" fill="var(--sv-a)"></circle>
<circle cx="700" cy="103" r="4" fill="var(--sv-a)"></circle>
<text x="80" y="200" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">1.00</text>
<text x="204" y="145" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">1.50</text>
<text x="328" y="117" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">1.75</text>
<text x="452" y="104" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">1.88</text>
<text x="576" y="97" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">1.94</text>
<text x="700" y="93" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">1.97</text>
<text x="640" y="118" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-b)">2S 上界</text>
<rect x="395" y="160" width="300" height="70" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="410" y="184" font-size="12" font-family="inherit" fill="var(--sv-ink)">N≥8 后每卡发送量趋近 2S，增长趋缓；</text>
<text x="410" y="206" font-size="12" font-family="inherit" fill="var(--sv-ink)">但全网总流量 = 2(N−1)S，随 N 线性增长。</text>
</svg><figcaption>图 5 · 每卡发送量随 rank 数的变化：2(N−1)/N·S 迅速饱和到 2S，但全网总流量仍随 N 线性增长。</figcaption></figure>
<p>规模趋势也在这里体现。每卡发送量 2(N−1)/N·S 很快饱和在 2S，看起来“加卡不涨通信量”；但全网总流量是 2(N−1)S，随 N 线性增长，而每条链路的带宽是固定的，步数也随 N 增长。所以大规模训练的真实瓶颈通常是“总流量除以可用带宽”和“层数乘以步数”的延迟，而不是单卡发送量。分层通信（先在节点内归约、再跨节点）、SHARP 网内聚合，以及 rail-optimized 网络，都是围绕这两项做文章。</p>
<p>给一个可复现的口径：8×H100 SXM、单机 NVLink 域、1 GB 消息时，busbw 通常达数百 GB/s 量级；两台各 4 卡、每节点 1 个 400 Gb/s 端口时，跨机 busbw 的上限由节点间链路带宽决定（此处为单个 400 Gb/s 端口），实测约为端口峰值的七到八成，随 NCCL 版本与消息大小变化。精确数字必须附设备型号、消息大小和 NCCL 版本，否则不可比。</p>
</section>
<section class="sec">
<h2>排障手册与自测</h2>
<p>通信慢的根因通常有四类：路径不对（该走 IB 却走了 socket 或 PCIe）、算法不合适（小消息用 ring、大消息用 tree）、并行度与网卡不匹配（多网卡只用了其中一张）、以及同步问题（rank 调用顺序不一致导致 hang 或长尾）。下面这组命令覆盖了大部分现场排查。</p>
<pre class="code" data-lang="bash"><code># 1) 看机器拓扑：GPU、NVLink、网卡、NUMA 的对应关系
nvidia-smi topo -m

# 2) 打开 NCCL 初始化与网络日志，确认走了 P2P 还是 NET/IB
export NCCL_DEBUG=INFO
export NCCL_DEBUG_SUBSYS=INIT,NET,GRAPH

# 3) 明确指定网卡与协议，排除选错设备
export NCCL_IB_HCA=mlx5_0,mlx5_1
export NCCL_SOCKET_IFNAME=eth0
export NCCL_NET_GDR_LEVEL=PHB

# 4) 导出拓扑图，核对 NCCL 眼中的路径
export NCCL_TOPO_DUMP_FILE=/tmp/nccl-topo.xml

# 5) 用 nccl-tests 量 busbw，逐步放大消息看拐点
./build/all_reduce_perf -b 8 -e 8G -f 2 -g 8</code></pre>
<p>读日志时抓几个关键词：<code>via P2P/direct pointer</code> 或 <code>via P2P/CUMEM</code> 表示 GPU 间走了 NVLink 或 PCIe 直连；<code>via NET/IB</code> 表示走了 IB；如果跨机却出现 <code>via NET/Socket</code>，基本可以判定 IB 没启用或网卡选错。容器环境还要确认 IB 设备与共享内存已正确挂载，否则 NCCL 会静默降级到 socket，性能直接掉一个数量级。</p>
<ol>
<li>先用 nvidia-smi topo -m 和 NCCL_DEBUG=INFO 确认路径，别急着调算法。</li>
<li>用 nccl-tests 固定消息大小测 busbw，和峰值对比，判断是链路问题还是延迟问题。</li>
<li>小消息慢换 tree 或 RH-D，大消息慢查带宽、网卡亲和性与 PCIe 拓扑。</li>
<li>出现 hang 先查所有 rank 的调用顺序、count、datatype 是否一致，再看超时与网络。</li>
</ol>
<p>最后两个误区：其一，把厂商标称带宽当吞吐，900 GB/s 是双向聚合值，单向约 450 GB/s，再乘带宽效率才是可期望的 busbw；其二，看到“加卡后每卡通信量不变”就以为通信不是瓶颈，总流量与步数都在涨，必须看端到端 step time。</p>
<details class="quiz"><summary>Q1 · 8 卡 ring AllReduce，总数据量 S = 1 GB，每张卡发送多少？全网总流量多少？</summary><div class="quiz__a">V = 2(N−1)/N·S = 2×7/8×1 GB = 1.75 GB；全网总流量 = 8×1.75 GB = 14 GB = 2(N−1)S。注意 1.75 GB 是发送量，接收量对称，链路上双向各约 1.75 GB。</div></details>
<details class="quiz"><summary>Q2 · 为什么 N 从 8 增到 64，每卡发送量只从 1.75S 涨到 1.97S，训练却可能明显变慢？</summary><div class="quiz__a">每卡发送量饱和不代表总成本不变。全网总流量 2(N−1)S 随 N 线性增长，而链路带宽固定；ring 步数 2(N−1) 随 N 增长，延迟项累积；跨机后每跳带宽从 NVLink 的数百 GB/s 降到 IB 的几十 GB/s；再加上 straggler 的长尾。要同时看总流量、步数和拓扑层级，不能只盯单卡通信量。</div></details>
<details class="quiz"><summary>Q3 · NCCL_DEBUG=INFO 里跨机通信显示 via NET/Socket，说明什么？怎么查？</summary><div class="quiz__a">说明 NCCL 没走 IB/RDMA，回退到 TCP socket，带宽和延迟都会差一个量级。依次检查：NCCL_IB_HCA 是否包含正确网卡；容器是否挂载了 IB 设备；NCCL_SOCKET_IFNAME 是否指向业务网卡；驱动、固件与 NCCL 版本是否匹配；再用 nvidia-smi topo -m 确认 GPU 与网卡的 PCIe 亲和性。</div></details>
<details class="quiz"><summary>Q4 · 32 卡、消息 64 KB 的 AllReduce，你优先选 ring 还是 tree？为什么？</summary><div class="quiz__a">小消息由延迟主导。ring 需要 2(N−1)=62 步，tree 约 2·log₂N=10 步，α 的累积差距明显；64 KB 下带宽项很小，ring 的带宽优势发挥不出来。优先 tree（NVLS 只适用于单机 NVLink 域；跨节点若交换机支持 SHARP，可再评估 CollNet 卸载），并用 nccl-tests 固定消息大小验证。</div></details>
<ul class="refs">
<li><b>Bringing HPC Techniques to Deep Learning</b> — Andrew Gibiansky, Baidu Research, 2017。ring AllReduce 两阶段与 2(N−1)/N·S 通信量的经典工程说明，也是 NCCL ring 思路的通俗来源。</li>
<li><b>NVIDIA NCCL Documentation 与 User Guide</b> — NVIDIA，持续更新。算法、协议、环境变量与拓扑行为的权威说明。</li>
<li><b>MPI: A Message-Passing Interface Standard（MPI 4.1）</b> — MPI Forum, 2023。八种集合原语的语义与一致性要求的原始定义。</li>
<li><b>NVIDIA SHARP Documentation</b> — NVIDIA。InfiniBand 网内聚合的部署方式与限制。</li>
<li><b>nccl-tests</b> — NVIDIA, GitHub。all_reduce_perf 等基准，algbw 与 busbw 口径的实测工具。</li>
</ul>
</section>`
};
