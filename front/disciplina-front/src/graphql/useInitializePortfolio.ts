import { useEffect } from 'react'
import { useQuery } from 'urql'
import { usePortefeuilleStore } from '@/store/portefeuilleStore'
import { GET_COMPANIES, GET_SALE_PERSONS } from '@/graphql/queries'

export function useInitializePortfolio() {
  const setCompanies = usePortefeuilleStore((s) => s.setCompanies)
  const setSalePersons = usePortefeuilleStore((s) => s.setSalePersons)
  const setLoading = usePortefeuilleStore((s) => s.setLoading)
  const setError = usePortefeuilleStore((s) => s.setError)

  const [companiesResult] = useQuery({ query: GET_COMPANIES })
  const [salePersonsResult] = useQuery({ query: GET_SALE_PERSONS })

  useEffect(() => {
    const fetching = companiesResult.fetching || salePersonsResult.fetching
    setLoading(fetching)

    const companiesError = companiesResult.error?.message
    const salePersonsError = salePersonsResult.error?.message
    const error = companiesError || salePersonsError
    setError(error || null)

    if (companiesResult.data?.companies) {
      const entreprises = companiesResult.data.companies.map((c: any) => ({
        id: String(c.id),
        nom_commercial: c.name,
        proprietaire_contact: null,
        commercial: null,
        proprietaire_id: null,
        representant_legal: null,
        telephone: c.phone,
        email: c.email,
        adresse: c.address,
        secteur: c.sector,
        metier: c.mainActivity,
        siret: c.siret,
        idcc: c.idcc,
        note: c.notes,
        conclusion: c.conclusion,
        status: (c.conclusion as any) || 'À Réfléchir',
        date_insertion: new Date().toISOString().split('T')[0],
        date_relance: '',
      }))
      setCompanies(entreprises)
    }

    if (salePersonsResult.data?.salePersons) {
      setSalePersons(salePersonsResult.data.salePersons)
    }
  }, [companiesResult, salePersonsResult])

  return {
    loading: companiesResult.fetching || salePersonsResult.fetching,
    error: companiesResult.error?.message || salePersonsResult.error?.message,
  }
}
