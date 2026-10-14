"""引擎层 (engines) —— 封装真实模型调用，对 stage 暴露稳定接口。

控制面（orchestrator/stages）与执行面（engines）分离：stage 只调引擎接口，
不关心底层是 vLLM / DiffSynth / CosyVoice。这样：
- 本机无 GPU 时用 StubEngine（pipeline/stages/base.py）跑通控制流；
- 服务器上换成这里的真实引擎，stage 代码一行不改。

每个引擎在无模型/无 GPU 时应**明确报错**，而不是静默降级。
"""
from __future__ import annotations
