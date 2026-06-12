import gql from 'graphql-tag';

export const typeDefs = gql`
    type Company {
        id: Int!
        userID: Int
        legalReferent: String
        name: String
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
        relanceDate: String
        createdAt: String
        relanceType: Int
        relanceTemplateId: String
    }

    input CompanyFiltersInput {
        status: [String!]
        userID: Int
        sector: String
        relance: String
        unassigned: Boolean
        createdFrom: String
        createdTo: String
    }

    type CompanyWithSalePerson {
        company: Company!
        salePerson: User
    }

    input CompanyInput {
        userID: Int
        legalReferent: String
        name: String
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
        relanceDate: String
        relanceType: Int
        relanceTemplateId: String
    }

    type CompanyEdge {
        node: CompanyWithSalePerson!
        cursor: String!
    }

    type CompanyConnection {
        edges: [CompanyEdge!]!
        pageInfo: PageInfo!
    }

    type StatusCount {
        userID: Int
        status: String
        count: Int!
    }

    type PeriodStatusCount {
        userID: Int
        status: String
        week: Int!
        month: Int!
        count: Int!
    }

    type CompanyStats {
        current: [StatusCount!]!
        byPeriod: [PeriodStatusCount!]!
        years: [Int!]!
    }

    type Query {
        companies(first: Int, after: String, search: String, filters: CompanyFiltersInput): CompanyConnection!
        companyStats(year: Int!): CompanyStats!
        salePersons: [User!]!
        salePerson(id: Int!): User
        companyByCommercial(userID: Int!): [CompanyWithSalePerson!]!
        companyBySiret(siret: String!): Company
    }

    type Mutation {
        createCompany(input: CompanyInput!): Company!
        updateCompany(id: Int!, input: CompanyInput!): Company!
        deleteCompany(id: Int!): Boolean!
        blacklistCompany(id: Int!, reason: String!, allBlacklist: Boolean!): Boolean!
    }
`;
