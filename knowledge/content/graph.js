/**
 * 知识图谱的“手工部分”：模块、层级、条目、前置关系和学习路径。
 * 摘要 / 要点 / 阅读时长由 tools/build.mjs 从正文文件自动合并。
 *
 * 新增模块：
 *   1. 在 tracks 里登记模块与 levels / topics / paths
 *   2. 在 content/<track-id>/ 下写同名正文
 *   3. 运行 npm run build
 */
window.KB_GRAPH = {
  site: {
    name: '知栈',
    en: 'STACK ATLAS',
    tagline: '把复杂的系统，拆成可以理解的一层层',
    description: '一个关于计算机系统、编程语言与 AI 基础设施的交互式知识地图，配有深度图文教程与轻量练习。'
  },

  tracks: [
    /* ==================================================================
       Track 01 · AI Infra
       ================================================================== */
    {
      id: 'aiinfra',
      name: 'AI Infra',
      en: 'AI Infrastructure',
      status: 'live',
      num: '01',
      desc: '从一颗 GPU 到十万卡集群，理解大模型背后的系统栈。31 篇深度教程，7 个层级，覆盖硬件、算子、训练、推理与平台。',

      levels: [
        { id: 0, name: '全景', en: 'Orientation', color: '#6366f1', desc: '先建立地图，再谈细节。理解整条链路与性能直觉。' },
        { id: 1, name: '硬件', en: 'Hardware', color: '#0ea5e9', desc: 'GPU、显存、互联与加速器：所有软件的物理边界。' },
        { id: 2, name: '单机优化', en: 'Kernels', color: '#14b8a6', desc: 'CUDA、算子、精度与编译器：把一台机器榨干。' },
        { id: 3, name: '训练', en: 'Training', color: '#f59e0b', desc: '并行策略与工程细节：从单卡到万卡。' },
        { id: 4, name: '推理', en: 'Inference', color: '#ec4899', desc: 'KV Cache、调度、解码与服务化：把模型变成产品。' },
        { id: 5, name: '平台', en: 'Platform', color: '#8b5cf6', desc: '调度、存储、可观测性与成本：让集群稳定赚钱。' },
        { id: 6, name: '前沿', en: 'Frontier', color: '#ef4444', desc: 'MoE、长上下文、RL 与超大规模：正在发生的事。' }
      ],

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
    },

    /* ==================================================================
       Track 02 · C++
       ================================================================== */
    {
      id: 'cpp',
      name: 'C++',
      en: 'Modern C++',
      status: 'live',
      num: '02',
      desc: '从语法、对象模型到泛型、并发与工程化，建立现代 C++ 的心智模型。33 篇深度教程，7 个层级，配内存布局与调用链图解。',

      levels: [
        { id: 0, name: '全景', en: 'Orientation', color: '#6366f1', desc: '先建立编译模型与语言地图，再进入语法细节。' },
        { id: 1, name: '语言核心', en: 'Core Language', color: '#0ea5e9', desc: '类型、指针、函数、类与多态：把语法变成心智模型。' },
        { id: 2, name: '对象与资源', en: 'Objects & Resources', color: '#14b8a6', desc: '生命周期、所有权、内存与异常：C++ 的真正难点。' },
        { id: 3, name: '泛型与标准库', en: 'Templates & STL', color: '#f59e0b', desc: '模板、constexpr、容器与算法：写一次，用很多次。' },
        { id: 4, name: '并发与性能', en: 'Concurrency & Perf', color: '#ec4899', desc: '线程、内存序、协程与性能工程：把机器用满。' },
        { id: 5, name: '工程化', en: 'Engineering', color: '#8b5cf6', desc: '构建、测试、调试、ABI 与 API：让代码活得更久。' },
        { id: 6, name: '深入与演进', en: 'Deep Dive', color: '#ef4444', desc: 'Modules、标准演进与生态：下一步往哪走。' }
      ],

      topics: [
        { slug: 'cpp-map', title: 'C++ 全景与学习路线', subtitle: '从语言、标准库到工具链的一张地图', level: 0, cluster: '全景', tags: ['概览', '零开销抽象', '学习路线'], prereq: [] },
        { slug: 'build-to-run', title: '从源码到进程', subtitle: '预处理、编译、汇编与链接', level: 0, cluster: '全景', tags: ['编译模型', '链接', 'ELF'], prereq: ['cpp-map'] },

        { slug: 'types-conversions', title: '类型系统与隐式转换', subtitle: '每一个 bug 都可能从一次自动转换开始', level: 1, cluster: '语言核心', tags: ['类型', '隐式转换', 'static_cast'], prereq: ['cpp-map'] },
        { slug: 'pointers-const', title: '指针、引用与 const', subtitle: '把“谁拥有、能否修改”写进类型里', level: 1, cluster: '语言核心', tags: ['指针', '引用', 'const'], prereq: ['types-conversions'] },
        { slug: 'functions-odr', title: '函数、重载与 ODR', subtitle: '链接期才暴露的错误，往往最难查', level: 1, cluster: '语言核心', tags: ['重载', 'ODR', '链接属性'], prereq: ['pointers-const'] },
        { slug: 'classes-lifecycle', title: '类与对象生命周期', subtitle: '构造、析构与成员初始化的顺序', level: 1, cluster: '语言核心', tags: ['类', '构造', '析构'], prereq: ['functions-odr'] },
        { slug: 'copy-move-semantics', title: '拷贝、移动与 Rule of Five', subtitle: '值语义的核心契约', level: 1, cluster: '语言核心', tags: ['拷贝构造', '移动语义', 'Rule of Five'], prereq: ['classes-lifecycle'] },
        { slug: 'operator-overloading', title: '运算符重载与代理类型', subtitle: '让自定义类型像内建类型一样自然', level: 1, cluster: '语言核心', tags: ['运算符', '代理对象', '比较'], prereq: ['classes-lifecycle'] },
        { slug: 'inheritance-vtable', title: '继承、虚函数与对象布局', subtitle: '多态在内存里长什么样', level: 1, cluster: '语言核心', tags: ['继承', '虚函数', 'vtable'], prereq: ['classes-lifecycle', 'copy-move-semantics'] },

        { slug: 'raii', title: 'RAII 与资源管理', subtitle: '把释放资源的责任交给析构函数', level: 2, cluster: '对象与资源', tags: ['RAII', '异常安全', '作用域守卫'], prereq: ['classes-lifecycle'] },
        { slug: 'smart-pointers', title: '智能指针与所有权建模', subtitle: 'unique_ptr 默认，shared_ptr 慎用', level: 2, cluster: '对象与资源', tags: ['unique_ptr', 'shared_ptr', 'weak_ptr'], prereq: ['raii', 'pointers-const'] },
        { slug: 'value-categories', title: '值类别与完美转发', subtitle: 'std::move 不移动，std::forward 不转发', level: 2, cluster: '对象与资源', tags: ['值类别', '完美转发', 'move'], prereq: ['copy-move-semantics'] },
        { slug: 'memory-layout', title: '对象布局、对齐与存储期', subtitle: 'sizeof 背后的规则', level: 2, cluster: '对象与资源', tags: ['内存布局', '对齐', '存储期'], prereq: ['classes-lifecycle'] },
        { slug: 'allocation', title: 'new、delete 与分配器', subtitle: '分配是性能与正确性的交叉点', level: 2, cluster: '对象与资源', tags: ['new', 'allocator', '内存池'], prereq: ['memory-layout', 'raii'] },
        { slug: 'exceptions', title: '异常、错误处理与异常安全', subtitle: '异常是控制流，也是接口契约', level: 2, cluster: '对象与资源', tags: ['异常', 'noexcept', '错误处理'], prereq: ['raii', 'classes-lifecycle'] },
        { slug: 'undefined-behavior', title: '未定义行为与严格别名', subtitle: '编译器没有义务让你的错误代码工作', level: 2, cluster: '对象与资源', tags: ['UB', '严格别名', '优化'], prereq: ['pointers-const', 'memory-layout'] },

        { slug: 'templates-basics', title: '模板基础与实例化', subtitle: '泛型编程的入口', level: 3, cluster: '泛型与标准库', tags: ['函数模板', '类模板', '特化'], prereq: ['functions-odr', 'classes-lifecycle'] },
        { slug: 'templates-advanced', title: '变参模板、SFINAE 与 concepts', subtitle: '让模板报错说人话', level: 3, cluster: '泛型与标准库', tags: ['变参模板', 'SFINAE', 'concepts'], prereq: ['templates-basics'] },
        { slug: 'constexpr', title: 'constexpr 与编译期计算', subtitle: '把工作从运行时搬到编译时', level: 3, cluster: '泛型与标准库', tags: ['constexpr', 'consteval', '编译期'], prereq: ['templates-basics'] },
        { slug: 'stl-containers', title: 'STL 容器与迭代器', subtitle: '先选对容器，再谈优化', level: 3, cluster: '泛型与标准库', tags: ['vector', 'map', '迭代器'], prereq: ['templates-basics', 'copy-move-semantics'] },
        { slug: 'stl-algorithms', title: '算法、lambda 与 ranges', subtitle: '用组合代替手写循环', level: 3, cluster: '泛型与标准库', tags: ['算法', 'lambda', 'ranges'], prereq: ['stl-containers', 'value-categories'] },
        { slug: 'string-view-format', title: '字符串、string_view 与 format', subtitle: '文本处理中的生命周期陷阱', level: 3, cluster: '泛型与标准库', tags: ['string', 'string_view', 'format'], prereq: ['stl-containers', 'pointers-const'] },

        { slug: 'concurrency-basics', title: '线程、互斥量与条件变量', subtitle: '先保证正确，再追求并行', level: 4, cluster: '并发与性能', tags: ['thread', 'mutex', 'condition_variable'], prereq: ['raii', 'classes-lifecycle'] },
        { slug: 'atomics-memory-order', title: '原子操作与内存序', subtitle: 'happens-before 是可以被证明的', level: 4, cluster: '并发与性能', tags: ['atomic', 'memory_order', 'happens-before'], prereq: ['concurrency-basics'] },
        { slug: 'async-coroutines', title: 'async、future 与协程', subtitle: '从任务到挂起的执行模型', level: 4, cluster: '并发与性能', tags: ['future', 'coroutine', 'co_await'], prereq: ['concurrency-basics'] },
        { slug: 'performance', title: 'C++ 性能工程', subtitle: '缓存、分配与测量的三角', level: 4, cluster: '并发与性能', tags: ['性能', '缓存', 'benchmark'], prereq: ['memory-layout', 'stl-containers'] },

        { slug: 'build-systems', title: 'CMake 与构建系统', subtitle: '把编译命令变成可维护的工程', level: 5, cluster: '工程化', tags: ['CMake', 'target', '依赖管理'], prereq: ['build-to-run'] },
        { slug: 'testing-sanitizers', title: '测试、Sanitizer 与模糊测试', subtitle: '让机器替你找未定义行为', level: 5, cluster: '工程化', tags: ['GoogleTest', 'ASan', 'fuzzing'], prereq: ['build-systems', 'undefined-behavior'] },
        { slug: 'debugging', title: '调试：gdb、lldb 与崩溃分析', subtitle: '从现象回到最小复现', level: 5, cluster: '工程化', tags: ['gdb', 'core dump', '调试'], prereq: ['build-systems'] },
        { slug: 'abi-linking', title: 'ABI、动态库与二进制兼容', subtitle: '为什么换个编译器就链接失败', level: 5, cluster: '工程化', tags: ['ABI', '动态链接', '符号'], prereq: ['build-to-run', 'inheritance-vtable'] },
        { slug: 'api-design', title: 'API 设计与接口演进', subtitle: '好接口让错误难以写出来', level: 5, cluster: '工程化', tags: ['API 设计', 'pimpl', '版本演进'], prereq: ['raii', 'exceptions', 'templates-basics'] },

        { slug: 'modules', title: 'C++20 Modules', subtitle: '告别头文件的下一次编译模型变革', level: 6, cluster: '深入与演进', tags: ['modules', 'import', '编译模型'], prereq: ['build-systems'] },
        { slug: 'cpp-evolution', title: 'C++ 的演进与生态', subtitle: '从 C++11 到 C++26 的设计脉络', level: 6, cluster: '深入与演进', tags: ['标准演进', 'WG21', '生态'], prereq: ['templates-advanced', 'constexpr', 'modules'] }
      ],

      paths: [
        {
          id: 'beginner',
          name: '零基础入门',
          desc: '从编译模型开始，走通类型、指针、函数、类与标准库。',
          steps: ['cpp-map', 'build-to-run', 'types-conversions', 'pointers-const', 'functions-odr', 'classes-lifecycle', 'copy-move-semantics', 'stl-containers']
        },
        {
          id: 'modern',
          name: '现代 C++',
          desc: '补齐值语义、所有权、模板与编译期计算，写出地道的 C++。',
          steps: ['value-categories', 'smart-pointers', 'templates-basics', 'templates-advanced', 'constexpr', 'stl-algorithms', 'api-design']
        },
        {
          id: 'concurrency',
          name: '并发与性能',
          desc: '从 RAII 出发，掌握线程、内存序、协程与性能工程。',
          steps: ['raii', 'concurrency-basics', 'atomics-memory-order', 'async-coroutines', 'performance']
        },
        {
          id: 'engineering',
          name: '工程化',
          desc: '构建、测试、调试、ABI 与接口设计，让项目能长期维护。',
          steps: ['build-systems', 'testing-sanitizers', 'debugging', 'abi-linking', 'api-design']
        }
      ]
    },

    /* ==================================================================
       筹备中的模块
       ================================================================== */
    { id: 'os', name: '计算机系统', en: 'Operating Systems', status: 'soon', num: '03', desc: '进程、内存、文件系统与虚拟化：所有软件的底座。', levels: [], topics: [], paths: [] },
    { id: 'dist', name: '分布式系统', en: 'Distributed Systems', status: 'soon', num: '04', desc: '一致性、共识、复制与容错：多台机器的协作法则。', levels: [], topics: [], paths: [] },
    { id: 'algo', name: '算法与数据结构', en: 'Algorithms', status: 'soon', num: '05', desc: '复杂度、图论、动态规划与近似算法：计算的地形图。', levels: [], topics: [], paths: [] },
    { id: 'net', name: '计算机网络', en: 'Networking', status: 'soon', num: '06', desc: '从 TCP/IP 到数据中心网络：数据如何抵达。', levels: [], topics: [], paths: [] }
  ]
};
