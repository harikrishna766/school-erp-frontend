import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTestConfig } from '../../../testing/providers';
import { ThemeService } from '../theme/theme.service';
import { BrandingStore, TENANT_HEADER, type TenantBranding } from './branding.store';

const BRANDING: TenantBranding = {
  schoolName: 'Greenwood International School',
  shortName: 'Greenwood',
  logoUrl: '/logo.svg',
  primaryColor: '#0f6e56',
};

describe('BrandingStore', () => {
  const applyBrandColor = vi.fn();

  function setup(tenantSlug: string | null) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTestConfig({ apiBaseUrl: '/api/v1', tenantSlug }),
        { provide: ThemeService, useValue: { applyBrandColor } },
      ],
    });
    return { store: TestBed.inject(BrandingStore), http: TestBed.inject(HttpTestingController) };
  }

  afterEach(() => applyBrandColor.mockReset());

  it('loads branding for the tenant and applies its colour', async () => {
    const { store, http } = setup('greenwood');
    const done = store.load();

    const req = http.expectOne('/api/v1/tenants/current/branding');
    expect(req.request.headers.get(TENANT_HEADER)).toBe('greenwood');
    req.flush({ success: true, data: BRANDING });
    await done;

    expect(store.status()).toBe('loaded');
    expect(store.schoolName()).toBe('Greenwood International School');
    expect(store.shortName()).toBe('Greenwood');
    expect(applyBrandColor).toHaveBeenCalledWith('#0f6e56');
    http.verify();
  });

  it('records an error without throwing when the request fails', async () => {
    const { store, http } = setup('ghost');
    const done = store.load();
    http
      .expectOne('/api/v1/tenants/current/branding')
      .flush(
        { success: false, error: { code: 'NOT_FOUND', message: 'x' } },
        { status: 404, statusText: 'Not Found' },
      );
    await expect(done).resolves.toBeUndefined();
    expect(store.status()).toBe('error');
    expect(store.schoolName()).toBeNull();
    // Falls back to the default palette so a previous school's colours don't linger.
    expect(applyBrandColor).toHaveBeenCalledWith(null);
  });

  it('skips the request when no tenant can be resolved', async () => {
    const { store, http } = setup(null);
    await store.load();
    http.expectNone('/api/v1/tenants/current/branding');
    expect(store.status()).toBe('idle');
  });
});
