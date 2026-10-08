import { apiFetch } from '@/api/httpClient';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  /** ISO datetime (timed) ou YYYY-MM-DD (all-day) */
  start: string;
  end: string;
  allDay: boolean;
  /** colorId Google "1".."11" */
  colorId?: string;
  htmlLink?: string;
  hangoutLink?: string;
  /** Lien de rendez-vous saisi manuellement (visio, doc, etc.). */
  meetingLink?: string;
  /** Email de l'invité (confirmation / relance). */
  attendeeEmail?: string;
  /** Présence : 'arrived' (venu), 'noshow' (pas venu), 'postponed' (reporté), 'declined' (décliné). */
  attendance?: Attendance;
  /** Marqué comme entretien (compté dans les KPI RH). */
  isInterview?: boolean;
}

export type Attendance = 'arrived' | 'noshow' | 'postponed' | 'declined';

export interface CalendarEventInput {
  summary: string;
  description?: string;
  location?: string;
  /** ISO datetime */
  start: string;
  end: string;
  colorId?: string;
  meetingLink?: string;
  /** Email de l'invité : si fourni, un mail de confirmation est envoyé à la création. */
  attendeeEmail?: string;
  /** Marqué comme entretien (compté dans les KPI RH). */
  isInterview?: boolean;
}

/** Couleur d'un créneau déterminée uniquement par le statut d'entretien.
 * RED pas venu, GREEN venu, PURPLE reporté, BLACK décliné, BLUE par défaut. */
export const CALENDAR_STATUS_HEX: Record<Attendance, string> = {
  noshow: '#C0152A',
  arrived: '#1A7A4A',
  postponed: '#60207E',
  declined: '#111827',
};

/** BLUE par défaut (aucun statut). */
export const DEFAULT_CALENDAR_HEX = '#1130A7';

export function calendarHex(attendance?: Attendance): string {
  return (attendance && CALENDAR_STATUS_HEX[attendance]) || DEFAULT_CALENDAR_HEX;
}

export interface CalendarUser {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
  /** Secteurs assignés (pour cocher par défaut les agendas du même secteur). */
  sectors: string[];
  connected: boolean;
  isSelf: boolean;
}

export class CalendarNotConnectedError extends Error {}

async function calFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await apiFetch(`/api/calendar${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 409) throw new CalendarNotConnectedError('Google Calendar non connecté');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Requête calendrier échouée (${res.status})`);
  }
  return res;
}

export async function fetchCalendarUsers(): Promise<CalendarUser[]> {
  const res = await calFetch('/users');
  return ((await res.json()) as { users: CalendarUser[] }).users;
}

export async function fetchCalendarEvents(
  timeMin: Date,
  timeMax: Date,
  userId?: number,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({ timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString() });
  if (userId != null) params.set('userId', String(userId));
  const res = await calFetch(`/events?${params}`);
  const data = (await res.json()) as { events: CalendarEvent[] };
  return data.events;
}

/** `?userId=` cible l'agenda d'un autre RH/responsable (défaut : le sien). */
function ownerQuery(ownerId?: number): string {
  return ownerId != null ? `?userId=${ownerId}` : '';
}

export async function createCalendarEvent(input: CalendarEventInput, ownerId?: number): Promise<CalendarEvent> {
  const res = await calFetch(`/events${ownerQuery(ownerId)}`, { method: 'POST', body: JSON.stringify(input) });
  return ((await res.json()) as { event: CalendarEvent }).event;
}

export async function updateCalendarEvent(id: string, input: CalendarEventInput, ownerId?: number): Promise<CalendarEvent> {
  const res = await calFetch(`/events/${id}${ownerQuery(ownerId)}`, { method: 'PATCH', body: JSON.stringify(input) });
  return ((await res.json()) as { event: CalendarEvent }).event;
}

export async function deleteCalendarEvent(id: string, ownerId?: number): Promise<void> {
  await calFetch(`/events/${id}${ownerQuery(ownerId)}`, { method: 'DELETE' });
}

/** Marque la présence de l'invité. 'noshow' déclenche un mail de relance avec le lien de réservation. */
export async function setEventAttendance(id: string, status: Attendance, ownerId?: number): Promise<CalendarEvent> {
  const res = await calFetch(`/events/${id}/attendance${ownerQuery(ownerId)}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  return ((await res.json()) as { event: CalendarEvent }).event;
}
