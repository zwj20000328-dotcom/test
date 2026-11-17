# 世界模型资源索引

<!-- 本文件由 `node scripts/resources.mjs index` 自动生成,请勿手工编辑。 -->
<!-- 生成时间: 2026-11-17 -->

共收录 **63** 条资源。

## 统计

| 维度 | 分布 |
| --- | --- |
| 类型 | 基准 5 · 博客 10 · 论文 47 · 综述 1 |
| 路线 | 3D / 场景表示 4 · 自动驾驶 3 · 具身智能 4 · 评测与基准 10 · 基础与综述 3 · 交互式世界模型 11 · 潜空间预测 (JEPA) 9 · 模型基强化学习 3 · 综述 1 · 视频生成式 4 · 世界-动作模型 (WAM) 11 |
| 状态 | read 12 · skimmed 51 |
| 置信度 | A 13 · B 48 · C 2 |

## 待核实

以下条目来自二手信息、未能直接访问的来源,或明确标记需要复核。使用前请先核对原文。

| ID | 标题 | 来源 | 待核实原因 |
| --- | --- | --- | --- |
| WM-BLOG-007 | Genie 3: A New Frontier for World Models | Google DeepMind | Google DeepMind 页面在本环境被网络策略阻断,规格来自既有知识,需在可访问网络下核对原文。 |
| WM-BLOG-010 | Sora 2 | OpenAI | OpenAI 页面返回 403,规格来自既有知识,需在可访问网络下核对原文与 system card。 |

## 阅读队列

| 优先级 | ID | 标题 | 状态 | 一句话 |
| --- | --- | --- | --- | --- |
| P0 | WM-SURVEY-001 | [World Models: A Comprehensive Survey of Architectures, Methodologies, Reasoning Paradigms, and Applications](https://arxiv.org/abs/2606.00133) | skimmed | 2026 年最系统的世界模型综述,按架构、方法族、推理范式与应用四轴分类,适合作为全景入口。 |
| P0 | WM-PAPER-025 | [Prediction or Persistence? What Future-Prediction Scores Miss About World Models](https://arxiv.org/abs/2611.15082) | skimmed | 未来预测分数混合了编码器质量、近期持续性与预测器贡献;用配对持续性控制才能分离出真正的预测能力。 |
| P0 | WM-BENCH-002 | [WorldArena 2.0: Extending Embodied World Model Benchmarking on Modality, Functionality and Platform](https://arxiv.org/abs/2605.17912) | skimmed | 2026 年具身世界模型的主基准之一,从模态、功能与平台三个维度扩展评测;GreenWAM 等在此报告结果。 |
| P0 | WM-BLOG-007 | [Genie 3: A New Frontier for World Models](https://deepmind.google/discover/blog/genie-3-a-new-frontier-for-world-models/) | skimmed | 据官方博客,720p/24fps 实时可交互世界模型,可维持数分钟一致性并支持可提示世界事件;本次环境无法直接访问原页。 |
| P1 | WM-PAPER-014 | [GE-Sim 2.0: A Roadmap Towards Comprehensive Closed-loop Video World Simulators for Robotic Manipulation](https://arxiv.org/abs/2605.27491) | skimmed | 在数千小时真机数据上重训动作条件视频模拟器,并加入状态专家与世界裁判,把视频生成接进策略学习闭环。 |
| P1 | WM-PAPER-015 | [GE-Act 2.0: Pretraining and Scaling a World-Action Model for Robotic Manipulation](https://arxiv.org/abs/2609.05588) | skimmed | 从零在操作数据上预训练 WAM,用控制导向自编码器 + 单步视觉规划器 + 逆动力学模型,挑战继承视频生成器的惯例。 |
| P1 | WM-PAPER-016 | [InternW0: A Foundational Physical World Model for Efficient Real-World Interactions](https://arxiv.org/abs/2609.27656) | skimmed | 异步多频架构:重型视频专家做长时程预测,轻量动作专家高频输出,强调部分可观测下的局部物理建模。 |
| P1 | WM-PAPER-018 | [GreenWAM: A World Foundation Model for Robotics](https://arxiv.org/abs/2610.18774) | skimmed | 用统一解剖动作空间覆盖 20 种机器人,同一模型兼顾世界模型与策略,并在 WorldArena 1.0 上取得领先。 |
| P1 | WM-PAPER-022 | [HY-World 2.0: A Multi-Modal World Model for Reconstructing, Generating, and Simulating 3D Worlds](https://arxiv.org/abs/2604.14268) | skimmed | 腾讯混元把重建、生成、模拟 3D 世界统一到多模态世界模型,是从 2D 视频走向显式 3D 的代表路线。 |
| P1 | WM-PAPER-023 | [NVIDIA OmniDreams: Real-Time Generative World Model for Closed-Loop Autonomous Vehicle Simulation](https://arxiv.org/abs/2606.03159) | skimmed | 从 Cosmos 中级/后训练出实时动作条件视频模型,用 2.1 万小时驾驶场景做闭环 AV 仿真,弥补重建式神经模拟器的泛化短板。 |
| P1 | WM-PAPER-024 | [Interactive World Simulation with Cosmos for Physical AI](https://arxiv.org/abs/2611.06627) | skimmed | 统一框架把 Cosmos 适配为实时交互模拟:既能预测动作的视觉后果,也能从外部物理引擎维护的状态生成观测。 |
| P1 | WM-PAPER-028 | [Frame First, Decode Once: Object-Centric Coordinates and Single-Pass Decoding for System-1 World Models](https://arxiv.org/abs/2611.18761) | skimmed | 在物体初始位姿的 SE(2) 坐标系中表达输入输出,把候选动作排序的决策遗憾降低 1.9-2.2 倍,验证了物体中心坐标的价值。 |
| P1 | WM-PAPER-030 | [GameWM: Toward Next-Generation Video Games with Interaction-Centric World Models](https://arxiv.org/abs/2611.19247) | skimmed | 让游戏引擎保留规则、状态、相机与世界布局,视频模型只生成昂贵的手工内容,是混合架构的清晰分工范式。 |
| P1 | WM-PAPER-031 | [Old Is Not False: Valid-Time Memory for Interactive Video World Models](https://arxiv.org/abs/2611.00758) | skimmed | 区分“过时”与“错误”,为交互视频世界模型引入有效时间记忆,避免旧观测被简单丢弃或错误覆盖。 |
| P1 | WM-PAPER-033 | [Causal-rCM: A Unified Teacher-Forcing and Self-Forcing Open Recipe for Autoregressive Diffusion Distillation in Streaming Video Generation and Interactive World Models](https://arxiv.org/abs/2606.25473) | skimmed | 把 teacher-forcing 与 self-forcing 统一为自回归扩散蒸馏配方,直接面向流式视频与交互世界模型的实时化。 |
| P1 | WM-PAPER-034 | [Reconstruction or Semantics? What Makes a Latent Space Useful for Robotic World Models](https://arxiv.org/abs/2605.06388) | skimmed | 在固定协议下比较六种重建/语义编码器,发现高维语义潜空间也能有效训练动作条件世界模型,挑战“必须重建像素”的默认假设。 |
| P1 | WM-BLOG-003 | [Frameboy: Atlas in Real-time](https://www.worldlabs.ai/blog/atlas-realtime) | skimmed | 把 Atlas 优化到云端 GPU 流式 15 fps,用实时相机控制探索;证明交互延迟下降会改变创作范式而非仅仅提速。 |
| P1 | WM-BLOG-004 | [Building Worlds That Train Robots: Real-to-Sim-to-Real](https://www.worldlabs.ai/blog/real-to-sim-to-real) | skimmed | 声称仅用仿真数据训练的策略可跨机器人/任务迁移,且仿真评测能预测真机相对表现与失败区域;需要独立复现验证。 |
| P1 | WM-BENCH-003 | [WMEval: Evaluating Interactive World Models Grounded on Physical Simulations](https://arxiv.org/abs/2610.33894) | skimmed | 以物理仿真为真值评估交互式世界模型,直接针对“交互后状态是否物理正确”这一核心能力。 |
| P1 | WM-BENCH-005 | [SciWorldBench: Do Video World Models Really Understand Scientific Experiments?](https://arxiv.org/abs/2611.20899) | skimmed | 用科学实验场景检验视频世界模型是否理解因果与实验逻辑,而非仅拟合视觉外观。 |
| P1 | WM-PAPER-008 | [Cosmos World Foundation Model Platform for Physical AI](https://arxiv.org/abs/2501.03575) | skimmed | 把世界基础模型做成平台:数据治理、视频 tokenizer、预训练模型与后训练配方,并开源权重。 |
| P1 | WM-PAPER-009 | [World Simulation with Video Foundation Models for Physical AI](https://arxiv.org/abs/2511.00062) | skimmed | Cosmos-Predict2.5 用流匹配统一 Text/Image/Video2World,2B/14B 两档,并用 RL 后训练提升指令对齐。 |
| P1 | WM-PAPER-011 | [GAIA-2: A Controllable Multi-View Generative World Model for Autonomous Driving](https://arxiv.org/abs/2503.20523) | skimmed | 以自车动力学、智能体配置、环境与道路语义为结构化条件,生成多相机时空一致的驾驶视频。 |
| P1 | WM-PAPER-012 | [SIMA 2: A Generalist Embodied Agent for Virtual Worlds](https://arxiv.org/abs/2512.04797) | skimmed | 基于 Gemini 的通用具身智能体,在多种 3D 虚拟世界中理解高层目标、对话与图像指令,并泛化到未见环境。 |
| P1 | WM-PAPER-013 | [Genie Envisioner: A Unified World Foundation Platform for Robotic Manipulation](https://arxiv.org/abs/2508.05635) | skimmed | 面向机器人操作的世界基础平台,把指令条件视频生成、策略学习与评测串成闭环,是中国团队的代表性路线。 |
| P1 | WM-PAPER-020 | [WorldPlay: Towards Long-Term Geometric Consistency for Real-Time Interactive World Modeling](https://arxiv.org/abs/2512.14614) | skimmed | 用双动作表示、重构式上下文记忆与 Context Forcing 蒸馏,在实时流式生成中维持长期几何一致性。 |
| P1 | WM-BLOG-005 | [Marble: A Multimodal World Model](https://www.worldlabs.ai/blog/marble-world-model) | skimmed | 从文本/图像/视频生成可探索、可编辑的持久 3D 世界,输出 Gaussian splats;是 Atlas 的前代产品化形态。 |
| P1 | WM-BLOG-006 | [RTFM: A Real-Time Frame Model](https://www.worldlabs.ai/blog/rtfm) | skimmed | 轻量实时帧生成模型,用持久 3D 上下文缓存支持交互式新视角合成,是 Atlas/Frameboy 的技术前身。 |
| P1 | WM-BLOG-010 | [Sora 2](https://openai.com/index/sora-2/) | skimmed | 据发布信息,视频生成加入同步音频与更强物理/可控性,仍以离线内容生成为主;本环境无法直接访问原页。 |
| P1 | WM-BENCH-001 | [WorldModelBench: Judging Video Generation Models As World Models](https://arxiv.org/abs/2502.20694) | skimmed | 从指令遵循与物理合理性两个维度评判视频生成模型作为世界模型的能力,是最早的系统性基准之一。 |
| P1 | WM-PAPER-004 | [DINO-WM: World Models on Pre-trained Visual Features enable Zero-shot Planning](https://arxiv.org/abs/2411.04983) | skimmed | 冻结 DINOv2 特征上学习动力学即可零样本规划,说明高质量语义表征能显著降低世界模型的学习难度。 |
| P1 | WM-PAPER-003 | [TD-MPC2: Scalable, Robust World Models for Continuous Control](https://arxiv.org/abs/2310.16828) | skimmed | 无解码器的隐式世界模型 + 局部轨迹优化,单套超参覆盖 104 个任务,并展示 317M 参数多任务扩展性。 |
| P2 | WM-PAPER-017 | [Magic-W0: A Structured World-Action Foundation Model for Physical Intelligence](https://arxiv.org/abs/2609.39870) | skimmed | 把交互显式表示为当前状态、转移、未来状态三段式,用 3D 运动作为动作引起的结构化转移表征。 |
| P2 | WM-PAPER-019 | [LaST0.5: A Generalist World Action Model with Interaction-Centric Latent Reasoning](https://arxiv.org/abs/2611.14048) | skimmed | 指出全局场景表征会淹没局部机器人-物体交互,提出以交互为中心的中间物理表征来桥接世界建模与动作生成。 |
| P2 | WM-PAPER-021 | [DreamX-World 1.0: A General-Purpose Interactive World Model](https://arxiv.org/abs/2606.16993) | skimmed | 通用交互式文/图生视频世界模型,支持相机导航、重访旧区域与可提示事件,并用 E-PRoPE 做相机几何控制。 |
| P2 | WM-PAPER-026 | [Recovered or Memorized? Investigating Dynamical Consistency and Faithfulness in World Model Latents](https://arxiv.org/abs/2611.18807) | skimmed | 提出 Anchored Recovery Certification,用离散 Fréchet 距离与干预子空间检验潜变量是否真的忠实于环境动力学,而不只是可解… |
| P2 | WM-PAPER-029 | [The Sense Paradigm for World Models](https://arxiv.org/abs/2611.19796) | skimmed | 用有向距离上的单交叉熵损失替代目标网络/方差惩罚,使潜空间距离有语义并能区分可逆与不可逆转移。 |
| P2 | WM-PAPER-032 | [VERDI: Verified Contradictions for Continual World-Model Optimization](https://arxiv.org/abs/2608.09537) | skimmed | 把跨模型迁移的优化策略视为假设而非配方,只有在目标模型上实验验证过的矛盾才升级为可复用知识。 |
| P2 | WM-PAPER-035 | [AEON: Unifying Video and 3D World Models](https://arxiv.org/abs/2610.28631) | skimmed | 尝试把视频世界模型与 3D 世界模型统一到同一框架,回应“渲染与模拟是否应共用表征”的核心争议。 |
| P2 | WM-PAPER-036 | [UniW(A)M: A Unified Mixture-of-Experts Framework for World and World-Action Models](https://arxiv.org/abs/2610.18697) | skimmed | 用 MoE 在同一框架里同时服务纯世界模型与 world-action 模型,探索“预测世界”与“输出动作”的共享骨干。 |
| P2 | WM-PAPER-037 | [Thinker-WM: A Unified World Model with Shared Multimodal Representations for Embodied Intelligence](https://arxiv.org/abs/2610.18447) | skimmed | 以共享多模态表征统一具身世界模型的理解、预测与行动,代表 2026 年“统一骨干”方向的另一条实现。 |
| P2 | WM-PAPER-038 | [UMI-WM: Interactive World Modeling for Bimanual Manipulation from Wrist Cameras](https://arxiv.org/abs/2610.23913) | skimmed | 仅用腕部相机做双臂操作的交互式世界建模,降低对全局视角与昂贵采集设备的依赖。 |
| P2 | WM-PAPER-039 | [JEPA4R: Embodied JEPA World Models with 4D Point Planning](https://arxiv.org/abs/2611.19771) | skimmed | 在单深度相机的点云潜空间中预测与规划,200 步平均点误差约 1.1 cm,并可直接解码想象结果。 |
| P2 | WM-PAPER-040 | [WA-JEPA: Goal-Aware Predictive Feedback Action Refinement for a World-Action Model](https://arxiv.org/abs/2611.19183) | skimmed | 先生成动作提案再预测未来,用目标差异残差与预测反馈迭代修正,避免代价高昂的候选动作搜索。 |
| P2 | WM-PAPER-041 | [OnlyAct: Extracting Action Representations from Foundation Models for World Models](https://arxiv.org/abs/2611.14420) | skimmed | 从基础模型中抽取动作表征供给世界模型,回应“动作数据稀缺、动作空间不统一”的核心瓶颈。 |
| P2 | WM-PAPER-042 | [V-JEPA-LM: Video-Language Models That Read Dynamics Beyond Static, Text-Aligned Representations](https://arxiv.org/abs/2611.17831) | skimmed | 指出纯文本对齐的视频表征会丢失动力学,主张用 JEPA 式预测表征补足“世界如何变化”的信息。 |
| P2 | WM-PAPER-043 | [EviBridge: Encoding Predictive Visual Evidence for Proactive Interaction](https://arxiv.org/abs/2611.20916) | skimmed | 把预测性视觉证据编码进主动交互,代表世界模型从“被动预测”走向“何时该行动/询问”的趋势。 |
| P2 | WM-PAPER-044 | [ALPS: Visual State Encoders for World Models](https://arxiv.org/abs/2610.30120) | skimmed | 专门研究世界模型的视觉状态编码器,说明“编码什么”与“如何预测”同等重要。 |
| P2 | WM-PAPER-045 | [Beyond Geometric Closure: Measuring and Diagnosing Mechanical Consistency in Visual Dynamics](https://arxiv.org/abs/2610.24619) | skimmed | 超越几何闭合,直接度量视觉动力学中的机械一致性,补足现有视频指标对接触/受力不敏感的问题。 |
| P2 | WM-PAPER-046 | [One Verdict Is Not Enough: Regression Testing Learned World Models and Their Test Harnesses](https://arxiv.org/abs/2610.41130) | skimmed | 单一结论不足以判断世界模型好坏,需要对模型与其评测工具做回归测试,警惕评测本身的方差与漂移。 |
| P2 | WM-PAPER-047 | [Learning from Next-Frame Prediction: Towards Unified and Scalable Visual World Modeling](https://arxiv.org/abs/2610.30724) | skimmed | 重新审视下一帧预测作为统一、可扩展的视觉世界建模目标,回应“预测目标是否足够”的基础问题。 |

## 全部资源

### 3D / 场景表示

| ID | 年份 | 标题 | 类型 | 状态 | 置信度 | 摘要 |
| --- | --- | --- | --- | --- | --- | --- |
| WM-BLOG-002 | 2026 | [Atlas: A World Model for Spatial Intelligence](https://www.worldlabs.ai/blog/atlas) · [笔记](notes/note-WM-BLOG-002-atlas.md) | 博客 | read | B | 多模态自回归扩散 Transformer,把图像/深度/相机位姿锚定在 3D 空间上下文中,统一生成、重建与时空模拟。 |
| WM-PAPER-022 | 2026 | [HY-World 2.0: A Multi-Modal World Model for Reconstructing, Generating, and Simulating 3D Worlds](https://arxiv.org/abs/2604.14268) | 论文 | skimmed | B | 腾讯混元把重建、生成、模拟 3D 世界统一到多模态世界模型,是从 2D 视频走向显式 3D 的代表路线。 |
| WM-PAPER-035 | 2026 | [AEON: Unifying Video and 3D World Models](https://arxiv.org/abs/2610.28631) | 论文 | skimmed | B | 尝试把视频世界模型与 3D 世界模型统一到同一框架,回应“渲染与模拟是否应共用表征”的核心争议。 |
| WM-BLOG-005 | 2025 | [Marble: A Multimodal World Model](https://www.worldlabs.ai/blog/marble-world-model) | 博客 | skimmed | B | 从文本/图像/视频生成可探索、可编辑的持久 3D 世界,输出 Gaussian splats;是 Atlas 的前代产品化形态。 |

### 自动驾驶

| ID | 年份 | 标题 | 类型 | 状态 | 置信度 | 摘要 |
| --- | --- | --- | --- | --- | --- | --- |
| WM-PAPER-023 | 2026 | [NVIDIA OmniDreams: Real-Time Generative World Model for Closed-Loop Autonomous Vehicle Simulation](https://arxiv.org/abs/2606.03159) | 论文 | skimmed | B | 从 Cosmos 中级/后训练出实时动作条件视频模型,用 2.1 万小时驾驶场景做闭环 AV 仿真,弥补重建式神经模拟器的泛化短板。 |
| WM-BLOG-009 | 2025 | [GAIA-2: Pushing the Boundaries of Video Generative Models for Safer Assisted and Automated Driving](https://wayve.ai/thinking/gaia-2/) | 博客 | read | A | 以自车动作、环境、道路语义为条件生成多相机一致驾驶视频,覆盖英美德地理多样性并支持插入动态智能体。 |
| WM-PAPER-011 | 2025 | [GAIA-2: A Controllable Multi-View Generative World Model for Autonomous Driving](https://arxiv.org/abs/2503.20523) | 论文 | skimmed | A | 以自车动力学、智能体配置、环境与道路语义为结构化条件,生成多相机时空一致的驾驶视频。 |

### 具身智能

| ID | 年份 | 标题 | 类型 | 状态 | 置信度 | 摘要 |
| --- | --- | --- | --- | --- | --- | --- |
| WM-BLOG-004 | 2026 | [Building Worlds That Train Robots: Real-to-Sim-to-Real](https://www.worldlabs.ai/blog/real-to-sim-to-real) | 博客 | skimmed | B | 声称仅用仿真数据训练的策略可跨机器人/任务迁移,且仿真评测能预测真机相对表现与失败区域;需要独立复现验证。 |
| WM-PAPER-014 | 2026 | [GE-Sim 2.0: A Roadmap Towards Comprehensive Closed-loop Video World Simulators for Robotic Manipulation](https://arxiv.org/abs/2605.27491) | 论文 | skimmed | B | 在数千小时真机数据上重训动作条件视频模拟器,并加入状态专家与世界裁判,把视频生成接进策略学习闭环。 |
| WM-PAPER-038 | 2026 | [UMI-WM: Interactive World Modeling for Bimanual Manipulation from Wrist Cameras](https://arxiv.org/abs/2610.23913) | 论文 | skimmed | B | 仅用腕部相机做双臂操作的交互式世界建模,降低对全局视角与昂贵采集设备的依赖。 |
| WM-PAPER-012 | 2025 | [SIMA 2: A Generalist Embodied Agent for Virtual Worlds](https://arxiv.org/abs/2512.04797) | 论文 | skimmed | A | 基于 Gemini 的通用具身智能体,在多种 3D 虚拟世界中理解高层目标、对话与图像指令,并泛化到未见环境。 |

### 评测与基准

| ID | 年份 | 标题 | 类型 | 状态 | 置信度 | 摘要 |
| --- | --- | --- | --- | --- | --- | --- |
| WM-BENCH-002 | 2026 | [WorldArena 2.0: Extending Embodied World Model Benchmarking on Modality, Functionality and Platform](https://arxiv.org/abs/2605.17912) | 基准 | skimmed | B | 2026 年具身世界模型的主基准之一,从模态、功能与平台三个维度扩展评测;GreenWAM 等在此报告结果。 |
| WM-BENCH-003 | 2026 | [WMEval: Evaluating Interactive World Models Grounded on Physical Simulations](https://arxiv.org/abs/2610.33894) | 基准 | skimmed | B | 以物理仿真为真值评估交互式世界模型,直接针对“交互后状态是否物理正确”这一核心能力。 |
| WM-BENCH-004 | 2026 | [The Flip Test: Video World Models Fail to Learn the World State](https://arxiv.org/abs/2611.19822) · [笔记](notes/note-WM-BENCH-004-fliptest.md) | 基准 | read | B | 用视觉最小对与密集扫描检验模型是否跟踪世界状态;11 个视频世界模型全部失败,最佳仅 18.3% 配对准确率。 |
| WM-BENCH-005 | 2026 | [SciWorldBench: Do Video World Models Really Understand Scientific Experiments?](https://arxiv.org/abs/2611.20899) | 基准 | skimmed | B | 用科学实验场景检验视频世界模型是否理解因果与实验逻辑,而非仅拟合视觉外观。 |
| WM-PAPER-025 | 2026 | [Prediction or Persistence? What Future-Prediction Scores Miss About World Models](https://arxiv.org/abs/2611.15082) | 论文 | skimmed | B | 未来预测分数混合了编码器质量、近期持续性与预测器贡献;用配对持续性控制才能分离出真正的预测能力。 |
| WM-PAPER-026 | 2026 | [Recovered or Memorized? Investigating Dynamical Consistency and Faithfulness in World Model Latents](https://arxiv.org/abs/2611.18807) | 论文 | skimmed | B | 提出 Anchored Recovery Certification,用离散 Fréchet 距离与干预子空间检验潜变量是否真的忠实于环境动力学,而不只是可解码。 |
| WM-PAPER-032 | 2026 | [VERDI: Verified Contradictions for Continual World-Model Optimization](https://arxiv.org/abs/2608.09537) | 论文 | skimmed | B | 把跨模型迁移的优化策略视为假设而非配方,只有在目标模型上实验验证过的矛盾才升级为可复用知识。 |
| WM-PAPER-045 | 2026 | [Beyond Geometric Closure: Measuring and Diagnosing Mechanical Consistency in Visual Dynamics](https://arxiv.org/abs/2610.24619) | 论文 | skimmed | B | 超越几何闭合,直接度量视觉动力学中的机械一致性,补足现有视频指标对接触/受力不敏感的问题。 |
| WM-PAPER-046 | 2026 | [One Verdict Is Not Enough: Regression Testing Learned World Models and Their Test Harnesses](https://arxiv.org/abs/2610.41130) | 论文 | skimmed | B | 单一结论不足以判断世界模型好坏,需要对模型与其评测工具做回归测试,警惕评测本身的方差与漂移。 |
| WM-BENCH-001 | 2025 | [WorldModelBench: Judging Video Generation Models As World Models](https://arxiv.org/abs/2502.20694) | 基准 | skimmed | B | 从指令遵循与物理合理性两个维度评判视频生成模型作为世界模型的能力,是最早的系统性基准之一。 |

### 基础与综述

| ID | 年份 | 标题 | 类型 | 状态 | 置信度 | 摘要 |
| --- | --- | --- | --- | --- | --- | --- |
| WM-BLOG-001 | 2026 | [A Functional Taxonomy of World Models: Renderers, Simulators, Planners, and the Loop That Connects Them](https://www.worldlabs.ai/blog/taxonomy-of-world-models) · [笔记](notes/note-WM-BLOG-001-taxonomy.md) | 博客 | read | B | 把世界模型拆成渲染器、模拟器、规划器三种功能投影,并论证模拟器是把世界变成可行动场所的关键。 |
| WM-PAPER-027 | 2026 | [World Models Need a Physical Registry: Learning Internal Predictive States for Physically Plausible World Models](https://arxiv.org/abs/2610.16365) · [笔记](notes/note-WM-PAPER-027-physical-registry.md) | 论文 | read | B | 主张世界模型需要显式的内部物理状态注册表来维持对象永久性与物理合理性,与本项目持久世界状态的思路高度一致。 |
| WM-PAPER-001 | 2018 | [World Models](https://arxiv.org/abs/1803.10122) · [笔记](notes/note-WM-PAPER-001-world-models-2018.md) | 论文 | read | A | 确立 V-M-C 范式:视觉压缩、循环动力学、控制器分离;今天大多数路线仍可追溯到这个分解。 |

### 交互式世界模型

| ID | 年份 | 标题 | 类型 | 状态 | 置信度 | 摘要 |
| --- | --- | --- | --- | --- | --- | --- |
| WM-BLOG-003 | 2026 | [Frameboy: Atlas in Real-time](https://www.worldlabs.ai/blog/atlas-realtime) | 博客 | skimmed | B | 把 Atlas 优化到云端 GPU 流式 15 fps,用实时相机控制探索;证明交互延迟下降会改变创作范式而非仅仅提速。 |
| WM-PAPER-021 | 2026 | [DreamX-World 1.0: A General-Purpose Interactive World Model](https://arxiv.org/abs/2606.16993) | 论文 | skimmed | B | 通用交互式文/图生视频世界模型,支持相机导航、重访旧区域与可提示事件,并用 E-PRoPE 做相机几何控制。 |
| WM-PAPER-024 | 2026 | [Interactive World Simulation with Cosmos for Physical AI](https://arxiv.org/abs/2611.06627) | 论文 | skimmed | B | 统一框架把 Cosmos 适配为实时交互模拟:既能预测动作的视觉后果,也能从外部物理引擎维护的状态生成观测。 |
| WM-PAPER-030 | 2026 | [GameWM: Toward Next-Generation Video Games with Interaction-Centric World Models](https://arxiv.org/abs/2611.19247) | 论文 | skimmed | B | 让游戏引擎保留规则、状态、相机与世界布局,视频模型只生成昂贵的手工内容,是混合架构的清晰分工范式。 |
| WM-PAPER-031 | 2026 | [Old Is Not False: Valid-Time Memory for Interactive Video World Models](https://arxiv.org/abs/2611.00758) | 论文 | skimmed | B | 区分“过时”与“错误”,为交互视频世界模型引入有效时间记忆,避免旧观测被简单丢弃或错误覆盖。 |
| WM-PAPER-033 | 2026 | [Causal-rCM: A Unified Teacher-Forcing and Self-Forcing Open Recipe for Autoregressive Diffusion Distillation in Streaming Video Generation and Interactive World Models](https://arxiv.org/abs/2606.25473) | 论文 | skimmed | B | 把 teacher-forcing 与 self-forcing 统一为自回归扩散蒸馏配方,直接面向流式视频与交互世界模型的实时化。 |
| WM-PAPER-043 | 2026 | [EviBridge: Encoding Predictive Visual Evidence for Proactive Interaction](https://arxiv.org/abs/2611.20916) | 论文 | skimmed | B | 把预测性视觉证据编码进主动交互,代表世界模型从“被动预测”走向“何时该行动/询问”的趋势。 |
| WM-BLOG-006 | 2025 | [RTFM: A Real-Time Frame Model](https://www.worldlabs.ai/blog/rtfm) | 博客 | skimmed | B | 轻量实时帧生成模型,用持久 3D 上下文缓存支持交互式新视角合成,是 Atlas/Frameboy 的技术前身。 |
| WM-BLOG-007 | 2025 | [Genie 3: A New Frontier for World Models](https://deepmind.google/discover/blog/genie-3-a-new-frontier-for-world-models/) | 博客 | skimmed | C | 据官方博客,720p/24fps 实时可交互世界模型,可维持数分钟一致性并支持可提示世界事件;本次环境无法直接访问原页。 |
| WM-PAPER-020 | 2025 | [WorldPlay: Towards Long-Term Geometric Consistency for Real-Time Interactive World Modeling](https://arxiv.org/abs/2512.14614) | 论文 | skimmed | B | 用双动作表示、重构式上下文记忆与 Context Forcing 蒸馏,在实时流式生成中维持长期几何一致性。 |
| WM-PAPER-005 | 2024 | [Genie: Generative Interactive Environments](https://arxiv.org/abs/2402.15391) · [笔记](notes/note-WM-PAPER-005-genie.md) | 论文 | read | A | 首个仅用无标注互联网视频训练的生成式可交互环境;潜在动作模型让无动作标签视频变成可控世界。 |

### 潜空间预测 (JEPA)

| ID | 年份 | 标题 | 类型 | 状态 | 置信度 | 摘要 |
| --- | --- | --- | --- | --- | --- | --- |
| WM-PAPER-028 | 2026 | [Frame First, Decode Once: Object-Centric Coordinates and Single-Pass Decoding for System-1 World Models](https://arxiv.org/abs/2611.18761) | 论文 | skimmed | B | 在物体初始位姿的 SE(2) 坐标系中表达输入输出,把候选动作排序的决策遗憾降低 1.9-2.2 倍,验证了物体中心坐标的价值。 |
| WM-PAPER-029 | 2026 | [The Sense Paradigm for World Models](https://arxiv.org/abs/2611.19796) | 论文 | skimmed | B | 用有向距离上的单交叉熵损失替代目标网络/方差惩罚,使潜空间距离有语义并能区分可逆与不可逆转移。 |
| WM-PAPER-034 | 2026 | [Reconstruction or Semantics? What Makes a Latent Space Useful for Robotic World Models](https://arxiv.org/abs/2605.06388) | 论文 | skimmed | B | 在固定协议下比较六种重建/语义编码器,发现高维语义潜空间也能有效训练动作条件世界模型,挑战“必须重建像素”的默认假设。 |
| WM-PAPER-039 | 2026 | [JEPA4R: Embodied JEPA World Models with 4D Point Planning](https://arxiv.org/abs/2611.19771) | 论文 | skimmed | B | 在单深度相机的点云潜空间中预测与规划,200 步平均点误差约 1.1 cm,并可直接解码想象结果。 |
| WM-PAPER-042 | 2026 | [V-JEPA-LM: Video-Language Models That Read Dynamics Beyond Static, Text-Aligned Representations](https://arxiv.org/abs/2611.17831) | 论文 | skimmed | B | 指出纯文本对齐的视频表征会丢失动力学,主张用 JEPA 式预测表征补足“世界如何变化”的信息。 |
| WM-PAPER-044 | 2026 | [ALPS: Visual State Encoders for World Models](https://arxiv.org/abs/2610.30120) | 论文 | skimmed | B | 专门研究世界模型的视觉状态编码器,说明“编码什么”与“如何预测”同等重要。 |
| WM-PAPER-047 | 2026 | [Learning from Next-Frame Prediction: Towards Unified and Scalable Visual World Modeling](https://arxiv.org/abs/2610.30724) | 论文 | skimmed | B | 重新审视下一帧预测作为统一、可扩展的视觉世界建模目标,回应“预测目标是否足够”的基础问题。 |
| WM-PAPER-006 | 2025 | [V-JEPA 2: Self-Supervised Video Models Enable Understanding, Prediction and Planning](https://arxiv.org/abs/2506.09985) · [笔记](notes/note-WM-PAPER-006-vjepa2.md) | 论文 | read | A | 100 万小时视频预训练 + 少量机器人轨迹后训练,证明潜空间预测可直接支撑零样本抓取与规划。 |
| WM-PAPER-004 | 2024 | [DINO-WM: World Models on Pre-trained Visual Features enable Zero-shot Planning](https://arxiv.org/abs/2411.04983) | 论文 | skimmed | A | 冻结 DINOv2 特征上学习动力学即可零样本规划,说明高质量语义表征能显著降低世界模型的学习难度。 |

### 模型基强化学习

| ID | 年份 | 标题 | 类型 | 状态 | 置信度 | 摘要 |
| --- | --- | --- | --- | --- | --- | --- |
| WM-PAPER-007 | 2025 | [Training Agents Inside of Scalable World Models](https://arxiv.org/abs/2509.24527) · [笔记](notes/note-WM-PAPER-007-dreamer4.md) | 论文 | read | A | Dreamer 4 用高效 Transformer 与 shortcut forcing 在单卡实时想象,仅凭离线数据在 Minecraft 学会挖钻石。 |
| WM-PAPER-002 | 2023 | [Mastering Diverse Domains through World Models](https://arxiv.org/abs/2301.04104) · [笔记](notes/note-WM-PAPER-002-dreamerv3.md) | 论文 | read | A | 用一套超参在 150+ 任务上稳定训练,证明潜空间想象可以跨域;RSSM 仍是小算力团队最可靠的基线。 |
| WM-PAPER-003 | 2023 | [TD-MPC2: Scalable, Robust World Models for Continuous Control](https://arxiv.org/abs/2310.16828) | 论文 | skimmed | A | 无解码器的隐式世界模型 + 局部轨迹优化,单套超参覆盖 104 个任务,并展示 317M 参数多任务扩展性。 |

### 综述

| ID | 年份 | 标题 | 类型 | 状态 | 置信度 | 摘要 |
| --- | --- | --- | --- | --- | --- | --- |
| WM-SURVEY-001 | 2026 | [World Models: A Comprehensive Survey of Architectures, Methodologies, Reasoning Paradigms, and Applications](https://arxiv.org/abs/2606.00133) | 综述 | skimmed | B | 2026 年最系统的世界模型综述,按架构、方法族、推理范式与应用四轴分类,适合作为全景入口。 |

### 视频生成式

| ID | 年份 | 标题 | 类型 | 状态 | 置信度 | 摘要 |
| --- | --- | --- | --- | --- | --- | --- |
| WM-BLOG-008 | 2025 | [NVIDIA Makes Cosmos World Foundation Models Openly Available to Physical AI Developers](https://blogs.nvidia.com/blog/cosmos-world-foundation-models/) | 博客 | read | A | 公开 Cosmos 权重与数据管线:2000 万小时、9000 万亿 token 训练,4-14B 参数,提供 Nano/Super/Ultra 三档。 |
| WM-BLOG-010 | 2025 | [Sora 2](https://openai.com/index/sora-2/) | 博客 | skimmed | C | 据发布信息,视频生成加入同步音频与更强物理/可控性,仍以离线内容生成为主;本环境无法直接访问原页。 |
| WM-PAPER-008 | 2025 | [Cosmos World Foundation Model Platform for Physical AI](https://arxiv.org/abs/2501.03575) | 论文 | skimmed | A | 把世界基础模型做成平台:数据治理、视频 tokenizer、预训练模型与后训练配方,并开源权重。 |
| WM-PAPER-009 | 2025 | [World Simulation with Video Foundation Models for Physical AI](https://arxiv.org/abs/2511.00062) | 论文 | skimmed | A | Cosmos-Predict2.5 用流匹配统一 Text/Image/Video2World,2B/14B 两档,并用 RL 后训练提升指令对齐。 |

### 世界-动作模型 (WAM)

| ID | 年份 | 标题 | 类型 | 状态 | 置信度 | 摘要 |
| --- | --- | --- | --- | --- | --- | --- |
| WM-PAPER-010 | 2026 | [Cosmos 3: Omnimodal World Models for Physical AI](https://arxiv.org/abs/2606.02800) · [笔记](notes/note-WM-PAPER-010-cosmos3.md) | 论文 | read | B | 用统一 mixture-of-transformers 同时处理语言、图像、视频、音频、动作,试图把 VLM、视频生成、世界模拟与 WAM 合并成一个骨干。 |
| WM-PAPER-015 | 2026 | [GE-Act 2.0: Pretraining and Scaling a World-Action Model for Robotic Manipulation](https://arxiv.org/abs/2609.05588) | 论文 | skimmed | B | 从零在操作数据上预训练 WAM,用控制导向自编码器 + 单步视觉规划器 + 逆动力学模型,挑战继承视频生成器的惯例。 |
| WM-PAPER-016 | 2026 | [InternW0: A Foundational Physical World Model for Efficient Real-World Interactions](https://arxiv.org/abs/2609.27656) | 论文 | skimmed | B | 异步多频架构:重型视频专家做长时程预测,轻量动作专家高频输出,强调部分可观测下的局部物理建模。 |
| WM-PAPER-017 | 2026 | [Magic-W0: A Structured World-Action Foundation Model for Physical Intelligence](https://arxiv.org/abs/2609.39870) | 论文 | skimmed | B | 把交互显式表示为当前状态、转移、未来状态三段式,用 3D 运动作为动作引起的结构化转移表征。 |
| WM-PAPER-018 | 2026 | [GreenWAM: A World Foundation Model for Robotics](https://arxiv.org/abs/2610.18774) | 论文 | skimmed | B | 用统一解剖动作空间覆盖 20 种机器人,同一模型兼顾世界模型与策略,并在 WorldArena 1.0 上取得领先。 |
| WM-PAPER-019 | 2026 | [LaST0.5: A Generalist World Action Model with Interaction-Centric Latent Reasoning](https://arxiv.org/abs/2611.14048) | 论文 | skimmed | B | 指出全局场景表征会淹没局部机器人-物体交互,提出以交互为中心的中间物理表征来桥接世界建模与动作生成。 |
| WM-PAPER-036 | 2026 | [UniW(A)M: A Unified Mixture-of-Experts Framework for World and World-Action Models](https://arxiv.org/abs/2610.18697) | 论文 | skimmed | B | 用 MoE 在同一框架里同时服务纯世界模型与 world-action 模型,探索“预测世界”与“输出动作”的共享骨干。 |
| WM-PAPER-037 | 2026 | [Thinker-WM: A Unified World Model with Shared Multimodal Representations for Embodied Intelligence](https://arxiv.org/abs/2610.18447) | 论文 | skimmed | B | 以共享多模态表征统一具身世界模型的理解、预测与行动,代表 2026 年“统一骨干”方向的另一条实现。 |
| WM-PAPER-040 | 2026 | [WA-JEPA: Goal-Aware Predictive Feedback Action Refinement for a World-Action Model](https://arxiv.org/abs/2611.19183) | 论文 | skimmed | B | 先生成动作提案再预测未来,用目标差异残差与预测反馈迭代修正,避免代价高昂的候选动作搜索。 |
| WM-PAPER-041 | 2026 | [OnlyAct: Extracting Action Representations from Foundation Models for World Models](https://arxiv.org/abs/2611.14420) | 论文 | skimmed | B | 从基础模型中抽取动作表征供给世界模型,回应“动作数据稀缺、动作空间不统一”的核心瓶颈。 |
| WM-PAPER-013 | 2025 | [Genie Envisioner: A Unified World Foundation Platform for Robotic Manipulation](https://arxiv.org/abs/2508.05635) | 论文 | skimmed | B | 面向机器人操作的世界基础平台,把指令条件视频生成、策略学习与评测串成闭环,是中国团队的代表性路线。 |
