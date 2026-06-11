export interface UserRow {
    id: number;
    email: string;
    name: string;
    password?: string;
    role: 'ADMIN' | 'RESPONSABLE' | 'COMMERCIAL' | 'RH';
    sectors: string | null;
    oauth_token: string | null;
    refresh_token: string | null;
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
    relance_date: string | Date | null;
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
    positions_count: number;
    localisation: 'NORD' | 'OUEST' | 'SUD';
    training_domain: 'SECRETARIAT' | 'VENTE';
    job_title: string;
    selected_missions: string; // JSON string
    other_missions: string | null;
    job_description_missions: string | null; // JSON string
    job_description_other: string | null;
    education_level: 'BAC' | 'BAC_PLUS_2' | 'BAC_PLUS_3';
    driving_license: 'OUI' | 'OPTIONNEL';
    experience_required: 'DEBUTANT' | 'OBLIGATOIRE';
    age_requirements: string; // JSON string
    soft_skills: string | null;
    schedule_options: string | null; // JSON string
    additional_comments: string | null;
    recruitment_method: 'ALL_CV' | 'PRESELECTION' | 'PRE_INTERVIEW';
    immersion_period: 'OUI' | 'NON' | 'A_DISCUTER';
    training_days: string; // JSON string
    yousign_signature_request_id: string | null;
    status: 'BROUILLON' | 'EN_ATTENTE_SIGNATURE' | 'SIGNE' | 'EXPIRE';
    created_at?: Date;
    updated_at?: Date;
}

