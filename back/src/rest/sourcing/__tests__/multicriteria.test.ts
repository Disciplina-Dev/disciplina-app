import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';
import { env } from '../../../config/env';
import { SireneService } from '../../../external/insee/sirene.service';
import { EntreprisesSearchService } from '../../../external/entreprises/entreprises.service';

const BASE = `http://localhost:${env.API_PORT}/api/sourcing/multicriteria`;

function etablissement(siret: string) {
    return {
        siren: siret.slice(0, 9),
        nic: siret.slice(9),
        siret,
        siegeSocial: true,
        etatAdministratif: 'A' as const,
        categorieEntreprise: 'PME',
        categorieJuridique: '5710',
        denomination: 'Some Company',
        nomPrenom: null,
        adresse: {
            numeroVoie: null,
            typeVoie: null,
            libelleVoie: null,
            codePostal: '97400',
            commune: 'Saint-Denis',
            codeCommune: '97411',
        },
        dirigeants: 'Jean Dupont',
        trancheEffectifs: '11',
        activitePrincipale: '62.01Z',
    };
}

function listResult(siret: string) {
    return {
        header: { total: 1, debut: 0, nombre: 1, offset: 0 },
        etablissements: [etablissement(siret)],
    };
}

describe('POST /api/sourcing/multicriteria routing', () => {
    let sireneSearch: ReturnType<typeof vi.spyOn>;
    let entreprisesSearch: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
        await truncateMysql();
        sireneSearch = vi.spyOn(SireneService.prototype, 'searchEstablishments');
        entreprisesSearch = vi.spyOn(EntreprisesSearchService.prototype, 'search');
    });

    afterEach(() => {
        sireneSearch.mockRestore();
        entreprisesSearch.mockRestore();
    });

    async function post(criteria: Array<{ paramName: string; value: string }>) {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });
        return fetch(BASE, {
            method: 'POST',
            headers: { Cookie: auth.cookieHeader, 'Content-Type': 'application/json', 'x-csrf-token': auth.csrfHeader },
            body: JSON.stringify({ criteria }),
        });
    }

    it('routes dirigeant criteria to the Entreprises API', async () => {
        entreprisesSearch.mockResolvedValue(listResult('12345678900001'));

        const res = await post([{ paramName: 'nomDirigeant', value: 'Dupont' }]);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(entreprisesSearch).toHaveBeenCalledTimes(1);
        expect(sireneSearch).not.toHaveBeenCalled();
        expect(json.etablissements).toHaveLength(1);
        expect(json.etablissements[0].dirigeants).toBe('Jean Dupont');
        // Critère transmis au service externe (pas d'objet étalé, champs explicites).
        expect(entreprisesSearch).toHaveBeenCalledWith(expect.objectContaining({ nomPersonne: 'Dupont' }), 0);
    });

    it('routes departement/region/etat criteria to the Entreprises API', async () => {
        entreprisesSearch.mockResolvedValue(listResult('12345678900002'));

        const res = await post([
            { paramName: 'departement', value: '974' },
            { paramName: 'etatAdministratif', value: 'A' },
        ]);

        expect(res.status).toBe(200);
        expect(entreprisesSearch).toHaveBeenCalledTimes(1);
        expect(sireneSearch).not.toHaveBeenCalled();
        expect(entreprisesSearch).toHaveBeenCalledWith(
            expect.objectContaining({ departement: '974', etatAdministratif: 'A' }),
            0,
        );
    });

    it('keeps legacy commune/NAF criteria on the Sirene API', async () => {
        sireneSearch.mockResolvedValue(listResult('12345678900003'));

        const res = await post([
            { paramName: 'libelleCommuneEtablissement', value: 'Saint-Denis' },
            { paramName: 'activitePrincipaleUniteLegale', value: '62.01Z' },
        ]);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(sireneSearch).toHaveBeenCalledTimes(1);
        expect(entreprisesSearch).not.toHaveBeenCalled();
        expect(json.etablissements).toHaveLength(1);
    });

    it('translates the legacy department wildcard to the Entreprises API', async () => {
        entreprisesSearch.mockResolvedValue(listResult('12345678900004'));

        const res = await post([
            { paramName: 'codeCommuneEtablissement', value: '974*' },
            { paramName: 'denomination', value: 'Boulangerie' },
        ]);

        expect(res.status).toBe(200);
        expect(entreprisesSearch).toHaveBeenCalledWith(
            expect.objectContaining({ departement: '974', query: 'Boulangerie' }),
            0,
        );
    });

    it('rejects an invalid departement with 400 without calling any API', async () => {
        const res = await post([{ paramName: 'departement', value: 'NOT-A-DEPT!!!' }]);

        expect(res.status).toBe(400);
        expect(entreprisesSearch).not.toHaveBeenCalled();
        expect(sireneSearch).not.toHaveBeenCalled();
    });
});
