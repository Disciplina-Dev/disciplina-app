export type MailTemplateScope = 'rh' | 'commercial' | 'peda';

/**
 * Niveau de relance d'absence associé à un modèle du scope `peda`.
 * C'est ce champ — et non le nom du modèle — qui relie une case « Mail niv »
 * cochée dans le Sheet au modèle à utiliser (cf. PedaDraftService).
 */
export const PEDA_LEVELS = ['niv1', 'niv2', 'niv3', 'nivPlus'] as const;
export type PedaLevel = (typeof PEDA_LEVELS)[number];

export function isPedaLevel(value: unknown): value is PedaLevel {
    return typeof value === 'string' && (PEDA_LEVELS as readonly string[]).includes(value);
}

/**
 * Modèles « système » : uniques, semés par défaut, non supprimables, partagés
 * par tous les utilisateurs du scope. Repérés par ce champ (et non par leur nom).
 * `ab_signature` = mail d'invitation à signer l'Analyse du Besoin (scope commercial).
 * `ab_relance`   = relance automatique d'une AB non signée après 2 semaines (scope commercial).
 * `proposition_candidat` = mail d'invitation à la sélection de candidats (scope rh).
 */
export const MAIL_TEMPLATE_KINDS = ['ab_signature', 'ab_relance', 'proposition_candidat', 'external_access', 'external_link'] as const;
export type MailTemplateKind = (typeof MAIL_TEMPLATE_KINDS)[number];

/** Libellés affichés (front + logs). */
export const PEDA_LEVEL_LABELS: Record<PedaLevel, string> = {
    niv1: 'Niveau 1',
    niv2: 'Niveau 2',
    niv3: 'Niveau 3',
    nivPlus: 'Niveau +',
};

/** Pièce jointe d'un modèle : le fichier original est zippé et stocké sur le Drive de l'utilisateur. */
export interface MailTemplateAttachment {
    filename: string; // nom original (ex: "plaquette.pdf")
    contentType: string; // type MIME original
    driveFileId: string; // id du .zip sur Drive
}

export interface MailTemplate {
    _id: string;
    user_id: number;
    scope: MailTemplateScope;
    name: string;
    subject: string;
    body: string;
    /** Renseigné uniquement pour le scope `peda` ; null partout ailleurs. */
    peda_level: PedaLevel | null;
    /** Modèle système (ex. `ab_signature`) ; null pour les modèles créés par l'utilisateur. */
    kind: MailTemplateKind | null;
    attachment: MailTemplateAttachment | null;
    created_at: Date;
    updated_at: Date;
}

/** Signature image d'un utilisateur (une par scope), stockée sur Drive. */
export interface MailSignature {
    _id: string; // `${user_id}:${scope}`
    user_id: number;
    scope: MailTemplateScope;
    driveFileId: string;
    driveWebViewLink: string; // lien Drive du fichier signature
    filename: string; // nom du fichier sur Drive
    contentType: string;
    updated_at: Date;
}
