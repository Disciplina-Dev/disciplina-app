import { KPI_METRIC_COLUMNS, KpiMetricColumn, KpiSite } from './kpi.types';
import { RH_KPI_COLUMNS, RhKpiColumn } from './rhKpi.types';

/** Discriminant de la collection `kpis` (fusion ex-commercial_kpi / rh_kpi). */
export type KpiKind = 'commercial' | 'rh';

export type CommercialKpiMetrics = Record<KpiMetricColumn, number>;
export type RhKpiMetrics = Record<RhKpiColumn, number>;

interface KpiBucketFields {
    _id: string;
    /** Null = ligne orpheline héritée d'un import Excel dont le user a été supprimé. */
    user_id: number | null;
    year: number;
    month: number;
    /** 0 = ligne mensuelle agrégée, 1-53 = semaine ISO. */
    week: number;
    created_at?: Date;
    updated_at?: Date;
}

export interface CommercialKpiDoc extends KpiBucketFields {
    kind: 'commercial';
    site: KpiSite;
    /**
     * Option A : snapshot d'affichage écrit à l'upsert, seule trace des users
     * supprimés (arbitrage conservé, cf. DATA_CLASSIFICATION.md §4.1).
     */
    user_name?: string;
    metrics: CommercialKpiMetrics;
}

export interface RhKpiDoc extends KpiBucketFields {
    kind: 'rh';
    sector: string;
    metrics: RhKpiMetrics;
}

export type KpiDoc = CommercialKpiDoc | RhKpiDoc;

export function isCommercialKpiDoc(doc: KpiDoc): doc is CommercialKpiDoc {
    return doc.kind === 'commercial';
}

export function isRhKpiDoc(doc: KpiDoc): doc is RhKpiDoc {
    return doc.kind === 'rh';
}

export function emptyCommercialMetrics(): CommercialKpiMetrics {
    return Object.fromEntries(KPI_METRIC_COLUMNS.map((c) => [c, 0])) as CommercialKpiMetrics;
}

export function emptyRhKpiMetrics(): RhKpiMetrics {
    return Object.fromEntries(RH_KPI_COLUMNS.map((c) => [c, 0])) as RhKpiMetrics;
}

/** Compteur stocké : entier ≥ 0 (les compteurs ne descendent jamais sous zéro). */
function asCount(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

/**
 * Coerce un sous-document metrics brut en compteurs commerciaux typés :
 * clés inconnues ignorées, valeurs non numériques ramenées à 0.
 */
export function sanitizeCommercialMetrics(raw: unknown): CommercialKpiMetrics {
    const src = (raw ?? {}) as Record<string, unknown>;
    return Object.fromEntries(KPI_METRIC_COLUMNS.map((c) => [c, asCount(src[c])])) as CommercialKpiMetrics;
}

/** Même contrat que sanitizeCommercialMetrics pour les compteurs RH. */
export function sanitizeRhKpiMetrics(raw: unknown): RhKpiMetrics {
    const src = (raw ?? {}) as Record<string, unknown>;
    return Object.fromEntries(RH_KPI_COLUMNS.map((c) => [c, asCount(src[c])])) as RhKpiMetrics;
}
