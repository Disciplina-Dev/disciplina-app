import { test as setup, expect, type Page } from '@playwright/test';
import { ROLES, STORAGE_STATE, type RoleName } from '../fixtures/roles';

async function loginAs(page: Page, role: RoleName): Promise<void> {
    const account = ROLES[role];
    await page.goto('/');
    await page.getByRole('textbox', { name: 'Adresse email' }).fill(account.email);
    await page.getByRole('textbox', { name: 'Mot de passe' }).fill(account.password);
    await page.getByRole('button', { name: /Se connecter/ }).click();
    await page.waitForURL(`**${account.home}`);
    await page.context().storageState({ path: STORAGE_STATE[role] });
}

for (const role of Object.keys(ROLES) as RoleName[]) {
    setup(`authenticate as ${role}`, async ({ page }) => {
        await loginAs(page, role);
        await expect(page).toHaveURL(new RegExp(`${ROLES[role].home}$`));
    });
}
