import { test, expect } from '@playwright/test';
import { STORAGE_STATE, API_URL } from '../fixtures/roles';
import { mockExternal } from '../fixtures/mocks';
import { csrfHeaders } from '../fixtures/csrf';

// 3.11 Email / relance — porte de sécurité : requête invalide → 400 SANS appeler Gmail.
test.use({ storageState: STORAGE_STATE.commercial });

test.describe('3.11 Email / relance @external', () => {
    test('pages mail et relance accessibles', async ({ page }) => {
        await mockExternal(page);
        await page.goto('/commercial/mail');
        await expect(page).toHaveURL(/\/commercial\/mail$/);
        await page.goto('/commercial/relance');
        await expect(page).toHaveURL(/\/commercial\/relance$/);
    });

    test('POST /api/email/send invalide → 400 (validation avant Gmail)', async ({ page, context }) => {
        const response = await page.request.post(`${API_URL}/api/email/send`, {
            data: {},
            headers: await csrfHeaders(context),
        });
        expect(response.status()).toBe(400);
    });
});
