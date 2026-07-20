import express, { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { buildMcpServer } from './server';
import { mcpAuth } from './auth';
import { mcpRateLimiter } from '../rest/middleware/rateLimiter';
import { logger } from '../external/logger';

export const router = express.Router();

/**
 * Read-only MCP endpoint (stateless / serverless-friendly).
 *
 * Each POST spins up a fresh server + transport, handles the single JSON-RPC
 * request, then tears both down. No session store, no SSE stream to keep alive.
 * GET/DELETE are unsupported in stateless mode → 405.
 */
router.post(
    '/api/mcp',
    mcpRateLimiter,
    mcpAuth,
    express.json({ limit: '1mb' }),
    async (req: Request, res: Response) => {
        const server = buildMcpServer();
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

        res.on('close', () => {
            transport.close();
            server.close();
        });

        // Audit : trace tout accès authentifié au CRM (méthode JSON-RPC + IP).
        logger.info({ ip: req.ip, method: req.body?.method, mcpToolName: req.body?.params?.name }, 'MCP request');

        try {
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
        } catch (error) {
            logger.error({ err: error }, 'MCP request failed');
            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: '2.0',
                    error: { code: -32603, message: 'Internal server error' },
                    id: null,
                });
            }
        }
    },
);

const methodNotAllowed = (_req: Request, res: Response): void => {
    res.status(405).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed (stateless MCP: use POST)' },
        id: null,
    });
};

router.get('/api/mcp', mcpRateLimiter, mcpAuth, methodNotAllowed);
router.delete('/api/mcp', mcpRateLimiter, mcpAuth, methodNotAllowed);
