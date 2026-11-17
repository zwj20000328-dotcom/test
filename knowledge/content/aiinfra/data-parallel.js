window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["data-parallel"] = {
  slug: "data-parallel",
  title: "数据并行与梯度同步",
  subtitle: "最常用也最容易踩坑的并行方式",
  level: 3,
  cluster: "训练",
  tags: ["DDP", "FSDP", "梯度累积"],
  summary: "数据并行把完整模型复制到每张卡，再同步梯度。讲清 DDP 的 bucket 重叠、梯度累积的等价条件、global batch 缩放与 FSDP 分片。",
  keyPoints: [
    "数据并行不省单卡显存，只把墙钟时间按卡数摊薄；每步通信量只与参数量有关，与 batch 大小无关",
    "DDP 用 bucket 把梯度 all-reduce 藏进反向传播；FSDP 用 all-gather 与 reduce-scatter 把状态切成 1/N",
    "梯度累积的等价性有前提：loss 要按累积步数缩放、BN 统计会变、scheduler 只跟优化器步走",
    "global batch 决定学习率与泛化，改并行度时保持 global batch 不变，超参才可迁移",
    "drop_last、各 rank 步数一致、checkpoint 内容完整，决定了长训练能不能活着跑完"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>一句话直觉：把同一份模型复制 N 份，各看一部分数据</h2>
<p>数据并行（data parallel）做的事情可以用一句话概括：<mark>每张 GPU 持有一份完整的模型副本，各自吃不同的数据分片，反向传播后把所有副本的梯度求平均，再用这个平均梯度各自更新参数</mark>。因为每张卡拿到的平均梯度完全相同、初始参数也相同，所以每一步结束后参数依然逐位一致，训练逻辑上等价于“用一个大 batch 在单卡上训练”。</p>
<p>它解决的是“单卡算得太慢”，不是“单卡装不下”。每张卡仍然要存完整的参数、梯度与优化器状态，显存开销一点没少；真正省显存的是后面的 FSDP、ZeRO 或模型并行。第一次上多卡发现 OOM 没缓解，往往就是把它当成了显存优化手段。</p>
<p>数学上为什么可以平均？设全局 batch 有 B 个样本，损失定义为样本损失的均值 L = (1/B)Σᵢ ℓᵢ。求导是线性运算，所以全局梯度等于各卡本地梯度的加权平均。只要每张卡的 micro-batch 大小相同、loss 用按样本的 mean reduction，直接对梯度做 all-reduce 求平均就与单卡大 batch 完全等价；如果各卡样本数不同，就必须按样本数加权，否则相当于给某些样本重复加权。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>四个学生做同一套卷子的不同部分，各自总结“我这份错在哪”，然后取平均，再一起改同一本教材。平均梯度不是“某一个人的梯度”，而是整个 global batch 的梯度——前提是每个人分到的题量一样。</div></div>
<p>顺带排除一个历史包袱：PyTorch 早期的 <code>nn.DataParallel</code> 是单进程多线程，受 Python GIL 与前向 scatter、反向 gather 的主卡瓶颈限制，多卡利用率很差，官方已不建议使用。今天说数据并行，默认指 <code>DistributedDataParallel</code>（DDP），每张卡一个独立进程，用 NCCL 通信。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="数据并行原理：四张卡各自计算本地梯度，all-reduce 求平均后更新相同参数">
<defs>
<marker id="data-parallel-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"></path></marker>
</defs>
<rect x="10" y="10" width="740" height="360" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="380" y="34" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-muted)">同一份参数，四份不同的数据</text>
<rect x="40" y="50" width="155" height="58" rx="8" fill="var(--sv-a)" fill-opacity="0.18" stroke="var(--sv-a)"></rect>
<text x="117" y="74" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">GPU 0</text>
<text x="117" y="94" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">数据分片 D₀</text>
<rect x="215" y="50" width="155" height="58" rx="8" fill="var(--sv-a)" fill-opacity="0.18" stroke="var(--sv-a)"></rect>
<text x="292" y="74" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">GPU 1</text>
<text x="292" y="94" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">数据分片 D₁</text>
<rect x="390" y="50" width="155" height="58" rx="8" fill="var(--sv-a)" fill-opacity="0.18" stroke="var(--sv-a)"></rect>
<text x="467" y="74" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">GPU 2</text>
<text x="467" y="94" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">数据分片 D₂</text>
<rect x="565" y="50" width="155" height="58" rx="8" fill="var(--sv-a)" fill-opacity="0.18" stroke="var(--sv-a)"></rect>
<text x="642" y="74" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">GPU 3</text>
<text x="642" y="94" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">数据分片 D₃</text>
<line x1="117" y1="108" x2="117" y2="132" stroke="var(--sv-line)" marker-end="url(#data-parallel-arrow)"></line>
<line x1="292" y1="108" x2="292" y2="132" stroke="var(--sv-line)" marker-end="url(#data-parallel-arrow)"></line>
<line x1="467" y1="108" x2="467" y2="132" stroke="var(--sv-line)" marker-end="url(#data-parallel-arrow)"></line>
<line x1="642" y1="108" x2="642" y2="132" stroke="var(--sv-line)" marker-end="url(#data-parallel-arrow)"></line>
<rect x="40" y="136" width="155" height="42" rx="8" fill="var(--sv-a2)" fill-opacity="0.18" stroke="var(--sv-a2)"></rect>
<text x="117" y="162" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">本地梯度 g₀</text>
<rect x="215" y="136" width="155" height="42" rx="8" fill="var(--sv-a2)" fill-opacity="0.18" stroke="var(--sv-a2)"></rect>
<text x="292" y="162" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">本地梯度 g₁</text>
<rect x="390" y="136" width="155" height="42" rx="8" fill="var(--sv-a2)" fill-opacity="0.18" stroke="var(--sv-a2)"></rect>
<text x="467" y="162" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">本地梯度 g₂</text>
<rect x="565" y="136" width="155" height="42" rx="8" fill="var(--sv-a2)" fill-opacity="0.18" stroke="var(--sv-a2)"></rect>
<text x="642" y="162" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">本地梯度 g₃</text>
<line x1="117" y1="178" x2="300" y2="208" stroke="var(--sv-line)" marker-end="url(#data-parallel-arrow)"></line>
<line x1="292" y1="178" x2="345" y2="208" stroke="var(--sv-line)" marker-end="url(#data-parallel-arrow)"></line>
<line x1="467" y1="178" x2="415" y2="208" stroke="var(--sv-line)" marker-end="url(#data-parallel-arrow)"></line>
<line x1="642" y1="178" x2="460" y2="208" stroke="var(--sv-line)" marker-end="url(#data-parallel-arrow)"></line>
<rect x="190" y="212" width="380" height="54" rx="8" fill="var(--sv-b)" fill-opacity="0.16" stroke="var(--sv-b)"></rect>
<text x="380" y="236" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-ink)">All-Reduce 求平均</text>
<text x="380" y="255" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">g = (g₀ + g₁ + g₂ + g₃) / 4</text>
<line x1="380" y1="266" x2="380" y2="296" stroke="var(--sv-line)" marker-end="url(#data-parallel-arrow)"></line>
<rect x="190" y="300" width="380" height="48" rx="8" fill="var(--sv-c)" fill-opacity="0.16" stroke="var(--sv-c)"></rect>
<text x="380" y="321" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">每张卡用同一个 g 更新本地参数</text>
<text x="380" y="339" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">参数始终一致，等价于一个大 batch</text>
</svg><figcaption>图 1 · 数据并行的单步逻辑：数据不同、梯度求平均、更新相同</figcaption></figure>
</section>

<section class="sec">
<h2>DDP 的单步时序：bucket 与反向重叠</h2>
<p>朴素实现是：前向、反向全部算完，再对全部梯度做一次 all-reduce，然后 step。这样做通信完全串行，GPU 在通信期间空转。DDP 的关键设计是把梯度同步拆成小块，塞进反向传播的空隙里，也就是常说的<mark>通信与计算重叠</mark>。</p>
<p>具体机制是：构造 DDP 时，框架按参数的反向就绪顺序把梯度张量划分进若干 bucket（默认 <code>bucket_cap_mb=25</code>）；每个参数在 autograd 里注册 hook，当它的梯度算完就拷进对应 bucket；某个 bucket 装满后立刻对该 bucket 发起 all-reduce，此时反向传播还在计算更靠前的层。由于反向是从最后一层往前算，最早被填满的 bucket 对应网络最后几层，它的 all-reduce 往往在反向刚开始不久就发出。</p>
<p>为什么要 bucket 而不是每个梯度张量单独通信？小张量的 all-reduce 受延迟支配，带宽利用率极低，几百次小集合通信的启动开销能把重叠收益吃光；合并成 25 MB 级别的大块能摊薄延迟。但 bucket 太大也有代价：第一个 bucket 要等更久才装满，尾部通信更容易暴露在反向结束之后。25 MB 是经验折中，不是定律。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="DDP 单步甘特图：前向、反向按层进行，bucket 装满即 all-reduce 并与后续反向重叠">
<defs>
<marker id="data-parallel-arrow2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"></path></marker>
</defs>
<rect x="10" y="10" width="740" height="360" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="20" y="40" font-size="13" font-family="inherit" fill="var(--sv-ink)">计算流</text>
<text x="20" y="165" font-size="13" font-family="inherit" fill="var(--sv-ink)">通信流</text>
<text x="20" y="243" font-size="13" font-family="inherit" fill="var(--sv-ink)">更新</text>
<rect x="70" y="55" width="200" height="38" rx="6" fill="var(--sv-a)" fill-opacity="0.25" stroke="var(--sv-a)"></rect>
<text x="170" y="79" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">前向（无梯度通信）</text>
<rect x="270" y="55" width="78" height="38" rx="6" fill="var(--sv-a2)" fill-opacity="0.25" stroke="var(--sv-a2)"></rect>
<rect x="348" y="55" width="78" height="38" rx="6" fill="var(--sv-a2)" fill-opacity="0.4" stroke="var(--sv-a2)"></rect>
<rect x="426" y="55" width="78" height="38" rx="6" fill="var(--sv-a2)" fill-opacity="0.25" stroke="var(--sv-a2)"></rect>
<rect x="504" y="55" width="78" height="38" rx="6" fill="var(--sv-a2)" fill-opacity="0.4" stroke="var(--sv-a2)"></rect>
<rect x="582" y="55" width="78" height="38" rx="6" fill="var(--sv-a2)" fill-opacity="0.25" stroke="var(--sv-a2)"></rect>
<text x="465" y="79" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">反向（梯度逐层就绪）</text>
<text x="466" y="112" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">越靠后的层越早算完，bucket 从后往前发</text>
<line x1="348" y1="93" x2="348" y2="137" stroke="var(--sv-line)" stroke-dasharray="4 3" marker-end="url(#data-parallel-arrow2)"></line>
<line x1="504" y1="93" x2="504" y2="137" stroke="var(--sv-line)" stroke-dasharray="4 3" marker-end="url(#data-parallel-arrow2)"></line>
<line x1="582" y1="93" x2="582" y2="137" stroke="var(--sv-line)" stroke-dasharray="4 3" marker-end="url(#data-parallel-arrow2)"></line>
<rect x="348" y="140" width="80" height="32" rx="6" fill="var(--sv-b)" fill-opacity="0.3" stroke="var(--sv-b)"></rect>
<text x="388" y="161" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">bucket 3</text>
<rect x="504" y="140" width="70" height="32" rx="6" fill="var(--sv-b)" fill-opacity="0.3" stroke="var(--sv-b)"></rect>
<text x="539" y="161" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">bucket 2</text>
<rect x="582" y="140" width="78" height="32" rx="6" fill="var(--sv-b)" fill-opacity="0.3" stroke="var(--sv-b)"></rect>
<text x="621" y="161" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">bucket 1</text>
<text x="388" y="192" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">装满即发</text>
<text x="621" y="192" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">最早层，最后发</text>
<line x1="70" y1="290" x2="720" y2="290" stroke="var(--sv-line)" marker-end="url(#data-parallel-arrow2)"></line>
<text x="712" y="310" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-muted)">时间（示意）</text>
<line x1="660" y1="93" x2="660" y2="210" stroke="var(--sv-line)" stroke-dasharray="4 3"></line>
<rect x="620" y="215" width="110" height="34" rx="6" fill="var(--sv-c)" fill-opacity="0.25" stroke="var(--sv-c)"></rect>
<text x="675" y="237" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-ink)">本地更新参数</text>
<text x="20" y="330" font-size="12" font-family="inherit" fill="var(--sv-muted)">总时长 ≈ 前向 + 反向 + 未被掩盖的尾部通信；调 bucket 的目标就是压缩尾部</text>
</svg><figcaption>图 2 · DDP 单步时序：反向还在算，前面的 bucket 已经在通信</figcaption></figure>
<p>还有两个常被忽略的开关。<code>gradient_as_bucket_view=True</code> 让梯度直接以 bucket 视图存在，省掉一次全量拷贝的显存与带宽；<code>static_graph=True</code> 在计算图固定时允许 DDP 做更激进的 bucket 规划，但计算图一旦变化（某些参数时有时无）就不再适用。</p>
<div class="callout callout--formula"><span class="callout__label">关键量</span><div>一次 ring all-reduce 中，每张卡收发的数据量约为 2 × (N−1)/N × S，S 是梯度总字节数。N 很大时约等于 2S。<b>它只与参数量有关，与你把 batch 调多大完全无关</b>——所以 batch 越大，摊到每个样本上的通信成本越低。</div></div>
</section>

<section class="sec">
<h2>梯度累积：用时间换显存，但等价性有前提</h2>
<p>当单卡连一个像样的 batch 都放不下时，梯度累积（gradient accumulation）是最省事的办法：把一个大 batch 切成 A 个 micro-batch，依次前向和反向，梯度在本地累加，第 A 次之后才 <code>optimizer.step()</code>。显存峰值只取决于一个 micro-batch，而优化器看到的是 A 倍大的 batch。</p>
<div class="formula">B_global = B_device × A × N
其中 B_device 为单卡 micro-batch，A 为累积步数，N 为数据并行卡数</div>
<p>要做到“与真的大 batch 等价”，至少满足四条：loss 必须按样本求平均并且除以 A（或先用 sum 再在 step 前除）；优化器与学习率调度器只在累积结束时各走一步；梯度裁剪必须放在所有 micro-batch 的梯度都加完之后；所有 rank 的累积步数一致。前两条最常错：忘了除 A，相当于把学习率悄悄放大了 A 倍，训练初期 loss 可能看着正常，几千步后开始发散。</p>
<p>DDP 与梯度累积一起用时，前 A−1 个 micro-batch 不应该触发 all-reduce，否则通信量直接乘以 A。标准写法是用 <code>model.no_sync()</code> 包住前 A−1 次反向，只在最后一次走同步路径。这个上下文管理器不是“关掉通信”，而是“延后通信”，最后一次仍会把累积好的完整梯度同步出去。</p>
<div class="callout callout--warn"><span class="callout__label">陷阱</span><div>梯度累积不是无条件等价。BatchNorm 的均值方差按 micro-batch 统计，A 越大偏差越大，需要用 SyncBatchNorm 或改成 LayerNorm/RMSNorm；Dropout 的 mask 每个 micro-batch 独立采样，期望相同但方差变大；如果模型里有跨样本的损失（如对比学习中的 in-batch 负样本），累积会直接改变语义。</div></div>
<p>还有两个隐蔽点。第一，学习率调度器如果按 micro-step 走，warmup 与余弦周期都会被拉长 A 倍，正确做法是按优化器步数计。第二，梯度累积会拉长单步墙钟时间，但不会改变每步通信量；吞吐不随卡数线性提升时，先查数据管线与通信。</p>
</section>

<section class="sec">
<h2>global batch 与线性缩放：改并行度时最该守住的不变量</h2>
<p>global batch 指一次优化器更新所见到的样本总数，它同时由单卡 batch、累积步数和数据并行度决定。它之所以重要，是因为它决定了梯度的噪声水平，进而决定合适的学习率。业界最常引用的经验是线性缩放（linear scaling）：batch 扩大 k 倍，学习率也扩大 k 倍，并配合 warmup。</p>
<div class="formula">lr = lr_base × (B_global / B_base)
Goyal et al. 2017：ResNet-50 / ImageNet，batch 256 → 8192，lr 0.1 → 0.8，warmup 5 个 epoch</div>
<p>为什么可以这样放大？大 batch 的梯度是更多样本的平均，方差按 1/B 下降，方向更稳，所以可以走更大的步而不至于震荡。但线性缩放不是无限的：batch 大到一定程度收益递减，Goyal 用普通 SGD 加 warmup 做到 8192，再往上放大到 32K 这类量级通常要换 LARS 等层自适应优化器；语言模型上常见“先线性、后平方根”，并且必须重调 warmup 与 weight decay。Goyal 的结论有明确边界：ImageNet 分类、ResNet-50、SGD，不要当成通用定律。</p>
<p>工程上真正有用的做法是：<b>把 global batch 当成实验的一等公民固定下来</b>。换卡数、换显存、开不开梯度累积，都通过调整 B_device 与 A 让 B_global 保持不变，这样学习率、warmup、训练 token 数这些超参可以在不同规模的集群之间迁移。只有当你确实想缩短训练时间、主动放大 global batch 时，才去动学习率。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>并行方式</th><th>单卡显存</th><th>每步每卡通信量（N 卡）</th><th>主要收益</th><th>典型场景</th></tr></thead><tbody><tr><td>DDP</td><td>完整参数 + 梯度 + 优化器状态</td><td>≈ 2P 字节/卡</td><td>缩短墙钟时间</td><td>模型与状态能放进单卡</td></tr><tr><td>FSDP / ZeRO-3</td><td>状态的 1/N + 一层完整参数</td><td>≈ 3P（开重计算可能接近 4P）</td><td>把放不下的模型放下</td><td>状态放不进单卡的全参训练</td></tr><tr><td>梯度累积</td><td>完整状态，激活只按 micro-batch</td><td>每 A 个 micro-batch 同步一次，均摊 2P/A</td><td>用小显存换大 batch</td><td>单卡 batch 受激活限制</td></tr></tbody></table></div>
<p>注意表里的 P 是参数总字节数（例如 70B 的 bf16 参数为 140 GB），不是参数个数。</p>
</section>

<section class="sec">
<h2>FSDP / ZeRO-3：当一份完整副本都放不下</h2>
<p>DDP 的前提是每张卡都放得下完整状态。以 70B 全参微调为例，bf16 权重、bf16 梯度、fp32 主权重与 Adam 的一阶二阶动量加在一起约 16 字节/参数，合计约 1.12 TB，单张 80 GB 的 H100 连零头都放不下，DDP 直接出局。这时需要把状态切开，代表方案是 PyTorch 的 FSDP（Fully Sharded Data Parallel）与 DeepSpeed 的 ZeRO-3，两者思想一致。</p>
<p>FSDP 先把一组参数展平成一个 FlatParameter，再把它的分片按 rank 切开，每张卡只长期持有 1/N 的参数、梯度与优化器状态。计算某一层之前，通过 all-gather 把该层的完整参数临时拼出来；前向用完立即释放，反向需要时再 gather 一次；反向得到的梯度用 reduce-scatter 归约，并且每张卡只保留自己负责的那一片。参数更新只在本地的分片上做，优化器状态也天然是分片的。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="FSDP 分片与 all-gather：四张卡各存四分之一状态，计算前拼出完整层参数，算完释放，梯度 reduce-scatter">
<defs>
<marker id="data-parallel-arrow3" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"></path></marker>
</defs>
<rect x="10" y="10" width="740" height="360" rx="10" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="380" y="32" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-muted)">每张卡长期只持有 1/4 的参数、梯度与优化器状态</text>
<rect x="40" y="45" width="150" height="64" rx="8" fill="var(--sv-a)" fill-opacity="0.2" stroke="var(--sv-a)"></rect>
<text x="115" y="70" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">Rank 0 分片</text>
<text x="115" y="90" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">1/4 状态</text>
<rect x="210" y="45" width="150" height="64" rx="8" fill="var(--sv-a)" fill-opacity="0.2" stroke="var(--sv-a)"></rect>
<text x="285" y="70" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">Rank 1 分片</text>
<text x="285" y="90" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">1/4 状态</text>
<rect x="380" y="45" width="150" height="64" rx="8" fill="var(--sv-a)" fill-opacity="0.2" stroke="var(--sv-a)"></rect>
<text x="455" y="70" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">Rank 2 分片</text>
<text x="455" y="90" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">1/4 状态</text>
<rect x="550" y="45" width="150" height="64" rx="8" fill="var(--sv-a)" fill-opacity="0.2" stroke="var(--sv-a)"></rect>
<text x="625" y="70" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">Rank 3 分片</text>
<text x="625" y="90" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">1/4 状态</text>
<line x1="115" y1="109" x2="260" y2="143" stroke="var(--sv-line)" marker-end="url(#data-parallel-arrow3)"></line>
<line x1="285" y1="109" x2="330" y2="143" stroke="var(--sv-line)" marker-end="url(#data-parallel-arrow3)"></line>
<line x1="455" y1="109" x2="430" y2="143" stroke="var(--sv-line)" marker-end="url(#data-parallel-arrow3)"></line>
<line x1="625" y1="109" x2="500" y2="143" stroke="var(--sv-line)" marker-end="url(#data-parallel-arrow3)"></line>
<rect x="150" y="147" width="460" height="46" rx="8" fill="var(--sv-b)" fill-opacity="0.2" stroke="var(--sv-b)"></rect>
<text x="380" y="167" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">all-gather：临时拼出该层完整参数</text>
<text x="380" y="185" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">只多一层的显存峰值，不是整个模型</text>
<line x1="380" y1="193" x2="380" y2="217" stroke="var(--sv-line)" marker-end="url(#data-parallel-arrow3)"></line>
<rect x="150" y="221" width="460" height="46" rx="8" fill="var(--sv-a2)" fill-opacity="0.2" stroke="var(--sv-a2)"></rect>
<text x="380" y="241" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">该层前向 / 反向计算</text>
<text x="380" y="259" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">算完立即释放完整参数</text>
<line x1="380" y1="267" x2="380" y2="291" stroke="var(--sv-line)" marker-end="url(#data-parallel-arrow3)"></line>
<rect x="150" y="295" width="460" height="46" rx="8" fill="var(--sv-c)" fill-opacity="0.2" stroke="var(--sv-c)"></rect>
<text x="380" y="315" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">reduce-scatter 梯度</text>
<text x="380" y="333" text-anchor="middle" font-size="12" font-family="inherit" fill="var(--sv-muted)">每张卡只留下自己负责的那 1/N</text>
</svg><figcaption>图 3 · FSDP 的循环：all-gather → 计算 → 释放 → reduce-scatter，逐层重复</figcaption></figure>
<p>代价是通信变多。DDP 每步约 2P，FSDP 每步约 3P（前向 gather、反向 gather、梯度 reduce-scatter 各 P）；若开启激活重计算，反向时还要再前向一遍，会多一次 gather，实际接近 4P。换来的是优化器状态显存降到 1/N，这才让 70B 级别的全参微调在几十张卡上成为可能。</p>
<p>FSDP 的效果高度依赖切分粒度：通常以 Transformer block 为单位 wrap，太粗则单层参数本身就能撑爆显存，太细则 all-gather 次数暴涨、小消息延迟吃掉带宽。此外还有 HYBRID_SHARD（节点内全分片、节点间复制）与 CPU offload 等变体，前者省跨节点带宽，后者省显存但受 PCIe 带宽限制。<mark>ZeRO 的三个 stage 与 FSDP 的对应关系、offload 的细节，留给 zero-memory 一篇展开，这里只做对比。</mark></p>
<div class="callout callout--tip"><span class="callout__label">选型</span><div>能 DDP 就 DDP：实现最简单、通信最少、排障最容易。只有当“完整状态 + 激活”放不进单卡时才上 FSDP；不要为了“看起来先进”在 1B 级模型或 LoRA 微调上开全分片，通信开销可能让吞吐反而下降。</div></div>
</section>

<section class="sec">
<h2>算一笔账：70B 全参微调的显存与通信</h2>
<p>假设：70B 参数，bf16 混合精度训练，fp32 Adam，64 张 H100 80 GB（8 节点 × 8 卡），节点内 NVLink 约 900 GB/s（每卡双向合计），节点间 InfiniBand NDR 400 Gb/s（单向理论约 50 GB/s）。显存账本的口径见 zero-memory 一篇，这里直接代入 70B。混合精度全参微调通常保留一份 bf16 权重用于计算、一份 bf16 梯度、一份 fp32 主权重，以及 Adam 的一阶、二阶动量。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>项目</th><th>精度</th><th>每参数字节</th><th>70B 合计</th></tr></thead><tbody><tr><td>计算权重</td><td>bf16</td><td>2</td><td>140 GB</td></tr><tr><td>梯度</td><td>bf16</td><td>2</td><td>140 GB</td></tr><tr><td>主权重</td><td>fp32</td><td>4</td><td>280 GB</td></tr><tr><td>Adam 一阶动量 m</td><td>fp32</td><td>4</td><td>280 GB</td></tr><tr><td>Adam 二阶动量 v</td><td>fp32</td><td>4</td><td>280 GB</td></tr><tr><td><b>合计</b></td><td>—</td><td><b>16</b></td><td><b>约 1.12 TB</b></td></tr></tbody></table></div>
<p>这张表按标准口径计：梯度随参数用 bf16 保存，每参数 16 字节。若梯度也保留 fp32（部分框架的保守做法），每参数是 18 字节，70B 合计约 1.26 TB；两种口径在工程里都常见，关键是同一篇账里不要混用。</p>
<div class="formula">M_state ≈ 16 字节 × 70×10⁹ 个参数 ≈ 1.12 TB（不含激活）
FSDP 全分片后每卡 ≈ 1.12 TB / 64 ≈ 17.5 GB，再加激活与临时缓冲</div>
<p>对比 DDP：它要求每张卡都存完整一份状态，1.12 TB 远超 80 GB，单卡就已出局，扩到 8 卡或 16 卡也不会减少每卡占用——<b>DDP 只复制、不切分</b>。只有 FSDP 把状态切到 64 张卡，每卡约 17.5 GB，配合激活重计算才留得出余量。这就是“70B 全参必须分片”的量化理由。</p>
<p>再算通信（DDP 仅作对照）。DDP 每步每卡约 2P = 280 GB，在 50 GB/s 的跨节点链路上约 5.6 秒；FSDP 约 3P = 420 GB，约 8.4 秒。计算侧，按 6 × 参数量 × token 数（即 6ND）估算：global batch 取 400 万 token，FLOPs ≈ 6 × 70×10⁹ × 4×10⁶ ≈ 1.68×10¹⁸。H100 SXM 的 BF16 稠密算力约 989 TFLOPS（1,979 TFLOPS 是含稀疏的口径，495 TFLOPS 对应的是 TF32 稠密），按 40% MFU 折合约 396 TFLOPS/卡，64 卡约 25 PFLOPS，单步约 66 秒。也就是说通信（FSDP 约 8 秒）只占计算时间的十分之一量级，只要重叠做得好，FSDP 的额外通信通常不是瓶颈；真正拖慢训练的是激活重计算、数据管线与负载不均。</p>
<div class="callout callout--warn"><span class="callout__label">口径提醒</span><div>上面的 5.6/8.4 秒与 66 秒都是量级估算：实际取决于 MFU、序列长度、并行策略组合（是否叠张量并行）、网络拓扑与是否跨 rail。做容量规划时按“计算为主、通信可被掩盖”判断方向，再用真实 profiler 定数字，不要拿估算值当 SLA。</div></div>
</section>

<section class="sec">
<h2>工程实践：数据加载、确定性与故障恢复</h2>
<p>多卡训练最常见的“玄学卡死”，根源往往不在通信库，而在数据。第一，每个 rank 必须拿到数量相同的 batch，否则先跑完的 rank 在 all-reduce 里等，其余 rank 永远等不到它——训练就挂住了。用 <code>DistributedSampler</code> 分片，并设置 <code>drop_last=True</code>，或者保证数据集长度能被 world_size × batch_size 整除；如果业务上不能丢样本，就要用 <code>join</code> 上下文让先完成的 rank 以影子身份继续参与集合通信（贡献零梯度），而不是让其余 rank 硬等。</p>
<p>第二，<code>DistributedSampler</code> 必须在每个 epoch 调用 <code>set_epoch(epoch)</code>，否则每个 epoch 的 shuffle 顺序完全相同，等于没有 shuffle；断点续训时还要把 epoch 与已消费的 step 存下来，否则恢复后数据顺序会错位。第三，<code>drop_last</code> 会丢掉尾部不足一个 batch 的样本，小数据集上这个比例不可忽略，要算清楚代价再决定。</p>
<p>确定性方面，种子、<code>worker_init_fn</code>、DataLoader 的 generator 都要设；<code>cudnn.benchmark=False</code>、<code>torch.use_deterministic_algorithms(True)</code> 能消掉一部分不确定性，但会变慢，而且某些算子没有确定性实现会直接报错。要接受一个事实：NCCL 的 ring/tree all-reduce 归约顺序随拓扑与卡数变化，<b>跨不同 world size 无法做到逐位一致</b>；同一 world size 下也未必保证。可复现的目标应定为“损失曲线在统计意义上一致”，而不是 bitwise 相同。</p>
<pre class="code" data-lang="bash"><code># 8 节点 x 8 卡，弹性训练，进程崩溃后最多重启 3 次
torchrun \
  --nnodes=8 --nproc_per_node=8 \
  --rdzv_backend=c10d --rdzv_endpoint=$MASTER_ADDR:29500 \
  --max_restarts=3 \
  train.py \
  --per-device-batch-size=16 \
  --grad-accum=8 \
  --seq-len=4096 \
  --gradient-checkpointing \
  --resume-from=/ckpt/step_12000</code></pre>
<p>故障恢复的核心是 checkpoint 里到底存了什么。至少要有：模型参数、优化器状态、学习率调度器状态、全局 step、每个 rank 的 RNG 状态、sampler 的 epoch 与已消费位置。少存 RNG，恢复后的 dropout 序列就变了；少存 sampler 位置，数据会重复或跳过。FSDP 要用 <code>FSDP.state_dict_type()</code> 明确选择 <code>SHARDED_STATE_DICT</code> 或 <code>FULL_STATE_DICT</code>：前者每个 rank 只存自己那一片，恢复时要求分片数一致；后者把完整参数聚合到 rank 0（70B 规模会直接爆显存）。换卡数恢复时，state dict 的类型与分片布局必须对得上，不能想当然地把裸 <code>model.state_dict()</code> 存下来了事。</p>
<ul>
<li>大模型 checkpoint 动辄数百 GB，同步写会阻塞训练：用后台线程/进程异步保存，或先写本地再异步上传对象存储。</li>
<li>保存频率按“故障恢复损失的时间 &lt; 保存开销”来定，常见是每 1000 到 5000 步；节点故障在大集群上是常态。</li>
<li>弹性训练（elastic）能自动重启并重新 rendezvous，但不会自动回滚到最近 checkpoint，恢复逻辑要自己写进训练脚本。</li>
</ul>
<h3>常见误区与排障顺序</h3>
<ul>
<li><b>loss 没除以累积步数</b>：等效学习率被放大 A 倍，表现为初期正常、后期发散。先打印实际 lr 与梯度范数。</li>
<li><b>scheduler 按 micro-step 走</b>：warmup 被拉长 A 倍。确认 <code>scheduler.step()</code> 与 <code>optimizer.step()</code> 同频。</li>
<li><b>忘记 no_sync</b>：通信量 ×A，吞吐掉得莫名其妙。看 NCCL 调用次数即可确认。</li>
<li><b>某个 rank 少一个 batch</b>：训练卡死且无报错。检查数据集长度与 drop_last，开 <code>TORCH_NCCL_ASYNC_ERROR_HANDLING</code> 让超时暴露出来。</li>
<li><b>BN 统计不准</b>：小 micro-batch 加累积时尤其明显，验证集指标异常而训练 loss 正常。换 SyncBN 或 Norm 类型。</li>
<li><b>find_unused_parameters=True 滥用</b>：每步多一次图遍历，还可能掩盖真正的逻辑分支。优先改模型去掉未使用参数。</li>
<li><b>FSDP wrap 粒度不对</b>：太粗 OOM，太细通信碎。以 block 为单位起步，再用显存与吞吐曲线调。</li>
<li><b>只看 GPU 利用率不看数据管线</b>：利用率锯齿状、周期性跌到 0，通常是 DataLoader 或存储带宽不够，加 workers、pin_memory、预取或换数据格式。</li>
</ul>
</section>

<section class="sec">
<h2>自测与延伸阅读</h2>
<details class="quiz"><summary>Q1 · 16 卡、每卡 micro-batch 2、累积 8，global batch 是多少？若卡数翻倍到 32 且要保持 global batch 不变，可以怎么改？</summary><div class="quiz__a">global batch = 2 × 8 × 16 = 256。翻倍到 32 卡后，可把每卡 micro-batch 降到 1（1 × 8 × 32 = 256），或把累积步数降到 4（2 × 4 × 32 = 256）。前者省显存，后者省时间，取决于瓶颈在显存还是墙钟。注意如果只改卡数不改这两项，global batch 会变成 512，学习率就未必还合适。</div></details>
<details class="quiz"><summary>Q2 · 为什么 DDP 的每步通信量与 batch size 无关？这对大 batch 训练意味着什么？</summary><div class="quiz__a">DDP 同步的是梯度张量，其大小等于参数量乘以精度字节数，与喂了多少数据无关；ring all-reduce 每卡流量约 2(N−1)/N × S。因此 batch 越大，单步计算时间越长，通信被重叠掉的比例越高，摊到每个样本上的通信成本越低。这也是大 batch 在大集群上效率更高的原因之一，但收益会被泛化与优化难度限制。</div></details>
<details class="quiz"><summary>Q3 · 用梯度累积模拟大 batch 时，为什么 BatchNorm 会出问题？Dropout 呢？</summary><div class="quiz__a">BatchNorm 的均值方差是在每个 micro-batch 内统计的，累积只加梯度、不合并统计量，所以 A 个 micro-batch 的归一化统计与一个 A 倍大 batch 的统计不同，A 越大偏差越明显。解决方式是 SyncBatchNorm（跨卡统计但仍不等于跨累积）或改用 LayerNorm/RMSNorm。Dropout 每个 micro-batch 独立采样 mask，期望相同、方差更大，通常可接受，但在小模型或短训练上会影响复现性。</div></details>
<details class="quiz"><summary>Q4 · 70B 全参微调为什么不能直接用 8 张 80 GB 卡做 DDP？请用数字说明。</summary><div class="quiz__a">按标准 16 字节/参数口径：bf16 权重 140 GB、bf16 梯度 140 GB、fp32 主权重 280 GB、Adam m 与 v 各 280 GB，合计约 1.12 TB（不含激活）。DDP 每张卡都要存完整一份，单卡就需要 1.12 TB，远超 80 GB；增加卡数只是增加副本，不会降低单卡占用。所以必须用 FSDP/ZeRO 把状态切分到几十张卡，或改用 LoRA 这类只训练少量参数的方法。</div></details>
<ul class="refs">
<li><b>Distributed Data Parallel</b> — PyTorch 官方文档。DDP 的 API、bucket 机制、no_sync 与 join 上下文的权威说明。</li>
<li><b>PyTorch FSDP: Experiences on Scaling Fully Sharded Data Parallel</b> — Zhao et al., 2023（VLDB）。FSDP 的设计取舍、分片策略与大规模训练经验。</li>
<li><b>Megatron-LM: Training Multi-Billion Parameter Language Models Using Model Parallelism</b> — Shoeybi et al., 2019。大规模训练中数据并行与张量/流水并行如何组合的早期范本。</li>
<li><b>Accurate, Large Minibatch SGD: Training ImageNet in 1 Hour</b> — Goyal et al., 2017。线性缩放与 warmup 的出处，务必连同其适用边界一起读。</li>
<li><b>ZeRO: Memory Optimizations Toward Training Trillion Parameter Models</b> — Rajbhandari et al., 2020。三个阶段的分片思想，与 FSDP 对照阅读。</li>
</ul>
</section>`
};
