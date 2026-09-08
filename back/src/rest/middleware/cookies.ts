import { Response } from 'express';
import { env } from '../../config/env';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, CSRF_COOKIE } from './tokenAuth';

const isProduction = env.NODE_ENV === 'production';

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string, csrfToken: string): void {
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: env.ACCESS_TOKEN_TTL_SECONDS * 1000,
    });
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/api/auth',
        maxAge: env.REFRESH_TOKEN_TTL_SECONDS * 1000,
    });
    res.cookie(CSRF_COOKIE, csrfToken, {
        httpOnly: false,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: env.REFRESH_TOKEN_TTL_SECONDS * 1000,
    });
}

// Session guest externe : même cookie d'accès que le personnel — le middleware
// authenticate rejette déjà les rôles guest (403), les deux restent isolés.
// Pas de refresh token : l'invité se ré-authentifie par code email à expiration.
export function setGuestCookies(res: Response, accessToken: string, csrfToken: string): void {
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: env.ACCESS_TOKEN_TTL_SECONDS * 1000,
    });
    res.cookie(CSRF_COOKIE, csrfToken, {
        httpOnly: false,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: env.REFRESH_TOKEN_TTL_SECONDS * 1000,
    });
}

export function clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/auth' });
    res.clearCookie(CSRF_COOKIE, { path: '/' });
}
