import { getConnection } from '../db/mysql/connection';
import { buildInsert } from '../db/mysql/queryBuilder';
import { CompanyRepository } from '../repositories/mysql/CompanyRepository';
import { CompanyConflictRepository } from '../repositories/mysql/CompanyConflictRepository';
import { CompaniesRow, CompanyConflictRow } from '../types/db-rows.types';
import { DEFAULT_PAGE_SIZE } from './pagination';

function isPlaceholderSiret(siret: string): boolean {
    const digits = siret.replace(/\D/g, '');
    return digits !== '' && digits === '0'.repeat(digits.length);
}

function isValidSiret(siret: string | null): siret is string {
    if (!siret) return false;
    const digits = siret.replace(/\D/g, '');
    if (digits.length !== 14) return false;
    return !isPlaceholderSiret(siret);
}

/** True pour les doublons SIRET Digiforma : la fiche du portefeuille est la référence. */
function isDuplicateSiretConflict(entry: CompanyConflictRow): boolean {
    const type = entry.conclusion?.replace(/^Conflit\s*:\s*/, '').trim() ?? '';
    return type === 'duplicate_digiforma_siret';
}

export class CompanyConflictService {
    private companyRepository: CompanyRepository;
    private conflictRepository: CompanyConflictRepository;

    constructor() {
        this.companyRepository = new CompanyRepository();
        this.conflictRepository = new CompanyConflictRepository();
    }

    async findAll(
        first: number = DEFAULT_PAGE_SIZE,
        after?: string,
        search?: string,
        conflictType?: string,
    ): Promise<CompanyConflictRow[]> {
        return this.conflictRepository.findAll(first, after, search, conflictType);
    }

    async updateConflict(id: number, data: Partial<CompanyConflictRow>): Promise<CompanyConflictRow> {
        const updated = await this.conflictRepository.update(id, data);
        if (!updated) {
            throw new Error('Company conflict entry not found');
        }
        const row = await this.conflictRepository.findById(id);
        if (!row) {
            throw new Error('Company conflict entry not found');
        }
        return row;
    }

    async deleteConflict(id: number): Promise<boolean> {
        return this.conflictRepository.delete(id);
    }

    async deleteConflictsByType(conflictType: string): Promise<number> {
        return this.conflictRepository.deleteByConclusion(`Conflit : ${conflictType}`);
    }

    async resolveConflict(id: number): Promise<CompaniesRow> {
        const entry = await this.conflictRepository.findById(id);
        if (!entry) {
            throw new Error('Company conflict entry not found');
        }

        if (!isValidSiret(entry.siret)) {
            throw new Error(
                'Le SIRET est invalide ou manquant : impossible de sortir cette entreprise de la quarantaine.',
            );
        }
        const siret = entry.siret as string;

        const existingCompany = await this.companyRepository.findBySiret(siret);
        if (existingCompany) {
            // L'entreprise (même SIRET) existe déjà au portefeuille : il s'agit d'un conflit
            // informatif (mismatch commercial, doublon SIRET Digiforma…). On ne peut pas
            // l'insérer (companies.siret est UNIQUE) : on applique le commercial choisi et
            // les champs éventuellement corrigés, puis on purge la quarantaine. Pour un
            // doublon SIRET, la fiche du portefeuille reste la référence (on ne l'écrase pas).
            if (!isDuplicateSiretConflict(entry)) {
                const correction: Partial<CompaniesRow> = {
                    legal_referent: entry.legal_referent ?? undefined,
                    name: entry.name ?? undefined,
                    phone: entry.phone ?? undefined,
                    email: entry.email ?? undefined,
                    address: entry.address ?? undefined,
                    sector: entry.sector ?? undefined,
                    main_activity: entry.main_activity ?? undefined,
                    idcc: entry.idcc ?? undefined,
                    ape: entry.ape ?? undefined,
                };
                if (entry.user_id) correction.user_id = entry.user_id;
                await this.companyRepository.update(existingCompany.id, correction);
            }
            await this.conflictRepository.delete(id);
            return (await this.companyRepository.findById(existingCompany.id)) ?? existingCompany;
        }

        const siren = siret.slice(0, 9);
        const sameSiren = await this.companyRepository.findAllBySiren(siren);
        const distinctUserIds = new Set(sameSiren.map((c) => c.user_id).filter((userId): userId is number => userId !== null));
        if (distinctUserIds.size > 1) {
            throw new Error('Plusieurs commerciaux sont déjà rattachés à ce SIREN : contactez un responsable.');
        }

        const conn = await getConnection();
        try {
            await conn.beginTransaction();

            const data: Partial<CompaniesRow> = { ...entry, status: entry.status ?? 'À Réfléchir' };
            delete (data as Partial<CompanyConflictRow>).id;
            delete (data as Partial<CompanyConflictRow>).candidate_user_ids;
            delete data.created_at;

            const { sql, values } = buildInsert(
                'companies',
                data as Record<string, string | number | boolean | Date | null>,
            );
            const [result] = await conn.execute(sql, values);
            const insertedId = (result as any).insertId;
            await conn.execute('DELETE FROM company_conflict WHERE id = ?', [id]);

            await conn.commit();

            const created = await this.companyRepository.findById(insertedId);
            if (!created) {
                throw new Error('Company creation failed');
            }
            return created;
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }
}
