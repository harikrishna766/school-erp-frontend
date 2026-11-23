import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { SKIP_ERROR_TOAST, SKIP_LOADING } from '../http/http-context';
import { inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { ThemeService } from '../theme/theme.service';
import { TenantContext } from './tenant-context';

/**
 * Public, unauthenticated branding for the login page and shell.
 * PROVISIONAL: `GET /tenants/current/branding` is not in the backend yet (mocks only;
 * against the real API it 404s and the default theme is used). Swap this interface for the generated model once the endpoint
 * exists; the store's public surface does not change.
 */
export interface TenantBranding {
  readonly schoolName: string;
  readonly shortName: string;
  readonly logoUrl: string | null;
  readonly primaryColor: string | null;
}

interface BrandingState {
  readonly branding: TenantBranding | null;
  readonly status: 'idle' | 'loading' | 'loaded' | 'error';
}

/** Backend `TENANT_HEADER` (jwt-auth.guard.ts): org code or sub-domain. */
export const TENANT_HEADER = 'x-tenant';
/** Backend `BRANCH_HEADER`: active branch id, checked against the user's branch access. */
export const BRANCH_HEADER = 'x-branch-id';

export const BrandingStore = signalStore(
  { providedIn: 'root' },
  withState<BrandingState>({ branding: null, status: 'idle' }),
  withComputed(({ branding }) => ({
    schoolName: () => branding()?.schoolName ?? null,
    shortName: () => branding()?.shortName ?? branding()?.schoolName ?? null,
    logoUrl: () => branding()?.logoUrl ?? null,
  })),
  withMethods(
    (
      store,
      http = inject(HttpClient),
      config = inject(APP_CONFIG),
      tenant = inject(TenantContext),
      theme = inject(ThemeService),
    ) => ({
      /** Never rejects: a school without branding still gets a working, default-themed UI. */
      async load(): Promise<void> {
        const slug = tenant.slug();
        if (!slug) {
          patchState(store, { branding: null, status: 'idle' });
          theme.applyBrandColor(null);
          return;
        }
        patchState(store, { status: 'loading' });
        try {
          const res = await firstValueFrom(
            http.get<TenantBranding>(`${config.apiBaseUrl}/tenants/current/branding`, {
              headers: new HttpHeaders({ [TENANT_HEADER]: slug }),
              context: new HttpContext().set(SKIP_ERROR_TOAST, true).set(SKIP_LOADING, true),
            }),
          );
          patchState(store, { branding: res, status: 'loaded' });
          theme.applyBrandColor(res.primaryColor);
        } catch {
          patchState(store, { branding: null, status: 'error' });
          theme.applyBrandColor(null);
        }
      },
    }),
  ),
);
