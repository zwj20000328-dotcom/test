window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["ultra-scale"] = {
  slug: "ultra-scale",
  title: "十万卡集群与网络架构",
  subtitle: "规模本身就是一种技术",
  level: 6,
  cluster: "前沿",
  tags: ["大规模集群", "无损网络", "Goodput"],
  summary: "从四层拓扑与 NVL72 出发，拆解十万卡规模下的无损网络、MTBF、goodput 分解、checkpoint 重启与液冷电力，给出可量化的容量规划与运维口径。",
  keyPoints: [
    "十万卡的第一指标不是峰值算力而是 goodput：MFU × 有效时间比例 × 回滚存活率",
    "按 Llama 3 公开口径外推，十万卡约每 30 分钟一次非计划中断，可靠性必须按统计规律设计",
    "PFC 只做最后防线，常态靠 ECN/DCQCN；多打一与 all-to-all 的尾延迟比平均带宽更致命",
    "checkpoint 间隔约 √(2×C×MTBF)；NVL72 用铜背板换掉光模块，代价是 120 kW 机柜与整柜故障域"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>十万卡不是一万卡的十倍</h2>
<p>先算三个数。10 万张 H100 SXM，BF16 稠密峰值按每卡 989 TFLOPS 计，聚合约 99 EFLOPS；按 40% MFU，真正用于矩阵乘的约 40 EFLOPS。GPU 功耗按每卡 0.7 kW 计，8 卡整机含 CPU、内存、网卡与电源后约 10 kW，折合约 1.25 kW/卡，IT 侧约 125 MW。可靠性按 Llama 3 数据外推：16,384 张卡 54 天发生 419 次非计划中断，折合每卡每天 4.7×10⁻⁴ 次，放大到 10 万卡约每天 47 次，<mark>平均每 30 分钟一次</mark>。</p>
<p>这三组数分别指向算力与网络、电力、可靠性，且都不是线性放大：网络从“带宽够不够”变成“拥塞会不会失控”，电力从“机柜放不放得下”变成“园区有没有这么多电”，可靠性从“坏了就修”变成“必须在故障之间完成有效计算”。规模本身就是一种技术，指的正是这套重新设计。</p>
<p>fat-tree、rail-optimized、SHARP 的定义见 interconnect，3D 并行与 MFU 的推导见 large-scale-training。这里只回答：卡数从一万走到十万，哪些设计必须换，怎么量化。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>一万卡像写字楼：自己发电、自己拉网、坏了找物业。十万卡像城市：电网要专用变电站，道路分主干与支路，消防与抢修常驻，局部故障不能让全城停摆。城市的核心指标不是楼多高，而是每天有多少人真完成了通勤。</div></div>
</section>

<section class="sec">
<h2>四层拓扑：从 72 卡的域到跨园区</h2>
<p>十万卡在物理上被切成四层。第一层是<mark>超节点</mark>（scale-up domain）：GB200 NVL72 把 72 张 GPU 放进一个 NVLink 域，整域双向聚合带宽约 130 TB/s，单 GPU 每向 900 GB/s。第二层是 <mark>Pod</mark>：若干机柜通过 leaf-spine 叶脊网络互联，典型 1,024–4,096 张 GPU，每 GPU 配 400 或 800 Gb/s 网卡，对应每向 50 或 100 GB/s。第三层是集群：几十个 Pod 经 spine 层与数据中心互联（DCI）拼成 10 万卡，跨 Pod 流量受收敛比约束。第四层是存储与管理平面，单独组网。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="十万卡集群的四层拓扑：NVL72 超节点、叶脊 Pod、跨 Pod 集群与独立的存储管理平面">
<text x="20" y="24" font-size="15" fill="var(--sv-ink)" font-family="inherit">十万卡的四层拓扑：每往下一层，每 GPU 可用带宽明显收窄</text>
<text x="20" y="44" font-size="12" fill="var(--sv-muted)" font-family="inherit">数字为单 GPU 可用带宽口径，随代际与收敛比变化</text>
<rect x="20" y="58" width="720" height="64" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="1.5"/>
<text x="34" y="80" font-size="14" fill="var(--sv-ink)" font-family="inherit">① 超节点 scale-up</text>
<text x="34" y="99" font-size="12" fill="var(--sv-muted)" font-family="inherit">NVL72：72 GPU / 130 TB/s（双向聚合）</text>
<text x="34" y="115" font-size="11" fill="var(--sv-muted)" font-family="inherit">每 GPU 每向 900 GB/s</text>
<rect x="382" y="70" width="74" height="40" rx="4" fill="var(--sv-a2)"/>
<text x="419" y="94" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">72 GPU</text>
<rect x="472" y="70" width="74" height="40" rx="4" fill="var(--sv-a2)"/>
<text x="509" y="94" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">72 GPU</text>
<rect x="562" y="70" width="74" height="40" rx="4" fill="var(--sv-a2)"/>
<text x="599" y="94" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">72 GPU</text>
<rect x="652" y="70" width="74" height="40" rx="4" fill="var(--sv-a2)"/>
<text x="689" y="94" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">72 GPU</text>
<text x="382" y="119" font-size="11" fill="var(--sv-muted)" font-family="inherit">铜背板 NVLink 域，一柜即一个扩容单位</text>
<rect x="20" y="134" width="720" height="88" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="34" y="157" font-size="14" fill="var(--sv-ink)" font-family="inherit">② Pod：叶脊 fat-tree</text>
<text x="34" y="176" font-size="12" fill="var(--sv-muted)" font-family="inherit">1,024–4,096 GPU</text>
<text x="34" y="194" font-size="11" fill="var(--sv-muted)" font-family="inherit">IB 50–100 GB/s/GPU</text>
<text x="34" y="212" font-size="11" fill="var(--sv-muted)" font-family="inherit">8 轨 rail-optimized</text>
<rect x="400" y="144" width="320" height="14" rx="3" fill="var(--sv-b)"/>
<text x="560" y="155" font-size="11" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">spine × 8</text>
<rect x="402" y="172" width="64" height="14" rx="3" fill="var(--sv-a)"/>
<rect x="484" y="172" width="64" height="14" rx="3" fill="var(--sv-a)"/>
<rect x="566" y="172" width="64" height="14" rx="3" fill="var(--sv-a)"/>
<rect x="648" y="172" width="64" height="14" rx="3" fill="var(--sv-a)"/>
<line x1="434" y1="158" x2="434" y2="172" stroke="var(--sv-line)" stroke-width="1"/>
<line x1="516" y1="158" x2="516" y2="172" stroke="var(--sv-line)" stroke-width="1"/>
<line x1="598" y1="158" x2="598" y2="172" stroke="var(--sv-line)" stroke-width="1"/>
<line x1="680" y1="158" x2="680" y2="172" stroke="var(--sv-line)" stroke-width="1"/>
<rect x="416" y="200" width="10" height="10" fill="var(--sv-a2)"/><rect x="436" y="200" width="10" height="10" fill="var(--sv-a2)"/>
<rect x="498" y="200" width="10" height="10" fill="var(--sv-a2)"/><rect x="518" y="200" width="10" height="10" fill="var(--sv-a2)"/>
<rect x="580" y="200" width="10" height="10" fill="var(--sv-a2)"/><rect x="600" y="200" width="10" height="10" fill="var(--sv-a2)"/>
<rect x="662" y="200" width="10" height="10" fill="var(--sv-a2)"/><rect x="682" y="200" width="10" height="10" fill="var(--sv-a2)"/>
<text x="402" y="218" font-size="10" fill="var(--sv-muted)" font-family="inherit">节点</text>
<rect x="20" y="234" width="720" height="70" rx="6" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="34" y="257" font-size="14" fill="var(--sv-ink)" font-family="inherit">③ 集群 / 园区</text>
<text x="34" y="276" font-size="12" fill="var(--sv-muted)" font-family="inherit">25–100 个 Pod</text>
<text x="34" y="294" font-size="11" fill="var(--sv-muted)" font-family="inherit">跨 spine 与 DCI</text>
<rect x="392" y="241" width="330" height="10" rx="3" fill="var(--sv-c)"/>
<text x="557" y="250" font-size="10" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">园区 spine / DCI</text>
<rect x="396" y="264" width="52" height="26" rx="3" fill="var(--sv-b2)"/>
<rect x="462" y="264" width="52" height="26" rx="3" fill="var(--sv-b2)"/>
<rect x="528" y="264" width="52" height="26" rx="3" fill="var(--sv-b2)"/>
<rect x="594" y="264" width="52" height="26" rx="3" fill="var(--sv-b2)"/>
<rect x="660" y="264" width="52" height="26" rx="3" fill="var(--sv-b2)"/>
<text x="422" y="281" font-size="10" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Pod</text>
<text x="488" y="281" font-size="10" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Pod</text>
<text x="554" y="281" font-size="10" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Pod</text>
<text x="620" y="281" font-size="10" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Pod</text>
<text x="686" y="281" font-size="10" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Pod</text>
<text x="396" y="300" font-size="10" fill="var(--sv-muted)" font-family="inherit">spine 收敛比 1:1 到 3:1，决定跨 Pod 的大消息能跑多快</text>
<rect x="20" y="314" width="720" height="52" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)" stroke-dasharray="4 4"/>
<text x="34" y="335" font-size="14" fill="var(--sv-ink)" font-family="inherit">④ 存储与管理平面</text>
<text x="34" y="354" font-size="11" fill="var(--sv-muted)" font-family="inherit">独立组网，避免 checkpoint 冲击训练</text>
<text x="400" y="337" font-size="12" fill="var(--sv-ink)" font-family="inherit">并行文件系统 + 对象存储 + BMC 带外</text>
<text x="400" y="356" font-size="11" fill="var(--sv-muted)" font-family="inherit">每 GPU 数 GB/s 的突发写，持续带宽低一个量级</text>
</svg><figcaption>图 1 · 四层拓扑与每 GPU 带宽：超节点 NVLink、Pod IB/RoCE、集群 spine/DCI、存储独立组网。</figcaption></figure>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>层级</th><th>典型单元</th><th>每 GPU 带宽</th><th>故障域</th><th>扩容粒度</th></tr></thead><tbody>
<tr><td>超节点</td><td>NVL72，72 GPU</td><td>NVLink 5，每向 900 GB/s</td><td>整柜</td><td>1 柜</td></tr>
<tr><td>Pod</td><td>1,024–4,096 GPU，叶脊</td><td>IB NDR/XDR，50–100 GB/s</td><td>单 leaf 或单轨</td><td>1 Pod</td></tr>
<tr><td>集群</td><td>25–100 个 Pod</td><td>受 spine 收敛比约束</td><td>spine / 园区</td><td>1 园区</td></tr>
<tr><td>存储</td><td>并行 FS + 对象存储</td><td>每 GPU 数 GB/s 突发</td><td>存储节点 / 元数据</td><td>1 存储池</td></tr>
</tbody></table></div>
<p>分层让故障域与带宽域重合：NVL72 机柜既是 130 TB/s 的高带宽域，也是可能整柜一起停机的故障域；Pod 通常是 8 轨无收敛域，也是 leaf 故障的影响范围。调度器把作业放在哪一层，等于同时选择带宽与风险。</p>
<h3>NVL72 的设计思路：用机柜换域</h3>
<p>NVL72 由 18 个计算托盘与 9 个交换托盘组成：每个计算托盘装 2 颗 Grace CPU 与 4 颗 Blackwell GPU，合计 72 GPU、36 CPU；每个交换托盘装 2 颗 NVLink Switch，共 18 颗，通过铜缆背板把 72 张 GPU 连成单一无阻塞域。整域双向聚合约 130 TB/s，单 GPU 1.8 TB/s 双向。它用出厂铜背板替代数千根线缆与大量光模块（NVIDIA 口径为五千余根），降低功耗与故障率，也缩短装配。</p>
<p>代价同样明确。整柜约 120 kW，必须直接液冷；72 卡既是 NVLink 域，也是电气与制冷的耦合单元，单卡或单交换故障可能要求整柜降载维修；采购与调度都以柜为粒度。换来的是张量并行（TP）与专家并行（EP）可做到 72 卡以内，跨机 all-to-all 显著减少。这是典型的<mark>用故障域换通信域</mark>。</p>
</section>

<section class="sec">
<h2>无损网络：PFC 是保险丝，ECN 才是方向盘</h2>
<p>PFC、ECN、DCQCN 的定义见 interconnect，这里只讲它们在十万卡下的行为。结论先行：<mark>PFC 是链路级的紧急刹车，ECN 是端到端的提前减速</mark>。集群越大，PFC 越应少触发；pause 频繁说明拥塞控制已失效，只是被保险丝兜住。</p>
<h3>PFC 为什么会死锁</h3>
<p>PFC（priority flow control）按优先级逐跳发 PAUSE 帧：下游缓冲快满就要求上游停发，上游缓冲随之堆积，再向更上游发 PAUSE，形成级联。若缓冲分配出现环形依赖，A 等 B、B 等 C、C 等 A，所有端口一起停，就是 <mark>PFC 死锁</mark>。诱因常是重路由、ECMP 哈希不均，或某个 Pod 突发 all-to-all。</p>
<p>防护有四条：预留 headroom，保证 PAUSE 往返期间不丢包；开启 PFC watchdog，持续被 pause 超阈值就主动丢包；无损队列只承载 RDMA；限制单链路 fan-in。PFC 只兜底，不承担常态流控。</p>
<h3>ECN 与 DCQCN：把拥塞信号送回网卡</h3>
<p>ECN 在交换机侧工作：队列超过 Kmin 后按概率标记，超过 Kmax 全标。接收端看到标记，回传拥塞通知（CNP），发送端网卡降速，再按定时器恢复。DCQCN 是 RoCEv2 上的事实标准。它比 PFC 温和：降速发生在排队过长之前，而非缓冲将满时。</p>
<p>难点在参数标定。Kmin、Kmax、Pmax、降速系数与恢复节奏都要随端口速率和 RTT 重算：同一阈值在 400G 与 800G 上效果不同；跨 Pod 的 RTT 更大，恢复太快会震荡。</p>
<div class="formula">稳态队列 ≈ f(Kmin, Kmax, Pmax, 流数 N)<br>多打一：N 个 400 Gb/s 源同时发往 1 个 400 Gb/s 目的，链路只有 1× 带宽，其余 N−1 份只能排队或被降速</div>
<p>大规模下真正难的是<mark>多打一</mark>（incast）与 all-to-all。MoE 的 all-to-all 突发、小消息多、目的集中，热门 expert 会让几十个源同时打向一个 GPU。此时平均带宽可能只掉一点，p99 尾延迟已经翻倍，而尾延迟决定同步步的完成时间。监控至少看四项：ECN 标记率、PFC pause 总时长、端口丢弃计数、集合通信 p99。</p>
<h3>多轨道与多平面</h3>
<p>rail-optimized 的布线见 interconnect。十万卡加了两个约束：单轨故障会带走 1/8 跨机带宽，调度器必须知道哪条轨降级；单平面扛不住交换机维护，于是出现<mark>多平面</mark>，每 GPU 两张 400–800 Gb/s 网卡接入两套独立交换平面，坏一个平面就降级运行。代价是网卡、光模块与交换机翻倍。</p>
<div class="callout callout--warn"><span class="callout__label">警告</span><div>PFC 配置不一致比不开更危险：一端开了无损队列、另一端没开，PAUSE 帧被丢弃，拥塞直接变成丢包与重传；MTU 不一致会让大包分片，ECN 标记随之失真。这类配置应版本化，变更先在小 Pod 灰度，观察 24 小时的 ECN 与 PFC 计数。</div></div>
</section>

<section class="sec">
<h2>故障统计：把“会不会坏”换成“多久坏一次”</h2>
<p>十万卡不能靠“坏了再修”的直觉运维，必须用统计量说话。三个口径：MTBF（mean time between failures，平均无故障时间）、MTTR（mean time to repair，平均修复时间）、可用度 A。串行系统故障率相加，所以集群 MTBF 随卡数线性下降；单卡 MTBF 若为 5 万小时，10 万卡只剩 0.5 小时。</p>
<div class="formula">MTBF_cluster ≈ MTBF_unit / N<br>A = MTBF / (MTBF + MTTR)</div>
<p>这就是第 1 节“每 30 分钟一次”的来源，也解释了可靠性设计的第一原则：<mark>把故障影响局部化</mark>，而不是追求单卡不坏。单卡 MTBF 提升 10% 很难，把影响缩到单个 Pod 却可以。</p>
<p>Llama 3 论文给了一手统计：16,384 张 H100 训练 405B，54 天内记录 419 次非计划中断，约 78% 来自硬件、17% 来自软件，有效训练时间约 90%；若把非计算的 10% 全部记作故障停机，折算平均 MTTR 约 18 分钟，可视为上限。这说明硬件是主因，但软件与配置导致的整作业重启同样不可忽略；90% 靠的是快速定位、热备与 checkpoint，而非天然如此。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>故障类别</th><th>典型来源</th><th>检测手段</th><th>恢复动作</th></tr></thead><tbody>
<tr><td>GPU / HBM</td><td>Xid 错误、ECC 行重映射耗尽、过热</td><td>DCGM、nvidia-smi -q、Xid 日志</td><td>隔离节点，换卡或整机替换</td></tr>
<tr><td>网卡 / 光模块</td><td>链路闪断、误码率上升、模块过热</td><td>ibstat、端口计数器、BER 告警</td><td>切换平面，更换模块</td></tr>
<tr><td>交换机 / 链路</td><td>端口 flap、缓存溢出、固件缺陷</td><td>交换机 telemetry、ECN/PFC 计数</td><td>重路由，灰度升级固件</td></tr>
<tr><td>电力 / 液冷</td><td>PDU 跳闸、CDU 流量不足、漏液</td><td>BMC、漏液传感器、流量计</td><td>降载，切备用回路</td></tr>
<tr><td>软件 / 配置</td><td>驱动、NCCL、调度器、镜像</td><td>作业日志、重启原因分类</td><td>回滚版本，修配置</td></tr>
</tbody></table></div>
<p>还有一类容易被忽略：<mark>静默数据损坏</mark>（silent data corruption，SDC）。硬件不报错，结果却错了，loss 缓慢漂移，事后极难定位。对策是校验和、确定性内核、定期用 golden test 比对，以及保留足够长的 checkpoint。它概率低，但一次可能污染数天训练。</p>
<p>统计口径必须统一，否则数字会误导运维：按“作业中断”还是“节点故障”计数？计划内维护算不算？同一根光模块的多次重连算一次还是多次？建议维护三张表：故障工单、作业中断、节点不可用时长，三者对上账，才能算出真实 MTBF 与 MTTR。</p>
</section>

<section class="sec">
<h2>Goodput：把峰值折算成真正推进的进度</h2>
<p><mark>Goodput</mark> 指单位墙钟时间内被确认有效的训练进度，可用 tokens/s 或 EFLOP/s 表示。MFU 只回答“在算的时候算得多满”，goodput 还要乘上“有多少时间在算”和“结果有没有被回滚”。十万卡的一切工程投入，最终都折算到这一个数上。</p>
<div class="formula">Goodput = P_peak × MFU × E_eff × (1 − R_rollback)<br>E_eff = 1 − T_down/T_total − T_ckpt/T_total − T_straggle/T_total<br>R_rollback 为有效计算时间中被回滚的比例</div>
<p>代入示意值（MFU 取 45%，各乘数取整，与第 1 节的 40% 同属量级假设）：99 EFLOPS 峰值、45% MFU、73% 有效时间、11% 回滚损失，得到约 29 EFLOPS，仅峰值的 29%。只看 MFU 会以为用到了 45%；差的 16 个百分点来自停机、checkpoint、回滚与掉队。大型集群的考核指标因此必须是 goodput。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="24 小时窗口内 goodput 的时间分解：现状有效计算 65%，优化后 84%">
<text x="20" y="24" font-size="15" fill="var(--sv-ink)" font-family="inherit">24 小时窗口：墙钟时间都去了哪里</text>
<text x="20" y="44" font-size="12" fill="var(--sv-muted)" font-family="inherit">示意值，实际比例随规模、模型与运维水平变化</text>
<text x="20" y="70" font-size="13" fill="var(--sv-ink)" font-family="inherit">现状</text>
<rect x="60" y="78" width="429" height="44" fill="var(--sv-a)"/>
<rect x="489" y="78" width="72" height="44" fill="var(--sv-b)"/>
<rect x="561" y="78" width="52" height="44" fill="var(--sv-c)"/>
<rect x="613" y="78" width="40" height="44" fill="var(--sv-a2)"/>
<rect x="653" y="78" width="67" height="44" fill="var(--sv-b2)"/>
<text x="274" y="105" font-size="13" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">有效计算 65%</text>
<text x="60" y="146" font-size="12" fill="var(--sv-ink)" font-family="inherit">goodput ≈ 99 EFLOPS × 45% MFU × 73% × (1 − 11%) ≈ 29 EFLOPS</text>
<text x="20" y="182" font-size="13" fill="var(--sv-ink)" font-family="inherit">优化后</text>
<rect x="60" y="190" width="554" height="36" fill="var(--sv-a)"/>
<rect x="614" y="190" width="33" height="36" fill="var(--sv-b)"/>
<rect x="647" y="190" width="20" height="36" fill="var(--sv-c)"/>
<rect x="667" y="190" width="20" height="36" fill="var(--sv-a2)"/>
<rect x="687" y="190" width="33" height="36" fill="var(--sv-b2)"/>
<text x="337" y="213" font-size="12" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">有效计算 84%</text>
<text x="60" y="252" font-size="12" fill="var(--sv-ink)" font-family="inherit">goodput ≈ 99 × 45% × 87% × (1 − 3.4%) ≈ 37 EFLOPS，提升约 29%</text>
<rect x="40" y="282" width="12" height="12" fill="var(--sv-a)"/>
<text x="58" y="293" font-size="12" fill="var(--sv-muted)" font-family="inherit">有效计算 65% → 84%</text>
<rect x="40" y="306" width="12" height="12" fill="var(--sv-b)"/>
<text x="58" y="317" font-size="12" fill="var(--sv-muted)" font-family="inherit">故障停机 11% → 5%</text>
<rect x="40" y="330" width="12" height="12" fill="var(--sv-c)"/>
<text x="58" y="341" font-size="12" fill="var(--sv-muted)" font-family="inherit">回滚重算 8% → 3%</text>
<rect x="390" y="282" width="12" height="12" fill="var(--sv-a2)"/>
<text x="408" y="293" font-size="12" fill="var(--sv-muted)" font-family="inherit">checkpoint 写入 6% → 3%</text>
<rect x="390" y="306" width="12" height="12" fill="var(--sv-b2)"/>
<text x="408" y="317" font-size="12" fill="var(--sv-muted)" font-family="inherit">排队与掉队 10% → 5%</text>
<text x="390" y="341" font-size="12" fill="var(--sv-ink)" font-family="inherit">四项各压一半，goodput 提升近三成</text>
</svg><figcaption>图 2 · goodput 的时间分解：有效时间（有效计算 + 回滚重算）从 73% 升到 87%，产出差异主要不来自 MFU，而来自停机、回滚与排队。</figcaption></figure>
<p>四个乘数对应四类手段：降 T_down 靠快速定位、热备、多平面与自动 drain；降 T_ckpt 靠异步与分片写入；降 R_rollback 靠合理间隔与增量快照；降 T_straggle 靠剔除慢节点与按 p99 做同步决策。它们互相牵制，最优解就是下一节的公式。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>MFU 是发动机热效率，goodput 是卡车每天送达的包裹数。发动机再先进，若一半时间修车、一半时间退回重送，客户收到的货还是少。管理者盯的是到货量，不是马力。</div></div>
<h3>三个常见错觉</h3>
<p>第一，把峰值算力乘卡数当成产能。99 EFLOPS 是实验室口径，真实产出先乘 MFU、再乘有效时间，能到 30% 已经不错。第二，把平均带宽正常当成健康。尾延迟可在平均利用率 50% 时把同步步拖长一倍，必须看 p99 与 ECN 标记率。第三，把 checkpoint 越频繁当成越安全。写入挤占存储与网络带宽，净效果可能更差；先量 C，再套公式。</p>
</section>

<section class="sec">
<h2>Checkpoint 与重启：在故障之间完成有效计算</h2>
<p>checkpoint 的间隔不能拍脑袋。设单次写入的阻塞成本为 C 秒，集群 MTBF 为 M 秒，最优间隔近似为 √(2CM)。这是 Young 1974 给出的一阶近似（Daly 2006 给出高阶修正）：间隔太短，写入吃掉训练；太长，每次故障回滚更多步。</p>
<div class="formula">T* ≈ √(2 × C × M)<br>总开销 ≈ C / T* + T* / (2M)　（前者为写入，后者为期望回滚）</div>
<p>代入十万卡量级：C = 60 秒、M = 1800 秒，T* ≈ 465 秒，开销 12.9% + 12.9% ≈ 26%，不可接受。异步写入把阻塞压到 10 秒后，T* ≈ 190 秒，开销约 10.6%。<mark>checkpoint 不是“要不要优化”，而是“不优化就跑不动”</mark>。</p>
<p>落地有四层手段。分片写：每个 rank 直接写自己的分片，避免 rank 0 聚合。异步：先拷到主机内存或 NVMe，立即返回训练，后台再刷到并行文件系统，用双缓冲保证一致性。分层：最近快照留本地盘快速恢复，周期性全量写对象存储。完整性：全局 step、优化器状态、随机数、数据位置与 AMP scaler 必须一起存，否则恢复后曲线漂移。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="故障恢复流程与各阶段耗时：检测、定位、隔离、回滚、重建通信组、预热">
<text x="20" y="24" font-size="15" fill="var(--sv-ink)" font-family="inherit">一次故障恢复：六个阶段，十八分钟</text>
<text x="20" y="44" font-size="12" fill="var(--sv-muted)" font-family="inherit">时间为量级示意，取决于集群规模、调度器与存储</text>
<rect x="20" y="70" width="105" height="76" rx="5" fill="var(--sv-a2)"/>
<text x="72" y="92" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">① 检测</text>
<text x="72" y="112" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">心跳 / 超时</text>
<text x="72" y="134" font-size="11" text-anchor="middle" fill="var(--sv-a)" font-family="inherit">秒级</text>
<rect x="141" y="70" width="105" height="76" rx="5" fill="var(--sv-b2)"/>
<text x="193" y="92" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">② 定位</text>
<text x="193" y="112" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">Xid / ibstat</text>
<text x="193" y="134" font-size="11" text-anchor="middle" fill="var(--sv-a)" font-family="inherit">1–5 min</text>
<rect x="262" y="70" width="105" height="76" rx="5" fill="var(--sv-c)"/>
<text x="314" y="92" font-size="12" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">③ 隔离</text>
<text x="314" y="112" font-size="11" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">drain / 切面</text>
<text x="314" y="134" font-size="11" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">1–2 min</text>
<rect x="383" y="70" width="105" height="76" rx="5" fill="var(--sv-a)"/>
<text x="435" y="92" font-size="12" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">④ 回滚</text>
<text x="435" y="112" font-size="11" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">读 checkpoint</text>
<text x="435" y="134" font-size="11" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">2–5 min</text>
<rect x="504" y="70" width="105" height="76" rx="5" fill="var(--sv-b)"/>
<text x="556" y="92" font-size="12" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">⑤ 重建</text>
<text x="556" y="112" font-size="11" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">进程组 / NCCL</text>
<text x="556" y="134" font-size="11" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">3–10 min</text>
<rect x="625" y="70" width="105" height="76" rx="5" fill="var(--sv-a2)"/>
<text x="677" y="92" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">⑥ 预热</text>
<text x="677" y="112" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">warmup / seek</text>
<text x="677" y="134" font-size="11" text-anchor="middle" fill="var(--sv-a)" font-family="inherit">1–3 min</text>
<line x1="125" y1="108" x2="137" y2="108" stroke="var(--sv-ink)" stroke-width="1.5"/>
<line x1="246" y1="108" x2="258" y2="108" stroke="var(--sv-ink)" stroke-width="1.5"/>
<line x1="367" y1="108" x2="379" y2="108" stroke="var(--sv-ink)" stroke-width="1.5"/>
<line x1="488" y1="108" x2="500" y2="108" stroke="var(--sv-ink)" stroke-width="1.5"/>
<line x1="609" y1="108" x2="621" y2="108" stroke="var(--sv-ink)" stroke-width="1.5"/>
<text x="20" y="182" font-size="12" fill="var(--sv-muted)" font-family="inherit">各阶段时间占比（合计约 18 分钟）</text>
<rect x="50" y="194" width="11" height="30" fill="var(--sv-a2)"/>
<rect x="61" y="194" width="110" height="30" fill="var(--sv-b2)"/>
<rect x="171" y="194" width="37" height="30" fill="var(--sv-c)"/>
<rect x="208" y="194" width="147" height="30" fill="var(--sv-a)"/>
<rect x="355" y="194" width="293" height="30" fill="var(--sv-b)"/>
<rect x="648" y="194" width="73" height="30" fill="var(--sv-a2)"/>
<text x="116" y="214" font-size="10" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">定位 3</text>
<text x="281" y="214" font-size="10" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">回滚 4</text>
<text x="501" y="214" font-size="10" text-anchor="middle" fill="var(--sv-bg)" font-family="inherit">重建通信组 8</text>
<text x="684" y="214" font-size="10" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">预热 2</text>
<text x="50" y="248" font-size="11" fill="var(--sv-muted)" font-family="inherit">分钟</text>
<text x="20" y="284" font-size="13" fill="var(--sv-ink)" font-family="inherit">在十万卡上，重建通信组往往比读 checkpoint 更贵。</text>
<text x="20" y="310" font-size="12" fill="var(--sv-muted)" font-family="inherit">把第 ⑤ 步从 10 分钟压到 3 分钟，比把第 ② 步从 3 分钟压到 1 分钟更值钱。</text>
<text x="20" y="336" font-size="12" fill="var(--sv-muted)" font-family="inherit">热备节点、预建进程组、把拓扑缓存下来，是压缩尾部的三条主路径。</text>
</svg><figcaption>图 3 · 故障恢复的六个阶段：检测很快，定位与重建通信组最慢；优化要压大头，而不是压最容易的一步。</figcaption></figure>
<p>重启阶段常被低估。十万卡下 NCCL 初始化要交换拓扑、建 ring/tree、做连通性检查，动辄数分钟；调度器重新分配节点、拉镜像也要时间。可行手段是弹性 rendezvous、预建通信组、1%–3% 热备与镜像预置。热备降的是 MTTR 而非 MTBF，但对 90% 有效时间同样关键。</p>
<pre class="code" data-lang="bash"><code># 1) 定位：先看 ECC 与行重映射，再从内核日志看 Xid，最后看 IB 链路
nvidia-smi -q -d ECC,ROW_REMAPPER | grep -E "Remapped|Volatile|Pending"
dmesg | grep -i "Xid" | tail -20
ibstat | grep -E "State|Rate"

# 2) 隔离并排空节点，避免调度器再次分到坏卡
kubectl drain $NODE --ignore-daemonsets --delete-emptydir-data

# 3) 弹性重启：允许节点数在区间内变化，从最近 checkpoint 恢复
torchrun --nnodes $MIN_NODES:$MAX_NODES --rdzv-backend c10d \
  --rdzv-endpoint $RDZV_ENDPOINT train.py --resume $CKPT_DIR</code></pre>
<p>定期做 restore drill，确认快照能读、能续；没有演练的容灾等于没有容灾。</p>
</section>

<section class="sec">
<h2>规模落地：调度、电力与运维</h2>
<h3>拓扑感知调度：把作业装进一个“岛”</h3>
<p>十万卡的调度器不只找空闲卡，而是找形状合适的资源。gang scheduling 保证整组资源全给或全不给，避免半启动作业占卡等同伴；拓扑感知让同一作业尽量落在同一 Pod、同一超节点，减少跨 spine 流量；故障感知让降级轨与待修柜不被分配。大作业按整 Pod 预留，小作业填谷，但必须保留足够大的连续块。</p>
<p>目标函数应是 goodput，而非瞬时利用率。两个通信密集的作业塞进同一 Pod 抢带宽，利用率上去了，两个都变慢；留 1%–3% 热备看似浪费，却能把 MTTR 压到几分钟。调度策略要用作业完成时间（JCT，job completion time）做 A/B 验证，而不是看仪表盘。</p>
<h3>电力与液冷：机柜功率密度决定架构</h3>
<p>风冷上限约 20–30 kW/柜，超过就要液冷。NVL72 整柜约 120 kW，只能直接液冷（direct liquid cooling，DLC）：冷却液经 CDU（coolant distribution unit）送到每块冷板，一次侧接园区冷水或干冷器。液冷把 PUE 从 1.4–1.5 压到 1.1–1.2，代价是漏液检测、分水器、水质与冗余泵。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>配置</th><th>单机 / 单柜功率</th><th>10 万卡所需单元数</th><th>IT 负载</th><th>含 PUE 的园区负载</th></tr></thead><tbody>
<tr><td>H100 HGX，8 卡整机</td><td>约 10 kW/台</td><td>12,500 台</td><td>约 125 MW</td><td>约 150 MW（PUE 1.2）</td></tr>
<tr><td>GB200 NVL72，72 卡整机柜</td><td>约 120 kW/柜</td><td>约 1,390 柜</td><td>约 167 MW</td><td>约 200 MW（PUE 1.2）</td></tr>
<tr><td>叠加存储、网络与管理</td><td>—</td><td>—</td><td>再增 10%–15%</td><td>视配置而定</td></tr>
</tbody></table></div>
<p>供电是园区级问题，不是机房级。125–200 MW 需要专用变电站、双路市电、柴发与 UPS，选址常被电力而非土地约束；建设以年计，容量规划须比 GPU 采购提前。表中是 IT 设备负载，不含制冷余量与配电损耗，实际报装还要留 10%–20% 裕度。</p>
<h3>运维组织：把故障当流程而不是意外</h3>
<p>组织分四块：平台与 SRE 管作业与调度，网络团队管 IB/RoCE 与光模块，机房团队管电力与液冷，框架团队管 NCCL 与 checkpoint。三件事必须有：7×24 三级 on-call 与升级路径；上线前 burn-in（GPU 压测、NCCL all-reduce、ib_write_bw、ECC 扫描）；变更灰度与回滚预案。缺一件，MTTR 就会被组织摩擦拖长。</p>
<p>备件与自动化决定 MTTR 下限：光模块按 3%–5% 备货，网卡与整机按故障率备；监控把 Xid、ECC 错误率、端口误码、PFC pause 汇总成健康分，达阈值自动 drain；每月做 restore drill，确认 checkpoint 能读能续。</p>
<div class="callout callout--tip"><span class="callout__label">顺序</span><div>先度量再优化：连续记录四周的 MTBF、MTTR、checkpoint 成本 C 与 goodput，再决定预算花在热备、网络还是存储上。没有基线的选择都是猜。</div></div>
</section>

<section class="sec">
<h2>自测与延伸阅读</h2>
<details class="quiz"><summary>Q1 · 按 Llama 3 的故障率外推到 10 万卡，平均多久中断一次？若要把有效训练时间保持在 90%，MTTR 上限是多少？</summary><div class="quiz__a">419 ÷ (16,384 × 54) 得到每卡每天 4.7×10⁻⁴ 次；乘 10 万卡约为每天 47 次，平均 MTBF 约 30 分钟。有效时间 90% 意味着 A = MTBF/(MTBF+MTTR) ≥ 0.9，MTTR 必须不超过 30 × 0.1/0.9 ≈ 3.3 分钟。这远低于人工定位换卡的 15–20 分钟，必须靠热备、自动 drain 与快速恢复。</div></details>
<details class="quiz"><summary>Q2 · 单次 checkpoint 阻塞成本 60 秒、集群 MTBF 1800 秒，最优间隔与总开销是多少？把阻塞成本降到 10 秒后呢？</summary><div class="quiz__a">T* = √(2×60×1800) ≈ 465 秒；开销为 60/465 + 465/3600 ≈ 12.9% + 12.9% ≈ 26%。异步写入把 C 降到 10 秒后，T* ≈ 190 秒，开销约 5.3% + 5.3% ≈ 10.6%。可见降低写入阻塞比单纯调间隔更有效。</div></details>
<details class="quiz"><summary>Q3 · 为什么不能靠 PFC 解决拥塞，而必须让 ECN/DCQCN 承担常态流控？</summary><div class="quiz__a">PFC 是逐跳的紧急刹车，靠暂停上游保护缓冲。级联 PAUSE 会形成 pause storm，缓冲出现环形依赖时还会死锁，整片网络一起停。ECN 在队列过长前标记，DCQCN 让发送端提前降速，把排队控制在缓冲上限以下。PFC 只应做最后一道保险，并用 watchdog、headroom 限制其触发。</div></details>
<details class="quiz"><summary>Q4 · NVL72 把 NVLink 域从 8 卡扩到 72 卡，收益与代价分别是什么？</summary><div class="quiz__a">收益是 TP 与 EP 可以留在 72 卡域内，跨机 all-to-all 大幅减少；铜背板替代大量线缆与光模块，降低功耗、延迟与装配故障点。代价是整柜约 120 kW 必须液冷，72 卡成为电气与制冷耦合的故障域，采购与调度粒度变成整柜，单卡维修可能影响整柜。</div></details>
<ul class="refs">
<li><b>The Llama 3 Herd of Models</b> — Meta AI, arXiv:2407.21783, 2024。16K H100 训练 405B 的故障统计与运维经验，本篇 MTBF 外推的来源。</li>
<li><b>TPU v4: An Optically Reconfigurable Supercomputer for Machine Learning with Hardware Support for Embeddings</b> — Jouppi 等, ISCA 2023。4,096 芯片 Pod、3D torus 与光电路交换（OCS）如何绕过故障链路并改善 goodput。</li>
<li><b>NVIDIA GB200 NVL72</b> — NVIDIA 官方产品资料, 2024。72 GPU 单域、130 TB/s 聚合带宽、铜背板与液冷机柜的设计说明。</li>
<li><b>Building Meta's GenAI Infrastructure</b> — Meta Engineering Blog, 2024。两个 24,576 张 H100 集群的 RoCE/InfiniBand 组网、存储与运维实践。</li>
<li><b>A First Order Approximation to the Optimum Checkpoint Interval</b> — J. W. Young, Communications of the ACM, 1974。checkpoint 最优间隔 √(2CM) 的经典推导，本篇 checkpoint 公式的一手来源。</li>
</ul>
</section>`
};
