import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../../external/logger';
import { PedaService, InvalidSheetLinkError, InvalidHourError } from '../../services/PedaService';
import { PedaDraftService } from '../../services/PedaDraftService';
import { AlternantService } from '../../services/AlternantService';
import { PdfService } from '../../services/PdfService';

const pedaService = new PedaService();
const draftService = new PedaDraftService();
const alternantService = new AlternantService();

function handleError(err: unknown, res: Response): void {
    if (err instanceof InvalidSheetLinkError || err instanceof InvalidHourError) {
        res.status(400).json({ error: err.message });
        return;
    }
    logger.error(err, 'peda error');
    res.status(500).json({ error: 'Erreur interne' });
}

// ── Config : Google Sheet du Peda connecté ────────────────────────────────
export async function getConfig(req: AuthRequest, res: Response): Promise<void> {
    try {
        const config = await pedaService.getConfig(Number(req.user.id));
        res.json(config);
    } catch (err) {
        handleError(err, res);
    }
}

export async function putSheet(req: AuthRequest, res: Response): Promise<void> {
    const link = String((req.body ?? {}).link ?? '').trim();
    if (!link) {
        res.status(400).json({ error: 'link est requis' });
        return;
    }
    try {
        const config = await pedaService.setSheet(Number(req.user.id), link);
        res.json(config);
    } catch (err) {
        handleError(err, res);
    }
}

export async function deleteSheet(req: AuthRequest, res: Response): Promise<void> {
    try {
        await pedaService.removeSheet(Number(req.user.id));
        res.status(204).end();
    } catch (err) {
        handleError(err, res);
    }
}

// ── Config globale : heure du job quotidien ───────────────────────────────
export async function getDraftHour(_req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json({ hour: await pedaService.getDraftHour() });
    } catch (err) {
        handleError(err, res);
    }
}

export async function putDraftHour(req: AuthRequest, res: Response): Promise<void> {
    const hour = String((req.body ?? {}).hour ?? '').trim();
    try {
        await pedaService.setDraftHour(hour);
        res.json({ hour });
    } catch (err) {
        handleError(err, res);
    }
}

// ── Exécution manuelle (test / rattrapage) ────────────────────────────────
/**
 * Un Peda ne déclenche que la génération de ses propres brouillons : le job
 * écrit dans la boîte Gmail du Peda concerné, il ne doit pas écrire dans celle
 * des autres. Seul un ADMIN peut lancer le job global.
 */
export async function runNow(req: AuthRequest, res: Response): Promise<void> {
    try {
        const report =
            req.user.role === 'GESTION' || req.user.role === 'AD'
                ? await draftService.runForAllPedas()
                : await draftService.runForUser(Number(req.user.id));
        res.json({ report });
    } catch (err) {
        handleError(err, res);
    }
}

// ── Document de SA (#888) : export PDF ─────────────────────────────────────
export async function downloadSequencePdf(req: AuthRequest, res: Response): Promise<void> {
    try {
        const resolved = await alternantService.resolveSequenceDocument(req.params.id as string);
        const buffer = await PdfService.generateAlternantSequencePdf(resolved);
        const filename = `SA_${resolved.header.alternantFullName.replace(/\s+/g, '_')}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    } catch (err) {
        handleError(err, res);
    }
}
