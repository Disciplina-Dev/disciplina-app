import type { BrowserContext } from '@playwright/test';

const CSRF_COOKIE = 'disc_csrf';
const CSRF_HEADER = 'x-csrf-token';

// Reproduit le comportement du httpClient front : ajoute le header CSRF lu
// depuis le cookie `disc_csrf` pour les requêtes REST state-changing.
export async function csrfHeaders(context: BrowserContext): Promise<Record<string, string>> {
    const cookies = await context.cookies();
    const token = cookies.find((cookie) => cookie.name === CSRF_COOKIE)?.value;
    return token ? { [CSRF_HEADER]: token } : {};
}
