/**
 * Migration : renseigne le champ `consentments` sur les fiches candidat existantes.
 *
 * Contexte :
 * - Les fiches candidat créées avant l'introduction du consentement RGPD
 *   (`back/src/db/mongo/schemas/candidate.schema.ts`) n'ont aucun champ
 *   `consentments`, désormais attendu par `createCandidate` pour toute nouvelle fiche.
 * - Ce script rétro-consent les fiches existantes : les 4 booléens sont mis à `true`,
 *   avec `consent_version: 'legacy-backfill'` pour distinguer ces enregistrements
 *   d'un consentement réellement recueilli au moment de la création.
 *
 * Le script ne touche QUE les documents sans champ `consentments` : une fiche déjà
 * consentie (création/édition normale, ou un run précédent de ce script) est ignorée,
 * ce qui le rend idempotent et rejouable.
 *
 * Usage (depuis back/) :
 *   npx ts-node scripts/migrate-candidate-consentments.ts --dry-run   # inventaire seul
 *   npx ts-node scripts/migrate-candidate-consentments.ts             # applique
 */

import mongoose from 'mongoose';
import { env } from '../src/config/env';

const dryRun = process.argv.includes('--dry-run');

// Même résolution d'URI que `src/db/mongo/connection.ts` : MONGO_URI en production,
// sinon les identifiants root de la stack Docker locale.
const MONGO_URI =
    env.NODE_ENV === 'production'
        ? env.MONGO_URI!
        : `mongodb://${env.MONGO_ROOT_USERNAME}:${env.MONGO_ROOT_PASSWORD}@${env.MONGO_HOST}:${env.MONGO_PORT}/${env.MONGO_DB_NAME}?authSource=admin`;

interface LegacyCandidate {
    _id: string;
    identity?: { full_name?: string };
}

async function migrate(): Promise<void> {
    await mongoose.connect(MONGO_URI);
    const candidates = mongoose.connection.collection('candidates');

    // $exists: false → uniquement les fiches jamais consenties, jamais celles déjà backfillées.
    const legacy = (await candidates
        .find({ consentments: { $exists: false } })
        .project({ 'identity.full_name': 1 })
        .toArray()) as unknown as LegacyCandidate[];

    console.log(`${legacy.length} fiche(s) sans consentements${dryRun ? ' (dry-run, aucune écriture)' : ''}.`);

    let migrated = 0;
    let skipped = 0;

    for (const candidate of legacy) {
        if (dryRun) {
            migrated++;
            continue;
        }

        try {
            await candidates.updateOne(
                { _id: candidate._id as unknown as object },
                {
                    $set: {
                        consentments: {
                            data_processing: true,
                            data_sharing: true,
                            ai_processing: true,
                            photo_processing: true,
                            consent_date: new Date(),
                            consent_version: 'legacy-backfill',
                        },
                    },
                },
            );
            migrated++;
        } catch (err) {
            console.error(`❌ ${candidate._id} : ${(err as Error).message}`);
            skipped++;
        }
    }

    console.log(`\n${dryRun ? 'À migrer' : 'Migrés'} : ${migrated} — ignorés : ${skipped}`);
    await mongoose.disconnect();
}

migrate().catch(async (err) => {
    console.error('❌ Migration échouée :', err);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
});
