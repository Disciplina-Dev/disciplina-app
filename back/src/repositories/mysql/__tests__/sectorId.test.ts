import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { query } from '../../../db/mysql/connection';
import { migrateSectors } from '../../../db/mysql/sectorsMigration';
import { truncateMysql } from '../../../../test/helpers/db';
import { syncWithRegion } from '../../../db/tenant';
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

    it("le libellé lu est dérivé de company_sectors, la colonne companies.sector n'est plus écrite", async () => {
        const id = await repo.create({ name: 'F', address: 'x', siret: '66666666666666', sector: 'Sud, Nord-Est' });
        expect((await repo.findById(id))!.sector).toBe('Nord-Est, Sud');

        const [raw] = await query<{ sector: string | null }[]>('SELECT sector FROM companies WHERE id = ?', [id]);
        expect(raw.sector).toBeNull();

        await repo.update(id, { sector: 'Ouest' });
        expect((await repo.findById(id))!.sector).toBe('Ouest');
    });

    describe('company_sectors et filtre multi-secteur', () => {
        const labelsOf = async (companyId: number): Promise<string[]> => {
            const rows = await query<{ label: string }[]>(
                'SELECT s.label FROM company_sectors cs JOIN sectors s ON s.id = cs.sector_id WHERE cs.company_id = ? ORDER BY s.label',
                [companyId],
            );
            return rows.map((r) => r.label);
        };
        const sirensOf = async (filters: Parameters<CompanyRepository['findAll']>[3]): Promise<string[]> =>
            (await repo.findAll(50, undefined, undefined, filters)).map((c) => c.name!).sort();

        it('create et update synchronisent les liaisons (multi-valeurs inclus)', async () => {
            const id = await repo.create({ name: 'E', address: 'x', siret: '55555555555555', sector: 'Sud, Ouest' });
            expect(await labelsOf(id)).toEqual(['Ouest', 'Sud']);

            await repo.update(id, { sector: 'Nord-Est' });
            expect(await labelsOf(id)).toEqual(['Nord-Est']);

            await repo.update(id, { name: 'E2' });
            expect(await labelsOf(id)).toEqual(['Nord-Est']);
        });

        it('filtre OU et ET sur les liaisons', async () => {
            await repo.create({ name: 'Mono', address: 'x', siret: '66666666666661', sector: 'Ouest' });
            await repo.create({ name: 'Duo', address: 'x', siret: '66666666666662', sector: 'Ouest, Sud' });
            await repo.create({ name: 'Autre', address: 'x', siret: '66666666666663', sector: 'Nord-Est' });

            expect(await sirensOf({ sectors: ['Sud'] })).toEqual(['Duo']);
            expect(await sirensOf({ sectors: ['Ouest'] })).toEqual(['Duo', 'Mono']);
            expect(await sirensOf({ sectors: ['Ouest', 'Nord-Est'], sectorMode: 'OR' })).toEqual([
                'Autre',
                'Duo',
                'Mono',
            ]);
            expect(await sirensOf({ sectors: ['Ouest', 'Sud'], sectorMode: 'AND' })).toEqual(['Duo']);
        });
    });

    it('filtre sur le vocabulaire Annemasse dans la base du tenant annemasse', async () => {
        await syncWithRegion('annemasse', async () => {
            const annemasse = new CompanyRepository();
            const id = await annemasse.create({
                name: 'Arve Corp',
                address: 'x',
                siret: '77777777777777',
                sector: 'Arve',
            });
            try {
                const found = await annemasse.findAll(50, undefined, undefined, { sectors: ['Arve'] });
                expect(found.some((c) => c.id === id)).toBe(true);
            } finally {
                await annemasse.delete(id);
            }
        });
    });
});
