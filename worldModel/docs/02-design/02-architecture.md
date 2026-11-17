# PWM 架构设计

- **状态**：draft
- **版本**：v0.1
- **日期**：2026-11-17
- **关联**：[PWM 方案](01-proposal.md)

本文把方案落到可实现的组件、数据结构、接口与部署形态。目标是让工程团队能据此拆任务、估工作量。

## 1. 组件边界

| 组件 | 拥有什么 | 不拥有什么 |
| --- | --- | --- |
| **WSG 状态服务** | 状态、事件日志、canon、版本、分支 | 不做预测、不渲染 |
| **LDE 动力学服务** | 预测模型、动作编码、不确定性 | 不持久化状态、不做最终裁决 |
| **DV 验证服务** | 不变量、矛盾定位、修复建议 | 不修改状态（由状态服务执行事务） |
| **OR 渲染服务** | 观测生成、缓存、后端选择 | 不拥有状态、不改状态 |
| **MBM 记忆/分支** | checkpoint、分支树、检索 | 不定义状态语义 |
| **IL 交互层** | API、鉴权、审批、可视化 | 不绕过验证 |

一条硬规则：**只有状态服务能写状态；所有写操作都是事件 + 事务。**

## 2. 数据模型

### 2.1 世界状态（WSG）

```json
{
  "world_id": "drama_s1",
  "episode": 2,
  "branch": "main",
  "t": 12.4,
  "canon_version": "v7",
  "entities": [
    {
      "id": "char_lin",
      "type": "character",
      "attrs": {
        "name": "林夏",
        "identity_ref": "asset://char/lin/v3",
        "personality": ["克制", "敏感"],
        "knowledge": ["secret_zhou"],
        "goals": ["protect_family"]
      },
      "physical": {
        "pose": { "position": [0, 0, 0], "rotation": [0, 0, 0, 1] },
        "velocity": [0, 0, 0],
        "geometry_ref": "splat://scene12/char_lin",
        "materials": [],
        "articulation": {}
      },
      "relations": [
        { "rel": "sister_of", "target": "char_zhou", "valid": [0.0, null] }
      ],
      "uncertainty": { "identity": 0.02, "pose": 0.05, "state": 0.1 }
    }
  ],
  "relations": [
    { "src": "char_lin", "rel": "knows_secret", "dst": "secret_zhou", "valid": [3.1, null] }
  ],
  "rules": [
    { "id": "rule_no_magic", "text": "此世界没有超自然力量", "hard": true }
  ],
  "uncertainty": { "global": 0.08 },
  "provenance": {
    "state_model": "pwm-dyn-v0.3",
    "renderer": "video-backend-a",
    "created_at": "2026-11-17T10:00:00Z"
  }
}
```

字段约定：

- `id`：稳定、不可复用；实体删除用 `tombstone` 事件，不物理删除。
- `valid`：有效时间区间 \([start, end)\)，`null` 表示至今。
- `attrs`：语义属性，允许 schema 扩展。
- `physical`：连续状态，供物理/渲染使用。
- `uncertainty`：每个关键因子的置信度，驱动门控。

> 关系以顶层 `relations` 为唯一事实来源；实体内的 `relations` 只是渲染/查询用的去规范化视图，写入时必须同步或由状态服务重建。

### 2.2 事件日志

```json
{
  "event_id": "evt_00123",
  "world_id": "drama_s1",
  "branch": "main",
  "t": 12.4,
  "valid_time": [12.4, null],
  "record_time": "2026-11-17T10:00:00Z",
  "type": "semantic",
  "actor": "char_lin",
  "action": "reveal_secret",
  "target": "char_zhou",
  "payload": { "secret": "adoption", "witnesses": ["char_gu"] },
  "caused_by": ["evt_00120"],
  "state_digest": "sha256:..."
}
```

事件类型：

| type | 例子 | 谁产生 |
| --- | --- | --- |
| `physical` | 走位、拿起、开门 | 用户/引擎/策略 |
| `semantic` | 说台词、发现、背叛 | 编剧/角色智能体 |
| `edit` | 改设定、换演员、调色 | 人类编辑 |
| `observation` | 新视频/新扫描/人工反馈 | 感知/人类 |
| `repair` | 状态投影、重规划 | 验证器 |
| `branch` | 创建/合并/丢弃分支 | 用户/系统 |

### 2.3 Canon

Canon 是“这个世界必须为真”的事实与规则集合，独立版本化：

```json
{
  "canon_version": "v7",
  "facts": [
    { "id": "f001", "text": "林夏与周宁是姐妹", "entities": ["char_lin", "char_zhou"], "immutable": true },
    { "id": "f002", "text": "故事发生在 1998 年的南方小城", "entities": [], "immutable": true }
  ],
  "rules": [
    { "id": "r001", "text": "角色不能知道自己未经历的事", "hard": true },
    { "id": "r002", "text": "每集结尾必须留一个悬念", "hard": false }
  ],
  "retcons": [
    { "id": "rc001", "fact_id": "f010", "old": "父亲已去世", "new": "父亲失踪", "effective": "v7", "reason": "第二季反转" }
  ]
}
```

Retcon 不是删除旧事实，而是追加一条“在某版本后生效”的修订；依赖图用于找出受影响的镜头与事件。

## 3. 状态生命周期

### 3.1 创建

```text
输入：canon + 资产 + 初始场景
  → 解析 canon 为实体/关系/规则
  → 加载资产引用（角色外观、场景 3D、道具）
  → 建立初始 checkpoint
  → 验证 canon 自洽性
  → 返回 world_id + state_digest
```

### 3.2 单步

```text
action
  → 动作校验（schema/合法性）
  → LDE 预测先验 S'
  → DV 快检（不变量）
      ├── 通过 → 提交事件 + 新 checkpoint
      └── 失败 → 修复/重规划/请求观测 → 再验证
  → 可选渲染
  → 返回状态摘要 + 矛盾 + 不确定性
```

### 3.3 分支

```text
branch(world_id, from_t, label)
  → 复制事件日志前缀（不复制大对象）
  → 新 branch_id
  → 后续 step 只写该分支
  → 可 compare/merge/discard
```

### 3.4 Retcon

```text
edit(canon, fact_id, new_value)
  → 追加 retcon 事件
  → 依赖图传播：哪些实体/关系/事件/镜头引用了该事实
  → 标记受影响对象（不自动重写）
  → 生成“需要重拍/重生成”的清单
  → 人类审批后执行
```

## 4. System-1：潜动力学

### 4.1 输入输出

| 输入 | 输出 |
| --- | --- |
| 观测历史 \(o_{\le t}\)（可选） | 状态增量 \(\Delta S_{t+1}\) |
| 当前状态摘要 | 多尺度预测（micro/meso） |
| 动作 \(a_t\) | 每个实体的不确定性 |
| 时间尺度 | 预测置信度/门控信号 |

### 4.2 模块

```text
Observation Encoder E
  ├── 视觉编码器（冻结 DINO/V-JEPA/CLIP）
  ├── 实体槽提取（object-centric slots）
  └── 状态摘要压缩

Action Encoder A
  ├── 物理动作 MLP/Transformer
  ├── 语义动作 文本/图嵌入
  └── 编辑动作 结构化 diff

Dynamics Predictor f
  ├── 不变因子头（identity/material）
  ├── 变化因子头（pose/relation/state）
  ├── 多尺度头（micro/meso）
  └── 不确定性头（heteroscedastic）

Uncertainty Gate G
  └── 决定是否调用 System-2 / 请求观测
```

### 4.3 关键设计

- **增量预测**：输出 \(\Delta\)，减少静态背景主导。
- **实体槽**：每个实体一个 token，允许增删实体（birth/death 事件）。
- **动作敏感度**：训练时加入“不同动作应对应不同预测”的对比损失。
- **多尺度**：micro 头高频、meso 头低频；跨尺度一致性损失。
- **冻结编码器优先**：降低训练成本，先用 DINOv2/V-JEPA 特征。

### 4.4 推理预算

| 路径 | 目标延迟 | 说明 |
| --- | --- | --- |
| 快路径 | 10–20 ms | 增量预测，不做重渲染 |
| 标准路径 | 50–100 ms | 预测 + 快检 + 低分辨率渲染 |
| 慢路径 | 500 ms–数秒 | System-2 验证/重规划 |

## 5. System-2：验证与规划

### 5.1 不变量引擎

```text
Invariant {
  id, scope, severity, check(state) -> Pass | Violation{entities, rule, evidence}
}
```

内置检查：

1. **实体永久性**：ID 连续性、非授权消失。
2. **身份一致性**：外观嵌入距离、canon 绑定。
3. **空间一致性**：碰撞、穿透、尺度。
4. **物理一致性**：守恒、接触、重力（按场景启用）。
5. **因果一致性**：事件图可达性、因果先于结果。
6. **知识状态**：角色不能知道未经历/未被告知的事。
7. **canon 一致性**：事实/规则冲突。
8. **风格/镜头**：光线、色调、镜头连续性。

### 5.2 矛盾定位

输出结构化矛盾：

```json
{
  "contradiction_id": "ctr_0042",
  "severity": "hard",
  "type": "knowledge_violation",
  "entities": ["char_zhou"],
  "rule": "r001",
  "evidence": {
    "event": "evt_00123",
    "fact": "char_zhou did not witness secret_zhou"
  },
  "suggested_repairs": [
    { "action": "add_witness", "entity": "char_zhou", "cost": 0.2 },
    { "action": "rollback_event", "event": "evt_00123", "cost": 0.8 },
    { "action": "request_human", "cost": 0.1 }
  ]
}
```

### 5.3 修复策略

| 策略 | 适用 | 代价 | 风险 |
| --- | --- | --- | --- |
| 状态投影 | 物理/几何小误差 | 低 | 可能改变语义 |
| 局部重预测 | 单实体/短窗口 | 中 | 边界不一致 |
| 重规划 | 动作序列导致矛盾 | 中高 | 偏离用户意图 |
| 请求观测 | 不确定性高 | 人类成本 | 打断体验 |
| 回滚 | 严重错误 | 高 | 丢失后续进展 |

策略选择用代价函数：

\[
\text{cost} = \alpha \cdot \text{state\_change} + \beta \cdot \text{compute} + \gamma \cdot \text{human\_effort} + \delta \cdot \text{semantic\_drift}
\]

权重由场景配置（叙事场景更重视语义漂移，机器人更重视物理）。

### 5.4 学习型 verifier（后续）

规则 verifier 覆盖有限；后续训练一个轻量模型：

- 输入：状态对/事件序列；
- 输出：矛盾概率、类型、定位；
- 训练数据：合成矛盾 + 人工标注 + 模型自博弈。

规则与学习型 verifier 并联：规则保证可解释底线，学习型扩展覆盖面。

## 6. 记忆与分支

### 6.1 事件溯源

```text
state(t) = fold(initial_state, events[0..t])
```

- 事件不可变；状态是投影。
- 定期 checkpoint（每 N 事件或每 T 秒）加速重建。
- 状态摘要用 Merkle 树/哈希链，支持一致性校验。

### 6.2 双时间检索

| 查询 | 语义 |
| --- | --- |
| `state_at(valid_time=t)` | 世界在 t 时刻的真实状态 |
| `knowledge_at(record_time=t)` | 我们在记录时间 t 所知道的状态 |
| `history_of(entity)` | 实体的完整变更历史 |
| `why(event)` | 事件的因果链 |

叙事场景必须用 `valid_time` 检索，而不是“最新记录”，否则撤销/回访会出错。

### 6.3 分支管理

- 分支只复制事件日志前缀与轻量状态引用，不复制大资产。
- 限制：最大深度、最大宽度、单分支最大步数。
- 自动剪枝：低评分/矛盾多的分支标记 `pruned`。
- 合并：只允许在“状态摘要 + canon 版本”兼容时合并；否则人工介入。

### 6.4 存储

| 数据 | 存储 | 理由 |
| --- | --- | --- |
| 事件日志 | Postgres/SQLite（JSONB） | 事务、查询、版本 |
| 状态快照 | 对象存储（Parquet/JSON） | 大对象、冷热分离 |
| 资产引用 | 对象存储 + CDN | 视频/3D/贴图 |
| 向量索引 | 向量库（可选） | 实体/场景检索 |
| 分支元数据 | Postgres | 关系与生命周期 |

## 7. 渲染器抽象

### 7.1 接口

```typescript
interface RenderRequest {
  state: WorldState;
  camera: Camera;
  style: Style;
  resolution: "preview" | "standard" | "final";
  deadline_ms?: number;
}

interface RenderResult {
  frames: Frame[];
  backend: string;
  latency_ms: number;
  cost_estimate: number;
  warnings: string[];
}

interface Renderer {
  render(req: RenderRequest): Promise<RenderResult>;
  capabilities(): RendererCapabilities;
}
```

### 7.2 后端选择策略

```text
if need_exact_layout or interactive_control:
    backend = engine（粗渲染 + 遮罩/深度）
elif need_photoreal or stylized:
    backend = video_diffusion
elif need_revisit or spatial_consistency:
    backend = 3dgs
else:
    backend = cheapest_available
```

混合：

```text
engine → layout/depth/mask → video model 精修 → 一致性检查 → 输出
```

### 7.3 缓存

- **状态缓存**：相同 state_digest + camera + style 直接命中。
- **关键帧缓存**：镜头首尾帧/关键姿态。
- **控制感知缓存**：动作变化小时复用（参考 CtrlCache）。
- **失效策略**：状态变更、canon 版本变更、渲染器版本变更。

## 8. API

### 8.1 端点

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| POST | `/v1/worlds` | 从 canon/资产创建世界 |
| GET | `/v1/worlds/{id}/state` | 导出状态（可按 t/branch） |
| POST | `/v1/worlds/{id}/step` | 执行动作并推进 |
| POST | `/v1/worlds/{id}/render` | 渲染当前/指定状态 |
| POST | `/v1/worlds/{id}/branch` | 创建分支 |
| POST | `/v1/worlds/{id}/what_if` | 反事实 rollout |
| POST | `/v1/worlds/{id}/edit` | 编辑 canon/状态 |
| GET | `/v1/worlds/{id}/contradictions` | 查看矛盾 |
| POST | `/v1/worlds/{id}/repair` | 执行修复 |
| GET | `/v1/worlds/{id}/events` | 事件日志 |

### 8.2 Step 示例

请求：

```json
{
  "branch": "main",
  "action": {
    "type": "semantic",
    "actor": "char_lin",
    "action": "reveal_secret",
    "target": "char_zhou",
    "payload": { "secret": "adoption" }
  },
  "render": false,
  "verify": true,
  "horizon": 1
}
```

响应：

```json
{
  "world_id": "drama_s1",
  "branch": "main",
  "t": 13.2,
  "state_digest": "sha256:...",
  "changed_entities": ["char_lin", "char_zhou", "char_gu"],
  "contradictions": [
    {
      "contradiction_id": "ctr_0042",
      "severity": "hard",
      "type": "knowledge_violation",
      "entities": ["char_gu"]
    }
  ],
  "uncertainty": { "char_gu": 0.31 },
  "latency_ms": 42
}
```

### 8.3 What-if 示例

请求：

```json
{
  "from_t": 12.4,
  "branches": [
    { "label": "reveal", "actions": [{ "type": "semantic", "actor": "char_lin", "action": "reveal_secret" }] },
    { "label": "hide", "actions": [{ "type": "semantic", "actor": "char_lin", "action": "hide_secret" }] }
  ],
  "horizon": 20,
  "render": false,
  "score": ["canon", "tension", "cost"]
}
```

响应：每个分支的状态摘要、矛盾、评分、推荐。

## 9. 关键流程

### 9.1 交互式 step（带渲染）

```text
Client → API: step(action, render=true)
API → WSG: load state
API → LDE: predict ΔS
LDE → DV: verify
DV → WSG: commit event (if pass)
WSG → OR: render(state, camera)
OR → Client: frame + state_digest
```

### 9.2 What-if

```text
Client → API: what_if(from_t, actions[], horizon)
API → WSG: fork branches
API → LDE: rollout each branch (parallel)
LDE → DV: verify each step
DV → API: contradictions + scores
API → Client: branch comparison
```

### 9.3 Retcon

```text
Client → API: edit(canon, fact, new)
API → WSG: append retcon event
WSG → DependencyGraph: find affected entities/events/shots
API → Client: impact report
Client → API: approve(subset)
API → OR: regenerate affected shots
```

### 9.4 修复

```text
DV → Contradiction{repairs}
API → RepairPlanner: rank by cost
API → WSG: apply chosen repair (event)
WSG → LDE: re-predict affected window
DV → verify again
```

## 10. 部署形态

```text
┌─────────────┐
│ API Gateway │
└──────┬──────┘
       │
┌──────▼──────┐   ┌──────────────┐   ┌──────────────┐
│ State Svc   │◄──│ Event Bus    │──►│ Verifier Svc │
│ (Postgres)  │   │ (Kafka/NATS) │   │ (CPU/GPU)    │
└──────┬──────┘   └──────┬───────┘   └──────────────┘
       │                 │
┌──────▼──────┐   ┌──────▼───────┐   ┌──────────────┐
│ Object Store│   │ Dynamics Svc │   │ Renderer Svc │
│ (S3/OSS)    │   │ (GPU)        │   │ (GPU pool)   │
└─────────────┘   └──────────────┘   └──────────────┘
```

- **无状态服务** + 外部存储，便于扩缩容。
- 渲染服务按后端分池（视频/3DGS/引擎），独立扩缩。
- 验证服务可 CPU 化（规则）或 GPU 化（学习型）。
- 事件总线解耦写状态与副作用（渲染、通知、日志）。

### 10.1 可观测性

必须记录：

- 每个请求的 trace：动作 → 预测 → 验证 → 渲染 → 输出；
- 状态 diff（哪些实体/属性变了）；
- 矛盾类型与修复路径；
- 渲染后端、延迟、成本；
- 模型版本、canon 版本、渲染器版本。

### 10.2 故障处理

| 故障 | 处理 |
| --- | --- |
| 渲染超时 | 返回低分辨率/缓存帧，标记 `degraded` |
| 验证冲突 | 不提交状态；返回矛盾与建议 |
| 状态损坏 | 从最近 checkpoint 重建；校验哈希链 |
| 模型版本不兼容 | 拒绝加载，提示迁移 |
| 分支爆炸 | 限制深度/宽度，自动剪枝 |
| 资产缺失 | 用占位资产 + 标记，不阻塞状态 |

## 11. 安全与合规

- **资产来源**：每个角色/场景/视频记录授权与来源。
- **肖像/声音**：需要明确同意；生成内容加水印/指纹。
- **剧本版权**：canon 与生成内容记录版本与贡献者。
- **访问控制**：世界/分支/资产的 RBAC；敏感 canon 加密。
- **审计**：事件日志不可篡改；谁在何时改了什么。
- **滥用防护**：禁止生成真实人物未授权内容；输出审核。

## 12. 开放技术决策

| 决策 | 选项 | 建议 |
| --- | --- | --- |
| 图存储 | Postgres JSONB / 图数据库 | 先用 Postgres，关系查询复杂后再评估 |
| 事件格式 | JSON / Protobuf | JSON 便于调试；高频后用 Protobuf |
| 验证同步性 | 同步快检 + 异步深检 | 首版同步规则，学习型异步 |
| 动力学模型 | 单一多尺度 / 每尺度一个 | 先用单一 + 尺度 token，简化 |
| 渲染后端 | 单一视频 / 多后端 | 首版视频，Phase 3 加 3DGS/引擎 |
| 状态抽取 | 规则/模型/混合 | 混合：模型抽取 + 规则校验 |
| 分支评分 | 规则 / 学习 / 人类 | 首版规则 + 人类，后续学习 |

## 13. 最小可行实现（MVP）

Phase 1 只做：

1. `WorldState` JSON schema + SQLite 事件日志；
2. 规则验证器（实体永久、身份、canon、知识状态）；
3. 冻结 DINOv2 + 小型 Transformer 的潜动力学（单场景）；
4. 一个视频渲染后端（图生视频/首尾帧）；
5. CLI/HTTP API：create/step/render/branch；
6. S1/S2 评测套件。

不做：3DGS、引擎、实时蒸馏、学习型 verifier、多智能体。这些留到 Phase 2/3。
