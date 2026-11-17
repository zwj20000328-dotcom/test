window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["model-parallel"] = {
  slug: "model-parallel",
  title: "模型并行：张量并行与流水并行",
  subtitle: "把一层网络切开，把时间填满",
  level: 3,
  cluster: "训练",
  tags: ["Tensor Parallel", "Pipeline Parallel", "Megatron"],
  summary: "当参数与激活超过单卡显存，数据并行就不够用。讲清张量并行的列/行切分、流水并行的 1F1B 调度与气泡公式，并给出并行度选择。",
  keyPoints: [
    "张量并行中列并行不通信，行并行在输出处做 all-reduce；Transformer 每层前向共 2 次",
    "TP 的 all-reduce 与每层计算强耦合，应限制在单个 NVLink 域内，通常取 4 或 8",
    "流水并行的气泡占比约为 (p-1)/(m+p-1)，m ≥ 4p 是常用起点",
    "1F1B 把在途 micro-batch 限制在约 p 个，激活显存不再随 m 线性增长",
    "3D 并行满足 world_size = TP × PP × DP，跨节点优先用 PP 和 DP"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>先给直觉：切开模型，而不是复制模型</h2>
<p>数据并行（Data Parallel, DP）把同一份模型复制到每张卡上，每张卡吃不同的数据，再用 all-reduce 同步梯度。当模型参数、优化器状态和激活值加起来超过单卡显存时，复制这条路就走不通了。模型并行（Model Parallel, MP）换了个思路：把<mark>同一个模型</mark>的不同部分放到不同卡上，让多张卡合起来装下一个模型、算完一次前向。</p>
<p>它有两个主流切法。张量并行（Tensor Parallel, TP）沿张量的某个维度把单层算子切开，例如把一个 Linear 的权重按列或按行分给多张卡；流水并行（Pipeline Parallel, PP）沿网络的深度切，把第 1 到 10 层放 GPU 0、第 11 到 20 层放 GPU 1，依次类推。前者换来的是“每层都要通信”，后者换来的是“后级要等前级”。理解这两句话，就抓住了本篇的主线。</p>
<p>下面的内容按“先拆机制、再算代价、最后给选择规则”的顺序展开。集合通信本身的算法（ring、tree 等）不在这里重复，默认你已经知道 all-reduce 是把多张卡的数据求和后广播回去。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>TP 像把一层的工作分给几个人同时做，做完必须碰头汇总；PP 像流水线工人，每人只做一道工序，件与件之间要等。TP 的代价是“频繁碰头”，PP 的代价是“流水线灌不满”。</div></div>
</section>

<section class="sec">
<h2>为什么必须切：显存墙与并行版图</h2>
<p>以 175B 参数模型为例，权重按 bf16 或 fp16 存是 350 GB；训练时 Adam 还要保存 fp32 主权重与一、二阶矩，混合精度口径下每参数约 16 字节，合计约 2.8 TB。再加上激活值、临时缓冲区和通信缓冲，单张 80 GB 的 H100 连一个完整副本都放不下，更不用说再复制出数据并行的副本。</p>
<p>显存之外还有算力与收敛的约束。数据并行在卡数增加时全局 batch 变大，学习率和训练步数都要重调；模型并行则能让“更大的模型”在固定 batch 下跑起来。代价是通信：TP 每层都要同步，PP 有流水线气泡，二者都会消耗带宽和时间。</p>
<p>三种并行并不互斥。工程上常见的是 3D 并行：TP 放在节点内的 NVLink 域，PP 跨节点，DP 填满剩余维度，三者乘积等于总卡数。下表给出定性对比，具体的并行度还要看模型形状和集群拓扑。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>并行方式</th><th>切分对象</th><th>通信模式</th><th>带宽要求</th><th>显存收益</th><th>常见并行度</th></tr></thead>
<tbody>
<tr><td>数据并行 DP</td><td>数据与模型副本</td><td>每步一次梯度 all-reduce</td><td>中</td><td>无，每卡保留完整副本</td><td>剩余卡数</td></tr>
<tr><td>张量并行 TP</td><td>层内权重与激活</td><td>每层 2 次 all-reduce</td><td>极高，要求 NVLink</td><td>参数和激活约除以 TP</td><td>4 或 8</td></tr>
<tr><td>流水并行 PP</td><td>网络深度</td><td>相邻 stage 点对点传激活</td><td>低，可跨节点</td><td>参数和激活约除以 PP</td><td>2 到 16</td></tr>
<tr><td>序列并行 SP</td><td>序列维的逐 token 算子</td><td>all-gather 与 reduce-scatter</td><td>高，通常与 TP 同域</td><td>省 LayerNorm 等区域激活</td><td>等于 TP</td></tr>
</tbody>
</table></div>
</section>

<section class="sec">
<h2>张量并行：列并行、行并行与通信点</h2>
<p>先从最小的单元说起：一个 Linear 层 Y = XA，X 形状为 (b, s, h_in)，A 形状为 (h_in, h_out)。列并行（Column Parallel）把 A 按列切成 N 份，每张卡持有 A_i，形状 (h_in, h_out/N)，各自算出 Y_i = X A_i，输出在最后一维拼接。因为 X 在每张卡上都是完整的，这一步<mark>不需要通信</mark>。行并行（Row Parallel）把 A 按行切，每张卡持有 A_i，形状 (h_in/N, h_out)，输入 X 也要按最后一维切，各卡算出部分和 Y_i = X_i A_i，最后必须 all-reduce 求和才能得到完整的 Y。</p>
<p>Megatron-LM 的关键设计是把两者配对：两层 MLP 写成 Y = GeLU(X A) B。第一层 A 用列并行，GeLU 是逐元素运算，可以直接在分片上做；第二层 B 用行并行，它的输入正好是上一层分片后的结果，不需要额外切分。于是整个 MLP 只在最后做一次 all-reduce，前向一次、反向一次。图 1 是这个结构的完整数据流。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="两层 MLP 的张量并行切分与 all-reduce 数据流">
<defs>
<marker id="model-parallel-arrow-1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
<path d="M 0 0 L 10 5 L 0 10 Z" fill="var(--sv-muted)"></path>
</marker>
</defs>
<text x="20" y="28" font-size="14" fill="var(--sv-ink)" font-family="inherit">两层 MLP：Y = GeLU(X·A)·B，N 路张量并行</text>
<text x="136" y="46" font-size="12" fill="var(--sv-muted)" font-family="inherit">GPU 0</text>
<text x="136" y="190" font-size="12" fill="var(--sv-muted)" font-family="inherit">GPU 1</text>

<rect x="15" y="120" width="85" height="70" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="57" y="148" font-size="14" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">X</text>
<text x="57" y="169" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">b×s×h</text>
<text x="15" y="212" font-size="12" fill="var(--sv-muted)" font-family="inherit">完整副本</text>

<rect x="130" y="58" width="120" height="64" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></rect>
<text x="190" y="83" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">A₁ 列分片</text>
<text x="190" y="104" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">h × 4h/N</text>
<rect x="280" y="58" width="80" height="64" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="320" y="83" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GeLU</text>
<text x="320" y="104" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">逐元素</text>
<rect x="390" y="58" width="120" height="64" rx="6" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-width="2"></rect>
<text x="450" y="83" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">B₁ 行分片</text>
<text x="450" y="104" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">4h/N × h</text>
<rect x="540" y="58" width="85" height="64" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="582" y="83" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Y₁</text>
<text x="582" y="104" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">部分和</text>

<rect x="130" y="198" width="120" height="64" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></rect>
<text x="190" y="223" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">A₂ 列分片</text>
<text x="190" y="244" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">h × 4h/N</text>
<rect x="280" y="198" width="80" height="64" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="320" y="223" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GeLU</text>
<text x="320" y="244" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">逐元素</text>
<rect x="390" y="198" width="120" height="64" rx="6" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-width="2"></rect>
<text x="450" y="223" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">B₂ 行分片</text>
<text x="450" y="244" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">4h/N × h</text>
<rect x="540" y="198" width="85" height="64" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="582" y="223" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Y₂</text>
<text x="582" y="244" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">部分和</text>

<rect x="650" y="128" width="95" height="76" rx="8" fill="var(--sv-panel)" stroke="var(--sv-c)" stroke-width="2"></rect>
<text x="697" y="158" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">All-Reduce</text>
<text x="697" y="180" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">求和</text>

<path d="M 100 142 L 126 96" stroke="var(--sv-muted)" stroke-width="1.5" fill="none" marker-end="url(#model-parallel-arrow-1)"></path>
<path d="M 100 168 L 126 228" stroke="var(--sv-muted)" stroke-width="1.5" fill="none" marker-end="url(#model-parallel-arrow-1)"></path>
<path d="M 250 90 L 276 90" stroke="var(--sv-muted)" stroke-width="1.5" fill="none" marker-end="url(#model-parallel-arrow-1)"></path>
<path d="M 360 90 L 386 90" stroke="var(--sv-muted)" stroke-width="1.5" fill="none" marker-end="url(#model-parallel-arrow-1)"></path>
<path d="M 510 90 L 536 90" stroke="var(--sv-muted)" stroke-width="1.5" fill="none" marker-end="url(#model-parallel-arrow-1)"></path>
<path d="M 250 230 L 276 230" stroke="var(--sv-muted)" stroke-width="1.5" fill="none" marker-end="url(#model-parallel-arrow-1)"></path>
<path d="M 360 230 L 386 230" stroke="var(--sv-muted)" stroke-width="1.5" fill="none" marker-end="url(#model-parallel-arrow-1)"></path>
<path d="M 510 230 L 536 230" stroke="var(--sv-muted)" stroke-width="1.5" fill="none" marker-end="url(#model-parallel-arrow-1)"></path>
<path d="M 625 92 L 647 142" stroke="var(--sv-muted)" stroke-width="1.5" fill="none" marker-end="url(#model-parallel-arrow-1)"></path>
<path d="M 625 228 L 647 190" stroke="var(--sv-muted)" stroke-width="1.5" fill="none" marker-end="url(#model-parallel-arrow-1)"></path>
<path d="M 697 204 L 697 252" stroke="var(--sv-muted)" stroke-width="1.5" fill="none" marker-end="url(#model-parallel-arrow-1)"></path>
<text x="697" y="272" font-size="14" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Y</text>
<text x="697" y="292" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">b×s×h_out</text>

<text x="130" y="172" font-size="12" fill="var(--sv-muted)" font-family="inherit">① 列并行：各卡独立计算，不通信</text>
<text x="390" y="172" font-size="12" fill="var(--sv-muted)" font-family="inherit">② 行并行：各卡得到部分和</text>
<text x="20" y="345" font-size="12" fill="var(--sv-muted)" font-family="inherit">整个 MLP 前向只需 1 次 all-reduce，反向对应 1 次；单次消息量约为 b×s×h×2 字节。</text>
</svg>
<figcaption>图 1 · 两层 MLP 的张量并行切分：第一层列并行、第二层行并行，整个 MLP 只在输出处做一次 all-reduce。</figcaption>
</figure>
<div class="formula">Y = GeLU(X·A)·B，A = [A₁ | A₂ | … | A_N]，B = [B₁; B₂; … ; B_N]
列并行：各卡算 X·A_i，无通信；行并行：各卡算 X_i·B_i，最后 all-reduce Σ_i</div>
<p>这条配对规则能直接套到 Transformer 上。MLP 是 h → 4h → h：第一层按列切成 N 份，每卡算 4h/N 个中间神经元；第二层按行切，最后 all-reduce。注意力（Attention）则把 Q、K、V 的投影按<mark>注意力头</mark>切分：每个头天然独立，N 张卡各拿 num_heads/N 个头（单头维度仍是 h/num_heads），在本地做完 scaled dot-product attention，再用行并行的输出投影 O 汇总。这就是 Megatron 能“零改动”切 Transformer 的原因：切分点都落在本来就可以独立计算的位置上。</p>
<p>代价是通信次数。每个 Transformer 层前向有 2 次 all-reduce：注意力输出投影一次、MLP 输出投影一次；反向再各一次，一层合计 4 次。若 hidden size 为 h、序列长为 s、micro-batch 为 b、精度 2 字节，单次 all-reduce 的消息是 b×s×h 个元素、约 2·b·s·h 字节，而且在不启用序列并行时这个大小不随 TP 度缩小；按 ring 实现，单次网络流量约为消息量的 2 倍。以 h=8192、s=4096、b=1、bf16 估算，一个激活张量约 67 MB，一层前向两次 all-reduce 的 ring 流量约 270 MB，80 层就是 20 GB 上下的量级。这也是 TP 必须待在 NVLink 域内的根本原因。</p>
</section>

<section class="sec">
<h2>Attention 与 MLP 的切分细节，以及 NVLink 域的硬约束</h2>
<p>把切分点落到参数上，有三个整除条件必须满足：hidden size 能被 TP 整除，注意力头数能被 TP 整除，MLP 的中间维度（通常是 4h）能被 TP 整除。满足之后，QKV 权重按输出维列切，每个 rank 只保留自己那几个头的 K、V；输出投影按输入维行切，各 rank 的部分和 all-reduce 后得到完整的注意力输出。MLP 的 up-projection 列切、down-projection 行切，中间夹一个逐元素的激活函数，不需要任何额外通信。</p>
<p>TP 的通信发生在每一层内部，且与计算强耦合：all-reduce 没完成，下一层就算不了。它要求“低延迟 + 高带宽”，而这两点只有节点内互连能给。下表是常见互连的量级对比，带宽数值随具体型号和链路数变化，只用于建立数量级直觉。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>互连</th><th>单卡或单端口带宽（量级）</th><th>典型范围</th><th>对 TP 的意义</th></tr></thead>
<tbody>
<tr><td>NVLink 4（H100 SXM）</td><td>约 900 GB/s（双向）</td><td>节点内 4 到 8 卡</td><td>TP 的主场</td></tr>
<tr><td>NVLink 3（A100 SXM）</td><td>约 600 GB/s（双向）</td><td>节点内 4 到 8 卡</td><td>可支撑 TP=8</td></tr>
<tr><td>PCIe Gen5 x16</td><td>约 64 GB/s 单向（128 GB/s 双向）</td><td>跨卡或跨节点</td><td>只适合小 TP 或 PP</td></tr>
<tr><td>InfiniBand NDR</td><td>约 50 GB/s 单向</td><td>跨节点</td><td>TP 跨节点通常得不偿失</td></tr>
</tbody>
</table></div>
<p>经验规则是：<mark>TP 度不超过单个 NVLink 域内的卡数</mark>，通常是 4 或 8。把 TP=16 铺到两个节点上，通信要走 IB，带宽掉一个数量级以上，延迟也更高，实测吞吐往往不如“TP=8 + PP=2”。如果集群是 PCIe 机型，TP=2 都未必划算，优先考虑 PP、ZeRO 或更小的模型。具体到带宽为什么这样排，《互联技术》一篇有更细的链路分析，这里只记住结论。</p>
<div class="callout callout--tip"><span class="callout__label">排查技巧</span><div>判断能不能上 TP，先看 <code>nvidia-smi topo -m</code>：GPU 之间是 NV 才说明走 NVLink；显示 SYS 或 PHB 就说明要过 PCIe 甚至跨 NUMA。另一个信号是 SM 利用率，TP 加大后利用率不升反降，多半是通信没有被计算掩盖。</div></div>
</section>

<section class="sec">
<h2>流水并行：GPipe、1F1B 与气泡</h2>
<p>PP 把 L 层切成 p 个 stage，每个 stage 放在一组 GPU 上，stage 内部还可以再套 TP。一个 global batch 被切成 m 个 micro-batch，依次送进流水线。GPipe 的做法最直观：所有 micro-batch 先做完全部前向，再做全部反向，最后统一更新。它的问题是中间态要一直留着，m 个 micro-batch 的激活全在显存里，显存随 m 线性增长；同时流水线的头部和尾部都有明显空转。</p>
<p>1F1B（one forward one backward）改成“灌满就交替”：每个 stage 先做若干前向把流水线填满，然后每做一个前向就紧接着做一个反向，让反向的梯度计算和前向错开。这样在途（in-flight）的 micro-batch 数量被限制在约 p 个，激活显存不再随 m 增长，这是 1F1B 成为默认调度的重要原因。Interleaved 1F1B（虚拟流水）进一步把每个 stage 的层再拆成 v 段，让一个设备交替处理多个虚拟 stage，能把气泡再压小，代价是额外的点对点通信和更复杂的调度。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="GPipe 与 1F1B 的流水线时间线和气泡对比">
<defs>
<marker id="model-parallel-arrow-2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
<path d="M 0 0 L 10 5 L 0 10 Z" fill="var(--sv-muted)"></path>
</marker>
</defs>
<text x="20" y="26" font-size="14" fill="var(--sv-ink)" font-family="inherit">流水线时间线：p=4 个 stage，m=6 个 micro-batch（示意）</text>
<text x="70" y="48" font-size="13" fill="var(--sv-ink)" font-family="inherit">GPipe：先全部前向，再全部反向</text>
<text x="430" y="48" font-size="13" fill="var(--sv-ink)" font-family="inherit">1F1B：填满后前向/反向交替</text>
<text x="64" y="80" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">stage 0</text>
<text x="64" y="106" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">stage 1</text>
<text x="64" y="132" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">stage 2</text>
<text x="64" y="158" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">stage 3</text>
<text x="424" y="80" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">stage 0</text>
<text x="424" y="106" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">stage 1</text>
<text x="424" y="132" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">stage 2</text>
<text x="424" y="158" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">stage 3</text>
<rect x="70" y="64" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="85" y="64" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="100" y="64" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="115" y="64" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="130" y="64" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="145" y="64" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="250" y="64" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="265" y="64" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="280" y="64" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="295" y="64" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="310" y="64" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="325" y="64" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="85" y="90" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="100" y="90" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="115" y="90" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="130" y="90" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="145" y="90" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="160" y="90" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="235" y="90" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="250" y="90" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="265" y="90" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="280" y="90" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="295" y="90" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="310" y="90" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="100" y="116" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="115" y="116" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="130" y="116" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="145" y="116" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="160" y="116" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="175" y="116" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="220" y="116" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="235" y="116" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="250" y="116" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="265" y="116" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="280" y="116" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="295" y="116" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="115" y="142" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="130" y="142" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="145" y="142" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="160" y="142" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="175" y="142" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="190" y="142" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="205" y="142" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="220" y="142" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="235" y="142" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="250" y="142" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="265" y="142" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="280" y="142" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="430" y="64" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="445" y="64" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="460" y="64" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="475" y="64" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="490" y="64" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="505" y="64" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="520" y="64" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="535" y="64" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="550" y="64" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="565" y="64" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="580" y="64" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="595" y="64" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="445" y="90" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="460" y="90" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="475" y="90" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="490" y="90" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="505" y="90" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="520" y="90" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="535" y="90" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="550" y="90" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="565" y="90" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="580" y="90" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="595" y="90" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="610" y="90" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="460" y="116" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="475" y="116" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="490" y="116" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="505" y="116" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="520" y="116" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="535" y="116" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="550" y="116" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="565" y="116" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="580" y="116" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="595" y="116" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="610" y="116" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="625" y="116" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="475" y="142" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="490" y="142" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="505" y="142" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="520" y="142" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="535" y="142" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="550" y="142" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="565" y="142" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="580" y="142" width="15" height="24" fill="var(--sv-b2)"></rect>
<rect x="595" y="142" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="610" y="142" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="625" y="142" width="15" height="24" fill="var(--sv-a2)"></rect>
<rect x="640" y="142" width="15" height="24" fill="var(--sv-a2)"></rect>
<text x="70" y="190" font-size="12" fill="var(--sv-muted)" font-family="inherit">斜三角区域是气泡：前向填充与反向排空各占 p−1 个 slot</text>
<rect x="70" y="208" width="14" height="14" fill="var(--sv-b2)"></rect>
<text x="90" y="220" font-size="12" fill="var(--sv-muted)" font-family="inherit">前向 F</text>
<rect x="160" y="208" width="14" height="14" fill="var(--sv-a2)"></rect>
<text x="180" y="220" font-size="12" fill="var(--sv-muted)" font-family="inherit">反向 B</text>
<rect x="250" y="208" width="14" height="14" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="270" y="220" font-size="12" fill="var(--sv-muted)" font-family="inherit">空白 = 气泡</text>
<text x="70" y="252" font-size="12" fill="var(--sv-muted)" font-family="inherit">GPipe 总时长约 2(m+p−1) 个 slot；1F1B 的稳态吞吐与之同量级，收益主要是在途激活降到约 p 份。</text>
<text x="70" y="274" font-size="12" fill="var(--sv-muted)" font-family="inherit">气泡占比按 (p−1)/(m+p−1) 的量级估算，m 越大越小；图中取小 m 只为画得清，未按比例。</text>
</svg>
<figcaption>图 2 · 流水并行时间线示意：GPipe 的两段式调度会在首尾留下填充与排空气泡；1F1B 在灌满后交替执行前向与反向，把在途 micro-batch 限制在约 p 个，从而降低激活显存。</figcaption>
</figure>
<p>气泡的比例可以直接算。一个 stage 在稳态下处理 m 个 micro-batch，全部做完需要 m 个前向 slot；填充阶段有 p−1 个 slot 只有部分 stage 在工作，排空阶段同理。于是气泡占比为：</p>
<div class="formula">气泡比例 ≈ (p − 1) / (m + p − 1)
p=8、m=32 时约 7/39 ≈ 18%；m=64 时约 7/71 ≈ 10%
想把气泡压到 5% 以下，m 要接近 140</div>
<p>这个公式给出的是理想模型下的气泡比例：它假设每个 slot 的计算时间相同、通信完全被掩盖。真实系统里 stage 负载不均、点对点传输和重计算都会让气泡占比更差。工程上常取 m ≥ 4p 作为起点，再用 interleaved 调度或更大的 m 压气泡；但 m 增大会增加调度开销与通信次数，不是越大越好。</p>
</section>

<section class="sec">
<h2>micro-batch、激活显存与序列并行</h2>
<p>PP 的显存账要分开算。权重和优化器状态按 stage 均分，这一项随 p 线性下降；激活则取决于“同时在途的 micro-batch 数”。GPipe 要保存全部 m 份激活，1F1B 只保留约 p 份，所以同样的显存预算下 1F1B 能开更大的 m，气泡也更小。另一个杠杆是激活重计算（activation recomputation）：前向只存少数边界张量，反向时重算中间结果，用约 1/3 的额外计算换数倍的激活显存，几乎是大模型训练的标配。</p>
<p>粗略估算一个 stage 的激活显存：M_act ≈ k × b × s × h × L_stage × bytes。其中 k 是每层需要保存的张量数，视实现与是否重计算而定，量级在 2 到 20 之间；L_stage 是该 stage 的层数。举例：L_stage=20、h=8192、s=4096、b=1、bf16、k≈10，得到约 13 GB；若 k 因重计算降到 2，则约 2.7 GB。这不是精确值，但足以指导你把 m 和 s 调到什么量级。注意这里没有算 attention 的分数矩阵，长序列下它可能成为另一项大头，需要 FlashAttention 一类的方法配合。</p>
<p>序列并行（Sequence Parallel, SP）是 TP 的补充：LayerNorm、Dropout 这些逐 token 的算子本来在每张 TP 卡上都重复算了一遍完整序列，SP 把序列维切到 TP 组内，省下这部分激活，并在进入张量并行区前做 all-gather、出来做 reduce-scatter。它不改变 TP 的数学结果，主要收益是激活显存和一部分带宽。MoE 模型还会用到专家并行（Expert Parallel, EP），把不同专家放到不同卡上，靠 all-to-all 路由 token，这里只提一句，细节留给 MoE 那一篇。</p>
</section>

<section class="sec">
<h2>并行度怎么选：决策树与 Megatron 配置</h2>
<p>先定 TP：在 NVLink 域内取 4 或 8，除非模型单层大到 8 卡也放不下（极少见），否则不要跨节点做 TP。再定 PP：层数要能被 p 整除，stage 之间计算量尽量均衡；p 越大，气泡和点对点通信越多，一般不超过 16。剩下的卡数给 DP：world_size = TP × PP × DP。如果 DP 之后单卡显存仍然不够，叠加 ZeRO-1/2 或 FSDP 切优化器状态与梯度，而不是继续加大 TP。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="模型并行度选择决策树">
<defs>
<marker id="model-parallel-arrow-3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
<path d="M 0 0 L 10 5 L 0 10 Z" fill="var(--sv-muted)"></path>
</marker>
</defs>
<text x="20" y="26" font-size="14" fill="var(--sv-ink)" font-family="inherit">并行度选择：先填满 NVLink 域，再跨节点，最后吃满剩余算力</text>
<rect x="30" y="40" width="210" height="58" rx="8" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></rect>
<text x="135" y="63" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">① 单卡装得下？</text>
<text x="135" y="83" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">权重 + 优化器 + 激活</text>
<rect x="430" y="40" width="300" height="58" rx="8" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-width="2"></rect>
<text x="580" y="63" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">是 → DP 或 ZeRO / FSDP</text>
<text x="580" y="83" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">不需要模型并行</text>
<rect x="30" y="135" width="210" height="58" rx="8" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></rect>
<text x="135" y="158" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">② NVLink 域内 ≥ 4 卡？</text>
<text x="135" y="178" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">看 topo -m 是否 NV</text>
<rect x="430" y="135" width="300" height="58" rx="8" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-width="2"></rect>
<text x="580" y="158" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">否 → TP 取 1 或 2</text>
<text x="580" y="178" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">跨节点交给 PP 与 ZeRO</text>
<rect x="30" y="230" width="210" height="58" rx="8" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></rect>
<text x="135" y="253" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">③ TP = 4 或 8</text>
<text x="135" y="273" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">不超过单个 NVLink 域</text>
<rect x="430" y="230" width="300" height="58" rx="8" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-width="2"></rect>
<text x="580" y="253" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">层数可整除、需要跨节点</text>
<text x="580" y="273" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">→ PP = 2 到 16，m ≥ 4p</text>
<rect x="30" y="315" width="210" height="50" rx="8" fill="var(--sv-panel)" stroke="var(--sv-c)" stroke-width="2"></rect>
<text x="135" y="345" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">④ 剩余卡数 → DP</text>
<rect x="430" y="315" width="300" height="50" rx="8" fill="var(--sv-panel)" stroke="var(--sv-c)" stroke-width="2"></rect>
<text x="580" y="345" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">world_size = TP × PP × DP</text>
<path d="M 240 69 L 426 69" stroke="var(--sv-muted)" stroke-width="1.5" fill="none" marker-end="url(#model-parallel-arrow-3)"></path>
<text x="330" y="60" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">是</text>
<path d="M 135 98 L 135 131" stroke="var(--sv-muted)" stroke-width="1.5" fill="none" marker-end="url(#model-parallel-arrow-3)"></path>
<text x="147" y="118" font-size="12" fill="var(--sv-muted)" font-family="inherit">否</text>
<path d="M 240 164 L 426 164" stroke="var(--sv-muted)" stroke-width="1.5" fill="none" marker-end="url(#model-parallel-arrow-3)"></path>
<text x="330" y="155" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">否</text>
<path d="M 135 193 L 135 226" stroke="var(--sv-muted)" stroke-width="1.5" fill="none" marker-end="url(#model-parallel-arrow-3)"></path>
<text x="147" y="213" font-size="12" fill="var(--sv-muted)" font-family="inherit">是</text>
<path d="M 240 259 L 426 259" stroke="var(--sv-muted)" stroke-width="1.5" fill="none" marker-end="url(#model-parallel-arrow-3)"></path>
<text x="330" y="250" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">然后</text>
<path d="M 240 340 L 426 340" stroke="var(--sv-muted)" stroke-width="1.5" fill="none" marker-end="url(#model-parallel-arrow-3)"></path>
<text x="330" y="331" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">用剩余的卡</text>
</svg>
<figcaption>图 3 · 并行度选择决策树：TP 留在 NVLink 域内，PP 负责跨节点，DP 填满剩余卡数。</figcaption>
</figure>
<p>一个可操作的流程是：先估算单卡能放多少参数与激活，确定最小可行的 TP×PP；再用 m ≥ 4p 验证气泡在可接受范围，检查激活显存；最后用剩余卡数做 DP，测吞吐。若扩展效率低于预期，优先怀疑 PP 负载不均或 TP 跨了 NVLink 域，而不是先怀疑框架。更完整的 3D 组合、MFU 与拓扑约束见 large-scale-training 一篇。</p>
<p>Megatron-Core 把上述维度暴露成几个参数。下面是一段典型的启动命令，场景是 4 节点 × 8 卡共 32 卡，GPT 类模型，取 TP=8、PP=2、DP=2。不要照抄数值，按你的模型形状和集群调整。</p>
<pre class="code" data-lang="bash"><code>torchrun --nnodes=4 --nproc_per_node=8 \
  --node_rank=$NODE_RANK \
  --master_addr=$MASTER_ADDR --master_port=6000 \
  pretrain_gpt.py \
  --tensor-model-parallel-size 8 \
  --pipeline-model-parallel-size 2 \
  --num-layers 32 \
  --hidden-size 4096 \
  --num-attention-heads 32 \
  --seq-length 4096 \
  --micro-batch-size 1 \
  --global-batch-size 64 \
  --bf16 \
  --recompute-activations</code></pre>
<p>读这段配置要抓三个数：TP×PP×DP = 8×2×2 = 32，正好等于总卡数；global-batch-size / micro-batch-size = 64/1 = 64，这 64 个 micro-batch 摊到 DP=2 个组，每组每步处理 32 个（即 32 步梯度累积），m 相对 p=2 足够大；--recompute-activations 打开重计算，用计算换激活显存。真实训练还要设置学习率、并行保存 checkpoint 的路径和通信超时，这些属于工程配置，不是并行机制本身。</p>
</section>

<section class="sec">
<h2>常见误区、排障与自测</h2>
<p>第一个误区是“TP 越大越快”。TP 把每层的矩阵乘切小，单卡通用矩阵乘（GEMM）的效率会下降；同时 all-reduce 次数不变，消息大小在不启用序列并行时也不随 TP 缩小（行并行的输出是完整的 b×s×h），而每卡计算量按 1/TP 下降，通信占比反而上升，延迟又不会等比例下降。超过 NVLink 域后，吞吐通常断崖式下跌。第二个误区是“PP 没有通信”。PP 的点对点激活传输量是 b×s×h×2 字节的量级，跨节点时同样吃 IB，而且 stage 边界会打断计算流水，必须用交错调度或与 DP 通信重叠来掩盖。</p>
<p>排障可以按固定顺序走：先确认拓扑，用 nvidia-smi topo -m 看 TP 组是否都在 NVLink 域内；再看每个 stage 的参数量和单步耗时是否均衡，PP 最慢的 stage 决定整体；然后看 micro-batch 数与气泡，m 太小会看到 GPU 周期性空转、利用率呈锯齿状；最后看显存，如果 OOM（显存不足）出现在第一个 iteration，多半是激活或通信缓冲，而不是权重。定位到哪一项，再改并行度，不要一次改多个维度。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>改并行度后必须重新做 checkpoint 转换。TP/PP 的切分方式不同，权重分片布局也不同，直接加载旧 checkpoint 可能形状不匹配，也可能在形状巧合时静默错位。跨配置要先合并再按新配置切分，转换脚本本身也要在相同的并行配置下验证一遍。</div></div>
<p>下面四道题用来检验你是否真的理解了通信点和气泡。</p>
<details class="quiz"><summary>Q1 · 一个两层 MLP 用 TP=8，前向需要几次 all-reduce？整个 Transformer 层呢？</summary><div class="quiz__a">MLP 前向只有 1 次：第一层列并行不通信，第二层行并行在输出处做一次 all-reduce；反向对应一次。整个 Transformer 层前向有 2 次：注意力输出投影一次、MLP 输出投影一次，所以一层前向共 2 次、反向 2 次。不要把“每层一次”和“每个 Linear 一次”混为一谈，关键是切分方式是否在输出处产生了需要求和的部分和。</div></details>
<details class="quiz"><summary>Q2 · p=8、m=64 时气泡占比多少？想把气泡压到 5% 以下，m 至少多大？</summary><div class="quiz__a">按 (p−1)/(m+p−1) 计算：7/71 ≈ 9.9%。要 ≤5%，需 7/(m+7) ≤ 0.05，即 m+7 ≥ 140，m ≥ 133。实际取值还要让 global batch 能被 m 整除，并受激活显存限制，所以通常会取 144 或 160 这类更整齐的数。公式是理想模型下的估计，真实气泡会更大。</div></details>
<details class="quiz"><summary>Q3 · 为什么 175B 模型的 TP 常用 8，而不是 16 或 32？</summary><div class="quiz__a">因为 8 通常是单个 NVLink 域的上限，域内带宽在数百 GB/s 量级；跨节点走 IB 只有约 50 GB/s 量级，低一个数量级以上。TP 的 all-reduce 与每层计算强耦合，通信无法被计算掩盖，跨节点做大会让吞吐下降。因此跨节点优先用 PP 和 DP，这也是 Megatron 训练 175B 时采用 TP=8、PP=8、DP=16 这类组合的原因。</div></details>
<details class="quiz"><summary>Q4 · 1F1B 相比 GPipe 的主要优势是什么？</summary><div class="quiz__a">GPipe 要等所有 micro-batch 的前向做完才开始反向，全部 m 份激活都得留着；1F1B 在流水线填满后交替执行前向和反向，在途 micro-batch 数量被限制在约 p 个，激活显存不再随 m 线性增长。因此同样的显存可以开更大的 m，气泡也随之变小。代价是调度更复杂，反向必须等对应 stage 的梯度就绪。</div></details>
<ul class="refs">
<li><b>Megatron-LM: Training Multi-Billion Parameter Language Models Using Model Parallelism</b> — Shoeybi 等, NVIDIA, 2019。提出列并行与行并行的 TP 方案，是后续实现的共同起点。</li>
<li><b>Efficient Large-Scale Language Model Training on GPU Clusters Using Megatron-LM</b> — Narayanan 等, NVIDIA, 2021。系统分析 TP/PP/DP 的组合、1F1B 与 interleaved 调度，并给出大规模训练配置。</li>
<li><b>GPipe: Efficient Training of Giant Neural Networks using Pipeline Parallelism</b> — Huang 等, Google, 2019。提出 micro-batch 切分与重计算，是流水并行的经典基线。</li>
<li><b>PipeDream: Generalized Pipeline Parallelism for DNN Training</b> — Harlap 等, 2019。探索异步流水与 weight stashing，理解 PP 调度演进的必读材料。</li>
<li><b>Megatron-Core Documentation</b> — NVIDIA, 2024。生产级并行配置、checkpoint 转换与 API 的官方文档，适合动手时对照。</li>
</ul>
</section>`
};
