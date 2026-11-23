#!/usr/bin/env node
/**
 * Material Symbols are loaded as a subset (`icon_names=` in src/index.html) to keep the
 * font small. This script finds every icon ligature used in the source and either
 * verifies the subset (`--check`, used in CI) or rewrites it (`--write`).
 *
 * Detected forms:  <mat-icon>name</mat-icon>  ·  icon: 'name'  ·  icon="name"
 * Dynamic names (`{{ cond ? 'a' : 'b' }}`) are picked up from quoted literals inside
 * mat-icon interpolations.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INDEX = 'src/index.html';
const ROOT = 'src';

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry !== 'mocks') yield* walk(path);
    } else if (/\.(ts|html)$/.test(entry) && !entry.endsWith('.spec.ts')) {
      yield path;
    }
  }
}

const NAME = /^[a-z0-9_]+$/;
const used = new Set();
for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8');
  for (const [, body] of src.matchAll(/<mat-icon[^>]*>([\s\S]*?)<\/mat-icon>/g)) {
    const text = body.trim();
    if (NAME.test(text)) used.add(text);
    for (const [, lit] of text.matchAll(/'([a-z0-9_]+)'/g)) used.add(lit);
  }
  for (const [, name] of src.matchAll(/\bicon:\s*'([a-z0-9_]+)'/g)) used.add(name);
  for (const [, name] of src.matchAll(/\bicon="([a-z0-9_]+)"/g)) used.add(name);
  for (const [, name] of src.matchAll(/\bicon = input\('([a-z0-9_]+)'\)/g)) used.add(name);
}

const wanted = [...used].sort();
const html = readFileSync(INDEX, 'utf8');
const match = /icon_names=([a-z0-9_,]*)/.exec(html);
if (!match) {
  console.error(`${INDEX}: no icon_names= parameter found`);
  process.exit(1);
}
const current = match[1].split(',').filter(Boolean);
const missing = wanted.filter((n) => !current.includes(n));

if (process.argv.includes('--write')) {
  writeFileSync(INDEX, html.replace(match[0], `icon_names=${wanted.join(',')}`));
  console.log(`icons: wrote ${wanted.length} names to ${INDEX}`);
} else if (missing.length > 0) {
  console.error(
    `icons: missing from ${INDEX} subset: ${missing.join(', ')}\nRun: npm run icons:sync`,
  );
  process.exit(1);
} else {
  console.log(`icons: ${wanted.length} used, all present in subset`);
}
