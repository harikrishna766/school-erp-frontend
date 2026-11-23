# Backend contract (frontend expectations)

What `school-erp-frontend` relies on from `school-erp-backend`. Everything under **Needed** is
served by MSW mocks today (`src/mocks/`). The frontend types for it are marked PROVISIONAL and
get replaced by the generated client once these endpoints appear in the OpenAPI document.

## Already aligned

- Base path `/api/v{n}` (Nest global prefix `api`, URI versioning, default `1`).
- Success envelope `{ success: true, data, meta?, requestId }`; list `meta` is `OffsetPageMeta |
CursorPageMeta`. Mirrored in `src/app/core/http/api-envelope.ts`.
- Error envelope `{ success: false, error: { code, message, details? }, requestId, path, timestamp }`.
  The UI branches on `error.code` only.
- List query params `page`, `limit` (≤ 100), `cursor`, `mode`, `sort=field:asc,…`, `q`.
- OpenAPI JSON at `/api/docs-json`, used by `npm run api:fetch`.
- **Access catalog** (`src/modules/access/catalog`): module keys, `module:resource:action`
  permissions, role templates and `matchesPermission` semantics. The frontend registry is keyed
  to these, and a unit test fails if it references an unknown module or permission.

## Needed

Please describe **enveloped** responses in Swagger (e.g. a generic `ApiSuccess<T>` via
`@ApiExtraModels` + `getSchemaPath`), or the generated client will type `data` incorrectly.

### Tenant resolution

Every API request carries **`X-Tenant-Slug`** (from runtime config, the sub-domain, or the school
code typed at login). Unauthenticated endpoints resolve the organization from it. For
authenticated requests the organization must come from the token, and a mismatching header
should be rejected (`403 FORBIDDEN`).

### `GET /tenants/current/branding` (public)

```json
{
  "schoolName": "Greenwood International School",
  "shortName": "Greenwood",
  "logoUrl": "https://cdn.example.com/t/greenwood/logo.svg",
  "primaryColor": "#0f6e56"
}
```

`404 NOT_FOUND` for an unknown slug. Cacheable (`Cache-Control: public, max-age=300`).

### Auth

All `/auth/*` calls are made with `credentials: include`. The **refresh token is an httpOnly,
Secure, SameSite=Strict cookie** scoped to `Path=/api/v1/auth`, and is never in a response body.
For a cross-origin API, CORS must allow credentials for the app origin (already
`credentials: true` in `app.setup.ts`; `CORS_ORIGINS` must list the app).

| Endpoint                 | Body                                                                        | Success `data`                                                                                                               | Errors                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `POST /auth/login`       | `{ identifier, password, deviceId }`; identifier is an email or E.164 phone | `{ status: 'AUTHENTICATED', accessToken, expiresIn }` + sets cookie, **or** `{ status: 'TWO_FACTOR_REQUIRED', challengeId }` | `401 UNAUTHENTICATED` (same for unknown user and wrong password), `403 FORBIDDEN` (disabled), `429 RATE_LIMITED` (lockout) |
| `POST /auth/2fa/verify`  | `{ challengeId, code, deviceId }`                                           | `{ accessToken, expiresIn }` + cookie                                                                                        | `401 UNAUTHENTICATED`                                                                                                      |
| `POST /auth/otp/request` | `{ phone, channel: 'SMS' \| 'WHATSAPP' }`                                   | `{ challengeId, expiresIn, resendAfter }`, returned **even for unregistered numbers** (no enumeration; send nothing)         | `429 RATE_LIMITED`                                                                                                         |
| `POST /auth/otp/verify`  | `{ challengeId, code, deviceId }`                                           | `{ accessToken, expiresIn }` + cookie                                                                                        | `401 UNAUTHENTICATED`                                                                                                      |
| `POST /auth/refresh`     | `{}` (cookie)                                                               | `{ accessToken, expiresIn }` + **rotated** cookie                                                                            | `401 UNAUTHENTICATED`                                                                                                      |
| `POST /auth/logout`      | `{}` (cookie)                                                               | `null`; revokes the session, clears the cookie                                                                               | none (always succeeds)                                                                                                     |

`expiresIn` is in seconds. The client refreshes about 30 s before expiry and once on any 401.

**Reuse detection and concurrency.** The client serialises refreshes across tabs (Web Locks)
and shares the new access token between tabs, so a correctly behaving browser never presents a
rotated token twice. A short grace window (a few seconds, returning the same successor) is
still recommended for network retries; beyond it, `REUSE_DETECTED` should revoke the family as
designed.

### `GET /me/access` (bearer)

```jsonc
{
  "user": { "id", "type": "STAFF|PARENT|STUDENT|PLATFORM", "firstName", "lastName", "email", "phone", "avatarUrl" },
  "org": { "id", "name" } | null,
  "activeBranchId": "…" | null,
  "branches": [{ "id", "name" }],
  "roles": [{ "key": "TEACHER", "name": "Teacher" }],
  "modules": ["core", "users", "students", "attendance", …],   // enabled for the org, incl. core
  "permissions": [{ "key": "attendance:student:mark", "scope": "SECTION" }, …],
  "featureFlags": { "offlineAttendance": true },
  "children": [{ "studentId", "name", "className", "sectionName", "photoUrl" }]  // parents; [] otherwise
}
```

`permissions` should be the **expanded** result of `resolveRoleGrants` across the user's active
roles (`*` patterns are tolerated but not required). Call it again after role or licence changes;
the frontend re-fetches on next sign-in, or via `AccessStore.reload()`.
