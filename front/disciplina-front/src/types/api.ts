// Mirrors backend types — ENUM values are ASCII (no accents)
export type CompanyStatus = 'prospect' | 'contacte' | 'ok' | 'indecis' | 'non' | 'partenaire'
export type CallResult    = 'ok' | 'indecis' | 'non'
export type RelanceStatut = 'planifiee' | 'faite' | 'annulee'
export type Source =
  | 'pages_jaunes' | 'linkedin' | 'indeed' | 'facebook'
  | 'listing_lorenzo' | 'france_travail' | 'recommandation' | 'autre'

export interface Entreprise {
  id:                   number
  raison_sociale:       string
  siret:                string | null
  adresse:              string | null
  code_postal:          string | null
  commune:              string | null
  description_activite: string | null
  telephone:            string | null
  email:                string | null
  site:                 string | null
  statut:               CompanyStatus
  source:               Source | null
  commercial_id:        number | null
  commercial_nom:       string | null
  secteur:              string | null
  relances_count:       number
  created_at:           string
  updated_at:           string
}

export interface Contact {
  id:           number
  entreprise_id:number
  nom_prenom:   string
  fonction:     string | null
  telephone:    string | null
  email:        string | null
  type:         'representant_legal' | 'responsable_recrutement'
  created_at:   string
}

export interface CallLog {
  id:            number
  entreprise_id: number
  result:        CallResult
  notes:         string | null
  commercial_id: number | null
  commercial_nom:string | null
  called_at:     string
}

export interface Relance {
  id:               number
  entreprise_id:    number
  raison_sociale?:  string
  statut_entreprise?: CompanyStatus
  secteur?:         string
  telephone?:       string
  scheduled_date:   string
  notes:            string | null
  statut:           RelanceStatut
  commercial_id:    number | null
  commercial_nom:   string | null
  created_at:       string
}

export interface EntrepriseDetail extends Entreprise {
  contacts:  Contact[]
  calls:     CallLog[]
  relances:  Relance[]
  last_call: CallLog | null
}

// Request bodies
export interface CreateEntrepriseBody {
  raison_sociale:       string
  siret?:               string
  adresse?:             string
  code_postal?:         string
  commune?:             string
  telephone?:           string
  email?:               string
  site?:                string
  secteur?:             string
  source?:              Source
  commercial_id?:       number
}
