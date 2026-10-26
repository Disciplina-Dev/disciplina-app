import type { Candidate, ClassMarkerResult } from '../types/candidate.types';
import { ConsentType, hasConsent } from '../services/consentGuard';
import { CandidateRepository } from '../repositories/mongo/CandidateRepository';
import { MASKED_SSN } from '../external/crypto/ssn-cipher';

// Exposition d'un candidat à un client LLM tiers (RGPD, MCP_RGPD_AUDIT.md M1-M3) :
// - consentement `ai_processing` obligatoire, strict (pas de période de grâce « warn ») ;
// - photo retirée sans `photo_processing` ;
// - jamais renvoyés : données de santé/handicap (Art. 9), contact d'urgence (tiers),
//   questions/réponses des tests ClassMarker ; n° de sécu toujours masqué.

function stripQuestions(result: ClassMarkerResult | undefined): ClassMarkerResult | undefined {
    if (!result) return result;
    // tab_switch_count (questionnaire interne) : indice de comportement, jamais transmis à un LLM.
    const { questions: _questions, tab_switch_count: _tabs, ...rest } = result;
    return rest;
}

/** Candidat prêt pour MCP, ou null s'il n'a pas consenti au traitement par IA. */
export function exposeCandidate(candidate: Candidate | null): Candidate | null {
    if (!candidate || !hasConsent(candidate, [ConsentType.AI_PROCESSING])) return null;

    const { emergency_contact: _emergency, classmarker, classmarker_history, ...rest } = candidate;
    const out: Candidate = { ...rest };

    if (rest.identity) {
        const { psh_referral_request: _psh, ...identity } = rest.identity;
        out.identity = identity as Candidate['identity'];
        if (identity.social_security_number) out.identity.social_security_number = MASKED_SSN as never;
    }
    if (rest.synthesis) {
        const { special_needs: _needs, pedagogical_recommendations, ...synthesis } = rest.synthesis;
        out.synthesis = { ...synthesis } as Candidate['synthesis'];
        if (pedagogical_recommendations) {
            const { psh_specific_support: _support, ...recommendations } = pedagogical_recommendations;
            out.synthesis = { ...out.synthesis, pedagogical_recommendations: recommendations };
        }
    }
    if (classmarker) out.classmarker = stripQuestions(classmarker);
    if (classmarker_history)
        out.classmarker_history = classmarker_history.map((r) => stripQuestions(r) as ClassMarkerResult);
    if (!hasConsent(candidate, [ConsentType.PHOTO_PROCESSING])) delete out.photo_link;

    return out;
}

export function exposeCandidates(candidates: Candidate[]): Candidate[] {
    return candidates.map(exposeCandidate).filter((c): c is Candidate => c !== null);
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
