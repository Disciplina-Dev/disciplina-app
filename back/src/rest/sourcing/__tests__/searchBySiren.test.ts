import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mintToken } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';
import { env } from '../../../config/env';
import { CompanyBlacklistRepository } from '../../../repositories/mysql/CompanyBlacklistRepository';
import { SireneService } from '../../../external/insee/sirene.service';

const BASE = `http://localhost:${env.API_PORT}/api/sourcing`;

function etablissement(siret: string) {
    return {
        siren: siret.slice(0, 9),
        nic: siret.slice(9),
        siret,
        siegeSocial: true,
        etatAdministratif: 'A' as const,
        categorieEntreprise: null,
        categorieJuridique: null,
        denomination: 'Some Company',
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

describe('GET /api/sourcing/:siren blacklist branches', () => {
    let searchEstablishments: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
        await truncateMysql();
        searchEstablishments = vi.spyOn(SireneService.prototype, 'searchEstablishments');
    });

    afterEach(() => {
        searchEstablishments.mockRestore();
    });

    it('short-circuits without calling INSEE when the whole SIREN is blacklisted', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });
        const siren = Date.now().toString().slice(0, 9);
        const siret = `${siren}00001`;

        await new CompanyBlacklistRepository().create({
            name: 'Blacklisted Unit',
            siret,
            address: 'X',
            sector: 'IT',
            conclusion: 'Banned for fraud',
            all_blacklist: 1,
        });

        const res = await fetch(`${BASE}/${siren}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.allBlacklisted).toBe(true);
        expect(json.message).toMatch(/blacklisté/);
        expect(json.blacklisted).toHaveLength(1);
        expect(json.blacklisted[0].siret).toBe(siret);
        expect(json.blacklisted[0].conclusion).toBe('Banned for fraud');
        expect(json.companiesWithSale).toEqual([]);
        expect(json.etablissements).toEqual([]);
        expect(searchEstablishments).not.toHaveBeenCalled();
    });

    it('lists blacklisted establishments alongside normal results when all_blacklist is 0', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });
        const siren = Date.now().toString().slice(0, 9);
        const blacklistedSiret = `${siren}00001`;
        const otherSiret = `${siren}00002`;

        await new CompanyBlacklistRepository().create({
            name: 'Partially Blacklisted',
            siret: blacklistedSiret,
            address: 'X',
            sector: 'IT',
            conclusion: 'One establishment banned',
            all_blacklist: 0,
        });

        searchEstablishments.mockResolvedValue({
            header: { total: 1, debut: 0, nombre: 1, offset: 0 },
            etablissements: [etablissement(otherSiret)],
        });

        const res = await fetch(`${BASE}/${siren}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.allBlacklisted).toBe(false);
        expect(json.blacklisted).toHaveLength(1);
        expect(json.blacklisted[0].siret).toBe(blacklistedSiret);
        expect(json.blacklisted[0].conclusion).toBe('One establishment banned');
        expect(json.etablissements).toHaveLength(1);
        expect(json.etablissements[0].siret).toBe(otherSiret);
        expect(searchEstablishments).toHaveBeenCalled();
    });

    it('returns no blacklist entries when nothing is blacklisted', async () => {
        const token = mintToken({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });
        const siren = Date.now().toString().slice(0, 9);
        const siret = `${siren}00003`;

        searchEstablishments.mockResolvedValue({
            header: { total: 1, debut: 0, nombre: 1, offset: 0 },
            etablissements: [etablissement(siret)],
        });

        const res = await fetch(`${BASE}/${siren}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.allBlacklisted).toBe(false);
        expect(json.blacklisted).toEqual([]);
        expect(json.etablissements).toHaveLength(1);
    });
});
