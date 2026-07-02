import mongoose, { Schema, model, Document } from 'mongoose';
import {
    Job,
    JobStatus,
    DesiredSex,
    InterviewConclusion,
    ImmersionConclusion,
    Localisation,
    MatchedCandidateStatus,
    MatchingCandidate,
    ProposedCandidate,
    ProposedCandidateAnswer,
    Sector,
} from '../../../types/job.types';
import { TitleProfessionalType } from '../../../types/candidate.types';

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
    },
    { _id: false },
);

const proposedCandidateSchema = new Schema<ProposedCandidate>(
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
        immersion_conclusion: { type: String, enum: Object.values(ImmersionConclusion), default: null },
    },
    { _id: false },
);

const jobSchema = new Schema<Job & Document>(
    {
        _id: { type: String },
        needs_analysis_id: { type: Number },
        company_name: { type: String },
        age_range: { type: String },
        desired_tp: { type: String, enum: Object.values(TitleProfessionalType) },
        desired_sex: { type: String, enum: Object.values(DesiredSex) },
        driving_license_b: { type: Boolean },
        professional_experience: { type: Boolean },
        sector: { type: String, enum: Object.values(Sector) },
        status: { type: String, enum: Object.values(JobStatus) },
        localisation: { type: [String], enum: Object.values(Localisation) },
        matched_candidate: { type: [matchingCandidateSchema] },
        proposed_candidate: { type: [proposedCandidateSchema] },
        interview_slots: { type: [String] },
        interview_location: { type: String },
    },
    { collection: 'jobs' },
);

export const JobModel = mongoose.models.Job || model<Job & Document>('Job', jobSchema);
