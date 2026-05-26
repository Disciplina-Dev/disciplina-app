import { describe, it, expect, beforeEach } from 'vitest';
import { mintToken } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';
import { env } from '../../../config/env';
import { CompanyRepository } from '../../../repositories/mysql/CompanyRepository';
import pool from '../../../db/mysql/connection';
import { Role } from '../../../types/user.types';

const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/companies`;

describe('GraphQL company queries', () => {
    beforeEach(async () => {
        await truncateMysql();
    });

    it('returns an empty list when no companies exist', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                query: '{ companies { company { id name } salePerson { id email } } }',
            }),
        });
        const json = await res.json();
        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.companies).toEqual([]);
    });

    it('returns all seeded companies with camelCase fields', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
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
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                query: '{ companies { company { id name siret mainActivity userID } salePerson { id } } }',
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.companies).toHaveLength(2);
        expect(json.data.companies[0].company.name).toBe(`Alpha Corp ${suffix}`);
        expect(json.data.companies[0].company.mainActivity).toBe('RESTAURATION');
        expect(json.data.companies[0].company.userID).toBeNull();
        expect(json.data.companies[1].company.name).toBe(`Beta Corp ${suffix}`);
        expect(json.data.companies[1].company.mainActivity).toBe('COMMERCE');
    });

    it('returns companies with associated salePerson', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
        const suffix = Date.now();
        const repo = new CompanyRepository();

        const conn = await pool.getConnection();
        let userID: number;
        try {
            const [result] = await conn.execute('INSERT INTO users (email, name, password, role) VALUES (?, ?, ?, ?)', [
                `sp-${suffix}@test.local`,
                `Sale Person ${suffix}`,
                `password${suffix}`,
                Role.COMMERCIAL,
            ]);
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
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                query: '{ companies { company { id name userID } salePerson { id email name } } }',
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.companies).toHaveLength(1);
        expect(json.data.companies[0].company.userID).toBe(userID);
        expect(json.data.companies[0].salePerson.email).toBe(`sp-${suffix}@test.local`);
        expect(json.data.companies[0].salePerson.name).toBe(`Sale Person ${suffix}`);
    });

    it('returns all sale persons', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
        const suffix = Date.now();

        const conn = await pool.getConnection();
        try {
            await conn.execute('INSERT INTO users (email, name, password, role) VALUES (?, ?, ?, ?), (?, ?, ?, ?)', [
                `sp1-${suffix}@test.local`,
                `Alice ${suffix}`,
                `Alice${suffix}`,
                Role.COMMERCIAL,
                `sp2-${suffix}@test.local`,
                `Bob ${suffix}`,
                `Bob${suffix}`,
                Role.COMMERCIAL,
            ]);
        } finally {
            conn.release();
        }

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ query: '{ salePersons { id email name } }' }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.salePersons).toHaveLength(2);
        expect(json.data.salePersons[0].name).toBe(`Alice ${suffix}`);
        expect(json.data.salePersons[1].name).toBe(`Bob ${suffix}`);
    });

    it('returns a sale person by id', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
        const suffix = Date.now();

        const conn = await pool.getConnection();
        let userID: number;
        try {
            const [result] = await conn.execute('INSERT INTO users (email, name, password, role) VALUES (?, ?, ?, ?)', [
                `sp-find-${suffix}@test.local`,
                `Target ${suffix}`,
                `password${suffix}`,
                Role.COMMERCIAL,
            ]);
            userID = (result as any).insertId;
        } finally {
            conn.release();
        }

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                query: `query($id: Int!) { salePerson(id: $id) { id email name } }`,
                variables: { id: userID },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.salePerson.id).toBe(userID);
        expect(json.data.salePerson.email).toBe(`sp-find-${suffix}@test.local`);
        expect(json.data.salePerson.name).toBe(`Target ${suffix}`);
    });

    it('returns null for a non-existent sale person id', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
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
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
        const suffix = Date.now();
        const repo = new CompanyRepository();

        const conn = await pool.getConnection();
        let sp1Id: number;
        let sp2Id: number;
        try {
            const [r1] = await conn.execute('INSERT INTO users (email, name, password, role) VALUES (?, ?, ?, ?)', [
                `sp-a-${suffix}@test.local`,
                `SP A ${suffix}`,
                `SPA${suffix}`,
                Role.COMMERCIAL,
            ]);
            sp1Id = (r1 as any).insertId;
            const [r2] = await conn.execute('INSERT INTO users (email, name, password, role) VALUES (?, ?, ?, ?)', [
                `sp-b-${suffix}@test.local`,
                `SP B ${suffix}`,
                `SPB${suffix}`,
                Role.COMMERCIAL,
            ]);
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
                Authorization: `Bearer ${token}`,
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
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
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
                Authorization: `Bearer ${token}`,
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
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
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
            body: JSON.stringify({ query: '{ companies { company { id } } }' }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeDefined();
        expect(json.errors[0].message).toMatch(/unauthorized/i);
    });
});
