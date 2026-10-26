// Questionnaires internes (remplacement de ClassMarker, cf. audit/README.md).
// Documents Mongo : snake_case, miroir du document (comme candidate.types.ts).

// `text` : réponse libre tapée par le candidat, comparée aux `accepted_answers`.
export type QuestionType = 'single' | 'multiple' | 'true_false' | 'text';
export type QuestionnaireStatus = 'draft' | 'active' | 'archived';
export type AttemptStatus = 'invited' | 'in_progress' | 'completed' | 'expired' | 'cancelled';

export interface QuestionnaireChoice {
    _id: string;
    text: string;
    correct: boolean;
}

export interface QuestionnaireQuestion {
    _id: string;
    type: QuestionType;
    text: string;
    points: number;
    // Vide pour une question `text`.
    choices: QuestionnaireChoice[];
    // Question `text` uniquement : réponses acceptées (casse, espaces et ponctuation finale ignorés).
    accepted_answers?: string[];
}

export interface Questionnaire {
    _id: string;
    title: string;
    description?: string;
    tp_types: string[];
    duration_minutes: number;
    pass_threshold: number;
    immediate_feedback: boolean;
    allow_skip: boolean;
    shuffle_choices: boolean;
    questions: QuestionnaireQuestion[];
    status: QuestionnaireStatus;
    version: number;
    // true dès le 1er passage réel : plus modifiable, il faut dupliquer (anciens scores jamais faussés).
    locked: boolean;
    created_by?: number;
    created_at?: Date;
    updated_at?: Date;
}

export interface AttemptAnswer {
    question_id: string;
    choice_ids: string[];
    // Question `text` : réponse tapée par le candidat.
    text_answer?: string;
    skipped: boolean;
    correct: boolean;
    points: number;
    answered_at: Date;
}

export interface AttemptScore {
    percentage: number;
    points_scored: number;
    points_available: number;
    passed: boolean;
}

export interface QuestionnaireAttempt {
    _id: string;
    questionnaire_id: string;
    questionnaire_version: number;
    // Absent pour un passage « Tester le questionnaire » (is_test_run).
    candidate_id?: string;
    invited_by?: number;
    token_hash: string;
    expires_at: Date;
    // Posé uniquement tant que l'invitation n'est pas commencée : index TTL de purge.
    purge_at?: Date;
    status: AttemptStatus;
    started_at?: Date;
    deadline?: Date;
    completed_at?: Date;
    current_index: number;
    // Ordre des choix par question, figé au démarrage (shuffle_choices).
    choice_order?: Record<string, string[]>;
    device_hash?: string;
    tab_switch_count: number;
    is_test_run: boolean;
    identity_confirmed: boolean;
    answers: AttemptAnswer[];
    score?: AttemptScore;
    created_at?: Date;
    updated_at?: Date;
}
