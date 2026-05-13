import { Schema, model, Document } from 'mongoose';
import { Job, JobStatus, DesiredSex, Localisation, MatchingCandidate } from '../../../types/job.types';
import { TitleProfessionalType } from '../../../types/candidate.types';

const matchingCandidateSchema = new Schema<MatchingCandidate>(
    {
        full_name: { type: String },
        age: { type: Number },
        sex: { type: Boolean },
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
        status: { type: String, enum: Object.values(JobStatus) },
        localisation: { type: [String], enum: Object.values(Localisation) },
        matched: { type: Boolean },
        matched_candidate: { type: [matchingCandidateSchema] },
    },
    { collection: 'jobs' },
);

export const JobModel = model<Job & Document>('Job', jobSchema);
