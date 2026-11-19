import { query } from '../../db/mysql/connection';
import { ConsentType } from '../../services/consentGuard';
import { ConsentAction, ConsentEventInput, ConsentHistoryEntry } from '../../types/consent.types';
import { ConsentHistoryRow } from '../../types/db-rows.types';

/**
 * Journal des consentements candidats (GDPR_INF_08.2). Ajout seul : ce
 * repository n'expose volontairement ni UPDATE ni DELETE, une ligne écrite
 * est une preuve (RGPD art. 7.1).
 *
 * Les dates passent par UNIX_TIMESTAMP / FROM_UNIXTIME pour ne pas dépendre
 * du fuseau de session MySQL (le pool est en `dateStrings`).
 */
export class ConsentHistoryRepository {
    async insertMany(events: ConsentEventInput[]): Promise<void> {
        if (events.length === 0) return;
        const placeholders = events.map(() => '(?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?))').join(', ');
        const params = events.flatMap((e) => [
            e.candidateId,
            e.consentType,
            e.action,
            e.consentVersion,
            e.source,
            e.recordedBy,
            (e.recordedAt.getTime() / 1000).toFixed(3),
        ]);
        await query(
            `INSERT INTO candidate_consent_history
                (candidate_id, consent_type, action, consent_version, source, recorded_by, recorded_at)
             VALUES ${placeholders}`,
            params,
        );
    }

    async findByCandidate(candidateId: string): Promise<ConsentHistoryEntry[]> {
        const rows = await query<ConsentHistoryRow[]>(
            `SELECT h.id, h.candidate_id, h.consent_type, h.action, h.consent_version, h.source,
                    h.recorded_by, NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), '') AS recorded_by_name,
                    UNIX_TIMESTAMP(h.recorded_at) AS recorded_at_epoch
             FROM candidate_consent_history h
             LEFT JOIN users u ON u.id = h.recorded_by
             WHERE h.candidate_id = ?
             ORDER BY h.recorded_at DESC, h.id DESC`,
            [candidateId],
        );
        return rows.map(toEntry);
    }

    /**
     * Dernière action connue par candidat et par type (la ligne d'id le plus élevé,
     * c.-à-d. la dernière écrite), pour réconcilier l'historique avec la fiche
     * MongoDB (src/cli/backfillConsentHistory.ts). Un candidat absent de la map
     * n'a aucun historique.
     */
    async latestActions(candidateIds: string[]): Promise<Map<string, Map<ConsentType, ConsentAction>>> {
        const result = new Map<string, Map<ConsentType, ConsentAction>>();
        if (candidateIds.length === 0) return result;
        const rows = await query<Array<{ candidate_id: string; consent_type: ConsentType; action: ConsentAction }>>(
            `SELECT h.candidate_id, h.consent_type, h.action
             FROM candidate_consent_history h
             JOIN (
                 SELECT MAX(id) AS max_id
                 FROM candidate_consent_history
                 WHERE candidate_id IN (${candidateIds.map(() => '?').join(', ')})
                 GROUP BY candidate_id, consent_type
             ) latest ON latest.max_id = h.id`,
            candidateIds,
        );
        for (const row of rows) {
            const byType = result.get(row.candidate_id) ?? new Map<ConsentType, ConsentAction>();
            byType.set(row.consent_type, row.action);
            result.set(row.candidate_id, byType);
        }
        return result;
    }
}

function toEntry(row: ConsentHistoryRow): ConsentHistoryEntry {
    return {
        id: Number(row.id),
        candidateId: row.candidate_id,
        consentType: row.consent_type as ConsentType,
        action: row.action,
        consentVersion: row.consent_version,
        source: row.source,
        recordedBy: row.recorded_by === null ? null : Number(row.recorded_by),
        recordedByName: row.recorded_by_name,
        recordedAt: new Date(Number(row.recorded_at_epoch) * 1000),
    };
}
