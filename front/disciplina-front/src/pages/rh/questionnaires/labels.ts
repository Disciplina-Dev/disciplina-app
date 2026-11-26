import type { BadgeTone } from '@/components/ui'
import type { AttemptStatus, QuestionType, QuestionnaireStatus } from '@/types/questionnaire'

export const QUESTIONNAIRE_STATUS: Record<QuestionnaireStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Brouillon', tone: 'neutral' },
  active: { label: 'Actif', tone: 'success' },
  archived: { label: 'Archivé', tone: 'warning' },
}

export const ATTEMPT_STATUS: Record<AttemptStatus, { label: string; tone: BadgeTone }> = {
  invited: { label: 'Invité', tone: 'accent' },
  in_progress: { label: 'En cours', tone: 'purple' },
  completed: { label: 'Terminé', tone: 'success' },
  expired: { label: 'Expiré', tone: 'neutral' },
  cancelled: { label: 'Annulé', tone: 'danger' },
}

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  single: 'QCM — 1 réponse',
  multiple: 'QCM — plusieurs réponses',
  true_false: 'Vrai / faux',
  text: 'Réponse libre',
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

export function formatDuration(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return '—'
  const s = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000))
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`
}

/** Téléchargement d'un objet en fichier JSON (export questionnaire). */
export function downloadJson(data: unknown, fileName: string): void {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), fileName)
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
