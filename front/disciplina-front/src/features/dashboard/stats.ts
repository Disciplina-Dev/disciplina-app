import { getISOWeeksInYear } from 'date-fns'

import { STATUS_VALUES, type EntrepriseStatus } from '@/types/entreprise'
import { USERS, UserRole, type AppUser } from '@/store/authStore'

// ─── Types (miroir de la query companyStats) ────────────────────────────────
export interface StatusCount {
  userID: number | null
  status: string | null
  count: number
}

export interface PeriodStatusCount extends StatusCount {
  week: number
  month: number
}

export interface CompanyStatsData {
  current: StatusCount[]
  byPeriod: PeriodStatusCount[]
  years: number[]
}

export type PeriodMode = 'week' | 'month'

// ─── Couleurs statuts (palette index.css) ───────────────────────────────────
export const STATUS_COLORS: Record<EntrepriseStatus, string> = {
  'Oui': 'var(--color-success)',
  'Non': 'var(--color-danger)',
  'À Réfléchir': 'var(--color-warning)',
  'Relance': 'var(--color-blue)',
  'Réponds pas': 'var(--color-gray-500)',
  'Fermé': 'var(--color-gray-900)',
}

export const STATUS_BG: Record<EntrepriseStatus, string> = {
  'Oui': 'var(--color-success-bg)',
  'Non': 'var(--color-danger-bg)',
  'À Réfléchir': 'var(--color-warning-bg)',
  'Relance': 'var(--color-blue-light)',
  'Réponds pas': 'var(--color-gray-50)',
  'Fermé': 'var(--color-gray-100)',
}

export const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

// ─── Commerciaux suivis ──────────────────────────────────────────────────────
// Toute personne du référentiel USERS avec un rôle commercial/responsable,
// hors entrée technique « Pas de commerciaux ».
export const TRACKED_COMMERCIALS: AppUser[] = Object.values(USERS).filter(
  (u) =>
    (u.role === UserRole.COMMERCIAL || u.role === UserRole.RESPONSABLE) &&
    u.name !== 'Pas de commerciaux',
)

export function commercialById(userID: number | null): AppUser | null {
  if (userID == null) return null
  return USERS[String(userID)] ?? null
}

function isKnownStatus(s: string | null): s is EntrepriseStatus {
  return s != null && (STATUS_VALUES as string[]).includes(s)
}

// ─── Agrégations ─────────────────────────────────────────────────────────────

/** Totaux globaux par statut (snapshot actuel). */
export function totalsByStatus(current: StatusCount[]): Record<EntrepriseStatus, number> & { total: number } {
  const acc = Object.fromEntries(STATUS_VALUES.map((s) => [s, 0])) as Record<EntrepriseStatus, number>
  let total = 0
  for (const row of current) {
    total += row.count
    if (isKnownStatus(row.status)) acc[row.status] += row.count
  }
  return { ...acc, total }
}

export interface CommercialStatusTotals {
  userID: number
  name: string
  color: string
  total: number
  byStatus: Record<EntrepriseStatus, number>
}

/** Snapshot actuel ventilé par commercial. */
export function totalsByCommercial(current: StatusCount[]): CommercialStatusTotals[] {
  const map = new Map<number, CommercialStatusTotals>()
  for (const row of current) {
    if (row.userID == null) continue
    const user = commercialById(row.userID)
    if (!user || !TRACKED_COMMERCIALS.some((c) => c.id === user.id)) continue
    let entry = map.get(row.userID)
    if (!entry) {
      entry = {
        userID: row.userID,
        name: user.name,
        color: user.color ?? 'var(--color-gray-300)',
        total: 0,
        byStatus: Object.fromEntries(STATUS_VALUES.map((s) => [s, 0])) as Record<EntrepriseStatus, number>,
      }
      map.set(row.userID, entry)
    }
    entry.total += row.count
    if (isKnownStatus(row.status)) entry.byStatus[row.status] += row.count
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

export interface PeriodPoint {
  /** Index de période (n° de semaine ISO ou de mois) */
  period: number
  label: string
  /** total par commercial, clé = nom */
  [commercial: string]: number | string
}

/** Série complète (toutes les semaines/mois de l'année, trous remplis à 0) du total par commercial. */
export function periodSeries(
  byPeriod: PeriodStatusCount[],
  mode: PeriodMode,
  year: number,
  commercials: AppUser[],
): PeriodPoint[] {
  const periodCount = mode === 'week' ? getISOWeeksInYear(new Date(year, 0, 4)) : 12
  const points: PeriodPoint[] = Array.from({ length: periodCount }, (_, i) => {
    const p = i + 1
    const point: PeriodPoint = {
      period: p,
      label: mode === 'week' ? `S${p}` : MONTH_LABELS[i],
    }
    for (const c of commercials) point[c.name] = 0
    return point
  })

  for (const row of byPeriod) {
    const user = commercialById(row.userID)
    if (!user || !commercials.some((c) => c.id === user.id)) continue
    const idx = (mode === 'week' ? row.week : row.month) - 1
    if (idx < 0 || idx >= points.length) continue
    points[idx][user.name] = (points[idx][user.name] as number) + row.count
  }
  return points
}

/** Total annuel par commercial (somme de tous les statuts sur l'année). */
export function yearTotals(byPeriod: PeriodStatusCount[], commercials: AppUser[]): Record<string, number> {
  const acc: Record<string, number> = Object.fromEntries(commercials.map((c) => [c.name, 0]))
  for (const row of byPeriod) {
    const user = commercialById(row.userID)
    if (!user || !(user.name in acc)) continue
    acc[user.name] += row.count
  }
  return acc
}
