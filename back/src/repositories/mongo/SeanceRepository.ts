import { randomUUID } from 'crypto';
import { getModels } from '../../db/mongo/tenant';
import { Seance, SeanceValidationStatus } from '../../types/emargement.types';

export interface SeanceListFilter {
    sessionId?: string;
    /** Borne basse incluse, `YYYY-MM-DD`. */
    from?: string;
    /** Borne haute incluse, `YYYY-MM-DD`. */
    to?: string;
    /** État de validation calculé (créneaux, délai de régularisation) — filtre en mémoire. */
    validation?: SeanceValidationStatus;
    /** Ne garde que les feuilles avec des statuts non saisis sur un créneau fermé. */
    missing?: boolean;
}

export class SeanceRepository {
    async findAll(filter: SeanceListFilter = {}): Promise<Seance[]> {
        const query: Record<string, unknown> = {};
        if (filter.sessionId) query.session_id = filter.sessionId;
        if (filter.from || filter.to) {
            const range: Record<string, string> = {};
            if (filter.from) range.$gte = filter.from;
            if (filter.to) range.$lte = filter.to;
            query.date = range;
        }
        return (
            getModels()
                .Seance.find(query)
                // Les tracés de signature n'ont pas leur place dans une liste : ils
                // pèsent plusieurs dizaines de Ko chacun et ne servent qu'au détail.
                .select('-signature_image -validations.morning.signature_image -validations.afternoon.signature_image')
                .sort({ date: -1, start_time: -1 })
                .limit(200)
                .lean() as unknown as Promise<Seance[]>
        );
    }

    async findById(id: string): Promise<Seance | null> {
        return getModels().Seance.findOne({ _id: id }).lean() as unknown as Promise<Seance | null>;
    }

    /**
     * Séances rattachées à un formateur de l'annuaire : celles liées par
     * `formateur_id`, plus les séances antérieures (sans lien) dont l'e-mail
     * normalisé correspond. Les deux ensembles ne se recoupent pas.
     */
    async findByFormateur(formateurId: string, email: string): Promise<Seance[]> {
        return (
            getModels()
                .Seance.find({
                    $or: [
                        { formateur_id: formateurId },
                        { formateur_id: null, formateur_email: email.trim().toLowerCase() },
                    ],
                })
                // Les tracés de signature ne servent pas aux statistiques : on les écarte.
                .select('-signature_image -validations.morning.signature_image -validations.afternoon.signature_image')
                .sort({ date: -1, start_time: -1 })
                .lean() as unknown as Promise<Seance[]>
        );
    }

    /**
     * Toutes les séances, sans les tracés de signature : base des compteurs de
     * l'annuaire (nombre de séances, heures planifiées, sessions animées).
     * Le volume reste celui d'un centre de formation, la liste des formateurs
     * étant lue en une passe.
     */
    async findAllForStats(): Promise<Seance[]> {
        return getModels()
            .Seance.find({})
            .select('-signature_image -validations.morning.signature_image -validations.afternoon.signature_image')
            .sort({ date: -1, start_time: -1 })
            .lean() as unknown as Promise<Seance[]>;
    }

    /**
     * Délie les séances d'une fiche supprimée : le snapshot `formateur_email`
     * reste, donc le rattachement par e-mail reprend la main si la fiche est
     * recréée. Sans cela, ces séances garderaient un `formateur_id` orphelin et
     * disparaîtraient des compteurs du nouvel annuaire.
     */
    async unlinkFormateur(formateurId: string): Promise<number> {
        const result = await getModels().Seance.updateMany(
            { formateur_id: formateurId },
            { $set: { formateur_id: null } },
        );
        return result.modifiedCount ?? 0;
    }

    async create(data: Omit<Seance, '_id' | 'created_at' | 'updated_at'>): Promise<Seance> {
        const now = new Date();
        const doc = new (getModels().Seance)({
            _id: randomUUID(),
            ...data,
            created_at: now,
            updated_at: now,
        });
        await doc.save();
        return doc.toObject() as Seance;
    }

    async update(id: string, patch: Record<string, unknown>): Promise<Seance | null> {
        const { _id, ...rest } = patch;
        return getModels()
            .Seance.findOneAndUpdate(
                { _id: id },
                { $set: { ...rest, updated_at: new Date() } },
                { returnDocument: 'after', runValidators: true, context: 'query' },
            )
            .lean() as unknown as Promise<Seance | null>;
    }

    async delete(id: string): Promise<boolean> {
        return (await getModels().Seance.deleteOne({ _id: id })).deletedCount > 0;
    }
}
