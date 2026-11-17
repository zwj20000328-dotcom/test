# 阅读队列

> 人工维护的优先级。`INDEX.md` 的“阅读队列”从 catalog 的 `status` 自动生成；本文件解释**为什么**按这个顺序读。

## P0：现在必读（建立问题意识与方案判断）

| 顺序 | 资源 | 为什么现在读 | 读完应能回答 |
| --- | --- | --- | --- |
| 1 | [FlipTest](https://arxiv.org/abs/2611.19822)（WM-BENCH-004） | 定义“世界模型失败”的最强证据 | 为什么视频模型不会跟踪状态？ |
| 2 | [World Labs Taxonomy](notes/note-WM-BLOG-001-taxonomy.md) | 统一术语：renderer/simulator/planner | 我们的方案属于哪一层？ |
| 3 | [Physical Registry](notes/note-WM-PAPER-027-physical-registry.md) | 最接近我们“显式状态”的学术工作 | 状态槽与 WSG 的差异？ |
| 4 | [V-JEPA 2](notes/note-WM-PAPER-006-vjepa2.md) | 潜空间预测的最成熟基线 | 冻结编码器能走多远？ |
| 5 | [Cosmos 3](notes/note-WM-PAPER-010-cosmos3.md) | 最强的开放全模态骨干 | 哪些能力可以直接复用？ |
| 6 | [Atlas](notes/note-WM-BLOG-002-atlas.md) | spatial context 与实时交互的产品标杆 | 空间状态与语义状态如何互补？ |
| 7 | [2026 综述](https://arxiv.org/abs/2606.00133)（WM-SURVEY-001） | 全景分类与术语校准 | 我们的工作在分类树中的位置？ |
| 8 | [Prediction or Persistence](https://arxiv.org/abs/2611.15082)（WM-PAPER-025） | 拆解“预测分数”的方法论 | 如何证明不是复制过去？ |
| 9 | [GE-Act 2.0](https://arxiv.org/abs/2609.05588) / [GE-Sim 2.0](https://arxiv.org/abs/2605.27491)（WM-PAPER-015/014） | WAM + 闭环仿真的中国团队完整栈 | 状态专家/世界裁判能否借鉴？ |
| 10 | [Dreamer 4](notes/note-WM-PAPER-007-dreamer4.md) | 小算力实时想象的可行性 | shortcut forcing 能否用于分支 rollout？ |

## P1：两周内（方案与评测细化）

| 资源 | 目的 |
| --- | --- |
| WorldArena 2.0、WMEval、SciWorldBench | 设计 S1–S5 测试套件 |
| GameWM、Old Is Not False、WorldPlay | 混合架构、记忆、实时一致性 |
| GreenWAM、InternW0、Magic-W0 | WAM 架构与动作空间 |
| HY-World 2.0、Marble、RTFM、Frameboy | 3D 后端与实时渲染 |
| OmniDreams、GAIA-2 | 闭环仿真与多相机条件 |
| Genie（原论文）、DreamerV3、TD-MPC2、DINO-WM | 基线复现 |

## P2：按需（扩展与消融）

- **结构化/变化优先**：ResWAM、LaST0.5、Frame First、Magic-W0
- **JEPA 前沿**：JEPA4R、WA-JEPA、Sense、V-JEPA-LM、ALPS、Reconstruction or Semantics
- **评测方法**：ARC、One Verdict Is Not Enough、Beyond Geometric Closure、VERDI
- **实时/蒸馏**：Causal-rCM、WorldPlay、DreamX-World
- **统一骨干**：UniW(A)M、Thinker-WM、AEON、UMI-WM、SWAM

## 阅读方法

| 类型 | 时间 | 产出 |
| --- | --- | --- |
| 泛读 | 10–15 分钟 | 摘要/图表/结论；更新 catalog 的 `status: skimmed` 与一句话 summary |
| 精读 | 45–90 分钟 | 结构化笔记（结论/方法/结果/局限/启示） |
| 复现 | 半天–数天 | 代码/实验记录；更新评测基线 |

规则：

- 读之前先看 catalog 里是否已有笔记；
- 笔记里必须写“对我们项目的启示”，否则不算读完；
- 关键数字标出处；不能核实的降置信度；
- 读完把 `status` 从 `inbox`/`skimmed` 推进到 `read`/`verified`。

## 本月目标

- 完成 P0 10 篇的精读与笔记（已具备 10 篇笔记，需补 FlipTest/GE 系列的全文细节）；
- 完成 P1 中评测三篇的对比表；
- 把 P0 的待核实项处理到只剩网络不可达项。
