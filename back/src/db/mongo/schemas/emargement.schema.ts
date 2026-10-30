import mongoose, { Schema, model, Document } from 'mongoose';
import { EmargementRecord } from '../../../types/emargement.types';

const emargementSchema = new Schema<EmargementRecord & Document>(
    {
        _id: { type: String },
        seance_id: { type: String, required: true },
        alternant_id: { type: String, required: true },
        first_name: { type: String, required: true },
        last_name: { type: String, required: true },
        half: { type: String, required: true },
        status: { type: String, required: true },
        status_time: { type: String, default: null },
        signature_mode: { type: String, required: true },
        signature_image: { type: String, default: null },
        signed_at: { type: Date, required: true },
        first_signed_at: { type: Date, required: true },
        first_signature_mode: { type: String, required: true },
        ip: { type: String, default: null },
        user_agent: { type: String, default: null },
        created_at: { type: Date },
        updated_at: { type: Date },
    },
    { collection: 'emargements' },
);

// Un alternant n'a qu'une ligne par demi-journée : la saisie met à jour la
// ligne existante (elle ne s'empile pas), les colonnes `first_*` gardent la
// preuve de la première signature.
emargementSchema.index({ seance_id: 1, alternant_id: 1, half: 1 }, { unique: true });
emargementSchema.index({ seance_id: 1 });

export const EmargementModel =
    mongoose.models.Emargement || model<EmargementRecord & Document>('Emargement', emargementSchema);
