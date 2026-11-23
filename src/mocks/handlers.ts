import { delay, http } from 'msw';
import { MOCK_TENANTS } from './data/tenants';
import { fail, ok } from './envelope';

/** Matches any configured API base (`/api/v1`, `https://host/api/v1`). */
const api = (path: string): string => `*/api/v1${path}`;

export const handlers = [
  http.get(api('/tenants/current/branding'), async ({ request }) => {
    await delay(150);
    const slug = request.headers.get('X-Tenant-Slug') ?? '';
    const branding = MOCK_TENANTS[slug];
    return branding
      ? ok(branding)
      : fail(404, 'NOT_FOUND', `Unknown school "${slug}"`, new URL(request.url).pathname);
  }),
];
