import { HttpErrorResponse } from '@angular/common/http';
import { isApiFailure } from '../../core/http/api-envelope';

export type AuthStep = 'password' | 'code' | 'otp-request';

/** Maps a failed auth call to an inline message key. Never reveals whether an account exists. */
export function authErrorKey(error: unknown, step: AuthStep): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'errors.unexpected';
  }
  if (error.status === 0) {
    return navigator.onLine === false ? 'errors.offline' : 'errors.network';
  }
  const code = isApiFailure(error.error) ? error.error.error.code : undefined;
  if (code === 'RATE_LIMITED' || error.status === 429) {
    return 'auth.errors.tooManyAttempts';
  }
  if (code === 'FORBIDDEN' || error.status === 403) {
    return 'auth.errors.accountDisabled';
  }
  if (code === 'UNAUTHENTICATED' || code === 'VALIDATION_FAILED' || error.status === 401) {
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
