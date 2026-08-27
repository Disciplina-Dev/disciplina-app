import { describe, it, expect, beforeEach } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';
import { env } from '../../../config/env';
import { CompanyRepository } from '../../../repositories/mysql/CompanyRepository';
import pool from '../../../db/mysql/connection';

const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/companies`;

describe('GraphQL company conflict resolution', () => {
    beforeEach(async () => {
        await truncateMysql();
        const conn = await pool.getConnection();
        try {
            await conn.execute(
                'INSERT INTO users (email, first_name, last_name, password, role_id, permission_id) VALUES (?, ?, ?, ?, ?, ?)',
                ['admin@test.local', 'Admin', 'User', 'password', 1, 3],
            );
            await conn.execute(
                'INSERT INTO users (email, first_name, last_name, password, role_id, permission_id) VALUES (?, ?, ?, ?, ?, ?)',
                ['sales@test.local', 'Sales', 'Rep', 'password', 1, 1],
            );
        } finally {
            conn.release();
        }
    });

    const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });

    function headers() {
        return { 'Content-Type': 'application/json', Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader };
    }

    async function insertConflict(row: {
        user_id: number | null;
        name: string;
        siret: string;
        conclusion: string;
    }): Promise<number> {
        const conn = await pool.getConnection();
        try {
            const [result] = await conn.execute(
                `INSERT INTO company_conflict (user_id, legal_referent, name, phone, email, address, sector,
                     main_activity, siret, idcc, ape, notes, conclusion)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [row.user_id, null, row.name, null, null, 'Some address', 'Nord-Est', null, row.siret, null, null, null, row.conclusion],
            );
            return (result as any).insertId;
        } finally {
            conn.release();
        }
    }

    it('resolves an informational conflict by keeping the existing portfolio company and applying the chosen commercial', async () => {
        const suffix = Date.now();
        const siret = `${suffix}4444444444`.slice(0, 14);
        const repo = new CompanyRepository();
        const companyId = await repo.create({
            name: `Portfolio Corp ${suffix}`,
            siret,
            address: 'Portfolio address',
            sector: 'Nord-Est',
            conclusion: '',
        });

        const conflictId = await insertConflict({
            user_id: 2,
            name: `Portfolio Corp ${suffix}`,
            siret,
            conclusion: 'Conflit : commercial_mismatch',
        });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({
                query: `mutation($id: Int!) { resolveCompanyConflict(id: $id) { id name siret userID } }`,
                variables: { id: conflictId },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.resolveCompanyConflict.id).toBe(companyId);
        expect(json.data.resolveCompanyConflict.siret).toBe(siret);

        // Quarantine entry is gone, the commercial has been applied to the portfolio company
        const conn = await pool.getConnection();
        try {
            const [conflictRows] = await conn.execute('SELECT id FROM company_conflict WHERE id = ?', [conflictId]);
            expect((conflictRows as any[]).length).toBe(0);
            const [companyRows] = await conn.execute<{ user_id: number }[]>(
                'SELECT user_id FROM companies WHERE id = ?',
                [companyId],
            );
            expect(companyRows[0].user_id).toBe(2);
        } finally {
            conn.release();
        }
    });

    it('deletes a duplicate_siret conflict without overwriting the portfolio company', async () => {
        const suffix = Date.now();
        const siret = `${suffix}5555555555`.slice(0, 14);
        const repo = new CompanyRepository();
        const companyId = await repo.create({
            name: `Primary Corp ${suffix}`,
            siret,
            address: 'Primary address',
            sector: 'Nord-Est',
            conclusion: '',
        });

        // The duplicate Digiforma entry carries different data than the portfolio company
        const conflictId = await insertConflict({
            user_id: null,
            name: `Duplicate Corp ${suffix}`,
            siret,
            conclusion: 'Conflit : duplicate_digiforma_siret',
        });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({
                query: `mutation($id: Int!) { resolveCompanyConflict(id: $id) { id name siret } }`,
                variables: { id: conflictId },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.resolveCompanyConflict.id).toBe(companyId);

        const conn = await pool.getConnection();
        try {
            const [conflictRows] = await conn.execute('SELECT id FROM company_conflict WHERE id = ?', [conflictId]);
            expect((conflictRows as any[]).length).toBe(0);
            const [companyRows] = await conn.execute<{ name: string }[]>(
                'SELECT name FROM companies WHERE id = ?',
                [companyId],
            );
            expect(companyRows[0].name).toBe(`Primary Corp ${suffix}`);
        } finally {
            conn.release();
        }
    });

    it('still rejects an entry with an invalid siret', async () => {
        const conflictId = await insertConflict({
            user_id: null,
            name: 'Bogus Corp',
            siret: '00000000000000',
            conclusion: 'Conflit : invalid_siret',
        });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({
                query: `mutation($id: Int!) { resolveCompanyConflict(id: $id) { id } }`,
                variables: { id: conflictId },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeDefined();
        expect(json.errors[0].message).toMatch(/SIRET est invalide/i);
    });

    /** Deux fiches du même SIREN sur deux commerciaux différents + l'entrée en quarantaine. */
    async function seedSplitSiren(suffix: number, conflictUserId: number | null) {
        const siren = `${suffix}`.slice(0, 9);
        const repo = new CompanyRepository();
        const first = await repo.create({
            name: `Split One ${suffix}`,
            siret: `${siren}66666`,
            user_id: 1,
            address: 'Address one',
            sector: 'Nord-Est',
            conclusion: '',
        });
        const second = await repo.create({
            name: `Split Two ${suffix}`,
            siret: `${siren}77777`,
            user_id: 2,
            address: 'Address two',
            sector: 'Nord-Est',
            conclusion: '',
        });
        const conflictId = await insertConflict({
            user_id: conflictUserId,
            name: `Split Three ${suffix}`,
            siret: `${siren}88888`,
            conclusion: 'Conflit : multiple_commercials_same_siren',
        });
        return { siren, first, second, conflictId };
    }

    async function resolve(conflictId: number) {
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({
                query: `mutation($id: Int!) { resolveCompanyConflict(id: $id) { id siret userID } }`,
                variables: { id: conflictId },
            }),
        });
        return { status: res.status, json: await res.json() };
    }

    it('resolves a split-SIREN conflict once a commercial has been chosen, and realigns the whole SIREN', async () => {
        const { siren, first, second, conflictId } = await seedSplitSiren(Date.now(), 2);

        const { status, json } = await resolve(conflictId);

        expect(status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.resolveCompanyConflict.userID).toBe(2);

        const conn = await pool.getConnection();
        try {
            const [conflictRows] = await conn.execute('SELECT id FROM company_conflict WHERE id = ?', [conflictId]);
            expect((conflictRows as any[]).length).toBe(0);

            // Tout le SIREN est rattaché au commercial arbitré, y compris la fiche qui était sur 1.
            const [companyRows] = await conn.execute<{ id: number; user_id: number }[]>(
                'SELECT id, user_id FROM companies WHERE siren = ?',
                [siren],
            );
            expect(companyRows.length).toBe(3);
            expect(companyRows.every((r) => r.user_id === 2)).toBe(true);
            expect(companyRows.map((r) => r.id)).toEqual(expect.arrayContaining([first, second]));
        } finally {
            conn.release();
        }
    });

    it('still blocks a split-SIREN conflict that has no chosen commercial', async () => {
        const { siren, conflictId } = await seedSplitSiren(Date.now() - 1, null);

        const { status, json } = await resolve(conflictId);

        expect(status).toBe(200);
        expect(json.errors).toBeDefined();
        expect(json.errors[0].message).toMatch(/Plusieurs commerciaux/i);

        // Aucun réalignement : le SIREN reste éclaté et l'entrée reste en quarantaine.
        const conn = await pool.getConnection();
        try {
            const [rows] = await conn.execute<{ user_id: number }[]>(
                'SELECT user_id FROM companies WHERE siren = ?',
                [siren],
            );
            expect(new Set(rows.map((r) => r.user_id)).size).toBe(2);
            const [conflictRows] = await conn.execute('SELECT id FROM company_conflict WHERE id = ?', [conflictId]);
            expect((conflictRows as any[]).length).toBe(1);
        } finally {
            conn.release();
        }
    });

    it('reports success when saving a conflict without changing any value', async () => {
        const conflictId = await insertConflict({
            user_id: 2,
            name: 'Unchanged Corp',
            siret: '12345678900011',
            conclusion: 'Conflit : multiple_commercials_same_siren',
        });

        // MySQL ne compte que les lignes modifiées : la seconde sauvegarde à l'identique
        // renvoyait « Company conflict entry not found » sur une entrée bien présente.
        const body = JSON.stringify({
            query: `mutation($id: Int!, $input: CompanyConflictInput!) {
                updateCompanyConflict(id: $id, input: $input) { id name }
            }`,
            variables: { id: conflictId, input: { name: 'Unchanged Corp' } },
        });

        for (const attempt of [1, 2]) {
            const res = await fetch(ENDPOINT, { method: 'POST', headers: headers(), body });
            const json = await res.json();
            expect(json.errors, `attempt ${attempt}`).toBeUndefined();
            expect(json.data.updateCompanyConflict.name).toBe('Unchanged Corp');
        }
    });
});