/**
 * Référentiel des formateurs du Peda. Une fiche est partagée par toutes les
 * séances ; les séances antérieures à l'annuaire restent rattachées par e-mail.
 */
import type { SeanceValidationStatus } from './emargement'

export interface FormateurSessionStat {
  id: string
  nom: string
  degreeTitle: string | null
  seanceCount: number
  plannedMinutes: number
}

export interface FormateurStats {
  seanceCount: number
  /** Heures de cours planifiées (pause déjeuner exclue). */
  plannedMinutes: number
  sessionCount: number
  firstSeanceDate: string | null
  lastSeanceDate: string | null
  sessions: FormateurSessionStat[]
}

export interface Formateur {
  id: string
  name: string
  email: string
  phone: string | null
  comment: string | null
  createdAt: string
  updatedAt: string
  stats: FormateurStats
}

export type FormateurChangeField = 'name' | 'email' | 'phone' | 'comment'

export interface FormateurChange {
  field: FormateurChangeField
  from: string | null
  to: string | null
}

export type FormateurHistoryAction = 'formateur_created' | 'formateur_updated' | 'note'

export interface FormateurHistoryEntry {
  id: string
  at: string
  action: FormateurHistoryAction
  changes: FormateurChange[]
  note: string | null
  actorName: string | null
}

export interface FormateurSeance {
  id: string
  date: string
  startTime: string
  endTime: string
  sessionId: string
  sessionNom: string
  degreeTitle: string | null
  module: string | null
  location: string | null
  site: string
  mode: string
  plannedMinutes: number
  validationStatus: SeanceValidationStatus
}

export interface FormateurDetail extends Formateur {
  seances: FormateurSeance[]
  history: FormateurHistoryEntry[]
}

export interface FormateurInput {
  name: string
  email: string
  phone: string | null
  comment: string | null
}
