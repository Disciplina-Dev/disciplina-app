import { CompaniesRow } from '../repositories/interfaces';
import { Companies } from './interfaces';

export function toCompanies(row: CompaniesRow): Companies {
  return {
    id: row.id,
    salePersonID: row.sale_person_id,
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