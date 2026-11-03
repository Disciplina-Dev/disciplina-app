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

/**
 * Origine de la signature d'une demi-journée :
 * - `qr` : l'alternant a signé sur son téléphone (QR de la séance) ;
 * - `manual` : le formateur a saisi le statut sans signature de l'alternant ;
 * - `handwritten` : l'alternant a tracé sa signature sur l'appareil du formateur.
 */
export type SignatureMode = 'qr' | 'manual' | 'handwritten'

/** État d'une fenêtre de signature, calculé côté serveur. */
export type WindowState = 'upcoming' | 'open' | 'closed'

/**
 * État de validation d'une feuille :
 * - `in_progress` : un créneau n'est pas encore fermé ;
 * - `to_validate` : créneaux fermés, le formateur peut encore signer ;
 * - `anomaly` : lien expiré (J+7) et demi-journée non signée ;
 * - `validated` : toutes les demi-journées sont validées.
 */
export type SeanceValidationStatus = 'in_progress' | 'to_validate' | 'anomaly' | 'validated'

/** `formateur` = signature du formateur ; `peda` = régularisation par le service pédagogique. */
export type SeanceValidationSource = 'formateur' | 'peda'

/** Auteur d'un événement du journal d'une feuille. */
export type EmargementHistorySource = 'peda' | 'formateur' | 'alternant' | 'system'

export type EmargementHistoryAction =
  | 'seance_created'
  | 'attendance_set'
  | 'attendance_signed'
  | 'qr_signed'
  | 'half_signed'
  | 'half_validated'

/** Événement du journal d'une séance (du plus récent au plus ancien côté API). */export interface EmargementHistoryEntry {
  id: string
  at: string
  action: EmargementHistoryAction
  alternantId: string | null
  alternantName: string | null
  half: EmargementHalf | null
  fromStatus: EmargementStatus | null
  toStatus: EmargementStatus | null
  fromStatusTime: string | null
  toStatusTime: string | null
  source: EmargementHistorySource
  actorName: string | null
  note: string | null
}

export interface SeanceValidation {
  signedAt: string
  signedByName: string
  source: SeanceValidationSource
  /** Tracé du formateur ; `null` quand la demi-journée est régularisée par le Peda. */
  signatureImage: string | null
}

export interface AttendanceRecord {
  status: EmargementStatus
  /** Heure `HH:mm` pour `late` / `left_early`, sinon `null`. */
  statusTime: string | null
  /** Dernière saisie : QR de l'alternant, saisie ou signature manuscrite du formateur. */
  signatureMode: SignatureMode
  /** Signature manuscrite de l'alternant (data-URL PNG) — mode `handwritten` uniquement. */
  signatureImage: string | null
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
  /** Financeur de la formation (OPCO, Région…) — affiché sur la feuille. */
  financeur?: string | null
  /** Situation vis-à-vis de la formation (archivage / rupture) au moment de la séance. */
  presence: AlternantPresence
  attendance: {
    morning: AttendanceRecord | null
    afternoon: AttendanceRecord | null
  }
}

/**
 * Situation d'un alternant vis-à-vis de sa session : une sortie (archivage) ou
 * une rupture qui n'archive pas (le jeune poursuit sa formation).
 */
export interface AlternantPresence {
  /** `true` = sorti de la formation, plus attendu sur les séances suivantes. */
  archived: boolean
  /** `rupture` = sortie par rupture, `fin_formation` = fin normale, `null` = actif. */
  archiveReason: AlternantArchiveReason | null
  /** Date d'effet de la sortie (`YYYY-MM-DD`), `null` quand l'alternant est actif. */
  archiveDate: string | null
  /** Dernière rupture déclarée, même quand le jeune poursuit sa formation. */
  ruptureDate: string | null
  /** La dernière rupture déclarée indique que le jeune poursuit sa formation. */
  poursuitFormation: boolean
}

export type AlternantArchiveReason = 'rupture' | 'fin_formation'

/**
 * Avancement de la saisie d'une feuille : les manques ne sont comptés que sur
 * les créneaux déjà fermés (« non renseigné » n'est pas une absence).
 */
export interface SeanceAttendanceProgress {
  expected: number
  morning: { expected: number; recorded: number }
  afternoon: { expected: number; recorded: number }
  /** Statuts manquants sur des demi-journées fermées. */
  missing: number
  missingHalves: EmargementHalf[]
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
  /** Titre professionnel préparé (snapshot de la filière Filiz). */
  degreeTitle: string | null
  /** Module ou séquence traités pendant la séance. */
  module: string | null
  /** Lieu précis : salle, adresse ou lien visio. */
  location: string | null
  /** Jour de la séance, `YYYY-MM-DD` (heure locale du tenant). */
  date: string
  /** Début des cours (dérivé : `morningClassStart`). */
  startTime: string
  /** Fin des cours (dérivée : `afternoonClassEnd`, sinon `morningClassEnd`). */
  endTime: string
  /** Horaires de cours du matin (`null` sur les séances antérieures au lot 8). */
  morningClassStart: string | null
  morningClassEnd: string | null
  /** Horaires de cours de l'après-midi ; `null` = séance sans après-midi. */
  afternoonClassStart: string | null
  afternoonClassEnd: string | null
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
  /** Validation par demi-journée (signature du formateur ou régularisation Peda). */
  validations: {
    morning: SeanceValidation | null
    afternoon: SeanceValidation | null
  }
  validationStatus: SeanceValidationStatus
  /** `peda` dès qu'une demi-journée a été régularisée par le service pédagogique. */
  validationSource: SeanceValidationSource | null
  validatedBy: number | null
  validationNote: string | null
  /** `true` quand le Peda peut valider lui-même (créneaux fermés, validation incomplète). */
  canValidateByPeda: boolean
  createdAt: string
  updatedAt: string
  formateurUrl: string
  qrUrl: string
  /** Nombre d'alternants ayant au moins une demi-journée renseignée. */
  marked: number
  /** Nombre de présences (présent, en retard, parti en avance). */
  present: number
  /** Avancement de la saisie : statuts manquants sur les créneaux fermés. */
  attendanceProgress: SeanceAttendanceProgress
}

export interface SeanceDetail extends Seance {
  alternants: AlternantAttendance[]
  /** Journal des changements (statuts, signatures, validations), du plus récent au plus ancien. */
  history: EmargementHistoryEntry[]
}

export interface FormateurView {
  seance: {
    id: string
    sessionNom: string
    degreeTitle: string | null
    module: string | null
    location: string | null
    date: string
    startTime: string
    endTime: string
    /** Horaires de cours (`null` sur les séances antérieures au lot 8). */
    morningClassStart: string | null
    morningClassEnd: string | null
    afternoonClassStart: string | null
    afternoonClassEnd: string | null
    site: SeanceSite
    mode: SeanceMode
    formateurName: string
    validations: {
      morning: SeanceValidation | null
      afternoon: SeanceValidation | null
    }
    validationStatus: SeanceValidationStatus
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
  /** `true` tant qu'au moins une demi-journée reste éditable. */
  canEdit: boolean
  /** Demi-journées encore modifiables (statuts, signature manuscrite). */
  editableHalves: EmargementHalf[]
  /** Demi-journées signables : créneau fermé, non validées, lien valide. */
  signableHalves: EmargementHalf[]
}

export interface PublicSigning {
  sessionNom: string
  degreeTitle: string | null
  module: string | null
  location: string | null
  date: string
  startTime: string
  endTime: string
  /** Horaires de cours (`null` sur les séances antérieures au lot 8). */
  morningClassStart: string | null
  morningClassEnd: string | null
  afternoonClassStart: string | null
  afternoonClassEnd: string | null
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
  site: SeanceSite
  mode: SeanceMode
  formateurName: string
  formateurEmail: string
  /** Horaires de cours, base des heures prévues / réalisées (pause déjeuner exclue). */
  morningClassStart: string
  morningClassEnd: string
  afternoonClassStart: string | null
  afternoonClassEnd: string | null
  /** Créneaux de signature, bornés à la demi-journée de cours correspondante. */
  morningStart: string
  morningEnd: string
  afternoonStart: string | null
  afternoonEnd: string | null
  /** Module / séquence (facultatif). */
  module?: string | null
  /** Lieu précis : salle, adresse, lien visio (facultatif). */
  location?: string | null
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

/**
 * Charte d'impression des documents d'émargement (§8.4) : choisie au moment de
 * l'export, elle ne change que l'habillage (couleur, bandeau, mentions légales).
 */
export const EMARGEMENT_PDF_THEMES = ['disciplina', 'region', 'fse'] as const
export type EmargementPdfTheme = (typeof EMARGEMENT_PDF_THEMES)[number]

export const PDF_THEME_LABELS: Record<EmargementPdfTheme, string> = {
  disciplina: 'Disciplina',
  region: 'Région Réunion',
  fse: 'FSE+',
}

/** Filtres communs aux exports de période (séance, session, dates). */
export interface EmargementExportFilter {
  seanceId?: string
  sessionId?: string
  /** `YYYY-MM-DD`, borne basse incluse. */
  from?: string
  /** `YYYY-MM-DD`, borne haute incluse. */
  to?: string
  /**
   * Inclut les alternants archivés même sortis avant la séance (export
   * historique). Par défaut, un sorti ne figure que sur les séances où il était
   * encore présent.
   */
  includeArchived?: boolean
}

export type EmargementExportFormat = 'csv' | 'xlsx'

// ── Assiduité (7.1 / 7.2) ────────────────────────────────────────────────────

/** Compteurs d'heures communs aux lignes et aux totaux du tableau de bord. */
export interface AssiduiteTotals {
  alternants: number
  seances: number
  /** Demi-journées réellement saisies (statut ≠ « non renseigné »). */
  halves: number
  /** Demi-journées fermées sans statut saisi : le taux peut être sous-évalué. */
  missingHalves: number
  absences: number
  plannedMinutes: number
  attendedMinutes: number
  /** `attended / planned` entre 0 et 1 ; `null` quand aucune heure n'est prévue. */
  rate: number | null
}

/** Une ligne du tableau de bord : un alternant, une session ou un site. */
export interface AssiduiteRow extends AssiduiteTotals {
  key: string
  label: string
}

export interface AssiduiteAlternantRow extends AssiduiteRow {
  alternantId: string
  firstName: string
  lastName: string
  financeur: string | null
  /** Nombre de sessions distinctes fréquentées sur la période. */
  sessions: number
  lastSeanceDate: string | null
  presence: AlternantPresence
}

export interface Assiduite {
  generatedAt: string
  from: string | null
  to: string | null
  sessionId: string | null
  site: SeanceSite | null
  totals: AssiduiteTotals
  alternants: AssiduiteAlternantRow[]
  sessions: AssiduiteRow[]
  sites: AssiduiteRow[]
}

/** Détail d'une séance dans une attestation / fiche d'assiduité. */
export interface AssiduiteSeance {
  seanceId: string
  date: string
  startTime: string
  endTime: string
  module: string | null
  validationStatus: SeanceValidationStatus
  plannedMinutes: number
  attendedMinutes: number
  halves: {
    half: EmargementHalf
    status: EmargementStatus
    statusTime: string | null
    plannedMinutes: number
    attendedMinutes: number
    /** Créneau fermé sans statut saisi. */
    missing: boolean
    validation: SeanceValidation | null
  }[]
}

/** Assiduité d'un alternant : synthèse + détail séance par séance. */
export interface AssiduiteAlternant {
  generatedAt: string
  alternantId: string
  firstName: string
  lastName: string
  financeur: string | null
  sessionNom: string
  degreeTitle: string | null
  presence: AlternantPresence
  from: string | null
  to: string | null
  totals: AssiduiteTotals
  seances: AssiduiteSeance[]
}
