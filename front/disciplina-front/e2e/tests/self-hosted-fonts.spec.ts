import { test, expect, type Request } from '@playwright/test';

// GDPR_INF_11.2 (#1149) — polices auto-hébergées : aucune requête vers Google Fonts
// (transfert IP/UA vers Google). Figtree/Outfit sont servies par l'app via
// @fontsource-variable. Démarre non authentifié : la page de login charge index.css.
test.use({ storageState: { cookies: [], origins: [] } });

const GOOGLE_FONTS = /fonts\.(googleapis|gstatic)\.com/;

test.describe('GDPR_INF_11.2 Polices auto-hébergées', () => {
    test('aucune requête vers Google Fonts, Figtree et Outfit servies par l’app', async ({ page, baseURL }) => {
        const requests: Request[] = [];
        page.on('request', (req) => requests.push(req));

        await page.goto('/');
        await expect(page.getByRole('button', { name: /Se connecter/ })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);

        const googleRequests = requests.map((r) => r.url()).filter((url) => GOOGLE_FONTS.test(url));
        expect(googleRequests).toEqual([]);

        const appOrigin = new URL(baseURL ?? page.url()).origin;
        const fontRequests = requests.filter((r) => r.resourceType() === 'font').map((r) => r.url());
        expect(fontRequests.length).toBeGreaterThan(0);
        for (const url of fontRequests) {
            expect(new URL(url).origin).toBe(appOrigin);
        }

        const loaded = await page.evaluate(() =>
            [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')),
        );
        expect(loaded).toEqual(expect.arrayContaining(['Figtree Variable', 'Outfit Variable']));
    });
});
