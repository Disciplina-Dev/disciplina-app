import { TrainingDomain } from '../../types/needsAnalysisNoSql.types';
import { Localisation } from '../../types/matching.types';
import { TitleProfessionalType } from '../../types/candidate.types';

// Grande zone régionale : les 3 zones historiques de La Réunion, plus les
// 6 secteurs opérationnels du tenant Annemasse (Haute-Savoie). Sert à déduire
// company_infos.sector à partir des communes d'un poste.
export type Zone =
    | 'NORD'
    | 'OUEST'
    | 'SUD'
    | 'GENEVE_FRONTIERE'
    | 'GENEVOIS'
    | 'ARVE'
    | 'FAUCIGNY'
    | 'ANNECY'
    | 'CHABLAIS';

// Zone → communes. Sert de référentiel pour la déduction inverse (commune → zone).
// Doit couvrir tout l'enum Localisation : une commune absente retomberait sur le
// fallback de zoneFromCommunes, qui poserait un secteur faux sans lever d'erreur.
export const ZONE_TO_COMMUNES: Record<Zone, Localisation[]> = {
    // NORD porte le secteur « Nord-Est » côté MySQL : les communes de l'Est y sont rattachées.
    NORD: [
        Localisation.SAINT_DENIS,
        Localisation.SAINTE_MARIE,
        Localisation.SAINTE_SUZANNE,
        Localisation.SAINTE_ROSE,
        Localisation.SAINT_BENOIT,
        Localisation.BRAS_PANON,
        Localisation.SAINT_ANDRE,
        Localisation.LA_PLAINE_DES_PALMISTES,
        Localisation.SALAZIE,
        Localisation.SAINTE_ANNE,
    ],
    OUEST: [
        Localisation.SAINT_PAUL,
        Localisation.SAINT_GILLES,
        Localisation.LA_POSSESSION,
        Localisation.LE_PORT,
        Localisation.TROIS_BASSINS,
        Localisation.SAINT_LEU,
        Localisation.LES_AVIRONS,
    ],
    SUD: [
        Localisation.SAINT_PIERRE,
        Localisation.SAINT_LOUIS,
        Localisation.ETANG_SALE,
        Localisation.LE_TAMPON,
        Localisation.SAINT_JOSEPH,
        Localisation.SAINT_PHILLIPE,
        Localisation.PETIT_ILE,
        Localisation.CILAOS,
        Localisation.ENTRE_DEUX,
    ],
    // Tenant Annemasse (Haute-Savoie). BONS_EN_CHABLAIS est rattaché aux deux
    // secteurs opérationnels qui le revendiquent (Genève / frontière et
    // Chablais) : en cas de doublon, COMMUNE_TO_ZONE retient la dernière zone
    // listée (CHABLAIS).
    GENEVE_FRONTIERE: [
        Localisation.ANNEMASSE,
        Localisation.AMBILLY,
        Localisation.GAILLARD,
        Localisation.VILLE_LA_GRAND,
        Localisation.VETRAZ_MONTHOUX,
        Localisation.ETREMBIERES,
        Localisation.CRANVES_SALES,
        Localisation.SAINT_CERGUES,
        Localisation.JUVIGNY,
        Localisation.BONNE,
        Localisation.MACHILLY,
        Localisation.DOUVAINE,
        Localisation.VEIGY_FONCENEX,
        Localisation.BONS_EN_CHABLAIS,
        Localisation.SCIEZ,
        Localisation.THONON_LES_BAINS,
        Localisation.EVIAN_LES_BAINS,
    ],
    GENEVOIS: [
        Localisation.SAINT_JULIEN_EN_GENEVOIS,
        Localisation.ARCHAMPS,
        Localisation.NEYDENS,
        Localisation.COLLONGES_SOUS_SALEVE,
        Localisation.PRESILLY,
        Localisation.BEAUMONT,
        Localisation.FEIGERES,
        Localisation.VIRY,
        Localisation.VALLEIRY,
        Localisation.VULBENS,
        Localisation.CHENEX,
    ],
    ARVE: [
        Localisation.REIGNIER_ESERY,
        Localisation.ARENTHON,
        Localisation.CONTAMINE_SUR_ARVE,
        Localisation.BONNEVILLE,
        Localisation.AYSE,
        Localisation.MARIGNIER,
        Localisation.VOUGY,
        Localisation.CLUSES,
        Localisation.SCIONZIER,
        Localisation.MARNAZ,
    ],
    FAUCIGNY: [
        Localisation.LA_ROCHE_SUR_FORON,
        Localisation.AMANCY,
        Localisation.SAINT_PIERRE_EN_FAUCIGNY,
        Localisation.ETAUX,
        Localisation.CORNIER,
        Localisation.PERS_JUSSY,
        Localisation.SCIENTRIER,
        Localisation.ARBUSIGNY,
    ],
    ANNECY: [
        Localisation.ANNECY,
        Localisation.PRINGY,
        Localisation.EPAGNY_METZ_TESSY,
        Localisation.POISY,
        Localisation.MEYTHET,
        Localisation.SEYNOD,
        Localisation.CRAN_GEVRIER,
        Localisation.ARGONAY,
    ],
    CHABLAIS: [
        Localisation.BONS_EN_CHABLAIS,
        Localisation.PERRIGNIER,
        Localisation.BOEGE,
        Localisation.FILLINGES,
        Localisation.VIUZ_EN_SALLAZ,
        Localisation.SAINT_JEOIRE,
    ],
};

// Domaine de formation de l'AB → Titre Professionnel du matching (fallback).
// Seuls deux domaines existent côté AB ; correspondance la plus proche.
export const DOMAIN_TO_TP: Record<TrainingDomain, TitleProfessionalType> = {
    [TrainingDomain.SECRETARIAT]: TitleProfessionalType.SA,
    [TrainingDomain.VENTE]: TitleProfessionalType.NTC,
};

// Titre du poste saisi par le commercial → Titre Professionnel exact.
export const TITLE_TO_TP: Record<string, TitleProfessionalType> = {
    'Secrétaire Assistante': TitleProfessionalType.SA,
    'Assistante de Direction': TitleProfessionalType.AD,
    'Conseiller Commercial': TitleProfessionalType.CC,
    'Négociateur Technico-Commercial': TitleProfessionalType.NTC,
    "Responsable d'Établissement Marchand": TitleProfessionalType.REM,
};
