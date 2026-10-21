import { logger } from '../../external/logger';
import { ZONE_TO_COMMUNES, Zone } from '../../services/mappers/abToOffer';
import { COMMUNE_TO_ZONE } from '../../utils/zone';

type QueryFn = <T>(sql: string, params?: unknown[]) => Promise<T>;

export type SectorTenant = 'reunion' | 'annemasse';
type SectorLevel = 'region' | 'sector' | 'commune';

export interface SectorSeedNode {
    code: string;
    label: string;
    level: SectorLevel;
    /** Code du parent (niveau immédiatement supérieur) ; null pour la région. */
    parentCode: string | null;
}

interface TenantTree {
    region: { code: string; label: string };
    /** Zones feuilles du tenant, dans l'ordre d'affichage. Le libellé est la valeur historique de companies.sector. */
    sectors: { zone: Zone; label: string }[];
}

// Libellés = valeurs actuelles de companies.sector / users.sectors (le backfill
// s'y raccorde par libellé). À garder synchronisés avec SECTORS et
// ANNEMASSE_COMPANY_SECTORS (utils/sector.ts) — verrouillé par sectorsMigration.test.ts :
// la couche db ne doit pas dépendre de utils/sector.
const TENANT_TREES: Record<SectorTenant, TenantTree> = {
    reunion: {
        region: { code: 'REUNION', label: 'La Réunion' },
        sectors: [
            { zone: 'NORD', label: 'Nord-Est' },
            { zone: 'OUEST', label: 'Ouest' },
            { zone: 'SUD', label: 'Sud' },
        ],
    },
    annemasse: {
        // Sur ce tenant, le secteur *utilisateur* est unique (« Annemasse ») : il
        // correspond au nœud région, les 6 secteurs entreprise en sont les enfants.
        region: { code: 'ANNEMASSE', label: 'Annemasse' },
        sectors: [
            { zone: 'GENEVE_FRONTIERE', label: 'Genève / Frontière' },
            { zone: 'GENEVOIS', label: 'Saint-Julien / Genevois' },
            { zone: 'ARVE', label: 'Arve' },
            { zone: 'FAUCIGNY', label: 'Faucigny / La Roche' },
            { zone: 'ANNECY', label: 'Annecy' },
            { zone: 'CHABLAIS', label: 'Chablais' },
        ],
    },
};

/** SAINT_JEAN_DE_X → « Saint Jean De X » (libellé provisoire, éditable ensuite en base). */
function communeLabel(code: string): string {
    return code
        .split('_')
        .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Arbre région > secteur > commune du tenant, parents avant enfants. Source des
 * communes : ZONE_TO_COMMUNES ; une commune revendiquée par deux zones va à celle
 * que retient COMMUNE_TO_ZONE (la dernière), comme le matching géographique.
 */
export function buildSectorSeed(tenant: SectorTenant): SectorSeedNode[] {
    const { region, sectors } = TENANT_TREES[tenant];
    const nodes: SectorSeedNode[] = [{ code: region.code, label: region.label, level: 'region', parentCode: null }];
    for (const { zone, label } of sectors) {
        nodes.push({ code: zone, label, level: 'sector', parentCode: region.code });
    }
    for (const { zone } of sectors) {
        for (const commune of ZONE_TO_COMMUNES[zone]) {
            if (COMMUNE_TO_ZONE.get(commune) !== zone) continue;
            nodes.push({ code: commune, label: communeLabel(commune), level: 'commune', parentCode: zone });
        }
    }
    return nodes;
}

/** Tables portant l'ancienne colonne `sector` (libellé) et la nouvelle `sector_id`. */
const SECTOR_ID_TABLES = ['companies', 'company_conflict', 'companies_blacklist'] as const;

async function countRows(dbQuery: QueryFn, sql: string, params: unknown[]): Promise<number> {
    const rows = await dbQuery<{ count: number }[]>(sql, params);
    return Number(rows[0]?.count ?? 0);
}

async function seedSectors(dbQuery: QueryFn, tenant: SectorTenant): Promise<void> {
    const existing = await dbQuery<{ id: number; code: string; level: SectorLevel }[]>(
        'SELECT id, code, level FROM sectors',
    );
    const ids = new Map(existing.map((r) => [`${r.level}:${r.code}`, r.id]));
    const parentLevel: Record<SectorLevel, SectorLevel | null> = { region: null, sector: 'region', commune: 'sector' };

    let inserted = 0;
    for (const node of buildSectorSeed(tenant)) {
        if (ids.has(`${node.level}:${node.code}`)) continue;
        const parentKey =
            parentLevel[node.level] && node.parentCode ? `${parentLevel[node.level]}:${node.parentCode}` : null;
        const parentId = parentKey ? (ids.get(parentKey) ?? null) : null;
        const result = await dbQuery<{ insertId: number }>(
            'INSERT INTO sectors (code, label, level, parent_id) VALUES (?, ?, ?, ?)',
            [node.code, node.label, node.level, parentId],
        );
        ids.set(`${node.level}:${node.code}`, Number(result.insertId));
        inserted++;
    }
    if (inserted > 0) logger.info({ tenant, inserted }, 'MySQL migration: seeded sectors referential');

    // Reprend le lieu de RDV existant, sans écraser une valeur déjà posée sur sectors.
    await dbQuery(
        "UPDATE sectors s JOIN sector_settings ss ON ss.sector = s.label SET s.location = ss.location WHERE s.level IN ('region', 'sector') AND s.location = ''",
    );
}

/**
 * Les colonnes libellé `sector` ne sont plus écrites : sans DEFAULT 'Nord-Est', une ligne
 * créée par l'application reste à NULL et le backfill ne lui invente pas de secteur.
 */
async function relaxLegacySectorColumns(dbQuery: QueryFn): Promise<void> {
    for (const table of ['companies', 'companies_blacklist'] as const) {
        const rows = await dbQuery<{ IS_NULLABLE: string }[]>(
            "SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'sector'",
            [table],
        );
        if (rows[0]?.IS_NULLABLE === 'NO') {
            // Identifiers come from the hardcoded list above, never from user input
            await dbQuery(`ALTER TABLE ${table} MODIFY COLUMN sector VARCHAR(255) NULL DEFAULT NULL`);
            logger.info(`MySQL migration: ${table}.sector is now nullable without default`);
        }
    }
}

async function ensureSectorIdConstraints(dbQuery: QueryFn): Promise<void> {
    for (const table of SECTOR_ID_TABLES) {
        const index = `idx_${table}_sector_id`;
        const fk = `fk_${table}_sector_id`;
        // Identifiers come from the hardcoded list above, never from user input
        const hasIndex = await countRows(
            dbQuery,
            'SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?',
            [table, index],
        );
        if (!hasIndex) {
            await dbQuery(`ALTER TABLE ${table} ADD KEY ${index} (sector_id)`);
        }
        const hasFk = await countRows(
            dbQuery,
            "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'",
            [table, fk],
        );
        if (!hasFk) {
            await dbQuery(
                `ALTER TABLE ${table} ADD CONSTRAINT ${fk} FOREIGN KEY (sector_id) REFERENCES sectors(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
            );
            logger.info(`MySQL migration: added ${table} FK ${fk}`);
        }
    }
}

async function backfillSectorId(dbQuery: QueryFn): Promise<void> {
    for (const table of SECTOR_ID_TABLES) {
        const updated = await dbQuery<{ affectedRows: number }>(
            `UPDATE ${table} t JOIN sectors s ON s.level = 'sector' AND s.label = TRIM(SUBSTRING_INDEX(t.sector, ',', 1)) SET t.sector_id = s.id WHERE t.sector_id IS NULL`,
        );
        if (Number(updated?.affectedRows) > 0) {
            logger.info(
                { table, rows: updated.affectedRows },
                'MySQL migration: backfilled sector_id from sector label',
            );
        }
        const orphans = await countRows(
            dbQuery,
            `SELECT COUNT(*) AS count FROM ${table} WHERE sector_id IS NULL AND sector IS NOT NULL`,
            [],
        );
        if (orphans > 0) logger.warn({ table, orphans }, 'MySQL migration: rows whose sector label matches no sector');
    }
}

/**
 * companies.sector (libellés séparés par « , ») → lignes company_sectors, sans
 * doublon, pour les seules entreprises encore sans liaison : les colonnes libellé ne sont
 * plus écrites par l'application, seuls des imports externes les renseignent encore.
 * FIND_IN_SET évite le parsing côté TS (aucun libellé ne contient de virgule).
 */
async function backfillCompanySectors(dbQuery: QueryFn): Promise<void> {
    const result = await dbQuery<{ affectedRows: number }>(
        "INSERT IGNORE INTO company_sectors (company_id, sector_id) SELECT c.id, s.id FROM companies c JOIN sectors s ON s.level = 'sector' AND FIND_IN_SET(s.label, REPLACE(c.sector, ', ', ',')) > 0 WHERE NOT EXISTS (SELECT 1 FROM company_sectors x WHERE x.company_id = c.id)",
    );
    if (Number(result?.affectedRows) > 0) {
        logger.info({ rows: result.affectedRows }, 'MySQL migration: backfilled company_sectors from companies.sector');
    }
}

/** users.sectors (json de libellés) → lignes user_sectors, pour les seuls users encore sans liaison. */
async function backfillUserSectors(dbQuery: QueryFn): Promise<void> {
    const sectors = await dbQuery<{ id: number; label: string }[]>(
        "SELECT id, label FROM sectors WHERE level IN ('region', 'sector')",
    );
    const idByLabel = new Map(sectors.map((s) => [s.label, s.id]));
    const users = await dbQuery<{ id: number; sectors: unknown }[]>(
        'SELECT id, sectors FROM users WHERE sectors IS NOT NULL AND NOT EXISTS (SELECT 1 FROM user_sectors us WHERE us.user_id = users.id)',
    );

    const pairs: [number, number][] = [];
    let unknown = 0;
    for (const user of users) {
        // Selon le driver, une colonne json arrive déjà parsée ou en chaîne.
        let labels: unknown = user.sectors;
        if (typeof labels === 'string') {
            try {
                labels = JSON.parse(labels);
            } catch {
                labels = [];
            }
        }
        if (!Array.isArray(labels)) continue;
        for (const label of labels) {
            const sectorId = typeof label === 'string' ? idByLabel.get(label) : undefined;
            if (sectorId === undefined) unknown++;
            else pairs.push([user.id, sectorId]);
        }
    }
    if (unknown > 0) logger.warn({ unknown }, 'MySQL migration: users.sectors labels matching no sector');
    if (pairs.length === 0) return;

    const result = await dbQuery<{ affectedRows: number }>(
        `INSERT IGNORE INTO user_sectors (user_id, sector_id) VALUES ${pairs.map(() => '(?, ?)').join(', ')}`,
        pairs.flat(),
    );
    if (Number(result?.affectedRows) > 0) {
        logger.info({ rows: result.affectedRows }, 'MySQL migration: backfilled user_sectors from users.sectors');
    }
}

/**
 * Référentiel hiérarchique des secteurs (région > secteur > commune), idempotent.
 * Suppose `sectors`, `user_sectors` et les colonnes `sector_id` déjà créées par
 * REQUIRED_TABLES / REQUIRED_COLUMNS, et `sector_settings` seedée.
 */
export async function migrateSectors(dbQuery: QueryFn, tenant: SectorTenant): Promise<void> {
    await relaxLegacySectorColumns(dbQuery);
    await seedSectors(dbQuery, tenant);
    await ensureSectorIdConstraints(dbQuery);
    await backfillSectorId(dbQuery);
    await backfillCompanySectors(dbQuery);
    await backfillUserSectors(dbQuery);
}
