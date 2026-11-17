window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["flashattention"] = {
  slug: "flashattention",
  title: "FlashAttention：把注意力装进 SRAM",
  subtitle: "IO 感知的算法才是好算法",
  level: 2,
  cluster: "单机优化",
  tags: ["Attention", "IO", "Online Softmax"],
  summary: "标准注意力的瓶颈是 N×N 中间矩阵的 HBM 读写。FlashAttention 用 tiling、online softmax 与反向重算把这部分数据留在 SRAM。",
  keyPoints: [
    "朴素注意力的瓶颈是 Θ(N²) 的 HBM 读写而非 FLOPs，算术强度只有 d/2，远低于 GPU 脊点。",
    "tiling 加 online softmax 让 N×N 中间矩阵永不落 HBM；反向用重算 P 换掉 O(N²) 显存。",
    "FA-2 改工作划分，FA-3 用 Hopper 的 TMA/WGMMA 做异步重叠；长序列收益最大，短序列需实测。"
  ],
  readingMinutes: 14,
  html: String.raw`
<section class="sec">
<h2>先给结论：注意力慢在搬数据，不在算数据</h2>
<p>训练或推理一个长上下文的 Transformer 时，attention 经常是单层里最慢的 kernel，但它的 FLOPs 占比未必最高：2K 上下文下通常还低于 MLP，到 8K 以上才明显追平甚至反超。慢的原因不在乘加次数，而在数据搬运：GPU 的算力增长速度远快于显存带宽。以 NVIDIA H100 SXM 为例，FP16 Tensor Core 稠密算力约 989 TFLOPS，HBM3 带宽 3.35 TB/s，两者相除得到约 295 FLOP/byte 的<mark>脊点</mark>（ridge point）——每从 HBM 取 1 字节，至少要完成约 295 次浮点运算，才算不浪费算力。</p>
<p>朴素 attention 每处理一个输出元素，只做 O(N) 次乘加，却要把 N×N 的分数矩阵写回 HBM 再读出来。把 QKᵀ 与 PV 两次矩阵乘都算上，它的算术强度约为 d/2（d=64、fp16 时约 32 FLOP/byte），只有脊点的九分之一左右，于是 Tensor Core 大部分时间在等数据。FlashAttention 不改数学，只重排计算顺序：把 Q、K、V 切成小块（tile），在片上 SRAM 中完成矩阵乘与 softmax，让 N×N 中间矩阵从不落回 HBM。它是精确算法，不是近似。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>把 attention 想成做菜：朴素实现每切一刀就把食材端回仓库（HBM）；FlashAttention 先把案板（SRAM）铺好，一次只搬一小筐原料，在案板上连续切配，最后只把成品端出去。搬运次数少了，厨师（Tensor Core）就不再空等。</div></div>
<p>论文（Dao et al., 2022）在 A100、fp16 条件下报告：相对 PyTorch 标准实现，attention 模块约有 2-4 倍加速（GPT-2 上约 3 倍），显存从 O(N²) 降到 O(N)，并能在单张 40 GB A100 上跑 64K 序列的 attention。注意这是 attention 模块的口径，不是整模型端到端；端到端收益取决于 attention 在总耗时中的占比。</p>
</section>

<section class="sec">
<h2>标准注意力的 HBM 账本</h2>
<p>设序列长度 N、头维 d=64、单头单层、fp16。朴素实现分三步：S = QKᵀ，P = softmax(S)，O = PV。如果每一步都落盘，HBM 上至少发生这些流量：读 Q/K/V 共 3Nd 个元素；写 S、读 S（做 softmax）共 2N²；写 P、读 P（做 PV）共 2N²；写 O 共 Nd。</p>
<div class="formula">朴素实现：HBM 访问 ≈ 4Nd + 4N² 个元素
FlashAttention：HBM 访问 = Θ(N²d² / M) 个元素，M 为 SRAM 可容纳的元素数
当 d=64、M ≈ 164 KB（约 8.4×10⁴ 个 fp16）时，理论上 M/d² ≈ 20
计入 tile 形状、fp32 累加器与额外项后，HBM 流量实际约降一个数量级</div>
<p>代入 N=8192 看一眼量级：单个 N×N 的 fp16 矩阵是 8192² × 2 B = 128 MiB。朴素实现来回四趟就是 512 MiB，而全部输入 Q/K/V 只有 8192 × 64 × 2 B × 3 = 3 MiB。中间矩阵比输入大两个数量级，这就是瓶颈所在。图 1 把三档序列长度画在一起，口径写在图注里。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="标准注意力与 FlashAttention 的 HBM 访问量对比条形图">
<text x="24" y="28" font-size="15" font-family="inherit" fill="var(--sv-ink)">单头单层 attention 前向 HBM 访问量（d=64，fp16）</text>
<rect x="470" y="14" width="12" height="12" fill="var(--sv-a)"></rect>
<text x="488" y="24" font-size="12" font-family="inherit" fill="var(--sv-muted)">朴素实现（materialize）</text>
<rect x="470" y="34" width="12" height="12" fill="var(--sv-b)"></rect>
<text x="488" y="44" font-size="12" font-family="inherit" fill="var(--sv-muted)">FlashAttention</text>
<line x1="80" y1="60" x2="730" y2="60" stroke="var(--sv-line)" stroke-width="1"></line>
<line x1="80" y1="147" x2="730" y2="147" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="4 4"></line>
<line x1="80" y1="233" x2="730" y2="233" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="4 4"></line>
<line x1="80" y1="320" x2="730" y2="320" stroke="var(--sv-line)" stroke-width="1"></line>
<text x="70" y="64" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">600</text>
<text x="70" y="151" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">400</text>
<text x="70" y="237" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">200</text>
<text x="70" y="324" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="end">0</text>
<text x="36" y="200" font-size="12" font-family="inherit" fill="var(--sv-muted)" transform="rotate(-90 36 200)" text-anchor="middle">MB</text>
<rect x="125" y="305" width="60" height="15" fill="var(--sv-a)"></rect>
<rect x="195" y="317" width="60" height="3" fill="var(--sv-b)"></rect>
<text x="125" y="298" font-size="12" font-family="inherit" fill="var(--sv-ink)">34.6</text>
<text x="195" y="311" font-size="12" font-family="inherit" fill="var(--sv-b)">4.3</text>
<text x="190" y="340" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">N = 2048</text>
<rect x="350" y="261" width="60" height="59" fill="var(--sv-a)"></rect>
<rect x="420" y="314" width="60" height="7" fill="var(--sv-b)"></rect>
<text x="350" y="254" font-size="12" font-family="inherit" fill="var(--sv-ink)">136</text>
<text x="420" y="308" font-size="12" font-family="inherit" fill="var(--sv-b)">15.2</text>
<text x="415" y="340" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">N = 4096</text>
<rect x="575" y="86" width="60" height="234" fill="var(--sv-a)"></rect>
<rect x="645" y="295" width="60" height="25" fill="var(--sv-b)"></rect>
<text x="575" y="79" font-size="12" font-family="inherit" fill="var(--sv-ink)">541</text>
<text x="645" y="289" font-size="12" font-family="inherit" fill="var(--sv-b)">56.6</text>
<text x="640" y="340" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">N = 8192</text>
<text x="80" y="356" font-size="12" font-family="inherit" fill="var(--sv-muted)">口径：单头、d=64、fp16；朴素 = 4Nd + 4N² 个元素，FA 按有效 Q 块约 328 行、K/V 重读 N/Bq 遍计。</text>
<text x="80" y="374" font-size="12" font-family="inherit" fill="var(--sv-muted)">未计 tile 取整与额外项，属上界量级估算；实际 kernel 的物理 tile 更小，靠 L2 吸收重读。</text>
</svg><figcaption>图 1 · 同一 shape 下的 HBM 访问量（元素数 × 2 B）。N 翻倍时两者都约翻 3.5-4 倍，差距从约 8 倍扩大到约 10 倍；FA 柱按有效 Q 块约 328 行估算（相当于计入部分 L2 复用），实际值随实现与 L2 命中浮动。</figcaption></figure>
<p>这张图解释了两件事。第一，为什么长序列收益更大：两者都随 N² 增长，但 FlashAttention 的系数低约一个数量级，省下的绝对字节数随 N² 放大；短序列下 FlashAttention 的线性项（读 Q、写 O、按 tile 数取整后重读 K/V）占比更高，差距被摊薄到约 8 倍。第二，为什么 head dim 越大 FlashAttention 的相对优势越小：它的 HBM 项正比于 d²，d 从 64 翻到 128 时，M/d² 从约 20 降到约 5。需要说明的是，图中 FA 的估算假设有效 Q 块约 300 余行（K/V 随之重读 N/Bq 遍），实际 kernel 的物理 tile 常取 64-128 行，但 L2 会吸收大量重复读，所以实测流量通常介于图中的理想值与朴素实现之间。</p>
</section>

<section class="sec">
<h2>Tiling：谁常驻 SRAM，谁流式经过</h2>
<p>tiling 的核心是区分“驻留”和“流过”。前向用两层循环：外层取一块 Q（Bq 行，典型 64-128），它对应的输出累加器 O_i、行最大值 m_i、行指数和 l_i 常驻 SRAM；内层遍历全部 K/V 块（Bk 列，典型 64-128），每读入一块就算一次局部 S_ij，更新累加器后立刻丢弃。</p>
<p>tile 大小由 SRAM 预算决定。A100 每个 SM 有 192 KB 共享内存（单个线程块最多可用 164 KB），H100 提升到 228 KB；全卡 108 或 132 个 SM 合计约 20-30 MB，仍远小于 80 GB HBM。以 Bq=128、Bk=64、d=64、fp16 估算：Q 块 16 KB，K/V 块各 8 KB，S 块 128×64 的 fp32 为 32 KB，O 累加器 128×64 fp32 为 32 KB，加上 softmax 统计量，总共约 100 KB，正好塞进一个 SM。</p>
<ol>
<li>从 HBM 读入 Q 块到 SRAM，初始化 m=-∞、l=0、O=0。</li>
<li>内层循环读入 K_j、V_j 块，在 SRAM 内算 S_ij = Q_i K_jᵀ × scale。</li>
<li>用当前块的行最大值更新 m_i，对 S_ij 做 exp 并累加 l_i，同时用缩放因子修正旧的 O_i。</li>
<li>用 S_ij 乘 V_j 累加到 O_i，然后丢弃 S_ij、K_j、V_j，进入下一块。</li>
<li>内层结束后按 l_i 归一化 O_i，只写回一次 HBM。</li>
</ol>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="FlashAttention 的 tile 数据流：HBM 中的 Q K V 读入 SRAM，计算后只写回输出">
<defs><marker id="flashattention-arrow-1" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="var(--sv-muted)"></path></marker></defs>
<text x="24" y="26" font-size="15" font-family="inherit" fill="var(--sv-ink)">FlashAttention 前向：Q 块驻留，K/V 块流式经过 SRAM</text>
<rect x="20" y="48" width="188" height="266" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="114" y="70" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">HBM（80 GB，3.35 TB/s）</text>
<rect x="42" y="88" width="144" height="44" rx="4" fill="var(--sv-a)"></rect>
<text x="114" y="106" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">Q（N × d）</text>
<text x="114" y="123" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">只读一次</text>
<rect x="42" y="152" width="144" height="44" rx="4" fill="var(--sv-a2)"></rect>
<text x="114" y="170" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">K（N × d）</text>
<text x="114" y="187" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">每个 Q 块重读</text>
<rect x="42" y="216" width="144" height="44" rx="4" fill="var(--sv-a2)"></rect>
<text x="114" y="234" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">V（N × d）</text>
<text x="114" y="251" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">每个 Q 块重读</text>
<text x="114" y="292" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">O(N²) 的 S/P 从不写回</text>
<rect x="300" y="48" width="280" height="266" rx="6" fill="var(--sv-bg)" stroke="var(--sv-a)" stroke-width="1.5"></rect>
<text x="440" y="70" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">SRAM（每 SM 228 KB，约 100 KB 预算）</text>
<rect x="318" y="86" width="110" height="42" rx="4" fill="var(--sv-b)"></rect>
<text x="373" y="103" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">Q_i 块</text>
<text x="373" y="119" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">Bq × d</text>
<rect x="444" y="86" width="118" height="42" rx="4" fill="var(--sv-b2)"></rect>
<text x="503" y="103" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">K_j / V_j 块</text>
<text x="503" y="119" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">Bk × d</text>
<rect x="318" y="146" width="244" height="40" rx="4" fill="var(--sv-c)"></rect>
<text x="440" y="164" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">S_ij = Q_i K_jᵀ（Bq × Bk）</text>
<text x="440" y="179" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">用完即弃，不落 HBM</text>
<rect x="318" y="202" width="244" height="44" rx="4" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="440" y="220" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">m_i、l_i（每行统计量）</text>
<text x="440" y="236" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">fp32，驻留整个内层循环</text>
<rect x="318" y="258" width="244" height="44" rx="4" fill="var(--sv-a)"></rect>
<text x="440" y="276" font-size="12" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">O_i 累加器（Bq × d，fp32）</text>
<text x="440" y="292" font-size="12" font-family="inherit" fill="var(--sv-muted)" text-anchor="middle">内层循环持续累加</text>
<line x1="188" y1="110" x2="316" y2="104" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#flashattention-arrow-1)"></line>
<line x1="188" y1="174" x2="442" y2="127" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#flashattention-arrow-1)"></line>
<line x1="188" y1="238" x2="316" y2="276" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#flashattention-arrow-1)"></line>
<line x1="440" y1="186" x2="440" y2="200" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#flashattention-arrow-1)"></line>
<text x="24" y="338" font-size="12" font-family="inherit" fill="var(--sv-muted)">内层 j 递增，Q_i 不动；内层结束后 O_i 归一化并只写回一次。</text>
<text x="24" y="360" font-size="12" font-family="inherit" fill="var(--sv-b)">读放大：K/V 共读 N/Bq 遍，换来 N² 矩阵零落盘。</text>
</svg><figcaption>图 2 · tile 的处理流程。Q 块在 SRAM 中驻留，K/V 块流式读入；S 块算完立即丢弃，只有 O 和每行统计量跨块存活。</figcaption></figure>
<pre class="code" data-lang="python"><code># 单个 Q 块的前向：BQ 行，D 为 head dim，BK 为 K/V 块大小
q = Q[i:i+BQ]                    # 已在 SRAM
m = full((BQ,), -inf); l = zeros((BQ,)); o = zeros((BQ, D))
for j in range(0, N, BK):
    k = K[j:j+BK]; v = V[j:j+BK]
    s = (q @ k.T) * scale         # BQ x BK，fp32
    m_new = maximum(m, s.max(dim=-1).values)
    p = exp(s - m_new[:, None])
    alpha = exp(m - m_new)        # 旧的 l、o 换到新基准
    l = alpha * l + p.sum(dim=-1)
    o = alpha[:, None] * o + p @ v
    m = m_new
o = o / l[:, None]                # 最后只归一化一次
</code></pre>
<p>这套流程把“读 K/V”的次数从 1 次变成 N/Bq 次，属于有意的读放大；但被放大的只是 O(Nd) 的 K/V，换掉的是 O(N²) 的中间矩阵，净账仍然大赚。IO 感知算法的典型思路就在这里：先算清每一层存储层次的字节数，再决定循环顺序和切块大小，而不是只数 FLOPs。</p>
</section>

<section class="sec">
<h2>Online softmax：滚动最大值与延迟归一化</h2>
<p>上面的伪代码有个容易被忽略的陷阱：softmax 需要全局最大值才能数值稳定，而流式处理时看不到全局。online softmax 用“滚动最大值”解决：每来一个新块，就用新的最大值把此前累积的量重新缩放一次，使新旧贡献始终处在同一标度上。</p>
<p>设处理完前 i-1 个块后的最大值为 m_{i-1}、指数和为 l_{i-1}、未归一化输出为 O_{i-1}；当前块的行最大值为 m̃_i。新最大值 m_i = max(m_{i-1}, m̃_i)，缩放因子 α = exp(m_{i-1} - m_i)。递推关系如下。</p>
<div class="formula">m_i = max(m_{i-1}, max_j s_ij)
α  = exp(m_{i-1} - m_i)          （≤ 1，只缩不放）
l_i = α · l_{i-1} + Σ_j exp(s_ij - m_i)
O_i = α · O_{i-1} + Σ_j exp(s_ij - m_i) · v_j
最终：O = O_last / l_last，与 softmax(S) · V 在数学上等价</div>
<p>三步的含义很清楚：先更新最大值，再用 α 把旧的 l 和 O 换算到新基准，最后把当前块的贡献加上。因为 α ≤ 1，旧值只会被缩小；所有 exp 的参数都 ≤ 0，结果落在 (0, 1]，不会溢出。这就是不需要全局最大值的稳定 softmax。</p>
<div class="callout callout--formula"><span class="callout__label">公式</span><div>归一化可以完全推迟到最后。中间过程只保留“未归一化”的 O 与 l，处理完最后一个块才做一次除法。这样每个新块只需 O(Bq·Bk·d) 的乘加和 O(Bq·d) 的 rescale，而不是重算全部历史；代价是每行多存两个标量 m、l。</div></div>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="online softmax 三步演示：块一初始化、块二重缩放更新、最后归一化">
<defs><marker id="flashattention-arrow-2" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="var(--sv-muted)"></path></marker></defs>
<text x="24" y="26" font-size="15" font-family="inherit" fill="var(--sv-ink)">online softmax 的三步：分数 [2, 4] 与 [6, 0] 依次到达</text>
<rect x="18" y="46" width="218" height="222" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="127" y="70" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">① 块 1：s = [2, 4]</text>
<text x="36" y="100" font-size="12" font-family="inherit" fill="var(--sv-muted)">m₁ = max(2, 4) = 4</text>
<text x="36" y="126" font-size="12" font-family="inherit" fill="var(--sv-ink)">l₁ = exp(-2) + exp(0)</text>
<text x="36" y="146" font-size="12" font-family="inherit" fill="var(--sv-ink)">   = 0.135 + 1.000 = 1.135</text>
<text x="36" y="176" font-size="12" font-family="inherit" fill="var(--sv-muted)">O₁ 未归一化，先留着</text>
<text x="36" y="202" font-size="12" font-family="inherit" fill="var(--sv-muted)">不写回 HBM</text>
<text x="36" y="240" font-size="12" font-family="inherit" fill="var(--sv-b)">此时不知后面还有更大的分数</text>
<rect x="270" y="46" width="218" height="222" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"></rect>
<text x="379" y="70" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">② 块 2：s = [6, 0]</text>
<text x="288" y="100" font-size="12" font-family="inherit" fill="var(--sv-ink)">m₂ = max(4, 6) = 6</text>
<text x="288" y="126" font-size="12" font-family="inherit" fill="var(--sv-ink)">α = exp(4 - 6) = 0.135</text>
<text x="288" y="152" font-size="12" font-family="inherit" fill="var(--sv-ink)">l₂ = 0.135 × 1.135</text>
<text x="288" y="172" font-size="12" font-family="inherit" fill="var(--sv-ink)">   + exp(0) + exp(-6)</text>
<text x="288" y="192" font-size="12" font-family="inherit" fill="var(--sv-ink)">   = 0.154 + 1.002 = 1.156</text>
<text x="288" y="222" font-size="12" font-family="inherit" fill="var(--sv-b)">旧的 O₁ 同乘 α，再加新块</text>
<text x="288" y="248" font-size="12" font-family="inherit" fill="var(--sv-muted)">这一步叫 rescale，不能省</text>
<rect x="522" y="46" width="220" height="222" rx="6" fill="var(--sv-bg)" stroke="var(--sv-a)" stroke-width="1.5"></rect>
<text x="632" y="70" font-size="13" font-family="inherit" fill="var(--sv-ink)" text-anchor="middle">③ 最后统一归一化</text>
<text x="540" y="100" font-size="12" font-family="inherit" fill="var(--sv-ink)">权重 = exp(s - 6) / 1.156</text>
<text x="540" y="126" font-size="12" font-family="inherit" fill="var(--sv-ink)">[0.016, 0.117,</text>
<text x="540" y="142" font-size="12" font-family="inherit" fill="var(--sv-ink)"> 0.865, 0.002]</text>
<text x="540" y="166" font-size="12" font-family="inherit" fill="var(--sv-muted)">四项之和 = 1.000</text>
<text x="540" y="192" font-size="12" font-family="inherit" fill="var(--sv-muted)">只需一次除法</text>
<text x="540" y="214" font-size="12" font-family="inherit" fill="var(--sv-muted)">O = O_last / l_last</text>
<text x="540" y="244" font-size="12" font-family="inherit" fill="var(--sv-b)">与一次性 softmax 的结果一致</text>
<line x1="236" y1="150" x2="266" y2="150" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#flashattention-arrow-2)"></line>
<line x1="488" y1="150" x2="518" y2="150" stroke="var(--sv-muted)" stroke-width="1.5" marker-end="url(#flashattention-arrow-2)"></line>
<text x="24" y="288" font-size="12" font-family="inherit" fill="var(--sv-ink)">通用递推：m_new = max(m_old, 块内最大)；α = exp(m_old - m_new)</text>
<text x="24" y="308" font-size="12" font-family="inherit" fill="var(--sv-ink)">l_new = α·l_old + Σexp(s - m_new)；O_new = α·O_old + Σexp(s - m_new)·v</text>
<text x="24" y="332" font-size="12" font-family="inherit" fill="var(--sv-muted)">关键性质：α ≤ 1 保证不溢出；exp 的参数 ≤ 0 保证每项在 (0, 1]；l 与 O 始终处于同一基准，可以直接相加。</text>
<text x="24" y="356" font-size="12" font-family="inherit" fill="var(--sv-muted)">若省略 α，第二个块会把按 m=4 算的旧值直接与按 m=6 算的新值相加，分母偏大、输出偏小，误差随块数累积。</text>
</svg><figcaption>图 3 · online softmax 的三步演示。块 1 建立 m、l、O；块 2 先用 α 重缩放旧值再累加；全部块结束后才做一次归一化除法。</figcaption></figure>
<p>用四个分数走一遍（图 3）：块 1 的分数是 [2, 4]，m=4、l=exp(-2)+exp(0)=1.135；块 2 的分数是 [6, 0]，新最大值 6，α=exp(4-6)=0.135，于是 l=0.135×1.135+(exp(0)+exp(-6))=1.156。最终四个权重是 [0.016, 0.117, 0.865, 0.002]，和为 1。注意第三个分数的权重最大，因为它对应的分数 6 就是全局最大值。</p>
<div class="callout callout--warn"><span class="callout__label">警告</span><div>忘记乘 α 是自定义 kernel 里最常见的 bug：直接把新旧 l 相加，分母偏大且随块数累积，输出整体偏小。验证方法是拿 N=128 左右的小序列与 PyTorch 的 softmax 结果逐元素比对，容差按 dtype 设：fp32 取 1e-5 量级，fp16 放宽到 1e-3，bf16 到 1e-2；再单独测一次分块数不同（Bk=32 与 Bk=128）的结果是否一致。</div></div>
</section>

<section class="sec">
<h2>反向传播：用重算换显存</h2>
<p>反向传播更麻烦。标准实现需要 P 来计算 dV = PᵀdO、dP = dO Vᵀ、dS = P∘(dP - rowsum(dP))，因此前向必须把 N×N 的 P 存下来。8K 序列、32 头、单层 fp16 的 P 就是 8192² × 32 × 2 B ≈ 4.3 GB；32 层根本放不下。所以训练框架本来就要做激活重算（activation checkpointing），只是粒度粗到整层。</p>
<p>FlashAttention 把重算做进了 kernel：前向只保存输出 O 和每行的 logsumexp L_i = m_i + log l_i（O 有 N×d 个元素、L 有 N 个，d 固定时记作 O(N) 显存），反向时按同样的 tile 顺序重新计算 S_ij 和 P_ij，立即用于求梯度。此时 P_ij = exp(s_ij - L_i)，不再需要减最大值，因为 L_i 已经包含了归一化信息；这也是为什么前向要额外存 L 而不是只存 m 和 l。</p>
<div class="formula">前向保存：O（N × d）与 L（N），共 O(N·d) 个元素（d 固定时即 O(N)）
反向重算：S_ij = Q_i K_jᵀ × scale，P_ij = exp(S_ij - L_i)
得到：dV += P_ijᵀ dO_i，dP_ij = dO_i V_jᵀ，dS_ij = P_ij ∘ (dP_ij - rowsum(dP_ij))
显存：从 O(N²) 降到 O(N)，FLOPs 增加一次 QKᵀ 重算（约前向矩阵乘的一半）</div>
<p>代价是反向的 FLOPs 增加，收益是 HBM 访问大幅减少、显存从 O(N²) 降到 O(N)。实测中反向通常也更快，因为原来的瓶颈是读写 P，而不是多出来的乘加。这与“重算一定更慢”的直觉相反，值得记住：在带宽受限的 kernel 里，用算力换带宽经常是划算的。</p>
<div class="callout callout--warn"><span class="callout__label">警告</span><div>FlashAttention 省的是 N² 项，不是全部激活。每层的输入激活、MLP 中间结果、logits 仍是 O(N·d) 或 O(N·V)，长上下文训练依旧需要 checkpoint、序列并行或 ZeRO；别指望换一个 attention kernel 就解决所有显存问题。</div></div>
</section>

<section class="sec">
<h2>从 FA-1 到 FA-3：同一算法的三代工程</h2>
<p>FlashAttention-1 在 A100 上只跑到峰值的 30%-50%。原因是大量非矩阵乘指令（rescale、mask、类型转换）与矩阵乘抢发射槽，Warp 之间的工作量也不均衡。FA-2（2023）针对这两点重写：减少非 matmul FLOPs；前向按序列长度切分给不同 Warp，让每行只由一个 Warp 负责，避免跨 Warp 归约；反向取消 split-K 与原子加；改善共享内存布局以减少 bank conflict。</p>
<p>效果是相对 FA-1 约 2 倍加速，在 A100 上达到理论峰值的 50%-73%（论文口径：fp16、head dim 64 或 128）。这也说明同一个算法在不同实现下能差出一倍，读论文时要区分“算法收益”和“工程实现收益”。</p>
<p>FA-3（2024）面向 Hopper：用 TMA（Tensor Memory Accelerator）做异步块拷贝，用 WGMMA 让矩阵乘与 softmax 重叠，采用生产者-消费者式的 warp specialization，并用 ping-pong 调度让两个 warpgroup 交替执行“算 GEMM”和“做 softmax”，同时支持 FP8。论文在 H100 SXM 上报告 FP16 前向达到约 75% 的稠密峰值（989 TFLOPS × 0.75 ≈ 0.74 PFLOPS/s），FP8 路径约 1 PFLOPS/s 量级（口径：head dim 128）。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>版本</th><th>年份</th><th>关键改动</th><th>公开口径（论文/官方）</th></tr></thead><tbody>
<tr><td>FA-1</td><td>2022</td><td>tiling、online softmax、反向重算</td><td>A100 上相对 PyTorch 约 2-4 倍；显存 O(N)</td></tr>
<tr><td>FA-2</td><td>2023</td><td>工作划分、减少非 matmul、反向去 split-K</td><td>A100 上达峰值 50%-73%，约为 FA-1 的 2 倍</td></tr>
<tr><td>FA-3</td><td>2024</td><td>TMA、WGMMA、warp specialization、FP8</td><td>H100 SXM：FP16 约 75% 稠密峰值（≈0.74 PFLOPS/s），FP8 约 1 PFLOPS/s 量级</td></tr>
</tbody></table></div>
<p>工程上不必自己选版本：PyTorch 2.x 的 scaled_dot_product_attention 会在满足条件时调度到 FlashAttention 后端，官方库与推理框架也各自集成了不同版本。升级 CUDA/PyTorch 后建议重跑基准，别假设版本号越大一定越快——head dim、dtype、mask 类型都会触发不同的 kernel 分支。</p>
</section>

<section class="sec">
<h2>因果掩码、变长序列与 PagedAttention 的边界</h2>
<p>因果掩码（causal mask）对 FlashAttention 是天然友好的：对块 (i, j)，若整块都在对角线以上，直接跳过，不读 K/V、不做乘加；只有对角线上的块需要逐元素掩码。这样前向的计算量和 HBM 访问都接近减半。FA-2 还专门处理了因果场景下各 Q 块工作量不均的问题，否则靠近序列开头的 Q 块很轻、末尾的块很重，会造成尾部拖长。</p>
<p>变长序列（variable-length）在训练里更常见。做法是把多条序列打包（packing）进一条连续 buffer，用 cu_seqlens 记录每条序列的起止 offset，kernel 按序列边界而不是按全局位置切块。这样避免了 padding 到最长序列的浪费，但块边界可能与序列边界不重合，需要 kernel 内部做边界判断；官方库提供 varlen 接口，自己手写 kernel 时这是最容易出错的地方。</p>
<p>与 PagedAttention 的区别经常被混淆。两者都叫“attention 优化”，但优化的是不同层次。</p>
<div class="duo"><div class="duo__col"><h4>FlashAttention：计算侧</h4><p>重排 attention 内部的循环与存储层次，减少 HBM 读写，数学结果不变。训练和推理都用，不改变 KV 的组织方式。</p></div><div class="duo__col"><h4>PagedAttention：显存管理侧</h4><p>面向推理的 KV cache，把 cache 切成固定大小的 block，用块表做非连续映射，减少预留造成的碎片。它不改变单个 attention 的计算顺序。</p></div></div>
<p>两者正交，可以叠加：vLLM 用 PagedAttention 管理 KV cache，同时调用 FlashAttention 系列 kernel 完成计算。KV cache 的分配、换入换出属于推理服务范畴，这里不展开，放到推理相关篇章。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>短序列不一定划算。N 在数百以内时，kernel 启动开销和 tile 填充浪费占比高，收益可能被吃掉；长序列与训练场景才是主战场。head dim 较大时还要先确认 kernel 是否支持（例如是否超过 128 或需要特殊编译），否则可能静默回退到慢路径。拐点视 GPU 型号、dtype 和具体实现而定，建议用自己的 shape 扫一遍再下结论。</div></div>
</section>

<section class="sec">
<h2>排障、自测与延伸阅读</h2>
<h3>常见误区与排障顺序</h3>
<ul>
<li>以为“用了 FlashAttention”就一定快：如果框架仍 materialize 了 attention mask，或回退到 math 后端，收益会大打折扣。要确认实际执行的 kernel，而不是只看 import 成功。</li>
<li>忽略 dtype 与 head dim 限制：多数 kernel 要求 head dim 为 8 的倍数且不超过 128（部分实现支持 256 但会退化）；不满足时静默回退，性能骤降。</li>
<li>causal 参数没传：训练时若没把 causal 打开，会老实算完整矩阵，白付一倍算力。</li>
<li>显存仍 OOM 就怪 attention：长上下文的大头往往是 KV cache、logits 和未 checkpoint 的激活。</li>
</ul>
<p>排障顺序建议：先确认 kernel 实际分发（用 profiler 看 kernel 名），再确认 dtype、head dim、mask 类型，最后才怀疑数值精度。跑基准时务必 warmup，固定 batch 与 seqlen，报 TFLOPs/s 或单次迭代毫秒数，并注明 GPU 型号；只报“快了几倍”没有可比性。</p>
<pre class="code" data-lang="bash"><code>python -c "import torch; print(torch.__version__, torch.cuda.get_device_name(0))"
python -c "import flash_attn; print(flash_attn.__version__)"
nvidia-smi --query-gpu=name,memory.total,clocks.sm --format=csv</code></pre>
<h3>自测</h3>
<details class="quiz"><summary>Q1 · online softmax 为什么要在换块时乘 α 缩放旧的 l 和 O，而不是最后统一处理？</summary><div class="quiz__a">softmax 的分母是所有 exp 之和，但 exp 的基准（最大值）在流式处理中会变。旧块的值是按旧最大值 m_old 算出的，新最大值 m_new 更大时，必须乘 exp(m_old - m_new) 换算到新基准；否则新旧项不在同一标度上，相加没有意义。α ≤ 1 保证只缩不放、不会溢出。可以把它理解成“换汇率”，每换一次基准就结算一次历史。</div></details>
<details class="quiz"><summary>Q2 · FlashAttention 前向 FLOPs 与标准实现相同，为什么反而更快？反向为什么也常常更快？</summary><div class="quiz__a">前向的瓶颈是 HBM 带宽而不是算力，省掉 N² 中间矩阵的写入与重读直接缩短时间。反向多算了一次 QKᵀ（约半个前向矩阵乘）来重算 P，但省掉了存储和重读 N² 的 P；长序列下带宽节省超过额外算力，因此实测更快。短序列时这个优势会缩小甚至反转，需要按 shape 实测。</div></details>
<details class="quiz"><summary>Q3 · 128K 上下文训练时，用了 FlashAttention 显存还是不够，可能是什么原因？</summary><div class="quiz__a">FlashAttention 只消除了 attention 的 O(N²) 中间矩阵。每层输入激活、MLP 中间张量、logits 仍是 O(N·d) 或 O(N·V)，推理还有 KV cache；训练还要为反向保存或重算这些激活。需要配合激活 checkpoint、序列/张量并行、ZeRO 等手段，单靠 attention kernel 不够。</div></details>
<details class="quiz"><summary>Q4 · 能不能用 PagedAttention 替代 FlashAttention？</summary><div class="quiz__a">不能，两者不在同一层。PagedAttention 解决推理时 KV cache 的显存碎片与共享问题，不改变 attention 的计算数据流；FlashAttention 优化计算内核的 IO 与显存占用。推理系统通常两者同时使用：分页管理 KV，FlashAttention 系列 kernel 负责计算。</div></details>
<h3>延伸阅读</h3>
<ul class="refs">
<li><b>FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness</b> — Tri Dao, Daniel Y. Fu, Stefano Ermon, Atri Rudra, Christopher Ré, NeurIPS 2022（arXiv:2205.14135）。原始论文，IO 复杂度分析与 tiling/online softmax 的完整推导。</li>
<li><b>FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning</b> — Tri Dao, 2023（arXiv:2307.08691）。讲清工作划分、非 matmul 开销与反向并行策略，是理解“算法一样、实现差一倍”的最佳材料。</li>
<li><b>FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision</b> — Jay Shah 等, 2024（arXiv:2407.08608）。Hopper 上 TMA、WGMMA、warp specialization 与 FP8 的具体用法。</li>
<li><b>Tri Dao 官方博客：FlashAttention-2 发布说明</b> — 2023。作者自述 FA-1 的瓶颈与 FA-2 的改动动机，比论文更直白。</li>
<li><b>Dao-AILab/flash-attention（GitHub 仓库）</b> — 官方 CUDA 实现、varlen 接口与 benchmark 脚本，排障时以仓库 README 的版本支持矩阵为准。</li>
</ul>
</section>
`
};
