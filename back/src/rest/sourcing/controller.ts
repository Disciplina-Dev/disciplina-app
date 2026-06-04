import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { SireneService } from '../../external/insee/sirene.service';
import { CompanyRepository } from '../../repositories/mysql/CompanyRepository';
import { SourcingService } from '../../services/SourcingService';

const sireneService = new SireneService();
const companyRepository = new CompanyRepository();
const sourcingService = new SourcingService();

export async function companiesByCommune(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { commune } = req.params;
        const rawOffset = req.query.offset;
        const offset = rawOffset !== undefined ? parseInt(rawOffset as string, 10) : 0;
        if (isNaN(offset) || offset < 0) {
            res.status(400).json({ error: 'offset must be a non-negative integer' });
            return;
        }
        const result = await sireneService.companiesByCommune(commune, offset);

        const checks = await Promise.all(result.etablissements.map((e) => companyRepository.findBySiret(e.siret)));
        const existingSet = new Set(result.etablissements.filter((_, i) => checks[i] !== null).map((e) => e.siret));
        result.etablissements = result.etablissements.filter((e) => !existingSet.has(e.siret));
        result.header.nombre = result.etablissements.length;

        res.json(result);
    } catch (error: any) {
        if (error.message === 'No establishments found for this commune') {
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
