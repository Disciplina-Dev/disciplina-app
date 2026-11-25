import { query } from '../../db/mysql/connection';

/**
 * Origine d'un créneau occupé (`calendar_slot_occupations.source`).
 * - `CALENDAR` : créneau « entretien » posé depuis l'agenda interne ;
 * - `PUBLIC_BOOKING` : rendez-vous réservé via la page publique `/booking/:slug` ;
 * - `EXTERNAL_INTERVIEW` : créneau d'entretien réservé par un candidat
 *   (`/external/interview/:signature`, `offers.matching.booked_interview_slot`).
 */
export type SlotOccupationSource = 'CALENDAR' | 'PUBLIC_BOOKING' | 'EXTERNAL_INTERVIEW';

export interface SlotOccupationInput {
    /** RH dont l'agenda porte l'entretien. */
    ownerUserId: number;
    /** Début ISO UTC. */
    start: string;
    /** Fin ISO UTC. */
    end: string;
    /** Libellé affiché dans l'agenda des collègues (« Entretien — Marie Dupont »). */
    label: string;
    source: SlotOccupationSource;
    /** Événement Google d'origine (posé depuis l'agenda ou par la page publique). */
    sourceEventId?: string | null;
}

export interface SlotOccupation {
    id: number;
    ownerUserId: number;
    ownerName: string | null;
    /** Début ISO UTC. */
    start: string;
    /** Fin ISO UTC. */
    end: string;
    label: string;
    source: SlotOccupationSource;
    sourceEventId: string | null;
}

interface SlotOccupationRow {
    id: number;
    owner_user_id: number;
    owner_name: string | null;
    /** Formaté en ISO UTC par `DATE_FORMAT` (la connexion est en `dateStrings: true`). */
    start_at: string;
    end_at: string;
    label: string;
    source: SlotOccupationSource;
    source_event_id: string | null;
}

/**
 * Les RH partagent-ils au moins un secteur avec `owner_user_id` ? Même source de
 * vérité que les blocages de dates (`user_sectors`) : un changement de secteur
 * fait suivre les blocages du nouveau secteur. `?` = utilisateur comparé.
 */
const SHARES_SECTOR = `EXISTS (
    SELECT 1
    FROM user_sectors mine
    JOIN user_sectors theirs ON theirs.sector_id = mine.sector_id
    WHERE mine.user_id = ? AND theirs.user_id = o.owner_user_id
)`;

const OCCUPATION_COLUMNS = `o.id, o.owner_user_id, o.label, o.source, o.source_event_id,
    CONCAT_WS(' ', u.first_name, u.last_name) AS owner_name,
    DATE_FORMAT(o.start_at, '%Y-%m-%dT%H:%i:%s.000Z') AS start_at,
    DATE_FORMAT(o.end_at, '%Y-%m-%dT%H:%i:%s.000Z') AS end_at`;

function toOccupation(row: SlotOccupationRow): SlotOccupation {
    return {
        id: row.id,
        ownerUserId: row.owner_user_id,
        ownerName: row.owner_name || null,
        start: row.start_at,
        end: row.end_at,
        label: row.label,
        source: row.source,
        sourceEventId: row.source_event_id,
    };
}

/** `YYYY-MM-DD HH:MM:SS` UTC attendu par MySQL pour un DATETIME (pas de conversion de fuseau). */
function toSqlUtc(iso: string): string {
    return new Date(iso).toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Créneaux occupés par un entretien (#1241). Un entretien posé sur l'agenda d'un
 * RH bloque le même créneau pour les RH partageant au moins un secteur avec lui.
 * Ces lignes ne remplacent pas l'agenda Google : elles ne portent que la
 * granularité « créneau » (les blocages de dates vivent dans
 * `calendar_day_blocks`).
 */
export class SlotOccupationRepository {
    /**
     * Créneaux visibles par `userId` : les siens (ex. entretien réservé côté
     * candidat, sans événement Google) et ceux des RH de ses secteurs.
     */
    async findVisible(userId: number, fromIso: string, toIso: string): Promise<SlotOccupation[]> {
        const rows = await query<SlotOccupationRow[]>(
            `SELECT ${OCCUPATION_COLUMNS}
             FROM calendar_slot_occupations o
             LEFT JOIN users u ON u.id = o.owner_user_id
             WHERE o.start_at < ? AND o.end_at > ?
               AND (o.owner_user_id = ? OR ${SHARES_SECTOR})
             ORDER BY o.start_at`,
            [toSqlUtc(toIso), toSqlUtc(fromIso), userId, userId],
        );
        return rows.map(toOccupation);
    }

    /**
     * Créneaux visibles par `userId` au format d'un agenda (`start`/`end` ISO) :
     * sert aux calculs de disponibilité (page de réservation, créneaux candidat).
     */
    async findVisibleBusy(userId: number, fromIso: string, toIso: string): Promise<{ start: string; end: string }[]> {
        const occupations = await this.findVisible(userId, fromIso, toIso);
        return occupations.map((occupation) => ({ start: occupation.start, end: occupation.end }));
    }

    /**
     * Créneaux des collègues (jamais les siens) qui chevauchent `[from, to]` :
     * sert à refuser de poser/supprimer un entretien sur un créneau déjà pris
     * par un RH du même secteur.
     */
    async findPeerOverlapping(userId: number, fromIso: string, toIso: string): Promise<SlotOccupation[]> {
        const rows = await query<SlotOccupationRow[]>(
            `SELECT ${OCCUPATION_COLUMNS}
             FROM calendar_slot_occupations o
             LEFT JOIN users u ON u.id = o.owner_user_id
             WHERE o.start_at < ? AND o.end_at > ?
               AND o.owner_user_id <> ?
               AND ${SHARES_SECTOR}
             ORDER BY o.start_at`,
            [toSqlUtc(toIso), toSqlUtc(fromIso), userId, userId],
        );
        return rows.map(toOccupation);
    }

    /**
     * Pose (ou met à jour) le créneau d'un entretien. `(owner_user_id, start_at)`
     * est unique : reposer le même créneau met à jour la ligne existante.
     */
    async upsert(input: SlotOccupationInput): Promise<void> {
        await query(
            `INSERT INTO calendar_slot_occupations (owner_user_id, start_at, end_at, label, source, source_event_id)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                 end_at = VALUES(end_at),
                 label = VALUES(label),
                 source = VALUES(source),
                 source_event_id = VALUES(source_event_id)`,
            [
                input.ownerUserId,
                toSqlUtc(input.start),
                toSqlUtc(input.end),
                input.label.slice(0, 255),
                input.source,
                input.sourceEventId ?? null,
            ],
        );
    }

    /**
     * Remplace le créneau d'un événement Google : son horaire a pu changer, et
     * `(owner, start)` étant la clé, l'ancienne ligne survivrait à l'upsert.
     */
    async replaceForEvent(input: SlotOccupationInput & { sourceEventId: string }): Promise<void> {
        await this.deleteForEvent(input.ownerUserId, input.sourceEventId);
        await this.upsert(input);
    }

    /** Retire le créneau d'un événement supprimé ou repassé en « autre » type. */
    async deleteForEvent(ownerUserId: number, sourceEventId: string): Promise<void> {
        await query('DELETE FROM calendar_slot_occupations WHERE owner_user_id = ? AND source_event_id = ?', [
            ownerUserId,
            sourceEventId,
        ]);
    }
}
