# 研究方案评测框架（共享附录草稿）

> 本文件为第四部分各研究方案提供统一的评测口径，避免每个方案各说各话。所有方案在报告中引用本框架的编号（W1–W7 / M1–M16 / B1–B6 / S1–S5）。

---

## 1. 工作负载（Workloads）

| 编号 | 负载 | 特征 | 关键压力点 | 公开 trace / 构造方式 |
|---|---|---|---|---|
| W1 | 多轮对话 | 同一会话共享长 system prompt + 历史；轮次 5–50 | 前缀复用、KV 驻留时长、TTL | ShareGPT、LMSYS-Chat、Mooncake 多轮 trace |
| W2 | RAG 问答 | 每次检索 5–50 个文档块；块顺序随请求变化；非严格前缀 | 非前缀复用、chunk 级缓存、正确性 | HotpotQA / 2Wiki / NaturalQuestions + 固定检索器 |
| W3 | Agent 长时程 | 工具调用、跨会话记忆、分支回滚；单任务 10^2–10^4 步 | 记忆一致性、写放大、元数据 | SWE-bench 轨迹、WebArena、自构造 |
| W4 | 长上下文分析 | 128K–1M token 单请求；低并发 | decode 带宽、容量、SSD 预取 | ∞Bench、LongBench-v2、RULER |
| W5 | 在线服务混合负载 | Zipf 到达、长短请求混合、SLO 分级 | 调度、隔离、尾延迟 | Mooncake trace、BurstGPT、Azure LLM trace |
| W6 | 离线批处理 | 吞吐优先、可容忍高延迟 | 成本/token、checkpoint 式批处理 | 自构造（batch=256–1024） |
| W7 | 训练作业 | 预训练 / 微调 / RLHF；千卡级 | checkpoint 突发、元数据、数据加载 | Llama-3 训练报告、MegaScale、3FS 公开数据 |

**构造原则**：
1. 必须报告 **prefix graph**（请求间共享前缀的图结构）与 **reuse distance 分布**，否则缓存策略不可复现。
2. 必须同时报告 **平均** 与 **p99**；LLM serving 的 SLO 通常在尾延迟。
3. 合成负载要给出与真实 trace 的拟合检验（到达过程、长度分布、共享度）。

---

## 2. 指标（Metrics）

### 2.1 性能与 SLO

| 编号 | 指标 | 定义 | 备注 |
|---|---|---|---|
| M1 | TTFT p50/p99 | 首 token 延迟 | 区分 cache hit / miss |
| M2 | TPOT p50/p99 | 每输出 token 时间 | decode 阶段 |
| M3 | Goodput@SLO | 满足 TTFT/TPOT SLO 的请求数/秒 | 比 throughput 更能反映服务能力 |
| M4 | 有效吞吐 | token/s/GPU、token/s/美元 | 必须注明精度与 batch |

### 2.2 存储效率

| 编号 | 指标 | 定义 | 备注 |
|---|---|---|---|
| M5 | 缓存命中率 | token 级 / block 级 / 请求级三种口径 | 三者不可混用 |
| M6 | 存储放大 | 写入字节 / 有用 KV 字节 | 衡量去重、压缩、写放大 |
| M7 | SSD 写放大 WA 与寿命 | 实际 NAND 写入 / 主机写入；TBW 消耗/年 | 用 FEMU 或设备 SMART 采集 |
| M8 | 元数据开销 | metadata ops/s、元数据字节/KV 字节 | 小对象场景的关键 |
| M9 | 每百万 token 存储成本 | $/M-token，含介质、网络、egress、寿命摊销 | 与 GPU 成本并列 |

### 2.3 质量与正确性

| 编号 | 指标 | 定义 |
|---|---|---|
| M10 | 任务准确率 | 下游任务 metric（EM/F1/Pass@1/人工） |
| M11 | 复用保真度 | 复用 KV 的输出与 full prefill 的输出一致率 |
| M12 | 误差界违反率 | 超过预设误差上界的请求比例 |

> **本领域最容易被忽视的指标是 M11**。多数 KV 复用论文只报 speedup 与平均准确率，不报"与 full prefill 的逐样本一致率"。2026 年的 SAFE-KV 等工作表明，朴素非前缀复用的答案保真度可能低至 37–47%，而平均准确率看不出这一点。

### 2.4 系统与运维

| 编号 | 指标 |
|---|---|
| M13 | 故障恢复时间 RTO / 数据丢失窗口 RPO |
| M14 | 多租户隔离度（干扰导致的 p99 退化） |
| M15 | 可观测性覆盖（TTFT 分解、命中率、慢节点定位） |
| M16 | 能耗/token、碳/token |

---

## 3. 基线（Baselines）

| 编号 | 基线 | 用途 |
|---|---|---|
| B1 | vLLM (PagedAttention + APC) | 通用推理基线 |
| B2 | SGLang (RadixAttention / HiCache) | 前缀复用基线 |
| B3 | TensorRT-LLM | 工业级性能上界 |
| B4 | LMCache | 分层 KV 缓存基线 |
| B5 | Mooncake / Dynamo KVBM | 集群级 KV 池基线 |
| B6 | DistServe / Splitwise | PD 分离基线 |

**公平性原则**：
- 同一硬件、同一模型精度、同一 batch 配置；
- 报告是否启用 prefix caching、chunked prefill、CUDA graph；
- 对存储类方案，必须报告 SSD 型号、队列深度、文件系统、页缓存配置。

---

## 4. 实验方法

| 编号 | 方法 | 适用 | 工具 |
|---|---|---|---|
| S1 | 真实 testbed | 端到端结论 | 8×H100/H200、NVMe Gen5、RoCEv2 100–400 Gbps |
| S2 | Trace-driven 仿真 | 大规模、多租户、故障注入 | Vidur、LLMCompass、ASTRA-sim、自研离散事件仿真 |
| S3 | 存储仿真 | SSD 寿命/写放大 | FEMU、SimpleSSD、MQSim |
| S4 | 内存/互连仿真 | CXL/近存 | gem5 + CXL 模型、Ramulator 2.0 |
| S5 | 解析建模 | 设计空间探索 | 本报告 `analysis-quant.md` 的一阶模型 |

**推荐组合**：S5 做设计空间裁剪 → S2 做大规模扫描 → S1 做关键点验证。只做 S1 的论文难以覆盖多租户与故障；只做 S2 的论文缺乏可信度。

---

## 5. 统计与可复现性

1. 每个配置至少 5 次运行，报告均值与 95% 置信区间；尾延迟报告 p99 与 bootstrap CI。
2. 冷启动与热缓存分开报告；缓存预热过程要写清楚。
3. 开源：trace 预处理脚本、配置、原始结果；至少提供可复现的仿真脚本。
4. 负结果也要报告：特别是"某类负载下无收益"的边界条件。

---

## 6. 方案评估矩阵（用于第四部分横向打分）

| 维度 | 权重 | 说明 |
|---|---:|---|
| 新颖性 | 20% | 是否提出新问题/新抽象，而非调参 |
| 预期收益 | 25% | 相对最强基线的提升，需有数量级论证 |
| 可行性 | 20% | 12–24 个月内能否做出原型 |
| 评测可复现性 | 15% | 是否有公开 trace/基线 |
| 产业价值 | 20% | 是否能被云厂商/模型公司采用 |

---

*本框架会随报告定稿调整；引用时以最终版为准。*
