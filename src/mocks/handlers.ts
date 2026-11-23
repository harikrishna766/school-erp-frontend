import { HttpResponse, bypass, delay, http, passthrough } from 'msw';
import { authHandlers } from './auth/handlers';
import { MOCK_TENANTS } from './data/tenants';
import { timetableHandlers } from './timetable/handlers';
import { fail, ok } from './envelope';

/** Matches any configured API base (`/api/v1`, `https://host/api/v1`). */
const api = (path: string): string => `*/api/v1${path}`;

export const handlers = [
  // Lets e2e simulate other deployments (e.g. a platform host with no fixed school):
  // localStorage['msw.config'] = JSON merged over the real runtime config.
  http.get('*/config/app-config.json', async ({ request }) => {
    const override = localStorage.getItem('msw.config');
    if (!override) {
      return passthrough();
    }
    const base = (await (await fetch(bypass(request))).json()) as object;
    return HttpResponse.json({ ...base, ...(JSON.parse(override) as object) });
  }),
  ...authHandlers,
  ...timetableHandlers,
  http.get(api('/tenants/current/branding'), async ({ request }) => {
    await delay(150);
    const slug = request.headers.get('x-tenant') ?? '';
    const branding = MOCK_TENANTS[slug];
    return branding
      ? ok(branding)
      : fail(404, 'NOT_FOUND', `Unknown school "${slug}"`, new URL(request.url).pathname);
  }),
];
