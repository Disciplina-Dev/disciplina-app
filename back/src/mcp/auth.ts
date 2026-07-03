import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { env } from '../config/env';

/**
 * Bearer-token guard for the MCP endpoint. The server is read-only but exposes
 * the entire CRM, so the transport must never be reachable without the key.
 * Returns 404 when no key is configured so the endpoint is effectively absent.
 */
export function mcpAuth(req: Request, res: Response, next: NextFunction): void {
    const configured = env.MCP_API_KEY;
    if (!configured) {
        res.status(404).json({ error: 'MCP endpoint disabled' });
        return;
    }

    const header = req.header('authorization') ?? '';
    const provided = header.startsWith('Bearer ') ? header.slice(7) : '';

    const a = Buffer.from(provided);
    const b = Buffer.from(configured);
    const ok = a.length === b.length && timingSafeEqual(a, b);
    if (!ok) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    next();
}
