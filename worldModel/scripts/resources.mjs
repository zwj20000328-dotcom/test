#!/usr/bin/env node
// 项目资源管理:校验 catalog.yaml 并生成 INDEX.md。
// 用法:
//   node scripts/resources.mjs validate
//   node scripts/resources.mjs index [--check]
//   node scripts/resources.mjs stats

import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG = path.join(ROOT, "docs", "03-resources", "catalog.yaml");
const INDEX = path.join(ROOT, "docs", "03-resources", "INDEX.md");

const ENUMS = {
  type: ["paper", "survey", "blog", "repo", "benchmark", "dataset", "spec", "talk"],
  route: [
    "foundation",
    "video-gen",
    "latent-predictive",
    "model-based-rl",
    "3d-scene",
    "wam",
    "interactive",
    "driving",
    "embodied",
    "evaluation",
    "narrative",
    "survey",
  ],
  status: ["inbox", "skimmed", "read", "verified", "archived"],
  confidence: ["A", "B", "C"],
  priority: ["P0", "P1", "P2"],
};

const ROUTE_LABELS = {
  foundation: "基础与综述",
  "video-gen": "视频生成式",
  "latent-predictive": "潜空间预测 (JEPA)",
  "model-based-rl": "模型基强化学习",
  "3d-scene": "3D / 场景表示",
  wam: "世界-动作模型 (WAM)",
  interactive: "交互式世界模型",
  driving: "自动驾驶",
  embodied: "具身智能",
  evaluation: "评测与基准",
  narrative: "叙事 / 内容生成",
  survey: "综述",
};

const TYPE_LABELS = {
  paper: "论文",
  survey: "综述",
  blog: "博客",
  repo: "代码",
  benchmark: "基准",
  dataset: "数据集",
  spec: "规范",
  talk: "演讲",
};

// ---- 极简 YAML 子集解析器 -------------------------------------------------
// 仅支持本项目 catalog 使用的结构:顶层列表 + 标量字段 + 行内数组 [a, b]。
// 不支持多行字符串、锚点、嵌套映射;这是刻意为之,以保证零依赖与可预测性。

function splitValue(raw) {
  const s = raw.trim();
  if (s === "") return "";
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
  }
  if (s.startsWith("[") && s.endsWith("]")) {
    return s
      .slice(1, -1)
      .split(",")
      .map((x) => splitValue(x))
      .filter((x) => x !== "");
  }
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null" || s === "~") return null;
  if (/^-?\d+$/.test(s)) return Number(s);
  if (/^-?\d+\.\d+$/.test(s)) return Number(s);
  return s;
}

function parseYaml(text) {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((line, i) => ({ raw: line, no: i + 1 }))
    .filter(({ raw }) => raw.trim() !== "" && !raw.trim().startsWith("#"));

  let cursor = 0;

  function indentOf(line) {
    return line.raw.match(/^ */)[0].length;
  }

  function parseBlock(indent) {
    if (cursor >= lines.length) return null;
    const first = lines[cursor];
    if (indentOf(first) < indent) return null;

    if (first.raw.trim().startsWith("- ")) {
      const arr = [];
      while (cursor < lines.length) {
        const line = lines[cursor];
        if (indentOf(line) !== indent || !line.raw.trim().startsWith("- ")) break;
        const content = line.raw.trim().slice(2);
        cursor += 1;
        if (content === "") {
          arr.push(parseBlock(indent + 2));
          continue;
        }
        const kv = content.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
        if (kv) {
          const obj = {};
          obj[kv[1]] = splitValue(kv[2]);
          while (cursor < lines.length) {
            const next = lines[cursor];
            if (indentOf(next) <= indent) break;
            const m = next.raw.trim().match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
            if (!m) throw new Error(`第 ${next.no} 行:无法解析 "${next.raw.trim()}"`);
            cursor += 1;
            obj[m[1]] = splitValue(m[2]);
          }
          arr.push(obj);
        } else {
          arr.push(splitValue(content));
        }
      }
      return arr;
    }

    const obj = {};
    while (cursor < lines.length) {
      const line = lines[cursor];
      if (indentOf(line) !== indent) break;
      const m = line.raw.trim().match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (!m) throw new Error(`第 ${line.no} 行:无法解析 "${line.raw.trim()}"`);
      cursor += 1;
      obj[m[1]] = splitValue(m[2]);
    }
    return obj;
  }

  const value = parseBlock(0);
  if (cursor < lines.length) {
    throw new Error(`第 ${lines[cursor].no} 行:缩进或结构不符合预期`);
  }
  return value;
}

// ---- 校验 -----------------------------------------------------------------

function validate(resources) {
  const errors = [];
  const warnings = [];
  const seen = new Set();

  if (!Array.isArray(resources)) {
    return { errors: ["catalog.yaml 顶层必须是列表"], warnings };
  }

  const required = ["id", "title", "type", "route", "year", "url", "status", "confidence", "priority", "summary", "added"];
  const idRe = /^WM-(PAPER|SURVEY|BLOG|REPO|BENCH|DATA|SPEC|TALK)-\d{3}$/;

  resources.forEach((r, i) => {
    const where = `第 ${i + 1} 条${r.id ? ` (${r.id})` : ""}`;
    for (const key of required) {
      if (r[key] === undefined || r[key] === "") errors.push(`${where}: 缺少必填字段 ${key}`);
    }
    if (r.id) {
      if (!idRe.test(r.id)) errors.push(`${where}: ID 格式应为 WM-<TYPE>-<NNN>,当前为 "${r.id}"`);
      if (seen.has(r.id)) errors.push(`${where}: 重复 ID "${r.id}"`);
      seen.add(r.id);
    }
    for (const key of ["type", "route", "status", "confidence", "priority"]) {
      if (r[key] && ENUMS[key] && !ENUMS[key].includes(r[key])) {
        errors.push(`${where}: ${key} 取值 "${r[key]}" 不在允许集合 [${ENUMS[key].join(", ")}] 中`);
      }
    }
    if (r.year && (!Number.isInteger(r.year) || r.year < 1900 || r.year > 2100)) {
      errors.push(`${where}: year 取值异常 "${r.year}"`);
    }
    if (r.url && !/^https?:\/\//.test(String(r.url))) {
      errors.push(`${where}: url 必须以 http(s):// 开头`);
    }
    if (r.arxiv && !/^\d{4}\.\d{4,5}$/.test(String(r.arxiv))) {
      warnings.push(`${where}: arxiv 编号格式可能不正确 "${r.arxiv}"`);
    }
    if (r.arxiv && r.url && String(r.url).includes("arxiv.org") && !String(r.url).includes(`/abs/${r.arxiv}`)) {
      errors.push(`${where}: url 与 arxiv 字段不一致`);
    }
    if (r.note) {
      const p = path.join(ROOT, r.note);
      if (!existsSync(p)) errors.push(`${where}: note 文件不存在 ${r.note}`);
      else if (!statSync(p).isFile()) errors.push(`${where}: note 路径不是文件 ${r.note}`);
    }
    if (r.status === "verified" && r.confidence === "C") {
      warnings.push(`${where}: 状态为 verified 但置信度为 C,建议复核`);
    }
    if (r.summary && String(r.summary).length > 220) {
      warnings.push(`${where}: summary 超过 220 字符,索引中会被截断`);
    }
    if (r.verify === true && r.status === "verified") {
      warnings.push(`${where}: 标记 verify: true 但状态为 verified,请确认`);
    }
  });

  return { errors, warnings };
}

// ---- 索引生成 -------------------------------------------------------------

function esc(s) {
  return String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

function truncate(s, n) {
  const str = String(s ?? "");
  return str.length <= n ? str : str.slice(0, n - 1) + "…";
}

function groupCount(resources, key) {
  const map = new Map();
  for (const r of resources) map.set(r[key], (map.get(r[key]) || 0) + 1);
  return [...map.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}

function renderIndex(resources) {
  const now = new Date().toISOString().slice(0, 10);
  const out = [];
  out.push("# 世界模型资源索引");
  out.push("");
  out.push("<!-- 本文件由 `node scripts/resources.mjs index` 自动生成,请勿手工编辑。 -->");
  out.push(`<!-- 生成时间: ${now} -->`);
  out.push("");
  out.push(`共收录 **${resources.length}** 条资源。`);
  out.push("");

  out.push("## 统计");
  out.push("");
  out.push("| 维度 | 分布 |");
  out.push("| --- | --- |");
  out.push(`| 类型 | ${groupCount(resources, "type").map(([k, v]) => `${TYPE_LABELS[k] || k} ${v}`).join(" · ")} |`);
  out.push(`| 路线 | ${groupCount(resources, "route").map(([k, v]) => `${ROUTE_LABELS[k] || k} ${v}`).join(" · ")} |`);
  out.push(`| 状态 | ${groupCount(resources, "status").map(([k, v]) => `${k} ${v}`).join(" · ")} |`);
  out.push(`| 置信度 | ${groupCount(resources, "confidence").map(([k, v]) => `${k} ${v}`).join(" · ")} |`);
  out.push("");

  const pending = resources.filter((r) => r.confidence === "C" || r.verify === true);
  out.push("## 待核实");
  out.push("");
  if (pending.length === 0) {
    out.push("暂无。");
  } else {
    out.push("以下条目来自二手信息、未能直接访问的来源,或明确标记需要复核。使用前请先核对原文。");
    out.push("");
    out.push("| ID | 标题 | 来源 | 待核实原因 |");
    out.push("| --- | --- | --- | --- |");
    for (const r of pending) {
      out.push(`| ${esc(r.id)} | ${esc(r.title)} | ${esc(r.org || "")} | ${esc(r.verify_reason || "置信度 C / 标记 verify")} |`);
    }
  }
  out.push("");

  const queue = resources
    .filter((r) => ["inbox", "skimmed"].includes(r.status))
    .sort((a, b) => String(a.priority).localeCompare(String(b.priority)) || Number(b.year) - Number(a.year));
  out.push("## 阅读队列");
  out.push("");
  if (queue.length === 0) {
    out.push("队列为空。");
  } else {
    out.push("| 优先级 | ID | 标题 | 状态 | 一句话 |");
    out.push("| --- | --- | --- | --- | --- |");
    for (const r of queue) {
      out.push(`| ${esc(r.priority)} | ${esc(r.id)} | [${esc(r.title)}](${r.url}) | ${esc(r.status)} | ${esc(truncate(r.summary, 80))} |`);
    }
  }
  out.push("");

  out.push("## 全部资源");
  out.push("");
  const routes = groupCount(resources, "route").map(([k]) => k);
  for (const route of routes) {
    out.push(`### ${ROUTE_LABELS[route] || route}`);
    out.push("");
    out.push("| ID | 年份 | 标题 | 类型 | 状态 | 置信度 | 摘要 |");
    out.push("| --- | --- | --- | --- | --- | --- | --- |");
    const items = resources
      .filter((r) => r.route === route)
      .sort((a, b) => Number(b.year) - Number(a.year) || String(a.id).localeCompare(String(b.id)));
    for (const r of items) {
      const noteHref = r.note
        ? path.relative(path.dirname(INDEX), path.join(ROOT, r.note)).split(path.sep).join("/")
        : "";
      const title = r.note
        ? `[${esc(r.title)}](${r.url}) · [笔记](${noteHref})`
        : `[${esc(r.title)}](${r.url})`;
      out.push(
        `| ${esc(r.id)} | ${esc(r.year)} | ${title} | ${TYPE_LABELS[r.type] || esc(r.type)} | ${esc(r.status)} | ${esc(r.confidence)} | ${esc(truncate(r.summary, 90))} |`
      );
    }
    out.push("");
  }

  return out.join("\n").trimEnd() + "\n";
}

// ---- 命令 -----------------------------------------------------------------

function load() {
  if (!existsSync(CATALOG)) {
    console.error(`找不到 catalog: ${CATALOG}`);
    process.exit(2);
  }
  let resources;
  try {
    resources = parseYaml(readFileSync(CATALOG, "utf8"));
  } catch (err) {
    console.error(`解析 catalog.yaml 失败: ${err.message}`);
    process.exit(2);
  }
  return resources;
}

function report({ errors, warnings }) {
  for (const w of warnings) console.warn(`WARN  ${w}`);
  for (const e of errors) console.error(`ERROR ${e}`);
  console.log(`校验完成: ${errors.length} 个错误,${warnings.length} 个警告。`);
  return errors.length === 0;
}

const command = process.argv[2] || "validate";
const resources = load();

if (command === "validate") {
  process.exit(report(validate(resources)) ? 0 : 1);
} else if (command === "stats") {
  const v = validate(resources);
  report(v);
  console.log("");
  console.log("类型:", Object.fromEntries(groupCount(resources, "type")));
  console.log("路线:", Object.fromEntries(groupCount(resources, "route")));
  console.log("状态:", Object.fromEntries(groupCount(resources, "status")));
  console.log("置信度:", Object.fromEntries(groupCount(resources, "confidence")));
  process.exit(v.errors.length === 0 ? 0 : 1);
} else if (command === "index") {
  const v = validate(resources);
  const ok = report(v);
  if (!ok) {
    console.error("存在校验错误,未写入 INDEX.md。");
    process.exit(1);
  }
  const content = renderIndex(resources);
  if (process.argv.includes("--check")) {
    const current = existsSync(INDEX) ? readFileSync(INDEX, "utf8") : "";
    if (current !== content) {
      console.error("INDEX.md 与 catalog.yaml 不一致,请运行 `npm run resources:index` 重新生成。");
      process.exit(1);
    }
    console.log("INDEX.md 已是最新。");
    process.exit(0);
  }
  writeFileSync(INDEX, content, "utf8");
  console.log(`已生成 ${path.relative(ROOT, INDEX)}`);
  process.exit(0);
} else {
  console.error("未知命令。支持: validate | index [--check] | stats");
  process.exit(2);
}
