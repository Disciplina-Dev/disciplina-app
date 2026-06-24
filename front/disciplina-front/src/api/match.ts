const API_BASE = import.meta.env.VITE_API_URL;

export type MatchStatus = 'PENDING' | 'AUTHENTICATED' | 'COMPLETED' | 'LOCKED' | 'EXPIRED';
export type ProposedAnswer = 'REFUSED' | 'ACCEPTED' | 'FAVORITE';

export interface MatchInspectResult {
  exists: boolean;
  expired: boolean;
  status: MatchStatus | null;
}

export type AuthenticateMatchResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'invalid' | 'locked' | 'expired'; remaining?: number };

export interface ProposedCandidateView {
  id: string;
  fullName: string | null;
  age: number | null;
  sex: string | null;
  city: string | null;
  description: string;
  answer: ProposedAnswer | null;
}

export interface MatchCvFile {
  filename: string;
  contentType: string;
  content: string;
}

export interface SubmitAnswerPayload {
  candidateId: string;
  answer: ProposedAnswer;
  interviewSlots?: string[];
  interviewLocation?: string;
  comment?: string;
}

export interface MatchAddressCompletionResult {
  status: 'OK' | 'KO';
  results: string[];
}

async function matchFetch(path: string, init?: RequestInit, token?: string): Promise<Response> {
  return fetch(`${API_BASE}/api/match${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

async function expectOk(res: Response, context: string): Promise<Response> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `${context} (${res.status})`);
  }
  return res;
}

export async function inspectMatch(signature: string): Promise<MatchInspectResult> {
  const res = await expectOk(await matchFetch(`/${signature}/inspect`), 'Vérification du lien échouée');
  return (await res.json()) as MatchInspectResult;
}

export async function regenerateMatch(signature: string): Promise<void> {
  await expectOk(await matchFetch(`/${signature}/regenerate`, { method: 'POST' }), 'Régénération du lien échouée');
}

export async function authenticateMatch(
  signature: string,
  code: string,
  identifier: string,
): Promise<AuthenticateMatchResult> {
  const res = await matchFetch(`/${signature}/authenticate`, {
    method: 'POST',
    body: JSON.stringify({ code, identifier }),
  });
  if (res.ok) {
    const body = (await res.json()) as { token: string };
    return { ok: true, token: body.token };
  }
  if (res.status === 401) {
    const body = (await res.json().catch(() => ({}))) as { reason: 'invalid' | 'locked' | 'expired'; remaining?: number };
    return { ok: false, reason: body.reason, remaining: body.remaining };
  }
  throw new Error(`Authentification échouée (${res.status})`);
}

export async function getMatchCandidates(signature: string, token: string): Promise<ProposedCandidateView[]> {
  const res = await expectOk(
    await matchFetch(`/${signature}/candidates`, undefined, token),
    'Chargement des candidats échoué',
  );
  return (await res.json()) as ProposedCandidateView[];
}

export async function getMatchCv(signature: string, candidateId: string, token: string): Promise<MatchCvFile> {
  const res = await expectOk(
    await matchFetch(`/${signature}/cv/${candidateId}`, undefined, token),
    'Chargement du CV échoué',
  );
  return (await res.json()) as MatchCvFile;
}

export async function getMatchAddressCompletion(
  signature: string,
  token: string,
  input: string,
): Promise<MatchAddressCompletionResult> {
  const res = await matchFetch(
    `/${signature}/completion?input=${encodeURIComponent(input)}`,
    undefined,
    token,
  );
  return (await res.json()) as MatchAddressCompletionResult;
}

export async function submitMatchAnswers(
  signature: string,
  token: string,
  answers: SubmitAnswerPayload[],
): Promise<void> {
  await expectOk(
    await matchFetch(`/${signature}/answers`, { method: 'POST', body: JSON.stringify({ answers }) }, token),
    'Envoi des réponses échoué',
  );
}
