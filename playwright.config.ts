import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env['E2E_PORT'] ?? 4300);
const baseURL = process.env['E2E_BASE_URL'] ?? `http://localhost:${PORT}`;

/**
 * E2E runs against mock mode (MSW), so it needs no backend. One project per device
 * class so every spec is exercised at phone, tablet and desktop widths.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    {
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 820, height: 1180 }, hasTouch: true },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: process.env['E2E_BASE_URL']
    ? undefined
    : {
        command: `npx ng serve --configuration mock --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env['CI'],
        timeout: 180_000,
      },
});
