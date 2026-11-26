/**
 * Fuseau horaire IANA par tenant — source de vérité unique côté frontend.
 *
 * Miroir de `back/src/config/tenant.ts`. Les fuseaux étaient écrits en dur
 * (`timeZone: 'Indian/Reunion'`) dans Matching.tsx, ExternalInterview.tsx et
 * InterviewProposalForm.tsx, ce qui décalait de 2 h tous les horaires du tenant
 * annemasse. Voir AUDIT_MULTITENANT.md (lot 1, TZ-03/04/05).
 *
 * Ce module est le SEUL endroit du frontend où un fuseau IANA ou un offset
 * numérique doit apparaître : la règle ESLint `no-restricted-syntax` de
 * eslint.config.js bannit les littéraux partout ailleurs.
 */
import type { Region } from '@/store/regionStore'

export const REGION_TIMEZONE: Record<Region, string> = {
  reunion: 'Indian/Reunion',
  annemasse: 'Europe/Paris',
}

/** Fuseau IANA d'une région, ou celui du tenant courant à défaut. */
export function regionTimezone(region?: Region | null): string {
  return REGION_TIMEZONE[region ?? 'reunion']
}

/**
 * Décalage de `tz` à l'instant `at`, en millisecondes, positif vers l'est.
 * `+02:00` → 7 200 000.
 */
function offsetInMs(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at)

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  // hour12:false rend minuit "24" sur certains runtimes ICU : ramené à 0.
  const hour = get('hour') % 24
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'))
  // On ignore les millisecondes d'`at` : elles sont identiques des deux côtés.
  return asUtc - Math.floor(at.getTime() / 1000) * 1000
}

/**
 * Convertit une heure MURALE (« 2026-08-20T10:30 », celle d'un `<input
 * type="datetime-local">`) en instant ISO, en l'interprétant dans le fuseau
 * `tz`.
 *
 * Remplace le `new Date(`${local}:00+04:00`)` qui était écrit en dur : `+04:00`
 * est l'offset de La Réunion, donc Annemasse était décalée de 2 h en hiver et
 * 3 h en été. `Europe/Paris` bascule sur CEST, donc un offset figé serait faux
 * six mois sur douze.
 *
 * Deux passes : on devine l'instant en lisant l'heure murale comme si elle était
 * UTC, on en déduit le décalage réel de la zone, puis on rejoue une fois avec le
 * décalage mesuré à l'instant candidat — ce second passage absorbe le basculement
 * DST, où le décalage de la zone change entre les deux instants.
 *
 * @param wallClock  « YYYY-MM-DDTHH:mm », sans fuseau
 * @param tz         fuseau IANA cible
 * @returns l'instant correspondant, en ISO UTC
 */
export function zonedWallClockToIso(wallClock: string, tz: string): string {
  const naive = Date.parse(`${wallClock}:00Z`)
  if (Number.isNaN(naive)) throw new RangeError(`zonedWallClockToIso: entrées invalides (${wallClock})`)

  const firstPass = new Date(naive - offsetInMs(new Date(naive), tz))
  const secondPass = new Date(naive - offsetInMs(firstPass, tz))
  return secondPass.toISOString()
}

/**
 * Convertit un instant ISO en heure murale de `tz`, au format attendu par un
 * `<input type="datetime-local">` (« YYYY-MM-DDTHH:mm »).
 *
 * `toLocaleString('en-CA')` est évité : le séparateur dépend de la locale, et
 * minuit peut rendre « 24:00 », qu'un `<input type="datetime-local">` refuse.
 * `formatToParts` évite les deux.
 */
export function isoToZonedWallClock(iso: string, tz: string): string {
  if (!iso) return ''
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(at)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  // hour12:false rend minuit « 24 » sur certains runtimes ICU, qu'un
  // datetime-local refuse : on le ramène à 00.
  const hour = Number(get('hour')) % 24
  const minute = Number(get('minute'))
  return `${get('year')}-${get('month')}-${get('day')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}
