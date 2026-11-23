import { expect, test } from '@playwright/test';
import { signIn } from './support';

test.describe('timetable viewer', () => {
  test('opens the draft by section, switches to a teacher and moves focus by keyboard', async ({
    page,
    viewport,
  }) => {
    await signIn(page, 'principal@greenwood.test');
    await page.goto('/timetable');
    const grid = page.locator('app-timetable-grid');
    await expect(page.getByTestId('version-status')).toHaveText('Draft');
    await expect(grid.locator('.entry').first()).toBeVisible();

    const first = grid.locator('[data-row="0"][data-col="0"]');
    await expect(first).toHaveAttribute('aria-label', /Monday, P1/);
    await first.focus();
    await page.keyboard.press('ArrowRight');
    await expect(grid.locator('[data-row="0"][data-col="1"]')).toBeFocused();

    await page.getByTestId('mode-teacher').click();
    await expect(page.getByTestId('target-select')).toContainText('Ravi Kumar');

    if ((viewport?.width ?? 0) >= 600) {
      await page.getByTestId('layout-master').click();
      await expect(grid.locator('[role="rowheader"]').first()).toHaveText('Ravi Kumar');
    }
  });

  test('a teacher can view timetables on a phone', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) >= 600, 'phone only');
    await signIn(page, 'teacher@greenwood.test');
    await page.getByTestId('bottom-timetable').click();
    await expect(page).toHaveURL(/\/timetable$/);
    await expect(page.locator('app-timetable-grid .entry').first()).toBeVisible();
    await expect(page.getByTestId('layout-master')).toHaveCount(0);
  });
});
