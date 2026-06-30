import { gql } from 'urql'

export const GET_SALE_PERSONS = gql`
  query GetSalePersons {
    salePersons {
      id
      email
      firstName
      lastName
    }
  }
`

export const GET_SALE_PERSON = gql`
  query GetSalePerson($id: Int!) {
    salePerson(id: $id) {
      id
      email
      firstName
      lastName
    }
  }
`

export const GET_COMPANIES = gql`
  query GetCompanies($first: Int, $after: String, $search: String, $filters: CompanyFiltersInput) {
    companies(first: $first, after: $after, search: $search, filters: $filters) {
      edges {
        cursor
        node {
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
            status
            relanceDate
            createdAt
            relanceType
            relanceTemplateId
            relanceChannel
          }
          salePerson {
            id
            email
            firstName
            lastName
          }
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`

export const GET_COMPANY_STATS = gql`
  query GetCompanyStats($year: Int!) {
    companyStats(year: $year) {
      current {
        userID
        status
        count
      }
      byPeriod {
        userID
        status
        week
        month
        count
      }
      years
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
      status
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
        status
      }
      salePerson {
        id
        email
        firstName
        lastName
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
      status
      relanceDate
      relanceType
      relanceTemplateId
      relanceChannel
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
      status
      relanceDate
      relanceType
      relanceTemplateId
      relanceChannel
    }
  }
`

export const DELETE_COMPANY = gql`
  mutation DeleteCompany($id: Int!) {
    deleteCompany(id: $id)
  }
`

export const BLACKLIST_COMPANY = gql`
  mutation BlacklistCompany($id: Int!, $reason: String!, $allBlacklist: Boolean!) {
    blacklistCompany(id: $id, reason: $reason, allBlacklist: $allBlacklist)
  }
`

export const GET_BLACKLISTED_COMPANIES = gql`
  query GetBlacklistedCompanies($first: Int, $after: String, $search: String) {
    blacklistedCompanies(first: $first, after: $after, search: $search) {
      edges {
        cursor
        node {
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
          status
          relanceDate
          createdAt
          relanceType
          relanceTemplateId
          relanceChannel
          allBlacklist
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`

export const UNBLACKLIST_COMPANY = gql`
  mutation UnblacklistCompany($id: Int!) {
    unblacklistCompany(id: $id)
  }
`

// ─── Candidats (MongoDB) ─────────────────────────────────────────────────────

const CANDIDATE_FIELDS = gql`
  fragment CandidateFields on Candidate {
    id
    owner {
      userId
      name
      sector
    }
    status
    tpType
    trainingSite
    skillsAssessment {
      competence
      level
    }
    identity {
      fullName
      avatarUpdatedAt
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
`

export const GET_CANDIDATE_STATS = gql`
  query GetCandidateStats {
    candidateStats {
      total
      byStatus { key count }
      byTpType { key count }
      byTrainingSite { key count }
      byTpAndStatus { tpType status count }
    }
  }
`

export const GET_CANDIDATES = gql`
  query GetCandidates {
    candidates {
      ...CandidateFields
    }
  }
  ${CANDIDATE_FIELDS}
`

export const GET_CANDIDATES_PAGE = gql`
  query GetCandidatesPage($first: Int, $after: String, $search: String, $filters: CandidateFiltersInput) {
    candidatesPage(first: $first, after: $after, search: $search, filters: $filters) {
      edges {
        cursor
        node {
          ...CandidateFields
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
  ${CANDIDATE_FIELDS}
`

export const CREATE_CANDIDATE_DRIVE_FOLDER = gql`
  mutation CreateCandidateDriveFolder($id: String!) {
    createCandidateDriveFolder(id: $id) {
      id
      pdfLink
      driveFolderId
    }
  }
`

export const GET_DRIVE_FOLDER_CONFIG = gql`
  query DriveFolderConfig {
    driveFolderConfig {
      rootFolderId
      tpFolders {
        tp
        region
        folderId
      }
    }
  }
`

export const UPDATE_DRIVE_FOLDER_CONFIG = gql`
  mutation UpdateDriveFolderConfig($input: DriveFolderConfigInput!) {
    updateDriveFolderConfig(input: $input) {
      rootFolderId
      tpFolders {
        tp
        region
        folderId
      }
    }
  }
`

export const GET_CANDIDATE_BY_ID = gql`
  query GetCandidateById($id: String!) {
    candidate(id: $id) {
      id
      owner {
        userId
        name
        sector
      }
      status
      tpType
      trainingSite
      immersionAgreement
      desiredSectors
      expectedCompanySkills
      identity {
        fullName
        socialSecurityNumber
        avatarUpdatedAt
        email
        phone
        dateOfBirth
        placeOfBirth
        age
        address
        postalCode
        city
        drivingLicenseB
        transportMeans
        pshReferralRequest
        hadApprenticeshipContract
        apprenticeshipContractDetails
      }
      education {
        schoolLevel
        justification
      }
      support {
        franceTravailRegistered
        franceTravailAgency
        missionLocaleRegistered
        missionLocaleCity
      }
      background {
        lastDiploma
        previousTrainings
        professionalExperiences {
          position
          company
          duration
          responsibilities
        }
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
      synthesis {
        feasibilityConclusion
        pathwayRelevance
        specialNeeds
        otherRecommendations
        location
        date
      }
      skillsAssessment {
        competence
        level
      }
      jobInfo {
        domainMotivation
        questionsConcerns
        availabilityDate
        geographicMobility
        weekendWork
        discoverySource
      }
      pdfLink
      cvLink
      driveFolderId
      filizFolderId
    }
  }
`

export const GET_CANDIDATE_CV_STATUS = gql`
  query GetCandidateCvStatus($id: String!) {
    candidate(id: $id) {
      id
      cvLink
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
      immersionAgreement
      desiredSectors
      expectedCompanySkills
      skillsAssessment {
        competence
        level
      }
      identity {
        fullName
        socialSecurityNumber
        avatarUpdatedAt
        email
        phone
        dateOfBirth
        placeOfBirth
        age
        address
        postalCode
        city
        drivingLicenseB
        transportMeans
        pshReferralRequest
        hadApprenticeshipContract
        apprenticeshipContractDetails
      }
      education {
        schoolLevel
        justification
      }
      support {
        franceTravailRegistered
        franceTravailAgency
        missionLocaleRegistered
        missionLocaleCity
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
      synthesis {
        feasibilityConclusion
        pathwayRelevance
        specialNeeds
        otherRecommendations
        location
        date
      }
      professionalProjects {
        careerObjectives
        desiredSkills
        apprenticeshipMotivation
        trainingExpectations
      }
      background {
        lastDiploma
        previousTrainings
        professionalExperiences {
          position
          company
          duration
          responsibilities
        }
      }
      jobInfo {
        domainMotivation
        questionsConcerns
        availabilityDate
        geographicMobility
        weekendWork
        discoverySource
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
        avatarUpdatedAt
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
      owner {
        userId
        name
        sector
      }
      status
      tpType
      trainingSite
      immersionAgreement
      desiredSectors
      expectedCompanySkills
      identity {
        fullName
        socialSecurityNumber
        avatarUpdatedAt
        email
        phone
        dateOfBirth
        placeOfBirth
        departmentOfBirth
        age
        address
        postalCode
        city
        drivingLicenseB
        transportMeans
        pshReferralRequest
        hadApprenticeshipContract
        apprenticeshipContractDetails
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

export const MATCH_CANDIDATE = gql`
  query MatchCandidate($id: String!) {
    matchCandidate(id: $id) {
      id
      matchedJobs {
        id
        companyName
        sector
        localisation
        desiredTP
        ageRange
        status
      }
    }
  }
`

export const UPDATE_CANDIDATE_FULL = gql`
  mutation UpdateCandidateFull($id: String!, $input: UpdateCandidateInput!) {
    updateCandidate(id: $id, input: $input) {
      id
      status
      tpType
      trainingSite
      immersionAgreement
      desiredSectors
      expectedCompanySkills
      identity {
        fullName
        socialSecurityNumber
        avatarUpdatedAt
        email
        phone
        dateOfBirth
        placeOfBirth
        age
        address
        postalCode
        city
        drivingLicenseB
        transportMeans
        pshReferralRequest
        hadApprenticeshipContract
        apprenticeshipContractDetails
      }
      education {
        schoolLevel
        justification
      }
      support {
        franceTravailRegistered
        franceTravailAgency
        missionLocaleRegistered
        missionLocaleCity
      }
      background {
        lastDiploma
        previousTrainings
        professionalExperiences {
          position
          company
          duration
          responsibilities
        }
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
      skillsAssessment {
        competence
        level
      }
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
        otherRecommendations
        location
        date
      }
      pdfLink
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
        firstName
        lastName
        role
        sectors
      }
    }
  }
`

export const REGISTER_USER = gql`
  mutation RegisterUser(
    $email: String!
    $firstName: String!
    $lastName: String!
    $passwordPlain: String!
    $role: Role!
    $sectors: [String!]
  ) {
    register(
      email: $email
      firstName: $firstName
      lastName: $lastName
      passwordPlain: $passwordPlain
      role: $role
      sectors: $sectors
    ) {
      id
      email
      firstName
      lastName
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
      desiredTP
      desiredSex
      drivingLicencseB
      professionalExperience
      status
      localisation
      sector
    }
  }
`

export const MATCH_JOB = gql`
  query MatchJob($id: String!) {
    matchJob(id: $id) {
      id
      companyName
      ageRange
      desiredTP
      desiredSex
      drivingLicencseB
      professionalExperience
      status
      localisation
      sector
      matchedCandidate {
        id
        fullName
        age
        sex
        city
        email
        phone
        status
      }
      suggestedCandidates {
        id
        fullName
        age
        sex
        city
        email
        phone
      }
      proposedCandidate {
        id
        fullName
        age
        sex
        city
        email
        phone
        description
        answer
        comment
        interviewLocation
        bookedInterviewSlot
        interviewConclusion
        immersionStartDate
        immersionEndDate
      }
      interviewSlots
      interviewLocation
    }
  }
`

export const CREATE_MATCH_SESSION = gql`
  mutation CreateMatchSession($jobId: String!, $companyEmail: String!, $candidates: [ProposedCandidateInput!]!) {
    createMatchSession(jobId: $jobId, companyEmail: $companyEmail, candidates: $candidates)
  }
`

export const ADD_CANDIDATE_TO_JOB = gql`
  mutation AddCandidateToJob($jobId: String!, $candidateId: String!) {
    addCandidateToJob(jobId: $jobId, candidateId: $candidateId) {
      id
      status
      matchedCandidate {
        id
        fullName
        age
        sex
        city
        email
        phone
        status
      }
    }
  }
`

export const ADD_MANUAL_PROPOSED_CANDIDATE = gql`
  mutation AddManualProposedCandidate(
    $jobId: String!
    $candidateId: String!
    $interviewDate: String!
    $interviewHour: String!
    $interviewLocation: String!
  ) {
    addManualProposedCandidate(
      jobId: $jobId
      candidateId: $candidateId
      interviewDate: $interviewDate
      interviewHour: $interviewHour
      interviewLocation: $interviewLocation
    ) {
      id
      proposedCandidate {
        id
        fullName
        email
        description
        answer
        interviewLocation
        bookedInterviewSlot
        interviewConclusion
        immersionStartDate
        immersionEndDate
      }
    }
  }
`

export const SET_INTERVIEW_CONCLUSION = gql`
  mutation SetInterviewConclusion(
    $jobId: String!
    $candidateId: String!
    $conclusion: InterviewConclusion!
    $immersionStartDate: String
    $immersionEndDate: String
  ) {
    setInterviewConclusion(
      jobId: $jobId
      candidateId: $candidateId
      conclusion: $conclusion
      immersionStartDate: $immersionStartDate
      immersionEndDate: $immersionEndDate
    ) {
      id
      proposedCandidate {
        id
        fullName
        email
        description
        answer
        interviewLocation
        bookedInterviewSlot
        interviewConclusion
        immersionStartDate
        immersionEndDate
        immersionConclusion
      }
    }
  }
`

export const SET_IMMERSION_CONCLUSION = gql`
  mutation SetImmersionConclusion(
    $jobId: String!
    $candidateId: String!
    $conclusion: ImmersionConclusion!
  ) {
    setImmersionConclusion(
      jobId: $jobId
      candidateId: $candidateId
      conclusion: $conclusion
    ) {
      id
      proposedCandidate {
        id
        fullName
        email
        description
        answer
        interviewLocation
        bookedInterviewSlot
        interviewConclusion
        immersionStartDate
        immersionEndDate
        immersionConclusion
      }
    }
  }
`

export const OFFER_RESPONSE_LINKS = gql`
  query OfferResponseLinks($jobId: String!, $candidateId: String!) {
    offerResponseLinks(jobId: $jobId, candidateId: $candidateId) {
      ouiUrl
      nonUrl
    }
  }
`

export const UPDATE_JOB = gql`
  mutation UpdateJob($id: String!, $job: JobInput!) {
    updateJob(id: $id, job: $job) {
      id
      status
    }
  }
`

export const UNMATCH_JOB = gql`
  mutation UnmatchJob($id: String!) {
    unmatchJob(id: $id) {
      id
      companyName
      ageRange
      desiredTP
      desiredSex
      drivingLicencseB
      professionalExperience
      status
      localisation
      matchedCandidate {
        id
        fullName
        age
        sex
        city
        email
        phone
        status
      }
    }
  }
`

export const REMOVE_CANDIDATE_FROM_JOB = gql`
  mutation RemoveCandidateFromJob($jobId: String!, $candidateId: String!) {
    removeCandidateFromJob(jobId: $jobId, candidateId: $candidateId) {
      id
      status
      matchedCandidate {
        id
        fullName
        age
        sex
        city
        email
        phone
        status
      }
    }
  }
`

export const UPDATE_MATCHED_CANDIDATE_STATUS = gql`
  mutation UpdateMatchedCandidateStatus($jobId: String!, $candidateId: String!, $status: MatchedCandidateStatus!) {
    updateMatchedCandidateStatus(jobId: $jobId, candidateId: $candidateId, status: $status) {
      id
      matchedCandidate {
        id
        fullName
        age
        sex
        city
        email
        phone
        status
      }
    }
  }
`

export const GET_CANDIDATE_MATCHED_JOB_IDS = gql`
  query GetCandidateMatchedJobIds($candidateId: String!) {
    candidateMatchedJobIds(candidateId: $candidateId)
  }
`

export const GET_CANDIDATE_HISTORY = gql`
  query CandidateHistory($candidateId: String!) {
    candidateHistory(candidateId: $candidateId) {
      id
      type
      description
      ownerEmail
      createdAt
    }
  }
`

export const ADD_CANDIDATE_HISTORY_ENTRY = gql`
  mutation AddCandidateHistoryEntry($candidateId: String!, $description: String!) {
    addCandidateHistoryEntry(candidateId: $candidateId, description: $description) {
      id
      type
      description
      ownerEmail
      createdAt
    }
  }
`

export const DELETE_CANDIDATE_HISTORY_ENTRY = gql`
  mutation DeleteCandidateHistoryEntry($id: String!) {
    deleteCandidateHistoryEntry(id: $id)
  }
`

export const CREATE_NEEDS_ANALYSIS = gql`
  mutation CreateNeedsAnalysis($input: NeedsAnalysisInput!) {
    createNeedsAnalysis(input: $input) {
      id
      status
      createdAt
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

export const GET_COMPANY_HISTORY = gql`
  query CompanyHistory($companyID: Int!) {
    companyHistory(companyID: $companyID) {
      id
      updatedAt
      updatedColumn
      status
      previousStatus
      modifiedBy
    }
  }
`

export const GET_CONTACT_LOGS = gql`
  query ContactLogs($companyID: Int!) {
    contactLogs(companyID: $companyID) {
      id
      companyID
      userID
      comment
      createdAt
    }
  }
`

export const GET_CONTACT_LOG_STATS = gql`
  query ContactLogStats {
    contactLogStats {
      total
      byUser {
        userID
        count
      }
    }
  }
`

export const CREATE_CONTACT_LOG = gql`
  mutation CreateContactLog($companyID: Int!, $comment: String!) {
    createContactLog(companyID: $companyID, comment: $comment) {
      id
      companyID
      userID
      comment
      createdAt
    }
  }
`

export const GET_NEEDS_ANALYSIS = gql`
  query NeedsAnalysis($id: Int!) {
    needsAnalysis(id: $id) {
      id
      legalRepFunction
      recruitmentResponsibleName
      recruitmentResponsiblePhone
      recruitmentResponsibleEmail
      recruitmentResponsibleFunction
      companySectors
      companyDescription
      opco
      referralSource
      positionsCount
      positions {
        trainingDomain
        jobTitle
        selectedMissions
        localisation
      }
      localisation
      trainingDomain
      jobTitle
      selectedMissions
      jobDescriptionMissions
      jobDescriptionOther
      educationLevel
      drivingLicense
      experienceRequired
      ageRequirements
      ageMin
      ageMax
      softSkills
      scheduleOptions
      conditions
      additionalComments
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

export const DELETE_NEEDS_ANALYSIS = gql`
  mutation DeleteNeedsAnalysis($id: Int!) {
    deleteNeedsAnalysis(id: $id)
  }
`

export const GET_FILIZ_DEGREES = gql`
  query GetFilizDegrees {
    filizDegrees {
      degreeId
      degreeTitle
      preparedTitleName
    }
  }
`

export const GET_FILIZ_CLASSES = gql`
  query GetFilizClasses($degreeId: String!) {
    filizClasses(degreeId: $degreeId) {
      classId
      className
      startDate
      endDate
    }
  }
`

export const CREATE_FILIZ_FOLDER = gql`
  mutation CreateFilizFolder(
    $candidateId: String!
    $classId: String!
    $fileManagerFirstName: String!
    $fileManagerLastName: String!
    $fileManagerEmail: String!
  ) {
    createFilizFolder(
      candidateId: $candidateId
      classId: $classId
      fileManagerFirstName: $fileManagerFirstName
      fileManagerLastName: $fileManagerLastName
      fileManagerEmail: $fileManagerEmail
    ) {
      id
      filizFolderId
    }
  }
`
