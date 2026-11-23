import { HttpResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { map } from 'rxjs';
import { APP_CONFIG } from '../../config/app-config';
import { isApiUrl } from '../api-url';
import { unwrapEnvelope } from '../api-envelope';

/**
 * Unwraps the backend's success envelope so generated-client return types match the
 * runtime body (the OpenAPI document describes unwrapped payloads). Error envelopes are
 * left intact for the error interceptor.
 */
export const envelopeInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiUrl(req.url, inject(APP_CONFIG).apiBaseUrl)) {
    return next(req);
  }
  return next(req).pipe(
    map((event) =>
      event instanceof HttpResponse ? event.clone({ body: unwrapEnvelope(event.body) }) : event,
    ),
  );
};
