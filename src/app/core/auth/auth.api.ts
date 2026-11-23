import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import type { ApiSuccess } from '../http/api-envelope';
import { AUTH_REQUEST, SKIP_ERROR_TOAST, SKIP_LOADING } from '../http/http-context';
import type {
  LoginResponse,
  OtpChallengeResponse,
  OtpRequest,
  PasswordLoginRequest,
  TokenResponse,
  VerifyCodeRequest,
} from './auth.model';

/**
 * Thin HTTP wrapper for /auth/*. Temporary: replaced by the generated `AuthService` once
 * the backend publishes these endpoints in OpenAPI.
 *
 * Every call is `withCredentials` (the refresh cookie must flow cross-origin) and marked
 * AUTH_REQUEST so the auth interceptor neither attaches a bearer token nor tries to
 * refresh on 401. Callers show their own errors (SKIP_ERROR_TOAST).
 */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_CONFIG).apiBaseUrl}/auth`;

  private post<T>(path: string, body: unknown, quiet = false): Observable<T> {
    let context = new HttpContext().set(AUTH_REQUEST, true).set(SKIP_ERROR_TOAST, true);
    if (quiet) {
      context = context.set(SKIP_LOADING, true);
    }
    return this.http
      .post<ApiSuccess<T>>(`${this.base}/${path}`, body, { withCredentials: true, context })
      .pipe(map((res) => res.data));
  }

  login(body: PasswordLoginRequest): Observable<LoginResponse> {
    return this.post('login', body);
  }

  verifyTwoFactor(body: VerifyCodeRequest): Observable<TokenResponse> {
    return this.post('2fa/verify', body);
  }

  requestOtp(body: OtpRequest): Observable<OtpChallengeResponse> {
    return this.post('otp/request', body);
  }

  verifyOtp(body: VerifyCodeRequest): Observable<TokenResponse> {
    return this.post('otp/verify', body);
  }

  /** Uses the httpOnly refresh cookie; rotates it server-side. */
  refresh(): Observable<TokenResponse> {
    return this.post('refresh', {}, true);
  }

  logout(): Observable<null> {
    return this.post('logout', {}, true);
  }
}
