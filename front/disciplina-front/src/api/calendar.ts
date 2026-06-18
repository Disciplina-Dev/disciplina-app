const API_BASE = import.meta.env.VITE_API_URL;

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
  /** Présence : 'arrived' (venu) ou 'noshow' (pas venu). */
  attendance?: Attendance;
  /** Marqué comme entretien (compté dans les KPI RH). */
  isInterview?: boolean;
}

export type Attendance = 'arrived' | 'noshow';

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

/** Couleurs Google Calendar (event colorId → hex officiel). */
export const EVENT_COLORS: Record<string, { name: string; hex: string }> = {
  '1': { name: 'Lavande', hex: '#7986cb' },
  '2': { name: 'Sauge', hex: '#33b679' },
  '3': { name: 'Raisin', hex: '#8e24aa' },
  '4': { name: 'Flamant', hex: '#e67c73' },
  '5': { name: 'Banane', hex: '#f6bf26' },
  '6': { name: 'Mandarine', hex: '#f4511e' },
  '7': { name: 'Paon', hex: '#039be5' },
  '8': { name: 'Graphite', hex: '#616161' },
  '9': { name: 'Myrtille', hex: '#3f51b5' },
  '10': { name: 'Basilic', hex: '#0b8043' },
  '11': { name: 'Tomate', hex: '#d50000' },
};

/** Couleur par défaut (charte violet Disciplina) quand l'event n'a pas de colorId. */
export const DEFAULT_EVENT_HEX = '#60207E';

export function eventHex(colorId?: string): string {
  return (colorId && EVENT_COLORS[colorId]?.hex) || DEFAULT_EVENT_HEX;
}

export interface CalendarUser {
  id: number;
  name: string;
  role: string;
  connected: boolean;
  isSelf: boolean;
}

/** Palette pour distinguer les agendas par personne (couleur déterministe par id). */
const OWNER_PALETTE = ['#60207E', '#039be5', '#0b8043', '#e67c73', '#f4511e', '#8e24aa', '#3f51b5', '#33b679', '#d50000', '#616161']

export function ownerColor(userId: number): string {
  return OWNER_PALETTE[userId % OWNER_PALETTE.length]
}

export class CalendarNotConnectedError extends Error {}

async function calFetch(token: string, path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_BASE}/api/calendar${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 409) throw new CalendarNotConnectedError('Google Calendar non connecté');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Requête calendrier échouée (${res.status})`);
  }
  return res;
}

export async function fetchCalendarUsers(token: string): Promise<CalendarUser[]> {
  const res = await calFetch(token, '/users');
  return ((await res.json()) as { users: CalendarUser[] }).users;
}

export async function fetchCalendarEvents(
  token: string,
  timeMin: Date,
  timeMax: Date,
  userId?: number,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({ timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString() });
  if (userId != null) params.set('userId', String(userId));
  const res = await calFetch(token, `/events?${params}`);
  const data = (await res.json()) as { events: CalendarEvent[] };
  return data.events;
}

export async function createCalendarEvent(token: string, input: CalendarEventInput): Promise<CalendarEvent> {
  const res = await calFetch(token, '/events', { method: 'POST', body: JSON.stringify(input) });
  return ((await res.json()) as { event: CalendarEvent }).event;
}

export async function updateCalendarEvent(token: string, id: string, input: CalendarEventInput): Promise<CalendarEvent> {
  const res = await calFetch(token, `/events/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
  return ((await res.json()) as { event: CalendarEvent }).event;
}

export async function deleteCalendarEvent(token: string, id: string): Promise<void> {
  await calFetch(token, `/events/${id}`, { method: 'DELETE' });
}

/** Marque la présence de l'invité. 'noshow' déclenche un mail de relance avec le lien de réservation. */
export async function setEventAttendance(token: string, id: string, status: Attendance): Promise<CalendarEvent> {
  const res = await calFetch(token, `/events/${id}/attendance`, { method: 'PATCH', body: JSON.stringify({ status }) });
  return ((await res.json()) as { event: CalendarEvent }).event;
}
