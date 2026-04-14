export type EntrepriseStatus = 'Oui' | 'Non' | 'À Réfléchir'

export type UserId = 'brandon' | 'emile' | 'amanda' | 'lorenzo'

export interface Entreprise {
  id: string
  nom_commercial: string | null
  proprietaire_contact: string | null
  commercial: string | null
  proprietaire_id: UserId | null
  representant_legal: string | null
  telephone: string | null
  email: string | null
  adresse: string | null
  secteur: string | null
  metier: string | null
  siret: string | null
  idcc: string | null
  note: string | null
  conclusion: string | null
  status: EntrepriseStatus
  date_insertion: string
  date_relance: string
}

export type EntrepriseFilters = {
  siret: string
  status: EntrepriseStatus[]
  commercial: string
  secteur: string
  relance_today: boolean
  unassigned_only: boolean
  date_insertion_from: string
  date_insertion_to: string
}
