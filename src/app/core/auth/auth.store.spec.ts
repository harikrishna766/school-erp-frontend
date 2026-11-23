import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import type { TokensResponse } from '../../api/generated';
import { AccessStore } from '../access/access.store';
import { ToastService } from '../notify/toast.service';
import { TenantContext } from '../tenant/tenant-context';
import { AuthApi } from './auth.api';
import { AuthStore, MissingSchoolError, tokensFromLogin } from './auth.store';
import { SessionSync, type SessionMessage } from './session-sync';
import { TokenStorage } from './token-storage';

const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();
const tokens = (n = 1): TokensResponse => ({
  tokenType: 'Bearer' as TokensResponse['tokenType'],
  accessToken: `at-${n}`,
  accessTokenExpiresAt: inMinutes(15),
  refreshToken: `rt-${n}`,
  refreshTokenExpiresAt: inMinutes(60 * 24),
  sessionId: 'sess-1',
});

describe('AuthStore', () => {
  const api = {
    login: vi.fn(),
    verifyTwoFactor: vi.fn(),
    requestOtp: vi.fn(),
    verifyOtp: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
  };
  const access = { ensureLoaded: vi.fn().mockResolvedValue(undefined), clear: vi.fn() };
  const router = { url: '/fees/invoices', navigate: vi.fn().mockResolvedValue(true) };
  const toast = { error: vi.fn() };
  const tenant = { slug: vi.fn(() => 'demo' as string | null) };
  let listeners: ((m: SessionMessage) => void)[];
  const sync = {
    publish: vi.fn(),
    subscribe: (fn: (m: SessionMessage) => void) => listeners.push(fn),
    withRefreshLock: <T>(task: () => Promise<T>) => task(),
  };

  let store: AuthStore;
  let storage: TokenStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    tenant.slug.mockReturnValue('demo');
    listeners = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthApi, useValue: api },
        { provide: AccessStore, useValue: access },
        { provide: Router, useValue: router },
        { provide: ToastService, useValue: toast },
        { provide: SessionSync, useValue: sync },
        { provide: TenantContext, useValue: tenant },
      ],
    });
    store = TestBed.inject(AuthStore);
    storage = TestBed.inject(TokenStorage);
  });

  it('restore() makes no network call when there is no stored session', async () => {
    await store.restore();
    expect(store.status()).toBe('anonymous');
    expect(api.refresh).not.toHaveBeenCalled();
  });

  it('restore() resumes a stored session by rotating its refresh token', async () => {
    storage.write(tokens(1));
    api.refresh.mockReturnValue(of(tokens(2)));
    await store.restore();
    expect(api.refresh).toHaveBeenCalledWith('rt-1');
    expect(store.accessToken()).toBe('at-2');
    expect(storage.read()?.refreshToken).toBe('rt-2');
  });

  it('restore() clears a rejected session (e.g. REFRESH_TOKEN_REUSED)', async () => {
    storage.write(tokens(1));
    api.refresh.mockReturnValue(throwError(() => new Error('401')));
    await store.restore();
    expect(store.status()).toBe('anonymous');
    expect(storage.read()).toBeNull();
  });

  it('password login sends the school code and stores the session', async () => {
    api.login.mockReturnValue(of({ twoFactorRequired: false, ...tokens() }));
    await expect(store.loginWithPassword(' Ravi@X.test ', 'pw')).resolves.toEqual({
      kind: 'authenticated',
    });
    expect(api.login).toHaveBeenCalledWith('ravi@x.test', 'pw', 'demo');
    expect(storage.read()?.refreshToken).toBe('rt-1');
    expect(access.ensureLoaded).toHaveBeenCalled();
    expect(sync.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'token', accessToken: 'at-1' }),
    );
  });

  it('platform login omits the school code; school login without one fails early', async () => {
    api.login.mockReturnValue(of({ twoFactorRequired: false, ...tokens() }));
    await store.loginWithPassword('a@b.c', 'pw', { platform: true });
    expect(api.login).toHaveBeenCalledWith('a@b.c', 'pw', undefined);

    tenant.slug.mockReturnValue(null);
    await expect(store.loginWithPassword('a@b.c', 'pw')).rejects.toBeInstanceOf(MissingSchoolError);
  });

  it('returns a 2FA challenge, then completes with a code or a recovery code', async () => {
    api.login.mockReturnValue(of({ twoFactorRequired: true, challengeToken: 'ch-1' }));
    await expect(store.loginWithPassword('a@b.c', 'pw')).resolves.toEqual({
      kind: 'two-factor',
      challengeToken: 'ch-1',
    });
    expect(store.isAuthenticated()).toBe(false);
    api.verifyTwoFactor.mockReturnValue(of(tokens(3)));
    await store.verifyTwoFactor('ch-1', { recoveryCode: 'ABCD-EFGH' });
    expect(api.verifyTwoFactor).toHaveBeenCalledWith('ch-1', { recoveryCode: 'ABCD-EFGH' });
    expect(store.accessToken()).toBe('at-3');
  });

  it('parent OTP uses the school code and phone', async () => {
    api.requestOtp.mockReturnValue(of({ accepted: true, expiresInSec: 300 }));
    await expect(store.requestOtp('+919876543210')).resolves.toBe(300);
    expect(api.requestOtp).toHaveBeenCalledWith('demo', '+919876543210');
    api.verifyOtp.mockReturnValue(of(tokens()));
    await store.verifyOtp('+919876543210', '123456');
    expect(api.verifyOtp).toHaveBeenCalledWith('demo', '+919876543210', '123456');
  });

  it('single-flights concurrent refreshes', async () => {
    storage.write(tokens(1));
    const pending = new Subject<TokensResponse>();
    api.refresh.mockReturnValue(pending);
    const a = store.refresh();
    const b = store.refresh();
    pending.next(tokens(2));
    pending.complete();
    await expect(Promise.all([a, b])).resolves.toEqual(['at-2', 'at-2']);
    expect(api.refresh).toHaveBeenCalledTimes(1);
  });

  it('re-reads the latest refresh token inside the lock (another tab may have rotated it)', async () => {
    storage.write(tokens(1));
    storage.write({ ...tokens(7) }); // other tab rotated while we waited
    api.refresh.mockReturnValue(of(tokens(8)));
    await store.refresh();
    expect(api.refresh).toHaveBeenCalledWith('rt-7');
  });

  it('skips the network refresh if another tab broadcast a fresh token', async () => {
    listeners.forEach((l) =>
      l({
        type: 'token',
        accessToken: 'from-tab',
        expiresAt: Date.now() + 600_000,
        sessionId: 's',
      }),
    );
    await expect(store.refresh()).resolves.toBe('from-tab');
    expect(api.refresh).not.toHaveBeenCalled();
  });

  it('expired session: clears storage and state, toasts, keeps the return URL', () => {
    storage.write(tokens());
    store.endSession('expired');
    expect(storage.read()).toBeNull();
    expect(store.status()).toBe('anonymous');
    expect(toast.error).toHaveBeenCalledWith('auth.sessionExpired');
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/fees/invoices' },
    });
  });

  it('logout revokes server-side, tells other tabs, and succeeds even if the call fails', async () => {
    api.login.mockReturnValue(of({ twoFactorRequired: false, ...tokens() }));
    await store.loginWithPassword('a@b.c', 'pw');
    api.logout.mockReturnValue(throwError(() => new Error('offline')));
    await store.logout();
    expect(sync.publish).toHaveBeenCalledWith({ type: 'logout' });
    expect(storage.read()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: {} });
  });

  it('follows a logout from another tab', async () => {
    storage.write(tokens(1));
    api.refresh.mockReturnValue(of(tokens(2)));
    await store.restore();
    listeners.forEach((l) => l({ type: 'logout' }));
    expect(store.isAuthenticated()).toBe(false);
  });

  it('tokensFromLogin rejects a response without tokens', () => {
    expect(() => tokensFromLogin({ twoFactorRequired: false })).toThrow();
    const { tokenType, ...rest } = tokens();
    expect(tokenType).toBe('Bearer');
    expect(tokensFromLogin({ twoFactorRequired: false, ...rest }).refreshToken).toBe('rt-1');
  });
});
