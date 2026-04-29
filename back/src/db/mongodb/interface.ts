
export enum TitleProfessionalType {
    AD = "AD",       // Administrateur
    CC = "CC",       // Chef de projet
    NTC = "NTC",     // Négociation, Technico-Commercial
    REM = "REM",     // Responsable d'Établissement Médico-Social
    SA = "SA"        // Secrétaire d'Administration
}

export enum CandidateStatus {
    SEEKING = "SEEKING", // le candidat recherche activement une alternance
    NOT_SEEKING = "NOT_SEEKING", // le candidat est indisponible
    CANCELLED = "CANCELLED",       // Profil en cours de remplissage
    MATCHED = "MATCHED",   // Associé à une entreprise
    CONTRACTED = "CONTRACTED",      // Dossier sous contrat
    IMMERSING = "IMMERSING", // Immersion
    BANNED = "BANNED" // Banni
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

export enum TrainingSite {
    NORD_SAINTE_MARIE = "NORD_SAINTE_MARIE",
    OUEST_SAINT_PAUL = "OUEST_SAINT_PAUL",
    SUD_SAINT_PIERRE = "SUD_SAINT_PIERRE"
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

export enum JobStatus {
    NOT_MATCHED = "NOT_MATCHED",
    MATCHED = "MATCHED",
    ZERO_MATCHED = "ZERO_MATCHED",
    CV_SEND = "CV_SEND",
    IMMERSING = "IMMERSING",
    CONTRACT = "CONTRACT"
}

export enum DesiredSex {
    MIXTE = "MIXTE",
    FILLE = "FILLE",
    GARCON = "GARCON"
}

export enum Localisation {
    SAINT_DENIS = "SAINT_DENIS",
    SAINTE_MARIE = "SAINTE_MARIE",
    SAINTE_SUZANNE = "SAINTE_SUZANNE",
    SAINT_PAUL = "SAINT_PAUL",
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

export interface MatchingCandidate {
    full_name?: string;
    age?: number;
    sex?: boolean;
    city?: Localisation;
    email?: string;
    phone?: string;
}

export interface Job {
    _id?: string;
    company_name?: string;
    age_range?: string;
    desired_tp?: TitleProfessionalType;
    desired_sex?: DesiredSex;
    driving_license_b?: boolean;
    professional_experience?: boolean;
    status?: JobStatus;
    localisation?: Localisation[];
    matched?: boolean;
    matched_candidate?: MatchingCandidate[];
}

export interface Identity {
    full_name: string;                    // Nom complet du candidat
    date_of_birth?: Date;                 // Date de naissance (optionnel)
    place_of_birth?: string;              // Lieu de naissance
    age?: number;                         // Âge actuel (calculé ou fourni)
    postal_code?: string;                 // Code postal
    city?: string;                        // Ville
    email: string;                        // Adresse email (requis, unique)
    phone: string;                        // Téléphone (requis)
    driving_license_b?: boolean;          // Permis de conduire catégorie B
    transport_means?: string;             // Moyens de transport habituels
    psh_referral_request?: boolean;       // Demande d'accompagnement PSH
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
    availability_date?: Date;
    geographic_mobility?: string;
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
    location?: string;
    date?: Date;
    recruiter_signature?: string;
    candidate_signature?: string;
}

export interface Candidate {
    _id: string;
    candidate_id: string;
    tp_type: TitleProfessionalType;
    identity: Identity;
    status: CandidateStatus;
    // created_at: Date;
    // created_by: string;
    training_site?: TrainingSite;
    immersion_agreement?: boolean;
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
}