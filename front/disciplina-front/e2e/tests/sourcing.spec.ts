import { test, expect } from '@playwright/test';
import { STORAGE_STATE } from '../fixtures/roles';
import { mockExternal } from '../fixtures/mocks';

// 3.4 Sourcing SIRET — dépend d'INSEE/DDG/Ollama : mockés au niveau réseau.
test.use({ storageState: STORAGE_STATE.commercial });

test.describe('3.4 Sourcing @external', () => {
    test('page sourcing accessible et recherche mockée', async ({ page }) => {
        await mockExternal(page);
        await page.goto('/commercial/sourcing');
        await expect(page).toHaveURL(/\/commercial\/sourcing$/);
        await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    });
});
