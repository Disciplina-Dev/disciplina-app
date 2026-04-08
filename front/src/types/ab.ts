export type Domaine  = 'secretariat' | 'vente'
export type Niveau   = 'bac' | 'bac2' | 'bac3'
export type Centre   = 'nord' | 'ouest' | 'sud'
export type JourKey  = 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi'
export type JourPref = 'prefere' | 'oui' | 'non'

export interface ContactForm {
  nom_prenom:  string
  fonction:    string
  telephone:   string
  email:       string
}

export interface JoursFormation {
  lundi:    JourPref
  mardi:    JourPref
  mercredi: JourPref
  jeudi:    JourPref
  vendredi: JourPref
}

export interface ABFormState {
  // Étape 1 — Identité entreprise
  siret:                string
  raison_sociale:       string
  adresse:              string
  code_postal:          string
  commune:              string
  description_activite: string
  representant_legal:   ContactForm
  responsable_recrutement: ContactForm
  meme_que_rl:          boolean

  // Étape 2 — Le poste
  domaine:              Domaine | ''
  niveau:               Niveau | ''
  intitule_metier:      string
  localisation_poste:   string
  nb_postes:            number
  description_missions: string
  profil_recherche:     string
  competences:          string
  commentaires:         string
  missions_cochees:     string[]

  // Étape 3 — L'apprenti
  age_exige:            string
  permis:               string
  experience:           string

  // Étape 4 — Recrutement
  methode_recrutement:  string
  pmsmp:                string
  jours_formation:      JoursFormation

  // Étape 5 — Signature
  engagement_evolution:    boolean
  engagement_adaptation:   boolean
  engagement_reajustement: boolean
  clause_confidentialite:  boolean
  lieu_signature:          string
  date_signature:          string

  // Meta
  centre:        Centre
  commercial_id: number
}

export const INITIAL_STATE: ABFormState = {
  siret: '', raison_sociale: '', adresse: '', code_postal: '', commune: '', description_activite: '',
  representant_legal:       { nom_prenom: '', fonction: '', telephone: '', email: '' },
  responsable_recrutement:  { nom_prenom: '', fonction: '', telephone: '', email: '' },
  meme_que_rl: false,
  domaine: '', niveau: '', intitule_metier: '', localisation_poste: '', nb_postes: 1,
  description_missions: '', profil_recherche: '', competences: '', commentaires: '',
  missions_cochees: [],
  age_exige: '', permis: '', experience: '',
  methode_recrutement: '', pmsmp: '',
  jours_formation: { lundi: 'non', mardi: 'non', mercredi: 'non', jeudi: 'non', vendredi: 'non' },
  engagement_evolution: false, engagement_adaptation: false, engagement_reajustement: false,
  clause_confidentialite: false, lieu_signature: '', date_signature: '',
  centre: 'nord', commercial_id: 1,
}
