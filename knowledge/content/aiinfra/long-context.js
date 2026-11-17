window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["long-context"] = {
  slug: "long-context",
  title: "长上下文基础设施",
  subtitle: "从 4K 到 1M 的代价",
  level: 6,
  cluster: "前沿",
  tags: ["RoPE", "MLA", "Ring Attention"],
  summary: "长上下文成本随阶段切换：短序列看 KV 容量，数万 token 后注意力平方项主导，再远则受位置外推与有效利用率限制。重点是 RoPE/YaRN、KV 压缩、稀疏检索与序列并行。",
  keyPoints: [
    "8B 模型在约 3 万 token 处（QKᵀ/PV 按完整矩阵计；计入因果掩码约 6 万），注意力的 4N²dHL 项超过其余部分的 2NP 项；此前 KV 容量是主角，此后平方项主导 prefill。",
    "RoPE 外推不是改个配置就完事：PI、NTK 缩放与 YaRN 分别改位置、频率与温度，训练与推理的缩放配置必须一致。",
    "GQA 靠共享 KV 头把 cache 降到 1/G，MLA 靠低秩潜向量加解耦 RoPE 把每层每 token 压到数百个数；稀疏与检索改变的是连接图，不是免费的容量。",
    "Ring attention 把序列切到 P 张卡上、K/V 绕环传递并与分块计算重叠；P 越大每卡算术强度越低，通信与负载均衡决定收益。",
    "宣称的上下文长度不等于有效长度：单针召回会饱和，必须用多针、多跳、聚合与位置扫描来验收。"
  ],
  readingMinutes: 14,
  html: String.raw`
<section class="sec">
<h2>先把账算清：长上下文贵在哪</h2>
<p>把 128K token 的请求喂给 8B 模型，显存里真正占地方的不是输入 embedding，而是每层每个 token 都要保留的 K/V。序列从 4K 到 128K 是 32 倍，注意力计算量却涨约 1024 倍（平方项），KV cache 涨 32 倍（线性项），位置编码还要面对训练时未见过的角度。三件事叠加，才有了“长上下文基础设施”这个话题。</p>
<p>代价从哪来、怎么压掉、怎么并行、怎么训练和验收，是四个不同的问题。结论是：<mark>瓶颈会随阶段切换</mark>。短序列看 KV 容量与 decode 带宽；数万 token 后 prefill 的 N² 项成主项；再往上，位置外推与有效利用率取代纯算力。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>4K 是围桌讨论，128K 是把整个档案馆搬进会议室。桌子（显存）坐不下，就得压缩档案（GQA/MLA）、只翻相关柜子（稀疏/检索），或者让多间会议室同时查同一批档案（ring attention）。三种手段解决的是不同层的瓶颈，不能互相替代。</div></div>
</section>

<section class="sec">
<h2>两条增长曲线：N² 与 N</h2>
<p>设层数 L、查询头数 H、头维 d、序列长度 N、参数量 P。attention 的两次大矩阵乘（QKᵀ 与 PV）各约 2N²d FLOPs，乘头数与层数得 4N²dHL；其余部分（投影与 MLP）每 token 约 2P FLOPs，随 N 线性增长。KV cache 每 token、每层、每个 KV 头存 K 和 V 各 d 个数，也随 N 线性增长。</p>
<div class="formula">注意力 FLOPs ≈ 4 × N² × d × H × L
其余部分 FLOPs ≈ 2 × N × P
KV cache 字节数 ≈ 2 × L × H_kv × d_head × N × b（b 为每元素字节数）</div>
<p>以 Llama-3-8B 口径（L=32、H=32、d=128、P≈8×10⁹）代入：N=4K 时注意力约 8.8 TFLOP，其余约 66 TFLOP；N=128K 时注意力约 9.0 PFLOP，其余约 2.1 PFLOP；N=1M 时注意力约 5.8×10² PFLOP，其余约 1.7×10¹ PFLOP。令两式相等得 N ≈ 2P/(4dHL) ≈ 3.1×10⁴，即 8B 模型在 3 万 token 附近，注意力开始主导 prefill。这里按 QKᵀ 与 PV 的完整 N×N 矩阵计数；自回归模型的因果掩码只保留约一半元素，注意力各项近似减半，交叉点相应后移到 N ≈ P/(dHL) ≈ 6.1×10⁴。两个口径都落在“数万 token”，量级结论一致。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="8B 模型前向计算量随序列长度变化：注意力按平方增长，其余部分线性增长">
<text x="24" y="26" font-size="15" font-family="inherit" fill="var(--sv-ink)">8B 模型单次前向计算量（TFLOP，log 刻度）</text>
<text x="45" y="160" font-size="12" font-family="inherit" fill="var(--sv-muted)" transform="rotate(-90 45 160)" text-anchor="middle">TFLOP</text>
<line x1="100" y1="40" x2="700" y2="40" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"></line>
<line x1="100" y1="80" x2="700" y2="80" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"></line>
<line x1="100" y1="120" x2="700" y2="120" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"></line>
<line x1="100" y1="160" x2="700" y2="160" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"></line>
<line x1="100" y1="200" x2="700" y2="200" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"></line>
<line x1="100" y1="240" x2="700" y2="240" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"></line>
<line x1="100" y1="280" x2="700" y2="280" stroke="var(--sv-line)" stroke-width="1"></line>
<text x="90" y="44" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">1M</text>
<text x="90" y="84" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">100k</text>
<text x="90" y="124" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">10k</text>
<text x="90" y="164" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">1k</text>
<text x="90" y="204" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">100</text>
<text x="90" y="244" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">10</text>
<text x="90" y="284" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">1</text>
<line x1="100" y1="280" x2="100" y2="286" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="325" y1="280" x2="325" y2="286" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="475" y1="280" x2="475" y2="286" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="700" y1="280" x2="700" y2="286" stroke="var(--sv-line)" stroke-width="1"></line>
<text x="100" y="302" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">4K</text>
<text x="325" y="302" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">32K</text>
<text x="475" y="302" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">128K</text>
<text x="700" y="302" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">1M</text>
<text x="400" y="324" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">序列长度 N（token，log 刻度）</text>
<polyline points="100,207 325,171 475,147 700,111" fill="none" stroke="var(--sv-b)" stroke-width="2"></polyline>
<polyline points="100,242 325,170 475,122 700,50" fill="none" stroke="var(--sv-a)" stroke-width="2"></polyline>
<circle cx="100" cy="207" r="3" fill="var(--sv-b)"></circle>
<circle cx="325" cy="171" r="3" fill="var(--sv-b)"></circle>
<circle cx="475" cy="147" r="3" fill="var(--sv-b)"></circle>
<circle cx="700" cy="111" r="3" fill="var(--sv-b)"></circle>
<circle cx="100" cy="242" r="3" fill="var(--sv-a)"></circle>
<circle cx="325" cy="170" r="3" fill="var(--sv-a)"></circle>
<circle cx="475" cy="122" r="3" fill="var(--sv-a)"></circle>
<circle cx="700" cy="50" r="3" fill="var(--sv-a)"></circle>
<line x1="318" y1="172" x2="318" y2="280" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="4 4"></line>
<text x="328" y="212" font-size="12" font-family="inherit" fill="var(--sv-muted)">≈31K 处交叉</text>
<text x="690" y="43" font-size="12" font-family="inherit" fill="var(--sv-a)" text-anchor="end">注意力 ∝ N²</text>
<text x="690" y="104" font-size="12" font-family="inherit" fill="var(--sv-b)" text-anchor="end">其余部分 ∝ N</text>
<rect x="110" y="342" width="12" height="12" fill="var(--sv-a)"></rect>
<text x="128" y="352" font-size="12" font-family="inherit" fill="var(--sv-muted)">注意力（QKᵀ 与 PV）</text>
<rect x="330" y="342" width="12" height="12" fill="var(--sv-b)"></rect>
<text x="348" y="352" font-size="12" font-family="inherit" fill="var(--sv-muted)">其余部分（投影与 MLP）</text>
<text x="110" y="374" font-size="12" font-family="inherit" fill="var(--sv-muted)">口径：Llama-3-8B 结构，前向、单序列，注意力按全矩阵计数（因果掩码约减半），未计通信与访存。</text>
</svg><figcaption>图 1 · 注意力与其余部分的前向计算量（全矩阵口径）。8B 模型在约 3.1 万 token 处交叉（计入因果掩码约 6 万）；128K 时注意力约为其余部分的两倍（因果）到四倍（全矩阵），1M 时约十七倍到三十四倍。</figcaption></figure>
<p>这解释了优化为什么分层：对 8B 量级，32K 以下先压 KV cache（GQA、量化、前缀复用）；超过 32K 必须让注意力本身变便宜（稀疏、分块、并行），或干脆不把全部 token 放进注意力（检索）。“支持 1M”通常很贵，因为平方项不会因营销话术消失。</p>
<p>训练与推理要分开算：训练的反向数倍放大激活显存，靠序列并行解决；推理的预填充（prefill）是 compute-bound，逐 token 生成（decode）是 bandwidth-bound，每生成一个 token 都要读完整份 KV cache。调度见《批处理与调度》一篇。</p>
</section>

<section class="sec">
<h2>位置编码外推：RoPE 为什么会“过期”</h2>
<p>RoPE（Rotary Position Embedding，旋转位置编码，2021）把 Q/K 的每一对维度看成二维平面，按位置 m 旋转一个角度。第 i 对维度的角频率为 θ_i = base^(-2i/d)，常用 base=10000，Llama 3 系列改为 500000。旋转后的内积只依赖相对位移 m-n，这是它取代绝对位置编码的关键性质。</p>
<div class="formula">q_mᵀ k_n = f(m - n)，第 i 对维度旋转角为 (m - n) × θ_i
θ_i = base^(-2i/d)，i = 0, 1, …, d/2 - 1
位置插值：m' = m × (L_train / L_target)</div>
<p>问题在频率分辨率。训练 4K 时模型只见过有限的相对位移；推到 128K，低频维度（θ 小、波长大）转到训练分布外的角度，高频维度出现混叠，logits 尺度随之漂移。表现不是立刻崩溃，而是长距离检索下降、重复增多，且短 prompt 上完全看不出来。</p>
<p>主流修法有三类。位置插值（Position Interpolation，PI）把目标位置线性压回训练范围，相当于把 RoPE 刻度加密，需要少量微调。NTK-aware 缩放不改位置、而是放大 base，把低频维度的波长大幅拉长（等效于对低频做插值）、高频维度几乎不动，零样本外推更好。YaRN 再做逐维度 NTK-by-parts（按波长决定插值还是外推），加 attention 温度系数修正 logits 尺度，论文报告用约 0.1% 预训练 token 把 LLaMA-2 扩到 128K。</p>
<div class="duo"><div class="duo__col"><h4>PI</h4><p>实现最简单，按比例缩放位置即可；但所有维度一起压，短距离分辨率受损，需要少量微调。</p></div><div class="duo__col"><h4>NTK / YaRN</h4><p>分维度处理，零样本可用性更好；实现要改 rotary kernel，配置与训练必须一致。</p></div></div>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>只改 rope_scaling、不做长文微调，困惑度可能正常，但多跳检索会明显掉点。更隐蔽的是训练用 YaRN、推理漏配：模型不报错，只会用错误角度算位置。</div></div>
<p>工程上查三处：max_position_embeddings 是否被框架真正读取；rope_scaling 的 type、factor、original_max_position_embeddings 是否与权重说明一致；kernel 是否支持该缩放，部分融合 kernel 只认原生 RoPE。升级框架后要重新核对，别假设配置会透传。</p>
</section>

<section class="sec">
<h2>KV 压缩：MHA、GQA、MQA、MLA</h2>
<p>KV cache 大小由“存多少组 K/V”决定：让多个查询头共享。MHA（Multi-Head Attention）每个查询头有独立 K/V；MQA（Multi-Query Attention，2019）所有头共享一组，cache 最小但掉点明显；GQA（Grouped-Query Attention，2023）把查询头分成 G 组，每组共享一组 K/V。Llama-3-8B 用 32 个查询头、8 组 KV，cache 为 MHA 的四分之一；论文报告从 MHA checkpoint 继续训练约 5% 预训练算力即可恢复质量。</p>
<p>MLA（Multi-head Latent Attention，DeepSeek-V2，2024）换了维度：不共享头，而把 K/V 联合压到低维潜向量 c_KV（512 维），推理只缓存潜向量；另留 64 维 RoPE 键 k_R，因为论文认为把旋转直接作用在低秩潜空间会损害效果，这就是“解耦 RoPE”。以 32 个查询头、d=128 的 MHA 为参照，每层每 token 要存 8,192 个 K/V 元素，MLA 只需 576 个。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="四种 KV 压缩方案每层每 token 的 KV 元素数条形对比">
<text x="24" y="26" font-size="15" font-family="inherit" fill="var(--sv-ink)">每层每 token 的 KV 元素数（K 与 V 合计）</text>
<text x="170" y="66" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="end">MHA（32 头）</text>
<text x="170" y="121" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="end">GQA（8 组）</text>
<text x="170" y="176" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="end">MQA（1 组）</text>
<text x="170" y="231" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="end">MLA（512+64）</text>
<rect x="180" y="70" width="480" height="30" fill="var(--sv-a)"></rect>
<rect x="180" y="125" width="120" height="30" fill="var(--sv-a2)"></rect>
<rect x="180" y="180" width="15" height="30" fill="var(--sv-b)"></rect>
<rect x="180" y="235" width="34" height="30" fill="var(--sv-b2)"></rect>
<text x="668" y="90" font-size="12" font-family="inherit" fill="var(--sv-ink)">8,192（1×）</text>
<text x="308" y="145" font-size="12" font-family="inherit" fill="var(--sv-ink)">2,048（1/4）</text>
<text x="203" y="200" font-size="12" font-family="inherit" fill="var(--sv-ink)">256（1/32）</text>
<text x="222" y="255" font-size="12" font-family="inherit" fill="var(--sv-ink)">576（约 1/14）</text>
<line x1="180" y1="300" x2="660" y2="300" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="180" y1="300" x2="180" y2="306" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="300" y1="300" x2="300" y2="306" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="420" y1="300" x2="420" y2="306" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="660" y1="300" x2="660" y2="306" stroke="var(--sv-line)" stroke-width="1"></line>
<text x="180" y="320" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">0</text>
<text x="300" y="320" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">2,048</text>
<text x="420" y="320" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">4,096</text>
<text x="660" y="320" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">8,192</text>
<text x="24" y="342" font-size="12" font-family="inherit" fill="var(--sv-muted)">口径：每层每 token 的 K 与 V 元素总数；fp16 下字节数再乘 2。</text>
<text x="24" y="358" font-size="12" font-family="inherit" fill="var(--sv-muted)">MLA 为 DeepSeek-V2 的 512 维潜向量加 64 维解耦 RoPE 键，层数与头数不同，跨模型比较看正文表格。</text>
</svg><figcaption>图 2 · 四类方案的 KV 元素数。GQA 把 cache 压到四分之一，MQA 压到三十二分之一，MLA 用低秩潜向量达到与 MQA 同量级但质量更好的压缩。</figcaption></figure>
<p>这张图是每层每 token 的元素数，不是端到端显存。真正做容量规划时还要乘层数、乘序列长度、乘字节数，并且注意不同模型的层数与头数并不相同。下面的表格把常见配置折算到 128K，便于横向比较。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>方案</th><th>每层每 token KV 元素</th><th>相对 MHA</th><th>128K 总量（口径）</th><th>质量与代价</th></tr></thead><tbody>
<tr><td>MHA（32 头，d=128）</td><td>8,192</td><td>1×</td><td>64 GiB（32 层，fp16）</td><td>基线，cache 最大</td></tr>
<tr><td>GQA（8 组）</td><td>2,048</td><td>1/4</td><td>16 GiB（32 层，fp16）</td><td>接近 MHA，工业默认</td></tr>
<tr><td>MQA（1 组）</td><td>256</td><td>1/32</td><td>2 GiB（32 层，fp16）</td><td>质量损失明显，适合高并发小模型</td></tr>
<tr><td>MLA（512+64）</td><td>576</td><td>约 1/14</td><td>8.4 GiB（60 层，bf16）</td><td>报告质量不降反升，需结构支持</td></tr>
</tbody></table></div>
<p>MLA 行按 DeepSeek-V2 的 60 层、512+64 维计算，不能与 32 层的 Llama 配置直接比绝对值，只说明压缩比量级。论文报告相对 DeepSeek 67B 把 KV cache 降低 93%、生成吞吐提升 5.76 倍；该数字含层数、精度与实现差异，引用要带口径。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>选型顺序：先确认质量基线（GQA 最稳），再看是否需要 MQA 级极限压缩；MLA 需结构支持，不能把 MHA 权重直接转换，通常要重训。压缩比不是越大越好，长文检索的掉点常比平均困惑度更早暴露。</div></div>
</section>

<section class="sec">
<h2>把 KV 变便宜：量化、稀疏与检索</h2>
<p>KV 量化最“无痛”：FP16 换 FP8（E4M3）直接减半，INT8/INT4 再减。关键是粒度：按 token、按头、按 32 或 64 通道一组存 scale，比整张量一个 scale 稳得多。K 比 V 敏感，因为它参与 QKᵀ 决定权重；常见做法是 K 精度更高、V 更激进。量化省容量与带宽，不减少 FLOPs，对 prefill 的 N² 项没有帮助。</p>
<p>第二类是改变连接图。滑窗注意力（sliding window attention）让每个 token 只看最近 w 个位置，复杂度 O(N·w)；Mistral 7B 用 w=4096，靠 32 层堆叠把理论感受野扩到十万级，但“能影响”不等于“能取回”。全局加局部（Longformer 式）给少量全局 token 开全连接；块稀疏（BigBird 式）用对角块、随机块与全局列逼近全注意力。StreamingLLM 保留开头 4 个注意力汇（attention sink）加最近窗口即可稳定流式生成，但保住的是流畅度，不是远距离召回。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="五种注意力连接模式示意：全注意力、因果、滑窗、全局加局部、块稀疏">
<text x="24" y="24" font-size="15" font-family="inherit" fill="var(--sv-ink)">五种注意力连接模式（7×7 示意，行=查询，列=键）</text>
<text x="72" y="48" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">全注意力</text>
<text x="217" y="48" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">因果</text>
<text x="362" y="48" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">因果滑窗 w=2</text>
<text x="507" y="48" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">全局 + 局部</text>
<text x="652" y="48" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">块稀疏</text>
<rect x="30" y="58" width="84" height="84" fill="var(--sv-a)" fill-opacity="0.75" stroke="var(--sv-line)" stroke-width="1"></rect>
<path d="M175,58 L175,142 L259,142 Z" fill="var(--sv-a)" fill-opacity="0.75" stroke="var(--sv-line)" stroke-width="1"></path>
<path d="M320,58 L404,142 L368,142 L320,94 Z" fill="var(--sv-a)" fill-opacity="0.75" stroke="var(--sv-line)" stroke-width="1"></path>
<path d="M465,58 L549,142 L513,142 L465,94 Z" fill="var(--sv-a)" fill-opacity="0.75" stroke="var(--sv-line)" stroke-width="1"></path>
<rect x="465" y="58" width="12" height="84" fill="var(--sv-b)" fill-opacity="0.75" stroke="var(--sv-line)" stroke-width="1"></rect>
<rect x="610" y="58" width="24" height="24" fill="var(--sv-a)" fill-opacity="0.75" stroke="var(--sv-line)" stroke-width="1"></rect>
<rect x="634" y="82" width="24" height="24" fill="var(--sv-a)" fill-opacity="0.75" stroke="var(--sv-line)" stroke-width="1"></rect>
<rect x="658" y="106" width="24" height="24" fill="var(--sv-a)" fill-opacity="0.75" stroke="var(--sv-line)" stroke-width="1"></rect>
<rect x="682" y="130" width="12" height="12" fill="var(--sv-a)" fill-opacity="0.75" stroke="var(--sv-line)" stroke-width="1"></rect>
<rect x="634" y="130" width="12" height="12" fill="var(--sv-a)" fill-opacity="0.75" stroke="var(--sv-line)" stroke-width="1"></rect>
<rect x="610" y="58" width="12" height="84" fill="var(--sv-b)" fill-opacity="0.75" stroke="var(--sv-line)" stroke-width="1"></rect>
<text x="72" y="158" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">键位置 →</text>
<text x="18" y="100" font-size="12" font-family="inherit" fill="var(--sv-muted)" transform="rotate(-90 18 100)" text-anchor="middle">查询位置 ↓</text>
<text x="72" y="178" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">O(N²)</text>
<text x="72" y="194" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">时间与显存</text>
<text x="217" y="178" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">约一半连接</text>
<text x="217" y="194" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">训练标准</text>
<text x="362" y="178" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">O(N·w)</text>
<text x="362" y="194" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">远处不可达</text>
<text x="507" y="178" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">O(N(w+g))</text>
<text x="507" y="194" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">全局列可读写</text>
<text x="652" y="178" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">O(N)，每行块数固定</text>
<text x="652" y="194" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">需训练匹配</text>
<text x="24" y="236" font-size="12" font-family="inherit" fill="var(--sv-muted)">方块 = 允许计算的（查询, 键）对，空白 = 跳过。</text>
<text x="24" y="254" font-size="12" font-family="inherit" fill="var(--sv-muted)">滑窗与块稀疏改变连接图，不会自动获得远距离检索能力；训练掩码必须与推理一致。</text>
<text x="24" y="272" font-size="12" font-family="inherit" fill="var(--sv-muted)">检索增强不改注意力形状，而由外部检索器决定哪些块进入上下文。</text>
</svg><figcaption>图 3 · 连接图决定复杂度。滑窗和块稀疏把“全连接”换成带状或块状，但远距离信息只能靠全局 token、多层堆叠或外部检索补回。</figcaption></figure>
<p>第三类是检索增强：用检索器挑 k 个块拼进 prompt，把 O(N²) 换成“检索质量 × 小块注意力”，工程最可控；代价是召回率取决于检索器与切块，且“中间遗忘”（lost in the middle）仍在：中间信息的利用率低于开头和结尾。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>稀疏掩码必须在训练时确定。推理时临时换成滑窗，位置分布与训练不一致，短任务正常、长文检索断崖下跌。反过来训练稀疏、推理全注意力更安全，只是更贵。</div></div>
</section>

<section class="sec">
<h2>把序列切开：序列并行与 ring attention</h2>
<p>训练长序列时，单卡放不下的往往不是权重，而是每层 O(N·d) 的激活。序列并行（sequence parallelism，Megatron-LM 2022）把 LayerNorm、dropout 等逐 token 运算按序列切分，All-Gather 与 Reduce-Scatter 只发生在切分点；但 attention 每个头仍需看到完整序列，所以还要上下文并行（context parallelism）切开序列维。</p>
<p>Ring attention（2023）最直观：P 张卡各持一段 Q（N/P 个 token）和一段 K/V；每步用本地 Q 块乘当前 K/V 块，算完把 K/V 发给下一张卡，P 步后每个 Q 块都见过全部 K/V。块级 online softmax 累加使结果与全注意力等价，显存从 O(N) 降到 O(N/P)。通信每卡每层 O(N·d)，计算 O(N²·d/P)，算当前块时预取下一块即可重叠。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="Ring attention 的四卡通信环与计算通信重叠时间线">
<defs><marker id="long-context-ring-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="var(--sv-b)"></path></marker></defs>
<text x="24" y="26" font-size="15" font-family="inherit" fill="var(--sv-ink)">Ring attention：K/V 块绕环传递，与分块计算重叠</text>
<rect x="170" y="62" width="150" height="64" rx="4" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="1.5"></rect>
<rect x="440" y="62" width="150" height="64" rx="4" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="1.5"></rect>
<rect x="440" y="230" width="150" height="64" rx="4" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="1.5"></rect>
<rect x="170" y="230" width="150" height="64" rx="4" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="1.5"></rect>
<text x="182" y="84" font-size="12" font-family="inherit" fill="var(--sv-ink)">GPU 0 · Q 块 0</text>
<text x="182" y="102" font-size="12" font-family="inherit" fill="var(--sv-muted)">缓存 K/V 块 0</text>
<text x="182" y="118" font-size="12" font-family="inherit" fill="var(--sv-muted)">显存 O(N/P)</text>
<text x="452" y="84" font-size="12" font-family="inherit" fill="var(--sv-ink)">GPU 1 · Q 块 1</text>
<text x="452" y="102" font-size="12" font-family="inherit" fill="var(--sv-muted)">缓存 K/V 块 1</text>
<text x="452" y="118" font-size="12" font-family="inherit" fill="var(--sv-muted)">显存 O(N/P)</text>
<text x="452" y="252" font-size="12" font-family="inherit" fill="var(--sv-ink)">GPU 2 · Q 块 2</text>
<text x="452" y="270" font-size="12" font-family="inherit" fill="var(--sv-muted)">缓存 K/V 块 2</text>
<text x="452" y="286" font-size="12" font-family="inherit" fill="var(--sv-muted)">显存 O(N/P)</text>
<text x="182" y="252" font-size="12" font-family="inherit" fill="var(--sv-ink)">GPU 3 · Q 块 3</text>
<text x="182" y="270" font-size="12" font-family="inherit" fill="var(--sv-muted)">缓存 K/V 块 3</text>
<text x="182" y="286" font-size="12" font-family="inherit" fill="var(--sv-muted)">显存 O(N/P)</text>
<line x1="320" y1="94" x2="432" y2="94" stroke="var(--sv-b)" stroke-width="2" marker-end="url(#long-context-ring-arrow)"></line>
<line x1="515" y1="126" x2="515" y2="222" stroke="var(--sv-b)" stroke-width="2" marker-end="url(#long-context-ring-arrow)"></line>
<line x1="440" y1="262" x2="328" y2="262" stroke="var(--sv-b)" stroke-width="2" marker-end="url(#long-context-ring-arrow)"></line>
<line x1="245" y1="230" x2="245" y2="134" stroke="var(--sv-b)" stroke-width="2" marker-end="url(#long-context-ring-arrow)"></line>
<text x="380" y="150" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">每卡持有 N/P 个 Q</text>
<text x="380" y="168" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">K/V 块沿环传递 P 步</text>
<text x="380" y="186" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">第 s 步：Q_i 与第 (i+s) mod P 块 K/V</text>
<text x="380" y="204" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">发送与下一块计算重叠</text>
<text x="80" y="334" font-size="12" font-family="inherit" fill="var(--sv-ink)">GPU 0 时间线</text>
<rect x="200" y="318" width="90" height="22" fill="var(--sv-a2)"></rect>
<rect x="290" y="318" width="35" height="22" fill="var(--sv-b)"></rect>
<rect x="325" y="318" width="90" height="22" fill="var(--sv-a2)"></rect>
<rect x="415" y="318" width="35" height="22" fill="var(--sv-b)"></rect>
<rect x="450" y="318" width="90" height="22" fill="var(--sv-a2)"></rect>
<rect x="540" y="318" width="35" height="22" fill="var(--sv-b)"></rect>
<rect x="575" y="318" width="90" height="22" fill="var(--sv-a2)"></rect>
<text x="245" y="333" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">计算</text>
<text x="307" y="333" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">发送</text>
<text x="370" y="333" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">计算</text>
<text x="432" y="333" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">发送</text>
<text x="495" y="333" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">计算</text>
<text x="557" y="333" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">发送</text>
<text x="620" y="333" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">计算</text>
<text x="80" y="368" font-size="12" font-family="inherit" fill="var(--sv-muted)">发送与下一块计算重叠（图中按阶段展开示意）；P 越大，每卡算术强度越低。</text>
</svg><figcaption>图 4 · Ring attention 的通信环。每张卡只保存一段 Q 与 K/V，K/V 块顺时针传递；分块计算与下一块传输重叠，因果场景需交错分配以均衡负载。</figcaption></figure>
<p>算术强度随 P 增大而下降：每卡计算少了，要收的 K/V 没变。所以 P 不是越大越好，每卡至少要分到足够大的块（经验上几千到上万 token，视带宽与 kernel 而定），否则通信盖不住。因果注意力还带来负载不均，开头附近的 Q 块只看很少 K/V；工程上用 zig-zag 或交错分配，让每卡兼有轻块和重块。</p>
<p>另一条路线是 DeepSpeed-Ulysses 式 All-to-All：先按序列切分，attention 前转成按头切分，算完再转回。它适合 NVLink 域内、头数较多的模型。选哪种取决于拓扑与框架支持，二者主流框架都有实现；不要自己手写通信环，除非你在做框架本身。</p>
<p>补个量级：P=8、N=128K、32 层，按 Llama-3-8B 的 GQA 口径（8 个 KV 头、d=128、fp16），每卡在 P 步里累计收到相当于整条序列的 K/V，即 N × 2 × 8 × 128 × 2 B × 32 ≈ 16 GiB（单次前向粗算，与后面的 128K 账本一致）。H100 的 NVLink 4 双向 900 GB/s、单向约 450 GB/s，折合约 38 ms；每卡分摊到的注意力计算约 1.1 PFLOP（全矩阵口径、32 层合计），按数百 TFLOPS 的有效算力需要数秒，通信仍可被隐藏。若模型用 MQA（单 KV 头），通信量降到约 2 GiB。换到 PCIe 或跨节点要按实际带宽重算，数字随实现与拓扑变化，务必实测。</p>
</section>

<section class="sec">
<h2>长上下文训练：数据配比比并行更难</h2>
<p>改好 RoPE、跑通 ring attention 只解决“能算”；能否用上 128K，取决于数据里有没有值得看 128K 的信号。最常见的错误是把短文档首尾拼成“长样本”：位置跨度够了，但跨文档没有依赖，模型学会的是忽略远处 token，长文检索反而更差。</p>
<p>有效数据通常含几类：原生长文档（书籍、报告、论文）、跨文件依赖的代码仓库、多文档综合问答、合成的检索与聚合任务（答案放随机位置，强迫精确取回）。配比没有通用公式，取决于基座与场景；原则是让远处信息成为预测下一个 token 的必要条件，而不是可忽略的噪声。打包（packing）要用文档边界掩码，阻止跨文档注意力，否则等于制造虚假的长距离依赖。</p>
<p>流程通常是继续预训练加课程：先在原生长度稳定，再用少量长数据配合 RoPE 缩放扩到目标长度，最后用长文指令数据对齐。长度不是越大越好：训练长度决定位置分布，推理超出仍靠外推，质量会打折。重复段落会让模型学会抄最近内容，表现为高召回、低推理。</p>
<div class="callout callout--story"><span class="callout__label">案例</span><div>模型在 128K 大海捞针上接近满分，但给它一份 100K 的合同问“第三条和第七条的违约责任是否冲突”，却答不出来。前者只需局部匹配，后者要求跨距离比较与整合；缺的是后一类监督，不是上下文窗口。</div></div>
</section>

<section class="sec">
<h2>128K 算例、评测与排障</h2>
<h3>一个可复算的 128K 显存账本</h3>
<p>以 Llama-3-8B（32 层、8 个 KV 头、d=128、词表 128,256）、单请求、fp16、NVIDIA H100 80GB 为例。权重约 16 GB；KV cache 每 token 128 KiB，128K 合计 16 GiB；前向 FLOPs 按全矩阵口径约 11 PFLOP、计入因果掩码约 6.6 PFLOP，按 989 TFLOPS 峰值、50% MFU 估算约 13–22 秒。若物化全部 128K 位置的 logits，128K × 128,256 × 2 B ≈ 33.6 GB，直接压垮显存，所以必须分块 prefill、只留最后一个 token 的 logits，训练用融合交叉熵。</p>
<div class="formula">显存 ≈ 权重 16 GB + KV 16 GiB + 激活与 workspace（视实现，约 5-15 GB）+ 分块 logits（2K 一块约 0.5 GB）
解码 KV 带宽下界 ≈ 16 GiB / 3.35 TB/s ≈ 5 ms/token（batch 大、KV 主导时；batch=1 还要读 16 GB 权重，约 10 ms/token）
同样配置放到 1M token：KV cache ≈ 128 GiB，单卡放不下</div>
<p>这张账本说明三件事。第一，24 GB 的 RTX 4090 光权重加 KV 就要约 33 GB，128K 不是“量化权重就能跑”——KV 才是大头。第二，decode 每 token 至少要把 16 GiB KV 从 HBM 读一遍，H100 上约 5 ms；batch=1 时还要读 16 GB 权重，实际接近 10 ms/token，且会被 kernel 效率与采样进一步拖慢。batch 增大摊薄权重读取，但 KV 读取线性增长。第三，1M 在 8B 上仅 KV 约 128 GiB，必须靠 MLA、量化、多卡切分，或不该全放进注意力。</p>
<p>排障顺序建议固定：先看 KV cache 是否超预算（2 × 层数 × KV 头 × 头维 × 长度 × 字节），再看 logits 与激活，最后才怀疑 attention kernel。OOM 时不要第一反应调小 batch，长上下文场景下 batch 往往已经是 1。</p>
<h3>“支持 128K”不等于“用好 128K”</h3>
<p>单针大海捞针（Needle-in-a-Haystack, NIAH）只证明模型能在某位置匹配片段，且容易被训练数据“教会”。更有信息量的是多针、多跳、聚合与排序：RULER（2024）用检索、多跳追踪、聚合、问答四类合成任务测有效上下文长度，发现多数模型可用长度显著短于宣称值；LongBench 与 ZeroSCROLLS 提供真实长文任务；“中间遗忘”要求扫位置维度，而非只测首尾。</p>
<p>评测至少包含：目标长度与超出训练长度两组；信息放开头、中间、结尾；单针与多针；跨段聚合题；以及成本口径（首 token 延迟、每 token 成本）。Gemini 1.5 技术报告（2024）在 1M token 级别报告超过 99% 的单针召回，并把研究性上限推到 10M，但强调“有效使用”依赖任务，这正是要分开测召回与推理的原因。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>评测</th><th>测什么</th><th>局限</th></tr></thead><tbody>
<tr><td>单针 NIAH</td><td>指定位置取回一个片段</td><td>易饱和，不代表推理能力</td></tr>
<tr><td>多针、多跳</td><td>同时取多个片段并组合</td><td>合成分布，需搭配真实任务</td></tr>
<tr><td>RULER</td><td>检索、追踪、聚合、问答</td><td>合成任务，长度阈值影响结论</td></tr>
<tr><td>LongBench、ZeroSCROLLS</td><td>真实长文问答、摘要、代码</td><td>任务与语言覆盖有限</td></tr>
<tr><td>位置扫描</td><td>同一证据放不同深度</td><td>需控制变量，评测成本高</td></tr>
</tbody></table></div>
<h3>常见误区</h3>
<ul>
<li>把 max_model_len 调大就以为支持长上下文：位置编码、训练分布、KV 容量三者缺一不可。</li>
<li>只测困惑度：长文任务的质量退化在平均 loss 上常常只有千分位的差别。</li>
<li>忽略位置偏置：同样的证据放在中间，准确率可能低十几个点。</li>
<li>把稀疏或滑窗当成免费午餐：连接图变了，训练没跟上就会掉点。</li>
<li>用小 batch 短 prompt 测吞吐：长上下文的成本几乎全在 prefill 的平方项和 decode 的 KV 带宽上。</li>
</ul>
<pre class="code" data-lang="bash"><code># 1) 先确认模型原生长度与 RoPE 配置（字段名随 transformers 版本变化）
python -c "from transformers import AutoConfig; c=AutoConfig.from_pretrained('meta-llama/Meta-Llama-3-8B-Instruct'); print(c.max_position_embeddings, getattr(c, 'rope_scaling', None))"

# 2) Llama-3-8B 原生只有 8K；要到 128K 必须显式配置 RoPE 外推。
#    只调 --max-model-len 而不配 rope-scaling，引擎会拒绝或沿用错误的位置角度。
#    JSON 里的 rope_type 在旧版 vLLM 中叫 type，参数名以实际版本文档为准。
#    factor 与 original_max_position_embeddings 必须与权重训练时一致，这里 16 × 8192 = 131072 仅为示意。
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Meta-Llama-3-8B-Instruct \
  --rope-scaling '{"rope_type": "yarn", "factor": 16.0, "original_max_position_embeddings": 8192}' \
  --max-model-len 131072 \
  --kv-cache-dtype fp8 \
  --enable-chunked-prefill \
  --gpu-memory-utilization 0.90

# 3) 观察显存水位；fp8 KV cache 需要 Ada 或 Hopper 及以上的卡
nvidia-smi --query-gpu=name,memory.used,memory.total --format=csv -l 1</code></pre>
<h3>自测</h3>
<details class="quiz"><summary>Q1 · 为什么 8B 模型大约在 3 万 token 处，注意力计算量超过其余部分？</summary><div class="quiz__a">注意力是 4N²dHL，其余部分是 2NP。令二者相等得 N ≈ 2P/(4dHL) = P/(2dHL)，代入 P=8×10⁹、d=128、H=32、L=32，得到约 3.05×10⁴。这里按完整矩阵计；因果掩码只算约一半元素，注意力项减半，交叉点后移到约 6.1×10⁴，仍是数万量级。平方项在短序列时被系数压住，超过交叉点后增长更快，所以 128K 时注意力反而占大头。</div></details>
<details class="quiz"><summary>Q2 · GQA 与 MLA 都在压缩 KV，本质区别是什么？</summary><div class="quiz__a">GQA 让多个查询头共享同一组 K/V 头，cache 大小约为 MHA 的 1/G，结构简单，可以直接从 MHA 权重继续训练。MLA 把 K/V 联合投影到低秩潜向量，并在潜空间之外单独保留 RoPE 键，cache 存的是潜向量而不是完整的 K/V；它需要模型结构支持，不能把现成 MHA 权重直接转换，换来的压缩比与质量通常更好。</div></details>
<details class="quiz"><summary>Q3 · Ring attention 中把卡数 P 翻倍，为什么不一定更快？</summary><div class="quiz__a">每卡计算量是 O(N²d/P)，但通信量 O(Nd) 不随 P 下降，算术强度因此降低。P 过大时每卡分到的块太小，kernel 效率下降、通信与启动开销占比上升；因果注意力还会造成负载不均。需要保证每卡有足够大的块，并用 zig-zag 分配均衡冷热块。</div></details>
<details class="quiz"><summary>Q4 · 模型在 128K 单针大海捞针上满分，能否说明它真的能用好 128K？</summary><div class="quiz__a">不能。单针只要求局部匹配，位置和内容分布都很窄，容易被训练数据覆盖。要测多针、多跳、跨段聚合、位置扫描，以及在超出训练长度的输入上的表现。RULER 等工作正是用这些任务区分“宣称长度”和“有效长度”，Gemini 1.5 报告也把召回与推理能力分开讨论。</div></details>
<h3>延伸阅读</h3>
<ul class="refs">
<li><b>RoFormer: Enhanced Transformer with Rotary Position Embedding</b> — Jianlin Su 等, 2021（arXiv:2104.09864）。RoPE 原始论文，相对位置性质的推导与实验。</li>
<li><b>YaRN: Efficient Context Window Extension of Large Language Models</b> — Bowen Peng 等, 2023（arXiv:2309.00071）。NTK-by-parts、温度缩放与 128K 扩展的完整配方。</li>
<li><b>Ring Attention with Blockwise Transformers for Near-Infinite Context</b> — Hao Liu, Matei Zaharia, Pieter Abbeel, 2023（arXiv:2310.01889）。环状 K/V 传递与分块计算重叠的原始设计。</li>
<li><b>DeepSeek-V2: A Strong, Economical, and Efficient Mixture-of-Experts Language Model</b> — DeepSeek-AI, 2024（arXiv:2405.04434）。MLA 与解耦 RoPE 的结构、KV cache 压缩与吞吐数据。</li>
<li><b>Gemini 1.5: Unlocking multimodal understanding across millions of tokens of context</b> — Gemini Team, Google, 2024（arXiv:2403.05530）。1M 到 10M 上下文的系统报告与长文评测方法。</li>
</ul>
</section>
`
};
