import { CompaniesService } from '../services/CompaniesService';
import { CompaniesRow } from '../repositories/interfaces';

const companiesService = new CompaniesService();

interface CompanyInput {
  salePersonID?: number | null;
  legalReferent?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  sector?: string | null;
  mainActivity?: string | null;
  siret?: string | null;
  idcc?: string | null;
  ape?: string | null;
  notes?: string | null;
  conclusion?: string | null;
}

function mapInputToRow(input: CompanyInput): Partial<CompaniesRow> {
  return {
    sale_person_id: input.salePersonID || null,
    name: input.name || null,
    phone: input.phone || null,
    email: input.email || null,
    address: input.address || null,
    sector: input.sector || null,
    main_activity: input.mainActivity || null,
    siret: input.siret || null,
    idcc: input.idcc || null,
    notes: input.notes || null,
    conclusion: input.conclusion || null,
  };
}

export const resolvers = {
  Query: {
    companies: async () => {
      return companiesService.findAll();
    },
    companyByCommercial: async (_: unknown, { salePersonID }: { salePersonID: number }) => {
      return companiesService.findByCommercial(salePersonID);
    },
    companyBySiret: async (_: unknown, { siret }: { siret: string }) => {
      return companiesService.findBySiret(siret);
    },
  },
  Mutation: {
    createCompany: async (_: unknown, { input }: { input: CompanyInput }) => {
      const rowData = mapInputToRow(input);
      return companiesService.create(rowData);
    },
    updateCompany: async (_: unknown, { id, input }: { id: number; input: CompanyInput }) => {
      const rowData = mapInputToRow(input);
      return companiesService.update(id, rowData);
    },
    deleteCompany: async (_: unknown, { id }: { id: number }) => {
      return companiesService.delete(id);
    },
  },
};