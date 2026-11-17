# A Functional Taxonomy of World Models (World Labs, 2026)

## 元信息

- **ID**：WM-BLOG-001
- **标题**：A Functional Taxonomy of World Models: Renderers, Simulators, Planners, and the Loop That Connects Them
- **作者/机构**：World Labs
- **发表时间**：2026-06-03
- **来源**：[World Labs Blog](https://www.worldlabs.ai/blog/taxonomy-of-world-models)
- **阅读日期**：2026-11-17
- **阅读状态**：read
- **置信度**：B

## 一句话结论

把“世界模型”拆成渲染器、模拟器、规划器三种功能投影；模拟器是把世界变成可行动场所的关键，三者正在融合。

## 核心论点

1. **术语过载**：视觉、机器人、RL、生成式 AI 都在说“世界模型”，但指的不是同一件事。
2. **POMDP 循环**：智能体 → 动作 → 状态 → 观测 → 智能体；不同系统输出循环的不同部分。
3. **三种功能**：
   - Renderer：输出像素，优化视觉保真；无显式 3D 理解。
   - Simulator：输出状态，优化几何/物理/动力学；服务人类与程序。
   - Planner：输出动作，优化任务成功；VLA/WAM 属于此类。
4. **模拟器是枢纽**：几何/物理/动力学是“世界本身”，渲染与规划都是它的投影。
5. **边界在坍塌**：渲染器接受动作，模拟器生成可编辑世界，规划器显式预测未来；终点是统一世界模型。
6. **开放问题**：3D/物理标注稀缺、sim-to-real gap、生成几何自交/尺度错误、多物理场昂贵。

## 对我们的启示

- **直接采用其三分法**作为调研框架，但在设计中增加“持久状态层”作为三者的共同基底。
- 它说“模拟器是枢纽”；我们说“状态是枢纽”——状态是模拟器的核心，也是渲染与规划的共同接口。
- 叙事垂直正好落在“renderer + simulator + planner”的交界：需要渲染镜头、模拟角色/场景状态、规划剧情/镜头。
- 该文是厂商立场（World Labs 卖 3D 世界），需警惕“3D 是唯一解”的偏向；视频/结构化路线同样有效。

## 关联资源

- 产品：[Atlas](note-WM-BLOG-002-atlas.md)、Marble、RTFM
- 设计：[PWM 方案](../../02-design/01-proposal.md)
- 调研：[全景报告](../../01-research/01-landscape.md)
