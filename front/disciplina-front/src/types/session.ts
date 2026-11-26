export const JOURS_COURS = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
] as const

export type JourCours = (typeof JOURS_COURS)[number]

export interface SessionPerson {
  firstName: string
  lastName: string
  mailAddress: string
}

export interface SessionAddress {
  housenumber: string
  street: string
  complement: string
  city: string
  postcode: string
  country: string
  formatted: string
}

export interface Session {
  id: string
  nom: string
  filiere: string | null
  jourCours: string | null
  dateDebut: string
  dateFin: string
  headTeacher: SessionPerson | null
  referentTeacher: SessionPerson | null
  realizationAddress: SessionAddress | null
  alternantCount: number
  createdAt: string | null
  updatedAt: string | null
}

export interface SessionDegree {
  id: string
  title: string
}

export interface CreateSessionInput {
  degreeId: string
  nom: string
  dateDebut: string
  dateFin: string
  subjectValidation: boolean
  generalEducationDuration?: string | null
  headTeacher?: SessionPerson | null
  referentTeacher?: SessionPerson | null
  realizationAddress?: Partial<Pick<SessionAddress, 'street' | 'complement' | 'city' | 'postcode' | 'country'>> | null
}
