import mongoose, { Schema, model, Document } from 'mongoose';
import { FormateurHistoryEntry } from '../../../types/formateur.types';

/**
 * Journal d'une fiche formateur : une ligne par événement (création,
 * modification, note), jamais modifiée ni supprimée. Alimente l'historique des
 * saisies de la fiche, notes du Peda comprises.
 */
const changeSchema = new Schema(
    {
        field: { type: String, required: true },
        from: { type: String, default: null },
        to: { type: String, default: null },
    },
    { _id: false },
);

const formateurHistorySchema = new Schema<FormateurHistoryEntry & Document>(
    {
        _id: { type: String },
        formateur_id: { type: String, required: true },
        action: { type: String, required: true },
        changes: { type: [changeSchema], default: [] },
        note: { type: String, default: null },
        actor_id: { type: Number, default: null },
        actor_name: { type: String, default: null },
        at: { type: Date, required: true },
    },
    { collection: 'formateur_history' },
);

formateurHistorySchema.index({ formateur_id: 1, at: -1 });

export const FormateurHistoryModel =
    mongoose.models.FormateurHistory ||
    model<FormateurHistoryEntry & Document>('FormateurHistory', formateurHistorySchema);
