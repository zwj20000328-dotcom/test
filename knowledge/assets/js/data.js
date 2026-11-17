/* 自动生成：npm run build。请勿手工编辑，源数据在 content/graph.js 与 content/<track>/。 */
window.KB_DATA = {
  "site": {
    "name": "知栈",
    "en": "STACK ATLAS",
    "tagline": "把复杂的系统，拆成可以理解的一层层",
    "description": "一个关于计算机系统、编程语言与 AI 基础设施的交互式知识地图，配有深度图文教程与轻量练习。"
  },
  "tracks": [
    {
      "id": "aiinfra",
      "name": "AI Infra",
      "en": "AI Infrastructure",
      "status": "live",
      "num": "01",
      "desc": "从一颗 GPU 到十万卡集群，理解大模型背后的系统栈。31 篇深度教程，7 个层级，覆盖硬件、算子、训练、推理与平台。",
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
      "topicSlugs": [
        "ai-infra-map",
        "three-bottlenecks",
        "gpu-architecture",
        "memory-hierarchy",
        "interconnect",
        "accelerator-landscape",
        "cuda-model",
        "kernel-optimization",
        "profiling",
        "mixed-precision",
        "flashattention",
        "compilers",
        "collective-comm",
        "data-parallel",
        "model-parallel",
        "zero-memory",
        "large-scale-training",
        "inference-basics",
        "batching-scheduling",
        "speculative-decoding",
        "serving-engines",
        "quantized-inference",
        "cluster-scheduling",
        "storage-data",
        "observability",
        "capacity-cost",
        "moe",
        "long-context",
        "rl-infra",
        "ultra-scale",
        "ai-infra-future"
      ],
      "stats": {
        "topics": 31,
        "written": 31,
        "minutes": 771,
        "words": 265228,
        "diagrams": 111
      }
    },
    {
      "id": "cpp",
      "name": "C++",
      "en": "Modern C++",
      "status": "live",
      "num": "02",
      "desc": "从语法、对象模型到泛型、并发与工程化，建立现代 C++ 的心智模型。33 篇深度教程，7 个层级，配内存布局与调用链图解。",
      "levels": [
        {
          "id": 0,
          "name": "全景",
          "en": "Orientation",
          "color": "#6366f1",
          "desc": "先建立编译模型与语言地图，再进入语法细节。"
        },
        {
          "id": 1,
          "name": "语言核心",
          "en": "Core Language",
          "color": "#0ea5e9",
          "desc": "类型、指针、函数、类与多态：把语法变成心智模型。"
        },
        {
          "id": 2,
          "name": "对象与资源",
          "en": "Objects & Resources",
          "color": "#14b8a6",
          "desc": "生命周期、所有权、内存与异常：C++ 的真正难点。"
        },
        {
          "id": 3,
          "name": "泛型与标准库",
          "en": "Templates & STL",
          "color": "#f59e0b",
          "desc": "模板、constexpr、容器与算法：写一次，用很多次。"
        },
        {
          "id": 4,
          "name": "并发与性能",
          "en": "Concurrency & Perf",
          "color": "#ec4899",
          "desc": "线程、内存序、协程与性能工程：把机器用满。"
        },
        {
          "id": 5,
          "name": "工程化",
          "en": "Engineering",
          "color": "#8b5cf6",
          "desc": "构建、测试、调试、ABI 与 API：让代码活得更久。"
        },
        {
          "id": 6,
          "name": "深入与演进",
          "en": "Deep Dive",
          "color": "#ef4444",
          "desc": "Modules、标准演进与生态：下一步往哪走。"
        }
      ],
      "paths": [
        {
          "id": "beginner",
          "name": "零基础入门",
          "desc": "从编译模型开始，走通类型、指针、函数、类与标准库。",
          "steps": [
            "cpp-map",
            "build-to-run",
            "types-conversions",
            "pointers-const",
            "functions-odr",
            "classes-lifecycle",
            "copy-move-semantics",
            "stl-containers"
          ]
        },
        {
          "id": "modern",
          "name": "现代 C++",
          "desc": "补齐值语义、所有权、模板与编译期计算，写出地道的 C++。",
          "steps": [
            "value-categories",
            "smart-pointers",
            "templates-basics",
            "templates-advanced",
            "constexpr",
            "stl-algorithms",
            "api-design"
          ]
        },
        {
          "id": "concurrency",
          "name": "并发与性能",
          "desc": "从 RAII 出发，掌握线程、内存序、协程与性能工程。",
          "steps": [
            "raii",
            "concurrency-basics",
            "atomics-memory-order",
            "async-coroutines",
            "performance"
          ]
        },
        {
          "id": "engineering",
          "name": "工程化",
          "desc": "构建、测试、调试、ABI 与接口设计，让项目能长期维护。",
          "steps": [
            "build-systems",
            "testing-sanitizers",
            "debugging",
            "abi-linking",
            "api-design"
          ]
        }
      ],
      "topicSlugs": [
        "cpp-map",
        "build-to-run",
        "types-conversions",
        "pointers-const",
        "functions-odr",
        "classes-lifecycle",
        "copy-move-semantics",
        "operator-overloading",
        "inheritance-vtable",
        "raii",
        "smart-pointers",
        "value-categories",
        "memory-layout",
        "allocation",
        "exceptions",
        "undefined-behavior",
        "templates-basics",
        "templates-advanced",
        "constexpr",
        "stl-containers",
        "stl-algorithms",
        "string-view-format",
        "concurrency-basics",
        "atomics-memory-order",
        "async-coroutines",
        "performance",
        "build-systems",
        "testing-sanitizers",
        "debugging",
        "abi-linking",
        "api-design",
        "modules",
        "cpp-evolution"
      ],
      "stats": {
        "topics": 33,
        "written": 33,
        "minutes": 868,
        "words": 300007,
        "diagrams": 118
      }
    },
    {
      "id": "os",
      "name": "计算机系统",
      "en": "Operating Systems",
      "status": "soon",
      "num": "03",
      "desc": "进程、内存、文件系统与虚拟化：所有软件的底座。",
      "levels": [],
      "paths": [],
      "topicSlugs": [],
      "stats": {
        "topics": 0,
        "written": 0,
        "minutes": 0,
        "words": 0,
        "diagrams": 0
      }
    },
    {
      "id": "dist",
      "name": "分布式系统",
      "en": "Distributed Systems",
      "status": "soon",
      "num": "04",
      "desc": "一致性、共识、复制与容错：多台机器的协作法则。",
      "levels": [],
      "paths": [],
      "topicSlugs": [],
      "stats": {
        "topics": 0,
        "written": 0,
        "minutes": 0,
        "words": 0,
        "diagrams": 0
      }
    },
    {
      "id": "algo",
      "name": "算法与数据结构",
      "en": "Algorithms",
      "status": "soon",
      "num": "05",
      "desc": "复杂度、图论、动态规划与近似算法：计算的地形图。",
      "levels": [],
      "paths": [],
      "topicSlugs": [],
      "stats": {
        "topics": 0,
        "written": 0,
        "minutes": 0,
        "words": 0,
        "diagrams": 0
      }
    },
    {
      "id": "net",
      "name": "计算机网络",
      "en": "Networking",
      "status": "soon",
      "num": "06",
      "desc": "从 TCP/IP 到数据中心网络：数据如何抵达。",
      "levels": [],
      "paths": [],
      "topicSlugs": [],
      "stats": {
        "topics": 0,
        "written": 0,
        "minutes": 0,
        "words": 0,
        "diagrams": 0
      }
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
      "track": "aiinfra",
      "summary": "用一张六层地图把大模型系统栈串起来：讲清训练与推理两条回路的差异、五类稀缺资源的配比、6ND 算力估算和一次请求的端到端路径，帮你建立分层定位与排障的直觉。",
      "keyPoints": [
        "AI Infra 是把硅片、显存、网络和电力转换成可训练、可计费 token 的工程层，边界是“既定模型如何高效跑在真实硬件上”。",
        "六层技术栈从硬件、驱动运行时、编译算子、框架并行、调度平台到应用，上层决策会穿透到底层。",
        "训练优化吞吐与 MFU，推理优化 TTFT、TPOT 与单位 token 成本，两者的瓶颈和手段不能照搬。",
        "用 6ND 可在半分钟内估出训练算力量级；推理 decode 受 HBM 带宽约束，连续批处理是核心杠杆。"
      ],
      "readingMinutes": 24,
      "hasContent": true,
      "chars": 8041
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
      "track": "aiinfra",
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
      "chars": 8854
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
      "track": "aiinfra",
      "summary": "从 SIMT 执行模型出发，拆解 SM 结构、Warp 调度与延迟隐藏，实算 occupancy，讲清 Tensor Core、稀疏与降频的边界。",
      "keyPoints": [
        "thread/block/grid 如何映射到 SM 与 Warp，为什么 Warp 是真正的调度单位",
        "SM 的四个 sub-partition、寄存器堆、shared memory/L1 与 Warp scheduler 的分工",
        "用寄存器与 shared memory 实算 occupancy，理解延迟隐藏需要多少 Warp",
        "Tensor Core MMA 的 tile 数据流，以及 A100 到 B200 的 BF16 峰值、稀疏与降频影响"
      ],
      "readingMinutes": 27,
      "hasContent": true,
      "chars": 9604
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
      "track": "aiinfra",
      "summary": "从寄存器到显存，拆解容量、带宽与延迟的数量级，讲清合并访问与 bank 冲突的成因，给出 KV 缓存估算与排障路径，帮你在优化前判断瓶颈在算力还是喂数。",
      "keyPoints": [
        "寄存器、shared memory/L1、L2、HBM 的容量、带宽、延迟数量级与 A100/H100/H200/B200 对比",
        "HBM 3D 堆叠、TSV、1024-bit 接口与 channel/pseudo-channel 结构",
        "合并访问与 bank conflict 的成因、识别指标与修复方法",
        "KV Cache 容量公式与显存墙的排障顺序"
      ],
      "readingMinutes": 24,
      "hasContent": true,
      "chars": 7903
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
      "track": "aiinfra",
      "summary": "从显存到机内、再到跨机的三级带宽落差出发，讲清总线代际、GPU 直连域、无损网络与胖树拓扑的取舍，以及在网归约如何降低集合通信量，最后给出张量、流水、数据并行的放置与排障方法。",
      "keyPoints": [
        "PCIe 5.0 x16 单向约 63 GB/s，H100 的 NVLink 每向 450 GB/s，400 Gb/s IB 单向仅 50 GB/s，落差决定并行域",
        "NVLink 域（8 卡 HGX、72 卡 NVL72）是张量并行的天然上限；H100 上跨域后每向带宽掉约 9 倍，GB200 上落差更大",
        "rail-optimized 让同号 GPU 共享一条 rail，SHARP 把 all-reduce 的求和搬进交换机",
        "TP 放机内、PP 跨机、DP 跨集群，并用 NCCL 拓扑检查与 nccl-tests 基线验证"
      ],
      "readingMinutes": 25,
      "hasContent": true,
      "chars": 8839
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
      "track": "aiinfra",
      "summary": "把 GPU、TPU、NPU、ASIC 放回同一条通用性-效率光谱，讲清脉动阵列、SRAM-only 与晶圆级的取舍，并给出以每百万 token 成本为准的选型框架。",
      "keyPoints": [
        "专用加速器的收益来自减少数据搬运，而不是把乘法器做得更快",
        "TPU 的脉动阵列用权重驻留换取数据复用，代价是依赖编译器静态排布",
        "Groq 的 SRAM-only 与 Cerebras 的晶圆级方案分别在赌带宽与赌规模",
        "选型要算每百万 token 的 TCO，软件迁移成本常被低估"
      ],
      "readingMinutes": 22,
      "hasContent": true,
      "chars": 7532
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
      "track": "aiinfra",
      "summary": "从 host/device 分离讲起，拆清三层索引与 Warp 调度，理清五种内存空间的生命周期，再用 vector add 与事件计时写出可运行、可排障的代码。",
      "keyPoints": [
        "能根据数据规模算出 grid 与 block，并写出带边界检查的全局索引",
        "理解 Warp 是硬件调度单位，能解释 divergence 为什么浪费发射槽",
        "分清 global/shared/register/local 的作用域与生命周期，正确使用 __syncthreads",
        "会用 nvcc 编译、用错误宏与 CUDA event 计时，并读懂 PTX/SASS 与常见报错"
      ],
      "readingMinutes": 29,
      "hasContent": true,
      "chars": 9842
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
      "track": "aiinfra",
      "summary": "从 Roofline 定位瓶颈，讲清 tiling、寄存器分块与双缓冲如何降流量、藏延迟，再拆解 bank conflict、算子融合与 occupancy 的取舍。",
      "keyPoints": [
        "先用算术强度和 Roofline 判断 memory-bound 还是 compute-bound，再决定优化方向",
        "shared memory tiling 把全局访存降为约 1/T，register blocking 降低 shared 读流量，双缓冲隐藏访存延迟",
        "bank conflict、padding 与 128-bit 向量化决定 shared 和 global 带宽能不能打满",
        "occupancy 与寄存器压力是权衡；Tensor Core 抬高算力屋顶，但更依赖数据复用"
      ],
      "readingMinutes": 31,
      "hasContent": true,
      "chars": 10861
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
      "track": "aiinfra",
      "summary": "把“感觉慢”变成可复现的数字：nsys 找时间线空洞，ncu 读单 kernel 的吞吐、占用率与 stall，再用 Roofline 对照硬件峰值并给出瓶颈判定表。",
      "keyPoints": [
        "先定基线再动手：nsys 看整步时间线，ncu 看单 kernel，二者分工不可替代",
        "指标要成对读：DRAM 与 SM 吞吐、occupancy 与 stall 原因必须交叉判断",
        "Roofline 是天花板不是目标；每轮只改一个变量并用同一协议复测"
      ],
      "readingMinutes": 24,
      "hasContent": true,
      "chars": 7864
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
      "track": "aiinfra",
      "summary": "比较 FP32、TF32、FP16、BF16、FP8 与 INT8 的范围和精度，讲清主权重、损失缩放、autocast 与累加精度，以及量化 scale 与粒度选择。",
      "keyPoints": [
        "指数位决定动态范围，尾数位决定相对精度；BF16 用 8 位指数换取与 FP32 相同的范围",
        "混合精度训练的三件套是 FP32 主权重、损失缩放（FP16 必需，BF16 通常不需要）与按算子 autocast，Tensor Core 的 FP32 累加不可省",
        "量化误差来自截断与舍入；per-channel 与 per-group 用更多 scale 换更低误差，G=128 的 FP32 scale 开销约 0.25 bit/权重"
      ],
      "readingMinutes": 27,
      "hasContent": true,
      "chars": 9771
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
      "track": "aiinfra",
      "summary": "标准注意力的瓶颈是 N×N 中间矩阵的 HBM 读写。FlashAttention 用 tiling、online softmax 与反向重算把这部分数据留在 SRAM。",
      "keyPoints": [
        "朴素注意力的瓶颈是 Θ(N²) 的 HBM 读写而非 FLOPs，算术强度只有 d/2，远低于 GPU 脊点。",
        "tiling 加 online softmax 让 N×N 中间矩阵永不落 HBM；反向用重算 P 换掉 O(N²) 显存。",
        "FA-2 改工作划分，FA-3 用 Hopper 的 TMA/WGMMA 做异步重叠；长序列收益最大，短序列需实测。"
      ],
      "readingMinutes": 24,
      "hasContent": true,
      "chars": 8483
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
      "track": "aiinfra",
      "summary": "从算子图到机器码，拆解 Dynamo、AOTAutograd、Inductor 与 Triton 的编译流水线，说明融合、布局与自动调参的收益来源，并给出性能回退的排障方法。",
      "keyPoints": [
        "编译器把算子清单改写成循环程序，收益主要来自融合、布局选择与自动调参，而不是某种魔法",
        "torch.compile 的链路是 Dynamo 抓图、AOTAutograd 补反向、Inductor 调度融合、Triton 生成机器码",
        "图断点、重编译与动态 shape 是落地时最常见的三类性能回退，均有可观测的日志手段"
      ],
      "readingMinutes": 25,
      "hasContent": true,
      "chars": 8269
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
      "track": "aiinfra",
      "summary": "集合通信是分布式训练的隐形税：从八种原语到 ring/tree 算法、NCCL 拓扑感知与 SHARP 卸载，算清 AllReduce 通信量并给出排障路径。",
      "keyPoints": [
        "八种集合原语的分工，以及 AllReduce = ReduceScatter + AllGather 这一核心恒等式",
        "ring AllReduce 的两阶段与 2(N−1)/N·S 通信量，以及 RH-D、tree、NVLS/SHARP 的适用边界",
        "用 NCCL 拓扑探测、busbw 指标和环境变量定位“加卡反而更慢”的通信根因"
      ],
      "readingMinutes": 25,
      "hasContent": true,
      "chars": 8513
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
      "track": "aiinfra",
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
      "chars": 8638
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
      "track": "aiinfra",
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
      "chars": 7626
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
      "track": "aiinfra",
      "summary": "从每参数 16 字节的显存账本出发，算清激活、ZeRO 三阶段切分与 offload 的带宽代价，给出 DeepSpeed 与 FSDP 配置和 OOM 排障清单。",
      "keyPoints": [
        "混合精度加 Adam 的参数态约 16 字节/参数，其中优化器状态占 12 字节；加激活与临时区通常到 20 字节以上",
        "分段 activation checkpointing 用一次额外前向把激活显存从 O(n) 降到 O(√n)，计算增加约 1/3",
        "ZeRO 依次切分优化器状态、梯度、参数；Stage 3 的通信量约为基线的 1.5 倍",
        "offload 的收益取决于 PCIe/NVMe 有效带宽能否被计算掩盖"
      ],
      "readingMinutes": 24,
      "hasContent": true,
      "chars": 7830
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
      "track": "aiinfra",
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
      "chars": 8031
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
      "track": "aiinfra",
      "summary": "自回归推理分为 prefill 与 decode，前者算力受限，后者带宽受限。核心是 KV Cache 公式与 7B 算例、TTFT 与 TPOT 拆解，以及并发估算。",
      "keyPoints": [
        "prefill 并行处理整段提示词，算术强度约为 T，通常算力受限；decode 每步只处理 1 个 token，算术强度约为 batch size，通常带宽受限。",
        "KV Cache 大小 = 2 × 层数 × KV 头数 × head 维 × 序列长度 × 并发 × 字节数；7B/32 层/32 头/4K 序列在 fp16 下单条约 2 GiB，GQA-8 降到 512 MiB。",
        "TTFT 由排队与 prefill 主导，TPOT 由权重与 KV 的读取带宽主导；增大 batch 提升吞吐但抬高 TPOT，需要按 SLO 找拐点。",
        "显存决定并发上限，长上下文时 KV 可能比权重更占地方；流式返回只改善感知延迟，不改变总生成时间。"
      ],
      "readingMinutes": 25,
      "hasContent": true,
      "chars": 8511
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
      "track": "aiinfra",
      "summary": "静态批处理被 padding 与整批屏障拖累；连续批处理逐迭代调度，PagedAttention 分页治理 KV 碎片，叠加前缀缓存提升吞吐。",
      "keyPoints": [
        "静态 batch 的有效 token 占比为 ΣL/(B×L_max)，长度不齐时一半以上算力可能花在 padding 上。",
        "Orca 把调度粒度从请求降到迭代：每步淘汰完成者、准入新请求，batch 成员逐迭代变化。",
        "PagedAttention 用固定大小块加块表管理 KV，论文口径下把 KV 显存浪费从 60%–80% 压到 4% 以下，并支持共享与写时复制。",
        "chunked prefill 用预算 n+C ≤ T 把长 prefill 切片并与 decode 混批，压平 token 间延迟的长尾。"
      ],
      "readingMinutes": 24,
      "hasContent": true,
      "chars": 8541
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
      "track": "aiinfra",
      "summary": "投机解码用小模型先猜、目标模型并行校验，严格拒绝采样保证分布不变；加速比取决于接受率、草稿长度与成本，低并发长输出收益最大，工程上须端到端实测。",
      "keyPoints": [
        "decode 在 batch=1 时算术强度约为 1 FLOP/byte，只有 H100 脊点（约 295 FLOP/byte）的 1/295，瓶颈是权重访存而不是算力。",
        "小模型先猜 γ 个 token，目标模型一次并行校验 γ+1 个位置；严格拒绝采样保证输出分布与目标模型逐 token 采样完全一致。",
        "加速比 S ≈ E ÷ (1+γc)，E=(1−α^(γ+1))/(1−α)；α 低时加长草稿无益，c 接近 1 时投机失去意义。",
        "低并发、长输出、任务可预测时收益最大；大 batch、compute-bound、显存紧张时可能为负，必须用端到端 p50/p99 实测。"
      ],
      "readingMinutes": 24,
      "hasContent": true,
      "chars": 8433
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
      "track": "aiinfra",
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
      "chars": 8690
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
      "track": "aiinfra",
      "summary": "从解码带宽出发，讲清 weight-only、W8A8 与 KV Cache 量化的差异，拆解 INT4 分组存储与激活离群值，并给出 GPTQ、AWQ、FP8 的落地方案。",
      "keyPoints": [
        "weight-only 只压权重，W8A8 连激活一起压，KV Cache 量化是独立开关，三者收益与风险不同",
        "INT4 普遍依赖 group-wise scale；G=128 时实际约 4.125 bit/权重，反量化必须与 GEMM 融合",
        "W4A16 的加速随 batch 增大而衰减，W8A8 与 FP8 才吃得到算力红利；精度要用任务集与长上下文回归验证"
      ],
      "readingMinutes": 23,
      "hasContent": true,
      "chars": 8051
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
      "track": "aiinfra",
      "summary": "从 K8s 的 GPU 资源模型出发，讲清 MIG 与共享调度的边界、gang 死锁的成因与解法、拓扑和队列配额怎么落地，并比较 Volcano、Kueue、Slurm。",
      "keyPoints": [
        "device plugin 如何把 GPU 变成整数型 extended resource，以及默认为什么不能共享",
        "MIG、time-slicing、MPS 的隔离与密度取舍，A100 80GB 的 7 个切片怎么算",
        "gang scheduling 的原子性条件、死锁场景，以及 minMember 与队列的配合",
        "拓扑感知、binpack/spread、配额优先级与训练 operator 的工程组合"
      ],
      "readingMinutes": 28,
      "hasContent": true,
      "chars": 9746
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
      "track": "aiinfra",
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
      "chars": 7831
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
      "track": "aiinfra",
      "summary": "把“训练莫名变慢”拆成证据链：四层监控看什么，XID、ECC、NVLink CRC 与 IB 错误怎么读，再用决策树分流 hang、慢节点、OOM 与数据饥饿，以及隔离与演练方法。",
      "keyPoints": [
        "同步训练的步时由最慢的 rank 决定：单卡慢 20% 会让全局有效算力降到约 83%，且往往没有任何报错",
        "监控要按爆炸半径分层：硬件、节点、任务、服务各自回答不同问题，采样频率与保留期也不同",
        "硬件指标看趋势不看单点：新 XID 必须归因，DBE 零容忍，CRC 与 symbol errors 看是否单调增长",
        "诊断先分叉 hang 与 slow，再按 rank 对比步时；watchdog 与自动隔离必须有复核、熔断和留证"
      ],
      "readingMinutes": 25,
      "hasContent": true,
      "chars": 8868
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
      "track": "aiinfra",
      "summary": "把 GPU 小时、MFU、每百万 token 成本、PUE 与利用率串成一套能算的账：从训练与推理的成本模型，到容量规划、租买与 spot 决策，再到优化杠杆与成本归因。",
      "keyPoints": [
        "每有效 GPU·h 成本 = 时价 ÷ 有效利用率；MFU、集群利用率与 PUE 这些分母比标价更能决定账单",
        "训练用 6ND 估 GPU·h，推理用 277.8 × 时价 ÷ 输出吞吐 估每百万 token 成本，两者口径不可混用",
        "容量规划从峰值 QPS 与 Little 定律推并发，再用 KV 显存和单副本压测双向夹逼副本数，并留出故障域",
        "先提利用率与批处理，再谈量化、缓存与电价；归因必须把闲置与碎片摊进成本"
      ],
      "readingMinutes": 23,
      "hasContent": true,
      "chars": 7446
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
      "track": "aiinfra",
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
      "chars": 9270
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
      "track": "aiinfra",
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
      "chars": 9174
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
      "track": "aiinfra",
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
      "chars": 8930
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
      "track": "aiinfra",
      "summary": "从四层拓扑与 NVL72 出发，拆解十万卡规模下的无损网络、MTBF、goodput 分解、checkpoint 重启与液冷电力，给出可量化的容量规划与运维口径。",
      "keyPoints": [
        "十万卡的第一指标不是峰值算力而是 goodput：MFU × 有效时间比例 × 回滚存活率",
        "按 Llama 3 公开口径外推，十万卡约每 30 分钟一次非计划中断，可靠性必须按统计规律设计",
        "PFC 只做最后防线，常态靠 ECN/DCQCN；多打一与 all-to-all 的尾延迟比平均带宽更致命",
        "checkpoint 间隔约 √(2×C×MTBF)；NVL72 用铜背板换掉光模块，代价是 120 kW 机柜与整柜故障域"
      ],
      "readingMinutes": 23,
      "hasContent": true,
      "chars": 7965
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
      "track": "aiinfra",
      "summary": "训练决定模型能否做出来，推理决定它能否被用得起。拆解推理成本的四个乘数、超节点与光互连、近存计算、编译器收敛与软硬协同，并给出一张可用于决策的技术雷达。",
      "keyPoints": [
        "训练以一次性资本支出为主，推理成本随调用量增长、主要体现为运营支出；使用量增长、推理模型与 agent 三者叠加，把优化重心推向单位 token 成本",
        "成本下降是算法、硬件、系统、设施四个乘数相乘的结果；先把 batch 与缓存命中打满，再考虑换芯片",
        "机柜级超节点、CPO 与近存计算都在缩短数据搬运路径；代价分别是功耗与冷却、良率与可维护性、软件栈成熟度",
        "技术雷达按现在可用、三年内、更远分层，只用于决策与接口预留，不作为确定预测"
      ],
      "readingMinutes": 22,
      "hasContent": true,
      "chars": 7271
    },
    {
      "slug": "cpp-map",
      "title": "C++ 全景与学习路线",
      "subtitle": "从语言、标准库到工具链的一张地图",
      "level": 0,
      "cluster": "全景",
      "tags": [
        "概览",
        "零开销抽象",
        "学习路线"
      ],
      "prereq": [],
      "track": "cpp",
      "summary": "把 C++ 拆成核心语言、标准库、工具链与生态四块，讲清编译模型、零开销抽象、值语义与 RAII 如何串成一条主线，并给出七层学习路线。",
      "keyPoints": [
        "C++ 由核心语言、标准库、工具链与生态四部分组成，四者边界清楚，排障时才不会归错因。",
        "分离编译与翻译单元决定了头文件、模板定义位置、ODR 与重编译范围这些日常现象。",
        "零开销抽象不是“没有成本”，而是不用不付费、用了不比手写差；抽象自身的代价主要在编译期与代码体积，运行时成本要具体测量。",
        "RAII 把资源生命周期绑定到对象生命周期，是 C++ 没有垃圾回收仍能安全管理资源的根本机制。",
        "七层路线以“能解释、能动手、能排障”为过关标准，而不是以读完为标准。"
      ],
      "readingMinutes": 23,
      "hasContent": true,
      "chars": 7929
    },
    {
      "slug": "build-to-run",
      "title": "从源码到进程",
      "subtitle": "预处理、编译、汇编与链接",
      "level": 0,
      "cluster": "全景",
      "tags": [
        "编译模型",
        "链接",
        "ELF"
      ],
      "prereq": [
        "cpp-map"
      ],
      "track": "cpp",
      "summary": "C++ 源码到进程要经过预处理、编译、汇编、链接四级流水线。本篇讲清每级产物与错误边界，拆解目标文件的符号表与重定位，对比静态与动态链接的内存布局。",
      "keyPoints": [
        "四个阶段各有独立产物，编译错误、链接错误与加载错误分属不同层级",
        "目标文件靠符号表与重定位描述未定地址，链接器负责符号解析与地址回填",
        "静态链接复制库代码，动态链接共享库页并在加载时完成重定位"
      ],
      "readingMinutes": 23,
      "hasContent": true,
      "chars": 7905
    },
    {
      "slug": "types-conversions",
      "title": "类型系统与隐式转换",
      "subtitle": "每一个 bug 都可能从一次自动转换开始",
      "level": 1,
      "cluster": "语言核心",
      "tags": [
        "类型",
        "隐式转换",
        "static_cast"
      ],
      "prereq": [
        "cpp-map"
      ],
      "track": "cpp",
      "summary": "从标准保证的最小宽度讲起，拆解有符号与无符号回绕、整型提升与算术转换、窄化与列表初始化、explicit 与四种 cast，以及 auto 与 decltype 推导。",
      "keyPoints": [
        "标准只保证最小位宽；跨平台用定宽类型，别把 LP64 与 LLP64 的事实当成语言规则",
        "无符号运算按模 2^N 回绕，有符号溢出是未定义行为；两者混用会让比较与循环条件悄悄翻转",
        "单参构造函数默认 explicit，转换用最窄的具名 cast；auto 会丢弃顶层 const 与引用"
      ],
      "readingMinutes": 25,
      "hasContent": true,
      "chars": 8625
    },
    {
      "slug": "pointers-const",
      "title": "指针、引用与 const 正确性",
      "subtitle": "把“谁拥有、能否修改”写进类型里",
      "level": 1,
      "cluster": "语言核心",
      "tags": [
        "指针",
        "引用",
        "const"
      ],
      "prereq": [
        "types-conversions"
      ],
      "track": "cpp",
      "summary": "从地址与别名的差异出发，讲清 nullptr、指针算术与数组退化，拆解 const 的四种组合、两层 const 与 const 成员函数，并给出悬垂指针与成员指针的工程规则。",
      "keyPoints": [
        "指针是可空、可重绑、可算术的对象；引用是必须绑定且不可重绑的别名",
        "const 的四种组合、顶层与底层 const 的拷贝与转换规则",
        "const 成员函数的 this 类型、重载选择与 mutable 的边界",
        "悬垂指针的典型来源与检测手段，函数指针/成员指针的声明与调用"
      ],
      "readingMinutes": 24,
      "hasContent": true,
      "chars": 8094
    },
    {
      "slug": "functions-odr",
      "title": "函数、重载与 ODR",
      "subtitle": "链接期才暴露的错误，往往最难查",
      "level": 1,
      "cluster": "语言核心",
      "tags": [
        "重载",
        "ODR",
        "链接属性"
      ],
      "prereq": [
        "pointers-const"
      ],
      "track": "cpp",
      "summary": "从声明与定义讲起，拆开重载决议、默认参数、inline 的真实语义和单一定义规则，并落到链接属性、函数指针、lambda 与头文件设计，让你能定位链接期错误。",
      "keyPoints": [
        "函数声明只引入名字与类型，定义才提供函数体；变量还涉及存储与链接属性",
        "重载决议按候选集、可行集、转换序列排序三步走，返回类型不参与重载",
        "inline 的真实含义是允许多个编译单元出现相同定义，而不是强制内联",
        "ODR 违规常常不报错，链接器只能抓住一部分强符号冲突",
        "头文件只放声明，inline、constexpr、类与模板定义是例外"
      ],
      "readingMinutes": 22,
      "hasContent": true,
      "chars": 7733
    },
    {
      "slug": "classes-lifecycle",
      "title": "类与对象生命周期",
      "subtitle": "构造、析构与成员初始化的顺序",
      "level": 1,
      "cluster": "语言核心",
      "tags": [
        "类",
        "构造",
        "析构"
      ],
      "prereq": [
        "functions-odr"
      ],
      "track": "cpp",
      "summary": "从原始内存如何变成对象讲起，拆解初始化列表、成员初始化顺序、默认/委托/拷贝构造与 explicit，再落到析构、static 成员与异常语义，帮你避开对象生命周期中的顺序陷阱。",
      "keyPoints": [
        "class 与 struct 的唯一差别是默认访问权限与默认继承方式，访问控制是编译期检查",
        "成员初始化列表是初始化，函数体赋值只是赋值；实际顺序取决于声明顺序而非书写顺序",
        "构造顺序为虚基类、直接基类、成员、函数体，析构严格逆序",
        "构造失败时已构造的子对象逆序销毁；析构默认 noexcept，前提是所有子对象析构都不抛"
      ],
      "readingMinutes": 22,
      "hasContent": true,
      "chars": 7611
    },
    {
      "slug": "copy-move-semantics",
      "title": "拷贝、移动与 Rule of Five",
      "subtitle": "值语义的核心契约",
      "level": 1,
      "cluster": "语言核心",
      "tags": [
        "拷贝构造",
        "移动语义",
        "Rule of Five"
      ],
      "prereq": [
        "classes-lifecycle"
      ],
      "track": "cpp",
      "summary": "围绕五个特殊成员函数讲清深拷贝、自赋值与异常安全，给出 Rule of 0/3/5 的决策路径，并解释 RVO 与移动后状态的关键约束。",
      "keyPoints": [
        "拷贝构造/赋值与移动构造/赋值的语义、签名和隐式生成规则",
        "深拷贝与浅拷贝的内存布局差异，以及 double free 的成因",
        "Rule of 0/3/5 决策树，=default 与 =delete 的正确用法",
        "copy-and-swap、自赋值、异常安全，以及 noexcept 移动对容器的影响",
        "移动后的有效但未指定状态，RVO/NRVO 让移动消失的原因"
      ],
      "readingMinutes": 25,
      "hasContent": true,
      "chars": 8977
    },
    {
      "slug": "operator-overloading",
      "title": "运算符重载与代理类型",
      "subtitle": "让自定义类型像内建类型一样自然",
      "level": 1,
      "cluster": "语言核心",
      "tags": [
        "运算符",
        "代理对象",
        "比较"
      ],
      "prereq": [
        "classes-lifecycle"
      ],
      "track": "cpp",
      "summary": "从“运算符就是函数调用”出发，讲清可重载边界、成员与非成员的选择、返回值设计、三路比较与代理对象，并给出可编译的 C++20 示例与常见误区。",
      "keyPoints": [
        "运算符重载不改变优先级和结合性，只是把表达式翻译成函数调用；先想清楚翻译成谁，再决定写不写",
        "必须成员的是 =、-> 和类型转换；[] 与 () 传统上也是成员，C++23 起可声明为 static；对称二元运算符应写成非成员（常用 hidden friend）",
        "返回类型按语义选择：产生新值返回 T，修改自身返回 T&，观察返回 bool 或比较类别",
        "C++20 的 <=> 把六种比较收敛成三种顺序类别；默认定义按成员字典序比较",
        "代理对象用“像引用”的中间对象换取存储灵活性，代价是 auto、取地址和生命周期上的陷阱"
      ],
      "readingMinutes": 26,
      "hasContent": true,
      "chars": 9296
    },
    {
      "slug": "inheritance-vtable",
      "title": "继承、虚函数与对象布局",
      "subtitle": "多态在内存里长什么样",
      "level": 1,
      "cluster": "语言核心",
      "tags": [
        "继承",
        "虚函数",
        "vtable"
      ],
      "prereq": [
        "classes-lifecycle",
        "copy-move-semantics"
      ],
      "track": "cpp",
      "summary": "从访问控制与构造析构顺序讲到 vtable/vptr 布局、虚析构、切片与多继承，用可编译示例和内存图建立多态心智模型，并给出组合优于继承的判据。",
      "keyPoints": [
        "public 继承表达 is-a；private 继承只是实现复用，成员可见性由继承方式与基类访问级别共同决定。",
        "构造顺序是虚基类、直接基类、成员、函数体；期间 vptr 逐层切换，构造与析构中调用虚函数不会到达派生类。",
        "vtable 是类级函数指针表，vptr 是对象级指针；Itanium ABI 下地址点前是 offset-to-top 与 typeinfo，虚析构占两个槽位，但这些都不是标准保证。",
        "通过基类指针 delete 时基类析构必须是 public virtual；按值传递或存进 vector<Base> 会发生对象切片。",
        "多继承时每个多态基类子对象各带 vptr；覆盖调用需要 this 调整与 thunk，dynamic_cast 依赖 RTTI 且向下/交叉转型要求源类型多态。"
      ],
      "readingMinutes": 25,
      "hasContent": true,
      "chars": 8881
    },
    {
      "slug": "raii",
      "title": "RAII 与资源管理",
      "subtitle": "把释放资源的责任交给析构函数",
      "level": 2,
      "cluster": "对象与资源",
      "tags": [
        "RAII",
        "异常安全",
        "作用域守卫"
      ],
      "prereq": [
        "classes-lifecycle"
      ],
      "track": "cpp",
      "summary": "从一段漏掉 fclose 的代码说起，讲清 RAII 的构造-析构契约、异常栈展开、作用域守卫与所有权建模，让你把任意句柄包成不易泄漏、不易误用的类型。",
      "keyPoints": [
        "RAII 把资源生命周期绑定到栈对象的生命周期：构造获取并校验，析构释放且不抛异常",
        "自动存储期对象在正常或异常离开作用域时会被析构，提前 return、抛出异常都算离开；顺序与构造相反",
        "异常展开只析构抛出点到匹配 handler 之间的对象，构造函数体内裸获取的资源不会自动回收",
        "封装资源类要明确拷贝与移动语义：通常删除拷贝、实现 noexcept 移动，并保证 moved-from 状态可析构",
        "RAII 不等于智能指针：锁、文件、套接字、连接都该有对应的守卫类型，所有权用 unique_ptr、shared_ptr 与非拥有指针表达"
      ],
      "readingMinutes": 29,
      "hasContent": true,
      "chars": 10078
    },
    {
      "slug": "smart-pointers",
      "title": "智能指针与所有权建模",
      "subtitle": "unique_ptr 默认，shared_ptr 慎用",
      "level": 2,
      "cluster": "对象与资源",
      "tags": [
        "unique_ptr",
        "shared_ptr",
        "weak_ptr"
      ],
      "prereq": [
        "raii",
        "pointers-const"
      ],
      "track": "cpp",
      "summary": "从所有权建模出发，讲清 unique_ptr 的独占与删除器、shared_ptr 的控制块、原子计数与线程安全边界，以及 weak_ptr 破环与选型规则。",
      "keyPoints": [
        "所有权应写进类型：默认 unique_ptr，确需共享才用 shared_ptr",
        "shared_ptr 的拷贝不是免费的：控制块原子计数会带来缓存行争用",
        "make_shared 合并分配省一次分配，但 weak_ptr 存活时整块内存不释放",
        "循环引用要在建模层面用 weak_ptr 或非拥有指针打破"
      ],
      "readingMinutes": 24,
      "hasContent": true,
      "chars": 8503
    },
    {
      "slug": "value-categories",
      "title": "值类别与完美转发",
      "subtitle": "std::move 不移动，std::forward 不转发",
      "level": 2,
      "cluster": "对象与资源",
      "tags": [
        "值类别",
        "完美转发",
        "move"
      ],
      "prereq": [
        "copy-move-semantics"
      ],
      "track": "cpp",
      "summary": "从值类别三分类出发，讲清引用折叠与万能引用，拆解 std::move 和 std::forward 的真实语义，并解释移动构造、NRVO 与常见误用。",
      "keyPoints": [
        "值类别是表达式的属性：lvalue 有身份不可移动，xvalue 有身份可移动，prvalue 无身份可移动",
        "引用折叠只有一条规则：出现一个 & 就是 &，两个 && 才是 &&；T&& 只有在 T 参与推导时才是万能引用",
        "std::move 是无条件转成右值引用的 static_cast，对 const 对象会退化为拷贝；std::forward 按 T 有条件还原值类别",
        "移动构造是普通成员函数，负责窃取资源；noexcept 影响 vector 扩容时走移动还是退回拷贝，moved-from 对象处于有效但未指定状态",
        "C++17 强制消除 prvalue 的拷贝，NRVO 是可选优化；return std::move(x) 会抑制 NRVO，通常是负优化"
      ],
      "readingMinutes": 28,
      "hasContent": true,
      "chars": 9407
    },
    {
      "slug": "memory-layout",
      "title": "对象布局、对齐与存储期",
      "subtitle": "sizeof 背后的规则",
      "level": 2,
      "cluster": "对象与资源",
      "tags": [
        "内存布局",
        "对齐",
        "存储期"
      ],
      "prereq": [
        "classes-lifecycle"
      ],
      "track": "cpp",
      "summary": "从 sizeof 与 alignof 出发，讲清 padding、成员重排、标准布局、聚合与位域、四类存储期与栈帧，帮你看懂编译器布局，守住对齐与别名边界。",
      "keyPoints": [
        "对象表示包含 padding，值表示只含有效位；sizeof/alignof 与三条偏移规则决定布局",
        "成员按对齐值重排可减少 padding；标准布局保证首成员指针可互换与 offsetof",
        "聚合初始化与位域的边界：指定初始化是 C++20，位域布局由实现定义",
        "自动、静态、线程、动态四类存储期，以及栈帧、new[] cookie、EBO 与 SIMD 对齐实践"
      ],
      "readingMinutes": 29,
      "hasContent": true,
      "chars": 9926
    },
    {
      "slug": "allocation",
      "title": "new、delete 与分配器",
      "subtitle": "分配是性能与正确性的交叉点",
      "level": 2,
      "cluster": "对象与资源",
      "tags": [
        "new",
        "allocator",
        "内存池"
      ],
      "prereq": [
        "memory-layout",
        "raii"
      ],
      "track": "cpp",
      "summary": "从 new 讲起，拆开分配与构造两步，理清数组配对、对齐和放置构造，再进入分配器、pmr 与 arena 内存池，最后用碎片模型与排障清单把性能与正确性落到工程。",
      "keyPoints": [
        "new 表达式、operator new、placement new 与 malloc 的分工和失败语义",
        "new[]/delete[] 配对、数组 cookie 与 over-aligned 类型的对齐分配",
        "std::allocator 契约、allocator_traits 与 C++17 pmr 多态分配器",
        "arena/内存池的 O(1) 分配、外部与内部碎片的识别与治理"
      ],
      "readingMinutes": 33,
      "hasContent": true,
      "chars": 11447
    },
    {
      "slug": "exceptions",
      "title": "异常、错误处理与异常安全",
      "subtitle": "异常是控制流，也是接口契约",
      "level": 2,
      "cluster": "对象与资源",
      "tags": [
        "异常",
        "noexcept",
        "错误处理"
      ],
      "prereq": [
        "raii",
        "classes-lifecycle"
      ],
      "track": "cpp",
      "summary": "异常是 C++ 的第二条控制流。讲清栈展开、异常对象的复制与切片、三级异常安全保证、noexcept 契约与析构边界，并比较错误码与 expected 的取舍。",
      "keyPoints": [
        "throw 按表达式的静态类型构造异常对象，随后沿调用栈查找 catch，离开的每一帧逆序析构局部对象；无人接住则 terminate",
        "catch 按值会复制并切片，捕获多态基类应使用 const 引用；throw 处也可能因静态类型发生切片",
        "基本保证不泄漏、不破坏不变量；强保证失败即回滚；不抛保证用 noexcept 表达",
        "noexcept 是契约而不是优化开关，违反即 terminate；它决定 vector 扩容时能否安全移动",
        "错误码、optional、expected 各有边界；零成本异常把开销放在只读表和抛出路径上"
      ],
      "readingMinutes": 25,
      "hasContent": true,
      "chars": 8404
    },
    {
      "slug": "undefined-behavior",
      "title": "未定义行为与严格别名",
      "subtitle": "编译器没有义务让你的错误代码工作",
      "level": 2,
      "cluster": "对象与资源",
      "tags": [
        "UB",
        "严格别名",
        "优化"
      ],
      "prereq": [
        "pointers-const",
        "memory-layout"
      ],
      "track": "cpp",
      "summary": "未定义行为不是结果随机，而是标准不再保护你的程序。区分 UB、未指定与实现定义行为，讲清编译器如何利用 UB 优化、严格别名与对象生命周期，给出 sanitizer 的覆盖边界。",
      "keyPoints": [
        "UB 指标准对执行不施加任何要求，既非结果不确定也非必然崩溃；未指定行为仍在标准内，实现定义行为必须写入文档",
        "优化器以程序无 UB 为前提做代数化简、删除分支与重排访存，因此错误会跨语句扩散",
        "严格别名要求通过对象的真实类型访问，位重解释应使用 memcpy 或 C++20 的 std::bit_cast",
        "对象生命周期结束后存储可能仍在，但访问已结束生命周期的对象依然是 UB",
        "ASan、UBSan、TSan、MSan 各自覆盖不同错误，没有单一工具能检测全部 UB"
      ],
      "readingMinutes": 24,
      "hasContent": true,
      "chars": 8197
    },
    {
      "slug": "templates-basics",
      "title": "模板基础与实例化",
      "subtitle": "泛型编程的入口",
      "level": 3,
      "cluster": "泛型与标准库",
      "tags": [
        "函数模板",
        "类模板",
        "特化"
      ],
      "prereq": [
        "functions-odr",
        "classes-lifecycle"
      ],
      "track": "cpp",
      "summary": "从函数模板与类模板讲到参数推导、显式实参、实例化与代码膨胀、全特化与偏特化，再拆开依赖名称、typename、两阶段查找和模板的 ODR 规则，让你看懂容器与算法的实现方式。",
      "keyPoints": [
        "模板是编译期的代码生成器，不是运行时多态，也不是文本替换的宏",
        "模板实参可以推导也可以显式指定；推导失败时先检查类型是否一致",
        "每个使用的类型组合都会产生一份实例化，链接器按符号合并同一实例",
        "全特化改写某个具体类型，偏特化改写一类类型模式，函数模板用重载替代偏特化",
        "隐式实例化时模板定义必须对实例化点可见，所以通常整体放在头文件里"
      ],
      "readingMinutes": 27,
      "hasContent": true,
      "chars": 9583
    },
    {
      "slug": "templates-advanced",
      "title": "变参模板、SFINAE 与 concepts",
      "subtitle": "让模板报错说人话",
      "level": 3,
      "cluster": "泛型与标准库",
      "tags": [
        "变参模板",
        "SFINAE",
        "concepts"
      ],
      "prereq": [
        "templates-basics"
      ],
      "track": "cpp",
      "summary": "从参数包与折叠表达式讲到 SFINAE 与检测惯用法，再进入概念约束：把要求写进签名、逐项检查表达式良构，并按包含关系决定重载排序；最后以 CRTP 收束静态多态，交代元编程取舍。",
      "keyPoints": [
        "参数包必须放在模式里展开，C++17 折叠表达式取代了大部分递归写法",
        "SFINAE 只在立即上下文生效，失败是移除候选而不是报错",
        "concepts 把要求写进签名，并通过 subsumption 影响重载排序",
        "CRTP 用编译期绑定换取零虚调用，但失去运行时多态与异构存储",
        "优先 concepts，其次 if constexpr 与标签分发，最后才用 SFINAE"
      ],
      "readingMinutes": 29,
      "hasContent": true,
      "chars": 9896
    },
    {
      "slug": "constexpr",
      "title": "constexpr 与编译期计算",
      "subtitle": "把工作从运行时搬到编译时",
      "level": 3,
      "cluster": "泛型与标准库",
      "tags": [
        "constexpr",
        "consteval",
        "编译期"
      ],
      "prereq": [
        "templates-basics"
      ],
      "track": "cpp",
      "summary": "讲清 constexpr、consteval 与 constinit 的区别、常量表达式规则和 C++20 编译期容器，并给出编译期哈希实战与成本评估。",
      "keyPoints": [
        "constexpr 是“允许在编译期求值”，只有常量上下文才强制编译期；consteval 才无条件强制",
        "常量求值有严格规则：不得有未定义行为、不得读未初始化对象，C++20 的分配必须在求值结束前释放",
        "if constexpr 只丢弃模板中的未选分支，不是预处理器；编译期计算要核算编译时间与二进制体积"
      ],
      "readingMinutes": 23,
      "hasContent": true,
      "chars": 7726
    },
    {
      "slug": "stl-containers",
      "title": "STL 容器与迭代器",
      "subtitle": "先选对容器，再谈优化",
      "level": 3,
      "cluster": "泛型与标准库",
      "tags": [
        "vector",
        "map",
        "迭代器"
      ],
      "prereq": [
        "templates-basics",
        "copy-move-semantics"
      ],
      "track": "cpp",
      "summary": "把 STL 容器看成一份复杂度与迭代器失效的契约：对比序列、关联、无序容器与适配器的内存布局和操作代价，并给出一张选型决策表。",
      "keyPoints": [
        "容器是契约：选择容器等于选择一组复杂度承诺与迭代器失效规则，而不是选择语法。",
        "vector 默认首选：连续内存、缓存友好，几何扩容把 n 次 push_back 的总迁移摊到 O(n)。",
        "需要按 key 查找时，有序用 map/set，只查不遍历且哈希质量好时用 unordered_map/set。",
        "迭代器类别决定算法能否使用；插入删除前先确认哪些迭代器、指针和引用会失效。",
        "适配器不提供迭代器；span 与 string_view 是非拥有视图，绝不延长被观察对象的生命周期。"
      ],
      "readingMinutes": 27,
      "hasContent": true,
      "chars": 9204
    },
    {
      "slug": "stl-algorithms",
      "title": "算法、lambda 与 ranges",
      "subtitle": "用组合代替手写循环",
      "level": 3,
      "cluster": "泛型与标准库",
      "tags": [
        "算法",
        "lambda",
        "ranges"
      ],
      "prereq": [
        "stl-containers",
        "value-categories"
      ],
      "track": "cpp",
      "summary": "讲清算法分类与复杂度、lambda 捕获的生命周期、std::function 与 function_ref 的开销，以及 ranges 视图的惰性求值与投影组合。",
      "keyPoints": [
        "算法只依赖迭代器能力与可调用对象，不依赖容器；remove 只搬移不删除，删除仍需 erase",
        "lambda 每个表达式生成唯一闭包类型，按值捕获复制、按引用捕获只存地址，被捕获对象先死即悬垂",
        "std::function 拥有并可能分配，调用难以内联；function_ref 非拥有、轻量，但不能延长生命周期",
        "ranges 视图构造 O(1)、迭代时才计算，take 能提前终止；视图通常不拥有数据，底层容器先销毁即悬垂（右值临时容器由 owning_view 接管）",
        "投影把“按什么比较”从比较器里拆出来；并行算法要求无数据竞争且异常不得逃逸"
      ],
      "readingMinutes": 26,
      "hasContent": true,
      "chars": 9144
    },
    {
      "slug": "string-view-format",
      "title": "字符串、string_view 与 format",
      "subtitle": "文本处理中的生命周期陷阱",
      "level": 3,
      "cluster": "泛型与标准库",
      "tags": [
        "string",
        "string_view",
        "format"
      ],
      "prereq": [
        "stl-containers",
        "pointers-const"
      ],
      "track": "cpp",
      "summary": "std::string 的 SSO 布局决定指针何时失效，string_view 零拷贝却极易悬垂，std::format 与 to_chars 让格式化类型安全。",
      "keyPoints": [
        "std::string 拥有字节，SSO 让短串免于堆分配；阈值与 sizeof 属于标准库与 ABI 的实现细节",
        "string_view 只是指针加长度：不拥有、不保证 NUL 结尾、不延长被观察对象的生命周期",
        "只读参数优先 string_view，但不要保存、不要返回，也不要从临时 std::string 构造视图",
        "C++20 std::format 在格式串编译期可知时检查类型，chrono 可直接按日历字段格式化",
        "to_chars/from_chars 无分配且与 locale 无关，是数字与文本互转的默认工具"
      ],
      "readingMinutes": 29,
      "hasContent": true,
      "chars": 9849
    },
    {
      "slug": "concurrency-basics",
      "title": "线程、互斥量与条件变量",
      "subtitle": "先保证正确，再追求并行",
      "level": 4,
      "cluster": "并发与性能",
      "tags": [
        "thread",
        "mutex",
        "condition_variable"
      ],
      "prereq": [
        "raii",
        "classes-lifecycle"
      ],
      "track": "cpp",
      "summary": "从并发与并行的区别讲起，拆解 std::thread 与 jthread 的生命周期、互斥量与三种锁守卫、条件变量的伪唤醒，并用生产者消费者与线程池示例说明死锁四条件与避免策略。",
      "keyPoints": [
        "并发是同时应对多件事的结构，并行是同时做多件事的执行；并发代码的第一目标是正确，而不是更快",
        "std::thread 析构时仍 joinable 会调用 std::terminate；std::jthread（C++20）析构时自动 request_stop 再 join",
        "互斥量保护的是共享可变状态，锁守卫用 RAII 保证 unlock；同时锁多把时用 std::scoped_lock（C++17）",
        "条件变量必须配合谓词使用，wait(lock, pred) 消化伪唤醒，状态修改与谓词检查必须在同一把锁下",
        "死锁的四个必要条件破坏任意一条即可排除：一次取全部锁、固定加锁顺序、try_lock 超时退避"
      ],
      "readingMinutes": 31,
      "hasContent": true,
      "chars": 10641
    },
    {
      "slug": "atomics-memory-order",
      "title": "原子操作与内存序",
      "subtitle": "happens-before 是可以被证明的",
      "level": 4,
      "cluster": "并发与性能",
      "tags": [
        "atomic",
        "memory_order",
        "happens-before"
      ],
      "prereq": [
        "concurrency-basics"
      ],
      "track": "cpp",
      "summary": "从数据竞争的定义出发，拆解六种内存序、release/acquire 配对与传递闭包，讲清 relaxed 计数、CAS 与 ABA、自旋锁与无锁结构的边界。",
      "keyPoints": [
        "数据竞争是“两个冲突访问之间没有 happens-before”的未定义行为，而不是“结果看起来不对”",
        "sequenced-before 约束同一线程，synchronizes-with 约束跨线程，两者取传递闭包得到 happens-before",
        "release 写与读到该值的 acquire 读配对，把写者屏障前的所有写发布给读者屏障后的所有读",
        "relaxed 只保证原子性与单对象修改顺序，适合计数；需要发布或消费数据时必须用 acquire/release",
        "volatile 不提供原子性与跨线程顺序，x86 的强内存模型是硬件行为，不能替代 C++ 的 memory_order"
      ],
      "readingMinutes": 29,
      "hasContent": true,
      "chars": 10325
    },
    {
      "slug": "async-coroutines",
      "title": "async、future 与协程",
      "subtitle": "从任务到挂起的执行模型",
      "level": 4,
      "cluster": "并发与性能",
      "tags": [
        "future",
        "coroutine",
        "co_await"
      ],
      "prereq": [
        "concurrency-basics"
      ],
      "track": "cpp",
      "summary": "从 future 的结果凭据讲到 C++20 协程：拆解 promise_type、awaiter 与 handle，讲清 co_await 展开、帧布局、调度与线程关系。",
      "keyPoints": [
        "future 保存结果，协程保存执行现场；这是两种不同的异步模型",
        "future 是一次性凭据：get 阻塞且只能成功取一次，async 的 future 析构可能阻塞",
        "协程由 promise_type 控制生命周期，由 awaiter 决定挂起行为，由 handle 负责恢复",
        "协程帧通常分配在堆上，形参按值复制进帧，引用形参只保存引用",
        "协程不是线程也不是并行：resume 在哪个线程执行，协程体就在哪个线程运行"
      ],
      "readingMinutes": 28,
      "hasContent": true,
      "chars": 9707
    },
    {
      "slug": "performance",
      "title": "C++ 性能工程",
      "subtitle": "缓存、分配与测量的三角",
      "level": 4,
      "cluster": "并发与性能",
      "tags": [
        "性能",
        "缓存",
        "benchmark"
      ],
      "prereq": [
        "memory-layout",
        "stl-containers"
      ],
      "track": "cpp",
      "summary": "从测量闭环讲起，拆解缓存局部性、AoS/SoA 布局、分支与内联、分配与拷贝、伪共享，并给出 Google Benchmark 与 perf 的正确用法。",
      "keyPoints": [
        "性能结论只在具体场景成立：先建立可重复的基线，一次只改一个变量，改动幅度必须超过测量噪声",
        "缓存层级决定了大多数“看似算得快”的优化：局部性、数据布局与缓存行利用率往往比指令条数更关键",
        "AoS 适合整体访问对象，SoA 适合批量扫描单列；选择依据是访问模式，不是直觉",
        "内联、LTO、分支提示都只是给编译器的信息，是否生效要反汇编或看 profile 验证",
        "在热点路径上减少分配与拷贝（reserve、移动、string_view）通常有直接收益，但零拷贝会把生命周期风险转移给调用方"
      ],
      "readingMinutes": 28,
      "hasContent": true,
      "chars": 9409
    },
    {
      "slug": "build-systems",
      "title": "CMake 与构建系统",
      "subtitle": "把编译命令变成可维护的工程",
      "level": 5,
      "cluster": "工程化",
      "tags": [
        "CMake",
        "target",
        "依赖管理"
      ],
      "prereq": [
        "build-to-run"
      ],
      "track": "cpp",
      "summary": "从 g++ 命令出发，讲清 CMake target 与属性传播、include 与链接两条链、构建类型、依赖管理、PCH 与 ccache、交叉编译与增量构建及排障路径。",
      "keyPoints": [
        "构建系统是依赖图而非命令集合：描述、调度、增量三件事缺一不可",
        "现代 CMake 只围绕 target 与 usage requirements，PUBLIC/PRIVATE/INTERFACE 决定属性是否传给下游",
        "include 是编译期的头文件搜索，链接是链接期的符号解析，两条链的失败信息与修法完全不同",
        "依赖必须显式、版本必须锁定、构建必须可复现；增量出错先看图，再决定是否清空"
      ],
      "readingMinutes": 30,
      "hasContent": true,
      "chars": 10661
    },
    {
      "slug": "testing-sanitizers",
      "title": "测试、Sanitizer 与模糊测试",
      "subtitle": "让机器替你找未定义行为",
      "level": 5,
      "cluster": "工程化",
      "tags": [
        "GoogleTest",
        "ASan",
        "fuzzing"
      ],
      "prereq": [
        "build-systems",
        "undefined-behavior"
      ],
      "track": "cpp",
      "summary": "从测试金字塔、GoogleTest 断言与夹具、四种 Sanitizer 的检测边界，到 Valgrind、libFuzzer、覆盖率与 CI 门禁，讲清各工具能证明什么。",
      "keyPoints": [
        "测试金字塔是成本模型而非教条：越靠底层反馈越快、定位越准，越靠顶层越接近真实但越脆",
        "断言分致命与非致命，夹具让每个测试用例拥有独立且可复现的初始状态",
        "ASan 查越界与释放后使用，UBSan 查语言层未定义运算，TSan 查数据竞争，MSan 查未初始化读，没有工具覆盖全部 UB",
        "Sanitizer 只能报告本次执行实际走到的路径，未命中不等于代码正确",
        "Fuzzing 用覆盖率引导输入变异，把崩溃样本固化为回归用例；覆盖率度量执行范围，不度量断言质量"
      ],
      "readingMinutes": 24,
      "hasContent": true,
      "chars": 8238
    },
    {
      "slug": "debugging",
      "title": "调试：gdb、lldb 与崩溃分析",
      "subtitle": "从现象回到最小复现",
      "level": 5,
      "cluster": "工程化",
      "tags": [
        "gdb",
        "core dump",
        "调试"
      ],
      "prereq": [
        "build-systems"
      ],
      "track": "cpp",
      "summary": "以复现、定位、最小化、验证的闭环为主线，讲清 gdb 与 lldb 的断点、观察点与栈回溯，core dump 分析、反向调试边界和日志调试纪律。",
      "keyPoints": [
        "调试是闭环：先让失败可重复，再用可证伪的假设驱动观测，最后最小化并固化为回归测试",
        "断点决定停在哪里，观察点回答谁改了内存；栈回溯与 core dump 把崩溃现场还原成调用链",
        "符号匹配、优化级别与构建指纹决定分析是否可信，工具选择服从问题类型"
      ],
      "readingMinutes": 24,
      "hasContent": true,
      "chars": 8201
    },
    {
      "slug": "abi-linking",
      "title": "ABI、动态库与二进制兼容",
      "subtitle": "为什么换个编译器就链接失败",
      "level": 5,
      "cluster": "工程化",
      "tags": [
        "ABI",
        "动态链接",
        "符号"
      ],
      "prereq": [
        "build-to-run",
        "inheritance-vtable"
      ],
      "track": "cpp",
      "summary": "API 与头文件都没变，为何换个编译器就链接失败或运行崩溃？拆解名字修饰、符号可见性、soname、RTTI 与异常跨库、STL 与内联风险，给出二进制兼容规则。",
      "keyPoints": [
        "API 是源码契约，ABI 是二进制契约；C++ 标准不规定 ABI，平台与编译器决定细节",
        "名字修饰决定符号名；extern \"C\" 只关闭修饰，不保证布局、异常与分配器兼容",
        "soname 与版本脚本管理运行期查找和符号版本；ABI 破坏必须提升 soname",
        "RTTI、异常、STL 与 inline 函数体是跨库的四大风险源",
        "插件边界首选 C ABI 或稳定纯虚接口，配合版本握手与明确的分配归属"
      ],
      "readingMinutes": 27,
      "hasContent": true,
      "chars": 9416
    },
    {
      "slug": "api-design",
      "title": "API 设计与接口演进",
      "subtitle": "好接口让错误难以写出来",
      "level": 5,
      "cluster": "工程化",
      "tags": [
        "API 设计",
        "pimpl",
        "版本演进"
      ],
      "prereq": [
        "raii",
        "exceptions",
        "templates-basics"
      ],
      "track": "cpp",
      "summary": "从参数传递、const 正确性、noexcept 契约到 pimpl 编译防火墙与弃用策略，用反例讲清哪些设计能让错误在编译期暴露，以及如何不破坏调用方地演进接口。",
      "keyPoints": [
        "参数写法由三个语义问题决定：接口是否拥有、参数是否可空、接口是否修改，而不是个人偏好",
        "const 成员函数、noexcept、[[nodiscard]] 都是写进类型的承诺，承诺越准确，调用方越难误用",
        "强类型与具名结构体把参数换位、单位混用从运行期错误变成编译期错误",
        "pimpl 用一次间接寻址和一次堆分配换取编译防火墙与布局稳定，析构必须在实现完整可见处定义",
        "演进遵循先加、再标弃用、后删除；默认参数与新增重载都可能在重新编译后静默改变行为"
      ],
      "readingMinutes": 30,
      "hasContent": true,
      "chars": 10524
    },
    {
      "slug": "modules",
      "title": "C++20 Modules",
      "subtitle": "告别头文件的下一次编译模型变革",
      "level": 6,
      "cluster": "深入与演进",
      "tags": [
        "modules",
        "import",
        "编译模型"
      ],
      "prereq": [
        "build-systems"
      ],
      "track": "cpp",
      "summary": "从头文件模型的重复解析讲起，拆解 module、export、分区与 BMI 编译模型，说明与头文件的差异、工具链现状、迁移策略和 ABI 边界。",
      "keyPoints": [
        "头文件是预处理阶段的文本粘贴，模块是编译器管理的语义接口",
        "export 决定可见性，模块内未导出的名字对导入方不可见，宏也不会随 export 传播",
        "接口单元产出 BMI，导入方加载 BMI 而非重新解析源码；BMI 是编译器私有格式，不可分发",
        "模块不改变平台 ABI，也不保证跨编译器二进制兼容；迁移应从叶子库开始并保留头文件出口"
      ],
      "readingMinutes": 24,
      "hasContent": true,
      "chars": 8104
    },
    {
      "slug": "cpp-evolution",
      "title": "C++ 的演进与生态",
      "subtitle": "从 C++11 到 C++26 的设计脉络",
      "level": 6,
      "cluster": "深入与演进",
      "tags": [
        "标准演进",
        "WG21",
        "生态"
      ],
      "prereq": [
        "templates-advanced",
        "constexpr",
        "modules"
      ],
      "track": "cpp",
      "summary": "梳理 C++11 到 C++26 的关键特性与设计取舍，讲清零开销、兼容、渐进三原则、WG21 流程，以及 Boost、Abseil、fmt、range-v3 的生态作用。",
      "keyPoints": [
        "版本号是协议批次，不是产品换代；新标准在旧代码上增量叠加，理解特性要看它替代了什么旧写法。",
        "零开销决定抽象形态，兼容性限制改造空间，渐进式决定落地节奏，三者共同解释标准为什么长成这样。",
        "提案要过研究组、演进组、措辞组、全会与 ISO 投票；进入工作草案不等于发布，更不等于编译器可用。",
        "生态是标准的试验场：Boost、Abseil、fmt、range-v3 提供设计验证，Core Guidelines 提供工程规范。"
      ],
      "readingMinutes": 25,
      "hasContent": true,
      "chars": 8366
    }
  ],
  "stats": {
    "topics": 64,
    "written": 64,
    "minutes": 1639,
    "words": 565235,
    "diagrams": 229
  }
};
