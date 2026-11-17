# Atlas: A World Model for Spatial Intelligence (World Labs, 2026)

## 元信息

- **ID**：WM-BLOG-002
- **标题**：Atlas: A World Model for Spatial Intelligence
- **作者/机构**：World Labs
- **发表时间**：2026-09-01
- **来源**：[World Labs Blog](https://www.worldlabs.ai/blog/atlas)
- **阅读日期**：2026-11-17
- **阅读状态**：read
- **置信度**：B（官方博客，未独立复现）

## 一句话结论

多模态自回归扩散 Transformer，把每张图锚定在 3D 空间位置形成 spatial context；原生接受相机位姿与深度，统一生成、重建与时空模拟。

## 架构

- **Multimodal autoregressive diffusion transformer**；
- 输入：文本、图像、相机位姿、深度；视频 = 图像序列；
- 每张图/深度图条件于显式相机位姿；
- 输出：图像/视频、点云、3DGS；
- 类似 LLM 的 KV cache / 推理优化；扩散蒸馏。

## 能力

| 能力 | 规格 |
| --- | --- |
| 相机控制生成 | 1440p，最长 1 分钟；单图或多图输入 |
| 稀疏视图重建 | 1–100+ 图；官方称优于专用 SOTA |
| 3D 输出 | 点云、3DGS；可导出到工作流 |
| Real-to-Sim | 少量手机视频重建场景，生成机器人视角 RGB/深度 |
| 视频重定帧 | 3–5 相机视角的 bullet-time |
| 图像生成 | 文本/图像 → 图像、360 全景 |

## 关键判断

- 官方明确：Atlas 不是“更大的 RTFM”，而是从单图/文本从零生成场景。
- **Spatial context** 是核心：不是帧序列上下文，而是 3D 锚定的上下文。
- **Frameboy**（2026-11）：云端流式 15 fps，实时相机控制；官方说低延迟把“生成”变成“探索”。
- 性能随训练算力提升（scaling law 声明）。

## 局限与可疑之处

- 1 分钟视频仍是短片；动态/多智能体弱。
- 依赖相机位姿/深度；位姿误差会影响一致性。
- 实时需要强 GPU，成本高（官方承认“不便宜”）。
- 官方对比数字（如 3D 重建 AbsRel）需独立复现。
- 没有语义/叙事状态：不理解“角色知道什么”“剧情因果”。

## 对我们的启示

- **spatial context 是持久状态的一种实现**，但只覆盖空间，不覆盖对象关系/事件/canon。
- 可作为 PWM 的 3D 渲染后端/空间记忆后端。
- Frameboy 证明实时交互的产品价值；我们的 15 fps 目标可参考。
- 我们的差异化：在空间状态之上加语义/叙事状态与验证。

## 关联资源

- 前代：Marble、RTFM
- 相关：[Frameboy](https://www.worldlabs.ai/blog/atlas-realtime)、[R2S2R](https://www.worldlabs.ai/blog/real-to-sim-to-real)
- 对比：[Cosmos 3](note-WM-PAPER-010-cosmos3.md)
- 设计：[PWM 渲染器抽象](../../02-design/01-proposal.md)
