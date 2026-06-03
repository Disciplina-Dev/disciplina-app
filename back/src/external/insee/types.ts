export interface SireneAdresse {
    numeroVoie: string | null;
    typeVoie: string | null;
    libelleVoie: string | null;
    codePostal: string | null;
    commune: string | null;
    codeCommune: string | null;
}

export interface SireneEtablissement {
    siren: string;
    nic: string;
    siret: string;
    siegeSocial: boolean;
    etatAdministratif: 'A' | 'F';
    categorieEntreprise: string | null;
    categorieJuridique: string | null;
    denomination: string | null;
    nomPrenom: string | null;
    adresse: SireneAdresse;
}

interface SireneAdresseRaw {
    numeroVoieEtablissement: string | null;
    typeVoieEtablissement: string | null;
    libelleVoieEtablissement: string | null;
    codePostalEtablissement: string | null;
    libelleCommuneEtablissement: string | null;
    codeCommuneEtablissement: string | null;
}

interface SirenePeriodeRaw {
    etatAdministratifEtablissement: 'A' | 'F';
    dateFin: string | null;
}

interface UniteLegaleRaw {
    categorieEntreprise: string | null;
    categorieJuridiqueUniteLegale: string | null;
    denominationUniteLegale: string | null;
    prenomUsuelUniteLegale: string | null;
    nomUniteLegale: string | null;
}

interface EtablissementRaw {
    siren: string;
    nic: string;
    siret: string;
    etablissementSiege: boolean;
    adresseEtablissement: SireneAdresseRaw;
    periodesEtablissement: SirenePeriodeRaw[];
    uniteLegale: UniteLegaleRaw;
}

export interface SireneRawResponse {
    etablissement: EtablissementRaw;
}

export interface SireneListHeader {
    total: number;
    debut: number;
    nombre: number;
    offset: number;
}

export interface SireneListResult {
    header: SireneListHeader;
    etablissements: SireneEtablissement[];
}
