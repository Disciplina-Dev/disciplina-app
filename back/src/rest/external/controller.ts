import { Request, Response } from 'express';
import { ExternalGuestRequest } from './guard';
import { ExternalLinkService } from '../../services/ExternalLinkService';

const externalLinkService = new ExternalLinkService();

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
        status: context.status,
    });
}
