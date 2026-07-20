import mongoose, { Schema, model, Document } from 'mongoose';
import { MailTemplate, MailSignature, PEDA_LEVELS, MAIL_TEMPLATE_KINDS } from '../../../types/mailTemplate.types';

const attachmentSchema = new Schema(
    {
        filename: { type: String, required: true },
        contentType: { type: String, required: true },
        driveFileId: { type: String, required: true },
    },
    { _id: false },
);

const mailTemplateSchema = new Schema<MailTemplate & Document>(
    {
        _id: { type: String, required: true },
        user_id: { type: Number, required: true, index: true },
        scope: { type: String, enum: ['rh', 'commercial', 'peda'], required: true },
        name: { type: String, required: true },
        subject: { type: String, required: true },
        body: { type: String, required: true },
        peda_level: { type: String, enum: [...PEDA_LEVELS, null], default: null },
        kind: { type: String, enum: [...MAIL_TEMPLATE_KINDS, null], default: null },
        attachment: { type: attachmentSchema, default: null },
        created_at: { type: Date, default: Date.now },
        updated_at: { type: Date, default: Date.now },
    },
    { collection: 'mail_templates' },
);

mailTemplateSchema.index({ user_id: 1, scope: 1 });
// Résolution du modèle par niveau lors de la génération des brouillons Peda.
mailTemplateSchema.index({ scope: 1, peda_level: 1 });
// Résolution des modèles système (ex. mail d'invitation à signer l'AB).
mailTemplateSchema.index({ scope: 1, kind: 1 });

export const MailTemplateModel =
    mongoose.models.MailTemplate || model<MailTemplate & Document>('MailTemplate', mailTemplateSchema);

const mailSignatureSchema = new Schema<MailSignature & Document>(
    {
        _id: { type: String, required: true }, // `${user_id}:${scope}`
        user_id: { type: Number, required: true, index: true },
        scope: { type: String, enum: ['rh', 'commercial', 'peda'], required: true },
        driveFileId: { type: String, required: true },
        driveWebViewLink: { type: String, default: '' },
        filename: { type: String, default: '' },
        contentType: { type: String, required: true },
        updated_at: { type: Date, default: Date.now },
    },
    { collection: 'mail_signatures' },
);

export const MailSignatureModel =
    mongoose.models.MailSignature || model<MailSignature & Document>('MailSignature', mailSignatureSchema);
