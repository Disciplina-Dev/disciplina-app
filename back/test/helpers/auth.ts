import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { env } from '../../src/config/env';
import { ACCESS_TOKEN_COOKIE, CSRF_COOKIE, CSRF_HEADER } from '../../src/rest/middleware/tokenAuth';

export function mintToken(user: { id: number; email: string; role: string; permission?: string }): string {
    return jwt.sign(user, env.JWT_SECRET, { expiresIn: '1h' });
}

/**
 * Auth cookie + CSRF pair for component tests hitting the real Express app.
 * `cookieHeader` goes on the `Cookie` header, `csrfHeader` on `x-csrf-token`
 * (required by `authenticate`/`jwtContext` for any non-GET request).
 */
export function mintAuthCookies(user: { id: number; email: string; role: string; permission?: string }): {
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
