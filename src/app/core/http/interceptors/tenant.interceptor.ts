import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { APP_CONFIG } from '../../config/app-config';
import { BranchContext } from '../../tenant/branch-context';
import { BRANCH_HEADER, TENANT_HEADER } from '../../tenant/branding.store';
import { TenantContext } from '../../tenant/tenant-context';
import { isApiUrl } from '../api-url';

/**
 * Adds the backend's context headers to API calls:
 * - `x-tenant`: the school; the backend rejects a token from another school
 *   (TENANT_MISMATCH), which protects against using a session on the wrong sub-domain.
 * - `x-branch-id`: the branch the user is working in (validated against their access).
 */
export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiUrl(req.url, inject(APP_CONFIG).apiBaseUrl)) {
    return next(req);
  }
  const headers: Record<string, string> = {};
  const slug = inject(TenantContext).slug();
  const branchId = inject(BranchContext).id();
  if (slug && !req.headers.has(TENANT_HEADER)) {
    headers[TENANT_HEADER] = slug;
  }
  if (branchId && !req.headers.has(BRANCH_HEADER)) {
    headers[BRANCH_HEADER] = branchId;
  }
  return Object.keys(headers).length ? next(req.clone({ setHeaders: headers })) : next(req);
};
