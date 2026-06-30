import { query } from '../../db/mysql/connection';
import { RH_KPI_COLUMNS, RhKpiColumn, RhKpiRow } from '../../types/rhKpi.types';

/** Ligne hebdomadaire enrichie du nom de l'utilisateur (pour les vues agrégées). */
export interface RhKpiWeeklyRow extends RhKpiRow {
    user_name: string;
}

export class RhKpiRepository {
    /**
     * Incrémente (ou décrémente) atomiquement des compteurs pour un bucket donné.
     * Crée la ligne au besoin. Les compteurs ne descendent jamais sous zéro.
     */
    async bump(
        userId: number,
        sector: string,
        year: number,
        month: number,
        week: number,
        deltas: Partial<Record<RhKpiColumn, number>>,
    ): Promise<void> {
        const cols = Object.keys(deltas) as RhKpiColumn[];
        if (cols.length === 0) return;
        // Liste complète des colonnes pour l'INSERT (delta fourni, sinon 0).
        const insertVals = RH_KPI_COLUMNS.map((c) => deltas[c] ?? 0);
        const updateSet = cols.map((c) => `${c} = GREATEST(0, ${c} + VALUES(${c}))`).join(', ');
        await query(
            `INSERT INTO rh_kpi (user_id, sector, year, month, week, ${RH_KPI_COLUMNS.join(', ')})
             VALUES (?, ?, ?, ?, ?, ${RH_KPI_COLUMNS.map(() => '?').join(', ')})
             ON DUPLICATE KEY UPDATE ${updateSet}`,
            [userId, sector, year, month, week, ...insertVals],
        );
    }

    /** Toutes les lignes hebdomadaires d'une année, éventuellement restreintes à certains RH. */
    async findWeekly(year: number, userIds?: number[]): Promise<RhKpiWeeklyRow[]> {
        const params: unknown[] = [year];
        let scope = '';
        if (userIds) {
            if (userIds.length === 0) return [];
            scope = ` AND k.user_id IN (${userIds.map(() => '?').join(', ')})`;
            params.push(...userIds);
        }
        return query<RhKpiWeeklyRow[]>(
            `SELECT k.*, CONCAT(u.first_name, ' ', u.last_name) AS user_name
             FROM rh_kpi k
             JOIN users u ON u.id = k.user_id
             WHERE k.year = ?${scope}
             ORDER BY k.week, u.first_name, u.last_name`,
            params,
        );
    }

    async getAvailableYears(): Promise<number[]> {
        const rows = await query<{ year: number }[]>('SELECT DISTINCT year FROM rh_kpi ORDER BY year DESC');
        return rows.map((r) => Number(r.year));
    }
}
