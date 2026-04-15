import gql from 'graphql-tag';

export const typeDefs = gql`
  type Company {
    id: Int!
    salePersonID: String
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

  input CompanyInput {
    salePersonID: String
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
    companies: [Company!]!
    companyByCommercial(salePersonID: String!): [Company!]!
    companyBySiret(siret: String!): Company
  }

  type Mutation {
    createCompany(input: CompanyInput!): Company!
    updateCompany(id: Int!, input: CompanyInput!): Company!
    deleteCompany(id: Int!): Boolean!
  }
`;