import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { NeedsAnalysisService } from '../../services/NeedsAnalysisService';
import { toolResult } from '../serialize';
import { readTool } from '../tool';
import { mcpToolScope } from '../rbac';
import { JobRole, Permission } from '../../types/user.types';

// Analyses du Besoin : partagée commercial / RH (miroir des guards GraphQL needsAnalysis).
const NEEDS_ANALYSIS_SCOPE = mcpToolScope(Permission.EMPLOYEE, [JobRole.COMMERCIAL, JobRole.RH]);

const needsAnalysis = new NeedsAnalysisService();

export function registerNeedsAnalysisTools(server: McpServer): void {
    readTool(
        server,
        'get_needs_analysis',
        'Récupère une Analyse du Besoin (AB) entreprise complète par son id : postes, missions, profil recherché, conditions, jours de formation, statut de signature.',
        { id: z.string().describe("Id de l'AB") },
        NEEDS_ANALYSIS_SCOPE,
        async ({ id }) => toolResult(await needsAnalysis.findById(id)),
    );

    readTool(server, 'list_needs_analysis', 'Liste toutes les Analyses du Besoin (AB) du CRM.', {}, NEEDS_ANALYSIS_SCOPE, async () =>
        toolResult(await needsAnalysis.findAll()),
    );

    readTool(
        server,
        'needs_analysis_by_company',
        'Liste les Analyses du Besoin (AB) rattachées à une entreprise donnée.',
        { companyId: z.number().int().describe("Id de l'entreprise") },
        NEEDS_ANALYSIS_SCOPE,
        async ({ companyId }) => toolResult(await needsAnalysis.findByCompanyId(companyId)),
    );
}
