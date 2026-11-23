import { HttpErrorResponse } from '@angular/common/http';
import { MissingSchoolError } from '../../core/auth/auth.store';
import { authErrorKey, safeReturnUrl } from './auth-errors';

describe('safeReturnUrl (open-redirect protection)', () => {
  it.each([
    ['/fees/invoices?x=1', '/fees/invoices?x=1'],
    [undefined, '/'],
    ['', '/'],
    ['https://evil.example', '/'],
    ['//evil.example/path', '/'],
    ['/\\evil.example', '/'],
    ['javascript:alert(1)', '/'],
    ['/login?returnUrl=/x', '/'],
  ])('%s → %s', (input, expected) => {
    expect(safeReturnUrl(input)).toBe(expected);
  });
});

describe('authErrorKey', () => {
  const err = (status: number, code?: string) =>
    new HttpErrorResponse({
      status,
      error: code ? { success: false, error: { code, message: '' } } : null,
    });

  it.each([
    [401, 'INVALID_CREDENTIALS', 'auth.errors.invalidCredentials'],
    [423, 'ACCOUNT_LOCKED', 'auth.errors.accountLocked'],
    [403, 'ACCOUNT_DISABLED', 'auth.errors.accountDisabled'],
    [403, 'ORG_UNAVAILABLE', 'auth.errors.orgUnavailable'],
    [401, 'TWO_FACTOR_INVALID', 'auth.errors.invalidCode'],
    [401, 'OTP_INVALID', 'auth.errors.invalidCode'],
    [401, 'TOKEN_INVALID', 'auth.errors.challengeExpired'],
    [429, 'OTP_RATE_LIMITED', 'auth.errors.tooManyAttempts'],
    [503, 'DELIVERY_UNAVAILABLE', 'auth.errors.deliveryUnavailable'],
  ])('%i %s → %s', (status, code, key) => {
    expect(authErrorKey(err(status, code), 'password')).toBe(key);
  });

  it('falls back by status and step without revealing whether an account exists', () => {
    expect(authErrorKey(err(401), 'password')).toBe('auth.errors.invalidCredentials');
    expect(authErrorKey(err(401), 'code')).toBe('auth.errors.invalidCode');
    expect(authErrorKey(err(503), 'otp-request')).toBe('errors.server');
    expect(authErrorKey(new MissingSchoolError(), 'password')).toBe('auth.errors.schoolRequired');
    expect(authErrorKey(new Error('x'), 'password')).toBe('errors.unexpected');
  });
});
