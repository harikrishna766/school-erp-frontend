/**
 * localStorage wrapper that never throws (private mode, disabled storage, quota).
 * Only for small UI preferences — never for tokens or business data.
 */
export const prefs = {
  get(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* preference is simply not persisted */
    }
  },
};

export const PREF_KEYS = {
  theme: 'erp.theme',
  language: 'erp.lang',
  navCollapsed: 'erp.nav.collapsed',
  schoolCode: 'erp.school',
  deviceId: 'erp.device',
} as const;
