export interface UserRow {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    password?: string;
    role: 'ADMIN' | 'RESPONSABLE' | 'COMMERCIAL' | 'RH';
    sectors: string | null;
    oauth_token: string | null;
    refresh_token: string | null;
}

export interface MatchLinkRow {
    signature: string;
    code: string;
    identifier: string;
    rh_email: string;
    company_email: string;
    job_uuid: string;
    status: 'PENDING' | 'AUTHENTICATED' | 'COMPLETED' | 'LOCKED' | 'EXPIRED';
    attempts: number;
    // pool runs with dateStrings: true, so TIMESTAMP columns arrive as strings
    expires_at: string | Date;
    created_at?: string | Date;
    updated_at?: string | Date;
}

export interface InterviewAccessRow {
    signature: string;
    code: string;
    job_uuid: string;
    candidate_id: string;
    rh_email: string;
    status: 'PENDING' | 'AUTHENTICATED' | 'COMPLETED' | 'LOCKED' | 'EXPIRED';
    attempts: number;
    // pool runs with dateStrings: true, so TIMESTAMP columns arrive as strings
    expires_at: string | Date;
    created_at?: string | Date;
    updated_at?: string | Date;
}

export interface CompaniesRow {
    id: number;
    user_id: number | null;
    legal_referent: string | null;
    name: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    sector: string | null;
    main_activity: string | null;
    siret: string | null;
    idcc: string | null;
    ape: string | null;
    notes: string | null;
    conclusion: string | null;
    status: string | null;
    // mysql2 returns DATE columns as Date objects; raw SQL strings can also come back as string
    relance_date: Date | string | null;
    relance_type: number | null;
    relance_template_id: string | null;
    relance_channel: string | null;
    created_at?: string | Date;
}

export interface RelanceHistoryRow {
    id: number;
    company_id: number;
    user_id: number | null;
    type_relance: number | null;
    channel: string;
    subject: string | null;
    note: string | null;
    created_at?: string | Date;
}

export interface CompaniesBlacklistRow extends CompaniesRow {
    all_blacklist: number | null;
}

export interface CompanyHistoryRow {
    id: number;
    company_id: number;
    updated_at?: string | Date;
    updated_column: string;
    status: string;
    previous_status?: string | null;
    modified_by?: number | null;
}

export interface ContactLogRow {
    id: number;
    company_id: number;
    user_id: number;
    comment: string;
    created_at?: string | Date;
}

export interface FilizRow {
    token: string;
    created_at: Date;
    expires_at: Date;
}

export interface NeedsAnalysisRow {
    id: number;
    company_id: number;
    user_id: number;
    legal_rep_function: string | null;
    recruitment_responsible_name: string | null;
    recruitment_responsible_phone: string | null;
    recruitment_responsible_email: string | null;
    recruitment_responsible_function: string | null;
    company_sectors: string | null; // JSON string
    company_description: string | null;
    opco:
        | 'AKTO'
        | 'ATLAS'
        | 'AFDAS'
        | 'CONSTRUCTYS'
        | 'OCAPIAT'
        | 'OPCO_2I'
        | 'OPCO_EP'
        | 'OPCO_MOBILITES'
        | 'OPCO_SANTE'
        | 'OPCOMMERCE'
        | 'UNIFORMATION'
        | null;
    referral_source:
        | 'KOANN'
        | 'E2CR'
        | 'FRANCE_TRAVAIL'
        | 'TELEVISION_PUB'
        | 'BOUCHE_A_OREILLE'
        | 'MISSION_LOCALE'
        | 'SALON'
        | 'RSMA'
        | 'RESEAUX_SOCIAUX'
        | null;
    positions_count: number;
    positions: string | null; // JSON string
    localisation: 'NORD' | 'OUEST' | 'SUD';
    training_domain: 'SECRETARIAT' | 'VENTE';
    job_title: string;
    selected_missions: string; // JSON string
    other_missions: string | null;
    job_description_missions: string | null; // JSON string
    job_description_other: string | null;
    education_level: 'BAC' | 'BAC_PLUS_2' | 'BAC_PLUS_3' | null;
    driving_license: 'OUI' | 'OPTIONNEL';
    experience_required: 'DEBUTANT' | 'OBLIGATOIRE';
    age_requirements: string; // JSON string
    age_min: number | null;
    age_max: number | null;
    soft_skills: string | null;
    schedule_options: string | null; // JSON string
    conditions: string | null;
    additional_comments: string | null;
    recruitment_method: 'ALL_CV' | 'PRESELECTION' | 'PRE_INTERVIEW';
    immersion_period: 'OUI' | 'NON' | 'A_DISCUTER';
    training_days: string; // JSON string
    yousign_signature_request_id: string | null;
    status: 'BROUILLON' | 'EN_ATTENTE_SIGNATURE' | 'SIGNE' | 'EXPIRE';
    // pool runs with dateStrings: true, so TIMESTAMP columns arrive as strings
    created_at?: string | Date;
    updated_at?: string | Date;
}
