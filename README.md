# school-erp-frontend

Responsive, installable Angular frontend for the multi-tenant **School ERP**. It consumes the
REST + WebSocket API of [`school-erp-backend`](../school-erp-backend) (NestJS; OpenAPI at
`/api/docs`).

|           |                                                                                            |
| --------- | ------------------------------------------------------------------------------------------ |
| Framework | Angular 22: standalone components, signals, `@if`/`@for`, zoneless, strict TS              |
| State     | NgRx SignalStore (one store per feature)                                                   |
| UI        | Angular Material 3 + Tailwind CSS 4, light/dark, per-school branding                       |
| i18n      | ngx-translate: English, Telugu, Hindi; RTL-safe layout                                     |
| PWA       | `@angular/service-worker` (offline queue for attendance/marks arrives with those features) |
| API       | Client generated from the backend OpenAPI spec (`openapi-generator`, typescript-angular)   |
| Mocks     | MSW: the whole UI runs without a backend                                                   |
| Tests     | Vitest (unit, via `ng test`), Playwright (e2e at phone/tablet/desktop)                     |
| Quality   | ESLint (angular-eslint), Prettier, Husky + lint-staged + commitlint, GitHub Actions        |
| Ship      | Docker (nginx-unprivileged) with runtime config from env vars                              |

---

## Quick start

```bash
nvm use            # Node 22 (see .nvmrc), same as the backend
npm ci
npm run start:mock # http://localhost:4200 with mocked API (no backend needed)
```

Against a local backend on `:3000` (proxied via `proxy.conf.json`):

```bash
npm start
```

### Scripts

| Script                                           | What it does                                              |
| ------------------------------------------------ | --------------------------------------------------------- |
| `start` / `start:mock`                           | Dev server against the real API / against MSW mocks       |
| `build`                                          | Production build (`dist/school-erp-frontend/browser`)     |
| `build:mock`                                     | Optimised build that still uses mocks (demos, Lighthouse) |
| `test` / `test:watch` / `test:cov`               | Vitest unit tests                                         |
| `e2e` / `e2e:ui`                                 | Playwright against the mock dev server, at 3 device sizes |
| `lint` / `format` / `format:check` / `typecheck` | Static checks (all run in CI)                             |
| `size:check`                                     | Fails if the **initial** bundle exceeds 300 KB gzipped    |
| `icons:check` / `icons:sync`                     | Verify / regenerate the Material Symbols font subset      |
| `api:fetch` / `api:generate` / `api:update`      | Snapshot the OpenAPI spec / regenerate the client / both  |

Java 17+ is needed only for `api:generate` (openapi-generator is a JVM tool).

---

## Folder structure

```
src/
├── app/
│   ├── core/                 singletons, no UI
│   │   ├── access/           AccessStore (GET /me/access), permission matching
│   │   ├── auth/             AuthStore, auth API, cross-tab session sync
│   │   ├── config/           runtime AppConfig (fetched before bootstrap)
│   │   ├── errors/           global ErrorHandler
│   │   ├── guards/           authGuard, guestGuard, moduleGuard, permissionGuard
│   │   ├── http/             envelope types, interceptors, loading state
│   │   ├── notify/           ToastService
│   │   ├── i18n/             LanguageService, translated page titles
│   │   ├── layout/           BreakpointService (phone | tablet | desktop)
│   │   ├── modules/          ModuleDef contract + MODULE_REGISTRY token
│   │   ├── storage/          safe localStorage for UI prefs
│   │   ├── tenant/           tenant resolution, BrandingStore (SignalStore)
│   │   └── theme/            ThemeService, WCAG colour maths
│   ├── shared/
│   │   ├── ui/               dumb reusable components (empty-state, skeleton, …)
│   │   ├── forms/            typed validators, field-error pipe
│   │   └── directives/       *hasPermission
│   ├── layout/               shell, header, side-nav, bottom-nav, navigation, auth (login),
│   │                         dashboards, forbidden, not-found
│   ├── features/<module>/    one lazy folder per module (19), each with <module>.routes.ts
│   ├── api/generated/        openapi-generator output: never edit by hand
│   ├── module-registry.ts    THE list of modules → drives routes and menus
│   ├── app.routes.ts         routes generated from the registry
│   └── app.config.ts         providers
├── mocks/                    MSW handlers + data (compiled only in mock builds)
│   └── data/backend-catalog/ vendored backend access catalog (npm run catalog:sync)
├── environments/             build-time switches only
├── testing/                  shared test providers/doubles
├── styles.scss               Material 3 theme + brand overrides
└── tailwind.css              Tailwind with colours bridged to Material tokens
public/
├── config/app-config.json    runtime config (rewritten by the container on start)
└── i18n/{en,te,hi}.json
e2e/                          Playwright specs
docker/                       nginx config, runtime-config entrypoint
openapi/                      committed OpenAPI snapshot the client is generated from
```

### Adding a feature module

1. Add the id to `MODULE_IDS` in `core/modules/module-def.ts`. It must be the backend's module key;
   a test compares it with the vendored catalog.
2. Create `features/<folder>/<folder>.routes.ts` with a **default export** of `Routes`. Add
   `canMatch: [permissionGuard('…')]` on screens that need more than the entry permission.
3. Add one entry to `module-registry.ts` (path, label key, icon, group, `viewPermissions`, which
   must exist in the backend catalog; a test checks this too).
4. Add `nav.<id>` to all three files in `public/i18n/`, then run `npm run icons:sync`.

The route, side-nav entry, phone bottom-bar slot (if `mobilePriority` is set) and lazy chunk all
follow from the registry. Nothing else is hand-wired. A unit test fails if the registry and
`MODULE_IDS` drift apart.

---

## Authentication and access control

**Sign-in.** Staff and students use email plus password, followed by a TOTP or recovery code when
2FA is enabled. Platform administrators sign in without a school code. Parents use mobile plus SMS OTP; parents often have no password, matching the backend's
`passwordHash NULL` accounts. If neither runtime config nor the sub-domain identifies the school,
the login page asks for a school code first. `returnUrl` is honoured only for same-app paths, so it
can't be used as an open redirect.

**Tokens.** The access token lives **in memory only**. The backend returns the refresh token in
the body and expects it back in `POST /auth/refresh`, so `TokenStorage` keeps it in localStorage
(isolated in one class so it can move to an httpOnly cookie, a BFF, or Capacitor secure storage).
Mitigations: strict CSP, short-lived access tokens, rotation on every refresh, and backend reuse
detection that revokes the session family. Startup makes **no** network call when there is no
stored session. Concurrency:

- inside a tab, refreshes are single-flight;
- across tabs, refreshes are serialised with the Web Locks API, and the latest stored refresh
  token is re-read inside the lock, so a rotated token is never presented twice
  (`REFRESH_TOKEN_REUSED` would revoke the whole session family);
- a fresh access token or a logout is broadcast to the other tabs.

**2FA.** Roles listed in the backend's `AUTH_REQUIRE_2FA_ROLES` must enrol before anything else
(`twoFactorSetupRequired`). Guards, and the error interceptor on `TWO_FACTOR_SETUP_REQUIRED`, send
them to `/security/two-factor` (QR code, manual key, recovery codes).

**Interceptors** (in order): loading → error (toast by backend `error.code`; 401s never toasted)
→ tenant (`x-tenant`, `x-branch-id`) → auth (bearer, refresh shortly before expiry, one
refresh-and-retry on 401, then session expired → login with return URL) → envelope (unwraps
`{ success, data }` so generated types match). Tokens and context headers are only ever sent to
`apiBaseUrl`.

**Access.** After sign-in, `GET /me/access` fills the `AccessStore`: enabled modules, effective
permissions with data scope, roles, feature flags and (for parents) children. Everything reads
from it:

| Mechanism                  | Rule                                                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Menu (`NavigationService`) | Module licensed **and** user holds any of its `viewPermissions`                                                               |
| Module routes              | `canMatch: [moduleGuard(id), permissionGuard(viewPermissions)]`: a failing `canMatch` means the chunk is **never downloaded** |
| Screens                    | `canMatch: [permissionGuard('fees:invoice:create')]` inside a feature's routes                                                |
| Buttons/sections           | `*hasPermission="'fees:invoice:create'"`, `*hasPermission="[a, b]; mode: 'all'; else ro"`                                     |

Guards redirect to `/forbidden`, which distinguishes "module not enabled for your school" from
"your role can't do this". Permission matching follows the backend's `matchesPermission`
(`fees:*:*`). Hiding UI is a convenience only; the backend enforces every permission.

**Demo accounts** (mock mode, password `demo1234`, codes `123456`):

| Who            | Sign in with               | Notes                                                              |
| -------------- | -------------------------- | ------------------------------------------------------------------ |
| Principal      | `principal@greenwood.test` | Everything licensed; Hostel and AI are unlicensed; two branches    |
| Org admin      | `admin@greenwood.test`     | Must enrol in 2FA first; then recovery code `ABCD-EFGH-1234` works |
| Teacher        | `teacher@greenwood.test`   | Section-scoped; no Fees/Admissions/Reports                         |
| Accountant     | `accounts@greenwood.test`  | Fees + payroll                                                     |
| Student        | `student@greenwood.test`   | Own records                                                        |
| Parent         | Parents tab, `98765 43210` | OTP                                                                |
| Platform admin | `admin@platform.test`      | Needs a host without a fixed school; 2FA                           |
| Disabled       | `disabled@greenwood.test`  | Shows the disabled-account error                                   |

Mock roles come from the backend's real catalog (`npm run catalog:sync`) and the mock handlers
are typed with the generated DTOs. Five wrong passwords lock an account (`ACCOUNT_LOCKED`). For
development: `localStorage['msw.accessTtl'] = '5'` forces fast access-token expiry, and
`localStorage['msw.config'] = '{"tenantSlug":null}'` simulates a host without a fixed school.

## Responsive shell

Breakpoints follow Material 3 window classes and are shared by `BreakpointService`, Tailwind
(`sm` = 600, `xl` = 1240) and the SCSS.

| Device  | Width    | Side nav                          | Bottom bar                       | Menu button |
| ------- | -------- | --------------------------------- | -------------------------------- | ----------- |
| Phone   | < 600    | Modal drawer ("More" or ☰)       | Home + 3 priority modules + More | yes         |
| Tablet  | 600–1239 | Icon rail ⇄ expanded (remembered) | no                               | yes         |
| Desktop | ≥ 1240   | Always expanded, grouped          | no                               | no          |

Accessibility in the shell: skip link, `aria-current` on the active destination, `aria-expanded`
on nav toggles, tooltips/labels on the icon rail, ≥ 48 px touch targets, visible focus rings,
`prefers-reduced-motion` respected, safe-area insets for notched phones.

## Theming and branding

- Material 3 tokens are emitted with `light-dark()`, so `ThemeService` switches themes by setting
  `color-scheme` on `<html>` (plus a `.dark` class for Tailwind's `dark:` variant). The stored
  choice is applied by an inline script before first paint, so there is no flash.
- A school's `primaryColor` (from `GET /tenants/current/branding`) is run through
  `derivePalette()`, which nudges colours until every text/background pair meets **WCAG AA
  4.5:1** in both themes. A pastel or neon brand colour can't produce unreadable buttons. The
  unit tests check this for several hostile colours.
- In templates, prefer Material components and `var(--mat-sys-*)`. Tailwind colour utilities
  (`bg-surface-container`, `text-primary`, …) map to the same tokens.
- RTL-safe: SCSS uses logical properties (`inset-inline-*`, `padding-inline`, …). Use Tailwind's
  logical utilities (`ms-*`, `pe-*`, `start-*`) rather than `ml-*`/`right-*`. The shell feeds the
  language's direction into CDK `Directionality`.

## i18n

`public/i18n/{en,te,hi}.json`. Route `title`s are translation keys rendered by
`TranslatedTitleStrategy`. Language is chosen in this order: saved choice, then browser
language, then `defaultLanguage` from runtime config.

> The Telugu and Hindi strings are machine-assisted first drafts. Have a native speaker review
> them before release.

## Runtime configuration

`/config/app-config.json` is fetched **before** bootstrap, so one build or image serves every
environment:

```json
{ "apiBaseUrl": "/api/v1", "wsUrl": "/", "defaultLanguage": "en", "tenantSlug": "demo" }
```

`tenantSlug: null` means the tenant comes from the sub-domain (`greenwood.example.com` →
`greenwood`). Feature flags will come from the backend (`/me/access`), not from this file.

## Mock mode

`npm run start:mock` builds with the `mock` configuration, which swaps `src/mocks/mock-start.ts`
for a version that starts MSW. Production builds never compile MSW. Handlers return the exact
backend envelope (`{ success, data, meta?, requestId }`), so the same code runs against mocks
and against the real API. Demo tenants live in `src/mocks/data/tenants.ts` (`demo`, `sunrise`).

## API client

```bash
npm run api:export     # build + export from ../school-erp-backend, no DB needed
# or: npm run api:fetch  (from a running backend)
npm run api:generate   # → src/app/api/generated (commit both)
```

The backend's OpenAPI document describes unwrapped payloads; `envelopeInterceptor` unwraps the
runtime envelope so the generated return types are accurate.

CI regenerates from the committed snapshot and fails on drift. Generated code is lint- and
format-ignored. Wrap it in feature stores; don't hand-write DTOs.

## Performance budget

- `npm run size:check` gzips everything `index.html` loads up front and fails above **300 KB**.
  Current: **~121 KB**.
- Every feature module is a separate lazy chunk. The service worker caches JS **lazily**, so a
  module the user can't access is never downloaded, online or offline.
- The Material Symbols font is subset to the icons we use (`npm run icons:sync`; CI checks it).
  Noto Telugu/Devanagari faces load only when those scripts appear.

## Docker

```bash
docker build -t school-erp-frontend .
docker run -p 8080:8080 \
  -e API_BASE_URL=https://api.example.com/api/v1 \
  -e WS_URL=https://api.example.com \
  -e CSP_CONNECT_SRC="https://api.example.com wss://api.example.com" \
  school-erp-frontend
```

| Env var            | Default   | Purpose                                                              |
| ------------------ | --------- | -------------------------------------------------------------------- |
| `API_BASE_URL`     | `/api/v1` | REST base URL                                                        |
| `WS_URL`           | `/`       | Socket.IO origin                                                     |
| `DEFAULT_LANGUAGE` | `en`      | `en` \| `te` \| `hi`                                                 |
| `TENANT_SLUG`      | _(empty)_ | Pin a tenant (single-school install). Empty means use the sub-domain |
| `CSP_CONNECT_SRC`  | `'self'`  | Extra `connect-src` origins (API, WebSocket)                         |

nginx serves hashed bundles as immutable, `index.html`/`ngsw*`/config/i18n as `no-cache`, plus
HSTS, CSP (script hashes from Angular `autoCsp`), `nosniff`, `Permissions-Policy` (camera and
geolocation allowed for QR attendance and bus tracking). Build with
`--build-arg BUILD_CONFIGURATION=mock-production` for a backend-less demo image.

## Testing

- **Unit** (`npm test`): pure logic (colour contrast, config parsing, tenant resolution),
  services and stores, registry invariants, and every layout component at each breakpoint.
- **E2E** (`npm run e2e`): runs each spec in `phone`, `tablet` and `desktop` projects against mock
  mode: drawer/rail/bottom-bar behaviour, branding, theme persistence, language switch, skip
  link, 404.

## Troubleshooting

- **`Inlining of fonts failed … unable to get local issuer certificate`** during `ng build`: your
  network intercepts TLS with a CA Node doesn't trust. Run with `NODE_USE_SYSTEM_CA=1` (Node ≥
  22.15), or set `NODE_EXTRA_CA_CERTS=/path/to/ca.pem`.
- **`Cannot statically analyze bootstrapApplication`** from `ng add`: `main.ts` loads runtime config
  before bootstrapping, which some schematics can't parse. Apply their changes by hand.

## Roadmap

1. ✅ Setup, structure, theming, responsive shell
2. ✅ Auth (password + 2FA, parent OTP, rotating refresh), interceptors, AccessStore
   (`GET /me/access`), dynamic menu, `moduleGuard`/`permissionGuard`, `*hasPermission`
3. Role × permission matrix editor, module licensing
4. Shared data-table (virtual scroll, server paging/sort/filter) and form components
5. Students → attendance (offline) → fees (Razorpay/UPI) → exams/report cards → parent app
   views (Capacitor wrapper lands with the parent app)

See [`docs/backend-contract.md`](docs/backend-contract.md) for the endpoints the frontend expects.
