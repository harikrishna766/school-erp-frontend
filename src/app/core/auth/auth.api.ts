import { HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { AuthService } from '../../api/generated/api/auth.service';
import {
  type AcceptedResponse,
  type LoginResponse,
  type TokensResponse,
} from '../../api/generated';
import { AUTH_REQUEST, SKIP_ERROR_TOAST, SKIP_LOADING } from '../http/http-context';
import { deviceId, deviceName } from './device-id';

/**
 * Wraps the generated AuthService with the HTTP context every auth call needs:
 * - public endpoints are AUTH_REQUEST (no bearer, no refresh-on-401),
 * - callers render errors inline (SKIP_ERROR_TOAST),
 * - background calls (refresh, logout) don't drive the progress bar.
 */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly api = inject(AuthService);

  private ctx(options: { public?: boolean; quiet?: boolean } = {}): { context: HttpContext } {
    let context = new HttpContext().set(SKIP_ERROR_TOAST, true);
    if (options.public !== false) {
      context = context.set(AUTH_REQUEST, true);
    }
    if (options.quiet) {
      context = context.set(SKIP_LOADING, true);
    }
    return { context };
  }

  private device() {
    return { deviceId: deviceId(), deviceName: deviceName() };
  }

  /** `orgCode` omitted = platform (super admin) login. */
  login(email: string, password: string, orgCode: string | undefined): Observable<LoginResponse> {
    return this.api.authControllerLoginV1(
      { loginDto: { email, password, orgCode, ...this.device() } },
      'body',
      false,
      this.ctx(),
    );
  }

  verifyTwoFactor(
    challengeToken: string,
    secondFactor: { code: string } | { recoveryCode: string },
  ): Observable<TokensResponse> {
    return this.api.authControllerVerifyTwoFactorV1(
      { twoFactorLoginDto: { challengeToken, ...secondFactor, ...this.device() } },
      'body',
      false,
      this.ctx(),
    );
  }

  requestOtp(orgCode: string, phone: string): Observable<AcceptedResponse> {
    return this.api.authControllerRequestOtpV1(
      { otpRequestDto: { orgCode, phone } },
      'body',
      false,
      this.ctx(),
    );
  }

  verifyOtp(orgCode: string, phone: string, code: string): Observable<TokensResponse> {
    return this.api.authControllerVerifyOtpV1(
      { otpVerifyDto: { orgCode, phone, code, ...this.device() } },
      'body',
      false,
      this.ctx(),
    );
  }

  refresh(refreshToken: string): Observable<TokensResponse> {
    return this.api.authControllerRefreshV1(
      { refreshDto: { refreshToken, ...this.device() } },
      'body',
      false,
      this.ctx({ quiet: true }),
    );
  }

  /** Bearer-authenticated: goes through the auth interceptor like any API call. */
  logout(): Observable<unknown> {
    return this.api.authControllerLogoutV1('body', false, this.ctx({ public: false, quiet: true }));
  }
}
