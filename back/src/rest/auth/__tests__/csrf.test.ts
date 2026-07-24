import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import { env } from '../../../config/env';
import { truncateMysql } from '../../../../test/helpers/db';
import { UserRepository } from '../../../repositories/mysql/UserRepository';

const BASE = `http://localhost:${env.API_PORT}`;
const GRAPHQL_URL = `${BASE}/api/graphql/companies`;
const PASSWORD = 'Irrelevant123456';

function findCookie(setCookies: string[], name: string): string | undefined {
    const raw = setCookies.find((c) => c.startsWith(`${name}=`));
    return raw?.split(';')[0].split('=')[1];
}

async function login(): Promise<{ cookieHeader: string; csrfToken: string }> {
    await new UserRepository().create({
        email: 'csrf@disciplina.test',
        first_name: 'Csrf',
        last_name: 'Guard',
        password: await bcrypt.hash(PASSWORD, 10),
        role_id: 5, // GESTION
        permission_id: 3, // ADMIN — allowed to edit sectors
        sectors: null,
        oauth_token: null,
        refresh_token: null,
    });
    const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'csrf@disciplina.test', passwordPlain: PASSWORD }),
    });
    const setCookies = res.headers.getSetCookie();
    const at = findCookie(setCookies, 'disc_at')!;
    const csrfToken = findCookie(setCookies, 'disc_csrf')!;
    return { cookieHeader: `disc_at=${at}; disc_csrf=${csrfToken}`, csrfToken };
}

describe('CSRF double-submit protection', () => {
    beforeEach(async () => {
        await truncateMysql();
    });

    it('rejects a mutating REST request with a valid auth cookie but no CSRF header', async () => {
        const { cookieHeader } = await login();
        const res = await fetch(`${BASE}/api/auth/users/1/sectors`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
            body: JSON.stringify({ sectors: ['Nord-Est'] }),
        });
        expect(res.status).toBe(403);
    });

    it('rejects a mutating REST request with a mismatched CSRF header', async () => {
        const { cookieHeader } = await login();
        const res = await fetch(`${BASE}/api/auth/users/1/sectors`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Cookie: cookieHeader, 'x-csrf-token': 'not-the-token' },
            body: JSON.stringify({ sectors: ['Nord-Est'] }),
        });
        expect(res.status).toBe(403);
    });

    it('accepts a mutating REST request with a matching CSRF header', async () => {
        const { cookieHeader, csrfToken } = await login();
        const res = await fetch(`${BASE}/api/auth/users/1/sectors`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Cookie: cookieHeader, 'x-csrf-token': csrfToken },
            body: JSON.stringify({ sectors: ['Nord-Est'] }),
        });
        expect(res.status).toBe(200);
    });

    it('rejects a GraphQL request with a valid auth cookie but no CSRF header', async () => {
        const { cookieHeader } = await login();
        const res = await fetch(GRAPHQL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
            body: JSON.stringify({ query: '{ __typename }' }),
        });
        const body = await res.json();
        expect(body.errors?.[0]?.message).toMatch(/CSRF/i);
    });

    it('accepts a GraphQL request with a matching CSRF header', async () => {
        const { cookieHeader, csrfToken } = await login();
        const res = await fetch(GRAPHQL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookieHeader, 'x-csrf-token': csrfToken },
            body: JSON.stringify({ query: '{ __typename }' }),
        });
        const body = await res.json();
        expect(body.errors).toBeUndefined();
    });
});
