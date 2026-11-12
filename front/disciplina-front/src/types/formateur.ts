/**
 * Référentiel des formateurs du Peda. Une fiche est partagée par toutes les
 * séances ; les séances antérieures à l'annuaire restent rattachées par e-mail.
 */
import type { SeanceMode, SeanceSite, SeanceValidationStatus } from './emargement'

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

export interface FormateurAccount {
  /** Compte `users` lié, `null` tant que l'accès n'a pas été créé. */
  userId: number | null
}

export interface Formateur {
  id: string
  name: string
  email: string
  phone: string | null
  comment: string | null
  createdAt: string
  updatedAt: string
  account: FormateurAccount
  stats: FormateurStats
}

export type FormateurChangeField = 'name' | 'email' | 'phone' | 'comment'

export interface FormateurChange {
  field: FormateurChangeField
  from: string | null
  to: string | null
}

export type FormateurHistoryAction =
  | 'formateur_created'
  | 'formateur_updated'
  | 'note'
  | 'formateur_deleted'
  | 'account_created'
  | 'account_password_reset'
  | 'account_deleted'

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
  site: SeanceSite
  mode: SeanceMode
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

/**
 * Accueil de l'espace formateur (`GET /api/formateur/me`). La séance est celle
 * de l'annuaire, au même format que l'historique de la fiche Peda.
 */
export interface FormateurDashboard {
  formateur: { id: string; name: string; email: string }
  nextSeance: FormateurSeance | null
  upcomingSeanceCount: number
  pastSeanceCount: number
}
