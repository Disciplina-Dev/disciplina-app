import { NeedsAnalysisModel } from '../../db/mongo/schemas/needsAnalysis.schema';
import { OfferModel } from '../../db/mongo/schemas/offer.schema';
import { NeedsAnalysis, NeedsAnalysisStatus } from '../../types/needsAnalysisNoSql.types';
import { AbStatus } from '../../types/offer.types';
import { decodeCursor } from '../../services/pagination';

/**
 * Curseur de keyset pour le tri (created_at DESC, _id ASC) : date de création ISO
 * (vide si absente) et _id séparés par « | ». Pagination déterministe et indexable.
 */
export function encodeNeedsAnalysisCursor(doc: Pick<NeedsAnalysis, '_id' | 'created_at'>): string {
    const iso = doc.created_at ? new Date(doc.created_at).toISOString() : '';
    return `${iso}|${doc._id}`;
}

function parseNeedsAnalysisCursor(raw: string): { createdAt: Date | null; id: string } {
    const sep = raw.indexOf('|');
    const isoPart = sep >= 0 ? raw.slice(0, sep) : '';
    const idPart = sep >= 0 ? raw.slice(sep + 1) : raw;
    return { createdAt: isoPart ? new Date(isoPart) : null, id: idPart };
}

export class NeedsAnalysisRepository {
    async findAll(): Promise<NeedsAnalysis[]> {
        return NeedsAnalysisModel.find().lean();
    }

    async findPage(first: number, after?: string, restrictIds?: string[]): Promise<NeedsAnalysis[]> {
        const conditions: Record<string, any>[] = [];
        if (restrictIds) {
            conditions.push({ _id: { $in: restrictIds } });
        }
        if (after) {
            const { createdAt, id } = parseNeedsAnalysisCursor(decodeCursor(after));
            if (createdAt) {
                conditions.push({
                    $or: [
                        { created_at: { $lt: createdAt } },
                        { created_at: createdAt, _id: { $gt: id } },
                        // Les non datées suivent toujours n'importe quelle fiche datée.
                        { created_at: null },
                    ],
                });
            } else {
                conditions.push({ created_at: null, _id: { $gt: id } });
            }
        }
        const filter = conditions.length ? { $and: conditions } : {};
        return NeedsAnalysisModel.find(filter)
            .sort({ created_at: -1, _id: 1 })
            .limit(first + 1)
            .lean();
    }

    async findById(id: string): Promise<NeedsAnalysis | null> {
        return NeedsAnalysisModel.findOne({ _id: id }).lean();
    }

    async findByCompanyId(companyId: number): Promise<NeedsAnalysis[]> {
        // Les AB supprimées (inactives) n'apparaissent pas dans le portefeuille commercial.
        return NeedsAnalysisModel.find({ 'company_infos.id': companyId, is_deleted: { $ne: true } }).lean();
    }

    async findBySignatureRequestId(signatureRequestId: string): Promise<NeedsAnalysis | null> {
        return NeedsAnalysisModel.findOne({ signature_request_id: signatureRequestId }).lean();
    }

    async create(data: NeedsAnalysis): Promise<NeedsAnalysis> {
        const doc = new NeedsAnalysisModel(data);
        await doc.save();
        return doc.toObject() as NeedsAnalysis;
    }

    async update(id: string, data: Partial<NeedsAnalysis>): Promise<NeedsAnalysis | null> {
        const { _id, ...patch } = data;
        return NeedsAnalysisModel.findOneAndUpdate({ _id: id }, { $set: patch }, { new: true }).lean();
    }

    /**
     * Soft delete : l'AB n'est pas retirée, elle devient inactive (is_deleted).
     * Elle reste visible dans la liste matching (onglet « Inactif ») pour l'historique.
     */
    async markDeleted(id: string): Promise<boolean> {
        const res = await NeedsAnalysisModel.updateOne({ _id: id }, { $set: { is_deleted: true } });
        return res.modifiedCount > 0;
    }

    /** Ids des AB supprimées (inactives). */
    async findDeletedIds(): Promise<string[]> {
        return NeedsAnalysisModel.distinct('_id', { is_deleted: true });
    }

    /** Ids des AB dont le statut d'onglet (matching) est forcé manuellement à `status`. */
    async findIdsByManualStatus(status: AbStatus): Promise<string[]> {
        return NeedsAnalysisModel.distinct('_id', { ab_status: status });
    }

    /** Ids des AB ayant un statut manuel (quel qu'il soit) — exclues du calcul dérivé. */
    async findIdsWithManualStatus(): Promise<string[]> {
        return NeedsAnalysisModel.distinct('_id', { ab_status: { $exists: true, $ne: null } });
    }

    /** Ids des AB non supprimées qui n'ont aucune offre de matching. */
    async findIdsWithoutOffers(): Promise<string[]> {
        const [allIds, offerIds] = await Promise.all([
            NeedsAnalysisModel.distinct('_id', { is_deleted: { $ne: true } }),
            OfferModel.distinct('needs_analysis_id', { needs_analysis_id: { $exists: true, $ne: null } }),
        ]);
        const offerSet = new Set(offerIds);
        return allIds.filter((id) => !offerSet.has(id));
    }

    async findByStatusNotBrouillon(limit: number = 10, regions?: string[]): Promise<NeedsAnalysis[]> {
        const filter: Record<string, any> = {
            status: { $ne: NeedsAnalysisStatus.BROUILLON },
            is_deleted: { $ne: true },
        };
        if (regions?.length) {
            filter['company_infos.sector'] = { $in: regions };
        }
        return NeedsAnalysisModel.find(filter)
            .sort({ created_at: -1 })
            .limit(limit)
            .lean();
    }

    async countByStatusNotBrouillon(regions?: string[]): Promise<number> {
        const filter: Record<string, any> = {
            status: { $ne: NeedsAnalysisStatus.BROUILLON },
            is_deleted: { $ne: true },
        };
        if (regions?.length) {
            filter['company_infos.sector'] = { $in: regions };
        }
        return NeedsAnalysisModel.countDocuments(filter);
    }

    /**
     * AB envoyées en signature, toujours non signées après `delayMs`, et qui
     * n'ont pas encore reçu de relance automatique. Exige un lien de signature
     * conservé (`signature_url`) pour pouvoir reconstruire le bouton.
     */
    async findDueSignatureRelance(now: Date, delayMs: number): Promise<NeedsAnalysis[]> {
        const cutoff = new Date(now.getTime() - delayMs);
        return NeedsAnalysisModel.find({
            status: NeedsAnalysisStatus.EN_ATTENTE_SIGNATURE,
            is_deleted: { $ne: true },
            signature_sent_at: { $lte: cutoff, $ne: null },
            last_relance_at: null,
            signature_url: { $exists: true, $ne: null },
        })
            .sort({ signature_sent_at: 1 })
            .lean();
    }

    /**
     * Réassigne (ou détache) le commercial porteur de toutes les AB liées à un
     * user supprimé. `saler = null` détache la fiche (l'AB vit sans commercial).
     * Renvoie le nombre de fiches modifiées.
     */
    async reassignSaler(fromUserId: number, saler: { id: number; email: string } | null): Promise<number> {
        const update = saler
            ? { $set: { saler_info: { id: saler.id, email: saler.email } } }
            : { $unset: { saler_info: '' } };
        const res = await NeedsAnalysisModel.updateMany({ 'saler_info.id': fromUserId }, update);
        return res.modifiedCount;
    }
}
