import type { Job } from '../types'

export interface JobFilters {
  search: string
  statuses: string[]
  desiredTP: string | null
  sector: string | null
}

export const EMPTY_JOB_FILTERS: JobFilters = {
  search: '',
  statuses: [],
  desiredTP: null,
  sector: null,
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

    return true
  })
}
