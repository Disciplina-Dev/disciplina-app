import { FormateurHistoryRepository } from '../repositories/mongo/FormateurHistoryRepository';
import { FormateurRepository, normalizeFormateurEmail } from '../repositories/mongo/FormateurRepository';
import { SeanceRepository } from '../repositories/mongo/SeanceRepository';
import {
    FORMATEUR_CHANGE_FIELDS,
    Formateur,
    FormateurChange,
    FormateurChangeField,
    FormateurHistoryEntry,
} from '../types/formateur.types';
import { Seance, SeanceMode, SeanceSite, SeanceValidationStatus } from '../types/emargement.types';
import { plannedMinutesOfSeance, seanceValidationStatus } from './emargementHours';
import { httpError } from './httpError';
import { passwordPolicyViolations, permissionToId, roleToId, UserService } from './UserService';
import { UserDeletionError, UserDeletionService } from './UserDeletionService';
import { JobRole, Permission } from '../types/user.types';
import { localDate } from '../utils/zonedTime';
import { tenantTimezone } from '../config/tenant';

const NAME_MAX = 120;
const EMAIL_MAX = 200;
const PHONE_MAX = 40;
const COMMENT_MAX = 2000;
const NOTE_MAX = 2000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Une session animée, avec ses compteurs, pour le résumé de la fiche. */
export interface FormateurSessionStatDto {
    id: string;
    nom: string;
    degreeTitle: string | null;
    seanceCount: number;
    plannedMinutes: number;
}

export interface FormateurStatsDto {
    seanceCount: number;
    /** Heures de cours planifiées (pause déjeuner exclue), indépendantes des présences. */
    plannedMinutes: number;
    sessionCount: number;
    firstSeanceDate: string | null;
    lastSeanceDate: string | null;
    sessions: FormateurSessionStatDto[];
}

export interface FormateurDto {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    comment: string | null;
    createdAt: string;
    updatedAt: string;
    /** Accès à l'espace formateur. `userId: null` = fiche sans compte. */
    account: FormateurAccountDto;
    stats: FormateurStatsDto;
}

export interface FormateurAccountDto {
    userId: number | null;
}

/** Accueil de l'espace formateur : la prochaine séance et deux compteurs. */
export interface FormateurDashboardDto {
    formateur: { id: string; name: string; email: string };
    /** Première séance dont la date est aujourd'hui ou plus tard (fuseau du tenant). */
    nextSeance: FormateurSeanceDto | null;
    upcomingSeanceCount: number;
    pastSeanceCount: number;
}

/** Une séance de l'historique d'un formateur. */
export interface FormateurSeanceDto {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    sessionId: string;
    sessionNom: string;
    degreeTitle: string | null;
    module: string | null;
    location: string | null;
    site: SeanceSite;
    mode: SeanceMode;
    plannedMinutes: number;
    validationStatus: SeanceValidationStatus;
}

export type FormateurChangeDto = FormateurChange;

export interface FormateurHistoryDto {
    id: string;
    at: string;
    action: FormateurHistoryEntry['action'];
    changes: FormateurChangeDto[];
    note: string | null;
    actorName: string | null;
}

export interface FormateurDetailDto extends FormateurDto {
    seances: FormateurSeanceDto[];
    history: FormateurHistoryDto[];
}

/** Formateur retenu pour une séance (création automatique si inconnu). */
export interface ResolvedFormateur {
    id: string;
    name: string;
    email: string;
}

export interface FormateurSeanceLinkInput {
    id?: string | null;
    name: string;
    email: string;
}

function requiredName(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) {
        throw httpError(400, 'validation', 'Le nom du formateur est requis');
    }
    const trimmed = value.trim();
    if (trimmed.length > NAME_MAX) throw httpError(400, 'validation', 'Le nom du formateur est trop long');
    return trimmed;
}

function requiredEmail(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) {
        throw httpError(400, 'validation', 'L’e-mail du formateur est requis');
    }
    const trimmed = value.trim();
    if (trimmed.length > EMAIL_MAX) throw httpError(400, 'validation', 'L’e-mail du formateur est trop long');
    if (!EMAIL_PATTERN.test(trimmed)) throw httpError(400, 'validation', 'L’e-mail du formateur est invalide');
    return normalizeFormateurEmail(trimmed);
}

function optionalText(value: unknown, label: string, maxLength: number): string | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') throw httpError(400, 'validation', `${label} est invalide`);
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > maxLength) throw httpError(400, 'validation', `${label} est trop long`);
    return trimmed;
}

function toIso(value: Date | string): string {
    return new Date(value).toISOString();
}

/**
 * `users` porte un prénom et un nom séparés, la fiche un nom libre. On coupe au
 * premier espace : « Jean Dupont » → Jean / Dupont. Les noms composés restent
 * entiers côté nom de famille.
 */
function splitName(name: string): { firstName: string; lastName: string } {
    const parts = name.trim().split(/\s+/);
    const firstName = parts.shift() ?? name.trim();
    return { firstName, lastName: parts.join(' ') };
}

/** Mot de passe d'un compte formateur : mêmes règles que les comptes créés par un admin. */
function requiredPassword(value: unknown): string {
    if (typeof value !== 'string' || !value) {
        throw httpError(400, 'validation', 'Le mot de passe est requis');
    }
    const violations = passwordPolicyViolations(value);
    if (violations.length > 0) {
        throw httpError(400, 'validation', `Mot de passe trop faible : il faut ${violations.join(', ')}.`);
    }
    return value;
}

function seanceDto(seance: Seance, now: Date): FormateurSeanceDto {
    return {
        id: seance._id,
        date: seance.date,
        startTime: seance.start_time,
        endTime: seance.end_time,
        sessionId: seance.session_id,
        sessionNom: seance.session_nom,
        degreeTitle: seance.degree_title ?? null,
        module: seance.module ?? null,
        location: seance.location ?? null,
        site: seance.site,
        mode: seance.mode,
        plannedMinutes: plannedMinutesOfSeance(seance),
        validationStatus: seanceValidationStatus(seance, now),
    };
}

/** Résumé chiffré : volume de séances, heures de cours et sessions animées. */
function statsOf(seances: Seance[]): FormateurStatsDto {
    const sessions = new Map<string, FormateurSessionStatDto>();
    let plannedMinutes = 0;
    for (const seance of seances) {
        const minutes = plannedMinutesOfSeance(seance);
        plannedMinutes += minutes;
        const entry = sessions.get(seance.session_id) ?? {
            id: seance.session_id,
            nom: seance.session_nom,
            degreeTitle: seance.degree_title ?? null,
            seanceCount: 0,
            plannedMinutes: 0,
        };
        entry.seanceCount += 1;
        entry.plannedMinutes += minutes;
        sessions.set(seance.session_id, entry);
    }
    const dates = seances.map((seance) => seance.date).sort();
    return {
        seanceCount: seances.length,
        plannedMinutes,
        sessionCount: sessions.size,
        firstSeanceDate: dates[0] ?? null,
        lastSeanceDate: dates[dates.length - 1] ?? null,
        sessions: [...sessions.values()].sort((a, b) => b.seanceCount - a.seanceCount || a.nom.localeCompare(b.nom)),
    };
}

function historyDto(entry: FormateurHistoryEntry): FormateurHistoryDto {
    return {
        id: entry._id,
        at: toIso(entry.at),
        action: entry.action,
        changes: (entry.changes ?? []).map((change) => ({
            field: change.field,
            from: change.from ?? null,
            to: change.to ?? null,
        })),
        note: entry.note ?? null,
        actorName: entry.actor_name ?? null,
    };
}

export class FormateurService {
    constructor(
        private readonly formateurs = new FormateurRepository(),
        private readonly history = new FormateurHistoryRepository(),
        private readonly seances = new SeanceRepository(),
        private readonly users = new UserService(),
        private readonly userDeletion = new UserDeletionService(),
    ) {}

    /** Annuaire complet avec les compteurs de chaque fiche. */
    async list(): Promise<FormateurDto[]> {
        const [formateurs, seances] = await Promise.all([this.formateurs.findAll(), this.seances.findAllForStats()]);
        const byId = new Map<string, Seance[]>();
        const byEmail = new Map<string, Seance[]>();
        for (const seance of seances) {
            if (seance.formateur_id) {
                const rows = byId.get(seance.formateur_id) ?? [];
                rows.push(seance);
                byId.set(seance.formateur_id, rows);
                continue;
            }
            const key = normalizeFormateurEmail(seance.formateur_email);
            const rows = byEmail.get(key) ?? [];
            rows.push(seance);
            byEmail.set(key, rows);
        }
        return formateurs.map((formateur) =>
            this.toDto(formateur, [...(byId.get(formateur._id) ?? []), ...(byEmail.get(formateur.email) ?? [])]),
        );
    }

    /** Fiche complète : coordonnées, résumé, historique des séances et journal des saisies. */
    async get(id: string): Promise<FormateurDetailDto> {
        const formateur = await this.requireFormateur(id);
        const [seances, history] = await Promise.all([
            this.seances.findByFormateur(formateur._id, formateur.email),
            this.history.findByFormateur(formateur._id),
        ]);
        const now = new Date();
        return {
            ...this.toDto(formateur, seances),
            seances: seances.map((seance) => seanceDto(seance, now)),
            history: history.map(historyDto),
        };
    }

    async create(input: unknown, userId?: number): Promise<FormateurDetailDto> {
        const data = this.parseCreate(input);
        const existing = await this.formateurs.findByEmail(data.email);
        if (existing) throw httpError(409, 'email', 'Un formateur utilise déjà cet e-mail');

        const formateur = await this.formateurs.create({
            name: data.name,
            email: data.email,
            phone: data.phone,
            comment: data.comment,
            user_id: null,
            created_by: userId ?? null,
        });
        await this.record(formateur._id, 'formateur_created', [], null, userId);
        return this.get(formateur._id);
    }

    async update(id: string, input: unknown, userId?: number): Promise<FormateurDetailDto> {
        const formateur = await this.requireFormateur(id);
        const data = this.parseUpdate(input, formateur);
        if (data.email !== formateur.email) {
            const existing = await this.formateurs.findByEmail(data.email);
            if (existing && existing._id !== formateur._id) {
                throw httpError(409, 'email', 'Un formateur utilise déjà cet e-mail');
            }
            // Le compte de connexion porte le même e-mail : on refuse le
            // changement s'il est déjà pris par un autre compte, avant d'écrire
            // quoi que ce soit (sinon fiche et compte divergeraient). La
            // recherche inclut les comptes supprimés : leur adresse reste
            // occupée par la contrainte d'unicité de `users.email`.
            if (formateur.user_id != null) {
                const clash = await this.users.findByEmailIncludingDeleted(data.email);
                if (clash && clash.id !== formateur.user_id) {
                    throw httpError(409, 'email', 'Un compte utilise déjà cet e-mail');
                }
            }
        }

        const changes = this.diff(formateur, data);
        if (changes.length > 0) {
            await this.formateurs.update(formateur._id, data);
            // Le compte de connexion suit la fiche : même e-mail, mêmes nom et prénom.
            if (formateur.user_id != null && (data.email !== formateur.email || data.name !== formateur.name)) {
                const { firstName, lastName } = splitName(data.name);
                await this.users.updateUser(formateur.user_id, { email: data.email, firstName, lastName });
            }
            await this.record(formateur._id, 'formateur_updated', changes, null, userId);
        }
        return this.get(formateur._id);
    }

    /** Note libre du Peda, append-only : elle ne modifie jamais les coordonnées. */
    async addNote(id: string, input: unknown, userId?: number): Promise<FormateurDetailDto> {
        const formateur = await this.requireFormateur(id);
        const note = optionalText((input as Record<string, unknown> | null)?.note, 'La note', NOTE_MAX);
        if (!note) throw httpError(400, 'validation', 'La note est requise');
        await this.record(formateur._id, 'note', [], note, userId);
        return this.get(formateur._id);
    }

    // ── Compte de connexion (espace formateur) ──────────────────────────
    //
    // Le formateur se connecte par la page de login comme le staff, mais son
    // compte est créé, réinitialisé et supprimé depuis la fiche : il n'apparaît
    // ni dans l'administration des utilisateurs, ni dans l'annuaire.

    /** Crée le compte `users` (rôle FORMATEUR, permission EMPLOYEE) de la fiche. */
    async createAccount(id: string, input: unknown, userId: number): Promise<FormateurDetailDto> {
        const formateur = await this.requireFormateur(id);
        if (formateur.user_id != null) {
            throw httpError(409, 'account_exists', 'Ce formateur a déjà un compte');
        }
        const password = requiredPassword((input as Record<string, unknown> | null)?.password);
        const { firstName, lastName } = splitName(formateur.name);

        let accountId: number;
        try {
            const account = await this.users.register(
                formateur.email,
                firstName,
                lastName,
                password,
                roleToId(JobRole.FORMATEUR),
                permissionToId(Permission.EMPLOYEE),
            );
            accountId = account.id;
        } catch (error) {
            if (error instanceof Error && error.message === 'User already exists') {
                throw httpError(409, 'email', 'Un compte utilise déjà cet e-mail');
            }
            throw error;
        }

        await this.formateurs.update(formateur._id, { user_id: accountId });
        await this.record(formateur._id, 'account_created', [], null, userId);
        return this.get(formateur._id);
    }

    /**
     * Réinitialise le mot de passe du compte et révoque ses sessions : un mot de
     * passe changé par un tiers doit fermer les appareils déjà connectés.
     */
    async resetAccountPassword(id: string, input: unknown, userId: number): Promise<FormateurDetailDto> {
        const formateur = await this.requireFormateur(id);
        if (formateur.user_id == null) throw httpError(404, 'no_account', 'Ce formateur n’a pas de compte');
        const password = requiredPassword((input as Record<string, unknown> | null)?.password);
        const account = await this.users.updateUser(formateur.user_id, { passwordPlain: password });
        if (!account) throw httpError(404, 'no_account', 'Compte introuvable');
        await this.users.revokeAllSessions(formateur.user_id);
        await this.record(formateur._id, 'account_password_reset', [], null, userId);
        return this.get(formateur._id);
    }

    /** Retire l'accès : le compte est soft-deleted, la fiche reste. */
    async deleteAccount(id: string, userId: number): Promise<FormateurDetailDto> {
        const formateur = await this.requireFormateur(id);
        if (formateur.user_id == null) throw httpError(404, 'no_account', 'Ce formateur n’a pas de compte');
        await this.deleteUserAccount(formateur.user_id, userId);
        await this.formateurs.update(formateur._id, { user_id: null });
        await this.record(formateur._id, 'account_deleted', [], null, userId);
        return this.get(formateur._id);
    }

    /**
     * Supprime la fiche : compte de connexion d'abord (soft delete `users`), puis
     * la fiche elle-même. Le journal (`formateur_history`) est conservé comme
     * trace des saisies, et les séances sont déliées pour que leur rattachement
     * par e-mail reprenne la main si une fiche est recréée.
     */
    async remove(id: string, userId: number): Promise<void> {
        const formateur = await this.requireFormateur(id);
        if (formateur.user_id != null) {
            await this.deleteUserAccount(formateur.user_id, userId);
        }
        await this.seances.unlinkFormateur(formateur._id);
        await this.record(formateur._id, 'formateur_deleted', [], `Fiche supprimée (${formateur.email})`, userId);
        await this.formateurs.delete(formateur._id);
    }

    /**
     * Accueil de l'espace formateur, résolu par le compte de connexion — jamais
     * par un identifiant reçu du client. Un compte sans fiche rattachée est
     * refusé (403) : c'est le garde-fou qui empêche un formateur d'atteindre les
     * données d'un autre.
     */
    async dashboardForUser(userId: number): Promise<FormateurDashboardDto> {
        const formateur = await this.formateurs.findByUserId(userId);
        if (!formateur) {
            throw httpError(403, 'no_formateur', 'Aucune fiche formateur n’est rattachée à ce compte');
        }
        const seances = await this.seances.findByFormateur(formateur._id, formateur.email);
        const now = new Date();
        const today = localDate(now, tenantTimezone());
        const upcoming = seances
            .filter((seance) => seance.date >= today)
            .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
        return {
            formateur: { id: formateur._id, name: formateur.name, email: formateur.email },
            nextSeance: upcoming[0] ? seanceDto(upcoming[0], now) : null,
            upcomingSeanceCount: upcoming.length,
            pastSeanceCount: seances.length - upcoming.length,
        };
    }

    private async deleteUserAccount(targetUserId: number, actorUserId: number): Promise<void> {
        try {
            await this.userDeletion.deleteUser(actorUserId, targetUserId);
        } catch (error) {
            if (error instanceof UserDeletionError) throw httpError(error.status, 'account', error.message);
            throw error;
        }
    }

    /**
     * Retrouve ou crée la fiche d'un formateur au moment d'enregistrer une
     * séance. Un id fourni est prioritaire ; sinon l'e-mail normalisé fait foi,
     * et une fiche est créée si l'adresse est inconnue (saisie libre du Peda).
     * Le nom et l'e-mail retenus sont ceux de l'annuaire, pour que la feuille et
     * la fiche ne divergent pas.
     */
    async resolveForSeance(input: FormateurSeanceLinkInput, userId?: number): Promise<ResolvedFormateur> {
        if (input.id) {
            const linked = await this.formateurs.findById(input.id);
            if (linked) return { id: linked._id, name: linked.name, email: linked.email };
        }
        const email = normalizeFormateurEmail(input.email);
        const existing = await this.formateurs.findByEmail(email);
        if (existing) return { id: existing._id, name: existing.name, email: existing.email };

        const formateur = await this.formateurs.create({
            name: input.name.trim(),
            email,
            phone: null,
            comment: null,
            user_id: null,
            created_by: userId ?? null,
        });
        await this.record(formateur._id, 'formateur_created', [], null, userId);
        return { id: formateur._id, name: formateur.name, email: formateur.email };
    }

    private toDto(formateur: Formateur, seances: Seance[]): FormateurDto {
        return {
            id: formateur._id,
            name: formateur.name,
            email: formateur.email,
            phone: formateur.phone ?? null,
            comment: formateur.comment ?? null,
            createdAt: toIso(formateur.created_at),
            updatedAt: toIso(formateur.updated_at),
            account: { userId: formateur.user_id ?? null },
            stats: statsOf(seances),
        };
    }

    private async requireFormateur(id: string): Promise<Formateur> {
        const formateur = await this.formateurs.findById(id);
        if (!formateur) throw httpError(404, 'not_found', 'Formateur introuvable');
        return formateur;
    }

    private parseCreate(input: unknown): {
        name: string;
        email: string;
        phone: string | null;
        comment: string | null;
    } {
        const data = (input ?? {}) as Record<string, unknown>;
        return {
            name: requiredName(data.name),
            email: requiredEmail(data.email),
            phone: optionalText(data.phone, 'Le téléphone', PHONE_MAX),
            comment: optionalText(data.comment, 'Le commentaire', COMMENT_MAX),
        };
    }

    /** Mise à jour partielle : un champ absent conserve sa valeur actuelle. */
    private parseUpdate(
        input: unknown,
        current: Formateur,
    ): { name: string; email: string; phone: string | null; comment: string | null } {
        const data = (input ?? {}) as Record<string, unknown>;
        return {
            name: data.name !== undefined ? requiredName(data.name) : current.name,
            email: data.email !== undefined ? requiredEmail(data.email) : current.email,
            phone:
                data.phone !== undefined
                    ? optionalText(data.phone, 'Le téléphone', PHONE_MAX)
                    : (current.phone ?? null),
            comment:
                data.comment !== undefined
                    ? optionalText(data.comment, 'Le commentaire', COMMENT_MAX)
                    : (current.comment ?? null),
        };
    }

    /** Diff des champs modifiés, dans l'ordre du référentiel. */
    private diff(
        current: Formateur,
        next: { name: string; email: string; phone: string | null; comment: string | null },
    ): FormateurChange[] {
        const changes: FormateurChange[] = [];
        for (const field of FORMATEUR_CHANGE_FIELDS) {
            const before = current[field as keyof Formateur] as string | null | undefined;
            if ((before ?? null) !== next[field]) {
                changes.push({ field: field as FormateurChangeField, from: before ?? null, to: next[field] });
            }
        }
        return changes;
    }

    private async record(
        formateurId: string,
        action: FormateurHistoryEntry['action'],
        changes: FormateurChange[],
        note: string | null,
        userId?: number,
    ): Promise<void> {
        await this.history.record({
            formateur_id: formateurId,
            action,
            changes,
            note,
            actor_id: userId ?? null,
            actor_name: await this.actorName(userId),
        });
    }

    private async actorName(userId?: number): Promise<string | null> {
        if (userId == null) return null;
        const user = await this.users.findById(userId);
        return user ? `${user.firstName} ${user.lastName}`.trim() : null;
    }
}
