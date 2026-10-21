/** Nombre de jours ouvrés de la période d'essai (lundi–vendredi, samedi/dimanche exclus). */
export const TRIAL_PERIOD_BUSINESS_DAYS = 45

/**
 * Ajoute N jours ouvrés (lun–ven) à une date. La date de départ n'est pas
 * comptée (sémantique `date-fns/addBusinessDays`) : le résultat tombe toujours
 * sur un jour ouvré. Les jours fériés ne sont pas pris en compte.
 */
export function addBusinessDays(start: Date | string, days: number): Date {
  const date = new Date(start)
  let remaining = days
  while (remaining > 0) {
    date.setDate(date.getDate() + 1)
    const day = date.getDay()
    if (day !== 0 && day !== 6) remaining -= 1
  }
  return date
}

/** Fin de période d'essai par défaut : début de contrat + 45 jours ouvrés, au format `yyyy-mm-dd` (input date). */
export function defaultTrialEndDate(contractStart: string): string {
  return toISODateOnly(addBusinessDays(contractStart, TRIAL_PERIOD_BUSINESS_DAYS))
}

/** Formate une Date en `yyyy-mm-dd` en heure locale (sans décalage UTC). */
export function toISODateOnly(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export type TrialPeriodStatus = 'ongoing' | 'done' | 'unknown'

/**
 * Statut de la période d'essai par rapport à aujourd'hui (comparaison au jour près) :
 * - `done` : date de fin dépassée (jour passé),
 * - `ongoing` : date de fin aujourd'hui ou dans le futur,
 * - `unknown` : pas de date renseignée.
 */
export function getTrialPeriodStatus(trialEndDate: string | null | undefined, now: Date = new Date()): TrialPeriodStatus {
  if (!trialEndDate) return 'unknown'
  const end = new Date(trialEndDate)
  if (Number.isNaN(end.getTime())) return 'unknown'
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  return endDay.getTime() < today.getTime() ? 'done' : 'ongoing'
}
