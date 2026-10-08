import mongoose, { Schema, model, Document } from 'mongoose';
import { AlternantSequence, AlternantSequenceContacts, AlternantSequenceStatus } from '../../../types/alternant.types';

const contactsSchema = new Schema<AlternantSequenceContacts>(
    {
        mentor: { type: Boolean, default: false },
        alternant: { type: Boolean, default: false },
        formateur: { type: Boolean, default: false },
    },
    { _id: false },
);

const alternantSequenceSchema = new Schema<AlternantSequence & Document>(
    {
        _id: { type: String },
        alternant_id: { type: String, required: true, index: true },
        numero: { type: Number, required: true },
        prevue_le: { type: Date, required: true },
        status: {
            type: String,
            enum: Object.values(AlternantSequenceStatus),
            default: AlternantSequenceStatus.PENDING,
        },
        realisee_le: { type: Date, default: null },
        contacts: { type: contactsSchema, default: () => ({}) },
        auto_generated: { type: Boolean, default: false },
        // Horodatages d'envoi des notifs « SA en cours » / « SA en retard » :
        // évitent de re-notifier chaque jour une fois l'échéance atteinte (dédup scheduler).
        soon_notified_at: { type: Date, default: null },
        late_notified_at: { type: Date, default: null },
        archived_at: { type: Date, default: null, index: true },
        created_at: { type: Date },
        updated_at: { type: Date },
    },
    { collection: 'alternant_sequences' },
);

export const AlternantSequenceModel =
    mongoose.models.AlternantSequence ||
    model<AlternantSequence & Document>('AlternantSequence', alternantSequenceSchema);
