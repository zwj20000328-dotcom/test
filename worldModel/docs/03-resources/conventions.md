# 资源管理规范

本目录管理项目的外部资料（论文、博客、代码、基准、数据集）与内部文档。目标是让任何人（包括未来的我们）能在几分钟内回答三个问题：**这个领域有哪些关键工作？我们读到哪了？哪些结论还不能信？**

## 1. 目录职责

| 路径 | 职责 |
| --- | --- |
| `docs/03-resources/catalog.yaml` | 唯一的结构化资源清单（事实来源） |
| `docs/03-resources/INDEX.md` | 由脚本生成的索引，不手工编辑 |
| `docs/03-resources/notes/` | 单篇论文/系统的深度笔记 |
| `docs/03-resources/reading-queue.md` | 人工维护的阅读优先级与理由 |
| `docs/03-resources/templates/` | 笔记与文档模板 |
| `docs/01-research/` | 调研报告（结论性文档） |
| `docs/02-design/` | 设计方案与计划 |

原则：**catalog 存元数据，notes 存理解，research/design 存结论。** 同一事实不要在多处维护；索引从 catalog 生成。

## 2. 资源 ID

格式：`WM-<TYPE>-<NNN>`

| TYPE | 含义 | 示例 |
| --- | --- | --- |
| PAPER | 论文（非综述） | `WM-PAPER-006` |
| SURVEY | 综述/立场文章 | `WM-SURVEY-001` |
| BLOG | 官方博客、技术报告（非 arXiv） | `WM-BLOG-002` |
| REPO | 代码仓库 | `WM-REPO-001` |
| BENCH | 评测基准 | `WM-BENCH-004` |
| DATA | 数据集 | `WM-DATA-001` |
| SPEC | 规范/协议/API | `WM-SPEC-001` |
| TALK | 演讲、访谈、课程 | `WM-TALK-001` |

编号按登记顺序递增，不复用。删除条目时保留编号并标记 `status: archived`。

笔记文件名：`note-<ID>-<slug>.md`，例如 `note-WM-PAPER-006-vjepa2.md`。slug 用小写英文与连字符。

## 3. 必填字段

| 字段 | 说明 | 取值 |
| --- | --- | --- |
| `id` | 资源 ID | 见上 |
| `title` | 原文标题 | 保留英文原文 |
| `type` | 类型 | `paper/survey/blog/repo/benchmark/dataset/spec/talk` |
| `route` | 技术路线 | 见第 5 节 |
| `year` | 发布年份 | 整数 |
| `url` | 主链接 | http(s) |
| `status` | 阅读状态 | 见第 4 节 |
| `confidence` | 信息置信度 | `A/B/C` |
| `priority` | 阅读优先级 | `P0/P1/P2` |
| `summary` | 一句话结论（不是摘要翻译） | ≤ 220 字符 |
| `added` | 登记日期 | `YYYY-MM-DD` |

可选字段：`org`、`date`、`venue`、`arxiv`、`tags`、`note`、`verified`、`verify`、`verify_reason`。

## 4. 状态与置信度

阅读状态生命周期：

```
inbox → skimmed → read → verified → archived
```

- `inbox`：只知道存在，未读。
- `skimmed`：看过摘要/图表，知道结论。
- `read`：通读，能做技术判断。
- `verified`：关键数字/结论已对照原文或复现，笔记中标注了证据位置。
- `archived`：已过时或被新工作取代，保留作历史参考。

置信度：

| 级别 | 含义 |
| --- | --- |
| `A` | 同行评审论文、官方技术报告、可复现实验；关键数字可直接引用 |
| `B` | arXiv 预印本、官方博客、厂商发布；方向可信，数字需标注“约” |
| `C` | 二手报道、转述、未能访问的页面；使用前必须核实 |

对 `C` 或 `verify: true` 的条目，必须填写 `verify_reason`，并列入 `INDEX.md` 的“待核实”区。

## 5. 技术路线标签

| route | 范围 |
| --- | --- |
| `foundation` | 定义、理论、通用基础模型 |
| `video-gen` | 以视频/像素生成为主的世界模型 |
| `latent-predictive` | JEPA、DINO-WM 等潜空间预测 |
| `model-based-rl` | Dreamer、TD-MPC 等想象中训练 |
| `3d-scene` | 3DGS、NeRF、可探索场景生成 |
| `wam` | 世界-动作模型（World-Action Model） |
| `interactive` | 实时交互、流式生成、记忆 |
| `driving` | 自动驾驶世界模型 |
| `embodied` | 机器人/具身智能 |
| `evaluation` | 基准、指标、批判性研究 |
| `narrative` | 叙事、影视、内容生成 |
| `survey` | 综述与分类法 |

一条资源只选一个主 route；交叉主题写入 `tags`。

## 6. 写作规则

1. **区分事实与判断。** 笔记中用“原文结论”与“我的判断”两个小节分开。
2. **数字必须带来源。** 关键数字标注页码/图表/章节；无法核实时写“约”并降置信度。
3. **摘要写“所以呢”。** 不翻译 abstract，写这篇工作改变了我们对什么问题的判断。
4. **链接到关联资源。** 用 `[[WM-PAPER-006]]` 语法在笔记中互链。
5. **不复制大段原文。** 引用不超过两句，其余用自己的话。
6. **日期用绝对日期。** 例如 `2026-11-17`，不写“上周”。

## 7. 工作流

新增一条资源：

1. 在 `catalog.yaml` 追加条目，分配下一个 ID，`status: inbox`。
2. 若需要深读，用 `templates/paper-note.md` 创建笔记，并把 `note` 字段指向它。
3. 运行 `npm run resources:validate` 校验。
4. 运行 `npm run resources:index` 更新索引。
5. 读完更新 `status`、`summary`、`confidence`；有结论沉淀到 `docs/01-research/`。

提交前建议运行：

```bash
npm run resources:check   # 校验 catalog 且确认 INDEX.md 已同步
```

## 8. 信息时效

每份调研/设计文档头部必须写“信息截止日期”和“核实状态”。世界模型领域变化快，**超过 6 个月的系统对比表应视为历史快照**，引用前先查最新版本。

本项目当前的信息基线：

- 调研正文基于 2026-11-17 的联网检索（arXiv、World Labs、NVIDIA、Wayve 官方页面）。
- 部分厂商页面（Google DeepMind、OpenAI、Meta）在本次环境中无法直接访问，相关条目置信度为 `C`，已列入待核实清单。
