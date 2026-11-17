window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["ai-infra-future"] = {
  slug: "ai-infra-future",
  title: "趋势：AI Infra 的下一个五年",
  subtitle: "从训练为中心到推理为中心",
  level: 6,
  cluster: "前沿",
  tags: ["趋势", "技术雷达", "推理成本"],
  summary: "训练决定模型能否做出来，推理决定它能否被用得起。拆解推理成本的四个乘数、超节点与光互连、近存计算、编译器收敛与软硬协同，并给出一张可用于决策的技术雷达。",
  keyPoints: [
    "训练以一次性资本支出为主，推理成本随调用量增长、主要体现为运营支出；使用量增长、推理模型与 agent 三者叠加，把优化重心推向单位 token 成本",
    "成本下降是算法、硬件、系统、设施四个乘数相乘的结果；先把 batch 与缓存命中打满，再考虑换芯片",
    "机柜级超节点、CPO 与近存计算都在缩短数据搬运路径；代价分别是功耗与冷却、良率与可维护性、软件栈成熟度",
    "技术雷达按现在可用、三年内、更远分层，只用于决策与接口预留，不作为确定预测"
  ],
  readingMinutes: 14,
  html: String.raw`
<section class="sec">
<h2>先给结论：预算的重心，从训得出来移到了跑得起</h2>
<p>过去十年，AI Infra 的核心命题是"如何把越来越大的模型训练出来"：万卡集群、3D 并行、checkpoint、故障恢复。这套系统昂贵，但它是<mark>一次性资本支出</mark>（CapEx）：训练完成后，同一套权重可以服务无数用户。推理的边际成本结构不同：它随调用量增长，主要体现为<mark>持续性运营支出</mark>（OpEx）——每生成一个 token 都要消耗电力、显存带宽与机时。推理集群本身仍是资本支出，但单位成本被调用量摊薄，优化会直接反映在账单上。当模型能力跨过"够用"的门槛，竞争便从"谁的模型更强"转向"谁能把每次调用的成本压得更低"。</p>
<p>这个转移有三个驱动。第一，使用量增长快于训练量：训练一个模型可能只要几周，服务它却要按年计。第二，推理模型（reasoning model）与思维链把一次回答变成一段内部推理，单请求 token 数可上升一个数量级。第三，agent 把一次用户操作放大成几十次模型调用，上下文长度同时膨胀。三者叠加，推理侧算力在成熟产品中可能比训练侧高一个数量级以上，倍数视产品而定。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="AI Infra 技术演进时间线：模型与算法、系统与硬件两条线，从 2018 年前后延伸到更远的未来">
<defs>
<marker id="ai-infra-future-tl-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-line)"/></marker>
</defs>
<text x="380" y="24" text-anchor="middle" font-size="15" font-family="inherit" fill="var(--sv-ink)">两条演进线：模型结构在变，系统瓶颈随之搬家</text>
<text x="16" y="132" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)" transform="rotate(-90 16 132)">模型 / 算法</text>
<text x="16" y="234" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)" transform="rotate(-90 16 234)">系统 / 硬件</text>
<text x="104" y="58" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">2018–2020</text>
<text x="240" y="58" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">2021–2022</text>
<text x="376" y="58" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">2023–2025</text>
<text x="512" y="58" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">未来 1–3 年</text>
<text x="648" y="58" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">更远</text>
<rect x="40" y="78" width="128" height="86" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="104" y="104" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">Dense scaling</text>
<text x="104" y="126" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">参数量换能力</text>
<text x="104" y="148" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">GPT-3 175B</text>
<rect x="176" y="78" width="128" height="86" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="240" y="104" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">MoE 稀疏激活</text>
<text x="240" y="126" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">总参数远大于激活</text>
<text x="240" y="148" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">通信成为瓶颈</text>
<rect x="312" y="78" width="128" height="86" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="376" y="104" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">推理模型 + 长上下文</text>
<text x="376" y="126" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">单请求 token 变多</text>
<text x="376" y="148" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">KV 显存吃紧</text>
<rect x="448" y="78" width="128" height="86" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="6 5"/>
<text x="512" y="104" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">线性注意力 / SSM</text>
<text x="512" y="126" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">混合结构探索</text>
<text x="512" y="148" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">质量仍需验证</text>
<rect x="584" y="78" width="128" height="86" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="6 5"/>
<text x="648" y="104" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">结构–硬件协同</text>
<text x="648" y="126" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">稀疏与低精度原生</text>
<text x="648" y="148" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">按场景定制</text>
<rect x="40" y="180" width="128" height="86" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="104" y="206" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">单卡 kernel 调优</text>
<text x="104" y="228" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">CUDA + cuBLAS</text>
<text x="104" y="250" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">算力受限</text>
<rect x="176" y="180" width="128" height="86" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="240" y="206" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">3D 并行 + 集合通信</text>
<text x="240" y="228" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">NVLink / IB</text>
<text x="240" y="250" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">通信受限</text>
<rect x="312" y="180" width="128" height="86" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="376" y="206" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">连续批处理 + 分页 KV</text>
<text x="376" y="228" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">PD 解耦与缓存</text>
<text x="376" y="250" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">带宽与调度受限</text>
<rect x="448" y="180" width="128" height="86" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="6 5"/>
<text x="512" y="206" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">超节点 + CPO</text>
<text x="512" y="228" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">机柜级 scale-up</text>
<text x="512" y="250" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">互连与功耗受限</text>
<rect x="584" y="180" width="128" height="86" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)" stroke-dasharray="6 5"/>
<text x="648" y="206" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">近存 / 端侧异构</text>
<text x="648" y="228" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">把数据搬得更近</text>
<text x="648" y="250" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">软件栈待成熟</text>
<line x1="40" y1="172" x2="712" y2="172" stroke="var(--sv-line)" stroke-dasharray="4 4"/>
<line x1="168" y1="70" x2="168" y2="280" stroke="var(--sv-line)" stroke-dasharray="3 6"/>
<line x1="304" y1="70" x2="304" y2="280" stroke="var(--sv-line)" stroke-dasharray="3 6"/>
<line x1="440" y1="70" x2="440" y2="280" stroke="var(--sv-line)" stroke-dasharray="3 6"/>
<line x1="576" y1="70" x2="576" y2="280" stroke="var(--sv-line)" stroke-dasharray="3 6"/>
<line x1="60" y1="300" x2="700" y2="300" stroke="var(--sv-line)" marker-end="url(#ai-infra-future-tl-arrow)"/>
<text x="620" y="292" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">时间</text>
<text x="60" y="330" font-size="11" font-family="inherit" fill="var(--sv-muted)">实线：已发生；虚线：尚未成为主流。</text>
</svg>
<figcaption>图 1 · 技术演进时间线：模型与系统交替推动，越靠右确定性越低</figcaption>
</figure>
<p>图 1 把两条线并排：上面是模型与算法，下面是系统与硬件。它们不是独立演进的：MoE 的流行让专家并行变成通信问题，推理模型的流行让 KV Cache 与长上下文变成显存问题。每一次模型结构的转身，都会在系统层留下一个新瓶颈。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>训练像买房，推理像交电费。买房比单价、地段、贷款；交电费只关心每度电多少钱、有没有人忘了关灯。优化藏在日常细节里，也更考验工程能力。</div></div>
</section>

<section class="sec">
<h2>推理成本曲线：四个乘数，而不是一条直线</h2>
<p>拆开单位成本，比记住"每年降几倍"有用。服务一个模型的成本等于总拥有成本除以有效吞吐：机器、电力、折旧是分子，有效 token 吞吐是分母。于是成本下降来自四个乘数：算法效率（每 token 的浮点运算量）、硬件效率（每美元买到的算力与带宽）、系统效率（实际利用率）、设施效率（PUE 与电价；PUE 越低、电价越便宜，成本越低）。四个乘数相乘，才解释那条陡峭的曲线。</p>
<p>Stanford AI Index Report 2025 给出了一个常被引用的口径：达到 GPT-3.5 水平的模型，推理成本在 2022 年 11 月到 2024 年 10 月之间下降超过 280 倍；同一报告还给出硬件成本每年约下降 30%、能效每年约提升 40% 的统计。这些数字的口径是特定能力、任务与计价方式，不能直接外推；但它们说明，成本下降不是单一芯片的功劳，而是算法、系统、硬件叠加。</p>
<div class="formula">TPOT（每输出 token 耗时）≈ (N_param × b_weight + KV_per_token × L_ctx) ÷ BW_eff　（单序列、batch=1，忽略调度开销）

成本 / 百万 token ≈ (N_GPU × C_GPU_hour × 10⁶) ÷ (3600 × 吞吐_token_per_s)　（按计费 token 口径）

b_weight：FP16 = 2 B，FP8 = 1 B，INT4 ≈ 0.5 B；N_param 为参与计算的参数数（MoE 取激活参数）</div>
<p>N_param × b_weight 是单序列每步要读的权重字节数；若算力受限，还要计 2 × N_param 次浮点运算，decode 通常由带宽决定。b_weight 是每个参数的字节数。在带宽受限的 decode 里，量化的直接收益主要不是让计算更快，而是把字节数变小，在同样带宽下每秒多读几个 token；在算力受限的 prefill 里，低精度张量核还能带来额外的吞吐收益。batch 放大后，每步要读的 KV 按 batch 线性增长，KV 项开始主导，成本明显上翘，这也是要靠 GQA、KV 量化与前缀缓存（prefix caching）压成本的原因。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="相对单位推理价格的下降曲线，对数纵轴，标注算法、系统、硬件三类驱动因素">
<defs>
<marker id="ai-infra-future-cost-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-line)"/></marker>
</defs>
<text x="380" y="22" text-anchor="middle" font-size="15" font-family="inherit" fill="var(--sv-ink)">单位推理价格：四个乘数叠加出的下降曲线（示意）</text>
<line x1="80" y1="70" x2="80" y2="335" stroke="var(--sv-line)" marker-end="url(#ai-infra-future-cost-arrow)"/>
<line x1="80" y1="335" x2="712" y2="335" stroke="var(--sv-line)" marker-end="url(#ai-infra-future-cost-arrow)"/>
<text x="30" y="200" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)" transform="rotate(-90 30 200)">相对价格（对数轴）</text>
<text x="396" y="368" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">时间（示意）</text>
<text x="74" y="124" text-anchor="end" font-size="11" font-family="inherit" fill="var(--sv-muted)">100</text>
<text x="74" y="166" text-anchor="end" font-size="11" font-family="inherit" fill="var(--sv-muted)">30</text>
<text x="74" y="204" text-anchor="end" font-size="11" font-family="inherit" fill="var(--sv-muted)">10</text>
<text x="74" y="246" text-anchor="end" font-size="11" font-family="inherit" fill="var(--sv-muted)">3</text>
<text x="74" y="284" text-anchor="end" font-size="11" font-family="inherit" fill="var(--sv-muted)">1</text>
<text x="74" y="326" text-anchor="end" font-size="11" font-family="inherit" fill="var(--sv-muted)">0.3</text>
<line x1="80" y1="120" x2="700" y2="120" stroke="var(--sv-line)" stroke-dasharray="2 6" opacity="0.6"/>
<line x1="80" y1="162" x2="700" y2="162" stroke="var(--sv-line)" stroke-dasharray="2 6" opacity="0.6"/>
<line x1="80" y1="200" x2="700" y2="200" stroke="var(--sv-line)" stroke-dasharray="2 6" opacity="0.6"/>
<line x1="80" y1="242" x2="700" y2="242" stroke="var(--sv-line)" stroke-dasharray="2 6" opacity="0.6"/>
<line x1="80" y1="280" x2="700" y2="280" stroke="var(--sv-line)" stroke-dasharray="2 6" opacity="0.6"/>
<line x1="80" y1="322" x2="700" y2="322" stroke="var(--sv-line)" stroke-dasharray="2 6" opacity="0.6"/>
<path d="M110,120 C190,145 250,190 330,235 C410,280 470,305 520,316" fill="none" stroke="var(--sv-a)" stroke-width="3"/>
<path d="M520,316 C580,324 630,328 690,330" fill="none" stroke="var(--sv-a)" stroke-width="3" stroke-dasharray="7 6"/>
<line x1="520" y1="70" x2="520" y2="335" stroke="var(--sv-muted)" stroke-dasharray="5 5"/>
<text x="520" y="64" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">现在</text>
<rect x="92" y="78" width="180" height="38" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="182" y="94" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">算法效率</text>
<text x="182" y="110" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">量化 · 投机 · 稀疏</text>
<rect x="290" y="78" width="180" height="38" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="380" y="94" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">系统效率</text>
<text x="380" y="110" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">批处理 · 缓存 · 解耦</text>
<rect x="488" y="78" width="180" height="38" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="578" y="94" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">硬件效率</text>
<text x="578" y="110" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">FP4 · HBM · 超节点</text>
<line x1="150" y1="116" x2="150" y2="132" stroke="var(--sv-line)" stroke-dasharray="3 4"/>
<line x1="380" y1="116" x2="380" y2="258" stroke="var(--sv-line)" stroke-dasharray="3 4"/>
<line x1="600" y1="116" x2="600" y2="326" stroke="var(--sv-line)" stroke-dasharray="3 4"/>
<text x="96" y="352" font-size="11" font-family="inherit" fill="var(--sv-muted)">曲线为量级示意，非预测；纵轴以 2022 年末为 100；设施效率（PUE 与电价）未单独标注。</text>
</svg>
<figcaption>图 2 · 推理价格趋势：早期靠硬件与低精度，中期靠批处理与缓存，收益递减</figcaption>
</figure>
<p>图 2 是示意曲线，不是预测。它想表达的是优化顺序：在 batch 还没打满、缓存命中率还很低的时候去换一代芯片，收益远不如先把调度做好。把顺序排错，是团队最常见的浪费。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>公开 API 价格不是成本：输入输出定价不同、缓存命中打折、批处理有折扣，厂商还有毛利与获客策略。做决策时用自己的吞吐、SLO 与电价重算。</div></div>
</section>

<section class="sec">
<h2>超节点与光互连：互连从配角变成主角</h2>
<p>decode 每生成一个 token，都要把权重和 KV Cache 从显存读一遍。单卡放不下大模型时只能切开，代价是每一步都要通信。于是 scale-up 域（同一组可高带宽互访的加速器）的大小，直接决定张量并行与专家并行的效率。过去常见的是 4 卡或 8 卡域，机柜级超节点把它扩大到数十卡。以 NVIDIA GB200 NVL72 为例：72 张 GPU、13.5 TB HBM3e、每 GPU 的 NVLink 5 双向带宽 1.8 TB/s，聚合约 130 TB/s，整柜功率约 120 kW。这些是厂商口径，配置不同有差异，但量级说明互连带宽与单卡显存带宽处在同一数量级，远高于跨机柜网络。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="机柜级超节点拓扑示意：72 个 GPU 通过铜背板 scale-up 互连，再通过光互连或 CPO 连接到另一个超节点">
<defs>
<marker id="ai-infra-future-topo-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 Z" fill="var(--sv-c)"/></marker>
<pattern id="ai-infra-future-gpu" width="40" height="10" patternUnits="userSpaceOnUse"><rect x="0" y="0" width="30" height="7" rx="1.5" fill="var(--sv-a)" stroke="var(--sv-line)"/></pattern>
</defs>
<text x="380" y="24" text-anchor="middle" font-size="15" font-family="inherit" fill="var(--sv-ink)">机柜级超节点：柜内铜互连，柜间光互连</text>
<rect x="48" y="58" width="368" height="238" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="232" y="80" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">超节点 A（72 GPU，18 个计算托盘）</text>
<rect x="66" y="90" width="332" height="192" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)" stroke-dasharray="4 4"/>
<rect x="74" y="98" width="160" height="180" fill="url(#ai-infra-future-gpu)" stroke="none"/>
<text x="250" y="140" font-size="11" font-family="inherit" fill="var(--sv-muted)">18 个</text>
<text x="250" y="156" font-size="11" font-family="inherit" fill="var(--sv-muted)">计算托盘</text>
<text x="250" y="180" font-size="11" font-family="inherit" fill="var(--sv-muted)">每托 4 卡</text>
<text x="250" y="215" font-size="11" font-family="inherit" fill="var(--sv-muted)">铜背板</text>
<text x="250" y="231" font-size="11" font-family="inherit" fill="var(--sv-muted)">全互联</text>
<rect x="566" y="104" width="150" height="130" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="641" y="128" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">超节点 B</text>
<text x="641" y="150" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">同样的 scale-up 域</text>
<text x="641" y="170" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">用于 PD 解耦或</text>
<text x="641" y="188" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">跨柜专家并行</text>
<line x1="420" y1="150" x2="562" y2="150" stroke="var(--sv-c)" stroke-width="3" marker-end="url(#ai-infra-future-topo-arrow)"/>
<line x1="562" y1="190" x2="420" y2="190" stroke="var(--sv-c)" stroke-width="3" marker-end="url(#ai-infra-future-topo-arrow)"/>
<text x="491" y="86" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">scale-out 光互连</text>
<text x="491" y="102" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">400–800 Gb/s 每端口</text>
<rect x="450" y="252" width="266" height="52" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="583" y="272" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">CPO：光引擎与交换 ASIC 共封装</text>
<text x="583" y="291" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">缩短电链路，降低每 bit 功耗</text>
<text x="48" y="322" font-size="11" font-family="inherit" fill="var(--sv-ink)">scale-up：NVLink 5，每 GPU 1.8 TB/s 双向，聚合约 130 TB/s</text>
<text x="48" y="342" font-size="11" font-family="inherit" fill="var(--sv-muted)">整柜约 120 kW，需要液冷；图为拓扑示意，不按真实比例</text>
</svg>
<figcaption>图 3 · 超节点拓扑：柜内铜互连承载并行，柜间光互连承载 PD 解耦</figcaption>
</figure>
<p>铜的距离墙是物理原因。高速 SerDes 下，无源铜缆的有效距离只有 1 至 2 米量级，有源电缆稍远，但功耗与成本上升。机柜内可以靠背板铜互连，跨机柜通常要转光。CPO（co-packaged optics，共封装光学）把光引擎从可插拔模块搬到交换 ASIC 旁，缩短电信号路径，降低每 bit 功耗与损耗，代价是可维护性与良率。它不是更快的光模块，而是把光电转换的边界往芯片里推了一步。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>层级</th><th>介质与协议</th><th>单链路带宽量级</th><th>有效距离</th><th>推理中的典型用途</th></tr></thead><tbody>
<tr><td>scale-up（柜内）</td><td>铜背板、高速铜缆；NVLink、UALink</td><td>每 GPU 约 1.8 TB/s 双向（NVLink 5，厂商口径）</td><td>1–2 m 量级</td><td>张量并行、专家并行的 All-to-All</td></tr>
<tr><td>scale-out（柜间）</td><td>光模块 + 以太网或 InfiniBand</td><td>每端口 400–800 Gb/s 为主流</td><td>数十米至数公里</td><td>PD（prefill/decode）解耦、KV 传输、参数同步</td></tr>
<tr><td>共封装光学 CPO</td><td>硅光引擎与交换 ASIC 共封装</td><td>每端口 800 Gb/s–1.6 Tb/s（视产品）</td><td>数百米至 2 km 量级</td><td>降低每 bit 功耗，缓解前面板密度</td></tr>
</tbody></table></div>
<p>对上层软件的影响很具体：拓扑感知的并行切分、集合通信的拥塞控制、KV Cache 的跨节点迁移，这些原本主要出现在训练里的问题，正在成为推理服务的日常。NCCL/RCCL 调优、RDMA 的 PFC 与 ECN 配置，都会进入推理服务的排障清单。协议上，NVLink 仍是私有生态；UALink 与 Ultra Ethernet 试图开放替代，成熟度仍需观察。互连细节在 interconnect 与 collective-comm 展开，集群级拓扑与故障域见 ultra-scale。</p>
</section>
<section class="sec">
<h2>走近数据：存算一体与近存计算</h2>
<p>Gholami 等人在 "AI and Memory Wall"（2024）里给出常被引用的观察：过去二十年，硬件算力约每两年增长 3 倍，内存带宽每两年只增长约 1.6 倍。两条曲线越拉越开，形成<mark>内存墙</mark>（memory wall）。decode 恰好是算术强度最低的负载：单请求、batch 为 1 时，每个权重每步只参与一次乘加就被丢弃，时间全花在搬运上。这就是"把计算搬到数据旁边"重新有吸引力的原因。</p>
<p>三条路径成熟度差别很大。<b>近存计算</b>（near-memory computing）在 HBM 或 DRAM 旁加一层计算单元，例如 SK 海力士 AiMX；三星 HBM-PIM 则把计算单元放进 HBM 堆栈，集成度更高。这类方案适合小 batch、权重驻留的 decode。<b>片上 SRAM 驻留</b>把模型放进片上存储，Groq 单芯片约 230 MB、Cerebras WSE-3 约 44 GB，用极高带宽换极低延迟，代价是容量与成本。更激进的<b>存内计算</b>（compute-in-memory）尝试直接在存储阵列里做乘加，能效潜力最大，但精度、良率与编程模型仍在研究阶段。</p>
<p>评估这类方案，先问三个问题：权重放得下吗？需要频繁换模型吗？编译器接得住吗？有一个答案是否，它大概率只能做特定场景的加速器。HBM 结构与近存细节在 memory-hierarchy 展开。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>判断一项近数据技术是否值得进入架构：看它缩短了哪段数据流，这段数据流在你的负载里占多少时间。占比不到 20%，换硬件的收益会被阿姆达尔定律吃掉。</div></div>
</section>

<section class="sec">
<h2>端侧与异构：另一个被低估的推理战场</h2>
<p>端侧推理的约束和云端完全不同。手机内存带宽在几十 GB/s 量级，整机功耗在数瓦量级，没有主动散热；而 H100 SXM 的 HBM3 带宽是 3.35 TB/s，整卡功耗 700 W。带宽差数十倍、功耗差数十至上百倍，端侧跑不了云端同款模型。可行组合是 1B 至 10B 参数、4-bit 量化、权重常驻内存、KV 用滑动窗口或 GQA 压缩，这些选择又反过来影响模型结构。</p>
<p>异构指 CPU、GPU、NPU、DSP 在同一设备上分工：NPU 跑矩阵乘，CPU 处理控制流与工具调用。端云协同把请求分级：高频、简单、隐私敏感的留在端侧，复杂推理上云，好处不只是成本，还有延迟与合规。对 Infra 工程师的要求是"一次编译、多端部署"：同一份模型要落到不同后端，量化感知训练与算子融合成为核心技能。</p>
<p>这一块碎片化高于数据中心，短期不会收敛成单一栈。务实的态度是：把端侧当成独立部署目标，用统一的中间表示（IR）管理模型，用后端插件适配芯片，而不是为每颗芯片维护一套 kernel。编译器如何承担这件事，在 compilers 展开。</p>
</section>

<section class="sec">
<h2>软件栈收敛：Triton、MLIR 与写 tile 而不是写指令</h2>
<p>过去的 GPU 编程是 CUDA C 的单极世界：厂商提供库，工程师手写 kernel，性能取决于对指令与寄存器的理解。问题是算子组合爆炸：attention 有几十种变体，MoE 有不同路由与容量因子，量化有不同粒度，手工为每种组合调优不可持续。于是软件栈开始分层：前端负责图与自动微分，中间表示负责优化，kernel DSL 表达并行块，后端落到具体硬件。</p>
<p>Triton 是这条路径上最有代表性的产物：你用块（tile）和程序 ID 描述并行，编译器负责线程映射、共享内存与流水线。MLIR 提供多级方言（dialect），让 JAX（经 StableHLO）与 PyTorch（经 Torch-MLIR 等路径）的图逐级下降，厂商实现自己的后端，而不要求用户重写模型。StableHLO、IREE 是 MLIR 路线上的工程化；TorchInductor 则把图编译成 Triton 内核，是另一条相邻路径。收敛不等于统一：cuBLAS、CUTLASS 仍守着性能上限；但与只会调 API 相比，能写 tile 程序、会做 roofline 分析的人迁移成本低得多。</p>
<pre class="code" data-lang="python"><code>import triton
import triton.language as tl

@triton.jit
def matmul_kernel(a_ptr, b_ptr, c_ptr, M, N, K,
                  BLOCK_M: tl.constexpr, BLOCK_N: tl.constexpr, BLOCK_K: tl.constexpr):
    pid_m = tl.program_id(0)
    pid_n = tl.program_id(1)
    offs_m = pid_m * BLOCK_M + tl.arange(0, BLOCK_M)
    offs_n = pid_n * BLOCK_N + tl.arange(0, BLOCK_N)
    acc = tl.zeros((BLOCK_M, BLOCK_N), dtype=tl.float32)
    for k in range(0, tl.cdiv(K, BLOCK_K)):
        offs_k = k * BLOCK_K + tl.arange(0, BLOCK_K)
        a = tl.load(a_ptr + offs_m[:, None] * K + offs_k[None, :],
                    mask=(offs_m[:, None] &lt; M) &amp; (offs_k[None, :] &lt; K), other=0.0)
        b = tl.load(b_ptr + offs_k[:, None] * N + offs_n[None, :],
                    mask=(offs_k[:, None] &lt; K) &amp; (offs_n[None, :] &lt; N), other=0.0)
        acc += tl.dot(a, b)
    tl.store(c_ptr + offs_m[:, None] * N + offs_n[None, :], acc,
             mask=(offs_m[:, None] &lt; M) &amp; (offs_n[None, :] &lt; N))</code></pre>
<p>实用建议：先用 profiler 确认瓶颈是算力、带宽还是通信，再决定要不要写 kernel；写 kernel 时先保证 tile 大小与合并访问，再谈流水线与 Warp 特化。编译器能自动做的优化越来越多，但它不会替你判断一个算子值不值得融合。</p>
</section>
<section class="sec">
<h2>协同设计：模型结构在迁就硬件，也在重塑硬件</h2>
<p>MoE（mixture of experts）是最典型的例子。它用稀疏激活换容量：总参数可到数千亿，但每个 token 只经过少数专家。DeepSeek-V3 的公开配置是 671B 总参数、37B 激活，这个比例就是设计目标：让大部分参数不在计算路径上。代价是瓶颈转移：专家并行的 All-to-All 随 batch 与专家数上升，整个专家并行组要放得下全部专家，负载不均会让部分卡空转。</p>
<p>线性注意力与状态空间模型（SSM）走另一条路：把随上下文增长的 KV 缓存换成固定大小的状态，长上下文不再让显存线性爆炸。纯 SSM 在精确检索与复制类任务上仍是短板；当前更常见的折中是混合结构——多数层用 SSM 或滑动窗口注意力，少量层保留全局 softmax attention。稀疏化（2:4 结构化稀疏、块稀疏）试图让硬件跳过零，收益取决于编译器与 kernel 能否利用稀疏模式。</p>
<p>硬件也在反向塑造模型：更大的 scale-up 域让专家并行更便宜，更高的 HBM 容量让 MoE 能放更多专家，FP8/FP4 让权重与激活同时变窄。协同设计的方法论很朴素：先画 roofline，判断负载落在算力区还是带宽区；再选模型结构；最后选芯片与互连。顺序反过来，常会被某个硬约束卡死。</p>
</section>

<section class="sec">
<h2>绿色算力、能力要求与一张可执行的技术雷达</h2>
<p>机柜功率从十几 kW 走到 100 kW 量级，风冷已经不够。GB200 NVL72 整柜约 120 kW，必须上液冷，带来漏液检测、冷却液兼容与机柜承重等新问题。先进数据中心的 PUE 从 1.4–1.5 压到 1.1–1.2，WUE（水利用效率）进入选址决策；电力容量与并网时间常比芯片交付更早成为瓶颈。碳排核算还要区分范围一、二、三。</p>
<p>能力要求随之变化。过去的核心是"会写 CUDA、会调 NCCL"；现在更值钱的是三种能力：<b>性能建模</b>（用 roofline 与排队论在动手前判断瓶颈）、<b>系统排障</b>（profiler、集合通信、网络与存储的联合定位）、<b>成本与 SLO 决策</b>（在延迟、吞吐、成本三角里找拐点）。工具会换，这三种能力不会。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="技术雷达图：按现在可用、三年内、更远三层，放置推理相关技术的采纳时间">
<text x="380" y="20" text-anchor="middle" font-size="15" font-family="inherit" fill="var(--sv-ink)">技术雷达：按采纳时间分层，而非按热度排序</text>
<circle cx="380" cy="195" r="55" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<circle cx="380" cy="195" r="105" fill="none" stroke="var(--sv-line)"/>
<circle cx="380" cy="195" r="145" fill="none" stroke="var(--sv-line)"/>
<line x1="380" y1="50" x2="380" y2="340" stroke="var(--sv-line)" stroke-dasharray="3 5" opacity="0.6"/>
<line x1="235" y1="195" x2="525" y2="195" stroke="var(--sv-line)" stroke-dasharray="3 5" opacity="0.6"/>
<line x1="277" y1="92" x2="483" y2="298" stroke="var(--sv-line)" stroke-dasharray="3 5" opacity="0.6"/>
<line x1="483" y1="92" x2="277" y2="298" stroke="var(--sv-line)" stroke-dasharray="3 5" opacity="0.6"/>
<circle cx="380" cy="140" r="5" fill="var(--sv-a)" stroke="var(--sv-ink)"/>
<text x="380" y="126" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">FP8/FP4 推理</text>
<circle cx="432" cy="178" r="5" fill="var(--sv-a)" stroke="var(--sv-ink)"/>
<text x="442" y="174" font-size="12" font-family="inherit" fill="var(--sv-ink)">连续批处理</text>
<circle cx="328" cy="178" r="5" fill="var(--sv-a)" stroke="var(--sv-ink)"/>
<text x="318" y="174" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-ink)">前缀缓存</text>
<circle cx="348" cy="239" r="5" fill="var(--sv-a)" stroke="var(--sv-ink)"/>
<text x="338" y="253" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-ink)">投机解码</text>
<circle cx="412" cy="239" r="5" fill="var(--sv-a)" stroke="var(--sv-ink)"/>
<text x="422" y="253" font-size="12" font-family="inherit" fill="var(--sv-ink)">Triton 内核</text>
<circle cx="318" cy="110" r="5" fill="var(--sv-b)" stroke="var(--sv-ink)"/>
<text x="308" y="106" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-ink)">CPO 规模部署</text>
<circle cx="280" cy="227" r="5" fill="var(--sv-b)" stroke="var(--sv-ink)"/>
<text x="270" y="231" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-ink)">UALink 生态</text>
<circle cx="380" cy="300" r="5" fill="var(--sv-b)" stroke="var(--sv-ink)"/>
<text x="380" y="317" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">推理专用 ASIC</text>
<circle cx="480" cy="227" r="5" fill="var(--sv-b)" stroke="var(--sv-ink)"/>
<text x="490" y="231" font-size="12" font-family="inherit" fill="var(--sv-ink)">PD 解耦</text>
<circle cx="430" cy="59" r="5" fill="var(--sv-c)" stroke="var(--sv-ink)"/>
<text x="438" y="63" font-size="12" font-family="inherit" fill="var(--sv-ink)">存算一体量产</text>
<circle cx="244" cy="245" r="5" fill="var(--sv-c)" stroke="var(--sv-ink)"/>
<text x="234" y="249" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-ink)">计算芯片光 I/O</text>
<circle cx="491" cy="288" r="5" fill="var(--sv-c)" stroke="var(--sv-ink)"/>
<text x="501" y="292" font-size="12" font-family="inherit" fill="var(--sv-ink)">线性注意力主流</text>
<circle cx="48" cy="330" r="5" fill="var(--sv-a)" stroke="var(--sv-ink)"/>
<text x="60" y="334" font-size="11" font-family="inherit" fill="var(--sv-muted)">现在可用：已有生产案例</text>
<circle cx="48" cy="350" r="5" fill="var(--sv-b)" stroke="var(--sv-ink)"/>
<text x="60" y="354" font-size="11" font-family="inherit" fill="var(--sv-muted)">三年内：试点与规范形成</text>
<circle cx="48" cy="370" r="5" fill="var(--sv-c)" stroke="var(--sv-ink)"/>
<text x="60" y="374" font-size="11" font-family="inherit" fill="var(--sv-muted)">更远：研究阶段，不作假设</text>
</svg>
<figcaption>图 4 · 技术雷达：内环到外环是采纳时间，不是优劣；位置随生态变</figcaption>
</figure>
<p>图 4 是按采纳时间分层的雷达，不是预言。内环是今天就能在生产用、有公开文档与社区支持的技术；中环是有试点、有规范草案、生态仍在形成中的技术；外环是研究阶段、不应进入当前架构假设的技术。规则只有一条：<mark>雷达用于决策，不用于预测</mark>。每项进入内环前，都要在你的负载上跑基准，而不是看发布会数字。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>不要把三年内当成三年后一定发生。技术采纳是非线性的：标准可能难产，供应链可能卡住，软件生态可能比硬件晚两年。架构上留接口与回退路径，比押注单一路线更稳。</div></div>
<details class="quiz"><summary>Q1 · 为什么 decode 阶段"堆算力"通常没有用？</summary><div class="quiz__a">decode 每步每个序列只生成一个 token，单请求时矩阵乘退化为矩阵-向量乘；算术强度约等于 batch size（FP16 下 batch=1 时约每字节 1 FLOP），远低于硬件的算力/带宽比。以 H100 SXM 为例，FP16 稠密算力约 990 TFLOPS、HBM3 带宽 3.35 TB/s，比值约 300 FLOP/字节，batch 要到数百才可能转为算力受限。每生成一个 token 都要把权重与 KV Cache 从 HBM 读一遍，瓶颈在带宽而非算力。提高算力只在 batch 足够大时才有意义，否则只是让 SM 空转。要提升吞吐，优先做量化、增大 batch、提高缓存命中、减少跨卡通信。</div></details>
<details class="quiz"><summary>Q2 · 团队要把单位 token 成本降一半，最先该做什么？</summary><div class="quiz__a">先测，再改。用 profiler 与线上指标拆四块：batch 是否打满、前缀缓存命中率、KV 是否溢出、通信占比。若 batch 小、命中低，优先做连续批处理与缓存复用，收益大且不改模型；若已打满，再考虑 FP8/INT4 量化与投机解码，但要评估质量与尾部延迟；换 GPU 成本最高，放在最后。重写 kernel 通常不是第一优先级，除非 profiler 指向某个算子。</div></details>
<details class="quiz"><summary>Q3 · 超节点把 scale-up 域从 8 卡扩到 72 卡，最直接改善的是什么？</summary><div class="quiz__a">改善的是张量并行与专家并行的通信效率：同样规模的模型可以少跨机柜、少走光互连，集合通信的跳数与延迟下降，All-to-All 的有效带宽上升。它不会自动提升单卡算力，显存总量变大但单卡不变。新的约束转移到功耗与冷却：整柜功率到 100 kW 量级后，液冷、供电与机柜承重成为部署前提。</div></details>
<h3>延伸阅读</h3>
<ul class="refs">
<li><b>Stanford AI Index Report 2025</b> — Stanford HAI, 2025。推理成本与硬件成本的公开统计口径，适合做量级参考，不宜直接外推。</li>
<li><b>MLPerf Inference Benchmark</b> — MLCommons, 持续更新。推理系统的标准基准，含 Offline、Server 等场景；比较吞吐与延迟时应看它，而非发布会。</li>
<li><b>NVIDIA Blackwell Architecture Technical Brief</b> — NVIDIA, 2024。Blackwell 的封装、NVLink 5 与 HBM3e 官方口径，引用 GB200 NVL72 数字时以此为准。</li>
<li><b>AMD Instinct MI300X 数据表与 ROCm 文档</b> — AMD, 持续更新。MI300X 的规格与 ROCm 软件栈进展，是评估第二供应商的材料。</li>
<li><b>AI and Memory Wall</b> — Amir Gholami 等, 2024（IEEE Micro；arXiv:2403.14123）。用二十年数据说明算力与带宽的剪刀差，理解 decode 带宽瓶颈的必读。</li>
</ul>
</section>
`
};
