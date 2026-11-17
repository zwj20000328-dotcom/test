window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["speculative-decoding"] = {
  slug: "speculative-decoding",
  title: "投机解码：用小模型跑赢大模型",
  subtitle: "用闲置算力摊薄权重访存",
  level: 4,
  cluster: "推理",
  tags: ["Speculative Decoding", "Medusa", "EAGLE"],
  summary: "投机解码用小模型先猜、目标模型并行校验，严格拒绝采样保证分布不变；加速比取决于接受率、草稿长度与成本，低并发长输出收益最大，工程上须端到端实测。",
  keyPoints: [
    "decode 在 batch=1 时算术强度约为 1 FLOP/byte，只有 H100 脊点（约 295 FLOP/byte）的 1/295，瓶颈是权重访存而不是算力。",
    "小模型先猜 γ 个 token，目标模型一次并行校验 γ+1 个位置；严格拒绝采样保证输出分布与目标模型逐 token 采样完全一致。",
    "加速比 S ≈ E ÷ (1+γc)，E=(1−α^(γ+1))/(1−α)；α 低时加长草稿无益，c 接近 1 时投机失去意义。",
    "低并发、长输出、任务可预测时收益最大；大 batch、compute-bound、显存紧张时可能为负，必须用端到端 p50/p99 实测。"
  ],
  readingMinutes: 14,
  html: String.raw`
<section class="sec">
<h2>一句话直觉：把空转的算力拿去猜下一个词</h2>
<p>大模型生成文本时一次只吐一个 token。为了这一个 token，它要把全部权重从显存搬到计算单元，而真正参与的乘加运算少得可怜。投机解码（speculative decoding）换了个问法：既然读一次权重这么贵，能不能让它一次多判几个 token？</p>
<p>做法是请一个更小、更便宜的<mark>草稿模型</mark>（draft model）先连续猜 γ 个 token，再让<mark>目标模型</mark>（target model）把这 γ 个位置连同前缀一次性前向，逐个核对。猜对的接受，第一个猜错的位置由目标模型给出正确答案并截断。一次权重读取，最多换来 γ+1 个 token。</p>
<p>更重要的是，它不是近似：在严格的拒绝采样下，最终输出的分布与直接用目标模型逐 token 采样<mark>完全相同</mark>。加速来自把访存受限的串行步骤改造成一次并行校验：同一批权重只读一遍，却服务多个位置，而不是牺牲生成质量。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>主编（目标模型）每审一篇稿都要把整本规范翻一遍，很慢；实习生（草稿模型）先照着规范连写四段。主编不重写，只从头核对：前三段通过，第四段改掉并打回。于是一次翻规范的时间产出四段可用文字。实习生写得越像主编，通过率越高；就算被拒，主编也只多花一点改稿力气。</div></div>
</section>

<section class="sec">
<h2>decode 为什么让 GPU 空转</h2>
<p>prefill 与 decode 的两阶段特征见 inference-basics 一篇，这里只取与投机相关的部分：<mark>decode</mark> 每步只处理一个新 token，矩阵乘退化成矩阵-向量乘（GEMV），每个权重只用一次；把权重从 HBM 搬进 SM 的成本远大于一次乘加。</p>
<p>用 roofline 的语言说，batch=1、bf16 时，每个参数占 2 字节、贡献约 2 次浮点运算，算术强度约为 1 FLOP/byte。NVIDIA H100 SXM 的 BF16 稠密算力约 989 TFLOPS，HBM3 带宽 3.35 TB/s，两者相除得到约 295 FLOP/byte 的<mark>脊点</mark>（ridge point）。1 对 295，意味着即使 kernel 完美，Tensor Core 的利用率上限也只有约 0.3%。</p>
<div class="formula">算术强度：AI ≈ 2 × batch ÷ 2 = batch（FLOP/byte）
H100 脊点：989 TFLOPS ÷ 3.35 TB/s ≈ 295 FLOP/byte
batch=1 时 AI ≈ 1，约为脊点的 1/295；batch=32 时约 32，仍不足 1/9</div>
<p>代入数字：7B 模型 bf16 权重约 14 GB，单张 H100 读一遍约 4.2 ms，对应单请求约 240 token/s 的理论上限；实测常在 100-160 token/s，差额来自 kernel 效率、KV Cache 与采样开销。70B 切到 8 张卡，每卡每步读约 17.5 GB，量级相同，但要付张量并行（TP）的通信。</p>
<p>增大 batch 能摊薄权重读取，算术强度近似随 batch 线性上升；要到 batch 数百、权重读取被充分摊薄，decode 才接近 compute-bound。长上下文则会增加 KV 流量，使 decode 重新偏向 memory-bound。所以投机在低并发是白捡算力，在高并发是抢算力。</p>
</section>

<section class="sec">
<h2>draft-verify：一次访存，多个 token</h2>
<p>一轮投机解码分四步。设草稿模型为 q，目标模型为 p，每轮猜 γ 个 token。</p>
<ol>
<li><b>草稿。</b>q 以当前已确认前缀为条件，自回归生成 γ 个候选 token，同时保留每个位置的草稿分布 q_i。</li>
<li><b>校验。</b>把前缀与 γ 个候选拼成 γ+1 个位置，p 做一次前向，得到每个位置的分布 p_i。注意这是一次并行前向，不是 γ 次。</li>
<li><b>判定。</b>从左到右逐个比较。第 i 个候选以概率 min(1, p_i/q_i) 被接受；遇到第一个拒绝，就从残差分布采样一个 token 作为该位置输出，并丢弃其后的候选；若全部接受，再从 p 的第 γ+1 个位置采一个 bonus token。</li>
<li><b>提交。</b>只把被接受的 token 写入 KV Cache，拒绝位置之后的 KV 与位置编码回滚。</li>
</ol>
<p>账本是这样的：校验一次要读一遍全部权重，计算 γ+1 个位置的矩阵乘（GEMM）；普通 decode 一步也读一遍权重，只算 1 个位置。只要 γ+1 没大到让计算时间超过权重读取时间，校验的墙钟时间就接近一步普通 decode。图 1 把这个时间差画了出来。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="串行解码与投机解码的时序对比">
<defs>
<marker id="speculative-decoding-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="var(--sv-muted)"></path></marker>
</defs>
<text x="24" y="26" font-size="15" font-family="inherit" fill="var(--sv-ink)">同样产出 4 个 token：串行解码 vs 投机解码（示意，未按比例）</text>
<rect x="560" y="40" width="12" height="12" fill="var(--sv-a2)" stroke="var(--sv-a)"></rect>
<text x="578" y="50" font-size="12" font-family="inherit" fill="var(--sv-muted)">目标前向</text>
<rect x="640" y="40" width="12" height="12" fill="var(--sv-b)"></rect>
<text x="658" y="50" font-size="12" font-family="inherit" fill="var(--sv-muted)">草稿</text>
<rect x="700" y="40" width="12" height="12" fill="var(--sv-c)"></rect>
<text x="718" y="50" font-size="12" font-family="inherit" fill="var(--sv-muted)">被拒</text>
<text x="24" y="110" font-size="14" font-family="inherit" fill="var(--sv-ink)">基线</text>
<text x="24" y="130" font-size="12" font-family="inherit" fill="var(--sv-muted)">target 逐 token</text>
<rect x="190" y="92" width="126" height="52" fill="var(--sv-a2)" stroke="var(--sv-a)"></rect>
<rect x="326" y="92" width="126" height="52" fill="var(--sv-a2)" stroke="var(--sv-a)"></rect>
<rect x="462" y="92" width="126" height="52" fill="var(--sv-a2)" stroke="var(--sv-a)"></rect>
<rect x="598" y="92" width="126" height="52" fill="var(--sv-a2)" stroke="var(--sv-a)"></rect>
<text x="253" y="114" font-size="13" text-anchor="middle" font-family="inherit" fill="var(--sv-ink)">target step</text>
<text x="253" y="132" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-ink)">1 token</text>
<text x="389" y="114" font-size="13" text-anchor="middle" font-family="inherit" fill="var(--sv-ink)">target step</text>
<text x="389" y="132" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-ink)">1 token</text>
<text x="525" y="114" font-size="13" text-anchor="middle" font-family="inherit" fill="var(--sv-ink)">target step</text>
<text x="525" y="132" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-ink)">1 token</text>
<text x="661" y="114" font-size="13" text-anchor="middle" font-family="inherit" fill="var(--sv-ink)">target step</text>
<text x="661" y="132" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-ink)">1 token</text>
<text x="190" y="168" font-size="12" font-family="inherit" fill="var(--sv-muted)">每步读一遍全部权重，只算 1 个位置</text>
<line x1="190" y1="180" x2="724" y2="180" stroke="var(--sv-muted)" stroke-width="1"></line>
<line x1="190" y1="174" x2="190" y2="186" stroke="var(--sv-muted)" stroke-width="1"></line>
<line x1="724" y1="174" x2="724" y2="186" stroke="var(--sv-muted)" stroke-width="1"></line>
<text x="457" y="200" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-muted)">4 步产出 4 token</text>
<text x="24" y="238" font-size="14" font-family="inherit" fill="var(--sv-ink)">投机</text>
<text x="24" y="258" font-size="12" font-family="inherit" fill="var(--sv-muted)">draft + verify</text>
<rect x="190" y="216" width="30" height="44" fill="var(--sv-b)"></rect>
<rect x="224" y="216" width="30" height="44" fill="var(--sv-b)"></rect>
<rect x="258" y="216" width="30" height="44" fill="var(--sv-b)"></rect>
<rect x="292" y="216" width="30" height="44" fill="var(--sv-c)"></rect>
<text x="205" y="242" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-ink)">d1</text>
<text x="239" y="242" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-ink)">d2</text>
<text x="273" y="242" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-ink)">d3</text>
<text x="307" y="242" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-ink)">d4</text>
<text x="286" y="208" font-size="12" font-family="inherit" fill="var(--sv-c)">d4 被拒</text>
<rect x="326" y="216" width="126" height="44" fill="var(--sv-a2)" stroke="var(--sv-a)"></rect>
<text x="389" y="236" font-size="13" text-anchor="middle" font-family="inherit" fill="var(--sv-ink)">verify γ+1=5 位置</text>
<text x="389" y="254" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-ink)">权重只读一遍</text>
<text x="190" y="280" font-size="12" font-family="inherit" fill="var(--sv-muted)">草稿逐 token，单步成本 c ≈ 0.05</text>
<text x="330" y="280" font-size="12" font-family="inherit" fill="var(--sv-muted)">一次并行校验，近似 1 步耗时</text>
<line x1="190" y1="300" x2="452" y2="300" stroke="var(--sv-muted)" stroke-width="1"></line>
<line x1="190" y1="294" x2="190" y2="306" stroke="var(--sv-muted)" stroke-width="1"></line>
<line x1="452" y1="294" x2="452" y2="306" stroke="var(--sv-muted)" stroke-width="1"></line>
<text x="321" y="322" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-muted)">1.2 步产出 4 token（期望值）</text>
<line x1="190" y1="350" x2="720" y2="350" stroke="var(--sv-muted)" stroke-width="1" marker-end="url(#speculative-decoding-arrow)"></line>
<text x="730" y="354" font-size="12" text-anchor="end" font-family="inherit" fill="var(--sv-muted)">时间</text>
<text x="380" y="354" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-ink)">草稿越长，收益越依赖接受率</text>
</svg><figcaption>图 1 · 串行解码每读一遍权重只产出一个 token；投机解码用 4 步小模型草稿换来一次并行校验，一次权重读取产出多个 token。宽度为示意。</figcaption></figure>
<p>套利来源就是把一次昂贵访存摊到多个 token 上。草稿虽要跑 γ 步，但模型小，单步成本 c 通常只有目标的 5%-10%，四步加起来仍远小于一次目标前向。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>γ 不是越大越好。γ=16 时校验要处理 17 个位置，batch=1 下算术强度也只有约 17 FLOP/byte，仍远低于脊点；但注意力与 MLP 的计算量、KV 读取和 kernel 开销都会随位置数增加，而接受率又随深度指数衰减，所以继续加长通常不划算。在 H100 上做 7B/70B 组合，γ 的经验值通常是 3-6；树状草稿看的是候选节点数，不是深度。</div></div>
</section>
<section class="sec">
<h2>拒绝采样：猜错了，分布也不变</h2>
<p>草稿分布 q 与目标 p 不可能处处相等。无脑接受草稿 token 会让输出偏向 q。拒绝采样（rejection sampling）用两个动作纠正：按比例接受，拒绝时从“目标多出来的部分”重采样。</p>
<div class="formula">接受概率：a(x) = min(1, p(x) ÷ q(x))
残差分布：r(x) = max(0, p(x) − q(x)) ÷ Σ_y max(0, p(y) − q(y))
单步输出：q(x)·a(x) + [Σ_y q(y)·(1 − a(y))]·r(x) = p(x)</div>
<p>推导只有一行：q(x)·a(x) = min(q(x), p(x))；拒绝的总概率是 1 − Σ_y min(q(y), p(y))，正好等于 Σ_y max(0, p(y) − q(y))，也就是残差分布的归一化常数；两项相加得到 min(q,p) + max(0, p−q) = p。q 高估的 token 被按比例削掉，q 低估（p 更大）的部分由残差补上，一分不多一分不少。</p>
<div class="callout callout--formula"><span class="callout__label">公式</span><div>记住“多退少补”。q 比 p 高的地方按 p/q 打折接受；被拒掉的质量按 (p−q) 的正部重新分配。两项相加严格等于 p，最终采样分布不变。</div></div>
<p>多位置版本靠链式法则成立：每一轮都以同一段已接受前缀为条件，拒绝处从 p 重采样并截断，之后的条件分布仍是目标的。因此整条序列的联合分布与目标模型逐 token 采样一致，不是“近似一致”。</p>
<p>三个前提常被忽略。草稿与目标必须共享词表与分词器，否则候选无法映射；p 与 q 必须是<mark>实际采样分布</mark>，温度、top-p、重复惩罚要一致作用于两者，只给草稿加 top-p 会破坏精确性；贪心是另一套论证——草稿等于目标 argmax 就接受，否则用 argmax 覆盖，输出与目标贪心一致。</p>
<p>Medusa-2 用 typical acceptance 替代严格拒绝，目标模型给该候选的概率不低于阈值就直接接受，换取更长接受长度。这不再是精确采样，属于有意识的取舍，评估时要单独看质量，不能假设分布不变。</p>
</section>

<section class="sec">
<h2>加速比：接受率、草稿长度与成本</h2>
<p>把一轮的收益和成本写成公式。γ 是每轮草稿数，α 是单 token 接受率，c 是草稿单步耗时与目标单步耗时之比。</p>
<div class="formula">期望产出：E = 1 + α + α² + … + α^γ = (1 − α^(γ+1)) ÷ (1 − α)
一轮成本（以目标单步为单位）：C = 1 + γ·c
加速比：S = E ÷ C
batch=1 且校验未过 compute-bound 拐点时，校验项近似为 1</div>
<p>式中的 1 是每轮必得的那个 token：全部接受时是 bonus token，发生拒绝时是残差采样出的修正 token。α=0.8、γ=4 时，E=(1−0.8⁵)/0.2≈3.36，C=1+4×0.05=1.2，S≈2.8。这与 Chen 等在 70B 模型上报告的 2-2.5× 处于同一量级。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="接受率与投机解码加速比的关系曲线">
<text x="24" y="26" font-size="15" font-family="inherit" fill="var(--sv-ink)">接受率 α 与加速比 S（草稿成本 c=0.05）</text>
<line x1="100" y1="78" x2="132" y2="78" stroke="var(--sv-a)" stroke-width="2"></line>
<text x="140" y="82" font-size="12" font-family="inherit" fill="var(--sv-ink)">γ=2</text>
<line x1="100" y1="96" x2="132" y2="96" stroke="var(--sv-b)" stroke-width="2"></line>
<text x="140" y="100" font-size="12" font-family="inherit" fill="var(--sv-ink)">γ=4</text>
<line x1="100" y1="114" x2="132" y2="114" stroke="var(--sv-c)" stroke-width="2"></line>
<text x="140" y="118" font-size="12" font-family="inherit" fill="var(--sv-ink)">γ=8</text>
<line x1="80" y1="330" x2="720" y2="330" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="80" y1="60" x2="80" y2="330" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="80" y1="252.9" x2="720" y2="252.9" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="4 6"></line>
<line x1="80" y1="175.7" x2="720" y2="175.7" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="4 6"></line>
<line x1="80" y1="98.6" x2="720" y2="98.6" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="4 6"></line>
<text x="70" y="334" font-size="12" text-anchor="end" font-family="inherit" fill="var(--sv-muted)">1.0</text>
<text x="70" y="257" font-size="12" text-anchor="end" font-family="inherit" fill="var(--sv-muted)">2.0</text>
<text x="70" y="180" font-size="12" text-anchor="end" font-family="inherit" fill="var(--sv-muted)">3.0</text>
<text x="70" y="103" font-size="12" text-anchor="end" font-family="inherit" fill="var(--sv-muted)">4.0</text>
<text x="80" y="350" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-muted)">0.3</text>
<text x="286.7" y="350" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-muted)">0.5</text>
<text x="493.3" y="350" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-muted)">0.7</text>
<text x="700" y="350" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-muted)">0.9</text>
<text x="400" y="372" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-muted)">接受率 α</text>
<text x="34" y="200" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-muted)" transform="rotate(-90 34 200)">加速比 S</text>
<polyline points="80,309.6 286.7,284.4 390,269.7 493.3,253.5 596.7,236.1 700,217.1" fill="none" stroke="var(--sv-a)" stroke-width="2.5"></polyline>
<polyline points="80,315.5 286.7,282.6 390,258.9 493.3,228.9 596.7,191.1 700,143.9" fill="none" stroke="var(--sv-b)" stroke-width="2.5"></polyline>
<polyline points="80,328.4 286.7,297.1 390,270.8 493.3,230.9 596.7,168.5 700,69.8" fill="none" stroke="var(--sv-c)" stroke-width="2.5"></polyline>
<circle cx="596.7" cy="191.1" r="4" fill="var(--sv-b)"></circle>
<text x="608" y="187" font-size="12" font-family="inherit" fill="var(--sv-ink)">α=0.8, γ=4 → 2.8×</text>
<text x="608" y="204" font-size="12" font-family="inherit" fill="var(--sv-muted)">C=1.2, E=3.36</text>
<text x="24" y="372" font-size="12" font-family="inherit" fill="var(--sv-muted)">假设接受率不随深度变化；实际 α 逐位置衰减，需以实测平均接受长度为准。</text>
</svg><figcaption>图 2 · 接受率低于 0.5 时所有曲线的加速比都不到 1.7 倍；α 越高，加大 γ 才越有意义。c=0.05 对应约 1/20 大小的草稿模型。</figcaption></figure>
<p>读图有三个结论。第一，α 低于 0.5 时所有曲线的加速比都不到 1.7×，γ 再大也救不回来，该换草稿而不是加长度。第二，γ 的最优值随 α 上升：α=0.6 时 γ=8 的 1.77× 不如 γ=4 的 1.92×，因为后几个位置几乎必被拒，草稿成本却照付。第三，c 决定天花板：c 接近 1（用同尺寸模型做草稿）时 S 趋近 1，加速比归零。</p>
<p>真实接受率随深度衰减，公式里的 α 应理解为逐位置接受率的等效值（常用几何平均作近似）。工程上更稳妥的口径是直接测<mark>平均接受长度</mark> L（每轮平均产出的 token 数），再用 S ≈ L ÷ (1 + γc) 估算。L 是推理框架日志里最值得盯的指标，比“接受率”更贴近收益。</p>
<p>端到端还要打折：首 token 延迟（prefill）、排队、网络、detokenize 都不受益。若 decode 只占总延迟 60%，decode 侧 2.8× 在端到端只剩约 1.6×（1 ÷ (0.4 + 0.6/2.8)）。宣传材料的倍数通常是 decode 侧口径，比较时要问清楚。</p>
</section>

<section class="sec">
<h2>草稿从哪来：五条路线与 tree attention</h2>
<p>草稿的质量决定 α，草稿的成本决定 c，两者共同决定收益。主流路线有五类。</p>
<p><b>独立小模型。</b>最直接：用同系列、同分词器的 1B 级模型给 7B/70B 做草稿。Leviathan 等用 T5-small（约 60M）给 T5-XXL（11B）做草稿，在翻译与摘要任务上报告 2-3×；Chen 等用 7B 给 70B Chinchilla 做草稿，在分布式环境中报告 2-2.5×。LLM 草稿通常取目标的 1/10 到 1/20；T5-small 对 T5-XXL 只有约 1/180，仍能工作，说明尺寸不是唯一因素，分布接近更关键。草稿最好在相近数据上训练或蒸馏，否则 α 会很难看。</p>
<p><b>Medusa。</b>在目标最后一层隐藏状态上接 K 个解码头，分别预测 +1 到 +K 个位置，候选拼成树后一次校验。额外参数通常不到 2%，但头需要训练；论文在 Vicuna 系列上报告 2.2-3.6×。</p>
<p><b>EAGLE。</b>草稿不在 token 空间自回归，而在特征空间：用目标的隐藏状态加轻量头预测下一层特征，再映射回 token。特征比离散 token 信息更多，α 更高。EAGLE 报告 2-3×；EAGLE-2 用动态草稿树，报告 3.05-4.26×（任务相关）。</p>
<p><b>自投机（self-speculative）。</b>不引入第二个模型：跳层、early exit，或把目标的浅层子网当草稿。省显存、部署简单，但草稿与目标强相关，α 往往不如独立小模型；LayerSkip 一类工作需要专门训练，报告 1.5-2× 量级。</p>
<p><b>Lookahead decoding。</b>完全不用草稿模型，用 Jacobi 迭代并行猜多个未来位置，并维护 n-gram 池复用历史片段。实现简单、无额外权重，但一次校验的候选多、计算开销大；论文在代码生成等任务上报告约 1.5-2.3×。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>路线</th><th>额外权重</th><th>需要训练</th><th>一次校验的候选</th><th>论文报告加速</th><th>主要代价</th></tr></thead>
<tbody>
<tr><td>独立小模型</td><td>通常目标的 5%-10%</td><td>否，可直接用</td><td>γ 个线性候选</td><td>2-3×</td><td>显存与草稿 KV</td></tr>
<tr><td>Medusa</td><td>少量头，通常不到 2%</td><td>是</td><td>树，数十节点</td><td>2.2-3.6×</td><td>头训练、树校验</td></tr>
<tr><td>EAGLE / EAGLE-2</td><td>轻量头</td><td>是</td><td>树；EAGLE-2 动态剪枝</td><td>2-3× / 3.05-4.26×</td><td>训练、特征对齐</td></tr>
<tr><td>自投机（跳层等）</td><td>无</td><td>视方法而定</td><td>γ 个线性候选</td><td>1.5-2× 量级</td><td>α 偏低</td></tr>
<tr><td>Lookahead</td><td>无</td><td>否</td><td>多维窗口</td><td>约 1.5-2.3×</td><td>校验计算量大</td></tr>
</tbody>
</table></div>
<p>表中加速比均为论文自报，硬件、任务与 batch 口径不同，不能直接横向比较；选型先看显存与训练成本，再用自己的流量测 α。</p>
<h3>tree attention：把多条候选塞进一次前向</h3>
<p>树状草稿（Medusa、EAGLE、SpecInfer 等）会一次给出多个分支。逐条校验等于把权重读多遍，白费优势。tree attention 的做法是把所有候选节点按深度优先顺序打包成一条序列，用自定义注意力掩码让每个节点只 attend 自己的祖先链与自身，位置 id 按深度分配。同一前缀的 KV 只算一次，跨分支的注意力被掩码屏蔽。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="草稿树结构与打包后的树注意力掩码">
<text x="24" y="26" font-size="15" font-family="inherit" fill="var(--sv-ink)">草稿树与 tree attention 掩码</text>
<text x="24" y="56" font-size="12" font-family="inherit" fill="var(--sv-muted)">5 个候选共享 1 个已确认前缀</text>
<line x1="85" y1="300" x2="50" y2="225" stroke="var(--sv-line)" stroke-width="2"></line>
<line x1="85" y1="300" x2="135" y2="225" stroke="var(--sv-line)" stroke-width="2"></line>
<line x1="50" y1="225" x2="25" y2="150" stroke="var(--sv-line)" stroke-width="2"></line>
<line x1="50" y1="225" x2="75" y2="150" stroke="var(--sv-line)" stroke-width="2"></line>
<line x1="135" y1="225" x2="135" y2="150" stroke="var(--sv-line)" stroke-width="2"></line>
<circle cx="85" cy="300" r="18" fill="var(--sv-b)" stroke="var(--sv-a)"></circle>
<text x="85" y="305" font-size="13" text-anchor="middle" font-family="inherit" fill="var(--sv-ink)">R</text>
<text x="85" y="334" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-muted)">pos 0</text>
<circle cx="50" cy="225" r="18" fill="var(--sv-a2)" stroke="var(--sv-a)"></circle>
<text x="50" y="230" font-size="13" text-anchor="middle" font-family="inherit" fill="var(--sv-ink)">A</text>
<text x="50" y="259" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-muted)">pos 1</text>
<circle cx="135" cy="225" r="18" fill="var(--sv-a2)" stroke="var(--sv-a)"></circle>
<text x="135" y="230" font-size="13" text-anchor="middle" font-family="inherit" fill="var(--sv-ink)">B</text>
<text x="135" y="259" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-muted)">pos 1</text>
<circle cx="25" cy="150" r="18" fill="var(--sv-a2)" stroke="var(--sv-a)"></circle>
<text x="25" y="155" font-size="13" text-anchor="middle" font-family="inherit" fill="var(--sv-ink)">C</text>
<text x="25" y="184" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-muted)">pos 2</text>
<circle cx="75" cy="150" r="18" fill="var(--sv-a2)" stroke="var(--sv-a)"></circle>
<text x="75" y="155" font-size="13" text-anchor="middle" font-family="inherit" fill="var(--sv-ink)">D</text>
<text x="75" y="184" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-muted)">pos 2</text>
<circle cx="135" cy="150" r="18" fill="var(--sv-a2)" stroke="var(--sv-a)"></circle>
<text x="135" y="155" font-size="13" text-anchor="middle" font-family="inherit" fill="var(--sv-ink)">E</text>
<text x="135" y="184" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-muted)">pos 2</text>
<text x="400" y="56" font-size="12" font-family="inherit" fill="var(--sv-muted)">打包后的注意力掩码</text>
<text x="482.5" y="104" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-muted)">R</text>
<text x="508.5" y="104" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-muted)">A</text>
<text x="534.5" y="104" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-muted)">B</text>
<text x="560.5" y="104" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-muted)">C</text>
<text x="586.5" y="104" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-muted)">D</text>
<text x="612.5" y="104" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-muted)">E</text>
<text x="458" y="134" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-muted)">R</text>
<text x="458" y="160" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-muted)">A</text>
<text x="458" y="186" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-muted)">B</text>
<text x="458" y="212" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-muted)">C</text>
<text x="458" y="238" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-muted)">D</text>
<text x="458" y="264" font-size="12" text-anchor="middle" font-family="inherit" fill="var(--sv-muted)">E</text>
<g stroke="var(--sv-line)" stroke-width="1">
<rect x="470" y="120" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="496" y="120" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="522" y="120" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="548" y="120" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="574" y="120" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="600" y="120" width="25" height="25" fill="var(--sv-panel)"></rect>
<rect x="470" y="146" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="496" y="146" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="522" y="146" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="548" y="146" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="574" y="146" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="600" y="146" width="25" height="25" fill="var(--sv-panel)"></rect>
<rect x="470" y="172" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="496" y="172" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="522" y="172" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="548" y="172" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="574" y="172" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="600" y="172" width="25" height="25" fill="var(--sv-panel)"></rect>
<rect x="470" y="198" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="496" y="198" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="522" y="198" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="548" y="198" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="574" y="198" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="600" y="198" width="25" height="25" fill="var(--sv-panel)"></rect>
<rect x="470" y="224" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="496" y="224" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="522" y="224" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="548" y="224" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="574" y="224" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="600" y="224" width="25" height="25" fill="var(--sv-panel)"></rect>
<rect x="470" y="250" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="496" y="250" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="522" y="250" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="548" y="250" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="574" y="250" width="25" height="25" fill="var(--sv-panel)"></rect><rect x="600" y="250" width="25" height="25" fill="var(--sv-panel)"></rect>
</g>
<g fill="var(--sv-b)" stroke="var(--sv-b)">
<rect x="470" y="120" width="25" height="25"></rect>
<rect x="470" y="146" width="25" height="25"></rect><rect x="496" y="146" width="25" height="25"></rect>
<rect x="470" y="172" width="25" height="25"></rect><rect x="522" y="172" width="25" height="25"></rect>
<rect x="470" y="198" width="25" height="25"></rect><rect x="496" y="198" width="25" height="25"></rect><rect x="548" y="198" width="25" height="25"></rect>
<rect x="470" y="224" width="25" height="25"></rect><rect x="496" y="224" width="25" height="25"></rect><rect x="574" y="224" width="25" height="25"></rect>
<rect x="470" y="250" width="25" height="25"></rect><rect x="522" y="250" width="25" height="25"></rect><rect x="600" y="250" width="25" height="25"></rect>
</g>
<text x="650" y="132" font-size="12" font-family="inherit" fill="var(--sv-muted)">■ 可见</text>
<text x="650" y="152" font-size="12" font-family="inherit" fill="var(--sv-muted)">□ 屏蔽</text>
<text x="650" y="176" font-size="12" font-family="inherit" fill="var(--sv-muted)">行：查询节点</text>
<text x="650" y="194" font-size="12" font-family="inherit" fill="var(--sv-muted)">列：键值节点</text>
<text x="24" y="362" font-size="12" font-family="inherit" fill="var(--sv-muted)">position id 按深度分配；所有候选共享已确认前缀的 KV，掩码屏蔽跨分支注意力。</text>
</svg><figcaption>图 3 · 5 个候选组成两层的草稿树。打包成一条序列后，每个节点只 attend 祖先链与自身，因此一次前向即可校验所有分支。</figcaption></figure>
<p>一次前向就校验了整棵树。代价是实打实的：N 个候选节点意味着约 N 个 token 的 MLP 与注意力计算，掩码是 N×N，长上下文下 KV 读取也按节点数增长。树不是免费的并行——节点越多，校验的注意力与 MLP 计算、KV 读取和显存峰值都随之增长；在高 batch 下这部分计算不再免费。常见做法是限制树宽与深度（如几十个节点），或像 EAGLE-2 那样按置信度动态剪枝。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>树越宽不等于越快。接受长度通常只随有效深度增长，校验成本却随节点数近似线性增长；当节点数翻倍而平均接受长度只涨 20% 时，加速比会下降。调树之前先量平均接受长度，而不是只调宽度。</div></div>
</section>
<section class="sec">
<h2>工程权衡：算力、显存与适用边界</h2>
<h3>额外算力与显存</h3>
<p>显存有三笔账：草稿权重、草稿 KV Cache、树校验的候选 KV 与 logits。7B 草稿配 70B 目标，bf16 下权重多约 14 GB（约 10%）；草稿 KV 按它的层数与头数另算。Medusa/EAGLE 的头权重很小，但树校验会临时抬高激活与 KV 峰值。部署前用目标并发跑一遍显存水位。</p>
<p>算力侧要区分两种工况。batch=1 时目标本来就在等权重，校验多算的 γ+1 个位置几乎不增加墙钟时间，这部分算力是闲置的。batch 增大后权重读取被摊薄，GPU 已在做有用功，校验不再免费；decode 接近 compute-bound 时，投机还会拖慢吞吐。</p>
<h3>什么时候划算</h3>
<div class="duo"><div class="duo__col"><h4>适合</h4><p>低并发、单请求延迟敏感；输出较长（数百 token 以上）；任务可预测，例如代码补全、摘要、翻译、结构化抽取、RAG 引用复制；decode 占总延迟大头；显存有余量。</p></div><div class="duo__col"><h4>不适合</h4><p>高吞吐离线批处理或大 batch 在线服务；decode 已 compute-bound；输出只有几十 token；开放式创作导致 α 低；显存紧张；对 p99 极敏感且无法容忍接受率波动。</p></div></div>
<h3>怎么测才算数</h3>
<p>正确口径是<mark>同质量、同硬件、同并发下的端到端墙钟时间</mark>，不是接受率，也不是 decode 微基准。固定模型、dtype、batch、并发数、输入输出长度与全部采样参数；预热至少 3 次，重复 5 次以上，同时报 p50 与 p99。</p>
<pre class="code" data-lang="bash"><code># 基线：先不加投机，记录 tok/s、TTFT、p50/p99
vllm serve meta-llama/Llama-3.1-8B-Instruct \
  --dtype bfloat16 --max-model-len 8192

# 投机：除 speculative 相关参数外，其余保持一致
vllm serve meta-llama/Llama-3.1-8B-Instruct \
  --speculative-config '{"model": "meta-llama/Llama-3.2-1B-Instruct", "method": "draft_model", "num_speculative_tokens": 4}' \
  --dtype bfloat16 --max-model-len 8192</code></pre>
<p>参数名以所用版本文档为准；较新的 vLLM 推荐用 --speculative-config 传 JSON，旧版本可能是 --speculative-model 与 --num-speculative-tokens。服务端日志通常会打印平均接受长度与接受率，字段名随版本变化；没有的话从响应的 token 计数与请求数自行推算。压测要用真实业务 prompt，不要用训练集模板——接受率对输入分布极其敏感，模板上的 0.9 到线上可能只剩 0.6。</p>
<p>另外要测 c、校验步相对基线步的耗时比、拒绝率随位置的变化，三者能定位大部分“越开越慢”的问题。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>排障顺序：先确认基线确实是 memory-bound（HBM 带宽利用率高、SM 利用率低），再看平均接受长度是否达到预期（低于 2 时收益通常有限），然后看校验的额外计算是否已经不再被访存掩盖（高 batch 下尤其明显），最后确认框架真的走了投机路径（查日志与 kernel 名，而不是只看参数被接受）。</div></div>
</section>

<section class="sec">
<h2>常见误区、自测与延伸阅读</h2>
<h3>六个常见误区</h3>
<ul>
<li><b>“接受率越高越快”。</b>收益还取决于 γ 与 c。α 高但 γ 过大或草稿太贵，仍可能不如基线；应看平均接受长度与端到端耗时。</li>
<li><b>“投机解码会改变输出”。</b>严格拒绝采样下分布不变，贪心输出也逐 token 相同；只有 typical acceptance 等非精确接受准则，或草稿与目标的采样分布、词表不一致时，才可能引入偏差；草稿是否蒸馏过并不影响严格拒绝采样的精确性。</li>
<li><b>“随便找个小模型就能当草稿”。</b>必须共享分词器与词表，且分布要接近；跨家族、跨词表的组合往往连候选都无法映射，α 极低。</li>
<li><b>“batch 越大越赚”。</b>通常相反。大 batch 把 decode 推向 compute-bound，校验的额外计算不再免费，吞吐可能下降。</li>
<li><b>“树的候选越多越好”。</b>校验成本随节点数增长，接受长度却主要随有效深度增长；宽树常常只增加显存与延迟。</li>
<li><b>“只看 token/s”。</b>还要看 p99、TTFT 与质量；接受率波动会明显恶化尾延迟，平均值好看不代表线上可用。</li>
</ul>
<h3>自测</h3>
<details class="quiz"><summary>Q1 · batch=1 时，校验 γ+1 个位置为什么几乎不增加一步的耗时？</summary><div class="quiz__a">权重只从 HBM 读一遍，γ+1 个位置的矩阵乘共用同一批权重，计算量增加但访存量基本不变。只要计算时间还没超过权重读取时间，墙钟时间就接近一次普通 decode。算术强度从约 1 提到约 γ+1 FLOP/byte，仍远低于 H100 的脊点 295 FLOP/byte；但长上下文时 KV Cache 读取会随位置数增加，这部分不能忽略。</div></details>
<details class="quiz"><summary>Q2 · 用一句话解释拒绝采样为什么能保持目标分布，并说明拒绝后为什么要用 (p−q) 的正部。</summary><div class="quiz__a">接受概率取 min(1, p/q)，使 q 高估的 token 按比例被削掉，留下 min(q,p)。被拒绝的总质量是 1−Σ min(q,p)，它等于 Σ max(0, p−q)，正好是残差分布的归一化常数。残差分布取 r(x)=max(0, p(x)−q(x)) ÷ Σ_y max(0, p(y)−q(y))，补回目标分布中 q 低估的区域。两项相加为 min(q,p)+max(0, p−q)=p，因此单步分布严格不变。</div></details>
<details class="quiz"><summary>Q3 · α=0.6、γ=8、c=0.05 时加速比是多少？为什么继续加大 γ 收益很小？</summary><div class="quiz__a">E=(1−0.6⁹)/(1−0.6)=(1−0.0101)/0.4≈2.47，C=1+8×0.05=1.4，S≈1.77。α=0.6 时第 6 个候选的接受概率约 4.7%，第 8 个只剩约 1.7%，期望产出趋于饱和，而草稿成本仍按 γ 线性增长。此时应减小 γ 到 3-4，或换更好的草稿把 α 提上去。</div></details>
<details class="quiz"><summary>Q4 · 线上把并发从 1 提到 64 后，投机版本反而变慢，可能的原因与验证方法是什么？</summary><div class="quiz__a">大 batch 下权重读取被摊薄，decode 从 memory-bound 转向 compute-bound，校验的 γ+1 个位置变成真实开销；同时草稿与树校验占用显存，可能压低可服务的 batch。验证时固定其他参数，只改并发，记录 tok/s、p99、GPU 的 SM 利用率与 HBM 带宽利用率；若投机版本 SM 利用率高但吞吐低，说明已过拐点，应在低并发开启、高并发关闭，或改用更小的 γ 与更轻的草稿。</div></details>
<h3>延伸阅读</h3>
<ul class="refs">
<li><b>Fast Inference from Transformers via Speculative Decoding</b> — Yaniv Leviathan, Matan Kalman, Yossi Matias, ICML 2023（arXiv:2211.17192）。提出 draft-verify 框架与拒绝采样证明，报告 T5-XXL 上 2-3× 加速，是理解分布一致性的原始文献。</li>
<li><b>Accelerating Large Language Model Decoding with Speculative Sampling</b> — Charlie Chen, Sebastian Borgeaud, Geoffrey Irving, Jean-Baptiste Lespiau, Laurent Sifre, John Jumper, DeepMind 2023（arXiv:2302.01318）。在 70B Chinchilla 上用 7B 草稿验证分布式推理，报告 2-2.5×，工程细节更贴近生产。</li>
<li><b>Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads</b> — Tianle Cai 等, 2024（arXiv:2401.10774）。多解码头加树校验的代表作，含 Medusa-2 的 typical acceptance 与训练配方。</li>
<li><b>EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty</b> — Yuhui Li 等, ICML 2024（arXiv:2401.15077）。把草稿移到特征空间；同组的 EAGLE-2（arXiv:2406.16858）进一步给出动态草稿树。</li>
<li><b>Break the Sequential Dependency of LLM Inference Using Lookahead Decoding</b> — Yichao Fu 等, 2024（arXiv:2402.02057）。不依赖草稿模型的路线，用 Jacobi 迭代与 n-gram 池并行猜多个未来位置。</li>
</ul>
</section>

`
};
