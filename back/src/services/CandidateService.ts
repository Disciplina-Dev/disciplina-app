import { OfferRepository } from '../repositories/mongo/OfferRepository';
import { CandidateRepository, CandidateFilters, CandidateStats } from '../repositories/mongo/CandidateRepository';
import { Candidate, CandidateHistoryType, CandidateStatus } from '../types/candidate.types';
import { Offer } from '../types/offer.types';
import { computeAge } from '../utils/age';
import { CandidateHistoryService } from './CandidateHistoryService';
import { buildFieldChangeEntries } from './mappers/candidateFieldDiff';

export class CandidateService {
    private repository = new CandidateRepository();
    private offerRepository = new OfferRepository();
    private candidateHistoryService = new CandidateHistoryService();

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
            return this.revertToSeeking(candidate);
        }

        if (candidate.status === CandidateStatus.IMMERSING) {
            const endDate = candidate.immersion_end_date;
            if (!endDate || !this.immersionEnded(endDate)) return candidate;
            return this.revertToSeeking(candidate);
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

    private async revertToSeeking(candidate: Candidate): Promise<Candidate> {
        const updated = await this.repository.update(candidate._id, { status: CandidateStatus.SEEKING });
        return updated ?? { ...candidate, status: CandidateStatus.SEEKING };
    }

    async stats(sectors?: string[]): Promise<CandidateStats> {
        return this.repository.stats(sectors);
    }

    async findByEmail(email: string): Promise<Candidate | null> {
        return this.repository.findByEmail(email);
    }

    async create(data: Partial<Candidate>): Promise<Candidate> {
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
        const updated = await this.repository.update(id, data);
        return updated;
    }

    async delete(id: string): Promise<boolean> {
        return this.repository.delete(id);
    }

    async matchOffers(id: string): Promise<Offer[]> {
        const candidate = await this.repository.findById(id);
        if (!candidate) return [];

        const offers = await this.offerRepository.listMatchingOffers();
        return offers.filter((offer) => this.offerMatchesCandidate(offer, candidate));
    }

    private offerMatchesCandidate(offer: Offer, candidate: Candidate): boolean {
        if (offer.tp_type && offer.tp_type !== candidate.tp_type) return false;
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
