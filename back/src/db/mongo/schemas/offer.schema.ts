import mongoose, { Schema, model, Document } from 'mongoose';
import { Offer, OfferCompanyInfos, OfferHistoryEntry } from '../../../types/offer.types';
import { CompanyRegion } from '../../../types/needsAnalysisNoSql.types';
import { salerInfoSchema, referentsSchema } from './referents.schema';
import { matchingSchema } from './matching.schema';
import { positionSchemaDefinition } from './position.schema';

const offerCompanyInfosSchema = new Schema<OfferCompanyInfos>(
    {
        id: { type: Number },
        name: { type: String },
        sector: { type: String, enum: Object.values(CompanyRegion) },
        activities: { type: [String], default: [] },
    },
    { _id: false },
);

const offerSchema = new Schema<Offer & Document>(
    {
        _id: { type: String },
        needs_analysis_id: { type: String, required: true, index: true },
        company_infos: { type: offerCompanyInfosSchema },
        saler_info: { type: salerInfoSchema },
        referents: { type: referentsSchema },
        ...positionSchemaDefinition,
        matching: { type: matchingSchema, default: () => ({}) },
        created_at: { type: Date },
        updated_at: { type: Date },
    },
    { collection: 'offers' },
);

const offerHistorySchema = new Schema<OfferHistoryEntry & Document>(
    {
        _id: { type: String, required: true },
        offer_id: { type: String, required: true, index: true },
        first_name: { type: String, default: null },
        last_name: { type: String, default: null },
        text: { type: String, required: true },
        owner_email: { type: String, default: null },
        created_at: { type: Date, default: Date.now },
    },
    { collection: 'offer_history' },
);

export const OfferModel = mongoose.models.Offer || model<Offer & Document>('Offer', offerSchema);
export const OfferHistoryModel =
    mongoose.models.OfferHistory || model<OfferHistoryEntry & Document>('OfferHistory', offerHistorySchema);
