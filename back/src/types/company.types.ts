export interface Companies {
    id: number;
    abID: string | null;
    userID: number | null;
    legalReferent: string | null;
    name: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    sector: string | null;
    mainActivity: string | null;
    siret: string | null;
    siren: string | null;
    idcc: string | null;
    ape: string | null;
    notes: string | null;
    conclusion: string | null;
    status: string | null;
    relanceDate: string | null;
    createdAt: string | null;
    relanceType: number | null;
    relanceTemplateId: string | null;
    relanceChannel: string | null;
}

export interface CompanySirenGroup {
    siren: string;
    count: number;
    companies: Companies[];
}

export type RelanceChannel = 'PHONE' | 'MAIL';

export interface RelanceHistory {
    id: number;
    companyID: number;
    userID: number | null;
    typeRelance: number | null;
    channel: RelanceChannel;
    subject: string | null;
    note: string | null;
    createdAt: string;
}

export interface BlacklistedCompany extends Companies {
    allBlacklist: boolean;
}

export interface CompanyHistory {
    id: number;
    companyID: number;
    updatedAt: string;
    updatedColumn: string;
    status: string;
    previousStatus: string | null;
    modifiedBy: number | null;
    changes: FieldChange[];
}

export interface FieldChange {
    column: string;
    from: string | null;
    to: string | null;
}

export interface ContactLog {
    id: number;
    companyID: number;
    userID: number;
    comment: string;
    createdAt: string;
}

export interface ContactLogStats {
    total: number;
    byUser: { userID: number; count: number }[];
}
