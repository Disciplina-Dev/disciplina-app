export interface SalePerson {
  id: number;
  email: string;
  name: string;
}

export interface Companies {
  id: number;
  salePersonID: number | null;
  legalReferent: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  sector: string | null;
  mainActivity: string | null;
  siret: string | null;
  idcc: string | null;
  ape: string | null;
  notes: string | null;
  conclusion: string | null;
}

export enum Role {
  ADMIN = 'ADMIN',
  COMMERCIAL = 'COMMERCIAL',
  RH = 'RH'
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  sectors: string[] | null;
  oauthToken?: string | null;
  refreshToken?: string | null;
  password?: string;
}