import gql from 'graphql-tag';

export const typeDefs = gql`
    enum JobStatus {
        NOT_MATCHED
        MATCHED
        CV_SEND
        IMMERSING
        CONTRACT
    }

    enum MatchedCandidateStatus {
        RETAINED
        OFFER_SEND
        ACCEPTED
        DECLINED
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

    enum DesiredTP {
        AD
        CC
        NTC
        REM
        SA
    }

    enum Sex {
        MIXTE
        FILLE
        GARCON
    }

    enum Sector {
        BOULANGERIE
        RESTAURATION
        STATION
        PAP
        LIBRE_SERVICE
        TELEPHONIE
        AUTO
        COMMERCIAL
        BIJOUX
        COSMETIQUE
        IMMOBILIER
        ASSURANCE
        ANIMAUX
        SPORT
        ENFANT
        PHARMACIE
        BAZAR
        NONE
    }

    enum ProposedCandidateAnswer {
        REFUSED
        ACCEPTED
        FAVORITE
    }

    enum InterviewConclusion {
        REJECTED
        IMMERSING
        CONTRACT
    }

    enum ImmersionConclusion {
        REJECTED
        CONTRACT
    }

    type MatchingCandidate {
        id: String
        fullName: String
        age: Int
        sex: Sex
        city: String
        email: String
        phone: String
        status: MatchedCandidateStatus
    }

    type ProposedCandidate {
        id: String
        fullName: String
        age: Int
        sex: Sex
        city: String
        email: String
        phone: String
        description: String
        answer: ProposedCandidateAnswer
        comment: String
        interviewLocation: String
        bookedInterviewSlot: String
        interviewConclusion: InterviewConclusion
        immersionStartDate: String
        immersionEndDate: String
        immersionLocation: String
        immersionConclusion: ImmersionConclusion
    }

    input ProposedCandidateInput {
        id: String!
        description: String
    }

    type OfferLinks {
        ouiUrl: String!
        nonUrl: String!
    }

    type Job {
        id: String!
        companyName: String
        ageRange: String
        desiredTP: DesiredTP
        desiredSex: Sex
        drivingLicencseB: Boolean
        professionalExperience: Boolean
        status: JobStatus
        localisation: [Localisation]
        sector: Sector
        matchedCandidate: [MatchingCandidate]
        suggestedCandidates: [MatchingCandidate]
        proposedCandidate: [ProposedCandidate]
        interviewSlots: [String]
        interviewLocation: String
    }

    input MatchingCandidateInput {
        id: String
        fullName: String
        age: Int
        sex: Sex
        city: String
        email: String
        phone: String
        status: MatchedCandidateStatus
    }

    input JobInput {
        id: String!
        companyName: String
        ageRange: String
        desiredTP: DesiredTP
        desiredSex: Sex
        drivingLicencseB: Boolean
        professionalExperience: Boolean
        status: JobStatus
        localisation: [Localisation]
        sector: Sector
        matchedCandidate: [MatchingCandidateInput]
    }

    type CompanyInfo {
        id: Int
        name: String
        legalReferent: String
        phone: String
        email: String
        address: String
        sector: String
        mainActivity: String
        siret: String
        idcc: String
        ape: String
        notes: String
        conclusion: String
        status: String
    }

    type AbPositionInfo {
        trainingDomain: String
        jobTitle: String
        selectedMissions: [String!]!
        localisation: String
    }

    type AbInfo {
        id: Int
        legalRepFunction: String
        recruitmentResponsibleName: String
        recruitmentResponsiblePhone: String
        recruitmentResponsibleEmail: String
        recruitmentResponsibleFunction: String
        companySectors: [String!]!
        companyDescription: String
        opco: String
        referralSource: String
        positionsCount: Int
        positions: [AbPositionInfo!]!
        trainingDomain: String
        jobTitle: String
        selectedMissions: [String!]!
        localisation: String
        otherMissions: String
        jobDescriptionMissions: [String!]!
        jobDescriptionOther: String
        educationLevel: String
        drivingLicense: String
        experienceRequired: String
        ageRequirements: [String!]!
        ageMin: Int
        ageMax: Int
        softSkills: String
        scheduleOptions: [String!]!
        conditions: String
        additionalComments: String
        recruitmentMethod: String
        immersionPeriod: String
        trainingDays: String
        yousignSignatureRequestID: String
        status: String
        createdAt: String
    }

    type JobCompanyInfo {
        companyName: String
        company: CompanyInfo
        ab: AbInfo
    }

    enum PlacementKind {
        IMMERSING
        CONTRACT
    }

    """
    Placement courant d'un candidat (immersion ou contrat), dérivé des offres.
    """
    type CandidatePlacement {
        companyName: String
        kind: PlacementKind!
        since: String
        immersionEndDate: String
    }

    type Query {
        jobs: [Job!]!
        matchJob(id: String!): Job!
        jobCompanyInfo(jobId: String!): JobCompanyInfo!
        offerResponseLinks(jobId: String!, candidateId: String!): OfferLinks!
        candidateMatchedJobIds(candidateId: String!): [String!]!
        candidatePlacement(candidateId: String!): CandidatePlacement
    }

    type Mutation {
        updateJob(id: String!, job: JobInput!): Job
        unmatchJob(id: String!): Job
        addCandidateToJob(jobId: String!, candidateId: String!): Job
        removeCandidateFromJob(jobId: String!, candidateId: String!): Job
        updateMatchedCandidateStatus(jobId: String!, candidateId: String!, status: MatchedCandidateStatus!): Job
        addManualProposedCandidate(
            jobId: String!
            candidateId: String!
            interviewDate: String!
            interviewHour: String!
            interviewLocation: String!
        ): Job
        addManualProposedCandidateForImmersion(
            jobId: String!
            candidateId: String!
            immersionStartDate: String!
            immersionEndDate: String!
            immersionLocation: String!
        ): Job
        createMatchSession(jobId: String!, companyEmail: String!, candidates: [ProposedCandidateInput!]!): String!
        setInterviewConclusion(
            jobId: String!
            candidateId: String!
            conclusion: InterviewConclusion!
            immersionStartDate: String
            immersionEndDate: String
        ): Job
        setImmersionConclusion(jobId: String!, candidateId: String!, conclusion: ImmersionConclusion!): Job
    }
`;
