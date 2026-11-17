import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const graphPath = path.join(root, 'content', 'graph.js');
const contentRoot = path.join(root, 'content');
const outPath = path.join(root, 'assets', 'js', 'data.js');

function loadScript(file) {
  const code = fs.readFileSync(file, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox, { filename: file, timeout: 5000 });
  return sandbox.window;
}

const graph = loadScript(graphPath).KB_GRAPH;
if (!graph || !Array.isArray(graph.tracks)) {
  throw new Error('content/graph.js 未导出 window.KB_GRAPH.tracks');
}

const problems = [];
const content = {};
const seenSlugs = new Set();

function scanTrack(track) {
  const dir = path.join(contentRoot, track.id);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
}

const usedContentDirs = new Set();

for (const track of graph.tracks) {
  if (!track.topics || !track.topics.length) continue;
  usedContentDirs.add(track.id);
  const files = scanTrack(track);

  for (const file of files) {
    const full = path.join(contentRoot, track.id, file);
    let win;
    try {
      win = loadScript(full);
    } catch (err) {
      problems.push(`${track.id}/${file}: 无法解析 — ${err.message.split('\n')[0]}`);
      continue;
    }
    const entry = win.KB_CONTENT && Object.values(win.KB_CONTENT)[0];
    if (!entry) {
      problems.push(`${track.id}/${file}: 没有写入 window.KB_CONTENT`);
      continue;
    }
    const html = entry.html || '';
    const slug = entry.slug || file.replace(/\.js$/, '');
    if (seenSlugs.has(slug)) problems.push(`${track.id}/${file}: slug 重复 — ${slug}`);
    seenSlugs.add(slug);

    const graphTopic = (track.topics || []).filter((t) => t.slug === slug)[0];
    if (graphTopic) {
      if (entry.level !== graphTopic.level) problems.push(`${track.id}/${file}: level ${entry.level} 与 graph 的 ${graphTopic.level} 不一致`);
      if (entry.cluster !== graphTopic.cluster) problems.push(`${track.id}/${file}: cluster "${entry.cluster}" 与 graph 的 "${graphTopic.cluster}" 不一致`);
    }

    if (!html.trim()) problems.push(`${track.id}/${file}: 正文为空`);
    if (html.includes('${')) problems.push(`${track.id}/${file}: 正文包含未转义的 \${ 序列`);
    if (html.includes('`')) problems.push(`${track.id}/${file}: 正文包含反引号`);
    if (/<script[\s>]/i.test(html)) problems.push(`${track.id}/${file}: 正文包含 <script>`);
    if (/<style[\s>]/i.test(html)) problems.push(`${track.id}/${file}: 正文包含 <style>`);
    if (/\son[a-z]+\s*=/i.test(html)) problems.push(`${track.id}/${file}: 正文包含内联事件属性`);
    if (/javascript:/i.test(html)) problems.push(`${track.id}/${file}: 正文包含 javascript: 链接`);
    if (/\*\*[^\n]+\*\*/.test(html)) problems.push(`${track.id}/${file}: 正文疑似残留 Markdown 加粗`);
    if (/^#{2,6}\s/m.test(html)) problems.push(`${track.id}/${file}: 正文疑似残留 Markdown 标题`);

    const svgs = (html.match(/<svg[\s>]/gi) || []).length;
    const figs = (html.match(/class="fig"/g) || []).length;
    if (svgs < 3) problems.push(`${track.id}/${file}: 只有 ${svgs} 个 SVG（要求 ≥3）`);
    if (figs < 3) problems.push(`${track.id}/${file}: 只有 ${figs} 个 figure（要求 ≥3）`);

    const codeBlocks = html.match(/<pre class="code"[\s\S]*?<\/pre>/gi) || [];
    for (const block of codeBlocks) {
      const inner = block
        .replace(/^<pre[^>]*>/i, '')
        .replace(/<\/pre>$/i, '')
        .replace(/<\/?code[^>]*>/gi, '');
      if (/<[a-zA-Z/!]/.test(inner)) problems.push(`${track.id}/${file}: 代码块含未转义的 <（会用 &lt;）`);
    }

    const text = html
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&[a-z]+;/gi, '')
      .replace(/\s+/g, '');
    const chars = text.length;
    if (chars < 3000) problems.push(`${track.id}/${file}: 正文约 ${chars} 字（要求 ≥3000）`);
    if (entry.summary && (entry.summary.length < 50 || entry.summary.length > 120)) {
      problems.push(`${track.id}/${file}: 摘要 ${entry.summary.length} 字（建议 60-90）`);
    }
    if (entry.keyPoints && (entry.keyPoints.length < 3 || entry.keyPoints.length > 5)) {
      problems.push(`${track.id}/${file}: 要点 ${entry.keyPoints.length} 条（要求 3-5）`);
    }

    content[slug] = {
      slug,
      track: track.id,
      title: entry.title || '',
      subtitle: entry.subtitle || '',
      summary: entry.summary || '',
      keyPoints: entry.keyPoints || [],
      readingMinutes: Math.max(5, Math.round(chars / 400) + Math.min(figs, 4)),
      svgs,
      chars,
      html
    };
  }
}

for (const dir of fs.readdirSync(contentRoot, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  if (!usedContentDirs.has(dir.name)) {
    const files = fs.readdirSync(path.join(contentRoot, dir.name)).filter((f) => f.endsWith('.js'));
    if (files.length) problems.push(`content/${dir.name}/: 目录未在 graph.tracks 中登记，${files.length} 个文件被忽略`);
  }
}

const dataTracks = [];
const allTopics = [];
const agg = { topics: 0, written: 0, minutes: 0, words: 0, diagrams: 0 };

for (const track of graph.tracks) {
  const topics = (track.topics || []).map((t) => {
    const c = content[t.slug] || {};
    return {
      ...t,
      track: track.id,
      title: c.title || t.title,
      subtitle: c.subtitle || t.subtitle,
      summary: c.summary || '',
      keyPoints: c.keyPoints || [],
      readingMinutes: c.readingMinutes || 0,
      hasContent: Boolean(c.html),
      chars: c.chars || 0
    };
  });

  const stats = {
    topics: topics.length,
    written: topics.filter((t) => t.hasContent).length,
    minutes: topics.reduce((a, t) => a + (t.readingMinutes || 0), 0),
    words: topics.reduce((a, t) => a + (t.chars || 0), 0),
    diagrams: topics.reduce((a, t) => a + ((content[t.slug] && content[t.slug].svgs) || 0), 0)
  };

  agg.topics += stats.topics;
  agg.written += stats.written;
  agg.minutes += stats.minutes;
  agg.words += stats.words;
  agg.diagrams += stats.diagrams;

  dataTracks.push({
    id: track.id,
    name: track.name,
    en: track.en,
    status: track.status,
    num: track.num,
    desc: track.desc,
    levels: track.levels || [],
    paths: track.paths || [],
    topicSlugs: topics.map((t) => t.slug),
    stats
  });

  for (const t of topics) {
    if (!seenSlugs.has(t.slug)) problems.push(`content/graph.js: 条目 ${track.id}/${t.slug} 缺少正文文件`);
    allTopics.push(t);
  }
}

const known = new Set(allTopics.map((t) => t.slug));
for (const slug of Object.keys(content)) {
  if (!known.has(slug)) problems.push(`content/${content[slug].track}/${slug}.js: 未在 content/graph.js 中登记`);
}

for (const track of dataTracks) {
  if (track.status === 'live' && !track.stats.topics) {
    problems.push(`模块 ${track.id}: live 状态但没有登记任何知识点`);
  }
}

const data = {
  site: graph.site,
  tracks: dataTracks,
  topics: allTopics,
  stats: agg
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(
  outPath,
  '/* 自动生成：npm run build。请勿手工编辑，源数据在 content/graph.js 与 content/<track>/。 */\n' +
    'window.KB_DATA = ' +
    JSON.stringify(data, null, 2) +
    ';\n',
  'utf8'
);

const live = dataTracks.filter((t) => t.status === 'live');
console.log(`已生成 ${path.relative(root, outPath)}`);
for (const t of live) {
  console.log(`  ${t.name.padEnd(8)} ${t.stats.written}/${t.stats.topics} 篇 · ${t.stats.diagrams} 图 · ${Math.round(t.stats.words / 1000)}k 字 · ${t.stats.minutes} 分钟`);
}
console.log(`合计 ${agg.written}/${agg.topics} 篇 · ${agg.diagrams} 图 · 约 ${Math.round(agg.words / 1000)}k 字`);

const missing = allTopics.filter((t) => !t.hasContent).map((t) => `${t.track}/${t.slug}`);
if (missing.length) console.log(`缺少正文（${missing.length}）：${missing.join(', ')}`);
if (problems.length) {
  console.log(`\n需要处理的问题（${problems.length}）：`);
  for (const p of problems) console.log(' - ' + p);
  process.exitCode = 1;
} else {
  console.log('校验通过。');
}
