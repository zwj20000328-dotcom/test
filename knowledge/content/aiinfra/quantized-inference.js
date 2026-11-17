window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["quantized-inference"] = {
  slug: "quantized-inference",
  title: "量化推理落地",
  subtitle: "GPTQ、AWQ、SmoothQuant 与 FP8",
  level: 4,
  cluster: "推理",
  tags: ["GPTQ", "AWQ", "FP8", "W8A8"],
  summary: "从解码带宽出发，讲清 weight-only、W8A8 与 KV Cache 量化的差异，拆解 INT4 分组存储与激活离群值，并给出 GPTQ、AWQ、FP8 的落地方案。",
  keyPoints: [
    "weight-only 只压权重，W8A8 连激活一起压，KV Cache 量化是独立开关，三者收益与风险不同",
    "INT4 普遍依赖 group-wise scale；G=128 时实际约 4.125 bit/权重，反量化必须与 GEMM 融合",
    "W4A16 的加速随 batch 增大而衰减，W8A8 与 FP8 才吃得到算力红利；精度要用任务集与长上下文回归验证"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
  <h2>先建立直觉：decode 阶段在等显存，不在等算力</h2>
  <p>decode 每步都要把全部权重从显存读一遍，是带宽受限的（两阶段推导见 inference-basics）。以 7B、FP16 为例，14 GB 权重在 A100 的 2.0 TB/s 上至少 7 ms/token，约 143 token/s；算上 KV Cache 与中间结果，实测常只有几十 token/s。</p>
  <p>这笔账说明量化的出发点：decode 阶段省带宽就是省时间，省显存就是省并发。权重从 16 位压到 4 位，单步搬运量接近四分之一；KV Cache 从 FP16 压到 FP8，同样显存能容纳的 token 数约翻倍。但 weight-only、W8A8 与 KV Cache 量化是三件不同的事，收益来源、精度风险和工程复杂度都不一样。</p>
  <p>浮点格式的位布局、scale 与 zero-point 的基础，<mark>混合精度（mixed precision）</mark>一篇已经讲过；这里只讨论推理侧怎么选、怎么落地、怎么验证，不重复混合精度训练。</p>
  <div class="callout callout--intuition"><span class="callout__label">直觉</span><div>权重量化像把厚书换成微缩胶卷：每次查阅搬的东西少了，但放大镜（反量化）必须够快，否则省下的搬运时间又被放大操作吃掉。KV Cache 量化更像把草稿纸写小一点，省的是桌面空间，代价是字迹变模糊。</div></div>
</section>

<section class="sec">
  <h2>三种量化对象：权重、激活、KV Cache</h2>
  <p><b>weight-only</b>（仅权重量化）只压线性层权重，激活保持 FP16 或 BF16，常写作 W4A16、W8A16。内核把 4 位或 8 位权重反量化成 16 位，再走 FP16 Tensor Core。它不需要为激活设定量化范围，接入成本最低；但 GPTQ、AWQ 仍需用校准集估计 Hessian 或激活幅度，只是不量化激活。batch 小时收益接近带宽比；batch 大时计算仍是 FP16，吞吐受算力限制。</p>
  <p><b>W8A8</b>（8 位权重、8 位激活）把两边都压到 8 位，直接调用 INT8 或 FP8 Tensor Core，算力路径本身变快，适合高并发、compute-bound 的在线服务。代价是必须处理激活的<mark>离群值（outlier）</mark>，并准备有代表性的<mark>校准集（calibration set）</mark>。选 INT8 还是 FP8 要看 GPU：Hopper 的 FP8 路径更自然，Ampere 上 INT8 更成熟。</p>
  <p><b>KV Cache 量化</b>是第三条独立开关，只压推理时缓存的 K、V，不动权重。它把每个 token 的缓存从 2 字节压到 1 字节，直接抬高可服务的并发与上下文长度。它可以和权重量化叠加，但精度风险也叠加，长上下文任务必须单独回归。</p>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>对象</th><th>压什么</th><th>典型位宽</th><th>主要收益</th><th>主要风险</th><th>代表实现</th></tr></thead><tbody>
    <tr><td>权重（weight-only）</td><td>线性层权重</td><td>INT4 或 INT8，激活 16 位</td><td>权重显存降 2-4 倍；小 batch 解码加速</td><td>大 batch 受 FP16 计算限制；反量化开销</td><td>GPTQ、AWQ、Marlin</td></tr>
    <tr><td>权重加激活（W8A8）</td><td>权重与激活</td><td>INT8 或 FP8</td><td>算力路径翻倍；权重显存约减半</td><td>激活离群值；校准偏差</td><td>SmoothQuant、TensorRT-LLM FP8</td></tr>
    <tr><td>KV Cache</td><td>每层 K/V 缓存</td><td>FP8 或 INT8</td><td>并发与上下文容量约翻倍</td><td>长上下文检索精度下降</td><td>vLLM FP8 KV、TRT-LLM INT8 KV</td></tr>
  </tbody></table></div>
  <p>图 1 把两条轨道画在一起：权重量化是离线的、一次性的；KV Cache 量化是部署配置的一部分；两者共用同一套评估与回滚流程。</p>
  <figure class="fig">
    <svg viewBox="0 0 760 380" width="100%" role="img" aria-label="量化推理流水线：权重量化与 KV Cache 量化两条独立轨道">
      <defs>
        <marker id="quantized-inference-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--sv-muted)"></path>
        </marker>
      </defs>
      <text x="24" y="26" font-size="15" font-weight="bold" fill="var(--sv-ink)" font-family="inherit">量化推理流水线：权重与 KV Cache 是两条独立轨道</text>
      <text x="24" y="58" font-size="13" fill="var(--sv-muted)" font-family="inherit">轨道 A · 权重量化：离线执行一次，服务时复用</text>

      <rect x="24" y="74" width="104" height="66" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="1.5"></rect>
      <text x="76" y="98" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">FP16/BF16</text>
      <text x="76" y="116" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">权重</text>
      <text x="76" y="134" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">7B 约 14 GB</text>

      <rect x="148" y="74" width="104" height="66" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="1.5"></rect>
      <text x="200" y="98" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">校准集</text>
      <text x="200" y="116" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">C4 或业务语料</text>
      <text x="200" y="134" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">128 × 2048</text>

      <rect x="272" y="74" width="112" height="66" rx="6" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-width="1.5"></rect>
      <text x="328" y="98" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">量化算法</text>
      <text x="328" y="116" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPTQ / AWQ</text>
      <text x="328" y="134" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">SmoothQuant</text>

      <rect x="404" y="74" width="112" height="66" rx="6" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-width="1.5"></rect>
      <text x="460" y="98" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">打包</text>
      <text x="460" y="116" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">INT4/INT8/FP8</text>
      <text x="460" y="134" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">附带 scale</text>

      <rect x="536" y="74" width="100" height="66" rx="6" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-width="1.5"></rect>
      <text x="586" y="98" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">内核</text>
      <text x="586" y="116" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Marlin</text>
      <text x="586" y="134" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">CUTLASS</text>

      <rect x="656" y="74" width="80" height="66" rx="6" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-width="1.5"></rect>
      <text x="696" y="98" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">服务</text>
      <text x="696" y="116" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">与评估</text>
      <text x="696" y="134" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">A/B</text>

      <line x1="128" y1="107" x2="146" y2="107" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#quantized-inference-arrow)"></line>
      <line x1="252" y1="107" x2="270" y2="107" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#quantized-inference-arrow)"></line>
      <line x1="384" y1="107" x2="402" y2="107" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#quantized-inference-arrow)"></line>
      <line x1="516" y1="107" x2="534" y2="107" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#quantized-inference-arrow)"></line>
      <line x1="636" y1="107" x2="654" y2="107" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#quantized-inference-arrow)"></line>

      <path d="M696,140 L696,200 L328,200 L328,142" fill="none" stroke="var(--sv-line)" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#quantized-inference-arrow)"></path>
      <text x="340" y="194" font-size="12" fill="var(--sv-muted)" font-family="inherit">回归失败：换 group、校准集或 scheme</text>

      <line x1="24" y1="220" x2="736" y2="220" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="4 4"></line>
      <text x="24" y="246" font-size="13" fill="var(--sv-muted)" font-family="inherit">轨道 B · KV Cache 量化：与权重独立开关，可叠加</text>

      <rect x="24" y="262" width="150" height="58" rx="6" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-width="1.5"></rect>
      <text x="99" y="284" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">标定 K/V 幅度</text>
      <text x="99" y="304" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">按层或按头统计</text>

      <rect x="206" y="262" width="160" height="58" rx="6" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-width="1.5"></rect>
      <text x="286" y="284" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">选择粒度</text>
      <text x="286" y="304" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">per-tensor / per-head</text>

      <rect x="398" y="262" width="150" height="58" rx="6" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-width="1.5"></rect>
      <text x="473" y="284" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">FP8 / INT8 缓存</text>
      <text x="473" y="304" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">KV 显存约减半</text>

      <rect x="580" y="262" width="140" height="58" rx="6" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-width="1.5"></rect>
      <text x="650" y="284" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">长上下文回归</text>
      <text x="650" y="304" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">RULER / needle</text>

      <line x1="174" y1="291" x2="204" y2="291" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#quantized-inference-arrow)"></line>
      <line x1="366" y1="291" x2="396" y2="291" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#quantized-inference-arrow)"></line>
      <line x1="548" y1="291" x2="578" y2="291" stroke="var(--sv-line)" stroke-width="1.5" marker-end="url(#quantized-inference-arrow)"></line>

      <text x="24" y="352" font-size="12" fill="var(--sv-muted)" font-family="inherit">两条轨道可独立开关，也可叠加；任一条未通过回归，都不要上线。</text>
    </svg>
    <figcaption>图 1 · 量化推理流水线。权重轨道离线完成，KV Cache 轨道属于部署配置；评估不通过时回到算法与校准集，而不是直接调低精度。</figcaption>
  </figure>
</section>

<section class="sec">
  <h2>INT4 分组量化：4 bit 背后的存储与反量化</h2>
  <p>INT4 的存储不是每个权重 4 bit 这么简单。为了控制误差，业界普遍采用<mark>分组（group-wise）</mark>量化：每 G 个权重共享一个 scale，G 常取 128，也有 64 或 32；有的方案再共享一个 zero-point。以 G=128、FP16 scale 为例，每个权重实际占 4 + 16/128 = 4.125 bit；若用 FP32 scale，则是 4.25 bit。</p>
  <div class="formula">对称量化：q = clamp(round(w / s), −2^(b−1), 2^(b−1) − 1)，ŵ = q × s
分组 scale：s_g = max(|w_g|) / (2^(b−1) − 1)
存储开销：bits/权重 = b + 16 / G（FP16 scale，未计零点与对齐）
7B 模型 INT4 G=128：7×10⁹ × 4.125 / 8 B ≈ 3.6 GB，FP16 为 14 GB</div>
  <p><mark>反量化（dequantization）</mark>在内核里完成：拆开打包的 4 位整数，减去 zero-point，乘以 scale，得到 FP16 值。真正高效的内核不会先展开整层权重再调 GEMM，而是把反量化嵌进 GEMM 的加载与流水线，让反量化算术与 Tensor Core 计算重叠。反量化就发生在图 1 流水线的内核环节里。</p>
  <pre class="code" data-lang="python"><code># group-wise 反量化（伪代码，group=128）
for g in range(num_groups):
    s = scales[g]            # FP16 scale
    z = zeros[g]             # INT4 zero-point
    q = packed[g]            # 每字节打包两个 INT4
    w[g*128:(g+1)*128] = (unpack(q) - z) * s</code></pre>
  <p>打包时两个 4 位值塞进一个字节，行尾按 group 边界对齐；scale 单独存成一个小张量。加载时按 group 索引取 scale，这也是 group size 影响内核效率的原因：G 太小，scale 读取与索引开销上升；G 太大，误差回升。128 是精度、带宽与实现复杂度的常见折中，而不是理论最优。</p>
  <div class="callout callout--formula"><span class="callout__label">账本</span><div>以 7B 模型、G=128、FP16 scale 为例：权重大约 3.6 GB，比 FP16 的 14 GB 少 10.4 GB。若 batch=1 的解码每步只读权重，A100 80GB 的 2.0 TB/s 带宽给出约 1.8 ms/token 的搬运下界，折合 555 token/s；实际内核很难打满带宽，所以看到 2-3 倍加速是合理量级，而不是 4 倍承诺。</div></div>
</section>

<section class="sec">
  <h2>激活离群值：三种算法各自绕开什么</h2>
  <p>为什么激活比权重难量化？Transformer 的激活有强烈的通道不平衡：少数通道的绝对值可以比中位数大几十倍，而且在大量 token 上稳定出现。Dettmers 等人在 LLM.int8() 中观察到，参数量超过约 67 亿后，这种离群通道会显著出现。若用 per-tensor scale，一个 70 倍的离群值会把 scale 撑大 70 倍，正常通道只剩一两个量化台阶，误差被放大。</p>
  <figure class="fig">
    <svg viewBox="0 0 760 380" width="100%" role="img" aria-label="激活通道离群值示意，以及 per-tensor 与 per-channel scale 的分辨率差异">
      <text x="24" y="26" font-size="15" font-weight="bold" fill="var(--sv-ink)" font-family="inherit">激活离群值：per-tensor scale 会把正常通道压扁</text>
      <text x="50" y="52" font-size="13" fill="var(--sv-muted)" font-family="inherit">单层激活的通道最大绝对值（相对值，示意）</text>
      <line x1="50" y1="80" x2="50" y2="300" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="50" y1="300" x2="410" y2="300" stroke="var(--sv-line)" stroke-width="1"></line>
      <text x="28" y="190" font-size="12" fill="var(--sv-muted)" font-family="inherit" transform="rotate(-90 28 190)" text-anchor="middle">相对幅度（示意）</text>

      <rect x="58" y="280" width="9" height="20" fill="var(--sv-a)"></rect>
      <rect x="72" y="275" width="9" height="25" fill="var(--sv-a)"></rect>
      <rect x="86" y="282" width="9" height="18" fill="var(--sv-a)"></rect>
      <rect x="100" y="278" width="9" height="22" fill="var(--sv-a)"></rect>
      <rect x="114" y="110" width="9" height="190" fill="var(--sv-c)"></rect>
      <rect x="128" y="272" width="9" height="28" fill="var(--sv-a)"></rect>
      <rect x="142" y="276" width="9" height="24" fill="var(--sv-a)"></rect>
      <rect x="156" y="280" width="9" height="20" fill="var(--sv-a)"></rect>
      <rect x="170" y="274" width="9" height="26" fill="var(--sv-a)"></rect>
      <rect x="184" y="150" width="9" height="150" fill="var(--sv-c)"></rect>
      <rect x="198" y="278" width="9" height="22" fill="var(--sv-a)"></rect>
      <rect x="212" y="275" width="9" height="25" fill="var(--sv-a)"></rect>
      <rect x="226" y="281" width="9" height="19" fill="var(--sv-a)"></rect>
      <rect x="240" y="276" width="9" height="24" fill="var(--sv-a)"></rect>
      <rect x="254" y="272" width="9" height="28" fill="var(--sv-a)"></rect>
      <rect x="268" y="279" width="9" height="21" fill="var(--sv-a)"></rect>
      <rect x="282" y="170" width="9" height="130" fill="var(--sv-c)"></rect>
      <rect x="296" y="277" width="9" height="23" fill="var(--sv-a)"></rect>
      <rect x="310" y="274" width="9" height="26" fill="var(--sv-a)"></rect>
      <rect x="324" y="280" width="9" height="20" fill="var(--sv-a)"></rect>
      <rect x="338" y="276" width="9" height="24" fill="var(--sv-a)"></rect>
      <rect x="352" y="273" width="9" height="27" fill="var(--sv-a)"></rect>
      <rect x="366" y="278" width="9" height="22" fill="var(--sv-a)"></rect>
      <rect x="380" y="275" width="9" height="25" fill="var(--sv-a)"></rect>

      <text x="112" y="102" font-size="12" fill="var(--sv-c)" font-family="inherit">约 70 倍</text>
      <text x="180" y="142" font-size="12" fill="var(--sv-c)" font-family="inherit">约 50 倍</text>
      <text x="280" y="162" font-size="12" fill="var(--sv-c)" font-family="inherit">约 40 倍</text>
      <text x="230" y="324" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">输入通道（按幅度重排，示意）</text>

      <line x1="440" y1="52" x2="440" y2="330" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="4 4"></line>

      <text x="460" y="66" font-size="13" font-weight="bold" fill="var(--sv-ink)" font-family="inherit">per-tensor scale</text>
      <text x="460" y="88" font-size="12" fill="var(--sv-muted)" font-family="inherit">s = 70 / 127 ≈ 0.55</text>
      <line x1="470" y1="110" x2="710" y2="110" stroke="var(--sv-ink)" stroke-width="1.5"></line>
      <line x1="470" y1="104" x2="470" y2="116" stroke="var(--sv-ink)" stroke-width="1.5"></line>
      <line x1="504" y1="104" x2="504" y2="116" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="538" y1="104" x2="538" y2="116" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="573" y1="104" x2="573" y2="116" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="607" y1="104" x2="607" y2="116" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="641" y1="104" x2="641" y2="116" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="675" y1="104" x2="675" y2="116" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="710" y1="104" x2="710" y2="116" stroke="var(--sv-ink)" stroke-width="1.5"></line>
      <text x="470" y="134" font-size="12" fill="var(--sv-muted)" font-family="inherit">0</text>
      <text x="710" y="134" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">70</text>
      <text x="460" y="160" font-size="12" fill="var(--sv-b)" font-family="inherit">正常通道只剩 1-2 个台阶，分辨率被离群值吃掉</text>

      <text x="460" y="204" font-size="13" font-weight="bold" fill="var(--sv-ink)" font-family="inherit">per-channel scale（逐通道）</text>
      <text x="460" y="226" font-size="12" fill="var(--sv-muted)" font-family="inherit">s_j = max(|X_j|) / 127 ≈ 0.008</text>
      <line x1="470" y1="248" x2="710" y2="248" stroke="var(--sv-ink)" stroke-width="1.5"></line>
      <line x1="470" y1="242" x2="470" y2="254" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="482" y1="242" x2="482" y2="254" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="494" y1="242" x2="494" y2="254" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="506" y1="242" x2="506" y2="254" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="518" y1="242" x2="518" y2="254" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="530" y1="242" x2="530" y2="254" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="542" y1="242" x2="542" y2="254" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="554" y1="242" x2="554" y2="254" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="566" y1="242" x2="566" y2="254" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="578" y1="242" x2="578" y2="254" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="590" y1="242" x2="590" y2="254" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="602" y1="242" x2="602" y2="254" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="614" y1="242" x2="614" y2="254" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="626" y1="242" x2="626" y2="254" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="638" y1="242" x2="638" y2="254" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="650" y1="242" x2="650" y2="254" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="662" y1="242" x2="662" y2="254" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="674" y1="242" x2="674" y2="254" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="686" y1="242" x2="686" y2="254" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="698" y1="242" x2="698" y2="254" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="710" y1="242" x2="710" y2="254" stroke="var(--sv-ink)" stroke-width="1.5"></line>
      <text x="470" y="272" font-size="12" fill="var(--sv-muted)" font-family="inherit">0</text>
      <text x="710" y="272" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">1.0</text>
      <text x="460" y="296" font-size="12" fill="var(--sv-b)" font-family="inherit">正常通道可用满约 127 个台阶，离群通道不再挤压其他通道</text>
      <text x="460" y="330" font-size="12" fill="var(--sv-muted)" font-family="inherit">代价：scale 数量按通道数增加</text>
    </svg>
    <figcaption>图 2 · 左：少数通道的激活幅度远超中位数；右：同一组数值在 per-tensor 与 per-channel scale 下的量化台阶。图为示意，真实离群通道的位置随层与头变化。</figcaption>
  </figure>
  <p>per-channel 或 per-token scale 能缓解，但激活是运行时产生的：逐 token 动态求 scale 会带来额外归约与同步；离群值又集中在固定通道，per-token 也救不了同一 token 内的通道差异。三种主流方法从不同角度绕开这个矛盾。</p>
  <p><b>SmoothQuant</b> 把激活的量化难度迁移到权重。对每个输入通道 j 除以平滑因子 s_j，同时把权重对应输入通道乘以 s_j，数学上完全等价。选 s_j 让两边动态范围都落到易量化区间，α 常取 0.5。它面向 W8A8 INT8，需要校准激活最大值，但不改模型结构，推理时平滑因子折进权重。</p>
  <div class="formula">s_j = max(|X_j|)^α / max(|W_j|)^(1−α)，α ≈ 0.5
Y = (X / s) · (W × s)，逐通道缩放后等价
目标：把激活的离群幅度压到权重附近，再做 per-tensor INT8</div>
  <p><b>AWQ</b> 的假设是权重的重要性由激活决定。它用校准集统计每个通道的激活幅度，挑出约 1% 的显著通道，按通道放大这些权重、相应缩小激活，使量化时显著通道保留更多有效位。它不做逐列误差补偿，流程轻，论文在 RTX 4090 上报告 7B 模型约 3 倍于 FP16 的解码加速，并展示了 70B 模型在 Jetson Orin 上运行。</p>
  <p><b>GPTQ</b> 把逐层量化写成带约束的二次误差最小化。它用校准输入近似 Hessian，按列依次量化；每量化一列，就把该列的量化误差按 Hessian 逆分摊到尚未量化的列上。配合 group-wise 与 act-order（按激活幅度重排列），4 位下困惑度损失通常很小。论文口径是用 128 条 2048-token 的 C4 样本，单卡 A100 上量化 175B 模型约 4 GPU 小时。</p>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>方法</th><th>目标格式</th><th>是否需反向传播</th><th>核心机制</th><th>落地特点</th></tr></thead><tbody>
    <tr><td>GPTQ</td><td>W4A16、W3A16</td><td>否，但需 Hessian 近似</td><td>逐列量化，误差按 Hessian 逆补偿</td><td>4 位精度好；离线量化较慢；配 act-order 与 group</td></tr>
    <tr><td>AWQ</td><td>W4A16</td><td>否</td><td>用激活幅度找约 1% 显著通道，逐通道缩放保护</td><td>流程轻、量化快；端侧与单卡服务常用</td></tr>
    <tr><td>SmoothQuant</td><td>W8A8 INT8</td><td>否</td><td>逐通道平滑，把激活离群值迁移到权重</td><td>需要激活校准；INT8 算力路径收益明确</td></tr>
  </tbody></table></div>
</section>

<section class="sec">
  <h2>H100 上的 FP8：换格式，不只是换位宽</h2>
  <p>FP8 不是把 16 位简单截半，而是换一套浮点格式。E4M3 有 4 位指数、3 位尾数，最大有限值 448，相对精度约 6.25%；E5M2 范围更大，但尾数只有 2 位，精度更差。推理的权重与激活通常用 E4M3，梯度才考虑 E5M2。H100 SXM 的 FP8 稠密算力约 1979 TFLOPS，是 BF16（约 989 TFLOPS）的两倍，HBM3 带宽 3.35 TB/s，显存 80 GB。</p>
  <p>FP8 推理要把张量缩放到 E4M3 的可表示区间。权重常用 per-channel scale，激活用 per-tensor 或 per-token 的动态 scale；GEMM 在 FP8 Tensor Core 上累加，输出再乘回外层 scale。与 INT8 相比，FP8 的指数位让大幅值激活不容易溢出，但尾数少，接近零的小值分辨率有限。谁更准取决于模型、粒度与校准，不能先验断言。</p>
  <div class="formula">权重：s_w = max(|W|) / 448，ŵ = clamp(W / s_w, −448, 448)
激活：s_x 按 token 或按张量动态求，x̂ = clamp(x / s_x, −448, 448)
输出还原：Y = (x̂ · ŵ) × (s_x × s_w)，累加在 FP32</div>
  <p>工程上，TensorRT-LLM 与 vLLM 都提供 FP8 W8A8 路径，TensorRT-LLM 还支持 FP8 KV Cache。收益是权重显存约减半、compute-bound 场景吞吐接近翻倍；端到端常被 attention、采样与调度摊薄，H100 上常见 1.2-1.6 倍，具体视模型、batch 与序列长度而定。</p>
  <pre class="code" data-lang="bash"><code># 用 vLLM 启动 AWQ 模型，并开启 FP8 KV Cache
vllm serve your-org/Llama-3.1-8B-Instruct-AWQ \
  --quantization awq \
  --kv-cache-dtype fp8 \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.90

# 固定并发与输入长度，跑任务集对比 FP16 基线
python -m lm_eval --model local-completions \
  --model_args base_url=http://127.0.0.1:8000/v1/completions \
  --tasks mmlu,gsm8k --num_fewshot 5</code></pre>
  <div class="callout callout--warn"><span class="callout__label">注意</span><div>FP8 需要硬件支持：H100/H200、L40S 等有 FP8 Tensor Core，A100 没有。A100 上应选 INT8 W8A8 或 weight-only。另外，per-token 动态量化会插入归约与同步，短序列、小 batch 下开销占比不低，务必用目标形状实测；vLLM 也支持在线 FP8 量化（--quantization fp8），但生产上线更建议用离线校准好的 checkpoint。</div></div>
</section>

<section class="sec">
  <h2>内核与 batch：量化收益真正兑现的地方</h2>
  <p>量化能不能变成速度，取决于<mark>内核（kernel）</mark>。weight-only 的数学是低位宽权重乘 16 位激活，没有对应的 Tensor Core 指令，必须反量化后走 FP16 路径。Marlin 是这类混合 GEMM 的代表：面向 Ampere（A100）优化，用异步拷贝与精细的寄存器布局，在小 batch（约 16 以内）下接近 4 倍的带宽上限；Hopper 上 vLLM 还有 Machete 等针对新架构的内核。CUTLASS 提供可组合模板，用于自定义混合输入 GEMM 与 FP8 GEMM。</p>
  <p>关键结论是 W4A16 的加速随 batch 增大而衰减。batch=1 时每个 token 只读一遍权重，省带宽就是省时间，理论上限接近 4 倍；batch 增大后同一份权重被复用，计算转为 compute-bound，FP16 Tensor Core 成为瓶颈，4 位权重只剩省显存的价值。W8A8 与 FP8 相反，batch 越大越能吃到算力翻倍的红利。</p>
  <p>另一个常见坑是反量化开销。如果内核先把整层权重展开成 FP16 再调 GEMM，临时显存与额外读写会吃掉收益，batch 大、权重被复用时尤其明显。选内核要看它是否融合了反量化与 GEMM，以及在目标架构上是否有匹配的 tile 与流水线；同一个量化 checkpoint 在不同后端上的速度可能差一倍。</p>
  <figure class="fig">
    <svg viewBox="0 0 760 380" width="100%" role="img" aria-label="不同量化方案的精度与吞吐散点示意">
      <text x="24" y="26" font-size="15" font-weight="bold" fill="var(--sv-ink)" font-family="inherit">精度与吞吐的取舍：没有免费的右上角</text>
      <text x="24" y="48" font-size="12" fill="var(--sv-muted)" font-family="inherit">点位为示意，口径：单卡、7B 级模型、batch=1 解码</text>

      <line x1="90" y1="60" x2="90" y2="320" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="90" y1="320" x2="710" y2="320" stroke="var(--sv-line)" stroke-width="1"></line>
      <line x1="90" y1="95" x2="710" y2="95" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="5 4"></line>
      <line x1="90" y1="170" x2="710" y2="170" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 5"></line>
      <line x1="90" y1="245" x2="710" y2="245" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 5"></line>
      <line x1="245" y1="60" x2="245" y2="320" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 5"></line>
      <line x1="323" y1="60" x2="323" y2="320" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 5"></line>
      <line x1="400" y1="60" x2="400" y2="320" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 5"></line>
      <line x1="478" y1="60" x2="478" y2="320" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 5"></line>
      <line x1="555" y1="60" x2="555" y2="320" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 5"></line>
      <line x1="633" y1="60" x2="633" y2="320" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 5"></line>

      <text x="84" y="99" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">100</text>
      <text x="84" y="174" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">98</text>
      <text x="84" y="249" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">96</text>
      <text x="84" y="324" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">94</text>
      <text x="245" y="340" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">1.5×</text>
      <text x="323" y="340" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">2×</text>
      <text x="400" y="340" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">2.5×</text>
      <text x="478" y="340" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">3×</text>
      <text x="555" y="340" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">3.5×</text>
      <text x="633" y="340" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">4×</text>
      <text x="400" y="368" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">相对吞吐（FP16 = 1）</text>
      <text x="28" y="190" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit" transform="rotate(-90 28 190)">任务精度保持（FP16 = 100）</text>

      <circle cx="168" cy="95" r="6" fill="var(--sv-a)"></circle>
      <text x="180" y="90" font-size="12" fill="var(--sv-ink)" font-family="inherit">FP16 基线</text>

      <circle cx="237" cy="121" r="6" fill="var(--sv-b)"></circle>
      <text x="228" y="114" font-size="12" text-anchor="end" fill="var(--sv-ink)" font-family="inherit">INT8 W8A8</text>

      <circle cx="268" cy="110" r="6" fill="var(--sv-b)"></circle>
      <text x="280" y="106" font-size="12" fill="var(--sv-ink)" font-family="inherit">FP8 W8A8（H100）</text>

      <circle cx="400" cy="148" r="6" fill="var(--sv-a)"></circle>
      <text x="388" y="154" font-size="12" text-anchor="end" fill="var(--sv-ink)" font-family="inherit">GPTQ W4A16</text>

      <circle cx="439" cy="140" r="6" fill="var(--sv-a)"></circle>
      <text x="451" y="136" font-size="12" fill="var(--sv-ink)" font-family="inherit">AWQ W4A16</text>

      <circle cx="493" cy="163" r="6" fill="var(--sv-c)"></circle>
      <text x="505" y="159" font-size="12" fill="var(--sv-ink)" font-family="inherit">W4A16 + FP8 KV</text>

      <circle cx="571" cy="253" r="6" fill="var(--sv-c)"></circle>
      <text x="583" y="249" font-size="12" fill="var(--sv-ink)" font-family="inherit">3-bit 权重</text>

      <text x="600" y="88" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">FP16 精度基线</text>
      <text x="100" y="72" font-size="12" fill="var(--sv-muted)" font-family="inherit">越靠右上越好；右下是拿精度换吞吐</text>
    </svg>
    <figcaption>图 3 · 精度-吞吐散点示意。点为量级，不是某一模型的实测；W4A16 的吞吐取决于 batch 与内核，3-bit 往往出现精度悬崖。上线前应在自己的模型与流量上重画这张图。</figcaption>
  </figure>
</section>

<section class="sec">
  <h2>精度评估：困惑度只是第一道筛子</h2>
  <p>精度评估不能只看<mark>困惑度（perplexity, PPL）</mark>。在 WikiText-2 上，4 位权重量化往往只让 PPL 涨 0.1-0.3，但任务集可能掉几个点，长上下文检索可能明显退化。建议分三层：先用 FP16 与量化模型的 logits KL 散度做快速筛查；再跑任务集（MMLU、GSM8K、HellaSwag 等，固定 few-shot 与模板，用 lm-evaluation-harness）；最后做生成与长上下文回归（HumanEval pass@1、RULER 或 LongBench、needle-in-a-haystack），并在目标长度与并发下测首 token 延迟（TTFT）、每 token 延迟（TPOT）与吞吐。</p>
  <p>收益区间（同一模型、同一张卡、同一并发对比 FP16）：W4A16 把 7B 权重从 14 GB 压到约 3.6 GB，batch=1 解码常见 2-3 倍，batch 增大后回落到 1.0-1.3 倍；INT8 W8A8 权重显存约减半，compute-bound 场景常见 1.3-1.8 倍；H100 上 FP8 W8A8 端到端常见 1.2-1.6 倍；FP8 KV Cache 让 KV 显存减半，长上下文并发常提升 1.5-2 倍。这些是量级，不是承诺，必须用自家流量复测。</p>
  <p>什么时候不该量化：任务对数值误差零容忍（部分代码、数学、金融与合规场景）；模型本身很小（小于 10 亿参数时量化误差相对更明显）；瓶颈不在权重带宽，而在调度、采样、网络或 host 开销；目标后端没有融合内核，反量化比省下的带宽更贵；校准集与业务分布差距大；长上下文 RAG 对召回零容忍而 KV 量化尚未回归；以及仍在训练阶段——训练侧的数值问题属于 mixed-precision 与训练优化篇章。</p>
  <div class="callout callout--warn"><span class="callout__label">反直觉</span><div>为了省显存开了 W4A16，却把 batch 开得很大，结果计算变成 compute-bound，吞吐不升反降，只是显存变多了。量化方案要和 batch、序列长度、SLO 一起选，不能单独拍板。另一个坑是把 PPL 没涨当成精度没问题：长上下文与生成任务对量化的敏感度通常高于短文本 PPL。</div></div>
  <p>排障顺序建议：先确认权重是否真的按目标位宽加载（看模型体积与启动日志）；再看内核是否走了量化路径（profiler 里应出现量化 GEMM，而不是先反量化再走 FP16 GEMM）；然后固定并发对比 TTFT、TPOT 与 PPL；最后做长上下文与任务集回归。任何一步缺失，都可能把精度问题误判成性能问题，或反过来。</p>
  <div class="duo"><div class="duo__col"><h4>先量化权重</h4><p>接入成本最低，小 batch 解码收益直接；用 GPTQ 或 AWQ 的 4 位 checkpoint，确认 Marlin 等融合内核可用，先拿显存与小流量加速。</p></div><div class="duo__col"><h4>再考虑 W8A8 与 KV</h4><p>当服务 compute-bound、并发高，再上 SmoothQuant 或 FP8；当 KV Cache 成为长上下文瓶颈，再单独开 FP8 KV，并做长上下文回归。</p></div></div>
</section>

<section class="sec">
  <h2>自测与延伸阅读</h2>
  <p>下面 4 道题覆盖存储、batch、算法选择与 KV 量化。先自己回答，再展开对照。</p>
  <details class="quiz"><summary>Q1 · INT4 的 group size 从 128 改成 32，每个权重占多少 bit？精度一定更好吗？</summary><div class="quiz__a">G=128、FP16 scale 时是 4 + 16/128 = 4.125 bit；G=32 时是 4 + 16/32 = 4.5 bit，增加约 9%。误差通常下降，因为 scale 更贴合局部范围，但收益递减：组内元素少到一定程度后，舍入误差、离群值与零点误差成为主因。更小的 G 还会增加 scale 读取与索引开销，内核效率可能下降，所以不是越小越好。</div></details>
  <details class="quiz"><summary>Q2 · 为什么 W4A16 在 batch=1 时接近 4 倍，batch 变大后只剩 1 倍多？</summary><div class="quiz__a">batch=1 的 decode 每步只处理一个 token，时间由权重从 HBM 搬到 SM 的带宽决定，权重压到四分之一，搬运时间也接近四分之一。batch 增大后同一份权重被多个 token 复用，算术强度上升，瓶颈转向 FP16 Tensor Core 的算力；W4A16 仍要反量化到 FP16 再算，算力没有变，所以加速衰减。W8A8 与 FP8 走低位宽 Tensor Core，batch 大时才显优势。</div></details>
  <details class="quiz"><summary>Q3 · SmoothQuant 为什么不直接把激活的离群值裁掉？</summary><div class="quiz__a">裁剪会永久丢失离群通道携带的信息，而这些通道往往对输出影响大，直接裁会让任务精度明显下降。SmoothQuant 用逐通道缩放把激活幅度压下来，同时把权重对应输入通道放大，数学上等价，不丢信息；缩放后再做 per-tensor INT8，正常通道也能保住分辨率。代价是需要校准激活最大值，且 α 与粒度要按模型调。</div></details>
  <details class="quiz"><summary>Q4 · 什么时候值得开 FP8 KV Cache？上线前至少测什么？</summary><div class="quiz__a">当长上下文或高并发导致 KV Cache 成为显存与带宽瓶颈时值得开：它把每 token 的 KV 从 2 字节降到 1 字节，直接提升可服务 token 数。上线前至少测三件事：目标长度下的 needle-in-a-haystack 或 RULER 召回；任务集分数与 FP16 的差值；固定并发下的 TTFT、TPOT 与吞吐。若模型对长距离精确检索敏感，或后端只支持 per-tensor scale，先做小流量 A/B。</div></details>
  <h3>延伸阅读</h3>
  <ul class="refs">
    <li><b>GPTQ: Accurate Post-Training Quantization for Generative Pre-trained Transformers</b> — Frantar, Ashkboos, Hoefler, Alistarh, ICLR 2023（arXiv:2210.17323，2022 年首发）。逐列量化与 Hessian 误差补偿的原始论文，4 位权重量化的基线方法。</li>
    <li><b>AWQ: Activation-aware Weight Quantization for On-Device LLM Compression and Acceleration</b> — Lin, Tang, Tang, Yang, Chen, Wang, Xiao, Dang, Gan, Han, MLSys 2024（arXiv:2306.00978，2023 年首发）。用激活幅度保护约 1% 显著通道，不需要反向传播。</li>
    <li><b>SmoothQuant: Accurate and Efficient Post-Training Quantization for Large Language Models</b> — Xiao, Lin, Seznec, Wu, Demouth, Han, ICML 2023（arXiv:2211.10438，2022 年首发）。把激活离群值迁移到权重的 W8A8 方法。</li>
    <li><b>Quantization</b> — vLLM 官方文档（docs.vllm.ai）。GPTQ、AWQ、FP8、KV Cache 量化的支持矩阵、启动参数与内核说明，版本更新较快，应以当前文档为准。</li>
    <li><b>IST-DASLab/marlin</b> — Marlin：面向 weight-only 量化的融合反量化 GEMM 内核（GitHub: IST-DASLab/marlin，2023）。在 Ampere 上以小 batch 接近 4 倍带宽上限为目标，vLLM 的 Marlin 内核即源于此。</li>
  </ul>
</section>`
};
