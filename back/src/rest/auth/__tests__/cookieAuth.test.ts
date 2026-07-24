import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import { env } from '../../../config/env';
import { truncateMysql } from '../../../../test/helpers/db';
import { UserRepository } from '../../../repositories/mysql/UserRepository';

const BASE = `http://localhost:${env.API_PORT}`;
const PASSWORD = 'Irrelevant123456';

function findCookie(setCookies: string[], name: string): string | undefined {
    const raw = setCookies.find((c) => c.startsWith(`${name}=`));
    return raw?.split(';')[0].split('=')[1];
}

async function seedUser(): Promise<void> {
    await new UserRepository().create({
        email: 'cookie@disciplina.test',
        first_name: 'Cookie',
        last_name: 'Auth',
        password: await bcrypt.hash(PASSWORD, 10),
        role_id: 2, // RH
        permission_id: 1, // EMPLOYEE
        sectors: null,
        oauth_token: null,
        refresh_token: null,
    });
}

async function login(): Promise<{ accessToken: string; refreshToken: string; csrfToken: string }> {
    const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'cookie@disciplina.test', passwordPlain: PASSWORD }),
    });
    const setCookies = res.headers.getSetCookie();
    return {
        accessToken: findCookie(setCookies, 'disc_at')!,
        refreshToken: findCookie(setCookies, 'disc_rt')!,
        csrfToken: findCookie(setCookies, 'disc_csrf')!,
    };
}

function cookieHeader(tokens: { accessToken?: string; refreshToken?: string; csrfToken?: string }): string {
    return Object.entries({
        disc_at: tokens.accessToken,
        disc_rt: tokens.refreshToken,
        disc_csrf: tokens.csrfToken,
    })
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
}

describe('cookie-based auth (login/me/refresh/logout)', () => {
    beforeEach(async () => {
        await truncateMysql();
        await seedUser();
    });

    it('login sets httpOnly access/refresh cookies and a JS-readable CSRF cookie, no token in body', async () => {
        const res = await fetch(`${BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'cookie@disciplina.test', passwordPlain: PASSWORD }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.token).toBeUndefined();
        expect(body.user.email).toBe('cookie@disciplina.test');

        const setCookies = res.headers.getSetCookie();
        const at = setCookies.find((c) => c.startsWith('disc_at='))!;
        const rt = setCookies.find((c) => c.startsWith('disc_rt='))!;
        const csrf = setCookies.find((c) => c.startsWith('disc_csrf='))!;
        expect(at).toContain('HttpOnly');
        expect(rt).toContain('HttpOnly');
        expect(rt).toContain('Path=/api/auth');
        expect(csrf).not.toContain('HttpOnly');
    });

    it('GET /api/auth/me returns the full user profile when the access cookie is valid', async () => {
        const tokens = await login();
        const res = await fetch(`${BASE}/api/auth/me`, {
            headers: { Cookie: cookieHeader(tokens) },
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.email).toBe('cookie@disciplina.test');
    });

    it('GET /api/auth/me rejects a request with no access cookie', async () => {
        const res = await fetch(`${BASE}/api/auth/me`);
        expect(res.status).toBe(401);
    });

    it('POST /api/auth/refresh rotates the refresh token and issues a new access token', async () => {
        const tokens = await login();
        const res = await fetch(`${BASE}/api/auth/refresh`, {
            method: 'POST',
            headers: { Cookie: cookieHeader({ refreshToken: tokens.refreshToken }) },
        });
        expect(res.status).toBe(200);
        const setCookies = res.headers.getSetCookie();
        const newAccess = findCookie(setCookies, 'disc_at');
        const newRefresh = findCookie(setCookies, 'disc_rt');
        expect(newAccess).toBeTruthy();
        expect(newRefresh).toBeTruthy();
        expect(newRefresh).not.toBe(tokens.refreshToken);
    });

    it('rejects reuse of an already-rotated refresh token and revokes the whole session', async () => {
        const tokens = await login();

        const first = await fetch(`${BASE}/api/auth/refresh`, {
            method: 'POST',
            headers: { Cookie: cookieHeader({ refreshToken: tokens.refreshToken }) },
        });
        expect(first.status).toBe(200);
        const rotated = findCookie(first.headers.getSetCookie(), 'disc_rt')!;

        // Replaying the original (now-rotated) refresh token signals theft.
        const reuse = await fetch(`${BASE}/api/auth/refresh`, {
            method: 'POST',
            headers: { Cookie: cookieHeader({ refreshToken: tokens.refreshToken }) },
        });
        expect(reuse.status).toBe(401);

        // The legitimately-rotated token must now be revoked too (whole session killed).
        const afterReuse = await fetch(`${BASE}/api/auth/refresh`, {
            method: 'POST',
            headers: { Cookie: cookieHeader({ refreshToken: rotated }) },
        });
        expect(afterReuse.status).toBe(401);
    });

    it('POST /api/auth/logout revokes the refresh token and clears cookies', async () => {
        const tokens = await login();
        const res = await fetch(`${BASE}/api/auth/logout`, {
            method: 'POST',
            headers: { Cookie: cookieHeader(tokens), 'x-csrf-token': tokens.csrfToken },
        });
        expect(res.status).toBe(200);
        const setCookies = res.headers.getSetCookie();
        expect(setCookies.some((c) => c.startsWith('disc_at=;') || /disc_at=;.*Expires/.test(c))).toBe(true);

        const refreshAfterLogout = await fetch(`${BASE}/api/auth/refresh`, {
            method: 'POST',
            headers: { Cookie: cookieHeader({ refreshToken: tokens.refreshToken }) },
        });
        expect(refreshAfterLogout.status).toBe(401);
    });
});
