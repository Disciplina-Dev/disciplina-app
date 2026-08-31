import { test, expect } from '@playwright/test';
import { ROLES, E2E_PASSWORD } from '../fixtures/roles';

// 3.1 Authentification — login/redirection/me/logout + rejet mauvais mot de passe.
// Ce spec démarre non authentifié (pas de storageState).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('3.1 Authentification', () => {
    test('mauvais mot de passe → message d’erreur, reste sur /', async ({ page }) => {
        await page.goto('/');
        await page.getByRole('textbox', { name: 'Adresse email' }).fill(ROLES.rh.email);
        await page.getByRole('textbox', { name: 'Mot de passe' }).fill('wrong-password');
        await page.getByRole('button', { name: /Se connecter/ }).click();
        await expect(page.getByText(/invalid|incorrect|invalide|erreur/i)).toBeVisible();
        await expect(page).toHaveURL(/\/$/);
    });

    for (const [role, account] of Object.entries(ROLES)) {
        test(`login ${role} → redirection ${account.home}`, async ({ page }) => {
            await page.goto('/');
            await page.getByRole('textbox', { name: 'Adresse email' }).fill(account.email);
            await page.getByRole('textbox', { name: 'Mot de passe' }).fill(E2E_PASSWORD);
            await page.getByRole('button', { name: /Se connecter/ }).click();
            await expect(page).toHaveURL(new RegExp(`${account.home}$`));
        });
    }

    test('route protégée sans session → redirection vers /', async ({ page }) => {
        await page.goto('/rh/candidats');
        await expect(page).toHaveURL(/\/$/);
    });
});
