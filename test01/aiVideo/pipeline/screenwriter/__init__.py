"""剧本创作子系统（阶段 A）—— 互动式生成符合 SCREENPLAY_FORMAT 的 Markdown 剧本。

分层：
  models.py   canon / session / beat 数据模型（pydantic，崩溃安全持久化）
  craft.py    确定性节奏校验（时长/镜头数/对白预算），不依赖 LLM
  emitter.py  结构化数据 -> Markdown（parser 的逆向，保证 validate 通过）
  engine.py   LLM 调用编排（设定卡/大纲/分集节拍/场景正文/批评）—— 纯逻辑，可 mock 测试
  cli.py      互动式命令行（薄层，只做渲染与输入）

设计原则：**engine 与 cli 分离**。engine 不含任何 input()/print()，因此可用 mock LLM
完整测试；cli 只负责渲染与采集输入。
"""
