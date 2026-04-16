import gql from 'graphql-tag';

export const typeDefs = gql`
  type SalePerson {
    id: Int!
    email: String!
    name: String!
  }

  type Company {
    id: Int!
    salePersonID: Int
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
    salePerson: SalePerson
  }

  input CompanyInput {
    salePersonID: Int
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
    salePersons: [SalePerson!]!
    salePerson(id: Int!): SalePerson
    companyByCommercial(salePersonID: Int!): [CompanyWithSalePerson!]!
    companyBySiret(siret: String!): Company
  }

  type Mutation {
    createCompany(input: CompanyInput!): Company!
    updateCompany(id: Int!, input: CompanyInput!): Company!
    deleteCompany(id: Int!): Boolean!
  }
`;