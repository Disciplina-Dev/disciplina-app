import { CompaniesService } from '../../services/CompaniesService';
import { CompaniesBlacklistService } from '../../services/CompaniesBlacklistService';
import { CompanyConflictService } from '../../services/CompanyConflictService';
import { NeedsAnalysisService } from '../../services/NeedsAnalysisService';
import { ContactLogService } from '../../services/ContactLogService';
import { toBlacklistedCompany, toCompanyConflict, toCompanies } from '../../services/mappers/company.mapper';
import { CompanyFilters } from '../../repositories/mysql/CompanyRepository';
import { CompaniesRow, CompanyConflictRow } from '../../types/db-rows.types';
import { UserService } from '../../services/UserService';
import { authGuard, authGuardRole } from '../authGuard';
import { JobRole, Permission } from '../../types/user.types';
import { buildConnection, DEFAULT_PAGE_SIZE, PaginationArgs } from '../../services/pagination';

const companiesService = new CompaniesService();
const companiesBlacklistService = new CompaniesBlacklistService();
const companyConflictService = new CompanyConflictService();
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

interface CompanyConflictInput {
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
    userId?: number | null;
}

function mapConflictInputToRow(input: CompanyConflictInput): Partial<CompanyConflictRow> {
    const row: Partial<CompanyConflictRow> = {};
    if (input.legalReferent !== undefined) row.legal_referent = input.legalReferent;
    if (input.name !== undefined) row.name = input.name;
    if (input.phone !== undefined) row.phone = input.phone;
    if (input.email !== undefined) row.email = input.email;
    if (input.address !== undefined) row.address = input.address;
    if (input.sector !== undefined) row.sector = input.sector;
    if (input.mainActivity !== undefined) row.main_activity = input.mainActivity;
    if (input.siret !== undefined) row.siret = input.siret;
    if (input.idcc !== undefined) row.idcc = input.idcc;
    if (input.ape !== undefined) row.ape = input.ape;
    if (input.userId !== undefined) row.user_id = input.userId;
    return row;
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
    // « Aucune relance » : vider la date purge aussi le type / modèle / canal, sinon
    // la fiche garde une relance orpheline invisible dans la page Relances.
    if (input.relanceDate !== undefined && row.relance_date === null) {
        row.relance_type = null;
        row.relance_template_id = null;
        row.relance_channel = null;
    }
    return row;
}

function toCompanyFilters(filtersInput?: Record<string, unknown>): CompanyFilters | undefined {
    if (!filtersInput) return undefined;
    return {
        status: filtersInput.status as string[] | undefined,
        userID: filtersInput.userID as number | undefined,
        sector: filtersInput.sector as string | undefined,
        relance: filtersInput.relance as string | undefined,
        unassigned: filtersInput.unassigned as boolean | undefined,
        createdFrom: filtersInput.createdFrom as string | undefined,
        createdTo: filtersInput.createdTo as string | undefined,
    };
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
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.COMMERCIAL]);
            const pageSize = first ?? DEFAULT_PAGE_SIZE;
            const filters = toCompanyFilters(filtersInput);
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

        companiesBySiren: async (
            _: unknown,
            { first, after, filters: filtersInput }: PaginationArgs & { filters?: Record<string, unknown> },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.COMMERCIAL]);
            const pageSize = first ?? DEFAULT_PAGE_SIZE;
            const filters = toCompanyFilters(filtersInput);
            const groups = await companiesService.findGroupedBySiren(pageSize, after, filters);
            return buildConnection(groups, (g) => g.siren, pageSize);
        },

        // Liste légère (id + nom) pour les sélecteurs d'entreprise côté RH
        // (ex. choix de l'entreprise d'immersion sur la fiche candidat).
        companyOptions: async (_: unknown, __: unknown, context: any) => {
            authGuardRole(context.user, Permission.RESPONSABLE, [JobRole.RH, JobRole.COMMERCIAL]);
            const companies = await companiesService.findAll(100000);
            return companies.map((c) => ({ id: c.id, name: c.name }));
        },

        companyStats: async (_: unknown, { year }: { year: number }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.COMMERCIAL]);
            // Plain COMMERCIAL users only get their own numbers; RESPONSABLE/ADMIN see the whole team
            const restrictedTo = context.user.role === JobRole.COMMERCIAL ? Number(context.user.id) : null;
            return companiesService.getStats(Math.floor(Number(year)), restrictedTo);
        },

        salePersons: async (_: unknown, __: unknown, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.COMMERCIAL]);
            return userService.findByJobRoles([JobRole.COMMERCIAL]);
        },

        // Liste « Entretien fait par » : users cochés is_interviewer, tous rôles
        // confondus (l'équipe qui mène les AB déborde le seul rôle RH).
        rhUsers: async (_: unknown, __: unknown, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            return userService.findInterviewers();
        },

        salePerson: async (_: unknown, { id }: { id: number }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.COMMERCIAL]);
            return userService.findById(id);
        },

        companyByCommercial: async (_: unknown, { userID }: { userID: number }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.COMMERCIAL]);
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
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.COMMERCIAL]);
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
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.COMMERCIAL]);
            const pageSize = first ?? DEFAULT_PAGE_SIZE;
            const rows = await companiesBlacklistService.findAll(pageSize, after, search);
            const companies = rows.map(toBlacklistedCompany);
            return buildConnection(companies, (c) => String(c.id), search ? companies.length : pageSize);
        },

        companyConflicts: async (
            _: unknown,
            { first, after, search, conflictType }: PaginationArgs & { search?: string; conflictType?: string },
            context: any,
        ) => {
            authGuard(context.user, Permission.RESPONSABLE);
            const pageSize = first ?? DEFAULT_PAGE_SIZE;
            const rows = await companyConflictService.findAll(pageSize, after, search, conflictType);
            const conflicts = rows.map(toCompanyConflict);
            return buildConnection(conflicts, (c) => String(c.id), search ? conflicts.length : pageSize);
        },

        companyHistory: async (_: unknown, { companyID }: { companyID: number }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.COMMERCIAL]);
            return companiesService.getHistory(companyID);
        },

        contactLogs: async (_: unknown, { companyID }: { companyID: number }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.COMMERCIAL]);
            // Timeline interne : tous les rôles internes voient toutes les prises de contact.
            return contactLogService.getByCompany(companyID);
        },

        contactLogStats: async (_: unknown, __: unknown, context: any) => {
            authGuard(context.user, Permission.RESPONSABLE);
            return contactLogService.getStats();
        },
    },
    Mutation: {
        createCompany: async (_: unknown, { input }: { input: CompanyInput }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.COMMERCIAL]);
            const rowData = mapInputToRow(input);
            if (context.user.role === JobRole.COMMERCIAL) {
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
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.COMMERCIAL]);
            if (context.user.role === JobRole.COMMERCIAL && context.user.permission === Permission.EMPLOYEE) {
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
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.COMMERCIAL]);
            if (context.user.role === JobRole.COMMERCIAL) {
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
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.COMMERCIAL]);
            return companiesBlacklistService.blacklistCompany(id, reason, allBlacklist);
        },
        unblacklistCompany: async (_: unknown, { id }: { id: number }, context: any) => {
            authGuard(context.user, Permission.RESPONSABLE);
            return companiesBlacklistService.unblacklistCompany(id);
        },
        deleteAndBlacklistCompany: async (
            _: unknown,
            { companyId, reason, allBlacklist }: { companyId: number; reason: string; allBlacklist: boolean },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.RESPONSABLE, [JobRole.RH]);
            const needsAnalysisService = new NeedsAnalysisService();
            const nas = await needsAnalysisService.findByCompanyId(companyId);
            for (const na of nas) {
                await needsAnalysisService.delete(na.id);
            }
            return companiesBlacklistService.blacklistCompany(companyId, reason, allBlacklist);
        },
        updateCompanyConflict: async (
            _: unknown,
            { id, input }: { id: number; input: CompanyConflictInput },
            context: any,
        ) => {
            authGuard(context.user, Permission.RESPONSABLE);
            const row = await companyConflictService.updateConflict(id, mapConflictInputToRow(input));
            return toCompanyConflict(row);
        },
        resolveCompanyConflict: async (_: unknown, { id }: { id: number }, context: any) => {
            authGuard(context.user, Permission.RESPONSABLE);
            const company = await companyConflictService.resolveConflict(id);
            return toCompanies(company);
        },
        deleteCompanyConflict: async (_: unknown, { id }: { id: number }, context: any) => {
            authGuard(context.user, Permission.RESPONSABLE);
            return companyConflictService.deleteConflict(id);
        },
        deleteCompanyConflictsByType: async (_: unknown, { conflictType }: { conflictType: string }, context: any) => {
            authGuard(context.user, Permission.RESPONSABLE);
            return companyConflictService.deleteConflictsByType(conflictType);
        },
        createContactLog: async (
            _: unknown,
            { companyID, comment }: { companyID: number; comment: string },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.COMMERCIAL]);
            // user_id provient toujours du token, jamais du body.
            return contactLogService.create(companyID, Number(context.user.id), comment);
        },
    },
};
