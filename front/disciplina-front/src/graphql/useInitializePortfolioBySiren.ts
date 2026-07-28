import { useEffect } from 'react'
import { useQuery } from 'urql'
import { usePortefeuilleStore } from '@/store/portefeuilleStore'
import { GET_COMPANIES_BY_SIREN, GET_SALE_PERSONS } from '@/graphql/queries'
import { toEntreprise } from '@/types/companyMapper'
import type { Company, SalePerson, SirenGroup } from '@/types/entreprise'
import type { ServerFilters } from '@/graphql/useInitializePortfolio'

function hasActiveFilters(filters?: ServerFilters): boolean {
  return (
    !!filters &&
    Object.values(filters).some(
      (v) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0),
    )
  )
}

function toSirenGroups(edges: { node: { siren: string; count: number; companies: Company[] } }[], salePersons: SalePerson[]): SirenGroup[] {
  const salePersonById = new Map(salePersons.map((p) => [p.id, p]))
  return edges.map(({ node }) => ({
    siren: node.siren,
    count: node.count,
    entreprises: node.companies.map((c) => toEntreprise(c, salePersonById.get(c.userID ?? -1) ?? null)),
  }))
}

export function useInitializePortfolioBySiren(first?: number, after?: string, filters?: ServerFilters, pause?: boolean) {
  const setSirenGroups = usePortefeuilleStore((s) => s.setSirenGroups)
  const setSalePersons = usePortefeuilleStore((s) => s.setSalePersons)
  const setLoading = usePortefeuilleStore((s) => s.setLoading)
  const setError = usePortefeuilleStore((s) => s.setError)

  const variables = {
    first,
    after,
    filters: hasActiveFilters(filters) ? filters : undefined,
  }

  const [groupsResult] = useQuery({ query: GET_COMPANIES_BY_SIREN, variables, requestPolicy: 'network-only', pause })
  const [salePersonsResult] = useQuery({ query: GET_SALE_PERSONS, requestPolicy: 'network-only', pause })

  useEffect(() => {
    setLoading(groupsResult.fetching || salePersonsResult.fetching)
    setError(groupsResult.error?.message || salePersonsResult.error?.message || null)

    if (salePersonsResult.data?.salePersons) {
      setSalePersons(salePersonsResult.data.salePersons)
    }
    if (groupsResult.data?.companiesBySiren) {
      const salePersons = salePersonsResult.data?.salePersons ?? []
      setSirenGroups(toSirenGroups(groupsResult.data.companiesBySiren.edges, salePersons))
    }
  }, [groupsResult, salePersonsResult])

  return {
    loading: groupsResult.fetching || salePersonsResult.fetching,
    error: groupsResult.error?.message || salePersonsResult.error?.message,
    pageInfo: groupsResult.data?.companiesBySiren?.pageInfo,
  }
}
