import { Schema } from 'mongoose';
import { Position, TrainingDomain } from '../../../types/needsAnalysisNoSql.types';
import { Localisation } from '../../../types/matching.types';
import { TitleProfessionalType } from '../../../types/candidate.types';
import { criteriaSchema } from './matching.schema';

const positionTpSchemaDefinition = {
    tp_type: { type: String, enum: Object.values(TitleProfessionalType), default: null },
    missions: { type: [String], default: [] },
    description_missions: { type: [String], default: [] },
    other_missions: { type: String, default: null },
    other_description_missions: { type: String, default: null },
};

export const positionTpSchema = new Schema(positionTpSchemaDefinition, { _id: false });

export const positionSchemaDefinition = {
    localisation: { type: [String], enum: Object.values(Localisation), default: [] },
    desired_tp: { type: [positionTpSchema], default: [] },
    training_domain: { type: String, enum: Object.values(TrainingDomain), default: null },
    job_role: { type: String, default: null },
    title: { type: String },
    count: { type: Number, default: 1 },
    criteria: { type: criteriaSchema },
};

export const positionSchema = new Schema<Position>(positionSchemaDefinition, { _id: false });
