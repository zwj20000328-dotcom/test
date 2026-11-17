# DreamerV3 (2023 / Nature 2025)

## 元信息

- **ID**：WM-PAPER-002
- **标题**：Mastering Diverse Domains through World Models
- **作者/机构**：Danijar Hafner et al.
- **发表时间**：2023-01-10（arXiv）；2025 年 Nature 发表
- **来源**：[arXiv:2301.04104](https://arxiv.org/abs/2301.04104)
- **阅读日期**：2026-11-17
- **阅读状态**：read
- **置信度**：A

## 一句话结论

用一套超参在 150+ 个差异极大的任务上稳定训练，证明“潜空间想象 + 稳健归一化”可以成为通用模型基 RL 算法。

## 它解决什么问题

- 模型基 RL 通常需要针对每个领域调参，难以通用。
- 本文的切入点：鲁棒归一化、KL 平衡、free bits、symlog/two-hot 等技术，让单一配置跨域稳定。
- 不解决：开放世界、无奖励任务、高维视觉生成。

## 方法

- **RSSM**：循环状态空间模型，离散 categorical latent + 确定性隐藏状态。
- **想象训练**：在潜空间展开短轨迹，用 actor-critic 优化。
- **稳健性技巧**：
  - symlog 变换压缩大范围数值；
  - two-hot 编码回报；
  - return normalization；
  - KL balancing + free bits；
  - LayerNorm/百分比归一化。
- **实验**：150+ 任务，包括 Atari、DMC、Minecraft、机器人。

## 关键结果

- 单一配置在 150+ 任务上超过专用方法或与之相当。
- 在 Minecraft 钻石任务上，无需人类数据即可从零学习。
- 证明“世界模型 + 想象”在多样域上可行。

## 局限与可疑之处

- 仍是任务特定训练（需要奖励/交互）。
- 视觉复杂度有限；高分辨率、开放域弱。
- RSSM 的循环结构在长时程上仍有误差累积。
- 没有语言/语义状态。

## 对我们项目的启示

- **工程基线首选**：单机可跑、稳定、文档好。
- RSSM 的归一化技巧可直接用于我们的动力学训练。
- 但 Dreamer 的“世界模型”是任务内部状态，不是可编辑/可验证的世界状态；我们需要在其上加 WSG。
- 想象 RL 可用于 Phase 3 的镜头/分支优化。

## 关联资源

- 前作：[World Models (2018)](note-WM-PAPER-001-world-models-2018.md)
- 后续：[Dreamer 4](note-WM-PAPER-007-dreamer4.md)
- 对比：[TD-MPC2](https://arxiv.org/abs/2310.16828)
