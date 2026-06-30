import { query } from '../../db/mysql/connection';

export interface SectorSettingRow {
    sector: string;
    location: string;
}

export class SectorSettingsRepository {
    /** Tous les lieux de RDV par secteur, ordonnés par secteur. */
    async findAll(): Promise<SectorSettingRow[]> {
        return query<SectorSettingRow[]>(
            'SELECT sector, location FROM sector_settings ORDER BY sector',
        );
    }

    /** Crée/écrase le lieu d'un secteur (upsert sur la clé primaire `sector`). */
    async upsert(sector: string, location: string): Promise<void> {
        await query(
            'INSERT INTO sector_settings (sector, location) VALUES (?, ?) ' +
                'ON DUPLICATE KEY UPDATE location = VALUES(location)',
            [sector, location],
        );
    }
}
