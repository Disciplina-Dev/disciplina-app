import { consentedIds } from './candidateExposure';
import { RUPTURE_MOTIFS } from '../types/rupture.types';
import type { Alternant } from '../types/alternant.types';

// Exposition des données pédagogiques à un client LLM tiers (RGPD, rgpd/registre-mcp.md) :
// - un alternant n'est visible que si sa fiche candidat d'origine (`candidate_id`) a
//   consenti à `ai_processing` (même règle stricte que `candidateExposure.ts`) ;
// - identité réduite à « Prénom N. » ; jamais d'email, téléphone, adresse, tuteur,
//   ni de détail libre de rupture ;
// - agrégats : tout effectif inférieur à PEDA_MIN_GROUP est masqué (anti ré-identification).

export const PEDA_MIN_GROUP = 5;
export const MIN_SEARCH_LENGTH = 3;

export type MaskedCount = number | '<5';

export function maskCount(n: number): MaskedCount {
    return n < PEDA_MIN_GROUP ? '<5' : n;
}

export function maskCounts<K extends string>(counts: Record<K, number>): Record<K, MaskedCount> {
    return Object.fromEntries(Object.entries<number>(counts).map(([k, v]) => [k, maskCount(v)])) as Record<
        K,
        MaskedCount
    >;
}

/** Alternants liés à un candidat ayant consenti au traitement par IA ; les autres sont écartés. */
export async function consentedAlternants(alternants: Alternant[]): Promise<Alternant[]> {
    const candidateIds = [...new Set(alternants.map((a) => a.candidate_id).filter((id): id is string => !!id))];
    const ok = await consentedIds(candidateIds);
    return alternants.filter((a) => !!a.candidate_id && ok.has(a.candidate_id));
}

/** « Prénom N. » : suffisant pour reconnaître un alternant sans exporter son identité complète. */
export function alternantLabel(a: Pick<Alternant, 'first_name' | 'last_name'>): string {
    const first = a.first_name.trim();
    const initial = a.last_name.trim().charAt(0).toUpperCase();
    return initial ? `${first} ${initial}.` : first;
}

const iso = (d: Date | string | null | undefined): string | null => (d ? new Date(d).toISOString() : null);

export interface AlternantDto {
    id: string;
    label: string;
    session: string;
    sessionId: string | null;
    archived: boolean;
    companyName: string | null;
    contractStart: string | null;
    contractEnd: string | null;
}

export function toAlternantDto(a: Alternant): AlternantDto {
    return {
        id: a._id,
        label: alternantLabel(a),
        session: a.session,
        sessionId: a.session_id ?? null,
        archived: !!a.archived_at,
        companyName: a.company?.name ?? null,
        contractStart: iso(a.company?.start_date),
        contractEnd: iso(a.company?.end_date),
    };
}

export type RuptureCategory = 'periode_essai' | 'commun_accord' | 'obtention_diplome' | 'autre';

// Les motifs « faute grave », « inaptitude » et « atteinte à la santé » (Art. 9 potentiel) sont
// fondus dans `autre` : la catégorie ne doit pas révéler une situation de santé ou disciplinaire.
const CATEGORY_BY_MOTIF_INDEX: RuptureCategory[] = [
    'periode_essai',
    'commun_accord',
    'autre',
    'autre',
    'obtention_diplome',
    'autre',
    'autre',
];

export function ruptureCategory(motif: string): RuptureCategory {
    const index = (RUPTURE_MOTIFS as readonly string[]).indexOf(motif);
    return CATEGORY_BY_MOTIF_INDEX[index] ?? 'autre';
}

export function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
