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

const filizPersonSchema = new Schema(
    {
        first_name: { type: String, default: '' },
        last_name: { type: String, default: '' },
        mail_address: { type: String, default: '' },
    },
    { _id: false },
);

const filizAddressSchema = new Schema(
    {
        housenumber: { type: String, default: '' },
        street: { type: String, default: '' },
        complement: { type: String, default: '' },
        city: { type: String, default: '' },
        postcode: { type: String, default: '' },
        country: { type: String, default: '' },
        formatted: { type: String, default: '' },
    },
    { _id: false },
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
        head_teacher: { type: filizPersonSchema, default: null },
        referent_teacher: { type: filizPersonSchema, default: null },
        realization_address: { type: filizAddressSchema, default: null },
        synced_at: { type: Date, required: true },
    },
    { collection: 'filiz_classes' },
);

export const FilizDegreeModel =
    mongoose.models.FilizDegree || model<FilizDegreeRef & Document>('FilizDegree', filizDegreeSchema);
export const FilizClassModel =
    mongoose.models.FilizClass || model<FilizClassRef & Document>('FilizClass', filizClassSchema);
