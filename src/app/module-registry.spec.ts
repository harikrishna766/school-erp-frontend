import { MODULE_IDS, NAV_GROUP_ORDER } from './core/modules/module-def';
import { APP_MODULES } from './module-registry';

describe('module registry', () => {
  it('registers every licensable module exactly once', () => {
    expect(APP_MODULES.map((m) => m.id).sort()).toEqual([...MODULE_IDS].sort());
  });

  it('has unique, URL-safe paths', () => {
    const paths = APP_MODULES.map((m) => m.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) {
      expect(path).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it('uses module:resource:action permissions scoped to the module', () => {
    for (const m of APP_MODULES) {
      expect(m.viewPermission).toMatch(/^[a-z-]+:[a-z-]+:[a-z-]+$/);
      expect(m.viewPermission.startsWith(`${m.id}:`)).toBe(true);
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
