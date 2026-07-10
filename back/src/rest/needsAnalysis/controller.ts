import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Role } from '../../types/user.types';
import { NeedsAnalysisService } from '../../services/NeedsAnalysisService';
import {
    signatureAssets,
    SIGNATURE_EMAIL_SUBJECT,
    SIGNATURE_EMAIL_BODY,
} from '../../external/docuseal/docuseal.service';
import { logger } from '../../external/logger/logger';

const needsAnalysisService = new NeedsAnalysisService();

const SIGNATURE_ROLES = [Role.COMMERCIAL, Role.RESPONSABLE, Role.ADMIN];

export async function downloadPdf(req: AuthRequest, res: Response): Promise<void> {
    const role = req.user?.role;
    if (role !== Role.COMMERCIAL && role !== Role.RESPONSABLE && role !== Role.ADMIN) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    const id = req.params.id;
    if (!id) {
        res.status(400).json({ error: 'Invalid needs analysis ID' });
        return;
    }

    if (role === Role.COMMERCIAL) {
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
    if (!SIGNATURE_ROLES.includes(req.user?.role as Role)) {
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
export function getSignatureEmail(req: AuthRequest, res: Response): void {
    if (!SIGNATURE_ROLES.includes(req.user?.role as Role)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    res.status(200).json({ subject: SIGNATURE_EMAIL_SUBJECT, body: SIGNATURE_EMAIL_BODY });
}

export async function sendSignature(req: AuthRequest, res: Response): Promise<void> {
    const role = req.user?.role;
    if (role !== Role.COMMERCIAL && role !== Role.RESPONSABLE && role !== Role.ADMIN) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    const id = req.params.id;
    if (!id) {
        res.status(400).json({ error: 'Invalid needs analysis ID' });
        return;
    }

    if (role === Role.COMMERCIAL) {
        const analysis = await needsAnalysisService.findById(id);
        if (analysis?.salerInfo?.id && analysis.salerInfo.id !== req.user?.id) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
    }

    try {
        const analysis = await needsAnalysisService.sendForSignature(id);
        res.status(200).json(analysis);
    } catch (error: any) {
        logger.error({ err: error, id }, '[NeedsAnalysis] Send for signature failed');
        if (error.message?.includes('not found')) {
            res.status(404).json({ error: error.message });
            return;
        }
        if (error.message?.includes('recruitment responsible email')) {
            res.status(400).json({ error: 'Aucun email de responsable recrutement pour envoyer la signature' });
            return;
        }
        res.status(500).json({ error: 'Failed to send for signature' });
    }
}
