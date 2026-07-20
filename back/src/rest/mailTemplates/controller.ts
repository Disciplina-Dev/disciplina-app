import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../../external/logger';
import {
    MailTemplateService,
    GoogleNotConnectedError,
    TemplateNotFoundError,
    DuplicatePedaLevelError,
    SystemTemplateError,
} from '../../services/MailTemplateService';
import { MailTemplateScope, PedaLevel, isPedaLevel } from '../../types/mailTemplate.types';

const service = new MailTemplateService();

function parseScope(raw: unknown): MailTemplateScope {
    if (raw === 'commercial') return 'commercial';
    if (raw === 'peda') return 'peda';
    return 'rh';
}

/** `pedaLevel` absent/vide ⇒ null (modèle Peda non rattaché à un niveau). */
function parsePedaLevel(raw: unknown): PedaLevel | null | undefined {
    if (raw === undefined || raw === null || raw === '') return null;
    return isPedaLevel(raw) ? raw : undefined; // undefined = valeur invalide
}

function handleError(err: unknown, res: Response): void {
    if (err instanceof TemplateNotFoundError) {
        res.status(404).json({ error: 'Modèle introuvable' });
        return;
    }
    if (err instanceof DuplicatePedaLevelError) {
        res.status(409).json({ error: 'Un autre modèle porte déjà ce niveau de relance' });
        return;
    }
    if (err instanceof SystemTemplateError) {
        res.status(403).json({ error: 'Ce modèle système ne peut pas être supprimé' });
        return;
    }
    if (err instanceof GoogleNotConnectedError) {
        res.status(400).json({ error: 'Google Drive non connecté' });
        return;
    }
    logger.error(err, 'mail-templates error');
    res.status(500).json({ error: 'Erreur interne' });
}

// ── Modèles ──────────────────────────────────────────────────────────────
export async function listTemplates(req: AuthRequest, res: Response): Promise<void> {
    try {
        const templates = await service.list(Number(req.user.id), parseScope(req.query.scope));
        res.json({ templates });
    } catch (err) {
        handleError(err, res);
    }
}

export async function createTemplate(req: AuthRequest, res: Response): Promise<void> {
    const { name, subject, body, pedaLevel } = (req.body ?? {}) as Record<string, unknown>;
    if (!String(name ?? '').trim() || !String(subject ?? '').trim() || !String(body ?? '').trim()) {
        res.status(400).json({ error: 'name, subject et body sont requis' });
        return;
    }
    const level = parsePedaLevel(pedaLevel);
    if (level === undefined) {
        res.status(400).json({ error: 'pedaLevel invalide' });
        return;
    }
    try {
        const template = await service.create(Number(req.user.id), parseScope(req.query.scope), {
            name: String(name),
            subject: String(subject),
            body: String(body),
            pedaLevel: level,
        });
        res.status(201).json({ template });
    } catch (err) {
        handleError(err, res);
    }
}

export async function updateTemplate(req: AuthRequest, res: Response): Promise<void> {
    const { name, subject, body, pedaLevel } = (req.body ?? {}) as Record<string, unknown>;
    if (!String(name ?? '').trim() || !String(subject ?? '').trim() || !String(body ?? '').trim()) {
        res.status(400).json({ error: 'name, subject et body sont requis' });
        return;
    }
    const level = parsePedaLevel(pedaLevel);
    if (level === undefined) {
        res.status(400).json({ error: 'pedaLevel invalide' });
        return;
    }
    try {
        const template = await service.update(Number(req.user.id), req.params.id, {
            name: String(name),
            subject: String(subject),
            body: String(body),
            pedaLevel: level,
        });
        res.json({ template });
    } catch (err) {
        handleError(err, res);
    }
}

export async function deleteTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
        await service.remove(Number(req.user.id), req.params.id);
        res.status(204).end();
    } catch (err) {
        handleError(err, res);
    }
}

// ── Pièce jointe ───────────────────────────────────────────────────────────
export async function uploadAttachment(req: AuthRequest, res: Response): Promise<void> {
    const file = (req as AuthRequest & { file?: Express.Multer.File }).file;
    if (!file) {
        res.status(400).json({ error: 'Aucun fichier fourni' });
        return;
    }
    try {
        const template = await service.setAttachment(
            Number(req.user.id),
            req.params.id,
            file.originalname,
            file.mimetype || 'application/octet-stream',
            file.buffer,
        );
        res.json({ template });
    } catch (err) {
        handleError(err, res);
    }
}

export async function deleteAttachment(req: AuthRequest, res: Response): Promise<void> {
    try {
        const template = await service.removeAttachment(Number(req.user.id), req.params.id);
        res.json({ template });
    } catch (err) {
        handleError(err, res);
    }
}

/** Renvoie le fichier original (décompressé, base64) pour l'attacher à un envoi. */
export async function resolveAttachment(req: AuthRequest, res: Response): Promise<void> {
    try {
        const attachment = await service.resolveAttachment(Number(req.user.id), req.params.id);
        res.json({ attachment });
    } catch (err) {
        handleError(err, res);
    }
}

// ── Signature ────────────────────────────────────────────────────────────
export async function getSignature(req: AuthRequest, res: Response): Promise<void> {
    try {
        const signature = await service.getSignature(Number(req.user.id), parseScope(req.query.scope));
        res.json({ signature });
    } catch (err) {
        handleError(err, res);
    }
}

export async function putSignature(req: AuthRequest, res: Response): Promise<void> {
    const file = (req as AuthRequest & { file?: Express.Multer.File }).file;
    if (!file) {
        res.status(400).json({ error: 'Aucune image fournie' });
        return;
    }
    try {
        await service.setSignature(
            Number(req.user.id),
            parseScope(req.query.scope),
            file.mimetype || 'image/png',
            file.buffer,
        );
        const signature = await service.getSignature(Number(req.user.id), parseScope(req.query.scope));
        res.json({ signature });
    } catch (err) {
        handleError(err, res);
    }
}

export async function deleteSignature(req: AuthRequest, res: Response): Promise<void> {
    try {
        await service.removeSignature(Number(req.user.id), parseScope(req.query.scope));
        res.status(204).end();
    } catch (err) {
        handleError(err, res);
    }
}
