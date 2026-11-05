import { randomUUID } from 'crypto';
import { getModels } from '../../db/mongo/tenant';
import { FormateurChange, FormateurHistoryAction, FormateurHistoryEntry } from '../../types/formateur.types';

/** Nombre d'entrées renvoyées sur la fiche : le journal reste borné côté UI. */
export const FORMATEUR_HISTORY_LIMIT = 300;

export interface RecordFormateurHistoryInput {
    formateur_id: string;
    action: FormateurHistoryAction;
    changes?: FormateurChange[];
    note?: string | null;
    actor_id?: number | null;
    actor_name?: string | null;
}

export class FormateurHistoryRepository {
    async record(input: RecordFormateurHistoryInput): Promise<FormateurHistoryEntry> {
        const doc = new (getModels().FormateurHistory)({
            _id: randomUUID(),
            formateur_id: input.formateur_id,
            action: input.action,
            changes: input.changes ?? [],
            note: input.note ?? null,
            actor_id: input.actor_id ?? null,
            actor_name: input.actor_name ?? null,
            at: new Date(),
        });
        await doc.save();
        return doc.toObject() as FormateurHistoryEntry;
    }

    async findByFormateur(formateurId: string): Promise<FormateurHistoryEntry[]> {
        return getModels()
            .FormateurHistory.find({ formateur_id: formateurId })
            .sort({ at: -1 })
            .limit(FORMATEUR_HISTORY_LIMIT)
            .lean() as unknown as Promise<FormateurHistoryEntry[]>;
    }
}
