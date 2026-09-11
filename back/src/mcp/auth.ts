import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { env } from '../config/env';
import { verifyMcpAccessToken } from './oauth/tokens';
import { logger } from '../external/logger';

// Longueur minimale exigée pour la clé MCP. En dessous, la clé est jugée trop
// faible (brute-forçable) et l'endpoint est désactivé plutôt que d'exposer le
// CRM. Une clé forte se génère avec `openssl rand -hex 32` (64 caractères).
const MIN_KEY_LENGTH = 32;

function secureEquals(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * Bearer-token guard for the MCP endpoint. The server is read-only but exposes
 * the entire CRM, so the transport must never be reachable without the key.
 * Returns 404 when no key is configured so the endpoint is effectively absent.
 *
 * Deux sources sont acceptées :
 * - la clé statique MCP_API_KEY (clients directs : Claude Code / Desktop)
 * - un access token OAuth émis par notre authorization server (claude.ai web)
 */
export function mcpAuth(req: Request, res: Response, next: NextFunction): void {
    const configured = env.MCP_API_KEY;
    if (!configured) {
        res.status(404).json({ error: 'MCP endpoint disabled' });
        return;
    }

    // Clé configurée mais trop faible : fail-closed, on refuse de servir le CRM
    // plutôt que d'accepter une clé devinable.
    if (configured.length < MIN_KEY_LENGTH) {
        logger.error(
            { keyLength: configured.length, min: MIN_KEY_LENGTH },
            'MCP_API_KEY too short — endpoint disabled (use `openssl rand -hex 32`)',
        );
        res.status(404).json({ error: 'MCP endpoint disabled' });
        return;
    }

    const header = req.header('authorization') ?? '';
    const provided = header.startsWith('Bearer ') ? header.slice(7) : '';

    if (provided && secureEquals(provided, configured)) {
        next();
        return;
    }

    const oauth = provided ? verifyMcpAccessToken(provided) : null;
    if (oauth) {
        logger.info({ ip: req.ip, clientId: oauth.clientId }, 'MCP OAuth token accepted');
        next();
        return;
    }

    logger.warn({ ip: req.ip }, 'MCP auth failed');
    res.status(401).json({ error: 'Unauthorized' });
}