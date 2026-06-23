const API_BASE = import.meta.env.VITE_API_URL;

/** Plages horaires locales par jour ISO (1=lundi … 7=dimanche). */
export type WorkingHours = Record<string, [string, string][]>;

export interface BookingSettings {
  userId: number;
  slug: string;
  enabled: boolean;
  durationMin: number;
  bufferMin: number;
  timezone: string;
  minNoticeHours: number;
  maxDaysAhead: number;
  workingHours: WorkingHours;
  title: string;
  location: string | null;
  confirmationSubject: string | null;
  confirmationBody: string | null;
}

export type BookingSettingsPatch = Partial<Omit<BookingSettings, 'userId' | 'slug'>>;

export interface PublicBookingInfo {
  hostName: string;
  title: string;
  durationMin: number;
  timezone: string;
  location: string | null;
}

export interface Slot {
  start: string;
  end: string;
}

async function bookFetch(path: string, init?: RequestInit, token?: string): Promise<Response> {
  const res = await fetch(`${API_BASE}/api/booking${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Requête réservation échouée (${res.status})`);
  }
  return res;
}

// ── Espace RH (authentifié) ───────────────────────────────────────────────
export async function fetchMyBookingSettings(token: string): Promise<BookingSettings> {
  const res = await bookFetch('/settings', undefined, token);
  return ((await res.json()) as { settings: BookingSettings }).settings;
}

export async function updateMyBookingSettings(token: string, patch: BookingSettingsPatch): Promise<BookingSettings> {
  const res = await bookFetch('/settings', { method: 'PUT', body: JSON.stringify(patch) }, token);
  return ((await res.json()) as { settings: BookingSettings }).settings;
}

// ── Page publique (sans authentification) ─────────────────────────────────
export async function fetchPublicBooking(slug: string): Promise<PublicBookingInfo> {
  const res = await bookFetch(`/public/${slug}`);
  return (await res.json()) as PublicBookingInfo;
}

export async function fetchPublicSlots(slug: string, from: string, to: string): Promise<Slot[]> {
  const res = await bookFetch(`/public/${slug}/slots?from=${from}&to=${to}`);
  return ((await res.json()) as { slots: Slot[] }).slots;
}

export async function createBooking(
  slug: string,
  payload: { start: string; name: string; email: string; note?: string },
): Promise<Slot> {
  const res = await bookFetch(`/public/${slug}/book`, { method: 'POST', body: JSON.stringify(payload) });
  return ((await res.json()) as { booked: Slot }).booked;
}

/** URL publique partageable de la page de réservation. */
export function bookingPublicUrl(slug: string): string {
  return `${window.location.origin}/booking/${slug}`;
}
