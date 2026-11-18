import { Candidate } from '../types/candidate.types';
import { decryptHealthIfNeeded, encryptHealthIfNeeded } from '../external/crypto/health-cipher';

// Champs chiffrés au repos (GDPR_INF_02.3) : santé / handicap + contact d'urgence.
// Écriture : chiffrés par CandidateService. Lecture (.lean(), sans getters Mongoose) : déchiffrés
// par candidateToGql et PdfService. Un champ encore en clair (avant backfill) passe tel quel.

/** Chiffre sur place les champs santé présents dans `data` (écritures partielles comprises). */
export function encryptCandidateHealth(data: Partial<Candidate>): void {
    const { identity, synthesis } = data;
    if (identity && 'psh_referral_request' in identity) {
        identity.psh_referral_request = encryptHealthIfNeeded(identity.psh_referral_request) as never;
    }
    if (synthesis) {
        if ('special_needs' in synthesis)
            synthesis.special_needs = encryptHealthIfNeeded(synthesis.special_needs) as never;
        const reco = synthesis.pedagogical_recommendations;
        if (reco && 'psh_specific_support' in reco) {
            reco.psh_specific_support = encryptHealthIfNeeded(reco.psh_specific_support) as never;
        }
    }
    if ('emergency_contact' in data) data.emergency_contact = encryptHealthIfNeeded(data.emergency_contact) as never;
}

/** Copie du candidat avec les champs santé en clair (n'altère pas l'objet reçu). */
export function decryptCandidateHealth(candidate: Candidate): Candidate {
    const out: Candidate = { ...candidate };
    if (out.identity && 'psh_referral_request' in out.identity) {
        out.identity = {
            ...out.identity,
            psh_referral_request: decryptHealthIfNeeded(out.identity.psh_referral_request),
        };
    }
    if (out.synthesis) {
        const synthesis = { ...out.synthesis };
        if ('special_needs' in synthesis) synthesis.special_needs = decryptHealthIfNeeded(synthesis.special_needs);
        const reco = synthesis.pedagogical_recommendations;
        if (reco && 'psh_specific_support' in reco) {
            synthesis.pedagogical_recommendations = {
                ...reco,
                psh_specific_support: decryptHealthIfNeeded(reco.psh_specific_support),
            };
        }
        out.synthesis = synthesis;
    }
    if ('emergency_contact' in out) out.emergency_contact = decryptHealthIfNeeded(out.emergency_contact);
    return out;
}
