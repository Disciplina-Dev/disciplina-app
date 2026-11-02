import { randomUUID } from 'crypto';
import { getModels } from '../../db/mongo/tenant';
import { EmargementHistoryEntry } from '../../types/emargement.types';

/** Nombre maximal d'événements renvoyés avec le détail d'une séance. */
export const HISTORY_PAGE_SIZE = 300;

export type RecordHistoryInput = Omit<EmargementHistoryEntry, '_id' | 'at'>;

export class EmargementHistoryRepository {
    /**
     * Ajoute un événement au journal. Append-only : aucun `update`, aucun
     * `delete` unitaire — seuls la suppression de la séance purge l'historique.
     */
    async record(input: RecordHistoryInput): Promise<void> {
        await getModels().EmargementHistory.create({
            ...input,
            _id: randomUUID(),
            at: new Date(),
        });
    }

    /** Journal d'une séance, du plus récent au plus ancien. */
    async findBySeance(seanceId: string, limit = HISTORY_PAGE_SIZE): Promise<EmargementHistoryEntry[]> {
        return getModels()
            .EmargementHistory.find({ seance_id: seanceId })
            .sort({ at: -1 })
            .limit(limit)
            .lean() as unknown as Promise<EmargementHistoryEntry[]>;
    }

    async deleteBySeance(seanceId: string): Promise<void> {
        await getModels().EmargementHistory.deleteMany({ seance_id: seanceId });
    }
}
