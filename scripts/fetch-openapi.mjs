#!/usr/bin/env node
/**
 * Snapshots the backend's OpenAPI document into openapi/school-erp-api.json.
 * The snapshot is committed so the client can be regenerated (and verified in CI)
 * without a running backend.
 *
 *   OPENAPI_URL=https://staging.example.com/api/docs-json npm run api:fetch
 */
import { writeFileSync } from 'node:fs';

const url = process.env.OPENAPI_URL ?? 'http://localhost:3000/api/docs-json';
const res = await fetch(url).catch((err) => {
  console.error(`api:fetch: cannot reach ${url} (${err.message}). Is school-erp-backend running?`);
  process.exit(1);
});
if (!res.ok) {
  console.error(`api:fetch: ${url} → HTTP ${res.status}`);
  process.exit(1);
}
const spec = await res.json();
writeFileSync('openapi/school-erp-api.json', `${JSON.stringify(spec, null, 2)}\n`);
console.log(`api:fetch: saved ${Object.keys(spec.paths ?? {}).length} paths from ${url}`);
