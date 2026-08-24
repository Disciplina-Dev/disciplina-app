import { randomUUID } from 'crypto';
import { KpiModel } from '../../db/mongo/schemas/kpi.schema';
import { CommercialKpiDoc, sanitizeCommercialMetrics } from '../../types/kpiDoc.types';
import { KPI_METRIC_COLUMNS, KpiRow, KpiSite, KpiUpsertInput } from '../../types/kpi.types';

/** Filtre de bucket commercial ; user_id null = ligne orpheline (hors index unique partiel). */
function bucketFilter(data: {
    user_id?: number | null;
    year: number;
    month: number;
    week?: number;
    site: KpiSite;
}) {
    return {
        kind: 'commercial',
        user_id: data.user_id ?? null,
        year: data.year,
        month: data.month,
        week: data.week ?? 0,
        site: data.site,
    };
}

function docToRow(doc: CommercialKpiDoc): KpiRow {
    return {
        user_id: doc.user_id ?? null,
        user_name: doc.user_name ?? '',
        year: doc.year,
        month: doc.month,
        week: doc.week,
        site: doc.site,
        ...sanitizeCommercialMetrics(doc.metrics),
        created_at: doc.created_at,
        updated_at: doc.updated_at,
    };
}

function isDuplicateKey(err: unknown): boolean {
    return (err as { code?: number }).code === 11000;
}

export class KpiRepository {
    /** Lignes agrégées mensuelles uniquement (week = 0). */
    async findByYearAndSite(year: number, site: string): Promise<KpiRow[]> {
        const docs = await KpiModel.find({ kind: 'commercial', year, site, week: 0 })
            .sort({ user_name: 1, month: 1 })
            .lean<CommercialKpiDoc[]>();
        return docs.map(docToRow);
    }

    async findByYearMonthSite(year: number, month: number, site: string): Promise<KpiRow[]> {
        const docs = await KpiModel.find({ kind: 'commercial', year, month, site, week: 0 })
            .sort({ user_name: 1 })
            .lean<CommercialKpiDoc[]>();
        return docs.map(docToRow);
    }

    /** Lignes hebdomadaires uniquement (week > 0). */
    async findWeeklyByYearAndSite(year: number, site: string): Promise<KpiRow[]> {
        const docs = await KpiModel.find({ kind: 'commercial', year, site, week: { $gt: 0 } })
            .sort({ week: 1, user_name: 1 })
            .lean<CommercialKpiDoc[]>();
        return docs.map(docToRow);
    }

    /** Lignes mensuelles (week = 0) de tous les sites — vue globale. */
    async findMonthlyByYear(year: number): Promise<KpiRow[]> {
        const docs = await KpiModel.find({ kind: 'commercial', year, week: 0 })
            .sort({ site: 1, user_name: 1, month: 1 })
            .lean<CommercialKpiDoc[]>();
        return docs.map(docToRow);
    }

    /** Toutes les lignes (mensuelles + hebdo) d'un utilisateur pour une année, tous sites. */
    async findByYearAndUser(year: number, userId: number): Promise<KpiRow[]> {
        const docs = await KpiModel.find({ kind: 'commercial', year, user_id: userId })
            .sort({ site: 1, week: 1, month: 1 })
            .lean<CommercialKpiDoc[]>();
        return docs.map(docToRow);
    }

    /**
     * Remplace les compteurs du bucket (sémantique de l'ancien INSERT … ON DUPLICATE
     * KEY UPDATE : toutes les colonnes prennent la valeur fournie). Les compteurs
     * absents de l'input repassent à 0, comme en MySQL.
     */
    async upsert(data: KpiUpsertInput): Promise<void> {
        const metrics = Object.fromEntries(KPI_METRIC_COLUMNS.map((c) => [c, data[c] ?? 0]));
        try {
            await KpiModel.updateOne(
                bucketFilter(data),
                {
                    $set: {
                        kind: 'commercial',
                        user_id: data.user_id ?? null,
                        user_name: data.user_name ?? null,
                        year: data.year,
                        month: data.month,
                        week: data.week ?? 0,
                        site: data.site,
                        metrics,
                    },
                    $setOnInsert: { _id: randomUUID() },
                },
                { upsert: true },
            );
        } catch (err) {
            // Course entre deux writers sur le même bucket neuf : le doc existe
            // désormais, un seul retry suffit à retomber sur le chemin update.
            if (isDuplicateKey(err)) return this.upsert(data);
            throw err;
        }
    }

    /**
     * Ancien bulkUpsert MySQL passait par une transaction ; Mongo standalone ne
     * les supporte pas. bulkWrite ordonné = même ordre d'exécution, sans
     * rollback global (les imports étant idempotents, une ré-exécution rattrape
     * tout import partiel).
     */
    async bulkUpsert(rows: KpiUpsertInput[]): Promise<void> {
        if (rows.length === 0) return;
        try {
            await KpiModel.bulkWrite(
                rows.map((row) => ({
                    updateOne: {
                        filter: bucketFilter(row),
                        update: {
                            $set: {
                                kind: 'commercial',
                                user_id: row.user_id ?? null,
                                user_name: row.user_name ?? null,
                                year: row.year,
                                month: row.month,
                                week: row.week ?? 0,
                                site: row.site,
                                metrics: Object.fromEntries(KPI_METRIC_COLUMNS.map((c) => [c, row[c] ?? 0])),
                            },
                            $setOnInsert: { _id: randomUUID() },
                        },
                        upsert: true,
                    },
                })),
                { ordered: true },
            );
        } catch (err) {
            if (!isDuplicateKey(err)) throw err;
            // Fallback séquentiel voulu : re-jouer un à un (pas de Promise.all,
            // on veut l'ordre et le retry upsert par upsert après collision).
            // oxlint-disable-next-line no-await-in-loop
            for (const row of rows) await this.upsert(row);
        }
    }

    async getAvailableYears(): Promise<number[]> {
        const years = await KpiModel.distinct('year', { kind: 'commercial' });
        return years.map(Number).sort((a, b) => b - a);
    }
}
