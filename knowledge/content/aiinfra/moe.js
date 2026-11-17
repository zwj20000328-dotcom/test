window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["moe"] = {
  slug: "moe",
  title: "MoE：稀疏激活的训练与推理",
  subtitle: "用参数换质量，用路由换算力",
  level: 6,
  cluster: "前沿",
  tags: ["MoE", "Expert Parallel", "DeepSeek-V3"],
  summary: "MoE 用路由让每 token 只激活少数专家，使总参数与计算解耦。本篇讲 gating、容量与丢 token、负载均衡、EP all-to-all、训练稳定性与推理显存。",
  keyPoints: [
    "MoE 只把 FFN 换成 E 个专家，每 token 选 k 个，总参数随 E 增长而单 token 计算只随 k 增长",
    "capacity factor 决定每个专家的缓冲上限，太小会丢 token，太大会浪费算力和显存",
    "辅助损失用梯度压均衡，DeepSeek-V3 改用不参与反传的专家偏置，避免和语言建模目标抢梯度",
    "EP 每层两次 all-to-all，每 token 每方向流量约 k×H×b 字节，跨节点 IB 是主要瓶颈",
    "推理显存按总参数算：DeepSeek-V3 FP8 约 671 GB，单台 8×H800 没有余量，实用至少 16 卡"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>先给直觉：参数可以很多，计算只走一小撮</h2>
<p>稠密（dense）Transformer 的每一层 FFN 对每个 token 都做同样多的矩阵乘：参数越多，每个 token 的浮点运算（FLOPs）就越多，显存和算力一起涨。混合专家（Mixture-of-Experts, MoE）把一层 FFN 拆成 E 个并行的“专家”，每个 token 只被路由到其中 k 个。于是<mark>总参数</mark>可以随 E 增长，而<mark>单 token 计算量</mark>只随 k 增长，这就是参数与计算的解耦。</p>
<p>历史线索很短：Shazeer 等人在 2017 年用稀疏门控把 LSTM 语言模型做到 137B 参数；GShard（2020）把 top-2 路由和容量因子带到 600B 的翻译模型；Switch Transformer（2021）用 top-1 路由把规模推到 1.6T；Mixtral（2024）证明 8 专家、top-2 的开放模型可以实用；DeepSeek-V3（2024）用 671B 总参数、37B 激活参数和 256 个路由专家，把这一路线推到当前前沿。它们的共同点不是“更多参数”，而是“让每个 token 只碰一小部分参数”。</p>
<p>先记住三个量：总参数 P、每 token 激活参数 P_act、专家数 E 与选择数 k。MoE 的容量上限主要由 P 决定，单 token 的算力和带宽由 P_act 决定，而通信和负载均衡由 E、k 与并行方式决定。后面所有工程问题，都是这三者之间的拉扯。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>MoE 像一家有 256 位专科医生、但每次只叫 8 位会诊的医院：知识面按 256 人配置，单次诊疗成本按 8 人结算。难点不在“请谁”，而在“分诊要准、候诊要均匀、会诊室之间跑得够快”。</div></div>
</section>

<section class="sec">
<h2>MoE 层的数据流：gating、top-k 与加权求和</h2>
<p>标准 Transformer 每层由一个注意力子层和一个 FFN 子层组成。MoE 只改 FFN：把原来的一个大 FFN 换成 E 个小 FFN（专家），再加一个路由网络（router，也叫 gate）。注意力、LayerNorm、残差结构都不变。对 token 向量 x（维度 H），router 先算每个专家的打分，再取分数最高的 k 个，归一化后作为权重，最后把选中专家的输出加权求和。</p>
<p>打分函数有两类常见写法。早期工作用 softmax over experts 再取 top-k；DeepSeek-V3 用 sigmoid 打分，再对选中的 k 个分数做归一化。两者都能工作，区别在于 softmax 让所有专家共享一个分母，sigmoid 让每个专家独立判断“我是否适合这个 token”，路由更灵活，但也更需要偏置修正来防坍缩。top-k 的 k 通常取 1、2、4、8：k 越大，质量越稳，单 token 计算和 all-to-all 流量也按 k 线性增长。</p>
<p>DeepSeek-V3 还保留了一个<mark>共享专家</mark>（shared expert）：所有 token 都经过它，不参与路由；256 个路由专家中每个 token 选 8 个。共享专家承担通用知识，路由专家承担特化知识，这样路由专家不必再重复学习基础能力，负载也更稳。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="MoE 层数据流：token 经路由与 top-k 选择专家，加权求和后输出">
<defs>
<marker id="moe-arrow-1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
<path d="M 0 0 L 10 5 L 0 10 Z" fill="var(--sv-muted)"></path>
</marker>
</defs>
<text x="20" y="28" font-size="14" fill="var(--sv-ink)" font-family="inherit">MoE 层：只计算被选中的 k 个专家</text>
<rect x="20" y="150" width="92" height="76" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="66" y="180" font-size="14" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">x</text>
<text x="66" y="202" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">[T × H]</text>
<rect x="140" y="140" width="118" height="96" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></rect>
<text x="199" y="168" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Router</text>
<text x="199" y="190" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">s = σ(uᵀeᵢ)</text>
<text x="199" y="212" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">逐专家打分</text>
<rect x="288" y="145" width="100" height="86" rx="6" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-width="2"></rect>
<text x="338" y="172" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Top-k</text>
<text x="338" y="194" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">k = 8</text>
<text x="338" y="216" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">分数归一化</text>
<rect x="430" y="42" width="112" height="48" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></rect>
<text x="486" y="71" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">专家 E0</text>
<rect x="430" y="104" width="112" height="48" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></rect>
<text x="486" y="133" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">专家 E1</text>
<rect x="430" y="166" width="112" height="48" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></rect>
<text x="486" y="195" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">专家 E254</text>
<rect x="430" y="228" width="112" height="48" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></rect>
<text x="486" y="257" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">专家 E255</text>
<text x="486" y="296" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">共 256 个路由专家</text>
<rect x="430" y="310" width="112" height="44" rx="6" fill="var(--sv-panel)" stroke="var(--sv-c)" stroke-width="2"></rect>
<text x="486" y="337" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">共享专家</text>
<rect x="590" y="140" width="140" height="96" rx="6" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-width="2"></rect>
<text x="660" y="170" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">加权求和</text>
<text x="660" y="192" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">y = Σ gᵢEᵢ(x)</text>
<text x="660" y="214" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">输出到下一层</text>
<path d="M 112 188 L 136 188" stroke="var(--sv-muted)" stroke-width="1.5" fill="none" marker-end="url(#moe-arrow-1)"></path>
<path d="M 258 188 L 284 188" stroke="var(--sv-muted)" stroke-width="1.5" fill="none" marker-end="url(#moe-arrow-1)"></path>
<path d="M 388 188 L 426 66" stroke="var(--sv-a)" stroke-width="1.5" fill="none" marker-end="url(#moe-arrow-1)"></path>
<path d="M 388 188 L 426 128" stroke="var(--sv-a)" stroke-width="1.5" fill="none" marker-end="url(#moe-arrow-1)"></path>
<path d="M 388 188 L 426 190" stroke="var(--sv-a)" stroke-width="1.5" fill="none" marker-end="url(#moe-arrow-1)"></path>
<path d="M 388 188 L 426 252" stroke="var(--sv-a)" stroke-width="1.5" fill="none" marker-end="url(#moe-arrow-1)"></path>
<path d="M 542 66 L 586 164" stroke="var(--sv-b)" stroke-width="1.5" fill="none" marker-end="url(#moe-arrow-1)"></path>
<path d="M 542 128 L 586 172" stroke="var(--sv-b)" stroke-width="1.5" fill="none" marker-end="url(#moe-arrow-1)"></path>
<path d="M 542 190 L 586 190" stroke="var(--sv-b)" stroke-width="1.5" fill="none" marker-end="url(#moe-arrow-1)"></path>
<path d="M 542 252 L 586 206" stroke="var(--sv-b)" stroke-width="1.5" fill="none" marker-end="url(#moe-arrow-1)"></path>
<path d="M 66 226 L 66 332 L 426 332" stroke="var(--sv-c)" stroke-width="1.5" fill="none" marker-end="url(#moe-arrow-1)"></path>
<path d="M 542 332 L 660 332 L 660 240" stroke="var(--sv-c)" stroke-width="1.5" fill="none" marker-end="url(#moe-arrow-1)"></path>
<text x="330" y="124" font-size="12" fill="var(--sv-muted)" font-family="inherit">dispatch：只发给 top-k</text>
<text x="330" y="276" font-size="12" fill="var(--sv-muted)" font-family="inherit">未选中专家不读权重、不做矩阵乘</text>
<text x="20" y="372" font-size="12" fill="var(--sv-muted)" font-family="inherit">共享专家对所有 token 生效，路由专家只对被选中的 token 生效（DeepSeek-V3 结构）。</text>
</svg>
<figcaption>图 1 · MoE 层数据流：router 打分、top-k 选择、专家并行计算，最后按门控权重求和；共享专家是常开分支。</figcaption>
</figure>
<div class="formula">y = Σ_{i∈TopK(s)} g_i · E_i(x)，g_i = s_i / Σ_{j∈TopK(s)} s_j
DeepSeek-V3：s_i = Sigmoid(uᵀe_i)，K = 8，路由专家 256 个，另有 1 个共享专家</div>
<p>注意“稀疏”发生在专家维度，而不是 token 维度：一个 batch 里所有 token 都会参与计算，只是每个 token 只激活 k 个专家。因此 MoE 不会减少参数量，反而增加总参数；它减少的是每个 token 的<mark>有效计算量</mark>。这也是为什么 MoE 模型的显存需求通常比同激活量的稠密模型大得多。</p>
</section>

<section class="sec">
<h2>capacity factor 与 token drop：把动态路由装进静态张量</h2>
<p>路由结果是数据相关的：同一个 batch 里，某个专家可能分到 300 个 token，另一个只分到 80 个。但 GPU 上的分组矩阵乘（grouped GEMM）需要事先知道每个专家的缓冲区大小，于是工程上给每个专家设一个容量上限（expert capacity）。常见口径是 capacity = capacity_factor × (T × k / E)，其中 T 是 batch 内 token 数，E 是专家数，capacity_factor 是人为放大的系数。</p>
<p>举例：T=8192、k=8、E=256、capacity_factor=1.25，则每个专家容量为 1.25 × 8192 × 8 / 256 = 320 个 token。均匀负载下每个专家平均只有 256 个，320 留出了 25% 的余量。如果某个专家实际收到 400 个 token，超出的 80 个就被丢弃（token drop），通常让这些 token 只走残差连接，相当于这一层没做 FFN。容量因子越小，显存和计算越省，但丢弃越多；越大，浪费越多。训练时常见 1.0 到 2.0，推理时可以根据服务等级目标（SLA）调整。</p>
<p>token drop 是 MoE 特有的质量风险：被丢弃的 token 梯度变弱，长尾知识学不到，而且丢弃是动态的，同一个 token 在不同 step 可能被丢或不被丢，训练信号带噪声。GShard 和 Switch 都用 capacity factor 控制这一取舍；DeepSeek-V3 在训练中不丢弃 token（dropless），也不在路由后按容量裁剪，而是靠负载均衡让各专家的接收量尽量接近。是否丢弃、丢弃率多少，是排查 MoE 训练质量时必看的指标。</p>
<div class="formula">capacity = capacity_factor × (T × k / E)
例：T=8192，k=8，E=256，capacity_factor=1.25 → capacity=320 token/专家</div>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>capacity factor 不是越大越好。它按最坏情况预留缓冲区，放大 2 倍意味着最坏情况下的填充计算和激活显存也接近翻倍，而这些算力大部分花在填充（padding）上。先看每个专家的实际 token 数分布，再决定系数；如果分布本身很偏，应该先修路由均衡，而不是继续加大容量。</div></div>
</section>

<section class="sec">
<h2>负载均衡：辅助损失与 DeepSeek-V3 的偏置修正</h2>
<p>路由有一个自我强化的倾向：某个专家早期碰巧多接了一些 token，它的梯度更新更多、表征更好，下一轮 router 更愿意把 token 给它，最后少数专家吃掉大部分流量，其余专家“饿死”。这叫专家坍缩（expert collapse），表现为路由熵下降、专家利用率严重不均、有效参数量远小于总参数量。</p>
<p>经典解法是加辅助损失（auxiliary loss）。以 Switch/GShard 的形式为例，定义 f_i 为分给专家 i 的 token 比例，P_i 为 router 给专家 i 的平均概率，则 L_aux = α · E · Σ_i f_i · P_i。均匀时 Σ f_i P_i = 1/E，损失为 α；越不均匀，损失越大。它对 router 施加“往均匀走”的梯度。问题是辅助损失和语言建模目标并不总一致：α 太小不足以均衡，太大伤质量，而且它把“负载”变成了一个需要调的超参。</p>
<p>DeepSeek-V3 换了个思路：<mark>无辅助损失的负载均衡</mark>（auxiliary-loss-free load balancing）。给每个专家维护一个偏置 b_i，只在“选 top-k”时加到打分上：s'_{t,i} = s_{t,i} + b_i；但算加权系数时仍用原始 s。每个训练 step 结束后，按负载误差更新偏置：b_i ← b_i + γ · sign(e_i)，其中 e_i 是平均每专家负载减去该专家的实际负载。某个专家过载，e_i 为负，b_i 下调，下一 step 它被选中的概率降低；欠载则相反。γ 取 0.001（前 14.3T token），最后 500B token 设为 0，让路由稳定下来。DeepSeek-V3 只保留一个权重 0.0001 的序列级辅助损失，主要靠这个偏置维持均衡。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="专家负载分布对比：均衡路由与专家坍缩，容量线以上的 token 被丢弃">
<text x="20" y="28" font-size="14" fill="var(--sv-ink)" font-family="inherit">专家负载分布：均衡 vs 坍缩（示意）</text>
<rect x="480" y="44" width="14" height="14" fill="var(--sv-a)"></rect>
<text x="502" y="56" font-size="12" fill="var(--sv-ink)" font-family="inherit">均衡路由</text>
<rect x="480" y="68" width="14" height="14" fill="var(--sv-b)"></rect>
<text x="502" y="80" font-size="12" fill="var(--sv-ink)" font-family="inherit">专家坍缩</text>
<line x1="620" y1="75" x2="646" y2="75" stroke="var(--sv-c)" stroke-width="2" stroke-dasharray="5 4"></line>
<text x="654" y="79" font-size="12" fill="var(--sv-muted)" font-family="inherit">容量</text>
<line x1="70" y1="300" x2="720" y2="300" stroke="var(--sv-line)" stroke-width="1.5"></line>
<line x1="70" y1="242" x2="720" y2="242" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"></line>
<line x1="70" y1="185" x2="720" y2="185" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"></line>
<line x1="70" y1="128" x2="720" y2="128" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"></line>
<line x1="70" y1="70" x2="720" y2="70" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"></line>
<text x="60" y="304" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">0</text>
<text x="60" y="246" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">600</text>
<text x="60" y="189" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">1200</text>
<text x="60" y="132" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">1800</text>
<text x="60" y="74" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">2400</text>
<rect x="86" y="200" width="22" height="100" fill="var(--sv-a)"></rect>
<rect x="112" y="238" width="22" height="62" fill="var(--sv-b)"></rect>
<rect x="167" y="204" width="22" height="96" fill="var(--sv-a)"></rect>
<rect x="193" y="244" width="22" height="56" fill="var(--sv-b)"></rect>
<rect x="248" y="198" width="22" height="102" fill="var(--sv-a)"></rect>
<rect x="274" y="90" width="22" height="210" fill="var(--sv-b)"></rect>
<rect x="329" y="203" width="22" height="97" fill="var(--sv-a)"></rect>
<rect x="355" y="251" width="22" height="49" fill="var(--sv-b)"></rect>
<rect x="410" y="200" width="22" height="100" fill="var(--sv-a)"></rect>
<rect x="436" y="238" width="22" height="62" fill="var(--sv-b)"></rect>
<rect x="491" y="205" width="22" height="95" fill="var(--sv-a)"></rect>
<rect x="517" y="244" width="22" height="56" fill="var(--sv-b)"></rect>
<rect x="572" y="199" width="22" height="101" fill="var(--sv-a)"></rect>
<rect x="598" y="90" width="22" height="210" fill="var(--sv-b)"></rect>
<rect x="653" y="202" width="22" height="98" fill="var(--sv-a)"></rect>
<rect x="679" y="213" width="22" height="87" fill="var(--sv-b)"></rect>
<line x1="70" y1="177" x2="720" y2="177" stroke="var(--sv-c)" stroke-width="2" stroke-dasharray="6 4"></line>
<text x="380" y="171" font-size="12" fill="var(--sv-muted)" font-family="inherit">capacity = 1280</text>
<text x="285" y="82" font-size="12" fill="var(--sv-ink)" font-family="inherit">超出部分被丢弃</text>
<path d="M 310 88 L 286 108" stroke="var(--sv-muted)" stroke-width="1.2" fill="none"></path>
<text x="101" y="322" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">E0</text>
<text x="182" y="322" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">E1</text>
<text x="263" y="322" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">E2</text>
<text x="344" y="322" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">E3</text>
<text x="425" y="322" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">E4</text>
<text x="506" y="322" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">E5</text>
<text x="587" y="322" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">E6</text>
<text x="668" y="322" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">E7</text>
<text x="395" y="356" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">每个专家分到的 token 数（示意：T=4096，k=2，E=8，capacity_factor=1.25）</text>
</svg>
<figcaption>图 2 · 专家负载分布：均衡路由下各专家接近均值；坍缩时少数专家越过容量线，超出的 token 被丢弃。</figcaption>
</figure>
<div class="formula">L_aux = α · E · Σ_{i=1}^{E} f_i · P_i
f_i = (1/(T·k)) Σ_t 1[i ∈ TopK(t)]，P_i = (1/T) Σ_t p_{t,i}
偏置更新：b_i ← b_i + γ · sign(e_i)，e_i = 平均负载 − 该专家负载（过载为负）
γ = 0.001（前 14.3T token），最后 500B token 置 0</div>
<p>两种方法的分工值得记住：辅助损失改的是 router 的梯度，偏置修正改的是路由的决策边界，后者不参与反向传播，因此不会和语言建模目标抢梯度。代价是偏置需要额外的状态和同步，而且 γ 要随训练阶段衰减；如果一直用大 γ，路由会持续抖动，专家难以收敛。</p>
</section>

<section class="sec">
<h2>专家并行：all-to-all 把 token 送到专家门口</h2>
<p>当总专家数超过单卡显存，就要把专家分到不同 GPU 上，这叫专家并行（Expert Parallelism, EP）。EP 与数据并行（Data Parallel, DP）、张量并行（Tensor Parallel, TP）的切分对象不同：DP 复制模型、切数据；TP 切单层矩阵；EP 切<mark>专家集合</mark>。一个 EP 组有 N 张卡，每张卡持有 E/N 个专家，但每张卡上的 token 可能被路由到任意专家，于是需要一次 all-to-all：每张卡把 token 发给拥有目标专家的卡，算完再 all-to-all 收回来。</p>
<p>所以一个 MoE 层有两次集合通信：dispatch all-to-all 和 combine all-to-all。前者发送 token 的隐藏状态，后者发送专家输出，数据量相同。若 hidden 为 H、精度为 b 字节、每 token 选 k 个专家，则每个 token 每方向约 k × H × b 字节。以 DeepSeek-V3 的 H=7168、k=8、FP8（1 字节）估算，每 token 每方向约 56 KiB；一个 4096 token 的 batch 全组累计就是约 224 MiB，单层一个方向。61 层累计到十几 GB 的量级。</p>
<p>这就是 MoE 的通信瓶颈：all-to-all 的数据量随 k 和 H 线性增长，而且消息碎、目的地分散，延迟往往比带宽更先成为问题。跨节点走 IB（InfiniBand，H800 每 GPU 约 400 Gbps，单向约 50 GB/s），节点内走 NVLink（双向 400 GB/s，单向约 200 GB/s），单向带宽仍是 IB 的约 4 倍。DeepSeek-V3 用<mark>节点受限路由</mark>（node-limited routing）：每个 token 最多被路由到 4 个节点，先把候选专家按节点聚合，减少跨节点流量；再用 DualPipe 把通信和计算重叠起来。集合通信本身的 ring/tree 算法不在这里展开，见《集合通信》一篇。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="专家并行 all-to-all：每张 GPU 持有部分专家，token 通过交换网络发送和收回">
<defs>
<marker id="moe-arrow-2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
<path d="M 0 0 L 10 5 L 0 10 Z" fill="var(--sv-a)"></path>
</marker>
</defs>
<text x="20" y="28" font-size="14" fill="var(--sv-ink)" font-family="inherit">专家并行：每层两次 all-to-all</text>
<rect x="30" y="48" width="160" height="84" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></rect>
<text x="110" y="72" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU 0</text>
<text x="110" y="94" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">专家 E0, E4, …</text>
<text x="110" y="116" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">注意力 TP 分片</text>
<rect x="210" y="48" width="160" height="84" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></rect>
<text x="290" y="72" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU 1</text>
<text x="290" y="94" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">专家 E1, E5, …</text>
<text x="290" y="116" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">注意力 TP 分片</text>
<rect x="390" y="48" width="160" height="84" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></rect>
<text x="470" y="72" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU 2</text>
<text x="470" y="94" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">专家 E2, E6, …</text>
<text x="470" y="116" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">注意力 TP 分片</text>
<rect x="570" y="48" width="160" height="84" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></rect>
<text x="650" y="72" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU 3</text>
<text x="650" y="94" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">专家 E3, E7, …</text>
<text x="650" y="116" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">注意力 TP 分片</text>
<path d="M 110 286 L 110 136" stroke="var(--sv-a)" stroke-width="1.2" fill="none" opacity="0.45" marker-end="url(#moe-arrow-2)"></path>
<path d="M 110 286 L 290 136" stroke="var(--sv-a)" stroke-width="1.2" fill="none" opacity="0.45" marker-end="url(#moe-arrow-2)"></path>
<path d="M 110 286 L 470 136" stroke="var(--sv-a)" stroke-width="1.2" fill="none" opacity="0.45" marker-end="url(#moe-arrow-2)"></path>
<path d="M 110 286 L 650 136" stroke="var(--sv-a)" stroke-width="1.2" fill="none" opacity="0.45" marker-end="url(#moe-arrow-2)"></path>
<path d="M 290 286 L 110 136" stroke="var(--sv-a)" stroke-width="1.2" fill="none" opacity="0.45" marker-end="url(#moe-arrow-2)"></path>
<path d="M 290 286 L 290 136" stroke="var(--sv-a)" stroke-width="1.2" fill="none" opacity="0.45" marker-end="url(#moe-arrow-2)"></path>
<path d="M 290 286 L 470 136" stroke="var(--sv-a)" stroke-width="1.2" fill="none" opacity="0.45" marker-end="url(#moe-arrow-2)"></path>
<path d="M 290 286 L 650 136" stroke="var(--sv-a)" stroke-width="1.2" fill="none" opacity="0.45" marker-end="url(#moe-arrow-2)"></path>
<path d="M 470 286 L 110 136" stroke="var(--sv-a)" stroke-width="1.2" fill="none" opacity="0.45" marker-end="url(#moe-arrow-2)"></path>
<path d="M 470 286 L 290 136" stroke="var(--sv-a)" stroke-width="1.2" fill="none" opacity="0.45" marker-end="url(#moe-arrow-2)"></path>
<path d="M 470 286 L 470 136" stroke="var(--sv-a)" stroke-width="1.2" fill="none" opacity="0.45" marker-end="url(#moe-arrow-2)"></path>
<path d="M 470 286 L 650 136" stroke="var(--sv-a)" stroke-width="1.2" fill="none" opacity="0.45" marker-end="url(#moe-arrow-2)"></path>
<path d="M 650 286 L 110 136" stroke="var(--sv-a)" stroke-width="1.2" fill="none" opacity="0.45" marker-end="url(#moe-arrow-2)"></path>
<path d="M 650 286 L 290 136" stroke="var(--sv-a)" stroke-width="1.2" fill="none" opacity="0.45" marker-end="url(#moe-arrow-2)"></path>
<path d="M 650 286 L 470 136" stroke="var(--sv-a)" stroke-width="1.2" fill="none" opacity="0.45" marker-end="url(#moe-arrow-2)"></path>
<path d="M 650 286 L 650 136" stroke="var(--sv-a)" stroke-width="1.2" fill="none" opacity="0.45" marker-end="url(#moe-arrow-2)"></path>
<rect x="30" y="180" width="700" height="34" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="380" y="202" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">All-to-All 交换网络：节点内 NVLink，跨节点 IB</text>
<text x="20" y="166" font-size="12" fill="var(--sv-muted)" font-family="inherit">dispatch：按路由把 token 发到专家所在 GPU</text>
<text x="20" y="248" font-size="12" fill="var(--sv-muted)" font-family="inherit">combine：专家输出沿反方向回到源 GPU</text>
<rect x="30" y="286" width="160" height="58" rx="6" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-width="2"></rect>
<text x="110" y="310" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Token 分片 0</text>
<text x="110" y="332" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">2048 token</text>
<rect x="210" y="286" width="160" height="58" rx="6" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-width="2"></rect>
<text x="290" y="310" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Token 分片 1</text>
<text x="290" y="332" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">2048 token</text>
<rect x="390" y="286" width="160" height="58" rx="6" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-width="2"></rect>
<text x="470" y="310" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Token 分片 2</text>
<text x="470" y="332" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">2048 token</text>
<rect x="570" y="286" width="160" height="58" rx="6" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-width="2"></rect>
<text x="650" y="310" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Token 分片 3</text>
<text x="650" y="332" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">2048 token</text>
<text x="20" y="372" font-size="12" fill="var(--sv-muted)" font-family="inherit">DeepSeek-V3 限制每个 token 最多去 4 个节点，降低跨节点 all-to-all 流量。</text>
</svg>
<figcaption>图 3 · 专家并行的 all-to-all：token 分片发往持有目标专家的 GPU，计算后原路收回；跨节点链路通常是瓶颈。</figcaption>
</figure>
<div class="formula">单 token 单方向流量 ≈ k × H × b 字节
DeepSeek-V3：k=8，H=7168，FP8 → 8 × 7168 × 1 B ≈ 56 KiB/token
4096 token 的 batch → 全组合计约 224 MiB/层/方向；dispatch 与 combine 各一次</div>
<p>工程上要盯三个数：all-to-all 耗时占单层时间的比例、跨节点与节点内流量的比例、最慢 EP rank 的等待时间。前两个决定要不要改路由或并行拓扑，第三个决定负载均衡是否真的生效。只优化 GPU 利用率而不看 all-to-all，很容易得出“MoE 不如 dense”的错误结论。</p>
</section>

<section class="sec">
<h2>训练不稳定性：症状、根因与处置</h2>
<p>MoE 训练比 dense 更容易出现 loss 尖峰和路由漂移，根因集中在三处。第一，router 的 logits 可能爆炸，softmax 后接近 one-hot，梯度变得极端；第二，专家利用率不均导致部分专家更新不足，表征退化后又进一步失去竞争力；第三，低精度训练（FP8/bf16）下，路由打分和专家计算的数值误差被放大。DeepSeek-V3 在 14.8T token 的预训练中记录到多次 loss 尖峰，处理方式是回滚到最近的 checkpoint、跳过部分数据、调整学习率，而不是放任继续训练。</p>
<p>常见的稳定化手段有一组“组合拳”：router 的 logits 用 fp32 计算；加 router z-loss（ST-MoE 提出），惩罚 log-sum-exp 的平方，防止 logits 幅度失控；给 router 加少量抖动噪声（jitter），避免早期路由过早确定；对 router 权重使用更小的初始化；全局梯度裁剪；以及前面说的负载均衡。Switch Transformer 还发现，专家层用 bf16 而 router 保持 fp32 的“选择性精度”更稳。</p>
<p>下面是一段路由与容量控制的伪代码，重点看 top-k、容量和丢弃三个动作如何串起来。真实实现会用 grouped GEMM 和自定义 kernel，但逻辑一致。</p>
<pre class="code" data-lang="python"><code>import torch

def moe_route(x, gate_w, k=8, capacity_factor=1.25):
    # x: [T, H]；gate_w: [E, H]
    logits = x @ gate_w.t()
    probs = torch.softmax(logits, dim=-1)
    topv, topi = probs.topk(k, dim=-1)      # 每个 token 选 k 个专家
    topv = topv / topv.sum(dim=-1, keepdim=True)
    E = gate_w.shape[0]
    cap = int(capacity_factor * x.shape[0] * k / E)
    # 按专家分组，超过 cap 的 token 丢弃；实现上用排序 + 前缀和
    assign = [[] for _ in range(E)]
    for t in range(x.shape[0]):
        for j in range(k):
            e = int(topi[t, j])
            if len(assign[e]) &lt; cap:
                assign[e].append((t, float(topv[t, j])))
    # 每个专家对自己的 token 做 FFN，再按权重 scatter 回原位置
    return assign, cap</code></pre>
<p>这段代码故意写成串行版本，方便看清语义；生产实现会把 assign 换成排序后的 index 张量，把循环换成 batched GEMM。注意 capacity 是按“每个专家的平均接收量”算的：top-k 让总分配量变成 T×k，再除以专家数 E，所以容量会随 k 线性放大。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>loss 尖峰时不要只调学习率。先看 router 熵和专家利用率：如果熵骤降、少数专家吃满容量，问题在路由坍缩；如果熵正常但 all-to-all 变慢，问题在通信或某张卡掉队；如果只有 FP8 版本出问题，优先查 scaling factor 和 router 精度。三类症状的处理完全不同。</div></div>
</section>

<section class="sec">
<h2>推理：TP/EP 怎么组合，显存怎么算</h2>
<p>推理分 prefill 和 decode 两个阶段。prefill 一次处理成百上千 token，计算密集，MoE 的专家 GEMM 容易打满；decode 每步只处理少量 token，是访存和延迟敏感型，all-to-all 的固定延迟被放大。因此 MoE 推理的并行策略通常不是“一套配置走到底”，而是按阶段调整：prefill 计算密集，优先用较大的 TP 把单层矩阵摊开，EP 主要负责分散专家权重；decode 访存和延迟敏感，倾向用更大的 EP，并用连续批处理把每步的 token 数堆起来，同时让通信与计算重叠。</p>
<p>一个实用的起点是：注意力部分用 TP，专家部分用 EP。TP 切注意力的头和 KV cache，EP 切专家权重；共享专家可以跟注意力一起做 TP，也可以单独复制。DeepSeek-V3 的权重按 FP8 存约 671 GB（约 625 GiB）。单台 8×H800 的 HBM 合计 8×80 GiB = 640 GiB，权重几乎把显存占满，KV cache、激活和通信缓冲没有空间，所以按 8 卡节点至少要 2 台（16 卡），实际部署常配 32 卡以上。若改用 BF16，权重约 1.34 TB（约 1.22 TiB），仅权重就要 16 张 80 GiB 卡，实用部署通常在 24 卡以上。这个“先算权重、再算 KV、最后算并行”的顺序，比先选框架再试错可靠得多。</p>
<p>对比之下，Mixtral 8x7B 总参数 46.7B、每 token 激活 12.9B，BF16 权重约 93 GB，两张 80 GiB 的 H100/H800 就能放下并留出 KV 空间；这也说明 MoE 的部署门槛主要由<mark>总参数</mark>决定，而不是激活参数。选型时不要把“激活 37B”误读成“只需要 37B 的显存”。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>模型</th><th>总参数</th><th>每 token 激活</th><th>路由</th><th>部署含义</th></tr></thead>
<tbody>
<tr><td>Llama 3 70B（dense 对照）</td><td>70B</td><td>70B</td><td>全部参数</td><td>BF16 权重约 140 GB，至少 2×80 GiB</td></tr>
<tr><td>Mixtral 8x7B</td><td>46.7B</td><td>12.9B</td><td>top-2 / 8</td><td>BF16 权重约 93 GB，2×80 GiB 可起步</td></tr>
<tr><td>Switch-C</td><td>1.6T</td><td>约 1B 量级（top-1 / 2048）</td><td>top-1 / 2048</td><td>训练规模演示，推理需大规模 EP</td></tr>
<tr><td>DeepSeek-V3</td><td>671B</td><td>37B</td><td>top-8 / 256 + 1 共享</td><td>FP8 权重约 671 GB；单机 8 卡无余量，实用 16 卡起</td></tr>
</tbody>
</table></div>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>估算显存时按“总参数 × 每参数字节”算权重，再除以 EP（专家）或 TP（注意力），最后加 KV cache 和 10% 到 20% 的缓冲。MoE 的权重不是均匀切的：专家数不能整除 EP 时会有负载偏差；注意力权重按 TP 切分，不做 TP 时则每张卡各有一份副本。先画一张“哪部分在哪些卡上”的表，再决定并行度。</div></div>
<p>通信方面，decode 阶段每层两次 all-to-all，延迟在几十到几百微秒量级（视 EP 规模、拓扑和实现而定）。当 batch 很小时，这部分无法被计算掩盖，所以生产系统会用大 EP 把专家摊开、用连续批处理（continuous batching）提高单次通信的 token 数、并用 prefill/decode 分离避免两种负载互相干扰。具体到框架，vLLM、SGLang、TensorRT-LLM 都提供 EP 相关开关，参数名随版本变化，部署前以对应版本文档为准。</p>
</section>

<section class="sec">
<h2>常见误区、排障顺序与自测</h2>
<p>第一个误区是“MoE 一定比 dense 快”。在相同总参数下，MoE 的单 token FLOPs 更低，但多了 all-to-all 和路由开销；在小 batch、跨节点、负载不均的场景里，MoE 可能更慢。第二个误区是“激活参数小，显存就小”。显存由总参数决定，37B 激活不等于 37B 显存。第三个误区是“top-k 越大越好”。k 增大提升质量上限，但计算和通信按 k 线性增长，而且更容易触发容量和负载问题。第四个误区是“无辅助损失等于不均衡”，DeepSeek-V3 只是把均衡从梯度里挪到了偏置更新里，均衡机制仍然存在。</p>
<p>排障可以按固定顺序：先看每个专家的 token 数和丢弃率，判断路由是否坍缩；再看 router 熵和最大概率，判断打分是否饱和；然后看 all-to-all 的分层耗时和跨节点比例，判断通信是否是瓶颈；最后看 loss 曲线与梯度范数，判断数值稳定性。每次只改一个维度，否则无法归因。</p>
<div class="duo"><div class="duo__col"><h4>适合 MoE 的场景</h4><p>总参数受显存约束、但单 token 算力有上限；多语言、多领域、长尾知识需要更大容量；训练集群有高带宽互联，能承受 all-to-all；推理侧可以接受多卡部署和更复杂的调度。</p></div><div class="duo__col"><h4>更适合 dense 的场景</h4><p>低延迟单卡或双卡推理；互联带宽有限或跨地域部署；团队缺少 MoE 训练与排障经验；模型规模还没到“参数不够用”的阶段。此时 dense 的简单性和可预测性更值钱。</p></div></div>
<p>下面四道题用来检验你是否真的理解了容量、均衡和并行。</p>
<h3>自测</h3>
<details class="quiz"><summary>Q1 · DeepSeek-V3 每 token 只激活 37B 参数，为什么 8×H800 还是装不下？</summary><div class="quiz__a">因为显存要装的是<mark>总参数</mark> 671B，不是激活参数。FP8 下权重约 671 GB（约 625 GiB），而单台 8×H800 的 HBM 合计 8×80 GiB = 640 GiB，权重几乎把显存占满，KV cache、激活和通信缓冲没有空间。37B 只决定单 token 参与多少计算，不决定权重占多少显存。按 8 卡节点至少要 2 台（16 卡），实际部署通常留更多余量。</div></details>
<details class="quiz"><summary>Q2 · T=8192、k=8、E=256、capacity_factor=1.25 时，每个专家容量是多少？某专家收到 400 个 token 会怎样？</summary><div class="quiz__a">容量 = 1.25 × 8192 × 8 / 256 = 320 个 token。该专家收到 400 个，超出 80 个；在启用 token drop 的实现里，这 80 个 token 不进入该专家的 FFN，通常只保留残差路径，相当于这一层没有对它们做专家计算。若实现选择不丢弃，则会扩容缓冲区或做重路由，代价是显存和负载不均。</div></details>
<details class="quiz"><summary>Q3 · DeepSeek-V3 的专家偏置为什么不参与反向传播，却仍能实现负载均衡？</summary><div class="quiz__a">偏置 b_i 只加到“选择 top-k”的打分上，不进入加权系数的计算，也不在计算图里，因此没有梯度。每个 step 结束后按负载误差做规则更新：过载的专家 b_i 减小，欠载的增大，下一步被选中的概率随之变化。这样均衡不占用语言建模的梯度预算，避免了辅助损失 α 难调、和主目标冲突的问题；代价是需要维护偏置状态并随训练阶段衰减 γ。</div></details>
<details class="quiz"><summary>Q4 · 为什么 MoE 推理的 decode 阶段比 prefill 更容易被 all-to-all 拖慢？</summary><div class="quiz__a">prefill 一次处理大量 token，专家 GEMM 的计算时间长，all-to-all 可以部分被计算掩盖；decode 每步只有少量 token，计算量小，而每层仍要发两次 all-to-all，固定延迟占比上升。batch 越小、EP 跨度越大，这个问题越明显。常见对策是扩大 EP、连续批处理凑大单次通信的 token 数、prefill/decode 分离，以及通信与计算重叠。</div></details>
<ul class="refs">
<li><b>Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer</b> — Shazeer 等, ICLR, 2017。提出稀疏门控 MoE 与 top-k 路由，是把 MoE 做到 137B 参数 LSTM 的开端。</li>
<li><b>GShard: Scaling Giant Models with Conditional Computation and Automatic Sharding</b> — Lepikhin 等, Google, 2020。把 top-2 路由、容量因子和自动分片带到 600B 多语言翻译模型。</li>
<li><b>Switch Transformers: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity</b> — Fedus 等, Google, 2021。用 top-1 路由简化 MoE，推到 1.6T 参数，并系统讨论容量、精度与稳定性。</li>
<li><b>ST-MoE: Designing Stable and Transferable Sparse Expert Models</b> — Zoph 等, Google, 2022。系统研究 MoE 的训练稳定性，提出 router z-loss 与选择性精度。</li>
<li><b>Mixtral of Experts</b> — Jiang 等, Mistral AI, 2024。8 专家、top-2 的开放 MoE 模型，46.7B 总参数、12.9B 激活参数，验证了 MoE 的实用部署路径。</li>
<li><b>DeepSeek-V3 Technical Report</b> — DeepSeek-AI, 2024。671B 总参数、37B 激活、256 路由专家与共享专家，提出无辅助损失负载均衡、节点受限路由和 FP8 训练。</li>
</ul>
</section>`
};
