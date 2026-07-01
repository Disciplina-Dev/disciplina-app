import type { Job } from '../types'

export interface JobFilters {
  search: string
  statuses: string[]
  desiredTP: string | null
  sector: string | null
  localisations: string[]
  ageRange: string | null
  drivingLicenceB: boolean | null
}

export const EMPTY_JOB_FILTERS: JobFilters = {
  search: '',
  statuses: [],
  desiredTP: null,
  sector: null,
  localisations: [],
  ageRange: null,
  drivingLicenceB: null,
}

export function applyJobFilters(jobs: Job[], filters: JobFilters): Job[] {
  return jobs.filter((job) => {
    if (filters.search && !job.companyName?.toLowerCase().includes(filters.search.toLowerCase())) {
      return false
    }

    if (filters.statuses.length > 0 && !filters.statuses.includes(job.status ?? '')) {
      return false
    }

    if (filters.desiredTP && job.desiredTP !== filters.desiredTP) {
      return false
    }

    if (filters.sector && job.sector !== filters.sector) {
      return false
    }

    if (filters.localisations.length > 0) {
      if (!job.localisation || job.localisation.length === 0) {
        return false
      }
      const hasIntersection = job.localisation.some((loc) => filters.localisations.includes(loc))
      if (!hasIntersection) {
        return false
      }
    }

    if (filters.ageRange && job.ageRange !== filters.ageRange) {
      return false
    }

    if (filters.drivingLicenceB !== null && job.drivingLicencseB !== filters.drivingLicenceB) {
      return false
    }

    return true
  })
}

export function getDistinctAgeRanges(jobs: Job[]): string[] {
  const ranges = new Set<string>()
  jobs.forEach((job) => {
    if (job.ageRange) {
      ranges.add(job.ageRange)
    }
  })
  return Array.from(ranges).sort()
}
