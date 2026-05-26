import { CompaniesRow, SalePersonsRow } from '../../types/db-rows.types';
import { Companies, SalePerson } from '../../types/company.types';

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
    };
}

export function toSalePerson(row: SalePersonsRow): SalePerson {
    return {
        id: row.id,
        email: row.email,
        name: row.name,
    };
}
