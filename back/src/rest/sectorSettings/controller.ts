import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { SectorSettingsService } from '../../services/SectorSettingsService';
import { logger } from '../../external/logger';

const service = new SectorSettingsService();

/** GET /api/sector-settings — lieux de RDV par secteur. */
export async function getSectorSettings(_req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json({ settings: await service.list() });
    } catch (err) {
        logger.error({ err }, 'sector_settings list failed');
        res.status(502).json({ error: 'Échec du chargement des lieux par secteur' });
    }
}

/** PUT /api/sector-settings — met à jour les lieux (ADMIN uniquement). */
export async function updateSectorSettings(req: AuthRequest, res: Response): Promise<void> {
    const body = req.body as { settings?: { sector: string; location: string }[] };
    if (!Array.isArray(body?.settings)) {
        res.status(400).json({ error: 'settings invalide' });
        return;
    }
    try {
        res.json({ settings: await service.update(body.settings) });
    } catch (err) {
        logger.error({ err }, 'sector_settings update failed');
        res.status(502).json({ error: 'Échec de la mise à jour des lieux' });
    }
}
