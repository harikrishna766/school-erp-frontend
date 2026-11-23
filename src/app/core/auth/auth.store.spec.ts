import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { AccessStore } from '../access/access.store';
import { ToastService } from '../notify/toast.service';
import { AuthApi } from './auth.api';
import type { TokenResponse } from './auth.model';
import { AuthStore } from './auth.store';
import { SessionSync, type SessionMessage } from './session-sync';

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
  let listeners: ((m: SessionMessage) => void)[];
  const sync = {
    publish: vi.fn(),
    subscribe: (fn: (m: SessionMessage) => void) => listeners.push(fn),
    withRefreshLock: <T>(task: () => Promise<T>) => task(),
  };
  const tokens = (token = 'at-1', expiresIn = 900): TokenResponse => ({
    accessToken: token,
    expiresIn,
  });

  let store: AuthStore;

  beforeEach(() => {
    vi.clearAllMocks();
    listeners = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthApi, useValue: api },
        { provide: AccessStore, useValue: access },
        { provide: Router, useValue: router },
        { provide: ToastService, useValue: toast },
        { provide: SessionSync, useValue: sync },
      ],
    });
    store = TestBed.inject(AuthStore);
  });

  it('starts unknown and becomes anonymous when there is no session to restore', async () => {
    expect(store.status()).toBe('unknown');
    api.refresh.mockReturnValue(throwError(() => new Error('401')));
    await store.restore();
    await store.whenReady();
    expect(store.status()).toBe('anonymous');
  });

  it('restores a session from the refresh cookie', async () => {
    api.refresh.mockReturnValue(of(tokens('restored')));
    await store.restore();
    expect(store.isAuthenticated()).toBe(true);
    expect(store.accessToken()).toBe('restored');
    expect(store.isFresh()).toBe(true);
  });

  it('password login loads access and shares the token with other tabs', async () => {
    api.login.mockReturnValue(of({ status: 'AUTHENTICATED', ...tokens() }));
    await expect(store.loginWithPassword(' t@x.test ', 'pw')).resolves.toEqual({
      kind: 'authenticated',
    });
    expect(api.login).toHaveBeenCalledWith(expect.objectContaining({ identifier: 't@x.test' }));
    expect(access.clear).toHaveBeenCalled();
    expect(access.ensureLoaded).toHaveBeenCalled();
    expect(sync.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'token', accessToken: 'at-1' }),
    );
  });

  it('returns a two-factor challenge without signing in', async () => {
    api.login.mockReturnValue(of({ status: 'TWO_FACTOR_REQUIRED', challengeId: 'c1' }));
    await expect(store.loginWithPassword('a@b.c', 'pw')).resolves.toEqual({
      kind: 'two-factor',
      challengeId: 'c1',
    });
    expect(store.isAuthenticated()).toBe(false);
    api.verifyTwoFactor.mockReturnValue(of(tokens('2fa')));
    await store.verifyTwoFactor('c1', '123456');
    expect(store.accessToken()).toBe('2fa');
  });

  it('single-flights concurrent refreshes', async () => {
    const pending = new Subject<TokenResponse>();
    api.refresh.mockReturnValue(pending);
    const a = store.refresh();
    const b = store.refresh();
    expect(api.refresh).toHaveBeenCalledTimes(1);
    pending.next(tokens('new'));
    pending.complete();
    await expect(Promise.all([a, b])).resolves.toEqual(['new', 'new']);
  });

  it('skips the network refresh if another tab already refreshed', async () => {
    listeners.forEach((l) =>
      l({ type: 'token', accessToken: 'from-tab', expiresAt: Date.now() + 600_000 }),
    );
    await expect(store.refresh()).resolves.toBe('from-tab');
    expect(api.refresh).not.toHaveBeenCalled();
  });

  it('expired session: clears state, toasts and keeps the return URL', () => {
    store.endSession('expired');
    expect(store.status()).toBe('anonymous');
    expect(access.clear).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('auth.sessionExpired');
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/fees/invoices' },
    });
  });

  it('logout tells the server and other tabs, even if the server call fails', async () => {
    api.login.mockReturnValue(of({ status: 'AUTHENTICATED', ...tokens() }));
    await store.loginWithPassword('a@b.c', 'pw');
    api.logout.mockReturnValue(throwError(() => new Error('offline')));
    await store.logout();
    expect(sync.publish).toHaveBeenCalledWith({ type: 'logout' });
    expect(store.accessToken()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: {} });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('follows a logout from another tab', async () => {
    api.refresh.mockReturnValue(of(tokens()));
    await store.restore();
    listeners.forEach((l) => l({ type: 'logout' }));
    expect(store.isAuthenticated()).toBe(false);
  });
});
