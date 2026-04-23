import { useEffect } from 'react'
import { useQuery, useMutation } from 'urql'
import { usePortefeuilleStore } from '@/store/portefeuilleStore'
import {
  GET_COMPANIES,
  GET_SALE_PERSONS,
  CREATE_COMPANY,
  UPDATE_COMPANY,
  DELETE_COMPANY,
  GET_CANDIDATES,
  CREATE_CANDIDATE,
} from '@/graphql/queries'
import type { Candidate } from '@/types/candidate'
import { CandidateStatus, TitleProfessionalType, SchoolLevel } from '@/types/candidate'

export function useCompanies() {
  const setCompanies = usePortefeuilleStore((s) => s.setCompanies)
  const setLoading = usePortefeuilleStore((s) => s.setLoading)
  const setError = usePortefeuilleStore((s) => s.setError)

  const [result] = useQuery({ query: GET_COMPANIES })
  useEffect(() => {
    setLoading(result.fetching)
    if (result.error) {
      setError(result.error.message)
    } else if (result.data?.companies) {
      const entreprises = result.data.companies.map((c: any) => ({
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
      setError(null)
    }
  }, [result])

  return result
}

export function useSalePersons() {
  const setSalePersons = usePortefeuilleStore((s) => s.setSalePersons)
  const setError = usePortefeuilleStore((s) => s.setError)

  const [result] = useQuery({ query: GET_SALE_PERSONS })

  useEffect(() => {
    if (result.error) {
      setError(result.error.message)
    } else if (result.data?.salePersons) {
      setSalePersons(result.data.salePersons)
      setError(null)
    }
  }, [result])

  return result
}

export function useCreateCompany() {
  const addCompany = usePortefeuilleStore((s) => s.addCompany)
  const [result, executeMutation] = useMutation(CREATE_COMPANY)

  const createCompany = (input: any) => {
    return executeMutation({ input }).then((response) => {
      if (response.data?.createCompany) {
        const company = {
          id: String(response.data.createCompany.id),
          nom_commercial: response.data.createCompany.name,
          proprietaire_contact: null,
          commercial: null,
          proprietaire_id: null,
          representant_legal: null,
          telephone: response.data.createCompany.phone,
          email: response.data.createCompany.email,
          adresse: response.data.createCompany.address,
          secteur: response.data.createCompany.sector,
          metier: response.data.createCompany.mainActivity,
          siret: response.data.createCompany.siret,
          idcc: response.data.createCompany.idcc,
          note: response.data.createCompany.notes,
          conclusion: response.data.createCompany.conclusion,
          status: (response.data.createCompany.conclusion as any) || 'À Réfléchir',
          date_insertion: new Date().toISOString().split('T')[0],
          date_relance: '',
        }
        addCompany(company)
      }
      return response
    })
  }

  return { createCompany, result }
}

export function useUpdateCompany() {
  const updateCompany = usePortefeuilleStore((s) => s.updateCompany)
  const [result, executeMutation] = useMutation(UPDATE_COMPANY)

  const update = async (id: number, input: any) => {
    return executeMutation({ id, input }).then((response) => {
      if (response.data?.updateCompany) {
        updateCompany(String(id), {
          nom_commercial: response.data.updateCompany.name,
          telephone: response.data.updateCompany.phone,
          email: response.data.updateCompany.email,
          adresse: response.data.updateCompany.address,
          secteur: response.data.updateCompany.sector,
          metier: response.data.updateCompany.mainActivity,
          siret: response.data.updateCompany.siret,
          idcc: response.data.updateCompany.idcc,
          note: response.data.updateCompany.notes,
          conclusion: response.data.updateCompany.conclusion,
        })
      }
      console.log(response);
      return response
    })
  }

  return { update, result }
}

export function useDeleteCompany() {
  const removeCompany = usePortefeuilleStore((s) => s.removeCompany)
  const [result, executeMutation] = useMutation(DELETE_COMPANY)

  const deleteCompany = (id: number) => {
    return executeMutation({ id }).then((response) => {
      if (response.data?.deleteCompany) {
        removeCompany(String(id))
      }
      return response
    })
  }

  return { deleteCompany, result }
}

// ─── Candidats (MongoDB) ─────────────────────────────────────────────────────

/** Maps backend status enum (English) → frontend enum (French labels) */
function mapStatus(raw: string): CandidateStatus {
  const map: Record<string, CandidateStatus> = {
    SEEKING: CandidateStatus.SEEKING,
    NOT_SEEKING: CandidateStatus.NOT_SEEKING,
    CANCELLED: CandidateStatus.CANCELLED,
    MATCHED: CandidateStatus.MATCHED,
    CONTRACTED: CandidateStatus.CONTRACTED,
    IMMERSING: CandidateStatus.MATCHED, // IMMERSING → Immersion (same label)
    BANNED: CandidateStatus.BANNED,
  }
  return map[raw] ?? CandidateStatus.SEEKING
}

function mapTpType(raw: string): TitleProfessionalType {
  return (TitleProfessionalType as any)[raw] ?? TitleProfessionalType.CC
}

function mapSchoolLevel(raw: string | null | undefined): SchoolLevel | undefined {
  if (!raw) return undefined
  return (SchoolLevel as any)[raw] ?? undefined
}

/**
 * Fetches candidates from the dedicated MongoDB GraphQL endpoint.
 * Returns { candidates, loading, error, refetch }.
 */
export function useCandidates() {
  const [result, reexecuteQuery] = useQuery({
    query: GET_CANDIDATES,
    context: { url: 'http://localhost:4000/api/graphql/candidates' },
  })

  const candidates: Candidate[] = (result.data?.candidates ?? []).map((c: any) => ({
    _id: c.id,
    tp_type: mapTpType(c.tpType),
    status: mapStatus(c.status),
    identity: {
      full_name: c.identity.fullName,
      email: c.identity.email,
      phone: c.identity.phone,
    },
    education: c.schoolLevel ? { school_level: mapSchoolLevel(c.schoolLevel) } : undefined,
  }))

  return {
    candidates,
    loading: result.fetching,
    error: result.error?.message ?? null,
    refetch: () => reexecuteQuery({ requestPolicy: 'network-only' }),
  }
}

interface CreateCandidateInput {
  tpType: string
  status: string
  identity: { fullName: string; email: string; phone: string }
  schoolLevel?: string | null
  trainingSite?: string | null
}

/**
 * Returns a function to create a new candidate via mutation.
 * Uses candidateGraphqlClient directly to bypass the companies urql Provider.
 */
export function useCreateCandidate() {
  const [result, executeMutation] = useMutation(CREATE_CANDIDATE)

  const createCandidate = (input: CreateCandidateInput) => {
    return executeMutation(
      { input },
      { url: 'http://localhost:4000/api/graphql/candidates' } as any,
    )
  }

  return { createCandidate, result }
}
