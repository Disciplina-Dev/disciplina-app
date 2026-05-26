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
    }

    type Query {
        companies: [CompanyWithSalePerson]!
        salePersons: [User!]!
        salePerson(id: Int!): User
        companyByCommercial(userID: Int!): [CompanyWithSalePerson!]!
        companyBySiret(siret: String!): Company
    }

    type Mutation {
        createCompany(input: CompanyInput!): Company!
        updateCompany(id: Int!, input: CompanyInput!): Company!
        deleteCompany(id: Int!): Boolean!
    }
`;
