import { MODULE_IDS, NAV_GROUP_ORDER } from './core/modules/module-def';
import { APP_MODULES } from './module-registry';
import { MODULE_KEYS } from '../mocks/data/backend-catalog/modules.catalog';
import { PERMISSIONS } from '../mocks/data/backend-catalog/permissions.catalog';

/*
 * The backend catalog is vendored by `npm run catalog:sync`; these tests make the
 * frontend registry fail fast when it drifts from the backend's module/permission keys.
 */
describe('module registry', () => {
  it('uses exactly the backend module keys', () => {
    expect([...MODULE_IDS].sort()).toEqual([...MODULE_KEYS].sort());
  });

  it('registers every module exactly once', () => {
    expect(APP_MODULES.map((m) => m.id).sort()).toEqual([...MODULE_IDS].sort());
  });

  it('has unique, URL-safe paths', () => {
    const paths = APP_MODULES.map((m) => m.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) {
      expect(path).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it('only gates on permissions that exist in the backend catalog, scoped to the module', () => {
    const known = new Set(PERMISSIONS.map((p) => p.key as string));
    for (const m of APP_MODULES) {
      expect(m.viewPermissions.length, m.id).toBeGreaterThan(0);
      for (const permission of m.viewPermissions) {
        expect(known.has(permission), `${m.id}: ${permission}`).toBe(true);
        expect(permission.startsWith(`${m.id}:`), `${m.id}: ${permission}`).toBe(true);
      }
    }
  });

  it('only uses known nav groups and unique bottom-bar priorities', () => {
    const priorities = APP_MODULES.flatMap((m) => m.mobilePriority ?? []);
    expect(new Set(priorities).size).toBe(priorities.length);
    for (const m of APP_MODULES) {
      expect(NAV_GROUP_ORDER).toContain(m.group);
    }
  });

  it('lazy-loads a default-exported routes array for every module', async () => {
    for (const m of APP_MODULES) {
      const loaded = (await m.loadChildren()) as unknown;
      const routes = (loaded as { default?: unknown }).default ?? loaded;
      expect(Array.isArray(routes), `${m.id} routes`).toBe(true);
    }
  });
});
