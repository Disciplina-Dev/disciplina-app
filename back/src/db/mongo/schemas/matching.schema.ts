import { Schema } from 'mongoose';
import { OfferCriteria, EducationLevel, TrainingDomain, ScheduleSlot } from '../../../types/needsAnalysisNoSql.types';
import {
    Matching,
    MatchingCandidate,
    OfferStatus,
    MatchedCandidateStatus,
    InterviewConclusion,
    ImmersionConclusion,
} from '../../../types/matching.types';

const scheduleSlotSchema = new Schema<ScheduleSlot>(
    {
        day: { type: String, default: null },
        start_hour: { type: String, default: null },
        end_hour: { type: String, default: null },
    },
    { _id: false },
);

export const criteriaSchema = new Schema<OfferCriteria>(
    {
        education_level: { type: String, enum: Object.values(EducationLevel), default: null },
        driving_license: { type: Boolean, default: false },
        has_vehicle: { type: Boolean, default: false },
        experience_required: { type: Boolean, default: false },
        training_domain: { type: String, enum: Object.values(TrainingDomain), default: null },
        age_min: { type: Number, default: null },
        age_max: { type: Number, default: null },
        desired_sex: { type: String, default: null },
        soft_skills: { type: String, default: null },
        schedule_options: { type: [scheduleSlotSchema], default: [] },
        conditions: { type: String, default: null },
        additional_comments: { type: String, default: null },
    },
    { _id: false },
);

export const matchingCandidateSchema = new Schema<MatchingCandidate>(
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
        identity_description: { type: String },
        cv_webview: { type: String },
        has_cv: { type: Boolean },
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

export const matchingSchema = new Schema<Matching>(
    {
        status: { type: String, enum: Object.values(OfferStatus), default: OfferStatus.NOT_MATCHED },
        candidates: { type: [matchingCandidateSchema], default: [] },
        interview_slots: { type: [String], default: [] },
        interview_location: { type: String },
    },
    { _id: false },
);
