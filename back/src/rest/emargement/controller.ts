import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../../external/logger';
import { ClientMeta, EmargementService } from '../../services/EmargementService';
import { isIsoDate } from '../../utils/zonedTime';

const service = new EmargementService();

/** Erreur métier (`status` posé par httpError) → 4xx + code ; le reste → 500 journalisé. */
export function sendError(res: Response, error: unknown, context: string): void {
    const err = error as Error & { status?: number; code?: string };
    if (typeof err.status === 'number' && err.status < 500) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
    }
    logger.error({ err: error }, context);
    res.status(typeof err.status === 'number' ? err.status : 500).json({
        error: typeof err.status === 'number' ? err.message : 'Erreur interne',
    });
}

/** IP et appareil lus côté serveur : le corps de requête ne fait jamais foi. */
export function clientMeta(req: Request): ClientMeta {
    const userAgent = req.headers['user-agent'];
    return {
        ip: req.ip ? req.ip.slice(0, 64) : null,
        userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 512) : null,
    };
}

function queryString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

// ── Côté Peda ────────────────────────────────────────────────────────────────

export async function list(req: AuthRequest, res: Response): Promise<void> {
    try {
        const from = queryString(req.query.from);
        const to = queryString(req.query.to);
        const sessionId = queryString(req.query.sessionId);
        const seances = await service.list({
            sessionId,
            from: from && isIsoDate(from) ? from : undefined,
            to: to && isIsoDate(to) ? to : undefined,
        });
        res.json({ seances });
    } catch (error) {
        sendError(res, error, 'Emargement list failed');
    }
}

export async function get(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json({ seance: await service.get(String(req.params.id)) });
    } catch (error) {
        sendError(res, error, 'Emargement fetch failed');
    }
}

export async function create(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.status(201).json(await service.create(req.body, req.user?.id));
    } catch (error) {
        sendError(res, error, 'Emargement create failed');
    }
}

export async function update(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json({ seance: await service.update(String(req.params.id), req.body) });
    } catch (error) {
        sendError(res, error, 'Emargement update failed');
    }
}

export async function remove(req: AuthRequest, res: Response): Promise<void> {
    try {
        await service.remove(String(req.params.id));
        res.json({ deleted: true });
    } catch (error) {
        sendError(res, error, 'Emargement delete failed');
    }
}

export async function resend(req: AuthRequest, res: Response): Promise<void> {
    try {
        const rotate = req.body?.rotate === true;
        res.json(await service.resendInvite(String(req.params.id), rotate, req.user?.id));
    } catch (error) {
        sendError(res, error, 'Emargement resend failed');
    }
}

// ── Côté formateur (lien public) ─────────────────────────────────────────────

export async function formateurView(req: Request, res: Response): Promise<void> {
    try {
        res.json({ emargement: await service.formateurView(String(req.params.token)) });
    } catch (error) {
        sendError(res, error, 'Emargement formateur view failed');
    }
}

export async function setAttendance(req: Request, res: Response): Promise<void> {
    try {
        const attendance = await service.setAttendance(String(req.params.token), req.body, clientMeta(req));
        res.json({ attendance });
    } catch (error) {
        sendError(res, error, 'Emargement attendance failed');
    }
}

export async function signAttendanceManually(req: Request, res: Response): Promise<void> {
    try {
        const attendance = await service.signAttendanceManually(String(req.params.token), req.body, clientMeta(req));
        res.json({ attendance });
    } catch (error) {
        sendError(res, error, 'Emargement handwritten signature failed');
    }
}

export async function signSheet(req: Request, res: Response): Promise<void> {
    try {
        res.json(await service.signSheet(String(req.params.token), req.body, clientMeta(req)));
    } catch (error) {
        sendError(res, error, 'Emargement signature failed');
    }
}

// ── Côté alternant (QR code) ─────────────────────────────────────────────────

export async function publicSigning(req: Request, res: Response): Promise<void> {
    try {
        res.json({ seance: await service.publicSigning(String(req.params.token)) });
    } catch (error) {
        sendError(res, error, 'Emargement public page failed');
    }
}

export async function signByQr(req: Request, res: Response): Promise<void> {
    try {
        res.json({ result: await service.signByQr(String(req.params.token), req.body, clientMeta(req)) });
    } catch (error) {
        sendError(res, error, 'Emargement QR signature failed');
    }
}
