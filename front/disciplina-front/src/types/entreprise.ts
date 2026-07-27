export type EntrepriseStatus = 'Oui' | 'Non' | 'À Réfléchir' | 'Relance' | 'Réponds pas' | 'Fermé'

export const STATUS_VALUES: EntrepriseStatus[] = ['Oui', 'Non', 'À Réfléchir', 'Relance', 'Réponds pas', 'Fermé']

export type Secteur = 'Nord-Est' | 'Ouest' | 'Sud'

export const SECTEUR_VALUES: Secteur[] = ['Nord-Est', 'Ouest', 'Sud']

export const DEFAULT_SECTEUR: Secteur = 'Nord-Est'
export type RelanceFilter = 'today' | 'past' | 'future'

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
  firstName: string
  lastName: string
}

export interface Company {
  id: number
  userID: number | null
  name: string | null
  phone: string | null
  email: string | null
  address: string | null
  sector: string | null
  mainActivity: string | null
  siret: string | null
  siren?: string | null
  idcc: string | null
  ape: string | null
  notes: string | null
  conclusion: string | null
  status: string | null
  relanceDate: string | null
  createdAt: string | null
  relanceType: number | null
  relanceTemplateId: string | null
  relanceChannel: string | null
}

export interface CompanyInput {
  userID: number | null
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
  status: string | null
  relanceDate: string | null
  relanceType: number | null
  relanceTemplateId: string | null
  relanceChannel: string | null
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
  siren?: string | null
  idcc: string | null
  note: string | null
  conclusion: string | null
  status: EntrepriseStatus
  date_insertion: string | null
  date_relance: string | null
  type_relance: number | null
  relance_template_id: string | null
  relance_channel: string | null
}

export interface SirenGroup {
  siren: string
  count: number
  entreprises: Entreprise[]
}

export interface EntrepriseBlacklistee extends Entreprise {
  all_blacklist: boolean
}

export type EntrepriseFilters = {
  siret: string
  status: EntrepriseStatus[]
  commercial_id: number | null
  secteur: string
  relance: RelanceFilter | ''
  unassigned_only: boolean
  date_insertion_from: string
  date_insertion_to: string
}
