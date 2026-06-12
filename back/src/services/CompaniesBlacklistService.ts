import { getConnection } from '../db/mysql/connection';
import { CompanyRepository } from '../repositories/mysql/CompanyRepository';
import { CompanyBlacklistRepository } from '../repositories/mysql/CompanyBlacklistRepository';
import { CompaniesBlacklistRow } from '../types/db-rows.types';

export interface BlacklistLookupResult {
    entries: CompaniesBlacklistRow[];
    allBlacklisted: boolean;
}

export class CompaniesBlacklistService {
    private companyRepository: CompanyRepository;
    private blacklistRepository: CompanyBlacklistRepository;

    constructor() {
        this.companyRepository = new CompanyRepository();
        this.blacklistRepository = new CompanyBlacklistRepository();
    }

    async findBySiren(siren: string): Promise<BlacklistLookupResult> {
        const entries = await this.blacklistRepository.findBySiren(siren);
        return {
            entries,
            allBlacklisted: entries.some((e) => e.all_blacklist === 1),
        };
    }

    async blacklistCompany(id: number, reason: string, allBlacklist: boolean): Promise<boolean> {
        if (!reason || !reason.trim()) {
            throw new Error('A reason is required to blacklist a company');
        }

        const target = await this.companyRepository.findById(id);
        if (!target) {
            throw new Error('Company not found');
        }
        if (!target.siret) {
            throw new Error('Company has no SIRET');
        }

        const siren = target.siret.slice(0, 9);
        const toMove = allBlacklist ? await this.companyRepository.findAllBySiren(siren) : [target];

        const conn = await getConnection();
        try {
            await conn.beginTransaction();
            for (const company of toMove) {
                const existing = await this.blacklistRepository.findBySiret(company.siret ?? '');
                if (!existing) {
                    const blacklistData: Partial<CompaniesBlacklistRow> = {
                        ...company,
                        conclusion: reason,
                        all_blacklist: allBlacklist ? 1 : 0,
                    };
                    delete blacklistData.id;
                    delete blacklistData.created_at;
                    await this.blacklistRepository.create(blacklistData);
                }
                await conn.execute('DELETE FROM companies WHERE id = ?', [company.id]);
            }

            await conn.commit();
            return true;
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }
}
