import { Request, Response, NextFunction } from 'express';
import { ACCESS_TOKEN_COOKIE, verifyAccessToken } from '../rest/middleware/tokenAuth';
import { isCsrfValid } from '../rest/middleware/csrf';
import { env } from '../config/env';
import { syncWithRegion } from '../db/tenant';
import { isRegion } from '../types/tenant';

export async function jwtContext({ req }: { req: any }) {
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

// Pose la région du JWT (défaut tenant) pour TOUTE la requête GraphQL, context
// et exécution des resolvers comprises. jwtContext seul ne suffit pas : les
// resolvers s'exécutent après la création du context, hors de sa portée ALS.
export function graphqlRegionMiddleware(req: Request, _res: Response, next: NextFunction): void {
    const token = req.cookies?.[ACCESS_TOKEN_COOKIE];
    const payload = token ? verifyAccessToken(token) : null;
    const region = payload?.region;
    syncWithRegion(isRegion(region) ? region : env.DB_DEFAULT_TENANT, () => next());
}
