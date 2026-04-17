export type EntrepriseStatus = 'Oui' | 'Non' | 'À Réfléchir'

const saleUserData = [
  { id: 1, name: 'Pas de commerciaux' },
  { id: 2, name: 'Amanda' },
  { id: 3, name: 'Emile' },
  { id: 4, name: 'Brandon' },
  { id: 5, name: 'Lorenzo' }
] as const;

export type UserId = typeof saleUserData[number]['name'];

export interface SalePerson {
  id: number
  email: string
  name: string
}

export interface Company {
  id: number
  salePersonID: number | null
  name: string | null
  phone: string | null
  email: string | null
  address: string | null
  sector: string | null
  mainActivity: string | null
  siret: string | null
  idcc: string | null
  ape: string | null
  notes: string | null
  conclusion: string | null
}

export interface CompanyInput {
  salePersonID: number | null
  name: string | null
  phone: string | null
  email: string | null
  address: string | null
  sector: string | null
  mainActivity: string | null
  siret: string | null
  idcc: string | null
  ape: string | null
  notes: string | null
  conclusion: string | null
}

export interface CompanyWithSalePerson {
  company: Company
  salePerson: SalePerson | null
}

export interface Entreprise {
  id: string
  nom_commercial: string | null
  proprietaire_contact: string | null
  commercial: string | null
  proprietaire_id: number | null
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
