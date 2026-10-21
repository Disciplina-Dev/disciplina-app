import mongoose, { Schema, model, Document } from 'mongoose';
import { RUPTURE_MOTIFS, Rupture } from '../../../types/rupture.types';

const ruptureSchema = new Schema<Rupture & Document>(
    {
        _id: { type: String },
        alternant_id: { type: String, required: true, index: true },
        date_rupture: { type: Date, required: true, index: true },
        entreprise: { type: String, default: null },
        motif: { type: String, required: true, enum: [...RUPTURE_MOTIFS] },
        detail: { type: String, default: null },
        poursuit_formation: { type: Boolean, required: true },
        created_at: { type: Date },
        updated_at: { type: Date },
    },
    { collection: 'ruptures' },
);

export const RuptureModel = mongoose.models.Rupture || model<Rupture & Document>('Rupture', ruptureSchema);
