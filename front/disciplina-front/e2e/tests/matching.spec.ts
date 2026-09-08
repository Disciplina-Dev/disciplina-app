import { test, expect } from '@playwright/test';
import { STORAGE_STATE } from '../fixtures/roles';
import { mockExternal } from '../fixtures/mocks';

// 3.6 Matching — RH lance un match ; envoi email de match mocké (@external).
test.use({ storageState: STORAGE_STATE.rh });

test.describe('3.6 Matching @external', () => {
    test('page matching accessible', async ({ page }) => {
        await mockExternal(page);
        await page.goto('/rh/matching');
        await expect(page).toHaveURL(/\/rh\/matching(\?.*)?$/);
        await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    });
});
