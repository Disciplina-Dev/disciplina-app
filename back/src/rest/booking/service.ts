import { randomBytes, randomUUID } from 'crypto';
import { BookingRepository, BookingSettings } from './repository';
import {
    DayBlockRepository,
    DayBlockScope,
    DayBlock,
    SECTOR_TARGET_PREFIX,
    USER_TARGET_PREFIX,
    scopeKeyFor,
} from './blocksRepository';
import { UserService } from '../../services/UserService';
import { MailTemplateService } from '../../services/MailTemplateService';
import { GoogleCalendarService, BusyInterval } from '../../external/google/calendar.service';
import { GoogleGmailService } from '../../external/google/gmail.service';
import { withNoReply } from '../../external/google/no-reply';
import { GoogleTokens } from '../../external/google/types';
import { JobRole, User } from '../../types/user.types';
import { canAccessAllSectors, primarySector, shareSector } from '../../utils/sector';
import { logger } from '../../external/logger';
import { RhKpiService } from '../../services/RhKpiService';

export interface Slot {
    /** ISO datetime UTC du début. */
    start: string;
    end: string;
}

export interface GuestInfo {
    firstName: string;
    lastName: string;
    /** Numéro normalisé (chiffres, `+` initial éventuel). */
    phone: string;
    email: string;
    note?: string;
}

export class BookingDisabledError extends Error {}
export class SlotUnavailableError extends Error {}
export class DayBlockNotFoundError extends Error {}
export class DayBlockForbiddenError extends Error {}
export class DayBlockConflictError extends Error {}
export class DayBlockValidationError extends Error {}

/** Saisie d'un blocage de dates (une période, éventuellement d'un seul jour). */
export interface DayBlockPeriodInput {
    from: string;
    to: string;
    scope: DayBlockScope;
    reason: string;
    /** Blocage sectoriel : libellés de SES propres secteurs. */
    sectors?: string[];
    /** Blocage nominatif : personnes sélectionnées manuellement. */
    userIds?: number[];
}

const userService = new UserService();
const gmailService = new GoogleGmailService();
const mailTemplateService = new MailTemplateService();
const rhKpiService = new RhKpiService();

/** Nom complet de l'invité (« Prénom Nom »). */
function guestFullName(guest: GuestInfo): string {
    return `${guest.firstName} ${guest.lastName}`.trim();
}

/** Formate un instant pour affichage dans le fuseau donné (ex "lundi 16 juin 2026 à 09:00"). */
function formatInTz(iso: string, tz: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
        timeZone: tz,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(iso));
}

/** Variables de date détaillées pour les modèles de mail. */
function dateVars(iso: string, tz: string): { jour: string; date_longue: string; date_courte: string; heure: string } {
    const d = new Date(iso);
    return {
        // Jour de la semaine seul : « lundi »
        jour: new Intl.DateTimeFormat('fr-FR', { timeZone: tz, weekday: 'long' }).format(d),
        // Date en toutes lettres sans l'heure : « lundi 22 juin 2026 »
        date_longue: new Intl.DateTimeFormat('fr-FR', {
            timeZone: tz,
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        }).format(d),
        // Date numérique : « 22/06/2026 »
        date_courte: new Intl.DateTimeFormat('fr-FR', {
            timeZone: tz,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        }).format(d),
        // Heure seule : « 14:30 »
        heure: new Intl.DateTimeFormat('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(d),
    };
}

/** Remplace les variables {{cle}} d'un modèle par leurs valeurs (clés inconnues → ""). */
function renderTemplate(tpl: string, vars: Record<string, string>): string {
    return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key.toLowerCase()] ?? '');
}

/** Décalage (ms) du fuseau `tz` à l'instant `date`. Exact pour les fuseaux à offset fixe (ex Réunion). */
function tzOffsetMs(date: Date, tz: string): number {
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    const map: Record<string, number> = {};
    for (const p of dtf.formatToParts(date)) if (p.type !== 'literal') map[p.type] = Number(p.value);
    const asUtc = Date.UTC(map.year, map.month - 1, map.day, map.hour === 24 ? 0 : map.hour, map.minute, map.second);
    return asUtc - date.getTime();
}

/** Convertit une date/heure locale (dans `tz`) en instant UTC. */
function zonedToUtc(year: number, month1: number, day: number, hh: number, mm: number, tz: string): Date {
    const guess = Date.UTC(year, month1 - 1, day, hh, mm);
    return new Date(guess - tzOffsetMs(new Date(guess), tz));
}

/** Jour ISO (1=lun … 7=dim) de la date calendaire {year,month,day}. */
function isoWeekday(year: number, month1: number, day: number): number {
    const d = new Date(Date.UTC(year, month1 - 1, day)).getUTCDay(); // 0=dim
    return d === 0 ? 7 : d;
}

function parseHM(hm: string): [number, number] {
    const [h, m] = hm.split(':').map(Number);
    return [h, m];
}

/** Jours locaux `YYYY-MM-DD` de `from` à `to` inclus (bornes déjà validées). */
function daysInRange(from: string, to: string): string[] {
    const days: string[] = [];
    const start = Date.parse(`${from}T00:00:00Z`);
    const end = Date.parse(`${to}T00:00:00Z`);
    for (let cur = start; cur <= end; cur += 86_400_000) {
        days.push(new Date(cur).toISOString().slice(0, 10));
    }
    return days;
}

function overlapsBusy(startMs: number, endMs: number, busy: BusyInterval[]): boolean {
    return busy.some((b) => {
        const bs = Date.parse(b.start);
        const be = Date.parse(b.end);
        return startMs < be && endMs > bs;
    });
}

function calendarForUser(user: User): GoogleCalendarService {
    return GoogleCalendarService.fromTokens(
        { access_token: user.oauthToken ?? undefined, refresh_token: user.refreshToken ?? undefined },
        (refreshed: GoogleTokens) =>
            userService.updateGoogleTokens(user.id, refreshed.access_token ?? null, refreshed.refresh_token ?? null),
    );
}

export class BookingService {
    private repo = new BookingRepository();
    private blockRepo = new DayBlockRepository();

    /** Renvoie les réglages de l'utilisateur, en les créant (slug aléatoire) au premier accès. */
    async getOrCreate(userId: number): Promise<BookingSettings> {
        const existing = await this.repo.findByUserId(userId);
        if (existing) return existing;
        return this.repo.create(userId, randomBytes(8).toString('hex'));
    }

    // ── Blocage de dates ──────────────────────────────────────────────────
    /** Blocages qui concernent l'utilisateur : les siens + ceux qui le ciblent. */
    async listDayBlocks(userId: number, from?: string, to?: string): Promise<DayBlock[]> {
        return this.blockRepo.findVisible(userId, from, to);
    }

    /**
     * Bloque une période (un seul jour si `from === to`) pour la portée demandée :
     * soi-même, tout le monde, un de ses secteurs, ou une sélection de personnes.
     */
    async blockPeriod(actor: User, input: DayBlockPeriodInput): Promise<void> {
        const targets = await this.resolveTargets(actor, input);
        const days = daysInRange(input.from, input.to);
        // Reprise : un blocage déjà posé sur la même portée par un autre RH ne se
        // réécrit pas (ni motif ni auteur), sinon le contrôle « auteur ou
        // responsable » à l'annulation serait contournable en le réécrivant.
        const ownerId = input.scope === 'SELF' ? actor.id : null;
        const existing = await this.blockRepo.findByScopeKey(scopeKeyFor(input.scope, ownerId, targets), days);
        if (existing.some((row) => row.created_by != null && row.created_by !== actor.id)) {
            throw new DayBlockConflictError('Ces dates sont déjà bloquées par un autre RH');
        }
        await this.blockRepo.save({
            days,
            userId: ownerId,
            scope: input.scope,
            kind: 'BLOCK',
            reason: input.reason,
            createdBy: actor.id,
            groupKey: randomUUID(),
            targets,
        });
    }

    /** Résout les cibles d'un blocage en lignes de `calendar_day_block_targets`. */
    private async resolveTargets(actor: User, input: DayBlockPeriodInput): Promise<string[]> {
        if (input.scope === 'SECTOR') {
            const labels = [...new Set(input.sectors ?? [])];
            if (labels.length === 0) throw new DayBlockValidationError('Choisissez au moins un secteur');
            // On ne résout que parmi SES secteurs : « mon secteur » reste une
            // portée personnelle, jamais un moyen de bloquer les autres.
            const mine = await this.blockRepo.findUserSectors(actor.id);
            const idByLabel = new Map<string, number>();
            for (const sector of mine) if (!idByLabel.has(sector.label)) idByLabel.set(sector.label, sector.id);
            return labels.map((label) => {
                const id = idByLabel.get(label);
                if (id === undefined) throw new DayBlockValidationError(`Secteur inconnu : ${label}`);
                return `${SECTOR_TARGET_PREFIX}${id}`;
            });
        }
        if (input.scope === 'USERS') {
            const ids = [...new Set(input.userIds ?? [])].filter((id) => Number.isInteger(id) && id > 0);
            if (ids.length === 0) throw new DayBlockValidationError('Choisissez au moins une personne');
            const allowed = await this.targetableUserIds(actor);
            if (ids.some((id) => !allowed.has(id))) {
                throw new DayBlockValidationError('Certaines personnes ne sont pas accessibles depuis votre agenda');
            }
            return ids.map((id) => `${USER_TARGET_PREFIX}${id}`);
        }
        return [];
    }

    /**
     * Personnes qu'un utilisateur peut cibler : les mêmes que la liste du
     * calendrier — RH + soi-même, restreint à son secteur pour un EMPLOYEE,
     * tout le monde pour un RESPONSABLE/ADMIN.
     */
    private async targetableUserIds(actor: User): Promise<Set<number>> {
        const rhUsers = await userService.findByJobRoles([JobRole.RH]);
        const people = rhUsers.some((u) => u.id === actor.id) ? rhUsers : [actor, ...rhUsers];
        const visible = canAccessAllSectors(actor.permission)
            ? people
            : people.filter((u) => u.id === actor.id || shareSector(actor.sectors, u.sectors));
        return new Set(visible.map((u) => u.id));
    }

    /**
     * « Me rendre disponible » : dérogation personnelle à un blocage collectif.
     * Bascule — un second appel re-bloque les jours pour cet utilisateur.
     * La dérogation est journalière (sémantique #1080 conservée) : elle vaut pour
     * la date, pas pour le blocage qui l'a motivée.
     */
    async releaseDayBlock(userId: number, id: number): Promise<void> {
        const block = await this.blockRepo.findById(id);
        if (!block || block.kind !== 'BLOCK') throw new DayBlockNotFoundError('Blocage introuvable');
        if (block.user_id != null) {
            throw new DayBlockForbiddenError('Ce blocage ne concerne que vous : annulez-le');
        }
        if (!(await this.blockRepo.concernsUser(block.id, userId))) {
            throw new DayBlockForbiddenError('Ce blocage ne vous concerne pas');
        }
        const mine = await this.blockRepo.findPersonal(userId, block.day);
        if (mine?.kind === 'BLOCK') {
            throw new DayBlockConflictError('Ce jour est déjà bloqué pour vous');
        }
        if (mine?.kind === 'OPEN') {
            await this.blockRepo.deleteById(mine.id);
            return;
        }
        await this.blockRepo.save({
            days: [block.day],
            userId,
            scope: 'SELF',
            kind: 'OPEN',
            reason: block.reason,
            createdBy: userId,
            groupKey: '',
        });
    }

    /**
     * Dérogation personnelle sur toute une période. Refusée si un jour est déjà
     * bloqué pour soi (le blocage personnel l'emporte).
     */
    async releaseBlockGroup(userId: number, groupKey: string): Promise<void> {
        const rows = await this.blockRepo.findGroup(groupKey);
        if (rows.length === 0) throw new DayBlockNotFoundError('Blocage introuvable');
        if (rows.every((r) => r.user_id != null)) {
            throw new DayBlockForbiddenError('Ce blocage ne concerne que vous : débloquez-le');
        }
        if (!(await this.blockRepo.allConcernUser(rows.map((r) => r.id), userId))) {
            throw new DayBlockForbiddenError('Ce blocage ne vous concerne pas');
        }
        const days = [...new Set(rows.map((r) => r.day))];
        const mine = await this.blockRepo.findPersonalOnDays(userId, days);
        if (mine.some((r) => r.kind === 'BLOCK')) {
            throw new DayBlockConflictError('Ces jours sont déjà bloqués pour vous');
        }
        const openDays = new Set(mine.filter((r) => r.kind === 'OPEN').map((r) => r.day));
        if (days.every((day) => openDays.has(day))) {
            await this.blockRepo.deleteOpenDays(userId, days);
            return;
        }
        await this.blockRepo.save({
            days: days.filter((day) => !openDays.has(day)),
            userId,
            scope: 'SELF',
            kind: 'OPEN',
            reason: rows[0].reason,
            createdBy: userId,
            groupKey: '',
        });
    }

    /**
     * Annule un jour. Un blocage personnel ne peut être annulé que par son
     * auteur ; un blocage collectif est supprimé pour tout le monde par son
     * auteur ou un responsable (mêmes règles que l'annulation d'une période).
     */
    async deleteDayBlock(actor: User, id: number): Promise<void> {
        const block = await this.blockRepo.findById(id);
        if (!block || block.kind !== 'BLOCK') throw new DayBlockNotFoundError('Blocage introuvable');
        if (block.user_id != null) {
            if (block.user_id !== actor.id) throw new DayBlockForbiddenError('Ce blocage ne vous appartient pas');
            await this.blockRepo.deleteById(block.id);
            return;
        }
        if (!canAccessAllSectors(actor.permission) && block.created_by !== actor.id) {
            throw new DayBlockForbiddenError('Seul l’auteur du blocage (ou un responsable) peut l’annuler');
        }
        await this.blockRepo.deleteCollectiveDay(block.id, block.day);
    }

    /**
     * Annule toute une période. Un blocage personnel reste réservé à son auteur ;
     * un blocage collectif peut être annulé par son auteur ou un responsable.
     */
    async deleteBlockGroup(actor: User, groupKey: string): Promise<void> {
        const rows = await this.blockRepo.findGroup(groupKey);
        if (rows.length === 0) throw new DayBlockNotFoundError('Blocage introuvable');
        const personal = rows.every((r) => r.user_id != null);
        if (personal) {
            if (rows.some((r) => r.user_id !== actor.id)) {
                throw new DayBlockForbiddenError('Ce blocage ne vous appartient pas');
            }
        } else if (!canAccessAllSectors(actor.permission) && rows.some((r) => r.created_by !== actor.id)) {
            throw new DayBlockForbiddenError('Seul l’auteur du blocage (ou un responsable) peut l’annuler');
        }
        await this.blockRepo.deleteGroup(groupKey);
    }

    async update(userId: number, patch: Partial<BookingSettings>): Promise<BookingSettings> {
        await this.getOrCreate(userId);
        return this.repo.update(userId, patch);
    }

    async findBySlug(slug: string): Promise<BookingSettings | null> {
        return this.repo.findBySlug(slug);
    }

    /** Hôte (avec tokens Google) d'un slug, ou null si introuvable / non connecté. */
    private async hostFor(settings: BookingSettings): Promise<User | null> {
        const host = await userService.findById(settings.userId);
        return host?.oauthToken ? host : null;
    }

    /**
     * Créneaux libres entre `fromDate` et `toDate` (dates locales YYYY-MM-DD incluses),
     * bornés par le préavis minimum et l'horizon max, en retirant les périodes occupées.
     */
    async computeSlots(settings: BookingSettings, fromDate: string, toDate: string): Promise<Slot[]> {
        if (!settings.enabled) throw new BookingDisabledError('Réservation désactivée');
        const host = await this.hostFor(settings);
        if (!host) throw new BookingDisabledError('Agenda de l’hôte non connecté');

        const now = Date.now();
        const earliest = now + settings.minNoticeHours * 3600_000;
        const horizon = now + settings.maxDaysAhead * 86_400_000;

        const tz = settings.timezone;
        const stepMs = (settings.durationMin + settings.bufferMin) * 60_000;
        const durMs = settings.durationMin * 60_000;

        // Bornes de la requête freebusy : du début du 1er jour à la fin du dernier (en UTC).
        const [fy, fm, fd] = fromDate.split('-').map(Number);
        const [ty, tm, td] = toDate.split('-').map(Number);
        const rangeStart = zonedToUtc(fy, fm, fd, 0, 0, tz);
        const rangeEnd = zonedToUtc(ty, tm, td, 23, 59, tz);
        const busy = await calendarForUser(host).freeBusy(rangeStart.toISOString(), rangeEnd.toISOString());
        // Jours bloqués par le RH (ou par un blocage « pour tout le monde ») :
        // ils ne sont jamais proposés, quelles que soient les plages hebdomadaires.
        const blockedDays = await this.blockRepo.blockedDays(settings.userId, fromDate, toDate);

        const slots: Slot[] = [];
        for (let cur = new Date(rangeStart); cur <= rangeEnd; cur.setUTCDate(cur.getUTCDate() + 1)) {
            // Composantes calendaires locales du jour courant.
            const local = new Intl.DateTimeFormat('en-CA', {
                timeZone: tz,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            }).format(cur);
            if (blockedDays.has(local)) continue;
            const [y, mo, d] = local.split('-').map(Number);
            const windows = settings.workingHours[String(isoWeekday(y, mo, d))] ?? [];
            for (const [startHM, endHM] of windows) {
                const [sh, sm] = parseHM(startHM);
                const [eh, em] = parseHM(endHM);
                const winEnd = zonedToUtc(y, mo, d, eh, em, tz).getTime();
                let slotStart = zonedToUtc(y, mo, d, sh, sm, tz).getTime();
                while (slotStart + durMs <= winEnd) {
                    const slotEnd = slotStart + durMs;
                    if (slotStart >= earliest && slotStart <= horizon && !overlapsBusy(slotStart, slotEnd, busy)) {
                        slots.push({ start: new Date(slotStart).toISOString(), end: new Date(slotEnd).toISOString() });
                    }
                    slotStart += stepMs;
                }
            }
        }
        return slots;
    }

    /** Réserve un créneau : revérifie la disponibilité puis crée l'event Google avec l'invité. */
    async book(settings: BookingSettings, startIso: string, guest: GuestInfo): Promise<{ start: string; end: string }> {
        if (!settings.enabled) throw new BookingDisabledError('Réservation désactivée');
        const host = await this.hostFor(settings);
        if (!host) throw new BookingDisabledError('Agenda de l’hôte non connecté');

        const startMs = Date.parse(startIso);
        if (Number.isNaN(startMs)) throw new SlotUnavailableError('Créneau invalide');
        const endMs = startMs + settings.durationMin * 60_000;

        // Revérifie côté serveur que le créneau est toujours libre (anti double-réservation).
        const day = new Intl.DateTimeFormat('en-CA', {
            timeZone: settings.timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(new Date(startMs));
        const available = await this.computeSlots(settings, day, day);
        if (!available.some((s) => Date.parse(s.start) === startMs)) {
            throw new SlotUnavailableError('Créneau plus disponible');
        }

        const startIsoFinal = new Date(startMs).toISOString();
        const endIsoFinal = new Date(endMs).toISOString();
        const calendar = calendarForUser(host);
        const fullName = guestFullName(guest);
        const description = [
            `Réservation par ${fullName} (${guest.email}, ${guest.phone}).`,
            guest.note ? `\nMessage : ${guest.note}` : '',
        ].join('');

        // Un rendez-vous pris via le lien de réservation est un entretien : il porte le
        // même marquage qu'un créneau posé depuis le calendrier RH (« venu » ouvre la
        // création du candidat, report possible, relance « pas venu », KPI entretiens).
        // Le nom et l'email de l'invité sont stockés en propriétés privées pour le
        // pré-remplissage de la fiche et le dédoublonnage KPI par email (cf. RhKpiService).
        const countsForKpi = await rhKpiService.isFirstMeetingForEmail(calendar, guest.email, startIsoFinal);
        await calendar.createEvent(
            {
                summary: `${settings.title} — ${fullName}`,
                description,
                location: settings.location ?? undefined,
                start: startIsoFinal,
                end: endIsoFinal,
                attendees: [{ email: guest.email, displayName: fullName }],
                attendeeEmail: guest.email,
                attendeeFirstName: guest.firstName,
                attendeeLastName: guest.lastName,
                isInterview: true,
            },
            'none', // Pas d'email d'invitation Google : on envoie notre propre confirmation.
        );

        // KPI « entretien placé » au profit du RH dont le lien a été utilisé, crédité au
        // bucket de la date (un seul rendez-vous compté par email, comme côté calendrier).
        if (countsForKpi) {
            await rhKpiService.bump(host.id, primarySector(host.sectors), new Date(startIsoFinal), {
                interviews_placed: 1,
            });
        }

        await this.sendConfirmation(host, settings, startIsoFinal, guest);

        return { start: startIsoFinal, end: endIsoFinal };
    }

    /** Envoie un email de confirmation personnalisé à l'invité, via le compte Gmail de l'hôte. */
    private async sendConfirmation(
        host: User,
        settings: BookingSettings,
        startIso: string,
        guest: GuestInfo,
    ): Promise<void> {
        const when = formatInTz(startIso, settings.timezone);
        const guestName = guestFullName(guest);

        let subject: string;
        let html: string;
        let text: string;

        if (settings.confirmationBody && settings.confirmationBody.trim()) {
            // Modèle personnalisé : on remplace les variables {{…}}.
            const vars: Record<string, string> = {
                nom: guestName,
                prenom: guest.firstName,
                telephone: guest.phone,
                date: `${when} (${settings.timezone})`,
                ...dateVars(startIso, settings.timezone),
                lieu: settings.location ?? '',
                titre: settings.title,
                duree: `${settings.durationMin} minutes`,
                hote: `${host.firstName} ${host.lastName}`.trim(),
            };
            subject = renderTemplate(
                settings.confirmationSubject || `Confirmation de votre rendez-vous — ${settings.title}`,
                vars,
            );
            html = renderTemplate(settings.confirmationBody, vars);
            text = html.replace(/<[^>]+>/g, ''); // version texte basique
        } else {
            // Mail par défaut.
            subject = `Confirmation de votre rendez-vous — ${settings.title}`;
            const lieu = settings.location ? `<p><strong>Lieu :</strong> ${settings.location}</p>` : '';
            html = `
            <p>Bonjour ${guestName},</p>
            <p>Votre rendez-vous « <strong>${
                settings.title
            }</strong> » avec ${`${host.firstName} ${host.lastName}`.trim()} est confirmé.</p>
            <p><strong>Date :</strong> ${when} (${settings.timezone})</p>
            <p><strong>Durée :</strong> ${settings.durationMin} minutes</p>
            ${lieu}
            <p>À bientôt,<br/>${`${host.firstName} ${host.lastName}`.trim()}</p>`;
            text =
                `Bonjour ${guestName},\n\nVotre rendez-vous « ${
                    settings.title
                } » avec ${`${host.firstName} ${host.lastName}`.trim()} est confirmé.\n` +
                `Date : ${when} (${settings.timezone})\nDurée : ${settings.durationMin} minutes\n` +
                `${
                    settings.location ? `Lieu : ${settings.location}\n` : ''
                }\nÀ bientôt,\n${`${host.firstName} ${host.lastName}`.trim()}`;
        }

        // Signature de l'hôte ajoutée à tous les mails (best-effort).
        const signatureHtml = await mailTemplateService.getSignatureHtml(host.id, 'rh').catch(() => '');
        if (signatureHtml) html += signatureHtml;

        try {
            await gmailService.sendEmail(
                { access_token: host.oauthToken ?? undefined, refresh_token: host.refreshToken ?? undefined },
                withNoReply({ to: guest.email, subject, html, text }),
                (refreshed) =>
                    userService.updateGoogleTokens(
                        host.id,
                        refreshed.access_token ?? null,
                        refreshed.refresh_token ?? null,
                    ),
            );
        } catch (err) {
            // L'event est déjà créé : on n'échoue pas la réservation si l'email échoue.
            logger.error({ err }, 'Booking confirmation email failed');
        }
    }
}
