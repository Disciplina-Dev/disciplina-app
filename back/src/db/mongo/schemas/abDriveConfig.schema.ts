import mongoose, { Schema, model, Document } from 'mongoose';

/**
 * Configuration des dossiers Drive où sont archivées les Analyses du Besoin
 * (côté commercial), un couple de dossiers (signé / non signé) par secteur.
 * Document unique (singleton) identifié par AB_DRIVE_CONFIG_ID, éditable depuis
 * l'UI (panneau de config commercial).
 */
export const AB_DRIVE_CONFIG_ID = 'ab_drive_folders';

export interface AbDriveConfigDoc {
    _id: string;
    // Clé = `${SECTEUR}_${KIND}` (KIND = SIGNED | UNSIGNED), valeur = folder id Drive.
    sector_folders: Record<string, string>;
    updated_at: Date;
}

const abDriveConfigSchema = new Schema<AbDriveConfigDoc & Document>(
    {
        _id: { type: String, required: true },
        sector_folders: { type: Map, of: String, default: {} },
        updated_at: { type: Date, default: Date.now },
    },
    { collection: 'ab_drive_config' },
);

export const AbDriveConfigModel =
    mongoose.models.AbDriveConfig || model<AbDriveConfigDoc & Document>('AbDriveConfig', abDriveConfigSchema);
