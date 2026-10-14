# aiVideo —— AI 短剧全流程本地生成工作流

> 输入一份**纯文本 Markdown 剧本**，一键生成 **4–5 分钟、20–50 集**的高质量竖屏 AI 短剧，
> **全流程本地部署**，不依赖任何付费云 API，不需要科学上网。
> 目标机器：8×A800-40G（320GB 显存）、CUDA 13.0、Linux。

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

**产能预估**（4-5 分钟 / ~30 集 / 60-90 镜头）：质量档 **4-7 小时/部**（终渲是长杆），吞吐档 3-5 小时。
磁盘：模型动物园 ~300-380GB，每剧中间产物 ~100-300GB。建议 `/data ≥2TB NVMe`。

---

## 角色一致性（头号质量风险，四层叠加）

1. **定妆锁定**：每角色生成不可变 canonical 多视图 sheet，作全剧身份锚。
2. **主角 LoRA**：1-3 主角用 sheet+首批合格帧训角色 LoRA，跨集确定性复用。
3. **每镜多参考生成**：Qwen-Image 最多 10 张参考（sheet ± 上一合格帧）+ 固定 seed 家族。
4. **自动 QC 门**：ArcFace 人脸相似度阈值 + 双主角互斥校验，不达标自动重生成，2 次失败转人工。

音色同理：CosyVoice `add_zero_shot_spk()` 持久化命名音色，之后只用 `spk_id` 调用，情绪用 instruct 标签实现"同嗓不同情绪"。详见 [docs/ARCHITECTURE.md §4](docs/ARCHITECTURE.md)。

---

## 目录结构

```
aiVideo/
├── run.py                     # 一键入口
├── config/models.yaml         # 模型清单（唯一事实源）
├── docs/
│   ├── ARCHITECTURE.md        # 架构与调研设计（权威结论）
│   └── SCREENPLAY_FORMAT.md   # 剧本格式标准
├── examples/sample_screenplay.md
├── pipeline/
│   ├── parser.py              # S1 确定性 MD 解析
│   ├── validate.py            # S0 格式校验（linter）
│   ├── contracts.py           # manifest pydantic 契约（全流程数据主线）
│   ├── orchestrator.py        # 状态机编排器
│   ├── subtitles.py           # S7 字幕（SRT+ASS）
│   ├── assemble.py            # S9/S10 ffmpeg 装配（纯函数命令构造）
│   ├── tasks.py               # Celery 任务（服务器执行面）
│   └── stages/                # 各阶段适配器（base/subtitle/assemble + 待接线 GPU stage）
└── scripts/
    ├── install_env.sh         # 环境（conda+torch cu128+栈，国内镜像）
    ├── download_models.sh     # 模型下载（读 models.yaml，带 429 重试）
    └── start_services.sh      # vLLM + 每卡 Celery worker（GPU 钉绑）
```

---

## 当前状态 / 待接线

**已建成并测试通过**（本机可验证）：
- ✅ S0 校验、S1 解析、S7 字幕、S9/S10 装配（ffmpeg 命令构造）—— 全部真实实现并测过
- ✅ manifest 契约 + 编排器状态机 + 断点续跑 —— 端到端 stub 跑通（11 镜头 → 3 集 → 全剧拼接）
- ✅ Celery 任务定义 + 每卡 worker 启动脚本 + GPU 钉绑调度
- ✅ 环境/模型下载脚本，全部镜像坐标核验可达

**待在服务器接线**（需 GPU + 真实模型，接口已在 `pipeline/stages/base.py` 定义好）：
- ⏳ S2 enrich：接 vLLM（`LLM_BASE_URL`）做分镜/prompt 生成（guided_json）
- ⏳ S3 assets：定妆 sheet + LoRA 训练 + CosyVoice 音色注册
- ⏳ S4 keyframe：接 Qwen-Image-2.1（DiffSynth-Studio）+ ArcFace QC
- ⏳ S5 video：接 Wan2.2-I2V-A14B（DiffSynth）
- ⏳ S6 tts：接 CosyVoice2
- ⏳ S8 bgm：接 ACE-Step + CLAP 检索

接线方式：在 `pipeline/stages/` 下实现各真实 Stage（遵循 `base.py` 的 engine 接口），
在 `run.py:build_stages()` 的 `else` 分支注册即可，编排器/契约/装配全部不用改。

**待你确认的开放问题**见 [docs/ARCHITECTURE.md §8](docs/ARCHITECTURE.md)（参考音来源、图像模型商用条款、
是否需要真口型、自动分集切点、BGM 曲库来源、人审关卡位置、驱动版本 ≥580 现场确认）。
