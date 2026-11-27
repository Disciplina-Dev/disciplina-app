import { ConsentHistoryRepository } from '../repositories/mysql/ConsentHistoryRepository';
import { CandidateConsentments } from '../types/candidate.types';
import { ConsentAction, ConsentEventInput, ConsentHistoryEntry, ConsentSource } from '../types/consent.types';
import { CONSENT_TYPES, ConsentType } from './consentGuard';

type ConsentSnapshot = Partial<Pick<CandidateConsentments, ConsentType | 'consent_version'>> | null | undefined;

/** Taille de la colonne `consent_version` : une version historique plus longue est tronquée. */
const VERSION_MAX_LENGTH = 32;

/**
 * Événements de consentement entre deux états d'une fiche (GDPR_INF_08.2) :
 * - type passé à `true` → GRANT ;
 * - type passé à `false` → WITHDRAW ;
 * - type resté à `true` mais version du corpus légal changée → GRANT (re-consentement).
 * Un état antérieur absent (création, fiche ancienne) vaut « rien de consenti » :
 * seuls les types accordés produisent un événement.
 */
export function consentEvents(
    candidateId: string,
    previous: ConsentSnapshot,
    next: ConsentSnapshot,
    meta: { source: ConsentSource; recordedBy: number | null; recordedAt: Date },
): ConsentEventInput[] {
    if (!next) return [];
    const version = (next.consent_version ?? previous?.consent_version ?? 'unknown').slice(0, VERSION_MAX_LENGTH);
    const versionChanged = !!previous && previous.consent_version !== next.consent_version;

    const events: ConsentEventInput[] = [];
    for (const type of CONSENT_TYPES) {
        const before = previous?.[type] === true;
        const after = next[type] === true;
        let action: ConsentEventInput['action'] | null = null;
        if (!before && after) action = 'GRANT';
        else if (before && !after) action = 'WITHDRAW';
        else if (before && after && versionChanged) action = 'GRANT';
        if (action) {
            events.push({ candidateId, consentType: type, action, consentVersion: version, ...meta });
        }
    }
    return events;
}

/** Vrai si un des choix ou la version diffère entre les deux états. */
export function consentChanged(previous: ConsentSnapshot, next: ConsentSnapshot): boolean {
    if (!next) return false;
    if (!previous) return true;
    return (
        previous.consent_version !== next.consent_version ||
        CONSENT_TYPES.some((type) => (previous[type] === true) !== (next[type] === true))
    );
}

/**
 * Événements BACKFILL qui ramènent l'historique au niveau de la fiche MongoDB
 * (source de vérité du traitement) :
 * - aucun historique → reprise initiale, datée du `consent_date` de la fiche ;
 * - historique divergent (écriture MySQL échouée) → événements de correction,
 *   datés de `now` (date réelle inconnue).
 * Ne renvoie rien si l'historique est déjà cohérent (idempotent).
 */
export function reconcileEvents(
    candidateId: string,
    snapshot: ConsentSnapshot & { consent_date?: Date | string | null },
    latest: Map<ConsentType, ConsentAction> | undefined,
    now: Date,
): ConsentEventInput[] {
    if (!snapshot) return [];
    if (!latest) {
        const consentDate = snapshot.consent_date ? new Date(snapshot.consent_date) : null;
        const recordedAt = consentDate && !Number.isNaN(consentDate.getTime()) ? consentDate : now;
        return consentEvents(candidateId, undefined, snapshot, { source: 'BACKFILL', recordedBy: null, recordedAt });
    }
    const historyState: ConsentSnapshot = { consent_version: snapshot.consent_version };
    for (const type of CONSENT_TYPES) historyState[type] = latest.get(type) === 'GRANT';
    return consentEvents(candidateId, historyState, snapshot, {
        source: 'BACKFILL',
        recordedBy: null,
        recordedAt: now,
    });
}

export class ConsentHistoryService {
    private repository = new ConsentHistoryRepository();

    /** Écrit les événements ; ne fait rien s'il n'y en a pas. Les erreurs remontent à l'appelant. */
    async record(events: ConsentEventInput[]): Promise<void> {
        await this.repository.insertMany(events);
    }

    async findByCandidate(candidateId: string): Promise<ConsentHistoryEntry[]> {
        return this.repository.findByCandidate(candidateId);
    }

    async latestActions(candidateIds: string[]): Promise<Map<string, Map<ConsentType, ConsentAction>>> {
        return this.repository.latestActions(candidateIds);
    }
}
