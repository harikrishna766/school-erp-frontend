import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { APP_CONFIG } from '../../config/app-config';
import { TENANT_HEADER } from '../../tenant/branding.store';
import { TenantContext } from '../../tenant/tenant-context';
import { isApiUrl } from '../api-url';

/**
 * Identifies the school on every API call. Before login it is the only tenant signal;
 * after login the backend must take the tenant from the token and reject a mismatching
 * header (see docs/backend-contract.md).
 */
export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  const slug = inject(TenantContext).slug();
  if (
    !slug ||
    req.headers.has(TENANT_HEADER) ||
    !isApiUrl(req.url, inject(APP_CONFIG).apiBaseUrl)
  ) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { [TENANT_HEADER]: slug } }));
};
