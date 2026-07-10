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

    enum TitleProfessionalType {
        AD
        CC
        NTC
        REM
        SA
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

    type CompanyInfos {
        id: Int
        name: String
        ape: String
        idcc: String
        siret: String
        mainActivity: String
        opco: Opco
        referralSource: ReferralSource
        sector: String
        activities: [String!]!
        description: String
        postalCode: String
        commune: String
    }

    type SalerInfo {
        id: Int
        email: String
    }

    type ReferentDetails {
        name: String
        phone: String
        email: String
        function: String
    }

    type Referents {
        isSame: Boolean
        legalReferents: ReferentDetails
        recruitmentReferents: ReferentDetails
    }

    type OfferCriteria {
        educationLevel: EducationLevel
        drivingLicense: Boolean
        experienceRequired: Boolean
        trainingDomain: TrainingDomain
        ageMin: Int
        ageMax: Int
        desiredSex: String
        softSkills: String
        scheduleOptions: [String!]!
        conditions: String
        additionalComments: String
    }

    input OfferCriteriaInput {
        educationLevel: EducationLevel
        drivingLicense: Boolean
        experienceRequired: Boolean
        ageMin: Int
        ageMax: Int
        desiredSex: String
        softSkills: String
        scheduleOptions: [String!]
        conditions: String
        additionalComments: String
    }

    type Position {
        localisation: [Localisation!]!
        tpType: TitleProfessionalType
        trainingDomain: TrainingDomain
        title: String!
        missions: [String!]!
        descriptionMissions: [String!]!
        otherDescriptionMissions: String
        otherMissions: String
        criteria: OfferCriteria
    }

    input PositionInput {
        localisation: [Localisation!]!
        trainingDomain: TrainingDomain
        title: String!
        missions: [String!]
        descriptionMissions: [String!]
        otherDescriptionMissions: String
        otherMissions: String
        criteria: OfferCriteriaInput
    }

    type NeedsAnalysis {
        id: ID!
        companyInfos: CompanyInfos
        salerInfo: SalerInfo
        referents: Referents
        positionsCount: Int!
        positions: [Position!]!
        recruitmentMethod: RecruitmentMethod
        immersionPeriod: ImmersionPeriod
        trainingDays: String
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
        postalCode: String
        commune: String
        positions: [PositionInput!]
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

    type Query {
        needsAnalyses: [NeedsAnalysis!]!
        needsAnalysis(id: ID!): NeedsAnalysis
        needsAnalysesByCompany(companyID: Int!): [NeedsAnalysis!]!
        abDriveConfig: AbDriveConfig!
    }

    type Mutation {
        createNeedsAnalysis(input: NeedsAnalysisInput!): NeedsAnalysis!
        updateNeedsAnalysis(id: ID!, input: NeedsAnalysisInput!): NeedsAnalysis!
        deleteNeedsAnalysis(id: ID!): Boolean!
        updateAbDriveConfig(input: AbDriveConfigInput!): AbDriveConfig!
    }
`;
