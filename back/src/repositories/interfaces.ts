export interface SalePersonsRow {
  id: number;
  email: string;
  name: string;
}

export interface CompaniesRow {
  id: number;
  sale_person_id: number | null;
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
}