# 资源目录导读

| 文件/目录 | 作用 |
| --- | --- |
| [catalog.yaml](catalog.yaml) | 结构化资源清单（唯一事实来源） |
| [INDEX.md](INDEX.md) | 自动生成的索引（统计、待核实、阅读队列、全部资源） |
| [conventions.md](conventions.md) | ID、字段、状态、置信度、写作规范 |
| [reading-queue.md](reading-queue.md) | 人工维护的优先阅读顺序与理由 |
| [notes/](notes/) | 单篇论文/系统笔记 |
| [templates/](templates/) | 笔记、调研、设计模板 |

## 常用命令

```bash
npm run resources:validate
npm run resources:index
npm run resources:check
npm run resources:stats
```

## 新增资源（三步）

1. 在 `catalog.yaml` 追加条目（分配下一个 ID，`status: inbox`）；
2. 需要深读时，用 `templates/paper-note.md` 创建笔记，并把 `note` 字段指向它；
3. 运行 `npm run resources:index` 更新索引。

## 置信度速查

- `A`：同行评审/官方技术报告/可复现；关键数字可直接引用。
- `B`：arXiv 预印本/官方博客；方向可信，数字标“约”。
- `C`：二手/未能访问；使用前必须核实，并填写 `verify_reason`。
