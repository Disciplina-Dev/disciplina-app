import { Request, Response } from 'express';
import { env } from '../../config/env';
import { OpenedAttempt, QuestionnaireAttemptService } from '../../services/QuestionnaireAttemptService';
import { sendError } from './controller';

const service = new QuestionnaireAttemptService();

// Cookie d'appareil : lie le lien au premier appareil qui l'ouvre (haché en base).
// Distinct des cookies du CRM ; `strict` + httpOnly : jamais lisible ni envoyé cross-site.
export const DEVICE_COOKIE = 'q_device';
const DEVICE_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function openFromRequest(req: Request): Promise<OpenedAttempt> {
    return service.open(String(req.params.token), req.cookies?.[DEVICE_COOKIE]);
}

function noStore(res: Response): void {
    res.setHeader('Cache-Control', 'no-store');
}

export async function getState(req: Request, res: Response): Promise<void> {
    noStore(res);
    try {
        const opened = await openFromRequest(req);
        res.json(await service.publicView(opened.attempt, opened.questionnaire));
    } catch (error) {
        sendError(res, error, 'Questionnaire public state failed');
    }
}

export async function start(req: Request, res: Response): Promise<void> {
    noStore(res);
    try {
        const opened = await openFromRequest(req);
        const { attempt, deviceToken } = await service.start(opened, req.body?.confirm_identity === true);
        res.cookie(DEVICE_COOKIE, deviceToken, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/api/q',
            maxAge: DEVICE_COOKIE_MAX_AGE_MS,
        });
        res.json(await service.publicView(attempt, opened.questionnaire));
    } catch (error) {
        sendError(res, error, 'Questionnaire start failed');
    }
}

export async function answer(req: Request, res: Response): Promise<void> {
    noStore(res);
    try {
        const opened = await openFromRequest(req);
        const { attempt, feedback } = await service.answer(opened, req.body ?? {});
        res.json({ feedback, state: await service.publicView(attempt, opened.questionnaire) });
    } catch (error) {
        sendError(res, error, 'Questionnaire answer failed');
    }
}

export async function visibility(req: Request, res: Response): Promise<void> {
    noStore(res);
    try {
        const opened = await openFromRequest(req);
        await service.reportTabSwitch(opened);
        res.status(204).end();
    } catch (error) {
        sendError(res, error, 'Questionnaire visibility report failed');
    }
}
