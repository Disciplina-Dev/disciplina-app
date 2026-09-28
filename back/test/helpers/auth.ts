import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { env } from '../../src/config/env';
import { ACCESS_TOKEN_COOKIE, CSRF_COOKIE, CSRF_HEADER } from '../../src/rest/middleware/tokenAuth';
import type { Region } from '../../src/types/tenant';

/** `region` porte le tenant cible : `authenticate` le renvoie dans l'ALS via syncWithRegion. */
export interface TestUser {
    id: number;
    email: string;
    role: string;
    permission?: string;
    region?: Region;
}

export function mintToken(user: TestUser): string {
    return jwt.sign(user, env.JWT_SECRET, { expiresIn: '1h' });
}

/**
 * Auth cookie + CSRF pair for component tests hitting the real Express app.
 * `cookieHeader` goes on the `Cookie` header, `csrfHeader` on `x-csrf-token`
 * (required by `authenticate`/`jwtContext` for any non-GET request).
 */
export function mintAuthCookies(user: TestUser): {
    cookieHeader: string;
    csrfHeader: string;
} {
    const accessToken = mintToken(user);
    const csrfToken = randomBytes(32).toString('hex');
    return {
        cookieHeader: `${ACCESS_TOKEN_COOKIE}=${accessToken}; ${CSRF_COOKIE}=${csrfToken}`,
        csrfHeader: csrfToken,
    };
}

export { ACCESS_TOKEN_COOKIE, CSRF_COOKIE, CSRF_HEADER };
