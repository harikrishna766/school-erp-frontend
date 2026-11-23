import { PREF_KEYS, prefs } from '../storage/local-storage';

/**
 * Stable per-browser id sent at login/refresh so the backend can list sessions by device
 * and let users revoke them. Not a secret.
 */
export function deviceId(): string {
  let id = prefs.get(PREF_KEYS.deviceId);
  if (!id) {
    id = crypto.randomUUID();
    prefs.set(PREF_KEYS.deviceId, id);
  }
  return id;
}

/** Human label for the sessions list, e.g. "Chrome on Android". Best effort. */
export function deviceName(): string {
  const ua = globalThis.navigator?.userAgent ?? '';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser';
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'unknown OS';
  return `${browser} on ${os}`.slice(0, 100);
}
