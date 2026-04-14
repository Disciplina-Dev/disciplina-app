import { CompaniesRow } from '../repositories/interfaces';
import { Companies } from './interfaces';

export function toCompanies(row: CompaniesRow): Companies {
  return {
    id: row.id,
    owner: row.owner,
    commercial: row.commercial,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    sector: row.sector,
    jobDescription: row.job_description,
    siret: row.siret,
    idcc: row.idcc,
    notes: row.notes,
    conclusion: row.conclusion,
  };
}