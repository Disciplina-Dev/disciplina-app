import mongoose, { Schema, model, Document } from 'mongoose';
import { Session } from '../../../types/session.types';

const sessionSchema = new Schema<Session & Document>(
    {
        _id: { type: String },
        nom: { type: String, required: true, trim: true },
        filiere: { type: String, default: null },
        jour_cours: { type: String, default: null },
        date_debut: { type: Date, required: true },
        date_fin: { type: Date, required: true },
        created_at: { type: Date },
        updated_at: { type: Date },
    },
    { collection: 'sessions' },
);

sessionSchema.index({ nom: 1 });

export const SessionModel = mongoose.models.Session || model<Session & Document>('Session', sessionSchema);
