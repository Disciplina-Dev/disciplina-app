import { CompanyRepository, CompanyFilters, CompanySirenGroupRow } from '../repositories/mysql/CompanyRepository';
import { CompanyBlacklistRepository } from '../repositories/mysql/CompanyBlacklistRepository';
import { CompanyHistoryRepository } from '../repositories/mysql/CompanyHistoryRepository';
import { SireneService } from '../external/insee/sirene.service';
import { CompaniesRow } from '../types/db-rows.types';
import { Companies, CompanyHistory, CompanySirenGroup } from '../types/company.types';
import { toCompanies, toCompanyHistory, toSirenGroup } from './mappers/company.mapper';

export interface CompanyStats {
    current: { userID: number | null; status: string | null; count: number }[];
    byPeriod: { userID: number | null; status: string | null; week: number; month: number; count: number }[];
    years: number[];
}

export class CompaniesService {
    private repository: CompanyRepository;
    private blacklistRepository: CompanyBlacklistRepository;
    private historyRepository: CompanyHistoryRepository;
    private sireneService: SireneService;

    constructor() {
        this.repository = new CompanyRepository();
        this.blacklistRepository = new CompanyBlacklistRepository();
        this.historyRepository = new CompanyHistoryRepository();
        this.sireneService = new SireneService();
    }

    async findAll(first?: number, after?: string, search?: string, filters?: CompanyFilters): Promise<Companies[]> {
        const rows = await this.repository.findAll(first, after, search, filters);
        return rows.map(toCompanies);
    }

    async countAll(search?: string, filters?: CompanyFilters): Promise<number> {
        return this.repository.countAll(search, filters);
    }

    async findGroupedBySiren(first?: number, after?: string, filters?: CompanyFilters): Promise<CompanySirenGroup[]> {
        const rows = await this.repository.findGroupedBySiren(first, after, filters);
        return rows.map(toSirenGroup);
    }

    async countGroupedBySiren(filters?: CompanyFilters): Promise<number> {
        return this.repository.countGroupedBySiren(filters);
    }

    async getStats(year: number, userID?: number | null): Promise<CompanyStats> {
        if (!Number.isInteger(year) || year < 2000 || year > 2100) {
            throw new Error('Invalid year');
        }
        const [current, byPeriod, years] = await Promise.all([
            this.repository.countByStatus(userID),
            this.repository.countByPeriod(year, userID),
            this.repository.availableYears(),
        ]);
        return {
            current: current.map((r) => ({ userID: r.user_id, status: r.status, count: Number(r.count) })),
            byPeriod: byPeriod.map((r) => ({
                userID: r.user_id,
                status: r.status,
                week: Number(r.week),
                month: Number(r.month),
                count: Number(r.count),
            })),
            years,
        };
    }

    async findByCommercial(userID: number): Promise<Companies[]> {
        const rows = await this.repository.findByCommercial(userID);
        return rows.map(toCompanies);
    }

    async findBySiret(siret: string): Promise<Companies | null> {
        if (!siret || siret.trim() === '') {
            throw new Error('SIRET is required');
        }
        const row = await this.repository.findBySiret(siret);
        return row ? toCompanies(row) : null;
    }

    async findById(id: number): Promise<Companies | null> {
        const row = await this.repository.findById(id);
        return row ? toCompanies(row) : null;
    }

    async findByName(name: string): Promise<Companies | null> {
        if (!name || name.trim() === '') return null;
        const row = await this.repository.findByName(name.trim());
        return row ? toCompanies(row) : null;
    }

    async create(data: Partial<CompaniesRow>): Promise<Companies> {
        this.validateCreateData(data);
        const siret = data.siret as string;

        try {
            await this.sireneService.checkSiret(siret);
        } catch (error: any) {
            throw new Error(`SIRET invalide : ${error.message}`, { cause: error });
        }

        const existing = await this.repository.findBySiret(siret);
        if (existing) {
            throw new Error('Ce SIRET est déjà dans le portefeuille');
        }

        const siren = siret.slice(0, 9);
        const blacklistEntries = await this.blacklistRepository.findBySiren(siren);
        const isBlacklisted = blacklistEntries.some((e) => e.all_blacklist === 1 || e.siret === siret);
        if (isBlacklisted) {
            const match =
                blacklistEntries.find((e) => e.siret === siret) ?? blacklistEntries.find((e) => e.all_blacklist === 1);
            const reason = match?.conclusion?.trim();
            throw new Error(
                reason ? `Cette entreprise est blacklistée : ${reason}` : 'Cette entreprise est blacklistée',
            );
        }

        const id = await this.repository.create(data);
        const created = await this.repository.findById(id);
        if (!created) {
            throw new Error('Failed to retrieve created company');
        }
        return toCompanies(created);
    }

    async update(id: number, data: Partial<CompaniesRow>, modifiedBy?: number | null): Promise<Companies> {
        if (!id || id <= 0) {
            throw new Error('Valid company ID is required');
        }
        const existing = await this.repository.findById(id);
        if (!existing) {
            throw new Error('Company not found');
        }

        const toText = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v));

        // Champs réellement modifiés, avec valeur avant/après pour l'historique.
        const changes = Object.keys(data)
            .map((column) => ({
                column,
                from: toText(existing[column as keyof CompaniesRow]),
                to: toText(data[column as keyof CompaniesRow]),
            }))
            .filter((c) => c.from !== c.to);

        // Statut avant modification, conservé pour tracer les transitions de statut.
        const previousStatus = existing.status ?? null;

        await this.repository.update(id, data);
        const updated = await this.repository.findById(id);
        if (!updated) {
            throw new Error('Company not found after update');
        }

        if (changes.length > 0) {
            await this.historyRepository.create({
                company_id: id,
                updated_column: changes.map((c) => c.column).join(', '),
                status: updated.status ?? existing.status ?? '',
                previous_status: previousStatus,
                modified_by: modifiedBy ?? null,
                changes: JSON.stringify(changes),
            });
        }

        return toCompanies(updated);
    }

    async delete(id: number): Promise<boolean> {
        if (!id || id <= 0) {
            throw new Error('Valid company ID is required');
        }
        const existing = await this.repository.findById(id);
        if (!existing) {
            throw new Error('Company not found');
        }
        return this.repository.delete(id);
    }

    /** Lie (ou délie) une entreprise à son analyse de besoin Mongo, sans tracer d'historique. */
    async setAbId(id: number, abId: string | null): Promise<void> {
        if (!id || id <= 0) {
            throw new Error('Valid company ID is required');
        }
        await this.repository.setAbId(id, abId);
    }

    /** Vide la relance en cours d'une entreprise (après qu'elle a été effectuée). */
    async clearRelance(id: number): Promise<void> {
        if (!id || id <= 0) {
            throw new Error('Valid company ID is required');
        }
        await this.repository.clearRelance(id);
    }

    async getHistory(companyID: number): Promise<CompanyHistory[]> {
        if (!companyID || companyID <= 0) {
            throw new Error('Valid company ID is required');
        }
        const existing = await this.repository.findById(companyID);
        if (!existing) {
            throw new Error('Company not found');
        }
        const rows = await this.historyRepository.findByCompanyId(companyID);
        return rows.map(toCompanyHistory);
    }

    private validateCreateData(data: Partial<CompaniesRow>): void {
        const requiredFields = ['siret'];
        for (const field of requiredFields) {
            if (!data[field as keyof CompaniesRow]) {
                throw new Error(`${field} is required`);
            }
        }
        if (data.siret && data.siret.length !== 14) {
            throw new Error('SIRET must be 14 characters');
        }
    }
}
