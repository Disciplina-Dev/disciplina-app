import { ContactLogRepository } from '../repositories/mysql/ContactLogRepository';
import { CompanyRepository } from '../repositories/mysql/CompanyRepository';
import { ContactLog, ContactLogStats } from '../types/company.types';
import { toContactLog } from './mappers/company.mapper';

const MAX_COMMENT_LENGTH = 2000;

export class ContactLogService {
    private repository: ContactLogRepository;
    private companyRepository: CompanyRepository;

    constructor() {
        this.repository = new ContactLogRepository();
        this.companyRepository = new CompanyRepository();
    }

    async create(companyID: number, userID: number, comment: string): Promise<ContactLog> {
        if (!companyID || companyID <= 0) {
            throw new Error('Valid company ID is required');
        }
        if (!userID || userID <= 0) {
            throw new Error('Authentication required');
        }
        const trimmed = (comment ?? '').trim();
        if (!trimmed) {
            throw new Error('Le commentaire est obligatoire');
        }
        if (trimmed.length > MAX_COMMENT_LENGTH) {
            throw new Error(`Le commentaire ne doit pas dépasser ${MAX_COMMENT_LENGTH} caractères`);
        }
        const company = await this.companyRepository.findById(companyID);
        if (!company) {
            throw new Error('Company not found');
        }
        const id = await this.repository.create(companyID, userID, trimmed);
        const created = await this.repository.findById(id);
        if (!created) {
            throw new Error('Failed to retrieve created contact log');
        }
        return toContactLog(created);
    }

    /** `restrictedTo` limite la liste aux logs du commercial (les COMMERCIAL ne voient que les leurs). */
    async getByCompany(companyID: number, restrictedTo?: number | null): Promise<ContactLog[]> {
        if (!companyID || companyID <= 0) {
            throw new Error('Valid company ID is required');
        }
        const rows = await this.repository.findByCompanyId(companyID, restrictedTo ?? undefined);
        return rows.map(toContactLog);
    }

    async getStats(): Promise<ContactLogStats> {
        const [total, byUser] = await Promise.all([this.repository.countAll(), this.repository.countByUser()]);
        return {
            total,
            byUser: byUser.map((r) => ({ userID: r.user_id, count: Number(r.count) })),
        };
    }
}
