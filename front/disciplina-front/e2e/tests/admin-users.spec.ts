import { test, expect } from '@playwright/test';
import { STORAGE_STATE, API_URL } from '../fixtures/roles';

// 3.16 Admin utilisateurs — accès CRUD + annuaire sans champs sensibles.
test.use({ storageState: STORAGE_STATE.admin });

test.describe('3.16 Admin utilisateurs', () => {
    test('accès à la liste des utilisateurs', async ({ page }) => {
        await page.goto('/admin/utilisateurs');
        await expect(page).toHaveURL(/\/admin\/utilisateurs$/);
        await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    });

    test('formulaire de création accessible', async ({ page }) => {
        await page.goto('/admin/utilisateurs/nouveau');
        await expect(page.getByLabel(/mot de passe/i).first()).toBeVisible();
    });

    // Validation client : mots de passe non concordants → erreur affichée, aucune création.
    test('création — mots de passe divergents bloquent la soumission', async ({ page }) => {
        await page.goto('/admin/utilisateurs/nouveau');
        await page.getByLabel('Prénom').fill('Jean');
        await page.getByLabel('Nom', { exact: true }).fill('Dupont');
        await page.getByLabel('Adresse email').fill('jean.dupont@e2e.test');
        await page.getByLabel('Mot de passe', { exact: true }).fill('E2ePassw0rd!');
        await page.getByLabel('Confirmer le mot de passe').fill('autre');
        await expect(page.getByText('Les mots de passe ne correspondent pas')).toBeVisible();
        await page.getByRole('button', { name: /Créer l'utilisateur/ }).click();
        await expect(page.getByText(/créé avec succès/)).toHaveCount(0);
    });

    // Validation client : email malformé → la validation HTML5 bloque le submit,
    // aucune bannière de succès.
    test('création — un email malformé bloque la soumission', async ({ page }) => {
        await page.goto('/admin/utilisateurs/nouveau');
        await page.getByLabel('Prénom').fill('Jean');
        await page.getByLabel('Nom', { exact: true }).fill('Dupont');
        await page.getByLabel('Adresse email').fill('pasunemail');
        await page.getByLabel('Mot de passe', { exact: true }).fill('E2ePassw0rd!');
        await page.getByLabel('Confirmer le mot de passe').fill('E2ePassw0rd!');
        await page.getByRole('button', { name: /Créer l'utilisateur/ }).click();
        await expect(page.getByText(/créé avec succès/)).toHaveCount(0);
    });

    test('l’annuaire n’expose pas email/token/mot de passe', async ({ page }) => {
        const response = await page.request.get(`${API_URL}/api/auth/directory`);
        expect(response.ok()).toBeTruthy();
        const body = await response.text();
        expect(body).not.toMatch(/"(email|password|token|refreshToken|oauthToken)"/);
    });
});
