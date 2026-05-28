import { env } from '../../config/env';
import { SireneEtablissement, SireneRawResponse } from './types';

export class SireneService {
    private KEY = env.INSEE_API_KEY;
    private API_BASE_URI = 'https://api.insee.fr/api-sirene/3.11';
    private headers = {
        accept: 'application/json',
        'X-INSEE-Api-Key-Integration': this.KEY,
    };

    async checkSiret(siret: string): Promise<SireneEtablissement> {
        if (!/^\d{14}$/.test(siret)) {
            throw new Error('SIRET must be a 14-digit string');
        }

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
