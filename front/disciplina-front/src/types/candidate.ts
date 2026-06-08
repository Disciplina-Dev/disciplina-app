export enum TitleProfessionalType {
    AD = "AD",       // Administrateur
    CC = "CC",       // Chef de projet
    NTC = "NTC",     // Négociation, Technico-Commercial
    REM = "REM",     // Responsable d'Établissement Médico-Social
    SA = "SA"        // Secrétaire d'Administration
}

export enum CandidateStatus {
    SEEKING = "Recherche", // le candidat recherche activement une alternance
    NOT_SEEKING = "Ne recherche pas", // le candidat est indisponible
    CANCELLED = "Rupture",       // Profil en cours de remplissage
    MATCHED = "Immersion",   // Associé à une entreprise
    CONTRACTED = "Contrat",      // Dossier sous contrat
    BANNED = "Banni" // Banni
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

export interface Identity {
    full_name: string;                    // Nom complet du candidat
    date_of_birth?: string;                 // Date de naissance (optionnel)
    place_of_birth?: string;              // Lieu de naissance
    age?: number;                         // Âge actuel (calculé ou fourni)
    postal_code?: string;                 // Code postal
    city?: string;                        // Ville
    email: string;                        // Adresse email (requis, unique)
    phone: string;                        // Téléphone (requis)
    driving_license_b?: boolean;          // Permis de conduire catégorie B
    transport_means?: string;             // Moyens de transport habituels
    psh_referral_request?: boolean;       // Demande d'accompagnement PSH
    avatar_url?: string;
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
    availability_date?: string;
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
    date?: string;
    recruiter_signature?: string;
    candidate_signature?: string;
}

export interface Candidate {
    _id: string;
    tp_type: TitleProfessionalType;
    identity: Identity;
    status: CandidateStatus;
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
    pdf_link?: string;
    cv_link?: string;
    drive_folder_id?: string;
}
