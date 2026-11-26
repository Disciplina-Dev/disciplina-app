import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { truncateMysql } from '../../../../test/helpers/db';
import { env } from '../../../config/env';
import { SireneService } from '../../../external/insee/sirene.service';
import { GeocodageService } from '../../../external/insee/geocodage.service';

const BASE = `http://localhost:${env.API_PORT}/api/sourcing`;

const SIRET = '12345678900001';

function sireneEtablissement() {
    return {
        siren: SIRET.slice(0, 9),
        nic: SIRET.slice(9),
        siret: SIRET,
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

describe('GET /api/sourcing/:sirenOrSiret routing', () => {
    let checkSiret: ReturnType<typeof vi.spyOn>;
    let searchCompletion: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
        await truncateMysql();
        checkSiret = vi.spyOn(SireneService.prototype, 'checkSiret');
        searchCompletion = vi.spyOn(GeocodageService.prototype, 'search');
    });

    afterEach(() => {
        checkSiret.mockRestore();
        searchCompletion.mockRestore();
    });

    it('dispatches a 14-digit SIRET to checkSiret instead of 404 SIREN invalide', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });
        checkSiret.mockResolvedValue(sireneEtablissement());

        const res = await fetch(`${BASE}/${SIRET}`, {
            headers: { Cookie: auth.cookieHeader },
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.siret).toBe(SIRET);
        expect(json.alreadyExists).toBe(false);
        expect(json.isBlacklisted).toBe(false);
        expect(checkSiret).toHaveBeenCalledWith(SIRET);
    });

    it('returns 404 for a value that is neither a 9-digit SIREN nor a 14-digit SIRET', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });

        const res = await fetch(`${BASE}/notadigit`, {
            headers: { Cookie: auth.cookieHeader },
        });

        expect(res.status).toBe(404);
        expect(checkSiret).not.toHaveBeenCalled();
    });

    it('keeps /completion reachable (not swallowed by the param route)', async () => {
        const auth = mintAuthCookies({ id: 1, email: 'admin@test.local', role: 'COMMERCIAL', permission: 'ADMIN' });
        searchCompletion.mockResolvedValue(null);

        const res = await fetch(`${BASE}/completion?input=paris`, {
            headers: { Cookie: auth.cookieHeader },
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json).toEqual({ status: 'KO', results: [] });
        expect(checkSiret).not.toHaveBeenCalled();
    });
});
