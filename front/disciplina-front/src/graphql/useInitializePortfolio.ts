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
        id: String(c.company.id),
        nom_commercial: c.company.name,
        proprietaire_contact: c.salePerson?.email || null,
        commercial:  c.salePerson?.name || null,
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
        status: (c.company.conclusion as any) || 'À Réfléchir',
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
