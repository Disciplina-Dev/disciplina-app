import mongoose, { Schema, model, Document } from 'mongoose';
import {
    Questionnaire,
    QuestionnaireAttempt,
    QuestionnaireChoice,
    QuestionnaireQuestion,
    AttemptAnswer,
    AttemptScore,
} from '../../../types/questionnaire.types';

const choiceSchema = new Schema<QuestionnaireChoice>(
    {
        _id: { type: String, required: true },
        text: { type: String, required: true },
        correct: { type: Boolean, required: true },
    },
    { _id: false },
);

const questionSchema = new Schema<QuestionnaireQuestion>(
    {
        _id: { type: String, required: true },
        type: { type: String, enum: ['single', 'multiple', 'true_false', 'text'], required: true },
        text: { type: String, required: true },
        points: { type: Number, required: true, default: 1 },
        choices: { type: [choiceSchema], default: [] },
        accepted_answers: { type: [String], default: undefined },
    },
    { _id: false },
);

const questionnaireSchema = new Schema<Questionnaire & Document>(
    {
        _id: { type: String, required: true },
        title: { type: String, required: true },
        description: { type: String },
        tp_types: { type: [String], default: [] },
        duration_minutes: { type: Number, required: true },
        pass_threshold: { type: Number, required: true, default: 50 },
        immediate_feedback: { type: Boolean, default: false },
        allow_skip: { type: Boolean, default: false },
        shuffle_choices: { type: Boolean, default: false },
        questions: { type: [questionSchema], default: [] },
        status: { type: String, enum: ['draft', 'active', 'archived'], default: 'draft', index: true },
        version: { type: Number, default: 1 },
        locked: { type: Boolean, default: false },
        created_by: { type: Number },
    },
    { collection: 'questionnaires', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

const answerSchema = new Schema<AttemptAnswer>(
    {
        question_id: { type: String, required: true },
        choice_ids: { type: [String], default: [] },
        text_answer: { type: String },
        skipped: { type: Boolean, default: false },
        correct: { type: Boolean, required: true },
        points: { type: Number, required: true },
        answered_at: { type: Date, required: true },
    },
    { _id: false },
);

const scoreSchema = new Schema<AttemptScore>(
    {
        percentage: { type: Number, required: true },
        points_scored: { type: Number, required: true },
        points_available: { type: Number, required: true },
        passed: { type: Boolean, required: true },
    },
    { _id: false },
);

const attemptSchema = new Schema<QuestionnaireAttempt & Document>(
    {
        _id: { type: String, required: true },
        questionnaire_id: { type: String, required: true },
        questionnaire_version: { type: Number, required: true },
        candidate_id: { type: String },
        invited_by: { type: Number },
        token_hash: { type: String, required: true, unique: true },
        expires_at: { type: Date, required: true },
        purge_at: { type: Date },
        status: {
            type: String,
            enum: ['invited', 'in_progress', 'completed', 'expired', 'cancelled'],
            default: 'invited',
        },
        started_at: { type: Date },
        deadline: { type: Date },
        completed_at: { type: Date },
        current_index: { type: Number, default: 0 },
        choice_order: { type: Schema.Types.Mixed },
        device_hash: { type: String },
        tab_switch_count: { type: Number, default: 0 },
        is_test_run: { type: Boolean, default: false },
        identity_confirmed: { type: Boolean, default: false },
        answers: { type: [answerSchema], default: [] },
        score: { type: scoreSchema },
    },
    {
        collection: 'questionnaire_attempts',
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    },
);

// Liste correcteur (filtre questionnaire + tri date) et suivi fiche candidat.
attemptSchema.index({ questionnaire_id: 1, created_at: -1 });
attemptSchema.index({ candidate_id: 1, created_at: -1 });
attemptSchema.index({ status: 1, created_at: -1 });
// RGPD : invitation jamais commencée = purgée à expiration (aucune réponse dedans).
// `purge_at` est retiré au démarrage, donc une tentative commencée n'est jamais purgée.
attemptSchema.index({ purge_at: 1 }, { expireAfterSeconds: 0 });

export const QuestionnaireModel =
    mongoose.models.Questionnaire || model<Questionnaire & Document>('Questionnaire', questionnaireSchema);

export const QuestionnaireAttemptModel =
    mongoose.models.QuestionnaireAttempt ||
    model<QuestionnaireAttempt & Document>('QuestionnaireAttempt', attemptSchema);
