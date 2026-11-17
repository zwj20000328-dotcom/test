#!/usr/bin/env node
// 检查 Markdown 内部相对链接是否有效。
// 用法: node scripts/check_links.mjs

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

const files = [path.join(ROOT, "README.md"), ...walk(path.join(ROOT, "docs"))].filter(existsSync);
const errors = [];

for (const file of files) {
  const raw = readFileSync(file, "utf8");
  const text = raw.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "");
  const re = /\[[^\]]*\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(text))) {
    let target = m[1].trim();
    if (!target || target.startsWith("#") || target.startsWith("http://") || target.startsWith("https://") || target.startsWith("mailto:")) continue;
    target = target.split("#")[0].split("?")[0];
    if (!target) continue;
    const resolved = path.resolve(path.dirname(file), decodeURIComponent(target));
    if (!existsSync(resolved)) {
      errors.push(`${path.relative(ROOT, file)} -> ${target}`);
    }
  }
}

if (errors.length) {
  console.error(`发现 ${errors.length} 个失效链接:`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log(`检查 ${files.length} 个 Markdown 文件,未发现失效内部链接。`);
