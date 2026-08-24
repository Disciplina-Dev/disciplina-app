import { query } from '../../db/mysql/connection';

export interface LiveStatusRow {
    sector: string;
    user_id: number | null;
    first_name: string | null;
    last_name: string | null;
    status: string;
    nb: number;
}

export interface LiveCallsRow {
    sector: string;
    user_id: number | null;
    first_name: string | null;
    last_name: string | null;
    nb: number;
}

/** Événement daté agrégé (changement de statut, création ou appel). */
export interface ActivityEventRow {
    user_id: number | null;
    first_name: string | null;
    last_name: string | null;
    month: number;
    week: number;
    status: string;
    nb: number;
}

/**
 * Vues SQL dérivées (portefeuille live + activité datée) : lisent companies,
 * contact_logs, company_history et users — pas la table KPI. Les buckets
 * commercial_kpi/rh_kpi ont migré vers MongoDB (voir repositories/mongo).
 */
export class KpiActivityRepository {
    /** Snapshot portefeuille : nombre d'entreprises par secteur / commercial / statut. */
    async liveStatusCounts(): Promise<LiveStatusRow[]> {
        return query<LiveStatusRow[]>(
            `SELECT c.sector, c.user_id, u.first_name, u.last_name, c.status, COUNT(*) AS nb
             FROM companies c
             LEFT JOIN users u ON u.id = c.user_id
             GROUP BY c.sector, c.user_id, u.first_name, u.last_name, c.status`,
        );
    }

    /** État actuel du portefeuille : statut courant de chaque entreprise, groupé par
     * secteur/commercial/statut. Contrairement à activityStatusChanges (compte les
     * transitions chaque fois), celui-ci ne compte chaque entreprise qu'une fois
     * avec son statut actuel. */
    async portfolioStatusCounts(sector: string): Promise<LiveStatusRow[]> {
        return query<LiveStatusRow[]>(
            `SELECT c.sector, c.user_id, u.first_name, u.last_name, c.status, COUNT(*) AS nb
             FROM companies c
             LEFT JOIN users u ON u.id = c.user_id
             WHERE c.sector = ?
             GROUP BY c.sector, c.user_id, u.first_name, u.last_name, c.status`,
            [sector],
        );
    }

    /** Snapshot portefeuille : appels loggés par secteur / commercial. */
    async liveCallCounts(): Promise<LiveCallsRow[]> {
        return query<LiveCallsRow[]>(
            `SELECT co.sector, l.user_id, u.first_name, u.last_name, COUNT(*) AS nb
             FROM contact_logs l
             JOIN companies co ON co.id = l.company_id
             LEFT JOIN users u ON u.id = l.user_id
             GROUP BY co.sector, l.user_id, u.first_name, u.last_name`,
        );
    }

    /**
     * Changements de statut datés (company_history), attribués au propriétaire
     * du portefeuille. WEEK(..., 3) = semaine ISO.
     */
    async activityStatusChanges(year: number, sector: string): Promise<ActivityEventRow[]> {
        return query<ActivityEventRow[]>(
            `SELECT c.user_id, u.first_name, u.last_name,
                    MONTH(h.updated_at) AS month, WEEK(h.updated_at, 3) AS week,
                    h.status, COUNT(*) AS nb
             FROM company_history h
             JOIN companies c ON c.id = h.company_id
             LEFT JOIN users u ON u.id = c.user_id
             WHERE YEAR(h.updated_at) = ? AND c.sector = ?
               AND (h.previous_status IS NULL OR h.previous_status <> h.status)
             GROUP BY c.user_id, u.first_name, u.last_name, MONTH(h.updated_at), WEEK(h.updated_at, 3), h.status`,
            [year, sector],
        );
    }

    /**
     * Créations d'entreprises datées : le statut initial est reconstitué depuis
     * le previous_status de la première ligne d'historique, sinon le statut actuel.
     */
    async activityCreations(year: number, sector: string): Promise<ActivityEventRow[]> {
        return query<ActivityEventRow[]>(
            `WITH first_hist AS (
                 SELECT company_id, previous_status,
                        ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY updated_at, id) AS rn
                 FROM company_history
             )
             SELECT c.user_id, u.first_name, u.last_name,
                    MONTH(c.created_at) AS month, WEEK(c.created_at, 3) AS week,
                    COALESCE(f.previous_status, c.status) AS status, COUNT(*) AS nb
             FROM companies c
             LEFT JOIN first_hist f ON f.company_id = c.id AND f.rn = 1
             LEFT JOIN users u ON u.id = c.user_id
             WHERE YEAR(c.created_at) = ? AND c.sector = ?
             GROUP BY c.user_id, u.first_name, u.last_name, MONTH(c.created_at), WEEK(c.created_at, 3), COALESCE(f.previous_status, c.status)`,
            [year, sector],
        );
    }

    /** Prises de contact datées (contact_logs), attribuées au propriétaire du portefeuille. */
    async activityCalls(year: number, sector: string): Promise<ActivityEventRow[]> {
        return query<ActivityEventRow[]>(
            `SELECT c.user_id, u.first_name, u.last_name,
                    MONTH(l.created_at) AS month, WEEK(l.created_at, 3) AS week,
                    'APPEL' AS status, COUNT(*) AS nb
             FROM contact_logs l
             JOIN companies c ON c.id = l.company_id
             LEFT JOIN users u ON u.id = c.user_id
             WHERE YEAR(l.created_at) = ? AND c.sector = ?
             GROUP BY c.user_id, u.first_name, u.last_name, MONTH(l.created_at), WEEK(l.created_at, 3)`,
            [year, sector],
        );
    }
}
