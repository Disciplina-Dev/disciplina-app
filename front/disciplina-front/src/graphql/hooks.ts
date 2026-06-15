import { useEffect, useState } from 'react'
import { useQuery, useMutation } from 'urql'
import { usePortefeuilleStore } from '@/store/portefeuilleStore'
import { useBlacklistStore } from '@/store/blacklistStore'
import {
  GET_COMPANIES,
  GET_COMPANY_BY_SIRET,
  GET_SALE_PERSONS,
  CREATE_COMPANY,
  UPDATE_COMPANY,
  DELETE_COMPANY,
  BLACKLIST_COMPANY,
  UNBLACKLIST_COMPANY,
  GET_CANDIDATES,
  GET_CANDIDATES_PAGE,
  GET_CANDIDATE_BY_ID,
  GET_CANDIDATE_FULL,
  UPDATE_CANDIDATE,
  CREATE_CANDIDATE,
  CREATE_CANDIDATE_DRIVE_FOLDER,
  CREATE_NEEDS_ANALYSIS,
  GET_NEEDS_ANALYSES_BY_COMPANY,
  GET_NEEDS_ANALYSIS,
  DELETE_NEEDS_ANALYSIS,
  GET_COMPANY_HISTORY,
} from '@/graphql/queries'
import type { Candidate } from '@/types/candidate'
import type { PageInfo } from '@/types/pagination'
import { CandidateStatus, TitleProfessionalType, SchoolLevel, TrainingSite } from '@/types/candidate'

export interface CandidateServerFilters {
  trainingSite?: TrainingSite
  status?: CandidateStatus
  schoolLevel?: SchoolLevel
  drivingLicenseB?: boolean
  ageMin?: number
  ageMax?: number
  tpType?: TitleProfessionalType
}
import { candidateGraphqlClient } from './client'

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
      const entreprises = result.data.companies.edges.map(({ node: c }: any) => ({
        id: String(c.company.id),
        nom_commercial: c.company.name,
        proprietaire_contact: c.salePerson?.email || null,
        commercial: c.salePerson?.name || null,
        proprietaire_id: c.salePerson?.id || null,
        representant_legal: c.company.legalReferent || null,
        telephone: c.company.phone,
        email: c.company.email,
        adresse: c.company.address,
        secteur: c.company.sector,
        metier: c.company.mainActivity,
        siret: c.company.siret,
        idcc: c.company.idcc,
        note: c.company.notes,
        conclusion: c.company.conclusion,
        status: (c.company.status as any) || 'À Réfléchir',
        date_insertion: new Date().toISOString().split('T')[0],
        date_relance: c.company.relanceDate ?? null,
        type_relance: c.company.relanceType ?? null,
        relance_template_id: c.company.relanceTemplateId ?? null,
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

export function useCompanyBySiret() {
  const [result, executeQuery] = useQuery({
    query: GET_COMPANY_BY_SIRET,
    variables: { siret: '' },
    pause: true,
  })

  const searchBySiret = (siret: string) =>
    executeQuery({ variables: { siret }, requestPolicy: 'network-only' })

  return { result, searchBySiret }
}

export function useCreateCompany() {
  const addCompany = usePortefeuilleStore((s) => s.addCompany)
  const [result, executeMutation] = useMutation(CREATE_COMPANY)

  const createCompany = (input: any) => {
    console.log("createCompany mutation input:", input);
    return executeMutation({ input }).then((response) => {
      console.log("createCompany mutation response:", response);
      if (response.error) {
        console.error("createCompany mutation failed:", response.error);
      }
      if (response.data?.createCompany) {
        const salePersons = usePortefeuilleStore.getState().salePersons;
        const salePerson = salePersons.find((sp) => sp.id === response.data.createCompany.userID);

        const company = {
          id: String(response.data.createCompany.id),
          nom_commercial: response.data.createCompany.name,
          proprietaire_contact: salePerson?.email || null,
          commercial: salePerson?.name || null,
          proprietaire_id: response.data.createCompany.userID || null,
          representant_legal: response.data.createCompany.legalReferent || null,
          telephone: response.data.createCompany.phone,
          email: response.data.createCompany.email,
          adresse: response.data.createCompany.address,
          secteur: response.data.createCompany.sector,
          metier: response.data.createCompany.mainActivity,
          siret: response.data.createCompany.siret,
          idcc: response.data.createCompany.idcc,
          note: response.data.createCompany.notes,
          conclusion: response.data.createCompany.conclusion,
          status: (response.data.createCompany.status as any) || 'À Réfléchir',
          date_insertion: new Date().toISOString().split('T')[0],
          date_relance: response.data.createCompany.relanceDate ?? null,
          type_relance: response.data.createCompany.relanceType ?? null,
          relance_template_id: response.data.createCompany.relanceTemplateId ?? null,
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
    console.log("updateCompany mutation input:", { id, input });
    return executeMutation({ id, input }).then((response) => {
      console.log("updateCompany mutation response:", response);
      if (response.error) {
        console.error("updateCompany mutation failed:", response.error);
      }
      if (response.data?.updateCompany) {
        const salePersons = usePortefeuilleStore.getState().salePersons;
        const salePerson = salePersons.find((sp) => sp.id === response.data.updateCompany.userID);

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
          status: (response.data.updateCompany.status as any) || 'À Réfléchir',
          proprietaire_id: response.data.updateCompany.userID || null,
          commercial: salePerson?.name || null,
          proprietaire_contact: salePerson?.email || null,
          representant_legal: response.data.updateCompany.legalReferent || null,
          date_relance: response.data.updateCompany.relanceDate ?? null,
          type_relance: response.data.updateCompany.relanceType ?? null,
          relance_template_id: response.data.updateCompany.relanceTemplateId ?? null,
        })
      }
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

export function useBlacklistCompany() {
  const removeCompany = usePortefeuilleStore((s) => s.removeCompany)
  const [result, executeMutation] = useMutation(BLACKLIST_COMPANY)

  const blacklistCompany = (id: number, reason: string, allBlacklist: boolean) => {
    return executeMutation({ id, reason, allBlacklist }).then((response) => {
      if (response.data?.blacklistCompany) {
        removeCompany(String(id))
      }
      return response
    })
  }

  return { blacklistCompany, result }
}

export function useUnblacklistCompany() {
  const removeCompany = useBlacklistStore((s) => s.removeCompany)
  const [result, executeMutation] = useMutation(UNBLACKLIST_COMPANY)

  const unblacklistCompany = (id: number) => {
    return executeMutation({ id }).then((response) => {
      if (response.data?.unblacklistCompany) {
        removeCompany(String(id))
      }
      return response
    })
  }

  return { unblacklistCompany, result }
}

// ─── Candidats (MongoDB) ─────────────────────────────────────────────────────

/** Maps backend status enum (English) → frontend enum (French labels) */
function gqlStatusToFront(raw: string): CandidateStatus {
  const map: Record<string, CandidateStatus> = {
    SEEKING: CandidateStatus.SEEKING,
    NOT_SEEKING: CandidateStatus.NOT_SEEKING,
    CANCELLED: CandidateStatus.CANCELLED,
    MATCHED: CandidateStatus.MATCHED,
    CONTRACTED: CandidateStatus.CONTRACTED,
    IMMERSING: CandidateStatus.IMMERSING,
    BANNED: CandidateStatus.BANNED,
  }
  return map[raw] ?? CandidateStatus.SEEKING
}

/** Maps frontend status (French labels) → backend enum (English) */
function frontStatusToGql(s: CandidateStatus): string {
  const map: Record<CandidateStatus, string> = {
    [CandidateStatus.SEEKING]: 'SEEKING',
    [CandidateStatus.NOT_SEEKING]: 'NOT_SEEKING',
    [CandidateStatus.CANCELLED]: 'CANCELLED',
    [CandidateStatus.MATCHED]: 'MATCHED',
    [CandidateStatus.IMMERSING]: 'IMMERSING',
    [CandidateStatus.CONTRACTED]: 'CONTRACTED',
    [CandidateStatus.BANNED]: 'BANNED',
  }
  return map[s] ?? 'SEEKING'
}

function mapTpType(raw: string): TitleProfessionalType {
  return (TitleProfessionalType as any)[raw] ?? TitleProfessionalType.CC
}

function mapSchoolLevel(raw: string | null | undefined): SchoolLevel | undefined {
  if (!raw) return undefined
  return (SchoolLevel as any)[raw] ?? undefined
}

/** Maps GraphQL response (camelCase) → frontend Candidate (snake_case) */
function fromGql(c: any): Candidate {
  return {
    _id: c.id,
    tp_type: mapTpType(c.tpType),
    status: gqlStatusToFront(c.status),
    training_site: c.trainingSite,
    immersion_agreement: c.immersionAgreement,
    desired_sectors: c.desiredSectors,
    expected_company_skills: c.expectedCompanySkills,
    identity: {
      full_name: c.identity.fullName,
      email: c.identity.email,
      phone: c.identity.phone,
      date_of_birth: c.identity.dateOfBirth,
      place_of_birth: c.identity.placeOfBirth,
      age: c.identity.age,
      postal_code: c.identity.postalCode,
      city: c.identity.city,
      driving_license_b: c.identity.drivingLicenseB,
      transport_means: c.identity.transportMeans,
      psh_referral_request: c.identity.pshReferralRequest,
      avatar_updated_at: c.identity.avatarUpdatedAt,
      avatar_url: c.identity.avatarUpdatedAt
        ? `${import.meta.env.VITE_API_URL}/api/candidates/${c.id}/avatar?v=${encodeURIComponent(c.identity.avatarUpdatedAt)}`
        : undefined,
    },
    education: c.education
      ? {
          school_level: mapSchoolLevel(c.education.schoolLevel),
          justification: c.education.justification,
        }
      : undefined,
    support: c.support
      ? {
          france_travail_registered: c.support.franceTravailRegistered,
          france_travail_agency: c.support.franceTravailAgency,
          mission_locale_registered: c.support.missionLocaleRegistered,
          mission_locale_city: c.support.missionLocaleCity,
        }
      : undefined,
    background: c.background
      ? {
          last_diploma: c.background.lastDiploma,
          previous_trainings: c.background.previousTrainings,
          professional_experiences: c.background.professionalExperiences?.map((e: any) => ({
            position: e.position,
            duration: e.duration,
            responsibilities: e.responsibilities,
            company: e.company,
          })),
        }
      : undefined,
    profile: c.profile
      ? {
          french_level: c.profile.frenchLevel,
          english_level: c.profile.englishLevel,
          other_languages: c.profile.otherLanguages,
          strengths_and_improvements: c.profile.strengthsAndImprovements,
          qualities: c.profile.qualities,
          defects: c.profile.defects,
          digital_skills: c.profile.digitalSkills,
          ready_for_challenges: c.profile.readyForChallenges,
          hobbies: c.profile.hobbies,
        }
      : undefined,
    professional_projects: c.professionalProjects
      ? {
          career_objectives: c.professionalProjects.careerObjectives,
          desired_skills: c.professionalProjects.desiredSkills,
          apprenticeship_motivation: c.professionalProjects.apprenticeshipMotivation,
          training_expectations: c.professionalProjects.trainingExpectations,
        }
      : undefined,
    skills_assessment: c.skillsAssessment?.map((s: any) => ({ competence: s.competence, level: s.level })),
    job_info: c.jobInfo
      ? {
          domain_motivation: c.jobInfo.domainMotivation,
          questions_concerns: c.jobInfo.questionsConcerns,
          availability_date: c.jobInfo.availabilityDate,
          geographic_mobility: c.jobInfo.geographicMobility,
          weekend_work: c.jobInfo.weekendWork,
          discovery_source: c.jobInfo.discoverySource,
        }
      : undefined,
    synthesis: c.synthesis
      ? {
          feasibility_conclusion: c.synthesis.feasibilityConclusion,
          pathway_relevance: c.synthesis.pathwayRelevance,
          special_needs: c.synthesis.specialNeeds,
          pedagogical_recommendations: c.synthesis.pedagogicalRecommendations
            ? {
                office_tools_reinforcement: c.synthesis.pedagogicalRecommendations.officeToolsReinforcement,
                written_communication_support: c.synthesis.pedagogicalRecommendations.writtenCommunicationSupport,
                oral_confidence_development: c.synthesis.pedagogicalRecommendations.oralConfidenceDevelopment,
                time_management_support: c.synthesis.pedagogicalRecommendations.timeManagementSupport,
                professional_posture_work: c.synthesis.pedagogicalRecommendations.professionalPostureWork,
                enhanced_company_immersion: c.synthesis.pedagogicalRecommendations.enhancedCompanyImmersion,
                psh_specific_support: c.synthesis.pedagogicalRecommendations.pshSpecificSupport,
                individual_follow_up: c.synthesis.pedagogicalRecommendations.individualFollowUp,
                language_training: c.synthesis.pedagogicalRecommendations.languageTraining,
                stress_management_follow_up: c.synthesis.pedagogicalRecommendations.stressManagementFollowUp,
              }
            : undefined,
          other_recommendations: c.synthesis.otherRecommendations,
          location: c.synthesis.location,
          date: c.synthesis.date,
          recruiter_signature: c.synthesis.recruiterSignature,
          candidate_signature: c.synthesis.candidateSignature,
        }
      : undefined,
    pdf_link: c.pdfLink,
    cv_link: c.cvLink,
    drive_folder_id: c.driveFolderId,
  }
}

/** Maps frontend Candidate (snake_case) → GraphQL UpdateCandidateInput (camelCase) for mutation */
function toGqlUpdateInput(c: Candidate): any {
  return {
    tpType: c.tp_type,
    status: frontStatusToGql(c.status),
    ...(c.training_site !== undefined && { trainingSite: c.training_site }),
    identity: {
      fullName: c.identity.full_name,
      email: c.identity.email,
      phone: c.identity.phone,
      ...(c.identity.driving_license_b !== undefined && { drivingLicenseB: c.identity.driving_license_b }),
      ...(c.identity.age !== undefined && { age: c.identity.age }),
      ...(c.identity.city !== undefined && { city: c.identity.city }),
    },
    ...(c.education && {
      education: {
        ...(c.education.school_level !== undefined && { schoolLevel: c.education.school_level }),
      },
    }),
    ...(c.profile && {
      profile: {
        ...(c.profile.french_level !== undefined && { frenchLevel: c.profile.french_level }),
        ...(c.profile.english_level !== undefined && { englishLevel: c.profile.english_level }),
        ...(c.profile.qualities !== undefined && { qualities: c.profile.qualities }),
      },
    }),
    ...(c.professional_projects && {
      professionalProjects: {
        ...(c.professional_projects.career_objectives !== undefined && {
          careerObjectives: c.professional_projects.career_objectives,
        }),
        ...(c.professional_projects.apprenticeship_motivation !== undefined && {
          apprenticeshipMotivation: c.professional_projects.apprenticeship_motivation,
        }),
      },
    }),
  }
}

/**
 * Fetches candidates from the dedicated MongoDB GraphQL endpoint.
 * Returns { candidates, loading, error, refetch }.
 */
export function useCandidates() {
  const [result, reexecuteQuery] = useQuery({
    query: GET_CANDIDATES,
    context: { url: `${import.meta.env.VITE_API_URL}/api/graphql/candidates` },
  })

  const candidates: Candidate[] = (result.data?.candidates ?? []).map(fromGql)

  return {
    candidates,
    loading: result.fetching,
    error: result.error?.message ?? null,
    refetch: () => reexecuteQuery({ requestPolicy: 'network-only' }),
  }
}

/**
 * Fetches a cursor-paginated page of candidates from the dedicated MongoDB GraphQL endpoint.
 * Returns { candidates, pageInfo, loading, error, refetch }.
 */
export function useCandidatesPage(first?: number, after?: string, search?: string, filters?: CandidateServerFilters) {
  const [result, reexecuteQuery] = useQuery({
    query: GET_CANDIDATES_PAGE,
    variables: { first, after, search, filters },
    context: { url: `${import.meta.env.VITE_API_URL}/api/graphql/candidates` },
    requestPolicy: 'network-only',
  })

  const candidates: Candidate[] = (result.data?.candidatesPage?.edges ?? []).map((edge: { node: Record<string, unknown> }) => fromGql(edge.node))
  const pageInfo: PageInfo | undefined = result.data?.candidatesPage?.pageInfo

  return {
    candidates,
    pageInfo,
    loading: result.fetching,
    error: result.error?.message ?? null,
    refetch: () => reexecuteQuery({ requestPolicy: 'network-only' }),
  }
}

export function useUpdateCandidate() {
  const update = async (id: string, input: Candidate) => {
    const result = await candidateGraphqlClient.mutation(UPDATE_CANDIDATE, {
      id,
      input: toGqlUpdateInput(input),
    })
    console.log(result.data);
    return fromGql(result.data?.updateCandidate)
  }

  return { update }
}

interface CreateCandidateInput {
  tpType: string
  status: string
  identity: { fullName: string; email: string; phone: string; [key: string]: any }
  education?: { schoolLevel?: string | null; [key: string]: any } | null
  trainingSite?: string | null
  [key: string]: any
}

export function useCreateCandidate() {
  const [fetching, setFetching] = useState(false)

  const createCandidate = async (input: CreateCandidateInput) => {
    setFetching(true)
    const result = await candidateGraphqlClient.mutation(CREATE_CANDIDATE, { input })
    setFetching(false)
    return result
  }

  return { createCandidate, result: { fetching } }
}

export function useCandidateById(id: string) {
  const [result] = useQuery({
    query: GET_CANDIDATE_BY_ID,
    variables: { id },
    context: { url: `${import.meta.env.VITE_API_URL}/api/graphql/candidates` },
    pause: !id,
  })

  const candidate: Candidate | null = result.data?.candidate ? fromGql(result.data.candidate) : null

  return {
    candidate,
    loading: result.fetching,
    error: result.error?.message ?? null,
  }
}

export function useCandidateFull(id: string) {
  const [result, reexecute] = useQuery({
    query: GET_CANDIDATE_FULL,
    variables: { id },
    context: { url: `${import.meta.env.VITE_API_URL}/api/graphql/candidates` },
    pause: !id,
  })

  const candidate: Candidate | null = result.data?.candidate ? fromGql(result.data.candidate) : null

  return {
    candidate,
    loading: result.fetching,
    error: result.error?.message ?? null,
    refetch: () => reexecute({ requestPolicy: 'network-only' }),
  }
}

export function useCreateCandidateDriveFolder() {
  const [fetching, setFetching] = useState(false)

  const createDriveFolder = async (id: string): Promise<{ pdfLink?: string; driveFolderId?: string } | null> => {
    setFetching(true)
    try {
      const response = await candidateGraphqlClient.mutation(CREATE_CANDIDATE_DRIVE_FOLDER, { id })
      if (response.error) throw new Error(response.error.message)
      return response.data?.createCandidateDriveFolder ?? null
    } finally {
      setFetching(false)
    }
  }

  return { createDriveFolder, result: { fetching } }
}

export function useCreateNeedsAnalysis() {
  const [result, executeMutation] = useMutation(CREATE_NEEDS_ANALYSIS)

  const createNeedsAnalysis = (input: any) => {
    return executeMutation({ input }).then((response) => {
      if (response.error) {
        console.error("createNeedsAnalysis failed:", response.error)
      }
      return response
    })
  }

  return { createNeedsAnalysis, result }
}

export function useNeedsAnalysesByCompany(companyID: number | null) {
  const [result, reexecuteQuery] = useQuery({
    query: GET_NEEDS_ANALYSES_BY_COMPANY,
    variables: { companyID: companyID ?? 0 },
    pause: companyID === null,
  })
  return { ...result, refetch: () => reexecuteQuery({ requestPolicy: 'network-only' }) }
}

export function useCompanyHistory(companyID: number | null) {
  const [result, reexecuteQuery] = useQuery({
    query: GET_COMPANY_HISTORY,
    variables: { companyID: companyID ?? 0 },
    pause: companyID === null,
  })
  return { ...result, refetch: () => reexecuteQuery({ requestPolicy: 'network-only' }) }
}

export function useNeedsAnalysis(id: number | null) {
  const [result] = useQuery({
    query: GET_NEEDS_ANALYSIS,
    variables: { id: id ?? 0 },
    pause: id === null,
  })
  return result
}

export function useDeleteNeedsAnalysis() {
  const [result, executeMutation] = useMutation(DELETE_NEEDS_ANALYSIS)

  const deleteNeedsAnalysis = (id: number) => {
    return executeMutation({ id }).then((response) => {
      if (response.error) {
        console.error('deleteNeedsAnalysis failed:', response.error)
      }
      return response
    })
  }

  return { deleteNeedsAnalysis, result }
}
