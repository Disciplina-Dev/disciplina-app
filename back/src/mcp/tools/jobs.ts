import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JobService } from '../../services/JobService';
import { toolResult } from '../serialize';
import { readTool } from '../tool';

const jobs = new JobService();

export function registerJobTools(server: McpServer): void {
    readTool(
        server,
        'list_jobs',
        'Liste toutes les offres / postes (MongoDB) avec leurs critères de matching et statut.',
        {},
        async () => toolResult(await jobs.findAll()),
    );

    readTool(
        server,
        'get_job',
        "Récupère une offre par id, avec les candidats suggérés par le matching automatique selon ses critères.",
        { id: z.string().describe("Id de l'offre") },
        async ({ id }) => toolResult(await jobs.find(id)),
    );

    readTool(
        server,
        'job_company_info',
        "Fiche entreprise + Analyse du Besoin liées à une offre (résolution directe ou fallback par nom).",
        { jobId: z.string().describe("Id de l'offre") },
        async ({ jobId }) => toolResult(await jobs.getCompanyInfo(jobId)),
    );
}
