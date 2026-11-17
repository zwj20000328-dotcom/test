window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["capacity-cost"] = {
  slug: "capacity-cost",
  title: "容量规划、成本与能效",
  subtitle: "把算力当成钱来管",
  level: 5,
  cluster: "平台",
  tags: ["成本", "容量规划", "PUE"],
  summary: "把 GPU 小时、MFU、每百万 token 成本、PUE 与利用率串成一套能算的账：从训练与推理的成本模型，到容量规划、租买与 spot 决策，再到优化杠杆与成本归因。",
  keyPoints: [
    "每有效 GPU·h 成本 = 时价 ÷ 有效利用率；MFU、集群利用率与 PUE 这些分母比标价更能决定账单",
    "训练用 6ND 估 GPU·h，推理用 277.8 × 时价 ÷ 输出吞吐 估每百万 token 成本，两者口径不可混用",
    "容量规划从峰值 QPS 与 Little 定律推并发，再用 KV 显存和单副本压测双向夹逼副本数，并留出故障域",
    "先提利用率与批处理，再谈量化、缓存与电价；归因必须把闲置与碎片摊进成本"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec"><h2>先建立成本模型：三个计价器</h2>
<p>先给一句直觉：<mark>算力不是按“张卡”卖的，是按“卡 × 小时 ÷ 你真正用上的比例”算账的</mark>。同一批 H100，摊到每个有效 token 上的成本可以差一个数量级，差别全在分母：训练看 MFU（Model FLOPs Utilization，模型浮点算力利用率），推理看批处理与 KV Cache（键值缓存）的利用，机房看 PUE（Power Usage Effectiveness，电能利用效率）与集群利用率。</p>
<p>工程上有三个计价器：<b>训练</b>用 GPU·h（GPU-hour，卡时）回答“这次预训练烧多少钱”；<b>推理</b>用每百万 token 的美元成本回答“每个请求亏不亏”；<b>平台</b>用“每有效 GPU·h”把折旧、电力、网络、人力与闲置摊进去。三者不能混用：训练账本没有请求排队，推理账本不该出现优化器状态。</p>
<p>标价往往不是答案：公开的 GPU 时价会趋同，团队之间的效率差距不会。图 1 给出自建集群的 TCO（Total Cost of Ownership，总拥有成本）结构：GPU 折旧与租金约占一半，电力与散热一成多，其余是网络存储、人力，以及最容易被漏掉的闲置与碎片。其中闲置与碎片可能占 5%–20%，恰好是平台工程最能动手的地方。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="GPU 集群年度总拥有成本分解条形图">
<rect x="0" y="0" width="760" height="380" fill="var(--sv-bg)"></rect>
<text x="30" y="32" font-size="15" font-family="inherit" fill="var(--sv-ink)" font-weight="bold">一个 GPU 集群的年度 TCO 分解（示意）</text>
<text x="30" y="54" font-size="12" font-family="inherit" fill="var(--sv-muted)">口径：1,000 张 H100 级 GPU、自建机房、年均利用率约 60%</text>
<rect x="30" y="78" width="385" height="56" fill="var(--sv-a)"></rect>
<rect x="415" y="78" width="105" height="56" fill="var(--sv-b)"></rect>
<rect x="520" y="78" width="56" height="56" fill="var(--sv-c)"></rect>
<rect x="576" y="78" width="77" height="56" fill="var(--sv-a2)"></rect>
<rect x="653" y="78" width="77" height="56" fill="var(--sv-b2)"></rect>
<text x="222" y="112" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">55%</text>
<text x="467" y="112" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">15%</text>
<text x="548" y="112" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">8%</text>
<text x="614" y="112" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">11%</text>
<text x="691" y="112" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">11%</text>
<rect x="30" y="160" width="14" height="14" fill="var(--sv-a)"></rect>
<text x="54" y="172" font-size="12" font-family="inherit" fill="var(--sv-ink)">GPU 折旧与租金　45–65%</text>
<rect x="30" y="190" width="14" height="14" fill="var(--sv-b)"></rect>
<text x="54" y="202" font-size="12" font-family="inherit" fill="var(--sv-ink)">电力与散热　10–20%</text>
<rect x="30" y="220" width="14" height="14" fill="var(--sv-c)"></rect>
<text x="54" y="232" font-size="12" font-family="inherit" fill="var(--sv-ink)">网络与存储　5–10%</text>
<rect x="400" y="160" width="14" height="14" fill="var(--sv-a2)"></rect>
<text x="424" y="172" font-size="12" font-family="inherit" fill="var(--sv-ink)">人力与运维　8–15%</text>
<rect x="400" y="190" width="14" height="14" fill="var(--sv-b2)"></rect>
<text x="424" y="202" font-size="12" font-family="inherit" fill="var(--sv-ink)">闲置与碎片　5–20%</text>
<text x="424" y="232" font-size="12" font-family="inherit" fill="var(--sv-muted)">区间为经验示意，不是财报</text>
<rect x="30" y="268" width="700" height="84" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="46" y="292" font-size="12" font-family="inherit" fill="var(--sv-ink)">每有效 GPU·h 成本 ≈（折旧 + 电费 + 网络存储 + 运维）÷（GPU 数 × 8,760 h × 利用率）</text>
<text x="46" y="316" font-size="11" font-family="inherit" fill="var(--sv-muted)">折旧按 3–5 年直线摊销；电力含制冷与配电损耗；未计融资、土地与税费。</text>
<text x="46" y="338" font-size="11" font-family="inherit" fill="var(--sv-muted)">比例随自建/租赁、地区电价、卡型与利用率显著变化，只能用于理解结构。</text>
</svg><figcaption>图 1 · TCO 的量级结构。真正能拉开差距的是右下角的闲置与碎片，以及被利用率放大的折旧。</figcaption></figure>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>把 GPU 想成出租车：标价只是起点，真正决定花费的是空驶率。集群的空驶率叫“闲置与碎片”，推理叫“batch 没填满”，训练叫“MFU 低”。</div></div>
</section>
<section class="sec"><h2>训练账本：GPU·h 与 MFU</h2>
<p>训练成本的物理起点是浮点运算量。对以 Transformer 为主的大模型，前向加反向的算力可以用 <mark>6ND</mark> 估算：N 是参数量，D 是训练 token 数，6 来自前向约 2N、反向约 4N 的每 token 乘加。它忽略了注意力中随序列长度增长的项、激活重计算与通信；在常规上下文长度下通常仍在同一量级，够做预算，但长上下文与 MoE 训练要另行修正。</p>
<div class="formula">训练 FLOPs ≈ 6 × N × D　（前向 2ND + 反向 4ND）</div>
<p>把它换成卡时，需要除以硬件的峰值算力与实际利用率：</p>
<div class="formula">GPU·h ≈ 6 × N × D ÷ (MFU × P_peak × 3,600)　　P_peak 为单卡峰值 FLOP/s</div>
<p>举例：70B 参数、2T token，总算力约 8.4×10^23 FLOPs。H100 SXM5 的 BF16 稠密峰值按 NVIDIA 数据表是 989 TFLOPS（不含稀疏加速），若 MFU 为 40%，有效算力约 396 TFLOPS，需要约 2.1×10^9 GPU·秒，即<b>约 59 万 GPU·h</b>。按 $2–3/GPU·h 的示例量级，单次训练约 120 万–180 万美元。价格随合约、地区和年份变动，这里只用来说明数量级。</p>
<p>MFU 与 <code>nvidia-smi</code> 里的 GPU 利用率不是一回事。后者只表示“这段时间内有 kernel 在跑”，哪怕 kernel 在等显存也能显示 100%。MFU 是模型 FLOPs 除以“卡数 × 峰值 × 时间”，大模型训练中 35%–50% 已算不错，具体取决于并行策略、序列长度与集群互联；小模型和推理会低得多。除 MFU 外，大集群连跑几天，节点故障、NCCL 超时与 OOM（Out Of Memory，显存不足）都会导致回滚，实际卡时往往比理论值多 5%–20%。</p>
<div class="callout callout--formula"><span class="callout__label">公式</span><div>总成本 ≈ GPU·h × 单价 × (1 + 失败重跑率) × (1 + 实验系数)。实验系数是消融与调参消耗的卡时占比，常常在 0.5–2 之间，不能只算主训练。</div></div>
<p>此外，算力预算通常假设全程满卡，但启动、编译、评估与保存检查点（checkpoint）都会吃掉时间。<b>预算与排期要按有效卡时，而不是合同卡时</b>。</p>
</section>

<section class="sec"><h2>推理账本：每百万 token 的成本</h2>
<p>推理成本必须落到 token，才能和业务收入对齐。公式很短：</p>
<div class="formula">$/1M tokens = 277.8 × 实例时价($/h) ÷ 输出吞吐(tok/s)</div>
<p>277.8 就是 10^6 ÷ 3,600：把每小时的价格除以每秒输出 token 数，再乘这个常数，就得到每百万 token 的价格。例如 8×H100 节点按 $24/h 的示例价、70B 连续批处理输出 2,000 tok/s，约 $3.3/百万 token；8B 单卡按 $3/h、3,000 tok/s，约 $0.28。差一个数量级，主因是小模型每 token 要读的权重少近十倍。</p>
<p>decode 为何对成本敏感？自回归每产出一个 token 都要把每一层的权重从 HBM 读一遍，算术强度低，瓶颈是显存带宽而非 Tensor Core。H100 SXM 的 HBM3 带宽 3.35 TB/s，70B FP16 权重 140 GB：假设 140 GB 能装进一张卡，单条流每步读完整份权重，上限只有约 24 tok/s；实际必须用 TP=8 把权重摊到 8 张卡，单卡每步只读约 17.5 GB，聚合带宽约 27 TB/s，单流上限升到约 190 tok/s，再被层间通信吃掉一部分。把 batch 做大，权重读取进一步被摊薄，连续批处理（continuous batching）的经济意义就在这里：不改变单请求计算量，却把“每读一遍权重服务多少 token”从 1 提到几十。</p>
<div class="formula">decode 每 token 的算术强度 ≈ 每参数 2 FLOPs ÷ 每参数字节数（单请求、只计权重读取）；70B FP16 为 2 ÷ 2 B = 1 FLOP/B，远低于 H100 SXM 的 989 TFLOPS ÷ 3.35 TB/s ≈ 295 FLOP/B</div>
<p>账本还要区分输入与输出。prefill 阶段是一次大矩阵乘，算力密集，吞吐高；decode 是逐 token、访存密集，吞吐低。多数厂商对输出 token 定价更高，原因就在这里。前缀缓存（prefix caching）能让重复的系统提示与少样本示例只算一次 prefill，对客服、代码补全这类共享前缀多的负载，成本下降非常明显。图 2 给出几组配置的量级对比，它比较的是同一节点、同一时间口径下的输出 token，不是各家的报价单。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="不同模型与优化配置下每百万输出 token 成本对比">
<rect x="0" y="0" width="760" height="380" fill="var(--sv-bg)"></rect>
<text x="30" y="30" font-size="15" font-family="inherit" fill="var(--sv-ink)" font-weight="bold">示例：每百万输出 token 的成本量级</text>
<text x="30" y="50" font-size="11" font-family="inherit" fill="var(--sv-muted)">示例口径：整节点 $24/h，8B 单卡按 1/8 折算为 $3/h；仅输出 token，未计输入与网络存储</text>
<line x1="240" y1="58" x2="240" y2="290" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="240" y1="290" x2="730" y2="290" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="355" y1="58" x2="355" y2="290" stroke="var(--sv-line)" stroke-width="0.6" stroke-dasharray="3 4"></line>
<line x1="470" y1="58" x2="470" y2="290" stroke="var(--sv-line)" stroke-width="0.6" stroke-dasharray="3 4"></line>
<line x1="585" y1="58" x2="585" y2="290" stroke="var(--sv-line)" stroke-width="0.6" stroke-dasharray="3 4"></line>
<line x1="700" y1="58" x2="700" y2="290" stroke="var(--sv-line)" stroke-width="0.6" stroke-dasharray="3 4"></line>
<text x="230" y="93" text-anchor="end" font-size="11" font-family="inherit" fill="var(--sv-ink)">70B · FP16 · 连续批处理</text>
<rect x="240" y="70" width="380" height="26" fill="var(--sv-a)"></rect>
<text x="628" y="89" font-size="11" font-family="inherit" fill="var(--sv-ink)">$3.3</text>
<text x="230" y="138" text-anchor="end" font-size="11" font-family="inherit" fill="var(--sv-ink)">70B · FP8 · 连续批处理</text>
<rect x="240" y="115" width="219" height="26" fill="var(--sv-b)"></rect>
<text x="467" y="134" font-size="11" font-family="inherit" fill="var(--sv-ink)">$1.9</text>
<text x="230" y="183" text-anchor="end" font-size="11" font-family="inherit" fill="var(--sv-ink)">70B · FP8 · 缓存命中 30%</text>
<rect x="240" y="160" width="161" height="26" fill="var(--sv-a2)"></rect>
<text x="409" y="179" font-size="11" font-family="inherit" fill="var(--sv-ink)">$1.4</text>
<text x="230" y="228" text-anchor="end" font-size="11" font-family="inherit" fill="var(--sv-ink)">8B · FP16 · 单卡</text>
<rect x="240" y="205" width="32" height="26" fill="var(--sv-c)"></rect>
<text x="280" y="224" font-size="11" font-family="inherit" fill="var(--sv-ink)">$0.28</text>
<text x="230" y="273" text-anchor="end" font-size="11" font-family="inherit" fill="var(--sv-ink)">8B · FP8 · 单卡</text>
<rect x="240" y="250" width="20" height="26" fill="var(--sv-b2)"></rect>
<text x="268" y="269" font-size="11" font-family="inherit" fill="var(--sv-ink)">$0.17</text>
<text x="240" y="308" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">$0</text>
<text x="355" y="308" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">$1</text>
<text x="470" y="308" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">$2</text>
<text x="585" y="308" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">$3</text>
<text x="700" y="308" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">$4</text>
<text x="30" y="340" font-size="11" font-family="inherit" fill="var(--sv-muted)">价格为示例量级，随合约、地区与时间变动；FP8 与缓存的收益取决于模型、序列长度与命中率。</text>
</svg><figcaption>图 2 · 同一节点下不同配置的每百万输出 token 成本。模型规模决定每个 token 的权重读取量，量化压缩权重字节，前缀缓存省掉重复的 prefill。</figcaption></figure>
<p>最后，每百万 token 成本只有在满足 SLO（Service Level Objective，服务等级目标）时才有意义。压低 TPOT（Time Per Output Token，每输出 token 时间）或要求 P99 不排队，都会牺牲 batch 与吞吐；报成本必须带延迟分位数与峰值余量，否则两个团队会得出相反结论。</p>
</section>
<section class="sec"><h2>容量规划：从 QPS 到副本数</h2>
<p>容量规划（capacity planning）要回答的是“为了守住峰值 SLO，我需要多少张卡、多少副本、多少钱”。顺序不能反：先算需求，再算单副本能力，最后用显存与成本两个约束夹逼。</p>
<p>第一步把业务量翻译成峰值 QPS（Queries Per Second，每秒请求数）：日均 QPS 乘以峰值系数（消费类常见 3–10 倍）。第二步用 Little 定律把 QPS 换成并发：</p>
<div class="formula">并发 L = 到达率 λ × 平均停留时间 W</div>
<p>一个请求从进到出 8 秒、峰值 50 QPS，系统里平均就有 400 个请求在飞。第三步压测单副本：在目标上下文长度与延迟 SLO 下，一个副本能稳定承载多少并发、多少输出 tok/s。第四步用 KV Cache 校验显存：</p>
<div class="formula">KV 字节/token = 2 × L_layer × H_kv × d_head × bytes</div>
<p>以 Llama-3-70B 为例，80 层、8 个 KV 头（GQA，Grouped-Query Attention）、head_dim 128、FP16，每 token 的 KV 约 320 KiB；8k 上下文一条序列约 2.5 GiB，按 TP=8（tensor parallelism，张量并行）分摊到单卡约 320 MiB。70B FP16 权重本身 140 GB，单张 80 GB H100 放不下：仅放权重至少 TP=2，但要给 KV 与激活留余量，工程上常用 TP=4 或 TP=8。按 TP=8 算，每卡 17.5 GB 权重，剩余显存扣除激活与框架开销后还能放一百多条 8k 序列。上下文拉到 128k token，单条就占单卡约 5 GiB，只能放十几条，长上下文贵在这里。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="容量规划五步流程与显存、成本双约束">
<defs><marker id="capacity-cost-arrow2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--sv-muted)"></path></marker></defs>
<rect x="0" y="0" width="760" height="380" fill="var(--sv-bg)"></rect>
<text x="30" y="28" font-size="15" font-family="inherit" fill="var(--sv-ink)" font-weight="bold">容量规划：需求 → 并发 → 单副本 → 副本数 → 成本</text>
<rect x="20" y="46" width="128" height="72" rx="8" fill="var(--sv-panel)" stroke="var(--sv-a)"></rect>
<rect x="166" y="46" width="128" height="72" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<rect x="312" y="46" width="128" height="72" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<rect x="458" y="46" width="128" height="72" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<rect x="604" y="46" width="128" height="72" rx="8" fill="var(--sv-panel)" stroke="var(--sv-a)"></rect>
<text x="84" y="70" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">① 量化需求</text>
<text x="84" y="91" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--sv-muted)">DAU × 请求数</text>
<text x="84" y="106" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--sv-muted)">× 输出 token 数</text>
<text x="230" y="70" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">② 峰值 QPS</text>
<text x="230" y="91" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--sv-muted)">日均 QPS × 峰值系数</text>
<text x="230" y="106" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--sv-muted)">按 P99 口径</text>
<text x="376" y="70" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">③ 并发数</text>
<text x="376" y="91" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--sv-muted)">λ × W（Little 定律）</text>
<text x="376" y="106" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--sv-muted)">峰值并发口径</text>
<text x="522" y="70" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">④ 单副本能力</text>
<text x="522" y="91" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--sv-muted)">压测输出 tok/s</text>
<text x="522" y="106" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--sv-muted)">与可承载并发</text>
<text x="668" y="70" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">⑤ 副本数与余量</text>
<text x="668" y="91" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--sv-muted)">⌈并发 ÷ 单副本⌉</text>
<text x="668" y="106" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--sv-muted)">× 1.3–1.5，至少 N+1</text>
<line x1="148" y1="82" x2="162" y2="82" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#capacity-cost-arrow2)"></line>
<line x1="294" y1="82" x2="308" y2="82" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#capacity-cost-arrow2)"></line>
<line x1="440" y1="82" x2="454" y2="82" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#capacity-cost-arrow2)"></line>
<line x1="586" y1="82" x2="600" y2="82" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#capacity-cost-arrow2)"></line>
<rect x="20" y="170" width="340" height="100" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="36" y="194" font-size="13" font-family="inherit" fill="var(--sv-ink)" font-weight="bold">显存约束（硬上限）</text>
<text x="36" y="216" font-size="11" font-family="inherit" fill="var(--sv-ink)">KV/token = 2 × L × H_kv × d × bytes</text>
<text x="36" y="236" font-size="10.5" font-family="inherit" fill="var(--sv-muted)">70B FP16（80 层、8 KV 头、d=128）≈ 320 KiB/token</text>
<text x="36" y="254" font-size="10.5" font-family="inherit" fill="var(--sv-muted)">8k 上下文 ≈ 2.5 GiB/条（整副本）；140 GB 权重需 TP≥4</text>
<rect x="400" y="170" width="340" height="100" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="416" y="194" font-size="13" font-family="inherit" fill="var(--sv-ink)" font-weight="bold">成本约束（软上限）</text>
<text x="416" y="216" font-size="11" font-family="inherit" fill="var(--sv-ink)">月成本 = 副本数 × 单价 × 730 h</text>
<text x="416" y="236" font-size="10.5" font-family="inherit" fill="var(--sv-muted)">$/1M tokens = 277.8 × 时价 ÷ 输出 tok/s</text>
<path d="M 522 118 V 140 H 190 V 168" fill="none" stroke="var(--sv-line)" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#capacity-cost-arrow2)"></path>
<path d="M 668 118 V 168" fill="none" stroke="var(--sv-line)" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#capacity-cost-arrow2)"></path>
<text x="30" y="300" font-size="11" font-family="inherit" fill="var(--sv-ink)">验证：1.5× 峰值仍满足 P99；N+1 覆盖单点故障；滚动升级预留故障域。</text>
<text x="30" y="324" font-size="11" font-family="inherit" fill="var(--sv-muted)">故障域可以是一张卡、一个节点、一个机柜或一个可用区，余量按最坏的那个算。</text>
</svg><figcaption>图 3 · 容量规划的五个步骤与两个约束。需求决定并发，单副本压测与 KV 显存共同决定副本数，最后才落到账单。</figcaption></figure>
<p>第五步是副本数与余量：常态流量的 1.3–1.5 倍，关键业务至少 N+1 个副本，滚动升级还要留一个故障域（一张卡、一个节点、一个机柜或一个可用区）。最后乘以单价与 730 小时得到月成本，再除以预计 token 数验证单位经济性。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>日均 QPS 乘固定系数只是起点，不要把它直接当作峰值。请求到达有突发性，排队时间对利用率是非线性的：利用率从 70% 提到 90%，平均排队时间可能翻几倍。容量规划要看 P99 到达率与最长突发窗口。</div></div>
</section>

<section class="sec"><h2>租与买，以及 spot 的正确用法</h2>
<p>租还是买，本质是把资本开支换成运营开支，并把利用率风险转移给供应商。自建或长期包年的单位成本最低，但前提是年利用率足够高：若长期只有 40% 的卡在跑，摊销到每个有效卡时上会到 2.5 倍左右。按需（on-demand）最贵，换来弹性；预留或承诺消费（reserved / committed use）居中。表 1 仅为量级，倍率随合约与地区变化。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>方式</th><th>付费结构</th><th>单位成本量级</th><th>中断风险</th><th>适合的负载</th></tr></thead><tbody>
<tr><td>自建 / 长期包年</td><td>资本开支 + 运维</td><td>1.0×（基准）</td><td>低，自己承担故障</td><td>稳定高利用率、数据合规要求强</td></tr>
<tr><td>预留 / 承诺消费</td><td>1–3 年承诺</td><td>1.2–1.5×</td><td>低</td><td>可预测的基线负载</td></tr>
<tr><td>按需</td><td>按秒或小时</td><td>2–4×</td><td>低</td><td>突发流量、短期实验</td></tr>
<tr><td>spot / 抢占式</td><td>按秒，随行就市</td><td>约为按需的 0.2–0.5×</td><td>高，随时可能回收</td><td>容错训练、离线批处理、无状态推理</td></tr>
</tbody></table></div>
<p>spot（抢占式实例，preemptible instance）的价格常见是按需的 20%–50%，代价是随时可能被回收，通知窗口通常不到两分钟。是否划算，取决于“省下的钱”与“被中断浪费的钱”：设 MTBF（Mean Time Between Failures）为 6 小时，每 30 分钟存一次检查点，每次中断平均损失 15 分钟，浪费约 4%；两小时才存一次就接近 17%，折扣可能被吃光。</p>
<div class="formula">期望浪费比例 ≈ 检查点间隔 ÷ (2 × 平均无故障时间)</div>
<p>因此 spot 训练的一等公民是检查点：要异步写、带版本、能校验，并定期做恢复演练；只写不读等于没有（分片与一致性机制见 storage-data）。下面是一个最小续跑外壳，参数名以框架为准：</p>
<pre class="code" data-lang="bash"><code># spot 训练：被抢占后从最近检查点自动续跑
CKPT_DIR=/mnt/ckpt/run-42
while true; do
  python train.py --save-dir "$CKPT_DIR" --save-every 600 --resume auto
  status=$?
  if [ $status -eq 0 ]; then
    break
  fi
  echo "preempted, retry from $CKPT_DIR/latest"
  sleep 30
done</code></pre>
<p>推理侧用 spot：副本无状态，靠负载均衡把被回收的副本摘掉，但必须保证“摘流 → 等在途请求结束 → 退出”的顺序，否则每次回收都会打出一批 5xx。训练侧还要处理弹性扩缩容后的全局 batch 与学习率重算，详见《数据管道与存储》与《数据并行与梯度同步》。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>不要把 spot 用于唯一副本、没有检查点的长任务，也不要把折扣当容量规划的输入：规划要按可保证的 on-demand 或预留容量算，spot 只用于削峰。</div></div>
</section>
<section class="sec"><h2>能效：PUE、电力与散热</h2>
<p>PUE 是数据中心总用电除以 IT 设备用电。PUE 1.2 意味着每 1 kW 的 GPU 与服务器，要额外花 0.2 kW 在制冷与配电上。Uptime Institute 的全球数据中心调查里，行业平均 PUE 多年停在 1.5–1.6 附近（2024 年约 1.56），而新建的超大规模园区可以做到 1.1–1.2；这不只是运维水平差异，还取决于气候、冷却方式与负载率。</p>
<p>功率密度正在改变机房设计。H100 SXM 的 TDP 上限 700 W，H200 同量级但显存带宽更高（141 GB HBM3e、4.8 TB/s）；8 卡 DGX H100 整机约 10.2 kW，NVIDIA 对 GB200 NVL72 给出的口径是单柜约 120 kW。到这个密度，风冷吃力，液冷（direct-to-chip 或浸没式）从可选项变成默认项，也直接影响 PUE 与单位成本。</p>
<p>算一笔电费：1,000 张 700 W 的 GPU，仅 GPU 负载就有 700 kW（IT 总负载还要加上 CPU、网络与存储）；按 PUE 1.2 折算，GPU 部分对应的设施功率约 840 kW，一年 8,760 小时耗电约 7.36 GWh，按 $0.10/kWh 的工业电价示例约 74 万美元。相对数千万美元的硬件采购，这笔钱不算大，但它决定园区能否落地与机柜密度。电价便宜的地区，往往网络延迟与合规约束更强，不能只看单价。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="不同 PUE 下设施用电构成与有效算力占比">
<rect x="0" y="0" width="760" height="380" fill="var(--sv-bg)"></rect>
<text x="30" y="28" font-size="15" font-family="inherit" fill="var(--sv-ink)" font-weight="bold">设施用电去哪了：PUE 与利用率的双重损耗</text>
<text x="30" y="62" font-size="12" font-family="inherit" fill="var(--sv-ink)">PUE 1.2</text>
<text x="730" y="62" text-anchor="end" font-size="11" font-family="inherit" fill="var(--sv-muted)">设施总功率 840 kW</text>
<rect x="30" y="70" width="350" height="44" fill="var(--sv-a)"></rect>
<rect x="380" y="70" width="233" height="44" fill="var(--sv-c)"></rect>
<rect x="613" y="70" width="117" height="44" fill="var(--sv-b2)"></rect>
<text x="205" y="97" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">有效计算 420 kW</text>
<text x="496" y="97" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-ink)">空闲/碎片 280 kW</text>
<text x="671" y="97" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-ink)">制冷 140 kW</text>
<text x="30" y="142" font-size="12" font-family="inherit" fill="var(--sv-ink)">PUE 1.1</text>
<text x="730" y="142" text-anchor="end" font-size="11" font-family="inherit" fill="var(--sv-muted)">设施总功率 770 kW</text>
<rect x="30" y="150" width="350" height="44" fill="var(--sv-a)"></rect>
<rect x="380" y="150" width="233" height="44" fill="var(--sv-c)"></rect>
<rect x="613" y="150" width="59" height="44" fill="var(--sv-b2)"></rect>
<text x="205" y="177" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">有效计算 420 kW</text>
<text x="496" y="177" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-ink)">空闲/碎片 280 kW</text>
<text x="642" y="177" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--sv-ink)">70 kW</text>
<rect x="30" y="218" width="14" height="14" fill="var(--sv-a)"></rect>
<text x="54" y="230" font-size="11" font-family="inherit" fill="var(--sv-ink)">有效计算</text>
<rect x="230" y="218" width="14" height="14" fill="var(--sv-c)"></rect>
<text x="254" y="230" font-size="11" font-family="inherit" fill="var(--sv-ink)">空闲与碎片</text>
<rect x="430" y="218" width="14" height="14" fill="var(--sv-b2)"></rect>
<text x="454" y="230" font-size="11" font-family="inherit" fill="var(--sv-ink)">制冷与配电损耗</text>
<rect x="30" y="248" width="700" height="110" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="46" y="272" font-size="12" font-family="inherit" fill="var(--sv-ink)">电力成本倍率 = PUE ÷ 利用率（相对 IT 负载）</text>
<text x="46" y="296" font-size="11" font-family="inherit" fill="var(--sv-muted)">PUE 1.2 → 1.1：倍率 2.00 → 1.83，约降 8%</text>
<text x="46" y="320" font-size="11" font-family="inherit" fill="var(--sv-muted)">利用率 60% → 75%：倍率 2.00 → 1.60，约降 20%</text>
</svg><figcaption>图 4 · 同一批 GPU 在 PUE 1.2 与 1.1 下的设施用电构成。降低 PUE 省下的是制冷那一段，提高利用率省下的是空闲那一段。</figcaption></figure>
<p>比 PUE 更值得盯的是利用率。每有效 GPU·h 的电力成本正比于 PUE ÷ 利用率：PUE 从 1.2 降到 1.1 只省约 8%，而利用率从 60% 提到 75% 能省 20%。集群利用率还要区分“分配未跑满”与“跑满但在等通信”。大训练任务需要 gang scheduling（成组调度），一张卡不齐，整批都起不来；拓扑约束、显存碎片与配额碎片会让空闲卡无法拼成可用的大块。</p>
<div class="formula">每有效 GPU·h 成本 ∝ 单价 × PUE ÷ 利用率；利用率 = 有效 GPU·h ÷ 可用 GPU·h</div>
</section>

<section class="sec"><h2>优化杠杆与成本归因</h2>
<p>降本有顺序。先看利用率与批处理，再看量化与缓存，最后才是换硬件与谈电价。利用率和批处理是乘数级杠杆，换硬件与电价是百分比级。表 2 是量级参考，视模型、序列长度与实现而定。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>杠杆</th><th>典型收益</th><th>主要代价</th><th>何时不适用</th></tr></thead><tbody>
<tr><td>连续批处理</td><td>吞吐 2–10×</td><td>TPOT 变长、尾延迟变差</td><td>强交互、单请求延迟极敏感</td></tr>
<tr><td>FP8 / INT8 量化</td><td>吞吐 1.5–2×，权重显存减半</td><td>精度评估与算子适配</td><td>精度敏感且未做回归验证</td></tr>
<tr><td>前缀 / KV 缓存</td><td>命中部分几乎免掉 prefill</td><td>显存占用、依赖命中率</td><td>请求之间没有共享前缀</td></tr>
<tr><td>模型路由 / 级联</td><td>简单请求成本降一个数量级</td><td>路由错误、系统复杂度</td><td>质量要求单一且不可降级</td></tr>
<tr><td>投机解码</td><td>decode 吞吐 1.5–3×</td><td>额外显存与调参</td><td>高并发下算力已经饱和</td></tr>
</tbody></table></div>
<p>成本归因（cost attribution）要让每一美元都有主人。最小做法是给请求打三类标签：租户或团队、模型与版本、路由或功能；离线聚合 token 数、GPU 秒、缓存命中与排队时间，按“直接成本 + 分摊闲置”出账单。只做展示（showback）不做扣费（chargeback）通常够了，但必须把闲置与碎片摊进去，否则大家会以为边际成本为零。</p>
<p>监控面板至少放这几个指标：GPU 分配率与真实利用率、MFU、输出 tok/s、KV Cache 占用、前缀缓存命中率、队列等待时间、每百万 token 成本。注意 <code>nvidia-smi</code> 的 utilization 是“有 kernel 在跑”的比例，decode 这种访存密集阶段可以显示很高但 SM（Streaming Multiprocessor，流式多处理器）大量空转；判断真实效率要看 SM 吞吐、DRAM 吞吐与 MFU，方法在《性能剖析》一篇展开。</p>
<div class="callout callout--tip"><span class="callout__label">技巧</span><div>归因标签从第一天就要打，补历史数据的成本远高于加一个 header。把 model_version 与 tenant_id 放进请求元数据，后面所有账单都能重算。</div></div>
<p>常见误区有四个。其一，只看单价不看利用率，买了最便宜的卡却跑出最贵的 token。其二，用日均值做容量规划，忽略峰值与排队非线性。其三，在利用率只有 30% 的集群里把 PUE 当成首要 KPI。其四，spot 省下的钱没有覆盖检查点与重跑开销。</p>
</section>

<section class="sec"><h2>自测与延伸阅读</h2>
<details class="quiz"><summary>Q1 · 70B 模型、2T token、H100 SXM5、MFU 40%、$2.5/GPU·h，忽略故障与实验，训练一次多少钱？</summary><div class="quiz__a">总算力 6 × 70×10^9 × 2×10^12 = 8.4×10^23 FLOPs。H100 BF16 稠密峰值按 989 TFLOPS 计，40% MFU 得 3.96×10^14 FLOP/s，总卡时约 2.12×10^9 GPU·秒，即约 59 万 GPU·h，成本约 147 万美元。若 MFU 只有 30%，卡时升到约 79 万，成本接近 200 万美元。真实账单还要留失败重跑与实验余量。</div></details>
<details class="quiz"><summary>Q2 · 把推理 batch 从 8 翻到 16，为什么每百万 token 成本不一定减半？</summary><div class="quiz__a">decode 每步都要读一遍权重，小 batch 时是纯访存瓶颈，翻倍 batch 几乎能翻倍吞吐，成本接近减半。但 batch 上去后会出现三个饱和点：KV Cache 的读取开始占用带宽、GEMM 从访存受限转为算力受限、以及 TPOT 拉长后触碰 SLO。超过饱和点再加大 batch，吞吐增长变慢，排队与尾延迟反而变差。</div></details>
<details class="quiz"><summary>Q3 · MTBF 为 6 小时，检查点每 2 小时一次，期望浪费多少？改成每 15 分钟呢？</summary><div class="quiz__a">按“中断均匀落在间隔内、平均损失半个间隔”估算：2 小时间隔的浪费比例约 2 ÷ (2×6) ≈ 16.7%；15 分钟间隔约 0.25 ÷ 12 ≈ 2.1%。但缩短间隔会增加写入开销与存储流量，异步检查点还会带来一致性处理，实际需在两者之间取平衡，常见起点是 10–30 分钟。</div></details>
<details class="quiz"><summary>Q4 · 电费约占总成本 15%，PUE 从 1.6 降到 1.2，总成本降多少？和把利用率从 50% 提到 70% 比呢？</summary><div class="quiz__a">电力部分节省 1 − 1.2/1.6 = 25%，摊到总成本是 15% × 25% ≈ 3.8%。利用率从 50% 到 70%，每有效 GPU·h 的成本变为原来的 50/70 ≈ 71%，即降约 29%；利用率是所有固定成本共同的分母，这一项作用在全额成本上，远大于 3.8%。所以利用率是数量级更大的杠杆。</div></details>
<ul class="refs">
<li><b>AI and Memory Wall</b> — Gholami et al., IEEE Micro, 2024（arXiv:2403.14123）。梳理算力与显存带宽的增长差，解释 decode 的带宽瓶颈及量化、批处理的价值边界。</li>
<li><b>MLPerf Inference Benchmark Results</b> — MLCommons, 持续更新。标准化的推理吞吐与延迟基准，覆盖 Offline、Server 等场景；适合比系统效率，不能当报价。</li>
<li><b>Uptime Institute Global Data Center Survey</b> — Uptime Institute, 年度发布。PUE 分布、容量风险与断电统计的来源，文中 1.5–1.6 的区间即出自该类调查。</li>
<li><b>Efficiently Scaling Transformer Inference</b> — Pope et al., MLSys 2023。分析推理分区、batch 与延迟、成本的权衡，说明为何要按 token 算账。</li>
<li><b>AWS EC2、Azure VM、Google Cloud GPU 实例定价页</b> — 各云厂商官方，价格随地区、合约与时间变动。用于核对当期 on-demand、预留与 spot 的报价口径；文中金额仅为量级示例。</li>
</ul>
</section>`
};
