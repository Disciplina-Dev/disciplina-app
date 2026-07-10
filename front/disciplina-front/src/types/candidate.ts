export enum TitleProfessionalType {
    AD = "AD",       // Assistante de Direction
    CC = "CC",       // Conseiller Commercial
    NTC = "NTC",     // Négociateur technico-commercial
    REM = "REM",     // Responsable d'établissement Marchand
    SA = "SA"        // SA
}

export enum CandidateStatus {
    SEEKING = 'SEEKING',
    NOT_SEEKING = 'NOT_SEEKING',
    UNAVAILABLE = 'UNAVAILABLE',
    CANCELLED = 'CANCELLED',
    CONTRACT = 'CONTRACT',
    IMMERSING = 'IMMERSING',
    BANNED = 'BANNED',
}

export enum SchoolLevel {
    CAP_BEP_WITH_1Y_EXP = "CAP_BEP_WITH_1Y_EXP",
    PREMIERE_TERMINALE = "PREMIERE_TERMINALE",
    PREMIERE_TERMINALE_WITH_1Y_EXP = "PREMIERE_TERMINALE_WITH_1Y_EXP",
    BAC = "BAC",
    BAC_WITH_1Y_EXP = "BAC_WITH_1Y_EXP",
    BAC_PLUS = "BAC_PLUS",
    BAC_PLUS_2 = "BAC_PLUS_2",
    BAC_PLUS_2_PLUS = "BAC_PLUS_2_PLUS",
    BAC_PLUS_3_PLUS = "BAC_PLUS_3_PLUS"
}

/** Libellés français des niveaux d'études (affichage UI). */
export const SCHOOL_LEVEL_LABELS: Record<SchoolLevel, string> = {
    [SchoolLevel.CAP_BEP_WITH_1Y_EXP]: 'CAP/BEP + 1 an exp.',
    [SchoolLevel.PREMIERE_TERMINALE]: '1ère / Terminale',
    [SchoolLevel.PREMIERE_TERMINALE_WITH_1Y_EXP]: '1ère / Term. + 1 an exp.',
    [SchoolLevel.BAC]: 'Bac',
    [SchoolLevel.BAC_WITH_1Y_EXP]: 'Bac + 1 an exp.',
    [SchoolLevel.BAC_PLUS]: 'Bac +1',
    [SchoolLevel.BAC_PLUS_2]: 'Bac +2',
    [SchoolLevel.BAC_PLUS_2_PLUS]: 'Bac +2 ou plus',
    [SchoolLevel.BAC_PLUS_3_PLUS]: 'Bac +3 ou plus',
};

export enum TrainingSite {
    NORD_SAINTE_MARIE = "NORD_SAINTE_MARIE",
    OUEST_SAINT_PAUL = "OUEST_SAINT_PAUL",
    SUD_SAINT_PIERRE = "SUD_SAINT_PIERRE"
}

export enum Localisation {
    SAINT_DENIS = "SAINT_DENIS",
    SAINTE_MARIE = "SAINTE_MARIE",
    SAINTE_SUZANNE = "SAINTE_SUZANNE",
    SAINT_PAUL = "SAINT_PAUL",
    SAINT_GILLES = "SAINT_GILLES",
    LA_POSSESSION = "LA_POSSESSION",
    LE_PORT = "LE_PORT",
    TROIS_BASSINS = "TROIS_BASSINS",
    SAINT_LEU = "SAINT_LEU",
    SAINT_PIERRE = "SAINT_PIERRE",
    CILAOS = "CILAOS",
    ETANG_SALE = "ETANG_SALE",
    SAINT_LOUIS = "SAINT_LOUIS",
    ENTRE_DEUX = "ENTRE_DEUX",
    LES_AVIRONS = "LES_AVIRONS",
    LE_TAMPON = "LE_TAMPON",
    SAINT_PHILLIPE = "SAINT_PHILLIPE",
    SAINT_JOSEPH = "SAINT_JOSEPH",
    PETIT_ILE = "PETIT_ILE",
    SAINTE_ROSE = "SAINTE_ROSE",
    SAINT_BENOIT = "SAINT_BENOIT",
    BRAS_PANON = "BRAS_PANON",
    SAINT_ANDRE = "SAINT_ANDRE",
    LA_PLAINE_DES_PALMISTES = "LA_PLAINE_DES_PALMISTES",
    SALAZIE = "SALAZIE",
    SAINTE_ANNE = "SAINTE_ANNE"
}

export enum SkillLevel {
    A = "A",
    ECA = "ECA",
    NA = "NA",
    NE = "NE"
}

export enum DiscoverySource {
    SOCIAL_MEDIA = "SOCIAL_MEDIA",
    FRANCE_TRAVAIL = "FRANCE_TRAVAIL",
    MISSION_LOCALE = "MISSION_LOCALE",
    WORD_OF_MOUTH = "WORD_OF_MOUTH",
    KOANN = "KOANN",
    OTHER = "OTHER"
}

export interface Identity {
    full_name: string;                    // Nom complet du candidat
    social_security_number?: string;      // Numéro de sécurité sociale
    date_of_birth?: string;                 // Date de naissance (optionnel)
    place_of_birth?: string;              // Lieu de naissance
    department_of_birth?: string;         // Département de naissance
    age?: number;                         // Âge actuel (calculé ou fourni)
    address?: string;                     // Adresse (numéro et rue)
    postal_code?: string;                 // Code postal
    city?: string;                        // Ville
    sex?: string;                         // Sexe (FILLE / GARCON)
    email: string;                        // Adresse email (requis, unique)
    phone: string;                        // Téléphone (requis)
    driving_license_b?: boolean;          // Permis de conduire catégorie B
    has_vehicle?: boolean;                // Possède un véhicule
    transport_means?: string;             // Moyens de transport habituels
    psh_referral_request?: boolean;       // Demande d'accompagnement PSH
    had_apprenticeship_contract?: boolean; // A déjà eu un contrat d'apprentissage
    apprenticeship_contract_details?: string; // Détails du contrat d'apprentissage (si oui)
    description?: string;                  // Descriptif libre du candidat (contexte matching)
    avatar_url?: string;
    avatar_updated_at?: string;
}

export interface Education {
    school_level?: SchoolLevel;
    justification?: string;
}

export interface Support {
    france_travail_registered?: boolean;
    france_travail_agency?: string;
    mission_locale_registered?: boolean;
    mission_locale_city?: string;
}

export interface ProfessionalExperience {
    position?: string;
    duration?: string;
    responsibilities?: string;
    company?: string;
}

export interface Background {
    last_diploma?: string;
    last_diploma_prepared?: string;
    previous_trainings?: string;
    professional_experiences?: ProfessionalExperience[];
}

export interface Profile {
    french_level?: number;
    english_level?: number;
    other_languages?: string[];
    strengths_and_improvements?: string;
    qualities?: string[];
    defects?: string[];
    digital_skills?: string[];
    ready_for_challenges?: boolean;
    hobbies?: string;
}

export interface ProfessionalProjects {
    career_objectives?: string;
    desired_skills?: string;
    apprenticeship_motivation?: string;
    training_expectations?: string;
}

export interface SkillsAssessment {
    competence: string;
    level: SkillLevel;
}

export interface JobInfo {
    domain_motivation?: string;
    questions_concerns?: string;
    availability_date?: string;
    geographic_mobility?: Localisation[];
    weekend_work?: boolean;
    discovery_source?: DiscoverySource;
}

export interface PedagogicalRecommendations {
    office_tools_reinforcement?: boolean;
    written_communication_support?: boolean;
    oral_confidence_development?: boolean;
    time_management_support?: boolean;
    professional_posture_work?: boolean;
    enhanced_company_immersion?: boolean;
    psh_specific_support?: boolean;
    individual_follow_up?: boolean;
    language_training?: boolean;
    stress_management_follow_up?: boolean;
}

export interface Synthesis {
    feasibility_conclusion?: string;
    pathway_relevance?: string;
    special_needs?: string;
    pedagogical_recommendations?: PedagogicalRecommendations;
    other_recommendations?: string;
    important_note?: string;
    location?: string;
    date?: string;
    recruiter_signature?: string;
    candidate_signature?: string;
    interviewed_by?: string;
}

export interface MatchedOffer {
    id: string;
    companyName?: string;
    sector?: string;
    localisation?: Localisation[];
    desiredTP?: TitleProfessionalType;
    ageRange?: string;
    status?: string;
}

export interface CandidateOwner {
    user_id: number;
    name: string;
    sector?: string;
}

export interface Candidate {
    _id: string;
    owner?: CandidateOwner;
    tp_type: TitleProfessionalType; // legacy : 1er TP (dérivé), conservé pour Drive/stats/templates
    tp_types?: TitleProfessionalType[]; // titres professionnels visés (multi, canonique)
    identity: Identity;
    status: CandidateStatus;
    training_site?: TrainingSite; // legacy : 1er site (dérivé), conservé pour Drive/stats/filtres
    training_sites?: TrainingSite[]; // positionnement multi-sites (canonique)
    immersion_agreement?: boolean;
    immersion_start_date?: string;
    immersion_end_date?: string;
    desired_sectors?: string[];
    expected_company_skills?: string[];
    education?: Education;
    support?: Support;
    background?: Background;
    profile?: Profile;
    professional_projects?: ProfessionalProjects;
    skills_assessment?: SkillsAssessment[];
    job_info?: JobInfo;
    synthesis?: Synthesis;
    pdf_link?: string;
    cv_link?: string;
    drive_folder_id?: string;
    filiz_folder_id?: string;
    created_at?: string;
}

export enum CandidateHistoryType {
    RH = 'RH',
    CANDIDATE = 'CANDIDATE',
    COMPANY = 'COMPANY',
}

export interface CandidateHistoryEntry {
    id: string;
    type: CandidateHistoryType;
    description: string;
    ownerEmail: string | null;
    createdAt: string;
}
