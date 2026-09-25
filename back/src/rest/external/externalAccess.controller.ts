import { Request, Response } from 'express';
import { ExternalAccessService } from '../../services/ExternalAccessService';
import { ExternalAccessRepository } from '../../repositories/mysql/ExternalAccessRepository';
import { setGuestCookies } from '../middleware/cookies';
import { issueCsrfCookie } from '../middleware/csrf';
import type { AuthRequest } from '../middleware/auth';
import type { ExternalGuestRequest } from './guard';

const externalAccessService = new ExternalAccessService();

export async function listAccess(req: AuthRequest, res: Response): Promise<void> {
    const first = Number(req.query.first);
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const userId = req.query.userId != null && req.query.userId !== '' ? Number(req.query.userId) : null;

    const after = typeof req.query.after === 'string' && req.query.after ? req.query.after : null;

    const statuses = status
        ? status.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined;

    const result = await externalAccessService.list({
        first: Number.isFinite(first) && first > 0 ? first : undefined,
        after,
        search,
        types: type ? [type] : undefined,
        statuses,
        userId: userId != null && Number.isInteger(userId) && userId > 0 ? userId : null,
    });

    res.status(200).json(result);
}

export async function revokeAccess(req: AuthRequest, res: Response): Promise<void> {
    const { signature } = req.params as { signature: string };
    if (!signature) {
        res.status(400).json({ success: false, error: 'Signature requise' });
        return;
    }

    const result = await externalAccessService.revoke(signature);
    if (!result.success) {
        res.status(400).json(result);
        return;
    }

    res.status(200).json({ success: true });
}

export async function complete(req: ExternalGuestRequest, res: Response): Promise<void> {
    const { signature } = req.params as { signature: string };
    if (!signature) {
        res.status(400).json({ error: 'Signature requise' });
        return;
    }

    const result = await externalAccessService.complete(signature);
    if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
    }

    res.status(200).json({ success: true });
}

/**
 * Ouverture d'un lien magique (sans code) : arme l'expiration à J+7 au premier
 * clic puis émet le cookie invité. Idempotent tant que le lien n'a pas expiré.
 */
export async function openAccess(req: Request, res: Response): Promise<void> {
    const { signature } = req.params as { signature: string };
    if (!signature) {
        res.status(400).json({ error: 'Signature requise' });
        return;
    }

    const result = await externalAccessService.openLink(signature);
    if (result.status !== 'OK') {
        res.status(result.httpCode).json({ message: result.message });
        return;
    }

    setGuestCookies(res, result.token, issueCsrfCookie());
    res.status(200).json({
        success: true,
        user: {
            role: 'EXTERNAL_GUEST',
            permission: 'GUEST',
            referenceId: result.referenceId,
        },
        expiresAt: result.expiresAt.toISOString(),
    });
}

export async function getProfile(req: ExternalGuestRequest, res: Response): Promise<void> {
    const row = await new ExternalAccessRepository().findBySignature(req.params.signature as string);
    if (!row) {
        res.status(404).json({ error: 'Session introuvable' });
        return;
    }
    res.json({
        externalEmail: row.external_email,
        guestType: row.external_type,
        externalUuid: row.external_id,
        expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    });
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

    const { signature } = req.params as { signature: string };
    if (!signature) {
        res.status(400).json({ success: false, error: 'Signature requise' });
        return;
    }

    const result = await externalAccessService.regenerate(signature, userId);
    res.status(result.success ? 201 : 400).json(result);
}


