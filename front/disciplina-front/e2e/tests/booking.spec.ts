import { test, expect } from '@playwright/test';

// 3.9 Booking / calendrier — parcours public par slug, créneaux mockés (@external).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('3.9 Booking @external', () => {
    test('la page de réservation publique se charge', async ({ page }) => {
        await page.route('**/api/booking/public/**', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ owner: 'e2e', slots: [] }),
            }),
        );
        await page.goto('/booking/mock-slug');
        await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    });
});
