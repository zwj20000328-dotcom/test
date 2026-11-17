window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["cluster-scheduling"] = {
  slug: "cluster-scheduling",
  title: "集群调度：Kubernetes 与 GPU 编排",
  subtitle: "把正确的任务放到正确的卡上",
  level: 5,
  cluster: "平台",
  tags: ["Kubernetes", "Gang Scheduling", "MIG", "Volcano", "Kueue"],
  summary: "从 K8s 的 GPU 资源模型出发，讲清 MIG 与共享调度的边界、gang 死锁的成因与解法、拓扑和队列配额怎么落地，并比较 Volcano、Kueue、Slurm。",
  keyPoints: [
    "device plugin 如何把 GPU 变成整数型 extended resource，以及默认为什么不能共享",
    "MIG、time-slicing、MPS 的隔离与密度取舍，A100 80GB 的 7 个切片怎么算",
    "gang scheduling 的原子性条件、死锁场景，以及 minMember 与队列的配合",
    "拓扑感知、binpack/spread、配额优先级与训练 operator 的工程组合"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>先记住一句话：GPU 是不可压缩资源</h2>
<p>在 Kubernetes 里，CPU 可以按 100m（0.1 核）切分，内存可以按 MiB 申请，但 GPU 默认是一个<b>整数型 extended resource</b>：你写 <code>nvidia.com/gpu: 1</code>，拿到的就是整张卡，哪怕模型只用了 5 GB 显存。因为显存、SM 和 NVLink 端口无法像 CPU 时间片那样安全拆分；没有硬件隔离的“软共享”，会把一个租户的显存溢出变成整张卡的故障。</p>
<p>不可压缩带来三个连锁问题。第一，<mark>排队粒度粗</mark>：一张 80 GB 的 A100 上跑一个只用 8 GB 的推理服务，剩下 72 GB 只能闲置。第二，<mark>作业需要整体放置</mark>：一个 64 卡训练作业只要还差 1 张卡，已经拿到的 63 张也只能空转，这正是 gang scheduling 要解决的问题。第三，<mark>放在哪里会改变性能</mark>：同样 8 张卡，放在同一台 NVSwitch 机器上做 all-reduce，与分散到两个 leaf 交换机，通信带宽可能差一个数量级。</p>
<p>因此调度器的目标不是“把卡塞满”，而是在<b>利用率、排队时间、作业性能与公平性</b>之间取舍。一个 512 卡（64 台 × 8 卡 A100）的集群，如果只按“有空就放”，很容易出现总空闲 40 卡、却没有任何 64 卡作业能启动的碎片化。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>CPU 像停车位，可以只租半个；GPU 像厂房，只能整栋租。八栋厂房才能开的流水线，少一栋就全都开不了——调度器要么一次留八栋，要么一栋不占。</div></div>
<p>后面的机制各对应一个故障：插件没起来看到 GPU 为 0，gang 没配训练卡死，拓扑没约束 NCCL 变慢，配额没设一个团队吃掉集群。网络链路细节放在 interconnect 一篇。</p>
</section>

<section class="sec">
<h2>Kubernetes 的 GPU 资源模型：device plugin 把卡变成整数</h2>
<p>Kubernetes 本身不认识 GPU。它通过 <b>device plugin</b> 框架接入厂商设备：每个节点跑一个 DaemonSet（NVIDIA 的是 <code>nvidia-device-plugin</code>），插件用 gRPC 的 <code>ListAndWatch</code> 向 kubelet 上报设备，kubelet 把 <code>nvidia.com/gpu</code> 写进节点的 <code>status.allocatable</code>；Pod 调度到该节点后，kubelet 调用插件的 <code>Allocate</code>，由插件把设备节点或 CDI 信息注入容器。</p>
<p>这条链路决定了调度器“看得见什么”。默认调度器只看到<b>数量</b>和一个资源名，看不到 GPU 型号、显存大小、MIG 实例的完整属性与 NVLink 拓扑，也看不到卡与网卡的 NUMA 亲和。要知道这些，只能靠节点标签（GPU Operator 与 NFD 自动打上型号、驱动、MIG 能力）、节点亲和性，或懂拓扑的调度插件。</p>
<p>extended resource 还有两条硬规则：<b>只能申请整数</b>，且 <b>requests 必须等于 limits</b>；它不支持 overcommit，也不会像 CPU 那样被 CFS 限流。于是“一张卡跑多个 Pod”必须由 device plugin 的共享配置或 MIG 来改变资源名与数量，而不是靠调低 request。MIG 模式下，节点会广播 <code>nvidia.com/mig-1g.10gb</code> 这类资源，调度器把它们当成不同的资源池分别记账。</p>
<p>生产上通常用 <b>NVIDIA GPU Operator</b> 统一管理驱动、container toolkit、device plugin、DCGM exporter、MIG manager 与 NFD；节点一多，驱动版本漂移会成为主要故障源。Kubernetes 自 1.34 起将 DRA（Dynamic Resource Allocation）转为 GA，用结构化设备请求替代纯整数计数；但多数生产集群的 GPU 共享与拓扑仍以 device plugin 为主，迁移前要评估插件与驱动兼容性。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="调度栈分层：作业 API、队列与配额、调度器、kubelet 与 device plugin、GPU 设备">
<defs>
<marker id="cluster-scheduling-arrow-1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
<path d="M 0 0 L 10 5 L 0 10 z" fill="var(--sv-line)"/>
</marker>
</defs>
<text x="30" y="24" font-size="14" font-weight="600" fill="var(--sv-ink)" font-family="inherit">调度栈分层：谁排队、谁选卡、谁注入设备</text>
<rect x="30" y="40" width="128" height="50" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="94" y="70" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">作业 API</text>
<rect x="176" y="40" width="550" height="50" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="190" y="61" font-size="13" fill="var(--sv-ink)" font-family="inherit">PyTorchJob · MPIJob · JobSet · RayJob</text>
<text x="190" y="79" font-size="12" fill="var(--sv-muted)" font-family="inherit">声明副本数、镜像、每 Pod 的 GPU 数</text>
<line x1="451" y1="90" x2="451" y2="102" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#cluster-scheduling-arrow-1)"/>
<rect x="30" y="104" width="128" height="50" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="94" y="134" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">队列与配额</text>
<rect x="176" y="104" width="550" height="50" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="190" y="125" font-size="13" fill="var(--sv-ink)" font-family="inherit">Kueue：LocalQueue → ClusterQueue（配额、借用、抢占）</text>
<text x="190" y="143" font-size="12" fill="var(--sv-muted)" font-family="inherit">Volcano：Queue（weight / capability / reclaimable）</text>
<line x1="451" y1="154" x2="451" y2="166" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#cluster-scheduling-arrow-1)"/>
<rect x="30" y="168" width="128" height="50" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="94" y="198" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">调度决策</text>
<rect x="176" y="168" width="550" height="50" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="190" y="189" font-size="13" fill="var(--sv-ink)" font-family="inherit">kube-scheduler + 插件，或 Volcano scheduler</text>
<text x="190" y="207" font-size="12" fill="var(--sv-muted)" font-family="inherit">gang · binpack/spread · 拓扑感知 · 优先级抢占</text>
<line x1="451" y1="218" x2="451" y2="230" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#cluster-scheduling-arrow-1)"/>
<rect x="30" y="232" width="128" height="50" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="94" y="262" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">节点执行</text>
<rect x="176" y="232" width="550" height="50" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="190" y="253" font-size="13" fill="var(--sv-ink)" font-family="inherit">kubelet → device plugin Allocate → CDI 注入</text>
<text x="190" y="271" font-size="12" fill="var(--sv-muted)" font-family="inherit">每个节点一个 device plugin DaemonSet</text>
<line x1="451" y1="282" x2="451" y2="294" stroke="var(--sv-line)" stroke-width="2" marker-end="url(#cluster-scheduling-arrow-1)"/>
<rect x="30" y="296" width="128" height="50" rx="6" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="94" y="326" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">设备与运行时</text>
<rect x="176" y="296" width="550" height="50" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="190" y="317" font-size="13" fill="var(--sv-ink)" font-family="inherit">GPU Operator：驱动 / toolkit / MIG Manager / DCGM</text>
<text x="190" y="335" font-size="12" fill="var(--sv-muted)" font-family="inherit">物理 GPU 或 MIG 实例：nvidia.com/gpu / mig-1g.10gb</text>
<text x="30" y="368" font-size="12" fill="var(--sv-muted)" font-family="inherit">调度器只认资源名与数量；型号、MIG 剖面与拓扑要靠标签和插件补足</text>
</svg>
<figcaption>图 1 · GPU 调度栈：上层声明作业，中层决定排队与放置，下层由 kubelet 与 device plugin 完成设备注入</figcaption>
</figure>
</section>

<section class="sec">
<h2>GPU 共享：MIG、time-slicing 与 MPS 的边界</h2>
<p>共享先问隔离，再问密度。MIG（Multi-Instance GPU）在硬件层把一张卡切成多个 GPU Instance，每个实例有独立的显存、SM 与 L2 分区，故障隔离。A100 80GB 最多 7 个实例，最小剖面 <code>1g.10gb</code>；A100 40GB 对应 <code>1g.5gb</code>。代价是剖面固定、改配置要清空整卡，且只有 A100/H100/H200、A30 等数据中心卡支持，消费级卡通常没有 MIG。</p>
<p>time-slicing 是 device plugin 的软件共享：配置 <code>replicas: 4</code> 后，一张物理卡以 4 个 <code>nvidia.com/gpu</code> 被调度，4 个 Pod 轮流使用。它没有显存与故障隔离，上下文切换有开销；优点是零改造，适合 Notebook、CI 与突发推理。<b>replicas 不是显存切分</b>：4 个副本不等于每个 Pod 20 GB，一个 Pod 就可能吃光 80 GB。</p>
<p>MPS（Multi-Process Service）介于两者之间：节点上跑一个 MPS control daemon，多个进程的 kernel 可以真正并发执行，减少上下文切换，还能用 <code>CUDA_MPS_ACTIVE_THREAD_PERCENTAGE</code> 限制 SM 占用比例。但它同样不隔离显存，一个进程的非法访存可能影响同卡其他进程，K8s 侧还要额外集成。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="A100 80GB 的 MIG 切片：7 个计算切片与 8 个 10GB 显存切片，7 个 1g.10gb 实例留下 10GB 显存闲置">
<text x="30" y="24" font-size="14" font-weight="600" fill="var(--sv-ink)" font-family="inherit">A100 80GB 的 MIG 切片：7 个计算切片、8 个显存切片</text>
<rect x="30" y="38" width="700" height="284" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="50" y="62" font-size="12" fill="var(--sv-muted)" font-family="inherit">计算切片（7 个 GPU Instance，含独立 SM 与 L2 分区）</text>
<rect x="50" y="70" width="90" height="46" rx="5" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="95" y="98" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GI 0</text>
<rect x="146" y="70" width="90" height="46" rx="5" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="191" y="98" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GI 1</text>
<rect x="242" y="70" width="90" height="46" rx="5" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="287" y="98" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GI 2</text>
<rect x="338" y="70" width="90" height="46" rx="5" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="383" y="98" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GI 3</text>
<rect x="434" y="70" width="90" height="46" rx="5" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="479" y="98" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GI 4</text>
<rect x="530" y="70" width="90" height="46" rx="5" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="575" y="98" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GI 5</text>
<rect x="626" y="70" width="90" height="46" rx="5" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="671" y="98" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GI 6</text>
<line x1="95" y1="116" x2="89" y2="170" stroke="var(--sv-a)" stroke-width="2" stroke-dasharray="5 4"/>
<text x="110" y="150" font-size="12" fill="var(--sv-ink)" font-family="inherit">1g.10gb = 1 个计算切片 + 1 个显存切片</text>
<text x="50" y="164" font-size="12" fill="var(--sv-muted)" font-family="inherit">显存切片（8 × 10 GB）</text>
<rect x="50" y="172" width="78" height="44" rx="5" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="89" y="199" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">10 GB</text>
<rect x="134" y="172" width="78" height="44" rx="5" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="173" y="199" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">10 GB</text>
<rect x="218" y="172" width="78" height="44" rx="5" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="257" y="199" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">10 GB</text>
<rect x="302" y="172" width="78" height="44" rx="5" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="341" y="199" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">10 GB</text>
<rect x="386" y="172" width="78" height="44" rx="5" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="425" y="199" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">10 GB</text>
<rect x="470" y="172" width="78" height="44" rx="5" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="509" y="199" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">10 GB</text>
<rect x="554" y="172" width="78" height="44" rx="5" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="593" y="199" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">10 GB</text>
<rect x="638" y="172" width="78" height="44" rx="5" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="677" y="199" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">10 GB</text>
<text x="677" y="232" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">闲置</text>
<text x="50" y="268" font-size="12" fill="var(--sv-muted)" font-family="inherit">显存切片有 8 个，计算切片只有 7 个；7 个 1g.10gb 无法配对第 8 个显存切片</text>
<text x="50" y="290" font-size="12" fill="var(--sv-muted)" font-family="inherit">若要占满 8 个显存切片，可混用 3g.40gb、2g.20gb 与 1g.10gb 剖面</text>
<text x="30" y="344" font-size="12" fill="var(--sv-ink)" font-family="inherit">7 个 1g.10gb 共使用 70 GB 显存，剩余 10 GB 无法被任何实例使用。</text>
<text x="30" y="364" font-size="12" fill="var(--sv-muted)" font-family="inherit">MIG 的容量规划要按剖面算，不能拿 80 GB 直接除以单实例显存。</text>
</svg>
<figcaption>图 2 · A100 80GB 的 MIG 资源账本：计算切片与显存切片数量不同，剖面组合会决定显存浪费</figcaption>
</figure>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>方式</th><th>隔离级别</th><th>最小粒度</th><th>单卡密度</th><th>故障隔离</th><th>典型场景</th></tr></thead><tbody><tr><td>MIG</td><td>硬件分区</td><td>1g.10gb（A100 80GB）</td><td>最多 7 实例</td><td>强</td><td>多租户推理/小训练</td></tr><tr><td>time-slicing</td><td>时间片轮转</td><td>整卡按副本计数</td><td>replicas 可配，常见 2–8</td><td>弱</td><td>Notebook/CI/突发推理</td></tr><tr><td>MPS</td><td>进程级并发</td><td>整卡</td><td>受显存与 SM 限制</td><td>弱</td><td>单机多小模型</td></tr></tbody></table></div>
<div class="callout callout--warn"><span class="callout__label">陷阱</span><div>replicas 只是调度账本上的副本数，不是显存配额。4 个副本共享 80 GB，一个 Pod 申请 70 GB 就会让其余 Pod 运行时 OOM。要硬隔离就用 MIG。</div></div>
<p>选型很直接：要硬隔离与多租户 SLA 用 MIG；要临时利用碎片卡用 time-slicing；单机多进程、kernel 碎且能接受弱隔离才用 MPS。密度上去后，显存带宽和 L2 往往会先成为瓶颈，profiling 见 profiling 一篇。</p>
</section>

<section class="sec">
<h2>Gang scheduling：逐 Pod 调度为什么会让训练死锁</h2>
<p>默认 kube-scheduler 的调度单位是 Pod，它不关心这些 Pod 是否属于同一个作业。设想集群只剩 6 张卡，作业 A 和 B 各需要 4 张，两个作业的 Pod 交替到达。调度器先给 A 放 3 个 Pod，再给 B 放 3 个 Pod；此时 6 张卡全满，A 还差 1 张、B 也还差 1 张，两个作业都永远等不到第 4 张卡。这就是典型的<b>资源死锁</b>（resource deadlock），同时满足 hold-and-wait、不可抢占和循环等待。</p>
<p><b>gang scheduling</b> 的做法是给作业一个最小成员数 <code>minMember</code>，调度器要么一次性凑齐全部成员，要么一个都不放。Kubernetes 生态里有三条实现路径：scheduler-plugins 的 coscheduling 插件用 PodGroup 做全有或全无；Volcano 把 gang 作为核心调度动作，并配合 queue 与 preempt；Kueue 在准入后用 <code>waitForPodsReady</code> 加超时驱逐，避免作业长期占着配额却起不来。Kubeflow 的 PyTorchJob、MPIJob 通过 <code>spec.runPolicy.schedulingPolicy.minAvailable</code> 暴露这一语义。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="gang scheduling 时序对比：默认逐 Pod 调度造成两个作业各拿三卡后死锁，gang 调度让作业整体等待再启动">
<rect x="24" y="18" width="712" height="164" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="36" y="40" font-size="13" font-weight="600" fill="var(--sv-ink)" font-family="inherit">默认调度：两个 4 卡作业各拿 3 卡 → 死锁</text>
<text x="44" y="69" font-size="12" fill="var(--sv-muted)" font-family="inherit">t1</text>
<text x="44" y="103" font-size="12" fill="var(--sv-muted)" font-family="inherit">t2</text>
<text x="44" y="137" font-size="12" fill="var(--sv-muted)" font-family="inherit">t3</text>
<rect x="100" y="52" width="92" height="26" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="146" y="70" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">A1</text>
<rect x="196" y="52" width="92" height="26" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="242" y="70" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">A2</text>
<rect x="292" y="52" width="92" height="26" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="338" y="70" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">A3</text>
<rect x="388" y="52" width="92" height="26" rx="4" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<rect x="484" y="52" width="92" height="26" rx="4" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<rect x="580" y="52" width="92" height="26" rx="4" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<rect x="100" y="86" width="92" height="26" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="146" y="104" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">A1</text>
<rect x="196" y="86" width="92" height="26" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="242" y="104" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">A2</text>
<rect x="292" y="86" width="92" height="26" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="338" y="104" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">A3</text>
<rect x="388" y="86" width="92" height="26" rx="4" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="434" y="104" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">B1</text>
<rect x="484" y="86" width="92" height="26" rx="4" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="530" y="104" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">B2</text>
<rect x="580" y="86" width="92" height="26" rx="4" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="626" y="104" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">B3</text>
<rect x="100" y="120" width="92" height="26" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="146" y="138" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">A1</text>
<rect x="196" y="120" width="92" height="26" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="242" y="138" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">A2</text>
<rect x="292" y="120" width="92" height="26" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="338" y="138" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">A3</text>
<rect x="388" y="120" width="92" height="26" rx="4" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="434" y="138" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">B1</text>
<rect x="484" y="120" width="92" height="26" rx="4" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="530" y="138" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">B2</text>
<rect x="580" y="120" width="92" height="26" rx="4" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="626" y="138" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">B3</text>
<text x="36" y="170" font-size="12" fill="var(--sv-ink)" font-family="inherit">t3：A 缺 1 卡，B 缺 1 卡，空闲 0 → 两个作业永久等待</text>
<rect x="24" y="196" width="712" height="176" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="36" y="218" font-size="13" font-weight="600" fill="var(--sv-ink)" font-family="inherit">gang 调度：A 一次占 4 卡，B 排队不占用</text>
<text x="44" y="247" font-size="12" fill="var(--sv-muted)" font-family="inherit">t1</text>
<text x="44" y="279" font-size="12" fill="var(--sv-muted)" font-family="inherit">t2</text>
<text x="44" y="311" font-size="12" fill="var(--sv-muted)" font-family="inherit">t3</text>
<text x="44" y="343" font-size="12" fill="var(--sv-muted)" font-family="inherit">t4</text>
<rect x="100" y="230" width="92" height="26" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="146" y="248" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">A1</text>
<rect x="196" y="230" width="92" height="26" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="242" y="248" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">A2</text>
<rect x="292" y="230" width="92" height="26" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="338" y="248" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">A3</text>
<rect x="388" y="230" width="92" height="26" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="434" y="248" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">A4</text>
<rect x="484" y="230" width="92" height="26" rx="4" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<rect x="580" y="230" width="92" height="26" rx="4" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<rect x="100" y="262" width="92" height="26" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="146" y="280" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">A1</text>
<rect x="196" y="262" width="92" height="26" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="242" y="280" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">A2</text>
<rect x="292" y="262" width="92" height="26" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="338" y="280" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">A3</text>
<rect x="388" y="262" width="92" height="26" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="434" y="280" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">A4</text>
<rect x="484" y="262" width="92" height="26" rx="4" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<rect x="580" y="262" width="92" height="26" rx="4" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<rect x="100" y="294" width="92" height="26" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="146" y="312" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">A1</text>
<rect x="196" y="294" width="92" height="26" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="242" y="312" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">A2</text>
<rect x="292" y="294" width="92" height="26" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="338" y="312" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">A3</text>
<rect x="388" y="294" width="92" height="26" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="434" y="312" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">A4</text>
<rect x="484" y="294" width="92" height="26" rx="4" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<rect x="580" y="294" width="92" height="26" rx="4" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<rect x="100" y="326" width="92" height="26" rx="4" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="146" y="344" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">B1</text>
<rect x="196" y="326" width="92" height="26" rx="4" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="242" y="344" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">B2</text>
<rect x="292" y="326" width="92" height="26" rx="4" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="338" y="344" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">B3</text>
<rect x="388" y="326" width="92" height="26" rx="4" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="434" y="344" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">B4</text>
<rect x="484" y="326" width="92" height="26" rx="4" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<rect x="580" y="326" width="92" height="26" rx="4" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="36" y="366" font-size="12" fill="var(--sv-ink)" font-family="inherit">t1–t3：A 占 4 卡，B 等待；t4：A 结束，B 启动；代价是两张卡暂时空闲</text>
</svg>
<figcaption>图 3 · gang scheduling 时序：默认调度让两个作业各持有部分资源并互相等待，gang 把资源获取变成一次原子操作</figcaption>
</figure>
<p>gang 的代价是<b>队头阻塞</b>：为了等一个 64 卡作业凑齐，若没有回填，集群可能让最多 63 张卡空转几分钟。缓解办法是配合队列和回填（backfill）：小作业可以在不推迟大作业预定启动时间的前提下插空。判断一个作业能否启动，不能只看总量，还要看<b>同一时刻</b>能否凑齐：</p>
<div class="formula">可调度 ⇔ ∃ 放置方案 π：|π| ≥ minMember，且 ∀ 节点 n 与资源 r ∈ {GPU, CPU, 内存}，Σ_{p∈π, π(p)=n} demand_r(p) ≤ free_r(n)</div>
<p>注意 <code>minMember</code> 数的是 Pod，不是卡。一个 8 Pod、每 Pod 8 卡的作业需要 64 张卡；写成 <code>minMember: 8</code> 只保证 8 个 Pod 同时启动，容量仍要由队列配额和节点资源兜底。反过来，如果每个 Pod 只要 1 卡，<code>minMember</code> 才等于卡数。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>gang 必须和队列一起用：只开 gang，排在队头的大作业会形成队头阻塞，后面的小作业不能插队，空闲资源也无法回填；只开队列，则会出现“配额够、Pod 起不来”的半启动状态。</div></div>
</section>

<section class="sec">
<h2>拓扑感知：NVLink、NUMA 与 IB rail</h2>
<p>同一个 all-reduce，走不同的链路，时间可以差近一个数量级。A100 的第三代 NVLink 提供每卡 600 GB/s 的双向带宽，H100 SXM 的第四代是 900 GB/s；PCIe Gen4 ×16 的双向带宽约 64 GB/s（每方向 32 GB/s）；一张 400G IB 网卡每方向约 50 GB/s。把 8 卡作业放到同一 NVSwitch 域，与让它跨节点走 IB，通信占比完全不同。</p>
<p>单机内的拓扑有三层约束：GPU 之间是否在同一 NVLink 域；GPU 与网卡是否挂在同一个 PCIe switch、同一个 NUMA 节点；CPU 与内存是否同 NUMA。Kubernetes 的 <b>Topology Manager</b> 提供 none、best-effort、restricted、single-numa-node 四种策略，配合 CPU Manager 与 device plugin 的 topology hints，把 Pod 的 CPU、内存、GPU、网卡对齐到同一 NUMA。<code>single-numa-node</code> 最严格，对齐不了就拒绝调度，可能让 Pod 一直 Pending。</p>
<p>多机侧看的是 rail 与 leaf。rail-optimized 集群里 GPU i 通常连到第 i 张网卡、再连到第 i 个 leaf；同一 leaf 内的节点通信只经过一层交换，跨 leaf 要上 spine，带宽受收敛比影响。调度器能做的是把同一作业的 rank 尽量放进同一 leaf，或者保证 rank 与网卡的 rail 对齐。Slurm 用 <code>--switches=1</code> 约束节点在同一交换机下，Volcano 提供 network-topology-aware 等插件，Kueue 的 TopologyAwareScheduling（TAS）用 Topology CRD 定义 cloud/block/rack/host 层级。</p>
<figure class="fig">
<svg viewBox="0 0 760 380" width="100%" role="img" aria-label="拓扑感知放置：单机 NVLink 域与 NUMA 对齐，多机 leaf 与 rail 对齐，跨 leaf 需要多一跳">
<rect x="20" y="18" width="350" height="344" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="34" y="40" font-size="13" font-weight="600" fill="var(--sv-ink)" font-family="inherit">单机：先看 NVLink 域，再看 NUMA</text>
<rect x="34" y="54" width="322" height="294" rx="6" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<rect x="52" y="68" width="136" height="32" rx="5" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="120" y="89" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Socket 0 / NUMA 0</text>
<rect x="204" y="68" width="136" height="32" rx="5" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="272" y="89" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Socket 1 / NUMA 1</text>
<text x="52" y="116" font-size="12" fill="var(--sv-muted)" font-family="inherit">NIC / IB</text>
<rect x="60" y="122" width="56" height="24" rx="4" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="88" y="138" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">NIC0</text>
<rect x="130" y="122" width="56" height="24" rx="4" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="158" y="138" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">NIC1</text>
<rect x="212" y="122" width="56" height="24" rx="4" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="240" y="138" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">NIC2</text>
<rect x="282" y="122" width="56" height="24" rx="4" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text x="310" y="138" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">NIC3</text>
<text x="52" y="160" font-size="12" fill="var(--sv-muted)" font-family="inherit">GPU（4 + 4）</text>
<rect x="52" y="166" width="30" height="28" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="67" y="185" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">G0</text>
<rect x="86" y="166" width="30" height="28" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="101" y="185" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">G1</text>
<rect x="120" y="166" width="30" height="28" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="135" y="185" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">G2</text>
<rect x="154" y="166" width="30" height="28" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="169" y="185" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">G3</text>
<rect x="204" y="166" width="30" height="28" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="219" y="185" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">G4</text>
<rect x="238" y="166" width="30" height="28" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="253" y="185" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">G5</text>
<rect x="272" y="166" width="30" height="28" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="287" y="185" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">G6</text>
<rect x="306" y="166" width="30" height="28" rx="4" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text x="321" y="185" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">G7</text>
<line x1="67" y1="194" x2="67" y2="224" stroke="var(--sv-line)" stroke-width="2"/>
<line x1="101" y1="194" x2="101" y2="224" stroke="var(--sv-line)" stroke-width="2"/>
<line x1="135" y1="194" x2="135" y2="224" stroke="var(--sv-line)" stroke-width="2"/>
<line x1="169" y1="194" x2="169" y2="224" stroke="var(--sv-line)" stroke-width="2"/>
<line x1="219" y1="194" x2="219" y2="224" stroke="var(--sv-line)" stroke-width="2"/>
<line x1="253" y1="194" x2="253" y2="224" stroke="var(--sv-line)" stroke-width="2"/>
<line x1="287" y1="194" x2="287" y2="224" stroke="var(--sv-line)" stroke-width="2"/>
<line x1="321" y1="194" x2="321" y2="224" stroke="var(--sv-line)" stroke-width="2"/>
<rect x="52" y="224" width="288" height="30" rx="5" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text x="196" y="244" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">NVSwitch：G0–G7 全互联</text>
<text x="46" y="278" font-size="12" fill="var(--sv-muted)" font-family="inherit">策略：none / best-effort / restricted /</text>
<text x="46" y="300" font-size="12" fill="var(--sv-muted)" font-family="inherit">single-numa-node（同 NUMA，否则拒绝）</text>
<text x="46" y="322" font-size="12" fill="var(--sv-muted)" font-family="inherit">GPU–NIC 的 PCIe 亲和决定 RDMA 路径</text>
<text x="46" y="344" font-size="12" fill="var(--sv-ink)" font-family="inherit">A100 600 GB/s、H100 SXM 900 GB/s（每卡双向）</text>
<rect x="390" y="18" width="350" height="344" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="404" y="40" font-size="13" font-weight="600" fill="var(--sv-ink)" font-family="inherit">多机：leaf 与 rail 决定几跳</text>
<rect x="410" y="56" width="310" height="26" rx="5" fill="var(--sv-b)" stroke="var(--sv-line)"/>
<text x="565" y="74" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Spine</text>
<line x1="487" y1="82" x2="487" y2="108" stroke="var(--sv-line)" stroke-width="2"/>
<line x1="636" y1="82" x2="636" y2="108" stroke="var(--sv-line)" stroke-width="2"/>
<rect x="418" y="108" width="138" height="26" rx="5" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="487" y="126" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Leaf 0</text>
<rect x="562" y="108" width="148" height="26" rx="5" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text x="636" y="126" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Leaf 1</text>
<line x1="456" y1="134" x2="456" y2="160" stroke="var(--sv-line)" stroke-width="2"/>
<line x1="524" y1="134" x2="524" y2="160" stroke="var(--sv-line)" stroke-width="2"/>
<line x1="592" y1="134" x2="592" y2="160" stroke="var(--sv-line)" stroke-width="2"/>
<line x1="656" y1="134" x2="656" y2="160" stroke="var(--sv-line)" stroke-width="2"/>
<rect x="426" y="160" width="60" height="50" rx="5" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="456" y="179" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Node 0</text>
<text x="456" y="195" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">8G/8N</text>
<rect x="494" y="160" width="60" height="50" rx="5" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="524" y="179" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Node 1</text>
<text x="524" y="195" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">8G/8N</text>
<rect x="562" y="160" width="60" height="50" rx="5" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="592" y="179" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Node 2</text>
<text x="592" y="195" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">8G/8N</text>
<rect x="626" y="160" width="60" height="50" rx="5" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text x="656" y="179" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Node 3</text>
<text x="656" y="195" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">8G/8N</text>
<rect x="420" y="152" width="140" height="66" rx="6" fill="none" stroke="var(--sv-b)" stroke-width="2" stroke-dasharray="6 4"/>
<text x="422" y="148" font-size="12" fill="var(--sv-ink)" font-family="inherit">同 leaf：1 跳</text>
<path d="M 524 150 L 524 144 L 592 144 L 592 150" fill="none" stroke="var(--sv-c)" stroke-width="2" stroke-dasharray="6 4"/>
<text x="404" y="230" font-size="12" fill="var(--sv-ink)" font-family="inherit">跨 leaf（Node1 ↔ Node2）：经 spine，2 跳</text>
<text x="404" y="252" font-size="12" fill="var(--sv-muted)" font-family="inherit">rail：GPU i ↔ NIC i ↔ Leaf i，同 rail 的 rank 不经过 spine</text>
<text x="404" y="274" font-size="12" fill="var(--sv-muted)" font-family="inherit">Slurm --switches、Volcano、Kueue TAS 都约束这条路径</text>
<text x="404" y="296" font-size="12" fill="var(--sv-muted)" font-family="inherit">跨 leaf 受上行收敛比影响，常见 1:1–3:1</text>
<text x="404" y="318" font-size="12" fill="var(--sv-muted)" font-family="inherit">链路细节见 interconnect；这里只讨论放置</text>
<text x="404" y="340" font-size="12" fill="var(--sv-ink)" font-family="inherit">约束越紧，排队越久：先保 NVLink/NUMA，再保 leaf</text>
</svg>
<figcaption>图 4 · 拓扑感知放置：单机先对齐 NVLink 域与 NUMA，多机再把作业收进同一 leaf 或同一 rail</figcaption>
</figure>
<p>拓扑感知不是越紧越好：把作业全钉在同一 leaf，会让该 leaf 排队而其他 leaf 空闲；正确做法是<b>分层约束</b>：先保证作业内部的 NVLink/NUMA，再尽量收敛到同一 leaf，最后才允许跨 leaf。约束失败时是等待还是降级，要由作业的 SLA 决定。链路与 NCCL 细节见 interconnect 与 collective-comm。</p>
<div class="formula">T_iter ≈ T_compute + S / B_eff；B_eff 从 600 GB/s 降到 64 GB/s 时，同样 S 的通信时间约变为 9.4 倍</div>
</section>

<section class="sec">
<h2>binpack 与 spread：放置策略、队列、配额和优先级</h2>
<p><b>binpack</b> 把 Pod 尽量塞进少数节点（MostAllocated 打分），好处是给大作业留整块空闲节点、减少碎片；坏处是故障域集中、机架热点，还可能把同一作业的副本放到同机。<b>spread</b> 则相反（LeastAllocated 或 topology spread），提高可用性，但更容易把空闲资源打散成“到处都是 1 张卡”的碎片。GPU 集群通常按队列区分：训练队列偏 binpack，在线推理队列偏 spread。</p>
<div class="duo"><div class="duo__col"><h4>binpack</h4><p>把 8 个单卡 Pod 塞进 1 台 8 卡机，而不是摊到 8 台。适合大作业排队长的集群，能更快凑出整机；代价是故障时一起挂。</p></div><div class="duo__col"><h4>spread</h4><p>把副本分散到不同节点/机架，单机故障只影响一个副本。适合推理与高可用服务；代价是碎片化，64 卡作业可能等不到整块资源。</p></div></div>
<p>队列与配额解决的是“谁能用多少”。Kubernetes 原生的 ResourceQuota 只能按 Namespace 限制总量，不能排队、不能借用、不能跨队列抢占。Kueue 用 LocalQueue/ClusterQueue/cohort 建模：ClusterQueue 给每个 flavor 设 <code>nominalQuota</code>，cohort 内可借用，但借来的容量随时可能被所有者抢占；Volcano 的 Queue 用 weight、capability、reclaimable 做比例公平与回收。两者都把作业级准入从 Pod 级调度拆出来。</p>
<pre class="code" data-lang="yaml"><code>apiVersion: kueue.x-k8s.io/v1beta1
kind: ClusterQueue
metadata:
  name: shared-gpu
spec:
  namespaceSelector: {}
  resourceGroups:
  - coveredResources: ["cpu", "memory", "nvidia.com/gpu"]
    flavors:
    - name: a100-80g
      resources:
      - name: "cpu"
        nominalQuota: 512
      - name: "memory"
        nominalQuota: 4096Gi
      - name: "nvidia.com/gpu"
        nominalQuota: 64
---
apiVersion: kueue.x-k8s.io/v1beta1
kind: LocalQueue
metadata:
  name: team-a
  namespace: research
spec:
  clusterQueue: shared-gpu
---
apiVersion: kubeflow.org/v1
kind: PyTorchJob
metadata:
  name: llm-sft
  namespace: research
  labels:
    kueue.x-k8s.io/queue-name: team-a
spec:
  runPolicy:
    schedulingPolicy:
      minAvailable: 8
  pytorchReplicaSpecs:
    Master:
      replicas: 1
      template:
        spec:
          containers:
          - name: pytorch
            image: registry.example.com/train:latest
            resources:
              limits:
                nvidia.com/gpu: 4
    Worker:
      replicas: 7
      template:
        spec:
          containers:
          - name: pytorch
            image: registry.example.com/train:latest
            resources:
              limits:
                nvidia.com/gpu: 4</code></pre>
<p>优先级用 PriorityClass 表达，默认调度器支持抢占：高优先级 Pod 可驱逐低优先级 Pod。但被驱逐的训练作业如果没有 checkpoint，损失的是几小时 GPU 时间；PDB 只保护自愿中断，不阻止抢占。训练队列通常要限制可抢占比例，或把可抢占作业单独放一个队列，并强制定期 checkpoint。</p>
<div class="formula">Little 定律：L_q = λ × W_q（L_q 为排队中的平均作业数，λ 为到达率，W_q 为平均排队时间）；卡利用率 U = λ × S × T / c（S 为平均占用卡数，T 为平均运行时长，c 为集群卡数）</div>
<p>配额不等于容量保障。如果各 ClusterQueue 的 nominalQuota 之和超过物理容量，又没有 cohort 的借用上限，所有队列都会以为自己能拿到卡，实际排队时间会远超预期。容量规划先算“最坏同时运行”的需求，再定 quota 与 borrowing 上限。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>先设 quota 再谈优先级。没有配额，优先级只是“谁嗓门大”；有了 quota，抢占才有回收对象和上限。</div></div>
</section>

<section class="sec">
<h2>训练 operator、弹性伸缩与故障重调度</h2>
<p>真正把作业提交到集群的是 <b>operator</b>。Kubeflow Training Operator 提供 PyTorchJob、MPIJob 等 CRD，负责创建 master/worker、注入环境变量、处理重启；JobSet 把一组 Job 整体管理，支持 <code>startupPolicy</code> 与 <code>successPolicy</code>；KubeRay 管理 RayCluster 与 RayJob。它们都不替代调度器，只负责“把 Pod 造出来”，gang、队列、拓扑仍由调度层决定。</p>
<p>弹性的第一层是节点伸缩：Cluster Autoscaler 或 Karpenter 根据 Pending Pod 扩容 GPU 节点池。GPU 节点从创建到可用通常要几分钟（装驱动、拉镜像），比 CPU 节点慢得多；scale-to-zero 还有冷启动。第二层是作业弹性：torchrun 的 elastic 与 Kubeflow 的弹性训练能在增减 worker 后重新 rendezvous，但要求模型和优化器状态可恢复，数据分片也要能重新划分。很多团队只做了节点弹性，没做作业弹性，结果“扩容了但作业不会用”。</p>
<p>故障重调度要区分“Pod 挂了”和“节点坏了”。Pod 层面用 Job 的 <code>backoffLimit</code>、<code>podFailurePolicy</code> 和 <code>activeDeadlineSeconds</code> 控制重试；节点层面要能识别 GPU 的不可恢复错误，例如 DCGM 报出的 XID 79（GPU 掉总线）或不可纠正的显存 ECC 错误（判读见 observability），此时重启 Pod 没用，必须 cordon、drain，再让云厂商换机。GPU Operator 的 DCGM exporter 可以上报这些信号，再配合 node problem detector 接入监控与自动隔离流程。</p>
<p>被抢占或节点故障后，gang 调度会重新找一个满足 <code>minMember</code> 的资源集合；但原来的拓扑未必还在，重新放置后 NCCL 带宽可能下降。因此故障恢复不只是“重新跑起来”，还要接受性能可能变差，必要时缩小并行度或换队列。恢复时间也要算进 SLA：一个 512 卡作业从故障到重新开始训练，可能花掉几十分钟到数小时。</p>
<div class="callout callout--story"><span class="callout__label">场景</span><div>一个 512 卡作业跑到第 30 小时，一台节点报 XID 79。没有 checkpoint，整作业从第 0 步重来；每 10 分钟存一次，最多回退 10 分钟，但每次保存要占存储带宽并短暂停顿。频率要按“保存开销”与“故障损失”的平衡点定。</div></div>
<div class="formula">U_eff ≈ 1 − c/I − (I/2 + R)/MTBF（c 为单次 checkpoint 时间，I 为间隔，R 为重启时间，MTBF 为作业所跨全部资源合计的平均无故障时间）</div>
<p>checkpoint 太频繁，c/I 上升；太稀疏，(I/2 + R)/MTBF 上升。最优间隔在两者平衡处，要用集群 MTBF、checkpoint 大小与存储带宽来算，别拍“每 1000 步”。分片、异步写与写入带宽的账见 storage-data；十万卡下的最优间隔推导见 ultra-scale。</p>
</section>

<section class="sec">
<h2>Volcano、Kueue 与 Slurm 怎么选</h2>
<p>Kueue 是 K8s SIG Scheduling 下的作业队列层，不替换调度器，负责准入、配额、借用与抢占，与 JobSet/Kubeflow/Ray 集成最好；Volcano 是完整批调度器，gang、queue、binpack、拓扑都是核心能力，适合 MPI/HPC，但组件多、排障面大；Slurm 是 HPC 事实标准，gang、交换机约束、GRES、fair-share 与记账成熟，代价是不在 K8s 里。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>维度</th><th>Kueue</th><th>Volcano</th><th>Slurm</th></tr></thead><tbody><tr><td>定位</td><td>K8s 作业队列层</td><td>K8s 批调度器</td><td>HPC 资源管理器</td></tr><tr><td>gang</td><td>waitForPodsReady + 作业准入</td><td>原生 gang</td><td>原生</td></tr><tr><td>配额</td><td>ClusterQueue/cohort 借用</td><td>Queue weight/capability</td><td>账户/QOS/fair-share</td></tr><tr><td>拓扑</td><td>TAS/Topology CRD</td><td>拓扑插件</td><td>topology/tree、--switches</td></tr><tr><td>生态</td><td>JobSet/Kubeflow/Ray</td><td>MPI/HPC</td><td>MPI、裸金属</td></tr><tr><td>运维成本</td><td>低</td><td>中高</td><td>中</td></tr></tbody></table></div>
<p>判断顺序：负载全在 K8s、以云为主、要多租户配额，选 Kueue；已有 K8s 但大量 MPI/gang、需要细粒度拓扑，选 Volcano；裸金属 HPC、以 MPI 为主、要成熟记账，选 Slurm。</p>
<h3>排障顺序</h3>
<ul>
<li><b>Pod Pending 且事件写 Insufficient nvidia.com/gpu</b>：先看 <code>allocatable</code> 与 <code>requests</code>，再看 nodeSelector/affinity；集群总量够不代表单节点放得下 8 卡。</li>
<li><b>节点 GPU 数为 0</b>：device plugin Pod 是否 Ready、驱动版本是否匹配、CDI 是否启用；<code>kubectl describe node</code> 里没有 <code>nvidia.com/gpu</code> 就是插件没上报。</li>
<li><b>MIG 资源对不上</b>：作业写 <code>nvidia.com/gpu</code>，节点却只广播 <code>mig-1g.10gb</code>；改资源名或让 MIG Manager 重配剖面，改前要 drain 整卡。</li>
<li><b>gang 永远凑不齐</b>：核对 <code>minMember</code> × 每 Pod 卡数是否超过 quota 或最大节点容量；这类作业会一直 Pending。</li>
<li><b>拓扑策略导致不可调度</b>：<code>single-numa-node</code> 下 CPU/GPU/NIC 无法对齐；先用 restricted 放宽验证，再决定是否值得为拓扑牺牲排队时间。</li>
<li><b>time-slicing 下随机 OOM</b>：不是调度问题，是显存没有隔离；看 DCGM 显存曲线，换 MIG 或限制模型大小。</li>
<li><b>反复被抢占</b>：检查 PriorityClass 与队列的可抢占比例；低优先级训练要保证 checkpoint，否则每次抢占都在烧 GPU 时间。</li>
</ul>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>排障从两处开始：<code>kubectl describe pod</code> 的 Events，和节点的 <code>allocatable</code>。先分清“没资源”“不允许放”“放不下”三类，再查插件和拓扑。</div></div>
<details class="quiz"><summary>Q1 · 集群剩 6 张卡，作业 A、B 各需 4 张。默认调度器为什么会死锁？gang 如何避免，代价是什么？</summary><div class="quiz__a">默认调度器逐个 Pod 放：A 先占 3 张、B 再占 3 张，6 张全满，两个作业各缺 1 张且都不释放，形成 hold-and-wait 死锁。gang 设 minMember，凑不齐 4 张就一个不放，A 整体启动、结束后 B 再上。代价是等待期资源空闲，要用队列和回填。</div></details>
<details class="quiz"><summary>Q2 · A100 80GB 切成 7 个 1g.10gb 实例，显存利用率是多少？一个需要 20 GB 显存的任务能直接放进去吗？</summary><div class="quiz__a">7 × 10 = 70 GB，剩 10 GB 无法配对计算切片，利用率约 87.5%。20 GB 任务需要 2g.20gb（2 计算 + 2 显存），不能塞进 1g.10gb；要改 MIG 配置并 drain 整卡。</div></details>
<details class="quiz"><summary>Q3 · time-slicing 配了 replicas: 4，是否等于每个 Pod 有 20 GB 显存？会出什么问题？</summary><div class="quiz__a">不等于。replicas 只是把一张卡广播成 4 个可调度副本，显存仍共享，没有配额与隔离。一个 Pod 申请 70 GB 就会让其余 Pod OOM，GPU 的 request/limit 管不到显存。硬隔离用 MIG。</div></details>
<details class="quiz"><summary>Q4 · 集群总共空闲 8 张卡，一个需要 8 卡的 Pod 却一直 Pending，可能有哪些原因？</summary><div class="quiz__a">常见原因：8 张卡分散在多台节点，单节点放不下；nodeSelector/affinity/taint 排除了候选节点；quota 不够；gang 的 minMember 无法同时满足；节点只广播 MIG 资源；device plugin 未 Ready 导致 allocatable 为 0。按 Events → allocatable → 配额 → 拓扑排查。</div></details>
<ul class="refs">
<li><b>Kubernetes Device Plugins</b> — Kubernetes 项目文档。gRPC ListAndWatch/Allocate 与 extended resource 语义的权威说明。</li>
<li><b>Volcano</b> — Volcano 项目（CNCF）。gang、queue、binpack 与网络拓扑插件的配置和设计文档。</li>
<li><b>Kueue</b> — Kubernetes SIG Scheduling。ClusterQueue、LocalQueue、cohort 借用、抢占与 TAS 的官方文档。</li>
<li><b>Slurm</b> — SchedMD。gang、topology/switch、GRES、accounting 与 fair-share 的完整参考。</li>
<li><b>NVIDIA Multi-Instance GPU</b> — NVIDIA。MIG 剖面、隔离边界与支持型号的官方说明。</li>
</ul>
</section>`
};
