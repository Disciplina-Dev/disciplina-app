import mongoose, { Schema, model, Document } from 'mongoose';
import { CandidateHistoryEntry, CandidateHistoryType } from '../../../types/candidate.types';

const candidateHistorySchema = new Schema<CandidateHistoryEntry & Document>(
    {
        _id: { type: String, required: true },
        candidate_id: { type: String, required: true, index: true },
        type: { type: String, enum: Object.values(CandidateHistoryType), required: true },
        description: { type: String, required: true },
        owner_email: { type: String, default: null },
        created_at: { type: Date, default: Date.now },
    },
    { collection: 'candidate_history' },
);

export const CandidateHistoryModel =
    mongoose.models.CandidateHistory ||
    model<CandidateHistoryEntry & Document>('CandidateHistory', candidateHistorySchema);
