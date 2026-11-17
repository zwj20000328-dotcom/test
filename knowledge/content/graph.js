/**
 * 知识图谱的“手工部分”：层级、条目、前置关系和学习路径。
 * 摘要 / 要点 / 阅读时长由 tools/build.mjs 从正文文件自动合并。
 * 新增条目时：先在这里登记，再在 content/aiinfra/ 下写同名正文，最后运行 npm run build。
 */
window.KB_GRAPH = {
  site: {
    name: '知栈',
    en: 'STACK ATLAS',
    tagline: '把复杂的系统，拆成可以理解的一层层',
    description: '一个关于计算机系统与 AI 基础设施的交互式知识地图，配有深度图文教程与轻量练习。'
  },

  levels: [
    { id: 0, name: '全景', en: 'Orientation', color: '#6366f1', desc: '先建立地图，再谈细节。理解整条链路与性能直觉。' },
    { id: 1, name: '硬件', en: 'Hardware', color: '#0ea5e9', desc: 'GPU、显存、互联与加速器：所有软件的物理边界。' },
    { id: 2, name: '单机优化', en: 'Kernels', color: '#14b8a6', desc: 'CUDA、算子、精度与编译器：把一台机器榨干。' },
    { id: 3, name: '训练', en: 'Training', color: '#f59e0b', desc: '并行策略与工程细节：从单卡到万卡。' },
    { id: 4, name: '推理', en: 'Inference', color: '#ec4899', desc: 'KV Cache、调度、解码与服务化：把模型变成产品。' },
    { id: 5, name: '平台', en: 'Platform', color: '#8b5cf6', desc: '调度、存储、可观测性与成本：让集群稳定赚钱。' },
    { id: 6, name: '前沿', en: 'Frontier', color: '#ef4444', desc: 'MoE、长上下文、RL 与超大规模：正在发生的事。' }
  ],

  tracks: [
    {
      id: 'aiinfra',
      name: 'AI Infra',
      en: 'AI Infrastructure',
      status: 'live',
      num: '01',
      desc: '从一颗 GPU 到十万卡集群，理解大模型背后的系统栈。31 篇深度教程，7 个层级，覆盖硬件、算子、训练、推理与平台。'
    },
    { id: 'os', name: '计算机系统', en: 'Operating Systems', status: 'soon', num: '02', desc: '进程、内存、文件系统与虚拟化：所有软件的底座。' },
    { id: 'compile', name: '编译原理', en: 'Compilers', status: 'soon', num: '03', desc: '从词法分析到 IR 与代码生成：程序如何变成机器指令。' },
    { id: 'dist', name: '分布式系统', en: 'Distributed Systems', status: 'soon', num: '04', desc: '一致性、共识、复制与容错：多台机器的协作法则。' },
    { id: 'algo', name: '算法与数据结构', en: 'Algorithms', status: 'soon', num: '05', desc: '复杂度、图论、动态规划与近似算法：计算的地形图。' },
    { id: 'net', name: '计算机网络', en: 'Networking', status: 'soon', num: '06', desc: '从 TCP/IP 到数据中心网络：数据如何抵达。' }
  ],

  /* 前置关系用于知识地图上的连线与“本篇前置”提示 */
  topics: [
    { slug: 'ai-infra-map', title: 'AI Infra 全景图', subtitle: '从硅片到服务的一张地图', level: 0, cluster: '全景', tags: ['概览', '技术栈', '学习路径'], prereq: [] },
    { slug: 'three-bottlenecks', title: '算力、显存、带宽', subtitle: '用 Roofline 建立性能直觉', level: 0, cluster: '全景', tags: ['Roofline', '算术强度', '性能模型'], prereq: ['ai-infra-map'] },

    { slug: 'gpu-architecture', title: 'GPU 微架构', subtitle: 'SM、Warp 与 Tensor Core', level: 1, cluster: '硬件', tags: ['SIMT', 'SM', 'Tensor Core'], prereq: ['three-bottlenecks'] },
    { slug: 'memory-hierarchy', title: '显存层级', subtitle: '从 HBM 到寄存器的容量、带宽与延迟', level: 1, cluster: '硬件', tags: ['HBM', 'SRAM', '合并访问'], prereq: ['gpu-architecture'] },
    { slug: 'interconnect', title: '互联技术', subtitle: 'PCIe、NVLink 与 InfiniBand', level: 1, cluster: '硬件', tags: ['NVLink', 'InfiniBand', '拓扑'], prereq: ['memory-hierarchy'] },
    { slug: 'accelerator-landscape', title: '加速器版图', subtitle: 'GPU、TPU、NPU 与 ASIC 的取舍', level: 1, cluster: '硬件', tags: ['TPU', 'NPU', 'ASIC'], prereq: ['gpu-architecture', 'interconnect'] },

    { slug: 'cuda-model', title: 'CUDA 编程与执行模型', subtitle: '从 kernel 启动到指令调度', level: 2, cluster: '单机优化', tags: ['CUDA', 'Warp', 'Stream'], prereq: ['gpu-architecture', 'memory-hierarchy'] },
    { slug: 'kernel-optimization', title: 'Kernel 优化', subtitle: 'Tiling、融合与 Occupancy', level: 2, cluster: '单机优化', tags: ['Tiling', '算子融合', 'Bank Conflict'], prereq: ['cuda-model', 'memory-hierarchy'] },
    { slug: 'profiling', title: '性能剖析', subtitle: 'Nsight 与 Roofline 实操', level: 2, cluster: '单机优化', tags: ['Nsight', 'Profiling', 'NCU'], prereq: ['cuda-model'] },
    { slug: 'mixed-precision', title: '混合精度与量化基础', subtitle: 'BF16、FP8 与数值稳定性', level: 2, cluster: '单机优化', tags: ['BF16', 'FP8', 'Autocast'], prereq: ['gpu-architecture'] },
    { slug: 'flashattention', title: 'FlashAttention', subtitle: '把注意力装进 SRAM', level: 2, cluster: '单机优化', tags: ['Attention', 'IO', 'Online Softmax'], prereq: ['gpu-architecture', 'memory-hierarchy'] },
    { slug: 'compilers', title: '编译器与算子生成', subtitle: 'Triton、TVM、XLA 与 TorchInductor', level: 2, cluster: '单机优化', tags: ['Triton', 'torch.compile', 'MLIR'], prereq: ['cuda-model', 'kernel-optimization'] },

    { slug: 'collective-comm', title: '集合通信', subtitle: 'AllReduce 与拓扑感知', level: 3, cluster: '训练', tags: ['NCCL', 'AllReduce', 'Ring'], prereq: ['interconnect'] },
    { slug: 'data-parallel', title: '数据并行与梯度同步', subtitle: 'DDP、FSDP 与梯度累积', level: 3, cluster: '训练', tags: ['DDP', 'FSDP', '梯度累积'], prereq: ['collective-comm', 'cuda-model'] },
    { slug: 'model-parallel', title: '模型并行', subtitle: '张量并行与流水并行', level: 3, cluster: '训练', tags: ['Tensor Parallel', 'Pipeline Parallel', 'Megatron'], prereq: ['collective-comm'] },
    { slug: 'zero-memory', title: 'ZeRO 与显存优化', subtitle: '算清每一字节，才能训得更大', level: 3, cluster: '训练', tags: ['ZeRO', 'Checkpointing', 'Offload'], prereq: ['data-parallel'] },
    { slug: 'large-scale-training', title: '3D 并行与万卡训练', subtitle: '从能跑到跑得快、跑得稳', level: 3, cluster: '训练', tags: ['3D Parallel', 'MFU', '稳定性'], prereq: ['data-parallel', 'model-parallel', 'zero-memory'] },

    { slug: 'inference-basics', title: '推理基础', subtitle: 'Prefill、Decode 与 KV Cache', level: 4, cluster: '推理', tags: ['KV Cache', 'TTFT', 'TPOT'], prereq: ['three-bottlenecks', 'memory-hierarchy'] },
    { slug: 'batching-scheduling', title: '批处理与调度', subtitle: 'Continuous Batching 与 PagedAttention', level: 4, cluster: '推理', tags: ['Continuous Batching', 'PagedAttention', '调度'], prereq: ['inference-basics'] },
    { slug: 'speculative-decoding', title: '投机解码', subtitle: '用小模型跑赢大模型', level: 4, cluster: '推理', tags: ['Speculative Decoding', 'Medusa', 'EAGLE'], prereq: ['inference-basics'] },
    { slug: 'serving-engines', title: '推理引擎与服务化', subtitle: 'vLLM、SGLang 与 TensorRT-LLM', level: 4, cluster: '推理', tags: ['vLLM', 'SGLang', 'SLA'], prereq: ['batching-scheduling'] },
    { slug: 'quantized-inference', title: '量化推理落地', subtitle: 'GPTQ、AWQ、SmoothQuant 与 FP8', level: 4, cluster: '推理', tags: ['GPTQ', 'AWQ', 'W8A8'], prereq: ['mixed-precision', 'inference-basics'] },

    { slug: 'cluster-scheduling', title: '集群调度', subtitle: 'Kubernetes 与 GPU 编排', level: 5, cluster: '平台', tags: ['Kubernetes', 'Gang Scheduling', 'MIG'], prereq: ['large-scale-training'] },
    { slug: 'storage-data', title: '数据管道与存储', subtitle: '别让 GPU 等数据', level: 5, cluster: '平台', tags: ['数据加载', 'Checkpoint', '对象存储'], prereq: ['large-scale-training'] },
    { slug: 'observability', title: '可观测性与故障诊断', subtitle: '当 1000 张卡里有一张在拖后腿', level: 5, cluster: '平台', tags: ['监控', 'NCCL Hang', 'XID'], prereq: ['cluster-scheduling', 'collective-comm'] },
    { slug: 'capacity-cost', title: '容量规划、成本与能效', subtitle: '把算力当成钱来管', level: 5, cluster: '平台', tags: ['成本', '容量规划', 'PUE'], prereq: ['serving-engines', 'large-scale-training'] },

    { slug: 'moe', title: 'MoE 稀疏架构', subtitle: '稀疏激活的训练与推理', level: 6, cluster: '前沿', tags: ['MoE', 'Expert Parallel', 'DeepSeek-V3'], prereq: ['model-parallel', 'collective-comm'] },
    { slug: 'long-context', title: '长上下文基础设施', subtitle: '从 4K 到 1M 的代价', level: 6, cluster: '前沿', tags: ['RoPE', 'MLA', 'Ring Attention'], prereq: ['flashattention', 'inference-basics'] },
    { slug: 'rl-infra', title: 'RL 训练基础设施', subtitle: '当生成比训练更贵', level: 6, cluster: '前沿', tags: ['RLHF', 'GRPO', 'Rollout'], prereq: ['serving-engines', 'large-scale-training'] },
    { slug: 'ultra-scale', title: '十万卡集群', subtitle: '规模本身就是一种技术', level: 6, cluster: '前沿', tags: ['大规模集群', '无损网络', 'Goodput'], prereq: ['interconnect', 'large-scale-training'] },
    { slug: 'ai-infra-future', title: 'AI Infra 的下一个五年', subtitle: '从训练为中心到推理为中心', level: 6, cluster: '前沿', tags: ['趋势', '技术雷达', '推理成本'], prereq: ['moe', 'ultra-scale'] }
  ],

  paths: [
    {
      id: 'beginner',
      name: '零基础入门',
      desc: '从地图和性能直觉开始，走通硬件到推理的主干。',
      steps: ['ai-infra-map', 'three-bottlenecks', 'gpu-architecture', 'memory-hierarchy', 'cuda-model', 'inference-basics', 'batching-scheduling', 'serving-engines']
    },
    {
      id: 'training',
      name: '训练工程师',
      desc: '直奔并行策略与大规模训练工程，适合要做预训练或微调的人。',
      steps: ['collective-comm', 'data-parallel', 'model-parallel', 'zero-memory', 'large-scale-training', 'moe']
    },
    {
      id: 'inference',
      name: '推理与部署',
      desc: '把模型做成稳定的在线服务，关心延迟、吞吐和单位成本。',
      steps: ['inference-basics', 'batching-scheduling', 'speculative-decoding', 'quantized-inference', 'serving-engines', 'capacity-cost']
    },
    {
      id: 'platform',
      name: '平台与运维',
      desc: '面向集群、存储、监控与成本，保障大规模任务的稳定运行。',
      steps: ['interconnect', 'cluster-scheduling', 'storage-data', 'observability', 'ultra-scale', 'capacity-cost']
    }
  ]
};
