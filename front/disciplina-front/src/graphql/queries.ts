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

export const GET_RH_USERS = gql`
  query GetRhUsers {
    rhUsers {
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

export const GET_COMPANY_OPTIONS = gql`
  query GetCompanyOptions {
    companyOptions {
      id
      name
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
            siren
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

export const GET_COMPANIES_BY_SIREN = gql`
  query GetCompaniesBySiren($first: Int, $after: String, $filters: CompanyFiltersInput) {
    companiesBySiren(first: $first, after: $after, filters: $filters) {
      edges {
        cursor
        node {
          siren
          count
          companies {
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
            siren
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

export const BLACKLIST_AND_CLEANUP_COMPANY = gql`
  mutation DeleteAndBlacklistCompany($companyId: Int!, $reason: String!, $allBlacklist: Boolean!) {
    deleteAndBlacklistCompany(companyId: $companyId, reason: $reason, allBlacklist: $allBlacklist)
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
    tpTypes
    trainingSite
    trainingSites
    skillsAssessment {
      competence
      level
    }
    identity {
      fullName
      avatarUpdatedAt
      driveAvatarFileId
      email
      phone
      drivingLicenseB
      hasVehicle
      age
      city
      pshReferralRequest
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
      lastDiplomaPrepared
    }
    pdfLink
    photoLink
    createdAt
    lastRelanceAt
    relanceResponseAt
  }
`

export const GET_CANDIDATE_STATS = gql`
  query GetCandidateStats($sectors: [String!]) {
    candidateStats(sectors: $sectors) {
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

export const GET_AB_DRIVE_CONFIG = gql`
  query AbDriveConfig {
    abDriveConfig {
      sectorFolders {
        sector
        kind
        folderId
      }
    }
  }
`

export const UPDATE_AB_DRIVE_CONFIG = gql`
  mutation UpdateAbDriveConfig($input: AbDriveConfigInput!) {
    updateAbDriveConfig(input: $input) {
      sectorFolders {
        sector
        kind
        folderId
      }
    }
  }
`

export const CHECK_CANDIDATE_EMAIL = gql`
  query CandidateByEmail($email: String!) {
    candidateByEmail(email: $email) {
      exists
      id
      fullName
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
      tpTypes
      trainingSite
      trainingSites
      immersionAgreement
      immersionStartDate
      immersionEndDate
      immersionCompanyId
      immersionCompanyName
      desiredSectors
      expectedCompanySkills
      identity {
        fullName
        socialSecurityNumber
        avatarUpdatedAt
        driveAvatarFileId
        email
        phone
        dateOfBirth
        placeOfBirth
        age
        sex
        address
        postalCode
        city
        drivingLicenseB
        hasVehicle
        transportMeans
        pshReferralRequest
        hadApprenticeshipContract
        apprenticeshipContractDetails
        description
      }
      emergencyContact { lastName firstName relationship phone email }
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
        lastDiplomaPrepared
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
        importantNote
        location
        date
        candidateSignature
        interviewedBy
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
      photoLink
      filizFolderId
      createdAt
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
      tpTypes
      trainingSite
      trainingSites
      immersionAgreement
      immersionStartDate
      immersionEndDate
      immersionCompanyId
      immersionCompanyName
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
        driveAvatarFileId
        email
        phone
        dateOfBirth
        placeOfBirth
        age
        sex
        address
        postalCode
        city
        drivingLicenseB
        hasVehicle
        transportMeans
        pshReferralRequest
        hadApprenticeshipContract
        apprenticeshipContractDetails
        description
      }
      emergencyContact { lastName firstName relationship phone email }
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
      jobInfo {
        availabilityDate
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
        importantNote
        location
        date
        candidateSignature
        interviewedBy
      }
      professionalProjects {
        careerObjectives
        desiredSkills
        apprenticeshipMotivation
        trainingExpectations
      }
      background {
        lastDiploma
        lastDiplomaPrepared
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
      createdAt
    }
  }
`

export const CREATE_CANDIDATE = gql`
  mutation CreateCandidate($input: CreateCandidateInput!) {
    createCandidate(input: $input) {
      id
      status
      tpType
      tpTypes
      trainingSite
      trainingSites
      skillsAssessment {
        competence
        level
      }
      identity {
        fullName
        avatarUpdatedAt
        driveAvatarFileId
        email
        phone
        drivingLicenseB
        hasVehicle
        age
        sex
        description
      }
      emergencyContact { lastName firstName relationship phone email }
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
        lastDiplomaPrepared
      }
      pdfLink
      createdAt
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
      tpTypes
      trainingSite
      trainingSites
      immersionAgreement
      immersionStartDate
      immersionEndDate
      immersionCompanyId
      immersionCompanyName
      desiredSectors
      expectedCompanySkills
      identity {
        fullName
        socialSecurityNumber
        avatarUpdatedAt
        driveAvatarFileId
        email
        phone
        dateOfBirth
        placeOfBirth
        departmentOfBirth
        age
        sex
        address
        postalCode
        city
        drivingLicenseB
        hasVehicle
        transportMeans
        pshReferralRequest
        hadApprenticeshipContract
        apprenticeshipContractDetails
        description
      }
      emergencyContact { lastName firstName relationship phone email }
      education { schoolLevel justification }
      support {
        franceTravailRegistered
        franceTravailAgency
        missionLocaleRegistered
        missionLocaleCity
      }
      background {
        lastDiploma
        lastDiplomaPrepared
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
        importantNote
        location
        date
        candidateSignature
        interviewedBy
      }
      pdfLink
      createdAt
    }
  }
`

export const MATCH_CANDIDATE = gql`
  query MatchCandidate($id: String!) {
    matchCandidate(id: $id) {
      id
      matchedOffers {
        id
        needsAnalysisId
        companyName
        sector
        localisation
        desiredTp {
          tpType
          missions
          descriptionMissions
        }
        ageRange
        status
        title
        jobRole
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
      tpTypes
      trainingSite
      trainingSites
      immersionAgreement
      immersionStartDate
      immersionEndDate
      immersionCompanyId
      immersionCompanyName
      desiredSectors
      expectedCompanySkills
      identity {
        fullName
        socialSecurityNumber
        avatarUpdatedAt
        driveAvatarFileId
        email
        phone
        dateOfBirth
        placeOfBirth
        age
        sex
        address
        postalCode
        city
        drivingLicenseB
        hasVehicle
        transportMeans
        pshReferralRequest
        hadApprenticeshipContract
        apprenticeshipContractDetails
        description
      }
      emergencyContact { lastName firstName relationship phone email }
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
        lastDiplomaPrepared
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
        importantNote
        location
        date
        candidateSignature
        interviewedBy
      }
      pdfLink
      createdAt
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
    $role: UserRole!
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

// ─── Offers / Matching ─────────────────────────────────────────────────────────

export const GET_OFFERS = gql`
  query GetOffers {
    offers {
      id
      needsAnalysisId
      companyInfos { id name activities }
      companyName
      ageRange
      desiredTp {
        tpType
        missions
        descriptionMissions
        otherDescriptionMissions
        otherMissions
      }
      desiredSex
      drivingLicencseB
      professionalExperience
      status
      localisation
      sector
    }
  }
`

export const GET_OFFER_COMPANY_INFO = gql`
  query OfferCompanyInfo($offerId: String!) {
    offerCompanyInfo(offerId: $offerId) {
      companyName
      company {
        id
        name
        legalReferent
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
  }
`

export const MATCH_OFFER = gql`
  query MatchOffer($id: String!) {
    matchOffer(id: $id) {
      id
      needsAnalysisId
      companyInfos { id name activities }
      companyName
      ageRange
      desiredTp {
        tpType
        missions
        descriptionMissions
        otherDescriptionMissions
        otherMissions
      }
      desiredSex
      drivingLicencseB
      professionalExperience
      status
      localisation
      sector
      softSkills
      matchedCandidate {
        id
        fullName
        age
        sex
        city
        email
        phone
        status
        description
        identityDescription
        comment
        cvWebview
        interviewLocation
        bookedInterviewSlot
        interviewConclusion
        immersionStartDate
        immersionEndDate
        immersionLocation
        immersionConclusion
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
      title
      jobRole
      salerInfo {
        id
        email
      }
      referents {
        isSame
        legalReferents {
          name
          phone
          email
          function
        }
        recruitmentReferents {
          name
          phone
          email
          function
        }
      }
    }
  }
`

export const CREATE_MATCH_SESSION = gql`
  mutation CreateMatchSession($offerId: String!, $companyEmail: String!, $candidates: [ProposedCandidateInput!]!) {
    createMatchSession(offerId: $offerId, companyEmail: $companyEmail, candidates: $candidates)
  }
`

export const ADD_CANDIDATE_TO_OFFER = gql`
  mutation AddCandidateToOffer($offerId: String!, $candidateId: String!) {
    addCandidateToOffer(offerId: $offerId, candidateId: $candidateId) {
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
        description
        identityDescription
        cvWebview
      }
    }
  }
`

export const ADD_MANUAL_PROPOSED_CANDIDATE = gql`
  mutation AddManualProposedCandidate(
    $offerId: String!
    $candidateId: String!
    $interviewDate: String!
    $interviewHour: String!
    $interviewLocation: String!
  ) {
    addManualProposedCandidate(
      offerId: $offerId
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
        identityDescription
        interviewLocation
        bookedInterviewSlot
        interviewConclusion
        immersionStartDate
        immersionEndDate
      }
    }
  }
`

export const ADD_MANUAL_PROPOSED_CANDIDATE_FOR_IMMERSION = gql`
  mutation AddManualProposedCandidateForImmersion(
    $offerId: String!
    $candidateId: String!
    $immersionStartDate: String!
    $immersionEndDate: String!
    $immersionLocation: String!
  ) {
    addManualProposedCandidateForImmersion(
      offerId: $offerId
      candidateId: $candidateId
      immersionStartDate: $immersionStartDate
      immersionEndDate: $immersionEndDate
      immersionLocation: $immersionLocation
    ) {
      id
      proposedCandidate {
        id
        fullName
        email
        description
        identityDescription
        immersionStartDate
        immersionEndDate
        immersionLocation
      }
    }
  }
`

export const SET_INTERVIEW_CONCLUSION = gql`
  mutation SetInterviewConclusion(
    $offerId: String!
    $candidateId: String!
    $conclusion: InterviewConclusion!
    $immersionStartDate: String
    $immersionEndDate: String
  ) {
    setInterviewConclusion(
      offerId: $offerId
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
    $offerId: String!
    $candidateId: String!
    $conclusion: ImmersionConclusion!
  ) {
    setImmersionConclusion(
      offerId: $offerId
      candidateId: $candidateId
      conclusion: $conclusion
    ) {
      id
      proposedCandidate {
        id
        fullName
        email
        description
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
  query OfferResponseLinks($offerId: String!, $candidateId: String!) {
    offerResponseLinks(offerId: $offerId, candidateId: $candidateId) {
      ouiUrl
      nonUrl
    }
  }
`

export const UPDATE_OFFER = gql`
  mutation UpdateOffer($id: String!, $offer: OfferInput!) {
    updateOffer(id: $id, offer: $offer) {
      id
      status
    }
  }
`

export const UNMATCH_OFFER = gql`
  mutation UnmatchOffer($id: String!) {
    unmatchOffer(id: $id) {
      id
      companyName
      ageRange
      desiredTp {
        tpType
        missions
        descriptionMissions
        otherDescriptionMissions
        otherMissions
      }
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

export const REMOVE_CANDIDATE_FROM_OFFER = gql`
  mutation RemoveCandidateFromOffer($offerId: String!, $candidateId: String!) {
    removeCandidateFromOffer(offerId: $offerId, candidateId: $candidateId) {
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
  mutation UpdateMatchedCandidateStatus($offerId: String!, $candidateId: String!, $status: MatchedCandidateStatus!) {
    updateMatchedCandidateStatus(offerId: $offerId, candidateId: $candidateId, status: $status) {
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
        description
        identityDescription
        cvWebview
      }
    }
  }
`

export const DELETE_OFFER = gql`
  mutation DeleteOffer($id: String!) {
    deleteOffer(id: $id)
  }
`

export const DELETE_OFFERS_BY_NEEDS_ANALYSIS = gql`
  mutation DeleteOffersByNeedsAnalysis($needsAnalysisId: String!) {
    deleteOffersByNeedsAnalysis(needsAnalysisId: $needsAnalysisId)
  }
`

export const OFFERS_BY_NEEDS_ANALYSIS = gql`
  query OffersByNeedsAnalysis($needsAnalysisId: String!) {
    offersByNeedsAnalysis(needsAnalysisId: $needsAnalysisId) {
      id
      needsAnalysisId
      companyInfos { id name activities }
      companyName
      ageRange
      desiredTp {
        tpType
        missions
        descriptionMissions
        otherDescriptionMissions
        otherMissions
      }
      desiredSex
      drivingLicencseB
      professionalExperience
      status
      localisation
      sector
      title
    }
  }
`

export const GET_CANDIDATE_MATCHED_OFFER_IDS = gql`
  query GetCandidateMatchedOfferIds($candidateId: String!) {
    candidateMatchedOfferIds(candidateId: $candidateId)
  }
`

export const GET_CANDIDATE_PLACEMENT = gql`
  query GetCandidatePlacement($candidateId: String!) {
    candidatePlacement(candidateId: $candidateId) {
      companyName
      kind
      since
      immersionEndDate
    }
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

export const DELETE_CANDIDATE = gql`
  mutation DeleteCandidate($id: String!) {
    deleteCandidate(id: $id)
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
      positions {
        title
      }
      positionsCount
      status
      createdAt
    }
  }
`

export const GET_NEEDS_ANALYSES_PAGE = gql`
  query GetNeedsAnalysesPage($first: Int, $after: String, $filter: OfferFilterInput) {
    needsAnalysesPage(first: $first, after: $after, filter: $filter) {
      edges {
        cursor
        node {
          id
          status
          positionsCount
          createdAt
          companyInfos {
            name
            siret
            sector
            activities
            commune
          }
          positions {
            jobRole
            title
            count
            localisation
            desiredTp {
              tpType
            }
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

export const GET_COMPANY_HISTORY = gql`
  query CompanyHistory($companyID: Int!) {
    companyHistory(companyID: $companyID) {
      id
      updatedAt
      updatedColumn
      status
      previousStatus
      modifiedBy
      changes {
        column
        from
        to
      }
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
  query NeedsAnalysis($id: ID!) {
    needsAnalysis(id: $id) {
      id
      companyInfos {
        id
        name
        ape
        idcc
        siret
        mainActivity
        opco
        referralSource
        sector
        activities
        description
        postalCode
        commune
      }
      salerInfo {
        id
        email
      }
      referents {
        isSame
        legalReferents {
          name
          phone
          email
          function
        }
        recruitmentReferents {
          name
          phone
          email
          function
        }
      }
      positionsCount
      positions {
        localisation
        desiredTp {
          tpType
          missions
          descriptionMissions
          otherDescriptionMissions
          otherMissions
        }
        trainingDomain
        jobRole
        count
        title
        criteria {
          educationLevel
          drivingLicense
          experienceRequired
          trainingDomain
          ageMin
          ageMax
          desiredSex
          softSkills
          scheduleOptions
          conditions
          additionalComments
        }
      }
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
  mutation DeleteNeedsAnalysis($id: ID!) {
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

export const UPDATE_NEEDS_ANALYSIS = gql`
  mutation UpdateNeedsAnalysis($id: ID!, $input: NeedsAnalysisInput!) {
    updateNeedsAnalysis(id: $id, input: $input) {
      id
      status
      updatedAt
    }
  }
`

export const GET_OFFER_HISTORY = gql`
  query OfferHistory($offerId: String!) {
    offerHistory(offerId: $offerId) {
      id
      firstName
      lastName
      text
      ownerEmail
      createdAt
    }
  }
`

export const ADD_OFFER_HISTORY_ENTRY = gql`
  mutation AddOfferHistoryEntry($offerId: String!, $text: String!) {
    addOfferHistoryEntry(offerId: $offerId, text: $text) {
      id
      firstName
      lastName
      text
      ownerEmail
      createdAt
    }
  }
`

export const DELETE_OFFER_HISTORY_ENTRY = gql`
  mutation DeleteOfferHistoryEntry($id: String!) {
    deleteOfferHistoryEntry(id: $id)
  }
`
