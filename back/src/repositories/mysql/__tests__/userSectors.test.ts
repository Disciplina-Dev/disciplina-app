import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { query } from '../../../db/mysql/connection';
import { migrateSectors } from '../../../db/mysql/sectorsMigration';
import { truncateMysql } from '../../../../test/helpers/db';
import { UserRepository } from '../UserRepository';

async function labelsOf(userId: number): Promise<string[]> {
    const rows = await query<{ label: string }[]>(
        'SELECT s.label FROM user_sectors us JOIN sectors s ON s.id = us.sector_id WHERE us.user_id = ? ORDER BY s.label',
        [userId],
    );
    return rows.map((r) => r.label);
}

describe('user_sectors suit users.sectors (double écriture)', () => {
    const repo = new UserRepository();

    const newUser = (sectors: string[] | null) =>
        repo.create({
            email: `u${Math.random()}@test.local`,
            first_name: 'U',
            last_name: 'S',
            password: 'x',
            role_id: 2 as any,
            permission_id: 1 as any,
            sectors,
            oauth_token: null,
            refresh_token: null,
        });

    beforeAll(async () => {
        await migrateSectors(query, 'reunion');
    });

    beforeEach(async () => {
        await truncateMysql();
    });

    it('create écrit les liaisons et ignore un libellé hors référentiel', async () => {
        const id = await newUser(['Nord-Est', 'Ouest', 'Atlantide']);
        expect(await labelsOf(id)).toEqual(['Nord-Est', 'Ouest']);
    });

    it('create sans secteur ne crée aucune liaison', async () => {
        expect(await labelsOf(await newUser(null))).toEqual([]);
    });

    it('updateSectors remplace les liaisons, [] les vide', async () => {
        const id = await newUser(['Sud']);
        await repo.updateSectors(id, ['Ouest']);
        expect(await labelsOf(id)).toEqual(['Ouest']);
        await repo.updateSectors(id, []);
        expect(await labelsOf(id)).toEqual([]);
    });

    it('updateProfile synchronise seulement si sectors est fourni', async () => {
        const id = await newUser(['Sud']);
        await repo.updateProfile(id, { first_name: 'Autre' });
        expect(await labelsOf(id)).toEqual(['Sud']);
        await repo.updateProfile(id, { sectors: JSON.stringify(['Nord-Est']) as any });
        expect(await labelsOf(id)).toEqual(['Nord-Est']);
    });
});
