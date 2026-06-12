import { CompaniesRow, CompaniesBlacklistRow, CompanyHistoryRow } from '../../types/db-rows.types';
import { Companies, BlacklistedCompany, CompanyHistory } from '../../types/company.types';

export function toCompanies(row: CompaniesRow): Companies {
    return {
        id: row.id,
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
        updatedAt: row.updated_at
            ? row.updated_at instanceof Date
                ? row.updated_at.toISOString()
                : String(row.updated_at)
            : new Date().toISOString(),
        updatedColumn: row.updated_column,
        status: row.status,
    };
}
