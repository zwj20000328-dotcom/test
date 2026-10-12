# MiniMax H3 Turbo（A800-40G 版）

MiniMax H3 视频生成 **4 步加速方案**：蒸馏 LoRA + SigmaShift 噪声调度，采样步数从 20 步降到 4 步，**相对原版提速约 5 倍**。虚拟环境（venv/conda）部署，无需 Docker，约 30 分钟起服务。

**一次生成，画面与声音同时出**（原生 32kHz 立体声，11 种语言对白），输出 MP4 自带音轨，无需二次合成。

> 本方案针对 **单卡 Nvidia A800-40G（Ampere / sm_80）+ CUDA 13.0** 设计。A800 无原生 FP8/FP4 Tensor Core，量化选型与 Ada/Blackwell 卡有本质区别——每个组件的选型理由、收益、可行性与可改进空间见 [🧩 分步模型选型详解](#-分步模型选型详解)。

## ✨ 特性

- **4 步出片** — 蒸馏 LoRA 重训去噪轨迹，euler 采样器 4 步收敛，约为原版 20 步速度的 5 倍
- **三种模式全覆盖** — 文生视频 T2V / 图生视频 I2V（首帧+尾帧）/ 参考生视频 R2V（9 图 + 3 视频 + 3 音频）
- **原生音频** — 33.1B 全模态 transformer 单次前向同时生成画面与立体声，对白/音效/配乐一体
- **Ampere 原生 INT8** — UNet 用 `int8_convrot`，走 A800 的 INT8 Tensor Core（`torch._int_mm`）原生加速，避开 fp8 反量化开销
- **零自定义节点（基础链路）** — MiniMax H3 节点全部内置于 ComfyUI 0.30.0+；SageAttention 为可选加速插件
- **虚拟环境部署** — venv/conda + pip，无 Docker 依赖，便于与现有 GPU 服务器环境集成
- **API 即服务** — 同步直接返回 base64 结果；长任务走 webhook_v2 异步回调（带 HMAC 签名验证）

> ⚠️ **性能数据说明**：下文 A800 耗时为**基于硬件规格的工程估算，尚未在真机实测**，仅供容量规划参考，务必以你自己的实测为准。加速比（turbo 4 步 vs 原版 20 步 ≈ 5×）与 GPU 型号无关，可沿用。

## 🖥️ 硬件与显存

### 目标配置

| 配置 | 说明 |
|---|---|
| **GPU：单卡 Nvidia A800-40G** | Ampere / sm_80，40GB HBM2e，~1555 GB/s 带宽，INT8 Tensor ~624 TOPS。UNet 走 int8_convrot 原生 INT8；文本编码器 nvfp4 经反量化运行 |
| CUDA / PyTorch | **CUDA 13.0 + PyTorch cu130 构建**。CUDA 13.0 完整支持 sm_80（仅移除了 Maxwell/Pascal/Volta）。确认 `TORCH_CUDA_ARCH_LIST` 含 `8.0` |
| 内存（RAM） | 建议 **≥64G**（阶段换页缓冲大）；48G 可跑但换页更频繁 |
| 磁盘 | ≥ 100G（模型 ~44G + 输出文件） |

### 显存占用（fl2va 单模式）

| 组件 | 文件 | 驻留显存 | 备注 |
|---|---|---|---|
| UNet fl2va int8_convrot | 20.97G | ~21G | int8 打包态，Ampere 原生计算，基本不膨胀 |
| turbo LoRA（fl2v 4step） | 1.96G | ~2G | 以 model patch 常驻，不 merge 成第二份 UNet |
| 文本编码器 Qwen3-VL-32B nvfp4 | 15.69G | ~15.7G | FP4 打包驻留 + 复用 cast buffer（见下） |
| video VAE fp16 | 5.21G | ~5.2G | 显存吃紧可换 int8 版（2.81G） |
| audio VAE fp32 | 0.61G | ~0.6G | — |
| **全常驻合计** | **~44.4G** | **~44.5G** | **> 40G，无法单卡零换页全常驻** |

### 单卡能否零换页？双卡能否拼显存？

**结论：全常驻零换页在单卡 A800-40G 上装不下（44.5G > 40G）；双卡也无法把单个模型拼起来跑——ComfyUI 不支持单模型跨卡拆分（无 tensor/pipeline 并行，`--cuda-device 0,1` 只控制可见设备）。**

但**单卡实际能跑**，因为 ComfyUI 是**分阶段调度**，不是所有组件同时驻留：

```
① 文本编码阶段：nvfp4 文本编码器(15.7G) + 少量激活        → 峰值 ~16–18G
② 采样阶段：    UNet(21G) + LoRA(2G) + 激活(720p/10s ~10G) → 峰值 ~33G
③ VAE decode：  video VAE(5.2G) + audio VAE(0.6G) + 缓冲    → 峰值 ~8–15G
```

每个阶段峰值都在 40G 内。**换页只发生在阶段切换时（每请求 2–3 次），不在 4 步采样热循环里**，单次换页 2–5s（15–23G 经 PCIe 从内存搬入），开销可控。热启动后内存缓存命中，换页更快。

**双卡 A800 的正确用法**：跑**两个独立实例**（GPU0 一个 `--cuda-device 0`、GPU1 一个 `--cuda-device 1`，不同端口）+ 负载均衡 → **吞吐 ×2**，但每个实例仍是单卡 40G、仍走分阶段换页。适合并发提量，不适合"拼显存跑更大模型"。

**若一定要单卡零换页全常驻**（牺牲质量换调度简单）：

| 降配方案 | 文本编码器 | video VAE | 全常驻合计 | 代价 |
|---|---|---|---|---|
| 默认（推荐） | nvfp4 15.7G | fp16 5.2G | ~44.5G | 需分阶段换页 |
| 零换页-温和 | GGUF Q3_K 9.8G | int8 2.8G | ~36.4G | 提示词保真度略降，需 ComfyUI-GGUF 节点 |
| 零换页-激进 | GGUF IQ2_XXS 6.9G | int8 2.8G | ~33.5G | 提示词保真度明显下降 |

> 除非显存调度是硬痛点，否则**建议用默认 nvfp4 + 分阶段换页**——换页开销远小于 GGUF 低比特对提示词质量的损失。

## 🧩 分步模型选型详解

按数据流顺序，逐组件说明**选型 · 收益 · 可行性评估 · 可改进方向**。

### 步骤 1 — UNet 主模型：`int8_convrot`（20.97G）

| 维度 | 说明 |
|---|---|
| **选型** | `minimax_h3_fl2va_pruned_int8_convrot.safetensors`（T2V/I2V）；R2V 用对应 `ref2va` 版 |
| **收益** | Ampere 有**原生 INT8 Tensor Core**（~624 TOPS），ComfyUI 经 `torch._int_mm` 走 `comfy_kitchen` int8 weight-only matmul（`supports_int8_compute()` 返回 True）。20.97G 即可驻留，采样阶段无需换页 |
| **可行性** | ✅ **已验证可行**。官方 README 明确："能用 cu130 就优先 `int8_convrot`"。int8 是 A800 上唯一有原生加速的 UNet 量化档 |
| **可改进** | ① 显存极紧可用 GGUF Q4_K（11.4G，`unsloth/MiniMax-H3-GGUF`），但 GGUF 逐层反量化比原生 int8 慢；② 追求画质上限可换 `pruned_bf16`（40.23G）——但超 40G 显存，A800 单卡跑不了，不建议 |

> ❌ **为什么不用 fp8_scaled（20.96G）**：A800=sm_80 无原生 FP8 Tensor Core（ComfyUI `supports_fp8_compute()` 要求 sm_89+），fp8 权重会被 cast 回 bf16 计算——省不了显存（同为 ~21G）还**多一道反量化开销，4 步采样步步吃亏**。这是 A800 与 Ada/Blackwell 卡最大的选型差异。

### 步骤 2 — turbo 蒸馏 LoRA：`fl2v_turbo_4step_v1.0`（1.96G）

| 维度 | 说明 |
|---|---|
| **选型** | `LoraLoaderModelOnly` 加载 `minimax_h3_fl2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors` |
| **收益** | 重训去噪轨迹，使 euler 采样器 **4 步收敛**（原版 20 步），这是全套方案 ~5× 提速的核心来源 |
| **可行性** | ✅ **已验证可行**。以 model patch 形式常驻（~2G），不 merge 成第二份完整 UNet，显存友好 |
| **可改进** | ① 另有 `8step` 版 LoRA，画质略稳但慢一倍，turbo 场景不推荐；② **fl2v 与 ref2v LoRA 不可混用**——T2V/I2V 必须配 fl2v LoRA + fl2va 主模型，R2V 配 ref2v LoRA + ref2va 主模型 |

### 步骤 3 — 噪声调度：`MiniMaxH3SigmaShift`（video=12 / audio=3）

| 维度 | 说明 |
|---|---|
| **选型** | ComfyUI 内置节点，video sigma shift=12、audio=3 |
| **收益** | 配合 4 步蒸馏，把噪声调度曲线适配到少步采样，保证 4 步下画面/音频同时收敛 |
| **可行性** | ✅ **内置节点，零安装**。参数为官方 turbo 工作流推荐值 |
| **可改进** | 一般无需调；若 4 步下音频发闷可微调 audio shift，但会偏离蒸馏训练分布，非必要不动 |

### 步骤 4 — 文本编码器：`Qwen3-VL-32B nvfp4`（15.69G）

| 维度 | 说明 |
|---|---|
| **选型** | `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors`，CLIPLoader 加载 |
| **收益** | 官方**最小单文件**文本编码器（15.69G）。官方 README 声明"**This nvfp4 text encoder does not require Blackwell GPU to use**"，A800 可用 |
| **可行性** | ✅ **可行，但走反量化路径**。A800=sm_80 不支持原生 FP4 compute（`supports_nvfp4_compute()` 要求 sm_100+），ComfyUI 将 FP4 权重**按层反量化到 bf16** 走 GEMM，写进复用的 cast buffer——**驻留仍是打包的 15.7G，不膨胀成 bf16 的 51.5G**。反量化开销只落在**提示词编码阶段**（每请求一次），端到端约 +1–3s，不影响 4 步采样 |
| **可改进** | ① **无法换成 Qwen3-VL-4B**：官方及全 HF 社区（GGUF/NF4/fp8/heretic 等 20+ 仓库）只有 32B，且 4B `hidden_size=2560` ≠ 32B `5120`，UNet 交叉注意力按 5120 维训练，换 4B 需重训整个模型；② 要更省显存只能换 32B 的更低量化档——GGUF Q3_K（9.8G）/ IQ2_XXS（6.9G），需 ComfyUI-GGUF 节点，代价是提示词保真度下降 |

### 步骤 5 — VAE：video fp16（5.21G）+ audio fp32（0.61G）

| 维度 | 说明 |
|---|---|
| **选型** | `minimax_h3_video_vae_fp16.safetensors` + `minimax_h3_audio_vae_fp32.safetensors` |
| **收益** | video VAE 解码 latent→像素，audio VAE 解码音频 latent→32kHz 立体声波形 |
| **可行性** | ✅ **已验证可行**。VAE 只在 decode 阶段驻留（~5.8G），与采样阶段错峰，单卡无压力 |
| **可改进** | 显存极紧可把 video VAE 换 `int8_convrot`（2.81G，省 2.4G），画质几乎无损；audio VAE 必须 fp32（音频精度敏感），不可降 |

### 步骤 6 — 采样器：`euler × 4 步`

| 维度 | 说明 |
|---|---|
| **选型** | euler 采样器，4 步（原版为 res_multistep × 20 步） |
| **收益** | 少步采样是提速主体；euler 单步开销低，与蒸馏 LoRA 配套 |
| **可行性** | ✅ **内置**。帧数落在 17k+5 网格（124≈5s、243≈10s、362≈15s @24fps） |
| **可改进** | **不要在 turbo 档手动加步数**——加步不提画质只更慢。要更高画质上限请整体换回原版 20 步工作流（需 bf16 UNet，A800 单卡跑不动） |

### 步骤 7（可选）— 注意力加速：`SageAttention 2.2`

| 维度 | 说明 |
|---|---|
| **选型** | `sageattention==2.2.0` + ComfyUI-SageAttention 封装节点 |
| **收益** | 注意力内核优化，公开数据约 **-12.7%** 采样耗时（近无损） |
| **可行性** | ✅ **A800 已实测支持**。SageAttention 官方 changelog（2024-11-21）明确"measured speedup on … A100, **A800** …"。Ampere 走 **INT8-QK + FP16-PV** 路径（FP8-PV 仅 Ada/Hopper，CUDA≥12.4/12.3），仍有加速 |
| **可改进** | 需源码编译（`--no-build-isolation`，要求 nvcc）；Ampere 的加速幅度可能低于 Ada/Hopper 公开数字，装完务必实测确认生效 |

### 步骤 8（不推荐）— 步间缓存：`TeaCache / FirstBlockCache`

| 维度 | 说明 |
|---|---|
| **选型** | `Icyoung/ComfyUI-MiniMaxH3-TeaCache`（MIT，用官方 `set_model_unet_function_wrapper`，不改核心） |
| **收益** | 缓存首块残差，命中后跳过后续 DiT 块 |
| **可行性** | ⚠️ **turbo 档收益有限**。该节点公开的 **3.0× 实测是在 20 步 `res_multistep`** 上取得的；turbo 只有 **4 步 euler**，相邻步冗余极少，缓存命中低，且激进阈值在 4 步上**易肉眼掉画质** |
| **可改进** | turbo 档**不建议启用**；若坚持，阈值取极高（≥0.2）并对每条输出做 A/B 画质验证 |

## 📊 A800-40G 性能（估算，待实测）

估算环境：单卡 A800-40G · ComfyUI 0.31.0 · PyTorch cu130 · int8_convrot UNet + nvfp4 文本编码器 · 热启动 · 叠加 SageAttention。估算依据 Ampere INT8 Tensor 吞吐与 HBM2e 带宽，按 ~1.4× 系数外推（相对同走 INT8 路径的高端卡基线）：

**生成耗时（turbo 4 步，单位秒，估算区间）：**

| 分辨率 | 5s 视频 | 10s 视频 | 15s 视频 |
|---|---|---|---|
| 480p | ~50–60s | ~85–105s | ~150–185s |
| 720p | **~95–120s** | ~220–270s | ~490–600s |
| 1080p | ~300–370s | ~760–940s | ~1900–2350s |

**速度对比（turbo vs 原版 20 步，与 GPU 无关）：**

| 档位 | 加速比 |
|---|---|
| turbo 4 步 | **约 5 倍** |
| 原版 20 步 | 1x（基准） |

几个直观的参考（估算）：
- **480p/5s 约 1 分钟内**——最快出片档
- **720p/5s 约 100 秒**——泡杯咖啡回来视频就好了
- **720p/10s 约 4 分钟**——一条带配音的成片
- 首次请求需冷启动加载模型（1–5 分钟），之后热启动维持上表速度
- **1080p/15s 估算 30–40 分钟**，务必走异步 webhook（同步连接约 193s 超时）

**成本参考**（A800-40G 租赁价随平台波动，请填入你签约平台的实际单价 `X 元/卡时` 后计算）：

| 任务 | 估算耗时 | 成本 |
|---|---|---|
| 480p / 5s | ~55s | ~0.015·X 元/条 |
| 720p / 5s | ~105s | ~0.029·X 元/条 |
| 1080p / 15s | ~2100s | ~0.58·X 元/条 |

## 🚀 虚拟环境部署（无 Docker）

以 Linux + A800 服务器为例，**面向"不能科学上网 + 无可视化界面"的机房环境**：全程走国内镜像，工作流靠离线 JSON + API 提交（不依赖浏览器拖拽）。

> 部署脚本见 [`deploy/deploy.sh`](deploy/deploy.sh)（一键总控，下文 [⭐ 一键部署](#-一键部署推荐) 有完整用法）。它**默认就走国内镜像**（pip 清华源、ComfyUI 走 ghproxy、模型走 hf-mirror），无需额外配置。下面步骤 1–6 是它内部做的事，手工执行时可对照。

### 1. 建虚拟环境

```bash
# conda（推荐，便于管理 CUDA 相关依赖；8 实例共用一个环境即可）
conda create -n minimax-h3 python=3.11 -y
conda activate minimax-h3
# 或纯 venv：
# python3.11 -m venv ~/venvs/minimax-h3 && source ~/venvs/minimax-h3/bin/activate
```

### 2. 装 PyTorch（cu130，务必确认 sm_80 支持）

```bash
# 不能科学上网时：download.pytorch.org 多数国内机房可直连；不行就先配清华 pip 源
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu130

# 验证 A800 被识别、架构含 8.0
python -c "import torch; print(torch.__version__, torch.version.cuda); \
print(torch.cuda.get_device_name(0), torch.cuda.get_device_capability(0)); \
print('arch_list:', torch.cuda.get_arch_list())"
# 期望：cuda 13.0 / NVIDIA A800-40G / (8, 0) / arch_list 含 'sm_80'
```

### 3. 装 ComfyUI（0.30.0+，内置 H3 节点）

```bash
# 不能科学上网时用 GitHub 镜像前缀（二选一，哪个通用哪个）：
git clone https://ghfast.top/https://github.com/comfyanonymous/ComfyUI.git
# git clone https://gh-proxy.com/https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI
pip install -r requirements.txt
```

### 4. 下载模型（fl2va 单模式，约 44G，走 hf-mirror）

```bash
pip install -U "huggingface_hub[cli]"
export HF_ENDPOINT=https://hf-mirror.com   # 关键：不能科学上网时让 hf CLI 走国内镜像

hf download Comfy-Org/MiniMax-H3 \
  diffusion_models/minimax_h3_fl2va_pruned_int8_convrot.safetensors \
  text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors \
  vae/minimax_h3_video_vae_fp16.safetensors \
  vae/minimax_h3_audio_vae_fp32.safetensors \
  loras/minimax_h3_fl2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors \
  --local-dir /data/minimax-h3/models

# 需要 R2V 时追加（与 fl2va 二选一常驻，见显存说明）：
# hf download Comfy-Org/MiniMax-H3 \
#   diffusion_models/minimax_h3_ref2va_pruned_int8_convrot.safetensors \
#   loras/minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors \
#   --local-dir /data/minimax-h3/models
```

> **8 卡只下一份模型**：44G 权重放在共享目录（如 `/data/minimax-h3/models`），8 个实例通过 `--extra-model-paths-config` 共读同一份。若每实例各复制一份会吃掉 8×44G=352G 磁盘，且冷启动要从磁盘读 8 遍——共享后磁盘只需 44G，Linux page cache 还能让第 2~8 个实例加载显著变快。

### 5.（可选）装 SageAttention 加速

```bash
# 需要 nvcc（CUDA toolkit）与编译环境；Ampere 走 INT8-QK+FP16-PV
pip install sageattention==2.2.0 --no-build-isolation
cd custom_nodes
git clone https://ghfast.top/https://github.com/thuosac/ComfyUI-SageAttention.git
pip install -r ComfyUI-SageAttention/requirements.txt
cd ..
# 重启后在工作流 JSON 里把注意力后端切到 SageAttention（headless 下改 JSON，不用 GUI）
```

### 6. 启动（单卡）

```bash
# A800 40G，分阶段换页，无需特殊 vram 参数
python main.py --listen 127.0.0.1 --port 8180 --disable-auto-launch

# 另开终端起 comfyui-api（REST 网关，headless 下靠它提交任务）
pip install comfyui-api==1.17.1
comfyui-api --comfyui-url http://localhost:8180 --port 3000
```

## 🧮 8 卡 A800 部署（多实例 + 负载均衡）

**核心原则：8 张卡 = 8 个完全独立的 ComfyUI 实例，每卡一个，前面挂 Nginx 负载均衡。** 不是把模型拆到 8 卡（ComfyUI 不支持单模型跨卡并行），而是 8 份单卡实例并行处理 8 个请求 → **吞吐 ×8**。

```
client → Nginx(:80, least_conn)
          ├→ comfyui-api :3000 → ComfyUI :8180 → A800 GPU0
          ├→ comfyui-api :3001 → ComfyUI :8181 → A800 GPU1
          ├→ ...                                  ...
          └→ comfyui-api :3007 → ComfyUI :8187 → A800 GPU7
                       ↑
        共享 /data/minimax-h3/models（一份权重，8 实例只读共读）
```

### ⭐ 一键部署（推荐）

[`deploy/deploy.sh`](deploy/deploy.sh) 是总控脚本，覆盖体检→安装→启动→验证全流程，**自动走国内镜像、自动按内存决定实例数、自动隔离 8 实例目录**。在 Linux + A800 服务器上：

```bash
cd deploy

# 一条命令跑完全流程（体检 → 装环境+模型 → 起 8 实例 → 全链路验证）
bash deploy.sh all

# 或分步执行，便于排查：
bash deploy.sh doctor    # 环境体检：GPU/内存门槛/磁盘/镜像可达性/端口占用（只读，不改动）
bash deploy.sh install   # 装 conda环境 + torch cu130 + ComfyUI + 44G 模型（全程国内镜像）
bash deploy.sh start     # 起 N 个 ComfyUI(8180..) + N 个 API(3000..) + Nginx 负载均衡
bash deploy.sh test      # 验证节点存在性 + 真实提交出片（需 workflows/ 里有 API 格式 JSON）
bash deploy.sh status    # 每实例健康 + GPU 占用一览
bash deploy.sh stop      # 停全部；restart 重启；logs [gpu_id] 跟踪日志
```

**可覆盖的环境变量**（都有默认值）：

| 变量 | 默认 | 说明 |
|---|---|---|
| `SHARED` | `/data/minimax-h3` | 模型/日志/输出根目录（8 实例共享一份权重） |
| `INSTANCES` | `auto` | 实例数。auto = `min(GPU数, 内存GB/48)`——**内存不足时自动少起，避免 OOM** |
| `NGINX` | `1` | 是否配置 Nginx（0 跳过，直连各实例 API） |
| `COMFY_DIR` | `$HOME/ComfyUI` | ComfyUI 安装目录 |
| `ENV_NAME` | `minimax-h3` | conda 环境名（无 conda 自动用 venv） |

```bash
# 例：内存只有 128G，强制只起 2 个实例；模型放 /mnt/models
INSTANCES=2 SHARED=/mnt/models bash deploy.sh all
```

> **实例数为什么受内存约束**：每实例换页需 ~48G 内存缓冲，8 实例需 ≥384G。`doctor` 会明确告诉你当前内存够起几个，`start` 会自动取安全值并在日志里提示。

### 部署清单（[`deploy/`](deploy/)）

| 文件 | 作用 |
|---|---|
| [`deploy.sh`](deploy/deploy.sh) | **⭐ 一键总控脚本**（doctor/install/start/stop/status/test/all）。安装时自动生成 `extra_model_paths.yaml` 与 Nginx 配置，无需手工维护 |
| [`comfyui@.service`](deploy/comfyui@.service) | systemd 模板单元，开机自启 + 崩溃自动重启（生产环境推荐替代 nohup） |
| [`submit_example.py`](deploy/submit_example.py) | headless 下的 API 提交示例（同步 / 异步 webhook） |

> `deploy.sh` 会在运行时**自动生成**两个配置文件，因此仓库里不再单独存放（避免两份配置漂移）：
> - `${SHARED}/extra_model_paths.yaml` — 8 实例共享同一份模型目录
> - `${SHARED}/nginx_minimax_h3.conf` — least_conn 负载均衡，按实际实例数生成 upstream

### 启动方式二：systemd（生产推荐）

`deploy.sh start` 用 nohup 拉起进程，适合验证；生产环境建议改用 systemd，获得**开机自启 + 崩溃自动重启 + 日志进 journald**：

```bash
cd deploy
sudo cp comfyui@.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now comfyui@{0..7}    # 一次性拉起 8 个 ComfyUI 实例

journalctl -u comfyui@3 -f                    # 看第 3 张卡的日志
systemctl status 'comfyui@*'                  # 全部实例状态

# comfyui-api 网关仍用 deploy.sh（或同样 systemd 化）
INSTANCES=8 bash deploy.sh start              # 端口已占用时会自动跳过 ComfyUI，只补起 API
```

> ⚠️ `comfyui@.service` 里的路径需按实际环境改：`WorkingDirectory`（ComfyUI 目录）、`Environment="PATH=..."`（conda 环境的 bin）、以及 `818%i` 端口段要与 `deploy.sh` 的 `COMFY_BASE_PORT=8180` 保持一致。

### 8 卡资源预算（关键约束）

| 资源 | 单实例 | ×8 合计 | 说明 |
|---|---|---|---|
| **GPU 显存** | ≤40G | 每卡独立 40G | 各实例独占一张卡，互不挤占 |
| **内存（RAM）** | ~40–50G | **320–400G** | ⚠️ **最大坑**：每实例换页需把 offload 的权重驻留内存，8 实例叠加。**主机内存必须 ≥ 384G**，否则触发 OOM/swap 反而更慢。内存不足时减少实例数（如只起 4 个） |
| **磁盘** | 44G（共享） | **44G** | 共享模型目录，不随实例数增长 |
| **CPU** | — | 建议 ≥32 核 | 换页调度、VAE、音频编码吃 CPU；核少会成瓶颈 |

> **内存是 8 卡部署的硬门槛**：A800 单卡 40G 装不下 44.5G 权重，靠把 offload 部分放内存。8 实例 = 8 份换页缓冲。**若主机内存 < 384G，不要盲目起 8 个实例**——按 `实例数 ≈ 内存GB / 48G` 估算上限，宁可少起几个也别 OOM。

### headless 提交（无 GUI）

服务器无可视化界面，**不能在浏览器里拖工作流**。流程：

1. 在**任意有界面的机器**上打开 ComfyUI，加载工作流 → 开启 Dev mode → **Save (API Format)** 导出 `api.json`（前端格式 ≠ API 格式，`/prompt` 只认后者）
2. 把 `api.json` 拷到服务器
3. 用 [`deploy/submit_example.py`](deploy/submit_example.py) 经 Nginx 提交；改 seed/分辨率/提示词直接在 Python 里改 JSON 字典字段，无需 GUI

```bash
# 同步（480p/720p 短任务）
python deploy/submit_example.py workflows/t2v_api.json --mode sync --out demo

# 异步 webhook（1080p/15s 长任务，避开网关 ~193s 超时）
python deploy/submit_example.py workflows/t2v_api.json --mode async \
  --task-id job-001 --webhook https://your-server.com/callback
```

### 冒烟测试与监控

```bash
# 单实例探活
curl http://127.0.0.1:3000/health   # {"version":"1.17.1","status":"healthy"}
curl http://127.0.0.1:8180/system_stats   # ComfyUI 原生：显存/队列状态

# 经 Nginx 的整体入口
curl http://<server-ip>/health

# 8 实例日志
tail -f /data/minimax-h3/logs/comfy-gpu*.log
# systemd 方式：journalctl -u 'comfyui@*' -f
```

> **并发模型**：每个 ComfyUI 实例是**串行队列（1 并发）**，8 实例 = 全局 8 并发。Nginx 用 `least_conn` 把请求派给当前最闲的实例。要更高并发只能加机器横向扩展，comfyui-api 无状态、天然支持。
>
> **故障摘除**：Nginx 配了 `max_fails=2 fail_timeout=15s`，某实例崩溃会被自动摘出轮询，systemd 再把它拉起。

## ⚡ 为什么快

原版（20 步）与 turbo（4 步）的差异只有三处，其余链路完全一致：

| 组件 | 原版 | turbo |
|---|---|---|
| 采样步数 | 20 | **4** |
| 采样器 | res_multistep | **euler** |
| 额外节点 | — | **4 步蒸馏 LoRA + MiniMaxH3SigmaShift（video=12 / audio=3）** |

蒸馏 LoRA 重新训练了去噪轨迹，专为 4 步生成优化。**不要在 turbo 档下手动加步数**——加步数不会提升画质，只会更慢。

模型链路（**A800 / cu130 优化版**）：

```
UNETLoader(int8_convrot fl2va) → LoraLoaderModelOnly(turbo 4step) → MiniMaxH3SigmaShift(12/3)
CLIPLoader(Qwen3-VL-32B nvfp4，Ampere 按层反量化运行) + VAELoader(video fp16 / audio fp32)
   [可选] SageAttention 注意力后端（A800 已实测支持）
        ↓
MiniMaxH3ImageToVideo / MiniMaxH3ReferenceToVideo（提示词 + 分辨率 + 帧数）
        ↓
euler × 4 步 → VAEDecode(视频) + VAEDecodeAudio(音频) → CreateVideo(24fps) → SaveVideo(MP4 含音轨)
```

## 📁 工作流

`workflows/` 目录提供三个 turbo 工作流（ComfyUI 前端格式，拖入即用）：

| 文件 | 模式 | 主模型 | LoRA |
|---|---|---|---|
| `video_minimax_h3_t2v_turbo4step_zh.json` | 文生视频 | fl2va | fl2v turbo v1.0 |
| `video_minimax_h3_i2v_turbo4step_zh.json` | 图生视频 | fl2va | fl2v turbo v1.0 |
| `video_minimax_h3_r2v_turbo4step_zh.json` | 参考生视频 | ref2va | ref2v turbo v0.1 |

> ⚠️ **fl2v 与 ref2v 的 LoRA 不可混用**：T2V/I2V 用 `fl2v_turbo_4step_v1.0_768p`，R2V 用 `ref2v_turbo_4step_v0.1`。主模型同理：fl2va 对应 T2V/I2V，ref2va 对应 R2V。
>
> ⚠️ **A800 显存建议**：40G 无法让 fl2va + ref2va 两套 int8 UNet（各 ~21G）同时常驻。**按业务只下一套**；若必须同时支持 T2V/I2V 与 R2V，切换模式时会重新加载 UNet（冷启动 1–3 分钟），或部署两个实例分别承载。

### 生成参数速查

- **分辨率**：宽高须为 32 的倍数（480p/720p/1080p/768p 四档 × 16:9/9:16/4:3/1:1 四比例）
- **时长**：帧数落在 17k+5 网格（124≈5s、243≈10s、362≈15s @24fps）
- **提示词**：支持多镜头剪辑标记、中文对白标签、屏幕文字渲染；R2V 用 `<Picture 1>` `<Video 1>` `<Audio 1>` 标签引用参考素材

## 📦 模型清单（fl2va 单模式，约 44G）

来自 HuggingFace 官方仓库 [`Comfy-Org/MiniMax-H3`](https://huggingface.co/Comfy-Org/MiniMax-H3)：

| 文件 | 大小 | 位置 | A800 说明 |
|---|---|---|---|
| minimax_h3_fl2va_pruned_int8_convrot.safetensors | 20.97G | diffusion_models/ | **Ampere 原生 INT8，官方推荐 cu130 用** |
| qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors | 15.69G | text_encoders/ | 官方最小文本编码器，声明不需 Blackwell，A800 反量化运行 |
| minimax_h3_video_vae_fp16.safetensors | 5.21G | vae/ | 显存吃紧可换 int8 版（2.81G） |
| minimax_h3_audio_vae_fp32.safetensors | 0.61G | vae/ | 音频精度敏感，不可降档 |
| minimax_h3_fl2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors | 1.96G | loras/ | turbo 4 步蒸馏 LoRA |

> R2V 模式把 `fl2va` 换成 `minimax_h3_ref2va_pruned_int8_convrot.safetensors`（20.97G）、LoRA 换成 `ref2v_turbo_4step`。文本编码器和 VAE 共用。下载命令见 [虚拟环境部署 步骤 4](#4-下载模型fl2va-单模式约-44g)。

## 🔌 API 调用

由 [comfyui-api](https://github.com/SaladTechnologies/comfyui-api) v1.17.1 提供 REST 网关。**单卡**直连 `http://localhost:3000`；**8 卡**统一走 Nginx 入口 `http://<server-ip>/`（负载均衡到 3000..3007）。

| 端点 | 用途 |
|---|---|
| `POST /prompt` | 提交工作流 JSON。默认同步阻塞，直接返回 base64 编码的 MP4/FLAC |
| `POST /prompt` + `webhook_v2` | 异步模式：立即返回 202 + 任务 ID，完成后服务端 POST 回调你的接口 |
| `GET /health` | 健康检查（进程存活） |
| `GET /ready` | 就绪检查（队列未满） |
| `GET /docs` | Swagger 交互文档 |

> ⚠️ **headless 关键**：`/prompt` 只认 **API 格式** JSON（扁平的 `{节点id: {class_type, inputs}}`），**不是**浏览器拖出来的前端格式。无 GUI 时，需在有界面的机器上开 Dev mode → "Save (API Format)" 导出后拷到服务器。详见 [8 卡部署 → headless 提交](#headless-提交无-gui) 与 [`deploy/submit_example.py`](deploy/submit_example.py)。

最小调用示例（同步，720p/5s 估算约 100 秒返回）：

```bash
curl -X POST http://localhost:3000/prompt \
  -H "Content-Type: application/json" \
  -d '{"prompt": <API格式工作流JSON>}' \
  | python -c "import sys,json,base64; [open('out_%d.mp4'%i,'wb').write(base64.b64decode(b)) for i,b in enumerate(json.load(sys.stdin)['images'])]"
```

异步模式（长任务推荐——同步连接在网关处约 193s 超时，1080p 或 15s 时长务必走异步）：

```python
result = client.async_submit(
    workflow,
    webhook_url="https://your-server.com/callback",
    task_id="my-task-001",
)
# → 202 {"id": "my-task-001"}
# 完成后服务端 POST 回调：prompt.complete（含 base64 视频音频 + 耗时统计）
# 失败回调：prompt.failed（含错误详情）
# 回调失败自动重试最多 3 次，回调接口请做幂等
```

## ❓ 常见问题

- **A800 能直接套 Ada/Blackwell 卡的方案吗？** 不能照搬。文本编码器 nvfp4 可用（官方声明不需 Blackwell），但 **UNet 必须用 int8_convrot，不能用 fp8_scaled**——A800 无原生 FP8，fp8 会被 cast 回 bf16，既不加速还多反量化开销。int8 才是 Ampere 的原生快路径。
- **32B nvfp4 在 A800 上会反量化吗？慢多少？** 会。A800 不支持原生 FP4 compute，ComfyUI 按层反量化到 bf16 计算，但**驻留仍是打包的 15.7G**（不膨胀成 51.5G）。反量化只发生在提示词编码阶段（每请求一次），端到端约 +1–3s，不影响 4 步采样。
- **为什么不能用更小的 Qwen3-VL-4B 文本编码器？** 官方和社区都没有 H3 的 4B 文本编码器，且 4B(hidden=2560) 与 UNet 训练时用的 32B(hidden=5120) 维度不匹配，无法直接替换。只能换 32B 的量化档（nvfp4 已是最小官方单文件）。
- **两张 A800 能拼起来零换页跑吗？** 不能。ComfyUI 不支持单模型跨卡拆分（无 tensor/pipeline 并行）。双卡正确用法是双实例 + 负载均衡提吞吐；单实例零换页全常驻需 44.5G > 40G，只能靠降文本编码器量化档（见显存章节）。
- **首条请求慢（1–5 分钟）**：冷启动加载约 44G 权重（含阶段换页），属正常。生产环境可在服务就绪后先发一个 480p 小任务预热。
- **第二次请求秒回**：ComfyUI 执行缓存命中（参数全同直接复用结果）。跑性能测试务必每次换 seed。
- **长任务拿不到结果**：同步连接约 193s 超时。1080p/15s 档（估算 30–40 分钟）请走异步 webhook 模式。
- **SageAttention 装了没提速？** 确认编译时识别到 sm_80、且工作流注意力后端确实切到了 SageAttention；Ampere 走 INT8-QK+FP16-PV，加速幅度可能低于 Ada/Hopper 的公开数字。
- **能不能上 TeaCache/FirstBlockCache 再快一倍？** turbo 只有 4 步，步间冗余小，缓存收益有限且易掉画质——那个 3× 数字是 20 步场景。turbo 档不建议；要试就用极高阈值（≥0.2）并逐条 A/B。
- **并发**：单实例 = 1 并发（ComfyUI 队列串行）。提吞吐靠多实例 + 负载均衡，comfyui-api 本身为无状态设计，天然支持水平扩展。
- **8 卡需要多少内存？** 每实例换页需 ~40–50G 内存缓冲，8 实例叠加需 **≥384G RAM**——这是 8 卡部署最容易被忽略的硬门槛。内存不足时按 `实例数 ≈ 内存GB / 48G` 减少实例数，别盲目起满 8 个。
- **服务器不能科学上网怎么装？** 全程走国内镜像：pip 用清华源、ComfyUI 用 ghproxy 前缀、模型用 `HF_ENDPOINT=https://hf-mirror.com`。这些已是 [`deploy/deploy.sh`](deploy/deploy.sh) 的默认行为，直接 `bash deploy.sh all` 即可。
- **无 GUI 怎么提交工作流？** 不能拖拽。在有界面的机器上导出 API 格式 JSON，拷到服务器后用 [`deploy/submit_example.py`](deploy/submit_example.py) 经 API 提交；改参数直接改 JSON 字典字段。
- **8 卡能不能跑更大的模型（拼显存）？** 不能。ComfyUI 不支持单模型跨卡拆分（无 tensor/pipeline 并行）。8 卡只能做数据并行（8 个独立单卡实例），每个实例仍受单卡 40G 限制。

## 📄 License

- 代码与工作流：MIT
- 模型权重：遵循 [MiniMax H3 Community License](https://huggingface.co/Comfy-Org/MiniMax-H3)（Comfy-Org 打包）

---

### 附：本文档 A800 适配的核查依据

| 结论 | 一手来源 |
|---|---|
| 只有 32B 文本编码器，无 4B | HF API 遍历 `Comfy-Org/MiniMax-H3`（bf16 51.5G/int8 27.1G/nvfp4 15.7G 三档）+ 全社区搜索（GGUF/NF4/fp8/heretic 均 32B） |
| 4B 维度不兼容 | `Qwen/Qwen3-VL-4B-Instruct` config `hidden_size=2560` vs `Qwen3-VL-32B` `hidden_size=5120` |
| A800 无原生 FP8 | ComfyUI `comfy/model_management.py::supports_fp8_compute()` 要求 `major>=9` 或 `major==8 and minor>=9`；A800=sm_80(8,0) → False |
| A800 无原生 FP4 | 同文件 `supports_nvfp4_compute()` 要求 `major>=10`；A800 → False（故 nvfp4 走按层反量化） |
| int8 原生加速 | 同文件 `supports_int8_compute()` → True（`torch._int_mm`）；官方 README："能用 cu130 就优先 int8_convrot" |
| nvfp4 不需 Blackwell | 官方 `Comfy-Org/MiniMax-H3` README 原文："This nvfp4 text encoder does not require Blackwell GPU to use." |
| CUDA 13.0 支持 sm_80 | NVIDIA CUDA 13.0 Release Notes：仅移除 Maxwell/Pascal/Volta，Ampere 保留 |
| ComfyUI 不支持单模型跨卡 | `comfy/cli_args.py`：`--cuda-device` 仅控制可见设备，无 tensor/pipeline 并行调度 |
| SageAttention 支持 A800 | thu-ml/SageAttention README：2024-11-21 "measured speedup on L20, L40, A100, **A800**, A6000, RTX3090/4090"；Ampere 走 int8-qk+fp16-pv |
| TeaCache 3× 是 20 步场景 | `Icyoung/ComfyUI-MiniMaxH3-TeaCache` README：benchmark 为 20 步 res_multistep @ 1024×576 |
| 显存/性能数字为估算 | 驻留大小取自 HF 文件 size；阶段峰值与耗时为工程推算，**未经真机实测** |
