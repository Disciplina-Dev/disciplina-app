import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { env } from '../../config/env';

export const ACCESS_TOKEN_COOKIE = 'disc_at';
export const REFRESH_TOKEN_COOKIE = 'disc_rt';
export const CSRF_COOKIE = 'disc_csrf';
export const CSRF_HEADER = 'x-csrf-token';

export interface AccessTokenPayload {
    id: number;
    email: string;
    role: string;
    permission: string;
}

export interface RefreshTokenPayload {
    id: number;
}

export function signAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL_SECONDS });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
    try {
        return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
    } catch {
        return null;
    }
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
    // jti aléatoire : sans lui, deux rotations dans la même seconde produisent
    // un JWT strictement identique (payload+iat identiques), ce qui casse la
    // détection de réutilisation basée sur le hash du token.
    return jwt.sign({ ...payload, jti: randomBytes(16).toString('hex') }, env.JWT_REFRESH_SECRET, {
        expiresIn: env.REFRESH_TOKEN_TTL_SECONDS,
    });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
    try {
        return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
    } catch {
        return null;
    }
}
