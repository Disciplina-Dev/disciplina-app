import mongoose, { Schema, model, Document } from 'mongoose';
import { Alternant, AlternantCompany } from '../../../types/alternant.types';

const companySchema = new Schema<AlternantCompany>(
    {
        name: { type: String, default: null },
        address: { type: String, default: null },
        mentor_name: { type: String, default: null },
        start_date: { type: Date, required: true },
        end_date: { type: Date, default: null },
    },
    { _id: false },
);

const alternantSchema = new Schema<Alternant & Document>(
    {
        _id: { type: String },
        first_name: { type: String, required: true },
        last_name: { type: String, required: true },
        session: { type: String, required: true },
        session_id: { type: String, default: null, index: true },
        email: { type: String, default: null },
        phone: { type: String, default: null },
        candidate_id: { type: String, default: null },
        company: { type: companySchema, default: null },
        linked_alternant_ids: { type: [String], default: [] },
        created_at: { type: Date },
        updated_at: { type: Date },
    },
    { collection: 'alternants' },
);

export const AlternantModel = mongoose.models.Alternant || model<Alternant & Document>('Alternant', alternantSchema);
