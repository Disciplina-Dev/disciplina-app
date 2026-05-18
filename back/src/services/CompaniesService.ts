import { CompanyRepository } from '../repositories/mysql/CompanyRepository';
import { CompaniesRow } from '../types/db-rows.types';
import { Companies } from '../types/company.types';
import { toCompanies } from './mappers/company.mapper';

export class CompaniesService {
    private repository: CompanyRepository;

    constructor() {
        this.repository = new CompanyRepository();
    }

    async findAll(): Promise<Companies[]> {
        const rows = await this.repository.findAll();
        return rows.map(toCompanies);
    }

    async findByCommercial(salePersonID: number): Promise<Companies[]> {
        const rows = await this.repository.findByCommercial(salePersonID);
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

    async create(data: Partial<CompaniesRow>): Promise<Companies> {
        this.validateCreateData(data);
        const id = await this.repository.create(data);
        const created = await this.repository.findById(id);
        if (!created) {
            throw new Error('Failed to retrieve created company');
        }
        return toCompanies(created);
    }

    async update(id: number, data: Partial<CompaniesRow>): Promise<Companies> {
        if (!id || id <= 0) {
            throw new Error('Valid company ID is required');
        }
        const existing = await this.repository.findById(id);
        if (!existing) {
            throw new Error('Company not found');
        }
        await this.repository.update(id, data);
        const updated = await this.repository.findById(id);
        if (!updated) {
            throw new Error('Company not found after update');
        }
        return toCompanies(updated);
    }

    async delete(id: number): Promise<boolean> {
        if (!id || id <= 0) {
            throw new Error('Valid company ID is required');
        }
        const rows = await this.repository.findAll();
        const exists = rows.some((c) => c.id === id);
        if (!exists) {
            throw new Error('Company not found');
        }
        return this.repository.delete(id);
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
