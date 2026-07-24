import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';
import { env } from '../../../config/env';
import { CompanyRepository } from '../../../repositories/mysql/CompanyRepository';
import { CompanyBlacklistRepository } from '../../../repositories/mysql/CompanyBlacklistRepository';
import { SireneService } from '../../../external/insee/sirene.service';
import { JobRole, Permission } from '../../../types/user.types';
import pool from '../../../db/mysql/connection';

const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/companies`;

const MUTATION = `
    mutation($input: CompanyInput!) {
        createCompany(input: $input) { id name siret }
    }
`;

function validEtablissement(siret: string) {
    return {
        siren: siret.slice(0, 9),
        nic: siret.slice(9),
        siret,
        siegeSocial: true,
        etatAdministratif: 'A' as const,
        categorieEntreprise: null,
        categorieJuridique: null,
        denomination: 'Test Company',
        nomPrenom: null,
        adresse: {
            numeroVoie: null,
            typeVoie: null,
            libelleVoie: null,
            codePostal: null,
            commune: null,
            codeCommune: null,
        },
    };
}

async function createCompany(auth: { cookieHeader: string; csrfHeader: string }, input: Record<string, unknown>) {
    const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Cookie: auth.cookieHeader,
            'x-csrf-token': auth.csrfHeader,
        },
        body: JSON.stringify({ query: MUTATION, variables: { input } }),
    });
    return { res, json: await res.json() };
}

describe('createCompany INSEE + blacklist validation', () => {
    let checkSiret: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
        await truncateMysql();
        const conn = await pool.getConnection();
        await conn.execute(
            'INSERT INTO users (email, first_name, last_name, password, role_id, permission_id) VALUES (?, ?, ?, ?, ?, ?)',
            ['admin@test.local', 'Admin', 'User', 'password', 1, 3],
        );
        conn.release();
        checkSiret = vi.spyOn(SireneService.prototype, 'checkSiret');
    });

    afterEach(() => {
        checkSiret.mockRestore();
    });

    it('rejects when INSEE does not recognise the SIRET', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });
        const suffix = Date.now();
        const siret = `${suffix}0000000010`.slice(0, 14);
        checkSiret.mockRejectedValue(new Error('SIRET not found'));

        const { res, json } = await createCompany(auth, {
            name: `Unknown Corp ${suffix}`,
            siret,
            address: 'X',
            sector: 'IT',
            conclusion: 'X',
        });

        expect(res.status).toBe(200);
        expect(json.errors).toBeDefined();
        expect(json.errors[0].message).toMatch(/SIRET invalide/);
        expect(checkSiret).toHaveBeenCalledWith(siret);
    });

    it('rejects when the SIRET is already in the portfolio', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });
        const suffix = Date.now();
        const siret = `${suffix}0000000011`.slice(0, 14);
        checkSiret.mockResolvedValue(validEtablissement(siret));

        await new CompanyRepository().create({
            name: `Existing Corp ${suffix}`,
            siret,
            address: 'X',
            sector: 'IT',
            conclusion: 'X',
        });

        const { res, json } = await createCompany(auth, {
            name: `Duplicate Corp ${suffix}`,
            siret,
            address: 'X',
            sector: 'IT',
            conclusion: 'X',
        });

        expect(res.status).toBe(200);
        expect(json.errors).toBeDefined();
        expect(json.errors[0].message).toMatch(/déjà dans le portefeuille/);
    });

    it('rejects when the whole SIREN is blacklisted', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });
        const siren = Date.now().toString().slice(0, 9);
        const blacklistedSiret = `${siren}00001`;
        const newSiret = `${siren}00099`;
        checkSiret.mockResolvedValue(validEtablissement(newSiret));

        await new CompanyBlacklistRepository().create({
            name: 'Blacklisted Unit',
            siret: blacklistedSiret,
            address: 'X',
            sector: 'IT',
            conclusion: 'Banned previously',
            all_blacklist: 1,
        });

        const { res, json } = await createCompany(auth, {
            name: 'New Establishment',
            siret: newSiret,
            address: 'X',
            sector: 'IT',
            conclusion: 'X',
        });

        expect(res.status).toBe(200);
        expect(json.errors).toBeDefined();
        expect(json.errors[0].message).toMatch(/blacklistée/);
    });

    it('rejects when the exact SIRET is blacklisted, even without all_blacklist', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });
        const siren = Date.now().toString().slice(0, 9);
        const siret = `${siren}00001`;
        checkSiret.mockResolvedValue(validEtablissement(siret));

        await new CompanyBlacklistRepository().create({
            name: 'Blacklisted Establishment',
            siret,
            address: 'X',
            sector: 'IT',
            conclusion: 'Banned previously',
            all_blacklist: 0,
        });

        const { res, json } = await createCompany(auth, {
            name: 'New Establishment',
            siret,
            address: 'X',
            sector: 'IT',
            conclusion: 'X',
        });

        expect(res.status).toBe(200);
        expect(json.errors).toBeDefined();
        expect(json.errors[0].message).toMatch(/blacklistée/);
    });

    it('creates the company when INSEE confirms the SIRET and nothing is blacklisted', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });
        const suffix = Date.now();
        const siret = `${suffix}0000000012`.slice(0, 14);
        checkSiret.mockResolvedValue(validEtablissement(siret));

        const { res, json } = await createCompany(auth, {
            name: `Brand New Corp ${suffix}`,
            siret,
            address: 'X',
            sector: 'IT',
            conclusion: 'X',
        });

        expect(res.status).toBe(200);
        expect(json.errors).toBeUndefined();
        expect(json.data.createCompany.siret).toBe(siret);
        expect(json.data.createCompany.name).toBe(`Brand New Corp ${suffix}`);
    });
});
