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

export async function getYears(_req: AuthRequest, res: Response): Promise<void> {
    try {
        res.json({ years: await kpiService.getAvailableYears() });
    } catch (err) {
        logger.error({ err }, 'KPI getYears failed');
        res.status(500).json({ error: 'Failed to fetch available years' });
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
