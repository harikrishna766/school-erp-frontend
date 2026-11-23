import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { APP_CONFIG } from '../../config/app-config';
import { ToastService } from '../../notify/toast.service';
import { isApiUrl } from '../api-url';
import { isApiFailure } from '../api-envelope';
import { SKIP_ERROR_TOAST } from '../http-context';

/** Backend `error.code` → translation key. Branch on codes, never on messages. */
const CODE_MESSAGES: Readonly<Record<string, string>> = {
  FORBIDDEN: 'errors.forbidden',
  NOT_FOUND: 'errors.notFound',
  CONFLICT: 'errors.conflict',
  RATE_LIMITED: 'errors.rateLimited',
  PAYLOAD_TOO_LARGE: 'errors.payloadTooLarge',
  SERVICE_UNAVAILABLE: 'errors.unavailable',
  VALIDATION_FAILED: 'errors.validation',
  UNPROCESSABLE: 'errors.validation',
  BAD_REQUEST: 'errors.validation',
};

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
  return next(req).pipe(
    catchError((error: unknown) => {
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
