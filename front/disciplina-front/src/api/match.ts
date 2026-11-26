import { apiFetch } from '@/api/httpClient'

// Choix UI de l'entreprise sur un candidat.
export type ProposedAnswer = 'REFUSED' | 'ACCEPTED' | 'FAVORITE';
// Statut de matching envoyé au backend (Accepter → entretien, Coup de cœur → immersion).
export type CompanyDecision = 'REFUSED' | 'INTERVIEW' | 'IMMERSING';

export const PROPOSED_ANSWER_TO_STATUS: Record<ProposedAnswer, CompanyDecision> = {
  REFUSED: 'REFUSED',
  ACCEPTED: 'INTERVIEW',
  FAVORITE: 'IMMERSING',
};

export interface ProposedCandidateView {
  id: string;
  fullName: string | null;
  age: number | null;
  sex: string | null;
  city: string | null;
  description: string;
  status: CompanyDecision | null;
}

export interface MatchCvFile {
  filename: string;
  contentType: string;
  content: string;
}

export interface SubmitAnswerPayload {
  candidateId: string;
  status: CompanyDecision;
  interviewSlots?: string[];
  interviewLocation?: string;
  comment?: string;
}

export interface MatchAddressCompletionResult {
  status: 'OK' | 'KO';
  results: string[];
}

async function expectOk(res: Response, context: string): Promise<Response> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `${context} (${res.status})`);
  }
  return res;
}

export class MatchAuthError extends Error {
  constructor() {
    super('Session expirée')
    this.name = 'MatchAuthError'
  }
}

export class MatchCompletedError extends Error {
  constructor() {
    super('Session déjà finalisée')
    this.name = 'MatchCompletedError'
  }
}

export async function getMatchCandidates(signature: string): Promise<ProposedCandidateView[]> {
  const res = await apiFetch(`/api/external/${signature}/match/candidates`)
  if (res.status === 401) throw new MatchAuthError()
  const ok = await expectOk(res, 'Chargement des candidats échoué')
  return (await ok.json()) as ProposedCandidateView[];
}

export async function getMatchCv(signature: string, candidateId: string): Promise<MatchCvFile> {
  const res = await expectOk(
    await apiFetch(`/api/external/${signature}/match/cv/${candidateId}`),
    'Chargement du CV échoué',
  );
  return (await res.json()) as MatchCvFile;
}

export async function getMatchAddressCompletion(
  signature: string,
  input: string,
): Promise<MatchAddressCompletionResult> {
  const res = await apiFetch(
    `/api/external/${signature}/match/completion?input=${encodeURIComponent(input)}`,
  );
  return (await res.json()) as MatchAddressCompletionResult;
}

export async function submitMatchAnswers(
  signature: string,
  answers: SubmitAnswerPayload[],
): Promise<void> {
  const res = await apiFetch(`/api/external/${signature}/match/answers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  })
  if (res.status === 409) throw new MatchCompletedError()
  await expectOk(res, 'Envoi des réponses échoué')
}