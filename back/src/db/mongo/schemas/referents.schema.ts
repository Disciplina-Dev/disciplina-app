import { Schema } from 'mongoose';
import { SalerInfo, ReferentDetails, Referents } from '../../../types/needsAnalysisNoSql.types';

export const salerInfoSchema = new Schema<SalerInfo>(
    {
        id: { type: Number },
        email: { type: String },
    },
    { _id: false },
);

export const referentDetailsSchema = new Schema<ReferentDetails>(
    {
        name: { type: String, default: null },
        phone: { type: String, default: null },
        email: { type: String, default: null },
        function: { type: String, default: null },
    },
    { _id: false },
);

export const referentsSchema = new Schema<Referents>(
    {
        is_same: { type: Boolean, default: false },
        legal_referents: { type: referentDetailsSchema },
        recruitment_referents: { type: referentDetailsSchema },
    },
    { _id: false },
);
