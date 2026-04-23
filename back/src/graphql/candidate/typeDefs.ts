import gql from 'graphql-tag';

export const typeDefs = gql`
    enum TitleProfessionalType {
        AD
        CC
        NTC
        REM
        SA
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
        CONTRACTED
        IMMERSING
        BANNED
    }

    enum TrainingSite {
        NORD_SAINTE_MARIE
        OUEST_SAINT_PAUL
        SUD_SAINT_PIERRE
    }

    input CreateCandidateIdentityInput {
        fullName: String!
        email: String!
        phone: String!
    }

    input CreateCandidateInput {
        status: CandidateStatus!
        tpType: TitleProfessionalType!
        identity: CreateCandidateIdentityInput!
        schoolLevel: SchoolLevel
        trainingSite: TrainingSite
    }

    type CandidateIdentity {
        fullName: String!
        email: String!
        phone: String!
    }

    type CandidateSummary {
        id: String!
        status: CandidateStatus!
        tpType: TitleProfessionalType!
        identity: CandidateIdentity!
        schoolLevel: SchoolLevel
    }

    type Query {
        candidates: [CandidateSummary!]!
    }

    type Mutation {
        createCandidate(input: CreateCandidateInput!): CandidateSummary!
    }
`;
