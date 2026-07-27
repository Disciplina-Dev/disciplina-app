import { test, expect } from '@playwright/test';
import { API_URL } from '../fixtures/roles';

// 3.12 Classmarker — porte de sécurité webhook résultat : signature manquante → 401.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('3.12 Classmarker @external', () => {
    test('webhook sans signature → 401', async ({ request }) => {
        const response = await request.post(`${API_URL}/api/webhooks/classmarker`, {
            data: { test: 'result' },
        });
        expect(response.status()).toBe(401);
    });

    test('webhook signature invalide → 401', async ({ request }) => {
        const response = await request.post(`${API_URL}/api/webhooks/classmarker`, {
            data: { test: 'result' },
            headers: { 'x-classmarker-hmac-sha256': 'invalid==' },
        });
        expect(response.status()).toBe(401);
    });
});
