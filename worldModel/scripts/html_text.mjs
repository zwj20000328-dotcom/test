#!/usr/bin/env node
// 从本地 HTML 提取可读文本，用于调研资料摘要。
// 用法: node scripts/html_text.mjs <file.html> [maxChars]

import { readFileSync } from "node:fs";

const file = process.argv[2];
const maxChars = Number(process.argv[3] || 12000);
if (!file) {
  console.error("用法: node scripts/html_text.mjs <file.html> [maxChars]");
  process.exit(2);
}

const html = readFileSync(file, "utf8");
const text = html
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"')
  .replace(/&#x27;|&#39;/g, "'")
  .replace(/&mdash;/g, "—")
  .replace(/&ndash;/g, "–")
  .replace(/&hellip;/g, "...")
  .replace(/\s+/g, " ")
  .trim();

console.log(text.slice(0, maxChars));
