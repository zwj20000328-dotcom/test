window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["interconnect"] = {
  slug: "interconnect",
  title: "互联：PCIe、NVLink 与 InfiniBand",
  subtitle: "决定并行策略上限的那根线",
  level: 1,
  cluster: "硬件",
  tags: ["NVLink", "InfiniBand", "PCIe", "拓扑"],
  summary: "从显存到机内、再到跨机的三级带宽落差出发，讲清总线代际、GPU 直连域、无损网络与胖树拓扑的取舍，以及在网归约如何降低集合通信量，最后给出张量、流水、数据并行的放置与排障方法。",
  keyPoints: [
    "PCIe 5.0 x16 单向约 63 GB/s，H100 的 NVLink 每向 450 GB/s，400 Gb/s IB 单向仅 50 GB/s，落差决定并行域",
    "NVLink 域（8 卡 HGX、72 卡 NVL72）是张量并行的天然上限；H100 上跨域后每向带宽掉约 9 倍，GB200 上落差更大",
    "rail-optimized 让同号 GPU 共享一条 rail，SHARP 把 all-reduce 的求和搬进交换机",
    "TP 放机内、PP 跨机、DP 跨集群，并用 NCCL 拓扑检查与 nccl-tests 基线验证"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec">
<h2>先用一句话说清：互联决定并行策略的上限</h2>
<p>把一个大模型训练任务拆到多张 GPU 上，单层计算可能只花几十到几百微秒，但一次跨机 all-reduce 要搬运几十 GB。决定“还能不能再切一刀”的，往往不是 GPU 的算力，而是两块 GPU 之间那条线的带宽与延迟。可以把互联想成道路等级：HBM 是楼内电梯，NVLink 是城市快速路，PCIe 是主干道，InfiniBand 是城际高速。货物每往下走一层，单位时间能通过的就越少。</p>
<p>这张台阶在 H100 上非常具体：HBM3 约 3.35 TB/s，NVLink 4 每向 450 GB/s（厂商标称 900 GB/s 为双向聚合），PCIe 5.0 x16 每向约 63 GB/s，而每张 GPU 配的 400 Gb/s InfiniBand 网卡单向只有 50 GB/s。从 HBM 到 NVLink、再到 PCIe，每级大约掉 7 倍；PCIe 与 IB 基本同档。同样的数据量每多走一层，通信在一步训练里的占比就上升一截。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="集群层次带宽阶梯：HBM3、NVLink 4/5、PCIe 5.0 x16、InfiniBand NDR 与 100GbE 的单向带宽数量级对比">
<text x="20" y="26" font-size="15" fill="var(--sv-ink)" font-family="inherit">同一份数据搬一次：每向带宽的数量级</text>
<text x="740" y="26" font-size="12" text-anchor="end" fill="var(--sv-muted)" font-family="inherit">对数刻度</text>
<line x1="170" y1="42" x2="170" y2="312" stroke="var(--sv-line)" stroke-width="1"/>
<line x1="320" y1="42" x2="320" y2="312" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"/>
<line x1="470" y1="42" x2="470" y2="312" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"/>
<line x1="620" y1="42" x2="620" y2="312" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="3 4"/>
<text x="170" y="330" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">10 GB/s</text>
<text x="320" y="330" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">100 GB/s</text>
<text x="470" y="330" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">1 TB/s</text>
<text x="620" y="330" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">10 TB/s</text>
<text x="160" y="70" font-size="13" text-anchor="end" fill="var(--sv-ink)" font-family="inherit">HBM3（H100 SXM）</text>
<rect x="170" y="55" width="379" height="20" rx="3" fill="var(--sv-a)"/>
<text x="557" y="70" font-size="13" fill="var(--sv-ink)" font-family="inherit">3.35 TB/s</text>
<text x="160" y="115" font-size="13" text-anchor="end" fill="var(--sv-ink)" font-family="inherit">NVLink 5（GB200）</text>
<rect x="170" y="100" width="293" height="20" rx="3" fill="var(--sv-b)"/>
<text x="471" y="115" font-size="13" fill="var(--sv-ink)" font-family="inherit">900 GB/s</text>
<text x="160" y="160" font-size="13" text-anchor="end" fill="var(--sv-ink)" font-family="inherit">NVLink 4（H100）</text>
<rect x="170" y="145" width="248" height="20" rx="3" fill="var(--sv-c)"/>
<text x="426" y="160" font-size="13" fill="var(--sv-ink)" font-family="inherit">450 GB/s</text>
<text x="160" y="205" font-size="13" text-anchor="end" fill="var(--sv-ink)" font-family="inherit">PCIe 5.0 x16</text>
<rect x="170" y="190" width="120" height="20" rx="3" fill="var(--sv-a2)"/>
<text x="298" y="205" font-size="13" fill="var(--sv-ink)" font-family="inherit">约 63 GB/s</text>
<text x="160" y="250" font-size="13" text-anchor="end" fill="var(--sv-ink)" font-family="inherit">IB NDR / 400GbE</text>
<rect x="170" y="235" width="105" height="20" rx="3" fill="var(--sv-b2)"/>
<text x="283" y="250" font-size="13" fill="var(--sv-ink)" font-family="inherit">50 GB/s</text>
<text x="160" y="295" font-size="13" text-anchor="end" fill="var(--sv-ink)" font-family="inherit">100GbE</text>
<rect x="170" y="280" width="15" height="20" rx="3" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="193" y="295" font-size="13" fill="var(--sv-ink)" font-family="inherit">12.5 GB/s</text>
<text x="20" y="362" font-size="13" fill="var(--sv-muted)" font-family="inherit">H100：NVLink 每向 450 GB/s ÷ IB 400 Gb/s（单向 50 GB/s）= 9×，这就是跨机通信的固定落差</text>
</svg><figcaption>图 1 · 集群层次带宽阶梯（对数刻度，统一按每向可用带宽；NVLink 4/5 厂商标称的 900 GB/s 与 1.8 TB/s 是双向聚合，图中取一半）</figcaption></figure>
<div class="callout callout--warn"><span class="callout__label">口径警告</span><div>厂商标称的 NVLink 数字是双向聚合：A100 的 600 GB/s、H100 的 900 GB/s、GB200 的 1.8 TB/s 都是两个方向加起来；PCIe 与 IB 的 63 GB/s、50 GB/s 则是单向。比较时必须统一口径，否则链路预算会差一倍。</div></div>
<p>所以“张量并行放机内、流水并行跨机、数据并行跨集群”不是风格偏好，而是带宽阶梯的直接推论。后文逐层拆开：PCIe 与 NVLink 决定单机域有多大，InfiniBand 与 RoCEv2 决定集群能铺多宽，拓扑与 SHARP 决定这些带宽实际能兑现多少。</p>
</section>

<section class="sec">
<h2>节点内第一层：PCIe 是默认公路，也是隐形瓶颈</h2>
<p>PCIe（Peripheral Component Interconnect Express）是 CPU、加速卡与外设之间的通用总线，按 lane 组织，常见 x16。每代的关键数字是传输速率与编码：PCIe 3.0 为 8 GT/s、128b/130b 编码，x16 单向约 15.75 GB/s；4.0 为 16 GT/s，约 31.5 GB/s；5.0 为 32 GT/s，约 63 GB/s；6.0 为 64 GT/s，改用 PAM4 与 FLIT，x16 单向约 121 GB/s。GT/s 是每秒传输次数，不是字节数，换算时还要考虑编码与协议开销。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>链路</th><th>双向聚合</th><th>每向带宽</th><th>典型设备与说明</th></tr></thead><tbody>
<tr><td>PCIe 4.0 x16</td><td>约 63 GB/s</td><td>约 31.5 GB/s</td><td>A100 PCIe、ConnectX-6</td></tr>
<tr><td>PCIe 5.0 x16</td><td>约 126 GB/s</td><td>约 63 GB/s</td><td>H100 PCIe、ConnectX-7</td></tr>
<tr><td>PCIe 6.0 x16</td><td>约 242 GB/s</td><td>约 121 GB/s</td><td>下一代 PCIe 加速卡</td></tr>
<tr><td>NVLink 3</td><td>600 GB/s（12 链路）</td><td>300 GB/s</td><td>A100 SXM</td></tr>
<tr><td>NVLink 4</td><td>900 GB/s（18 链路）</td><td>450 GB/s</td><td>H100 SXM、HGX H100</td></tr>
<tr><td>NVLink 5</td><td>1.8 TB/s（每 GPU）</td><td>900 GB/s</td><td>B200、GB200</td></tr>
<tr><td>InfiniBand NDR</td><td>100 GB/s（400 Gb/s 端口）</td><td>50 GB/s</td><td>每 GPU 一张 ConnectX-7</td></tr>
<tr><td>InfiniBand XDR</td><td>200 GB/s（800 Gb/s 端口）</td><td>100 GB/s</td><td>ConnectX-8 等 800 Gb/s 网卡，用于 XDR 代集群</td></tr>
</tbody></table></div>
<p>PCIe 的坑在拓扑而不只在代数。两块 GPU 若挂在同一个 PCIe Switch 下（nvidia-smi topo 显示 PIX 或 PXB），可以走交换芯片；若跨 CPU socket（SYS），要多走一条 UPI 或 IF 链路，带宽和延迟都变差。很多“8 卡机”的 GPU 并不是对称连接的：前 4 张与后 4 张分属两个 socket，跨组通信会掉到 PCIe x16 甚至更低。在没有 NVSwitch 的 PCIe 机器上做 TP，如果 rank 映射跨了 socket，性能会无缘无故掉一截；而 NVSwitch 机器上 GPU 间仍走 NVLink，进程绑定影响的主要是 CPU 与网卡亲和。</p>
<p>这也是 PCIe 版加速卡不适合大模型张量并行的原因：PCIe 5.0 x16 每向 63 GB/s，只有 H100 NVLink 每向 450 GB/s 的七分之一；按双向口径 126 GB/s 对 900 GB/s 也是七分之一。PCIe 的职责是主机通信、网卡与存储接入，以及在没有 NVLink 的服务器里兜底；把它当成 GPU 间主通道，TP 一开就会撞墙。</p>
<h3>NVLink 与 NVSwitch：把 8 张卡做成一块“大芯片”</h3>
<p>NVLink 是 NVIDIA 的 GPU 直连链路。V100 的 NVLink 2.0 提供 300 GB/s 双向聚合带宽（6 条链路，每向 150 GB/s），A100 的 NVLink 3.0 提升到 600 GB/s 双向（12 条链路，每向 300 GB/s），H100 的 NVLink 4.0 是 900 GB/s 双向（18 条链路，每向 450 GB/s）。到了 Blackwell，单 GPU 的 NVLink 5 达到 1.8 TB/s 双向聚合（每向 900 GB/s）；GB200 NVL72 把 72 张 GPU 放进同一个 NVLink 域，整域双向聚合带宽约 130 TB/s。</p>
<p>只有 NVLink 还不够，拓扑形状决定谁和谁等速。早期 4 卡或 8 卡用 mesh，部分卡对之间要绕路；HGX 平台用 NVSwitch 做无阻塞 crossbar，H100 的 8 卡节点里任意两张 GPU 之间都是 900 GB/s 双向，不再有“邻居快、远端慢”。GB200 NVL72 则把 crossbar 扩展到机柜级：18 颗 NVLink Switch 芯片通过铜缆背板连接 72 张 GPU，形成 72 卡的单一域。此时“节点”这个概念在通信上被放大了一整圈。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="单机 NVLink 全连接与跨机 InfiniBand 的对比：8 卡经 NVSwitch 任意两卡 900 GB/s 双向（每向 450 GB/s），跨机每 GPU 仅 50 GB/s">
<text x="20" y="26" font-size="15" fill="var(--sv-ink)" font-family="inherit">节点内：NVSwitch 无阻塞域</text>
<text x="400" y="26" font-size="15" fill="var(--sv-ink)" font-family="inherit">跨节点：IB fat-tree</text>
<line x1="380" y1="44" x2="380" y2="340" stroke="var(--sv-line)" stroke-width="1" stroke-dasharray="5 5"/>
<rect x="140" y="166" width="120" height="52" rx="6" fill="var(--sv-panel)" stroke="var(--sv-a)" stroke-width="2"/>
<text x="200" y="188" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">NVSwitch × 4</text>
<text x="200" y="206" font-size="12" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">无阻塞 crossbar</text>
<rect x="30" y="66" width="70" height="36" rx="4" fill="var(--sv-a2)"/><text x="65" y="89" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU 0</text>
<rect x="120" y="66" width="70" height="36" rx="4" fill="var(--sv-a2)"/><text x="155" y="89" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU 1</text>
<rect x="210" y="66" width="70" height="36" rx="4" fill="var(--sv-a2)"/><text x="245" y="89" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU 2</text>
<rect x="300" y="66" width="70" height="36" rx="4" fill="var(--sv-a2)"/><text x="335" y="89" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU 3</text>
<rect x="30" y="282" width="70" height="36" rx="4" fill="var(--sv-a2)"/><text x="65" y="305" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU 4</text>
<rect x="120" y="282" width="70" height="36" rx="4" fill="var(--sv-a2)"/><text x="155" y="305" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU 5</text>
<rect x="210" y="282" width="70" height="36" rx="4" fill="var(--sv-a2)"/><text x="245" y="305" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU 6</text>
<rect x="300" y="282" width="70" height="36" rx="4" fill="var(--sv-a2)"/><text x="335" y="305" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU 7</text>
<line x1="65" y1="102" x2="170" y2="166" stroke="var(--sv-a)" stroke-width="1.5"/>
<line x1="155" y1="102" x2="185" y2="166" stroke="var(--sv-a)" stroke-width="1.5"/>
<line x1="245" y1="102" x2="215" y2="166" stroke="var(--sv-a)" stroke-width="1.5"/>
<line x1="335" y1="102" x2="230" y2="166" stroke="var(--sv-a)" stroke-width="1.5"/>
<line x1="65" y1="282" x2="170" y2="218" stroke="var(--sv-a)" stroke-width="1.5"/>
<line x1="155" y1="282" x2="185" y2="218" stroke="var(--sv-a)" stroke-width="1.5"/>
<line x1="245" y1="282" x2="215" y2="218" stroke="var(--sv-a)" stroke-width="1.5"/>
<line x1="335" y1="282" x2="230" y2="218" stroke="var(--sv-a)" stroke-width="1.5"/>
<text x="200" y="352" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">任意两卡 900 GB/s（双向，每向 450）</text>
<rect x="410" y="252" width="130" height="64" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="475" y="277" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">节点 A</text>
<text x="475" y="296" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">8×GPU + 8×NIC</text>
<rect x="590" y="252" width="130" height="64" rx="5" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="655" y="277" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">节点 B</text>
<text x="655" y="296" font-size="11" text-anchor="middle" fill="var(--sv-muted)" font-family="inherit">8×GPU + 8×NIC</text>
<rect x="480" y="140" width="170" height="40" rx="5" fill="var(--sv-b2)" stroke="var(--sv-b)"/>
<text x="565" y="165" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Leaf / Spine（IB）</text>
<line x1="475" y1="252" x2="520" y2="180" stroke="var(--sv-b)" stroke-width="1.5"/>
<line x1="655" y1="252" x2="610" y2="180" stroke="var(--sv-b)" stroke-width="1.5"/>
<text x="565" y="352" font-size="13" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">每 GPU 400 Gb/s ≈ 单向 50 GB/s</text>
<text x="390" y="200" font-size="18" fill="var(--sv-c)" font-family="inherit">9×</text>
</svg><figcaption>图 2 · 单机 NVLink 全连接与跨机 IB 对比：H100 机内 900 GB/s 是双向口径，折合每向 450 GB/s；跨机每 GPU 一张 400 Gb/s 网卡（单向 50 GB/s），落差约 9 倍</figcaption></figure>
<p>工程含义很直接：<mark>NVLink 域的大小，就是张量并行不用付跨机代价的最大宽度</mark>。普通 HGX 机器上 TP 通常不超过 8；在 NVL72 上可以把 TP 做到 72，但一旦跨出这个域，就要重新付跨机代价。在 H100 上，每向带宽会从 450 GB/s 级掉到 50 GB/s 级，差 9 倍；GB200 的 NVLink 5 每向 900 GB/s，跨到 400 Gb/s IB 时落差是 18 倍。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>把 NVLink 域想成“同一块主板上的内存总线”。在这个域里，GPU 之间像访问本地内存；出了域，就像访问另一座城市的磁盘。TP 的每一层都要过这条线，所以它只能待在域内。</div></div>
</section>

<section class="sec">
<h2>节点间：InfiniBand、RoCEv2 与 fat-tree</h2>
<p>跨机通信靠网卡。InfiniBand（IB）是专为 HPC 设计的网络，端口速率按代际命名：HDR 200 Gb/s、NDR 400 Gb/s、XDR 800 Gb/s。注意单位是 Gb/s（比特每秒），400 Gb/s 换算成字节是 50 GB/s 单向。DGX H100 给每张 GPU 配一张 400 Gb/s ConnectX-7，因此跨机时每 GPU 的可用带宽是 50 GB/s 量级，相对机内 NVLink 每向 450 GB/s 正好是 9 倍落差。这个 9 倍是 H100 上所有并行决策的标尺；换成 GB200 与 400 Gb/s IB，落差会变成 18 倍。</p>
<p>IB 的优势是原生 RDMA、基于 credit 的无损链路、硬件拥塞控制与自适应路由，交换机单跳延迟在亚微秒到 1 微秒量级；代价是需要专用交换机和子网管理器（OpenSM 或 UFM），生态相对封闭。RoCEv2（RDMA over Converged Ethernet v2）把 RDMA 封装进 UDP/IP，可以跑在以太网上，成本和厂商选择更灵活，但需要 PFC（Priority Flow Control）做无损、ECN 做拥塞标记，配置不当会出现 pause storm 甚至死锁。Meta 在 Llama 3 的大规模训练集群里同时运营 IB 与 RoCEv2 fabric，并公开了 rail-optimized 拓扑、400 Gb/s 网卡与故障处理的经验。</p>
<h3>fat-tree 与 rail-optimized</h3>
<p>集群网络的主流形状是 fat-tree（胖树）：服务器接 leaf（接入）交换机，leaf 全连到 spine（骨干），规模再大加一层 super-spine。它的好处是任意两点间路径数多、可水平扩展；代价是收敛比（oversubscription）。如果 leaf 下行总带宽是 8 Tb/s、上行只有 4 Tb/s，就是 2:1 收敛，跨 leaf 的流量高峰会被压到一半。训练集群通常追求 1:1 无收敛，或者至少让最热的通信模式落在同一 leaf 内。</p>
<p>rail-optimized 是针对 GPU 服务器的优化：一台 8 卡机有 8 张网卡，第 i 张网卡接到第 i 条 rail 的一组 leaf 上，机内第 i 号 GPU 的跨机流量通常从第 i 张网卡出去。这样所有服务器的 GPU 0 构成 rail 0，GPU 1 构成 rail 1。小规模部署里，如果同一条 rail 的 GPU 都落在同一台 leaf 下，通信只经过一台 leaf，一跳、无收敛；大规模时一条 rail 往往是一组 leaf，跨 leaf 的流量仍要上 spine，只是主要在本 rail 的 leaf-spine 平面内消化，减少与其他 rail 的相互干扰。跨 rail 的 all-to-all 才需要经过 spine 在全网范围内汇聚。NCCL 的 ring 如果按 rail 对齐 rank，就能把大部分流量锁在 rail 内，减少每条消息都挤到 spine 的情况。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="rail-optimized fat-tree 拓扑：三台服务器各 4 个 GPU，同号 GPU 竖直连到同一台 rail leaf，leaf 再上连 spine">
<text x="20" y="24" font-size="15" fill="var(--sv-ink)" font-family="inherit">rail-optimized：同号 GPU 共享一条 rail</text>
<rect x="220" y="14" width="130" height="28" rx="4" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="285" y="33" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Spine 0</text>
<rect x="410" y="14" width="130" height="28" rx="4" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text x="475" y="33" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Spine 1</text>
<rect x="75" y="70" width="90" height="36" rx="4" fill="var(--sv-a)"/>
<text x="120" y="86" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Leaf 0</text>
<text x="120" y="100" font-size="11" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">rail 0</text>
<rect x="235" y="70" width="90" height="36" rx="4" fill="var(--sv-b)"/>
<text x="280" y="86" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Leaf 1</text>
<text x="280" y="100" font-size="11" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">rail 1</text>
<rect x="395" y="70" width="90" height="36" rx="4" fill="var(--sv-c)"/>
<text x="440" y="86" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Leaf 2</text>
<text x="440" y="100" font-size="11" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">rail 2</text>
<rect x="555" y="70" width="90" height="36" rx="4" fill="var(--sv-a2)"/>
<text x="600" y="86" font-size="12" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">Leaf 3</text>
<text x="600" y="100" font-size="11" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">rail 3</text>
<line x1="120" y1="70" x2="260" y2="42" stroke="var(--sv-line)" stroke-width="1"/>
<line x1="120" y1="70" x2="450" y2="42" stroke="var(--sv-line)" stroke-width="1"/>
<line x1="280" y1="70" x2="300" y2="42" stroke="var(--sv-line)" stroke-width="1"/>
<line x1="280" y1="70" x2="450" y2="42" stroke="var(--sv-line)" stroke-width="1"/>
<line x1="440" y1="70" x2="320" y2="42" stroke="var(--sv-line)" stroke-width="1"/>
<line x1="440" y1="70" x2="470" y2="42" stroke="var(--sv-line)" stroke-width="1"/>
<line x1="600" y1="70" x2="340" y2="42" stroke="var(--sv-line)" stroke-width="1"/>
<line x1="600" y1="70" x2="490" y2="42" stroke="var(--sv-line)" stroke-width="1"/>
<text x="20" y="232" font-size="12" fill="var(--sv-ink)" font-family="inherit">服务器 0</text>
<text x="20" y="282" font-size="12" fill="var(--sv-ink)" font-family="inherit">服务器 1</text>
<text x="20" y="332" font-size="12" fill="var(--sv-ink)" font-family="inherit">服务器 2</text>
<line x1="120" y1="106" x2="120" y2="221" stroke="var(--sv-a)" stroke-width="1.5"/>
<line x1="280" y1="106" x2="280" y2="221" stroke="var(--sv-b)" stroke-width="1.5"/>
<line x1="440" y1="106" x2="440" y2="221" stroke="var(--sv-c)" stroke-width="1.5"/>
<line x1="600" y1="106" x2="600" y2="221" stroke="var(--sv-a2)" stroke-width="1.5"/>
<line x1="120" y1="243" x2="120" y2="271" stroke="var(--sv-a)" stroke-width="1.5"/>
<line x1="280" y1="243" x2="280" y2="271" stroke="var(--sv-b)" stroke-width="1.5"/>
<line x1="440" y1="243" x2="440" y2="271" stroke="var(--sv-c)" stroke-width="1.5"/>
<line x1="600" y1="243" x2="600" y2="271" stroke="var(--sv-a2)" stroke-width="1.5"/>
<line x1="120" y1="293" x2="120" y2="321" stroke="var(--sv-a)" stroke-width="1.5"/>
<line x1="280" y1="293" x2="280" y2="321" stroke="var(--sv-b)" stroke-width="1.5"/>
<line x1="440" y1="293" x2="440" y2="321" stroke="var(--sv-c)" stroke-width="1.5"/>
<line x1="600" y1="293" x2="600" y2="321" stroke="var(--sv-a2)" stroke-width="1.5"/>
<rect x="96" y="221" width="48" height="22" rx="3" fill="var(--sv-a)"/><text x="120" y="236" font-size="11" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU 0</text>
<rect x="256" y="221" width="48" height="22" rx="3" fill="var(--sv-b)"/><text x="280" y="236" font-size="11" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU 1</text>
<rect x="416" y="221" width="48" height="22" rx="3" fill="var(--sv-c)"/><text x="440" y="236" font-size="11" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU 2</text>
<rect x="576" y="221" width="48" height="22" rx="3" fill="var(--sv-a2)"/><text x="600" y="236" font-size="11" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU 3</text>
<rect x="96" y="271" width="48" height="22" rx="3" fill="var(--sv-a)"/><text x="120" y="286" font-size="11" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU 0</text>
<rect x="256" y="271" width="48" height="22" rx="3" fill="var(--sv-b)"/><text x="280" y="286" font-size="11" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU 1</text>
<rect x="416" y="271" width="48" height="22" rx="3" fill="var(--sv-c)"/><text x="440" y="286" font-size="11" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU 2</text>
<rect x="576" y="271" width="48" height="22" rx="3" fill="var(--sv-a2)"/><text x="600" y="286" font-size="11" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU 3</text>
<rect x="96" y="321" width="48" height="22" rx="3" fill="var(--sv-a)"/><text x="120" y="336" font-size="11" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU 0</text>
<rect x="256" y="321" width="48" height="22" rx="3" fill="var(--sv-b)"/><text x="280" y="336" font-size="11" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU 1</text>
<rect x="416" y="321" width="48" height="22" rx="3" fill="var(--sv-c)"/><text x="440" y="336" font-size="11" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU 2</text>
<rect x="576" y="321" width="48" height="22" rx="3" fill="var(--sv-a2)"/><text x="600" y="336" font-size="11" text-anchor="middle" fill="var(--sv-ink)" font-family="inherit">GPU 3</text>
<text x="20" y="366" font-size="12" fill="var(--sv-muted)" font-family="inherit">同 rail 且同 leaf 一跳；跨 leaf 或跨 rail 需经 spine，流量与尾延迟都更高</text>
</svg><figcaption>图 3 · rail-optimized fat-tree（4 卡简化示意）：每列是一条 rail，同号 GPU 跨服务器连到同一 leaf；同 leaf 通信一跳可达，跨 leaf 或跨 rail 才上 spine</figcaption></figure>
<p>图 3 里每个竖直列就是一条 rail：三台服务器的同号 GPU 连到同一台 leaf。做数据并行时，若把同一个 DP 组的 rank 放在同一 rail 且同一 leaf 下，梯度 all-reduce 的每一跳都只经过一台交换机；若随意映射，流量会在 spine 上再汇聚一次，尾延迟明显变差。真实集群的 rail 通常由多台 leaf 组成，图示只保留一台，用于说明“同号 GPU 走同一列”的映射原则。</p>
</section>

<section class="sec">
<h2>SHARP：把归约搬进交换机</h2>
<p>标准 ring all-reduce 中，每个 GPU 的发送量（接收量与之相同）约为 2(N−1)/N·M，N 越大越接近 2M，也就是接近两倍参与归约的数据量。NVIDIA 的 SHARP（Scalable Hierarchical Aggregation and Reduction Protocol）把求和这一步下放到支持 SHARP 的 IB 交换机：GPU 把数据发给交换机，交换机在内部做加法，再把结果沿树广播回去。端点侧每个 GPU 只需发送 M、接收 M，单向流量从 2(N−1)/N·M 降到 M，收发合计约 2M，与 GPU 数量基本无关。</p>
<div class="formula">无 SHARP：V_send ≈ 2 × (N−1)/N × M<br>有 SHARP：V_send ≈ M<br>每 GPU 收发合计为 2 × V_send；M 为参与归约的数据量，N 为 GPU 数</div>
<p>SHARP 需要整条链路都支持：Quantum 系列交换机、正确的子网管理器配置、NCCL 的 SHARP 插件，以及作业调度把同一通信组分配到 SHARP 树覆盖的端口。它通常只在 IB 上可用，标准 RoCE 没有等价的在网归约；支持的归约操作也有限（常见是 sum、min、max、按位操作），混合精度与自定义算子要确认兼容性。收益在大规模 all-reduce 上最明显，小消息仍受延迟支配。</p>
<div class="callout callout--formula"><span class="callout__label">判断</span><div>当 all-reduce 的 busbw 随规模增大明显下滑、而链路本身没跑满时，先查是否落到了软件树；SHARP 往往能把跨机 all-reduce 的有效带宽拉回接近线速。集合通信算法本身在 collective-comm 一篇展开。</div></div>
</section>

<section class="sec">
<h2>用带宽阶梯决定 TP、PP、DP 的放置</h2>
<p>三种并行的通信模式完全不同。张量并行（TP）在每一层都要做 all-reduce，消息小、次数多、对延迟极敏感，必须待在 NVLink 域内；流水并行（PP）只在 stage 边界传激活和梯度，是点对点、低频、可容忍跨机；数据并行（DP）每一步做一次梯度 all-reduce，消息最大但可以与反向计算重叠，适合跨机甚至跨集群。判断标准不是“哪个听起来高级”，而是通信量除以计算量。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>并行维度</th><th>通信模式</th><th>频率</th><th>延迟敏感度</th><th>推荐链路</th><th>常见规模</th></tr></thead><tbody>
<tr><td>TP 张量并行</td><td>每层 all-reduce</td><td>每层多次</td><td>很高</td><td>NVLink 域内</td><td>≤ 8（HGX）或 ≤ 72（NVL72）</td></tr>
<tr><td>PP 流水并行</td><td>stage 间点对点</td><td>每微批一次</td><td>中</td><td>IB / RoCE</td><td>跨节点，2–数十 stage</td></tr>
<tr><td>DP 数据并行</td><td>梯度 all-reduce</td><td>每步一次</td><td>较低，可重叠</td><td>IB / RoCE</td><td>跨机架到跨集群</td></tr>
</tbody></table></div>
<p>做一个粗算。设 TP 度为 N，单层激活量为 B·S·H 个元素、bf16 每个 2 字节。训练一步中，每个 Transformer 层的前向与反向各有两次张量并行 all-reduce，共 4 次；每次 all-reduce 中每个 GPU 的发送量约为 2×(N−1)/N×B·S·H×2 字节。因此一层合计约 4×2×(N−1)/N×B·S·H×2 字节，乘上层数 L 就是一步的 TP 通信量。把它除以 NVLink 带宽，再和该步的计算时间比：经验上若通信时间超过计算的 20%，就值得检查 TP 是否开得过大或放置跨了域。DP 的梯度量为参数量 P×2 字节，按 ring 口径每个 GPU 的发送量约为 2×(N_DP−1)/N_DP×P×2 字节，除以 IB 带宽即可估算同步时间；它能否被隐藏，取决于反向传播的时长和是否用了 ZeRO 或梯度分桶。</p>
<div class="formula">T_TP ≈ L × 4 × [2 × (N_TP−1)/N_TP × (B·S·H × 2 字节) / BW_NVLink + 2(N_TP−1)α]<br>T_DP ≈ 2 × (N_DP−1)/N_DP × (P × 2 字节) / BW_IB + 2(N_DP−1)α<br>α 为单跳延迟，B 为批内 token 数，S 为序列长度，H 为隐藏维，P 为参数量</div>
<p>经验规则：TP 尽量不超过单机 GPU 数（HGX 为 8，NVL72 可到 72），PP 的 stage 边界可以落在 IB 上，DP 组优先铺在同一个 rail 或同一 leaf 下。若模型大到单机放不下，先扩 PP 再扩 DP；若单层参数或激活大到 8 卡装不下、又必须保持张量并行，才考虑把 TP 拆到 NVL72 这样的更大域。集合通信算法（ring/tree、reduce-scatter）留给 collective-comm 一篇，这里只关心“放在哪”。</p>
</section>

<section class="sec">
<h2>工程实践：拓扑感知通信与排障</h2>
<p>NCCL 在初始化时会读取 NVML 拓扑，决定用 NVLink、PCIe 还是网络，并据此建 ring 或 tree。第一步永远是看拓扑：nvidia-smi topo -m 中 NV18 表示两张卡通过 NVSwitch 以 18 条链路相连；PIX 表示两块 GPU 之间至多经过一级 PCIe bridge，PXB 表示经过多级 PCIe bridge 但不跨 host bridge，PHB 表示经过 PCIe host bridge（通常就是 CPU），NODE 表示同一 NUMA 节点内跨 host bridge，SYS 表示跨 NUMA 节点（经 UPI 或 IF 等 SMP 互连）。看到 TP 组里出现 SYS，就该调整 rank 或进程绑定。</p>
<pre class="code" data-lang="bash"><code># 1) 看 NVLink / PCIe / NUMA 拓扑（NV18 表示经 NVSwitch 的 18 条链路）
nvidia-smi topo -m

# 2) 看 IB 端口速率与链路状态
ibstat | head -20

# 3) 让 NCCL 打印选路与拓扑，再跑 all-reduce 带宽测试
export NCCL_DEBUG=INFO
export NCCL_IB_HCA=mlx5_0,mlx5_1
export NCCL_SOCKET_IFNAME=eth0
./all_reduce_perf -b 8 -e 8G -f 2 -g 8</code></pre>
<p>用 nccl-tests 的 all_reduce_perf 建立基线：8 卡 NVLink 域内 busbw 应与每向 450 GB/s 同一量级（实际受算法与消息大小影响），跨机则应落在每 GPU 50 GB/s 理论值的 60%–90%，即 30–45 GB/s 量级；如果只有几 GB/s，先查是否走了 TCP socket、是否选错 HCA、MTU 是否一致。RoCE 环境还要确认 PFC 端到端一致开启、ECN 阈值合理、无损队列没有丢包，否则会出现“带宽看着够、尾延迟爆炸”。</p>
<p>拓扑感知的关键动作可以归为四类：一是把 rank 映射到物理位置（TP 组同 NVLink 域，PCIe 机器上同 socket；DP 组同 rail），避免跨 rail 的 ring；二是用 NCCL_IB_HCA 指定与 GPU 同 NUMA 的网卡；三是对跨机大消息启用 SHARP 或 tree 算法；四是对 RoCE 固定 MTU 并核对交换机 counters。每一次改并行配置，都用同一组消息大小重跑基线，才能区分“算法选择”与“链路故障”。</p>
<div class="callout callout--tip"><span class="callout__label">排障顺序</span><div>nvidia-smi topo -m 看机内，ibstat 与 ib_write_bw 看链路，nccl-tests 看集合通信，NCCL_DEBUG=INFO 看选路。不要一上来就调 NCCL_ALGO，先确认流量到底走了哪条路。</div></div>
</section>

<section class="sec">
<h2>四个最常见的误区</h2>
<p>第一，把厂商标称的双向聚合带宽当成单向。A100 的 600 GB/s、H100 的 900 GB/s 都是两个方向的和，折算每向只有 300 GB/s 与 450 GB/s；拿它和单向的 IB 50 GB/s 直接比，会把 9 倍说成 18 倍。第二，把 400 Gb/s 当成 400 GB/s：比特与字节差 8 倍，400 Gb/s 的单向线速只有 50 GB/s，扣掉编码与协议开销后有效载荷更低。第三，以为 PCIe 5.0 能撑 TP：每向 63 GB/s 与 NVLink 的 450 GB/s 差 7 倍，PCIe 版 GPU 做 TP 会立刻被通信压住。第四，以为 NVLink 域永远等于 8 卡：NVL72 把域扩到 72 卡，拓扑假设和 NCCL 配置都要跟着变。</p>
<div class="duo"><div class="duo__col"><h4>scale-up 域（NVLink）</h4><p>目标是让任意两卡等带宽、低延迟。H100 的 HGX 用 4 颗 NVSwitch 把 8 卡做成无阻塞域；GB200 NVL72 把它扩到 72 卡、130 TB/s 聚合。TP 的宽度由它决定。</p></div><div class="duo__col"><h4>scale-out 域（IB / RoCE）</h4><p>目标是横向扩展、多路径与容错。每 GPU 单向 50 GB/s（NDR）到 100 GB/s（XDR），靠 fat-tree 与 rail-optimized 把流量分散。PP 与 DP 的宽度由它决定。</p></div></div>
<p>还有一个隐蔽的坑是“拓扑看起来对，映射不对”。同一台机器里 8 张卡都显示 NV18，说明 GPU 间走的是经 NVSwitch 的 NVLink；此时把两个 TP rank 放到跨 socket 的进程上，不会把 GPU 间数据打回 PCIe 与 UPI，但会影响 CPU 侧拷贝、网卡亲和与 GPUDirect 路径，网络密集型任务的尾延迟仍会变差。真正会让 GPU 间掉到 PCIe 的，是拓扑本身显示 PIX、PHB 或 SYS，或者 NVLink 被禁用、NCCL 选错路径。跨机时如果 ring 的相邻 rank 不在同一 rail，流量要多绕一层 spine，受收敛比与排队影响，尾延迟上升；是否“带宽减半”取决于收敛比，不能一概而论。排障时不要只看单卡带宽，要看通信组内的 rank 到物理拓扑的映射。</p>
<div class="callout callout--warn"><span class="callout__label">RoCE 警告</span><div>RoCE 不是“插上就能跑”。PFC 配置不一致会导致 pause storm；MTU 不一致会让大包分片；ECN 阈值过高会让拥塞扩散。生产环境要把这些当配置项管理，而不是依赖默认值。</div></div>
</section>

<section class="sec">
<h2>自测与延伸阅读</h2>
<details class="quiz"><summary>Q1 · H100 8 卡节点做 TP=8 走什么链路？把 TP 扩到 16、跨两台机器后，带宽和耗时如何变化？</summary><div class="quiz__a">TP=8 时整个通信组在 NVLink 域内，任意两卡 900 GB/s 双向（每向 450 GB/s）。TP=16 时另一半 GPU 在第二台机器上，跨机那部分流量要过 400 Gb/s IB，每 GPU 每向仅 50 GB/s，且每层都要过机；跨机部分每向带宽落差约 9 倍，通信时间相应放大，通常应改用 PP/DP 或把 TP 限制在 8 卡（除非使用 NVL72 这类 72 卡域）。</div></details>
<details class="quiz"><summary>Q2 · 70B 模型用 bf16 梯度做 DP=64 的 all-reduce，每个 GPU 至少搬多少数据？400 Gb/s 网卡、有效 40 GB/s 时约多久？</summary><div class="quiz__a">梯度总量 70×10^9×2 B = 140 GB。ring all-reduce 每 GPU 发送约 2×(63/64)×140 GB ≈ 276 GB（接收量相同，双向并行）；按 40 GB/s 计约 6.9 秒。这个量级说明 DP 梯度同步必须与反向计算重叠，或用 ZeRO、梯度分桶降低单次通信量。</div></details>
<details class="quiz"><summary>Q3 · 8 卡服务器配 8 条 rail，为什么 rank 映射会影响 all-reduce 性能？</summary><div class="quiz__a">同一 rail 且同一 leaf 下的 GPU 通信只经过一台 leaf，一跳且无收敛；如果 ring 的相邻 rank 跨 rail 或跨 leaf，每一跳都要经 leaf 上 spine 再下 leaf，带宽受收敛比限制、尾延迟更高。把 TP/DP 组按 rail 对齐，可把大部分流量锁在 rail 内。</div></details>
<details class="quiz"><summary>Q4 · SHARP 把端点流量从 2(N−1)/N·M 降到约 M，为什么不是所有集群都能开？</summary><div class="quiz__a">它要求 SHARP 能力的 IB 交换机、正确的子网管理器配置、NCCL SHARP 插件，以及调度把通信组放到同一棵 SHARP 树上；标准 RoCE 没有等价能力，部分归约操作与数值精度也不支持。条件不满足时会回退到软件树。</div></details>
<ul class="refs">
<li><b>NVIDIA NVLink and NVSwitch</b> — NVIDIA 官方文档。NVLink 代际带宽、NVSwitch 无阻塞域，以及 GB200 NVL72 的 72 GPU 域与 130 TB/s 聚合带宽。</li>
<li><b>InfiniBand Architecture Specification, Volume 1</b> — IBTA。IB 链路层、credit 流控与 HDR/NDR/XDR 速率定义的权威规范。</li>
<li><b>The Llama 3 Herd of Models</b> — Meta AI, arXiv:2407.21783, 2024。基础设施章节的网络部分描述 rail-optimized 拓扑、400 Gb/s 网卡与 RoCE/IB 的大规模运维经验。</li>
<li><b>NCCL User Guide</b> — NVIDIA。nvidia-smi topo 语义、NCCL 选路与 NCCL_* 环境变量的官方说明。</li>
<li><b>PCI Express Base Specification, Revision 5.0</b> — PCI-SIG, 2019。PCIe 5.0 的编码与每 lane 速率，是换算 x16 单向带宽的依据。</li>
</ul>
</section>`
};
