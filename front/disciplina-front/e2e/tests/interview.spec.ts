import { test, expect } from '@playwright/test';
import { mockSignedToken } from '../fixtures/mocks';

// 3.8 Entretiens — parcours invité, token/créneaux mockés (@external Calendar).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('3.8 Entretiens @external', () => {
    test('la gate d’entretien se charge sans session', async ({ page }) => {
        await page.goto('/public/interview');
        await expect(page.locator('main, form, [role="main"]').first()).toBeVisible();
    });

    test('token valide (mocké) → sélecteur de créneaux', async ({ page }) => {
        await mockSignedToken(page, 'interview', { slots: [] });
        await page.route('**/api/interview/**/slots', (route) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: '{"slots":[]}' }),
        );
        await page.goto('/public/interview/mock-signature');
        await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    });
});
