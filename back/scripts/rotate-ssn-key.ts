/**
 * Rotation des NIR (GDPR_INF_02.2) : ramène tous les `identity.social_security_number`
 * vers la clé ACTIVE (`SSN_ENCRYPTION_KEY` + `SSN_KDF_SALT`).
 *
 * Traite, par tenant :
 * - NIR en clair (`string`)                    → chiffré ;
 * - triplet au format historique (sans `kid`)  → déchiffré puis ré-chiffré ;
 * - triplet d'une autre clé (`kid` ≠ actif)    → idem (ancienne clé via *_PREVIOUS) ;
 * - triplet déjà à la clé active               → ignoré (idempotent, rejouable).
 *
 * Usage (depuis back/, avec l'environnement de production) :
 *   npx ts-node scripts/rotate-ssn-key.ts --tenant all --dry-run   # inventaire seul
 *   npx ts-node scripts/rotate-ssn-key.ts --tenant all             # applique
 *   npx ts-node scripts/rotate-ssn-key.ts --tenant all --verify    # contrôle lecture seule (AC)
 *
 * --tenant disciplina | annemasse | all (défaut : all)
 * Code de sortie ≠ 0 si une fiche échoue ou si --verify trouve un écart.
 * Les NIR ne sont jamais affichés. Faire un backup (scripts/backup.sh) avant d'appliquer.
 */

import mongoose from 'mongoose';
import { env } from '../src/config/env';
import { ACTIVE_SSN_KID, decryptSsn, isEncryptedSsn, reencryptSsnValue } from '../src/external/crypto/ssn-cipher';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verify = args.includes('--verify');
const tenantArg = args.includes('--tenant') ? args[args.indexOf('--tenant') + 1] : 'all';

// Même résolution d'URI que `src/db/mongo/connection.ts`.
const TENANT_URIS: Record<string, string> = {
    disciplina:
        env.NODE_ENV === 'production'
            ? env.MONGO_URI!
            : `mongodb://${env.MONGO_ROOT_USERNAME}:${env.MONGO_ROOT_PASSWORD}@${env.MONGO_HOST}:${env.MONGO_PORT}/${env.MONGO_DB_NAME}?authSource=admin`,
    annemasse:
        env.NODE_ENV === 'production'
            ? env.MONGO_ANNEMASSE_URI!
            : `mongodb://${env.MONGO_ANNEMASSE_USERNAME ?? env.MONGO_ROOT_USERNAME}:${env.MONGO_ANNEMASSE_PASSWORD ?? env.MONGO_ROOT_PASSWORD}@${env.MONGO_HOST}:${env.MONGO_PORT}/${env.MONGO_ANNEMASSE_DATABASE}?authSource=admin`,
};

interface Counts {
    plaintext: number;
    rotated: number;
    current: number;
    skipped: number;
    failed: number;
}

async function processTenant(name: string, uri: string): Promise<Counts> {
    const counts: Counts = { plaintext: 0, rotated: 0, current: 0, skipped: 0, failed: 0 };
    const conn = await mongoose.createConnection(uri).asPromise();
    try {
        const candidates = conn.collection('candidates');
        const cursor = candidates.find({ 'identity.social_security_number': { $exists: true, $ne: null } });

        for await (const doc of cursor) {
            const id = doc._id as unknown as object;
            const stored = (doc.identity as { social_security_number?: unknown } | undefined)?.social_security_number;
            try {
                if (verify) {
                    // Lecture seule : doit être un triplet à la clé active et déchiffrable.
                    if (typeof stored === 'string') throw new Error('NIR en clair');
                    if (!isEncryptedSsn(stored) || stored.kid !== ACTIVE_SSN_KID) throw new Error('pas à la clé active');
                    decryptSsn(stored);
                    counts.current++;
                    continue;
                }

                const { value, action } = reencryptSsnValue(stored);
                if (action === 'current') {
                    counts.current++;
                    continue;
                }
                if (dryRun) {
                    counts[action]++;
                    continue;
                }
                // Filtre optimiste : si la fiche a été modifiée entre-temps, on ne l'écrase pas.
                const filter =
                    typeof stored === 'string'
                        ? { _id: id, 'identity.social_security_number': stored }
                        : { _id: id, 'identity.social_security_number.encrypted': (stored as { encrypted: string }).encrypted };
                const res = await candidates.updateOne(filter, { $set: { 'identity.social_security_number': value } });
                if (res.modifiedCount === 1) counts[action]++;
                else counts.skipped++;
            } catch (err) {
                console.error(`❌ [${name}] ${String(id)} : ${(err as Error).message}`);
                counts.failed++;
            }
        }
    } finally {
        await conn.close();
    }
    return counts;
}

async function main(): Promise<void> {
    const tenants = tenantArg === 'all' ? Object.keys(TENANT_URIS) : [tenantArg];
    for (const t of tenants) {
        if (!TENANT_URIS[t]) throw new Error(`Tenant inconnu : ${t} (disciplina | annemasse | all)`);
    }

    const mode = verify ? 'verify' : dryRun ? 'dry-run' : 'apply';
    console.log(`Rotation NIR — mode ${mode} — clé active kid=${ACTIVE_SSN_KID}`);

    let bad = 0;
    for (const t of tenants) {
        const c = await processTenant(t, TENANT_URIS[t]);
        console.log(
            `[${t}] clair: ${c.plaintext} — ré-encryptés: ${c.rotated} — déjà à jour: ${c.current} — ignorés (modifiés entre-temps, à relancer): ${c.skipped} — échecs: ${c.failed}`,
        );
        bad += c.failed + c.skipped;
    }

    if (bad > 0) {
        console.error(`\n${bad} fiche(s) à traiter / corriger.`);
        process.exit(1);
    }
    console.log('\nOK.');
}

main().catch((err) => {
    console.error('❌ Rotation échouée :', err);
    process.exit(1);
});
