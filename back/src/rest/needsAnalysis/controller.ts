import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { JobRole, Permission } from '../../types/user.types';
import { NeedsAnalysisService } from '../../services/NeedsAnalysisService';
import { signatureAssets } from '../../external/docuseal/docuseal.service';
import { logger } from '../../external/logger';

/** Corps de mail édité dans l'aperçu, borné pour éviter les envois abusifs. */
const MAX_EMAIL_FIELD = 50_000;

const needsAnalysisService = new NeedsAnalysisService();

export async function downloadPdf(req: AuthRequest, res: Response): Promise<void> {
    const role = req.user?.role;
    const permission = req.user?.permission;
    const hasPermission = permission === Permission.RESPONSABLE || permission === Permission.ADMIN;
    const hasJobRole = role === JobRole.COMMERCIAL;
    if (!hasPermission && !hasJobRole) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    const id = req.params.id;
    if (!id) {
        res.status(400).json({ error: 'Invalid needs analysis ID' });
        return;
    }

    if (role === JobRole.COMMERCIAL) {
        const analysis = await needsAnalysisService.findById(id);
        if (analysis?.salerInfo?.id && analysis.salerInfo.id !== req.user?.id) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
    }

    try {
        const { buffer, filename } = await needsAnalysisService.generatePdf(id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    } catch (error: any) {
        logger.error({ err: error, id }, '[NeedsAnalysis] PDF download failed');
        if (error.message?.includes('not found')) {
            res.status(404).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
}

/** Sert un PDF statique (mandat / catalogue) en inline pour l'aperçu avant envoi. */
function serveSignatureAsset(req: AuthRequest, res: Response, kind: 'mandat' | 'catalogue'): void {
    const perm = req.user?.permission;
    const jobRole = req.user?.role;
    const hasPermission = perm === Permission.RESPONSABLE || perm === Permission.ADMIN;
    const hasJobRole = jobRole === JobRole.COMMERCIAL;
    if (!hasPermission && !hasJobRole) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    const buffer = signatureAssets[kind]();
    if (!buffer) {
        res.status(404).json({ error: `${kind} PDF introuvable` });
        return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${kind}.pdf"`);
    res.send(buffer);
}

export function getMandatPdf(req: AuthRequest, res: Response): void {
    serveSignatureAsset(req, res, 'mandat');
}

export function getCataloguePdf(req: AuthRequest, res: Response): void {
    serveSignatureAsset(req, res, 'catalogue');
}

/** Renvoie le sujet/corps de l'email de signature pour l'aperçu (lecture seule). */
export async function getSignatureEmail(req: AuthRequest, res: Response): Promise<void> {
    const perm = req.user?.permission;
    const jobRole = req.user?.role;
    const hasPermission = perm === Permission.RESPONSABLE || perm === Permission.ADMIN;
    const hasJobRole = jobRole === JobRole.COMMERCIAL;
    if (!hasPermission && !hasJobRole) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    const abId = typeof req.query.abId === 'string' ? req.query.abId : undefined;
    try {
        const preview = await needsAnalysisService.getSignatureEmailPreview(abId);
        res.status(200).json(preview);
    } catch (error) {
        logger.error({ err: error, abId }, '[NeedsAnalysis] Signature email preview failed');
        res.status(500).json({ error: 'Failed to load signature email preview' });
    }
}

export async function sendSignature(req: AuthRequest, res: Response): Promise<void> {
    const role = req.user?.role;
    const permission = req.user?.permission;
    const hasPermission = permission === Permission.RESPONSABLE || permission === Permission.ADMIN;
    const hasJobRole = role === JobRole.COMMERCIAL;
    if (!hasPermission && !hasJobRole) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    const id = req.params.id;
    if (!id) {
        res.status(400).json({ error: 'Invalid needs analysis ID' });
        return;
    }

    if (role === JobRole.COMMERCIAL) {
        const analysis = await needsAnalysisService.findById(id);
        if (analysis?.salerInfo?.id && analysis.salerInfo.id !== req.user?.id) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
    }

    // Contenu édité dans l'aperçu (optionnel) : on borne la taille.
    const rawSubject = req.body?.subject;
    const rawBody = req.body?.body;
    if (
        (rawSubject != null && (typeof rawSubject !== 'string' || rawSubject.length > MAX_EMAIL_FIELD)) ||
        (rawBody != null && (typeof rawBody !== 'string' || rawBody.length > MAX_EMAIL_FIELD))
    ) {
        res.status(400).json({ error: 'Sujet ou corps du mail invalide' });
        return;
    }
    const override =
        rawBody != null
            ? { subject: typeof rawSubject === 'string' ? rawSubject : undefined, body: rawBody }
            : undefined;

    try {
        const analysis = await needsAnalysisService.sendForSignature(id, req.user!.id, override);
        res.status(200).json(analysis);
    } catch (error: any) {
        logger.error({ err: error, id }, '[NeedsAnalysis] Send for signature failed');
        if (error.message?.includes('not found')) {
            res.status(404).json({ error: error.message });
            return;
        }
        if (error.message?.includes('Google account not connected')) {
            res.status(403).json({ error: 'Compte Google non connecté. Veuillez connecter votre compte Google.' });
            return;
        }
        if (error.message?.includes('recruitment responsible email')) {
            res.status(400).json({ error: 'Aucun email de responsable recrutement pour envoyer la signature' });
            return;
        }
        if (error.message?.includes('signing link')) {
            res.status(502).json({ error: 'Le prestataire de signature n’a pas renvoyé de lien. Réessayez.' });
            return;
        }
        res.status(500).json({ error: 'Failed to send for signature' });
    }
}
