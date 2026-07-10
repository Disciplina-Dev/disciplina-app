import { TrainingDomain } from '../../types/needsAnalysisNoSql.types';
import { Localisation } from '../../types/matching.types';
import { TitleProfessionalType } from '../../types/candidate.types';

// Grande zone régionale de La Réunion, encore utilisée pour déduire
// company_infos.sector à partir des communes d'un poste.
export type Zone = 'NORD' | 'OUEST' | 'SUD';

// Zone → communes. Sert de référentiel pour la déduction inverse (commune → zone).
export const ZONE_TO_COMMUNES: Record<Zone, Localisation[]> = {
    NORD: [Localisation.SAINT_DENIS, Localisation.SAINTE_MARIE, Localisation.SAINTE_SUZANNE],
    OUEST: [
        Localisation.SAINT_PAUL,
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
};

// Domaine de formation de l'AB → Titre Professionnel du matching.
// Seuls deux domaines existent côté AB ; correspondance la plus proche.
export const DOMAIN_TO_TP: Record<TrainingDomain, TitleProfessionalType> = {
    [TrainingDomain.SECRETARIAT]: TitleProfessionalType.SA,
    [TrainingDomain.VENTE]: TitleProfessionalType.NTC,
};
