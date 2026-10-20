import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { query } from '../../../db/mysql/connection';
import { migrateSectors } from '../../../db/mysql/sectorsMigration';
import { truncateMysql } from '../../../../test/helpers/db';
import { CompanyRepository } from '../CompanyRepository';
import { SectorRepository } from '../SectorRepository';

async function sectorIdOf(label: string): Promise<number> {
    const all = await new SectorRepository().findAll();
    return all.find((s) => s.level === 'sector' && s.label === label)!.id;
}

async function storedSectorId(companyId: number): Promise<number | null> {
    const rows = await query<{ sector_id: number | null }[]>('SELECT sector_id FROM companies WHERE id = ?', [
        companyId,
    ]);
    return rows[0].sector_id;
}

describe('companies.sector_id suit companies.sector (double écriture)', () => {
    const repo = new CompanyRepository();

    beforeAll(async () => {
        await migrateSectors(query, 'reunion');
    });

    beforeEach(async () => {
        await truncateMysql();
    });

    it('create résout le libellé en sector_id', async () => {
        const id = await repo.create({ name: 'A', address: 'x', siret: '11111111111111', sector: 'Ouest' });
        expect(await storedSectorId(id)).toBe(await sectorIdOf('Ouest'));
    });

    it('un libellé multi-valeurs retient le premier secteur', async () => {
        const id = await repo.create({ name: 'B', address: 'x', siret: '22222222222222', sector: 'Sud, Ouest' });
        expect(await storedSectorId(id)).toBe(await sectorIdOf('Sud'));
    });

    it('update suit le changement de libellé, et vide sector_id si hors référentiel', async () => {
        const id = await repo.create({ name: 'C', address: 'x', siret: '33333333333333', sector: 'Ouest' });

        await repo.update(id, { sector: 'Nord-Est' });
        expect(await storedSectorId(id)).toBe(await sectorIdOf('Nord-Est'));

        await repo.update(id, { sector: 'Atlantide' });
        expect(await storedSectorId(id)).toBeNull();
    });

    it('update sans sector ne touche pas sector_id', async () => {
        const id = await repo.create({ name: 'D', address: 'x', siret: '44444444444444', sector: 'Sud' });
        await repo.update(id, { name: 'D2' });
        expect(await storedSectorId(id)).toBe(await sectorIdOf('Sud'));
    });
});
