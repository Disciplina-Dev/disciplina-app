import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../../external/logger';
import { FormateurService } from '../../services/FormateurService';

const service = new FormateurService();

/** Erreur métier (`status` posé par httpError) → 4xx + code ; le reste → 500 journalisé. */
function sendError(res: Response, error: unknown, context: string): void {
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

export async function list(_req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json({ formateurs: await service.list() });
    } catch (error) {
        sendError(res, error, 'Formateurs list failed');
    }
}

export async function get(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json({ formateur: await service.get(String(req.params.id)) });
    } catch (error) {
        sendError(res, error, 'Formateur fetch failed');
    }
}

export async function create(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.status(201).json({ formateur: await service.create(req.body, req.user?.id) });
    } catch (error) {
        sendError(res, error, 'Formateur create failed');
    }
}

export async function update(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json({ formateur: await service.update(String(req.params.id), req.body, req.user?.id) });
    } catch (error) {
        sendError(res, error, 'Formateur update failed');
    }
}

export async function addNote(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.status(201).json({ formateur: await service.addNote(String(req.params.id), req.body, req.user?.id) });
    } catch (error) {
        sendError(res, error, 'Formateur note failed');
    }
}
