#!/usr/bin/env node
/**
 * Exports school-erp-backend's OpenAPI document WITHOUT a running backend, database or
 * Redis, into openapi/school-erp-api.json. Use `npm run api:fetch` instead when the
 * backend is running.
 *
 * How: builds the backend with its own Nest CLI (so the @nestjs/swagger plugin metadata
 * is included) into a temp dir, then boots AppModule in Nest *preview* mode, which
 * resolves the module graph without instantiating providers, and applies the same
 * global prefix + URI versioning as app.setup.ts.
 *
 *   BACKEND_DIR=../school-erp-backend npm run api:export
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

const backend = resolve(process.env.BACKEND_DIR ?? '../school-erp-backend');
const out = resolve('openapi/school-erp-api.json');
const work = mkdtempSync(join(tmpdir(), 'erp-openapi-'));
const dist = join(work, 'dist');

writeFileSync(
  join(work, 'tsconfig.json'),
  JSON.stringify({
    extends: join(backend, 'tsconfig.build.json'),
    compilerOptions: { outDir: dist, rootDir: join(backend, 'src'), sourceMap: false, types: [] },
  }),
);
const nestCli = JSON.parse(
  execFileSync('node', [
    '-e',
    `process.stdout.write(require('fs').readFileSync('${join(backend, 'nest-cli.json')}','utf8'))`,
  ]),
);
nestCli.compilerOptions = {
  ...nestCli.compilerOptions,
  tsConfigPath: join(work, 'tsconfig.json'),
  allowOutsidePaths: true,
};
writeFileSync(join(work, 'nest-cli.json'), JSON.stringify(nestCli));

console.log(`api:export: building ${backend} → ${dist}`);
try {
  execFileSync('npx', ['nest', 'build', '-c', relative(backend, join(work, 'nest-cli.json'))], {
    cwd: backend,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
} catch {
  // Type-only errors still emit JavaScript (noEmitOnError is off); the boot below decides.
}

const exporter = `
const { NestFactory } = require('@nestjs/core');
const { RequestMethod, VersioningType } = require('@nestjs/common');
const { DocumentBuilder, SwaggerModule } = require('@nestjs/swagger');
(async () => {
  const { AppModule } = require(${JSON.stringify(join(dist, 'app.module.js'))});
  const app = await NestFactory.create(AppModule, { preview: true, logger: ['error'], abortOnError: false });
  app.setGlobalPrefix('api', { exclude: [{ path: 'metrics', method: RequestMethod.GET }] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  const doc = SwaggerModule.createDocument(app, new DocumentBuilder()
    .setTitle('School ERP API')
    .setDescription('Multi-tenant School Management System. All responses use the standard envelope.')
    .setVersion('1.0').addBearerAuth().build());
  require('fs').writeFileSync(${JSON.stringify(out)}, JSON.stringify(doc, null, 2) + '\\n');
  console.log('api:export: ' + Object.keys(doc.paths).length + ' paths, ' +
    Object.keys(doc.components?.schemas ?? {}).length + ' schemas → ${relative(process.cwd(), out)}');
  await app.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });`;

// Throwaway values that satisfy the backend's env schema; preview mode connects to nothing.
execFileSync('node', ['-e', exporter], {
  cwd: backend,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    NODE_PATH: join(backend, 'node_modules'),
    DATABASE_URL: 'postgresql://export:export@localhost:5432/export',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: 'x'.repeat(48),
    AUTH_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
    SWAGGER_ENABLED: 'true',
  },
  timeout: 120_000,
});
