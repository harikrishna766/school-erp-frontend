#!/usr/bin/env node
/** Fails if en/te/hi translation files don't have exactly the same keys. */
import { readFileSync } from 'node:fs';

const LANGS = ['en', 'te', 'hi'];
const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
const keys = Object.fromEntries(
  LANGS.map((l) => [
    l,
    new Set(flatten(JSON.parse(readFileSync(`public/i18n/${l}.json`, 'utf8')))),
  ]),
);
let ok = true;
for (const lang of LANGS.slice(1)) {
  const missing = [...keys.en].filter((k) => !keys[lang].has(k));
  const extra = [...keys[lang]].filter((k) => !keys.en.has(k));
  if (missing.length || extra.length) {
    ok = false;
    console.error(
      `i18n ${lang}: missing ${missing.join(', ') || '-'}; extra ${extra.join(', ') || '-'}`,
    );
  }
}
console.log(
  ok ? `i18n: ${keys.en.size} keys in ${LANGS.join('/')}, all in sync` : 'i18n: out of sync',
);
process.exit(ok ? 0 : 1);
