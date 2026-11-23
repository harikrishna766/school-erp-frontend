/*
 * PROVISIONAL transport types for the auth endpoints (not in the backend yet). Shapes
 * follow the backend's Prisma design: opaque rotating refresh tokens per session family
 * (UserSession), OTP challenges (OtpChallenge), optional TOTP 2FA. Swap for generated
 * models when the endpoints ship. Contract: docs/backend-contract.md.
 */

/** Access token returned in the body; the refresh token travels only as an httpOnly cookie. */
export interface TokenResponse {
  readonly accessToken: string;
  /** Seconds until the access token expires. */
  readonly expiresIn: number;
}

export type LoginResponse =
  | ({ readonly status: 'AUTHENTICATED' } & TokenResponse)
  | { readonly status: 'TWO_FACTOR_REQUIRED'; readonly challengeId: string };

export interface PasswordLoginRequest {
  /** Email or phone number. */
  readonly identifier: string;
  readonly password: string;
  readonly deviceId: string;
}

export interface OtpRequest {
  readonly phone: string;
  readonly channel: 'SMS' | 'WHATSAPP';
}

export interface OtpChallengeResponse {
  readonly challengeId: string;
  /** Seconds the code stays valid. */
  readonly expiresIn: number;
  /** Seconds before another code may be requested. */
  readonly resendAfter: number;
}

export interface VerifyCodeRequest {
  readonly challengeId: string;
  readonly code: string;
  readonly deviceId: string;
}
