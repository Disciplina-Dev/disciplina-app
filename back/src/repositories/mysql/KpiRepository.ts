import { query, getConnection } from '../../db/mysql/connection';
import { KpiRow, KpiUpsertInput, KPI_METRIC_COLUMNS } from '../../types/kpi.types';

const UPSERT_SQL = `
    INSERT INTO commercial_kpi
        (user_id, user_name, year, month, week, site, ${KPI_METRIC_COLUMNS.join(', ')})
    VALUES (?, ?, ?, ?, ?, ?, ${KPI_METRIC_COLUMNS.map(() => '?').join(', ')})
    ON DUPLICATE KEY UPDATE
        user_id = VALUES(user_id),
        ${KPI_METRIC_COLUMNS.map((c) => `${c} = VALUES(${c})`).join(',\n        ')}
`;

function upsertParams(data: KpiUpsertInput): unknown[] {
    return [
        data.user_id ?? null,
        data.user_name,
        data.year,
        data.month,
        data.week ?? 0,
        data.site,
        ...KPI_METRIC_COLUMNS.map((c) => data[c] ?? 0),
    ];
}

export class KpiRepository {
    /** Monthly aggregate rows only (week = 0). */
    async findByYearAndSite(year: number, site: string): Promise<KpiRow[]> {
        return query<KpiRow[]>(
            'SELECT * FROM commercial_kpi WHERE year = ? AND site = ? AND week = 0 ORDER BY user_name, month',
            [year, site],
        );
    }

    async findByYearMonthSite(year: number, month: number, site: string): Promise<KpiRow[]> {
        return query<KpiRow[]>(
            'SELECT * FROM commercial_kpi WHERE year = ? AND month = ? AND site = ? AND week = 0 ORDER BY user_name',
            [year, month, site],
        );
    }

    /** Weekly rows only (week > 0). */
    async findWeeklyByYearAndSite(year: number, site: string): Promise<KpiRow[]> {
        return query<KpiRow[]>(
            'SELECT * FROM commercial_kpi WHERE year = ? AND site = ? AND week > 0 ORDER BY week, user_name',
            [year, site],
        );
    }

    async upsert(data: KpiUpsertInput): Promise<void> {
        await query(UPSERT_SQL, upsertParams(data));
    }

    async bulkUpsert(rows: KpiUpsertInput[]): Promise<void> {
        if (rows.length === 0) return;
        const conn = await getConnection();
        try {
            await conn.beginTransaction();
            for (const row of rows) {
                await conn.execute(UPSERT_SQL, upsertParams(row) as (string | number | null)[]);
            }
            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    async getAvailableYears(): Promise<number[]> {
        const rows = await query<{ year: number }[]>(
            'SELECT DISTINCT year FROM commercial_kpi ORDER BY year DESC',
        );
        return rows.map((r) => Number(r.year));
    }
}
