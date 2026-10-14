"""LLM 引擎 —— 对接 vLLM 的 OpenAI 兼容端点（Qwen3-32B-AWQ，GPU0 常驻）。

要点（来自调研）：
- vLLM 0.31 支持 guided_json（xgrammar/outlines 后端），传 response_format 或 extra_body
  保证严格 JSON 输出，S2 分镜靠它。
- Qwen3 抽取类调用要 enable_thinking=false（`/no_think`），否则思考模式烧 token 且可能不返回纯 JSON。
- 一个常驻实例 + 连续批处理，远好于每镜一个实例。

本机无 vLLM 服务时，构造/调用会抛错——请显式用 StubEngine 测试控制面。
"""
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from typing import Any, Optional

log = logging.getLogger("engines.llm")


@dataclass
class VLLMEngine:
    """OpenAI 兼容 chat completions 客户端（requests 实现，无 openai 依赖）。"""
    base_url: str = field(default_factory=lambda: os.environ.get("LLM_BASE_URL", "http://localhost:8000/v1"))
    model: str = "qwen3-32b"
    timeout: int = 300

    def _post(self, payload: dict) -> dict:
        import requests  # 延迟导入
        url = self.base_url.rstrip("/") + "/chat/completions"
        resp = requests.post(url, json=payload, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    def chat(
        self,
        messages: list[dict],
        temperature: float = 0.3,
        max_tokens: int = 2048,
        no_think: bool = True,
        **extra,
    ) -> str:
        """普通对话，返回文本。no_think=True 时对 Qwen3 关闭思考模式。"""
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            **extra,
        }
        if no_think:
            # vLLM 的 chat template kwargs（Qwen3 enable_thinking 开关）
            payload.setdefault("chat_template_kwargs", {})["enable_thinking"] = False
        data = self._post(payload)
        return data["choices"][0]["message"]["content"]

    def json(
        self,
        messages: list[dict],
        schema: dict,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        no_think: bool = True,
        retries: int = 2,
    ) -> dict:
        """结构化输出：用 vLLM guided_json 强制 schema，失败则回灌重试。"""
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            # vLLM guided decoding（OpenAI 兼容层）：response_format=json_schema
            "response_format": {"type": "json_schema",
                                "json_schema": {"name": "output", "schema": schema, "strict": True}},
            "extra_body": {"guided_json": schema},
        }
        if no_think:
            payload.setdefault("chat_template_kwargs", {})["enable_thinking"] = False

        last_err = None
        for attempt in range(retries + 1):
            try:
                data = self._post(payload)
                content = data["choices"][0]["message"]["content"]
                obj = json.loads(content)
                return obj
            except Exception as e:  # noqa: BLE001
                last_err = e
                log.warning("LLM json 第 %d 次失败：%s；回灌 schema 重试", attempt + 1, e)
                # 把错误回灌，提示模型只输出合法 JSON
                payload["messages"] = messages + [
                    {"role": "assistant", "content": (content if 'content' in dir() else "")},
                    {"role": "user", "content": f"上次输出不是合法 JSON（{e}）。"
                                                f"严格输出符合 schema 的 JSON，不要任何解释文字。"},
                ]
        raise RuntimeError(f"LLM 结构化输出连续失败：{last_err}")

    def health(self) -> bool:
        import requests
        try:
            r = requests.get(self.base_url.rstrip("/") + "/models", timeout=10)
            return r.status_code == 200
        except Exception:
            return False
