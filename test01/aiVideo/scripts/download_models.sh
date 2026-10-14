#!/usr/bin/env bash
# ============================================================================
# download_models.sh —— 从国内镜像下载 config/models.yaml 里的全部模型
# ModelScope 优先(国内CDN)，hf-mirror 兜底。带 429 重试。
#
# 用法：
#   bash scripts/download_models.sh              # 下载全部必需模型
#   bash scripts/download_models.sh --dry-run    # 只打印命令，不下载
#   bash scripts/download_models.sh --include-optional   # 连可选模型一起下
#   bash scripts/download_models.sh --only video # 只下某个子系统
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
MANIFEST="${REPO_DIR}/config/models.yaml"
MODEL_ROOT="${MODEL_ROOT:-/data/models}"
DRY_RUN=0
INCLUDE_OPTIONAL=0
ONLY=""

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift;;
    --include-optional) INCLUDE_OPTIONAL=1; shift;;
    --only) ONLY="$2"; shift 2;;
    *) echo "未知参数: $1"; exit 2;;
  esac
done

export HF_ENDPOINT="${HF_ENDPOINT:-https://hf-mirror.com}"
export HF_HUB_ENABLE_HF_TRANSFER="${HF_HUB_ENABLE_HF_TRANSFER:-1}"
export MODELSCOPE_CACHE="${MODELSCOPE_CACHE:-$MODEL_ROOT}"
[ "$DRY_RUN" = "1" ] || mkdir -p "$MODEL_ROOT"

# 用 Python 从 manifest 生成 "source<TAB>repo_id<TAB>local_dir" 任务列表
TASKS=$(python - "$MANIFEST" "$INCLUDE_OPTIONAL" "$ONLY" <<'PY'
import sys, yaml
manifest, inc_opt, only = sys.argv[1], sys.argv[2] == "1", sys.argv[3]
data = yaml.safe_load(open(manifest, encoding="utf-8"))
subsystems = ["llm", "image", "video", "tts", "asr", "music"]
for sub in subsystems:
    if only and only != sub:
        continue
    for m in data.get(sub, []) or []:
        if m.get("optional") and not inc_opt:
            continue
        src = m.get("source", "modelscope")
        repo = m.get("repo_id")
        # SenseVoice 双镜像：source 决定用哪个 id
        if src == "hf-mirror" and m.get("repo_id_hf") and "modelscope" not in (m.get("mirror_url") or ""):
            repo = m.get("repo_id_hf", repo)
        local = m.get("local_dir", repo.split("/")[-1])
        print(f"{src}\t{repo}\t{local}")
PY
)

echo "[download] MODEL_ROOT=$MODEL_ROOT  DRY_RUN=$DRY_RUN"
echo "[download] 任务数: $(echo "$TASKS" | grep -c . )"
echo

dl_modelscope() {
  local repo="$1" dest="$2"
  local attempt=1 max=5
  while [ $attempt -le $max ]; do
    if modelscope download --model "$repo" --local_dir "$dest"; then return 0; fi
    echo "[retry $attempt/$max] modelscope $repo 失败，10s 后重试..."; sleep 10; attempt=$((attempt+1))
  done
  echo "[ERROR] modelscope 下载失败: $repo"; return 1
}

dl_hf() {
  local repo="$1" dest="$2"
  local attempt=1 max=5
  while [ $attempt -le $max ]; do
    if huggingface-cli download "$repo" --local-dir "$dest"; then return 0; fi
    echo "[retry $attempt/$max] hf-mirror $repo 失败(可能429)，15s 后重试..."; sleep 15; attempt=$((attempt+1))
  done
  echo "[ERROR] hf-mirror 下载失败: $repo"; return 1
}

FAIL=0
while IFS=$'\t' read -r src repo local; do
  [ -z "$repo" ] && continue
  dest="${MODEL_ROOT}/${local}"
  echo "────────────────────────────────────────────────────────"
  echo "[$src] $repo  ->  $dest"
  if [ "$DRY_RUN" = "1" ]; then
    if [ "$src" = "modelscope" ]; then
      echo "  DRY: modelscope download --model $repo --local_dir $dest"
    else
      echo "  DRY: HF_ENDPOINT=$HF_ENDPOINT huggingface-cli download $repo --local-dir $dest"
    fi
    continue
  fi
  if [ "$src" = "modelscope" ]; then
    dl_modelscope "$repo" "$dest" || FAIL=$((FAIL+1))
  else
    dl_hf "$repo" "$dest" || FAIL=$((FAIL+1))
  fi
done <<< "$TASKS"

echo
if [ "$DRY_RUN" = "1" ]; then
  echo "[download] ✓ dry-run 完成（未实际下载）。去掉 --dry-run 即开始下载。"
  exit 0
fi
if [ "$FAIL" -gt 0 ]; then
  echo "[download] 完成，但有 $FAIL 个模型下载失败，请检查上方 [ERROR] 并重试。"
  exit 1
fi
echo "[download] ✓ 全部模型下载完成。磁盘占用："
du -sh "$MODEL_ROOT" 2>/dev/null || true
