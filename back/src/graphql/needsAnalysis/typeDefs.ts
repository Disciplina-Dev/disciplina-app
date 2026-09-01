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

    enum AbStatus {
        ACTIVE
        ARCHIVED
        INACTIVE
    }

    enum AdministrationType {
        NON_RENSEIGNE
        ADMINISTRATION_PUBLIQUE
        ADMINISTRATION_PRIVEE
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
        hasVehicle: Boolean
        experienceRequired: Boolean
        trainingDomain: TrainingDomain
        ageMin: Int
        ageMax: Int
        desiredSex: String
        softSkills: String
        scheduleOptions: [ScheduleSlot!]!
        conditions: String
        additionalComments: String
    }

    type ScheduleSlot {
        day: String
        startHour: String
        endHour: String
    }

    input ScheduleSlotInput {
        day: String
        startHour: String
        endHour: String
    }

    input OfferCriteriaInput {
        educationLevel: EducationLevel
        drivingLicense: Boolean
        hasVehicle: Boolean
        experienceRequired: Boolean
        ageMin: Int
        ageMax: Int
        desiredSex: String
        softSkills: String
        scheduleOptions: [ScheduleSlotInput!]
        conditions: String
        additionalComments: String
    }

    type PositionTp {
        tpType: TitleProfessionalType
        missions: [String!]!
        descriptionMissions: [String!]!
        otherDescriptionMissions: String
        otherMissions: String
    }

    input PositionTpInput {
        tpType: TitleProfessionalType
        missions: [String!]
        descriptionMissions: [String!]
        otherDescriptionMissions: String
        otherMissions: String
    }

    type Position {
        localisation: [Localisation!]!
        desiredTp: [PositionTp!]!
        trainingDomain: TrainingDomain
        jobRole: String
        title: String!
        count: Int
        criteria: OfferCriteria
    }

    input PositionInput {
        localisation: [Localisation!]!
        desiredTp: [PositionTpInput!]!
        trainingDomain: TrainingDomain
        jobRole: String
        title: String!
        count: Int
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
        abStatus: AbStatus!
        isRelanceDisabled: Boolean!
        administrationType: AdministrationType!
        tags: [String!]
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
        administrationType: AdministrationType
        positions: [PositionInput!]
        recruitmentMethod: RecruitmentMethod
        immersionPeriod: ImmersionPeriod
        trainingDays: String
        yousignSignatureRequestID: String
        status: NeedsAnalysisStatus
        tags: [String!]
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

    type PageInfo {
        hasNextPage: Boolean!
        hasPreviousPage: Boolean!
        startCursor: String
        endCursor: String
    }

    type NeedsAnalysisEdge {
        node: NeedsAnalysis!
        cursor: String!
    }

    type NeedsAnalysisConnection {
        edges: [NeedsAnalysisEdge!]!
        pageInfo: PageInfo!
    }

    input OfferFilterInput {
        search: String
        statuses: [String!]
        desiredTp: [String!]
        sectors: [String!]
        localisations: [String!]
        abStatus: AbStatus
        administrationTypes: [AdministrationType!]
    }

    type NeedsAnalysisDashboardItem {
        id: ID!
        companyName: String
        positionsCount: Int!
        createdAt: String
        status: NeedsAnalysisStatus!
    }

    type NeedsAnalysisDashboard {
        items: [NeedsAnalysisDashboardItem!]!
        totalCount: Int!
    }

    type Query {
        needsAnalysis(id: ID!): NeedsAnalysis
        needsAnalysesByCompany(companyID: Int!): [NeedsAnalysis!]!
        needsAnalysesPage(first: Int, after: String, filter: OfferFilterInput): NeedsAnalysisConnection!
        needsAnalysesForDashboard(limit: Int): NeedsAnalysisDashboard!
        abDriveConfig: AbDriveConfig!
    }

    type Mutation {
        createNeedsAnalysis(input: NeedsAnalysisInput!): NeedsAnalysis!
        updateNeedsAnalysis(id: ID!, input: NeedsAnalysisInput!): NeedsAnalysis!
        deleteNeedsAnalysis(id: ID!): Boolean!
        updateAbDriveConfig(input: AbDriveConfigInput!): AbDriveConfig!
        # Marque une AB comme signée sans passer par le flux Yousign : réservé au cas où le
        # contrat a été trouvé hors sourcing Disciplina (candidat ayant trouvé sa propre entreprise).
        markNeedsAnalysisSigned(id: ID!): NeedsAnalysis!
        # Force le statut d'onglet d'une AB (Actif/Archivé/Inactif) ; abStatus à null le
        # réinitialise au calcul automatique dérivé des offres.
        updateNeedsAnalysisAbStatus(id: ID!, abStatus: AbStatus): NeedsAnalysis!
        # Désactive/réactive la relance automatique de signature (non destructif, garde l'AB et ses offres).
        setAbRelanceDisabled(id: ID!, disabled: Boolean!): NeedsAnalysis!
    }
`;
