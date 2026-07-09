import { randomUUID } from 'crypto';
import { NeedsAnalysis as NeedsAnalysisDocument, Position } from '../../types/needsAnalysisNoSql.types';
import { Offer } from '../../types/offer.types';
import { OfferStatus } from '../../types/matching.types';

function buildOffer(position: Position, doc: NeedsAnalysisDocument): Offer {
    return {
        ...position,
        _id: randomUUID(),
        needs_analysis_id: doc._id,
        company_infos: {
            id: doc.company_infos?.id,
            name: doc.company_infos?.name,
            sector: doc.company_infos?.sector,
        },
        saler_info: doc.saler_info,
        referents: doc.referents,
        matching: { status: OfferStatus.NOT_MATCHED, candidates: [], interview_slots: [] },
    };
}

/** Crée une offre par poste de l'AB, avec le snapshot entreprise/référents/saler déjà stocké sur l'AB. */
export function buildOffers(doc: NeedsAnalysisDocument): Offer[] {
    return (doc.positions ?? []).map((position) => buildOffer(position, doc));
}

// Une reconstruction complète des offres (après une mise à jour de l'AB) régénère les
// positions : on réinjecte l'id stable et l'état de matching de l'offre existante (même
// position) pour ne pas casser le matching RH déjà en cours.
export function mergeOfferIdentity(existing: Offer | undefined, rebuilt: Offer): Offer {
    if (!existing) return rebuilt;
    return { ...rebuilt, _id: existing._id ?? rebuilt._id, matching: existing.matching ?? rebuilt.matching };
}
