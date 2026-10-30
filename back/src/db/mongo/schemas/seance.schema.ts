import mongoose, { Schema, model, Document } from 'mongoose';
import { Seance } from '../../../types/emargement.types';

const seanceSchema = new Schema<Seance & Document>(
    {
        _id: { type: String },
        session_id: { type: String, required: true },
        session_nom: { type: String, required: true },
        date: { type: String, required: true },
        start_time: { type: String, required: true },
        end_time: { type: String, required: true },
        site: { type: String, required: true },
        mode: { type: String, required: true },
        formateur_name: { type: String, required: true },
        formateur_email: { type: String, required: true },
        morning_start: { type: String, required: true },
        morning_end: { type: String, required: true },
        afternoon_start: { type: String, default: null },
        afternoon_end: { type: String, default: null },
        timezone: { type: String, required: true },
        token_secret: { type: String, required: true },
        invite_expires_at: { type: Date, required: true },
        signed_at: { type: Date, default: null },
        signed_by_name: { type: String, default: null },
        signature_image: { type: String, default: null },
        signed_ip: { type: String, default: null },
        signed_user_agent: { type: String, default: null },
        created_by: { type: Number, default: null },
        created_at: { type: Date },
        updated_at: { type: Date },
    },
    { collection: 'seances' },
);

seanceSchema.index({ date: -1 });
seanceSchema.index({ session_id: 1, date: -1 });

export const SeanceModel = mongoose.models.Seance || model<Seance & Document>('Seance', seanceSchema);
