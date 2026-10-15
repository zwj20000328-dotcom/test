# aiVideo —— AI 短剧全流程本地生成工作流

> 输入一份**纯文本 Markdown 剧本**，一键生成 **20–50 集、每集 4–5 分钟**（全剧 80–250 分钟）的
> 高质量竖屏 AI 短剧，**全流程本地部署**，不依赖任何付费云 API，不需要科学上网。
> 目标机器：8×A800-40G（320GB 显存）、CUDA 13.0、Linux。

> **规模要点**：这里的"一集"是一段 **4–5 分钟的完整剧集**（约 5–10 个场景、48–60 个镜头），
> **不是**短视频切片。全剧 20–50 集 ≈ 1000–3000 个镜头，渲染以"**天**"计
> （30 集质量档约 81 小时）。

📖 **完整操作手册见 [docs/TUTORIAL.md](docs/TUTORIAL.md)** —— 从装环境到出片的逐步教程，
含互动式剧本生成、校验、预演、监控、断点续跑、排错与验收清单。

---

## 快速开始（服务器）

```bash
# 1) 装环境（conda + torch cu128 + 推理栈，全程国内镜像）
bash scripts/install_env.sh

# 2) 下模型（ModelScope 优先，hf-mirror 兜底，读 config/models.yaml）
source ~/.bashrc && conda activate drama
bash scripts/download_models.sh                 # 先 --dry-run 看清单亦可

# 3) 起服务（GPU0 vLLM 常驻 + 每卡一个 Celery worker，按 GPU 钉绑）
bash scripts/start_services.sh                  # QUALITY_MODE=throughput 切吞吐档
bash scripts/start_services.sh --status

# 4) 一键出片
python run.py examples/sample_screenplay.md --project my_drama
#   成片：projects/my_drama/out/full_drama.mp4
```

本机开发/验证控制流（无 GPU，用占位引擎跑通全流程 + 真实 ffmpeg 命令构造）：
```bash
python run.py examples/sample_screenplay.md --project demo --stubs --dry-run
```

---

## 它做什么：10 阶段流水线

```
剧本.md ─S0 校验─▶ ─S1 解析─▶ ─S2 LLM分镜─▶ ─S3 角色资产─▶ ─S4 关键帧─▶
        ─S5 图生视频─▶ ─S6 配音─▶ ─S7 字幕─▶ ─S8 BGM/SFX─▶ ─S9 分集装配─▶ ─S10 全剧拼接─▶ 成片.mp4
```

一份贯穿全剧的 **manifest.json** 是唯一事实源：每个阶段读取 → 回填自己的字段 → 存盘，
因此天然**断点续跑**、可并行、可审计。详见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

---

## 输入：剧本格式

写一份 Markdown 剧本即可。解析器容错"松格式"，但遵循标准能保证零解析错误。

- **权威规范**：[docs/SCREENPLAY_FORMAT.md](docs/SCREENPLAY_FORMAT.md)
  （§2 可照抄的标准模板、§4 全部字段表、§8 会导致解析错误的写法对照表）
- **样例**：[examples/sample_screenplay.md](examples/sample_screenplay.md)
- **提交前校验**（行号 + 修复建议，error 必须修）：
  ```bash
  python -m pipeline.validate your_script.md
  ```

最小剧本：
```markdown
# 我的闪婚总裁
## 角色表
- 林晚：女，28，长黑发，清冷，白衬衫。
- 顾沉：男，32，短发，冷峻，黑西装。

### 咖啡厅 白天 内
> 顾沉（冷淡）：你就是林家大小姐？
> 林晚（倔强）：是我。这婚，我结。
```

---

## 模型栈（全部经镜像核验可达）

完整清单 + 许可证 + GPU 分配见 [config/models.yaml](config/models.yaml) 与
[docs/ARCHITECTURE.md §2](docs/ARCHITECTURE.md)。核心选型：

| 环节 | 模型 | 许可 |
|---|---|---|
| LLM 分镜/导演 | **Qwen3-32B-AWQ**（vLLM，GPU0 常驻） | Apache-2.0 |
| 关键帧图像 | **Qwen-Image-2.1** + Edit-2511（身份保持） | qwen-research / Apache |
| 图生视频 | **Wan2.2-I2V-A14B**（终渲）/ TI2V-5B（预览）/ GGUF（吞吐） | Apache-2.0 |
| 配音 TTS | **CosyVoice2-0.5B**（零样本克隆+情绪）/ GPT-SoVITS 精修 | Apache / MIT |
| 字幕对齐 | TTS 时间戳映射 + **Paraformer**（中文）/ faster-whisper（英文） | Apache / MIT |
| BGM/SFX | **ACE-Step**（生成）+ **CLAP**（本地版权库检索） | MIT / Apache |
| 装配 | **ffmpeg**（libass 硬烧字幕 + loudnorm + concat） | LGPL |

> **许可证红线**：`Qwen-Image-2.1` 是 qwen-research 条款（商用需接受），不接受则切
> Apache 组合。严禁进商业成片：FLUX.1-dev、MusicGen、MMAudio、Fish、ChatTTS、F5、YuE2。
> 每个素材留来源+许可清单，以备平台审计。

---

## 8×A800 GPU 分配

| GPU | 服务 |
|---|---|
| GPU0 | vLLM Qwen3-32B-AWQ（常驻，吸收全部 LLM fan-out） |
| GPU1 / GPU2 | 关键帧 worker A / B（Qwen-Image，2 路并行出帧） |
| GPU3+4 / GPU5+6 | 终渲 job A / B（Wan2.2-I2V-A14B，各 2 卡一 job，720p） |
| GPU7 | 音频共卡分时（CosyVoice2 + Paraformer/whisper + ACE-Step + CLAP） |
| CPU | ffmpeg 装配（与 GPU 推理重叠） |

两档可切：**质量档**（GPU3-6 四个 2 卡 bf16 终渲）/ **吞吐档**（GPU1-7 每卡一个 GGUF Q6 单卡 worker，7 路并行）。

**产能预估**（真实规模：每集 **4-5 分钟**、30 集、约 **1620 镜头**）：质量档 **~81 小时（3.4 天）/部**，
吞吐档 ~39 小时（1.6 天），终渲是绝对长杆（占 80%+）。20 集约 54 小时、50 集约 135 小时（质量档）。
磁盘：模型动物园 ~300-380GB，每剧中间产物 **~200-300GB（30集）/ ~350-500GB（50集）**。建议 `/data ≥4TB NVMe`。
详见 [docs/ARCHITECTURE.md §6](docs/ARCHITECTURE.md)。

> **渲染以"天"计，故增量存档是刚需**：`orchestrator` 每 20 镜或 300 秒落盘一次（双阈值取先到者），
> `Manifest.save()` 为原子写（临时文件 + `os.replace`）。81 小时终渲在第 80 小时崩溃，
> 也只丢最近 20 个镜头的进度，重跑同一命令自动跳过已完成部分。回归测试见
> [tests/test_checkpoint.py](tests/test_checkpoint.py)。

---

## 角色一致性（头号质量风险，四层叠加）

1. **定妆锁定**：每角色生成不可变 canonical 多视图 sheet，作全剧身份锚。
2. **主角 LoRA**：1-3 主角用 sheet+首批合格帧训角色 LoRA，跨集确定性复用。
3. **每镜多参考生成**：Qwen-Image 最多 10 张参考（sheet ± 上一合格帧）+ 固定 seed 家族。
4. **自动 QC（best-of-N 择优）**：ArcFace 人脸相似度打分，生成 N 个候选取最优；达标即提前结束省算力，
   **即使低于阈值也接受**并标记 `ACCEPTED-BELOW-THRESHOLD` 进事后 QC 报告。

> 视频链路**全自动无人值守**（人工只审剧本），因此 QC 绝不阻塞等人——只有引擎反复抛异常才判 `failed`。
> 渲染完成后查 QC 报告决定是否单独重做个别镜头：
> ```bash
> python -c "
> from pipeline.contracts import Manifest
> m = Manifest.load('projects/xxx/manifest.json')
> bad = [s for s in m.iter_shots() if s.qc.face_sim_pass is False]
> print(f'{len(bad)} 个镜头未达阈值（已自动采用最优候选）')
> for s in bad[:20]: print(' ', s.id, s.qc.face_sim)"
> ```

音色同理：CosyVoice `add_zero_shot_spk()` 持久化命名音色，之后只用 `spk_id` 调用，情绪用 instruct 标签实现"同嗓不同情绪"。详见 [docs/ARCHITECTURE.md §4](docs/ARCHITECTURE.md)。

---

## 目录结构

```
aiVideo/
├── run.py                     # 阶段 B 一键入口（视频生成）
├── scriptwriter.py            # 🚧 阶段 A 互动式剧本生成入口（待建）
├── config/models.yaml         # 模型清单（唯一事实源，全部镜像核验可达）
├── requirements-core.txt      # 核心依赖（任何机器可装，含 Windows 开发机）
├── requirements-server.txt    # GPU 全栈依赖（仅部署机）
├── docs/
│   ├── TUTORIAL.md            # ★完整使用教程（装环境→出片→排错→验收）
│   ├── ARCHITECTURE.md        # 架构与调研设计（权威结论）
│   └── SCREENPLAY_FORMAT.md   # 剧本格式标准（权威规范）
├── examples/sample_screenplay.md
├── pipeline/
│   ├── parser.py              # S1 确定性 MD 解析
│   ├── validate.py            # S0 格式校验（linter）
│   ├── contracts.py           # manifest pydantic 契约（原子写）
│   ├── orchestrator.py        # 状态机编排器（增量存档）
│   ├── subtitles.py           # S7 字幕（SRT+ASS）
│   ├── assemble.py            # S9/S10 ffmpeg 装配（纯函数命令构造）
│   ├── tasks.py               # Celery 任务（服务器执行面）
│   ├── engines/               # 模型引擎封装（llm/image/video/tts/music，延迟导入）
│   └── stages/                # 各阶段适配器（enrich/assets/keyframe/video/tts/subtitle/bgm/assemble）
├── scripts/
│   ├── install_env.sh         # 环境（conda+torch cu128+栈，国内镜像）
│   ├── download_models.sh     # 模型下载（读 models.yaml，带 429 重试）
│   └── start_services.sh      # vLLM + 每卡 Celery worker（GPU 钉绑）
└── tests/                     # 测试套件（pipeline/real_stages/scale/checkpoint/engine_factory）
```

---

## 当前状态 / 待接线

**已建成并测试通过**（本机 `pytest tests/ -q` 全绿，当前 82 个）：
- ✅ S0 校验、S1 解析、S7 字幕、S9/S10 装配（ffmpeg 命令构造）—— 全部真实实现并测过
- ✅ manifest 契约（原子写）+ 编排器状态机（增量存档）+ 断点续跑 —— 端到端跑通
- ✅ S2-S8 真实 stage 逻辑（enrich/assets/keyframe/video/tts/bgm）—— 用 mock 引擎验证了控制流：
  角色圣经、best-of-N 自动 QC、时间戳回填、BGM 选曲等
- ✅ 引擎层 `pipeline/engines/`（llm/image/video/tts/music）按调研 API 写好，延迟导入重依赖
- ✅ Celery 任务定义 + 每卡 worker 启动脚本 + GPU 钉绑调度
- ✅ 环境/模型下载脚本，全部镜像坐标核验可达
- ✅ 50 集规模压测 + 崩溃恢复测试

**已建成：阶段 A 互动式剧本生成器**（本机可跑，283 测试全绿）：
- ✅ `scriptwriter.py` CLI（new/resume/list/batch）+ 互动会话状态机 `pipeline/screenwriter/`
- ✅ 故事简介 → 设定卡 → 规格确认 → 季度弧线 → 逐集创作（多走向选择 + 自由改写）→ 审阅 → 交付
- ✅ canon 世界观圣经（角色/关系/**知识状态**/既成事实/已用桥段）+ 一致性批评 pass
- ✅ **分场景 chunked 生成**（单次调用写不下一集 6000-9000 token）+ validator 自愈循环
- ✅ 会话崩溃安全持久化（原子写、按集分片）、undo、分支树
- ✅ 确定性节奏校验 `craft.py`（时长/镜头数/对白预算，强制每集 240-300 秒）
- ✅ 交接 `run.py --from-session <名>`：剧本 + canon.json 直接进视频流水线

**待在服务器接线**（需 GPU + 真实模型；引擎接口已定义，从未在真机跑过）：
- ⏳ 装环境 → 下模型 → 起 vLLM/Celery 服务 → 把 `engines/*` 指向真实模型端点跑通一部
- ⏳ ArcFace QC 引擎（`insightface`）、LoRA trainer（musubi-tuner/ai-toolkit）—— 目前仅接口/钩子
- ⏳ S2 EnrichStage 读取 canon.json 复用 identity_blob（当前仍走 LLM 推导；接口已预留）
- ⏳ 现场 `nvidia-smi` 确认驱动 ≥580
- ⏳ 现场校准：真实单镜/单场景生成延迟，据此定 chunked 生成的并发度

接线方式：stage 的业务逻辑已写好，**唯一接线落点是引擎工厂**
[pipeline/engines/factory.py](pipeline/engines/factory.py) —— `run.py` 与
[pipeline/tasks.py](pipeline/tasks.py) 都调它，不再各自写死空 dict。工厂按
`config/models.yaml` + `AIVIDEO_*` 环境变量构造引擎，**缺哪个就跳过哪个阶段**并打印诊断
（不会崩）。服务器上只需：

```bash
export AIVIDEO_MODEL_ROOT=/data/models          # 权重根目录
export AIVIDEO_LLM_BASE_URL=http://localhost:8000/v1   # vLLM 端点
export AIVIDEO_VIDEO_MODE=final                  # final | preview | perform
export AIVIDEO_VIDEO_DEVICES=cuda:3,cuda:4       # 终渲双卡
export AIVIDEO_BGM_LIBRARY=/data/bgm_library     # 可选：本地版权曲库
```

编排器、契约、装配层全部不用改。工厂行为有 12 个测试覆盖（含优雅降级与按需构造）。

**待你确认的开放问题**见 [docs/ARCHITECTURE.md §8](docs/ARCHITECTURE.md)：参考音来源、
图像模型商用条款（Qwen-Image-2.1 是 qwen-research）、是否需要真口型（通用 I2V 无 lip-sync）、
剧本未显式分集时的自动切分依据、BGM 曲库来源、驱动版本 ≥580 现场确认。

> 已确认的产品决策：① 渲染默认**质量档**；② 集数与每集时长**用户指定、模型建议**；
> ③ **人工只审剧本**，视频链路全自动无人值守（因此视频阶段不得阻塞等人，
> S4 QC 已改为 best-of-N 自动择优）。
