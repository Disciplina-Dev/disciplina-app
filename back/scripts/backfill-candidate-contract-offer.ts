/**
 * Migration : renseigne `contract_offer_id` / `contract_company_*` sur les candidats déjà en contrat.
 *
 * Contexte :
 * - Avant ce correctif, seul le ContractModal (fiche candidat) liait l'offre au candidat ; les contrats
 *   conclus depuis l'offre (conclusion d'entretien/immersion, statut « embauché ») ne laissaient que
 *   `status: CONTRACT`, sans moyen de remonter à l'entreprise.
 * - Le script retrouve l'offre où le candidat figure avec le statut CONTRACT (`matching.candidates`).
 *
 * Ne touche QUE les candidats CONTRACT sans `contract_offer_id` et dont une seule offre correspond
 * (cas ambigu = ignoré et listé). Idempotent et rejouable.
 *
 * Usage (depuis back/) :
 *   npx ts-node scripts/backfill-candidate-contract-offer.ts --dry-run   # inventaire seul
 *   npx ts-node scripts/backfill-candidate-contract-offer.ts             # applique
 */

import mongoose from 'mongoose';
import { env } from '../src/config/env';

const dryRun = process.argv.includes('--dry-run');

const MONGO_URI =
    env.NODE_ENV === 'production'
        ? env.MONGO_URI!
        : `mongodb://${env.MONGO_ROOT_USERNAME}:${env.MONGO_ROOT_PASSWORD}@${env.MONGO_HOST}:${env.MONGO_PORT}/${env.MONGO_DB_NAME}?authSource=admin`;

interface OfferDoc {
    _id: unknown;
    company_infos?: { id?: number; name?: string };
}

async function backfill(): Promise<void> {
    await mongoose.connect(MONGO_URI);
    const candidates = mongoose.connection.collection('candidates');
    const offers = mongoose.connection.collection('offers');

    const orphans = await candidates
        .find({ status: 'CONTRACT', contract_offer_id: { $in: [null, ''] } })
        .project({ 'identity.full_name': 1 })
        .toArray();
    console.log(`${orphans.length} candidat(s) en contrat sans offre liée${dryRun ? ' (dry-run, aucune écriture)' : ''}.`);

    let linked = 0;
    let ambiguous = 0;
    let notFound = 0;

    for (const candidate of orphans) {
        const matches = (await offers
            .find({ 'matching.candidates': { $elemMatch: { id: String(candidate._id), status: 'CONTRACT' } } })
            .project({ 'company_infos.id': 1, 'company_infos.name': 1 })
            .toArray()) as OfferDoc[];

        if (matches.length === 0) {
            notFound++;
            continue;
        }
        if (matches.length > 1) {
            console.log(`⚠️  ${candidate._id} : ${matches.length} offres en contrat, ignoré`);
            ambiguous++;
            continue;
        }

        const [offer] = matches;
        if (!dryRun) {
            await candidates.updateOne(
                { _id: candidate._id },
                {
                    $set: {
                        contract_offer_id: String(offer._id),
                        ...(offer.company_infos?.id !== undefined && { contract_company_id: offer.company_infos.id }),
                        ...(offer.company_infos?.name && { contract_company_name: offer.company_infos.name }),
                    },
                },
            );
        }
        linked++;
    }

    console.log(
        `\n${dryRun ? 'À lier' : 'Liés'} : ${linked} — ambigus : ${ambiguous} — sans offre en contrat : ${notFound}`,
    );
    await mongoose.disconnect();
}

backfill().catch(async (err) => {
    console.error('❌ Backfill échoué :', err);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
});
