import mongoose, { Schema, model, Document } from 'mongoose';
import { EmargementHistoryEntry } from '../../../types/emargement.types';

/**
 * Journal d'une feuille d'émargement : une ligne par événement, jamais modifiée
 * ni supprimée tant que la séance existe. Contrairement à `emargements` (une
 * ligne par alternant × demi-journée, écrasée à chaque correction), cette
 * collection garde l'historique complet des changements de statut, signatures et
 * validations.
 */
const emargementHistorySchema = new Schema<EmargementHistoryEntry & Document>(
    {
        _id: { type: String },
        seance_id: { type: String, required: true },
        alternant_id: { type: String, default: null },
        alternant_name: { type: String, default: null },
        half: { type: String, default: null },
        action: { type: String, required: true },
        from_status: { type: String, default: null },
        to_status: { type: String, default: null },
        from_status_time: { type: String, default: null },
        to_status_time: { type: String, default: null },
        source: { type: String, required: true },
        actor_name: { type: String, default: null },
        note: { type: String, default: null },
        ip: { type: String, default: null },
        user_agent: { type: String, default: null },
        at: { type: Date, required: true },
    },
    { collection: 'emargement_history' },
);

// Le détail d'une séance lit son journal du plus récent au plus ancien ; la
// suppression d'une séance purge le journal par le même index.
emargementHistorySchema.index({ seance_id: 1, at: -1 });

export const EmargementHistoryModel =
    mongoose.models.EmargementHistory ||
    model<EmargementHistoryEntry & Document>('EmargementHistory', emargementHistorySchema);
