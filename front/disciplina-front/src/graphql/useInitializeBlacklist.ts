import { useEffect } from 'react'
import { useQuery } from 'urql'
import { useBlacklistStore } from '@/store/blacklistStore'
import { GET_BLACKLISTED_COMPANIES } from '@/graphql/queries'

export function useInitializeBlacklist(first?: number, after?: string, search?: string) {
  const setCompanies = useBlacklistStore((s) => s.setCompanies)
  const setLoading = useBlacklistStore((s) => s.setLoading)
  const setError = useBlacklistStore((s) => s.setError)

  const variables = {
    first: search ? undefined : first,
    after: search ? undefined : after,
    search: search || undefined,
  }

  const [result] = useQuery({ query: GET_BLACKLISTED_COMPANIES, variables, requestPolicy: 'network-only' })

  useEffect(() => {
    setLoading(result.fetching)
    setError(result.error?.message || null)

    if (result.data?.blacklistedCompanies) {
      const entreprises = result.data.blacklistedCompanies.edges.map(({ node: c }: any) => ({
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
        all_blacklist: !!c.allBlacklist,
      }))
      setCompanies(entreprises)
    }
  }, [result])

  return {
    loading: result.fetching,
    error: result.error?.message,
    pageInfo: result.data?.blacklistedCompanies?.pageInfo,
  }
}
