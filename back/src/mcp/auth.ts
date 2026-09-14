import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { env } from '../config/env';
import { verifyMcpAccessToken } from './oauth/tokens';
import { syncWithRegion } from '../db/tenant';
import { UserRepository } from '../repositories/mysql/UserRepository';
import { toUser } from '../services/mappers/user.mapper';
import { JobRole, Permission, User } from '../types/user.types';
import type { Region } from '../types/tenant';
import type { McpUser } from './types';
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

// Contexte admin synthétique pour la clé MCP statique (Claude Code / Desktop) :
// accès complet, calqué sur un compte ADMIN/GESTION, sur le tenant par défaut.
function mcpAdminUser(): McpUser {
    return {
        id: 0,
        role: JobRole.GESTION,
        permission: Permission.ADMIN,
        sectors: null,
        region: env.DB_DEFAULT_TENANT,
    };
}

// Résout l'utilisateur derrière un access token OAuth, dans la région portée par
// le token. Le lookup par requête garantit un RBAC/secteurs frais (un user
// démote ou désactivé perd l'accès au prochain appel). Id=0 impossible en base.
function resolveMcpOAuthUser(userId: number, region: Region): Promise<McpUser | null> {
    return syncWithRegion(region, async () => {
        const row = await new UserRepository().findById(userId);
        if (!row) return null;
        const user: User = toUser(row);
        return { id: user.id, role: user.role, permission: user.permission, sectors: user.sectors, region };
    });
}

/**
 * Bearer-token guard for the MCP endpoint. The server is read-only but exposes
 * the entire CRM, so the transport must never be reachable without a valid
 * credential. Returns 404 when no key is configured so the endpoint is
 * effectively absent.
 *
 * Deux sources sont acceptées, toutes deux résolues vers un contexte McpUser :
 * - la clé statique MCP_API_KEY (clients directs : Claude Code / Desktop) →
 *   contexte admin complet sur le tenant par défaut ;
 * - un access token OAuth émis par notre authorization server (claude.ai web) →
 *   l'utilisateur CRM lié au consentement, scopé par rôle/permission/région.
 */
export async function mcpAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
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
            res.locals.mcpUser = mcpAdminUser();
            next();
            return;
        }

        const oauth = provided ? verifyMcpAccessToken(provided) : null;
        if (oauth) {
            const user = await resolveMcpOAuthUser(oauth.userId, oauth.region);
            if (!user) {
                logger.warn(
                    { ip: req.ip, userId: oauth.userId, region: oauth.region },
                    'MCP OAuth token rejected: user not found or inactive',
                );
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            res.locals.mcpUser = user;
            logger.info(
                { ip: req.ip, clientId: oauth.clientId, userId: user.id, region: user.region },
                'MCP OAuth token accepted',
            );
            next();
            return;
        }

        logger.warn({ ip: req.ip }, 'MCP auth failed');
        res.status(401).json({ error: 'Unauthorized' });
    } catch (error) {
        logger.error({ err: error }, 'MCP auth error');
        res.status(500).json({ error: 'Internal server error' });
    }
}