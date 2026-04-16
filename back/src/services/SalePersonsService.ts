import { SalePersonsRepository } from '../repositories/SalePersonsRepository';
import { SalePerson } from './interfaces';
import { toSalePerson } from './mappers';

const salePersonsRepository = new SalePersonsRepository();

export class SalePersonsService {
  async findAll(): Promise<SalePerson[]> {
    const rows = await salePersonsRepository.findAll();
    return rows.map(toSalePerson);
  }

  async findById(id: number): Promise<SalePerson | null> {
    const row = await salePersonsRepository.findById(id);
    return row ? toSalePerson(row) : null;
  }

  async findByEmail(email: string): Promise<SalePerson | null> {
    const row = await salePersonsRepository.findByEmail(email);
    return row ? toSalePerson(row) : null;
  }
}
