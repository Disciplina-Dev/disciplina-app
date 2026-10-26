import mongoose, { Schema, model, Document } from 'mongoose';
import { Alternant, AlternantCompany, AlternantFiliz } from '../../../types/alternant.types';

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

const filizSchema = new Schema<AlternantFiliz>(
    {
        folder_id: { type: String, required: true },
        class_id: { type: String, required: true },
        degree_id: { type: String, default: null },
        student_id: { type: String, default: null },
        step: { type: Number, required: true },
        start_step: { type: Number, default: null },
        company_siret: { type: String, default: null },
        updated_at: { type: Date, default: null },
        synced_at: { type: Date, required: true },
    },
    { _id: false },
);

const alternantSchema = new Schema<Alternant & Document>(
    {
        _id: { type: String },
        first_name: { type: String, required: true },
        last_name: { type: String, required: true },
        // Vide pour un alternant issu de Filiz : la session Disciplina n'a rien à voir avec la classe Filiz.
        session: { type: String, default: '' },
        session_id: { type: String, default: null, index: true },
        email: { type: String, default: null },
        phone: { type: String, default: null },
        candidate_id: { type: String, default: null },
        company: { type: companySchema, default: null },
        linked_alternant_ids: { type: [String], default: [] },
        filiz: { type: filizSchema, default: undefined },
        archived_at: { type: Date, default: null, index: true },
        archive_reason: { type: String, enum: ['rupture', 'fin_formation'], default: null },
        created_at: { type: Date },
        updated_at: { type: Date },
    },
    { collection: 'alternants' },
);

// Partiel plutôt que sparse : un alternant sans folder n'a pas de `filiz`, donc n'entre pas dans l'index.
alternantSchema.index(
    { 'filiz.folder_id': 1 },
    { unique: true, partialFilterExpression: { 'filiz.folder_id': { $type: 'string' } } },
);
alternantSchema.index({ 'filiz.class_id': 1 });
alternantSchema.index({ 'filiz.degree_id': 1 });

export const AlternantModel = mongoose.models.Alternant || model<Alternant & Document>('Alternant', alternantSchema);
