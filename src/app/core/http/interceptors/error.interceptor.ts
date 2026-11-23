import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { APP_CONFIG } from '../../config/app-config';
import { ToastService } from '../../notify/toast.service';
import { isApiUrl } from '../api-url';
import { isApiFailure } from '../api-envelope';
import { SKIP_ERROR_TOAST } from '../http-context';

/** Backend `error.code` → translation key. Branch on codes, never on messages. */
const CODE_MESSAGES: Readonly<Record<string, string>> = {
  FORBIDDEN: 'errors.forbidden',
  PERMISSION_DENIED: 'errors.forbidden',
  BRANCH_FORBIDDEN: 'errors.forbidden',
  MODULE_DISABLED: 'errors.moduleDisabled',
  TENANT_MISMATCH: 'errors.tenantMismatch',
  TENANT_VIOLATION: 'errors.tenantMismatch',
  BRANCH_REQUIRED: 'errors.branchRequired',
  HARD_DELETE_FORBIDDEN: 'errors.forbidden',
  SYSTEM_ROLE_IMMUTABLE: 'errors.systemRoleImmutable',
  NOT_FOUND: 'errors.notFound',
  CONFLICT: 'errors.conflict',
  RATE_LIMITED: 'errors.rateLimited',
  PAYLOAD_TOO_LARGE: 'errors.payloadTooLarge',
  SERVICE_UNAVAILABLE: 'errors.unavailable',
  VALIDATION_FAILED: 'errors.validation',
  UNPROCESSABLE: 'errors.validation',
  BAD_REQUEST: 'errors.validation',
};

export function errorCode(error: HttpErrorResponse): string | undefined {
  return isApiFailure(error.error) ? error.error.error.code : undefined;
}

/** Maps any HTTP failure to a user-facing translation key. */
export function errorMessageKey(error: HttpErrorResponse): string {
  if (error.status === 0) {
    return navigator.onLine === false ? 'errors.offline' : 'errors.network';
  }
  const code = isApiFailure(error.error) ? error.error.error.code : undefined;
  return (
    (code && CODE_MESSAGES[code]) ?? (error.status >= 500 ? 'errors.server' : 'errors.unexpected')
  );
}

/**
 * Global API error reporting. 401s are the auth interceptor's business (refresh or
 * redirect), so they are not toasted. Callers that render errors inline opt out with
 * SKIP_ERROR_TOAST. The error is always re-thrown so callers can still react.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const { apiBaseUrl } = inject(APP_CONFIG);
  if (!isApiUrl(req.url, apiBaseUrl)) {
    return next(req);
  }
  const toast = inject(ToastService);
  const injector = inject(Injector);
  return next(req).pipe(
    catchError((error: unknown) => {
      // Roles that require 2FA are blocked everywhere until they enrol.
      if (error instanceof HttpErrorResponse && errorCode(error) === 'TWO_FACTOR_SETUP_REQUIRED') {
        void injector.get(Router).navigate(['/security/two-factor']);
        return throwError(() => error);
      }
      if (
        error instanceof HttpErrorResponse &&
        error.status !== 401 &&
        !req.context.get(SKIP_ERROR_TOAST)
      ) {
        toast.error(errorMessageKey(error));
      }
      return throwError(() => error);
    }),
  );
};
