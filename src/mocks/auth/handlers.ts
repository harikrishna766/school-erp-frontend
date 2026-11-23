import { delay, http } from 'msw';
import type {
  LoginDto,
  OtpRequestDto,
  OtpVerifyDto,
  RefreshDto,
  TwoFactorCodeDto,
  TwoFactorLoginDto,
} from '../../app/api/generated';
import {
  DEMO_CODE,
  DEMO_ORG,
  DEMO_RECOVERY_CODE,
  MOCK_USERS,
  REQUIRE_2FA_ROLES,
  type MockUser,
} from '../data/users';
import { type EnvelopeResponse, fail, ok } from '../envelope';
import { buildAccess } from './access';
import {
  clearFailures,
  enableTwoFactor,
  failureCount,
  isTwoFactorEnabled,
  recordFailure,
  revokeSession,
  rotate,
  setPendingSecret,
  startSession,
  verifyAccessToken,
} from './session-store';

/*
 * Mock of school-erp-backend's AuthController / MeController, typed with the generated
 * client's DTOs so the mock can't drift from the OpenAPI contract unnoticed.
 */

const api = (path: string): string => `*/api/v1${path}`;
const pathOf = (request: Request): string => new URL(request.url).pathname;

/** Backend default AUTH_LOCKOUT_THRESHOLD. */
const LOCKOUT_THRESHOLD = 5;

/** Pending 2FA login challenges (in memory: a reload restarts sign-in). */
const challenges = new Map<string, string>();

function orgMatches(user: MockUser, orgCode: string | undefined): boolean {
  return user.orgCode === null ? !orgCode : orgCode?.toLowerCase() === user.orgCode;
}

/**
 * Resolves the bearer token to a user (or a 401 response), applying the same rules as the
 * backend's JwtAuthGuard: x-tenant must match the token's org, and roles that require 2FA
 * are blocked (403 TWO_FACTOR_SETUP_REQUIRED) except on setup-allowed endpoints.
 */
export function authenticate(
  request: Request,
  options: { allowDuringTwoFactorSetup?: boolean } = {},
): { user: MockUser; sessionId: string } | EnvelopeResponse {
  const path = pathOf(request);
  const token = verifyAccessToken(request.headers.get('Authorization'));
  const user = MOCK_USERS.find((u) => u.id === token?.userId);
  if (!token || !user) {
    return fail(401, 'TOKEN_EXPIRED', 'Access token missing, invalid or expired', path);
  }
  const tenant = request.headers.get('x-tenant');
  if (tenant && user.orgCode && tenant.toLowerCase() !== user.orgCode) {
    return fail(403, 'TENANT_MISMATCH', 'Token does not belong to this organization', path);
  }
  const mustEnrol =
    !isTwoFactorEnabled(user.id, user.twoFactorEnabled === true) &&
    user.roles.some((r) => REQUIRE_2FA_ROLES.includes(r));
  if (mustEnrol && !options.allowDuringTwoFactorSetup) {
    return fail(403, 'TWO_FACTOR_SETUP_REQUIRED', 'Enrol via /auth/2fa/setup', path);
  }
  return { user, sessionId: token.sessionId };
}

const isResponse = (value: unknown): value is EnvelopeResponse => value instanceof Response;

export const authHandlers = [
  http.post(api('/auth/login'), async ({ request }) => {
    await delay(300);
    const body = (await request.json()) as LoginDto;
    const email = (body.email ?? '').trim().toLowerCase();
    const path = pathOf(request);
    if (body.orgCode && body.orgCode.toLowerCase() !== DEMO_ORG.code) {
      return fail(403, 'ORG_UNAVAILABLE', 'Organization not available', path);
    }
    if (failureCount(email) >= LOCKOUT_THRESHOLD) {
      return fail(423, 'ACCOUNT_LOCKED', 'Account temporarily locked', path);
    }
    const user = MOCK_USERS.find((u) => u.email === email);
    if (!user || !orgMatches(user, body.orgCode) || user.password !== body.password) {
      recordFailure(email);
      return fail(401, 'INVALID_CREDENTIALS', 'Invalid credentials', path);
    }
    if (user.status === 'DISABLED') {
      return fail(403, 'ACCOUNT_DISABLED', 'Account disabled', path);
    }
    clearFailures(email);
    if (isTwoFactorEnabled(user.id, user.twoFactorEnabled === true)) {
      const challengeToken = `mock-challenge.${crypto.randomUUID()}`;
      challenges.set(challengeToken, user.id);
      return ok({
        twoFactorRequired: true,
        challengeToken,
        challengeExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      });
    }
    return ok({ twoFactorRequired: false, ...startSession(user.id) });
  }),

  http.post(api('/auth/2fa/verify'), async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as TwoFactorLoginDto;
    const userId = challenges.get(body.challengeToken);
    if (!userId) {
      return fail(401, 'TOKEN_INVALID', 'Challenge invalid or expired', pathOf(request));
    }
    const valid = body.code === DEMO_CODE || body.recoveryCode === DEMO_RECOVERY_CODE;
    if (!valid) {
      return fail(401, 'TWO_FACTOR_INVALID', 'Invalid code', pathOf(request));
    }
    challenges.delete(body.challengeToken);
    return ok(startSession(userId));
  }),

  // 202 whether or not the number is registered (no account enumeration).
  http.post(api('/auth/otp/request'), async ({ request }) => {
    await delay(300);
    const body = (await request.json()) as OtpRequestDto;
    if (body.orgCode.toLowerCase() !== DEMO_ORG.code) {
      return fail(403, 'ORG_UNAVAILABLE', 'Organization not available', pathOf(request));
    }
    return ok({ accepted: true, expiresInSec: 300 }, { status: 202 });
  }),

  http.post(api('/auth/otp/verify'), async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as OtpVerifyDto;
    const user = MOCK_USERS.find(
      (u) => u.phone === body.phone && u.type === 'PARENT' && u.orgCode === body.orgCode,
    );
    if (!user || body.code !== DEMO_CODE) {
      return fail(401, 'OTP_INVALID', 'Invalid or expired code', pathOf(request));
    }
    return ok(startSession(user.id));
  }),

  http.post(api('/auth/refresh'), async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as RefreshDto;
    const result = rotate(body.refreshToken);
    return result.ok
      ? ok(result.tokens)
      : fail(401, result.code, 'Refresh token rejected', pathOf(request));
  }),

  http.post(api('/auth/logout'), ({ request }) => {
    const auth = authenticate(request, { allowDuringTwoFactorSetup: true });
    if (isResponse(auth)) {
      return auth;
    }
    return ok({ revokedSessions: revokeSession(auth.sessionId) });
  }),

  http.post(api('/auth/2fa/setup'), ({ request }) => {
    const auth = authenticate(request, { allowDuringTwoFactorSetup: true });
    if (isResponse(auth)) {
      return auth;
    }
    const secret = 'JBSWY3DPEHPK3PXP';
    setPendingSecret(auth.user.id, secret);
    const label = encodeURIComponent(`School ERP:${auth.user.email ?? auth.user.id}`);
    return ok({
      secret,
      otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=School%20ERP`,
    });
  }),

  http.post(api('/auth/2fa/enable'), async ({ request }) => {
    const auth = authenticate(request, { allowDuringTwoFactorSetup: true });
    if (isResponse(auth)) {
      return auth;
    }
    const body = (await request.json()) as TwoFactorCodeDto;
    if (body.code !== DEMO_CODE || !enableTwoFactor(auth.user.id)) {
      return fail(401, 'TWO_FACTOR_INVALID', 'Invalid code', pathOf(request));
    }
    return ok({
      recoveryCodes: [DEMO_RECOVERY_CODE, 'JKLM-NPQR-5678', 'STUV-WXYZ-9012', 'MNOP-QRST-3456'],
    });
  }),

  http.get(api('/me/access'), async ({ request }) => {
    await delay(150);
    const auth = authenticate(request, { allowDuringTwoFactorSetup: true });
    if (isResponse(auth)) {
      return auth;
    }
    return ok(buildAccess(auth.user, request.headers.get('x-branch-id')));
  }),
];
