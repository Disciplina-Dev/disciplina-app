import gql from 'graphql-tag';

export const typeDefs = gql`
    enum OfferStatus {
        NOT_MATCHED
        MATCHED
        CV_SEND
        IMMERSING
        CONTRACT
    }

    enum MatchedCandidateStatus {
        PRE_SELECTED
        PRE_SELECTED_MAIL_SEND
        DECLINED
        ACCEPTED
        SEND
        REFUSED
        INTERVIEW
        IMMERSING
        CONTRACT
    }

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

    enum DesiredTP {
        AD
        CC
        NTC
        REM
        SA
    }

    enum Sex {
        MIXTE
        FILLE
        GARCON
    }

    enum Sector {
        BOULANGERIE
        RESTAURATION
        STATION
        PAP
        LIBRE_SERVICE
        TELEPHONIE
        AUTO
        COMMERCIAL
        BIJOUX
        COSMETIQUE
        IMMOBILIER
        ASSURANCE
        ANIMAUX
        SPORT
        ENFANT
        PHARMACIE
        BAZAR
        BTP
        ASSOCIATION
        MEDICAL
        ENERGIE
        IMPORT_EXPORT
        SOCIAL
        NONE
    }

    enum InterviewConclusion {
        REJECTED
        IMMERSING
        CONTRACT
    }

    enum ImmersionConclusion {
        REJECTED
        CONTRACT
    }

    type MatchingCandidate {
        id: String
        fullName: String
        age: Int
        sex: Sex
        city: String
        email: String
        phone: String
        status: MatchedCandidateStatus
        description: String
        identityDescription: String
        comment: String
        cvWebview: String
        hasCv: Boolean
        interviewLocation: String
        bookedInterviewSlot: String
        interviewConclusion: InterviewConclusion
        immersionStartDate: String
        immersionEndDate: String
        immersionLocation: String
        immersionConclusion: ImmersionConclusion
    }

    type ProposedCandidate {
        id: String
        fullName: String
        age: Int
        sex: Sex
        city: String
        email: String
        phone: String
        status: MatchedCandidateStatus
        description: String
        identityDescription: String
        comment: String
        cvWebview: String
        hasCv: Boolean
        interviewLocation: String
        bookedInterviewSlot: String
        interviewConclusion: InterviewConclusion
        immersionStartDate: String
        immersionEndDate: String
        immersionLocation: String
        immersionConclusion: ImmersionConclusion
    }

    input ProposedCandidateInput {
        id: String!
        description: String
    }

    type OfferLinks {
        ouiUrl: String!
        nonUrl: String!
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

    type CompanyInfos {
        id: Int
        name: String
        address: String
        email: String
        activities: [String!]
    }

    type OfferTp {
        tpType: DesiredTP
        missions: [String!]!
        descriptionMissions: [String!]!
        otherMissions: String
        otherDescriptionMissions: String
    }

    type Offer {
        needsAnalysisId: String
        id: String!
        companyName: String
        ageRange: String
        desiredTp: [OfferTp!]!
        desiredSex: Sex
        drivingLicencseB: Boolean
        professionalExperience: Boolean
        status: OfferStatus
        localisation: [Localisation]
        sector: Sector
        matchedCandidate: [MatchingCandidate]
        suggestedCandidates: [MatchingCandidate]
        proposedCandidate: [ProposedCandidate]
        interviewSlots: [String]
        interviewLocation: String
        salerInfo: SalerInfo
        referents: Referents
        companyInfos: CompanyInfos
        title: String
        jobRole: String
        softSkills: String
    }

    input MatchingCandidateInput {
        id: String
        fullName: String
        age: Int
        sex: Sex
        city: String
        email: String
        phone: String
        status: MatchedCandidateStatus
    }

    input OfferInput {
        id: String!
        companyName: String
        ageRange: String
        desiredSex: Sex
        drivingLicencseB: Boolean
        professionalExperience: Boolean
        status: OfferStatus
        localisation: [Localisation]
        sector: Sector
        matchedCandidate: [MatchingCandidateInput]
    }

    type CompanyInfo {
        id: Int
        name: String
        legalReferent: String
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
        status: String
    }

    type OfferCompanyInfo {
        companyName: String
        company: CompanyInfo
    }

    enum PlacementKind {
        IMMERSING
        CONTRACT
    }

    """
    Placement courant d'un candidat (immersion ou contrat), dérivé des offres.
    """
    type CandidatePlacement {
        companyName: String
        kind: PlacementKind!
        since: String
        immersionEndDate: String
    }

    type OfferHistoryEntry {
        id: ID!
        firstName: String
        lastName: String
        text: String!
        ownerEmail: String
        createdAt: String!
    }

    type Query {
        offers: [Offer!]!
        matchOffer(id: String!): Offer!
        offerCompanyInfo(offerId: String!): OfferCompanyInfo!
        offerResponseLinks(offerId: String!, candidateId: String!): OfferLinks!
        candidateMatchedOfferIds(candidateId: String!): [String!]!
        candidatePlacement(candidateId: String!): CandidatePlacement
        offersByNeedsAnalysis(needsAnalysisId: String!): [Offer!]!
        offerHistory(offerId: String!): [OfferHistoryEntry!]!
    }

    type Mutation {
        updateOffer(id: String!, offer: OfferInput!): Offer
        unmatchOffer(id: String!): Offer
        addCandidateToOffer(offerId: String!, candidateId: String!): Offer
        removeCandidateFromOffer(offerId: String!, candidateId: String!): Offer
        updateMatchedCandidateStatus(offerId: String!, candidateId: String!, status: MatchedCandidateStatus!): Offer
        addManualProposedCandidate(
            offerId: String!
            candidateId: String!
            interviewDate: String!
            interviewHour: String!
            interviewLocation: String!
        ): Offer
        addManualProposedCandidateForImmersion(
            offerId: String!
            candidateId: String!
            immersionStartDate: String!
            immersionEndDate: String!
            immersionLocation: String!
        ): Offer
        createMatchSession(
            offerId: String!
            companyEmail: String!
            candidates: [ProposedCandidateInput!]!
            templateId: String
        ): String!
        setInterviewConclusion(
            offerId: String!
            candidateId: String!
            conclusion: InterviewConclusion!
            immersionStartDate: String
            immersionEndDate: String
        ): Offer
        setImmersionConclusion(offerId: String!, candidateId: String!, conclusion: ImmersionConclusion!): Offer
        addOfferHistoryEntry(offerId: String!, text: String!): OfferHistoryEntry!
        deleteOfferHistoryEntry(id: String!): Boolean!
        deleteOffer(id: String!): Boolean!
        deleteOffersByNeedsAnalysis(needsAnalysisId: String!): Boolean!
    }
`;
