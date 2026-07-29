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
    /** Présence de l'invité : 'arrived' (venu) ou 'noshow' (pas venu). */
    attendance?: Attendance;
    /** Marqué comme entretien (compté dans les KPI RH). */
    isInterview?: boolean;
}

/** Statut de présence stocké sur l'event. */
export type Attendance = 'arrived' | 'noshow';

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
    /** Marqué comme entretien (compté dans les KPI RH). */
    isInterview?: boolean;
    /** Invités (réservation publique). */
    attendees?: { email: string; displayName?: string }[];
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
/** Clé extendedProperties.private pour le statut de présence. */
const ATTENDANCE_KEY = 'attendance';
/** Clé extendedProperties.private marquant un entretien (KPI). */
const IS_INTERVIEW_KEY = 'isInterview';

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
        start: { dateTime: input.start },
        end: { dateTime: input.end },
        colorId: input.colorId,
        attendees: input.attendees,
        extendedProperties: {
            private: {
                [MEETING_LINK_KEY]: input.meetingLink ?? '',
                [ATTENDEE_EMAIL_KEY]: input.attendeeEmail ?? '',
                [IS_INTERVIEW_KEY]: input.isInterview ? '1' : '',
            },
        },
    };
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
        attendance: (e.extendedProperties?.private?.[ATTENDANCE_KEY] as Attendance) || undefined,
        isInterview: e.extendedProperties?.private?.[IS_INTERVIEW_KEY] === '1',
    };
}
