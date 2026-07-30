import { useEffect } from 'react'
import { useQuery } from 'urql'
import { useQuarantineStore } from '@/store/quarantineStore'
import { GET_COMPANY_CONFLICTS } from '@/graphql/queries'

export function useInitializeQuarantine(first?: number, after?: string, search?: string, conflictType?: string) {
  const setCompanies = useQuarantineStore((s) => s.setCompanies)
  const setLoading = useQuarantineStore((s) => s.setLoading)
  const setError = useQuarantineStore((s) => s.setError)

  const variables = {
    first: search ? undefined : first,
    after: search ? undefined : after,
    search: search || undefined,
    conflictType: conflictType || undefined,
  }

  const [result] = useQuery({ query: GET_COMPANY_CONFLICTS, variables, requestPolicy: 'network-only' })

  useEffect(() => {
    setLoading(result.fetching)
    setError(result.error?.message || null)

    if (result.data?.companyConflicts) {
      const entreprises = result.data.companyConflicts.edges.map(({ node: c }: any) => ({
        id: String(c.id),
        nom_commercial: c.name,
        proprietaire_contact: null,
        commercial: null,
        proprietaire_id: c.userID || null,
        representant_legal: c.legalReferent || null,
        telephone: c.phone,
        email: c.email,
        adresse: c.address,
        secteur: c.sector,
        metier: c.mainActivity,
        siret: c.siret,
        idcc: c.idcc,
        note: c.notes,
        conclusion: c.conclusion,
        status: c.status || 'À Réfléchir',
        date_insertion: c.createdAt ? c.createdAt.slice(0, 10) : null,
        date_relance: c.relanceDate ?? null,
        type_relance: c.relanceType ?? null,
        relance_template_id: c.relanceTemplateId ?? null,
        candidateUserIds: c.candidateUserIds ?? null,
      }))
      setCompanies(entreprises)
    }
  }, [result])

  return {
    loading: result.fetching,
    error: result.error?.message,
    pageInfo: result.data?.companyConflicts?.pageInfo,
  }
}
