import { CompaniesService } from '../services/CompaniesService';
import { CompaniesRow } from '../repositories/interfaces';

const companiesService = new CompaniesService();

interface CompanyInput {
  owner?: string | null;
  commercial?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  sector?: string | null;
  jobDescription?: string | null;
  siret?: string | null;
  idcc?: string | null;
  notes?: string | null;
  conclusion?: string | null;
}

function mapInputToRow(input: CompanyInput): Partial<CompaniesRow> {
  return {
    owner: input.owner || null,
    commercial: input.commercial || null,
    contact_name: input.contactName || null,
    phone: input.phone || null,
    email: input.email || null,
    address: input.address || null,
    sector: input.sector || null,
    job_description: input.jobDescription || null,
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
    companyByCommercial: async (_: unknown, { commercial }: { commercial: string }) => {
      return companiesService.findByCommercial(commercial);
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