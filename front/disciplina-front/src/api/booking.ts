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

/** Portée d'un blocage de date : un seul RH, un secteur, tout le monde, ou des personnes choisies. */
export type DayBlockScope = 'SELF' | 'ALL' | 'SECTOR' | 'USERS';

/** Blocage tel qu'exposé par l'API (une entrée par jour, rattachée à sa période). */
export interface DayBlock {
  id: number;
  /** Date locale `YYYY-MM-DD`. */
  day: string;
  scope: DayBlockScope;
  reason: string;
  createdByName: string | null;
  createdAt: string;
  /** Période de saisie : identique pour tous les jours d'un même blocage. */
  groupKey: string;
  /** Libellés ciblés : secteurs (`SECTOR`) ou noms des personnes (`USERS`). */
  targetLabels: string[];
  /** Nombre de cibles (les noms ne sont exposés qu'à l'auteur d'un blocage nominatif). */
  targetCount: number;
  /** Le blocage s'applique-t-il à l'utilisateur courant ? (l'auteur voit aussi ses blocages ciblés ailleurs) */
  appliesToMe: boolean;
  /** Blocage collectif dont l'utilisateur courant s'est rendu disponible. */
  releasedForMe?: boolean;
}

/** Saisie d'un blocage : une période (un seul jour si `to` = `from`). */
export interface DayBlockInput {
  from: string;
  to: string;
  scope: DayBlockScope;
  reason: string;
  /** Portée `SECTOR` : libellés de ses propres secteurs. */
  sectors?: string[];
  /** Portée `USERS` : personnes sélectionnées manuellement. */
  userIds?: number[];
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
/** Blocages qui concernent l'utilisateur (filtrables par plage de jours). */
export async function fetchDayBlocks(from?: string, to?: string): Promise<DayBlock[]> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  const res = await bookFetch(`/blocks${qs ? `?${qs}` : ''}`);
  return ((await res.json()) as { blocks: DayBlock[] }).blocks;
}

/** Bloque une période pour la portée choisie (soi, son secteur, tout le monde, des personnes). */
export async function createDayBlock(input: DayBlockInput): Promise<DayBlock[]> {
  const res = await bookFetch('/blocks', { method: 'POST', body: JSON.stringify(input) });
  return ((await res.json()) as { blocks: DayBlock[] }).blocks;
}

/** « Me rendre disponible » sur toute la période d'un blocage collectif (bascule). */
export async function releaseDayBlockGroup(groupKey: string): Promise<DayBlock[]> {
  const res = await bookFetch(`/blocks/groups/${groupKey}/release`, { method: 'POST' });
  return ((await res.json()) as { blocks: DayBlock[] }).blocks;
}

/** Annule toute une période : la sienne, ou un blocage collectif pour tout le monde. */
export async function deleteDayBlockGroup(groupKey: string): Promise<DayBlock[]> {
  const res = await bookFetch(`/blocks/groups/${groupKey}`, { method: 'DELETE' });
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

/** Identité obligatoire de l'invité qui réserve un créneau. */
export interface BookingGuest {
  firstName: string;
  lastName: string;
  /** Numéro normalisé (chiffres, `+` initial éventuel). */
  phone: string;
  email: string;
  note?: string;
}

export async function createBooking(
  slug: string,
  payload: { start: string } & BookingGuest,
): Promise<Slot> {
  const res = await bookFetch(`/public/${slug}/book`, { method: 'POST', body: JSON.stringify(payload) });
  return ((await res.json()) as { booked: Slot }).booked;
}

/** URL publique partageable de la page de réservation. */
export function bookingPublicUrl(slug: string): string {
  return `${window.location.origin}/booking/${slug}`;
}
