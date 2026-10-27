import { google, Auth, calendar_v3 } from 'googleapis';
import { googleOAuth, GoogleOAuthClient } from './oauth-client';
import { GoogleTokens, GoogleTokenRefreshHandler } from './types';

export interface CalendarEvent {
    id: string;
    summary: string;
    description?: string;
    location?: string;
    /** ISO datetime (timed event) ou date YYYY-MM-DD (all-day) */
    start: string;
    end: string;
    allDay: boolean;
    /** colorId Google Calendar "1".."11" */
    colorId?: string;
    htmlLink?: string;
    hangoutLink?: string;
    /** Lien de rendez-vous saisi manuellement (visio, doc, etc.). */
    meetingLink?: string;
    /** Email de l'invité (pour confirmation / relance). */
    attendeeEmail?: string;
    /** Prénom de l'invité (saisie libre, sert à la recherche). Absent sur les créneaux antérieurs à l'ajout du champ. */
    attendeeFirstName?: string;
    /** Nom de l'invité (saisie libre, sert à la recherche). Absent sur les créneaux antérieurs à l'ajout du champ. */
    attendeeLastName?: string;
    /** Présence de l'invité : 'arrived' (venu), 'noshow' (pas venu), 'postponed' (reporté) ou 'declined' (décliné). */
    attendance?: Attendance;
    /** Marqué comme entretien (compté dans les KPI RH). */
    isInterview?: boolean;
    /** Id de la SA (séquence d'accompagnement) à l'origine de l'événement, si applicable. */
    saSequenceId?: string;
    /** Id de l'alternant de la SA, pour lier l'événement à sa fiche. */
    saAlternantId?: string;
}

/** Statut de présence stocké sur l'event. */
export type Attendance = 'arrived' | 'noshow' | 'postponed' | 'declined';

/** Tous les statuts de présence reconnus (les valeurs inconnues sont ignorées à la lecture). */
export const ATTENDANCES: readonly Attendance[] = ['arrived', 'noshow', 'postponed', 'declined'];

export interface CalendarEventInput {
    summary: string;
    description?: string;
    location?: string;
    /** ISO datetime */
    start: string;
    end: string;
    colorId?: string;
    /** Lien de rendez-vous saisi manuellement. */
    meetingLink?: string;
    /** Email de l'invité (pour confirmation / relance). */
    attendeeEmail?: string;
    /** Prénom de l'invité (optionnel, saisie libre). */
    attendeeFirstName?: string;
    /** Nom de l'invité (optionnel, saisie libre). */
    attendeeLastName?: string;
    /** Marqué comme entretien (compté dans les KPI RH). */
    isInterview?: boolean;
    /** Invités (réservation publique). */
    attendees?: { email: string; displayName?: string }[];
    /** Événement journée entière : `start`/`end` sont des dates `YYYY-MM-DD`. */
    allDay?: boolean;
    /** Id de la SA (séquence d'accompagnement) à l'origine de l'événement. */
    saSequenceId?: string;
    /** Id de l'alternant de la SA. */
    saAlternantId?: string;
}

/** Intervalle occupé renvoyé par l'API freebusy. */
export interface BusyInterval {
    start: string;
    end: string;
}

/** Clé extendedProperties.private pour stocker le lien de rendez-vous. */
const MEETING_LINK_KEY = 'meetingLink';
/** Clé extendedProperties.private pour l'email de l'invité. */
const ATTENDEE_EMAIL_KEY = 'attendeeEmail';
/** Clé extendedProperties.private pour le prénom de l'invité. */
const ATTENDEE_FIRST_NAME_KEY = 'attendeeFirstName';
/** Clé extendedProperties.private pour le nom de l'invité. */
const ATTENDEE_LAST_NAME_KEY = 'attendeeLastName';
/** Clé extendedProperties.private pour le statut de présence. */
const ATTENDANCE_KEY = 'attendance';
/** Clé extendedProperties.private marquant un entretien (KPI). */
const IS_INTERVIEW_KEY = 'isInterview';
/** Clé extendedProperties.private reliant l'événement à une SA (séquence d'accompagnement). */
const SA_SEQUENCE_ID_KEY = 'saSequenceId';
/** Clé extendedProperties.private reliant l'événement à l'alternant de la SA. */
const SA_ALTERNANT_ID_KEY = 'saAlternantId';

export class GoogleCalendarService {
    private calendar: calendar_v3.Calendar;

    constructor(auth: Auth.OAuth2Client) {
        this.calendar = google.calendar({ version: 'v3', auth });
    }

    static fromTokens(
        creds: GoogleTokens,
        onRefresh?: GoogleTokenRefreshHandler,
        oauth: GoogleOAuthClient = googleOAuth,
    ): GoogleCalendarService {
        return new GoogleCalendarService(oauth.forCredentials(creds, onRefresh));
    }

    async listEvents(timeMin: string, timeMax: string): Promise<CalendarEvent[]> {
        const response = await this.calendar.events.list({
            calendarId: 'primary',
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 2500,
        });

        return (response.data.items ?? []).map(toCalendarEvent);
    }

    async createEvent(input: CalendarEventInput, sendUpdates: 'all' | 'none' = 'none'): Promise<CalendarEvent> {
        const response = await this.calendar.events.insert({
            calendarId: 'primary',
            sendUpdates,
            requestBody: toRequestBody(input),
        });
        return toCalendarEvent(response.data);
    }

    /** Intervalles occupés de l'agenda principal sur la plage donnée. */
    async freeBusy(timeMin: string, timeMax: string): Promise<BusyInterval[]> {
        const response = await this.calendar.freebusy.query({
            requestBody: { timeMin, timeMax, items: [{ id: 'primary' }] },
        });
        const busy = response.data.calendars?.primary?.busy ?? [];
        return busy.map((b) => ({ start: b.start ?? '', end: b.end ?? '' }));
    }

    async updateEvent(eventId: string, input: CalendarEventInput): Promise<CalendarEvent> {
        const response = await this.calendar.events.patch({
            calendarId: 'primary',
            eventId,
            requestBody: toRequestBody(input),
        });
        return toCalendarEvent(response.data);
    }

    async deleteEvent(eventId: string): Promise<void> {
        await this.calendar.events.delete({ calendarId: 'primary', eventId });
    }

    async getEvent(eventId: string): Promise<CalendarEvent> {
        const response = await this.calendar.events.get({ calendarId: 'primary', eventId });
        return toCalendarEvent(response.data);
    }

    /** Patche uniquement le statut de présence (sans toucher aux autres champs). */
    async setAttendance(eventId: string, attendance: Attendance): Promise<CalendarEvent> {
        const response = await this.calendar.events.patch({
            calendarId: 'primary',
            eventId,
            requestBody: { extendedProperties: { private: { [ATTENDANCE_KEY]: attendance } } },
        });
        return toCalendarEvent(response.data);
    }
}

function toRequestBody(input: CalendarEventInput): calendar_v3.Schema$Event {
    return {
        summary: input.summary,
        description: input.description,
        location: input.location,
        start: input.allDay ? { date: input.start } : { dateTime: input.start },
        end: input.allDay ? { date: input.end } : { dateTime: input.end },
        colorId: input.colorId,
        attendees: input.attendees,
        extendedProperties: {
            private: {
                [MEETING_LINK_KEY]: input.meetingLink ?? '',
                [ATTENDEE_EMAIL_KEY]: input.attendeeEmail ?? '',
                [ATTENDEE_FIRST_NAME_KEY]: input.attendeeFirstName ?? '',
                [ATTENDEE_LAST_NAME_KEY]: input.attendeeLastName ?? '',
                [IS_INTERVIEW_KEY]: input.isInterview ? '1' : '',
                [SA_SEQUENCE_ID_KEY]: input.saSequenceId ?? '',
                [SA_ALTERNANT_ID_KEY]: input.saAlternantId ?? '',
            },
        },
    };
}

function parseAttendance(raw: unknown): Attendance | undefined {
    return typeof raw === 'string' && (ATTENDANCES as readonly string[]).includes(raw)
        ? (raw as Attendance)
        : undefined;
}

function toCalendarEvent(e: calendar_v3.Schema$Event): CalendarEvent {
    const allDay = Boolean(e.start?.date);
    return {
        id: e.id ?? '',
        summary: e.summary ?? '(Sans titre)',
        description: e.description ?? undefined,
        location: e.location ?? undefined,
        start: e.start?.dateTime ?? e.start?.date ?? '',
        end: e.end?.dateTime ?? e.end?.date ?? '',
        allDay,
        colorId: e.colorId ?? undefined,
        htmlLink: e.htmlLink ?? undefined,
        hangoutLink: e.hangoutLink ?? undefined,
        meetingLink: e.extendedProperties?.private?.[MEETING_LINK_KEY] || undefined,
        attendeeEmail: e.extendedProperties?.private?.[ATTENDEE_EMAIL_KEY] || undefined,
        attendeeFirstName: e.extendedProperties?.private?.[ATTENDEE_FIRST_NAME_KEY] || undefined,
        attendeeLastName: e.extendedProperties?.private?.[ATTENDEE_LAST_NAME_KEY] || undefined,
        attendance: parseAttendance(e.extendedProperties?.private?.[ATTENDANCE_KEY]),
        isInterview: e.extendedProperties?.private?.[IS_INTERVIEW_KEY] === '1',
        saSequenceId: e.extendedProperties?.private?.[SA_SEQUENCE_ID_KEY] || undefined,
        saAlternantId: e.extendedProperties?.private?.[SA_ALTERNANT_ID_KEY] || undefined,
    };
}
