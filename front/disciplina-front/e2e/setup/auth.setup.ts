import { test as setup, expect, type Page } from '@playwright/test';
import { ROLES, STORAGE_STATE, type RoleName } from '../fixtures/roles';

async function loginAs(page: Page, role: RoleName): Promise<void> {
    const account = ROLES[role];
    await page.goto('/');
    await page.getByRole('textbox', { name: 'Adresse email' }).fill(account.email);
    await page.getByRole('textbox', { name: 'Mot de passe' }).fill(account.password);
    await page.getByRole('button', { name: /Se connecter/ }).click();
    await page.waitForURL(`**${account.home}`);
    // Le bandeau cookies est fixé en bas de page et intercepte les clics des
    // specs (boutons de formulaire notamment). On l'acquitte ici : l'accusé de
    // réception (localStorage) part dans le storageState réutilisé par les tests.
    const cookieAck = page.getByRole('button', { name: "J'ai compris" });
    if (await cookieAck.isVisible()) await cookieAck.click();
    await expect(page.getByRole('region', { name: 'Information sur les cookies' })).toBeHidden();
    await page.context().storageState({ path: STORAGE_STATE[role] });
}

for (const role of Object.keys(ROLES) as RoleName[]) {
    setup(`authenticate as ${role}`, async ({ page }) => {
        await loginAs(page, role);
        // Certaines pages (portefeuille) sérialisent leurs filtres en query string
        // dès le premier rendu : on n'ancre l'URL que sur le chemin.
        await expect(page).toHaveURL(new RegExp(`${ROLES[role].home}(\\?|$)`));
    });
}
