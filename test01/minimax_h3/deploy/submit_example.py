#!/usr/bin/env python3
"""
MiniMax H3 — headless 批量提交示例（无可视化界面，纯 API 调用）

场景：服务器不能科学上网、无 GUI，无法用浏览器拖拽工作流。
做法：工作流 JSON 在【有界面的机器】上一次性导出好，拷到服务器，之后全靠 API 提交。

两种提交方式：
  A) 直连某个 ComfyUI 实例的原生 /prompt（走 ComfyUI 队列，需 API 格式 JSON）
  B) 经 comfyui-api 的 REST（本文件用这个，支持同步/异步 webhook）

依赖：pip install requests
"""
import json
import base64
import argparse
import pathlib
import requests

# Nginx 统一入口（负载均衡到 8 实例）；直连单实例则填 http://127.0.0.1:3000
API_BASE = "http://127.0.0.1:80"


def submit_sync(workflow_path: str, out_prefix: str = "out"):
    """同步提交：阻塞直到出片，直接返回 base64。适合 480p/720p 短任务。"""
    workflow = json.loads(pathlib.Path(workflow_path).read_text(encoding="utf-8"))

    # comfyui-api 的 /prompt 期望 {"prompt": <API格式工作流JSON>}
    # 注意：ComfyUI 前端格式与 API 格式不同——前端格式需先转 API 格式，
    # 见下方「关于工作流格式」说明。
    resp = requests.post(
        f"{API_BASE}/prompt",
        json={"prompt": workflow},
        timeout=1800,  # 同步可能几分钟
    )
    resp.raise_for_status()
    data = resp.json()

    # 返回体里 images 字段是 base64 编码的 MP4（含音轨）
    for i, b64 in enumerate(data.get("images", [])):
        out = pathlib.Path(f"{out_prefix}_{i}.mp4")
        out.write_bytes(base64.b64decode(b64))
        print(f"[ok] 写出 {out}  ({out.stat().st_size/1e6:.1f} MB)")
    return data


def submit_async(workflow_path: str, task_id: str, webhook_url: str):
    """异步提交：立即返回 202 + task_id，完成后服务端回调 webhook_url。
    适合 1080p/15s 长任务（同步会被网关 ~193s 超时切断）。"""
    workflow = json.loads(pathlib.Path(workflow_path).read_text(encoding="utf-8"))
    resp = requests.post(
        f"{API_BASE}/prompt",
        json={
            "prompt": workflow,
            "webhook_v2": {"url": webhook_url},   # 完成/失败回调你的接口
            "task_id": task_id,
        },
        timeout=30,
    )
    resp.raise_for_status()
    print(f"[accepted] {resp.status_code} {resp.json()}")
    print(f"  → 完成后 POST {webhook_url}（prompt.complete，含 base64 视频+音频）")
    print(f"  → 失败回调 prompt.failed；回调最多重试 3 次，接口请做幂等")
    return resp.json()


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("workflow", help="工作流 JSON 路径（API 格式）")
    p.add_argument("--mode", choices=["sync", "async"], default="sync")
    p.add_argument("--task-id", default="task-001")
    p.add_argument("--webhook", default="https://your-server.com/callback")
    p.add_argument("--out", default="out")
    args = p.parse_args()

    if args.mode == "sync":
        submit_sync(args.workflow, args.out)
    else:
        submit_async(args.workflow, args.task_id, args.webhook)


# ─────────────────────────────────────────────────────────────
# 关于工作流格式（headless 关键坑）：
#
# ComfyUI 有两种 JSON：
#   1) 前端格式（frontend / workflow）— 浏览器里拖出来的，含节点坐标、连线 UI 信息
#   2) API 格式（prompt）— 扁平的 {节点id: {class_type, inputs}} ，/prompt 接口只认这个
#
# 无 GUI 时怎么拿到 API 格式？三选一：
#   a) 在任意有界面的机器上打开 ComfyUI，加载工作流 →
#      设置里开启 "Dev mode" → 菜单出现 "Save (API Format)" → 导出 api.json，拷到服务器
#   b) ComfyUI 运行中调 GET /prompt 或从前端 "Export (API)" 按钮拿
#   c) 直接用本仓库 workflows/ 里预置的 API 格式 JSON（若有）
#
# 换 seed / 分辨率 / 帧数 / 提示词：在 Python 里改 workflow 字典对应节点的
# inputs 字段即可，无需 GUI。例如：
#   workflow["<采样节点id>"]["inputs"]["seed"] = 12345
#   workflow["<提示词节点id>"]["inputs"]["text"] = "你的提示词"
# ─────────────────────────────────────────────────────────────
