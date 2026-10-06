import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CompaniesService } from '../../services/CompaniesService';
import { ContactLogService } from '../../services/ContactLogService';
import { CompaniesBlacklistService } from '../../services/CompaniesBlacklistService';
import { CompanyConflictService } from '../../services/CompanyConflictService';
import { RelanceHistoryRepository } from '../../repositories/mysql/RelanceHistoryRepository';
import { toBlacklistedCompany, toCompanyConflict, toRelanceHistory } from '../../services/mappers/company.mapper';
import { toolResult } from '../serialize';
import { currentMcpUser } from '../context';
import { readTool } from '../tool';
import { mcpToolScope } from '../rbac';
import { JobRole, Permission } from '../../types/user.types';
import { decodeCursor } from '../../services/pagination';

// Avec `search`, les repositories renvoient tout (sans LIMIT) : on applique le
// curseur et la limite ici, comme le chemin sans recherche (first + 1 lignes, id > after).
function paginateSearch<T extends { id: number }>(
    rows: T[],
    first: number,
    after: string | undefined,
    search?: string,
): T[] {
    if (!search?.trim()) return rows;
    const afterId = after ? Math.floor(Number(decodeCursor(after))) : null;
    const remaining = afterId === null ? rows : rows.filter((row) => row.id > afterId);
    return remaining.slice(0, first + 1);
}

// Fiches entreprises : donnée commerciale (miroir des guards GraphQL company).
// Conflits d'entreprises (doublons à arbitrer) : réservé RESPONSABLE+ (miroir du guard GraphQL).
const CONFLICT_SCOPE = mcpToolScope(Permission.RESPONSABLE, []);

const COMPANY_SCOPE = mcpToolScope(Permission.EMPLOYEE, [JobRole.COMMERCIAL]);

const companies = new CompaniesService();
const contactLogs = new ContactLogService();
const blacklist = new CompaniesBlacklistService();
const conflicts = new CompanyConflictService();
const relanceRepo = new RelanceHistoryRepository();

export function registerCompanyTools(server: McpServer): void {
    readTool(
        server,
        'get_company',
        'Récupère la fiche entreprise complète par son id (MySQL) : raison sociale, SIRET, APE, adresse, secteur, référent, statut, conclusion, notes, relance.',
        { id: z.number().int().describe("Id numérique de l'entreprise") },
        COMPANY_SCOPE,
        async ({ id }) => toolResult(await companies.findById(id)),
    );

    readTool(
        server,
        'search_companies',
        'Liste / recherche les fiches entreprises (nom, SIRET…). Pagination cursor-based.',
        {
            search: z.string().optional().describe('Terme de recherche (nom, siret)'),
            first: z.number().int().positive().max(200).optional().describe('Nombre max (défaut 50)'),
            after: z.string().optional().describe('Cursor de pagination'),
        },
        COMPANY_SCOPE,
        async ({ search, first, after }) =>
            toolResult(paginateSearch(await companies.findAll(first ?? 50, after, search), first ?? 50, after, search)),
    );

    readTool(
        server,
        'get_company_by_siret',
        'Récupère une fiche entreprise par son numéro SIRET.',
        { siret: z.string().describe('Numéro SIRET (14 chiffres)') },
        COMPANY_SCOPE,
        async ({ siret }) => toolResult(await companies.findBySiret(siret)),
    );

    readTool(
        server,
        'list_company_history',
        "Historique des modifications d'une fiche entreprise (audit trail).",
        { companyId: z.number().int().describe("Id de l'entreprise") },
        COMPANY_SCOPE,
        async ({ companyId }) => toolResult(await companies.getHistory(companyId)),
    );

    readTool(
        server,
        'list_contact_logs',
        "Journal des contacts / comptes-rendus d'appels commerciaux pour une entreprise.",
        { companyId: z.number().int().describe("Id de l'entreprise") },
        COMPANY_SCOPE,
        async ({ companyId }) => toolResult(await contactLogs.getByCompany(companyId)),
    );

    readTool(
        server,
        'list_relances',
        'Historique des relances (mail/téléphone) envoyées à une entreprise.',
        { companyId: z.number().int().describe("Id de l'entreprise") },
        COMPANY_SCOPE,
        async ({ companyId }) => toolResult((await relanceRepo.findByCompanyId(companyId)).map(toRelanceHistory)),
    );

    readTool(
        server,
        'list_blacklist',
        'Liste des entreprises blacklistées (avec motif).',
        {
            search: z.string().optional(),
            first: z.number().int().positive().max(200).optional(),
            after: z.string().optional(),
        },
        COMPANY_SCOPE,
        async ({ search, first, after }) =>
            toolResult(
                paginateSearch(await blacklist.findAll(first ?? 50, after, search), first ?? 50, after, search).map(
                    toBlacklistedCompany,
                ),
            ),
    );

    readTool(
        server,
        'list_company_conflicts',
        "Conflits d'entreprises (doublons détectés à l'import, à arbitrer). Filtrable par type de conflit. Pagination cursor-based.",
        {
            search: z.string().optional(),
            conflictType: z.string().optional().describe('Type de conflit'),
            first: z.number().int().positive().max(200).optional(),
            after: z.string().optional(),
        },
        CONFLICT_SCOPE,
        async ({ search, conflictType, first, after }) =>
            toolResult(
                paginateSearch(
                    await conflicts.findAll(first ?? 50, after, search, conflictType),
                    first ?? 50,
                    after,
                    search,
                ).map(toCompanyConflict),
            ),
    );

    readTool(
        server,
        'company_stats',
        "Statistiques du portefeuille entreprises pour une année : répartition actuelle par commercial et statut, détail par semaine/mois, années disponibles. Un COMMERCIAL ne voit que ses propres chiffres ; RESPONSABLE et ADMIN voient toute l'équipe.",
        { year: z.number().int().describe('Année (ex: 2026)') },
        COMPANY_SCOPE,
        async ({ year }) => {
            const me = currentMcpUser();
            const restrictedTo = me?.role === JobRole.COMMERCIAL ? me.id : null;
            return toolResult(await companies.getStats(year, restrictedTo));
        },
    );
}
