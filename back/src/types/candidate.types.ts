import { Localisation } from './matching.types';

export enum TitleProfessionalType {
    AD = 'AD',
    CC = 'CC',
    NTC = 'NTC',
    REM = 'REM',
    SA = 'SA',
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
    CAP_BEP_WITH_1Y_EXP = 'CAP_BEP_WITH_1Y_EXP',
    PREMIERE_TERMINALE = 'PREMIERE_TERMINALE',
    PREMIERE_TERMINALE_WITH_1Y_EXP = 'PREMIERE_TERMINALE_WITH_1Y_EXP',
    BAC = 'BAC',
    BAC_WITH_1Y_EXP = 'BAC_WITH_1Y_EXP',
    BAC_PLUS = 'BAC_PLUS',
    BAC_PLUS_2 = 'BAC_PLUS_2',
    BAC_PLUS_2_PLUS = 'BAC_PLUS_2_PLUS',
    BAC_PLUS_3_PLUS = 'BAC_PLUS_3_PLUS',
}

export enum TrainingSite {
    NORD_SAINTE_MARIE = 'NORD_SAINTE_MARIE',
    OUEST_SAINT_PAUL = 'OUEST_SAINT_PAUL',
    SUD_SAINT_PIERRE = 'SUD_SAINT_PIERRE',
}

export enum SkillLevel {
    A = 'A',
    ECA = 'ECA',
    NA = 'NA',
    NE = 'NE',
}

export enum DiscoverySource {
    SOCIAL_MEDIA = 'SOCIAL_MEDIA',
    FRANCE_TRAVAIL = 'FRANCE_TRAVAIL',
    MISSION_LOCALE = 'MISSION_LOCALE',
    WORD_OF_MOUTH = 'WORD_OF_MOUTH',
    KOANN = 'KOANN',
    E2CR = 'E2CR',
    TELEVISION_PUB = 'TELEVISION_PUB',
    SALON = 'SALON',
    RSMA = 'RSMA',
    OTHER = 'OTHER',
}

export interface Identity {
    full_name: string;
    social_security_number?: string;
    date_of_birth?: Date;
    place_of_birth?: string;
    department_of_birth?: string;
    age?: number;
    sex?: string;
    address?: string;
    postal_code?: string;
    city?: string;
    email: string;
    phone: string;
    driving_license_b?: boolean;
    has_vehicle?: boolean;
    transport_means?: string;
    psh_referral_request?: boolean;
    had_apprenticeship_contract?: boolean;
    apprenticeship_contract_details?: string;
    description?: string;
    avatar_updated_at?: Date;
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
    availability_date?: Date;
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
    date?: Date;
    recruiter_signature?: string;
    candidate_signature?: string;
    interviewed_by?: string;
}

export interface ClassMarkerQuestion {
    question_id?: number;
    question_type?: string;
    question?: string;
    // multiplechoice : { A: '...', B: '...' } ; freetext : { exact_match: [{ content }] }
    options?: Record<string, string> | { exact_match?: Array<{ content: string }> };
    correct_option?: string;
    user_response?: string;
    points_scored?: number;
    points_available?: number;
    result?: string; // 'correct' | 'incorrect' | 'unanswered'
}

export interface ClassMarkerResult {
    percentage?: number;
    points_scored?: number;
    points_available?: number;
    passed?: boolean;
    test_name?: string;
    completed_at?: Date;
    duration?: string;
    pdf_link?: string;
    questions?: ClassMarkerQuestion[];
}

/**
 * Créateur (propriétaire) du dossier candidat. `sector` est un snapshot du
 * secteur de l'owner au moment de la création : il sert UNIQUEMENT à identifier
 * et router le dossier Drive (ex: RH Nord → dossier Nord). Il n'influe pas sur
 * les secteurs fonctionnels du candidat (mobilité, formation, métiers visés).
 */
export interface CandidateOwner {
    user_id: number;
    name: string;
    sector?: string;
}

export interface Candidate {
    _id: string;
    candidate_id: string;
    owner?: CandidateOwner;
    tp_type: TitleProfessionalType; // legacy : 1er TP (dérivé), conservé pour Drive/stats/templates
    tp_types?: TitleProfessionalType[]; // titres professionnels visés (multi, canonique)
    identity: Identity;
    status: CandidateStatus;
    training_site?: TrainingSite; // legacy : 1er site (dérivé), conservé pour Drive/stats/filtres
    training_sites?: TrainingSite[]; // positionnement multi-sites (canonique)
    immersion_agreement?: boolean;
    immersion_start_date?: Date;
    immersion_end_date?: Date;
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
    drive_folder_link?: string;
    filiz_folder_id?: string;
    photo_link?: string;
    classmarker?: ClassMarkerResult;
    created_at?: Date;
    // Relance de disponibilité : date du dernier envoi et date de la réponse du candidat.
    last_relance_at?: Date;
    relance_response_at?: Date;
    // Historique complet : un entrée par test passé (append-only). `classmarker`
    // reste le dernier résultat pour compat ; ici on garde la trace de tous.
    classmarker_history?: ClassMarkerResult[];
}

export enum CandidateHistoryType {
    RH = 'RH',
    CANDIDATE = 'CANDIDATE',
    COMPANY = 'COMPANY',
}

export interface CandidateHistoryEntry {
    _id: string;
    candidate_id: string;
    type: CandidateHistoryType;
    description: string;
    owner_email: string | null;
    created_at: Date;
}
