import { useEffect, useState } from 'react'
import { useQuery, useMutation, useClient } from 'urql'
import { usePortefeuilleStore } from '@/store/portefeuilleStore'
import { useBlacklistStore } from '@/store/blacklistStore'
import { useQuarantineStore } from '@/store/quarantineStore'
import {
  GET_COMPANIES,
  GET_COMPANY_BY_SIRET,
  GET_SALE_PERSONS,
  CREATE_COMPANY,
  UPDATE_COMPANY,
  DELETE_COMPANY,
  BLACKLIST_COMPANY,
  UNBLACKLIST_COMPANY,
  UPDATE_COMPANY_CONFLICT,
  RESOLVE_COMPANY_CONFLICT,
  DELETE_COMPANY_CONFLICT,
  DELETE_COMPANY_CONFLICTS_BY_TYPE,
  GET_CANDIDATES,
  GET_CANDIDATE_STATS,
  GET_CANDIDATES_PAGE,
  GET_CANDIDATE_BY_ID,
  GET_CANDIDATE_FULL,
  UPDATE_CANDIDATE,
  CREATE_CANDIDATE,
  CREATE_CANDIDATE_DRIVE_FOLDER,
  CREATE_NEEDS_ANALYSIS,
  GET_NEEDS_ANALYSES_BY_COMPANY,
  GET_NEEDS_ANALYSES_PAGE,
  NEEDS_ANALYSES_FOR_DASHBOARD,
  GET_NEEDS_ANALYSIS,
  DELETE_NEEDS_ANALYSIS,
  UPDATE_NEEDS_ANALYSIS,
  UPDATE_NEEDS_ANALYSIS_AB_STATUS,
  GET_COMPANY_HISTORY,
  GET_CONTACT_LOGS,
  GET_CONTACT_LOG_STATS,
  CREATE_CONTACT_LOG,
  GET_CANDIDATE_HISTORY,
  ADD_CANDIDATE_HISTORY_ENTRY,
  DELETE_CANDIDATE_HISTORY_ENTRY,
  GET_OFFER_HISTORY,
  ADD_OFFER_HISTORY_ENTRY,
  DELETE_OFFER_HISTORY_ENTRY,
  DELETE_CANDIDATE,
} from '@/graphql/queries'
import type { Candidate, CandidateHistoryEntry } from '@/types/candidate'
import { apiJson } from '@/api/httpClient'
import type { PageInfo } from '@/types/pagination'
import type { NeedsAnalysis } from '@/types/needsAnalysis'
import type { OfferFilterInput } from '@/features/matching/services/jobFilters'
import { CandidateStatus, TitleProfessionalType, SchoolLevel, TrainingSite } from '@/types/candidate'

export interface CandidateServerFilters {
  trainingSite?: TrainingSite
  status?: CandidateStatus
  statusIn?: CandidateStatus[]
  schoolLevel?: SchoolLevel
  drivingLicenseB?: boolean
  /** Sexe du candidat (FILLE / GARCON), exclusif. */
  sex?: string
  ageMin?: number
  ageMax?: number
  tpType?: TitleProfessionalType[]
  /** Villes de mobilité géographique souhaitées (OR). */
  geographicMobility?: string[]
  /** Secteurs d'activité souhaités (OR). */
  desiredSectors?: string[]
  /** Bornes de date de création (ISO yyyy-mm-dd), incluses. */
  createdAfter?: string
  createdBefore?: string
  /** Ne renvoyer que les fiches sans date de création. */
  createdMissing?: boolean
  /** Filtrer par le RH qui a mené l'entretien (nom complet). */
  interviewedBy?: string
}
import { candidateGraphqlClient, offerGraphqlClient, NEEDS_ANALYSIS_URL } from './client'

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
        commercial: c.salePerson ? `${c.salePerson.firstName ?? ''} ${c.salePerson.lastName ?? ''}`.trim() || null : null,
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
  const client = useClient()
  const [result, setResult] = useState<{ data?: any; error?: any; fetching: boolean }>({
    data: undefined, error: undefined, fetching: false,
  })

  const searchBySiret = (siret: string) => {
    if (!siret || siret.trim() === '') return
    setResult({ data: undefined, error: undefined, fetching: true })
    client
      .query(GET_COMPANY_BY_SIRET, { siret }, { requestPolicy: 'network-only' })
      .toPromise()
      .then((res) => setResult({ data: res.data, error: res.error, fetching: false }))
      .catch((err) => setResult({ data: undefined, error: err, fetching: false }))
  }

  return { result, searchBySiret }
}

export function useCreateCompany() {
  const addCompany = usePortefeuilleStore((s) => s.addCompany)
  const [result, executeMutation] = useMutation(CREATE_COMPANY)

  const createCompany = (input: any) => {
    return executeMutation({ input }).then((response) => {
      if (response.error) {
      }
      if (response.data?.createCompany) {
        const salePersons = usePortefeuilleStore.getState().salePersons;
        const salePerson = salePersons.find((sp) => sp.id === response.data.createCompany.userID);

        const company = {
          id: String(response.data.createCompany.id),
          nom_commercial: response.data.createCompany.name,
          proprietaire_contact: salePerson?.email || null,
          commercial: salePerson ? `${salePerson.firstName ?? ''} ${salePerson.lastName ?? ''}`.trim() || null : null,
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
          relance_channel: response.data.createCompany.relanceChannel ?? null,
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
    return executeMutation({ id, input }).then((response) => {
      if (response.error) {
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
          commercial: salePerson ? `${salePerson.firstName ?? ''} ${salePerson.lastName ?? ''}`.trim() || null : null,
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

export function useUpdateCompanyConflict() {
  const updateCompany = useQuarantineStore((s) => s.updateCompany)
  const [result, executeMutation] = useMutation(UPDATE_COMPANY_CONFLICT)

  const updateCompanyConflict = (id: number, input: Record<string, unknown>) => {
    return executeMutation({ id, input }).then((response) => {
      const updated = response.data?.updateCompanyConflict
      if (updated) {
        updateCompany(String(id), {
          nom_commercial: updated.name,
          representant_legal: updated.legalReferent,
          telephone: updated.phone,
          email: updated.email,
          adresse: updated.address,
          secteur: updated.sector,
          metier: updated.mainActivity,
          siret: updated.siret,
          idcc: updated.idcc,
          note: updated.notes,
          conclusion: updated.conclusion,
          proprietaire_id: updated.userID ?? null,
        })
      }
      return response
    })
  }

  return { updateCompanyConflict, result }
}

export function useResolveCompanyConflict() {
  const removeCompany = useQuarantineStore((s) => s.removeCompany)
  const [result, executeMutation] = useMutation(RESOLVE_COMPANY_CONFLICT)

  const resolveCompanyConflict = (id: number) => {
    return executeMutation({ id }).then((response) => {
      if (response.data?.resolveCompanyConflict) {
        removeCompany(String(id))
      }
      return response
    })
  }

  return { resolveCompanyConflict, result }
}

export function useDeleteCompanyConflict() {
  const removeCompany = useQuarantineStore((s) => s.removeCompany)
  const [result, executeMutation] = useMutation(DELETE_COMPANY_CONFLICT)

  const deleteCompanyConflict = (id: number) => {
    return executeMutation({ id }).then((response) => {
      if (response.data?.deleteCompanyConflict) {
        removeCompany(String(id))
      }
      return response
    })
  }

  return { deleteCompanyConflict, result }
}

export function useDeleteCompanyConflictsByType() {
  const removeByConflictType = useQuarantineStore((s) => s.removeByConflictType)
  const [result, executeMutation] = useMutation(DELETE_COMPANY_CONFLICTS_BY_TYPE)

  const deleteCompanyConflictsByType = (conflictType: string) => {
    return executeMutation({ conflictType }).then((response) => {
      if (typeof response.data?.deleteCompanyConflictsByType === 'number') {
        removeByConflictType(conflictType)
      }
      return response
    })
  }

  return { deleteCompanyConflictsByType, result }
}

// ─── Candidats (MongoDB) ─────────────────────────────────────────────────────

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
    owner: c.owner
      ? { user_id: c.owner.userId, name: c.owner.name, sector: c.owner.sector ?? undefined }
      : undefined,
    tp_types: (c.tpTypes?.length ? c.tpTypes : c.tpType ? [c.tpType] : []).map(mapTpType),
    status: c.status as CandidateStatus,
    training_site: c.trainingSite,
    training_sites: c.trainingSites ?? (c.trainingSite ? [c.trainingSite] : []),
    immersion_agreement: c.immersionAgreement,
    immersion_start_date: c.immersionStartDate ?? undefined,
    immersion_end_date: c.immersionEndDate ?? undefined,
    immersion_company_id: c.immersionCompanyId ?? undefined,
    immersion_company_name: c.immersionCompanyName ?? undefined,
    contract_offer_id: c.contractOfferId ?? undefined,
    contract_company_id: c.contractCompanyId ?? undefined,
    contract_company_name: c.contractCompanyName ?? undefined,
    contract_start_date: c.contractStartDate ?? undefined,
    desired_sectors: c.desiredSectors,
    expected_company_skills: c.expectedCompanySkills,
    identity: {
      full_name: c.identity.fullName,
      social_security_number: c.identity.socialSecurityNumber,
      email: c.identity.email,
      phone: c.identity.phone,
      date_of_birth: c.identity.dateOfBirth,
      place_of_birth: c.identity.placeOfBirth,
      age: c.identity.age,
      sex: c.identity.sex,
      address: c.identity.address,
      postal_code: c.identity.postalCode,
      city: c.identity.city,
      driving_license_b: c.identity.drivingLicenseB,
      has_vehicle: c.identity.hasVehicle,
      transport_means: c.identity.transportMeans,
      psh_referral_request: c.identity.pshReferralRequest,
      had_apprenticeship_contract: c.identity.hadApprenticeshipContract,
      apprenticeship_contract_details: c.identity.apprenticeshipContractDetails,
      description: c.identity.description,
      avatar_updated_at: c.identity.avatarUpdatedAt,
      drive_avatar_file_id: c.identity.driveAvatarFileId,
      avatar_url: (c.identity.avatarUpdatedAt || c.identity.driveAvatarFileId)
        ? `${import.meta.env.VITE_API_URL}/api/candidates/${c.id}/avatar?v=${encodeURIComponent(c.identity.avatarUpdatedAt ?? c.identity.driveAvatarFileId)}`
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
          last_diploma_prepared: c.background.lastDiplomaPrepared,
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
    photo_link: c.photoLink,
    filiz_folder_id: c.filizFolderId,
    created_at: c.createdAt,
    last_relance_at: c.lastRelanceAt ?? undefined,
    relance_response_at: c.relanceResponseAt ?? undefined,
    emergency_contact: c.emergencyContact
      ? {
          last_name: c.emergencyContact.lastName ?? undefined,
          first_name: c.emergencyContact.firstName ?? undefined,
          relationship: c.emergencyContact.relationship ?? undefined,
          phone: c.emergencyContact.phone ?? undefined,
          email: c.emergencyContact.email ?? undefined,
        }
      : undefined,
    consentments: c.consentments
      ? {
          data_processing: c.consentments.dataProcessing,
          data_sharing: c.consentments.dataSharing,
          ai_processing: c.consentments.aiProcessing,
          photo_processing: c.consentments.photoProcessing,
          consent_date: c.consentments.consentDate,
          consent_version: c.consentments.consentVersion,
        }
      : undefined,
  }
}

/** Maps frontend Candidate (snake_case) → GraphQL UpdateCandidateInput (camelCase) for mutation */
function toGqlUpdateInput(c: Candidate): any {
  return {
    ...(c.tp_types !== undefined && { tpTypes: c.tp_types }),
    status: c.status,
    ...(c.training_sites !== undefined && { trainingSites: c.training_sites }),
    ...(c.immersion_start_date !== undefined && { immersionStartDate: c.immersion_start_date }),
    ...(c.immersion_end_date !== undefined && { immersionEndDate: c.immersion_end_date }),
    ...(c.immersion_company_id !== undefined && { immersionCompanyId: c.immersion_company_id }),
    ...(c.immersion_company_name !== undefined && { immersionCompanyName: c.immersion_company_name }),
    ...(c.contract_offer_id !== undefined && { contractOfferId: c.contract_offer_id }),
    ...(c.contract_company_id !== undefined && { contractCompanyId: c.contract_company_id }),
    ...(c.contract_company_name !== undefined && { contractCompanyName: c.contract_company_name }),
    ...(c.contract_start_date !== undefined && { contractStartDate: c.contract_start_date }),
    identity: {
      fullName: c.identity.full_name,
      email: c.identity.email,
      phone: c.identity.phone,
      ...(c.identity.social_security_number !== undefined && { socialSecurityNumber: c.identity.social_security_number }),
      ...(c.identity.driving_license_b !== undefined && { drivingLicenseB: c.identity.driving_license_b }),
      ...(c.identity.has_vehicle !== undefined && { hasVehicle: c.identity.has_vehicle }),
      ...(c.identity.age !== undefined && { age: c.identity.age }),
      ...(c.identity.sex !== undefined && { sex: c.identity.sex }),
      ...(c.identity.address !== undefined && { address: c.identity.address }),
      ...(c.identity.city !== undefined && { city: c.identity.city }),
      ...(c.identity.description !== undefined && { description: c.identity.description }),
      ...(c.identity.had_apprenticeship_contract !== undefined && {
        hadApprenticeshipContract: c.identity.had_apprenticeship_contract,
      }),
    },
    ...(c.job_info?.availability_date !== undefined && {
      jobInfo: { availabilityDate: c.job_info.availability_date },
    }),
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
    ...(c.synthesis && {
      synthesis: {
        ...(c.synthesis.feasibility_conclusion !== undefined && {
          feasibilityConclusion: c.synthesis.feasibility_conclusion,
        }),
        ...(c.synthesis.pathway_relevance !== undefined && { pathwayRelevance: c.synthesis.pathway_relevance }),
        ...(c.synthesis.special_needs !== undefined && { specialNeeds: c.synthesis.special_needs }),
        ...(c.synthesis.other_recommendations !== undefined && {
          otherRecommendations: c.synthesis.other_recommendations,
        }),
        ...(c.synthesis.pedagogical_recommendations && {
          pedagogicalRecommendations: {
            officeToolsReinforcement: !!c.synthesis.pedagogical_recommendations.office_tools_reinforcement,
            writtenCommunicationSupport: !!c.synthesis.pedagogical_recommendations.written_communication_support,
            oralConfidenceDevelopment: !!c.synthesis.pedagogical_recommendations.oral_confidence_development,
            timeManagementSupport: !!c.synthesis.pedagogical_recommendations.time_management_support,
            professionalPostureWork: !!c.synthesis.pedagogical_recommendations.professional_posture_work,
            enhancedCompanyImmersion: !!c.synthesis.pedagogical_recommendations.enhanced_company_immersion,
            pshSpecificSupport: !!c.synthesis.pedagogical_recommendations.psh_specific_support,
            individualFollowUp: !!c.synthesis.pedagogical_recommendations.individual_follow_up,
            languageTraining: !!c.synthesis.pedagogical_recommendations.language_training,
            stressManagementFollowUp: !!c.synthesis.pedagogical_recommendations.stress_management_follow_up,
          },
        }),
      },
    }),
  }
}

/**
 * Fetches candidates from the dedicated MongoDB GraphQL endpoint.
 * Returns { candidates, loading, error, refetch }.
 */
export interface StatBucket {
  key: string
  count: number
}

export interface TpStatusBucket {
  tpType: string
  status: string
  count: number
}

export interface CandidateStats {
  total: number
  byStatus: StatBucket[]
  byTpType: StatBucket[]
  byTrainingSite: StatBucket[]
  byTpAndStatus: TpStatusBucket[]
}

/** Statistiques agrégées des candidats (endpoint MongoDB dédié). `sectors` filtre par secteur du créateur. */
export function useCandidateStats(sectors?: string[]) {
  const [result, reexecuteQuery] = useQuery({
    query: GET_CANDIDATE_STATS,
    variables: { sectors: sectors && sectors.length > 0 ? sectors : undefined },
    context: { url: `${import.meta.env.VITE_API_URL}/api/graphql/candidates` },
  })

  return {
    stats: (result.data?.candidateStats as CandidateStats | undefined) ?? null,
    loading: result.fetching,
    error: result.error?.message ?? null,
    refetch: () => reexecuteQuery({ requestPolicy: 'network-only' }),
  }
}

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

export type CandidateSearchField = 'NAME' | 'PHONE' | 'EMAIL';

/**
 * Fetches a cursor-paginated page of candidates from the dedicated MongoDB GraphQL endpoint.
 * Returns { candidates, pageInfo, totalCount, loading, error, refetch }.
 */
export function useCandidatesPage(first?: number, after?: string, search?: string, filters?: CandidateServerFilters, searchField?: CandidateSearchField) {
  const [result, reexecuteQuery] = useQuery({
    query: GET_CANDIDATES_PAGE,
    variables: { first, after, search, searchField, filters },
    context: { url: `${import.meta.env.VITE_API_URL}/api/graphql/candidates` },
    requestPolicy: 'network-only',
  })

  const candidates: Candidate[] = (result.data?.candidatesPage?.edges ?? []).map((edge: { node: Record<string, unknown> }) => fromGql(edge.node))
  const pageInfo: PageInfo | undefined = result.data?.candidatesPage?.pageInfo
  const totalCount: number = result.data?.candidatesPage?.totalCount ?? 0

  return {
    candidates,
    pageInfo,
    totalCount,
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
    return fromGql(result.data?.updateCandidate)
  }

  return { update }
}

interface CreateCandidateInput {
  tpTypes: string[]
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
  const [result, reexecuteQuery] = useQuery({
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
    refetch: () => reexecuteQuery({ requestPolicy: 'network-only' }),
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

export function useCandidateHistory(candidateId: string | null) {
  const [result, reexecuteQuery] = useQuery({
    query: GET_CANDIDATE_HISTORY,
    variables: { candidateId: candidateId ?? '' },
    context: { url: `${import.meta.env.VITE_API_URL}/api/graphql/candidates` },
    pause: candidateId === null,
  })

  const history: CandidateHistoryEntry[] = result.data?.candidateHistory ?? []

  return {
    history,
    loading: result.fetching,
    error: result.error?.message ?? null,
    refetch: () => reexecuteQuery({ requestPolicy: 'network-only' }),
  }
}

export function useAddCandidateHistoryEntry() {
  const addHistoryEntry = (candidateId: string, description: string) => {
    return candidateGraphqlClient.mutation(ADD_CANDIDATE_HISTORY_ENTRY, { candidateId, description })
  }

  return { addHistoryEntry }
}

export function useDeleteCandidateHistoryEntry() {
  const deleteHistoryEntry = (id: string) => {
    return candidateGraphqlClient.mutation(DELETE_CANDIDATE_HISTORY_ENTRY, { id })
  }

  return { deleteHistoryEntry }
}

export function useOfferHistory(offerId: string | null) {
  const [result, reexecuteQuery] = useQuery({
    query: GET_OFFER_HISTORY,
    variables: { offerId: offerId ?? '' },
    context: { url: `${import.meta.env.VITE_API_URL}/api/graphql/offers` },
    pause: offerId === null,
  })

  const history: any[] = result.data?.offerHistory ?? []

  return {
    history,
    loading: result.fetching,
    error: result.error?.message ?? null,
    refetch: () => reexecuteQuery({ requestPolicy: 'network-only' }),
  }
}

export function useAddOfferHistoryEntry() {
  const addEntry = (offerId: string, text: string) => {
    return offerGraphqlClient.mutation(ADD_OFFER_HISTORY_ENTRY, { offerId, text }).toPromise()
  }

  return { addEntry }
}

export function useDeleteOfferHistoryEntry() {
  const deleteEntry = (id: string) => {
    return offerGraphqlClient.mutation(DELETE_OFFER_HISTORY_ENTRY, { id }).toPromise()
  }

  return { deleteEntry }
}

export function useCreateNeedsAnalysis() {
  const [result, executeMutation] = useMutation(CREATE_NEEDS_ANALYSIS)

  const createNeedsAnalysis = (input: any) => {
    return executeMutation({ input }, { url: NEEDS_ANALYSIS_URL }).then((response) => {
      if (response.error) {
        console.error("createNeedsAnalysis failed:", response.error)
      }
      return response
    })
  }

  return { createNeedsAnalysis, result }
}

/**
 * Page paginée (curseur) de toutes les analyses de besoin — espace matching RH.
 * Retourne { items, pageInfo, loading, error, refetch }.
 */
export function useNeedsAnalysesPage(first?: number, after?: string, filter?: OfferFilterInput) {
  const [result, reexecuteQuery] = useQuery({
    query: GET_NEEDS_ANALYSES_PAGE,
    variables: { first, after, filter },
    context: { url: NEEDS_ANALYSIS_URL },
    requestPolicy: 'network-only',
  })

  const items: NeedsAnalysis[] = (result.data?.needsAnalysesPage?.edges ?? []).map(
    (edge: { node: NeedsAnalysis }) => edge.node,
  )
  const pageInfo: PageInfo | undefined = result.data?.needsAnalysesPage?.pageInfo

  return {
    items,
    pageInfo,
    loading: result.fetching,
    error: result.error?.message ?? null,
    refetch: () => reexecuteQuery({ requestPolicy: 'network-only' }),
  }
}

export function useNeedsAnalysesByCompany(companyID: number | null) {
  const [result, reexecuteQuery] = useQuery({
    query: GET_NEEDS_ANALYSES_BY_COMPANY,
    variables: { companyID: companyID ?? 0 },
    pause: companyID === null,
    context: { url: NEEDS_ANALYSIS_URL },
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

export function useContactLogs(companyID: number | null) {
  const [result, reexecuteQuery] = useQuery({
    query: GET_CONTACT_LOGS,
    variables: { companyID: companyID ?? 0 },
    pause: companyID === null,
  })
  return { ...result, refetch: () => reexecuteQuery({ requestPolicy: 'network-only' }) }
}

export function useContactLogStats(pause = false) {
  const [result, reexecuteQuery] = useQuery({
    query: GET_CONTACT_LOG_STATS,
    pause,
  })
  return { ...result, refetch: () => reexecuteQuery({ requestPolicy: 'network-only' }) }
}

export function useCreateContactLog() {
  const [result, executeMutation] = useMutation(CREATE_CONTACT_LOG)

  const createContactLog = (companyID: number, comment: string) => {
    return executeMutation({ companyID, comment }).then((response) => {
      if (response.error) {
        console.error('createContactLog failed:', response.error)
      }
      return response
    })
  }

  return { createContactLog, result }
}

export function useNeedsAnalysis(id: string | null) {
  const [result, reexecuteQuery] = useQuery({
    query: GET_NEEDS_ANALYSIS,
    variables: { id: id ?? 0 },
    pause: id === null,
    context: { url: NEEDS_ANALYSIS_URL },
  })
  return { ...result, refetch: () => reexecuteQuery({ requestPolicy: 'network-only' }) }
}

export function useUpdateNeedsAnalysisAbStatus() {
  const [result, executeMutation] = useMutation(UPDATE_NEEDS_ANALYSIS_AB_STATUS)

  const updateAbStatus = (id: string, abStatus: string | null) => {
    return executeMutation({ id, abStatus }, { url: NEEDS_ANALYSIS_URL })
  }

  return { updateAbStatus, result }
}

export function useDeleteNeedsAnalysis() {
  const [result, executeMutation] = useMutation(DELETE_NEEDS_ANALYSIS)

  const deleteNeedsAnalysis = (id: string) => {
    return executeMutation({ id }, { url: NEEDS_ANALYSIS_URL }).then((response) => {
      if (response.error) {
        console.error('deleteNeedsAnalysis failed:', response.error)
      }
      return response
    })
  }

  return { deleteNeedsAnalysis, result }
}

export function useUpdateNeedsAnalysis() {
  const [result, executeMutation] = useMutation(UPDATE_NEEDS_ANALYSIS)

  const updateNeedsAnalysis = (id: string, input: any) => {
    return executeMutation({ id, input }, { url: NEEDS_ANALYSIS_URL }).then((response) => {
      if (response.error) {
        console.error('updateNeedsAnalysis failed:', response.error)
      }
      return response
    })
  }

  return { updateNeedsAnalysis, result }
}

export function useDeleteCandidate() {
  const deleteCandidate = (id: string) =>
    candidateGraphqlClient.mutation(DELETE_CANDIDATE, { id })

  return { deleteCandidate }
}

export function useFilizDegrees() {
  const [degrees, setDegrees] = useState<{ degreeId: string; degreeType: string; exactDegreeTitle: string; preparedTitleName: string }[]>([])
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setFetching(true)
    apiJson<{ degrees?: typeof degrees }>('/api/filiz/degrees')
      .then(data => { setDegrees(data.degrees ?? []); setError(null) })
      .catch(err => setError(err.message))
      .finally(() => setFetching(false))
  }, [])

  return { degrees, fetching, error }
}

export function useFilizClasses(degreeId: string | null) {
  const [classes, setClasses] = useState<{ degreeId: string; classId: string; className: string; startDate?: string; endDate?: string }[]>([])
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!degreeId) { setClasses([]); return }
    setFetching(true)
    apiJson<{ classes?: typeof classes }>(`/api/filiz/classes?degreeId=${encodeURIComponent(degreeId)}`)
      .then(data => { setClasses(data.classes ?? []); setError(null) })
      .catch(err => setError(err.message))
      .finally(() => setFetching(false))
  }, [degreeId])

  return { classes, fetching, error }
}

export function useCreateFilizFolder() {
  const createFilizFolder = async (body: {
    candidateId: string
    classId: string
    fileManagerFirstName: string
    fileManagerLastName: string
    fileManagerEmail: string
  }): Promise<{ folderId: string }> =>
    apiJson<{ folderId: string }>('/api/filiz/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  return { createFilizFolder }
}

export interface NeedsAnalysisDashboardItem {
  id: string
  companyName: string | null
  positionsCount: number
  createdAt: string | null
  status: string
}

export function useNeedsAnalysesForDashboard(limit = 5) {
  const [result, reexecuteQuery] = useQuery({
    query: NEEDS_ANALYSES_FOR_DASHBOARD,
    variables: { limit },
    context: { url: NEEDS_ANALYSIS_URL },
    requestPolicy: 'network-only',
  })

  const items: NeedsAnalysisDashboardItem[] = (result.data?.needsAnalysesForDashboard?.items ?? []).map(
    (item: NeedsAnalysisDashboardItem) => item,
  )
  const totalCount: number = result.data?.needsAnalysesForDashboard?.totalCount ?? 0

  return {
    items,
    totalCount,
    loading: result.fetching,
    error: result.error?.message ?? null,
    refetch: () => reexecuteQuery({ requestPolicy: 'network-only' }),
  }
}
