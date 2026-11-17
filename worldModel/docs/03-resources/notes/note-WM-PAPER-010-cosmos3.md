# Cosmos 3 (2026)

## 元信息

- **ID**：WM-PAPER-010
- **标题**：Cosmos 3: Omnimodal World Models for Physical AI
- **作者/机构**：NVIDIA
- **发表时间**：2026-06-23
- **来源**：[arXiv:2606.02800](https://arxiv.org/abs/2606.02800)
- **阅读日期**：2026-11-17
- **阅读状态**：read（摘要 + 生态）
- **置信度**：B

## 一句话结论

用统一 mixture-of-transformers 同时处理语言、图像、视频、音频与动作，试图把 VLM、视频生成器、世界模拟器与 WAM 收进一个骨干。

## 它解决什么问题

- 物理 AI 的模型碎片化：理解、生成、模拟、策略各一套。
- 本文的切入点：统一模态序列 + MoT，让同一骨干支持多种输入输出配置。
- 不解决：物理精确性、长时程闭环、数据许可。

## 方法

- **Mixture-of-Transformers**：不同模态/任务的专家，共享注意力/路由。
- **Omnimodal**：语言、图像、视频、音频、动作序列。
- **灵活 I/O**：任意模态 → 任意模态；后训练覆盖理解、生成、策略。
- **生态**：
  - Cosmos-Predict2.5：流匹配，200M 片段，2B/14B，RL 后训练。
  - Interactive Cosmos：实时交互，外部物理引擎状态驱动。
  - OmniDreams：2.1 万小时驾驶，闭环 AV。
  - Cosmos-H-Dreams：手术机器人。

## 关键结果

- 官方称在多样理解/生成任务上 SOTA。
- 后训练模型被 Artificial Analysis 评为最佳开源 T2I/I2V，被 RoboArena 评为最佳策略。
- 开源权重（部分）。

## 局限与可疑之处

- “统一”是否牺牲单模态性能，需要独立复现。
- 动作数据/跨本体覆盖未知。
- 物理精确性仍依赖数据与后训练。
- 许可证与商用限制需核对。

## 对我们项目的启示

- **首选开放骨干候选**：可作为渲染器/编码器/动力学起点，避免从头训练。
- “统一模态”与我们的“状态 + 可插拔渲染”不冲突：Cosmos 提供能力，我们提供状态/验证/叙事层。
- 需要评估其推理成本与微调接口；不要锁定单一供应商。
- 若 Cosmos 3 已支持动作条件，我们的 WAM 基线可直接用它。

## 关联资源

- 前作：[Cosmos WFMs](https://arxiv.org/abs/2501.03575)、[Cosmos-Predict2.5](https://arxiv.org/abs/2511.00062)
- 生态：[Interactive Cosmos](https://arxiv.org/abs/2611.06627)、[OmniDreams](https://arxiv.org/abs/2606.03159)
- 对比：[Atlas](note-WM-BLOG-002-atlas.md)
- 设计：[PWM 的渲染器抽象](../../02-design/01-proposal.md)
