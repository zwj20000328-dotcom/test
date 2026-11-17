/* 自动生成：npm run build。请勿手工编辑，源数据在 content/graph.js 与 content/aiinfra/。 */
window.KB_DATA = {
  "site": {
    "name": "知栈",
    "en": "STACK ATLAS",
    "tagline": "把复杂的系统，拆成可以理解的一层层",
    "description": "一个关于计算机系统与 AI 基础设施的交互式知识地图，配有深度图文教程与轻量练习。"
  },
  "levels": [
    {
      "id": 0,
      "name": "全景",
      "en": "Orientation",
      "color": "#6366f1",
      "desc": "先建立地图，再谈细节。理解整条链路与性能直觉。"
    },
    {
      "id": 1,
      "name": "硬件",
      "en": "Hardware",
      "color": "#0ea5e9",
      "desc": "GPU、显存、互联与加速器：所有软件的物理边界。"
    },
    {
      "id": 2,
      "name": "单机优化",
      "en": "Kernels",
      "color": "#14b8a6",
      "desc": "CUDA、算子、精度与编译器：把一台机器榨干。"
    },
    {
      "id": 3,
      "name": "训练",
      "en": "Training",
      "color": "#f59e0b",
      "desc": "并行策略与工程细节：从单卡到万卡。"
    },
    {
      "id": 4,
      "name": "推理",
      "en": "Inference",
      "color": "#ec4899",
      "desc": "KV Cache、调度、解码与服务化：把模型变成产品。"
    },
    {
      "id": 5,
      "name": "平台",
      "en": "Platform",
      "color": "#8b5cf6",
      "desc": "调度、存储、可观测性与成本：让集群稳定赚钱。"
    },
    {
      "id": 6,
      "name": "前沿",
      "en": "Frontier",
      "color": "#ef4444",
      "desc": "MoE、长上下文、RL 与超大规模：正在发生的事。"
    }
  ],
  "tracks": [
    {
      "id": "aiinfra",
      "name": "AI Infra",
      "en": "AI Infrastructure",
      "status": "live",
      "num": "01",
      "desc": "从一颗 GPU 到十万卡集群，理解大模型背后的系统栈。31 篇深度教程，7 个层级，覆盖硬件、算子、训练、推理与平台。"
    },
    {
      "id": "os",
      "name": "计算机系统",
      "en": "Operating Systems",
      "status": "soon",
      "num": "02",
      "desc": "进程、内存、文件系统与虚拟化：所有软件的底座。"
    },
    {
      "id": "compile",
      "name": "编译原理",
      "en": "Compilers",
      "status": "soon",
      "num": "03",
      "desc": "从词法分析到 IR 与代码生成：程序如何变成机器指令。"
    },
    {
      "id": "dist",
      "name": "分布式系统",
      "en": "Distributed Systems",
      "status": "soon",
      "num": "04",
      "desc": "一致性、共识、复制与容错：多台机器的协作法则。"
    },
    {
      "id": "algo",
      "name": "算法与数据结构",
      "en": "Algorithms",
      "status": "soon",
      "num": "05",
      "desc": "复杂度、图论、动态规划与近似算法：计算的地形图。"
    },
    {
      "id": "net",
      "name": "计算机网络",
      "en": "Networking",
      "status": "soon",
      "num": "06",
      "desc": "从 TCP/IP 到数据中心网络：数据如何抵达。"
    }
  ],
  "paths": [
    {
      "id": "beginner",
      "name": "零基础入门",
      "desc": "从地图和性能直觉开始，走通硬件到推理的主干。",
      "steps": [
        "ai-infra-map",
        "three-bottlenecks",
        "gpu-architecture",
        "memory-hierarchy",
        "cuda-model",
        "inference-basics",
        "batching-scheduling",
        "serving-engines"
      ]
    },
    {
      "id": "training",
      "name": "训练工程师",
      "desc": "直奔并行策略与大规模训练工程，适合要做预训练或微调的人。",
      "steps": [
        "collective-comm",
        "data-parallel",
        "model-parallel",
        "zero-memory",
        "large-scale-training",
        "moe"
      ]
    },
    {
      "id": "inference",
      "name": "推理与部署",
      "desc": "把模型做成稳定的在线服务，关心延迟、吞吐和单位成本。",
      "steps": [
        "inference-basics",
        "batching-scheduling",
        "speculative-decoding",
        "quantized-inference",
        "serving-engines",
        "capacity-cost"
      ]
    },
    {
      "id": "platform",
      "name": "平台与运维",
      "desc": "面向集群、存储、监控与成本，保障大规模任务的稳定运行。",
      "steps": [
        "interconnect",
        "cluster-scheduling",
        "storage-data",
        "observability",
        "ultra-scale",
        "capacity-cost"
      ]
    }
  ],
  "topics": [
    {
      "slug": "ai-infra-map",
      "title": "AI Infra 全景图：从硅片到服务",
      "subtitle": "一张地图看清大模型背后的系统栈",
      "level": 0,
      "cluster": "全景",
      "tags": [
        "概览",
        "技术栈",
        "学习路径"
      ],
      "prereq": [],
      "summary": "用一张六层地图把大模型系统栈串起来：讲清训练与推理两条回路的差异、五类稀缺资源的配比、6ND 算力估算和一次请求的端到端路径，帮你建立分层定位与排障的直觉。",
      "keyPoints": [
        "AI Infra 是把硅片、显存、网络和电力转换成可训练、可计费 token 的工程层，边界是“既定模型如何高效跑在真实硬件上”。",
        "六层技术栈从硬件、驱动运行时、编译算子、框架并行、调度平台到应用，上层决策会穿透到底层。",
        "训练优化吞吐与 MFU，推理优化 TTFT、TPOT 与单位 token 成本，两者的瓶颈和手段不能照搬。",
        "用 6ND 可在半分钟内估出训练算力量级；推理 decode 受 HBM 带宽约束，连续批处理是核心杠杆。"
      ],
      "readingMinutes": 24,
      "hasContent": true,
      "chars": 10148
    },
    {
      "slug": "three-bottlenecks",
      "title": "算力、显存、带宽：三个永恒瓶颈",
      "subtitle": "用 Roofline 模型建立性能直觉",
      "level": 0,
      "cluster": "全景",
      "tags": [
        "Roofline",
        "算术强度",
        "性能模型"
      ],
      "prereq": [
        "ai-infra-map"
      ],
      "summary": "从算力、显存带宽、显存容量三堵墙出发，用算术强度与 Roofline 模型解释 prefill 与 decode 的性能差异，给出容量、延迟与吞吐的估算方法。",
      "keyPoints": [
        "算力墙、带宽墙、容量墙分别对应 FLOPS、bytes/s、bytes 三种资源，性能问题几乎都能归入其中之一",
        "算术强度 AI = FLOPs / Bytes，Roofline 用 min(峰值算力, AI × 带宽) 给出性能上界",
        "prefill 的 AI 约等于一次处理的 token 数，通常 compute-bound；decode 的 AI 约 1 FLOP/Byte，稳定落在 memory-bound",
        "KV Cache 同时消耗容量与带宽，且随 batch 线性增长，使 decode 的 AI 上限停在 2P/KV 附近，很难变成 compute-bound",
        "延迟与吞吐是两个独立目标，Amdahl 定律与并行效率决定了加机器能换来多少实际加速"
      ],
      "readingMinutes": 25,
      "hasContent": true,
      "chars": 10878
    },
    {
      "slug": "gpu-architecture",
      "title": "GPU 微架构：SM、Warp 与 Tensor Core",
      "subtitle": "理解 GPU 为什么快，以及什么时候不快",
      "level": 1,
      "cluster": "硬件",
      "tags": [
        "SIMT",
        "SM",
        "Tensor Core"
      ],
      "prereq": [
        "three-bottlenecks"
      ],
      "summary": "从 SIMT 执行模型出发，拆解 SM 结构、Warp 调度与延迟隐藏，实算 occupancy，讲清 Tensor Core、稀疏与降频的边界。",
      "keyPoints": [
        "thread/block/grid 如何映射到 SM 与 Warp，为什么 Warp 是真正的调度单位",
        "SM 的四个 sub-partition、寄存器堆、shared memory/L1 与 Warp scheduler 的分工",
        "用寄存器与 shared memory 实算 occupancy，理解延迟隐藏需要多少 Warp",
        "Tensor Core MMA 的 tile 数据流，以及 A100 到 B200 的 BF16 峰值、稀疏与降频影响"
      ],
      "readingMinutes": 27,
      "hasContent": true,
      "chars": 12108
    },
    {
      "slug": "memory-hierarchy",
      "title": "显存层级：从 HBM 到寄存器",
      "subtitle": "容量、带宽与延迟的三重约束",
      "level": 1,
      "cluster": "硬件",
      "tags": [
        "HBM",
        "SRAM",
        "合并访问"
      ],
      "prereq": [
        "gpu-architecture"
      ],
      "summary": "从寄存器到显存，拆解容量、带宽与延迟的数量级，讲清合并访问与 bank 冲突的成因，给出 KV 缓存估算与排障路径，帮你在优化前判断瓶颈在算力还是喂数。",
      "keyPoints": [
        "寄存器、shared memory/L1、L2、HBM 的容量、带宽、延迟数量级与 A100/H100/H200/B200 对比",
        "HBM 3D 堆叠、TSV、1024-bit 接口与 channel/pseudo-channel 结构",
        "合并访问与 bank conflict 的成因、识别指标与修复方法",
        "KV Cache 容量公式与显存墙的排障顺序"
      ],
      "readingMinutes": 24,
      "hasContent": true,
      "chars": 10541
    },
    {
      "slug": "interconnect",
      "title": "互联：PCIe、NVLink 与 InfiniBand",
      "subtitle": "决定并行策略上限的那根线",
      "level": 1,
      "cluster": "硬件",
      "tags": [
        "NVLink",
        "InfiniBand",
        "拓扑"
      ],
      "prereq": [
        "memory-hierarchy"
      ],
      "summary": "从显存到机内、再到跨机的三级带宽落差出发，讲清总线代际、GPU 直连域、无损网络与胖树拓扑的取舍，以及在网归约如何降低集合通信量，最后给出张量、流水、数据并行的放置与排障方法。",
      "keyPoints": [
        "PCIe 5.0 x16 单向约 63 GB/s，H100 的 NVLink 每向 450 GB/s，400 Gb/s IB 单向仅 50 GB/s，落差决定并行域",
        "NVLink 域（8 卡 HGX、72 卡 NVL72）是张量并行的天然上限；H100 上跨域后每向带宽掉约 9 倍，GB200 上落差更大",
        "rail-optimized 让同号 GPU 共享一条 rail，SHARP 把 all-reduce 的求和搬进交换机",
        "TP 放机内、PP 跨机、DP 跨集群，并用 NCCL 拓扑检查与 nccl-tests 基线验证"
      ],
      "readingMinutes": 25,
      "hasContent": true,
      "chars": 11015
    },
    {
      "slug": "accelerator-landscape",
      "title": "加速器版图：GPU、TPU、NPU 与 ASIC",
      "subtitle": "通用性与效率之间的光谱",
      "level": 1,
      "cluster": "硬件",
      "tags": [
        "TPU",
        "NPU",
        "ASIC"
      ],
      "prereq": [
        "gpu-architecture",
        "interconnect"
      ],
      "summary": "把 GPU、TPU、NPU、ASIC 放回同一条通用性-效率光谱，讲清脉动阵列、SRAM-only 与晶圆级的取舍，并给出以每百万 token 成本为准的选型框架。",
      "keyPoints": [
        "专用加速器的收益来自减少数据搬运，而不是把乘法器做得更快",
        "TPU 的脉动阵列用权重驻留换取数据复用，代价是依赖编译器静态排布",
        "Groq 的 SRAM-only 与 Cerebras 的晶圆级方案分别在赌带宽与赌规模",
        "选型要算每百万 token 的 TCO，软件迁移成本常被低估"
      ],
      "readingMinutes": 22,
      "hasContent": true,
      "chars": 8989
    },
    {
      "slug": "cuda-model",
      "title": "CUDA 编程与执行模型",
      "subtitle": "从 kernel 启动到指令调度",
      "level": 2,
      "cluster": "单机优化",
      "tags": [
        "CUDA",
        "Warp",
        "Stream"
      ],
      "prereq": [
        "gpu-architecture",
        "memory-hierarchy"
      ],
      "summary": "从 host/device 分离讲起，拆清三层索引与 Warp 调度，理清五种内存空间的生命周期，再用 vector add 与事件计时写出可运行、可排障的代码。",
      "keyPoints": [
        "能根据数据规模算出 grid 与 block，并写出带边界检查的全局索引",
        "理解 Warp 是硬件调度单位，能解释 divergence 为什么浪费发射槽",
        "分清 global/shared/register/local 的作用域与生命周期，正确使用 __syncthreads",
        "会用 nvcc 编译、用错误宏与 CUDA event 计时，并读懂 PTX/SASS 与常见报错"
      ],
      "readingMinutes": 29,
      "hasContent": true,
      "chars": 14235
    },
    {
      "slug": "kernel-optimization",
      "title": "Kernel 优化：Tiling、融合与 Occupancy",
      "subtitle": "把访存降下来，把利用率提上去",
      "level": 2,
      "cluster": "单机优化",
      "tags": [
        "Tiling",
        "算子融合",
        "Bank Conflict"
      ],
      "prereq": [
        "cuda-model",
        "memory-hierarchy"
      ],
      "summary": "从 Roofline 定位瓶颈，讲清 tiling、寄存器分块与双缓冲如何降流量、藏延迟，再拆解 bank conflict、算子融合与 occupancy 的取舍。",
      "keyPoints": [
        "先用算术强度和 Roofline 判断 memory-bound 还是 compute-bound，再决定优化方向",
        "shared memory tiling 把全局访存降为约 1/T，register blocking 降低 shared 读流量，双缓冲隐藏访存延迟",
        "bank conflict、padding 与 128-bit 向量化决定 shared 和 global 带宽能不能打满",
        "occupancy 与寄存器压力是权衡；Tensor Core 抬高算力屋顶，但更依赖数据复用"
      ],
      "readingMinutes": 31,
      "hasContent": true,
      "chars": 13638
    },
    {
      "slug": "profiling",
      "title": "性能剖析：Nsight 与 Roofline 实操",
      "subtitle": "先测量，再优化",
      "level": 2,
      "cluster": "单机优化",
      "tags": [
        "Nsight",
        "Profiling",
        "NCU"
      ],
      "prereq": [
        "cuda-model"
      ],
      "summary": "把“感觉慢”变成可复现的数字：nsys 找时间线空洞，ncu 读单 kernel 的吞吐、占用率与 stall，再用 Roofline 对照硬件峰值并给出瓶颈判定表。",
      "keyPoints": [
        "先定基线再动手：nsys 看整步时间线，ncu 看单 kernel，二者分工不可替代",
        "指标要成对读：DRAM 与 SM 吞吐、occupancy 与 stall 原因必须交叉判断",
        "Roofline 是天花板不是目标；每轮只改一个变量并用同一协议复测"
      ],
      "readingMinutes": 24,
      "hasContent": true,
      "chars": 9570
    },
    {
      "slug": "mixed-precision",
      "title": "混合精度与量化基础",
      "subtitle": "用更少的比特换更多的算力",
      "level": 2,
      "cluster": "单机优化",
      "tags": [
        "BF16",
        "FP8",
        "Autocast"
      ],
      "prereq": [
        "gpu-architecture"
      ],
      "summary": "比较 FP32、TF32、FP16、BF16、FP8 与 INT8 的范围和精度，讲清主权重、损失缩放、autocast 与累加精度，以及量化 scale 与粒度选择。",
      "keyPoints": [
        "指数位决定动态范围，尾数位决定相对精度；BF16 用 8 位指数换取与 FP32 相同的范围",
        "混合精度训练的三件套是 FP32 主权重、损失缩放（FP16 必需，BF16 通常不需要）与按算子 autocast，Tensor Core 的 FP32 累加不可省",
        "量化误差来自截断与舍入；per-channel 与 per-group 用更多 scale 换更低误差，G=128 的 FP32 scale 开销约 0.25 bit/权重"
      ],
      "readingMinutes": 27,
      "hasContent": true,
      "chars": 13028
    },
    {
      "slug": "flashattention",
      "title": "FlashAttention：把注意力装进 SRAM",
      "subtitle": "IO 感知的算法才是好算法",
      "level": 2,
      "cluster": "单机优化",
      "tags": [
        "Attention",
        "IO",
        "Online Softmax"
      ],
      "prereq": [
        "gpu-architecture",
        "memory-hierarchy"
      ],
      "summary": "标准注意力的瓶颈是 N×N 中间矩阵的 HBM 读写。FlashAttention 用 tiling、online softmax 与反向重算把这部分数据留在 SRAM。",
      "keyPoints": [
        "朴素注意力的瓶颈是 Θ(N²) 的 HBM 读写而非 FLOPs，算术强度只有 d/2，远低于 GPU 脊点。",
        "tiling 加 online softmax 让 N×N 中间矩阵永不落 HBM；反向用重算 P 换掉 O(N²) 显存。",
        "FA-2 改工作划分，FA-3 用 Hopper 的 TMA/WGMMA 做异步重叠；长序列收益最大，短序列需实测。"
      ],
      "readingMinutes": 24,
      "hasContent": true,
      "chars": 11163
    },
    {
      "slug": "compilers",
      "title": "编译器与算子生成",
      "subtitle": "Triton、TVM、XLA 与 TorchInductor",
      "level": 2,
      "cluster": "单机优化",
      "tags": [
        "Triton",
        "torch.compile",
        "MLIR"
      ],
      "prereq": [
        "cuda-model",
        "kernel-optimization"
      ],
      "summary": "从算子图到机器码，拆解 Dynamo、AOTAutograd、Inductor 与 Triton 的编译流水线，说明融合、布局与自动调参的收益来源，并给出性能回退的排障方法。",
      "keyPoints": [
        "编译器把算子清单改写成循环程序，收益主要来自融合、布局选择与自动调参，而不是某种魔法",
        "torch.compile 的链路是 Dynamo 抓图、AOTAutograd 补反向、Inductor 调度融合、Triton 生成机器码",
        "图断点、重编译与动态 shape 是落地时最常见的三类性能回退，均有可观测的日志手段"
      ],
      "readingMinutes": 25,
      "hasContent": true,
      "chars": 10470
    },
    {
      "slug": "collective-comm",
      "title": "集合通信：AllReduce 与拓扑感知",
      "subtitle": "分布式训练的隐形税",
      "level": 3,
      "cluster": "训练",
      "tags": [
        "NCCL",
        "AllReduce",
        "Ring"
      ],
      "prereq": [
        "interconnect"
      ],
      "summary": "集合通信是分布式训练的隐形税：从八种原语到 ring/tree 算法、NCCL 拓扑感知与 SHARP 卸载，算清 AllReduce 通信量并给出排障路径。",
      "keyPoints": [
        "八种集合原语的分工，以及 AllReduce = ReduceScatter + AllGather 这一核心恒等式",
        "ring AllReduce 的两阶段与 2(N−1)/N·S 通信量，以及 RH-D、tree、NVLS/SHARP 的适用边界",
        "用 NCCL 拓扑探测、busbw 指标和环境变量定位“加卡反而更慢”的通信根因"
      ],
      "readingMinutes": 25,
      "hasContent": true,
      "chars": 10600
    },
    {
      "slug": "data-parallel",
      "title": "数据并行与梯度同步",
      "subtitle": "最常用也最容易踩坑的并行方式",
      "level": 3,
      "cluster": "训练",
      "tags": [
        "DDP",
        "FSDP",
        "梯度累积"
      ],
      "prereq": [
        "collective-comm",
        "cuda-model"
      ],
      "summary": "数据并行把完整模型复制到每张卡，再同步梯度。讲清 DDP 的 bucket 重叠、梯度累积的等价条件、global batch 缩放与 FSDP 分片。",
      "keyPoints": [
        "数据并行不省单卡显存，只把墙钟时间按卡数摊薄；每步通信量只与参数量有关，与 batch 大小无关",
        "DDP 用 bucket 把梯度 all-reduce 藏进反向传播；FSDP 用 all-gather 与 reduce-scatter 把状态切成 1/N",
        "梯度累积的等价性有前提：loss 要按累积步数缩放、BN 统计会变、scheduler 只跟优化器步走",
        "global batch 决定学习率与泛化，改并行度时保持 global batch 不变，超参才可迁移",
        "drop_last、各 rank 步数一致、checkpoint 内容完整，决定了长训练能不能活着跑完"
      ],
      "readingMinutes": 25,
      "hasContent": true,
      "chars": 10252
    },
    {
      "slug": "model-parallel",
      "title": "模型并行：张量并行与流水并行",
      "subtitle": "把一层网络切开，把时间填满",
      "level": 3,
      "cluster": "训练",
      "tags": [
        "Tensor Parallel",
        "Pipeline Parallel",
        "Megatron"
      ],
      "prereq": [
        "collective-comm"
      ],
      "summary": "当参数与激活超过单卡显存，数据并行就不够用。讲清张量并行的列/行切分、流水并行的 1F1B 调度与气泡公式，并给出并行度选择。",
      "keyPoints": [
        "张量并行中列并行不通信，行并行在输出处做 all-reduce；Transformer 每层前向共 2 次",
        "TP 的 all-reduce 与每层计算强耦合，应限制在单个 NVLink 域内，通常取 4 或 8",
        "流水并行的气泡占比约为 (p-1)/(m+p-1)，m ≥ 4p 是常用起点",
        "1F1B 把在途 micro-batch 限制在约 p 个，激活显存不再随 m 线性增长",
        "3D 并行满足 world_size = TP × PP × DP，跨节点优先用 PP 和 DP"
      ],
      "readingMinutes": 22,
      "hasContent": true,
      "chars": 9639
    },
    {
      "slug": "zero-memory",
      "title": "ZeRO 与显存优化三件套",
      "subtitle": "算清每一字节，才能训得更大",
      "level": 3,
      "cluster": "训练",
      "tags": [
        "ZeRO",
        "Checkpointing",
        "Offload"
      ],
      "prereq": [
        "data-parallel"
      ],
      "summary": "从每参数 16 字节的显存账本出发，算清激活、ZeRO 三阶段切分与 offload 的带宽代价，给出 DeepSpeed 与 FSDP 配置和 OOM 排障清单。",
      "keyPoints": [
        "混合精度加 Adam 的参数态约 16 字节/参数，其中优化器状态占 12 字节；加激活与临时区通常到 20 字节以上",
        "分段 activation checkpointing 用一次额外前向把激活显存从 O(n) 降到 O(√n)，计算增加约 1/3",
        "ZeRO 依次切分优化器状态、梯度、参数；Stage 3 的通信量约为基线的 1.5 倍",
        "offload 的收益取决于 PCIe/NVMe 有效带宽能否被计算掩盖"
      ],
      "readingMinutes": 24,
      "hasContent": true,
      "chars": 10172
    },
    {
      "slug": "large-scale-training",
      "title": "3D 并行与万卡训练工程",
      "subtitle": "从能跑到跑得快、跑得稳",
      "level": 3,
      "cluster": "训练",
      "tags": [
        "3D Parallel",
        "MFU",
        "稳定性"
      ],
      "prereq": [
        "data-parallel",
        "model-parallel",
        "zero-memory"
      ],
      "summary": "从 3D 并行的组合约束讲起，拆解 MFU 与吞吐估算，给出 loss spike、checkpoint 与弹性训练的工程做法，并用两个千卡到万卡级案例说明取舍。",
      "keyPoints": [
        "总卡数 = TP × PP × DP；TP 必须留在 NVLink 域内，PP 与层数、DP 与全局 batch 互相牵制",
        "MFU = 6N × TPS / (G × 峰值)，稠密大模型实测多在 35%-45%，LLaMA-3 405B 在 16K 卡上约 38%",
        "PP 气泡约为 (p-1)/(m+p-1)，交错式流水用虚拟级数 v 把它压到 (p-1)/(v×m+p-1)",
        "loss spike 优先查数据与数值：z-loss、裁剪前梯度范数、Adam eps 与 update/param",
        "checkpoint 间隔约 √(2C/λ)，异步保存把阻塞压到秒级；弹性扩缩容必须保持全局 batch 不变"
      ],
      "readingMinutes": 23,
      "hasContent": true,
      "chars": 10351
    },
    {
      "slug": "inference-basics",
      "title": "推理基础：prefill、decode 与 KV Cache",
      "subtitle": "理解两阶段，才能谈优化",
      "level": 4,
      "cluster": "推理",
      "tags": [
        "KV Cache",
        "TTFT",
        "TPOT"
      ],
      "prereq": [
        "three-bottlenecks",
        "memory-hierarchy"
      ],
      "summary": "自回归推理分为 prefill 与 decode，前者算力受限，后者带宽受限。核心是 KV Cache 公式与 7B 算例、TTFT 与 TPOT 拆解，以及并发估算。",
      "keyPoints": [
        "prefill 并行处理整段提示词，算术强度约为 T，通常算力受限；decode 每步只处理 1 个 token，算术强度约为 batch size，通常带宽受限。",
        "KV Cache 大小 = 2 × 层数 × KV 头数 × head 维 × 序列长度 × 并发 × 字节数；7B/32 层/32 头/4K 序列在 fp16 下单条约 2 GiB，GQA-8 降到 512 MiB。",
        "TTFT 由排队与 prefill 主导，TPOT 由权重与 KV 的读取带宽主导；增大 batch 提升吞吐但抬高 TPOT，需要按 SLO 找拐点。",
        "显存决定并发上限，长上下文时 KV 可能比权重更占地方；流式返回只改善感知延迟，不改变总生成时间。"
      ],
      "readingMinutes": 25,
      "hasContent": true,
      "chars": 11038
    },
    {
      "slug": "batching-scheduling",
      "title": "批处理与调度：Continuous Batching 与 PagedAttention",
      "subtitle": "把 GPU 喂满的艺术",
      "level": 4,
      "cluster": "推理",
      "tags": [
        "Continuous Batching",
        "PagedAttention",
        "调度"
      ],
      "prereq": [
        "inference-basics"
      ],
      "summary": "静态批处理被 padding 与整批屏障拖累；连续批处理逐迭代调度，PagedAttention 分页治理 KV 碎片，叠加前缀缓存提升吞吐。",
      "keyPoints": [
        "静态 batch 的有效 token 占比为 ΣL/(B×L_max)，长度不齐时一半以上算力可能花在 padding 上。",
        "Orca 把调度粒度从请求降到迭代：每步淘汰完成者、准入新请求，batch 成员逐迭代变化。",
        "PagedAttention 用固定大小块加块表管理 KV，论文口径下把 KV 显存浪费从 60%–80% 压到 4% 以下，并支持共享与写时复制。",
        "chunked prefill 用预算 n+C ≤ T 把长 prefill 切片并与 decode 混批，压平 token 间延迟的长尾。"
      ],
      "readingMinutes": 24,
      "hasContent": true,
      "chars": 10408
    },
    {
      "slug": "speculative-decoding",
      "title": "投机解码：用小模型跑赢大模型",
      "subtitle": "用闲置算力摊薄权重访存",
      "level": 4,
      "cluster": "推理",
      "tags": [
        "Speculative Decoding",
        "Medusa",
        "EAGLE"
      ],
      "prereq": [
        "inference-basics"
      ],
      "summary": "投机解码用小模型先猜、目标模型并行校验，严格拒绝采样保证分布不变；加速比取决于接受率、草稿长度与成本，低并发长输出收益最大，工程上须端到端实测。",
      "keyPoints": [
        "decode 在 batch=1 时算术强度约为 1 FLOP/byte，只有 H100 脊点（约 295 FLOP/byte）的 1/295，瓶颈是权重访存而不是算力。",
        "小模型先猜 γ 个 token，目标模型一次并行校验 γ+1 个位置；严格拒绝采样保证输出分布与目标模型逐 token 采样完全一致。",
        "加速比 S ≈ E ÷ (1+γc)，E=(1−α^(γ+1))/(1−α)；α 低时加长草稿无益，c 接近 1 时投机失去意义。",
        "低并发、长输出、任务可预测时收益最大；大 batch、compute-bound、显存紧张时可能为负，必须用端到端 p50/p99 实测。"
      ],
      "readingMinutes": 24,
      "hasContent": true,
      "chars": 10107
    },
    {
      "slug": "serving-engines",
      "title": "推理引擎与服务化",
      "subtitle": "vLLM、SGLang、TensorRT-LLM 的选型与部署",
      "level": 4,
      "cluster": "推理",
      "tags": [
        "vLLM",
        "SGLang",
        "SLA"
      ],
      "prereq": [
        "batching-scheduling"
      ],
      "summary": "从五段流水线拆解引擎，对比 vLLM、SGLang、TensorRT-LLM 与 TGI 的取舍，并讲清 TP/EP 部署、KV-aware 路由、SLO 压测与灰度上线。",
      "keyPoints": [
        "引擎把请求拆成 API、tokenizer、scheduler、model runner、detokenizer 五段，延迟大头通常在排队与 prefill",
        "选型先看约束：通用与迭代速度选 vLLM/SGLang，模型固定且追极限选 TensorRT-LLM，HF 生态集成选 TGI",
        "张量并行（TP）应留在单机 NVLink 域内，跨机优先加副本；MoE 用专家并行（EP），代价是 all-to-all 通信",
        "KV-aware 路由把相同前缀钉在同一副本，prefix cache 命中率决定真实 prefill 成本",
        "SLO 用 TTFT/TPOT 的分位数定义，压测用开环到达，弹性指标看队列与 KV 占用而不是 GPU 利用率"
      ],
      "readingMinutes": 26,
      "hasContent": true,
      "chars": 11468
    },
    {
      "slug": "quantized-inference",
      "title": "量化推理落地",
      "subtitle": "GPTQ、AWQ、SmoothQuant 与 FP8",
      "level": 4,
      "cluster": "推理",
      "tags": [
        "GPTQ",
        "AWQ",
        "W8A8"
      ],
      "prereq": [
        "mixed-precision",
        "inference-basics"
      ],
      "summary": "从解码带宽出发，讲清 weight-only、W8A8 与 KV Cache 量化的差异，拆解 INT4 分组存储与激活离群值，并给出 GPTQ、AWQ、FP8 的落地方案。",
      "keyPoints": [
        "weight-only 只压权重，W8A8 连激活一起压，KV Cache 量化是独立开关，三者收益与风险不同",
        "INT4 普遍依赖 group-wise scale；G=128 时实际约 4.125 bit/权重，反量化必须与 GEMM 融合",
        "W4A16 的加速随 batch 增大而衰减，W8A8 与 FP8 才吃得到算力红利；精度要用任务集与长上下文回归验证"
      ],
      "readingMinutes": 23,
      "hasContent": true,
      "chars": 11373
    },
    {
      "slug": "cluster-scheduling",
      "title": "集群调度：Kubernetes 与 GPU 编排",
      "subtitle": "把正确的任务放到正确的卡上",
      "level": 5,
      "cluster": "平台",
      "tags": [
        "Kubernetes",
        "Gang Scheduling",
        "MIG"
      ],
      "prereq": [
        "large-scale-training"
      ],
      "summary": "从 K8s 的 GPU 资源模型出发，讲清 MIG 与共享调度的边界、gang 死锁的成因与解法、拓扑和队列配额怎么落地，并比较 Volcano、Kueue、Slurm。",
      "keyPoints": [
        "device plugin 如何把 GPU 变成整数型 extended resource，以及默认为什么不能共享",
        "MIG、time-slicing、MPS 的隔离与密度取舍，A100 80GB 的 7 个切片怎么算",
        "gang scheduling 的原子性条件、死锁场景，以及 minMember 与队列的配合",
        "拓扑感知、binpack/spread、配额优先级与训练 operator 的工程组合"
      ],
      "readingMinutes": 28,
      "hasContent": true,
      "chars": 13029
    },
    {
      "slug": "storage-data",
      "title": "数据管道与存储",
      "subtitle": "别让 GPU 等数据",
      "level": 5,
      "cluster": "平台",
      "tags": [
        "数据加载",
        "Checkpoint",
        "对象存储"
      ],
      "prereq": [
        "large-scale-training"
      ],
      "summary": "GPU 空转不是算力问题，而是数据没供上：数据管道的格式与预取决定供得上，checkpoint 的分片、异步与一致性决定恢复得了，带宽、并行文件系统与数据治理决定存得下。",
      "keyPoints": [
        "数据加载的瓶颈通常是小文件元数据、CPU 解码与网络尾延迟，而不是字节带宽；文本训练每节点持续读往往只有 0.3 MB/s 量级",
        "分片格式（tar/WebDataset、Parquet）用顺序读换吞吐；预取深度 D ≥ ⌈t_io/t_compute⌉+1，worker 并行度必须覆盖 t_io",
        "checkpoint 的停顿在快照，风险在一致性：分片写、后台写、manifest 原子提交三者缺一不可",
        "7B 混合精度训练状态约 112 GB、70B 约 1.12 TB；按每参数 16 字节估算容量与写带宽",
        "先把数据等待占 step 的比例压到 5% 以下，再谈更深的存储优化"
      ],
      "readingMinutes": 23,
      "hasContent": true,
      "chars": 9677
    },
    {
      "slug": "observability",
      "title": "可观测性与故障诊断",
      "subtitle": "当 1000 张卡里有一张在拖后腿",
      "level": 5,
      "cluster": "平台",
      "tags": [
        "监控",
        "NCCL Hang",
        "XID"
      ],
      "prereq": [
        "cluster-scheduling",
        "collective-comm"
      ],
      "summary": "把“训练莫名变慢”拆成证据链：四层监控看什么，XID、ECC、NVLink CRC 与 IB 错误怎么读，再用决策树分流 hang、慢节点、OOM 与数据饥饿，以及隔离与演练方法。",
      "keyPoints": [
        "同步训练的步时由最慢的 rank 决定：单卡慢 20% 会让全局有效算力降到约 83%，且往往没有任何报错",
        "监控要按爆炸半径分层：硬件、节点、任务、服务各自回答不同问题，采样频率与保留期也不同",
        "硬件指标看趋势不看单点：新 XID 必须归因，DBE 零容忍，CRC 与 symbol errors 看是否单调增长",
        "诊断先分叉 hang 与 slow，再按 rank 对比步时；watchdog 与自动隔离必须有复核、熔断和留证"
      ],
      "readingMinutes": 25,
      "hasContent": true,
      "chars": 10933
    },
    {
      "slug": "capacity-cost",
      "title": "容量规划、成本与能效",
      "subtitle": "把算力当成钱来管",
      "level": 5,
      "cluster": "平台",
      "tags": [
        "成本",
        "容量规划",
        "PUE"
      ],
      "prereq": [
        "serving-engines",
        "large-scale-training"
      ],
      "summary": "把 GPU 小时、MFU、每百万 token 成本、PUE 与利用率串成一套能算的账：从训练与推理的成本模型，到容量规划、租买与 spot 决策，再到优化杠杆与成本归因。",
      "keyPoints": [
        "每有效 GPU·h 成本 = 时价 ÷ 有效利用率；MFU、集群利用率与 PUE 这些分母比标价更能决定账单",
        "训练用 6ND 估 GPU·h，推理用 277.8 × 时价 ÷ 输出吞吐 估每百万 token 成本，两者口径不可混用",
        "容量规划从峰值 QPS 与 Little 定律推并发，再用 KV 显存和单副本压测双向夹逼副本数，并留出故障域",
        "先提利用率与批处理，再谈量化、缓存与电价；归因必须把闲置与碎片摊进成本"
      ],
      "readingMinutes": 23,
      "hasContent": true,
      "chars": 9681
    },
    {
      "slug": "moe",
      "title": "MoE：稀疏激活的训练与推理",
      "subtitle": "用参数换质量，用路由换算力",
      "level": 6,
      "cluster": "前沿",
      "tags": [
        "MoE",
        "Expert Parallel",
        "DeepSeek-V3"
      ],
      "prereq": [
        "model-parallel",
        "collective-comm"
      ],
      "summary": "MoE 用路由让每 token 只激活少数专家，使总参数与计算解耦。本篇讲 gating、容量与丢 token、负载均衡、EP all-to-all、训练稳定性与推理显存。",
      "keyPoints": [
        "MoE 只把 FFN 换成 E 个专家，每 token 选 k 个，总参数随 E 增长而单 token 计算只随 k 增长",
        "capacity factor 决定每个专家的缓冲上限，太小会丢 token，太大会浪费算力和显存",
        "辅助损失用梯度压均衡，DeepSeek-V3 改用不参与反传的专家偏置，避免和语言建模目标抢梯度",
        "EP 每层两次 all-to-all，每 token 每方向流量约 k×H×b 字节，跨节点 IB 是主要瓶颈",
        "推理显存按总参数算：DeepSeek-V3 FP8 约 671 GB，单台 8×H800 没有余量，实用至少 16 卡"
      ],
      "readingMinutes": 26,
      "hasContent": true,
      "chars": 11433
    },
    {
      "slug": "long-context",
      "title": "长上下文基础设施",
      "subtitle": "从 4K 到 1M 的代价",
      "level": 6,
      "cluster": "前沿",
      "tags": [
        "RoPE",
        "MLA",
        "Ring Attention"
      ],
      "prereq": [
        "flashattention",
        "inference-basics"
      ],
      "summary": "长上下文成本随阶段切换：短序列看 KV 容量，数万 token 后注意力平方项主导，再远则受位置外推与有效利用率限制。重点是 RoPE/YaRN、KV 压缩、稀疏检索与序列并行。",
      "keyPoints": [
        "8B 模型在约 3 万 token 处（QKᵀ/PV 按完整矩阵计；计入因果掩码约 6 万），注意力的 4N²dHL 项超过其余部分的 2NP 项；此前 KV 容量是主角，此后平方项主导 prefill。",
        "RoPE 外推不是改个配置就完事：PI、NTK 缩放与 YaRN 分别改位置、频率与温度，训练与推理的缩放配置必须一致。",
        "GQA 靠共享 KV 头把 cache 降到 1/G，MLA 靠低秩潜向量加解耦 RoPE 把每层每 token 压到数百个数；稀疏与检索改变的是连接图，不是免费的容量。",
        "Ring attention 把序列切到 P 张卡上、K/V 绕环传递并与分块计算重叠；P 越大每卡算术强度越低，通信与负载均衡决定收益。",
        "宣称的上下文长度不等于有效长度：单针召回会饱和，必须用多针、多跳、聚合与位置扫描来验收。"
      ],
      "readingMinutes": 27,
      "hasContent": true,
      "chars": 11351
    },
    {
      "slug": "rl-infra",
      "title": "RL 训练基础设施",
      "subtitle": "当生成比训练更贵",
      "level": 6,
      "cluster": "前沿",
      "tags": [
        "RLHF",
        "GRPO",
        "Rollout"
      ],
      "prereq": [
        "serving-engines",
        "large-scale-training"
      ],
      "summary": "算清 PPO 四模型与 GRPO 的显存账，讲透 rollout 与训练引擎分离、权重同步、异步 staleness、稳定性与容量规划，并给出框架选型建议。",
      "keyPoints": [
        "RL 训练把生成放进训练循环，rollout 是 memory-bound 的低 MFU 负载，长序列任务中常占总墙钟一半以上",
        "PPO 四模型在 7B 全参数下约 252 GB 静态显存，GRPO 去掉 critic 与 RM 后降到约 126 GB（规则奖励时）",
        "rollout 与训练必须用不同引擎，权重同步的带宽与并行度重切分决定每步开销",
        "异步把串行等待变成流水线，代价是 m 步 staleness 与重要性采样修正",
        "稳定性问题多来自 KL 系数、clip 范围、奖励被钻空子，以及两套引擎的 logprob 不一致"
      ],
      "readingMinutes": 26,
      "hasContent": true,
      "chars": 11491
    },
    {
      "slug": "ultra-scale",
      "title": "十万卡集群与网络架构",
      "subtitle": "规模本身就是一种技术",
      "level": 6,
      "cluster": "前沿",
      "tags": [
        "大规模集群",
        "无损网络",
        "Goodput"
      ],
      "prereq": [
        "interconnect",
        "large-scale-training"
      ],
      "summary": "从四层拓扑与 NVL72 出发，拆解十万卡规模下的无损网络、MTBF、goodput 分解、checkpoint 重启与液冷电力，给出可量化的容量规划与运维口径。",
      "keyPoints": [
        "十万卡的第一指标不是峰值算力而是 goodput：MFU × 有效时间比例 × 回滚存活率",
        "按 Llama 3 公开口径外推，十万卡约每 30 分钟一次非计划中断，可靠性必须按统计规律设计",
        "PFC 只做最后防线，常态靠 ECN/DCQCN；多打一与 all-to-all 的尾延迟比平均带宽更致命",
        "checkpoint 间隔约 √(2×C×MTBF)；NVL72 用铜背板换掉光模块，代价是 120 kW 机柜与整柜故障域"
      ],
      "readingMinutes": 23,
      "hasContent": true,
      "chars": 10106
    },
    {
      "slug": "ai-infra-future",
      "title": "趋势：AI Infra 的下一个五年",
      "subtitle": "从训练为中心到推理为中心",
      "level": 6,
      "cluster": "前沿",
      "tags": [
        "趋势",
        "技术雷达",
        "推理成本"
      ],
      "prereq": [
        "moe",
        "ultra-scale"
      ],
      "summary": "训练决定模型能否做出来，推理决定它能否被用得起。拆解推理成本的四个乘数、超节点与光互连、近存计算、编译器收敛与软硬协同，并给出一张可用于决策的技术雷达。",
      "keyPoints": [
        "训练以一次性资本支出为主，推理成本随调用量增长、主要体现为运营支出；使用量增长、推理模型与 agent 三者叠加，把优化重心推向单位 token 成本",
        "成本下降是算法、硬件、系统、设施四个乘数相乘的结果；先把 batch 与缓存命中打满，再考虑换芯片",
        "机柜级超节点、CPO 与近存计算都在缩短数据搬运路径；代价分别是功耗与冷却、良率与可维护性、软件栈成熟度",
        "技术雷达按现在可用、三年内、更远分层，只用于决策与接口预留，不作为确定预测"
      ],
      "readingMinutes": 22,
      "hasContent": true,
      "chars": 9200
    }
  ],
  "stats": {
    "topics": 31,
    "levels": 7,
    "written": 31,
    "minutes": 771,
    "diagrams": 111,
    "words": 265505
  }
};
