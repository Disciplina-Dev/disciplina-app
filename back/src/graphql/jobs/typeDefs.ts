import gql from 'graphql-tag';

export const typeDefs = gql`
    enum JobStatus {
        NOT_MATCHED
        MATCHED
        CV_SEND
        IMMERSING
        CONTRACT
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

    type MatchingCandidate {
        id: String
        fullName: String
        age: Int
        sex: Sex
        city: Localisation
        email: String
        phone: String
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
    }

    input MatchingCandidateInput {
        id: String
        fullName: String
        age: Int
        sex: Sex
        city: Localisation
        email: String
        phone: String
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

    type Query {
        jobs: [Job!]!
        matchJob(id: String!): Job!
        offerResponseLinks(jobId: String!, candidateId: String!): OfferLinks!
        candidateMatchedJobIds(candidateId: String!): [String!]!
    }

    type Mutation {
        updateJob(id: String!, job: JobInput!): Job
        unmatchJob(id: String!): Job
        addCandidateToJob(jobId: String!, candidateId: String!): Job
        removeCandidateFromJob(jobId: String!, candidateId: String!): Job
    }
`;
