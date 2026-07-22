const API_BASE = import.meta.env.VITE_API_URL;

export type CvImportStatus = 'PENDING' | 'AUTHENTICATED' | 'COMPLETED' | 'LOCKED' | 'EXPIRED';

export interface CvImportInspectResult {
  exists: boolean;
  expired: boolean;
  status: CvImportStatus | null;
}

export type AuthenticateCvImportResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'invalid' | 'locked' | 'expired'; remaining?: number };

export interface CvImportProfile {
  externalEmail: string;
  guestType: string;
  externalUuid: string;
}

async function externalFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}/api/external${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
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

export async function inspectCvImport(signature: string): Promise<CvImportInspectResult> {
  const res = await expectOk(await externalFetch(`/${signature}/inspect`), 'Vérification du lien échouée');
  return (await res.json()) as CvImportInspectResult;
}

export async function authenticateCvImport(signature: string, code: string): Promise<AuthenticateCvImportResult> {
  const res = await externalFetch(`/${signature}/authenticate`, {
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

export async function getCvImportProfile(signature: string, token: string): Promise<CvImportProfile> {
  const res = await expectOk(
    await fetch(`${API_BASE}/api/external/${signature}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    'Chargement du profil échoué',
  );
  return (await res.json()) as CvImportProfile;
}
