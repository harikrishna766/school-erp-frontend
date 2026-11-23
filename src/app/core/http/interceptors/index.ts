import { authInterceptor } from './auth.interceptor';
import { envelopeInterceptor } from './envelope.interceptor';
import { errorInterceptor } from './error.interceptor';
import { loadingInterceptor } from './loading.interceptor';
import { tenantInterceptor } from './tenant.interceptor';

/**
 * Order matters (first = outermost): loading wraps everything; error sees the final
 * outcome *after* auth's refresh-and-retry; tenant headers are added before auth; the
 * envelope is unwrapped innermost, so a retried response is unwrapped exactly once.
 */
export const HTTP_INTERCEPTORS = [
  loadingInterceptor,
  errorInterceptor,
  tenantInterceptor,
  authInterceptor,
  envelopeInterceptor,
];
