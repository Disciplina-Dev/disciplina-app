import { GoogleCalendarService, CalendarEvent, CalendarEventInput } from '../external/google/calendar.service';
import { UserService } from './UserService';
import { AlternantService } from './AlternantService';
import { AlternantRepository } from '../repositories/mongo/AlternantRepository';
import { AlternantSequenceRepository } from '../repositories/mongo/AlternantSequenceRepository';
import { Alternant, AlternantSequence, AlternantSequenceStatus } from '../types/alternant.types';
import { JobRole, User } from '../types/user.types';
import { tenantTimezone } from '../config/tenant';
import { logger } from '../external/logger';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Couleur Google « peacock » (cyan), cohérente avec l'accent de l'espace Peda. */
const SA_EVENT_COLOR = '7';

export interface SaCalendarReport {
    connected: boolean;
    created: number;
    updated: number;
    deleted: number;
    rescheduled: number;
    failed: number;
}

function emptyReport(connected: boolean): SaCalendarReport {
    return { connected, created: 0, updated: 0, deleted: 0, rescheduled: 0, failed: 0 };
}

/** Date calendaire (YYYY-MM-DD) d'un instant, dans le fuseau du tenant. */
function dateKey(value: Date | string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tenantTimezone(),
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date(value));
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Instant midi UTC d'une date `YYYY-MM-DD` : stable quel que soit le fuseau d'affichage. */
function ymdToDate(ymd: string): Date {
    return new Date(`${ymd}T12:00:00.000Z`);
}

function nextDay(ymd: string): string {
    const d = ymdToDate(ymd);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
}

/** Date portée par la SA : la réalisation si elle est faite, la date prévue sinon. */
function effectiveDate(seq: AlternantSequence): Date {
    if (seq.status === AlternantSequenceStatus.DONE && seq.realisee_le) return new Date(seq.realisee_le);
    return new Date(seq.prevue_le);
}

interface IdentifiedItem {
    alternant: Alternant;
    sequence: AlternantSequence;
}

/**
 * Synchronisation des séquences d'accompagnement (SA) avec les agendas Google
 * Calendar des utilisateurs Peda.
 *
 * Sens app → Google : chaque SA active apparaît comme un événement journée
 * entière, tagué `saSequenceId`. Sens Google → app : à la lecture de l'agenda,
 * un événement déplacé met à jour la date de la SA, puis la correction est
 * propagée aux agendas des autres Pedas. La synchronisation est best-effort :
 * un échec Google n'échoue jamais la mutation ou la page appelante.
 */
export class SaCalendarService {
    private users = new UserService();
    private alternants = new AlternantRepository();
    private sequences = new AlternantSequenceRepository();
    private alternantService = new AlternantService();

    /** Utilisateurs Peda disposant d'un compte Google connecté. */
    private async connectedPedas(): Promise<User[]> {
        const pedas = await this.users.findByJobRoles([JobRole.PEDA]);
        return pedas.filter((u) => u.oauthToken);
    }

    private calendarFor(user: User): GoogleCalendarService {
        return GoogleCalendarService.fromTokens(
            { access_token: user.oauthToken ?? undefined, refresh_token: user.refreshToken ?? undefined },
            this.users.googleTokenPersister(user.id),
        );
    }

    /** Toutes les SA actives (alternant non archivé, SA non archivée). */
    private async loadActiveItems(): Promise<IdentifiedItem[]> {
        const alternants = await this.alternants.findAll();
        const byId = new Map(alternants.map((a) => [a._id, a]));
        const sequences = await this.sequences.findByAlternantIds(alternants.map((a) => a._id));
        return sequences
            .filter((s) => s.archived_at == null && byId.has(s.alternant_id))
            .map((sequence) => ({ alternant: byId.get(sequence.alternant_id) as Alternant, sequence }));
    }

    private buildInput({ alternant, sequence }: IdentifiedItem): CalendarEventInput {
        const day = dateKey(effectiveDate(sequence));
        const company = alternant.company?.name?.trim();
        const lines = [
            alternant.session ? `Session : ${alternant.session}` : null,
            company ? `Entreprise : ${company}` : 'Sans entreprise',
        ].filter((l): l is string => Boolean(l));
        return {
            summary: `SA n°${sequence.numero} — ${alternant.first_name} ${alternant.last_name}`.trim(),
            description: lines.join('\n'),
            location: alternant.company?.address ?? undefined,
            start: day,
            end: nextDay(day),
            allDay: true,
            colorId: SA_EVENT_COLOR,
            saSequenceId: sequence._id,
            saAlternantId: alternant._id,
        };
    }

    private matches(event: CalendarEvent, input: CalendarEventInput): boolean {
        const eventDay = event.allDay ? event.start.slice(0, 10) : dateKey(event.start);
        return (
            eventDay === input.start &&
            event.summary === input.summary &&
            (event.description ?? '') === (input.description ?? '') &&
            (event.location ?? '') === (input.location ?? '')
        );
    }

    /**
     * Crée/met à jour l'événement de chaque item sur le calendrier, à partir de
     * la liste d'événements déjà connue (1 seul appel `listEvents` par passage).
     */
    private async pushItems(
        calendar: GoogleCalendarService,
        items: IdentifiedItem[],
        events: CalendarEvent[],
        userId: number,
        report: SaCalendarReport,
    ): Promise<void> {
        const byTag = new Map<string, CalendarEvent>();
        for (const event of events) if (event.saSequenceId) byTag.set(event.saSequenceId, event);
        for (const item of items) {
            const input = this.buildInput(item);
            const existing = byTag.get(item.sequence._id);
            const storedId = item.sequence.google_event_ids?.[String(userId)] ?? null;
            try {
                if (!existing) {
                    const created = await calendar.createEvent(input);
                    await this.sequences.setGoogleEventId(item.sequence._id, userId, created.id);
                    report.created += 1;
                } else {
                    if (!this.matches(existing, input)) {
                        await calendar.updateEvent(existing.id, input);
                        report.updated += 1;
                    }
                    if (storedId !== existing.id) {
                        await this.sequences.setGoogleEventId(item.sequence._id, userId, existing.id);
                    }
                }
            } catch (error) {
                report.failed += 1;
                logger.error(
                    { err: error, userId, sequenceId: item.sequence._id },
                    'sa-calendar: échec de synchronisation d’une SA',
                );
            }
        }
    }

    /** Supprime un événement en ignorant un 404 (déjà supprimé côté Google). */
    private async safeDelete(
        calendar: GoogleCalendarService,
        eventId: string,
        report: SaCalendarReport,
    ): Promise<void> {
        try {
            await calendar.deleteEvent(eventId);
            report.deleted += 1;
        } catch (error) {
            const status = (error as { code?: number })?.code;
            if (status !== 404 && status !== 410) {
                report.failed += 1;
                logger.error({ err: error, eventId }, 'sa-calendar: échec de suppression d’un événement');
            }
        }
    }

    /**
     * Applique au domaine les changements faits dans Google Calendar :
     * événement déplacé → date de la SA mise à jour ; événement orphelin
     * (SA supprimée/archivée) → événement supprimé. Renvoie les SA replanifiées.
     */
    private async reconcile(
        calendar: GoogleCalendarService,
        events: CalendarEvent[],
        userId: number,
        report: SaCalendarReport,
    ): Promise<string[]> {
        const changed: string[] = [];
        for (const event of events) {
            if (!event.saSequenceId) continue;
            const sequence = await this.sequences.findById(event.saSequenceId);
            const alternant = sequence ? await this.alternants.findById(sequence.alternant_id) : null;
            if (!sequence || sequence.archived_at != null || !alternant || alternant.archived_at != null) {
                await this.safeDelete(calendar, event.id, report);
                continue;
            }
            if (sequence.google_event_ids?.[String(userId)] !== event.id) {
                await this.sequences.setGoogleEventId(sequence._id, userId, event.id);
            }
            if (sequence.status !== AlternantSequenceStatus.PENDING) continue;
            const eventDay = event.allDay ? event.start.slice(0, 10) : dateKey(event.start);
            if (eventDay && eventDay !== dateKey(sequence.prevue_le)) {
                await this.alternantService.rescheduleSequence(sequence._id, ymdToDate(eventDay).toISOString());
                if (!changed.includes(sequence._id)) changed.push(sequence._id);
                report.rescheduled += 1;
            }
        }
        return changed;
    }

    /**
     * Reconcile puis synchronise la fenêtre pour l'utilisateur : renvoie les
     * événements de l'agenda et un rapport. Lève l'erreur Google pour que
     * l'appelant la traduise (409/502).
     */
    async listAndSyncForUser(
        userId: number,
        timeMin: string,
        timeMax: string,
    ): Promise<{ events: CalendarEvent[]; report: SaCalendarReport }> {
        const user = await this.users.findById(userId);
        if (!user || !user.oauthToken) return { events: [], report: emptyReport(false) };
        const calendar = this.calendarFor(user);
        const events = await calendar.listEvents(timeMin, timeMax);
        const report = emptyReport(true);
        const changed = await this.reconcile(calendar, events, userId, report);
        const items = (await this.loadActiveItems()).filter((item) => {
            const day = dateKey(effectiveDate(item.sequence));
            return day >= timeMin.slice(0, 10) && day <= timeMax.slice(0, 10);
        });
        await this.pushItems(calendar, items, events, userId, report);
        // Les dates d'événements viennent de bouger : on relit pour renvoyer l'état final.
        const fresh = await calendar.listEvents(timeMin, timeMax);
        // Propage les replanifications issues de Google aux agendas des autres Pedas.
        if (changed.length > 0) await this.syncSequencesForAllPedas(changed);
        return { events: fresh, report };
    }

    /** Force la synchronisation (app → Google) de toutes les SA de l'utilisateur. */
    async syncAllForUser(userId: number): Promise<SaCalendarReport> {
        const user = await this.users.findById(userId);
        if (!user || !user.oauthToken) return emptyReport(false);
        const items = await this.loadActiveItems();
        if (items.length === 0) return emptyReport(true);
        const calendar = this.calendarFor(user);
        const dates = items.map((i) => effectiveDate(i.sequence).getTime());
        const timeMin = new Date(Math.min(...dates) - 7 * DAY_MS).toISOString();
        const timeMax = new Date(Math.max(...dates) + 8 * DAY_MS).toISOString();
        const events = await calendar.listEvents(timeMin, timeMax);
        const report = emptyReport(true);
        await this.pushItems(calendar, items, events, userId, report);
        return report;
    }

    /**
     * Synchronise les SA données sur l'agenda de chaque Peda connecté.
     * Appelé après une édition côté app (ex. replanification) pour que les
     * agendas reflètent immédiatement le changement. Best-effort.
     */
    async syncSequencesForAllPedas(sequenceIds: string[]): Promise<void> {
        if (sequenceIds.length === 0) return;
        try {
            const sequences = (await this.sequences.findByIds(sequenceIds)).filter((s) => s.archived_at == null);
            if (sequences.length === 0) return;
            const alternants = await this.alternants.findByIds([...new Set(sequences.map((s) => s.alternant_id))]);
            const byId = new Map(alternants.map((a) => [a._id, a]));
            const items: IdentifiedItem[] = sequences
                .filter((s) => byId.has(s.alternant_id))
                .map((sequence) => ({ alternant: byId.get(sequence.alternant_id) as Alternant, sequence }));
            if (items.length === 0) return;
            const dates = items.map((i) => effectiveDate(i.sequence).getTime());
            const timeMin = new Date(Math.min(...dates) - 7 * DAY_MS).toISOString();
            const timeMax = new Date(Math.max(...dates) + 8 * DAY_MS).toISOString();
            for (const user of await this.connectedPedas()) {
                try {
                    const calendar = this.calendarFor(user);
                    const events = await calendar.listEvents(timeMin, timeMax);
                    await this.pushItems(calendar, items, events, user.id, emptyReport(true));
                } catch (error) {
                    logger.error({ err: error, userId: user.id }, 'sa-calendar: échec de propagation');
                }
            }
        } catch (error) {
            logger.error({ err: error }, 'sa-calendar: échec de replanification distribuée');
        }
    }

    /**
     * Supprime les événements des SA données sur chaque agenda Peda connecté
     * (SA supprimée, alternant supprimé, entreprise retirée…). Best-effort.
     */
    async removeSequencesForAllPedas(sequences: AlternantSequence[]): Promise<void> {
        const withEvents = sequences.filter((s) => s.google_event_ids && Object.keys(s.google_event_ids).length > 0);
        if (withEvents.length === 0) return;
        try {
            for (const user of await this.connectedPedas()) {
                const calendar = this.calendarFor(user);
                for (const sequence of withEvents) {
                    const eventId = sequence.google_event_ids?.[String(user.id)];
                    if (eventId) await this.safeDelete(calendar, eventId, emptyReport(true));
                }
            }
        } catch (error) {
            logger.error({ err: error }, 'sa-calendar: échec de suppression distribuée');
        }
    }
}
