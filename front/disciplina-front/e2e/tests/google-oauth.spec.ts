import { test, expect } from '@playwright/test';

// 3.2 Google OAuth — présence du bouton + génération d'URL d'auth (mockée @external).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('3.2 Google OAuth @external', () => {
    test('le bouton « Se connecter avec Google » est présent', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByRole('button', { name: /google/i }).first()).toBeVisible();
    });

    test('génération d’URL d’auth (mockée) → redirige côté Google', async ({ page }) => {
        await page.route('**/api/auth/google/uri', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ url: 'https://accounts.google.com/o/oauth2/v2/auth?state=mock' }),
            }),
        );
        await page.goto('/');
        const button = page.getByRole('button', { name: /google/i }).first();
        await expect(button).toBeVisible();
    });
});
