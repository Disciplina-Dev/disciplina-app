import { randomUUID } from 'crypto';
import { KpiModel } from './schemas/kpi.schema';
import { KPI_METRIC_COLUMNS } from '../../types/kpi.types';
import { RH_KPI_COLUMNS } from '../../types/rhKpi.types';

/**
 * Migration automatique des ex-tables MySQL commercial_kpi / rh_kpi vers la
 * collection Mongo `kpis` (#513).
 *
 * Appelée au boot du backend (après connexion des deux bases) et par le script
 * scripts/migrate-kpi-to-mongo.ts : l'accès SQL est injecté pour servir aux
 * deux contextes. Séquence par table : lecture → bulkWrite upsert ordonné →
 * vérification du compte importé → DROP (si dropAfter). En cas d'échec la
 * table est conservée et le retry repartira au prochain boot (upserts
 * idempotents) ; le démarrage n'est jamais interrompu.
 *
 * Le pool applicatif tourne avec dateStrings: true : les timestamps arrivent
 * en strings et sont reconverties en Dates ici (champ décoratif, les buckets
 * restent indexés par year/month/week explicites).
 */

type SqlValue = string | number | null | undefined;

/** Accès SQL minimal, injecté selon le contexte (pool app ou script autonome). */
export interface LegacyKpiSql {
    /** SELECT … renvoie les lignes ; DROP TABLE … passe par la même méthode. */
    all(sql: string, params?: SqlValue[]): Promise<Record<string, unknown>[]>;
}

export interface LegacyKpiResult {
    commercial: number;
    rh: number;
    dropped: string[];
}

type CommercialRow = {
    user_id: number | null;
    user_name: string | null;
    year: number;
    month: number;
    week: number;
    site: string;
    created_at: string | Date | null;
    updated_at: string | Date | null;
} & Record<string, unknown>;

type RhRow = {
    user_id: number;
    sector: string;
    year: number;
    month: number;
    week: number;
    created_at: string | Date | null;
    updated_at: string | Date | null;
} & Record<string, unknown>;

const CHUNK_SIZE = 500;

function toDate(value: string | Date | null | undefined): Date | undefined {
    if (value == null) return undefined;
    if (value instanceof Date) return value;
    // 'YYYY-MM-DD HH:MM:SS' → T pour un parsing Date fiable.
    const normalized = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T');
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

async function tableExists(sql: LegacyKpiSql, name: string): Promise<boolean> {
    const rows = await sql.all(
        'SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
        [name],
    );
    return Number(rows[0]?.count ?? 0) > 0;
}

async function dropTable(sql: LegacyKpiSql, name: string): Promise<void> {
    await sql.all(`DROP TABLE IF EXISTS \`${name}\``);
}

/**
 * Importe une table legacy puis (optionnellement) la drop. Renvoie false si
 * l'import doit être retenté plus tard (table conservée).
 */
async function migrateOne(
    sql: LegacyKpiSql,
    table: string,
    kind: 'commercial' | 'rh',
    buildDoc: (row: Record<string, unknown>) => { filter: Record<string, unknown>; set: Record<string, unknown> },
    dropAfter: boolean,
): Promise<{ imported: number; dropped: boolean }> {
    const rows = await sql.all(`SELECT * FROM \`${table}\``);
    let verified = 0;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const result = await KpiModel.bulkWrite(
            chunk.map((row) => {
                const { filter, set } = buildDoc(row);
                return {
                    updateOne: {
                        filter,
                        update: { $set: set, $setOnInsert: { _id: randomUUID() } },
                        upsert: true,
                    },
                };
            }),
            // timestamps:false : on préserve les created_at/updated_at d'origine.
            { ordered: true, timestamps: false },
        );
        verified += result.matchedCount + result.upsertedCount;
    }

    // Chaque ligne doit avoir trouvé son bucket (match ou insert) avant tout drop.
    if (verified !== rows.length) {
        throw new Error(`${table}: imported ${verified}/${rows.length} buckets, keeping table`);
    }

    if (!dropAfter) return { imported: rows.length, dropped: false };
    await dropTable(sql, table);
    return { imported: rows.length, dropped: true };
}

export async function migrateLegacyKpiTables(sql: LegacyKpiSql, opts?: { dropAfter?: boolean }): Promise<LegacyKpiResult> {
    const dropAfter = opts?.dropAfter ?? false;
    const result: LegacyKpiResult = { commercial: 0, rh: 0, dropped: [] };

    if (await tableExists(sql, 'commercial_kpi')) {
        const r = await migrateOne(sql, 'commercial_kpi', 'commercial', (row) => {
            const typed = row as CommercialRow;
            return {
                filter: {
                    kind: 'commercial',
                    user_id: typed.user_id,
                    year: typed.year,
                    month: typed.month,
                    week: typed.week,
                    site: typed.site,
                },
                set: {
                    kind: 'commercial',
                    user_id: typed.user_id,
                    user_name: typed.user_name,
                    year: typed.year,
                    month: typed.month,
                    week: typed.week,
                    site: typed.site,
                    metrics: Object.fromEntries(KPI_METRIC_COLUMNS.map((c) => [c, Number(typed[c]) || 0])),
                    created_at: toDate(typed.created_at),
                    updated_at: toDate(typed.updated_at),
                },
            };
        }, dropAfter);
        result.commercial = r.imported;
        if (r.dropped) result.dropped.push('commercial_kpi');
    }

    if (await tableExists(sql, 'rh_kpi')) {
        const r = await migrateOne(sql, 'rh_kpi', 'rh', (row) => {
            const typed = row as RhRow;
            return {
                filter: {
                    kind: 'rh',
                    user_id: typed.user_id,
                    sector: typed.sector,
                    year: typed.year,
                    month: typed.month,
                    week: typed.week,
                },
                set: {
                    kind: 'rh',
                    user_id: typed.user_id,
                    sector: typed.sector,
                    year: typed.year,
                    month: typed.month,
                    week: typed.week,
                    metrics: Object.fromEntries(RH_KPI_COLUMNS.map((c) => [c, Number(typed[c]) || 0])),
                    created_at: toDate(typed.created_at),
                    updated_at: toDate(typed.updated_at),
                },
            };
        }, dropAfter);
        result.rh = r.imported;
        if (r.dropped) result.dropped.push('rh_kpi');
    }

    return result;
}
