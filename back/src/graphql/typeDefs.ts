import gql from 'graphql-tag';

export const typeDefs = gql`
  type Company {
    id: Int!
    owner: String
    commercial: String
    contactName: String
    phone: String
    email: String
    address: String
    sector: String
    jobDescription: String
    siret: String
    idcc: String
    notes: String
    conclusion: String
  }

  input CompanyInput {
    owner: String
    commercial: String
    contactName: String
    phone: String
    email: String
    address: String
    sector: String
    jobDescription: String
    siret: String
    idcc: String
    notes: String
    conclusion: String
  }

  type Query {
    companies: [Company!]!
    companyByCommercial(commercial: String!): [Company!]!
    companyBySiret(siret: String!): Company
  }

  type Mutation {
    createCompany(input: CompanyInput!): Company!
    updateCompany(id: Int!, input: CompanyInput!): Company!
    deleteCompany(id: Int!): Boolean!
  }
`;