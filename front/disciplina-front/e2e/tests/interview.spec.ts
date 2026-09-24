import { test, expect, type Route } from '@playwright/test';

// 3.8 Entretiens — parcours invité, flux external_access
// (/external/authenticate → lien magique sans code → cookie disc_at → /external/interview/:sig).
// Reservation mockée (@external Calendar).
test.use({ storageState: { cookies: [], origins: [] } });

function json(route: Route, body: unknown, status = 200): Promise<void> {
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

const SLOTS = {
    location: 'Saint-Denis, 12 rue des Tests',
    slots: [{ slot: '2030-01-01T09:00:00.000Z', taken: false }],
};

const AUTH_OK = {
    success: true,
    user: { role: 'EXTERNAL_GUEST', permission: 'GUEST', referenceId: 3 },
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

// Conteneur des créneaux dans la page ExternalInterview (les boutons du layout
// public en ajoutent d'autres, on scope le sélecteur).
const slotList = 'div.mt-5.flex.flex-col.gap-2 button';

test.describe('3.8 Entretiens @external', () => {
    test("lien valide (mocké) → sélecteur de créneaux", async ({ page }) => {
        await page.route('**/api/external/mock/authenticate', (route) => json(route, AUTH_OK));
        await page.route('**/api/external/mock/interview/slots', (route) => json(route, SLOTS));

        await page.goto('/external/authenticate?sig=mock');

        await expect(page).toHaveURL(/\/external\/interview\/mock$/);
        await expect(page.getByRole('heading', { name: "Choisissez votre créneau d'entretien" })).toBeVisible();
        await expect(page.getByText('Saint-Denis, 12 rue des Tests')).toBeVisible();
        await expect(page.getByText(/7 jours après sa première ouverture/)).toBeVisible();
        await expect(page.locator(slotList)).toHaveCount(1);
    });

    test("réservation d'un créneau → démarche finalisée", async ({ page }) => {
        await page.route('**/api/external/mock/authenticate', (route) => json(route, AUTH_OK));
        await page.route('**/api/external/mock/interview/slots', (route) => json(route, SLOTS));
        await page.route('**/api/external/mock/interview/book', (route) => json(route, { ok: true }));

        await page.goto('/external/authenticate?sig=mock');
        await expect(page).toHaveURL(/\/external\/interview\/mock$/);

        await page.locator(slotList).first().click();
        await expect(page.getByText('Démarche déjà finalisée')).toBeVisible();
    });
});
