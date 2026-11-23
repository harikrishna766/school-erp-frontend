import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideTestConfig } from '../../../../testing/providers';
import { AuthStore } from '../../auth/auth.store';
import { ToastService } from '../../notify/toast.service';
import { TenantContext } from '../../tenant/tenant-context';
import { SKIP_ERROR_TOAST } from '../http-context';
import { LoadingService } from '../loading.service';
import { authInterceptor } from './auth.interceptor';
import { errorInterceptor, errorMessageKey } from './error.interceptor';
import { HTTP_INTERCEPTORS } from './index';
import { loadingInterceptor } from './loading.interceptor';
import { tenantInterceptor } from './tenant.interceptor';

describe('HTTP interceptors', () => {
  const auth = {
    isAuthenticated: signal(true),
    accessToken: signal<string | null>('old'),
    isFresh: vi.fn(() => true),
    refresh: vi.fn(),
    endSession: vi.fn(),
  };
  const toast = { error: vi.fn() };
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    vi.clearAllMocks();
    auth.isAuthenticated.set(true);
    auth.accessToken.set('old');
    auth.isFresh.mockReturnValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors(HTTP_INTERCEPTORS)),
        provideHttpClientTesting(),
        provideTestConfig({ apiBaseUrl: '/api/v1' }),
        { provide: AuthStore, useValue: auth },
        { provide: ToastService, useValue: toast },
        { provide: TenantContext, useValue: { slug: signal('greenwood') } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('is ordered loading → error → tenant → auth', () => {
    expect(HTTP_INTERCEPTORS).toEqual([
      loadingInterceptor,
      errorInterceptor,
      tenantInterceptor,
      authInterceptor,
    ]);
  });

  it('adds tenant and bearer headers to API calls only', async () => {
    const api = firstValueFrom(http.get('/api/v1/students'));
    const req = backend.expectOne('/api/v1/students');
    expect(req.request.headers.get('X-Tenant-Slug')).toBe('greenwood');
    expect(req.request.headers.get('Authorization')).toBe('Bearer old');
    req.flush({});
    await api;

    const external = firstValueFrom(http.get('https://fonts.example.com/x.css'));
    const ext = backend.expectOne('https://fonts.example.com/x.css');
    expect(ext.request.headers.has('Authorization')).toBe(false);
    expect(ext.request.headers.has('X-Tenant-Slug')).toBe(false);
    ext.flush({});
    await external;
  });

  it('refreshes before sending when the token is about to expire', async () => {
    auth.isFresh.mockReturnValue(false);
    auth.refresh.mockResolvedValue('new');
    const call = firstValueFrom(http.get('/api/v1/me/access'));
    await Promise.resolve();
    await Promise.resolve();
    backend.expectOne('/api/v1/me/access').flush({});
    await call;
    expect(auth.refresh).toHaveBeenCalledOnce();
  });

  it('on 401 refreshes once and retries once with the new token', async () => {
    auth.refresh.mockResolvedValue('new');
    const call = firstValueFrom(http.get('/api/v1/students'));
    backend.expectOne('/api/v1/students').flush(null, { status: 401, statusText: 'Unauthorized' });
    await vi.waitFor(() => expect(auth.refresh).toHaveBeenCalledOnce());
    const retry = backend.expectOne('/api/v1/students');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new');
    retry.flush({ ok: true });
    await expect(call).resolves.toEqual({ ok: true });
  });

  it('does not loop: a second 401 after the retry is returned to the caller', async () => {
    auth.refresh.mockResolvedValue('new');
    const call = firstValueFrom(http.get('/api/v1/students'));
    backend.expectOne('/api/v1/students').flush(null, { status: 401, statusText: 'Unauthorized' });
    await vi.waitFor(() => expect(auth.refresh).toHaveBeenCalledOnce());
    backend.expectOne('/api/v1/students').flush(null, { status: 401, statusText: 'Unauthorized' });
    await expect(call).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(auth.refresh).toHaveBeenCalledOnce();
    expect(toast.error).not.toHaveBeenCalled(); // 401s are never toasted
  });

  it('ends the session when the refresh itself fails', async () => {
    auth.refresh.mockRejectedValue(new Error('refresh failed'));
    const call = firstValueFrom(http.get('/api/v1/students'));
    backend.expectOne('/api/v1/students').flush(null, { status: 401, statusText: 'Unauthorized' });
    await expect(call).rejects.toThrow('refresh failed');
    expect(auth.endSession).toHaveBeenCalledWith('expired');
  });

  it('does not try to refresh for anonymous users', async () => {
    auth.isAuthenticated.set(false);
    auth.accessToken.set(null);
    const call = firstValueFrom(http.get('/api/v1/tenants/current/branding'));
    const req = backend.expectOne('/api/v1/tenants/current/branding');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(null, { status: 401, statusText: 'Unauthorized' });
    await expect(call).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(auth.refresh).not.toHaveBeenCalled();
  });

  it('toasts API errors by backend code unless the caller opts out', async () => {
    const failing = firstValueFrom(http.get('/api/v1/x'));
    backend
      .expectOne('/api/v1/x')
      .flush(
        { success: false, error: { code: 'CONFLICT', message: 'x' } },
        { status: 409, statusText: 'Conflict' },
      );
    await expect(failing).rejects.toBeTruthy();
    expect(toast.error).toHaveBeenCalledWith('errors.conflict');

    toast.error.mockClear();
    const quiet = firstValueFrom(
      http.get('/api/v1/y', { context: new HttpContext().set(SKIP_ERROR_TOAST, true) }),
    );
    backend.expectOne('/api/v1/y').flush(null, { status: 500, statusText: 'Boom' });
    await expect(quiet).rejects.toBeTruthy();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('tracks in-flight requests for the progress bar', async () => {
    const loading = TestBed.inject(LoadingService);
    const call = firstValueFrom(http.get('/api/v1/students'));
    expect(loading.isLoading()).toBe(true);
    backend.expectOne('/api/v1/students').flush({});
    await call;
    expect(loading.isLoading()).toBe(false);
  });
});

describe('errorMessageKey', () => {
  const err = (status: number, code?: string) =>
    new HttpErrorResponse({
      status,
      error: code ? { success: false, error: { code, message: '' } } : null,
    });

  it('maps backend codes, server errors and network failures', () => {
    expect(errorMessageKey(err(403, 'FORBIDDEN'))).toBe('errors.forbidden');
    expect(errorMessageKey(err(422, 'VALIDATION_FAILED'))).toBe('errors.validation');
    expect(errorMessageKey(err(502))).toBe('errors.server');
    expect(errorMessageKey(err(418))).toBe('errors.unexpected');
    expect(['errors.network', 'errors.offline']).toContain(errorMessageKey(err(0)));
  });
});
