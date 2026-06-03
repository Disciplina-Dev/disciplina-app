import { gql } from 'urql'

export const GET_SALE_PERSONS = gql`
  query GetSalePersons {
    salePersons {
      id
      email
      name
    }
  }
`

export const GET_SALE_PERSON = gql`
  query GetSalePerson($id: Int!) {
    salePerson(id: $id) {
      id
      email
      name
    }
  }
`

export const GET_COMPANIES = gql`
  query GetCompanies {
    companies {
      company {
        id
        userID
        legalReferent
        name
        phone
        email
        address
        sector
        mainActivity
        siret
        idcc
        ape
        notes
        conclusion
      }
      salePerson {
        id
        email
        name
      }
    }
  }
`

export const GET_COMPANY_BY_SIRET = gql`
  query GetCompanyBySiret($siret: String!) {
    companyBySiret(siret: $siret) {
      id
      userID
      name
      phone
      email
      address
      sector
      mainActivity
      siret
      idcc
      ape
      notes
      conclusion
    }
  }
`

export const GET_COMPANIES_BY_COMMERCIAL = gql`
  query GetCompaniesByCommercial($userID: Int!) {
    companyByCommercial(userID: $userID) {
      company {
        id
        userID
        name
        phone
        email
        address
        sector
        mainActivity
        siret
        idcc
        ape
        notes
        conclusion
      }
      salePerson {
        id
        email
        name
      }
    }
  }
`

export const CREATE_COMPANY = gql`
  mutation CreateCompany($input: CompanyInput!) {
    createCompany(input: $input) {
      id
      userID
      legalReferent
      name
      phone
      email
      address
      sector
      mainActivity
      siret
      idcc
      ape
      notes
      conclusion
    }
  }
`

export const UPDATE_COMPANY = gql`
  mutation UpdateCompany($id: Int!, $input: CompanyInput!) {
    updateCompany(id: $id, input: $input) {
      id
      userID
      legalReferent
      name
      phone
      email
      address
      sector
      mainActivity
      siret
      idcc
      ape
      notes
      conclusion
    }
  }
`

export const DELETE_COMPANY = gql`
  mutation DeleteCompany($id: Int!) {
    deleteCompany(id: $id)
  }
`

// ─── Candidats (MongoDB) ─────────────────────────────────────────────────────

export const GET_CANDIDATES = gql`
  query GetCandidates {
    candidates {
      id
      status
      tpType
      trainingSite
      skillsAssessment {
        competence
        level
      }
      identity {
        fullName
        email
        phone
        drivingLicenseB
        age
        city
      }
      education {
        schoolLevel
      }
      profile {
        frenchLevel
        englishLevel
        qualities
      }
      synthesis {
        feasibilityConclusion
      }
      professionalProjects {
        careerObjectives
        apprenticeshipMotivation
      }
      background {
        lastDiploma
      }
      pdfLink
    }
  }
`

export const GET_CANDIDATE_BY_ID = gql`
  query GetCandidateById($id: String!) {
    candidate(id: $id) {
      id
      status
      tpType
      trainingSite
      identity {
        fullName
        email
        phone
        age
        city
        postalCode
        drivingLicenseB
      }
      education {
        schoolLevel
      }
      background {
        lastDiploma
        professionalExperiences {
          position
          company
          duration
        }
      }
      profile {
        frenchLevel
        englishLevel
        qualities
        digitalSkills
      }
      professionalProjects {
        careerObjectives
        apprenticeshipMotivation
      }
      synthesis {
        feasibilityConclusion
      }
      skillsAssessment {
        competence
        level
      }
      jobInfo {
        availabilityDate
        geographicMobility
      }
      pdfLink
    }
  }
`

export const UPDATE_CANDIDATE = gql`
  mutation UpdateCandidate($id: String!, $input: UpdateCandidateInput!) {
    updateCandidate(id: $id, input: $input) {
      id
      status
      tpType
      trainingSite
      skillsAssessment {
        competence
        level
      }
      identity {
        fullName
        email
        phone
        drivingLicenseB
        age
      }
      education {
        schoolLevel
      }
      profile {
        frenchLevel
        englishLevel
        qualities
      }
      synthesis {
        feasibilityConclusion
      }
      professionalProjects {
        careerObjectives
        apprenticeshipMotivation
      }
      background {
        lastDiploma
      }
      pdfLink
    }
  }
`

export const CREATE_CANDIDATE = gql`
  mutation CreateCandidate($input: CreateCandidateInput!) {
    createCandidate(input: $input) {
      id
      status
      tpType
      trainingSite
      skillsAssessment {
        competence
        level
      }
      identity {
        fullName
        email
        phone
        drivingLicenseB
        age
      }
      education {
        schoolLevel
      }
      profile {
        frenchLevel
        englishLevel
        qualities
      }
      synthesis {
        feasibilityConclusion
      }
      professionalProjects {
        careerObjectives
        apprenticeshipMotivation
      }
      background {
        lastDiploma
      }
      pdfLink
    }
  }
`

export const GET_CANDIDATE_FULL = gql`
  query GetCandidateFull($id: String!) {
    candidate(id: $id) {
      id
      status
      tpType
      trainingSite
      immersionAgreement
      desiredSectors
      expectedCompanySkills
      identity {
        fullName
        email
        phone
        dateOfBirth
        placeOfBirth
        age
        postalCode
        city
        drivingLicenseB
        transportMeans
        pshReferralRequest
      }
      education { schoolLevel justification }
      support {
        franceTravailRegistered
        franceTravailAgency
        missionLocaleRegistered
        missionLocaleCity
      }
      background {
        lastDiploma
        previousTrainings
        professionalExperiences { position duration responsibilities company }
      }
      profile {
        frenchLevel
        englishLevel
        otherLanguages
        strengthsAndImprovements
        qualities
        defects
        digitalSkills
        readyForChallenges
        hobbies
      }
      professionalProjects {
        careerObjectives
        desiredSkills
        apprenticeshipMotivation
        trainingExpectations
      }
      skillsAssessment { competence level }
      jobInfo {
        domainMotivation
        questionsConcerns
        availabilityDate
        geographicMobility
        weekendWork
        discoverySource
      }
      synthesis {
        feasibilityConclusion
        pathwayRelevance
        specialNeeds
        pedagogicalRecommendations {
          officeToolsReinforcement
          writtenCommunicationSupport
          oralConfidenceDevelopment
          timeManagementSupport
          professionalPostureWork
          enhancedCompanyImmersion
          pshSpecificSupport
          individualFollowUp
          languageTraining
          stressManagementFollowUp
        }
        otherRecommendations
        location
        date
      }
      pdfLink
    }
  }
`

export const UPDATE_CANDIDATE_FULL = gql`
  mutation UpdateCandidateFull($id: String!, $input: UpdateCandidateInput!) {
    updateCandidate(id: $id, input: $input) {
      id
      status
      tpType
    }
  }
`

// ─── Authentication ──────────────────────────────────────────────────────────

export const LOGIN_USER = gql`
  mutation LoginUser($email: String!, $passwordPlain: String!) {
    login(email: $email, passwordPlain: $passwordPlain) {
      token
      user {
        id
        email
        name
        role
        sectors
      }
    }
  }
`

export const REGISTER_USER = gql`
  mutation RegisterUser(
    $email: String!
    $name: String!
    $passwordPlain: String!
    $role: Role!
    $sectors: [String!]
  ) {
    register(
      email: $email
      name: $name
      passwordPlain: $passwordPlain
      role: $role
      sectors: $sectors
    ) {
      id
      email
      name
      role
      sectors
    }
  }
`

// ─── Jobs / Matching ─────────────────────────────────────────────────────────

export const GET_JOBS = gql`
  query GetJobs {
    jobs {
      id
      companyName
      ageRange
    }
  }
`

export const MATCH_JOB = gql`
  query MatchJob($id: String!) {
    matchJob(id: $id) {
      id
      companyName
      ageRange
      matchedCandidate {
        id
        fullName
        age
        sex
        city
        email
        phone
      }
    }
  }
`

export const CREATE_NEEDS_ANALYSIS = gql`
  mutation CreateNeedsAnalysis($input: NeedsAnalysisInput!) {
    createNeedsAnalysis(input: $input) {
      id
      companyID
      userID
      recruitmentResponsibleName
      recruitmentResponsiblePhone
      recruitmentResponsibleEmail
      positionsCount
      localisation
      trainingDomain
      jobTitle
      selectedMissions
      otherMissions
      educationLevel
      drivingLicense
      experienceRequired
      ageRequirements
      softSkills
      recruitmentMethod
      immersionPeriod
      trainingDays
      yousignSignatureRequestID
      status
      createdAt
      updatedAt
    }
  }
`


export const GET_NEEDS_ANALYSES_BY_COMPANY = gql`
  query NeedsAnalysesByCompany($companyID: Int!) {
    needsAnalysesByCompany(companyID: $companyID) {
      id
      jobTitle
      positionsCount
      status
      createdAt
    }
  }
`

export const GET_NEEDS_ANALYSIS = gql`
  query NeedsAnalysis($id: Int!) {
    needsAnalysis(id: $id) {
      id
      companyID
      userID
      recruitmentResponsibleName
      recruitmentResponsiblePhone
      recruitmentResponsibleEmail
      positionsCount
      localisation
      trainingDomain
      jobTitle
      selectedMissions
      otherMissions
      educationLevel
      drivingLicense
      experienceRequired
      ageRequirements
      softSkills
      recruitmentMethod
      immersionPeriod
      trainingDays
      yousignSignatureRequestID
      status
      createdAt
      updatedAt
    }
  }
`
