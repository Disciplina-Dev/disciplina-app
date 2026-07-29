import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { KpiService } from '../../services/KpiService';
import { RhKpiService } from '../../services/RhKpiService';
import { toolResult } from '../serialize';
import { readTool } from '../tool';

const kpi = new KpiService();
const rhKpi = new RhKpiService();

export function registerKpiTools(server: McpServer): void {
    readTool(server, 'kpi_available_years', 'Années disponibles pour les KPI commerciaux.', {}, async () =>
        toolResult(await kpi.getAvailableYears()),
    );

    readTool(
        server,
        'kpi_overview',
        "Vue d'ensemble des KPI commerciaux pour une année (tous sites / commerciaux).",
        { year: z.number().int().describe('Année (ex: 2026)') },
        async ({ year }) => toolResult(await kpi.getOverview(year)),
    );

    readTool(
        server,
        'kpi_annual_summary',
        'Résumé annuel des KPI commerciaux pour un site donné.',
        {
            year: z.number().int().describe('Année'),
            site: z.string().describe('Site (ex: NORD, SUD)'),
        },
        async ({ year, site }) => toolResult(await kpi.getAnnualSummary(year, site)),
    );

    readTool(
        server,
        'kpi_activity',
        'Activité détaillée (appels, RDV, AB…) des KPI commerciaux pour un site, optionnellement filtrée sur un commercial.',
        {
            year: z.number().int().describe('Année'),
            site: z.string().describe('Site (ex: NORD, SUD)'),
            userId: z.number().int().optional().describe('Filtrer sur un commercial précis'),
        },
        async ({ year, site, userId }) => toolResult(await kpi.getActivity(year, site, userId)),
    );

    readTool(
        server,
        'rh_kpi_report',
        'Rapport des KPI RH (matching, entretiens, placements) pour une année.',
        { year: z.number().int().describe('Année') },
        async ({ year }) => toolResult(await rhKpi.getReport(year)),
    );
}
