import type { Response } from 'express';
import { logger } from '../../external/logger';

/**
 * Réponse d'erreur commune aux contrôleurs REST : une erreur métier (`status`
 * posé par `services/httpError`) sort en 4xx avec son code, le reste est
 * journalisé et rendu en 500 générique — jamais de détail interne au client.
 */
export function sendError(res: Response, error: unknown, context: string): void {
    const err = error as Error & { status?: number; code?: string };
    if (typeof err.status === 'number' && err.status < 500) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
    }
    logger.error({ err: error }, context);
    res.status(typeof err.status === 'number' ? err.status : 500).json({
        error: 'Une erreur interne est survenue',
        code: err.code ?? 'internal',
    });
}
