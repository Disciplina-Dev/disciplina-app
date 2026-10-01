import { SectorSettingsRepository, SectorSettingRow } from '../repositories/mysql/SectorSettingsRepository';
import { isSector, userSectorsForTenant } from '../utils/sector';
import { getRegion } from '../db/tenant';

export class SectorSettingsService {
    private repo = new SectorSettingsRepository();

    /** Lieux par secteur (couvre les secteurs canoniques du tenant courant). */
    async list(): Promise<SectorSettingRow[]> {
        const rows = await this.repo.findAll();
        const bySector = new Map(rows.map((r) => [r.sector, r.location]));
        // Annemasse est mono-secteur : ne présenter que « Annemasse », pas les
        // 3 zones Réunion (cf. AUDIT_MULTITENANT.md GEO-11).
        return userSectorsForTenant(getRegion()).map((sector) => ({
            sector,
            location: bySector.get(sector) ?? '',
        }));
    }

    /** Met à jour les lieux fournis. Ignore tout secteur non canonique. */
    async update(entries: { sector: string; location: string }[]): Promise<SectorSettingRow[]> {
        for (const { sector, location } of entries) {
            if (!isSector(sector)) continue;
            await this.repo.upsert(sector, String(location ?? '').slice(0, 255));
        }
        return this.list();
    }
}
