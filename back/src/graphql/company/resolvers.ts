import { CompaniesService } from '../../services/CompaniesService';
import { CompaniesRow } from '../../types/db-rows.types';
import { UserService } from '../../services/UserService';
import { authGuard } from '../authGuard';
import { Role } from '../../types/user.types';
import { buildConnection, DEFAULT_PAGE_SIZE, PaginationArgs } from '../../services/pagination';

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
    relanceDate?: string | null;
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
    if (input.relanceDate !== undefined) row.relance_date = input.relanceDate ? input.relanceDate.slice(0, 10) : null;
    return row;
}

export const resolvers = {
    Query: {
        companies: async (_: unknown, { first, after, search }: PaginationArgs & { search?: string }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            const pageSize = first ?? DEFAULT_PAGE_SIZE;
            const companies = await companiesService.findAll(pageSize, after, search);
            const conn = buildConnection(companies, (c) => String(c.id), search ? companies.length : pageSize);
            const enrichedEdges = await Promise.all(
                conn.edges.map(async (edge) => ({
                    ...edge,
                    node: {
                        company: edge.node,
                        salePerson: await userService.findById(edge.node.userID ?? 0),
                    },
                })),
            );
            return { ...conn, edges: enrichedEdges };
        },

        salePersons: async (_: unknown, __: unknown, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            return userService.findByRoles([Role.COMMERCIAL, Role.RESPONSABLE]);
        },

        salePerson: async (_: unknown, { id }: { id: number }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            return userService.findById(id);
        },

        companyByCommercial: async (_: unknown, { userID }: { userID: number }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
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
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            const company = await companiesService.findBySiret(siret);
            if (!company) return null;
            return {
                ...company,
            };
        },
    },
    Mutation: {
        createCompany: async (_: unknown, { input }: { input: CompanyInput }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            const rowData = mapInputToRow(input);
            const company = await companiesService.create(rowData);
            return {
                ...company,
            };
        },
        updateCompany: async (_: unknown, { id, input }: { id: number; input: CompanyInput }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            if (context.user.role === Role.COMMERCIAL) {
                const existing = await companiesService.findById(id);
                if (existing?.userID && existing.userID !== context.user.id) {
                    throw new Error('Forbidden: You can only edit your own companies');
                }
            }
            const rowData = mapInputToRow(input);
            const company = await companiesService.update(id, rowData);
            return {
                ...company,
            };
        },
        deleteCompany: async (_: unknown, { id }: { id: number }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            return companiesService.delete(id);
        },
    },
};
