import { describe, it, expect, beforeAll } from 'vitest';
import { mintAuthCookies } from '../../../../test/helpers/auth';
import { env } from '../../../config/env';
import { query } from '../../../db/mysql/connection';
import { migrateSectors } from '../../../db/mysql/sectorsMigration';
import { syncWithRegion } from '../../../db/tenant';
import { sectorService } from '../../../services/SectorService';
import type { Region } from '../../../types/tenant';

const ENDPOINT = `http://localhost:${env.API_PORT}/api/graphql/companies`;

async function sectors(region: Region, args = '', fields = 'code label level parentId') {
    const auth = mintAuthCookies({ id: 1, email: 'sectors@test.local', role: 'COMMERCIAL', permission: 'EMPLOYEE', region });
    const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cookieHeader, 'x-csrf-token': auth.csrfHeader },
        body: JSON.stringify({ query: `{ sectors${args} { id ${fields} } }` }),
    });
    return res.json();
}

describe('GraphQL sectors', () => {
    beforeAll(async () => {
        await migrateSectors(query, 'reunion');
        await syncWithRegion('annemasse', () => migrateSectors(query, 'annemasse'));
        sectorService.invalidate();
    });

    it('Réunion : 3 secteurs sous la région', async () => {
        const json = await sectors('reunion', '(level: "sector")');
        expect(json.errors).toBeUndefined();
        expect(json.data.sectors.map((s: any) => s.label)).toEqual(['Nord-Est', 'Ouest', 'Sud']);
    });

    it('Annemasse : 6 secteurs entreprise sous la région', async () => {
        const json = await sectors('annemasse', '(level: "sector")');
        expect(json.errors).toBeUndefined();
        expect(json.data.sectors).toHaveLength(6);
        expect(json.data.sectors.map((s: any) => s.code)).toContain('ARVE');
    });

    it('parentId retourne les enfants directs', async () => {
        const [region] = (await sectors('reunion', '(level: "region")')).data.sectors;
        const json = await sectors('reunion', `(parentId: ${region.id})`);
        expect(json.data.sectors.map((s: any) => s.level)).toEqual(['sector', 'sector', 'sector']);
    });

    it('communes : celles du secteur, dans le tenant du JWT', async () => {
        const json = await sectors('annemasse', '(level: "sector")', 'code communes { code level }');
        const arve = json.data.sectors.find((s: any) => s.code === 'ARVE');
        expect(arve.communes.length).toBeGreaterThan(0);
        expect(arve.communes.every((c: any) => c.level === 'commune')).toBe(true);
    });

    it('refuse un niveau inconnu', async () => {
        const json = await sectors('reunion', '(level: "galaxie")');
        expect(json.errors?.[0].message).toContain('Invalid sector level');
    });
});
