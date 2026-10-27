import mongoose, { Schema, model, Document } from 'mongoose';
import { FilizClassRef, FilizDegreeRef } from '../../../types/filizReference.types';

const filizDegreeSchema = new Schema<FilizDegreeRef & Document>(
    {
        _id: { type: String },
        degree_type: { type: String, default: '' },
        title: { type: String, default: '' },
        prepared_title: { type: String, default: '' },
        synced_at: { type: Date, required: true },
    },
    { collection: 'filiz_degrees' },
);

const filizClassSchema = new Schema<FilizClassRef & Document>(
    {
        _id: { type: String },
        degree_id: { type: String, required: true, index: true },
        name: { type: String, default: '' },
        start_date: { type: String, default: null },
        end_date: { type: String, default: null },
        apprenticeship_contract: { type: Boolean, default: false },
        professionalization_contract: { type: Boolean, default: false },
        synced_at: { type: Date, required: true },
    },
    { collection: 'filiz_classes' },
);

export const FilizDegreeModel =
    mongoose.models.FilizDegree || model<FilizDegreeRef & Document>('FilizDegree', filizDegreeSchema);
export const FilizClassModel =
    mongoose.models.FilizClass || model<FilizClassRef & Document>('FilizClass', filizClassSchema);
