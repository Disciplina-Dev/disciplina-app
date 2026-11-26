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

    it('still blocks resolution when the SIREN is already split between several commercials', async () => {
        const suffix = Date.now();
        const siret1 = `${suffix}6666666666`.slice(0, 14);
        const siret2 = `${suffix}7777777777`.slice(0, 14);
        const repo = new CompanyRepository();
        await repo.create({
            name: `Split One ${suffix}`,
            siret: siret1,
            user_id: 1,
            address: 'Address one',
            sector: 'Nord-Est',
            conclusion: '',
        });
        await repo.create({
            name: `Split Two ${suffix}`,
            siret: siret2,
            user_id: 2,
            address: 'Address two',
            sector: 'Nord-Est',
            conclusion: '',
        });

        const siret3 = `${suffix}8888888888`.slice(0, 14);
        const conflictId = await insertConflict({
            user_id: 2,
            name: `Split Three ${suffix}`,
            siret: siret3,
            conclusion: 'Conflit : multiple_commercials_same_siren',
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
        expect(json.errors[0].message).toMatch(/Plusieurs commerciaux/i);
    });
});