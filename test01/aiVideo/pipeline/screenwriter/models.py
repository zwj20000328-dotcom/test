"""阶段 A 数据模型 —— canon（世界观圣经）、两级节拍表、会话状态。

三类持久化对象，都存 JSON、都用原子写（复用 Manifest.save 的模式）：
  1. Canon      世界观圣经：角色、关系、知识状态、时间线、道具、既成事实、已用桥段
  2. BeatSheet  两级节拍表：季度弧线 + 每集节拍 + 每场景节拍
  3. Session    会话状态：当前进度、分支树、undo 历史、已生成的集

为什么 canon 与 BeatSheet 分开：canon 是"世界当前是什么样"（随创作增量演进），
BeatSheet 是"计划怎么讲这个故事"（前期规划、可整体重排）。两者变更频率与冲突面不同。
"""
from __future__ import annotations

import hashlib
import json
import os
from enum import Enum
from pathlib import Path
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class _Base(BaseModel):
    model_config = ConfigDict(extra="allow", validate_assignment=True)


# --------------------------------------------------------------------------- #
# 知识状态（谁能何时知道什么）—— 短剧反转的命门
# --------------------------------------------------------------------------- #


class KnowledgeEntry(_Base):
    """一条"某事实、谁在何时知道"的记录。

    用于阻止角色提前知道不该知道的信息（例：顾沉身份 -> 林晚第 11 集才知道，
    那么第 1-10 集林晚的台词/行为不得基于该信息）。

    三个时间维度的语义必须分清（早期版本混用导致"林晚第5集就知道真相"的 bug）：
      knows_from_ep  **持有者 holder** 从第几集起知道（自己的秘密通常是 1）
      revealed_to    {角色名: 起始集} —— 每个被告知者**各自**从第几集起知道。
                     这是"公开揭示"或"提前单独告知"的统一表达，必须带集数，
                     否则无法区分"第3集提前告知"与"第11集公开揭示"。
                     为兼容性也接受字符串（视为第 1 集起知道）。
      hidden_from    明确瞒着谁（生成负面约束用）；这些人在 source_ep 之前都不知道
      source_ep      该事实在剧中**第几集公开揭示**；揭示后 hidden_from 里的人才知道
    """
    fact_id: str
    fact: str                              # 事实描述，如"顾沉是顾氏集团总裁"
    holder: str                            # 事实的持有者/当事人
    knows_from_ep: int = 1                 # 持有者从第几集起知道
    revealed_to: dict[str, int] = Field(default_factory=dict)   # {角色: 起始集}
    hidden_from: list[str] = Field(default_factory=list)
    source_ep: Optional[int] = None        # 剧中第几集公开揭示（None = 尚未安排）

    @model_validator(mode="before")
    @classmethod
    def _coerce_revealed_to(cls, data: Any) -> Any:
        """兼容：revealed_to 传入字符串列表时，转成 {name: source_ep or 1}。"""
        if isinstance(data, dict):
            rt = data.get("revealed_to")
            if isinstance(rt, list):
                src = data.get("source_ep")
                data = dict(data)
                data["revealed_to"] = {
                    n: (src if isinstance(src, int) else 1) for n in rt if isinstance(n, str)
                }
        return data

    def knows_from(self, char_name: str) -> Optional[int]:
        """该角色从第几集起知道此事实；None 表示永不（在本条记录范围内）。"""
        if char_name == self.holder:
            return self.knows_from_ep
        if char_name in self.revealed_to:
            return self.revealed_to[char_name]
        if self.source_ep is not None:
            # 公开揭示后：hidden_from 里的人也知道了；路人角色同样知道
            return self.source_ep
        return None


class Relationship(_Base):
    """角色关系，带"关系变化的集数"以便回溯连续性。"""
    a: str
    b: str
    kind: str                              # 夫妻/继姐妹/上下级/初恋…
    sentiment: str = "neutral"             # 敌对/暧昧/信任/仇恨…
    since_ep: int = 1
    notes: str = ""


# --------------------------------------------------------------------------- #
# 角色（与视频阶段的 Character 对齐，避免下游重复推导）
# --------------------------------------------------------------------------- #


class CanonCharacter(_Base):
    """角色档案。字段刻意与 pipeline/contracts.py 的 Character 对齐，
    使交付的 canon.json 能被视频阶段 S2 enrich 直接复用（identity_blob/voice_tag 等），
    而不是让 enrich 再花 1000-3000 次 LLM 调用重新推导。
    """
    id: str
    name: str
    gender: Optional[str] = None
    age: Optional[int] = None
    role: str = "配角"                     # 主角/反派/配角
    appearance_zh: str = ""                # 中文外形（写进 角色表）
    identity_blob: Optional[str] = None    # 固定英文外貌串（进每个图像 prompt）
    costume: Optional[str] = None
    personality: str = ""
    motivation: str = ""                   # 核心动机，驱动其行为逻辑
    voice_tag: Optional[str] = None        # 音色描述（供 CosyVoice 选/建音色）
    voice_ref: Optional[str] = None        # 用户提供的参考音路径
    seed_base: Optional[int] = None
    is_lead: bool = False


# --------------------------------------------------------------------------- #
# Canon
# --------------------------------------------------------------------------- #


class Canon(_Base):
    """世界观圣经：创作过程中增量更新，每次生成调用都注入上下文。"""
    title: str = ""
    logline: str = ""
    genre: str = ""
    tone: str = ""
    era: str = ""                          # 时代背景
    style: str = ""                        # 画风（写进 front-matter）
    core_conflict: str = ""
    payoff_types: list[str] = Field(default_factory=list)   # 爽点类型：打脸/逆袭/身份反差

    characters: list[CanonCharacter] = Field(default_factory=list)
    relationships: list[Relationship] = Field(default_factory=list)
    knowledge: list[KnowledgeEntry] = Field(default_factory=list)

    timeline: list[dict[str, Any]] = Field(default_factory=list)   # [{ep, event, when}]
    objects: list[dict[str, Any]] = Field(default_factory=list)    # 道具/MacGuffin
    established_facts: list[str] = Field(default_factory=list)     # 不可违背的既成事实
    locations: list[dict[str, Any]] = Field(default_factory=list)

    # 防重复：已用过的桥段（负向清单，注入 prompt 禁止再用）
    used_beats: list[str] = Field(default_factory=list)

    def character(self, name: str) -> Optional[CanonCharacter]:
        for c in self.characters:
            if c.name == name:
                return c
        return None

    def leads(self) -> list[CanonCharacter]:
        return [c for c in self.characters if c.is_lead or c.role == "主角"]

    def knows(self, char_name: str, fact_id: str, at_ep: int) -> bool:
        """该角色在第 at_ep 集时是否已知某事实。

        统一走 KnowledgeEntry.knows_from()，它按角色返回各自的"起始知情集"：
        持有者=knows_from_ep；revealed_to 里的人=各自的集数；
        其余人=source_ep（公开揭示后）。只要 at_ep >= 起始集即知道。
        """
        for k in self.knowledge:
            if k.fact_id != fact_id:
                continue
            start = k.knows_from(char_name)
            return start is not None and at_ep >= start
        return False

    def known_facts_for(self, char_name: str, at_ep: int) -> list[str]:
        """注入 prompt 用：该角色截至第 at_ep 集知道的所有事实。"""
        return [k.fact for k in self.knowledge
                if self.knows(char_name, k.fact_id, at_ep)]

    def hidden_from(self, char_name: str, at_ep: int) -> list[str]:
        """注入 prompt 用：该角色截至第 at_ep 集**不知道**的事实（负面约束）。

        这是防止"角色提前知道不该知道的事"的关键——生成第 5 集时，
        必须告诉 LLM 林晚此时还不知道顾沉的身份。
        """
        return [k.fact for k in self.knowledge
                if not self.knows(char_name, k.fact_id, at_ep)]

    # ---- 持久化（原子写）----
    def save(self, path: Path | str) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(self.model_dump(mode="json"), ensure_ascii=False, indent=2)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(payload, encoding="utf-8")
        os.replace(tmp, path)

    @classmethod
    def load(cls, path: Path | str) -> "Canon":
        return cls.model_validate(json.loads(Path(path).read_text(encoding="utf-8")))


# --------------------------------------------------------------------------- #
# 两级节拍表
# --------------------------------------------------------------------------- #


class ActKind(str, Enum):
    hook = "开篇钩子"
    escalation = "冲突升级"
    midpoint = "中期反转"
    climax = "高潮"
    resolution = "收尾"


class SeasonAct(_Base):
    """季度弧线的一段。"""
    kind: ActKind
    ep_from: int
    ep_to: int
    goal: str                              # 该区段的戏剧任务
    key_turns: list[str] = Field(default_factory=list)   # 重大转折落点


class SceneBeat(_Base):
    """场景级节拍（生成正文的直接依据）。"""
    scene_no: int
    location: str = ""
    time: str = ""
    int_ext: str = "内"
    purpose: str = ""                      # 这场戏要完成什么
    mood: str = ""
    characters: list[str] = Field(default_factory=list)
    target_seconds: float = 40.0
    key_line: Optional[str] = None         # 本场的核心台词/金句（可选）
    ends_on: str = ""                      # 本场结尾动作/情绪


class EpisodeBeat(_Base):
    """集级节拍：一集 4-5 分钟的内部结构。"""
    ep: int
    title: str = ""
    arc_role: str = ""                     # 本集在季度弧线中的职责
    setup: str = ""                        # 承接上集的处境
    escalation: str = ""                   # 内部递进
    payoff: str = ""                       # 本集爽点/小高潮
    hook: str = ""                         # ★集尾钩子（必须有）
    scenes: list[SceneBeat] = Field(default_factory=list)
    target_seconds: float = 270.0
    # 生成后回填
    status: str = "planned"                # planned | drafted | accepted
    reversal: bool = False                 # 本集是否含重大反转


class BeatSheet(_Base):
    """两级节拍表：季度弧线 + 每集节拍。"""
    total_episodes: int = 30
    episode_seconds: float = 270.0
    acts: list[SeasonAct] = Field(default_factory=list)
    episodes: list[EpisodeBeat] = Field(default_factory=list)

    def episode(self, ep: int) -> Optional[EpisodeBeat]:
        for e in self.episodes:
            if e.ep == ep:
                return e
        return None

    def act_of(self, ep: int) -> Optional[SeasonAct]:
        for a in self.acts:
            if a.ep_from <= ep <= a.ep_to:
                return a
        return None

    def reversal_episodes(self) -> list[int]:
        return [e.ep for e in self.episodes if e.reversal]

    def save(self, path: Path | str) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(self.model_dump(mode="json"), ensure_ascii=False, indent=2)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(payload, encoding="utf-8")
        os.replace(tmp, path)

    @classmethod
    def load(cls, path: Path | str) -> "BeatSheet":
        return cls.model_validate(json.loads(Path(path).read_text(encoding="utf-8")))


# --------------------------------------------------------------------------- #
# 分支与选择
# --------------------------------------------------------------------------- #


class PlotOption(_Base):
    """一个可选剧情走向（呈现给用户做选择）。"""
    key: str                               # "1" / "2" / "3"
    direction: str                         # 方向摘要（一句话）
    tone_shift: str = ""                   # 基调变化
    affects: list[str] = Field(default_factory=list)   # 影响的角色
    consequence: str = ""                  # 会导致什么（往下走向哪）
    risk: str = "低"                       # 低/中/高 + 简述
    stakes: int = 3                        # 1-5，用于判定"重大决策点"


class Choice(_Base):
    """一次已做出的选择（进 undo 历史与分支树）。"""
    ep: int
    at: str                                # ISO 时间戳由调用方传入（脚本内不用 Date）
    chosen_key: Optional[str] = None       # 选了哪个预设方向
    freeform: Optional[str] = None         # 或用户的自由改写文本
    summary: str = ""                      # 这次选择实际造成的改动摘要
    blast_radius: list[int] = Field(default_factory=list)   # 波及的集号


class Branch(_Base):
    """分支：从某集某次选择分叉出的一条平行线。"""
    id: str
    parent: Optional[str] = None
    fork_ep: int
    label: str = ""
    created_at: str = ""


# --------------------------------------------------------------------------- #
# 会话
# --------------------------------------------------------------------------- #


class InvolvementLevel(str, Enum):
    """用户介入粒度（30-50 集不可能每镜都问）。"""
    major = "major"        # 只在重大决策点（反转/关键关系变化）问
    every_episode = "every_episode"   # 每集都问（默认）
    autopilot = "autopilot"           # 全自动推进，用户可随时打断否决


class Session(_Base):
    """一次剧本创作会话的完整状态（崩溃可续）。"""
    name: str
    created_at: str = ""
    updated_at: str = ""
    source_synopsis: str = ""

    # 规格（决策 #2：用户指定、模型建议）
    total_episodes: int = 30
    episode_seconds: float = 270.0
    spec_confirmed: bool = False

    involvement: InvolvementLevel = InvolvementLevel.every_episode
    auto_policy: str = "max-tension"      # autopilot/batch 模式的自动选择策略

    canon: Canon = Field(default_factory=Canon)
    beats: BeatSheet = Field(default_factory=BeatSheet)

    # 进度
    current_ep: int = 1
    completed_eps: list[int] = Field(default_factory=list)
    # 每集正文（Markdown 片段）与结构化中间产物
    episodes_md: dict[int, str] = Field(default_factory=dict)

    # 分支与历史
    branch_id: str = "main"
    branches: list[Branch] = Field(default_factory=list)
    history: list[Choice] = Field(default_factory=list)

    # 交付
    delivered_path: Optional[str] = None
    delivered_at: Optional[str] = None

    def is_complete(self) -> bool:
        return len(self.completed_eps) >= self.total_episodes

    def next_ep(self) -> int:
        for ep in range(1, self.total_episodes + 1):
            if ep not in self.completed_eps:
                return ep
        return self.total_episodes

    def undo_last(self) -> Optional[Choice]:
        """弹出最近一次选择（调用方负责据此回滚 canon/beats）。"""
        return self.history.pop() if self.history else None

    # ---- 持久化（原子写；大剧可按集分片，见 save_sharded）----
    def save(self, path: Path | str) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(self.model_dump(mode="json"), ensure_ascii=False, indent=2)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(payload, encoding="utf-8")
        os.replace(tmp, path)

    @classmethod
    def load(cls, path: Path | str) -> "Session":
        return cls.model_validate(json.loads(Path(path).read_text(encoding="utf-8")))


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]
