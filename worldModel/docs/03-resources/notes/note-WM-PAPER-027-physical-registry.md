# World Models Need a Physical Registry (2026)

## 元信息

- **ID**：WM-PAPER-027
- **标题**：World Models Need a Physical Registry: Learning Internal Predictive States for Physically Plausible World Models
- **作者/机构**：arXiv（作者待核）
- **发表时间**：2026-10-12
- **来源**：[arXiv:2610.16365](https://arxiv.org/abs/2610.16365)
- **阅读日期**：2026-11-17
- **阅读状态**：read（摘要）
- **置信度**：B

## 一句话结论

在视频 DiT 内部加入“时间上接地的 registry slots”，给预测动力学一个独立、可读的内部状态，而不是让外观与动力学混在视频 token 里。

## 它解决什么问题

- 现有视频世界模型用语义/物理/预测信息引导生成，但没有明确“场景演化的预测应该住在哪里”。
- 视频 token 同时编码外观与动力学，缺少可读的状态。
- 本文的切入点：显式的 Physical Registry slots，从观测条件初始化，随时间更新。

## 方法

- 在视频 DiT 中加入 registry slots；
- slots 由观测条件初始化，并在时间上接地（temporally grounded）；
- 生成时读取 slots 作为物理状态；
- 用物理合理性目标监督。

## 关键结果

- 摘要声称提升物理合理性（具体数字需读全文）。
- 提供了“状态槽”这一架构范式。

## 局限与可疑之处

- 仍是视频生成模型，不是可编辑/可回滚的系统级状态。
- slots 的语义可解释性、监督方式、规模化未验证。
- 物理正确性可能仍受渲染目标牵制。

## 对我们项目的启示

- **最接近 PWM 的学术工作**：证明“状态应独立于外观 token”这一判断。
- 我们的差异化：把状态槽提升为系统级 WSG，加入关系/事件/canon/分支/验证；Physical Registry 可作为 LDE 的内部实现参考。
- 应作为核心 related work 与消融基线：有/无显式状态槽。

## 关联资源

- 对比：[GameWM](https://arxiv.org/abs/2611.19247)、[Frame First](https://arxiv.org/abs/2611.18761)
- 设计：[PWM WSG](../../02-design/02-architecture.md)
- 评测：[FlipTest](note-WM-BENCH-004-fliptest.md)
