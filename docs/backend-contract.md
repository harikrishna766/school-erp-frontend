# Backend contract (frontend expectations)

How `school-erp-frontend` consumes `school-erp-backend`, and what is still missing.

## How the client is produced

- `npm run api:export` builds the backend with its own Nest CLI and exports its OpenAPI
  document **without** Postgres/Redis (Nest preview mode) into `openapi/school-erp-api.json`.
  `npm run api:fetch` does the same from a running backend (`/api/docs-json`).
- `npm run api:generate` → `src/app/api/generated` (openapi-generator, typescript-angular).
  CI regenerates from the committed snapshot and fails on drift.
- MSW mocks import the generated DTO types, so mock/contract drift is a compile error.

## Consumed today

| Backend                                                                                      | Frontend                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Envelope `{ success, data, meta?, requestId }`                                               | `envelopeInterceptor` unwraps it so generated types match; list `meta` via `pageMetaOf(items)`                                                                                                                             |
| Error envelope + `ErrorCode`                                                                 | Errors are mapped by `code` (`INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `ORG_UNAVAILABLE`, `TWO_FACTOR_INVALID`, `OTP_INVALID`, `OTP_RATE_LIMITED`, `TOKEN_*`, `PERMISSION_DENIED`, `MODULE_DISABLED`, `TENANT_MISMATCH`, …) |
| `POST /auth/login` `{ orgCode?, email, password, deviceId, deviceName }`                     | Staff/students; `orgCode` from config/sub-domain/school code; omitted for platform admins                                                                                                                                  |
| `twoFactorRequired` + `challengeToken` → `POST /auth/2fa/verify` (`code` or `recoveryCode`)  | 2FA step with recovery-code fallback                                                                                                                                                                                       |
| `POST /auth/otp/request` (202) / `otp/verify` `{ orgCode, phone, code }`                     | Parent OTP; client-side 30 s resend cooldown                                                                                                                                                                               |
| `POST /auth/refresh` `{ refreshToken }`, rotation + `REFRESH_TOKEN_REUSED`                   | Refresh token kept in localStorage; refreshes serialized across tabs (Web Locks) and the latest token re-read inside the lock, so a rotated token is never replayed                                                        |
| `POST /auth/logout` (bearer)                                                                 | Server revoke, then local clear + cross-tab logout                                                                                                                                                                         |
| `POST /auth/2fa/setup` / `2fa/enable`, `twoFactorSetupRequired`, `TWO_FACTOR_SETUP_REQUIRED` | Mandatory enrolment page (QR, secret, recovery codes); guards and the error interceptor route there                                                                                                                        |
| `GET /me/access`                                                                             | `AccessStore`: modules, permissions (`scopes`, `orgWide`, `branchIds`), roles, branches, `scope` relations                                                                                                                 |
| `x-tenant`, `x-branch-id` headers                                                            | Sent on every API call; branch switcher in the user menu                                                                                                                                                                   |
| Access catalog (`modules/access/catalog`)                                                    | Registry keyed to it; vendored for mocks/tests (`npm run catalog:sync`)                                                                                                                                                    |

## Requested from the backend

1. **Document the envelope in Swagger** (generic `ApiSuccess<T>` via `@ApiExtraModels` +
   `getSchemaPath`, and the error envelope). The frontend unwraps at runtime today; a documented
   envelope would let the generated client type `meta` directly.
2. **`LoginResponse` as `oneOf`** of `{ twoFactorRequired: false } & TokensResponse` and
   `{ twoFactorRequired: true, challengeToken, challengeExpiresAt }`. Today both branches are
   merged with optional fields, so the client validates at runtime (`tokensFromLogin`).
3. **`operationIdFactory`** in `SwaggerModule.createDocument` (e.g. `(c, m) => m`), so
   generated methods read `login()` rather than `authControllerLoginV1()`.
4. **`GET /tenants/current/branding`** (public; `schoolName`, `shortName`, `logoUrl`,
   `primaryColor`), resolved from `x-tenant`. Mocked today; against the real API the login page
   and shell fall back to the default theme.
5. **Feature flags** in `/me/access` (e.g. `featureFlags: Record<string, boolean>`). The brief asks
   for backend-driven flags; module licensing covers most needs for now.
6. **Children summary for parents** in `/me/access` (`childStudentIds` exists; the child switcher
   also needs name/class/section/photo) or a `GET /me/children` endpoint.
7. **Refresh-token hardening (optional)**: an httpOnly `SameSite=Strict` cookie mode for
   `/auth/refresh` (or a BFF), so the refresh token never touches JS-readable storage. The client
   isolates storage in `TokenStorage`, so switching is local. A few seconds of reuse grace (same
   successor) is also recommended for network retries.
8. **Realtime events** for upcoming features are listed per feature; the transport contract
   (`/realtime` namespace, `auth: { token, branchId }`, `subscribe`/`unsubscribe` acks) is
   consumed as-is.
