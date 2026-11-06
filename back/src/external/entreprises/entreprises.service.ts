import { SireneEtablissement, SireneListResult } from '../insee/types';
import { logger } from '../logger';
import {
    EntrepriseEtablissementRaw,
    EntrepriseSearchCriteria,
    EntrepriseSearchResponseRaw,
    EntrepriseUniteLegaleRaw,
} from './types';

const API_BASE_URI = 'https://recherche-entreprises.api.gouv.fr/search';
const PER_PAGE = 20;

export class EntreprisesSearchService {
    private lastRequestTime = 0;
    private readonly REQUEST_DELAY_MS = 500;

    private async respectRateLimit(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.REQUEST_DELAY_MS) {
            await new Promise((resolve) => setTimeout(resolve, this.REQUEST_DELAY_MS - timeSinceLastRequest));
        }
        this.lastRequestTime = Date.now();
    }

    async search(criteria: EntrepriseSearchCriteria, offset = 0): Promise<SireneListResult> {
        const params = new URLSearchParams();
        if (criteria.query) params.set('q', criteria.query);
        if (criteria.codeCommune) params.set('code_commune', criteria.codeCommune);
        if (criteria.codePostal) params.set('code_postal', criteria.codePostal);
        if (criteria.departement) params.set('departement', criteria.departement);
        if (criteria.region) params.set('region', criteria.region);
        if (criteria.nomPersonne) params.set('nom_personne', criteria.nomPersonne);
        if (criteria.prenomsPersonne) params.set('prenoms_personne', criteria.prenomsPersonne);
        if (criteria.etatAdministratif) params.set('etat_administratif', criteria.etatAdministratif);
        if (criteria.activitePrincipale) params.set('activite_principale', criteria.activitePrincipale);
        if (criteria.categorieEntreprise) params.set('categorie_entreprise', criteria.categorieEntreprise);
        if (criteria.trancheEffectif) params.set('tranche_effectif_salarie', criteria.trancheEffectif);
        params.set('per_page', String(PER_PAGE));
        params.set('page', String(Math.floor(offset / PER_PAGE) + 1));

        await this.respectRateLimit();
        const url = `${API_BASE_URI}?${params.toString()}`;
        logger.debug({ url }, 'Entreprises: recherche');
        const response = await fetch(url, { headers: { accept: 'application/json' } });

        if (response.status === 429) {
            throw new Error('Rate limit exceeded');
        }
        if (!response.ok) {
            throw new Error(`Entreprises API error: ${response.status}`);
        }

        const raw = (await response.json()) as EntrepriseSearchResponseRaw;
        const etablissements: SireneEtablissement[] = [];
        const seen = new Set<string>();
        for (const ul of raw.results ?? []) {
            for (const e of this.toEtablissements(ul)) {
                if (seen.has(e.siret)) continue;
                seen.add(e.siret);
                etablissements.push(e);
                if (etablissements.length >= PER_PAGE) break;
            }
            if (etablissements.length >= PER_PAGE) break;
        }

        if (etablissements.length === 0) {
            throw new Error('No establishments found for the given criteria');
        }

        return {
            header: {
                total: raw.total_results ?? etablissements.length,
                debut: offset,
                nombre: etablissements.length,
                offset,
            },
            etablissements,
        };
    }

    private toEtablissements(ul: EntrepriseUniteLegaleRaw): SireneEtablissement[] {
        const candidates =
            ul.matching_etablissements && ul.matching_etablissements.length > 0
                ? ul.matching_etablissements
                : ul.siege
                  ? [ul.siege]
                  : [];
        const dirigeants = (ul.dirigeants ?? [])
            .map((d) => `${d.prenoms ?? ''} ${d.nom ?? ''}`.trim())
            .filter(Boolean)
            .join(', ');
        return candidates
            .filter((e) => e && typeof e.siret === 'string' && /^\d{14}$/.test(e.siret))
            .map((e) => this.mapToDomain(ul, e, dirigeants || null));
    }

    private mapToDomain(
        ul: EntrepriseUniteLegaleRaw,
        e: EntrepriseEtablissementRaw,
        dirigeants: string | null,
    ): SireneEtablissement {
        return {
            siren: ul.siren,
            nic: e.siret.slice(9),
            siret: e.siret,
            siegeSocial: e.est_siege,
            etatAdministratif: e.etat_administratif,
            categorieEntreprise: ul.categorie_entreprise,
            categorieJuridique: ul.nature_juridique,
            denomination: ul.nom_raison_sociale ?? ul.nom_complet,
            nomPrenom: ul.nom_raison_sociale ? null : (ul.nom_complet ?? null),
            adresse: {
                numeroVoie: e.numero_voie,
                typeVoie: e.type_voie,
                libelleVoie: e.libelle_voie,
                codePostal: e.code_postal,
                commune: e.libelle_commune,
                codeCommune: e.commune,
            },
            dirigeants,
            trancheEffectifs: e.tranche_effectif_salarie ?? ul.tranche_effectif_salarie,
            activitePrincipale: e.activite_principale ?? ul.activite_principale,
        };
    }
}
