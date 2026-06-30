import { SectorSettingsRepository, SectorSettingRow } from '../repositories/mysql/SectorSettingsRepository';
import { SECTORS, isSector } from '../utils/sector';

export class SectorSettingsService {
    private repo = new SectorSettingsRepository();

    /** Liste des lieux par secteur (complétée pour couvrir tous les secteurs canoniques). */
    async list(): Promise<SectorSettingRow[]> {
        const rows = await this.repo.findAll();
        const bySector = new Map(rows.map((r) => [r.sector, r.location]));
        return SECTORS.map((sector) => ({ sector, location: bySector.get(sector) ?? '' }));
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
