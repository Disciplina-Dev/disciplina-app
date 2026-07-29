import gql from 'graphql-tag';

export const typeDefs = gql`
    type Company {
        id: Int!
        abID: String
        userID: Int
        legalReferent: String
        name: String
        phone: String
        email: String
        address: String
        sector: String
        mainActivity: String
        siret: String
        siren: String
        idcc: String
        ape: String
        notes: String
        conclusion: String
        status: String
        relanceDate: String
        createdAt: String
        relanceType: Int
        relanceTemplateId: String
        relanceChannel: String
    }

    type CompanySirenGroup {
        siren: String!
        count: Int!
        companies: [Company!]!
    }

    type CompanySirenGroupEdge {
        node: CompanySirenGroup!
        cursor: String!
    }

    type CompanySirenGroupConnection {
        edges: [CompanySirenGroupEdge!]!
        pageInfo: PageInfo!
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
        relanceChannel: String
    }

    type CompanyEdge {
        node: CompanyWithSalePerson!
        cursor: String!
    }

    type CompanyConnection {
        edges: [CompanyEdge!]!
        pageInfo: PageInfo!
    }

    type BlacklistedCompany {
        id: Int!
        abID: String
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
        relanceChannel: String
        allBlacklist: Boolean!
    }

    type BlacklistedCompanyEdge {
        node: BlacklistedCompany!
        cursor: String!
    }

    type BlacklistedCompanyConnection {
        edges: [BlacklistedCompanyEdge!]!
        pageInfo: PageInfo!
    }

    type CompanyConflict {
        id: Int!
        abID: String
        userID: Int
        legalReferent: String
        name: String
        phone: String
        email: String
        address: String
        sector: String
        mainActivity: String
        siret: String
        siren: String
        idcc: String
        ape: String
        notes: String
        conclusion: String
        status: String
        relanceDate: String
        createdAt: String
        relanceType: Int
        relanceTemplateId: String
        relanceChannel: String
        candidateUserIds: [Int!]
    }

    type CompanyConflictEdge {
        node: CompanyConflict!
        cursor: String!
    }

    type CompanyConflictConnection {
        edges: [CompanyConflictEdge!]!
        pageInfo: PageInfo!
    }

    input CompanyConflictInput {
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
        userId: Int
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

    type CompanyHistory {
        id: Int!
        companyID: Int!
        updatedAt: String!
        updatedColumn: String!
        status: String!
        previousStatus: String
        modifiedBy: Int
        changes: [FieldChange!]!
    }

    type FieldChange {
        column: String!
        from: String
        to: String
    }

    type ContactLog {
        id: Int!
        companyID: Int!
        userID: Int!
        comment: String!
        createdAt: String!
    }

    type ContactLogUserCount {
        userID: Int!
        count: Int!
    }

    type ContactLogStats {
        total: Int!
        byUser: [ContactLogUserCount!]!
    }

    type CompanyOption {
        id: Int!
        name: String
    }

    type Query {
        companies(first: Int, after: String, search: String, filters: CompanyFiltersInput): CompanyConnection!
        companiesBySiren(first: Int, after: String, filters: CompanyFiltersInput): CompanySirenGroupConnection!
        companyOptions: [CompanyOption!]!
        companyStats(year: Int!): CompanyStats!
        salePersons: [User!]!
        rhUsers: [User!]!
        salePerson(id: Int!): User
        companyByCommercial(userID: Int!): [CompanyWithSalePerson!]!
        companyBySiret(siret: String!): Company
        blacklistedCompanies(first: Int, after: String, search: String): BlacklistedCompanyConnection!
        companyConflicts(first: Int, after: String, search: String, conflictType: String): CompanyConflictConnection!
        companyHistory(companyID: Int!): [CompanyHistory!]!
        contactLogs(companyID: Int!): [ContactLog!]!
        contactLogStats: ContactLogStats!
    }

    type Mutation {
        createCompany(input: CompanyInput!): Company!
        updateCompany(id: Int!, input: CompanyInput!): Company!
        deleteCompany(id: Int!): Boolean!
        blacklistCompany(id: Int!, reason: String!, allBlacklist: Boolean!): Boolean!
        unblacklistCompany(id: Int!): Boolean!
        deleteAndBlacklistCompany(companyId: Int!, reason: String!, allBlacklist: Boolean!): Boolean!
        updateCompanyConflict(id: Int!, input: CompanyConflictInput!): CompanyConflict!
        resolveCompanyConflict(id: Int!): Company!
        deleteCompanyConflict(id: Int!): Boolean!
        deleteCompanyConflictsByType(conflictType: String!): Int!
        createContactLog(companyID: Int!, comment: String!): ContactLog!
    }
`;
