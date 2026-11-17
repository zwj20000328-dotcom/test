window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["large-scale-training"] = {
  slug: "large-scale-training",
  title: "3D 并行与万卡训练工程",
  subtitle: "从能跑到跑得快、跑得稳",
  level: 3,
  cluster: "训练",
  tags: ["3D Parallel", "MFU", "训练稳定性", "Checkpoint"],
  summary: "从 3D 并行的组合约束讲起，拆解 MFU 与吞吐估算，给出 loss spike、checkpoint 与弹性训练的工程做法，并用两个千卡到万卡级案例说明取舍。",
  keyPoints: [
    "总卡数 = TP × PP × DP；TP 必须留在 NVLink 域内，PP 与层数、DP 与全局 batch 互相牵制",
    "MFU = 6N × TPS / (G × 峰值)，稠密大模型实测多在 35%-45%，LLaMA-3 405B 在 16K 卡上约 38%",
    "PP 气泡约为 (p-1)/(m+p-1)，交错式流水用虚拟级数 v 把它压到 (p-1)/(v×m+p-1)",
    "loss spike 优先查数据与数值：z-loss、裁剪前梯度范数、Adam eps 与 update/param",
    "checkpoint 间隔约 √(2C/λ)，异步保存把阻塞压到秒级；弹性扩缩容必须保持全局 batch 不变"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec"><h2>万卡之后，问题变了</h2>
<p>先给一个量级：LLaMA-3 405B 的训练计算量约 3.8 × 10²⁵ FLOPs。单张 H100 SXM 的 BF16 稠密峰值约 989 TFLOPS，即便按 40% 的利用率，一张卡也要跑约 3000 年；换成 16384 张卡，理想线性加速才把墙钟时间压到约 68 天。这就是万卡训练的全部动机：<mark>不是单卡变快，而是把单卡不可能完成的事拆到可完成的时间尺度</mark>。</p>
<p>但把卡插上只是开始。规模上去后，系统同时被三件事卡住：显存放不下，用并行切分解决；算力用不满，这是 MFU 问题；跑着跑着就坏，这是稳定性与故障恢复问题。并行原语本身已经在《数据并行与梯度同步》等篇讲过，本篇不再重复定义，只讲它们如何组合、组合有哪些硬约束，以及组合之后怎样把 30%-50% 的峰值真正拿到手。</p>
<p>一个常见的误判是“卡越多越快”。从 1024 卡到 16384 卡，聚合算力涨 16 倍，但通信跳数、故障概率、负载不均也一起涨。工程目标不是峰值利用率，而是 <mark>goodput</mark>：单位墙钟时间里真正推进了多少 token，并且这些 token 不会因为一次故障被回滚掉。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>把 3D 并行想成一栋楼：TP 是同一层几个人合力搬一张桌子，必须站在同一间屋，也就是同一个 NVLink 域；PP 是楼上楼下传件，走得慢但传得少；DP 是很多栋楼各干一份，最后统一对账。桌子不能拆到两栋楼，传件也不能每一步都传整张桌子。</div></div>
</section>

<section class="sec"><h2>3D 网格：先定拓扑，再定并行度</h2>
<p>把张量并行（tensor parallelism，TP）、流水线并行（pipeline parallelism，PP）、数据并行（data parallelism，DP）想成三个正交坐标轴。总卡数 G = TP × PP × DP；如果叠加上下文并行（context parallelism，CP）或专家并行（expert parallelism，EP），还要乘上对应维度。每个 rank 都能写成 (dp, pp, tp) 三元组。真正决定性能的不是这三个数字本身，而是<mark>哪个维度被映射到哪一级物理拓扑</mark>。</p>
<div class="formula">G = N_TP × N_PP × N_DP　　rank = ((dp × N_PP) + pp) × N_TP + tp</div>
<p>第一条硬约束是 TP 不能跨 NVLink 域。张量并行在每一层的前向和反向都要做 all-reduce，通信频繁且对延迟敏感；一旦跨到 InfiniBand，单次集合通信的延迟从微秒级涨到几十微秒，带宽也从数百 GB/s 掉到 25-50 GB/s 量级，TP 的收益会被通信吃光。DGX H100 的一个 NVLink 域是 8 卡，每卡 NVLink 4 双向约 900 GB/s，所以 TP 通常取 4 或 8；GB200 NVL72 把域扩到 72 卡，TP 才有更大的空间，代价是整机柜成为更大的故障域。</p>
<p>第二条是 PP 与层数。理想情况下层数 L 能被 PP 级数整除，且每级计算量均衡；使用交错式流水（interleaved 1F1B）时，还要求 L 能被 PP × 虚拟级数 v 整除。现实中不必强求：LLaMA-3 405B 有 126 层、PP 取 16，DeepSeek-V3 有 61 层、PP 也取 16，都无法整除，框架用不等分或把 embedding/loss 单独占一级来吸收。但不等分会带来 stage 间等待，<b>自研配置时优先选能整除的组合</b>。</p>
<p>第三条是 DP 与全局 batch。全局 batch 的 token 数 B = b_micro × s × a × N_DP，其中 b_micro 是每个 DP 副本的 micro-batch（按序列数计），s 是序列长度，a 是梯度累积步数。改 DP 而不改 a，B 会跟着变，等效学习率与 warmup 都要重调；反过来，扩缩容时保持 B 不变、只调 a，是弹性训练的基本纪律。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="3D 并行网格：TP 在 NVLink 域内，PP 与 DP 跨节点">
  <text x="20" y="22" font-size="15" fill="var(--sv-ink)" font-family="inherit">3D 网格映射：TP 最内、PP 次之、DP 最外</text>
  <text x="20" y="48" font-size="12" fill="var(--sv-muted)" font-family="inherit">一个 NVLink 域 = 8 卡，承载 TP=8 的全部 all-reduce</text>
  <rect x="120" y="56" width="600" height="10" rx="4" fill="var(--sv-a2)"/>
  <text x="420" y="52" font-size="11" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">NVSwitch（双向约 900 GB/s/卡）</text>
  <line x1="161" y1="66" x2="161" y2="72" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="235" y1="66" x2="235" y2="72" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="309" y1="66" x2="309" y2="72" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="383" y1="66" x2="383" y2="72" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="457" y1="66" x2="457" y2="72" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="531" y1="66" x2="531" y2="72" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="605" y1="66" x2="605" y2="72" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="679" y1="66" x2="679" y2="72" stroke="var(--sv-line)" stroke-width="1"/>
  <rect x="131" y="72" width="60" height="24" fill="var(--sv-a)"/>
  <text x="161" y="88" font-size="11" fill="var(--sv-bg)" text-anchor="middle" font-family="inherit">TP0</text>
  <rect x="205" y="72" width="60" height="24" fill="var(--sv-a)"/>
  <text x="235" y="88" font-size="11" fill="var(--sv-bg)" text-anchor="middle" font-family="inherit">TP1</text>
  <rect x="279" y="72" width="60" height="24" fill="var(--sv-a)"/>
  <text x="309" y="88" font-size="11" fill="var(--sv-bg)" text-anchor="middle" font-family="inherit">TP2</text>
  <rect x="353" y="72" width="60" height="24" fill="var(--sv-a)"/>
  <text x="383" y="88" font-size="11" fill="var(--sv-bg)" text-anchor="middle" font-family="inherit">TP3</text>
  <rect x="427" y="72" width="60" height="24" fill="var(--sv-a)"/>
  <text x="457" y="88" font-size="11" fill="var(--sv-bg)" text-anchor="middle" font-family="inherit">TP4</text>
  <rect x="501" y="72" width="60" height="24" fill="var(--sv-a)"/>
  <text x="531" y="88" font-size="11" fill="var(--sv-bg)" text-anchor="middle" font-family="inherit">TP5</text>
  <rect x="575" y="72" width="60" height="24" fill="var(--sv-a)"/>
  <text x="605" y="88" font-size="11" fill="var(--sv-bg)" text-anchor="middle" font-family="inherit">TP6</text>
  <rect x="649" y="72" width="60" height="24" fill="var(--sv-a)"/>
  <text x="679" y="88" font-size="11" fill="var(--sv-bg)" text-anchor="middle" font-family="inherit">TP7</text>
  <text x="20" y="122" font-size="12" fill="var(--sv-muted)" font-family="inherit">PP × DP（16 级 × 128 副本，此处画 8 列示意）</text>
  <text x="179" y="136" font-size="10" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">DP0</text>
  <text x="247" y="136" font-size="10" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">DP1</text>
  <text x="315" y="136" font-size="10" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">DP2</text>
  <text x="383" y="136" font-size="10" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">DP3</text>
  <text x="451" y="136" font-size="10" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">DP4</text>
  <text x="519" y="136" font-size="10" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">DP5</text>
  <text x="587" y="136" font-size="10" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">DP6</text>
  <text x="655" y="136" font-size="10" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">DP7</text>
  <text x="140" y="149" font-size="9" fill="var(--sv-muted)" text-anchor="end" font-family="inherit">PP0</text>
  <text x="140" y="161" font-size="9" fill="var(--sv-muted)" text-anchor="end" font-family="inherit">PP1</text>
  <text x="140" y="173" font-size="9" fill="var(--sv-muted)" text-anchor="end" font-family="inherit">PP2</text>
  <text x="140" y="185" font-size="9" fill="var(--sv-muted)" text-anchor="end" font-family="inherit">PP3</text>
  <text x="140" y="197" font-size="9" fill="var(--sv-muted)" text-anchor="end" font-family="inherit">PP4</text>
  <text x="140" y="209" font-size="9" fill="var(--sv-muted)" text-anchor="end" font-family="inherit">PP5</text>
  <text x="140" y="221" font-size="9" fill="var(--sv-muted)" text-anchor="end" font-family="inherit">PP6</text>
  <text x="140" y="233" font-size="9" fill="var(--sv-muted)" text-anchor="end" font-family="inherit">PP7</text>
  <text x="140" y="245" font-size="9" fill="var(--sv-muted)" text-anchor="end" font-family="inherit">PP8</text>
  <text x="140" y="257" font-size="9" fill="var(--sv-muted)" text-anchor="end" font-family="inherit">PP9</text>
  <text x="140" y="269" font-size="9" fill="var(--sv-muted)" text-anchor="end" font-family="inherit">PP10</text>
  <text x="140" y="281" font-size="9" fill="var(--sv-muted)" text-anchor="end" font-family="inherit">PP11</text>
  <text x="140" y="293" font-size="9" fill="var(--sv-muted)" text-anchor="end" font-family="inherit">PP12</text>
  <text x="140" y="305" font-size="9" fill="var(--sv-muted)" text-anchor="end" font-family="inherit">PP13</text>
  <text x="140" y="317" font-size="9" fill="var(--sv-muted)" text-anchor="end" font-family="inherit">PP14</text>
  <text x="140" y="329" font-size="9" fill="var(--sv-muted)" text-anchor="end" font-family="inherit">PP15</text>
  <rect x="150" y="140" width="534" height="189" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
  <rect x="150" y="140" width="58" height="189" fill="var(--sv-b)"/>
  <rect x="150" y="140" width="534" height="9" fill="var(--sv-a2)"/>
  <rect x="150" y="140" width="58" height="9" fill="var(--sv-c)"/>
  <line x1="150" y1="152" x2="684" y2="152" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="150" y1="164" x2="684" y2="164" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="150" y1="176" x2="684" y2="176" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="150" y1="188" x2="684" y2="188" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="150" y1="200" x2="684" y2="200" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="150" y1="212" x2="684" y2="212" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="150" y1="224" x2="684" y2="224" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="150" y1="236" x2="684" y2="236" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="150" y1="248" x2="684" y2="248" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="150" y1="260" x2="684" y2="260" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="150" y1="272" x2="684" y2="272" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="150" y1="284" x2="684" y2="284" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="150" y1="296" x2="684" y2="296" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="150" y1="308" x2="684" y2="308" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="150" y1="320" x2="684" y2="320" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="218" y1="140" x2="218" y2="329" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="286" y1="140" x2="286" y2="329" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="354" y1="140" x2="354" y2="329" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="422" y1="140" x2="422" y2="329" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="490" y1="140" x2="490" y2="329" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="558" y1="140" x2="558" y2="329" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="626" y1="140" x2="626" y2="329" stroke="var(--sv-line)" stroke-width="1"/>
  <text x="150" y="344" font-size="11" fill="var(--sv-muted)" font-family="inherit">每格 = 一个 8 卡 TP 组；16 × 128 = 2048 组 = 16384 卡</text>
  <rect x="420" y="352" width="12" height="12" fill="var(--sv-b)"/>
  <text x="438" y="362" font-size="11" fill="var(--sv-muted)" font-family="inherit">同一 DP 副本的 PP 链</text>
  <rect x="590" y="352" width="12" height="12" fill="var(--sv-a2)"/>
  <text x="608" y="362" font-size="11" fill="var(--sv-muted)" font-family="inherit">同一 PP 级的 DP 组</text>
</svg><figcaption>图 1 · TP 组留在单个 NVLink 域内，PP 沿列串联层，DP 沿行复制整条流水；实际 128 个 DP 副本只画了 8 列。</figcaption></figure>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>维度</th><th>硬约束</th><th>违反后的典型症状</th><th>检查方法</th></tr></thead><tbody>
<tr><td>TP</td><td>不超过 NVLink 域卡数，H100 为 8</td><td>all-reduce 走 IB，step time 翻倍，MFU 掉到 20% 以下</td><td>nvidia-smi topo -m；NCCL_DEBUG=INFO 看通道</td></tr>
<tr><td>PP</td><td>L 可被 pp（及 pp×v）整除，或框架支持不等分</td><td>某级空等，气泡变大，尾级显存先爆</td><td>打印每级层数与前反向耗时</td></tr>
<tr><td>DP</td><td>B = b×s×a×DP，扩缩容时保持 B</td><td>loss 曲线随卡数漂移，收敛点对不上</td><td>记录全局 batch 与 LR、warmup 的对应关系</td></tr>
<tr><td>拓扑映射</td><td>TP 最内、PP 次之、DP 最外</td><td>跨 leaf 交换机流量高，尾延迟大</td><td>核对 rank-to-node 映射与 IB 端口计数</td></tr>
</tbody></table></div>
</section>

<section class="sec"><h2>MFU：把“跑得快”拆成可归因的损耗</h2>
<p>MFU（Model FLOPs Utilization）的定义很直接：模型每 token 所需的有效浮点运算，除以硬件在同一时间能提供的峰值。对稠密 Transformer，前向约 2N FLOPs/token，反向约 4N，合计 6N，N 为参数量；这个口径忽略了注意力的二次项与词表 softmax 的细节，所以长序列、大词表下会低估真实计算。写成公式就是：</p>
<div class="formula">MFU = (6 × N × TPS) / (G × P_peak)</div>
<p>其中 TPS 是全局每秒 token 数，G 是卡数，P_peak 是单卡峰值。分母必须写清精度口径：H100 SXM 的 BF16 稠密峰值约 989 TFLOPS，FP8 峰值约翻倍；拿 FP8 的峰值去算 BF16 训练的 MFU，分母会凭空翻倍，结果只剩一半。反过来做容量规划：TPS = MFU × G × P_peak / (6N)，单步时间 T_step = B / TPS。以 70B 稠密模型、1024 张 H100、MFU 40% 为例，TPS ≈ 96 万 token/s；全局 batch 取 400 万 token 时，单步约 4.2 秒。这个数比“理论峰值”有用，因为它直接决定一次实验要等多久。</p>
<p>MFU 30%-50% 是实测区间，不是拍脑袋：稠密大模型在 H100 集群上通常落在 35%-45%，LLaMA-3 405B 在 16K 卡上报告约 38%；小模型或短序列因为矩阵乘规模小、kernel 启动与通信占比高，常见 20%-30%；混合专家（Mixture of Experts，MoE）按激活参数算 MFU 时口径更复杂，不能和稠密模型直接比。低于 30% 通常说明有明确的工程问题，而不是“大模型就这样”。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="MFU 瀑布图：从 BF16 峰值 100% 逐项损耗到 38%">
  <text x="20" y="22" font-size="15" fill="var(--sv-ink)" font-family="inherit">MFU 瀑布：989 TFLOPS 峰值如何落到 38%</text>
  <text x="220" y="46" font-size="11" fill="var(--sv-muted)" text-anchor="end" font-family="inherit">100% = 989 TFLOPS</text>
  <rect x="230" y="52" width="450" height="22" fill="var(--sv-a)"/>
  <text x="688" y="67" font-size="11" fill="var(--sv-ink)" font-family="inherit">100%</text>
  <text x="220" y="88" font-size="12" fill="var(--sv-ink)" text-anchor="end" font-family="inherit">注意力/词表开销</text>
  <rect x="230" y="76" width="427" height="22" fill="var(--sv-a)"/>
  <rect x="657" y="76" width="23" height="22" fill="var(--sv-c)"/>
  <text x="688" y="91" font-size="11" fill="var(--sv-ink)" font-family="inherit">95</text>
  <line x1="680" y1="74" x2="680" y2="76" stroke="var(--sv-muted)" stroke-dasharray="3 3"/>
  <text x="220" y="124" font-size="12" fill="var(--sv-ink)" text-anchor="end" font-family="inherit">PP 气泡</text>
  <rect x="230" y="112" width="396" height="22" fill="var(--sv-a)"/>
  <rect x="626" y="112" width="31" height="22" fill="var(--sv-c)"/>
  <text x="688" y="127" font-size="11" fill="var(--sv-ink)" font-family="inherit">88</text>
  <line x1="657" y1="110" x2="657" y2="112" stroke="var(--sv-muted)" stroke-dasharray="3 3"/>
  <text x="220" y="160" font-size="12" fill="var(--sv-ink)" text-anchor="end" font-family="inherit">TP/DP 通信</text>
  <rect x="230" y="148" width="369" height="22" fill="var(--sv-a)"/>
  <rect x="599" y="148" width="27" height="22" fill="var(--sv-c)"/>
  <text x="688" y="163" font-size="11" fill="var(--sv-ink)" font-family="inherit">82</text>
  <line x1="626" y1="146" x2="626" y2="148" stroke="var(--sv-muted)" stroke-dasharray="3 3"/>
  <text x="220" y="196" font-size="12" fill="var(--sv-ink)" text-anchor="end" font-family="inherit">选择性重计算</text>
  <rect x="230" y="184" width="324" height="22" fill="var(--sv-a)"/>
  <rect x="554" y="184" width="45" height="22" fill="var(--sv-c)"/>
  <text x="688" y="199" font-size="11" fill="var(--sv-ink)" font-family="inherit">72</text>
  <line x1="599" y1="182" x2="599" y2="184" stroke="var(--sv-muted)" stroke-dasharray="3 3"/>
  <text x="220" y="232" font-size="12" fill="var(--sv-ink)" text-anchor="end" font-family="inherit">低强度算子</text>
  <rect x="230" y="220" width="270" height="22" fill="var(--sv-a)"/>
  <rect x="500" y="220" width="54" height="22" fill="var(--sv-c)"/>
  <text x="688" y="235" font-size="11" fill="var(--sv-ink)" font-family="inherit">60</text>
  <line x1="554" y1="218" x2="554" y2="220" stroke="var(--sv-muted)" stroke-dasharray="3 3"/>
  <text x="220" y="268" font-size="12" fill="var(--sv-ink)" text-anchor="end" font-family="inherit">尾部与负载不均</text>
  <rect x="230" y="256" width="225" height="22" fill="var(--sv-a)"/>
  <rect x="455" y="256" width="45" height="22" fill="var(--sv-c)"/>
  <text x="688" y="271" font-size="11" fill="var(--sv-ink)" font-family="inherit">50</text>
  <line x1="500" y1="254" x2="500" y2="256" stroke="var(--sv-muted)" stroke-dasharray="3 3"/>
  <text x="220" y="304" font-size="12" fill="var(--sv-ink)" text-anchor="end" font-family="inherit">故障与回滚</text>
  <rect x="230" y="292" width="171" height="22" fill="var(--sv-a)"/>
  <rect x="401" y="292" width="54" height="22" fill="var(--sv-c)"/>
  <text x="688" y="307" font-size="11" fill="var(--sv-ink)" font-family="inherit">38%</text>
  <line x1="455" y1="290" x2="455" y2="292" stroke="var(--sv-muted)" stroke-dasharray="3 3"/>
  <rect x="230" y="334" width="12" height="12" fill="var(--sv-a)"/>
  <text x="248" y="344" font-size="11" fill="var(--sv-muted)" font-family="inherit">仍在有效利用的算力</text>
  <rect x="400" y="334" width="12" height="12" fill="var(--sv-c)"/>
  <text x="418" y="344" font-size="11" fill="var(--sv-muted)" font-family="inherit">该段损耗</text>
  <text x="20" y="368" font-size="11" fill="var(--sv-muted)" font-family="inherit">示意分解，锚点为 LLaMA-3 405B 在 16K H100 上报告的约 38%；各段数值仅为量级，换模型与集群会变。</text>
</svg><figcaption>图 2 · MFU 瀑布：峰值损耗逐项归因；PP 气泡、低算术强度算子、重计算与故障回滚是主要几块，分别对应调度、算子与运维手段。</figcaption></figure>
<p>瀑布图每一段都对应一个可干预项。PP 气泡由 (p-1)/(m+p-1) 决定，m 是每个 pipeline step 的 micro-batch 数；p=16、m=16 时气泡接近 48%，这就是万卡配置几乎一定要用交错式流水的原因：虚拟级数 v 把气泡压到 (p-1)/(v×m+p-1)，v=4 时约 19%，v=8 时约 10%。TP 通信能否与计算重叠、重计算增加了多少 FLOPs、LayerNorm 与优化器这类低算术强度算子占了多少时间，都可以在 profiler 里逐项对上。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>MFU 不是越高越好。把全局 batch 拉大、序列拉长、重计算关掉，MFU 会好看，但收敛可能变差或显存爆掉。MFU 是效率指标，不是训练目标；先保证收敛与 goodput，再优化 MFU。</div></div>
</section>

<section class="sec"><h2>稳定性：loss spike 是系统问题，不是玄学</h2>
<p>loss spike 指 loss 在几十到几百步内突然抬升，常见幅度 0.3-2.0，之后要么缓慢恢复，要么彻底发散。它很少由单一原因造成，通常是数据、优化器状态与数值精度三者叠加。按排查优先级：先看数据，重复样本、异常长样本、混入脏数据都能触发；再看学习率与预热（warmup）；最后才怀疑硬件。</p>
<p>数值层面有三个常用旋钮。其一是 <mark>z-loss</mark>：对 softmax 的归一化项 log Z 加惩罚，抑制 logits 整体漂移，形式为 L = L_CE + λ_z × (log Z)²，λ_z 常取 1e-4 量级，PaLM 是这一做法的代表。其二是梯度裁剪：按全局范数裁剪到 1.0 是常见默认值，但更有用的是监控<b>裁剪前</b>的梯度范数，它往往在 loss spike 前几十步就异常抬升。其三是 Adam 的 eps：默认 1e-8，在 FP8 或极端大 batch 下二阶矩估计容易过小，把 eps 提到 1e-6 至 1e-5 可以换来更稳的更新，代价是收敛略慢；LLaMA-3 仍使用 1e-8，说明它不是万能药，要看数值格式与数据分布。</p>
<div class="formula">L = L_CE + λ_z × (log Z)²　（λ_z ≈ 1e-4；log Z 为 softmax 配分函数的对数）</div>
<p>监控上至少同时看六类信号：loss 与 z-loss、裁剪前梯度范数、更新量与参数量之比（update/param）、注意力 logits 的最大值、每个 rank 的吞吐与等待时间，以及硬件侧的 XID、ECC、NIC 计数。单看 loss 太晚；梯度范数与 update/param 是更早的预警。出现 spike 时，标准动作是跳过当前 step、回滚到最近 checkpoint、把学习率临时下调，再决定是否继续；不要在原状态上“再跑几步看看”。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>信号</th><th>正常量级/判据</th><th>异常含义</th></tr></thead><tbody>
<tr><td>裁剪前梯度范数</td><td>0.1-1.0，随规模而变</td><td>突增 5-10 倍，通常是 spike 前兆</td></tr>
<tr><td>update/param</td><td>约 1e-3</td><td>长期大于 1e-2，说明 LR 过大或 eps 过小</td></tr>
<tr><td>z-loss</td><td>缓慢变化</td><td>快速抬升说明 logits 整体漂移</td></tr>
<tr><td>attention logit 最大值</td><td>数十量级</td><td>上百可能溢出或 softmax 饱和</td></tr>
<tr><td>rank 吞吐差异</td><td>组内小于 5%</td><td>单卡掉队（straggler）或降频</td></tr>
<tr><td>XID/ECC</td><td>0</td><td>非零先隔离节点，再谈调参</td></tr>
</tbody></table></div>
<p>DeepSeek-V3 的报告给了另一条路线：用 FP8 训练 671B MoE、14.8T token，全程没有遇到不可恢复的 loss spike，也不需要回滚。关键不是“FP8 更稳”，而是配套的细粒度量化（激活按 1×128 的 tile、权重按 128×128 的 block 分别求缩放因子）、关键算子的高精度累加，以及 embedding、输出层、MoE 门控与归一化等模块保留 BF16。<b>低精度不是稳定性问题的根源，缺少补偿手段才是。</b></p>
<div class="callout callout--tip"><span class="callout__label">技巧</span><div>给训练脚本加“spike 快照”：当裁剪前梯度范数超过过去 1000 步中位数的 8 倍时，立刻保存当前 batch 的输入摘要、优化器状态与该步 loss，再决定跳过还是回滚。事后复现问题时，这份快照比日志有用得多。</div></div>
</section>

<section class="sec"><h2>Checkpoint、故障与弹性：把“白跑”压到最小</h2>
<p>千卡以上，硬件故障是常态而不是意外。LLaMA-3 的论文报告，405B 训练期间出现约 466 次任务中断，其中约一半与硬件相关；在 16K 卡的规模上，平均无故障时间（MTBF）常以小时计。这意味着 checkpoint 不是“保险”，而是训练循环的一部分。</p>
<p>先算 checkpoint 的成本。405B 参数按 BF16 权重、FP32 主权重、两个 Adam 矩保存，约 14 字节/参数，一份完整状态约 5.7 TB；即使存储能跑到 200 GB/s，写一次也要约 30 秒，叠加元数据、排队与校验，分钟级很常见。同步保存会让所有卡停下来等盘，异步保存则先把分片拷到锁页内存（pinned memory）或直接流式写入，训练继续跑。</p>
<p>保存频率有最优解。设单次保存的阻塞时间为 C，整个作业的故障率为 λ，即单位时间失败次数，则使“保存开销 + 期望重算”最小的间隔约为：</p>
<div class="formula">T* ≈ √(2C / λ)</div>
<p>例如 1024 卡、单卡 MTBF 约 1000 天，则集群 MTBF 约 23 小时，λ ≈ 1/84000 每秒；C = 60 秒时 T* ≈ 53 分钟。把 C 通过异步保存降到 10 秒，T* 会缩到约 22 分钟，这也解释了为什么大集群的 checkpoint 间隔常常是 30 分钟到 1 小时，而不是“一天一次”。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="30 小时训练窗口中的 checkpoint、异步写盘、故障与回滚时间线">
  <text x="20" y="22" font-size="15" fill="var(--sv-ink)" font-family="inherit">30 小时窗口：checkpoint、故障与回滚</text>
  <text x="16" y="76" font-size="12" fill="var(--sv-ink)" font-family="inherit">训练推进</text>
  <rect x="80" y="60" width="640" height="24" fill="var(--sv-a)"/>
  <rect x="400" y="60" width="30" height="24" fill="var(--sv-c)"/>
  <text x="415" y="52" font-size="11" fill="var(--sv-c)" text-anchor="middle" font-family="inherit">回滚 1.4 h</text>
  <rect x="143" y="60" width="3" height="24" fill="var(--sv-bg)"/>
  <rect x="207" y="60" width="3" height="24" fill="var(--sv-bg)"/>
  <rect x="271" y="60" width="3" height="24" fill="var(--sv-bg)"/>
  <rect x="335" y="60" width="3" height="24" fill="var(--sv-bg)"/>
  <rect x="399" y="60" width="3" height="24" fill="var(--sv-bg)"/>
  <rect x="463" y="60" width="3" height="24" fill="var(--sv-bg)"/>
  <rect x="527" y="60" width="3" height="24" fill="var(--sv-bg)"/>
  <rect x="591" y="60" width="3" height="24" fill="var(--sv-bg)"/>
  <rect x="655" y="60" width="3" height="24" fill="var(--sv-bg)"/>
  <text x="16" y="136" font-size="12" fill="var(--sv-ink)" font-family="inherit">异步写盘</text>
  <rect x="144" y="120" width="17" height="18" fill="var(--sv-b2)"/>
  <rect x="208" y="120" width="17" height="18" fill="var(--sv-b2)"/>
  <rect x="272" y="120" width="17" height="18" fill="var(--sv-b2)"/>
  <rect x="336" y="120" width="17" height="18" fill="var(--sv-b2)"/>
  <rect x="400" y="120" width="17" height="18" fill="var(--sv-b2)"/>
  <rect x="464" y="120" width="17" height="18" fill="var(--sv-b2)"/>
  <rect x="528" y="120" width="17" height="18" fill="var(--sv-b2)"/>
  <rect x="592" y="120" width="17" height="18" fill="var(--sv-b2)"/>
  <rect x="656" y="120" width="17" height="18" fill="var(--sv-b2)"/>
  <text x="16" y="196" font-size="12" fill="var(--sv-ink)" font-family="inherit">故障与重启</text>
  <rect x="80" y="180" width="640" height="24" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
  <rect x="430" y="180" width="14" height="24" fill="var(--sv-c)"/>
  <line x1="432" y1="184" x2="442" y2="200" stroke="var(--sv-ink)" stroke-width="2"/>
  <line x1="442" y1="184" x2="432" y2="200" stroke="var(--sv-ink)" stroke-width="2"/>
  <line x1="430" y1="204" x2="430" y2="244" stroke="var(--sv-c)" stroke-width="1" stroke-dasharray="4 4"/>
  <text x="448" y="198" font-size="11" fill="var(--sv-ink)" font-family="inherit">16.4 h GPU 故障，重启 8 min</text>
  <line x1="80" y1="250" x2="720" y2="250" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="80" y1="244" x2="80" y2="256" stroke="var(--sv-line)" stroke-width="1"/>
  <text x="80" y="272" font-size="11" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">0</text>
  <line x1="144" y1="244" x2="144" y2="256" stroke="var(--sv-line)" stroke-width="1"/>
  <text x="144" y="272" font-size="11" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">3</text>
  <line x1="208" y1="244" x2="208" y2="256" stroke="var(--sv-line)" stroke-width="1"/>
  <text x="208" y="272" font-size="11" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">6</text>
  <line x1="272" y1="244" x2="272" y2="256" stroke="var(--sv-line)" stroke-width="1"/>
  <text x="272" y="272" font-size="11" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">9</text>
  <line x1="336" y1="244" x2="336" y2="256" stroke="var(--sv-line)" stroke-width="1"/>
  <text x="336" y="272" font-size="11" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">12</text>
  <line x1="400" y1="244" x2="400" y2="256" stroke="var(--sv-line)" stroke-width="1"/>
  <text x="400" y="272" font-size="11" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">15</text>
  <line x1="464" y1="244" x2="464" y2="256" stroke="var(--sv-line)" stroke-width="1"/>
  <text x="464" y="272" font-size="11" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">18</text>
  <line x1="528" y1="244" x2="528" y2="256" stroke="var(--sv-line)" stroke-width="1"/>
  <text x="528" y="272" font-size="11" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">21</text>
  <line x1="592" y1="244" x2="592" y2="256" stroke="var(--sv-line)" stroke-width="1"/>
  <text x="592" y="272" font-size="11" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">24</text>
  <line x1="656" y1="244" x2="656" y2="256" stroke="var(--sv-line)" stroke-width="1"/>
  <text x="656" y="272" font-size="11" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">27</text>
  <line x1="720" y1="244" x2="720" y2="256" stroke="var(--sv-line)" stroke-width="1"/>
  <text x="720" y="272" font-size="11" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">30 h</text>
  <text x="400" y="298" font-size="11" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">15 h 的 checkpoint 是故障前最后一次完整状态</text>
  <text x="20" y="326" font-size="11" fill="var(--sv-muted)" font-family="inherit">一份 405B 状态约 5.7 TB；200 GB/s 下理论写盘约 30 s，异步保存只阻塞显存到主机的拷贝。</text>
  <text x="20" y="350" font-size="11" fill="var(--sv-muted)" font-family="inherit">goodput = 1 −（保存阻塞 + 回滚重算 + 重启）/ 墙钟时间；图中这段 30 h 损失约 1.7 h，goodput 约 94%。</text>
</svg><figcaption>图 3 · 每 3 小时一次 checkpoint，异步写盘在后台完成；16.4 h 发生故障后回滚到 15 h，丢失 1.4 小时计算，再加 8 分钟重启。</figcaption></figure>
<p>异步保存有几个工程要点：分片写，不要 gather 到 rank 0；先写临时目录，全部完成后原子地改 manifest；保留最近 2-3 份并定期校验可加载性；把目录放在高吞吐并行文件系统或对象存储上，避免所有 rank 争抢同一个 NFS。恢复时先验证分片完整性与 step 号，再启动训练，否则会在加载阶段二次失败。</p>
<p>故障恢复策略取决于“弹性”能力。不能弹性的作业，节点坏了就整作业重启，从最近 checkpoint 续训；能弹性的作业，例如 torchrun 的 rendezvous、Kubernetes Job、Slurm requeue，可以换节点后以新的 world size 继续，但必须保持全局 batch 不变：DP 变了就把梯度累积步数按比例调回来。<b>弹性不是免费的</b>，重新分片、重新预热通信、重新平衡 PP 切分都要时间，频繁扩缩容反而会拉低 goodput。</p>
<pre class="code" data-lang="bash"><code>#!/bin/bash
export MASTER_ADDR=$MASTER_ADDR
export MASTER_PORT=29500
export NCCL_DEBUG=WARN

torchrun \
  --nnodes=$NNODES \
  --nproc_per_node=8 \
  --rdzv_backend=c10d \
  --rdzv_endpoint=$MASTER_ADDR:$MASTER_PORT \
  --max_restarts=20 \
  train.py \
  --seq-length=8192 \
  --global-batch-tokens=16777216 \
  --save-interval=1800 \
  --async-save</code></pre>
<p>命令里的 save-interval 以秒计，1800 秒即 30 分钟；async-save 打开后台写盘。实际参数名依框架而定，重点是三件事：固定全局 batch、限制重启次数、把保存间隔和故障率一起算。恢复后先跑 20-50 步并对比 loss 与 checkpoint 前的曲线，确认没有加载错分片，再放量。</p>
</section>

<section class="sec"><h2>两个千卡到万卡级案例：配置是被约束逼出来的</h2>
<p>LLaMA-3 405B 的公开配置是理解 3D 组合的最好样本：16384 张 H100-80GB，TP=8、PP=16、DP=128，BF16 训练，交错式 1F1B 流水，AdamW（β1=0.9、β2=0.95、eps=1e-8）、权重衰减 0.1、梯度裁剪 1.0、峰值学习率 8e-5、warmup 8000 步。15.6T token、约 3.8 × 10²⁵ FLOPs，报告 MFU 约 38%。TP=8 正好是一个 NVLink 域；PP=16 把 126 层摊到 16 级，靠交错调度压气泡；DP=128 负责吞吐与容错。</p>
<p>DeepSeek-V3 走的是另一条路：671B 总参数、37B 激活的 MoE，2048 张 H800，PP=16、EP=64、ZeRO-1 的 DP，FP8 混合精度，14.8T token，总计约 2.788M H800 GPU 小时。按激活参数与 H800 的 BF16 峰值粗算，等效 MFU 约 33%（2.788M GPU 小时已含故障与重启的损耗；若按 FP8 峰值算则约 17%，所以谈 MFU 必须说口径）。它更值得学的是稳定性工程：细粒度量化、高精度累加、DualPipe 把通信藏进计算，最终没有不可恢复的 spike，也没有回滚。</p>
<div class="duo"><div class="duo__col"><h4>LLaMA-3 405B 的取舍</h4><p>稠密模型，TP 吃满一个 NVLink 域，PP 换规模，DP 换吞吐；38% 的 MFU 是 16K 卡、长序列、选择性重计算与流水气泡共同作用的结果。126 层除不尽 16，只能不等分或在调度上吸收。</p></div><div class="duo__col"><h4>DeepSeek-V3 的取舍</h4><p>MoE 把激活参数压到 37B，EP 跨节点换专家容量；FP8 把算力峰值翻倍，但必须用细粒度缩放与高精度累加兜住数值稳定性。2048 卡、约 57 天的量级，靠的是通信与计算重叠。</p></div></div>
<p>两个案例的共同点是：<b>并行度不是“调出来的”，而是被拓扑、层数、显存和 batch 共同逼出来的</b>。先定 TP 上限，即 NVLink 域；再定 PP，看层数与气泡；剩下的卡全给 DP；如果这样仍放不下或 MFU 太低，才考虑 CP、EP、offload 这些额外维度。相邻的显存优化与单机 kernel 调优分别在《ZeRO 与显存优化三件套》《Kernel 优化》中展开，这里不越界。</p>
<p>排障顺序可以固定成五步：一看每卡显存峰值与 OOM 时刻；二看 step time 分解，即计算、TP 通信、PP 气泡、DP 通信、数据加载各占多少；三看 rank 间吞吐差异找掉队者（straggler）；四看梯度范数与 update/param 找数值问题；五看 XID、ECC、NIC 与任务重启记录找硬件。这个顺序的好处是先排除“配置错”，再谈“调参”。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>不要用增加 DP 的方式解决单卡显存不足。DP 只复制、不切分参数与激活；显存不够时先升 TP/PP 或开 ZeRO/重计算，DP 扩出来的只是更多份同样的副本。反过来，DP 太大而全局 batch 不变，会让梯度累积步数降到 1，流水气泡与通信占比同时上升。</div></div>
</section>

<section class="sec"><h2>自测</h2>
<details class="quiz"><summary>Q1 · 8 卡一台的 H100 集群上，为什么 TP=16 通常是个坏主意？</summary><div class="quiz__a">因为一个 NVLink 域只有 8 卡，TP=16 必然跨到 InfiniBand。TP 每层都要做 all-reduce，跨 IB 后延迟从微秒级升到几十微秒、带宽掉到 25-50 GB/s 量级，通信无法被计算掩盖。正确做法是 TP 不超过 8，把超出的维度交给 PP 或 DP。</div></details>
<details class="quiz"><summary>Q2 · 405B 模型、16384 张 H100、MFU 38%，估算每秒 token 数与 15.6T token 的训练天数。</summary><div class="quiz__a">TPS = 0.38 × 16384 × 989e12 / (6 × 405e9) ≈ 2.53e6 token/s，即约 253 万 token/s。15.6e12 / 2.53e6 ≈ 6.17e6 秒，约 71 天。这是理想化的稳态估算，实际会被故障、回滚与数据加载拉长；与公开报告的数量级一致即可，不必追求精确到天。</div></details>
<details class="quiz"><summary>Q3 · PP=16、每个 pipeline step 有 16 个 micro-batch，气泡占比多少？交错式 v=4 后呢？</summary><div class="quiz__a">不交错时 (16-1)/(16+16-1) = 15/31 ≈ 48%，几乎一半时间在等。交错式把公式改成 (p-1)/(v×m+p-1)，v=4、m=16 时为 15/79 ≈ 19%，v=8 时约 10%。这也解释了为什么大规模训练必须用 interleaved 1F1B，而不是只把 PP 调小。</div></details>
<details class="quiz"><summary>Q4 · loss 突然从 2.1 跳到 3.4，应该按什么顺序处理？</summary><div class="quiz__a">先停在这一步附近做快照，记录裁剪前梯度范数、update/param、z-loss 与 attention logit 最大值；再回滚到最近 checkpoint 并临时下调学习率；随后查数据管线是否有重复或异常样本，查优化器状态与数值格式（eps 是否过小、是否需要 z-loss），最后才排查 XID/ECC 等硬件信号。直接在原状态继续跑，常常会把一次可恢复的 spike 变成发散。</div></details>
<details class="quiz"><summary>Q5 · 单次 checkpoint 阻塞 120 秒、集群故障率约每 20 小时一次，按公式应多久存一次？</summary><div class="quiz__a">λ = 1/(20×3600) = 1/72000 每秒，T* = √(2×120×72000) = √(1.728e7) ≈ 4157 秒，约 69 分钟。若用异步保存把阻塞压到 10 秒，间隔可缩到约 20 分钟。实际还要受存储带宽、保留份数与恢复验证时间约束，公式给的是起点而不是教条。</div></details>
</section>

<section class="sec"><h2>延伸阅读</h2>
<ul class="refs">
<li><b>Megatron-LM: Training Multi-Billion Parameter Language Models Using Model Parallelism</b> — Shoeybi et al., NVIDIA, 2019。张量并行与流水并行的工程起点，含层内切分方式。</li>
<li><b>Efficient Large-Scale Language Model Training on GPU Clusters Using Megatron-LM</b> — Narayanan et al., SC 2021。1F1B 与交错式流水调度、气泡公式与大规模配置分析。</li>
<li><b>The Llama 3 Herd of Models</b> — Meta AI, 2024。405B 的 3D 并行配置、MFU、训练稳定性与故障统计的一手来源。</li>
<li><b>DeepSeek-V3 Technical Report</b> — DeepSeek-AI, 2024。FP8 训练、DualPipe、2048 卡 MoE 配置与“无不可恢复 spike”的工程细节。</li>
<li><b>Building Meta's GenAI Infrastructure</b> — Meta Engineering Blog, 2024。两个 24K H100 集群的组网、存储与训练可靠性视角。</li>
</ul>
</section>`
};
