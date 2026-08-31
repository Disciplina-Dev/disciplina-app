import mongoose, { Schema, model, Document } from 'mongoose';

/** Signature textuel du commercial, ajouté en fin de mail AB à signer (une par user). */
export interface CommercialSignature {
    _id: string; // `${user_id}`
    user_id: number;
    body: string;
    updated_at: Date;
}

const commercialSignatureSchema = new Schema<CommercialSignature & Document>(
    {
        _id: { type: String, required: true },
        user_id: { type: Number, required: true, index: true },
        body: { type: String, required: true },
        updated_at: { type: Date, default: Date.now },
    },
    { collection: 'commercial_signatures' },
);

export const CommercialSignatureModel =
    mongoose.models.CommercialSignature ||
    model<CommercialSignature & Document>('CommercialSignature', commercialSignatureSchema);
