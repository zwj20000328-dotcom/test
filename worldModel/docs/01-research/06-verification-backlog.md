# 待核实清单（Verification Backlog）

- **更新日期**：2026-11-17
- **背景**：本次调研通过 `curl --ssl-no-revoke` 直接访问 arXiv、World Labs、NVIDIA、Wayve 等页面；`WebSearch`/`WebFetch` 工具与部分厂商域名被网络策略阻断，因此以下条目需要后续核实。
- **使用方式**：核实后更新 `catalog.yaml` 的 `status`、`confidence`、`verify` 字段，并运行 `npm run resources:index`。

## P0：影响核心结论

| # | 待核实内容 | 当前依据 | 为什么重要 | 核实方式 |
| --- | --- | --- | --- | --- |
| 1 | **Genie 3** 的规格：720p/24fps、数分钟一致性、可提示事件、动作空间限制 | 既有知识 + 官方博客标题（页面被阻断） | 它是“实时交互世界模型”的核心参照 | 访问 `deepmind.google/discover/blog/genie-3-a-new-frontier-for-world-models/`；或查 DeepMind 官方 YouTube/技术报告 |
| 2 | **Sora 2** 的发布日、同步音频、物理与控制能力、可用性 | 既有知识（OpenAI 页面 403） | 报告中作为“闭源视频生成代表”引用 | 访问 `openai.com/index/sora-2/`；查 OpenAI system card |
| 3 | **World Labs R2S2R** 的核心声明：仅仿真数据训练的策略可跨机器人/任务迁移、仿真评测可预测真机表现 | 官方博客（已读） | 如果成立，会改变“sim-to-real 必须真机微调”的判断 | 查论文/技术报告；寻找独立复现；核对任务数量与基线 |
| 4 | **Cosmos 3** 的 SOTA 声明：Artificial Analysis 最佳开源 T2I/I2V、RoboArena 最佳策略 | arXiv 摘要（已读） | 影响“开放骨干选型”的判断 | 查 Artificial Analysis / RoboArena 榜单当日快照；核对模型版本与评测集 |
| 5 | **WorldArena 1.0/2.0** 的任务、指标与排行榜 | 仅通过 GreenWAM/WorldArena 2.0 论文间接引用 | 机器人世界模型的主评测之一 | 找 WorldArena 官方 repo/leaderboard；核对 2.0 与 1.0 差异 |
| 6 | **FlipTest** 的 18.3% 是“配对准确率”还是其他聚合口径；11 个模型的具体名单 | arXiv 摘要与正文（已读摘要） | 报告中的关键数字 | 读全文第 4-5 节；核对置信区间与任务划分 |

## P1：影响系统对比

| # | 待核实内容 | 当前依据 | 说明 |
| --- | --- | --- | --- |
| 7 | **Marble / RTFM** 的具体能力与限制 | World Labs 博客索引（已读标题与日期），细节来自既有知识 | 建议读 `worldlabs.ai/blog/marble-world-model` 与 `/blog/rtfm` 全文 |
| 8 | **Atlas** 的 1 分钟/1440p 是否指单一连续生成，还是拼接；15 fps 的分辨率与硬件 | 官方博客（已读） | 报告引用为“最长 1 分钟、1440p、15 fps”，需确认口径 |
| 9 | **Cosmos-Predict2.5 / Cosmos 3** 的开放权重范围与许可证 | arXiv + 博客（部分已读） | 影响“能否商用/二次训练” |
| 10 | **V-JEPA 2** 的参数量、机器人数据小时数、零样本任务范围 | arXiv 摘要（已读），具体数字来自既有知识 | 报告中只用了“100 万小时以上、少量机器人轨迹”，较安全 |
| 11 | **Dreamer 4** 的“单 GPU 实时”具体分辨率/帧率；Minecraft 钻石结果的可复现性 | arXiv 摘要（已读） | 报告引用为“单 GPU 实时想象”，未给具体 fps |
| 12 | **GE-Act 2.0 / GE-Sim 2.0** 的“数千小时”数据规模与评测集 | arXiv 摘要（已读） | 中国团队代表工作，建议读全文 |
| 13 | **InternW0 / GreenWAM / Magic-W0** 的机构归属与开源情况 | arXiv 摘要（已读） | 部分机构字段可能不准确；GreenWAM/InternW0 已标注 |
| 14 | **HY-World 2.0** 的四阶段细节与 3DGS 输出质量 | arXiv 摘要（已读） | 报告中只做了流程级描述 |
| 15 | **WorldPlay / DreamX / GameWM** 的实时帧率与硬件 | 摘要（已读） | 报告未给具体 fps，避免臆测 |

## P2：覆盖缺口（尚未系统调研）

| # | 缺口 | 建议 |
| --- | --- | --- |
| 16 | **中国车企世界模型**：蔚来 NWM、小鹏世界基座、理想 MindVLA/世界模型、华为盘古等 | 通过公司技术日/车展资料补充；本次 arXiv 检索未覆盖 |
| 17 | **Google 2026 年 Genie 后续版本**（若有） | 查 DeepMind 博客时间线；注意“Genie 4D”是 4D 重建论文，不是 DeepMind Genie 4 |
| 18 | **OpenAI 2026 年视频/世界模型进展** | Sora 2 之后是否有 Sora 3/世界模型 API |
| 19 | **Meta 2026 年 JEPA 后续**（V-JEPA 2.1/3、Code World Model 2） | 查 Meta AI 博客与 arXiv |
| 20 | **World Labs–AMD 交易状态** | 官方称预计 2026 年底完成，需确认是否已交割 |
| 21 | **具身智能基准**：LIBERO、SimplerEnv、RoboCasa、BEHAVIOR-1K 与 WAM 的关系 | 补充到评测文档 |
| 22 | **世界模型安全/版权**：训练数据许可、生成内容溯源 | 合规调研，独立文档 |

## 附录：本次检索方法

### A. 工具限制

- `WebSearch` 返回空结果；`WebFetch` 对 arXiv/DeepMind 报“无法验证域名安全”。
- Windows 下 `curl` 默认 schannel 证书吊销检查失败，报 `CRYPT_E_NO_REVOCATION_CHECK`。
- 解决方案：`curl --ssl-no-revoke`。arXiv、World Labs、NVIDIA、Wayve 可直接访问；Google DeepMind、OpenAI、Meta 仍被阻断/403。

### B. 可复现命令

```bash
# 1) arXiv 检索(标题/全文,按提交日期排序)
node scripts/arxiv_tools.mjs search "world action model" --size 50 --since 2026-01-01

# 2) 解析已下载的 arXiv 搜索页
node scripts/arxiv_tools.mjs parse /tmp/wm_title.html --since 2026-01-01

# 3) 抓取单个 arXiv 摘要页
curl -sL --ssl-no-revoke -m 45 -A "Mozilla/5.0" \
  https://arxiv.org/abs/2606.02800 -o /tmp/abs_2606.02800.html

# 4) 提取网页正文
node scripts/html_text.mjs /tmp/abs_2606.02800.html 8000

# 5) 官方博客
curl -sL --ssl-no-revoke -m 40 -A "Mozilla/5.0" \
  https://www.worldlabs.ai/blog/taxonomy-of-world-models -o /tmp/wl_taxonomy.html
```

### C. 下次核实的优先顺序

1. Genie 3 / Sora 2 原始页面（修复两条 `C` 级条目的置信度）。
2. FlipTest、R2S2R、Cosmos 3 的关键数字（影响核心结论）。
3. WorldArena 榜单与许可证（影响选型）。
4. 中国车企与 2026 下半年新产品（覆盖缺口）。

> 核实完成后，请同步更新 [全景报告](01-landscape.md) 的“信息截止/核实状态”与 [资源索引](../03-resources/INDEX.md)。
