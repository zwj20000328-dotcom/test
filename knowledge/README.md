# 知栈 · Stack Atlas

一个关于计算机系统、编程语言与 AI 基础设施的交互式知识地图。目前上线两个模块：

- **AI Infra**：31 个知识点、7 个层级，从一颗 GPU 到十万卡集群。
- **C++**：33 个知识点、7 个层级，从编译模型到对象模型、泛型、并发与工程化。

每个模块都有一张带前置关系的知识地图、深度图文教程、学习进度与自测。纯静态站点，无构建依赖、无后端，可直接双击 `index.html` 打开。

## 快速开始

```bash
npm run build   # 生成 assets/js/data.js 并校验所有模块的内容
npm run serve   # http://localhost:4173
```

只改样式或页面时不需要 build；`data.js` 是 `content/` 的索引，内容变化后需重新生成。

## 目录

```text
index.html                 首页：模块、学习路径、进度
track.html?track=<id>      知识地图：层级、筛选、前置关系连线
topic.html?t=<slug>        教程页：目录、图解、自测、上下篇
resources.html             资源库与项目维护说明
games.html                 术语配对（AI Infra / C++）/ 瓶颈诊断
assets/css/style.css       设计系统
assets/js/data.js          自动生成，请勿手改
assets/js/app.js           导航、主题、进度、搜索
content/graph.js           模块、层级、条目、前置关系、路径（手工维护）
content/aiinfra/*.js       AI Infra 正文
content/cpp/*.js           C++ 正文
tools/build.mjs            索引生成 + 内容校验
tools/serve.mjs            本地静态服务器
```

## 新增一个模块

1. 在 `content/graph.js` 的 `tracks` 中登记模块：`id`、名称、`status: 'live'`、`levels`、`topics`、`paths`。
2. 新建 `content/<track-id>/` 目录，每篇正文一个文件。
3. 页面会自动出现在首页、地图切换器与全站搜索中，无需改 JS。
4. `npm run build` 校验并生成索引。

## 新增或修改一篇教程

1. 在对应模块的 `topics` 中登记条目：`slug`、标题、副标题、层级、标签、`prereq`。
1. 新建 `content/<track-id>/<slug>.js`：

```js
window.KB_CONTENT = window.KB_CONTENT || {};
window.KB_CONTENT["<slug>"] = {
  slug: "<slug>",
  title: "标题",
  subtitle: "副标题",
  level: 4,
  cluster: "并发与性能",
  tags: ["标签"],
  summary: "60-90 字摘要",
  keyPoints: ["要点一", "要点二", "要点三"],
  readingMinutes: 14,
  html: String.raw`<section class="sec">…</section>`
};
```

1. `npm run build`。校验会检查：至少 3 个 SVG、正文不少于 3000 字、无脚本标签、正文中不出现反引号与 `${` 序列、摘要长度、条目已在模块中登记。

## 正文可用的类

`section.sec`、`figure.fig`、`div.callout`（`--intuition/--formula/--warn/--tip/--story`）、`div.formula`、`pre.code[data-lang]`、`div.tbl-wrap > table.tbl`、`details.quiz`、`div.duo`、`ul.refs`、`mark`。

SVG 图统一使用 `viewBox="0 0 760 380" width="100%"`，颜色只取 CSS 变量 `--sv-*`，以便自动适配深浅色主题；`defs` 内的 id 需带条目前缀，避免同页冲突。

## 其他

- 学习进度、主题、游戏成绩都存在浏览器 `localStorage`，不上传任何数据。
- 资源库页面提供进度导出 / 导入。
- 内容为教学用途，硬件数字标注设备型号与口径，C++ 的布局与 ABI 说明标注平台与编译器前提；选型请以官方文档为准。
