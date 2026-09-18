import { test, expect, type Route } from '@playwright/test';

// 3.7 Comparateur public (match) — parcours invité, flux external_access
// (/external/authenticate → lien magique sans code → cookie disc_at → /external/matching/:sig).
test.use({ storageState: { cookies: [], origins: [] } });

function json(route: Route, body: unknown, status = 200): Promise<void> {
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

const CANDIDATE = {
    id: 'cand-e2e',
    fullName: 'Candidat exemple',
    age: 30,
    sex: 'NONE',
    city: 'Lyon',
    description: 'Note du conseiller.',
    status: null,
};

const AUTH_OK = {
    success: true,
    user: { role: 'EXTERNAL_GUEST', permission: 'GUEST', referenceId: 2 },
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

test.describe('3.7 Comparateur public @external', () => {
    test('lien valide (mocké) → redirection comparateur + candidats', async ({ page }) => {
        await page.route('**/api/external/mock/authenticate', (route) => json(route, AUTH_OK));
        await page.route('**/api/external/mock/match/candidates', (route) => json(route, [CANDIDATE]));
        await page.route('**/api/external/mock/match/cv/*', (route) =>
            json(route, { filename: 'CV_candidat.pdf', contentType: 'application/pdf', content: 'aGVsbG8=' }),
        );

        await page.goto('/external/authenticate?sig=mock');

        await expect(page).toHaveURL(/\/external\/matching\/mock$/);
        await expect(page.getByText('Candidats proposés')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Candidat exemple' })).toBeVisible();
        await expect(page.getByText(/7 jours après sa première ouverture/)).toBeVisible();
    });

    test('signature invalide → contenu de rejet', async ({ page }) => {
        await page.route('**/api/external/invalid-signature/authenticate', (route) =>
            route.fulfill({ status: 404 }),
        );
        await page.goto('/external/authenticate?sig=invalid-signature');
        await expect(page.getByText('Lien inconnu')).toBeVisible();
    });

    test('lien expiré → contenu de rejet avec avertissement', async ({ page }) => {
        await page.route('**/api/external/expired-signature/authenticate', (route) =>
            json(route, { message: 'KO signature expired' }, 410),
        );
        await page.goto('/external/authenticate?sig=expired-signature');
        await expect(page.getByText('Lien expiré')).toBeVisible();
        await expect(page.getByText(/7 jours après sa première ouverture/)).toBeVisible();
    });

    test('réponses soumises → écran merci', async ({ page }) => {
        await page.route('**/api/external/mock/authenticate', (route) => json(route, AUTH_OK));
        await page.route('**/api/external/mock/match/candidates', (route) => json(route, [CANDIDATE]));
        await page.route('**/api/external/mock/match/cv/*', (route) =>
            json(route, { filename: 'CV_candidat.pdf', contentType: 'application/pdf', content: 'aGVsbG8=' }),
        );
        await page.route('**/api/external/mock/match/answers', (route) =>
            json(route, { ok: true }, 200),
        );

        await page.goto('/external/authenticate?sig=mock');
        await expect(page).toHaveURL(/\/external\/matching\/mock$/);

        await page.getByRole('button', { name: 'Accepter' }).click();
        await page.getByRole('button', { name: 'Valider mes réponses' }).click();

        await expect(page.getByText('Merci pour vos réponses')).toBeVisible();
    });
});
