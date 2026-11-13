import mongoose, { Schema, model, Document } from 'mongoose';
import {
    Alternant,
    AlternantCompany,
    AlternantCompanyDefaillance,
    AlternantIncident,
    AlternantMentorChange,
} from '../../../types/alternant.types';

const companySchema = new Schema<AlternantCompany>(
    {
        name: { type: String, default: null },
        address: { type: String, default: null },
        mentor_name: { type: String, default: null },
        mentor_email: { type: String, default: null },
        start_date: { type: Date, required: true },
        end_date: { type: Date, default: null },
    },
    { _id: false },
);

const defaillanceSchema = new Schema<AlternantCompanyDefaillance>(
    {
        reason: { type: String, required: true },
        reported_at: { type: Date, required: true },
        reminder_sent_at: { type: Date, default: null },
        alert_sent_at: { type: Date, default: null },
        escalated_at: { type: Date, default: null },
        resolved_at: { type: Date, default: null },
    },
    { _id: false },
);

const mentorChangeSchema = new Schema<AlternantMentorChange>(
    {
        previous_mentor_name: { type: String, default: null },
        previous_mentor_email: { type: String, default: null },
        new_mentor_name: { type: String, default: null },
        new_mentor_email: { type: String, default: null },
        declared_at: { type: Date, required: true },
        avenant_signed_at: { type: Date, default: null },
        opco_declared_at: { type: Date, default: null },
    },
    { _id: false },
);

const incidentSchema = new Schema<AlternantIncident>(
    {
        description: { type: String, required: true },
        occurred_at: { type: Date, required: true },
        declared_at: { type: Date, required: true },
        declared_by_cfa: { type: Boolean, required: true },
        declaration_done_at: { type: Date, default: null },
        declaration_reminder_sent_at: { type: Date, default: null },
        analysis_done_at: { type: Date, default: null },
        analysis_reminder_sent_at: { type: Date, default: null },
        prevention_measures: { type: String, default: null },
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
        defaillance: { type: defaillanceSchema, default: null },
        mentor_changes: { type: [mentorChangeSchema], default: [] },
        incidents: { type: [incidentSchema], default: [] },
        archived_at: { type: Date, default: null, index: true },
        created_at: { type: Date },
        updated_at: { type: Date },
    },
    { collection: 'alternants' },
);

export const AlternantModel = mongoose.models.Alternant || model<Alternant & Document>('Alternant', alternantSchema);
