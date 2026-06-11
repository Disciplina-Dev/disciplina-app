import { useEffect } from 'react'
import { useQuery } from 'urql'
import { usePortefeuilleStore } from '@/store/portefeuilleStore'
import { GET_COMPANIES, GET_SALE_PERSONS } from '@/graphql/queries'

export interface ServerFilters {
  status?: string[]
  userID?: number
  sector?: string
  relance?: string
  unassigned?: boolean
  createdFrom?: string
  createdTo?: string
}

export function useInitializePortfolio(first?: number, after?: string, search?: string, filters?: ServerFilters) {
  const setCompanies = usePortefeuilleStore((s) => s.setCompanies)
  const setSalePersons = usePortefeuilleStore((s) => s.setSalePersons)
  const setLoading = usePortefeuilleStore((s) => s.setLoading)
  const setError = usePortefeuilleStore((s) => s.setError)

  const isRelanceMode = !!filters?.relance
  const variables = {
    first: (search || isRelanceMode) ? undefined : first,
    after: (search || isRelanceMode) ? undefined : after,
    search: search || undefined,
    filters: filters && Object.values(filters).some(v => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)) ? filters : undefined,
  }

  const [companiesResult] = useQuery({ query: GET_COMPANIES, variables, requestPolicy: 'network-only' })
  const [salePersonsResult] = useQuery({ query: GET_SALE_PERSONS, requestPolicy: 'network-only' })

  useEffect(() => {
    const fetching = companiesResult.fetching || salePersonsResult.fetching
    setLoading(fetching)

    const companiesError = companiesResult.error?.message
    const salePersonsError = salePersonsResult.error?.message
    const error = companiesError || salePersonsError
    setError(error || null)

    if (companiesResult.data?.companies) {
      const entreprises = companiesResult.data.companies.edges.map(({ node: c }: any) => {
        return {
          id: String(c.company.id),
          nom_commercial: c.company.name,
          proprietaire_contact: c.salePerson?.email || null,
          commercial: c.salePerson?.name || null,
          proprietaire_id: c.salePerson?.id || null,
          representant_legal: c.company?.legalReferent || null,
          telephone: c.company.phone,
          email: c.company.email,
          adresse: c.company.address,
          secteur: c.company.sector,
          metier: c.company.mainActivity,
          siret: c.company.siret,
          idcc: c.company.idcc,
          note: c.company.notes,
          conclusion: c.company.conclusion,
          status: c.company.status || 'À Réfléchir',
          date_insertion: c.company.createdAt ? c.company.createdAt.slice(0, 10) : null,
          date_relance: c.company.relanceDate ?? null,
        }
      })
      setCompanies(entreprises)
    }

    if (salePersonsResult.data?.salePersons) {
      setSalePersons(salePersonsResult.data.salePersons)
    }
  }, [companiesResult, salePersonsResult])

  return {
    loading: companiesResult.fetching || salePersonsResult.fetching,
    error: companiesResult.error?.message || salePersonsResult.error?.message,
    pageInfo: companiesResult.data?.companies?.pageInfo,
  }
}
