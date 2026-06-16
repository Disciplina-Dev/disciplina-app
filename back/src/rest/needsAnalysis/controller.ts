import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Role } from '../../types/user.types';
import { NeedsAnalysisService } from '../../services/NeedsAnalysisService';
import { logger } from '../../external/logger/logger';

const needsAnalysisService = new NeedsAnalysisService();

export async function downloadPdf(req: AuthRequest, res: Response): Promise<void> {
    const role = req.user?.role;
    if (role !== Role.COMMERCIAL && role !== Role.RESPONSABLE && role !== Role.ADMIN) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid needs analysis ID' });
        return;
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

export async function sendSignature(req: AuthRequest, res: Response): Promise<void> {
    const role = req.user?.role;
    if (role !== Role.COMMERCIAL && role !== Role.RESPONSABLE && role !== Role.ADMIN) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid needs analysis ID' });
        return;
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
