window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["compilers"] = {
  slug: "compilers",
  title: "编译器与算子生成",
  subtitle: "Triton、TVM、XLA 与 TorchInductor",
  level: 2,
  cluster: "单机优化",
  tags: ["Triton", "torch.compile", "MLIR"],
  summary: "从算子图到机器码，拆解 Dynamo、AOTAutograd、Inductor 与 Triton 的编译流水线，说明融合、布局与自动调参的收益来源，并给出性能回退的排障方法。",
  keyPoints: [
    "编译器把算子清单改写成循环程序，收益主要来自融合、布局选择与自动调参，而不是某种魔法",
    "torch.compile 的链路是 Dynamo 抓图、AOTAutograd 补反向、Inductor 调度融合、Triton 生成机器码",
    "图断点、重编译与动态 shape 是落地时最常见的三类性能回退，均有可观测的日志手段"
  ],
  readingMinutes: 14,
  html: String.raw`<section class="sec"><h2>一、编译器到底在解决什么问题</h2>
<p>在 eager（立即执行）模式下，PyTorch 每遇到一个算子就启动一次 GPU kernel。一个 7B 参数的 Transformer 前向会包含数百到上千个算子，每个算子都把中间结果写回显存（HBM），下一个算子再读回来。计算本身往往只占几微秒，<mark>搬运和启动开销才是大头</mark>。</p>
<div class="callout callout--intuition"><span class="callout__label">直觉</span><div>编译器的核心动作，是把「先算这个、再算那个」的算子清单，改写成「一批数据搬进寄存器和共享内存，一口气算完，再搬出去」的循环程序。</div></div>
<p>算一笔账：对一个 100 万元素的 fp32 张量做逐元素加法，读 4 MB、写 4 MB，共 8 MB。A100 80GB 的 HBM2e 带宽约 2.0 TB/s，理论耗时约 4 µs；而一次 kernel 启动的固定开销在 3-5 µs 量级。也就是说在这个规模下，<b>搬运时间和启动开销同量级，数学计算几乎不占时间</b>。把三个逐元素算子融合成一个，就省掉两次启动和四次显存访问。</p>
<p>编译器还负责另外三件事：挑选分块大小与线程映射（autotuning，自动调优）；决定张量在显存中的排布方式（layout，布局）；复用中间缓冲区以压低峰值显存。这些决策在手工优化时代由写 kernel 的工程师承担，如今交给编译器。本篇只讲编译器的决策逻辑，手写 kernel 的技巧在相邻篇目展开。</p>
</section>

<section class="sec"><h2>二、从计算图到机器码：lowering 流水线</h2>
<p>lowering（逐层下降）指把高抽象层的表示翻译成低抽象层的表示，直到成为机器码。主流深度学习编译器基本遵循同一条四段式流水线：<b>捕获图 → 图级优化 → 算子与循环级 lowering → 代码生成与后端汇编</b>。</p>
<ol>
<li><b>捕获</b>：从 Python 字节码、框架图 API 或追踪器拿到计算图，同时记录下这次捕获成立的前提条件。</li>
<li><b>图级优化</b>：常量折叠、死代码消除、代数化简（如 <code>x*1</code> 消除）、算子替换。</li>
<li><b>算子与循环级 lowering</b>：决定分块（tiling）、融合、并行映射、向量化宽度，形成循环级 IR。</li>
<li><b>代码生成</b>：生成 Triton、C++ 等源码或 LLVM IR；GPU 路径再交给 ptxas 汇编成 SASS。</li>
</ol>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="torch.compile 的编译流水线与编译器抽象层级示意图">
<defs>
<marker id="compilers-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"/></marker>
</defs>
<text font-family="inherit" x="16" y="26" font-size="14" font-weight="600" fill="var(--sv-ink)">torch.compile 的具体路径</text>
<rect x="14" y="42" width="105" height="58" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text font-family="inherit" x="66" y="66" text-anchor="middle" font-size="13" fill="var(--sv-ink)">Python 函数</text>
<text font-family="inherit" x="66" y="84" text-anchor="middle" font-size="11" fill="var(--sv-muted)">eager 语义</text>
<rect x="140" y="42" width="105" height="58" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text font-family="inherit" x="192" y="66" text-anchor="middle" font-size="13" fill="var(--sv-ink)">Dynamo</text>
<text font-family="inherit" x="192" y="84" text-anchor="middle" font-size="11" fill="var(--sv-muted)">FX 图 + guard</text>
<rect x="266" y="42" width="105" height="58" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text font-family="inherit" x="318" y="66" text-anchor="middle" font-size="13" fill="var(--sv-ink)">AOTAutograd</text>
<text font-family="inherit" x="318" y="84" text-anchor="middle" font-size="11" fill="var(--sv-muted)">前向 / 反向图</text>
<rect x="392" y="42" width="105" height="58" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text font-family="inherit" x="444" y="66" text-anchor="middle" font-size="13" fill="var(--sv-ink)">Inductor</text>
<text font-family="inherit" x="444" y="84" text-anchor="middle" font-size="11" fill="var(--sv-muted)">循环级 IR</text>
<rect x="518" y="42" width="105" height="58" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text font-family="inherit" x="570" y="66" text-anchor="middle" font-size="13" fill="var(--sv-ink)">Triton</text>
<text font-family="inherit" x="570" y="84" text-anchor="middle" font-size="11" fill="var(--sv-muted)">TTIR → PTX</text>
<rect x="644" y="42" width="105" height="58" rx="8" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text font-family="inherit" x="696" y="66" text-anchor="middle" font-size="13" fill="var(--sv-ink)">ptxas</text>
<text font-family="inherit" x="696" y="84" text-anchor="middle" font-size="11" fill="var(--sv-muted)">SASS</text>
<line x1="119" y1="71" x2="136" y2="71" stroke="var(--sv-line)" marker-end="url(#compilers-arrow)"/>
<line x1="245" y1="71" x2="262" y2="71" stroke="var(--sv-line)" marker-end="url(#compilers-arrow)"/>
<line x1="371" y1="71" x2="388" y2="71" stroke="var(--sv-line)" marker-end="url(#compilers-arrow)"/>
<line x1="497" y1="71" x2="514" y2="71" stroke="var(--sv-line)" marker-end="url(#compilers-arrow)"/>
<line x1="623" y1="71" x2="640" y2="71" stroke="var(--sv-line)" marker-end="url(#compilers-arrow)"/>
<text font-family="inherit" x="192" y="120" text-anchor="middle" font-size="11" fill="var(--sv-muted)">① 捕获</text>
<text font-family="inherit" x="318" y="120" text-anchor="middle" font-size="11" fill="var(--sv-muted)">② 反向图</text>
<text font-family="inherit" x="444" y="120" text-anchor="middle" font-size="11" fill="var(--sv-muted)">③ 调度融合</text>
<text font-family="inherit" x="570" y="120" text-anchor="middle" font-size="11" fill="var(--sv-muted)">④ 代码生成</text>
<text font-family="inherit" x="696" y="120" text-anchor="middle" font-size="11" fill="var(--sv-muted)">⑤ 汇编</text>
<text font-family="inherit" x="16" y="182" font-size="14" font-weight="600" fill="var(--sv-ink)">抽象层级视角（各家编译器叫法不同）</text>
<rect x="14" y="204" width="160" height="66" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text font-family="inherit" x="94" y="230" text-anchor="middle" font-size="13" fill="var(--sv-ink)">图级 IR</text>
<text font-family="inherit" x="94" y="250" text-anchor="middle" font-size="11" fill="var(--sv-muted)">FX · StableHLO</text>
<rect x="207" y="204" width="160" height="66" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text font-family="inherit" x="287" y="230" text-anchor="middle" font-size="13" fill="var(--sv-ink)">张量级 IR</text>
<text font-family="inherit" x="287" y="250" text-anchor="middle" font-size="11" fill="var(--sv-muted)">TTIR · HLO · TIR</text>
<rect x="400" y="204" width="160" height="66" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text font-family="inherit" x="480" y="230" text-anchor="middle" font-size="13" fill="var(--sv-ink)">循环级 IR</text>
<text font-family="inherit" x="480" y="250" text-anchor="middle" font-size="11" fill="var(--sv-muted)">分块 + 内存规划</text>
<rect x="590" y="204" width="160" height="66" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text font-family="inherit" x="670" y="230" text-anchor="middle" font-size="13" fill="var(--sv-ink)">机器码</text>
<text font-family="inherit" x="670" y="250" text-anchor="middle" font-size="11" fill="var(--sv-muted)">PTX → SASS</text>
<line x1="174" y1="237" x2="203" y2="237" stroke="var(--sv-line)" marker-end="url(#compilers-arrow)"/>
<line x1="367" y1="237" x2="396" y2="237" stroke="var(--sv-line)" marker-end="url(#compilers-arrow)"/>
<line x1="560" y1="237" x2="586" y2="237" stroke="var(--sv-line)" marker-end="url(#compilers-arrow)"/>
<text font-family="inherit" x="16" y="310" font-size="12" fill="var(--sv-muted)">每下降一层，可用的数学语义更少、硬件约束更多；pass 只能在所属层级内做合法变换。</text>
<text font-family="inherit" x="16" y="334" font-size="12" fill="var(--sv-muted)">AOTAutograd 本身也可看成一次 lowering：带 autograd 语义的图 → 纯函数的前向与反向图。</text>
<text font-family="inherit" x="16" y="358" font-size="12" fill="var(--sv-muted)">越靠左越容易调试，越靠右越接近硬件真实行为。</text>
</svg><figcaption>图 1 · torch.compile 的五个环节（上）与通用编译器的四层抽象（下）：前者是后者的一种具体落地，并非一一对应</figcaption></figure>
<p>每一层都有自己的 IR（Intermediate Representation，中间表示）。越往上越接近「数学语义」，越往下越接近「硬件指令」。关键在于层与层之间靠 IR 契约解耦：图级 pass 不需要知道寄存器数量，代码生成不需要理解 autograd 语义。这也是 MLIR 这类基础设施的价值所在——它把「定义新 IR、写 pass、做层间转换」变成了可复用的框架。</p>
<p>一个容易忽略的细节：lowering 不是单向的。布局决策会反向影响融合选择，例如为了让矩阵乘的 epilogue 能被融合，编译器会保留输出矩阵的特定布局；融合后的 kernel 又可能要求某种对齐。真实编译器里常见多轮迭代：<b>布局传播 → 融合 → 再布局 → 再融合</b>。</p>
</section>

<section class="sec"><h2>三、IR 家族：FX、StableHLO、TTIR、MLIR</h2>
<p>这四个名字经常被并列提起，但它们不在同一个抽象层上，混着记很容易乱。</p>
<p><b>FX</b> 是 PyTorch 自带的 Python 级图表示，节点通常是一次 ATen 算子调用，可读、可改、可手写变换，Dynamo 的输出就是它。它的优点是贴近 PyTorch 语义、调试友好；缺点是绑定 PyTorch，不能直接描述硬件。</p>
<p><b>StableHLO</b> 是 OpenXLA 体系下稳定化的算子集与序列化格式，定位是「跨框架的交换层」。JAX、TensorFlow 以及 PyTorch/XLA 都往它上面落。它有意保持与具体设备无关，并带有版本化规范，这让不同版本的前端与后端能对接。</p>
<p><b>TTIR</b> 是 Triton 的 tile 级 IR。它的核心概念是「一个 program 处理一块数据」，用 <code>tl.load</code>、<code>tl.store</code>、<code>tl.dot</code> 描述块级数据流，往下再降到 TTGIR 与 LLVM IR。它比 HLO 更贴近 GPU 的分块执行模型，又不像 CUDA 那样要求手写线程索引。</p>
<p><b>MLIR</b> 严格说不是「一个 IR」，而是构建 IR 的基础设施：可扩展的 dialect（方言）机制、通用的 pass 管理、以及层间转换框架。<code>linalg</code>、<code>tensor</code>、<code>affine</code>、<code>gpu</code> 是常见 dialect。IREE、Triton 的编译器实现，以及不少自研编译器都建立在它之上；而 TVM 的 Relax、TIR 是自有 IR，并不基于 MLIR。把 MLIR 理解成「编译器界的 LLVM + 插件系统」更准确。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>IR</th><th>抽象层级</th><th>典型产出方</th><th>主要职责</th><th>与硬件的关系</th></tr></thead><tbody>
<tr><td>FX</td><td>Python 级计算图</td><td>torch.compile / Dynamo</td><td>捕获、图变换、可读性</td><td>无关</td></tr>
<tr><td>StableHLO</td><td>算子级计算图</td><td>JAX、TF、PyTorch/XLA</td><td>跨框架交换、版本兼容</td><td>无关</td></tr>
<tr><td>TTIR</td><td>tile 级数据流</td><td>Triton 前端</td><td>块级程序与内存访问</td><td>弱相关（面向 GPU 分块）</td></tr>
<tr><td>TIR</td><td>张量 + 循环级</td><td>TVM</td><td>调度原语、代码生成</td><td>可通过参数适配</td></tr>
<tr><td>MLIR</td><td>基础设施（多 dialect）</td><td>各家编译器</td><td>定义 IR、组织 pass</td><td>由 dialect 决定</td></tr>
<tr><td>LLVM IR</td><td>机器无关指令级</td><td>各家后端</td><td>指令选择、寄存器分配</td><td>强相关</td></tr>
</tbody></table></div>
<div class="callout callout--tip"><span class="callout__label">提示</span><div>看到「某编译器用 MLIR」时，要追问的是它用了哪些 dialect、在哪一层接入。MLIR 本身不决定优化能力，dialect 设计与 pass 质量才决定。</div></div>
</section>

<section class="sec"><h2>四、算子融合与内存规划</h2>
<p>融合（fusion）是编译器最直接的收益来源，按依赖关系可以分成几类。</p>
<ul>
<li><b>纵向融合</b>（producer-consumer）：上游算子的输出直接留在寄存器或共享内存里给下游用，不写回 HBM。逐元素链、reduce 加后续逐元素都属于这一类。</li>
<li><b>横向融合</b>（sibling）：把共享输入、迭代空间相同的若干独立算子放进同一个 kernel，减少启动次数并提高硬件利用率。Inductor 对 pointwise 算子做有限度的横向融合。</li>
<li><b>规约融合</b>（reduction fusion）：把 softmax、LayerNorm 这类「多趟 reduce + 逐元素」的结构合并，减少中间张量与同步次数。</li>
<li><b>尾声融合</b>（epilogue fusion）：矩阵乘的输出直接接 bias、激活、残差，避免写回再读。这类融合常由模板化后端（如 CUTLASS 模板）或专用 Triton kernel 承担。</li>
</ul>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="融合前后的计算图对比，未融合三个 kernel 与融合后一个 kernel 的访存差异">
<defs>
<marker id="compilers-arrow2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"/></marker>
</defs>
<text font-family="inherit" x="16" y="30" font-size="14" font-weight="600" fill="var(--sv-ink)">融合前：3 个逐元素 kernel 串联</text>
<circle cx="34" cy="88" r="18" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text font-family="inherit" x="34" y="93" text-anchor="middle" font-size="13" fill="var(--sv-ink)">x</text>
<rect x="70" y="66" width="96" height="44" rx="8" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text font-family="inherit" x="118" y="93" text-anchor="middle" font-size="12" fill="var(--sv-ink)">mul(x, 2)</text>
<circle cx="200" cy="88" r="18" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text font-family="inherit" x="200" y="93" text-anchor="middle" font-size="13" fill="var(--sv-ink)">t1</text>
<rect x="236" y="66" width="96" height="44" rx="8" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text font-family="inherit" x="284" y="93" text-anchor="middle" font-size="12" fill="var(--sv-ink)">add(t1, b)</text>
<circle cx="366" cy="88" r="18" fill="var(--sv-bg)" stroke="var(--sv-line)"/>
<text font-family="inherit" x="366" y="93" text-anchor="middle" font-size="13" fill="var(--sv-ink)">t2</text>
<rect x="402" y="66" width="96" height="44" rx="8" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text font-family="inherit" x="450" y="93" text-anchor="middle" font-size="12" fill="var(--sv-ink)">relu(t2)</text>
<circle cx="532" cy="88" r="18" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text font-family="inherit" x="532" y="93" text-anchor="middle" font-size="13" fill="var(--sv-ink)">y</text>
<line x1="53" y1="88" x2="66" y2="88" stroke="var(--sv-line)" marker-end="url(#compilers-arrow2)"/>
<line x1="166" y1="88" x2="178" y2="88" stroke="var(--sv-line)" marker-end="url(#compilers-arrow2)"/>
<line x1="218" y1="88" x2="232" y2="88" stroke="var(--sv-line)" marker-end="url(#compilers-arrow2)"/>
<line x1="332" y1="88" x2="344" y2="88" stroke="var(--sv-line)" marker-end="url(#compilers-arrow2)"/>
<line x1="384" y1="88" x2="398" y2="88" stroke="var(--sv-line)" marker-end="url(#compilers-arrow2)"/>
<line x1="498" y1="88" x2="510" y2="88" stroke="var(--sv-line)" marker-end="url(#compilers-arrow2)"/>
<text font-family="inherit" x="70" y="132" font-size="11" fill="var(--sv-muted)">HBM 两次</text>
<text font-family="inherit" x="236" y="132" font-size="11" fill="var(--sv-muted)">HBM 两次</text>
<text font-family="inherit" x="402" y="132" font-size="11" fill="var(--sv-muted)">HBM 两次</text>
<text font-family="inherit" x="16" y="164" font-size="12" fill="var(--sv-ink)">访存总量 = 3 × (读 4N + 写 4N) = 24N 字节（N 为元素数，fp32）</text>
<line x1="16" y1="182" x2="744" y2="182" stroke="var(--sv-line)" stroke-dasharray="4 4"/>
<text font-family="inherit" x="16" y="216" font-size="14" font-weight="600" fill="var(--sv-ink)">融合后：1 个 kernel</text>
<circle cx="120" cy="270" r="18" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text font-family="inherit" x="120" y="275" text-anchor="middle" font-size="13" fill="var(--sv-ink)">x</text>
<rect x="170" y="238" width="300" height="64" rx="10" fill="var(--sv-b2)" stroke="var(--sv-b)" stroke-width="2"/>
<text font-family="inherit" x="320" y="265" text-anchor="middle" font-size="13" fill="var(--sv-ink)">fused: out = relu(x * 2 + b)</text>
<text font-family="inherit" x="320" y="286" text-anchor="middle" font-size="11" fill="var(--sv-muted)">一个浅层 kernel，只读写一次显存</text>
<circle cx="510" cy="270" r="18" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text font-family="inherit" x="510" y="275" text-anchor="middle" font-size="13" fill="var(--sv-ink)">y</text>
<line x1="139" y1="270" x2="166" y2="270" stroke="var(--sv-line)" marker-end="url(#compilers-arrow2)"/>
<line x1="470" y1="270" x2="488" y2="270" stroke="var(--sv-line)" marker-end="url(#compilers-arrow2)"/>
<text font-family="inherit" x="16" y="336" font-size="12" fill="var(--sv-ink)">访存总量 = 读 4N + 写 4N = 8N 字节，理想加速上限 3×；实际还受启动开销、寄存器压力与并行度限制。</text>
</svg><figcaption>图 2 · k 个逐元素算子融合后，显存访问次数从 2k 次降为 2 次</figcaption></figure>
<div class="formula">设串联的逐元素算子个数为 k，处理 N 个 fp32 元素：<br>未融合访存 B_unfused = k × (4N + 4N) = 8kN 字节<br>融合后访存 B_fused = 4N + 4N = 8N 字节<br>理想加速上限 ≈ B_unfused / B_fused = k<br>代入 k = 3、N = 1e8、带宽 2.0 TB/s：1.2 ms → 0.4 ms</div>
<p>并非所有算子都能融合。当一个中间张量被多个下游消费且必须保留、上下游布局冲突、存在数据依赖的控制流，或者融合后寄存器与共享内存超限时，编译器会放弃融合。手工写 kernel 时为了「融合而融合」可能因占用率骤降而变慢，编译器也会踩这个坑，所以它需要代价模型而非规则表。</p>
<p>内存规划（memory planning）与布局是一体两面。编译器会为中间张量选择 stride 与排列顺序：卷积在 NCHW 与 NHWC（即 <code>channels_last</code>）下的访存效率差别很大，后者让通道维连续，更适配 Tensor Core 的加载模式；矩阵乘的 A、B 是否转置会决定能否使用高效的加载指令与 swizzle 方式。Inductor 的布局优化会为矩阵乘插入转置拷贝来换取更快的 kernel，但这笔拷贝成本必须被收益覆盖，所以它需要权衡而不是无脑转置。</p>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>融合不是免费的。每多留一个中间结果在寄存器里，占用率就下降一分；超过阈值后 GPU 无法隐藏访存延迟，融合反而变慢。看到「编译后某些层变慢」时，先怀疑寄存器压力与共享内存超限。</div></div>
</section>

<section class="sec"><h2>五、自动调优与一个 Triton kernel</h2>
<p>分块大小、线程数、流水深度这些参数没有通用最优值，它们随 GPU 型号、shape、dtype 变化。autotuning（自动调优）就是把这些参数当作搜索空间，用实测延迟挑最好的组合。</p>
<p>搜索空间由四部分组成：tile 形状（<code>BLOCK_M</code>、<code>BLOCK_N</code>、<code>BLOCK_K</code>）；线程与流水参数（<code>num_warps</code> 常见取 1、2、4、8，<code>num_stages</code> 常见取 1 到 5）；调度变体（split-K、<code>GROUP_M</code> 的遍历顺序）；以及是否走模板化后端。搜索策略各家用得不同：小空间直接穷举；大空间用代价模型或实测反馈引导搜索，TVM Ansor 用学习型代价模型配合进化搜索，Inductor 则提供坐标下降式的迭代调优。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="矩阵乘自动调优的二维搜索空间热力图">
<text font-family="inherit" x="16" y="26" font-size="14" font-weight="600" fill="var(--sv-ink)">autotune 搜索空间：颜色越深，实测延迟越低</text>
<text font-family="inherit" x="120" y="44" font-size="11" fill="var(--sv-muted)">深色区常在 128×128、warps=8、stages=3 附近</text>
<text font-family="inherit" x="30" y="200" font-size="12" fill="var(--sv-muted)" transform="rotate(-90 30 200)">BLOCK_N</text>
<text font-family="inherit" x="270" y="366" text-anchor="middle" font-size="12" fill="var(--sv-muted)">BLOCK_M（32 → 256）</text>
<rect x="120" y="52" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.12"/>
<rect x="169" y="52" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.18"/>
<rect x="218" y="52" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.25"/>
<rect x="267" y="52" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.30"/>
<rect x="316" y="52" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.22"/>
<rect x="365" y="52" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.16"/>
<rect x="120" y="101" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.20"/>
<rect x="169" y="101" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.35"/>
<rect x="218" y="101" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.50"/>
<rect x="267" y="101" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.58"/>
<rect x="316" y="101" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.44"/>
<rect x="365" y="101" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.28"/>
<rect x="120" y="150" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.30"/>
<rect x="169" y="150" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.55"/>
<rect x="218" y="150" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.72"/>
<rect x="267" y="150" width="42" height="42" rx="4" fill="var(--sv-b)" fill-opacity="0.85" stroke="var(--sv-b)" stroke-width="3"/>
<rect x="316" y="150" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.66"/>
<rect x="365" y="150" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.40"/>
<rect x="120" y="199" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.26"/>
<rect x="169" y="199" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.48"/>
<rect x="218" y="199" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.64"/>
<rect x="267" y="199" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.70"/>
<rect x="316" y="199" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.58"/>
<rect x="365" y="199" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.36"/>
<rect x="120" y="248" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.18"/>
<rect x="169" y="248" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.32"/>
<rect x="218" y="248" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.44"/>
<rect x="267" y="248" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.50"/>
<rect x="316" y="248" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.40"/>
<rect x="365" y="248" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.26"/>
<rect x="120" y="297" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.12"/>
<rect x="169" y="297" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.20"/>
<rect x="218" y="297" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.28"/>
<rect x="267" y="297" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.33"/>
<rect x="316" y="297" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.25"/>
<rect x="365" y="297" width="42" height="42" rx="4" fill="var(--sv-a)" fill-opacity="0.15"/>
<text font-family="inherit" x="436" y="60" font-size="13" font-weight="600" fill="var(--sv-ink)">搜索维度</text>
<text font-family="inherit" x="436" y="86" font-size="12" fill="var(--sv-ink)">tile 形状：BLOCK_M / N / K</text>
<text font-family="inherit" x="436" y="108" font-size="12" fill="var(--sv-ink)">线程：num_warps ∈ {1,2,4,8}</text>
<text font-family="inherit" x="436" y="130" font-size="12" fill="var(--sv-ink)">流水：num_stages ∈ {1..5}</text>
<text font-family="inherit" x="436" y="152" font-size="12" fill="var(--sv-ink)">调度：GROUP_M、split-K</text>
<text font-family="inherit" x="436" y="190" font-size="13" font-weight="600" fill="var(--sv-ink)">搜索成本</text>
<text font-family="inherit" x="436" y="214" font-size="12" fill="var(--sv-ink)">T ≈ 试验组数 × (编译 + 实测)</text>
<text font-family="inherit" x="436" y="236" font-size="11" fill="var(--sv-muted)">每组通常重复测多次取中位数</text>
<text font-family="inherit" x="436" y="258" font-size="11" fill="var(--sv-muted)">以避开缓存与频率抖动</text>
<text font-family="inherit" x="436" y="292" font-size="13" font-weight="600" fill="var(--sv-ink)">关键约束</text>
<text font-family="inherit" x="436" y="316" font-size="12" fill="var(--sv-ink)">key 变化即触发重新搜索</text>
<text font-family="inherit" x="436" y="338" font-size="11" fill="var(--sv-muted)">shape 越动态，命中率越低</text>
</svg><figcaption>图 3 · 分块大小的二维搜索空间示意，真机上每组配置都要实际编译并计时</figcaption></figure>
<p>Triton 的定位是「写块，不写线程」。你用 <code>tl.program_id</code> 取当前块编号，用 <code>tl.arange</code> 造出块内偏移，用 mask 处理边界；线程如何映射到元素、共享内存怎么分配、数据如何向量化，都由编译器负责。下面的例子把 <code>BLOCK</code> 与线程数交给 autotune，<code>key</code> 指定哪些参数变化时重新搜索。</p>
<pre class="code" data-lang="python"><code>import torch
import triton
import triton.language as tl

@triton.autotune(
    configs=[
        triton.Config({"BLOCK": 1024}, num_warps=4),
        triton.Config({"BLOCK": 2048}, num_warps=8),
        triton.Config({"BLOCK": 4096}, num_warps=8),
    ],
    key=["n_elements"],          # 长度变化时重新搜索
)
@triton.jit
def add_kernel(x_ptr, y_ptr, out_ptr, n_elements, BLOCK: tl.constexpr):
    pid = tl.program_id(0)
    offs = pid * BLOCK + tl.arange(0, BLOCK)
    mask = offs &lt; n_elements       # 边界保护，避免越界读写
    x = tl.load(x_ptr + offs, mask=mask)
    y = tl.load(y_ptr + offs, mask=mask)
    tl.store(out_ptr + offs, x + y, mask=mask)

def add(x, y):
    out = torch.empty_like(x)
    n = x.numel()
    grid = lambda meta: (triton.cdiv(n, meta["BLOCK"]),)
    add_kernel[grid](x, y, out, n)
    return out</code></pre>
<p>这段代码在 A100 上对 1 亿元素的 fp32 做加法，带宽利用率通常能达到峰值带宽的七成到九成（视版本与网格大小而定），它与前述「融合省访存」的道理完全一致：只读写一次显存，剩下的时间都在等带宽。若是矩阵乘，Triton 生成的 kernel 在多数常见 shape 上能达到 cuBLAS 的九成上下，但极端 shape（如 K 很小或 M 极小）仍需模板化后端或专门调优。</p>
<div class="callout callout--formula"><span class="callout__label">公式</span><div>调优是「用编译时间换运行时间」：T_total ≈ N_trials × (T_compile + T_bench)。服务冷启动敏感时，应把编译产物缓存到磁盘并在上线前预热，否则首个请求会承担全部搜索成本。</div></div>
</section>

<section class="sec"><h2>六、torch.compile 的完整流程</h2>
<p><code>torch.compile</code> 默认后端就是 TorchInductor，链路可以拆成四段；图 1 上半部分把末尾的代码生成与汇编拆成两步显示，共五个环节。</p>
<ol>
<li><b>Dynamo</b> 拦截 Python 字节码，把函数体追踪成 FX 图，同时生成 guard（守卫条件）：输入 shape、dtype、stride、<code>requires_grad</code>、以及影响分支的 Python 变量值。guard 是对「这次编译结果还能不能用」的断言。</li>
<li><b>AOTAutograd</b> 用 fake tensor 追踪前向，自动构造反向图，再把联合图切分成前向与反向两部分（min-cut partitioner）。它的作用是把带 autograd 语义的图降成纯函数图，因此也能顺带做算子替换与重计算。</li>
<li><b>Inductor</b> 把图降成循环级 IR，做调度（scheduler）与融合决策，然后分派：逐元素、规约、部分融合算子生成 Triton；矩阵乘等交给 cuBLAS 或 CUTLASS 模板；CPU 后端生成 C++ 与 OpenMP。</li>
<li><b>Triton 与 ptxas</b> 把 TTIR 降成 PTX，再由 ptxas 汇编为 SASS。编译产物按 guard 与配置缓存，命中则直接复用。</li>
</ol>
<pre class="code" data-lang="bash"><code># 观察图断点与重编译原因（最常用的两条日志）
TORCH_LOGS="graph_breaks,recompiles" python train.py

# 让编译器解释为什么没吃掉整张图
python -c "import torch; print(torch._dynamo.explain(fn)(x))"

# 要求整图编译，遇到断点直接报错，便于定位
torch.compile(model, fullgraph=True)

# 导出 Inductor 生成的 Triton 源码与调度信息
TORCH_COMPILE_DEBUG=1 python infer.py</code></pre>
<p>三种常用模式值得区分：<code>default</code> 平衡编译时间与运行速度；<code>reduce-overhead</code> 额外使用 CUDA Graphs 降低启动开销，适合小 batch 高频率调用，但对动态 shape 更敏感、显存占用更高；<code>max-autotune</code> 打开 Triton 配置搜索与模板选择，运行速度通常最好，代价是首次编译可能从数十秒涨到数分钟甚至更久（视模型规模与 GPU 而定）。</p>
<p>常见误解是「compile 一次就永久加速」。实际编译的是「在某一组 guard 下成立的一张图」：换 batch、换序列长度、走另一个分支，都可能让 guard 失效。理解这点，排障才有方向。</p>
</section>

<section class="sec"><h2>七、TVM 与 XLA 各自站在哪</h2>
<div class="duo"><div class="duo__col"><h4>TVM：可移植与可调度</h4><p>TVM 走端到端路线：Relay 图 IR（TVM Unity 中演进为 Relax）负责图级优化，TIR 负责张量与循环级表示，配合 split、tile、reorder、vectorize 等调度原语，以及 Ansor 这类自动调度器搜索 schedule。BYOC 可以把子图交给厂商库，运行时较轻量，适合多硬件部署与端侧。它的强项是「一套代码适配多种加速器」，弱项是与 PyTorch 动态图的衔接不如 Dynamo 自然。</p></div><div class="duo__col"><h4>XLA：整图全局优化</h4><p>XLA 是静态图编译器，核心 IR 是 HLO（现以 StableHLO 作为稳定交换格式），做代数化简、融合、布局分配，并通过 GSPMD 做多设备切分。JAX 的 <code>jit</code> 与 TensorFlow 的 <code>jit_compile</code> 都走 XLA，OpenXLA 与 PJRT 让它能对接多种加速器。强项是整图视角与多设备，弱项是动态 shape 支持有限、出错信息偏黑盒。</p></div></div>
<p>三者不是替代关系。Inductor 贴近 PyTorch 的 define-by-run 语义，追求「不改用户代码就有加速」；TVM 追求跨硬件可移植；XLA 追求全局优化与多设备一致性。实际系统里它们会组合出现：PyTorch/XLA 通过 StableHLO 对接 XLA，Inductor 也会复用 cuBLAS、CUTLASS 这些调好的算子。</p>
<p>选型可以问三个问题：硬件是否单一（是就优先厂商库加 Inductor）；是否需要端侧或多后端（需要就看 TVM 或 IREE）；是否已在 JAX/TF 生态且能接受静态 shape（是就用 XLA）。没有普适最优。</p>
</section>

<section class="sec"><h2>八、图断点、重编译与动态 shape</h2>
<p><b>图断点</b>（graph break）指 Dynamo 无法继续追踪，只能把图切成两段，断点之间回退到 eager。常见触发源包括：依赖张量数值的 Python 控制流（<code>if x.sum() &gt; 0</code>）、<code>.item()</code> 或 <code>.tolist()</code>、打印张量、调用未注册的 C 扩展、以及与 NumPy 的往返。断点本身不会让结果出错，但会切断融合机会，并让每一小段都承担 guard 检查与调度开销。</p>
<p><b>重编译</b>（recompilation）由 guard 失效触发：shape、dtype、stride、<code>requires_grad</code> 或某个 Python 常量变了，旧产物就不能用。PyTorch 为每条代码路径维护编译缓存，条目数上限由 <code>torch._dynamo.config.cache_size_limit</code> 控制，默认值较小（常见版本为 8，具体视版本而定）；超过上限后该路径直接回退 eager，于是出现「越跑越慢、日志里一直在编译」的现象。</p>
<figure class="fig"><svg viewBox="0 0 760 380" width="100%" role="img" aria-label="guard 命中与重编译、缓存上限回退 eager 的流程图">
<defs>
<marker id="compilers-arrow3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--sv-line)"/></marker>
</defs>
<text font-family="inherit" x="16" y="26" font-size="14" font-weight="600" fill="var(--sv-ink)">一次调用的决策路径</text>
<rect x="20" y="44" width="150" height="54" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text font-family="inherit" x="95" y="67" text-anchor="middle" font-size="12" fill="var(--sv-ink)">调用被编译的函数</text>
<text font-family="inherit" x="95" y="85" text-anchor="middle" font-size="11" fill="var(--sv-muted)">相同 Python 代码</text>
<rect x="210" y="44" width="150" height="54" rx="8" fill="var(--sv-a2)" stroke="var(--sv-line)"/>
<text font-family="inherit" x="285" y="67" text-anchor="middle" font-size="12" fill="var(--sv-ink)">检查已有 guard</text>
<text font-family="inherit" x="285" y="85" text-anchor="middle" font-size="11" fill="var(--sv-muted)">shape / dtype / stride</text>
<rect x="400" y="44" width="170" height="54" rx="8" fill="var(--sv-b2)" stroke="var(--sv-line)"/>
<text font-family="inherit" x="485" y="67" text-anchor="middle" font-size="12" fill="var(--sv-ink)">全部分支都命中？</text>
<text font-family="inherit" x="485" y="85" text-anchor="middle" font-size="11" fill="var(--sv-muted)">含 Python 常量值</text>
<rect x="610" y="44" width="134" height="54" rx="8" fill="var(--sv-c)" stroke="var(--sv-line)"/>
<text font-family="inherit" x="677" y="67" text-anchor="middle" font-size="12" fill="var(--sv-ink)">执行缓存 kernel</text>
<text font-family="inherit" x="677" y="85" text-anchor="middle" font-size="11" fill="var(--sv-muted)">零编译开销</text>
<rect x="390" y="150" width="170" height="54" rx="8" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text font-family="inherit" x="475" y="173" text-anchor="middle" font-size="12" fill="var(--sv-ink)">重新编译</text>
<text font-family="inherit" x="475" y="191" text-anchor="middle" font-size="11" fill="var(--sv-muted)">Dynamo → Inductor</text>
<rect x="180" y="150" width="170" height="54" rx="8" fill="var(--sv-a)" stroke="var(--sv-line)"/>
<text font-family="inherit" x="265" y="173" text-anchor="middle" font-size="12" fill="var(--sv-ink)">新 guard 与产物入缓存</text>
<text font-family="inherit" x="265" y="191" text-anchor="middle" font-size="11" fill="var(--sv-muted)">条目数 +1</text>
<rect x="20" y="150" width="140" height="54" rx="8" fill="var(--sv-panel)" stroke="var(--sv-line)"/>
<text font-family="inherit" x="90" y="173" text-anchor="middle" font-size="12" fill="var(--sv-ink)">条目数超上限？</text>
<text font-family="inherit" x="90" y="191" text-anchor="middle" font-size="11" fill="var(--sv-muted)">默认较小</text>
<rect x="20" y="270" width="140" height="54" rx="8" fill="var(--sv-bg)" stroke="var(--sv-b)" stroke-width="2"/>
<text font-family="inherit" x="90" y="293" text-anchor="middle" font-size="12" fill="var(--sv-ink)">该路径回退 eager</text>
<text font-family="inherit" x="90" y="311" text-anchor="middle" font-size="11" fill="var(--sv-muted)">性能回到基线</text>
<line x1="170" y1="71" x2="206" y2="71" stroke="var(--sv-line)" marker-end="url(#compilers-arrow3)"/>
<line x1="360" y1="71" x2="396" y2="71" stroke="var(--sv-line)" marker-end="url(#compilers-arrow3)"/>
<line x1="570" y1="71" x2="606" y2="71" stroke="var(--sv-line)" marker-end="url(#compilers-arrow3)"/>
<text font-family="inherit" x="588" y="62" font-size="11" fill="var(--sv-muted)">是</text>
<line x1="485" y1="98" x2="485" y2="146" stroke="var(--sv-line)" marker-end="url(#compilers-arrow3)"/>
<text font-family="inherit" x="496" y="126" font-size="11" fill="var(--sv-muted)">否</text>
<line x1="390" y1="177" x2="354" y2="177" stroke="var(--sv-line)" marker-end="url(#compilers-arrow3)"/>
<line x1="180" y1="177" x2="164" y2="177" stroke="var(--sv-line)" marker-end="url(#compilers-arrow3)"/>
<line x1="90" y1="204" x2="90" y2="266" stroke="var(--sv-line)" marker-end="url(#compilers-arrow3)"/>
<text font-family="inherit" x="100" y="242" font-size="11" fill="var(--sv-muted)">是</text>
<text font-family="inherit" x="340" y="300" font-size="12" fill="var(--sv-ink)">每个新的 (shape, dtype, stride, 常量) 组合</text>
<text font-family="inherit" x="340" y="322" font-size="12" fill="var(--sv-ink)">都可能是一条新的 guard 分支。</text>
</svg><figcaption>图 4 · guard 命中则零开销执行，未命中触发重编译，缓存条目超限后回退 eager</figcaption></figure>
<p><b>动态 shape</b> 是三类问题里最棘手的。编译器默认把维度当常量以便做常量折叠与向量化；一旦开启符号化（<code>dynamic=True</code> 或 <code>torch._dynamo.mark_dynamic</code>），维度成为运行时的符号值，tile 大小与网格计算都要在运行时求解，代码里会出现大量除法与取整。更麻烦的是 autotune：key 里含 shape，shape 一变就要重新搜索，缓存命中率骤降。工程上常用三种缓解手段：把 batch 分桶到少量固定值；对确实会变的维度做 <code>mark_dynamic</code> 并给出上下界提示；或者干脆 padding 到固定 shape，用浪费的算力换稳定的编译产物。</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>症状</th><th>最可能的原因</th><th>排查手段</th></tr></thead><tbody>
<tr><td>开了 compile 但速度没变</td><td>图断点导致大部分计算仍在 eager</td><td><code>TORCH_LOGS=graph_breaks</code>，或用 <code>fullgraph=True</code> 逼出断点</td></tr>
<tr><td>越跑越慢，日志一直编译</td><td>动态 shape 或可变常量触发重编译</td><td><code>TORCH_LOGS=recompiles</code> 看 guard 失败项</td></tr>
<tr><td>首个请求特别慢</td><td>编译与 autotune 的冷启动成本</td><td>上线前预热、持久化编译缓存目录</td></tr>
<tr><td>显存占用反而升高</td><td>融合增大寄存器压力或临时缓冲区</td><td>关掉 <code>max-autotune</code>，查看 Inductor 生成的 kernel</td></tr>
<tr><td>数值与 eager 有细微差异</td><td>融合改变了浮点运算的结合顺序</td><td>用 fp64 对照，评估误差是否在可接受范围</td></tr>
</tbody></table></div>
<div class="callout callout--warn"><span class="callout__label">注意</span><div>不要用「平均每步耗时」判断 compile 是否生效。第一次迭代包含编译时间，应当用预热后的稳态数据，并单独统计重编译次数。两个指标一起看，才能区分「没生效」和「生效了但一直在重编译」。</div></div>
<h3>自测</h3>
<details class="quiz"><summary>Q1 · 三个逐元素算子融合，为什么理论上限是 3 倍而不是 6 倍？</summary><div class="quiz__a">每个未融合 kernel 都要读一次、写一次显存，k 个算子共 2k 次访存（k 次读 + k 次写）；融合后只读输入、写输出，共 2 次。访存比是 2k/2 = k，所以上限是 3 倍。之所以不是「每个算子省一半」的 6 倍，是因为融合并没有减少输入与输出本身的那两次必要搬运。</div></details>
<details class="quiz"><summary>Q2 · 图断点之后，性能为什么可能比完全不开 compile 还差？</summary><div class="quiz__a">断点把图切成若干小段，每段都要做 guard 检查与调度分派，跨段的融合机会消失；首次运行还要为每段付编译成本。当分段很碎时，这些额外开销会超过融合收益，于是出现负优化。用 <code>fullgraph=True</code> 能快速暴露断点位置。</div></details>
<details class="quiz"><summary>Q3 · 为什么动态 shape 会同时拖慢编译与运行？</summary><div class="quiz__a">编译侧，符号维度阻止常量折叠与静态向量化，生成的代码要带运行时除法与边界判断；运行侧，不同 shape 触发不同 guard 与不同的 autotune key，缓存命中率下降、重编译增多。把 batch 分桶或 padding 到固定 shape，本质是用少量算力浪费换取稳定的编译产物。</div></details>
<h3>延伸阅读</h3>
<ul class="refs">
<li><b>Triton: An Intermediate Language and Compiler for Tiled Neural Network Computations</b> — Philippe Tillet, H. T. Kung, David Cox, MAPL 2019。tile 级 IR 与块编程模型的原始论文，理解 Triton 设计取舍的起点。</li>
<li><b>TVM: An Automated End-to-End Optimizing Compiler for Deep Learning</b> — Tianqi Chen et al., OSDI 2018。图 IR 加调度原语的完整方法论，也是自动调度思路的源头之一。</li>
<li><b>TorchInductor 文档与 PyTorch 官方教程</b> — PyTorch 团队。包含 define-by-run IR、调度与后端分派的实现说明，以及 torch.compile 的排障指南。</li>
<li><b>XLA 与 OpenXLA 文档</b> — OpenXLA 项目。HLO 语义、融合与布局分配策略，以及 PJRT 多后端接入方式的权威说明。</li>
<li><b>MLIR: Scaling Compiler Infrastructure for Domain Specific Computation</b> — Chris Lattner et al., CGO 2021。dialect 机制与多层 IR 基础设施的设计动机。</li>
</ul>
</section>`
};
