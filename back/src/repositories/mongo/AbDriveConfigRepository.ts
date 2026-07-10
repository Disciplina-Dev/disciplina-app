import { AbDriveConfigModel, AB_DRIVE_CONFIG_ID } from '../../db/mongo/schemas/abDriveConfig.schema';

export interface AbDriveConfig {
    sectorFolders: Record<string, string>;
}

function toConfig(doc: any): AbDriveConfig {
    // sector_folders peut être une Map Mongoose ; normaliser en objet plat.
    const raw = doc?.sector_folders;
    const sectorFolders: Record<string, string> =
        raw instanceof Map ? Object.fromEntries(raw) : { ...(raw ?? {}) };
    return { sectorFolders };
}

export class AbDriveConfigRepository {
    async get(): Promise<AbDriveConfig> {
        const doc = await AbDriveConfigModel.findById(AB_DRIVE_CONFIG_ID).lean();
        return toConfig(doc);
    }

    async save(config: AbDriveConfig): Promise<AbDriveConfig> {
        const doc = await AbDriveConfigModel.findByIdAndUpdate(
            AB_DRIVE_CONFIG_ID,
            {
                _id: AB_DRIVE_CONFIG_ID,
                sector_folders: config.sectorFolders ?? {},
                updated_at: new Date(),
            },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        ).lean();
        return toConfig(doc);
    }
}
