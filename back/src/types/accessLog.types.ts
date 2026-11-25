/** Journal d'accès aux données candidat (GDPR_INF_06.5). */
export type AccessAction = 'VIEW' | 'LIST' | 'SSN_UNMASK' | 'PDF_EXPORT' | 'CV_READ' | 'FILE_READ' | 'AVATAR_READ';
export type AccessActorType = 'STAFF' | 'EXTERNAL';

export interface AccessEventInput {
    /** UUID de la fiche ; null pour la consultation d'une liste en masse. */
    candidateId: string | null;
    /** Id utilisateur ; null pour un acteur externe (lien signé). */
    actorId: number | null;
    actorType: AccessActorType;
    action: AccessAction;
    /** Nombre de fiches renvoyées (liste) ; 1 par défaut. */
    resultCount?: number;
}

export interface AccessLogEntry {
    id: number;
    candidateId: string | null;
    actorId: number | null;
    actorName: string | null;
    actorType: AccessActorType;
    action: AccessAction;
    resultCount: number;
    createdAt: Date;
}
