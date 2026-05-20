import { CompaniesService } from '../../services/CompaniesService';
import { SalePersonsService } from '../../services/SalePersonsService';
import { CompaniesRow } from '../../types/db-rows.types';
import { toSalePerson } from '../../services/mappers/company.mapper';
import { authGuard } from '../authGuard';
import { Role } from '../../types/user.types';

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
        legal_referent: input.legalReferent || null,
        name: input.name || null,
        phone: input.phone || null,
        email: input.email || null,
        address: input.address || null,
        sector: input.sector || null,
        main_activity: input.mainActivity || null,
        siret: input.siret || null,
        idcc: input.idcc || null,
        ape: input.ape || null,
        notes: input.notes || null,
        conclusion: input.conclusion || null,
    };
}

export const resolvers = {
    Query: {
        companies: async (_: unknown, __: unknown, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL]);
            const companies = await companiesService.findAll();
            const result = [];
            for (const company of companies) {
                const salePerson = await salePersonsService.findById(company.salePersonID ?? 0);
                result.push({
                    company: {
                        ...company,
                        salePerson: salePerson
                            ? toSalePerson({ id: salePerson.id, email: salePerson.email, name: salePerson.name })
                            : null,
                    },
                    salePerson: salePerson
                        ? toSalePerson({ id: salePerson.id, email: salePerson.email, name: salePerson.name })
                        : null,
                });
            }
            return result;
        },
        salePersons: async (_: unknown, __: unknown, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL]);
            return salePersonsService.findAll();
        },
        salePerson: async (_: unknown, { id }: { id: number }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL]);
            return salePersonsService.findById(id);
        },
        companyByCommercial: async (_: unknown, { salePersonID }: { salePersonID: number }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL]);
            const companies = await companiesService.findByCommercial(salePersonID);
            const result = [];
            for (const company of companies) {
                const salePerson = await salePersonsService.findById(company.salePersonID ?? 0);
                result.push({
                    company: {
                        ...company,
                        salePerson: salePerson
                            ? toSalePerson({ id: salePerson.id, email: salePerson.email, name: salePerson.name })
                            : null,
                    },
                    salePerson: salePerson
                        ? toSalePerson({ id: salePerson.id, email: salePerson.email, name: salePerson.name })
                        : null,
                });
            }
            return result;
        },
        companyBySiret: async (_: unknown, { siret }: { siret: string }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL]);
            const company = await companiesService.findBySiret(siret);
            if (!company) return null;
            const salePerson = await salePersonsService.findById(company.salePersonID ?? 0);
            return {
                ...company,
                salePerson: salePerson
                    ? toSalePerson({ id: salePerson.id, email: salePerson.email, name: salePerson.name })
                    : null,
            };
        },
    },
    Mutation: {
        createCompany: async (_: unknown, { input }: { input: CompanyInput }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL]);
            const rowData = mapInputToRow(input);
            const company = await companiesService.create(rowData);
            const salePerson = company?.salePersonID ? await salePersonsService.findById(company.salePersonID) : null;
            return {
                ...company,
                salePerson: salePerson
                    ? toSalePerson({ id: salePerson.id, email: salePerson.email, name: salePerson.name })
                    : null,
            };
        },
        updateCompany: async (_: unknown, { id, input }: { id: number; input: CompanyInput }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL]);
            const rowData = mapInputToRow(input);
            const company = await companiesService.update(id, rowData);
            const salePerson = company?.salePersonID ? await salePersonsService.findById(company.salePersonID) : null;
            return {
                ...company,
                salePerson: salePerson
                    ? toSalePerson({ id: salePerson.id, email: salePerson.email, name: salePerson.name })
                    : null,
            };
        },
        deleteCompany: async (_: unknown, { id }: { id: number }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL]);
            return companiesService.delete(id);
        },
    },
};
