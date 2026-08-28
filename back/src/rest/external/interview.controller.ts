import { Request, Response } from 'express';
import { ExternalGuestRequest } from './guard';
import {
    ExternalInterviewService,
    SlotUnavailableError,
    SessionAlreadyCompletedError,
} from '../../services/ExternalInterviewService';
import { UserService } from '../../services/UserService';
import { NotificationService } from '../../services/NotificationService';
import { logger } from '../../external/logger';
import { buildMatchingLink } from '../../utils/matchingLink';

const externalInterviewService = new ExternalInterviewService();
const userService = new UserService();
const notificationService = new NotificationService();

/** Vérifie que la session external concernée est bien une session d'entretien (reference 3). */
export function requireInterviewReference(req: ExternalGuestRequest, res: Response, next: () => void): void {
    if (req.guest?.referenceId !== 3) {
        res.status(403).json({ error: 'Session hors périmètre' });
        return;
    }
    next();
}

export async function getSlots(req: Request, res: Response): Promise<void> {
    try {
        const slots = await externalInterviewService.getSlots(req.params.signature);
        res.json(slots);
    } catch (err) {
        res.status(404).json({ error: (err as Error).message });
    }
}

export async function bookSlot(req: Request, res: Response): Promise<void> {
    const { slot } = req.body as { slot?: string };
    if (!slot) {
        res.status(400).json({ error: 'Créneau requis' });
        return;
    }
    try {
        await externalInterviewService.bookSlot(req.params.signature, slot);
        await notifyBooked(req.params.signature);
        res.json({ ok: true });
    } catch (err) {
        if (err instanceof SlotUnavailableError) {
            res.status(409).json({ error: err.message });
            return;
        }
        if (err instanceof SessionAlreadyCompletedError) {
            res.status(409).json({ error: err.message });
            return;
        }
        res.status(400).json({ error: (err as Error).message });
    }
}

async function notifyBooked(signature: string): Promise<void> {
    try {
        const context = await externalInterviewService.getContext(signature);
        if (!context) return;
        if (!context.rhEmail) return;
        const rh = await userService.findByEmail(context.rhEmail);
        if (!rh) return;
        await notificationService.create({
            userId: rh.id,
            type: 'interview_booked',
            category: 'candidate',
            level: 'success',
            title: "Créneau d'entretien réservé",
            message: "Un candidat a réservé son créneau d'entretien.",
            link: buildMatchingLink(context.offerUuid, context.needsAnalysisId),
        });
    } catch (err) {
        logger.error({ err }, '[interview] failed to notify RH of slot booking');
    }
}