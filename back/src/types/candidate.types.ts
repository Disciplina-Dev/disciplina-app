import { Localisation } from './job.types';

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
    CANCELLED = 'CANCELLED',
    MATCHED = 'MATCHED',
    CONTRACTED = 'CONTRACTED',
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
    OTHER = 'OTHER',
}

export interface Identity {
    full_name: string;
    date_of_birth?: Date;
    place_of_birth?: string;
    age?: number;
    sex?: string;
    postal_code?: string;
    city?: string;
    email: string;
    phone: string;
    driving_license_b?: boolean;
    transport_means?: string;
    psh_referral_request?: boolean;
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
    location?: string;
    date?: Date;
    recruiter_signature?: string;
    candidate_signature?: string;
}

export interface ClassMarkerResult {
    percentage?: number;
    points_scored?: number;
    points_available?: number;
    passed?: boolean;
    test_name?: string;
    completed_at?: Date;
    duration?: string;
}

export interface Candidate {
    _id: string;
    candidate_id: string;
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
    classmarker?: ClassMarkerResult;
}
