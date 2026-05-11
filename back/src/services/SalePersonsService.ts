import { SalePersonRepository } from '../repositories/mysql/SalePersonRepository';
import { SalePerson } from '../types/company.types';
import { toSalePerson } from './mappers/company.mapper';

const salePersonRepository = new SalePersonRepository();

export class SalePersonsService {
    async findAll(): Promise<SalePerson[]> {
        const rows = await salePersonRepository.findAll();
        return rows.map(toSalePerson);
    }

    async findById(id: number): Promise<SalePerson | null> {
        const row = await salePersonRepository.findById(id);
        return row ? toSalePerson(row) : null;
    }

    async findByEmail(email: string): Promise<SalePerson | null> {
        const row = await salePersonRepository.findByEmail(email);
        return row ? toSalePerson(row) : null;
    }
}
