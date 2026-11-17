window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["mixed-precision"] = {
  slug: "mixed-precision",
  title: "混合精度与量化基础",
  subtitle: "用更少的比特换更多的算力",
  level: 2,
  cluster: "单机优化",
  tags: ["BF16", "FP8", "Autocast"],
  summary: "比较 FP32、TF32、FP16、BF16、FP8 与 INT8 的范围和精度，讲清主权重、损失缩放、autocast 与累加精度，以及量化 scale 与粒度选择。",
  keyPoints: [
    "指数位决定动态范围，尾数位决定相对精度；BF16 用 8 位指数换取与 FP32 相同的范围",
    "混合精度训练的三件套是 FP32 主权重、损失缩放（FP16 必需，BF16 通常不需要）与按算子 autocast，Tensor Core 的 FP32 累加不可省",
    "量化误差来自截断与舍入；per-channel 与 per-group 用更多 scale 换更低误差，G=128 的 FP32 scale 开销约 0.25 bit/权重"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
  <h2>先建立直觉：精度是一份预算</h2>
  <p>训练大模型时，<mark>混合精度（mixed precision）</mark>不是把模型整体换成低精度，而是把不同的计算分配到不同的数值格式：吃算力的矩阵乘用 16 位甚至 8 位，容易溢出或需要精细累加的归约、归一化、损失函数留在 32 位。这样做的直接收益是 <mark>Tensor Core</mark> 吞吐更高、显存与带宽占用更少；代价是数值误差，以及一套额外的工程约束。</p>
  <p>为什么不能“全用 FP16”？因为浮点数的<mark>动态范围（dynamic range）</mark>由指数位决定。FP16 的最大有限值只有 65504，最小正规数约 6.10e−5；Transformer 的 attention logits、LayerNorm 方差、梯度范数在训练早期很容易越过这两条边界。反过来，全部用 FP32 又浪费了 Tensor Core 在低精度下的数倍吞吐。混合精度就是在这两者之间做预算分配，而不是无条件追求更低位宽。</p>
  <p>这套思路最早由 Micikevicius 等人在 2017 年系统化：保留一份 FP32 的主权重，前向和反向大部分用 FP16，敏感运算留在 FP32，再用损失缩放把 FP16 装不下的梯度搬回可表示区间。后来的 BF16 把“范围”这条约束基本消掉，FP8 又把“精度”推到新的极限。理解这三个格式的取舍，比记住某个框架的开关更重要。</p>
  <div class="callout callout--intuition"><span class="callout__label">直觉</span><div>把浮点格式想成集装箱：指数位是箱子的高度，决定能装多大的数；尾数位是箱内的刻度，决定能分多细。BF16 的箱子高度和 FP32 一样，只是刻度粗；FP16 的刻度细，但箱子矮，装不下大数，也装不下极小的梯度。</div></div>
</section>

<section class="sec">
  <h2>浮点的两个旋钮：指数与尾数</h2>
  <p>IEEE 754 浮点数由三部分组成：1 位符号位（sign）、若干位指数（exponent）、若干位尾数（mantissa，也叫有效数 significand）。一个正规数的值可以写成下面的形式，其中 m 是尾数小数部分，p 是显式尾数位数，e 是存储指数，bias 是指数偏移（exponent bias），E = e − bias 是实际参与运算的无偏指数：</p>
  <div class="formula">x = (−1)^s × 1.m × 2^(e − bias)，记 E = e − bias
相邻可表示数的间距 ulp ≈ 2^(E − p)
相对精度 ε ≈ 2^(−(p + 1))</div>
  <p>公式里最关键的一点：<b>指数位决定能表示多大的数，尾数位决定在这个量级上能分多细</b>。指数位每多 1 位，能覆盖的 2 的幂次范围翻倍；尾数位每多 1 位，相对精度翻倍。符号位不参与范围和精度，只决定正负。所谓“正规数”之外还有次正规数（subnormal），它们用尾数前导零换取更小的绝对值，但有效位数会随之减少，精度更差。</p>
  <p>以 FP32 为例，8 位指数、23 位尾数，加上隐含的整数位 1，有效精度是 24 位，约合 7.2 位十进制；动态范围约 1.18e−38 到 3.40e38。BF16 把尾数砍到 7 位，有效精度只剩 8 位，约 2.4 位十进制，相对误差约 0.39%，但保留 8 位指数，所以范围和 FP32 几乎一样。FP16 则是 5 位指数、10 位尾数：精度比 BF16 细，范围却窄得多。这三种格式的差别，几乎都能从“几个指数位、几个尾数位”推出来。</p>
  <figure class="fig">
    <svg viewBox="0 0 760 380" width="100%" role="img" aria-label="FP32、TF32、FP16、BF16、FP8 与 INT8 的符号位、指数位和尾数位分配对比">
      <text x="20" y="30" font-size="13" fill="var(--sv-muted)" font-family="inherit">每格 1 bit；条形长度为参与计算的字段位宽合计（并非存储宽度）</text>
      <rect x="420" y="18" width="12" height="12" fill="var(--sv-a)" />
      <text x="438" y="29" font-size="12" fill="var(--sv-ink)" font-family="inherit">符号位</text>
      <rect x="510" y="18" width="12" height="12" fill="var(--sv-b)" />
      <text x="528" y="29" font-size="12" fill="var(--sv-ink)" font-family="inherit">指数位</text>
      <rect x="600" y="18" width="12" height="12" fill="var(--sv-c)" />
      <text x="618" y="29" font-size="12" fill="var(--sv-ink)" font-family="inherit">尾数位</text>

      <text x="20" y="72" font-size="13" font-weight="bold" fill="var(--sv-ink)" font-family="inherit">FP32</text>
      <text x="20" y="88" font-size="12" fill="var(--sv-muted)" font-family="inherit">范围 1.18e−38 ~ 3.40e38</text>
      <rect x="220" y="54" width="15" height="28" fill="var(--sv-a)" />
      <rect x="235" y="54" width="120" height="28" fill="var(--sv-b)" />
      <rect x="355" y="54" width="345" height="28" fill="var(--sv-c)" />
      <text x="227" y="73" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">S</text>
      <text x="295" y="73" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">8</text>
      <text x="527" y="73" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">23</text>

      <text x="20" y="120" font-size="13" font-weight="bold" fill="var(--sv-ink)" font-family="inherit">TF32</text>
      <text x="20" y="136" font-size="12" fill="var(--sv-muted)" font-family="inherit">范围同 FP32 · Tensor Core 输入</text>
      <rect x="220" y="102" width="15" height="28" fill="var(--sv-a)" />
      <rect x="235" y="102" width="120" height="28" fill="var(--sv-b)" />
      <rect x="355" y="102" width="150" height="28" fill="var(--sv-c)" />
      <text x="227" y="121" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">S</text>
      <text x="295" y="121" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">8</text>
      <text x="430" y="121" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">10</text>

      <text x="20" y="168" font-size="13" font-weight="bold" fill="var(--sv-ink)" font-family="inherit">FP16</text>
      <text x="20" y="184" font-size="12" fill="var(--sv-muted)" font-family="inherit">范围 6.10e−5 ~ 65504</text>
      <rect x="220" y="150" width="15" height="28" fill="var(--sv-a)" />
      <rect x="235" y="150" width="75" height="28" fill="var(--sv-b)" />
      <rect x="310" y="150" width="150" height="28" fill="var(--sv-c)" />
      <text x="227" y="169" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">S</text>
      <text x="272" y="169" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">5</text>
      <text x="385" y="169" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">10</text>

      <text x="20" y="216" font-size="13" font-weight="bold" fill="var(--sv-ink)" font-family="inherit">BF16</text>
      <text x="20" y="232" font-size="12" fill="var(--sv-muted)" font-family="inherit">范围同 FP32 · 尾数 7 位</text>
      <rect x="220" y="198" width="15" height="28" fill="var(--sv-a)" />
      <rect x="235" y="198" width="120" height="28" fill="var(--sv-b)" />
      <rect x="355" y="198" width="105" height="28" fill="var(--sv-c)" />
      <text x="227" y="217" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">S</text>
      <text x="295" y="217" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">8</text>
      <text x="407" y="217" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">7</text>

      <text x="20" y="264" font-size="13" font-weight="bold" fill="var(--sv-ink)" font-family="inherit">FP8 E4M3</text>
      <text x="20" y="280" font-size="12" fill="var(--sv-muted)" font-family="inherit">最大 448 · 相对精度 6.25%</text>
      <rect x="220" y="246" width="15" height="28" fill="var(--sv-a)" />
      <rect x="235" y="246" width="60" height="28" fill="var(--sv-b)" />
      <rect x="295" y="246" width="45" height="28" fill="var(--sv-c)" />
      <text x="227" y="265" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">S</text>
      <text x="265" y="265" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">4</text>
      <text x="317" y="265" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">3</text>

      <text x="20" y="312" font-size="13" font-weight="bold" fill="var(--sv-ink)" font-family="inherit">FP8 E5M2</text>
      <text x="20" y="328" font-size="12" fill="var(--sv-muted)" font-family="inherit">最大 57344 · 相对精度 12.5%</text>
      <rect x="220" y="294" width="15" height="28" fill="var(--sv-a)" />
      <rect x="235" y="294" width="75" height="28" fill="var(--sv-b)" />
      <rect x="310" y="294" width="30" height="28" fill="var(--sv-c)" />
      <text x="227" y="313" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">S</text>
      <text x="272" y="313" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">5</text>
      <text x="325" y="313" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">2</text>

      <text x="20" y="360" font-size="13" font-weight="bold" fill="var(--sv-ink)" font-family="inherit">INT8</text>
      <text x="20" y="376" font-size="12" fill="var(--sv-muted)" font-family="inherit">值域 −128 ~ 127（有符号）</text>
      <rect x="220" y="342" width="120" height="28" fill="var(--sv-c)" />
      <text x="280" y="361" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">8 bit 整数</text>
    </svg>
    <figcaption>图 1 · 位宽分配决定了范围与精度：指数位越多范围越大，尾数位越多相对精度越高。FP8 的两种变体在范围与精度之间做了不同取舍。TF32 条形只画 19 位有效字段，实际存放在 32 位寄存器中；INT8 是 8 位整数，没有指数与尾数之分。</figcaption>
  </figure>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>格式</th><th>符号 / 指数 / 尾数</th><th>指数偏移</th><th>最大有限值</th><th>最小值（浮点为最小正规数）</th><th>约合十进制位</th><th>典型用途</th></tr></thead><tbody>
    <tr><td>FP32</td><td>1 / 8 / 23</td><td>127</td><td>3.40e38</td><td>1.18e−38</td><td>7.2</td><td>主权重、优化器状态、基准</td></tr>
    <tr><td>TF32</td><td>1 / 8 / 10</td><td>127</td><td>3.40e38</td><td>1.18e−38</td><td>3.3</td><td>FP32 矩阵乘的 Tensor Core 输入</td></tr>
    <tr><td>FP16</td><td>1 / 5 / 10</td><td>15</td><td>65504</td><td>6.10e−5</td><td>3.3</td><td>推理、需损失缩放的训练</td></tr>
    <tr><td>BF16</td><td>1 / 8 / 7</td><td>127</td><td>3.39e38</td><td>1.18e−38</td><td>2.4</td><td>大模型训练默认</td></tr>
    <tr><td>FP8 E4M3</td><td>1 / 4 / 3</td><td>7</td><td>448</td><td>1.56e−2</td><td>1.2</td><td>前向权重与激活，需缩放</td></tr>
    <tr><td>FP8 E5M2</td><td>1 / 5 / 2</td><td>15</td><td>57344</td><td>6.10e−5</td><td>0.9</td><td>反向梯度，需缩放</td></tr>
    <tr><td>INT8</td><td>无指数，8 位整数</td><td>—</td><td>127</td><td>−128</td><td>取决于 scale</td><td>量化推理与量化权重</td></tr>
  </tbody></table></div>
  <p>表里的“约合十进制位”按 log10(2^有效位数) 估算，只用于横向比较，不代表模型精度的直接损失。TF32 比较特殊：它不是一个存储格式，而是 NVIDIA Ampere 及之后 Tensor Core 在 FP32 矩阵乘时采用的输入格式，指数 8 位、尾数 10 位，因此范围与 FP32 相同，精度低于 FP32 但高于 BF16。图 1 画的是参与计算的字段，TF32 在寄存器中仍占 32 位。</p>
</section>

<section class="sec">
  <h2>格式谱系：从 FP32 到 FP8 与 INT8</h2>
  <p>把常见格式排成一条谱系，可以看到它们各自在“范围”和“精度”之间做的取舍。<b>FP32</b> 是基准，也是主权重和优化器状态的默认格式。<b>TF32</b> 在 A100/H100 上把 FP32 矩阵乘的输入舍入到 10 位尾数，打开开关后通常不必改模型代码就能获得数倍加速；PyTorch 用 torch.backends.cuda.matmul.allow_tf32 控制，该开关从 1.12 起对矩阵乘默认关闭、需要显式开启，而 cuDNN 卷积对应的 torch.backends.cudnn.allow_tf32 默认开启。<b>FP16</b> 精度够细，但范围窄，训练时需要损失缩放。<b>BF16</b> 用 8 位指数换回与 FP32 相同的范围，是当前大模型训练的默认选择。</p>
  <p><b>FP8</b> 有两种常见变体：E4M3（4 位指数、3 位尾数，最大 448）和 E5M2（5 位指数、2 位尾数，最大 57344）。E4M3 精度稍好、范围更窄，常用于前向的权重与激活；E5M2 范围更宽、精度更粗，常用于反向梯度。FP8 的范围小到无法直接容纳未经缩放的张量，因此必须配合 per-tensor 的缩放因子（scaling factor），并且通常需要根据历史 amax 动态更新；这部分在 FP8 训练里是核心工程，不是“把 dtype 改一下”就能完成。<b>INT8</b> 则完全没有指数，只有 256 个离散整数，必须依靠 scale 和 zero-point 把实数映射进来，属于量化的范畴。</p>
  <p>硬件峰值差异是混合精度最直接的动机。下表列出 NVIDIA 官方 datasheet 的稠密（dense，不含 2:4 稀疏加速）峰值，均为 boost clock 口径：</p>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>设备</th><th>FP32（CUDA Core）</th><th>TF32 Tensor Core</th><th>BF16 / FP16 Tensor Core</th><th>FP8 Tensor Core</th><th>INT8 Tensor Core</th><th>HBM 带宽</th></tr></thead><tbody>
    <tr><td>A100 80GB SXM</td><td>19.5 TFLOPS</td><td>156 TFLOPS</td><td>312 TFLOPS</td><td>不支持</td><td>624 TOPS</td><td>2039 GB/s</td></tr>
    <tr><td>H100 SXM</td><td>67 TFLOPS</td><td>495 TFLOPS</td><td>989 TFLOPS</td><td>1979 TFLOPS</td><td>1979 TOPS</td><td>3350 GB/s</td></tr>
    <tr><td>H100 PCIe</td><td>51.2 TFLOPS</td><td>378 TFLOPS</td><td>756 TFLOPS</td><td>1513 TFLOPS</td><td>1513 TOPS</td><td>2000 GB/s</td></tr>
  </tbody></table></div>
  <p>从表里能读出两件事。第一，H100 SXM 的 BF16 稠密峰值约 989 TFLOPS，是 FP32 67 TFLOPS 的约 14.8 倍；FP8 约 1979 TFLOPS，约 29.5 倍。第二，HBM 带宽只从 A100 的 2039 GB/s 涨到 H100 SXM 的 3350 GB/s，约 1.6 倍。这意味着<b>低精度的算力优势只对 compute-bound 的算子成立</b>；LayerNorm、softmax、逐元素加法这些 memory-bound 算子拿到的是位宽减半带来的带宽收益，而不是 Tensor Core 的峰值收益，若还要从 FP32 临时 cast，甚至可能更慢。</p>
  <div class="callout callout--warn"><span class="callout__label">注意</span><div>厂商标称的 TFLOPS 是理论峰值，实际 kernel 受限于显存带宽、occupancy、指令发射和形状。看到“FP8 快 2 倍”时，先问是哪个算子、什么 shape、batch 多大、是否 compute-bound。算力表里的“稠密”也常被忽略：带 2:4 稀疏的峰值通常是稠密的两倍。</div></div>
</section>

<section class="sec">
  <h2>混合精度训练：三件套与 autocast</h2>
  <p>Micikevicius 等人在 2017 年的 <i>Mixed Precision Training</i> 里把方法归纳为三条：<b>FP32 主权重（master weights）</b>、<b>损失缩放（loss scaling）</b>，以及在前向和反向中用 FP16 执行大部分运算。今天 PyTorch 的<b>自动混合精度（Automatic Mixed Precision, AMP）</b>把第三条做成了 autocast：它按算子维护一张策略表，把矩阵乘、卷积、Linear 等送到低精度 Tensor Core，把 softmax、LayerNorm、归约、损失函数留在 FP32。</p>
  <p>主权重解决的是“更新被吃掉”的问题。假设某个权重 w ≈ 1.0，学习率 1e−4、梯度 0.1，单步更新量约 1e−5。BF16 在 1.0 附近的 ulp 是 2^−7 ≈ 7.8e−3，FP16 是 2^−10 ≈ 9.8e−4；直接把 1e−5 加到低精度权重上会被舍入成 0。因此优化器始终保留一份 FP32 权重和 FP32 的动量、方差，更新在 FP32 中完成，下一次前向再 cast 成低精度。PyTorch 的 model parameters 默认就是 FP32，autocast 只改算子输入，不会改参数本身，所以这套机制是隐式生效的。</p>
  <p>损失缩放通常只对 FP16 必要。FP16 的最小正规数约 6.10e−5，很多梯度分量小于这个值，会变成 0 或次正规数，训练信号丢失。做法是把 loss 乘以一个缩放因子 S，常见从 2^16 = 65536 起步，反向传播得到的梯度也同比放大；在 optimizer.step 之前再除以 S（unscale），并跳过出现 inf 或 NaN 的步，动态调整 S。BF16 的指数范围与 FP32 相同，梯度下溢不是主要矛盾，所以通常不需要 GradScaler；但梯度裁剪、异常值监控仍然要做。</p>
  <figure class="fig">
    <svg viewBox="0 0 760 380" width="100%" role="img" aria-label="autocast 训练数据流：FP32 主权重、低精度前向、敏感算子保持 FP32、FP32 累加、反向与优化器更新">
      <defs>
        <marker id="mixed-precision-arrow2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--sv-muted)" />
        </marker>
      </defs>
      <rect x="40" y="28" width="300" height="50" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)" />
      <text x="58" y="49" font-size="13" fill="var(--sv-ink)" font-family="inherit">FP32 主权重 + 优化器状态</text>
      <text x="58" y="67" font-size="12" fill="var(--sv-muted)" font-family="inherit">master weights，更新在 FP32 完成</text>
      <rect x="420" y="28" width="300" height="50" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)" />
      <text x="438" y="49" font-size="13" fill="var(--sv-ink)" font-family="inherit">参数 cast 为低精度副本</text>
      <text x="438" y="67" font-size="12" fill="var(--sv-muted)" font-family="inherit">仅前向临时使用，不回写</text>
      <line x1="340" y1="53" x2="412" y2="53" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#mixed-precision-arrow2)" />
      <text x="360" y="46" font-size="12" fill="var(--sv-muted)" font-family="inherit">cast</text>

      <rect x="420" y="118" width="300" height="50" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)" />
      <text x="438" y="139" font-size="13" fill="var(--sv-ink)" font-family="inherit">矩阵乘 / 卷积 / Linear</text>
      <text x="438" y="157" font-size="12" fill="var(--sv-muted)" font-family="inherit">Tensor Core：BF16 / FP16 / FP8</text>
      <line x1="570" y1="78" x2="570" y2="110" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#mixed-precision-arrow2)" />

      <rect x="40" y="118" width="300" height="50" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)" />
      <text x="58" y="139" font-size="13" fill="var(--sv-ink)" font-family="inherit">Softmax / LayerNorm / 归约 / Loss</text>
      <text x="58" y="157" font-size="12" fill="var(--sv-muted)" font-family="inherit">保持 FP32，避免溢出</text>
      <line x1="412" y1="143" x2="348" y2="143" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#mixed-precision-arrow2)" />

      <rect x="40" y="208" width="300" height="50" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)" />
      <text x="58" y="229" font-size="13" fill="var(--sv-ink)" font-family="inherit">FP32 累加器</text>
      <text x="58" y="247" font-size="12" fill="var(--sv-muted)" font-family="inherit">MMA 输出、残差相加</text>
      <line x1="190" y1="168" x2="190" y2="200" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#mixed-precision-arrow2)" />

      <rect x="420" y="208" width="300" height="50" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)" />
      <text x="438" y="229" font-size="13" fill="var(--sv-ink)" font-family="inherit">反向传播</text>
      <text x="438" y="247" font-size="12" fill="var(--sv-muted)" font-family="inherit">沿用 autocast 策略，参数梯度累加回 FP32</text>
      <line x1="340" y1="233" x2="412" y2="233" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#mixed-precision-arrow2)" />
      <text x="360" y="226" font-size="12" fill="var(--sv-muted)" font-family="inherit">反向</text>

      <rect x="420" y="298" width="300" height="50" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)" />
      <text x="438" y="319" font-size="13" fill="var(--sv-ink)" font-family="inherit">FP16：GradScaler 放大 / 反放大</text>
      <text x="438" y="337" font-size="12" fill="var(--sv-muted)" font-family="inherit">BF16：通常不需要缩放</text>
      <line x1="570" y1="258" x2="570" y2="290" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#mixed-precision-arrow2)" />

      <rect x="40" y="298" width="300" height="50" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)" />
      <text x="58" y="319" font-size="13" fill="var(--sv-ink)" font-family="inherit">优化器 step</text>
      <text x="58" y="337" font-size="12" fill="var(--sv-muted)" font-family="inherit">FP32 更新后写回主权重</text>
      <line x1="412" y1="323" x2="348" y2="323" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#mixed-precision-arrow2)" />
      <text x="360" y="316" font-size="12" fill="var(--sv-muted)" font-family="inherit">更新</text>

      <path d="M 40 323 L 16 323 L 16 53 L 32 53" fill="none" stroke="var(--sv-line)" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#mixed-precision-arrow2)" />
      <text x="22" y="190" font-size="12" fill="var(--sv-muted)" font-family="inherit">写回</text>
    </svg>
    <figcaption>图 2 · autocast 的数据流：参数在 FP32 中保存，前向按算子临时 cast；敏感算子留在 FP32，反向沿用同一策略，优化器始终在 FP32 中更新。</figcaption>
  </figure>
  <pre class="code" data-lang="python"><code>import torch
from torch.amp import autocast, GradScaler

model = model.cuda()
optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4)
x, y = batch

# BF16：范围与 FP32 相同，通常不需要 GradScaler
optimizer.zero_grad(set_to_none=True)
with autocast(device_type="cuda", dtype=torch.bfloat16):
    logits = model(x)
    loss = torch.nn.functional.cross_entropy(logits.float(), y)
loss.backward()
torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
optimizer.step()

# FP16：动态损失缩放四步
optimizer.zero_grad(set_to_none=True)
scaler = GradScaler("cuda")
with autocast(device_type="cuda", dtype=torch.float16):
    logits = model(x)
    loss = torch.nn.functional.cross_entropy(logits.float(), y)
scaler.scale(loss).backward()
scaler.unscale_(optimizer)
torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
scaler.step(optimizer)
scaler.update()
</code></pre>
  <p>代码示例使用较新的 PyTorch torch.amp 接口，GradScaler 需要传入 device 参数；旧版本对应 torch.cuda.amp。注意梯度裁剪必须在 unscale 之后，否则裁的是被放大过的梯度，阈值失去意义。autocast 的策略是“算子级”而不是“张量级”的：同一个张量进入 matmul 时被 cast 成 BF16，进入 LayerNorm 时又回到 FP32。这带来两个工程后果：cast 本身有开销，算子太碎时可能抵消收益；某些自定义 kernel 或原地操作对 dtype 敏感，需要显式标注 autocast 的禁用区域。PyTorch 提供 torch.autocast 上下文和 torch.amp.custom_fwd、custom_bwd 装饰器来处理这类边界。</p>
  <div class="callout callout--tip"><span class="callout__label">技巧</span><div>判断一个算子该不该进低精度，看它是否 compute-bound、是否对范围敏感。矩阵乘、卷积通常可以；softmax 的 exp、LayerNorm 的方差、cross-entropy 的 log-sum-exp 通常不行。拿不准时，先用最小复现跑 FP32 与混合精度各一步，比较 loss 和梯度范数。</div></div>
</section>

<section class="sec">
  <h2>被忽视的第三个数：累加精度</h2>
  <p>一次矩阵乘 y = Σ aₖbₖ 里其实有三个精度：输入 a、b 的精度，乘法的精度，以及<b>累加器（accumulator）</b>的精度。Tensor Core 的典型做法是输入 BF16 或 FP16、乘积精确、累加用 FP32。累加精度不够时，即使每个乘积都正确，把几千项加起来也会丢有效位，甚至溢出。</p>
  <div class="formula">y = Σₖ₌₁ᴷ aₖ × bₖ
每个乘积的舍入相对误差 ≤ ε
最坏情况误差随 K 增长，随机舍入下近似随 √K 增长</div>
  <p>因此“FP16 训练”通常指的是输入 FP16、累加 FP32，而不是连累加都用 FP16。NVIDIA 数据中心 GPU 的 BF16/FP16 Tensor Core 在 FP32 累加下提供全速；部分消费级 GPU 的 FP16 累加可以到两倍速率，但数值风险更高，适合推理而不是训练。选卡或写 kernel 时，要看清楚标称算力对应的是 FP32 accumulate 还是 FP16 accumulate，这两个数字经常被混在一起宣传。</p>
  <p>累加精度还影响注意力和归一化。FlashAttention 在内部对 QKᵀ 和 PV 做 FP32 累加，softmax 的 max 与 sum 也在 FP32 中完成；LayerNorm 的均值、方差同理。把这些步骤强行改成 BF16，常见现象是训练初期 loss 抖动，长序列下更明显。混合精度的“混合”二字，本质上就是给这些敏感步骤留出 FP32 的空间，而不是简单地把所有 dtype 全局替换。</p>
  <div class="callout callout--formula"><span class="callout__label">检查</span><div>把同一 batch 分别跑 FP32 和混合精度一步，比较 loss 与梯度范数的相对差。若相对差在 1e−3 量级且不随 step 放大，通常可接受；若出现 NaN 或范数数量级跳变，先查溢出，而不是先调学习率。</div></div>
</section>

<section class="sec">
  <h2>量化基础：scale、zero-point 与粒度</h2>
  <p><b>量化（quantization）</b>把浮点张量映射到低位宽整数，核心是仿射变换。最常用的是 <b>INT8</b>：8 位、256 个等级。映射需要两个参数：<b>缩放因子（scale）</b>s 和<b>零点（zero-point）</b>z。<b>对称量化（symmetric）</b>令 z = 0，适合以 0 为中心、分布近似对称的权重；<b>非对称量化（asymmetric）</b>允许 z ≠ 0，适合 ReLU 之后全非负的激活。</p>
  <div class="formula">s = (x_max − x_min) / (q_max − q_min)
z = q_min − round(x_min / s)
q = clamp(round(x / s) + z, q_min, q_max)
x̂ = (q − z) × s

对称特例：z = 0，s = max(|x_min|, |x_max|) / q_max
q 取 −127 … 127（有符号 INT8）</div>
  <p>粒度决定“一个 scale 管多少个数”。<b>per-tensor</b> 整个张量一个 scale，元数据最少，但一个离群值会把有效范围撑大，害得所有数都变粗；<b>per-channel</b> 每个输出通道一个 scale，是卷积和 Linear 权重的常规做法；<b>per-group</b> 把 K 维切成每 G 个元素一组，每组一个 scale，在 LLM 权重上非常常见，G 通常取 64 或 128；<b>per-token</b> 则用于激活，每个 token 一个 scale，能吸收不同 token 之间的幅度差异。</p>
  <p>粒度越细，误差越小，但 scale 的存储和读取开销越大。用 FP32 存 scale 时，每个权重摊到的比特数是：</p>
  <div class="formula">bits/weight ≈ 8 + 32 / G   （INT8 权重，FP32 scale）
G = 128 → 8.25 bit；G = 32 → 9 bit</div>
  <p>也就是说，G = 128 只比纯 INT8 多约 3% 的存储，却能把离群值的影响限制在 128 个元素内，这是它成为默认选择的原因。若 scale 用 FP16 存，开销减半为 16/G。图 3 上半部分是误差随 group size 变化的示意趋势，下半部分是按上式算出的精确开销。</p>
  <figure class="fig">
    <svg viewBox="0 0 760 380" width="100%" role="img" aria-label="量化误差随 group size 减小而下降但收益递减，以及每组 scale 的额外比特开销">
      <text x="90" y="28" font-size="12" fill="var(--sv-ink)" font-family="inherit">相对量化误差（对 per-tensor 归一化，示意趋势）</text>
      <line x1="80" y1="44" x2="80" y2="205" stroke="var(--sv-line)" stroke-width="1.2" />
      <line x1="80" y1="205" x2="700" y2="205" stroke="var(--sv-line)" stroke-width="1.2" />
      <line x1="80" y1="84" x2="700" y2="84" stroke="var(--sv-line)" stroke-width="0.8" stroke-dasharray="4 5" />
      <line x1="80" y1="124" x2="700" y2="124" stroke="var(--sv-line)" stroke-width="0.8" stroke-dasharray="4 5" />
      <line x1="80" y1="164" x2="700" y2="164" stroke="var(--sv-line)" stroke-width="0.8" stroke-dasharray="4 5" />
      <text x="70" y="48" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">1.0×</text>
      <text x="70" y="88" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">0.75×</text>
      <text x="70" y="128" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">0.5×</text>
      <text x="70" y="168" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">0.25×</text>
      <text x="70" y="209" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">0</text>
      <polyline points="110,44 220,78 330,112 440,138 550,150 660,154" fill="none" stroke="var(--sv-a)" stroke-width="2.5" />
      <circle cx="110" cy="44" r="4" fill="var(--sv-a)" />
      <circle cx="220" cy="78" r="4" fill="var(--sv-a)" />
      <circle cx="330" cy="112" r="4" fill="var(--sv-a)" />
      <circle cx="440" cy="138" r="4" fill="var(--sv-a)" />
      <circle cx="550" cy="150" r="4" fill="var(--sv-a)" />
      <circle cx="660" cy="154" r="4" fill="var(--sv-a)" />
      <line x1="440" y1="138" x2="440" y2="205" stroke="var(--sv-a)" stroke-width="1" stroke-dasharray="4 4" />
      <text x="448" y="130" font-size="12" fill="var(--sv-ink)" font-family="inherit">G=128 常用</text>
      <text x="560" y="180" font-size="12" fill="var(--sv-muted)" font-family="inherit">G 再小，收益递减</text>
      <text x="110" y="221" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">1024</text>
      <text x="220" y="221" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">512</text>
      <text x="330" y="221" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">256</text>
      <text x="440" y="221" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">128</text>
      <text x="550" y="221" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">64</text>
      <text x="660" y="221" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">32</text>
      <text x="390" y="240" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">group size（每组元素数，向右变小）</text>

      <line x1="80" y1="252" x2="700" y2="252" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="6 4" />
      <text x="90" y="270" font-size="12" fill="var(--sv-ink)" font-family="inherit">每组 scale 的额外比特（FP32 scale：32 / G）</text>
      <line x1="80" y1="340" x2="700" y2="340" stroke="var(--sv-line)" stroke-width="1.2" />
      <text x="70" y="343" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">0</text>
      <text x="70" y="317" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">0.5</text>
      <text x="70" y="290" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">1.0</text>
      <rect x="88" y="338.34" width="44" height="1.66" fill="var(--sv-b)" />
      <rect x="198" y="336.69" width="44" height="3.31" fill="var(--sv-b)" />
      <rect x="308" y="333.38" width="44" height="6.62" fill="var(--sv-b)" />
      <rect x="418" y="326.75" width="44" height="13.25" fill="var(--sv-b)" />
      <rect x="528" y="313.5" width="44" height="26.5" fill="var(--sv-b)" />
      <rect x="638" y="287" width="44" height="53" fill="var(--sv-b)" />
      <text x="110" y="334" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">0.03</text>
      <text x="220" y="331" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">0.06</text>
      <text x="330" y="328" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">0.13</text>
      <text x="440" y="321" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">0.25</text>
      <text x="550" y="307" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">0.50</text>
      <text x="660" y="279" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">1.00</text>
      <text x="110" y="356" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">1024</text>
      <text x="220" y="356" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">512</text>
      <text x="330" y="356" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">256</text>
      <text x="440" y="356" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">128</text>
      <text x="550" y="356" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">64</text>
      <text x="660" y="356" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">32</text>
    </svg>
    <figcaption>图 3 · 上：group 越小，量化误差越低，但收益递减，曲线为示意趋势而非实测；下：FP32 scale 的额外比特按 32/G 精确增长，G=128 时仅 0.25 bit/权重。</figcaption>
  </figure>
  <p>误差主要有四个来源：<b>截断（clipping）</b>，超出 [x_min, x_max] 的值被压到端点；<b>舍入（rounding）</b>，最近邻量化带来不超过 s/2 的误差；<b>粒度</b>，组内方差越大误差越大；<b>激活离群值</b>，LLM 的某些通道会出现比中位数大几十倍的激活，per-tensor 量化会被它们主导。训练后量化（PTQ）和量化感知训练（QAT）是两条应对路线，GPTQ、AWQ、SmoothQuant 等具体算法属于推理量化的范畴，本篇不展开，见 quantized-inference。</p>
  <div class="callout callout--formula"><span class="callout__label">误差界</span><div>对范围内的 x，最近邻量化的误差满足 |x − x̂| ≤ s/2；一旦发生截断，误差可以远大于 s/2。评估量化方案时，先看有多少比例的元素被截断，再看舍入误差。</div></div>
</section>

<section class="sec">
  <h2>误差来源与排障清单</h2>
  <p>混合精度和量化的问题通常不是“精度不够”这么抽象，而是有明确的症状。下面这张表按现象归类，便于从日志和 profiler 反推原因。</p>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>现象</th><th>可能原因</th><th>处理</th></tr></thead><tbody>
    <tr><td>loss 出现 NaN 或 inf</td><td>FP16 溢出、attention logits 过大、未 unscale 就裁剪</td><td>改用 BF16；检查 logits 范围；先 unscale 再 clip</td></tr>
    <tr><td>loss 正常但掉点</td><td>累加用了 FP16、LayerNorm/softmax 在低精度、量化截断严重</td><td>确认 FP32 accumulate；敏感算子留 FP32；调 group size 或 clipping</td></tr>
    <tr><td>吞吐没有提升</td><td>算子 memory-bound、cast 开销、batch 太小</td><td>用 profiler 看瓶颈；融合算子；增大 batch</td></tr>
    <tr><td>显存没有下降</td><td>主权重和优化器状态仍是 FP32、激活占主导</td><td>用 ZeRO/FSDP 分片；activation checkpointing</td></tr>
    <tr><td>量化后某一层误差大</td><td>激活离群值、per-tensor scale 被撑大</td><td>改 per-channel 或 per-token；检查截断比例</td></tr>
  </tbody></table></div>
  <p>排障时先确认三件事：参数和优化器状态到底是什么 dtype；autocast 是否真的覆盖了目标算子；瓶颈到底是算力还是带宽。第一件可以用 next(model.parameters()).dtype 和 optimizer.state 检查；第二件用 torch.profiler 看 kernel 名称里是 bf16 还是 fp32；第三件看 Nsight Compute 的 SM 利用率与 DRAM 吞吐，SM 利用率低而带宽打满，说明是 memory-bound，换精度收益有限。</p>
  <p>还有一个常见误解：混合精度会让显存减半。按 Adam 的训练状态计，纯 FP32 是 4 B 权重 + 4 B 梯度 + 4 B 一阶动量 + 4 B 二阶动量 = 16 B/参数；Micikevicius 式混合精度是 2 B 低精度权重 + 2 B 低精度梯度 + 4 B FP32 主权重 + 4 B m + 4 B v，仍是 16 B/参数；PyTorch AMP 的低精度副本只在前向临时存在，持久状态是 FP32 参数、FP32 梯度与两个 FP32 动量，同样约 16 B/参数。激活与临时区另计，随序列长度、batch 与重算策略变化很大。无论哪种方案，参数和优化器状态都不会减半，显存节省主要来自激活值和临时 buffer；推理时没有优化器状态，权重量化才真正按位宽比例降显存。</p>
  <div class="duo"><div class="duo__col"><h4>混合精度省什么</h4><p>矩阵乘与卷积的算力、激活显存和带宽压力；在 compute-bound 算子上可以接近标称倍数。</p></div><div class="duo__col"><h4>不省什么</h4><p>FP32 主权重和 Adam 的 m/v；优化器状态；memory-bound 算子的时间。参数量化才按位宽降权重显存。</p></div></div>
  <div class="callout callout--warn"><span class="callout__label">注意</span><div>不要把 model.half() 当成 AMP。model.half() 会把参数、buffer、LayerNorm 全部变成 FP16，既失去主权重，也让 softmax 和归一化暴露在窄范围里；正确做法是保留 FP32 参数，用 autocast 包住前向。</div></div>
</section>

<section class="sec">
  <h2>自测与延伸阅读</h2>
  <p>下面 4 道题覆盖格式选择、损失缩放、累加精度和量化粒度。先自己回答，再展开对照。</p>
  <details class="quiz"><summary>Q1 · 为什么 BF16 比 FP16 更适合作为大模型训练的默认格式？</summary><div class="quiz__a">BF16 有 8 位指数，动态范围与 FP32 相同，约 1.18e−38 到 3.39e38，因此不需要损失缩放；FP16 只有 5 位指数，最大有限值 65504、最小正规数约 6.10e−5，训练早期容易溢出或下溢。BF16 的尾数只有 7 位，相对精度约 0.39%，但 FP32 主权重和 FP32 累加补偿了这一点。若任务对精度极敏感，例如小模型、极低学习率或长尾分布，仍应做消融验证，不能只凭格式判断。</div></details>
  <details class="quiz"><summary>Q2 · FP16 训练的 GradScaler 有 scale、unscale、step、update 四步，梯度裁剪应插在哪里？为什么？</summary><div class="quiz__a">顺序是 scaler.scale(loss).backward()、scaler.unscale_(optimizer)、clip_grad_norm_、scaler.step(optimizer)，最后 scaler.update()。loss 被放大 S 倍后，所有梯度也放大 S 倍；如果先裁剪再 unscale，阈值实际作用在放大后的梯度上，等价于把阈值放大了 S 倍，裁剪几乎失效。unscale_ 之后梯度恢复真实尺度，裁剪阈值才有意义。</div></details>
  <details class="quiz"><summary>Q3 · 为什么“FP16 输入 + FP32 累加”是训练标配，而 FP16 累加通常不行？</summary><div class="quiz__a">矩阵乘的 K 维往往上千，低精度累加器在连续求和时会丢失有效位，最坏情况误差随 K 增长，还可能溢出；FP32 累加器有 24 位有效精度，能覆盖常见 K 的求和。部分消费级 GPU 的 FP16 累加能到两倍速率，但更适合推理。选卡时要把“FP32 accumulate”和“FP16 accumulate”的标称算力分开看，不能直接比较峰值。</div></details>
  <details class="quiz"><summary>Q4 · group size 从 128 降到 32，量化误差和存储开销各自怎么变？</summary><div class="quiz__a">误差会下降，但收益递减：组越小，scale 越能贴合局部数值范围，但组内元素减少到一定程度后，舍入误差和激活离群值成为主因。存储开销按 32/G 增长：G=128 时每权重 0.25 bit，总比特 8.25；G=32 时每权重 1 bit，总比特 9，相对 8.25 增加约 9%。所以常见默认是 128，在精度和带宽之间取平衡，而不是一味追求更小的组。</div></details>
  <h3>延伸阅读</h3>
  <ul class="refs">
    <li><b>Mixed Precision Training</b> — Micikevicius et al., ICLR 2018（arXiv:1710.03740，2017 年首发）。提出 FP32 主权重、损失缩放与 FP16 计算的训练配方，本篇三件套的原始出处。</li>
    <li><b>FP8 Formats for Deep Learning</b> — Micikevicius et al., NVIDIA, 2022（arXiv:2209.05433）。定义 E4M3 与 E5M2 的位布局、范围，以及 FP8 训练的缩放实践。</li>
    <li><b>Automatic Mixed Precision package — torch.amp</b> — PyTorch 官方文档。autocast 的算子策略、GradScaler 的完整用法与可运行示例。</li>
    <li><b>Quantization and Training of Neural Networks for Efficient Integer-Arithmetic-Only Inference</b> — Jacob et al., CVPR 2018（arXiv:1712.05877）。对称与非对称量化、scale 与 zero-point 的经典白皮书。</li>
    <li><b>NVIDIA H100 Tensor Core GPU Architecture</b> — NVIDIA, 2022 白皮书，配合 A100/H100 datasheet 阅读。Tensor Core 支持格式、FP8 与峰值算力的口径说明。</li>
  </ul>
</section>`
};
