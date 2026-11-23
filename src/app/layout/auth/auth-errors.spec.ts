import { HttpErrorResponse } from '@angular/common/http';
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

  it('distinguishes wrong password from wrong code without revealing account existence', () => {
    expect(authErrorKey(err(401, 'UNAUTHENTICATED'), 'password')).toBe(
      'auth.errors.invalidCredentials',
    );
    expect(authErrorKey(err(401, 'UNAUTHENTICATED'), 'code')).toBe('auth.errors.invalidCode');
  });

  it('maps lockout, disabled accounts and server errors', () => {
    expect(authErrorKey(err(429, 'RATE_LIMITED'), 'password')).toBe('auth.errors.tooManyAttempts');
    expect(authErrorKey(err(403, 'FORBIDDEN'), 'password')).toBe('auth.errors.accountDisabled');
    expect(authErrorKey(err(503), 'otp-request')).toBe('errors.server');
    expect(authErrorKey(new Error('x'), 'password')).toBe('errors.unexpected');
  });
});
