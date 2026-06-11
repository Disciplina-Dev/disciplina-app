import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { SireneService } from '../../external/insee/sirene.service';
import { CompanyRepository } from '../../repositories/mysql/CompanyRepository';
import { SourcingService } from '../../services/SourcingService';
import { SireneCriterion } from '../../external/insee/types';

const sireneService = new SireneService();
const companyRepository = new CompanyRepository();
const sourcingService = new SourcingService();

export async function companiesByMulticriteria(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { criteria } = req.body;
        if (!Array.isArray(criteria) || criteria.length === 0) {
            res.status(400).json({ error: 'criteria must be a non-empty array' });
            return;
        }
        for (const item of criteria) {
            if (typeof item.paramName !== 'string' || typeof item.value !== 'string' || !item.value.trim()) {
                res.status(400).json({ error: 'Each criterion must have a non-empty paramName and value' });
                return;
            }
        }

        const rawOffset = req.query.offset;
        const offset = rawOffset !== undefined ? parseInt(rawOffset as string, 10) : 0;
        if (isNaN(offset) || offset < 0) {
            res.status(400).json({ error: 'offset must be a non-negative integer' });
            return;
        }
        const result = await sireneService.searchEstablishments(criteria as SireneCriterion[], offset);

        const checks = await Promise.all(
            result.etablissements.map((e) => companyRepository.findBySiret(`${e.siret.slice(0, 9)}%`)),
        );
        const existingSet = new Set(result.etablissements.filter((_, i) => checks[i] !== null).map((e) => e.siret));
        result.etablissements = result.etablissements.filter((e) => !existingSet.has(e.siret));
        result.header.nombre = result.etablissements.length;

        res.json(result);
    } catch (error: any) {
        if (error.message === 'No establishments found for the given criteria') {
            res.status(404).json({ error: error.message });
            return;
        }
        if (error.message === 'Rate limit exceeded') {
            res.status(429).json({ error: error.message });
            return;
        }
        res.status(400).json({ error: error.message });
    }
}

export async function checkSiret(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { siret } = req.params;
        const result = await sireneService.checkSiret(siret);
        const existing = await companyRepository.findBySiret(siret);
        res.json({ ...result, alreadyExists: existing !== null });
    } catch (error: any) {
        if (error.message === 'SIRET not found') {
            res.status(404).json({ error: error.message });
            return;
        }
        if (error.message === 'Rate limit exceeded') {
            res.status(429).json({ error: error.message });
            return;
        }
        res.status(400).json({ error: error.message });
    }
}

export async function additionalSearch(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { siret, name, address } = req.body;
        if (typeof name !== 'string' || !name.trim()) {
            res.status(400).json({ error: 'name is required and must be a non-empty string' });
            return;
        }

        if (siret && typeof siret === 'string' && siret.trim()) {
            const existing = await companyRepository.findBySiret(siret);
            if (existing) {
                res.status(400).json({ error: 'Company already exists' });
                return;
            }
        }

        const cleanAddress = address && typeof address === 'string' ? address.trim() : undefined;
        const contacts = await sourcingService.findContacts(name.trim(), cleanAddress);
        res.json({ contacts });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
}
