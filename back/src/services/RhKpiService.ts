import { RhKpiRepository } from '../repositories/mysql/RhKpiRepository';
import { RH_KPI_COLUMNS, RhKpiColumn, RhKpiMetrics, emptyRhMetrics } from '../types/rhKpi.types';
import { logger } from '../external/logger';

/** Bucket calendaire d'une date : année + mois (1-12) + semaine ISO (1-53). */
export interface DateBucket {
    year: number;
    month: number;
    week: number;
}

/** Numéro de semaine ISO 8601 d'une date (1-53). */
function isoWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    // Jeudi de la semaine courante détermine l'année/semaine ISO.
    const day = (d.getUTCDay() + 6) % 7; // lundi=0
    d.setUTCDate(d.getUTCDate() - day + 3);
    const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const firstDay = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
    return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

/** Découpe une date (locale serveur) en bucket année/mois/semaine. */
export function bucketOf(date: Date): DateBucket {
    return { year: date.getFullYear(), month: date.getMonth() + 1, week: isoWeek(date) };
}

// ── Structures de sortie agrégées ──────────────────────────────────────────
export interface RhKpiUserMetrics {
    userId: number;
    userName: string;
    /** Secteur (snapshot) auquel se rattachent ces compteurs ; '' = inconnu/global. */
    sector: string;
    metrics: RhKpiMetrics;
}
export interface RhKpiWeek {
    week: number;
    month: number;
    totals: RhKpiMetrics;
    users: RhKpiUserMetrics[];
}
export interface RhKpiReport {
    year: number;
    /** 'self' = uniquement le RH courant, 'all' = somme de tous les RH. */
    scope: 'self' | 'all';
    weeks: RhKpiWeek[];
}

function addInto(target: RhKpiMetrics, row: Record<RhKpiColumn, number>): void {
    for (const c of RH_KPI_COLUMNS) target[c] += Number(row[c]) || 0;
}

export class RhKpiService {
    private repo = new RhKpiRepository();

    /** Incrémente/décrémente des compteurs au bucket de `date`. Best-effort : ne jette jamais. */
    async bump(
        userId: number,
        sector: string | undefined,
        date: Date,
        deltas: Partial<Record<RhKpiColumn, number>>,
    ): Promise<void> {
        try {
            const { year, month, week } = bucketOf(date);
            await this.repo.bump(userId, sector ?? '', year, month, week, deltas);
        } catch (err) {
            logger.error({ err, userId, sector, deltas }, 'rh_kpi bump failed');
        }
    }

    async getAvailableYears(): Promise<number[]> {
        return this.repo.getAvailableYears();
    }

    /**
     * Rapport hebdomadaire d'une année. `scopeUserIds` undefined = tous les RH (somme),
     * sinon restreint à ces utilisateurs. Le front dérive mois/an par agrégation des semaines.
     */
    async getReport(year: number, scopeUserIds?: number[]): Promise<RhKpiReport> {
        const rows = await this.repo.findWeekly(year, scopeUserIds);
        const byWeek = new Map<number, RhKpiWeek>();
        for (const r of rows) {
            let wk = byWeek.get(r.week);
            if (!wk) {
                wk = { week: r.week, month: r.month, totals: emptyRhMetrics(), users: [] };
                byWeek.set(r.week, wk);
            }
            addInto(wk.totals, r);
            // Une entrée par (utilisateur × secteur) : le front agrège en général,
            // par secteur ou par RH/responsable selon le filtre choisi.
            wk.users.push({
                userId: r.user_id,
                userName: r.user_name,
                sector: r.sector ?? '',
                metrics: RH_KPI_COLUMNS.reduce((acc, c) => {
                    acc[c] = Number(r[c]) || 0;
                    return acc;
                }, emptyRhMetrics()),
            });
        }
        return {
            year,
            scope: scopeUserIds ? 'self' : 'all',
            weeks: [...byWeek.values()].sort((a, b) => a.week - b.week),
        };
    }
}
