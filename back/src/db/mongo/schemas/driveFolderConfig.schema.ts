import mongoose, { Schema, model, Document } from 'mongoose';

/**
 * Configuration des dossiers Drive parents par Titre Professionnel.
 * Document unique (singleton) identifié par CONFIG_ID, éditable depuis l'UI
 * (panneau de config RH) au lieu des variables d'environnement.
 */
export const DRIVE_FOLDER_CONFIG_ID = 'drive_folders';

export interface DriveFolderConfigDoc {
    _id: string;
    root_folder_id?: string;
    // Clé = TitleProfessionalType (AD, CC, NTC, REM, SA), valeur = folder id Drive.
    tp_folders: Record<string, string>;
    updated_at: Date;
}

const driveFolderConfigSchema = new Schema<DriveFolderConfigDoc & Document>(
    {
        _id: { type: String, required: true },
        root_folder_id: { type: String },
        tp_folders: { type: Map, of: String, default: {} },
        updated_at: { type: Date, default: Date.now },
    },
    { collection: 'drive_folder_config' },
);

export const DriveFolderConfigModel =
    mongoose.models.DriveFolderConfig ||
    model<DriveFolderConfigDoc & Document>('DriveFolderConfig', driveFolderConfigSchema);
