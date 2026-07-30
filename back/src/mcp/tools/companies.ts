import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CompaniesService } from '../../services/CompaniesService';
import { ContactLogService } from '../../services/ContactLogService';
import { CompaniesBlacklistService } from '../../services/CompaniesBlacklistService';
import { RelanceHistoryRepository } from '../../repositories/mysql/RelanceHistoryRepository';
import { toolResult } from '../serialize';
import { readTool } from '../tool';

const companies = new CompaniesService();
const contactLogs = new ContactLogService();
const blacklist = new CompaniesBlacklistService();
const relanceRepo = new RelanceHistoryRepository();

export function registerCompanyTools(server: McpServer): void {
    readTool(
        server,
        'get_company',
        'Récupère la fiche entreprise complète par son id (MySQL) : raison sociale, SIRET, APE, adresse, secteur, référent, statut, conclusion, notes, relance.',
        { id: z.number().int().describe("Id numérique de l'entreprise") },
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
        async ({ search, first, after }) => toolResult(await companies.findAll(first ?? 50, after, search)),
    );

    readTool(
        server,
        'get_company_by_siret',
        'Récupère une fiche entreprise par son numéro SIRET.',
        { siret: z.string().describe('Numéro SIRET (14 chiffres)') },
        async ({ siret }) => toolResult(await companies.findBySiret(siret)),
    );

    readTool(
        server,
        'list_company_history',
        "Historique des modifications d'une fiche entreprise (audit trail).",
        { companyId: z.number().int().describe("Id de l'entreprise") },
        async ({ companyId }) => toolResult(await companies.getHistory(companyId)),
    );

    readTool(
        server,
        'list_contact_logs',
        "Journal des contacts / comptes-rendus d'appels commerciaux pour une entreprise.",
        { companyId: z.number().int().describe("Id de l'entreprise") },
        async ({ companyId }) => toolResult(await contactLogs.getByCompany(companyId)),
    );

    readTool(
        server,
        'list_relances',
        'Historique des relances (mail/téléphone) envoyées à une entreprise.',
        { companyId: z.number().int().describe("Id de l'entreprise") },
        async ({ companyId }) => toolResult(await relanceRepo.findByCompanyId(companyId)),
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
        async ({ search, first, after }) => toolResult(await blacklist.findAll(first ?? 50, after, search)),
    );
}
