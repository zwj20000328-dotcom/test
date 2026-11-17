window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["observability"] = {
  slug: "observability",
  title: "可观测性与故障诊断",
  subtitle: "当 1000 张卡里有一张在拖后腿",
  level: 5,
  cluster: "平台",
  tags: ["监控", "NCCL Hang", "XID"],
  summary: "把“训练莫名变慢”拆成证据链：四层监控看什么，XID、ECC、NVLink CRC 与 IB 错误怎么读，再用决策树分流 hang、慢节点、OOM 与数据饥饿，以及隔离与演练方法。",
  keyPoints: [
    "同步训练的步时由最慢的 rank 决定：单卡慢 20% 会让全局有效算力降到约 83%，且往往没有任何报错",
    "监控要按爆炸半径分层：硬件、节点、任务、服务各自回答不同问题，采样频率与保留期也不同",
    "硬件指标看趋势不看单点：新 XID 必须归因，DBE 零容忍，CRC 与 symbol errors 看是否单调增长",
    "诊断先分叉 hang 与 slow，再按 rank 对比步时；watchdog 与自动隔离必须有复核、熔断和留证"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec"><h2>一张卡如何拖慢一千张卡</h2>
<p>设想一套 512 张 A100 80GB SXM 的集群，节点内用 NVLink、节点间用 200 Gb/s HDR InfiniBand，以数据并行为主、配合 ZeRO 分片训练 70B 模型。某天步时从 1.9 s 缓慢爬到 2.7 s，没有报错，loss 曲线正常，<code>nvidia-smi</code> 上每张卡的利用率都接近 100%。值班同学重启任务，好了两天又复发。最后定位到两件事：一张卡的 HBM 单比特 ECC 错误速率升高，且它的 SM 时钟明显低于同伴；一个 IB 端口的 symbol errors 持续增长，让它的 all-reduce 反复重传。其余 511 张卡在每个集合通信点都要等它，整步被拉长。</p>
<p>同步数据并行（synchronous data parallel）的步时是<b>最大值，不是平均值</b>。1000 张卡里有一张慢 20%，理论有效算力只剩约 83%，等于白买 167 张卡；慢 5%，也还要损失约 5%。更麻烦的是，这类故障通常没有异常栈、没有 OOM、没有进程退出，只有一根缓慢抬高的步时曲线。<mark>可观测性的任务，就是把这根曲线拆到具体的 rank、GPU、链路和代码段</mark>。</p>
<p>本篇只讲平台侧的“看见并定位”：单 kernel 剖析见“性能剖析”，集合通信见“集合通信”，推理排队见“推理”层。这里回答四个问题：是否正常、哪里异常、为什么、如何处置。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>可观测性不是“有很多仪表盘”，而是在你还不知道问题是什么的时候，系统仍能帮你提出下一个正确的问题。好的监控让排查从“猜”变成“排除”。</div></div>
</section>

<section class="sec"><h2>监控分层：先问爆炸半径，再选工具</h2>
<p>分层的依据不是工具，而是<b>故障的影响面</b>。一颗 GPU 坏了影响一个 rank，一台机器坏了影响 8 个 rank，一个交换机坏了可能影响整个 pod，一个调度器 bug 会影响所有用户。层级清楚了，告警才能带上下文，值班同学才知道该找硬件、找网络还是找框架。</p>
<ul>
<li><b>硬件层</b>：GPU 芯片、HBM、NVLink 与 NVSwitch、IB 网卡与交换机、电源与风扇。回答“哪块硅片或哪根线坏了”。</li>
<li><b>节点层</b>：CPU、内存、本地 NVMe、网卡、驱动、容器运行时。回答“是不是这台机器整体不对”。</li>
<li><b>任务层</b>：rank、step、collective、loss、吞吐、checkpoint。回答“这个 job 卡在哪一步、等了多久”。</li>
<li><b>服务层</b>：QPS、排队时长、首 token 延迟（TTFT）、每 token 延迟（TPOT）、错误率。回答“用户有没有受影响”。</li>
</ul>
<p>每层的时间尺度与保留期不同。硬件指标通常 1 到 15 s 采一次，保留 90 天；任务指标按 step 采、再按 10 s 聚合，保留 30 天；服务指标按请求采、按 1 min 聚合，保留 15 天。采样频率决定了你能回答什么问题：1 s 的分辨率能看见秒级的集合通信停顿，1 min 只能看趋势。全量高频长保留成本很高，常见做法是高频短保留、低频降采样，故障复盘时再对问题节点切到 1 s。</p>
<p>除了指标、日志、追踪这三根支柱，还有第四类数据经常被低估：<b>变更事件</b>。驱动升级、CUDA 镜像更新、NCCL 版本变化、交换机配置下发、机柜断电维护，都应该以 annotation 的形式打进同一张时间轴。很多“玄学故障”在把变更时间和异常时间对齐之后，几分钟就能归因。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="四层监控栈架构：被观测对象、采集、存储、展示与自动处置"><defs><marker id="observability-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--sv-muted)"/></marker></defs><rect x="0" y="0" width="760" height="380" fill="var(--sv-bg)"/>
<text x="18" y="62" font-size="12" fill="var(--sv-muted)" font-family="inherit">展示与处置</text>
<text x="18" y="154" font-size="12" fill="var(--sv-muted)" font-family="inherit">存储与查询</text>
<text x="18" y="252" font-size="12" fill="var(--sv-muted)" font-family="inherit">采集</text>
<text x="18" y="342" font-size="12" fill="var(--sv-muted)" font-family="inherit">被观测对象</text>
<rect x="110" y="32" width="190" height="50" rx="8" fill="var(--sv-panel)" stroke="var(--sv-a)"/><text x="205" y="54" text-anchor="middle" font-size="14" fill="var(--sv-ink)" font-family="inherit">Grafana</text><text x="205" y="72" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">看板、下钻、标注变更</text>
<rect x="320" y="32" width="190" height="50" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/><text x="415" y="54" text-anchor="middle" font-size="14" fill="var(--sv-ink)" font-family="inherit">Alertmanager</text><text x="415" y="72" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">分级路由、抑制、静默</text>
<rect x="530" y="32" width="190" height="50" rx="8" fill="var(--sv-panel)" stroke="var(--sv-a2)"/><text x="625" y="54" text-anchor="middle" font-size="14" fill="var(--sv-ink)" font-family="inherit">watchdog / 自动隔离</text><text x="625" y="72" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">cordon · drain · 通知</text>
<rect x="110" y="122" width="190" height="52" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/><text x="205" y="144" text-anchor="middle" font-size="14" fill="var(--sv-ink)" font-family="inherit">Prometheus</text><text x="205" y="162" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">指标、告警规则、15 到 30 天</text>
<rect x="320" y="122" width="190" height="52" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/><text x="415" y="144" text-anchor="middle" font-size="14" fill="var(--sv-ink)" font-family="inherit">Loki</text><text x="415" y="162" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">结构化日志、按 rank 索引</text>
<rect x="530" y="122" width="190" height="52" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/><text x="625" y="144" text-anchor="middle" font-size="14" fill="var(--sv-ink)" font-family="inherit">Tempo / Jaeger</text><text x="625" y="162" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">分布式追踪、1% 到 5% 采样</text>
<rect x="110" y="218" width="190" height="56" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/><text x="205" y="240" text-anchor="middle" font-size="14" fill="var(--sv-ink)" font-family="inherit">DCGM + node exporter</text><text x="205" y="258" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">GPU、ECC、XID、CPU、磁盘</text>
<rect x="320" y="218" width="190" height="56" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/><text x="415" y="240" text-anchor="middle" font-size="14" fill="var(--sv-ink)" font-family="inherit">IB / 网络 exporter</text><text x="415" y="258" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">端口状态、symbol errors、CRC</text>
<rect x="530" y="218" width="190" height="56" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/><text x="625" y="240" text-anchor="middle" font-size="14" fill="var(--sv-ink)" font-family="inherit">OTel Collector</text><text x="625" y="258" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">应用指标、日志、span 统一入口</text>
<rect x="110" y="314" width="190" height="46" rx="8" fill="var(--sv-a)"/><text x="205" y="334" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">GPU / HBM / NVLink</text><text x="205" y="351" text-anchor="middle" font-size="11" fill="var(--sv-ink)" font-family="inherit">ECC、XID、时钟、温度</text>
<rect x="320" y="314" width="190" height="46" rx="8" fill="var(--sv-c)"/><text x="415" y="334" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">IB / 以太网</text><text x="415" y="351" text-anchor="middle" font-size="11" fill="var(--sv-ink)" font-family="inherit">链路、重传、交换机</text>
<rect x="530" y="314" width="190" height="46" rx="8" fill="var(--sv-b)"/><text x="625" y="334" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">训练任务 / 推理服务</text><text x="625" y="351" text-anchor="middle" font-size="11" fill="var(--sv-ink)" font-family="inherit">rank、step、延迟、错误率</text>
<line x1="310" y1="310" x2="310" y2="278" stroke="var(--sv-muted)" marker-end="url(#observability-arrow)"/><text x="318" y="300" font-size="11" fill="var(--sv-muted)" font-family="inherit">拉取 1 到 15 s</text>
<line x1="520" y1="310" x2="520" y2="278" stroke="var(--sv-muted)" marker-end="url(#observability-arrow)"/>
<line x1="310" y1="214" x2="310" y2="178" stroke="var(--sv-muted)" marker-end="url(#observability-arrow)"/><text x="318" y="202" font-size="11" fill="var(--sv-muted)" font-family="inherit">写入</text>
<line x1="520" y1="214" x2="520" y2="178" stroke="var(--sv-muted)" marker-end="url(#observability-arrow)"/>
<line x1="310" y1="118" x2="310" y2="86" stroke="var(--sv-muted)" marker-end="url(#observability-arrow)"/><text x="318" y="108" font-size="11" fill="var(--sv-muted)" font-family="inherit">查询 · 告警</text>
<line x1="520" y1="118" x2="520" y2="86" stroke="var(--sv-muted)" marker-end="url(#observability-arrow)"/>
<text x="380" y="374" text-anchor="middle" font-size="12" fill="var(--sv-muted)" font-family="inherit">指标回答“有没有”，日志回答“为什么”，追踪回答“在哪里”，变更事件回答“从什么时候开始”</text></svg><figcaption>图 1 · 监控栈：采集、存储、展示与处置四层，告警必须能回到具体 rank 与设备</figcaption></figure>
<p>数据流本身很朴素：对象暴露指标，exporter 转成 Prometheus 格式，Prometheus 拉取并求值告警规则，Grafana 查询展示，Alertmanager 路由，最后交给 watchdog 执行隔离。Prometheus 默认拉取，适合长任务；几秒结束的短命任务要由框架主动推送，否则来不及 scrape。每节点一个 DCGM exporter（默认 9400 端口）比每卡一个进程更稳，node exporter 默认 9100 端口。</p>
</section>

<section class="sec"><h2>关键指标：哪些数字真的能定位问题</h2>
<p>指标很多，能改变决策的很少。下面这张表按“看到什么、怎么判、先做什么”组织。<b>阈值只是起点</b>，最终要用自己机队、自己型号的基线去校准；不同功耗策略和散热条件下，正常区间可以差很多。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>指标</th><th>典型采集方式</th><th>判读口径</th><th>第一动作</th></tr></thead><tbody>
<tr><td>XID 错误</td><td><code>dmesg</code>、<code>DCGM_FI_DEV_XID_ERRORS</code></td><td>任何新 XID 都要归因；48、79、95 视为不可恢复，94（contained）立即隔离复核</td><td>保留日志，cordon 后 drain</td></tr>
<tr><td>ECC SBE / DBE</td><td><code>DCGM_FI_DEV_ECC_SBE_VOL_TOTAL</code>、<code>DBE_VOL_TOTAL</code></td><td>DBE 大于等于 1 即隔离；SBE 看增速相对机队基线</td><td>DBE 换卡；SBE 观察并复测</td></tr>
<tr><td>NVLink CRC</td><td><code>nvidia-smi nvlink -e</code>、<code>DCGM_FI_DEV_NVLINK_CRC_*</code></td><td>计数单调增长即异常；单次非零可先观察</td><td>换线或换板，复测带宽</td></tr>
<tr><td>IB symbol errors</td><td><code>perfquery</code>、<code>ibdiagnet</code>、Mellanox exporter</td><td>symbol_error 持续增长，或 link_downed 大于 0</td><td>换端口与线缆，查交换机</td></tr>
<tr><td>降频</td><td><code>nvidia-smi -q -d PERFORMANCE</code>、<code>DCGM_FI_DEV_SM_CLK</code></td><td>低于 base clock，且出现 HW Slowdown 或 Thermal</td><td>查散热、功耗墙与固件</td></tr>
<tr><td>SM 活跃度</td><td><code>DCGM_FI_PROF_SM_ACTIVE</code></td><td>训练常见 70% 到 90%；骤降说明在等</td><td>对齐 nsys 时间线找空洞</td></tr>
<tr><td>Tensor 活跃度</td><td><code>DCGM_FI_PROF_PIPE_TENSOR_ACTIVE</code></td><td>依模型而定；GEMM 密集任务通常在 40% 到 50% 以上量级</td><td>判断算力是否真的被用上</td></tr>
<tr><td>GPU util</td><td><code>DCGM_FI_DEV_GPU_UTIL</code></td><td>只表示有 kernel 在跑，不等于算力利用率</td><td>不作为结论指标</td></tr>
</tbody></table></div>
<p>XID 是驱动写到内核日志里的数值错误码，<b>不是所有 XID 都等于硬件坏</b>。13 与 31 常和非法访存、驱动或容器问题相关，应先查应用；43 表示 GPU 停止处理；48 是双比特 ECC 错误（DBE）；79 是“GPU has fallen off the bus”；74 与 NVLink 相关；63 与 64 涉及 ECC 行重映射；92 表示单比特错误率过高；94 与 95 是 contained 与 uncontained ECC；119 与 120 与 GSP 相关。原则是：新出现的 XID 必须归因，48、79、95 直接隔离，94（contained ECC）也应立即隔离复核，13、31 先排除应用问题。用 <code>dmesg -T</code> 和 DCGM 双路采集，因为 DCGM 可能只保留错误码或计数，而内核日志保留时间戳与上下文。</p>
<p>ECC 要区分可纠正（SBE）与不可纠正（DBE）。SBE 在 HBM 上并不罕见，关键看<b>速率</b>：同型号、同批次的机队里，某张卡的 SBE 增速明显高于中位数，就是早期失效信号；DBE 一次都不能放过。NVLink 看 CRC flit 与 data error，按链路统计。A100 SXM 每 GPU 有 12 条 NVLink 链路、合计 600 GB/s，H100 SXM 每 GPU 是 18 条、900 GB/s（均为双向合计，视 SKU）。单次 CRC 可能只是瞬态，计数单调增长才是问题；一条降级的链路仍可能跑过低负载带宽测试，所以要看趋势而不是一次结果。</p>
<p>IB 的 symbol errors 是物理层指标，<code>perfquery</code> 与 <code>ibdiagnet</code> 可读。链路重传会把物理错误伪装成“通信慢”，应用层只看到 all-reduce 时间变长，很容易误判成算法或拓扑问题。link_downed 大于 0，或 symbol_error 持续增长，就查端口、线缆和交换机。降频看 throttle reasons：SW Power Cap 可能是预期行为（A100 SXM 400 W、H100 SXM 700 W 的功耗墙，视 SKU 而定），HW Slowdown 与 HW Thermal 则要查散热与固件。SM 活跃度是“有 Warp 驻留”的时间比例，骤降通常意味着在等数据或通信；而 <code>nvidia-smi</code> 的 GPU util 只表示“有 kernel 在跑”，推理服务里常常接近 100%，不能当作算力利用率。</p>
<div class="callout callout--warn"><span class="callout__label">警告</span><div>不要抄网上的“黄金阈值”。先在健康机队上跑两周，按型号、功耗模式、模型结构分别取 P50 与 P95 做基线，再用“相对基线”的偏离告警。绝对阈值只适合 DBE 这类零容忍项。</div></div>
</section>

<section class="sec"><h2>监控栈：Prometheus、DCGM exporter 与 Grafana</h2>
<p>最小可用栈由四块组成：DCGM exporter 把 GPU 指标转成 Prometheus 格式；node exporter 提供 CPU、内存、磁盘与网卡；IB 指标由 Mellanox exporter 或 node exporter 的 infiniband collector 提供；Prometheus 负责拉取、短期存储与告警求值，Grafana 负责查询与展示。日志交给 Loki，追踪交给 Tempo 或 Jaeger，也可以用 OpenTelemetry Collector 做统一入口。</p>
<p>规模问题主要在<b>时间序列基数</b>。1000 张卡、每卡约 100 个指标，就是 10 万条序列，单机 Prometheus 通常可以扛，但前提是控制 label。<code>gpu</code>、<code>instance</code>、<code>job</code>、<code>rank</code> 是低基数；pod UID、请求 ID、完整命令行是高基数，绝不能进 label。按 15 s 抓取、30 天保留估算存储，会比 1 s 抓取低一个数量级多（约 15 倍）；故障复盘时再对问题节点临时切到 1 s。</p>
<pre class="code" data-lang="bash"><code># 每节点一个 dcgm-exporter，默认监听 9400 端口
dcgm-exporter --collectors /etc/dcgm-exporter/default-counters.csv

# prometheus.yml 片段：15 s 抓一次 GPU 指标
scrape_configs:
  - job_name: dcgm
    scrape_interval: 15s
    static_configs:
      - targets: ["gpu-node-01:9400", "gpu-node-02:9400"]

# 先确认指标存在，再查是哪张卡
curl -s http://gpu-node-01:9400/metrics | grep DCGM_FI_DEV_XID_ERRORS

# PromQL：过去 10 分钟是否出现过非零 XID（再结合 dmesg 时间戳判断新旧）
max_over_time(DCGM_FI_DEV_XID_ERRORS[10m]) &gt; 0

# PromQL：SM 活跃度最低的 10 张卡
bottomk(10, avg by (instance, gpu) (DCGM_FI_PROF_SM_ACTIVE))</code></pre>
<p>Grafana 的布局应该按层，不按工具。第一行放四个数：job 步时、有效吞吐、异常 GPU 数、未处理告警数；第二行放按 rank 的步时热力图，让长尾一眼可见；第三行做单卡下钻：SM 与 Tensor 活跃度、显存、时钟、XID、NVLink 与 IB 错误。每块面板只回答一个问题，不要堆一面“电视墙”。告警分两级：<b>症状告警</b>（步时超基线 20% 持续 10 分钟、job 10 分钟没有 step）负责叫人；<b>根因指标</b>（XID、DBE、link down）负责定位与自动处置。只告警根因会漏掉没有错误码的慢，只告警症状则会让人每次都从零查起。</p>
<p>日志与追踪补上“为什么”和“在哪里”。训练日志统一成 JSON，至少带 <code>job</code>、<code>rank</code>、<code>global_rank</code>、<code>step</code>、<code>collective</code>、<code>duration_ms</code> 这些字段，Loki 按 job 与 rank 建索引，避免全文扫描。追踪用 OpenTelemetry 给 dataloader、H2D 拷贝、forward、backward、all-reduce 打 span，把 trace_id 与 rank 一并写进日志。NCCL 的 flight recorder 能在 hang 时 dump 最近一段集合通信状态，是保留现场的好帮手。追踪采样 1% 到 5%，否则开销和存储都受不了。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>先保证能回答“哪张卡、哪一步、等了多久”，再追求全链路。没有 rank 维度的监控，在千卡规模约等于没有监控。</div></div>
</section>

<section class="sec"><h2>故障决策树：hang、慢节点、OOM 与数据饥饿</h2>
<p>第一刀永远是分叉：<b>全体停住，还是局部变慢</b>。前者看最后一个完成的 collective 与进程状态，后者对比每个 rank 的步时。方向分错，后面的命令再多也是浪费。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="训练故障决策树：hang、slow、OOM 与数据饥饿的分支与处置"><defs><marker id="observability-tree-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--sv-muted)"/></marker></defs><rect x="0" y="0" width="760" height="380" fill="var(--sv-bg)"/>
<path d="M 380 18 L 520 62 L 380 106 L 240 62 Z" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"/><text x="380" y="58" text-anchor="middle" font-size="14" fill="var(--sv-ink)" font-family="inherit">任务异常</text><text x="380" y="78" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">慢 / 停 / 崩</text>
<line x1="330" y1="92" x2="210" y2="126" stroke="var(--sv-muted)" marker-end="url(#observability-tree-arrow)"/><line x1="430" y1="92" x2="550" y2="126" stroke="var(--sv-muted)" marker-end="url(#observability-tree-arrow)"/>
<rect x="60" y="126" width="280" height="50" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/><text x="200" y="148" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">全体 rank 同时无进展</text><text x="200" y="167" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">hang：日志停在同一个 collective</text>
<rect x="420" y="126" width="280" height="50" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/><text x="560" y="148" text-anchor="middle" font-size="13" fill="var(--sv-ink)" font-family="inherit">个别 rank 持续偏慢</text><text x="560" y="167" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">slow：步时抬高但仍有进展</text>
<line x1="200" y1="176" x2="190" y2="198" stroke="var(--sv-muted)" marker-end="url(#observability-tree-arrow)"/><line x1="560" y1="176" x2="570" y2="198" stroke="var(--sv-muted)" marker-end="url(#observability-tree-arrow)"/>
<rect x="40" y="198" width="300" height="46" rx="8" fill="var(--sv-panel)" stroke="var(--sv-a2)"/><text x="190" y="226" text-anchor="middle" font-size="12" fill="var(--sv-ink)" font-family="inherit">查 rank 日志、NCCL_DEBUG 与超时</text>
<rect x="420" y="198" width="300" height="46" rx="8" fill="var(--sv-panel)" stroke="var(--sv-a2)"/><text x="570" y="226" text-anchor="middle" font-size="12" fill="var(--sv-ink)" font-family="inherit">对比每 rank 步时、显存与本地 I/O</text>
<line x1="160" y1="244" x2="105" y2="276" stroke="var(--sv-muted)" marker-end="url(#observability-tree-arrow)"/><line x1="220" y1="244" x2="260" y2="276" stroke="var(--sv-muted)" marker-end="url(#observability-tree-arrow)"/><line x1="500" y1="244" x2="430" y2="276" stroke="var(--sv-muted)" marker-end="url(#observability-tree-arrow)"/><line x1="570" y1="244" x2="550" y2="276" stroke="var(--sv-muted)" marker-end="url(#observability-tree-arrow)"/><line x1="640" y1="244" x2="680" y2="276" stroke="var(--sv-muted)" marker-end="url(#observability-tree-arrow)"/>
<rect x="15" y="276" width="160" height="64" rx="8" fill="var(--sv-panel)" stroke="var(--sv-c)"/><text x="95" y="296" text-anchor="middle" font-size="11" fill="var(--sv-ink)" font-family="inherit">XID 48/79/95</text><text x="95" y="313" text-anchor="middle" font-size="11" fill="var(--sv-ink)" font-family="inherit">→ 立即隔离</text><text x="95" y="330" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">94 复核；留 dmesg</text>
<rect x="190" y="276" width="150" height="64" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/><text x="265" y="296" text-anchor="middle" font-size="11" fill="var(--sv-ink)" font-family="inherit">IB link down / CRC</text><text x="265" y="313" text-anchor="middle" font-size="11" fill="var(--sv-ink)" font-family="inherit">→ 换端口与线缆</text><text x="265" y="330" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">查 leaf 交换机</text>
<rect x="355" y="276" width="125" height="64" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/><text x="417" y="296" text-anchor="middle" font-size="11" fill="var(--sv-ink)" font-family="inherit">单 rank 慢</text><text x="417" y="313" text-anchor="middle" font-size="11" fill="var(--sv-ink)" font-family="inherit">→ straggler</text><text x="417" y="330" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">隔离后复测</text>
<rect x="490" y="276" width="115" height="64" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/><text x="547" y="296" text-anchor="middle" font-size="11" fill="var(--sv-ink)" font-family="inherit">DataLoader 慢</text><text x="547" y="313" text-anchor="middle" font-size="11" fill="var(--sv-ink)" font-family="inherit">→ 扩 worker</text><text x="547" y="330" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">查存储带宽</text>
<rect x="615" y="276" width="130" height="64" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/><text x="680" y="296" text-anchor="middle" font-size="11" fill="var(--sv-ink)" font-family="inherit">OOM</text><text x="680" y="313" text-anchor="middle" font-size="11" fill="var(--sv-ink)" font-family="inherit">→ 调 batch/ckpt</text><text x="680" y="330" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">看碎片与泄漏</text>
<text x="380" y="366" text-anchor="middle" font-size="11" fill="var(--sv-muted)" font-family="inherit">先保留现场再重启：hang 的第一手证据往往只在 dmesg 与最后一个 collective 里</text></svg><figcaption>图 2 · 故障决策树：先分 hang 与 slow，再把硬件、网络、数据与显存问题分流</figcaption></figure>
<p>hang 的排查顺序建议固定。第一，确认进程是否还活着：<code>ps</code>、<code>py-spy dump --pid $RANK_PID</code>，看它卡在 <code>cudaDeviceSynchronize</code> 还是 <code>ncclCommInitRank</code>。第二，抓内核日志：<code>dmesg -T | grep -i -E "xid|nvrm"</code>，任何新 XID 都可能是根因。第三，看网络：<code>ibstat</code> 与 <code>perfquery</code>，端口是否 Active，link_downed 是否增长。第四，看 NCCL：用 <code>NCCL_DEBUG=INFO</code> 与 <code>NCCL_DEBUG_SUBSYS=ALL</code> 重跑小规模复现，日志会显示每个 rank 进入哪个 collective、在等谁。常见根因包括：某个 rank 已崩溃但没被及时发现，其余 rank 在 all-reduce 上等到超时；各 rank 的集合通信调用顺序不一致；IB 链路闪断；GPU 掉卡。</p>
<pre class="code" data-lang="bash"><code># 卡住时先抓现场，不要急着重启
dmesg -T | grep -i -E "xid|nvrm"
nvidia-smi nvlink -e
ibstat
py-spy dump --pid $RANK_PID

# 复现时打开 NCCL 日志；异步错误处理与心跳超时按 PyTorch 版本设置
export NCCL_DEBUG=INFO
export NCCL_DEBUG_SUBSYS=ALL
export TORCH_NCCL_ASYNC_ERROR_HANDLING=1</code></pre>
<p>PyTorch 的 NCCL 超时默认在 10 到 30 分钟量级，具体值视版本而定。等待期间进程不退出、日志不报错，看起来就是“卡住”。<code>TORCH_NCCL_ASYNC_ERROR_HANDLING</code> 与心跳超时设置能让错误更早暴露，但也可能把慢当成故障，时间要按最慢的正常 step 留足余量；不同 PyTorch 版本对该变量的默认值与取值含义不同，先查对应版本文档。</p>
<p>slow 的排查从 per-rank 步时开始。单 rank 慢，查该卡的时钟、ECC、NVLink、IB 与本地 I/O；同一 leaf switch 下多个 rank 一起慢，查交换机与拥塞；所有 rank 同步变慢，查全局因素，例如 checkpoint、评估、功耗墙或数据源抖动。不要用平均步时掩盖长尾，平均值天然会把一张坏卡稀释掉。</p>
<p>OOM 先分清“真的放不下”还是“碎片或泄漏”。<code>torch.cuda.memory_summary</code> 看 reserved 与 allocated 的差距，<code>expandable_segments</code> 可以缓解碎片；泄漏则表现为每步 allocated 单调上升。真正放不下就减 micro-batch、上激活检查点或 ZeRO，这些在“ZeRO 与显存优化”一篇展开。数据饥饿的表现是 GPU 周期性空洞、SM 活跃度低、dataloader 等待高；查小文件数量、存储带宽、worker 数与 shuffle buffer，而不是先怀疑 GPU。</p>
<div class="callout callout--story"><span class="callout__label">案例</span><div>一次 256 卡任务 hang 了 40 分钟，所有 rank 的日志都停在同一个 all-reduce。团队直接重启，任务恢复，于是记为偶发。三天后复现，<code>dmesg</code> 里有一张卡在第一次 hang 之前出现了 XID 79。如果第一次先抓日志再重启，当天就能定位。hang 的第一原则：保留现场，再重启。</div></div>
</section>

<section class="sec"><h2>慢节点检测：从平均值到稳健统计</h2>
<p>只看每卡 SM 活跃度抓不到 straggler，因为它可能是“忙但慢”：时钟低、HBM 出现页退休、链路重传，都会让它算得更久，SM 照样是忙的。要按 rank 采集每步耗时，窗口取 50 到 100 步，并且只比较相同 micro-batch、相同 collective 次数的窗口，排除 checkpoint 与评估阶段。</p>
<div class="formula">T_step = max_i T_i
η = (1/N) Σ_i T_i ÷ max_i T_i = (N + p) ÷ (N × (1 + p)) ≈ 1 ÷ (1 + p)
z_i = (T_i − median(T)) ÷ (1.4826 × MAD)</div>
<p>若最慢 rank 比中位数慢 p，以中位数步时为理想值，整体效率就是 1/(1+p)；若按上面的平均步时定义，精确值为 (N+p)/(N(1+p))，N 很大时两者几乎相同。p=5% 时约 95.2%，p=20% 时约 83.3%，p=100% 时只剩约 50%。1000 张卡、p=20% 时，等效只有约 833 张在干活。用均值会被长尾稀释，用中位数与 MAD 更稳：MAD 对少量离群点不敏感，1.4826 是让 MAD 在正态分布下与标准差对齐的常数。经验上 z 大于 3.5 且连续 3 个窗口成立，再触发告警，可以过滤掉偶发抖动。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="慢节点检测：每 rank 步时条形图与同步训练等待放大时间线"><rect x="0" y="0" width="760" height="380" fill="var(--sv-bg)"/>
<text x="50" y="36" font-size="12" fill="var(--sv-ink)" font-family="inherit">每 rank 步时（同一 5 分钟窗口，ms）</text>
<line x1="50" y1="50" x2="50" y2="300" stroke="var(--sv-line)"/><line x1="50" y1="300" x2="405" y2="300" stroke="var(--sv-line)"/>
<line x1="50" y1="200" x2="405" y2="200" stroke="var(--sv-b)" stroke-dasharray="4 4"/><text x="55" y="194" font-size="11" fill="var(--sv-b)" font-family="inherit">中位数 100 ms</text>
<line x1="50" y1="125" x2="405" y2="125" stroke="var(--sv-c)" stroke-dasharray="4 4"/><text x="55" y="119" font-size="11" fill="var(--sv-c)" font-family="inherit">阈值 115 ms（中位数 × 1.15）</text>
<rect x="60" y="205" width="15" height="95" fill="var(--sv-a)"/><rect x="81" y="195" width="15" height="105" fill="var(--sv-a)"/><rect x="102" y="210" width="15" height="90" fill="var(--sv-a)"/><rect x="123" y="200" width="15" height="100" fill="var(--sv-a)"/><rect x="144" y="190" width="15" height="110" fill="var(--sv-a)"/><rect x="165" y="215" width="15" height="85" fill="var(--sv-a)"/><rect x="186" y="200" width="15" height="100" fill="var(--sv-a)"/><rect x="207" y="185" width="15" height="115" fill="var(--sv-a)"/><rect x="228" y="205" width="15" height="95" fill="var(--sv-a)"/><rect x="249" y="195" width="15" height="105" fill="var(--sv-a)"/><rect x="270" y="200" width="15" height="100" fill="var(--sv-a)"/><rect x="291" y="60" width="15" height="240" fill="var(--sv-c)"/><rect x="312" y="210" width="15" height="90" fill="var(--sv-a)"/><rect x="333" y="190" width="15" height="110" fill="var(--sv-a)"/><rect x="354" y="205" width="15" height="95" fill="var(--sv-a)"/><rect x="375" y="200" width="15" height="100" fill="var(--sv-a)"/>
<text x="310" y="54" font-size="11" fill="var(--sv-c)" font-family="inherit">r11 = 128 ms</text>
<text x="42" y="304" text-anchor="end" font-size="10" fill="var(--sv-muted)" font-family="inherit">80</text><text x="42" y="204" text-anchor="end" font-size="10" fill="var(--sv-muted)" font-family="inherit">100</text><text x="42" y="104" text-anchor="end" font-size="10" fill="var(--sv-muted)" font-family="inherit">120</text>
<text x="67" y="316" text-anchor="middle" font-size="10" fill="var(--sv-muted)" font-family="inherit">r0</text><text x="172" y="316" text-anchor="middle" font-size="10" fill="var(--sv-muted)" font-family="inherit">r5</text><text x="277" y="316" text-anchor="middle" font-size="10" fill="var(--sv-muted)" font-family="inherit">r10</text><text x="382" y="316" text-anchor="middle" font-size="10" fill="var(--sv-muted)" font-family="inherit">r15</text>
<text x="435" y="36" font-size="12" fill="var(--sv-ink)" font-family="inherit">一个慢 rank 拉长所有人的每一步</text>
<text x="435" y="52" font-size="10" fill="var(--sv-muted)" font-family="inherit">r6 计算 110 ms，其余 80 ms；all-reduce 40 ms</text>
<line x1="555" y1="60" x2="555" y2="296" stroke="var(--sv-muted)" stroke-dasharray="3 4"/><text x="559" y="306" font-size="10" fill="var(--sv-muted)" font-family="inherit">barrier</text>
<text x="440" y="77" text-anchor="end" font-size="10" fill="var(--sv-ink)" font-family="inherit">r0</text><text x="440" y="107" text-anchor="end" font-size="10" fill="var(--sv-ink)" font-family="inherit">r1</text><text x="440" y="137" text-anchor="end" font-size="10" fill="var(--sv-ink)" font-family="inherit">r2</text><text x="440" y="167" text-anchor="end" font-size="10" fill="var(--sv-ink)" font-family="inherit">r3</text><text x="440" y="197" text-anchor="end" font-size="10" fill="var(--sv-ink)" font-family="inherit">r4</text><text x="440" y="227" text-anchor="end" font-size="10" fill="var(--sv-ink)" font-family="inherit">r5</text><text x="440" y="257" text-anchor="end" font-size="10" fill="var(--sv-c)" font-family="inherit">r6</text><text x="440" y="287" text-anchor="end" font-size="10" fill="var(--sv-ink)" font-family="inherit">r7</text>
<rect x="445" y="64" width="80" height="18" fill="var(--sv-a)"/><rect x="525" y="64" width="30" height="18" fill="var(--sv-b2)"/><rect x="555" y="64" width="40" height="18" fill="var(--sv-b)"/>
<rect x="445" y="94" width="80" height="18" fill="var(--sv-a)"/><rect x="525" y="94" width="30" height="18" fill="var(--sv-b2)"/><rect x="555" y="94" width="40" height="18" fill="var(--sv-b)"/>
<rect x="445" y="124" width="80" height="18" fill="var(--sv-a)"/><rect x="525" y="124" width="30" height="18" fill="var(--sv-b2)"/><rect x="555" y="124" width="40" height="18" fill="var(--sv-b)"/>
<rect x="445" y="154" width="80" height="18" fill="var(--sv-a)"/><rect x="525" y="154" width="30" height="18" fill="var(--sv-b2)"/><rect x="555" y="154" width="40" height="18" fill="var(--sv-b)"/>
<rect x="445" y="184" width="80" height="18" fill="var(--sv-a)"/><rect x="525" y="184" width="30" height="18" fill="var(--sv-b2)"/><rect x="555" y="184" width="40" height="18" fill="var(--sv-b)"/>
<rect x="445" y="214" width="80" height="18" fill="var(--sv-a)"/><rect x="525" y="214" width="30" height="18" fill="var(--sv-b2)"/><rect x="555" y="214" width="40" height="18" fill="var(--sv-b)"/>
<rect x="445" y="244" width="110" height="18" fill="var(--sv-c)"/><rect x="555" y="244" width="40" height="18" fill="var(--sv-b)"/>
<rect x="445" y="274" width="80" height="18" fill="var(--sv-a)"/><rect x="525" y="274" width="30" height="18" fill="var(--sv-b2)"/><rect x="555" y="274" width="40" height="18" fill="var(--sv-b)"/>
<text x="435" y="314" font-size="10" fill="var(--sv-muted)" font-family="inherit">r6：110 + 40 = 150 ms</text>
<text x="435" y="328" font-size="10" fill="var(--sv-muted)" font-family="inherit">其余：80 + 30 等待 + 40 = 150 ms</text>
<text x="435" y="342" font-size="11" fill="var(--sv-ink)" font-family="inherit">同步步时取最大值，有效工作 120 ÷ 150 ≈ 80%</text>
<rect x="435" y="352" width="12" height="10" fill="var(--sv-a)"/><text x="452" y="361" font-size="10" fill="var(--sv-muted)" font-family="inherit">计算</text><rect x="495" y="352" width="12" height="10" fill="var(--sv-b2)"/><text x="512" y="361" font-size="10" fill="var(--sv-muted)" font-family="inherit">等待同步</text><rect x="575" y="352" width="12" height="10" fill="var(--sv-b)"/><text x="592" y="361" font-size="10" fill="var(--sv-muted)" font-family="inherit">all-reduce</text></svg><figcaption>图 3 · 慢节点检测：左图用中位数与 MAD 找离群 rank，右图说明单点延迟如何在每个集合通信点被放大成全局损失</figcaption></figure>
<p>图 3 左边是 16 个 rank 在同一窗口的步时，r11 为 128 ms，中位数 100 ms；右边是机制：r6 每步计算多 30 ms，其余 rank 在每个 all-reduce 前都要多等 30 ms，步时从 120 ms 抬到 150 ms。注意这不是“只损失 r6 自己的 25%”，而是所有 rank 的步时都被拉长 25%，代价由整组共同承担。<mark>集合通信把单点延迟放大成了全局税</mark>，这也是千卡训练里 straggler 比单机时代致命得多的原因。</p>
<p>工程细节决定检测是否可用。rank 编号要能映射到 GPU 与节点，并写进启动参数与日志；流水并行下不同 stage 的正常步时不同，必须在同 stage 内比较；MIG 切分后不能跨实例比较；NCCL 的 rank 与 PyTorch 的 global rank 不一定相同。数据饥饿也会表现为单 rank 慢，所以先看该 rank 的 dataloader 等待与存储吞吐，再下“硬件坏了”的结论。</p>
</section>

<section class="sec"><h2>watchdog、自动隔离与演练</h2>
<p>watchdog 至少分三层：<b>任务级心跳</b>看 step 计数是否推进；<b>集合通信级超时</b>看 NCCL timeout 与 heartbeat；<b>硬件级健康检查</b>用 <code>dcgmi health -c</code> 与 <code>dcgmi diag</code>。三层要独立，因为任务级心跳可能被日志刷屏或评估阶段掩盖，硬件检查也可能漏掉链路瞬断。</p>
<p>自动隔离的流程应该是“检测 → 复核 → cordon → drain → 保留现场 → 通知 → 换件复测”。复核至少连续两个窗口，避免一次抖动就把整节点踢掉；是 drain 而不是直接 reboot，先保住 <code>dmesg</code>、<code>nvidia-smi -q</code> 与 NCCL 日志。XID 要做白名单：13 与 31 先人工确认，48、79、95 可以直接隔离，94（contained ECC）先隔离复核。还要有熔断：一次事件可能影响超过机队 5% 时停止自动操作，转为人工。<b>自动化的价值是缩短 MTTD，不是替代判断</b>。</p>
<p>基线与压测是阈值的唯一来源。新节点上线跑 <code>dcgmi diag -r 3</code> 长诊断、<code>gpu-burn</code> 30 分钟、<code>nccl-tests</code> 的 <code>all_reduce_perf</code>（消息从 8 B 覆盖到 8 GB），IB 用 perftest 的 <code>ib_write_bw</code>，存储用 fio 模拟训练读取的块大小与并发。把驱动、CUDA、NCCL、固件版本写进基线记录；同型号节点的带宽相差超过 5% 到 10% 就要查。没有基线的“阈值”只是拍脑袋。</p>
<p>演练要定期且真实。注入故障：kill 一个 rank、down 一个 IB 端口、把某张卡时钟锁低、把 dataloader 读盘限速、填满本地盘。观察告警是否在 5 分钟内到达、runbook 是否可执行、自动隔离是否误伤。记录平均检测时间（MTTD）与平均恢复时间（MTTR），事后做无责复盘。演练放在预发环境或专用分区，默认 dry-run，避免把生产任务当实验品。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>先做“只告警不处置”的观察期，至少两周，统计误报率。自动隔离的每一次动作都要可审计、可回滚；否则一次误判可能比原来的故障影响更大。</div></div>
</section>

<section class="sec"><h2>自测与延伸阅读</h2>
<p>先写下判断，再展开对照。</p>
<details class="quiz"><summary>Q1 · 1000 张卡训练，一个 rank 慢 25%，其余正常，理论有效算力是多少？如果只慢 5% 呢？</summary><div class="quiz__a">按 η ≈ 1/(1+p)：慢 25% 时约 80%，等效 800 张卡；慢 5% 时约 95.2%，等效 952 张卡。同步步时取最大值，最慢者的延迟百分比直接变成全局损失。检测时用中位数与 MAD，不要用平均步时，否则长尾会被稀释。</div></details>
<details class="quiz"><summary>Q2 · 训练 hang，dmesg 里有一张卡 XID 79，另一张卡 XID 13。分别怎么处理？</summary><div class="quiz__a">XID 79 表示 GPU 已从总线掉下，按硬件故障处理：保留日志、cordon 节点、drain、换卡或换板后复测。XID 13 是图形引擎异常，常见于非法访存、驱动或容器问题，先排除应用与驱动，不要直接判死硬件。两张卡的时间戳都要与 hang 时刻对齐，确认谁是根因、谁是连带现象。</div></details>
<details class="quiz"><summary>Q3 · GPU util 100%、SM active 35%、Tensor active 10%、步时翻倍，先查什么？</summary><div class="quiz__a">GPU util 只说明有 kernel 在跑，不能作为算力结论。SM active 35% 说明大量时间在等：先按 rank 看步时找 straggler，再看 collective 等待与 dataloader 空洞，同时查时钟是否被功耗或温度压制。如果所有 rank 一起变慢，优先查全局功耗墙、网络拥塞与存储；如果只有单 rank，查该卡的 ECC、NVLink 与 IB 计数。</div></details>
<ul class="refs"><li><b>NVIDIA DCGM User Guide</b> — NVIDIA, 持续更新。dcgm-exporter、字段字典、健康诊断与 profiling 指标的权威说明。</li><li><b>NVIDIA XID Errors</b> — NVIDIA, 持续更新。XID 编号含义、常见根因与处置建议，排查掉卡与 ECC 问题的第一入口。</li><li><b>NCCL Troubleshooting</b> — NVIDIA, 持续更新。hang、超时、网络与日志调试（NCCL_DEBUG、flight recorder）的官方指南。</li><li><b>Prometheus Documentation</b> — Prometheus 项目, 持续更新。数据模型、PromQL、抓取配置与告警规则的完整参考。</li><li><b>Grafana Documentation</b> — Grafana Labs, 持续更新。数据源、面板、告警与标注的使用手册。</li></ul>
</section>`
};
