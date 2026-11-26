import type { ConsentType } from '../services/consentGuard';

/** Historique des consentements candidats (GDPR_INF_08.2). */
export type ConsentAction = 'GRANT' | 'WITHDRAW';
export type ConsentSource = 'CREATE' | 'UPDATE' | 'WITHDRAWAL' | 'BACKFILL';

export interface ConsentEventInput {
    candidateId: string;
    consentType: ConsentType;
    action: ConsentAction;
    consentVersion: string;
    source: ConsentSource;
    recordedBy: number | null;
    recordedAt: Date;
}

export interface ConsentHistoryEntry {
    id: number;
    candidateId: string;
    consentType: ConsentType;
    action: ConsentAction;
    consentVersion: string;
    source: ConsentSource;
    recordedBy: number | null;
    recordedByName: string | null;
    recordedAt: Date;
}
