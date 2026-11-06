import { describe, it, expect, beforeAll } from 'vitest';
import { query } from '../../db/mysql/connection';
import { migrateSectors } from '../../db/mysql/sectorsMigration';
import { SectorService } from '../SectorService';

describe('SectorService (référentiel Réunion)', () => {
    const service = new SectorService();

    // Idempotent : couvre une base dont le volume précède le seed de mysql-init.sql.
    beforeAll(async () => {
        await migrateSectors(query, 'reunion');
    });

    it('expose la région et ses 3 secteurs', async () => {
        const region = await service.findByCode('region', 'REUNION');
        expect(region?.parentId).toBeNull();

        const sectors = await service.children(region!.id);
        expect(sectors.map((s) => s.code).sort()).toEqual(['NORD', 'OUEST', 'SUD']);
    });

    it('résout un libellé historique vers son secteur', async () => {
        const nord = await service.findByLabel('Nord-Est');
        expect(nord).toMatchObject({ code: 'NORD', level: 'sector' });
        expect(await service.getById(nord!.id)).toEqual(nord);
        expect(await service.findByLabel('Inconnu')).toBeUndefined();
    });

    it('liste par niveau', async () => {
        const sectors = await service.list('sector');
        expect(sectors).toHaveLength(3);
        expect((await service.list('commune')).length).toBeGreaterThan(10);
    });

    it('descend du secteur à ses communes (CTE récursif)', async () => {
        const nord = await service.findByCode('sector', 'NORD');
        const communes = await service.communesOf(nord!.id);
        expect(communes.length).toBeGreaterThan(0);
        expect(communes.every((c) => c.level === 'commune')).toBe(true);
        expect(communes.map((c) => c.code)).toContain('SAINT_DENIS');
    });

    it('remonte de la commune à la région (CTE récursif)', async () => {
        const commune = await service.findByCode('commune', 'SAINT_DENIS');
        const chain = await service.ancestorsOf(commune!.id);
        expect(chain.map((s) => s.level)).toEqual(['commune', 'sector', 'region']);
        expect(chain[1].code).toBe('NORD');
        expect(chain[2].code).toBe('REUNION');
    });

    it('la descente depuis la région couvre toutes les communes', async () => {
        const region = await service.findByCode('region', 'REUNION');
        const all = await service.list('commune');
        expect(await service.communesOf(region!.id)).toHaveLength(all.length);
    });
});
