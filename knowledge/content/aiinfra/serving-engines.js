window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["serving-engines"] = {
  slug: "serving-engines",
  title: "推理引擎与服务化",
  subtitle: "vLLM、SGLang、TensorRT-LLM 的选型与部署",
  level: 4,
  cluster: "推理",
  tags: ["vLLM", "SGLang", "SLA"],
  summary: "从五段流水线拆解引擎，对比 vLLM、SGLang、TensorRT-LLM 与 TGI 的取舍，并讲清 TP/EP 部署、KV-aware 路由、SLO 压测与灰度上线。",
  keyPoints: [
    "引擎把请求拆成 API、tokenizer、scheduler、model runner、detokenizer 五段，延迟大头通常在排队与 prefill",
    "选型先看约束：通用与迭代速度选 vLLM/SGLang，模型固定且追极限选 TensorRT-LLM，HF 生态集成选 TGI",
    "张量并行（TP）应留在单机 NVLink 域内，跨机优先加副本；MoE 用专家并行（EP），代价是 all-to-all 通信",
    "KV-aware 路由把相同前缀钉在同一副本，prefix cache 命中率决定真实 prefill 成本",
    "SLO 用 TTFT/TPOT 的分位数定义，压测用开环到达，弹性指标看队列与 KV 占用而不是 GPU 利用率"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>把模型文件变成一项服务，中间隔着什么</h2>
<p>你下载了一个 16 GB 的权重文件，在一张卡上跑通了 <code>model.generate()</code>，这离“服务”还很远。线上要同时接几百个用户，处理超时与重试，在流量上涨时扩容，在发版出错时十分钟内回滚，还要能回答“今天下午三点的 p95 首字延迟是多少”。这些没有一件是模型本身提供的。</p>
<p>推理引擎（serving engine）补上的正是这一层：它加载并切分权重，把并发请求组织成连续批处理，用分页 KV Cache 管理显存，暴露 OpenAI 兼容接口，吐出监控指标。<mark>模型决定能力上限，引擎决定这份能力能以什么成本、什么延迟卖出去</mark>。同一个 Llama-3-8B，裸 PyTorch 循环和成熟引擎的吞吐可以差一个数量级。</p>
<p>本篇先拆开引擎看请求怎么走，再对比四个引擎的定位，然后讲多卡部署、请求路由、SLO 与灰度。连续批处理与 PagedAttention 的细节见 batching-scheduling 一篇，这里只讲它们对服务指标的影响。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>把引擎想成一家餐厅：API 层是前台接待，tokenizer 是核对菜单，scheduler 是领班决定这一轮先给哪几桌下单，model runner 是厨房，KV Cache 是备菜台。翻台率不只取决于厨师多快，还取决于领班怎么拼桌、备菜台够不够大。</div></div>
</section>

<section class="sec">
<h2>引擎内部：一条请求要穿过五段流水线</h2>
<p>不管哪家引擎，在线请求路径基本都能切成五段：API、tokenizer、scheduler、model runner、detokenizer。延迟出问题时，你能定位到哪一段变慢，而不是笼统归咎于“模型慢”。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="推理引擎五段流水线架构图，从 API 到模型执行再到流式返回">
<defs>
<marker id="serving-engines-arrow-1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
<path d="M 0 0 L 10 5 L 0 10 Z" fill="var(--sv-muted)"></path>
</marker>
</defs>
<text x="20" y="28" font-size="15" fill="var(--sv-ink)" font-family="inherit">在线推理的五段流水线：一次请求的完整生命周期</text>
<text x="20" y="50" font-size="12" fill="var(--sv-muted)" font-family="inherit">实线为请求方向，虚线为 token 流式返回</text>

<rect x="20" y="95" width="80" height="62" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="60" y="122" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">客户端</text>
<text x="60" y="142" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">HTTP / SSE</text>

<rect x="125" y="95" width="112" height="62" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></rect>
<text x="181" y="118" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">API 层</text>
<text x="181" y="136" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">鉴权 / 限流 / 校验</text>
<text x="181" y="150" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">OpenAI 协议</text>

<rect x="262" y="95" width="100" height="62" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="312" y="118" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Tokenizer</text>
<text x="312" y="136" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">文本 → token id</text>
<text x="312" y="150" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">CPU 上执行</text>

<rect x="387" y="80" width="150" height="92" rx="6" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-width="2"></rect>
<text x="462" y="104" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Scheduler</text>
<text x="462" y="124" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">等待队列 / 运行队列</text>
<text x="462" y="140" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">组 batch、分配 KV 块</text>
<text x="462" y="158" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">chunked prefill</text>

<rect x="562" y="80" width="170" height="92" rx="6" fill="var(--sv-panel)" stroke="var(--sv-c)" stroke-width="2"></rect>
<text x="647" y="104" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Model Runner</text>
<text x="647" y="124" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">GPU 上前向计算</text>
<text x="647" y="140" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">TP 组内 all-reduce</text>
<text x="647" y="158" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">采样出下一个 token</text>

<rect x="360" y="235" width="190" height="78" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)" stroke-dasharray="5 4"></rect>
<text x="455" y="259" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Paged KV Pool</text>
<text x="455" y="278" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">按块分配，prefix cache</text>
<text x="455" y="294" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">多请求共享物理页</text>

<rect x="575" y="235" width="145" height="78" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="647" y="259" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Detokenizer</text>
<text x="647" y="278" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">增量解码 + 停止条件</text>
<text x="647" y="294" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">SSE 流式推送</text>

<line x1="100" y1="126" x2="120" y2="126" stroke="var(--sv-muted)" stroke-width="1.6" marker-end="url(#serving-engines-arrow-1)"></line>
<line x1="237" y1="126" x2="257" y2="126" stroke="var(--sv-muted)" stroke-width="1.6" marker-end="url(#serving-engines-arrow-1)"></line>
<line x1="362" y1="126" x2="382" y2="126" stroke="var(--sv-muted)" stroke-width="1.6" marker-end="url(#serving-engines-arrow-1)"></line>
<line x1="537" y1="126" x2="557" y2="126" stroke="var(--sv-muted)" stroke-width="1.6" marker-end="url(#serving-engines-arrow-1)"></line>
<line x1="647" y1="172" x2="647" y2="230" stroke="var(--sv-muted)" stroke-width="1.6" marker-end="url(#serving-engines-arrow-1)"></line>
<line x1="455" y1="172" x2="455" y2="230" stroke="var(--sv-line)" stroke-width="1.4" stroke-dasharray="4 4" marker-end="url(#serving-engines-arrow-1)"></line>
<line x1="575" y1="274" x2="105" y2="274" stroke="var(--sv-muted)" stroke-width="1.4" stroke-dasharray="6 5"></line>
<line x1="105" y1="274" x2="105" y2="162" stroke="var(--sv-muted)" stroke-width="1.4" stroke-dasharray="6 5" marker-end="url(#serving-engines-arrow-1)"></line>

<text x="133" y="192" font-size="11" fill="var(--sv-muted)" font-family="inherit">1–3 ms</text>
<text x="267" y="192" font-size="11" fill="var(--sv-muted)" font-family="inherit">2–5 ms</text>
<text x="405" y="192" font-size="11" fill="var(--sv-muted)" font-family="inherit">排队时间随负载变化</text>
<text x="580" y="192" font-size="11" fill="var(--sv-muted)" font-family="inherit">prefill 数十至数百 ms</text>
<text x="360" y="332" font-size="11" fill="var(--sv-muted)" font-family="inherit">Scheduler 读取块表定位历史 KV，命中则跳过重复 prefill</text>
<text x="130" y="300" font-size="11" fill="var(--sv-ink)" font-family="inherit">逐 token 流式返回</text>
</svg>
<figcaption>图 1 · 引擎不是一层，而是五段；延迟问题要按段定位，而不是归咎于“模型慢”</figcaption>
</figure>
<p><b>API 层</b>负责协议与准入：解析 OpenAI 的 <code>/v1/chat/completions</code>、校验参数、做鉴权和限流、维护 SSE 长连接。它的开销通常在个位数毫秒，但它是唯一能统一做配额、审计和超时的地方。<b>Tokenizer</b> 在 CPU 上把文本转成 id，正常几毫秒；超长 prompt（几万 token）或 CPU 被挤占时，它会变成可观测的毛刺来源。</p>
<p><b>Scheduler</b> 是引擎的大脑：请求进入等待队列，每一步决定把哪些请求拼进当前 batch、如何分配 KV 块、prefill 与 decode 如何交错，它直接决定排队时间（queue time）。<b>Model runner</b> 调用 GPU：prefill 一次算完输入，decode 每步只算一个 token，TP 组内每层都要 all-reduce。<b>Detokenizer</b> 把 id 增量还原成文本，处理停止符与工具调用，再流式推回客户端。</p>
<p>这条链路的一个关键性质是：<mark>各段的服务时间大致相加，但排队时间会随负载非线性放大</mark>。空闲时一次请求约 120 ms，其中 prefill 占 94 ms；到 80% 负载，同样的计算可能要多等 300 ms。所以容量规划先量 queue time，再谈算子优化。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>排障顺序固定为：queue time → prefill 耗时 → decode 每步耗时 → 路由命中率 → GPU 指标。tokenizer 与 API 层通常只占个位数毫秒，除非 CPU 被打满或请求体异常大。</div></div>
</section>

<section class="sec">
<h2>四个引擎：它们不在同一层，解决的问题也不同</h2>
<p>四个引擎常被放在一张表里比较，但抽象层级并不相同。vLLM 与 SGLang 是完整的在线服务框架，TensorRT-LLM 更像编译器加运行时，TGI 是 Hugging Face 生态的服务封装。选型第一步不是比吞吐，而是确认约束：模型是否频繁更换、团队能否改内核、能否接受每次发版重新编译。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>引擎</th><th>出身与核心机制</th><th>优势</th><th>代价</th><th>适用场景</th></tr></thead>
<tbody>
<tr><td>vLLM</td><td>UC Berkeley 起源，PagedAttention + 连续批处理，V1 引擎</td><td>生态最广、新模型跟进快、OpenAI 兼容完善、prefix caching 与多 LoRA 成熟</td><td>极致低延迟略逊于编译方案；大规模 MoE 需配合专家并行（EP）</td><td>通用 API 服务、模型多样的平台、快速上线</td></tr>
<tr><td>SGLang</td><td>Stanford / LMSYS 起源，RadixAttention 前缀树 + 压缩 FSM</td><td>长共享前缀命中率高、结构化输出快、大规模数据并行（DP）/专家并行（EP）支持积极</td><td>生态与周边工具少于 vLLM；部分新模型适配稍晚</td><td>Agent、RAG、多轮对话等前缀高度复用的负载</td></tr>
<tr><td>TensorRT-LLM</td><td>NVIDIA 官方，编译期生成 engine，手写 plugin 与量化内核</td><td>NVIDIA GPU 上单卡性能强，FP8/INT4 与 in-flight batching 成熟</td><td>需按模型、GPU 型号、版本编译；换模型或升级要重建；灵活性低</td><td>模型固定、追求极致成本、已深度绑定 NVIDIA</td></tr>
<tr><td>TGI</td><td>Hugging Face，Rust 路由层 + Python 推理后端，连续批处理</td><td>部署简单、与 HF 模型库和 Inference Endpoints 集成好</td><td>高级特性与调优空间相对少；大规模定制能力有限</td><td>快速验证、HF 生态用户、中小规模服务</td></tr>
</tbody>
</table></div>
<p><b>vLLM</b> 是多数团队的默认答案。PagedAttention 让 KV Cache 按块管理、跨请求共享物理页；OpenAI 兼容层、投机解码、多 LoRA、prefix caching 都在主线上。它的优势不是某项指标最强，而是功能齐全、新模型适配快。</p>
<p><b>SGLang</b> 的差异点在前缀复用与结构化输出。RadixAttention 用基数树缓存多轮对话、few-shot 示例与同一份 RAG 文档的公共前缀；压缩 FSM 让 JSON schema 约束解码远快于逐 token 掩码。前缀复用明显的流量，往往能用更少的卡跑到同样吞吐。</p>
<p><b>TensorRT-LLM</b> 把模型编译成针对特定 GPU 与精度的 engine，运行时开销小、内核融合彻底，固定模型与硬件时单卡性能通常最好；代价是产物与 GPU 架构、CUDA、引擎版本强绑定，换模型要重新构建压测。<b>TGI</b> 胜在简单：一个镜像加几条环境变量即可起服务。</p>
<div class="duo">
<div class="duo__col"><h4>模型经常换、要快速试错</h4><p>选 vLLM 或 SGLang。动态加载、社区适配快，出问题能改 Python 层；别为 10% 性能优势锁进编译流程。</p></div>
<div class="duo__col"><h4>模型半年不变、成本敏感</h4><p>评估 TensorRT-LLM。把编译与回归纳入 CI，用固定机型压测；收益要能覆盖构建与运维复杂度。</p></div>
</div>
</section>

<section class="sec">
<h2>多卡部署：TP 放在机内，副本放在机外</h2>
<p>单卡装不下模型时，第一反应是切分。张量并行（Tensor Parallelism, TP）把每层权重按列或行切开，各卡算一部分再做 all-reduce 汇总；专家并行（Expert Parallelism, EP）用于 MoE，把不同专家放到不同卡上，token 经 all-to-all 路由。此外还有数据并行（Data Parallelism, DP）：每个副本持有完整模型、分摊不同请求，副本间只做负载均衡。三者通信模式不同，部署约束也不同。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="TP 与 EP 的部署拓扑对比，TP 组内 NVLink 通信，副本间无集合通信">
<defs>
<marker id="serving-engines-arrow-2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
<path d="M 0 0 L 10 5 L 0 10 Z" fill="var(--sv-muted)"></path>
</marker>
</defs>
<text x="20" y="28" font-size="15" fill="var(--sv-ink)" font-family="inherit">部署拓扑：TP 留在单机 NVLink 域，MoE 用 EP 切分</text>
<text x="20" y="50" font-size="12" fill="var(--sv-muted)" font-family="inherit">左：单机 8 卡上的两个 TP=4 副本；右：MoE 层的 EP=8</text>

<rect x="300" y="70" width="160" height="44" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="380" y="97" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">KV-aware Router</text>

<rect x="30" y="145" width="330" height="205" rx="8" fill="var(--sv-bg)" stroke="var(--sv-line)" stroke-dasharray="6 5"></rect>
<text x="45" y="168" font-size="12" fill="var(--sv-muted)" font-family="inherit">Node 0 · 8 × H100 80GB</text>
<text x="45" y="190" font-size="12" fill="var(--sv-ink)" font-family="inherit">副本 A：TP=4</text>
<rect x="45" y="202" width="65" height="52" rx="4" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></rect>
<text x="77" y="232" font-size="11" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU0</text>
<rect x="120" y="202" width="65" height="52" rx="4" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></rect>
<text x="152" y="232" font-size="11" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU1</text>
<rect x="195" y="202" width="65" height="52" rx="4" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></rect>
<text x="227" y="232" font-size="11" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU2</text>
<rect x="270" y="202" width="65" height="52" rx="4" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></rect>
<text x="302" y="232" font-size="11" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU3</text>
<line x1="45" y1="274" x2="335" y2="274" stroke="var(--sv-a)" stroke-width="2"></line>
<text x="45" y="294" font-size="11" fill="var(--sv-muted)" font-family="inherit">层内 all-reduce：900 GB/s 级 NVLink</text>

<text x="45" y="322" font-size="12" fill="var(--sv-ink)" font-family="inherit">副本 B：TP=4</text>
<rect x="45" y="330" width="65" height="12" rx="3" fill="var(--sv-panel)" stroke="var(--sv-b)"></rect>
<rect x="120" y="330" width="65" height="12" rx="3" fill="var(--sv-panel)" stroke="var(--sv-b)"></rect>
<rect x="195" y="330" width="65" height="12" rx="3" fill="var(--sv-panel)" stroke="var(--sv-b)"></rect>
<rect x="270" y="330" width="65" height="12" rx="3" fill="var(--sv-panel)" stroke="var(--sv-b)"></rect>

<rect x="400" y="145" width="330" height="205" rx="8" fill="var(--sv-bg)" stroke="var(--sv-line)" stroke-dasharray="6 5"></rect>
<text x="415" y="168" font-size="12" fill="var(--sv-muted)" font-family="inherit">Node 1 · 8 × H100 80GB</text>
<rect x="415" y="190" width="300" height="70" rx="4" fill="var(--sv-panel)" stroke="var(--sv-c)" stroke-width="2"></rect>
<text x="565" y="216" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">MoE 层：EP=8</text>
<text x="565" y="238" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">专家分散在 8 卡，token 经 all-to-all 路由</text>
<text x="415" y="290" font-size="11" fill="var(--sv-muted)" font-family="inherit">节点内 EP：all-to-all 走 NVLink</text>
<text x="415" y="312" font-size="11" fill="var(--sv-muted)" font-family="inherit">跨机 EP：all-to-all 走 IB / RoCE，带宽低一个量级</text>

<line x1="360" y1="114" x2="230" y2="140" stroke="var(--sv-muted)" stroke-width="1.6" marker-end="url(#serving-engines-arrow-2)"></line>
<line x1="400" y1="114" x2="540" y2="140" stroke="var(--sv-muted)" stroke-width="1.6" marker-end="url(#serving-engines-arrow-2)"></line>
</svg>
<figcaption>图 2 · TP 的 all-reduce 在每层内部，必须留在 NVLink 域；EP 的 all-to-all 可以跨机，但要为 IB / RoCE 的带宽与延迟付代价</figcaption>
</figure>
<p>TP 的代价是通信。以 8 卡 H100 为例，NVLink 4 双向带宽约 900 GB/s，TP=8 时每层两次 all-reduce 尚可接受；跨机走 InfiniBand NDR（400 Gb/s ≈ 50 GB/s）或 RoCE 则带宽掉一个量级、延迟涨数倍，每步只有几毫秒的 decode 会被通信拖垮。经验法则：<mark>TP 度数不要超过单机 GPU 数</mark>，要更多算力就加副本。</p>
<p>EP 的取舍不同。MoE 的专家可能上百，全部放单机不现实，只能跨机 EP；此时 all-to-all 是固有成本，优化重点是让 token 路由局部化、专家放置与网络拓扑对齐。EP 也常与 TP 组合：例如节点内用 TP=8 跑注意力层，MoE 层则跨 8 个节点做 EP=64，按节点切分专家。</p>
<p>容量与吞吐可以先笔算，再决定买几张卡。下式中 P 是参数量，b 是每参数字节数（bf16 为 2），KV 是全部并发序列的缓存总量，B 是单副本并发 batch：</p>
<div class="formula">显存约束：N_gpu × HBM ≥ P × b + KV_total
总吞吐 ≈ B ÷ TPOT × 副本数（B 为单副本并发）
KV 每 token = 2 × L × H_kv × d_head × b
Llama-3-70B（80 层、8 个 KV 头、d_head=128、bf16）：KV/token ≈ 2×80×8×128×2 B = 320 KiB
8K 上下文单序列 ≈ 2.5 GiB（约 2.7 GB），32 并发 ≈ 80 GiB
8 × H100 80GB = 640 GB，权重约 141 GB，扣除激活与碎片后 KV 预算约 450 GB，约 170 条 8K 序列（GB 为十进制，GiB 为二进制）</div>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>TP 不是越大越好。TP 从 4 加到 8，单步计算时间约减半，但 all-reduce 的环步数与同步开销随卡数上升、通信占每步时间的比例变大，TPOT 可能只改善 30%–60%，而卡数翻倍。判断标准永远是压测后的“每美元 goodput”，不是单请求延迟。</div></div>
</section>

<section class="sec">
<h2>KV-aware 路由与 prefix cache：把缓存变成命中率</h2>
<p>真实流量里，大量请求共享同一段前缀：固定的 system prompt、few-shot 示例、检索文档、多轮对话历史。prefix cache 会把这段前缀对应的 KV 块按内容哈希保存，下次遇到相同前缀直接复用，跳过重复 prefill。问题在于，<mark>缓存默认是副本本地的</mark>——请求被轮询到另一台副本，缓存就不存在了。</p>
<p>单副本内部，vLLM 用块哈希、SGLang 用基数树匹配最长公共前缀，匹配越长省下的 prefill 越多。跨副本时，普通负载均衡（round-robin、least-connections）对缓存位置一无所知，会把算过的前缀送到另一张卡重算，这就是“单副本压测很好、上多副本吞吐反降”的常见原因。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="三种路由策略对比：轮询、最少负载、KV 感知路由的缓存命中与 prefill 成本">
<defs>
<marker id="serving-engines-arrow-3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
<path d="M 0 0 L 10 5 L 0 10 Z" fill="var(--sv-muted)"></path>
</marker>
</defs>
<text x="20" y="26" font-size="15" fill="var(--sv-ink)" font-family="inherit">同一段 2K 前缀，三种路由策略的代价</text>
<text x="20" y="48" font-size="12" fill="var(--sv-muted)" font-family="inherit">假设缓存容量有限、两副本各自只驻留部分前缀；60% 流量共享同一前缀，命中时 prefill 约 6 ms，未命中约 94 ms</text>

<text x="20" y="86" font-size="13" fill="var(--sv-ink)" font-family="inherit">轮询</text>
<text x="20" y="104" font-size="11" fill="var(--sv-muted)" font-family="inherit">Round Robin</text>
<rect x="115" y="74" width="95" height="44" rx="5" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="162" y="101" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">请求</text>
<rect x="280" y="64" width="110" height="64" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="335" y="88" font-size="11" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">副本 A</text>
<text x="335" y="108" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">约半数请求命中</text>
<rect x="470" y="64" width="110" height="64" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="525" y="88" font-size="11" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">副本 B</text>
<text x="525" y="108" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">约半数请求命中</text>
<text x="610" y="94" font-size="12" fill="var(--sv-c)" font-family="inherit">有效命中 30%</text>
<text x="610" y="114" font-size="11" fill="var(--sv-muted)" font-family="inherit">prefill 成本高</text>

<text x="20" y="176" font-size="13" fill="var(--sv-ink)" font-family="inherit">最少负载</text>
<text x="20" y="194" font-size="11" fill="var(--sv-muted)" font-family="inherit">Least Loaded</text>
<rect x="115" y="164" width="95" height="44" rx="5" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="162" y="191" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">请求</text>
<rect x="280" y="154" width="110" height="64" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="335" y="178" font-size="11" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">副本 A · 队列 3</text>
<text x="335" y="198" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">可能命中</text>
<rect x="470" y="154" width="110" height="64" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="525" y="178" font-size="11" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">副本 B · 队列 1</text>
<text x="525" y="198" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">优先送去 B</text>
<text x="610" y="184" font-size="12" fill="var(--sv-c)" font-family="inherit">负载均衡但</text>
<text x="610" y="204" font-size="11" fill="var(--sv-muted)" font-family="inherit">缓存被稀释</text>

<text x="20" y="266" font-size="13" fill="var(--sv-ink)" font-family="inherit">KV 感知</text>
<text x="20" y="284" font-size="11" fill="var(--sv-muted)" font-family="inherit">Prefix Aware</text>
<rect x="115" y="254" width="95" height="44" rx="5" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="162" y="281" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">请求</text>
<rect x="280" y="244" width="110" height="64" rx="5" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></rect>
<text x="335" y="268" font-size="11" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">副本 A · 前缀命中</text>
<text x="335" y="288" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">prefill 6 ms</text>
<rect x="470" y="244" width="110" height="64" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="525" y="268" font-size="11" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">副本 B · 无缓存</text>
<text x="525" y="288" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">仅承接新前缀</text>
<text x="610" y="274" font-size="12" fill="var(--sv-a)" font-family="inherit">有效命中 60%</text>
<text x="610" y="294" font-size="11" fill="var(--sv-muted)" font-family="inherit">跳过大部分 prefill</text>

<line x1="210" y1="96" x2="275" y2="96" stroke="var(--sv-muted)" stroke-width="1.6" marker-end="url(#serving-engines-arrow-3)"></line>
<line x1="210" y1="186" x2="275" y2="186" stroke="var(--sv-muted)" stroke-width="1.6" marker-end="url(#serving-engines-arrow-3)"></line>
<line x1="210" y1="276" x2="275" y2="276" stroke="var(--sv-a)" stroke-width="1.8" marker-end="url(#serving-engines-arrow-3)"></line>
<text x="20" y="352" font-size="11" fill="var(--sv-muted)" font-family="inherit">注：示例假设缓存容量有限、两个副本各自只驻留部分前缀；真实命中率取决于前缀长度、缓存容量与淘汰策略。</text>
</svg>
<figcaption>图 3 · 路由决定缓存命中率：同样的副本与流量，KV 感知路由把有效命中从 30% 提到 60%</figcaption>
</figure>
<p>KV-aware 路由维护“副本 → 前缀哈希 + 队列长度”的表：请求先算前缀哈希，找最长匹配，再按匹配长度与负载加权打分。两个坑：缓存信息异步上报可能过期，要设兜底阈值退回最少负载；前缀哈希按块粒度计算，否则差一个字节就全不命中。</p>
<p>更激进的是跨副本共享 KV：把命中的 KV 块从持有副本传到执行副本，用带宽换计算。它适合前缀极长、复用极高的场景，但 2K token 的 KV 已有数百 MB（70B 模型约 640 MB），只有计算节省大于传输开销才划算。多数团队先把路由做对，再评估传输。</p>
<div class="formula">有效 prefill 计算量 = (1 − h) × C_prefill
计算量下降比例 = h × C_prefill ÷ (C_prefill + N_out × C_decode)
若 h=0.6、prefill 占单请求计算量的 70%，则整体计算量下降约 42%</div>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>KV-aware 路由就是推理服务的 CDN：把相同内容钉在离请求最近的缓存节点。区别在于 CDN 缓存的是一张图片，这里缓存的是几百 MB 的 KV 块，而且缓存会随显存压力被淘汰。</div></div>
</section>

<section class="sec">
<h2>延迟分解、SLO 定义与压测方法</h2>
<p>讨论服务好坏之前，先把指标定义清楚。在线 LLM 最常用的四个量是：<b>TTFT</b>（time to first token，请求发出到收到第一个 token）、<b>TPOT</b>（time per output token，首 token 后每个 token 的平均间隔，也叫 ITL）、<b>E2E</b>（端到端完成时间）、<b>goodput</b>（单位时间内满足全部 SLO 的 token 数）。前三个看体验，最后一个看容量。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="延迟分解瀑布图，TTFT 与 TPOT 各段耗时构成">
<defs>
<marker id="serving-engines-arrow-4" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
<path d="M 0 0 L 10 5 L 0 10 Z" fill="var(--sv-muted)"></path>
</marker>
</defs>
<text x="20" y="28" font-size="15" fill="var(--sv-ink)" font-family="inherit">延迟分解：TTFT 与 TPOT 各自的钱花在哪里</text>
<text x="20" y="50" font-size="12" fill="var(--sv-muted)" font-family="inherit">示例口径：H100 80GB、Llama-3-8B、输入 2K、输出 256、batch=1</text>

<text x="20" y="92" font-size="12" fill="var(--sv-ink)" font-family="inherit">TTFT</text>
<text x="20" y="110" font-size="11" fill="var(--sv-muted)" font-family="inherit">总计约 120 ms</text>
<rect x="90" y="80" width="75" height="34" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
<text x="127" y="102" font-size="11" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">排队 15</text>
<rect x="165" y="80" width="20" height="34" fill="var(--sv-c)" stroke="var(--sv-line)"></rect>
<rect x="185" y="80" width="470" height="34" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
<text x="420" y="102" font-size="11" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">prefill 94 ms（2K token 前向）</text>
<rect x="655" y="80" width="15" height="34" fill="var(--sv-c)" stroke="var(--sv-line)"></rect>
<rect x="670" y="80" width="20" height="34" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
<text x="127" y="132" font-size="10" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">queue</text>
<text x="175" y="132" font-size="10" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">tok</text>
<text x="420" y="132" font-size="10" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">prefill</text>
<text x="663" y="132" font-size="10" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">采样</text>
<text x="680" y="132" font-size="10" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">网络</text>
<line x1="690" y1="80" x2="720" y2="66" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 3"></line>
<text x="700" y="60" font-size="11" fill="var(--sv-muted)" font-family="inherit">首 token</text>

<text x="20" y="196" font-size="12" fill="var(--sv-ink)" font-family="inherit">TPOT</text>
<text x="20" y="214" font-size="11" fill="var(--sv-muted)" font-family="inherit">每步约 14 ms</text>
<rect x="90" y="184" width="64" height="34" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
<rect x="154" y="184" width="386" height="34" fill="var(--sv-a)" stroke="var(--sv-line)"></rect>
<text x="347" y="206" font-size="11" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">decode 前向 9 ms（读 16 GB 权重）</text>
<rect x="540" y="184" width="64" height="34" fill="var(--sv-c)" stroke="var(--sv-line)"></rect>
<rect x="604" y="184" width="86" height="34" fill="var(--sv-b)" stroke="var(--sv-line)"></rect>
<text x="122" y="236" font-size="10" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">调度 1.5</text>
<text x="572" y="236" font-size="10" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">采样 1.5</text>
<text x="647" y="236" font-size="10" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">detok + 流式 2</text>
<text x="90" y="252" font-size="10" fill="var(--sv-muted)" font-family="inherit">两行各自独立刻度，未按同一时间轴绘制</text>

<text x="20" y="300" font-size="12" fill="var(--sv-ink)" font-family="inherit">E2E ≈ 120 + 255 × 14 ≈ 3.69 s</text>
<text x="20" y="322" font-size="11" fill="var(--sv-muted)" font-family="inherit">当并发升高，排队段膨胀最快；prefill 也会被 chunked 切碎分摊到多步</text>
<text x="20" y="344" font-size="11" fill="var(--sv-muted)" font-family="inherit">因此只优化 API 层代码通常无用，“降低 queue time 与 prefill 计算”才有用</text>
</svg>
<figcaption>图 4 · 同一个 E2E 里，TTFT 与 TPOT 的构成完全不同，优化手段也不能互换</figcaption>
</figure>
<p>把图写成公式：E2E 近似等于 TTFT 加输出长度乘以 TPOT。这个近似很重要：<mark>输入长、输出短的应用（分类、抽取、RAG 问答）由 TTFT 主导，输入短、输出长的应用（写作、代码生成）由 TPOT 主导</mark>。两者优化方向相反：前者压 prefill 与排队，后者压每步 decode 与 batch 效率。</p>
<p>压测最容易犯的错是用平均值和闭环。平均值掩盖长尾；闭环（收到响应再发下一个）会让客户端随服务变慢而降速，低估排队延迟，即 coordinated omission。正确做法是开环泊松施压：固定目标 QPS，请求独立发出、不等上一个返回；阶梯加压，每档跑 5–10 分钟并丢弃前 1–2 分钟预热，记录 p50/p95/p99 与错误率，找到延迟非线性上升的拐点（knee），容量定在拐点的 70% 左右。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>指标</th><th>定义</th><th>采集位置</th><th>典型目标（示例，视业务而定）</th></tr></thead>
<tbody>
<tr><td>TTFT p95</td><td>请求发出到首 token 到达</td><td>网关或引擎 metrics</td><td>交互式对话 &lt; 800 ms</td></tr>
<tr><td>TPOT p95</td><td>首 token 后相邻 token 间隔</td><td>引擎 metrics</td><td>&lt; 50 ms（约 20 token/s 以上）</td></tr>
<tr><td>E2E p95</td><td>整段输出完成</td><td>网关</td><td>&lt; 15 s（输出 256 token，按 TPOT 50 ms 估算约 13 s）</td></tr>
<tr><td>queue time p95</td><td>进入调度器到开始执行</td><td>引擎 metrics</td><td>&lt; 50 ms</td></tr>
<tr><td>goodput</td><td>满足全部 SLO 的 token/s</td><td>压测报告</td><td>越高越好，用于容量与成本核算</td></tr>
<tr><td>错误率</td><td>5xx、超时、截断占比</td><td>网关</td><td>&lt; 0.1%</td></tr>
</tbody>
</table></div>
<div class="formula">TTFT = T_queue + T_tokenize + T_prefill + T_sample + T_network
E2E = TTFT + (N_out − 1) × TPOT
Little 定律：L = λ × W（并发数 = 到达率 × 平均停留时间）
例：λ=20 req/s、W=4 s → 平均 80 并发；单副本有效 batch 32 → 至少 3 个副本并留余量</div>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>只报平均 TTFT 的压测报告没有决策价值。p99 由排队与个别超长输入决定，SLO 违约也几乎都发生在尾部。至少给出 p50、p95、p99，并注明输入输出长度分布与硬件配置。</div></div>
</section>

<section class="sec">
<h2>上生产：接口、K8s、弹性与灰度</h2>
<p>引擎跑起来只是起点，生产化要解决四件事：稳定接口、可重复部署、跟得上流量的弹性、能回退的灰度。接口层面，主流引擎都提供 OpenAI 兼容端点，客户端可以零改造迁移。下面是一次带流式的调用，密钥通过环境变量传入，不要写进代码：</p>
<pre class="code" data-lang="bash"><code>curl -s http://$HOST:8000/v1/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"meta-llama/Llama-3-8B-Instruct","messages":[{"role":"user","content":"用一句话解释 KV Cache"}],"max_tokens":128,"stream":true}'</code></pre>
<p>K8s 部署有三个坑。第一，模型加载要几十秒到数分钟；若同时配置了存活探针，必须配 <code>startupProbe</code>（或足够长的 <code>initialDelaySeconds</code>），否则容器会在加载期间被判失败并反复重启；就绪探针应在模型可服务后才通过。第二，TP 用到共享内存与 NCCL，必须挂载足够大的 <code>/dev/shm</code>，否则多卡初始化失败。第三，镜像固定版本，回滚才有确定目标。</p>
<pre class="code" data-lang="yaml"><code>apiVersion: apps/v1
kind: Deployment
metadata:
  name: vllm-llama3-8b
spec:
  replicas: 2
  selector:
    matchLabels: {app: vllm-llama3-8b}
  template:
    metadata:
      labels: {app: vllm-llama3-8b}
    spec:
      containers:
      - name: vllm
        image: vllm/vllm-openai:v0.6.3
        args:
        - "--model=meta-llama/Llama-3-8B-Instruct"
        - "--tensor-parallel-size=1"
        - "--enable-prefix-caching"
        - "--max-model-len=8192"
        ports:
        - containerPort: 8000
        resources:
          limits: {nvidia.com/gpu: "1"}
        startupProbe:
          httpGet: {path: /health, port: 8000}
          periodSeconds: 10
          failureThreshold: 60
        readinessProbe:
          httpGet: {path: /health, port: 8000}
          periodSeconds: 5
        volumeMounts:
        - {name: shm, mountPath: /dev/shm}
      volumes:
      - name: shm
        emptyDir: {medium: Memory, sizeLimit: 8Gi}</code></pre>
<p>弹性方面，<mark>不要用 GPU 利用率作为扩容指标</mark>。decode 是访存瓶颈，利用率可能很高但仍有排队，也可能因 batch 小而不高；真正与体验相关的是队列长度、KV 块占用率和 p95 TTFT。用 Prometheus 采集这些指标，通过 custom metrics adapter 或 KEDA 驱动 HPA。冷启动是硬约束：加载 70B 权重按 3 GB/s 存储带宽理论最少约 47 s，加初始化通常要数分钟，所以必须保留 minReplicas、预热镜像层、把权重放在本地 NVMe 或高速 PVC 上，缩容前先摘流量并等待在途请求排空。</p>
<p>灰度要同时看正确性与性能。按 5% → 25% → 100% 切流，每档对比 p95 TTFT、p95 TPOT、错误率、prefix cache 命中率与每 token 成本；只看错误率会漏掉“正常但慢一倍”的回归。引擎升级常伴随默认参数变化，配置变更也应走同一套灰度。回滚要分钟级完成，保留上一版本镜像。</p>
<pre class="code" data-lang="bash"><code>kubectl rollout status deployment/vllm-llama3-8b
kubectl rollout history deployment/vllm-llama3-8b
kubectl rollout undo deployment/vllm-llama3-8b --to-revision=3
kubectl rollout pause deployment/vllm-llama3-8b</code></pre>
<div class="callout callout--story"><span class="callout__label">案例</span><div>某团队升级引擎，错误率保持 0，但一周后成本上涨 40%。回看灰度指标才发现 prefix cache 命中率从 62% 掉到 18%，每次都在重算长 system prompt。教训是：灰度必须对照缓存命中率与每请求 prefill token 数。</div></div>
</section>

<section class="sec">
<h2>常见误区、排障与自测</h2>
<h3>三个高频误区</h3>
<ul>
<li><b>把 vLLM 当成“开了就快”</b>：默认参数面向通用场景，max-num-seqs、max-model-len、gpu-memory-utilization 不调，长上下文场景很容易 OOM 或吞吐减半。</li>
<li><b>多副本下用普通负载均衡</b>：前缀缓存被打散，prefill 重复计算，副本越多单位成本越高。</li>
<li><b>按 GPU 利用率扩容</b>：decode 的利用率与排队没有稳定关系，应看队列深度与 KV 占用。</li>
</ul>
<h3>排障顺序</h3>
<ol>
<li>看 queue time：若它占 TTFT 的一半以上，问题在容量或调度，不在算子。</li>
<li>看 prefill 与输入长度：是否被超长请求拖慢，是否需 chunked prefill 限制单步预算。</li>
<li>看 TPOT 与 batch：batch 太小说明并发不足或调度受限，太大则每步变慢、TPOT 上升。</li>
<li>看路由与缓存命中率：多副本时命中率骤降，优先修路由而不是加卡。</li>
<li>最后看 GPU：显存是否接近上限、是否发生 KV 块回收、NCCL 是否有重传与超时。</li>
</ol>
<h3>自测</h3>
<details class="quiz"><summary>Q1 · 两个副本、60% 流量共享同一前缀，轮询路由的有效命中率大约是多少？换成 KV-aware 后呢？</summary><div class="quiz__a">在缓存容量有限、前缀不会在两个副本同时驻留的前提下，轮询下共享前缀落到持有缓存副本的概率约 1/2，有效命中约 60% × 50% = 30%；KV-aware 把该前缀固定到同一副本，有效命中接近 60%。剩下 40% 是独立新前缀，路由无法提升。</div></details>
<details class="quiz"><summary>Q2 · Llama-3-70B、bf16、8 张 H100 80GB、TP=8，权重与 KV 各占多少？8K 上下文能放多少并发？</summary><div class="quiz__a">权重约 141 GB；总显存 640 GB，扣除激活与碎片后 KV 可用约 400–450 GB。每 token 约 320 KiB，8K 序列约 2.5 GiB（约 2.7 GB），约 150–170 条并发。实际还要给 CUDA graph 与临时缓冲留余量。</div></details>
<details class="quiz"><summary>Q3 · 压测平均 TTFT 200 ms 达标，上线后 p99 却超过 1 s，最可能的原因是什么？</summary><div class="quiz__a">一是闭环压测掩盖排队，真实开环流量下队列指数增长；二是线上有更多超长输入与突发；三是多副本路由打散 prefix cache，prefill 计算量更高。应改用开环泊松压测，并按输入长度分桶统计分位数。</div></details>
<details class="quiz"><summary>Q4 · 为什么 TP 通常不建议跨机扩展到 16 或 32？</summary><div class="quiz__a">TP 每层都要 all-reduce，通信在关键路径上。机内 NVLink 约 900 GB/s，跨机 IB/RoCE 低一个量级且延迟更高，decode 每步只有几毫秒，通信会直接成为瓶颈。应保持 TP 在单机内，靠增加副本横向扩展。</div></details>
<h3>延伸阅读</h3>
<ul class="refs">
<li><b>vLLM Documentation</b> — vLLM Project。官方文档，覆盖 OpenAI 兼容服务、张量并行、prefix caching 与生产参数。</li>
<li><b>SGLang Documentation</b> — SGLang Team。RadixAttention、结构化输出与大规模部署的官方说明。</li>
<li><b>NVIDIA TensorRT-LLM Documentation</b> — NVIDIA。engine 构建流程、in-flight batching 与量化支持的权威口径。</li>
<li><b>NVIDIA Triton Inference Server Documentation</b> — NVIDIA。多模型、多框架统一服务与动态批处理的参考实现，常与 TensorRT-LLM 搭配。</li>
<li><b>Efficient Memory Management for Large Language Model Serving with PagedAttention</b> — Kwon et al., SOSP 2023。PagedAttention 与 vLLM 的原始论文，解释 KV 分页如何提升吞吐。</li>
</ul>
</section>`
};
