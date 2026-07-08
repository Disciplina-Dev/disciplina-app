import mongoose, { Schema, model, Document } from 'mongoose';
import {
    NeedsAnalysis,
    CompanyInfos,
    SalerInfo,
    ReferentDetails,
    Referents,
    OfferCriteria,
    Offer,
    Matching,
    CompanyRegion,
    Opco,
    ReferralSource,
    EducationLevel,
    TrainingDomain,
    RecruitmentMethod,
    ImmersionPeriod,
    NeedsAnalysisStatus,
} from '../../../types/needsAnalysisNoSql.types';
import {
    OfferStatus,
    Localisation,
    MatchingCandidate,
    MatchedCandidateStatus,
    ProposedCandidateAnswer,
    InterviewConclusion,
    ImmersionConclusion,
} from '../../../types/matching.types';
import { TitleProfessionalType } from '../../../types/candidate.types';

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
    },
    { _id: false },
);

const salerInfoSchema = new Schema<SalerInfo>(
    {
        id: { type: Number },
        email: { type: String },
    },
    { _id: false },
);

const referentDetailsSchema = new Schema<ReferentDetails>(
    {
        name: { type: String, default: null },
        phone: { type: String, default: null },
        email: { type: String, default: null },
        function: { type: String, default: null },
    },
    { _id: false },
);

const referentsSchema = new Schema<Referents>(
    {
        is_same: { type: Boolean, default: false },
        legal_referents: { type: referentDetailsSchema },
        recruitment_referents: { type: referentDetailsSchema },
    },
    { _id: false },
);

const criteriaSchema = new Schema<OfferCriteria>(
    {
        education_level: { type: String, enum: Object.values(EducationLevel), default: null },
        driving_license: { type: Boolean, default: false },
        experience_required: { type: Boolean, default: false },
        training_domain: { type: String, enum: Object.values(TrainingDomain), default: null },
        age_min: { type: Number, default: null },
        age_max: { type: Number, default: null },
        soft_skills: { type: String, default: null },
        schedule_options: { type: [String], default: [] },
        conditions: { type: String, default: null },
        additional_comments: { type: String, default: null },
    },
    { _id: false },
);

const matchingCandidateSchema = new Schema<MatchingCandidate>(
    {
        id: { type: String },
        full_name: { type: String },
        age: { type: Number },
        sex: { type: String },
        city: { type: String },
        email: { type: String },
        phone: { type: String },
        status: { type: String, enum: Object.values(MatchedCandidateStatus) },
        description: { type: String },
        cv_webview: { type: String },
        answer: { type: String, enum: Object.values(ProposedCandidateAnswer), default: null },
        comment: { type: String },
        interview_location: { type: String },
        booked_interview_slot: { type: String },
        interview_conclusion: { type: String, enum: Object.values(InterviewConclusion), default: null },
        immersion_start_date: { type: String },
        immersion_end_date: { type: String },
        immersion_location: { type: String },
        immersion_conclusion: { type: String, enum: Object.values(ImmersionConclusion), default: null },
    },
    { _id: false },
);

const matchingSchema = new Schema<Matching>(
    {
        status: { type: String, enum: Object.values(OfferStatus), default: OfferStatus.NOT_MATCHED },
        candidates: { type: [matchingCandidateSchema], default: [] },
        interview_slots: { type: [String], default: [] },
        interview_location: { type: String },
    },
    { _id: false },
);

const offerSchema = new Schema<Offer>(
    {
        id: { type: String },
        localisation: { type: [String], enum: Object.values(Localisation), default: [] },
        tp_type: { type: String, enum: Object.values(TitleProfessionalType), default: null },
        training_domain: { type: String, enum: Object.values(TrainingDomain), default: null },
        title: { type: String },
        missions: { type: [String], default: [] },
        description_missions: { type: [String], default: [] },
        other_description_missions: { type: String, default: null },
        other_missions: { type: String, default: null },
        matching: { type: matchingSchema, default: () => ({}) },
        criteria: { type: criteriaSchema },
    },
    { _id: false },
);

const needsAnalysisSchema = new Schema<NeedsAnalysis & Document>(
    {
        _id: { type: String },
        company_infos: { type: companyInfosSchema },
        saler_info: { type: salerInfoSchema },
        referents: { type: referentsSchema },
        offers: { type: [offerSchema], default: [] },
        recruitment_method: { type: String, enum: Object.values(RecruitmentMethod) },
        immersion_period: { type: String, enum: Object.values(ImmersionPeriod) },
        training_days: { type: String },
        signature_request_id: { type: String, default: null },
        status: { type: String, enum: Object.values(NeedsAnalysisStatus), default: NeedsAnalysisStatus.BROUILLON },
        created_at: { type: Date },
        updated_at: { type: Date },
    },
    { collection: 'needs_analysis' },
);

export const NeedsAnalysisModel =
    mongoose.models.NeedsAnalysis || model<NeedsAnalysis & Document>('NeedsAnalysis', needsAnalysisSchema);
