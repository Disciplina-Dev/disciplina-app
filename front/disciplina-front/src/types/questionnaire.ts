// `text` : réponse libre tapée par le candidat, comparée aux `accepted_answers`.
export type QuestionType = 'single' | 'multiple' | 'true_false' | 'text'
export type QuestionnaireStatus = 'draft' | 'active' | 'archived'
export type AttemptStatus = 'invited' | 'in_progress' | 'completed' | 'expired' | 'cancelled'

export interface QuestionnaireChoice {
  _id: string
  text: string
  correct: boolean
}

export interface QuestionnaireQuestion {
  _id: string
  type: QuestionType
  text: string
  points: number
  choices: QuestionnaireChoice[]
  accepted_answers?: string[]
}

export interface Questionnaire {
  _id: string
  title: string
  description?: string
  tp_types: string[]
  duration_minutes: number
  pass_threshold: number
  immediate_feedback: boolean
  allow_skip: boolean
  shuffle_choices: boolean
  questions: QuestionnaireQuestion[]
  status: QuestionnaireStatus
  version: number
  locked: boolean
  created_at?: string
  updated_at?: string
}

export type QuestionnaireSummary = Omit<Questionnaire, 'questions'> & {
  question_count: number
  attempt_count?: number
}

export interface AttemptScore {
  percentage: number
  points_scored: number
  points_available: number
  passed: boolean
}

export interface AttemptListItem {
  _id: string
  questionnaire_id: string
  questionnaire_title: string
  question_count: number
  candidate_id: string | null
  candidate_name: string | null
  status: AttemptStatus
  is_test_run: boolean
  created_at: string
  expires_at: string
  started_at: string | null
  deadline: string | null
  completed_at: string | null
  current_index: number
  tab_switch_count: number
  score: AttemptScore | null
}

export interface AttemptDetail {
  _id: string
  status: AttemptStatus
  candidate_id?: string
  candidate_name: string | null
  is_test_run: boolean
  created_at: string
  started_at?: string
  completed_at?: string
  deadline?: string
  tab_switch_count: number
  score?: AttemptScore
  questionnaire: { _id: string; title: string; pass_threshold: number; version: number }
  questions: Array<{
    id: string
    type: QuestionType
    text: string
    points_available: number
    choices: Array<{ id: string; text: string; correct: boolean }>
    correct_choice_ids: string[]
    accepted_answers: string[]
    answer: {
      choice_ids: string[]
      text_answer: string | null
      skipped: boolean
      correct: boolean
      points: number
      answered_at: string
      time_spent_seconds: number | null
    } | null
  }>
}

export interface Invitation {
  attempt_id: string
  url: string
  expires_at: string
}

/** Progression poussée en SSE sur la fiche candidat. */
export interface QuestionnaireProgress {
  attempt_id: string
  questionnaire_id: string
  title: string
  status: AttemptStatus
  current_index: number
  total: number
  deadline: string | null
  expires_at: string
}

// ── Page candidat publique ──

export interface PublicQuestion {
  id: string
  type: QuestionType
  text: string
  points: number
  choices: Array<{ id: string; text: string }>
}

export interface PublicAttemptState {
  status: AttemptStatus
  title: string
  description: string | null
  duration_minutes: number
  question_count: number
  allow_skip: boolean
  immediate_feedback: boolean
  is_test_run: boolean
  server_now: string
  expires_at: string
  candidate?: { full_name: string; email_masked: string | null } | null
  deadline?: string
  current_index?: number
  question?: PublicQuestion | null
  percentage?: number
}

export interface AnswerFeedback {
  correct: boolean
  correct_choice_ids: string[]
  accepted_answers?: string[]
}
