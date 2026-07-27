import { test, expect } from '@playwright/test';
import { STORAGE_STATE } from '../fixtures/roles';
import { mockExternal } from '../fixtures/mocks';

// 3.14 Peda / absences — Sheets/Gmail mockés (@external).
test.use({ storageState: STORAGE_STATE.peda });

test.describe('3.14 Peda @external', () => {
    test('suivi des absences accessible', async ({ page }) => {
        await mockExternal(page);
        await page.goto('/peda');
        await expect(page).toHaveURL(/\/peda$/);
        await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    });
});
