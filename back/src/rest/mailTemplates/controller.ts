import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../../external/logger/logger';
import { MailTemplateService, GoogleNotConnectedError, TemplateNotFoundError } from '../../services/MailTemplateService';
import { MailTemplateScope } from '../../types/mailTemplate.types';

const service = new MailTemplateService();

function parseScope(raw: unknown): MailTemplateScope {
    return raw === 'commercial' ? 'commercial' : 'rh';
}

function handleError(err: unknown, res: Response): void {
    if (err instanceof TemplateNotFoundError) { res.status(404).json({ error: 'Modèle introuvable' }); return; }
    if (err instanceof GoogleNotConnectedError) { res.status(400).json({ error: 'Google Drive non connecté' }); return; }
    logger.error(err, 'mail-templates error');
    res.status(500).json({ error: 'Erreur interne' });
}

// ── Modèles ──────────────────────────────────────────────────────────────
export async function listTemplates(req: AuthRequest, res: Response): Promise<void> {
    try {
        const templates = await service.list(Number(req.user.id), parseScope(req.query.scope));
        res.json({ templates });
    } catch (err) { handleError(err, res); }
}

export async function createTemplate(req: AuthRequest, res: Response): Promise<void> {
    const { name, subject, body } = (req.body ?? {}) as Record<string, unknown>;
    if (!String(name ?? '').trim() || !String(subject ?? '').trim() || !String(body ?? '').trim()) {
        res.status(400).json({ error: 'name, subject et body sont requis' });
        return;
    }
    try {
        const template = await service.create(Number(req.user.id), parseScope(req.query.scope), {
            name: String(name), subject: String(subject), body: String(body),
        });
        res.status(201).json({ template });
    } catch (err) { handleError(err, res); }
}

export async function updateTemplate(req: AuthRequest, res: Response): Promise<void> {
    const { name, subject, body } = (req.body ?? {}) as Record<string, unknown>;
    if (!String(name ?? '').trim() || !String(subject ?? '').trim() || !String(body ?? '').trim()) {
        res.status(400).json({ error: 'name, subject et body sont requis' });
        return;
    }
    try {
        const template = await service.update(Number(req.user.id), req.params.id, {
            name: String(name), subject: String(subject), body: String(body),
        });
        res.json({ template });
    } catch (err) { handleError(err, res); }
}

export async function deleteTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
        await service.remove(Number(req.user.id), req.params.id);
        res.status(204).end();
    } catch (err) { handleError(err, res); }
}

// ── Pièce jointe ───────────────────────────────────────────────────────────
export async function uploadAttachment(req: AuthRequest, res: Response): Promise<void> {
    const file = (req as AuthRequest & { file?: Express.Multer.File }).file;
    if (!file) { res.status(400).json({ error: 'Aucun fichier fourni' }); return; }
    try {
        const template = await service.setAttachment(
            Number(req.user.id), req.params.id, file.originalname,
            file.mimetype || 'application/octet-stream', file.buffer,
        );
        res.json({ template });
    } catch (err) { handleError(err, res); }
}

export async function deleteAttachment(req: AuthRequest, res: Response): Promise<void> {
    try {
        const template = await service.removeAttachment(Number(req.user.id), req.params.id);
        res.json({ template });
    } catch (err) { handleError(err, res); }
}

/** Renvoie le fichier original (décompressé, base64) pour l'attacher à un envoi. */
export async function resolveAttachment(req: AuthRequest, res: Response): Promise<void> {
    try {
        const attachment = await service.resolveAttachment(Number(req.user.id), req.params.id);
        res.json({ attachment });
    } catch (err) { handleError(err, res); }
}

// ── Signature ────────────────────────────────────────────────────────────
export async function getSignature(req: AuthRequest, res: Response): Promise<void> {
    try {
        const signature = await service.getSignature(Number(req.user.id), parseScope(req.query.scope));
        res.json({ signature });
    } catch (err) { handleError(err, res); }
}

export async function putSignature(req: AuthRequest, res: Response): Promise<void> {
    const file = (req as AuthRequest & { file?: Express.Multer.File }).file;
    if (!file) { res.status(400).json({ error: 'Aucune image fournie' }); return; }
    try {
        await service.setSignature(Number(req.user.id), parseScope(req.query.scope), file.mimetype || 'image/png', file.buffer);
        const signature = await service.getSignature(Number(req.user.id), parseScope(req.query.scope));
        res.json({ signature });
    } catch (err) { handleError(err, res); }
}

export async function deleteSignature(req: AuthRequest, res: Response): Promise<void> {
    try {
        await service.removeSignature(Number(req.user.id), parseScope(req.query.scope));
        res.status(204).end();
    } catch (err) { handleError(err, res); }
}
