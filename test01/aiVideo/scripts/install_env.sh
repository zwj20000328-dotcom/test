#!/usr/bin/env bash
# ============================================================================
# install_env.sh —— 在 8×A800 / CUDA13 / Linux 部署机上搭建 Python 环境
# 全程国内镜像，不需要科学上网。
#
# 用法：  bash scripts/install_env.sh
# 幂等：  可重复运行。
# ============================================================================
set -euo pipefail

# ---- 可调参数 ----------------------------------------------------------------
ENV_NAME="${ENV_NAME:-drama}"
PY_VER="${PY_VER:-3.11}"
MODEL_ROOT="${MODEL_ROOT:-/data/models}"
CONDA_SH="${CONDA_SH:-Miniconda3-latest-Linux-x86_64.sh}"
CONDA_MIRROR="https://mirrors.tuna.tsinghua.edu.cn/anaconda/miniconda"
PIP_INDEX="https://mirrors.aliyun.com/pypi/simple"          # 备用: https://pypi.tuna.tsinghua.edu.cn/simple
TORCH_INDEX="https://mirrors.aliyun.com/pytorch-wheels/cu128"  # cu128 在 CUDA13 驱动前向兼容
TORCH_VER="2.8.0"
TV_VER="0.23.0"
TA_VER="2.8.0"

log(){ echo -e "\n\033[1;36m[install] $*\033[0m"; }
warn(){ echo -e "\033[1;33m[warn] $*\033[0m"; }

# ---- 0) 驱动确认 (CUDA13 需驱动 >=580 才保证 cu128 前向兼容) -------------------
log "检查 GPU 驱动 (需 Driver >= 580 / CUDA 13.0)"
if command -v nvidia-smi >/dev/null 2>&1; then
  nvidia-smi --query-gpu=index,name,memory.total,driver_version --format=csv || true
  DRV=$(nvidia-smi --query-gpu=driver_version --format=csv,noheader | head -1 | cut -d. -f1)
  if [ "${DRV:-0}" -lt 580 ]; then
    warn "驱动 ${DRV} < 580，cu128 wheel 可能无法在 CUDA13 上前向兼容。请先升级驱动，或改用 cu124 基线。"
  fi
else
  warn "未找到 nvidia-smi，跳过驱动检查（请确认本机有 8×A800）。"
fi

# ---- 1) Miniconda + 镜像 ------------------------------------------------------
if ! command -v conda >/dev/null 2>&1; then
  log "下载 Miniconda (清华镜像)"
  cd /tmp
  [ -f "$CONDA_SH" ] || wget -q "$CONDA_MIRROR/$CONDA_SH"
  bash "$CONDA_SH" -b -p "$HOME/miniconda3"
  # shellcheck disable=SC1091
  source "$HOME/miniconda3/etc/profile.d/conda.sh"
else
  log "conda 已存在，跳过安装"
  # shellcheck disable=SC1091
  source "$(conda info --base)/etc/profile.d/conda.sh"
fi

log "写入 ~/.condarc (清华镜像)"
cat > "$HOME/.condarc" <<EOF
channels:
  - defaults
show_channel_urls: true
default_channels:
  - https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/main
  - https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/r
custom_channels:
  conda-forge: https://mirrors.tuna.tsinghua.edu.cn/anaconda/cloud
EOF

# ---- 2) conda 环境 ------------------------------------------------------------
log "创建/激活 conda 环境 ${ENV_NAME} (python ${PY_VER})"
conda create -n "$ENV_NAME" "python=${PY_VER}" -y || true
conda activate "$ENV_NAME"

log "安装 ffmpeg (conda-forge, 自带 libass 用于硬烧字幕)"
conda install -c conda-forge ffmpeg -y
if ffmpeg -version 2>/dev/null | grep -q -- "--enable-libass"; then
  log "✓ ffmpeg 已启用 libass"
else
  warn "ffmpeg 未检测到 libass，字幕烧录可能失败。请改用 conda-forge 的 ffmpeg 或静态构建。"
fi

# ---- 3) pip 镜像 --------------------------------------------------------------
log "配置 pip 镜像 (阿里云)"
pip config set global.index-url "$PIP_INDEX"
pip install -U pip wheel setuptools

# ---- 4) torch (cu128, 已核验存在于阿里云镜像) ---------------------------------
log "安装 torch ${TORCH_VER}+cu128 (阿里云 pytorch-wheels 镜像)"
pip install "torch==${TORCH_VER}" "torchvision==${TV_VER}" "torchaudio==${TA_VER}" \
  --index-url "$TORCH_INDEX"

log "验证 torch / CUDA"
python - <<'PY'
import torch
print("torch:", torch.__version__, "| cuda:", torch.version.cuda,
      "| available:", torch.cuda.is_available(), "| device_count:", torch.cuda.device_count())
assert torch.cuda.is_available(), "CUDA 不可用！检查驱动。"
print("GPU0:", torch.cuda.get_device_name(0))
PY

# ---- 5) 推理栈 ----------------------------------------------------------------
log "安装推理/编排依赖 (阿里云 PyPI 镜像)"
# 版本按 cu128+torch2.8 基线对齐；flash-attn 无预编译 wheel，源码编译较慢，先不装(可选)。
pip install \
  "xformers==0.0.30" \
  "modelscope==1.40.2" \
  "huggingface_hub" "hf_transfer" \
  "diffusers==0.41.0" "accelerate" "transformers" "sentencepiece" "protobuf" \
  "vllm" \
  "funasr" "faster-whisper" \
  "celery" "redis" \
  "ffmpeg-python" "moviepy" \
  "pydantic>=2" "pyyaml" "rich" "tqdm" "pillow" "soundfile" "librosa" \
  "opencv-python-headless"

# ---- 6) 镜像环境变量 (写入 ~/.bashrc，供后续下载/推理使用) ----------------------
log "写入镜像环境变量到 ~/.bashrc"
grep -q "HF_ENDPOINT=https://hf-mirror.com" "$HOME/.bashrc" 2>/dev/null || cat >> "$HOME/.bashrc" <<EOF

# ---- aiVideo 短剧工作流 镜像环境变量 (install_env.sh 写入) ----
export HF_ENDPOINT=https://hf-mirror.com
export HF_HUB_ENABLE_HF_TRANSFER=1
export MODELSCOPE_CACHE=${MODEL_ROOT}
export PIP_INDEX_URL=${PIP_INDEX}
EOF

mkdir -p "$MODEL_ROOT"

log "✓ 环境安装完成。下一步："
echo "    source ~/.bashrc"
echo "    conda activate ${ENV_NAME}"
echo "    bash scripts/download_models.sh"
