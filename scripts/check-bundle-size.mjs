#!/usr/bin/env node
/**
 * Enforces the performance budget from the brief: initial bundle < 300 KB gzipped.
 * Angular's own budgets measure raw bytes; this measures what the browser must download
 * before first render: index.html, its stylesheets, its entry scripts (plain <script src>
 * or the autoCsp loader array) and every chunk those scripts import *statically*.
 * Lazy `import()` chunks are excluded by design.
 *
 * Usage: node scripts/check-bundle-size.mjs [distDir] [limitKB]
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = process.argv[2] ?? 'dist/school-erp-frontend/browser';
const limitKb = Number(process.argv[3] ?? 300);
const gz = (buf) => gzipSync(buf, { level: 9 }).length;

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const local = (ref) => !/^(https?:)?\/\//.test(ref) && existsSync(join(dist, ref));

const entries = new Set();
const patterns = [
  /<script[^>]+src="([^"]+)"/g, // classic
  /\[\s*'([^']+\.js)'\s*,\s*"module"/g, // autoCsp loader: [['main-X.js', "module", …]]
  /<link[^>]+rel="(?:modulepreload|stylesheet)"[^>]*href="([^"]+)"/g,
  /<link[^>]+href="([^"]+)"[^>]*rel="(?:modulepreload|stylesheet)"/g,
];
for (const re of patterns) {
  for (const [, ref] of html.matchAll(re)) if (local(ref)) entries.add(ref);
}

// Follow static imports: `import{a}from"./chunk-X.js"`, `export*from"./x.js"`, `import"./x.js"`.
const STATIC_IMPORT = /(?:\bfrom\s*|\bimport\s*)["']\.\/([^"']+\.js)["']/g;
const files = new Set(entries);
const queue = [...entries].filter((f) => f.endsWith('.js'));
while (queue.length > 0) {
  const file = queue.pop();
  for (const [, dep] of readFileSync(join(dist, file), 'utf8').matchAll(STATIC_IMPORT)) {
    if (!files.has(dep) && local(dep)) {
      files.add(dep);
      queue.push(dep);
    }
  }
}

if (![...files].some((f) => f.endsWith('.js'))) {
  console.error('size:check found no entry JavaScript in index.html; the parser needs updating.');
  process.exit(1);
}

let total = gz(html);
const rows = [['index.html (incl. inlined CSS)', total]];
for (const file of files) {
  const bytes = gz(readFileSync(join(dist, file)));
  total += bytes;
  rows.push([file, bytes]);
}

for (const [name, bytes] of rows)
  console.log(`${(bytes / 1024).toFixed(1).padStart(8)} KB  ${name}`);
const totalKb = total / 1024;
console.log(`${totalKb.toFixed(1).padStart(8)} KB  TOTAL initial (gzip)  — budget ${limitKb} KB`);
if (totalKb > limitKb) {
  console.error('Initial bundle exceeds the gzip budget.');
  process.exit(1);
}
