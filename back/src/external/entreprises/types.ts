export interface EntrepriseDirigeantRaw {
    nom: string | null;
    prenoms: string | null;
    qualite: string | null;
    type_dirigeant: string | null;
}

export interface EntrepriseEtablissementRaw {
    siret: string;
    est_siege: boolean;
    etat_administratif: 'A' | 'F';
    activite_principale: string | null;
    tranche_effectif_salarie: string | null;
    numero_voie: string | null;
    type_voie: string | null;
    libelle_voie: string | null;
    code_postal: string | null;
    libelle_commune: string | null;
    commune: string | null;
    departement: string | null;
    region: string | null;
}

export interface EntrepriseUniteLegaleRaw {
    siren: string;
    nom_complet: string | null;
    nom_raison_sociale: string | null;
    activite_principale: string | null;
    categorie_entreprise: string | null;
    nature_juridique: string | null;
    etat_administratif: 'A' | 'C';
    tranche_effectif_salarie: string | null;
    dirigeants: EntrepriseDirigeantRaw[];
    siege: EntrepriseEtablissementRaw | null;
    matching_etablissements: EntrepriseEtablissementRaw[];
}

export interface EntrepriseSearchResponseRaw {
    results: EntrepriseUniteLegaleRaw[];
    total_results: number;
    page: number;
    per_page: number;
    total_pages: number;
}

/** Critères normalisés côté backend pour l'API Recherche d'entreprises. */
export interface EntrepriseSearchCriteria {
    query: string | null;
    codeCommune: string | null;
    codePostal: string | null;
    departement: string | null;
    region: string | null;
    nomPersonne: string | null;
    prenomsPersonne: string | null;
    etatAdministratif: string | null;
    activitePrincipale: string | null;
    categorieEntreprise: string | null;
    trancheEffectif: string | null;
}
