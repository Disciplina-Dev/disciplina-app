import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { SireneService } from '../../external/insee/sirene.service';
import { CompanyRepository } from '../../repositories/mysql/CompanyRepository';
import { DdgService } from '../../external/ddg/ddg.service';

const sireneService = new SireneService();
const companyRepository = new CompanyRepository();
const ddgService = new DdgService();

export async function companiesByCommune(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { commune } = req.params;
        const result = await sireneService.companiesByCommune(commune);

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
        const query = `${name}${address && typeof address === 'string' ? ' ' + address.trim() : ''}`;
        const results = await ddgService.search(query);
        const urls = results.map((r) => r.url);

        res.json({ urls });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
}
