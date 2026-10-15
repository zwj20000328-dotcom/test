# AI 短剧全流程工作流 · 使用教程

> 从"一段故事简介"到"20-50 集完整短剧成片"的端到端操作手册。
> 目标机器：8×A800-40G · CUDA 13.0 · Linux · 全程国内镜像 · 全本地推理。

**实现状态标记**：✅ 已实现并通过测试 · 🚧 设计已确认、代码待建 · ⏳ 需服务器现场接线

---

## 目录

- [0. 全流程总览](#0-全流程总览)
- [1. 环境准备（一次性）](#1-环境准备一次性)
- [2. 准备剧本](#2-准备剧本)
  - [2A. 互动式生成 ✅](#2a-路径-a互动式剧本生成-)
  - [2B. 手写剧本 ✅](#2b-路径-b手写剧本-)
- [3. 校验剧本 ✅](#3-校验剧本-)
- [4. 本机预演（无 GPU）✅](#4-本机预演无-gpu-)
- [5. 启动推理服务 ✅](#5-启动推理服务-)
- [6. 出片 ✅](#6-出片-)
- [7. 监控 · 断点续跑 · 退出码 · 排错](#7-监控--断点续跑--退出码--排错)
- [8. 验收与产物](#8-验收与产物)
- [附录 A. 命令速查](#附录-a-命令速查)
- [附录 B. 目录结构](#附录-b-目录结构)
- [附录 C. 常见问题](#附录-c-常见问题)

---

## 0. 全流程总览

```
┌─────────────────────── 阶段 A：剧本创作（人参与）───────────────────────┐
│                                                                        │
│  故事简介 ──▶ 世界观设定卡 ──▶ 两级节拍表 ──▶ 逐集创作循环 ──▶ 交付      │
│              (模型建议规格)   (季度+每集弧线)  (选走向/改剧情)            │
│                                                    │                   │
│                                          screenplay.md + canon.json    │
└────────────────────────────────────────────────────┼───────────────────┘
                                                     ▼
┌─────────────────── 阶段 B：视频生成（全自动，无人在环）──────────────────┐
│                                                                        │
│  S0 校验 ─▶ S1 解析 ─▶ S2 LLM分镜 ─▶ S3 角色资产 ─▶ S4 关键帧(+QC)      │
│                                                                        │
│        ─▶ S5 图生视频 ─▶ S6 配音 ─▶ S7 字幕 ─▶ S8 BGM ─▶ S9/S10 装配    │
│                                                                        │
│                                              full_drama.mp4 + epXX.mp4 │
└────────────────────────────────────────────────────────────────────────┘
```

**一份 `manifest.json` 贯穿阶段 B 全程**：每个阶段读取 → 回填自己的字段 → 原子落盘，
因此天然支持断点续跑与并行。

**规模基准**（30 集配置）：

| 指标 | 数值 |
|---|---|
| 每集时长 | 4-5 分钟（240-300 秒） |
| 全剧总长 | 80-250 分钟 |
| 每集场景/镜头 | 5-10 场景 · 48-60 镜头 |
| 全剧镜头总数 | ~1000-3000（30 集约 1620） |
| 渲染耗时 | 质量档 **~81 小时（3.4 天）** · 吞吐档 ~39 小时 |
| 磁盘占用 | 模型 300-380GB + 每剧中间产物 200-300GB |

---

## 1. 环境准备（一次性）

### 1.1 确认驱动 ✅

CUDA 13 需驱动 **≥580** 才能保证 cu128 wheel 前向兼容。

```bash
nvidia-smi --query-gpu=index,name,memory.total,driver_version --format=csv
```

期望看到 8 张 A800-40G、`Driver Version` ≥ 580。若低于 580：先升驱动，或改用 cu124 基线。

### 1.2 安装环境 ✅

```bash
cd /path/to/aiVideo
bash scripts/install_env.sh
```

脚本会依次完成（**全程国内镜像，无需科学上网**）：

| 步骤 | 内容 | 镜像 |
|---|---|---|
| 1 | Miniconda + `~/.condarc` | 清华 anaconda |
| 2 | conda 环境 `drama`（Python 3.11） | 清华 |
| 3 | ffmpeg（conda-forge，**自带 libass** 用于硬烧字幕） | 清华 conda-forge |
| 4 | pip 镜像配置 | 阿里云 |
| 5 | **torch 2.8.0+cu128** | `mirrors.aliyun.com/pytorch-wheels/cu128` |
| 6 | 推理栈（vLLM/diffusers/transformers/modelscope/funasr/celery/insightface…） | 阿里云 PyPI |
| 7 | 写入镜像环境变量到 `~/.bashrc` | — |

可调参数：

```bash
ENV_NAME=drama PY_VER=3.11 MODEL_ROOT=/data/models bash scripts/install_env.sh
```

**验证安装**（脚本末尾会自动跑，也可手动确认）：

```bash
source ~/.bashrc && conda activate drama
python -c "import torch;print(torch.__version__, torch.version.cuda, torch.cuda.is_available(), torch.cuda.device_count())"
# 期望：2.8.0+cu128 12.8 True 8
ffmpeg -version | grep -o -- '--enable-libass'
# 期望：--enable-libass
```

> **为什么是 cu128 而不是 cu130**：cu130 原生 wheel 确实存在（已核验 `torch-2.14.1+cu130`
> 在阿里云镜像），但 xformers / vLLM / flash-attn / 各自定义节点在 cu128 上验证更充分。
> cu128 运行时在 CUDA 13 驱动上通过次版本兼容正常工作。
>
> **A800 无原生 FP8**：A800 是 Ampere 架构（sm80），没有 FP8 张量核。所有 fp8/NVFP4 只能省显存，
> 计算需 upcast 反而更慢。因此本方案走 **bf16 / GGUF**，不要用 fp8 提速。

### 1.3 下载模型 ✅

```bash
bash scripts/download_models.sh --dry-run      # 先看清单，不下载
bash scripts/download_models.sh                # 下载全部必需模型
```

常用变体：

```bash
bash scripts/download_models.sh --include-optional   # 连可选模型（Qwen3-14B/VL/GPT-SoVITS/SenseVoice）
bash scripts/download_models.sh --only video         # 只下视频子系统
bash scripts/download_models.sh --only tts           # 只下语音子系统
```

脚本特性：读 [config/models.yaml](../config/models.yaml) 作为唯一事实源；ModelScope 优先（国内 CDN），
hf-mirror 兜底；**429 自动重试**（modelscope 5 次 / hf 5 次）。

下载清单（共 14 个必需模型，全部已 curl 核验可达）：

| 子系统 | 模型 | 通道 |
|---|---|---|
| LLM | Qwen3-32B-AWQ · Qwen3-30B-A3B-Instruct-2507 | ModelScope |
| 图像 | Qwen-Image-2.1 · Qwen-Image-Edit-2511 | ModelScope |
| 视频 | Wan2.2-I2V-A14B-Diffusers · Wan2.2-TI2V-5B-Diffusers · Wan2.2-Animate-2-14B | ModelScope |
| 视频(吞吐档) | Wan2.2-I2V-A14B-GGUF | hf-mirror |
| 语音 | CosyVoice2-0.5B · Paraformer-large | ModelScope |
| ASR | faster-whisper-large-v3 | hf-mirror |
| 音乐 | Ace-Step1.5 · ACE-Step-v1-3.5B | ModelScope |
| 检索 | CLAP htsat-unfused | hf-mirror |

**磁盘检查**：

```bash
df -h /data          # 需 ≥4TB 空闲（模型 380GB + 2-4 部剧中间产物）
du -sh /data/models  # 下载完应为 300-380GB
```

> **许可证红线**（商用必看，详见 [config/models.yaml](../config/models.yaml) 的 `forbidden_for_commercial`）：
> `Qwen-Image-2.1` 是 qwen-research 条款（需注册接受），不接受则切 Apache 组合
> （`Qwen-Image` + `Qwen-Image-Edit-2511`）。严禁进商业成片：FLUX.1-dev、MusicGen、
> MMAudio 官方权重、Fish-Speech、ChatTTS、F5-TTS、YuE2。请为每个素材保留来源+许可清单以备平台审计。

### 1.4 准备参考音（可选，影响配音质量）⏳

短剧需要每个角色有固定音色。两种做法：

```bash
mkdir -p assets/voice_refs
# 方式一：自备 5-15 秒干净单人无背景音的参考音，按角色 id 或角色名命名
cp 林晚.wav assets/voice_refs/林晚.wav
cp 顾沉.wav assets/voice_refs/顾沉.wav
# 方式二：不提供 —— S3 会用 TTS 自建占位音色（一致性略差，但可跑通）
```

CosyVoice 会在 S3 阶段用 `add_zero_shot_spk()` 注册并持久化这些音色，
之后 20-50 集只用 `spk_id` 调用，保证**同嗓不同情绪**。

---

## 2. 准备剧本

有两条路径。**路径 B 现在就能用**，路径 A 是本项目要新建的互动式生成器。

### 2A. 路径 A：互动式剧本生成 ✅

> **状态：设计已确认，代码待建。** 以下是它将提供的操作方式（作为验收契约）。
> 命令名以最终实现为准。

#### 启动一个新项目

```bash
python scriptwriter.py new --title 闪婚之后满级大佬
```

**第 1 屏 · 输入故事简介**

```
请输入故事简介（结束请输入单独一行 EOF）：
> 落魄千金林晚为凑母亲手术费，闪婚陌生男人顾沉。
> 婚后她发现这个"穷小子"竟是全城最神秘的商业帝王。
> 一场契约婚姻，逐渐动了两颗心。
> EOF
```

**第 2 屏 · 世界观设定卡**（模型产出，等你确认）

```
┌─ 设定卡 ─────────────────────────────────────────────┐
│ 题材      都市 / 甜宠 / 逆袭                          │
│ 基调      先抑后扬，爽点密集                          │
│ 时代背景  当代都市                                    │
│ 核心冲突  契约婚姻 vs 真情；身份隐瞒 vs 信任           │
│ 爽点类型  身份反差 · 打脸 · 逆袭                      │
├─ 角色表（外形将决定全剧长相一致性）───────────────────┤
│ 林晚  女 28  长直黑发及腰，鹅蛋脸，杏眼，白色职业装，  │
│              颈间银色细项链（母亲所赠，标志物）        │
│ 顾沉  男 32  利落短碎发，剑眉星目，下颌线锋利，        │
│              深黑高定西装，左腕铂金腕表                │
│ 苏曼  女 30  精致卷发，红唇，名媛华服，眼神刻薄（继姐）│
└──────────────────────────────────────────────────────┘
确认？[Y/n/修改]
```

> **这一步最关键**：角色外形在此定死，后续 1000-3000 个镜头的长相一致性全靠它。
> 描述越具体（发型/脸型/眼型/体态/标志服装配饰），一致性越好。

**第 3 屏 · 规格确认**（模型建议，用户拍板）

```
模型建议：30 集 × 4.5 分钟
  理由：故事含 3 条主线（婚姻契约/身份揭秘/家族阴谋），
        按每集 1 个主要推进点估算需 28-32 集。
  预计：1620 镜头 · 渲染约 3.4 天 · 磁盘约 250GB

接受建议？[Y/n] 或直接输入，如「40 集 × 4 分钟」
```

**第 4 屏 · 季度节拍表**（模型规划全局弧线）

```
┌─ 季度弧线（30 集）───────────────────────────────────┐
│ 开篇钩子   1-3   契约婚姻成立，身份反差首次露出        │
│ 冲突升级   4-10  继姐刁难，男主暗中护妻，误会累积       │
│ 中期反转  11-14  ★身份揭穿（重大反转落点）             │
│ 高潮      15-24  家族阴谋，女主危机，男主力挽狂澜       │
│ 收尾      25-30  打脸完成，感情落定，留续集钩子         │
├─ 知识状态表（谁能何时知道什么）───────────────────────┤
│ 顾沉真实身份 → 林晚 第11集 才知                       │
│ 林母病情真相 → 林晚 第18集 才知                       │
└──────────────────────────────────────────────────────┘
调整？[Y/n] 如「中期反转提到第8集」
```

**第 5 屏起 · 逐集创作循环**（重复 30 次）

每集四步：

```
═══ 第 5 集 · 冲突升级 ═══════════════════════════════════
处境：苏曼在林家客厅当众羞辱林晚，顾沉尚未现身

请选择剧情走向：
┌──┬──────────────────────┬──────────┬──────────────────┐
│  │ 方向                 │ 基调     │ 影响 / 后果        │
├──┼──────────────────────┼──────────┼──────────────────┤
│1 │ 泼水羞辱，林晚隐忍    │ 压抑蓄势 │ 男主门外目睹，     │
│  │                      │          │ 埋护妻伏笔 · 风险低│
│2 │ 林晚当场反将一军      │ 爽点前置 │ 苏曼记恨升级 ·     │
│  │                      │          │ 风险中(需强反派动机)│
│3 │ 顾沉电话介入镇场      │ 甜宠     │ 身份线索外露，     │
│  │                      │          │ 林晚起疑 · 风险中  │
└──┴──────────────────────┴──────────┴──────────────────┘
选择 [1-3] · 或直接输入改动 · /skip /back /branch /status
>
```

三种回应方式都支持：

```
> 2                          # 选第 2 个走向
> 让林晚泼回去，但被林父打断   # 自由改写剧情
> /back 3                    # 回退 3 步
```

模型随后**分场景生成**该集正文（⚠️ 一集 48-60 镜 ≈ 6000-9000 token，单次调用会被截断，
必须分块生成再拼装），然后自动跑校验与一致性检查：

```
生成中：场景 1/6 ▓▓▓▓░░░░░░  (预计 40s)
✓ validate 通过（0 error）
⚠ 一致性检查发现 1 处矛盾：
   第5集 林晚提及"母亲手术已完成"，但 canon 记录手术在第9集
   → 已自动修正为"手术费还没凑齐"
```

**第 6 屏 · 审阅**（读摘要，不必读全文）

```
第 5 集摘要（预计 4分32秒 · 7场景 · 54镜头）
  场景1 林家客厅 白天 内  ── 苏曼挑衅，林晚隐忍        52s
  场景2 林家客厅 白天 内  ── ★林晚泼回去，林父打断     61s
  ...
  场景7 别墅门外 夜   外  ── 钩子：顾沉的车停在门外     38s

[enter] 展开场景 · a 接受 · r 修改 · g 重生成 · b 从此分支 · n 下一集
```

**随时可用的命令**：

| 命令 | 作用 |
|---|---|
| `/status` | 当前进度（第几集/共几集、字数、预计时长） |
| `/back N` | 回退 N 步 |
| `/undo` | 撤销上一次修改 |
| `/branch list` | 查看分支树 |
| `/branch goto 2` | 切到分支 2 探索，不满意可回主干 |
| `/canon` | 查看/编辑世界观设定与知识状态表 |
| `/autopilot on` | 自动推进（模型自选走向），你可随时打断否决 |
| `/render` | 交付并启动视频生成 |

**改动波及范围保护**（改早期集数时）：

```
> 把苏曼改成顾沉的初恋

⚠ 此改动影响第 5-30 集（共 26 集需重写）
  原因：苏曼动机线贯穿全剧，身份变更导致 12 处情节失效
  预计重生成耗时：约 25 分钟

确认继续？[y/N] 或输入「只改第5集」缩小范围
```

**交付**：

```
> /render

┌─ 交付确认 ────────────────────────────────────────────┐
│ 剧本      30 集 · 1618 镜头 · 预计总时长 2小时16分     │
│ 校验      ✓ validate exit 0（0 error, 2 warning）      │
│ 渲染预估  质量档 ~81 小时（3.4 天）                     │
│           吞吐档 ~39 小时（1.6 天）                     │
│ 磁盘      需 ~250GB（当前 /data 可用 3.2TB）✓          │
│ 音色      3 主角已注册，2 配角用占位音色                │
└───────────────────────────────────────────────────────┘
启动渲染？[y/N]
→ 输出 sessions/闪婚之后满级大佬/screenplay.md
→ 输出 sessions/闪婚之后满级大佬/canon.json
→ 已启动：python run.py --from-session 闪婚之后满级大佬
```

**恢复中断的会话**：

```bash
python scriptwriter.py resume 闪婚之后满级大佬     # 从上次断点继续
python scriptwriter.py list                        # 列出所有会话
```

**无人值守批量模式**（用于自动化/测试）：

```bash
python scriptwriter.py batch \
  --synopsis synopsis.txt \
  --episodes 30 --episode-seconds 270 \
  --policy max-tension \          # 自动选走向策略：max-tension / safest / sweet
  --out sessions/auto_drama
```

---

### 2B. 路径 B：手写剧本 ✅

现在就能用。写一份符合规范的 Markdown 即可。

**权威规范**：[docs/SCREENPLAY_FORMAT.md](SCREENPLAY_FORMAT.md)
（§2 可照抄模板 · §4 全部字段表 · §8 会导致解析错误的写法对照表）

**样例**：[examples/sample_screenplay.md](../examples/sample_screenplay.md)

最小可用剧本：

```markdown
---
title: 我的闪婚总裁
genre: 都市 / 甜宠
style: 写实电影感，暖色调
aspect_ratio: "9:16"
language: zh
target_episodes: 30
episode_seconds: 270
---

# 我的闪婚总裁

## 角色表

- **林晚**：女，28岁。长直黑发及腰，鹅蛋脸，杏眼，白色职业装，颈间银色细项链。
- **顾沉**：男，32岁。利落短碎发，剑眉星目，深黑高定西装，左腕铂金腕表。

## 第一集 · 契约

### 场景 1：民政局门口 · 白天 · 外

**人物**：林晚（白衬衫，紧张），顾沉（黑西装，冷峻）
**环境**：灰白民政局大楼，正午阳光刺眼
**氛围**：紧张、命运感
**镜头**：远景俯拍，两人在台阶上对立而站。
**动作**：林晚深吸一口气，攥紧户口本。
> 林晚（内心OS）：只要领了这本证，妈妈的手术费就有了。
**镜头**：中景，顾沉递来一支笔。
> 顾沉（冷淡）：想清楚了？签了，就没有回头路。
> 林晚（倔强）：我签。
**音效**：城市车流声、远处蝉鸣
**转场**：闪白
```

**必须遵守的 5 条铁律**（违反会解析失败或静默丢数据）：

| # | 规则 | 违反后果 |
|---|---|---|
| 1 | 场景必须用 `###`（三个井号） | `####` 及更深**不被识别** |
| 2 | 台词必须用 `>` 引用块 + `说话人：` 前缀 | 写在正文里的对话会被当镜头描述，**台词丢失** |
| 3 | `aspect_ratio` 必须加引号 `"9:16"` | YAML 当六十进制解析成 `556` |
| 4 | 全文件只能有一个 `#` 一级标题 | 剧名被覆盖、结构错乱 |
| 5 | **必须显式写 `## 第N集`** | 没有它 → 解析出 **0 集**，全部落入 `loose_scenes`，下游按集装配拿不到任何 episode |

完整对照表见 [docs/SCREENPLAY_FORMAT.md §8](SCREENPLAY_FORMAT.md)。

---

## 3. 校验剧本 ✅

**渲染前必须过这一关**（`run.py` 也会自动跑，但提前校验能省几天返工）：

```bash
python -m pipeline.validate sessions/闪婚之后满级大佬/screenplay.md
echo $?     # 0=通过  1=有 error 必须修  2=文件/用法错误
```

输出示例（带行号 + 修复建议）：

```
screenplay.md: 2 error, 3 warning
  ✗ [L3] ASPECT_UNQUOTED: aspect_ratio: 9:16 会被 YAML 当成六十进制整数解析
      → 修复：改为 aspect_ratio: "9:16"
  ✗ [L142] EMPTY_FIELD: **镜头**： 后面没有内容
      → 修复：补充镜头描述
  ! [全局] SPEAKER_UNDECLARED: 对白说话人 '王五' 未在角色表登记
      → 修复：在 '## 角色表' 或场景 '**人物**' 中登记该角色并写清外形
```

机器可读输出（供 CI / 脚本用）：

```bash
python -m pipeline.validate your_script.md --json
python -m pipeline.validate your_script.md --strict   # warning 也算失败
```

**error 必须修**（会导致解析失败或成片明显错误）；**warning 可酌情忽略**（只降质）。

---

## 4. 本机预演（无 GPU）✅

在开发机上（无 GPU、无模型、无 ffmpeg）验证整条控制流走通。**这一步不消耗任何 GPU 时间**，
适合在提交 3.4 天渲染任务前确认剧本结构没问题。

```bash
# 装核心依赖（任何机器可装，含 Windows）
pip install -r requirements-core.txt -i https://mirrors.aliyun.com/pypi/simple

# 用占位引擎跑通全流程（只构造 ffmpeg 命令，不实际执行）
python run.py examples/sample_screenplay.md --project demo --stubs --dry-run
```

输出：

```
=== AI 短剧工作流启动 ===
模式：STUB(占位)  DRY-RUN
S1 解析完成：{'episodes': 3, 'scenes': 6, 'shots': 11, ...}
第 1 集装配完成 -> projects/demo/episodes/ep001.mp4（4 镜头）
...
全剧拼接完成 -> projects/demo/out/full_drama.mp4（3 集）
状态分布：{'assembled': 11, 'failed': 0, ...}
```

不加 `--dry-run` 会真的写出占位产物（1×1 PNG、静音 wav、**真实 SRT/ASS 字幕**），
可用于检查字幕样式：

```bash
python run.py examples/sample_screenplay.md --project demo --stubs --only enrich,keyframe,video,tts,subtitle,bgm
cat projects/demo/subs/s001_sh002.ass    # 检查短剧大字幕样式
```

**跑测试套件**（全绿才算环境正常）：

```bash
python -m pytest tests/ -q
```

---

## 5. 启动推理服务 ✅

```bash
bash scripts/start_services.sh              # 质量档（默认）
bash scripts/start_services.sh --status     # 查看状态
bash scripts/start_services.sh --stop       # 停止全部
```

启动的服务与 GPU 分配：

| GPU | 服务 | 精度 | 显存 |
|---|---|---|---|
| GPU0 | vLLM Qwen3-32B-AWQ（常驻，连续批处理） | AWQ int4 | ~22GB + KV |
| GPU1 / GPU2 | 关键帧 worker A / B（Qwen-Image） | bf16 | ~20GB |
| GPU3+4 | 终渲 job A（Wan2.2-I2V-A14B，720p） | bf16 | ~55-60GB |
| GPU5+6 | 终渲 job B | bf16 | ~55-60GB |
| GPU7 | CosyVoice2 + Paraformer/whisper + ACE-Step + CLAP（共卡分时） | 混合 | 分时 |
| CPU | ffmpeg 装配（与 GPU 推理重叠） | — | 0 |

**吞吐档**（7 路并行，画质略降，39 小时 vs 81 小时）：

```bash
QUALITY_MODE=throughput bash scripts/start_services.sh
```

**确认 vLLM 就绪**（首次加载模型需 1-3 分钟）：

```bash
tail -f logs/vllm.log                       # 等 "Application startup complete"
curl -s http://localhost:8000/v1/models      # 应返回 qwen3-32b
```

**确认 worker 就绪**：

```bash
celery -A pipeline.tasks inspect ping        # 所有 worker 应答
redis-cli ping                               # PONG
```

日志与 PID：

```bash
ls logs/       # vllm.log  redis.log  worker_<name>.log
ls .pids/      # 各服务 pid，供 --stop 使用
```

### 5.1 引擎接线（唯一落点）✅

所有引擎由 **[pipeline/engines/factory.py](../pipeline/engines/factory.py)** 统一构造——
`run.py` 与 Celery worker 都调它，不再各自写死配置。工厂按 `config/models.yaml` +
`AIVIDEO_*` 环境变量定位权重，**缺哪个引擎就跳过哪个阶段**并打印诊断，不会崩。

可调环境变量（`start_services.sh` 已设好合理默认值，通常无需手动设）：

| 变量 | 默认 | 作用 |
|---|---|---|
| `AIVIDEO_MODEL_ROOT` | `/data/models` | 权重根目录 |
| `AIVIDEO_LLM_BASE_URL` | `http://localhost:8000/v1` | vLLM 端点 |
| `AIVIDEO_LLM_MODEL` | `qwen3-32b` | served-model-name |
| `AIVIDEO_VIDEO_MODE` | `final` | 终渲阶段用哪个模型：`final`(A14B) / `preview`(5B) / `perform`(Animate2) |
| `AIVIDEO_VIDEO_DEVICES` | `cuda:3,cuda:4` | 终渲双卡 |
| `AIVIDEO_PREVIEW_DEVICE` | `cuda:0` | 预览阶段（S5a）用的卡 |
| `AIVIDEO_IMAGE_DEVICE` | `cuda:1` | 关键帧卡 |
| `AIVIDEO_TTS_DEVICE` | `cuda:7` | 配音卡 |
| `AIVIDEO_MUSIC_DEVICE` | `cuda:7` | BGM 卡 |
| `AIVIDEO_SPK_INFO_DIR` | — | CosyVoice 持久化音色库目录 |
| `AIVIDEO_BGM_LIBRARY` | — | 本地版权曲库（空则全部用 ACE-Step 生成） |

> **两套"预览"机制，别混淆**：
> - `AIVIDEO_VIDEO_MODE=preview` 是让**终渲阶段(S5 video)** 直接用 5B 模型出片（画质换速度，一步到位）。
> - 独立的 **preview 阶段(S5a)** 是先用 5B 出一版 480p 草稿（`draft_clip_path`）供校时/校运镜，
>   确认后**终渲阶段仍用 A14B** 出正式片（`clip_path`）。它用 `video_preview` 引擎
>   （`AIVIDEO_PREVIEW_DEVICE` 指定卡），是可选阶段，默认不跑。
>
> 换言之：`AIVIDEO_VIDEO_MODE` 改的是**终渲用什么模型**；preview 阶段是**终渲前多一道草稿校对**。

**验证工厂能正确识别环境**（本机无模型时应优雅降级为空，并逐个说明缺什么）：

```bash
python -c "
from pipeline.engines.factory import build_engines
print(sorted(build_engines().keys()))"     # 服务器上应列出可用的引擎
```

### 5.2 关于 GPU 编号（重要，容易踩坑）✅

worker 用 `CUDA_VISIBLE_DEVICES` 钉绑物理卡，例如 video worker 是 `CUDA_VISIBLE_DEVICES="3,4"`。
**在该进程内 torch 只能看到 2 张卡，索引是 `cuda:0`/`cuda:1`**，物理 3、4 号并不存在。
若直接把 `cuda:3` 传给 `.to()`，会抛 `CUDA error: invalid device ordinal`，worker 起不来。

工厂的 `normalize_device()` 会自动重映射：

```
CUDA_VISIBLE_DEVICES=3,4 时：cuda:3 → cuda:0，cuda:4 → cuda:1
CUDA_VISIBLE_DEVICES=7   时：cuda:7 → cuda:0
未设置（8 卡全可见）时：  原样返回，绝对卡号正确
请求的卡不在可见列表：    回落 cuda:0 并记 warning（不抛异常拖垮 worker）
```

因此**表格里写的 `cuda:3,cuda:4` 等是物理卡号**，你无需为每个 worker 单独设
`AIVIDEO_*_DEVICE`。此行为有 6 个测试覆盖（`tests/test_engine_factory.py`）。

---

## 6. 出片 ✅

### 6.1 从剧本文件启动

```bash
python run.py sessions/闪婚之后满级大佬/screenplay.md --project 闪婚之后满级大佬
```

### 6.2 从会话启动 ✅

```bash
python run.py --from-session 闪婚之后满级大佬
```

### 6.3 常用参数 ✅

```bash
# 只跑某几个阶段（调试/补跑）
python run.py script.md --project demo --only enrich,keyframe

# 详细日志
python run.py script.md --project demo -v

# 指定项目根目录
python run.py script.md --project demo --projects-dir /data/dramas
```

可用阶段名：`assets,enrich,keyframe,preview,video,tts,subtitle,bgm,assemble,concat`

> `preview` 是**可选阶段**：默认全跑时会跳过它（避免每部剧多花 3-6 小时 GPU）。
> 只有用 `--only` 显式点名时才跑。见 §6.4「先出预览再终渲」。

### 6.4 建议的执行策略

渲染要 3.4 天，**不要前台挂着**。用 nohup 或 tmux：

```bash
# 方式一：tmux（推荐，可随时回来看进度）
tmux new -s render
python run.py sessions/xxx/screenplay.md --project xxx 2>&1 | tee logs/render.log
# Ctrl+B D 脱离；tmux attach -t render 回来

# 方式二：nohup
nohup python run.py sessions/xxx/screenplay.md --project xxx > logs/render.log 2>&1 &
```

**分级校验再终渲**（强烈推荐，避免白烧 3 天 GPU）：

> 注意：这些**不是**流水线的人工关卡——全自动模式下一口气跑到底也可以（见 §6.1）。
> 但终渲要 ~81 小时，如果角色长相或运镜在第 300 镜才开始出问题，白烧的代价很大。
> 因此推荐用两个**便宜的校验点**逐步确认，再投入昂贵的终渲。它们是成本保险，
> 不是流程要求；跳过它们流水线照样能出片。

```bash
# ── 校验点 1：关键帧（静图，1-3 小时）—— 查长相一致性、构图 ──
python run.py script.md --project xxx --only enrich,assets,keyframe

ls projects/xxx/keyframes/ | head          # 肉眼抽查
python -c "
from pipeline.contracts import Manifest
m = Manifest.load('projects/xxx/manifest.json')
bad = [s for s in m.iter_shots() if s.qc.face_sim_pass is False]
print(f'{len(bad)} 个镜头低于相似度阈值（已自动采用最优候选）')
for s in bad[:10]: print(' ', s.id, s.qc.face_sim)"

# ── 校验点 2：480p 动态预览（可选，3-6 小时，8 路并行）—— 查运镜、节奏、时长 ──
# preview 是可选阶段，必须用 --only 点名才会跑
python run.py script.md --project xxx --only preview
ls projects/xxx/drafts/*.mp4 | head        # 抽查动态效果与时长

# ── 终渲及之后（A14B 720p，~81 小时）──
python run.py script.md --project xxx --only video,tts,subtitle,bgm,assemble,concat
```

> **video 阶段会自动接上**：它同时消费 `keyframed`（跳过校验点 2）和 `drafted`
> （跑过校验点 2）两种上游状态，所以无论你走哪条路径，终渲都能顺利衔接。

> 若校验点 1 发现某角色整体漂移，**不要**逐镜重做——回到 S3 重出该角色的定妆 sheet，
> 或为其训 LoRA（`train_lora=True`），然后只重跑 `--only keyframe,...`。
> 若校验点 2 发现运镜/节奏问题，改剧本对应镜头的 `**镜头**`/`**动作**` 描述后重跑
> `--only enrich,preview`。详见 §7.4 排错表。

---

## 7. 监控 · 断点续跑 · 退出码 · 排错

### 7.1 监控进度 ✅

```bash
# GPU 利用率
watch -n 5 nvidia-smi

# 各状态镜头数（实时看流水线推进）
python -c "
from pipeline.contracts import Manifest
m = Manifest.load('projects/xxx/manifest.json')
print(m.stats()['by_status'])"

# 已完成镜头数
ls projects/xxx/clips/*.mp4 2>/dev/null | wc -l

# 磁盘增长（母带很占空间）
du -sh projects/xxx/
watch -n 60 'df -h /data'
```

### 7.2 断点续跑 ✅

**中途崩溃/手动中断后，重跑同一条命令即可**——已完成的镜头自动跳过：

```bash
python run.py script.md --project xxx      # resume 默认开启
```

原理：`manifest.json` 里每个镜头有 `status` 字段（parsed→enriched→keyframed→
drafted→rendered→voiced→subtitled→assembled），编排器按状态跳过已完成的。

**增量存档保证进度不丢**：编排器每 20 个镜头或每 300 秒落盘一次（双阈值，取先到者），
且 `Manifest.save()` 是**原子写**（临时文件 + `os.replace`）。
因此 81 小时的终渲在第 80 小时崩溃，也只丢最近 20 个镜头的进度。

```bash
# 可选：调整存档频率（更频繁=更安全，但写盘更勤；manifest 在 3000 镜头下约 10-20MB）
python -c "
from pipeline.orchestrator import Orchestrator
o = Orchestrator('projects/xxx', checkpoint_every=10, checkpoint_interval=120)"
```

回归测试见 [tests/test_checkpoint.py](../tests/test_checkpoint.py)（含模拟第 4 镜崩溃后恢复）
与 [tests/test_resume_and_exit.py](../tests/test_resume_and_exit.py)（续跑语义、剧本变更保护、退出码）。

> ⚠️ **续跑时不要改剧本**。manifest 记录了剧本内容哈希（`source_hash`）；
> 若检测到剧本已改动，`run.py` 会**拒绝续跑并报错退出（exit 3）**，因为重新解析会
> 丢弃全部已完成进度（可能是几十小时的渲染成果）。这是有意保护，不是 bug。
>
> ```
> ERROR 剧本变更检测：
>   剧本已改动（manifest 记录 2373b0c2…，当前 9f1a4b77…）。
>   项目 xxx 已有进度：{'rendered': 1200, ...}
>   重新解析会丢弃全部进度。若确认要重建，请加 --fresh；
>   若想保留进度，请撤销对剧本的改动。
> ```

**确实要重建时**（改了剧本、想从头来过）：

```bash
python run.py script.md --project xxx --fresh    # 强制重新解析，丢弃进度
```

或干脆换一个新项目名，保留旧产物：

```bash
python run.py script_v2.md --project xxx_v2
```

### 7.3 退出码（供自动化判断成败）✅

`run.py` 会按失败类型返回不同退出码，**不再无条件返回 0**：

| 退出码 | 含义 | 处理 |
|---|---|---|
| `0` | 全部成功 | — |
| `2` | 剧本文件不存在 | 检查路径 |
| `3` | 剧本已改动、拒绝续跑 | 撤销改动，或加 `--fresh` |
| `4` | 有镜头 `failed`（数据问题：生成失败/缺上游产物） | 查 `manifest` 的 `qc.notes`，重跑该阶段 |
| `5` | 有集装配失败（**多为环境问题**，如缺 ffmpeg） | 装 ffmpeg 后重跑，镜头状态未被污染可直接续 |
| `6` | 有镜头 `needs_human` | 全自动模式下不应出现；检查是否有阶段仍会阻塞等人 |

脚本化用法：

```bash
if python run.py script.md --project xxx; then
  echo "出片成功"
else
  code=$?
  echo "失败，退出码 $code"
  [ $code -eq 5 ] && echo "→ 可能是 ffmpeg 缺失，装好后重跑即可续上"
fi
```

> **关于 exit 5**：ffmpeg 缺失属环境问题，装配阶段会**一次性失败退出**，
> 而**不会**把上千个镜头逐个标成 `failed`。因此装好 ffmpeg 后重跑 `--only assemble`
> 就能从 `subtitled` 直接续上，无需重渲。

### 7.4 排错 ✅

| 症状 | 原因 | 处理 |
|---|---|---|
| `CUDA 不可用` | 驱动 <580 或 torch 版本不匹配 | `nvidia-smi` 查驱动；确认 torch 是 +cu128 |
| vLLM 起不来 | 显存不足 / AWQ 权重损坏 | 看 `logs/vllm.log`；降 `--gpu-memory-utilization`；重下模型 |
| Wan A14B **OOM** | 双专家 MoE + umt5-xxl + VAE decode 显存尖峰 | 确认 `tiled_vae=True`；或切吞吐档 GGUF Q6 |
| `ffmpeg 未检测到 libass` | ffmpeg 不是 conda-forge 版 | `conda install -c conda-forge ffmpeg` 重装 |
| concat **报错/花屏** | 各集 codec/分辨率/fps/SAR/timebase 不一致 | 确认都走了 S9 归一（`RenderSpec` 统一 1080×1920/30fps/48k） |
| 字幕不显示 | ASS 路径转义 / libass 缺失 | 检查 `subs/*.ass` 存在；`ffmpeg -version \| grep libass` |
| 台词糊在 BGM 下 | ducking 未生效 | 检查 `mix_episode_audio_cmd` 的 sidechaincompress；调 `bgm_gain_db` 到 -24 |
| 角色长相漂移 | 参考图不足 / identity_strength 太低 | 确认 S3 定妆 sheet 已生成；提高 `identity_strength`（0.70→0.92）；训主角 LoRA |
| 镜头 `qc.notes` 有 `ACCEPTED-BELOW-THRESHOLD` | 人脸相似度未达阈值但已自动采用最优 | **正常行为**（全自动模式不阻塞）。渲染后查 QC 报告决定是否单独重做 |
| 下载 429 | hf-mirror 限流 | 脚本已自动重试 5 次；仍失败则改走 ModelScope |
| `git clone` 超时 | GitHub 被墙 | ComfyUI/自定义节点从 gitcode.com 或 gitee 镜像离线预装 |

**查看事后 QC 报告**（全自动模式下唯一的质量复盘入口）：

```bash
python -c "
from pipeline.contracts import Manifest
m = Manifest.load('projects/xxx/manifest.json')
bad = [s for s in m.iter_shots() if s.qc.face_sim_pass is False]
print(f'{len(bad)} 个镜头人脸相似度未达阈值（已自动采用最优候选）')
for s in bad[:20]:
    print(f'  {s.id} sim={s.qc.face_sim} {s.qc.notes[:60]}')"
```

---

## 8. 验收与产物

### 8.1 产物清单 ✅

```
projects/闪婚之后满级大佬/
├── manifest.json              # 全流程状态（含每镜 prompt/seed/QC/模型版本，可审计可复现）
├── assets/characters/<id>/    # 定妆 sheet（每角色 4 视图）+ LoRA + 音色
├── keyframes/*.png            # ~1620 张关键帧（1080×1920）
├── drafts/*.mp4               # 480p 预览（可选保留）
├── clips/*.mp4                # 720p 终渲镜头母带
├── voices/*.wav               # 配音（24kHz，含逐句时间戳）
├── subs/*.srt, *.ass          # 字幕
├── music/ep*_bgm.wav          # 每集 BGM
├── episodes/ep001.mp4 …       # ★分集成片（可单独发布）
└── out/full_drama.mp4         # ★全剧成片
```

### 8.2 验收清单

| 项 | 标准 | 检查方式 |
|---|---|---|
| 分集数 | = `target_episodes` | `ls projects/xxx/episodes/*.mp4 \| wc -l` |
| 单集时长 | 240-300 秒 | `ffprobe -v error -show_entries format=duration episodes/ep001.mp4` |
| 分辨率/帧率 | 1080×1920 @ 30fps | `ffprobe -v error -select_streams v -show_entries stream=width,height,r_frame_rate` |
| 音频 | 48kHz 立体声 AAC | `ffprobe -v error -select_streams a -show_entries stream=sample_rate,channels` |
| 响度 | -16 LUFS | `ffmpeg -i ep001.mp4 -af loudnorm=print_format=json -f null -` |
| 字幕 | 已硬烧、无错字 | 肉眼抽检 3-5 集 |
| 角色一致性 | 主角跨集长相一致 | 肉眼抽检 + 查 QC 报告 `face_sim` 分布 |
| 无损拼接 | 全剧无花屏/音画错位 | 完整播放 `full_drama.mp4` |
| 钩子 | 每集结尾有悬念 | 抽检 5 集片尾 |

### 8.3 清理中间产物 ✅

母带很占空间（30 集约 150-230GB）。出片确认后可清理：

```bash
# 保留成片，清理中间产物
rm -rf projects/xxx/drafts          # 480p 预览
rm -rf projects/xxx/ep_norm         # 归一后的临时镜头
# 母带 clips/ 建议保留一段时间（用于返修单镜，避免重渲整剧）
du -sh projects/xxx/*               # 清理前先看各项占用
```

---

## 附录 A. 命令速查

### 环境与服务

```bash
bash scripts/install_env.sh                                    # 装环境（一次性）
bash scripts/download_models.sh [--dry-run] [--only video]      # 下模型
bash scripts/start_services.sh [--stop|--status]                # 起/停/查服务
QUALITY_MODE=throughput bash scripts/start_services.sh          # 吞吐档
```

### 剧本

```bash
python -m pipeline.validate <script.md> [--json] [--strict]     # 校验
python -m pipeline.parser <script.md> -o out/script.raw.json    # 只看解析结果
```

### 出片

```bash
python run.py <script.md> --project <名称>                      # 完整出片
python run.py <script.md> --project <名称> --only enrich,keyframe   # 只跑部分阶段
python run.py <script.md> --project <名称> --only preview       # 可选：480p 预览（默认全跑时跳过）
python run.py <script.md> --project <名称> --fresh              # 剧本改动后强制重建（丢弃进度）
python run.py <script.md> --project <名称> --stubs --dry-run    # 本机预演（无 GPU）
python run.py <script.md> --project <名称> -v                   # 详细日志
echo $?                                                          # 退出码 0/3/4/5/6，见 §7.3
```

### 互动式剧本生成 ✅

```bash
python scriptwriter.py new --title <剧名>                       # 新建（互动）
python scriptwriter.py resume <会话名>                          # 恢复会话
python scriptwriter.py list                                     # 列出会话
python scriptwriter.py batch --synopsis f.txt --episodes 30 \
       --episode-seconds 270 --policy max-tension --out <dir>   # 无人值守批量
```

### 测试

```bash
python -m pytest tests/ -q                          # 全部测试
python -m pytest tests/test_scale.py -q             # 50 集规模压测
python -m pytest tests/test_checkpoint.py -q        # 崩溃恢复/原子写/增量存档
python -m pytest tests/test_engine_factory.py -q    # 引擎接线/CUDA 设备重映射
python -m pytest tests/test_real_stages.py -q       # 真实 stage（mock 引擎）
```

> 测试数会随开发增长，故此处不写死数字。以 `pytest tests/ -q` 末尾的 `N passed` 为准；
> 当前为 82 个（pipeline 27 · real_stages 11 · scale 20 · checkpoint 6 · engine_factory 18）。

---

## 附录 B. 目录结构

```
aiVideo/
├── README.md                      # 项目总览
├── docs/
│   ├── TUTORIAL.md                # 本文件：使用教程
│   ├── ARCHITECTURE.md            # 架构与调研设计（权威结论）
│   └── SCREENPLAY_FORMAT.md       # 剧本格式标准（权威规范）
├── config/models.yaml             # 模型清单（唯一事实源，全部镜像核验可达）
├── requirements-core.txt          # 核心依赖（任何机器可装）
├── requirements-server.txt        # GPU 全栈依赖（仅部署机）
├── run.py                         # 阶段 B 一键入口
├── scriptwriter.py                # ✅ 阶段 A 互动式剧本生成入口
├── pipeline/
│   ├── parser.py                  # S1 确定性 MD 解析
│   ├── validate.py                # S0 格式校验（linter）
│   ├── contracts.py               # manifest pydantic 契约（原子写）
│   ├── orchestrator.py            # 状态机编排（增量存档）
│   ├── subtitles.py               # S7 字幕（SRT+ASS）
│   ├── assemble.py                # S9/S10 ffmpeg 装配（纯函数命令构造）
│   ├── tasks.py                   # Celery 任务（服务器执行面）
│   ├── engines/                   # 模型引擎封装（llm/image/video/tts/music）
│   └── stages/                    # 各阶段适配器（enrich/assets/keyframe/video/tts/subtitle/bgm/assemble）
├── scripts/
│   ├── install_env.sh             # 环境安装
│   ├── download_models.sh         # 模型下载
│   └── start_services.sh          # 服务启动（GPU 钉绑）
├── tests/                         # 测试套件（见「附录 A · 测试」）
├── examples/sample_screenplay.md  # 格式演示样例
└── projects/<drama>/              # 每部剧的产物
```

---

## 附录 C. 常见问题

**Q：渲染真的要 3.4 天吗？能快些吗？**
A：终渲（S5）占 80%+ 时间，这是 Wan2.2-I2V-A14B 在 8×A800 上的物理极限。三个提速选项：
① 吞吐档 `QUALITY_MODE=throughput`（GGUF Q6 单卡 7 路并行）→ ~1.6 天，画质略降；
② 减少集数或缩短每集时长；③ 只对 hero 镜头用 A14B，其余用 TI2V-5B。

**Q：为什么不能用 fp8 提速？**
A：A800 是 Ampere 架构（sm80），**没有原生 FP8 张量核**。fp8 权重只能省显存，
计算时要 upcast 到 bf16，反而更慢。走 bf16 或 GGUF 才是稳妥路径。

**Q：中途崩溃会白跑吗？**
A：不会。编排器每 20 镜或 300 秒增量存档（原子写），重跑同一命令自动跳过已完成镜头。
最坏情况丢最近 20 个镜头的进度。

**Q：能只重做某一个镜头吗？**
A：可以。把 `manifest.json` 里该镜头的 `status` 改回 `keyframed`（重做视频）或
`enriched`（重做关键帧及之后），删掉对应产物文件，再跑 `--only video,...`。

**Q：角色长相在后面的集数变了怎么办？**
A：这是头号质量风险。四层防护：① 确认 S3 定妆 sheet 已生成且质量可用；
② 为主角训 LoRA（`train_lora=True`，30-90 分钟一次性投入，效果最强）；
③ 提高 `identity_strength`（0.70→0.92）；④ 查 QC 报告找 `face_sim` 低的镜头单独重做。

**Q：没有参考音能用吗？**
A：能。不提供 `assets/voice_refs/` 时，S3 会用 TTS 自建占位音色。一致性略差，
但流程可跑通。追求质量建议为 1-3 个主角各准备 5-15 秒干净参考音。

**Q：为什么我的剧本解析出 0 集？**
A：几乎肯定是**没写 `## 第N集` 标题**。解析器只把 `##` 当集边界，而 `## 角色表`
是登记区不产生集。没有集标题时所有场景落入 `loose_scenes`，`episodes` 为空。

**Q：`aspect_ratio` 为什么变成了 556？**
A：YAML 把不加引号的 `9:16` 当六十进制整数解析（9×60+16=556）。写成 `aspect_ratio: "9:16"`。
校验器的 `ASPECT_UNQUOTED` 会提前抓到这个错误。

**Q：本机（无 GPU）能做什么？**
A：写剧本、校验、本机预演（`--stubs --dry-run`）、跑全部测试、检查字幕样式、
审查关键帧。只有真实出片需要服务器。

**Q：商用发布有哪些许可坑？**
A：`Qwen-Image-2.1` 是 qwen-research 条款（需注册接受），不接受就切 Apache 组合
（`Qwen-Image` + `Qwen-Image-Edit-2511`）。严禁进商业成片：FLUX.1-dev、MusicGen、
MMAudio 官方权重、Fish-Speech、ChatTTS、F5-TTS、YuE2。其余推荐栈（Qwen3、Wan2.2、
CosyVoice2、Paraformer、ACE-Step、CLAP、GPT-SoVITS）均为 Apache-2.0 或 MIT。

---

## 相关文档

- [README.md](../README.md) —— 项目总览与快速开始
- [docs/ARCHITECTURE.md](ARCHITECTURE.md) —— 架构、模型栈、GPU 分配、产能预估、风险
- [docs/SCREENPLAY_FORMAT.md](SCREENPLAY_FORMAT.md) —— 剧本格式权威规范
- [config/models.yaml](../config/models.yaml) —— 模型清单与许可证
