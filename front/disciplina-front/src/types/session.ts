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

export interface Session {
  id: string
  nom: string
  filiere: string | null
  jourCours: string | null
  dateDebut: string
  dateFin: string
  alternantCount: number
  createdAt: string | null
  updatedAt: string | null
}

export interface CreateSessionInput {
  nom: string
  filiere?: string | null
  jourCours?: string | null
  dateDebut: string
  dateFin: string
}

export interface UpdateSessionInput {
  nom?: string
  filiere?: string | null
  jourCours?: string | null
  dateDebut?: string
  dateFin?: string
}
