window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["storage-data"] = {
  slug: "storage-data",
  title: "数据管道与存储",
  subtitle: "别让 GPU 等数据",
  level: 5,
  cluster: "平台",
  tags: ["数据加载", "Checkpoint", "对象存储"],
  summary: "GPU 空转不是算力问题，而是数据没供上：数据管道的格式与预取决定供得上，checkpoint 的分片、异步与一致性决定恢复得了，带宽、并行文件系统与数据治理决定存得下。",
  keyPoints: [
    "数据加载的瓶颈通常是小文件元数据、CPU 解码与网络尾延迟，而不是字节带宽；文本训练每节点持续读往往只有 0.3 MB/s 量级",
    "分片格式（tar/WebDataset、Parquet）用顺序读换吞吐；预取深度 D ≥ ⌈t_io/t_compute⌉+1，worker 并行度必须覆盖 t_io",
    "checkpoint 的停顿在快照，风险在一致性：分片写、后台写、manifest 原子提交三者缺一不可",
    "7B 混合精度训练状态约 112 GB、70B 约 1.12 TB；按每参数 16 字节估算容量与写带宽",
    "先把数据等待占 step 的比例压到 5% 以下，再谈更深的存储优化"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>一句话直觉：GPU 最贵的状态是“等”</h2>
<p>训练集群里最容易被忽略的成本，不是算得慢，而是<mark>算完了没活干</mark>。一张 H100 在等待下一个 batch 时，空载功耗会降到几十瓦，但占住的卡时与租金一分不少。按每 GPU 每小时 2 美元的示例单价、1000 张卡、30% 时间空转估算，一个月（720 小时）浪费约 43 万美元量级；这还没算被迫缩小 batch 与拉长实验周期的代价。</p>
<p>数据管道（data pipeline）的职责只有一个：<b>在 GPU 伸手要数据之前，把下一个 batch 准备好并放进显存</b>。它横跨对象存储、并行文件系统、本地 NVMe、CPU 解码、PCIe 拷贝五层，任何一层掉链子，GPU 时间线上都会出现周期性空洞。存储系统还承担另一类流量：checkpoint 的突发写入。两者方向相反、峰值不同，却常被塞进同一套容量与带宽预算里讨论。</p>
<p>本篇属于平台层，只讲“供得上、存得下、恢复得了”；调度与故障编排在平台的其他篇展开。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>把 GPU 想成餐厅主厨，数据管道是备菜间。主厨炒一道菜要 2 分钟，备菜却要 3 分钟；如果只有一个人现切现配，主厨每炒完一道就得站着等。解决办法不是让主厨切得更快，而是多几个人提前把菜配好、按顺序摆进传菜口。</div></div>
</section>

<section class="sec">
<h2>瓶颈解剖：小文件、解码与网络</h2>
<p>先建立一个反直觉的结论：<b>对纯文本大模型，字节带宽通常不是瓶颈</b>。7B 模型在 8 张 H100 SXM 上按 40% MFU 运行，每秒约处理 7.5 万个 token；即使每个 token 用 4 字节 uint32 存储，也只有约 0.3 MB/s。真正拖慢的是“拿到这些字节”的过程：海量小文件的元数据操作、压缩包解压、图片解码、分词，以及跨网络的一次次往返。</p>
<p>三类瓶颈要分开看。第一类是<mark>小文件与元数据</mark>：对象存储的一次 GET 往返约 20–100 ms（视实现与地域而定），并行文件系统的一次 open/stat 也要几十微秒到毫秒；当数据集是几百万张 JPEG 或几千万条 JSON 时，客户端会被文件数而不是字节数压垮。第二类是<mark>解码与分词</mark>：单核 JPEG 解码约 100–200 M 像素/s，折成压缩数据只有几十 MB/s（视分辨率与解码库而定），Python 分词往往只有每秒几 MB 量级；若每张 GPU 只配 2 个 CPU 核，CPU 会先于 GPU 饱和。第三类是<mark>网络与拷贝</mark>：跨机读取受网卡与交换机收敛比限制，主机到显存（H2D）还要过一次 PCIe，PCIe 5.0 x16 单向理论约 64 GB/s、实际有效约 50 GB/s（4.0 则约 32 GB/s 理论、25 GB/s 有效），且要与梯度通信、checkpoint 抢通道。</p>
<p>还有一个隐蔽来源：<b>同步点</b>。每个 epoch 开始时全量 list 目录、每个 step 都做一次 barrier、每次 checkpoint 都等待所有 rank 写完，这些都会把局部的慢放大成全局的停顿。排障时先看时间线里空洞的形状——周期性的、随机分布的，还是集中在某个 rank——比直接调 <code>num_workers</code> 有效得多。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>先算“每 GPU 每秒需要多少样本”，再算“每个样本要多少 CPU 微秒”。如果后者乘以前者已经超过可用核数，问题在 CPU 供给，换更快的存储没用；反之才去查网络与元数据。</div></div>
</section>

<section class="sec">
<h2>格式选择：用顺序读换吞吐</h2>
<p>格式的选择本质是在“随机访问粒度”和“顺序读效率”之间取舍。小文件（一张图一个文件、一条样本一行 JSON）最灵活，但把元数据开销摊到了每个样本上；分片（shard）把成百上千个样本打包成一个大文件，用顺序读换吞吐，代价是样本级随机访问变差，需要靠“分片内缓冲打乱 + 分片间打乱”来近似全局 shuffle。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>格式</th><th>典型粒度</th><th>顺序读</th><th>随机样本访问</th><th>适用场景</th><th>主要坑</th></tr></thead>
<tbody>
<tr><td>原始小文件（JPEG/JSONL）</td><td>KB–MB</td><td>差</td><td>好</td><td>探索、小数据集、需按样本增删</td><td>元数据风暴、inode 压力</td></tr>
<tr><td>tar / WebDataset</td><td>100 MB–1 GB 每分片</td><td>很好</td><td>差，需流式扫描</td><td>大规模图像与多模态预训练</td><td>分片过大导致恢复重读</td></tr>
<tr><td>Parquet</td><td>128 MB 左右 row group</td><td>好，可列裁剪</td><td>中</td><td>表格特征、训练日志、元数据筛选</td><td>小 row group 过多</td></tr>
<tr><td>Arrow / Feather</td><td>内存列式块</td><td>很好</td><td>好，零拷贝</td><td>进程间共享、特征缓存</td><td>需整块载入内存</td></tr>
<tr><td>.npy / memmap</td><td>数组块</td><td>很好</td><td>好，按偏移</td><td>预 tokenize 语料、embedding</td><td>版本与切分需自管</td></tr>
</tbody></table></div>
<p>WebDataset 的思路值得单独说：它把每个分片做成 tar，样本按 <code>key.jpg</code>、<code>key.json</code>、<code>key.npy</code> 命名，读取时按 key 聚合。tar 的顺序读在 Lustre 与本地盘上能接近线速，在 S3 上配合多流并发读取也能跑满网卡，且天然支持流式解压与断点续读。代价是不能“只读第 100 万条”，必须顺序扫过分片；因此分片大小要配合缓存与并行度，分片数至少是总 worker 数的若干倍。</p>
<p>Parquet 适合“列多、只取少数列、需要谓词下推”的场景，比如从海量元数据里筛出某个语言、某个质量分数区间的样本；row group 是并行与裁剪的基本单位，太小会让元数据占比升高。Arrow 是内存格式，适合进程间零拷贝传递，不适合长期落盘。预 tokenize 的语料常存成 <code>uint16</code>/<code>uint32</code> 二进制分片，按偏移切片，能省掉分词开销。</p>
</section>

<section class="sec">
<h2>预取、流水线并行与本地 NVMe 缓存</h2>
<p>流水线的目标是把“读、解、传、算”四段重叠起来。PyTorch 的 <code>DataLoader</code> 用多进程 worker 并行取数与解码，主进程负责 collate 与 H2D 拷贝；<code>pin_memory=True</code> 让数据先进入锁页内存，配合 <code>non_blocking=True</code> 与独立 CUDA stream，才能让拷贝与计算重叠。判断是否真的重叠，不看配置，看时间线：GPU 上是否还有规律性空洞。</p>
<p>预取深度的下限可以用一个不等式估：设单批数据准备耗时为 t_io（取数、解码、collate 之和），单批计算耗时为 t_compute，则队列里至少要能容纳 D 批，且 D ≥ ⌈t_io / t_compute⌉ + 1，才能在计算第 i 批时把第 i+1 批准备好。若 t_io 本身大于 t_compute，加多少预取都没用，必须提高并行度或降低单样本成本。</p>
<div class="formula">t_step ≈ max(t_io / W, t_compute)，W 为有效并行 worker 数
需要 W ≥ t_io / t_compute 才能让数据侧不成为瓶颈
预取深度 D ≥ ⌈t_io / t_compute⌉ + 1
有效读取延迟 ≈ h × t_local + (1 − h) × t_remote，h 为本地缓存命中率</div>
<p>本地 NVMe 缓存是第二道缓冲。把热点分片从远端拉到本地盘，下一次读取就从“网络 + 对象存储”变成本地顺序读。它的价值主要在降低尾延迟与元数据开销，而不是无限提升吞吐：单块 PCIe 4.0 NVMe 的顺序读约 6–7 GB/s，四块做 RAID 0 才能接近 200 Gb/s 网卡的上限；如果远端本身能稳定供上 20 GB/s，本地缓存只在命中率高时才有意义。缓存策略通常按分片哈希落盘、LRU 淘汰，并预留空间给 checkpoint 暂存。</p>
<p>命中率对有效延迟的影响可以量化：设本地命中延迟 0.1 ms、远端 20 ms、命中率 h，则有效延迟约为 h×0.1 + (1−h)×20 ms。h=90% 时约 2.1 ms，h=99% 时约 0.3 ms；从 90% 提到 99% 的收益，比把本地盘换快一倍大得多。所以缓存的第一要务是“装得下热点”，第二才是“盘够快”。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="数据流水线架构与串行、重叠两种时间线对比">
<defs>
<marker id="storage-data-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"></path></marker>
</defs>
<rect x="0" y="0" width="760" height="380" fill="var(--sv-bg)"></rect>
<text x="380" y="24" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-muted)">一条合格的输入流水线：每一段都能独立并行</text>
<rect x="16" y="42" width="132" height="58" rx="8" fill="var(--sv-a)" fill-opacity="0.16" stroke="var(--sv-a)"></rect>
<text x="82" y="66" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">远端存储</text>
<text x="82" y="86" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">S3 / Lustre 分片</text>
<rect x="164" y="42" width="132" height="58" rx="8" fill="var(--sv-a2)" fill-opacity="0.18" stroke="var(--sv-a2)"></rect>
<text x="230" y="66" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">顺序读取</text>
<text x="230" y="86" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">本地 NVMe 6–7 GB/s</text>
<rect x="312" y="42" width="132" height="58" rx="8" fill="var(--sv-b)" fill-opacity="0.16" stroke="var(--sv-b)"></rect>
<text x="378" y="66" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">解码 + 分词</text>
<text x="378" y="86" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">每 GPU 4–16 个 worker</text>
<rect x="460" y="42" width="132" height="58" rx="8" fill="var(--sv-b2)" fill-opacity="0.18" stroke="var(--sv-b2)"></rect>
<text x="526" y="66" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">预取 + collate</text>
<text x="526" y="86" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">队列 depth ≥ 3</text>
<rect x="608" y="42" width="132" height="58" rx="8" fill="var(--sv-c)" fill-opacity="0.18" stroke="var(--sv-c)"></rect>
<text x="674" y="66" text-anchor="middle" font-size="13" font-family="inherit" fill="var(--sv-ink)">H2D + 计算</text>
<text x="674" y="86" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">PCIe 5.0 x16 64 GB/s</text>
<line x1="148" y1="71" x2="162" y2="71" stroke="var(--sv-line)" marker-end="url(#storage-data-arrow)"></line>
<line x1="296" y1="71" x2="310" y2="71" stroke="var(--sv-line)" marker-end="url(#storage-data-arrow)"></line>
<line x1="444" y1="71" x2="458" y2="71" stroke="var(--sv-line)" marker-end="url(#storage-data-arrow)"></line>
<line x1="592" y1="71" x2="606" y2="71" stroke="var(--sv-line)" marker-end="url(#storage-data-arrow)"></line>
<text x="380" y="122" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">远端往返 20–100 ms；分片 100 MB–1 GB，把百万次 GET 压成百次顺序读</text>
<text x="16" y="150" font-size="12" font-family="inherit" fill="var(--sv-muted)">串行：CPU 与 GPU 轮流工作，GPU 周期性空转</text>
<text x="48" y="176" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-ink)">CPU</text>
<text x="48" y="208" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-ink)">GPU</text>
<rect x="60" y="162" width="60" height="16" rx="3" fill="var(--sv-b)" fill-opacity="0.45"></rect>
<rect x="180" y="162" width="60" height="16" rx="3" fill="var(--sv-b)" fill-opacity="0.45"></rect>
<rect x="300" y="162" width="60" height="16" rx="3" fill="var(--sv-b)" fill-opacity="0.45"></rect>
<rect x="120" y="194" width="60" height="16" rx="3" fill="var(--sv-c)" fill-opacity="0.55"></rect>
<rect x="240" y="194" width="60" height="16" rx="3" fill="var(--sv-c)" fill-opacity="0.55"></rect>
<rect x="360" y="194" width="60" height="16" rx="3" fill="var(--sv-c)" fill-opacity="0.55"></rect>
<rect x="60" y="194" width="60" height="16" rx="3" fill="none" stroke="var(--sv-muted)" stroke-dasharray="3 3"></rect>
<rect x="180" y="194" width="60" height="16" rx="3" fill="none" stroke="var(--sv-muted)" stroke-dasharray="3 3"></rect>
<rect x="300" y="194" width="60" height="16" rx="3" fill="none" stroke="var(--sv-muted)" stroke-dasharray="3 3"></rect>
<text x="90" y="206" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--sv-muted)">空转</text>
<text x="16" y="244" font-size="12" font-family="inherit" fill="var(--sv-muted)">预取重叠：CPU 持续供给，GPU 连续计算</text>
<text x="48" y="270" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-ink)">CPU</text>
<text x="48" y="302" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-ink)">GPU</text>
<rect x="60" y="256" width="60" height="16" rx="3" fill="var(--sv-b)" fill-opacity="0.45"></rect>
<rect x="120" y="256" width="60" height="16" rx="3" fill="var(--sv-b)" fill-opacity="0.45"></rect>
<rect x="180" y="256" width="60" height="16" rx="3" fill="var(--sv-b)" fill-opacity="0.45"></rect>
<rect x="240" y="256" width="60" height="16" rx="3" fill="var(--sv-b)" fill-opacity="0.45"></rect>
<rect x="300" y="256" width="60" height="16" rx="3" fill="var(--sv-b)" fill-opacity="0.45"></rect>
<rect x="120" y="288" width="60" height="16" rx="3" fill="var(--sv-c)" fill-opacity="0.55"></rect>
<rect x="180" y="288" width="60" height="16" rx="3" fill="var(--sv-c)" fill-opacity="0.55"></rect>
<rect x="240" y="288" width="60" height="16" rx="3" fill="var(--sv-c)" fill-opacity="0.55"></rect>
<rect x="300" y="288" width="60" height="16" rx="3" fill="var(--sv-c)" fill-opacity="0.55"></rect>
<rect x="360" y="288" width="60" height="16" rx="3" fill="var(--sv-c)" fill-opacity="0.55"></rect>
<line x1="150" y1="280" x2="150" y2="310" stroke="var(--sv-muted)" stroke-dasharray="3 3"></line>
<text x="158" y="320" font-size="11" font-family="inherit" fill="var(--sv-muted)">第 1 批还在算，第 2 批已在备</text>
<line x1="60" y1="342" x2="700" y2="342" stroke="var(--sv-line)" marker-end="url(#storage-data-arrow)"></line>
<text x="710" y="346" font-size="11" font-family="inherit" fill="var(--sv-muted)">时间</text>
</svg><figcaption>图 1 · 数据流水线的五段与预取效果：串行时 GPU 在每次读数据时停摆；预取深度足够后，CPU 与 GPU 各自连续工作。</figcaption></figure>
</section>

<section class="sec">
<h2>Checkpoint：分片、异步与一致性</h2>
<p>Checkpoint 要保存的不只是模型权重：优化器状态（Adam 的 m、v）、学习率调度器、梯度缩放器、随机数状态、数据加载器的位置与采样种子，缺一项都会让恢复后的训练轨迹偏移。混合精度 Adam 的常用口径是每参数约 16 字节（BF16 权重 2 + 梯度 2 + FP32 主权重 4 + m 4 + v 4），7B 模型一次完整状态约 112 GB，70B 约 1.12 TB。</p>
<p>“分片”解决单机写不下、写不快的问题：每个 rank 只写自己持有的那一片，另写一份元数据描述分片布局、步数、并行度与校验和。恢复时并行度可能不同，所以元数据必须记录张量切分方式，而不是简单按文件名对应。分片还有个好处：某个 rank 写失败时只需重传该分片。</p>
<p>“异步”解决停顿：先在步边界把状态快照到主机锁页内存（这一步仍需短暂暂停参数更新），再由后台线程或进程写往远端；训练在写的同时继续跑下一步。关键在<b>一致性</b>：快照必须是同一 step 的、不可再被修改的副本；所有 rank 的分片写完后，最后原子地更新一个 manifest（例如把 <code>latest</code> 指针 rename 到新版本），读取方只认 manifest，永远看不到“写了一半”的 checkpoint。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="同步与异步 checkpoint 的时间线对比">
<defs>
<marker id="storage-data-time" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"></path></marker>
</defs>
<rect x="0" y="0" width="760" height="380" fill="var(--sv-bg)"></rect>
<text x="380" y="24" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-muted)">同步写让训练停 20 s，异步写只停快照的 1.5 s</text>
<text x="16" y="52" font-size="13" font-family="inherit" fill="var(--sv-ink)">（a）同步 checkpoint：训练为写入让路</text>
<text x="108" y="87" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-ink)">训练</text>
<text x="108" y="125" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-ink)">写存储</text>
<rect x="120" y="70" width="100" height="26" rx="3" fill="var(--sv-a)" fill-opacity="0.45"></rect>
<text x="170" y="87" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-ink)">step 100</text>
<rect x="220" y="70" width="100" height="26" rx="3" fill="var(--sv-a)" fill-opacity="0.45"></rect>
<text x="270" y="87" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-ink)">step 101</text>
<rect x="320" y="70" width="180" height="26" rx="3" fill="none" stroke="var(--sv-muted)" stroke-dasharray="4 3"></rect>
<text x="410" y="87" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">训练暂停约 20 s</text>
<rect x="500" y="70" width="100" height="26" rx="3" fill="var(--sv-a)" fill-opacity="0.45"></rect>
<text x="550" y="87" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-ink)">step 102</text>
<rect x="320" y="108" width="180" height="26" rx="3" fill="var(--sv-c)" fill-opacity="0.5"></rect>
<text x="410" y="125" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-ink)">写 112 GB</text>
<line x1="320" y1="96" x2="320" y2="108" stroke="var(--sv-muted)" stroke-dasharray="3 3"></line>
<line x1="500" y1="96" x2="500" y2="108" stroke="var(--sv-muted)" stroke-dasharray="3 3"></line>
<text x="16" y="178" font-size="13" font-family="inherit" fill="var(--sv-ink)">（b）异步 checkpoint：快照后立即返回，后台写</text>
<text x="108" y="211" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-ink)">训练</text>
<text x="108" y="249" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-ink)">快照</text>
<text x="108" y="287" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-ink)">写存储</text>
<rect x="120" y="194" width="100" height="26" rx="3" fill="var(--sv-a)" fill-opacity="0.45"></rect>
<text x="170" y="211" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-ink)">step 100</text>
<rect x="220" y="194" width="100" height="26" rx="3" fill="var(--sv-a)" fill-opacity="0.45"></rect>
<text x="270" y="211" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-ink)">step 101</text>
<rect x="320" y="194" width="100" height="26" rx="3" fill="var(--sv-a)" fill-opacity="0.45"></rect>
<text x="370" y="211" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-ink)">step 102</text>
<rect x="420" y="194" width="100" height="26" rx="3" fill="var(--sv-a)" fill-opacity="0.45"></rect>
<text x="470" y="211" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-ink)">step 103</text>
<rect x="520" y="194" width="100" height="26" rx="3" fill="var(--sv-a)" fill-opacity="0.45"></rect>
<text x="570" y="211" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-ink)">step 104</text>
<rect x="300" y="236" width="40" height="18" rx="3" fill="var(--sv-b)" fill-opacity="0.6"></rect>
<text x="320" y="249" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--sv-ink)">1.5 s</text>
<rect x="340" y="270" width="200" height="26" rx="3" fill="var(--sv-c)" fill-opacity="0.5"></rect>
<text x="440" y="287" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-ink)">后台写，与后续 step 重叠</text>
<line x1="300" y1="270" x2="300" y2="236" stroke="var(--sv-muted)" stroke-dasharray="3 3"></line>
<line x1="340" y1="270" x2="340" y2="254" stroke="var(--sv-muted)" stroke-dasharray="3 3"></line>
<line x1="540" y1="270" x2="540" y2="220" stroke="var(--sv-muted)" stroke-dasharray="3 3"></line>
<text x="16" y="335" font-size="11" font-family="inherit" fill="var(--sv-muted)">所有分片写完并校验通过后，才原子更新 manifest；读取方只认它</text>
<line x1="60" y1="356" x2="700" y2="356" stroke="var(--sv-line)" marker-end="url(#storage-data-time)"></line>
<text x="710" y="360" font-size="11" font-family="inherit" fill="var(--sv-muted)">时间</text>
</svg><figcaption>图 2 · checkpoint 的异步写时间线：同步版本在写入的 20 s 内 GPU 无活可干；异步版本只付出约 1.5 s 的快照停顿，写入与后续 step 重叠。</figcaption></figure>
<p>异步不是免费的：它多占一份主机内存（7B 全套状态约 112 GB；按 64 个 rank 做 ZeRO 切分后每卡约 1.75 GB，只有 8 卡时则是每卡约 14 GB），写盘会与训练的数据读取、梯度通信争抢 PCIe 与网卡；如果写入时间超过 checkpoint 间隔，队列会堆积。实践上要监控“快照暂停时长”和“写入完成时长”两个数，而不是只看 checkpoint 是否成功。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>异步写最危险的错误是“边写边更新”：快照若直接引用训练中的参数张量，下一步优化器一改，写出去的就是跨 step 的混合状态。恢复后 loss 会突然跳变，却很难定位。必须显式复制到独立缓冲区，并在所有 rank 提交后原子切换 manifest。</div></div>
</section>

<section class="sec">
<h2>带宽与容量估算：先算账再买盘</h2>
<p>先算一条最基本的账：若全局 batch 为 B 个样本、每样本 S 字节、单步计算时间 t_compute，则数据侧需要的持续带宽 R ≥ B×S / t_compute。注意这里是“持续”而非峰值：突发可以靠缓存吸收，持续缺口只能靠加带宽或减需求。对文本 token，B×S 往往只有几百 KB 到几 MB；真正的突发来自 checkpoint 与洗牌读取。</p>
<div class="formula">R_data ≥ B × S / t_compute
C_ckpt ≈ 16 字节/参数 × P
B_ckpt ≈ C_ckpt / T_target
容量 ≈ tokens × bytes/token × (1 + 副本与临时空间)</div>
<p>算例：8 张 H100 SXM 训练 7B，BF16 稠密算力每卡约 989 TFLOPS（495 TFLOPS 是 TF32 的口径，别混用），8 卡合计约 7912 TFLOPS，按 MFU 40% 计有效约 3165 TFLOPS；每 token 前向加反向约 6N = 4.2×10¹⁰ FLOP，于是约 7.5 万 token/s。若每 token 存 4 字节，持续读约 0.3 MB/s；若换成每张图 576 token、JPEG 约 100 KB，则约 130 张/s、13 MB/s。相比之下，112 GB 的 checkpoint 若要在 10 秒内写完，需要约 11.2 GB/s 的聚合写带宽，比图文读取高近三个数量级。这就是“读数据不贵、写 checkpoint 才贵”的量化来源。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="训练读取、checkpoint 写入与存储层级带宽需求的对数坐标柱状图">
<rect x="0" y="0" width="760" height="380" fill="var(--sv-bg)"></rect>
<text x="380" y="22" text-anchor="middle" font-size="14" font-family="inherit" fill="var(--sv-muted)">8×H100 训练 7B：训练读取在 MB/s 量级，checkpoint 突发在 GB/s 量级</text>
<text x="170" y="44" font-size="11" font-family="inherit" fill="var(--sv-a)">■ 训练读取</text>
<text x="280" y="44" font-size="11" font-family="inherit" fill="var(--sv-b)">■ checkpoint</text>
<text x="400" y="44" font-size="11" font-family="inherit" fill="var(--sv-c)">■ 可用存储层级</text>
<text x="160" y="85" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-ink)">文本 token</text>
<rect x="170" y="72" width="44" height="18" rx="2" fill="var(--sv-a)" fill-opacity="0.6"></rect>
<text x="219" y="86" font-size="11" font-family="inherit" fill="var(--sv-ink)">0.3 MB/s</text>
<text x="160" y="115" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-ink)">原始文本</text>
<rect x="170" y="102" width="55" height="18" rx="2" fill="var(--sv-a)" fill-opacity="0.6"></rect>
<text x="230" y="116" font-size="11" font-family="inherit" fill="var(--sv-ink)">0.4 MB/s</text>
<text x="160" y="145" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-ink)">图文 JPEG</text>
<rect x="170" y="132" width="194" height="18" rx="2" fill="var(--sv-a)" fill-opacity="0.6"></rect>
<text x="369" y="146" font-size="11" font-family="inherit" fill="var(--sv-ink)">13 MB/s</text>
<text x="160" y="175" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-ink)">CKPT 60 s</text>
<rect x="170" y="162" width="392" height="18" rx="2" fill="var(--sv-b)" fill-opacity="0.55"></rect>
<text x="567" y="176" font-size="11" font-family="inherit" fill="var(--sv-ink)">1.9 GB/s</text>
<text x="160" y="205" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-ink)">CKPT 10 s</text>
<rect x="170" y="192" width="463" height="18" rx="2" fill="var(--sv-b)" fill-opacity="0.55"></rect>
<text x="638" y="206" font-size="11" font-family="inherit" fill="var(--sv-ink)">11.2 GB/s</text>
<text x="160" y="235" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-ink)">本地 NVMe</text>
<rect x="170" y="222" width="444" height="18" rx="2" fill="var(--sv-c)" fill-opacity="0.5"></rect>
<text x="619" y="236" font-size="11" font-family="inherit" fill="var(--sv-ink)">7 GB/s</text>
<text x="160" y="265" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-ink)">节点网卡</text>
<rect x="170" y="252" width="495" height="18" rx="2" fill="var(--sv-c)" fill-opacity="0.5"></rect>
<text x="670" y="266" font-size="11" font-family="inherit" fill="var(--sv-ink)">25 GB/s</text>
<text x="160" y="295" text-anchor="end" font-size="12" font-family="inherit" fill="var(--sv-ink)">并行 FS 聚合</text>
<rect x="170" y="282" width="522" height="18" rx="2" fill="var(--sv-c)" fill-opacity="0.5"></rect>
<text x="697" y="296" font-size="11" font-family="inherit" fill="var(--sv-ink)">50 GB/s</text>
<line x1="170" y1="316" x2="720" y2="316" stroke="var(--sv-line)"></line>
<text x="170" y="332" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--sv-muted)">0.1</text>
<text x="262" y="332" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--sv-muted)">1</text>
<text x="353" y="332" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--sv-muted)">10</text>
<text x="445" y="332" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--sv-muted)">100</text>
<text x="537" y="332" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--sv-muted)">1k</text>
<text x="628" y="332" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--sv-muted)">10k</text>
<text x="720" y="332" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--sv-muted)">100k</text>
<text x="380" y="354" text-anchor="middle" font-size="11" font-family="inherit" fill="var(--sv-muted)">对数坐标，单位 MB/s（1 GB/s = 1000 MB/s）；CKPT 按 7B 混合精度 112 GB 估算</text>
</svg><figcaption>图 3 · 带宽需求算例（对数坐标）：纯文本训练读取只有 0.3 MB/s 量级，图文约 13 MB/s；checkpoint 若要 10 秒写完则需要 11.2 GB/s，约为单节点 200 Gb/s 网卡（25 GB/s）的一半，必须靠分片并行或拉长写入窗口。</figcaption></figure>
<p>并行文件系统（parallel file system）用多台存储服务器聚合带宽：Lustre 由 MDS 管元数据、OSS/OST 管数据，文件按 stripe 分散到多个 OST，适合大文件顺序读；GPFS（Spectrum Scale）用分布式锁与块分布，元数据与数据都可横向扩展；DeepSeek 于 2025 年开源的 3FS 面向 AI 训练与推理，官方说明称在 180 节点集群上聚合读吞吐达 6.6 TiB/s（该数字对应其测试集群配置，不是单机指标），并用链式复制保证分片一致性、用 RDMA 降低访问延迟。选型时不要只看峰值带宽，要看元数据 ops、尾延迟、扩容粒度与故障域。</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>系统</th><th>元数据</th><th>数据分布</th><th>强项</th><th>注意</th></tr></thead>
<tbody>
<tr><td>Lustre</td><td>MDS 与 OST 分离</td><td>按 stripe 分散到 OST</td><td>大文件吞吐、HPC 生态成熟</td><td>小文件与元数据风暴</td></tr>
<tr><td>GPFS / Spectrum Scale</td><td>分布式</td><td>块分布、副本或纠删码</td><td>元数据扩展、POSIX 完整</td><td>调参与许可成本</td></tr>
<tr><td>3FS</td><td>分布式元数据</td><td>链式复制、RDMA</td><td>AI 场景高吞吐</td><td>生态较新，需评估</td></tr>
<tr><td>本地 NVMe</td><td>本地</td><td>RAID 或直连</td><td>低延迟、可做缓存</td><td>容量与持久性有限</td></tr>
<tr><td>对象存储 S3</td><td>托管</td><td>分片对象</td><td>弹性、便宜、持久</td><td>高延迟、LIST 成本高</td></tr>
</tbody></table></div>
<p>容量规划要把“原始语料”和“checkpoint”分开算。15 万亿 token 的 uint32 语料约 60 TB（uint16 约 30 TB）；70B 模型每份完整训练状态约 1.12 TB，保留 5 份就是 5.6 TB，10 个实验并行就是 56 TB——checkpoint 往往比原始语料更占地方。再留出 20%–30% 的临时空间给数据洗牌、格式转换与失败重写，才不会在关键节点因为“盘满了”被迫停训。</p>
</section>

<section class="sec">
<h2>数据版本、去重与清洗</h2>
<p>数据是训练中唯一“改了不会报错”的输入。模型结构写错会崩，数据错了只会让指标悄悄变差。因此数据集要有版本：每次清洗、去重、重分词都产生新的不可变版本，manifest 记录父版本、规则版本、样本数与内容哈希；训练配置里锁死数据版本与 tokenizer 版本，而不是指向一个会被覆盖的目录。</p>
<p>去重分两级：精确去重按文档或段落做 SHA-256，成本低、能去掉镜像与重复抓取；近似去重（MinHash/SimHash 配合 LSH）处理模板页、转载与轻微改写，阈值要在验证集上看误杀。清洗通常包括语言识别、质量分类器、困惑度过滤、PII 与毒性过滤、长度与符号比例规则；每一步都要记录“删了多少、为什么删”，否则无法复现，也无法判断某次指标下降是模型问题还是数据问题。</p>
<p>版本化还影响删除与合规：来源下架时，要能从样本追溯到分片与数据集版本，重新生成受影响版本，而不是直接删生产文件；多模态数据还要记录解码器版本与图像哈希，避免同一张图因解码结果不同而隐性重复。</p>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>把“数据版本 + 代码 commit + 配置 + tokenizer 版本”写进一次训练的 run manifest，并让 checkpoint 保存这个 manifest 的哈希。半年后复现实验时，你会庆幸当初多写了这五行字段。</div></div>
</section>

<section class="sec">
<h2>常见误区、排障与自测</h2>
<p>排障的顺序应该是：先确认 GPU 空洞是否与数据相关，再定位是 CPU、网络还是存储。用 <code>torch.profiler</code> 或 nsys 看 step 内的时间线；用 <code>iostat</code> 看盘、用 <code>nvidia-smi dmon</code> 看 GPU 利用率与功耗、用 <code>nvbandwidth</code> 或 profiler 看 PCIe 与 HBM 带宽；在对象存储侧看 GET 的 p99 延迟与 LIST 调用次数。只有把空洞对应到某一层，调参才有方向。</p>
<pre class="code" data-lang="bash"><code># 1) 先确认瓶颈在数据侧还是计算侧
python -m torch.utils.bottleneck train.py --config config.yaml

# 2) 本地 NVMe 顺序读带宽（4 个并发任务，1 MB 块）
fio --name=seqread --filename=$DATA/train-0001.tar --rw=read --bs=1M --direct=1 --numjobs=4 --runtime=30 --group_reporting

# 3) 到存储节点的网络带宽
iperf3 -c $STORAGE_HOST -P 8 -t 30

# 4) checkpoint 单分片写入耗时
time dd if=/dev/zero of=$CKPT_DIR/rank-0.pt bs=1M count=2048 oflag=direct

# 5) 观察 GPU 利用率与功耗
nvidia-smi dmon -s pu -d 1</code></pre>
<p>几个高频误区：其一，盲目加大 <code>num_workers</code>，结果 CPU 核被抢光、内存翻倍、主进程 collate 反而更慢；worker 数应与“每 GPU 可用核数 × 解码成本”匹配，通常每 GPU 4–16 个，视任务而定。其二，开了 <code>pin_memory</code> 却没开 <code>non_blocking</code>，或 H2D 仍在默认 stream 上，拷贝无法与计算重叠。其三，checkpoint 每个 step 都做，或同步写且所有 rank 互相等待，把 1% 的开销放大成 20%。其四，把对象存储当本地盘用，频繁 LIST、按样本 GET，延迟直接吃掉预取深度。</p>
<p>最后给一个判断准则：<b>当数据侧的持续供给能力大于计算侧的需求，且预取深度足以吸收尾延迟时，数据管道就算合格</b>；剩下的优化应该去做计算或通信，而不是继续堆 worker。把这条准则写成监控指标——数据等待时间占 step 的比例长期低于 5%——比一次性调参可靠。</p>
<details class="quiz"><summary>Q1 · 7B 模型、8×H100、40% MFU、每 token 4 字节，为什么说文本训练几乎不受存储带宽限制？</summary><div class="quiz__a">8×H100 SXM 的 BF16 稠密算力约 8×989 ≈ 7912 TFLOPS，按 40% MFU 有效约 3165 TFLOPS；每 token 前向加反向约 6N = 4.2×10¹⁰ FLOP，得到约 7.5 万 token/s。乘 4 字节只有约 0.3 MB/s，远低于任何一块 NVMe 或网卡。限制来自小文件元数据、解码与分词，而不是字节吞吐。</div></details>
<details class="quiz"><summary>Q2 · 单批数据准备 t_io = 80 ms，计算 t_compute = 120 ms，预取深度至少多少？若 t_io 涨到 300 ms 呢？</summary><div class="quiz__a">D ≥ ⌈80/120⌉ + 1 = 2；工程上留抖动余量通常取 3。若 t_io = 300 ms，D ≥ ⌈300/120⌉ + 1 = 4，但仅加深度只能掩盖波动，持续供给仍然不足，因为 W ≥ t_io/t_compute 要求数据侧并行度至少是计算侧的 2.5 倍；应增加 worker、降低解码成本或提高缓存命中率。</div></details>
<details class="quiz"><summary>Q3 · 异步 checkpoint 要满足哪三个条件，恢复后才不会读到“半份状态”？</summary><div class="quiz__a">第一，快照发生在 step 边界，且是独立缓冲区中的不可变副本；第二，所有 rank 的分片都写完并校验通过；第三，最后原子地更新 manifest（或 rename 指针），读取方只认 manifest。缺任何一条，都可能恢复出跨 step 或跨 rank 的混合状态。</div></details>
<details class="quiz"><summary>Q4 · 500 万张 100 KB 的 JPEG，对象存储 GET 往返 20 ms，64 个并发读取，光元数据要多久？改成 1 GB 的 tar 分片后呢？</summary><div class="quiz__a">理论上限约 64/0.02 s = 3200 次/s，500 万次约 1560 s，即 26 分钟，还没算解码；实际受连接池与限流影响通常更慢。改成 1 GB 分片后约 500 个对象，元数据开销可忽略，读取变成顺序流；代价是随机访问变差，需要分片间打乱与缓冲。</div></details>
<ul class="refs">
<li><b>WebDataset Documentation</b> — WebDataset 开源项目（tmbdev 等），持续更新。tar 分片、流式读取与 shard shuffle 的参考实现与用法。</li>
<li><b>PyTorch DataLoader Documentation</b> — PyTorch 社区，持续更新。多进程 worker、pin_memory、prefetch_factor 与持久化 worker 的权威说明。</li>
<li><b>3FS 开源仓库与设计文档</b> — DeepSeek，2025（github.com/deepseek-ai/3FS）。面向 AI 训练与推理的并行文件系统实现，含架构说明、链式复制与 180 节点集群的吞吐数据。</li>
<li><b>Lustre Documentation</b> — OpenSFS / Whamcloud，持续更新。MDS、OSS/OST、striping 与调优参数的官方文档。</li>
<li><b>IBM Spectrum Scale (GPFS) Documentation</b> — IBM，持续更新。分布式元数据、块分布与 POSIX 语义的部署说明。</li>
</ul>
</section>`
};
