import { PREF_KEYS, prefs } from '../storage/local-storage';

/**
 * Stable per-browser id sent at login so the backend can label sessions
 * ("Chrome on Android") and let users revoke them. Not a secret.
 */
export function deviceId(): string {
  let id = prefs.get(PREF_KEYS.deviceId);
  if (!id) {
    id = crypto.randomUUID();
    prefs.set(PREF_KEYS.deviceId, id);
  }
  return id;
}
