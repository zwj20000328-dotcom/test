"""LLM 引擎 —— 对接 vLLM 的 OpenAI 兼容端点（Qwen3-32B-AWQ，GPU0 常驻）。

要点（来自调研 + 对抗式核验）：
- vLLM 支持 guided decoding，用 response_format=json_schema 保证严格 JSON 输出。
  **只发一个 guided 通道**：早期版本同时发 response_format 和 extra_body.guided_json，
  两者可能冲突/被不同 vLLM 版本各自解释，故统一只走 response_format。
- Qwen3 抽取类调用要 enable_thinking=false，否则思考模式烧 token 且可能不返回纯 JSON。
- 长创作调用（一集正文）会撞 max_tokens，必须用 finish_reason=='length' 检测截断，
  否则把半截 JSON 当解析错误无限重试。
- 一个常驻实例 + 连续批处理，远好于每镜一个实例。

异常分层（调用方可据此区分"该重试"与"该报错退出"）：
  LLMError           基类
  ├ TruncationError  撞到 max_tokens，输出被截断（可续写或加大 max_tokens 重试）
  ├ RefusalError     模型拒答
  ├ EmptyResponseError  choices 为空
  ├ SchemaError      400/422，schema 本身不被接受（**不该重试**，改了也没用）
  └ TransportError   网络/连接问题（可重试）

本机无 vLLM 服务时构造/调用会抛 TransportError —— 请显式用 StubEngine 测试控制面。
"""
from __future__ import annotations

import copy
import json
import logging
import os
import re
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

log = logging.getLogger("engines.llm")


# --------------------------------------------------------------------------- #
# 异常分层
# --------------------------------------------------------------------------- #


class LLMError(RuntimeError):
    """LLM 调用错误基类。"""


class TruncationError(LLMError):
    """输出撞到 max_tokens 被截断。"""

    def __init__(self, partial: str, usage: Optional[dict] = None,
                 finish_reason: str = "length"):
        super().__init__(f"输出被截断（finish_reason={finish_reason}，已得 {len(partial)} 字符）")
        self.partial = partial
        self.usage = usage or {}
        self.finish_reason = finish_reason


class RefusalError(LLMError):
    """模型拒答。"""

    def __init__(self, refusal: Optional[str] = None):
        super().__init__(f"模型拒答：{(refusal or '')[:200]}")
        self.refusal = refusal


class EmptyResponseError(LLMError):
    """choices 为空（无内容返回）。"""

    def __init__(self, data: Optional[dict] = None):
        super().__init__("响应 choices 为空")
        self.data = data or {}


class SchemaError(LLMError):
    """HTTP 400/422：schema 不被服务端接受。**重试无用**，必须改 schema。"""

    def __init__(self, status: int, body: str):
        super().__init__(f"schema 被拒绝（HTTP {status}）：{body[:400]}")
        self.status = status
        self.body = body


class TransportError(LLMError):
    """网络/连接/超时问题，可重试。"""

    def __init__(self, exc: Exception):
        super().__init__(f"传输错误：{type(exc).__name__}: {exc}")
        self.exc = exc


# --------------------------------------------------------------------------- #
# 工具：剥代码围栏 / strict 化 schema
# --------------------------------------------------------------------------- #

_FENCE_RE = re.compile(r"^\s*```(?:json|JSON)?\s*\n?(.*?)\n?```\s*$", re.S)


def _unwrap(text: str) -> str:
    """剥掉模型可能包裹的 ```json ... ``` 代码围栏。

    vLLM 在 guided decoding 下通常返回裸 JSON，但某些 chat template 会加围栏，
    导致 json.loads 直接失败。这里统一剥离。
    """
    if not text:
        return text or ""
    s = text.strip()
    m = _FENCE_RE.match(s)
    if m:
        return m.group(1).strip()
    return s


def schema_is_strict_safe(schema: dict) -> bool:
    """判断 schema 是否已满足 OpenAI strict 模式要求。

    strict=True 要求：每个 object 节点 additionalProperties=False，且 properties
    里的**所有**键都在 required 中（不允许可选字段）。我们的创作类 schema 大量使用
    可选字段（如 music_tag.bpm），因此 strict 会 400。
    """
    def walk(node: Any) -> bool:
        if isinstance(node, dict):
            if node.get("type") == "object" or "properties" in node:
                if node.get("additionalProperties") is not False:
                    return False
                props = node.get("properties") or {}
                required = set(node.get("required") or [])
                if props and not set(props.keys()) <= required:
                    return False
            for v in node.values():
                if not walk(v):
                    return False
        elif isinstance(node, list):
            for v in node:
                if not walk(v):
                    return False
        return True

    return walk(schema)


def _strictify(schema: dict) -> dict:
    """把 schema 改造成 strict 模式可接受的形式：所有 object 节点补
    additionalProperties=False，并把全部 properties 加入 required。

    代价：可选字段变成必填，模型必须给值（可能给空串/默认值）。因此仅在
    schema 本身没有可选字段语义需求时才用；默认走 strict=False（loose）。
    """
    out = copy.deepcopy(schema)

    def walk(node: Any) -> Any:
        if isinstance(node, dict):
            if node.get("type") == "object" or "properties" in node:
                props = node.get("properties")
                if isinstance(props, dict):
                    node["additionalProperties"] = False
                    node["required"] = sorted(props.keys())
            for k, v in list(node.items()):
                node[k] = walk(v)
        elif isinstance(node, list):
            return [walk(v) for v in node]
        return node

    return walk(out)


def _extract_content(data: dict) -> tuple[str, Optional[str], Optional[str], dict]:
    """从 OpenAI 兼容响应里取 (content, finish_reason, refusal, usage)。

    缺失/异常结构一律抛对应类型化异常，不让调用方去猜 KeyError。
    """
    choices = data.get("choices") or []
    if not choices:
        raise EmptyResponseError(data)
    ch = choices[0] or {}
    msg = ch.get("message") or {}
    content = msg.get("content")
    refusal = msg.get("refusal")
    finish = ch.get("finish_reason")
    usage = data.get("usage") or {}
    if refusal:
        raise RefusalError(refusal)
    if content is None:
        raise EmptyResponseError(data)
    return content, finish, refusal, usage


# --------------------------------------------------------------------------- #
# 引擎
# --------------------------------------------------------------------------- #


@dataclass
class VLLMEngine:
    """OpenAI 兼容 chat completions 客户端（requests 实现，无 openai 依赖）。"""
    base_url: str = field(default_factory=lambda: os.environ.get(
        "AIVIDEO_LLM_BASE_URL") or os.environ.get("LLM_BASE_URL", "http://localhost:8000/v1"))
    model: str = "qwen3-32b"
    connect_timeout: float = 10.0
    read_timeout: float = 600.0        # 长创作调用需要几分钟
    max_tokens_cap: int = 30000        # 防止调用方给出超过模型上下文的值

    # ---- 底层 POST ----
    def _post(self, payload: dict, *, timeout: Optional[float] = None) -> dict:
        import requests  # 延迟导入
        url = self.base_url.rstrip("/") + "/chat/completions"
        # (connect, read) 元组超时：连接要快，读取要慢（生成耗时长）
        tmo = (self.connect_timeout, timeout or self.read_timeout)
        try:
            resp = requests.post(url, json=payload, timeout=tmo)
        except Exception as e:  # noqa: BLE001
            raise TransportError(e) from e
        if resp.status_code in (400, 422):
            # schema/参数被拒：重试无用
            raise SchemaError(resp.status_code, resp.text)
        if resp.status_code >= 500 or resp.status_code == 429:
            raise TransportError(RuntimeError(f"HTTP {resp.status_code}: {resp.text[:200]}"))
        try:
            resp.raise_for_status()
        except Exception as e:  # noqa: BLE001
            raise TransportError(e) from e
        return resp.json()

    def _cap(self, max_tokens: int) -> int:
        return max(1, min(int(max_tokens), self.max_tokens_cap))

    # ---- 对话 ----
    def chat(
        self,
        messages: list[dict],
        *,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        top_p: float = 0.95,
        presence_penalty: float = 0.0,
        frequency_penalty: float = 0.0,
        stop: Optional[list[str]] = None,
        think: bool = False,
        no_think: Optional[bool] = None,     # 兼容旧调用方：no_think=True 等价 think=False
        timeout: Optional[float] = None,
        model: Optional[str] = None,
        return_meta: bool = False,
        **extra: Any,
    ) -> Any:
        """普通对话，返回文本。

        think=False（默认）关闭 Qwen3 思考模式，保证输出纯正文/纯 JSON。
        return_meta=True 时返回 (content, finish_reason, usage)。
        """
        if no_think is not None:
            think = not no_think
        payload: dict[str, Any] = {
            "model": model or self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": self._cap(max_tokens),
            "top_p": top_p,
            "presence_penalty": presence_penalty,
            "frequency_penalty": frequency_penalty,
            **extra,
        }
        if stop:
            payload["stop"] = stop
        payload.setdefault("chat_template_kwargs", {})["enable_thinking"] = bool(think)

        data = self._post(payload, timeout=timeout)
        content, finish, _refusal, usage = _extract_content(data)
        text = _unwrap(content)
        if finish == "length":
            raise TruncationError(text, usage, finish)
        if return_meta:
            return text, finish, usage
        return text

    # ---- 结构化输出 ----
    def json(
        self,
        messages: list[dict],
        schema: dict,
        *,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        top_p: float = 0.8,
        presence_penalty: float = 0.0,
        frequency_penalty: float = 0.0,
        think: bool = False,
        no_think: Optional[bool] = None,     # 兼容旧调用方
        retries: int = 2,
        timeout: Optional[float] = None,
        model: Optional[str] = None,
        strict: str | bool = "auto",
    ) -> dict:
        """结构化输出：guided decoding 强制 schema，解析失败则回灌错误重试。

        strict: True/False 强制指定；"auto" 时检测 schema 是否已满足 strict 规则，
        不满足则用 loose（strict=False）——因为 strict 模式不允许任何可选字段，
        而创作类 schema 大量使用可选字段。

        重试策略（区分错误类型）：
          SchemaError    -> 立即抛（改 schema 才有用，重试浪费）
          TruncationError-> 立即抛（调用方应加大 max_tokens 或改分块粒度）
          TransportError -> 重试（网络抖动）
          JSON 解析错误   -> 回灌错误信息重试
        """
        if no_think is not None:
            think = not no_think

        if strict is True:
            prepared, strict_flag = _strictify(schema), True
        elif strict is False:
            prepared, strict_flag = schema, False
        else:  # "auto"
            if schema_is_strict_safe(schema):
                prepared, strict_flag = schema, True
            else:
                prepared, strict_flag = schema, False

        base_payload: dict[str, Any] = {
            "model": model or self.model,
            "temperature": temperature,
            "max_tokens": self._cap(max_tokens),
            "top_p": top_p,
            "presence_penalty": presence_penalty,
            "frequency_penalty": frequency_penalty,
            # 单一 guided 通道（不同时发 extra_body.guided_json，避免冲突）
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": "output", "schema": prepared, "strict": strict_flag},
            },
        }
        base_payload.setdefault("chat_template_kwargs", {})["enable_thinking"] = bool(think)

        cur_messages = list(messages)
        last_err: Optional[Exception] = None

        for attempt in range(retries + 1):
            payload = dict(base_payload)
            payload["messages"] = cur_messages
            assistant_content: Optional[str] = None      # 每轮重置，避免引用上轮残值
            finish: Optional[str] = None
            try:
                data = self._post(payload, timeout=timeout)
                assistant_content, finish, _refusal, _usage = _extract_content(data)
                if finish == "length":
                    # 截断的 JSON 永远解析不出来，重试同样会截断 -> 直接抛给调用方
                    raise TruncationError(_unwrap(assistant_content), _usage, finish)
                obj = json.loads(_unwrap(assistant_content))
                if not isinstance(obj, dict):
                    raise ValueError(f"期望 JSON object，实得 {type(obj).__name__}")
                return obj
            except (SchemaError, TruncationError, RefusalError):
                raise                                  # 重试无用，立即上抛
            except TransportError as e:
                last_err = e
                log.warning("LLM json 传输错误（第 %d/%d 次）：%s", attempt + 1, retries + 1, e)
                if attempt >= retries:
                    # 保留原始类型：调用方据此区分"服务/网络问题"与"schema/内容问题"
                    raise
                continue                               # 网络问题：原样重试，不回灌
            except (json.JSONDecodeError, ValueError, EmptyResponseError) as e:
                last_err = e
                log.warning("LLM json 解析失败（第 %d/%d 次）：%s", attempt + 1, retries + 1, e)
                if attempt >= retries:
                    break
                # 回灌：把模型的错误输出与具体报错一起给回去
                cur_messages = list(messages) + [
                    {"role": "assistant", "content": assistant_content or ""},
                    {"role": "user", "content": (
                        f"你上次的输出无法解析为 JSON（{type(e).__name__}: {e}）。\n"
                        "请只输出一个严格符合 schema 的 JSON 对象，不要任何解释文字、"
                        "不要代码围栏、不要截断。")},
                ]

        raise LLMError(f"LLM 结构化输出连续失败（{retries + 1} 次）：{last_err}")

    # ---- 健康检查 ----
    def health(self) -> bool:
        import requests
        try:
            r = requests.get(self.base_url.rstrip("/") + "/models",
                             timeout=(self.connect_timeout, 15))
            return r.status_code == 200
        except Exception:  # noqa: BLE001
            return False
