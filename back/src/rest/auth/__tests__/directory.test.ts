import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import { env } from '../../../config/env';
import { mintToken } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';
import { UserRepository } from '../../../repositories/mysql/UserRepository';

const URL = `http://localhost:${env.API_PORT}/api/auth/directory`;

function get(token: string) {
    return fetch(URL, { headers: { Authorization: `Bearer ${token}` } });
}

describe('staff directory', () => {
    beforeEach(async () => {
        await truncateMysql();
        await new UserRepository().create({
            email: 'brandon@disciplina.test',
            first_name: 'Brandon',
            last_name: 'Galmar',
            password: await bcrypt.hash('Irrelevant123456', 10),
            role_id: 1,
            permission_id: 1,
            sectors: null,
            oauth_token: 'a-secret-oauth-token',
            refresh_token: 'a-secret-refresh-token',
        });
    });

    // listUsers est réservé aux permissions RESPONSABLE/ADMIN : l'annuaire existe
    // parce que les pages commerciales doivent résoudre un id en nom sans ce privilège.
    it('serves a COMMERCIAL token', async () => {
        const res = await get(mintToken({ id: 1, email: 'c@test.com', role: 'COMMERCIAL' }));
        expect(res.status).toBe(200);
        expect(await res.json()).toHaveLength(1);
    });

    it('exposes only id, firstName, lastName, role and permission', async () => {
        const res = await get(mintToken({ id: 1, email: 'c@test.com', role: 'COMMERCIAL', permission: 'EMPLOYEE' }));
        const body = await res.json();
        for (const entry of body) {
            expect(Object.keys(entry).sort()).toEqual(['firstName', 'id', 'lastName', 'permission', 'role']);
        }
    });

    it('never leaks emails or tokens', async () => {
        const res = await get(mintToken({ id: 1, email: 'c@test.com', role: 'COMMERCIAL', permission: 'EMPLOYEE' }));
        const raw = JSON.stringify(await res.json());
        expect(raw).not.toContain('@');
        expect(raw).not.toContain('oauth');
        expect(raw).not.toContain('a-secret');
    });
});
