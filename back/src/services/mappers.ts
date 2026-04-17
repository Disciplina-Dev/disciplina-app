import { CompaniesRow, SalePersonsRow } from '../repositories/interfaces';
import { Companies, SalePerson } from './interfaces';

export function toSalePerson(row: SalePersonsRow): SalePerson {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
  };
}

export function toCompanies(row: CompaniesRow): Companies {
  return {
    id: row.id,
    salePersonID: row.sale_person_id,
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