import { CompaniesService } from '../../services/CompaniesService';
import { SalePersonsService } from '../../services/SalePersonsService';
import { CompaniesRow } from '../../repositories/interfaces';
import { toCompanies, toSalePerson } from '../../services/mappers';

const companiesService = new CompaniesService();
const salePersonsService = new SalePersonsService();

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

async function getSalePersonForCompany(company: any) {
  if (!company.salePersonID) return null;
  const salePerson = await salePersonsService.findById(company.salePersonID);
  return salePerson;
}

export const resolvers = {
  Query: {
    companies: async () => {
      const companies = await companiesService.findAll();
      const result = [];
      for (const company of companies) {
        const salePerson = await salePersonsService.findById(company.salePersonID ?? 0);
        result.push({
          company: {
            ...company,
            salePerson: salePerson ? toSalePerson({ id: salePerson.id, email: salePerson.email, name: salePerson.name } as any) : null,
          },
          salePerson: salePerson ? toSalePerson({ id: salePerson.id, email: salePerson.email, name: salePerson.name } as any) : null,
        });
      }
      return result;
    },
    salePersons: async () => {
      return salePersonsService.findAll();
    },
    salePerson: async (_: unknown, { id }: { id: number }) => {
      return salePersonsService.findById(id);
    },
    companyByCommercial: async (_: unknown, { salePersonID }: { salePersonID: number }) => {
      const companies = await companiesService.findByCommercial(salePersonID);
      const result = [];
      for (const company of companies) {
        const salePerson = await salePersonsService.findById(company.salePersonID ?? 0);
        result.push({
          company: {
            ...company,
            salePerson: salePerson ? toSalePerson({ id: salePerson.id, email: salePerson.email, name: salePerson.name } as any) : null,
          },
          salePerson: salePerson ? toSalePerson({ id: salePerson.id, email: salePerson.email, name: salePerson.name } as any) : null,
        });
      }
      return result;
    },
    companyBySiret: async (_: unknown, { siret }: { siret: string }) => {
      const company = await companiesService.findBySiret(siret);
      if (!company) return null;
      const salePerson = await salePersonsService.findById(company.salePersonID ?? 0);
      return {
        ...company,
        salePerson: salePerson ? toSalePerson({ id: salePerson.id, email: salePerson.email, name: salePerson.name } as any) : null,
      };
    },
  },
  Mutation: {
    createCompany: async (_: unknown, { input }: { input: CompanyInput }) => {
      const rowData = mapInputToRow(input);
      const company = await companiesService.create(rowData);
      const salePerson = company?.salePersonID ? await salePersonsService.findById(company.salePersonID) : null;
      return {
        ...company,
        salePerson: salePerson ? toSalePerson({ id: salePerson.id, email: salePerson.email, name: salePerson.name } as any) : null,
      };
    },
    updateCompany: async (_: unknown, { id, input }: { id: number; input: CompanyInput }) => {
      const rowData = mapInputToRow(input);
      const company = await companiesService.update(id, rowData);
      const salePerson = company?.salePersonID ? await salePersonsService.findById(company.salePersonID) : null;
      return {
        ...company,
        salePerson: salePerson ? toSalePerson({ id: salePerson.id, email: salePerson.email, name: salePerson.name } as any) : null,
      };
    },
    deleteCompany: async (_: unknown, { id }: { id: number }) => {
      return companiesService.delete(id);
    },
  },
};