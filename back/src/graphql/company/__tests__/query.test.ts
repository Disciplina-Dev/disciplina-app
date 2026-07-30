import { describe, it, expect, beforeEach } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';
import { env } from '../../../config/env';
import { CompanyRepository } from '../../../repositories/mysql/CompanyRepository';
import { CompanyBlacklistRepository } from '../../../repositories/mysql/CompanyBlacklistRepository';
import pool from '../../../db/mysql/connection';

const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/companies`;

describe('GraphQL company queries', () => {
    beforeEach(async () => {
        await truncateMysql();
    });

    it('returns an empty list when no companies exist', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: auth.cookieHeader,
                'x-csrf-token': auth.csrfHeader,
            },
            body: JSON.stringify({
                query: '{ companies { edges { node { company { id name } salePerson { id email } } cursor } pageInfo { hasNextPage hasPreviousPage startCursor endCursor } } }',
            }),
        });
        const json = await res.json();
        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.companies.edges).toEqual([]);
        expect(json.data.companies.pageInfo.hasNextPage).toBe(false);
    });

    it('returns all seeded companies with camelCase fields', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });
        const suffix = Date.now();
        const repo = new CompanyRepository();

        const siret1 = `${suffix}1111111111`.slice(0, 14);
        const siret2 = `${suffix}2222222222`.slice(0, 14);

        await repo.create({
            name: `Alpha Corp ${suffix}`,
            siret: siret1,
            main_activity: 'RESTAURATION',
            address: 'Place Alpha',
            sector: 'IT',
            conclusion: 'conclusion',
        });
        await repo.create({
            name: `Beta Corp ${suffix}`,
            siret: siret2,
            main_activity: 'COMMERCE',
            address: 'Place Beta',
            sector: 'Boeuf',
            conclusion: 'conslusion',
        });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: auth.cookieHeader,
                'x-csrf-token': auth.csrfHeader,
            },
            body: JSON.stringify({
                query: '{ companies { edges { node { company { id name siret mainActivity userID } salePerson { id } } cursor } pageInfo { hasNextPage } } }',
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.companies.edges).toHaveLength(2);
        expect(json.data.companies.edges[0].node.company.name).toBe(`Alpha Corp ${suffix}`);
        expect(json.data.companies.edges[0].node.company.mainActivity).toBe('RESTAURATION');
        expect(json.data.companies.edges[0].node.company.userID).toBeNull();
        expect(json.data.companies.edges[1].node.company.name).toBe(`Beta Corp ${suffix}`);
        expect(json.data.companies.edges[1].node.company.mainActivity).toBe('COMMERCE');
    });

    it('returns companies with associated salePerson', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });
        const suffix = Date.now();
        const repo = new CompanyRepository();

        const conn = await pool.getConnection();
        let userID: number;
        try {
            const [result] = await conn.execute(
                'INSERT INTO users (email, first_name, last_name, password, role_id, permission_id) VALUES (?, ?, ?, ?, ?, ?)',
                [`sp-${suffix}@test.local`, 'Sale', 'Person', `password${suffix}`, 1, 1],
            );
            userID = (result as any).insertId;
        } finally {
            conn.release();
        }

        const siret = `${suffix}3333333333`.slice(0, 14);
        await repo.create({
            user_id: userID,
            name: `Test Corp ${suffix}`,
            siret,
            address: 'Place Alpha',
            sector: 'IT',
            conclusion: 'conclusion',
        });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: auth.cookieHeader,
                'x-csrf-token': auth.csrfHeader,
            },
            body: JSON.stringify({
                query: '{ companies { edges { node { company { id name userID } salePerson { id email firstName lastName } } cursor } pageInfo { hasNextPage } } }',
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.companies.edges).toHaveLength(1);
        expect(json.data.companies.edges[0].node.company.userID).toBe(userID);
        expect(json.data.companies.edges[0].node.salePerson.email).toBe(`sp-${suffix}@test.local`);
        expect(json.data.companies.edges[0].node.salePerson.firstName).toBe('Sale');
        expect(json.data.companies.edges[0].node.salePerson.lastName).toBe('Person');
    });

    it('paginates companies with first and after', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });
        const suffix = Date.now();
        const repo = new CompanyRepository();

        for (let i = 0; i < 3; i++) {
            await repo.create({
                name: `Page Corp ${suffix}-${i}`,
                siret: `${suffix}${i}000000000`.slice(0, 14),
                address: 'Place',
                sector: 'IT',
                conclusion: 'conclusion',
            });
        }

        const page1Res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: auth.cookieHeader,
                'x-csrf-token': auth.csrfHeader,
            },
            body: JSON.stringify({
                query: '{ companies(first: 2) { edges { cursor node { company { id name } } } pageInfo { hasNextPage endCursor } } }',
            }),
        });
        const page1 = await page1Res.json();

        expect(page1.errors).toBeUndefined();
        expect(page1.data.companies.edges).toHaveLength(2);
        expect(page1.data.companies.pageInfo.hasNextPage).toBe(true);

        const page2Res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: auth.cookieHeader,
                'x-csrf-token': auth.csrfHeader,
            },
            body: JSON.stringify({
                query: `query($after: String!) { companies(first: 2, after: $after) { edges { node { company { id name } } } pageInfo { hasNextPage } } }`,
                variables: { after: page1.data.companies.pageInfo.endCursor },
            }),
        });
        const page2 = await page2Res.json();

        expect(page2.errors).toBeUndefined();
        expect(page2.data.companies.edges).toHaveLength(1);
        expect(page2.data.companies.pageInfo.hasNextPage).toBe(false);
    });

    it('returns all sale persons', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });
        const suffix = Date.now();

        const conn = await pool.getConnection();
        try {
            await conn.execute(
                'INSERT INTO users (email, first_name, last_name, password, role_id, permission_id) VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)',
                [
                    `sp1-${suffix}@test.local`,
                    'Alice',
                    `${suffix}`,
                    `Alice${suffix}`,
                    1,
                    1,
                    `sp2-${suffix}@test.local`,
                    'Bob',
                    `${suffix}`,
                    `Bob${suffix}`,
                    1,
                    1,
                ],
            );
        } finally {
            conn.release();
        }

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: auth.cookieHeader,
                'x-csrf-token': auth.csrfHeader,
            },
            body: JSON.stringify({ query: '{ salePersons { id email firstName lastName } }' }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.salePersons).toHaveLength(2);
        expect(json.data.salePersons[0].firstName).toBe('Alice');
        expect(json.data.salePersons[1].firstName).toBe('Bob');
    });

    it('returns a sale person by id', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });
        const suffix = Date.now();

        const conn = await pool.getConnection();
        let userID: number;
        try {
            const [result] = await conn.execute(
                'INSERT INTO users (email, first_name, last_name, password, role_id, permission_id) VALUES (?, ?, ?, ?, ?, ?)',
                [`sp-find-${suffix}@test.local`, 'Target', `${suffix}`, `password${suffix}`, 1, 1],
            );
            userID = (result as any).insertId;
        } finally {
            conn.release();
        }

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: auth.cookieHeader,
                'x-csrf-token': auth.csrfHeader,
            },
            body: JSON.stringify({
                query: `query($id: Int!) { salePerson(id: $id) { id email firstName lastName } }`,
                variables: { id: userID },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.salePerson.id).toBe(userID);
        expect(json.data.salePerson.email).toBe(`sp-find-${suffix}@test.local`);
        expect(json.data.salePerson.firstName).toBe('Target');
        expect(json.data.salePerson.lastName).toBe(`${suffix}`);
    });

    it('returns null for a non-existent sale person id', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: auth.cookieHeader,
                'x-csrf-token': auth.csrfHeader,
            },
            body: JSON.stringify({
                query: `query($id: Int!) { salePerson(id: $id) { id } }`,
                variables: { id: 99999 },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.salePerson).toBeNull();
    });

    it('returns companies filtered by commercial', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });
        const suffix = Date.now();
        const repo = new CompanyRepository();

        const conn = await pool.getConnection();
        let sp1Id: number;
        let sp2Id: number;
        try {
            const [r1] = await conn.execute(
                'INSERT INTO users (email, first_name, last_name, password, role_id, permission_id) VALUES (?, ?, ?, ?, ?, ?)',
                [`sp-a-${suffix}@test.local`, 'SP A', `${suffix}`, `SPA${suffix}`, 1, 1],
            );
            sp1Id = (r1 as any).insertId;
            const [r2] = await conn.execute(
                'INSERT INTO users (email, first_name, last_name, password, role_id, permission_id) VALUES (?, ?, ?, ?, ?, ?)',
                [`sp-b-${suffix}@test.local`, 'SP B', `${suffix}`, `SPB${suffix}`, 1, 1],
            );
            sp2Id = (r2 as any).insertId;
        } finally {
            conn.release();
        }

        const siret1 = `${suffix}4444444444`.slice(0, 14);
        const siret2 = `${suffix}5555555555`.slice(0, 14);
        await repo.create({
            user_id: sp1Id,
            name: `Company A ${suffix}`,
            siret: siret1,
            address: 'Place Alpha',
            sector: 'IT',
            conclusion: 'conclusion',
        });
        await repo.create({
            user_id: sp2Id,
            name: `Company B ${suffix}`,
            siret: siret2,
            address: 'Place Alpha',
            sector: 'IT',
            conclusion: 'conclusion',
        });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: auth.cookieHeader,
                'x-csrf-token': auth.csrfHeader,
            },
            body: JSON.stringify({
                query: `query($userID: Int!) { companyByCommercial(userID: $userID) { company { id name } salePerson { id } } }`,
                variables: { userID: sp1Id },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.companyByCommercial).toHaveLength(1);
        expect(json.data.companyByCommercial[0].company.name).toBe(`Company A ${suffix}`);
    });

    it('returns a company by siret', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });
        const suffix = Date.now();
        const repo = new CompanyRepository();

        const siret = `666${suffix}6666666`.slice(0, 14);
        const id = await repo.create({
            name: `Siret Corp ${suffix}`,
            siret,
            address: 'Place Alpha',
            sector: 'IT',
            conclusion: 'conclusion',
        });
        const seeded = await repo.findById(id);

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: auth.cookieHeader,
                'x-csrf-token': auth.csrfHeader,
            },
            body: JSON.stringify({
                query: `query($siret: String!) { companyBySiret(siret: $siret) { id name siret userID } }`,
                variables: { siret },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.companyBySiret.id).toBe(seeded!.id);
        expect(json.data.companyBySiret.name).toBe(`Siret Corp ${suffix}`);
        expect(json.data.companyBySiret.siret).toBe(siret);
    });

    it('returns null for a non-existent siret', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: auth.cookieHeader,
                'x-csrf-token': auth.csrfHeader,
            },
            body: JSON.stringify({
                query: `query($siret: String!) { companyBySiret(siret: $siret) { id } }`,
                variables: { siret: '00000000000000' },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.companyBySiret).toBeNull();
    });

    it('rejects unauthenticated requests', async () => {
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: '{ companies { edges { node { company { id } } } } }' }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeDefined();
        expect(json.errors[0].message).toMatch(/unauthorized/i);
    });
});

describe('companyStats', () => {
    beforeEach(async () => {
        await truncateMysql();
    });

    it('returns counts by status and year', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });
        const suffix = Date.now();
        const repo = new CompanyRepository();

        await repo.create({
            name: `Stats A ${suffix}`,
            siret: `${suffix}1111111111`.slice(0, 14),
            address: 'X',
            sector: 'Nord-Est',
            conclusion: 'X',
            status: 'Oui',
        });
        await repo.create({
            name: `Stats B ${suffix}`,
            siret: `${suffix}2222222222`.slice(0, 14),
            address: 'X',
            sector: 'Nord-Est',
            conclusion: 'X',
            status: 'Oui',
        });
        await repo.create({
            name: `Stats C ${suffix}`,
            siret: `${suffix}3333333333`.slice(0, 14),
            address: 'X',
            sector: 'Ouest',
            conclusion: 'X',
            status: 'Non',
        });

        const year = new Date().getFullYear();
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader },
            body: JSON.stringify({
                query: `query($year: Int!) { companyStats(year: $year) { current { status count } byPeriod { status count } years } }`,
                variables: { year },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        const stats = json.data.companyStats;
        const ouiBucket = stats.current.find((b: any) => b.status === 'Oui');
        const nonBucket = stats.current.find((b: any) => b.status === 'Non');
        expect(ouiBucket?.count).toBe(2);
        expect(nonBucket?.count).toBe(1);
        expect(Array.isArray(stats.byPeriod)).toBe(true);
        expect(stats.years).toContain(year);
    });

    it('errors on an invalid year', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'RH', permission: 'ADMIN' });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader },
            body: JSON.stringify({
                query: `query($year: Int!) { companyStats(year: $year) { current { status count } } }`,
                variables: { year: 1900 },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeDefined();
        expect(json.errors[0].message).toMatch(/invalid year/i);
    });
});

describe('companyHistory', () => {
    beforeEach(async () => {
        await truncateMysql();
    });

    it('returns history entries created on each update', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });
        const suffix = Date.now();
        const repo = new CompanyRepository();

        const siret = `${suffix}4444444444`.slice(0, 14);
        const id = await repo.create({
            name: `History Corp ${suffix}`,
            siret,
            address: 'Old Addr',
            sector: 'Nord-Est',
            conclusion: 'X',
        });

        const updateRes = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader },
            body: JSON.stringify({
                query: `mutation($id: Int!, $input: CompanyInput!) { updateCompany(id: $id, input: $input) { id } }`,
                variables: { id, input: { name: `History Corp Updated ${suffix}` } },
            }),
        });
        expect((await updateRes.json()).errors).toBeUndefined();

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader },
            body: JSON.stringify({
                query: `query($companyID: Int!) { companyHistory(companyID: $companyID) { id companyID updatedColumn status } }`,
                variables: { companyID: id },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.companyHistory).toHaveLength(1);
        expect(json.data.companyHistory[0].companyID).toBe(id);
        expect(json.data.companyHistory[0].updatedColumn).toContain('name');
    });

    it('returns an empty array when no updates were made', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });
        const suffix = Date.now();
        const repo = new CompanyRepository();

        const siret = `${suffix}5555555555`.slice(0, 14);
        const id = await repo.create({
            name: `No History Corp ${suffix}`,
            siret,
            address: 'X',
            sector: 'Nord-Est',
            conclusion: 'X',
        });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader },
            body: JSON.stringify({
                query: `query($companyID: Int!) { companyHistory(companyID: $companyID) { id } }`,
                variables: { companyID: id },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.companyHistory).toEqual([]);
    });

    it('errors when the company does not exist', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader },
            body: JSON.stringify({
                query: `query($companyID: Int!) { companyHistory(companyID: $companyID) { id } }`,
                variables: { companyID: 99999 },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeDefined();
        expect(json.errors[0].message).toMatch(/not found/i);
    });
});

describe('blacklistedCompanies', () => {
    beforeEach(async () => {
        await truncateMysql();
    });

    it('returns blacklisted companies paginated', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });
        const suffix = Date.now();
        const blacklistRepo = new CompanyBlacklistRepository();

        await blacklistRepo.create({
            name: `Banned A ${suffix}`,
            siret: `${suffix}6666666666`.slice(0, 14),
            address: 'X',
            sector: 'IT',
            conclusion: 'Fraud',
            all_blacklist: 0,
        });
        await blacklistRepo.create({
            name: `Banned B ${suffix}`,
            siret: `${suffix}7777777777`.slice(0, 14),
            address: 'X',
            sector: 'IT',
            conclusion: 'Scam',
            all_blacklist: 1,
        });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader },
            body: JSON.stringify({
                query: `{ blacklistedCompanies { edges { node { id name siret allBlacklist } } pageInfo { hasNextPage } } }`,
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.blacklistedCompanies.edges).toHaveLength(2);
        const nodes = json.data.blacklistedCompanies.edges.map((e: any) => e.node);
        const a = nodes.find((n: any) => n.name === `Banned A ${suffix}`);
        const b = nodes.find((n: any) => n.name === `Banned B ${suffix}`);
        expect(a?.allBlacklist).toBe(false);
        expect(b?.allBlacklist).toBe(true);
        expect(json.data.blacklistedCompanies.pageInfo.hasNextPage).toBe(false);
    });

    it('filters by search term', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });
        const suffix = Date.now();
        const blacklistRepo = new CompanyBlacklistRepository();

        await blacklistRepo.create({
            name: `SearchMe-${suffix}`,
            siret: `${suffix}8888888888`.slice(0, 14),
            address: 'X',
            sector: 'IT',
            conclusion: 'X',
            all_blacklist: 0,
        });
        await blacklistRepo.create({
            name: `Unrelated-${suffix}`,
            siret: `${suffix}9999999999`.slice(0, 14),
            address: 'X',
            sector: 'IT',
            conclusion: 'X',
            all_blacklist: 0,
        });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader },
            body: JSON.stringify({
                query: `query($search: String) { blacklistedCompanies(search: $search) { edges { node { name } } } }`,
                variables: { search: `SearchMe-${suffix}` },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.blacklistedCompanies.edges).toHaveLength(1);
        expect(json.data.blacklistedCompanies.edges[0].node.name).toBe(`SearchMe-${suffix}`);
    });
});
