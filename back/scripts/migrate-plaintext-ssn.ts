/**
 * Migration : chiffre les NIR (numéros de sécurité sociale) encore stockés en clair.
 *
 * Contexte :
 * - Les fiches candidat créées avant l'introduction du chiffrement portent un
 *   `identity.social_security_number` de type `string` (NIR en clair) au lieu du
 *   triplet `{ encrypted, iv, tag }` attendu par `decryptSsn`.
 * - Les lectures Mongo passent par `.lean()` (aucun cast Mongoose), donc la valeur
 *   legacy remonte telle quelle : la fiche s'affiche masquée « [chiffré] » mais le
 *   bouton « Afficher » échoue.
 *
 * Le script ne touche QUE les documents dont le champ est de type `string` : les
 * triplets déjà chiffrés sont ignorés, ce qui le rend idempotent et rejouable.
 *
 * Usage (depuis back/) :
 *   npx ts-node scripts/migrate-plaintext-ssn.ts --dry-run   # inventaire seul
 *   npx ts-node scripts/migrate-plaintext-ssn.ts             # applique
 *
 * SSN_ENCRYPTION_KEY et MONGO_URI doivent être ceux de l'environnement cible :
 * un chiffrement avec une autre clé que celle du serveur rendrait les NIR
 * définitivement illisibles.
 */

import mongoose from 'mongoose';
import { env } from '../src/config/env';
import { encryptSsn } from '../src/external/crypto/ssn-cipher';

const dryRun = process.argv.includes('--dry-run');

// Même résolution d'URI que `src/db/mongo/connection.ts` : MONGO_URI en production,
// sinon les identifiants root de la stack Docker locale.
const MONGO_URI =
    env.NODE_ENV === 'production'
        ? env.MONGO_URI!
        : `mongodb://${env.MONGO_ROOT_USERNAME}:${env.MONGO_ROOT_PASSWORD}@${env.MONGO_HOST}:${env.MONGO_PORT}/${env.MONGO_DB_NAME}?authSource=admin`;

interface LegacyCandidate {
    _id: string;
    identity?: { full_name?: string; social_security_number?: unknown };
}

async function migrate(): Promise<void> {
    await mongoose.connect(MONGO_URI);
    const candidates = mongoose.connection.collection('candidates');

    // $type: 'string' → uniquement les valeurs en clair, jamais les triplets déjà chiffrés.
    const legacy = (await candidates
        .find({ 'identity.social_security_number': { $type: 'string' } })
        .project({ 'identity.social_security_number': 1, 'identity.full_name': 1 })
        .toArray()) as unknown as LegacyCandidate[];

    console.log(`${legacy.length} fiche(s) avec un NIR en clair${dryRun ? ' (dry-run, aucune écriture)' : ''}.`);

    let migrated = 0;
    let skipped = 0;

    for (const candidate of legacy) {
        const plain = candidate.identity?.social_security_number;
        if (typeof plain !== 'string' || plain.trim() === '') {
            console.warn(`⚠️  ${candidate._id} : valeur vide, ignorée.`);
            skipped++;
            continue;
        }

        if (dryRun) {
            migrated++;
            continue;
        }

        try {
            await candidates.updateOne(
                { _id: candidate._id as unknown as object },
                { $set: { 'identity.social_security_number': encryptSsn(plain) } },
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
