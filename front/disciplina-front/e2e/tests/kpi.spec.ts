import { test, expect } from '@playwright/test';
import { STORAGE_STATE } from '../fixtures/roles';

// 3.13 KPI commercial & RH — dashboards sans dépendance external.
test.describe('3.13 KPI — commercial', () => {
    test.use({ storageState: STORAGE_STATE.commercial });
    test('dashboard commercial se charge', async ({ page }) => {
        await page.goto('/commercial');
        await expect(page).toHaveURL(/\/commercial/);
        await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    });
});

test.describe('3.13 KPI — RH', () => {
    test.use({ storageState: STORAGE_STATE.rh });
    test('dashboard RH se charge', async ({ page }) => {
        await page.goto('/rh');
        await expect(page).toHaveURL(/\/rh/);
        await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    });
});
