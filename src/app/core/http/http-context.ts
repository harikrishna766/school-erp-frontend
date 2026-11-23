import { HttpContextToken } from '@angular/common/http';

/** /auth/* calls: no bearer token, no refresh-and-retry on 401. */
export const AUTH_REQUEST = new HttpContextToken<boolean>(() => false);

/** The caller renders the error itself (e.g. inline form errors). */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

/** Background request: don't drive the global progress bar. */
export const SKIP_LOADING = new HttpContextToken<boolean>(() => false);

/** Already retried once after a token refresh. */
export const RETRIED_AFTER_REFRESH = new HttpContextToken<boolean>(() => false);
