export enum JobStatus {
    NOT_MATCHED = 'NOT_MATCHED',
    MATCHED = 'MATCHED',
    CV_SEND = 'CV_SEND',
    IMMERSING = 'IMMERSING',
    CONTRACT = 'CONTRACT',
}

export enum MatchedCandidateStatus {
    RETAINED = 'RETAINED',
    OFFER_SEND = 'OFFER_SEND',
    ACCEPTED = 'ACCEPTED',
    DECLINED = 'DECLINED',
}

export enum ProposedCandidateAnswer {
    REFUSED = 'REFUSED',
    ACCEPTED = 'ACCEPTED',
    FAVORITE = 'FAVORITE',
}

export enum DesiredSex {
    MIXTE = 'MIXTE',
    FILLE = 'FILLE',
    GARCON = 'GARCON',
}

export enum Sex {
    FILLE = 'FILLE',
    GARCON = 'GARCON',
    MIXTE = 'MIXTE',
}

export enum Localisation {
    SAINT_DENIS = 'SAINT_DENIS',
    SAINTE_MARIE = 'SAINTE_MARIE',
    SAINTE_SUZANNE = 'SAINTE_SUZANNE',
    SAINT_PAUL = 'SAINT_PAUL',
    LA_POSSESSION = 'LA_POSSESSION',
    LE_PORT = 'LE_PORT',
    TROIS_BASSINS = 'TROIS_BASSINS',
    SAINT_LEU = 'SAINT_LEU',
    SAINT_PIERRE = 'SAINT_PIERRE',
    CILAOS = 'CILAOS',
    ETANG_SALE = 'ETANG_SALE',
    SAINT_LOUIS = 'SAINT_LOUIS',
    ENTRE_DEUX = 'ENTRE_DEUX',
    LES_AVIRONS = 'LES_AVIRONS',
    LE_TAMPON = 'LE_TAMPON',
    SAINT_PHILLIPE = 'SAINT_PHILLIPE',
    SAINT_JOSEPH = 'SAINT_JOSEPH',
    PETIT_ILE = 'PETIT_ILE',
    SAINTE_ROSE = 'SAINTE_ROSE',
    SAINT_BENOIT = 'SAINT_BENOIT',
    BRAS_PANON = 'BRAS_PANON',
    SAINT_ANDRE = 'SAINT_ANDRE',
    LA_PLAINE_DES_PALMISTES = 'LA_PLAINE_DES_PALMISTES',
    SALAZIE = 'SALAZIE',
    SAINTE_ANNE = 'SAINTE_ANNE',
}

export enum Sector {
    BOULANGERIE = 'BOULANGERIE',
    RESTAURATION = 'RESTAURATION',
    STATION = 'STATION',
    PAP = 'PAP',
    LIBRE_SERVICE = 'LIBRE_SERVICE',
    TELEPHONIE = 'TELEPHONIE',
    AUTO = 'AUTO',
    COMMERCIAL = 'COMMERCIAL',
    BIJOUX = 'BIJOUX',
    COSMETIQUE = 'COSMETIQUE',
    IMMOBILIER = 'IMMOBILIER',
    ASSURANCE = 'ASSURANCE',
    ANIMAUX = 'ANIMAUX',
    SPORT = 'SPORT',
    ENFANT = 'ENFANT',
    PHARMACIE = 'PHARMACIE',
    BAZAR = 'BAZAR',
    NONE = 'NONE',
}

export interface MatchingCandidate {
    id: string;
    full_name?: string;
    age?: number;
    sex?: Sex;
    city?: Localisation;
    email?: string;
    phone?: string;
    status?: MatchedCandidateStatus;
}

export interface ProposedCandidate extends MatchingCandidate {
    description?: string;
    cv_webview?: string;
    answer?: ProposedCandidateAnswer | null;
    interview_date?: string;
    interview_hour?: string;
    interview_location?: string;
    booked_interview_slot?: string;
    comment?: string;
}

export interface Job {
    _id?: string;
    company_name?: string;
    age_range?: string;
    desired_tp?: string;
    desired_sex?: DesiredSex;
    driving_license_b?: boolean;
    professional_experience?: boolean;
    status?: JobStatus;
    sector?: Sector;
    localisation?: Localisation[];
    matched?: boolean;
    matched_candidate?: MatchingCandidate[];
    proposed_candidate?: ProposedCandidate[];
    interview_slots?: string[];
    interview_location?: string;
}
