(function () {
  'use strict';
  var App = window.KBApp;
  var D = App.DATA;
  var esc = App.escapeHtml;

  var RES = [
    { type: 'course', title: 'Machine Learning Systems', desc: '哈佛 CS249r 教材，从数据工程到部署的完整系统视角，免费在线。', org: 'Vijay Janapa Reddi / Harvard', year: '2022—', url: 'https://mlsysbook.ai/' },
    { type: 'paper', title: 'Roofline: An Insightful Visual Performance Model', desc: '算术强度与带宽瓶颈的经典模型，理解一切性能问题的起点。', org: 'Williams, Waterman, Patterson · CACM', year: '2009', url: 'https://dl.acm.org/doi/10.1145/1498765.1498785' },
    { type: 'paper', title: 'AI and Memory Wall', desc: '系统解释为什么大模型推理受限于显存带宽，含大量实测数据。', org: 'Gholami et al.', year: '2024', url: 'https://arxiv.org/abs/2403.14123' },
    { type: 'paper', title: 'Efficiently Scaling Transformer Inference', desc: '推理两阶段、KV Cache 与分区策略的系统分析。', org: 'Pope et al. · Google', year: '2022', url: 'https://arxiv.org/abs/2211.05102' },
    { type: 'docs', title: 'CUDA C++ Programming Guide', desc: 'CUDA 执行模型、内存空间与 API 的权威参考。', org: 'NVIDIA', year: '持续更新', url: 'https://docs.nvidia.com/cuda/cuda-c-programming-guide/' },
    { type: 'docs', title: 'CUDA C++ Best Practices Guide', desc: '访存合并、occupancy、bank conflict 等优化清单。', org: 'NVIDIA', year: '持续更新', url: 'https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/' },
    { type: 'docs', title: 'Nsight Compute Documentation', desc: '逐 kernel 的性能指标、roofline 分析与 stall 原因解读。', org: 'NVIDIA', year: '持续更新', url: 'https://docs.nvidia.com/nsight-compute/' },
    { type: 'docs', title: 'NCCL User Guide', desc: '集合通信、拓扑探测、算法选择与调试环境变量。', org: 'NVIDIA', year: '持续更新', url: 'https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/' },
    { type: 'paper', title: 'FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness', desc: 'IO 感知的注意力实现，把中间矩阵留在 SRAM。', org: 'Dao et al.', year: '2022', url: 'https://arxiv.org/abs/2205.14135' },
    { type: 'tool', title: 'FlashAttention 官方实现', desc: 'FA2/FA3 的 CUDA 实现与基准，支持变长与因果掩码。', org: 'Dao-AILab', year: '2022—', url: 'https://github.com/Dao-AILab/flash-attention' },
    { type: 'tool', title: 'Triton', desc: '面向 tile 的 GPU 编程语言与编译器，TorchInductor 的代码生成后端。', org: 'OpenAI', year: '2019—', url: 'https://triton-lang.org/' },
    { type: 'paper', title: 'Mixed Precision Training', desc: 'FP16 + master weights + loss scaling 的标准做法。', org: 'Micikevicius et al. · NVIDIA/百度', year: '2017', url: 'https://arxiv.org/abs/1710.03740' },
    { type: 'paper', title: 'ZeRO: Memory Optimizations Toward Training Trillion Parameter Models', desc: '优化器状态、梯度、参数三阶段切分的原始论文。', org: 'Rajbhandari et al. · Microsoft', year: '2019', url: 'https://arxiv.org/abs/1910.02054' },
    { type: 'tool', title: 'DeepSpeed', desc: 'ZeRO 与 offload 的工程实现，含大量训练配置示例。', org: 'Microsoft', year: '2020—', url: 'https://github.com/microsoft/DeepSpeed' },
    { type: 'tool', title: 'Megatron-LM', desc: '张量并行、流水并行与大规模训练的标准参考实现。', org: 'NVIDIA', year: '2019—', url: 'https://github.com/NVIDIA/Megatron-LM' },
    { type: 'paper', title: 'Megatron-LM: Training Multi-Billion Parameter Language Models Using Model Parallelism', desc: '列并行/行并行的切分方式与通信点。', org: 'Shoeybi et al. · NVIDIA', year: '2019', url: 'https://arxiv.org/abs/1909.08053' },
    { type: 'paper', title: 'GPipe: Efficient Training of Giant Neural Networks using Pipeline Parallelism', desc: '流水并行与 micro-batch 气泡的来源。', org: 'Huang et al. · Google', year: '2018', url: 'https://arxiv.org/abs/1811.06965' },
    { type: 'docs', title: 'PyTorch Fully Sharded Data Parallel', desc: 'FSDP 的参数分片、混合分片与 checkpoint 用法。', org: 'PyTorch', year: '持续更新', url: 'https://pytorch.org/docs/stable/fsdp.html' },
    { type: 'paper', title: 'Efficient Memory Management for Large Language Model Serving with PagedAttention', desc: 'vLLM 的论文：分页 KV Cache 与连续批处理。', org: 'Kwon et al.', year: '2023', url: 'https://arxiv.org/abs/2309.06180' },
    { type: 'paper', title: 'Orca: A Distributed Serving System for Transformer-Based Generative Models', desc: 'iteration-level scheduling，连续批处理的思想来源。', org: 'Yu et al. · OSDI', year: '2022', url: 'https://www.usenix.org/conference/osdi22/presentation/yu' },
    { type: 'docs', title: 'vLLM Documentation', desc: '引擎参数、量化后端、分布式推理与 OpenAI 兼容接口。', org: 'vLLM', year: '持续更新', url: 'https://docs.vllm.ai/' },
    { type: 'tool', title: 'SGLang', desc: '面向结构化生成与前缀复用的推理引擎，含 RadixAttention。', org: 'SGLang Team', year: '2024—', url: 'https://github.com/sgl-project/sglang' },
    { type: 'tool', title: 'TensorRT-LLM', desc: 'NVIDIA 的推理引擎，强调内核融合与 FP8/INT4 部署。', org: 'NVIDIA', year: '2023—', url: 'https://github.com/NVIDIA/TensorRT-LLM' },
    { type: 'paper', title: 'GPTQ: Accurate Post-Training Quantization for Generative Pre-trained Transformers', desc: '逐层二阶近似的 4bit 权重量化。', org: 'Frantar et al.', year: '2022', url: 'https://arxiv.org/abs/2210.17323' },
    { type: 'paper', title: 'AWQ: Activation-aware Weight Quantization', desc: '按激活重要性保护显著权重通道。', org: 'Lin et al. · MIT', year: '2023', url: 'https://arxiv.org/abs/2306.00978' },
    { type: 'paper', title: 'SmoothQuant: Accurate and Efficient Post-Training Quantization for LLMs', desc: '把激活 outlier 迁移到权重，实现 W8A8。', org: 'Xiao et al.', year: '2022', url: 'https://arxiv.org/abs/2211.10438' },
    { type: 'paper', title: 'GQA: Training Generalized Multi-Query Transformer Models', desc: '分组查询注意力，显著压缩 KV Cache。', org: 'Ainslie et al. · Google', year: '2023', url: 'https://arxiv.org/abs/2305.13245' },
    { type: 'paper', title: 'Switch Transformers', desc: '稀疏专家与 top-1 路由的大规模实践。', org: 'Fedus et al. · Google', year: '2021', url: 'https://arxiv.org/abs/2101.03961' },
    { type: 'paper', title: 'DeepSeek-V3 Technical Report', desc: '671B/37B 激活的 MoE 训练与推理工程细节。', org: 'DeepSeek-AI', year: '2024', url: 'https://arxiv.org/abs/2412.19437' },
    { type: 'paper', title: 'The Llama 3 Herd of Models', desc: '万卡级训练、数据配比、网络与稳定性的一手记录。', org: 'Meta AI', year: '2024', url: 'https://arxiv.org/abs/2407.21783' },
    { type: 'paper', title: 'Ring Attention with Blockwise Transformers for Near-Infinite Context', desc: '序列并行与环状注意力的通信设计。', org: 'Liu et al.', year: '2023', url: 'https://arxiv.org/abs/2310.01889' },
    { type: 'paper', title: 'YaRN: Efficient Context Window Extension of Large Language Models', desc: 'RoPE 外推的工程化方法。', org: 'Peng et al.', year: '2023', url: 'https://arxiv.org/abs/2309.00071' },
    { type: 'docs', title: 'NVIDIA DCGM', desc: 'GPU 指标采集、健康检查与 XID 诊断。', org: 'NVIDIA', year: '持续更新', url: 'https://docs.nvidia.com/datacenter/dcgm/latest/' },
    { type: 'docs', title: 'Kubernetes Device Plugins', desc: 'GPU 等设备如何作为扩展资源参与调度。', org: 'Kubernetes', year: '持续更新', url: 'https://kubernetes.io/docs/concepts/extend-kubernetes/compute-storage-net/device-plugins/' },
    { type: 'tool', title: 'Kueue', desc: 'Kubernetes 原生的队列、配额与 gang 调度。', org: 'Kubernetes SIG', year: '2022—', url: 'https://kueue.sigs.k8s.io/' },
    { type: 'tool', title: 'Volcano', desc: '面向批量与 AI 任务的 K8s 调度器。', org: 'CNCF', year: '2019—', url: 'https://volcano.sh/' },
    { type: 'tool', title: 'WebDataset', desc: '分片 tar 流式数据集格式，解决小文件与随机读瓶颈。', org: 'WebDataset', year: '2019—', url: 'https://github.com/webdataset/webdataset' },
    { type: 'data', title: 'MLPerf Benchmarks', desc: '训练与推理的标准化基准，注意区分场景与精度口径。', org: 'MLCommons', year: '持续更新', url: 'https://mlcommons.org/benchmarks/' },
    { type: 'course', title: 'Programming Massively Parallel Processors', desc: 'CUDA 与并行编程的系统教材，第 4 版覆盖 Tensor Core。', org: 'Kirk & Hwu', year: '2022', url: 'https://www.elsevier.com/books/programming-massively-parallel-processors/hwu/978-0-323-91231-0' },
    { type: 'media', title: 'SemiAnalysis', desc: '硬件与数据中心供应链的深度分析，数字需交叉验证。', org: 'Dylan Patel 等', year: '持续更新', url: 'https://semianalysis.com/' },

    { type: 'docs', title: 'cppreference', desc: 'C++ 语言与标准库的权威参考，按标准版本标注可用性。', org: 'cppreference.com', year: '持续更新', url: 'https://en.cppreference.com/w/' },
    { type: 'docs', title: 'C++ Core Guidelines', desc: 'Stroustrup 与 Sutter 维护的现代 C++ 实践准则。', org: 'ISO C++', year: '持续更新', url: 'https://isocpp.github.io/CppCoreGuidelines/' },
    { type: 'docs', title: 'C++ Compiler Support', desc: '各编译器对 C++11 到 C++26 特性的支持矩阵。', org: 'cppreference', year: '持续更新', url: 'https://en.cppreference.com/w/cpp/compiler_support' },
    { type: 'tool', title: 'Compiler Explorer', desc: '在线查看 GCC/Clang/MSVC 生成的汇编、优化与 ABI 差异。', org: 'Godbolt', year: '持续更新', url: 'https://godbolt.org/' },
    { type: 'tool', title: 'C++ Insights', desc: '把模板、lambda、范围 for 展开成编译器眼中的代码。', org: 'Andreas Fertig', year: '持续更新', url: 'https://cppinsights.io/' },
    { type: 'docs', title: 'Itanium C++ ABI', desc: 'vtable、名称修饰、异常与 RTTI 的事实标准。', org: 'Itanium C++ ABI 委员会', year: '持续更新', url: 'https://itanium-cxx-abi.github.io/cxx-abi/' },
    { type: 'docs', title: 'GCC libstdc++ Manual', desc: '标准库实现、扩展与 ABI 兼容性说明。', org: 'GCC', year: '持续更新', url: 'https://gcc.gnu.org/onlinedocs/libstdc++/' },
    { type: 'tool', title: 'GoogleTest', desc: 'C++ 单元测试与断言的工业标准之一。', org: 'Google', year: '持续更新', url: 'https://google.github.io/googletest/' },
    { type: 'docs', title: 'Clang Sanitizers', desc: 'ASan/UBSan/TSan/MSan 的用法与边界。', org: 'LLVM', year: '持续更新', url: 'https://clang.llvm.org/docs/' },
    { type: 'docs', title: 'CMake Documentation', desc: 'target、属性、依赖与工具链的官方参考。', org: 'Kitware', year: '持续更新', url: 'https://cmake.org/documentation/' },
    { type: 'docs', title: 'WG21 Papers', desc: 'C++ 标准提案与会议论文，追踪语言演进的第一手资料。', org: 'ISO C++', year: '持续更新', url: 'https://wg21.link/' },
    { type: 'course', title: 'CppCon', desc: '年度 C++ 大会的公开演讲，覆盖语言、性能与工程实践。', org: 'CppCon', year: '持续更新', url: 'https://www.youtube.com/c/CppCon' }
  ];

  var TYPES = [
    { id: 'all', name: '全部' },
    { id: 'paper', name: '论文' },
    { id: 'docs', name: '官方文档' },
    { id: 'course', name: '课程与书' },
    { id: 'tool', name: '工具与代码' },
    { id: 'data', name: '基准与数据' },
    { id: 'media', name: '分析' }
  ];
  var BADGE = { paper: '论文', docs: '文档', course: '课程', tool: '工具', data: '基准', media: '分析' };

  var state = { type: 'all', q: '' };

  function renderChips() {
    var host = document.getElementById('resChips');
    host.innerHTML = TYPES.map(function (t) {
      var n = t.id === 'all' ? RES.length : RES.filter(function (r) { return r.type === t.id; }).length;
      return '<button class="chip' + (state.type === t.id ? ' is-on' : '') + '" data-type="' + t.id + '">' +
        esc(t.name) + '<span style="opacity:.55;margin-left:6px;font-size:11px">' + n + '</span></button>';
    }).join('');
    App.qsa('#resChips .chip').forEach(function (b) {
      b.addEventListener('click', function () {
        state.type = b.getAttribute('data-type');
        renderChips();
        renderList();
      });
    });
  }

  function renderList() {
    var q = state.q.trim().toLowerCase();
    var list = RES.filter(function (r) {
      var okType = state.type === 'all' || r.type === state.type;
      var hay = [r.title, r.desc, r.org, r.year].join(' ').toLowerCase();
      return okType && (!q || hay.indexOf(q) >= 0);
    });
    document.getElementById('resCount').textContent = list.length + ' 条资源';
    document.getElementById('resEmpty').style.display = list.length ? 'none' : '';
    document.getElementById('resGrid').innerHTML = list.map(function (r) {
      return '<a class="res" data-type="' + r.type + '" href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer">' +
        '<span class="res__badge">' + (BADGE[r.type] || '链接') + '</span>' +
        '<div style="min-width:0">' +
          '<h3>' + esc(r.title) + '</h3>' +
          '<p>' + esc(r.desc) + '</p>' +
          '<span class="res__meta">' + esc(r.org) + ' · ' + esc(r.year) + '</span>' +
        '</div>' +      '</a>';
    }).join('');
  }

  document.getElementById('resSearch').addEventListener('input', function (e) {
    state.q = e.target.value;
    renderList();
  });

  /* health */
  var written = D.topics.filter(function (t) { return t.hasContent; }).length;
  var total = D.topics.length;
  var pct = total ? Math.round((written / total) * 100) : 0;
  var ring = document.getElementById('contentRing');
  if (ring) { ring.style.setProperty('--p', pct); ring.textContent = pct + '%'; }
  var avg = D.stats && D.stats.words && written ? Math.round(D.stats.words / written) : 0;
  var liveTracks = D.tracks.filter(function (t) { return t.status === 'live' && t.stats && t.stats.topics; });
  var health = document.getElementById('healthList');
  if (health) {
    health.innerHTML =
      liveTracks.map(function (t) {
        var s = t.stats;
        return '<div>' + esc(t.name) + '：<b style="color:var(--ink)">' + s.written + ' / ' + s.topics + '</b>' +
          (s.written < s.topics ? ' <span style="color:var(--amber)">待补 ' + (s.topics - s.written) + '</span>' : '') + '</div>';
      }).join('') +
      '<div>合计：<b style="color:var(--ink)">' + written + ' / ' + total + '</b> 篇</div>' +
      '<div>平均篇幅：<b style="color:var(--ink)">' + avg + '</b> 字/篇</div>' +
      '<div>原创图解：<b style="color:var(--ink)">' + (D.stats.diagrams || 0) + '</b> 张</div>' +
      '<div>总阅读量：<b style="color:var(--ink)">' + Math.round((D.stats.minutes || 0) / 60) + '</b> 小时</div>';
  }

  /* progress export / import */
  var exportBtn = document.getElementById('exportProgress');
  if (exportBtn) {
    exportBtn.addEventListener('click', function () {
      var payload = {
        app: 'zhizhan',
        version: 1,
        exportedAt: new Date().toISOString(),
        progress: App.readProgress()
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'zhizhan-progress.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
      App.toast('已导出学习进度');
    });
  }

  var importBtn = document.getElementById('importProgress');
  var importFile = document.getElementById('importFile');
  if (importBtn && importFile) {
    importBtn.addEventListener('click', function () { importFile.click(); });
    importFile.addEventListener('change', function () {
      var f = importFile.files && importFile.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(String(reader.result));
          var p = data && data.progress;
          if (!p || typeof p !== 'object') throw new Error('缺少 progress 字段');
          var merged = App.readProgress();
          Object.keys(p).forEach(function (k) { if (App.topicBySlug[k]) merged[k] = p[k]; });
          App.writeProgress(merged);
          App.toast('已导入 ' + Object.keys(p).length + ' 条进度');
          setTimeout(function () { location.reload(); }, 900);
        } catch (e) {
          App.toast('导入失败：不是有效的进度文件');
        }
      };
      reader.readAsText(f);
      importFile.value = '';
    });
  }

  renderChips();
  renderList();
})();
