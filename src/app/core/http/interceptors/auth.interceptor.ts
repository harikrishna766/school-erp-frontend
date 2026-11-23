import { HttpErrorResponse, type HttpInterceptorFn, type HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, defer, from, switchMap, throwError } from 'rxjs';
import { AuthStore } from '../../auth/auth.store';
import { APP_CONFIG } from '../../config/app-config';
import { isApiUrl } from '../api-url';
import { AUTH_REQUEST, RETRIED_AFTER_REFRESH } from '../http-context';

const withToken = <T>(req: HttpRequest<T>, token: string | null): HttpRequest<T> =>
  token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

/**
 * Attaches the access token and keeps it valid:
 * 1. If the token is about to expire, refresh first (no doomed request).
 * 2. On 401 from the API, refresh once and retry the request once.
 * 3. If refreshing fails, the session is over: AuthStore sends the user to login.
 * Concurrent 401s share one refresh (AuthStore single-flights it, across tabs too).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Bail out before injecting AuthStore: non-API requests (translations, config) happen
  // while TranslateService is still being constructed, and AuthStore → Router →
  // TitleStrategy → TranslateService would be a circular dependency (NG0200).
  if (req.context.get(AUTH_REQUEST) || !isApiUrl(req.url, inject(APP_CONFIG).apiBaseUrl)) {
    return next(req);
  }
  const auth = inject(AuthStore);

  const refreshThen = () =>
    from(auth.refresh()).pipe(
      catchError((error: unknown) => {
        auth.endSession('expired');
        return throwError(() => error);
      }),
    );

  const send = defer(() =>
    auth.isAuthenticated() && !auth.isFresh()
      ? refreshThen().pipe(switchMap((token) => next(withToken(req, token))))
      : next(withToken(req, auth.accessToken())),
  );

  return send.pipe(
    catchError((error: unknown) => {
      const retriable =
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        auth.isAuthenticated() &&
        !req.context.get(RETRIED_AFTER_REFRESH);
      if (!retriable) {
        return throwError(() => error);
      }
      const retry = req.clone({ context: req.context.set(RETRIED_AFTER_REFRESH, true) });
      return refreshThen().pipe(switchMap((token) => next(withToken(retry, token))));
    }),
  );
};
