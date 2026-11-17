# Dreamer 4 (2025)

## 元信息

- **ID**：WM-PAPER-007
- **标题**：Training Agents Inside of Scalable World Models
- **作者/机构**：Danijar Hafner et al.
- **发表时间**：2025-09-29
- **来源**：[arXiv:2509.24527](https://arxiv.org/abs/2509.24527)
- **阅读日期**：2026-11-17
- **阅读状态**：read
- **置信度**：A

## 一句话结论

用高效 Transformer 世界模型 + shortcut forcing，在单 GPU 上实时想象；仅凭离线数据在 Minecraft 学会挖钻石。

## 它解决什么问题

- 以往世界模型在复杂环境中的对象交互预测不准，难以支撑想象训练。
- 本文的切入点：可扩展 Transformer + 快速生成目标，让世界模型既准又实时。
- 不解决：开放域、多任务、无奖励学习。

## 方法

- **世界模型**：Transformer 动力学，预测未来表征/观测。
- **Shortcut forcing**：训练模型在少步内生成未来，支持实时交互。
- **想象 RL**：在模型中展开轨迹，优化策略；不需要真实环境交互。
- **数据**：Minecraft 离线视频/轨迹。
- **推理**：单 GPU 实时。

## 关键结果

- Minecraft 对象交互与游戏机制预测大幅超前作。
- 首个仅用离线数据在 Minecraft 获得钻石的智能体（论文声明）。
- 实时交互想象。

## 局限与可疑之处

- 领域特定（Minecraft）；奖励/任务设计。
- 视觉复杂度仍有限；真实世界泛化未验证。
- 离线数据的覆盖决定上限。
- 没有语言/语义状态与可编辑性。

## 对我们项目的启示

- **shortcut forcing 可用于我们的快速 rollout**：分支/what-if 需要大量短 rollout，速度是关键。
- 证明“小团队 + 单卡”也能做有意义的世界模型研究。
- 但 Dreamer 4 的世界是任务内部的；我们需要把它外化为 WSG，才能做叙事/编辑。
- 想象 RL 可作为 Phase 3 的分支评分器。

## 关联资源

- 前作：[DreamerV3](note-WM-PAPER-002-dreamerv3.md)
- 对比：[TD-MPC2](https://arxiv.org/abs/2310.16828)
- 相关：[WorldPlay](https://arxiv.org/abs/2512.14614)（实时一致性）
