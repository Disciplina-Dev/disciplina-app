import mongoose, { Schema, model, Document } from 'mongoose';
import {
    NeedsAnalysis,
    CompanyInfos,
    Opco,
    ReferralSource,
    CompanyRegion,
    RecruitmentMethod,
    ImmersionPeriod,
    NeedsAnalysisStatus,
    AdministrationType,
} from '../../../types/needsAnalysisNoSql.types';
import { salerInfoSchema, referentsSchema } from './referents.schema';
import { positionSchema } from './position.schema';

const companyInfosSchema = new Schema<CompanyInfos>(
    {
        id: { type: Number },
        name: { type: String },
        ape: { type: String, default: null },
        idcc: { type: String, default: null },
        siret: { type: String },
        main_activity: { type: String, default: null },
        opco: { type: String, enum: Object.values(Opco), default: null },
        referral_source: { type: String, enum: Object.values(ReferralSource), default: null },
        sector: { type: String, enum: Object.values(CompanyRegion) },
        activities: { type: [String], default: [] },
        description: { type: String, default: null },
        postal_code: { type: String, default: null },
        commune: { type: String, default: null },
    },
    { _id: false },
);

const needsAnalysisSchema = new Schema<NeedsAnalysis & Document>(
    {
        _id: { type: String },
        company_infos: { type: companyInfosSchema },
        saler_info: { type: salerInfoSchema },
        referents: { type: referentsSchema },
        positions: { type: [positionSchema], default: [] },
        recruitment_method: { type: String, enum: Object.values(RecruitmentMethod) },
        immersion_period: { type: String, enum: Object.values(ImmersionPeriod) },
        training_days: { type: String },
        signature_request_id: { type: String, default: null },
        signature_sent_at: { type: Date, default: null },
        signature_url: { type: String, default: null },
        last_relance_at: { type: Date, default: null },
        is_relance_disabled: { type: Boolean, default: false },
        status: { type: String, enum: Object.values(NeedsAnalysisStatus), default: NeedsAnalysisStatus.BROUILLON },
        tags: { type: [String], default: [] },
        ab_status: { type: String, enum: ['ACTIVE', 'ARCHIVED', 'INACTIVE'], default: null },
        is_deleted: { type: Boolean, default: false },
        administration_type: { type: String, enum: Object.values(AdministrationType), default: AdministrationType.NON_RENSEIGNE },
        created_at: { type: Date },
        updated_at: { type: Date },
    },
    { collection: 'needs_analysis' },
);

export const NeedsAnalysisModel =
    mongoose.models.NeedsAnalysis || model<NeedsAnalysis & Document>('NeedsAnalysis', needsAnalysisSchema);
