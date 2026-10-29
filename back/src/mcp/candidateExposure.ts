import type { Candidate, CandidateStatus, TitleProfessionalType, TrainingSite } from '../types/candidate.types';
import { ConsentType, hasConsent } from '../services/consentGuard';
import { CandidateRepository } from '../repositories/mongo/CandidateRepository';

// Exposition d'un candidat à un client LLM tiers (RGPD, MCP_RGPD_AUDIT.md M1-M3) :
// - consentement `ai_processing` obligatoire, strict (pas de période de grâce « warn ») ;
// - LISTE BLANCHE : le DTO est déclaré champ par champ, jamais un spread du document Mongo
//   (un champ ajouté plus tard au modèle n'est donc pas exposé par défaut) ;
// - jamais exposés : n° de sécu (clé comprise), date/lieu de naissance (indicateur « mineur » seul),
//   adresse complète (commune seule), email, téléphone, situation avant contrat (France Travail,
//   Mission Locale), santé/handicap (Art. 9), contact d'urgence, textes libres, liens Drive/CV/PDF/photo,
//   identifiants Drive/Filiz, résultats et scores de tests (données d'évaluation, AI Act annexe III §4).

const MAJORITY_AGE = 18;

function isMinor(identity: Candidate['identity']): boolean | null {
    if (identity.date_of_birth) {
        const birth = new Date(identity.date_of_birth);
        const limit = new Date(birth);
        limit.setFullYear(limit.getFullYear() + MAJORITY_AGE);
        return limit.getTime() > Date.now();
    }
    return typeof identity.age === 'number' ? identity.age < MAJORITY_AGE : null;
}

export interface CandidateDto {
    id: string;
    candidateId: string;
    status: CandidateStatus;
    tpTypes: TitleProfessionalType[];
    trainingSites: TrainingSite[];
    createdAt: Date | null;
    identity: {
        label: string;
        minor: boolean | null;
        city: string | null;
        postalCode: string | null;
        drivingLicenseB: boolean | null;
        hasVehicle: boolean | null;
        transportMeans: string | null;
    };
    desiredSectors: string[];
    expectedCompanySkills: string[];
    schoolLevel: string | null;
    background: {
        lastDiploma: string | null;
        lastDiplomaPrepared: string | null;
        professionalExperiences: { position: string | null; duration: string | null; company: string | null }[];
    };
    profile: {
        frenchLevel: number | null;
        englishLevel: number | null;
        otherLanguages: string[];
        digitalSkills: string[];
    };
    jobInfo: {
        availabilityDate: Date | null;
        geographicMobility: unknown[];
        weekendWork: boolean | null;
    };
    synthesis: {
        feasibilityConclusion: string | null;
        pathwayRelevance: string | null;
        pedagogicalRecommendations: Record<string, boolean>;
    };
    immersion: {
        startDate: Date | null;
        endDate: Date | null;
        companyId: number | null;
        companyName: string | null;
    };
    contract: {
        offerId: string | null;
        companyId: number | null;
        companyName: string | null;
        startDate: Date | null;
        sessionId: string | null;
        sessionName: string | null;
    };
}

// `psh_specific_support` (handicap, Art. 9) est volontairement absent.
const RECOMMENDATION_KEYS = [
    'office_tools_reinforcement',
    'written_communication_support',
    'oral_confidence_development',
    'time_management_support',
    'professional_posture_work',
    'enhanced_company_immersion',
    'individual_follow_up',
    'language_training',
    'stress_management_follow_up',
] as const;

/** « Prénom N. » (comme les alternants) : premier mot + initiale du dernier ; jamais le nom complet. */
export function candidateLabel(fullName: string | null | undefined): string {
    const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) return parts[0] ?? '';
    return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

export function toCandidateDto(c: Candidate): CandidateDto {
    const recommendations = c.synthesis?.pedagogical_recommendations;
    return {
        id: String(c._id),
        candidateId: c.candidate_id,
        status: c.status,
        tpTypes: c.tp_types ?? [],
        trainingSites: c.training_sites ?? (c.training_site ? [c.training_site] : []),
        createdAt: c.created_at ?? null,
        identity: {
            label: candidateLabel(c.identity.full_name),
            minor: isMinor(c.identity),
            city: c.identity.city ?? null,
            postalCode: c.identity.postal_code ?? null,
            drivingLicenseB: c.identity.driving_license_b ?? null,
            hasVehicle: c.identity.has_vehicle ?? null,
            transportMeans: c.identity.transport_means ?? null,
        },
        desiredSectors: c.desired_sectors ?? [],
        expectedCompanySkills: c.expected_company_skills ?? [],
        schoolLevel: c.education?.school_level ?? null,
        background: {
            lastDiploma: c.background?.last_diploma ?? null,
            lastDiplomaPrepared: c.background?.last_diploma_prepared ?? null,
            professionalExperiences: (c.background?.professional_experiences ?? []).map((e) => ({
                position: e.position ?? null,
                duration: e.duration ?? null,
                company: e.company ?? null,
            })),
        },
        profile: {
            frenchLevel: c.profile?.french_level ?? null,
            englishLevel: c.profile?.english_level ?? null,
            otherLanguages: c.profile?.other_languages ?? [],
            digitalSkills: c.profile?.digital_skills ?? [],
        },
        jobInfo: {
            availabilityDate: c.job_info?.availability_date ?? null,
            geographicMobility: c.job_info?.geographic_mobility ?? [],
            weekendWork: c.job_info?.weekend_work ?? null,
        },
        synthesis: {
            feasibilityConclusion: c.synthesis?.feasibility_conclusion ?? null,
            pathwayRelevance: c.synthesis?.pathway_relevance ?? null,
            pedagogicalRecommendations: Object.fromEntries(
                RECOMMENDATION_KEYS.filter((k) => recommendations?.[k] !== undefined).map((k) => [
                    k,
                    !!recommendations?.[k],
                ]),
            ),
        },
        immersion: {
            startDate: c.immersion_start_date ?? null,
            endDate: c.immersion_end_date ?? null,
            companyId: c.immersion_company_id ?? null,
            companyName: c.immersion_company_name ?? null,
        },
        contract: {
            offerId: c.contract_offer_id ?? null,
            companyId: c.contract_company_id ?? null,
            companyName: c.contract_company_name ?? null,
            startDate: c.contract_start_date ?? null,
            sessionId: c.contract_session_id ?? null,
            sessionName: c.contract_session_name ?? null,
        },
    };
}

/** Candidat prêt pour MCP, ou null s'il n'a pas consenti au traitement par IA. */
export function exposeCandidate(candidate: Candidate | null): CandidateDto | null {
    if (!candidate || !hasConsent(candidate, [ConsentType.AI_PROCESSING])) return null;
    return toCandidateDto(candidate);
}

export function exposeCandidates(candidates: Candidate[]): CandidateDto[] {
    return candidates.flatMap((c) => exposeCandidate(c) ?? []);
}

const candidateRepository = new CandidateRepository();

// Clés d'offre qui portent des candidats (forme GraphQL et forme brute `matching.candidates`).
const OFFER_CANDIDATE_KEYS = new Set(['matchedCandidate', 'suggestedCandidates', 'proposedCandidate', 'candidates']);

function isCandidateEntry(value: unknown): value is { id: string } {
    return typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string';
}

function collectCandidateIds(node: unknown, ids: Set<string>): void {
    if (Array.isArray(node)) {
        node.forEach((n) => collectCandidateIds(n, ids));
    } else if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) {
            if (OFFER_CANDIDATE_KEYS.has(key) && Array.isArray(value)) {
                value.filter(isCandidateEntry).forEach((c) => ids.add(c.id));
            }
            collectCandidateIds(value, ids);
        }
    }
}

function dropUnconsented(node: unknown, consented: Set<string>): unknown {
    if (Array.isArray(node)) return node.map((n) => dropUnconsented(n, consented));
    if (node && typeof node === 'object') {
        const out: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(node)) {
            out[key] =
                OFFER_CANDIDATE_KEYS.has(key) && Array.isArray(value)
                    ? value
                          .filter((c) => !isCandidateEntry(c) || consented.has(c.id))
                          .map((c) => dropUnconsented(c, consented))
                    : dropUnconsented(value, consented);
        }
        return out;
    }
    return node;
}

/** Ids parmi `ids` dont le candidat a consenti au traitement par IA. */
export async function consentedIds(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const docs = await candidateRepository.findConsentmentsByIds(ids);
    return new Set(docs.filter((d) => hasConsent(d, [ConsentType.AI_PROCESSING])).map((d) => String(d._id)));
}

/** Retire des offres les candidats (matchés / suggérés / proposés) sans consentement `ai_processing`. */
export async function filterOfferCandidates<T>(data: T): Promise<T> {
    const ids = new Set<string>();
    collectCandidateIds(data, ids);
    if (ids.size === 0) return data;
    return dropUnconsented(data, await consentedIds([...ids])) as T;
}
