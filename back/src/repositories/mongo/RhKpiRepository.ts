import { randomUUID } from 'crypto';
import { KpiModel } from '../../db/mongo/schemas/kpi.schema';
import { RhKpiColumn, RhKpiRow } from '../../types/rhKpi.types';
import { sanitizeRhKpiMetrics } from '../../types/kpiDoc.types';

function docToRow(doc: Record<string, unknown>): RhKpiRow {
    return {
        user_id: doc.user_id as number,
        sector: (doc.sector as string) ?? '',
        year: doc.year as number,
        month: doc.month as number,
        week: doc.week as number,
        ...sanitizeRhKpiMetrics(doc.metrics),
    };
}

function isDuplicateKey(err: unknown): boolean {
    return (err as { code?: number }).code === 11000;
}

export class RhKpiRepository {
    /**
     * Incrémente (ou décrémente) atomiquement des compteurs pour un bucket donné.
     * Crée le bucket au besoin. Les compteurs ne descendent jamais sous zéro :
     * le clamp $max remplace l'ancien GREATEST(0, col + VALUES(col)) MySQL.
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
        const clamped = Object.fromEntries(
            cols.map((c) => [
                c,
                { $max: [0, { $add: [{ $ifNull: [`$metrics.${c}`, 0] }, Number(deltas[c])] }] },
            ]),
        );
        try {
            await KpiModel.updateOne(
                { kind: 'rh', user_id: userId, sector, year, month, week },
                [
                    {
                        // Sur insert, Mongo amorce $$ROOT avec les égalités du
                        // filtre ; _id/created_at manquants sont créés ici.
                        $replaceWith: {
                            $mergeObjects: [
                                '$$ROOT',
                                {
                                    _id: { $ifNull: ['$_id', randomUUID()] },
                                    created_at: { $ifNull: ['$created_at', '$$NOW'] },
                                    updated_at: '$$NOW',
                                    metrics: { $mergeObjects: [{ $ifNull: ['$metrics', {}] }, clamped] },
                                },
                            ],
                        },
                    },
                ],
                { upsert: true, updatePipeline: true },
            );
        } catch (err) {
            // Course entre deux bumps sur un bucket neuf : un retry suffit,
            // le doc existe désormais et le chemin update s'applique.
            if (isDuplicateKey(err)) return this.bump(userId, sector, year, month, week, deltas);
            throw err;
        }
    }

    /** Tous les buckets hebdo d'une année, éventuellement restreints à certains RH.
     * Le nom d'affichage est résolu côté service (les users vivent en MySQL). */
    async findWeekly(year: number, userIds?: number[]): Promise<RhKpiRow[]> {
        const filter: Record<string, unknown> = { kind: 'rh', year };
        if (userIds) {
            if (userIds.length === 0) return [];
            filter.user_id = { $in: userIds };
        }
        const docs = await KpiModel.find(filter).sort({ week: 1 }).lean<Record<string, unknown>[]>();
        return docs.map(docToRow);
    }

    async getAvailableYears(): Promise<number[]> {
        const years = await KpiModel.distinct('year', { kind: 'rh' });
        return years.map(Number).sort((a, b) => b - a);
    }
}
