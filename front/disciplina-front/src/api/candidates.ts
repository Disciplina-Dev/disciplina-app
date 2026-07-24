import { apiFetch } from '@/api/httpClient';

const API_BASE = import.meta.env.VITE_API_URL;

/**
 * Upload a candidate avatar (e.g. a webcam capture).
 * Returns the new avatarUpdatedAt timestamp on success.
 */
export async function uploadCandidateAvatar(
  candidateId: string,
  photo: Blob,
): Promise<string> {
  const form = new FormData();
  form.append('photo', photo, 'avatar.jpg');

  const res = await apiFetch(`/api/candidates/${candidateId}/avatar`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Avatar upload failed (${res.status})`);
  }

  const data = (await res.json()) as { avatarUpdatedAt: string };
  return data.avatarUpdatedAt;
}

export function candidateAvatarUrl(candidateId: string, version?: string): string {
  const v = version ? `?v=${encodeURIComponent(version)}` : '';
  return `${API_BASE}/api/candidates/${candidateId}/avatar${v}`;
}
