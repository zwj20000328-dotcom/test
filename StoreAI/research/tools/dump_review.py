# -*- coding: utf-8 -*-
import json

p = r'C:/Users/Xuuuuuun/AppData/Local/Temp/claude/d--xiaojun-work-test-StoreAI/91bbf890-fa61-4cfc-92ee-20131f948ac3/tasks/whuqxp7nn.output'
o = json.load(open(p, encoding='utf-8'))
r = o.get('result', o)
fs = r['findings']
vs = r['verification']
order = [f for f in fs if f['severity'] != 'low'][:30]

lines = [f"# 评审结果（total={r.get('total_findings')}, confirmed={r.get('confirmed_count')}）\n"]
for i, (f, v) in enumerate(zip(order, vs), 1):
    lines.append(f"## {i}. [{v['verdict']}/{f['severity']}] {f['file'].split('/')[-1]} — {f['location']}")
    lines.append(f"- 说法：{f['claim']}")
    lines.append(f"- 问题：{f['problem']}")
    lines.append(f"- 证据：{f['evidence']}")
    lines.append(f"- 复核理由：{v['reasoning']}")
    lines.append(f"- **修正**：{v['corrected_fix']}\n")

lines.append("\n# 低严重度 findings（未复核）\n")
for f in fs:
    if f['severity'] == 'low':
        lines.append(f"## [low] {f['file'].split('/')[-1]} — {f['location']}")
        lines.append(f"- 说法：{f['claim']}")
        lines.append(f"- 问题：{f['problem']}")
        lines.append(f"- 建议：{f['suggested_fix']}\n")

open('d:/xiaojun/work/test/StoreAI/research/raw/review-summary.md', 'w', encoding='utf-8').write("\n".join(lines))
print("wrote", len(lines), "lines")
