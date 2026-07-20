import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { RhKpiService } from '../../services/RhKpiService';
import { Permission } from '../../types/user.types';
import { logger } from '../../external/logger';

const rhKpiService = new RhKpiService();

/** ADMIN/RESPONSABLE voient la somme de tous les RH ; un RH ne voit que ses propres chiffres. */
function scopeFor(req: AuthRequest): number[] | undefined {
    const permission = req.user?.permission as Permission | undefined;
    if (permission === Permission.ADMIN || permission === Permission.RESPONSABLE) return undefined; // tous
    return [Number(req.user.id)];
}

/** GET /api/rh-kpi/years */
export async function getYears(_req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json({ years: await rhKpiService.getAvailableYears() });
    } catch (err) {
        logger.error({ err }, 'rh_kpi years failed');
        res.status(502).json({ error: 'Échec du chargement des années' });
    }
}

/** GET /api/rh-kpi/report?year=YYYY */
export async function getReport(req: AuthRequest, res: Response): Promise<void> {
    const year = Number(req.query.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        res.status(400).json({ error: 'year invalide' });
        return;
    }
    try {
        res.json(await rhKpiService.getReport(year, scopeFor(req)));
    } catch (err) {
        logger.error({ err }, 'rh_kpi report failed');
        res.status(502).json({ error: 'Échec du chargement des KPI' });
    }
}
