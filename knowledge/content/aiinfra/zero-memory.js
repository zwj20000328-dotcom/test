window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["zero-memory"] = {
  slug: "zero-memory",
  title: "ZeRO 与显存优化三件套",
  subtitle: "算清每一字节，才能训得更大",
  level: 3,
  cluster: "训练",
  tags: ["ZeRO", "Activation Checkpointing", "Offload", "FSDP"],
  summary: "从每参数 16 字节的显存账本出发，算清激活、ZeRO 三阶段切分与 offload 的带宽代价，给出 DeepSpeed 与 FSDP 配置和 OOM 排障清单。",
  keyPoints: [
    "混合精度加 Adam 的参数态约 16 字节/参数，其中优化器状态占 12 字节；加激活与临时区通常到 20 字节以上",
    "分段 activation checkpointing 用一次额外前向把激活显存从 O(n) 降到 O(√n)，计算增加约 1/3",
    "ZeRO 依次切分优化器状态、梯度、参数；Stage 3 的通信量约为基线的 1.5 倍",
    "offload 的收益取决于 PCIe/NVMe 有效带宽能否被计算掩盖"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec"><h2>先把账算清：16 字节从哪里来</h2>
<p>先记住一句话：<mark>训练显存不由模型文件大小决定，而由每个参数背后的状态决定</mark>。一个 7B 模型的 BF16 权重文件约 14 GB，但用 Adam 做混合精度训练时，仅参数相关状态就要 112 GB，还没算激活。差额来自梯度、FP32 主权重和两个 Adam 动量。</p>
<p>混合精度（mixed precision）在前向和反向用 BF16 或 FP16 计算，但优化器通常保留一份 FP32 主权重（master weights），避免更新步长被舍入吃掉。Adam 再为每个参数维护一阶矩 m 与二阶矩 v，各 4 字节。逐项相加：BF16 权重 2 + BF16 梯度 2 + FP32 主权重 4 + m 4 + v 4 = 16 字节/参数。若梯度也保留 FP32，或框架额外保存副本，会接近 18-20 字节。这个口径不含激活与临时区。</p>
<div class="formula">M_param = P × (2 + 2 + 4 + 4 + 4) = 16P 字节（BF16 计算、FP32 优化器）</div>
<p>把数字代进去：7B × 16 B = 112 GB。一张 80 GB 的 A100 或 H100 连参数态都放不下。这也解释了为什么 ZeRO 的第一刀总是先切优化器状态：它占了 16 字节里的 12 字节，是最大且最容易切走的部分。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="7B 模型训练显存构成堆叠条与 ZeRO-3 对比">
  <text x="20" y="24" font-size="15" fill="var(--sv-ink)" font-family="inherit">7B 模型单卡显存构成（BF16 + Adam，单位 GB）</text>
  <line x1="150" y1="46" x2="150" y2="232" stroke="var(--sv-line)" stroke-width="1"/>
  <line x1="294" y1="46" x2="294" y2="232" stroke="var(--sv-line)" stroke-dasharray="3 4"/>
  <line x1="438" y1="46" x2="438" y2="232" stroke="var(--sv-line)" stroke-dasharray="3 4"/>
  <line x1="582" y1="46" x2="582" y2="232" stroke="var(--sv-line)" stroke-dasharray="3 4"/>
  <line x1="690" y1="46" x2="690" y2="232" stroke="var(--sv-line)" stroke-dasharray="3 4"/>
  <text x="150" y="250" font-size="12" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">0</text>
  <text x="294" y="250" font-size="12" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">40</text>
  <text x="438" y="250" font-size="12" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">80</text>
  <text x="582" y="250" font-size="12" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">120</text>
  <text x="690" y="250" font-size="12" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">150</text>
  <line x1="438" y1="40" x2="438" y2="232" stroke="var(--sv-b)" stroke-width="1.5" stroke-dasharray="6 4"/>
  <text x="444" y="40" font-size="12" fill="var(--sv-b)" font-family="inherit">80 GB 单卡上限</text>
  <text x="140" y="91" text-anchor="end" font-size="13" fill="var(--sv-ink)" font-family="inherit">DDP + Adam</text>
  <rect x="150" y="70" width="50.4" height="32" fill="var(--sv-a)"/>
  <rect x="200.4" y="70" width="50.4" height="32" fill="var(--sv-a2)"/>
  <rect x="250.8" y="70" width="100.8" height="32" fill="var(--sv-b)"/>
  <rect x="351.6" y="70" width="100.8" height="32" fill="var(--sv-b2)"/>
  <rect x="452.4" y="70" width="100.8" height="32" fill="var(--sv-c)"/>
  <rect x="553.2" y="70" width="108" height="32" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
  <text x="560" y="90" font-size="12" fill="var(--sv-ink)" font-family="inherit">激活 30</text>
  <text x="668" y="91" font-size="13" fill="var(--sv-ink)" font-family="inherit">142</text>
  <text x="140" y="171" text-anchor="end" font-size="13" fill="var(--sv-ink)" font-family="inherit">ZeRO-3，N=8</text>
  <text x="175" y="146" font-size="10" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">参数态 14</text>
  <rect x="150" y="150" width="50.4" height="32" fill="var(--sv-a)"/>
  <rect x="200.4" y="150" width="108" height="32" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
  <text x="212" y="170" font-size="12" fill="var(--sv-ink)" font-family="inherit">激活 30</text>
  <text x="316" y="171" font-size="13" fill="var(--sv-ink)" font-family="inherit">44</text>
  <rect x="20" y="268" width="12" height="12" fill="var(--sv-a)"/>
  <text x="38" y="279" font-size="12" fill="var(--sv-muted)" font-family="inherit">BF16 权重 14</text>
  <rect x="150" y="268" width="12" height="12" fill="var(--sv-a2)"/>
  <text x="168" y="279" font-size="12" fill="var(--sv-muted)" font-family="inherit">BF16 梯度 14</text>
  <rect x="280" y="268" width="12" height="12" fill="var(--sv-b)"/>
  <text x="298" y="279" font-size="12" fill="var(--sv-muted)" font-family="inherit">FP32 主权重 28</text>
  <rect x="430" y="268" width="12" height="12" fill="var(--sv-b2)"/>
  <text x="448" y="279" font-size="12" fill="var(--sv-muted)" font-family="inherit">Adam m 28</text>
  <rect x="560" y="268" width="12" height="12" fill="var(--sv-c)"/>
  <text x="578" y="279" font-size="12" fill="var(--sv-muted)" font-family="inherit">Adam v 28</text>
  <rect x="20" y="296" width="12" height="12" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
  <text x="38" y="307" font-size="12" fill="var(--sv-muted)" font-family="inherit">激活 30（32 层、h=4096、seq 2048、batch 1，未计临时区）</text>
  <text x="20" y="344" font-size="12" fill="var(--sv-muted)" font-family="inherit">每参数 16 B = 2 + 2 + 4 + 4 + 4；ZeRO-3 只切参数态，激活仍是每卡一份。</text>
</svg><figcaption>图 1 · 7B 模型在 DDP 与 ZeRO-3 下的单卡显存构成；80 GB 线说明仅参数态就已越界。</figcaption></figure>
<p>临时区（temporary buffer）常被漏算：集合通信缓冲、cuBLAS 与 cuDNN 的 workspace、融合算子 workspace，以及输出层 logits。后者的规模是 batch × seq × vocab，batch 1、seq 2048、词表 128000、BF16 时就约 0.5 GB。工程上建议在参数态与激活之外再留 10-20% 余量，否则会在 step 中段随机 OOM。</p>
<p>把模型放大到 70B，账本会更刺眼：参数态 16 × 70B = 1120 GB，8 张 80 GB 卡合计 640 GB，连 16 字节/参数的训练状态都放不下。即便用 ZeRO-3 把它完全切到 8 张卡，每卡仍要 1120 / 8 = 140 GB，超过 80 GB 的上限。此时不是调 batch 能解决的问题，必须增加卡数，或叠加 CPU/NVMe offload 与张量、流水线并行。显存规划的第一步永远是算这个下限。</p>
</section>

<section class="sec"><h2>激活与重计算：用时间换空间</h2>
<p>激活（activation）是前向为反向保留的中间张量，包括注意力的 Q/K/V、softmax 输出、MLP 中间层等。它不随参数量固定，而随 token 数近似线性增长。Korthikanti 等人给出的 Transformer 单层激活估算为下式，单位为字节，常数 34 与 5 来自各中间张量的系数，适用于 FP16 或 BF16。</p>
<div class="formula">M_act,层 ≈ s × b × h × (34 + 5 × a × s / h) 字节</div>
<p>以 7B 为例：32 层、h=4096、32 个注意力头、seq=2048、micro-batch=1，单层约 0.95 GB，32 层约 30 GB。这是未启用 FlashAttention、显式物化注意力矩阵时的上界；换成 FlashAttention 后注意力部分大幅下降，但 MLP 与归一化中间量仍在。结论不变：<b>激活随序列长度超线性增长，是长上下文训练的主要显存压力</b>。</p>
<p>激活检查点（activation checkpointing，也叫 gradient checkpointing）的思路是丢掉中间结果、反向时重算。全存是 O(n) 显存、O(n) 计算；全不存是 O(1) 显存、O(n²) 重算。分段检查点取折中：把 n 层分成约 √n 段，每段只存入口状态，反向时从入口重算该段前向。显存降到 O(√n)，代价是额外一次前向。</p>
<div class="formula">M_ckpt ≈ M_act × (√n / n) = M_act / √n（按“每个边界状态约等于一层激活”计，忽略重算工作集）</div>
<p>为什么额外计算约 33% 而不是 100%？一次迭代的前向约 1 个单位计算，反向约 2 个单位，因为链式法则要算两份矩阵乘。检查点只重算前向，不重算反向，于是总计算从 3 变成 4，增加 1/3。</p>
<div class="formula">T_new / T_old = (1 + 2 + 1) / (1 + 2) ≈ 1.33</div>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="激活检查点的前向保存与反向重算时间线">
  <defs><marker id="zero-memory-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="var(--sv-muted)"/></marker></defs>
  <text x="20" y="24" font-size="15" fill="var(--sv-ink)" font-family="inherit">激活检查点：8 层只存 4 个边界状态</text>
  <text x="16" y="83" font-size="13" fill="var(--sv-ink)" font-family="inherit">前向</text>
  <rect x="100" y="64" width="68" height="30" fill="var(--sv-a)"/>
  <text x="134" y="83" font-size="12" fill="var(--sv-bg)" text-anchor="middle" font-family="inherit">L1</text>
  <rect x="178" y="64" width="68" height="30" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
  <text x="212" y="83" font-size="12" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">L2</text>
  <rect x="256" y="64" width="68" height="30" fill="var(--sv-a)"/>
  <text x="290" y="83" font-size="12" fill="var(--sv-bg)" text-anchor="middle" font-family="inherit">L3</text>
  <rect x="334" y="64" width="68" height="30" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
  <text x="368" y="83" font-size="12" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">L4</text>
  <rect x="412" y="64" width="68" height="30" fill="var(--sv-a)"/>
  <text x="446" y="83" font-size="12" fill="var(--sv-bg)" text-anchor="middle" font-family="inherit">L5</text>
  <rect x="490" y="64" width="68" height="30" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
  <text x="524" y="83" font-size="12" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">L6</text>
  <rect x="568" y="64" width="68" height="30" fill="var(--sv-a)"/>
  <text x="602" y="83" font-size="12" fill="var(--sv-bg)" text-anchor="middle" font-family="inherit">L7</text>
  <rect x="646" y="64" width="68" height="30" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
  <text x="680" y="83" font-size="12" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">L8</text>
  <line x1="90" y1="110" x2="720" y2="110" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#zero-memory-arrow)"/>
  <text x="16" y="195" font-size="13" fill="var(--sv-ink)" font-family="inherit">反向</text>
  <rect x="100" y="176" width="68" height="30" fill="var(--sv-b2)"/>
  <text x="134" y="195" font-size="12" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">B1</text>
  <rect x="178" y="176" width="68" height="30" fill="var(--sv-b2)"/>
  <text x="212" y="195" font-size="12" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">B2</text>
  <rect x="256" y="176" width="68" height="30" fill="var(--sv-b2)"/>
  <text x="290" y="195" font-size="12" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">B3</text>
  <rect x="334" y="176" width="68" height="30" fill="var(--sv-b2)"/>
  <text x="368" y="195" font-size="12" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">B4</text>
  <rect x="412" y="176" width="68" height="30" fill="var(--sv-b2)"/>
  <text x="446" y="195" font-size="12" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">B5</text>
  <rect x="490" y="176" width="68" height="30" fill="var(--sv-b2)"/>
  <text x="524" y="195" font-size="12" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">B6</text>
  <rect x="568" y="176" width="68" height="30" fill="var(--sv-b2)"/>
  <text x="602" y="195" font-size="12" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">B7</text>
  <rect x="646" y="176" width="68" height="30" fill="var(--sv-b2)"/>
  <text x="680" y="195" font-size="12" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">B8</text>
  <line x1="720" y1="222" x2="90" y2="222" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#zero-memory-arrow)"/>
  <path d="M568,148 L568,158 L714,158 L714,148" fill="none" stroke="var(--sv-b)" stroke-width="1.5"/>
  <text x="641" y="144" font-size="12" fill="var(--sv-b)" text-anchor="middle" font-family="inherit">从 L7 检查点重算这一段前向</text>
  <text x="16" y="303" font-size="13" fill="var(--sv-ink)" font-family="inherit">检查点</text>
  <rect x="100" y="286" width="68" height="26" fill="var(--sv-a2)"/>
  <text x="134" y="304" font-size="12" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">L1</text>
  <rect x="256" y="286" width="68" height="26" fill="var(--sv-a2)"/>
  <text x="290" y="304" font-size="12" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">L3</text>
  <rect x="412" y="286" width="68" height="26" fill="var(--sv-a2)"/>
  <text x="446" y="304" font-size="12" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">L5</text>
  <rect x="568" y="286" width="68" height="26" fill="var(--sv-a2)"/>
  <text x="602" y="304" font-size="12" fill="var(--sv-ink)" text-anchor="middle" font-family="inherit">L7</text>
  <text x="20" y="344" font-size="12" fill="var(--sv-muted)" font-family="inherit">显存从 O(n) 降到 O(√n)；重算只重复前向，总计算约增加 1/3。</text>
</svg><figcaption>图 2 · 前向只在段边界保存状态，反向时从最近的检查点重算整段前向，再执行反向。</figcaption></figure>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>检查点的粒度不是越细越好，也不是越粗越好：段越细，保存的边界状态越多（每个只是一个层输入的大小），重算时的工作集越小；段越粗，保存的边界状态越少，重算时要同时物化的激活越多。经典结论是分成约 √n 段，能在 O(√n) 显存下只多一次前向；工程上更常见的是逐层检查点，每层只存输入（约 2·b·s·h 字节），重算时只临时物化一层的激活，代价同样是约 1/3 的额外计算。优先对激活占比高的层做选择性检查点（selective checkpointing），并让重算与通信重叠，否则 step time 会明显变长。</div></div>
<p>实践中最常见的误区是把它当成一个开关：要么全开、要么全关，而不去看边界状态与重算工作集各占多少。对 Transformer，层输入（约 2·b·s·h 字节）只占该层激活的一小部分（前式中的 34·b·s·h 项，尚未计注意力矩阵），所以逐层检查点通常就接近最优：存 n 个小边界，重算时只物化一层。更细的调整是选择性检查点：对激活占比高的层单独开，对 embedding 与输出层不开；如果层数很多、边界状态本身已经可观，再退回到每隔几层存一个边界。重算段最好和 ZeRO 的 all-gather 或流水线并行的通信重叠，用通信时间掩盖重算；如果带宽已经打满，重叠会让两者互相拖慢，要以 profile 为准。</p>
</section>

<section class="sec"><h2>ZeRO 三阶段：切什么、省多少、多花多少通信</h2>
<p>ZeRO（Zero Redundancy Optimizer）的出发点很朴素：数据并行（data parallel）下每张卡都保存完整副本，N 张卡就有 N 份冗余。既然每步只需要一份更新后的参数，就可以把状态按 rank 切开，用到时再收集。三个阶段依次切优化器状态、梯度、参数。数据并行的基本机制在《数据并行与梯度同步》一篇已经讲过，这里只谈切分带来的增量。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="ZeRO 三个阶段的参数梯度优化器分片示意">
  <text x="20" y="24" font-size="15" fill="var(--sv-ink)" font-family="inherit">ZeRO 三阶段：每张 GPU 保留哪些副本</text>
  <rect x="430" y="14" width="12" height="12" fill="var(--sv-a)"/>
  <text x="448" y="25" font-size="12" fill="var(--sv-muted)" font-family="inherit">参数 W</text>
  <rect x="520" y="14" width="12" height="12" fill="var(--sv-b)"/>
  <text x="538" y="25" font-size="12" fill="var(--sv-muted)" font-family="inherit">梯度 G</text>
  <rect x="610" y="14" width="12" height="12" fill="var(--sv-c)"/>
  <text x="628" y="25" font-size="12" fill="var(--sv-muted)" font-family="inherit">优化器 OS</text>
  <text x="190" y="64" font-size="12" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">GPU0</text>
  <text x="335" y="64" font-size="12" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">GPU1</text>
  <text x="480" y="64" font-size="12" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">GPU2</text>
  <text x="625" y="64" font-size="12" fill="var(--sv-muted)" text-anchor="middle" font-family="inherit">GPU3</text>
  <text x="16" y="108" font-size="13" fill="var(--sv-ink)" font-family="inherit">DDP 基线</text>
  <rect x="130" y="83" width="120" height="10" fill="var(--sv-a)"/>
  <rect x="130" y="99" width="120" height="10" fill="var(--sv-b)"/>
  <rect x="130" y="115" width="120" height="12" fill="var(--sv-c)"/>
  <rect x="275" y="83" width="120" height="10" fill="var(--sv-a)"/>
  <rect x="275" y="99" width="120" height="10" fill="var(--sv-b)"/>
  <rect x="275" y="115" width="120" height="12" fill="var(--sv-c)"/>
  <rect x="420" y="83" width="120" height="10" fill="var(--sv-a)"/>
  <rect x="420" y="99" width="120" height="10" fill="var(--sv-b)"/>
  <rect x="420" y="115" width="120" height="12" fill="var(--sv-c)"/>
  <rect x="565" y="83" width="120" height="10" fill="var(--sv-a)"/>
  <rect x="565" y="99" width="120" height="10" fill="var(--sv-b)"/>
  <rect x="565" y="115" width="120" height="12" fill="var(--sv-c)"/>
  <text x="16" y="176" font-size="13" fill="var(--sv-ink)" font-family="inherit">ZeRO-1</text>
  <rect x="130" y="151" width="120" height="10" fill="var(--sv-a)"/>
  <rect x="130" y="167" width="120" height="10" fill="var(--sv-b)"/>
  <rect x="130" y="183" width="30" height="12" fill="var(--sv-c)"/>
  <text x="164" y="193" font-size="12" fill="var(--sv-muted)" font-family="inherit">1/4</text>
  <rect x="275" y="151" width="120" height="10" fill="var(--sv-a)"/>
  <rect x="275" y="167" width="120" height="10" fill="var(--sv-b)"/>
  <rect x="275" y="183" width="30" height="12" fill="var(--sv-c)"/>
  <rect x="420" y="151" width="120" height="10" fill="var(--sv-a)"/>
  <rect x="420" y="167" width="120" height="10" fill="var(--sv-b)"/>
  <rect x="420" y="183" width="30" height="12" fill="var(--sv-c)"/>
  <rect x="565" y="151" width="120" height="10" fill="var(--sv-a)"/>
  <rect x="565" y="167" width="120" height="10" fill="var(--sv-b)"/>
  <rect x="565" y="183" width="30" height="12" fill="var(--sv-c)"/>
  <text x="16" y="244" font-size="13" fill="var(--sv-ink)" font-family="inherit">ZeRO-2</text>
  <rect x="130" y="219" width="120" height="10" fill="var(--sv-a)"/>
  <rect x="130" y="235" width="30" height="10" fill="var(--sv-b)"/>
  <rect x="130" y="251" width="30" height="12" fill="var(--sv-c)"/>
  <rect x="275" y="219" width="120" height="10" fill="var(--sv-a)"/>
  <rect x="275" y="235" width="30" height="10" fill="var(--sv-b)"/>
  <rect x="275" y="251" width="30" height="12" fill="var(--sv-c)"/>
  <rect x="420" y="219" width="120" height="10" fill="var(--sv-a)"/>
  <rect x="420" y="235" width="30" height="10" fill="var(--sv-b)"/>
  <rect x="420" y="251" width="30" height="12" fill="var(--sv-c)"/>
  <rect x="565" y="219" width="120" height="10" fill="var(--sv-a)"/>
  <rect x="565" y="235" width="30" height="10" fill="var(--sv-b)"/>
  <rect x="565" y="251" width="30" height="12" fill="var(--sv-c)"/>
  <text x="16" y="312" font-size="13" fill="var(--sv-ink)" font-family="inherit">ZeRO-3</text>
  <rect x="130" y="287" width="30" height="10" fill="var(--sv-a)"/>
  <rect x="130" y="303" width="30" height="10" fill="var(--sv-b)"/>
  <rect x="130" y="319" width="30" height="12" fill="var(--sv-c)"/>
  <rect x="275" y="287" width="30" height="10" fill="var(--sv-a)"/>
  <rect x="275" y="303" width="30" height="10" fill="var(--sv-b)"/>
  <rect x="275" y="319" width="30" height="12" fill="var(--sv-c)"/>
  <rect x="420" y="287" width="30" height="10" fill="var(--sv-a)"/>
  <rect x="420" y="303" width="30" height="10" fill="var(--sv-b)"/>
  <rect x="420" y="319" width="30" height="12" fill="var(--sv-c)"/>
  <rect x="565" y="287" width="30" height="10" fill="var(--sv-a)"/>
  <rect x="565" y="303" width="30" height="10" fill="var(--sv-b)"/>
  <rect x="565" y="319" width="30" height="12" fill="var(--sv-c)"/>
  <text x="20" y="360" font-size="12" fill="var(--sv-muted)" font-family="inherit">每列是一张 GPU；条越长表示保留的副本越多。ZeRO-3 每卡只留 1/4 的参数、梯度和优化器状态。</text>
</svg><figcaption>图 3 · ZeRO-1 切优化器状态，ZeRO-2 再切梯度，ZeRO-3 再切参数；激活不在这张图的切分范围内。</figcaption></figure>
<p><b>Stage 1</b> 只切优化器状态，每卡仍保留完整 BF16 权重与梯度。7B、N=8 时每参数 2 + 2 + 12/8 = 5.5 字节，约 38.5 GB。<b>Stage 2</b> 再切梯度：规约从 all-reduce 改成 reduce-scatter，每卡只留自己负责的那一片，降到 2 + 0.25 + 1.5 = 3.75 字节，约 26.25 GB；更新只在本卡的分片上做，更新后再 all-gather 出完整参数供下一轮前向使用。<b>Stage 3</b> 连参数也切：前向用到某层时 all-gather 该层参数，用完立即释放，反向再 all-gather 一次，每参数只剩 16/8 = 2 字节，约 14 GB。</p>
<p>省显存不是免费的。Stage 1 与 Stage 2 的通信量都与 DDP 基本持平：二者都是一次梯度 reduce-scatter 加一次更新后参数的 all-gather，合计约 4 字节/参数（BF16），与 DDP 的梯度 all-reduce 同量级；Stage 3 每步要做两次参数 all-gather 加一次梯度 reduce-scatter，合计约 6 字节/参数，为基线的 1.5 倍。它对互联带宽很敏感：NVLink 上 1.5 倍尚可接受，PCIe 上可能直接吃掉收益。</p>
<p>工程上还有两个细节。其一，DeepSpeed 会把参数按 bucket 合并后再 all-gather，bucket 太小通信次数多，太大则峰值显存高，常见量级是数亿参数；其二，Stage 3 的 all-gather 可以与计算重叠（overlap_comm），但重叠需要额外缓冲，实际显存会比理论值高 10-20%。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>方案</th><th>切分对象</th><th>每参数每步通信（BF16）</th><th>7B、N=8 参数态显存</th><th>典型场景</th></tr></thead><tbody>
<tr><td>DDP 基线</td><td>不切</td><td>约 4 B</td><td>112 GB</td><td>模型能放进单卡</td></tr>
<tr><td>ZeRO-1</td><td>优化器状态</td><td>约 4 B</td><td>38.5 GB</td><td>优化器状态是大头</td></tr>
<tr><td>ZeRO-2</td><td>再加梯度</td><td>约 4 B（与 DDP 持平）</td><td>26.25 GB</td><td>多数中等规模训练</td></tr>
<tr><td>ZeRO-3 / FSDP FULL_SHARD</td><td>再加参数</td><td>约 6 B（1.5 倍）</td><td>14 GB</td><td>单卡放不下参数</td></tr>
<tr><td>ZeRO-3 + CPU offload</td><td>优化器状态移到 CPU</td><td>6 B，另加约 4 B 的 PCIe 搬运</td><td>约 3.5 GB（优化器状态约 10.5 GB 在主机内存）</td><td>卡少、带宽充足</td></tr>
</tbody></table></div>
<p>PyTorch 的 FSDP（Fully Sharded Data Parallel）与 ZeRO-3 是同一类方法：FULL_SHARD 对应 ZeRO-3，SHARD_GRAD_OP 对应 ZeRO-2，HYBRID_SHARD 对应组内切分、组间复制。FSDP2 的 fully_shard 用 DTensor 做逐参数分片，API 更贴近原生模块。差异主要在工程形态：DeepSpeed 以引擎、JSON 配置和大量融合优化为中心；FSDP 是 PyTorch 原生，与 torch.compile 和分布式检查点集成更顺。选型先看团队已有栈，而不是只看论文数字。</p>
</section>

<section class="sec"><h2>Offload：用 PCIe 带宽换显存</h2>
<p>Offload 把优化器状态、梯度甚至参数放到 CPU 内存（pinned memory）或 NVMe，用 PCIe 带宽换显存。账要按实现口径算：一种做法把优化器 step 放在 CPU，状态常驻内存，每步只搬梯度 2 字节/参数和更新后的参数 2 字节/参数，合计 4 字节/参数，7B 约 28 GB；另一种做法把优化器状态临时换回 GPU 更新，12 字节/参数的状态要下传、回写各一次，仅状态往返就是 24 字节/参数，7B 约 168 GB，再加上更新后参数回写的 2-4 字节，约 26-28 字节/参数、180-196 GB。后者是保守上界。</p>
<div class="formula">V_step ≈ (4 ~ 28)P 字节；T ≈ V_step / BW_eff</div>
<p>PCIe 4.0 x16 单向理论带宽 32 GB/s，有效通常 20-25 GB/s。保守上界的 196 GB 需要约 8 秒，即便按 28 GB 也要约 1.1 秒。如果单步计算只要 0.5 秒，offload 仍会显著拖慢训练。只有当模型是计算密集、且计算时间足以掩盖搬运时间时，offload 才划算；小模型、小 batch 场景通常是负收益。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="GPU 互联与存储带宽对比条形图">
  <text x="20" y="24" font-size="15" fill="var(--sv-ink)" font-family="inherit">训练路径上的带宽阶梯（GB/s，对数刻度）</text>
  <line x1="170" y1="56" x2="170" y2="300" stroke="var(--sv-line)" stroke-width="1"/>
  <text x="160" y="86" font-size="12" fill="var(--sv-ink)" text-anchor="end" font-family="inherit">NVLink 4（H100）</text>
  <rect x="170" y="70" width="512" height="26" fill="var(--sv-a)"/>
  <text x="690" y="88" font-size="12" fill="var(--sv-ink)" font-family="inherit">450</text>
  <text x="160" y="134" font-size="12" fill="var(--sv-ink)" text-anchor="end" font-family="inherit">PCIe 5.0 x16</text>
  <rect x="170" y="118" width="341" height="26" fill="var(--sv-a2)"/>
  <text x="519" y="136" font-size="12" fill="var(--sv-ink)" font-family="inherit">64</text>
  <text x="160" y="182" font-size="12" fill="var(--sv-ink)" text-anchor="end" font-family="inherit">PCIe 4.0 x16</text>
  <rect x="170" y="166" width="280" height="26" fill="var(--sv-b)"/>
  <text x="458" y="184" font-size="12" fill="var(--sv-ink)" font-family="inherit">32</text>
  <text x="160" y="230" font-size="12" fill="var(--sv-ink)" text-anchor="end" font-family="inherit">PCIe 3.0 x16</text>
  <rect x="170" y="214" width="219" height="26" fill="var(--sv-b2)"/>
  <text x="397" y="232" font-size="12" fill="var(--sv-ink)" font-family="inherit">16</text>
  <text x="160" y="278" font-size="12" fill="var(--sv-ink)" text-anchor="end" font-family="inherit">NVMe 顺序读</text>
  <rect x="170" y="262" width="146" height="26" fill="var(--sv-c)"/>
  <text x="324" y="280" font-size="12" fill="var(--sv-ink)" font-family="inherit">7</text>
  <text x="20" y="326" font-size="12" fill="var(--sv-muted)" font-family="inherit">标称带宽，统一取单向；NVLink 4 单向 450 GB/s、双向合计 900 GB/s。实际有效值约为 60-80%，条形长度为对数刻度。</text>
  <text x="20" y="350" font-size="12" fill="var(--sv-muted)" font-family="inherit">7B 每步 offload 搬运约 4-28 B/参数（28-196 GB），PCIe 4.0 有效 25 GB/s 时约 1.1-8 s。</text>
</svg><figcaption>图 4 · NVLink、PCIe 与 NVMe 的带宽相差近两个数量级，这决定了 offload 的可行边界。</figcaption></figure>
<p>两篇后续工作把这条路线推到极限。ZeRO-Offload（2021）把优化器状态放在 CPU，用单张 32 GB V100 训练约 10B 参数模型；ZeRO-Infinity（2021）进一步用 NVMe 和内存中心的分块调度，在 512 张 GPU 上把可训练规模推到 32T 参数。它们的共同前提是：<b>带宽与计算要能重叠</b>，否则显存省下来了，吞吐也没了。</p>
<p>判断是否值得，可以看算术强度：每搬运 1 字节能换到多少次浮点运算。大 batch、长序列、大矩阵乘时强度高，搬运容易被掩盖；小 batch、短序列时强度低，PCIe 立即成为瓶颈。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>NVMe 顺序带宽通常 3-7 GB/s，只有 PCIe 4.0 x16 有效带宽的 1/3 到 1/8。把参数放 NVMe 只适合“能训起来比训得快更重要”的极端场景；生产训练优先用 NVLink 互联加 ZeRO-2/3，把 offload 当兜底。</div></div>
</section>

<section class="sec"><h2>配置落地：DeepSpeed 与 FSDP</h2>
<p>DeepSpeed 的配置以 JSON 为中心。下面的例子开启 ZeRO-3、把优化器状态放到 CPU、参数保留在 GPU，并打开通信重叠与连续梯度缓冲。字段含义：stage 选阶段；offload_optimizer.device 选 cpu 或 nvme；pin_memory 用锁页内存提高 PCIe 拷贝效率；overlap_comm 把 all-gather 与计算重叠；stage3_gather_16bit_weights_on_model_save 让保存时自动合并分片。</p>
<pre class="code" data-lang="json"><code>{
  "train_batch_size": 64,
  "gradient_accumulation_steps": 4,
  "bf16": { "enabled": true },
  "zero_optimization": {
    "stage": 3,
    "offload_optimizer": {
      "device": "cpu",
      "pin_memory": true
    },
    "offload_param": { "device": "none" },
    "overlap_comm": true,
    "contiguous_gradients": true,
    "stage3_gather_16bit_weights_on_model_save": true
  }
}</code></pre>
<p>启动命令把配置文件交给 deepspeed 启动器。注意全局 batch 由 train_batch_size 与 gradient_accumulation_steps 共同决定，改世界大小时要同步调整，否则等效学习率会漂移。</p>
<pre class="code" data-lang="bash"><code>deepspeed --num_gpus 8 train.py --deepspeed ds_config.json</code></pre>
<p>PyTorch 侧用 FSDP 包装模型。下面是最小可用配置：FULL_SHARD、BF16 混合精度、按 Transformer 层自动包装。auto_wrap_policy 决定分片粒度，粒度过粗会导致单次 all-gather 过大，过细则通信次数过多。</p>
<pre class="code" data-lang="python"><code>import torch
from functools import partial
from torch.distributed.fsdp import (
    FullyShardedDataParallel as FSDP,
    ShardingStrategy,
    MixedPrecision,
)
from torch.distributed.fsdp.wrap import transformer_auto_wrap_policy

mp_policy = MixedPrecision(
    param_dtype=torch.bfloat16,
    reduce_dtype=torch.bfloat16,
)

model = FSDP(
    model,
    sharding_strategy=ShardingStrategy.FULL_SHARD,
    auto_wrap_policy=partial(
        transformer_auto_wrap_policy,
        transformer_layer_cls={Block},
    ),
    mixed_precision=mp_policy,
    device_id=torch.cuda.current_device(),
)</code></pre>
<p>两个实现都有坑：ZeRO-3 保存时必须走 gather 逻辑，否则拿到的是分片；FSDP 的 state_dict 要用 FullStateDictConfig 收集，且 no_sync 只在梯度累积的非边界 step 使用。断点续训与分片检查点的细节在《数据管道与存储》一篇展开。</p>
</section>

<section class="sec"><h2>OOM 排查清单</h2>
<p>OOM 报错只告诉你“爆了”，不告诉你爆在哪。按下面的顺序排查，通常三步内能定位。</p>
<p>先做一个静态预算：参数态下限、最大激活、logits 与通信缓冲各留多少，加起来再乘 1.2。预算阶段就能排除一半的无效尝试。</p>
<ol>
<li><b>分清类型</b>：打印 torch.cuda.memory_allocated 与 memory_reserved。allocated 高是真实占用；reserved 远高于 allocated 是碎片。碎片可试环境变量 PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True。</li>
<li><b>算参数态下限</b>：参数量 × 16 字节；若已用 ZeRO/FSDP 切分，再除以世界大小，看是否超过卡容量。DDP 不切状态，每卡都要放完整一份。超了就升 ZeRO stage 或加卡，调 batch 没用。</li>
<li><b>看激活</b>：激活随 batch 与 seq 增长。先降 micro-batch、用梯度累积保持全局 batch，再开 activation checkpointing。</li>
<li><b>看峰值时刻</b>：OOM 常发生在第一次反向后或优化器 step。ZeRO-3 的 all-gather 峰值、logits 与 cross entropy 是常见爆点。</li>
<li><b>查计算图泄漏</b>：loss 累加未 detach、把输出存进 list、验证时忘记 torch.no_grad，都会让整张图常驻。</li>
<li><b>削临时区</b>：FlashAttention、fused optimizer、8-bit Adam、chunked cross entropy 都能省下一块。</li>
<li><b>最后才 offload</b>：确认 PCIe 有效带宽和计算重叠，否则是用吞吐换显存，得不偿失。</li>
</ol>
<div class="callout callout--tip"><span class="callout__label">技巧</span><div>训练脚本启动时先跑一个 micro-batch 的 dry run，打印 max_memory_allocated 与 max_memory_reserved，再按 1.2 倍余量选 batch。比在完整训练里撞 OOM 再回滚快得多。</div></div>
</section>

<section class="sec"><h2>自测</h2>
<details class="quiz"><summary>Q1 · 7B 模型、8 张 80 GB 卡、ZeRO-2、micro-batch 2、seq 2048，仍然 OOM，最可能的原因是什么？</summary><div class="quiz__a">参数态约 26.25 GB/卡，但 ZeRO-2 不切激活。按第 2 节口径，batch 2 的激活约 60 GB，两者相加已超过 80 GB，再叠加 logits、通信缓冲与碎片就会爆。先把 micro-batch 降回 1 并用梯度累积，或开 activation checkpointing；若还要长序列，再考虑序列并行（sequence parallel）。升到 ZeRO-3 只省参数态，救不了激活。</div></details>
<details class="quiz"><summary>Q2 · 为什么 activation checkpointing 的额外计算约为 33%，而不是重算一次前向的 100%？</summary><div class="quiz__a">基准是“前向 1 份 + 反向 2 份 = 3 份”。检查点额外做一次前向，总计算变成 4 份，增量是 1/3。反向没有被重算，所以不是翻倍。实际开销还受重算段粒度、算子融合和通信重叠影响，33% 是理想模型下的理论值，实际通常略高。</div></details>
<details class="quiz"><summary>Q3 · 什么情况下 ZeRO-3 反而不如 ZeRO-2？</summary><div class="quiz__a">当参数本身能放下、瓶颈在激活或通信时。ZeRO-3 每步要做两次参数 all-gather，比 ZeRO-2 多一次，通信量从约 4 字节/参数升到约 6 字节/参数（基线的 1.5 倍）；在 PCIe 互联或小模型上，这部分开销可能超过省显存带来的收益。判断标准很简单：先算参数态是否超过单卡容量，超了才需要 Stage 3；没超就优先 Stage 2。</div></details>
<details class="quiz"><summary>Q4 · 为什么 ZeRO-1 在 7B、N=8 时只降到 38.5 GB，而不是 14 GB？</summary><div class="quiz__a">因为 Stage 1 只切 12 字节的优化器状态。权重 2 字节和梯度 2 字节仍每卡一份，所以是 2 + 2 + 12/8 = 5.5 字节/参数。要让每卡只留 2 字节，必须同时切梯度和参数，也就是 Stage 3。</div></details>
</section>

<section class="sec"><h2>延伸阅读</h2>
<ul class="refs">
<li><b>ZeRO: Memory Optimizations Toward Training Trillion Parameter Models</b> — Rajbhandari et al., SC 2020。三阶段切分与通信量分析的原始论文。</li>
<li><b>ZeRO-Offload: Democratizing Billion-Scale Model Training</b> — Ren et al., USENIX ATC 2021。CPU offload 的调度设计与单卡十亿级训练实验。</li>
<li><b>ZeRO-Infinity: Breaking the GPU Memory Wall for Extreme Scale Deep Learning</b> — Rajbhandari et al., SC 2021。NVMe offload、内存中心分块与超大模型训练。</li>
<li><b>Reducing Activation Recomputation in Large Transformer Models</b> — Korthikanti et al., MLSys 2023。激活估算公式与选择性重计算的来源。</li>
<li><b>PyTorch FSDP 文档与教程</b> — PyTorch 官方。FULL_SHARD、混合精度、状态字典与 FSDP2 的权威说明。</li>
</ul>
</section>`
};
