import { useEffect } from 'react'
import { useQuery } from 'urql'
import { usePortefeuilleStore } from '@/store/portefeuilleStore'
import { GET_COMPANIES, GET_SALE_PERSONS } from '@/graphql/queries'
import type { Company } from '@/types/entreprise'

/** Shape of `company` as selected by GET_COMPANIES. */
interface GqlCompanyNode extends Company {
  legalReferent: string | null
}

interface GqlSalePerson {
  id: number
  email: string
  firstName: string
  lastName: string
}

/** Shape of an edge `node` in GET_COMPANIES. */
interface GqlCompanyEdgeNode {
  company: GqlCompanyNode
  salePerson: GqlSalePerson | null
}

export interface ServerFilters {
  status?: string[]
  userID?: number
  sector?: string
  relance?: string
  unassigned?: boolean
  createdFrom?: string
  createdTo?: string
}

export function useInitializePortfolio(first?: number, after?: string, search?: string, filters?: ServerFilters, pause?: boolean) {
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

  const [companiesResult] = useQuery({ query: GET_COMPANIES, variables, requestPolicy: 'network-only', pause })
  const [salePersonsResult] = useQuery({ query: GET_SALE_PERSONS, requestPolicy: 'network-only', pause })

  useEffect(() => {
    const fetching = companiesResult.fetching || salePersonsResult.fetching
    setLoading(fetching)

    const companiesError = companiesResult.error?.message
    const salePersonsError = salePersonsResult.error?.message
    const error = companiesError || salePersonsError
    setError(error || null)

    if (companiesResult.data?.companies) {
      const entreprises = companiesResult.data.companies.edges.map(({ node: c }: { node: GqlCompanyEdgeNode }) => {
        return {
          id: String(c.company.id),
          nom_commercial: c.company.name,
          proprietaire_contact: c.salePerson?.email || null,
          commercial: c.salePerson ? `${c.salePerson.firstName ?? ''} ${c.salePerson.lastName ?? ''}`.trim() || null : null,
          proprietaire_id: c.salePerson?.id || null,
          representant_legal: c.company?.legalReferent || null,
          telephone: c.company.phone,
          email: c.company.email,
          adresse: c.company.address,
          secteur: c.company.sector,
          metier: c.company.mainActivity,
          siret: c.company.siret,
          siren: c.company.siren ?? (c.company.siret ? c.company.siret.slice(0, 9) : null),
          idcc: c.company.idcc,
          note: c.company.notes,
          conclusion: c.company.conclusion,
          status: c.company.status || 'À Réfléchir',
          date_insertion: c.company.createdAt ? c.company.createdAt.slice(0, 10) : null,
          date_relance: c.company.relanceDate ?? null,
          type_relance: c.company.relanceType ?? null,
          relance_template_id: c.company.relanceTemplateId ?? null,
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
