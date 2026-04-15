import { CompaniesRepository } from '../repositories/CompaniesRepository';
import { CompaniesRow } from '../repositories/interfaces';
import { Companies } from './interfaces';
import { toCompanies } from './mappers';

export class CompaniesService {
  private repository: CompaniesRepository;

  constructor() {
    this.repository = new CompaniesRepository();
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

  async create(data: Partial<CompaniesRow>): Promise<Companies> {
    this.validateCreateData(data);
    const id = await this.repository.create(data);
    const created = await this.repository.findBySiret(data.siret || '');
    if (!created) {
      throw new Error('Failed to retrieve created company');
    }
    return toCompanies(created);
  }

  async update(id: number, data: Partial<CompaniesRow>): Promise<Companies> {
    if (!id || id <= 0) {
      throw new Error('Valid company ID is required');
    }
    const existing = await this.repository.findBySiret('');
    if (!existing && id) {
      const all = await this.repository.findAll();
      const found = all.find(c => c.id === id);
      if (!found) {
        throw new Error('Company not found');
      }
    }
    await this.repository.update(id, data);
    const updated = await this.repository.findBySiret('');
    if (updated && updated.id === id) {
      return toCompanies(updated);
    }
    const rows = await this.repository.findAll();
    const result = rows.find(c => c.id === id);
    if (!result) {
      throw new Error('Company not found after update');
    }
    return toCompanies(result);
  }

  async delete(id: number): Promise<boolean> {
    if (!id || id <= 0) {
      throw new Error('Valid company ID is required');
    }
    const rows = await this.repository.findAll();
    const exists = rows.some(c => c.id === id);
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