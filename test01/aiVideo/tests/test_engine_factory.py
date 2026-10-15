"""引擎工厂测试 —— 锁定"服务器接线"落点的行为。

工厂是 run.py 与 tasks.py 共用的唯一引擎构造点。关键不变量：
  1. stubs 模式返回全部 5 个引擎（本机验证控制流用）
  2. 真实模式在缺模型/缺服务时**优雅降级**为空 dict，而不是抛异常
     —— 否则 run.py 在没起服务时会直接崩，而不是跳过阶段并给出诊断
  3. only 参数生效：worker 按 CUDA_VISIBLE_DEVICES 钉绑，只应加载自己那份模型
  4. manifest 的 local_dir 能被正确解析为绝对路径
"""
from __future__ import annotations

from pathlib import Path

import pytest

from pipeline.engines import factory
from pipeline.engines.factory import (
    _load_manifest,
    build_engines,
    resolve_model_root,
)


@pytest.fixture(autouse=True)
def _no_network(monkeypatch):
    """真实模式的降级测试不应真连网络（vLLM 健康检查连不上会慢速失败 ~4s/次）。

    把 VLLMEngine.health 打桩为 False，模拟"服务未起"，仍走完整的优雅降级路径。
    """
    from pipeline.engines.llm import VLLMEngine
    monkeypatch.setattr(VLLMEngine, "health", lambda self: False)


# --------------------------------------------------------------------------- #
# 1. stubs 模式
# --------------------------------------------------------------------------- #


def test_stubs_returns_all_engines():
    engines = build_engines(stubs=True)
    assert set(engines) == {"llm", "image", "video", "tts", "music"}
    # 全部是同一个 StubEngine 实例（无 GPU 依赖）
    assert all(hasattr(e, "generate") for e in engines.values())


def test_stubs_ignores_only():
    """stubs 模式下 only 不生效（占位引擎无成本，全给便于跑通控制流）。"""
    engines = build_engines(stubs=True, only=["llm"])
    assert len(engines) == 5


# --------------------------------------------------------------------------- #
# 2. 优雅降级（本机无模型/无服务）
# --------------------------------------------------------------------------- #


def test_real_mode_degrades_gracefully(tmp_path):
    """模型根目录为空时不抛异常，返回空 dict。"""
    engines = build_engines(stubs=False, manifest_path=_manifest_with_root(tmp_path))
    assert engines == {}


def test_real_mode_only_llm_unreachable(tmp_path, monkeypatch):
    """vLLM 端点不可达 -> 跳过 llm 引擎，不崩溃。"""
    monkeypatch.setenv("AIVIDEO_LLM_BASE_URL", "http://127.0.0.1:1/v1")  # 必然连不上
    engines = build_engines(stubs=False, only=["llm"],
                            manifest_path=_manifest_with_root(tmp_path))
    assert "llm" not in engines


def test_missing_manifest_does_not_crash(tmp_path):
    """manifest 文件不存在时用内置默认路径，仍不崩溃。"""
    engines = build_engines(stubs=False, manifest_path=tmp_path / "nonexistent.yaml")
    assert engines == {}


# --------------------------------------------------------------------------- #
# 3. only 参数（worker 按需加载）
# --------------------------------------------------------------------------- #


def test_only_filters_builders(tmp_path, monkeypatch):
    """only=["tts"] 时不应尝试构造 llm/image/video/music。"""
    called = []
    for name in list(factory._BUILDERS):
        orig = factory._BUILDERS[name]

        def make(n=orig, key=name):
            def wrapper(*a, **kw):
                called.append(key)
                return None
            return wrapper

        monkeypatch.setitem(factory._BUILDERS, name, make())

    build_engines(stubs=False, only=["tts"], manifest_path=_manifest_with_root(tmp_path))
    assert called == ["tts"], f"构造了不该构造的引擎：{called}"


def test_only_none_builds_all(tmp_path, monkeypatch):
    called = []
    for name in list(factory._BUILDERS):
        def make(key=name):
            def wrapper(*a, **kw):
                called.append(key)
                return None
            return wrapper
        monkeypatch.setitem(factory._BUILDERS, name, make())

    build_engines(stubs=False, only=None, manifest_path=_manifest_with_root(tmp_path))
    assert set(called) == set(factory._BUILDERS)


def test_builder_exception_is_contained(tmp_path, monkeypatch):
    """某个引擎构造抛异常不应拖垮其余引擎。"""
    def boom(*a, **kw):
        raise RuntimeError("CUDA driver mismatch")

    monkeypatch.setitem(factory._BUILDERS, "image", boom)
    engines = build_engines(stubs=False, manifest_path=_manifest_with_root(tmp_path))
    assert "image" not in engines   # 被吞掉并记日志，不向上抛


# --------------------------------------------------------------------------- #
# 4. manifest 解析
# --------------------------------------------------------------------------- #


def test_manifest_loads_subsystems():
    m = _load_manifest()
    for sub in ("llm", "image", "video", "tts", "music"):
        assert sub in m, f"models.yaml 缺少 {sub} 子系统"
        assert isinstance(m[sub], list) and m[sub]


def test_model_root_resolution(monkeypatch):
    m = _load_manifest()
    # 环境变量优先
    monkeypatch.setenv("AIVIDEO_MODEL_ROOT", "/mnt/custom")
    assert resolve_model_root(m) == "/mnt/custom"
    # 无环境变量时回落 manifest
    monkeypatch.delenv("AIVIDEO_MODEL_ROOT", raising=False)
    assert resolve_model_root(m) == (m.get("meta") or {}).get("model_root")


# --------------------------------------------------------------------------- #
# CUDA 设备重映射（worker 用 CUDA_VISIBLE_DEVICES 钉绑时的正确性）
# --------------------------------------------------------------------------- #


def test_device_passthrough_when_all_visible(monkeypatch):
    """8 卡全可见（未设 CUDA_VISIBLE_DEVICES，如 run.py 单进程）→ 绝对卡号原样返回。"""
    monkeypatch.delenv("CUDA_VISIBLE_DEVICES", raising=False)
    assert factory.normalize_device("cuda:3") == "cuda:3"
    assert factory.normalize_device("cuda:7") == "cuda:7"


def test_device_remap_dual_card_video_worker(monkeypatch):
    """video worker 钉 CUDA_VISIBLE_DEVICES=3,4 → cuda:3→cuda:0, cuda:4→cuda:1。

    若不重映射，进程内只有 2 张卡（索引 0/1），传 cuda:3 会 invalid device ordinal。
    """
    monkeypatch.setenv("CUDA_VISIBLE_DEVICES", "3,4")
    assert factory.normalize_device("cuda:3") == "cuda:0"
    assert factory.normalize_device("cuda:4") == "cuda:1"
    assert factory.normalize_devices(("cuda:3", "cuda:4")) == ("cuda:0", "cuda:1")


def test_device_remap_single_card_worker(monkeypatch):
    monkeypatch.setenv("CUDA_VISIBLE_DEVICES", "7")
    assert factory.normalize_device("cuda:7") == "cuda:0"
    monkeypatch.setenv("CUDA_VISIBLE_DEVICES", "1")
    assert factory.normalize_device("cuda:1") == "cuda:0"


def test_device_remap_unlisted_falls_back(monkeypatch):
    """请求的卡不在可见列表 → 回落 cuda:0 并 warning，不抛异常（避免整个 worker 挂掉）。"""
    monkeypatch.setenv("CUDA_VISIBLE_DEVICES", "3,4")
    assert factory.normalize_device("cuda:1") == "cuda:0"


def test_device_cpu_and_bare_passthrough(monkeypatch):
    monkeypatch.setenv("CUDA_VISIBLE_DEVICES", "0")
    assert factory.normalize_device("cpu") == "cpu"
    assert factory.normalize_device("") == ""


def test_device_removes_duplicates(monkeypatch):
    monkeypatch.setenv("CUDA_VISIBLE_DEVICES", "3,4")
    # 同一物理卡被请求两次 → 去重
    assert factory.normalize_devices(("cuda:3", "cuda:3")) == ("cuda:0",)


def test_model_dir_lookup():
    m = _load_manifest()
    d = factory._model_dir(m, "video", "Wan2.2-I2V-A14B", "/data/models")
    assert d is not None
    # 用 Path 比较以保持跨平台（开发机 Windows 给反斜杠，部署机 Linux 给正斜杠，两者都对）
    assert Path(d) == Path("/data/models") / "Wan2.2-I2V-A14B"
    assert "Wan2.2-I2V-A14B" in d
    # 找不到的返回 None（而非抛异常）
    assert factory._model_dir(m, "video", "不存在的模型", "/data/models") is None


def test_every_manifest_entry_has_required_fields():
    """models.yaml 完整性：每项都要有 repo_id/local_dir/source，否则工厂找不到路径。"""
    m = _load_manifest()
    for sub in ("llm", "image", "video", "tts", "asr", "music"):
        for entry in m.get(sub) or []:
            assert entry.get("repo_id"), f"{sub} 有条目缺 repo_id: {entry.get('name')}"
            assert entry.get("local_dir"), f"{sub} 有条目缺 local_dir: {entry.get('name')}"
            assert entry.get("source") in ("modelscope", "hf-mirror"), \
                f"{sub} source 非法: {entry.get('source')}"


# --------------------------------------------------------------------------- #
# helper
# --------------------------------------------------------------------------- #


def _manifest_with_root(tmp_path: Path) -> Path:
    """写一个指向空目录的 manifest，用于测试"模型不存在"的降级路径。"""
    src = _load_manifest()
    import copy
    m = copy.deepcopy(src)
    m.setdefault("meta", {})["model_root"] = str(tmp_path / "empty_models")
    out = tmp_path / "models.yaml"
    import yaml
    out.write_text(yaml.safe_dump(m, allow_unicode=True), encoding="utf-8")
    return out
