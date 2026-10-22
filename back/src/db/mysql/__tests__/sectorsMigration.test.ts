import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { buildSectorSeed } from '../sectorsMigration';
import { ANNEMASSE_COMPANY_SECTORS, ANNEMASSE_SECTOR, SECTORS } from '../../../utils/sector';
import { Localisation } from '../../../types/matching.types';
import { CompanyRegion } from '../../../types/needsAnalysisNoSql.types';
import { TRAINING_SITE_TO_ZONE } from '../../../utils/zone';

const labelsAt = (tenant: 'reunion' | 'annemasse', level: string) =>
    buildSectorSeed(tenant)
        .filter((n) => n.level === level)
        .map((n) => n.label);

describe('buildSectorSeed', () => {
    it('reste synchronisé avec les libellés historiques de utils/sector', () => {
        expect(labelsAt('reunion', 'sector')).toEqual([...SECTORS]);
        expect(labelsAt('annemasse', 'sector')).toEqual([...ANNEMASSE_COMPANY_SECTORS]);
        expect(labelsAt('annemasse', 'region')).toEqual([ANNEMASSE_SECTOR]);
    });

    it('couvre chaque commune du tenant une seule fois, sous un secteur du tenant', () => {
        for (const tenant of ['reunion', 'annemasse'] as const) {
            const nodes = buildSectorSeed(tenant);
            const sectorCodes = new Set(nodes.filter((n) => n.level === 'sector').map((n) => n.code));
            const communes = nodes.filter((n) => n.level === 'commune');
            expect(new Set(communes.map((c) => c.code)).size).toBe(communes.length);
            expect(communes.every((c) => c.parentCode && sectorCodes.has(c.parentCode))).toBe(true);
        }
        const all = [...buildSectorSeed('reunion'), ...buildSectorSeed('annemasse')].filter(
            (n) => n.level === 'commune',
        );
        expect(new Set(all.map((c) => c.code))).toEqual(new Set(Object.values(Localisation)));
    });

    it('rattache BONS_EN_CHABLAIS au seul secteur retenu par COMMUNE_TO_ZONE (CHABLAIS)', () => {
        const bons = buildSectorSeed('annemasse').filter((n) => n.code === Localisation.BONS_EN_CHABLAIS);
        expect(bons).toHaveLength(1);
        expect(bons[0].parentCode).toBe('CHABLAIS');
    });

    it('porte pour chaque tenant les codes de secteur de CompanyRegion', () => {
        const codes = (tenant: 'reunion' | 'annemasse') =>
            buildSectorSeed(tenant)
                .filter((n) => n.level === 'sector')
                .map((n) => n.code);
        expect([...codes('reunion'), ...codes('annemasse')].sort()).toEqual(Object.values(CompanyRegion).sort());
    });

    it('associe chaque site de formation à un secteur Réunion du référentiel', () => {
        const reunion = new Set(
            buildSectorSeed('reunion')
                .filter((n) => n.level === 'sector')
                .map((n) => n.code),
        );
        for (const zone of Object.values(TRAINING_SITE_TO_ZONE)) expect(reunion.has(zone)).toBe(true);
    });

    it('liste les parents avant leurs enfants', () => {
        const nodes = buildSectorSeed('annemasse');
        const seen = new Set<string>();
        for (const n of nodes) {
            if (n.parentCode) expect(seen.has(n.parentCode)).toBe(true);
            seen.add(n.code);
        }
    });
});

// Le conteneur de test (CI) ne contient que back/ : le script d'init n'y est pas.
const INIT_SQL = resolve(__dirname, '../../../../../database/mysql/mysql-init.sql');

describe.skipIf(!existsSync(INIT_SQL))('seed de mysql-init.sql', () => {
    const sql = readFileSync(INIT_SQL, 'utf8');

    it.each(['reunion', 'annemasse'] as const)('reflète buildSectorSeed(%s)', (tenant) => {
        const block = sql.split(`-- BEGIN sectors seed ${tenant}`)[1]?.split('-- END')[0] ?? '';
        const inSql = [...block.matchAll(/SELECT '([A-Z_]+)'(?: AS code)?, '([^']*)'/g)].map((m) => `${m[1]}|${m[2]}`);
        const expected = buildSectorSeed(tenant).map((n) => `${n.code}|${n.label}`);
        expect(inSql.sort()).toEqual(expected.sort());
    });
});
