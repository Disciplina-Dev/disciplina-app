import { OfferRepository } from '../repositories/mongo/OfferRepository';
import { CandidateRepository, CandidateFilters, CandidateStats } from '../repositories/mongo/CandidateRepository';
import { Candidate, CandidateStatus } from '../types/candidate.types';
import { Offer } from '../types/offer.types';
import { computeAge } from '../utils/age';
import { offerTpCodes } from './mappers/offer.mapper';
import { CandidateHistoryService } from './CandidateHistoryService';
import { NotificationService } from './NotificationService';
import { buildCandidateSummary } from './buildCandidateSummary';
import { UserRepository } from '../repositories/mysql/UserRepository';
import { UserRowJoined } from '../types/db-rows.types';
import { logger } from '../external/logger';

export class CandidateService {
    private repository = new CandidateRepository();
    private offerRepository = new OfferRepository();
    private candidateHistoryService = new CandidateHistoryService();
    private notificationService = new NotificationService();
    private userRepository = new UserRepository();

    async findAll(): Promise<Candidate[]> {
        const candidates = await this.repository.findAll();
        return Promise.all(candidates.map((candidate) => this.refreshAvailability(candidate)));
    }

    async findPage(first: number, after?: string, search?: string, filters?: CandidateFilters): Promise<Candidate[]> {
        const candidates = await this.repository.findPage(first, after, search, filters);
        return Promise.all(candidates.map((candidate) => this.refreshAvailability(candidate)));
    }

    async findById(id: string): Promise<Candidate | null> {
        const candidate = await this.repository.findById(id);
        return candidate ? this.refreshAvailability(candidate) : null;
    }

    // Repasse automatiquement un candidat en recherche une fois une échéance passée :
    // - indisponible : dès que sa date de disponibilité est atteinte ;
    // - immersion : dès que sa date de fin d'immersion est dépassée (jour de fin inclus).
    private async refreshAvailability(candidate: Candidate): Promise<Candidate> {
        if (candidate.status === CandidateStatus.UNAVAILABLE) {
            const availabilityDate = candidate.job_info?.availability_date;
            if (!availabilityDate || new Date(availabilityDate) > new Date()) return candidate;
            const reverted = await this.revertUnavailableToSeeking(candidate);
            if (reverted) {
                const name = candidate.identity?.full_name ?? 'Un candidat';
                const ownerId = candidate.owner?.user_id;
                if (ownerId) {
                    this.notificationService
                        .create({
                            userId: ownerId,
                            type: 'availability_ended',
                            category: 'candidate',
                            level: 'info',
                            title: 'Disponible',
                            message: `${name} est de nouveau disponible.`,
                            link: `/rh/candidats/${candidate._id}`,
                        })
                        .catch(() => {});
                }
            }
            return reverted;
        }

        if (candidate.status === CandidateStatus.IMMERSING) {
            const endDate = candidate.immersion_end_date;
            if (!endDate || !this.immersionEnded(endDate)) return candidate;
            const updated = await this.repository.update(candidate._id, { status: CandidateStatus.SEEKING });
            return updated ?? { ...candidate, status: CandidateStatus.SEEKING };
        }

        return candidate;
    }

    // L'immersion couvre toute la journée de fin : on ne repasse en recherche qu'une
    // fois cette journée écoulée.
    private immersionEnded(endDate: Date | string): boolean {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return end.getTime() < Date.now();
    }

    // Fin d'indisponibilité : bascule atomique en recherche puis notification RH.
    // La bascule atomique garantit qu'un seul appelant (lecture paresseuse ou
    // scheduler) notifie, même en cas d'accès concurrents.
    private async revertUnavailableToSeeking(candidate: Candidate): Promise<Candidate> {
        const changed = await this.repository.revertUnavailableToSeeking(candidate._id);
        if (changed) await this.notifyBackToSeeking(candidate);
        return { ...candidate, status: CandidateStatus.SEEKING };
    }

    // Parcours proactif (scheduler) : repasse en recherche et notifie les RH pour
    // tout candidat dont la date de fin d'indisponibilité est atteinte. Retourne le
    // nombre de candidats effectivement basculés.
    async processExpiredUnavailable(now: Date = new Date()): Promise<number> {
        const candidates = await this.repository.findExpiredUnavailable(now);
        let reverted = 0;
        for (const candidate of candidates) {
            try {
                const changed = await this.repository.revertUnavailableToSeeking(candidate._id);
                if (changed) {
                    await this.notifyBackToSeeking(candidate);
                    reverted += 1;
                }
            } catch (err) {
                logger.error({ err, candidateId: candidate._id }, 'unavailable-expiry: échec bascule candidat');
            }
        }
        return reverted;
    }

    // Notifie toute l'équipe RH (RH + RESPONSABLE + ADMIN) qu'un candidat est de
    // nouveau en recherche à l'issue de son indisponibilité.
    private async notifyBackToSeeking(candidate: Candidate): Promise<void> {
        const rhUsers = (await this.userRepository.findByRoleIds([2, 4, 5])) ?? [];
        const name = candidate.identity?.full_name ?? 'Un candidat';
        await Promise.all(
            rhUsers.map((user: UserRowJoined) =>
                this.notificationService.create({
                    userId: user.id,
                    type: 'candidate_available_again',
                    category: 'candidate',
                    level: 'info',
                    title: 'Candidat de nouveau disponible',
                    message: `${name} est de nouveau en recherche (indisponibilité terminée).`,
                    link: `/rh/candidats/${candidate._id}`,
                }),
            ),
        );
    }

    async stats(sectors?: string[]): Promise<CandidateStats> {
        return this.repository.stats(sectors);
    }

    async findByEmail(email: string): Promise<Candidate | null> {
        return this.repository.findByEmail(email);
    }

    async create(data: Partial<Candidate>): Promise<Candidate> {
        if (data.identity && !data.identity.description) {
            data.identity.description = buildCandidateSummary(data as Candidate);
        }
        return this.repository.create(data);
    }

    /**
     * Renseigne `created_at` pour un candidat créé avant l'introduction du champ,
     * à partir de sa plus ancienne entrée d'historique. Écriture directe (pas de
     * diff/historique) et une seule fois : self-healing au premier accès à la fiche.
     */
    async backfillCreatedAt(id: string): Promise<Date | null> {
        const entries = await this.candidateHistoryService.findByCandidate(id);
        if (entries.length === 0) return null;
        // findByCandidate trie par created_at décroissant → la plus ancienne est la dernière.
        const oldest = entries[entries.length - 1].created_at;
        if (!oldest) return null;
        await this.repository.update(id, { created_at: new Date(oldest) });
        return new Date(oldest);
    }

    async update(id: string, data: Partial<Candidate>): Promise<Candidate | null> {
        const existing = await this.repository.findById(id);
        if (existing) {
            const merged: Candidate = {
                ...existing,
                ...data,
                identity: { ...existing.identity, ...(data.identity ?? {}) },
            };
            if (data.education) merged.education = { ...existing.education, ...data.education } as any;
            if (data.background) merged.background = { ...existing.background, ...data.background } as any;
            if (data.job_info) merged.job_info = { ...existing.job_info, ...data.job_info } as any;
            if (data.profile) merged.profile = { ...existing.profile, ...data.profile } as any;
            if (data.professional_projects)
                merged.professional_projects = {
                    ...existing.professional_projects,
                    ...data.professional_projects,
                } as any;
            if (!data.identity?.description) {
                data.identity = {
                    ...(data.identity ?? {}),
                    description: buildCandidateSummary(merged),
                } as Candidate['identity'];
            }
        }
        const updated = await this.repository.update(id, data);
        return updated;
    }

    async delete(id: string): Promise<boolean> {
        return this.repository.delete(id);
    }

    async matchOffers(id: string): Promise<Offer[]> {
        const candidate = await this.repository.findById(id);
        if (!candidate) return [];
        if (candidate.status === CandidateStatus.CONTRACT) return [];

        const [allOffers, assignedOffers] = await Promise.all([
            this.offerRepository.listMatchingOffers(),
            this.offerRepository.findWithCandidate(id),
        ]);

        const matched = allOffers.filter((offer) => this.offerMatchesCandidate(offer, candidate));
        const matchedIds = new Set(matched.map((o) => String(o._id)));

        for (const o of assignedOffers) {
            if (!matchedIds.has(String(o._id))) {
                matched.push(o);
            }
        }

        return matched;
    }

    private offerMatchesCandidate(offer: Offer, candidate: Candidate): boolean {
        const offerTps = offerTpCodes(offer);
        const candidateTps = candidate.tp_types?.length ? candidate.tp_types : [candidate.tp_type];
        if (offerTps.length && !offerTps.some((tp) => candidateTps.includes(tp))) return false;
        if (offer.criteria?.driving_license && !candidate.identity.driving_license_b) return false;

        const candidateAge = computeAge(candidate.identity.date_of_birth) ?? candidate.identity.age;
        if (offer.criteria?.age_min != null && offer.criteria?.age_max != null && candidateAge != null) {
            if (candidateAge < offer.criteria.age_min || candidateAge > offer.criteria.age_max) return false;
        }

        if (offer.localisation?.length) {
            const mobility = candidate.job_info?.geographic_mobility ?? [];
            if (!offer.localisation.every((loc) => mobility.includes(loc))) return false;
        }

        return true;
    }
}
