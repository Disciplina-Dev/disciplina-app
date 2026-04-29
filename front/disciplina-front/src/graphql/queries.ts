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
      trainingSite
      skillsAssessment {
        competence
        level
      }
      identity {
        fullName
        email
        phone
        drivingLicenseB
        age
        city
      }
      education {
        schoolLevel
      }
      profile {
        frenchLevel
        englishLevel
        qualities
      }
      synthesis {
        feasibilityConclusion
      }
      professionalProjects {
        careerObjectives
        apprenticeshipMotivation
      }
      background {
        lastDiploma
      }
      pdfLink
    }
  }
`

export const GET_CANDIDATE_BY_ID = gql`
  query GetCandidateById($id: String!) {
    candidate(id: $id) {
      id
      status
      tpType
      trainingSite
      identity {
        fullName
        email
        phone
        age
        city
        postalCode
        drivingLicenseB
      }
      education {
        schoolLevel
      }
      background {
        lastDiploma
        professionalExperiences {
          position
          company
          duration
        }
      }
      profile {
        frenchLevel
        englishLevel
        qualities
        digitalSkills
      }
      professionalProjects {
        careerObjectives
        apprenticeshipMotivation
      }
      synthesis {
        feasibilityConclusion
      }
      skillsAssessment {
        competence
        level
      }
      jobInfo {
        availabilityDate
        geographicMobility
      }
      pdfLink
    }
  }
`

export const UPDATE_CANDIDATE = gql`
  mutation UpdateCandidate($id: String!, $input: UpdateCandidateInput!) {
    updateCandidate(id: $id, input: $input) {
      id
      status
      tpType
      trainingSite
      skillsAssessment {
        competence
        level
      }
      identity {
        fullName
        email
        phone
        drivingLicenseB
        age
      }
      education {
        schoolLevel
      }
      profile {
        frenchLevel
        englishLevel
        qualities
      }
      synthesis {
        feasibilityConclusion
      }
      professionalProjects {
        careerObjectives
        apprenticeshipMotivation
      }
      background {
        lastDiploma
      }
      pdfLink
    }
  }
`

export const CREATE_CANDIDATE = gql`
  mutation CreateCandidate($input: CreateCandidateInput!) {
    createCandidate(input: $input) {
      id
      status
      tpType
      trainingSite
      skillsAssessment {
        competence
        level
      }
      identity {
        fullName
        email
        phone
        drivingLicenseB
        age
      }
      education {
        schoolLevel
      }
      profile {
        frenchLevel
        englishLevel
        qualities
      }
      synthesis {
        feasibilityConclusion
      }
      professionalProjects {
        careerObjectives
        apprenticeshipMotivation
      }
      background {
        lastDiploma
      }
      pdfLink
    }
  }
`

// ─── Authentication ──────────────────────────────────────────────────────────

export const LOGIN_USER = gql`
  mutation LoginUser($email: String!, $passwordPlain: String!) {
    login(email: $email, passwordPlain: $passwordPlain) {
      token
      user {
        id
        email
        name
        role
        sectors
      }
    }
  }
`

export const REGISTER_USER = gql`
  mutation RegisterUser(
    $email: String!
    $name: String!
    $passwordPlain: String!
    $role: Role!
    $sectors: [String!]
  ) {
    register(
      email: $email
      name: $name
      passwordPlain: $passwordPlain
      role: $role
      sectors: $sectors
    ) {
      id
      email
      name
      role
      sectors
    }
  }
`
