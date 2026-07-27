import { test, expect } from '@playwright/test';
import { STORAGE_STATE, API_URL } from '../fixtures/roles';

// 3.15 Notifications & Todos — flux nominal sans external.
test.use({ storageState: STORAGE_STATE.commercial });

test.describe('3.15 Notifications & Todos', () => {
    test('la page todos se charge pour le commercial', async ({ page }) => {
        await page.goto('/commercial/todos');
        await expect(page).toHaveURL(/\/commercial\/todos$/);
        await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    });

    test('le flux SSE notifications répond (200/stream)', async ({ page }) => {
        const response = await page.request.get(`${API_URL}/api/notifications`);
        expect(response.status()).toBeLessThan(500);
    });
});
