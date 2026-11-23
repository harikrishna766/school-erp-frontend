import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-branded', '');
  await expect(page.locator('app-shell main')).toBeAttached();
});

test('applies tenant branding from the API', async ({ page }) => {
  const primary = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--brand-primary-light').trim(),
  );
  expect(primary).toMatch(/^#[0-9a-f]{6}$/);
  await expect(page).toHaveTitle(/Home · School ERP/);
});

test.describe('phone layout', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 600, 'phone only');

  test('shows bottom nav and opens the drawer from "More"', async ({ page }) => {
    const bottom = page.getByTestId('bottom-nav');
    await expect(bottom).toBeVisible();
    await expect(page.getByText('Greenwood', { exact: true })).toBeVisible();

    const drawerLink = page.getByTestId('nav-library');
    await expect(drawerLink).not.toBeInViewport();

    await page.getByTestId('bottom-more').click();
    await expect(drawerLink).toBeInViewport();
    await drawerLink.click();

    await expect(page).toHaveURL(/\/library$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Library' })).toBeVisible();
    await expect(drawerLink).not.toBeInViewport();
  });

  test('bottom nav marks the current destination', async ({ page }) => {
    await page.getByTestId('bottom-fees').click();
    await expect(page.getByTestId('bottom-fees')).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('tablet layout', () => {
  test.skip(({ viewport }) => {
    const w = viewport?.width ?? 0;
    return w < 600 || w >= 1240;
  }, 'tablet only');

  test('starts as an icon rail and expands on toggle', async ({ page }) => {
    await expect(page.getByTestId('bottom-nav')).toHaveCount(0);
    const sideNav = page.locator('app-side-nav');
    await expect(sideNav).toHaveClass(/collapsed/);
    await expect(page.getByTestId('nav-toggle')).toHaveAttribute('aria-expanded', 'false');

    await page.getByTestId('nav-toggle').click();
    await expect(sideNav).not.toHaveClass(/collapsed/);
    await expect(page.getByTestId('nav-fees')).toContainText('Fees');

    // Content must reflow beside the expanded nav, not sit underneath it.
    const navWidth = (await sideNav.boundingBox())?.width ?? 0;
    expect(navWidth).toBeGreaterThan(200);
    await expect
      .poll(async () => (await page.locator('main').boundingBox())?.x ?? 0)
      .toBeGreaterThanOrEqual(navWidth);
  });
});

test.describe('desktop layout', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1240, 'desktop only');

  test('shows the full side nav with group headings and no menu button', async ({ page }) => {
    await expect(page.getByTestId('nav-toggle')).toHaveCount(0);
    await expect(page.getByTestId('bottom-nav')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Finance' })).toBeVisible();
    await page.getByTestId('nav-exams').click();
    await expect(page).toHaveURL(/\/exams$/);
    await expect(page.getByTestId('nav-exams')).toHaveAttribute('aria-current', 'page');
  });
});

test('toggles dark mode and remembers it', async ({ page }) => {
  const isDark = (): Promise<boolean> =>
    page.locator('html').evaluate((el) => el.classList.contains('dark'));
  const wasDark = await isDark();

  await page.getByTestId('theme-toggle').click();
  await expect.poll(isDark).toBe(!wasDark);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.style.colorScheme))
    .toBe(wasDark ? 'light' : 'dark');

  await page.reload();
  await expect.poll(isDark).toBe(!wasDark);
});

test('switches language to Telugu', async ({ page }) => {
  await page.getByTestId('language-menu').click();
  await page.getByRole('menuitemradio', { name: 'తెలుగు' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'te');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('స్వాగతం');
});

test('skip link moves focus to main content without leaving the page', async ({ page }) => {
  await page.goto('/fees');
  await expect(page.getByRole('heading', { level: 1, name: 'Fees' })).toBeVisible();
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await expect(page).toHaveURL(/\/fees$/);
});

test('unknown routes render the not-found page inside the shell', async ({ page }) => {
  await page.goto('/does-not-exist');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
