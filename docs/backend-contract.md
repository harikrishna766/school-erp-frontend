# Backend contract (frontend expectations)

What `school-erp-frontend` relies on from `school-erp-backend`. Items marked **needed** are
mocked in `src/mocks/` today and not yet in the backend.

## Already aligned

- Base path `/api/v{n}` (Nest global prefix `api`, URI versioning, default `1`).
- Success envelope `{ success: true, data, meta?, requestId }`; list `meta` is `OffsetPageMeta |
CursorPageMeta`. Mirrored in `src/app/core/http/api-envelope.ts`.
- Error envelope `{ success: false, error: { code, message, details? }, requestId, path,
timestamp }`. The UI branches on `error.code` only.
- List query params `page`, `limit` (≤ 100), `cursor`, `mode`, `sort=field:asc,…`, `q`.
- OpenAPI JSON at `/api/docs-json`, used by `npm run api:fetch`.

## Needed

### Tenant resolution

The frontend sends the tenant slug in an **`X-Tenant-Slug`** header (resolved from runtime
config or sub-domain). After login, the tenant should come from the token; the header is only
for unauthenticated endpoints.

### `GET /api/v1/tenants/current/branding` (public)

```json
{
  "success": true,
  "data": {
    "schoolName": "Greenwood International School",
    "shortName": "Greenwood",
    "logoUrl": "https://cdn.example.com/t/greenwood/logo.svg",
    "primaryColor": "#0f6e56"
  }
}
```

`404 NOT_FOUND` for an unknown slug. Please document the response schema in Swagger so the
model is generated rather than hand-written. Cacheable (`Cache-Control: public, max-age=300`).

### Coming in Deliverable 2

- `POST /auth/login`, `POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /auth/refresh`,
  `POST /auth/logout`
- `GET /me/access` → enabled modules (ids as in `MODULE_IDS` in
  `src/app/core/modules/module-def.ts`), permission strings `module:resource:action`, data scopes,
  feature flags.

Swagger should describe the **enveloped** response (e.g. a generic `ApiSuccess<T>` schema via
`@ApiExtraModels` + `getSchemaPath`). Otherwise the generated client types `data` incorrectly.
