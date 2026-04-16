export interface SalePerson {
  id: number;
  email: string;
  name: string;
}

export interface Companies {
  id: number;
  salePersonID: number | null;
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