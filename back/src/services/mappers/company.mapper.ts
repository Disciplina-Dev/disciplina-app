import {
    CompaniesRow,
    CompaniesBlacklistRow,
    CompanyConflictRow,
    CompanyHistoryRow,
    ContactLogRow,
    RelanceHistoryRow,
} from '../../types/db-rows.types';
import {
    Companies,
    BlacklistedCompany,
    CompanyConflict,
    CompanyHistory,
    CompanySirenGroup,
    FieldChange,
    ContactLog,
    RelanceHistory,
    RelanceChannel,
} from '../../types/company.types';
import { CompanySirenGroupRow } from '../../repositories/mysql/CompanyRepository';

function toIso(value?: string | Date | null): string {
    if (!value) return new Date().toISOString();
    return value instanceof Date ? value.toISOString() : String(value);
}

export function toCompanies(row: CompaniesRow): Companies {
    return {
        id: row.id,
        abID: row.ab_id ?? null,
        userID: row.user_id,
        legalReferent: row.legal_referent,
        name: row.name,
        phone: row.phone,
        email: row.email,
        address: row.address,
        sector: row.sector,
        mainActivity: row.main_activity,
        siret: row.siret,
        siren: row.siren ?? (row.siret ? row.siret.slice(0, 9) : null),
        idcc: row.idcc,
        ape: row.ape,
        notes: row.notes,
        conclusion: row.conclusion,
        status: row.status,
        relanceDate: row.relance_date
            ? row.relance_date instanceof Date
                ? row.relance_date.toISOString().slice(0, 10)
                : String(row.relance_date).slice(0, 10)
            : null,
        createdAt: row.created_at
            ? row.created_at instanceof Date
                ? row.created_at.toISOString().slice(0, 10)
                : String(row.created_at).slice(0, 10)
            : null,
        relanceType: row.relance_type ?? null,
        relanceTemplateId: row.relance_template_id ?? null,
        relanceChannel: row.relance_channel ?? null,
    };
}

export function toSirenGroup(row: CompanySirenGroupRow): CompanySirenGroup {
    // JSON_ARRAYAGG comes back already parsed with mysql2, but stays a string with raw SQL.
    const rows: CompaniesRow[] = typeof row.companies === 'string' ? JSON.parse(row.companies) : row.companies;
    return {
        siren: row.siren,
        count: Number(row.count),
        companies: rows.map(toCompanies),
    };
}

export function toRelanceHistory(row: RelanceHistoryRow): RelanceHistory {
    return {
        id: row.id,
        companyID: row.company_id,
        userID: row.user_id ?? null,
        typeRelance: row.type_relance ?? null,
        channel: row.channel as RelanceChannel,
        subject: row.subject ?? null,
        note: row.note ?? null,
        createdAt: toIso(row.created_at),
    };
}

export function toBlacklistedCompany(row: CompaniesBlacklistRow): BlacklistedCompany {
    return {
        ...toCompanies(row),
        allBlacklist: row.all_blacklist === 1,
    };
}

export function toCompanyConflict(row: CompanyConflictRow): CompanyConflict {
    return {
        id: row.id,
        abID: row.ab_id ?? null,
        userID: row.user_id,
        legalReferent: row.legal_referent,
        name: row.name,
        phone: row.phone,
        email: row.email,
        address: row.address,
        sector: row.sector,
        mainActivity: row.main_activity,
        siret: row.siret,
        siren: row.siret ? row.siret.slice(0, 9) : null,
        idcc: row.idcc,
        ape: row.ape,
        notes: row.notes,
        conclusion: row.conclusion,
        status: row.status,
        relanceDate: row.relance_date
            ? row.relance_date instanceof Date
                ? row.relance_date.toISOString().slice(0, 10)
                : String(row.relance_date).slice(0, 10)
            : null,
        createdAt: row.created_at
            ? row.created_at instanceof Date
                ? row.created_at.toISOString().slice(0, 10)
                : String(row.created_at).slice(0, 10)
            : null,
        relanceType: row.relance_type ?? null,
        relanceTemplateId: row.relance_template_id ?? null,
        relanceChannel: row.relance_channel ?? null,
        candidateUserIds: parseCandidateUserIds(row.candidate_user_ids),
    };
}

function parseCandidateUserIds(raw: string | null): number[] | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

export function toCompanyHistory(row: CompanyHistoryRow): CompanyHistory {
    return {
        id: row.id,
        companyID: row.company_id,
        updatedAt: toIso(row.updated_at),
        updatedColumn: row.updated_column,
        status: row.status,
        previousStatus: row.previous_status ?? null,
        modifiedBy: row.modified_by ?? null,
        changes: parseChanges(row.changes),
    };
}

/** mysql2 renvoie une colonne JSON déjà parsée, mais on gère aussi la chaîne. */
function parseChanges(raw: unknown): FieldChange[] {
    if (!raw) return [];
    try {
        const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}

export function toContactLog(row: ContactLogRow): ContactLog {
    return {
        id: row.id,
        companyID: row.company_id,
        userID: row.user_id,
        comment: row.comment,
        createdAt: toIso(row.created_at),
    };
}
