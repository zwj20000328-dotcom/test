import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const graphPath = path.join(root, 'content', 'graph.js');
const contentDir = path.join(root, 'content', 'aiinfra');
const outPath = path.join(root, 'assets', 'js', 'data.js');

function loadScript(file) {
  const code = fs.readFileSync(file, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox, { filename: file, timeout: 5000 });
  return sandbox.window;
}

const graph = loadScript(graphPath).KB_GRAPH;
if (!graph) throw new Error('content/graph.js 未导出 window.KB_GRAPH');

const files = fs.existsSync(contentDir)
  ? fs.readdirSync(contentDir).filter((f) => f.endsWith('.js'))
  : [];

const content = {};
const problems = [];

for (const file of files) {
  const full = path.join(contentDir, file);
  let win;
  try {
    win = loadScript(full);
  } catch (err) {
    problems.push(`${file}: 无法解析 — ${err.message.split('\n')[0]}`);
    continue;
  }
  const entry = win.KB_CONTENT && Object.values(win.KB_CONTENT)[0];
  if (!entry) {
    problems.push(`${file}: 没有写入 window.KB_CONTENT`);
    continue;
  }
  const html = entry.html || '';
  const slug = entry.slug || file.replace(/\.js$/, '');
  if (!html.trim()) problems.push(`${file}: 正文为空`);
  if (html.includes('${')) problems.push(`${file}: 正文包含未转义的 \${ 序列`);
  if (html.includes('`')) problems.push(`${file}: 正文包含反引号`);
  if (/<script[\s>]/i.test(html)) problems.push(`${file}: 正文包含 <script>`);
  if (/<style[\s>]/i.test(html)) problems.push(`${file}: 正文包含 <style>`);
  if (/\son[a-z]+\s*=/i.test(html)) problems.push(`${file}: 正文包含内联事件属性`);
  if (/\*\*[^\n]+\*\*/.test(html)) problems.push(`${file}: 正文疑似残留 Markdown 加粗`);
  if (/^#{2,6}\s/m.test(html)) problems.push(`${file}: 正文疑似残留 Markdown 标题`);
  if (/javascript:/i.test(html)) problems.push(`${file}: 正文包含 javascript: 链接`);
  const svgs = (html.match(/<svg[\s>]/gi) || []).length;
  const figs = (html.match(/class="fig"/g) || []).length;
  if (svgs < 3) problems.push(`${file}: 只有 ${svgs} 个 SVG（要求 ≥3）`);
  if (figs < 3) problems.push(`${file}: 只有 ${figs} 个 figure（要求 ≥3）`);

  const text = html
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/gi, '')
    .replace(/\s+/g, '');
  const chars = text.length;
  if (chars < 3000) problems.push(`${file}: 正文约 ${chars} 字（要求 ≥3000）`);
  if (entry.summary && (entry.summary.length < 50 || entry.summary.length > 120)) {
    problems.push(`${file}: 摘要 ${entry.summary.length} 字（建议 60-90）`);
  }
  if (entry.keyPoints && (entry.keyPoints.length < 3 || entry.keyPoints.length > 5)) {
    problems.push(`${file}: 要点 ${entry.keyPoints.length} 条（要求 3-5）`);
  }

  content[slug] = {
    slug,
    title: entry.title || '',
    subtitle: entry.subtitle || '',
    summary: entry.summary || '',
    keyPoints: entry.keyPoints || [],
    readingMinutes: Math.max(5, Math.round(chars / 400) + Math.min(figs, 4)),
    html
  };
}

const topics = graph.topics.map((t) => {
  const c = content[t.slug] || {};
  return {
    ...t,
    title: c.title || t.title,
    subtitle: c.subtitle || t.subtitle,
    summary: c.summary || '',
    keyPoints: c.keyPoints || [],
    readingMinutes: c.readingMinutes || 0,
    hasContent: Boolean(c.html),
    chars: c.html ? c.html.replace(/<[^>]+>/g, '').length : 0
  };
});

const known = new Set(topics.map((t) => t.slug));
for (const slug of Object.keys(content)) {
  if (!known.has(slug)) problems.push(`content/aiinfra/${slug}.js: 未在 content/graph.js 中登记`);
}

const stats = {
  topics: topics.length,
  levels: graph.levels.length,
  written: topics.filter((t) => t.hasContent).length,
  minutes: topics.reduce((a, t) => a + (t.readingMinutes || 0), 0),
  diagrams: files.reduce((a, f) => {
    try {
      const win = loadScript(path.join(contentDir, f));
      const entry = win.KB_CONTENT && Object.values(win.KB_CONTENT)[0];
      return a + ((entry && entry.html && (entry.html.match(/<svg[\s>]/gi) || []).length) || 0);
    } catch {
      return a;
    }
  }, 0),
  words: files.reduce((a, f) => {
    try {
      const win = loadScript(path.join(contentDir, f));
      const entry = win.KB_CONTENT && Object.values(win.KB_CONTENT)[0];
      const html = (entry && entry.html) || '';
      return a + html.replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/<[^>]+>/g, '').replace(/\s+/g, '').length;
    } catch {
      return a;
    }
  }, 0)
};

const data = {
  site: graph.site,
  levels: graph.levels,
  tracks: graph.tracks,
  paths: graph.paths,
  topics,
  stats
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(
  outPath,
  '/* 自动生成：npm run build。请勿手工编辑，源数据在 content/graph.js 与 content/aiinfra/。 */\n' +
    'window.KB_DATA = ' +
    JSON.stringify(data, null, 2) +
    ';\n',
  'utf8'
);

const missing = topics.filter((t) => !t.hasContent).map((t) => t.slug);
console.log(`已生成 ${path.relative(root, outPath)}`);
console.log(`条目 ${stats.written}/${stats.topics} · 图 ${stats.diagrams} 张 · 约 ${Math.round(stats.words / 1000)}k 字 · ${stats.minutes} 分钟`);
if (missing.length) console.log(`缺少正文（${missing.length}）：${missing.join(', ')}`);
if (problems.length) {
  console.log(`\n需要处理的问题（${problems.length}）：`);
  for (const p of problems) console.log(' - ' + p);
  process.exitCode = 1;
} else {
  console.log('校验通过。');
}
