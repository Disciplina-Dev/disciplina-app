import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { KpiService } from '../../services/KpiService';
import { KPI_SITES, KpiSite } from '../../types/kpi.types';
import { logger } from '../../external/logger';

const kpiService = new KpiService();

function parseYear(value: unknown): number | null {
    const year = Number(value);
    return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
}

function parseSite(value: unknown): KpiSite | null {
    const site = String(value ?? 'NORD').toUpperCase();
    return KPI_SITES.includes(site as KpiSite) ? (site as KpiSite) : null;
}

/** ADMIN/RESPONSABLE voient tout ; un COMMERCIAL ne voit que ses propres chiffres. */
function scopeFor(req: AuthRequest): number | undefined {
    const role = req.user?.role as string | undefined;
    if (role === 'ADMIN' || role === 'RESPONSABLE') return undefined;
    return Number(req.user?.id);
}

export async function getSelectableUsers(_req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json({ users: await kpiService.getSelectableUsers() });
    } catch (err) {
        logger.error({ err }, 'KPI getSelectableUsers failed');
        res.status(500).json({ error: 'Failed to fetch selectable users' });
    }
}

export async function getYears(_req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json({ years: await kpiService.getAvailableYears() });
    } catch (err) {
        logger.error({ err }, 'KPI getYears failed');
        res.status(500).json({ error: 'Failed to fetch available years' });
    }
}

export async function getActivity(req: AuthRequest, res: Response): Promise<void> {
    const year = parseYear(req.query.year);
    const site = parseSite(req.query.site);
    if (!year || !site) {
        res.status(400).json({ error: `Expected query params year (2000-2100) and site (${KPI_SITES.join('|')})` });
        return;
    }
    try {
        res.json(await kpiService.getActivity(year, site, scopeFor(req)));
    } catch (err) {
        logger.error({ err }, 'KPI getActivity failed');
        res.status(500).json({ error: 'Failed to fetch portfolio activity' });
    }
}

export async function getCombined(req: AuthRequest, res: Response): Promise<void> {
    const year = parseYear(req.query.year);
    const site = parseSite(req.query.site);
    if (!year || !site) {
        res.status(400).json({ error: `Expected query params year (2000-2100) and site (${KPI_SITES.join('|')})` });
        return;
    }
    try {
        res.json(await kpiService.getCombined(year, site, scopeFor(req)));
    } catch (err) {
        logger.error({ err }, 'KPI getCombined failed');
        res.status(500).json({ error: 'Failed to fetch combined KPI' });
    }
}

export async function getLiveSnapshot(req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json(await kpiService.getLiveSnapshot(scopeFor(req)));
    } catch (err) {
        logger.error({ err }, 'KPI getLiveSnapshot failed');
        res.status(500).json({ error: 'Failed to fetch live KPI snapshot' });
    }
}

export async function getOverview(req: AuthRequest, res: Response): Promise<void> {
    const year = parseYear(req.query.year);
    if (!year) {
        res.status(400).json({ error: 'Expected query param year (2000-2100)' });
        return;
    }
    try {
        res.json(await kpiService.getOverview(year));
    } catch (err) {
        logger.error({ err }, 'KPI getOverview failed');
        res.status(500).json({ error: 'Failed to fetch KPI overview' });
    }
}

export async function getUserDetail(req: AuthRequest, res: Response): Promise<void> {
    const year = parseYear(req.query.year);
    const userId = Number(req.params.id);
    if (!year || !Number.isInteger(userId) || userId <= 0) {
        res.status(400).json({ error: 'Expected a positive user id and query param year (2000-2100)' });
        return;
    }
    // Un commercial ne peut consulter que son propre profil KPI.
    const scope = scopeFor(req);
    if (scope !== undefined && scope !== userId) {
        res.status(403).json({ error: 'Forbidden: you can only view your own KPI' });
        return;
    }
    try {
        const detail = await kpiService.getUserDetail(year, userId);
        if (!detail) {
            res.status(404).json({ error: 'Unknown user' });
            return;
        }
        res.json(detail);
    } catch (err) {
        logger.error({ err }, 'KPI getUserDetail failed');
        res.status(500).json({ error: 'Failed to fetch user KPI detail' });
    }
}

export async function getAnnualSummary(req: AuthRequest, res: Response): Promise<void> {
    const year = parseYear(req.query.year);
    const site = parseSite(req.query.site);
    if (!year || !site) {
        res.status(400).json({ error: `Expected query params year (2000-2100) and site (${KPI_SITES.join('|')})` });
        return;
    }
    try {
        res.json(await kpiService.getAnnualSummary(year, site));
    } catch (err) {
        logger.error({ err }, 'KPI getAnnualSummary failed');
        res.status(500).json({ error: 'Failed to fetch annual summary' });
    }
}

export async function getMonthlyDetail(req: AuthRequest, res: Response): Promise<void> {
    const year = parseYear(req.query.year);
    const site = parseSite(req.query.site);
    if (!year || !site) {
        res.status(400).json({ error: `Expected query params year (2000-2100) and site (${KPI_SITES.join('|')})` });
        return;
    }
    try {
        res.json(await kpiService.getMonthlyDetail(year, site));
    } catch (err) {
        logger.error({ err }, 'KPI getMonthlyDetail failed');
        res.status(500).json({ error: 'Failed to fetch monthly detail' });
    }
}

export async function getWeeklyDetail(req: AuthRequest, res: Response): Promise<void> {
    const year = parseYear(req.query.year);
    const site = parseSite(req.query.site);
    if (!year || !site) {
        res.status(400).json({ error: `Expected query params year (2000-2100) and site (${KPI_SITES.join('|')})` });
        return;
    }
    try {
        res.json(await kpiService.getWeeklyDetail(year, site));
    } catch (err) {
        logger.error({ err }, 'KPI getWeeklyDetail failed');
        res.status(500).json({ error: 'Failed to fetch weekly detail' });
    }
}

export async function upsertKpi(req: AuthRequest, res: Response): Promise<void> {
    try {
        await kpiService.manualUpsert(req.body);
        res.status(200).json({ message: 'KPI saved' });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save KPI';
        logger.error({ err }, 'KPI upsert failed');
        res.status(400).json({ error: message });
    }
}

export async function importExcel(req: AuthRequest, res: Response): Promise<void> {
    const file = (req as AuthRequest & { file?: { buffer: Buffer } }).file;
    if (!file?.buffer) {
        res.status(400).json({ error: "Missing Excel file (multipart field 'file')" });
        return;
    }
    const site = parseSite(req.body?.site ?? req.query.site);
    if (!site) {
        res.status(400).json({ error: `Expected site (${KPI_SITES.join('|')})` });
        return;
    }
    try {
        res.json(await kpiService.importFromExcel(file.buffer, site));
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Excel import failed';
        logger.error({ err }, 'KPI Excel import failed');
        res.status(400).json({ error: message });
    }
}
