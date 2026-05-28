import { CompaniesService } from '../../services/CompaniesService';
import { CompaniesRow } from '../../types/db-rows.types';
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
    const row: Partial<CompaniesRow> = {};
    if (input.userID !== undefined) row.user_id = input.userID;
    if (input.legalReferent !== undefined) row.legal_referent = input.legalReferent;
    if (input.name !== undefined) row.name = input.name ?? '';
    if (input.phone !== undefined) row.phone = input.phone;
    if (input.email !== undefined) row.email = input.email;
    if (input.address !== undefined) row.address = input.address ?? '';
    if (input.sector !== undefined) row.sector = input.sector ?? '';
    if (input.mainActivity !== undefined) row.main_activity = input.mainActivity;
    if (input.siret !== undefined) row.siret = input.siret ?? '';
    if (input.idcc !== undefined) row.idcc = input.idcc;
    if (input.ape !== undefined) row.ape = input.ape;
    if (input.notes !== undefined) row.notes = input.notes;
    if (input.conclusion !== undefined) row.conclusion = input.conclusion ?? 'À Réfléchir';
    return row;
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
                    company,
                    salePerson,
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
                    company,
                    salePerson,
                });
            }
            return result;
        },

        companyBySiret: async (_: unknown, { siret }: { siret: string }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL]);
            const company = await companiesService.findBySiret(siret);
            if (!company) return null;
            return {
                ...company,
            };
        },
    },
    Mutation: {
        createCompany: async (_: unknown, { input }: { input: CompanyInput }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL]);
            const rowData = mapInputToRow(input);
            const company = await companiesService.create(rowData);
            return {
                ...company,
            };
        },
        updateCompany: async (_: unknown, { id, input }: { id: number; input: CompanyInput }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL]);
            const rowData = mapInputToRow(input);
            const company = await companiesService.update(id, rowData);
            const salePerson = company?.userID ? await userService.findById(company.userID) : null;
            return {
                ...company,
            };
        },
        deleteCompany: async (_: unknown, { id }: { id: number }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL]);
            return companiesService.delete(id);
        },
    },
};
