# 术语表

> 本表约定项目内常用术语。英文缩写保留原文，中文为工作译名。

## 基础

| 术语 | 解释 |
| --- | --- |
| **世界模型（World Model）** | 以动作为条件、预测世界如何演化的内部模型；形式上是 \(p(s_{t+1}\mid s_t,a_t)\) 及其观测读出。 |
| **POMDP** | 部分可观测马尔可夫决策过程；智能体只能看到观测，看不到真实状态。 |
| **状态（State）** | 世界的完整描述：实体、位置、速度、属性、关系等；不可直接观测。 |
| **观测（Observation）** | 智能体通过传感器/像素获得的局部信息。 |
| **动作（Action）** | 智能体对世界的干预；可以是物理控制、语义事件或编辑操作。 |
| **动力学（Dynamics）** | 状态随动作演化的规律。 |
| **潜空间（Latent Space）** | 压缩后的表征空间；世界模型常在此预测而非像素空间。 |
| **想象 rollout（Imagination Rollout）** | 在世界模型中展开未来轨迹，用于训练或规划。 |
| **模型基 RL（MBRL）** | 用学到的世界模型辅助策略学习/规划的强化学习。 |

## 技术路线

| 术语 | 解释 |
| --- | --- |
| **JEPA** | Joint-Embedding Predictive Architecture；在表征空间预测未来，不重建像素。 |
| **V-JEPA / V-JEPA 2** | Meta 的视频 JEPA 系列；V-JEPA 2 用 100 万小时以上视频预训练并接入机器人规划。 |
| **DINO-WM** | 在冻结 DINOv2 特征上学习动力学、零样本规划的世界模型。 |
| **RSSM** | Recurrent State Space Model；Dreamer 系列使用的循环潜状态模型。 |
| **TD-MPC2** | 无解码器隐式世界模型 + 局部轨迹优化的模型基 RL 方法。 |
| **Dreamer** | 在潜空间想象中训练策略的 MBRL 系列；Dreamer 4 面向可扩展实时想象。 |
| **世界基础模型（WFM）** | 可后训练/微调为下游世界模型的通用基础模型，如 Cosmos。 |
| **WAM（World-Action Model）** | 联合预测未来状态与动作的模型；2026 年机器人主流范式。 |
| **VLA（Vision-Language-Action）** | 直接从视觉/语言输入输出动作的模型；WAM 常在其上增加未来预测。 |
| **渲染器（Renderer）** | 输出像素/视频的世界模型功能投影，优化视觉保真。 |
| **模拟器（Simulator）** | 输出状态/几何/物理的世界模型功能投影，优化结构正确性。 |
| **规划器（Planner）** | 输出动作的世界模型功能投影，优化任务成功。 |

## 表征与生成

| 术语 | 解释 |
| --- | --- |
| **3DGS（3D Gaussian Splatting）** | 用可微高斯点表示 3D 场景，可实时渲染。 |
| **NeRF** | 神经辐射场；用隐式函数表示 3D 场景。 |
| **点云（Point Cloud）** | 3D 点集合；常用于几何/深度表示。 |
| **潜在动作（Latent Action）** | 从相邻帧推断的离散动作码，使无动作标签视频可训练。 |
| **动作条件（Action-Conditioned）** | 模型预测/生成以动作为条件。 |
| **扩散 Transformer（DiT）** | 用 Transformer 做扩散/流匹配生成的骨干。 |
| **流匹配（Flow Matching）** | 一种连续生成目标，常用于视频/图像生成。 |
| **Shortcut Forcing** | 训练模型少步生成未来，支持实时推理的技术。 |
| **蒸馏（Distillation）** | 用大模型/多步模型训练小模型/少步模型。 |
| **KV Cache** | 缓存注意力键值，加速自回归/流式生成。 |
| **流式生成（Streaming）** | 边生成边输出，支持实时交互。 |
| **空间上下文（Spatial Context）** | 把输入图像/深度锚定在 3D 位置的上下文，如 Atlas。 |
| **全模态（Omnimodal）** | 同时处理语言、图像、视频、音频、动作等多种模态。 |

## 评测与状态

| 术语 | 解释 |
| --- | --- |
| **反事实（Counterfactual）** | 同一初始状态、不同动作下的替代未来。 |
| **干预（Intervention）** | 主动改变一个变量，观察结果变化。 |
| **状态跟踪（State Tracking）** | 模型是否随真实状态变化而更新预测。 |
| **对象永久性（Object Permanence）** | 物体被遮挡/离开视野后仍然存在。 |
| **漂移（Drift）** | 长时程生成中状态逐渐偏离。 |
| **身份漂移（Identity Drift）** | 角色/物体外观或身份在时间中改变。 |
| **有效时间（Valid Time）** | 事实在世界中为真的时间区间。 |
| **记录时间（Record Time）** | 我们何时知道/记录该事实。 |
| **Canon** | 叙事世界中被视为必须为真的事实与规则集合。 |
| **Retcon** | 对既有 canon 的追溯性修改。 |
| **不变量（Invariant）** | 运行时必须始终成立的约束，如非穿透、身份一致。 |
| **验证器（Verifier）** | 检查状态/预测是否满足不变量的组件。 |
| **不确定性校准** | 模型输出的置信度与实际正确率匹配。 |
| **开环/闭环** | 开环只预测不反馈；闭环用观测/动作持续校正。 |

## 项目内指标

| 缩写 | 含义 |
| --- | --- |
| **PVR** | Physical Violation Rate，物理违规率 |
| **FSA** | Flip State Accuracy，状态翻转准确率 |
| **IDR** | Identity Retention Rate，身份保持率 |
| **SRR** | Scene Rewrite Rate，场景重写率 |
| **AS** | Action Sensitivity，动作敏感度 |
| **CFR** | Counterfactual Correctness Rate，反事实正确率 |
| **DCD** | Dynamics Consistency Distance，动力学一致性距离 |
| **WMUS** | World Model Utility Score，世界模型效用评分（可选综合指标） |
