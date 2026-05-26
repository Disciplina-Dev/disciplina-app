import { describe, it, expect, beforeEach } from 'vitest';
import { mintToken } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';
import { env } from '../../../config/env';
import { CompanyRepository } from '../../../repositories/mysql/CompanyRepository';
import pool from '../../../db/mysql/connection';
import { Role } from '../../../types/user.types';

const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/companies`;

describe('GraphQL company mutations', () => {
    beforeEach(async () => {
        await truncateMysql();
    });

    describe('createCompany', () => {
        it('creates a company with minimal required fields', async () => {
            const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
            const suffix = Date.now();
            const siret = `${suffix}0000000000`.slice(0, 14);

            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    query: `
                        mutation($input: CompanyInput!) {
                            createCompany(input: $input) {
                                id name siret address sector conclusion userID
                            }
                        }
                    `,
                    variables: {
                        input: {
                            name: `Test Corp ${suffix}`,
                            siret,
                            address: '123 Rue de Paris',
                            sector: 'TECHNOLOGY',
                            conclusion: 'Profile matches requirements',
                        },
                    },
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.createCompany.id).toBeTypeOf('number');
            expect(json.data.createCompany.name).toBe(`Test Corp ${suffix}`);
            expect(json.data.createCompany.siret).toBe(siret);
            expect(json.data.createCompany.address).toBe('123 Rue de Paris');
            expect(json.data.createCompany.sector).toBe('TECHNOLOGY');
            expect(json.data.createCompany.conclusion).toBe('Profile matches requirements');
            expect(json.data.createCompany.userID).toBeNull();

            // Verify via follow-up query
            const verify = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    query: `query($siret: String!) { companyBySiret(siret: $siret) { id name } }`,
                    variables: { siret },
                }),
            });
            const vjson = await verify.json();
            expect(vjson.data.companyBySiret.name).toBe(`Test Corp ${suffix}`);
        });

        it('creates a company with all optional fields', async () => {
            const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
            const suffix = Date.now();
            const siret = `${suffix}1111111111`.slice(0, 14);

            // Seed a sale person for the relationship
            const conn = await pool.getConnection();
            let userID: number;
            try {
                const [result] = await conn.execute(
                    'INSERT INTO users (email, name, password, role) VALUES (?, ?, ?, ?)',
                    [`sp-create-${suffix}@test.local`, `Sales Rep ${suffix}`, `password${suffix}`, Role.COMMERCIAL],
                );
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
                    query: `
                        mutation($input: CompanyInput!) {
                            createCompany(input: $input) {
                                id
                                name
                                siret
                                address
                                sector
                                conclusion
                                userID
                                legalReferent
                                phone
                                email
                                mainActivity
                                idcc
                                ape
                                notes
                            }
                        }
                    `,
                    variables: {
                        input: {
                            userID: userID,
                            legalReferent: 'John Doe',
                            name: `Full Corp ${suffix}`,
                            phone: '0123456789',
                            email: `corp-${suffix}@test.local`,
                            address: '456 Avenue des Champs',
                            sector: 'COMMERCIAL',
                            mainActivity: 'RETAIL',
                            siret,
                            idcc: '1234',
                            ape: '12345',
                            notes: 'Some notes about this company',
                            conclusion: 'Good fit',
                        },
                    },
                }),
            });
            const json = await res.json();
            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            const c = json.data.createCompany;
            expect(c.userID).toBe(userID);
            expect(c.legalReferent).toBe('John Doe');
            expect(c.phone).toBe('0123456789');
            expect(c.email).toBe(`corp-${suffix}@test.local`);
            expect(c.mainActivity).toBe('RETAIL');
            expect(c.idcc).toBe('1234');
            expect(c.ape).toBe('12345');
            expect(c.notes).toBe('Some notes about this company');
        });

        it('returns an error when siret is missing', async () => {
            const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });

            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    query: `
                        mutation($input: CompanyInput!) {
                            createCompany(input: $input) { id }
                        }
                    `,
                    variables: {
                        input: {
                            name: 'No Siret Corp',
                            address: '123 Test',
                            sector: 'IT',
                            conclusion: 'OK',
                        },
                    },
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.errors).toBeDefined();
            expect(json.errors[0].message).toMatch(/siret.*required/i);
        });

        it('returns an error when siret is not 14 characters', async () => {
            const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });

            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    query: `
                        mutation($input: CompanyInput!) {
                            createCompany(input: $input) { id }
                        }
                    `,
                    variables: {
                        input: {
                            name: 'Bad Siret Corp',
                            siret: '123',
                            address: '123 Test',
                            sector: 'IT',
                            conclusion: 'OK',
                        },
                    },
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.errors).toBeDefined();
            expect(json.errors[0].message).toMatch(/siret.*14 characters/i);
        });
    });

    describe('updateCompany', () => {
        it('updates company fields and returns camelCase result', async () => {
            const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
            const suffix = Date.now();
            const repo = new CompanyRepository();

            const siret = `${suffix}2222222222`.slice(0, 14);
            const id = await repo.create({
                name: `Old Corp ${suffix}`,
                siret,
                address: 'Old Address',
                sector: 'OLD_SECTOR',
                conclusion: 'Old conclusion',
            });

            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    query: `
                        mutation($id: Int!, $input: CompanyInput!) {
                            updateCompany(id: $id, input: $input) {
                                id name sector conclusion
                            }
                        }
                    `,
                    variables: {
                        id,
                        input: {
                            name: `Updated Corp ${suffix}`,
                            sector: 'NEW_SECTOR',
                            conclusion: 'Updated conclusion',
                        },
                    },
                }),
            });
            const json = await res.json();
            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.updateCompany.name).toBe(`Updated Corp ${suffix}`);
            expect(json.data.updateCompany.sector).toBe('NEW_SECTOR');
            expect(json.data.updateCompany.conclusion).toBe('Updated conclusion');

            // Verify via follow-up query
            const verify = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    query: `query($siret: String!) { companyBySiret(siret: $siret) { name sector conclusion } }`,
                    variables: { siret },
                }),
            });
            const vjson = await verify.json();
            expect(vjson.data.companyBySiret.name).toBe(`Updated Corp ${suffix}`);
            expect(vjson.data.companyBySiret.sector).toBe('NEW_SECTOR');
        });

        it('returns an error when updating a non-existent company', async () => {
            const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });

            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    query: `
                        mutation($id: Int!, $input: CompanyInput!) {
                            updateCompany(id: $id, input: $input) { id }
                        }
                    `,
                    variables: {
                        id: 99999,
                        input: { name: 'Ghost', sector: 'X', conclusion: 'X', address: 'X' },
                    },
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.errors).toBeDefined();
            expect(json.errors[0].message).toMatch(/not found/i);
        });
    });

    describe('deleteCompany', () => {
        it('deletes an existing company and returns true', async () => {
            const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
            const suffix = Date.now();
            const repo = new CompanyRepository();

            const siret = `${suffix}3333333333`.slice(0, 14);
            const id = await repo.create({
                name: `Delete Corp ${suffix}`,
                siret,
                address: 'Delete Address',
                sector: 'DEL',
                conclusion: 'To be deleted',
            });

            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    query: `mutation($id: Int!) { deleteCompany(id: $id) }`,
                    variables: { id },
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.errors).toBeUndefined();
            expect(json.data.deleteCompany).toBe(true);

            // Verify the company is gone
            const verify = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    query: `query($siret: String!) { companyBySiret(siret: $siret) { id } }`,
                    variables: { siret },
                }),
            });
            const vjson = await verify.json();
            expect(vjson.data.companyBySiret).toBeNull();
        });

        it('returns an error when deleting a non-existent company', async () => {
            const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });

            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    query: `mutation($id: Int!) { deleteCompany(id: $id) }`,
                    variables: { id: 99999 },
                }),
            });
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.errors).toBeDefined();
            expect(json.errors[0].message).toMatch(/not found/i);
        });
    });

    it('rejects unauthenticated requests', async () => {
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: `mutation($input: CompanyInput!) { createCompany(input: $input) { id } }`,
                variables: {
                    input: {
                        name: 'X',
                        siret: '12345678901234',
                        address: 'X',
                        sector: 'X',
                        conclusion: 'X',
                    },
                },
            }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeDefined();
        expect(json.errors[0].message).toMatch(/unauthorized/i);
    });
});
