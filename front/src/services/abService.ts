import type { ABFormState } from '../types/ab'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

function buildPayload(state: ABFormState) {
  return {
    raison_sociale:       state.raison_sociale,
    siret:                state.siret || undefined,
    adresse:              state.adresse || undefined,
    code_postal:          state.code_postal || undefined,
    commune:              state.commune || undefined,
    description_activite: state.description_activite || undefined,
    representant_legal:       state.representant_legal,
    responsable_recrutement:  state.meme_que_rl ? state.representant_legal : state.responsable_recrutement,
    commercial_id:        state.commercial_id,
    centre:               state.centre,
    domaine:              state.domaine || undefined,
    niveau:               state.niveau || undefined,
    intitule_metier:      state.intitule_metier || undefined,
    localisation_poste:   state.localisation_poste || undefined,
    nb_postes:            state.nb_postes,
    description_missions: state.description_missions || undefined,
    profil_recherche:     state.profil_recherche || undefined,
    competences:          state.competences || undefined,
    commentaires:         state.commentaires || undefined,
    missions_cochees:     state.missions_cochees.length ? state.missions_cochees : undefined,
    age_exige:            state.age_exige || undefined,
    permis:               state.permis || undefined,
    experience:           state.experience || undefined,
    methode_recrutement:  state.methode_recrutement || undefined,
    pmsmp:                state.pmsmp || undefined,
    jours_formation:      state.jours_formation,
    engagement_evolution:    state.engagement_evolution,
    engagement_adaptation:   state.engagement_adaptation,
    engagement_reajustement: state.engagement_reajustement,
    clause_confidentialite:  state.clause_confidentialite,
    lieu_signature:       state.lieu_signature || undefined,
    date_signature:       state.date_signature || undefined,
  }
}

// Valide le formulaire côté serveur (pas encore en DB)
export async function submitAB(state: ABFormState): Promise<void> {
  const res = await fetch(`${API_BASE}/api/ab/submit`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(buildPayload(state)),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erreur réseau' })) as { error?: string }
    throw new Error(err.error ?? 'Erreur lors de la soumission')
  }
}

// Envoie le payload complet à YouSign — la DB est alimentée après signature (webhook)
export async function sendToYousign(state: ABFormState): Promise<{ signature_request_id: string }> {
  const res = await fetch(`${API_BASE}/api/yousign/send`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(buildPayload(state)),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erreur réseau' })) as { error?: string }
    throw new Error(err.error ?? 'Erreur YouSign')
  }
  return res.json() as Promise<{ signature_request_id: string }>
}
