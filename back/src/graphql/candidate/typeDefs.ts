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
        RECHERE
        NE RECHERCHE PAS
        RUPTURE
        IMMERSION
        CONTRAT
        BANNI
    }

    type CandidateIdentity {
        fullName: String!
        email: String!
        phone: String!
    }

    type CandidateSummary {
        id: String!
        status: CanidateStatus!
        tpType: TitleProfessionalType!
        identity: CandidateIdentity!
        schoolLevel: SchoolLevel
    }

    type Query {
        candidates: [CandidateSummary!]!
    }
`;
