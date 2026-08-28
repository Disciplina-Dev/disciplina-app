import { test, expect, type Route } from '@playwright/test';

// 3.7 Comparateur public (match) — parcours invité, flux external_access
// (/external/authenticate → code 6 chiffres → cookie disc_at → /external/matching/:sig).
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

test.describe('3.7 Comparateur public @external', () => {
    test('la page d\'authentification se charge sans session', async ({ page }) => {
        await page.route('**/api/external/mock/authenticate', (route) =>
            json(route, { message: 'OK signature exists' }),
        );
        await page.goto('/external/authenticate?sig=mock');
        await expect(page.getByText(/Un code à 6 chiffres vous a été envoyé/)).toBeVisible();
    });

    test('signature invalide → contenu de rejet', async ({ page }) => {
        await page.route('**/api/external/invalid-signature/authenticate', (route) =>
            route.fulfill({ status: 404 }),
        );
        await page.goto('/external/authenticate?sig=invalid-signature');
        await expect(page.getByText('Lien inconnu')).toBeVisible();
    });

    test('code valide (mocké) → redirection comparateur + candidats', async ({ page }) => {
        await page.route('**/api/external/mock/authenticate', (route) =>
            json(route, { message: 'OK signature exists' }),
        );
        await page.route('**/api/external/inspect', (route) =>
            json(route, { user: { referenceId: 2 } }),
        );
        await page.route('**/api/external/mock/match/candidates', (route) => json(route, [CANDIDATE]));
        await page.route('**/api/external/mock/match/cv/*', (route) =>
            json(route, { filename: 'CV_candidat.pdf', contentType: 'application/pdf', content: 'aGVsbG8=' }),
        );

        await page.goto('/external/authenticate?sig=mock');
        await page.getByPlaceholder('Code à 6 chiffres').fill('123456');
        await page.getByRole('button', { name: 'Vérifier' }).click();

        await expect(page).toHaveURL(/\/external\/matching\/mock$/);
        await expect(page.getByText('Candidats proposés')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Candidat exemple' })).toBeVisible();
    });

    test('réponses soumises → écran merci', async ({ page }) => {
        await page.route('**/api/external/mock/authenticate', (route) =>
            json(route, { message: 'OK signature exists' }),
        );
        await page.route('**/api/external/inspect', (route) =>
            json(route, { user: { referenceId: 2 } }),
        );
        await page.route('**/api/external/mock/match/candidates', (route) => json(route, [CANDIDATE]));
        await page.route('**/api/external/mock/match/cv/*', (route) =>
            json(route, { filename: 'CV_candidat.pdf', contentType: 'application/pdf', content: 'aGVsbG8=' }),
        );
        await page.route('**/api/external/mock/match/answers', (route) =>
            json(route, { ok: true }, 200),
        );

        await page.goto('/external/authenticate?sig=mock');
        await page.getByPlaceholder('Code à 6 chiffres').fill('123456');
        await page.getByRole('button', { name: 'Vérifier' }).click();

        await page.getByRole('button', { name: 'Accepter' }).click();
        await page.getByRole('button', { name: 'Valider mes réponses' }).click();

        await expect(page.getByText('Merci pour vos réponses')).toBeVisible();
    });
});