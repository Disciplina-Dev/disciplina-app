import { query } from '../../db/mysql/connection';

export interface SectorSettingRow {
    sector: string;
    location: string;
}

// Lieu de RDV porté par `sectors.location` (région ou secteur, jamais les communes) ;
// `sector` reste le libellé historique exposé par l'API.
export class SectorSettingsRepository {
    /** Tous les lieux de RDV par secteur, ordonnés par libellé. */
    async findAll(): Promise<SectorSettingRow[]> {
        return query<SectorSettingRow[]>(
            "SELECT label AS sector, location FROM sectors WHERE level IN ('region', 'sector') ORDER BY label",
        );
    }

    /** Écrase le lieu d'un secteur existant (identifié par son libellé). */
    async upsert(sector: string, location: string): Promise<void> {
        await query("UPDATE sectors SET location = ? WHERE level IN ('region', 'sector') AND label = ?", [
            location,
            sector,
        ]);
    }
}
