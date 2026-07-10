import gql from 'graphql-tag';

export const typeDefs = gql`
    enum Localisation {
        SAINT_DENIS
        SAINTE_MARIE
        SAINTE_SUZANNE
        SAINT_PAUL
        SAINT_GILLES
        LA_POSSESSION
        LE_PORT
        TROIS_BASSINS
        SAINT_LEU
        SAINT_PIERRE
        CILAOS
        ETANG_SALE
        SAINT_LOUIS
        ENTRE_DEUX
        LES_AVIRONS
        LE_TAMPON
        SAINT_PHILLIPE
        SAINT_JOSEPH
        PETIT_ILE
        SAINTE_ROSE
        SAINT_BENOIT
        BRAS_PANON
        SAINT_ANDRE
        LA_PLAINE_DES_PALMISTES
        SALAZIE
        SAINTE_ANNE
    }

    enum TrainingDomain {
        SECRETARIAT
        VENTE
    }

    enum Opco {
        AKTO
        ATLAS
        AFDAS
        CONSTRUCTYS
        OCAPIAT
        OPCO_2I
        OPCO_EP
        OPCO_MOBILITES
        OPCO_SANTE
        OPCOMMERCE
        UNIFORMATION
    }

    enum ReferralSource {
        KOANN
        E2CR
        FRANCE_TRAVAIL
        TELEVISION_PUB
        BOUCHE_A_OREILLE
        MISSION_LOCALE
        SALON
        RSMA
        RESEAUX_SOCIAUX
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

    type NeedsAnalysisPosition {
        trainingDomain: TrainingDomain!
        jobTitle: String!
        selectedMissions: [String!]!
        localisation: [Localisation!]!
    }

    input NeedsAnalysisPositionInput {
        trainingDomain: TrainingDomain!
        jobTitle: String!
        selectedMissions: [String!]!
        localisation: [Localisation!]!
    }

    type NeedsAnalysis {
        id: ID!
        companyID: Int!
        userID: Int!
        legalRepFunction: String
        recruitmentResponsibleName: String
        recruitmentResponsiblePhone: String
        recruitmentResponsibleEmail: String
        recruitmentResponsibleFunction: String
        companySectors: [String!]!
        companyDescription: String
        opco: Opco
        referralSource: ReferralSource
        positionsCount: Int!
        positions: [NeedsAnalysisPosition!]!
        localisation: Localisation
        trainingDomain: TrainingDomain!
        jobTitle: String!
        selectedMissions: [String!]!
        otherMissions: String
        jobDescriptionMissions: [String!]!
        jobDescriptionOther: String
        educationLevel: EducationLevel
        drivingLicense: DrivingLicense!
        experienceRequired: ExperienceRequired!
        ageRequirements: [String!]!
        ageMin: Int
        ageMax: Int
        softSkills: String
        scheduleOptions: [String!]!
        conditions: String
        additionalComments: String
        recruitmentMethod: RecruitmentMethod!
        immersionPeriod: ImmersionPeriod!
        trainingDays: String!
        yousignSignatureRequestID: String
        status: NeedsAnalysisStatus!
        createdAt: String
        updatedAt: String
    }

    input NeedsAnalysisInput {
        companyID: Int
        userID: Int
        legalRepFunction: String
        recruitmentResponsibleName: String
        recruitmentResponsiblePhone: String
        recruitmentResponsibleEmail: String
        recruitmentResponsibleFunction: String
        companySectors: [String!]
        companyDescription: String
        opco: Opco
        referralSource: ReferralSource
        positionsCount: Int
        positions: [NeedsAnalysisPositionInput!]
        localisation: Localisation
        trainingDomain: TrainingDomain
        jobTitle: String
        selectedMissions: [String!]
        otherMissions: String
        jobDescriptionMissions: [String!]
        jobDescriptionOther: String
        educationLevel: EducationLevel
        drivingLicense: DrivingLicense
        experienceRequired: ExperienceRequired
        ageRequirements: [String!]
        ageMin: Int
        ageMax: Int
        softSkills: String
        scheduleOptions: [String!]
        conditions: String
        additionalComments: String
        recruitmentMethod: RecruitmentMethod
        immersionPeriod: ImmersionPeriod
        trainingDays: String
        yousignSignatureRequestID: String
        status: NeedsAnalysisStatus
    }

    type AbDriveFolder {
        sector: String!
        kind: String!
        folderId: String
    }

    type AbDriveConfig {
        sectorFolders: [AbDriveFolder!]!
    }

    input AbDriveFolderInput {
        sector: String!
        kind: String!
        folderId: String
    }

    input AbDriveConfigInput {
        sectorFolders: [AbDriveFolderInput!]!
    }

    extend type Query {
        needsAnalyses: [NeedsAnalysis!]!
        needsAnalysis(id: ID!): NeedsAnalysis
        needsAnalysesByCompany(companyID: Int!): [NeedsAnalysis!]!
        abDriveConfig: AbDriveConfig!
    }

    extend type Mutation {
        createNeedsAnalysis(input: NeedsAnalysisInput!): NeedsAnalysis!
        updateNeedsAnalysis(id: ID!, input: NeedsAnalysisInput!): NeedsAnalysis!
        deleteNeedsAnalysis(id: ID!): Boolean!
        updateAbDriveConfig(input: AbDriveConfigInput!): AbDriveConfig!
    }
`;
