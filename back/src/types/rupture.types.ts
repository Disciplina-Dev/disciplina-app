/**
 * Types domaine Rupture (pédagogie — ruptures de contrats d'apprentissage).
 * Comme `alternant.types.ts`, ces types sont en snake_case et miroient le
 * document Mongo — la conversion camelCase se fait au resolver
 * (cf. `services/mappers/rupture.mapper.ts`).
 */

/** Motifs légaux de rupture — liste fermée, imposée par le métier. */
export const RUPTURE_MOTIFS = [
    "Rupture pendant les 45 premiers jours en emploi, consécutifs ou non, de l'apprenti, par ce dernier ou l'employeur (art. L. 6222-18)",
    "Rupture d'un commun accord entre l'apprenti et l'employeur — aucune faute ne peut motiver un tel accord (art. L. 6222-18)",
    "Rupture en cas de faute grave ou de manquements répétés à ses obligations, de la part de l'employeur ou de l'apprenti — résiliation prononcée par le Conseil des Prud'hommes ou le juge d'instance (art. L. 6222-18)",
    "Rupture en cas d'inaptitude de l'apprenti à exercer le métier auquel il voulait se préparer, prononcée par le Conseil des Prud'hommes (art. L. 6222-18)",
    "Rupture en cas d'obtention du diplôme ou du titre de l'enseignement technologique préparé par l'apprenti — le contrat peut prendre fin de plein droit à l'initiative de l'apprenti (art. L. 6222-19)",
    "Rupture par décision administrative du directeur départemental du travail, de l'emploi et de la formation professionnelle, consécutive au risque sérieux d'atteinte à la santé ou à l'intégrité physique ou morale de l'apprenti",
    "Rupture par décision motivée du Préfet du département pour méconnaissance des obligations à la charge de l'employeur",
] as const;

export type RuptureMotif = (typeof RUPTURE_MOTIFS)[number];

export interface Rupture {
    _id: string;
    alternant_id: string;
    /** Date de la rupture (obligatoire). */
    date_rupture: Date | string;
    /** Nom de l'entreprise au moment de la rupture (pré-rempli, modifiable). */
    entreprise: string | null;
    /** Motif légal — doit appartenir à `RUPTURE_MOTIFS`. */
    motif: string;
    /** Détail / cause libre. */
    detail?: string | null;
    /** L'apprenti poursuit-il la formation ? */
    poursuit_formation: boolean;
    created_at: Date | string;
    updated_at: Date | string;
}

export interface DeclareRuptureInput {
    alternantId: string;
    dateRupture: string;
    entreprise?: string | null;
    motif: string;
    detail?: string | null;
    poursuitFormation: boolean;
}

export interface UpdateRuptureInput {
    dateRupture?: string;
    entreprise?: string | null;
    motif?: string;
    detail?: string | null;
    poursuitFormation?: boolean;
}
