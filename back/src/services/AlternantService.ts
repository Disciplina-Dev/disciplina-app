import { AlternantRepository } from '../repositories/mongo/AlternantRepository';
import { AlternantSequenceRepository } from '../repositories/mongo/AlternantSequenceRepository';
import { SessionRepository } from '../repositories/mongo/SessionRepository';
import {
    Alternant,
    AlternantCompany,
    AlternantSequence,
    AlternantSequenceContacts,
    AlternantSequenceStatus,
} from '../types/alternant.types';
import { logger } from '../external/logger';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Planning automatique des séquences d'accompagnement :
 * - prise de contact à J+15 (entrée en entreprise),
 * - fin de période d'essai à 10 semaines (70 jours),
 * - puis tous les 4 mois jusqu'à la date de fin en entreprise (incluse).
 * Sans date de fin, on génère les 3 premières (J+15, 10 semaines, +4 mois).
 */
export function buildSaDates(startDate: Date, endDate?: Date | null): Date[] {
    const start = new Date(startDate);
    start.setHours(12, 0, 0, 0);
    const end = endDate ? new Date(endDate) : null;
    if (end) end.setHours(23, 59, 59, 999);
    const within = (d: Date): boolean => !end || d.getTime() <= end.getTime();
    const dates: Date[] = [];
    for (const candidate of [new Date(start.getTime() + 15 * DAY_MS), new Date(start.getTime() + 70 * DAY_MS)]) {
        if (within(candidate)) dates.push(candidate);
    }
    let cursor = new Date(start.getTime() + 70 * DAY_MS);
    for (;;) {
        cursor = new Date(cursor);
        cursor.setMonth(cursor.getMonth() + 4);
        if (end) {
            if (!within(cursor)) break;
            // Évite un doublon quand la fin tombe exactement sur une échéance.
            if (dates.some((d) => d.getTime() === cursor.getTime())) break;
            dates.push(new Date(cursor));
        } else {
            if (dates.length >= 3) break;
            dates.push(new Date(cursor));
        }
        // Garde-fou : jamais plus de 25 échéances auto.
        if (dates.length >= 25) break;
    }
    return dates;
}

export interface CreateAlternantInput {
    firstName: string;
    lastName: string;
    session: string;
    /** Assigne le jeune à une Session existante (le libellé suit le nom). */
    sessionId?: string | null;
    email?: string | null;
    phone?: string | null;
    candidateId?: string | null;
    company: {
        name?: string | null;
        address?: string | null;
        mentorName?: string | null;
        startDate: string;
        endDate?: string | null;
    };
    linkedAlternantIds?: string[];
}

export interface UpdateAlternantInput {
    firstName?: string;
    lastName?: string;
    session?: string;
    /** `null` = désassigner (garde le libellé), chaîne vide ignorée. */
    sessionId?: string | null;
    email?: string | null;
    phone?: string | null;
    candidateId?: string | null;
}

export interface CompanyInput {
    name?: string | null;
    address?: string | null;
    mentorName?: string | null;
    startDate: string;
    endDate?: string | null;
}

function toCompanySnake(input: CompanyInput): AlternantCompany {
    return {
        name: input.name?.trim() || null,
        address: input.address?.trim() || null,
        mentor_name: input.mentorName?.trim() || null,
        start_date: new Date(input.startDate),
        end_date: input.endDate ? new Date(input.endDate) : null,
    };
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

export class AlternantService {
    private alternants = new AlternantRepository();
    private sequences = new AlternantSequenceRepository();
    private sessions = new SessionRepository();

    async findAll(search?: string): Promise<Alternant[]> {
        return this.alternants.findAll(search);
    }

    async count(search?: string): Promise<number> {
        return this.alternants.count(search);
    }

    async findById(id: string): Promise<Alternant | null> {
        return this.alternants.findById(id);
    }

    async findByEmail(email: string): Promise<Alternant | null> {
        return this.alternants.findByEmail(email);
    }

    async findSequences(alternantId: string): Promise<AlternantSequence[]> {
        return this.sequences.findByAlternantId(alternantId);
    }

    async findBySessionId(sessionId: string): Promise<Alternant[]> {
        return this.alternants.findBySessionId(sessionId);
    }

    async create(input: CreateAlternantInput): Promise<Alternant> {
        const firstName = requireNonBlank(input.firstName, 'Le prénom');
        const lastName = requireNonBlank(input.lastName, 'Le nom');
        // Si une Session est choisie, le libellé suit son nom (prioritaire).
        let sessionId: string | null = null;
        let session = input.session?.trim() ?? '';
        if (input.sessionId?.trim()) {
            const linked = await this.sessions.findById(input.sessionId.trim());
            if (!linked) throw new Error('Session introuvable');
            sessionId = linked._id;
            session = linked.nom;
        }
        session = requireNonBlank(session, 'La session');
        const startDate = requireValidDate(input.company?.startDate, "La date d'entrée en entreprise");
        const endDate = input.company?.endDate ? requireValidDate(input.company.endDate, 'La date de fin') : null;
        if (endDate && endDate.getTime() < startDate.getTime()) {
            throw new Error("La date de fin doit être postérieure à la date d'entrée");
        }

        const linkedIds = [...new Set(input.linkedAlternantIds ?? [])];
        if (linkedIds.length > 0) {
            const existing = await this.alternants.findByIds(linkedIds);
            if (existing.length !== linkedIds.length) throw new Error('Alternant lié introuvable');
        }

        const email = input.email?.trim() || null;
        if (email) {
            const duplicate = await this.alternants.findByEmail(email);
            if (duplicate) throw new Error('Un alternant existe déjà avec cet email');
        }

        const created = await this.alternants.create({
            first_name: firstName,
            last_name: lastName,
            session,
            session_id: sessionId,
            email,
            phone: input.phone?.trim() || null,
            candidate_id: input.candidateId ?? null,
            company: toCompanySnake({ ...input.company, startDate: startDate.toISOString() }),
            linked_alternant_ids: linkedIds,
        });

        // Liaison symétrique : chaque jeune lié pointe vers le nouveau.
        for (const linkedId of linkedIds) {
            const other = await this.alternants.findById(linkedId);
            if (other && !other.linked_alternant_ids.includes(created._id)) {
                await this.alternants.update(linkedId, {
                    linked_alternant_ids: [...other.linked_alternant_ids, created._id],
                });
            }
        }

        await this.generateAutoSequences(created._id, startDate, endDate);
        logger.info({ alternantId: created._id }, 'Alternant créé');
        return (await this.alternants.findById(created._id)) ?? created;
    }

    async update(id: string, input: UpdateAlternantInput): Promise<Alternant | null> {
        const patch: Record<string, unknown> = {};
        if (input.firstName !== undefined) patch.first_name = requireNonBlank(input.firstName, 'Le prénom');
        if (input.lastName !== undefined) patch.last_name = requireNonBlank(input.lastName, 'Le nom');
        if (input.sessionId !== undefined) {
            if (input.sessionId === null) {
                patch.session_id = null;
            } else if (input.sessionId.trim()) {
                const linked = await this.sessions.findById(input.sessionId.trim());
                if (!linked) throw new Error('Session introuvable');
                patch.session_id = linked._id;
                patch.session = linked.nom;
            }
        }
        if (input.session !== undefined && patch.session === undefined) {
            patch.session = requireNonBlank(input.session, 'La session');
        }
        if (input.email !== undefined) {
            const nextEmail = input.email?.trim() || null;
            if (nextEmail) {
                const duplicate = await this.alternants.findByEmail(nextEmail);
                if (duplicate && duplicate._id !== id) throw new Error('Un alternant existe déjà avec cet email');
            }
            patch.email = nextEmail;
        }
        if (input.phone !== undefined) patch.phone = input.phone?.trim() || null;
        if (input.candidateId !== undefined) patch.candidate_id = input.candidateId ?? null;
        return this.alternants.update(id, patch);
    }

    async delete(id: string): Promise<boolean> {
        const existing = await this.alternants.findById(id);
        if (!existing) return false;
        await this.sequences.deleteByAlternantId(id);
        // Retire le jeune des listes de suivi commun des autres.
        const linked = await this.alternants.findByIds(existing.linked_alternant_ids);
        for (const other of linked) {
            await this.alternants.update(other._id, {
                linked_alternant_ids: other.linked_alternant_ids.filter((x) => x !== id),
            });
        }
        return this.alternants.delete(id);
    }

    /** Changement d'entreprise : remplace les infos + régénère les SA à venir. */
    async changeCompany(id: string, input: CompanyInput): Promise<Alternant | null> {
        const existing = await this.alternants.findById(id);
        if (!existing) return null;
        const startDate = requireValidDate(input.startDate, "La date d'entrée en entreprise");
        const endDate = input.endDate ? requireValidDate(input.endDate, 'La date de fin') : null;
        if (endDate && endDate.getTime() < startDate.getTime()) {
            throw new Error("La date de fin doit être postérieure à la date d'entrée");
        }
        const updated = await this.alternants.setCompany(id, toCompanySnake(input));
        await this.sequences.deleteAutoPending(id);
        await this.generateAutoSequences(id, startDate, endDate);
        logger.info({ alternantId: id }, 'Entreprise alternant modifiée');
        return updated ? ((await this.alternants.findById(id)) ?? updated) : null;
    }

    /**
     * Le jeune n'a plus d'entreprise : infos entreprise + toutes ses SA
     * supprimées (spéc : séquences d'accompagnement supprimées automatiquement).
     */
    async removeCompany(id: string): Promise<Alternant | null> {
        const existing = await this.alternants.findById(id);
        if (!existing) return null;
        await this.sequences.deleteByAlternantId(id);
        const updated = await this.alternants.setCompany(id, null);
        logger.info({ alternantId: id }, 'Entreprise alternant retirée');
        return updated;
    }

    async linkAlternant(id: string, otherId: string): Promise<Alternant | null> {
        if (id === otherId) throw new Error('Un alternant ne peut pas être lié à lui-même');
        const [current, other] = await Promise.all([this.alternants.findById(id), this.alternants.findById(otherId)]);
        if (!current || !other) throw new Error('Alternant introuvable');
        if (!current.linked_alternant_ids.includes(otherId)) {
            await this.alternants.update(id, { linked_alternant_ids: [...current.linked_alternant_ids, otherId] });
        }
        if (!other.linked_alternant_ids.includes(id)) {
            await this.alternants.update(otherId, { linked_alternant_ids: [...other.linked_alternant_ids, id] });
        }
        return this.alternants.findById(id);
    }

    async unlinkAlternant(id: string, otherId: string): Promise<Alternant | null> {
        const [current, other] = await Promise.all([this.alternants.findById(id), this.alternants.findById(otherId)]);
        if (!current) throw new Error('Alternant introuvable');
        await this.alternants.update(id, {
            linked_alternant_ids: current.linked_alternant_ids.filter((x) => x !== otherId),
        });
        if (other) {
            await this.alternants.update(otherId, {
                linked_alternant_ids: other.linked_alternant_ids.filter((x) => x !== id),
            });
        }
        return this.alternants.findById(id);
    }

    async createManualSequence(alternantId: string, prevueLe: string): Promise<AlternantSequence> {
        const existing = await this.alternants.findById(alternantId);
        if (!existing) throw new Error('Alternant introuvable');
        const date = requireValidDate(prevueLe, 'La date de réalisation');
        const numero = await this.sequences.nextNumero(alternantId);
        return this.sequences.create({
            alternant_id: alternantId,
            numero,
            prevue_le: date,
            status: AlternantSequenceStatus.PENDING,
            contacts: { mentor: false, alternant: false, formateur: false },
            auto_generated: false,
        });
    }

    async updateSequenceContacts(
        sequenceId: string,
        contacts: Partial<AlternantSequenceContacts>,
    ): Promise<AlternantSequence | null> {
        const seq = await this.sequences.findById(sequenceId);
        if (!seq) return null;
        const merged: AlternantSequenceContacts = {
            mentor: contacts.mentor ?? seq.contacts.mentor,
            alternant: contacts.alternant ?? seq.contacts.alternant,
            formateur: contacts.formateur ?? seq.contacts.formateur,
        };
        const patch: Record<string, unknown> = { contacts: merged };
        // Décocher un contact d'une SA réalisée la repasse en attente (la
        // validation 3/3 + date est à refaire). Cocher les 3 ne valide PAS :
        // la SA ne devient réalisée que via `completeSequence` (date + Valider).
        const doneCount = [merged.mentor, merged.alternant, merged.formateur].filter(Boolean).length;
        if (seq.status === AlternantSequenceStatus.DONE && doneCount < 3) {
            patch.status = AlternantSequenceStatus.PENDING;
            patch.realisee_le = null;
        }
        return this.sequences.update(sequenceId, patch);
    }

    /**
     * Valide une SA comme réalisée : exige les 3 contacts + une date de
     * réalisation. Les SA auto-générées suivantes encore en attente sont
     * reprogrammées à partir de cette date (même décalage que l'écart entre
     * la date prévue et la date de réalisation).
     */
    async completeSequence(sequenceId: string, realiseeLe: string): Promise<AlternantSequence | null> {
        const seq = await this.sequences.findById(sequenceId);
        if (!seq) return null;
        const doneCount = [seq.contacts.mentor, seq.contacts.alternant, seq.contacts.formateur].filter(Boolean).length;
        if (doneCount < 3) throw new Error('Les 3 contacts doivent être effectués avant de valider la séquence');
        const date = requireValidDate(realiseeLe, 'La date de réalisation');
        const deltaMs = date.getTime() - new Date(seq.prevue_le).getTime();
        await this.sequences.shiftLaterPending(seq.alternant_id, seq.numero, deltaMs);
        return this.sequences.update(sequenceId, { status: AlternantSequenceStatus.DONE, realisee_le: date });
    }

    async markSequence(sequenceId: string, status: AlternantSequenceStatus): Promise<AlternantSequence | null> {
        if (!Object.values(AlternantSequenceStatus).includes(status)) throw new Error('Statut invalide');
        return this.sequences.update(sequenceId, { status });
    }

    async deleteSequence(sequenceId: string): Promise<boolean> {
        return this.sequences.delete(sequenceId);
    }

    private async generateAutoSequences(alternantId: string, start: Date, end: Date | null): Promise<void> {
        const dates = buildSaDates(start, end);
        for (const date of dates) {
            const numero = await this.sequences.nextNumero(alternantId);
            await this.sequences.create({
                alternant_id: alternantId,
                numero,
                prevue_le: date,
                status: AlternantSequenceStatus.PENDING,
                contacts: { mentor: false, alternant: false, formateur: false },
                auto_generated: true,
            });
        }
    }
}
