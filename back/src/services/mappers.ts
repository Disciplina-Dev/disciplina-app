import { CompaniesRow, SalePersonsRow, UserRow } from '../repositories/interfaces';
import { Companies, SalePerson, User, Role } from './interfaces';

export function toUser(row: UserRow): User {
  let parsedSectors: string[] | null = null;
  if (row.sectors) {
    try {
      parsedSectors = JSON.parse(row.sectors);
    } catch (e) {
      parsedSectors = [];
    }
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    password: row.password,
    role: row.role as Role,
    sectors: parsedSectors,
    oauthToken: row.oauth_token,
    refreshToken: row.refresh_token,
  };
}

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