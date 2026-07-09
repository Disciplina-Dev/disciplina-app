import {
    CompaniesRow,
    CompaniesBlacklistRow,
    CompanyHistoryRow,
    ContactLogRow,
    RelanceHistoryRow,
} from '../../types/db-rows.types';
import {
    Companies,
    BlacklistedCompany,
    CompanyHistory,
    ContactLog,
    RelanceHistory,
    RelanceChannel,
} from '../../types/company.types';

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

export function toCompanyHistory(row: CompanyHistoryRow): CompanyHistory {
    return {
        id: row.id,
        companyID: row.company_id,
        updatedAt: toIso(row.updated_at),
        updatedColumn: row.updated_column,
        status: row.status,
        previousStatus: row.previous_status ?? null,
        modifiedBy: row.modified_by ?? null,
    };
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
