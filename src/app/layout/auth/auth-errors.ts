import { HttpErrorResponse } from '@angular/common/http';
import { MissingSchoolError } from '../../core/auth/auth.store';
import { isApiFailure } from '../../core/http/api-envelope';

export type AuthStep = 'password' | 'code' | 'otp-request';

/**
 * Backend auth error codes (school-erp-backend common/exceptions/error-codes.ts) → inline
 * message keys. Unknown-account and wrong-password are the same code server-side, so the
 * UI never reveals whether an account exists.
 */
const CODE_KEYS: Readonly<Record<string, string>> = {
  INVALID_CREDENTIALS: 'auth.errors.invalidCredentials',
  ACCOUNT_LOCKED: 'auth.errors.accountLocked',
  ACCOUNT_DISABLED: 'auth.errors.accountDisabled',
  ORG_UNAVAILABLE: 'auth.errors.orgUnavailable',
  TWO_FACTOR_INVALID: 'auth.errors.invalidCode',
  OTP_INVALID: 'auth.errors.invalidCode',
  TOKEN_INVALID: 'auth.errors.challengeExpired',
  TOKEN_EXPIRED: 'auth.errors.challengeExpired',
  OTP_RATE_LIMITED: 'auth.errors.tooManyAttempts',
  RATE_LIMITED: 'auth.errors.tooManyAttempts',
  DELIVERY_UNAVAILABLE: 'auth.errors.deliveryUnavailable',
};

export function authErrorKey(error: unknown, step: AuthStep): string {
  if (error instanceof MissingSchoolError) {
    return 'auth.errors.schoolRequired';
  }
  if (!(error instanceof HttpErrorResponse)) {
    return 'errors.unexpected';
  }
  if (error.status === 0) {
    return navigator.onLine === false ? 'errors.offline' : 'errors.network';
  }
  const code = isApiFailure(error.error) ? error.error.error.code : undefined;
  if (code && CODE_KEYS[code]) {
    return CODE_KEYS[code];
  }
  if (error.status === 429) {
    return 'auth.errors.tooManyAttempts';
  }
  if (error.status === 401 || code === 'VALIDATION_FAILED') {
    return step === 'password' ? 'auth.errors.invalidCredentials' : 'auth.errors.invalidCode';
  }
  return error.status >= 500 ? 'errors.server' : 'errors.unexpected';
}

/** Only same-app absolute paths: blocks `//evil.com`, `https://…`, `javascript:` etc. */
export function safeReturnUrl(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return '/';
  }
  return value.startsWith('/login') ? '/' : value;
}
