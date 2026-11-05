import { apiFetch } from '@/api/httpClient';

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
  propositionSubject: string | null;
  propositionBody: string | null;
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

/** Portée d'un blocage de date : un seul RH, ou tout le monde. */
export type DayBlockScope = 'SELF' | 'ALL';

/** Jour bloqué dans l'agenda (un jour = une entrée). */
export interface DayBlock {
  id: number;
  /** Date locale `YYYY-MM-DD`. */
  day: string;
  scope: DayBlockScope;
  reason: string;
  createdByName: string | null;
  createdAt: string;
  /** Blocage « tout le monde » dont l'utilisateur courant s'est rendu disponible. */
  releasedForMe?: boolean;
}

async function bookFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await apiFetch(`/api/booking${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Requête réservation échouée (${res.status})`);
  }
  return res;
}

// ── Espace RH (authentifié) ───────────────────────────────────────────────
export async function fetchMyBookingSettings(): Promise<BookingSettings> {
  const res = await bookFetch('/settings');
  return ((await res.json()) as { settings: BookingSettings }).settings;
}

export async function updateMyBookingSettings(patch: BookingSettingsPatch): Promise<BookingSettings> {
  const res = await bookFetch('/settings', { method: 'PUT', body: JSON.stringify(patch) });
  return ((await res.json()) as { settings: BookingSettings }).settings;
}

// ── Blocage de dates (espace RH) ──────────────────────────────────────────
/** Blocages visibles : les miens + ceux « pour tout le monde » (filtrables par plage). */
export async function fetchDayBlocks(from?: string, to?: string): Promise<DayBlock[]> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  const res = await bookFetch(`/blocks${qs ? `?${qs}` : ''}`);
  return ((await res.json()) as { blocks: DayBlock[] }).blocks;
}

export async function createDayBlock(input: { day: string; scope: DayBlockScope; reason: string }): Promise<DayBlock[]> {
  const res = await bookFetch('/blocks', { method: 'POST', body: JSON.stringify(input) });
  return ((await res.json()) as { blocks: DayBlock[] }).blocks;
}

/** « Me rendre disponible » sur un blocage « tout le monde » (bascule). */
export async function releaseDayBlock(id: number): Promise<DayBlock[]> {
  const res = await bookFetch(`/blocks/${id}/release`, { method: 'POST' });
  return ((await res.json()) as { blocks: DayBlock[] }).blocks;
}

/** Annule un blocage : le mien, ou un blocage « tout le monde » pour tous. */
export async function deleteDayBlock(id: number): Promise<DayBlock[]> {
  const res = await bookFetch(`/blocks/${id}`, { method: 'DELETE' });
  return ((await res.json()) as { blocks: DayBlock[] }).blocks;
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
