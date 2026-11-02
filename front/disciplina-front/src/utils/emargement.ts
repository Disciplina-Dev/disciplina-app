import type { BadgeTone } from '@/components/ui/Badge'
import type {
  EmargementHalf,
  EmargementHistoryAction,
  EmargementHistoryEntry,
  EmargementStatus,
  Seance,
  SeanceMode,
  SeanceSite,
  SeanceValidationSource,
  SeanceValidationStatus,
  SignatureMode,
  WindowState,
} from '@/types/emargement'

/** Libellés et tons partagés par les pages émargement (Peda, formateur, QR). */

export const HALF_LABELS: Record<EmargementHalf, string> = {
  morning: 'Matin',
  afternoon: 'Après-midi',
}

export const STATUS_LABELS: Record<EmargementStatus, string> = {
  na: 'Non renseigné',
  present: 'Présent',
  absent: 'Absent',
  late: 'En retard',
  left_early: 'Parti en avance',
}

export const STATUS_TONES: Record<EmargementStatus, BadgeTone> = {
  na: 'neutral',
  present: 'success',
  absent: 'danger',
  late: 'warning',
  left_early: 'warning',
}

export const SITE_LABELS: Record<SeanceSite, string> = {
  Nord: 'Nord',
  Ouest: 'Ouest',
  Sud: 'Sud',
  Annemasse: 'Annemasse',
}

export const MODE_LABELS: Record<SeanceMode, string> = {
  salle: 'En salle',
  distanciel: 'Distanciel',
}

export const WINDOW_LABELS: Record<WindowState, string> = {
  upcoming: 'À venir',
  open: 'Ouverte',
  closed: 'Fermée',
}

export const WINDOW_TONES: Record<WindowState, BadgeTone> = {
  upcoming: 'neutral',
  open: 'success',
  closed: 'neutral',
}

/** État de validation d'une feuille, tel qu'affiché dans les listes et le détail. */
export const VALIDATION_LABELS: Record<SeanceValidationStatus, string> = {
  in_progress: 'En cours',
  to_validate: 'À valider',
  anomaly: 'Anomalie',
  validated: 'Validée',
}

export const VALIDATION_TONES: Record<SeanceValidationStatus, BadgeTone> = {
  in_progress: 'accent',
  to_validate: 'warning',
  anomaly: 'danger',
  validated: 'success',
}

/** « Signée par le formateur » / « Validée par le service pédagogique ». */
export function validationSourceLabel(source: SeanceValidationSource | null): string {
  if (source === 'peda') return 'Validée par le service pédagogique'
  if (source === 'formateur') return 'Signée par le formateur'
  return 'Non validée'
}

/** Signature d'une demi-journée : le statut prime, le mode de saisie complète. */
export function signatureLabel(mode: SignatureMode): string {
  if (mode === 'qr') return 'QR alternant'
  if (mode === 'handwritten') return 'Signature manuscrite de l’alternant'
  return 'Saisie formateur'
}

/** `2026-10-28` → « mercredi 28 octobre 2026 » (midi local, jamais de décalage). */
export function formatSeanceDate(date: string | null | undefined): string {
  if (!date) return '—'
  const parsed = new Date(`${date}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Horodatage ISO serveur → « 28/10/2026 à 09:12 » dans le fuseau du navigateur. */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—'
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Résumé « matin · après-midi » des créneaux d'une séance. */
export function windowsSummary(seance: Pick<Seance, 'morningStart' | 'morningEnd' | 'afternoonStart' | 'afternoonEnd'>): string {
  const morning = `${seance.morningStart} – ${seance.morningEnd}`
  if (!seance.afternoonStart || !seance.afternoonEnd) return `Matin ${morning}`
  return `Matin ${morning} · Après-midi ${seance.afternoonStart} – ${seance.afternoonEnd}`
}

/** « Titre professionnel · Module / séquence » : ce qui identifie la formation sur la feuille. */
export function seanceProgram(seance: Pick<Seance, 'degreeTitle' | 'module'>): string | null {
  const parts = [seance.degreeTitle, seance.module].filter((value): value is string => Boolean(value?.trim()))
  return parts.length ? parts.join(' · ') : null
}

/** « Nord · En salle · Salle 204 » : site, modalité et lieu précis s'il est renseigné. */
export function seancePlace(seance: Pick<Seance, 'site' | 'mode' | 'location'>): string {
  const base = `${seance.site} · ${MODE_LABELS[seance.mode]}`
  return seance.location ? `${base} · ${seance.location}` : base
}

/** Nature d'un événement du journal d'une feuille. */
export const HISTORY_ACTION_LABELS: Record<EmargementHistoryAction, string> = {
  seance_created: 'Feuille créée',
  attendance_set: 'Statut modifié',
  attendance_signed: 'Signature tracée',
  qr_signed: 'Signature par QR code',
  half_signed: 'Demi-journée signée',
  half_validated: 'Validée par le pédago',
}

export const HISTORY_ACTION_TONES: Record<EmargementHistoryAction, BadgeTone> = {
  seance_created: 'neutral',
  attendance_set: 'accent',
  attendance_signed: 'accent',
  qr_signed: 'success',
  half_signed: 'success',
  half_validated: 'warning',
}

function statusWithTime(status: EmargementStatus, time: string | null): string {
  const label = STATUS_LABELS[status]
  return time ? `${label} (${time})` : label
}

/**
 * Phrase lisible d'une entrée du journal : qui / quoi / depuis quel statut.
 * Les statuts restent explicites (`Présent → Absent`) : c'est la question que
 * pose le Peda devant une feuille corrigée.
 */
export function historySummary(entry: EmargementHistoryEntry): string {
  const subject = [entry.alternantName, entry.half ? HALF_LABELS[entry.half].toLowerCase() : null]
    .filter((value): value is string => Boolean(value))
    .join(' · ')

  switch (entry.action) {
    case 'seance_created':
      return 'Feuille ouverte pour cette séance.'
    case 'attendance_set': {
      const from = entry.fromStatus ? statusWithTime(entry.fromStatus, entry.fromStatusTime) : 'Non renseigné'
      const to = statusWithTime(entry.toStatus ?? 'na', entry.toStatusTime)
      return `${subject} : ${from} → ${to}`
    }
    case 'attendance_signed':
      return `${subject} : signature tracée sur l’appareil du formateur.`
    case 'qr_signed':
      return `${subject} : signature de l’alternant par QR code.`
    case 'half_signed':
      return `${subject} : demi-journée signée par le formateur.`
    case 'half_validated':
      return `${subject} : validée par le service pédagogique.`
  }
}
