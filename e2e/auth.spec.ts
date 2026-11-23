import { type Page, expect, test } from '@playwright/test';
import { DEMO_CODE, DEMO_PASSWORD, signIn, trackRouteChunks, withoutFixedSchool } from './support';

async function signInExpectingEnrolment(page: Page) {
  await page.goto('/login');
  await page.getByTestId('email').fill('admin@greenwood.test');
  await page.getByTestId('password').fill(DEMO_PASSWORD);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/security\/two-factor$/);
}

const desktopOnly = ({ viewport }: { viewport: { width: number } | null }) =>
  (viewport?.width ?? 0) < 1240;

test.describe('sign-in and access control', () => {
  test.skip(desktopOnly, 'flow tests run once, at desktop width');

  test('anonymous users are sent to login and returned to where they were going', async ({
    page,
  }) => {
    await page.goto('/students');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fstudents$/);
    await page.getByTestId('email').fill('teacher@greenwood.test');
    await page.getByTestId('password').fill(DEMO_PASSWORD);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL(/\/students$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Students' })).toBeVisible();
  });

  test('teacher: menu is built from permissions and a forbidden module is never downloaded', async ({
    page,
  }) => {
    const chunks = trackRouteChunks(page);
    await signIn(page, 'teacher@greenwood.test');

    const nav = page.locator('app-side-nav');
    await expect(nav.getByTestId('nav-attendance')).toBeVisible();
    await expect(nav.getByTestId('nav-students')).toBeVisible();
    for (const hidden of ['fees', 'admissions', 'reports', 'users', 'core', 'transport']) {
      await expect(nav.getByTestId(`nav-${hidden}`)).toHaveCount(0);
    }

    await page.goto('/fees');
    await expect(page).toHaveURL(/\/forbidden\?reason=permission$/);
    await expect(
      page.getByRole('heading', { name: 'You don’t have access to this page' }),
    ).toBeVisible();
    expect(chunks).not.toContain('fees');
  });

  test('principal: an unlicensed module is blocked even with every permission', async ({
    page,
  }) => {
    const chunks = trackRouteChunks(page);
    await signIn(page, 'principal@greenwood.test');
    await expect(page.getByTestId('nav-hostel')).toHaveCount(0);
    await expect(page.getByTestId('nav-fees')).toBeVisible();

    await page.goto('/hostel');
    await expect(page).toHaveURL(/\/forbidden\?reason=module&module=hostel$/);
    await expect(page.getByRole('heading', { name: 'This module isn’t enabled' })).toBeVisible();
    expect(chunks).not.toContain('hostel');
  });

  test('wrong password shows an inline error, then locks after repeated failures', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByTestId('email').fill('accounts@greenwood.test');
    for (let i = 0; i < 5; i++) {
      await page.getByTestId('password').fill(`wrong-${i}`);
      await page.getByTestId('login-submit').click();
      await expect(page.getByTestId('login-error')).toContainText(
        'Incorrect email/mobile or password',
      );
    }
    await page.getByTestId('password').fill(DEMO_PASSWORD);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-error')).toContainText('temporarily locked');
  });

  test('a disabled account cannot sign in', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('email').fill('disabled@greenwood.test');
    await page.getByTestId('password').fill(DEMO_PASSWORD);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-error')).toContainText('This account is disabled');
  });

  test('platform admin signs in without a school code, with a second factor', async ({ page }) => {
    await withoutFixedSchool(page);
    await page.goto('/login');
    await expect(page.getByTestId('school-code')).toBeVisible();
    await page.getByTestId('platform-login').click();
    await page.getByTestId('email').fill('admin@platform.test');
    await page.getByTestId('password').fill(DEMO_PASSWORD);
    await page.getByTestId('login-submit').click();
    await page.getByTestId('two-factor-code').fill('000000');
    await page.getByTestId('two-factor-submit').click();
    await expect(page.getByTestId('login-error')).toContainText('incorrect or has expired');
    await page.getByTestId('two-factor-code').fill(DEMO_CODE);
    await page.getByTestId('two-factor-submit').click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId('nav-platform')).toBeVisible();
  });

  test('a role that requires 2FA must enrol before using the app, then signs in with a recovery code', async ({
    page,
  }) => {
    await signInExpectingEnrolment(page);
    await expect(page.getByTestId('tfa-secret')).toHaveText('JBSWY3DPEHPK3PXP');
    await expect(page.locator('.qr img')).toBeVisible();
    await page.getByTestId('tfa-code').fill(DEMO_CODE);
    await page.getByTestId('tfa-enable').click();
    await expect(page.getByTestId('tfa-recovery-codes')).toContainText('ABCD-EFGH-1234');
    await page.getByTestId('tfa-finish').click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByTestId('user-menu').click();
    await page.getByTestId('logout').click();
    await page.getByTestId('email').fill('admin@greenwood.test');
    await page.getByTestId('password').fill(DEMO_PASSWORD);
    await page.getByTestId('login-submit').click();
    await page.getByTestId('toggle-recovery').click();
    await page.getByTestId('recovery-code').fill('ABCD-EFGH-1234');
    await page.getByTestId('two-factor-submit').click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('switching branch reloads access for that branch', async ({ page }) => {
    await signIn(page, 'principal@greenwood.test');
    await page.getByTestId('user-menu').click();
    const north = page.getByRole('menuitemradio', { name: 'North campus' });
    await expect(north).toHaveAttribute('aria-checked', 'false');
    const reload = page.waitForRequest(
      (r) =>
        r.url().endsWith('/api/v1/me/access') &&
        r.headers()['x-branch-id']?.endsWith('b2') === true,
    );
    await north.click();
    await reload;
    await page.getByTestId('user-menu').click();
    await expect(page.getByRole('menuitemradio', { name: 'North campus' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('the session survives a reload (refresh-token rotation) and logout ends it', async ({
    page,
  }) => {
    await signIn(page, 'teacher@greenwood.test');
    await page.goto('/attendance');
    await expect(page.getByRole('heading', { level: 1, name: 'Attendance' })).toBeVisible();

    await page.getByTestId('user-menu').click();
    await page.getByTestId('logout').click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/attendance');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fattendance$/);
  });

  test('logging out in one tab logs out the other tabs', async ({ page, context }) => {
    await signIn(page, 'teacher@greenwood.test');
    const other = await context.newPage();
    await other.goto('/students');
    await expect(other.getByRole('heading', { level: 1, name: 'Students' })).toBeVisible();

    await page.getByTestId('user-menu').click();
    await page.getByTestId('logout').click();
    await expect(other).toHaveURL(/\/login/);
  });
});

test.describe('parent on a phone', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 600, 'phone only');

  test('signs in with mobile OTP and gets a parent-shaped app', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('tab', { name: 'Parents' }).click();
    await page.getByTestId('otp-phone').fill('98765 43210');
    await page.getByTestId('otp-request').click();
    await expect(page.getByText('+91 98765 43210')).toBeVisible();
    await expect(page.getByTestId('otp-resend')).toBeDisabled();

    await page.getByTestId('otp-code').fill(DEMO_CODE);
    await page.getByTestId('otp-submit').click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('app-shell main h1')).toContainText('Hello, Sita');

    const bar = page.getByTestId('bottom-nav');
    await expect(bar.getByTestId('bottom-attendance')).toBeVisible();
    await expect(bar.getByTestId('bottom-timetable')).toBeVisible();
    await page.getByTestId('bottom-more').click();
    await expect(page.getByTestId('nav-fees')).toBeVisible();
    await expect(page.getByTestId('nav-users')).toHaveCount(0);
  });

  test('an unregistered number gets the same response, then fails at the code', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByRole('tab', { name: 'Parents' }).click();
    await page.getByTestId('otp-phone').fill('91234 56789');
    await page.getByTestId('otp-request').click();
    await page.getByTestId('otp-code').fill(DEMO_CODE);
    await page.getByTestId('otp-submit').click();
    await expect(page.getByTestId('login-error')).toContainText('incorrect or has expired');
  });
});
