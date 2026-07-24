import type { ClassMarkerLink, ClassMarkerResult } from '@/types/classmarker';
import { TitleProfessionalType } from '@/types/candidate';
import { apiFetch } from '@/api/httpClient';

const API_BASE = import.meta.env.VITE_API_URL;

export async function fetchClassMarkerLinks(): Promise<ClassMarkerLink[]> {
  const res = await apiFetch('/api/classmarker/links');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `ClassMarker fetch failed (${res.status})`);
  }
  const data = (await res.json()) as { links: ClassMarkerLink[] };
  return data.links;
}

export interface QuickCreateBody {
  first_name: string;
  last_name: string;
  tp_type: TitleProfessionalType;
}

export interface QuickCreateResult {
  id: string;
  already_exists: boolean;
  full_name: string;
}

export interface ClassMarkerResultBundle {
  result: ClassMarkerResult | null;
  history: ClassMarkerResult[];
}

export async function fetchClassMarkerResult(
  candidateId: string
): Promise<ClassMarkerResultBundle | null> {
  const res = await apiFetch(`/api/webhooks/classmarker/result/${encodeURIComponent(candidateId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Result fetch failed (${res.status})`);
  const data = (await res.json()) as { result: ClassMarkerResult | null; history?: ClassMarkerResult[] };
  return { result: data.result ?? null, history: data.history ?? [] };
}

/** Cookie httpOnly envoyé automatiquement par le navigateur : le caller doit ouvrir l'EventSource avec `withCredentials: true`. */
export function classMarkerStreamUrl(candidateId: string): string {
  return `${API_BASE}/api/webhooks/classmarker/stream?candidateId=${encodeURIComponent(candidateId)}`;
}

export async function quickCreateCandidate(
  body: QuickCreateBody
): Promise<QuickCreateResult> {
  const res = await apiFetch('/api/candidates/quick-create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error ?? `Quick-create failed (${res.status})`);
  }
  return (await res.json()) as QuickCreateResult;
}
