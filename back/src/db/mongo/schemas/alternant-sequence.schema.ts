import mongoose, { Schema, model, Document } from 'mongoose';
import {
    AlternantSequence,
    AlternantSequenceContacts,
    AlternantSequenceDocument,
    AlternantSequenceStatus,
    AlternantSequenceType,
} from '../../../types/alternant.types';

const contactsSchema = new Schema<AlternantSequenceContacts>(
    {
        mentor: { type: Boolean, default: false },
        alternant: { type: Boolean, default: false },
        formateur: { type: Boolean, default: false },
    },
    { _id: false },
);

const documentSchema = new Schema<AlternantSequenceDocument>(
    {
        maitre_apprentissage: { type: String, default: null },
        alternant: { type: String, default: null },
        formateur: { type: String, default: null },
        signature_maitre_apprentissage: { type: String, default: null },
        signature_alternant: { type: String, default: null },
        signature_formateur: { type: String, default: null },
    },
    { _id: false },
);

const alternantSequenceSchema = new Schema<AlternantSequence & Document>(
    {
        _id: { type: String },
        alternant_id: { type: String, required: true, index: true },
        numero: { type: Number, required: true },
        // Pas de `required: true` : les séquences créées avant #888 n'ont pas ce
        // champ et les lectures passent par `.lean()` (les `default:` Mongoose ne
        // s'appliquent jamais à un document existant relu ainsi) — la résolution
        // du type legacy se fait au mapper (`inferLegacyType`), pas ici.
        type: { type: String, enum: Object.values(AlternantSequenceType) },
        prevue_le: { type: Date, required: true },
        status: {
            type: String,
            enum: Object.values(AlternantSequenceStatus),
            default: AlternantSequenceStatus.PENDING,
        },
        realisee_le: { type: Date, default: null },
        contacts: { type: contactsSchema, default: () => ({}) },
        auto_generated: { type: Boolean, default: false },
        document: { type: documentSchema, default: null },
        archived_at: { type: Date, default: null, index: true },
        created_at: { type: Date },
        updated_at: { type: Date },
    },
    { collection: 'alternant_sequences' },
);

export const AlternantSequenceModel =
    mongoose.models.AlternantSequence ||
    model<AlternantSequence & Document>('AlternantSequence', alternantSequenceSchema);
