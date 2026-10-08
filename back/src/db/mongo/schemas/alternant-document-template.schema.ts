import mongoose, { Schema, model, Document } from 'mongoose';
import { AlternantDocumentTemplate } from '../../../types/alternantDocumentTemplate.types';
import { AlternantSequenceType } from '../../../types/alternant.types';

const alternantDocumentTemplateSchema = new Schema<AlternantDocumentTemplate & Document>(
    {
        _id: { type: String, required: true },
        type: { type: String, enum: Object.values(AlternantSequenceType), required: true },
        label: { type: String, required: true },
        maitre_apprentissage: { type: String, default: '' },
        alternant: { type: String, default: '' },
        formateur: { type: String, default: '' },
        created_at: { type: Date, default: Date.now },
        updated_at: { type: Date, default: Date.now },
    },
    { collection: 'alternant_document_templates' },
);

// Résolution des 2 modèles système (J15/J10W) et listing des modèles périodiques.
alternantDocumentTemplateSchema.index({ type: 1 });

export const AlternantDocumentTemplateModel =
    mongoose.models.AlternantDocumentTemplate ||
    model<AlternantDocumentTemplate & Document>('AlternantDocumentTemplate', alternantDocumentTemplateSchema);
