import { Request, Response } from 'express';
import { ExternalAccessService } from '../../services/ExternalAccessService';
import { setGuestCookies } from '../middleware/cookies';
import { issueCsrfCookie } from '../middleware/csrf';
import type { AuthRequest } from '../middleware/auth';

const externalAccessService = new ExternalAccessService();

export async function sendCode(req: Request, res: Response): Promise<void> {
    const { signature } = req.params;
    if (!signature) {
        res.status(400).json({ error: 'Signature requise' });
        return;
    }

    const result = await externalAccessService.sendCode(signature);
    res.status(result.httpCode).json({ message: result.message });
}

const REQUIRED_FIELDS = [
    'externalId',
    'externalType',
    'externalEmail',
    'externalFirstName',
    'referenceId',
    'referenceKey',
] as const;

export async function generate(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ success: false, error: 'Non authentifié' });
        return;
    }

    const missing = REQUIRED_FIELDS.filter((f) => req.body[f] === undefined || req.body[f] === null || req.body[f] === '');
    if (missing.length > 0) {
        res.status(400).json({ success: false, error: `Champs manquants: ${missing.join(', ')}` });
        return;
    }

    const { externalId, externalType, externalEmail, externalFirstName, referenceId, referenceKey } = req.body;

    if (externalType !== 'COMPANY' && externalType !== 'CANDIDATE') {
        res.status(400).json({ success: false, error: 'externalType doit être COMPANY ou CANDIDATE' });
        return;
    }

    const result = await externalAccessService.generate({
        userId,
        externalId,
        externalType,
        externalEmail,
        externalFirstName,
        referenceId,
        referenceKey,
    });

    res.status(result.success ? 201 : 400).json(result);
}

export async function regenerate(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ success: false, error: 'Non authentifié' });
        return;
    }

    const { signature } = req.params;
    if (!signature) {
        res.status(400).json({ success: false, error: 'Signature requise' });
        return;
    }

    const result = await externalAccessService.regenerate(signature, userId);
    res.status(result.success ? 201 : 400).json(result);
}

export async function inspectCode(req: Request, res: Response): Promise<void> {
    const { signature, code } = req.body;

    if (!signature || !code) {
        res.status(400).json({ success: false, error: 'signature et code requis' });
        return;
    }

    const result = await externalAccessService.inspect(signature, code);

    if (!result.success) {
        res.status(400).json(result);
        return;
    }

    if (result.token) {
        setGuestCookies(res, result.token, issueCsrfCookie());
    }

    res.status(200).json({
        success: true,
        user: {
            role: 'EXTERNAL_GUEST',
            permission: 'GUEST',
            referenceId: result.referenceId,
        },
    });
}
