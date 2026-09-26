import type { Job } from '../types'

// Statut d'une AB dérivé de ses offres (onglets de la liste matching RH).
export type AbStatus = 'ACTIVE' | 'ARCHIVED' | 'INACTIVE'

export type AbTab = 'ALL' | AbStatus

export interface JobFilters {
  search: string
  statuses: string[]
  desiredTPs: string[]
  sectors: string[]
  localisations: string[]
  administrationTypes: string[]
  tab: AbTab
}

export const EMPTY_JOB_FILTERS: JobFilters = {
  search: '',
  statuses: [],
  desiredTPs: [],
  sectors: [],
  localisations: [],
  administrationTypes: [],
  tab: 'ALL',
}

export interface OfferFilterInput {
  search?: string
  statuses?: string[]
  desiredTp?: string[]
  sectors?: string[]
  localisations?: string[]
  abStatus?: AbStatus
  administrationTypes?: string[]
}

export function toOfferFilterInput(filters: JobFilters, search: string): OfferFilterInput | undefined {
  const abStatus = filters.tab === 'ALL' ? undefined : filters.tab
  const hasFilter =
    Boolean(search) ||
    filters.statuses.length > 0 ||
    filters.desiredTPs.length > 0 ||
    filters.sectors.length > 0 ||
    filters.localisations.length > 0 ||
    filters.administrationTypes.length > 0 ||
    Boolean(abStatus)
  if (!hasFilter) return undefined
  return {
    search: search || undefined,
    statuses: filters.statuses.length > 0 ? filters.statuses : undefined,
    desiredTp: filters.desiredTPs.length > 0 ? filters.desiredTPs : undefined,
    sectors: filters.sectors.length > 0 ? filters.sectors : undefined,
    localisations: filters.localisations.length > 0 ? filters.localisations : undefined,
    administrationTypes: filters.administrationTypes.length > 0 ? filters.administrationTypes : undefined,
    abStatus,
  }
}

export function applyJobFilters(jobs: Job[], filters: JobFilters): Job[] {
  return jobs.filter((job) => {
    if (filters.search && !job.companyName?.toLowerCase().includes(filters.search.toLowerCase())) {
      return false
    }

    if (filters.statuses.length > 0 && !filters.statuses.includes(job.status ?? '')) {
      return false
    }

    if (
      filters.desiredTPs.length > 0 &&
      !job.desiredTp.some((tp) => filters.desiredTPs.includes(tp.tpType ?? ''))
    ) {
      return false
    }

    if (
      filters.sectors.length > 0 &&
      !job.companyInfos?.activities?.some((a) => filters.sectors.includes(a))
    ) {
      return false
    }

    if (filters.localisations.length > 0) {
      if (!job.localisation || !job.localisation.some((l) => filters.localisations.includes(l))) {
        return false
      }
    }

    // Administration filter only applied when job carries administrationType (AB context). Skip otherwise.
    if (filters.administrationTypes.length > 0) {
      const admin = (job as any).administrationType as string | undefined
      if (admin && !filters.administrationTypes.includes(admin)) return false
    }

    return true
  })
}
