import { type Page, expect } from '@playwright/test';

export const DEMO_PASSWORD = 'demo1234';
export const DEMO_CODE = '123456';

/** Signs in through the real login form (mock API) and waits for the shell. */
export async function signIn(
  page: Page,
  identifier: string,
  password = DEMO_PASSWORD,
): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('identifier').fill(identifier);
  await page.getByTestId('password').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('app-shell main h1')).toBeVisible();
}

/** Records lazy route chunks the page requests (mock build uses named chunks). */
export function trackRouteChunks(page: Page): string[] {
  const chunks: string[] = [];
  page.on('request', (req) => {
    const match = /\/([a-z-]+)\.routes-[A-Z0-9]+\.js/.exec(req.url());
    if (match) chunks.push(match[1]);
  });
  return chunks;
}
