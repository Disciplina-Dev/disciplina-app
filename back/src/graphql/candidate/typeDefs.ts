import gql from 'graphql-tag';

export const typeDefs = gql`
    enum TitleProfessionalType {
        AD
        CC
        NTC
        REM
        SA
    }

    enum Localisation {
        SAINT_DENIS
        SAINTE_MARIE
        SAINTE_SUZANNE
        SAINT_PAUL
        LA_POSSESSION
        LE_PORT
        TROIS_BASSINS
        SAINT_LEU
        SAINT_PIERRE
        CILAOS
        ETANG_SALE
        SAINT_LOUIS
        ENTRE_DEUX
        LES_AVIRONS
        LE_TAMPON
        SAINT_PHILLIPE
        SAINT_JOSEPH
        PETIT_ILE
        SAINTE_ROSE
        SAINT_BENOIT
        BRAS_PANON
        SAINT_ANDRE
        LA_PLAINE_DES_PALMISTES
        SALAZIE
        SAINTE_ANNE
    }

    enum SchoolLevel {
        CAP_BEP_WITH_1Y_EXP
        PREMIERE_TERMINALE
        PREMIERE_TERMINALE_WITH_1Y_EXP
        BAC
        BAC_WITH_1Y_EXP
        BAC_PLUS
        BAC_PLUS_2
        BAC_PLUS_2_PLUS
        BAC_PLUS_3_PLUS
    }

    enum CandidateStatus {
        SEEKING
        NOT_SEEKING
        CANCELLED
        MATCHED
        CONTRACT
        IMMERSING
        BANNED
    }

    enum TrainingSite {
        NORD_SAINTE_MARIE
        OUEST_SAINT_PAUL
        SUD_SAINT_PIERRE
    }

    enum SkillLevel {
        A
        ECA
        NA
        NE
    }

    enum DiscoverySource {
        SOCIAL_MEDIA
        FRANCE_TRAVAIL
        MISSION_LOCALE
        WORD_OF_MOUTH
        KOANN
        OTHER
    }

    type CandidateIdentity {
        fullName: String!
        socialSecurityNumber: String
        email: String!
        phone: String!
        dateOfBirth: String
        placeOfBirth: String
        age: Int
        address: String
        postalCode: String
        city: String
        drivingLicenseB: Boolean
        transportMeans: String
        pshReferralRequest: Boolean
        hadApprenticeshipContract: Boolean
        avatarUpdatedAt: String
    }

    type CandidateEducation {
        schoolLevel: SchoolLevel
        justification: String
    }

    type CandidateSupport {
        franceTravailRegistered: Boolean
        franceTravailAgency: String
        missionLocaleRegistered: Boolean
        missionLocaleCity: String
    }

    type ProfessionalExperience {
        position: String
        duration: String
        responsibilities: String
        company: String
    }

    type CandidateBackground {
        lastDiploma: String
        previousTrainings: String
        professionalExperiences: [ProfessionalExperience]
    }

    type CandidateProfile {
        frenchLevel: Int
        englishLevel: Int
        otherLanguages: [String]
        strengthsAndImprovements: String
        qualities: [String]
        defects: [String]
        digitalSkills: [String]
        readyForChallenges: Boolean
        hobbies: String
    }

    type ProfessionalProjects {
        careerObjectives: String
        desiredSkills: String
        apprenticeshipMotivation: String
        trainingExpectations: String
    }

    type SkillAssessment {
        competence: String!
        level: SkillLevel!
    }

    type JobInfo {
        domainMotivation: String
        questionsConcerns: String
        availabilityDate: String
        geographicMobility: [Localisation]
        weekendWork: Boolean
        discoverySource: DiscoverySource
    }

    type PedagogicalRecommendations {
        officeToolsReinforcement: Boolean
        writtenCommunicationSupport: Boolean
        oralConfidenceDevelopment: Boolean
        timeManagementSupport: Boolean
        professionalPostureWork: Boolean
        enhancedCompanyImmersion: Boolean
        pshSpecificSupport: Boolean
        individualFollowUp: Boolean
        languageTraining: Boolean
        stressManagementFollowUp: Boolean
    }

    type CandidateSynthesis {
        feasibilityConclusion: String
        pathwayRelevance: String
        specialNeeds: String
        pedagogicalRecommendations: PedagogicalRecommendations
        otherRecommendations: String
        location: String
        date: String
        recruiterSignature: String
        candidateSignature: String
    }

    type MatchedJob {
        id: String
        companyName: String
        sector: String
        localisation: [Localisation]
        desiredTP: TitleProfessionalType
        ageRange: String
        status: String
    }

    type Candidate {
        id: String!
        status: CandidateStatus!
        tpType: TitleProfessionalType!
        identity: CandidateIdentity!
        trainingSite: TrainingSite
        immersionAgreement: Boolean
        desiredSectors: [String]
        expectedCompanySkills: [String]
        education: CandidateEducation
        support: CandidateSupport
        background: CandidateBackground
        profile: CandidateProfile
        professionalProjects: ProfessionalProjects
        skillsAssessment: [SkillAssessment]
        jobInfo: JobInfo
        synthesis: CandidateSynthesis
        pdfLink: String
        cvLink: String
        driveFolderId: String
        matchedJobs: [MatchedJob]
        photoLink: String
    }

    input IdentityInput {
        fullName: String!
        socialSecurityNumber: String
        email: String!
        phone: String!
        dateOfBirth: String
        placeOfBirth: String
        age: Int
        address: String
        postalCode: String
        city: String
        drivingLicenseB: Boolean
        transportMeans: String
        pshReferralRequest: Boolean
        hadApprenticeshipContract: Boolean
    }

    input EducationInput {
        schoolLevel: SchoolLevel
        justification: String
    }

    input SupportInput {
        franceTravailRegistered: Boolean
        franceTravailAgency: String
        missionLocaleRegistered: Boolean
        missionLocaleCity: String
    }

    input ProfessionalExperienceInput {
        position: String
        duration: String
        responsibilities: String
        company: String
    }

    input BackgroundInput {
        lastDiploma: String
        previousTrainings: String
        professionalExperiences: [ProfessionalExperienceInput]
    }

    input ProfileInput {
        frenchLevel: Int
        englishLevel: Int
        otherLanguages: [String]
        strengthsAndImprovements: String
        qualities: [String]
        defects: [String]
        digitalSkills: [String]
        readyForChallenges: Boolean
        hobbies: String
    }

    input ProfessionalProjectsInput {
        careerObjectives: String
        desiredSkills: String
        apprenticeshipMotivation: String
        trainingExpectations: String
    }

    input SkillAssessmentInput {
        competence: String!
        level: SkillLevel!
    }

    input JobInfoInput {
        domainMotivation: String
        questionsConcerns: String
        availabilityDate: String
        geographicMobility: [Localisation]
        weekendWork: Boolean
        discoverySource: DiscoverySource
    }

    input PedagogicalRecommendationsInput {
        officeToolsReinforcement: Boolean
        writtenCommunicationSupport: Boolean
        oralConfidenceDevelopment: Boolean
        timeManagementSupport: Boolean
        professionalPostureWork: Boolean
        enhancedCompanyImmersion: Boolean
        pshSpecificSupport: Boolean
        individualFollowUp: Boolean
        languageTraining: Boolean
        stressManagementFollowUp: Boolean
    }

    input SynthesisInput {
        feasibilityConclusion: String
        pathwayRelevance: String
        specialNeeds: String
        pedagogicalRecommendations: PedagogicalRecommendationsInput
        otherRecommendations: String
        location: String
        date: String
        recruiterSignature: String
        candidateSignature: String
    }

    input CreateCandidateInput {
        status: CandidateStatus!
        tpType: TitleProfessionalType!
        identity: IdentityInput!
        trainingSite: TrainingSite
        immersionAgreement: Boolean
        desiredSectors: [String]
        expectedCompanySkills: [String]
        education: EducationInput
        support: SupportInput
        background: BackgroundInput
        profile: ProfileInput
        professionalProjects: ProfessionalProjectsInput
        skillsAssessment: [SkillAssessmentInput]
        jobInfo: JobInfoInput
        synthesis: SynthesisInput
    }

    input UpdateCandidateInput {
        status: CandidateStatus
        tpType: TitleProfessionalType
        identity: IdentityInput
        trainingSite: TrainingSite
        immersionAgreement: Boolean
        desiredSectors: [String]
        expectedCompanySkills: [String]
        education: EducationInput
        support: SupportInput
        background: BackgroundInput
        profile: ProfileInput
        professionalProjects: ProfessionalProjectsInput
        skillsAssessment: [SkillAssessmentInput]
        jobInfo: JobInfoInput
        synthesis: SynthesisInput
    }

    type CandidateTemplate {
        tpType: TitleProfessionalType!
        hasEnglishLevel: Boolean!
        availableSectors: [String!]!
        availableExpectedSkills: [String!]!
        defaultSkillsAssessment: [SkillAssessment!]!
    }

    type PageInfo {
        hasNextPage: Boolean!
        hasPreviousPage: Boolean!
        startCursor: String
        endCursor: String
    }

    type CandidateEdge {
        node: Candidate!
        cursor: String!
    }

    type CandidateConnection {
        edges: [CandidateEdge!]!
        pageInfo: PageInfo!
    }

    input CandidateFiltersInput {
        trainingSite: TrainingSite
        status: CandidateStatus
        schoolLevel: SchoolLevel
        drivingLicenseB: Boolean
        ageMin: Int
        ageMax: Int
        tpType: TitleProfessionalType
    }

    type StatBucket {
        key: String!
        count: Int!
    }

    type TpStatusBucket {
        tpType: String!
        status: String!
        count: Int!
    }

    type CandidateStats {
        total: Int!
        byStatus: [StatBucket!]!
        byTpType: [StatBucket!]!
        byTrainingSite: [StatBucket!]!
        byTpAndStatus: [TpStatusBucket!]!
    }

    enum CandidateHistoryType {
        RH
        CANDIDATE
        COMPANY
    }

    type CandidateHistoryEntry {
        id: ID!
        type: CandidateHistoryType!
        description: String!
        ownerEmail: String
        createdAt: String!
    }

    type Query {
        candidateStats: CandidateStats!
        candidates: [Candidate!]!
        candidatesPage(first: Int, after: String, search: String, filters: CandidateFiltersInput): CandidateConnection!
        candidate(id: String!): Candidate
        candidateTemplate(tpType: TitleProfessionalType!): CandidateTemplate
        matchCandidate(id: String!): Candidate!
        candidateHistory(candidateId: String!): [CandidateHistoryEntry!]!
    }

    type Mutation {
        createCandidate(input: CreateCandidateInput!): Candidate!
        updateCandidate(id: String!, input: UpdateCandidateInput!): Candidate!
        deleteCandidate(id: String!): Boolean!
        createCandidateDriveFolder(id: String!): Candidate!
        addCandidateHistoryEntry(candidateId: String!, description: String!): CandidateHistoryEntry!
        deleteCandidateHistoryEntry(id: String!): Boolean!
    }
`;
