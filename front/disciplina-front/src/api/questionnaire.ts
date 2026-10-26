import { apiFetch, apiJson } from '@/api/httpClient'
import type {
  AnswerFeedback,
  AttemptDetail,
  AttemptListItem,
  AttemptStatus,
  Invitation,
  PublicAttemptState,
  Questionnaire,
  QuestionnaireStatus,
  QuestionnaireSummary,
} from '@/types/questionnaire'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

// ── Correcteur (staff) ──

export async function fetchQuestionnaires(): Promise<QuestionnaireSummary[]> {
  return (await apiJson<{ questionnaires: QuestionnaireSummary[] }>('/api/questionnaires')).questionnaires
}

export async function fetchActiveQuestionnaires(): Promise<QuestionnaireSummary[]> {
  return (await apiJson<{ questionnaires: QuestionnaireSummary[] }>('/api/questionnaires/active')).questionnaires
}

export async function fetchQuestionnaire(id: string): Promise<Questionnaire> {
  return (await apiJson<{ questionnaire: Questionnaire }>(`/api/questionnaires/${encodeURIComponent(id)}`)).questionnaire
}

export async function createQuestionnaire(body: unknown): Promise<Questionnaire> {
  return (
    await apiJson<{ questionnaire: Questionnaire }>('/api/questionnaires', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    })
  ).questionnaire
}

export async function updateQuestionnaire(id: string, body: unknown): Promise<Questionnaire> {
  return (
    await apiJson<{ questionnaire: Questionnaire }>(`/api/questionnaires/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    })
  ).questionnaire
}

export async function duplicateQuestionnaire(id: string): Promise<Questionnaire> {
  return (
    await apiJson<{ questionnaire: Questionnaire }>(`/api/questionnaires/${encodeURIComponent(id)}/duplicate`, {
      method: 'POST',
    })
  ).questionnaire
}

export async function setQuestionnaireStatus(id: string, status: QuestionnaireStatus): Promise<Questionnaire> {
  return (
    await apiJson<{ questionnaire: Questionnaire }>(`/api/questionnaires/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ status }),
    })
  ).questionnaire
}

export async function deleteQuestionnaire(id: string): Promise<void> {
  await apiJson(`/api/questionnaires/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function exportQuestionnaire(id: string): Promise<unknown> {
  return apiJson(`/api/questionnaires/${encodeURIComponent(id)}/export`)
}

export async function inviteCandidate(
  questionnaireId: string,
  candidateId: string,
  validityMinutes: number,
): Promise<Invitation> {
  return apiJson<Invitation>(`/api/questionnaires/${encodeURIComponent(questionnaireId)}/invitations`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ candidate_id: candidateId, validity_minutes: validityMinutes }),
  })
}

export async function startTestRun(questionnaireId: string): Promise<Invitation> {
  return apiJson<Invitation>(`/api/questionnaires/${encodeURIComponent(questionnaireId)}/test-run`, { method: 'POST' })
}

export interface AttemptFilters {
  questionnaireId?: string
  status?: AttemptStatus | ''
  passed?: 'true' | 'false' | ''
  from?: string
  to?: string
  includeTestRuns?: 'true' | ''
  page?: number
  pageSize?: number
}

export async function fetchAttempts(
  filters: AttemptFilters,
): Promise<{ items: AttemptListItem[]; total: number; page: number; page_size: number }> {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '') params.set(k, String(v))
  })
  return apiJson(`/api/questionnaires/attempts?${params.toString()}`)
}

export async function fetchCandidateAttempts(candidateId: string): Promise<AttemptListItem[]> {
  return (
    await apiJson<{ attempts: AttemptListItem[] }>(
      `/api/questionnaires/attempts/candidate/${encodeURIComponent(candidateId)}`,
    )
  ).attempts
}

export async function fetchAttempt(id: string): Promise<AttemptDetail> {
  return (await apiJson<{ attempt: AttemptDetail }>(`/api/questionnaires/attempts/${encodeURIComponent(id)}`)).attempt
}

export async function cancelAttempt(id: string): Promise<void> {
  await apiJson(`/api/questionnaires/attempts/${encodeURIComponent(id)}/cancel`, { method: 'POST' })
}

export async function resendAttemptPdf(id: string): Promise<void> {
  await apiJson(`/api/questionnaires/attempts/${encodeURIComponent(id)}/resend-pdf`, { method: 'POST' })
}

/** PDF des résultats généré à la volée (sans Google Drive). */
export async function fetchAttemptPdf(id: string): Promise<{ blob: Blob; fileName: string }> {
  const response = await apiFetch(`/api/questionnaires/attempts/${encodeURIComponent(id)}/pdf`)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(typeof body?.error === 'string' ? body.error : `Request failed (${response.status})`)
  }
  const match = /filename\*=UTF-8''([^;]+)/.exec(response.headers.get('Content-Disposition') ?? '')
  return { blob: await response.blob(), fileName: match ? decodeURIComponent(match[1]) : 'resultats-test.pdf' }
}

// ── Page candidat publique ──
// Pas d'apiFetch : aucun cookie/CSRF du CRM ne doit transiter. Seul le cookie
// d'appareil (httpOnly, path /api/q) est envoyé, d'où credentials: 'include'.

export class PublicTestError extends Error {
  code: string
  status: number
  constructor(status: number, code: string, message: string) {
    super(message)
    this.code = code
    this.status = status
  }
}

async function publicCall<T>(token: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/q/${encodeURIComponent(token)}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'include',
    headers: body === undefined ? undefined : JSON_HEADERS,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new PublicTestError(res.status, data?.code ?? 'error', typeof data?.error === 'string' ? data.error : 'Erreur')
  }
  return data as T
}

export function fetchPublicTest(token: string): Promise<PublicAttemptState> {
  return publicCall(token, '')
}

export function startPublicTest(token: string): Promise<PublicAttemptState> {
  return publicCall(token, '/start', { confirm_identity: true })
}

export function answerPublicTest(
  token: string,
  questionId: string,
  choiceIds: string[],
  skip = false,
  text?: string,
): Promise<{ feedback: AnswerFeedback | null; state: PublicAttemptState }> {
  return publicCall(token, '/answer', { question_id: questionId, choice_ids: choiceIds, text, skip })
}

export function reportTabSwitch(token: string): Promise<void> {
  return publicCall(token, '/visibility', {})
}
