export type Campus = 'Nord' | 'Ouest' | 'Sud'
export type ABStatut = 'brouillon' | 'envoyee' | 'validee' | 'signee' | 'archivee'
export type Domaine = 'Secretariat' | 'Vente'
export type JourDispo = 'Oui' | 'Non' | 'Préféré'

export const JOURS_SEMAINE = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'] as const
export type JourSemaine = typeof JOURS_SEMAINE[number]

export interface ABFormData {
  campus: Campus | ''
  // Étape 1 — Identité
  raison_sociale: string
  siret: string
  adresse_siege: string
  code_postal: string
  commune: string
  rl_nom: string
  rl_fonction: string
  rl_telephone: string
  rl_email: string
  rr_same_as_rl: boolean
  rr_nom: string
  rr_fonction: string
  rr_telephone: string
  rr_email: string
  // Étape 2 — Poste
  presentation_activite: string
  nb_postes: number | ''
  localisation_poste: string
  domaine: Domaine | ''
  intitule_poste: string
  missions: string[]
  autres_missions: string
  profils_recherches: string
  competences: string
  commentaires: string
  // Étape 3 — Apprenti
  niveau_formation: string
  permis: string
  experience: string
  age_exige: string
  methode_recrutement: string
  pmsmp: string
  jours_formation: Record<JourSemaine, JourDispo | ''>
}

export interface AB {
  id: number
  token: string
  entreprise_id: number
  sale_person_id: number | null
  campus: Campus
  statut: ABStatut
  raison_sociale: string | null
  siret: string | null
  intitule_poste: string | null
  domaine: Domaine | null
  expires_at: string | null
  created_at: string
  updated_at: string
}
