import { ACCESS_TOKEN_COOKIE, verifyAccessToken } from '../rest/middleware/tokenAuth';
import { isCsrfValid } from '../rest/middleware/csrf';

export function jwtContext({ req }: { req: any }) {
    const token = req.cookies?.[ACCESS_TOKEN_COOKIE];
    if (!token) return { user: null };

    const user = verifyAccessToken(token);
    if (!user) return { user: null };

    // Toute requête GraphQL est un POST : la vérif CSRF s'applique dès qu'un
    // cookie d'auth est présent (double-submit cookie, cf. rest/middleware/csrf.ts).
    if (!isCsrfValid(req)) {
        throw new Error('Invalid or missing CSRF token');
    }

    return { user };
}
