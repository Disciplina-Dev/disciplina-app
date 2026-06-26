const API_BASE = import.meta.env.VITE_API_URL;

export type InterviewStatus = 'PENDING' | 'AUTHENTICATED' | 'COMPLETED' | 'LOCKED' | 'EXPIRED';

export interface InterviewInspectResult {
  exists: boolean;
  expired: boolean;
  status: InterviewStatus | null;
}

export type AuthenticateInterviewResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'invalid' | 'locked' | 'expired'; remaining?: number };

export interface InterviewSlotView {
  slot: string;
  taken: boolean;
}

export interface InterviewSlotsResult {
  location?: string;
  slots: InterviewSlotView[];
  bookedSlot?: string;
}

async function interviewFetch(path: string, init?: RequestInit, token?: string): Promise<Response> {
  return fetch(`${API_BASE}/api/interview${path}`, {
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

export async function inspectInterview(signature: string): Promise<InterviewInspectResult> {
  const res = await expectOk(await interviewFetch(`/${signature}/inspect`), 'Vérification du lien échouée');
  return (await res.json()) as InterviewInspectResult;
}

export async function authenticateInterview(signature: string, code: string): Promise<AuthenticateInterviewResult> {
  const res = await interviewFetch(`/${signature}/authenticate`, {
    method: 'POST',
    body: JSON.stringify({ code }),
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

export async function getInterviewSlots(signature: string, token: string): Promise<InterviewSlotsResult> {
  const res = await expectOk(
    await interviewFetch(`/${signature}/slots`, undefined, token),
    'Chargement des créneaux échoué',
  );
  return (await res.json()) as InterviewSlotsResult;
}

export class SlotUnavailableError extends Error {}

export async function bookInterviewSlot(signature: string, token: string, slot: string): Promise<void> {
  const res = await interviewFetch(`/${signature}/book`, { method: 'POST', body: JSON.stringify({ slot }) }, token);
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    throw new SlotUnavailableError(body.error ?? "Ce créneau n'est plus disponible");
  }
  await expectOk(res, 'Réservation du créneau échouée');
}
