import { test, expect } from '@playwright/test';
import { STORAGE_STATE } from '../fixtures/roles';
import { mockExternal } from '../fixtures/mocks';

// 3.5 Analyse de Besoin — création côté commercial ; Drive/PDF mockés (@external).
test.use({ storageState: STORAGE_STATE.commercial });

test.describe('3.5 Analyse de Besoin @external', () => {
    test('liste des analyses de besoin accessible', async ({ page }) => {
        await mockExternal(page);
        await page.goto('/commercial/analyses-besoin');
        await expect(page).toHaveURL(/\/commercial\/analyses-besoin$/);
        await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    });

    test('formulaire de création accessible', async ({ page }) => {
        await mockExternal(page);
        await page.goto('/commercial/analyses-besoin/nouvelle');
        await expect(page).toHaveURL(/\/analyses-besoin\/nouvelle$/);
        await expect(page.locator('form, main').first()).toBeVisible();
    });
});
