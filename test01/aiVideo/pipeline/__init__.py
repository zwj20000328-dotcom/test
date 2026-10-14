"""AI 短剧全流程本地生成工作流。

Stage 流水线：
  0. ingest      —— 读取 .md 剧本
  1. parse       —— 确定性结构化解析 (parser.py)
  2. enrich      —— LLM 分镜细化 / prompt 生成 / 集切分 (待建)
  3. assets      —— 角色一致性定妆图 (待建)
  4. keyframes   —— 关键帧图像生成 (待建)
  5. video       —— 图生视频 (待建)
  6. tts         —— 配音 (待建)
  7. subtitles   —— 字幕对齐 (待建)
  8. audio_bgm   —— BGM/SFX (待建)
  9. assemble    —— 分集装配 + 全剧拼接 (待建)
"""
__version__ = "0.1.0"
