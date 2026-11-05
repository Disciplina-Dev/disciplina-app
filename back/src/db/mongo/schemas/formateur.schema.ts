import mongoose, { Schema, model, Document } from 'mongoose';
import { Formateur } from '../../../types/formateur.types';

/**
 * Référentiel des formateurs : une fiche par intervenant, partagée par toutes
 * les séances. L'e-mail normalisé est unique : c'est lui qui rattache les
 * séances créées avant l'existence de l'annuaire.
 */
const formateurSchema = new Schema<Formateur & Document>(
    {
        _id: { type: String },
        name: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String, default: null },
        comment: { type: String, default: null },
        created_by: { type: Number, default: null },
        created_at: { type: Date },
        updated_at: { type: Date },
    },
    { collection: 'formateurs' },
);

formateurSchema.index({ email: 1 }, { unique: true });
formateurSchema.index({ name: 1 });

export const FormateurModel = mongoose.models.Formateur || model<Formateur & Document>('Formateur', formateurSchema);
