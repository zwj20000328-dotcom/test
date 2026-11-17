#!/usr/bin/env node
// arXiv 检索与解析工具（无第三方依赖）。
// 用法:
//   node scripts/arxiv_tools.mjs search "world model" --size 50 --since 2026-01-01
//   node scripts/arxiv_tools.mjs search "JEPA" --json > results.json
//   node scripts/arxiv_tools.mjs parse /tmp/wm_all.html --since 2025-01-01
//
// 说明: 本机 Node 的 fetch 在 Windows 上可能因证书吊销检查失败,
// 因此统一通过 curl --ssl-no-revoke 取回页面。

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const command = args[0];

function option(name, fallback) {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
}
const hasFlag = (name) => args.includes(name);

function decodeEntities(s) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&hellip;/g, "...")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseResults(html) {
  const chunks = html.split('<li class="arxiv-result">').slice(1);
  return chunks.map((chunk) => {
    const id = (chunk.match(/arxiv\.org\/abs\/(\d{4}\.\d{4,5})/) || [])[1] || "";
    const title = decodeEntities(
      (chunk.match(/<p class="title is-5 mathjax">([\s\S]*?)<\/p>/) || [])[1] || ""
    );
    const abstract = decodeEntities(
      (chunk.match(/class="abstract-full[^"]*"[^>]*>([\s\S]*?)<a class="is-size-7"/) || [])[1] || ""
    );
    const submitted = (chunk.match(/<span class="has-text-black-bis has-text-weight-semibold">Submitted<\/span>\s*([^;]+);/) || [])[1] || "";
    const authors = decodeEntities(
      (chunk.match(/<p class="authors">([\s\S]*?)<\/p>/) || [])[1] || ""
    ).replace(/^Authors:\s*/, "");
    const comments = decodeEntities(
      (chunk.match(/<p class="comments is-size-7">([\s\S]*?)<\/p>/) || [])[1] || ""
    ).replace(/^Comments:\s*/, "");
    return { id, title, authors, submitted: submitted.trim(), abstract, comments };
  }).filter((r) => r.id && r.title);
}

function toDate(s) {
  const m = s.match(/(\d{1,2}) (\w+), (\d{4})/);
  if (!m) return "";
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const mm = String(months.indexOf(m[2]) + 1).padStart(2, "0");
  return `${m[3]}-${mm}-${m[1].padStart(2, "0")}`;
}

function renderMarkdown(rows) {
  const out = [];
  for (const r of rows) {
    out.push(`### ${r.title}`);
    out.push(`- arXiv: [${r.id}](https://arxiv.org/abs/${r.id})`);
    out.push(`- Submitted: ${toDate(r.submitted) || r.submitted}`);
    if (r.authors) out.push(`- Authors: ${r.authors}`);
    if (r.comments) out.push(`- Comments: ${r.comments}`);
    if (r.abstract) out.push(`- Abstract: ${r.abstract}`);
    out.push("");
  }
  return out.join("\n");
}

const query = args.slice(1).filter((a) => !a.startsWith("--") && a !== option("--size", "") && a !== option("--since", "")).join(" ");
const size = option("--size", "50");
const since = option("--since", "");
const asJson = hasFlag("--json");
const VALID_SIZES = ["25", "50", "100", "200"];

let html = "";
if (command === "search") {
  if (!query) {
    console.error('用法: node scripts/arxiv_tools.mjs search "world model" [--size 50] [--since 2026-01-01] [--json]');
    process.exit(2);
  }
  if (!VALID_SIZES.includes(String(size))) {
    console.error(`--size 必须是 ${VALID_SIZES.join("/")} 之一(arXiv 只接受这些档位)`);
    process.exit(2);
  }
  const url = `https://arxiv.org/search/?searchtype=all&order=-announced_date_first&size=${size}&query=${encodeURIComponent(query)}`;
  html = execFileSync("curl", ["-sL", "--ssl-no-revoke", "-m", "60", "-A", "Mozilla/5.0", url], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
} else if (command === "parse") {
  const file = args[1];
  if (!file) {
    console.error("用法: node scripts/arxiv_tools.mjs parse <html-file> [--since 2026-01-01] [--json]");
    process.exit(2);
  }
  html = readFileSync(file, "utf8");
} else {
  console.error("未知命令。支持: search | parse");
  process.exit(2);
}

let rows = parseResults(html).map((r) => ({ ...r, date: toDate(r.submitted) }));
if (since) rows = rows.filter((r) => r.date >= since);
rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

if (asJson) {
  process.stdout.write(JSON.stringify(rows, null, 2));
} else {
  console.log(renderMarkdown(rows));
  console.error(`共 ${rows.length} 条结果`);
}
