import type { BadgeTone } from '@/components/ui/Badge'
import type {
  EmargementHalf,
  EmargementStatus,
  Seance,
  SeanceMode,
  SeanceSite,
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

/** Signature d'une demi-journée : le statut prime, le mode de saisie complète. */
export function signatureLabel(mode: 'qr' | 'manual'): string {
  return mode === 'qr' ? 'QR alternant' : 'Saisie formateur'
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
