# 参考文献（自动生成，来源：arXiv API 实测结果）

> 共 529 篇被综述引用；其中 0 篇不在本次抓取集合中（需人工核实）。

- **[Any Forcing: Any-Step Generality and One-Step Stability for Autoregressive Video Generation](https://arxiv.org/abs/2610.42031)**  
  Jiahua Xu, Yijie Fang, Nannan Wang et al. · arXiv:2610.42031 · 2026-10-30
  > Autoregressive video generation enables efficient inference through streaming prediction. However, existing methods are typically restricted to fixed sampling steps, limiting the flexibility to balance generation quality and efficiency, while one-step generati...

- **[HiState: Hierarchical Prefix Cache Management for Hybrid LLM Serving in Agentic Workloads](https://arxiv.org/abs/2610.41508)**  
  Zaifeng Pan, Lucas Wang, Xinwei Qiang et al. · arXiv:2610.41508 · 2026-10-30
  > Hybrid large language models combine full-attention and recurrent linear layers to reduce inference costs. Prefix caching can further reduce redundant computation across requests, but a recurrent checkpoint cannot recover an earlier state corresponding to a sh...

- **[ARK: Avoiding Routing Collisions for KV Cache Transfer in Disaggregated LLM Inference](https://arxiv.org/abs/2610.41160)**  
  Hung-Chun Lin, Ting-Wei Hsu, Chung-En Ho et al. · arXiv:2610.41160 · 2026-10-30
  > Disaggregated LLM inference separates the prefill and decode phases across GPU pools, generating massive KV-cache transfers. Because these transfers last hundreds of milliseconds to seconds, they behave as mega elephant flows that dominate link bandwidth utili...

- **[KV Cache Quantization for Diffusion Language Models](https://arxiv.org/abs/2610.39853)**  
  Yan Tai, Yunan Ding, Guangzhao Li et al. · arXiv:2610.39853 · 2026-10-29
  > KV cache quantization is well studied for autoregressive language models, where cached prefix states are exact under causal attention and quantization is mainly a cache reconstruction problem. Diffusion language models (dLLMs) break this assumption. Fast dLLM ...

- **[FlatCake: A Flat KVCache Storage Architecture for LLM Serving](https://arxiv.org/abs/2610.38355)**  
  Xin Huang, Teng Ma, Zhuoran Li et al. · arXiv:2610.38355 · 2026-10-28
  > KV cache reuse accelerates LLM serving, but existing systems manage host DRAM and NVMe SSD as a tiered hierarchy where DRAM acts as an intermediate cache. Production LLM workloads break both premises of this hierarchy. First, bimodal reuse defeats DRAM tempora...

- **[GAAC: Lossless KV Compression for Bandwidth-Efficient LLM Inference on Personal Devices](https://arxiv.org/abs/2610.38210)**  
  Yipin Guo, Arun M George, Siddharth Joshi · arXiv:2610.38210 · 2026-10-28
  > Weight-only, lossy quantization substantially reduces the storage and memory requirements for serving large language models (LLMs), but the growing key-value (KV) cache remains a bottleneck for long-context inference on personal devices. We present Group-Adapt...

- **[GAUSS: A Workload-Aware Analytical and Monte-Carlo Simulator for LLM Inference Serving](https://arxiv.org/abs/2610.37989)**  
  Srikant Bharadwaj, Ankur Mallick, Spyridon Mastorakis et al. · arXiv:2610.37989 · 2026-10-27
  > Large language model (LLM) inference has become an operational workload that fleets must provision, monitor, and bill against latency service-level objectives (SLOs). A single throughput number cannot answer the questions operators actually face, because gener...

- **[DCKV: Learned Transform Coding of the Prompt KV Cache in Hybrid Language Models](https://arxiv.org/abs/2610.36950)**  
  Egor Maximov, Aleksei Merkelov, Vasiliy Alekseev et al. · arXiv:2610.36950 · 2026-10-27
  > Hybrid language models keep a key-value (KV) cache only in their few full-attention layers, but this cache is still the part of a prompt's state that grows with the prompt and that must be stored or moved to reuse it. We present DCKV, a differentiable codec fo...

- **[WAKMan: Workload Aware KVCache Manager](https://arxiv.org/abs/2610.36355)**  
  Suhas Kumar Morisetty, Vaibhavi Lokegaonkar, Sachin Mathew Varghese et al. · arXiv:2610.36355 · 2026-10-26
  > Prefix caching enables a Large Language Model (LLM) servers to reuse the Key-Value (KV) states and accelerate prefill computation stage for requests that share a prefix with earlier prompts, thus reducing latency and serving cost. With limited memory resource,...

- **[The Right Fact, the Wrong Decision: SciValidityBench for Scientific Agent Memory](https://arxiv.org/abs/2610.34767)**  
  Yuexi Pan, Yongchao Chen · arXiv:2610.34767 · 2026-10-26
  > Most agent-memory benchmarks frame long-term memory as retrieval: can an agent recover the relevant record from a long and evolving history? Scientific agents face a stricter problem: a correctly remembered fact may still be invalid to use. The same reported t...

- **[Agent Memory as Recommendation: Recommender-System Design for Long-Term Memory of LLM Agents](https://arxiv.org/abs/2610.34673)**  
  Xinyu Zhang, Weiwei Sun · arXiv:2610.34673 · 2026-10-26
  > Large language model (LLM) agents that serve users across many sessions must choose, for every request, the few stored memories that enter a limited context window. This choice largely decides whether the agent answers correctly, and it runs on every request a...

- **[LLMs in Cloud: A Discussion on Architecture, Orchestration, and Inference](https://arxiv.org/abs/2610.33475)**  
  Jannatun Noor, Athar Noor Mohammad Rafee, Md. Sadman Haque et al. · arXiv:2610.33475 · 2026-10-24
  > The widespread deployment of foundational Large Language Models (LLM) across cloud datacenters marks a fundamental paradigm shift from stateless deep learning toward distributed, memory-intensive generative workloads. However, serving massive foundation models...

- **[KVStream: Adaptive Parallel Storage Management for KV Caching in Large-Scale LLM Serving](https://arxiv.org/abs/2610.31827)**  
  Avinash Maurya, Jaiaid Mobin, Jie Ye et al. · arXiv:2610.31827 · 2026-10-22
  > Long-context LLM serving for agentic, coding, and document workloads reuses prefixes whose key-value (KV) cache outgrows GPU and host memory, putting storage I/O on the critical path of the inference step for retrieving prefixes. A single node-local NVMe absor...

- **[SARIA: Persistence-Aware KV Caching with Coordinated DRAM--SSD Reload for LLM Agents](https://arxiv.org/abs/2610.31169)**  
  Hui Li, Qihui Zhou, Xiao Yan et al. · arXiv:2610.31169 · 2026-10-22
  > Multi-turn LLM agents usually reuse long context prefixes, making key value (KV) caching crucial for reducing prefill latency. SSDs provide a low-cost extension to limited DRAM capacity but introduce two key challenges. Eagerly persisting all KV cache blocks i...

- **[RIFT: KV Cache Compression for Draft Models with Complementary Compressibility Training](https://arxiv.org/abs/2610.31098)**  
  Dor Tsur, Maor Ashkenazi, Maximilian Golub et al. · arXiv:2610.31098 · 2026-10-22
  > Speculative decoding is a popular decode acceleration method. As such, it is particularly relevant to long-output generation, which requires an increasingly large KV cache. KV cache compression offers a way to constrain costs in long-context drafting. However,...

- **[Gandalf: Flash Shall Not Die! Increasing Flash Storage Lifetime for KV Cache Offloading in LLM Serving](https://arxiv.org/abs/2610.30791)**  
  Maharani A. P. Irawan, Kuntai Du, Jiayi Yao et al. · arXiv:2610.30791 · 2026-10-22
  > KV caching reduces the serving cost of large language models (LLMs), but the growing KV cache footprint is increasingly exceeds GPU and host-memory capacity. Therefore, people use SSD to expand the KV cache storage capacity with high I/O bandwidth. However, in...

- **[Is Complex Agentic Memory Always Needed? Naive RAG Is Stronger Than We Thought](https://arxiv.org/abs/2610.30755)**  
  Zhengye Bao, Shengtao Zhang, Haokai Zhang et al. · arXiv:2610.30755 · 2026-10-22
  > LLM memory is widely used in long-term conversation understanding. Agentic memory systems often use mutation, structural organization, learned retrieval strategies, or other complex operations. Is this complexity always necessary? We study Raw-RAG, a naive RAG...

- **[HAWK: Heterogeneity-Aware KV Cache Transfer for Efficient GPU-NPU Phase-Disaggregated LLM Inference](https://arxiv.org/abs/2610.29873)**  
  Junhyeok Park, Jungeun Yoon, Kyungmin Kim et al. · arXiv:2610.29873 · 2026-10-21
  > Large language model (LLM) inference exhibits distinct computational characteristics across its two phases: prefill is compute-intensive, whereas decode is more memory-bound. As a result, AI accelerators achieve varying levels of efficiency across the two phas...

- **[MoEZip: Routing-Aware KV Cache Compression for Sparse Mixture-of-Experts LLMs](https://arxiv.org/abs/2610.30206)**  
  Minsang Kim, Seungjun Baek · arXiv:2610.30206 · 2026-10-21
  > Mixture-of-Experts (MoE) language models scale model capacity efficiently by activating a small subset of parameters per token. However, in long-context inference, memory remains a major bottleneck because the KV cache grows linearly with sequence length. Exis...

- **[Double KV Cache Optimization on Apple Silicon: Block-FP4, Radial Quantization, and Fused Metal Kernels](https://arxiv.org/abs/2610.33076)**  
  Ibrokhimsho Abduchaborov · arXiv:2610.33076 · 2026-10-21
  > Key-value (KV) cache capacity and memory traffic are primary bottlenecks in long-context autoregressive inference. We evaluate five cache paths on an Apple Silicon M5 Max using MLX: a native bf16 baseline, block-scaled E2M1 FP4, a Python reference implementing...

- **[Cache Engineering for Agents](https://arxiv.org/abs/2610.28577)**  
  Tianyu Fu, Ruoxi Wang, Zihan Min et al. · arXiv:2610.28577 · 2026-10-20
  > Large Language Model (LLM) agents can handle increasingly complex tasks, navigating long trajectories of observations and actions. As these trajectories grow, key-value (KV) cache I/O and storage become the dominant cost. Trajectories can also exceed the LLM's...

- **[Whose Credential Is It? How Owner Attribution in Agent MemoryShapes Cross-User Account Misuse](https://arxiv.org/abs/2610.25707)**  
  Hau-Sing So, Daixian Liu, Carl Hou et al. · arXiv:2610.25707 · 2026-10-19
  > Shared long-term memory lets an LLM agent serving one user inadvertently retrieve another user's credentials, but it is unclear when such exposure leads to actual harm. We introduce a three-stage audit that separates three events: a foreign credential reaches ...

- **[gKSM: GPU Memory Deduplication at Driver Layer for Serverless LLM Inference](https://arxiv.org/abs/2610.25219)**  
  Shuheng Gao, Fan Guo, Yongkun Li et al. · arXiv:2610.25219 · 2026-10-18
  > In serverless LLM inference, cloud providers commonly locate multiple instances on a single GPU to improve utilization. However, each instance independently maintains its model weights and runtime state, making duplicate GPU memory the primary bottleneck. Memo...

- **[VS-Flash: Harnessing Vector Search with Computational Memory-Semantic Flash](https://arxiv.org/abs/2610.26960)**  
  Donguk Kim, Sangjun Pae, Daeyoung Lee et al. · arXiv:2610.26960 · 2026-10-18
  > As generative AI continues to evolve, retrieval-augmented generation (RAG) systems are driving rapid growth in vector database capacity requirements. As datasets outgrow host DRAM, vector databases rely on MMap-based serving over SSDs to extend capacity. Howev...

- **[RemoteANN: A Native Vector Search Engine for Cloud Object Storage](https://arxiv.org/abs/2610.25172)**  
  Yutong Gou, Silu Huang, Yue Wang et al. · arXiv:2610.25172 · 2026-10-18
  > Vector search engines built on cloud object storage have drawn growing attention from both academia and industry. These systems typically adopt a disaggregated storage-compute architecture, persisting the primary vector payload in object stores (e.g., Amazon S...

- **[SigmaTrace: Library-Agnostic Observability for CPU/GPU-Initiated RDMA Communication](https://arxiv.org/abs/2610.24328)**  
  Javid Baydamirli, Didem Unat · arXiv:2610.24328 · 2026-10-16
  > RDMA networking enables low-latency, high-bandwidth communication on large systems. Despite its adoption, however, observability is lacking. Existing tools target specific communication libraries or only report aggregated data, missing per-operation behavior. ...

- **[KVCompass: A Discovery Plane for Internet-Scale Prefix Cache Sharing in LLM Serving](https://arxiv.org/abs/2610.24179)**  
  Shiyi Ling, Fei Fang, Chen Qian · arXiv:2610.24179 · 2026-10-16
  > KV cache reuse is one of the most effective ways to reduce LLM inference cost, but today its benefits are largely confined to a single cluster. When a provider serves the same model across geographically distributed regions, each region may repeatedly prefill ...

- **[Stealthy Poisoning Attacks via Reused KV Cache of Reasoning](https://arxiv.org/abs/2610.22873)**  
  L. Zhu, Y. Jung, S. Szyller · arXiv:2610.22873 · 2026-10-16
  > Modern large language model (LLM) systems reuse key-value (KV) caches to accelerate inference. Recent work has shown that reusing KV caches from reasoning traces can also improve task performance, similar to retrieval-augmented generation (RAG). We demonstrate...

- **[MemLLM: End-to-end In-Storage Acceleration of On-device Retrieval-Augmented Generation using Precomputed KV Caches](https://arxiv.org/abs/2610.22579)**  
  Seungkwan Kang, Hyungseok Ko, Heemin Kim et al. · arXiv:2610.22579 · 2026-10-15
  > Retrieval-augmented generation (RAG) on edge devices enables personalized large language model (LLM) inference while preserving privacy. However, RAG's inherent length asymmetry makes the prefill phase the dominant bottleneck. While precomputing the KV caches ...

- **[Close Enough is Nowhere Near: Fidelity-Consumability Decoupling in KV Caches](https://arxiv.org/abs/2610.22016)**  
  Adam Deng, Shicheng Liu, Yada Zhu · arXiv:2610.22016 · 2026-10-15
  > Multi-agent LLM systems communicate in text, which is lossy and wasteful: the sender throws away the reading it already did. A growing literature instead transmits the KV cache, the natural carrier of that reading. We study the most appealing form of the idea:...

- **[ConStore: Search-Overlapped Prefetch and Co-Retrieval-Aware Content Storage for Disk-Based ANNS](https://arxiv.org/abs/2610.21676)**  
  Zhutao Zhuang, Nong Xiao, Zhiguang Chen et al. · arXiv:2610.21676 · 2026-10-15
  > Disk-based approximate nearest-neighbor search (ANNS) supports retrieval-augmented generation (RAG), search, recommendation, and advertising over corpora that exceed memory capacity. Existing ANNS research often focuses on vector search at small top-K, whereas...

- **[When the KV Cache Is Slower Than the GPU: Scaling Remote KV Tiers for Context-Parallel Prefill](https://arxiv.org/abs/2610.21500)**  
  Muhammad Ibrahim · arXiv:2610.21500 · 2026-10-15
  > Reusing the attention KV cache across requests is a standard way to cut prefill cost in long-context LLM serving, and production systems increasingly back the per-engine cache with a remote tier shared by every engine. We study such a tier in a disaggregated d...

- **[Characterizing Predictability-Latency Trade-offs of KV-Cache SSD Offloading in LMCache for LLM Serving Systems](https://arxiv.org/abs/2610.21249)**  
  Ying He, Dingsen Shi, Yanbo Dai et al. · arXiv:2610.21249 · 2026-10-15
  > KV-cache offload is widely used to stretch GPU memory for LLM serving, but its storage behavior has not been characterized at the block-device level. In this paper, we study LMCache through realworld multi-session workloads that span same/different context x s...

- **[Range: Decoupling KV-Cache Reuse Granularity from Storage Work](https://arxiv.org/abs/2610.21241)**  
  Dingsen Shi, Jiahao Zhang, Liqiang Lv et al. · arXiv:2610.21241 · 2026-10-15
  > LLM serving reuses cached key-value (KV) state to skip prefill, and growing contexts push that state past GPU HBM and CPU DRAM onto NVMe SSDs, placing prefix restore on the critical path of time-to-first-token (TTFT). We find that on a well-configured host-iss...

- **[MemCode: Discrete Semantic Representations for Long-Term Agent Memory](https://arxiv.org/abs/2610.19472)**  
  Xin Li, Liang Hu, Duoqian Miao et al. · arXiv:2610.19472 · 2026-10-14
  > Long-term memory remains a fundamental bottleneck for large language model (LLM) agents across sessions. Existing systems typically adopt a write-then-retrieve paradigm, storing context-dependent dialogue fragments and retrieving them via nearest-neighbor sear...

- **[Long-horizon Video Generation with Slot Memory Addressed By Region Tokens](https://arxiv.org/abs/2610.19257)**  
  Eren Cetin, Julius Erbach, Vukasin Bozic et al. · arXiv:2610.19257 · 2026-10-13
  > Memory for long-horizon video generation must satisfy two competing requirements: it must remain bounded so generation can continue indefinitely, while still recovering what was observed at a place when the camera returns, regardless of how long ago it was see...

- **[RadixFlow: Filling Execution Bubbles in Prefix-Cached Hybrid LLM Serving](https://arxiv.org/abs/2610.18143)**  
  Huihao Jing, Wenbin Hu, Shaojin Chen et al. · arXiv:2610.18143 · 2026-10-13
  > Prefix reuse improves LLM inference by sharing the KV cache of common prompt prefixes. This helps only if the scheduler can execute a matched branch in the current worker round. Schedulers assume that a matched prefix is ready, which holds for full attention b...

- **[Can Agents Forget When Asked? A Benchmark for Memory Unlearning in LLM Agents](https://arxiv.org/abs/2610.18052)**  
  Bofan Xie, Chaokun Wang, Guanchen Ge et al. · arXiv:2610.18052 · 2026-10-13
  > Long-term memory has become a core component of large language model (LLM) agents. As agents accumulate personal information over long-term use, users increasingly ask them to delete sensitive or outdated facts. A memory system should honor such requests. It s...

- **[Memory Echo in Single-Agent Long-Term Memory: Lifecycle Evaluation and Provenance-Guided Mitigation](https://arxiv.org/abs/2610.17763)**  
  Yufeng Li, Sheng Yao, Peng Zeng et al. · arXiv:2610.17763 · 2026-10-13
  > Long-term memory supports agents across sessions. Repeated retrieval and write-back can let one historical claim occupy multiple retrieval positions and influence current answers without independent evidence. Existing work examines retrieval, updating, and que...

- **[Approximation Algorithms for Dual-Memory Request Scheduling in Disaggregated LLM Inference](https://arxiv.org/abs/2610.15579)**  
  Xin Wang, Hong Shen, Hui Tian et al. · arXiv:2610.15579 · 2026-10-11
  > Disaggregated LLM inference executes the prefill and decode phases on separate resource pools, reducing interference between the two phases. However, this architecture introduces a coupled scheduling problem because a request that completes prefill retains its...

- **[SAFE-KV: Causal Suffix Repair for Behavior-Preserving Non-Prefix KV Cache Reuse in RAG](https://arxiv.org/abs/2610.15186)**  
  Xingjian Zhang · arXiv:2610.15186 · 2026-10-10
  > Retrieval-augmented generation (RAG) reuses the same documents across many requests, making non-prefix KV-cache reuse attractive. Yet a cached document state is not reusable text: it is a context-conditioned causal state whose keys and values depend on the pre...

- **[KV-Repurpose: A Testbed for Evaluating Non-Prefix KV-Cache Reuse](https://arxiv.org/abs/2610.13060)**  
  Taiga Ikeda, Daisuke Miyashita, Jun Deguchi · arXiv:2610.13060 · 2026-10-09
  > KV-cache reuse in large language model serving is commonly limited to exact prompt prefixes, preventing reuse when the same retrieved document appears after different system prompts, conversation histories, or dynamic metadata. We present KV-Repurpose, an open...

- **[Execution-Feasible Dispatch of LLM Pre-training Loads for Renewable-Dominant AI Data Centers](https://arxiv.org/abs/2610.13047)**  
  Xi Tong, Ershun Du, Haiyang Jiang et al. · arXiv:2610.13047 · 2026-10-09
  > AI data centers (AIDCs) are emerging as large power-system loads, making their operational flexibility increasingly valuable. Existing studies often treat AIDC demand as continuously adjustable or generically delay-tolerant, which overstating the flexibility o...

- **[PredictIO: Decoupling Workload Prediction from OS-Controlled Storage Prefetching](https://arxiv.org/abs/2610.12971)**  
  Jun Lu, Yancan Mao, Zhenya Ma et al. · arXiv:2610.12971 · 2026-10-09
  > Storage stalls remain a significant source of application latency even on fast storage devices. Prefetching can hide part of this latency by fetching data before it is demanded, but general-purpose operating-system mechanisms typically infer future accesses fr...

- **[Deploying RDMA for Distributed Inference and Training At Scale](https://arxiv.org/abs/2610.12815)**  
  Yibo Huang, Yi Cui, Yukai Huang et al. · arXiv:2610.12815 · 2026-10-08
  > RDMA can reduce communication overhead in distributed machine learning systems, but realizing these benefits in production requires more than replacing TCP. Variable-size messages, concurrent connections, bursty incasts, and service failures introduce challeng...

- **[Real Long-Term Memory for AI: A 50-Million-Token Window That Is Faster and Cheaper Than Recompute](https://arxiv.org/abs/2610.10845)**  
  Sietse Schelpe · arXiv:2610.10845 · 2026-10-07
  > A large language model can only use the text that fits in its context window, and it recomputes its internal key-value (KV) state for a prompt every time the prompt is sent. We test a memory layer, the public package galahad-kv, that saves the KV state of each...

- **[RiftANN: Efficient Graph Traversal for Vector Search with RDMA-Based Memory Disaggregation](https://arxiv.org/abs/2610.08990)**  
  Qi Lin, Zhenyu Zhang, Jun Kong et al. · arXiv:2610.08990 · 2026-10-06
  > Graph indexes for billion-scale vector collections can exceed a single server's DRAM capacity. Passive RDMA-based disaggregated memory provides scalable capacity without memory-node computation, but conventional best-first search performs poorly in this settin...

- **[FailBench: Evaluating Fault Tolerance Across Distributed Training Architectures](https://arxiv.org/abs/2610.07688)**  
  Khaled Aljbab, Amine Barrak · arXiv:2610.07688 · 2026-10-06
  > Distributed deep learning relies on data, pipeline, tensor, and hybrid parallelism, yet fault-tolerance mechanisms are typically evaluated only on the architecture for which they were designed. This leaves practitioners with little guidance when choosing mecha...

- **[Harmful SFT Leaves a Continuous Trace in LLM Checkpoint Updates](https://arxiv.org/abs/2610.07518)**  
  Ziqun Bao, Xinyu Zhang, Yuchen Shao et al. · arXiv:2610.07518 · 2026-10-05
  > Safety auditing of post-trained large language models typically relies on model behavior, requiring model execution and depending on the coverage of available evaluations. This work asks a different question: Do the target behaviors optimized during supervised...

- **[Can Agent Harnesses and Inference Engines Hear Each Other? The HEAR Protocol for Agentic LLM Serving](https://arxiv.org/abs/2610.06597)**  
  Jiaqi Zhao, Haodong Chen, Jitai Hao et al. · arXiv:2610.06597 · 2026-10-05
  > LLM agents increasingly execute complex workflows involving multi-turn reasoning, tool use, and parallel agents. Efficient serving requires decisions that span two layers with complementary information: the agent harness understands workflow dependencies, cont...

- **[Behavior-Preserving KV Cache Compression](https://arxiv.org/abs/2610.06479)**  
  Doo Hwan Hwang, Junyoung Jang, Junho Na et al. · arXiv:2610.06479 · 2026-10-05
  > KV caches are a major bottleneck in long-context inference and long-form generation with large language models. Existing training-free eviction policies largely rely on proxy importance signals, such as attention mass, to decide which past tokens to retain. We...

- **[DeferKV: Rethinking Eviction Timing for One-Shot KV Cache Compression](https://arxiv.org/abs/2610.06286)**  
  Zhe Wang, Jiakai Li, Yujia Sun et al. · arXiv:2610.06286 · 2026-10-05
  > Long-context large language models (LLMs) have demonstrated strong capabilities across a wide range of tasks, but the growing KV cache introduces substantial memory and inference overhead. Existing one-shot KV cache compression methods typically commit to irre...

- **[Request Order Matters: Cache-History Sensitivity in Selective KV-Cache Reuse for Rolling Agents](https://arxiv.org/abs/2610.05833)**  
  Tiffany Gu, Annie Guan, Manshu Huang et al. · arXiv:2610.05833 · 2026-10-05
  > Long-running agents repeatedly call an LLM while retaining most of their document window, evicting old documents, and appending new ones. These rolling updates break exact prefix caching and motivate non-prefix KV-cache reuse with selective recomputation. We s...

- **[KV$^2$: A Self-Refining KV Cache](https://arxiv.org/abs/2610.03198)**  
  Johannes Wesch, Danni Liu, Jan Niehues · arXiv:2610.03198 · 2026-10-02
  > The memory footprint of the key-value (KV) cache constrains the practical use of long-context models, and it dominates cost when one prefilled context must later serve many different queries. In this reusable setting, query-agnostic compression trades cost aga...

- **[iS-KV: Online Low-Rank KV Cache Compression via Block-Incremental SVD](https://arxiv.org/abs/2610.02815)**  
  Yiren Zhao, Guanghui Song, Tianrui Qin et al. · arXiv:2610.02815 · 2026-10-02
  > Long chain-of-thought reasoning substantially increases KV-cache memory during autoregressive decoding, as every generated token introduces new key and value states and causes the cache to grow linearly with decoding length. Existing KV-cache compression metho...

- **[Exact Memory-Time Optimization for Prefix-Cached Language Model Serving](https://arxiv.org/abs/2610.02766)**  
  Shivam Gupta · arXiv:2610.02766 · 2026-10-02
  > Retaining language-model prefix states trades recomputation against storage time. Optimizing each cached block independently can overcount savings: a resident block is usable only when the required preceding prefix is also available. We introduce Prefix-Certif...

- **[RaBitQ-SSD: Split Codes and Pipelined I/O for SSD-Resident Vector Search](https://arxiv.org/abs/2610.02652)**  
  Yuexuan Xu, Jianyang Gao, Michael Norris et al. · arXiv:2610.02652 · 2026-10-02
  > SSD-resident approximate nearest-neighbor search is essential when vector collections exceed DRAM capacity. The challenge is to reduce SSD reads and hide I/O latency through concurrent reads and overlap with computation. However, for graph-based search, progre...

- **[Spatial Memory Intelligence: Endowing World Models with Understanding-Driven Long-Term Memory](https://arxiv.org/abs/2610.02521)**  
  Ying Yang, Guiyu Zhang, Lianghua Huang et al. · arXiv:2610.02521 · 2026-10-01
  > Long-video generation and world models have shown strong potential for interactive entertainment and embodied simulation by predicting future observations conditioned on user actions and historical memory. However, as memory sequences grow longer and their str...

- **[MemFit: Efficient Long-Term Agentic Memory](https://arxiv.org/abs/2610.00872)**  
  Mitchell Piehl, Muchao Ye · arXiv:2610.00872 · 2026-10-01
  > Long-term memory systems for large language models (LLMs) have gained popularity for extending reasoning capabilities across applications. Current memory systems rely on LLM agents to organize and consolidate memory, resulting in costly, inefficient write oper...

- **[PatchKV: Weight-Space Compensation of KV Cache](https://arxiv.org/abs/2609.39329)**  
  Chanryeol Lee, Chanhyuk Lee, Yeonwoo Choi et al. · arXiv:2609.39329 · 2026-09-30
  > Long-context inference with Large Language Models (LLMs) is bottlenecked by the linearly growing memory of the key-value (KV) cache. Existing compression methods reduce the cache through token eviction or approximation, but degrade sharply at aggressive compre...

- **[Characterizing High Bandwidth Flash for LLM Serving](https://arxiv.org/abs/2609.39131)**  
  Zack Yu, Chloe Wong, Coleman Hooper et al. · arXiv:2609.39131 · 2026-09-30
  > Large language model (LLM) serving requires substantial memory to store model weights and KV caches. As models grow larger and contexts become longer, memory capacity and bandwidth increasingly become bottlenecks for serving performance. Agentic workloads comp...

- **[Honeycomb: Constant-Size Scene Memory Representation for Video World Models](https://arxiv.org/abs/2609.37690)**  
  Jack Wei Lun Shi, Kaichen Zhou, Haoyu Chen et al. · arXiv:2609.37690 · 2026-09-29
  > Video world models require persistent scene memory to maintain consistency during long-horizon video generation. Existing spatial memories accumulate RGB observations or latent features, increasing storage requirements as generation proceeds. We introduce Hone...

- **[Trajectory Soup: Pushing the Compute-Scaling Frontier of LLM Mid-training via Diverse Trajectories](https://arxiv.org/abs/2609.37169)**  
  Zhehao Huang, Changxin Tian, Qingyuan Yang et al. · arXiv:2609.37169 · 2026-09-29
  > Mid-training equips pretrained large language models with specialized and reasoning capabilities, but the returns of this stage are bounded since additional serial compute yields little further downstream improvement and can even degrade some capabilities, whi...

- **[Efficient Agentic LLM Serving over SSD-based Sparse KV Storage](https://arxiv.org/abs/2609.36938)**  
  Wenhao He, Ping Zhang, Xiaohe Hu et al. · arXiv:2609.36938 · 2026-09-29
  > Agentic sessions driven by Large language models (LLMs) often alternate between model inference and tool use, accumulating long histories across successive rounds. Serving these sessions efficiently requires reducing attention computation and retaining history...

- **[CacheRepair: Learning to Repair Cross-Chunk Context in RAG for KV Cache Fusion](https://arxiv.org/abs/2609.35139)**  
  Genglin Wang, Wangsong Yin, Yeerzhati Abudunuer et al. · arXiv:2609.35139 · 2026-09-28
  > Multi-document retrieval-augmented generation (RAG) requires a language model to process multiple retrieved text chunks before answering a question. Precomputing each chunk's KV cache independently and concatenating the caches when the chunks are retrieved can...

- **[TempoKV: Timely Staging of LLM KV Caches for Memory-Semantic Flash](https://arxiv.org/abs/2609.35065)**  
  Jay H. Park, Hyungjun Kim, Dong Kim · arXiv:2609.35065 · 2026-09-28
  > Reusable prefix key-value (KV) caches can outgrow GPU memory in large language model (LLM) serving. A memory-semantic flash hierarchy offers SSD-backed capacity with a limited fast tier, but a logical KV hit is not necessarily ready for GPU retrieval. Demand s...

- **[PulseInfer: I/O-Centric Sparse KV Cache Offloading for Efficient Long-Context LLM Decoding](https://arxiv.org/abs/2609.34555)**  
  Qiuyang Zhang, Kai Zhou, Kai Lu et al. · arXiv:2609.34555 · 2026-09-28
  > Long-context LLM serving is increasingly bottlenecked by decode, where large KV caches limit batch size and underutilize GPUs. Sparse KV cache offloading expands effective capacity by storing most historical KV blocks in CPU DRAM and recalling only selected bl...

- **[RelaxKV: Recomputation Guided by the Query with Sparse Context Attention for Efficient KV Cache Reuse](https://arxiv.org/abs/2609.33503)**  
  Ruoling Qi, Yirui Liu, Xuaner Wu et al. · arXiv:2609.33503 · 2026-09-27
  > Cross-request KV caching reduces the prefill cost of Retrieval-Augmented Generation (RAG), but conventional prefix caching severely limits cache reuse across requests. Position-Independent Caching (PIC) removes this constraint by reusing independent chunks, bu...

- **[Just Let Linear States Forget the Distant Past: Prefix Caching via Suffix Replay for Hybrid LLMs](https://arxiv.org/abs/2609.33477)**  
  Yirui Liu, Ruoling Qi, Xuaner Wu et al. · arXiv:2609.33477 · 2026-09-27
  > Hybrid LLMs interleave full-attention layers with linear-attention layers to reduce long-context inference cost, but this structure complicates prefix caching. Full-attention KV caches are token-addressable, whereas linear-attention layers maintain recurrent s...

- **[Tessera: Demand-Driven KV Cache Management for Retrieval-Augmented LLM Serving](https://arxiv.org/abs/2609.32999)**  
  Fei Fang, Chung-Hsiang Lo, Yi Liu et al. · arXiv:2609.32999 · 2026-09-26
  > RAG and retrieval-based agent memory both inject retrieved content into LLM prompts, as document chunks and recalled memory records, respectively. The same content can recur across requests at different prompt positions or after different preceding contexts, p...

- **[RR-Evict: Fine-Grained Prefix Cache Eviction beyond LRU for Agentic LLM Serving](https://arxiv.org/abs/2609.32278)**  
  Zaifeng Pan, Chris Wu, Zhengding Hu et al. · arXiv:2609.32278 · 2026-09-26
  > LLM-based agents execute long-horizon tasks through repeated model calls interleaved with tool execution and user interaction. As each call extends the history accumulated in previous turns, prefix caching avoids repeated prefill of the agent's entire context....

- **[Evaluating the accuracy of KV cache reuse techniques](https://arxiv.org/abs/2609.31415)**  
  Samuel Cestola, Tianxiang Xia, Pengfei Zheng et al. · arXiv:2609.31415 · 2026-09-25
  > Position-independent KV cache reuse aims to reduce latency in retrieval-augmented generation by reusing chunk-level KV caches across prompts. We show that current evaluations of KV cache reuse techniques rely on measurements that fail to faithfully capture the...

- **[The KV Cache Is the New Memory Wall](https://arxiv.org/abs/2609.30854)**  
  Tejinder Singh · arXiv:2609.30854 · 2026-09-25
  > Autoregressive LLM inference at long context is bounded by memory bandwidth, not arithmetic throughput, and the binding resource shifts from model weights to the Key-Value (KV) cache as sequence length grows. For Llama-3-70B in BF16, the 140 GB weight footprin...

- **[When Fancy Eviction Fails: Rethinking Cache Replacement For LLM Prefix Reuse](https://arxiv.org/abs/2609.28870)**  
  Yiyu Liu, Minlan Yu, Juncheng Yang · arXiv:2609.28870 · 2026-09-24
  > Long-running LLM applications repeatedly send growing context, making prefix caching critical for reducing prefill cost. Yet prefix-cache behavior under agentic workloads remains poorly understood. We study production traces from two companies and evaluate 14 ...

- **[The Past Frames the Future: Memory for Autoregressive Video Generation](https://arxiv.org/abs/2609.28466)**  
  Harold Haodong Chen, Rongjin Guo, Disen Lan et al. · arXiv:2609.28466 · 2026-09-23
  > Advances in generative models have improved video fidelity, enabling long-horizon generation, interactive world modeling, and evolving visual environments. Autoregressive (AR) video generation extends visual sequences through causal rollouts. However, a fundam...

- **[The KV Cache Working Set: Online Capacity Planning for LLM Inference Systems](https://arxiv.org/abs/2609.27746)**  
  Luchang Li, Shuaishuai Wang, Zhao Ruan et al. · arXiv:2609.27746 · 2026-09-23
  > Prefix caching is critical for efficient large language model (LLM) serving, particularly for agentic workloads that repeatedly invoke the model with a growing conversation and tool-use history. By reusing the key-value (KV) states of previously processed pref...

- **[EnSIMem: Entity-Structured Indexing for Long-Term Agent Memory](https://arxiv.org/abs/2609.27279)**  
  Xuanyu Meng, Xing Fan, Xinyi Fan et al. · arXiv:2609.27279 · 2026-09-23
  > An agent that interacts with users over long periods must recall facts, preferences, events, and changes from a continuously growing interaction history. Existing memory systems often compress interactions into generic summaries or retrieve anonymous text chun...

- **[LayerCheck: Adaptive Layer-wise Checkpointing for Large Language Model Post-training](https://arxiv.org/abs/2609.27193)**  
  Minqiu Sun, Xin Huang, Luanzheng Guo et al. · arXiv:2609.27193 · 2026-09-23
  > With the rising computational and monetary costs of training large language models (LLMs), checkpointing---periodically storing model states for recovery---becomes essential for fault tolerance. Conventional checkpointing entails a severe trade-off between che...

- **[SARA: SLO-Aware Resource Allocation for Disaggregated Agentic LLM Services](https://arxiv.org/abs/2609.26763)**  
  Shicong Liu, Xianghao Yu, Zhen Gao et al. · arXiv:2609.26763 · 2026-09-22
  > Recent advances in large language models (LLMs) are driving the emergence of multi-modal and agentic services for mobile users through cloud and edge infrastructures, where long-context workloads pose daunting challenges for inference latency. Existing disaggr...

- **[Privacy-Preserving Coordinated Operation of Power Grids and AI Data Centers: A Checkpoint-Aware Three-Phase Scheme](https://arxiv.org/abs/2609.26365)**  
  Ziang Liu, Ruizhang Yang, Xin Cui et al. · arXiv:2609.26365 · 2026-09-22
  > The rapid growth of large language model training and serving is driving AI data centers (AIDCs) toward gigawatt scale. Unlike conventional commercial loads, AIDCs possess significant operational flexibility through dynamic voltage and frequency scaling (DVFS)...

- **[DolphinBench: Mapping the Pareto Frontier of Agent Memory](https://arxiv.org/abs/2609.24971)**  
  Soumil Rathi, Deshraj Yadav, Taranjeet Singh · arXiv:2609.24971 · 2026-09-21
  > Agents today often take real-world actions that depend on long-term memory and context recall over time. However, most current memory benchmarks are built for a conversational question-answer format, where the question itself signals that some fact must be ret...

- **[Bridging LLM Serving and CXL-SSDs with Chunk-Aware KV Cache Management](https://arxiv.org/abs/2609.26828)**  
  Hyunsun Chung, Taewan Noh, Minji Kim et al. · arXiv:2609.26828 · 2026-09-20
  > NAND-backed storage offers the capacity needed to scale LLM prefix caching, but its block I/O path incurs CPU cache contention and host-DRAM staging in addition to NAND latency. Our characterization shows that these interface costs persist even with DRAM as th...

- **[DeepSeek Elastic Compute (DSec): A Sandbox Infrastructure for Effective Agentic Training at Scale](https://arxiv.org/abs/2609.22978)**  
  Jialiang Huang, Hongxuan Tang, Jingchang Chen et al. · arXiv:2609.22978 · 2026-09-19
  > Large-scale agentic training and evaluation with large language models (LLMs) rely on isolated, stateful execution environments in which models inspect repositories, invoke tools, execute commands, and interact with task-specific services. These workloads crea...

- **[TierKV: Long-Context On-Device LLMs via Predictive Multi-Tier KV Caching](https://arxiv.org/abs/2609.21172)**  
  Zhihao Shu, Md Musfiqur Rahman Sanim, Jie Hu et al. · arXiv:2609.21172 · 2026-09-18
  > Large language models (LLMs) are moving onto mobile devices for increasingly diverse workloads over text, images, video, and audio. These applications often require long contexts, making the Key-Value (KV) cache a dominant memory bottleneck because it grows li...

- **[Zero-I/O Fault Recovery for Sharded Deep Learning via Dynamic Framework Dependency Rebinding](https://arxiv.org/abs/2609.18178)**  
  Genlang Chen, Junyi Zhu · arXiv:2609.18178 · 2026-09-16
  > Distributed model training at scale is frequently interrupted by transient network failures, conventionally forcing cluster managers to abort all processes and roll back to the latest checkpoint. While periodic checkpointing provides durability, frequent snaps...

- **[Token Latency Fairness: Performance Isolation for Multi-Tenant LLM Serving](https://arxiv.org/abs/2609.18112)**  
  Dev Bali, Soujanya Ponnapalli, Yichuan Wang et al. · arXiv:2609.18112 · 2026-09-16
  > LLM serving is typically offered as a shared, multi-tenant service, where high-demand workloads from one client can cause latency SLO violations for others. Existing solutions for performance isolation equalize client throughput in the long run, for example th...

- **[Towards Training Private LLMs: Exploring Fine-Tuning Language Models on Apple Silicon with RDMA over Thunderbolt](https://arxiv.org/abs/2609.18066)**  
  En-Ming Huang, Yao-Ting Hsieh, Hsiang-Yu Tsou et al. · arXiv:2609.18066 · 2026-09-16
  > Private large language model (LLM) fine-tuning is increasingly important for organizations that need to adapt models using sensitive data, but it often exceeds the memory capacity of commodity datacenter accelerators. Apple Silicon offers a different design po...

- **[Where Should the KV Cache Live? Placement Policies Across GPU, CPU, and SSD for Long-Lived Sessions](https://arxiv.org/abs/2609.16215)**  
  Srikanta Datta Tumkur, Jay Iyer, Mehar Simhadri et al. · arXiv:2609.16215 · 2026-09-14
  > GPU high bandwidth memory is scarce and expensive, and KV caches consume much of it as chats, agent loops, and document question answering accumulate state. Systems such as Mooncake, LMCache, FlexGen, InfiniGen, and AttentionStore extend GPU memory with CPU DR...

- **[Calibrate, Then Route: A Measured Study of Learned Request Routing for Disaggregated LLM Serving](https://arxiv.org/abs/2609.16206)**  
  Srikanta Datta Tumkur, Jay Iyer, Mehar Simhadri et al. · arXiv:2609.16206 · 2026-09-14
  > Disaggregated LLM serving places compute heavy prefill and memory heavy decode on separate GPU pools. Systems such as DistServe, Splitwise, and Mooncake make this separation fast, but routing still determines which instances handle each request. We study a rou...

- **[LLM Inference in a Flash!](https://arxiv.org/abs/2609.16161)**  
  Sebastian Zhao, Minseo Kim, Coleman Hooper et al. · arXiv:2609.16161 · 2026-09-14
  > Large Language Models (LLMs) have shown impressive capabilities across a range of natural language processing tasks, and LLM inference has emerged as a critical workload for enabling downstream applications. The demands of serving LLM inference are becoming in...

- **[mKernel: Fast Multi-GPU, Multi-Node Fused Kernels](https://arxiv.org/abs/2609.13585)**  
  Ziming Mao, Yihan Zhang, Shawn Wei Chew et al. · arXiv:2609.13585 · 2026-09-11
  > Communication has become a bottleneck in distributed training and inference of large models. Overlapping communication with computation at the granularity of kernels, on separate streams, reduces only part of this communication cost. Fused kernels often have b...

- **[SeqMoE: Toward Full-Load Performance via Predictive and Graph-Compatible MoE Offloading](https://arxiv.org/abs/2609.12978)**  
  Zihan Wang, Yuqi Wang, Lei Gong et al. · arXiv:2609.12978 · 2026-09-11
  > Mixture-of-Experts (MoE) creates a structural advantage for offloading: only a small fraction of activated experts need to reside in device memory, and if they can be loaded in time for computation, offloading can in principle approach full-load performance, w...

- **[RoofLang: Enabling AI-Driven Architecting of LLM Inference Systems](https://arxiv.org/abs/2609.12551)**  
  Ziyue Yang, Yuting Jiang, Lei Qu et al. · arXiv:2609.12551 · 2026-09-11
  > AI is beginning to make substantive contributions to LLM inference optimization. Existing AI optimizations are predominantly profiling-based. Profiling-bound feedback confines the search to the capabilities and performance of an existing software stack, preven...

- **[Composable CXL Memory as a Kubernetes-Native Shared Memory for LLM Serving](https://arxiv.org/abs/2609.10790)**  
  Hongjian Fan, Kevin Zhang, David Habinsky et al. · arXiv:2609.10790 · 2026-09-09
  > We present a Kubernetes Dynamic Resource Allocation (DRA) driver that makes composable CXL memory a schedulable cluster resource, and evaluate the resulting shared-memory tier for cross-node KV-cache reuse in LLM serving. The driver composes CXL regions on dem...

- **[KVShareArena: KV-Cache Reuse Across Contexts and Model Checkpoints](https://arxiv.org/abs/2609.10266)**  
  Xi Shi, Mengxin Zheng, Qian Lou · arXiv:2609.10266 · 2026-09-09
  > Reusing key-value (KV) caches speeds up LLM inference by avoiding repeated computation on shared text. Standard prefix caching reuses a KV cache only when the LLM is the same and all preceding text is identical, but real workloads often break both conditions: ...

- **[Jacap: Robust KV Cache Eviction via Jacobian-Based Nonlinear Information Capacity Preservation](https://arxiv.org/abs/2609.08131)**  
  Jiaming Yang, Chenwei Tang, Liangli Zhen et al. · arXiv:2609.08131 · 2026-09-08
  > Key-value (KV) cache eviction is essential for scaling long-context inference in Large Language Models. However, existing policies predominantly rely on empirical heuristics, lacking a rigorous characterization of token utility under the inherently nonlinear s...

- **[Deadline-Aware Adaptive Prefill Chunking for Efficient Large Language Model Serving](https://arxiv.org/abs/2609.07883)**  
  Siyu Song, Qi Bai, Jinbo Hao et al. · arXiv:2609.07883 · 2026-09-07
  > Continuous batching improves large language model (LLM) serving throughput, but long prompt prefills can delay decode iterations and violate inter-token latency objectives. Chunked prefill mitigates this interference, yet its chunk size is normally fixed: smal...

- **[Enabling High-Bandwidth Flash for Generative Recommendation Serving with Write-Aware KV Cache Policy](https://arxiv.org/abs/2609.07175)**  
  Danni Peng, Kai Wu, Tianyu Zuo et al. · arXiv:2609.07175 · 2026-09-07
  > Generative recommendation (GR) systems increasingly leverage user-level KV cache reuse to avoid recomputing long user histories. However, the growing KV cache capacity and bandwidth requirements introduce new challenges for memory system. High-Bandwidth Flash ...

- **[Unified AI Gateway: A Framework for Joint Model Routing and KV Cache Management](https://arxiv.org/abs/2609.06940)**  
  Jiaxun Lu, Xiang Zhang, Yunfeng Shao · arXiv:2609.06940 · 2026-09-07
  > Large language model (LLM) inference increasingly spans models that differ in size, capability, price, and provider. This shift creates two costs for developers. One is the integration cost of choosing among and switching between many models. The other is the ...

- **[SGD-KV: Summarization Guided KV Cache Compression](https://arxiv.org/abs/2609.03235)**  
  Zeyu Liu, Woomin Song, Xuandi Fu et al. · arXiv:2609.03235 · 2026-09-03
  > Large language models (LLMs) face severe memory bottlenecks in long-context inference due to the linearly growing size of key-value (KV) caches. Existing KV cache compression techniques typically rely on simple heuristics, overlooking the distinct functional r...

- **[mzCache: On-Device LLM Memory Management under Multitasking](https://arxiv.org/abs/2609.01338)**  
  Hongseung Yu, Minsung Kim, Jongseok Park et al. · arXiv:2609.01338 · 2026-09-01
  > On-device mobile Large Language Model (LLM) inference is gaining significant attention. However, mobile devices operate in highly dynamic multitasking environments where users frequently switch between applications. This creates memory pressure, forcing LLM me...

- **[Faithfulness Is Not Free: Auditing Offline KV-Cache Quantization in Retrieval-Augmented Generation](https://arxiv.org/abs/2608.30996)**  
  Atta Ul Asad, Ahsan Bilal, Muhammad Ali et al. · arXiv:2608.30996 · 2026-08-31
  > Retrieval-augmented generation systems can precompute and store key-value caches of retrieved documents to avoid re-encoding context at every query. Quantizing these caches further reduces storage, but no prior work asks whether compression damages faithfulnes...

- **[Tail-Replay: Escaping the Curse of Linear Attention in Prefix Caching for Hybrid LLMs](https://arxiv.org/abs/2608.30310)**  
  Yirui Liu, Ruoling Qi, Xuaner Wu et al. · arXiv:2608.30310 · 2026-08-31
  > Hybrid large language models interleave full-attention layers with linear-attention layers to reduce the cost of long-context inference. This structure complicates prefix caching: full-attention key-value caches are token-addressable, whereas linear-attention ...

- **[Understanding Stage-Wise Utility-Risk Trade-offs in LLM Agent Memory](https://arxiv.org/abs/2608.30177)**  
  Chuanchao Zang, Zijian Cao, Xiangtao Meng et al. · arXiv:2608.30177 · 2026-08-31
  > Long-term memory is becoming a core capability of LLM agents, enabling personalization and long-horizon interaction. However, memory mechanisms that retain, transform, or expose more information can affect both benign utility and susceptibility to memory poiso...

- **[AI Hardware Accelerators for Large Language Models: Architectures and the Memory Wall](https://arxiv.org/abs/2608.28048)**  
  Siddharth Patel, Rohit Singh · arXiv:2608.28048 · 2026-08-28
  > Large language models (LLMs) place unprecedented and still-growing demands on the hardware that trains and serves them. This review surveys the full landscape of AI hardware accelerators for LLMs, including general-purpose GPUs, custom ASICs such as TPUs, Trai...

- **[PolyMemDB: A Polyglot Database System for AI Memory Management](https://arxiv.org/abs/2608.25577)**  
  Yu Wang, Jiaheng Lu · arXiv:2608.25577 · 2026-08-26
  > With the widespread adoption of personal intelligent agents, users generate massive, heterogeneous data during long-term interactions. Leveraging this data as long-term memory helps reduce token overhead and deliver personalized experiences. However, existing ...

- **[Hydra: Phase-Aware Workload Characterization of LLM Inference across Edge SoC Generations, Backends, and Quantization Levels](https://arxiv.org/abs/2608.25053)**  
  Amir Taherin, Sana Taghipour Anvari, Charles Amante et al. · arXiv:2608.25053 · 2026-08-25
  > Edge LLM deployment is shaped by more than model size and precision: inference backend, hardware platform, memory traffic, and power management all affect latency and efficiency. We present Hydra, a common-schema, phase-aware workload characterization framewor...

- **[Elastic KV Cache for LLM Serving:A Working Reclamation Mechanism, and Why Chunked Prefill Already Closes the Gap](https://arxiv.org/abs/2608.23658)**  
  Sathishkumar Sivashanmugam · arXiv:2608.23658 · 2026-08-24
  > An LLM serving engine sizes its key-value (KV) cache once, at startup, permanently setting aside a reserve for the worst-case prefill activation. During decode-dominant phases that reserve sits idle, yet it cannot be handed to the KV pool because it is exactly...

- **[PowerSlider: Exploiting Phase Asymmetry for LLM Serving under Demand Response](https://arxiv.org/abs/2608.21719)**  
  Yueying Li, Jiayang Chen, Yuanfan Chen et al. · arXiv:2608.21719 · 2026-08-22
  > AI inference clusters are increasingly constrained by instantaneous power, not just energy: grid operators condition new capacity on demand response, imposing time-varying power caps. Existing LLM serving systems optimize a static energy objective or shed fixe...

- **[Harness the Memory: A Holistic Evaluation of Memory Substrates in Memory Agents](https://arxiv.org/abs/2608.15008)**  
  Wei-Chieh Huang, Weizhi Zhang, Yuchen Wu et al. · arXiv:2608.15008 · 2026-08-15
  > Memory is becoming core infrastructure for long-horizon LLM agents, yet existing evaluations offer limited guidance on which memory substrate, namely the underlying medium in which memory is represented and stored, should be used under different operating regi...

- **[KV Cache Compression Through the Lens of Transform Coding](https://arxiv.org/abs/2608.14191)**  
  Hannah Laus, Claudio Mayrink Verdun, Hao Wang et al. · arXiv:2608.14191 · 2026-08-14
  > The key-value (KV) cache stores information from past tokens and is a major memory bottleneck in long-context inference. Existing quantization methods address this bottleneck by representing the KV cache uniformly with lower-precision data types and designing ...

- **[Potential Applications of HBF in LLM Serving Systems](https://arxiv.org/abs/2608.13127)**  
  Yihan Yin, Yinlun Zhao, Zhixin Yun et al. · arXiv:2608.13127 · 2026-08-13
  > LLM serving is increasingly constrained by memory capacity as model weights, KV caches, and the number of served model variants continue to grow. This report examines High-Bandwidth Flash (HBF) as a capacity-oriented extension to HBM-based serving systems. We ...

- **[A Comprehensive Empirical Evaluation of Vector Database Systems for Approximate Nearest Neighbor Search: Performance, Quality, and Resource Trade-offs](https://arxiv.org/abs/2608.12812)**  
  Ashen Rashmiks, Tiroshan Madushanka · arXiv:2608.12812 · 2026-08-13
  > Vector databases have emerged as critical infrastructure for modern artificial intelligence applications, particularly retrieval-augmented generation (RAG), semantic search, and recommendation systems. Despite their growing importance, there remains a signific...

- **[HBF Sucks? A Full-Stack Characterization of High-Bandwidth Flash for KV-Centric LLM Serving](https://arxiv.org/abs/2608.11668)**  
  Zhuoran Li, Zhuohang Bian, Xin Huang et al. · arXiv:2608.11668 · 2026-08-12
  > A faster storage device should make serving faster. We find the opposite. High-Bandwidth Flash (HBF) stacks NAND behind a wide, package-local interface, promising flash-scale capacity with far lower read latency and higher bandwidth than an SSD. The obvious mo...

- **[To Keep or Not to Keep: Learning KV Cache Retention in Disaggregated LLM Serving Systems](https://arxiv.org/abs/2610.28637)**  
  Dong Liu, Yanxuan Yu, Eric Jiang et al. · arXiv:2610.28637 · 2026-08-10
  > Disaggregated \textsc{LLM} serving separates prefill and decode across node pools, placing a network fabric between \textsc{KV}-cache computation and consumption. This breaks a key assumption of classical cache policies: a miss no longer incurs only local reco...

- **[Governing the KV Cache: Preventing Timing Side-Channel Leakage in Multi-Tenant LLM Inference](https://arxiv.org/abs/2608.09225)**  
  Tejasvi C. Addagada · arXiv:2608.09225 · 2026-08-10
  > The key-value (KV) cache is the primary throughput optimization in modern large language model (LLM) inference, enabling prefix reuse across requests. In multi-tenant deployments this cache is shared across tenants, creating a timing side channel: an adversari...

- **[OasisKV: Scaling In-Decode KV Cache Beyond HBM with Lookahead Sparse Prefetching](https://arxiv.org/abs/2608.08097)**  
  Can Xiao, Sukmin Cho, Junbong We et al. · arXiv:2608.08097 · 2026-08-08
  > Large language model (LLM) inference serving is increasingly constrained by memory rather than compute. As long-context and long-form reasoning workloads become more prevalent, the key-value (KV) cache dominates both memory footprint and memory traffic at the ...

- **[CoinRAG: Contextualized Information Nugget KV Cache Reuse for Long-Context RAG](https://arxiv.org/abs/2608.07458)**  
  Gyuwan Kim, Cheoneum Park, Tao Yang · arXiv:2608.07458 · 2026-08-07
  > Recent optimization studies on Retrieval-Augmented Generation (RAG) have exploited chunk-level KV cache reuse to avoid processing long retrieved contexts for higher efficiency, while significant information redundancy and noise still remain in the coarse-grain...

- **[Cascade: Exploiting SLO-Aware latency budget for fair and high goodput LLM inference serving](https://arxiv.org/abs/2608.06557)**  
  Muhammad Adnan, Rohan Mahapatra, Prashant J. Nair et al. · arXiv:2608.06557 · 2026-08-06
  > The reasoning and agentic capabilities of large language models have expanded the range of applications they support, from short interactive exchanges to long, compute-heavy requests. LLM serving platforms today define response-latency service-level objectives...

- **[TensorCast: The Missing Tensor Management Layer in Large Language Model Infrastructure](https://arxiv.org/abs/2608.06007)**  
  Yuhan Zhou, Yuchu Luo, Hao Nie et al. · arXiv:2608.06007 · 2026-08-06
  > Modern LLM infrastructure increasingly manages tensors not only as computation data, but also as persistent states shared across distributed components. Existing systems optimize individual tensor management tasks, such as model weight loading, KV cache manage...

- **[When Does Disaggregation Pay? Simulating Prefill--Decode--Attention--FFN Specialization for Agentic LLM Inference](https://arxiv.org/abs/2608.03741)**  
  Przemyslaw Forys, Haoran Wu, Can Xiao et al. · arXiv:2608.03741 · 2026-08-04
  > Agentic inference now dominates the LLM inference landscape, requiring LLMs to actively engage in multi-turn interactions with tool-calling capabilities. This introduces a more complex workload for the underlying inference system: serving stages such as prefil...

- **[SAKI-RoPE: Score-Aware Low-Rank Key Indexing with RoPE-Aware Covariance and Random-Matrix Noise Analysis](https://arxiv.org/abs/2608.03228)**  
  Lin Zhang · arXiv:2608.03228 · 2026-08-04
  > Existing low-rank KV-cache indexes preserve model weights or key variance, not the attention scores that determine retrieval. We derive the expected score distortion of key-side rank-r compression, a two-sided covariance-weighted low-rank problem that uses bot...

- **[LaCache: Robust Semantic Caching for LLM Serving](https://arxiv.org/abs/2608.01718)**  
  Jiacheng Liang, Yuhui Wang, Tanqiu Jiang et al. · arXiv:2608.01718 · 2026-08-03
  > Semantic caching, reusing responses to answer semantically similar queries, has seen growing adoption in LLM serving, offering faster responses and reduced costs. Yet existing schemes are fundamentally vulnerable to cache-collision attacks, wherein an adversar...

- **[Diagnose Before You Compress: Prediction-Independent Bottleneck Witness Refinement for LLM Serving Traces](https://arxiv.org/abs/2608.00423)**  
  Liming Liu, Chao Hu, Mingfei Lu et al. · arXiv:2608.00423 · 2026-08-01
  > Production LLM serving generates millions of diverse requests, making full-trace replay across serving configurations increasingly expensive. Existing trace reduction methods mainly preserve workload distributions or representative requests, but bottleneck-rev...

- **[LayoutBench: Performance Benchmarking of Cloud Storage Layouts for Multimedia Data](https://arxiv.org/abs/2607.28880)**  
  Debopam Sanyal, Hongjie Chen, Alexey Tumanov et al. · arXiv:2607.28880 · 2026-07-30
  > Modern multimedia machine learning workloads increasingly store large-scale datasets in cloud object storage services such as AWS S3. How these samples are physically organized in storage (i.e.,storage layout) directly affects how quickly and cheaply they can ...

- **[Agentic Coding in the Wild: Characterizing GitHub Copilot Traces at Production Scale](https://arxiv.org/abs/2608.00101)**  
  Banruo Liu, Haoran Qiu, Íñigo Goiri et al. · arXiv:2608.00101 · 2026-07-30
  > AI coding agents like GitHub Copilot, Claude Code, and Codex interleave multi-step LLM inference with tool execution, creating a workload different from chatbots. We present the first production-scale characterization of this workload using sampled GitHub Copi...

- **[GroupKV: Hierarchical KV Cache Management for Long-Context Diffusion LLM Inference](https://arxiv.org/abs/2609.17573)**  
  Jinhao Wang, Zhexin Hu, Kangjie Zhou et al. · arXiv:2609.17573 · 2026-07-30
  > Diffusion large language models (dLLMs) are emerging as a promising generative paradigm that complements autoregressive decoding. In long-context settings, KV cache bloat and offloading transfer overhead have become primary bottlenecks in inference systems. Me...

- **[SmartGen: Seamless Disaggregated LLM Inference with Selective KV Cache Transfer](https://arxiv.org/abs/2607.28150)**  
  Xuchuan Luo, Jiacheng Shen, Xin Wang et al. · arXiv:2607.28150 · 2026-07-30
  > Disaggregating the prefill and decoding stages of large language model (LLM) inference into two separate sets of nodes is widely adopted in today's LLM serving systems. However, such an architecture poses significant challenges for self-hosted LLM deployments ...

- **[ChronoMem: Version Control and Semantic Rollback for Large Language Model Agent Memory](https://arxiv.org/abs/2607.27773)**  
  Yongye Su, Wujiang Xu, Chaoji Zuo et al. · arXiv:2607.27773 · 2026-07-30
  > LLM agents increasingly rely on long-term memory to support multi-session interaction and personalization. However, existing agent memory systems are designed around forward-only evolution, continuously accumulating, consolidating, and overwriting knowledge, w...

- **[A Photonic-CXL Memory Appliance for Scalable KV Cache Management in LLM Inference](https://arxiv.org/abs/2607.27187)**  
  Jing Ding, Yash Nishant, Chandrish Ambati et al. · arXiv:2607.27187 · 2026-07-29
  > LLM inference at scale faces a memory wall. The KV cache demands tens of terabytes at hundreds of gigabytes per second, yet no current memory tier delivers both at once. Characterization across multi-generation GPU systems with various LLaMA models shows host ...

- **[MemSecBench: Tracking Agent Memory Poisoning from Persistence to Consequence and Repair](https://arxiv.org/abs/2607.27080)**  
  Xuanze Chen, Xukang Xie, Wentao Fu et al. · arXiv:2607.27080 · 2026-07-29
  > Memory systems allow agents to retain and reuse information from past interactions, but they can also let malicious content persist. A malicious instruction crafted by an attacker may be stored in long-term memory, recalled much later, and quietly shape a real...

- **[Filesystem-Based Memory for LLM Agents: Organization, Evolution, and Sustainability](https://arxiv.org/abs/2607.26637)**  
  Sizhe Zhou, Sheldon Yu, Hui Wei et al. · arXiv:2607.26637 · 2026-07-29
  > Deployed LLM agents increasingly keep their long-term memory as a filesystem: a directory tree of markdown files that the agent itself reads, writes, and reorganizes through generic file tools. Yet research has largely passed over this medium: prior systems de...

- **[NELSSA: A GPU-PNM Heterogeneous System for Mixed-Length LLM Serving via Length-based Request Placement](https://arxiv.org/abs/2607.26633)**  
  Sookyung Choi, Seungyong Lee, Kangkyu Park et al. · arXiv:2607.26633 · 2026-07-29
  > Modern LLMs and their agentic applications are broadening the range of serving workloads, spanning context lengths from a few hundred tokens to hundreds of thousands. As these requests frequently interleave within the same serving window, LLM serving systems m...

- **[Decoding the Skew: Distribution-Aware MoE Inference with Adaptive Kernel Dispatch](https://arxiv.org/abs/2607.23099)**  
  En-Ming Huang, An-Cheng Chang, Bai-Cheng Jeng et al. · arXiv:2607.23099 · 2026-07-25
  > Mixture-of-Experts (MoE) inference consists of sparse expert GEMMs whose shapes vary with the runtime routing distribution. Existing serving systems typically select fused-MoE kernels using static token-count buckets, ignoring the per-expert routing distributi...

- **[PRISM: Evaluating POSIX Storage Systems for AI Research Workflows](https://arxiv.org/abs/2607.21746)**  
  Adithya Kumar, Abhinandan Prativadi, Aditya Basu et al. · arXiv:2607.21746 · 2026-07-23
  > Large GPU clusters for AI research rely on POSIX-based storage spanning code authoring, data preparation, and model checkpointing. The metric that matters is researcher iteration speed, not just peak throughput - but current benchmarks target the latter: synth...

- **[ExpertPlex: A High-Goodput Disaggregated Serving System for MoE LLMs with Adaptive Persistent Kernels](https://arxiv.org/abs/2607.18002)**  
  Bingyang Wu, Chao Jin, Zili Zhang et al. · arXiv:2607.18002 · 2026-07-20
  > LLMs scale Mixture-of-Experts (MoE) parameters for superior intelligence, but massive weights and dynamic computation impede efficient serving. Existing instance-level prefill-decode disaggregation isolates the phases on separate full-model replicas. As MoE we...

- **[C$^2$KV: Compressed and Composable KV Cache Reuse for Efficient LLM Inference](https://arxiv.org/abs/2607.17715)**  
  Chuheng Du, Junyi Chen, Hanlin Tang et al. · arXiv:2607.17715 · 2026-07-20
  > Long-context inference is central to modern large language model (LLM) applications such as retrieval-augmented generation and multi-document reasoning. To mitigate the growing inference cost, recent work has explored key-value (KV) cache reuse to reduce redun...

- **[PDD: Unleashing Economical and Flexible Heterogeneous LLM Inference via Cross-Datacenter Prefill-Decode Disaggregation](https://arxiv.org/abs/2609.13161)**  
  Yida Wang, Xiuhong Li, Jianping Ma et al. · arXiv:2609.13161 · 2026-07-18
  > Interconnecting geographically dispersed clusters over wide-area Ethernet provides a scalable and cost-effective alternative to dedicated intra-datacenter heterogeneous clusters for Large Language Model (LLM) inference. However, this cross-datacenter disaggreg...

- **[SlotMem: Character-Addressable Internal Memory for Narrative Long Video Generation](https://arxiv.org/abs/2607.15772)**  
  Yilai Liu, Xin Zhang, Shiyuan Zhang et al. · arXiv:2607.15772 · 2026-07-17
  > Maintaining recurring character identities across scene transitions and long temporal gaps is a central challenge in narrative long video generation. Methods targeting global consistency often retrieve memory using cues that are not aligned with character iden...

- **[Learning Agent Execution for KV-Cache Management in Agentic Serving](https://arxiv.org/abs/2608.14624)**  
  Rui Zhang, Chaeeun Kim, Shaoting Feng et al. · arXiv:2608.14624 · 2026-07-16
  > Multi-agent LLM systems have emerged as an important deployment paradigm for AI services, where each user request is decomposed into a sequence of specialized agents. Across these workflows, every agent repeatedly executes a fixed context consisting of system ...

- **[Full-Pipeline Inference Optimization for MiMo-V2.5 Series: Pushing Hybrid SWA Efficiency to the Limit](https://arxiv.org/abs/2607.13095)**  
   Xiaomi MiMo Team, Anqi Liu, Aoxin Ma et al. · arXiv:2607.13095 · 2026-07-14
  > We present a full-pipeline inference optimization for the MiMo-V2.5 model family, which combines Hybrid Sliding Window Attention (Hybrid SWA), sparse Mixture-of-Experts (MoE), and multimodal encoders. While Hybrid SWA can ideally reduce both attention compute ...

- **[Automated Tensor Scheduling for Hybrid CPU-GPU LLM Inference on Consumer Devices](https://arxiv.org/abs/2607.10183)**  
  Yangyijian Liu, Hongyi Ye, Mingyang Li et al. · arXiv:2607.10183 · 2026-07-11
  > Running large language models on consumer devices such as laptops and desktops is challenging because model weights often exceed GPU memory capacity, making offloading inference necessary to extend effective model capacity with CPU memory. Existing offloading ...

- **[KVpop -- Key-Value Cache Compression with Predictive Online Pruning](https://arxiv.org/abs/2607.05061)**  
  Lukas Hauzenberger, Niklas Schmidinger, Anamaria-Roberta Hartl et al. · arXiv:2607.05061 · 2026-07-06
  > Key-value (KV) cache growth is a major bottleneck in autoregressive decoding, as memory and bandwidth scale linearly with context length. Existing KV eviction methods often rely on static heuristics or proxy scores, which poorly track future token utility and ...

- **[Direct Model State Migration for Elastic Training of Large Language Models](https://arxiv.org/abs/2607.04749)**  
  Weijian Liu, Mingzhen Li, Rui Kang et al. · arXiv:2607.04749 · 2026-07-06
  > Large language model (LLM) training shall adapt to dynamic resources in shared clusters to tackle the elasticity, including passive preemption and optimistic scaling. State migration across device sets is required when altering the hybrid-parallel configuratio...

- **[GORIO: GPU-Centered Remote I/O for Graph ANNS over NVMe-oF](https://arxiv.org/abs/2607.04415)**  
  Gen Zhang, Wenhao Gu, Shan Huang et al. · arXiv:2607.04415 · 2026-07-05
  > Graph-based approximate nearest neighbor search (ANNS) is increasingly used in vector databases and retrieval-augmented generation services, but large vector indexes often exceed the memory capacity of a single GPU server. NVMe over Fabrics (NVMe-oF) provides ...

- **[Memory-Orchestrated Semantic System (MOSS): An Auditable Agentic Memory Architecture](https://arxiv.org/abs/2607.04391)**  
  Serge Lacasse, Jérémie Hatier, Alex Baker · arXiv:2607.04391 · 2026-07-05
  > Long-term memory remains a structural weakness of AI agents. The dominant approach, retrieval-augmented generation (RAG), relies on embedding-based similarity search, which is opaque by construction, difficult to audit, and bounded by the theoretical limits of...

- **[Towards Load-Aware Prefill Deflection for Disaggregated LLM Serving](https://arxiv.org/abs/2607.02043)**  
  Shrikara Arun, Anjaly Parayil, Srikant Bharadwaj et al. · arXiv:2607.02043 · 2026-07-02
  > Disaggregated LLM serving runs prefill and decode on separate GPU pools to keep the two phases from interfering. In practice, this creates a new asymmetry: under bursty, heavy-tailed workloads prefill nodes saturate while decode nodes have compute underutilize...

- **[PHOENIX: Resilient LLM Training with Hot-Swapping via Zero-Overhead Checkpoint](https://arxiv.org/abs/2607.01646)**  
  Haotian Xie, Junlin Chen, Mingkai Zheng et al. · arXiv:2607.01646 · 2026-07-02
  > State-of-the-art large language model (LLM) training takes tens of thousands of graphics processing units (GPUs) for months and encounters failures across the software and hardware stack. Existing fault-tolerance mechanisms either impose non-trivial overhead d...

- **[HYPIC: Accelerating Hybrid-Attention LLM Serving with Position-Independent Caching](https://arxiv.org/abs/2607.01299)**  
  Yifei Liu, Juntong Wu, Yang Liu et al. · arXiv:2607.01299 · 2026-07-01
  > In retrieval-augmented generation and agentic LLM serving, prompts are assembled from independent segments into long contexts, making the prefill stage dominate per-request cost. Two directions have emerged to reduce this cost: position-independent caching (PI...

- **[HBM Is Not All You Need: Efficient Disaggregated LLM Serving across Memory-heterogeneous Accelerators](https://arxiv.org/abs/2606.29986)**  
  Zhixiang Wei, Yun Wang, James Yen et al. · arXiv:2606.29986 · 2026-06-29
  > LLM inference comprises a compute-bound prefill phase and a memory-bound decode phase, and recent systems disaggregate them onto separate hardware. Yet today's datacenter GPUs rely on costly HBM whose bandwidth sits almost entirely idle during prefill. LLM ser...

- **[Coverage-Driven KV Cache Eviction for Efficient and Improved Inference of LLM](https://arxiv.org/abs/2606.29563)**  
  Shuvendu Roy, Mengyao Zhai, Hossein Hajimirsadeghi et al. · arXiv:2606.29563 · 2026-06-28
  > Large language models (LLMs) excel at complex tasks like question answering and summarization, thanks to their ability to handle long-context inputs. However, deploying LLMs is costly, not only due to the high computational demands of quadratic complexity of s...

- **[SpecPrefetch: Parameter-Efficient Expert Prefetching for Sparse MoE Foundation Models](https://arxiv.org/abs/2607.24787)**  
  Jinwei Kong, Runqi Meng, Fanyi Wang et al. · arXiv:2607.24787 · 2026-06-24
  > Sparse Mixture-of-Experts (MoE) models expand foundation model capacity through conditional expert activation, but their full expert pools remain difficult to deploy under limited accelerator memory. Although expert offloading alleviates memory pressure by mov...

- **[CrossPool: Efficient Multi-LLM Serving for Cold MoE Models through KV-Cache and Weight Disaggregation](https://arxiv.org/abs/2606.24506)**  
  Zhuoren Ye, Tianyu Wo, Dinghao Xue et al. · arXiv:2606.24506 · 2026-06-23
  > Emerging LLM services increasingly host many sparse MoE models, yet most models receive sparse requests and remain cold. This creates a GPU memory problem: model weights are stable and model-determined, while KV-cache is transient and demand-determined. Becaus...

- **[The Serialized Bridge: Understanding and Recovering LLM Serving Performance under Blackwell GPU Confidential Computing](https://arxiv.org/abs/2606.23969)**  
  Hang Yin, Kevin Wang · arXiv:2606.23969 · 2026-06-22
  > GPU Confidential Computing (GPU-CC) now preserves GPU-local performance: on NVIDIA B300, BF16 matmul runs at 0.998x of non-confidential performance. Yet LLM serving under Intel TDX plus GPU-CC still loses 13-27% of throughput, and KV-cache restore latency can ...

- **[Concordia: JIT-Compiled Persistent-Kernel Checkpointing for Fault-Tolerant LLM Inference](https://arxiv.org/abs/2606.23521)**  
  Yuhang Gan, Yiwei Yang, Yuyi Li et al. · arXiv:2606.23521 · 2026-06-22
  > Long-running LLM agents keep valuable state resident on GPUs: KV caches, request schedulers, communication state, and sometimes online adapters. Losing this state after a GPU or communicator failure can discard minutes to hours of work, yet existing recovery m...

- **[RaMem: Contextual Reinstatement for Long-term Agentic Memory](https://arxiv.org/abs/2606.22844)**  
  Wei Yang, Bryce Kan, Shixuan Li et al. · arXiv:2606.22844 · 2026-06-22
  > Long-term memory has become increasingly important for LLM agents that operate across extended interactions and evolving task contexts. Recent memory systems have made past experiences more persistent, compact, and retrievable, but retrieval alone does not ens...

- **[SAC: Disaggregated KV Cache System for Sparse Attention LLMs with CXL](https://arxiv.org/abs/2606.19746)**  
  Ruiyang Ma, Teng Ma, Junru Li et al. · arXiv:2606.19746 · 2026-06-18
  > The scaling of LLMs toward long-context inference has shifted the primary serving system bottleneck from computation to memory capacity. Traditional solutions for dense attention models rely on RDMA-based disaggregated memory pools, which perform coarse-graine...

- **[LUMEN: Coordinated Failure Recovery for Distributed LLM Serving](https://arxiv.org/abs/2606.17787)**  
  Zhang Cao, Shujie Han, Juncheng Zhang et al. · arXiv:2606.17787 · 2026-06-16
  > Modern large language model (LLM) serving clusters distribute inference requests across multiple worker processes on different GPUs, but failures are prevalent at scale. When a worker fails, the cluster simultaneously loses the failed worker's GPU-resident key...

- **[Prefill/Decode-Aware Evaluation of LLM Inference on Emerging AI Accelerators](https://arxiv.org/abs/2606.17104)**  
  Shun Usami, Venkatram Vishwanath, E. Wes Bethel · arXiv:2606.17104 · 2026-06-14
  > As large language models (LLMs) are increasingly deployed in latency- and cost-sensitive settings, inference efficiency has become a central systems challenge. While GPUs dominate current deployments, a growing number of AI accelerators claim advantages for LL...

- **[FragFuse: Bypassing Access Control of Large Language Model Agents via Memory-Based Query Fragmentation and Fusion](https://arxiv.org/abs/2606.15609)**  
  Zixin Rao, Wentian Zhu, Chan Aristella Lu et al. · arXiv:2606.15609 · 2026-06-14
  > Large language model (LLM) agents increasingly rely on long-term memory to support complex task execution, user personalization, and domain adaptation. Meanwhile, emerging access-control mechanisms for LLM agents are being explored to block policy-violating re...

- **[MemoryVAM: Integrating Memory into Video Action Model for Robot Manipulation](https://arxiv.org/abs/2606.20679)**  
  Yuxin Jiang, Chang Yu, Yunuo Chen et al. · arXiv:2606.20679 · 2026-06-13
  > Video-world-model policies learn action-relevant representations by predicting future observations. However, they condition on only a short observation window, which renders long-horizon manipulation non-Markovian when the correct action depends on earlier eve...

- **[Exploring a Layer-Wise Design Space for KV Cache Eviction](https://arxiv.org/abs/2606.15157)**  
  Chao Fei, Kaihua Liang, Hanzhi Hu et al. · arXiv:2606.15157 · 2026-06-13
  > KV cache eviction methods typically use a single retention-rule family throughout a model, making eviction-method identity a model-level design choice. Yet Transformer layers differ substantially in their attention behavior, representations, and sensitivity to...

- **[The Price of Anarchy in Disaggregated Inference](https://arxiv.org/abs/2606.17081)**  
  Athos Georgiou · arXiv:2606.17081 · 2026-06-11
  > Disaggregated inference architectures physically separate prefill and decode phases onto distinct GPU pools, creating competing "agents" that share a fixed hardware budget. We provide, to our knowledge, the first formal game-theoretic analysis of this architec...

- **[Efficient On-Device Diffusion LLM Inference with Mobile NPU](https://arxiv.org/abs/2606.13740)**  
  Tuowei Wang, Yanfan Sun, Ju Ren · arXiv:2606.13740 · 2026-06-11
  > Diffusion large language models (dLLMs) accelerate generation by denoising multiple tokens in parallel, making them attractive for latency-sensitive mobile inference. However, repeated denoising introduces substantial computation on smartphones. Mobile neural ...

- **[TetherCache: Stabilizing Autoregressive Long-Form Video Generation with Gated Recall and Trusted Alignment](https://arxiv.org/abs/2606.13035)**  
  Yu Meng, Xiangyang Luo, Letian Li et al. · arXiv:2606.13035 · 2026-06-11
  > Autoregressive video diffusion models provide a natural formulation for streaming and variable-length video generation by conditioning newly generated frames on previously generated content. However, extending these models to minute-level generation remains ch...

- **[ITME: Inference Tiered Memory Expansion with Disaggregated CXL-Hybrid Memories](https://arxiv.org/abs/2606.12556)**  
  Hakbeom Jang, Younghoon Min, Sunwoong Kim et al. · arXiv:2606.12556 · 2026-06-10
  > The rapid shift toward agentic and long-context workloads in Large Language Models (LLMs) is pushing the industry beyond the capacity of individual servers toward disaggregated shared storage to handle TB-scale context states. This movement has led to the emer...

- **[Tiara: A Programmable Line-Rate ISA for Remote Memory Access](https://arxiv.org/abs/2606.13708)**  
  Bojie Li · arXiv:2606.13708 · 2026-06-10
  > RDMA one-sided verbs are the natural primitive for memory disaggregation, but they require the client to supply the exact remote address. The 1-RTT performance breaks down when the target address depends on data that must first be read from remote memory, a pa...

- **[Infini Memory: Maintainable Topic Documents for Long-Term LLM Agent Memory](https://arxiv.org/abs/2606.10677)**  
  Suozhao Ji, Baodong Wu, Zehao Wang et al. · arXiv:2606.10677 · 2026-06-09
  > Long-term LLM agents need persistent memory that can track changing facts and provide relevant evidence across sessions. Existing memory systems often store observations as isolated records, summaries, or indexed fragments, which makes evidence aggregation, fa...

- **[Memory Beyond Recall: A Dual-Process Cognitive Memory System for Self-Evolving LLM Agents](https://arxiv.org/abs/2606.09483)**  
  Tianxiang Fei, Mingyang Song, Mao Zheng et al. · arXiv:2606.09483 · 2026-06-08
  > Long-term memory for an LLM agent is more than retrieving the right passage at the right time. Current memory systems collapse belief revision, causal coupling, and cross-domain abstraction into a single retrieval surface tuned for surface recall, and conseque...

- **[Towards Tight Bounds for Streaming Attention](https://arxiv.org/abs/2606.07205)**  
  Justin Y. Chen, Ying Feng, Piotr Indyk et al. · arXiv:2606.07205 · 2026-06-05
  > The attention mechanism is a cornerstone of modern transformer architectures. However, its expressive power comes at the cost of quadratic runtime and linear space usage. In particular, the classical transformer architecture explicitly stores all previously se...

- **[Semantic Cache Distillation: Efficient State Transfer via Reuse and Selective Patching](https://arxiv.org/abs/2606.07684)**  
  Qianli Ma, Zhiqing Tang, Hanshuai Cui et al. · arXiv:2606.07684 · 2026-06-05
  > Disaggregated serving alleviates memory bottlenecks in Large Language Model (LLM) inference but creates a severe communication bottleneck: transmitting high-dimensional Key-Value (KV) caches often dominates time-to-first-token (TTFT). Moreover, reusing caches ...

- **[Agent Memory: Characterization and System Implications of Stateful Long-Horizon Workloads](https://arxiv.org/abs/2606.06448)**  
  Yasmine Omri, Ziyu Gan, Zachary Broveak et al. · arXiv:2606.06448 · 2026-06-04
  > LLM agents are increasingly deployed on long-horizon tasks requiring sustained reasoning over extended interaction histories. Realizing this at scale requires agents to persistently store, retrieve, and update their own memory across sessions. A rich ecosystem...

- **[Puffin-Backed Vector Indexes: Attaching Approximate Nearest Neighbor Indexes to Apache Iceberg Snapshots for Compute-Disaggregated Query Engines](https://arxiv.org/abs/2606.04196)**  
  Artur Borycki · arXiv:2606.04196 · 2026-06-02
  > We describe a design pattern and concrete implementation for embedding distributed approximate nearest neighbor indexes inside the Apache Iceberg table format, using the Puffin sidecar file as the storage container and the snapshot summary as the binding mecha...

- **[Value-Aware Stochastic KV Cache Eviction for Reasoning Models](https://arxiv.org/abs/2606.03928)**  
  Ting-Yun Chang, Harvey Yiyun Fu, Deqing Fu et al. · arXiv:2606.03928 · 2026-06-02
  > Reasoning models improve accuracy through extended chains of thought, but their long outputs create a memory and compute bottleneck. KV cache eviction methods reduce this cost by evicting unimportant key-value pairs from the cache, yet they often yield worse a...

- **[NetKV: Network-Aware Decode Instance Selection for Disaggregated LLM Inference](https://arxiv.org/abs/2606.03910)**  
  Mubarak Adetunji Ojewale · arXiv:2606.03910 · 2026-06-02
  > Disaggregated LLM inference forces the KV cache to traverse the datacenter network before decoding begins, so transfer time enters directly into the Time to First Token (TTFT) budget. Current schedulers route on compute load and prefix-cache locality alone, ig...

- **[DriftSched: Adaptive QoS-Aware Scheduling under Runtime Token Drift for Multi-Tenant GPU Inference](https://arxiv.org/abs/2606.02982)**  
  Kathiravan Palaniappan · arXiv:2606.02982 · 2026-06-02
  > The rapid growth of large language model (LLM) inference services has increased the demand for efficient multi-tenant GPU scheduling. While modern inference runtimes such as vLLM improve throughput through continuous batching and optimized memory management, a...

- **[Multi-Segment Attention: Enabling Efficient KV-Cache Management for Faster Large Language Model Serving](https://arxiv.org/abs/2606.02964)**  
  Chunan Shi, Yilei Chen, Yilin Chen et al. · arXiv:2606.02964 · 2026-06-01
  > Large Language Model (LLM) inference relies on key-value (KV) caches to avoid redundant attention computation. While approximate KV cache retention techniques reduce memory usage by sacrificing model accuracy, lossless approaches instead evict KV cache blocks ...

- **[Geometry-Aware Implicit Memory for Video World Models](https://arxiv.org/abs/2606.02436)**  
  Zhengxuan Wei, Xu Guo, Xinghui Li et al. · arXiv:2606.02436 · 2026-06-01
  > Video world models aim to simulate controllable visual environments, but long-horizon rollouts depend on what the model remembers after observations leave its native context window. Explicit memories retain frames or online 3D reconstructions, which can suffer...

- **[Observation, Not Prediction: Conversation-Level Disaggregated Scheduling for Agentic Serving](https://arxiv.org/abs/2606.01839)**  
  Jianru Ding, Ryien Hosseini, Pouya Mahdi Gholami et al. · arXiv:2606.01839 · 2026-06-01
  > LLM-based agents resolve a user task through many turns of dependent inference and tool calls, producing a workload whose total cost is unknown when the task arrives. Existing multi-turn systems keep the turn as the scheduling unit and decide, turn by turn, wh...

- **[SparseX: Efficient Segment-Level KV Cache Sharing for Interleaved LLM Serving](https://arxiv.org/abs/2606.01751)**  
  Quqing Zhang, Kai Chen, Ning Liao et al. · arXiv:2606.01751 · 2026-06-01
  > In long-context LLM serving, the prefill stage often dominates time-to-first-token and computational cost. Although Prefix Cache in vLLM/PagedAttention has been widely used to reuse identical prompt prefixes, repeated content in practical applications frequent...

- **[MomentKV: Closing the Directional Gap in KV Cache Eviction for Long-Context Inference](https://arxiv.org/abs/2606.01563)**  
  Yu Li, Binxu Li, Tian Lan · arXiv:2606.01563 · 2026-06-01
  > Autoregressive decoding in Transformer-based language models relies on the KV cache, whose memory footprint grows linearly with sequence length and becomes the primary bottleneck for long-context inference. KV cache eviction addresses this by retaining a fixed...

- **[Move the Query, Not the Cache: Characterizing Cross-Instance Latent Attention Redistribution Across GPU Fabrics](https://arxiv.org/abs/2606.01502)**  
  Bole Ma, Jan Eitzinger, Harald Köstler et al. · arXiv:2606.01502 · 2026-05-31
  > Frontier LLMs increasingly decide what a query attends to with a sparse-attention indexer that picks a few KV-cache blocks per query: attention's unit is now a small, reusable chunk. Agentic workloads hammer it: many sub-agents query one large codebase, reusin...

- **[Blurry Window Attention](https://arxiv.org/abs/2606.09862)**  
  Axel Laborieux, Christos Sourmpis, Juan Gabriel Kostelec et al. · arXiv:2606.09862 · 2026-05-31
  > The Softmax Attention operation in Transformer language models has a quadratic complexity in the sequence length and a growing state size in the form of KV cache, which becomes a bottleneck in long context scenarios. To overcome this limitation, alternative ar...

- **[Leyline: KV Cache Directives for Agentic Inference](https://arxiv.org/abs/2606.01065)**  
  Bole Ma, Jan Eitzinger, Harald Koestler · arXiv:2606.01065 · 2026-05-31
  > Modern KV cache management assumes the chatbot workload: prompts arrive once and the cache grows append-only, so prefix caching and forward-only eviction are correct by construction. Agentic LLMs break this assumption. Their conversations evolve through policy...

- **[GRKV: Global Regression for Training-Free KV Cache Compression in Long-Context LLMs](https://arxiv.org/abs/2605.31105)**  
  Junjie Peng, You Wu, Haoyi Wu et al. · arXiv:2605.31105 · 2026-05-29
  > Large language models (LLMs) with extended context lengths rely on the key-value (KV) cache to support attention over prior tokens. However, maintaining the KV cache incurs substantial memory overhead, motivating KV-cache compression methods that enforce a fix...

- **[CacheProbe: Auditing Prompt Cache Isolation in Gateway APIs](https://arxiv.org/abs/2605.30613)**  
  Ryan Fahey · arXiv:2605.30613 · 2026-05-28
  > Over the past year, prompt caching in Large Language Models (LLMs) has become increasingly more popular across inference APIs. Prompt caching helps save precious compute resources and speeds up response times by reusing parts of the KV cache of a specific prom...

- **[OmniMem: Scalable and Adaptive Memory Retrieval for Long Video Generation](https://arxiv.org/abs/2605.30519)**  
  Lin Zhao, Yushu Wu, Yifan Gong et al. · arXiv:2605.30519 · 2026-05-28
  > Autoregressive (AR) video generation extends videos by producing latent chunks sequentially, but scaling to long videos requires repeated access to a growing historical KV cache. Existing methods reduce this cost by truncating the KV cache or compressing it in...

- **[RTP-LLM: High-Performance Alibaba LLM Inference Engine](https://arxiv.org/abs/2605.29639)**  
  Boyu Tan, Jiarui Guo, Zongwei Lv et al. · arXiv:2605.29639 · 2026-05-28
  > Large Language Models (LLMs) have revolutionized AI applications, but deploying them at scale presents significant challenges. We present RTP-LLM, a high-performance inference engine for industrial-scale LLM deployment, successfully deployed across Alibaba Gro...

- **[How Far Can Disaggregation Go? A Design-Space Exploration of Attention-FFN Disaggregation for Efficient MoE LLM Serving](https://arxiv.org/abs/2605.28302)**  
  Hanjiang Wu, Abhimanyu Rajeshkumar Bambhaniya, Sarbartha Banerjee et al. · arXiv:2605.28302 · 2026-05-27
  > Modern large language model (LLM) inference has progressively disaggregated to keep pace with growing model sizes and tight TTFT and TPOT service-level objectives: from chunked-prefill aggregation, to prefill-decode (P/D) disaggregation, and most recently to o...

- **[CXL-ClusterSim: Modeling CXL-based Disaggregated Memory Cluster for Pooling and Sharing using gem5 and SST](https://arxiv.org/abs/2605.27745)**  
  Kaustav Goswami, Maryam Babaie, Hoa Nguyen et al. · arXiv:2605.27745 · 2026-05-26
  > Large-scale AI training and inference require hundreds of gigabytes to terabytes of DRAM with high peak to average utilization ratios, resulting in overprovisioning. In cloud computing, DRAM constitutes a significant share of the cost. Yet, as shown by recent ...

- **[Is Agent Memory a Database? Rethinking Data Foundations for Long-Term AI Agent Memory](https://arxiv.org/abs/2605.26252)**  
  Abdelghny Orogat, Essam Mansour · arXiv:2605.26252 · 2026-05-25
  > Long-running AI agents need persistent memory. Memory supports learning across sessions, reduces repeated context injection, and enables auditing of past decisions. Current agent memory systems and database paradigms treat memory as storage. They localize corr...

- **[EM-Vid: Training-Free Entity-Centric Memory for Efficient and Consistent Multi-Shot Video Generation](https://arxiv.org/abs/2605.23610)**  
  Jente Vandersanden, Matheus Gadelha, Chun-Hao P. Huang et al. · arXiv:2605.23610 · 2026-05-22
  > Multi-shot video generation requires maintaining a consistent appearance of recurring entities across shots while remaining faithful to shot-specific text prompts. Recent autoregressive methods reuse previously generated frames as memory. However, full-frame s...

- **[Hy-MT2: A Family of Fast, Efficient and Powerful Multilingual Translation Models in the Wild](https://arxiv.org/abs/2605.22064)**  
  Mao Zheng, Zheng Li, Tao Chen et al. · arXiv:2605.22064 · 2026-05-21
  > Hy-MT2 is a family of fast-thinking multilingual translation models designed for complex real-world scenarios. It includes three model sizes: 1.8B, 7B, and 30B-A3B (MoE), all of which support translation among 33 languages and effectively follow translation in...

- **[KVBoost: Chunk-Level Key-Value Cache Reuse with Deviation-Guided Recomputation for Efficient Large Language Model Inference](https://arxiv.org/abs/2608.21362)**  
  Srihari Unnikrishnan · arXiv:2608.21362 · 2026-05-21
  > Transformer-based large language models (LLMs) incur high prefill latency because key-value (KV) tensors must be recomputed for each request. Existing prefix-caching systems reduce this cost but require prompts to share a leading contiguous prefix, limiting ef...

- **[Adaptive KV Cache Reuse for Fast Long-Context LLM Serving](https://arxiv.org/abs/2605.24022)**  
  Fei li, Song Liu, Yan Liu et al. · arXiv:2605.24022 · 2026-05-20
  > In long-context Large Language Model (LLM) inference, the Time-To-First-Token (TTFT) latency incurred by the prefill stage has become the foremost bottleneck limiting interactive performance and deployment cost. KV Cache reuse offers a direct path to reduce re...

- **[C2CServe: Leveraging NVLink-C2C for Elastic Serverless LLM Serving on MIG](https://arxiv.org/abs/2605.19481)**  
  Shutian Luo, Ali Zafar Sadiq, Rui Yang et al. · arXiv:2605.19481 · 2026-05-19
  > Modern LLM serving is increasingly serverless in shape: large model catalogs, long-tail invocations, and multi-tenant demand. Existing GPU serving systems face a tradeoff: dedicated-GPU allocation wastes scarce HBM under sparse traffic, while GPU time sharing ...

- **[EvoMemBench: Benchmarking Agent Memory from a Self-Evolving Perspective](https://arxiv.org/abs/2605.18421)**  
  Yuyao Wang, Zhongjian Zhang, Mo Chi et al. · arXiv:2605.18421 · 2026-05-18
  > Recent benchmarks for Large Language Model (LLM) agents mainly evaluate reasoning, planning, and execution. However, memory is also essential for agents, as it enables them to store, update, and retrieve information over time. This ability remains under-evalua...

- **[KVDrive: A Holistic Multi-Tier KV Cache Management System for Long-Context LLM Inference](https://arxiv.org/abs/2605.18071)**  
  Jian Lin, Jiazhi Mi, Zicong Hong et al. · arXiv:2605.18071 · 2026-05-18
  > Supporting long-context LLMs is challenging due to the substantial memory demands of the key-value (KV) cache. Existing offloading systems store the full cache in host memory and selectively fetch critical entries during decoding, but this strategy quickly hit...

- **[TierCheck: Tiered Checkpointing for Fault Tolerance in Large Language Model Training](https://arxiv.org/abs/2605.17821)**  
  Shujie Han, Feng Jiang, Patrick P. C. Lee et al. · arXiv:2605.17821 · 2026-05-18
  > Large Language Model (LLM) training is frequently interrupted by a heterogeneous spectrum of failures, from common GPU crashes to catastrophic cluster-wide outages. Existing checkpointing systems rely on monolithic, single-tier storage backend, forcing a trade...

- **[VeriCache: Turning Lossy KV Cache into Lossless LLM Inference](https://arxiv.org/abs/2605.17613)**  
  Jiayi Yao, Samuel Shen, Kuntai Du et al. · arXiv:2605.17613 · 2026-05-17
  > The large size of the KV cache has become a major bottleneck for serving LLMs with increasing context lengths. In response, many KV cache compression methods, such as token dropping and quantization, have been proposed. However, almost all of these methods are...

- **[NeuSymMS: A Hybrid Neuro-Symbolic Memory System for Persistent, Self-Curating LLM Agents](https://arxiv.org/abs/2605.17596)**  
  Mujahid Sultan, Sri Thuraisamy, Daya Rajaratnam · arXiv:2605.17596 · 2026-05-17
  > We present NeuSymMS, an adaptive memory system that enables large language model (LLM) agents to learn, remember, and reason about users across sessions via a hybrid neuro-symbolic architecture. NeuSymMS couples neural fact extraction from unstructured dialogu...

- **[ObjectCache: Layerwise Object-Storage Retrieval for KV Cache Reuse](https://arxiv.org/abs/2605.22850)**  
  Yu Zhu, Aditya Dhakal, Yunming Xiao et al. · arXiv:2605.22850 · 2026-05-16
  > Prefix KV caching has become a key mechanism in LLM serving: it reduces time to first token (TTFT) by avoiding redundant computation across requests that share a prefix (i.e., the system prompt). However, the accumulated KV cache is often larger than what GPU ...

- **[HexAGenT: Efficient Agentic LLM Serving via Workflow- and Heterogeneity-Aware Scheduling](https://arxiv.org/abs/2605.16637)**  
  You Peng, Youhe Jiang, Wenshuang Li et al. · arXiv:2605.16637 · 2026-05-15
  > Agentic LLM applications increasingly execute user requests as multi-step workflows involving planning, tool use, branching, refinement, and synthesis. In such settings, users experience the end-to-end latency of an entire workflow, not the latency of any sing...

- **[H-Mem: A Novel Memory Mechanism for Evolving and Retrieving Agent Memory via a Hybrid Structure](https://arxiv.org/abs/2605.15701)**  
  Jiawei Yu, Yixiang Fang, Xilin Liu et al. · arXiv:2605.15701 · 2026-05-15
  > Memory data are ubiquitous in Large Language Model (LLM)-based agents (e.g., OpenClaw and Manus). A few recent works have attempted to exploit agents'memory for improving their performance on the question-answering (QA) task, but they lack a principled mechani...

- **[KVServe: Service-Aware KV Cache Compression for Communication-Efficient Disaggregated LLM Serving](https://arxiv.org/abs/2605.13734)**  
  Zedong Liu, Xinyang Ma, Dejun Luo et al. · arXiv:2605.13734 · 2026-05-13
  > LLMs are widely adopted in production, pushing inference systems to their limits. Disaggregated LLM serving (e.g., PD separation and KV state disaggregation) improves scalability and cost efficiency, but it also turns KV into an explicit payload crossing netwo...

- **[Not All Tokens Are Worth Caching: Learning Semantic-Aware Eviction for LLM Prefix Caches](https://arxiv.org/abs/2605.18825)**  
  Shaoke Fang, Ziang Li, Wenfei Wu et al. · arXiv:2605.18825 · 2026-05-12
  > Prefix caching is a key optimization in Large Language Model (LLM) serving, reusing attention Key-Value (KV) states across requests with shared prompt prefixes to reduce expensive prefill computation. However, its benefit depends critically on the eviction pol...

- **[DynaTrain: Fast Online Parallelism Switching for Elastic LLM Training](https://arxiv.org/abs/2605.18815)**  
  Yuanqing Wang, Yuchen Zhang, Hao Lin et al. · arXiv:2605.18815 · 2026-05-12
  > Modern large language model (LLM) training is inherently dynamic: resource fluctuations, RLHF phase shifts, and cluster elasticity continually reshape the optimal parallelism layout, posing a significant challenge to existing training frameworks built around a...

- **[NAVIS: Concurrent Search and Update with Low Position-Seeking Overhead in On-SSD Graph-Based Vector Search](https://arxiv.org/abs/2605.11523)**  
  Jaeyong Song, Hongsun Jang, Changmin Shin et al. · arXiv:2605.11523 · 2026-05-12
  > On-disk graph-based vector search (GVS) has become the dominant approach for serving large-scale vector databases at high recall, but prior systems struggle to sustain concurrent search and update throughput on high-dimensional workloads. We find the main caus...

- **[Continuous Discovery of Vulnerabilities in LLM Serving Systems with Fuzzing](https://arxiv.org/abs/2605.11202)**  
  Yunze Zhao, Yibo Zhao, Yuchen Zhang et al. · arXiv:2605.11202 · 2026-05-11
  > LLM inference and serving systems have become security-critical infrastructure; however, many of their most concerning failures arise from the serving layer rather than from model behavior alone. Modern inference engines combine KV cache, batching, prefix shar...

- **[RDKV: Rate-Distortion Bit Allocation for Joint Eviction and Quantization of the KV Cache](https://arxiv.org/abs/2605.08317)**  
  Junkai Zhang, Hang Guo, Luca Benini et al. · arXiv:2605.08317 · 2026-05-08
  > Large language models (LLMs) have shown strong performance across diverse tasks, but their inference with long input contexts is bottlenecked by memory size and bandwidth. The Key-Value (KV) cache size grows linearly with sequence length and needs to be re-rea...

- **[Towards Distributed Inference of LLMs on a P2P Network](https://arxiv.org/abs/2606.17059)**  
  Shabari S Nair, Krishanu Saini · arXiv:2606.17059 · 2026-05-07
  > Prefix caching can reduce LLM inference latency by reusing KV caches across requests with shared prompts, but cluster-scale reuse is challenging because caches are partitioned across nodes. We propose a decentralized, prefix-cache-aware routing scheme for peer...

- **[Irminsul: MLA-Native Position-Independent Caching for Agentic LLM Serving](https://arxiv.org/abs/2605.05696)**  
  Bole Ma, Jan Eitzinger, Harald Köstler · arXiv:2605.05696 · 2026-05-07
  > Agentic LLM workloads put bit-identical tokens at shifted positions every turn, voiding prefix caches at the first byte of divergence. Operators report cache-hit regressions ranging from moderate slowdowns to severe TTFT spikes of 10-16s on unchanged content. ...

- **[Tutti: Making SSD-Backed KV Cache Practical for Long-Context LLM Serving](https://arxiv.org/abs/2605.03375)**  
  Shi Qiu, Yifan Hu, Xintao Wang et al. · arXiv:2605.03375 · 2026-05-05
  > LLM serving relies on prefix caching to improve inference performance. As growing contexts push key-value (KV) cache footprint far beyond GPU HBM and CPU DRAM capacity, KV cache is increasingly offloaded to NVMe SSDs. Unfortunately, restoring KV cache from SSD...

- **[Taming Request Imbalance: SLO-Aware Scheduling for Disaggregated LLM Inference](https://arxiv.org/abs/2605.02329)**  
  Qipeng Wang · arXiv:2605.02329 · 2026-05-04
  > In production environments, large language model (LLM) serving is required to meet stringent service-level objectives (SLOs) amid highly variable request patterns. In practice, request lengths follow a long-tail distribution, which gives rise to head-of-line b...

- **[Eliminating Hidden Serialization in Multi-Node Megakernel Communication](https://arxiv.org/abs/2605.00686)**  
  Byungsoo Oh, Rachee Singh · arXiv:2605.00686 · 2026-05-01
  > Recent megakernel designs for Mixture-of-Experts (MoE) inference fuse expert computation with fine-grained, GPU-initiated communication into a single persistent GPU kernel, and outperform collective-based MoE on a single node by overlapping data transfer with ...

- **[SAGA: Workflow-Atomic Scheduling for AI Agent Inference on GPU Clusters](https://arxiv.org/abs/2605.00528)**  
  Dongxin Guo, Jikun Wu, Siu Ming Yiu · arXiv:2605.00528 · 2026-05-01
  > AI agents execute tens to hundreds of chained LLM calls per task, yet GPU schedulers treat each call as independent, discarding gigabytes of intermediate state between steps and inflating end-to-end latency by 3-8x. We argue that this request-level abstraction...

- **[DUAL-BLADE: Dual-Path NVMe-Direct KV-Cache Offloading for Edge LLM Inference](https://arxiv.org/abs/2604.26557)**  
  Bodon Jeong, Hongsu Byun, Youngjae Kim et al. · arXiv:2604.26557 · 2026-04-29
  > The increasing deployment of Large Language Model (LLM) inference on edge AI systems demands efficient execution under tight memory budgets. A key challenge arises from Key-Value (KV) caches, which often exceed available device memory. Although NVMe-based offl...

- **[STLGT: A Scalable Trace-Based Linear Graph Transformer for Tail Latency Prediction in Microservices](https://arxiv.org/abs/2604.26422)**  
  Yongliang Ding, Qigong Bi, Peng Pu · arXiv:2604.26422 · 2026-04-29
  > Accurate end-to-end tail-latency forecasting is critical for proactive SLO management in microservice systems. However, modeling long-range dependency propagation and non-stationary, bursty workloads while maintaining inference efficiency at scale remains chal...

- **[DAK: Direct-Access-Enabled GPU Memory Offloading with Optimal Efficiency for LLM Inference](https://arxiv.org/abs/2604.26074)**  
  Shouxu Lin, Zhiyuan Guo, Jiaxin Lin · arXiv:2604.26074 · 2026-04-28
  > LLM inference is constrained by GPU memory capacity and bandwidth. Tiered memory architectures mitigate this by allowing the GPU to offload memory to the remote tier. However, existing memory offloading frameworks rely on prefetching data into local GPU HBM. T...

- **[MatchRDMA: A Segmented and Rate-Matched Long-Haul RDMA Scheme for Geo-distributed LLM Training over OTN](https://arxiv.org/abs/2604.23932)**  
  Jun Dai, Xiaorun Wang, Xingde Li et al. · arXiv:2604.23932 · 2026-04-27
  > We propose MatchRDMA, a proactive, segmented, and rate-matched long-haul RDMA scheme for geo-distributed LLM training over OTN. By coordinating source and destination OTN rates, it improves inter-DC throughput by up to 20x compared with conventional RDMA, and ...

- **[Benchmarking Storage Systems for Machine Learning Workloads Using NIO Bench](https://arxiv.org/abs/2609.05418)**  
  Jonathan W. Morris, Ionut Mistreanu, Connor Louie · arXiv:2609.05418 · 2026-04-25
  > Machine learning training workloads place unique demands on storage systems, yet most existing benchmarks focus on computational throughput rather than file system I/O behavior. We present a benchmarking framework, Neural I/O Benchmark (NIO Bench), that charac...

- **[MTServe: Efficient Serving for Generative Recommendation Models with Hierarchical Caches](https://arxiv.org/abs/2604.22881)**  
  Xin Wang, Chi Ma, Shaobin Chen et al. · arXiv:2604.22881 · 2026-04-24
  > Generative recommendation (GR) offers superior modeling capabilities but suffers from prohibitive inference costs due to the repeated encoding of long user histories. While cross-request Key-Value (KV) cache reuse presents a significant optimization opportunit...

- **[Optimizing High-Throughput Distributed Data Pipelines for Reproducible Deep Learning at Scale](https://arxiv.org/abs/2604.21275)**  
  Kashish Mittal, Di Yu, Roozbeh Ketabi et al. · arXiv:2604.21275 · 2026-04-23
  > Training massive-scale deep learning models on datasets spanning tens of terabytes presents critical challenges in hardware utilization and training reproducibility. In this paper, we identify and resolve profound data-loading bottlenecks within distributed GP...

- **[RateQuant: Optimal Mixed-Precision KV Cache Quantization via Rate-Distortion Theory](https://arxiv.org/abs/2605.06675)**  
  Fei Zuo, Zikang Zhou, Hao Cong et al. · arXiv:2605.06675 · 2026-04-22
  > Large language models cache all previously computed key-value (KV) pairs during generation, and this KV cache grows linearly with sequence length, making it a primary memory bottleneck for serving. Quantizing the KV cache to fewer bits reduces this cost, yet a...

- **[From Recall to Forgetting: Benchmarking Long-Term Memory for Personalized Agents](https://arxiv.org/abs/2604.20006)**  
  Md Nayem Uddin, Kumar Shubham, Eduardo Blanco et al. · arXiv:2604.20006 · 2026-04-21
  > Personalized agents that interact with users over long periods must maintain persistent memory across sessions and update it as circumstances change. However, existing benchmarks predominantly frame long-term memory evaluation as fact retrieval from past conve...

- **[MoE-nD: Per-Layer Mixture-of-Experts Routing for Multi-Axis KV Cache Compression](https://arxiv.org/abs/2604.17695)**  
  Libo Sun, Peixiong He, Po-Wei Harn et al. · arXiv:2604.17695 · 2026-04-20
  > KV cache memory is the dominant bottleneck for long-context LLM inference. Existing compression methods each act on a single axis of the four-dimensional KV tensor -- token eviction (sequence), quantization (precision), low-rank projection (head dimension), or...

- **[Topology-Aware Data Movement for Disaggregated GPU Inference](https://arxiv.org/abs/2607.28633)**  
  Sanjeev Rao Ganjihal · arXiv:2607.28633 · 2026-04-19
  > Disaggregated LLM inference creates a datacenter networking problem that no existing system solves correctly. When prefill and decode run on separate GPU pools, the KV cache must be transferred between them. For a 70B model this is 1.3 GB per request, exceedin...

- **[Predictive Multi-Tier Memory Management for KV Cache in Large-Scale GPU Inference](https://arxiv.org/abs/2604.26968)**  
  Sanjeev Rao Ganjihal · arXiv:2604.26968 · 2026-04-19
  > Key-value (KV) cache memory management is the primary bottleneck limiting throughput and cost-efficiency in large-scale GPU inference serving. Current systems suffer from three compounding inefficiencies: (1) the absence of unified KV cache sizing across all a...

- **[Sparse Prefix Caching for Hybrid and Recurrent LLM Serving](https://arxiv.org/abs/2605.05219)**  
  Mikhail Shirokikh, Sergey Nikolenko · arXiv:2605.05219 · 2026-04-17
  > Prefix caching is a key latency optimization for autoregressive LLM serving, yet existing systems assume dense per-token key/value reuse. State-space models change the structure of the problem: a recurrent layer can resume from a single stored state rather tha...

- **[Prefill-as-a-Service: KVCache of Next-Generation Models Could Go Cross-Datacenter](https://arxiv.org/abs/2604.15039)**  
  Ruoyu Qin, Weiran He, Yaoyu Wang et al. · arXiv:2604.15039 · 2026-04-16
  > Prefill-decode (PD) disaggregation has become the standard architecture for large-scale LLM serving, but in practice its deployment boundary is still determined by KVCache transfer. In conventional dense-attention models, prefill generates huge KVCache traffic...

- **[RetentiveKV: State-Space Memory for Uncertainty-Aware Multimodal KV Cache Eviction](https://arxiv.org/abs/2605.04075)**  
  Sihao Liu, YuFan Xiong, Zhonghua Jiang et al. · arXiv:2605.04075 · 2026-04-14
  > Multimodal Large Language Models face severe challenges in computational efficiency and memory consumption due to the substantial expansion of the visual KV cache when processing long visual contexts. Existing KV cache compression methods typically rely on the...

- **[IceCache: Memory-efficient KV-cache Management for Long-Sequence LLMs](https://arxiv.org/abs/2604.10539)**  
  Yuzhen Mao, Qitong Wang, Martin Ester et al. · arXiv:2604.10539 · 2026-04-12
  > Key-Value (KV) cache plays a crucial role in accelerating inference in large language models (LLMs) by storing intermediate attention states and avoiding redundant computation during autoregressive generation. However, its memory footprint scales linearly with...

- **[Decoupling Vector Data and Index Storage for Space Efficiency](https://arxiv.org/abs/2604.09173)**  
  Yuanming Ren, Juncheng Zhang, Yanjing Ren et al. · arXiv:2604.09173 · 2026-04-10
  > Managing large-scale vector datasets with disk-resident graph approximate nearest neighbor search (ANNS) systems incurs substantial storage overhead due to the co-location of vector data and auxiliary index metadata, which prevents the storage layer from explo...

- **[TensorHub: Scalable and Elastic Weight Transfer for LLM RL Training](https://arxiv.org/abs/2604.09107)**  
  Chenhao Ye, Huaizheng Zhang, Mingcong Han et al. · arXiv:2604.09107 · 2026-04-10
  > Modern LLM reinforcement learning (RL) workloads require a high-performance weight transfer system to scale training across heterogeneous compute resources. However, efficiently transferring terabyte-scale model weights across thousands of GPUs remains challen...

- **[KV Cache Offloading for Context-Intensive Tasks](https://arxiv.org/abs/2604.08426)**  
  Andrey Bocharnikov, Ivan Ermakov, Denis Kuznedelev et al. · arXiv:2604.08426 · 2026-04-09
  > With the growing demand for long-context LLMs across a wide range of applications, the key-value (KV) cache has become a critical bottleneck for both latency and memory usage. Recently, KV-cache offloading has emerged as a promising approach to reduce memory f...

- **[MemReader: From Passive to Active Extraction for Long-Term Agent Memory](https://arxiv.org/abs/2604.07877)**  
  Jingyi Kang, Chunyu Li, Ding Chen et al. · arXiv:2604.07877 · 2026-04-09
  > Long-term memory is fundamental for personalized and autonomous agents, yet populating it remains a bottleneck. Existing systems treat memory extraction as a one-shot, passive transcription from context to structured entries, which struggles with noisy dialogu...

- **[Blink: CPU-Free LLM Inference by Delegating the Serving Stack to GPU and SmartNIC](https://arxiv.org/abs/2604.07609)**  
  Mohammad Siavashi, Mariano Scazzariello, Gerald Q. Maguire et al. · arXiv:2604.07609 · 2026-04-08
  > Large Language Model (LLM) inference is rapidly becoming a core datacenter service, yet current serving stacks keep the host CPU on the critical path for orchestration and token-level control. This makes LLM performance sensitive to CPU interference, undermini...

- **[SwarmIO: Towards 100 Million IOPS SSD Emulation for Next-generation GPU-centric Storage Systems](https://arxiv.org/abs/2604.06668)**  
  Hyeseong Kim, Gwangoo Yeo, Minsoo Rhu · arXiv:2604.06668 · 2026-04-08
  > GPU-initiated I/O has emerged as a key mechanism for achieving high-throughput storage access by leveraging massive GPU thread-level parallelism, while recent industry trends point toward SSDs optimized for ultra-high random-read IOPS. Together, these trends a...

- **[ForkKV: Scaling Multi-LoRA Agent Serving via Copy-on-Write Disaggregated KV Cache](https://arxiv.org/abs/2604.06370)**  
  Shao Wang, Rui Ren, Lin Gui · arXiv:2604.06370 · 2026-04-07
  > The serving paradigm of large language models (LLMs) is rapidly shifting towards complex multi-agent workflows where specialized agents collaborate over massive shared contexts. While Low-Rank Adaptation (LoRA) enables the efficient co-hosting of these special...

- **[eOptShrinkQ: Near-Lossless KV Cache Compression Through Optimal Spectral Denoising and Quantization](https://arxiv.org/abs/2605.02905)**  
  Pei-Chun Su · arXiv:2605.02905 · 2026-04-06
  > We show that the key-value (KV) cache in transformer attention heads admits a natural decomposition into a low-rank \emph{shared context} component and a full-rank \emph{per-token} residual, well described by the spiked random matrix model. This observation le...

- **[TokenDance: Scaling Multi-Agent LLM Serving via Collective KV Cache Sharing](https://arxiv.org/abs/2604.03143)**  
  Zhuohang Bian, Feiyang Wu, Chengrui Zhang et al. · arXiv:2604.03143 · 2026-04-03
  > Multi-agent LLM applications organize execution in synchronized rounds where a central scheduler gathers outputs from all agents and redistributes the combined context. This All-Gather communication pattern creates massive KV Cache redundancy, because every ag...

- **[ReFlux: Reversible Compute Placement for CXL-Enabled Storage](https://arxiv.org/abs/2604.02442)**  
  Yanpeng Hu, Yiwei Yang, Yusheng Zheng et al. · arXiv:2604.02442 · 2026-04-02
  > Static offload to computational storage devices proves brittle because device-side processors throttle under sustained thermal load, while opaque, vendor-specific interfaces inflate adoption costs so severely that no computational storage platform has achieved...

- **[DeltaMem: Towards Agentic Memory Management via Reinforcement Learning](https://arxiv.org/abs/2604.01560)**  
  Qi Zhang, Shen Huang, Chu Liu et al. · arXiv:2604.01560 · 2026-04-02
  > Recent advances in persona-centric memory have revealed the powerful capability of multi-agent systems in managing persona memory, especially in conversational scenarios. However, these complex frameworks often suffer from information loss and are fragile acro...

- **[Fast and Accurate Probing of In-Training LLMs' Downstream Performances](https://arxiv.org/abs/2604.01025)**  
  Zhichen Liu, Tianle Lun, Zhibin Wen et al. · arXiv:2604.01025 · 2026-04-01
  > The paradigm of scaling Large Language Models (LLMs) in both parameter size and test time has pushed the boundaries of AI capabilities, but at the cost of making the traditional generative evaluation paradigm prohibitively expensive, therefore making the laten...

- **[TENT: A Declarative Slice Spraying Engine for Performant and Resilient Data Movement in Disaggregated LLM Serving](https://arxiv.org/abs/2604.00368)**  
  Feng Ren, Ruoyu Qin, Teng Ma et al. · arXiv:2604.00368 · 2026-04-01
  > Modern GPU clusters rely on complex, heterogeneous interconnects. As large language model (LLM) serving shifts toward agentic reasoning, KVCache becomes a first-class mobile asset, driving frequent migrations and massive elephant flows that dominate the execut...

- **[CXLRAMSim v1.0: System-Level Exploration of CXL Memory Expander Cards](https://arxiv.org/abs/2603.29483)**  
  Karan Pathak, David Atienza, Marina Zapater · arXiv:2603.29483 · 2026-03-31
  > The growing demands in the training and inference of Large Language Models (LLMs) are accelerating the adoption of scale-up systems that extend server shared memory through the use of Compute Express Link (CXL)-based load/store interconnects. Accurate full-sys...

- **[ScoutAttention: Efficient KV Cache Offloading via Layer-Ahead CPU Pre-computation for LLM Inference](https://arxiv.org/abs/2603.27138)**  
  Qiuyang Zhang, Kai Zhou, Ding Tang et al. · arXiv:2603.27138 · 2026-03-28
  > Large language models encounter critical GPU memory capacity constraints during long-context inference, where KV cache memory consumption severely limits decode batch sizes. While existing research has explored offloading KV cache to DRAM, these approaches eit...

- **[MemCam: Memory-Augmented Camera Control for Consistent Video Generation](https://arxiv.org/abs/2603.26193)**  
  Xinhang Gao, Junlin Guan, Shuhan Luo et al. · arXiv:2603.26193 · 2026-03-27
  > Interactive video generation has significant potential for scene simulation and video creation. However, existing methods often struggle with maintaining scene consistency during long video generation under dynamic camera control due to limited contextual info...

- **[Mind Your HEARTBEAT! Claw Background Execution Inherently Enables Silent Memory Pollution](https://arxiv.org/abs/2603.23064)**  
  Yechao Zhang, Shiqian Zhao, Jie Zhang et al. · arXiv:2603.23064 · 2026-03-24
  > We identify a critical security vulnerability in mainstream Claw personal AI agents: untrusted content encountered during heartbeat-driven background execution can silently pollute agent memory and subsequently influence user-facing behavior without the user's...

- **[PCR: A Prefetch-Enhanced Cache Reuse System for Low-Latency RAG Serving](https://arxiv.org/abs/2603.23049)**  
  Wenfeng Wang, Xiaofeng Hou, Peng Tang et al. · arXiv:2603.23049 · 2026-03-24
  > Retrieval-Augmented Generation (RAG) systems enhance the performance of large language models (LLMs) by incorporating supplementary retrieved documents, enabling more accurate and context-aware responses. However, integrating these external documents often res...

- **[GateANN: I/O-Efficient Filtered Vector Search on SSDs](https://arxiv.org/abs/2603.21466)**  
  Nakyung Lee, Soobin Cho, Jiwoong Park et al. · arXiv:2603.21466 · 2026-03-23
  > We present GateANN, an I/O-efficient SSD-based graph ANNS system that supports filtered vector search on an unmodified graph index. Existing SSD-based systems either waste I/O by post-filtering, or require expensive filter-aware index rebuilds. GateANN avoids ...

- **[Beyond Token Eviction: Mixed-Dimension Budget Allocation for Efficient KV Cache Compression](https://arxiv.org/abs/2603.20616)**  
  Ruijie Miao, Zhiming Wang, Wang Li et al. · arXiv:2603.20616 · 2026-03-21
  > Key-value (KV) caching is widely used to accelerate transformer inference, but its memory cost grows linearly with input length, limiting long-context deployment. Existing token eviction methods reduce memory by discarding less important tokens, which can be v...

- **[From Servers to Sites: Compositional Power Trace Generation of LLM Inference for Infrastructure Planning](https://arxiv.org/abs/2603.18383)**  
  Grant Wilkins, Fiodar Kazhamiaka, Ram Rajagopal · arXiv:2603.18383 · 2026-03-19
  > Datacenter operators and electrical utilities rely on power traces at different spatiotemporal scales. Operators use fine-grained traces for provisioning, facility management, and scheduling, while utilities use site-level load profiles for capacity and interc...

- **[Swarm: Co-Activation Aware KVCache Offloading Across Multiple SSDs](https://arxiv.org/abs/2603.17803)**  
  Tuowei Wang, Liyun Chu, Ruwen Fan et al. · arXiv:2603.17803 · 2026-03-18
  > The key-value (KV) cache has become the dominant contributor to memory consumption in large language model (LLM) inference. Although offloading KVCache from GPU high-bandwidth memory (HBM) to CPU DRAM alleviates device memory pressure, DRAM remains capacity-li...

- **[TokenPB: Enabling VLA Action Self-Verification via VLM Token Probability Bucketing](https://arxiv.org/abs/2603.18091)**  
  Chen Zhao, Zhuoran Wang, Haoyang Li et al. · arXiv:2603.18091 · 2026-03-18
  > Test-time sampling can improve Vision-Language-Action (VLA) policies, but only if the model can efficiently select a good action from multiple candidates. Prior work often relies on separately trained external verifiers, adding extra models and inference overh...

- **[inference-fleet-sim: A Queueing-Theory-Grounded Fleet Capacity Planner for LLM Inference](https://arxiv.org/abs/2603.16054)**  
  Huamin Chen, Xunzhuo Liu, Yuhan Liu et al. · arXiv:2603.16054 · 2026-03-17
  > Sizing a GPU fleet for LLM inference is harder than it looks. The obvious questions -- how many GPUs, which type, where to split a two-pool fleet -- have no closed-form answers. They depend on the full token-length distribution, the routing policy, and queuein...

- **[Joint Optimization of Storage and Loading for High-Performance 3D Point Cloud Data Processing](https://arxiv.org/abs/2603.16945)**  
  Ke Wang, Yanfei Cao, Xiangzhi Tao et al. · arXiv:2603.16945 · 2026-03-16
  > With the rapid development of computer vision and deep learning, significant advancements have been made in 3D vision, partic- ularly in autonomous driving, robotic perception, and augmented reality. 3D point cloud data, as a crucial representation of 3D infor...

- **[D-MEM: Dopamine-Gated Agentic Memory via Reward Prediction Error Routing](https://arxiv.org/abs/2603.14597)**  
  Yuru Song, Qi Xin · arXiv:2603.14597 · 2026-03-15
  > Autonomous LLM agents require structured long-term memory, yet current "append-and-evolve" systems like A-MEM face O(N^2) write-latency and excessive token costs. We introduce D-MEM (Dopamine-Gated Agentic Memory), a biologically inspired architecture that dec...

- **[NCCL EP: Towards a Unified Expert Parallel Communication API for NCCL](https://arxiv.org/abs/2603.13606)**  
  Amos Goldman, Nimrod Boker, Maayan Sheraizin et al. · arXiv:2603.13606 · 2026-03-13
  > Mixture-of-Experts (MoE) architectures have become essential for scaling large language models, driving the development of specialized device-initiated communication libraries such as DeepEP, Hybrid-EP, and others. These libraries demonstrate the performance b...

- **[d-HNSW: A High-performance Vector Search Engine on Disaggregated Memory](https://arxiv.org/abs/2603.13591)**  
  Fei Fang, Yi Liu, Chen Qian · arXiv:2603.13591 · 2026-03-13
  > Efficient vector search is essential for powering large-scale AI applications, such as LLMs. Existing solutions are designed for monolithic architectures where compute and memory are tightly coupled. Recently, disaggregated architecture breaks this coupling by...

- **[Governing Evolving Memory in LLM Agents: Risks, Mechanisms, and the Stability and Safety Governed Memory (SSGM) Framework](https://arxiv.org/abs/2603.11768)**  
  Chingkwun Lam, Jiaxin Li, Lingfei Zhang et al. · arXiv:2603.11768 · 2026-03-12
  > Long-term memory has emerged as a foundational component of autonomous Large Language Model (LLM) agents, enabling continuous adaptation, lifelong multimodal learning, and sophisticated reasoning. However, as memory systems transition from static retrieval dat...

- **[Pooling Engram Conditional Memory in Large Language Models using CXL](https://arxiv.org/abs/2603.10087)**  
  Ruiyang Ma, Teng Ma, Zhiyuan Su et al. · arXiv:2603.10087 · 2026-03-10
  > Engram conditional memory has emerged as a promising component for LLMs by decoupling static knowledge lookup from dynamic computation. Since Engram exhibits sparse access patterns and supports prefetching, its massive embedding tables are well-suited for offl...

- **[Multi-Agent Memory from a Computer Architecture Perspective: Visions and Challenges Ahead](https://arxiv.org/abs/2603.10062)**  
  Zhongming Yu, Naicheng Yu, Hejia Zhang et al. · arXiv:2603.10062 · 2026-03-09
  > As LLM agents evolve into collaborative multi-agent systems, their memory requirements grow rapidly in complexity. This position paper frames multi-agent memory as a computer architecture problem. We distinguish shared and distributed memory paradigms, propose...

- **[MoEless: Efficient MoE LLM Serving with Serverless Experts](https://arxiv.org/abs/2603.06350)**  
  Hanfei Yu, Bei Ouyang, Shwai He et al. · arXiv:2603.06350 · 2026-03-06
  > Large Language Models (LLMs) increasingly adopt Mixture-of-Experts (MoE) architectures to scale efficiently under stringent resource constraints. However, MoE's sparse activation causes severe expert load imbalance, where a few experts become stragglers while ...

- **[Vector-Quantized Soft Label Compression for Dataset Distillation](https://arxiv.org/abs/2603.03808)**  
  Ali Abbasi, Ashkan Shahbazi, Hamed Pirsiavash et al. · arXiv:2603.03808 · 2026-03-04
  > Dataset distillation is an emerging technique for reducing the computational and storage costs of training machine learning models by synthesizing a small, informative subset of data that captures the essential characteristics of a much larger dataset. Recent ...

- **[An experimental study of KV cache reuse strategies in chunk-level caching systems](https://arxiv.org/abs/2603.20218)**  
  Samuel Cestola, Tianxiang Xia, Zheng Weiyan et al. · arXiv:2603.20218 · 2026-03-03
  > Retrieval-augmented generation improves large language models' accuracy by adding relevant retrieved text to the prompt. Chunk level caching (CLC) accelerates inference by precomputing KV caches for these retrieved chunks and reusing them. However, these cache...

- **[Think, But Don't Overthink: Reproducing Recursive Language Models](https://arxiv.org/abs/2603.02615)**  
  Daren Wang · arXiv:2603.02615 · 2026-03-03
  > This project reproduces and extends the recently proposed ``Recursive Language Models'' (RLMs) framework by Zhang et al. (2026). This framework enables Large Language Models (LLMs) to process near-infinite contexts by offloading the prompt into an external REP...

- **[Disk-Resident Graph ANN Search: An Experimental Evaluation](https://arxiv.org/abs/2603.01779)**  
  Xiaoyu Chen, Jinxiu Qu, Yitong Song et al. · arXiv:2603.01779 · 2026-03-02
  > As data volumes grow while memory capacity remains limited, disk-resident graph-based approximate nearest neighbor (ANN) methods have become a practical alternative to memory-resident designs, shifting the bottleneck from computation to disk I/O. However, sinc...

- **[Zipage: Maintain High Request Concurrency for LLM Reasoning through Compressed PagedAttention](https://arxiv.org/abs/2603.08743)**  
  Mengqi Liao, Lu Wang, Chaoyun Zhang et al. · arXiv:2603.08743 · 2026-03-01
  > With reasoning becoming the generative paradigm for large language models (LLMs), the memory bottleneck caused by KV cache during the decoding phase has become a critical factor limiting high-concurrency service. Although existing KV cache eviction methods add...

- **[KEEP: A KV-Cache-Centric Memory Management System for Efficient Embodied Planning](https://arxiv.org/abs/2602.23592)**  
  Zebin Yang, Tong Xie, Baotong Lu et al. · arXiv:2602.23592 · 2026-02-27
  > Memory-augmented Large Language Models (LLMs) have demonstrated remarkable capability for complex and long-horizon embodied planning. By keeping track of past experiences and environmental states, memory enables LLMs to maintain a global view, thereby avoiding...

- **[The DMA Streaming Framework: Kernel-Level Buffer Orchestration for High-Performance AI Data Paths](https://arxiv.org/abs/2603.10030)**  
  Marco Graziano · arXiv:2603.10030 · 2026-02-26
  > AI transport libraries move bytes efficiently, but they commonly assume that buffers are already correctly allocated, placed, shared, registered, and safe under completion and teardown pressure. This paper presents dmaplane, a Linux kernel module that makes th...

- **[Optimizing SSD-Resident Graph Indexing for High-Throughput Vector Search](https://arxiv.org/abs/2602.22805)**  
  Weichen Zhao, Yuncheng Lu, Yao Tian et al. · arXiv:2602.22805 · 2026-02-26
  > Graph-based approximate nearest neighbor search (ANNS) methods (e.g., HNSW) have become the de facto state of the art for their high precision and low latency. To scale beyond main memory, recent out-of-memory ANNS systems leverage SSDs to store large vector i...

- **[CCCL: Node-Spanning GPU Collectives with CXL Memory Pooling](https://arxiv.org/abs/2602.22457)**  
  Dong Xu, Han Meng, Xinyu Chen et al. · arXiv:2602.22457 · 2026-02-25
  > Large language models (LLMs) training or inference across multiple nodes introduces significant pressure on GPU memory and interconnect bandwidth. The Compute Express Link (CXL) shared memory pool offers a scalable solution by enabling memory sharing across no...

- **[LLMTailor: A Layer-wise Tailoring Tool for Efficient Checkpointing of Large Language Models](https://arxiv.org/abs/2602.22158)**  
  Minqiu Sun, Xin Huang, Luanzheng Guo et al. · arXiv:2602.22158 · 2026-02-25
  > Checkpointing is essential for fault tolerance in training large language models (LLMs). However, existing methods, regardless of their I/O strategies, periodically store the entire model and optimizer states, incurring substantial storage overhead and resourc...

- **[Adaptive Multi-Objective Tiered Storage Configuration for KV Cache in LLM Service](https://arxiv.org/abs/2603.08739)**  
  Xianzhe Zheng, Zhengheng Wang, Ruiyan Ma et al. · arXiv:2603.08739 · 2026-02-25
  > The memory-for-computation paradigm of KV caching is essential for accelerating large language model (LLM) inference service, but limited GPU high-bandwidth memory (HBM) capacity motivates offloading the KV cache to cheaper external storage tiers. While this e...

- **[DualPath: Breaking the Storage Bandwidth Bottleneck in Agentic LLM Inference](https://arxiv.org/abs/2602.21548)**  
  Yongtong Wu, Shaoyuan Chen, Yinmin Zhong et al. · arXiv:2602.21548 · 2026-02-25
  > The performance of multi-turn, agentic LLM inference is increasingly dominated by KV-Cache storage I/O rather than computation. In prevalent disaggregated architectures, loading the massive KV-Cache from external storage creates a fundamental imbalance: storag...

- **[I/O Optimizations for Graph-Based Disk-Resident Approximate Nearest Neighbor Search: A Design Space Exploration](https://arxiv.org/abs/2602.21514)**  
  Liang Li, Shufeng Gong, Yanan Yang et al. · arXiv:2602.21514 · 2026-02-25
  > Approximate nearest neighbor (ANN) search on SSD-backed indexes is increasingly I/O-bound (I/O accounts for 70--90\% of query latency). We present an I/O-first framework for disk-based ANN that organizes techniques along three dimensions: memory layout, disk l...

- **[DualScale: Energy-Efficient Disaggregated LLM Serving via Phase-Aware Placement and DVFS](https://arxiv.org/abs/2602.18755)**  
  Omar Basit, Yunzhao Liu, Z. Jonny Kong et al. · arXiv:2602.18755 · 2026-02-21
  > Prefill/decode disaggregation is increasingly adopted in LLM serving to improve the latency-throughput tradeoff and meet strict TTFT and TPOT SLOs. However, LLM inference remains energy-hungry: autoscaling alone is too coarse-grained to track fast workload flu...

- **[HillInfer: Efficient Long-Context LLM Inference on the Edge with Hierarchical KV Eviction using SmartSSD](https://arxiv.org/abs/2602.18750)**  
  He Sun, Shinan Liu, Li Li et al. · arXiv:2602.18750 · 2026-02-21
  > Deploying Large Language Models (LLMs) on memory-constrained AI Personal Computers (AIPCs) enables low-latency, privacy-preserving inference, but long-context generation is fundamentally bottlenecked by the linearly growing Key-Value (KV) cache. While dynamic ...

- **[Choosing How to Remember: Adaptive Memory Structures for LLM Agents](https://arxiv.org/abs/2602.14038)**  
  Mingfei Lu, Mengjia Wu, Feng Liu et al. · arXiv:2602.14038 · 2026-02-15
  > Memory is critical for enabling large language model (LLM) based agents to maintain coherent behavior over long-horizon interactions. However, existing agent memory systems suffer from two key gaps: they rely on a one-size-fits-all memory structure and do not ...

- **[AuroraRL: Fast, Fault-Tolerant, and Cost-Efficient Reinforcement Learning over Decentralized Network](https://arxiv.org/abs/2602.11456)**  
  Chaoyi Ruan, Geng Luo, Xinyi Wan et al. · arXiv:2602.11456 · 2026-02-12
  > LLM reinforcement learning (RL) requires frequent synchronization of large model parameters between the trainer and distributed rollout actors. High-throughput RL post-training therefore relies on dedicated RDMA HPC/cloud clusters, an infrastructure cost most ...

- **[Efficient Remote KV Cache Reuse with GPU-native Video Codec](https://arxiv.org/abs/2602.09725)**  
  Liang Mi, Weijun Wang, Jinghan Chen et al. · arXiv:2602.09725 · 2026-02-10
  > Remote KV cache reuse fetches KV cache for identical contexts from remote storage, avoiding recomputation, accelerating LLM inference. While it excels in high-speed networks, its performance degrades significantly in bandwidth-limited scenarios. Recent studies...

- **[ParisKV: Fast and Drift-Robust KV-Cache Retrieval for Long-Context LLMs](https://arxiv.org/abs/2602.07721)**  
  Yanlin Qi, Xinhang Chen, Huiqiang Jiang et al. · arXiv:2602.07721 · 2026-02-07
  > KV-cache retrieval is essential for long-context LLM inference, yet existing methods struggle with distribution drift and high latency at scale. We introduce ParisKV, a drift-robust, GPU-native KV-cache retrieval framework based on collision-based candidate se...

- **[From Exact Hits to Close Enough: Semantic Caching for LLM Embeddings](https://arxiv.org/abs/2603.03301)**  
  Dvir David Biton, Roy Friedman · arXiv:2603.03301 · 2026-02-07
  > The rapid adoption of large language models (LLMs) has created demand for faster responses and lower costs. Semantic caching, reusing semantically similar requests via their embeddings, addresses this need but breaks classic cache assumptions and raises new ch...

- **[Learned Query Optimizer in Alibaba MaxCompute: Challenges, Analysis, and Solutions](https://arxiv.org/abs/2602.07336)**  
  Lianggui Weng, Dandan Liu, Wenzhuang Zhu et al. · arXiv:2602.07336 · 2026-02-07
  > Existing learned query optimizers remain ill-suited to modern distributed, multi-tenant data warehouses due to idealized modeling assumptions and design choices. Using Alibaba's MaxCompute as a representative, we surface four fundamental, system-agnostic chall...

- **[Graph-based Agent Memory: Taxonomy, Techniques, and Applications](https://arxiv.org/abs/2602.05665)**  
  Chang Yang, Chuang Zhou, Yilin Xiao et al. · arXiv:2602.05665 · 2026-02-05
  > Memory emerges as the core module in the Large Language Model (LLM)-based agents for long-horizon complex tasks (e.g., multi-turn dialogue, game playing, scientific discovery), where memory can enable knowledge accumulation, iterative reasoning and self-evolut...

- **[TIDE: Temporal Incremental Draft Engine for Self-Improving LLM Inference](https://arxiv.org/abs/2602.05145)**  
  Jiyoung Park, Hankyu Jang, Changseok Song et al. · arXiv:2602.05145 · 2026-02-05
  > Speculative decoding can substantially accelerate LLM inference, but realizing its benefits in practice is challenging due to evolving workloads. We present TIDE (Temporal Incremental Draft Engine), a serving-engine-native framework that integrates online draf...

- **[ERNIE 5.0 Technical Report](https://arxiv.org/abs/2602.04705)**  
  Haifeng Wang, Hua Wu, Tian Wu et al. · arXiv:2602.04705 · 2026-02-04
  > In this report, we introduce ERNIE 5.0, a natively autoregressive foundation model desinged for unified multimodal understanding and generation across text, image, video, and audio. All modalities are trained from scratch under a unified next-group-of-tokens p...

- **[Hierarchical Adaptive Eviction for KV Cache Management in Multimodal Language Models](https://arxiv.org/abs/2602.02197)**  
  Xindian Ma, Yidi Lu, Peng Zhang et al. · arXiv:2602.02197 · 2026-02-02
  > The integration of visual information into Large Language Models (LLMs) has enabled Multimodal LLMs (MLLMs), but the quadratic memory and computational costs of Transformer architectures remain a bottleneck. Existing KV cache eviction strategies fail to addres...

- **[QVCache: A Query-Aware Vector Cache](https://arxiv.org/abs/2602.02057)**  
  Anıl Eren Göçer, Ioanna Tsakalidou, Hamish Nicholson et al. · arXiv:2602.02057 · 2026-02-02
  > Vector databases have become a cornerstone of modern information retrieval, powering applications in recommendation, search, and retrieval-augmented generation (RAG) pipelines. However, scaling approximate nearest neighbor (ANN) search to high recall under str...

- **[LRAgent: Efficient KV Cache Sharing for Multi-LoRA LLM Agents](https://arxiv.org/abs/2602.01053)**  
  Hyesung Jeon, Hyeongju Ha, Jae-Joon Kim · arXiv:2602.01053 · 2026-02-01
  > Role specialization in multi-LLM agent systems is often realized via multi-LoRA, where agents share a pretrained backbone and differ only by lightweight adapters. Despite sharing base model weights, each agent independently builds and stores its own KV cache f...

- **[From Similarity to Vulnerability: Key Collision Attack on LLM Semantic Caching](https://arxiv.org/abs/2601.23088)**  
  Zhixiang Zhang, Zesen Liu, Yuchong Xie et al. · arXiv:2601.23088 · 2026-01-30
  > Semantic caching has emerged as a pivotal technique for scaling LLM applications, widely adopted by major providers including AWS and Microsoft. By utilizing semantic embedding vectors as cache keys, this mechanism effectively minimizes latency and redundant c...

- **[Past- and Future-Informed KV Cache Policy with Salience Estimation in Autoregressive Video Diffusion](https://arxiv.org/abs/2601.21896)**  
  Hanmo Chen, Chenghao Xu, Xu Yang et al. · arXiv:2601.21896 · 2026-01-29
  > Video generation is pivotal to digital media creation, and recent advances in autoregressive video generation have markedly enhanced the efficiency of real-time video synthesis. However, existing approaches generally rely on heuristic KV Cache policies, which ...

- **[ScaleSim: Serving Large-Scale Multi-Agent Simulation with Invocation Distance-Based Memory Management](https://arxiv.org/abs/2601.21473)**  
  Zaifeng Pan, Yipeng Shen, Zhengding Hu et al. · arXiv:2601.21473 · 2026-01-29
  > LLM-based multi-agent simulations are increasingly adopted across application domains, but remain difficult to scale due to GPU memory pressure. Each agent maintains private GPU-resident states, including models, prefix caches, and adapters, which quickly exha...

- **[OnePiece: A Large-Scale Distributed Inference System with RDMA for Complex AI-Generated Content (AIGC) Workflows](https://arxiv.org/abs/2601.20655)**  
  June Chen, Neal Xu, Gragas Huang et al. · arXiv:2601.20655 · 2026-01-28
  > The rapid growth of AI-generated content (AIGC) has enabled high-quality creative production across diverse domains, yet existing systems face critical inefficiencies in throughput, resource utilization, and scalability under concurrent workloads. This paper i...

- **[QMC: Efficient SLM Edge Inference via Outlier-Aware Quantization and Emergent Memories Co-Design](https://arxiv.org/abs/2601.14549)**  
  Nilesh Prasad Pandey, Jangseon Park, Onat Gungor et al. · arXiv:2601.14549 · 2026-01-21
  > Deploying Small Language Models (SLMs) on edge platforms is critical for real-time, privacy-sensitive generative AI, yet constrained by memory, latency, and energy budgets. Quantization reduces model size and cost but suffers from device noise in emerging non-...

- **[ContiguousKV: Accelerating LLM Prefill with Granularity-Aligned KV Cache Management](https://arxiv.org/abs/2601.13631)**  
  Jing Zou, Shangyu Wu, Hancong Duan et al. · arXiv:2601.13631 · 2026-01-20
  > Efficiently serving Large Language Models (LLMs) with persistent Prefix Key-Value (KV) Cache is critical for applications like conversational search and multi-turn dialogue. Serving a request requires loading the pre-computed prefix KV cache and generating the...

- **[From Prefix Cache to Fusion RAG Cache: Accelerating LLM Inference in Retrieval-Augmented Generation](https://arxiv.org/abs/2601.12904)**  
  Jiahao Wang, Weiyu Xie, Mingxing Zhang et al. · arXiv:2601.12904 · 2026-01-19
  > Retrieval-Augmented Generation enhances Large Language Models by integrating external knowledge, which reduces hallucinations but increases prompt length. This increase leads to higher computational costs and longer Time to First Token (TTFT). To mitigate this...

- **[FaTRQ: Tiered Residual Quantization for LLM Vector Search in Far-Memory-Aware ANNS Systems](https://arxiv.org/abs/2601.09985)**  
  Tianqi Zhang, Flavio Ponzina, Tajana Rosing · arXiv:2601.09985 · 2026-01-15
  > Approximate Nearest-Neighbor Search (ANNS) is a key technique in retrieval-augmented generation (RAG), enabling rapid identification of the most relevant high-dimensional embeddings from massive vector databases. Modern ANNS engines accelerate this process usi...

- **[When KV Cache Reuse Fails in Multi-Agent Systems: Cross-Candidate Interaction is Crucial for LLM Judges](https://arxiv.org/abs/2601.08343)**  
  Sichu Liang, Zhenglin Wang, Jiajia Chu et al. · arXiv:2601.08343 · 2026-01-13
  > Multi-agent LLM systems routinely generate multiple candidate responses that are aggregated by an LLM judge. To reduce the dominant prefill cost in such pipelines, recent work advocates KV cache reuse across partially shared contexts and reports substantial sp...

- **[SwiftMem: Fast Agentic Memory via Query-aware Indexing](https://arxiv.org/abs/2601.08160)**  
  Anxin Tian, Yiming Li, Xing Li et al. · arXiv:2601.08160 · 2026-01-13
  > Agentic memory systems have become critical for enabling LLM agents to maintain long-term context and retrieve relevant information efficiently. However, existing memory frameworks often perform query-agnostic retrieval over the full memory embedding space eve...

- **[Don't Break the Cache: An Evaluation of Prompt Caching for Long-Horizon Agentic Tasks](https://arxiv.org/abs/2601.06007)**  
  Elias Lumer, Faheem Nizar, Akshaya Jangiti et al. · arXiv:2601.06007 · 2026-01-09
  > Recent advancements in Large Language Model (LLM) agents have enabled complex multi-turn agentic tasks requiring extensive tool calling, where conversations can span dozens of API calls with increasingly large context windows. However, although major LLM provi...

- **[LAPS: A Length-Aware-Prefill LLM Serving System](https://arxiv.org/abs/2601.11589)**  
  Jianshu She, Zonghang Li, Hongchao Du et al. · arXiv:2601.11589 · 2026-01-04
  > LAPS identifies and disaggregates requests with different prompt lengths in LLM serving to reduce TTFT latency. While recent systems have decoupled the prefill and decode stages to improve throughput, they still rely on unified scheduling policies that fail to...

- **[OptiNIC: A Resilient and Tail-Optimal RDMA NIC for Distributed ML Workloads](https://arxiv.org/abs/2512.22743)**  
  Ertza Warraich, Ali Imran, Annus Zulfiqar et al. · arXiv:2512.22743 · 2025-12-28
  > As distributed machine learning (ML) workloads scale to thousands of GPUs connected by high-speed interconnects, tail latency in collective communication has become a major bottleneck. Existing RDMA transports, such as RoCE, IRN, SRNIC, and Falcon, enforce str...

- **[Predictive-LoRA: A Proactive and Fragmentation-Aware Serverless Inference System for LLMs](https://arxiv.org/abs/2512.20210)**  
  Yinan Ni, Xiao Yang, Yuqi Tang et al. · arXiv:2512.20210 · 2025-12-23
  > The serverless computing paradigm offers compelling advantages for deploying Large Language Model (LLM) inference services, including elastic scaling and pay-per-use billing. However, serving multiple fine-tuned LLMs via Low-Rank Adaptation (LoRA) in serverles...

- **[MemEvolve: Meta-Evolution of Agent Memory Systems](https://arxiv.org/abs/2512.18746)**  
  Guibin Zhang, Haotian Ren, Chong Zhan et al. · arXiv:2512.18746 · 2025-12-21
  > Self-evolving memory systems are unprecedentedly reshaping the evolutionary paradigm of large language model (LLM)-based agents. Prior work has predominantly relied on manually engineered memory architectures to store trajectories, distill experience, and synt...

- **[Memorize-and-Generate: Towards Long-Term Consistency in Real-Time Video Generation](https://arxiv.org/abs/2512.18741)**  
  Tianrui Zhu, Shiyi Zhang, Zhirui Sun et al. · arXiv:2512.18741 · 2025-12-21
  > Frame-level autoregressive (frame-AR) models have achieved significant progress, enabling real-time video generation comparable to bidirectional diffusion models and serving as a foundation for interactive world models and game engines. However, current approa...

- **[Remoe: Towards Efficient and Low-Cost MoE Inference in Serverless Computing](https://arxiv.org/abs/2512.18674)**  
  Wentao Liu, Yuhao Hu, Ruiting Zhou et al. · arXiv:2512.18674 · 2025-12-21
  > Mixture-of-Experts (MoE) has become a dominant architecture in large language models (LLMs) due to its ability to scale model capacity via sparse expert activation. Meanwhile, serverless computing, with its elasticity and pay-per-use billing, is well-suited fo...

- **[TraCT: Disaggregated LLM Serving with CXL Shared Memory KV Cache at Rack-Scale](https://arxiv.org/abs/2512.18194)**  
  Dongha Yoon, Younghoon Min, Hoshik Kim et al. · arXiv:2512.18194 · 2025-12-20
  > Disaggregated LLM serving improves resource efficiency by separating the compute-intensive prefill phase from the latency-critical decode phase. However, this architecture introduces a fundamental bottleneck: key/value (KV) tensors generated during prefill mus...

- **[MEPIC: Memory Efficient Position Independent Caching for LLM Serving](https://arxiv.org/abs/2512.16822)**  
  Qian Wang, Zahra Yousefijamarani, Morgan Lindsay Heisler et al. · arXiv:2512.16822 · 2025-12-18
  > Modern LLM applications such as deep-research assistants, coding agents, and Retrieval-Augmented Generation (RAG) systems, repeatedly process long prompt histories containing shared document or code chunks, creating significant pressure on the Key Value (KV) c...

- **[MultiPath Memory Access: Breaking Host-GPU Bandwidth Bottlenecks in LLM Services](https://arxiv.org/abs/2512.16056)**  
  Lingfeng Tang, Daoping Zhang, Junjie Chen et al. · arXiv:2512.16056 · 2025-12-18
  > Host-GPU data movement has become a latency-critical bottleneck in LLM serving, surfacing in common paths such as model-weight movement and KV cache offload/fetch. Today, each host-GPU copy is effectively confined to the PCIe path of the target GPU, even thoug...

- **[EVICPRESS: Joint KV-Cache Compression and Eviction for Efficient LLM Serving](https://arxiv.org/abs/2512.14946)**  
  Shaoting Feng, Yuhan Liu, Hanchen Li et al. · arXiv:2512.14946 · 2025-12-16
  > Reusing KV cache is essential for high efficiency of Large Language Model (LLM) inference systems. With more LLM users, the KV cache footprint can easily exceed GPU memory capacity, so prior work has proposed to either evict KV cache to lower-tier storage devi...

- **[Understanding Bottlenecks for Efficiently Serving LLM Inference With KV Offloading](https://arxiv.org/abs/2601.19910)**  
  William Meng, Benjamin Lee, Hong Wang · arXiv:2601.19910 · 2025-12-16
  > KV cache offloading enables long-context LLM inference by storing caches in CPU DRAM, but PCIe bandwidth limitations create severe bottlenecks. In this paper, we develops an analytical framework that derives $κ_{\text{crit}}$, the critical cached-to-prefill to...

- **[Adaptive Cache Pollution Control for Large Language Model Inference Workloads Using Temporal CNN-Based Prediction and Priority-Aware Replacement](https://arxiv.org/abs/2512.14151)**  
  Songze Liu, Hongkun Du, Shaowen Wang · arXiv:2512.14151 · 2025-12-16
  > Large Language Models (LLMs), such as GPT and LLaMA, introduce unique memory access characteristics during inference due to frequent token sequence lookups and embedding vector retrievals. These workloads generate highly irregular and bursty access patterns, c...

- **[V-Rex: Real-Time Streaming Video LLM Acceleration via Dynamic KV Cache Retrieval](https://arxiv.org/abs/2512.12284)**  
  Donghyuk Kim, Sejeong Yang, Wonjin Shin et al. · arXiv:2512.12284 · 2025-12-13
  > Streaming video large language models (LLMs) are increasingly used for real-time multimodal tasks such as video captioning, question answering, conversational agents, and augmented reality. However, these models face fundamental memory and computational challe...

- **[SHIFT: Exploring the Boundary of RDMA Network Fault Tolerance](https://arxiv.org/abs/2512.11094)**  
  Shengkai Lin, Kairui Zhou, Hongtao Zhang et al. · arXiv:2512.11094 · 2025-12-11
  > Under gang scheduling for large-scale distributed large language model (LLM) training, a single network anomaly can stall or abort an entire job. Current network fault tolerance mechanisms typically adopt a ``fallback and bypass'' approach within the switching...

- **[CXL-SpecKV: A Disaggregated FPGA Speculative KV-Cache for Datacenter LLM Serving](https://arxiv.org/abs/2512.11920)**  
  Dong Liu, Yanxuan Yu · arXiv:2512.11920 · 2025-12-11
  > Large Language Models (LLMs) have revolutionized natural language processing tasks, but their deployment in datacenter environments faces significant challenges due to the massive memory requirements of key-value (KV) caches. During the autoregressive decoding...

- **[Passing the Baton: High Throughput Distributed Disk-Based Vector Search with BatANN](https://arxiv.org/abs/2512.09331)**  
  Nam Anh Dang, Ben Landrum, Ken Birman · arXiv:2512.09331 · 2025-12-10
  > Vector search underpins modern information-retrieval systems, including retrieval-augmented generation (RAG) pipelines and search engines over unstructured text and images. As datasets scale to billions of vectors, disk-based vector search has emerged as a pra...

- **[Predictive Modeling of I/O Performance for Machine Learning Training Pipelines: A Data-Driven Approach to Storage Optimization](https://arxiv.org/abs/2512.06699)**  
  Karthik Prabhakar, Durgamadhab Mishra · arXiv:2512.06699 · 2025-12-07
  > Modern machine learning training is increasingly bottlenecked by data I/O rather than compute. GPUs often sit idle at below 50% utilization waiting for data. This paper presents a machine learning approach to predict I/O performance and recommend optimal stora...

- **[Context-Aware Mixture-of-Experts Inference on CXL-Enabled GPU-NDP Systems](https://arxiv.org/abs/2512.04476)**  
  Zehao Fan, Zhenyu Liu, Yunzhen Liu et al. · arXiv:2512.04476 · 2025-12-04
  > Mixture-of-Experts (MoE) models scale large language models through conditional computation, but inference becomes memory-bound once expert weights exceed the capacity of GPU memory. In this case, weights must be offloaded to external memory, and fetching them...

- **[FFTrainer: Fast Failover in Large-Language Model Training with Almost-Free State Management](https://arxiv.org/abs/2512.03644)**  
  Bohan Zhao, Yuanhong Wang, Chenglin Liu et al. · arXiv:2512.03644 · 2025-12-03
  > Recent developments in large language models (LLMs) have introduced new requirements for efficient and robust training. As LLM clusters scale, node failures, lengthy recoveries, and bulky checkpoints erode efficiency. Infrequent asynchronous checkpoints trigge...

- **[Trinity: Disaggregating Vector Search from Prefill-Decode Disaggregation in LLM Serving](https://arxiv.org/abs/2512.02281)**  
  Yi Liu, Chen Qian · arXiv:2512.02281 · 2025-12-01
  > Prefill and decode (PD) disaggregation separates prompt prefill and token-by-token decode stages into distinct GPU pools and has become the dominant architecture for large-scale LLM serving in industry. Also, retrieval tasks via vector search remains entangled...

- **[Fantasy: Efficient Large-scale Vector Search on GPU Clusters with GPUDirect Async](https://arxiv.org/abs/2512.02278)**  
  Yi Liu, Chen Qian · arXiv:2512.02278 · 2025-12-01
  > Vector similarity search has become a critical component in AI-driven applications such as large language models (LLMs). To achieve high recall and low latency, GPUs are utilized to exploit massive parallelism for faster query processing. However, as the numbe...

- **[Tangram: Accelerating Serverless LLM Loading through GPU Memory Reuse and Affinity](https://arxiv.org/abs/2512.01357)**  
  Wenbin Zhu, Zhaoyan Shen, Zili Shao et al. · arXiv:2512.01357 · 2025-12-01
  > Serverless Large Language Models (LLMs) have emerged as a cost-effective solution for deploying AI services by enabling a 'pay-as-you-go' pricing model through GPU resource sharing. However, cold-start latency, especially the model loading phase, has become a ...

- **[SpeContext: Enabling Efficient Long-context Reasoning with Speculative Context Sparsity in LLMs](https://arxiv.org/abs/2512.00722)**  
  Jiaming Xu, Jiayi Pan, Hanzhen Wang et al. · arXiv:2512.00722 · 2025-11-30
  > In this paper, we point out that the objective of the retrieval algorithms is to align with the LLM, which is similar to the objective of knowledge distillation in LLMs. We analyze the similarity in information focus between the distilled language model(DLM) a...

- **[G-KV: Decoding-Time KV Cache Eviction with Global Attention](https://arxiv.org/abs/2512.00504)**  
  Mengqi Liao, Lu Wang, Chaoyun Zhang et al. · arXiv:2512.00504 · 2025-11-29
  > Recent reasoning large language models (LLMs) excel in complex tasks but encounter significant computational and memory challenges due to long sequence lengths. KV cache compression has emerged as an effective approach to greatly enhance the efficiency of reas...

- **[Efficient Multi-Adapter LLM Serving via Cross-Model KV-Cache Reuse with Activated LoRA](https://arxiv.org/abs/2512.17910)**  
  Allison Li, Kristjan Greenewald, Thomas Parnell et al. · arXiv:2512.17910 · 2025-11-26
  > Modern large language model (LLM) systems increasingly rely on multi-turn pipelines that are composed of multiple task-specific adapters, yet existing serving frameworks remain inefficient, incurring substantial recomputation overhead when switching between ad...

- **[DOPD: A Dynamic PD-Disaggregation Architecture for Maximizing Goodput in LLM Inference Serving](https://arxiv.org/abs/2511.20982)**  
  Junhan Liao, Minxian Xu, Wanyi Zheng et al. · arXiv:2511.20982 · 2025-11-26
  > To meet strict Service-Level Objectives (SLOs),contemporary Large Language Models (LLMs) decouple the prefill and decoding stages and place them on separate GPUs to mitigate the distinct bottlenecks inherent to each phase. However, the heterogeneity of LLM wor...

- **[Beluga: A CXL-Based Memory Architecture for Scalable and Efficient LLM KVCache Management](https://arxiv.org/abs/2511.20172)**  
  Xinjun Yang, Qingda Hu, Junru Li et al. · arXiv:2511.20172 · 2025-11-25
  > The rapid increase in LLM model sizes and the growing demand for long-context inference have made memory a critical bottleneck in GPU-accelerated serving systems. Although high-bandwidth memory (HBM) on GPUs offers fast access, its limited capacity necessitate...

- **[SWAN: Sparse Winnowed Attention for Reduced Inference Memory via Decompression-Free KV-Cache Compression](https://arxiv.org/abs/2511.18936)**  
  Santhosh G S, Saurav Prakash, Balaraman Ravindran · arXiv:2511.18936 · 2025-11-24
  > Large Language Models (LLMs) face a significant bottleneck during autoregressive inference due to the massive memory footprint of the Key-Value (KV) cache. Existing compression techniques like token eviction, quantization, or other low-rank methods often risk ...

- **[End-to-End Transformer Acceleration Through Processing-in-Memory Architectures](https://arxiv.org/abs/2601.14260)**  
  Xiaoxuan Yang, Peilin Chen, Tergel Molom-Ochir et al. · arXiv:2601.14260 · 2025-11-21
  > Transformers have become central to natural language processing and large language models, but their deployment at scale faces three major challenges. First, the attention mechanism requires massive matrix multiplications and frequent movement of intermediate ...

- **[Cloud-Native Vector Search: A Comprehensive Performance Analysis](https://arxiv.org/abs/2511.14748)**  
  Zhaoheng Li, Wei Ding, Silu Huang et al. · arXiv:2511.14748 · 2025-11-18
  > Vector search has been widely employed in recommender system and retrieval-augmented-generation pipelines, commonly performed with vector indexes to efficiently find similar items in large datasets. Recent growths in both data and task complexity have motivate...

- **[RAGPulse: An Open-Source RAG Workload Trace to Optimize RAG Serving Systems](https://arxiv.org/abs/2511.12979)**  
  Zhengchao Wang, Yitao Hu, Jianing Ye et al. · arXiv:2511.12979 · 2025-11-17
  > Retrieval-Augmented Generation (RAG) is a critical paradigm for building reliable, knowledge-intensive Large Language Model (LLM) applications. However, the multi-stage pipeline (retrieve, generate) and unique workload characteristics (e.g., knowledge dependen...

- **[BitSnap: Checkpoint Sparsification and Quantization in LLM Training](https://arxiv.org/abs/2511.12376)**  
  Yanxin Peng, Qingping Li, Baodong Wu et al. · arXiv:2511.12376 · 2025-11-15
  > As large language models (LLMs) continue to grow in size and complexity, efficient checkpoint saving\&loading has become crucial for managing storage, memory usage, and fault tolerance in LLM training. The current works do not comprehensively take into account...

- **[KVSwap: Disk-aware KV Cache Offloading for Long-Context On-device Inference](https://arxiv.org/abs/2511.11907)**  
  Huawei Zhang, Chunwei Xia, Zheng Wang · arXiv:2511.11907 · 2025-11-14
  > Language models (LMs) underpin emerging mobile and embedded AI applications like meeting and video summarization and document analysis, which often require processing multiple long-context inputs. Running an LM locally on-device improves privacy, enables offli...

- **[$A^3$: Attention-Aware Accurate KV Cache Fusion for Fast Large Language Model Serving](https://arxiv.org/abs/2511.17560)**  
  Yuechi Zhou, Yi Su, Jianxin Zhang et al. · arXiv:2511.17560 · 2025-11-13
  > Large language models (LLMs) have demonstrated strong capabilities in processing long contexts, enabling them to tackle tasks involving long textual inputs such as multi-turn conversations, legal documents, or retrieved documents in Retrieval-Augmented Generat...

- **[Uncertainty-Guided Checkpoint Selection for Reinforcement Finetuning of Large Language Models](https://arxiv.org/abs/2511.09864)**  
  Manh Nguyen, Dung Nguyen, Dai Do et al. · arXiv:2511.09864 · 2025-11-13
  > Reinforcement learning (RL) finetuning is crucial to aligning large language models (LLMs), but the process is notoriously unstable and exhibits high variance across model checkpoints. In practice, selecting the best checkpoint is challenging: evaluating check...

- **[GoCkpt: Gradient-Assisted Multi-Step overlapped Checkpointing for Efficient LLM Training](https://arxiv.org/abs/2511.07035)**  
  Keyao Zhang, Yiquan Chen, Zhuo Hu et al. · arXiv:2511.07035 · 2025-11-10
  > The accuracy of large language models (LLMs) improves with increasing model size, but increasing model complexity also poses significant challenges to training stability. Periodic checkpointing is a key mechanism for fault recovery and is widely used in LLM tr...

- **[Continuum: Efficient and Robust Multi-Turn LLM Agent Scheduling with KV Cache Time-to-Live](https://arxiv.org/abs/2511.02230)**  
  Hanchen Li, Runyuan He, Qiuyang Mang et al. · arXiv:2511.02230 · 2025-11-04
  > KV cache management is essential for efficient LLM inference. To maximize utilization, existing inference engines evict finished requests' KV cache if new requests are waiting. This policy breaks for agentic workloads, which interleave LLM calls with tools, in...

- **[KV Cache Transform Coding for Compact Storage in LLM Inference](https://arxiv.org/abs/2511.01815)**  
  Konrad Staniszewski, Adrian Łańcucki · arXiv:2511.01815 · 2025-11-03
  > Serving large language models (LLMs) at scale necessitates efficient key-value (KV) cache management. KV caches can be reused across conversation turns via shared-prefix prompts that are common in iterative code editing and chat. However, stale caches consume ...

- **[FlexiCache: Leveraging Temporal Stability of Attention Heads for Efficient KV Cache Management](https://arxiv.org/abs/2511.00868)**  
  Nazmul Takbir, Hamidreza Alikhani, Nikil Dutt et al. · arXiv:2511.00868 · 2025-11-02
  > Large Language Model (LLM) serving is increasingly constrained by the growing size of the key-value (KV) cache, which scales with both context length and generation length. Prior work shows that attention is dominated by a small subset of critical tokens, yet ...

- **[Scalable Processing-Near-Memory for 1M-Token LLM Inference: CXL-Enabled KV-Cache Management Beyond GPU Limits](https://arxiv.org/abs/2511.00321)**  
  Dowon Kim, MinJae Lee, Janghyeon Kim et al. · arXiv:2511.00321 · 2025-10-31
  > The expansion of context windows in large language models (LLMs) to multi-million tokens introduces severe memory and compute bottlenecks, particularly in managing the growing Key-Value (KV) cache. While Compute Express Link (CXL) enables non-eviction framewor...

- **[fabric-lib: RDMA Point-to-Point Communication for LLM Systems](https://arxiv.org/abs/2510.27656)**  
  Nandor Licker, Kevin Hu, Vladimir Zaytsev et al. · arXiv:2510.27656 · 2025-10-31
  > Emerging Large Language Model (LLM) system patterns, such as disaggregated inference, Mixture-of-Experts (MoE) routing, and asynchronous reinforcement fine-tuning, require flexible point-to-point communication beyond simple collectives. Existing implementation...

- **[Category-Aware Semantic Caching for Heterogeneous LLM Workloads](https://arxiv.org/abs/2510.26835)**  
  Chen Wang, Xunzhuo Liu, Yue Zhu et al. · arXiv:2510.26835 · 2025-10-29
  > LLM serving systems process heterogeneous query workloads where different categories exhibit different characteristics. Code queries cluster densely in embedding space while conversational queries distribute sparsely. Content staleness varies from minutes (sto...

- **[TokenCake: A KV-Cache-centric Serving Framework for LLM-based Multi-Agent Applications](https://arxiv.org/abs/2510.18586)**  
  Zhuohang Bian, Feiyang Wu, Zhuoran Li et al. · arXiv:2510.18586 · 2025-10-21
  > Large Language Models (LLMs) are increasingly deployed in complex multi-agent applications that rely on external function calls. This workload creates severe performance challenges for the KV Cache: spatial contention leads to the eviction of critical agents' ...

- **[Approximate Nearest Neighbor Search of Large Scale Vectors on Distributed Storage](https://arxiv.org/abs/2510.17326)**  
  Kun Yu, Jiabao Jin, Xiaoyao Zhong et al. · arXiv:2510.17326 · 2025-10-20
  > Approximate Nearest Neighbor Search (ANNS) in high-dimensional space is an essential operator in many online services, such as information retrieval and recommendation. Indices constructed by the state-of-the-art ANNS algorithms must be stored in single machin...

- **[ScalePool: Hybrid XLink-CXL Fabric for Composable Resource Disaggregation in Unified Scale-up Domains](https://arxiv.org/abs/2510.14580)**  
  Hyein Woo, Miryeong Kwon, Jiseon Kim et al. · arXiv:2510.14580 · 2025-10-16
  > This paper proposes ScalePool, a novel cluster architecture designed to interconnect numerous accelerators using unified hardware interconnects rather than traditional long-distance networking. ScalePool integrates Accelerator-Centric Links (XLink) and Compute...

- **[Same model, better performance: the impact of shuffling on DNA Language Models benchmarking](https://arxiv.org/abs/2510.12617)**  
  Davide Greco, Konrad Rawlik · arXiv:2510.12617 · 2025-10-14
  > Large Language Models are increasingly popular in genomics due to their potential to decode complex biological sequences. Hence, researchers require a standardized benchmark to evaluate DNA Language Models (DNA LMs) capabilities. However, evaluating DNA LMs is...

- **[GeoPipe: a Geo-distributed LLM Training Framework with enhanced Pipeline Parallelism in a Lossless RDMA-enabled Datacenter Optical Transport Network](https://arxiv.org/abs/2510.12064)**  
  Jun Dai, Xiaorun Wang, Kexiong Fang et al. · arXiv:2510.12064 · 2025-10-14
  > The proliferation of Large Language Models (LLMs) with exponentially growing parameters is making cross-data center (DC) training an inevitable trend. However, viable strategies for extending single-DC training frameworks to multi-DC environments remain underd...

- **[LouisKV: Efficient KV Cache Retrieval for Long Input-Output Sequences](https://arxiv.org/abs/2510.11292)**  
  Wenbo Wu, Qingyi Si, Xiurui Pan et al. · arXiv:2510.11292 · 2025-10-13
  > While Key-Value (KV) cache succeeds in reducing redundant computations in auto-regressive models, it introduces significant memory overhead, limiting its practical deployment in long-sequence scenarios. Existing KV retrieval methods mitigate this by dynamicall...

- **[CacheClip: Accelerating RAG with Effective KV Cache Reuse](https://arxiv.org/abs/2510.10129)**  
  Bin Yang, Qiuyu Leng, Jun Zeng et al. · arXiv:2510.10129 · 2025-10-11
  > Retrieval-Augmented Generation (RAG) systems suffer from severe time-to-first-token (TTFT) bottlenecks due to long input sequences. Existing KV cache reuse methods face a fundamental trade-off: prefix caching requires identical prefixes that rarely occur in RA...

- **[Dream to Recall: Imagination-Guided Experience Retrieval for Memory-Persistent Vision-and-Language Navigation](https://arxiv.org/abs/2510.08553)**  
  Yunzhe Xu, Yiyuan Pan, Zhe Liu · arXiv:2510.08553 · 2025-10-09
  > Vision-and-Language Navigation (VLN) requires agents to follow natural language instructions through environments, with memory-persistent variants demanding progressive improvement through accumulated experience. Existing approaches for memory-persistent VLN f...

- **[LMCache: An Efficient KV Cache Layer for Enterprise-Scale LLM Inference](https://arxiv.org/abs/2510.09665)**  
  Yuhan Liu, Yihua Cheng, Jiayi Yao et al. · arXiv:2510.09665 · 2025-10-08
  > KV cache has traditionally been stored in GPU memory to accelerate the decoding phase of large language model (LLM) inference. However, it is increasingly necessary to move KV caches outside GPU devices, to enable cache reuse across different queries and infer...

- **[Instability in Downstream Task Performance During LLM Pretraining](https://arxiv.org/abs/2510.04848)**  
  Yuto Nishida, Masaru Isonuma, Yusuke Oda · arXiv:2510.04848 · 2025-10-06
  > When training large language models (LLMs), it is common practice to track downstream task performance throughout the training process and select the checkpoint with the highest validation score. However, downstream metrics often exhibit substantial fluctuatio...

- **[ThinKV: Thought-Adaptive KV Cache Compression for Efficient Reasoning Models](https://arxiv.org/abs/2510.01290)**  
  Akshat Ramachandran, Marina Neseem, Charbel Sakr et al. · arXiv:2510.01290 · 2025-10-01
  > The long-output context generation of large reasoning models enables extended chain of thought (CoT) but also drives rapid growth of the key-value (KV) cache, quickly overwhelming GPU memory. To address this challenge, we propose ThinKV, a thought-adaptive KV ...

- **[The Pitfalls of KV Cache Compression](https://arxiv.org/abs/2510.00231)**  
  Alex Chen, Renato Geh, Aditya Grover et al. · arXiv:2510.00231 · 2025-09-30
  > KV cache compression promises increased throughput and efficiency with negligible loss in performance. While the gains in throughput are indisputable and recent literature has indeed shown minimal degradation on particular benchmarks, in general the consequenc...

- **[Scalable Disk-Based Approximate Nearest Neighbor Search with Page-Aligned Graph](https://arxiv.org/abs/2509.25487)**  
  Dingyi Kang, Dongming Jiang, Hanshen Yang et al. · arXiv:2509.25487 · 2025-09-29
  > Approximate Nearest Neighbor Search (ANNS), as the core of vector databases (VectorDBs), has become widely used in modern AI and ML systems, powering applications from information retrieval to bio-informatics. While graph-based ANNS methods achieve high query ...

- **[SANA-Video: Efficient Video Generation with Block Linear Diffusion Transformer](https://arxiv.org/abs/2509.24695)**  
  Junsong Chen, Yuyang Zhao, Jincheng Yu et al. · arXiv:2509.24695 · 2025-09-29
  > We introduce SANA-Video, a small diffusion model that can efficiently generate videos up to 720x1280 resolution and minute-length duration. SANA-Video synthesizes high-resolution, high-quality and long videos with strong text-video alignment at a remarkably fa...

- **[Intent-Driven Storage Systems: From Low-Level Tuning to High-Level Understanding](https://arxiv.org/abs/2510.15917)**  
  Shai Bergman, Won Wook Song, Lukas Cavigelli et al. · arXiv:2510.15917 · 2025-09-29
  > Existing storage systems lack visibility into workload intent, limiting their ability to adapt to the semantics of modern, large-scale data-intensive applications. This disconnect leads to brittle heuristics and fragmented, siloed optimizations. To address the...

- **[Speculate Deep and Accurate: Lossless and Training-Free Acceleration for Offloaded LLMs via Substitute Speculative Decoding](https://arxiv.org/abs/2509.18344)**  
  Pei-Shuo Wang, Jian-Jia Chen, Chun-Che Yang et al. · arXiv:2509.18344 · 2025-09-22
  > The immense model sizes of large language models (LLMs) challenge deployment on memory-limited consumer GPUs. Although model compression and parameter offloading are common strategies to address memory limitations, compression can degrade quality, and offloadi...

- **[Cronus: Efficient LLM inference on Heterogeneous GPU Clusters via Partially Disaggregated Prefill](https://arxiv.org/abs/2509.17357)**  
  Yunzhao Liu, Qiang Xu, Y. Charlie Hu · arXiv:2509.17357 · 2025-09-22
  > Efficient LLM inference is critical for real-world applications, especially within heterogeneous GPU clusters commonly found in organizations and on-premise datacenters as GPU architecture rapidly evolves. Current disaggregated prefill strategies, which separa...

- **[ShadowServe: Interference-Free KV Cache Fetching for Distributed Prefix Caching](https://arxiv.org/abs/2509.16857)**  
  Xingyu Xiang, Raj Joshi, Yuhan Liu et al. · arXiv:2509.16857 · 2025-09-21
  > Distributed prefix caching accelerates long-context LLM serving by reusing KV cache entries for common context prefixes. However, KV cache fetches can become a bottleneck when network bandwidth is limited. Compression mitigates the bandwidth issue, but can deg...

- **[An RDMA-First Object Storage System with SmartNIC Offload](https://arxiv.org/abs/2509.13997)**  
  Yu Zhu, Aditya Dhakal, Pedro Bruel et al. · arXiv:2509.13997 · 2025-09-17
  > AI training and inference impose sustained, fine-grain I/O that stresses host-mediated, TCP-based storage paths. Motivated by kernel-bypass networking and user-space storage stacks, we revisit POSIX-compatible object storage for GPU-centric pipelines. We prese...

- **[Judge Q: Trainable Queries for Optimized Information Retention in KV Cache Eviction](https://arxiv.org/abs/2509.10798)**  
  Yijun Liu, Yixuan Wang, Yuzhuang Xu et al. · arXiv:2509.10798 · 2025-09-13
  > Large language models (LLMs) utilize key-value (KV) cache to store historical information during sequence processing. The size of KV cache grows linearly as the length of the sequence extends, which seriously affects memory usage and decoding efficiency. Curre...

- **[EvolKV: Evolutionary KV Cache Compression for LLM Inference](https://arxiv.org/abs/2509.08315)**  
  Bohan Yu, Yekun Chai · arXiv:2509.08315 · 2025-09-10
  > Existing key-value (KV) cache compression methods typically rely on heuristics, such as uniform cache allocation across layers or static eviction policies, however, they ignore the critical interplays among layer-specific feature patterns and task performance,...

- **[VoltanaLLM: Energy-Efficient and SLO-Aware Disaggregated LLM Serving via Adaptive Frequency Control and State-Space Routing](https://arxiv.org/abs/2509.04827)**  
  Jiahuan Yu, Aryan Taneja, Junfeng Lin et al. · arXiv:2509.04827 · 2025-09-05
  > The energy cost of Large Language Model (LLM) inference is rapidly becoming a barrier to sustainable and scalable deployment. Although modern serving architectures expose distinct prefill and decode behaviors, existing systems fail to exploit these phase diffe...

- **[Optimizing Frequent Checkpointing via Low-Cost Differential for Distributed Training Systems](https://arxiv.org/abs/2509.04084)**  
  Chenxuan Yao, Yuchong Hu, Feifan Liu et al. · arXiv:2509.04084 · 2025-09-04
  > Distributed training of large deep-learning models often leads to failures, so checkpointing is commonly employed for recovery. State-of-the-art studies focus on frequent checkpointing for fast recovery from failures. However, frequent checkpointing generates ...

- **[TRACE: Unlocking Effective CXL Bandwidth via Lossless Compression and Precision Scaling](https://arxiv.org/abs/2509.03377)**  
  Rui Xie, Asad Ul Haq, Yunhua Fang et al. · arXiv:2509.03377 · 2025-09-03
  > LLM inference is increasingly limited by memory bandwidth, and the bottleneck worsens at long context as the KV cache grows. CXL memory adds capacity to offload weights and KV, but its link and device-side DDR bandwidth are far below HBM, so decoding stalls on...

- **[BAMG: A Block-Aware Monotonic Graph Index for Disk-Based Approximate Nearest Neighbor Search](https://arxiv.org/abs/2509.03226)**  
  Huiling Li, Xin Huang, Byron Choi et al. · arXiv:2509.03226 · 2025-09-03
  > Approximate Nearest Neighbor Search (ANNS) over high-dimensional vectors is a foundational problem in databases, where disk I/O often emerges as the dominant performance bottleneck at scale. To accelerate search, graph-based indexes rely on proximity graph, wh...

- **[GraphKV: Breaking the Static Selection Paradigm with Graph-Based KV Cache Eviction](https://arxiv.org/abs/2509.00388)**  
  Xuelin Li, Xiangqi Jin, Linfeng Zhang · arXiv:2509.00388 · 2025-08-30
  > Efficient Key-Value (KV) cache management is essential for processing long text sequences in large language models (LLMs), where memory constraints often limit performance. Conventional KV eviction strategies, such as top-k selection based on attention scores,...

- **[FlexLink: Boosting your NVLink Bandwidth by 27% without accuracy concern](https://arxiv.org/abs/2510.15882)**  
  Ao Shen, Rui Zhang, Junping Zhao · arXiv:2510.15882 · 2025-08-30
  > As large language models (LLMs) continue to scale, multi-node deployment has become a necessity. Consequently, communication has become a critical performance bottleneck. Current intra-node communication libraries, like NCCL, typically make use of a single int...

- **[AdaptCache: KV Cache Native Storage Hierarchy for Low-Delay and High-Quality Language Model Serving](https://arxiv.org/abs/2509.00105)**  
  Shaoting Feng, Hanchen Li, Kuntai Du et al. · arXiv:2509.00105 · 2025-08-28
  > Large language model (LLM) applications often reuse previously processed context, such as chat history and documents, which introduces significant redundant computation. Existing LLM serving systems address such redundant computation by storing the KV caches o...

- **[TokenLake: A Unified Segment-level Prefix Cache Pool for Fine-grained Elastic Long-Context LLM Serving](https://arxiv.org/abs/2508.17219)**  
  Bingyang Wu, Zili Zhang, Yinmin Zhong et al. · arXiv:2508.17219 · 2025-08-24
  > Prefix caching is crucial to accelerate multi-turn interactions and requests with shared prefixes. At the cluster level, existing prefix caching systems are tightly coupled with request scheduling to optimize cache efficiency and computation performance togeth...

- **[Learned Structure in Cartridges: Keys as Shareable Routers in Self-Studied Representations](https://arxiv.org/abs/2508.17032)**  
  Maurizio Diaz · arXiv:2508.17032 · 2025-08-23
  > A bottleneck for long-context LLM inference is the linearly growing KV cache. Recent work has proposed Cartridges, an approach which leverages offline compute to train a much smaller KV cache than is typically required for a full document (up to 40x less memor...

- **[GoVector: An I/O-Efficient Caching Strategy for High-Dimensional Vector Nearest Neighbor Search](https://arxiv.org/abs/2508.15694)**  
  Yijie Zhou, Shengyuan Lin, Shufeng Gong et al. · arXiv:2508.15694 · 2025-08-21
  > Graph-based high-dimensional vector indices have become a mainstream solution for large-scale approximate nearest neighbor search (ANNS). However, their substantial memory footprint often requires storage on secondary devices, where frequent on-demand loading ...

- **[TPLA: Tensor Parallel Latent Attention for Efficient Disaggregated Prefill and Decode Inference](https://arxiv.org/abs/2508.15881)**  
  Xiaojuan Tang, Fanxu Meng, Pingzhi Tang et al. · arXiv:2508.15881 · 2025-08-21
  > Multi-Head Latent Attention (MLA), introduced in DeepSeek-V2, compresses key-value states into a low-rank latent vector, caching only this vector to reduce memory. In tensor parallelism (TP), however, attention heads are computed across multiple devices, and e...

- **[Gorgeous: Revisiting the Data Layout for Disk-Resident High-Dimensional Vector Search](https://arxiv.org/abs/2508.15290)**  
  Peiqi Yin, Xiao Yan, Qihui Zhou et al. · arXiv:2508.15290 · 2025-08-21
  > Similarity-based vector search underpins many important applications, but a key challenge is processing massive vector datasets (e.g., in TBs). To reduce costs, some systems utilize SSDs as the primary data storage. They employ a proximity graph, which connect...

- **[SparK: Query-Aware Unstructured Sparsity with Recoverable KV Cache Channel Pruning](https://arxiv.org/abs/2508.15212)**  
  Huanxuan Liao, Yixing Xu, Shizhu He et al. · arXiv:2508.15212 · 2025-08-21
  > Long-context inference in large language models (LLMs) is increasingly constrained by the KV cache bottleneck: memory usage grows linearly with sequence length, while attention computation scales quadratically. Existing approaches address this issue by compres...

- **[EMLIO: Minimizing I/O Latency and Energy Consumption for Large-Scale AI Training](https://arxiv.org/abs/2508.11035)**  
  Hasibul Jamil, MD S Q Zulkar Nine, Tevfik Kosar · arXiv:2508.11035 · 2025-08-14
  > Large-scale deep learning workloads increasingly suffer from I/O bottlenecks as datasets grow beyond local storage capacities and GPU compute outpaces network and disk latencies. While recent systems optimize data-loading time, they overlook the energy cost of...

- **[SSD Offloading for LLM Mixture-of-Experts Weights Considered Harmful in Energy Efficiency](https://arxiv.org/abs/2508.06978)**  
  Kwanhee Kyung, Sungmin Yun, Jung Ho Ahn · arXiv:2508.06978 · 2025-08-09
  > Large Language Models (LLMs) applying Mixture-of-Experts (MoE) scale to trillions of parameters but require vast memory, motivating a line of research to offload expert weights from fast-but-small DRAM (HBM) to denser Flash SSDs. While SSDs provide cost-effect...

- **[LLM Serving Optimization with Variable Prefill and Decode Lengths](https://arxiv.org/abs/2508.06133)**  
  Meixuan Wang, Yinyu Ye, Zijie Zhou · arXiv:2508.06133 · 2025-08-08
  > We study offline scheduling for large language model (LLM) serving under a fixed KV-cache memory budget, where requests have heterogeneous prompt (prefill) and response (decode) lengths. Given a backlog of requests available at time zero, the scheduler forms m...

- **[MoBE: Mixture-of-Basis-Experts for Compressing MoE-based LLMs](https://arxiv.org/abs/2508.05257)**  
  Xiaodong Chen, Mingming Ha, Zhenzhong Lan et al. · arXiv:2508.05257 · 2025-08-07
  > The Mixture-of-Experts (MoE) architecture has become a predominant paradigm for scaling large language models (LLMs). Despite offering strong performance and computational efficiency, large MoE-based LLMs like DeepSeek-V3-0324 and Kimi-K2-Instruct present seri...

- **[Bidding-Aware Retrieval for Multi-Stage Consistency in Online Advertising](https://arxiv.org/abs/2508.05206)**  
  Bin Liu, Yunfei Liu, Ziru Xu et al. · arXiv:2508.05206 · 2025-08-07
  > Online advertising systems typically use a cascaded architecture to manage massive requests and candidate volumes, where the ranking stages allocate traffic based on eCPM (predicted CTR $\times$ Bid). With the increasing popularity of auto-bidding strategies, ...

- **[Prefill-Decode Aggregation or Disaggregation? Unifying Both for Goodput-Optimized LLM Serving](https://arxiv.org/abs/2508.01989)**  
  Chao Wang, Pengfei Zuo, Zhangyu Chen et al. · arXiv:2508.01989 · 2025-08-04
  > An ongoing debate considers whether prefill-decode (PD) aggregation or disaggregation is superior for serving large language models (LLMs). This has driven optimizations for both approaches, each showing distinct advantages. This paper compares PD aggregation ...

- **[Forecasting LLM Inference Performance via Hardware-Agnostic Analytical Modeling](https://arxiv.org/abs/2508.00904)**  
  Rajeev Patwari, Ashish Sirasao, Devleena Das · arXiv:2508.00904 · 2025-07-29
  > Large language models (LLMs) have been increasingly deployed as local agents on personal devices with CPUs, NPUs and integrated GPUs. However, forecasting inference performance on devices with such heterogeneity remains challenging due to the dynamic compute a...

- **[FAEDKV: Infinite-Window Fourier Transform for Unbiased KV Cache Compression](https://arxiv.org/abs/2507.20030)**  
  Runchao Li, Yao Fu, Mu Sheng et al. · arXiv:2507.20030 · 2025-07-26
  > The efficacy of Large Language Models (LLMs) in long-context tasks is often hampered by the substantial memory footprint and computational demands of the Key-Value (KV) cache. Current compression strategies, including token eviction and learned projections, fr...

- **[HCAttention: Extreme KV Cache Compression via Heterogeneous Attention Computing for LLMs](https://arxiv.org/abs/2507.19823)**  
  Dongquan Yang, Yifan Yang, Xiaotian Yu et al. · arXiv:2507.19823 · 2025-07-26
  > Processing long-context inputs with large language models presents a significant challenge due to the enormous memory requirements of the Key-Value (KV) cache during inference. Existing KV cache compression methods exhibit noticeable performance degradation wh...

- **[Oneiros: KV Cache Optimization through Parameter Remapping for Multi-tenant LLM Serving](https://arxiv.org/abs/2507.11507)**  
  Ruihao Li, Shagnik Pal, Vineeth Narayan Pullu et al. · arXiv:2507.11507 · 2025-07-15
  > KV cache accelerates LLM inference by avoiding redundant computation, at the expense of memory. To support larger KV caches, prior work extends GPU memory with CPU memory via CPU-offloading. This involves swapping KV cache between GPU and CPU memory. However, ...

- **[KV-Latent: Dimensional-level KV Cache Reduction with Frequency-aware Rotary Positional Embedding](https://arxiv.org/abs/2507.11273)**  
  Luohe Shi, Zuchao Li, Lefei Zhang et al. · arXiv:2507.11273 · 2025-07-15
  > Large language models (LLMs) based on Transformer Decoders have become the preferred choice for conversational generative AI. Despite the overall superiority of the Decoder architecture, the gradually increasing Key-Value (KV) cache during inference has emerge...

- **[RDMA: Cost Effective Agent-Driven Rare Disease Mining from Electronic Health Records](https://arxiv.org/abs/2507.15867)**  
  John Wu, Adam Cross, Jimeng Sun · arXiv:2507.15867 · 2025-07-14
  > Rare diseases affect 1 in 10 Americans yet remain systematically underdocumented in clinical records. ICD-based systems cannot capture their breadth, over 50\% of Orphanet codes lack a direct ICD mapping and only 2.2\% of HPO codes have matching ICD codes, lea...

- **[FalconFS: Distributed File System for Large-Scale Deep Learning Pipeline](https://arxiv.org/abs/2507.10367)**  
  Jingwei Xu, Junbin Kang, Mingkai Dong et al. · arXiv:2507.10367 · 2025-07-14
  > Client-side metadata caching has long been considered an effective method for accelerating metadata operations in distributed file systems (DFSs). However, we have found that client-side state (e.g., caching) is not only ineffective but also consumes valuable ...

- **[On Evaluating Performance of LLM Inference Serving Systems](https://arxiv.org/abs/2507.09019)**  
  Amey Agrawal, Nitin Kedia, Anmol Agarwal et al. · arXiv:2507.09019 · 2025-07-11
  > The rapid evolution of Large Language Model (LLM) inference systems has yielded significant efficiency improvements. However, our systematic analysis reveals that current evaluation methodologies frequently exhibit fundamental flaws, often manifesting as commo...

- **[Compute Can't Handle the Truth: Why Communication Tax Prioritizes Memory and Interconnects in Modern AI Infrastructure](https://arxiv.org/abs/2507.07223)**  
  Myoungsoo Jung · arXiv:2507.07223 · 2025-07-09
  > Modern AI workloads such as large language models (LLMs) and retrieval-augmented generation (RAG) impose severe demands on memory, communication bandwidth, and resource flexibility. Traditional GPU-centric architectures struggle to scale due to growing inter-G...

- **[Towards Efficient and Scalable Distributed Vector Search with RDMA](https://arxiv.org/abs/2507.06653)**  
  Xiangyu Zhi, Meng Chen, Xiao Yan et al. · arXiv:2507.06653 · 2025-07-09
  > Similarity-based vector search facilitates many important applications such as search and recommendation but is limited by the memory capacity and bandwidth of a single machine due to large datasets and intensive data read. In this paper, we present CoTra, a s...

- **[A Survey of LLM Inference Systems](https://arxiv.org/abs/2506.21901)**  
  James Pan, Guoliang Li · arXiv:2506.21901 · 2025-06-27
  > The past few years has witnessed specialized large language model (LLM) inference systems, such as vLLM, SGLang, Mooncake, and DeepFlow, alongside rapid LLM adoption via services like ChatGPT. Driving these system design efforts is the unique autoregressive na...

- **[Memory Savings at What Cost? A Study of Alternatives to Backpropagation](https://arxiv.org/abs/2506.21833)**  
  Kunjal Panchal, Sunav Choudhary, Yuriy Brun et al. · arXiv:2506.21833 · 2025-06-27
  > Forward-mode automatic differentiation (FmAD) and zero-order (ZO) optimization are increasingly proposed as memory-efficient, backpropagation-free alternatives for large language model (LLM) fine-tuning, yet their benefits are typically evaluated only against ...

- **[CommVQ: Commutative Vector Quantization for KV Cache Compression](https://arxiv.org/abs/2506.18879)**  
  Junyan Li, Yang Zhang, Muhammad Yusuf Hassan et al. · arXiv:2506.18879 · 2025-06-23
  > Large Language Models (LLMs) are increasingly used in applications requiring long context lengths, but the key-value (KV) cache often becomes a memory bottleneck on GPUs as context grows. To address this, we propose Commutative Vector Quantization (CommVQ) to ...

- **[REIS: A High-Performance and Energy-Efficient Retrieval System with In-Storage Processing](https://arxiv.org/abs/2506.16444)**  
  Kangqi Chen, Andreas Kosmas Kakolyris, Rakesh Nadig et al. · arXiv:2506.16444 · 2025-06-19
  > Large Language Models (LLMs) face an inherent challenge: their knowledge is confined to the data that they have been trained on. To overcome this issue, Retrieval-Augmented Generation (RAG) complements the static training-derived knowledge of LLMs with an exte...

- **[HARMONY: A Scalable Distributed Vector Database for High-Throughput Approximate Nearest Neighbor Search](https://arxiv.org/abs/2506.14707)**  
  Qian Xu, Feng Zhang, Chengxi Li et al. · arXiv:2506.14707 · 2025-06-17
  > Approximate Nearest Neighbor Search (ANNS) is essential for various data-intensive applications, including recommendation systems, image retrieval, and machine learning. Scaling ANNS to handle billions of high-dimensional vectors on a single machine presents s...

- **[LEANN: A Low-Storage Vector Index](https://arxiv.org/abs/2506.08276)**  
  Yichuan Wang, Zhifei Li, Shu Liu et al. · arXiv:2506.08276 · 2025-06-09
  > Embedding-based vector search underpins many important applications, such as recommendation and retrieval-augmented generation (RAG). It relies on vector indices to enable efficient search. However, these indices require storing high-dimensional embeddings and...

- **[Containerized In-Storage Processing and Computing-Enabled SSD Disaggregation](https://arxiv.org/abs/2506.06769)**  
  Miryeong Kwon, Donghyun Gouk, Eunjee Na et al. · arXiv:2506.06769 · 2025-06-07
  > ISP minimizes data transfer for analytics but faces challenges in adaptation and disaggregation. We propose DockerSSD, an ISP model leveraging OS-level virtualization and lightweight firmware to enable containerized data processing directly on SSDs. Key featur...

- **[Optimizing Cloud-to-GPU Throughput for Deep Learning With Earth Observation Data](https://arxiv.org/abs/2506.06235)**  
  Akram Zaytar, Caleb Robinson, Girmaw Abebe Tadesse et al. · arXiv:2506.06235 · 2025-06-06
  > Training deep learning models on petabyte-scale Earth observation (EO) data requires separating compute resources from data storage. However, standard PyTorch data loaders cannot keep modern GPUs utilized when streaming GeoTIFF files directly from cloud storag...

- **[MadaKV: Adaptive Modality-Perception KV Cache Eviction for Efficient Multimodal Long-Context Inference](https://arxiv.org/abs/2506.15724)**  
  Kunxi Li, Zhonghua Jiang, Zhouzhou Shen et al. · arXiv:2506.15724 · 2025-06-06
  > This paper introduces MadaKV, a modality-adaptive key-value (KV) cache eviction strategy designed to enhance the efficiency of multimodal large language models (MLLMs) in long-context inference. In multimodal scenarios, attention heads exhibit varying preferen...

- **[Beyond the Buzz: A Pragmatic Take on Inference Disaggregation](https://arxiv.org/abs/2506.05508)**  
  Tiyasa Mitra, Ritika Borkar, Nidhi Bhatia et al. · arXiv:2506.05508 · 2025-06-05
  > As inference scales to multi-node deployments, disaggregation - splitting inference into distinct phases - offers a promising path to improving the throughput-interactivity Pareto frontier. Despite growing enthusiasm and a surge of open-source efforts, practic...

- **[BVLSM: Write-Efficient LSM-Tree Storage via WAL-Time Key-Value Separation](https://arxiv.org/abs/2506.04678)**  
  Ming Li, Wendi Cheng, Jiahe Wei et al. · arXiv:2506.04678 · 2025-06-05
  > Modern data-intensive applications increasingly store and process big-value items, such as multimedia objects and machine learning embeddings, which exacerbate storage inefficiencies in Log-Structured Merge-Tree (LSM)-based key-value stores. This paper present...

- **[Memory OS of AI Agent](https://arxiv.org/abs/2506.06326)**  
  Jiazheng Kang, Mingming Ji, Zhe Zhao et al. · arXiv:2506.06326 · 2025-05-30
  > Large Language Models (LLMs) face a crucial challenge from fixed context windows and inadequate memory management, leading to a severe shortage of long-term memory capabilities and limited personalization in the interactive experience with AI agents. To overco...

- **[KVzip: Query-Agnostic KV Cache Compression with Context Reconstruction](https://arxiv.org/abs/2505.23416)**  
  Jang-Hyun Kim, Jinuk Kim, Sangwoo Kwon et al. · arXiv:2505.23416 · 2025-05-29
  > Transformer-based large language models (LLMs) cache context as key-value (KV) pairs during inference. As context length grows, KV cache sizes expand, leading to substantial memory overhead and increased attention latency. This paper introduces KVzip, a query-...

- **[Lookahead Q-Cache: Achieving More Consistent KV Cache Eviction via Pseudo Query](https://arxiv.org/abs/2505.20334)**  
  Yixuan Wang, Shiyu Ji, Yijun Liu et al. · arXiv:2505.20334 · 2025-05-24
  > Large language models (LLMs) rely on key-value cache (KV cache) to accelerate decoding by reducing redundant computations. However, the KV cache memory usage grows substantially with longer text sequences, posing challenges for efficient deployment. Existing K...

- **[Bottlenecked Transformers: Periodic KV Cache Consolidation for Generalised Reasoning](https://arxiv.org/abs/2505.16950)**  
  Adnan Oomerjee, Zafeirios Fountas, Haitham Bou-Ammar et al. · arXiv:2505.16950 · 2025-05-22
  > Transformer LLMs have been shown to exhibit strong reasoning ability that scales with inference-time compute, most prominently through token-space "thinking" chains of thought. A growing line of work pushes extra computation into the model's latent space, whic...

- **[LSM-Vec: A Memory-Efficient Disk-Based System for Large-Scale Dynamic Vector Search](https://arxiv.org/abs/2505.17152)**  
  Dingheng Mo, Shurui Zhong, Yingzhuo Qian et al. · arXiv:2505.17152 · 2025-05-22
  > RAG and AI retrieval have made vector approximate nearest-neighbor (ANN) search a key retrieval operation in modern data systems. These workloads are both large and dynamic. Vector collections grow until index state no longer fits in DRAM and must reside on di...

- **[Cosmos: A CXL-Based Full In-Memory System for Approximate Nearest Neighbor Search](https://arxiv.org/abs/2505.16096)**  
  Seoyoung Ko, Hyunjeong Shim, Wanju Doh et al. · arXiv:2505.16096 · 2025-05-22
  > Retrieval-Augmented Generation (RAG) is crucial for improving the quality of large language models by injecting proper contexts extracted from external sources. RAG requires high-throughput, low-latency Approximate Nearest Neighbor Search (ANNS) over billion-s...

- **[FlowKV: Enhancing Multi-Turn Conversational Coherence in LLMs via Isolated Key-Value Cache Management](https://arxiv.org/abs/2505.15347)**  
  Xiang Liu, Hong Chen, Xuming Hu et al. · arXiv:2505.15347 · 2025-05-21
  > Large Language Models (LLMs) are increasingly deployed in multi-turn conversational applications, where the management of the Key-Value (KV) Cache presents a significant bottleneck. The linear growth of the KV Cache with dialogue history imposes substantial co...

- **[ServerlessLoRA: Enabling Low-Latency Serverless Multi-LoRA Serving](https://arxiv.org/abs/2505.14468)**  
  Yifan Sui, Hao Wang, Hanfei Yu et al. · arXiv:2505.14468 · 2025-05-20
  > Multi-LoRA (Low-Rank Adaptation) serving allows many specialized LLM variants to share the same base model by attaching lightweight adapters. This makes it attractive for serving large catalogs of domain-, tenant-, and task-specific models. However, existing d...

- **[Prime Collective Communications Library -- Technical Report](https://arxiv.org/abs/2505.14065)**  
  Michael Keiblinger, Mario Sieg, Jack Min Ong et al. · arXiv:2505.14065 · 2025-05-20
  > This report presents the Prime Collective Communications Library (PCCL), a novel fault-tolerant collective communication library designed for distributed ML workloads over the public internet. PCCL introduces a new programming model that enables dynamic peer j...

- **[FreeKV: Boosting KV Cache Retrieval for Efficient LLM Inference](https://arxiv.org/abs/2505.13109)**  
  Guangda Liu, Chengwei Li, Zhenyu Ning et al. · arXiv:2505.13109 · 2025-05-19
  > Large language models (LLMs) are widely deployed with rapidly expanding context windows to support increasingly demanding applications. However, long contexts pose significant deployment challenges, primarily due to the KV cache whose size grows proportionally...

- **[Learning In Chaos: Efficient Autoscaling and Self-Healing for Multi-Party Distributed Training](https://arxiv.org/abs/2505.12815)**  
  Wenjiao Feng, Rongxing Xiao, Zonghang Li et al. · arXiv:2505.12815 · 2025-05-19
  > Node and link churn in multi-party, cross-region clusters over wide-area networks (WANs) often disrupts distributed training. However, checkpoint-based recovery and cloud-centric autoscaling react slowly and assume centralized control, which is misaligned with...

- **[Arrow: Adaptive Scheduling Mechanisms for Disaggregated LLM Inference Architecture](https://arxiv.org/abs/2505.11916)**  
  Yu Wu, Tongxuan Liu, Yuting Zeng et al. · arXiv:2505.11916 · 2025-05-17
  > Existing large language model (LLM) serving systems typically employ Prefill-Decode disaggregated architecture to prevent computational interference between the prefill and decode phases. However, in real-world LLM serving scenarios, significant fluctuations i...

- **[SubGCache: Accelerating Graph-based RAG with Subgraph-level KV Cache](https://arxiv.org/abs/2505.10951)**  
  Qiuyu Zhu, Liang Zhang, Qianxiong Xu et al. · arXiv:2505.10951 · 2025-05-16
  > Graph-based retrieval-augmented generation (RAG) enables large language models (LLMs) to incorporate structured knowledge via graph retrieval as contextual input, enhancing more accurate and context-aware reasoning. We observe that for different queries, it co...

- **[ServeGen: Workload Characterization and Generation of Large Language Model Serving in Production](https://arxiv.org/abs/2505.09999)**  
  Yuxing Xiang, Xue Li, Kun Qian et al. · arXiv:2505.09999 · 2025-05-15
  > With the widespread adoption of Large Language Models (LLMs), serving LLM inference requests has become an increasingly important task, attracting active research advancements. Practical workloads play an essential role in this process: they are critical for m...

- **[Lossless Compression for LLM Tensor Incremental Snapshots](https://arxiv.org/abs/2505.09810)**  
  Daniel Waddington, Cornel Constantinescu · arXiv:2505.09810 · 2025-05-14
  > During the training of Large Language Models (LLMs), tensor data is periodically "checkpointed" to persistent storage to allow recovery of work done in the event of failure. The volume of data that must be copied during each checkpoint, even when using reduced...

- **[RetroInfer: A Vector Storage Engine for Scalable Long-Context LLM Inference](https://arxiv.org/abs/2505.02922)**  
  Yaoqi Chen, Jinkai Zhang, Baotong Lu et al. · arXiv:2505.02922 · 2025-05-05
  > Recent large language models (LLMs) are rapidly extending their context windows, yet inference throughput lags due to increasing GPU memory and bandwidth demands. This is because the key-value (KV) cache, an intermediate structure storing token representations...

- **[CaGR-RAG: Context-aware Query Grouping for Disk-based Vector Search in RAG Systems](https://arxiv.org/abs/2505.01164)**  
  Yeonwoo Jeong, Kyuli Park, Hyunji Cho et al. · arXiv:2505.01164 · 2025-05-02
  > Modern embedding models capture both semantic and syntactic structures of queries, often mapping different queries to similar regions in vector space. This results in non-uniform cluster access patterns in disk-based vector search systems, particularly in Retr...

- **[TurboQuant: Online Vector Quantization with Near-optimal Distortion Rate](https://arxiv.org/abs/2504.19874)**  
  Amir Zandieh, Majid Daliri, Majid Hadian et al. · arXiv:2504.19874 · 2025-04-28
  > Vector quantization, a problem rooted in Shannon's source coding theory, aims to quantize high-dimensional Euclidean vectors while minimizing distortion in their geometric structure. We propose TurboQuant to address both mean-squared error (MSE) and inner prod...

- **[semi-PD: Towards Efficient LLM Serving via Phase-Wise Disaggregated Computation and Unified Storage](https://arxiv.org/abs/2504.19867)**  
  Ke Hong, Lufang Chen, Zhong Wang et al. · arXiv:2504.19867 · 2025-04-28
  > Existing large language model (LLM) serving systems fall into two categories: 1) a unified system where prefill phase and decode phase are co-located on the same GPU, sharing the unified computational resource and storage, and 2) a disaggregated system where t...

- **[Parameter-Efficient Checkpoint Merging via Metrics-Weighted Averaging](https://arxiv.org/abs/2504.18580)**  
  Shi Jie Yu, Sehyun Choi · arXiv:2504.18580 · 2025-04-23
  > Checkpoint merging is a technique for combining multiple model snapshots into a single superior model, potentially reducing training time for large language models. This paper explores checkpoint merging in the context of parameter-efficient fine-tuning (PEFT)...

- **[Towards High-Goodput LLM Serving with Prefill-decode Multiplexing](https://arxiv.org/abs/2504.14489)**  
  Yukang Chen, Weihao Cui, Han Zhao et al. · arXiv:2504.14489 · 2025-04-20
  > Large Language Model (LLM) serving must meet stringent Service Level Objectives (SLOs) for both the prefill and decode phases. Some existing solutions disaggregate the two phases, causing potential resource idleness or compute redundancy. Others split the pref...

- **[Cost-Efficient LLM Serving in the Cloud: VM Selection with KV Cache Offloading](https://arxiv.org/abs/2504.11816)**  
  Kihyun Kim, Jinwoo Kim, Hyunsun Chung et al. · arXiv:2504.11816 · 2025-04-16
  > LLM inference is essential for applications like text summarization, translation, and data analysis, but the high cost of GPU instances from Cloud Service Providers (CSPs) like AWS is a major burden. This paper proposes InferSave, a cost-efficient VM selection...

- **[KeepKV: Achieving Periodic Lossless KV Cache Compression for Efficient LLM Inference](https://arxiv.org/abs/2504.09936)**  
  Yuxuan Tian, Zihan Wang, Yebo Peng et al. · arXiv:2504.09936 · 2025-04-14
  > Efficient inference of large language models (LLMs) is hindered by an ever-growing key-value (KV) cache, making KV cache compression a critical research direction. Traditional methods selectively evict less important KV cache entries, which leads to informatio...

- **[MIST: A Co-Design Framework for Heterogeneous, Multi-Stage LLM Inference](https://arxiv.org/abs/2504.09775)**  
  Abhimanyu Rajeshkumar Bambhaniya, Hanjiang Wu, Suvinay Subramanian et al. · arXiv:2504.09775 · 2025-04-14
  > Modern LLM serving now spans multi-stage pipelines including RAG retrieval and KV cache reuse, each with distinct compute, memory, and latency demands. Inference engines expose a large configuration space with no systematic navigation methodology, and exhausti...

- **[DynaServe: Unified and Elastic Execution for Dynamic Disaggregated LLM Serving](https://arxiv.org/abs/2504.09285)**  
  Chaoyi Ruan, Yinhe Chen, Dongqi Tian et al. · arXiv:2504.09285 · 2025-04-12
  > LLM inference must meet strict latency SLOs (e.g., 100 ms P99 time-between-tokens) while maximizing goodput. Yet, real-world variability in prompt and response lengths skews compute-intensive prefill and memory-bound decode phases, making both colocated (even ...

- **[DRIP: DRop unImportant data Points -- Enhancing Machine Learning Efficiency with Grad-CAM-Based Real-Time Data Prioritization for On-Device Training](https://arxiv.org/abs/2504.08364)**  
  Marcus Rüb, Daniel Konegen, Patrick Selle et al. · arXiv:2504.08364 · 2025-04-11
  > Selecting data points for model training is critical in machine learning. Effective selection methods can reduce the labeling effort, optimize on-device training for embedded systems with limited data storage, and enhance the model performance. This paper intr...

- **[MicroNN: An On-device Disk-resident Updatable Vector Database](https://arxiv.org/abs/2504.05573)**  
  Jeffrey Pound, Floris Chabert, Arjun Bhushan et al. · arXiv:2504.05573 · 2025-04-08
  > Nearest neighbour search over dense vector collections has important applications in information retrieval, retrieval augmented generation (RAG), and content ranking. Performing efficient search over large vector collections is a well studied problem with many...

- **[Saliency-driven Dynamic Token Pruning for Large Language Models](https://arxiv.org/abs/2504.04514)**  
  Yao Tao, Yehui Tang, Yun Wang et al. · arXiv:2504.04514 · 2025-04-06
  > Despite the recent success of large language models (LLMs), LLMs are particularly challenging in long-sequence inference scenarios due to the quadratic computational complexity of the attention mechanism. Inspired by the interpretability theory of feature attr...

- **[HyperRAG: Enhancing Quality-Efficiency Tradeoffs in Retrieval-Augmented Generation with Reranker KV-Cache Reuse](https://arxiv.org/abs/2504.02921)**  
  Yuwei An, Yihua Cheng, Seo Jin Park et al. · arXiv:2504.02921 · 2025-04-03
  > Retrieval-Augmented Generation (RAG) has emerged as a powerful paradigm for enhancing the performance of large language models (LLMs) by integrating external knowledge into the generation process. A key component of RAG pipelines is the reranker, which selects...

- **[PartialLoading: User Scheduling and Bandwidth Allocation for Parameter-sharing Edge Inference](https://arxiv.org/abs/2503.22982)**  
  Guanqiao Qu, Qian Chen, Xianhao Chen et al. · arXiv:2503.22982 · 2025-03-29
  > By provisioning inference offloading services, edge inference drives the rapid growth of AI applications at network edge. However, how to reduce the inference latency remains a significant challenge. To address this issue, we develop a parameter-sharing AI mod...

- **[Hiding Latencies in Network-Based Image Loading for Deep Learning](https://arxiv.org/abs/2503.22643)**  
  Francesco Versaci, Giovanni Busonera · arXiv:2503.22643 · 2025-03-28
  > In the last decades, the computational power of GPUs has grown exponentially, allowing current deep learning (DL) applications to handle increasingly large amounts of data at a progressively higher throughput. However, network and storage latencies cannot decr...

- **[Injecting Adrenaline into LLM Serving: Boosting Resource Utilization and Throughput via Attention Disaggregation](https://arxiv.org/abs/2503.20552)**  
  Yunkai Liang, Zhangyu Chen, Pengfei Zuo et al. · arXiv:2503.20552 · 2025-03-26
  > In large language model (LLM) serving systems, executing each request consists of two phases: the compute-intensive prefill phase and the memory-intensive decoding phase. To prevent performance interference between the two phases, current LLM serving systems t...

- **[Mist: Efficient Distributed Training of Large Language Models via Memory-Parallelism Co-Optimization](https://arxiv.org/abs/2503.19050)**  
  Zhanda Zhu, Christina Giannoula, Muralidhar Andoorveedu et al. · arXiv:2503.19050 · 2025-03-24
  > Various parallelism, such as data, tensor, and pipeline parallelism, along with memory optimizations like activation checkpointing, redundancy elimination, and offloading, have been proposed to accelerate distributed training for Large Language Models. To find...

- **[xKV: Cross-Layer KV-Cache Compression via Aligned Singular Vector Extraction](https://arxiv.org/abs/2503.18893)**  
  Chi-Chih Chang, Wei-Cheng Lin, Chien-Yu Lin et al. · arXiv:2503.18893 · 2025-03-24
  > Long-context Large Language Models (LLMs) enable powerful applications but incur high memory costs due to the key-value states (KV-Cache). Recent studies attempt to share KV-Cache across layers, but these approaches either require expensive pretraining or rely...

- **[Reimagining Memory Access for LLM Inference: Compression-Aware Memory Controller Design](https://arxiv.org/abs/2503.18869)**  
  Rui Xie, Asad Ul Haq, Linsen Ma et al. · arXiv:2503.18869 · 2025-03-24
  > The efficiency of Large Language Model~(LLM) inference is often constrained by substantial memory bandwidth and capacity demands. Existing techniques, such as pruning, quantization, and mixture of experts/depth, reduce memory capacity and/or bandwidth consumpt...

- **[PipeBoost: Resilient Pipelined Architecture for Fast Serverless LLM Scaling](https://arxiv.org/abs/2503.17707)**  
  Chongpeng Liu, Xiaojian Liao, Hancheng Liu et al. · arXiv:2503.17707 · 2025-03-22
  > This paper presents PipeBoost, a low-latency LLM serving system for multi-GPU (serverless) clusters, which can rapidly launch inference services in response to bursty requests without preemptively over-provisioning GPUs. Many LLM inference tasks rely on the sa...

- **[LLMs Know What to Drop: Self-Attention Guided KV Cache Eviction for Efficient Long-Context Inference](https://arxiv.org/abs/2503.08879)**  
  Guangtao Wang, Shubhangi Upasani, Chen Wu et al. · arXiv:2503.08879 · 2025-03-11
  > Efficient long-context inference is critical as large language models (LLMs) adopt context windows of ranging from 128K to 1M tokens. However, the growing key-value (KV) cache and the high computational complexity of attention create significant bottlenecks in...

- **[Cicada: A Pipeline-Efficient Approach to Serverless Inference with Decoupled Management](https://arxiv.org/abs/2502.20959)**  
  Z. Wu, Y. Deng, J. Hu et al. · arXiv:2502.20959 · 2025-02-28
  > Serverless computing has emerged as a pivotal paradigm for deploying Deep Learning (DL) models, offering automatic scaling and cost efficiency. However, the inherent cold start problem in serverless ML inference systems, particularly the time-consuming model l...

- **[KVLink: Accelerating Large Language Models via Efficient KV Cache Reuse](https://arxiv.org/abs/2502.16002)**  
  Jingbo Yang, Bairu Hou, Wei Wei et al. · arXiv:2502.16002 · 2025-02-21
  > We describe KVLink, an approach for efficient key-value (KV) cache reuse in large language models (LLMs). In many LLM applications, different inputs can share overlapping context, such as the same retrieved document appearing in multiple queries. However, the ...

- **[HydraServe: Minimizing Cold Start Latency for Serverless LLM Serving in Public Clouds](https://arxiv.org/abs/2502.15524)**  
  Chiheng Lou, Sheng Qi, Chao Jin et al. · arXiv:2502.15524 · 2025-02-21
  > With the proliferation of large language model (LLM) variants, developers are turning to serverless computing for cost-efficient LLM deployment. However, public cloud providers often struggle to provide performance guarantees for serverless LLM serving due to ...

- **[A$^2$ATS: Retrieval-Based KV Cache Reduction via Windowed Rotary Position Embedding and Query-Aware Vector Quantization](https://arxiv.org/abs/2502.12665)**  
  Junhui He, Junna Xing, Nan Wang et al. · arXiv:2502.12665 · 2025-02-18
  > Long context large language models (LLMs) pose significant challenges for efficient serving due to the large memory footprint and high access overhead of KV cache. Retrieval-based KV cache reduction methods can mitigate these challenges, typically by offloadin...

- **[HeadInfer: Memory-Efficient LLM Inference by Head-wise Offloading](https://arxiv.org/abs/2502.12574)**  
  Cheng Luo, Zefan Cai, Hanshi Sun et al. · arXiv:2502.12574 · 2025-02-18
  > Transformer-based large language models (LLMs) demonstrate impressive performance in long context generation. Extending the context length has disproportionately shifted the memory footprint of LLMs during inference to the key-value cache (KV cache). In this p...

- **[BaKlaVa -- Budgeted Allocation of KV cache for Long-context Inference](https://arxiv.org/abs/2502.13176)**  
  Ahmed Burak Gulhan, Krishna Teja Chitty-Venkata, Murali Emani et al. · arXiv:2502.13176 · 2025-02-18
  > In Large Language Model (LLM) inference, Key-Value (KV) caches (KV-caches) are essential for reducing time complexity. However, they result in a linear increase in GPU memory as the context length grows. While recent work explores KV-cache eviction and compres...

- **[λScale: Enabling Fast Scaling for Serverless Large Language Model Inference](https://arxiv.org/abs/2502.09922)**  
  Minchen Yu, Rui Yang, Chaobo Jia et al. · arXiv:2502.09922 · 2025-02-14
  > Serverless computing has emerged as a compelling solution for cloud-based model inference. However, as modern large language models (LLMs) continue to grow in size, existing serverless platforms often face substantial model startup overhead. This poses a signi...

- **[A Cost-Effective Near-Storage Processing Solution for Offline Inference of Long-Context LLMs](https://arxiv.org/abs/2502.09921)**  
  Hongsun Jang, Jaeyong Song, Changmin Shin et al. · arXiv:2502.09921 · 2025-02-14
  > The computational and memory demands of large language models for generative inference present significant challenges for practical deployment. One promising solution targeting offline inference is offloading-based batched inference, which extends the GPU's me...

- **[HexGen-2: Disaggregated Generative Inference of LLMs in Heterogeneous Environment](https://arxiv.org/abs/2502.07903)**  
  Youhe Jiang, Ran Yan, Binhang Yuan · arXiv:2502.07903 · 2025-02-11
  > Disaggregating the prefill and decoding phases represents an effective new paradigm for generative inference of large language models (LLM), which eliminates prefill-decoding interference and optimizes resource allocation. However, it is still an open problem ...

- **[Auditing Prompt Caching in Language Model APIs](https://arxiv.org/abs/2502.07776)**  
  Chenchen Gu, Xiang Lisa Li, Rohith Kuditipudi et al. · arXiv:2502.07776 · 2025-02-11
  > Prompt caching in large language models (LLMs) results in data-dependent timing variations: cached prompts are processed faster than non-cached prompts. These timing differences introduce the risk of side-channel timing attacks. For example, if the cache is sh...

- **[PIM Is All You Need: A CXL-Enabled GPU-Free System for Large Language Model Inference](https://arxiv.org/abs/2502.07578)**  
  Yufeng Gu, Alireza Khadem, Sumanth Umesh et al. · arXiv:2502.07578 · 2025-02-11
  > Large Language Model (LLM) inference uses an autoregressive manner to generate one token at a time, which exhibits notably lower operational intensity compared to earlier Machine Learning (ML) models such as encoder-only transformers and Convolutional Neural N...

- **[vCache: Verified Semantic Prompt Caching](https://arxiv.org/abs/2502.03771)**  
  Luis Gaspar Schroeder, Aditya Desai, Alejandro Cuadron et al. · arXiv:2502.03771 · 2025-02-06
  > Semantic caches return cached responses for semantically similar prompts to reduce LLM inference latency and cost. They embed cached prompts and store them alongside their response in a vector database. Embedding similarity metrics assign a numerical score to ...

- **[HACK: Homomorphic Acceleration via Compression of the Key-Value Cache for Disaggregated LLM Inference](https://arxiv.org/abs/2502.03589)**  
  Zeyu Zhang, Haiying Shen, Shay Vargaftik et al. · arXiv:2502.03589 · 2025-02-05
  > Disaggregated Large Language Model (LLM) inference has gained popularity as it separates the computation-intensive prefill stage from the memory-intensive decode stage, avoiding the prefill-decode interference and improving resource utilization. However, trans...

- **[MPIC: Position-Independent Multimodal Context Caching System for Efficient MLLM Serving](https://arxiv.org/abs/2502.01960)**  
  Shiju Zhao, Junhao Hu, Rongxiao Huang et al. · arXiv:2502.01960 · 2025-02-04
  > The context caching technique is employed to accelerate the Multimodal Large Language Model (MLLM) inference by prevailing serving platforms currently. However, this approach merely reuses the Key-Value (KV) cache of the initial sequence of prompt, resulting i...

- **[Glinthawk: A Two-Tiered Architecture for Offline LLM Inference](https://arxiv.org/abs/2501.11779)**  
  Pouya Hamadanian, Sadjad Fouladi · arXiv:2501.11779 · 2025-01-20
  > We introduce Glinthawk, an architecture for offline Large Language Model (LLM) inference. By leveraging a two-tiered structure, Glinthawk optimizes the utilization of the high-end accelerators ("Tier 1") by offloading the attention mechanism to lower-end compu...

- **[Sparse Checkpointing for Fast and Reliable MoE Training](https://arxiv.org/abs/2412.15411)**  
  Swapnil Gandhi, Christos Kozyrakis · arXiv:2412.15411 · 2024-12-19
  > As large language models scale, training them requires thousands of GPUs over extended durations--making frequent failures an inevitable reality. While checkpointing remains the primary fault-tolerance mechanism, existing methods fall short when applied to Mix...

- **[TrainMover: An Interruption-Resilient Runtime for ML Training](https://arxiv.org/abs/2412.12636)**  
  ChonLam Lao, Jiaqi Gao, Jiamin Cao et al. · arXiv:2412.12636 · 2024-12-17
  > Large-scale ML training jobs are frequently interrupted by hardware and software anomalies, failures, and management events. Existing solutions like checkpoint-restart or runtime reconfiguration suffer from long downtimes and degraded performance. We present T...

- **[Accelerating Retrieval-Augmented Generation](https://arxiv.org/abs/2412.15246)**  
  Derrick Quinn, Mohammad Nouri, Neel Patel et al. · arXiv:2412.15246 · 2024-12-14
  > An evolving solution to address hallucination and enhance accuracy in large language models (LLMs) is Retrieval-Augmented Generation (RAG), which involves augmenting LLMs with information retrieved from an external knowledge source, such as the web. This paper...

- **[KVDirect: Distributed Disaggregated LLM Inference](https://arxiv.org/abs/2501.14743)**  
  Shiyang Chen, Rain Jiang, Dezhi Yu et al. · arXiv:2501.14743 · 2024-12-13
  > Large Language Models (LLMs) have become the new foundation for many applications, reshaping human society like a storm. Disaggregated inference, which separates prefill and decode stages, is a promising approach to improving hardware utilization and service q...

- **[SCBench: A KV Cache-Centric Analysis of Long-Context Methods](https://arxiv.org/abs/2412.10319)**  
  Yucheng Li, Huiqiang Jiang, Qianhui Wu et al. · arXiv:2412.10319 · 2024-12-13
  > Long-context LLMs have enabled numerous downstream applications but also introduced significant challenges related to computational and memory efficiency. To address these challenges, optimizations for long-context inference have been developed, centered aroun...

- **[Lexico: Extreme KV Cache Compression via Sparse Coding over Universal Dictionaries](https://arxiv.org/abs/2412.08890)**  
  Junhyuck Kim, Jongho Park, Jaewoong Cho et al. · arXiv:2412.08890 · 2024-12-12
  > We introduce Lexico, a novel KV cache compression method that leverages sparse coding with a universal dictionary. Our key finding is that key-value cache in modern LLMs can be accurately approximated using sparse linear combination from a small, input-agnosti...

- **[INTELLECT-1 Technical Report](https://arxiv.org/abs/2412.01152)**  
  Sami Jaghouar, Jack Min Ong, Manveer Basra et al. · arXiv:2412.01152 · 2024-12-02
  > In this report, we introduce INTELLECT-1, the first 10 billion parameter language model collaboratively trained across the globe, demonstrating that large-scale model training is no longer confined to large corporations but can be achieved through a distribute...

- **[Marconi: Prefix Caching for the Era of Hybrid LLMs](https://arxiv.org/abs/2411.19379)**  
  Rui Pan, Zhuang Wang, Zhen Jia et al. · arXiv:2411.19379 · 2024-11-28
  > Hybrid models that combine the language modeling capabilities of Attention layers with the efficiency of Recurrent layers (e.g., State Space Models) have gained traction in practically supporting long contexts in Large Language Model serving. Yet, the unique p...

- **[Enabling Efficient Serverless Inference Serving for LLM (Large Language Model) in the Cloud](https://arxiv.org/abs/2411.15664)**  
  Himel Ghosh · arXiv:2411.15664 · 2024-11-23
  > This review report discusses the cold start latency in serverless inference and existing solutions. It particularly reviews the ServerlessLLM method, a system designed to address the cold start problem in serverless inference for large language models. Traditi...

- **[SlowFast-VGen: Slow-Fast Learning for Action-Driven Long Video Generation](https://arxiv.org/abs/2410.23277)**  
  Yining Hong, Beide Liu, Maxine Wu et al. · arXiv:2410.23277 · 2024-10-30
  > Human beings are endowed with a complementary learning system, which bridges the slow learning of general world dynamics with fast storage of episodic memory from a new experience. Previous video generation models, however, primarily focus on slow learning by ...

- **[Not All Heads Matter: A Head-Level KV Cache Compression Method with Integrated Retrieval and Reasoning](https://arxiv.org/abs/2410.19258)**  
  Yu Fu, Zefan Cai, Abedelkadir Asi et al. · arXiv:2410.19258 · 2024-10-25
  > Key-Value (KV) caching is a common technique to enhance the computational efficiency of Large Language Models (LLMs), but its memory overhead grows rapidly with input length. Prior work has shown that not all tokens are equally important for text generation, p...

- **[Carefully Structured Compression: Efficiently Managing StarCraft II Data](https://arxiv.org/abs/2410.08659)**  
  Bryce Ferenczi, Rhys Newbury, Michael Burke et al. · arXiv:2410.08659 · 2024-10-11
  > Creation and storage of datasets are often overlooked input costs in machine learning, as many datasets are simple image label pairs or plain text. However, datasets with more complex structures, such as those from the real time strategy game StarCraft II, req...

- **[TurboRAG: Accelerating Retrieval-Augmented Generation with Precomputed KV Caches for Chunked Text](https://arxiv.org/abs/2410.07590)**  
  Songshuo Lu, Hua Wang, Yutian Rong et al. · arXiv:2410.07590 · 2024-10-10
  > Current Retrieval-Augmented Generation (RAG) systems concatenate and process numerous retrieved document chunks for prefill which requires a large volume of computation, therefore leading to significant latency in time-to-first-token (TTFT). To reduce the comp...

- **[Compute Or Load KV Cache? Why Not Both?](https://arxiv.org/abs/2410.03065)**  
  Shuowei Jin, Xueshen Liu, Qingzhao Zhang et al. · arXiv:2410.03065 · 2024-10-04
  > Large Language Models (LLMs) are increasingly deployed in large-scale online services, enabling sophisticated applications. However, the computational overhead of generating key-value (KV) caches in the prefill stage presents a major bottleneck, particularly f...

- **[TensorSocket: Shared Data Loading for Deep Learning Training](https://arxiv.org/abs/2409.18749)**  
  Ties Robroek, Neil Kim Nielsen, Pınar Tözün · arXiv:2409.18749 · 2024-09-27
  > Training deep learning models is a repetitive and resource-intensive process. Data scientists often train several models before landing on a set of parameters (e.g., hyper-parameter tuning) and model architecture (e.g., neural architecture search), among other...

- **[DFabric: Scaling Out Data Parallel Applications with CXL-Ethernet Hybrid Interconnects](https://arxiv.org/abs/2409.05404)**  
  Xu Zhang, Ke Liu, Yisong Chang et al. · arXiv:2409.05404 · 2024-09-09
  > Emerging interconnects, such as CXL and NVLink, have been integrated into the intra-host topology to scale more accelerators and facilitate efficient communication between them, such as GPUs. To keep pace with the accelerator's growing computing throughput, th...

- **[InstInfer: In-Storage Attention Offloading for Cost-Effective Long-Context LLM Inference](https://arxiv.org/abs/2409.04992)**  
  Xiurui Pan, Endian Li, Qiao Li et al. · arXiv:2409.04992 · 2024-09-08
  > The widespread of Large Language Models (LLMs) marks a significant milestone in generative AI. Nevertheless, the increasing context length and batch size in offline LLM inference escalate the memory requirement of the key-value (KV) cache, which imposes a huge...

- **[Intelligent Router for LLM Workloads: Improving Performance Through Workload-Aware Load Balancing](https://arxiv.org/abs/2408.13510)**  
  Kunal Jain, Anjaly Parayil, Ankur Mallick et al. · arXiv:2408.13510 · 2024-08-24
  > Large Language Model (LLM) workloads have distinct prefill and decode phases with different compute and memory requirements which should ideally be accounted for when scheduling input queries across different LLM instances in a cluster. However existing schedu...

- **[MoC-System: Efficient Fault Tolerance for Sparse Mixture-of-Experts Model Training](https://arxiv.org/abs/2408.04307)**  
  Weilin Cai, Le Qin, Jiayi Huang · arXiv:2408.04307 · 2024-08-08
  > As large language models continue to scale up, distributed training systems have expanded beyond 10k nodes, intensifying the importance of fault tolerance. Checkpoint has emerged as the predominant fault tolerance strategy, with extensive studies dedicated to ...

- **[NACL: A General and Effective KV Cache Eviction Framework for LLMs at Inference Time](https://arxiv.org/abs/2408.03675)**  
  Yilong Chen, Guoxia Wang, Junyuan Shang et al. · arXiv:2408.03675 · 2024-08-07
  > Large Language Models (LLMs) have ignited an innovative surge of AI applications, marking a new era of exciting possibilities equipped with extended context windows. However, hosting these models is cost-prohibitive mainly due to the extensive memory consumpti...

- **[SmartQuant: CXL-based AI Model Store in Support of Runtime Configurable Weight Quantization](https://arxiv.org/abs/2407.15866)**  
  Rui Xie, Asad Ul Haq, Linsen Ma et al. · arXiv:2407.15866 · 2024-07-17
  > Recent studies have revealed that, during the inference on generative AI models such as transformer, the importance of different weights exhibits substantial context-dependent variations. This naturally manifests a promising potential of adaptively configuring...

- **[Ada-KV: Optimizing KV Cache Eviction by Adaptive Budget Allocation for Efficient LLM Inference](https://arxiv.org/abs/2407.11550)**  
  Yuan Feng, Junlin Lv, Yukun Cao et al. · arXiv:2407.11550 · 2024-07-16
  > Large Language Models have excelled in various domains but face efficiency challenges due to the growing Key-Value (KV) cache required for long-sequence inference. Recent efforts aim to reduce KV cache size by evicting vast non-critical cache elements during r...

- **[MemServe: Context Caching for Disaggregated LLM Serving with Elastic Memory Pool](https://arxiv.org/abs/2406.17565)**  
  Cunchen Hu, Heyang Huang, Junhao Hu et al. · arXiv:2406.17565 · 2024-06-25
  > Large language model (LLM) serving has transformed from stateless to stateful systems, utilizing techniques like context caching and disaggregated inference. These optimizations extend the lifespan and domain of the KV cache, necessitating a new architectural ...

- **[Mooncake: A KVCache-centric Disaggregated Architecture for LLM Serving](https://arxiv.org/abs/2407.00079)**  
  Ruoyu Qin, Zheming Li, Weiran He et al. · arXiv:2407.00079 · 2024-06-24
  > Mooncake is the serving platform for Kimi, a leading LLM service provided by Moonshot AI. It features a KVCache-centric disaggregated architecture that separates the prefill and decoding clusters. It also leverages the underutilized CPU, DRAM, and SSD resource...

- **[Endor: Hardware-Friendly Sparse Format for Offloaded LLM Inference](https://arxiv.org/abs/2406.11674)**  
  Donghyeon Joo, Ramyad Hadidi, Soheil Feizi et al. · arXiv:2406.11674 · 2024-06-17
  > The increasing size of large language models (LLMs) challenges their usage on resource-constrained platforms. For example, memory on modern GPUs is insufficient to hold LLMs that are hundreds of Gigabytes in size. Offloading is a popular method to escape this ...

- **[ExCP: Extreme LLM Checkpoint Compression via Weight-Momentum Joint Shrinking](https://arxiv.org/abs/2406.11257)**  
  Wenshuo Li, Xinghao Chen, Han Shu et al. · arXiv:2406.11257 · 2024-06-17
  > Large language models (LLM) have recently attracted significant attention in the field of artificial intelligence. However, the training process of these models poses significant challenges in terms of computational and storage capacities, thus compressing che...

- **[ZipCache: Accurate and Efficient KV Cache Quantization with Salient Token Identification](https://arxiv.org/abs/2405.14256)**  
  Yefei He, Luoming Zhang, Weijia Wu et al. · arXiv:2405.14256 · 2024-05-23
  > KV cache stores key and value states from previous tokens to avoid re-computation, yet it demands substantial storage space, especially for long sequences. Adaptive KV cache compression seeks to discern the saliency of tokens, preserving vital information whil...

- **[Characterizing the Dilemma of Performance and Index Size in Billion-Scale Vector Search and Breaking It with Second-Tier Memory](https://arxiv.org/abs/2405.03267)**  
  Rongxin Cheng, Yifan Peng, Xingda Wei et al. · arXiv:2405.03267 · 2024-05-06
  > Vector searches on large-scale datasets are critical to modern online services like web search and RAG, which necessity storing the datasets and their index on the secondary storage like SSD. In this paper, we are the first to characterize the trade-off of per...

- **[decoupleQ: Towards 2-bit Post-Training Uniform Quantization via decoupling Parameters into Integer and Floating Points](https://arxiv.org/abs/2404.12759)**  
  Yi Guo, Fanliu Kong, Xiaoyang Li et al. · arXiv:2404.12759 · 2024-04-19
  > Quantization emerges as one of the most promising compression technologies for deploying efficient large models for various real time application in recent years. Considering that the storage and IO of weights take up the vast majority of the overhead inside a...

- **[RAGCache: Efficient Knowledge Caching for Retrieval-Augmented Generation](https://arxiv.org/abs/2404.12457)**  
  Chao Jin, Zili Zhang, Xuanlin Jiang et al. · arXiv:2404.12457 · 2024-04-18
  > Retrieval-Augmented Generation (RAG) has shown significant improvements in various natural language processing tasks by integrating the strengths of large language models (LLMs) and external knowledge databases. However, RAG introduces long sequence generation...

- **[I/O in Machine Learning Applications on HPC Systems: A 360-degree Survey](https://arxiv.org/abs/2404.10386)**  
  Noah Lewis, Jean Luca Bez, Surendra Byna · arXiv:2404.10386 · 2024-04-16
  > Growing interest in Artificial Intelligence (AI) has resulted in a surge in demand for faster methods of Machine Learning (ML) model training and inference. This demand for speed has prompted the use of high performance computing (HPC) systems that excel in ma...

- **[AiSAQ: All-in-Storage ANNS with Product Quantization for DRAM-free Information Retrieval](https://arxiv.org/abs/2404.06004)**  
  Kento Tatsuno, Daisuke Miyashita, Taiga Ikeda et al. · arXiv:2404.06004 · 2024-04-09
  > Graph-based approximate nearest neighbor search (ANNS) algorithms work effectively against large-scale vector retrieval. Among such methods, DiskANN achieves good recall-speed tradeoffs using both DRAM and storage. DiskANN adopts product quantization (PQ) to r...

- **[UDON: A case for offloading to general purpose compute on CXL memory](https://arxiv.org/abs/2404.02868)**  
  Jon Hermes, Josh Minor, Minjun Wu et al. · arXiv:2404.02868 · 2024-04-03
  > Upcoming CXL-based disaggregated memory devices feature special purpose units to offload compute to near-memory. In this paper, we explore opportunities for offloading compute to general purpose cores on CXL memory devices, thereby enabling a greater utility a...

- **[Checkpoint Merging via Bayesian Optimization in LLM Pretraining](https://arxiv.org/abs/2403.19390)**  
  Deyuan Liu, Zecheng Wang, Bingning Wang et al. · arXiv:2403.19390 · 2024-03-28
  > The rapid proliferation of large language models (LLMs) such as GPT-4 and Gemini underscores the intense demand for resources during their training processes, posing significant challenges due to substantial computational and environmental costs. To alleviate ...

- **[QAQ: Quality Adaptive Quantization for LLM KV Cache](https://arxiv.org/abs/2403.04643)**  
  Shichen Dong, Wen Cheng, Jiayu Qin et al. · arXiv:2403.04643 · 2024-03-07
  > The emergence of LLMs has ignited a fresh surge of breakthroughs in NLP applications, particularly in domains such as question-answering systems and text generation. As the need for longer context grows, a significant bottleneck in model deployment emerges due...

- **[No Token Left Behind: Reliable KV Cache Compression via Importance-Aware Mixed Precision Quantization](https://arxiv.org/abs/2402.18096)**  
  June Yong Yang, Byeongwook Kim, Jeongin Bae et al. · arXiv:2402.18096 · 2024-02-28
  > Key-Value (KV) Caching has become an essential technique for accelerating the inference speed and throughput of generative Large Language Models~(LLMs). However, the memory footprint of the KV cache poses a critical bottleneck in LLM deployment as the cache si...

- **[Formal Definitions and Performance Comparison of Consistency Models for Parallel File Systems](https://arxiv.org/abs/2402.14105)**  
  Chen Wang, Kathryn Mohror, Marc Snir · arXiv:2402.14105 · 2024-02-21
  > The semantics of HPC storage systems are defined by the consistency models to which they abide. Storage consistency models have been less studied than their counterparts in memory systems, with the exception of the POSIX standard and its strict consistency mod...

- **[KIVI: A Tuning-Free Asymmetric 2bit Quantization for KV Cache](https://arxiv.org/abs/2402.02750)**  
  Zirui Liu, Jiayi Yuan, Hongye Jin et al. · arXiv:2402.02750 · 2024-02-05
  > Efficiently serving large language models (LLMs) requires batching of many requests to reduce the cost per request. Yet, with larger batch sizes and longer context lengths, the key-value (KV) cache, which stores attention keys and values to avoid re-computatio...

- **[Spin: An Efficient Secure Computation Framework with GPU Acceleration](https://arxiv.org/abs/2402.02320)**  
  Wuxuan Jiang, Xiangjun Song, Shenbai Hong et al. · arXiv:2402.02320 · 2024-02-04
  > Accuracy and efficiency remain challenges for multi-party computation (MPC) frameworks. Spin is a GPU-accelerated MPC framework that supports multiple computation parties and a dishonest majority adversarial setup. We propose optimized protocols for non-linear...

- **[ServerlessLLM: Low-Latency Serverless Inference for Large Language Models](https://arxiv.org/abs/2401.14351)**  
  Yao Fu, Leyang Xue, Yeqi Huang et al. · arXiv:2401.14351 · 2024-01-25
  > This paper presents ServerlessLLM, a distributed system designed to support low-latency serverless inference for Large Language Models (LLMs). By harnessing the substantial near-GPU storage and memory capacities of inference servers, ServerlessLLM achieves eff...

- **[Fine-Grained Embedding Dimension Optimization During Training for Recommender Systems](https://arxiv.org/abs/2401.04408)**  
  Qinyi Luo, Penghan Wang, Wei Zhang et al. · arXiv:2401.04408 · 2024-01-09
  > Huge embedding tables in modern deep learning recommender models (DLRM) require prohibitively large memory during training and inference. This paper proposes FIITED, a system to automatically reduce the memory footprint via FIne-grained In-Training Embedding D...

- **[Starling: An I/O-Efficient Disk-Resident Graph Index Framework for High-Dimensional Vector Similarity Search on Data Segment](https://arxiv.org/abs/2401.02116)**  
  Mengzhao Wang, Weizhi Xu, Xiaomeng Yi et al. · arXiv:2401.02116 · 2024-01-04
  > High-dimensional vector similarity search (HVSS) is gaining prominence as a powerful tool for various data science and AI applications. As vector data scales up, in-memory indexes pose a significant challenge due to the substantial increase in main memory requ...

- **[ACCL+: an FPGA-Based Collective Engine for Distributed Applications](https://arxiv.org/abs/2312.11742)**  
  Zhenhao He, Dario Korolija, Yu Zhu et al. · arXiv:2312.11742 · 2023-12-18
  > FPGAs are increasingly prevalent in cloud deployments, serving as Smart NICs or network-attached accelerators. Despite their potential, developing distributed FPGA-accelerated applications remains cumbersome due to the lack of appropriate infrastructure and co...

- **[NDSEARCH: Accelerating Graph-Traversal-Based Approximate Nearest Neighbor Search through Near Data Processing](https://arxiv.org/abs/2312.03141)**  
  Yitu Wang, Shiyu Li, Qilin Zheng et al. · arXiv:2312.03141 · 2023-12-05
  > Approximate nearest neighbor search (ANNS) is a key retrieval technique for vector database and many data center applications, such as person re-identification and recommendation systems. It is also fundamental to retrieval augmented generation (RAG) for large...

- **[Prompt Cache: Modular Attention Reuse for Low-Latency Inference](https://arxiv.org/abs/2311.04934)**  
  In Gim, Guojun Chen, Seung-seob Lee et al. · arXiv:2311.04934 · 2023-11-07
  > We present Prompt Cache, an approach for accelerating inference for large language models (LLM) by reusing attention states across different LLM prompts. Many input prompts have overlapping text segments, such as system messages, prompt templates, and document...

- **[Chameleon: a Heterogeneous and Disaggregated Accelerator System for Retrieval-Augmented Language Models](https://arxiv.org/abs/2310.09949)**  
  Wenqi Jiang, Marco Zeller, Roger Waleffe et al. · arXiv:2310.09949 · 2023-10-15
  > A Retrieval-Augmented Language Model (RALM) combines a large language model (LLM) with a vector database to retrieve context-specific knowledge during text generation. This strategy facilitates impressive generation quality even with smaller models, thus reduc...

- **[CacheGen: KV Cache Compression and Streaming for Fast Large Language Model Serving](https://arxiv.org/abs/2310.07240)**  
  Yuhan Liu, Hanchen Li, Yihua Cheng et al. · arXiv:2310.07240 · 2023-10-11
  > As large language models (LLMs) take on complex tasks, their inputs are supplemented with longer contexts that incorporate domain knowledge. Yet using long contexts is challenging, as nothing can be generated until the whole context is processed by the LLM. Wh...

- **[Model Tells You What to Discard: Adaptive KV Cache Compression for LLMs](https://arxiv.org/abs/2310.01801)**  
  Suyu Ge, Yunan Zhang, Liyuan Liu et al. · arXiv:2310.01801 · 2023-10-03
  > In this study, we introduce adaptive KV cache compression, a plug-and-play method that reduces the memory footprint of generative inference for Large Language Models (LLMs). Different from the conventional KV cache that retains key and value vectors for all co...

- **[DiskANN++: Efficient Page-based Search over Isomorphic Mapped Graph Index using Query-sensitivity Entry Vertex](https://arxiv.org/abs/2310.00402)**  
  Jiongkang Ni, Xiaoliang Xu, Yuxiang Wang et al. · arXiv:2310.00402 · 2023-09-30
  > Given a vector dataset $\mathcal{X}$ and a query vector $\vec{x}_q$, graph-based Approximate Nearest Neighbor Search (ANNS) aims to build a graph index $G$ and approximately return vectors with minimum distances to $\vec{x}_q$ by searching over $G$. The main d...

- **[Efficient Memory Management for Large Language Model Serving with PagedAttention](https://arxiv.org/abs/2309.06180)**  
  Woosuk Kwon, Zhuohan Li, Siyuan Zhuang et al. · arXiv:2309.06180 · 2023-09-12
  > High throughput serving of large language models (LLMs) requires batching sufficiently many requests at a time. However, existing systems struggle because the key-value cache (KV cache) memory for each request is huge and grows and shrinks dynamically. When ma...

- **[Performance Modeling of Data Storage Systems using Generative Models](https://arxiv.org/abs/2307.02073)**  
  Abdalaziz Rashid Al-Maeeni, Aziz Temirkhanov, Artem Ryzhikov et al. · arXiv:2307.02073 · 2023-07-05
  > High-precision modeling of systems is one of the main areas of industrial data analysis. Models of systems, their digital twins, are used to predict their behavior under various conditions. We have developed several models of a storage system using machine lea...

- **[An Empirical Evaluation of Columnar Storage Formats](https://arxiv.org/abs/2304.05028)**  
  Xinyu Zeng, Yulong Hui, Jiahong Shen et al. · arXiv:2304.05028 · 2023-04-11
  > Columnar storage is a core component of a modern data analytics system. Although many database management systems (DBMSs) have proprietary storage formats, most provide extensive support to open-source storage formats such as Parquet and ORC to facilitate cros...

- **[Analyzing I/O Performance of a Hierarchical HPC Storage System for Distributed Deep Learning](https://arxiv.org/abs/2301.01494)**  
  Takaaki Fukai, Kento Sato, Takahiro Hirofuchi · arXiv:2301.01494 · 2023-01-04
  > Today, deep learning is an essential technology for our life. To solve more complex problems with deep learning, both sizes of training datasets and neural networks are increasing. To train a model with large datasets and networks, distributed deep neural netw...

- **[Efficient Speech Representation Learning with Low-Bit Quantization](https://arxiv.org/abs/2301.00652)**  
  Ching-Feng Yeh, Wei-Ning Hsu, Paden Tomasello et al. · arXiv:2301.00652 · 2022-12-14
  > With the development of hardware for machine learning, newer models often come at the cost of both increased sizes and computational complexity. In effort to improve the efficiency for these models, we apply and investigate recent quantization techniques on sp...

- **[Profiling and Improving the PyTorch Dataloader for high-latency Storage: A Technical Report](https://arxiv.org/abs/2211.04908)**  
  Ivan Svogor, Christian Eichenberger, Markus Spanring et al. · arXiv:2211.04908 · 2022-11-09
  > A growing number of Machine Learning Frameworks recently made Deep Learning accessible to a wider audience of engineers, scientists, and practitioners, by allowing straightforward use of complex neural network architectures and algorithms. However, since deep ...

- **[A GPU-specialized Inference Parameter Server for Large-Scale Deep Recommendation Models](https://arxiv.org/abs/2210.08804)**  
  Yingcan Wei, Matthias Langer, Fan Yu et al. · arXiv:2210.08804 · 2022-10-17
  > Recommendation systems are of crucial importance for a variety of modern apps and web services, such as news feeds, social networks, e-commerce, search, etc. To achieve peak prediction accuracy, modern recommendation models combine deep learning with terabyte-...

- **[EasyScale: Accuracy-consistent Elastic Training for Deep Learning](https://arxiv.org/abs/2208.14228)**  
  Mingzhen Li, Wencong Xiao, Biao Sun et al. · arXiv:2208.14228 · 2022-08-30
  > Distributed synchronized GPU training is commonly used for deep learning. The resource constraint of using a fixed number of GPUs makes large-scale training jobs suffer from long queuing time for resource allocation, and lowers the cluster utilization. Adaptin...

- **[DC-BENCH: Dataset Condensation Benchmark](https://arxiv.org/abs/2207.09639)**  
  Justin Cui, Ruochen Wang, Si Si et al. · arXiv:2207.09639 · 2022-07-20
  > Dataset Condensation is a newly emerging technique aiming at learning a tiny dataset that captures the rich information encoded in the original dataset. As the size of datasets contemporary machine learning models rely on becomes increasingly large, condensati...

- **[Accelerating Large-Scale Graph-based Nearest Neighbor Search on a Computational Storage Platform](https://arxiv.org/abs/2207.05241)**  
  Ji-Hoon Kim, Yeo-Reum Park, Jaeyoung Do et al. · arXiv:2207.05241 · 2022-07-12
  > K-nearest neighbor search is one of the fundamental tasks in various applications and the hierarchical navigable small world (HNSW) has recently drawn attention in large-scale cloud services, as it easily scales up the database while offering fast search. On t...

- **[ORCA: A Network and Architecture Co-design for Offloading us-scale Datacenter Applications](https://arxiv.org/abs/2203.08906)**  
  Yifan Yuan, Jinghan Huang, Yan Sun et al. · arXiv:2203.08906 · 2022-03-16
  > Responding to the "datacenter tax" and "killer microseconds" problems for datacenter applications, diverse solutions including Smart NIC-based ones have been proposed. Nonetheless, they often suffer from high overhead of communications over network and/or PCIe...

- **[Pond: CXL-Based Memory Pooling Systems for Cloud Platforms](https://arxiv.org/abs/2203.00241)**  
  Huaicheng Li, Daniel S. Berger, Stanko Novakovic et al. · arXiv:2203.00241 · 2022-03-01
  > Public cloud providers seek to meet stringent performance requirements and low hardware cost. A key driver of performance and cost is main memory. Memory pooling promises to improve DRAM utilization and thereby reduce costs. However, pooling is challenging und...

- **[MLPerf HPC: A Holistic Benchmark Suite for Scientific Machine Learning on HPC Systems](https://arxiv.org/abs/2110.11466)**  
  Steven Farrell, Murali Emani, Jacob Balma et al. · arXiv:2110.11466 · 2021-10-21
  > Scientific communities are increasingly adopting machine learning and deep learning models in their applications to accelerate scientific insights. High performance computing systems are pushing the frontiers of performance with a rich diversity of hardware re...

- **[Quantifying and Improving Performance of Distributed Deep Learning with Cloud Storage](https://arxiv.org/abs/2108.06322)**  
  Nicholas Krichevsky, Renee St Louis, Tian Guo · arXiv:2108.06322 · 2021-08-13
  > Cloud computing provides a powerful yet low-cost environment for distributed deep learning workloads. However, training complex deep learning models often requires accessing large amounts of data, which can easily exceed the capacity of local disks. Prior rese...

- **[Separating Data via Block Invalidation Time Inference for Write Amplification Reduction in Log-Structured Storage](https://arxiv.org/abs/2104.12425)**  
  Qiuping Wang, Jinhong Li, Patrick P. C. Lee et al. · arXiv:2104.12425 · 2021-04-26
  > Log-structured storage has been widely deployed in various domains of storage systems, yet its garbage collection incurs write amplification (WA) due to the rewrites of live data. We show that there exists an optimal data placement scheme that minimizes WA usi...

- **[A Study of Checkpointing in Large Scale Training of Deep Neural Networks](https://arxiv.org/abs/2012.00825)**  
  Elvis Rojas, Albert Njoroge Kahira, Esteban Meneses et al. · arXiv:2012.00825 · 2020-12-01
  > Deep learning (DL) applications are increasingly being deployed on HPC systems, to leverage the massive parallelism and computing power of those systems for DL model training. While significant effort has been put to facilitate distributed training by DL frame...

- **[WeiPS: a symmetric fusion model framework for large-scale online learning](https://arxiv.org/abs/2011.11983)**  
  Xiang Yu, Fuping Chu, Junqi Wu et al. · arXiv:2011.11983 · 2020-11-24
  > The recommendation system is an important commercial application of machine learning, where billions of feed views in the information flow every day. In reality, the interaction between user and item usually makes user's interest changing over time, thus many ...

- **[STANNIS: Low-Power Acceleration of Deep Neural Network Training Using Computational Storage](https://arxiv.org/abs/2002.07215)**  
  Ali HeydariGorji, Mahdi Torabzadehkashi, Siavash Rezaei et al. · arXiv:2002.07215 · 2020-02-17
  > This paper proposes a framework for distributed, in-storage training of neural networks on clusters of computational storage devices. Such devices not only contain hardware accelerators but also eliminate data movement between the host and storage, resulting i...

- **[High Performance I/O For Large Scale Deep Learning](https://arxiv.org/abs/2001.01858)**  
  Alex Aizman, Gavin Maltby, Thomas Breuel · arXiv:2001.01858 · 2020-01-07
  > Training deep learning (DL) models on petascale datasets is essential for achieving competitive and state-of-the-art performance in applications such as speech, video analytics, and object recognition. However, existing distributed filesystems were not develop...

- **[Practice on Long Sequential User Behavior Modeling for Click-Through Rate Prediction](https://arxiv.org/abs/1905.09248)**  
  Qi Pi, Weijie Bian, Guorui Zhou et al. · arXiv:1905.09248 · 2019-05-22
  > Click-through rate (CTR) prediction is critical for industrial applications such as recommender system and online advertising. Practically, it plays an important role for CTR modeling in these applications by mining user interest from rich historical behavior ...

- **[Hoard: A Distributed Data Caching System to Accelerate Deep Learning Training on the Cloud](https://arxiv.org/abs/1812.00669)**  
  Christian Pinto, Yiannis Gkoufas, Andrea Reale et al. · arXiv:1812.00669 · 2018-12-03
  > Deep Learning system architects strive to design a balanced system where the computational accelerator -- FPGA, GPU, etc, is not starved for data. Feeding training data fast enough to effectively keep the accelerator utilization high is difficult when utilizin...

- **[Bandana: Using Non-volatile Memory for Storing Deep Learning Models](https://arxiv.org/abs/1811.05922)**  
  Assaf Eisenman, Maxim Naumov, Darryl Gardner et al. · arXiv:1811.05922 · 2018-11-14
  > Typical large-scale recommender systems use deep learning models that are stored on a large amount of DRAM. These models often rely on embeddings, which consume most of the required memory. We present Bandana, a storage system that reduces the DRAM footprint o...

- **[ModelHub: Towards Unified Data and Lifecycle Management for Deep Learning](https://arxiv.org/abs/1611.06224)**  
  Hui Miao, Ang Li, Larry S. Davis et al. · arXiv:1611.06224 · 2016-11-18
  > Deep learning has improved state-of-the-art results in many important fields, and has been the subject of much research in recent years, leading to the development of several systems for facilitating deep learning. Current systems, however, mainly focus on mod...
