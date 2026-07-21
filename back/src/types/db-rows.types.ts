export interface UserRow {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    password?: string;
    role_id: number;
    permission_id: number;
    sectors: string | string[] | null; // mysql2 v3 returns JSON columns as parsed objects
    oauth_token: string | null;
    refresh_token: string | null;
}

// Jointure avec les tables roles/permissions : le repository enrichit le UserRow
// pour porter les noms en toutes lettres sans modifier le type de base.
export interface UserRowJoined extends UserRow {
    role_name?: string;
    permission_name?: string;
}

export interface MatchLinkRow {
    signature: string;
    code: string;
    identifier: string;
    rh_email: string;
    company_email: string;
    offer_uuid: string;
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
    offer_uuid: string;
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
    ab_id: string | null;
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
    /** JSON [{ column, from, to }] stocké en chaîne. mysql2 peut le renvoyer déjà parsé à la lecture. */
    changes?: string | null;
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
