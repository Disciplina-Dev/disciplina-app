import { describe, it, expect, beforeEach } from 'vitest';
import { query } from '../connection';
import { runMysqlMigrations } from '../migrations';
import { TENANT_TIMEZONE, TENANT_SECTOR_LOCATIONS } from '../../../config/tenant';

const dbQuery = <T>(sql: string, params?: unknown[]): Promise<T> => query(sql as never, params as never) as Promise<T>;

describe('runMysqlMigrations — backfill sector_settings (GEO-11)', () => {
    beforeEach(async () => {
        await query('DELETE FROM sector_settings' as never);
    });

    it('backfille un libellé Réunion legacy vers le libellé Annemasse pour le tenant annemasse', async () => {
        await query(
            'INSERT INTO sector_settings (sector, location) VALUES (?, ?)' as never,
            ['Nord-Est', 'Disciplina Nord-Est — Sainte-Marie'] as never,
        );

        await runMysqlMigrations(dbQuery, TENANT_TIMEZONE.annemasse, 'annemasse');

        const rows = await query<{ sector: string; location: string }[]>(
            "SELECT sector, location FROM sector_settings WHERE sector = 'Nord-Est'" as never,
        );
        expect(rows[0].location).toBe(TENANT_SECTOR_LOCATIONS.annemasse.find((d) => d.sector === 'Nord-Est')?.location);
    });

    it('ne réécrit pas une ligne déjà personnalisée par un admin', async () => {
        await query(
            'INSERT INTO sector_settings (sector, location) VALUES (?, ?)' as never,
            ['Ouest', 'Bureau custom Gaillard'] as never,
        );

        await runMysqlMigrations(dbQuery, TENANT_TIMEZONE.annemasse, 'annemasse');

        const rows = await query<{ sector: string; location: string }[]>(
            "SELECT sector, location FROM sector_settings WHERE sector = 'Ouest'" as never,
        );
        expect(rows[0].location).toBe('Bureau custom Gaillard');
    });

    it('ne touche pas le tenant réunion', async () => {
        await query(
            'INSERT INTO sector_settings (sector, location) VALUES (?, ?)' as never,
            ['Sud', 'Disciplina Sud — Saint-Pierre'] as never,
        );

        await runMysqlMigrations(dbQuery, TENANT_TIMEZONE.reunion, 'reunion');

        const rows = await query<{ sector: string; location: string }[]>(
            "SELECT sector, location FROM sector_settings WHERE sector = 'Sud'" as never,
        );
        expect(rows[0].location).toBe('Disciplina Sud — Saint-Pierre');
    });
});
