import type { Page, Route } from '@playwright/test';

function json(route: Route, body: unknown, status = 200): Promise<void> {
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

// Intercepte les appels back qui, en réalité, tapent un service external
// (Google Gmail/Drive/Calendar/Sheets, INSEE, DDG, Ollama, DocuSeal, ClassMarker).
// Rend le flux déterministe sans dépendre d'un service tiers.
export async function mockExternal(page: Page): Promise<void> {
    await page.route('**/api/sourcing/**', (route) =>
        json(route, {
            siren: '552100554',
            name: 'ACME MOCK',
            enrichment: { website: 'https://acme.test', emails: [], phones: [] },
        }),
    );
    await page.route('**/api/email/**', (route) => json(route, { sent: true, id: 'mock-mail' }));
    await page.route('**/api/relance/send', (route) => json(route, { sent: true }));
    await page.route('**/api/calendar/events', (route) =>
        route.request().method() === 'POST' ? json(route, { id: 'mock-event' }, 201) : route.continue(),
    );
}

// Simule un token/signature valide pour les parcours publics (match/interview/
// booking/cv-import) sans dépendre du crypto signé côté back.
export async function mockSignedToken(
    page: Page,
    kind: 'match' | 'interview' | 'booking',
    payload: Record<string, unknown> = {},
): Promise<void> {
    await page.route(`**/api/${kind}/**/inspect`, (route) =>
        json(route, { valid: true, locked: false, ...payload }),
    );
    await page.route(`**/api/${kind}/**/authenticate`, (route) =>
        json(route, { authenticated: true, token: 'mock-guest-token', ...payload }),
    );
}
