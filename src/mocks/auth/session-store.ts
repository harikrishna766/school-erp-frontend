import type { TokensResponse } from '../../app/api/generated';

/**
 * Mock server-side auth state (user_sessions, lockouts, 2FA enrolment), persisted in
 * localStorage so it survives reloads and is shared across tabs like a real server.
 */
interface MockSession {
  readonly userId: string;
  readonly familyId: string;
  readonly sessionId: string;
  revoked: false | 'ROTATED' | 'LOGOUT' | 'REUSE_DETECTED';
}

interface Store {
  /** refresh token → session */
  sessions: Record<string, MockSession>;
  failures: Record<string, number>;
  twoFactorEnabled: Record<string, boolean>;
  pendingSecret: Record<string, string>;
}

const KEY = 'msw.auth';
/** Overridable from e2e: `localStorage.setItem('msw.accessTtl', '2')`. */
const TTL_KEY = 'msw.accessTtl';
const REFRESH_TTL_MS = 30 * 24 * 3600 * 1000;

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      return {
        sessions: {},
        failures: {},
        twoFactorEnabled: {},
        pendingSecret: {},
        ...JSON.parse(raw),
      };
    }
  } catch {
    /* fall through */
  }
  return { sessions: {}, failures: {}, twoFactorEnabled: {}, pendingSecret: {} };
}

function save(store: Store): void {
  localStorage.setItem(KEY, JSON.stringify(store));
}

function accessTtlSeconds(): number {
  const raw = Number(localStorage.getItem(TTL_KEY));
  return Number.isFinite(raw) && raw > 0 ? raw : 900;
}

function issue(userId: string, familyId: string, sessionId: string): TokensResponse {
  const store = load();
  const refreshToken = `mock-rt.${crypto.randomUUID()}`;
  store.sessions[refreshToken] = { userId, familyId, sessionId, revoked: false };
  save(store);
  const exp = Date.now() + accessTtlSeconds() * 1000;
  return {
    tokenType: 'Bearer' as TokensResponse['tokenType'],
    accessToken: `mock-at.${userId}.${sessionId}.${exp}`,
    accessTokenExpiresAt: new Date(exp).toISOString(),
    refreshToken,
    refreshTokenExpiresAt: new Date(Date.now() + REFRESH_TTL_MS).toISOString(),
    sessionId,
  };
}

export function startSession(userId: string): TokensResponse {
  return issue(userId, crypto.randomUUID(), crypto.randomUUID());
}

export type RotateResult =
  | { ok: true; tokens: TokensResponse }
  | { ok: false; code: 'TOKEN_INVALID' | 'REFRESH_TOKEN_REUSED' };

/** Rotates a refresh token. Re-using an already-rotated one revokes the whole family. */
export function rotate(refreshToken: string): RotateResult {
  const store = load();
  const current = store.sessions[refreshToken];
  if (!current) {
    return { ok: false, code: 'TOKEN_INVALID' };
  }
  if (current.revoked === 'ROTATED') {
    for (const s of Object.values(store.sessions)) {
      if (s.familyId === current.familyId) s.revoked = 'REUSE_DETECTED';
    }
    save(store);
    return { ok: false, code: 'REFRESH_TOKEN_REUSED' };
  }
  if (current.revoked) {
    return { ok: false, code: 'TOKEN_INVALID' };
  }
  current.revoked = 'ROTATED';
  save(store);
  return { ok: true, tokens: issue(current.userId, current.familyId, current.sessionId) };
}

/** Bearer token → { userId, sessionId } when valid, unexpired and its session is live. */
export function verifyAccessToken(
  header: string | null,
): { userId: string; sessionId: string } | null {
  const match = /^Bearer mock-at\.([^.]+)\.([^.]+)\.(\d+)$/.exec(header ?? '');
  if (!match || Number(match[3]) < Date.now()) {
    return null;
  }
  const [, userId, sessionId] = match;
  const live = Object.values(load().sessions).some((s) => s.sessionId === sessionId && !s.revoked);
  return live ? { userId, sessionId } : null;
}

export function revokeSession(sessionId: string): number {
  const store = load();
  let count = 0;
  for (const s of Object.values(store.sessions)) {
    if (s.sessionId === sessionId && !s.revoked) {
      s.revoked = 'LOGOUT';
      count = 1;
    }
  }
  save(store);
  return count;
}

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

export function isTwoFactorEnabled(userId: string, seeded: boolean): boolean {
  return load().twoFactorEnabled[userId] ?? seeded;
}

export function setPendingSecret(userId: string, secret: string): void {
  const store = load();
  store.pendingSecret[userId] = secret;
  save(store);
}

export function enableTwoFactor(userId: string): boolean {
  const store = load();
  if (!store.pendingSecret[userId]) {
    return false;
  }
  delete store.pendingSecret[userId];
  store.twoFactorEnabled[userId] = true;
  save(store);
  return true;
}
