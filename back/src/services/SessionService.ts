import { SessionRepository } from '../repositories/mongo/SessionRepository';
import { AlternantRepository } from '../repositories/mongo/AlternantRepository';
import { JOURS_COURS, Session } from '../types/session.types';
import { logger } from '../external/logger';

export interface CreateSessionInput {
    nom: string;
    filiere?: string | null;
    jourCours?: string | null;
    dateDebut: string;
    dateFin: string;
}

export interface UpdateSessionInput {
    nom?: string;
    filiere?: string | null;
    jourCours?: string | null;
    dateDebut?: string;
    dateFin?: string;
}

function requireNonBlank(value: string | undefined, field: string): string {
    const trimmed = value?.trim() ?? '';
    if (!trimmed) throw new Error(`${field} est obligatoire`);
    return trimmed;
}

function requireValidDate(iso: string | undefined, field: string): Date {
    if (!iso) throw new Error(`${field} est obligatoire`);
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) throw new Error(`${field} invalide`);
    return d;
}

function normalizeJourCours(value: string | null | undefined): string | null {
    const trimmed = value?.trim() ?? '';
    if (!trimmed) return null;
    if (!(JOURS_COURS as readonly string[]).includes(trimmed)) {
        throw new Error(`Jour de cours invalide (attendu : ${JOURS_COURS.join(', ')})`);
    }
    return trimmed;
}

export class SessionService {
    private sessions = new SessionRepository();
    private alternants = new AlternantRepository();

    async findAll(search?: string): Promise<Session[]> {
        return this.sessions.findAll(search);
    }

    async findById(id: string): Promise<Session | null> {
        return this.sessions.findById(id);
    }

    async create(input: CreateSessionInput): Promise<Session> {
        const nom = requireNonBlank(input.nom, 'Le nom de la session');
        const dateDebut = requireValidDate(input.dateDebut, 'La date de début');
        const dateFin = requireValidDate(input.dateFin, 'La date de fin');
        if (dateFin.getTime() < dateDebut.getTime()) {
            throw new Error('La date de fin doit être postérieure à la date de début');
        }
        const duplicate = await this.sessions.findByNom(nom);
        if (duplicate) throw new Error('Une session existe déjà avec ce nom');

        const created = await this.sessions.create({
            nom,
            filiere: input.filiere?.trim() || null,
            jour_cours: normalizeJourCours(input.jourCours),
            date_debut: dateDebut,
            date_fin: dateFin,
        });
        logger.info({ sessionId: created._id }, 'Session créée');
        return created;
    }

    async update(id: string, input: UpdateSessionInput): Promise<Session | null> {
        const existing = await this.sessions.findById(id);
        if (!existing) return null;
        const patch: Record<string, unknown> = {};
        if (input.nom !== undefined) {
            const nom = requireNonBlank(input.nom, 'Le nom de la session');
            const duplicate = await this.sessions.findByNom(nom);
            if (duplicate && duplicate._id !== id) throw new Error('Une session existe déjà avec ce nom');
            patch.nom = nom;
        }
        if (input.filiere !== undefined) patch.filiere = input.filiere?.trim() || null;
        if (input.jourCours !== undefined) patch.jour_cours = normalizeJourCours(input.jourCours);

        const nextDebut = input.dateDebut !== undefined ? requireValidDate(input.dateDebut, 'La date de début') : null;
        const nextFin = input.dateFin !== undefined ? requireValidDate(input.dateFin, 'La date de fin') : null;
        const debut = nextDebut ?? new Date(existing.date_debut);
        const fin = nextFin ?? new Date(existing.date_fin);
        if (fin.getTime() < debut.getTime()) {
            throw new Error('La date de fin doit être postérieure à la date de début');
        }
        if (nextDebut) patch.date_debut = nextDebut;
        if (nextFin) patch.date_fin = nextFin;

        const updated = await this.sessions.update(id, patch);
        // Le nom est dénormalisé sur les alternants : on le resynchronise.
        if (updated && patch.nom !== undefined) {
            const members = await this.alternants.findBySessionId(id);
            for (const member of members) {
                await this.alternants.update(member._id, { session: updated.nom });
            }
        }
        logger.info({ sessionId: id }, 'Session modifiée');
        return updated;
    }

    async delete(id: string): Promise<boolean> {
        const existing = await this.sessions.findById(id);
        if (!existing) return false;
        // Les alternants gardent leur libellé `session` mais sont désassignés.
        const members = await this.alternants.findBySessionId(id);
        for (const member of members) {
            await this.alternants.update(member._id, { session_id: null });
        }
        logger.info({ sessionId: id }, 'Session supprimée');
        return this.sessions.delete(id);
    }

    /** Assigne un alternant à une session (met à jour session_id + libellé). */
    async assignAlternant(sessionId: string, alternantId: string): Promise<Session | null> {
        const session = await this.sessions.findById(sessionId);
        if (!session) throw new Error('Session introuvable');
        const alternant = await this.alternants.findById(alternantId);
        if (!alternant) throw new Error('Alternant introuvable');
        await this.alternants.update(alternantId, { session_id: sessionId, session: session.nom });
        return this.sessions.findById(sessionId);
    }

    /** Retire un alternant d'une session (session_id effacé, libellé conservé). */
    async unassignAlternant(sessionId: string, alternantId: string): Promise<Session | null> {
        const session = await this.sessions.findById(sessionId);
        if (!session) throw new Error('Session introuvable');
        const alternant = await this.alternants.findById(alternantId);
        if (!alternant) throw new Error('Alternant introuvable');
        if ((alternant.session_id ?? null) !== sessionId) return session;
        await this.alternants.update(alternantId, { session_id: null });
        return this.sessions.findById(sessionId);
    }

    async countAlternants(sessionId: string): Promise<number> {
        const members = await this.alternants.findBySessionId(sessionId);
        return members.length;
    }
}
