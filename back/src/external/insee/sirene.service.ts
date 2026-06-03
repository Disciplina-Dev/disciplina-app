import { env } from '../../config/env';
import { SireneEtablissement, SireneRawResponse, SireneListResult } from './types';

interface RawListResponse {
    header: { total: number; debut: number; nombre: number };
    etablissements: Array<{
        siren: string;
        nic: string;
        siret: string;
        etablissementSiege: boolean;
        adresseEtablissement: {
            numeroVoieEtablissement: string | null;
            typeVoieEtablissement: string | null;
            libelleVoieEtablissement: string | null;
            codePostalEtablissement: string | null;
            libelleCommuneEtablissement: string | null;
            codeCommuneEtablissement: string | null;
        };
        periodesEtablissement: Array<{ etatAdministratifEtablissement: 'A' | 'F'; dateFin: string | null }>;
        uniteLegale: {
            categorieEntreprise: string | null;
            categorieJuridiqueUniteLegale: string | null;
            denominationUniteLegale: string | null;
            prenomUsuelUniteLegale: string | null;
            nomUniteLegale: string | null;
        };
    }>;
}

export class SireneService {
    private KEY = env.INSEE_API_KEY;
    private API_BASE_URI = 'https://api.insee.fr/api-sirene/3.11';
    private headers = {
        accept: 'application/json',
        'X-INSEE-Api-Key-Integration': this.KEY,
    };
    private lastRequestTime = 0;
    private readonly REQUEST_DELAY_MS = 140;

    private async respectRateLimit(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.REQUEST_DELAY_MS) {
            await new Promise((resolve) => setTimeout(resolve, this.REQUEST_DELAY_MS - timeSinceLastRequest));
        }
        this.lastRequestTime = Date.now();
    }

    async checkSiret(siret: string): Promise<SireneEtablissement> {
        if (!/^\d{14}$/.test(siret)) {
            throw new Error('SIRET must be a 14-digit string');
        }

        await this.respectRateLimit();
        const url = `${this.API_BASE_URI}/siret/${siret}`;
        const response = await fetch(url, { headers: this.headers });

        if (response.status === 404) {
            throw new Error('SIRET not found');
        }
        if (response.status === 401) {
            throw new Error('Invalid INSEE API key');
        }
        if (response.status === 429) {
            throw new Error('Rate limit exceeded');
        }
        if (!response.ok) {
            throw new Error(`INSEE API error: ${response.status}`);
        }

        const raw: SireneRawResponse = await response.json();
        return this.mapToDomain(raw);
    }

    async companiesByCommune(commune: string): Promise<SireneListResult> {
        const encoded = encodeURIComponent(commune);
        const url = `${this.API_BASE_URI}/siret?q=libelleCommuneEtablissement%3A${encoded}`;
        await this.respectRateLimit();
        const response = await fetch(url, { headers: this.headers });

        if (response.status === 404) {
            throw new Error('No establishments found for this commune');
        }
        if (response.status === 401) {
            throw new Error('Invalid INSEE API key');
        }
        if (response.status === 429) {
            throw new Error('Rate limit exceeded');
        }
        if (!response.ok) {
            throw new Error(`INSEE API error: ${response.status}`);
        }

        const raw = (await response.json()) as RawListResponse;
        return {
            header: {
                total: raw.header.total,
                debut: raw.header.debut,
                nombre: raw.header.nombre,
            },
            etablissements: raw.etablissements
                .map((e) => this.mapToDomain({ etablissement: e }))
                .filter((e) => e.etatAdministratif !== 'F'),
        };
    }

    private mapToDomain(raw: SireneRawResponse): SireneEtablissement {
        const { etablissement } = raw;
        const adresse = etablissement.adresseEtablissement;
        const uniteLegale = etablissement.uniteLegale;
        const periode = etablissement.periodesEtablissement[0];

        const isPersonneMorale =
            uniteLegale.denominationUniteLegale !== null && uniteLegale.denominationUniteLegale !== undefined;

        return {
            siren: etablissement.siren,
            nic: etablissement.nic,
            siret: etablissement.siret,
            siegeSocial: etablissement.etablissementSiege,
            etatAdministratif: periode.etatAdministratifEtablissement,
            categorieEntreprise: uniteLegale.categorieEntreprise,
            categorieJuridique: uniteLegale.categorieJuridiqueUniteLegale,
            denomination: isPersonneMorale ? uniteLegale.denominationUniteLegale : null,
            nomPrenom: !isPersonneMorale
                ? `${uniteLegale.prenomUsuelUniteLegale ?? ''} ${uniteLegale.nomUniteLegale ?? ''}`.trim() || null
                : null,
            adresse: {
                numeroVoie: adresse.numeroVoieEtablissement,
                typeVoie: adresse.typeVoieEtablissement,
                libelleVoie: adresse.libelleVoieEtablissement,
                codePostal: adresse.codePostalEtablissement,
                commune: adresse.libelleCommuneEtablissement,
                codeCommune: adresse.codeCommuneEtablissement,
            },
        };
    }
}
