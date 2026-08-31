import { test, expect } from '@playwright/test';
import { STORAGE_STATE, ROLES } from '../fixtures/roles';

// 3.3 Gestion candidats — liste (RH) puis ouverture d'une fiche.
test.use({ storageState: STORAGE_STATE.rh });

test.describe('3.3 Candidats', () => {
    test('la liste des candidats se charge', async ({ page }) => {
        await page.goto('/rh/candidats');
        await expect(page).toHaveURL(/\/rh\/candidats(\?|$)/);
        await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    });

    test('la recherche est disponible', async ({ page }) => {
        await page.goto('/rh/candidats');
        const search = page.getByRole('searchbox').or(page.getByPlaceholder(/recherch/i));
        await expect(search.first()).toBeVisible();
    });

    // Formulaires d'écriture : rendu + validation client uniquement (aucune soumission en base).
    test('création — le formulaire expose les champs requis', async ({ page }) => {
        await page.goto('/rh/candidats');
        await page.getByRole('button', { name: /^Nouveau$/ }).click();
        await expect(page.getByRole('heading', { name: /Nouveau candidat/ })).toBeVisible();
        await expect(page.getByLabel('Nom et prénom *')).toBeVisible();
        await expect(page.getByLabel('Email *')).toBeVisible();
        await expect(page.getByLabel('Téléphone *')).toBeVisible();
        await expect(page.getByRole('button', { name: /Créer le candidat/ })).toBeVisible();
    });

    test('création — soumettre à vide ne quitte pas le modal', async ({ page }) => {
        await page.goto('/rh/candidats');
        await page.getByRole('button', { name: /^Nouveau$/ }).click();
        await page.getByRole('button', { name: /Créer le candidat/ }).click();
        await expect(page.getByRole('heading', { name: /Nouveau candidat/ })).toBeVisible();
    });

    test('création — « Annuler » ferme le modal', async ({ page }) => {
        await page.goto('/rh/candidats');
        await page.getByRole('button', { name: /^Nouveau$/ }).click();
        await expect(page.getByRole('heading', { name: /Nouveau candidat/ })).toBeVisible();
        await page.getByRole('button', { name: /^Annuler$/ }).click();
        await expect(page.getByRole('heading', { name: /Nouveau candidat/ })).toHaveCount(0);
    });

    // Garde de rôle : un RH (permission EMPLOYEE) ne peut pas atteindre la création
    // d'utilisateur (espace admin) → ProtectedRoute le redirige vers /rh/candidats.
    test('garde de rôle — un RH est redirigé hors de l’espace admin', async ({ page }) => {
        await page.goto('/admin/utilisateurs/nouveau');
        await expect(page).toHaveURL(new RegExp(`${ROLES.rh.home}(\\?|$)`));
    });

    // Édition : dépend d'un candidat seedé — skip proprement sinon.
    test('édition — la fiche est pré-remplie', async ({ page }) => {
        await page.goto('/rh/candidats');
        const firstCard = page.locator('main .grid > div').first();
        test.skip((await firstCard.count()) === 0, 'aucun candidat seedé');
        await firstCard.click();
        await expect(page).toHaveURL(/\/rh\/candidats\/[^/]+$/);
        await page.getByRole('button', { name: /^Modifier$/ }).click();
        await expect(page.getByRole('heading', { name: /Modifier la fiche candidat/ })).toBeVisible();
        await expect(page.getByLabel('Nom et prénom *')).not.toHaveValue('');
    });

    // Passage en CONTRAT : ouvre le ContractModal (recherche d'offre puis, à défaut,
    // création d'entreprise/AB). Rendu uniquement — aucune offre n'est confirmée, donc
    // ni le statut ni les données de contrat ne sont persistés en base.
    test.describe('passage en contrat', () => {
        test('ouvre la recherche d’offre puis bascule sur la création d’entreprise', async ({ page }) => {
            await page.goto('/rh/candidats');
            const firstCard = page.locator('main .grid > div').first();
            test.skip((await firstCard.count()) === 0, 'aucun candidat seedé');
            await firstCard.click();
            await expect(page).toHaveURL(/\/rh\/candidats\/[^/]+$/);

            await page.getByRole('combobox').first().selectOption({ label: 'En contrat' });

            await expect(page.getByRole('heading', { name: 'Rechercher une offre' })).toBeVisible();
            await expect(page.getByRole('button', { name: /Offre introuvable/ })).toBeVisible();

            await page.getByRole('button', { name: /Offre introuvable/ }).click();
            await expect(page.getByRole('heading', { name: 'Ajouter une entreprise' })).toBeVisible();

            // Ferme sans rien soumettre : la fiche candidat reste inchangée.
            await page.keyboard.press('Escape');
        });
    });
});
