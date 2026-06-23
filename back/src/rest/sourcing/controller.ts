import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { SireneService } from '../../external/insee/sirene.service';
import { GeocodageService } from '../../external/insee/geocodage.service';
import { CompanyRepository } from '../../repositories/mysql/CompanyRepository';
import { SourcingService } from '../../services/SourcingService';
import { UserService } from '../../services/UserService';
import { CompaniesBlacklistService } from '../../services/CompaniesBlacklistService';
import { SireneCriterion, SireneEtablissement } from '../../external/insee/types';
import { toCompanies } from '../../services/mappers/company.mapper';
import { CompanyWithSalePerson, SirenSearchResult, BlacklistedCompanyInfo } from './types';
import { logger } from '../../external/logger';

const sireneService = new SireneService();
const geocodageService = new GeocodageService();
const companyRepository = new CompanyRepository();
const sourcingService = new SourcingService();
const userService = new UserService();
const companiesBlacklistService = new CompaniesBlacklistService();

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
        logger.info({ userId: req.user?.id, criteria, offset }, 'Sourcing: recherche commerciaux multicritère');

        const result = await sireneService.searchEstablishments(criteria as SireneCriterion[], offset);

        const checks = await Promise.all(
            result.etablissements.map((e) => companyRepository.findBySiret(`${e.siret.slice(0, 9)}%`)),
        );
        const existingSet = new Set(result.etablissements.filter((_, i) => checks[i] !== null).map((e) => e.siret));
        result.etablissements = result.etablissements.filter((e) => !existingSet.has(e.siret));
        result.header.nombre = result.etablissements.length;

        logger.info(
            { userId: req.user?.id, found: result.etablissements.length },
            'Sourcing: résultats recherche commerciaux',
        );

        res.json(result);
    } catch (error: any) {
        logger.error({ err: error }, 'Sourcing: échec recherche commerciaux');
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
        logger.info({ userId: req.user?.id, siret }, 'Sourcing: vérification SIRET');
        const result = await sireneService.checkSiret(siret);
        const existing = await companyRepository.findBySiret(siret);
        res.json({ ...result, alreadyExists: existing !== null });
    } catch (error: any) {
        logger.error({ err: error }, 'Sourcing: échec vérification SIRET');
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

export async function searchBySiren(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { siren } = req.params;
        logger.info({ userId: req.user?.id, siren }, 'Sourcing: recherche par SIREN');

        const { entries, allBlacklisted } = await companiesBlacklistService.findBySiren(siren);
        const blacklisted: BlacklistedCompanyInfo[] = entries.map((e) => ({
            name: e.name,
            siret: e.siret,
            conclusion: e.conclusion,
        }));

        if (allBlacklisted) {
            const result: SirenSearchResult = {
                siren,
                companiesWithSale: [],
                etablissements: [],
                blacklisted,
                allBlacklisted: true,
                message: 'Cette entreprise est blacklisté vous ne pouvez donc pas la prospecter',
            };
            res.json(result);
            return;
        }

        const sireneResult = await sireneService.searchEstablishments([{ paramName: 'siren', value: siren }]);

        const sirets = sireneResult.etablissements.map((e) => e.siret);
        const existingRows = await companyRepository.findBySirets(sirets);
        const existingBySiret = new Map(existingRows.map((row) => [row.siret, row]));

        const companiesWithSale: CompanyWithSalePerson[] = [];
        const etablissements: SireneEtablissement[] = [];

        for (const e of sireneResult.etablissements) {
            const row = existingBySiret.get(e.siret);
            if (!row) {
                etablissements.push(e);
                continue;
            }
            const company = toCompanies(row);
            const user = await userService.findById(company.userID ?? 0);
            const salePerson = user ? { id: user.id, email: user.email, name: user.name } : null;
            companiesWithSale.push({ company, salePerson });
        }

        const result: SirenSearchResult = {
            siren,
            companiesWithSale,
            etablissements,
            blacklisted,
            allBlacklisted: false,
        };
        res.json(result);
    } catch (error: any) {
        logger.error({ err: error }, 'Sourcing: échec recherche par SIREN');
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

export async function getCompletion(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { input } = req.query;

        if (typeof input !== 'string' || !input.trim()) {
            res.status(400).json({ status: 'KO', results: [] });
            return;
        }

        const results = await geocodageService.search(input.trim());
        if (results === null) {
            res.json({ status: 'KO', results: [] });
            return;
        }

        res.json({ status: 'OK', results });
    } catch (error: any) {
        logger.error({ err: error }, 'Sourcing: échec autocomplétage adresse');
        res.json({ status: 'KO', results: [] });
    }
}
