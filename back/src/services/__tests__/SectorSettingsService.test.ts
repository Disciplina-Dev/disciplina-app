import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { query } from '../../db/mysql/connection';
import { migrateSectors } from '../../db/mysql/sectorsMigration';
import { SectorSettingsService } from '../SectorSettingsService';
import { sectorService } from '../SectorService';

describe('SectorSettingsService (lieux portés par sectors.location)', () => {
    const service = new SectorSettingsService();
    let initial: { sector: string; location: string }[];

    beforeAll(async () => {
        await migrateSectors(query, 'reunion');
        initial = await service.list();
    });

    afterAll(async () => {
        await service.update(initial);
    });

    it('liste les 3 secteurs Réunion avec leur lieu', async () => {
        const rows = await service.list();
        expect(rows.map((r) => r.sector)).toEqual(['Nord-Est', 'Ouest', 'Sud']);
    });

    it('met à jour sectors.location et invalide le cache du référentiel', async () => {
        await service.update([{ sector: 'Ouest', location: 'Lieu test' }]);

        const rows = await service.list();
        expect(rows.find((r) => r.sector === 'Ouest')?.location).toBe('Lieu test');
        expect((await sectorService.findByLabel('Ouest'))?.location).toBe('Lieu test');
    });

    it('ignore un secteur inconnu', async () => {
        await service.update([{ sector: 'Nulle part', location: 'x' }]);
        expect((await service.list()).some((r) => r.location === 'x')).toBe(false);
    });
});
