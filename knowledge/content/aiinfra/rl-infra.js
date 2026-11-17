window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["rl-infra"] = {
  slug: "rl-infra",
  title: "RL 训练基础设施",
  subtitle: "当生成比训练更贵",
  level: 6,
  cluster: "前沿",
  tags: ["RLHF", "GRPO", "Rollout"],
  summary: "算清 PPO 四模型与 GRPO 的显存账，讲透 rollout 与训练引擎分离、权重同步、异步 staleness、稳定性与容量规划，并给出框架选型建议。",
  keyPoints: [
    "RL 训练把生成放进训练循环，rollout 是 memory-bound 的低 MFU 负载，长序列任务中常占总墙钟一半以上",
    "PPO 四模型在 7B 全参数下约 252 GB 静态显存，GRPO 去掉 critic 与 RM 后降到约 126 GB（规则奖励时）",
    "rollout 与训练必须用不同引擎，权重同步的带宽与并行度重切分决定每步开销",
    "异步把串行等待变成流水线，代价是 m 步 staleness 与重要性采样修正",
    "稳定性问题多来自 KL 系数、clip 范围、奖励被钻空子，以及两套引擎的 logprob 不一致"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>先建立直觉：训练循环里多了一步“现场生成”</h2>
<p>监督微调（Supervised Fine-Tuning, SFT）的每个 step 很直接：取一批带标注的 token，前向算 loss，反向传播。数据事先准备好，GPU 只做一件事——训练。<mark>RLHF（Reinforcement Learning from Human Feedback）打破了这个前提</mark>：模型先用当前参数生成回答，再由奖励模型（Reward Model, RM）打分，最后用分数更新参数。生成发生在训练循环内部，同一个 prompt 通常要采多条回答。</p>
<p>这一步带来三个连锁反应。第一，集群里同时存在两类负载：生成（rollout）逐 token 解码，受 HBM 带宽与 KV Cache 限制，模型算力利用率（MFU, Model FLOPs Utilization）常只有百分之几；训练以矩阵乘为主，MFU 可到 40% 左右。第二，两边的并行方式与引擎偏好不同，硬塞进一个框架会同时损失吞吐与稳定性。第三，生成用的权重必须与训练一致，每步或每几步同步一次，这是真实的通信开销。</p>
<p>于是核心问题不是“怎么把模型跑起来”，而是<mark>怎么让一条不断变长的生成流水线，喂饱一条相对固定的训练流水线</mark>。本篇先看 RLHF 流程，再算显存账，然后拆两套引擎、权重同步、同步与异步、吞吐与容量，最后讲稳定性与选型。PPO、GRPO 的数学推导不在范围内。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>传统训练像做有标准答案的练习册：题目和答案都印好了，只需反复练。RL 训练像开卷答辩：学生（policy）自由作答，老师（reward model）打分，学生按分差调整。老师可能被“字数多就给高分”骗到，学生也可能学会迎合老师，而不是真的学会解题。</div></div>
</section>

<section class="sec">
<h2>RLHF 的完整流程：三段数据、三个产物</h2>
<p>InstructGPT 确立的三阶段流程仍是主流。第一阶段 SFT：用人类示范的问答对做 next-token 预测，得到 π_SFT。第二阶段训练奖励模型：同一 prompt 采多条回答让人做偏好排序，用 Bradley-Terry 模型转成标量分数 r(x, y)。第三阶段 RL：当前策略生成回答，RM 打分，在 KL（Kullback-Leibler）约束下最大化期望奖励；策略侧（PPO 还包括 critic）被更新，RM 与参考模型冻结。</p>
<p>三个阶段的数据形态不同：SFT 是“输入-输出”对，RM 是“同一输入下的成对比较”，RL 只有 prompt、没有标准答案。所以 RL 阶段的数据集看起来最小，却最贵：每条 prompt 要生成多条长回答，成本在采样。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="RLHF 三阶段流程与 RL 内循环数据流图">
<defs>
<marker id="rl-infra-arrow-1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
<path d="M 0 0 L 10 5 L 0 10 Z" fill="var(--sv-muted)"></path>
</marker>
</defs>
<text x="20" y="24" font-size="15" fill="var(--sv-ink)" font-family="inherit">RLHF 三阶段与 RL 内循环</text>
<text x="20" y="44" font-size="12" fill="var(--sv-muted)" font-family="inherit">实线为数据流，虚线为 KL 约束；内循环每一轮都要在 GPU 上真实生成与训练</text>

<rect x="20" y="64" width="200" height="54" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="120" y="86" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">1 · SFT 监督微调</text>
<text x="120" y="105" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">人类示范 → 策略 π_SFT</text>

<rect x="250" y="64" width="220" height="54" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="360" y="86" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">2 · 奖励模型 RM</text>
<text x="360" y="105" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">成对偏好 → 标量奖励</text>

<rect x="500" y="64" width="240" height="54" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></rect>
<text x="620" y="86" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">3 · RL 微调</text>
<text x="620" y="105" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">PPO / GRPO 更新策略</text>

<line x1="220" y1="91" x2="246" y2="91" stroke="var(--sv-muted)" stroke-width="1.6" marker-end="url(#rl-infra-arrow-1)"></line>
<line x1="470" y1="91" x2="496" y2="91" stroke="var(--sv-muted)" stroke-width="1.6" marker-end="url(#rl-infra-arrow-1)"></line>

<text x="20" y="142" font-size="12" fill="var(--sv-muted)" font-family="inherit">RL 内循环：生成 → 打分 → 更新 → 同步</text>

<rect x="20" y="160" width="120" height="76" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="80" y="185" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Prompt 批次</text>
<text x="80" y="204" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">x ~ D</text>

<rect x="175" y="160" width="150" height="76" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"></rect>
<text x="250" y="181" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Actor Rollout</text>
<text x="250" y="199" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">vLLM / SGLang</text>
<text x="250" y="217" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">采样 G 条回答</text>

<rect x="360" y="160" width="130" height="76" rx="6" fill="var(--sv-panel)" stroke="var(--sv-b)"></rect>
<text x="425" y="181" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">奖励打分</text>
<text x="425" y="199" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">RM 或规则验证器</text>
<text x="425" y="217" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">r(x, y_i)</text>

<rect x="525" y="160" width="135" height="76" rx="6" fill="var(--sv-panel)" stroke="var(--sv-c)"></rect>
<text x="592" y="181" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">优势估计</text>
<text x="592" y="199" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">组内归一化 / GAE</text>
<text x="592" y="217" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">A_i</text>

<line x1="140" y1="198" x2="171" y2="198" stroke="var(--sv-muted)" stroke-width="1.6" marker-end="url(#rl-infra-arrow-1)"></line>
<line x1="325" y1="198" x2="356" y2="198" stroke="var(--sv-muted)" stroke-width="1.6" marker-end="url(#rl-infra-arrow-1)"></line>
<line x1="490" y1="198" x2="521" y2="198" stroke="var(--sv-muted)" stroke-width="1.6" marker-end="url(#rl-infra-arrow-1)"></line>
<line x1="592" y1="236" x2="592" y2="264" stroke="var(--sv-muted)" stroke-width="1.6" marker-end="url(#rl-infra-arrow-1)"></line>

<rect x="20" y="268" width="150" height="56" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)" stroke-dasharray="5 4"></rect>
<text x="95" y="290" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">参考模型 π_ref</text>
<text x="95" y="308" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">冻结，提供 KL</text>

<rect x="300" y="268" width="170" height="56" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)"></rect>
<text x="385" y="290" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">权重同步</text>
<text x="385" y="308" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">NCCL / 共享内存</text>

<rect x="505" y="268" width="155" height="56" rx="6" fill="var(--sv-panel)" stroke="var(--sv-b)" stroke-width="2"></rect>
<text x="582" y="290" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">策略更新</text>
<text x="582" y="308" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">PPO clip / KL</text>

<line x1="505" y1="296" x2="473" y2="296" stroke="var(--sv-muted)" stroke-width="1.6" marker-end="url(#rl-infra-arrow-1)"></line>
<path d="M 310 268 L 310 250 L 250 250 L 250 239" fill="none" stroke="var(--sv-muted)" stroke-width="1.6" marker-end="url(#rl-infra-arrow-1)"></path>
<path d="M 95 324 L 95 344 L 592 344 L 592 327" fill="none" stroke="var(--sv-line)" stroke-width="1.4" stroke-dasharray="5 4" marker-end="url(#rl-infra-arrow-1)"></path>
<text x="310" y="366" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">KL 约束：新策略不能偏离参考模型太远</text>
</svg>
<figcaption>图 1 · 三阶段产出 SFT 策略、奖励模型和 RL 策略；真正的算力消耗集中在下半部分的内循环</figcaption>
</figure>
<p>下半部分是 RL 内循环，也是基础设施真正要跑的东西：prompt 进入 rollout 引擎，actor 采出 G 条回答；RM 或规则验证器打分；优势估计把分数转成 token 级更新信号；训练引擎更新 actor；参考模型提供 KL 约束；新权重同步回 rollout 引擎。InstructGPT 的 175B 版本用 PPO（Proximal Policy Optimization），四个模型同时存在，这是后面显存账的来源。</p>
<p>RL 优化的是<mark>序列级标量奖励</mark>，SFT 优化的是每个 token 的似然。奖励在整条回答结束后才给出，中间 token 的贡献靠优势估计分摊；同 batch 内序列长度差异很大，训练负载均衡比 SFT 难得多。</p>
</section>

<section class="sec">
<h2>显存账：PPO 的四份权重与 GRPO 的减法</h2>
<p>PPO 需要四个模型同时驻留：actor（策略）、critic（价值）、reference（参考，冻结，算 KL）、reward model（冻结，打分）。前两个训练态，后两个推理态；差别不只是四份权重，训练态每个参数还要背梯度与 Adam 状态。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>模型</th><th>是否更新</th><th>每参数字节</th><th>7B 实例</th><th>作用</th></tr></thead>
<tbody>
<tr><td>Actor（策略）</td><td>是</td><td>16 B</td><td>约 112 GB</td><td>生成回答，接收策略梯度</td></tr>
<tr><td>Critic（价值）</td><td>是</td><td>16 B</td><td>约 112 GB</td><td>估计状态价值，提供 GAE（广义优势估计）baseline</td></tr>
<tr><td>Reference（参考）</td><td>否</td><td>2 B</td><td>约 14 GB</td><td>计算 KL，约束策略漂移</td></tr>
<tr><td>Reward Model（奖励）</td><td>否</td><td>2 B</td><td>约 14 GB</td><td>给完整回答打标量分</td></tr>
</tbody>
</table></div>
<div class="formula">M_PPO ≈ 16·N_actor + 16·N_critic + 2·N_ref + 2·N_rm（字节）
M_GRPO ≈ 16·N_actor + 2·N_ref（规则奖励时）
其中 16 = bf16 权重 2 + 梯度 2 + fp32 主权重 4 + Adam 一阶矩 4 + 二阶矩 4</div>
<p>以 7B 全参数、bf16 为例，并假设 critic 与 RM 也按 7B 同规模估算：单个训练态模型约 112 GB，两个冻结模型各约 14 GB，合计约 252 GB，尚未计入激活与 rollout KV。8 张 H100 80GB 共 640 GB 放得下，但余量要留给长序列激活；8 张 A100 40GB 只有 320 GB，扣掉静态占用仅剩约 68 GB，长序列下基本不可行。critic 更小或 actor 用 LoRA 会显著降低数字，但那不是全参数 RL。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="7B 模型 PPO 四模型与 GRPO 的静态显存占用对比条形图">
<text x="20" y="24" font-size="15" fill="var(--sv-ink)" font-family="inherit">7B 全参数 RL 的静态显存账</text>
<text x="20" y="46" font-size="12" fill="var(--sv-muted)" font-family="inherit">bf16 权重 + 梯度 + Adam fp32 状态；不含激活与 rollout KV</text>

<text x="120" y="72" font-size="10" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">0</text>
<text x="313" y="72" font-size="10" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">100</text>
<text x="506" y="72" font-size="10" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">200</text>
<text x="700" y="72" font-size="10" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">300 GB</text>
<line x1="120" y1="80" x2="120" y2="240" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="313" y1="80" x2="313" y2="240" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"></line>
<line x1="506" y1="80" x2="506" y2="240" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"></line>
<line x1="700" y1="80" x2="700" y2="240" stroke="var(--sv-line)" stroke-width="1"></line>

<text x="110" y="118" font-size="12" text-anchor="end" fill="var(--sv-ink)" font-family="inherit">PPO 四模型</text>
<rect x="120" y="90" width="216" height="46" fill="var(--sv-a)"></rect>
<rect x="336" y="90" width="216" height="46" fill="var(--sv-b)"></rect>
<rect x="552" y="90" width="27" height="46" fill="var(--sv-c)"></rect>
<rect x="579" y="90" width="27" height="46" fill="var(--sv-a2)"></rect>
<text x="228" y="118" font-size="11" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">Actor 112 GB</text>
<text x="444" y="118" font-size="11" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">Critic 112 GB</text>
<text x="565" y="118" font-size="9" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">14</text>
<text x="592" y="118" font-size="9" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">14</text>
<text x="614" y="118" font-size="12" fill="var(--sv-ink)" font-family="inherit">≈ 252 GB</text>

<text x="110" y="198" font-size="12" text-anchor="end" fill="var(--sv-ink)" font-family="inherit">GRPO</text>
<rect x="120" y="170" width="216" height="46" fill="var(--sv-a)"></rect>
<rect x="336" y="170" width="27" height="46" fill="var(--sv-c)"></rect>
<text x="228" y="198" font-size="11" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">Actor 112 GB</text>
<text x="349" y="198" font-size="9" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">14</text>
<text x="371" y="198" font-size="12" fill="var(--sv-ink)" font-family="inherit">≈ 126 GB</text>

<text x="20" y="270" font-size="11" fill="var(--sv-muted)" font-family="inherit">16 B/参数 = bf16 权重 2 + 梯度 2 + fp32 主权重 4 + Adam 一阶矩 4 + 二阶矩 4。</text>
<text x="20" y="292" font-size="11" fill="var(--sv-muted)" font-family="inherit">PPO 的 critic 与 actor 同规模时各约 112 GB；critic 更小或 actor 用 LoRA 时总额下降。</text>
<text x="20" y="314" font-size="11" fill="var(--sv-muted)" font-family="inherit">GRPO 若仍需模型奖励，再加约 14 GB；规则奖励（答案比对、单元测试）可完全省掉 RM。</text>
</svg>
<figcaption>图 2 · 去掉 critic（112 GB）与规则奖励所需的 RM（14 GB），把 PPO 的 252 GB 压到 126 GB；省下的是显存，不是生成成本</figcaption>
</figure>
<p>GRPO（Group Relative Policy Optimization）的改动很干脆：去掉 critic。同一 prompt 采 G 条回答，用组内奖励均值与标准差归一化得到优势，代替 value function 的 baseline，省掉一个训练态模型（7B 下约 112 GB），也不需要 GAE。DeepSeekMath 的 7B 模型用 GRPO 在 GSM8K 上达到 88.2%、MATH 上 51.7%，奖励来自规则校验，连 RM 都能省：252 − 112 − 14 = 126 GB。</p>
<div class="formula">GRPO 优势：A_i = (r_i − mean(r_1,…,r_G)) ÷ (std(r_1,…,r_G) + ε)
组内比较替代 value baseline，代价是每个 prompt 要采 G 条回答</div>
<div class="callout callout--formula"><span class="callout__label">公式</span><div>显存估算先背“每参数字节”：纯推理 bf16 是 2 B，全参数 Adam 训练是 16 B。看到框架的显存数字，先问它算进了权重、梯度、优化器状态、激活、KV 中的哪几项。</div></div>
<p>但 GRPO 不是免费的：G 条回答让 rollout token 数随 G 线性增长，省下的显存主要来自 critic；若必须用 RM，14 GB 还得加回来。选 PPO 还是 GRPO，先看奖励能否规则化、生成预算是否充足。</p>
</section>

<section class="sec">
<h2>两套引擎：rollout 与训练为什么必须分开</h2>
<p>rollout 引擎的目标是“在给定显存下塞进尽可能多的并发序列，快速吐出 token”，需要分页 KV Cache、连续批处理、prefix caching、CUDA Graph，可能还有 fp8 KV。训练引擎的目标是“把梯度算得尽可能快”，需要 FSDP（Fully Sharded Data Parallel）或 Megatron-LM 的张量并行（Tensor Parallel, TP）、流水并行（Pipeline Parallel, PP）、专家并行（Expert Parallel, EP）与数据并行（Data Parallel, DP），以及激活检查点、序列并行、优化器分片。两者的 kernel、显存布局、并行方式几乎相反。</p>
<p>硬塞进一个框架，常见结果是训练侧放弃融合算子，或推理侧放弃连续批处理，吞吐可能只有原来的 1/3 到 2/3（相当于慢 1.5–3 倍，经验值随负载与实现而变）。因此现代框架把 rollout 当成独立服务：训练只算梯度，生成交给 vLLM、SGLang 或 TensorRT-LLM，中间用权重同步连接。</p>
<p>权重同步的难点不在“传 14 GB 数据”，而在<mark>两边的并行布局不同</mark>。训练可能用 TP=8、PP=4、DP=2，推理可能只用 TP=4；按 TP×PP 计，同一个权重在训练侧被切成 32 份，在推理侧被切成 4 份，不能直接 broadcast，必须先做重切分（resharding）。verl 的 3D-HybridEngine 就是为这件事设计的：在两种并行度之间做一次高效布局转换。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>方式</th><th>数据路径</th><th>7B bf16（约 14 GB）的量级</th><th>适用场景</th></tr></thead>
<tbody>
<tr><td>NCCL broadcast</td><td>GPU 到 GPU，走 NVLink 或 InfiniBand</td><td>NVLink 域内亚秒级；400 Gb/s IB 理想约 0.3 s，实际 1–3 s</td><td>rollout 与训练分离部署，跨节点</td></tr>
<tr><td>主机共享内存 / CUDA IPC</td><td>同节点进程间，经 PCIe 或 NVLink P2P</td><td>数十毫秒到数百毫秒</td><td>同机 colocate，训练与推理分进程</td></tr>
<tr><td>落盘再加载</td><td>GPU → CPU → 磁盘 → GPU</td><td>数秒到数十秒，取决于存储带宽</td><td>冷启动、调试、跨集群迁移</td></tr>
<tr><td>对象存储 / 参数服务</td><td>网络拉取</td><td>十秒级或更慢</td><td>容错、跨地域、异构集群</td></tr>
</tbody>
</table></div>
<p>同步开销要按比例看：step 30 s、同步 2 s 是约 7%；step 只有 5 s 时，2 s 的同步就占到约四成。所以小模型、短序列更倾向 colocate（同卡分时复用，用 sleep/wake 释放显存）；显存放不下训练与推理两套副本，或 rollout 需要独立扩缩容时，才转向分离部署。</p>
<pre class="code" data-lang="bash"><code>python3 -m verl.trainer.main_ppo \
  actor_rollout_ref.actor.ppo_mini_batch_size=256 \
  actor_rollout_ref.rollout.name=vllm \
  actor_rollout_ref.rollout.tensor_model_parallel_size=2 \
  actor_rollout_ref.rollout.gpu_memory_utilization=0.6 \
  actor_rollout_ref.rollout.n=8 \
  trainer.n_gpus_per_node=8 \
  trainer.nnodes=$NNODES</code></pre>
<p>这段配置里 rollout 用 vLLM、TP=2，训练侧默认走 FSDP；gpu_memory_utilization=0.6 是给训练进程与激活留的余量，真实集群要压测，不能照抄。</p>
</section>

<section class="sec">
<h2>同步、异步与 staleness：把等待变成流水线</h2>
<p>最直观的是同步：生成一批 → 训练 → 同步权重 → 再生成。两个阶段严格串行，生成时训练卡空闲，训练时推理卡空闲。图 3 左侧即此模式：墙钟等于三段相加，GPU 利用率轮流掉到零。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="同步与异步 RL 架构的 GPU 时间线对比图">
<text x="20" y="24" font-size="15" fill="var(--sv-ink)" font-family="inherit">同步与异步：同一段墙钟内的 GPU 时间线</text>
<text x="20" y="44" font-size="12" fill="var(--sv-muted)" font-family="inherit">方块长度不代表真实比例；重点是空闲与重叠</text>

<rect x="20" y="60" width="350" height="160" rx="8" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="32" y="82" font-size="13" fill="var(--sv-ink)" font-family="inherit">A · 同步：生成与训练串行</text>
<text x="32" y="113" font-size="11" fill="var(--sv-muted)" font-family="inherit">Rollout</text>
<text x="32" y="141" font-size="11" fill="var(--sv-muted)" font-family="inherit">Trainer</text>
<rect x="100" y="98" width="55" height="22" fill="var(--sv-a)"></rect>
<rect x="155" y="98" width="25" height="22" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<rect x="180" y="98" width="55" height="22" fill="var(--sv-a)"></rect>
<rect x="235" y="98" width="25" height="22" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<rect x="260" y="98" width="55" height="22" fill="var(--sv-a)"></rect>
<rect x="315" y="98" width="35" height="22" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<rect x="100" y="126" width="55" height="22" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<rect x="155" y="126" width="25" height="22" fill="var(--sv-b)"></rect>
<rect x="180" y="126" width="55" height="22" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<rect x="235" y="126" width="25" height="22" fill="var(--sv-b)"></rect>
<rect x="260" y="126" width="55" height="22" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<rect x="315" y="126" width="35" height="22" fill="var(--sv-b)"></rect>
<text x="127" y="114" font-size="10" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">G</text>
<text x="207" y="114" font-size="10" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">G</text>
<text x="287" y="114" font-size="10" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">G</text>
<text x="167" y="142" font-size="10" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">T</text>
<text x="247" y="142" font-size="10" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">T</text>
<text x="332" y="142" font-size="10" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">T</text>
<text x="32" y="178" font-size="11" fill="var(--sv-muted)" font-family="inherit">墙钟 = T_gen + T_train + T_sync</text>
<text x="32" y="198" font-size="11" fill="var(--sv-muted)" font-family="inherit">两侧轮流空闲，利用率出现锯齿</text>

<rect x="390" y="60" width="350" height="160" rx="8" fill="var(--sv-bg)" stroke="var(--sv-line)"></rect>
<text x="402" y="82" font-size="13" fill="var(--sv-ink)" font-family="inherit">B · 异步：流水线重叠，接受 staleness</text>
<text x="402" y="113" font-size="11" fill="var(--sv-muted)" font-family="inherit">Rollout</text>
<text x="402" y="141" font-size="11" fill="var(--sv-muted)" font-family="inherit">Trainer</text>
<rect x="470" y="98" width="260" height="22" fill="var(--sv-a)"></rect>
<text x="600" y="114" font-size="11" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">持续生成，不停机</text>
<rect x="470" y="126" width="260" height="22" fill="var(--sv-b)"></rect>
<text x="600" y="142" font-size="11" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">消费 m 步前的旧策略数据</text>
<line x1="540" y1="92" x2="540" y2="154" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"></line>
<line x1="620" y1="92" x2="620" y2="154" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"></line>
<line x1="700" y1="92" x2="700" y2="154" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"></line>
<line x1="540" y1="162" x2="620" y2="162" stroke="var(--sv-muted)" stroke-width="1.2"></line>
<text x="580" y="177" font-size="10" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">staleness m</text>
<text x="402" y="198" font-size="11" fill="var(--sv-muted)" font-family="inherit">墙钟 ≈ max(T_gen, T_train)，代价是 off-policy</text>

<text x="20" y="252" font-size="12" fill="var(--sv-ink)" font-family="inherit">同步的墙钟由两段相加；异步接近两者最大值，但训练始终落后 m 个版本。</text>
<text x="20" y="276" font-size="12" fill="var(--sv-muted)" font-family="inherit">m 通常限制在个位数；越大越省等待，越需要 clip 与重要性采样修正。</text>
<text x="20" y="300" font-size="12" fill="var(--sv-muted)" font-family="inherit">32K 长序列的长尾样本会放大同步等待，partial rollout 把一条回答拆到多个 step 完成。</text>
</svg>
<figcaption>图 3 · 同步是“加法”，异步是“取最大值”；差距来自重叠，不来自更快的计算</figcaption>
</figure>
<p>异步拆成生产者-消费者：rollout worker 持续生成，trainer 从缓冲区取样本更新参数，权重每隔若干步同步，理想墙钟接近 max(T_gen, T_train)。代价是<mark>训练消费旧策略的数据</mark>：trainer 已更新 m 步时，样本由 θ_{k−m} 产生，这就是 staleness。m 越大吞吐越高，数据越 off-policy（偏离当前策略）。</p>
<div class="formula">重要性比：ρ_t(θ) = π_θ(y_t | x, y_1..t−1) ÷ π_old(y_t | x, y_1..t−1)
PPO 目标：L = E[min(ρ·A, clip(ρ, 1−ε, 1+ε)·A)]
staleness 越大，ρ 的分布越重尾，clip 越容易触发</div>
<p>长序列会放大同步的缺点：一个 32K token 样本可能比同 batch 其他样本慢一个数量级，同步必须等最慢的那条，整批 GPU 空转。partial rollout 让回答生成到一半先回队列，下一轮接着生成，或拆到多个 step 完成；等待被削平，代价是样本跨越多个策略版本，需要更小心的重要性采样修正。</p>
<div class="duo">
<div class="duo__col"><h4>同步：简单、可控</h4><p>数据由当前策略产生，off-policy 程度最低（多 epoch 更新后仍会轻微偏离），调参与论文一致，适合小规模实验；缺点是 GPU 轮流空闲，长尾会放大浪费。</p></div>
<div class="duo__col"><h4>异步：吞吐优先</h4><p>rollout 不停机，适合大规模长序列训练；必须限制 staleness、做 clip 或截断重要性采样，并监控 ρ 的分布。</p></div>
</div>
</section>

<section class="sec">
<h2>吞吐瓶颈：先算 token，再谈卡数</h2>
<p>RL 的容量规划从 token 账开始，而不是从 GPU 利用率开始。每个 step 的生成 token 数是 prompt 数 P、每个 prompt 的采样数 G、输出长度 L_out 的乘积；训练 token 数通常是同一批 token 乘以 epoch 数 E。把这两个数分别除以各自的吞吐，就得到两段时间。</p>
<div class="formula">每步生成 token ≈ P × G × L_out
T_rollout ≈ (P × G × L_out) ÷ R_rollout
T_train ≈ (P × G × L_out × E) ÷ R_train
R_train ≈ (N_train × F_peak × MFU_train) ÷ (6N)
R_rollout ≈ (N_rollout × F_peak × MFU_rollout) ÷ (2N)</div>
<p>以 7B 模型、8 张 H100 80GB SXM 为例，BF16 稠密算力约 989 TFLOPS/卡（PCIe 版约 756 TFLOPS，按实际型号取值）。训练侧 MFU 取 40%，R_train 约为 8×989×10¹²×0.4 ÷ (6×7×10⁹) ≈ 75k token/s；生成侧是逐 token 解码，MFU 常只有 2%–5%，取 3% 时 R_rollout 约为 8×989×10¹²×0.03 ÷ (2×7×10⁹) ≈ 17k token/s。两者相差约 4–5 倍。</p>
<p>代入一组具体配置：P=128、G=8、L_out=4096，每步生成约 4.19M token。rollout 约 4.19M ÷ 17k ≈ 247 s，训练（E=1）约 4.19M ÷ 75k ≈ 56 s。也就是说，<mark>一个 step 里八成时间在生成</mark>。若 E=4，训练涨到约 224 s，两边才接近；这也是 PPO 常跑多 epoch、GRPO 有时只跑 1 个 epoch 的工程差异之一。</p>
<p>这些是量级估算，不是基准：vLLM 实际吞吐受并发数、KV 预算、输出长度分布、prefix 命中率影响，可能差 2–3 倍；训练 MFU 受序列长度与并行切分影响。规划时先在目标集群各压一次，再套公式。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="不同输出长度下 rollout、训练、打分、同步的墙钟占比堆叠条形图">
<text x="20" y="24" font-size="15" fill="var(--sv-ink)" font-family="inherit">各阶段墙钟占比：序列越长，生成越占主导</text>
<text x="20" y="46" font-size="12" fill="var(--sv-muted)" font-family="inherit">百分比为量级示意，不是基准测试；按单 epoch 绘制</text>

<text x="150" y="72" font-size="10" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">0</text>
<text x="287" y="72" font-size="10" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">25</text>
<text x="425" y="72" font-size="10" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">50</text>
<text x="562" y="72" font-size="10" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">75</text>
<text x="700" y="72" font-size="10" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">100%</text>
<line x1="150" y1="82" x2="150" y2="240" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="287" y1="82" x2="287" y2="240" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"></line>
<line x1="425" y1="82" x2="425" y2="240" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"></line>
<line x1="562" y1="82" x2="562" y2="240" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"></line>
<line x1="700" y1="82" x2="700" y2="240" stroke="var(--sv-line)" stroke-width="1"></line>

<text x="140" y="113" font-size="11" text-anchor="end" fill="var(--sv-ink)" font-family="inherit">短回答 1K</text>
<rect x="150" y="90" width="192" height="36" fill="var(--sv-a)"></rect>
<rect x="342" y="90" width="264" height="36" fill="var(--sv-b)"></rect>
<rect x="606" y="90" width="66" height="36" fill="var(--sv-c)"></rect>
<rect x="672" y="90" width="17" height="36" fill="var(--sv-a2)"></rect>
<rect x="689" y="90" width="11" height="36" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="246" y="113" font-size="11" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">35%</text>
<text x="474" y="113" font-size="11" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">48%</text>
<text x="639" y="113" font-size="10" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">12%</text>

<text x="140" y="168" font-size="11" text-anchor="end" fill="var(--sv-ink)" font-family="inherit">推理任务 8K</text>
<rect x="150" y="145" width="341" height="36" fill="var(--sv-a)"></rect>
<rect x="491" y="145" width="132" height="36" fill="var(--sv-b)"></rect>
<rect x="623" y="145" width="44" height="36" fill="var(--sv-c)"></rect>
<rect x="667" y="145" width="22" height="36" fill="var(--sv-a2)"></rect>
<rect x="689" y="145" width="11" height="36" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="320" y="168" font-size="11" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">62%</text>
<text x="557" y="168" font-size="11" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">24%</text>
<text x="645" y="168" font-size="10" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">8%</text>

<text x="140" y="223" font-size="11" text-anchor="end" fill="var(--sv-ink)" font-family="inherit">长推理 32K</text>
<rect x="150" y="200" width="429" height="36" fill="var(--sv-a)"></rect>
<rect x="579" y="200" width="77" height="36" fill="var(--sv-b)"></rect>
<rect x="656" y="200" width="27" height="36" fill="var(--sv-c)"></rect>
<rect x="683" y="200" width="11" height="36" fill="var(--sv-a2)"></rect>
<rect x="694" y="200" width="6" height="36" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="364" y="223" font-size="11" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">78%</text>
<text x="617" y="223" font-size="11" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">14%</text>
<text x="669" y="223" font-size="9" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">5</text>

<rect x="150" y="280" width="12" height="12" fill="var(--sv-a)"></rect>
<text x="168" y="290" font-size="11" fill="var(--sv-muted)" font-family="inherit">生成 rollout</text>
<rect x="270" y="280" width="12" height="12" fill="var(--sv-b)"></rect>
<text x="288" y="290" font-size="11" fill="var(--sv-muted)" font-family="inherit">训练更新</text>
<rect x="380" y="280" width="12" height="12" fill="var(--sv-c)"></rect>
<text x="398" y="290" font-size="11" fill="var(--sv-muted)" font-family="inherit">打分 / 评估</text>
<rect x="510" y="280" width="12" height="12" fill="var(--sv-a2)"></rect>
<text x="528" y="290" font-size="11" fill="var(--sv-muted)" font-family="inherit">权重同步</text>
<rect x="630" y="280" width="12" height="12" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="648" y="290" font-size="11" fill="var(--sv-muted)" font-family="inherit">其他</text>

<text x="20" y="330" font-size="11" fill="var(--sv-muted)" font-family="inherit">口径：7B–32B 模型、同步模式、8×H100 级节点；序列越长，生成与打分占比越高。</text>
<text x="20" y="352" font-size="11" fill="var(--sv-muted)" font-family="inherit">训练 epoch 越多，训练占比越高；长尾样本与 KV 压力会把生成占比进一步推高。</text>
</svg>
<figcaption>图 4 · 短回答时训练还能占近一半；到 32K 推理，生成与打分合起来接近八成墙钟</figcaption>
</figure>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>容量规划的顺序：先测单节点的 rollout token/s 与 train token/s，再按 T_rollout 与 T_train 的比值决定 GPU 配比。分离部署时，配比可能到 3:1 甚至 5:1；如果不想买这么多推理卡，就用异步把训练与生成的时间重叠，或缩短输出长度、提高 rollout 并发。</div></div>
</section>

<section class="sec">
<h2>稳定性：KL、clip、奖励作弊与两套引擎的不一致</h2>
<p>RL 的不稳定很少来自“梯度算错了”，更多来自优化目标本身。第一道闸是 KL：策略不能离参考模型太远，否则会利用 RM 的盲区。β 太小，奖励涨但质量降；太大，策略几乎不动。常用自适应 KL 让实际值落在目标区间；k3 估计量在参考策略附近方差更低。</p>
<div class="formula">KL_k3 = exp(log π_ref − log π_θ) − (log π_ref − log π_θ) − 1
（逐 token 计算后求和或取平均，具体口径视实现而定）</div>
<p>第二道闸是 clip。PPO 用 ε（常见 0.2）限制 ρ 的更新幅度，防止一次坏 batch 把策略带偏。同步、on-policy 时 ρ 接近 1；异步、staleness 大时 ρ 变重尾，序列级 ratio 可能到几十，clip 频繁触发会让有效梯度变小。实践上常做 token 级与序列级两套 ratio、dual clip，或截断极端样本。</p>
<p>第三类是奖励作弊（reward hacking）。RM 是代理目标，可能偏好更长的回答（length bias）、更自信的语气、特定格式，甚至被提示词注入。规则验证器（答案比对、单元测试）能消掉一类问题，但会引入新漏洞，比如只匹配最终数字而忽略推理。缓解手段包括长度惩罚、RM 集成、KL 约束、保留人工评测集，以及定期重训 RM。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>两套引擎算出的 logprob 不会完全一致：不同 kernel、精度（尤其 rollout 用 fp8）、batch 形状都会带来 10⁻³ 到 10⁻² 的差异，直接污染重要性比——明明没更新，ρ 却不等于 1。常见做法是在 trainer 里对采样 token 重算 logprob，或统一 bf16、关闭激进量化，并对 ratio 截断修正。</div></div>
<p>排障先看现象再看算法：奖励涨、评测跌多半是 reward hacking；KL 飙升查学习率与 clip；NaN 先查 logprob 是否为负无穷、有无空回答或超长序列；吞吐掉一半查 rollout 的 KV 占用与同步瓶颈。下表是第一轮排查清单。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>症状</th><th>优先怀疑</th><th>处理</th></tr></thead>
<tbody>
<tr><td>奖励上升、held-out 评测下降</td><td>reward hacking</td><td>加 KL、长度惩罚，换规则奖励，人工抽检</td></tr>
<tr><td>KL 爆炸、输出崩坏</td><td>学习率过大、clip 失效、过 off-policy</td><td>降 lr，检查 ratio 分布，限制 staleness</td></tr>
<tr><td>吞吐周期性掉底</td><td>权重同步或长尾样本阻塞</td><td>异步或 partial rollout，按长度分桶</td></tr>
<tr><td>loss 出现 NaN</td><td>logprob 异常、除零、fp8 溢出</td><td>过滤空样本，检查 std+ε，回退 bf16</td></tr>
<tr><td>训练日志与 rollout 日志对不上</td><td>两套引擎的 logprob 不一致</td><td>trainer 重算 logprob，统一精度并加修正</td></tr>
</tbody>
</table></div>
</section>

<section class="sec">
<h2>框架选型与落地顺序</h2>
<p>verl（HybridFlow）是当前大规模 RL 训练最常被引用的框架之一。它用单控制器描述数据流，底层用 Ray 调度，训练后端支持 FSDP 与 Megatron-LM，rollout 支持 vLLM 与 SGLang，并用 3D-HybridEngine 处理训练/推理并行度之间的权重重切分；表达力强，代价是配置多、上手陡。</p>
<p>OpenRLHF 走另一条路：Ray 编排、vLLM rollout、DeepSpeed 训练，把 PPO、GRPO、REINFORCE++ 封装成简单入口。代码量小、改起来快，适合研究与中小规模生产；需要复杂 PP/EP 或极致吞吐时，回到 verl 或自研。</p>
<p>Ray 不是 RL 库，而是分布式编排层：Actor、placement group、对象存储、故障恢复；verl、OpenRLHF、AReaL、SkyRL 都可建在它上面。选型先分清“算法库”和“编排层”。TRL 适合快速实验，DeepSpeed-Chat 是早期参考，NeMo-Aligner 绑定 NVIDIA 生态，AReaL 主打异步，slime 是 THUDM 的 RL 后训练框架。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>框架</th><th>定位</th><th>训练后端</th><th>rollout 后端</th><th>适合</th></tr></thead>
<tbody>
<tr><td>verl</td><td>大规模、可定制的 RL 训练框架</td><td>FSDP / Megatron-LM</td><td>vLLM / SGLang</td><td>集群级训练、复杂并行</td></tr>
<tr><td>OpenRLHF</td><td>轻量、易改的 RLHF 库</td><td>DeepSpeed</td><td>vLLM</td><td>快速实验、中小规模生产</td></tr>
<tr><td>Ray</td><td>分布式编排层</td><td>不提供</td><td>不提供</td><td>自研框架的调度与容错</td></tr>
<tr><td>TRL</td><td>Hugging Face 生态的算法库</td><td>Accelerate / DeepSpeed</td><td>多种</td><td>小规模实验</td></tr>
<tr><td>AReaL</td><td>异步 RL 训练</td><td>自研加多种后端</td><td>自研推理后端</td><td>追求 rollout 与训练重叠</td></tr>
</tbody>
</table></div>
<p>落地顺序：先用 1–7B、单机 8 卡、同步模式跑通“生成 → 打分 → 更新 → 同步”闭环，确认 logprob、KL、奖励曲线；再把 rollout 拆成独立引擎，量一次同步开销；按 token 账决定加卡、上异步还是缩短序列；最后才调 clip、KL、batch。跳过前三步直接上规模，容易把基础设施问题误判成算法不收敛。</p>
<h3>自测</h3>
<details class="quiz"><summary>Q1 · 7B 全参数 PPO，bf16 混合精度，四个模型的静态显存大约是多少？</summary><div class="quiz__a">单个训练态模型 16 B/参数，7B 约 112 GB；actor 与 critic 各 112 GB，reference 与 reward model 各约 14 GB，合计约 252 GB。这里只算权重、梯度与 Adam 状态，不含激活与 rollout KV。</div></details>
<details class="quiz"><summary>Q2 · GRPO 为什么能去掉 critic？省下的是什么，代价又是什么？</summary><div class="quiz__a">GRPO 对同一 prompt 采 G 条回答，用组内奖励均值作 baseline、标准差归一化，直接估计相对优势，不需要 value function 与 GAE，于是省掉一个训练态模型（7B 约 112 GB）。代价是每条 prompt 必须采 G 条回答，rollout token 线性增长；奖励不能规则化时 RM 显存还要加回来。</div></details>
<details class="quiz"><summary>Q3 · 同步 RL 一个 step 里生成 18 s、训练 12 s、同步 2 s。改成理想异步后墙钟大约多少？能无条件相信这个收益吗？</summary><div class="quiz__a">同步墙钟约 18+12+2=32 s；理想异步下生成与训练重叠，墙钟接近 max(18,12) 加少量同步，约 20 s，理论加速约 1.6 倍。但不能无条件相信：异步消费 m 步前的数据，off-policy 程度上升，可能需要更保守的 clip 或重要性采样修正，收敛与质量可能下降；长尾与缓冲管理也会吃掉收益。要同时看吞吐与评测曲线。</div></details>
<details class="quiz"><summary>Q4 · rollout 用 fp8、训练用 bf16，为什么可能让 PPO 训练变得不稳定？</summary><div class="quiz__a">重要性比 ρ 要求 rollout 记录的 logprob 与 trainer 重算的 logprob 来自同一策略。两套引擎、不同精度与 kernel 会让同一 token 的 logprob 差 10⁻³ 到 10⁻²，ρ 系统性偏离 1，clip 被错误触发。常见处理是 trainer 重算采样 token 的 logprob、统一 bf16、对 ratio 截断，或做一致性修正；长序列会累积误差。</div></details>
<h3>延伸阅读</h3>
<ul class="refs">
<li><b>Training language models to follow instructions with human feedback (InstructGPT)</b> — Ouyang 等, OpenAI, 2022（arXiv:2203.02155）。三阶段 RLHF 与 PPO 四模型的奠基论文，含 KL 惩罚与人类评测。</li>
<li><b>DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models</b> — Shao 等, DeepSeek, 2024（arXiv:2402.03300）。提出 GRPO，用组内相对奖励估计优势。</li>
<li><b>HybridFlow: A Flexible and Efficient RLHF Framework (verl)</b> — Sheng 等, ByteDance, 2024（arXiv:2409.19256）。单控制器、3D-HybridEngine 重切分与 colocate 设计的系统论文。</li>
<li><b>OpenRLHF: An Easy-to-use, Scalable and High-performance RLHF Framework</b> — Hu 等, 2024（arXiv:2405.11143）。Ray + vLLM + DeepSpeed 的轻量实现，适合对照阅读工程落地。</li>
<li><b>Proximal Policy Optimization Algorithms</b> — Schulman 等, OpenAI, 2017（arXiv:1707.06347）。PPO 原始论文，clip 目标与重要性采样的定义。</li>
</ul>
</section>`
};
