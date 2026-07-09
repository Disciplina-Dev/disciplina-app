import { randomUUID } from 'crypto';
import { OfferModel } from '../../src/db/mongo/schemas/offer.schema';
import { Offer } from '../../src/types/offer.types';
import { OfferStatus, Localisation, Sector, MatchingCandidate } from '../../src/types/matching.types';

// Seed d'une offre de matching dans la collection `offers`. Remplace l'ancien
// JobRepository.create des tests. Accepte l'ancienne forme plate d'un « job » et
// la projette sur le modèle Offer ; renvoie { _id } = l'id stable de l'offre.
export interface SeedOfferInput {
    _id?: string;
    company_name?: string;
    age_range?: string;
    desired_tp?: string | null;
    desired_sex?: string | null;
    driving_license_b?: boolean;
    professional_experience?: boolean;
    status?: OfferStatus;
    localisation?: Localisation[];
    sector?: Sector;
    candidates?: MatchingCandidate[];
    interview_slots?: string[];
    interview_location?: string;
}

function parseAgeRange(range?: string): { min: number | null; max: number | null } {
    if (!range) return { min: null, max: null };
    const [min, max] = range.split('-').map((value) => Number(value));
    return { min: Number.isFinite(min) ? min : null, max: Number.isFinite(max) ? max : null };
}

export async function seedOffer(input: SeedOfferInput = {}): Promise<{ _id: string }> {
    const offerId = input._id ?? randomUUID();
    const { min, max } = parseAgeRange(input.age_range);
    const offer: Offer = {
        _id: offerId,
        needs_analysis_id: `ab-${offerId}`,
        company_infos: input.company_name ? { name: input.company_name } : undefined,
        localisation: input.localisation ?? [],
        tp_type: (input.desired_tp ?? null) as Offer['tp_type'],
        criteria: {
            age_min: min,
            age_max: max,
            driving_license: input.driving_license_b ?? false,
            experience_required: input.professional_experience ?? false,
            desired_sex: input.desired_sex ?? null,
        },
        matching: {
            status: input.status ?? OfferStatus.NOT_MATCHED,
            candidates: input.candidates ?? [],
            interview_slots: input.interview_slots ?? [],
            interview_location: input.interview_location,
        },
    };
    await OfferModel.create(offer);
    return { _id: offerId };
}
