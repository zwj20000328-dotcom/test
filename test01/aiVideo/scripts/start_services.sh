#!/usr/bin/env bash
# ============================================================================
# start_services.sh —— 在 8×A800 服务器上启动整套服务（vLLM + Redis + Celery workers）
#
# GPU 分配（见 docs/ARCHITECTURE.md §3）：
#   GPU0        : vLLM Qwen3-32B-AWQ（常驻，控制面 LLM）
#   GPU1,2      : 关键帧 worker（Qwen-Image-2.1 / Edit-2511）
#   GPU3-4,5-6  : 终渲 worker（Wan2.2-I2V-A14B，2卡/job）
#   GPU7        : 音频 worker（CosyVoice2 / Paraformer / ACE-Step）
#   CPU         : 装配 worker（ffmpeg）
#
# 用法：
#   bash scripts/start_services.sh            # 全部启动（后台，日志到 logs/）
#   bash scripts/start_services.sh --stop     # 停止全部
#   bash scripts/start_services.sh --status   # 查看状态
#   QUALITY_MODE=throughput bash scripts/start_services.sh   # 吞吐档(GGUF 单卡7路)
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="${REPO_DIR}/logs"
PID_DIR="${REPO_DIR}/.pids"
mkdir -p "$LOG_DIR" "$PID_DIR"

MODEL_ROOT="${MODEL_ROOT:-/data/models}"
ENV_NAME="${ENV_NAME:-drama}"
REDIS_URL="${REDIS_URL:-redis://localhost:6379/0}"
QUALITY_MODE="${QUALITY_MODE:-quality}"    # quality | throughput
VLLM_PORT="${VLLM_PORT:-8000}"
VLLM_MODEL="${VLLM_MODEL:-${MODEL_ROOT}/Qwen3-32B-AWQ}"

log(){ echo -e "\033[1;36m[services] $*\033[0m"; }

# ---- 停止 ----
stop_all(){
  log "停止所有服务..."
  for pidfile in "$PID_DIR"/*.pid; do
    [ -e "$pidfile" ] || continue
    pid=$(cat "$pidfile")
    name=$(basename "$pidfile" .pid)
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null && log "  stopped $name (pid $pid)"
    else
      log "  $name 已不在运行 (stale pid $pid)"
    fi
    rm -f "$pidfile"
  done
  log "已停止。"
}

# ---- 状态 ----
status_all(){
  echo "=== 服务状态 ==="
  for pidfile in "$PID_DIR"/*.pid; do
    [ -e "$pidfile" ] || { echo "  (无 pid 文件)"; break; }
    pid=$(cat "$pidfile"); name=$(basename "$pidfile" .pid)
    if kill -0 "$pid" 2>/dev/null; then echo "  ✓ $name (pid $pid) RUNNING"; else echo "  ✗ $name (pid $pid) DEAD"; fi
  done
  command -v redis-cli >/dev/null && redis-cli -u "$REDIS_URL" ping 2>/dev/null | sed 's/^/  redis: /' || true
  command -v nvidia-smi >/dev/null && nvidia-smi --query-gpu=index,memory.used,memory.total,utilization.gpu --format=csv,noheader || true
}

case "${1:-}" in
  --stop) stop_all; exit 0;;
  --status) status_all; exit 0;;
esac

# ---- 激活 conda ----
# shellcheck disable=SC1091
source "$(conda info --base)/etc/profile.d/conda.sh"
conda activate "$ENV_NAME"
export HF_ENDPOINT="${HF_ENDPOINT:-https://hf-mirror.com}"
export MODELSCOPE_CACHE="${MODELSCOPE_CACHE:-$MODEL_ROOT}"

# ---- 引擎工厂配置（pipeline/engines/factory.py 读这些；run.py 与 Celery worker 共用）----
# 注意：不需要在这里设 AIVIDEO_*_DEVICE。各 worker 已用 CUDA_VISIBLE_DEVICES 钉绑物理卡，
# 工厂会把默认的 cuda:1/cuda:3,cuda:4/cuda:7 自动重映射为进程内的 cuda:0/... （见
# factory.normalize_device 与 tests/test_engine_factory.py 的重映射测试）。
export AIVIDEO_MODEL_ROOT="${AIVIDEO_MODEL_ROOT:-$MODEL_ROOT}"
export AIVIDEO_LLM_BASE_URL="${AIVIDEO_LLM_BASE_URL:-http://localhost:${VLLM_PORT}/v1}"
export AIVIDEO_LLM_MODEL="${AIVIDEO_LLM_MODEL:-qwen3-32b}"
export AIVIDEO_VIDEO_MODE="${AIVIDEO_VIDEO_MODE:-final}"          # final | preview | perform
export AIVIDEO_BGM_LIBRARY="${AIVIDEO_BGM_LIBRARY:-}"             # 可选：本地版权曲库目录

# ---- 1) Redis（Celery broker/backend）----
if ! command -v redis-server >/dev/null 2>&1; then
  log "未找到 redis-server，尝试 conda 安装..."
  conda install -c conda-forge redis-server -y
fi
if ! redis-cli -u "$REDIS_URL" ping >/dev/null 2>&1; then
  log "启动 redis-server..."
  nohup redis-server --port 6379 --daemonize no > "$LOG_DIR/redis.log" 2>&1 &
  echo $! > "$PID_DIR/redis.pid"
  sleep 3
fi
log "✓ redis: $(redis-cli -u "$REDIS_URL" ping 2>/dev/null || echo '未响应')"

# ---- 2) vLLM 常驻 GPU0（Qwen3-32B-AWQ）----
if [ ! -f "$PID_DIR/vllm.pid" ] || ! kill -0 "$(cat "$PID_DIR/vllm.pid")" 2>/dev/null; then
  log "启动 vLLM (GPU0) <- ${VLLM_MODEL}"
  CUDA_VISIBLE_DEVICES=0 nohup python -m vllm.entrypoints.openai.api_server \
    --model "$VLLM_MODEL" \
    --served-model-name qwen3-32b \
    --quantization awq_marlin \
    --max-model-len 32768 \
    --gpu-memory-utilization 0.90 \
    --port "$VLLM_PORT" \
    --trust-remote-code \
    > "$LOG_DIR/vllm.log" 2>&1 &
  echo $! > "$PID_DIR/vllm.pid"
  log "  vLLM pid $(cat "$PID_DIR/vllm.pid")，等待就绪（看 $LOG_DIR/vllm.log）..."
else
  log "vLLM 已在运行 (pid $(cat "$PID_DIR/vllm.pid"))"
fi
export LLM_BASE_URL="http://localhost:${VLLM_PORT}/v1"

# ---- 3) Celery workers（每物理 GPU 一个，--concurrency=1，钉死 CUDA_VISIBLE_DEVICES）----
# 队列->GPU 映射见 ARCHITECTURE §3。任务在独立子进程跑，结束即退释放显存。
start_worker(){
  local name="$1" queues="$2" gpus="$3" concurrency="${4:-1}"
  local pidfile="$PID_DIR/worker_${name}.pid"
  if [ -f "$pidfile" ] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    log "  worker $name 已运行 (pid $(cat "$pidfile"))"; return
  fi
  log "启动 worker '$name'  队列=[$queues]  GPU=[$gpus]  concurrency=$concurrency"
  CUDA_VISIBLE_DEVICES="$gpus" nohup celery -A pipeline.tasks worker \
    --queues="$queues" --concurrency="$concurrency" \
    --loglevel=INFO -n "${name}@%h" \
    > "$LOG_DIR/worker_${name}.log" 2>&1 &
  echo $! > "$pidfile"
}

if [ "$QUALITY_MODE" = "quality" ]; then
  # 质量档：GPU3-4 / GPU5-6 各一个 2 卡 Wan2.2-I2V-A14B job
  start_worker keyframe_a "keyframe" "1" 1
  start_worker keyframe_b "keyframe" "2" 1
  start_worker video_a    "video"    "3,4" 1
  start_worker video_b    "video"    "5,6" 1
else
  # 吞吐档：GPU1-7 全转视频，每卡一个 GGUF Q6 单卡 worker（7 路并行）
  for g in 1 2 3 4 5 6 7; do
    start_worker "video_gguf_$g" "video" "$g" 1
  done
fi
# 音频 worker（GPU7 共卡分时；质量档 GPU7 空闲给音频，吞吐档音频与视频错峰）
start_worker audio "tts,asr,music" "7" 1
# 装配 worker（CPU，与 GPU 推理重叠）
start_worker assembly "assembly,subtitle" "" 4

log
log "✓ 服务已启动。日志：$LOG_DIR/  PID：$PID_DIR/"
log "  状态：bash scripts/start_services.sh --status"
log "  停止：bash scripts/start_services.sh --stop"
log "  出片：python run.py <剧本.md> --project <名称>"
