import { test, expect } from '@playwright/test';
import { STORAGE_STATE } from '../fixtures/roles';

// CRM commercial — portefeuille entreprises + fiche + liste noire (§2 E2E.md).
// Aucune dépendance external : lecture MySQL via CompanyAPI, tout est déterministe.
test.use({ storageState: STORAGE_STATE.commercial });

test.describe('Portefeuille commercial (CRM entreprises)', () => {
    test('le portefeuille se charge', async ({ page }) => {
        await page.goto('/commercial/portefeuille');
        await expect(page).toHaveURL(/\/commercial\/portefeuille(\?|$)/);
        await expect(page.getByRole('heading', { name: /Portefeuille entreprises/i })).toBeVisible();
    });

    test('la recherche par nom ou SIRET est disponible', async ({ page }) => {
        await page.goto('/commercial/portefeuille');
        await expect(page.getByPlaceholder(/Recherche par nom ou SIRET/i)).toBeVisible();
    });

    test('« Nouvelle fiche » ouvre le formulaire de création', async ({ page }) => {
        await page.goto('/commercial/portefeuille');
        await page.getByRole('button', { name: /Nouvelle fiche/i }).click();
        await expect(page.getByRole('heading', { name: /Nouvelle fiche entreprise/i })).toBeVisible();
    });

    // Validation client (création) : le formulaire manuel bloque le submit à vide
    // sur les champs requis (react-hook-form). Aucun appel INSEE : la validation
    // async du SIRET ne se déclenche que sur un SIRET valide de 14 chiffres.
    test('création — les champs requis bloquent la soumission', async ({ page }) => {
        await page.goto('/commercial/portefeuille');
        await page.getByRole('button', { name: /Nouvelle fiche/i }).click();
        await page.getByRole('button', { name: /Remplir manuellement/i }).click();
        await page.getByRole('button', { name: /^Créer la fiche$/ }).click();
        await expect(page.getByText('Champ obligatoire')).toBeVisible();
    });

    test('création — un SIRET invalide affiche une erreur de format', async ({ page }) => {
        await page.goto('/commercial/portefeuille');
        await page.getByRole('button', { name: /Nouvelle fiche/i }).click();
        await page.getByRole('button', { name: /Remplir manuellement/i }).click();
        await page.getByLabel('Nom commercial *').fill('Entreprise E2E');
        await page.getByLabel('SIRET *').fill('123');
        await page.getByRole('button', { name: /^Créer la fiche$/ }).click();
        await expect(page.getByText('Le SIRET doit contenir exactement 14 chiffres')).toBeVisible();
    });

    test('la liste noire se charge', async ({ page }) => {
        await page.goto('/commercial/liste-noire');
        await expect(page).toHaveURL(/\/commercial\/liste-noire(\?|$)/);
        await expect(page.getByRole('heading', { name: /Liste noire/i })).toBeVisible();
    });

    // Édition fiche : l'édition est inline sur la page entreprise. Modifier un champ fait
    // apparaître la barre « Modifications non enregistrées » — sans enregistrer en base.
    // Dépend d'une entreprise seedée et éditable (canEdit).
    test('édition — modifier un champ affiche la barre de modifications', async ({ page }) => {
        await page.goto('/commercial/portefeuille');
        const firstCompany = page.locator('main .grid > *').first();
        test.skip((await firstCompany.count()) === 0, 'aucune entreprise seedée');
        await firstCompany.click();
        await expect(page).toHaveURL(/\/commercial\/portefeuille\/[^/]+$/);
        const nameInput = page.getByPlaceholder("Nom de l'entreprise");
        test.skip((await nameInput.count()) === 0, 'entreprise non éditable (canEdit)');
        await nameInput.fill('Entreprise E2E modifiée');
        await expect(page.getByText('Modifications non enregistrées')).toBeVisible();
    });
});
