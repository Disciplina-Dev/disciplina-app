import { randomUUID } from 'crypto';
import { CandidateHistoryRepository } from '../repositories/mongo/CandidateHistoryRepository';
import { CandidateHistoryEntry, CandidateHistoryType } from '../types/candidate.types';
import { MatchedCandidateStatus } from '../types/matching.types';
import { logger } from '../external/logger';

interface MatchedStatusHistoryEntry {
    type: CandidateHistoryType;
    description: string;
}

export class CandidateHistoryService {
    private repository = new CandidateHistoryRepository();

    async recordAuto(candidateId: string, type: CandidateHistoryType, description: string): Promise<void> {
        try {
            await this.repository.create({
                _id: randomUUID(),
                candidate_id: candidateId,
                type,
                description,
                owner_email: null,
                created_at: new Date(),
            });
        } catch (error) {
            logger.error({ error, candidateId, type }, 'Failed to record candidate history entry');
        }
    }

    async recordManual(candidateId: string, description: string, ownerEmail: string): Promise<CandidateHistoryEntry> {
        return this.repository.create({
            _id: randomUUID(),
            candidate_id: candidateId,
            type: CandidateHistoryType.RH,
            description,
            owner_email: ownerEmail,
            created_at: new Date(),
        });
    }

    async findByCandidate(candidateId: string): Promise<CandidateHistoryEntry[]> {
        return this.repository.findByCandidateId(candidateId);
    }

    async deleteOwnedEntry(id: string, ownerEmail: string): Promise<boolean> {
        const entry = await this.repository.findById(id);
        if (!entry) throw new Error('History entry not found');
        if (entry.owner_email === null) throw new Error('Cannot delete an automatic history entry');
        if (entry.owner_email !== ownerEmail) throw new Error('Only the owner can delete this history entry');
        return this.repository.delete(id);
    }

    buildMatchedStatusHistoryEntry(
        status: MatchedCandidateStatus,
        companyName?: string,
    ): MatchedStatusHistoryEntry | null {
        const company = companyName ?? "l'entreprise";
        switch (status) {
            case MatchedCandidateStatus.PRE_SELECTED_MAIL_SEND:
                return {
                    type: CandidateHistoryType.RH,
                    description: `Un mail de proposition de ${company} a été envoyé au candidat`,
                };
            case MatchedCandidateStatus.ACCEPTED:
                return {
                    type: CandidateHistoryType.CANDIDATE,
                    description: `Le candidat a accepté l'offre de ${company}`,
                };
            case MatchedCandidateStatus.DECLINED:
                return {
                    type: CandidateHistoryType.CANDIDATE,
                    description: `Le candidat a refusé l'offre de ${company}`,
                };
            default:
                return null;
        }
    }
}
