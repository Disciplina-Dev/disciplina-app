import { randomUUID } from 'crypto';
import { NeedsAnalysis as NeedsAnalysisDocument, Position, PositionTp } from '../../types/needsAnalysisNoSql.types';
import { Offer } from '../../types/offer.types';
import { OfferStatus } from '../../types/matching.types';
import { TitleProfessionalType } from '../../types/candidate.types';

// Titres professionnels visés par une offre (une offre peut cibler CC et NTC).
export function offerTpCodes(offer: Pick<Offer, 'desired_tp'>): TitleProfessionalType[] {
    return (offer.desired_tp ?? []).map((tp) => tp.tp_type).filter((tp): tp is TitleProfessionalType => tp != null);
}

export function positionTpToGql(tp: PositionTp) {
    return {
        tpType: tp.tp_type ?? null,
        missions: tp.missions ?? [],
        descriptionMissions: tp.description_missions ?? [],
        otherMissions: tp.other_missions ?? null,
        otherDescriptionMissions: tp.other_description_missions ?? null,
    };
}

function buildOffer(position: Position, tp: PositionTp | null, doc: NeedsAnalysisDocument): Offer {
    return {
        ...position,
        desired_tp: tp ? [tp] : [],
        count: 1,
        _id: randomUUID(),
        needs_analysis_id: doc._id,
        company_infos: {
            id: doc.company_infos?.id,
            name: doc.company_infos?.name,
            sector: doc.company_infos?.sector,
            activities: doc.company_infos?.activities,
        },
        saler_info: doc.saler_info,
        referents: doc.referents,
        matching: { status: OfferStatus.NOT_MATCHED, candidates: [], interview_slots: [] },
    };
}

/**
 * Crée une offre par formation demandée et par poste à pourvoir : une position de
 * quantité N ciblant les TP [CC, NTC] donne 2×N offres, chacune portant une seule
 * formation (taggable et matchable individuellement).
 */
export function buildOffers(doc: NeedsAnalysisDocument): Offer[] {
    return (doc.positions ?? []).flatMap((position) => {
        const tps = position.desired_tp?.length ? position.desired_tp : [null];
        const count = Math.max(1, position.count ?? 1);
        return tps.flatMap((tp) => Array.from({ length: count }, () => buildOffer(position, tp, doc)));
    });
}

// Une reconstruction complète des offres (après une mise à jour de l'AB) régénère les
// positions : on réinjecte l'id stable et l'état de matching de l'offre existante (même
// position) pour ne pas casser le matching RH déjà en cours.
export function mergeOfferIdentity(existing: Offer | undefined, rebuilt: Offer): Offer {
    if (!existing) return rebuilt;
    return { ...rebuilt, _id: existing._id ?? rebuilt._id, matching: existing.matching ?? rebuilt.matching };
}
