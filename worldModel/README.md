# World Model Research & Build

研究与构建世界模型的项目工作区。当前阶段聚焦三件事：

1. **调研**：2025–2026 年世界模型的最新技术路线、代表系统与评测；
2. **设计**：提出并论证一个可落地的世界模型方案（PWM：持久世界模型）；
3. **资源管理**：用结构化目录、元数据清单与自动索引管理论文、系统与文档。

## 当前状态（2026-11-17）

| 工作流 | 状态 | 入口 |
| --- | --- | --- |
| 技术调研 | 初稿完成，待评审 | [技术全景](docs/01-research/01-landscape.md) |
| 技术路线 | 初稿完成 | [路线对比](docs/01-research/02-technical-routes.md) |
| 系统卡片 | 初稿完成（15 个系统） | [系统卡片](docs/01-research/03-representative-systems.md) |
| 评测调研 | 初稿完成 | [评测现状](docs/01-research/04-evaluation.md) |
| 新方案设计 | v0.1 草案，待评审 | [PWM 方案](docs/02-design/01-proposal.md) |
| 资源管理 | 已建立（63 条资源 + 10 篇笔记） | [资源索引](docs/03-resources/INDEX.md) |

## 核心结论（TL;DR）

- **世界模型已分化为四种功能**：渲染器、模拟器、规划器、世界-动作模型（WAM），2026 年正在融合。
- **视觉逼真 ≠ 世界模型**：FlipTest 中 11 个视频世界模型全部失败，最佳状态翻转准确率仅 18.3%。
- **显式持久状态正在回归**：Physical Registry、Frame First、GameWM、Atlas spatial context 都指向这一点。
- **机器人主线转向 WAM**：Cosmos 3、GE-Act 2.0、InternW0、GreenWAM 等把未来预测与动作生成合并。
- **机会窗口**：持久可编辑状态、验证/修复闭环、长时记忆、叙事垂直、评测基础设施。

## 方案一句话

> **PWM（Persistent World Model）**：把世界状态从视频生成模型中解耦，做成显式、可版本化、可分支的状态图；用 System-1 潜动力学快速预测，用 System-2 验证/修复/规划，用可插拔渲染器呈现。首个垂直是交互式叙事/短剧。

详见 [PWM 设计方案](docs/02-design/01-proposal.md)。

## 快速开始

### 浏览

- 研究全景：[docs/01-research/01-landscape.md](docs/01-research/01-landscape.md)
- 设计方案：[docs/02-design/01-proposal.md](docs/02-design/01-proposal.md)
- 资源索引：[docs/03-resources/INDEX.md](docs/03-resources/INDEX.md)
- 术语表：[docs/00-overview/glossary.md](docs/00-overview/glossary.md)

### 维护资源

```bash
npm run resources:validate   # 校验 catalog.yaml
npm run resources:index      # 重新生成 INDEX.md
npm run resources:check      # 校验 + 确认索引已同步
npm run resources:stats      # 统计
```

### 检索论文

```bash
node scripts/arxiv_tools.mjs search "world action model" --size 50 --since 2026-01-01
node scripts/arxiv_tools.mjs parse /tmp/results.html --since 2026-01-01
```

> 本机 Node 的 `fetch` 可能因证书吊销检查失败；`arxiv_tools.mjs` 内部使用 `curl --ssl-no-revoke`。

## 目录结构

```text
worldModel/
├── README.md                     # 本文件
├── docs/
│   ├── 00-overview/              # 术语、项目章程
│   ├── 01-research/              # 调研报告、路线、系统、评测、开放问题
│   ├── 02-design/                # 方案、架构、训练、评估、路线图、ADR、实验
│   └── 03-resources/             # 资源清单、索引、笔记、模板、规范
├── scripts/
│   ├── resources.mjs             # 资源校验/索引生成
│   ├── arxiv_tools.mjs           # arXiv 检索/解析
│   └── html_text.mjs             # 网页正文提取
└── package.json
```

## 信息时效与核实

- 调研基于 **2026-11-17** 的联网检索（arXiv、World Labs、NVIDIA、Wayve 等）。
- Google DeepMind、OpenAI、Meta 页面在本环境被阻断，相关条目标为 `C`，见 [待核实清单](docs/01-research/06-verification-backlog.md)。
- 超过 6 个月的系统对比表应视为历史快照；引用前先查最新版本。

## 贡献方式

1. 新资源先登记到 [catalog.yaml](docs/03-resources/catalog.yaml)，再写笔记；
2. 笔记使用 [paper-note 模板](docs/03-resources/templates/paper-note.md)；
3. 结论性内容写入 `docs/01-research/` 或 `docs/02-design/`，不要在笔记里堆长文；
4. 提交前运行 `npm run resources:check`。

规范详见 [资源管理规范](docs/03-resources/conventions.md)。

## 下一步

- [ ] 评审 PWM 方案，确认首个垂直
- [ ] 搭建 S1/S2 评测 harness
- [ ] 用现有剧本验证 canon schema
- [ ] 核实待核实清单 P0 项
- [ ] 复现 persistence + 一个开源基线
