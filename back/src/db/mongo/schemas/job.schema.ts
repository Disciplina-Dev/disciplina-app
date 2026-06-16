import mongoose, { Schema, model, Document } from 'mongoose';
import { Job, JobStatus, DesiredSex, Localisation, MatchingCandidate, Sector } from '../../../types/job.types';
import { TitleProfessionalType } from '../../../types/candidate.types';

const matchingCandidateSchema = new Schema<MatchingCandidate>(
    {
        id: { type: String },
        full_name: { type: String },
        age: { type: Number },
        sex: { type: String },
        city: { type: String, enum: Object.values(Localisation) },
        email: { type: String },
        phone: { type: String },
    },
    { _id: false },
);

const jobSchema = new Schema<Job & Document>(
    {
        _id: { type: String },
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
    },
    { collection: 'jobs' },
);

export const JobModel = mongoose.models.Job || model<Job & Document>('Job', jobSchema);
