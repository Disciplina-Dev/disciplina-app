import gql from 'graphql-tag';

export const typeDefs = gql`
    enum Localisation {
        NORD
        OUEST
        SUD
    }

    enum TrainingDomain {
        SECRETARIAT
        VENTE
    }

    enum EducationLevel {
        BAC
        BAC_PLUS_2
        BAC_PLUS_3
    }

    enum DrivingLicense {
        OUI
        OPTIONNEL
    }

    enum ExperienceRequired {
        DEBUTANT
        OBLIGATOIRE
    }

    enum RecruitmentMethod {
        ALL_CV
        PRESELECTION
        PRE_INTERVIEW
    }

    enum ImmersionPeriod {
        OUI
        NON
        A_DISCUTER
    }

    enum NeedsAnalysisStatus {
        BROUILLON
        EN_ATTENTE_SIGNATURE
        SIGNE
        EXPIRE
    }

    type NeedsAnalysis {
        id: Int!
        companyID: Int!
        userID: Int!
        recruitmentResponsibleName: String
        recruitmentResponsiblePhone: String
        recruitmentResponsibleEmail: String
        positionsCount: Int!
        localisation: Localisation!
        trainingDomain: TrainingDomain!
        jobTitle: String!
        selectedMissions: [String!]!
        otherMissions: String
        educationLevel: EducationLevel!
        drivingLicense: DrivingLicense!
        experienceRequired: ExperienceRequired!
        ageRequirements: [String!]!
        softSkills: String
        recruitmentMethod: RecruitmentMethod!
        immersionPeriod: ImmersionPeriod!
        trainingDays: String! # Stringified JSON representation of the schedule grid
        yousignSignatureRequestID: String
        status: NeedsAnalysisStatus!
        createdAt: String
        updatedAt: String
    }

    input NeedsAnalysisInput {
        companyID: Int
        userID: Int
        recruitmentResponsibleName: String
        recruitmentResponsiblePhone: String
        recruitmentResponsibleEmail: String
        positionsCount: Int
        localisation: Localisation
        trainingDomain: TrainingDomain
        jobTitle: String
        selectedMissions: [String!]
        otherMissions: String
        educationLevel: EducationLevel
        drivingLicense: DrivingLicense
        experienceRequired: ExperienceRequired
        ageRequirements: [String!]
        softSkills: String
        recruitmentMethod: RecruitmentMethod
        immersionPeriod: ImmersionPeriod
        trainingDays: String # Stringified JSON
        yousignSignatureRequestID: String
        status: NeedsAnalysisStatus
    }

    extend type Query {
        needsAnalyses: [NeedsAnalysis!]!
        needsAnalysis(id: Int!): NeedsAnalysis
        needsAnalysesByCompany(companyID: Int!): [NeedsAnalysis!]!
    }

    extend type Mutation {
        createNeedsAnalysis(input: NeedsAnalysisInput!): NeedsAnalysis!
        updateNeedsAnalysis(id: Int!, input: NeedsAnalysisInput!): NeedsAnalysis!
        deleteNeedsAnalysis(id: Int!): Boolean!
    }
`;
