"""LLM 引擎测试 —— 用 mock requests 验证 payload 结构与类型化异常。

锁定 llm.py 重写后的关键契约（对接真实 vLLM 前的安全网）：
  - 剥代码围栏（```json ... ```）
  - 单一 guided 通道（只发 response_format，不发冲突的 extra_body.guided_json）
  - strict=auto 自动检测：有可选字段走 loose，避免 400
  - finish_reason=='length' -> TruncationError（不把截断当解析错误无限重试）
  - HTTP 400/422 -> SchemaError 且不重试
  - 空 choices -> EmptyResponseError
  - 解析失败 -> 回灌 assistant+user 修复消息重试，且不无限累积
  - enable_thinking 受 think/no_think 控制
  - timeout 是 (connect, read) 元组
"""
from __future__ import annotations

import pytest
import requests

from pipeline.engines import llm as L
from pipeline.engines.llm import (
    EmptyResponseError, LLMError, RefusalError, SchemaError, TruncationError,
    TransportError, VLLMEngine, _strictify, _unwrap, schema_is_strict_safe,
)


# --------------------------------------------------------------------------- #
# mock requests
# --------------------------------------------------------------------------- #


class FakeResp:
    def __init__(self, status, payload=None, text=""):
        self.status_code = status
        self._p = payload or {}
        self.text = text

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"HTTP {self.status_code}")

    def json(self):
        return self._p


def _ok(content, finish="stop", refusal=None):
    return {"choices": [{"message": {"content": content, "refusal": refusal},
                         "finish_reason": finish}],
            "usage": {"total_tokens": 10}}


@pytest.fixture()
def engine():
    return VLLMEngine(base_url="http://localhost:8000/v1", model="qwen3-32b")


def _install_post(monkeypatch, handler):
    """把 requests.post 换成 handler，并记录每次 payload。"""
    seen = []

    def post(url, json=None, timeout=None):
        seen.append({"url": url, "payload": json, "timeout": timeout})
        return handler(json, seen)

    monkeypatch.setattr(requests, "post", post)
    return seen


_SCHEMA_STRICT = {"type": "object", "additionalProperties": False,
                  "properties": {"x": {"type": "integer"}}, "required": ["x"]}
_SCHEMA_LOOSE = {"type": "object",
                 "properties": {"a": {"type": "string"}, "b": {"type": "integer"}},
                 "required": ["a"]}


# --------------------------------------------------------------------------- #
# _unwrap / strict 工具
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize("raw,expect", [
    ('{"a":1}', '{"a":1}'),
    ('```json\n{"a":1}\n```', '{"a":1}'),
    ('```\n{"a":1}\n```', '{"a":1}'),
    ('  \n{"a":1}\n  ', '{"a":1}'),
    ('```JSON\n{"a":1}\n```', '{"a":1}'),
])
def test_unwrap(raw, expect):
    assert _unwrap(raw) == expect


def test_unwrap_empty():
    assert _unwrap("") == ""
    assert _unwrap(None) == ""


def test_strict_safe_detection():
    assert schema_is_strict_safe(_SCHEMA_STRICT) is True
    assert schema_is_strict_safe(_SCHEMA_LOOSE) is False   # b 是可选字段
    nested = {"type": "object", "additionalProperties": False,
              "properties": {"x": _SCHEMA_LOOSE}, "required": ["x"]}
    assert schema_is_strict_safe(nested) is False           # 嵌套里有可选字段


def test_strictify_fills_required_and_additional():
    s = _strictify(_SCHEMA_LOOSE)
    assert s["additionalProperties"] is False
    assert set(s["required"]) == {"a", "b"}
    # 不改原 schema
    assert "additionalProperties" not in _SCHEMA_LOOSE


# --------------------------------------------------------------------------- #
# chat
# --------------------------------------------------------------------------- #


def test_chat_returns_unwrapped_text(engine, monkeypatch):
    _install_post(monkeypatch, lambda j, s: FakeResp(200, _ok('```json\n{"a":1}\n```')))
    assert engine.chat([{"role": "user", "content": "hi"}]) == '{"a":1}'


def test_chat_thinking_default_off(engine, monkeypatch):
    seen = _install_post(monkeypatch, lambda j, s: FakeResp(200, _ok("x")))
    engine.chat([{"role": "user", "content": "hi"}])
    assert seen[0]["payload"]["chat_template_kwargs"]["enable_thinking"] is False


def test_chat_think_on(engine, monkeypatch):
    seen = _install_post(monkeypatch, lambda j, s: FakeResp(200, _ok("x")))
    engine.chat([{"role": "user", "content": "hi"}], think=True)
    assert seen[0]["payload"]["chat_template_kwargs"]["enable_thinking"] is True


def test_chat_no_think_compat(engine, monkeypatch):
    """旧调用方用 no_think=True，等价于 think=False。"""
    seen = _install_post(monkeypatch, lambda j, s: FakeResp(200, _ok("x")))
    engine.chat([{"role": "user", "content": "hi"}], no_think=True)
    assert seen[0]["payload"]["chat_template_kwargs"]["enable_thinking"] is False
    engine.chat([{"role": "user", "content": "hi"}], no_think=False)
    assert seen[1]["payload"]["chat_template_kwargs"]["enable_thinking"] is True


def test_chat_timeout_is_tuple(engine, monkeypatch):
    seen = _install_post(monkeypatch, lambda j, s: FakeResp(200, _ok("x")))
    engine.chat([{"role": "user", "content": "hi"}])
    assert isinstance(seen[0]["timeout"], tuple)
    assert seen[0]["timeout"] == (engine.connect_timeout, engine.read_timeout)


def test_chat_truncation_raises(engine, monkeypatch):
    _install_post(monkeypatch, lambda j, s: FakeResp(200, _ok("半截", finish="length")))
    with pytest.raises(TruncationError):
        engine.chat([{"role": "user", "content": "hi"}], max_tokens=10)


def test_chat_max_tokens_capped(engine, monkeypatch):
    seen = _install_post(monkeypatch, lambda j, s: FakeResp(200, _ok("x")))
    engine.chat([{"role": "user", "content": "hi"}], max_tokens=999999)
    assert seen[0]["payload"]["max_tokens"] == engine.max_tokens_cap


def test_chat_refusal(engine, monkeypatch):
    _install_post(monkeypatch, lambda j, s: FakeResp(200, _ok("", refusal="我不能")))
    with pytest.raises(RefusalError):
        engine.chat([{"role": "user", "content": "hi"}])


def test_chat_empty_choices(engine, monkeypatch):
    _install_post(monkeypatch, lambda j, s: FakeResp(200, {"choices": []}))
    with pytest.raises(EmptyResponseError):
        engine.chat([{"role": "user", "content": "hi"}])


# --------------------------------------------------------------------------- #
# json：payload 结构
# --------------------------------------------------------------------------- #


def test_json_single_guided_channel(engine, monkeypatch):
    """只发 response_format，不发冲突的 extra_body.guided_json。"""
    seen = _install_post(monkeypatch, lambda j, s: FakeResp(200, _ok('{"x":5}')))
    engine.json([{"role": "user", "content": "q"}], _SCHEMA_STRICT)
    p = seen[0]["payload"]
    assert "response_format" in p
    assert "extra_body" not in p, "不应同时发 extra_body（会与 response_format 冲突）"
    assert p["response_format"]["type"] == "json_schema"
    assert p["response_format"]["json_schema"]["name"] == "output"


def test_json_strict_auto_loose_for_optional_fields(engine, monkeypatch):
    """有可选字段的 schema 自动走 strict=False，避免 400。"""
    seen = _install_post(monkeypatch, lambda j, s: FakeResp(200, _ok('{"a":"x"}')))
    engine.json([{"role": "user", "content": "q"}], _SCHEMA_LOOSE)
    assert seen[0]["payload"]["response_format"]["json_schema"]["strict"] is False


def test_json_strict_auto_true_for_strict_safe(engine, monkeypatch):
    seen = _install_post(monkeypatch, lambda j, s: FakeResp(200, _ok('{"x":1}')))
    engine.json([{"role": "user", "content": "q"}], _SCHEMA_STRICT)
    assert seen[0]["payload"]["response_format"]["json_schema"]["strict"] is True


def test_json_strict_forced_true_strictifies(engine, monkeypatch):
    seen = _install_post(monkeypatch, lambda j, s: FakeResp(200, _ok('{"a":"x","b":1}')))
    engine.json([{"role": "user", "content": "q"}], _SCHEMA_LOOSE, strict=True)
    js = seen[0]["payload"]["response_format"]["json_schema"]
    assert js["strict"] is True
    assert js["schema"]["additionalProperties"] is False
    assert set(js["schema"]["required"]) == {"a", "b"}


def test_json_returns_parsed_dict(engine, monkeypatch):
    _install_post(monkeypatch, lambda j, s: FakeResp(200, _ok('{"x":5}')))
    assert engine.json([{"role": "user", "content": "q"}], _SCHEMA_STRICT) == {"x": 5}


def test_json_strips_fence_before_parse(engine, monkeypatch):
    _install_post(monkeypatch, lambda j, s: FakeResp(200, _ok('```json\n{"x":5}\n```')))
    assert engine.json([{"role": "user", "content": "q"}], _SCHEMA_STRICT) == {"x": 5}


# --------------------------------------------------------------------------- #
# json：异常与重试
# --------------------------------------------------------------------------- #


def test_json_truncation_raises_no_retry(engine, monkeypatch):
    """截断不该被当解析错误无限重试——直接抛给调用方。"""
    seen = _install_post(monkeypatch, lambda j, s: FakeResp(200, _ok('{"x":', finish="length")))
    with pytest.raises(TruncationError):
        engine.json([{"role": "user", "content": "q"}], _SCHEMA_STRICT, retries=3)
    assert len(seen) == 1, "截断不应重试"


def test_json_schema_error_400_no_retry(engine, monkeypatch):
    seen = _install_post(monkeypatch, lambda j, s: FakeResp(400, text="bad schema"))
    with pytest.raises(SchemaError):
        engine.json([{"role": "user", "content": "q"}], _SCHEMA_STRICT, retries=3)
    assert len(seen) == 1, "SchemaError 重试无用，只应调一次"


def test_json_schema_error_422_no_retry(engine, monkeypatch):
    seen = _install_post(monkeypatch, lambda j, s: FakeResp(422, text="invalid"))
    with pytest.raises(SchemaError):
        engine.json([{"role": "user", "content": "q"}], _SCHEMA_STRICT)
    assert len(seen) == 1


def test_json_transport_error_retries(engine, monkeypatch):
    """5xx/网络错误应重试。"""
    seen = _install_post(monkeypatch, lambda j, s: FakeResp(503, text="overloaded"))
    with pytest.raises(TransportError):
        engine.json([{"role": "user", "content": "q"}], _SCHEMA_STRICT, retries=2)
    assert len(seen) == 3   # 1 + 2 重试


def test_json_parse_error_retries_with_feedback(engine, monkeypatch):
    """解析失败：回灌 assistant+user 修复消息，且不无限累积。"""
    seen = _install_post(monkeypatch, lambda j, s: FakeResp(200, _ok("not json")))
    with pytest.raises(LLMError):
        engine.json([{"role": "user", "content": "q"}], _SCHEMA_STRICT, retries=2)
    assert len(seen) == 3
    roles = [[m["role"] for m in c["payload"]["messages"]] for c in seen]
    assert roles[0] == ["user"]
    assert roles[1] == ["user", "assistant", "user"]
    assert roles[2] == ["user", "assistant", "user"]   # 每轮从原始重建，不累积到 5 条


def test_json_recovery_on_second_attempt(engine, monkeypatch):
    """第一次坏 JSON，第二次好 -> 成功返回。"""
    state = {"n": 0}

    def handler(j, s):
        state["n"] += 1
        return FakeResp(200, _ok("bad" if state["n"] == 1 else '{"x":7}'))

    _install_post(monkeypatch, handler)
    assert engine.json([{"role": "user", "content": "q"}], _SCHEMA_STRICT, retries=2) == {"x": 7}
    assert state["n"] == 2


def test_json_rejects_non_object(engine, monkeypatch):
    _install_post(monkeypatch, lambda j, s: FakeResp(200, _ok("[1,2,3]")))
    with pytest.raises(LLMError):
        engine.json([{"role": "user", "content": "q"}], _SCHEMA_STRICT, retries=0)


# --------------------------------------------------------------------------- #
# health
# --------------------------------------------------------------------------- #


def test_health_true(engine, monkeypatch):
    monkeypatch.setattr(requests, "get", lambda *a, **k: FakeResp(200, {"data": []}))
    assert engine.health() is True


def test_health_false_on_error(engine, monkeypatch):
    def boom(*a, **k):
        raise requests.ConnectionError("refused")
    monkeypatch.setattr(requests, "get", boom)
    assert engine.health() is False


def test_base_url_from_env(monkeypatch):
    monkeypatch.setenv("AIVIDEO_LLM_BASE_URL", "http://gpu0:9000/v1")
    e = VLLMEngine()
    assert e.base_url == "http://gpu0:9000/v1"
