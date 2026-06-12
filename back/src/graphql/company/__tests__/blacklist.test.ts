import { describe, it, expect, beforeEach } from 'vitest';
import { mintToken } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';
import { env } from '../../../config/env';
import { CompanyRepository } from '../../../repositories/mysql/CompanyRepository';
import { CompanyBlacklistRepository } from '../../../repositories/mysql/CompanyBlacklistRepository';

const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/companies`;

const MUTATION = `
    mutation($id: Int!, $reason: String!, $allBlacklist: Boolean!) {
        blacklistCompany(id: $id, reason: $reason, allBlacklist: $allBlacklist)
    }
`;

async function callBlacklist(token: string, variables: Record<string, unknown>) {
    const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: MUTATION, variables }),
    });
    return { res, json: await res.json() };
}

describe('GraphQL blacklistCompany mutation', () => {
    beforeEach(async () => {
        await truncateMysql();
    });

    it('moves a single company to the blacklist with the given reason', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
        const suffix = Date.now();
        const repo = new CompanyRepository();
        const blacklistRepo = new CompanyBlacklistRepository();

        const siret = `${suffix}0000000001`.slice(0, 14);
        const id = await repo.create({
            name: `Ban Corp ${suffix}`,
            siret,
            address: 'Ban Street',
            sector: 'IT',
            conclusion: 'old conclusion',
        });

        const { res, json } = await callBlacklist(token, { id, reason: 'Fraudulent behaviour', allBlacklist: false });

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.blacklistCompany).toBe(true);

        // Removed from companies
        expect(await repo.findById(id)).toBeNull();

        // Moved into companies_blacklist with reason as conclusion, all_blacklist = 0
        const blacklisted = await blacklistRepo.findBySiret(siret);
        expect(blacklisted).not.toBeNull();
        expect(blacklisted!.name).toBe(`Ban Corp ${suffix}`);
        expect(blacklisted!.conclusion).toBe('Fraudulent behaviour');
        expect(blacklisted!.all_blacklist).toBe(0);
    });

    it('moves every company sharing the same SIREN when allBlacklist is true', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
        const repo = new CompanyRepository();
        const blacklistRepo = new CompanyBlacklistRepository();

        const siren = Date.now().toString().slice(0, 9);
        const siretA = `${siren}00001`;
        const siretB = `${siren}00002`;

        const idA = await repo.create({
            name: `Legal Unit A`,
            siret: siretA,
            address: 'Place A',
            sector: 'IT',
            conclusion: 'A',
        });
        const idB = await repo.create({
            name: `Legal Unit B`,
            siret: siretB,
            address: 'Place B',
            sector: 'IT',
            conclusion: 'B',
        });

        const { res, json } = await callBlacklist(token, { id: idA, reason: 'Whole unit banned', allBlacklist: true });

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.blacklistCompany).toBe(true);

        // Both companies removed from companies
        expect(await repo.findById(idA)).toBeNull();
        expect(await repo.findById(idB)).toBeNull();

        // Both moved into companies_blacklist with all_blacklist = 1
        const blacklistedA = await blacklistRepo.findBySiret(siretA);
        const blacklistedB = await blacklistRepo.findBySiret(siretB);
        expect(blacklistedA).not.toBeNull();
        expect(blacklistedB).not.toBeNull();
        expect(blacklistedA!.all_blacklist).toBe(1);
        expect(blacklistedB!.all_blacklist).toBe(1);
        expect(blacklistedA!.conclusion).toBe('Whole unit banned');
        expect(blacklistedB!.conclusion).toBe('Whole unit banned');
    });

    it('rejects when reason is empty', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });
        const suffix = Date.now();
        const repo = new CompanyRepository();

        const siret = `${suffix}0000000002`.slice(0, 14);
        const id = await repo.create({
            name: `No Reason Corp ${suffix}`,
            siret,
            address: 'X',
            sector: 'IT',
            conclusion: 'X',
        });

        const { res, json } = await callBlacklist(token, { id, reason: '   ', allBlacklist: false });

        expect(res.status).toBe(200);
        expect(json.errors).toBeDefined();
        expect(json.errors[0].message).toMatch(/reason is required/i);

        // Company is untouched
        expect(await repo.findById(id)).not.toBeNull();
    });

    it('rejects when the company does not exist', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'ADMIN' });

        const { res, json } = await callBlacklist(token, { id: 999999, reason: 'Unknown', allBlacklist: false });

        expect(res.status).toBe(200);
        expect(json.errors).toBeDefined();
        expect(json.errors[0].message).toMatch(/not found/i);
    });

    it('rejects unauthenticated requests', async () => {
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: MUTATION, variables: { id: 1, reason: 'x', allBlacklist: false } }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.errors).toBeDefined();
        expect(json.errors[0].message).toMatch(/unauthorized/i);
    });

    it('rejects users without COMMERCIAL, RESPONSABLE or ADMIN role', async () => {
        const token = mintToken({ id: 1, email: 'rh@test.local', role: 'RH' });

        const { res, json } = await callBlacklist(token, { id: 1, reason: 'x', allBlacklist: false });

        expect(res.status).toBe(200);
        expect(json.errors).toBeDefined();
        expect(json.errors[0].message).toMatch(/forbidden/i);
    });
});
