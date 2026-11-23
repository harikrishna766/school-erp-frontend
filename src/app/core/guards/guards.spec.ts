import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type CanMatchFn, Router, UrlTree, provideRouter } from '@angular/router';
import { AccessStore } from '../access/access.store';
import { AuthStore } from '../auth/auth.store';
import { moduleGuard, permissionGuard } from './access.guards';
import { authGuard, guestGuard } from './auth.guards';

describe('route guards', () => {
  const auth = {
    isAuthenticated: signal(false),
    whenReady: vi.fn().mockResolvedValue(undefined),
    endSession: vi.fn(),
  };
  const access = {
    ensureLoaded: vi.fn(),
    hasModule: vi.fn(),
    can: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    auth.isAuthenticated.set(false);
    // A pending promise that resolves on the next macrotask reproduces the real case
    // (access not loaded yet): guards must not call inject() after awaiting it.
    access.ensureLoaded.mockImplementation(() => new Promise((r) => setTimeout(r)));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: auth },
        { provide: AccessStore, useValue: access },
      ],
    });
  });

  const run = (guard: CanMatchFn, path = 'fees') =>
    TestBed.runInInjectionContext(() =>
      guard({ path }, [{ path, parameters: {} } as never], {} as never),
    ) as Promise<boolean | UrlTree>;
  const url = (result: boolean | UrlTree) =>
    result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : result;

  describe('authGuard', () => {
    it('sends anonymous users to login with a return URL', async () => {
      expect(url(await run(authGuard, 'fees'))).toBe('/login?returnUrl=%2Ffees');
      expect(auth.whenReady).toHaveBeenCalled();
    });

    it('lets signed-in users through once access is loaded', async () => {
      auth.isAuthenticated.set(true);
      expect(await run(authGuard)).toBe(true);
      expect(access.ensureLoaded).toHaveBeenCalled();
    });

    it('ends the session if access cannot be loaded', async () => {
      auth.isAuthenticated.set(true);
      access.ensureLoaded.mockRejectedValue(new Error('down'));
      expect(await run(authGuard)).toBe(false);
      expect(auth.endSession).toHaveBeenCalledWith('expired');
    });
  });

  describe('guestGuard', () => {
    it('redirects signed-in users away from login', async () => {
      auth.isAuthenticated.set(true);
      expect(url(await run(guestGuard, 'login'))).toBe('/');
    });

    it('allows anonymous users', async () => {
      expect(await run(guestGuard, 'login')).toBe(true);
    });
  });

  describe('moduleGuard', () => {
    it('passes for an enabled module', async () => {
      access.hasModule.mockReturnValue(true);
      expect(await run(moduleGuard('fees'))).toBe(true);
      expect(access.hasModule).toHaveBeenCalledWith('fees');
    });

    it('redirects to /forbidden (module) for a disabled module, after access loads', async () => {
      access.hasModule.mockReturnValue(false);
      expect(url(await run(moduleGuard('hostel')))).toBe('/forbidden?reason=module&module=hostel');
    });
  });

  describe('permissionGuard', () => {
    it('passes with the permission (any mode by default)', async () => {
      access.can.mockReturnValue(true);
      expect(await run(permissionGuard(['fees:invoice:view', 'fees:payment:view']))).toBe(true);
      expect(access.can).toHaveBeenCalledWith(['fees:invoice:view', 'fees:payment:view'], 'any');
    });

    it('redirects to /forbidden (permission) without it', async () => {
      access.can.mockReturnValue(false);
      expect(url(await run(permissionGuard('fees:invoice:create', 'all')))).toBe(
        '/forbidden?reason=permission',
      );
      expect(access.can).toHaveBeenCalledWith('fees:invoice:create', 'all');
    });
  });
});
