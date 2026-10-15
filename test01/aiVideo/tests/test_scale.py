"""规模与健壮性测试 —— 在真实目标规模（20-50 集）下压测解析层。

样例剧本只有 3 集，掩盖了规模相关问题：ID 冲突、计数错误、性能退化、
长文档下的分镜边界。本文件合成 50 集剧本，验证解析器在目标规模下仍然正确。
"""
from __future__ import annotations

import time

import pytest

from pipeline.contracts import manifest_from_raw
from pipeline.parser import parse_screenplay
from pipeline.validate import validate


def build_screenplay(n_episodes: int = 50, scenes_per_ep: int = 3,
                     shots_per_scene: int = 2, lines_per_shot: int = 2) -> str:
    """合成一个规模可控的合法剧本。"""
    L: list[str] = [
        "---",
        "title: 规模压测剧",
        "genre: 都市 / 甜宠",
        "style: 写实电影感",
        'aspect_ratio: "9:16"',
        "language: zh",
        f"target_episodes: {n_episodes}",
        "episode_seconds: 9",
        "---",
        "",
        "# 规模压测剧",
        "",
        "> 一句话故事：用于规模压测的合成剧本。",
        "",
        "## 角色表",
        "",
        "- **林晚**：女，28岁。长直黑发，鹅蛋脸，杏眼，白色职业装，颈间银色细项链。",
        "- **顾沉**：男，32岁。利落短碎发，剑眉星目，深黑高定西装，左腕铂金腕表。",
        "- **苏曼**：女，30岁。精致卷发，红唇，名媛华服，眼神刻薄。",
        "",
    ]
    sc = 0
    for ep in range(1, n_episodes + 1):
        L.append(f"## 第{ep}集 · 测试")
        L.append("")
        for _ in range(scenes_per_ep):
            sc += 1
            L.append(f"### 场景 {sc}：地点{sc} · 白天 · 内")
            L.append("")
            L.append("**人物**：林晚（白衬衫，紧张），顾沉（黑西装，冷峻）")
            L.append(f"**环境**：测试环境描述{sc}，落地窗，午后阳光")
            L.append("**氛围**：紧张、暧昧")
            for k in range(shots_per_scene):
                L.append(f"**镜头**：中景，测试镜头描述 {sc}-{k}。")
                L.append(f"**动作**：林晚转身，顾沉递出文件 {sc}-{k}。")
                for j in range(lines_per_shot):
                    if j % 2 == 0:
                        L.append(f"> 顾沉（冷淡）：第{ep}集第{sc}场第{k}镜第{j}句台词。")
                    else:
                        L.append(f"> 林晚（内心OS）：独白内容{sc}-{k}-{j}。")
                L.append("**音效**：环境音、脚步声")
            L.append("**转场**：切")
            L.append("")
    return "\n".join(L)


@pytest.fixture(scope="module")
def big_md() -> str:
    return build_screenplay()


# --------------------------------------------------------------------------- #
# 校验层
# --------------------------------------------------------------------------- #


def test_50ep_validates_clean(big_md):
    """50 集规模剧本必须零 error 通过校验。"""
    rep = validate(big_md, "scale")
    assert rep.ok, [(i.line, i.code, i.msg) for i in rep.errors]


# --------------------------------------------------------------------------- #
# 解析层
# --------------------------------------------------------------------------- #


def test_50ep_counts_exact(big_md):
    raw = parse_screenplay(big_md)
    s = raw["_stats"]
    assert s["episodes"] == 50
    assert s["scenes"] == 150            # 50 × 3
    assert s["shots"] == 300             # 150 × 2
    assert s["dialogue_lines"] == 600    # 300 × 2
    assert s["characters"] == 3


def test_scene_ids_unique(big_md):
    raw = parse_screenplay(big_md)
    ids = [sc["id"] for ep in raw["episodes"] for sc in ep["scenes"]]
    assert len(ids) == len(set(ids)), "场景 ID 冲突"


def test_shot_ids_globally_unique(big_md):
    """镜头 ID 必须全局唯一（跨集跨场景），否则产物文件互相覆盖。"""
    raw = parse_screenplay(big_md)
    ids = [sh["id"] for ep in raw["episodes"] for sc in ep["scenes"] for sh in sc["shots"]]
    dupes = len(ids) - len(set(ids))
    assert dupes == 0, f"{dupes} 个镜头 ID 重复"


def test_every_episode_has_scenes(big_md):
    raw = parse_screenplay(big_md)
    for ep in raw["episodes"]:
        assert ep["scenes"], f"第 {ep['ep']} 集没有场景"
        assert ep["ep"] == raw["episodes"].index(ep) + 1


def test_no_loose_scenes_when_explicit_episodes(big_md):
    """显式分集模式下不应有游离场景。"""
    raw = parse_screenplay(big_md)
    assert raw["loose_scenes"] == []


def test_os_lines_detected_at_scale(big_md):
    raw = parse_screenplay(big_md)
    kinds = [ln["kind"] for ep in raw["episodes"] for sc in ep["scenes"]
             for sh in sc["shots"] for ln in sh["lines"]]
    assert kinds.count("os") == 300          # 每镜 1 句 OS
    assert kinds.count("dialogue") == 300


def test_emotions_captured_at_scale(big_md):
    raw = parse_screenplay(big_md)
    emos = [ln.get("emotion") for ep in raw["episodes"] for sc in ep["scenes"]
            for sh in sc["shots"] for ln in sh["lines"]]
    assert emos.count("冷淡") == 300


def test_scene_fields_parsed_at_scale(big_md):
    raw = parse_screenplay(big_md)
    for ep in raw["episodes"]:
        for sc in ep["scenes"]:
            assert sc["location"] and sc["location"].startswith("地点")
            assert sc["time"] == "白天"
            assert sc["int_ext"] == "内"
            assert sc["mood"] == "紧张、暧昧"
            assert sc["environment"]
            # 括号内逗号不应切碎角色列表
            assert len(sc["characters"]) == 2


def test_sfx_and_transition_at_scale(big_md):
    raw = parse_screenplay(big_md)
    shot = raw["episodes"][0]["scenes"][0]["shots"][0]
    assert shot["sfx"] == ["环境音", "脚步声"]
    # 转场挂在最后一个镜头上
    last = raw["episodes"][0]["scenes"][0]["shots"][-1]
    assert last["transition"] == "切"


def test_manifest_upgrade_at_scale(big_md):
    """50 集规模下 pydantic Manifest 升级 + 遍历必须正常。"""
    raw = parse_screenplay(big_md)
    m = manifest_from_raw(raw)
    assert m.meta.aspect_ratio == "9:16"
    assert m.meta.target_episodes == 50
    assert len(list(m.iter_shots())) == 300
    assert len(list(m.iter_scenes())) == 150
    stats = m.stats()
    assert stats["shots"] == 300
    assert stats["by_status"]["parsed"] == 300


# --------------------------------------------------------------------------- #
# 性能（解析是同步阻塞在出片关键路径前置，不能太慢）
# --------------------------------------------------------------------------- #


def test_parse_50ep_is_fast(big_md):
    t0 = time.perf_counter()
    raw = parse_screenplay(big_md)
    elapsed = time.perf_counter() - t0
    assert raw["_stats"]["episodes"] == 50
    # 50 集应在 1 秒内解析完（纯字符串处理，无 IO/无 LLM）
    assert elapsed < 1.0, f"解析 50 集耗时 {elapsed:.2f}s，过慢"


def test_manifest_upgrade_50ep_is_fast(big_md):
    raw = parse_screenplay(big_md)
    t0 = time.perf_counter()
    m = manifest_from_raw(raw)
    elapsed = time.perf_counter() - t0
    assert len(m.episodes) == 50
    # pydantic 校验 300 镜头 + 600 对白不应成为瓶颈
    assert elapsed < 5.0, f"Manifest 升级耗时 {elapsed:.2f}s，过慢"


# --------------------------------------------------------------------------- #
# 边界规模
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize("n_ep,expected_ep", [(1, 1), (20, 20), (50, 50)])
def test_episode_range_boundaries(n_ep, expected_ep):
    """目标区间 20-50 集的上下边界都要正确解析。"""
    md = build_screenplay(n_episodes=n_ep, scenes_per_ep=1, shots_per_scene=1, lines_per_shot=1)
    rep = validate(md, "boundary")
    assert rep.ok, [(i.code, i.msg) for i in rep.errors]
    raw = parse_screenplay(md)
    assert raw["_stats"]["episodes"] == expected_ep


def test_large_dialogue_line_not_truncated():
    """超长台词（接近 TTS 时长上限）不应被截断或丢字。"""
    long_line = "这是一句非常长的台词" * 12   # 120 字
    md = (
        '# t\n\n## 角色表\n\n- **林晚**：女，28岁，长黑发，白色职业装，气质清冷。\n\n'
        '## 第一集\n\n'
        '### 场景 1：房间 · 白天 · 内\n\n'
        f'> 林晚（哽咽）：{long_line}\n'
    )
    raw = parse_screenplay(md)
    ln = raw["episodes"][0]["scenes"][0]["shots"][0]["lines"][0]
    assert ln["text"] == long_line
    assert len(ln["text"]) == 120
    assert ln["emotion"] == "哽咽"


def test_no_episode_heading_falls_to_loose_scenes():
    """模式 B：没有 '## 第N集' 时场景落入 loose_scenes、episodes 为空。

    这是生成器必须知道的约束：互动式剧本生成器要输出显式 '## 第N集' 标题，
    否则下游按集装配拿不到任何 episode。
    """
    md = (
        '# t\n\n## 角色表\n\n- **林晚**：女，28岁，长黑发，白色职业装，气质清冷。\n\n'
        '### 场景 1：房间 · 白天 · 内\n\n> 林晚：台词一。\n\n'
        '### 场景 2：街道 · 夜 · 外\n\n> 顾沉：台词二。\n'
    )
    raw = parse_screenplay(md)
    assert raw["_stats"]["episodes"] == 0
    assert raw["_stats"]["has_explicit_episodes"] is False
    assert len(raw["loose_scenes"]) == 2
    # 内容没有丢：场景/镜头/对白都在 loose_scenes 里
    assert raw["_stats"]["scenes"] == 2
    assert raw["_stats"]["dialogue_lines"] == 2


def test_char_table_alone_does_not_create_episode():
    """'## 角色表' 是登记区，不应被误当成一集。"""
    md = (
        '# t\n\n## 角色表\n\n- **林晚**：女，28岁，长黑发，白色职业装，气质清冷。\n\n'
        '## 第一集\n\n### 场景 1：房间 · 白天 · 内\n\n> 林晚：台词。\n'
    )
    raw = parse_screenplay(md)
    assert raw["_stats"]["episodes"] == 1
    assert raw["episodes"][0]["heading"] == "第一集"
    assert raw["_stats"]["characters"] == 1


def test_episode_heading_without_explicit_number():
    """集标题不带'第N集'也应正常分配递增 ep 序号。"""
    md = (
        '# t\n\n### 场景 1：房间 · 白天 · 内\n\n> 林晚：台词一。\n\n'
        '## 开场\n\n### 场景 2：街道 · 夜 · 外\n\n> 顾沉：台词二。\n\n'
        '## 转折\n\n### 场景 3：办公室 · 白天 · 内\n\n> 苏曼：台词三。\n'
    )
    raw = parse_screenplay(md)
    eps = [e["ep"] for e in raw["episodes"]]
    assert eps == [1, 2], eps
    # 第一个场景在任何 ## 之前 -> 落入 loose_scenes（模式 B 混用）
    assert len(raw["loose_scenes"]) == 1
