/**
 * Mock server-side session state. Persisted in localStorage so it survives reloads and
 * is shared across tabs, like the real httpOnly refresh cookie + user_sessions table.
 * `cookie` stands in for the browser's cookie jar (MSW can't set httpOnly cookies).
 */
interface MockSession {
  readonly userId: string;
  readonly familyId: string;
  revoked: false | 'ROTATED' | 'LOGOUT' | 'REUSE_DETECTED';
}

interface Store {
  cookie: string | null;
  sessions: Record<string, MockSession>;
  failures: Record<string, number>;
}

const KEY = 'msw.auth';
/** Overridable from e2e: `localStorage.setItem('msw.accessTtl', '2')`. */
const TTL_KEY = 'msw.accessTtl';

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      return JSON.parse(raw) as Store;
    }
  } catch {
    /* fall through */
  }
  return { cookie: null, sessions: {}, failures: {} };
}

function save(store: Store): void {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function accessTtlSeconds(): number {
  const raw = Number(localStorage.getItem(TTL_KEY));
  return Number.isFinite(raw) && raw > 0 ? raw : 900;
}

export function issueAccessToken(userId: string): { accessToken: string; expiresIn: number } {
  const expiresIn = accessTtlSeconds();
  const exp = Date.now() + expiresIn * 1000;
  return { accessToken: `mock-at.${userId}.${exp}.${crypto.randomUUID()}`, expiresIn };
}

/** Returns the user id for a valid, unexpired bearer token, else null. */
export function verifyAccessToken(header: string | null): string | null {
  const match = /^Bearer mock-at\.([^.]+)\.(\d+)\./.exec(header ?? '');
  if (!match || Number(match[2]) < Date.now()) {
    return null;
  }
  // A token outlives logout only until expiry, as with real JWTs; but the mock also
  // rejects tokens whose family was revoked, to make revocation observable in e2e.
  const store = load();
  const alive = Object.values(store.sessions).some((s) => s.userId === match[1] && !s.revoked);
  return alive ? match[1] : null;
}

export function startSession(userId: string): void {
  const store = load();
  const token = crypto.randomUUID();
  store.sessions[token] = { userId, familyId: crypto.randomUUID(), revoked: false };
  store.cookie = token;
  save(store);
}

export type RefreshResult = { ok: true; userId: string } | { ok: false; reason: string };

/** Rotates the refresh token. Presenting an already-rotated token revokes the family. */
export function rotate(): RefreshResult {
  const store = load();
  const current = store.cookie ? store.sessions[store.cookie] : undefined;
  if (!store.cookie || !current) {
    return { ok: false, reason: 'NO_SESSION' };
  }
  if (current.revoked === 'ROTATED') {
    for (const s of Object.values(store.sessions)) {
      if (s.familyId === current.familyId) s.revoked = 'REUSE_DETECTED';
    }
    store.cookie = null;
    save(store);
    return { ok: false, reason: 'REUSE_DETECTED' };
  }
  if (current.revoked) {
    return { ok: false, reason: current.revoked };
  }
  current.revoked = 'ROTATED';
  const next = crypto.randomUUID();
  store.sessions[next] = { userId: current.userId, familyId: current.familyId, revoked: false };
  store.cookie = next;
  save(store);
  return { ok: true, userId: current.userId };
}

export function endSession(): void {
  const store = load();
  if (store.cookie && store.sessions[store.cookie]) {
    store.sessions[store.cookie].revoked = 'LOGOUT';
  }
  store.cookie = null;
  save(store);
}

/** Returns the failure count after recording one more. */
export function recordFailure(identifier: string): number {
  const store = load();
  store.failures[identifier] = (store.failures[identifier] ?? 0) + 1;
  save(store);
  return store.failures[identifier];
}

export function failureCount(identifier: string): number {
  return load().failures[identifier] ?? 0;
}

export function clearFailures(identifier: string): void {
  const store = load();
  delete store.failures[identifier];
  save(store);
}
