import { Schema } from 'mongoose';
import { Position, TrainingDomain } from '../../../types/needsAnalysisNoSql.types';
import { Localisation } from '../../../types/matching.types';
import { TitleProfessionalType } from '../../../types/candidate.types';
import { criteriaSchema } from './matching.schema';

export const positionSchemaDefinition = {
    localisation: { type: [String], enum: Object.values(Localisation), default: [] },
    tp_type: { type: String, enum: Object.values(TitleProfessionalType), default: null },
    training_domain: { type: String, enum: Object.values(TrainingDomain), default: null },
    job_role: { type: String, default: null },
    title: { type: String },
    missions: { type: [String], default: [] },
    description_missions: { type: [String], default: [] },
    other_description_missions: { type: String, default: null },
    other_missions: { type: String, default: null },
    criteria: { type: criteriaSchema },
};

export const positionSchema = new Schema<Position>(positionSchemaDefinition, { _id: false });
