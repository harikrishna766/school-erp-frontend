import { delay, http } from 'msw';
import { normalizeIndianMobile } from '../../app/shared/forms/validators';
import { DEMO_CODE, MOCK_USERS, type MockUser } from '../data/users';
import { fail, ok } from '../envelope';
import { buildAccess } from './access';
import {
  clearFailures,
  endSession,
  failureCount,
  issueAccessToken,
  recordFailure,
  rotate,
  startSession,
  verifyAccessToken,
} from './session-store';

const api = (path: string): string => `*/api/v1${path}`;
const pathOf = (request: Request): string => new URL(request.url).pathname;

const MAX_FAILURES = 5;

/** Pending OTP / 2FA challenges (in memory: a reload starts a new challenge). */
const challenges = new Map<string, { userId: string | null; purpose: 'LOGIN' | 'TWO_FACTOR' }>();

function findByIdentifier(identifier: string): MockUser | undefined {
  const value = identifier.trim().toLowerCase();
  const phone = normalizeIndianMobile(value);
  return MOCK_USERS.find((u) => u.email === value || (phone !== null && u.phone === phone));
}

function signIn(user: MockUser) {
  startSession(user.id);
  return issueAccessToken(user.id);
}

/** Resolves the bearer token to a user, or null (→ 401). Shared by every mock API. */
export function currentUser(request: Request): MockUser | null {
  const id = verifyAccessToken(request.headers.get('Authorization'));
  return MOCK_USERS.find((u) => u.id === id) ?? null;
}

export const authHandlers = [
  http.post(api('/auth/login'), async ({ request }) => {
    await delay(300);
    const body = (await request.json()) as { identifier?: string; password?: string };
    const identifier = (body.identifier ?? '').trim().toLowerCase();
    if (failureCount(identifier) >= MAX_FAILURES) {
      return fail(429, 'RATE_LIMITED', 'Too many failed attempts', pathOf(request));
    }
    const user = findByIdentifier(identifier);
    if (!user || user.password === null || user.password !== body.password) {
      recordFailure(identifier);
      return fail(401, 'UNAUTHENTICATED', 'Invalid credentials', pathOf(request));
    }
    if (user.status === 'DISABLED') {
      return fail(403, 'FORBIDDEN', 'Account disabled', pathOf(request));
    }
    clearFailures(identifier);
    if (user.twoFactor) {
      const challengeId = crypto.randomUUID();
      challenges.set(challengeId, { userId: user.id, purpose: 'TWO_FACTOR' });
      return ok({ status: 'TWO_FACTOR_REQUIRED', challengeId });
    }
    return ok({ status: 'AUTHENTICATED', ...signIn(user) });
  }),

  http.post(api('/auth/2fa/verify'), async ({ request }) => {
    await delay(200);
    const { challengeId, code } = (await request.json()) as { challengeId: string; code: string };
    const challenge = challenges.get(challengeId);
    const user = MOCK_USERS.find((u) => u.id === challenge?.userId);
    if (!challenge || challenge.purpose !== 'TWO_FACTOR' || !user || code !== DEMO_CODE) {
      return fail(401, 'UNAUTHENTICATED', 'Invalid code', pathOf(request));
    }
    challenges.delete(challengeId);
    return ok(signIn(user));
  }),

  // Always succeeds, whether or not the number is registered (no account enumeration).
  http.post(api('/auth/otp/request'), async ({ request }) => {
    await delay(300);
    const { phone } = (await request.json()) as { phone: string };
    const user = MOCK_USERS.find((u) => u.phone === phone && u.type === 'PARENT');
    const challengeId = crypto.randomUUID();
    challenges.set(challengeId, { userId: user?.id ?? null, purpose: 'LOGIN' });
    const resendAfter = Number(localStorage.getItem('msw.otpResendAfter') ?? 30);
    return ok({ challengeId, expiresIn: 300, resendAfter });
  }),

  http.post(api('/auth/otp/verify'), async ({ request }) => {
    await delay(200);
    const { challengeId, code } = (await request.json()) as { challengeId: string; code: string };
    const challenge = challenges.get(challengeId);
    const user = MOCK_USERS.find((u) => u.id === challenge?.userId);
    if (!challenge || challenge.purpose !== 'LOGIN' || !user || code !== DEMO_CODE) {
      return fail(401, 'UNAUTHENTICATED', 'Invalid code', pathOf(request));
    }
    challenges.delete(challengeId);
    return ok(signIn(user));
  }),

  http.post(api('/auth/refresh'), async ({ request }) => {
    await delay(100);
    const result = rotate();
    if (!result.ok) {
      return fail(401, 'UNAUTHENTICATED', `Refresh failed: ${result.reason}`, pathOf(request));
    }
    return ok(issueAccessToken(result.userId));
  }),

  http.post(api('/auth/logout'), () => {
    endSession();
    return ok(null);
  }),

  http.get(api('/me/access'), async ({ request }) => {
    await delay(150);
    const user = currentUser(request);
    return user
      ? ok(buildAccess(user))
      : fail(401, 'UNAUTHENTICATED', 'Missing or expired token', pathOf(request));
  }),
];
