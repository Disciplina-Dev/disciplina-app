import { test, expect } from '@playwright/test';
import { API_URL } from '../fixtures/roles';

// 3.10 E-signature AB — porte de sécurité webhook : signature manquante/fausse → 401.
// Test au niveau API (webhook DocuSeal), sans session ni CSRF (route signée).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('3.10 E-signature @external', () => {
    test('webhook DocuSeal sans signature → 401', async ({ request }) => {
        const response = await request.post(`${API_URL}/api/webhooks/docuseal`, {
            data: { event_type: 'form.completed' },
        });
        expect(response.status()).toBe(401);
    });

    test('webhook DocuSeal signature invalide → 401', async ({ request }) => {
        const response = await request.post(`${API_URL}/api/webhooks/docuseal`, {
            data: { event_type: 'form.completed' },
            headers: { 'x-docuseal-signature': 'deadbeef' },
        });
        expect(response.status()).toBe(401);
    });
});
