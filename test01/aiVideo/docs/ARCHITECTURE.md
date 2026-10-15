# AI 短剧全流程本地生成工作流 —— 架构与调研设计

> 本文是调研 + 规划的权威结论。模型栈中的每个 repo_id 都已在 **hf-mirror.com / ModelScope** 上
> 用 curl 独立核验可达（HTTP 200）。torch wheel 已核验存在于阿里云镜像。
> 目标机器：8×A800-40G（320GB 显存）、CUDA 13.0、Linux、**不可科学上网**、全本地推理。
> 机器可读的模型清单见 [config/models.yaml](../config/models.yaml)；部署脚本见 [scripts/](../scripts/)。

---

## 1. 总体架构：单主控 JSON 状态机 + 混合执行面

一句话：**一份贯穿全剧的 JSON 清单（manifest）作为唯一事实源，10 个阶段读写同一份状态，
天然断点续跑**；控制面自研（Celery/Redis DAG），生成面用 DiffSynth-Studio 为主引擎，
ComfyUI 作为按需 GPU 微服务承接只有节点才有的能力（GGUF/block-swap/PuLID）。

为什么不用纯 ComfyUI：无法对 50 集做系统级记录（缺重试/资产库/状态机），workflow JSON
跨节点易碎，`--cuda-device` 只是可见性不自动分片，且 GPL-3.0 传染。为什么不用纯手写：
重复造扩散节点生态。故取混合。

### 目录布局（每部剧一个 project）
```
projects/<drama>/
  script.md              # 用户输入
  manifest.json          # 唯一事实源（各阶段回填，续跑状态载体）
  assets/characters/<id>/  # 定妆 sheet、LoRA、参考音
  keyframes/  drafts/  clips/  voices/  subs/  music/  episodes/  out/
  logs/  qc/
```

### 数据流（10 阶段）
```
S0 校验(CPU)         md ── validate.py ──▶ 行号级报错，通过才继续
S1 解析(CPU)         md ── parser.py ────▶ manifest: meta/characters/episodes>scenes>shots/lines
S2 LLM导演(vLLM)     manifest ──▶ 回填 visual_prompt_en / motion_prompt_en / est_seconds /
                                   character_bible / tts指令 / 音乐标签 (guided_json, 5 次调用)
S3 资产锁定(每剧1次)  characters ──▶ 定妆多视图 sheet + 主角 LoRA + CosyVoice 注册音色
                                   产出 character_manifest.json
S4 关键帧(GPU1-2)    visual_prompt + 多参考 ──▶ 1080×1920 PNG + ArcFace QC 门（不达标重生成）
S5 视频(GPU3-6)      先 480p 预览(5B) 校时 ──▶ 终渲 720p Wan2.2-I2V-A14B(81帧@16fps≈5s)
S6 TTS(GPU7)         spk_id + 情绪标签 ──▶ 24k wav + word_timestamps
S7 字幕(CPU/GPU7)    TTS时间戳映射剧本文本 ──▶ SRT + 短剧风 ASS（ASR 安全网校正）
S8 BGM/SFX(GPU7)     音乐标签 ──▶ CLAP 检索本地库 / ACE-Step 生成，自动 ducking
S9 分集装配(CPU)     ffmpeg 归一 1080×1920/30fps/48k + 硬烧 ASS + 混音 loudnorm -16LUFS ─▶ epXX.mp4
S10 全剧拼接(CPU)    concat demuxer 不重编码 ─▶ full_drama.mp4
```

**JSON 契约（跨阶段回填，全部可空，由对应阶段填）** —— 见 [pipeline/contracts.py](../pipeline/contracts.py)：
```
shot: {id, episode_id, character_ids[], scene, mood, camera, action, on_screen_text,
       visual_prompt_en, motion_prompt_en, est_seconds, num_frames, seed, ref_ids[],
       keyframe_path, draft_clip_path, clip_path, audio_path, word_timestamps[],
       srt_path, ass_path, bgm_pick, episode_path, status, qc{face_sim, notes},
       artifacts{model, version, prompt_hash}}
```

---

## 2. 推荐模型栈（全部镜像核验通过）

| 子系统 | 模型 | repo_id | 镜像 | 许可 | GPU | 显存 |
|---|---|---|---|---|---|---|
| **LLM 解析/分镜/导演** | Qwen3-32B-AWQ (dense) | `Qwen/Qwen3-32B-AWQ` | ModelScope | Apache-2.0 | GPU0 常驻 | AWQ ~22GB 单卡 |
| LLM 高吞吐 worker | Qwen3-30B-A3B-2507 (MoE, 262k ctx) | `Qwen/Qwen3-30B-A3B-Instruct-2507` | ModelScope | Apache-2.0 | GPU0+1 按需 | bf16 ~60GB TP2 |
| **T2I 关键帧(主)** | Qwen-Image-2.1 (7B, 多参考) | `Qwen/Qwen-Image-2.1` | ModelScope | ⚠ qwen-research | GPU1/2 | bf16 ~18-20GB |
| 身份保持编辑(Apache) | Qwen-Image-Edit-2511 | `Qwen/Qwen-Image-Edit-2511` | ModelScope | Apache-2.0 | GPU1/2 按需 | fp8 ~18-22GB |
| **I2V 终渲(主)** | Wan2.2-I2V-A14B (MoE 双专家) | `Wan-AI/Wan2.2-I2V-A14B-Diffusers` | ModelScope | Apache-2.0 | GPU3-6 (2卡/job) | bf16 ~55-60GB 2卡 |
| I2V 快速预览 | Wan2.2-TI2V-5B | `Wan-AI/Wan2.2-TI2V-5B-Diffusers` | ModelScope | Apache-2.0 | 每卡1路(8路) | bf16 ~12-14GB |
| 表演/动作特写 | Wan2.2-Animate-2-14B | `Wan-AI/Wan2.2-Animate-2-14B` | ModelScope | Apache-2.0 | 同视频池 | bf16 2卡 |
| GGUF 单卡吞吐档 | Wan2.2-I2V-A14B-GGUF | `QuantStack/Wan2.2-I2V-A14B-GGUF` | hf-mirror | Apache 派生 | 单卡 Q6_K(7路) | ~24GB |
| **TTS 配音(主)** | CosyVoice2-0.5B | `iic/CosyVoice2-0.5B` | ModelScope | Apache-2.0 | GPU7 常驻 | 2-4GB |
| 主角音色精修 | GPT-SoVITS | `AI-ModelScope/GPT-SoVITS` | ModelScope | MIT | GPU7 按需 | 推理2-4GB |
| 字幕中文对齐 | FunASR Paraformer-large | `iic/speech_seaco_paraformer_large_...vocab8404-pytorch` | ModelScope | Apache-2.0 | GPU7 | 2-4GB |
| ASR 英文安全网 | faster-whisper large-v3 | `Systran/faster-whisper-large-v3` | hf-mirror | MIT | GPU7/CPU | int8 2-3GB |
| ASR QC/事件 | SenseVoiceSmall | `iic/SenseVoiceSmall`(ms) / `FunAudioLLM/SenseVoiceSmall`(hf) | 双镜像 | Apache-2.0 | GPU7 | 2-4GB |
| **BGM 定制(主)** | Ace-Step1.5 turbo | `ACE-Step/Ace-Step1.5` | ModelScope | MIT | GPU7 按需 | bf16 ~20-24GB |
| BGM 批量 | ACE-Step-v1-3.5B | `ACE-Step/ACE-Step-v1-3.5B` | ModelScope | Apache-2.0 | GPU7 | 16-18GB |
| BGM/SFX 库检索 | CLAP htsat-unfused | `laion/clap-htsat-unfused` | hf-mirror | Apache-2.0 | CPU/单卡 | ~1GB |
| 装配/烧字幕/拼接 | ffmpeg 8.x (libass) + Celery/Redis | conda-forge / pip | 清华/阿里 | LGPL/GPL | CPU | 0 |

> **许可证红线（商用成片必看）**：`Qwen-Image-2.1` 是 qwen-research 条款（需注册接受），
> 若商业发布不接受，切 Apache 组合 = `Qwen-Image` + `Qwen-Image-Edit-2511`。
> 严禁进商业成片的 NC/研究权重：FLUX.1-dev、MusicGen、MMAudio 官方权重、Fish、ChatTTS、F5、YuE2。
> 每个素材都要留来源+许可清单，以备抖音/快手审计。见 models.yaml 的 `license`/`commercial_ok` 字段。

---

## 3. 8×A800-40G GPU 分配

原则：**LLM 常驻、视频独占、轻服务共卡分时**。

| GPU | 服务 | 精度 | 显存 |
|---|---|---|---|
| **GPU0** | vLLM Qwen3-32B-AWQ（常驻，连续批处理，吸收数百 prompt fan-out） | AWQ int4 (awq_marlin) | ~22GB + KV |
| **GPU1** | 关键帧 worker A：Qwen-Image-2.1 + Edit-2511 按需 | bf16 / fp8 | ~20GB |
| **GPU2** | 关键帧 worker B（2 路并行出帧） | bf16 | ~20GB |
| **GPU3+4** | 终渲 job A：Wan2.2-I2V-A14B（HighNoise/LowNoise 各一卡 + pipeline parallel，720p） | bf16 | ~55-60GB |
| **GPU5+6** | 终渲 job B（共 2 路 720p 并行） | bf16 | ~55-60GB |
| **GPU7** | CosyVoice2 + Paraformer/whisper ASR + ACE-Step（载入即卸）+ CLAP；预览阶段跑 TI2V-5B | 混合 | 分时 |

**两档可切换**（按队列优先级）：
- **质量档**：4 个 2-GPU bf16 终渲（GPU3-6），720p，画质最佳。
- **吞吐档**：GPU1-7 全转视频，每卡一个 QuantStack GGUF Q6_K 单卡 worker，**7 路并行**（轻微画质差）。
- **预览/animatic 档**：Wan2.2-TI2V-5B 每卡一个（8 路），快速校时。

**调度**：Celery+Redis，队列 `llm/keyframe/preview/video/tts/asr/music/assembly`；
每物理 GPU 一个 `--concurrency=1` worker，`CUDA_VISIBLE_DEVICES` 钉死；任务在独立子进程跑，
结束即退释放显存；assembly/ffmpeg 走 CPU 队列与 GPU 推理重叠。
`Qwen3-235B-A22B-FP8`（TP=8）仅在整机空闲时作为排队的"资深导演"任务，不上热路径。

---

## 4. 角色一致性策略（头号质量风险，四层叠加）

单一方法无法跨 20-50 集，必须叠加，强层在前：

1. **ASSET/LOCK（每剧一次）**：每角色生成不可变 canonical 多视图定妆 sheet（正/3-4/侧/多表情/
   固定服化道/标志物），作为所有后续调用的身份锚，存 `assets/characters/<id>/`。
2. **主角 LoRA（最强层）**：1-3 个常驻主角用 sheet + 首批合格帧 15-30 张裁脸训角色 LoRA
   （musubi-tuner / ai-toolkit），scale 0.6-0.9，跨集确定性复用，优于纯参考。
3. **每镜多参考条件生成**：Qwen-Image-2.1 最多 10 张参考（sheet ± 上一合格帧），身份/姿态权重调参；
   需改姿态/表情且保身份时走 Apache 的 Qwen-Image-Edit-2511；双主角同框用多参考/StoryMaker；
   固定 per-character seed 家族。
4. **自动 QC 关卡**：ArcFace 人脸嵌入相似度阈值 + 双主角互斥校验，不达标自动重生成；
   可选 Qwen2.5-VL critic 核查服装/标志物/中文画面文字并回写 prompt；2 次失败转人工。

**音色一致性平行闭环**：建角时 CosyVoice `add_zero_shot_spk()` + `save_spkinfo()` 持久化命名音色，
之后只用 `spk_id` 调用（不重传参考），情绪用 instruct2/行内标签实现"同嗓不同情绪"；
招牌主角再用 GPT-SoVITS 微调兜底。

---

## 5. 环境与部署要点（CUDA13 / 国内镜像）

- **torch**：推荐冻结 **cu128 + torch 2.8.0** 基线（在 CUDA13 驱动上次版本兼容，生态最稳）。
  已核验 `torch-2.8.0+cu128-cp311` (889MB) 存在于 `mirrors.aliyun.com/pytorch-wheels/cu128/`。
  原生 **cu130** wheel 也存在（`torch-2.14.1+cu130`, 554MB），但 xformers/flash-attn/vllm/节点
  在 cu128 上验证更充分，**默认 cu128**，cu130 仅在驱动/依赖全部对齐后再切。
- **驱动**：CUDA13 需驱动 **≥580** 才保证 cu128 前向兼容——上线前 `nvidia-smi` 现场确认。
- **A800 = Ampere (sm80)，无原生 FP8 张量核**：所有 fp8/NVFP4 仅省显存、计算 upcast 且偏慢；
  **bf16 / GGUF 才是稳妥路径**，MoE FP8 需实测基准。
- **镜像**：pip→阿里云/清华；conda→清华；模型→ModelScope 优先（国内 CDN），hf-mirror 补
  Comfy-Org/PuLID/CLAP/whisper；`HF_ENDPOINT=https://hf-mirror.com` + `HF_HUB_ENABLE_HF_TRANSFER=1`。
- **GitHub 被墙**：ComfyUI 及自定义节点默认 `git clone` 会失败——从 gitcode.com/gitee 镜像离线预装，
  运行时不依赖联网 git；hf-mirror 大文件偶发 429 需重试。
- **磁盘**：模型动物园 ~300-380GB；每剧中间产物（PNG+ProRes 母带+音频）在真实规模下
  **~200-300GB（30集）/ ~350-500GB（50集）**，可清理。建议 `/data ≥4TB NVMe`
  （容纳模型 + 2-4 部剧中间产物），系统盘另留 100GB。详见 §6 磁盘表与母带清理策略。

详见 [scripts/install_env.sh](../scripts/install_env.sh) 与 [scripts/download_models.sh](../scripts/download_models.sh)。

---

## 6. 产能与时间预估（真实规模）

**规模基准**：每集 **4-5 分钟**（不是短视频切片），20-50 集 → 全剧 **80-250 分钟**。
每集约 5-10 场景、**48-60 镜头**（按 3-8 秒/镜），全剧约 **1000-3000 镜头**。
下表以 **30 集 / ~1620 镜头** 为基准（这是典型配置）。

| 阶段 | 墙钟（8×A800，30集/~1620镜） | 说明 |
|---|---|---|
| S1 解析 | 秒级 | 实测 50集/300镜 0.03s；1620 镜仍为亚秒级 |
| S2 LLM 导演 | **10-30 分钟** | 场景级批量：~210 次 guided_json 调用（每场景 1 次，非每镜），canon 复用时角色圣经 0 次推导 |
| S3 资产 + 训 LoRA | 定妆 ~10 分钟；主角 LoRA 30-90 分钟 | **每剧一次性**，不随集数增长 |
| S4 关键帧 | **2-5 小时** | 1620 帧，2 worker，每帧 3-10s + QC 重生成 |
| S5 视频（终渲） | **~81 小时（3.4 天）← 绝对长杆** | 单镜 4-8 分钟 / 2 卡，2 路并行 |
| S5 视频（吞吐档） | ~39 小时（1.6 天） | GGUF Q6 单卡 7 路并行，画质略降 |
| S5 预览（480p 5B） | 3-6 小时 | 8 路并行，终渲前校时校运镜 |
| S6 TTS | 0.5-1.5 小时 | 全剧约 2 小时语音，RTF 0.2-0.5 |
| S7+S8 字幕/BGM | 1-2 小时 | 字幕 CPU 极快；BGM 每集一条（30 条） |
| S9+S10 装配 | 2-5 小时 | 1620 镜逐个 ffmpeg 归一 + 30 集拼接，CPU 多核并行 |
| **总计（质量档）** | **~85-100 小时 ≈ 3.5-4 天/部** | 终渲占 80%+ |
| **总计（吞吐档）** | **~45-55 小时 ≈ 2 天/部** | |

### 不同集数的渲染耗时（S5 终渲主导）

| 规模 | 镜头数 | 质量档 | 吞吐档 |
|---|---|---|---|
| 20 集 | ~1080 | ~54 小时（2.3 天） | ~26 小时（1.1 天） |
| **30 集** | **~1620** | **~81 小时（3.4 天）** | **~39 小时（1.6 天）** |
| 50 集 | ~2700 | ~135 小时（5.6 天） | ~64 小时（2.7 天） |

### 磁盘

| 项目 | 30 集 | 50 集 |
|---|---|---|
| 模型动物园（固定） | 300-380GB | 300-380GB |
| ProRes 母带（~90-140MB/镜） | 150-230GB | 250-380GB |
| 关键帧 PNG + 音频 + 成片 | 20-40GB | 35-65GB |
| **每剧中间产物合计** | **~200-300GB** | **~350-500GB** |

建议 `/data ≥4TB NVMe`（模型 + 2-4 部剧的中间产物）；母带可清理策略必备——
按原 2TB 估算只够 5-8 部剧，规模化生产会撑爆。

### 规模带来的架构后果（必须处理，见 §7）

1. **渲染以"天"计** → 增量存档是刚需。`orchestrator._run_per_shot()` 已改为按
   镜头数/耗时双阈值落盘（默认 20 镜或 300 秒），`Manifest.save()` 已改为原子写
   （临时文件 + `os.replace`），避免 81 小时任务崩溃后从头重渲或留下半截 JSON。
   回归测试见 `tests/test_checkpoint.py`。
2. **单份 manifest.json 在 3000 镜头下约 10-20MB** → `tasks.py` 每个任务全量
   load+save 且持全局 fcntl 锁，数万次任务下有争用与单点损坏风险。建议按集分片
   （`manifests/ep001.json` + 轻量索引）。
3. **S9 装配是 ~1620 个独立 ffmpeg 进程** → 可接受，但应按集批处理并限制并发，
   避免 CPU 争抢拖慢与 GPU 重叠的收益。
4. **S7 字幕产生 ~1620 组 SRT/ASS 文件** → 建议按集合并而非按镜头散文件。
5. **全自动视频链路不得阻塞等人**（产品决策 #3）→ `keyframe.py` 的
   `needs_human` 分支会让无人值守的 3000 镜头任务死锁，须改为 best-of-N 自动择优
   + 事后 QC 报告。

---

## 7. Top 风险与缓解

> 产品决策：**人工只审剧本，视频链路全自动**（渲染以"天"计，无人值守）。因此凡"人工抽检/
> 人审"类缓解都不适用于视频阶段——视频阶段必须靠**自动 QC + 事后报告**，绝不能阻塞等人。

1. **角色一致性漂移**（头号质量风险）→ 四层策略（定妆 sheet + 主角 LoRA + 多参考 + 固定 seed）
   + ArcFace **自动** best-of-N 择优；低于阈值不阻塞，取最优并记入**事后 QC 报告**供渲染完复盘。
2. **无人值守链路死锁**（决策 #3 直接后果）→ `keyframe.py` 现返回 `needs_human` 会卡死 3000 镜任务；
   须改为 best-of-N 自动降级 + QC 报告。**这是全自动模式下必须消除的阻塞点**。
3. **数十小时渲染中途崩溃丢进度** → `orchestrator._run_per_shot()` 增量存档（20 镜/300 秒双阈值）
   + `Manifest.save()` 原子写（临时文件 + `os.replace`）。回归测试 `tests/test_checkpoint.py`。
4. **单份 manifest 10-20MB / 数万任务全量读写争用** → `tasks.py` 全局 fcntl 锁每任务 load+save；
   建议按集分片（`manifests/epXXX.json` + 轻量索引）或改 sqlite/redis 存储。
5. **CUDA13/torch 生态** → 冻结 cu128+torch2.8，驱动 ≥580，vllm/xformers/flash-attn 版本严格对齐。
6. **A800 无原生 FP8** → 走 bf16/GGUF，MoE FP8 实测后再定。
7. **Wan A14B 双专家显存尖峰 OOM** → 2 卡 bf16 或 GGUF Q6 + tiled VAE。
8. **许可证合规** → 见 §2 红线；商用切 Apache 图像组合；留素材许可清单备平台审计。
9. **GitHub 被墙** → gitcode/gitee 离线镜像，运行时不联网 git。
10. **口型不同步** → 通用 I2V 无 lip-sync；对话特写走 Wan2.2-Animate-2 或音频驱动口型模型。
11. **TTS 时长 vs 镜头时长 / 采样率** → 对齐阶段做时长微调；统一 24k→48k 重采样。
12. **无损 concat 失败** → 强制统一渲染规格（codec/分辨率/fps/SAR/timebase）；BGM 自动 ducking。
13. **磁盘撑爆** → 30 集母带 ~200-300GB、50 集 ~350-500GB；`/data ≥4TB`，母带出片后即可清理。
14. **全自动质量上限** → 剧本阶段人工把关（唯一人审点）+ 视频阶段自动 QC 报告事后复盘；
    接受"完全无人值守可能放出个别废镜"，用 best-of-N + 报告把风险降到可接受。

---

## 8. 待用户确认的开放问题

1. 每角色 5-15s 干净参考音由谁提供（用户自备 / AI 生成占位）？无参考音时是否允许先 TTS 自建声库再克隆？
2. `Qwen-Image-2.1`（qwen-research）商业条款能否接受，还是强制切 Apache 组合？
3. 成片 720p 是否足够，还是 hero 镜头需 1080p 超分/重渲（加时长）？
4. 是否需要真口型（引入音频驱动 lip-sync 子系统），还是接受 Animate-2 近似？
5. 剧本未显式分集时，自动切分的 20-50 集切点以什么为准（场景时长 / 钩子点）？
6. BGM 版权库从哪些可达站点冷启动入库？是否有内部曲库？
7. 是否需要人审关卡及位置（定妆 / 关键帧 / 终渲后），还是全自动出片后仅抽审？
8. 服务器实际驱动是否 ≥580（决定能否直接用 cu128 前向兼容），需现场 `nvidia-smi` 确认。
