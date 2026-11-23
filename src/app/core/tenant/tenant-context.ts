import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { PREF_KEYS, prefs } from '../storage/local-storage';
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

/** School codes: lowercase letters, digits and hyphens (DNS-label safe). */
export const SCHOOL_CODE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

@Injectable({ providedIn: 'root' })
export class TenantContext {
  private readonly config = inject(APP_CONFIG);
  private readonly document = inject(DOCUMENT);

  /** Fixed by deployment (config or sub-domain): the login page must not offer to change it. */
  readonly isFixed: boolean =
    resolveTenantSlug(this.document.location.hostname, this.config.tenantSlug) !== null;

  private readonly _slug = signal<string | null>(
    resolveTenantSlug(this.document.location.hostname, this.config.tenantSlug) ??
      validCode(prefs.get(PREF_KEYS.schoolCode)),
  );
  readonly slug = this._slug.asReadonly();

  /** Sets the school code typed on the login page (only when not fixed by deployment). */
  setSchoolCode(code: string): void {
    if (this.isFixed) {
      return;
    }
    const valid = validCode(code.trim().toLowerCase());
    this._slug.set(valid);
    if (valid) {
      prefs.set(PREF_KEYS.schoolCode, valid);
    }
  }
}

function validCode(value: string | null): string | null {
  return value && SCHOOL_CODE_PATTERN.test(value) ? value : null;
}
