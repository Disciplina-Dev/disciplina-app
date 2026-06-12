import { useQuery } from 'urql'

import { GET_COMPANY_STATS } from '@/graphql/queries'
import type { CompanyStatsData } from './stats'

export function useCompanyStats(year: number) {
  const [result] = useQuery<{ companyStats: CompanyStatsData }>({
    query: GET_COMPANY_STATS,
    variables: { year },
  })

  return {
    stats: result.data?.companyStats ?? null,
    fetching: result.fetching,
    error: result.error,
  }
}
