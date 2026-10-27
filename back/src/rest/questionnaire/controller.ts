import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../../external/logger';
import { QuestionnaireService } from '../../services/QuestionnaireService';

const service = new QuestionnaireService();

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

export async function list(_req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json({ questionnaires: await service.list() });
    } catch (error) {
        sendError(res, error, 'Questionnaire list failed');
    }
}

export async function listActive(_req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json({ questionnaires: await service.listActive() });
    } catch (error) {
        sendError(res, error, 'Active questionnaire list failed');
    }
}

export async function get(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json({ questionnaire: await service.get(String(req.params.id)) });
    } catch (error) {
        sendError(res, error, 'Questionnaire fetch failed');
    }
}

export async function create(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.status(201).json({ questionnaire: await service.create(req.body, req.user?.id) });
    } catch (error) {
        sendError(res, error, 'Questionnaire create failed');
    }
}

export async function update(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json({ questionnaire: await service.update(String(req.params.id), req.body) });
    } catch (error) {
        sendError(res, error, 'Questionnaire update failed');
    }
}

export async function duplicate(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.status(201).json({ questionnaire: await service.duplicate(String(req.params.id), req.user?.id) });
    } catch (error) {
        sendError(res, error, 'Questionnaire duplicate failed');
    }
}

export async function setStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json({ questionnaire: await service.setStatus(String(req.params.id), req.body?.status) });
    } catch (error) {
        sendError(res, error, 'Questionnaire status change failed');
    }
}

export async function remove(req: AuthRequest, res: Response): Promise<void> {
    try {
        await service.remove(String(req.params.id));
        res.json({ deleted: true });
    } catch (error) {
        sendError(res, error, 'Questionnaire delete failed');
    }
}

export async function exportJson(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json(await service.exportJson(String(req.params.id)));
    } catch (error) {
        sendError(res, error, 'Questionnaire export failed');
    }
}

export async function invite(req: AuthRequest, res: Response): Promise<void> {
    try {
        const invitation = await service.invite(
            String(req.params.id),
            req.body?.candidate_id,
            req.body?.validity_minutes,
            req.user?.id,
        );
        res.status(201).json(invitation);
    } catch (error) {
        sendError(res, error, 'Questionnaire invite failed');
    }
}

export async function testRun(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.status(201).json(await service.testRun(String(req.params.id), req.user?.id));
    } catch (error) {
        sendError(res, error, 'Questionnaire test run failed');
    }
}

export async function listAttempts(req: AuthRequest, res: Response): Promise<void> {
    try {
        const query = req.query as Record<string, unknown>;
        const page = Number(query.page) || 1;
        const pageSize = Number(query.pageSize) || 25;
        res.json(await service.listAttempts(service.parseFilters(query), page, pageSize));
    } catch (error) {
        sendError(res, error, 'Questionnaire attempts list failed');
    }
}

export async function candidateAttempts(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json({ attempts: await service.candidateAttempts(String(req.params.candidateId)) });
    } catch (error) {
        sendError(res, error, 'Candidate questionnaire attempts failed');
    }
}

export async function getAttempt(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json({ attempt: await service.getAttemptDetail(String(req.params.attemptId)) });
    } catch (error) {
        sendError(res, error, 'Questionnaire attempt fetch failed');
    }
}

export async function cancelAttempt(req: AuthRequest, res: Response): Promise<void> {
    try {
        await service.cancelAttempt(String(req.params.attemptId));
        res.json({ cancelled: true });
    } catch (error) {
        sendError(res, error, 'Questionnaire attempt cancel failed');
    }
}

export async function resendPdf(req: AuthRequest, res: Response): Promise<void> {
    try {
        await service.resendPdf(String(req.params.attemptId));
        res.json({ sent: true });
    } catch (error) {
        sendError(res, error, 'Questionnaire PDF resend failed');
    }
}

export async function downloadPdf(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { buffer, fileName } = await service.downloadPdf(String(req.params.attemptId));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        res.setHeader('Cache-Control', 'no-store');
        res.send(buffer);
    } catch (error) {
        sendError(res, error, 'Questionnaire PDF download failed');
    }
}
