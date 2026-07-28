import { Request, Response } from 'express';
import { InterviewGuestRequest } from './guard';
import { InterviewAccessService, SlotUnavailableError } from '../../services/InterviewAccessService';
import { UserService } from '../../services/UserService';
import { NotificationService } from '../../services/NotificationService';
import { logger } from '../../external/logger';
import { buildMatchingLink } from '../../utils/matchingLink';

const interviewAccessService = new InterviewAccessService();
const userService = new UserService();
const notificationService = new NotificationService();

export async function inspect(req: Request, res: Response): Promise<void> {
    const result = await interviewAccessService.inspect(req.params.signature);
    res.json(result);
}

export async function authenticate(req: Request, res: Response): Promise<void> {
    const { code } = req.body as { code?: string };
    if (!code) {
        res.status(400).json({ error: 'Code requis' });
        return;
    }
    const result = await interviewAccessService.authenticate(req.params.signature, code);
    if (result.ok) {
        res.json({ token: result.token });
        return;
    }
    res.status(401).json({ reason: result.reason, remaining: result.remaining });
}

export async function getSlots(req: InterviewGuestRequest, res: Response): Promise<void> {
    try {
        const slots = await interviewAccessService.getSlots(req.params.signature, req.guest!.candidateId);
        res.json(slots);
    } catch (err) {
        res.status(404).json({ error: (err as Error).message });
    }
}

export async function bookSlot(req: InterviewGuestRequest, res: Response): Promise<void> {
    const { slot } = req.body as { slot?: string };
    if (!slot) {
        res.status(400).json({ error: 'Créneau requis' });
        return;
    }
    try {
        await interviewAccessService.bookSlot(req.params.signature, req.guest!.candidateId, slot);
        await notifyBooked(req.params.signature);
        res.json({ ok: true });
    } catch (err) {
        if (err instanceof SlotUnavailableError) {
            res.status(409).json({ error: err.message });
            return;
        }
        res.status(400).json({ error: (err as Error).message });
    }
}

async function notifyBooked(signature: string): Promise<void> {
    try {
        const context = await interviewAccessService.getContext(signature);
        if (!context) return;
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
