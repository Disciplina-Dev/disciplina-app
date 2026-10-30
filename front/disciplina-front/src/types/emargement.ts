/**
 * Types de l'émargement (espace pédagogique).
 *
 * Miroir des DTO renvoyés par `back/src/services/EmargementService.ts` : les
 * documents Mongo sont en snake_case côté back, l'API expose du camelCase.
 */

export const SEANCE_SITES = ['Nord', 'Ouest', 'Sud', 'Annemasse'] as const
export type SeanceSite = (typeof SEANCE_SITES)[number]

export const SEANCE_MODES = ['salle', 'distanciel'] as const
export type SeanceMode = (typeof SEANCE_MODES)[number]

export type EmargementHalf = 'morning' | 'afternoon'

export type EmargementStatus = 'na' | 'present' | 'absent' | 'late' | 'left_early'

export type SignatureMode = 'qr' | 'manual'

/** État d'une fenêtre de signature, calculé côté serveur. */
export type WindowState = 'upcoming' | 'open' | 'closed'

export interface AttendanceRecord {
  status: EmargementStatus
  /** Heure `HH:mm` pour `late` / `left_early`, sinon `null`. */
  statusTime: string | null
  /** Dernière saisie : QR de l'alternant ou saisie du formateur. */
  signatureMode: SignatureMode
  signedAt: string
  /** Première signature, jamais écrasée (preuve du passage par QR). */
  firstSignedAt: string
  firstSignatureMode: SignatureMode
}

export interface AlternantAttendance {
  id: string
  firstName: string
  lastName: string
  /** Présent uniquement côté Peda : la page formateur ne reçoit pas les e-mails. */
  email?: string | null
  attendance: {
    morning: AttendanceRecord | null
    afternoon: AttendanceRecord | null
  }
}

export interface SeanceWindow {
  start: string
  end: string
  state: WindowState
}

export interface Seance {
  id: string
  sessionId: string
  sessionNom: string
  /** Jour de la séance, `YYYY-MM-DD` (heure locale du tenant). */
  date: string
  startTime: string
  endTime: string
  site: SeanceSite
  mode: SeanceMode
  formateurName: string
  formateurEmail: string
  morningStart: string
  morningEnd: string
  afternoonStart: string | null
  afternoonEnd: string | null
  timezone: string
  inviteExpiresAt: string
  signed: boolean
  signedAt: string | null
  signedByName: string | null
  signatureImage: string | null
  createdAt: string
  updatedAt: string
  formateurUrl: string
  qrUrl: string
  /** Nombre d'alternants ayant au moins une demi-journée renseignée. */
  marked: number
  /** Nombre de présences (présent, en retard, parti en avance). */
  present: number
}

export interface SeanceDetail extends Seance {
  alternants: AlternantAttendance[]
}

export interface FormateurView {
  seance: {
    id: string
    sessionNom: string
    date: string
    startTime: string
    endTime: string
    site: SeanceSite
    mode: SeanceMode
    formateurName: string
    signed: boolean
    signedAt: string | null
    signedByName: string | null
    signatureImage: string | null
    qrUrl: string
  }
  alternants: AlternantAttendance[]
  serverNow: string
  openHalf: EmargementHalf | null
  windows: {
    morning: SeanceWindow
    afternoon: SeanceWindow | null
  }
  expired: boolean
  canEdit: boolean
}

export interface PublicSigning {
  sessionNom: string
  date: string
  startTime: string
  endTime: string
  site: SeanceSite
  mode: SeanceMode
  signed: boolean
  expired: boolean
  serverNow: string
  openHalf: EmargementHalf | null
  windows: {
    morning: SeanceWindow
    afternoon: SeanceWindow | null
  }
}

export interface CreateSeanceInput {
  sessionId: string
  date: string
  startTime: string
  endTime: string
  site: SeanceSite
  mode: SeanceMode
  formateurName: string
  formateurEmail: string
  morningStart: string
  morningEnd: string
  afternoonStart: string | null
  afternoonEnd: string | null
}

export interface SeanceLinks {
  formateurUrl: string
  qrUrl: string
}

export interface QrSignResult {
  fullName: string
  half: EmargementHalf
  signedAt: string
  alreadySigned: boolean
}
