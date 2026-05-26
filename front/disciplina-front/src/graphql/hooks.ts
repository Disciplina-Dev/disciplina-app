import { useEffect, useState } from 'react'
import { useQuery, useMutation } from 'urql'
import { usePortefeuilleStore } from '@/store/portefeuilleStore'
import {
  GET_COMPANIES,
  GET_SALE_PERSONS,
  CREATE_COMPANY,
  UPDATE_COMPANY,
  DELETE_COMPANY,
  GET_CANDIDATES,
  GET_CANDIDATE_BY_ID,
  GET_CANDIDATE_FULL,
  UPDATE_CANDIDATE,
  CREATE_CANDIDATE,
} from '@/graphql/queries'
import type { Candidate } from '@/types/candidate'
import { CandidateStatus, TitleProfessionalType, SchoolLevel, TrainingSite } from '@/types/candidate'
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
function gqlStatusToFront(raw: string): CandidateStatus {
  const map: Record<string, CandidateStatus> = {
    SEEKING: CandidateStatus.SEEKING,
    NOT_SEEKING: CandidateStatus.NOT_SEEKING,
    CANCELLED: CandidateStatus.CANCELLED,
    MATCHED: CandidateStatus.MATCHED,
    CONTRACTED: CandidateStatus.CONTRACTED,
    IMMERSING: CandidateStatus.MATCHED,
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
    [CandidateStatus.MATCHED]: 'IMMERSING',
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
    context: { url: 'http://localhost:4000/api/graphql/candidates' },
  })

  const candidates: Candidate[] = (result.data?.candidates ?? []).map(fromGql)

  return {
    candidates,
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
    context: { url: 'http://localhost:4000/api/graphql/candidates' },
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
    context: { url: 'http://localhost:4000/api/graphql/candidates' },
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
