import { authInterceptor } from './auth.interceptor';
import { errorInterceptor } from './error.interceptor';
import { loadingInterceptor } from './loading.interceptor';
import { tenantInterceptor } from './tenant.interceptor';

/**
 * Order matters (first = outermost): loading wraps everything; error sees the final
 * outcome *after* auth's refresh-and-retry; tenant is added before auth.
 */
export const HTTP_INTERCEPTORS = [
  loadingInterceptor,
  errorInterceptor,
  tenantInterceptor,
  authInterceptor,
];
