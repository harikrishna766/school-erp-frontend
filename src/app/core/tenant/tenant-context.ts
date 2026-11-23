import { DOCUMENT, Injectable, inject } from '@angular/core';
import { APP_CONFIG } from '../config/app-config';

/** Hosts where there is no school sub-domain (local dev, bare apex). */
const NON_TENANT_LABELS = new Set(['www', 'app', 'localhost']);

/**
 * Resolves the tenant (school) slug for this browser session.
 * Order: fixed `tenantSlug` in runtime config → first DNS label of the host
 * (`greenwood.example.com` → `greenwood`) → null (login page asks for a school code).
 */
export function resolveTenantSlug(hostname: string, configured: string | null): string | null {
  if (configured) {
    return configured;
  }
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
  const labels = hostname.split('.');
  if (isIp || labels.length < 3 || NON_TENANT_LABELS.has(labels[0])) {
    return null;
  }
  return labels[0];
}

@Injectable({ providedIn: 'root' })
export class TenantContext {
  private readonly config = inject(APP_CONFIG);
  private readonly document = inject(DOCUMENT);

  readonly slug: string | null = resolveTenantSlug(
    this.document.location.hostname,
    this.config.tenantSlug,
  );
}
