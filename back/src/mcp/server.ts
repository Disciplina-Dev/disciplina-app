import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerCompanyTools } from './tools/companies';
import { registerNeedsAnalysisTools } from './tools/needsAnalysis';
import { registerCandidateTools } from './tools/candidates';
import { registerOfferTools } from './tools/offers';
import { registerKpiTools } from './tools/kpi';
import { registerMiscTools } from './tools/misc';

/**
 * Builds a fresh read-only MCP server exposing the whole CRM (companies, needs
 * analyses, candidates, offers/matching, KPI, sector settings, notifications).
 *
 * Stateless: a new instance is created per HTTP request so the server can run on
 * serverless (Vercel). All tools delegate to the existing service layer — no data
 * mutation is possible.
 */
export function buildMcpServer(): McpServer {
    const server = new McpServer({
        name: 'disciplina-crm',
        version: '1.0.0',
    });

    registerCompanyTools(server);
    registerNeedsAnalysisTools(server);
    registerCandidateTools(server);
    registerOfferTools(server);
    registerKpiTools(server);
    registerMiscTools(server);

    return server;
}
