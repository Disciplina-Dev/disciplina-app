import { gql } from 'urql'

export const GET_SALE_PERSONS = gql`
  query GetSalePersons {
    salePersons {
      id
      email
      name
    }
  }
`

export const GET_SALE_PERSON = gql`
  query GetSalePerson($id: Int!) {
    salePerson(id: $id) {
      id
      email
      name
    }
  }
`

export const GET_COMPANIES = gql`
  query GetCompanies {
    companies {
      company {
        id
        salePersonID
        legalReferent
        name
        phone
        email
        address
        sector
        mainActivity
        siret
        idcc
        ape
        notes
        conclusion
      }
      salePerson {
        id
        email
        name
      }
    }
  }
`

export const GET_COMPANY_BY_SIRET = gql`
  query GetCompanyBySiret($siret: String!) {
    companyBySiret(siret: $siret) {
      id
      salePersonID
      name
      phone
      email
      address
      sector
      mainActivity
      siret
      idcc
      ape
      notes
      conclusion
    }
  }
`

export const GET_COMPANIES_BY_COMMERCIAL = gql`
  query GetCompaniesByCommercial($salePersonID: Int!) {
    companyByCommercial(salePersonID: $salePersonID) {
      company {
        id
        salePersonID
        name
        phone
        email
        address
        sector
        mainActivity
        siret
        idcc
        ape
        notes
        conclusion
      }
      salePerson {
        id
        email
        name
      }
    }
  }
`

export const CREATE_COMPANY = gql`
  mutation CreateCompany($input: CompanyInput!) {
    createCompany(input: $input) {
      id
      salePersonID
      name
      phone
      email
      address
      sector
      mainActivity
      siret
      idcc
      ape
      notes
      conclusion
    }
  }
`

export const UPDATE_COMPANY = gql`
  mutation UpdateCompany($id: Int!, $input: CompanyInput!) {
    updateCompany(id: $id, input: $input) {
      id
      salePersonID
      name
      phone
      email
      address
      sector
      mainActivity
      siret
      idcc
      ape
      notes
      conclusion
    }
  }
`

export const DELETE_COMPANY = gql`
  mutation DeleteCompany($id: Int!) {
    deleteCompany(id: $id)
  }
`

// ─── Candidats (MongoDB) ─────────────────────────────────────────────────────

export const GET_CANDIDATES = gql`
  query GetCandidates {
    candidates {
      id
      status
      tpType
      identity {
        fullName
        email
        phone
      }
      schoolLevel
    }
  }
`

export const CREATE_CANDIDATE = gql`
  mutation CreateCandidate($input: CreateCandidateInput!) {
    createCandidate(input: $input) {
      id
      status
      tpType
      identity {
        fullName
        email
        phone
      }
      schoolLevel
    }
  }
`
