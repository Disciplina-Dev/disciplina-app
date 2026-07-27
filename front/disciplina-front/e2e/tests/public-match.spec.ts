import { test, expect } from '@playwright/test';
import { mockSignedToken } from '../fixtures/mocks';

// 3.7 Comparateur public (match) — parcours invité, signature mockée (@external).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('3.7 Comparateur public @external', () => {
    test('la gate de match se charge sans session', async ({ page }) => {
        await page.goto('/public/match');
        await expect(page.locator('main, form, [role="main"]').first()).toBeVisible();
    });

    test('signature invalide → contenu de rejet', async ({ page }) => {
        await page.route('**/api/match/**/inspect', (route) =>
            route.fulfill({ status: 401, contentType: 'application/json', body: '{"valid":false}' }),
        );
        await page.goto('/public/match/invalid-signature');
        await expect(page.getByText(/invalide|expiré|introuvable|erreur/i).first()).toBeVisible();
    });

    test('signature valide (mockée) → comparateur affiché', async ({ page }) => {
        await mockSignedToken(page, 'match', { candidates: [] });
        await page.goto('/public/match/mock-signature');
        await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    });
});
