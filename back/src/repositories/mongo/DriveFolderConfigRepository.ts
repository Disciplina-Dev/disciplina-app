import { DRIVE_FOLDER_CONFIG_ID } from '../../db/mongo/schemas/driveFolderConfig.schema';
import { getModels } from '../../db/mongo/tenant';

export interface DriveFolderConfig {
    rootFolderId: string | null;
    tpFolders: Record<string, string>;
}

function toConfig(doc: any): DriveFolderConfig {
    // tp_folders peut être une Map Mongoose ; normaliser en objet plat.
    const raw = doc?.tp_folders;
    const tpFolders: Record<string, string> =
        raw instanceof Map ? Object.fromEntries(raw) : { ...(raw ?? {}) };
    return {
        rootFolderId: doc?.root_folder_id ?? null,
        tpFolders,
    };
}

export class DriveFolderConfigRepository {
    async get(): Promise<DriveFolderConfig> {
        const doc = await getModels().DriveFolderConfig.findById(DRIVE_FOLDER_CONFIG_ID).lean();
        return toConfig(doc);
    }

    async save(config: DriveFolderConfig): Promise<DriveFolderConfig> {
        const doc = await getModels().DriveFolderConfig.findByIdAndUpdate(
            DRIVE_FOLDER_CONFIG_ID,
            {
                _id: DRIVE_FOLDER_CONFIG_ID,
                root_folder_id: config.rootFolderId ?? undefined,
                tp_folders: config.tpFolders ?? {},
                updated_at: new Date(),
            },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        ).lean();
        return toConfig(doc);
    }
}
