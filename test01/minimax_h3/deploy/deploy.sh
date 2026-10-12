#!/usr/bin/env bash
# =============================================================================
# MiniMax H3 Turbo — 一键部署总控脚本
# 目标环境：Linux + Nvidia A800-40G ×N + CUDA 13.0，不能科学上网，无可视化界面
#
# 用法：
#   bash deploy.sh doctor            # 环境体检（不改动任何东西）
#   bash deploy.sh install           # 装 conda/venv + torch cu130 + ComfyUI + 模型
#   bash deploy.sh start             # 起 N 个 ComfyUI + N 个 API + Nginx
#   bash deploy.sh stop              # 停全部实例
#   bash deploy.sh restart           # 重启
#   bash deploy.sh status            # 每实例状态 + GPU 占用
#   bash deploy.sh logs [gpu_id]     # 跟踪日志
#   bash deploy.sh test              # 全链路验证（节点存在性 + 可选真提交）
#   bash deploy.sh all               # doctor → install → start → test
#
# 可用环境变量覆盖（都有默认值）：
#   SHARED=/data/minimax-h3   模型/日志/输出根目录
#   COMFY_DIR=$HOME/ComfyUI   ComfyUI 安装目录
#   ENV_NAME=minimax-h3       conda 环境名（无 conda 时自动用 venv: $SHARED/venv）
#   INSTANCES=auto            实例数（auto=按显存/内存自动算）
#   NGINX=1                   是否配置并启动 Nginx（0 跳过）
# =============================================================================

set -uo pipefail

# ---------- 配置 ----------
SHARED="${SHARED:-/data/minimax-h3}"
COMFY_DIR="${COMFY_DIR:-$HOME/ComfyUI}"
ENV_NAME="${ENV_NAME:-minimax-h3}"
MODELS_DIR="${SHARED}/models"
LOG_DIR="${SHARED}/logs"
PID_DIR="${SHARED}/pids"
COMFY_BASE_PORT="${COMFY_BASE_PORT:-8180}"     # ComfyUI: 8180..8187
API_BASE_PORT="${API_BASE_PORT:-3000}"         # API:     3000..3007
NGINX_ENABLED="${NGINX:-1}"
NGINX_PORT="${NGINX_PORT:-80}"
RAM_PER_INSTANCE="${RAM_PER_INSTANCE:-48}"     # 每实例内存预算(GB)——换页缓冲
DISK_REQUIRED_GB="${DISK_REQUIRED_GB:-100}"

# 国内镜像
PIP_MIRROR="${PIP_MIRROR:-https://pypi.tuna.tsinghua.edu.cn/simple}"
PIP_HOST="${PIP_HOST:-pypi.tuna.tsinghua.edu.cn}"
HF_MIRROR="${HF_ENDPOINT:-https://hf-mirror.com}"
GH_PROXY="${GH_PROXY:-https://ghfast.top}"
TORCH_INDEX="${TORCH_INDEX:-https://download.pytorch.org/whl/cu130}"

# 模型清单（fl2va 单模式；R2V 见 install 末尾提示）
HF_REPO="Comfy-Org/MiniMax-H3"
MODEL_FILES=(
  "diffusion_models/minimax_h3_fl2va_pruned_int8_convrot.safetensors"
  "text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"
  "vae/minimax_h3_video_vae_fp16.safetensors"
  "vae/minimax_h3_audio_vae_fp32.safetensors"
  "loras/minimax_h3_fl2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors"
)

# ---------- 工具函数 ----------
c_red()   { printf '\033[31m%s\033[0m\n' "$*"; }
c_grn()   { printf '\033[32m%s\033[0m\n' "$*"; }
c_yel()   { printf '\033[33m%s\033[0m\n' "$*"; }
c_cyn()   { printf '\033[36m%s\033[0m\n' "$*"; }
info()    { c_cyn "[*] $*"; }
ok()      { c_grn "[✓] $*"; }
warn()    { c_yel "[!] $*"; }
err()     { c_red "[✗] $*"; }
die()     { err "$*"; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "缺少命令: $1（请先安装）"; }

# ---------- 环境探测 ----------
detect_gpus() {
  command -v nvidia-smi >/dev/null 2>&1 || { echo 0; return; }
  nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | grep -c . || echo 0
}

detect_ram_gb() {
  awk '/MemTotal/ {printf "%d", $2/1024/1024}' /proc/meminfo 2>/dev/null || echo 0
}

detect_disk_gb() {
  local d="$SHARED"
  [ -d "$d" ] || d="$(dirname "$d")"
  [ -d "$d" ] || d="/"
  df -BG --output=avail "$d" 2>/dev/null | tail -1 | tr -dc '0-9' || echo 0
}

# 计算实例数：受 GPU 数与内存双重约束
calc_instances() {
  local gpus ram by_ram
  gpus="$(detect_gpus)"
  ram="$(detect_ram_gb)"
  by_ram=$(( ram / RAM_PER_INSTANCE ))
  [ "$by_ram" -lt 1 ] && by_ram=1
  local n=$(( gpus < by_ram ? gpus : by_ram ))
  [ "$n" -lt 1 ] && n=0
  echo "$n"
}

resolve_instances() {
  if [ "${INSTANCES:-auto}" = "auto" ]; then calc_instances; else echo "${INSTANCES}"; fi
}

# python 解释器（conda 环境或 venv）
py_bin() {
  if [ -n "${CONDA_PREFIX:-}" ] && [ -x "$CONDA_PREFIX/bin/python" ]; then
    echo "$CONDA_PREFIX/bin/python"
  elif [ -x "$SHARED/venv/bin/python" ]; then
    echo "$SHARED/venv/bin/python"
  elif command -v conda >/dev/null 2>&1; then
    local base; base="$(conda info --base 2>/dev/null)"
    [ -x "$base/envs/$ENV_NAME/bin/python" ] && { echo "$base/envs/$ENV_NAME/bin/python"; return; }
  fi
  command -v python3 || command -v python
}

activate_env() {
  if command -v conda >/dev/null 2>&1; then
    local base; base="$(conda info --base 2>/dev/null)"
    if [ -n "$base" ] && [ -d "$base/envs/$ENV_NAME" ]; then
      # shellcheck disable=SC1091
      source "$base/etc/profile.d/conda.sh"
      conda activate "$ENV_NAME" && return 0
    fi
  fi
  if [ -f "$SHARED/venv/bin/activate" ]; then
    # shellcheck disable=SC1091
    source "$SHARED/venv/bin/activate" && return 0
  fi
  return 1
}

port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1; }

# 目录按需创建（doctor/usage 是只读操作，不该因为无权限建目录而报错）
ensure_dirs() { mkdir -p "$SHARED" "$LOG_DIR" "$PID_DIR" "$MODELS_DIR" 2>/dev/null; }

# 网络可达性：决定用官方源还是镜像
# 注意：部分国内镜像（如 hf-mirror）不响应 HEAD 请求，需回退到 GET 探测，否则会误报不可达
net_ok() {
  curl -sI --max-time 8 "$1" >/dev/null 2>&1 && return 0
  curl -s --max-time 8 -o /dev/null -r 0-0 "$1" >/dev/null 2>&1 && return 0
  curl -s --max-time 8 -o /dev/null "$1" >/dev/null 2>&1
}

# =============================================================================
# doctor — 环境体检
# =============================================================================
cmd_doctor() {
  c_cyn "========== MiniMax H3 部署体检 =========="
  local fail=0

  # GPU
  local gpus; gpus="$(detect_gpus)"
  if [ "$gpus" -gt 0 ]; then
    ok "GPU: 检测到 ${gpus} 张"
    nvidia-smi --query-gpu=index,name,memory.total,driver_version --format=csv,noheader 2>/dev/null | sed 's/^/      /'
    # 架构检查（A800 应为 sm_80 / compute 8.0）
    local cc; cc="$(nvidia-smi --query-gpu=compute_cap --format=csv,noheader 2>/dev/null | head -1)"
    [ -n "$cc" ] && info "compute capability: $cc（A800 应为 8.0）"
    # 驱动需支持 CUDA 13.0（>=580）
    local drv; drv="$(nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>/dev/null | head -1 | cut -d. -f1)"
    if [ -n "$drv" ] && [ "$drv" -lt 580 ] 2>/dev/null; then
      warn "驱动 ${drv}.x 可能不支持 CUDA 13.0（需 ≥580）。可改用 cu128 或升级驱动"
    fi
  else
    err "GPU: 未检测到 Nvidia GPU 或 nvidia-smi 不可用"; fail=1
  fi

  # 内存 —— 8 卡部署最大门槛
  local ram inst; ram="$(detect_ram_gb)"; inst="$(calc_instances)"
  if [ "$ram" -ge 384 ]; then
    ok "内存: ${ram}G（可支撑 8 实例换页）"
  elif [ "$ram" -ge "$RAM_PER_INSTANCE" ]; then
    warn "内存: ${ram}G —— 只够约 ${inst} 个实例（每实例需 ~${RAM_PER_INSTANCE}G 换页缓冲）"
    warn "      盲目起满 8 实例会 OOM。脚本将自动限制为 ${inst} 个实例"
  else
    err "内存: ${ram}G 过低（至少需 ${RAM_PER_INSTANCE}G 跑 1 个实例）"; fail=1
  fi

  # 磁盘
  local disk; disk="$(detect_disk_gb)"
  if [ "$disk" -ge "$DISK_REQUIRED_GB" ]; then
    ok "磁盘: ${SHARED} 所在分区可用 ${disk}G（需 ≥${DISK_REQUIRED_GB}G）"
  else
    err "磁盘: 可用 ${disk}G 不足（需 ≥${DISK_REQUIRED_GB}G，模型占 44G）"; fail=1
  fi

  # 网络：判断能否直连官方源
  info "网络可达性（决定是否走国内镜像）:"
  for url in "https://pypi.org" "https://huggingface.co" "https://github.com" "https://download.pytorch.org"; do
    if net_ok "$url"; then ok "    可直连 $url"; else warn "    不可达 $url → 将走镜像"; fi
  done
  for url in "$PIP_MIRROR" "$HF_MIRROR" "$GH_PROXY"; do
    if net_ok "$url"; then ok "    镜像可用 $url"; else err "    镜像不可达 $url"; fail=1; fi
  done

  # 工具
  for t in curl git python3; do
    command -v "$t" >/dev/null 2>&1 && ok "工具: $t $(command -v $t)" || { err "工具: 缺少 $t"; fail=1; }
  done
  command -v conda >/dev/null 2>&1 && ok "工具: conda（将用 conda 环境 $ENV_NAME）" \
    || warn "工具: 无 conda，将用 venv（$SHARED/venv）"

  # 端口占用
  local n="${INSTANCES:-8}"
  local busy=""
  for i in $(seq 0 $((n-1))); do
    port_busy $((COMFY_BASE_PORT+i)) && busy="$busy $((COMFY_BASE_PORT+i))"
    port_busy $((API_BASE_PORT+i))    && busy="$busy $((API_BASE_PORT+i))"
  done
  [ -n "$busy" ] && warn "端口已被占用:$busy（可能已有实例在跑，或需改端口）" || ok "端口 ${COMFY_BASE_PORT}..$((COMFY_BASE_PORT+n-1)) / ${API_BASE_PORT}..$((API_BASE_PORT+n-1)) 空闲"

  echo
  if [ "$fail" -eq 0 ]; then
    ok "体检通过。建议实例数：${inst}（GPU ${gpus} 张 × 内存约束 ${ram}G/${RAM_PER_INSTANCE}G）"
    info "下一步：bash deploy.sh install"
  else
    err "体检发现问题，请先修复上述 [✗] 项"
    return 1
  fi
}

# =============================================================================
# install — 环境 + ComfyUI + 模型（全程国内镜像）
# =============================================================================
cmd_install() {
  ensure_dirs
  info "===== 1/5 配置 pip 国内镜像 ====="
  local py; py="$(command -v python3 || command -v python)"
  "$py" -m pip config set global.index-url "$PIP_MIRROR" 2>/dev/null || true
  "$py" -m pip config set global.trusted-host "$PIP_HOST" 2>/dev/null || true
  ok "pip 源 → $PIP_MIRROR"

  info "===== 2/5 创建 Python 环境 ====="
  if command -v conda >/dev/null 2>&1; then
    local base; base="$(conda info --base)"
    # shellcheck disable=SC1091
    source "$base/etc/profile.d/conda.sh"
    if [ ! -d "$base/envs/$ENV_NAME" ]; then
      conda create -n "$ENV_NAME" python=3.11 -y || die "conda 环境创建失败"
    else
      ok "conda 环境 $ENV_NAME 已存在，跳过创建"
    fi
    conda activate "$ENV_NAME" || die "conda activate 失败"
  else
    if [ ! -d "$SHARED/venv" ]; then
      mkdir -p "$SHARED"
      python3 -m venv "$SHARED/venv" || die "venv 创建失败"
    else
      ok "venv 已存在，跳过创建"
    fi
    # shellcheck disable=SC1091
    source "$SHARED/venv/bin/activate"
  fi
  ok "Python: $(python -V) @ $(command -v python)"

  info "===== 3/5 安装 PyTorch (cu130) ====="
  if python -c "import torch" 2>/dev/null; then
    ok "torch 已装: $(python -c 'import torch;print(torch.__version__, torch.version.cuda)')"
  else
    pip install torch torchvision torchaudio --index-url "$TORCH_INDEX" \
      || pip install torch torchvision torchaudio \
      || die "PyTorch 安装失败"
  fi
  # 验证 sm_80
  python - <<'PY' || warn "torch CUDA 自检未通过，请检查驱动/架构"
import torch
print("  torch:", torch.__version__, "| cuda:", torch.version.cuda)
print("  device:", torch.cuda.get_device_name(0))
print("  capability:", torch.cuda.get_device_capability(0), "(A800 应为 (8,0))")
al = torch.cuda.get_arch_list()
print("  arch_list:", al)
assert any("80" in a for a in al), "arch_list 不含 sm_80！此 torch 构建不支持 A800"
PY
  ok "PyTorch 就绪"

  info "===== 4/5 安装 ComfyUI ====="
  if [ ! -d "$COMFY_DIR/.git" ]; then
    mkdir -p "$(dirname "$COMFY_DIR")"
    git clone "${GH_PROXY}/https://github.com/comfyanonymous/ComfyUI.git" "$COMFY_DIR" \
      || git clone "https://gh-proxy.com/https://github.com/comfyanonymous/ComfyUI.git" "$COMFY_DIR" \
      || git clone "https://github.com/comfyanonymous/ComfyUI.git" "$COMFY_DIR" \
      || die "ComfyUI 克隆失败（镜像与官方均不可达）"
  else
    ok "ComfyUI 已存在于 $COMFY_DIR，跳过克隆"
  fi
  pip install -r "$COMFY_DIR/requirements.txt" || die "ComfyUI 依赖安装失败"
  pip install "comfyui-api==1.17.1" || die "comfyui-api 安装失败"
  pip install -U "huggingface_hub[cli]" || die "huggingface_hub 安装失败"
  ok "ComfyUI + comfyui-api 就绪"

  info "===== 5/5 下载模型（44G，走 hf-mirror）====="
  mkdir -p "$MODELS_DIR"
  export HF_ENDPOINT="$HF_MIRROR"
  # 已下载的文件会自动跳过（断点续传）；hf 是新版命令，旧版为 huggingface-cli
  if command -v hf >/dev/null 2>&1; then
    hf download "$HF_REPO" "${MODEL_FILES[@]}" --local-dir "$MODELS_DIR" \
      || die "模型下载失败。可重跑 bash deploy.sh install 续传"
  else
    huggingface-cli download "$HF_REPO" "${MODEL_FILES[@]}" --local-dir "$MODELS_DIR" \
      || die "模型下载失败。可重跑 bash deploy.sh install 续传"
  fi
  ok "模型就绪：$MODELS_DIR"

  # 生成共享模型配置
  cat > "${SHARED}/extra_model_paths.yaml" <<EOF
# 由 deploy.sh 生成 —— ${#MODEL_FILES[@]} 个文件，8 实例共享一份权重（勿复制多份）
minimax_h3_shared:
  base_path: ${MODELS_DIR}
  diffusion_models: diffusion_models
  text_encoders: text_encoders
  vae: vae
  loras: loras
  embeddings: embeddings
  model_patches: model_patches
EOF
  ok "共享模型配置：${SHARED}/extra_model_paths.yaml"

  echo
  ok "===== 安装完成 ====="
  info "下一步：bash deploy.sh start"
  info "如需 R2V 模式，另下载（与 fl2va 二选一常驻）："
  echo "  HF_ENDPOINT=$HF_MIRROR hf download $HF_REPO \\"
  echo "    diffusion_models/minimax_h3_ref2va_pruned_int8_convrot.safetensors \\"
  echo "    loras/minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors \\"
  echo "    --local-dir $MODELS_DIR"
}

# =============================================================================
# start / stop / restart
# =============================================================================
start_one() {
  local i="$1"
  local cport=$((COMFY_BASE_PORT + i))
  local aport=$((API_BASE_PORT + i))
  local inst="${SHARED}/inst${i}"
  mkdir -p "${inst}/output" "${inst}/temp" "${inst}/user"

  # ComfyUI：端口已被占用（如 systemd 已在跑）则跳过启动，但【仍要继续起 API】
  if port_busy "$cport"; then
    info "GPU${i}: ComfyUI :${cport} 已在运行，跳过启动"
  else
    # CUDA_VISIBLE_DEVICES 让本进程只见第 i 张卡（进程内即 cuda:0）
    CUDA_VISIBLE_DEVICES="$i" HF_ENDPOINT="$HF_MIRROR" \
    nohup python "$COMFY_DIR/main.py" \
      --listen 127.0.0.1 \
      --port "$cport" \
      --extra-model-paths-config "${SHARED}/extra_model_paths.yaml" \
      --output-directory "${inst}/output" \
      --temp-directory  "${inst}/temp" \
      --user-directory  "${inst}/user" \
      --disable-auto-launch \
      > "${LOG_DIR}/comfy-gpu${i}.log" 2>&1 &
    echo $! > "${PID_DIR}/comfy-${i}.pid"
    info "GPU${i} → ComfyUI 127.0.0.1:${cport} (pid $(cat ${PID_DIR}/comfy-${i}.pid))"
  fi

  # 等 ComfyUI 就绪再起 API（最多 180s；冷启动加载 44G 模型较慢）
  local waited=0
  while ! port_busy "$cport" && [ "$waited" -lt 180 ]; do
    # 本脚本启动的进程若已退出就别干等（systemd 管理时无 pidfile，跳过此判断）
    if [ -f "${PID_DIR}/comfy-${i}.pid" ]; then
      kill -0 "$(cat ${PID_DIR}/comfy-${i}.pid)" 2>/dev/null \
        || { err "GPU${i}: ComfyUI 进程退出，见 ${LOG_DIR}/comfy-gpu${i}.log"; return 1; }
    fi
    sleep 3; waited=$((waited+3))
  done
  port_busy "$cport" || warn "GPU${i}: ComfyUI :${cport} 等待超时（180s），仍尝试起 API"

  # API：端口已占用则跳过
  if port_busy "$aport"; then
    info "GPU${i}: API :${aport} 已在运行，跳过启动"
    return 0
  fi
  nohup comfyui-api --comfyui-url "http://127.0.0.1:${cport}" --port "$aport" \
    > "${LOG_DIR}/api-gpu${i}.log" 2>&1 &
  echo $! > "${PID_DIR}/api-${i}.pid"
  info "GPU${i} → API      127.0.0.1:${aport} (pid $(cat ${PID_DIR}/api-${i}.pid))"
}

cmd_start() {
  ensure_dirs
  activate_env || die "无法激活 Python 环境，请先 bash deploy.sh install"
  local n; n="$(resolve_instances)"
  [ "$n" -lt 1 ] && die "可用实例数为 0（GPU 或内存不足），先跑 bash deploy.sh doctor"

  local gpus ram; gpus="$(detect_gpus)"; ram="$(detect_ram_gb)"
  info "启动 ${n} 个实例（GPU ${gpus} 张 / 内存 ${ram}G / 每实例预算 ${RAM_PER_INSTANCE}G）"
  [ "$n" -lt "$gpus" ] && warn "内存不足，只用 ${n}/${gpus} 张卡。加内存后可 INSTANCES=${gpus} bash deploy.sh start"

  for i in $(seq 0 $((n-1))); do
    start_one "$i" || warn "GPU${i} 启动异常，继续下一个"
  done

  # Nginx
  if [ "$NGINX_ENABLED" = "1" ]; then
    setup_nginx "$n"
  else
    info "跳过 Nginx（NGINX=0）。直连各实例 API：3000..$((API_BASE_PORT+n-1))"
  fi

  echo
  wait_ready "$n"
}

setup_nginx() {
  local n="$1"
  command -v nginx >/dev/null 2>&1 || { warn "未安装 nginx，跳过负载均衡。可直连 3000..$((API_BASE_PORT+n-1))"; return 0; }

  local conf="${SHARED}/nginx_minimax_h3.conf"
  {
    echo "# 由 deploy.sh 生成 —— ${n} 实例负载均衡"
    echo "upstream minimax_h3_api {"
    echo "    least_conn;   # 每实例 1 并发，派给最闲的"
    for i in $(seq 0 $((n-1))); do
      echo "    server 127.0.0.1:$((API_BASE_PORT+i)) max_fails=2 fail_timeout=15s;"
    done
    echo "    keepalive 32;"
    echo "}"
    cat <<'EOF'
server {
    listen 80;
    server_name _;
    client_max_body_size 512m;
    proxy_buffering off;
    proxy_request_buffering off;
    proxy_connect_timeout 30s;
    proxy_send_timeout    1800s;
    proxy_read_timeout    1800s;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    location / { proxy_pass http://minimax_h3_api; }
    location = /health { proxy_pass http://minimax_h3_api; access_log off; }
}
EOF
  } > "$conf"

  if [ -w /etc/nginx/conf.d/ ]; then
    cp "$conf" /etc/nginx/conf.d/minimax_h3.conf
    nginx -t >/dev/null 2>&1 && { nginx -s reload 2>/dev/null || systemctl reload nginx 2>/dev/null || nginx; ok "Nginx 已配置并重载（:80 → ${n} 实例）"; } \
      || warn "nginx -t 校验失败，请检查 /etc/nginx/conf.d/minimax_h3.conf"
  else
    warn "无权限写 /etc/nginx/conf.d（需 sudo）。配置已生成：$conf"
    warn "  手动执行：sudo cp $conf /etc/nginx/conf.d/ && sudo nginx -t && sudo systemctl reload nginx"
  fi
}

wait_ready() {
  local n="$1"
  info "等待实例就绪（首次冷启动加载 44G 模型需 1–5 分钟）..."
  local ready=0 waited=0
  while [ "$waited" -lt 600 ]; do
    ready=0
    for i in $(seq 0 $((n-1))); do
      curl -sf --max-time 5 "http://127.0.0.1:$((API_BASE_PORT+i))/health" >/dev/null 2>&1 && ready=$((ready+1))
    done
    printf '\r    就绪 %d/%d （已等 %ds）' "$ready" "$n" "$waited"
    [ "$ready" -ge "$n" ] && break
    sleep 10; waited=$((waited+10))
  done
  echo
  if [ "$ready" -ge "$n" ]; then
    ok "${ready}/${n} 实例就绪"
    [ "$NGINX_ENABLED" = "1" ] && info "统一入口：http://<server-ip>:${NGINX_PORT}/  （文档 /docs）"
    info "验证：bash deploy.sh test"
  else
    warn "仅 ${ready}/${n} 就绪。未就绪实例日志：${LOG_DIR}/comfy-gpu*.log"
    warn "常见原因：模型未下全、显存被占、内存不足被 OOM kill（dmesg | grep -i oom）"
  fi
}

cmd_stop() {
  ensure_dirs
  info "停止全部实例..."
  local stopped=0
  for f in "${PID_DIR}"/*.pid; do
    [ -e "$f" ] || continue
    local pid; pid="$(cat "$f")"
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null && stopped=$((stopped+1))
      # 给 10s 优雅退出，否则强杀
      for _ in $(seq 1 10); do kill -0 "$pid" 2>/dev/null || break; sleep 1; done
      kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null
    fi
    rm -f "$f"
  done
  ok "已停止 ${stopped} 个进程"
  # 兜底：清理残留（按端口匹配，避免误杀别人的 python）
  for i in $(seq 0 15); do
    for base in "$COMFY_BASE_PORT" "$API_BASE_PORT"; do
      local p=$((base+i))
      if port_busy "$p"; then
        local pid; pid="$(ss -lptn "sport = :$p" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | head -1)"
        [ -n "$pid" ] && { warn "端口 $p 仍被 pid $pid 占用，强杀"; kill -9 "$pid" 2>/dev/null; }
      fi
    done
  done
}

cmd_restart() { cmd_stop; sleep 3; cmd_start; }

# =============================================================================
# status / logs
# =============================================================================
cmd_status() {
  local n; n="$(resolve_instances)"
  c_cyn "========== 实例状态 =========="
  printf '%-6s %-10s %-10s %-10s %s\n' "GPU" "ComfyUI" "API" "PID" "健康"
  for i in $(seq 0 $((n-1))); do
    local cport=$((COMFY_BASE_PORT+i)) aport=$((API_BASE_PORT+i))
    local pid="-"; [ -f "${PID_DIR}/comfy-${i}.pid" ] && pid="$(cat ${PID_DIR}/comfy-${i}.pid)"
    local alive="dead"; kill -0 "$pid" 2>/dev/null && alive="alive"
    local c="-" a="-" h="-"
    port_busy "$cport" && c="up" || c="down"
    port_busy "$aport" && a="up" || a="down"
    curl -sf --max-time 3 "http://127.0.0.1:${aport}/health" >/dev/null 2>&1 && h="healthy" || h="-"
    printf '%-6s %-10s %-10s %-10s %s\n' "$i" "$c" "$a" "${pid}(${alive})" "$h"
  done
  echo
  c_cyn "========== GPU 占用 =========="
  nvidia-smi --query-gpu=index,name,memory.used,memory.total,utilization.gpu --format=csv 2>/dev/null \
    || warn "nvidia-smi 不可用"
  echo
  if [ "$NGINX_ENABLED" = "1" ]; then
    c_cyn "========== Nginx 入口 =========="
    curl -sf --max-time 5 "http://127.0.0.1:${NGINX_PORT}/health" >/dev/null 2>&1 \
      && ok "http://127.0.0.1:${NGINX_PORT}/health 正常" \
      || warn "Nginx 入口未响应（可能未装 nginx 或未 reload）"
  fi
}

cmd_logs() {
  local id="${1:-}"
  if [ -n "$id" ]; then
    tail -n 100 -f "${LOG_DIR}/comfy-gpu${id}.log"
  else
    info "全部实例日志（Ctrl-C 退出）："
    tail -n 20 -f "${LOG_DIR}"/comfy-gpu*.log
  fi
}

# =============================================================================
# test — 全链路验证
# =============================================================================
cmd_test() {
  ensure_dirs
  local n; n="$(resolve_instances)"
  c_cyn "========== 全链路验证 =========="

  # 1) 各实例健康
  local healthy=0
  for i in $(seq 0 $((n-1))); do
    if curl -sf --max-time 5 "http://127.0.0.1:$((API_BASE_PORT+i))/health" >/dev/null 2>&1; then
      healthy=$((healthy+1))
    else
      warn "实例 ${i}（API :$((API_BASE_PORT+i))）未就绪"
    fi
  done
  ok "健康实例：${healthy}/${n}"
  [ "$healthy" -eq 0 ] && die "无可用实例，先跑 bash deploy.sh status 排查"

  # 2) H3 节点是否内置（ComfyUI 版本 ≥0.30 才有）
  info "检查 MiniMax H3 节点是否可用..."
  local obj; obj="$(curl -sf --max-time 10 "http://127.0.0.1:${COMFY_BASE_PORT}/object_info" 2>/dev/null)"
  if [ -n "$obj" ]; then
    for node in MiniMaxH3ImageToVideo MiniMaxH3ReferenceToVideo MiniMaxH3SigmaShift VAEDecodeAudio; do
      echo "$obj" | grep -q "\"$node\"" && ok "    节点存在: $node" || err "    缺节点: $node（ComfyUI 版本过低？需 ≥0.30.0）"
    done
    # 模型文件是否被识别
    echo "$obj" | grep -q "minimax_h3_fl2va_pruned_int8_convrot" \
      && ok "    UNet 已识别: minimax_h3_fl2va_pruned_int8_convrot" \
      || warn "    未识别 UNet 文件，检查 extra_model_paths.yaml 与模型目录"
    echo "$obj" | grep -q "qwen3vl_32b_minimax_h3_nvfp4_awq" \
      && ok "    文本编码器已识别: qwen3vl_32b_minimax_h3_nvfp4_awq" \
      || warn "    未识别文本编码器文件"
  else
    warn "无法获取 /object_info（实例 0 未起？）"
  fi

  # 3) 真提交（需 API 格式工作流）
  echo
  info "查找 API 格式工作流以做真实提交测试..."
  local wf=""
  for cand in "$SHARED"/workflows/*api*.json "$SHARED"/workflows/*.json ./workflows/*api*.json ./workflows/*.json; do
    [ -f "$cand" ] && { wf="$cand"; break; }
  done
  if [ -z "$wf" ]; then
    warn "未找到工作流 JSON。headless 服务器无法拖拽导出，请："
    echo "  1) 在任意【有界面的机器】上打开 ComfyUI，加载 H3 turbo 工作流"
    echo "  2) 设置 → 开启 Dev mode → 菜单 'Save (API Format)' 导出"
    echo "  3) 拷到服务器 ${SHARED}/workflows/ 后重跑 bash deploy.sh test"
    echo
    ok "基础链路验证完成（${healthy}/${n} 实例健康）。真实出片测试待工作流就位"
    return 0
  fi

  ok "使用工作流：$wf"
  info "提交 480p 测试任务（同步，约 1 分钟；经 Nginx 走负载均衡）..."
  local base="http://127.0.0.1:$((API_BASE_PORT))"
  [ "$NGINX_ENABLED" = "1" ] && command -v nginx >/dev/null 2>&1 && base="http://127.0.0.1:${NGINX_PORT}"

  local out="${SHARED}/test_out.mp4"
  local t0=$SECONDS
  if python - "$base" "$wf" "$out" <<'PY'
import sys, json, base64, pathlib, requests
base, wf, out = sys.argv[1], sys.argv[2], sys.argv[3]
workflow = json.loads(pathlib.Path(wf).read_text(encoding="utf-8"))
r = requests.post(f"{base}/prompt", json={"prompt": workflow}, timeout=1800)
r.raise_for_status()
d = r.json()
imgs = d.get("images") or d.get("output", {}).get("images") or []
if not imgs:
    print("  返回体无 images 字段：", json.dumps(d)[:300]); sys.exit(2)
pathlib.Path(out).write_bytes(base64.b64decode(imgs[0]))
print(f"  写出 {out}")
PY
  then
    ok "出片成功（耗时 $((SECONDS-t0))s）：$out  ($(du -h "$out" | cut -f1))"
    info "拷回本地查看：scp <user>@<server>:$out ."
  else
    err "提交失败（耗时 $((SECONDS-t0))s）。查日志：bash deploy.sh logs 0"
    return 1
  fi
}

# =============================================================================
# 入口
# =============================================================================
usage() {
  sed -n '2,30p' "$0" | sed 's/^# \?//'
}

case "${1:-}" in
  doctor)  cmd_doctor ;;
  install) cmd_install ;;
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  restart) cmd_restart ;;
  status)  cmd_status ;;
  logs)    shift; cmd_logs "${1:-}" ;;
  test)    cmd_test ;;
  all)
    cmd_doctor || die "体检未通过，中止"
    echo; cmd_install || die "安装失败，中止"
    echo; cmd_start   || die "启动失败"
    echo; cmd_test    || warn "测试未完全通过，见上方输出"
    echo; ok "===== 一键部署流程结束 ====="
    ;;
  *) usage; exit 1 ;;
esac
