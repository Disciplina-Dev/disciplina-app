import { CompaniesService } from '../../services/CompaniesService';
import { CompaniesBlacklistService } from '../../services/CompaniesBlacklistService';
import { ContactLogService } from '../../services/ContactLogService';
import { toBlacklistedCompany } from '../../services/mappers/company.mapper';
import { CompanyFilters } from '../../repositories/mysql/CompanyRepository';
import { CompaniesRow } from '../../types/db-rows.types';
import { UserService } from '../../services/UserService';
import { authGuard } from '../authGuard';
import { Role } from '../../types/user.types';
import { buildConnection, DEFAULT_PAGE_SIZE, PaginationArgs } from '../../services/pagination';

const companiesService = new CompaniesService();
const companiesBlacklistService = new CompaniesBlacklistService();
const contactLogService = new ContactLogService();
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
    status?: string | null;
    relanceDate?: string | null;
    relanceType?: number | null;
    relanceTemplateId?: string | null;
    relanceChannel?: string | null;
}

const ALLOWED_SECTORS = new Set(['Nord-Est', 'Ouest', 'Sud']);
const DEFAULT_SECTOR = 'Nord-Est';
const ALLOWED_STATUSES = new Set(['Oui', 'Non', 'À Réfléchir', 'Relance', 'Réponds pas', 'Fermé']);
const DEFAULT_STATUS = 'À Réfléchir';

function mapInputToRow(input: CompanyInput): Partial<CompaniesRow> {
    const row: Partial<CompaniesRow> = {};
    if (input.userID !== undefined) row.user_id = input.userID;
    if (input.legalReferent !== undefined) row.legal_referent = input.legalReferent;
    if (input.name !== undefined) row.name = input.name ?? '';
    if (input.phone !== undefined) row.phone = input.phone;
    if (input.email !== undefined) row.email = input.email;
    if (input.address !== undefined) row.address = input.address ?? '';
    if (input.sector !== undefined)
        row.sector = input.sector && ALLOWED_SECTORS.has(input.sector) ? input.sector : DEFAULT_SECTOR;
    if (input.mainActivity !== undefined) row.main_activity = input.mainActivity;
    if (input.siret !== undefined) row.siret = input.siret ?? '';
    if (input.idcc !== undefined) row.idcc = input.idcc;
    if (input.ape !== undefined) row.ape = input.ape;
    if (input.notes !== undefined) row.notes = input.notes;
    if (input.conclusion !== undefined) row.conclusion = input.conclusion ?? '';
    if (input.status !== undefined)
        row.status = input.status && ALLOWED_STATUSES.has(input.status) ? input.status : DEFAULT_STATUS;
    if (input.relanceDate !== undefined) row.relance_date = input.relanceDate ? input.relanceDate.slice(0, 10) : null;
    if (input.relanceType !== undefined) row.relance_type = input.relanceType;
    if (input.relanceTemplateId !== undefined) row.relance_template_id = input.relanceTemplateId;
    if (input.relanceChannel !== undefined) row.relance_channel = input.relanceChannel;
    return row;
}

export const resolvers = {
    Query: {
        companies: async (
            _: unknown,
            {
                first,
                after,
                search,
                filters: filtersInput,
            }: PaginationArgs & { search?: string; filters?: Record<string, unknown> },
            context: any,
        ) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            const pageSize = first ?? DEFAULT_PAGE_SIZE;
            const filters: CompanyFilters | undefined = filtersInput
                ? {
                      status: filtersInput.status as string[] | undefined,
                      userID: filtersInput.userID as number | undefined,
                      sector: filtersInput.sector as string | undefined,
                      relance: filtersInput.relance as string | undefined,
                      unassigned: filtersInput.unassigned as boolean | undefined,
                      createdFrom: filtersInput.createdFrom as string | undefined,
                      createdTo: filtersInput.createdTo as string | undefined,
                  }
                : undefined;
            const companies = await companiesService.findAll(pageSize, after, search, filters);
            const isRelanceMode = !!filters?.relance;
            const conn = buildConnection(
                companies,
                (c) => String(c.id),
                search || isRelanceMode ? companies.length : pageSize,
            );
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

        // Liste légère (id + nom) pour les sélecteurs d'entreprise côté RH
        // (ex. choix de l'entreprise d'immersion sur la fiche candidat).
        companyOptions: async (_: unknown, __: unknown, context: any) => {
            authGuard(context.user, [Role.RH, Role.RESPONSABLE, Role.ADMIN, Role.COMMERCIAL]);
            const companies = await companiesService.findAll(100000);
            return companies.map((c) => ({ id: c.id, name: c.name }));
        },

        companyStats: async (_: unknown, { year }: { year: number }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            // Plain COMMERCIAL users only get their own numbers; RESPONSABLE/ADMIN see the whole team
            const restrictedTo = context.user.role === Role.COMMERCIAL ? Number(context.user.id) : null;
            return companiesService.getStats(Math.floor(Number(year)), restrictedTo);
        },

        salePersons: async (_: unknown, __: unknown, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            return userService.findByRoles([Role.COMMERCIAL, Role.RESPONSABLE]);
        },

        // Liste « Entretien fait par » : users cochés is_interviewer, tous rôles
        // confondus (l'équipe qui mène les AB déborde le seul rôle RH).
        rhUsers: async (_: unknown, __: unknown, context: any) => {
            authGuard(context.user, [Role.RH, Role.RESPONSABLE, Role.ADMIN]);
            return userService.findInterviewers();
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

        blacklistedCompanies: async (
            _: unknown,
            { first, after, search }: PaginationArgs & { search?: string },
            context: any,
        ) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            const pageSize = first ?? DEFAULT_PAGE_SIZE;
            const rows = await companiesBlacklistService.findAll(pageSize, after, search);
            const companies = rows.map(toBlacklistedCompany);
            return buildConnection(companies, (c) => String(c.id), search ? companies.length : pageSize);
        },

        companyHistory: async (_: unknown, { companyID }: { companyID: number }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            return companiesService.getHistory(companyID);
        },

        contactLogs: async (_: unknown, { companyID }: { companyID: number }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            // Timeline interne : tous les rôles internes voient toutes les prises de contact.
            return contactLogService.getByCompany(companyID);
        },

        contactLogStats: async (_: unknown, __: unknown, context: any) => {
            authGuard(context.user, [Role.RESPONSABLE]);
            return contactLogService.getStats();
        },
    },
    Mutation: {
        createCompany: async (_: unknown, { input }: { input: CompanyInput }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            const rowData = mapInputToRow(input);
            if (context.user.role === Role.COMMERCIAL) {
                rowData.user_id = context.user.id;
            } else if (rowData.user_id === undefined) {
                rowData.user_id = context.user.id;
            }
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
            const company = await companiesService.update(id, rowData, Number(context.user.id));
            return {
                ...company,
            };
        },
        deleteCompany: async (_: unknown, { id }: { id: number }, context: any) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            if (context.user.role === Role.COMMERCIAL) {
                const existing = await companiesService.findById(id);
                if (existing?.userID && existing.userID !== context.user.id) {
                    throw new Error('Forbidden: You can only delete your own companies');
                }
            }
            return companiesService.delete(id);
        },
        blacklistCompany: async (
            _: unknown,
            { id, reason, allBlacklist }: { id: number; reason: string; allBlacklist: boolean },
            context: any,
        ) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            return companiesBlacklistService.blacklistCompany(id, reason, allBlacklist);
        },
        unblacklistCompany: async (_: unknown, { id }: { id: number }, context: any) => {
            authGuard(context.user, [Role.RESPONSABLE]);
            return companiesBlacklistService.unblacklistCompany(id);
        },
        createContactLog: async (
            _: unknown,
            { companyID, comment }: { companyID: number; comment: string },
            context: any,
        ) => {
            authGuard(context.user, [Role.COMMERCIAL, Role.RESPONSABLE]);
            // user_id provient toujours du token, jamais du body.
            return contactLogService.create(companyID, Number(context.user.id), comment);
        },
    },
};
