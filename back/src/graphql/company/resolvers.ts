import { CompaniesService } from '../../services/CompaniesService';
import { SalePersonsService } from '../../services/SalePersonsService';
import { CompaniesRow } from '../../types/db-rows.types';
import { toSalePerson } from '../../services/mappers/company.mapper';
import { UserService } from '../../services/UserService';
import { authGuard } from '../authGuard';
import { Role } from '../../types/user.types';

const companiesService = new CompaniesService();
const userService = new UserService();

interface CompanyInput {
    userID?: number | null;
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
        user_id: input.userID || null,
        legal_referent: input.legalReferent || null,
        name: input.name || '',
        phone: input.phone || null,
        email: input.email || null,
        address: input.address || '',
        sector: input.sector || '',
        main_activity: input.mainActivity || null,
        siret: input.siret || '',
        idcc: input.idcc || null,
        ape: input.ape || null,
        notes: input.notes || null,
        conclusion: input.conclusion || 'À Réfléchir',
    };
}

export const resolvers = {
    Query: {
        companies: async (_: unknown, __: unknown, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL]);
            const companies = await companiesService.findAll();
            const result = [];
            for (const company of companies) {
                const salePerson = await userService.findById(company.userID ?? 0);
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
            return userService.findByRole(Role.COMMERCIAL);
        },

        salePerson: async (_: unknown, { id }: { id: number }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL]);
            return userService.findById(id);
        },

        companyByCommercial: async (_: unknown, { userID }: { userID: number }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL]);
            const companies = await companiesService.findByCommercial(userID);
            const result = [];
            for (const company of companies) {
                const salePerson = await userService.findById(company.userID ?? 0);
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
            const salePerson = await userService.findById(company.userID ?? 0);
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
            const salePerson = company?.userID ? await userService.findById(company.userID) : null;
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
            const salePerson = company?.userID ? await userService.findById(company.userID) : null;
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
