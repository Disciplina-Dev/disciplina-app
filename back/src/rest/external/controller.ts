import { Request, Response } from 'express';
import { ExternalGuestRequest } from './guard';
import { ExternalLinkService } from '../../services/ExternalLinkService';
import { ExternalMailService } from '../../services/ExternalMailService';
import { NotificationService } from '../../services/NotificationService';
import { UserService } from '../../services/UserService';

const externalLinkService = new ExternalLinkService();
const externalMailService = new ExternalMailService();
const notificationService = new NotificationService();
const userService = new UserService();

async function notifyLock(signature: string): Promise<void> {
    const context = await externalLinkService.getContext(signature);
    if (!context) return;
    await externalMailService.sendLockAlert(context.rhEmail, context.externalEmail);
    const rh = await userService.findByEmail(context.rhEmail);
    if (rh) {
        await notificationService.create({
            userId: rh.id,
            type: 'external_locked',
            category: 'company',
            level: 'warning',
            title: 'Session externe bloquée',
            message: `${context.externalEmail} a échoué 3 fois. Créez une nouvelle session.`,
        });
    }
}

export async function inspect(req: Request, res: Response): Promise<void> {
    const result = await externalLinkService.inspect(req.params.signature);
    res.json(result);
}

export async function authenticate(req: Request, res: Response): Promise<void> {
    const { code } = req.body as { code?: string };
    if (!code) {
        res.status(400).json({ error: 'Code requis' });
        return;
    }
    const result = await externalLinkService.authenticate(req.params.signature, code);
    if (result.ok) {
        res.json({ token: result.token });
        return;
    }
    if (result.reason === 'locked') await notifyLock(req.params.signature);
    res.status(401).json({ reason: result.reason, remaining: result.remaining });
}

export async function getProfile(req: ExternalGuestRequest, res: Response): Promise<void> {
    const context = await externalLinkService.getContext(req.params.signature);
    if (!context) {
        res.status(404).json({ error: 'Session introuvable' });
        return;
    }
    res.json({
        externalEmail: context.externalEmail,
        guestType: context.guestType,
        externalUuid: context.externalUuid,
    });
}
